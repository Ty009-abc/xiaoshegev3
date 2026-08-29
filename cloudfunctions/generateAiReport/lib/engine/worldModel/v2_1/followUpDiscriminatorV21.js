/**
 * engine/worldModel/v2_1/followUpDiscriminatorV21.js
 *
 * World Model v2.1 — Follow-up Discriminator / Resolver (Stage19A5B-2).
 *
 * SHADOW ONLY. Part 2 of 2. Owns the A5A FOLLOW_UP_REQUIRED → positive
 * discrimination → PRIMARY_ALLOWED (or INSUFFICIENT_EVIDENCE) terminal
 * resolution. It does NOT modify follow-up bank semantics and does NOT
 * recalculate base eligibility.
 *
 * Authority: docs/adr/ADR-RC8.3-STAGE19-A5-UNCERTAINTY-PRIMARY-SELECTION-CONTRACT.md
 *   — A5.1 §A5.1-5 (§6 FROZEN: discriminator, not sufficiency inflator),
 *     §A5.1-6 (§7), §A5.1-7, A5.1-R1. Authority priority:
 *     A5/A5.1/A5.1-R1 > R3D > R3C > R3B > R3A > R3 > R2 > R1.
 *
 * FROZEN RULES (A5B-2):
 *   - Input gate: a5aDecision.status MUST be FOLLOW_UP_REQUIRED with a valid
 *     frozen followupPair. PRIMARY_ALLOWED / NO_PRIMARY_DEFICIT /
 *     INSUFFICIENT_EVIDENCE are all rejected. Malformed / missing / unknown /
 *     structural-only pairs are rejected. A5A_GATE_BYPASS_PATHS = 0.
 *   - Uses A5B-1 as the authoritative bank (selector + tuple validation).
 *     CROSS_PAIR_OPTION_ACCEPTANCE_PATHS = 0.
 *   - Positive discrimination only: option → dedicated D evidence → exactly one
 *     construct in the original pair → PRIMARY_ALLOWED.
 *     NOT_A_DOES_NOT_IMPLY_B = YES. COMPLEMENT_INFERENCE_PATHS = 0.
 *     H_ONLY_TO_OTHER_PRIMARY_PATHS = 0. No "not A → B", no H-based complement.
 *   - Primary resolution: primaryConstruct = discriminated construct,
 *     primaryBlindSpotId = frozen 1:1 CONSTRUCT_TO_BLINDSPOT_V21 mapping.
 *     No ranking, no score, no nearest-candidate, no ontology priority, no ID_OFFSET.
 *   - Base eligibility immutability: follow-up evidence is discriminator only.
 *     It never adds a base D vote, never changes dimension support, never
 *     changes A4 candidate status / A5A eligibility, never promotes WEAK/MODERATE,
 *     never repairs MIXED, never turns D+missing or D+N into D+D.
 *     FOLLOWUP_TO_BASE_SUPPORT_PATHS = 0.
 *     FOLLOWUP_SUFFICIENCY_INFLATION_PATHS = 0.
 *     FOLLOWUP_OBSERVATION_AS_BASE_SUPPORT_PATHS = 0.
 *   - One round only: MAX_FOLLOWUP_ROUNDS = 1, CURRENT_QUESTIONS_PER_PAIR = 1,
 *     SECOND_ROUND_PATHS = 0. No recursion, no retry-until-winner, no fallback
 *     question, no tournament.
 *   - RESPONSE_VALIDITY_DEPENDENCY = NOT_IMPLEMENTED (R3B owns response validity).
 *     Only structural input validation is performed here.
 *
 * Terminal statuses only: PRIMARY_ALLOWED | INSUFFICIENT_EVIDENCE.
 * Malformed input yields deterministic INVALID_INPUT validation semantics and
 * never fabricates a primary.
 *
 * No numeric score, no candidate ranking, no state→number, no separation
 * threshold, no ID_OFFSET, no ontology priority, no D−H arithmetic, no
 * pseudo-probability, no confidence percentage.
 *
 * @version world_model_v2_1
 */

const bank = require('./followUpBankV21')
const {
  CONSTRUCT_TO_BLINDSPOT_V21,
} = require('./blindSpotCandidateEngineV21')

// ── Frozen constants ───────────────────────────────────────────────────────
const MAX_FOLLOWUP_ROUNDS = 1
const CURRENT_QUESTIONS_PER_PAIR = 1
const SECOND_ROUND_PATHS = 0

const NOT_A_DOES_NOT_IMPLY_B = true
const FOLLOWUP_RESOLUTION_REQUIRES_POSITIVE_DISCRIMINATION = true
const RESPONSE_VALIDITY_DEPENDENCY = 'NOT_IMPLEMENTED'

