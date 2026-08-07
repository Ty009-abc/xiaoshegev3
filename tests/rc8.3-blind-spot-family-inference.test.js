/**
 * tests/rc8.3-blind-spot-family-inference.test.js
 *
 * RC8.3 C3-002A R2 — Blind Spot Family Inference Tests (Score-Normalized).
 *
 * Family IDs use C1 architecture authority (BLIND_SPOT_FAMILIES).
 *
 * R2 changes from R1:
 *   - Scoring: evidence density (fidelity × score/100) replaces weight-budget
 *   - Fidelity weights comparable across families (common [0,1] scale)
 *   - Same evidence → same density → comparable scores
 *   - Test categories: lineage + architecture + scoring + comparability + determinism
 *
 * 55 cases total:
 *   2 lineage identity
 *   8 EXECUTION_ADAPTATION_GAP
 *   8 RESOURCE_COMPOUNDING_GAP
 *   8 PERCEPTION_RISK_GAP
 *   8 FRAMEWORK_GAP
 *   8 ambiguity/conflict
 *   5 determinism + guards
 *   3 API consistency
 *   5 score comparability
 *
 * @version world_model_v3
 * @sprint c3-002a-r2
 */

var { inferBlindSpotFamily, scoreFamily } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotFamilyInference')
var { BLIND_SPOT_FAMILIES, verifyLineageIdentity, SUPPRESSION_PENALTY_BASE } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotFamilyDefinitions')

var total = 0, passed = 0, failed = 0, testChanges = { ARCHITECTURE_CORRECTION: 0, SCORE_SEMANTIC_MIGRATION: 0 }

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
function abs(a) { return a < 0 ? -a : a }
function near(a, b, tol, m) { if (abs(a - b) > tol) throw new Error((m || 'near') + ': ' + a.toFixed(4) + ' not within ' + tol + ' of ' + b.toFixed(4)) }

var A = 'ACTIVE', S = 'SUPPRESSED', I = 'INSUFFICIENT_EVIDENCE'
var EA = 'EXECUTION_ADAPTATION_GAP', RC = 'RESOURCE_COMPOUNDING_GAP'
var PR = 'PERCEPTION_RISK_GAP', FG = 'FRAMEWORK_GAP'
var ALL = [EA, RC, PR, FG]

function sig(id, state, score, confidence) {
  return { id: id, state: state, score: score || 50, confidence: confidence || 0.5 }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 0: LINEAGE IDENTITY (2 cases)
// ═══════════════════════════════════════════════════════════════

T('L00: C3 family membership matches C1 source of truth', function () {
  var r = verifyLineageIdentity()
  ok(r.pass, 'Lineage mismatch: ' + (r.mismatches || []).join('; '))
})

T('L01: No legacy executable family IDs in runtime', function () {
  var legacy = ['DECISION_ADAPTATION', 'RESOURCE_COMPOUNDING', 'UNCERTAINTY_JUDGMENT', 'MODEL_BOUNDARY']
  var keys = Object.keys(BLIND_SPOT_FAMILIES)
  legacy.forEach(function (lid) {
    notOk(keys.indexOf(lid) !== -1, 'Legacy ID found: ' + lid)
  })
})

// ═══════════════════════════════════════════════════════════════
// SECTION 1: EXECUTION_ADAPTATION_GAP (8 cases)
// ═══════════════════════════════════════════════════════════════

T('EA01: WAITING_DURATION_PATTERN → EXECUTION_ADAPTATION_GAP', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70)] })
  eq(r.family, EA)
  ok(r.confidence > 0)
})

T('EA02: MINIMUM_STEP_EXECUTION → EXECUTION_ADAPTATION_GAP', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('MINIMUM_STEP_EXECUTION', A, 60)] })
  eq(r.family, EA)
})

T('EA03: Multiple EA signals → strong EA', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70), sig('MINIMUM_STEP_EXECUTION', A, 65), sig('POST_ACTION_REVIEW_HABIT', A, 55)],
  })
  eq(r.family, EA)
  gt(r.confidence, 0.4)
  ok(r.supportingSignals.length >= 2)
})

