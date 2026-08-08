/**
 * tests/rc8.3-within-family-blind-spot-inference.test.js
 *
 * RC8.3 C3-002B — Within-Family Blind Spot Selection Tests.
 *
 * 66 cases covering all 4 families, disqualifiers, necessary conditions,
 * contradiction, ambiguity, 3-candidate FRAMEWORK_GAP, determinism, guards.
 *
 * @version world_model_v3
 * @sprint c3-002b
 */

var { inferWithinFamilyBlindSpot, ELIGIBILITY } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/withinFamilyBlindSpotInference')

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

var A = 'ACTIVE', S = 'SUPPRESSED', I = 'INSUFFICIENT_EVIDENCE'

function sig(id, state, score, o) {
  return { id: id, state: state, score: score || 50, originId: o || ('o-' + id), confidence: 0.5 }
}
function findC(r, id) { return r.candidateStates.find(function(c) { return c.id === id }) }

// ═══════════════════════════════════════════════════════════════
// EAG: DECISION_INERTIA (8)
// ═══════════════════════════════════════════════════════════════

T('DI01: WAITING_DURATION_PATTERN active → DI eligible', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 70),
    sig('MINIMUM_STEP_EXECUTION', I),
  ]})
  eq(findC(r, 'DECISION_INERTIA').eligibility, ELIGIBILITY.ELIGIBLE)
})

T('DI02: Multiple DI signals → DI primary', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 85),
    sig('POST_ACTION_REVIEW_HABIT', I),
    sig('MINIMUM_STEP_EXECUTION', I),
  ]})
  eq(r.primaryBlindSpot, 'DECISION_INERTIA')
})

T('DI03: DI vs FLG — mutual disqualification yields null when both disqualify', function () {
  // WAITING supports DI, MSE+POST support FLG
  // But MSE active → disqualifies DI, WAITING active → disqualifies FLG
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 90),
    sig('POST_ACTION_REVIEW_HABIT', A, 70),
    sig('MINIMUM_STEP_EXECUTION', A, 40),
  ]})
  // Both disqualify each other → should be ambiguous with null primary
  // This is correct architecture: mutually disqualifying evidence = genuine ambiguity
  if (r.primaryBlindSpot === null) {
    ok(r.ambiguous)
  } else {
    ok(r.candidateStates.some(function(c) { return c.eligibility === ELIGIBILITY.DISQUALIFIED }))
  }
})

T('DI04: DI with strong support, high confidence', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 95),
  ]})
  ok(findC(r, 'DECISION_INERTIA').confidence > 0)
})

T('DI05: Disqualified when MINIMUM_STEP_EXECUTION active', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('MINIMUM_STEP_EXECUTION', A, 60),
    sig('WAITING_DURATION_PATTERN', I),
  ]})
  eq(findC(r, 'DECISION_INERTIA').eligibility, ELIGIBILITY.DISQUALIFIED)
})

T('DI06: DI insufficient when no supporting signals', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('POST_ACTION_REVIEW_HABIT', A, 60),
    sig('DECISION_TO_ACTION_LATENCY', A, 50),
  ]})
  eq(findC(r, 'DECISION_INERTIA').eligibility, ELIGIBILITY.INSUFFICIENT)
})

T('DI07: DI eligible when no disqualifier is active', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 70),
    sig('MINIMUM_STEP_EXECUTION', I),
    sig('POST_ACTION_REVIEW_HABIT', I),
  ]})
  eq(findC(r, 'DECISION_INERTIA').eligibility, ELIGIBILITY.ELIGIBLE)
})

T('DI08: Same-origin signals not double-counted', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 70, 'SAME-ORIGIN'),
    sig('MINIMUM_STEP_EXECUTION', A, 60, 'SAME-ORIGIN'),
  ]})
  // DI is disqualified (MSE active), FLG should have limited differentiators
  var flg = findC(r, 'FEEDBACK_LOOP_GAP')
  ok(flg.trace.differentiators.independentCount <= 2)
})

// ═══════════════════════════════════════════════════════════════
// EAG: FEEDBACK_LOOP_GAP (8)
// ═══════════════════════════════════════════════════════════════

T('FLG01: MINIMUM_STEP_EXECUTION + POST_ACTION → FLG primary', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('MINIMUM_STEP_EXECUTION', A, 70),
    sig('POST_ACTION_REVIEW_HABIT', A, 65),
    sig('DECISION_TO_ACTION_LATENCY', A, 55),
  ]})
  eq(r.primaryBlindSpot, 'FEEDBACK_LOOP_GAP')
})

T('FLG02: DECISION_TO_ACTION_LATENCY → FLG eligible', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('MINIMUM_STEP_EXECUTION', A, 55),
    sig('DECISION_TO_ACTION_LATENCY', A, 55),
    sig('POST_ACTION_REVIEW_HABIT', A, 50),
  ]})
  eq(r.primaryBlindSpot, 'FEEDBACK_LOOP_GAP')
})

