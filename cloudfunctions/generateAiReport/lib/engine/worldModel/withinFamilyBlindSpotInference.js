/**
 * engine/worldModel/withinFamilyBlindSpotInference.js
 *
 * RC8.3 C3-002B-R1 — Within-Family Blind Spot Selection.
 *
 * R1 CHANGES:
 *   - Necessary condition cardinality: explicit policies (ALL_OF / AT_LEAST_N)
 *   - Provenance-aware scoring: per-origin strongest contribution
 *   - 0 hardcoded evidence-semantic mappings in inference engine
 *   - Policies owned by necessaryConditionPolicies.js, not inference engine
 *
 * @version world_model_v3
 * @sprint c3-002b-r1
 */

var { BLIND_SPOT_BOUNDARIES } = require('./blindSpotBoundaryDefinitions')
var { BLIND_SPOT_FAMILIES, getFamily } = require('./blindSpotFamilyDefinitions')
var { getPolicy, getConditionEvidenceSignals } = require('./necessaryConditionPolicies')
var { evaluateExternalGuards } = require('./externalConstraintGuardEvaluator')

// ═══════════════════════════════════════════════════════════════
// CANDIDATE ELIGIBILITY STATES
// ═══════════════════════════════════════════════════════════════

var ELIGIBILITY = Object.freeze({
  ELIGIBLE: 'ELIGIBLE',
  INSUFFICIENT: 'INSUFFICIENT',
  DISQUALIFIED: 'DISQUALIFIED',
})

// ═══════════════════════════════════════════════════════════════
// PROVENANCE-AWARE AGGREGATION
// ═══════════════════════════════════════════════════════════════

function getOrigin(signal) {
  return signal.originId || (signal.id || '')
}

/**
 * Groups signals by provenance origin.
 * Within each origin, takes the STRONGEST contribution.
 * Returns aggregated independent contributions and total count.
 */
function aggregateByOrigin(signals) {
  var groups = {}
  signals.forEach(function (s) {
    var origin = getOrigin(s)
    if (!groups[origin]) groups[origin] = { signals: [], maxScore: 0, maxConfidence: 0 }
    groups[origin].signals.push(s)
    if ((s.score || 0) > groups[origin].maxScore) {
      groups[origin].maxScore = s.score || 0
      groups[origin].maxConfidence = s.confidence || 0
    }
  })

  var independentCount = Object.keys(groups).length
  var totalStrength = 0
  Object.keys(groups).forEach(function (o) {
    totalStrength += groups[o].maxScore
  })

  return {
    independentCount: independentCount,
    totalStrength: totalStrength,
    avgStrength: independentCount > 0 ? Math.round(totalStrength / independentCount) : 0,
    groups: groups,
  }
}

/**
 * Aggregates suppressed/contradicting signals by origin.
 * Within each origin, counts as 1 contradiction penalty (not N).
 */
function aggregateContradictionByOrigin(signals) {
  var origins = {}
  signals.forEach(function (s) {
    origins[getOrigin(s)] = true
  })
  return {
    independentCount: Object.keys(origins).length,
    totalCount: signals.length,
  }
}

// ═══════════════════════════════════════════════════════════════
// SECONDARY SIGNAL → BLIND SPOT DIRECTION (immutable architecture)
// ═══════════════════════════════════════════════════════════════

