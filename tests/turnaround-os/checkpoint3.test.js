/**
 * tests/turnaround-os/checkpoint3.test.js
 *
 * TURNAROUND_OS_V6_CHECKPOINT_3 测试 — Destiny Projection Engine
 *
 * 测试范围：
 *   - Destiny Projection Engine
 *   - World A / World B Simulators
 *   - Why Engine
 *   - Validators
 *   - 五个人格
 *   - 确定性
 */

const { buildIdentity } = require('../../core/turnaround-os/engines/identityEngineV6')
const { detectWrongGame } = require('../../core/turnaround-os/engines/wrongGameEngineV6')
const { determineLeverage } = require('../../core/turnaround-os/engines/leverageEngineV6')
const { generateStrategy } = require('../../core/turnaround-os/engines/turnaroundEngineV6')
const { projectDestiny } = require('../../core/turnaround-os/engines/destinyProjectionEngineV6')
const { explain, explainTrend, explainComparison } = require('../../core/turnaround-os/engines/whyEngineV6')
const { validateProjectionV6 } = require('../../core/turnaround-os/validators/validateProjectionV6')
const { createWorldA, createWorldB } = require('../../core/turnaround-os/contracts/destinyProjectionContractV6')

// ═══════════════════════════════════════
// FIXTURES (from checkpoint2)
// ═══════════════════════════════════════

function makeWorker() {
  return {
    identity: { occupationType: 'employee', occupationLabel: '仓库管理', ageStage: '30-35', cityTier: '三线', familyStage: '已婚有子女' },
    reality: { monthlyIncome: 5000, monthlyExpense: 4800, savings: 3000, debt: 20000, availableHoursPerWeek: 5, incomeStability: 55, safetyMonths: 0.6 },
    capabilities: { execution: 40, learning: 35, communication: 30, sales: 10, content: 10, aiAdaptability: 10, systemThinking: 15, discipline: 50 },
    psychology: { riskTolerance: 10, anxiety: 80, desire: 60, patience: 30, selfAwareness: 40, externalAttribution: 60 },
    assets: { skills: ['warehouse_logistics'], experiences: ['8years_labor'], resources: [], audience: [], credentials: [], reusableAssets: [] },
    constraints: { familyPressure: ['support_parents', 'child_education'], cashflowPressure: ['debt_repay', 'living_expenses'], timePressure: ['long_work_hours'], healthPressure: [], geographicPressure: ['small_city'], psychologicalPressure: ['fear_of_change'] },
  }
}

function makeFreelancer() {
  return {
    identity: { occupationType: 'freelancer', occupationLabel: '平面设计师', ageStage: '28-35', cityTier: '一线', familyStage: '单身' },
    reality: { monthlyIncome: 12000, monthlyExpense: 8000, savings: 50000, debt: 0, availableHoursPerWeek: 15, incomeStability: 35, safetyMonths: 6 },
    capabilities: { execution: 65, learning: 60, communication: 55, sales: 20, content: 40, aiAdaptability: 30, systemThinking: 25, discipline: 45 },
    psychology: { riskTolerance: 40, anxiety: 50, desire: 70, patience: 40, selfAwareness: 55, externalAttribution: 30 },
    assets: { skills: ['design', 'branding', 'photoshop'], experiences: ['5years_freelance'], resources: [], audience: ['wechat_contacts'], credentials: [], reusableAssets: [] },
    constraints: { familyPressure: [], cashflowPressure: ['irregular_income'], timePressure: ['client_deadlines'], healthPressure: [], geographicPressure: [], psychologicalPressure: ['income_anxiety'] },
  }
}

function makeCreator() {
  return {
    identity: { occupationType: 'creator', occupationLabel: '自媒体创作者', ageStage: '25-30', cityTier: '一线', familyStage: '单身' },
    reality: { monthlyIncome: 3000, monthlyExpense: 5000, savings: 10000, debt: 0, availableHoursPerWeek: 40, incomeStability: 15, safetyMonths: 2 },
    capabilities: { execution: 50, learning: 70, communication: 65, sales: 15, content: 75, aiAdaptability: 40, systemThinking: 30, discipline: 35 },
    psychology: { riskTolerance: 60, anxiety: 55, desire: 80, patience: 35, selfAwareness: 45, externalAttribution: 40 },
    assets: { skills: ['video_editing', 'writing', 'social_media'], experiences: ['2years_content'], resources: [], audience: ['10k_followers', 'email_list'], credentials: [], reusableAssets: [] },
    constraints: { familyPressure: [], cashflowPressure: ['low_income'], timePressure: [], healthPressure: [], geographicPressure: [], psychologicalPressure: ['monetization_pressure'] },
  }
}

