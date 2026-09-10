/**
 * presentation/worldModel/v2_1/report/impactThesisV21.js
 *
 * RC8.3 Stage1C-F2-M5 — IMPACT THESIS (V5 "翻身策略报告" generation authority).
 *
 * ROLE IN THE FROZEN ARCHITECTURE (V5):
 *   ENGINE TRUTH → PRESENTATION TRUTH → **IMPACT THESIS** → 5-CARD IMPACT SUMMARY → SECONDARY EXPLAINABILITY
 *
 * The impact thesis is the single synthesis layer that turns the ACCEPTED
 * presentation truth into the raw material of the five impact cards. The report
 * layer (impactSummaryV21) renders it; the UI (northStarReportViewModel) only
 * lays it out. This keeps report/UI free of new SEMANTIC authority — the only
 * authority here is the frozen presentation model already accepted upstream
 * (Stage1C-B), plus the deterministic Chinese copy table (Stage1C-C).
 *
 * UNIQUE: the thesis is the user's own recurring decision loop + the model
 * shift, derived ONLY from primaryDiagnosis / userCurrentModel /
 * worldOperatingRule / modelMisalignment / upgradedModel / decisionProtocol.
 *
 * MULTIPLE (N>=2): the thesis is a UNIFIED narrative synthesised from the
 * accepted eligible candidates. It NEVER ranks, NEVER picks a winner, NEVER
 * fabricates a primary, and NEVER emits engine-meta prose. Every clause is
 * source-backed (sourceCandidateIds present) — UNSOURCED_SYNTHESIS_CLAUSE_COUNT=0.
 *
 * AUTHORITY (frozen): presentation-only. No engine call, no re-derivation of
 * diagnosis, no invented world rule / strategy / scenario / outcome.
 *
 * @version impact_thesis_v1
 */

'use strict'

const {
  getBlindSpotVerdict,
  getBlindSpotCurrentModel,
  getBlindSpotLabel,
  getMisalignment,
  getSystemLoop,
  getStrategyMechanism,
  getMultipleStateCopy,
  getMultipleImpactCopy,
  getMultipleObservation,
  getMultipleActionCopy,
  getMultipleSystemLoopCopy,
  getMultipleUnifiedCopy,
  getMultipleFamilyCopy,
  getMultipleBreadthCopy,
  getMultipleLoopTemplate,
  composeMultipleSystemTrap,
  getUniqueUpgradeFrom,
  getStrategyExperiments,
  getFamilyLabel,
} = require('./northStarReportCopyV21')

const THESIS_VERSION = 'impact_thesis_v1'

