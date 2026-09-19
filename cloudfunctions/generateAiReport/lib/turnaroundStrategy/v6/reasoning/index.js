'use strict'
/**
 * turnaroundStrategy/v6/reasoning/index.js
 *
 * R87B1 — REALITY REASONING CORE (Phase 1).
 *
 *   REALITY EVIDENCE → CONTRADICTION → DERIVED INSIGHT → CASE THESIS
 *
 * Core principle: USER REALITY = SUBJECT · WORLD MODEL = EXPLANATORY ENGINE.
 *
 * This package is CORE-ONLY. It is intentionally NOT wired into the production
 * five-card render path (that is R87B2). Lower layers (WorldModel / Mismatch /
 * RealEconomy / GameModel / PricingPower / B1) are consumed read-only.
 *
 * Deterministic. Pure. No AI. No I/O. No network.
 */

const RE = require('./realityEvidenceV1.js')
const CE = require('./contradictionEngineV1.js')
const DI = require('./derivedInsightV1.js')
const CT = require('./caseThesisV1.js')

const R87_REASONING_VERSION = 'r87b1_reality_reasoning_core_v1'

/**
 * Run the full R87B1 reasoning pipeline.
 * @param {Object} raw validated hybrid answers
 * @param {Object} [opts] { worldModel } — explanation only; never manufactures facts
 * @returns {Object} { evidence, contradictions, insights, caseThesis, ...gate counters }
 */
function runRealityReasoningV1 (raw, opts) {
  const o = opts || {}
  const wm = o.worldModel || null

  const evidence = RE.buildRealityEvidenceV1(raw)
  const contradictions = CE.computeContradictionEngineV1(evidence, wm)
  const insights = DI.computeDerivedInsightV1(evidence, contradictions, wm)
  const caseThesis = CT.buildCaseThesisV1(evidence, contradictions, insights, wm)
  const boundaryAudit = RE.auditFactBoundaries(evidence)

  return {
    version: R87_REASONING_VERSION,
    evidence: evidence,
    contradictions: contradictions,
    insights: insights,
    caseThesis: caseThesis,
    // gate counters (R87B1 FINAL)
    PRIMARY_CASE_CONTRADICTION: contradictions.PRIMARY_CASE_CONTRADICTION,
    SECONDARY_CASE_CONTRADICTION: contradictions.SECONDARY_CASE_CONTRADICTION,
    NEW_DERIVED_INSIGHT_COUNT: insights.NEW_DERIVED_INSIGHT_COUNT,
    PRIMARY_INSIGHT_SUPPORTING_FACT_COUNT: insights.PRIMARY_INSIGHT_SUPPORTING_FACT_COUNT,
    PRIMARY_INSIGHT_LOAD_BEARING_FACT_COUNT: insights.PRIMARY_INSIGHT_LOAD_BEARING_FACT_COUNT,
    PRIMARY_INSIGHT_COUNTERFACTUAL_DEPENDENCY: insights.PRIMARY_INSIGHT_COUNTERFACTUAL_DEPENDENCY,
    PRIMARY_INSIGHT_IS_QUESTIONNAIRE_RESTATEMENT: insights.PRIMARY_INSIGHT_IS_QUESTIONNAIRE_RESTATEMENT,
    PRIMARY_INSIGHT_IS_GENERIC_ADVICE: insights.PRIMARY_INSIGHT_IS_GENERIC_ADVICE,
    SWITCH_OUTCOME: caseThesis.SWITCH_OUTCOME,
    UNSUPPORTED_CORE_CLAIM_COUNT: caseThesis.UNSUPPORTED_CORE_CLAIM_COUNT,
    FABRICATED_FACT_COUNT: boundaryAudit.FABRICATED_FACT_COUNT,
    FABRICATED_PSYCHOLOGY_COUNT: boundaryAudit.FABRICATED_PSYCHOLOGY_COUNT,
    TEMPORAL_FACT_WITHOUT_SOURCE_COUNT: boundaryAudit.TEMPORAL_FACT_WITHOUT_SOURCE_COUNT,
    EMPLOYMENT_MECHANIC_OVERCLAIM_COUNT: boundaryAudit.EMPLOYMENT_MECHANIC_OVERCLAIM_COUNT
  }
}

module.exports = {
  R87_REASONING_VERSION,
  runRealityReasoningV1,
  realityEvidence: RE,
  contradictionEngine: CE,
  derivedInsight: DI,
  caseThesis: CT,
  // convenience re-exports
  buildRealityEvidenceV1: RE.buildRealityEvidenceV1,
  computeContradictionEngineV1: CE.computeContradictionEngineV1,
  computeDerivedInsightV1: DI.computeDerivedInsightV1,
  buildCaseThesisV1: CT.buildCaseThesisV1,
  SWITCH_OUTCOMES: CT.SWITCH_OUTCOMES,
  CLAIM_LEVEL: CT.CLAIM_LEVEL
}