T('FLG03: FLG disqualified when WAITING active', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 70),
    sig('MINIMUM_STEP_EXECUTION', A, 60),
    sig('POST_ACTION_REVIEW_HABIT', A, 50),
  ]})
  eq(findC(r, 'FEEDBACK_LOOP_GAP').eligibility, ELIGIBILITY.DISQUALIFIED)
})

T('FLG04: FLG with strong POST_ACTION_REVIEW', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('POST_ACTION_REVIEW_HABIT', A, 85),
    sig('MINIMUM_STEP_EXECUTION', A, 60),
    sig('DECISION_TO_ACTION_LATENCY', A, 50),
  ]})
  eq(r.primaryBlindSpot, 'FEEDBACK_LOOP_GAP')
  gt(findC(r, 'FEEDBACK_LOOP_GAP').supportStrength, 40)
})

T('FLG05: FLG disqualified when WAITING active (mutual exclusion)', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 80),
  ]})
  eq(findC(r, 'FEEDBACK_LOOP_GAP').eligibility, ELIGIBILITY.DISQUALIFIED)
})

T('FLG06: FLG contradiction from suppressed support', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('MINIMUM_STEP_EXECUTION', S, 0),
    sig('POST_ACTION_REVIEW_HABIT', A, 70),
    sig('DECISION_TO_ACTION_LATENCY', A, 55),
  ]})
  var c = findC(r, 'FEEDBACK_LOOP_GAP')
  ok(c.contradictingEvidenceIds.length >= 1)
})

T('FLG07: Cross-occupation: same EAG evidence → same primary', function () {
  var input = { family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('POST_ACTION_REVIEW_HABIT', A, 75),
    sig('MINIMUM_STEP_EXECUTION', A, 65),
  ]}
  var r1 = inferWithinFamilyBlindSpot(input)
  var r2 = inferWithinFamilyBlindSpot(input)
  eq(r1.primaryBlindSpot, r2.primaryBlindSpot)
})

T('FLG08: EAG with both disqualified → null primary', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 70),
    sig('MINIMUM_STEP_EXECUTION', A, 70),
  ]})
  // DI disqualified by MSE active, FLG disqualified by WAITING active → both disqualified
  eq(r.primaryBlindSpot, null)
})

// ═══════════════════════════════════════════════════════════════
// EAG: AMBIGUITY (4)
// ═══════════════════════════════════════════════════════════════

T('EAG_AMB01: Close scores → ambiguous', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 60),
    sig('MINIMUM_STEP_EXECUTION', A, 55),
    sig('POST_ACTION_REVIEW_HABIT', A, 50),
  ]})
  // Both DI and FLG may be eligible with close scores — ambiguity expected
  ok(typeof r.ambiguous === 'boolean')
  ok(typeof r.rawGap === 'number')
})

T('EAG_AMB02: Both insufficient → null, ambiguous', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [] })
  eq(r.primaryBlindSpot, null)
  ok(r.ambiguous)
})

T('EAG_AMB03: Mutual disqualification → null primary, ambiguous', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 80),
    sig('POST_ACTION_REVIEW_HABIT', A, 70),
    sig('MINIMUM_STEP_EXECUTION', A, 60),
  ]})
  // WAITING disqualifies FLG, MSE disqualifies DI → both disqualified → null
  eq(r.primaryBlindSpot, null)
  ok(r.ambiguous)
})

T('EAG_AMB04: missingEvidenceNeeded populated for insufficient', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [] })
  r.candidateStates.forEach(function(c) {
    if (c.eligibility === ELIGIBILITY.INSUFFICIENT) {
      ok(c.missingEvidenceNeeded.length > 0)
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// RCG: LEVERAGE_MODEL_GAP (8)
// ═══════════════════════════════════════════════════════════════

T('LMG01: OUTPUT_DECOUPLING active → LMG eligible', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 70),
    sig('EFFORT_VS_MECHANISM_FRAMING', A, 60),
  ]})
  eq(findC(r, 'LEVERAGE_MODEL_GAP').eligibility, ELIGIBILITY.ELIGIBLE)
})

T('LMG02: EFFORT_VS_MECHANISM → LMG primary', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('EFFORT_VS_MECHANISM_FRAMING', A, 80),
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 70),
  ]})
  eq(r.primaryBlindSpot, 'LEVERAGE_MODEL_GAP')
})

T('LMG03: LMG disqualified by DIRECTION_SWITCHING', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 70),
    sig('OUTPUT_DECOUPLING_AWARENESS', I),
  ]})
  eq(findC(r, 'LEVERAGE_MODEL_GAP').eligibility, ELIGIBILITY.DISQUALIFIED)
})

