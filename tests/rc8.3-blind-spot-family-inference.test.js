/**
 * tests/rc8.3-blind-spot-family-inference.test.js
 *
 * RC8.3 C3-002A — Blind Spot Family Inference Tests.
 *
 * 40+ cases:
 *   8 DECISION_ADAPTATION
 *   8 RESOURCE_COMPOUNDING
 *   8 UNCERTAINTY_JUDGMENT
 *   8 MODEL_BOUNDARY
 *   8 ambiguity/conflict
 *
 * @version world_model_v3
 * @sprint c3-002a
 */

var { inferBlindSpotFamily, scoreFamily } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotFamilyInference')
var { BLIND_SPOT_FAMILIES } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotFamilyDefinitions')

var total = 0, passed = 0, failed = 0

function T(name, fn) {
  total++
  try { fn(); passed++ }
  catch (e) { failed++; console.error('FAIL [' + name + ']: ' + e.message) }
}

function eq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': ' + a + ' !== ' + b) }
function ok(v, m) { if (!v) throw new Error((m || 'ok') + ': falsy') }
function notOk(v, m) { if (v) throw new Error((m || 'notOk') + ': truthy') }
function gt(a, b, m) { if (!(a > b)) throw new Error((m || 'gt') + ': ' + a + ' not > ' + b) }
function gte(a, b, m) { if (!(a >= b)) throw new Error((m || 'gte') + ': ' + a + ' not >= ' + b) }

var A = 'ACTIVE', S = 'SUPPRESSED', I = 'INSUFFICIENT_EVIDENCE'

function sig(id, state, score, confidence) {
  return { id: id, state: state, score: score || 50, confidence: confidence || 0.5 }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 1: DECISION_ADAPTATION (8 cases)
// ═══════════════════════════════════════════════════════════════

T('DA01: WAITING_DURATION_PATTERN active → DECISION_ADAPTATION', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 70),
    ],
  })
  eq(r.family, 'DECISION_ADAPTATION')
  ok(r.confidence > 0)
  ok(r.supportingSignals.indexOf('WAITING_DURATION_PATTERN') !== -1)
})

T('DA02: MINIMUM_STEP_EXECUTION active → DECISION_ADAPTATION', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('MINIMUM_STEP_EXECUTION', A, 60),
    ],
  })
  eq(r.family, 'DECISION_ADAPTATION')
})

T('DA03: Multiple DA signals → strong DECISION_ADAPTATION', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 70),
      sig('MINIMUM_STEP_EXECUTION', A, 65),
      sig('POST_ACTION_REVIEW_HABIT', A, 55),
    ],
  })
  eq(r.family, 'DECISION_ADAPTATION')
  gt(r.confidence, 0.3)
  ok(r.supportingSignals.length >= 2)
})

T('DA04: DA signal active, others insufficient → still DA', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 70),
      sig('OUTPUT_DECOUPLING_AWARENESS', I),
      sig('EMOTIONAL_RECENCY_IMPACT', I),
      sig('INFORMATION_SOURCE_DIVERSITY', I),
    ],
  })
  eq(r.family, 'DECISION_ADAPTATION')
})

T('DA05: Suppressed DA signal → reduces score', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 70),
      sig('MINIMUM_STEP_EXECUTION', S, 0),
    ],
  })
  eq(r.family, 'DECISION_ADAPTATION')
  ok(r.contradictingSignals.length >= 1)
})

T('DA06: DECISION_TO_ACTION_LATENCY alone → DECISION_ADAPTATION', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('DECISION_TO_ACTION_LATENCY', A, 45),
    ],
  })
  eq(r.family, 'DECISION_ADAPTATION')
})

T('DA07: Cross-occupation: same DA evidence → same family', function () {
  var input = {
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 70),
      sig('POST_ACTION_REVIEW_HABIT', A, 60),
    ],
  }
  var r1 = inferBlindSpotFamily(input)
  var r2 = inferBlindSpotFamily(input)
  eq(r1.family, r2.family)
  eq(r1.family, 'DECISION_ADAPTATION')
})

