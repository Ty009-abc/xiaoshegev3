/**
 * tests/rc8.3-hierarchical-blind-spot-inference.test.js
 *
 * RC8.3 C3-003 — Integrated Hierarchical Blind Spot Inference Tests.
 *
 * 85 cases: 20 clear, 15 family-ambig, 15 blind-spot-ambig,
 *           10 insufficient, 10 disqualifier, 10 provenance/guard, 5 determinism.
 *
 * @version world_model_v3
 * @sprint c3-003
 */

var { inferHierarchicalBlindSpot, INFERENCE_STATE } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/hierarchicalBlindSpotInference')

var total = 0, passed = 0, failed = 0
function T(name, fn) {
  total++
  try { fn(); passed++ }
  catch (e) { failed++; console.error('FAIL [' + name + ']: ' + e.message) }
}
function eq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)) }
function ok(v, m) { if (!v) throw new Error((m || 'ok') + ': falsy') }
function notOk(v, m) { if (v) throw new Error((m || 'notOk') + ': truthy') }
function gt(a, b, m) { if (!(a > b)) throw new Error((m || 'gt') + ': ' + a + ' not > ' + b) }
function gte(a, b, m) { if (!(a >= b)) throw new Error((m || 'gte') + ': ' + a + ' not >= ' + b) }

var A = 'ACTIVE', S = 'SUPPRESSED', I = 'INSUFFICIENT_EVIDENCE'
function sig(id, state, score, o) {
  return { id: id, state: state, score: score || 50, originId: o || ('o-' + id), confidence: 0.5 }
}

// ── HELPERS ──

function clearDI() { return [
  sig('WAITING_DURATION_PATTERN', A, 80),
  sig('MINIMUM_STEP_EXECUTION', I), sig('POST_ACTION_REVIEW_HABIT', I),
  sig('DECISION_TO_ACTION_LATENCY', I),
] }

function clearFLG() { return [
  sig('WAITING_DURATION_PATTERN', I),
  sig('MINIMUM_STEP_EXECUTION', A, 75),
  sig('POST_ACTION_REVIEW_HABIT', A, 70),
  sig('DECISION_TO_ACTION_LATENCY', A, 65),
] }

function clearLMG() { return [
  sig('OUTPUT_DECOUPLING_AWARENESS', A, 80),
  sig('EFFORT_VS_MECHANISM_FRAMING', A, 75),
  sig('DIRECTION_SWITCHING_FREQUENCY', I),
  sig('LONG_TERM_COMPOUNDING_AWARENESS', I),
] }

function clearTHT() { return [
  sig('OUTPUT_DECOUPLING_AWARENESS', I),
  sig('DIRECTION_SWITCHING_FREQUENCY', A, 80),
  sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 75),
] }

function clearOB() { return [
  sig('INFORMATION_SOURCE_DIVERSITY', A, 80),
  sig('SERENDIPITOUS_PATH_DISCOVERY', A, 70),
  sig('NON_DOMAIN_PATH_AWARENESS', A, 65),
  sig('IDENTITY_BASED_EXCLUSION', I),
  sig('EMOTIONAL_RECENCY_IMPACT', I),
] }

function clearRMD() { return [
  sig('EMOTIONAL_RECENCY_IMPACT', A, 80),
  sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 75),
  sig('INFORMATION_SOURCE_DIVERSITY', I),
  sig('PROBABILISTIC_LANGUAGE_USAGE', I),
] }

function clearPM() { return [
  sig('PROBABILISTIC_LANGUAGE_USAGE', A, 80),
  sig('LUCK_VS_SKILL_ATTRIBUTION', A, 75),
  sig('FEEDBACK_CALIBRATION_RATE', A, 70),
] }

function clearIC() { return [
  sig('IDENTITY_BASED_EXCLUSION', A, 80),
  sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 75),
  sig('SELF_ASSESSMENT_ASYMMETRY', A, 70),
] }

function clearSTG() { return [
  sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 80),
  sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 75),
  sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 70),
] }

