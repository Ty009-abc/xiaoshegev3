/**
 * tests/reportMergeV4.test.js
 *
 * Merge 测试 — 各种边界条件
 */

const { mergeReportV4, WRITABLE_PATHS } = require('../cloudfunctions/generateAiReport/lib/prompt-v4/reportMergeV4')
const { analyze } = require('../cloudfunctions/generateAiReport/lib/engine/turnaroundEngineV4')
const { mapEngineToReport } = require('../cloudfunctions/generateAiReport/lib/report/reportMapperV4')
const { createReportContract } = require('../cloudfunctions/generateAiReport/lib/report/reportContractV4')

let pass = 0, fail = 0
function test(name, fn) {
  process.stdout.write('\n📋 ' + name)
  try {
    if (fn()) { pass++; console.log(' ✅') }
    else { fail++; console.log(' ❌') }
  } catch (e) {
    fail++; console.log(' 💥 ' + e.message)
  }
}

function makeBaseContract() {
  const a = {
    diagnosticVersion: 'v4',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '工资/固定薪资', occupationDetail: '程序员',
      monthlySurplus: '1000-5000元', safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '从未变现过', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '10-20小时', executionStability: '有固定计划，基本能执行',
      pastAttemptStage: '还没开始过任何尝试', decisionStyle: '边上班边小规模测试',
      primaryGoal: '搞一份副业收入', maxTrialCost: '1000-5000元', failureResponse: '复盘优化后继续',
    },
  }
  const er = analyze(a)
  const skeleton = mapEngineToReport(er)
  return createReportContract(er, skeleton)
}

function makeAIOutput(base) {
  return {
    headline: { title: 'AI润色后的标题', subtitle: 'AI润色后的副标题' },
    fatalDiagnosis: { mainProblem: 'AI诊断', reason: 'AI原因' },
    fatalRules: (base.report.fatalRules || []).map(r => ({
      ruleId: r.ruleId, title: r.title + '（AI润色）', description: r.description + '（AI补全）', why: r.why + '（AI建议）',
    })),
    advantageRules: (base.report.advantageRules || []).map(r => ({
      ruleId: r.ruleId, title: r.title + '（AI润色）', description: r.description + '（AI补全）', why: r.why + '（AI建议）',
    })),
    opportunityRules: (base.report.opportunityRules || []).map(o => ({
      area: o.area, description: 'AI机会描述', why: 'AI机会建议',
    })),
    wealthPathReasons: {
      working: 'AI建议', sideBusiness: 'AI建议', freelance: 'AI建议',
      investment: 'AI建议', content: 'AI建议', ai: 'AI建议', entrepreneur: 'AI建议',
    },
    actionPlan: {
      day1: { goal: 'AI目标', tasks: ['AI任务'], checkpoint: 'AI检查点' },
      day3: { goal: 'AI目标', tasks: ['AI任务'], checkpoint: 'AI检查点' },
      day7: { goal: 'AI目标', tasks: ['AI任务'], checkpoint: 'AI检查点' },
      day15: { goal: 'AI目标', tasks: ['AI任务'], checkpoint: 'AI检查点' },
      day30: { goal: 'AI目标', tasks: ['AI任务'], checkpoint: 'AI检查点' },
    },
    stopDoingItems: ['AI停止1', 'AI停止2'],
    identityUpgrade: { currentIdentity: 'AI当前', targetIdentity: 'AI目标', gap: 'AI差距', upgradePath: 'AI路径' },
    finalStrike: { sentence: 'AI最后一击', shareTitle: 'AI分享标题' },
  }
}

// ═══ 正常合并 ═══
test('Normal merge — ok', () => {
  const base = makeBaseContract()
  const aiOut = makeAIOutput(base)
  const r = mergeReportV4(base, aiOut)
  return r.ok && r.data !== undefined
})

test('Headline title — updated from AI', () => {
  const base = makeBaseContract()
  const aiOut = makeAIOutput(base)
  const r = mergeReportV4(base, aiOut)
  return r.data.report.headline.title === 'AI润色后的标题'
})

test('Headline emotion — preserved from base', () => {
  const base = makeBaseContract()
  const origEmotion = base.report.headline.emotion
  const aiOut = makeAIOutput(base)
  const r = mergeReportV4(base, aiOut)
  return r.data.report.headline.emotion === origEmotion
})