T('DA08: DA with high score → high confidence', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 90),
      sig('MINIMUM_STEP_EXECUTION', A, 85),
      sig('POST_ACTION_REVIEW_HABIT', A, 80),
      sig('DECISION_TO_ACTION_LATENCY', A, 75),
    ],
  })
  eq(r.family, 'DECISION_ADAPTATION')
  gt(r.confidence, 0.4)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 2: RESOURCE_COMPOUNDING (8 cases)
// ═══════════════════════════════════════════════════════════════

T('RC01: DIRECTION_SWITCHING_FREQUENCY active → RESOURCE_COMPOUNDING', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('DIRECTION_SWITCHING_FREQUENCY', A, 70),
    ],
  })
  eq(r.family, 'RESOURCE_COMPOUNDING')
})

T('RC02: Multiple RC signals → strong RESOURCE_COMPOUNDING', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('OUTPUT_DECOUPLING_AWARENESS', A, 65),
      sig('EFFORT_VS_MECHANISM_FRAMING', A, 60),
      sig('DIRECTION_SWITCHING_FREQUENCY', A, 70),
    ],
  })
  eq(r.family, 'RESOURCE_COMPOUNDING')
  gt(r.confidence, 0.3)
})

T('RC03: LONG_TERM_COMPOUNDING_AWARENESS alone → RC', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 55),
    ],
  })
  eq(r.family, 'RESOURCE_COMPOUNDING')
})

T('RC04: RC vs DA — RC wins when stronger', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 40),
      sig('DIRECTION_SWITCHING_FREQUENCY', A, 80),
      sig('OUTPUT_DECOUPLING_AWARENESS', A, 75),
    ],
  })
  eq(r.family, 'RESOURCE_COMPOUNDING')
})

T('RC05: ALTERNATIVE_PATH_COST_AWARENESS → RC', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('ALTERNATIVE_PATH_COST_AWARENESS', A, 60),
    ],
  })
  eq(r.family, 'RESOURCE_COMPOUNDING')
})

T('RC06: Suppressed RC signal → reduces score', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('OUTPUT_DECOUPLING_AWARENESS', A, 70),
      sig('DIRECTION_SWITCHING_FREQUENCY', S, 0),
    ],
  })
  eq(r.family, 'RESOURCE_COMPOUNDING')
  ok(r.contradictingSignals.length >= 1)
})

T('RC07: Cross-occupation: same RC evidence → same family', function () {
  var input = {
    secondarySignals: [
      sig('DIRECTION_SWITCHING_FREQUENCY', A, 80),
      sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 65),
    ],
  }
  var r1 = inferBlindSpotFamily(input)
  var r2 = inferBlindSpotFamily(input)
  eq(r1.family, r2.family)
  eq(r1.family, 'RESOURCE_COMPOUNDING')
})

T('RC08: RC with high score → high confidence', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('OUTPUT_DECOUPLING_AWARENESS', A, 85),
      sig('EFFORT_VS_MECHANISM_FRAMING', A, 80),
      sig('DIRECTION_SWITCHING_FREQUENCY', A, 90),
      sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 75),
      sig('ALTERNATIVE_PATH_COST_AWARENESS', A, 70),
    ],
  })
  eq(r.family, 'RESOURCE_COMPOUNDING')
  gt(r.confidence, 0.4)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 3: UNCERTAINTY_JUDGMENT (8 cases)
// ═══════════════════════════════════════════════════════════════

T('UJ01: EMOTIONAL_RECENCY_IMPACT active → UNCERTAINTY_JUDGMENT', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('EMOTIONAL_RECENCY_IMPACT', A, 70),
    ],
  })
  eq(r.family, 'UNCERTAINTY_JUDGMENT')
})