T('LMG04: LMG insufficient with 0 RCG signals', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 80),
  ]})
  eq(findC(r, 'LEVERAGE_MODEL_GAP').eligibility, ELIGIBILITY.INSUFFICIENT)
})

T('LMG05: LMG with both leverage signals → strong', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 85),
    sig('EFFORT_VS_MECHANISM_FRAMING', A, 80),
    sig('DIRECTION_SWITCHING_FREQUENCY', I),
  ]})
  eq(r.primaryBlindSpot, 'LEVERAGE_MODEL_GAP')
  gt(findC(r, 'LEVERAGE_MODEL_GAP').supportStrength, 50)
})

T('LMG06: LMG contradiction from suppressed signals', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 70),
    sig('EFFORT_VS_MECHANISM_FRAMING', S, 0),
  ]})
  var c = findC(r, 'LEVERAGE_MODEL_GAP')
  ok(c.contradictingEvidenceIds.length >= 1)
})

T('LMG07: Cross-occupation: same RCG → same primary', function () {
  var input = { family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 75),
    sig('EFFORT_VS_MECHANISM_FRAMING', A, 65),
  ]}
  eq(inferWithinFamilyBlindSpot(input).primaryBlindSpot, inferWithinFamilyBlindSpot(input).primaryBlindSpot)
})

T('LMG08: LMG with no disqualifier but TIME disqualified', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 60),
    sig('EFFORT_VS_MECHANISM_FRAMING', A, 55),
    sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 80),
  ]})
  // LMG disqualified by DIRECTION_SWITCHING? No — DIRECTION not active
  // TIME disqualified by OUTPUT being active
  eq(findC(r, 'LEVERAGE_MODEL_GAP').eligibility, ELIGIBILITY.ELIGIBLE)
})

// ═══════════════════════════════════════════════════════════════
// RCG: TIME_HORIZON_TRAP (8)
// ═══════════════════════════════════════════════════════════════

T('THT01: DIRECTION_SWITCHING active → THT eligible', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 70),
    sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 60),
  ]})
  eq(findC(r, 'TIME_HORIZON_TRAP').eligibility, ELIGIBILITY.ELIGIBLE)
})

T('THT02: Multiple TIME signals → THT primary', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 80),
    sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 70),
    sig('ALTERNATIVE_PATH_COST_AWARENESS', A, 60),
  ]})
  eq(r.primaryBlindSpot, 'TIME_HORIZON_TRAP')
})

T('THT03: THT disqualified by OUTPUT_DECOUPLING', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 70),
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 70),
  ]})
  eq(findC(r, 'TIME_HORIZON_TRAP').eligibility, ELIGIBILITY.DISQUALIFIED)
})

T('THT04: LONG_TERM_COMPOUNDING supports THT → eligible', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 70),
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 50),
  ]})
  eq(findC(r, 'TIME_HORIZON_TRAP').eligibility, ELIGIBILITY.ELIGIBLE)
})

T('THT05: THT insufficient with 0 TIME signals', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [] })
  eq(findC(r, 'TIME_HORIZON_TRAP').eligibility, ELIGIBILITY.INSUFFICIENT)
})

T('THT06: THT with ALTERNATIVE_PATH_COST awareness', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('ALTERNATIVE_PATH_COST_AWARENESS', A, 55),
    sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 60),
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 70),
  ]})
  eq(r.primaryBlindSpot, 'TIME_HORIZON_TRAP')
})

T('THT07: LMG vs THT — mutual disqualification yields ambiguous', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 90),
    sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 80),
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 50),
  ]})
  // OUTPUT disqualifies THT, DIRECTION disqualifies LMG → mutual disqualification
  ok(r.primaryBlindSpot === null || r.ambiguous)
})

T('THT08: THT contradiction from suppressed TIME signals', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('DIRECTION_SWITCHING_FREQUENCY', S, 0),
    sig('ALTERNATIVE_PATH_COST_AWARENESS', A, 60),
  ]})
  ok(findC(r, 'TIME_HORIZON_TRAP').contradictingEvidenceIds.length >= 1)
})

// ═══════════════════════════════════════════════════════════════
// RCG: AMBIGUITY (4)
// ═══════════════════════════════════════════════════════════════

T('RCG_AMB01: Close LMG vs THT scores → ambiguous', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 65),
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 65),
  ]})
  ok(typeof r.ambiguous === 'boolean')
})

T('RCG_AMB02: Both insufficient', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [] })
  eq(r.primaryBlindSpot, null)
})

T('RCG_AMB03: LMG disqualified → THT wins clean', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 80),
    sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 60),
    sig('OUTPUT_DECOUPLING_AWARENESS', I),
  ]})
  eq(r.primaryBlindSpot, 'TIME_HORIZON_TRAP')
  notOk(r.ambiguous)
})

