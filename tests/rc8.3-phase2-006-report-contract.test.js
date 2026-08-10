/**
 * RC8.3 Phase-2 006 — WM Primary Report Contract Alignment Tests
 *
 * Verifies:
 * A — adapter report reused (not hardcoded 7-field skeleton)
 * B — report includes legacy-compatible fields
 * C — dynamic score propagation across profiles
 * D — determinism
 * E — adapter failure fallback
 */

var ok, T, _tests, _passed, _failed

_tests = []
_passed = 0
_failed = 0

function T(name, fn) { _tests.push({ name: name, fn: fn }) }
function ok(expr, msg) {
  if (expr) { _passed++ }
  else { _failed++; console.log('FAIL [' + _tests[_tests.length - 1].name + ']: ' + (msg || 'assertion failed')) }
}
function eq(a, b, msg) { ok(a === b, msg + ': expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)) }
function gt(a, b, msg) { ok(a > b, msg + ': expected > ' + b + ' got ' + a) }
function truthy(v, msg) { ok(!!v, msg) }
function ne(a, b, msg) { ok(a !== b, msg + ': values must differ') }

var { runWorldModelPipeline } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldModelPipeline')
var { validateWorldModelOutput } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/validators')
var { adaptWorldModelToLegacyDiagnosis } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/legacyDiagnosisAdapter')

// Profile A — 厨师
var profileA = {
  lifeStage: '31-40岁', incomeStructure: '工资/固定薪资', occupationDetail: '厨师',
  monthlySurplus: '1000-5000元', safetyMonths: '6-12个月', debtPressure: '房贷为主（低月供）',
  skillValidation: '偶尔有付费需求', monetizableSkill: '手艺人（厨师/维修/美业）',
  weeklyTime: '20小时以上', executionStability: '有固定计划，基本能执行',
  pastAttemptStage: '卖出过几个，有少量收入', decisionStyle: '边上班边小规模测试',
  primaryGoal: '转行进入新领域', maxTrialCost: '1000-5000元', failureResponse: '复盘优化后继续',
}

// Profile B — very different
var profileB = {
  lifeStage: '18-24岁', incomeStructure: '无固定收入', occupationDetail: '',
  monthlySurplus: '几乎没有结余', safetyMonths: '1个月以下', debtPressure: '无负债',
  skillValidation: '从来没有付费需求', monetizableSkill: '我是打工人，没有副业技能',
  weeklyTime: '5小时以下', executionStability: '没有固定计划，凭感觉行动',
  pastAttemptStage: '想过但从未动手', decisionStyle: '反复纠结无法下决心',
  primaryGoal: '找到稳定的副业方向', maxTrialCost: '0-200元', failureResponse: '重新调整目标再开始',
}

// ───────────────────────────────────────────────────────────────
// TEST A: adapter report reused — report source matches adapter
// ───────────────────────────────────────────────────────────────
var paA = runWorldModelPipeline(profileA, { version: 'world_model_v1' })
var valA = validateWorldModelOutput(paA.diagnosis)
var adaptedA = adaptWorldModelToLegacyDiagnosis(paA.diagnosis)
var adapterReportA = adaptedA.legacyDiagnosisAdapter.report
var adapterDiagA = adaptedA.legacyDiagnosisAdapter.diagnosis

T('A-01: adapter produces report', function () { truthy(adapterReportA, 'adapter report') })
T('A-02: adapter produces diagnosis', function () { truthy(adapterDiagA, 'adapter diagnosis') })
T('A-03: adapter report has wealthProbability', function () { truthy(adapterReportA.wealthProbability, 'wealthProbability present') })
T('A-04: adapter report has potentialIndex', function () { truthy(adapterReportA.potentialIndex, 'potentialIndex present') })

// ───────────────────────────────────────────────────────────────
// TEST B: report includes legacy-compatible fields
// ───────────────────────────────────────────────────────────────
T('B-01: headline', function () { truthy(adapterReportA.headline, 'headline') })
T('B-02: wealthStage', function () { truthy(adapterReportA.wealthStage, 'wealthStage') })
T('B-03: fatalDiagnosis', function () { truthy(adapterReportA.fatalDiagnosis, 'fatalDiagnosis') })
T('B-04: scoreCard', function () { truthy(adapterReportA.scoreCard, 'scoreCard') })
T('B-05: wealthPath', function () { truthy(adapterReportA.wealthPath, 'wealthPath'); ok(adapterReportA.wealthPath.length > 0, 'non-empty') })
T('B-06: actionPlan', function () { truthy(adapterReportA.actionPlan, 'actionPlan') })
T('B-07: stopDoing', function () { truthy(adapterReportA.stopDoing, 'stopDoing') })
T('B-08: identityUpgrade', function () { truthy(adapterReportA.identityUpgrade, 'identityUpgrade') })
T('B-09: finalStrike', function () { truthy(adapterReportA.finalStrike, 'finalStrike') })

// ───────────────────────────────────────────────────────────────
// TEST C: dynamic score propagation
// ───────────────────────────────────────────────────────────────
var paB = runWorldModelPipeline(profileB, { version: 'world_model_v1' })
var adaptedB = adaptWorldModelToLegacyDiagnosis(paB.diagnosis)
var adapterReportB = adaptedB.legacyDiagnosisAdapter.report

T('C-01: wealthProbability differs between profiles', function () {
  var wpA = adapterReportA.wealthProbability
  var wpB = adapterReportB.wealthProbability
  var diff = JSON.stringify(wpA) !== JSON.stringify(wpB)
  ok(diff, 'wealthProbability A=' + JSON.stringify(wpA) + ' B=' + JSON.stringify(wpB))
})

T('C-02: report values match adapter output', function () {
  eq(adapterReportA.wealthProbability.today, adapterReportA.wealthProbability.today, 'values from adapter')
  eq(adapterReportB.wealthProbability.today, adapterReportB.wealthProbability.today, 'values from adapter')
})

// ───────────────────────────────────────────────────────────────
// TEST D: determinism
// ───────────────────────────────────────────────────────────────
var paA2 = runWorldModelPipeline(profileA, { version: 'world_model_v1' })
var adaptedA2 = adaptWorldModelToLegacyDiagnosis(paA2.diagnosis)
var adapterReportA2 = adaptedA2.legacyDiagnosisAdapter.report

T('D-01: same input → same report (excl. timestamps)', function () {
  var a1 = JSON.parse(JSON.stringify(adapterReportA))
  var a2 = JSON.parse(JSON.stringify(adapterReportA2))
  delete a1.generatedAt; delete a2.generatedAt
  eq(JSON.stringify(a1), JSON.stringify(a2), 'deterministic report')
})

T('D-02: same input → same diagnosis', function () {
  eq(adapterReportA.wealthProbability.today, adapterReportA2.wealthProbability.today, 'deterministic wealthProb today')
  eq(adapterReportA.potentialIndex.today, adapterReportA2.potentialIndex.today, 'deterministic potentialIndex today')
})

// ───────────────────────────────────────────────────────────────
// TEST E: adapter failure
// ───────────────────────────────────────────────────────────────
T('E-01: invalid input → adapterError', function () {
  var invalid = adaptWorldModelToLegacyDiagnosis(null)
  eq(invalid.adapterError, 'INVALID_WORLD_MODEL_VERSION', 'null input rejected')
})

T('E-02: wrong version → adapterError', function () {
  var wrongVer = adaptWorldModelToLegacyDiagnosis({ version: 'v3' })
  eq(wrongVer.adapterError, 'INVALID_WORLD_MODEL_VERSION', 'wrong version rejected')
})

T('E-03: valid adapter has no adapterError', function () {
  ok(!adaptedA.adapterError, 'adapterError absent for valid input')
  truthy(adaptedA.legacyDiagnosisAdapter, 'legacyDiagnosisAdapter present')
})

// ═══════════════════════════════════════════════════════════════
// RUN & REPORT
// ═══════════════════════════════════════════════════════════════
for (var i = 0; i < _tests.length; i++) {
  try { _tests[i].fn() } catch (e) { _failed++; console.log('FAIL (' + _tests[i].name + '): ' + e.message) }
}

console.log('\n========================================')
console.log('RC8.3_PHASE_2_006 Report Contract Tests')
console.log('========================================')
console.log('Profile A report fields:')
console.log('  headline:         ' + !!adapterReportA.headline)
console.log('  wealthStage:      ' + !!adapterReportA.wealthStage)
console.log('  fatalDiagnosis:   ' + !!adapterReportA.fatalDiagnosis)
console.log('  scoreCard:        ' + !!adapterReportA.scoreCard)
console.log('  wealthProbability:' + !!adapterReportA.wealthProbability)
console.log('  potentialIndex:   ' + !!adapterReportA.potentialIndex)
console.log('  wealthPath:       ' + (adapterReportA.wealthPath || []).length + ' items')
console.log('  actionPlan:       ' + !!adapterReportA.actionPlan)
console.log('  stopDoing:        ' + !!adapterReportA.stopDoing)
console.log('  identityUpgrade:  ' + !!adapterReportA.identityUpgrade)
console.log('  finalStrike:      ' + !!adapterReportA.finalStrike)
console.log('Profile A wealthProbability:', JSON.stringify(adapterReportA.wealthProbability))
console.log('Profile B wealthProbability:', JSON.stringify(adapterReportB.wealthProbability))
console.log('Total: ' + (_passed + _failed) + ' | Passed: ' + _passed + ' | Failed: ' + _failed)
console.log(_failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + _failed)
console.log('========================================\n')

process.exit(_failed > 0 ? 1 : 0)
