/**
 * presentation/worldModel/v2_1/report/impactSummaryV21.js
 *
 * RC8.3 Stage1C-F2-M2 — Layer-1 Impact Summary (report product structure).
 *
 * Builds the high-impact 5-section summary that lets the user understand the
 * main conclusion BEFORE the first long scroll:
 *   01 FATAL_INSIGHT   一句话总判断
 *   02 CORE_PROBLEM    核心问题
 *   03 SYSTEM_TRAP     系统困局
 *   04 UPGRADE_PATH    模型升级
 *   05 ACTION_PLAN     行动建议
 *   + evidencePreview  2-4 strongest source-backed evidence bullets
 *
 * AUTHORITY (frozen): this is REPORT EXPRESSION of accepted truth. It derives
 * ONLY from the presentation model (primaryDiagnosis / userCurrentModel /
 * worldOperatingRule / modelMisalignment / upgradedModel / decisionProtocol /
 * scenario semantics) or, for MULTIPLE, from the presentation-layer
 * multipleSynthesis + accepted eligible candidates. It NEVER re-derives
 * diagnosis, NEVER invents a world rule/strategy/scenario/outcome, NEVER ranks
 * or selects a winner. All Layer-1 copy is count-neutral (N >= 2) — no hardcoded
 * numeral.
 *
 * @version impact_summary_v1
 */

'use strict'

const {
  getBlindSpotVerdict,
  getBlindSpotCurrentModel,
  getBlindSpotLabel,
  getMisalignment,
  getStrategyExperiments,
  getMultipleStateCopy,
  getMultipleObservation,
  getMultipleImpactCopy,
  getMultipleActionCopy,
} = require('./northStarReportCopyV21')

const IMPACT_VERSION = 'impact_summary_v1'

// Layer-1 budgets (Chinese chars). Punctuation variance is tolerated: tests use
// meaningful upper bounds, not exact equality.
const BUDGET = Object.freeze({
  FATAL_INSIGHT: 60,
  CORE_PROBLEM: 120,
  SYSTEM_TRAP: 160,
  UPGRADE_PATH: 140,
  ACTION_PLAN_MIN: 3,
  ACTION_PLAN_MAX: 5,
  EVIDENCE_PREVIEW_MIN: 2,
  EVIDENCE_PREVIEW_MAX: 4,
})

function clampChars(s, max) {
  const str = typeof s === 'string' ? s : ''
  const chars = [...str]
  if (chars.length <= max) return str
  return chars.slice(0, max).join('')
}

// Deterministic stable-order evidence selection (no new scoring algorithm).
function previewFromRows(rows, max) {
  const out = []
  const seen = new Set()
  for (const r of (Array.isArray(rows) ? rows : [])) {
    if (!r || !r.questionId) continue
    if (seen.has(r.questionId)) continue
    seen.add(r.questionId)
    out.push({
      questionMeaning: r.prompt || '',
      selectedAnswerMeaning: r.answerText || '',
      whatSignalItShows: r.semanticProposition || '',
    })
    if (out.length >= max) break
  }
  return out
}

/**
 * Build the Layer-1 impact summary. Returns null unless the state carries
 * semantics that support a 5-section impact summary (UNIQUE / MULTIPLE).
 * Other states keep the existing truthful compact neutral layout (Stage1C-D2).
 *
 * @param {object} pm  north_star_presentation_v1
 * @returns {object|null}
 */