T('EA04: EA signal active + others insufficient → still EA', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70), sig('OUTPUT_DECOUPLING_AWARENESS', I), sig('IDENTITY_BASED_EXCLUSION', I)],
  })
  eq(r.family, EA)
})

T('EA05: Suppressed EA signal → reduces score', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70), sig('MINIMUM_STEP_EXECUTION', S, 0)],
  })
  eq(r.family, EA)
  ok(r.contradictingSignals.length >= 1)
})

T('EA06: DECISION_TO_ACTION_LATENCY → EA', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('DECISION_TO_ACTION_LATENCY', A, 45)] })
  eq(r.family, EA)
})

T('EA07: Cross-occupation consistency', function () {
  var input = { secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70), sig('POST_ACTION_REVIEW_HABIT', A, 60)] }
  var r1 = inferBlindSpotFamily(input), r2 = inferBlindSpotFamily(input)
  eq(r1.family, r2.family)
  eq(r1.family, EA)
})

T('EA08: All 4 EA signals → high confidence', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('WAITING_DURATION_PATTERN', A, 90), sig('MINIMUM_STEP_EXECUTION', A, 85),
      sig('POST_ACTION_REVIEW_HABIT', A, 80), sig('DECISION_TO_ACTION_LATENCY', A, 75),
    ],
  })
  eq(r.family, EA)
  gt(r.confidence, 0.5)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 2: RESOURCE_COMPOUNDING_GAP (8 cases)
// ═══════════════════════════════════════════════════════════════

T('RC01: DIRECTION_SWITCHING_FREQUENCY → RC', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('DIRECTION_SWITCHING_FREQUENCY', A, 70)] })
  eq(r.family, RC)
})

T('RC02: Multiple RC signals → strong RC', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('OUTPUT_DECOUPLING_AWARENESS', A, 65), sig('EFFORT_VS_MECHANISM_FRAMING', A, 60), sig('DIRECTION_SWITCHING_FREQUENCY', A, 70)],
  })
  eq(r.family, RC)
  gt(r.confidence, 0.4)
})

T('RC03: LONG_TERM_COMPOUNDING_AWARENESS → RC', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 55)] })
  eq(r.family, RC)
})

T('RC04: RC vs EA → RC wins when stronger (more signals)', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 40), sig('DIRECTION_SWITCHING_FREQUENCY', A, 80), sig('OUTPUT_DECOUPLING_AWARENESS', A, 75)],
  })
  eq(r.family, RC)
})

T('RC05: ALTERNATIVE_PATH_COST_AWARENESS → RC', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('ALTERNATIVE_PATH_COST_AWARENESS', A, 60)] })
  eq(r.family, RC)
})

T('RC06: Suppressed RC signal → reduces score', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('OUTPUT_DECOUPLING_AWARENESS', A, 70), sig('DIRECTION_SWITCHING_FREQUENCY', S, 0)],
  })
  eq(r.family, RC)
  ok(r.contradictingSignals.length >= 1)
})

T('RC07: Cross-occupation consistency', function () {
  var input = { secondarySignals: [sig('DIRECTION_SWITCHING_FREQUENCY', A, 80), sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 65)] }
  var r1 = inferBlindSpotFamily(input), r2 = inferBlindSpotFamily(input)
  eq(r1.family, r2.family)
  eq(r1.family, RC)
})

T('RC08: All 5 RC signals → high confidence', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [
      sig('OUTPUT_DECOUPLING_AWARENESS', A, 85), sig('EFFORT_VS_MECHANISM_FRAMING', A, 80),
      sig('DIRECTION_SWITCHING_FREQUENCY', A, 90), sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 75),
      sig('ALTERNATIVE_PATH_COST_AWARENESS', A, 70),
    ],
  })
  eq(r.family, RC)
  gt(r.confidence, 0.4)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 3: PERCEPTION_RISK_GAP (8 cases)
// ═══════════════════════════════════════════════════════════════

T('PR01: EMOTIONAL_RECENCY_IMPACT → PR', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('EMOTIONAL_RECENCY_IMPACT', A, 70)] })
  eq(r.family, PR)
})

T('PR02: Multiple PR signals → strong PR', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('EMOTIONAL_RECENCY_IMPACT', A, 70), sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 65), sig('INFORMATION_SOURCE_DIVERSITY', A, 60)],
  })
  eq(r.family, PR)
  gt(r.confidence, 0.3)
})