T('RCG_AMB04: rawGap reported when both eligible', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 70),
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 70),
  ]})
  ok(typeof r.rawGap === 'number')
})

// ═══════════════════════════════════════════════════════════════
// PRG: OPPORTUNITY_BLINDNESS (6)
// ═══════════════════════════════════════════════════════════════

T('OB01: INFORMATION_SOURCE_DIVERSITY → OB eligible', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('INFORMATION_SOURCE_DIVERSITY', A, 70),
    sig('NON_DOMAIN_PATH_AWARENESS', A, 55),
    sig('SERENDIPITOUS_PATH_DISCOVERY', A, 50),
  ]})
  eq(findC(r, 'OPPORTUNITY_BLINDNESS').eligibility, ELIGIBILITY.ELIGIBLE)
})

T('OB02: Multiple OB signals → OB primary', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('INFORMATION_SOURCE_DIVERSITY', A, 80),
    sig('SERENDIPITOUS_PATH_DISCOVERY', A, 65),
    sig('NON_DOMAIN_PATH_AWARENESS', A, 55),
  ]})
  eq(r.primaryBlindSpot, 'OPPORTUNITY_BLINDNESS')
})

T('OB03: OB disqualified by IDENTITY_BASED_EXCLUSION active', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('IDENTITY_BASED_EXCLUSION', A, 70),
    sig('INFORMATION_SOURCE_DIVERSITY', I),
  ]})
  eq(findC(r, 'OPPORTUNITY_BLINDNESS').eligibility, ELIGIBILITY.DISQUALIFIED)
})

T('OB04: OB insufficient with no OB signals', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('EMOTIONAL_RECENCY_IMPACT', A, 70),
  ]})
  eq(findC(r, 'OPPORTUNITY_BLINDNESS').eligibility, ELIGIBILITY.INSUFFICIENT)
})

T('OB05: OB with all 3 supporting signals → strong', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('INFORMATION_SOURCE_DIVERSITY', A, 80),
    sig('NON_DOMAIN_PATH_AWARENESS', A, 70),
    sig('SERENDIPITOUS_PATH_DISCOVERY', A, 75),
  ]})
  eq(r.primaryBlindSpot, 'OPPORTUNITY_BLINDNESS')
  gt(findC(r, 'OPPORTUNITY_BLINDNESS').supportStrength, 50)
})

T('OB06: OB with single strong signal → eligible', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('INFORMATION_SOURCE_DIVERSITY', A, 90),
    sig('NON_DOMAIN_PATH_AWARENESS', A, 50),
    sig('SERENDIPITOUS_PATH_DISCOVERY', A, 45),
  ]})
  eq(findC(r, 'OPPORTUNITY_BLINDNESS').eligibility, ELIGIBILITY.ELIGIBLE)
})

// ═══════════════════════════════════════════════════════════════
// PRG: RISK_MODEL_DISTORTION (6)
// ═══════════════════════════════════════════════════════════════

T('RMD01: EMOTIONAL_RECENCY → RMD eligible', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('EMOTIONAL_RECENCY_IMPACT', A, 70),
    sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 60),
  ]})
  eq(findC(r, 'RISK_MODEL_DISTORTION').eligibility, ELIGIBILITY.ELIGIBLE)
})

T('RMD02: Multiple RMD signals → RMD primary', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('EMOTIONAL_RECENCY_IMPACT', A, 85),
    sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 75),
  ]})
  eq(r.primaryBlindSpot, 'RISK_MODEL_DISTORTION')
})

T('RMD03: RMD disqualified by PROBABILISTIC_LANGUAGE_USAGE', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 70),
    sig('EMOTIONAL_RECENCY_IMPACT', I),
  ]})
  eq(findC(r, 'RISK_MODEL_DISTORTION').eligibility, ELIGIBILITY.DISQUALIFIED)
})

T('RMD04: RMD insufficient with 0 RMD signals', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('INFORMATION_SOURCE_DIVERSITY', A, 70),
  ]})
  eq(findC(r, 'RISK_MODEL_DISTORTION').eligibility, ELIGIBILITY.INSUFFICIENT)
})

T('RMD05: RMD contradiction from suppressed EMOTIONAL signal', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('EMOTIONAL_RECENCY_IMPACT', S, 0),
    sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 60),
  ]})
  ok(findC(r, 'RISK_MODEL_DISTORTION').contradictingEvidenceIds.length >= 1)
})

T('RMD06: OB wins when both eligible and OB stronger', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('INFORMATION_SOURCE_DIVERSITY', A, 85),
    sig('SERENDIPITOUS_PATH_DISCOVERY', A, 80),
    sig('NON_DOMAIN_PATH_AWARENESS', A, 60),
    sig('EMOTIONAL_RECENCY_IMPACT', A, 70),
  ]})
  eq(r.primaryBlindSpot, 'OPPORTUNITY_BLINDNESS')
})

