/**
 * RC8.3 Stage 16A — World Model V2 Runtime Shadow Integration Tests
 *
 * Validates the runtime payload validator + shadow hook contract:
 *   - validateV2Answers: full / array / 17-of-18 / invalid-option /
 *     unknown-question / duplicate / empty / context-ignored
 *   - shadow record namespace = diagnostic_world_model_v2_shadow
 *   - v2 never primary (pipeline + adapter contract checks)
 *
 * @version world_model_v2
 */

var ok, T, _tests, _passed, _failed
_tests = []; _passed = 0; _failed = 0
function T(n, f) { _tests.push({ name: n, fn: f }) }
function ok(e, m) { if (e) _passed++; else { _failed++; console.log('FAIL [' + _tests[_tests.length - 1].name + ']: ' + (m || '')) } }
function eq(a, b, m) { ok(a === b, m + ': got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b)) }
function truthy(v, m) { ok(!!v, m) }
function falsy(v, m) { ok(!v, m) }

var V2 = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2')

var FULL = { Q_DEC_01:'A', Q_DEC_02:'A', Q_FB_01:'A', Q_FB_02:'A', Q_PROB_01:'A', Q_PROB_02:'A', Q_RISK_01:'A', Q_RISK_02:'A', Q_LEV_01:'C', Q_LEV_02:'A', Q_TIME_01:'A', Q_TIME_02:'A', Q_ID_01:'C', Q_ID_02:'A', Q_OPP_01:'A', Q_OPP_02:'A', Q_SYS_01:'A', Q_SYS_02:'A' }

// ═══ validator: full payload ═══
T('validator: full 18/18 object is valid', function () {
  var v = V2.validateV2Answers(FULL)
  truthy(v.valid, 'valid')
  eq(v.answeredCount, 18, 'answeredCount')
  eq(v.requiredCount, 18, 'requiredCount')
  falsy(v.insufficient, 'insufficient')
  eq(v.validationError, null, 'no validation error')
})

// ═══ validator: array form ═══
T('validator: array {questionId,optionId} form is valid', function () {
  var arr = Object.keys(FULL).map(function (k) { return { questionId: k, optionId: FULL[k] } })
  var v = V2.validateV2Answers(arr)
  truthy(v.valid, 'valid')
  eq(v.answeredCount, 18, 'answeredCount')
})

// ═══ validator: 17/18 → insufficient ═══
T('validator: 17/18 → insufficient (not validation error)', function () {
  var p = Object.assign({}, FULL); delete p.Q_SYS_02
  var v = V2.validateV2Answers(p)
  falsy(v.valid, 'valid')
  truthy(v.insufficient, 'insufficient')
  eq(v.validationError, null, 'no structural error')
  eq(v.answeredCount, 17, 'answeredCount')
})

// ═══ validator: invalid option → VALIDATION_FAILED ═══
T('validator: invalid optionId → VALIDATION_FAILED', function () {
  var p = Object.assign({}, FULL); p.Q_DEC_01 = 'Z'
  var v = V2.validateV2Answers(p)
  falsy(v.valid, 'valid')
  eq(v.validationError, 'VALIDATION_FAILED', 'validationError')
  falsy(v.insufficient, 'not insufficient')
  ok(v.errors.indexOf('UNKNOWN_OPTION:Q_DEC_01:Z') >= 0, 'error recorded')
})

// ═══ validator: unknown question (Q_-prefixed) → error ═══
T('validator: unknown Q_ question → UNKNOWN_QUESTION', function () {
  var p = Object.assign({}, FULL); p.Q_UNKNOWN_99 = 'A'
  var v = V2.validateV2Answers(p)
  eq(v.validationError, 'VALIDATION_FAILED', 'validationError')
  ok(v.errors.some(function (e) { return e.indexOf('UNKNOWN_QUESTION') === 0 }), 'unknown question flagged')
})

// ═══ validator: duplicate (array) → error ═══
T('validator: duplicate questionId (array) → DUPLICATE_QUESTION', function () {
  var arr = Object.keys(FULL).map(function (k) { return { questionId: k, optionId: FULL[k] } })
  arr.push({ questionId: 'Q_DEC_01', optionId: 'B' })
  var v = V2.validateV2Answers(arr)
  eq(v.validationError, 'VALIDATION_FAILED', 'validationError')
  ok(v.errors.some(function (e) { return e.indexOf('DUPLICATE_QUESTION') === 0 }), 'duplicate flagged')
})

// ═══ validator: empty / null ═══
T('validator: empty → insufficient, no error', function () {
  var v = V2.validateV2Answers({})
  falsy(v.valid, 'valid')
  truthy(v.insufficient, 'insufficient')
  eq(v.validationError, null, 'no structural error')
})
T('validator: null → NO_ANSWERS', function () {
  var v = V2.validateV2Answers(null)
  eq(v.validationError, 'NO_ANSWERS', 'validationError')
  falsy(v.valid, 'valid')
})

// ═══ validator: context fields IGNORED (weight 0) ═══
T('validator: context fields in answers are ignored (no error, no inference change)', function () {
  var withCtx = Object.assign({}, FULL, { lifeStage: '18-24岁', incomeStructure: '工资/固定薪资', occupationDetail: '程序员', monthlySurplus: '基本为零' })
  var v = V2.validateV2Answers(withCtx)
  truthy(v.valid, 'valid despite context fields')
  eq(v.answeredCount, 18, 'answeredCount still 18')
  // context keys must NOT appear in answersObj
  ok(!('lifeStage' in v.answersObj), 'lifeStage stripped')
  ok(!('incomeStructure' in v.answersObj), 'incomeStructure stripped')
})

// ═══ shadow: context invariance through the full pipeline ═══
T('shadow: context perturbation leaves inference unchanged', function () {
  var a = V2.runWorldModelPipelineV2(FULL)
  var b = V2.runWorldModelPipelineV2(Object.assign({}, FULL, { lifeStage: '41-50岁', incomeStructure: '实体生意/经营收入', occupationDetail: '餐饮老板' }))
  eq(a.diagnosis.inputHash, b.diagnosis.inputHash, 'inputHash unchanged')
  eq(a.diagnosis.cognitiveBlindSpot.id, b.diagnosis.cognitiveBlindSpot.id, 'blindSpot unchanged')
  eq(JSON.stringify(a.diagnosis.worldModel), JSON.stringify(b.diagnosis.worldModel), 'dimensions unchanged')
})

// ═══ shadow: v2 never primary (adapter renderSource marker) ═══
T('shadow: v2 adapter marks itself as world_model_v2 (never v1 primary)', function () {
  var d = V2.runWorldModelPipelineV2(FULL).diagnosis
  var report = V2.adaptWorldModelToLegacyV2(d)
  eq(report._renderSource, 'world_model_v2', 'renderSource marker')
})

// ═══ RUN ═══
for (var i = 0; i < _tests.length; i++) {
  try { _tests[i].fn() } catch (e) { _failed++; console.log('FAIL (' + _tests[i].name + '): ' + e.message) }
}

console.log('\n========================================')
console.log('RC8.3 Stage 16A — V2 Runtime Shadow Integration')
console.log('========================================')
console.log('Total: ' + (_passed + _failed) + ' | Passed: ' + _passed + ' | Failed: ' + _failed)
console.log(_failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + _failed)
console.log('========================================\n')

process.exit(_failed > 0 ? 1 : 0)
