/**
 * tests/rc8.3-predicate-schema.test.js
 *
 * RC8.3 C3-001A — Predicate Schema Validation.
 *
 * Validates:
 * - All 12 predicate types are constructible
 * - All constructors produce valid nodes
 * - All nodes pass predicateValidator
 * - Edge cases: empty AND/OR, null, unknown types, malformed values
 *
 * @version world_model_v3
 * @sprint c3-001a
 */

var {
  PREDICATE_TYPE,
  and, or, not,
  signalPresent, signalAbsent,
  confidenceGte, confidenceLte,
  evidencePresent, evidenceAbsent,
  sourceTypeIs,
  independentEvidenceCountGte, supportCountGte, contradictionCountGte,
  signalPresentWithConfidenceGte,
  independentSupportCountGte,
} = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/predicateSchema')

var { validatePredicate } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/predicateValidator')

var total = 0, passed = 0, failed = 0

function T(name, fn) {
  total++
  try { fn(); passed++ }
  catch (e) { failed++; console.error('FAIL [' + name + ']: ' + e.message) }
}

function eq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': ' + a + ' !== ' + b) }
function ok(v, m) { if (!v) throw new Error((m || 'ok') + ': falsy') }
function notOk(v, m) { if (v) throw new Error((m || 'notOk') + ': truthy') }

// ── Constructor basic tests ──

T('SIGNAL_PRESENT constructor', function () {
  var n = signalPresent('DECISION_STABILITY')
  eq(n.type, PREDICATE_TYPE.SIGNAL_PRESENT)
  eq(n.signalId, 'DECISION_STABILITY')
})

T('SIGNAL_ABSENT constructor', function () {
  var n = signalAbsent('DECISION_DELAY')
  eq(n.type, PREDICATE_TYPE.SIGNAL_ABSENT)
})

T('CONFIDENCE_GTE constructor', function () {
  var n = confidenceGte('SIG', 0.8)
  eq(n.type, PREDICATE_TYPE.CONFIDENCE_GTE)
  eq(n.value, 0.8)
})

T('CONFIDENCE_LTE constructor', function () {
  var n = confidenceLte('SIG', 0.3)
  eq(n.type, PREDICATE_TYPE.CONFIDENCE_LTE)
  eq(n.value, 0.3)
})

T('EVIDENCE_PRESENT constructor', function () {
  var n = evidencePresent('BEHAVIORAL', 'PATTERN_X')
  eq(n.type, PREDICATE_TYPE.EVIDENCE_PRESENT)
  eq(n.sourceType, 'BEHAVIORAL')
})

T('EVIDENCE_ABSENT constructor', function () {
  var n = evidenceAbsent('PRIMARY_SIGNAL', 'SIG_X')
  eq(n.type, PREDICATE_TYPE.EVIDENCE_ABSENT)
})

T('SOURCE_TYPE_IS constructor', function () {
  var n = sourceTypeIs('QUESTIONNAIRE')
  eq(n.type, PREDICATE_TYPE.SOURCE_TYPE_IS)
})

T('INDEPENDENT_EVIDENCE_COUNT_GTE constructor', function () {
  var n = independentEvidenceCountGte(2)
  eq(n.type, PREDICATE_TYPE.INDEPENDENT_EVIDENCE_COUNT_GTE)
  eq(n.value, 2)
})

T('SUPPORT_COUNT_GTE constructor', function () {
  var n = supportCountGte(2)
  eq(n.type, PREDICATE_TYPE.SUPPORT_COUNT_GTE)
})

T('CONTRADICTION_COUNT_GTE constructor', function () {
  var n = contradictionCountGte(2)
  eq(n.type, PREDICATE_TYPE.CONTRADICTION_COUNT_GTE)
})

// ── Logical operators ──

T('AND with 2 conditions', function () {
  var n = and([signalPresent('A'), signalPresent('B')])
  eq(n.type, PREDICATE_TYPE.AND)
  eq(n.conditions.length, 2)
})

T('OR with 3 conditions', function () {
  var n = or([signalPresent('A'), signalPresent('B'), signalPresent('C')])
  eq(n.type, PREDICATE_TYPE.OR)
  eq(n.conditions.length, 3)
})

T('NOT wraps a single condition', function () {
  var n = not(signalPresent('A'))
  eq(n.type, PREDICATE_TYPE.NOT)
  eq(n.condition.type, PREDICATE_TYPE.SIGNAL_PRESENT)
})

// ── Combinators ──