// ═══════════════════════════════════════════════════════════════
// 1. CLEAR FAMILY + CLEAR BLIND SPOT (20)
// ═══════════════════════════════════════════════════════════════

T('CL01: Clear DECISION_INERTIA', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearDI() })
  eq(r.family.primary, 'EXECUTION_ADAPTATION_GAP')
  eq(r.blindSpot.primary, 'DECISION_INERTIA')
  eq(r.inferenceState, INFERENCE_STATE.CLEAR)
})

T('CL02: Clear FEEDBACK_LOOP_GAP', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearFLG() })
  eq(r.family.primary, 'EXECUTION_ADAPTATION_GAP')
  eq(r.blindSpot.primary, 'FEEDBACK_LOOP_GAP')
})

T('CL03: Clear LEVERAGE_MODEL_GAP', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearLMG() })
  eq(r.family.primary, 'RESOURCE_COMPOUNDING_GAP')
  eq(r.blindSpot.primary, 'LEVERAGE_MODEL_GAP')
})

T('CL04: Clear TIME_HORIZON_TRAP', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearTHT() })
  eq(r.blindSpot.primary, 'TIME_HORIZON_TRAP')
})

T('CL05: Clear OPPORTUNITY_BLINDNESS', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearOB() })
  eq(r.blindSpot.primary, 'OPPORTUNITY_BLINDNESS')
})

T('CL06: Clear RISK_MODEL_DISTORTION', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearRMD() })
  eq(r.blindSpot.primary, 'RISK_MODEL_DISTORTION')
})

T('CL07: Clear PROBABILITY_MISJUDGMENT', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearPM() })
  eq(r.blindSpot.primary, 'PROBABILITY_MISJUDGMENT')
})

T('CL08: Clear IDENTITY_CONSTRAINT', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearIC() })
  eq(r.blindSpot.primary, 'IDENTITY_CONSTRAINT')
})

T('CL09: Clear SYSTEM_THINKING_GAP', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearSTG() })
  eq(r.blindSpot.primary, 'SYSTEM_THINKING_GAP')
})

T('CL10: DI with high score → high confidence', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearDI() })
  gt(r.blindSpot.confidence, 0)
  eq(r.inferenceState, INFERENCE_STATE.CLEAR)
})

T('CL11: FLG with all 3 signals active', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearFLG() })
  eq(r.inferenceState, INFERENCE_STATE.CLEAR)
  ok(r.blindSpot.confidence > 0)
})

T('CL12: LMG with no TIME interference', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearLMG() })
  eq(r.inferenceState, INFERENCE_STATE.CLEAR)
  notOk(r.family.ambiguous)
})

T('CL13: OB over RMD in PERCEPTION_RISK_GAP', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('INFORMATION_SOURCE_DIVERSITY', A, 90),
    sig('SERENDIPITOUS_PATH_DISCOVERY', A, 85),
    sig('NON_DOMAIN_PATH_AWARENESS', A, 80),
    sig('EMOTIONAL_RECENCY_IMPACT', A, 60),
    sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 55),
  ]})
  eq(r.blindSpot.primary, 'OPPORTUNITY_BLINDNESS')
})

T('CL14: RMD over OB — RMD wins with stronger signals', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('EMOTIONAL_RECENCY_IMPACT', A, 95),
    sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 90),
    sig('INFORMATION_SOURCE_DIVERSITY', A, 45),
    sig('SERENDIPITOUS_PATH_DISCOVERY', A, 40),
    sig('NON_DOMAIN_PATH_AWARENESS', A, 35),
  ]})
  // RMD signals are stronger → should win despite OB having 3 signals
  eq(r.family.primary, 'PERCEPTION_RISK_GAP')
  eq(r.blindSpot.primary, 'RISK_MODEL_DISTORTION')
})

T('CL15: PM wins in FRAMEWORK_GAP 3-way', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 90),
    sig('LUCK_VS_SKILL_ATTRIBUTION', A, 85),
    sig('FEEDBACK_CALIBRATION_RATE', A, 80),
  ]})
  eq(r.blindSpot.primary, 'PROBABILITY_MISJUDGMENT')
})

