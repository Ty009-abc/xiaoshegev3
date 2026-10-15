'use strict'
/**
 * activeSession.js — RC8_14_D12 TRIAL RESUME + ATOMIC ACTIVE-SESSION AUTHORITY
 *
 * Purpose: make `startChallenge` RESUME an existing active challenge record
 * instead of unconditionally creating a new trial (branch C), and make
 * concurrent `startChallenge` calls CONVERGE on exactly one authoritative
 * record via an atomic claim on a dedicated `challenge_active` collection
 * (unique `_id = openid`).
 *
 * Invariants (RC8_14_D12):
 *   - challenge_records remains the CANONICAL authority; this module never
 *     rewrites scores/tags/choices/plans and never deletes/merges records.
 *   - trial boundary = 3 events, per RECORD (matches getChallengeEvent).
 *   - resume NEVER re-serves an answered event (answered prefix is validated).
 *   - an immutable plan is never silently rebuilt during resume.
 *   - malformed active records are refused (UNRECOVERABLE) — never a silent
 *     reset and never a hidden extra free trial.
 *   - free access is never escalated to paid implicitly.
 *
 * The module is pure-ish: selection/validation are pure functions; the claim
 * helpers touch only the `challenge_active` collection.
 *
 * @version rc8.14_d12_v1
 */

const planAuthority = require('./challengePlan.js')

const COLLECTION = 'challenge_active'
const TRIAL_LIMIT = 3
const CLAIM_TTL_MS = 30 * 1000 // bounded claim lifetime; a crashed claimant is stolen after this

const CLAIM_STATE = { CLAIMING: 'CLAIMING', READY: 'READY' }

const ACTIONS = {
  RESUME: 'RESUME',
  NEED_PAYMENT: 'NEED_PAYMENT',
  NONE: 'NONE',
  UNRECOVERABLE: 'UNRECOVERABLE',
}

function newToken (ts) {
  return 'tok_' + Number(ts || Date.now()).toString(36) + '_' + Math.random().toString(36).slice(2, 10)
}

function sleep (ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Structural + semantic validation of a candidate ACTIVE record.
 * @param {object} record
 * @param {object} [opts] { bankIdSet?: Set<string> }  — when provided, every
 *        plan event must exist in the current active bank (bank compatibility).
 * @returns {{ok:boolean, reason?:string}}
 */
function validateCandidate (record, opts) {
  const o = opts || {}
  if (!record) return { ok: false, reason: 'NO_RECORD' }
  if (!record.recordId) return { ok: false, reason: 'NO_RECORD_ID' }
  if (record.mode !== 'challenge') return { ok: false, reason: 'WRONG_MODE' }
  if (record.status === 'finished') return { ok: false, reason: 'FINISHED' }

  const plan = record.plan
  const v = planAuthority.validatePlan(plan, record)
  if (!v.ok) return { ok: false, reason: 'PLAN_INVALID:' + v.reasonCode }
  if (!plan.eventBankVersion || typeof plan.eventBankVersion !== 'string') {
    return { ok: false, reason: 'PLAN_BANK_VERSION_MISSING' }
  }
  if (o.bankIdSet) {
    for (const id of plan.eventIds) {
      if (!o.bankIdSet.has(id)) return { ok: false, reason: 'PLAN_EVENT_NOT_IN_BANK:' + id }
    }
  }

  const choices = Array.isArray(record.choices) ? record.choices : []
  const idx = Number.isInteger(record.currentEventIndex) ? record.currentEventIndex : 0
  if (idx < 0) return { ok: false, reason: 'INDEX_NEGATIVE' }
  if (idx > plan.eventIds.length) return { ok: false, reason: 'INDEX_OVERFLOW' }
  if (choices.length !== idx) return { ok: false, reason: 'INDEX_CHOICE_MISMATCH' }

  const ids = choices.map((c) => c && c.eventId).filter(Boolean)
  if (ids.length !== choices.length) return { ok: false, reason: 'CHOICE_MISSING_EVENT' }
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'CHOICE_DUPLICATE' }
  for (let i = 0; i < ids.length; i++) {
    if (plan.eventIds[i] !== ids[i]) return { ok: false, reason: 'PREFIX_MISMATCH' }
  }
  return { ok: true }
}

/**
 * Deterministic selection among the caller's OWNED active records.
 * Order: valid nonterminal progress → currentEventIndex DESC → updatedAt DESC
 *        → createdAt DESC → recordId ASC.
 * @returns {{action, record?, reason?}}
 */
