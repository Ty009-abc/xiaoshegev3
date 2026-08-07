/**
 * tests/rc8.3-predicate-evaluator.test.js
 *
 * RC8.3 C3-001B — Predicate Evaluator Tests.
 *
 * Tests deterministic evaluation of all 13 predicate types.
 *
 * @version world_model_v3
 * @sprint c3-001b
 */

var {
  evaluatePredicate,
  createContext,
  findAnySignal,
  getEvidenceOrigin,
} = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/predicateEvaluator')

var {
  and, or, not,
  signalPresent, signalAbsent,
  confidenceGte, confidenceLte,
  evidencePresent, evidenceAbsent,
  sourceTypeIs,
  independentEvidenceCountGte, supportCountGte, contradictionCountGte,
  signalPresentWithConfidenceGte,
  PREDICATE_TYPE,
} = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/predicateSchema')

var total = 0, passed = 0, failed = 0

function T(name, fn) {
  total++
  try { fn(); passed++ }
  catch (e) { failed++; console.error('FAIL [' + name + ']: ' + e.message) }
}

function eq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': ' + a + ' !== ' + b) }
function ok(v, m) { if (!v) throw new Error((m || 'ok') + ': falsy') }
function notOk(v, m) { if (v) throw new Error((m || 'notOk') + ': truthy') }

// ── SIGNAL_PRESENT ──

T('SIGNAL_PRESENT true when detected', function () {
  var ctx = createContext([], [{ signalId: 'ABC', detected: true, confidence: 0.8 }])
  var r = evaluatePredicate(signalPresent('ABC'), ctx)
  ok(r.result)
})

T('SIGNAL_PRESENT false when not detected', function () {
  var ctx = createContext([], [{ signalId: 'ABC', detected: false }])
  var r = evaluatePredicate(signalPresent('ABC'), ctx)
  notOk(r.result)
})

T('SIGNAL_PRESENT false when not found', function () {
  var ctx = createContext([], [])
  var r = evaluatePredicate(signalPresent('ABC'), ctx)
  notOk(r.result)
})

// ── SIGNAL_ABSENT ──

T('SIGNAL_ABSENT true when detected=false', function () {
  var ctx = createContext([], [{ signalId: 'ABC', detected: false }])
  var r = evaluatePredicate(signalAbsent('ABC'), ctx)
  ok(r.result)
})

T('SIGNAL_ABSENT true when not in input', function () {
  var ctx = createContext([], [])
  var r = evaluatePredicate(signalAbsent('ABC'), ctx)
  ok(r.result)
})

T('SIGNAL_ABSENT false when detected=true', function () {
  var ctx = createContext([], [{ signalId: 'ABC', detected: true }])
  var r = evaluatePredicate(signalAbsent('ABC'), ctx)
  notOk(r.result)
})

// ── CONFIDENCE_GTE ──

T('CONFIDENCE_GTE true when above threshold', function () {
  var ctx = createContext([], [{ signalId: 'ABC', confidence: 0.9 }])
  var r = evaluatePredicate(confidenceGte('ABC', 0.8), ctx)
  ok(r.result)
})

T('CONFIDENCE_GTE false when below threshold', function () {
  var ctx = createContext([], [{ signalId: 'ABC', confidence: 0.5 }])
  var r = evaluatePredicate(confidenceGte('ABC', 0.8), ctx)
  notOk(r.result)
})

// ── CONFIDENCE_LTE ──

T('CONFIDENCE_LTE true when below threshold', function () {
  var ctx = createContext([], [{ signalId: 'ABC', confidence: 0.3 }])
  var r = evaluatePredicate(confidenceLte('ABC', 0.5), ctx)
  ok(r.result)
})

T('CONFIDENCE_LTE false when above threshold', function () {
  var ctx = createContext([], [{ signalId: 'ABC', confidence: 0.9 }])
  var r = evaluatePredicate(confidenceLte('ABC', 0.5), ctx)
  notOk(r.result)
})

// ── EVIDENCE_PRESENT ──

T('EVIDENCE_PRESENT true when match found', function () {
  var ctx = createContext([{ sourceType: 'BEHAVIORAL', reference: 'PATTERN_X' }], [])
  var r = evaluatePredicate(evidencePresent('BEHAVIORAL', 'PATTERN_X'), ctx)
  ok(r.result)
})

T('EVIDENCE_PRESENT false when not found', function () {
  var ctx = createContext([], [])
  var r = evaluatePredicate(evidencePresent('BEHAVIORAL', 'PATTERN_X'), ctx)
  notOk(r.result)
})

// ── EVIDENCE_ABSENT ──

T('EVIDENCE_ABSENT true when not found', function () {
  var ctx = createContext([], [])
  var r = evaluatePredicate(evidenceAbsent('BEHAVIORAL', 'PATTERN_X'), ctx)
  ok(r.result)
})

T('EVIDENCE_ABSENT false when found', function () {
  var ctx = createContext([{ sourceType: 'BEHAVIORAL', reference: 'PATTERN_X' }], [])
  var r = evaluatePredicate(evidenceAbsent('BEHAVIORAL', 'PATTERN_X'), ctx)
  notOk(r.result)
})

// ── SOURCE_TYPE_IS ──