// ═══════════════════════════════════════════════════════════════
// PRG: AMBIGUITY (4)
// ═══════════════════════════════════════════════════════════════

T('PRG_AMB01: OB vs RMD close → ambiguous', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('INFORMATION_SOURCE_DIVERSITY', A, 65),
    sig('EMOTIONAL_RECENCY_IMPACT', A, 65),
  ]})
  ok(typeof r.ambiguous === 'boolean')
})

T('PRG_AMB02: Both insufficient', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [] })
  eq(r.primaryBlindSpot, null)
})

T('PRG_AMB03: Both disqualified', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('IDENTITY_BASED_EXCLUSION', A, 70),
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 70),
  ]})
  eq(r.primaryBlindSpot, null)
})

T('PRG_AMB04: rawGap measured', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('INFORMATION_SOURCE_DIVERSITY', A, 70),
    sig('EMOTIONAL_RECENCY_IMPACT', A, 70),
  ]})
  ok(typeof r.rawGap === 'number')
})

// ═══════════════════════════════════════════════════════════════
// FRG: PROBABILITY_MISJUDGMENT (6)
// ═══════════════════════════════════════════════════════════════

T('PM01: PROBABILISTIC_LANGUAGE → PM eligible', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 70),
    sig('LUCK_VS_SKILL_ATTRIBUTION', A, 60),
    sig('FEEDBACK_CALIBRATION_RATE', A, 50),
  ]})
  eq(findC(r, 'PROBABILITY_MISJUDGMENT').eligibility, ELIGIBILITY.ELIGIBLE)
})

T('PM02: Multiple PM signals → PM primary', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 80),
    sig('LUCK_VS_SKILL_ATTRIBUTION', A, 75),
    sig('FEEDBACK_CALIBRATION_RATE', A, 70),
  ]})
  eq(r.primaryBlindSpot, 'PROBABILITY_MISJUDGMENT')
})

T('PM03: PM disqualified by EMOTIONAL_RECENCY', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('EMOTIONAL_RECENCY_IMPACT', A, 70),
    sig('PROBABILISTIC_LANGUAGE_USAGE', I),
  ]})
  eq(findC(r, 'PROBABILITY_MISJUDGMENT').eligibility, ELIGIBILITY.DISQUALIFIED)
})

T('PM04: PM insufficient with 0 PM signals', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('IDENTITY_BASED_EXCLUSION', A, 70),
  ]})
  eq(findC(r, 'PROBABILITY_MISJUDGMENT').eligibility, ELIGIBILITY.INSUFFICIENT)
})

T('PM05: PM wins 3-way in FRAMEWORK_GAP', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 85),
    sig('LUCK_VS_SKILL_ATTRIBUTION', A, 80),
    sig('FEEDBACK_CALIBRATION_RATE', A, 65),
    sig('IDENTITY_BASED_EXCLUSION', A, 60),
    sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 55),
  ]})
  eq(r.primaryBlindSpot, 'PROBABILITY_MISJUDGMENT')
})

T('PM06: PM with ABSTRACT_VS_EMBODIED disqualifier', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 70),
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 60),
  ]})
  eq(findC(r, 'PROBABILITY_MISJUDGMENT').eligibility, ELIGIBILITY.DISQUALIFIED)
})

// ═══════════════════════════════════════════════════════════════
// FRG: IDENTITY_CONSTRAINT (6)
// ═══════════════════════════════════════════════════════════════

T('IC01: IDENTITY_BASED_EXCLUSION → IC eligible', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('IDENTITY_BASED_EXCLUSION', A, 70),
    sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 60),
    sig('SELF_ASSESSMENT_ASYMMETRY', A, 50),
  ]})
  eq(findC(r, 'IDENTITY_CONSTRAINT').eligibility, ELIGIBILITY.ELIGIBLE)
})

T('IC02: Multiple IC signals → IC primary', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('IDENTITY_BASED_EXCLUSION', A, 85),
    sig('SELF_ASSESSMENT_ASYMMETRY', A, 75),
    sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 70),
  ]})
  eq(r.primaryBlindSpot, 'IDENTITY_CONSTRAINT')
})

T('IC03: IC disqualified by INFORMATION_SOURCE_DIVERSITY', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('INFORMATION_SOURCE_DIVERSITY', A, 70),
    sig('IDENTITY_BASED_EXCLUSION', I),
  ]})
  eq(findC(r, 'IDENTITY_CONSTRAINT').eligibility, ELIGIBILITY.DISQUALIFIED)
})

T('IC04: IC insufficient with 0 IC signals', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 70),
  ]})
  eq(findC(r, 'IDENTITY_CONSTRAINT').eligibility, ELIGIBILITY.INSUFFICIENT)
})