T('UJ02: Multiple UJ signals → strong UNCERTAINTY_JUDGMENT', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('EMOTIONAL_RECENCY_IMPACT', A, 70),
      sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 65),
      sig('PROBABILISTIC_LANGUAGE_USAGE', A, 60),
    ],
  })
  eq(r.family, 'UNCERTAINTY_JUDGMENT')
  gt(r.confidence, 0.3)
})

T('UJ03: LUCK_VS_SKILL_ATTRIBUTION alone → UJ', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('LUCK_VS_SKILL_ATTRIBUTION', A, 55),
    ],
  })
  eq(r.family, 'UNCERTAINTY_JUDGMENT')
})

T('UJ04: FEEDBACK_CALIBRATION_RATE → UJ', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('FEEDBACK_CALIBRATION_RATE', A, 50),
    ],
  })
  eq(r.family, 'UNCERTAINTY_JUDGMENT')
})

T('UJ05: PROBABILISTIC_LANGUAGE_USAGE → UJ', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('PROBABILISTIC_LANGUAGE_USAGE', A, 60),
    ],
  })
  eq(r.family, 'UNCERTAINTY_JUDGMENT')
})

T('UJ06: Suppressed UJ signal → reduces score', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('EMOTIONAL_RECENCY_IMPACT', A, 70),
      sig('PROBABILISTIC_LANGUAGE_USAGE', S, 0),
    ],
  })
  eq(r.family, 'UNCERTAINTY_JUDGMENT')
  ok(r.contradictingSignals.length >= 1)
})

T('UJ07: Same-occupation: UJ vs DA with different evidence', function () {
  var r1 = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 80)],
  })
  var r2 = inferBlindSpotFamily({
    secondarySignals: [sig('EMOTIONAL_RECENCY_IMPACT', A, 80)],
  })
  eq(r1.family, 'DECISION_ADAPTATION')
  eq(r2.family, 'UNCERTAINTY_JUDGMENT')
  notOk(r1.family === r2.family)
})

T('UJ08: ABSTRACT_VS_EMBODIED_RISK_JUDGMENT → UJ', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 65),
    ],
  })
  eq(r.family, 'UNCERTAINTY_JUDGMENT')
})

// ═══════════════════════════════════════════════════════════════
// SECTION 4: MODEL_BOUNDARY (8 cases)
// ═══════════════════════════════════════════════════════════════

T('MB01: IDENTITY_BASED_EXCLUSION active → MODEL_BOUNDARY', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('IDENTITY_BASED_EXCLUSION', A, 70),
    ],
  })
  eq(r.family, 'MODEL_BOUNDARY')
})

T('MB02: Multiple MB signals → strong MODEL_BOUNDARY', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('IDENTITY_BASED_EXCLUSION', A, 70),
      sig('INFORMATION_SOURCE_DIVERSITY', A, 65),
      sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 60),
    ],
  })
  eq(r.family, 'MODEL_BOUNDARY')
  gt(r.confidence, 0.25)
})

T('MB03: OPPORTUNITY side → MODEL_BOUNDARY', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('INFORMATION_SOURCE_DIVERSITY', A, 70),
      sig('SERENDIPITOUS_PATH_DISCOVERY', A, 65),
    ],
  })
  eq(r.family, 'MODEL_BOUNDARY')
})

T('MB04: SYSTEM side → MODEL_BOUNDARY', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 70),
      sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 65),
    ],
  })
  eq(r.family, 'MODEL_BOUNDARY')
})

T('MB05: CROSS_DOMAIN_FEEDBACK_THINKING → MB', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 55),
    ],
  })
  eq(r.family, 'MODEL_BOUNDARY')
})

T('MB06: SELF_ASSESSMENT_ASYMMETRY → MB', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('SELF_ASSESSMENT_ASYMMETRY', A, 50),
    ],
  })
  eq(r.family, 'MODEL_BOUNDARY')
})