T('SOURCE_TYPE_IS true for valid type', function () {
  var r = evaluatePredicate(sourceTypeIs('PRIMARY_SIGNAL'), createContext([], []))
  ok(r.result)
})

T('SOURCE_TYPE_IS false for invalid type', function () {
  var r = evaluatePredicate(sourceTypeIs('INVALID'), createContext([], []))
  notOk(r.result)
})

// ── AND ──

T('AND all true → true', function () {
  var ctx = createContext([], [{ signalId: 'ABC', detected: true, confidence: 0.9 }])
  var r = evaluatePredicate(and([signalPresent('ABC'), confidenceGte('ABC', 0.8)]), ctx)
  ok(r.result)
})

T('AND one false → false', function () {
  var ctx = createContext([], [{ signalId: 'ABC', detected: true, confidence: 0.5 }])
  var r = evaluatePredicate(and([signalPresent('ABC'), confidenceGte('ABC', 0.8)]), ctx)
  notOk(r.result)
})

// ── OR ──

T('OR one true → true', function () {
  var ctx = createContext([], [{ signalId: 'ABC', detected: true }])
  var r = evaluatePredicate(or([signalPresent('ABC'), signalPresent('DEF')]), ctx)
  ok(r.result)
})

T('OR all false → false', function () {
  var ctx = createContext([], [])
  var r = evaluatePredicate(or([signalPresent('ABC'), signalPresent('DEF')]), ctx)
  notOk(r.result)
})

// ── NOT ──

T('NOT true → false', function () {
  var ctx = createContext([], [{ signalId: 'ABC', detected: true }])
  var r = evaluatePredicate(not(signalPresent('ABC')), ctx)
  notOk(r.result)
})

T('NOT false → true', function () {
  var ctx = createContext([], [])
  var r = evaluatePredicate(not(signalPresent('ABC')), ctx)
  ok(r.result)
})

// ── COUNT predicates ──

T('SUPPORT_COUNT_GTE with items', function () {
  var ctx = createContext([
    { sourceType: 'BEHAVIORAL', reference: 'A', originId: 'o1' },
    { sourceType: 'BEHAVIORAL', reference: 'B', originId: 'o2' },
  ], [])
  // Manually populate matched evidence
  ctx._matchedEvidence.add({ origin: 'o1', evidenceId: 'e1' })
  ctx._matchedEvidence.add({ origin: 'o2', evidenceId: 'e2' })
  var r = evaluatePredicate(supportCountGte(2), ctx)
  ok(r.result)
})

T('SUPPORT_COUNT_GTE below threshold', function () {
  var ctx = createContext([], [])
  var r = evaluatePredicate(supportCountGte(2), ctx)
  notOk(r.result)
})

T('CONTRADICTION_COUNT_GTE with items', function () {
  var ctx = createContext([], [])
  ctx._contradictionMatches.add({ origin: 'o1', evidenceId: 'e1' })
  ctx._contradictionMatches.add({ origin: 'o2', evidenceId: 'e2' })
  var r = evaluatePredicate(contradictionCountGte(2), ctx)
  ok(r.result)
})

T('INDEPENDENT_EVIDENCE_COUNT_GTE counts both support + contradiction origins', function () {
  var ctx = createContext([], [])
  ctx._matchedEvidence.add({ origin: 'o1', evidenceId: 'e1' })
  ctx._contradictionMatches.add({ origin: 'o2', evidenceId: 'e2' })
  var r = evaluatePredicate(independentEvidenceCountGte(2), ctx)
  ok(r.result)
})

// ── Combined predicates ──

T('signalPresentWithConfidenceGte combinator', function () {
  var ctx = createContext([], [{ signalId: 'DECISION_STABILITY', detected: true, confidence: 0.85 }])
  var r = evaluatePredicate(signalPresentWithConfidenceGte('DECISION_STABILITY', 0.8), ctx)
  ok(r.result)
})

T('signalPresentWithConfidenceGte fails on low confidence', function () {
  var ctx = createContext([], [{ signalId: 'DECISION_STABILITY', detected: true, confidence: 0.5 }])
  var r = evaluatePredicate(signalPresentWithConfidenceGte('DECISION_STABILITY', 0.8), ctx)
  notOk(r.result)
})

// ── Prefer detected=true signal ──

T('findAnySignal prefers detected=true when duplicates exist', function () {
  var sig = findAnySignal([], [
    { signalId: 'SIG', detected: false, confidence: 0.5 },
    { signalId: 'SIG', detected: true, confidence: 0.9 },
  ], 'SIG')
  ok(sig.detected === true)
  ok(sig.confidence === 0.9)
})

// ── Trace output ──

T('trace includes result and reason', function () {
  var ctx = createContext([], [{ signalId: 'ABC', detected: true, confidence: 0.9 }])
  var r = evaluatePredicate(signalPresent('ABC'), ctx)
  ok(r.hasOwnProperty('result'))
  ok(r.hasOwnProperty('reason'))
  ok(r.hasOwnProperty('predicateType'))
})

// ── Report ──

console.log('\n=== Predicate Evaluator Tests ===')
console.log('Total:', total, '| Passed:', passed, '| Failed:', failed)
console.log(failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + failed)
if (failed > 0) process.exit(1)