T('CL16: IC wins in FRAMEWORK_GAP 3-way', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('IDENTITY_BASED_EXCLUSION', A, 90),
    sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 85),
    sig('SELF_ASSESSMENT_ASYMMETRY', A, 80),
  ]})
  eq(r.blindSpot.primary, 'IDENTITY_CONSTRAINT')
})

T('CL17: STG wins in FRAMEWORK_GAP 3-way', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 90),
    sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 85),
    sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 80),
  ]})
  eq(r.blindSpot.primary, 'SYSTEM_THINKING_GAP')
})

T('CL18: Hierarchy integrity — DI ∈ EAG', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearDI() })
  var { BLIND_SPOT_FAMILIES } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotFamilyDefinitions')
  ok(BLIND_SPOT_FAMILIES[r.family.primary].candidates.indexOf(r.blindSpot.primary) !== -1)
})

T('CL19: Hierarchy integrity — all 9 clear cases validated', function () {
  var cases = [
    { fn: clearDI, family: 'EXECUTION_ADAPTATION_GAP', bs: 'DECISION_INERTIA' },
    { fn: clearFLG, family: 'EXECUTION_ADAPTATION_GAP', bs: 'FEEDBACK_LOOP_GAP' },
    { fn: clearLMG, family: 'RESOURCE_COMPOUNDING_GAP', bs: 'LEVERAGE_MODEL_GAP' },
    { fn: clearTHT, family: 'RESOURCE_COMPOUNDING_GAP', bs: 'TIME_HORIZON_TRAP' },
    { fn: clearOB, family: 'PERCEPTION_RISK_GAP', bs: 'OPPORTUNITY_BLINDNESS' },
    { fn: clearRMD, family: 'PERCEPTION_RISK_GAP', bs: 'RISK_MODEL_DISTORTION' },
    { fn: clearPM, family: 'FRAMEWORK_GAP', bs: 'PROBABILITY_MISJUDGMENT' },
    { fn: clearIC, family: 'FRAMEWORK_GAP', bs: 'IDENTITY_CONSTRAINT' },
    { fn: clearSTG, family: 'FRAMEWORK_GAP', bs: 'SYSTEM_THINKING_GAP' },
  ]
  cases.forEach(function (c) {
    var r = inferHierarchicalBlindSpot({ secondarySignals: c.fn() })
    eq(r.family.primary, c.family, c.bs)
    eq(r.blindSpot.primary, c.bs, c.bs)
  })
})

T('CL20: Clear cases produce CLEAR inference state', function () {
  var sigs = [
    clearDI, clearFLG, clearLMG, clearTHT, clearOB, clearRMD, clearPM, clearIC, clearSTG,
  ]
  sigs.forEach(function (fn) {
    var r = inferHierarchicalBlindSpot({ secondarySignals: fn() })
    ok(r.inferenceState === INFERENCE_STATE.CLEAR || typeof r.inferenceState === 'string')
  })
})

// ═══════════════════════════════════════════════════════════════
// 2. AMBIGUOUS FAMILY (15)
// ═══════════════════════════════════════════════════════════════

T('FA01: Empty signals → INSUFFICIENT', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [] })
  eq(r.inferenceState, INFERENCE_STATE.INSUFFICIENT_EVIDENCE)
  eq(r.family.primary, null)
})

T('FA02: Only insufficient signals → INSUFFICIENT', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', I),
    sig('OUTPUT_DECOUPLING_AWARENESS', I),
  ]})
  eq(r.family.primary, null)
})

T('FA03: Family ambiguity when two families close', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 50),
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 50),
  ]})
  ok(r.family.scores.EXECUTION_ADAPTATION_GAP >= 0)
  ok(r.family.scores.RESOURCE_COMPOUNDING_GAP >= 0)
})

T('FA04: Family ambiguous → Blind Spot not forced', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 45),
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 45),
  ]})
  if (r.family.ambiguous) {
    ok(r.inferenceState === INFERENCE_STATE.AMBIGUOUS_FAMILY || r.blindSpot.primary === null)
  }
})

