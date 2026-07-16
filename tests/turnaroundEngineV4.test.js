/**
 * tests/turnaroundEngineV4.test.js
 *
 * V4 引擎自动化测试 — 20+ 边界画像
 * 运行: node tests/turnaroundEngineV4.test.js
 */

const path = require('path')
const { analyze, ALL_RULES } = require('../cloudfunctions/generateAiReport/lib/engine/turnaroundEngineV4.js')

// ── 辅助 ──
function makeAnswers(fields) {
  const defaults = {
    lifeStage: '31-40岁',
    incomeStructure: '工资/固定薪资',
    occupationDetail: '程序员',
    monthlySurplus: '1000-5000元',
    safetyMonths: '3-6个月',
    debtPressure: '无负债',
    skillValidation: '从未变现过',
    monetizableSkill: '技术类（编程/设计/工程）',
    weeklyTime: '10-20小时',
    executionStability: '有固定计划，基本能执行',
    pastAttemptStage: '还没开始过任何尝试',
    decisionStyle: '边上班边小规模测试',
    primaryGoal: '搞一份副业收入',
    maxTrialCost: '1000-5000元',
    failureResponse: '复盘优化后继续',
    ...fields,
  }
  return { diagnosticVersion: 'v4', answers: defaults, ...defaults }
}

function assert(condition, name) {
  if (condition) {
    console.log('  ✅', name)
    return true
  } else {
    console.log('  ❌', name)
    return false
  }
}

// ══════════════════════════════════════════════════════════════════
// TEST SUITE
// ══════════════════════════════════════════════════════════════════

let passCount = 0
let failCount = 0
function test(name, fn) {
  console.log('\n📋 ' + name)
  try {
    const ok = fn()
    if (ok) passCount++
    else failCount++
    return ok
  } catch (e) {
    console.log('  💥 CRASH:', e.message)
    failCount++
    return false
  }
}

// ── 基础设施测试 ──
test('Rule count = 100', () => {
  const counts = {
    income: require('../cloudfunctions/generateAiReport/lib/engine/rules/incomeRules.js').length,
    cashflow: require('../cloudfunctions/generateAiReport/lib/engine/rules/cashflowRules.js').length,
    skill: require('../cloudfunctions/generateAiReport/lib/engine/rules/skillRules.js').length,
    time: require('../cloudfunctions/generateAiReport/lib/engine/rules/timeRules.js').length,
    execution: require('../cloudfunctions/generateAiReport/lib/engine/rules/executionRules.js').length,
    goal: require('../cloudfunctions/generateAiReport/lib/engine/rules/goalRules.js').length,
    risk: require('../cloudfunctions/generateAiReport/lib/engine/rules/riskRules.js').length,
    decision: require('../cloudfunctions/generateAiReport/lib/engine/rules/decisionRules.js').length,
  }
  const total = Object.values(counts).reduce((s, v) => s + v, 0)
  console.log('  count by category:', JSON.stringify(counts))
  console.log('  total:', total)
  return total === 100
})

test('No rule has empty output', () => {
  const empty = ALL_RULES.filter(r => !r.output.title || !r.output.description || !r.output.advice)
  if (empty.length) {
    console.log('  empty output rules:', empty.map(r => r.id))
  }
  return empty.length === 0
})

test('All rules have valid id/name/weight/level', () => {
  const bad = ALL_RULES.filter(r => !r.id || !r.name || typeof r.weight !== 'number' || !r.level)
  return bad.length === 0
})

