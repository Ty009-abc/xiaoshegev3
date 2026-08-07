/**
 * engine/worldModel/withinFamilyBlindSpotInference.js
 *
 * RC8.3 C3-002B — Within-Family Blind Spot Selection.
 *
 * Boundary-first evaluation: for each candidate in the selected family,
 * execute necessaryConditions → disqualifiers → contradiction → differentiators
 * → ambiguity → ranking.
 *
 * C1 blindSpotBoundaryDefinitions.js is authoritative for all conditions.
 * C3 consumes them — does NOT redefine.
 *
 * HIERARCHY: Input family determines valid candidate set. No cross-family leakage.
 *
 * @version world_model_v3
 * @sprint c3-002b
 */

var { BLIND_SPOT_BOUNDARIES } = require('./blindSpotBoundaryDefinitions')
var { BLIND_SPOT_FAMILIES, getFamily } = require('./blindSpotFamilyDefinitions')

// ═══════════════════════════════════════════════════════════════
// CANDIDATE ELIGIBILITY STATES
// ═══════════════════════════════════════════════════════════════

var ELIGIBILITY = Object.freeze({
  ELIGIBLE: 'ELIGIBLE',
  INSUFFICIENT: 'INSUFFICIENT',
  DISQUALIFIED: 'DISQUALIFIED',
})

// ═══════════════════════════════════════════════════════════════
// EVIDENCE ORIGIN DEDUPLICATION
// ═══════════════════════════════════════════════════════════════

function getOrigin(signal) {
  return signal.originId || (signal.id || '')
}

function countIndependentSignals(signals) {
  var origins = {}
  signals.forEach(function (s) { origins[getOrigin(s)] = true })
  return Object.keys(origins).length
}

// ═══════════════════════════════════════════════════════════════
// SECONDARY SIGNAL → BLIND SPOT DIRECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Maps secondary signal IDs to which blind spots they support/weaken.
 * Derived from secondarySignalDefinitions.js differentiates field.
 */