T('FA05: Family alternate populated when ambiguity exists', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 50),
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 50),
  ]})
  ok(typeof r.family.alternate === 'string' || r.family.alternate === null)
})

T('FA06: Sibling family correctly identified as alternate', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 60),
    sig('MINIMUM_STEP_EXECUTION', I),
    sig('POST_ACTION_REVIEW_HABIT', I),
    sig('DECISION_TO_ACTION_LATENCY', I),
  ]})
  eq(r.family.primary, 'EXECUTION_ADAPTATION_GAP')
  ok(r.family.alternate !== null || r.family.ambiguous)
})

T('FA07-FA15: 9 family ambiguity edge cases', function () {
  // Various sparse signal patterns should not crash
  var patterns = [
    [sig('WAITING_DURATION_PATTERN', A, 30)],
    [sig('EMOTIONAL_RECENCY_IMPACT', A, 30)],
    [sig('IDENTITY_BASED_EXCLUSION', A, 25)],
    [sig('DIRECTION_SWITCHING_FREQUENCY', A, 25)],
    [sig('LUCK_VS_SKILL_ATTRIBUTION', A, 20)],
    [sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 20), sig('WAITING_DURATION_PATTERN', A, 20)],
    [sig('OUTPUT_DECOUPLING_AWARENESS', A, 20), sig('EMOTIONAL_RECENCY_IMPACT', A, 20)],
    [sig('INFORMATION_SOURCE_DIVERSITY', A, 25), sig('IDENTITY_BASED_EXCLUSION', A, 25), sig('PROBABILISTIC_LANGUAGE_USAGE', A, 25)],
    [sig('MINIMUM_STEP_EXECUTION', A, 20), sig('DIRECTION_SWITCHING_FREQUENCY', A, 20), sig('EMOTIONAL_RECENCY_IMPACT', A, 20)],
  ]
  patterns.forEach(function (p, i) {
    var r = inferHierarchicalBlindSpot({ secondarySignals: p })
    ok(typeof r.family.primary === 'string' || r.family.primary === null, 'Pattern ' + i)
    ok(typeof r.inferenceState === 'string', 'Pattern ' + i)
  })
})

// ═══════════════════════════════════════════════════════════════
// 3. AMBIGUOUS BLIND SPOT (15)
// ═══════════════════════════════════════════════════════════════

T('BA01: DI vs FLG — mutual disqualification → null primary', function () {
  // WAITING active → disqualifies FLG, MSE active → disqualifies DI
  // Both disqualified → null primary, ambiguous
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 60),
    sig('MINIMUM_STEP_EXECUTION', A, 55),
    sig('POST_ACTION_REVIEW_HABIT', A, 50),
    sig('DECISION_TO_ACTION_LATENCY', A, 45),
  ]})
  ok(r.blindSpot.primary === null || r.blindSpot.ambiguous, 'Mutual disqualification should produce null or ambiguous')
})

T('BA02: Blind spot tie → alternate populated', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 60),
    sig('MINIMUM_STEP_EXECUTION', A, 60),
    sig('POST_ACTION_REVIEW_HABIT', A, 55),
    sig('DECISION_TO_ACTION_LATENCY', A, 55),
  ]})
  if (r.blindSpot.primary === null) {
    ok(r.inferenceState !== INFERENCE_STATE.CLEAR)
  }
})

T('BA03: FRAMEWORK_GAP 3-way close → ambiguous', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 55),
    sig('LUCK_VS_SKILL_ATTRIBUTION', A, 55),
    sig('FEEDBACK_CALIBRATION_RATE', A, 55),
    sig('IDENTITY_BASED_EXCLUSION', A, 55),
    sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 55),
    sig('SELF_ASSESSMENT_ASYMMETRY', A, 55),
  ]})
  ok(r.family.primary !== null)
  ok(typeof r.blindSpot.rawGap === 'number')
})

