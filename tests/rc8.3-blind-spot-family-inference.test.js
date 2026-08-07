/**
 * tests/rc8.3-blind-spot-family-inference.test.js
 *
 * RC8.3 C3-002A R1 — Blind Spot Family Inference Tests (Lineage Corrected).
 *
 * Family IDs now use C1 architecture authority (BLIND_SPOT_FAMILIES).
 *
 * C1 Family IDs:
 *   EXECUTION_ADAPTATION_GAP — DECISION_INERTIA, FEEDBACK_LOOP_GAP
 *   RESOURCE_COMPOUNDING_GAP — LEVERAGE_MODEL_GAP, TIME_HORIZON_TRAP
 *   PERCEPTION_RISK_GAP      — OPPORTUNITY_BLINDNESS, RISK_MODEL_DISTORTION
 *   FRAMEWORK_GAP            — PROBABILITY_MISJUDGMENT, IDENTITY_CONSTRAINT, SYSTEM_THINKING_GAP
 *
 * Signal → Family (from C1 authority):
 *   OPPORTUNITY signals (INFORMATION_SOURCE_DIVERSITY etc.) → PERCEPTION_RISK_GAP
 *   PROBABILITY signals (PROBABILISTIC_LANGUAGE_USAGE etc.)  → FRAMEWORK_GAP
 *   RISK signals (EMOTIONAL_RECENCY_IMPACT etc.)             → PERCEPTION_RISK_GAP
 *   IDENTITY signals (IDENTITY_BASED_EXCLUSION etc.)         → FRAMEWORK_GAP
 *   SYSTEM signals (FEEDBACK_LOOP_CONCEPT_AWARENESS etc.)    → FRAMEWORK_GAP
 *
 * 48 cases:
 *   8 EXECUTION_ADAPTATION_GAP
 *   8 RESOURCE_COMPOUNDING_GAP
 *   8 PERCEPTION_RISK_GAP
 *   8 FRAMEWORK_GAP
 *   8 ambiguity/conflict
 *   5 determinism/guards
 *   3 API consistency
 *
 * @version world_model_v3
 * @sprint c3-002a-r1
 */

var { inferBlindSpotFamily, scoreFamily } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotFamilyInference')
var { BLIND_SPOT_FAMILIES, verifyLineageIdentity } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotFamilyDefinitions')

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

// C1 family IDs (architecture authority)
var EA = 'EXECUTION_ADAPTATION_GAP'     // DECISION_INERTIA, FEEDBACK_LOOP_GAP
var RC = 'RESOURCE_COMPOUNDING_GAP'     // LEVERAGE_MODEL_GAP, TIME_HORIZON_TRAP
var PR = 'PERCEPTION_RISK_GAP'          // OPPORTUNITY_BLINDNESS, RISK_MODEL_DISTORTION
var FG = 'FRAMEWORK_GAP'                // PROBABILITY_MISJUDGMENT, IDENTITY_CONSTRAINT, SYSTEM_THINKING_GAP

var ALL_FAMILIES = [EA, RC, PR, FG]

function sig(id, state, score, confidence) {
  return { id: id, state: state, score: score || 50, confidence: confidence || 0.5 }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 0: LINEAGE IDENTITY (1 case)
// ═══════════════════════════════════════════════════════════════

T('L00: C3 family membership matches C1 source of truth', function () {
  var result = verifyLineageIdentity()
  ok(result.pass, 'Lineage mismatch: ' + (result.mismatches || []).join('; '))
})

// ═══════════════════════════════════════════════════════════════
// SECTION 1: EXECUTION_ADAPTATION_GAP (8 cases)
// ═══════════════════════════════════════════════════════════════

T('EA01: WAITING_DURATION_PATTERN active → EXECUTION_ADAPTATION_GAP', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70)],
  })
  eq(r.family, EA)
  ok(r.confidence > 0)
  ok(r.supportingSignals.indexOf('WAITING_DURATION_PATTERN') !== -1)
})

T('EA02: MINIMUM_STEP_EXECUTION active → EXECUTION_ADAPTATION_GAP', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('MINIMUM_STEP_EXECUTION', A, 60)],
  })
  eq(r.family, EA)
})

T('EA03: Multiple EA signals → strong EXECUTION_ADAPTATION_GAP', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 70),
      sig('MINIMUM_STEP_EXECUTION', A, 65),
      sig('POST_ACTION_REVIEW_HABIT', A, 55),
    ],
  })
  eq(r.family, EA)
  gt(r.confidence, 0.3)
  ok(r.supportingSignals.length >= 2)
})

T('EA04: EA signal active, others insufficient → still EA', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 70),
      sig('OUTPUT_DECOUPLING_AWARENESS', I),
      sig('EMOTIONAL_RECENCY_IMPACT', I),
      sig('IDENTITY_BASED_EXCLUSION', I),
    ],
  })
  eq(r.family, EA)
})

