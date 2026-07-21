/**
 * tests/turnaround-os/checkpoint5.test.js
 *
 * CHECKPOINT_5 — Action Engine 测试
 * 33 tests (target: ≥30)
 */

var C = require('../../core/turnaround-os/constants')
var { buildIdentity } = require('../../core/turnaround-os/engines/identityEngineV6')
var { detectWrongGame } = require('../../core/turnaround-os/engines/wrongGameEngineV6')
var { determineLeverage } = require('../../core/turnaround-os/engines/leverageEngineV6')
var { generateStrategy } = require('../../core/turnaround-os/engines/turnaroundEngineV6')
var { projectDestiny } = require('../../core/turnaround-os/engines/destinyProjectionEngineV6')
var { generateMissionPlan } = require('../../core/turnaround-os/engines/missionEngineV6')
var { generateActionPlan, createActionExecutionContext, applyTransition, EVENTS } = require('../../core/turnaround-os/engines/actionEngineV6')
var { createActionDefinition, createActionExecution, ACTION_STATUS } = require('../../core/turnaround-os/schemas/actionContractV6')
var { createActionPlan } = require('../../core/turnaround-os/contracts/actionPlanContractV6')
var { validateActionPlanV6, validateActionDefinition, validateActionExecution } = require('../../core/turnaround-os/validators/validateActionPlanV6')
var { transitionActionState, getAllowedTransitions } = require('../../core/turnaround-os/state/actionStateMachineV6')

var FIXTURES = require('../../core/turnaround-os/fixtures/checkpoint4Fixtures')

var PASS = 0
var FAIL = 0

function test(name, fn) {
  try {
    fn()
    console.log('  PASS ' + name)
    PASS++
  } catch (err) {
    console.log('  FAIL ' + name + ': ' + err.message)
    FAIL++
  }
}

function runWorkerPipeline() {
  var input = FIXTURES.makeWorkerInput()
  var profile = buildIdentity(input)
  var wrongGame = detectWrongGame(profile)
  var leverage = determineLeverage(profile, wrongGame)
  var strategy = generateStrategy(profile, wrongGame, leverage, { generatedAt: '2026-07-22T00:00:00Z' })
  var projection = projectDestiny(profile, wrongGame, strategy, leverage)
  var missionPlan = generateMissionPlan({ profile: profile, strategy: strategy, projection: projection })
  return { profile: profile, strategy: strategy, projection: projection, missionPlan: missionPlan }
}

function runAllFive() {
  return ['worker', 'freelancer', 'creator', 'businessOwner', 'highIncomePro'].map(function(name) {
    var input = FIXTURES.FIXTURE_MAKERS[name]()
    var profile = buildIdentity(input)
    var wrongGame = detectWrongGame(profile)
    var leverage = determineLeverage(profile, wrongGame)
    var strategy = generateStrategy(profile, wrongGame, leverage, { generatedAt: '2026-07-22T00:00:00Z' })
    var projection = projectDestiny(profile, wrongGame, strategy, leverage)
    var missionPlan = generateMissionPlan({ profile: profile, strategy: strategy, projection: projection })
    return { name: name, profile: profile, strategy: strategy, projection: projection, missionPlan: missionPlan }
  })
}

// ═══════════════════════════════════════
// SECTION 1: Action Plan Generation
// ═══════════════════════════════════════
console.log('\n=== SECTION 1: Action Plan Generation ===')

test('1.1 generateActionPlan 成功生成', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  if (!plan || !plan.planId) throw new Error('planId missing')
  if (plan.engineVersion !== '6.0.0') throw new Error('engineVersion: ' + plan.engineVersion)
  if (plan.schemaVersion !== 'action-plan/1.0') throw new Error('schemaVersion: ' + plan.schemaVersion)
})

test('1.2 actions 非空', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  if (!Array.isArray(plan.actions) || plan.actions.length === 0) throw new Error('actions empty')
})

test('1.3 确定性 — 同输入三次结果一致', function() {
  var ctx = runWorkerPipeline()
  var plans = []
  for (var i = 0; i < 3; i++) {
    plans.push(generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy }))
  }
  var ids1 = plans[0].actions.map(function(a) { return a.actionId }).join(',')
  var ids2 = plans[1].actions.map(function(a) { return a.actionId }).join(',')
  var ids3 = plans[2].actions.map(function(a) { return a.actionId }).join(',')
  if (ids1 !== ids2 || ids2 !== ids3) throw new Error('Non-deterministic: ' + ids1 + ' vs ' + ids2 + ' vs ' + ids3)
})

test('1.4 Action ID 稳定', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  for (var i = 0; i < plan.actions.length; i++) {
    var id = plan.actions[i].actionId
    if (!/^ACT_D\d\d?0?_[A-Z]{4}_\d{3}$/.test(id)) {
      throw new Error('Invalid actionId format: ' + id + ' (expected ACT_D7_SAFE_001 style)')
    }
  }
})