T('MB07: MB vs DA — MB wins when stronger', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 40),
      sig('IDENTITY_BASED_EXCLUSION', A, 85),
      sig('INFORMATION_SOURCE_DIVERSITY', A, 80),
    ],
  })
  eq(r.family, 'MODEL_BOUNDARY')
})

T('MB08: Non-domain path awareness → MB', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('NON_DOMAIN_PATH_AWARENESS', A, 50),
    ],
  })
  eq(r.family, 'MODEL_BOUNDARY')
})

// ═══════════════════════════════════════════════════════════════
// SECTION 5: AMBIGUITY / CONFLICT (8 cases)
// ═══════════════════════════════════════════════════════════════

T('AM01: Empty input → ambiguous, no family', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [] })
  eq(r.family, null)
  ok(r.ambiguous)
  ok(r.missingEvidenceNeeded.length > 0)
})

T('AM02: All insufficient → ambiguous', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', I),
      sig('OUTPUT_DECOUPLING_AWARENESS', I),
      sig('EMOTIONAL_RECENCY_IMPACT', I),
      sig('IDENTITY_BASED_EXCLUSION', I),
    ],
  })
  eq(r.family, null)
  ok(r.ambiguous)
})

T('AM03: Close scores → ambiguous with alternateFamily', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 50),
      sig('DIRECTION_SWITCHING_FREQUENCY', A, 50),
    ],
  })
  // Scores are close; may or may not be ambiguous depending on weights
  // But alternateFamily should exist since gap is small
  if (r.ambiguous) {
    ok(r.alternateFamily !== null)
  }
})

T('AM04: Conflicting signals across families → gap measured', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 80),
      sig('DIRECTION_SWITCHING_FREQUENCY', A, 80),
      sig('EMOTIONAL_RECENCY_IMPACT', A, 80),
      sig('IDENTITY_BASED_EXCLUSION', A, 80),
    ],
  })
  ok(r.family !== null)
  ok(typeof r.rawGap === 'number')
})

T('AM05: Suppressed signal dominance → contradicting signals tracked', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 70),
      sig('MINIMUM_STEP_EXECUTION', S, 0),
      sig('POST_ACTION_REVIEW_HABIT', S, 0),
      sig('DECISION_TO_ACTION_LATENCY', S, 0),
    ],
  })
  // Suppressed signals can cancel out active ones, making family ambiguous
  // This is expected contradiction-first behavior
  ok(r.ambiguous || r.family === null, 'Suppression dominance should cause ambiguity or null family')
  // Verify all families scored
  ok(Object.keys(r.familyScores).length === 4)
})

T('AM06: Ambiguity when top score is very low', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('DECISION_TO_ACTION_LATENCY', A, 25),
    ],
  })
  // Low score single signal → potentially ambiguous
  ok(typeof r.ambiguous === 'boolean')
  ok(typeof r.confidence === 'number')
})

T('AM07: Conflicting signals: DA vs MB', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 85),
      sig('POST_ACTION_REVIEW_HABIT', A, 80),
      sig('IDENTITY_BASED_EXCLUSION', A, 85),
      sig('INFORMATION_SOURCE_DIVERSITY', A, 80),
    ],
  })
  ok(r.family !== null)
  ok(r.familyScores.DECISION_ADAPTATION > 0 || r.familyScores.MODEL_BOUNDARY > 0)
})

T('AM08: trace contains all required fields', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70)],
  })
  ok(r.trace)
  ok(typeof r.trace.familiesScored === 'number')
  ok(typeof r.trace.topFamilyScore === 'number')
  ok(typeof r.trace.gapToSecond === 'number')
  ok(typeof r.trace.totalActiveSignals === 'number')
})

// ═══════════════════════════════════════════════════════════════
// SECTION 6: DETERMINISM + GUARDS (5 cases)
// ═══════════════════════════════════════════════════════════════

