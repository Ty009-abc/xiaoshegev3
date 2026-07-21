/**
 * tests/turnaround-os/checkpoint2.test.js
 *
 * TURNAROUND_OS_V6_CHECKPOINT_2 测试
 *
 * 测试范围：
 *   - identity engine
 *   - wrong game engine
 *   - leverage engine
 *   - turnaround engine
 *   - validators
 *   - 五个人格差异
 *   - 确定性
 */

const { buildIdentity } = require('../../core/turnaround-os/engines/identityEngineV6')
const { detectWrongGame } = require('../../core/turnaround-os/engines/wrongGameEngineV6')
const { determineLeverage } = require('../../core/turnaround-os/engines/leverageEngineV6')
const { generateStrategy } = require('../../core/turnaround-os/engines/turnaroundEngineV6')
const { validateIdentityV6 } = require('../../core/turnaround-os/validators/validateIdentityV6')
const { validateWrongGameV6 } = require('../../core/turnaround-os/validators/validateWrongGameV6')
const { validateLeverageV6 } = require('../../core/turnaround-os/validators/validateLeverageV6')
const { validateStrategyV6 } = require('../../core/turnaround-os/validators/validateStrategyV6')

// ═══════════════════════════════════════
// FIXTURE: 五个人格
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
  return { profile, wrongGame, leverage, strategy }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`)
  }
  return true
}

// ═══════════════════════════════════════
// TESTS
// ═══════════════════════════════════════

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

// ═══ SECTION 1: Identity ═══
console.log('\n📋 SECTION 1: Identity Engine')
test('1.1 identity通过validator', () => {
  const p = buildIdentity(makeWorker())
  const v = validateIdentityV6(p)
  assert(v.valid, v.errors.join('; '))
  assert(!JSON.stringify(p).includes('undefined'), 'contain undefined')
  assert(!JSON.stringify(p).includes('null'), 'contain null')
})

test('1.2 阶段判断 ruleId 可追踪', () => {
  const p = buildIdentity(makeWorker())
  assert(p.evidence.ruleHits.length > 0, 'no rule hits')
  assert(p.wealthStage === 'SURVIVAL', `expected SURVIVAL, got ${p.wealthStage}`)
  assert(p.stageReason.length > 0, 'no stage reason')
})

test('1.3 readinessScore 0-100', () => {
  const p = buildIdentity(makeWorker())
  assert(p.strategyReadinessScore >= 0 && p.strategyReadinessScore <= 100, `readiness: ${p.strategyReadinessScore}`)
})

// ═══ SECTION 2: Wrong Game ═══
console.log('\n📋 SECTION 2: Wrong Game Engine')
test('2.1 错误游戏只有1个primary', () => {
  const { wrongGame } = runFull(makeWorker())
  assert(!!wrongGame.primaryWrongGame, 'no primary')
  assert(wrongGame.primaryWrongGame.gameType !== 'UNKNOWN_GAME', 'should not be UNKNOWN')
})

test('2.2 错误游戏证据至少2条', () => {
  const { wrongGame } = runFull(makeWorker())
  assert(wrongGame.primaryWrongGame.evidence.length >= 2, `evidence: ${wrongGame.primaryWrongGame.evidence.length}`)
})

test('2.3 同输入三次结果一致', () => {
  const r1 = detectWrongGame(buildIdentity(makeWorker()))
  const r2 = detectWrongGame(buildIdentity(makeWorker()))
  const r3 = detectWrongGame(buildIdentity(makeWorker()))
  assert(r1.primaryWrongGame.gameType === r2.primaryWrongGame.gameType, 'run 1 vs 2')
  assert(r1.primaryWrongGame.gameType === r3.primaryWrongGame.gameType, 'run 1 vs 3')
})

test('2.4 wrongGameValidator通过', () => {
  const { wrongGame } = runFull(makeWorker())
  const v = validateWrongGameV6(wrongGame)
  assert(v.valid, `validation failed: ${v.errors.join('; ')}`)
})

test('2.5 wrongGame输出无undefined', () => {
  const { wrongGame } = runFull(makeWorker())
  assert(!JSON.stringify(wrongGame).includes('undefined'), 'contain undefined')
})

// ═══ SECTION 3: Leverage ═══
console.log('\n📋 SECTION 3: Leverage Engine')
test('3.1 primaryLeverage只有1个', () => {
  const { leverage } = runFull(makeFreelancer())
  assert(!!leverage.primaryLeverage, 'no primary')
  assert(leverage.primaryLeverage.type, 'no type')
})

test('3.2 secondary最多2个', () => {
  const { leverage } = runFull(makeFreelancer())
  assert(leverage.secondaryLeverages.length <= 2, `secondary count: ${leverage.secondaryLeverages.length}`)
})

test('3.3 被拒杠杆至少3个', () => {
  const { leverage } = runFull(makeFreelancer())
  assert(leverage.rejectedLeverages.length >= 3, `rejected: ${leverage.rejectedLeverages.length}`)
})

test('3.4 每条被拒有具体原因', () => {
  const { leverage } = runFull(makeFreelancer())
  for (const r of leverage.rejectedLeverages) {
    assert(r.reason && r.reason.length > 0, `${r.type}: no reason`)
    assert(r.blockingFactors && r.blockingFactors.length > 0, `${r.type}: no blocking factors`)
  }
})

test('3.5 生存期不推荐TEAM_CAPITAL或ASSET_COMPOUNDING', () => {
  const { leverage } = runFull(makeWorker())
  assert(leverage.primaryLeverage.type !== 'TEAM_CAPITAL', 'should not recommend TEAM_CAPITAL')
  assert(leverage.primaryLeverage.type !== 'ASSET_COMPOUNDING', 'should not recommend ASSET_COMPOUNDING')
})

test('3.6 leverageValidator通过', () => {
  const { leverage } = runFull(makeFreelancer())
  const v = validateLeverageV6(leverage)
  assert(v.valid, `validation failed: ${v.errors.join('; ')}`)
})

test('3.7 五人格primaryLeverage不能全部相同', () => {
  const levers = {}
  for (const [name, maker] of Object.entries(FIXTURES)) {
    const { leverage } = runFull(maker())
    levers[name] = leverage.primaryLeverage.type
  }
  const unique = new Set(Object.values(levers))
  assert(unique.size > 1, `all same: ${JSON.stringify(levers)}`)
})

// ═══ SECTION 4: Specific persona strategies ═══
console.log('\n📋 SECTION 4: Persona-specific Strategies')

test('4.1 自由职业者优先服务产品化', () => {
  const { leverage } = runFull(makeFreelancer())
  // 自由职业者 with no reusable assets → 最匹配应为 SERVICE_PRODUCTIZATION 或 相近
  const top3 = [leverage.primaryLeverage.type, ...leverage.secondaryLeverages.map(l => l.type)]
  const hasProductization = top3.includes('SERVICE_PRODUCTIZATION') || top3.includes('KNOWLEDGE_PRODUCT') || top3.includes('AI_PRODUCTIVITY')
  assert(hasProductization, `top3: ${top3}`)
})

test('4.2 创作者有流量无产品优先商业闭环', () => {
  const { leverage } = runFull(makeCreator())
  const top3 = [leverage.primaryLeverage.type, ...leverage.secondaryLeverages.map(l => l.type)]
  const hasMonetization = top3.includes('SALES_CONVERSION') || top3.includes('KNOWLEDGE_PRODUCT') || top3.includes('CONTENT_DISTRIBUTION')
  assert(hasMonetization, `top3: ${top3}`)
})

test('4.3 小生意经营者优先自动化系统', () => {
  const { leverage } = runFull(makeBusinessOwner())
  const top3 = [leverage.primaryLeverage.type, ...leverage.secondaryLeverages.map(l => l.type)]
  const hasAutomation = top3.includes('AUTOMATION_SYSTEM') || top3.includes('TEAM_CAPITAL') || top3.includes('AI_PRODUCTIVITY')
  assert(hasAutomation, `top3: ${top3}`)
})

test('4.4 高收入职业用户main杠杆不是裸辞', () => {
  const { leverage, strategy } = runFull(makeHighIncomePro())
  // main lever shouldn't be things that imply quitting
  const highRisk = ['TEAM_CAPITAL', 'ASSET_COMPOUNDING']
  assert(!highRisk.includes(leverage.primaryLeverage.type), `risky: ${leverage.primaryLeverage.type}`)
  // whatNotToDo 不应说「辞职」
  const wntd = JSON.stringify(strategy.primaryStrategy.whatNotToDo)
  assert(!wntd.includes('辞职'), 'contain 辞职')
})

test('4.5 五人格primaryWrongGame不能全部相同', () => {
  const games = {}
  for (const [name, maker] of Object.entries(FIXTURES)) {
    const { wrongGame } = runFull(maker())
    games[name] = wrongGame.primaryWrongGame.gameType
  }
  const unique = new Set(Object.values(games))
  assert(unique.size > 1, `all same: ${JSON.stringify(games)}`)
})

// ═══ SECTION 5: Strategy ═══
console.log('\n📋 SECTION 5: Turnaround Strategy')

test('5.1 strategyReadinessScore 0-100', () => {
  const { strategy } = runFull(makeWorker())
  assert(strategy.verdict.strategyReadinessScore >= 0 && strategy.verdict.strategyReadinessScore <= 100,
    `readiness: ${strategy.verdict.strategyReadinessScore}`)
})

test('5.2 probabilityType正确', () => {
  const { strategy } = runFull(makeWorker())
  assert(strategy.verdict.probabilityType === 'strategy_model_estimate',
    `probabilityType: ${strategy.verdict.probabilityType}`)
})

test('5.3 strategyValidator通过', () => {
  const { strategy } = runFull(makeWorker())
  const v = validateStrategyV6(strategy)
  assert(v.valid, `validation failed: ${v.errors.join('; ')}`)
})

test('5.4 strategy 无undefined', () => {
  const { strategy } = runFull(makeWorker())
  assert(!JSON.stringify(strategy).includes('undefined'), 'contain undefined')
})

test('5.5 strategy 不含保证收益词', () => {
  const { strategy } = runFull(makeWorker())
  const s = JSON.stringify(strategy)
  const bad = ['稳赚', '必赚', '保证翻身', '保证收益']
  for (const word of bad) {
    assert(!s.includes(word), `contain: ${word}`)
  }
})

test('5.6 同输入strategy结果一致', () => {
  const s1 = generateStrategy(buildIdentity(makeWorker()), detectWrongGame(buildIdentity(makeWorker())), determineLeverage(buildIdentity(makeWorker()), detectWrongGame(buildIdentity(makeWorker()))), { generatedAt: '2026-07-21T00:00:00Z' })
  const s2 = generateStrategy(buildIdentity(makeWorker()), detectWrongGame(buildIdentity(makeWorker())), determineLeverage(buildIdentity(makeWorker()), detectWrongGame(buildIdentity(makeWorker()))), { generatedAt: '2026-07-21T00:00:00Z' })
  assert(s1.verdict.strategyReadinessScore === s2.verdict.strategyReadinessScore, 'readiness mismatch')
  assert(s1.verdict.headline === s2.verdict.headline, 'headline mismatch')
})

// ═══ SECTION 6: 无支付/无DB ═══
console.log('\n📋 SECTION 6: Safety Checks')
test('6.1 五人格strategies不同质化', () => {
  const headlines = {}
  for (const [name, maker] of Object.entries(FIXTURES)) {
    const { strategy } = runFull(maker())
    headlines[name] = { headline: strategy.verdict.headline, lever: strategy.primaryStrategy.primaryLeverage.type }
  }
  // 至少3个不同的 headline
  const uniqueHeadlines = new Set(Object.values(headlines).map(h => h.headline))
  assert(uniqueHeadlines.size >= 3, `headlines too similar: ${JSON.stringify(headlines)}`)
})

test('6.2 不引用支付模块', () => {
  const { strategy } = runFull(makeWorker())
  const s = JSON.stringify(strategy)
  assert(!s.includes('payment') && !s.includes('pay_callback') && !s.includes('wxpay'), 'contain payment ref')
})

// ═══════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════
console.log(`\n========================================`)
console.log(`RESULTS: ${passed} pass, ${failed} fail`)
console.log(`========================================`)
if (failures.length > 0) {
  console.log('FAILURES:')
  for (const f of failures) {
    console.log(`  ❌ ${f.name}: ${f.error}`)
  }
}

// 输出五人格摘要
console.log('\n=== FIVE PERSONA SUMMARY ===')
for (const [name, maker] of Object.entries(FIXTURES)) {
  const { profile, wrongGame, leverage, strategy } = runFull(maker())
  console.log(`\n[${name}]`)
  console.log(`  Stage: ${profile.wealthStageLabel}`)
  console.log(`  Readiness: ${strategy.verdict.strategyReadinessScore}`)
  console.log(`  WrongGame: ${wrongGame.primaryWrongGame.gameLabel}`)
  console.log(`  PrimaryLeverage: ${leverage.primaryLeverage.label} (${leverage.primaryLeverage.fitScore})`)
  console.log(`  Headline: ${strategy.verdict.headline}`)
}