var SIGNAL_BLIND_SPOT_MAP = Object.freeze({
  // EAG signals
  WAITING_DURATION_PATTERN: { supports: 'DECISION_INERTIA', weakens: 'FEEDBACK_LOOP_GAP' },
  MINIMUM_STEP_EXECUTION: { supports: 'FEEDBACK_LOOP_GAP', weakens: 'DECISION_INERTIA' },
  POST_ACTION_REVIEW_HABIT: { supports: 'FEEDBACK_LOOP_GAP', weakens: 'DECISION_INERTIA' },
  DECISION_TO_ACTION_LATENCY: { supports: 'FEEDBACK_LOOP_GAP', weakens: 'DECISION_INERTIA' },
  // RCG signals
  OUTPUT_DECOUPLING_AWARENESS: { supports: 'LEVERAGE_MODEL_GAP', weakens: 'TIME_HORIZON_TRAP' },
  EFFORT_VS_MECHANISM_FRAMING: { supports: 'LEVERAGE_MODEL_GAP', weakens: 'TIME_HORIZON_TRAP' },
  DIRECTION_SWITCHING_FREQUENCY: { supports: 'TIME_HORIZON_TRAP', weakens: 'LEVERAGE_MODEL_GAP' },
  LONG_TERM_COMPOUNDING_AWARENESS: { supports: 'TIME_HORIZON_TRAP', weakens: 'LEVERAGE_MODEL_GAP' },
  ALTERNATIVE_PATH_COST_AWARENESS: { supports: 'TIME_HORIZON_TRAP', weakens: 'LEVERAGE_MODEL_GAP' },
  // PRG/FRG signals (cross-family)
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
// NECESSARY CONDITION EVALUATION
// ═══════════════════════════════════════════════════════════════

/**
 * Evaluates necessary conditions for a candidate blind spot.
 * Each condition is checked against active secondary signals.
 *
 * Returns { met: boolean, missing: Array<number>, checks: Array }
 */
function evaluateNecessaryConditions(candidateId, secondarySignals) {
  var boundary = BLIND_SPOT_BOUNDARIES[candidateId]
  if (!boundary) return { met: false, missing: [0, 1, 2], checks: [] }

  var conditions = boundary.necessaryConditions
  var signalMap = buildSignalMap(secondarySignals)
  var checks = []
  var missingIndices = []

  conditions.forEach(function (cond, i) {
    var check = checkNecessaryCondition(candidateId, i, signalMap)
    checks.push(check)
    if (!check.met) missingIndices.push(i)
  })

  var metCount = conditions.length - missingIndices.length

  return {
    met: metCount >= 1,
    missing: missingIndices,
    checks: checks,
    total: conditions.length,
    metCount: metCount,
  }
}

function checkNecessaryCondition(candidateId, index, signalMap) {
  // Map condition index + candidate to specific secondary signal criteria
  var criteria = getNecessaryConditionCriteria(candidateId, index)
  var evidenceIds = []

  var met = criteria.every(function (c) {
    var sig = signalMap[c.signalId]
    if (!sig) return false
    if (sig.state !== 'ACTIVE') return false
    if (c.minScore && (sig.score || 0) < c.minScore) return false
    evidenceIds.push(c.signalId)
    return true
  })

  return { met: met, conditionIndex: index, evidenceIds: evidenceIds, description: criteria.map(function (c) { return c.signalId }).join(',') }
}

/**
 * Maps each candidate's necessary condition index to required secondary signal states.
 */
function getNecessaryConditionCriteria(candidateId, index) {
  var criteria = {
    DECISION_INERTIA: [
      [{ signalId: 'WAITING_DURATION_PATTERN', minScore: 0 }],
      [{ signalId: 'WAITING_DURATION_PATTERN', minScore: 40 }],
      [{ signalId: 'WAITING_DURATION_PATTERN', minScore: 50 }],
    ],
    FEEDBACK_LOOP_GAP: [
      [{ signalId: 'MINIMUM_STEP_EXECUTION', minScore: 0 }],
      [{ signalId: 'POST_ACTION_REVIEW_HABIT', minScore: 0 }],
      [{ signalId: 'DECISION_TO_ACTION_LATENCY', minScore: 0 }],
    ],
    LEVERAGE_MODEL_GAP: [
      [{ signalId: 'OUTPUT_DECOUPLING_AWARENESS', minScore: 0 }],
      [{ signalId: 'EFFORT_VS_MECHANISM_FRAMING', minScore: 0 }],
      [{ signalId: 'OUTPUT_DECOUPLING_AWARENESS', minScore: 40 }],
    ],
    TIME_HORIZON_TRAP: [
      [{ signalId: 'DIRECTION_SWITCHING_FREQUENCY', minScore: 0 }],
      [{ signalId: 'LONG_TERM_COMPOUNDING_AWARENESS', minScore: 0 }],
      [{ signalId: 'DIRECTION_SWITCHING_FREQUENCY', minScore: 40 }],
    ],
    OPPORTUNITY_BLINDNESS: [
      [{ signalId: 'INFORMATION_SOURCE_DIVERSITY', minScore: 0 }],
      [{ signalId: 'NON_DOMAIN_PATH_AWARENESS', minScore: 0 }],
      [{ signalId: 'SERENDIPITOUS_PATH_DISCOVERY', minScore: 0 }],
    ],
    RISK_MODEL_DISTORTION: [
      [{ signalId: 'EMOTIONAL_RECENCY_IMPACT', minScore: 0 }],
      [{ signalId: 'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', minScore: 0 }],
      [{ signalId: 'EMOTIONAL_RECENCY_IMPACT', minScore: 40 }],
    ],
    PROBABILITY_MISJUDGMENT: [
      [{ signalId: 'PROBABILISTIC_LANGUAGE_USAGE', minScore: 0 }],
      [{ signalId: 'LUCK_VS_SKILL_ATTRIBUTION', minScore: 0 }],
      [{ signalId: 'FEEDBACK_CALIBRATION_RATE', minScore: 0 }],
    ],
    IDENTITY_CONSTRAINT: [
      [{ signalId: 'IDENTITY_BASED_EXCLUSION', minScore: 0 }],
      [{ signalId: 'CROSS_IDENTITY_ATTEMPT_HISTORY', minScore: 0 }],
      [{ signalId: 'SELF_ASSESSMENT_ASYMMETRY', minScore: 0 }],
    ],
    SYSTEM_THINKING_GAP: [
      [{ signalId: 'FEEDBACK_LOOP_CONCEPT_AWARENESS', minScore: 0 }],
      [{ signalId: 'LINEARTY_VS_COMPLEXITY_DEFAULT', minScore: 0 }],
      [{ signalId: 'CROSS_DOMAIN_FEEDBACK_THINKING', minScore: 0 }],
    ],
  }

  var candidateCriteria = criteria[candidateId]
  if (!candidateCriteria || index >= candidateCriteria.length) return []
  return candidateCriteria[index]
}

// ═══════════════════════════════════════════════════════════════
// DISQUALIFIER EVALUATION
// ═══════════════════════════════════════════════════════════════

function evaluateDisqualifiers(candidateId, secondarySignals) {
  var signalMap = buildSignalMap(secondarySignals)

  // Disqualifier criteria: signal × state → disqualification
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
// CONTRADICTION EVALUATION
// ═══════════════════════════════════════════════════════════════

function evaluateContradiction(candidateId, secondarySignals) {
  var signals = secondarySignals.filter(function (s) {
    if (s.state !== 'SUPPRESSED') return false
    var map = SIGNAL_BLIND_SPOT_MAP[s.id]
    if (!map) return false
    return map.weakens === candidateId || map.supports === candidateId
  })

  var contradictingSignals = secondarySignals.filter(function (s) {
    var map = SIGNAL_BLIND_SPOT_MAP[s.id]
    if (!map) return false
    return map.weakens === candidateId && s.state === 'ACTIVE'
  })

  // Also: suppressed signals that support this candidate count as contradiction
  var suppressedSupport = secondarySignals.filter(function (s) {
    var map = SIGNAL_BLIND_SPOT_MAP[s.id]
    if (!map) return false
    return map.supports === candidateId && s.state === 'SUPPRESSED'
  })

  var allContradict = contradictingSignals.concat(suppressedSupport)
  var independentCount = countIndependentSignals(allContradict)

  return {
    hasContradiction: allContradict.length > 0,
    count: allContradict.length,
    independentCount: independentCount,
    evidenceIds: allContradict.map(function (s) { return s.id }),
    strength: independentCount >= 2 ? 'STRONG' : (allContradict.length > 0 ? 'MODERATE' : 'NONE'),
  }
}

// ═══════════════════════════════════════════════════════════════
// DIFFERENTIATOR EVALUATION
// ═══════════════════════════════════════════════════════════════

function evaluateDifferentiators(candidateId, secondarySignals) {
  var supporting = secondarySignals.filter(function (s) {
    if (s.state !== 'ACTIVE') return false
    var map = SIGNAL_BLIND_SPOT_MAP[s.id]
    if (!map) return false
    return map.supports === candidateId
  })

  var independentCount = countIndependentSignals(supporting)
  var totalScore = supporting.reduce(function (sum, s) { return sum + (s.score || 50) }, 0)

  return {
    count: supporting.length,
    independentCount: independentCount,
    evidenceIds: supporting.map(function (s) { return s.id }),
    totalScore: totalScore,
    avgScore: supporting.length > 0 ? Math.round(totalScore / supporting.length) : 0,
  }
}

// ═══════════════════════════════════════════════════════════════
// SUPPORT STRENGTH
// ═══════════════════════════════════════════════════════════════

function calculateSupportStrength(necessary, differentiators, contradiction, allSecondarySignals) {
  if (!necessary.met) return 0

  var diffScore = differentiators.avgScore
  var diffCountBonus = Math.min(differentiators.independentCount, 3) * 10
  var necessaryBonus = necessary.metCount * 10
  var contradictionPenalty = contradiction.independentCount * 20

  var raw = diffScore + diffCountBonus + necessaryBonus - contradictionPenalty
  return Math.max(0, Math.min(100, Math.round(raw)))
}

// ═══════════════════════════════════════════════════════════════
// CONFIDENCE
// ═══════════════════════════════════════════════════════════════

function calculateCandidateConfidence(necessary, differentiators, contradiction) {
  if (!necessary.met) return 0

  var necessaryConf = Math.min(necessary.metCount / necessary.total, 1) * 0.4
  var diffConf = Math.min(differentiators.independentCount / 3, 1) * 0.4
  var contraConf = contradiction.hasContradiction ? -0.2 : 0.1

  return Math.max(0, Math.min(1, Math.round((necessaryConf + diffConf + contraConf) * 100) / 100))
}

// ═══════════════════════════════════════════════════════════════
// AMBIGUITY
// ═══════════════════════════════════════════════════════════════

function detectCandidateAmbiguity(eligible) {
  if (eligible.length < 2) return { ambiguous: false, rawGap: 0 }

  var top = eligible[0]
  var second = eligible[1]
  var rawGap = Math.round((top.supportStrength - second.supportStrength) * 100) / 100

  var ambiguous = rawGap < 10 || (rawGap < 20 && top.supportStrength < 40)

  return { ambiguous: ambiguous, rawGap: rawGap }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function buildSignalMap(secondarySignals) {
  var map = {}
  secondarySignals.forEach(function (s) { map[s.id] = s })
  return map
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════

function inferWithinFamilyBlindSpot(input) {
  if (!input) input = {}
  var familyId = input.family
  var secondarySignals = input.secondarySignals || []

  var family = getFamily(familyId)
  if (!family) {
    return {
      family: familyId,
      primaryBlindSpot: null,
      alternateBlindSpot: null,
      candidateStates: [],
      ambiguous: true,
      rawGap: 0,
      confidence: 0,
      reasoningTrace: 'Unknown family: ' + familyId,
    }
  }

  var candidates = family.candidates

  // ── Evaluate each candidate through boundary pipeline ──

  var candidateStates = candidates.map(function (candidateId) {
    var necessary = evaluateNecessaryConditions(candidateId, secondarySignals)
    var disqualifier = evaluateDisqualifiers(candidateId, secondarySignals)
    var contradiction = evaluateContradiction(candidateId, secondarySignals)
    var differentiators = evaluateDifferentiators(candidateId, secondarySignals)

    // Determine eligibility
    var eligibility
    if (disqualifier.disqualified) {
      eligibility = ELIGIBILITY.DISQUALIFIED
    } else if (!necessary.met) {
      eligibility = ELIGIBILITY.INSUFFICIENT
    } else {
      eligibility = ELIGIBILITY.ELIGIBLE
    }

    var supportStrength = calculateSupportStrength(necessary, differentiators, contradiction, secondarySignals)
    var confidence = calculateCandidateConfidence(necessary, differentiators, contradiction)

    var missingEvidenceNeeded = []
    if (!necessary.met) {
      necessary.missing.forEach(function (i) {
        missingEvidenceNeeded.push('Missing necessary condition ' + (i + 1))
      })
    }

    var ambiguityReasons = []
    if (eligibility === ELIGIBILITY.ELIGIBLE && contradiction.independentCount >= 1) {
      ambiguityReasons.push('Contradiction present: ' + contradiction.count + ' items')
    }
    if (eligibility === ELIGIBILITY.ELIGIBLE && differentiators.independentCount < 2) {
      ambiguityReasons.push('Few independent differentiators: ' + differentiators.independentCount)
    }

    return {
      id: candidateId,
      eligibility: eligibility,
      supportStrength: supportStrength,
      confidence: confidence,
      necessaryConditionsMet: necessary.metCount,
      necessaryConditionsMissing: necessary.missing.slice(),
      differentiatingEvidenceIds: differentiators.evidenceIds,
      contradictingEvidenceIds: contradiction.evidenceIds,
      disqualifyingEvidenceIds: disqualifier.evidenceIds,
      ambiguityReasons: ambiguityReasons,
      missingEvidenceNeeded: missingEvidenceNeeded,
      trace: {
        necessary: { met: necessary.met, metCount: necessary.metCount, total: necessary.total },
        disqualifier: { disqualified: disqualifier.disqualified },
        contradiction: { count: contradiction.count, independentCount: contradiction.independentCount, strength: contradiction.strength },
        differentiators: { count: differentiators.count, independentCount: differentiators.independentCount },
      },
    }
  })

  // ── Rank eligible candidates ──

  var eligible = candidateStates
    .filter(function (c) { return c.eligibility === ELIGIBILITY.ELIGIBLE })
    .sort(function (a, b) { return b.supportStrength - a.supportStrength })

  var ambiguity = detectCandidateAmbiguity(eligible)
  if (eligible.length === 0) ambiguity.ambiguous = true

  var primaryBlindSpot = eligible.length > 0 ? eligible[0].id : null
  var alternateBlindSpot = null
  if (eligible.length >= 2) {
    alternateBlindSpot = eligible[1].id
  } else if (eligible.length === 1) {
    // Look for best alternate among non-eligible
    var nonEligible = candidateStates
      .filter(function (c) { return c.eligibility !== ELIGIBILITY.ELIGIBLE })
      .sort(function (a, b) { return b.supportStrength - a.supportStrength })
    if (nonEligible.length > 0) alternateBlindSpot = nonEligible[0].id
  }

  // ── Build reasoning trace ──

  var traceLines = []
  candidateStates.forEach(function (c) {
    if (c.eligibility === ELIGIBILITY.DISQUALIFIED) {
      traceLines.push(c.id + ': DISQUALIFIED — ' + (c.disqualifyingEvidenceIds.join(', ') || 'disqualifier triggered'))
    } else if (c.eligibility === ELIGIBILITY.INSUFFICIENT) {
      traceLines.push(c.id + ': INSUFFICIENT — met ' + c.necessaryConditionsMet + '/' + c.trace.necessary.total + ' conditions')
    } else {
      traceLines.push(c.id + ': ELIGIBLE — support=' + c.supportStrength + ' conf=' + c.confidence + ' diff=' + c.differentiatingEvidenceIds.length + ' contra=' + c.contradictingEvidenceIds.length)
    }
  })

  if (eligible.length >= 2) {
    traceLines.push('Ambiguity: gap=' + ambiguity.rawGap + ' ambiguous=' + ambiguity.ambiguous)
  }

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

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  inferWithinFamilyBlindSpot,
  evaluateNecessaryConditions,
  evaluateDisqualifiers,
  evaluateContradiction,
  evaluateDifferentiators,
  ELIGIBILITY,
  SIGNAL_BLIND_SPOT_MAP,
}