function selectResumable (records, opts) {
  const o = opts || {}
  const valid = []
  let sawMalformed = false
  for (const r of (records || [])) {
    const v = validateCandidate(r, { bankIdSet: o.bankIdSet })
    if (v.ok) valid.push(r); else sawMalformed = true
  }
  if (!valid.length) {
    if (sawMalformed) return { action: ACTIONS.UNRECOVERABLE, reason: 'ALL_CANDIDATES_MALFORMED' }
    return { action: ACTIONS.NONE }
  }
  valid.sort((a, b) =>
    (b.currentEventIndex - a.currentEventIndex) ||
    ((b.updatedAt || 0) - (a.updatedAt || 0)) ||
    ((b.createdAt || 0) - (a.createdAt || 0)) ||
    String(a.recordId).localeCompare(String(b.recordId)))
  const best = valid[0]
  // Day-3 boundary only gates users WITHOUT entitlement (paid users resume).
  if (best.trialMode && !o.hasAccess && best.currentEventIndex >= TRIAL_LIMIT) {
    return { action: ACTIONS.NEED_PAYMENT, record: best }
  }
  return { action: ACTIONS.RESUME, record: best }
}

// ── DB helpers (only `challenge_active` is mutated) ──

async function readActive (db, openid) {
  try {
    const r = await db.collection(COLLECTION).where({ _id: openid }).limit(1).get()
    return (r && r.data && r.data[0]) || null
  } catch (_) { return null }
}

async function loadRecord (db, openid, recordId) {
  try {
    const r = await db.collection('challenge_records').where({ recordId, openid }).limit(1).get()
    return (r && r.data && r.data[0]) || null
  } catch (_) { return null }
}

/**
 * Strict variant: THROWS on a read ERROR (e.g. transient DB failure) so callers
 * can distinguish "temporarily unreadable" (fail closed, never invalidate a
 * READY pointer) from "genuinely absent" (returns null).
 */
async function loadRecordStrict (db, openid, recordId) {
  const r = await db.collection('challenge_records').where({ recordId, openid }).limit(1).get()
  return (r && r.data && r.data[0]) || null
}

/**
 * Deterministic creation identity for one claim operation. Stable across
 * retries of the SAME session claim, so a committed-but-unacknowledged insert
 * can be detected (duplicate key on `_id`) instead of duplicated.
 */
function makeRecordId (ts) {
  return 'CR' + Number(ts || Date.now()).toString(36) + Math.random().toString(36).slice(2, 10)
}

/**
 * NOTE: there is deliberately NO destructive compensation helper here.
 * An uncertain authority outcome must NEVER delete a record: a READY session may
 * already point at it. Superseded/failed creations are left as recoverable
 * pending records and are reconciled non-destructively (never deleted).
 */

/**
 * Authoritative pre-insert fence: are we STILL the current CLAIMING holder?
 * If a stale steal / takeover happened while we were building the record, this
 * returns false so the caller aborts the insertion (no orphan record).
 */
async function stillClaiming ({ db, openid, token }) {
  const s = await readActive(db, openid)
  return !!(s && s.state === CLAIM_STATE.CLAIMING && s.ownerToken === token)
}

/**
 * Post-create authority check: is the session READY and pointing at exactly
 * the recordId we created, still owned by our token? Success may be reported
 * ONLY when this is true (never on an unconfirmed insert).
 */
async function isAuthoritative ({ db, openid, token, recordId }) {
  const s = await readActive(db, openid)
  return !!(s && s.state === CLAIM_STATE.READY && s.recordId === recordId && s.ownerToken === token)
}

/**
 * Attempt to become the SOLE owner of the user's active session.
 * Atomic primitives (verified SDK 4.0.2):
 *   - insert with explicit `_id` (unique) → only one INSERT can win;
 *   - conditional update CAS'd on (ownerToken, state, expiresAt).
 * @returns {{won:boolean, token:string, session:object|null, mode:string, reason?:string}}
 */
async function claim ({ db, openid, now }) {
  const token = newToken(now)
  const expiresAt = now + CLAIM_TTL_MS
  const cur = await readActive(db, openid)

  // (a) no doc → atomic insert. A deterministic creationId is minted HERE and
  //     is PRESERVED across a lease takeover, so a superseded retry reuses the
  //     SAME record identity → record creation stays idempotent (unique _id).
  if (!cur) {
    const creationId = makeRecordId(now)
    try {
      await db.collection(COLLECTION).add({
        data: {
          _id: openid,
          ownerToken: token,
          state: CLAIM_STATE.CLAIMING,
          recordId: null,
          creationId,
          claimedAt: now,
          readyAt: null,
          expiresAt,
        },
      })
      return { won: true, token, creationId, session: null, mode: 'INSERT' }
    } catch (_e) {
      return { won: false, token, session: await readActive(db, openid), reason: 'INSERT_LOST' }
    }
  }

  // (b) stale CLAIMING (creator crashed / expired) → CAS steal.
  //     A released claim (expiresAt=0) is immediately stealable (crash/abort
  //     recovery). An EXPIRED lease is stealable. A live lease is not.
  //     The creationId is PRESERVED so the new owner targets the SAME record
  //     identity (no duplicate, no cross-lease overwrite).
  if (cur.state === CLAIM_STATE.CLAIMING && (cur.expiresAt || 0) <= now) {
    const creationId = cur.creationId || makeRecordId(now)
    const res = await db.collection(COLLECTION)
      .where({ _id: openid, ownerToken: cur.ownerToken, state: CLAIM_STATE.CLAIMING, expiresAt: cur.expiresAt })
      .update({ data: { ownerToken: token, state: CLAIM_STATE.CLAIMING, recordId: null, creationId, claimedAt: now, readyAt: null, expiresAt } })
    const won = !!(res && res.stats && res.stats.updated === 1)
    return won
      ? { won: true, token, creationId, session: null, mode: 'STEAL_STALE' }
      : { won: false, token, session: await readActive(db, openid), reason: 'STEAL_LOST' }
  }

  // (c) READY session is AUTHORITATIVE. A fresh create must NEVER silently
  //     replace it (that was the RC8_14_D12 B1 duplicate-creation window).
  //     Invalidation of a READY session is only ever done EXPLICITLY via
  //     reclaimInvalid() after authoritative verification.
  return { won: false, token, session: cur, reason: 'HELD' }
}

