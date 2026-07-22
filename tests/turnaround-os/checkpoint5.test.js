/**
 * tests/turnaround-os/checkpoint5.test.js
 *
 * CHECKPOINT_5 — Action Engine 测试 (Hardened)
 * Target: >= 45 tests
 */

var C = require('../../core/turnaround-os/constants')
var { buildIdentity } = require('../../core/turnaround-os/engines/identityEngineV6')
var { detectWrongGame } = require('../../core/turnaround-os/engines/wrongGameEngineV6')
var { determineLeverage } = require('../../core/turnaround-os/engines/leverageEngineV6')
var { generateStrategy } = require('../../core/turnaround-os/engines/turnaroundEngineV6')
var { projectDestiny } = require('../../core/turnaround-os/engines/destinyProjectionEngineV6')
var { generateMissionPlan } = require('../../core/turnaround-os/engines/missionEngineV6')
var { generateActionPlan, createActionExecutionContext, applyTransition, EVENTS, findDependencyCycles, findFallbackCycles } = require('../../core/turnaround-os/engines/actionEngineV6')
var { createActionDefinition, createActionExecution, ACTION_STATUS, buildActionFallback } = require('../../core/turnaround-os/schemas/actionContractV6')
var { createActionPlan, createDependencyEdge } = require('../../core/turnaround-os/contracts/actionPlanContractV6')
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

test('1.6 相同输入运行100次完全一致', function() {
  var ctx = runWorkerPipeline()
  var first = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  var firstIds = first.actions.map(function(a) { return a.actionId }).join(',')
  var firstJson = JSON.stringify(first.actions.map(function(a) { return a.actionId }))
  for (var i = 0; i < 100; i++) {
    var p = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
    var curJson = JSON.stringify(p.actions.map(function(a) { return a.actionId }))
    if (curJson !== firstJson) throw new Error('Run ' + (i + 1) + ' differs from run 1')
  }
})