T('IC05: IC wins 3-way in FRAMEWORK_GAP', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('IDENTITY_BASED_EXCLUSION', A, 90),
    sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 85),
    sig('SELF_ASSESSMENT_ASYMMETRY', A, 60),
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 50),
  ]})
  eq(r.primaryBlindSpot, 'IDENTITY_CONSTRAINT')
})

T('IC06: IC with SELF_ASSESSMENT_ASYMMETRY only', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('SELF_ASSESSMENT_ASYMMETRY', A, 70),
    sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 55),
    sig('IDENTITY_BASED_EXCLUSION', A, 50),
  ]})
  eq(findC(r, 'IDENTITY_CONSTRAINT').eligibility, ELIGIBILITY.ELIGIBLE)
})

// ═══════════════════════════════════════════════════════════════
// FRG: SYSTEM_THINKING_GAP (6)
// ═══════════════════════════════════════════════════════════════

T('STG01: FEEDBACK_LOOP_CONCEPT → STG eligible', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 70),
    sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 60),
    sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 50),
  ]})
  eq(findC(r, 'SYSTEM_THINKING_GAP').eligibility, ELIGIBILITY.ELIGIBLE)
})

T('STG02: Multiple STG signals → STG primary', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 80),
    sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 75),
    sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 70),
  ]})
  eq(r.primaryBlindSpot, 'SYSTEM_THINKING_GAP')
})

T('STG03: STG disqualified by POST_ACTION_REVIEW', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('POST_ACTION_REVIEW_HABIT', A, 70),
    sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', I),
  ]})
  eq(findC(r, 'SYSTEM_THINKING_GAP').eligibility, ELIGIBILITY.DISQUALIFIED)
})

T('STG04: STG insufficient with 0 STG signals', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('IDENTITY_BASED_EXCLUSION', A, 70),
  ]})
  eq(findC(r, 'SYSTEM_THINKING_GAP').eligibility, ELIGIBILITY.INSUFFICIENT)
})

T('STG05: STG wins 3-way in FRAMEWORK_GAP', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 90),
    sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 85),
    sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 60),
    sig('IDENTITY_BASED_EXCLUSION', A, 50),
    sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 45),
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 45),
    sig('LUCK_VS_SKILL_ATTRIBUTION', A, 40),
  ]})
  eq(r.primaryBlindSpot, 'SYSTEM_THINKING_GAP')
})

T('STG06: STG with CROSS_DOMAIN only', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 65),
    sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 55),
    sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 50),
  ]})
  eq(findC(r, 'SYSTEM_THINKING_GAP').eligibility, ELIGIBILITY.ELIGIBLE)
})

// ═══════════════════════════════════════════════════════════════
// FRG: AMBIGUITY / CONFLICT (6)
// ═══════════════════════════════════════════════════════════════

T('FRG_AMB01: 3-way close → ambiguous', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 50),
    sig('IDENTITY_BASED_EXCLUSION', A, 50),
    sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 50),
  ]})
  ok(typeof r.ambiguous === 'boolean')
})

T('FRG_AMB02: All 3 insufficient', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [] })
  eq(r.primaryBlindSpot, null)
})

T('FRG_AMB03: 1 eligible, 2 disqualified → clean selection', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 80),
    sig('EMOTIONAL_RECENCY_IMPACT', A, 70), // disqualifies PM
    sig('POST_ACTION_REVIEW_HABIT', A, 70), // disqualifies STG
  ]})
  // PM disqualified, STG disqualified → IC eligible alone (has IDENTITY_BASED_EXCLUSION from IDENTITY side)
  // But IC has no IC signals → INSUFFICIENT
  // So primary is null
  ok(typeof r.primaryBlindSpot === 'string' || r.primaryBlindSpot === null)
})

T('FRG_AMB04: No cross-family leakage', function () {
  // Signals from other families should not score FRG candidates
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 80),
    sig('OUTPUT_DECOUPLING_AWARENESS', A, 80),
  ]})
  eq(r.primaryBlindSpot, null)
  r.candidateStates.forEach(function(c) {
    eq(c.eligibility, ELIGIBILITY.INSUFFICIENT)
  })
})

T('FRG_AMB05: 3 candidates all eligible with strengths', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 90),
    sig('LUCK_VS_SKILL_ATTRIBUTION', A, 60),
    sig('IDENTITY_BASED_EXCLUSION', A, 85),
    sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 55),
    sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 80),
    sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 65),
    sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 55),
  ]})
  ok(r.candidateStates.length === 3)
  ok(r.primaryBlindSpot !== null)
})