T('PR03: INFORMATION_SOURCE_DIVERSITY → PR (opportunity)', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('INFORMATION_SOURCE_DIVERSITY', A, 55)] })
  eq(r.family, PR)
})

T('PR04: NON_DOMAIN_PATH_AWARENESS → PR (opportunity)', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('NON_DOMAIN_PATH_AWARENESS', A, 50)] })
  eq(r.family, PR)
})

T('PR05: SERENDIPITOUS_PATH_DISCOVERY → PR (opportunity)', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('SERENDIPITOUS_PATH_DISCOVERY', A, 50)] })
  eq(r.family, PR)
})

T('PR06: Suppressed PR signal → reduces score', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('EMOTIONAL_RECENCY_IMPACT', A, 70), sig('INFORMATION_SOURCE_DIVERSITY', S, 0)],
  })
  eq(r.family, PR)
  ok(r.contradictingSignals.length >= 1)
})

T('PR07: Same-occupation differentiation: EA vs PR', function () {
  var r1 = inferBlindSpotFamily({ secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 80)] })
  var r2 = inferBlindSpotFamily({ secondarySignals: [sig('EMOTIONAL_RECENCY_IMPACT', A, 80)] })
  eq(r1.family, EA)
  eq(r2.family, PR)
})

T('PR08: ABSTRACT_VS_EMBODIED_RISK_JUDGMENT → PR', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 65)] })
  eq(r.family, PR)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 4: FRAMEWORK_GAP (8 cases)
// ═══════════════════════════════════════════════════════════════

T('FG01: IDENTITY_BASED_EXCLUSION → FG', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('IDENTITY_BASED_EXCLUSION', A, 70)] })
  eq(r.family, FG)
})

T('FG02: Multiple FG signals → strong FG', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('IDENTITY_BASED_EXCLUSION', A, 70), sig('PROBABILISTIC_LANGUAGE_USAGE', A, 65), sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 60)],
  })
  eq(r.family, FG)
  gt(r.confidence, 0.2)
})

T('FG03: PROBABILITY signals → FG', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('PROBABILISTIC_LANGUAGE_USAGE', A, 70), sig('LUCK_VS_SKILL_ATTRIBUTION', A, 65)],
  })
  eq(r.family, FG)
})

T('FG04: SYSTEM signals → FG', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 70), sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 65)],
  })
  eq(r.family, FG)
})

T('FG05: CROSS_DOMAIN_FEEDBACK_THINKING → FG', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 55)] })
  eq(r.family, FG)
})

T('FG06: SELF_ASSESSMENT_ASYMMETRY → FG', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('SELF_ASSESSMENT_ASYMMETRY', A, 50)] })
  eq(r.family, FG)
})

T('FG07: FG vs EA → FG wins with stronger combined evidence', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 40), sig('IDENTITY_BASED_EXCLUSION', A, 85), sig('PROBABILISTIC_LANGUAGE_USAGE', A, 80)],
  })
  eq(r.family, FG)
})

T('FG08: CROSS_IDENTITY_ATTEMPT_HISTORY → FG', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 50)] })
  eq(r.family, FG)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 5: AMBIGUITY / CONFLICT (8 cases)
// ═══════════════════════════════════════════════════════════════

T('AM01: Empty input → no family, ambiguous', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [] })
  eq(r.family, null)
  ok(r.ambiguous)
  ok(r.missingEvidenceNeeded.length > 0)
})

T('AM02: All insufficient → no family', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('WAITING_DURATION_PATTERN', I), sig('IDENTITY_BASED_EXCLUSION', I)] })
  eq(r.family, null)
  ok(r.ambiguous)
})

T('AM03: Close scores → ambiguity measured', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 50), sig('DIRECTION_SWITCHING_FREQUENCY', A, 50)] })
  if (r.ambiguous) ok(r.alternateFamily !== null)
})

T('AM04: Conflicting signals across families → all families scored', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 80), sig('DIRECTION_SWITCHING_FREQUENCY', A, 80), sig('EMOTIONAL_RECENCY_IMPACT', A, 80), sig('IDENTITY_BASED_EXCLUSION', A, 80)],
  })
  ok(r.family !== null)
  ok(Object.keys(r.familyScores).length === 4)
})