T('EA05: Suppressed EA signal → reduces score', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 70),
      sig('MINIMUM_STEP_EXECUTION', S, 0),
    ],
  })
  eq(r.family, EA)
  ok(r.contradictingSignals.length >= 1)
})

T('EA06: DECISION_TO_ACTION_LATENCY alone → EXECUTION_ADAPTATION_GAP', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('DECISION_TO_ACTION_LATENCY', A, 45)],
  })
  eq(r.family, EA)
})

T('EA07: Cross-occupation: same EA evidence → same family', function () {
  var input = {
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 70),
      sig('POST_ACTION_REVIEW_HABIT', A, 60),
    ],
  }
  var r1 = inferBlindSpotFamily(input)
  var r2 = inferBlindSpotFamily(input)
  eq(r1.family, r2.family)
  eq(r1.family, EA)
})

T('EA08: EA with high score → high confidence', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 90),
      sig('MINIMUM_STEP_EXECUTION', A, 85),
      sig('POST_ACTION_REVIEW_HABIT', A, 80),
      sig('DECISION_TO_ACTION_LATENCY', A, 75),
    ],
  })
  eq(r.family, EA)
  gt(r.confidence, 0.4)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 2: RESOURCE_COMPOUNDING_GAP (8 cases)
// ═══════════════════════════════════════════════════════════════

T('RC01: DIRECTION_SWITCHING_FREQUENCY active → RESOURCE_COMPOUNDING_GAP', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('DIRECTION_SWITCHING_FREQUENCY', A, 70)],
  })
  eq(r.family, RC)
})

T('RC02: Multiple RC signals → strong RESOURCE_COMPOUNDING_GAP', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('OUTPUT_DECOUPLING_AWARENESS', A, 65),
      sig('EFFORT_VS_MECHANISM_FRAMING', A, 60),
      sig('DIRECTION_SWITCHING_FREQUENCY', A, 70),
    ],
  })
  eq(r.family, RC)
  gt(r.confidence, 0.3)
})

T('RC03: LONG_TERM_COMPOUNDING_AWARENESS alone → RC', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 55)],
  })
  eq(r.family, RC)
})

T('RC04: RC vs EA — RC wins when stronger', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 40),
      sig('DIRECTION_SWITCHING_FREQUENCY', A, 80),
      sig('OUTPUT_DECOUPLING_AWARENESS', A, 75),
    ],
  })
  eq(r.family, RC)
})

T('RC05: ALTERNATIVE_PATH_COST_AWARENESS → RC', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('ALTERNATIVE_PATH_COST_AWARENESS', A, 60)],
  })
  eq(r.family, RC)
})

T('RC06: Suppressed RC signal → reduces score', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('OUTPUT_DECOUPLING_AWARENESS', A, 70),
      sig('DIRECTION_SWITCHING_FREQUENCY', S, 0),
    ],
  })
  eq(r.family, RC)
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
  eq(r1.family, RC)
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
  eq(r.family, RC)
  gt(r.confidence, 0.4)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 3: PERCEPTION_RISK_GAP (8 cases)
// C1: OPPORTUNITY_BLINDNESS + RISK_MODEL_DISTORTION
// Signals: OPPORTUNITY + RISK (EMOTIONAL_RECENCY_IMPACT, ABSTRACT_VS_EMBODIED_RISK_JUDGMENT)
// C3 PROBABILITY signals (PROBABILISTIC_LANGUAGE_USAGE etc.) go to FRAMEWORK_GAP per C1
// ═══════════════════════════════════════════════════════════════

T('PR01: EMOTIONAL_RECENCY_IMPACT active → PERCEPTION_RISK_GAP', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('EMOTIONAL_RECENCY_IMPACT', A, 70)],
  })
  eq(r.family, PR)
})

T('PR02: Multiple PR signals → strong PERCEPTION_RISK_GAP', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('EMOTIONAL_RECENCY_IMPACT', A, 70),
      sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 65),
      sig('INFORMATION_SOURCE_DIVERSITY', A, 60),
    ],
  })
  eq(r.family, PR)
  gt(r.confidence, 0.25)
})

T('PR03: INFORMATION_SOURCE_DIVERSITY alone → PERCEPTION_RISK_GAP (opportunity)', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('INFORMATION_SOURCE_DIVERSITY', A, 55)],
  })
  eq(r.family, PR)
})

T('PR04: NON_DOMAIN_PATH_AWARENESS → PERCEPTION_RISK_GAP (opportunity)', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('NON_DOMAIN_PATH_AWARENESS', A, 50)],
  })
  eq(r.family, PR)
})

T('PR05: SERENDIPITOUS_PATH_DISCOVERY → PERCEPTION_RISK_GAP (opportunity)', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('SERENDIPITOUS_PATH_DISCOVERY', A, 50)],
  })
  eq(r.family, PR)
})