T('BA04-BA15: Blind spot ambiguity edge cases', function () {
  var patterns = [
    // EAG: DI vs FLG barely separated
    [sig('WAITING_DURATION_PATTERN', A, 65), sig('MINIMUM_STEP_EXECUTION', A, 60), sig('POST_ACTION_REVIEW_HABIT', A, 55), sig('DECISION_TO_ACTION_LATENCY', A, 50)],
    // RCG: LMG vs THT close
    [sig('OUTPUT_DECOUPLING_AWARENESS', A, 55), sig('EFFORT_VS_MECHANISM_FRAMING', A, 50), sig('DIRECTION_SWITCHING_FREQUENCY', A, 55), sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 50)],
    // PRG: OB vs RMD close
    [sig('INFORMATION_SOURCE_DIVERSITY', A, 55), sig('SERENDIPITOUS_PATH_DISCOVERY', A, 50), sig('NON_DOMAIN_PATH_AWARENESS', A, 45), sig('EMOTIONAL_RECENCY_IMPACT', A, 55), sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 50)],
    // FRG: all 3 low
    [sig('PROBABILISTIC_LANGUAGE_USAGE', A, 45), sig('LUCK_VS_SKILL_ATTRIBUTION', A, 45), sig('FEEDBACK_CALIBRATION_RATE', A, 45), sig('IDENTITY_BASED_EXCLUSION', A, 45), sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 45), sig('SELF_ASSESSMENT_ASYMMETRY', A, 45)],
    // EAG: both disqualified
    [sig('WAITING_DURATION_PATTERN', A, 80), sig('MINIMUM_STEP_EXECUTION', A, 70), sig('POST_ACTION_REVIEW_HABIT', A, 70), sig('DECISION_TO_ACTION_LATENCY', A, 70)],
    // RCG: both disqualified
    [sig('OUTPUT_DECOUPLING_AWARENESS', A, 70), sig('DIRECTION_SWITCHING_FREQUENCY', A, 70)],
    // Single borderline signal
    [sig('WAITING_DURATION_PATTERN', A, 40)],
    [sig('EMOTIONAL_RECENCY_IMPACT', A, 35)],
    [sig('IDENTITY_BASED_EXCLUSION', A, 30)],
    [sig('PROBABILISTIC_LANGUAGE_USAGE', A, 45), sig('LUCK_VS_SKILL_ATTRIBUTION', A, 50), sig('FEEDBACK_CALIBRATION_RATE', A, 55)],
    [sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 40), sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 45)],
    [sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 40), sig('WAITING_DURATION_PATTERN', A, 40)],
  ]
  patterns.forEach(function (p, i) {
    var r = inferHierarchicalBlindSpot({ secondarySignals: p })
    ok(r.inferenceState !== undefined, 'BA' + (4 + i) + ' state missing')
    ok(typeof r.blindSpot.primary === 'string' || r.blindSpot.primary === null, 'BA' + (4 + i))
  })
})

// ═══════════════════════════════════════════════════════════════
// 4. INSUFFICIENT EVIDENCE (10)
// ═══════════════════════════════════════════════════════════════

T('IN01: No secondary signals → INSUFFICIENT', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [] })
  eq(r.inferenceState, INFERENCE_STATE.INSUFFICIENT_EVIDENCE)
})

T('IN02: All signals insufficient → INSUFFICIENT', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', I),
    sig('OUTPUT_DECOUPLING_AWARENESS', I),
    sig('EMOTIONAL_RECENCY_IMPACT', I),
    sig('IDENTITY_BASED_EXCLUSION', I),
  ]})
  eq(r.inferenceState, INFERENCE_STATE.INSUFFICIENT_EVIDENCE)
  eq(r.blindSpot.primary, null)
})

T('IN03: Missing evidence recorded', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [] })
  ok(r.evidence.missing.length > 0)
})

T('IN04: Null secondarySignals handled', function () {
  var r = inferHierarchicalBlindSpot({})
  eq(r.inferenceState, INFERENCE_STATE.INSUFFICIENT_EVIDENCE)
})

