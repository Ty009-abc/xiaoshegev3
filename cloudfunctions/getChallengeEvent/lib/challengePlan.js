'use strict'
/**
 * challengePlan.js — RC8_14_A CHALLENGE PLAN AUTHORITY
 *
 * Builds and validates an IMMUTABLE, versioned, distinct-event plan for a
 * challenge record. Kept byte-identical across the challenge cloud functions
 * (getChallengeEvent / startChallenge / submitChallengeChoice) so plan
 * authority cannot diverge by construction.
 *
 * Invariants (spec RC8_14_A):
 *   challengeLength   = 30   (diagnostic = 6)
 *   distinctEventIds  = 30
 *   duplicateEventIds = 0
 *   eventOrderImmutable = true
 *
 * Guarantees:
 *   - exactly `challengeLength` DISTINCT eligible eventIds
 *   - fail-closed when the eligible pool is smaller than the challenge length
 *   - delivery is a pure index lookup into the persisted plan (no bank skip)
 *   - an active plan is never rebuilt silently
 *   - legacy active records can be recovered EXPLICITLY (deterministic,
 *     history-preserving) — or refused, never duplicated
 *
 * It NEVER: rewrites the bank, alters scores/tags, edits historical choices,
 * re-serves an event, or touches payment/entitlement authority.
 *
 * @version rc8.14_v1
 */

const PLAN_VERSION = 'rc8.14_v1'
const CHALLENGE_LENGTH = 30
const DIAGNOSTIC_LENGTH = 6

const PLAN_STATUS = {
  OK: 'OK',
  ALREADY: 'ALREADY',
  INSUFFICIENT: 'INSUFFICIENT_ELIGIBLE_EVENTS',
  BANK_ERROR: 'EVENT_BANK_ERROR',
  UNRECOVERABLE: 'LEGACY_PLAN_UNRECOVERABLE',
}

function planLengthFor (record) {
  return (record && record.mode === 'diagnostic') ? DIAGNOSTIC_LENGTH : CHALLENGE_LENGTH
}

function hashString (str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h.toString(36)
}

function computeEventBankVersion (bank) {
  const ids = (bank || []).map((e) => e && e.eventId).filter(Boolean).slice().sort()
  return 'bank_' + hashString(ids.join('|'))
}

function dedupePreserveOrder (ids) {
  const out = []
  const seen = new Set()
  for (const id of ids) if (id && !seen.has(id)) { seen.add(id); out.push(id) }
  return out
}

function hasPlan (record) {
  return !!(record && record.plan && Array.isArray(record.plan.eventIds) && record.plan.eventIds.length)
}

/** Structural validation of a persisted plan against a record. */
function validatePlan (plan, record) {
  const want = planLengthFor(record)
  if (!plan || !Array.isArray(plan.eventIds)) return { ok: false, reasonCode: 'PLAN_MISSING' }
  if (plan.challengeLength !== want) return { ok: false, reasonCode: 'PLAN_LENGTH_FIELD_MISMATCH' }
  if (plan.eventIds.length !== want) return { ok: false, reasonCode: 'PLAN_LENGTH_MISMATCH' }
  if (new Set(plan.eventIds).size !== want) return { ok: false, reasonCode: 'PLAN_DUPLICATE_IDS' }
  return { ok: true }
}

/** Event id served at an index — pure lookup, no fallback, no re-serve. */
function eventIdAtIndex (plan, index) {
  if (!plan || !Array.isArray(plan.eventIds)) return null
  if (!Number.isInteger(index) || index < 0 || index >= plan.eventIds.length) return null
  return plan.eventIds[index]
}

/**
 * Eligible ids = bank ids minus contraindicated ids for the occupation.
 * @param {Array} bank  raw bank docs [{eventId}]
 * @param {string} occupation
 * @param {object} eventMeta  EVENT_META map (from challengeEventCatalog)
 */
function eligibleIds (bank, occupation, eventMeta) {
  const meta = eventMeta || {}
  const out = []
  for (const e of bank) {
    const id = e && e.eventId
    if (!id) continue
    const m = meta[id]
    const contra = (m && m.contraindications) || []
    if (occupation && contra.includes(occupation)) continue
    out.push(id)
  }
  return out
}

/** Cheap, exact eligibility count (occupation filter only). */
function evaluateEligibility (bank, occupation, eventMeta) {
  const ids = eligibleIds(bank, occupation, eventMeta)
  return { count: ids.length, ids }
}

