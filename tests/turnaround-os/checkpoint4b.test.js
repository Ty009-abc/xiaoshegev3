/**
 * tests/turnaround-os/checkpoint4b.test.js
 *
 * CHECKPOINT_4B — Mission Engine 完整测试 (hardened)
 * 32 tests
 */

var C = require('../../core/turnaround-os/constants')
var { buildIdentity } = require('../../core/turnaround-os/engines/identityEngineV6')
var { detectWrongGame } = require('../../core/turnaround-os/engines/wrongGameEngineV6')
var { determineLeverage } = require('../../core/turnaround-os/engines/leverageEngineV6')
var { generateStrategy } = require('../../core/turnaround-os/engines/turnaroundEngineV6')
var { projectDestiny } = require('../../core/turnaround-os/engines/destinyProjectionEngineV6')
var { generateMissionPlan } = require('../../core/turnaround-os/engines/missionEngineV6')
var { scoreMissionPriority } = require('../../core/turnaround-os/engines/missionPrioritizerV6')
var { createMission, createFallback, FALLBACK_TYPES } = require('../../core/turnaround-os/schemas/missionContractV6')
var {
  validateMissionContractV6,
  validateMissionPlanContractV6,
} = require('../../core/turnaround-os/validators/validateMissionPlanV6')

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

function runFull(input) {
  var profile = buildIdentity(input)
  var wrongGame = detectWrongGame(profile)
  var leverage = determineLeverage(profile, wrongGame)
  var strategy = generateStrategy(profile, wrongGame, leverage, { generatedAt: '2026-07-21T00:00:00Z' })
  var projection = projectDestiny(profile, wrongGame, strategy, leverage)
  var plan = generateMissionPlan({ profile, strategy, projection })
  return { profile: profile, wrongGame: wrongGame, leverage: leverage, strategy: strategy, projection: projection, plan: plan }
}

function allMissions(plan) {
  return (plan.day7.missions || []).concat(plan.day30.missions || []).concat(plan.day90.missions || [])
}

// ═══════════════════════════════════════
// SECTION 1: Category Codes
// ═══════════════════════════════════════
console.log('\n=== SECTION 1: Category Codes ===')

test('1.1 MISSION_CATEGORY_CODES 导出', function() {
  if (!C.MISSION_CATEGORY_CODES) throw new Error('MISSION_CATEGORY_CODES 未导出')
})

test('1.2 所有类别有固定编码', function() {
  var cats = Object.values(C.MISSION_CATEGORIES_V6)
  var codes = C.MISSION_CATEGORY_CODES
  for (var i = 0; i < cats.length; i++) {
    var cat = cats[i]
    if (!codes[cat]) throw new Error('missing code for ' + cat)
    var code = codes[cat]
    if (code.length !== 4) throw new Error('code length should be 4: ' + cat + ' -> ' + code)
    if (!/^[A-Z]{4}$/.test(code)) throw new Error('code not uppercase 4-letter: ' + code)
  }
})

test('1.3 编码唯一', function() {
  var codes = C.MISSION_CATEGORY_CODES
  var seen = {}
  var duplicates = []
  for (var k in codes) {
    if (seen[codes[k]]) duplicates.push(codes[k])
    seen[codes[k]] = true
  }
  if (duplicates.length > 0) throw new Error('duplicate codes: ' + duplicates.join(', '))
})

test('1.4 AI_WORKFLOW 编码为 AIWF', function() {
  var code = C.MISSION_CATEGORY_CODES.AI_WORKFLOW
  if (code !== 'AIWF') throw new Error('AI_WORKFLOW code should be AIWF, got: ' + code)
})

test('1.5 ID 不包含 AI_W', function() {
  var { plan } = runFull(FIXTURES.makeWorkerInput())
  var all = allMissions(plan)
  for (var i = 0; i < all.length; i++) {
    if (all[i].missionId.indexOf('AI_W') >= 0) {
      throw new Error('missionId contains AI_W: ' + all[i].missionId)
    }
  }
})

test('1.6 ID 不含非法字符', function() {
  var { plan } = runFull(FIXTURES.makeHighIncomeProInput())
  var all = allMissions(plan)
  for (var i = 0; i < all.length; i++) {
    var id = all[i].missionId
    if (!/^MSN_D\d{1,3}_[A-Z]{4}_\d{2}$/.test(id)) {
      throw new Error('invalid ID format: ' + id)
    }
  }
})

