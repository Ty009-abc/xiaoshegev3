'use strict'
/**
 * turnaroundStrategy/v6/report/reportBuilderV6.js
 *
 * Deterministic V6 five-card report builder.
 *
 * AUTHORITY: consumes diagnoseTurnaroundV6 output ONLY.
 * NEVER performs diagnosis: no eligibility, no selection, no belief inference,
 * no stage inference, no action-type override, no hidden scoring.
 *
 * State handling:
 *   PRIMARY       -> normal 5-card report
 *   NO_PRIMARY    -> R51 FIRST-CLASS evidence-grounded 5-card report (no
 *                    invented primary; no internal-state language)
 *   INVALID_INPUT -> no cards (cards = null)
 *   EVIDENCE_CONFLICT -> no cards (review metadata only)
 *
 * CONSUMER LAYER ONLY. Deterministic. No AI. No I/O. No network.
 */

const { buildFatalInsight } = require('./fatalInsightV6.js')
const { buildCoreProblem } = require('./coreProblemV6.js')
const { buildSystemLoop } = require('./systemLoopV6.js')
const { buildTurnaroundPath } = require('./turnaroundPathV6.js')
const { buildFirstAction } = require('./firstActionCopyV6.js')
const { buildNoPrimaryReportV6 } = require('./noPrimaryReportV6.js')
const copy = require('./reportCopyV6.js')

const REPORT_VERSION = 'turnaround_strategy_v6_report_v1'

/**
 * @param {Object} diagnosis diagnoseTurnaroundV6 output
 * @param {Object} [hybridContext] OPTIONAL additive report-specificity context
 *   (buildHybridReportContextV6). When omitted/undefined the report is
 *   byte-identical to the pre-R44 9Q output (R44 §27 zero-regression guarantee).
 * @returns {Object} report
 */
function buildReportV6 (diagnosis, hybridContext) {
  if (!diagnosis || typeof diagnosis !== 'object') {
    return invalidReport()
  }

  // ── R48 §4/§9 — cross-axis EVIDENCE CONFLICT is a REPORT BLOCKER ──
  // Defense-in-depth: even if a caller reaches this builder with a conflicting
  // diagnosis + context, NO five-card report may ever be produced from
  // contradictory user facts, and no copy layer may mask the conflict.
  if (diagnosis.compatibility && diagnosis.compatibility.verdict === 'EVIDENCE_CONFLICT') {
    return conflictReport(diagnosis)
  }

  switch (diagnosis.diagnosisState) {
    case 'INVALID_INPUT':
      return invalidReport(diagnosis)
    case 'NO_PRIMARY':
      return noPrimaryReport(diagnosis, hybridContext)
    case 'PRIMARY':
      return primaryReport(diagnosis, hybridContext)
    default:
      return invalidReport(diagnosis)
  }
}

/** Attach the additive hybrid context for card builders (never mutates input). */
function withHybrid (r, hybridContext) {
  if (!hybridContext) return r
  return Object.assign({}, r, { hybrid: hybridContext })
}