/**
 * Explicitly INVALIDATE a READY session whose pointed record is missing,
 * un-owned, or finished — CAS on the observed READY state. Only after the
 * caller has AUTHORITATIVELY verified the target is unusable (never from an
 * ordinary challenge_records list scan miss).
 * @returns {{won:boolean, token:string, priorRecordId:string|null, session:object|null}}
 */
async function reclaimInvalid ({ db, openid, expectedRecordId, expectedToken, now }) {
  const token = newToken(now)
  const expiresAt = now + CLAIM_TTL_MS
  // A deliberately NEW round: mint a fresh creationId (distinct record identity).
  const creationId = makeRecordId(now)
  const res = await db.collection(COLLECTION)
    .where({ _id: openid, ownerToken: expectedToken, state: CLAIM_STATE.READY, recordId: expectedRecordId })
    .update({ data: { ownerToken: token, state: CLAIM_STATE.CLAIMING, recordId: null, creationId, claimedAt: now, readyAt: null, expiresAt } })
  const won = !!(res && res.stats && res.stats.updated === 1)
  return { won, token, creationId, priorRecordId: expectedRecordId, session: won ? null : await readActive(db, openid) }
}

/**
 * CAS transition CLAIMING(token) → READY(recordId). Only the current holder may.
 * @returns {{won:boolean, session:object|null}}
 */
async function markReady ({ db, openid, token, recordId, now }) {
  const res = await db.collection(COLLECTION)
    .where({ _id: openid, ownerToken: token, state: CLAIM_STATE.CLAIMING })
    .update({ data: { state: CLAIM_STATE.READY, recordId, readyAt: now, expiresAt: null } })
  const won = !!(res && res.stats && res.stats.updated === 1)
  return { won, session: won ? null : await readActive(db, openid) }
}

/**
 * Read-only pointer reconciliation: repoint a READY session to another owned
 * record (or null) via CAS on the observed READY state. Used ONLY when the
 * authoritative target is provably not ours — never to steal another owner's
 * record and never to create.
 * @returns {{won:boolean}}
 */
async function reconcileReady ({ db, openid, expectedToken, expectedRecordId, recordId }) {
  try {
    const res = await db.collection(COLLECTION)
      .where({ _id: openid, ownerToken: expectedToken, state: CLAIM_STATE.READY, recordId: expectedRecordId })
      .update({ data: { recordId } })
    return { won: !!(res && res.stats && res.stats.updated === 1) }
  } catch (_) { return { won: false } }
}

/** Voluntarily give up a CLAIMING token (immediate expiry → stealable). */
async function release ({ db, openid, token }) {
  try {
    const res = await db.collection(COLLECTION)
      .where({ _id: openid, ownerToken: token })
      .update({ data: { expiresAt: 0 } })
    return { released: (res && res.stats && res.stats.updated) || 0 }
  } catch (_) { return { released: 0 } }
}

/**
 * Bounded wait for the current holder to reach READY, then return its record.
 * Never invents a record. Returns null if the session never becomes READY.
 */
async function converge ({ db, openid, tries = 20 }) {
  for (let i = 0; i < tries; i++) {
    const s = await readActive(db, openid)
    if (s && s.state === CLAIM_STATE.READY && s.recordId) {
      const rec = await loadRecord(db, openid, s.recordId)
      if (rec && validateCandidate(rec).ok) return { session: s, record: rec }
    }
    await sleep(5 + i * 3)
  }
  return null
}

module.exports = {
  COLLECTION, TRIAL_LIMIT, CLAIM_TTL_MS, CLAIM_STATE, ACTIONS,
  newToken, makeRecordId, validateCandidate, selectResumable,
  readActive, loadRecord, loadRecordStrict, stillClaiming, isAuthoritative, claim, reclaimInvalid, reconcileReady, markReady, release, converge,
}