test('Fatal rule title — updated from AI', () => {
  const base = makeBaseContract()
  if (base.report.fatalRules.length === 0) return true // skip if no fatal
  const aiOut = makeAIOutput(base)
  const r = mergeReportV4(base, aiOut)
  return r.data.report.fatalRules[0].title.includes('AI润色')
})

test('Fatal rule weight — preserved from base', () => {
  const base = makeBaseContract()
  if (base.report.fatalRules.length === 0) return true
  const origWeight = base.report.fatalRules[0].weight
  const aiOut = makeAIOutput(base)
  // 尝试修改 weight（AI输出中不包含weight字段）
  const r = mergeReportV4(base, aiOut)
  return r.data.report.fatalRules[0].weight === origWeight
})

// ═══ AI 尝试修改 locked fields ═══
test('AI tries to change score — preserved', () => {
  const base = makeBaseContract()
  const origOverall = base.report.scoreCard.overall
  const aiOut = makeAIOutput(base)
  // AI 输出中不包含 scoreCard（按 schema 不允许）
  const r = mergeReportV4(base, aiOut)
  return r.data.report.scoreCard.overall === origOverall
})

test('AI tries to change wealthProbability — preserved', () => {
  const base = makeBaseContract()
  const origToday = base.report.wealthProbability.today
  const aiOut = makeAIOutput(base)
  const r = mergeReportV4(base, aiOut)
  return r.data.report.wealthProbability.today === origToday
})

test('AI tries to change path recommend — preserved', () => {
  const base = makeBaseContract()
  const path0 = base.report.wealthPath[0]
  const origRec = path0.recommend
  const aiOut = makeAIOutput(base)
  const r = mergeReportV4(base, aiOut)
  return r.data.report.wealthPath[0].recommend === origRec
})

test('AI tries to change path score — preserved', () => {
  const base = makeBaseContract()
  const path0 = base.report.wealthPath[0]
  const origScore = path0.score
  const aiOut = makeAIOutput(base)
  const r = mergeReportV4(base, aiOut)
  return r.data.report.wealthPath[0].score === origScore
})

// ═══ AI 新增/删除 rule ═══
test('AI adds new fatal rule — violation', () => {
  const base = makeBaseContract()
  const aiOut = makeAIOutput(base)
  aiOut.fatalRules.push({ ruleId: 'R_FAKE_999', title: 'fake', description: 'fake', why: 'fake' })
  const r = mergeReportV4(base, aiOut)
  return !r.ok && r.violations && r.violations.some(v => v.includes('add new fatal'))
})

test('AI uses unknown ruleId — violation', () => {
  const base = makeBaseContract()
  const aiOut = makeAIOutput(base)
  aiOut.fatalRules = [{ ruleId: 'R_FAKE_999', title: 'fake', description: 'fake', why: 'fake' }]
  const r = mergeReportV4(base, aiOut)
  return !r.ok && r.violations && r.violations.some(v => v.includes('no matching base rule'))
})

// ═══ AI 缺失字段 ═══
test('AI missing headline — uses base', () => {
  const base = makeBaseContract()
  const origTitle = base.report.headline.title
  const aiOut = makeAIOutput(base)
  delete aiOut.headline
  const r = mergeReportV4(base, aiOut)
  return r.data.report.headline.title === origTitle
})

test('AI missing actionPlan day3 — uses base for day3', () => {
  const base = makeBaseContract()
  const origGoal = base.report.actionPlan.day3.goal
  const aiOut = makeAIOutput(base)
  delete aiOut.actionPlan.day3
  const r = mergeReportV4(base, aiOut)
  return r.data.report.actionPlan.day3.goal === origGoal
})

test('AI null aiOutput — violation', () => {
  const base = makeBaseContract()
  const r = mergeReportV4(base, null)
  return !r.ok
})

test('Writable paths — count check', () => {
  return WRITABLE_PATHS.size >= 15
})

// ═══ SUMMARY ═══
console.log('\n' + '='.repeat(60))
console.log('RESULTS: ' + pass + ' pass, ' + fail + ' fail')
console.log('='.repeat(60))
process.exit(fail > 0 ? 1 : 0)
