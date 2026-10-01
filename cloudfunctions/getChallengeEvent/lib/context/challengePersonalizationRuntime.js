'use strict'
/**
 * getChallengeEvent/lib/context/challengePersonalizationRuntime.js
 *
 * RC8_10B — runtime bridge between the (unchanged) challenge_events bank and
 * the personalized selector. Deterministic + openid-scoped.
 *
 * resolvePersonalizedEvent({ db, openid, record, callAI? }):
 *   - loads the bank (status:'active', bounded page)
 *   - builds the SHARED user context (L0 6Q → … → L4 memory[gated])
 *   - builds the deterministic plan for the user's REAL situation
 *   - returns the decorated event at the record's current index
 *
 * On ANY failure it returns { fallback:true, reasonCode } and the caller uses
 * the legacy day-ordered selection (behavior-preserving).
 */

const ucb = require('./userContextBuilder.js')
const { decorateEvent } = require('../challengeEventCatalog.js')
const personal = require('../challengePersonalization.js')

const PAGE = 100
const CANONICAL_TOTAL = 30 // RC8_12 — ONE canonical 30-question challenge authority

function uniqueEventIds (choices) {
  const out = []
  const seen = new Set()
  for (const c of (choices || [])) {
    const id = c && c.eventId
    if (id && !seen.has(id)) { seen.add(id); out.push(id) }
  }
  return out
}

async function resolvePersonalizedEvent (args) {
  const a = args || {}
  const db = a.db
  const openid = a.openid
  const record = a.record || {}
  const t0 = Date.now()

  // 1) bank
  let events = []
  try {
    const r = await db.collection('challenge_events').where({ status: 'active' }).orderBy('day', 'asc').limit(PAGE).get()
    events = r.data || []
  } catch (e) {
    return { fallback: true, reasonCode: 'BANK_LOAD_FAILED', latencyMs: Date.now() - t0 }
  }
  if (!events.length) return { fallback: true, reasonCode: 'BANK_EMPTY', latencyMs: Date.now() - t0 }

  // 2) context — memory gated server-side (memoryEnabled); never client-supplied
  let memoryEnabled = true
  try {
    if (a.memoryEngine && typeof a.memoryEngine.isMemoryEnabled === 'function') {
      memoryEnabled = await a.memoryEngine.isMemoryEnabled(openid)
    }
  } catch (_) { memoryEnabled = true }

  let ctx
  try {
    ctx = await ucb.buildUserContext(db, openid, { scenario: 'career', message: '', memoryEnabled, memoryEngine: a.memoryEngine })
  } catch (e) {
    return { fallback: true, reasonCode: 'CONTEXT_BUILD_FAILED', latencyMs: Date.now() - t0 }
  }

  // 3) plan (deterministic) — RC8_12: exclude ALREADY-ANSWERED events (no recycle)
  // and pad to the canonical 30 so one plan is the single source of truth.
  const priorChoices = record.choices || []
  let built
  try {
    built = personal.buildPersonalizedPlan(events, ctx, priorChoices, { openid, excludeSeen: true, padToTotal: CANONICAL_TOTAL })
  } catch (e) {
    return { fallback: true, reasonCode: 'PLAN_BUILD_FAILED', latencyMs: Date.now() - t0 }
  }

  const { plan, filteredOut, metrics, profileVersion } = built
  const eventsById = {}
  for (const ev of events) eventsById[ev.eventId] = ev

  // RC8_12 no-repeat guard: the plan already hard-excluded seen events; assert it
  // here so a caller can never receive an already-answered event (belt + braces).
  const seenSet = new Set(uniqueEventIds(record.choices))
  const answeredCount = priorChoices.length || record.currentEventIndex || 0

  // RC8_12: the plan is the SINGLE authority. Canonical total = 30 (padded to
  // length for occupational filtering); completion is defined against this plan,
  // NOT against the raw bank — so there is never a phantom 28→29→30 tail.
  const canonicalLength = plan.length || CANONICAL_TOTAL

  // 4) next UNSEEN event (plan already excludes seen + is ordered by progression).
  //    plan[0] = the next unseen event; never recycle an answered event.
  const targetId = plan[0] && (plan[0].eventId || plan[0])
  const raw = (targetId && eventsById[targetId]) || null
  if (!raw) {
    // Plan genuinely exhausted (canonical length reached) → caller treats as finished.
    return { fallback: false, exhausted: true, planExhausted: true, planEventIds: plan.map((p) => p.eventId || p), metrics, canonicalLength, answeredCount, uniqueEventIds: Array.from(seenSet), latencyMs: Date.now() - t0 }
  }
  // Hard no-repeat: never hand back a seen event.
  if (seenSet.has(raw.eventId)) {
    return { fallback: false, exhausted: true, seenEventRejected: raw.eventId, planEventIds: plan.map((p) => p.eventId || p), metrics, canonicalLength, answeredCount, latencyMs: Date.now() - t0 }
  }
  const event = decorateEvent(raw)

  return {
    fallback: false,
    event,
    planEventIds: plan.map((p) => p.eventId || p),
    filteredOut,
    metrics,
    profileVersion,
    canonicalLength,
    answeredCount,
    latencyMs: Date.now() - t0,
  }
}

module.exports = { resolvePersonalizedEvent, CANONICAL_TOTAL, uniqueEventIds }