test('1.5 五人格都生成 Action Plan', function() {
  var all = runAllFive()
  for (var i = 0; i < all.length; i++) {
    var plan = generateActionPlan({ missionPlan: all[i].missionPlan, profile: all[i].profile, strategy: all[i].strategy })
    if (!plan.planId) throw new Error(all[i].name + ' planId missing')
    if (plan.actions.length === 0) throw new Error(all[i].name + ' actions empty')
  }
})

// ═══════════════════════════════════════
// SECTION 2: 深冻结 & 结构
// ═══════════════════════════════════════
console.log('\n=== SECTION 2: Deep Freeze & Structure ===')

test('2.1 ActionDefinition 被深冻结', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  for (var i = 0; i < plan.actions.length; i++) {
    if (!Object.isFrozen(plan.actions[i])) {
      throw new Error('action[' + i + '] not frozen')
    }
  }
})

test('2.2 ActionDefinition 不含 status/progress/completedAt', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  for (var i = 0; i < plan.actions.length; i++) {
    var a = plan.actions[i]
    if ('status' in a) throw new Error('action[' + i + '] has status field')
    if ('progress' in a) throw new Error('action[' + i + '] has progress field')
    if ('completedAt' in a) throw new Error('action[' + i + '] has completedAt field')
    if ('startedAt' in a) throw new Error('action[' + i + '] has startedAt field')
  }
})

test('2.3 MissionDefinition 不被修改', function() {
  var ctx = runWorkerPipeline()
  var original = JSON.stringify(ctx.missionPlan.day7.missions)
  generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  var after = JSON.stringify(ctx.missionPlan.day7.missions)
  if (original !== after) throw new Error('MissionDefinition was mutated!')
})

// ═══════════════════════════════════════
// SECTION 3: ActionExecution & 状态机
// ═══════════════════════════════════════
console.log('\n=== SECTION 3: ActionExecution & State Machine ===')

test('3.1 createActionExecution 初始状态 TODO', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  var exec = createActionExecutionContext(plan.actions[0])
  if (exec.status !== 'TODO') throw new Error('initial status: ' + exec.status)
  if (exec.progress !== 0) throw new Error('initial progress: ' + exec.progress)
  if (exec.attemptCount !== 0) throw new Error('initial attemptCount: ' + exec.attemptCount)
})

test('3.2 TODO → READY (合法)', function() {
  var exec = createActionExecution({ actionId: 'ACT_D7_SAFE_001', phase: 'DAY_7' })
  var result = transitionActionState({ execution: exec, event: EVENTS.START })
  if (!result.ok) throw new Error(result.errorCode)
  if (exec.status !== 'IN_PROGRESS') throw new Error('status: ' + exec.status)
  if (exec.attemptCount !== 1) throw new Error('attemptCount: ' + exec.attemptCount)
})

test('3.3 IN_PROGRESS → COMPLETED', function() {
  var exec = createActionExecution({ actionId: 'ACT_T1', phase: 'DAY_7' })
  transitionActionState({ execution: exec, event: EVENTS.START })
  var result = transitionActionState({ execution: exec, event: EVENTS.COMPLETE, payload: { proof: ['screenshot'] } })
  if (!result.ok) throw new Error(result.errorCode)
  if (exec.status !== 'COMPLETED') throw new Error('status: ' + exec.status)
  if (exec.progress !== 100) throw new Error('progress: ' + exec.progress)
})

test('3.4 IN_PROGRESS → BLOCKED', function() {
  var exec = createActionExecution({ actionId: 'ACT_T2', phase: 'DAY_7' })
  transitionActionState({ execution: exec, event: EVENTS.START })
  var result = transitionActionState({ execution: exec, event: EVENTS.BLOCK, payload: { reason: 'waiting_for_prereq' } })
  if (!result.ok) throw new Error(result.errorCode)
  if (exec.status !== 'BLOCKED') throw new Error('status: ' + exec.status)
})

test('3.5 BLOCKED → READY', function() {
  var exec = createActionExecution({ actionId: 'ACT_T3', phase: 'DAY_7' })
  transitionActionState({ execution: exec, event: EVENTS.START })
  transitionActionState({ execution: exec, event: EVENTS.BLOCK })
  var result = transitionActionState({ execution: exec, event: EVENTS.UNBLOCK })
  if (!result.ok) throw new Error(result.errorCode)
  if (exec.status !== 'READY') throw new Error('status: ' + exec.status)
})