function makeBusinessOwner() {
  return {
    identity: { occupationType: 'business_owner', occupationLabel: '餐饮店老板', ageStage: '35-45', cityTier: '二线', familyStage: '已婚有子女' },
    reality: { monthlyIncome: 25000, monthlyExpense: 15000, savings: 80000, debt: 50000, availableHoursPerWeek: 8, incomeStability: 60, safetyMonths: 5 },
    capabilities: { execution: 70, learning: 40, communication: 50, sales: 55, content: 20, aiAdaptability: 15, systemThinking: 25, discipline: 60 },
    psychology: { riskTolerance: 35, anxiety: 45, desire: 55, patience: 50, selfAwareness: 45, externalAttribution: 35 },
    assets: { skills: ['management', 'food_industry'], experiences: ['8years_business'], resources: ['supplier_network', 'customer_base'], audience: ['regular_customers'], credentials: [], reusableAssets: [] },
    constraints: { familyPressure: ['children_expenses'], cashflowPressure: ['business_reinvestment'], timePressure: ['business_daily_ops'], healthPressure: [], geographicPressure: [], psychologicalPressure: [] },
  }
}

function makeHighIncomePro() {
  return {
    identity: { occupationType: 'professional', occupationLabel: '软件工程师', ageStage: '30-38', cityTier: '一线', familyStage: '已婚有子女' },
    reality: { monthlyIncome: 45000, monthlyExpense: 25000, savings: 300000, debt: 500000, availableHoursPerWeek: 10, incomeStability: 90, safetyMonths: 12 },
    capabilities: { execution: 75, learning: 85, communication: 60, sales: 10, content: 20, aiAdaptability: 70, systemThinking: 65, discipline: 70 },
    psychology: { riskTolerance: 30, anxiety: 40, desire: 65, patience: 55, selfAwareness: 60, externalAttribution: 25 },
    assets: { skills: ['programming', 'system_architecture', 'ai_tools'], experiences: ['10years_tech'], resources: ['professional_network'], audience: [], credentials: ['top_school'], reusableAssets: [] },
    constraints: { familyPressure: ['mortgage', 'child_future'], cashflowPressure: ['high_mortgage'], timePressure: ['corporate_demands'], healthPressure: [], geographicPressure: [], psychologicalPressure: ['golden_handcuffs'] },
  }
}

const FIXTURES = {
  worker: makeWorker,
  freelancer: makeFreelancer,
  creator: makeCreator,
  businessOwner: makeBusinessOwner,
  highIncomePro: makeHighIncomePro,
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function runFull(input) {
  const profile = buildIdentity(input)
  const wrongGame = detectWrongGame(profile)
  const leverage = determineLeverage(profile, wrongGame)
  const strategy = generateStrategy(profile, wrongGame, leverage, { generatedAt: '2026-07-21T00:00:00Z' })
  const projection = projectDestiny(profile, wrongGame, strategy, leverage)
  return { profile, wrongGame, leverage, strategy, projection }
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`)
  return true
}

let passed = 0
let failed = 0
const failures = []

function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ✅ ${name}`)
  } catch (e) {
    failed++
    failures.push({ name, error: e.message })
    console.log(`  ❌ ${name}: ${e.message}`)
  }
}

// ═══════════════════════════════════════
// SECTION 1: Basic Structure
// ═══════════════════════════════════════
console.log('\n📋 SECTION 1: Projection Structure')
test('1.1 worldA 存在', () => {
  const { projection } = runFull(makeWorker())
  assert(!!projection.worldA, 'no worldA')
  assert(!!projection.worldA.day90, 'no day90')
  assert(!!projection.worldA.day365, 'no day365')
  assert(!!projection.worldA.year3, 'no year3')
})

test('1.2 worldB 存在', () => {
  const { projection } = runFull(makeWorker())
  assert(!!projection.worldB, 'no worldB')
  assert(!!projection.worldB.day90, 'no day90')
})

test('1.3 comparison 完整', () => {
  const { projection } = runFull(makeWorker())
  assert(projection.comparison.biggestGap.length > 0, 'no biggestGap')
  assert(projection.comparison.biggestRisk.length > 0, 'no biggestRisk')
  assert(projection.comparison.mostWorthChanging.length > 0, 'no mostWorthChanging')
  assert(projection.comparison.forkPoint.length > 0, 'no forkPoint')
})