// ── 20 个边界画像测试 ──
const profiles = {
  '高收入低执行': makeAnswers({
    incomeStructure: '工资/固定薪资',
    monthlySurplus: '10000元以上',
    safetyMonths: '12-24个月',
    executionStability: '很容易三分钟热度，计划经常中断',
    skillValidation: '从未变现过',
    primaryGoal: '搞一份副业收入',
  }),
  '低收入高能力': makeAnswers({
    incomeStructure: '技能服务（按次/项目收费）',
    monthlySurplus: '基本为零',
    safetyMonths: '3-6个月',
    skillValidation: '偶尔有付费需求',
    monetizableSkill: '技术类（编程/设计/工程）',
    weeklyTime: '10-20小时',
    executionStability: '非常稳定，不需要外部督促',
  }),
  '高负债想投资': makeAnswers({
    debtPressure: '债务压力高/以贷养贷',
    safetyMonths: '1-3个月',
    primaryGoal: '搞一份副业收入',
    incomeStructure: '工资/固定薪资',
    monthlySurplus: '基本为零',
  }),
  '零现金流': makeAnswers({
    monthlySurplus: '负数（入不敷出）',
    safetyMonths: '不到1个月',
    debtPressure: '消费贷/信用卡压力较大',
  }),
  '创业型厨师': makeAnswers({
    incomeStructure: '技能服务（按次/项目收费）',
    occupationDetail: '厨师',
    monetizableSkill: '手艺人（厨师/维修/美业）',
    safetyMonths: '1-3个月',
    primaryGoal: '建立个人IP/品牌',
    monthlySurplus: '1000元以下',
  }),
  '打工型程序员': makeAnswers({
    incomeStructure: '工资/固定薪资',
    occupationDetail: '程序员',
    monetizableSkill: '技术类（编程/设计/工程）',
    monthlySurplus: '5000-10000元',
    safetyMonths: '6-12个月',
    executionStability: '非常稳定，不需要外部督促',
    skillValidation: '偶尔有付费需求',
    primaryGoal: '搞一份副业收入',
  }),
  '副业型销售': makeAnswers({
    incomeStructure: '销售/佣金/提成',
    monetizableSkill: '销售/商务谈单',
    pastAttemptStage: '卖出过几个，有少量收入',
    safetyMonths: '12-24个月',
    executionStability: '有固定计划，基本能执行',
    skillValidation: '偶尔有付费需求',
    primaryGoal: '把技能变现/做咨询',
  }),
  'AI型内容创作者': makeAnswers({
    incomeStructure: '线上内容/流量变现',
    monetizableSkill: '内容创作（写/拍/剪/直播）',
    safetyMonths: '3-6个月',
    pastAttemptStage: '做了一个产品/服务但没卖出去',
    primaryGoal: '建立个人IP/品牌',
    weeklyTime: '20小时以上',
  }),
  '风险偏好型': makeAnswers({
    decisionStyle: '直接辞职/全职All-in',
    safetyMonths: '1-3个月',
    failureResponse: '追加投入再试一次',
    maxTrialCost: '几乎为零（赔不起）',
  }),
  '长期主义': makeAnswers({
    primaryGoal: '搞一份副业收入',
    safetyMonths: '24个月以上',
    executionStability: '非常稳定，不需要外部督促',
    weeklyTime: '10-20小时',
    skillValidation: '有稳定客户/收入',
    monetizableSkill: '销售/商务谈单',
  }),
  '完全无方向': makeAnswers({
    monetizableSkill: '暂时不清楚',
    skillValidation: '从未变现过',
    pastAttemptStage: '还没开始过任何尝试',
    primaryGoal: '先找到方向再说',
    monthlySurplus: '1000元以下',
    safetyMonths: '3-6个月',
  }),
  '三分钟热度': makeAnswers({
    executionStability: '很容易三分钟热度，计划经常中断',
    pastAttemptStage: '坚持不到30天就停了',
    primaryGoal: '建立个人IP/品牌',
    weeklyTime: '10-20小时',
  }),
  '冲动裸辞': makeAnswers({
    decisionStyle: '直接辞职/全职All-in',
    safetyMonths: '1-3个月',
    incomeStructure: '工资/固定薪资',
    primaryGoal: '转行进入新领域',
  }),
  '过度保守': makeAnswers({
    decisionStyle: '能不动就不动',
    pastAttemptStage: '卖出过几个，有少量收入',
    skillValidation: '偶尔有付费需求',
    monetizableSkill: '技术类（编程/设计/工程）',
  }),
  '稳定副业收入': makeAnswers({
    pastAttemptStage: '已有稳定的副业/兼职收入',
    skillValidation: '有稳定客户/收入',
    executionStability: '非常稳定，不需要外部督促',
    monetizableSkill: '内容创作（写/拍/剪/直播）',
    safetyMonths: '12-24个月',
    primaryGoal: '从副业变主业/独立',
  }),
  '50岁转型': makeAnswers({
    lifeStage: '50岁以上',
    incomeStructure: '工资/固定薪资',
    occupationDetail: '管理岗位',
    primaryGoal: '把技能变现/做咨询',
    monetizableSkill: '运营/管理/统筹',
    safetyMonths: '12-24个月',
    skillValidation: '从未变现过',
  }),
  '全职宝妈': makeAnswers({
    incomeStructure: '收入不稳定',
    occupationDetail: '全职宝妈',
    safetyMonths: '1-3个月',
    weeklyTime: '2-5小时',
    monetizableSkill: '暂时不清楚',
    primaryGoal: '搞一份副业收入',
    skillValidation: '免费帮人做过',
  }),
  '个体店主亏损': makeAnswers({
    incomeStructure: '实体生意/经营收入',
    safetyMonths: '3-6个月',
    monthlySurplus: '负数（入不敷出）',
    occupationDetail: '个体店主',
    monetizableSkill: '销售/商务谈单',
    primaryGoal: '还清债务/修复现金流',
  }),
  '内容创作者无变现': makeAnswers({
    incomeStructure: '线上内容/流量变现',
    monetizableSkill: '内容创作（写/拍/剪/直播）',
    pastAttemptStage: '做了一个产品/服务但没卖出去',
    safetyMonths: '3-6个月',
    skillValidation: '从未变现过',
    primaryGoal: '搞一份副业收入',
  }),
  '手艺人做培训': makeAnswers({
    incomeStructure: '技能服务（按次/项目收费）',
    monetizableSkill: '手艺人（厨师/维修/美业）',
    skillValidation: '偶尔有付费需求',
    safetyMonths: '6-12个月',
    executionStability: '非常稳定，不需要外部督促',
    primaryGoal: '把技能变现/做咨询',
  }),
  '完全无方向+无能力': makeAnswers({
    monetizableSkill: '暂时不清楚',
    skillValidation: '从未变现过',
    pastAttemptStage: '还没开始过任何尝试',
    primaryGoal: '先找到方向再说',
    decisionStyle: '能不动就不动',
    executionStability: '很容易三分钟热度，计划经常中断',
  }),
}

