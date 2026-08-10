/**
 * RC8.3 Phase-2 005 R1 — Canonical Raw Answers Fidelity Regression Test
 *
 * Catches if runWorldModelPipeline() is ever called again
 * with a nested wrapper instead of flat raw answers.
 *
 * 100% behavioral (no source scans).
 */

var ok, T, _tests, _passed, _failed

// Tiny test runner
_tests = []
_passed = 0
_failed = 0

function T(name, fn) {
  _tests.push({ name: name, fn: fn })
}

function ok(expr, msg) {
  if (expr) { _passed++ } else {
    _failed++
    console.log('FAIL [' + _tests[_tests.length - 1].name + ']: ' + (msg || 'assertion failed'))
  }
}

function eq(a, b, msg) { ok(a === b, msg + ': expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)) }
function gt(a, b, msg) { ok(a > b, msg + ': expected > ' + b + ' got ' + a) }
function truthy(v, msg) { ok(!!v, msg) }
function type(v, t, msg) { ok(typeof v === t, msg + ': expected ' + t + ' got ' + typeof v) }

var { runWorldModelPipeline } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldModelPipeline')

// ═══════════════════════════════════════════════════════════════
// Profile A — 厨师 / 有经验 / 低风险（分期问卷画像）
// ═══════════════════════════════════════════════════════════════
var profileA = {
  lifeStage: '31-40岁',
  incomeStructure: '工资/固定薪资',
  occupationDetail: '厨师',
  monthlySurplus: '1000-5000元',
  safetyMonths: '6-12个月',
  debtPressure: '房贷为主（低月供）',
  skillValidation: '偶尔有付费需求',
  monetizableSkill: '手艺人（厨师/维修/美业）',
  weeklyTime: '20小时以上',
  executionStability: '有固定计划，基本能执行',
  pastAttemptStage: '卖出过几个，有少量收入',
  decisionStyle: '边上班边小规模测试',
  primaryGoal: '转行进入新领域',
  maxTrialCost: '1000-5000元',
  failureResponse: '复盘优化后继续',
}

// ═══════════════════════════════════════════════════════════════
// Profile B — 不稳定 / 高风险 / 无经验
// ═══════════════════════════════════════════════════════════════
var profileB = {
  lifeStage: '18-24岁',
  incomeStructure: '无固定收入',
  occupationDetail: '',
  monthlySurplus: '几乎没有结余',
  safetyMonths: '1个月以下',
  debtPressure: '无负债',
  skillValidation: '从来没有付费需求',
  monetizableSkill: '我是打工人，没有副业技能',
  weeklyTime: '5小时以下',
  executionStability: '没有固定计划，凭感觉行动',
  pastAttemptStage: '想过但从未动手',
  decisionStyle: '反复纠结无法下决心',
  primaryGoal: '找到稳定的副业方向',
  maxTrialCost: '0-200元',
  failureResponse: '重新调整目标再开始',
}

// ───────────────────────────────────────────────────────────────
// SECTION 1: Fidelity — canonical raw-answer contract
// ───────────────────────────────────────────────────────────────
T('FID-01: pipeline returns valid for real V4 answers', function () {
  var r = runWorldModelPipeline(profileA, { version: 'world_model_v1' })
  truthy(r, 'result exists')
  eq(r.valid, true, 'valid')
})

T('FID-02: diagnosis exists', function () {
  var r = runWorldModelPipeline(profileA, { version: 'world_model_v1' })
  truthy(r.diagnosis, 'diagnosis exists')
  type(r.diagnosis, 'object', 'diagnosis type')
})

T('FID-03: diagnosis version is world_model_v1', function () {
  var r = runWorldModelPipeline(profileA, { version: 'world_model_v1' })
  eq(r.diagnosis.version, 'world_model_v1', 'version')
})

T('FID-04: evidence coverage > 0', function () {
  var r = runWorldModelPipeline(profileA, { version: 'world_model_v1' })
  gt(r.diagnosis.inputCoverage, 0, 'inputCoverage')
})

T('FID-05: normalized evidence count > 0', function () {
  var r = runWorldModelPipeline(profileA, { version: 'world_model_v1' })
  gt(r.diagnosis.trace.evidenceCount, 0, 'evidenceCount')
})

T('FID-06: behavior signals extracted', function () {
  var r = runWorldModelPipeline(profileA, { version: 'world_model_v1' })
  truthy(r.diagnosis.behaviorSignals, 'behaviorSignals exists')
  ok(r.diagnosis.behaviorSignals.length > 0, 'signals count > 0: ' + r.diagnosis.behaviorSignals.length)
})

T('FID-07: cognitiveArchetype exists', function () {
  var r = runWorldModelPipeline(profileA, { version: 'world_model_v1' })
  truthy(r.diagnosis.cognitiveArchetype, 'cognitiveArchetype exists')
  truthy(r.diagnosis.cognitiveArchetype.primary, 'archetype primary')
})

T('FID-08: cognitiveBlindSpot exists', function () {
  var r = runWorldModelPipeline(profileA, { version: 'world_model_v1' })
  truthy(r.diagnosis.cognitiveBlindSpot, 'cognitiveBlindSpot exists')
  truthy(r.diagnosis.cognitiveBlindSpot.primary, 'blindSpot primary')
})

T('FID-09: worldStrategy exists', function () {
  var r = runWorldModelPipeline(profileA, { version: 'world_model_v1' })
  truthy(r.diagnosis.worldStrategy, 'worldStrategy exists')
  truthy(r.diagnosis.worldStrategy.primary, 'strategy primary')
})

// ───────────────────────────────────────────────────────────────
// SECTION 2: Wrapper pattern produces zero evidence (CATCHES BUG)
// ───────────────────────────────────────────────────────────────
T('FID-10: wrapper pattern FAILS — evidence is zero', function () {
  var wrapper = { inputProfile: { signals: [], occupation: '', yearsOfExperience: 0 }, evidenceTrace: [], context: {} }
  var r = runWorldModelPipeline(wrapper, { version: 'world_model_v1' })
  // Wrapper should produce near-zero evidence
  var cov = r.diagnosis.inputCoverage
  var ec = r.diagnosis.trace.evidenceCount
  ok(cov === 0, 'wrapper inputCoverage MUST be zero, got ' + cov)
  ok(ec === 0, 'wrapper evidenceCount MUST be zero, got ' + ec)
})

T('FID-11: canonical contract vs wrapper — fidelity gap confirmed', function () {
  var wrapper = { inputProfile: { signals: [], occupation: '', yearsOfExperience: 0 }, evidenceTrace: [], context: {} }
  var rWrap = runWorldModelPipeline(wrapper, { version: 'world_model_v1' })
  var rReal = runWorldModelPipeline(profileA, { version: 'world_model_v1' })
  ok(rReal.diagnosis.inputCoverage > rWrap.diagnosis.inputCoverage, 'real coverage > wrapper coverage')
  ok(rReal.diagnosis.trace.evidenceCount > rWrap.diagnosis.trace.evidenceCount, 'real evidence > wrapper evidence')
})

// ───────────────────────────────────────────────────────────────
// SECTION 3: Differentiation — two real profiles
// ───────────────────────────────────────────────────────────────
var rA = runWorldModelPipeline(profileA, { version: 'world_model_v1' })
var rB = runWorldModelPipeline(profileB, { version: 'world_model_v1' })

T('DIFF-01: inputHash differs', function () {
  ok(rA.diagnosis.inputHash !== rB.diagnosis.inputHash, 'hash A=' + rA.diagnosis.inputHash + ' hash B=' + rB.diagnosis.inputHash)
})

T('DIFF-02: at least one output differs', function () {
  var archetypeDiff = rA.diagnosis.cognitiveArchetype.primary !== rB.diagnosis.cognitiveArchetype.primary
  var blindDiff = rA.diagnosis.cognitiveBlindSpot.primary !== rB.diagnosis.cognitiveBlindSpot.primary
  var strategyDiff = rA.diagnosis.worldStrategy.primary !== rB.diagnosis.worldStrategy.primary
  var signalDiff = JSON.stringify(
    (rA.diagnosis.behaviorSignals || []).filter(function (s) { return s.active }).map(function (s) { return s.id }).sort()
  ) !== JSON.stringify(
    (rB.diagnosis.behaviorSignals || []).filter(function (s) { return s.active }).map(function (s) { return s.id }).sort()
  )
  ok(archetypeDiff || blindDiff || strategyDiff || signalDiff, 'at least one output differs')
  console.log('  archetype: ' + rA.diagnosis.cognitiveArchetype.primary + ' vs ' + rB.diagnosis.cognitiveArchetype.primary + ' (diff=' + archetypeDiff + ')')
  console.log('  blindSpot: ' + rA.diagnosis.cognitiveBlindSpot.primary + ' vs ' + rB.diagnosis.cognitiveBlindSpot.primary + ' (diff=' + blindDiff + ')')
  console.log('  strategy: ' + rA.diagnosis.worldStrategy.primary + ' vs ' + rB.diagnosis.worldStrategy.primary + ' (diff=' + strategyDiff + ')')
  console.log('  activeSignals: ' + signalDiff)
})

// ═══════════════════════════════════════════════════════════════
// RUN ALL TESTS
// ═══════════════════════════════════════════════════════════════
for (var i = 0; i < _tests.length; i++) {
  var t = _tests[i]
  try { t.fn() } catch (e) { _failed++; console.log('FAIL (' + t.name + '): ' + e.message) }
}

// ═══════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════
console.log('\n========================================')
console.log('RC8.3_PHASE_2_005_R1 Fidelity Regression')
console.log('========================================')
console.log('Profile A evidenceCount: ' + rA.diagnosis.trace.evidenceCount)
console.log('Profile A inputCoverage: ' + rA.diagnosis.inputCoverage)
console.log('Profile A signal count:   ' + rA.diagnosis.behaviorSignals.length)
console.log('Profile A active signals: ' + rA.diagnosis.trace.rulesTriggered)
console.log('Profile A archetype:      ' + rA.diagnosis.cognitiveArchetype.primary)
console.log('Profile A blindSpot:      ' + rA.diagnosis.cognitiveBlindSpot.primary)
console.log('Profile A strategy:       ' + rA.diagnosis.worldStrategy.primary)
console.log('Profile A inputHash:      ' + rA.diagnosis.inputHash)
console.log('Profile B inputHash:      ' + rB.diagnosis.inputHash)
console.log('inputHash differs:        ' + (rA.diagnosis.inputHash !== rB.diagnosis.inputHash))
console.log('Total: ' + (_passed + _failed) + ' | Passed: ' + _passed + ' | Failed: ' + _failed)
console.log(_failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + _failed)
console.log('========================================\n')

process.exit(_failed > 0 ? 1 : 0)