// Closed resolution status set (no FOLLOW_UP_REQUIRED after resolution).
const RESOLUTION_STATUS_SET_V21 = Object.freeze([
  'PRIMARY_ALLOWED',
  'INSUFFICIENT_EVIDENCE',
])

// Categorical reason codes (deterministic, no numeric values).
const REASON = {
  POSITIVE_DISCRIMINATION: 'POSITIVE_DISCRIMINATION',
  NO_POSITIVE_DISCRIMINATION: 'NO_POSITIVE_DISCRIMINATION',
  A5A_GATE_REJECTED: 'A5A_GATE_REJECTED',
  PAIR_REJECTED: 'PAIR_REJECTED',
  FOLLOWUP_ID_MISMATCH: 'FOLLOWUP_ID_MISMATCH',
  CROSS_PAIR_OPTION: 'CROSS_PAIR_OPTION',
  UNKNOWN_OPTION: 'UNKNOWN_OPTION',
  MISSING_ANSWER: 'MISSING_ANSWER',
  MALFORMED_A5A: 'MALFORMED_A5A',
}

// ── Input gate: A5A decision must be FOLLOW_UP_REQUIRED with valid pair ────
function validateA5AInputGate(a5aDecision) {
  if (!a5aDecision || typeof a5aDecision !== 'object') {
    return { errorType: 'MALFORMED_A5A', reasonCode: REASON.MALFORMED_A5A }
  }
  if (a5aDecision.status !== 'FOLLOW_UP_REQUIRED') {
    return { errorType: 'A5A_GATE_REJECTED', reasonCode: REASON.A5A_GATE_REJECTED, status: a5aDecision.status }
  }
  const pair = a5aDecision.followupPair
  if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || typeof pair[1] !== 'string') {
    return { errorType: 'MISSING_PAIR', reasonCode: REASON.MALFORMED_A5A }
  }
  return null
}

/**
 * Resolve the A5A FOLLOW_UP_REQUIRED decision using one validated A5B-1 answer.
 *
 * @param {object} a5aDecision  Output of decidePrimaryV21 (status FOLLOW_UP_REQUIRED).
 * @param {object} answer       { followupId: string, optionId: string }
 * @returns {object}
 *   - { status:'INVALID_INPUT', reasonCode, errorType, trace }  (never fabricates a primary)
 *   - { status:'PRIMARY_ALLOWED', primaryBlindSpotId, primaryConstruct,
 *       followupPair, followupId, selectedOptionId, discriminatingEvidence,
 *       reasonCode, trace }
 *   - { status:'INSUFFICIENT_EVIDENCE', reasonCode, trace }  (no fallback winner)
 */