T('signalPresentWithConfidenceGte', function () {
  var n = signalPresentWithConfidenceGte('SIG', 0.8)
  eq(n.type, PREDICATE_TYPE.AND)
  eq(n.conditions.length, 2)
})

T('independentSupportCountGte', function () {
  var n = independentSupportCountGte(2)
  eq(n.type, PREDICATE_TYPE.AND)
})

// ── Validation: valid nodes ──

T('validate: simple SIGNAL_PRESENT', function () {
  var r = validatePredicate(signalPresent('DECISION_STABILITY'))
  ok(r.valid)
})

T('validate: simple AND', function () {
  var r = validatePredicate(and([signalPresent('ABC'), signalPresent('DEF')]))
  ok(r.valid)
})

T('validate: nested OR with AND', function () {
  var r = validatePredicate(or([
    and([signalPresent('ABC'), confidenceGte('ABC', 0.5)]),
    signalPresent('DEF'),
  ]))
  ok(r.valid)
})

T('validate: complex NOT', function () {
  var r = validatePredicate(not(and([signalPresent('ABC'), signalPresent('DEF')])))
  ok(r.valid)
})

T('validate: EVIDENCE_PRESENT', function () {
  var r = validatePredicate(evidencePresent('BEHAVIORAL', 'PATTERN_X'))
  ok(r.valid)
})

T('validate: INDEPENDENT_EVIDENCE_COUNT_GTE', function () {
  var r = validatePredicate(independentEvidenceCountGte(2))
  ok(r.valid)
})

// ── Validation: invalid nodes ──

T('validate: empty AND rejects', function () {
  var r = validatePredicate(and([]))
  notOk(r.valid)
})

T('validate: empty OR rejects', function () {
  var r = validatePredicate(or([]))
  notOk(r.valid)
})

T('validate: null node rejects', function () {
  var r = validatePredicate(null)
  notOk(r.valid)
})

T('validate: undefined node rejects', function () {
  var r = validatePredicate(undefined)
  notOk(r.valid)
})

T('validate: unknown type rejects', function () {
  var r = validatePredicate({ type: 'UNKNOWN_TYPE' })
  notOk(r.valid)
})

T('validate: NOT without child rejects', function () {
  var r = validatePredicate({ type: PREDICATE_TYPE.NOT })
  notOk(r.valid)
})

T('validate: SIGNAL_PRESENT without signalId rejects', function () {
  var r = validatePredicate({ type: PREDICATE_TYPE.SIGNAL_PRESENT })
  notOk(r.valid)
})

T('validate: CONFIDENCE_GTE without value rejects', function () {
  var r = validatePredicate({ type: PREDICATE_TYPE.CONFIDENCE_GTE, signalId: 'SIG' })
  notOk(r.valid)
})

T('validate: CONFIDENCE_GTE out of range [0,1] rejects', function () {
  var r = validatePredicate(confidenceGte('SIG', 1.5))
  notOk(r.valid)
})

T('validate: CONTradiction_COUNT_GTE non-integer rejects', function () {
  var r = validatePredicate({ type: PREDICATE_TYPE.CONTRADICTION_COUNT_GTE, value: 1.5 })
  notOk(r.valid)
})

T('validate: COUNT_GTE < 1 rejects', function () {
  var r = validatePredicate(independentEvidenceCountGte(0))
  notOk(r.valid)
})

T('validate: EVIDENCE_PRESENT without sourceType rejects', function () {
  var r = validatePredicate({ type: PREDICATE_TYPE.EVIDENCE_PRESENT, reference: 'X' })
  notOk(r.valid)
})

T('validate: EVIDENCE_PRESENT invalid sourceType rejects', function () {
  var r = validatePredicate(evidencePresent('INVALID', 'X'))
  notOk(r.valid)
})

// ── Deep nesting ──

T('validate: deeply nested predicate', function () {
  var n = or([
    and([
      not(signalPresent('ABC')),
      signalPresentWithConfidenceGte('DEF', 0.7),
    ]),
    and([
      evidencePresent('BEHAVIORAL', 'GHI'),
      independentEvidenceCountGte(2),
      supportCountGte(2),
    ]),
  ])
  var r = validatePredicate(n)
  ok(r.valid)
})

// ── Report ──

console.log('\n=== Predicate Schema Tests ===')
console.log('Total:', total, '| Passed:', passed, '| Failed:', failed)
console.log(failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + failed)
if (failed > 0) process.exit(1)