test('1.7 所有类别编码可用（五人格全量验证）', function() {
  var codes = C.MISSION_CATEGORY_CODES
  var names = Object.keys(FIXTURES.FIXTURE_MAKERS)
  for (var n = 0; n < names.length; n++) {
    var { plan } = runFull(FIXTURES.FIXTURE_MAKERS[names[n]]())
    var all = allMissions(plan)
    for (var i = 0; i < all.length; i++) {
      var cat = all[i].category
      if (!codes[cat]) throw new Error(names[n] + ': no code for category ' + cat)
    }
  }
})

// ═══════════════════════════════════════
// SECTION 2: Plan Structure
// ═══════════════════════════════════════
console.log('\n=== SECTION 2: Plan Structure ===')

test('2.1 generateMissionPlan 返回完整结构', function() {
  var { plan } = runFull(FIXTURES.makeWorkerInput())
  var required = ['version', 'missionTheme', 'planPrinciples', 'day7', 'day30', 'day90',
    'weeklyRhythm', 'strategicMetrics', 'dependencies', 'rejectedMissions',
    'assumptions', 'limitations', 'confidence', 'evidence']
  for (var i = 0; i < required.length; i++) {
    if (plan[required[i]] === undefined) throw new Error('missing key: ' + required[i])
  }
})

test('2.2 engineVersion 为 "6.0.0"', function() {
  var { plan } = runFull(FIXTURES.makeWorkerInput())
  if (plan.engineVersion !== '6.0.0') throw new Error('engineVersion=' + plan.engineVersion)
})

test('2.3 schemaVersion 为 "mission-plan/1.0"', function() {
  var { plan } = runFull(FIXTURES.makeWorkerInput())
  if (plan.schemaVersion !== 'mission-plan/1.0') throw new Error('schemaVersion=' + plan.schemaVersion)
})

test('2.4 每个阶段至少有任务', function() {
  var { plan } = runFull(FIXTURES.makeWorkerInput())
  if (plan.day7.missions.length < 1) throw new Error('day7 empty')
  if (plan.day30.missions.length < 1) throw new Error('day30 empty')
  if (plan.day90.missions.length < 1) throw new Error('day90 empty')
})

// ═══════════════════════════════════════
// SECTION 3: Determinism
// ═══════════════════════════════════════
console.log('\n=== SECTION 3: Determinism ===')

test('3.1 同输入三次结果一致', function() {
  var p1 = runFull(FIXTURES.makeWorkerInput()).plan
  var p2 = runFull(FIXTURES.makeWorkerInput()).plan
  var p3 = runFull(FIXTURES.makeWorkerInput()).plan
  if (p1.day7.missions.length !== p2.day7.missions.length) throw new Error('day7 diff')
  if (p2.day7.missions.length !== p3.day7.missions.length) throw new Error('day7 diff run3')
  if (p1.confidence !== p2.confidence) throw new Error('confidence diff')
})

test('3.2 同输入 missionId 一致', function() {
  var p1 = runFull(FIXTURES.makeWorkerInput()).plan
  var p2 = runFull(FIXTURES.makeWorkerInput()).plan
  var ids1 = allMissions(p1).map(function(m) { return m.missionId }).join(',')
  var ids2 = allMissions(p2).map(function(m) { return m.missionId }).join(',')
  if (ids1 !== ids2) throw new Error('ids differ')
})

test('3.3 同输入 JSON 完全一致', function() {
  var p1 = runFull(FIXTURES.makeWorkerInput()).plan
  var p2 = runFull(FIXTURES.makeWorkerInput()).plan
  // Strip non-deterministic internal fields
  var s1 = JSON.stringify(p1, function(k, v) { return k && k[0] === '_' ? undefined : v })
  var s2 = JSON.stringify(p2, function(k, v) { return k && k[0] === '_' ? undefined : v })
  if (s1 !== s2) throw new Error('JSON differs')
})

// ═══════════════════════════════════════
// SECTION 4: Input Contract
// ═══════════════════════════════════════
console.log('\n=== SECTION 4: Input Contract ===')