T('PR06: Suppressed PR signal → reduces score', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('EMOTIONAL_RECENCY_IMPACT', A, 70),
      sig('INFORMATION_SOURCE_DIVERSITY', S, 0),
    ],
  })
  eq(r.family, PR)
  ok(r.contradictingSignals.length >= 1)
})

T('PR07: Same-occupation: PR vs EA with different evidence', function () {
  var r1 = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 80)],
  })
  var r2 = inferBlindSpotFamily({
    secondarySignals: [sig('EMOTIONAL_RECENCY_IMPACT', A, 80)],
  })
  eq(r1.family, EA)
  eq(r2.family, PR)
  notOk(r1.family === r2.family)
})

T('PR08: ABSTRACT_VS_EMBODIED_RISK_JUDGMENT → PERCEPTION_RISK_GAP', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 65)],
  })
  eq(r.family, PR)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 4: FRAMEWORK_GAP (8 cases)
// C1: PROBABILITY_MISJUDGMENT + IDENTITY_CONSTRAINT + SYSTEM_THINKING_GAP
// Signals: PROBABILITY + IDENTITY + SYSTEM
// OPPORTUNITY signals (INFORMATION_SOURCE_DIVERSITY etc.) → PERCEPTION_RISK_GAP
// ═══════════════════════════════════════════════════════════════

T('FG01: IDENTITY_BASED_EXCLUSION active → FRAMEWORK_GAP', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('IDENTITY_BASED_EXCLUSION', A, 70)],
  })
  eq(r.family, FG)
})

T('FG02: Multiple FG signals → strong FRAMEWORK_GAP', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('IDENTITY_BASED_EXCLUSION', A, 70),
      sig('PROBABILISTIC_LANGUAGE_USAGE', A, 65),
      sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 60),
    ],
  })
  eq(r.family, FG)
  gt(r.confidence, 0.2)
})

T('FG03: PROBABILITY side → FRAMEWORK_GAP', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('PROBABILISTIC_LANGUAGE_USAGE', A, 70),
      sig('LUCK_VS_SKILL_ATTRIBUTION', A, 65),
    ],
  })
  eq(r.family, FG)
})

T('FG04: SYSTEM side → FRAMEWORK_GAP', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 70),
      sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 65),
    ],
  })
  eq(r.family, FG)
})

T('FG05: CROSS_DOMAIN_FEEDBACK_THINKING → FG', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 55)],
  })
  eq(r.family, FG)
})

T('FG06: SELF_ASSESSMENT_ASYMMETRY → FG', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('SELF_ASSESSMENT_ASYMMETRY', A, 50)],
  })
  eq(r.family, FG)
})

T('FG07: FG vs EA — FG wins when stronger', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 40),
      sig('IDENTITY_BASED_EXCLUSION', A, 85),
      sig('PROBABILISTIC_LANGUAGE_USAGE', A, 80),
    ],
  })
  eq(r.family, FG)
})

T('FG08: CROSS_IDENTITY_ATTEMPT_HISTORY → FG', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 50)],
  })
  eq(r.family, FG)
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
  ok(r.ambiguous || r.family === null || r.family === EA, 'Suppression dominance should cause ambiguity, null, or EA')
  ok(Object.keys(r.familyScores).length === 4)
})

T('AM06: Ambiguity when top score is very low', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('DECISION_TO_ACTION_LATENCY', A, 25)],
  })
  ok(typeof r.ambiguous === 'boolean')
  ok(typeof r.confidence === 'number')
})

T('AM07: Conflicting signals: EA vs FG', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 85),
      sig('POST_ACTION_REVIEW_HABIT', A, 80),
      sig('IDENTITY_BASED_EXCLUSION', A, 85),
      sig('PROBABILISTIC_LANGUAGE_USAGE', A, 80),
    ],
  })
  ok(r.family !== null)
  ok(r.familyScores[EA] > 0 || r.familyScores[FG] > 0)
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
  ALL_FAMILIES.forEach(function (fid) {
    ok(r.familyScores.hasOwnProperty(fid), 'Missing family: ' + fid)
  })
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

T('API01: family is always one of the 4 C1 family IDs', function () {
  var profiles = [
    { signals: [sig('WAITING_DURATION_PATTERN', A, 80)], expect: EA },
    { signals: [sig('OUTPUT_DECOUPLING_AWARENESS', A, 80)], expect: RC },
    { signals: [sig('EMOTIONAL_RECENCY_IMPACT', A, 80)], expect: PR },
    { signals: [sig('IDENTITY_BASED_EXCLUSION', A, 80)], expect: FG },
  ]

  profiles.forEach(function (p) {
    var r = inferBlindSpotFamily({ secondarySignals: p.signals })
    eq(r.family, p.expect)
    ok(ALL_FAMILIES.indexOf(r.family) !== -1)
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

console.log('\n=== Blind Spot Family Inference Tests (R1 — Lineage Corrected) ===')
console.log('Total:', total, '| Passed:', passed, '| Failed:', failed)
console.log(failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + failed)

if (failed > 0) process.exit(1)