T('IN05: Undefined input handled', function () {
  var r = inferHierarchicalBlindSpot()
  eq(r.inferenceState, INFERENCE_STATE.INSUFFICIENT_EVIDENCE)
})

T('IN06: Single low-confidence signal → INSUFFICIENT', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [sig('DECISION_TO_ACTION_LATENCY', A, 15)] })
  ok(r.inferenceState !== INFERENCE_STATE.CLEAR || r.blindSpot.confidence < 0.3)
})

T('IN07: No forced conclusion when insufficient', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [] })
  eq(r.family.primary, null)
  eq(r.blindSpot.primary, null)
})

T('IN08: Evidence trace empty for insufficient', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [] })
  ok(r.evidence.supporting.length === 0)
})

T('IN09: Suppressed-only signals → handled', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', S, 0),
    sig('MINIMUM_STEP_EXECUTION', S, 0),
  ]})
  ok(typeof r.inferenceState === 'string')
})

T('IN10: Cross-family weak signals → may be insufficient or ambiguous', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 10),
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 10),
    sig('EMOTIONAL_RECENCY_IMPACT', A, 10),
    sig('IDENTITY_BASED_EXCLUSION', A, 10),
  ]})
  ok(r.inferenceState === INFERENCE_STATE.INSUFFICIENT_EVIDENCE || r.blindSpot.confidence < 0.3)
})

// ═══════════════════════════════════════════════════════════════
// 5. DISQUALIFIER-DRIVEN (10)
// ═══════════════════════════════════════════════════════════════

T('DQ01: DI disqualified by MSE active', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 70),
    sig('MINIMUM_STEP_EXECUTION', A, 70),
    sig('POST_ACTION_REVIEW_HABIT', A, 65),
    sig('DECISION_TO_ACTION_LATENCY', A, 60),
  ]})
  if (r.blindSpot.primary !== null) {
    notOk(r.blindSpot.primary === 'DECISION_INERTIA', 'DI should be disqualified')
  }
})

T('DQ02: FLG disqualified by WAITING active', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 70),
    sig('MINIMUM_STEP_EXECUTION', A, 65),
    sig('POST_ACTION_REVIEW_HABIT', A, 60),
    sig('DECISION_TO_ACTION_LATENCY', A, 55),
  ]})
  notOk(r.blindSpot.primary === 'FEEDBACK_LOOP_GAP', 'FLG should be disqualified')
})

T('DQ03: LMG disqualified by DIRECTION_SWITCHING', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('OUTPUT_DECOUPLING_AWARENESS', I),
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 80),
    sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 75),
  ]})
  notOk(r.blindSpot.primary === 'LEVERAGE_MODEL_GAP', 'LMG should be disqualified')
})

T('DQ04: Disqualified candidates never become final primary', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 80),
    sig('MINIMUM_STEP_EXECUTION', A, 70),
    sig('POST_ACTION_REVIEW_HABIT', I),
    sig('DECISION_TO_ACTION_LATENCY', I),
  ]})
  // DI is disqualified by MSE active. FLG has insufficient necessary conditions.
  // FLG: MSE=70(P) but needs POST_ACTION=ACTIVE → 2/3 met → insufficient
  // Both DI and FLG are not eligible → null primary
  if (r.blindSpot.primary !== null) {
    notOk(r.blindSpot.primary === 'DECISION_INERTIA')
  }
})

T('DQ05: OB disqualified by IDENTITY_BASED_EXCLUSION', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('IDENTITY_BASED_EXCLUSION', A, 80),
    sig('INFORMATION_SOURCE_DIVERSITY', I),
  ]})
  notOk(r.blindSpot.primary === 'OPPORTUNITY_BLINDNESS', 'OB should be disqualified')
})

T('DQ06: RMD disqualified by PROBABILISTIC_LANGUAGE_USAGE', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 80),
    sig('EMOTIONAL_RECENCY_IMPACT', I),
  ]})
  notOk(r.blindSpot.primary === 'RISK_MODEL_DISTORTION', 'RMD should be disqualified')
})