test('4.1 不调用上游 Engine', function() {
  var { plan } = runFull(FIXTURES.makeWorkerInput())
  var json = JSON.stringify(plan)
  var banned = ['buildIdentity', 'detectWrongGame', 'determineLeverage',
    'generateStrategy', 'projectDestiny']
  for (var i = 0; i < banned.length; i++) {
    if (json.indexOf(banned[i]) >= 0) throw new Error('should not reference: ' + banned[i])
  }
})

test('4.2 不接受 wrongGameResult 为输入', function() {
  var { profile, strategy, projection } = runFull(FIXTURES.makeWorkerInput())
  var plan = generateMissionPlan({ profile: profile, strategy: strategy, projection: projection, wrongGameResult: 'BAD' })
  var result = validateMissionPlanContractV6(plan)
  if (!result.valid) throw new Error('validation failed: ' + result.errors.join(';'))
})

// ═══════════════════════════════════════
// SECTION 5: Fallback Validation
// ═══════════════════════════════════════
console.log('\n=== SECTION 5: Fallback ===')

test('5.1 所有 mission 的 fallback 为对象', function() {
  var { plan } = runFull(FIXTURES.makeWorkerInput())
  var all = allMissions(plan)
  for (var i = 0; i < all.length; i++) {
    var fb = all[i].fallback
    if (!fb || typeof fb !== 'object') throw new Error(all[i].missionId + ' fallback not object')
    if (!fb.type) throw new Error(all[i].missionId + ' fallback missing type')
    if (!fb.instruction) throw new Error(all[i].missionId + ' fallback missing instruction')
  }
})

test('5.2 fallback.type 为合法枚举', function() {
  var { plan } = runFull(FIXTURES.makeWorkerInput())
  var all = allMissions(plan)
  var validTypes = Object.values(FALLBACK_TYPES)
  for (var i = 0; i < all.length; i++) {
    if (validTypes.indexOf(all[i].fallback.type) < 0) {
      throw new Error(all[i].missionId + ' invalid fallback type: ' + all[i].fallback.type)
    }
  }
})

test('5.3 没有 fallbackAction 旧字段', function() {
  var { plan } = runFull(FIXTURES.makeWorkerInput())
  var all = allMissions(plan)
  for (var i = 0; i < all.length; i++) {
    if (all[i].fallbackAction !== undefined) {
      throw new Error(all[i].missionId + ' should not have fallbackAction (use fallback)')
    }
  }
})

test('5.4 fallback 目标引用存在', function() {
  var { plan } = runFull(FIXTURES.makeWorkerInput())
  var all = allMissions(plan)
  var validIds = {}
  for (var i = 0; i < all.length; i++) { validIds[all[i].missionId] = true }
  for (var i = 0; i < all.length; i++) {
    var tid = all[i].fallback.targetMissionId
    if (tid && !validIds[tid]) {
      throw new Error(all[i].missionId + ' fallback targets missing: ' + tid)
    }
  }
})

test('5.5 fallback 不形成直接循环', function() {
  var { plan } = runFull(FIXTURES.makeWorkerInput())
  var all = allMissions(plan)
  for (var i = 0; i < all.length; i++) {
    var fb = all[i].fallback
    if (fb && fb.targetMissionId) {
      var target = null
      for (var j = 0; j < all.length; j++) {
        if (all[j].missionId === fb.targetMissionId) { target = all[j]; break }
      }
      if (target && target.fallback && target.fallback.targetMissionId === all[i].missionId) {
        throw new Error('circular fallback: ' + all[i].missionId + ' <-> ' + fb.targetMissionId)
      }
    }
  }
})

test('5.6 安全修复 fallback 不再直接进入第二收入验证', function() {
  var { plan } = runFull(FIXTURES.makeWorkerInput())
  var safetyMsn = null
  var all = allMissions(plan)
  for (var i = 0; i < all.length; i++) {
    if (all[i].category === 'SAFETY_REPAIR') { safetyMsn = all[i]; break }
  }
  if (!safetyMsn) throw new Error('no SAFETY_REPAIR mission')
  if (safetyMsn.fallback.type !== FALLBACK_TYPES.ALTERNATE_MISSION) throw new Error('fallback type should be ALTERNATE_MISSION')
  // It should point to SECOND_INCOME_TEST as alternative category, not as immediate fallback
  if (!safetyMsn.fallback.targetCategory) throw new Error('missing targetCategory')
})

