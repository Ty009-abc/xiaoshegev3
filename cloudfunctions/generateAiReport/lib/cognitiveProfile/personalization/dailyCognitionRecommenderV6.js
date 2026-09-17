'use strict'
/**
 * lib/cognitiveProfile/personalization/dailyCognitionRecommenderV6.js
 *
 * RC8.4 V6 R78 §11–§14 — DETERMINISTIC DAILY COGNITION RANKER.
 *
 * Applies the SAME profile-driven principle to the EXISTING daily-insight
 * library (`daily_insights`) and the EXISTING cognition-strike pool
 * (`cognitionStrike`). It NEVER rewrites content — it only RANKS existing items.
 *
 * §11 rank by: topic/tag match, lens relevance, blind-spot relevance,
 *              difficulty fit, unseen preference.
 * §12 priority: profile-relevant unseen > profile-relevant seen > date-based.
 * §13 returns internal metadata {personalized, reasonCode, sourceSignal, contentId}.
 * §14 when genuinely profile-driven, a UI label MAY be shown.
 *
 * PURE. No I/O. No AI. No randomness. Deterministic tie-breaking by library order.
 */

const {
  REASON_CODE, SOURCE_SIGNAL, SCORE,
  LENS_KEYWORDS, TOPIC_KEYWORDS, LENS_DIMENSION, TOPIC_DIMENSION
} = require('./personalizationMapsV6.js')

const PERSONALIZATION_LABEL = '根据你最近的认知诊断推荐'

function asArray (v) { return Array.isArray(v) ? v.filter(Boolean) : [] }
function assertValue (node) { return node && typeof node === 'object' && 'value' in node ? node.value : node }
function assertExpr (node) { return node && typeof node === 'object' && 'expression' in node ? node.expression : (typeof node === 'string' ? node : null) }

/** Gather profile signals once. */
function signals (profile) {
  const P = profile || {}
  const focus = P.currentFocus || null
  return {
    present: !!P.present,
    lensIds: focus ? asArray(focus.worldRuleLensIds) : [],
    topicIds: focus ? asArray(focus.priorityTopicIds) : [],
    blindSpot: (P.cognitiveState ? assertExpr(P.cognitiveState.primaryBlindSpot) : null) || '',
    seenInsightIds: new Set(asArray(P.learningHistory && P.learningHistory.seenInsightIds)),
    seenStrikeIds: new Set(asArray(P.learningHistory && P.learningHistory.seenStrikeIds)),
    stage: (P.diagnosticState ? assertValue(P.diagnosticState.executionStage) : null) || null
  }
}

/**
 * Score ONE insight item against the profile signals.
 * @returns {{score:number, reasonCode:string|null, sourceSignal:string|null}}
 */
function scoreInsightItem (item, sig) {
  const tags = asArray(item && item.tags)
  let score = 0
  let reasonCode = null
  let sourceSignal = null
  const set = (s, rc, ss) => { if (s > score) { score = s; reasonCode = rc; sourceSignal = ss } }

  // lens relevance (strongest)
  for (const lensId of sig.lensIds) {
    const kws = LENS_KEYWORDS[lensId] || []
    if (kws.some((k) => tags.indexOf(k) !== -1)) set(SCORE.LENS_PARTIAL, REASON_CODE.LENS_PARTIAL, SOURCE_SIGNAL.LENS)
  }
  // topic/tag match
  for (const t of sig.topicIds) {
    const kws = TOPIC_KEYWORDS[t] || []
    if (kws.some((k) => tags.indexOf(k) !== -1)) set(SCORE.TOPIC_DIRECT, REASON_CODE.TOPIC_MATCH, SOURCE_SIGNAL.TOPIC)
  }
  // blind-spot relevance (keyword appears in a tag)
  if (sig.blindSpot) {
    for (const row of LENS_KEYWORDS.__blindspotRows || []) { /* reserved */ }
    // lightweight: if a blind-spot keyword is directly a tag
    if (tags.some((k) => sig.blindSpot.indexOf(k) !== -1)) set(SCORE.BLINDSPOT_DIRECT, REASON_CODE.BLINDSPOT_MATCH, SOURCE_SIGNAL.BLINDSPOT)
  }
  // difficulty fit (meaningful, small tiebreak): early stage prefers difficulty 1.
  if (score > 0 && (sig.stage === 'THINKING' || sig.stage === 'STARTED') && item.difficulty === 1) {
    score += 2
  }
  return { score: score, reasonCode: reasonCode, sourceSignal: sourceSignal }
}

/**
 * §11/§12 rank daily insights.
 * @param {Object} profile canonical normalized profile
 * @param {Array} items [{ id, tags, difficulty }] in library order
 * @param {number} dayIndex
 * @returns {{contentId, reasonCode, sourceSignal, personalized}}
 */