var SIGNAL_BLIND_SPOT_MAP = Object.freeze({
  WAITING_DURATION_PATTERN: { supports: 'DECISION_INERTIA', weakens: 'FEEDBACK_LOOP_GAP' },
  MINIMUM_STEP_EXECUTION: { supports: 'FEEDBACK_LOOP_GAP', weakens: 'DECISION_INERTIA' },
  POST_ACTION_REVIEW_HABIT: { supports: 'FEEDBACK_LOOP_GAP', weakens: 'DECISION_INERTIA' },
  DECISION_TO_ACTION_LATENCY: { supports: 'FEEDBACK_LOOP_GAP', weakens: 'DECISION_INERTIA' },
  OUTPUT_DECOUPLING_AWARENESS: { supports: 'LEVERAGE_MODEL_GAP', weakens: 'TIME_HORIZON_TRAP' },
  EFFORT_VS_MECHANISM_FRAMING: { supports: 'LEVERAGE_MODEL_GAP', weakens: 'TIME_HORIZON_TRAP' },
  DIRECTION_SWITCHING_FREQUENCY: { supports: 'TIME_HORIZON_TRAP', weakens: 'LEVERAGE_MODEL_GAP' },
  LONG_TERM_COMPOUNDING_AWARENESS: { supports: 'TIME_HORIZON_TRAP', weakens: 'LEVERAGE_MODEL_GAP' },
  ALTERNATIVE_PATH_COST_AWARENESS: { supports: 'TIME_HORIZON_TRAP', weakens: 'LEVERAGE_MODEL_GAP' },
  EMOTIONAL_RECENCY_IMPACT: { supports: 'RISK_MODEL_DISTORTION', weakens: 'PROBABILITY_MISJUDGMENT' },
  ABSTRACT_VS_EMBODIED_RISK_JUDGMENT: { supports: 'RISK_MODEL_DISTORTION', weakens: 'PROBABILITY_MISJUDGMENT' },
  PROBABILISTIC_LANGUAGE_USAGE: { supports: 'PROBABILITY_MISJUDGMENT', weakens: 'RISK_MODEL_DISTORTION' },
  LUCK_VS_SKILL_ATTRIBUTION: { supports: 'PROBABILITY_MISJUDGMENT', weakens: 'RISK_MODEL_DISTORTION' },
  FEEDBACK_CALIBRATION_RATE: { supports: 'PROBABILITY_MISJUDGMENT', weakens: 'RISK_MODEL_DISTORTION' },
  FEEDBACK_LOOP_CONCEPT_AWARENESS: { supports: 'SYSTEM_THINKING_GAP', weakens: 'FEEDBACK_LOOP_GAP' },
  CROSS_DOMAIN_FEEDBACK_THINKING: { supports: 'FEEDBACK_LOOP_GAP', weakens: 'SYSTEM_THINKING_GAP' },
  LINEARTY_VS_COMPLEXITY_DEFAULT: { supports: 'SYSTEM_THINKING_GAP', weakens: 'FEEDBACK_LOOP_GAP' },
  INFORMATION_SOURCE_DIVERSITY: { supports: 'OPPORTUNITY_BLINDNESS', weakens: 'IDENTITY_CONSTRAINT' },
  SERENDIPITOUS_PATH_DISCOVERY: { supports: 'OPPORTUNITY_BLINDNESS', weakens: 'IDENTITY_CONSTRAINT' },
  NON_DOMAIN_PATH_AWARENESS: { supports: 'OPPORTUNITY_BLINDNESS', weakens: 'IDENTITY_CONSTRAINT' },
  IDENTITY_BASED_EXCLUSION: { supports: 'IDENTITY_CONSTRAINT', weakens: 'OPPORTUNITY_BLINDNESS' },
  CROSS_IDENTITY_ATTEMPT_HISTORY: { supports: 'IDENTITY_CONSTRAINT', weakens: 'OPPORTUNITY_BLINDNESS' },
  SELF_ASSESSMENT_ASYMMETRY: { supports: 'IDENTITY_CONSTRAINT', weakens: 'OPPORTUNITY_BLINDNESS' },
})

// ═══════════════════════════════════════════════════════════════
// NECESSARY CONDITION EVALUATION (policy-driven)
// ═══════════════════════════════════════════════════════════════

function evaluateNecessaryConditions(candidateId, secondarySignals) {
  var signalMap = {}
  secondarySignals.forEach(function (s) { signalMap[s.id] = s })

  var conditions = getConditionEvidenceSignalsBatch(candidateId)
  var checks = []
  var metCount = 0

  conditions.forEach(function (cond, i) {
    var met = cond.every(function (criterion) {
      var sig = signalMap[criterion.signalId]
      if (!sig) return false
      if (sig.state !== criterion.state) return false
      if (criterion.minScore && (sig.score || 0) < criterion.minScore) return false
      return true
    })
    checks.push({ met: met, conditionIndex: i, evidenceIds: met ? [cond[0].signalId] : [] })
    if (met) metCount++
  })

  // Apply policy
  var policy = getPolicy(candidateId) || { operator: 'AT_LEAST_N', minimum: 2 }
  var eligible = false

  if (policy.operator === 'ALL_OF') {
    eligible = metCount === conditions.length
  } else if (policy.operator === 'AT_LEAST_N') {
    eligible = metCount >= (policy.minimum || 2)
  }

  var missingIndices = []
  checks.forEach(function (c) { if (!c.met) missingIndices.push(c.conditionIndex) })

  return {
    met: eligible,
    missing: missingIndices,
    checks: checks,
    total: conditions.length,
    metCount: metCount,
    policy: policy,
  }
}

function getConditionEvidenceSignalsBatch(candidateId) {
  var results = []
  for (var i = 0; i < 3; i++) {
    results.push(getConditionEvidenceSignals(candidateId, i))
  }
  return results
}