test('1.4 decisionNodes 完整', () => {
  const { projection } = runFull(makeWorker())
  assert(projection.decisionNodes.length >= 2, `decisionNodes: ${projection.decisionNodes.length}`)
  assert(projection.decisionNodes[0].node.length > 0, 'first node empty')
})

// ═══════════════════════════════════════
// SECTION 2: Determinism & Safety
// ═══════════════════════════════════════
console.log('\n📋 SECTION 2: Determinism & Safety')
test('2.1 同输入三次完全一致', () => {
  const p1 = runFull(makeWorker()).projection
  const p2 = runFull(makeWorker()).projection
  const p3 = runFull(makeWorker()).projection
  assert(p1.worldA.year3.overallTrajectory === p2.worldA.year3.overallTrajectory, 'World A run 1 vs 2')
  assert(p2.worldA.year3.overallTrajectory === p3.worldA.year3.overallTrajectory, 'World A run 2 vs 3')
  assert(p1.worldB.year3.overallTrajectory === p2.worldB.year3.overallTrajectory, 'World B run 1 vs 2')
  assert(p1.comparison.biggestGap === p2.comparison.biggestGap, 'comparison 1 vs 2')
})

test('2.2 无 undefined', () => {
  const { projection } = runFull(makeWorker())
  assert(!JSON.stringify(projection).includes('undefined'), 'contain undefined')
})

test('2.3 无 Math.random', () => {
  // 如果包含 Math.random, World A/B 的 summary 会随机
  const p1 = runFull(makeWorker()).projection
  const p2 = runFull(makeWorker()).projection
  assert(p1.worldA.year3.summary === p2.worldA.year3.summary, 'summary must be deterministic')
})

test('2.4 不预测具体收入', () => {
  const { projection } = runFull(makeWorker())
  const s = JSON.stringify(projection)
  const patterns = [/月入\d+万/, /年入\d+万/, /赚\d+万/]
  for (const p of patterns) {
    assert(!p.test(s), `matched: ${p}`)
  }
})

test('2.5 不含保证收益词', () => {
  const { projection } = runFull(makeWorker())
  const s = JSON.stringify(projection)
  const bad = ['稳赚', '必赚', '保证翻身', '保证收益']
  for (const w of bad) {
    assert(!s.includes(w), `contain: ${w}`)
  }
})

// ═══════════════════════════════════════
// SECTION 3: Why Engine
// ═══════════════════════════════════════
console.log('\n📋 SECTION 3: Why Engine')
test('3.1 explain 包含 ruleId', () => {
  const result = explain({ conclusion: 'test', ruleId: 'RULE_001', sourceFields: ['a'], sourceValues: ['v'], assumptions: ['a1'], conditions: 'c1' })
  assert(result.ruleId === 'RULE_001', 'ruleId mismatch')
  assert(result.sourceFields.length === 1, 'sourceFields')
  assert(result.assumptions.length === 1, 'assumptions')
})

test('3.2 explainTrend 输出有效', () => {
  const p = buildIdentity(makeWorker())
  const result = explainTrend('incomeTrend', '停滞', p, {
    trendRules: [{ tag: 'incomeTrend', direction: '停滞', ruleId: 'R1', sourceFields: ['reality.monthlyIncome'] }],
    assumptions: ['保持不变'],
  })
  assert(result.ruleId === 'R1', 'ruleId mismatch')
  assert(result.conclusion.includes('incomeTrend'), 'conclusion')
})

test('3.3 worldA.worldB 各包含 whyResults', () => {
  const { projection } = runFull(makeWorker())
  assert(Array.isArray(projection.worldA.whyResults), 'worldA no whyResults array')
  assert(Array.isArray(projection.worldB.whyResults), 'worldB no whyResults array')
})

// ═══════════════════════════════════════
// SECTION 4: Projection Meta
// ═══════════════════════════════════════
console.log('\n📋 SECTION 4: Projection Meta')
test('4.1 assumptions 存在', () => {
  const { projection } = runFull(makeWorker())
  assert(projection.assumptions.length > 0, 'no assumptions')
})

test('4.2 limitingFactors 存在', () => {
  const { projection } = runFull(makeWorker())
  assert(projection.limitingFactors.length > 0, 'no limitingFactors')
})