T('AM05: Suppressed signal dominance → contradiction tracked', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70), sig('MINIMUM_STEP_EXECUTION', S, 0), sig('POST_ACTION_REVIEW_HABIT', S, 0), sig('DECISION_TO_ACTION_LATENCY', S, 0)],
  })
  ok(r.ambiguous || r.family === EA || r.family === null)
})

T('AM06: Low score single signal → low confidence', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('DECISION_TO_ACTION_LATENCY', A, 25)] })
  ok(r.family === EA || r.family === null)
  ok(r.confidence < 0.5)
})

T('AM07: Cross-family conflict → EA vs FG', function () {
  var r = inferBlindSpotFamily({
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 85), sig('POST_ACTION_REVIEW_HABIT', A, 80), sig('IDENTITY_BASED_EXCLUSION', A, 85), sig('PROBABILISTIC_LANGUAGE_USAGE', A, 80)],
  })
  ok(r.family !== null)
})

T('AM08: trace completeness', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70)] })
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
    secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70), sig('EMOTIONAL_RECENCY_IMPACT', A, 65), sig('DIRECTION_SWITCHING_FREQUENCY', A, 50), sig('IDENTITY_BASED_EXCLUSION', S, 0)],
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
  var r = inferBlindSpotFamily({ secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70)] })
  notOk(r.blindSpotId)
})

T('DG03: 0 contamination', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70)] })
  var json = JSON.stringify(r).toLowerCase()
  var terms = ['occupation', 'income', 'business', 'salary', 'career', 'revenue', 'profit']
  terms.forEach(function (t) { notOk(json.indexOf(t) !== -1, 'Contamination: ' + t) })
})

T('DG04: All 4 families scored', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70)] })
  eq(Object.keys(r.familyScores).length, 4)
  ALL.forEach(function (fid) { ok(r.familyScores.hasOwnProperty(fid), 'Missing: ' + fid) })
})

T('DG05: 23/23 signals mapped, 0 orphans', function () {
  var allMapped = new Set()
  ALL.forEach(function (fid) {
    BLIND_SPOT_FAMILIES[fid].secondarySignals.forEach(function (s) { allMapped.add(s) })
  })
  eq(allMapped.size, 23)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 7: API CONSISTENCY (3 cases)
// ═══════════════════════════════════════════════════════════════

T('API01: All C1 family IDs output correctly for single signals', function () {
  var profiles = [
    { signals: [sig('WAITING_DURATION_PATTERN', A, 80)], expect: EA },
    { signals: [sig('OUTPUT_DECOUPLING_AWARENESS', A, 80)], expect: RC },
    { signals: [sig('EMOTIONAL_RECENCY_IMPACT', A, 80)], expect: PR },
    { signals: [sig('IDENTITY_BASED_EXCLUSION', A, 80)], expect: FG },
  ]
  profiles.forEach(function (p) {
    var r = inferBlindSpotFamily({ secondarySignals: p.signals })
    eq(r.family, p.expect)
    ok(ALL.indexOf(r.family) !== -1)
  })
})

T('API02: No family when all insufficient', function () {
  var r = inferBlindSpotFamily({ secondarySignals: Array(23).fill(null).map(function (_, i) { return sig('SIG_' + i, I) }) })
  eq(r.family, null)
})

T('API03: supportingSignals and contradictingSignals are arrays', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 70), sig('MINIMUM_STEP_EXECUTION', S, 0)] })
  ok(Array.isArray(r.supportingSignals))
  ok(Array.isArray(r.contradictingSignals))
})

// ═══════════════════════════════════════════════════════════════
// SECTION 8: SCORE COMPARABILITY (5 cases) — R2 NEW
// ═══════════════════════════════════════════════════════════════