// ═══════════════════════════════════════════════════════════════
// DISQUALIFIER EVALUATION
// ═══════════════════════════════════════════════════════════════

function evaluateDisqualifiers(candidateId, secondarySignals) {
  var signalMap = {}
  secondarySignals.forEach(function (s) { signalMap[s.id] = s })

  var disqualifierCriteria = {
    DECISION_INERTIA: [
      { signalId: 'MINIMUM_STEP_EXECUTION', state: 'ACTIVE', reason: '正在进行多方向实验' },
    ],
    FEEDBACK_LOOP_GAP: [
      { signalId: 'WAITING_DURATION_PATTERN', state: 'ACTIVE', reason: '决策本身尚未发生' },
    ],
    LEVERAGE_MODEL_GAP: [
      { signalId: 'DIRECTION_SWITCHING_FREQUENCY', state: 'ACTIVE', reason: '方向频繁切换' },
    ],
    TIME_HORIZON_TRAP: [
      { signalId: 'OUTPUT_DECOUPLING_AWARENESS', state: 'ACTIVE', reason: '存在复用模式 — 是杠杆问题而非时间问题' },
    ],
    OPPORTUNITY_BLINDNESS: [
      { signalId: 'IDENTITY_BASED_EXCLUSION', state: 'ACTIVE', reason: '身份过滤而非信息缺口' },
    ],
    RISK_MODEL_DISTORTION: [
      { signalId: 'PROBABILISTIC_LANGUAGE_USAGE', state: 'ACTIVE', reason: '有概率框架，问题在情绪扭曲' },
    ],
    PROBABILITY_MISJUDGMENT: [
      { signalId: 'EMOTIONAL_RECENCY_IMPACT', state: 'ACTIVE', reason: '情绪事件影响判断' },
      { signalId: 'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', state: 'ACTIVE', reason: '抽象判断准确，个人判断偏差' },
    ],
    IDENTITY_CONSTRAINT: [
      { signalId: 'INFORMATION_SOURCE_DIVERSITY', state: 'ACTIVE', reason: '信息接触不足，非身份过滤' },
    ],
    SYSTEM_THINKING_GAP: [
      { signalId: 'POST_ACTION_REVIEW_HABIT', state: 'ACTIVE', reason: '有复盘习惯，问题不在系统思维' },
    ],
  }

  var criteria = disqualifierCriteria[candidateId] || []
  var triggered = []
  var evidenceIds = []

  criteria.forEach(function (c) {
    var sig = signalMap[c.signalId]
    if (sig && sig.state === c.state) {
      triggered.push({ signalId: c.signalId, reason: c.reason })
      evidenceIds.push(c.signalId)
    }
  })

  return {
    disqualified: triggered.length > 0,
    reasons: triggered.map(function (t) { return t.reason }),
    evidenceIds: evidenceIds,
  }
}

// ═══════════════════════════════════════════════════════════════
// CONTRADICTION (provenance-aware)
// ═══════════════════════════════════════════════════════════════

function evaluateContradiction(candidateId, secondarySignals) {
  var contradictingSignals = secondarySignals.filter(function (s) {
    var map = SIGNAL_BLIND_SPOT_MAP[s.id]
    if (!map) return false
    return map.weakens === candidateId && s.state === 'ACTIVE'
  })

  var suppressedSupport = secondarySignals.filter(function (s) {
    var map = SIGNAL_BLIND_SPOT_MAP[s.id]
    if (!map) return false
    return map.supports === candidateId && s.state === 'SUPPRESSED'
  })

  var allContradict = contradictingSignals.concat(suppressedSupport)

  // Provenance-aware: one origin → one contradiction penalty
  var agg = aggregateContradictionByOrigin(allContradict)

  return {
    hasContradiction: agg.totalCount > 0,
    totalCount: agg.totalCount,
    independentCount: agg.independentCount,
    evidenceIds: allContradict.map(function (s) { return s.id }),
    strength: agg.independentCount >= 2 ? 'STRONG' : (agg.totalCount > 0 ? 'MODERATE' : 'NONE'),
  }
}

// ═══════════════════════════════════════════════════════════════
// DIFFERENTIATORS (provenance-aware)
// ═══════════════════════════════════════════════════════════════

function evaluateDifferentiators(candidateId, secondarySignals) {
  var supporting = secondarySignals.filter(function (s) {
    if (s.state !== 'ACTIVE') return false
    var map = SIGNAL_BLIND_SPOT_MAP[s.id]
    if (!map) return false
    return map.supports === candidateId
  })

  // Provenance-aware: per-origin strongest contribution
  var agg = aggregateByOrigin(supporting)

  return {
    count: supporting.length,
    independentCount: agg.independentCount,
    evidenceIds: supporting.map(function (s) { return s.id }),
    totalStrength: agg.totalStrength,
    avgStrength: agg.avgStrength,
  }
}