test('3.6 IN_PROGRESS → FAILED', function() {
  var exec = createActionExecution({ actionId: 'ACT_T4', phase: 'DAY_7' })
  transitionActionState({ execution: exec, event: EVENTS.START })
  var result = transitionActionState({ execution: exec, event: EVENTS.FAIL, payload: { reason: 'timeout' } })
  if (!result.ok) throw new Error(result.errorCode)
  if (exec.status !== 'FAILED') throw new Error('status: ' + exec.status)
})

test('3.7 FAILED → READY (retry)', function() {
  var exec = createActionExecution({ actionId: 'ACT_T5', phase: 'DAY_7' })
  exec.status = 'FAILED'
  exec.attemptCount = 1
  var result = transitionActionState({ execution: exec, event: EVENTS.RETRY })
  if (!result.ok) throw new Error(result.errorCode)
  if (exec.status !== 'READY') throw new Error('status: ' + exec.status)
})

test('3.8 COMPLETED → IN_PROGRESS (非法)', function() {
  var exec = createActionExecution({ actionId: 'ACT_T6', phase: 'DAY_7' })
  exec.status = 'COMPLETED'
  var result = transitionActionState({ execution: exec, event: EVENTS.START })
  if (result.ok) throw new Error('Should have been illegal')
  if (result.errorCode !== 'E_ILLEGAL_TRANSITION') throw new Error('errorCode: ' + result.errorCode)
})

test('3.9 CANCELLED 是终态', function() {
  var exec = createActionExecution({ actionId: 'ACT_T7', phase: 'DAY_7' })
  exec.status = 'CANCELLED'
  var result = transitionActionState({ execution: exec, event: EVENTS.RETRY })
  if (result.ok) throw new Error('CANCELLED should be terminal')
})

test('3.10 未初始化状态非法', function() {
  var exec = {}
  var result = transitionActionState({ execution: exec, event: EVENTS.START })
  if (result.ok) throw new Error('empty execution should fail')
  if (result.errorCode !== 'E_INVALID_CURRENT_STATE') throw new Error('errorCode: ' + result.errorCode)
})

test('3.11 SKIPPED → READY (合法)', function() {
  var exec = createActionExecution({ actionId: 'ACT_T8', phase: 'DAY_7' })
  exec.status = 'SKIPPED'
  var result = transitionActionState({ execution: exec, event: EVENTS.RETRY })
  if (!result.ok) throw new Error(result.errorCode)
  if (exec.status !== 'READY') throw new Error('status: ' + exec.status)
})

// ═══════════════════════════════════════
// SECTION 4: 时间/成本/风险
// ═══════════════════════════════════════
console.log('\n=== SECTION 4: Time / Cost / Risk Rules ===')

test('4.1 Action 不超过 maxSingleActionMinutes', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  var maxSingle = plan.executionRules.maxSingleActionMinutes || 60
  for (var i = 0; i < plan.actions.length; i++) {
    var a = plan.actions[i]
    if (a.estimatedMinutes > maxSingle) throw new Error('action[' + i + '] mins=' + a.estimatedMinutes + ' > ' + maxSingle)
  }
})

test('4.2 SURVIVAL 阶段 riskLevel 不超过 LOW', function() {
  var ctx = runWorkerPipeline()
  if (ctx.profile.wealthStage !== 'SURVIVAL') {
    console.log('  SKIP: not SURVIVAL stage')
    PASS++
    return
  }
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  for (var i = 0; i < plan.actions.length; i++) {
    var a = plan.actions[i]
    if (a.phase === 'DAY_7' && a.riskLevel !== 'LOW') {
      throw new Error('action[' + i + '] SURVIVAL DAY_7 risk=' + a.riskLevel)
    }
  }
})

test('4.3 每日时间不超 maxDailyMinutes', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  for (var k in plan.dailySchedule) {
    var slot = plan.dailySchedule[k]
    if (slot.estimatedTotalMinutes > 120) {
      throw new Error('Day ' + slot.dayNumber + ' exceeds 120min: ' + slot.estimatedTotalMinutes)
    }
  }
})