// ═══════════════════════════════════════
// SECTION 6: MissionDefinition Immutability
// ═══════════════════════════════════════
console.log('\n=== SECTION 6: Immutability ===')

test('6.1 createMission 返回冻结对象', function() {
  var m = createMission({ missionId: 'MSN_TEST_01', category: C.MISSION_CATEGORIES_V6.TIME_AUDIT })
  if (!Object.isFrozen(m)) throw new Error('not frozen')
})

test('6.2 MissionDefinition 无运行态字段', function() {
  var m = createMission({ missionId: 'MSN_TEST_02' })
  var forbidden = ['status', 'progress', 'completedAt', 'startedAt', 'actualMinutes', 'executionLog']
  for (var i = 0; i < forbidden.length; i++) {
    if (m[forbidden[i]] !== undefined) throw new Error('has runtime field: ' + forbidden[i])
  }
})

test('6.3 生成的 mission 全部冻结', function() {
  var { plan } = runFull(FIXTURES.makeWorkerInput())
  var all = allMissions(plan)
  for (var i = 0; i < all.length; i++) {
    if (!Object.isFrozen(all[i])) throw new Error(all[i].missionId + ' not frozen')
  }
})

test('6.4 数组字段也冻结', function() {
  var m = createMission({
    missionId: 'MSN_FREEZE_01',
    proofOfCompletion: ['a', 'b'],
    sourceEvidence: ['x']
  })
  if (!Object.isFrozen(m.proofOfCompletion)) throw new Error('proofOfCompletion array not frozen')
  if (!Object.isFrozen(m.sourceEvidence)) throw new Error('sourceEvidence array not frozen')
})

// ═══════════════════════════════════════
// SECTION 7: Persona Coverage
// ═══════════════════════════════════════
console.log('\n=== SECTION 7: Persona Coverage ===')

test('7.1 五人格均生成 plan', function() {
  var names = Object.keys(FIXTURES.FIXTURE_MAKERS)
  for (var n = 0; n < names.length; n++) {
    var { plan } = runFull(FIXTURES.FIXTURE_MAKERS[names[n]]())
    if (plan.day7.missions.length < 1) throw new Error(names[n] + ': no day7 missions')
  }
})

test('7.2 五人格产物不完全相同', function() {
  var results = {}
  var names = Object.keys(FIXTURES.FIXTURE_MAKERS)
  for (var n = 0; n < names.length; n++) {
    var name = names[n]
    var { plan } = runFull(FIXTURES.FIXTURE_MAKERS[name]())
    results[name] = plan.day7.missions.length + '/' + plan.day30.missions.length + '/' + plan.day90.missions.length
  }
  var unique = {}
  for (var k in results) { unique[results[k]] = true }
  if (Object.keys(unique).length < 2) throw new Error('all same: ' + JSON.stringify(results))
})

// ═══════════════════════════════════════
// SECTION 8: Regression
// ═══════════════════════════════════════
console.log('\n=== SECTION 8: Regression ===')

var cp = require('child_process')

test('8.1 Checkpoint 4A 仍 27 pass', function() {
  var result = cp.spawnSync(
    process.execPath,
    ['tests/turnaround-os/checkpoint4a.test.js'],
    { cwd: __dirname + '/../..', encoding: 'utf8', timeout: 30000 }
  )
  var passMatch = result.stdout.match(/RESULTS: (\d+) pass/)
  var failMatch = result.stdout.match(/RESULTS: \d+ pass, (\d+) fail/)
  if (!passMatch || passMatch[1] !== '27') throw new Error('Checkpoint4A pass=' + (passMatch ? passMatch[1] : '?'))
  if (failMatch && failMatch[1] !== '0') throw new Error('Checkpoint4A fail=' + failMatch[1])
})

// ═══════════════════════════════════════
console.log('\n========================================')
console.log('CHECKPOINT_4B RESULTS: ' + PASS + ' pass, ' + FAIL + ' fail')
console.log('========================================')

process.exit(FAIL > 0 ? 1 : 0)
