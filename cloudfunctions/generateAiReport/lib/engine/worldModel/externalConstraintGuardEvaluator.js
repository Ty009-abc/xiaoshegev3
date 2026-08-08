/**
 * engine/worldModel/externalConstraintGuardEvaluator.js
 *
 * RC8.3 C4-003A — External Constraint / False Positive Guard Evaluator.
 *
 * Evaluates executable guard predicates against secondary signal states.
 * Runs BEFORE cognitive eligibility determination.
 *
 * GUARD STATE RETURN:
 *   EXTERNAL_CONSTRAINT_PRESENT — guard triggered, external explanation found
 *   FALSE_POSITIVE_RISK — pattern has alternative non-cognitive explanation
 *   INSUFFICIENT_TO_DIAGNOSE — not enough independent cognitive evidence
 *   COGNITIVE_EVIDENCE_INDEPENDENT — no guard triggered
 *
 * @version world_model_v3
 * @sprint c4-003a
 */

var { getGuards } = require('./externalConstraintGuardDefinitions')

// ═══════════════════════════════════════════════════════════════
// GUARD PREDICATE EVALUATION
// ═══════════════════════════════════════════════════════════════

function evaluateGuardPredicate(predicate, signalMap) {
  if (!predicate || !predicate.type) return { triggered: false }

  if (predicate.type === 'AND') {
    for (var i = 0; i < predicate.conditions.length; i++) {
      var childResult = evaluateGuardPredicate(predicate.conditions[i], signalMap)
      if (!childResult.triggered) return { triggered: false }
    }
    return { triggered: true }
  }

  if (predicate.type === 'OR') {
    for (var i = 0; i < predicate.conditions.length; i++) {
      var childResult = evaluateGuardPredicate(predicate.conditions[i], signalMap)
      if (childResult.triggered) return { triggered: true }
    }
    return { triggered: false }
  }

  // ── GUARD_SIGNAL: signal is in specific state with optional maxScore ──
  if (predicate.type === 'GUARD_SIGNAL') {
    var sig = signalMap[predicate.signalId]
    if (!sig) return { triggered: false }
    if (predicate.state && sig.state !== predicate.state) return { triggered: false }
    if (predicate.maxScore !== undefined && (sig.score || 0) > predicate.maxScore) return { triggered: false }
    return { triggered: true }
  }

  // ── GUARD_NO_SIGNAL: signal must NOT be in the specified state ──
  if (predicate.type === 'GUARD_NO_SIGNAL') {
    var sig = signalMap[predicate.signalId]
    if (!sig) return { triggered: true } // absent = not in the prohibited state
    if (sig.state === predicate.state) return { triggered: false }
    return { triggered: true }
  }

  return { triggered: false }
}

// ═══════════════════════════════════════════════════════════════
// MAIN GUARD EVALUATION
// ═══════════════════════════════════════════════════════════════

/**
 * Evaluates all external constraint / false positive guards for a candidate.
 *
 * @param {string} candidateId - blind spot ID
 * @param {Array} secondarySignals - array of signal state objects
 * @returns {{
 *   guardState: string,
 *   matchedConstraints: Array,
 *   explanatoryCoverage: number,
 *   independentCognitiveEvidence: Array,
 *   reason: string
 * }}
 */
function evaluateExternalGuards(candidateId, secondarySignals) {
  var signalMap = {}
  secondarySignals.forEach(function (s) { signalMap[s.id] = s })

  var guards = getGuards(candidateId)
  var matched = []
  var highestSeverity = null
  var uncoveredEvidence = []
  var independentEvidence = []

  guards.forEach(function (guard) {
    var result = evaluateGuardPredicate(guard.evidencePredicate, signalMap)
    if (result.triggered) {
      matched.push({
        guardId: guard.id,
        explanation: guard.explanation,
        severity: guard.severity,
        guardEffect: guard.guardEffect,
      })
      if (guard.severity === 'DISQUALIFYING') highestSeverity = 'DISQUALIFYING'
      else if (guard.severity === 'CONDITIONAL' && highestSeverity !== 'DISQUALIFYING') highestSeverity = 'CONDITIONAL'
    }
  })

  if (matched.length === 0) {
    return {
      guardState: 'COGNITIVE_EVIDENCE_INDEPENDENT',
      matchedConstraints: [],
      explanatoryCoverage: 0,
      independentCognitiveEvidence: getActiveSupportingSignals(candidateId, secondarySignals),
      reason: 'No external constraint guard triggered',
    }
  }

  // Determine guard state
  var guardState
  if (highestSeverity === 'DISQUALIFYING') {
    guardState = 'EXTERNAL_CONSTRAINT_PRESENT'
    independentEvidence = getActiveSupportingSignals(candidateId, secondarySignals)
    uncoveredEvidence = []
  } else {
    // CONDITIONAL: check if there's independent cognitive evidence
    independentEvidence = getActiveSupportingSignals(candidateId, secondarySignals)
    // Filter out signals covered by guards
    var guardSignalIds = new Set()
    matched.forEach(function (m) {
      // Collect signal IDs that triggered guards
      var guard = guards.find(function (g) { return g.id === m.guardId })
      if (guard && guard.evidencePredicate) {
        collectSignalIdsFromPredicate(guard.evidencePredicate, guardSignalIds)
      }
    })
    uncoveredEvidence = independentEvidence.filter(function (s) { return !guardSignalIds.has(s.id) })

    if (uncoveredEvidence.length === 0 && independentEvidence.length > 0) {
      guardState = 'INSUFFICIENT_TO_DIAGNOSE'
    } else if (uncoveredEvidence.length > 0) {
      guardState = 'FALSE_POSITIVE_RISK'
    } else {
      guardState = 'EXTERNAL_CONSTRAINT_PRESENT'
    }
  }

  return {
    guardState: guardState,
    matchedConstraints: matched,
    explanatoryCoverage: matched.length,
    independentCognitiveEvidence: independentEvidence.map(function (s) { return s.id }),
    uncoveredEvidence: uncoveredEvidence.map(function (s) { return s.id }),
    uncoveredIndependentCount: countIndependentOrigins(uncoveredEvidence),
    reason: matched.length + ' guard(s) triggered: ' + matched.map(function (m) { return m.guardId }).join(', '),
  }
}