test('4.3 projectionConfidence 0-100', () => {
  const { projection } = runFull(makeWorker())
  assert(projection.projectionConfidence >= 0 && projection.projectionConfidence <= 100,
    `confidence: ${projection.projectionConfidence}`)
})

test('4.4 disclaimer 存在', () => {
  const { projection } = runFull(makeWorker())
  assert(projection.disclaimer.length > 0, 'no disclaimer')
})

// ═══════════════════════════════════════
// SECTION 5: Validator
// ═══════════════════════════════════════
console.log('\n📋 SECTION 5: Validator')
test('5.1 validateProjectionV6 通过', () => {
  const { projection } = runFull(makeWorker())
  const v = validateProjectionV6(projection)
  if (!v.valid) console.log('  Errors:', v.errors)
  if (v.warnings.length) console.log('  Warnings:', v.warnings)
  assert(v.valid, `validation failed: ${v.errors.join('; ')}`)
})

test('5.2 五组fixture均通过validator', () => {
  for (const [name, maker] of Object.entries(FIXTURES)) {
    const { projection } = runFull(maker())
    const v = validateProjectionV6(projection)
    assert(v.valid, `${name}: ${v.errors.join('; ')}`)
  }
})

// ═══════════════════════════════════════
// SECTION 6: Five Persona Differences
// ═══════════════════════════════════════
console.log('\n📋 SECTION 6: Persona Differences')
test('6.1 五人格 World A trajectory 不完全相同', () => {
  const trajs = {}
  for (const [name, maker] of Object.entries(FIXTURES)) {
    trajs[name] = runFull(maker()).projection.worldA.year3.overallTrajectory
  }
  const unique = new Set(Object.values(trajs))
  assert(unique.size > 1, `all same: ${JSON.stringify(trajs)}`)
})

test('6.2 五人格 World B trajectory 有差异', () => {
  const trajs = {}
  for (const [name, maker] of Object.entries(FIXTURES)) {
    trajs[name] = runFull(maker()).projection.worldB.year3.overallTrajectory
  }
  const unique = new Set(Object.values(trajs))
  assert(unique.size > 1, `all same: ${JSON.stringify(trajs)}`)
})

test('6.3 worker 比 highIncomePro 的 World A 更差', () => {
  const workerA = runFull(makeWorker()).projection.worldA.year3.overallTrajectory
  const proA = runFull(makeHighIncomePro()).projection.worldA.year3.overallTrajectory
  const trends = { '明显下降': -2, '下降': -1, '停滞': 0, '缓慢改善': 1, '改善': 2, '明显改善': 3, '结构性改善': 4 }
  assert((trends[workerA] || 0) <= (trends[proA] || 0), `worker:${workerA} v pro:${proA}`)
})

test('6.4 comparison 不出错误', () => {
  for (const [name, maker] of Object.entries(FIXTURES)) {
    const { projection } = runFull(maker())
    assert(projection.comparison.biggestGap.length > 0, `${name}: no biggestGap`)
    assert(projection.comparison.irreversibleRisk.length > 0, `${name}: no irreversibleRisk`)
  }
})

// ═══════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════
console.log(`\n========================================`)
console.log(`RESULTS: ${passed} pass, ${failed} fail`)
console.log(`========================================`)
if (failures.length > 0) {
  console.log('FAILURES:')
  for (const f of failures) console.log(`  ❌ ${f.name}: ${f.error}`)
}

// Print persona comparison
console.log('\n=== FIVE PERSONA PROJECTION ===')
for (const [name, maker] of Object.entries(FIXTURES)) {
  const { profile, projection, leverage } = runFull(maker())
  console.log(`\n[${name}]`)
  console.log(`  Stage: ${profile.wealthStageLabel}`)
  console.log(`  Lever: ${leverage.primaryLeverage.label}`)
  console.log(`  A-90d: ${projection.worldA.day90.overallTrajectory}`)
  console.log(`  A-1y:  ${projection.worldA.day365.overallTrajectory}`)
  console.log(`  A-3y:  ${projection.worldA.year3.overallTrajectory}`)
  console.log(`  B-90d: ${projection.worldB.day90.overallTrajectory}`)
  console.log(`  B-1y:  ${projection.worldB.day365.overallTrajectory}`)
  console.log(`  B-3y:  ${projection.worldB.year3.overallTrajectory}`)
  console.log(`  Gap:   ${projection.comparison.biggestGap}`)
  console.log(`  Nodes: ${projection.decisionNodes.length}`)
}