function buildImpactSummaryV21(pm) {
  if (!pm || !pm.diagnosisState) return null
  const ds = pm.diagnosisState
  const primary = pm.primaryDiagnosis

  // ── UNIQUE ────────────────────────────────────────────────────────────
  if (primary && primary.blindSpotId) {
    const bs = primary.blindSpotId
    const principleId = pm.worldOperatingRule ? pm.worldOperatingRule.principleId : null

    const fatalInsight = clampChars(getBlindSpotVerdict(bs) || '', BUDGET.FATAL_INSIGHT)
    const coreProblem = clampChars(getBlindSpotCurrentModel(bs) || '', BUDGET.CORE_PROBLEM)
    const systemTrap = clampChars(principleId ? (getMisalignment(principleId) || '') : '', BUDGET.SYSTEM_TRAP)
    const upgradePath = clampChars(pm.upgradedModel ? (pm.upgradedModel.cognitiveUpgrade || '') : '', BUDGET.UPGRADE_PATH)

    const steps = (pm.upgradedModel && pm.upgradedModel.strategyId)
      ? getStrategyExperiments(pm.upgradedModel.strategyId)
      : []
    const actionPlan = (Array.isArray(steps) ? steps : [])
      .map((s) => s && s.name ? s.name : '')
      .filter(Boolean)
      .slice(0, BUDGET.ACTION_PLAN_MAX)

    const rows = pm.evidenceExplanation && Array.isArray(pm.evidenceExplanation.rows)
      ? pm.evidenceExplanation.rows
      : []
    const evidencePreview = previewFromRows(rows, BUDGET.EVIDENCE_PREVIEW_MAX)

    return {
      version: IMPACT_VERSION,
      state: 'UNIQUE',
      fatalInsight,
      coreProblem,
      systemTrap,
      upgradePath,
      actionPlan,
      evidencePreview,
      sourceRefs: [
        'presentation.primaryDiagnosis',
        'presentation.userCurrentModel',
        'presentation.worldOperatingRule',
        'presentation.modelMisalignment',
        'presentation.upgradedModel',
        'strategyDefinitions.experimentTemplates',
        'presentation.evidenceExplanation',
      ],
      provenance: {
        clauses: {
          fatalInsight: [bs],
          coreProblem: [bs],
          systemTrap: principleId ? [bs] : [],
          upgradePath: pm.upgradedModel ? [bs] : [],
          actionPlan: steps.length ? [bs] : [],
        },
        deterministic: true,
      },
    }
  }

  // ── MULTIPLE ──────────────────────────────────────────────────────────
  if (ds.reasonCode === 'MULTIPLE_SUPPORTED_MODELS') {
    const syn = pm.multipleSynthesis || null
    const eligible = Array.isArray(ds.eligibleCandidateIds) ? ds.eligibleCandidateIds.slice() : []
    if (eligible.length < 2) return null

    const mcopy = getMultipleStateCopy()
    const ic = getMultipleImpactCopy()

    // 01 — one-sentence judgement (count-neutral STATE copy; never a primary).
    const fatalInsight = clampChars(mcopy.headline || '', BUDGET.FATAL_INSIGHT)

    // 02 — simultaneously-supported patterns (labels only; count-derived list).
    const labels = eligible.map((id) => getBlindSpotLabel(id) || '').filter(Boolean)
    const shown = labels.slice(0, 8)
    const suffix = labels.length > shown.length ? '等' : ''
    const coreProblem = clampChars(ic.coverageLead + shown.join('、') + suffix + '。', BUDGET.CORE_PROBLEM)

    // 03 — shared decision trap (family-derived tension; no invented outcome).
    const sameFamily = syn ? syn.allSameFamily === true : false
    const tension = sameFamily ? ic.tensionFocused : ic.tensionBroad
    const systemTrap = clampChars(tension + ic.noPrimaryNote, BUDGET.SYSTEM_TRAP)

    // 04 — model-change direction (structured habit, never an invented strategy).
    const upgradePath = clampChars(ic.upgradeLead + '建立一套跨场景通用的决策习惯。', BUDGET.UPGRADE_PATH)

    // 05 — actions: source-backed per-candidate observations first, then the
    // count-neutral shared decision-protocol steps, so the plan always lands in
    // the 3-5 bullet budget for ANY N (per-candidate observations cover only a
    // subset of candidates). Deterministic order; no ranking.
    const observations = eligible
      .map((id) => getMultipleObservation(id))
      .filter((s) => typeof s === 'string' && s.length > 0)
    const sharedActions = (getMultipleActionCopy().base || []).slice()
    const merged = observations.concat(sharedActions)
    // sharedActions always yields >= 3, so the plan lands in [3,5] for any N.
    const actionPlan = (merged.length > 0 ? merged : [ic.actionFallback]).slice(0, BUDGET.ACTION_PLAN_MAX)

    // Evidence preview: flatten multiModelEvidence (candidate order, row order).
    const flatRows = []
    for (const m of (Array.isArray(pm.multiModelEvidence) ? pm.multiModelEvidence : [])) {
      for (const r of (Array.isArray(m.rows) ? m.rows : [])) flatRows.push(r)
    }
    const evidencePreview = previewFromRows(flatRows, BUDGET.EVIDENCE_PREVIEW_MAX)

    return {
      version: IMPACT_VERSION,
      state: 'MULTIPLE',
      fatalInsight,
      coreProblem,
      systemTrap,
      upgradePath,
      actionPlan,
      evidencePreview,
      sourceRefs: [
        'presentation.multipleSynthesis',
        'presentation.diagnosisState.eligibleCandidateIds',
        'presentation.multiModelEvidence',
      ],
      provenance: {
        clauses: {
          fatalInsight: eligible,
          coreProblem: eligible,
          systemTrap: syn && syn.tension ? syn.tension.source.candidateIds.slice() : eligible,
          upgradePath: syn && syn.modelDirection ? syn.modelDirection.coveredCandidateIds.slice() : eligible,
          actionPlan: eligible,
        },
        deterministic: true,
      },
    }
  }

  // NO_PRIMARY / INSUFFICIENT / CONTRADICTORY / BLOCKED → no forced diagnosis IA.
  return null
}

// Layer-1 section titles (UI chrome; presentation-neutral, not diagnosis copy).
const IMPACT_SECTION_TITLES = Object.freeze({
  FATAL_INSIGHT: '致命一句话',
  CORE_PROBLEM: '核心问题',
  SYSTEM_TRAP: '系统困局',
  UPGRADE_PATH: '模型升级',
  ACTION_PLAN: '行动建议',
})

const LAYER2_TITLE = '为什么系统这样判断我'

module.exports = {
  IMPACT_VERSION,
  BUDGET,
  IMPACT_SECTION_TITLES,
  LAYER2_TITLE,
  buildImpactSummaryV21,
}
