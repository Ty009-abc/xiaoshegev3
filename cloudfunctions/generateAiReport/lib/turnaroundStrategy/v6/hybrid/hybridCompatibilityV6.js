'use strict'
/**
 * turnaroundStrategy/v6/hybrid/hybridCompatibilityV6.js
 *
 * RC8.4 V6 R48 — DETERMINISTIC PRE-REPORT EVIDENCE COMPATIBILITY GATE.
 *
 * Root cause (R47): V6 B1 execution/stage evidence (Q7 `pastAttemptStage`) and
 * the Hybrid asset/proof evidence (Q5 `skillValidation`) are collected as two
 * INDEPENDENT answers and may describe DIFFERENT objects. The report must NEVER
 * reconcile contradictory user facts by copy.
 *
 * POSITION IN THE PIPELINE (frozen):
 *   HybridProfile -> V6 B1 diagnosis -> asset/proof normalization
 *     -> [THIS LAYER] -> five-card report generation
 *
 * AUTHORITY (R48 §2, frozen, non-negotiable):
 *   - ZERO authority to change the B1 diagnosis. It may ONLY:
 *       (a) allow the report,
 *       (b) limit cross-axis strategy use (scope = UNPROVEN),
 *       (c) stop report generation (verdict = EVIDENCE_CONFLICT).
 *   - It NEVER picks a winner between the two axes, NEVER repaints B1 wording,
 *     NEVER invents "old asset vs new offer", NEVER silently downgrades to
 *     another bottleneck.
 *   - It does NOT re-derive B1 semantics: it reads the FROZEN B1 stage anchor
 *     (`executionStage.currentStage`) and the FROZEN asset proof axis
 *     (`marketValidated`) that the normalization layer already computed.
 *
 * FROZEN SEMANTICS USED (see bottleneckEligibilityV6.js):
 *   VALIDATION_GAP  requires Q6 = STAGE_TESTING AND NOT EARLY/STABLE_TRACTION
 *                   -> the gate's OWN evidence asserts "no payment evidence".
 *   REPEATABILITY_GAP requires Q6 ∈ {EARLY_TRACTION, STABLE_TRACTION}
 *                   -> the gate's OWN evidence asserts "prior paid evidence".
 *
 * CONSUMER LAYER ONLY. Pure, deterministic, no AI, no I/O, no network.
 */

// Frozen B1 stage anchors, in optionId terms (from bottleneckEligibilityV6 Q6).
const STAGE_PAID_EVIDENCE_STAGES = ['EARLY_TRACTION', 'STABLE_TRACTION']
const STAGE_TESTING_ANCHOR = 'TESTING'

// Bottlenecks whose frozen eligibility asserts NO payment evidence.
const BOTTLENECKS_ASSERTING_NO_PAYMENT = ['VALIDATION_GAP']
// Bottlenecks whose frozen eligibility asserts PRIOR payment evidence.
const BOTTLENECKS_ASSERTING_PAID = ['REPEATABILITY_GAP']
// Bottlenecks that are pre-payment/execution-stage gaps (no market-fact claim).
const BOTTLENECKS_NEUTRAL_TO_MARKET = ['DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP']

// The two user-visible questionnaire fields involved in every current hard
// conflict, and the 1-based visible screens that own them (R43 contract:
// S5 = skillValidation (+ monetizableSkill); S7 = pastAttemptStage (+ selfBelief)).
const CONFLICT_FIELDS = ['skillValidation', 'pastAttemptStage']
const CONFLICT_SCREENS = [5, 7]

const VERDICT_COMPATIBLE = 'COMPATIBLE'
const VERDICT_CONDITIONAL = 'CONDITIONALLY_COMPATIBLE'
const VERDICT_CONFLICT = 'EVIDENCE_CONFLICT'

const SCOPE_COMPATIBLE = 'COMPATIBLE'
const SCOPE_UNPROVEN = 'UNPROVEN'
const SCOPE_CONFLICT = 'CONFLICT'

/**
 * The deterministic evidence-compatibility verdict for ONE diagnosis.
 *
 * @param {Object} p
 * @param {Object} p.diagnosis      V6 diagnosis (authority read-only)
 * @param {string} [p.executionStage] B1 stage anchor (optional; defaults to diagnosis)
 * @param {string} [p.assetState]   asset ladder state (optional)
 * @param {boolean} [p.marketValidated] asset axis paid flag (authority for proof)
 * @param {Object} [p.hybridProfile] HybridProfile (fallback source of stage/proof)
 * @returns {{
 *   verdict:string, crossAxisScope:string, conflictType:string|null,
 *   conflictingFields:string[], recommendedReviewScreens:number[],
 *   reasonCode:string|null
 * }}
 */
