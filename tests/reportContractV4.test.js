/**
 * tests/reportContractV4.test.js
 *
 * V4 Report Contract 测试 — 25+ 用例
 * 运行: node tests/reportContractV4.test.js
 */

const { analyze } = require('../cloudfunctions/generateAiReport/lib/engine/turnaroundEngineV4')
const { createReportContract } = require('../cloudfunctions/generateAiReport/lib/report/reportContractV4')
const { mapEngineToReport, computeHeadline, computeFatalDiagnosis, extractTop3Rules,
  computeOpportunities, projectWealthProbability, computeWealthPath, computeActionPlan,
  computeStopDoing, computeIdentityUpgrade, computeFinalStrike, deriveWealthStage } = require('../cloudfunctions/generateAiReport/lib/report/reportMapperV4')
const { validate, assertValid } = require('../cloudfunctions/generateAiReport/lib/report/reportValidatorV4')
const { REPORT_SECTIONS, WEALTH_STAGES, HEADLINE_EMOTIONS } = require('../cloudfunctions/generateAiReport/lib/report/reportTypes')

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

function makeContract(answers, overrides) {
  const engineResult = analyze(answers)
  const skeleton = mapEngineToReport(engineResult)
  return createReportContract(engineResult, skeleton)
}

let pass = 0, fail = 0
function test(name, fn) {
  console.log('\n📋 ' + name)
  try {
    const ok = fn()
    if (ok) { pass++; console.log('  ✅ pass') }
    else { fail++; console.log('  ❌ fail') }
    return ok
  } catch (e) {
    fail++
    console.log('  💥 CRASH:', e.message)
    return false
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST 1-5: Contract 结构
// ═══════════════════════════════════════════════════════════════

test('Contract top-level fields', () => {
  const c = makeContract(makeAnswers())
  return (
    c.version === 'v4' &&
    typeof c.reportId === 'string' && c.reportId.startsWith('rpt_v4_') &&
    typeof c.generatedAt === 'string' &&
    c.engineVersion === 'v4' &&
    c.diagnosticVersion === 'v4'
  )
})

test('Report has exactly 13 sections', () => {
  const c = makeContract(makeAnswers())
  const keys = Object.keys(c.report)
  const expected = REPORT_SECTIONS
  const missing = expected.filter(k => !keys.includes(k))
  const extra = keys.filter(k => !expected.includes(k))
  if (missing.length) console.log('  MISSING:', missing)
  if (extra.length) console.log('  EXTRA:', extra)
  return missing.length === 0 && extra.length === 0
})

test('Validator — valid contract passes', () => {
  const c = makeContract(makeAnswers())
  const result = validate(c)
  if (!result.valid) console.log('  errors:', result.errors)
  return result.valid
})

test('Validator assertValid throws on invalid', () => {
  try {
    assertValid({ report: {} })
    return false
  } catch (e) {
    return e.message.includes('V4 Report Contract validation failed')
  }
})

test('Report ID is unique', () => {
  const ids = new Set()
  for (let i = 0; i < 100; i++) ids.add(makeContract(makeAnswers()).reportId)
  return ids.size === 100
})

// ═══════════════════════════════════════════════════════════════
// TEST 6-10: Headline
// ═══════════════════════════════════════════════════════════════

test('Headline — has all 4 fields', () => {
  const c = makeContract(makeAnswers())
  const h = c.report.headline
  return h && h.title && h.subtitle && h.emotion && typeof h.severity === 'number'
})

test('Headline emotion is valid', () => {
  const c = makeContract(makeAnswers())
  return HEADLINE_EMOTIONS.includes(c.report.headline.emotion)
})

test('Headline severity in [0,100]', () => {
  const c = makeContract(makeAnswers())
  const s = c.report.headline.severity
  return s >= 0 && s <= 100
})

test('Headline — high fatal → warning emotion', () => {
  const ans = makeAnswers({
    monthlySurplus: '负数（入不敷出）',
    safetyMonths: '不到1个月',
    debtPressure: '债务压力高/以贷养贷',
    skillValidation: '从未变现过',
    executionStability: '很容易三分钟热度，计划经常中断',
  })
  const c = makeContract(ans)
  return c.report.headline.emotion === 'warning' && c.report.headline.severity >= 60
})

test('Headline — many advantages → confident', () => {
  const ans = makeAnswers({
    incomeStructure: '技能服务（按次/项目收费）',
    monthlySurplus: '10000元以上',
    safetyMonths: '24个月以上',
    executionStability: '非常稳定，不需要外部督促',
    skillValidation: '有稳定客户/收入',
    monetizableSkill: '销售/商务谈单',
    weeklyTime: '20小时以上',
    pastAttemptStage: '已有稳定的副业/兼职收入',
    failureResponse: '复盘优化后继续',
    debtPressure: '无负债',
    primaryGoal: '从副业变主业/独立',
    maxTrialCost: '5000-20000元',
  })
  const c = makeContract(ans)
  console.log('  emotion:', c.report.headline.emotion, 'severity:', c.report.headline.severity)
  return c.report.headline.emotion === 'confident'
})

// ═══════════════════════════════════════════════════════════════
// TEST 11-13: Wealth Stage
// ═══════════════════════════════════════════════════════════════

test('WealthStage is valid enum', () => {
  const c = makeContract(makeAnswers())
  return WEALTH_STAGES.includes(c.report.wealthStage)
})

test('WealthStage — score 0-20 → SURVIVAL', () => {
  return deriveWealthStage(10) === 'SURVIVAL'
})

test('WealthStage — score 85-90 → SYSTEM', () => {
  return deriveWealthStage(88) === 'SYSTEM'
})

// ═══════════════════════════════════════════════════════════════
// TEST 14-17: Fatal Diagnosis / Rules
// ═══════════════════════════════════════════════════════════════

test('FatalDiagnosis has all fields (with fatal rules)', () => {
  const ans = makeAnswers({
    monthlySurplus: '负数（入不敷出）',
    safetyMonths: '不到1个月',
    debtPressure: '债务压力高/以贷养贷',
  })
  const c = makeContract(ans)
  const fd = c.report.fatalDiagnosis
  console.log('  fd:', JSON.stringify(fd).slice(0, 120))
  return fd && fd.mainProblem && fd.reason && Array.isArray(fd.matchedRuleIds) && fd.matchedRuleIds.length > 0
})

test('FatalDiagnosis is null when no fatal rules', () => {
  const ans = makeAnswers({
    incomeStructure: '技能服务（按次/项目收费）',
    safetyMonths: '24个月以上',
    executionStability: '非常稳定，不需要外部督促',
    skillValidation: '有稳定客户/收入',
    monetizableSkill: '销售/商务谈单',
    pastAttemptStage: '已有稳定的副业/兼职收入',
    weeklyTime: '20小时以上',
    debtPressure: '无负债',
    monthlySurplus: '10000元以上',
    failureResponse: '复盘优化后继续',
    decisionStyle: '边上班边小规模测试',
    primaryGoal: '从副业变主业/独立',
    maxTrialCost: '5000-20000元',
  })
  const engineResult = analyze(ans)
  console.log('  fatal count:', engineResult.fatalRules.length)
  const skeleton = mapEngineToReport(engineResult)
  return skeleton.fatalDiagnosis === null
})

test('fatalRules — max 3 items', () => {
  const ans = makeAnswers({
    monthlySurplus: '负数（入不敷出）',
    safetyMonths: '不到1个月',
    debtPressure: '债务压力高/以贷养贷',
    executionStability: '很容易三分钟热度，计划经常中断',
    decisionStyle: '能不动就不动',
    skillValidation: '从未变现过',
  })
  const c = makeContract(ans)
  return c.report.fatalRules.length <= 3
})

// ═══════════════════════════════════════════════════════════════
// TEST 18-20: Score Card & Probability
// ═══════════════════════════════════════════════════════════════

test('ScoreCard has all 6 fields in [0,100]', () => {
  const c = makeContract(makeAnswers())
  const sc = c.report.scoreCard
  const keys = ['cashflow', 'skill', 'execution', 'time', 'risk', 'overall']
  for (const k of keys) {
    if (typeof sc[k] !== 'number' || sc[k] < 0 || sc[k] > 100) {
      console.log('  FAIL:', k, sc[k])
      return false
    }
  }
  return true
})

test('WealthProbability has 4 fields in [0,100]', () => {
  const c = makeContract(makeAnswers())
  const wp = c.report.wealthProbability
  return (
    typeof wp.today === 'number' && wp.today >= 0 && wp.today <= 100 &&
    typeof wp.after30 === 'number' && wp.after30 >= 0 && wp.after30 <= 100 &&
    typeof wp.after90 === 'number' && wp.after90 >= 0 && wp.after90 <= 100 &&
    typeof wp.after365 === 'number' && wp.after365 >= 0 && wp.after365 <= 100
  )
})

test('WealthProbability — monotonic: today ≤ after30 ≤ after90 ≤ after365', () => {
  const c = makeContract(makeAnswers())
  const wp = c.report.wealthProbability
  console.log('  series:', wp.today, '→', wp.after30, '→', wp.after90, '→', wp.after365)
  return wp.today <= wp.after30 && wp.after30 <= wp.after90 && wp.after90 <= wp.after365
})

// ═══════════════════════════════════════════════════════════════
// TEST 21-23: Wealth Path
// ═══════════════════════════════════════════════════════════════

test('WealthPath has all 7 paths', () => {
  const c = makeContract(makeAnswers())
  const names = c.report.wealthPath.map(p => p.name)
  const expected = ['working', 'sideBusiness', 'freelance', 'investment', 'content', 'ai', 'entrepreneur']
  for (const e of expected) {
    if (!names.includes(e)) {
      console.log('  MISSING:', e)
      return false
    }
  }
  return true
})

test('WealthPath — each has score in [0,100] + valid recommend', () => {
  const c = makeContract(makeAnswers())
  const recs = ['highly_recommended', 'recommended', 'neutral', 'not_recommended']
  for (const p of c.report.wealthPath) {
    if (p.score < 0 || p.score > 100 || !recs.includes(p.recommend)) {
      console.log('  FAIL:', p.name, p.score, p.recommend)
      return false
    }
  }
  return true
})

test('WealthPath — high debt → investment not_recommended', () => {
  const ans = makeAnswers({ debtPressure: '债务压力高/以贷养贷', safetyMonths: '1-3个月' })
  const c = makeContract(ans)
  const inv = c.report.wealthPath.find(p => p.name === 'investment')
  console.log('  investment:', inv.score, inv.recommend)
  return inv.recommend === 'not_recommended' && inv.score < 40
})

// ═══════════════════════════════════════════════════════════════
// TEST 24-26: Action Plan
// ═══════════════════════════════════════════════════════════════

test('ActionPlan has all 5 days', () => {
  const c = makeContract(makeAnswers())
  const days = ['day1', 'day3', 'day7', 'day15', 'day30']
  for (const d of days) {
    const plan = c.report.actionPlan[d]
    if (!plan || !plan.goal || !Array.isArray(plan.tasks) || !plan.checkpoint) {
      console.log('  FAIL:', d, JSON.stringify(plan))
      return false
    }
  }
  return true
})

test('ActionPlan — all tasks are non-empty arrays', () => {
  const c = makeContract(makeAnswers())
  const days = ['day1', 'day3', 'day7', 'day15', 'day30']
  for (const d of days) {
    if (c.report.actionPlan[d].tasks.length === 0) {
      console.log('  EMPTY tasks:', d)
      return false
    }
  }
  return true
})

test('ActionPlan — high fatal → different plan than low fatal', () => {
  const c1 = makeContract(makeAnswers({ monthlySurplus: '负数（入不敷出）', safetyMonths: '不到1个月', debtPressure: '债务压力高/以贷养贷' }))
  const c2 = makeContract(makeAnswers({
    incomeStructure: '技能服务（按次/项目收费）',
    safetyMonths: '24个月以上',
    skillValidation: '有稳定客户/收入',
    monetizableSkill: '销售/商务谈单',
    pastAttemptStage: '已有稳定的副业/兼职收入',
    primaryGoal: '从副业变主业/独立',
    maxTrialCost: '5000-20000元',
  }))
  console.log('  c1 goal:', c1.report.actionPlan.day1.goal)
  console.log('  c2 goal:', c2.report.actionPlan.day1.goal)
  return c1.report.actionPlan.day1.goal !== c2.report.actionPlan.day1.goal
})

// ═══════════════════════════════════════════════════════════════
// TEST 27-29: StopDoing / Identity / FinalStrike
// ═══════════════════════════════════════════════════════════════

test('StopDoing has priority + non-empty items', () => {
  const c = makeContract(makeAnswers())
  const sd = c.report.stopDoing
  return sd.priority === 1 && Array.isArray(sd.items) && sd.items.length > 0
})

test('IdentityUpgrade has all 4 fields', () => {
  const c = makeContract(makeAnswers())
  const iu = c.report.identityUpgrade
  return iu.currentIdentity && iu.targetIdentity && iu.gap && iu.upgradePath
})

test('FinalStrike has sentence + emotion + shareTitle', () => {
  const c = makeContract(makeAnswers())
  const fs = c.report.finalStrike
  return fs.sentence && fs.emotion && fs.shareTitle
})

// ═══════════════════════════════════════════════════════════════
// TEST 30-33: 边界情况
// ═══════════════════════════════════════════════════════════════

test('Engine empty rules → contract still valid', () => {
  // 使用一个不会有任何规则匹配的极端 profile（理论上所有规则都有覆盖，这里测 score）
  const ans = makeAnswers({
    safetyMonths: '24个月以上',
    executionStability: '非常稳定，不需要外部督促',
    skillValidation: '有稳定客户/收入',
    monetizableSkill: '技术类（编程/设计/工程）',
    pastAttemptStage: '已有稳定的副业/兼职收入',
    weeklyTime: '20小时以上',
    debtPressure: '无负债',
    monthlySurplus: '10000元以上',
    failureResponse: '复盘优化后继续',
    decisionStyle: '边上班边小规模测试',
    primaryGoal: '从副业变主业/独立',
    incomeStructure: '技能服务（按次/项目收费）',
  })
  const c = makeContract(ans)
  const result = validate(c)
  console.log('  fatal:', c.report.fatalRules.length, 'advantage:', c.report.advantageRules.length)
  if (!result.valid) console.log('  errors:', result.errors)
  return result.valid
})

test('Score=0 → contract still valid', () => {
  const ans = makeAnswers({
    monthlySurplus: '负数（入不敷出）',
    safetyMonths: '不到1个月',
    debtPressure: '债务压力高/以贷养贷',
    skillValidation: '从未变现过',
    monetizableSkill: '暂时不清楚',
    executionStability: '很容易三分钟热度，计划经常中断',
    weeklyTime: '不到2小时',
    maxTrialCost: '几乎为零（赔不起）',
    failureResponse: '追加投入再试一次',
    decisionStyle: '能不动就不动',
  })
  const engineResult = analyze(ans)
  console.log('  overall score:', engineResult.scores.overall)
  const skeleton = mapEngineToReport(engineResult)
  const c = createReportContract(engineResult, skeleton)
  const result = validate(c)
  if (!result.valid) console.log('  errors:', result.errors)
  return result.valid && engineResult.scores.overall < 30
})

test('Score=100 → contract still valid', () => {
  // 用全优势配置 + 高分数
  const ans = makeAnswers({
    safetyMonths: '24个月以上',
    executionStability: '非常稳定，不需要外部督促',
    skillValidation: '有稳定客户/收入',
    monetizableSkill: '销售/商务谈单',
    pastAttemptStage: '已有稳定的副业/兼职收入',
    weeklyTime: '20小时以上',
    debtPressure: '无负债',
    monthlySurplus: '10000元以上',
    failureResponse: '复盘优化后继续',
    decisionStyle: '边上班边小规模测试',
  })
  const engineResult = analyze(ans)
  console.log('  overall score:', engineResult.scores.overall)
  const skeleton = mapEngineToReport(engineResult)
  const c = createReportContract(engineResult, skeleton)
  const result = validate(c)
  if (!result.valid) console.log('  errors:', result.errors)
  return result.valid && engineResult.scores.overall >= 70
})

test('Probability boundary — today=0', () => {
  const wp = projectWealthProbability(0, { execution: 0, cashflow: 0, skill: 0, time: 0, risk: 0 })
  console.log('  wp:', JSON.stringify(wp))
  return wp.today === 0 && wp.after30 >= wp.today
})

// ═══════════════════════════════════════════════════════════════
// TEST 34-36: Validator 异常检测
// ═══════════════════════════════════════════════════════════════

test('Validator — missing headline', () => {
  const c = makeContract(makeAnswers())
  c.report.headline = null
  const r = validate(c)
  console.log('  errors:', r.errors)
  return !r.valid && r.errors.some(e => e.includes('headline'))
})

test('Validator — missing scoreCard', () => {
  const c = makeContract(makeAnswers())
  c.report.scoreCard = null
  const r = validate(c)
  return !r.valid && r.errors.some(e => e.includes('scoreCard'))
})

test('Validator — missing finalStrike', () => {
  const c = makeContract(makeAnswers())
  c.report.finalStrike = null
  const r = validate(c)
  return !r.valid && r.errors.some(e => e.includes('finalStrike'))
})

test('Validator — extra field in report', () => {
  const c = makeContract(makeAnswers())
  c.report.extraField = 'should not exist'
  const r = validate(c)
  console.log('  errors:', r.errors)
  return !r.valid && r.errors.some(e => e.includes('extra'))
})

test('Validator — fatalRules > 3', () => {
  const c = makeContract(makeAnswers())
  c.report.fatalRules = [
    { ruleId: 'A', title:'a', description:'a', weight: 1, why: 'a' },
    { ruleId: 'B', title:'b', description:'b', weight: 2, why: 'b' },
    { ruleId: 'C', title:'c', description:'c', weight: 3, why: 'c' },
    { ruleId: 'D', title:'d', description:'d', weight: 4, why: 'd' },
  ]
  const r = validate(c)
  console.log('  errors:', r.errors)
  return !r.valid && r.errors.some(e => e.includes('max 3'))
})

test('Validator — wealthProbability non-monotonic', () => {
  const c = makeContract(makeAnswers())
  c.report.wealthProbability.after90 = 10
  c.report.wealthProbability.after365 = 20
  const r = validate(c)
  console.log('  errors:', r.errors)
  return !r.valid && r.errors.some(e => e.includes('after90'))
})

// ═══════════════════════════════════════════════════════════════
// TEST: 全 fatal 规则匹配
// ═══════════════════════════════════════════════════════════════

test('All-fatal profile → contract valid & fatal > 5', () => {
  const ans = makeAnswers({
    monthlySurplus: '负数（入不敷出）',
    safetyMonths: '不到1个月',
    debtPressure: '债务压力高/以贷养贷',
    skillValidation: '从未变现过',
    monetizableSkill: '暂时不清楚',
    executionStability: '很容易三分钟热度，计划经常中断',
    pastAttemptStage: '还没开始过任何尝试',
    weeklyTime: '不到2小时',
    maxTrialCost: '几乎为零（赔不起）',
    failureResponse: '追加投入再试一次',
    decisionStyle: '能不动就不动',
    primaryGoal: '从副业变主业/独立',
  })
  const engineResult = analyze(ans)
  console.log('  fatal count:', engineResult.fatalRules.length, 'overall:', engineResult.scores.overall)
  const skeleton = mapEngineToReport(engineResult)
  const c = createReportContract(engineResult, skeleton)
  const result = validate(c)
  if (!result.valid) console.log('  errors:', result.errors)
  return result.valid && engineResult.fatalRules.length >= 5
})

// ═══════════════════════════════════════════════════════════════
// TEST: 10 个多样化 profile 全部通过 validator
// ═══════════════════════════════════════════════════════════════

const diverseProfiles = [
  ['zero_flow', makeAnswers({ monthlySurplus:'负数（入不敷出）', safetyMonths:'不到1个月', debtPressure:'债务压力高/以贷养贷', skillValidation:'从未变现过' })],
  ['worker', makeAnswers({ incomeStructure:'工资/固定薪资', monetizableSkill:'技术类（编程/设计/工程）', executionStability:'有固定计划，基本能执行' })],
  ['sales_star', makeAnswers({ monetizableSkill:'销售/商务谈单', safetyMonths:'12-24个月', pastAttemptStage:'卖出过几个，有少量收入', skillValidation:'偶尔有付费需求' })],
  ['content_novice', makeAnswers({ monetizableSkill:'内容创作（写/拍/剪/直播）', safetyMonths:'3-6个月', primaryGoal:'建立个人IP/品牌', skillValidation:'从未变现过' })],
  ['old_school', makeAnswers({ lifeStage:'50岁以上', incomeStructure:'工资/固定薪资', primaryGoal:'把技能变现/做咨询', monetizableSkill:'运营/管理/统筹' })],
  ['stay_home', makeAnswers({ incomeStructure:'收入不稳定', weeklyTime:'2-5小时', monetizableSkill:'暂时不清楚', safetyMonths:'1-3个月' })],
  ['stable_biz', makeAnswers({ pastAttemptStage:'已有稳定的副业/兼职收入', skillValidation:'有稳定客户/收入', executionStability:'非常稳定，不需要外部督促', safetyMonths:'24个月以上' })],
  ['debt_fighter', makeAnswers({ monthlySurplus:'1000元以下', debtPressure:'消费贷/信用卡压力较大', safetyMonths:'3-6个月', primaryGoal:'还清债务/修复现金流' })],
  ['risk_lover', makeAnswers({ decisionStyle:'直接辞职/全职All-in', safetyMonths:'1-3个月', failureResponse:'追加投入再试一次', maxTrialCost:'几乎为零（赔不起）' })],
  ['craftsman', makeAnswers({ incomeStructure:'技能服务（按次/项目收费）', monetizableSkill:'手艺人（厨师/维修/美业）', skillValidation:'偶尔有付费需求' })],
]

test(`10 diverse profiles — all pass validator`, () => {
  let errCount = 0
  for (const [name, ans] of diverseProfiles) {
    const engineResult = analyze(ans)
    const skeleton = mapEngineToReport(engineResult)
    const c = createReportContract(engineResult, skeleton)
    const result = validate(c)
    if (!result.valid) {
      console.log(`  ❌ ${name}:`, result.errors.join('; '))
      errCount++
    }
  }
  console.log(`  pass: ${diverseProfiles.length - errCount}/${diverseProfiles.length}`)
  return errCount === 0
})

// ═══════════════════════════════════════════════════════════════
// 汇总
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(60))
console.log('RESULTS: ' + pass + ' pass, ' + fail + ' fail')
console.log('='.repeat(60))

process.exit(fail > 0 ? 1 : 0)
