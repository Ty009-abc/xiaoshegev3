'use strict'
/**
 * lib/cognitiveProfile/personalization/worldRuleRecommenderV6.js
 *
 * RC8.4 V6 R78 §5–§10 — DETERMINISTIC WORLD-RULE RECOMMENDER (WR001–WR015).
 *
 * Inputs (from the CANONICAL profile — §2, never re-derived from raw sources):
 *   profile.currentFocus.worldRuleLensIds
 *   profile.currentFocus.priorityTopicIds
 *   profile.cognitiveState.primaryBlindSpot
 *   profile.diagnosticState.primaryBottleneck
 *   profile.learningHistory.seenRuleIds
 *
 * Output: { wrId, reasonCode, sourceSignal, personalized }
 *
 * §6 deterministic scoring — DIRECT lens > PARTIAL lens > topic/tag match >
 * blind-spot match > bottleneck match > legacy dimension > fallback. NO LLM.
 * §7 NONE crosswalk rows never force a WR id.
 * §8 prefer unseen; fall back deterministically without dead-ending.
 * §9 stable for same user + same date + same profile (deterministic tie-break).
 * §10 absent / legacy / unmappable profile → preserve existing behavior.
 *
 * PURE. No I/O. No AI. No randomness.
 */

const {
  REASON_CODE, SOURCE_SIGNAL, SCORE,
  WORLD_RULE_INDEX, WORLD_RULE_IDS, TOPIC_WR_MAP, BLINDSPOT_KEYWORD_MAP,
  LEGACY_DIM_GAP_MAP, LEGACY_BANDS, bottleneckToWorldRules
} = require('./personalizationMapsV6.js')
const { getCrosswalkForLens, CROSSWALK_STATUS } = require('../worldRuleCrosswalkV6.js')

// ── small helpers ───────────────────────────────────────────────
function asArray (v) { return Array.isArray(v) ? v.filter(Boolean) : [] }
function assertValue (node) { return node && typeof node === 'object' && 'value' in node ? node.value : node }
function assertExpr (node) { return node && typeof node === 'object' && 'expression' in node ? node.expression : (typeof node === 'string' ? node : null) }

/** §9 deterministic ordering key for a WR candidate: score desc, then wrId asc. */
function betterThan (a, b) {
  if (!b) return true
  if (a.score !== b.score) return a.score > b.score
  return a.wrId < b.wrId
}

/**
 * Score a WR candidate set from ONE profile.
 * @returns {{scores:Object<string,{score,reasonCode,sourceSignal}>, hasSignal:boolean}}
 */
function scoreCandidates (profile) {
  const P = profile || {}
  const focus = P.currentFocus || null
  const cog = P.cognitiveState || null
  const diag = P.diagnosticState || null

  const lensIds = focus ? asArray(focus.worldRuleLensIds) : []
  const topicIds = focus ? asArray(focus.priorityTopicIds) : []
  const blindSpot = cog ? assertExpr(cog.primaryBlindSpot) : null
  const bottleneck = diag ? assertValue(diag.primaryBottleneck) : null

  const scores = {}
  const bump = (wrId, score, reasonCode, sourceSignal) => {
    if (!wrId || !WORLD_RULE_INDEX[wrId]) return
    const cur = scores[wrId]
    if (!cur || score > cur.score) scores[wrId] = { score: score, reasonCode: reasonCode, sourceSignal: sourceSignal }
  }

  let hasSignal = false

  // §3.1 lens ids (STRONGEST) — DIRECT > PARTIAL.
  for (const lensId of lensIds) {
    const cw = getCrosswalkForLens(lensId)
    if (!cw || !cw.wrId) continue            // §7 NONE → continue, never force
    hasSignal = true
    if (cw.status === CROSSWALK_STATUS.DIRECT) bump(cw.wrId, SCORE.LENS_DIRECT, REASON_CODE.LENS_DIRECT, SOURCE_SIGNAL.LENS)
    else bump(cw.wrId, SCORE.LENS_PARTIAL, REASON_CODE.LENS_PARTIAL, SOURCE_SIGNAL.LENS)
  }

  // §3.2 topic ids (PROBLEM_*) — DIRECT > PARTIAL.
  for (const t of topicIds) {
    const rows = TOPIC_WR_MAP[t] || []
    for (const row of rows) {
      hasSignal = true
      bump(row.wr, row.status === 'DIRECT' ? SCORE.TOPIC_DIRECT : SCORE.TOPIC_PARTIAL,
        REASON_CODE.TOPIC_MATCH, SOURCE_SIGNAL.TOPIC)
    }
  }

  // §3.3 blind-spot expression — deterministic keyword match only.
  if (blindSpot) {
    for (const row of BLINDSPOT_KEYWORD_MAP) {
      if (blindSpot.indexOf(row.kw) !== -1) {
        hasSignal = true
        bump(row.wr, row.status === 'DIRECT' ? SCORE.BLINDSPOT_DIRECT : SCORE.BLINDSPOT_PARTIAL,
          REASON_CODE.BLINDSPOT_MATCH, SOURCE_SIGNAL.BLINDSPOT)
      }
    }
  }

  // §3.4 bottleneck → WR (via frozen bottleneck→lens→WR path).
  if (bottleneck) {
    for (const row of bottleneckToWorldRules(bottleneck)) {
      hasSignal = true
      bump(row.wr, SCORE.BOTTLENECK, REASON_CODE.BOTTLENECK_MATCH, SOURCE_SIGNAL.BOTTLENECK)
    }
  }

  // §3.5 legacy 9-dimension signals — ONLY meaningful for a legacy doc.
  if (P.isLegacy && P.dimensions) {
    for (const dimKey of Object.keys(LEGACY_DIM_GAP_MAP)) {
      const spec = LEGACY_DIM_GAP_MAP[dimKey]
      const v = P.dimensions[dimKey]
      if (typeof v !== 'number') continue
      const isGap = spec.band === 'low' ? v < LEGACY_BANDS.low : v > LEGACY_BANDS.high
      if (isGap) {
        hasSignal = true
        bump(spec.wr, SCORE.LEGACY_DIMENSION, REASON_CODE.LEGACY_DIMENSION_MATCH, SOURCE_SIGNAL.LEGACY_DIMENSION)
      }
    }
  }

  return { scores: scores, hasSignal: hasSignal }
}