/**
 * Core: turn the pieces into an immutable distinct plan.
 * @returns {{status, plan?, planEventIds?, reasonCode?, eligibleCount?, required?}}
 */
function finalizeFromParts (parts) {
  const p = parts || {}
  const record = p.record || {}
  const want = planLengthFor(record)
  const bankIds = new Set(p.allEventIds || [])
  const filtered = new Set(p.filteredIds || [])

  // eligible = all active bank ids minus contraindicated
  const elig = []
  for (const id of (p.allEventIds || [])) if (!filtered.has(id)) elig.push(id)
  const eligSet = new Set(elig)

  if (elig.length < want) {
    return {
      status: PLAN_STATUS.INSUFFICIENT,
      reasonCode: PLAN_STATUS.INSUFFICIENT,
      eligibleCount: elig.length,
      required: want,
    }
  }

  // builder order (distinct) → then deterministic backfill from eligible
  const ord = dedupePreserveOrder((p.orderedIds || []).filter((id) => eligSet.has(id)))
  const eventIds = ord.slice(0, want)
  const chosen = new Set(eventIds)
  for (const id of elig) {
    if (eventIds.length >= want) break
    if (!chosen.has(id)) { chosen.add(id); eventIds.push(id) }
  }

  if (eventIds.length !== want) {
    return { status: PLAN_STATUS.UNRECOVERABLE, reasonCode: 'PLAN_LENGTH_UNSATISFIED', required: want }
  }
  if (new Set(eventIds).size !== want) {
    return { status: PLAN_STATUS.BANK_ERROR, reasonCode: 'PLAN_DUPLICATE_IDS' }
  }
  for (const id of eventIds) {
    if (!bankIds.has(id)) return { status: PLAN_STATUS.BANK_ERROR, reasonCode: 'PLAN_INELIGIBLE_ID' }
  }

  const plan = {
    planVersion: PLAN_VERSION,
    challengeLength: want,
    eventBankVersion: computeEventBankVersion((p.allEventIds || []).map((id) => ({ eventId: id }))),
    eventIds,
    createdAt: Date.now(),
    source: p.source || 'personalized_v1',
  }
  if (p.recoveredFrom) plan.recoveredFrom = p.recoveredFrom
  return { status: PLAN_STATUS.OK, plan, planEventIds: eventIds.slice() }
}

/**
 * buildPlan — load bank, build personalized order, finalize a distinct plan.
 * @param {object} args { db, openid, record, ctx, buildPersonalizedPlan, persist }
 */
async function buildPlan (args) {
  const a = args || {}
  const record = a.record || {}
  if (hasPlan(record)) {
    return { status: PLAN_STATUS.ALREADY, plan: record.plan, planEventIds: record.plan.eventIds.slice() }
  }
  const bank = await _loadBank(a.db)
  if (bank.error) return { status: PLAN_STATUS.BANK_ERROR, reasonCode: bank.error }
  const dup = _checkBankUnique(bank.list)
  if (dup) return { status: PLAN_STATUS.BANK_ERROR, reasonCode: dup }

  let built
  try { built = a.buildPersonalizedPlan(bank.list, a.ctx || {}, record.choices || [], { openid: a.openid }) }
  catch (e) { return { status: PLAN_STATUS.BANK_ERROR, reasonCode: 'PLAN_BUILD_FAILED' } }

  const res = finalizeFromParts({
    record,
    allEventIds: bank.list.map((e) => e.eventId),
    orderedIds: (built.plan || []).map((x) => (x && (x.eventId || x)) || null),
    filteredIds: (built.filteredOut || []).map((f) => f && f.eventId).filter(Boolean),
    source: 'personalized_v1',
  })
  if (res.status === PLAN_STATUS.OK && typeof a.persist === 'function') {
    try { await a.persist(res.plan) } catch (e) { return { status: PLAN_STATUS.BANK_ERROR, reasonCode: 'PLAN_PERSIST_FAILED' } }
  }
  return res
}

/**
 * recoverLegacyPlan — EXPLICIT recovery for an ACTIVE legacy record with no plan.
 * Aligns plan prefix with already-answered eventIds (history preserved), then
 * backfills distinct eligible events. Never rewrites history.
 */