// ── Layer-1 budgets (Chinese chars). Single source of truth for the summary. ─
// NOTE (M2): UNIQUE Card 03 keeps the frozen 160 cap. MULTIPLE Card 03 gets a
// constrained relaxation so the loop can be causally specific to the eligible
// set (target ≤180; 220 is an emergency ceiling, not a writing target).
const BUDGET = Object.freeze({
  FATAL_INSIGHT: 60,
  CORE_PROBLEM: 120,
  SYSTEM_TRAP: 160,
  MULTIPLE_SYSTEM_TRAP_TARGET: 180,
  MULTIPLE_SYSTEM_TRAP_MAX: 220,
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

// Count-neutral label compound: "A、B、C" (+ "等" when truncated). Deterministic.
function labelCompound(ids, max) {
  const labels = (Array.isArray(ids) ? ids : []).map((id) => getBlindSpotLabel(id) || '').filter(Boolean)
  const shown = labels.slice(0, max)
  const suffix = labels.length > shown.length ? '等' : ''
  return shown.join('、') + suffix
}

/**
 * Build the UNIQUE impact thesis (source-backed by the frozen presentation).
 */
function buildUniqueThesis(pm) {
  const primary = pm.primaryDiagnosis
  const bs = primary.blindSpotId
  const principleId = pm.worldOperatingRule ? pm.worldOperatingRule.principleId : null
  const strategyId = pm.upgradedModel ? pm.upgradedModel.strategyId : null

  // 01 FATAL_INSIGHT — the accepted person-specific verdict (already the
  // «你不是 X，而是 Y» causal sentence the F2-M2 audit introduced).
  // 02 CORE_PROBLEM — accepted surface-belief statement.
  // 03 SYSTEM_TRAP — the repeated decision loop for THIS principle.
  // 04 UPGRADE_PATH — accepted model shift (FROM → TO), never abstract advice.
  // 05 ACTION_PLAN — the authoritative strategy's frozen experiment templates
  //    (first = the minimal 24–48h first action).
  const fatalInsight = clampChars(getBlindSpotVerdict(bs) || '', BUDGET.FATAL_INSIGHT)
  const coreProblem = clampChars(getBlindSpotCurrentModel(bs) || '', BUDGET.CORE_PROBLEM)
  const systemLoopFull = principleId ? (getSystemLoop(principleId) || '') : ''
  const systemTrap = clampChars(systemLoopFull || (principleId ? (getMisalignment(principleId) || '') : ''), BUDGET.SYSTEM_TRAP)
  const upgradePath = clampChars(pm.upgradedModel ? (pm.upgradedModel.cognitiveUpgrade || '') : '', BUDGET.UPGRADE_PATH)
  const upgradeMechanism = strategyId ? (getStrategyMechanism(strategyId) || '') : ''

  const steps = strategyId ? getStrategyExperiments(strategyId) : []
  const actionPlan = (Array.isArray(steps) ? steps : [])
    .map((s) => (s && s.name ? s.name : ''))
    .filter(Boolean)
    .slice(0, BUDGET.ACTION_PLAN_MAX)

  const rows = pm.evidenceExplanation && Array.isArray(pm.evidenceExplanation.rows)
    ? pm.evidenceExplanation.rows
    : []
  const evidencePreview = previewFromRows(rows, BUDGET.EVIDENCE_PREVIEW_MAX)

  const loopStepCount = systemLoopFull ? systemLoopFull.split(' → ').length : 1
  const uniqueUpgradeFrom = getUniqueUpgradeFrom(bs) || '按你现在的默认方式做决定'

  return {
    version: THESIS_VERSION,
    state: 'UNIQUE',
    count: null,
    sharedBehaviorPattern: coreProblem || '',
    sharedDecisionConsequence: systemTrap || '',
    systemLoop: systemLoopFull || '',
    systemLoopStepCount: loopStepCount,
    upgradeRule: upgradePath || '',
    upgradeFrom: uniqueUpgradeFrom,
    upgradeTo: upgradeMechanism || upgradePath || '',
    firstActionPrinciple: actionPlan.length ? actionPlan[0] : '',
    sourceCandidateIds: [bs],
    card: {
      fatalInsight: { text: fatalInsight, sourceCandidateIds: [bs] },
      coreProblem: { text: coreProblem, sourceCandidateIds: [bs] },
      systemTrap: { text: systemTrap, sourceCandidateIds: principleId ? [bs] : [] },
      upgradePath: { text: upgradePath, sourceCandidateIds: strategyId ? [bs] : [] },
      actionPlan: { items: actionPlan, sourceCandidateIds: actionPlan.length ? [bs] : [] },
    },
    evidencePreview,
    sourceRefs: [
      'presentation.primaryDiagnosis',
      'presentation.userCurrentModel',
      'presentation.worldOperatingRule',
      'presentation.modelMisalignment',
      'presentation.upgradedModel',
      'presentation.decisionProtocol',
      'presentation.evidenceExplanation',
    ],
    provenance: {
      clauses: {
        fatalInsight: [bs],
        coreProblem: [bs],
        systemTrap: principleId ? [bs] : [],
        upgradePath: strategyId ? [bs] : [],
        actionPlan: actionPlan.length ? [bs] : [],
        systemLoop: principleId ? [bs] : [],
      },
      deterministic: true,
    },
  }
}

/**
 * Build the MULTIPLE impact thesis (N >= 2). Unified narrative; no winner.
 */
function buildMultipleThesis(pm) {
  const ds = pm.diagnosisState || {}
  const eligible = Array.isArray(ds.eligibleCandidateIds) ? ds.eligibleCandidateIds.slice() : []
  if (eligible.length < 2) return null

  const syn = pm.multipleSynthesis || null
  const allSameFamily = syn ? syn.allSameFamily === true : false
  const familyIds = syn && Array.isArray(syn.familyGroups)
    ? syn.familyGroups.map((g) => g.familyId).filter(Boolean)
    : []
  const primaryFamily = familyIds.length === 1 && !allSameFamily ? familyIds[0] : null

  const obs = getMultipleObservation
  const ic = getMultipleImpactCopy()
  const uni = getMultipleUnifiedCopy()
  const loop = getMultipleSystemLoopCopy()

  // BREADTH DIMENSION — derived DETERMINISTICALLY from the accepted synthesis
  // (family span + candidate density). Never from a label, never a hardcoded
  // numeral. This is what makes the impact thesis respond to the ACTUAL
  // eligible set instead of collapsing to one template.
  //   FOCUSED   = 1 family (candidates may repeat one domain)
  //   NARROW    = 2 families
  //   SPREAD    = 3 families
  //   WIDE      = >=4 families, candidates ≈ families
  //   PERVASIVE = >=4 families, materially more candidates than families
  const familySpan = syn && typeof syn.familyCount === 'number' ? syn.familyCount : familyIds.length
  let breadthLevel
  if (allSameFamily || familySpan <= 1) breadthLevel = 'FOCUSED'
  else if (familySpan === 2) breadthLevel = 'NARROW'
  else if (familySpan === 3) breadthLevel = 'SPREAD'
  else breadthLevel = eligible.length > familySpan + 1 ? 'PERVASIVE' : 'WIDE'

  // FAMILY THESIS: when ALL eligible candidates share ONE family and a family
  // thesis exists, respond to the actual set's shared story (Cards 01–04).
  // BREADTH THESIS: for cross-family sets, respond to how widely the habit
  // repeats across domains. Both are count-neutral, non-ranked, non-primary,
  // taxonomy-free. FOCUSED keeps the frozen focused semantics (no label).
  const famCopy = allSameFamily && familyIds.length === 1 ? getMultipleFamilyCopy(familyIds[0]) : null
  const breadthCopy = getMultipleBreadthCopy(breadthLevel)

  // 01 FATAL_INSIGHT — count-neutral user-centered unified judgement (never a
  //    primary, never a candidate-label list, never engine-meta copy).
  // 02 CORE_PROBLEM — surface-belief vs recurring-mechanism contrast.
  // 03 SYSTEM_TRAP — the recurring decision loop shared by the supported
  //    directions (count-neutral; never ranks).
  // 04 UPGRADE_PATH — the shared model-change direction (FROM → TO).
  // 05 ACTION_PLAN — a CONCRETE bounded first action (24–48h) + supporting steps.
  const fatalInsight = clampChars(
    famCopy ? famCopy.fatalInsight : (breadthCopy ? breadthCopy.fatalInsight : uni.fatalInsight),
    BUDGET.FATAL_INSIGHT,
  )
  const coreProblem = clampChars(
    famCopy ? famCopy.coreProblem : (breadthCopy ? breadthCopy.coreProblem : uni.coreProblem),
    BUDGET.CORE_PROBLEM,
  )
  // 03 SYSTEM_TRAP — the recurring decision loop, CAUSALLY COMPRESSED from the
  //    eligible candidates (one coherent loop; never per-candidate
  //    concatenation). Non-MULTIPLE states keep the frozen broad/focused loop.
  const trapFamilies = Array.isArray(syn && syn.familyGroups)
    ? syn.familyGroups.map((g) => ({ familyId: g.familyId, count: Array.isArray(g.candidateIds) ? g.candidateIds.length : 0 }))
    : []
  const compressedLoop = trapFamilies.length
    ? composeMultipleSystemTrap({ families: trapFamilies, sealingCandidateIds: eligible })
    : ''
  const systemLoopFull = compressedLoop || (allSameFamily ? loop.focused : loop.broad)
  const systemTrap = clampChars(systemLoopFull, BUDGET.MULTIPLE_SYSTEM_TRAP_MAX)
  const upgradeLead = famCopy ? '' : (breadthCopy ? '' : uni.upgradeLead)
  const toShort = famCopy ? famCopy.upgradeTo : (breadthCopy ? breadthCopy.upgradeTo : (loop.toShort || ''))
  const fromShort = famCopy ? famCopy.upgradeFrom : (breadthCopy ? breadthCopy.upgradeFrom : (loop.fromShort || ''))
  // UPGRADE_PATH = structured modelDirection (localized) — no invented strategy.
  const upgradePath = clampChars(upgradeLead + toShort + '。', BUDGET.UPGRADE_PATH)

  // FIRST_ACTION: one concrete, bounded action doable within 24–48h, then the
  // count-neutral shared decision-protocol steps as supporting actions.
  const firstAction = uni.firstAction
  const sharedActions = (getMultipleActionCopy().base || []).slice()
  const merged = [firstAction].concat(sharedActions)
  const actionPlan = merged.slice(0, BUDGET.ACTION_PLAN_MAX)

  const flatRows = []
  for (const m of (Array.isArray(pm.multiModelEvidence) ? pm.multiModelEvidence : [])) {
    for (const r of (Array.isArray(m.rows) ? m.rows : [])) flatRows.push(r)
  }
  const evidencePreview = previewFromRows(flatRows, BUDGET.EVIDENCE_PREVIEW_MAX)

  // Every clause is source-backed by the accepted eligible candidates.
  const planSource = eligible.slice()
  const sourceRefBase = [
    'presentation.multipleSynthesis',
    'presentation.diagnosisState.eligibleCandidateIds',
    'presentation.multiModelEvidence',
  ]

  return {
    version: THESIS_VERSION,
    state: 'MULTIPLE',
    count: eligible.length,
    sharedBehaviorPattern: coreProblem || '',
    sharedDecisionConsequence: systemTrap || '',
    systemLoop: systemLoopFull || '',
    systemLoopStepCount: systemLoopFull ? systemLoopFull.split(' → ').length : 1,
    upgradeRule: upgradePath || '',
    upgradeFrom: fromShort,
    upgradeTo: toShort,
    firstActionPrinciple: firstAction,
    sourceCandidateIds: eligible.slice(),
    familyId: primaryFamily,
    familyLabel: primaryFamily ? (getFamilyLabel(primaryFamily) || null) : null,
    breadthLevel,
    card: {
      fatalInsight: { text: fatalInsight, sourceCandidateIds: eligible.slice() },
      coreProblem: { text: coreProblem, sourceCandidateIds: eligible.slice() },
      systemTrap: { text: systemTrap, sourceCandidateIds: eligible.slice() },
      upgradePath: { text: upgradePath, sourceCandidateIds: eligible.slice() },
      actionPlan: { items: actionPlan, sourceCandidateIds: planSource },
    },
    evidencePreview,
    sourceRefs: sourceRefBase,
    provenance: {
      clauses: {
        fatalInsight: eligible.slice(),
        coreProblem: eligible.slice(),
        systemTrap: eligible.slice(),
        upgradePath: eligible.slice(),
        actionPlan: planSource,
        systemLoop: eligible.slice(),
      },
      deterministic: true,
    },
  }
}

/**
 * Build the impact thesis for a presentation model.
 *
 * @param {object} pm  north_star_presentation_v1
 * @returns {object|null} thesis (UNIQUE / MULTIPLE only; null otherwise)
 */
function buildImpactThesisV21(pm) {
  if (!pm || !pm.diagnosisState) return null
  const ds = pm.diagnosisState
  const primary = pm.primaryDiagnosis

  if (primary && primary.blindSpotId) return buildUniqueThesis(pm)
  if (ds.reasonCode === 'MULTIPLE_SUPPORTED_MODELS') return buildMultipleThesis(pm)
  return null
}

module.exports = {
  THESIS_VERSION,
  BUDGET,
  clampChars,
  buildImpactThesisV21,
}