function evaluateHybridEvidenceCompatibility (p) {
  const params = p || {}
  const diagnosis = params.diagnosis || null

  // No diagnosis, or a diagnosis that does NOT assert a primary bottleneck,
  // makes no cross-axis market claim -> always COMPATIBLE (never block).
  const state = (diagnosis && diagnosis.diagnosisState) || null
  const bottleneck = (diagnosis && diagnosis.primaryBottleneck) || null
  if (state !== 'PRIMARY' || !bottleneck) {
    return compatible('NO_PRIMARY_CLAIM')
  }

  // ── Read the TWO frozen evidence facts (never re-derive) ──
  const stage = params.executionStage ||
    (diagnosis && diagnosis.executionStage) || null

  let marketValidated = params.marketValidated
  if (typeof marketValidated !== 'boolean') {
    // Fallback: derive from the hybrid profile's raw proof option, using the
    // frozen asset ladder threshold (>= PAID_ONCE).
    const proof = params.hybridProfile && params.hybridProfile.asset
      ? params.hybridProfile.asset.marketProof : null
    marketValidated = ['PROOF_PAID_ONCE', 'PROOF_OCCASIONAL', 'PROOF_STABLE'].indexOf(proof) !== -1
  }

  const stageIsPaidEvidence = STAGE_PAID_EVIDENCE_STAGES.indexOf(stage) !== -1

  // ── HARD CONFLICT: the two facts are mutually exclusive ──
  // (1) B1 asserts NO payment, asset axis asserts payment evidence exists.
  if (BOTTLENECKS_ASSERTING_NO_PAYMENT.indexOf(bottleneck) !== -1 && marketValidated) {
    return conflict('VALIDATION_GAP_VS_MARKET_VALIDATED')
  }
  // (2) B1 asserts PRIOR payment, asset axis asserts no payment evidence.
  if (BOTTLENECKS_ASSERTING_PAID.indexOf(bottleneck) !== -1 && !marketValidated) {
    return conflict('REPEATABILITY_GAP_VS_UNPROVEN_MARKET')
  }

  // ── CONDITIONALLY COMPATIBLE: no contradiction is asserted, but the current
  // questionnaire cannot PROVE the paid asset is the same object as the current
  // desired change. Strategy must therefore not be linked across axes. ──
  if (BOTTLENECKS_NEUTRAL_TO_MARKET.indexOf(bottleneck) !== -1 && marketValidated) {
    return {
      verdict: VERDICT_CONDITIONAL,
      crossAxisScope: SCOPE_UNPROVEN,
      conflictType: null,
      conflictingFields: [],
      recommendedReviewScreens: [],
      reasonCode: 'PAID_ASSET_UNPROVEN_SCOPE'
    }
  }

  // ── COMPATIBLE: same-direction evidence (or a pre-payment stage + no proof). ──
  return compatible(null)
}

function compatible (reasonCode) {
  return {
    verdict: VERDICT_COMPATIBLE,
    crossAxisScope: SCOPE_COMPATIBLE,
    conflictType: null,
    conflictingFields: [],
    recommendedReviewScreens: [],
    reasonCode: reasonCode || null
  }
}

function conflict (reasonCode) {
  return {
    verdict: VERDICT_CONFLICT,
    crossAxisScope: SCOPE_CONFLICT,
    conflictType: 'MARKET_PROOF_VS_ATTEMPT_STAGE',
    conflictingFields: CONFLICT_FIELDS.slice(),
    recommendedReviewScreens: CONFLICT_SCREENS.slice(),
    reasonCode
  }
}

/**
 * Deterministic, non-directive user-facing conflict message (R48 §4).
 * It states that two answers disagree; it NEVER says which one is correct.
 */
const CONFLICT_MESSAGE =
  '你前面的两处回答有点对不上：\n' +
  '一处显示这项能力还没有成交，\n' +
  '另一处显示你已经有过付费结果。\n' +
  '确认一下这两处后，我才能继续给你策略。'

module.exports = {
  evaluateHybridEvidenceCompatibility,
  CONFLICT_MESSAGE,
  CONFLICT_FIELDS,
  CONFLICT_SCREENS,
  VERDICT_COMPATIBLE,
  VERDICT_CONDITIONAL,
  VERDICT_CONFLICT,
  SCOPE_COMPATIBLE,
  SCOPE_UNPROVEN,
  SCOPE_CONFLICT
}
