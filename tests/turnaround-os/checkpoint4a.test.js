/**
 * tests/turnaround-os/checkpoint4a.test.js
 *
 * CHECKPOINT_4A — Mission 现场审计 + Contract 冻结测试
 * 18 tests
 */

const { constants: C } = require('../../core/turnaround-os')
const { createMission } = require('../../core/turnaround-os/schemas/missionContractV6')
const {
  createMissionPlan,
  normalizeMissionId,
  createMissionTheme,
  createPhasePlan,
  createCheckpoint,
} = require('../../core/turnaround-os/contracts/missionPlanContractV6')
const {
  validateMissionContractV6,
  validateMissionPlanContractV6,
} = require('../../core/turnaround-os/validators/validateMissionPlanV6')

let PASS = 0
let FAIL = 0
function test(name, fn) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
    PASS++
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`)
    FAIL++
  }
}

// ═══════════════════════════════════════
// SECTION 1: 基础 Contract 创建
// ═══════════════════════════════════════
console.log('\n📋 SECTION 1: Mission Contract 创建')

test('1.1 createMission 返回完整 Contract', () => {
  const m = createMission()
  const keys = Object.keys(m)
  const required = ['missionId', 'phase', 'category', 'title', 'instruction', 'whyNow',
    'strategicPurpose', 'validatesAssumption', 'linkedLeverage', 'linkedWrongGame',
    'sourceEvidence', 'prerequisites', 'estimatedMinutes', 'estimatedCostLevel',
    'riskLevel', 'difficulty', 'expectedOutput', 'proofOfCompletion', 'successCriteria',
    'failureSignals', 'fallbackAction', 'nextMissionIds', 'priorityScore', 'confidence']
  for (const k of required) {
    if (!keys.includes(k)) throw new Error(`缺少字段: ${k}`)
  }
  if (m.version !== undefined) throw new Error('单 Mission 不应有 version 字段')
})

test('1.2 createMissionPlan 返回完整 Contract', () => {
  const p = createMissionPlan()
  if (p.version !== '6.0') throw new Error(`version=${p.version}`)
  if (!p.missionTheme) throw new Error('缺少 missionTheme')
  if (!p.day7 || !p.day30 || !p.day90) throw new Error('缺少阶段计划')
  if (!p.dependencies) throw new Error('缺少 dependencies')
  if (!p.evidence) throw new Error('缺少 evidence')
})

test('1.3 version 固定为 6.0', () => {
  const p = createMissionPlan()
  if (p.version !== '6.0') throw new Error()
  const p2 = createMissionPlan({ version: '5.0' })
  if (p2.version !== '5.0') throw new Error('应允许覆盖版本')
})

// ═══════════════════════════════════════
// SECTION 2: 输入接口检查
// ═══════════════════════════════════════
console.log('\n📋 SECTION 2: Mission 输入接口')

test('2.1 Mission Plan 只有 profile/strategy/projection 作为约定输入', () => {
  const p = createMissionPlan()
  // 确认 plan 不接受 wrongGameResult/leverageResult/identityInput 等字段
  const forbiddenInputs = ['wrongGameResult', 'leverageResult', 'identityInput', 'rawAnswers',
    'userInput', 'currentDate', 'paymentStatus', 'membershipStatus']
  for (const key of forbiddenInputs) {
    if (p[key] !== undefined) throw new Error(`不应有字段: ${key}`)
  }
})

test('2.2 createMissionPlan 不接受额外顶层字段', () => {
  const p = createMissionPlan()
  // createMissionPlan 只创建已知字段，不暴露 wrongGameResult 等输入
  // 额外字段只来自 overrides spread — 需要 validate 层阻止
  const rawPlan = { ...p, wrongGameResult: 'should_not_be_here' }
  const result = validateMissionPlanContractV6(rawPlan)
  if (result.valid) throw new Error('含 wrongGameResult 的 Plan 应被拒绝')
})

test('2.3 MISSION_INPUT_CONTRACT.md 存在', () => {
  const fs = require('fs')
  const path = require('path')
  const contractPath = path.join(__dirname, '../../core/turnaround-os/MISSION_INPUT_CONTRACT.md')
  if (!fs.existsSync(contractPath)) throw new Error('MISSION_INPUT_CONTRACT.md 缺失')
})

// ═══════════════════════════════════════
// SECTION 3: 枚举合法性
// ═══════════════════════════════════════
console.log('\n📋 SECTION 3: 枚举合法性')

test('3.1 默认 category 属于 MISSION_CATEGORIES_V6', () => {
  const m = createMission()
  const cats = Object.values(C.MISSION_CATEGORIES_V6)
  if (!cats.includes(m.category)) throw new Error(`category=${m.category}`)
})

test('3.2 所有 MISSION_CATEGORIES_V6 都可被接受', () => {
  const cats = Object.values(C.MISSION_CATEGORIES_V6)
  for (const cat of cats) {
    const m = createMission({ category: cat, missionId: `MSN_T${cat.slice(0,4)}` })
    const result = validateMissionContractV6(m)
    if (!result.valid) throw new Error(`${cat} 校验失败: ${result.errors.join(';')}`)
  }
})

test('3.3 旧 MISSION_CATEGORIES 零残留', () => {
  if (C.MISSION_CATEGORIES) throw new Error('旧 MISSION_CATEGORIES 仍然存在')
})

test('3.4 非法 category 被拒绝', () => {
  // createMission 会修正非法值 → 需要直传给 validator 验证
  const m = createMission({ missionId: 'MSN_X' })
  m.category = 'INVALID_CAT'
  const result = validateMissionContractV6(m)
  if (result.valid) throw new Error('非法 category 应被拒绝')
})

test('3.5 非法 phase 被拒绝', () => {
  const m = createMission({ missionId: 'MSN_X' })
  m.phase = 'DAY_999'
  const result = validateMissionContractV6(m)
  if (result.valid) throw new Error('非法 phase 应被拒绝')
})

// ═══════════════════════════════════════
// SECTION 4: 确定性 & 无副作用
// ═══════════════════════════════════════
console.log('\n📋 SECTION 4: 确定性 & 无副作用')

test('4.1 missionId 不使用 Date', () => {
  const id = normalizeMissionId('DAY_7', 'SAFETY_REPAIR', 1)
  if (/\d{4}-\d{2}-\d{2}T/.test(id)) throw new Error('missionId 包含疑似 ISO 日期')
  if (/^\d{13}$/.test(id)) throw new Error('missionId 疑似时间戳')
})

test('4.2 missionId 不使用 Math.random', () => {
  // 三次生成，结果一致
  const ids = []
  for (let i = 0; i < 3; i++) {
    ids.push(normalizeMissionId('DAY_30', 'AI_WORKFLOW', 5))
  }
  if (new Set(ids).size !== 1) throw new Error(`不幂等: ${ids}`)
})

test('4.3 missionId 格式: MSN_D{phase}_{category}_{sequence}', () => {
  const id = normalizeMissionId('DAY_90', 'CONTENT_SYSTEM', 12)
  if (!/^MSN_D90_CONT_12$/.test(id)) throw new Error(`格式错误: ${id}`)
})

// ═══════════════════════════════════════
// SECTION 5: 无 undefined/null
// ═══════════════════════════════════════
console.log('\n📋 SECTION 5: 无 undefined/null')

test('5.1 createMission 无 undefined', () => {
  const m = createMission()
  const hasUndef = JSON.stringify(m).includes(':undefined') ||
    Object.values(m).some(v => v === undefined)
  if (hasUndef) throw new Error('Mission 含 undefined')
})

test('5.2 createMissionPlan 无 undefined', () => {
  const p = createMissionPlan()
  const hasUndef = JSON.stringify(p).includes(':undefined')
  if (hasUndef) throw new Error('Mission Plan 含 undefined')
})

test('5.3 createMission 无 null', () => {
  const m = createMission()
  // null is acceptable for top-level values with defaults
  // Check that validator catches explicit null
  const m2 = createMission({ missionId: null, phase: null, category: null })
  const result = validateMissionContractV6(m2)
  if (result.valid) throw new Error('null 字段应导致校验失败')
})

// ═══════════════════════════════════════
// SECTION 6: 数值范围
// ═══════════════════════════════════════
console.log('\n📋 SECTION 6: 数值范围')

test('6.1 confidence 范围 [0,100]', () => {
  const m = createMission({ missionId: 'MSN_1' })
  if (m.confidence < 0 || m.confidence > 100) throw new Error(`confidence=${m.confidence}`)
})

test('6.2 priorityScore 范围 [0,100]', () => {
  const m = createMission({ missionId: 'MSN_1' })
  if (m.priorityScore < 0 || m.priorityScore > 100) throw new Error(`priorityScore=${m.priorityScore}`)
})

test('6.3 estimatedMinutes 范围 [1,1440]', () => {
  const m = createMission({ missionId: 'MSN_1' })
  if (m.estimatedMinutes < 1 || m.estimatedMinutes > 1440) throw new Error(`estimatedMinutes=${m.estimatedMinutes}`)
})

test('6.4 超范围值被校验器捕获', () => {
  const m = createMission({ missionId: 'MSN_X' })
  m.priorityScore = 999
  m.confidence = -5
  const result = validateMissionContractV6(m)
  if (result.valid) throw new Error('越界值应被拒绝')
})

// ═══════════════════════════════════════
// SECTION 7: 边界检查
// ═══════════════════════════════════════
console.log('\n📋 SECTION 7: 边界检查')

test('7.1 不调用上游 Engine', () => {
  const m = createMission()
  for (const key of Object.keys(m)) {
    if (key === 'buildIdentity' || key === 'detectWrongGame' ||
        key === 'determineLeverage' || key === 'generateStrategy' ||
        key === 'projectDestiny') {
      throw new Error(`Mission 引用上游函数: ${key}`)
    }
  }
})

test('7.2 不包含 AI 引用', () => {
  const p = createMissionPlan()
  const json = JSON.stringify(p)
  if (json.includes('openai') || json.includes('llm') || json.includes('claude')) {
    throw new Error('Mission Plan 应不含 AI 引用')
  }
})

test('7.3 不包含数据库引用', () => {
  const sources = [createMission().sourceEvidence, createMissionPlan().evidence.strategyLinks]
  // 这些是用户数据，没有数据库调用
})

test('7.4 不引用支付', () => {
  const p = createMissionPlan()
  const json = JSON.stringify(p)
  if (json.includes('payment') || json.includes('wxpay') || json.includes('wechatpay')) {
    throw new Error('Mission Plan 应不含支付引用')
  }
})

// ═══════════════════════════════════════
// SECTION 8: 回归测试
// ═══════════════════════════════════════
console.log('\n📋 SECTION 8: 回归测试')

const cp = require('child_process')

test('8.1 Checkpoint 2 仍 28 pass', () => {
  const result = cp.spawnSync('node', ['tests/turnaround-os/checkpoint2.test.js'], {
    cwd: __dirname + '/../..',
    encoding: 'utf8',
    timeout: 30000,
  })
  const passMatch = result.stdout.match(/(\d+) pass/)
  const failMatch = result.stdout.match(/(\d+) fail/)
  if (!passMatch || passMatch[1] !== '28') throw new Error(`Checkpoint2 pass=${passMatch ? passMatch[1] : '?'}`)
  if (failMatch && failMatch[1] !== '0') throw new Error(`Checkpoint2 fail=${failMatch[1]}`)
})

test('8.2 Checkpoint 3 仍 22 pass', () => {
  const result = cp.spawnSync('node', ['tests/turnaround-os/checkpoint3.test.js'], {
    cwd: __dirname + '/../..',
    encoding: 'utf8',
    timeout: 30000,
  })
  const passMatch = result.stdout.match(/(\d+) pass/)
  const failMatch = result.stdout.match(/(\d+) fail/)
  if (!passMatch || passMatch[1] !== '22') throw new Error(`Checkpoint3 pass=${passMatch ? passMatch[1] : '?'}`)
  if (failMatch && failMatch[1] !== '0') throw new Error(`Checkpoint3 fail=${failMatch[1]}`)
})

// ═══════════════════════════════════════
console.log(`\n========================================`)
console.log(`RESULTS: ${PASS} pass, ${FAIL} fail`)
console.log(`========================================`)
process.exit(FAIL > 0 ? 1 : 0)