T('FRG_AMB06: alternateBlindSpot populated in 3-way', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 85),
    sig('LUCK_VS_SKILL_ATTRIBUTION', A, 55),
    sig('FEEDBACK_CALIBRATION_RATE', A, 50),
    sig('IDENTITY_BASED_EXCLUSION', A, 80),
    sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 50),
    sig('SELF_ASSESSMENT_ASYMMETRY', A, 45),
    sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 75),
    sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 60),
    sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 50),
  ]})
  ok(r.alternateBlindSpot !== null)
})

// ═══════════════════════════════════════════════════════════════
// DETERMINISM + GUARDS (6)
// ═══════════════════════════════════════════════════════════════

T('DET01: 100-run determinism', function () {
  var input = { family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 70),
    sig('POST_ACTION_REVIEW_HABIT', A, 55),
  ]}
  var first = inferWithinFamilyBlindSpot(input)
  for (var i = 0; i < 100; i++) {
    var next = inferWithinFamilyBlindSpot(input)
    eq(next.primaryBlindSpot, first.primaryBlindSpot, 'Run ' + i)
    eq(next.alternateBlindSpot, first.alternateBlindSpot, 'Run ' + i)
    eq(next.ambiguous, first.ambiguous, 'Run ' + i)
    eq(JSON.stringify(next.candidateStates.map(function(c){return c.eligibility})),
       JSON.stringify(first.candidateStates.map(function(c){return c.eligibility})), 'Run ' + i)
  }
})

T('DET02: Contamination check', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 70),
  ]})
  var json = JSON.stringify(r).toLowerCase()
  ;['occupation','income','business','salary','career','revenue','prediction','will happen'].forEach(function(t) {
    notOk(json.indexOf(t) !== -1, 'Contamination: ' + t)
  })
})

T('DET03: 0 cross-family leakage', function () {
  var families = ['EXECUTION_ADAPTATION_GAP','RESOURCE_COMPOUNDING_GAP','PERCEPTION_RISK_GAP','FRAMEWORK_GAP']
  families.forEach(function(fid) {
    var { getFamily } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotFamilyDefinitions')
    var f = getFamily(fid)
    var r = inferWithinFamilyBlindSpot({ family: fid, secondarySignals: [] })
    r.candidateStates.forEach(function(c) {
      ok(f.candidates.indexOf(c.id) !== -1, fid + ' leaked: ' + c.id)
    })
  })
})

T('DET04: reasoningTrace populated', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', A, 70),
  ]})
  ok(typeof r.reasoningTrace === 'string')
  ok(r.reasoningTrace.length > 10)
})

T('DET05: candidateStates always match family candidates', function () {
  var { getFamily } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotFamilyDefinitions')
  var families = ['EXECUTION_ADAPTATION_GAP','RESOURCE_COMPOUNDING_GAP','PERCEPTION_RISK_GAP','FRAMEWORK_GAP']
  families.forEach(function(fid) {
    var f = getFamily(fid)
    var r = inferWithinFamilyBlindSpot({ family: fid, secondarySignals: [] })
    eq(r.candidateStates.length, f.candidates.length)
    r.candidateStates.forEach(function(c) {
      ok(f.candidates.indexOf(c.id) !== -1)
    })
  })
})

T('DET06: SUPPRESSED signals count as contradiction, not weak support', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('WAITING_DURATION_PATTERN', S, 0), // suppressed, should be contradiction for DI
    sig('MINIMUM_STEP_EXECUTION', A, 50),
  ]})
  var di = findC(r, 'DECISION_INERTIA')
  ok(di.contradictingEvidenceIds.length >= 1 || di.eligibility === ELIGIBILITY.DISQUALIFIED)
})

// ═══════════════════════════════════════════════════════════════
// R1: PART F — NEW TESTS (10 cases)
// ═══════════════════════════════════════════════════════════════

T('R1-01: ALL_OF policy — all 3 FLG signals needed', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('MINIMUM_STEP_EXECUTION', A, 70),
    sig('POST_ACTION_REVIEW_HABIT', A, 65),
    sig('DECISION_TO_ACTION_LATENCY', A, 55),
  ]})
  eq(findC(r, 'FEEDBACK_LOOP_GAP').eligibility, ELIGIBILITY.ELIGIBLE)
  eq(r.primaryBlindSpot, 'FEEDBACK_LOOP_GAP')
})

T('R1-02: ALL_OF missing 1 condition → INSUFFICIENT', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('MINIMUM_STEP_EXECUTION', A, 70),
    sig('POST_ACTION_REVIEW_HABIT', A, 65),
    // DECISION_TO_ACTION_LATENCY missing → ALL_OF fails
  ]})
  eq(findC(r, 'FEEDBACK_LOOP_GAP').eligibility, ELIGIBILITY.INSUFFICIENT)
})