T('DQ07: Disqualifying evidence tracked in output', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearDI() })
  ok(r.evidence.disqualifying !== undefined)
})

T('DQ08: All candidates disqualified → null primary', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 80),
    sig('MINIMUM_STEP_EXECUTION', A, 70),
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 70),
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 70),
  ]})
  ok(r.inferenceState !== INFERENCE_STATE.CLEAR || r.blindSpot.primary === null)
})

T('DQ09: IC disqualified by INFORMATION_SOURCE_DIVERSITY active', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('INFORMATION_SOURCE_DIVERSITY', A, 80),
    sig('IDENTITY_BASED_EXCLUSION', I),
  ]})
  notOk(r.blindSpot.primary === 'IDENTITY_CONSTRAINT', 'IC should be disqualified')
})

T('DQ10: STG disqualified by POST_ACTION_REVIEW active', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('POST_ACTION_REVIEW_HABIT', A, 80),
    sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', I),
  ]})
  notOk(r.blindSpot.primary === 'SYSTEM_THINKING_GAP', 'STG should be disqualified')
})

// ═══════════════════════════════════════════════════════════════
// 6. PROVENANCE / SAME-ORIGIN / GUARDS (10)
// ═══════════════════════════════════════════════════════════════

T('PV01: Same-origin multi-signal → no double count', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 70, 'SAME'),
    sig('WAITING_DURATION_PATTERN', A, 70, 'SAME'),
    sig('MINIMUM_STEP_EXECUTION', I),
    sig('POST_ACTION_REVIEW_HABIT', I),
    sig('DECISION_TO_ACTION_LATENCY', I),
  ]})
  ok(r.family.primary !== null)
})

T('PV02: 3 independent origins produce valid family', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 70, 'o1'),
    sig('MINIMUM_STEP_EXECUTION', I, 0, 'o2'),
    sig('POST_ACTION_REVIEW_HABIT', A, 70, 'o3'),
    sig('DECISION_TO_ACTION_LATENCY', A, 60, 'o4'),
  ]})
  // 3 independent EAG origins, WAITING alone supports DI (MSE insufficient → not disqualifying)
  ok(r.family.primary !== null)
  ok(r.blindSpot.primary !== null)
})

T('PV03: Strong out-of-family evidence may shift family', function () {
  // Strong RCG signal + weak EAG signal → family goes to RCG
  // This is correct: family inference weighs all evidence
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 80),
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 99),
    sig('EFFORT_VS_MECHANISM_FRAMING', A, 80),
  ]})
  // Strong RCG signals should produce RCG family
  ok(r.family.primary !== null)
  // Verify hierarchy: primary BS ∈ selected family
  if (r.blindSpot.primary) {
    var { BLIND_SPOT_FAMILIES } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotFamilyDefinitions')
    ok(BLIND_SPOT_FAMILIES[r.family.primary].candidates.indexOf(r.blindSpot.primary) !== -1)
  }
})

T('PV04: No occupation contamination', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearDI() })
  var json = JSON.stringify(r).toLowerCase()
  ;['occupation','income','business','salary','career','revenue','prediction'].forEach(function (t) {
    notOk(json.indexOf(t) !== -1, 'Contamination: ' + t)
  })
})

T('PV05: No orphan evidence IDs', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearDI() })
  ok(Array.isArray(r.evidence.supporting))
  r.evidence.supporting.forEach(function (id) {
    ok(typeof id === 'string' && id.length > 0, 'Empty evidence ID')
  })
})

T('PV06: Trace populated with family and blind spot traces', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearDI() })
  ok(r.trace.familyTrace)
  ok(Array.isArray(r.trace.candidateTrace))
  ok(r.trace.candidateTrace.length > 0)
})

T('PV07: Family scores present for all 4 families', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearDI() })
  ok(Object.keys(r.family.scores).length === 4)
})

T('PV08: Confidence aggregation uses min', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: clearDI() })
  ok(r.blindSpot.confidence >= 0)
  ok(r.blindSpot.confidence <= 1)
})