function collectSignalIdsFromPredicate(predicate, signalIds) {
  if (!predicate) return
  if (predicate.signalId) signalIds.add(predicate.signalId)
  if (predicate.conditions) {
    predicate.conditions.forEach(function (c) { collectSignalIdsFromPredicate(c, signalIds) })
  }
}

function countIndependentOrigins(signals) {
  var origins = {}
  signals.forEach(function (s) {
    var origin = s.originId || s.id || ''
    origins[origin] = true
  })
  return Object.keys(origins).length
}

// ═══════════════════════════════════════════════════════════════
// SIGNAL-BLIND SPOT MAPPING
// ═══════════════════════════════════════════════════════════════

function getActiveSupportingSignals(candidateId, secondarySignals) {
  var SIGNAL_BLIND_SPOT_MAP = {
    WAITING_DURATION_PATTERN: { supports: 'DECISION_INERTIA' },
    MINIMUM_STEP_EXECUTION: { supports: 'FEEDBACK_LOOP_GAP' },
    POST_ACTION_REVIEW_HABIT: { supports: 'FEEDBACK_LOOP_GAP' },
    DECISION_TO_ACTION_LATENCY: { supports: 'FEEDBACK_LOOP_GAP' },
    OUTPUT_DECOUPLING_AWARENESS: { supports: 'LEVERAGE_MODEL_GAP' },
    EFFORT_VS_MECHANISM_FRAMING: { supports: 'LEVERAGE_MODEL_GAP' },
    DIRECTION_SWITCHING_FREQUENCY: { supports: 'TIME_HORIZON_TRAP' },
    LONG_TERM_COMPOUNDING_AWARENESS: { supports: 'TIME_HORIZON_TRAP' },
    ALTERNATIVE_PATH_COST_AWARENESS: { supports: 'TIME_HORIZON_TRAP' },
    EMOTIONAL_RECENCY_IMPACT: { supports: 'RISK_MODEL_DISTORTION' },
    ABSTRACT_VS_EMBODIED_RISK_JUDGMENT: { supports: 'RISK_MODEL_DISTORTION' },
    PROBABILISTIC_LANGUAGE_USAGE: { supports: 'PROBABILITY_MISJUDGMENT' },
    LUCK_VS_SKILL_ATTRIBUTION: { supports: 'PROBABILITY_MISJUDGMENT' },
    FEEDBACK_CALIBRATION_RATE: { supports: 'PROBABILITY_MISJUDGMENT' },
    FEEDBACK_LOOP_CONCEPT_AWARENESS: { supports: 'SYSTEM_THINKING_GAP' },
    CROSS_DOMAIN_FEEDBACK_THINKING: { supports: 'SYSTEM_THINKING_GAP' },
    LINEARTY_VS_COMPLEXITY_DEFAULT: { supports: 'SYSTEM_THINKING_GAP' },
    INFORMATION_SOURCE_DIVERSITY: { supports: 'OPPORTUNITY_BLINDNESS' },
    SERENDIPITOUS_PATH_DISCOVERY: { supports: 'OPPORTUNITY_BLINDNESS' },
    NON_DOMAIN_PATH_AWARENESS: { supports: 'OPPORTUNITY_BLINDNESS' },
    IDENTITY_BASED_EXCLUSION: { supports: 'IDENTITY_CONSTRAINT' },
    CROSS_IDENTITY_ATTEMPT_HISTORY: { supports: 'IDENTITY_CONSTRAINT' },
    SELF_ASSESSMENT_ASYMMETRY: { supports: 'IDENTITY_CONSTRAINT' },
  }

  return secondarySignals.filter(function (s) {
    if (s.state !== 'ACTIVE') return false
    var map = SIGNAL_BLIND_SPOT_MAP[s.id]
    return map && map.supports === candidateId
  })
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  evaluateExternalGuards,
  evaluateGuardPredicate,
}