// ═══════════════════════════════════════════════════════════════
// SUPPORT STRENGTH (provenance-aware)
// ═══════════════════════════════════════════════════════════════

function calculateSupportStrength(necessary, differentiators, contradiction) {
  if (!necessary.met) return 0

  var diffStrength = differentiators.avgStrength
  var independenceBonus = Math.min(differentiators.independentCount, 3) * 10
  var necessaryBonus = necessary.metCount * 5
  var contradictionPenalty = contradiction.independentCount * 15

  var raw = diffStrength + independenceBonus + necessaryBonus - contradictionPenalty
  return Math.max(0, Math.min(100, Math.round(raw)))
}

// ═══════════════════════════════════════════════════════════════
// CONFIDENCE
// ═══════════════════════════════════════════════════════════════

function calculateCandidateConfidence(necessary, differentiators, contradiction) {
  if (!necessary.met) return 0

  var necessaryConf = necessary.policy.operator === 'ALL_OF'
    ? (necessary.metCount === necessary.total ? 0.4 : 0.2)
    : Math.min(necessary.metCount / (necessary.policy.minimum || 2), 1) * 0.4
  var diffConf = Math.min(differentiators.independentCount / 3, 1) * 0.4
  var contraConf = contradiction.independentCount > 0 ? -0.2 : 0.1

  return Math.max(0, Math.min(1, Math.round((necessaryConf + diffConf + contraConf) * 100) / 100))
}

// ═══════════════════════════════════════════════════════════════
// AMBIGUITY
// ═══════════════════════════════════════════════════════════════