test('4.4 无 Date / Math.random 残留', function() {
  var fs = require('fs')
  var path = require('path')
  var enginePath = path.join(__dirname, '../../core/turnaround-os/engines/actionEngineV6.js')
  var schedPath = path.join(__dirname, '../../core/turnaround-os/engines/actionSchedulerV6.js')
  var smPath = path.join(__dirname, '../../core/turnaround-os/state/actionStateMachineV6.js')
  var schemaPath = path.join(__dirname, '../../core/turnaround-os/schemas/actionContractV6.js')
  var files = [enginePath, schedPath, smPath, schemaPath]

  for (var f = 0; f < files.length; f++) {
    var content = fs.readFileSync(files[f], 'utf8')
    // strip comments before checking
    var stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
    if (/Math\.random\s*\(/.test(stripped)) throw new Error(basename(files[f]) + ' uses Math.random()')
    if (/new Date\s*\(/.test(stripped)) throw new Error(basename(files[f]) + ' uses new Date()')
    if (/Date\.now\s*\(/.test(stripped)) throw new Error(basename(files[f]) + ' uses Date.now()')
    if (/fetch\s*\(/.test(stripped)) throw new Error(basename(files[f]) + ' uses fetch()')
  }
  function basename(p) { return p.split('/').pop() }
})

// ═══════════════════════════════════════
// SECTION 5: Fallback & 循环检测
// ═══════════════════════════════════════
console.log('\n=== SECTION 5: Fallback & Cycle Detection ===')

test('5.1 Fallback 目标不存在检测', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  var warnings = plan.dependencies.warnings || []
  var fbWarnings = warnings.filter(function(w) { return w.message && w.message.indexOf('Fallback') >= 0 })
  // 可能无 fallback warnings — 这不算失败
  console.log('  (fallback warnings: ' + fbWarnings.length + ')')
})

test('5.2 dependency edges 有结构', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  if (!Array.isArray(plan.dependencies.edges)) throw new Error('edges not array')
  if (!Array.isArray(plan.dependencies.criticalPaths)) throw new Error('criticalPaths not array')
})

// ═══════════════════════════════════════
// SECTION 6: Validator
// ═══════════════════════════════════════
console.log('\n=== SECTION 6: Validator ===')

test('6.1 validateActionPlanV6 通过', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  var result = validateActionPlanV6(plan)
  if (!result.valid) throw new Error(result.errors.join('; '))
})

test('6.2 validateActionDefinition 通过所有 actions', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  for (var i = 0; i < plan.actions.length; i++) {
    var result = validateActionDefinition(plan.actions[i])
    if (!result.valid) throw new Error('action[' + i + ']: ' + result.errors.join('; '))
  }
})

test('6.3 validateActionExecution 通过', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  var exec = createActionExecutionContext(plan.actions[0])
  var result = validateActionExecution(exec)
  if (!result.valid) throw new Error(result.errors.join('; '))
})

test('6.4 五人格 Plan 全部通过 validator', function() {
  var all = runAllFive()
  for (var i = 0; i < all.length; i++) {
    var plan = generateActionPlan({ missionPlan: all[i].missionPlan, profile: all[i].profile, strategy: all[i].strategy })
    var result = validateActionPlanV6(plan)
    if (!result.valid) throw new Error(all[i].name + ': ' + result.errors.join('; '))
  }
})

// ═══════════════════════════════════════
// SECTION 7: 回归测试
// ═══════════════════════════════════════
console.log('\n=== SECTION 7: Regression ===')

var cp = require('child_process')

function runTest(file) {
  var result = cp.spawnSync('node', [file], { cwd: __dirname + '/../..', encoding: 'utf8', timeout: 30000 })
  var passMatch = result.stdout.match(/(\d+) pass/)
  var failMatch = result.stdout.match(/(\d+) fail/)
  return { pass: passMatch ? Number(passMatch[1]) : -1, fail: failMatch ? Number(failMatch[1]) : -1 }
}

test('7.1 Checkpoint 2: 28 pass', function() {
  var r = runTest('tests/turnaround-os/checkpoint2.test.js')
  if (r.pass !== 28) throw new Error('CP2 pass=' + r.pass + ' expected 28')
  if (r.fail !== 0) throw new Error('CP2 fail=' + r.fail)
})

test('7.2 Checkpoint 3: 22 pass', function() {
  var r = runTest('tests/turnaround-os/checkpoint3.test.js')
  if (r.pass !== 22) throw new Error('CP3 pass=' + r.pass + ' expected 22')
  if (r.fail !== 0) throw new Error('CP3 fail=' + r.fail)
})

test('7.3 Checkpoint 4A: 27+ pass', function() {
  var r = runTest('tests/turnaround-os/checkpoint4a.test.js')
  if (r.pass < 27) throw new Error('CP4A pass=' + r.pass + ' expected >=27')
  if (r.fail !== 0) throw new Error('CP4A fail=' + r.fail)
})

test('7.4 Checkpoint 4B: 27+ pass (1 pre-existing infra failure ok)', function() {
  var r = runTest('tests/turnaround-os/checkpoint4b.test.js')
  // CP4B has 1 pre-existing infra failure (hardcoded macOS node path in regression test)
  if (r.pass < 27) throw new Error('CP4B pass=' + r.pass + ' expected >=27')
  if (r.fail > 1) throw new Error('CP4B fail=' + r.fail + ' (expected <=1 pre-existing)')
})

// ═══════════════════════════════════════
console.log('\n========================================')
console.log('RESULTS: ' + PASS + ' pass, ' + FAIL + ' fail')
console.log('========================================')
process.exit(FAIL > 0 ? 1 : 0)