// ── PRIMARY: full 5-card report ──────────────────────────────────
function primaryReport (rIn, hybridContext) {
  const r = withHybrid(rIn, hybridContext)
  const fatal = buildFatalInsight(r)
  const core = buildCoreProblem(r)
  const loop = buildSystemLoop(r)
  const path = buildTurnaroundPath(r)
  const action = buildFirstAction(r)

  const cards = {
    fatalInsight: { title: '致命一句话', text: fatal.text, provenance: fatal.provenance },
    coreProblem: { title: '核心问题', text: core.text, provenance: core.provenance },
    systemLoop: { title: '系统困局', steps: loop.steps, insight: loop.insight, family: loop.family, shape: loop.shape, header: loop.header, form: loop.form, text: loop.text, provenance: loop.provenance },
    turnaroundPath: { title: '翻身路径', from: path.from, to: path.to, logic: path.logic, display: path.display, worldRuleLine: path.worldRuleLine, specificity: path.specificity || '', text: path.text, provenance: path.provenance },
    firstAction: { title: '现在就做', action: action.action, hypothesis: action.hypothesis, target: action.target, checks: action.checks, timebox: action.timebox, verifyWith: action.verifyWith, done: action.done, decision: action.decision, specificity: action.specificity || '', externalSignal: action.externalSignal, eventPrimary: action.eventPrimary, text: action.text, provenance: action.provenance }
  }

  return {
    reportVersion: REPORT_VERSION,
    reportState: 'PRIMARY',
    cards,
    provenance: {
      contractVersion: r.contractVersion,
      diagnosisState: r.diagnosisState,
      primaryBottleneck: r.primaryBottleneck,
      executionStage: r.executionStage,
      beliefRelation: r.beliefRelation.relation,
      realityConstraintTypes: r.realityConstraint.types,
      selectedRuleId: r.trace.selectedRuleId,
      beliefRuleId: r.beliefRelation.explanationRuleId,
      sourceQuestionIds: r.trace.sourceQuestionIds
    }
  }
}

// ── NO_PRIMARY: R51 FIRST-CLASS evidence-grounded report ─────────
// NO_PRIMARY is a first-class product state (structurally common, R50 52.83%).
// It means B1 could not truthfully establish ONE sufficiently supported primary
// bottleneck — NOT that no useful evidence exists. This builds a COMPLETE five-
// card report from the user's own evidence, with ZERO primary-bottleneck claim
// and ZERO internal engine language. The B2 world-rule layer is not used here
// (it is bottleneck-keyed). Deterministic. No AI.
function noPrimaryReport (rIn, hybridContext) {
  const r = withHybrid(rIn, hybridContext)
  const built = buildNoPrimaryReportV6(r, hybridContext || null)

  return {
    reportVersion: REPORT_VERSION,
    reportState: 'NO_PRIMARY',
    cards: built.cards,
    evidenceClusters: built.evidenceClusters,
    nextUncertainty: built.nextUncertainty,
    proofStage: built.proofStage,
    proofStageProgression: built.proofStageProgression,
    provenance: {
      contractVersion: r.contractVersion,
      diagnosisState: r.diagnosisState,
      primaryBottleneck: null,
      executionStage: r.executionStage,
      beliefRelation: r.beliefRelation.relation,
      realityConstraintTypes: r.realityConstraint.types,
      selectedRuleId: null,
      beliefRuleId: r.beliefRelation.explanationRuleId,
      sourceQuestionIds: r.trace ? r.trace.sourceQuestionIds : []
    }
  }
}

// ── INVALID_INPUT: no cards ──────────────────────────────────────
function invalidReport (r) {
  return {
    reportVersion: REPORT_VERSION,
    reportState: 'INVALID_INPUT',
    cards: null,
    provenance: {
      contractVersion: r ? r.contractVersion : null,
      diagnosisState: 'INVALID_INPUT',
      inputErrors: r ? r.inputErrors : null
    }
  }
}

// ── EVIDENCE_CONFLICT (R48): NO cards, review metadata only ──────
function conflictReport (r) {
  return {
    reportVersion: REPORT_VERSION,
    reportState: 'EVIDENCE_CONFLICT',
    cards: null,
    conflict: {
      conflictType: (r.compatibility && r.compatibility.conflictType) || null,
      conflictingFields: (r.compatibility && r.compatibility.conflictingFields) || [],
      recommendedReviewScreens: (r.compatibility && r.compatibility.recommendedReviewScreens) || []
    },
    provenance: {
      contractVersion: r.contractVersion,
      diagnosisState: r.diagnosisState,
      primaryBottleneck: r.primaryBottleneck || null,
      compatibility: r.compatibility || null
    }
  }
}

module.exports = { buildReportV6, REPORT_VERSION }
