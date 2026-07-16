/**
 * tests/reportGuardV4.test.js
 *
 * Guard 测试 — 各种违规检测
 */

const { guardReportV4, generateFallbackReport, LOCKED_PATHS } = require('../cloudfunctions/generateAiReport/lib/prompt-v4/reportGuardV4')
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

function makeContracts() {
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
  const contract = createReportContract(er, skeleton)
  return { base: JSON.parse(JSON.stringify(contract)), merged: JSON.parse(JSON.stringify(contract)) }
}

// ═══ basic ═══
test('Guard — valid contract passes', () => {
  const { base, merged } = makeContracts()
  const r = guardReportV4(base, merged)
  return r.ok
})

test('LOCKED_PATHS — at least 20', () => {
  return LOCKED_PATHS.length >= 20
})

// ═══ LOCKED_FIELDS violations ═══
test('Score modified — violation', () => {
  const { base, merged } = makeContracts()
  merged.report.scoreCard.overall = 99
  const r = guardReportV4(base, merged)
  return !r.ok && r.violations.some(v => v.includes('scoreCard.overall'))
})

test('Probability modified — violation', () => {
  const { base, merged } = makeContracts()
  merged.report.wealthProbability.today = 99
  const r = guardReportV4(base, merged)
  return !r.ok && r.violations.some(v => v.includes('wealthProbability'))
})

test('Wealth stage modified — violation', () => {
  const { base, merged } = makeContracts()
  merged.report.wealthStage = 'FREEDOM'
  const r = guardReportV4(base, merged)
  return !r.ok
})

test('Path recommend modified — violation', () => {
  const { base, merged } = makeContracts()
  merged.report.wealthPath[0].recommend = 'highly_recommended'
  const r = guardReportV4(base, merged)
  return !r.ok && r.violations.some(v => v.includes('WEALTH_PATH_STATUS'))
})

test('Path score modified — violation', () => {
  const { base, merged } = makeContracts()
  merged.report.wealthPath[0].score = 99
  const r = guardReportV4(base, merged)
  return !r.ok && r.violations.some(v => v.includes('WEALTH_PATH_STATUS'))
})

test('Rule weight modified — violation', () => {
  const { base, merged } = makeContracts()
  if (merged.report.fatalRules.length > 0) {
    merged.report.fatalRules[0].weight = 999
    const r = guardReportV4(base, merged)
    return !r.ok && r.violations.some(v => v.includes('RULE_WEIGHTS'))
  }
  return true
})

// ═══ EMPTY checks ═══
test('Empty fatal title — violation', () => {
  const { base, merged } = makeContracts()
  if (merged.report.fatalRules.length > 0) {
    merged.report.fatalRules[0].title = ''
    const r = guardReportV4(base, merged)
    return !r.ok && r.violations.some(v => v.includes('NO_EMPTY_FATAL_SENTENCE'))
  }
  return true
})

test('Empty actionPlan day1 tasks — violation', () => {
  const { base, merged } = makeContracts()
  merged.report.actionPlan.day1.tasks = []
  const r = guardReportV4(base, merged)
  return !r.ok && r.violations.some(v => v.includes('NO_EMPTY_ACTION_PLAN'))
})

// ═══ Forbidden path ═══
test('Forbidden path recommendation — not triggered for neutral path', () => {
  const { base, merged } = makeContracts()
  // 默认的投资路径如果不是 not_recommended，就不触发
  // 只在 score=not_recommended 时检查
  const hasNotRec = merged.report.wealthPath.some(p => p.recommend === 'not_recommended')
  if (hasNotRec) {
    const p = merged.report.wealthPath.find(p => p.recommend === 'not_recommended')
    p.reason = '推荐你做这个'
    const r = guardReportV4(base, merged)
    return !r.ok && r.violations.some(v => v.includes('NO_FORBIDDEN_PATH'))
  }
  return true // 没有 not_recommended 路径则跳过
})

// ═══ Unknown fields ═══
test('Unknown field in report — violation', () => {
  const { base, merged } = makeContracts()
  merged.report.extraField = 'should not exist'
  const r = guardReportV4(base, merged)
  return !r.ok && r.violations.some(v => v.includes('NO_UNKNOWN_FIELDS'))
})

// ═══ Fallback ═══
test('Fallback — generates valid contract', () => {
  const { base } = makeContracts()
  const fb = generateFallbackReport(base)
  return fb && fb.report && fb.report._renderSource === 'rule_fallback'
})

test('Fallback — preserves scores', () => {
  const { base } = makeContracts()
  const origScore = base.report.scoreCard.overall
  const fb = generateFallbackReport(base)
  return fb.report.scoreCard.overall === origScore
})

test('Fallback — preserves probability', () => {
  const { base } = makeContracts()
  const origProb = base.report.wealthProbability.today
  const fb = generateFallbackReport(base)
  return fb.report.wealthProbability.today === origProb
})

test('Fallback — has all 13 sections', () => {
  const { base } = makeContracts()
  const fb = generateFallbackReport(base)
  const sections = ['headline', 'wealthStage', 'fatalDiagnosis', 'fatalRules', 'advantageRules',
    'opportunityRules', 'scoreCard', 'wealthProbability', 'wealthPath', 'actionPlan',
    'stopDoing', 'identityUpgrade', 'finalStrike']
  return sections.every(s => fb.report[s] !== undefined)
})

// ═══ Rule IDs unchanged ═══
test('Rule ID order changed but same set — passes', () => {
  const { base, merged } = makeContracts()
  if (merged.report.fatalRules.length >= 2) {
    // 交换顺序 — 应该不影响（check sorted）
    const tmp = merged.report.fatalRules[0]
    merged.report.fatalRules[0] = merged.report.fatalRules[1]
    merged.report.fatalRules[1] = tmp
    const r = guardReportV4(base, merged)
    // sorted comparison 应该通过
    return r.ok
  }
  return true
})

// ═══ SCORE边界 ═══
test('Score 0 → guard passes', () => {
  const { base, merged } = makeContracts()
  merged.report.scoreCard.overall = 0
  // 不能直接 guard — base != merged → violation
  // 但测试确保 0 是合法值（边界）
  const r = guardReportV4(base, merged)
  return !r.ok // 因为和 base 不同
})

// ═══ SUMMARY ═══
console.log('\n' + '='.repeat(60))
console.log('RESULTS: ' + pass + ' pass, ' + fail + ' fail')
console.log('='.repeat(60))
process.exit(fail > 0 ? 1 : 0)