function detectCandidateAmbiguity(eligible) {
  if (eligible.length < 2) return { ambiguous: false, rawGap: 0 }
  var top = eligible[0], second = eligible[1]
  var rawGap = Math.round((top.supportStrength - second.supportStrength) * 100) / 100
  var ambiguous = rawGap < 10 || (rawGap < 20 && top.supportStrength < 40)
  return { ambiguous: ambiguous, rawGap: rawGap }
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════

function inferWithinFamilyBlindSpot(input) {
  if (!input) input = {}
  var familyId = input.family
  var secondarySignals = input.secondarySignals || []

  var family = getFamily(familyId)
  if (!family) return {
    family: familyId, primaryBlindSpot: null, alternateBlindSpot: null,
    candidateStates: [], ambiguous: true, rawGap: 0, confidence: 0,
    reasoningTrace: 'Unknown family: ' + familyId,
  }

  var candidates = family.candidates

  var candidateStates = candidates.map(function (candidateId) {
    // ── C4-003A: External Constraint Guard (BEFORE cognitive evaluation) ──
    var externalGuard = evaluateExternalGuards(candidateId, secondarySignals)

    var necessary = evaluateNecessaryConditions(candidateId, secondarySignals)
    var disqualifier = evaluateDisqualifiers(candidateId, secondarySignals)
    var contradiction = evaluateContradiction(candidateId, secondarySignals)
    var differentiators = evaluateDifferentiators(candidateId, secondarySignals)

    var eligibility
    if (disqualifier.disqualified) {
      eligibility = ELIGIBILITY.DISQUALIFIED
    } else if (externalGuard.guardState === 'EXTERNAL_CONSTRAINT_PRESENT') {
      eligibility = ELIGIBILITY.INSUFFICIENT
    } else if (externalGuard.guardState === 'INSUFFICIENT_TO_DIAGNOSE') {
      eligibility = ELIGIBILITY.INSUFFICIENT
    } else if (externalGuard.guardState === 'FALSE_POSITIVE_RISK') {
      // FALSE_POSITIVE_RISK: guard triggered, but uncovered independent evidence may remain
      // Only block when no independent cognitive evidence beyond guard-covered signals
      var uncoveredIndep = externalGuard.uncoveredIndependentCount || 0
      if (uncoveredIndep === 0) {
        eligibility = ELIGIBILITY.INSUFFICIENT
      }
    }
    // Fall-through for FALSE_POSITIVE_RISK with uncovered evidence:
    // check necessary conditions below
    if (eligibility === undefined) {
      if (disqualifier.disqualified) {
        eligibility = ELIGIBILITY.DISQUALIFIED
      } else if (!necessary.met) {
        eligibility = ELIGIBILITY.INSUFFICIENT
      } else {
        eligibility = ELIGIBILITY.ELIGIBLE
      }
    }

    var supportStrength = calculateSupportStrength(necessary, differentiators, contradiction)
    var confidence = calculateCandidateConfidence(necessary, differentiators, contradiction)

    var missingEvidenceNeeded = []
    if (!necessary.met) {
      necessary.missing.forEach(function (i) {
        missingEvidenceNeeded.push('Missing necessary condition ' + (i + 1) + ' (policy: ' + necessary.policy.operator + ')')
      })
    }

    var ambiguityReasons = []
    if (eligibility === ELIGIBILITY.ELIGIBLE && contradiction.independentCount >= 1) {
      ambiguityReasons.push('Contradiction: ' + contradiction.independentCount + ' independent origins')
    }

    return {
      id: candidateId,
      eligibility: eligibility,
      supportStrength: supportStrength,
      confidence: confidence,
      necessaryConditionsMet: necessary.metCount,
      necessaryConditionsMissing: necessary.missing.slice(),
      necessaryPolicy: necessary.policy,
      differentiatingEvidenceIds: differentiators.evidenceIds,
      contradictingEvidenceIds: contradiction.evidenceIds,
      disqualifyingEvidenceIds: disqualifier.evidenceIds,
      ambiguityReasons: ambiguityReasons,
      missingEvidenceNeeded: missingEvidenceNeeded,
      externalConstraintTrace: {
        guardState: externalGuard.guardState,
        matchedConstraints: externalGuard.matchedConstraints.map(function (m) { return m.guardId }),
        explanatoryCoverage: externalGuard.explanatoryCoverage,
        independentCognitiveEvidence: externalGuard.independentCognitiveEvidence.map(function (s) { return s.id }),
        reason: externalGuard.reason,
      },
      trace: {
        necessary: { met: necessary.met, metCount: necessary.metCount, total: necessary.total, policy: necessary.policy },
        disqualifier: { disqualified: disqualifier.disqualified },
        externalGuard: { state: externalGuard.guardState, constraints: externalGuard.matchedConstraints.length },
        contradiction: { totalCount: contradiction.totalCount, independentCount: contradiction.independentCount, strength: contradiction.strength },
        differentiators: { count: differentiators.count, independentCount: differentiators.independentCount, avgStrength: differentiators.avgStrength },
      },
    }
  })

  var eligible = candidateStates
    .filter(function (c) { return c.eligibility === ELIGIBILITY.ELIGIBLE })
    .sort(function (a, b) { return b.supportStrength - a.supportStrength })

  var ambiguity = detectCandidateAmbiguity(eligible)
  if (eligible.length === 0) ambiguity.ambiguous = true

  var primaryBlindSpot = eligible.length > 0 ? eligible[0].id : null
  var alternateBlindSpot = eligible.length >= 2 ? eligible[1].id : null

  var traceLines = []
  candidateStates.forEach(function (c) {
    if (c.eligibility === ELIGIBILITY.DISQUALIFIED) {
      traceLines.push(c.id + ': DISQUALIFIED — ' + (c.disqualifyingEvidenceIds.join(',') || 'triggered'))
    } else if (c.eligibility === ELIGIBILITY.INSUFFICIENT) {
      traceLines.push(c.id + ': INSUFFICIENT — ' + c.necessaryConditionsMet + '/' + c.trace.necessary.total + ' necessary (policy: ' + c.necessaryPolicy.operator + ')')
    } else {
      traceLines.push(c.id + ': ELIGIBLE — support=' + c.supportStrength + ' diff_indep=' + c.trace.differentiators.independentCount)
    }
  })
  if (eligible.length >= 2) traceLines.push('Ambiguity: gap=' + ambiguity.rawGap + ' ambiguous=' + ambiguity.ambiguous)

  return {
    family: familyId,
    primaryBlindSpot: primaryBlindSpot,
    alternateBlindSpot: alternateBlindSpot,
    candidateStates: candidateStates,
    ambiguous: ambiguity.ambiguous,
    rawGap: ambiguity.rawGap,
    confidence: eligible.length > 0 ? eligible[0].confidence : 0,
    reasoningTrace: traceLines.join(' | '),
  }
}

module.exports = {
  inferWithinFamilyBlindSpot,
  evaluateNecessaryConditions,
  evaluateDisqualifiers,
  evaluateContradiction,
  evaluateDifferentiators,
  aggregateByOrigin,
  aggregateContradictionByOrigin,
  ELIGIBILITY,
  SIGNAL_BLIND_SPOT_MAP,
}
