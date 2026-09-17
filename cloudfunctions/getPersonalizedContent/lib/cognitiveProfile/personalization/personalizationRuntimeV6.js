'use strict'
/**
 * lib/cognitiveProfile/personalization/personalizationRuntimeV6.js
 *
 * RC8.4 V6 R78 §2–§14 — PRODUCT RUNTIME for profile-driven content.
 *
 * §2 This runtime consumes the CANONICAL Cognitive Profile V1 (the output of
 *    cognitiveProfileReaderV6.getCognitiveProfile / normalizeCognitiveProfile).
 *    It NEVER re-reads ai_reports / user_memory / challenge data / raw
 *    questionnaire answers to reconstruct profile state.
 *
 * It composes the deterministic recommenders into a single feed:
 *   { worldRule, dailyInsight, strike, personalized }
 * plus, for each surface, the §13 internal metadata + §14 user-visible label.
 *
 * PURE except for the content rows the caller passes in. No AI. No randomness.
 * Deterministic given (profile, content, dayIndex).
 */

const { recommendWorldRule } = require('./worldRuleRecommenderV6.js')
const { recommendDailyInsight, recommendStrikeItem, personalizationLabel } = require('./dailyCognitionRecommenderV6.js')
const { REASON_CODE, SOURCE_SIGNAL } = require('./personalizationMapsV6.js')

function asArray (v) { return Array.isArray(v) ? v : [] }

// ── content normalization (DB row → recommender item shape) ──
function normalizeInsightRows (rows) {
  return asArray(rows).map((r) => ({
    id: r.insightId || r.id,
    tags: asArray(r.tags),
    difficulty: (typeof r.difficulty === 'number') ? r.difficulty : null,
    _raw: r
  })).filter((x) => !!x.id)
}
function normalizeStrikeRows (rows) {
  return asArray(rows).map((r, i) => ({
    id: r.id || ('STRIKE_' + String(i).padStart(3, '0')),
    dimensions: asArray(r.dimensions),
    _raw: r
  }))
}
function normalizeWorldRuleRows (rows) {
  const ids = {}
  for (const r of asArray(rows)) { const id = r.ruleId || r.id; if (id) ids[id] = r }
  return ids
}

/**
 * Build the personalization feed.
 * @param {Object} args
 *   profile      — canonical normalized profile (from the R77 reader)
 *   worldRules   — DB rows [{ ruleId, category, tags, ... }]
 *   insights     — DB rows [{ insightId, tags, difficulty, ... }]
 *   strikes      — pool rows [{ id, dimensions, ... }]
 *   dayIndex     — deterministic day index (floor(startOfDay/86400000))
 * @returns {Object} { worldRule, dailyInsight, strike, personalized }
 */
function buildPersonalizationFeed (args) {
  const a = args || {}
  const profile = a.profile || null
  const dayIndex = a.dayIndex

  const wrRows = normalizeWorldRuleRows(a.worldRules)
  const available = {}
  for (const id of Object.keys(wrRows)) available[id] = true

  const wrRec = recommendWorldRule(profile, dayIndex, { contentAvailable: available })
  const wrItem = (wrRec.wrId && wrRows[wrRec.wrId]) ? wrRows[wrRec.wrId] : null

  const insRows = normalizeInsightRows(a.insights)
  const insRec = recommendDailyInsight(profile, insRows, dayIndex)
  const insItem = insRec.contentId ? (insRows.find((x) => x.id === insRec.contentId) || null) : null

  const strikeRows = normalizeStrikeRows(a.strikes)
  const strikeRec = recommendStrikeItem(profile, strikeRows, dayIndex)
  const strikeItem = strikeRec.contentId ? (strikeRows.find((x) => x.id === strikeRec.contentId) || null) : null

  const personalized = !!(wrRec.personalized || insRec.personalized || strikeRec.personalized)

  return {
    personalized: personalized,
    // §14 feed-wide label — ONLY when the feed is genuinely profile-driven.
    label: personalized ? '根据你最近的认知诊断推荐' : null,
    worldRule: {
      item: wrItem ? wrItem._raw : null,
      wrId: wrRec.wrId,
      reasonCode: wrRec.reasonCode,
      sourceSignal: wrRec.sourceSignal,
      personalized: wrRec.personalized
    },
    dailyInsight: {
      item: insItem ? insItem._raw : null,
      contentId: insRec.contentId,
      reasonCode: insRec.reasonCode,
      sourceSignal: insRec.sourceSignal,
      personalized: insRec.personalized,
      label: personalizationLabel(insRec)
    },
    strike: {
      item: strikeItem ? strikeItem._raw : null,
      contentId: strikeRec.contentId,
      reasonCode: strikeRec.reasonCode,
      sourceSignal: strikeRec.sourceSignal,
      personalized: strikeRec.personalized,
      label: personalizationLabel(strikeRec)
    }
  }
}

/**
 * §27 privacy-safe log object. NO openid, NO profile dump, NO thesis, NO raw
 * answers — only reason codes, content ids, and a coarse signal category.
 */
function toSafeLog (feed, surface) {
  const f = feed || {}
  const pick = (o) => o ? {
    contentId: o.wrId || o.contentId || null,
    reasonCode: o.reasonCode || null,
    sourceSignal: o.sourceSignal || null,
    personalized: !!o.personalized
  } : null
  if (surface === 'world_rule') return pick(f.worldRule)
  if (surface === 'daily_insight') return pick(f.dailyInsight)
  if (surface === 'strike') return pick(f.strike)
  return { personalized: !!f.personalized, worldRule: pick(f.worldRule), dailyInsight: pick(f.dailyInsight), strike: pick(f.strike) }
}

module.exports = {
  buildPersonalizationFeed,
  toSafeLog,
  normalizeInsightRows,
  normalizeStrikeRows,
  normalizeWorldRuleRows,
  REASON_CODE,
  SOURCE_SIGNAL
}