/**
 * §5/§9/§10 recommend a world rule for a canonical profile + date.
 * @param {Object} profile canonical normalized profile (R77 reader output)
 * @param {number} dayIndex deterministic day index (e.g. floor(startOfDay/86400000))
 * @param {Object} [opts] { contentAvailable:Object<string,boolean> }
 * @returns {{wrId:string|null, reasonCode:string, sourceSignal:string, personalized:boolean}}
 */
function recommendWorldRule (profile, dayIndex, opts) {
  const P = profile || {}
  const o = opts || {}
  const available = o.contentAvailable || null
  const isPresent = !!P.present
  const sc = scoreCandidates(P)

  const personalized = isPresent && sc.hasSignal
  const seen = new Set(asArray(P.learningHistory && P.learningHistory.seenRuleIds))
  const day = (typeof dayIndex === 'number' && isFinite(dayIndex)) ? Math.abs(Math.floor(dayIndex)) : 0

  const result = (wrId, reasonCode, sourceSignal) => ({
    wrId: wrId, reasonCode: reasonCode, sourceSignal: sourceSignal, personalized: personalized
  })

  if (!personalized) {
    // §10 — absent / legacy-with-no-signal / unmappable → deterministic date
    // fallback over the FULL library (preserves existing date-based behavior).
    const idx = day % WORLD_RULE_IDS.length
    return result(WORLD_RULE_IDS[idx], REASON_CODE.FALLBACK_DATE, SOURCE_SIGNAL.DATE)
  }

  // §9 stable deterministic ordering: score desc, then wrId asc.
  let candidates = Object.keys(sc.scores)
    .filter((wr) => !available || available[wr] !== false)
    .map((wr) => ({ wrId: wr, score: sc.scores[wr].score }))
    .sort((a, b) => (b.score - a.score) || (a.wrId < b.wrId ? -1 : a.wrId > b.wrId ? 1 : 0))

  if (!candidates.length) {
    const idx = day % WORLD_RULE_IDS.length
    return result(WORLD_RULE_IDS[idx], REASON_CODE.FALLBACK_DATE, SOURCE_SIGNAL.DATE)
  }

  // §8 prefer UNSEEN. Selection is the highest-scored unseen candidate; the
  // reasonCode/sourceSignal from its own profile signal is preserved. When the
  // best-scored candidate is seen but another relevant candidate is unseen, the
  // unseen one wins (this is the intended preference — not an override note).
  const unseen = candidates.filter((c) => !seen.has(c.wrId))
  const pool = unseen.length ? unseen : candidates
  const chosen = pool[0]
  const meta = sc.scores[chosen.wrId]
  const reasonCode = unseen.length ? meta.reasonCode : REASON_CODE.SEEN_EXHAUSTED_REUSE
  return result(chosen.wrId, reasonCode, meta.sourceSignal)
}

module.exports = {
  recommendWorldRule,
  scoreCandidates,
  betterThan
}