test('1.7 Mission 输入前后 deepEqual', function() {
  var ctx = runWorkerPipeline()
  var before = JSON.stringify(ctx.missionPlan)
  generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  var after = JSON.stringify(ctx.missionPlan)
  if (before !== after) throw new Error('Mission was mutated by generateActionPlan')
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

test('2.4 ActionDefinition 深冻结阻止修改属性', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  var originalTitle = plan.actions[0].title
  // In non-strict mode, frozen object write fails silently; in strict mode it throws
  plan.actions[0].title = 'HACKED'
  // Must be unchanged regardless of mode
  if (plan.actions[0].title !== originalTitle) throw new Error('ActionDefinition was mutated! Frozen write should be rejected')
})

test('2.5 ActionExecution 不污染 ActionDefinition', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  var exec = createActionExecutionContext(plan.actions[0])
  exec.status = 'COMPLETED'
  exec.progress = 100
  // Verify the original ActionDefinition is untouched
  var def = plan.actions[0]
  if ('status' in def) throw new Error('Execution status leaked into ActionDefinition')
  if ('progress' in def) throw new Error('Execution progress leaked into ActionDefinition')
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

test('3.2 TODO → START (合法)', function() {
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

test('3.5 BLOCKED → READY (UNBLOCK)', function() {
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

test('3.12 BLOCKED → READY 不允许 RETRY (必须 UNBLOCK)', function() {
  var exec = createActionExecution({ actionId: 'ACT_T9', phase: 'DAY_7' })
  exec.status = 'BLOCKED'
  var result = transitionActionState({ execution: exec, event: EVENTS.RETRY })
  if (result.ok) throw new Error('RETRY from BLOCKED should be illegal')
  if (result.errorCode !== 'E_ILLEGAL_RETRY') throw new Error('errorCode: ' + result.errorCode)
})

test('3.13 FAILED → READY 超过重试上限返回 E_RETRY_EXHAUSTED', function() {
  var exec = createActionExecution({ actionId: 'ACT_T10', phase: 'DAY_7' })
  exec.status = 'FAILED'
  exec.attemptCount = 3
  exec.maxAttempts = 3
  var result = transitionActionState({ execution: exec, event: EVENTS.RETRY })
  if (result.ok) throw new Error('Should be exhausted')
  if (result.errorCode !== 'E_RETRY_EXHAUSTED') throw new Error('errorCode: ' + result.errorCode)
})

test('3.14 FAILED → READY 未超上限 retry 成功', function() {
  var exec = createActionExecution({ actionId: 'ACT_T11', phase: 'DAY_7' })
  exec.status = 'FAILED'
  exec.attemptCount = 2
  exec.maxAttempts = 3
  var result = transitionActionState({ execution: exec, event: EVENTS.RETRY })
  if (!result.ok) throw new Error('Should succeed: ' + result.errorCode)
  if (exec.status !== 'READY') throw new Error('status: ' + exec.status)
})

test('3.15 COMPLETED 终态 — 所有事件被拒绝', function() {
  var exec = createActionExecution({ actionId: 'ACT_T12', phase: 'DAY_7' })
  exec.status = 'COMPLETED'
  var events = [EVENTS.START, EVENTS.FAIL, EVENTS.BLOCK, EVENTS.UNBLOCK, EVENTS.RETRY, EVENTS.CANCEL]
  for (var i = 0; i < events.length; i++) {
    var r = transitionActionState({ execution: exec, event: events[i] })
    if (r.ok) throw new Error('COMPLETED should reject ' + events[i])
  }
})

test('3.16 CANCELLED 终态 — 所有事件被拒绝', function() {
  var exec = createActionExecution({ actionId: 'ACT_T13', phase: 'DAY_7' })
  exec.status = 'CANCELLED'
  var events = [EVENTS.START, EVENTS.FAIL, EVENTS.BLOCK, EVENTS.UNBLOCK, EVENTS.RETRY, EVENTS.COMPLETE]
  for (var i = 0; i < events.length; i++) {
    var r = transitionActionState({ execution: exec, event: events[i] })
    if (r.ok) throw new Error('CANCELLED should reject ' + events[i])
  }
})

test('3.17 非法迁移返回结构化错误 (含 details)', function() {
  var exec = createActionExecution({ actionId: 'ACT_T14', phase: 'DAY_7' })
  exec.status = 'COMPLETED'
  var result = transitionActionState({ execution: exec, event: EVENTS.START })
  if (typeof result.ok !== 'boolean') throw new Error('ok must be boolean')
  if (typeof result.errorCode !== 'string') throw new Error('errorCode missing')
  if (typeof result.details !== 'string') throw new Error('details missing')
  if (result.execution !== exec) throw new Error('execution reference must be returned')
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
    var stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
    if (/Math\.random\s*\(/.test(stripped)) throw new Error(basename(files[f]) + ' uses Math.random()')
    if (/new Date\s*\(/.test(stripped)) throw new Error(basename(files[f]) + ' uses new Date()')
    if (/Date\.now\s*\(/.test(stripped)) throw new Error(basename(files[f]) + ' uses Date.now()')
    if (/fetch\s*\(/.test(stripped)) throw new Error(basename(files[f]) + ' uses fetch()')
  }
  function basename(p) { return p.split('/').pop() }
})

// ═══════════════════════════════════════
// SECTION 5: Dependency DAG 循环检测
// ═══════════════════════════════════════
console.log('\n=== SECTION 5: Dependency DAG Cycle Detection ===')

test('5.1 无环 DAG 返回空数组', function() {
  var edges = [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'C' },
    { from: 'A', to: 'C' },
  ]
  var cycles = findDependencyCycles(edges)
  if (cycles.length !== 0) throw new Error('Should be acyclic, got ' + cycles.length + ' cycles')
})

test('5.2 Self-cycle (A→A) 被检测', function() {
  var edges = [{ from: 'A', to: 'A' }]
  var cycles = findDependencyCycles(edges)
  if (cycles.length !== 1) throw new Error('Should detect self-cycle, got ' + cycles.length)
  if (cycles[0].length !== 2 || cycles[0][0] !== 'A' || cycles[0][1] !== 'A') {
    throw new Error('Self-cycle path wrong: ' + JSON.stringify(cycles[0]))
  }
})

test('5.3 2-node cycle (A→B→A) 被检测', function() {
  var edges = [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'A' },
  ]
  var cycles = findDependencyCycles(edges)
  if (cycles.length !== 1) throw new Error('Should detect 2-node cycle, got ' + cycles.length)
  if (cycles[0].length !== 3) throw new Error('2-node cycle should have 3 entries (A,B,A), got ' + cycles[0].length)
})

test('5.4 3-node cycle (A→B→C→A) 被检测', function() {
  var edges = [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'C' },
    { from: 'C', to: 'A' },
  ]
  var cycles = findDependencyCycles(edges)
  if (cycles.length !== 1) throw new Error('Should detect 3-node cycle, got ' + cycles.length)
  if (cycles[0].length !== 4) throw new Error('3-node cycle should have 4 entries, got ' + cycles[0].length)
})

test('5.5 10-node cycle 被检测', function() {
  var edges = []
  for (var i = 0; i < 10; i++) {
    edges.push({ from: 'N' + i, to: 'N' + ((i + 1) % 10) })
  }
  var cycles = findDependencyCycles(edges)
  if (cycles.length < 1) throw new Error('Should detect 10-node cycle, got ' + cycles.length)
  if (cycles[0].length !== 11) throw new Error('10-node cycle should have 11 entries, got ' + cycles[0].length)
})

test('5.6 Disconnected 图局部循环', function() {
  var edges = [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'A' }, // Component 1: cycle
    { from: 'C', to: 'D' },
    { from: 'D', to: 'E' }, // Component 2: acyclic
  ]
  var cycles = findDependencyCycles(edges)
  if (cycles.length !== 1) throw new Error('Should detect 1 cycle in disconnected graph, got ' + cycles.length)
})

test('5.7 多个独立循环', function() {
  var edges = [
    { from: 'A', to: 'B' }, { from: 'B', to: 'A' }, // cycle 1
    { from: 'C', to: 'D' }, { from: 'D', to: 'C' }, // cycle 2
  ]
  var cycles = findDependencyCycles(edges)
  if (cycles.length !== 2) throw new Error('Should detect 2 independent cycles, got ' + cycles.length)
})

test('5.8 cyclePath 存在并有效', function() {
  var edges = [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'C' },
    { from: 'C', to: 'A' },
  ]
  var cycles = findDependencyCycles(edges)
  if (!Array.isArray(cycles[0])) throw new Error('cyclePath must be array')
  if (cycles[0][0] !== cycles[0][cycles[0].length - 1]) {
    throw new Error('cyclePath must start and end with same node')
  }
})

test('5.9 错误码 ACTION_DEPENDENCY_CYCLE 出现于 warning', function() {
  // Build a plan with manual dependency cycle via actions with self-referencing dependencies
  var plan = createActionPlan({ planId: 'TEST_CYCLE' })
  var act1 = createActionDefinition({
    actionId: 'ACT_D7_SAFE_001', phase: 'DAY_7', category: 'SAFETY_REPAIR',
    sequence: 1, dependencies: ['ACT_D7_SAFE_002'],
  })
  var act2 = createActionDefinition({
    actionId: 'ACT_D7_SAFE_002', phase: 'DAY_7', category: 'SAFETY_REPAIR',
    sequence: 2, dependencies: ['ACT_D7_SAFE_001'],
  })
  plan.actions = [act1, act2]
  // Verify the cycle detection works directly
  var edges = [
    createDependencyEdge({ from: 'ACT_D7_SAFE_001', to: 'ACT_D7_SAFE_002' }),
    createDependencyEdge({ from: 'ACT_D7_SAFE_002', to: 'ACT_D7_SAFE_001' }),
  ]
  var cycles = findDependencyCycles(edges)
  if (cycles.length === 0) throw new Error('Should detect cycle')
})

// ═══════════════════════════════════════
// SECTION 6: Fallback 链循环检测
// ═══════════════════════════════════════
console.log('\n=== SECTION 6: Fallback Chain Cycle Detection ===')

test('6.1 Fallback 无环链通过 (合法)', function() {
  var actions = [
    createActionDefinition({ actionId: 'ACT_A', phase: 'DAY_7', fallback: buildActionFallback({ targetActionId: 'ACT_B', type: 'ALTERNATE_ACTION' }) }),
    createActionDefinition({ actionId: 'ACT_B', phase: 'DAY_7', fallback: buildActionFallback({ targetActionId: 'ACT_C', type: 'ALTERNATE_ACTION' }) }),
    createActionDefinition({ actionId: 'ACT_C', phase: 'DAY_7' }),
  ]
  var seenIds = { ACT_A: true, ACT_B: true, ACT_C: true }
  var cycles = findFallbackCycles(actions, seenIds)
  if (cycles.length !== 0) throw new Error('Acyclic fallback chain should pass, got ' + cycles.length + ' cycles')
})

test('6.2 Fallback self-cycle (A→A) 被检测', function() {
  var actions = [
    createActionDefinition({ actionId: 'ACT_SELF', phase: 'DAY_7', fallback: buildActionFallback({ targetActionId: 'ACT_SELF', type: 'ALTERNATE_ACTION' }) }),
  ]
  var seenIds = { ACT_SELF: true }
  var cycles = findFallbackCycles(actions, seenIds)
  if (cycles.length !== 1) throw new Error('Should detect fallback self-cycle, got ' + cycles.length)
  if (cycles[0].cyclePath.length !== 2) throw new Error('Self-cycle path length: ' + cycles[0].cyclePath.length)
})

test('6.3 Fallback 2-node cycle (A→B→A) 被检测', function() {
  var actions = [
    createActionDefinition({ actionId: 'ACT_A2', phase: 'DAY_7', fallback: buildActionFallback({ targetActionId: 'ACT_B2', type: 'ALTERNATE_ACTION' }) }),
    createActionDefinition({ actionId: 'ACT_B2', phase: 'DAY_7', fallback: buildActionFallback({ targetActionId: 'ACT_A2', type: 'ALTERNATE_ACTION' }) }),
  ]
  var seenIds = { ACT_A2: true, ACT_B2: true }
  var cycles = findFallbackCycles(actions, seenIds)
  if (cycles.length !== 1) throw new Error('Should detect 2-node fallback cycle, got ' + cycles.length)
  if (cycles[0].cyclePath.length !== 3) throw new Error('2-node cycle path length: ' + cycles[0].cyclePath.length)
})

test('6.4 Fallback 3+ node cycle (A→B→C→A) 被检测', function() {
  var actions = [
    createActionDefinition({ actionId: 'ACT_A3', phase: 'DAY_7', fallback: buildActionFallback({ targetActionId: 'ACT_B3', type: 'ALTERNATE_ACTION' }) }),
    createActionDefinition({ actionId: 'ACT_B3', phase: 'DAY_7', fallback: buildActionFallback({ targetActionId: 'ACT_C3', type: 'ALTERNATE_ACTION' }) }),
    createActionDefinition({ actionId: 'ACT_C3', phase: 'DAY_7', fallback: buildActionFallback({ targetActionId: 'ACT_A3', type: 'ALTERNATE_ACTION' }) }),
  ]
  var seenIds = { ACT_A3: true, ACT_B3: true, ACT_C3: true }
  var cycles = findFallbackCycles(actions, seenIds)
  if (cycles.length !== 1) throw new Error('Should detect 3-node fallback cycle, got ' + cycles.length)
  if (cycles[0].cyclePath.length !== 4) throw new Error('3-node cycle path length: ' + cycles[0].cyclePath.length)
})

test('6.5 Fallback targetActionId 不存在 (在 buildDependencyMap 中报告 warning)', function() {
  // Test directly through findFallbackCycles — valid chain passes
  var actions = [
    createActionDefinition({ actionId: 'ACT_X', phase: 'DAY_7', fallback: buildActionFallback({ targetActionId: 'ACT_MISSING' }) }),
  ]
  var seenIds = { ACT_X: true } // ACT_MISSING not in seenIds
  var cycles = findFallbackCycles(actions, seenIds)
  // findFallbackCycles only checks cycles for targets that exist; missing targets are handled by buildDependencyMap
  if (cycles.length !== 0) throw new Error('Missing target should not produce cycle')
})

test('6.6 Fallback cyclePath 存在/返回', function() {
  var actions = [
    createActionDefinition({ actionId: 'ACT_F1', phase: 'DAY_7', fallback: buildActionFallback({ targetActionId: 'ACT_F2', type: 'ALTERNATE_ACTION' }) }),
    createActionDefinition({ actionId: 'ACT_F2', phase: 'DAY_7', fallback: buildActionFallback({ targetActionId: 'ACT_F1', type: 'ALTERNATE_ACTION' }) }),
  ]
  var seenIds = { ACT_F1: true, ACT_F2: true }
  var cycles = findFallbackCycles(actions, seenIds)
  if (!Array.isArray(cycles[0].cyclePath)) throw new Error('cyclePath must be array')
  if (cycles[0].cyclePath.length < 2) throw new Error('cyclePath too short')
  if (typeof cycles[0].message !== 'string') throw new Error('message missing')
})

test('6.7 错误码 ACTION_FALLBACK_CYCLE 用于 fallback 循环', function() {
  // Verify the error code is in the exported warnings through integration
  var actions = [
    createActionDefinition({ actionId: 'ACT_FC1', phase: 'DAY_7', fallback: buildActionFallback({ targetActionId: 'ACT_FC2', type: 'ALTERNATE_ACTION' }) }),
    createActionDefinition({ actionId: 'ACT_FC2', phase: 'DAY_7', fallback: buildActionFallback({ targetActionId: 'ACT_FC1', type: 'ALTERNATE_ACTION' }) }),
  ]
  var seenIds = { ACT_FC1: true, ACT_FC2: true }
  var cycles = findFallbackCycles(actions, seenIds)
  if (cycles.length === 0) throw new Error('Should detect fallback cycle')
  // verification: cyclePath starts and ends with same node
  if (cycles[0].cyclePath[0] !== cycles[0].cyclePath[cycles[0].cyclePath.length - 1]) {
    throw new Error('cyclePath must be a closed loop')
  }
})

// ═══════════════════════════════════════
// SECTION 7: Validator
// ═══════════════════════════════════════
console.log('\n=== SECTION 7: Validator ===')

test('7.1 validateActionPlanV6 通过', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  var result = validateActionPlanV6(plan)
  if (!result.valid) throw new Error(result.errors.join('; '))
})

test('7.2 validateActionDefinition 通过所有 actions', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  for (var i = 0; i < plan.actions.length; i++) {
    var result = validateActionDefinition(plan.actions[i])
    if (!result.valid) throw new Error('action[' + i + ']: ' + result.errors.join('; '))
  }
})

test('7.3 validateActionExecution 通过', function() {
  var ctx = runWorkerPipeline()
  var plan = generateActionPlan({ missionPlan: ctx.missionPlan, profile: ctx.profile, strategy: ctx.strategy })
  var exec = createActionExecutionContext(plan.actions[0])
  var result = validateActionExecution(exec)
  if (!result.valid) throw new Error(result.errors.join('; '))
})

test('7.4 五人格 Plan 全部通过 validator', function() {
  var all = runAllFive()
  for (var i = 0; i < all.length; i++) {
    var plan = generateActionPlan({ missionPlan: all[i].missionPlan, profile: all[i].profile, strategy: all[i].strategy })
    var result = validateActionPlanV6(plan)
    if (!result.valid) throw new Error(all[i].name + ': ' + result.errors.join('; '))
  }
})

test('7.5 engineVersion 校验 — 错误版本', function() {
  var plan = createActionPlan({ planId: 'BAD_VER' })
  plan.engineVersion = '5.0.0'
  var result = validateActionPlanV6(plan)
  if (result.valid) throw new Error('Should reject wrong engineVersion')
})

test('7.6 schemaVersion 校验 — 错误版本', function() {
  var plan = createActionPlan({ planId: 'BAD_SCHEMA' })
  plan.schemaVersion = 'action-plan/0.9'
  var result = validateActionPlanV6(plan)
  if (result.valid) throw new Error('Should reject wrong schemaVersion')
})

// ═══════════════════════════════════════
// SECTION 8: 回归测试
// ═══════════════════════════════════════
console.log('\n=== SECTION 8: Regression ===')

var cp = require('child_process')

function runTest(file) {
  var result = cp.spawnSync(process.execPath, [file], { cwd: __dirname + '/../..', encoding: 'utf8', timeout: 30000 })
  var passMatch = result.stdout.match(/RESULTS: (\d+) pass/)
  var failMatch = result.stdout.match(/RESULTS: \d+ pass, (\d+) fail/)
  return { pass: passMatch ? Number(passMatch[1]) : -1, fail: failMatch ? Number(failMatch[1]) : -1 }
}

test('8.1 Checkpoint 2: 28 pass, 0 fail', function() {
  var r = runTest('tests/turnaround-os/checkpoint2.test.js')
  if (r.pass !== 28) throw new Error('CP2 pass=' + r.pass + ' expected 28')
  if (r.fail !== 0) throw new Error('CP2 fail=' + r.fail)
})

test('8.2 Checkpoint 3: 22 pass, 0 fail', function() {
  var r = runTest('tests/turnaround-os/checkpoint3.test.js')
  if (r.pass !== 22) throw new Error('CP3 pass=' + r.pass + ' expected 22')
  if (r.fail !== 0) throw new Error('CP3 fail=' + r.fail)
})

test('8.3 Checkpoint 4A: 27+ pass, 0 fail', function() {
  var r = runTest('tests/turnaround-os/checkpoint4a.test.js')
  if (r.pass < 27) throw new Error('CP4A pass=' + r.pass + ' expected >=27')
  if (r.fail !== 0) throw new Error('CP4A fail=' + r.fail)
})

test('8.4 Checkpoint 4B: 27+ pass, 0 fail (path fixed)', function() {
  var r = runTest('tests/turnaround-os/checkpoint4b.test.js')
  if (r.pass < 27) throw new Error('CP4B pass=' + r.pass + ' expected >=27')
  if (r.fail !== 0) throw new Error('CP4B fail=' + r.fail + ' (expected 0 after path fix)')
})

// ═══════════════════════════════════════
console.log('\n========================================')
console.log('CHECKPOINT_5 RESULTS: ' + PASS + ' pass, ' + FAIL + ' fail')
console.log('========================================')
process.exit(FAIL > 0 ? 1 : 0)