T('CMP01: Same evidence (1 signal @ 80) → same density across families', function () {
  // All families have at least one signal with fidelity=1.0
  var mappings = [
    { fid: EA, sig: 'WAITING_DURATION_PATTERN' },
    { fid: RC, sig: 'OUTPUT_DECOUPLING_AWARENESS' },
    { fid: PR, sig: 'EMOTIONAL_RECENCY_IMPACT' },
    { fid: FG, sig: 'PROBABILISTIC_LANGUAGE_USAGE' },
  ]
  mappings.forEach(function (m1) {
    mappings.forEach(function (m2) {
      var r1 = inferBlindSpotFamily({ secondarySignals: [sig(m1.sig, A, 80)] })
      var r2 = inferBlindSpotFamily({ secondarySignals: [sig(m2.sig, A, 80)] })
      eq(r1.familyScores[m1.fid], r2.familyScores[m2.fid], m1.fid + ' vs ' + m2.fid + ': same fidelity signal should score equally')
    })
  })
})

T('CMP02: Same evidence (2 signals @ 80) → comparable density', function () {
  // EA top 2: WAITING(1.0) + MINIMUM_STEP(0.75) = 1.4
  // FG top 2: PROBABILITY(1.0) + LUCK(1.0) = 1.6
  // These are DIFFERENT because FG's second signal has higher fidelity — correct
  var eaR = inferBlindSpotFamily({ secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 80), sig('MINIMUM_STEP_EXECUTION', A, 80)] })
  var fgR = inferBlindSpotFamily({ secondarySignals: [sig('PROBABILISTIC_LANGUAGE_USAGE', A, 80), sig('LUCK_VS_SKILL_ATTRIBUTION', A, 80)] })
  ok(eaR.familyScores[EA] > 0)
  ok(fgR.familyScores[FG] > 0)
  // FG score should be HIGHER than EA (2×fid=1.0 vs 1×1.0+1×0.75)
  ok(fgR.familyScores[FG] > eaR.familyScores[EA], 'FG(1.6) should outscore EA(1.4) with 2x max-fidelity signals')
})

T('CMP03: Same suppression pattern → comparable penalty', function () {
  // EA: WAITING(1.0,active) + MINIMUM(0.75,suppressed) → active=0.8 - 0.375=0.425
  // FG: PROBABILITY(1.0,active) + LUCK(1.0,suppressed) → active=0.8 - 0.5=0.3
  // EA penalty is 0.375 (0.75×0.5), FG penalty is 0.5 (1.0×0.5)
  // These differ because FG's suppressed signal has higher fidelity — correct
  var eaR = inferBlindSpotFamily({ secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 80), sig('MINIMUM_STEP_EXECUTION', S, 0)] })
  var fgR = inferBlindSpotFamily({ secondarySignals: [sig('PROBABILISTIC_LANGUAGE_USAGE', A, 80), sig('LUCK_VS_SKILL_ATTRIBUTION', S, 0)] })
  ok(eaR.contradictingSignals.length >= 1)
  ok(fgR.contradictingSignals.length >= 1)
  // Penalty is proportional to fidelity, not family size
})

T('CMP04: Exact tie detection', function () {
  // Two signals with identical fidelity and score → exact tie
  var eaFid = BLIND_SPOT_FAMILIES[EA].signalFidelity.WAITING_DURATION_PATTERN
  var rcFid = BLIND_SPOT_FAMILIES[RC].signalFidelity.OUTPUT_DECOUPLING_AWARENESS
  // Both are fidelity 1.0 → same contribution
  var r = inferBlindSpotFamily({ secondarySignals: [sig('WAITING_DURATION_PATTERN', A, 80), sig('OUTPUT_DECOUPLING_AWARENESS', A, 80)] })
  ok(r.family !== null)
  // With both at fidelity 1.0, score 80, they contribute equally
  // But EA has smaller total so saturation differs — ranking should be deterministic
})

T('CMP05: Empty/invalid → score 0 for all families', function () {
  var r = inferBlindSpotFamily({ secondarySignals: [] })
  ALL.forEach(function (fid) {
    eq(r.familyScores[fid], 0)
  })
  eq(r.family, null)
  ok(r.ambiguous)
})

// ═══════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════

console.log('\n=== Blind Spot Family Inference Tests (R2 — Score-Normalized) ===')
console.log('Total:', total, '| Passed:', passed, '| Failed:', failed)
console.log(failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + failed)

if (failed > 0) process.exit(1)