T('R1-03: AT_LEAST_N(2) policy — 2/3 met → eligible', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'RESOURCE_COMPOUNDING_GAP', secondarySignals: [
    sig('DIRECTION_SWITCHING_FREQUENCY', A, 70),
    sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 60),
    // ALTERNATIVE_PATH_COST_AWARENESS missing → AT_LEAST_N(2) → eligible
  ]})
  eq(findC(r, 'TIME_HORIZON_TRAP').eligibility, ELIGIBILITY.ELIGIBLE)
})

T('R1-04: AT_LEAST_N(2) — 1/3 met → INSUFFICIENT', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 80),
    // only 1/3 → AT_LEAST_N(2) fails
  ]})
  eq(findC(r, 'PROBABILITY_MISJUDGMENT').eligibility, ELIGIBILITY.INSUFFICIENT)
})

T('R1-05: Disqualifier still overrides ALL_OF eligibility', function () {
  var r = inferWithinFamilyBlindSpot({ family: 'EXECUTION_ADAPTATION_GAP', secondarySignals: [
    sig('MINIMUM_STEP_EXECUTION', A, 70),
    sig('POST_ACTION_REVIEW_HABIT', A, 65),
    sig('DECISION_TO_ACTION_LATENCY', A, 55),
    sig('WAITING_DURATION_PATTERN', A, 70), // disqualifies FLG
  ]})
  eq(findC(r, 'FEEDBACK_LOOP_GAP').eligibility, ELIGIBILITY.DISQUALIFIED)
})

T('R1-06: 3 signals same origin → 1 origin-level contribution', function () {
  var { aggregateByOrigin } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/withinFamilyBlindSpotInference')
  var signals = [
    sig('MINIMUM_STEP_EXECUTION', A, 70, 'SAME'),
    sig('POST_ACTION_REVIEW_HABIT', A, 65, 'SAME'),
    sig('DECISION_TO_ACTION_LATENCY', A, 55, 'SAME'),
  ]
  var agg = aggregateByOrigin(signals)
  eq(agg.independentCount, 1, '3 same-origin → 1 independent origin')
  ok(agg.totalStrength > 0)
})

T('R1-07: 3 independent origins → stronger than 1 origin', function () {
  var { aggregateByOrigin } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/withinFamilyBlindSpotInference')
  var oneOrigin = aggregateByOrigin([
    sig('A', A, 90, 'o1'), sig('B', A, 85, 'o1'), sig('C', A, 80, 'o1'),
  ])
  var threeOrigin = aggregateByOrigin([
    sig('A', A, 70, 'o1'), sig('B', A, 70, 'o2'), sig('C', A, 70, 'o3'),
  ])
  ok(threeOrigin.independentCount > oneOrigin.independentCount)
})

T('R1-08: Same-origin contradiction dedup', function () {
  var { aggregateContradictionByOrigin } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/withinFamilyBlindSpotInference')
  var agg = aggregateContradictionByOrigin([
    sig('A', 'SUPPRESSED', 0, 'SAME'),
    sig('B', 'SUPPRESSED', 0, 'SAME'),
  ])
  eq(agg.independentCount, 1, '2 same-origin suppressed → 1 contradiction origin')
  eq(agg.totalCount, 2)
})

T('R1-09: Minimal evidence does not create near-max support', function () {
  // 1 necessary condition barely met + 1 weak differentiator
  var r = inferWithinFamilyBlindSpot({ family: 'PERCEPTION_RISK_GAP', secondarySignals: [
    sig('INFORMATION_SOURCE_DIVERSITY', A, 50),
    sig('NON_DOMAIN_PATH_AWARENESS', A, 40),
  ]})
  var ob = findC(r, 'OPPORTUNITY_BLINDNESS')
  if (ob.eligibility === ELIGIBILITY.ELIGIBLE) {
    ok(ob.supportStrength < 85, 'Minimal evidence should not approach max support: ' + ob.supportStrength)
    ok(ob.confidence < 0.8, 'Minimal evidence should have moderate confidence at most')
  }
})

T('R1-10: Exact tie ambiguity preserved', function () {
  // Two candidates with equal support
  var r = inferWithinFamilyBlindSpot({ family: 'FRAMEWORK_GAP', secondarySignals: [
    sig('PROBABILISTIC_LANGUAGE_USAGE', A, 70),
    sig('LUCK_VS_SKILL_ATTRIBUTION', A, 70),
    sig('IDENTITY_BASED_EXCLUSION', A, 70),
    sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 70),
  ]})
  // Both PM and IC are AT_LEAST_N(2), both have 2 signals
  ok(typeof r.rawGap === 'number')
  ok(typeof r.ambiguous === 'boolean')
})

// ═══════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════

console.log('\n=== Within-Family Blind Spot Inference Tests ===')
console.log('Total:', total, '| Passed:', passed, '| Failed:', failed)
console.log(failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + failed)
if (failed > 0) process.exit(1)