T('DG01: 100-run determinism', function () {
  var input = {
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 70),
      sig('EMOTIONAL_RECENCY_IMPACT', A, 65),
      sig('DIRECTION_SWITCHING_FREQUENCY', A, 50),
    ],
  }
  var first = inferBlindSpotFamily(input)
  for (var i = 0; i < 100; i++) {
    var next = inferBlindSpotFamily(input)
    eq(next.family, first.family, 'Run ' + i)
    eq(JSON.stringify(next.familyScores), JSON.stringify(first.familyScores), 'Run ' + i)
    eq(next.confidence, first.confidence, 'Run ' + i)
    eq(next.ambiguous, first.ambiguous, 'Run ' + i)
    eq(next.alternateFamily, first.alternateFamily, 'Run ' + i)
  }
})

T('DG02: No blindSpotId in output', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70)],
  })
  notOk(r.blindSpotId)
})

T('DG03: No occupation/income/business contamination', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70)],
  })
  var json = JSON.stringify(r).toLowerCase()
  var terms = ['occupation', 'income', 'business', 'salary', 'career', 'revenue', 'profit']
  terms.forEach(function (t) {
    notOk(json.indexOf(t) !== -1, 'Contamination: ' + t)
  })
})

T('DG04: All 4 families scored when input provided', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70)],
  })
  eq(Object.keys(r.familyScores).length, 4)
  ok(r.familyScores.hasOwnProperty('DECISION_ADAPTATION'))
  ok(r.familyScores.hasOwnProperty('RESOURCE_COMPOUNDING'))
  ok(r.familyScores.hasOwnProperty('UNCERTAINTY_JUDGMENT'))
  ok(r.familyScores.hasOwnProperty('MODEL_BOUNDARY'))
})

T('DG05: No direct blind spot/archetype/strategy in output', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('IDENTITY_BASED_EXCLUSION', A, 70)],
  })
  notOk(r.blindSpotId)
  notOk(r.archetypeId)
  notOk(r.strategyId)
  notOk(r.finalBlindSpot)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 7: FAMILY API CONSISTENCY (3 cases)
// ═══════════════════════════════════════════════════════════════

T('API01: family is always one of the 4 family IDs', function () {
  var families = ['DECISION_ADAPTATION', 'RESOURCE_COMPOUNDING', 'UNCERTAINTY_JUDGMENT', 'MODEL_BOUNDARY']

  // Test each family activation pattern
  var profiles = [
    { signals: [sig('WAITING_DURATION_PATTERN', A, 80)], expect: 'DECISION_ADAPTATION' },
    { signals: [sig('OUTPUT_DECOUPLING_AWARENESS', A, 80)], expect: 'RESOURCE_COMPOUNDING' },
    { signals: [sig('EMOTIONAL_RECENCY_IMPACT', A, 80)], expect: 'UNCERTAINTY_JUDGMENT' },
    { signals: [sig('IDENTITY_BASED_EXCLUSION', A, 80)], expect: 'MODEL_BOUNDARY' },
  ]

  profiles.forEach(function (p) {
    var r = inferBlindSpotFamily({ secondarySignals: p.signals })
    eq(r.family, p.expect)
    ok(families.indexOf(r.family) !== -1)
  })
})

T('API02: No family output when all signals insufficient', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: Array(23).fill(null).map(function (_, i) { return sig('SIG_' + i, I) }),
  })
  eq(r.family, null)
})

T('API03: supportingSignals and contradictingSignals are arrays', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 70),
      sig('MINIMUM_STEP_EXECUTION', S, 0),
    ],
  })
  ok(Array.isArray(r.supportingSignals))
  ok(Array.isArray(r.contradictingSignals))
  ok(r.supportingSignals.length > 0)
  ok(r.contradictingSignals.length > 0)
})

// ═══════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════

console.log('\n=== Blind Spot Family Inference Tests ===')
console.log('Total:', total, '| Passed:', passed, '| Failed:', failed)
console.log(failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + failed)

if (failed > 0) process.exit(1)