function recommendDailyInsight (profile, items, dayIndex) {
  const sig = signals(profile)
  const list = asArray(items)
  if (!list.length) return { contentId: null, reasonCode: REASON_CODE.FALLBACK_DATE, sourceSignal: SOURCE_SIGNAL.DATE, personalized: false }
  const day = (typeof dayIndex === 'number' && isFinite(dayIndex)) ? Math.abs(Math.floor(dayIndex)) : 0

  // §10 nothing to personalize → preserve existing date-based behavior.
  if (!sig.present) {
    return { contentId: list[day % list.length].id, reasonCode: REASON_CODE.FALLBACK_DATE, sourceSignal: SOURCE_SIGNAL.DATE, personalized: false }
  }

  const scored = list.map((it, i) => {
    const s = scoreInsightItem(it, sig)
    return { id: it.id, idx: i, score: s.score, reasonCode: s.reasonCode, sourceSignal: s.sourceSignal }
  })
  const relevant = scored.filter((s) => s.score > 0)
  if (!relevant.length) {
    return { contentId: list[day % list.length].id, reasonCode: REASON_CODE.FALLBACK_DATE, sourceSignal: SOURCE_SIGNAL.DATE, personalized: false }
  }
  // §9 deterministic order: score desc, then library order (idx asc).
  relevant.sort((a, b) => (b.score - a.score) || (a.idx - b.idx))
  // §12 unseen preference.
  const unseen = relevant.filter((s) => !sig.seenInsightIds.has(s.id))
  const pool = unseen.length ? unseen : relevant
  const chosen = pool[0]
  const reasonCode = unseen.length ? chosen.reasonCode : REASON_CODE.SEEN_EXHAUSTED_REUSE
  return { contentId: chosen.id, reasonCode: reasonCode, sourceSignal: chosen.sourceSignal, personalized: true }
}

/**
 * §11/§12 rank cognition-strike pool items by EXISTING dimension.
 * @param {Array} items [{ id, dimensions }] in pool order
 */
function recommendStrikeItem (profile, items, dayIndex) {
  const sig = signals(profile)
  const list = asArray(items)
  if (!list.length) return { contentId: null, reasonCode: REASON_CODE.FALLBACK_DATE, sourceSignal: SOURCE_SIGNAL.DATE, personalized: false }
  const day = (typeof dayIndex === 'number' && isFinite(dayIndex)) ? Math.abs(Math.floor(dayIndex)) : 0

  if (!sig.present) {
    return { contentId: list[day % list.length].id, reasonCode: REASON_CODE.FALLBACK_DATE, sourceSignal: SOURCE_SIGNAL.DATE, personalized: false }
  }

  const wantDims = new Set()
  for (const lensId of sig.lensIds) { const d = LENS_DIMENSION[lensId]; if (d) wantDims.add(d) }
  for (const t of sig.topicIds) { const d = TOPIC_DIMENSION[t]; if (d) wantDims.add(d) }

  const scored = list.map((it, i) => {
    const dims = asArray(it.dimensions)
    const hit = dims.some((d) => wantDims.has(d))
    const lensHit = sig.lensIds.some((lensId) => dims.indexOf(LENS_DIMENSION[lensId]) !== -1)
    const score = hit ? (lensHit ? SCORE.LENS_PARTIAL : SCORE.TOPIC_DIRECT) : 0
    return { id: it.id, idx: i, score: score, lensHit: lensHit }
  })
  const relevant = scored.filter((s) => s.score > 0)
  if (!relevant.length) {
    return { contentId: list[day % list.length].id, reasonCode: REASON_CODE.FALLBACK_DATE, sourceSignal: SOURCE_SIGNAL.DATE, personalized: false }
  }
  relevant.sort((a, b) => (b.score - a.score) || (a.idx - b.idx))
  const unseen = relevant.filter((s) => !sig.seenStrikeIds.has(s.id))
  const pool = unseen.length ? unseen : relevant
  const chosen = pool[0]
  const reasonCode = unseen.length
    ? (chosen.lensHit ? REASON_CODE.LENS_PARTIAL : REASON_CODE.TOPIC_MATCH)
    : REASON_CODE.SEEN_EXHAUSTED_REUSE
  return { contentId: chosen.id, reasonCode: reasonCode, sourceSignal: chosen.lensHit ? SOURCE_SIGNAL.LENS : SOURCE_SIGNAL.TOPIC, personalized: true }
}

/**
 * §14 Build the user-visible label — ONLY when genuinely profile-driven.
 * @returns {string|null}
 */
function personalizationLabel (rec) {
  return (rec && rec.personalized) ? PERSONALIZATION_LABEL : null
}

module.exports = {
  recommendDailyInsight,
  recommendStrikeItem,
  personalizationLabel,
  scoreInsightItem,
  signals,
  PERSONALIZATION_LABEL
}
