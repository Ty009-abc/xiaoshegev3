/**
 * engine/worldModel/necessaryConditionPolicies.js
 *
 * RC8.3 C3-002B-R1 — Necessary Condition Cardinality Policies.
 *
 * DEFINES explicit cardinality for C1 necessaryConditions.
 * Does NOT modify C1 blindSpotBoundaryDefinitions.js.
 * C1 defines the conditions. This module defines the cardinality.
 *
 * POLICIES:
 *   ALL_OF:      all conditions must be met
 *   AT_LEAST_N:  at least N conditions must be met
 *
 * EVIDENCE SIGNALS: per-condition mapping from C1 natural language
 *   to Secondary Signal IDs for executable evaluation.
 *
 * @version world_model_v3
 * @sprint c3-002b-r1
 */

var NECESSARY_POLICIES = Object.freeze({

  // ── DECISION_INERTIA: ALL_OF — all 3 describe facets of the same cycle ──

  DECISION_INERTIA: {
    policy: { operator: 'ALL_OF' },
    conditions: [
      {
        // "存在明确的可选决策但长期未被采取"
        evidenceSignals: [
          { signalId: 'WAITING_DURATION_PATTERN', state: 'ACTIVE' },
        ],
      },
      {
        // "推迟的核心原因是等待更高确定性"
        evidenceSignals: [
          { signalId: 'WAITING_DURATION_PATTERN', state: 'ACTIVE', minScore: 40 },
        ],
      },
      {
        // "推迟行为是模式而非单次事件"
        evidenceSignals: [
          { signalId: 'WAITING_DURATION_PATTERN', state: 'ACTIVE', minScore: 50 },
        ],
      },
    ],
  },

  // ── FEEDBACK_LOOP_GAP: ALL_OF — joint evidence of acting without learning ──

  FEEDBACK_LOOP_GAP: {
    policy: { operator: 'ALL_OF' },
    conditions: [
      {
        evidenceSignals: [
          { signalId: 'MINIMUM_STEP_EXECUTION', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'POST_ACTION_REVIEW_HABIT', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'DECISION_TO_ACTION_LATENCY', state: 'ACTIVE' },
        ],
      },
    ],
  },

  // ── LEVERAGE_MODEL_GAP: ALL_OF — all describe missing leverage structure ──

  LEVERAGE_MODEL_GAP: {
    policy: { operator: 'ALL_OF' },
    conditions: [
      {
        evidenceSignals: [
          { signalId: 'OUTPUT_DECOUPLING_AWARENESS', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'EFFORT_VS_MECHANISM_FRAMING', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'OUTPUT_DECOUPLING_AWARENESS', state: 'ACTIVE', minScore: 40 },
        ],
      },
    ],
  },

  // ── TIME_HORIZON_TRAP: ALL_OF — all describe short-term bias pattern ──

  TIME_HORIZON_TRAP: {
    policy: { operator: 'ALL_OF' },
    conditions: [
      {
        evidenceSignals: [
          { signalId: 'DIRECTION_SWITCHING_FREQUENCY', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'LONG_TERM_COMPOUNDING_AWARENESS', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'DIRECTION_SWITCHING_FREQUENCY', state: 'ACTIVE', minScore: 40 },
        ],
      },
    ],
  },

  // ── OPPORTUNITY_BLINDNESS: AT_LEAST_N(2) — condition [2] is a prerequisite ──

  OPPORTUNITY_BLINDNESS: {
    policy: { operator: 'AT_LEAST_N', minimum: 2 },
    conditions: [
      {
        evidenceSignals: [
          { signalId: 'INFORMATION_SOURCE_DIVERSITY', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'NON_DOMAIN_PATH_AWARENESS', state: 'ACTIVE' },
        ],
      },
      {
        // "具备识别和利用机会的基本能力" — qualifying condition, not evidence
        evidenceSignals: [
          { signalId: 'SERENDIPITOUS_PATH_DISCOVERY', state: 'ACTIVE' },
        ],
      },
    ],
  },

  // ── RISK_MODEL_DISTORTION: AT_LEAST_N(2) — emotional distortion can manifest without asymmetry ──

  RISK_MODEL_DISTORTION: {
    policy: { operator: 'AT_LEAST_N', minimum: 2 },
    conditions: [
      {
        evidenceSignals: [
          { signalId: 'EMOTIONAL_RECENCY_IMPACT', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'EMOTIONAL_RECENCY_IMPACT', state: 'ACTIVE', minScore: 40 },
        ],
      },
    ],
  },

  // ── PROBABILITY_MISJUDGMENT: AT_LEAST_N(2) — [1] is manifestation of [0] ──

  PROBABILITY_MISJUDGMENT: {
    policy: { operator: 'AT_LEAST_N', minimum: 2 },
    conditions: [
      {
        evidenceSignals: [
          { signalId: 'PROBABILISTIC_LANGUAGE_USAGE', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'LUCK_VS_SKILL_ATTRIBUTION', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'FEEDBACK_CALIBRATION_RATE', state: 'ACTIVE' },
        ],
      },
    ],
  },

  // ── IDENTITY_CONSTRAINT: AT_LEAST_N(2) — [2] emerges from [0]+[1] ──

  IDENTITY_CONSTRAINT: {
    policy: { operator: 'AT_LEAST_N', minimum: 2 },
    conditions: [
      {
        evidenceSignals: [
          { signalId: 'IDENTITY_BASED_EXCLUSION', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'CROSS_IDENTITY_ATTEMPT_HISTORY', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'SELF_ASSESSMENT_ASYMMETRY', state: 'ACTIVE' },
        ],
      },
    ],
  },

  // ── SYSTEM_THINKING_GAP: ALL_OF — all 3 facets of linear thinking ──

  SYSTEM_THINKING_GAP: {
    policy: { operator: 'ALL_OF' },
    conditions: [
      {
        evidenceSignals: [
          { signalId: 'FEEDBACK_LOOP_CONCEPT_AWARENESS', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'LINEARTY_VS_COMPLEXITY_DEFAULT', state: 'ACTIVE' },
        ],
      },
      {
        evidenceSignals: [
          { signalId: 'CROSS_DOMAIN_FEEDBACK_THINKING', state: 'ACTIVE' },
        ],
      },
    ],
  },

})

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

function getPolicy(candidateId) {
  var p = NECESSARY_POLICIES[candidateId]
  return p ? p.policy : null
}

function getConditionEvidenceSignals(candidateId, conditionIndex) {
  var p = NECESSARY_POLICIES[candidateId]
  if (!p) return []
  var cond = p.conditions[conditionIndex]
  return cond ? cond.evidenceSignals : []
}

module.exports = {
  NECESSARY_POLICIES,
  getPolicy,
  getConditionEvidenceSignals,
}