// Test: every profile runs without crash
test('20 profiles — no crash', () => {
  let crashCount = 0
  for (const [name, ans] of Object.entries(profiles)) {
    try {
      const r = analyze(ans)
      if (!r || !r.matchedRules) {
        console.log('  bad result for', name, ':', JSON.stringify(r?.meta || 'null'))
        crashCount++
      }
    } catch (e) {
      console.log('  crash:', name, e.message)
      crashCount++
    }
  }
  console.log('  crashes:', crashCount)
  return crashCount === 0
})

// Test: every profile has at least 1 matched rule
test('20 profiles — all have matched rules', () => {
  let emptyCount = 0
  for (const [name, ans] of Object.entries(profiles)) {
    const r = analyze(ans)
    if (r.matchedRules.length === 0) {
      console.log('  EMPTY:', name)
      emptyCount++
    }
  }
  console.log('  empty:', emptyCount)
  return emptyCount === 0
})

// Test: every profile has scores between 0-100
test('20 profiles — scores in [0,100]', () => {
  let err = 0
  for (const [name, ans] of Object.entries(profiles)) {
    const r = analyze(ans)
    const s = r.scores
    if (s.overall < 0 || s.overall > 100 ||
        s.cashflow < 0 || s.cashflow > 100 ||
        s.skill < 0 || s.skill > 100 ||
        s.execution < 0 || s.execution > 100 ||
        s.time < 0 || s.time > 100 ||
        s.risk < 0 || s.risk > 100) {
      console.log('  OUT OF RANGE:', name, JSON.stringify(s))
      err++
    }
  }
  console.log('  range errors:', err)
  return err === 0
})

// Test: every profile has valid meta
test('20 profiles — meta present', () => {
  let err = 0
  for (const [name, ans] of Object.entries(profiles)) {
    const r = analyze(ans)
    if (!r.meta || r.meta.engineVersion !== 'v4' || typeof r.meta.ruleCount !== 'number' ||
        typeof r.meta.matchedCount !== 'number' || typeof r.meta.fatalCount !== 'number' ||
        typeof r.meta.advantageCount !== 'number') {
      console.log('  BAD META:', name, JSON.stringify(r.meta))
      err++
    }
  }
  console.log('  meta errors:', err)
  return err === 0
})

// Test: every profile has labels
test('20 profiles — labels present', () => {
  let err = 0
  for (const [name, ans] of Object.entries(profiles)) {
    const r = analyze(ans)
    if (!Array.isArray(r.labels)) {
      console.log('  BAD LABELS:', name)
      err++
    }
  }
  console.log('  label errors:', err)
  return err === 0
})

// Specific tests
test('高负债想投资 → CF_011 triggered', () => {
  const r = analyze(profiles['高负债想投资'])
  console.log('  fatal:', r.fatalRules.map(f => f.id))
  return r.fatalRules.some(f => f.id === 'R_CF_011' || f.id === 'R_CF_014')
})