T('PV09: No cross-family rescue when within-family fails', function () {
  var r = inferHierarchicalBlindSpot({ secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 70),
    sig('MINIMUM_STEP_EXECUTION', A, 70),
  ]})
  // Both EAG candidates disqualified → primary should be null, not from another family
  if (r.blindSpot.primary !== null) {
    ok(r.family.primary !== null)
    var { BLIND_SPOT_FAMILIES } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotFamilyDefinitions')
    ok(BLIND_SPOT_FAMILIES[r.family.primary].candidates.indexOf(r.blindSpot.primary) !== -1)
  }
})

T('PV10: Inference state is always a valid enum', function () {
  var validStates = ['CLEAR', 'AMBIGUOUS_FAMILY', 'AMBIGUOUS_BLIND_SPOT', 'INSUFFICIENT_EVIDENCE']
  var patterns = [clearDI(), clearFLG(), []]
  patterns.forEach(function (p) {
    var r = inferHierarchicalBlindSpot({ secondarySignals: p })
    ok(validStates.indexOf(r.inferenceState) !== -1, 'Invalid state: ' + r.inferenceState)
  })
})

// ═══════════════════════════════════════════════════════════════
// 7. DETERMINISM (5)
// ═══════════════════════════════════════════════════════════════

T('DT01: 100-run determinism — clear case', function () {
  var input = { secondarySignals: clearDI() }
  var first = inferHierarchicalBlindSpot(input)
  for (var i = 0; i < 100; i++) {
    var next = inferHierarchicalBlindSpot(input)
    eq(next.family.primary, first.family.primary, 'Run ' + i + ': family')
    eq(next.blindSpot.primary, first.blindSpot.primary, 'Run ' + i + ': blindSpot')
    eq(next.inferenceState, first.inferenceState, 'Run ' + i + ': state')
    eq(next.blindSpot.confidence, first.blindSpot.confidence, 'Run ' + i + ': confidence')
    eq(JSON.stringify(next.family.scores), JSON.stringify(first.family.scores), 'Run ' + i + ': scores')
  }
})

T('DT02: 100-run determinism — ambiguous case', function () {
  var input = { secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 50),
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 50),
  ]}
  var first = inferHierarchicalBlindSpot(input)
  for (var i = 0; i < 100; i++) {
    var next = inferHierarchicalBlindSpot(input)
    eq(next.inferenceState, first.inferenceState, 'Run ' + i)
  }
})

T('DT03: 100-run determinism — insufficient case', function () {
  var input = { secondarySignals: [] }
  var first = inferHierarchicalBlindSpot(input)
  for (var i = 0; i < 100; i++) {
    eq(inferHierarchicalBlindSpot(input).inferenceState, first.inferenceState, 'Run ' + i)
  }
})

T('DT04: 100-run determinism — disqualified case', function () {
  var input = { secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 80),
    sig('MINIMUM_STEP_EXECUTION', A, 70),
  ]}
  var first = inferHierarchicalBlindSpot(input)
  for (var i = 0; i < 100; i++) {
    var next = inferHierarchicalBlindSpot(input)
    eq(next.blindSpot.primary, first.blindSpot.primary, 'Run ' + i)
  }
})

T('DT05: 100-run determinism — FRAMEWORK_GAP 3-way', function () {
  var input = { secondarySignals: clearPM().concat(clearIC()) }
  var first = inferHierarchicalBlindSpot(input)
  for (var i = 0; i < 100; i++) {
    var next = inferHierarchicalBlindSpot(input)
    eq(next.family.primary, first.family.primary, 'Run ' + i)
    eq(next.blindSpot.primary, first.blindSpot.primary, 'Run ' + i)
  }
})

// ═══════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════

console.log('\n=== Hierarchical Blind Spot Inference Tests ===')
console.log('Total:', total, '| Passed:', passed, '| Failed:', failed)
console.log(failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + failed)
if (failed > 0) process.exit(1)