function resolveFollowUpV21(a5aDecision, answer) {
  const trace = [{ step: 'A5A_INPUT_GATE', status: a5aDecision && a5aDecision.status }]

  // ── 1. A5A input gate ───────────────────────────────────────────────────
  const gate = validateA5AInputGate(a5aDecision)
  if (gate) {
    trace.push({ step: 'GATE_REJECTED', errorType: gate.errorType, reasonCode: gate.reasonCode })
    return {
      status: 'INVALID_INPUT',
      primaryBlindSpotId: null,
      primaryConstruct: null,
      reasonCode: gate.reasonCode,
      errorType: gate.errorType,
      trace,
    }
  }

  const pair = a5aDecision.followupPair
  trace.push({ step: 'FOLLOWUP_PAIR', pair: [...pair] })

  // ── 2. Authoritative A5B-1 selector (rejects structural/unknown/missing) ─
  const question = bank.selectFollowUpV21(pair)
  if (!question) {
    trace.push({ step: 'PAIR_REJECTED', pair: [...pair], reasonCode: REASON.PAIR_REJECTED })
    return {
      status: 'INVALID_INPUT',
      primaryBlindSpotId: null,
      primaryConstruct: null,
      reasonCode: REASON.PAIR_REJECTED,
      errorType: 'PAIR_REJECTED',
      trace,
    }
  }
  const followupId = question.followupId
  trace.push({ step: 'FOLLOWUP_SELECTED', followupId })

  // ── 3. Validate answer tuple through A5B-1 ──────────────────────────────
  if (!answer || typeof answer !== 'object') {
    trace.push({ step: 'MISSING_ANSWER', reasonCode: REASON.MISSING_ANSWER })
    return {
      status: 'INVALID_INPUT',
      primaryBlindSpotId: null,
      primaryConstruct: null,
      reasonCode: REASON.MISSING_ANSWER,
      errorType: 'MISSING_ANSWER',
      trace,
    }
  }
  const { followupId: answerFollowupId, optionId } = answer
  if (typeof answerFollowupId !== 'string' || answerFollowupId.length === 0) {
    trace.push({ step: 'MISSING_ANSWER', reasonCode: REASON.MISSING_ANSWER })
    return {
      status: 'INVALID_INPUT',
      primaryBlindSpotId: null,
      primaryConstruct: null,
      reasonCode: REASON.MISSING_ANSWER,
      errorType: 'MISSING_ANSWER',
      trace,
    }
  }
  if (answerFollowupId !== followupId) {
    // Cross-pair option: the answer's followupId belongs to a different pair.
    const errType = bank.isFollowUpPairV21 && bank.FOLLOWUP_QUESTION_BY_ID.has(answerFollowupId)
      ? REASON.CROSS_PAIR_OPTION
      : REASON.FOLLOWUP_ID_MISMATCH
    trace.push({ step: 'FOLLOWUP_ID_MISMATCH', expected: followupId, got: answerFollowupId, reasonCode: errType })
    return {
      status: 'INVALID_INPUT',
      primaryBlindSpotId: null,
      primaryConstruct: null,
      reasonCode: errType,
      errorType: errType,
      trace,
    }
  }
  if (typeof optionId !== 'string' || optionId.length === 0) {
    trace.push({ step: 'UNKNOWN_OPTION', reasonCode: REASON.UNKNOWN_OPTION })
    return {
      status: 'INVALID_INPUT',
      primaryBlindSpotId: null,
      primaryConstruct: null,
      reasonCode: REASON.UNKNOWN_OPTION,
      errorType: 'UNKNOWN_OPTION',
      trace,
    }
  }

  const evidence = bank.resolveFollowUpEvidenceV21(followupId, optionId)
  if (!evidence) {
    trace.push({ step: 'UNKNOWN_OPTION', followupId, optionId, reasonCode: REASON.UNKNOWN_OPTION })
    return {
      status: 'INVALID_INPUT',
      primaryBlindSpotId: null,
      primaryConstruct: null,
      reasonCode: REASON.UNKNOWN_OPTION,
      errorType: 'UNKNOWN_OPTION',
      trace,
    }
  }
  trace.push({ step: 'DEDICATED_EVIDENCE', evidenceId: evidence.evidenceId, construct: evidence.construct, direction: evidence.direction })

  // ── 4. Positive discrimination only ─────────────────────────────────────
  // Valid round but cannot establish positive discrimination → INSUFFICIENT_EVIDENCE
  // (never a fallback winner, never H-based complement).
  const directionIsD = evidence.direction === 'D'
  const constructInPair = pair.includes(evidence.construct)
  if (!directionIsD || !constructInPair) {
    trace.push({
      step: 'NO_POSITIVE_DISCRIMINATION',
      direction: evidence.direction,
      construct: evidence.construct,
      pair: [...pair],
      reasonCode: REASON.NO_POSITIVE_DISCRIMINATION,
    })
    return {
      status: 'INSUFFICIENT_EVIDENCE',
      primaryBlindSpotId: null,
      primaryConstruct: null,
      reasonCode: REASON.NO_POSITIVE_DISCRIMINATION,
      trace,
    }
  }

  // ── 5. Primary resolution (frozen 1:1 mapping, no ranking) ──────────────
  const primaryConstruct = evidence.construct
  const primaryBlindSpotId = CONSTRUCT_TO_BLINDSPOT_V21[primaryConstruct] || null
  trace.push({ step: 'PRIMARY_RESOLVED', primaryConstruct, primaryBlindSpotId })

  return {
    status: 'PRIMARY_ALLOWED',
    primaryBlindSpotId,
    primaryConstruct,
    followupPair: [...pair],
    followupId,
    selectedOptionId: optionId,
    discriminatingEvidence: evidence,
    reasonCode: REASON.POSITIVE_DISCRIMINATION,
    trace,
  }
}

module.exports = {
  MAX_FOLLOWUP_ROUNDS,
  CURRENT_QUESTIONS_PER_PAIR,
  SECOND_ROUND_PATHS,
  NOT_A_DOES_NOT_IMPLY_B,
  FOLLOWUP_RESOLUTION_REQUIRES_POSITIVE_DISCRIMINATION,
  RESPONSE_VALIDITY_DEPENDENCY,
  RESOLUTION_STATUS_SET_V21,
  REASON,
  validateA5AInputGate,
  resolveFollowUpV21,
}
