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

async function resolvePersonalizedEvent (args) {
  const a = args || {}
  const db = a.db
  const openid = a.openid
  const record = a.record || {}
  const index = record.currentEventIndex || 0
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

  // 3) plan (deterministic)
  const priorChoices = record.choices || []
  let built
  try {
    built = personal.buildPersonalizedPlan(events, ctx, priorChoices, { openid })
  } catch (e) {
    return { fallback: true, reasonCode: 'PLAN_BUILD_FAILED', latencyMs: Date.now() - t0 }
  }

  const { plan, filteredOut, metrics, profileVersion } = built
  const eventsById = {}
  for (const ev of events) eventsById[ev.eventId] = ev

  // 4) event at the record's current index (progression preserved)
  const targetId = plan[index] && (plan[index].eventId || plan[index])
  const raw = (targetId && eventsById[targetId]) || null
  if (!raw) {
    return { fallback: true, reasonCode: 'PLAN_EXHAUSTED', latencyMs: Date.now() - t0, metrics }
  }
  const event = decorateEvent(raw)

  return {
    fallback: false,
    event,
    planEventIds: plan.map((p) => p.eventId || p),
    filteredOut,
    metrics,
    profileVersion,
    latencyMs: Date.now() - t0,
  }
}

module.exports = { resolvePersonalizedEvent }