async function recoverLegacyPlan (args) {
  const a = args || {}
  const record = a.record || {}
  const want = planLengthFor(record)
  if (hasPlan(record)) {
    return { status: PLAN_STATUS.ALREADY, plan: record.plan, planEventIds: record.plan.eventIds.slice() }
  }
  const answered = (record.choices || []).map((c) => c && c.eventId).filter(Boolean)
  if (new Set(answered).size !== answered.length) {
    return { status: PLAN_STATUS.UNRECOVERABLE, reasonCode: 'LEGACY_ANSWERED_DUPLICATE' }
  }
  if (answered.length > want) {
    return { status: PLAN_STATUS.UNRECOVERABLE, reasonCode: 'LEGACY_ANSWERED_OVERFLOW' }
  }
  const bank = await _loadBank(a.db)
  if (bank.error) return { status: PLAN_STATUS.BANK_ERROR, reasonCode: bank.error }
  const dup = _checkBankUnique(bank.list)
  if (dup) return { status: PLAN_STATUS.BANK_ERROR, reasonCode: dup }

  let built
  try { built = a.buildPersonalizedPlan(bank.list, a.ctx || {}, answered.map((id) => ({ eventId: id })), { openid: a.openid }) }
  catch (e) { return { status: PLAN_STATUS.BANK_ERROR, reasonCode: 'PLAN_BUILD_FAILED' } }

  const filteredIds = (built.filteredOut || []).map((f) => f && f.eventId).filter(Boolean)
  const elig = eligibleIds(bank.list, (a.ctx && a.ctx.explicitProfile && a.ctx.explicitProfile.occupation) || '', a.eventMeta)
  const eligSet = new Set(elig)

  // prefix = answered (immutable history) + deterministic backfill
  const eventIds = answered.slice(0, want)
  const chosen = new Set(eventIds)
  for (const x of (built.plan || [])) {
    if (eventIds.length >= want) break
    const id = (x && (x.eventId || x)) || null
    if (id && !chosen.has(id) && eligSet.has(id)) { chosen.add(id); eventIds.push(id) }
  }
  for (const id of elig) {
    if (eventIds.length >= want) break
    if (!chosen.has(id)) { chosen.add(id); eventIds.push(id) }
  }
  if (eventIds.length !== want || new Set(eventIds).size !== want) {
    return { status: PLAN_STATUS.UNRECOVERABLE, reasonCode: 'LEGACY_PLAN_UNRECOVERABLE', eligibleCount: elig.length, required: want }
  }
  const bankIds = new Set(bank.list.map((e) => e.eventId))
  for (const id of eventIds.slice(answered.length)) {
    if (!bankIds.has(id)) return { status: PLAN_STATUS.UNRECOVERABLE, reasonCode: 'LEGACY_PLAN_INELIGIBLE_ID' }
  }

  const plan = {
    planVersion: PLAN_VERSION,
    challengeLength: want,
    eventBankVersion: computeEventBankVersion(bank.list),
    eventIds,
    createdAt: Date.now(),
    source: 'legacy_recovery_v1',
    recoveredFrom: 'legacy_prefix',
  }
  if (typeof a.persist === 'function') {
    try { await a.persist(plan) } catch (e) { return { status: PLAN_STATUS.BANK_ERROR, reasonCode: 'PLAN_PERSIST_FAILED' } }
  }
  return { status: PLAN_STATUS.OK, plan, planEventIds: eventIds.slice() }
}

async function _loadBank (db) {
  try {
    const r = await db.collection('challenge_events').where({ status: 'active' }).orderBy('day', 'asc').limit(200).get()
    const list = r.data || []
    if (!list.length) return { error: 'BANK_EMPTY', list: [] }
    return { list }
  } catch (e) {
    return { error: 'BANK_LOAD_FAILED', list: [] }
  }
}

function _checkBankUnique (list) {
  const seen = new Set()
  for (const e of list) {
    const id = e && e.eventId
    if (!id) return 'BANK_MISSING_ID'
    if (seen.has(id)) return 'BANK_ID_DUPLICATE'
    seen.add(id)
  }
  return null
}

module.exports = {
  PLAN_VERSION, CHALLENGE_LENGTH, DIAGNOSTIC_LENGTH, PLAN_STATUS,
  planLengthFor, computeEventBankVersion, dedupePreserveOrder,
  hasPlan, validatePlan, eventIdAtIndex, eligibleIds, evaluateEligibility,
  finalizeFromParts, buildPlan, recoverLegacyPlan,
}