test('零现金流 → has CF_001 + CF_006 + CF_015', () => {
  const r = analyze(profiles['零现金流'])
  const ids = r.fatalRules.map(f => f.id)
  console.log('  ids:', ids)
  return ids.includes('R_CF_001') && ids.includes('R_CF_006') && ids.includes('R_CF_015')
})

test('冲动裸辞 → DEC_001 triggered', () => {
  const r = analyze(profiles['冲动裸辞'])
  console.log('  fatal:', r.fatalRules.map(f => f.id))
  return r.fatalRules.some(f => f.id === 'R_DEC_001')
})

test('过度保守+有成交 → DEC_008 triggered', () => {
  const r = analyze(profiles['过度保守'])
  console.log('  fatal:', r.fatalRules.map(f => f.id))
  return r.fatalRules.some(f => f.id === 'R_DEC_008')
})

test('三分钟热度 → EXEC_001 + EXEC_006 triggered', () => {
  const r = analyze(profiles['三分钟热度'])
  const ids = r.fatalRules.map(f => f.id)
  console.log('  ids:', ids)
  return ids.includes('R_EXEC_001') && ids.includes('R_EXEC_006')
})

test('完全无方向 → SKL_012 triggered', () => {
  const r = analyze(profiles['完全无方向'])
  console.log('  fatal:', r.fatalRules.map(f => f.id))
  return r.fatalRules.some(f => f.id === 'R_SKL_012')
})

test('稳定副业 → advantage rules for stable_side', () => {
  const r = analyze(profiles['稳定副业收入'])
  const ids = r.advantageRules.map(f => f.id)
  console.log('  advantage:', ids)
  return ids.includes('R_EXEC_009')
})

test('风险偏好+赔不起 → RISK_010 triggered', () => {
  const r = analyze(profiles['风险偏好型'])
  console.log('  fatal:', r.fatalRules.map(f => f.id))
  return r.fatalRules.some(f => f.id === 'R_RISK_010')
})

test('创业型厨师 → CF_007 + SKL_001 triggered', () => {
  const r = analyze(profiles['创业型厨师'])
  console.log('  fatal:', r.fatalRules.map(f => f.id))
  return r.fatalRules.some(f => f.id === 'R_CF_007') && r.fatalRules.some(f => f.id === 'R_SKL_001')
})

test('normalizedProfile has all 15 V4 keys + raw objects', () => {
  const r = analyze(profiles['打工型程序员'])
  const np = r.normalizedProfile
  const v4Keys = ['lifeStage','incomeStructure','occupationDetail','monthlySurplus','safetyMonths',
    'debtPressure','skillValidation','monetizableSkill','weeklyTime','executionStability',
    'pastAttemptStage','decisionStyle','primaryGoal','maxTrialCost','failureResponse']
  const missing = v4Keys.filter(k => !np[k])
  console.log('  missing:', missing)
  const rawKeys = v4Keys.filter(k => !np[k + 'Raw'])
  console.log('  missing rawKeys:', rawKeys)
  return missing.length === 0 && rawKeys.length === 0
})

test('wealthProbability in [0,100] for all profiles', () => {
  let err = 0
  for (const [name, ans] of Object.entries(profiles)) {
    const r = analyze(ans)
    const wp = r.wealthProbability
    if (typeof wp !== 'number' || wp < 0 || wp > 100) {
      console.log('  bad wp:', name, wp)
      err++
    }
  }
  console.log('  errors:', err)
  return err === 0
})

test('output structure is complete', () => {
  const r = analyze(profiles['打工型程序员'])
  const required = ['normalizedProfile','matchedRules','fatalRules','advantageRules','scores','labels','riskLevel','opportunityLevel','wealthProbability','meta']
  const missing = required.filter(k => !(k in r))
  console.log('  missing top-level:', missing)
  const scoreKeys = ['cashflow','skill','execution','time','risk','overall']
  const missingScores = scoreKeys.filter(k => !(k in r.scores))
  console.log('  missing scores:', missingScores)
  return missing.length === 0 && missingScores.length === 0
})

// ── 结果汇总 ──
console.log('\n' + '='.repeat(60))
console.log('RESULTS: ' + passCount + ' pass, ' + failCount + ' fail  (total rules: ' + ALL_RULES.length + ')')
console.log('='.repeat(60))

process.exit(failCount > 0 ? 1 : 0)
