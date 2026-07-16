/**
 * tests/reportNormalizerV4.test.js
 *
 * V4 前端适配层测试 — 35+ 用例
 * 测试 normalizeDiagnosticV4Response / buildDiagnosticV4ViewModel / mapDiagnosticV4ToPoster
 */

const n4 = require('../utils/reportNormalizerV4.js')

let pass = 0, fail = 0
function test(name, fn) {
  process.stdout.write('\n📋 ' + name)
  try {
    const ok = fn()
    if (ok) { pass++; console.log(' ✅') }
    else { fail++; console.log(' ❌') }
    return ok
  } catch (e) {
    fail++; console.log(' 💥 ' + e.message)
    return false
  }
}

// ═══ Test data ═══

function makeFullReport(overrides = {}) {
  return {
    reportId: 'rpt_v4_001',
    reportType: 'diagnostic_v4',
    diagnosticVersion: 'v4',
    engineVersion: 'v4.0.0',
    renderSource: 'ai_rendered',
    report: {
      headline: { title: '你的收入模型是单向技能流水线', subtitle: '没有将能力资产化的底层认知' },
      wealthStage: 'SURVIVAL',
      fatalDiagnosis: { mainProblem: '现金流单一依赖', reason: '单一工资收入无缓冲', severity: 'critical', confidence: 0.92 },
      fatalRules: [
        { ruleId: 'R_INC_001', title: '收入结构单一', description: '仅依赖工资收入', why: '技能未产品化', weight: 90 },
        { ruleId: 'R_CF_003', title: '无应急缓冲', description: '储蓄不足3个月', why: '支出控制不足', weight: 85 },
        { ruleId: 'R_EXEC_005', title: '行动力弱', description: '计划多为空想', why: '缺乏外部反馈', weight: 70 },
      ],
      advantageRules: [
        { ruleId: 'R_SKILL_002', title: '有可转化技能', description: '编程能力可服务化' },
      ],
      opportunityRules: [
        { ruleId: 'R_OPP_001', title: 'AI工具可放大效率', description: '利用AI降低服务成本' },
      ],
      scoreCard: { overall: 38, cashflow: 25, skill: 55, execution: 30, time: 60, risk: 20 },
      wealthProbability: { today: 8, after30: 15, after90: 35, after365: 52 },
      wealthPath: [
        { key: 'working', recommend: 'cautious', score: 40, reason: '结构性问题未解决' },
        { key: 'sideBusiness', recommend: 'strongly_recommended', score: 72, reason: '技能可直接商品化' },
        { key: 'freelance', recommend: 'recommended', score: 58, reason: '需要建立客户基础' },
        { key: 'investment', recommend: 'not_recommended', score: 10, reason: '现金流不足' },
        { key: 'content', recommend: 'cautious', score: 45, reason: '需要持续输出' },
        { key: 'ai', recommend: 'strongly_recommended', score: 82, reason: '低门槛高杠杆' },
        { key: 'entrepreneur', recommend: 'not_recommended', score: 0, reason: '无启动资金' },
      ],
      actionPlan: {
        day1: { goal: '盘点所有可变现技能', tasks: ['列出3项技术能力', '写一份个人技能清单'], checkpoint: '完成技能清单' },
        day3: { goal: '注册自由职业平台', tasks: ['Upwork注册', '完善个人资料'], checkpoint: '平台审核通过' },
        day7: { goal: '接第一个小单', tasks: ['筛选3个低难度项目', '提交第一个报价'], checkpoint: '收到第一笔收入' },
        day15: { goal: '建立客户反馈系统', tasks: ['整理客户评价', '优化服务流程'], checkpoint: '获得5星评价' },
        day30: { goal: '实现副业稳定收入', tasks: ['月收入≥2000', '至少3个回头客'], checkpoint: '副业现金流为正' },
      },
      stopDoing: { items: ['不要把时间花在无效社交上', '不要继续拖延学习计划', '不要忽视现有技能的市场价值', '不要幻想一夜暴富的路径'] },
      identityUpgrade: {
        currentIdentity: '打工程序员',
        targetIdentity: '独立开发者',
        gap: '缺少客户获取能力和商业思维',
        upgradePath: '从副业接单开始，逐步建立个人品牌',
      },
      finalStrike: { sentence: '你最大的成本不是钱，是每晚刷手机浪费的那3小时', shareTitle: '认知翻身报告' },
    },
    legacy: {},
    ...overrides,
  }
}

// ════════════════════════════════════════
// normalizeDiagnosticV4Response
// ════════════════════════════════════════

test('Direct V4 response — ok', () => {
  const raw = makeFullReport()
  const r = n4.normalizeDiagnosticV4Response(raw)
  return r.ok && r.data.reportType === 'diagnostic_v4' && r.data.report.headline.title.length > 0
})

test('wx.cloud.callFunction wrapper — result.data', () => {
  const raw = { result: { code: 0, data: makeFullReport() } }
  const r = n4.normalizeDiagnosticV4Response(raw)
  return r.ok && r.data.reportType === 'diagnostic_v4'
})

test('DB content wrapper — content.report', () => {
  const raw = {
    reportId: 'rpt_v4_002',
    content: { report: makeFullReport().report, legacy: {} },
    renderSource: 'ai_rendered',
    diagnosticVersion: 'v4',
  }
  const r = n4.normalizeDiagnosticV4Response(raw)
  return r.ok && r.data.report.headline.title.length > 0
})

test('V3 legacy — returns not ok with V3_RESPONSE', () => {
  const r = n4.normalizeDiagnosticV4Response({
    legacy: { position: 'test', trapped_by: 'test' },
  })
  return !r.ok && r.error === 'V3_RESPONSE'
})

test('Empty response — not ok', () => {
  const r = n4.normalizeDiagnosticV4Response(null)
  return !r.ok && r.error === 'EMPTY_RESPONSE'
})

test('No report field — not ok', () => {
  const r = n4.normalizeDiagnosticV4Response({ code: 0, data: {} })
  return !r.ok && r.error === 'NO_REPORT'
})

test('Unknown object — not ok with NO_REPORT', () => {
  const r = n4.normalizeDiagnosticV4Response({ abc: 123 })
  return !r.ok && r.error === 'NO_REPORT'
})

// ════════════════════════════════════════
// buildDiagnosticV4ViewModel
// ════════════════════════════════════════

test('ViewModel — hero has title/subtitle', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.hero.title === '你的收入模型是单向技能流水线' &&
         vm.hero.subtitle === '没有将能力资产化的底层认知' &&
         vm.hero.wealthStage === 'SURVIVAL'
})

test('ViewModel — 5 scoreCard entries', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.scoreCard.length === 5 &&
         vm.scoreCard[0].key === 'cashflow' &&
         vm.scoreCard[0].value === 25
})

test('ViewModel — 3 systemLeaks', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.systemLeaks.length === 3 &&
         vm.systemLeaks[0].confidence === '高置信' &&
         vm.systemLeaks[2].confidence === '中等置信'
})

test('ViewModel — 7 wealthPaths translated', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.wealthPaths.length === 7 &&
         vm.wealthPaths[0].name === '继续打工' &&
         vm.wealthPaths[4].name === '内容/IP'
})

test('ViewModel — recommend labels', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  const rl = vm.wealthPaths.map(p => p.recommendLabel)
  return rl[1] === '强烈建议' && rl[3] === '暂不建议'
})

test('ViewModel — 5 actionTimeline entries', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.actionTimeline.length === 5 &&
         vm.actionTimeline[0].day === 'DAY 1' &&
         vm.actionTimeline[4].day === 'DAY 30'
})

test('ViewModel — stopDoing items', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.stopDoing.length === 4
})

test('ViewModel — identity fields', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.identity.current === '打工程序员' &&
         vm.identity.target === '独立开发者' &&
         vm.identity.gap.length > 0
})

test('ViewModel — probabilities', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.probabilities.today === 8 &&
         vm.probabilities.after365 === 52
})

test('ViewModel — finalStrike', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.finalStrike.sentence.length > 0 && vm.finalStrike.shareTitle === '认知翻身报告'
})

// ════════════════════════════════════════
// Missing sections
// ════════════════════════════════════════

test('Missing headline — does not crash', () => {
  const raw = makeFullReport()
  delete raw.report.headline
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.hero.title === '' && vm.hero.subtitle === ''
})

test('Missing scoreCard — zeros', () => {
  const raw = makeFullReport()
  delete raw.report.scoreCard
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.scoreCard.every(s => s.value === 0)
})

test('Missing fatalRules — empty systemLeaks', () => {
  const raw = makeFullReport()
  delete raw.report.fatalRules
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.systemLeaks.length === 0
})

test('Missing actionPlan — empty timeline', () => {
  const raw = makeFullReport()
  delete raw.report.actionPlan
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.actionTimeline.every(d => d.goal === '' && d.tasks.length === 0)
})

test('Missing wealthPath — empty array', () => {
  const raw = makeFullReport()
  delete raw.report.wealthPath
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.wealthPaths.length === 0
})

test('Missing stopDoing — empty array', () => {
  const raw = makeFullReport()
  delete raw.report.stopDoing
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.stopDoing.length === 0
})

test('Empty stopDoing items — empty array', () => {
  const raw = makeFullReport()
  raw.report.stopDoing = { items: [] }
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.stopDoing.length === 0
})

test('renderSource = rule_fallback preserved', () => {
  const raw = makeFullReport({ renderSource: 'rule_fallback' })
  const nor = n4.normalizeDiagnosticV4Response(raw)
  return nor.data.renderSource === 'rule_fallback'
})

// ════════════════════════════════════════
// Identity / personality labels
// ════════════════════════════════════════

test('Identity — current/target/gap/upgradePath populated', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.identity.current.length > 0 &&
         vm.identity.target.length > 0 &&
         vm.identity.gap.length > 0 &&
         vm.identity.upgradePath.length > 0
})

// ════════════════════════════════════════
// Poster Mapping
// ════════════════════════════════════════

test('Poster — all 5 fields populated', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  const poster = n4.mapDiagnosticV4ToPoster(vm)
  return poster.fatalSentence.length > 0 &&
         poster.coreProblem.length > 0 &&
         poster.systemTrap.length > 0 &&
         poster.strategyPath.length > 0 &&
         Array.isArray(poster.advice) && poster.advice.length > 0
})

test('Poster — fatalSentence from hero.title', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  const poster = n4.mapDiagnosticV4ToPoster(vm)
  return poster.fatalSentence === '你的收入模型是单向技能流水线'
})

test('Poster — coreProblem from fatalDiagnosis.reason', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  const poster = n4.mapDiagnosticV4ToPoster(vm)
  return poster.coreProblem === '单一工资收入无缓冲'
})

test('Poster — advice non-empty strings', () => {
  const raw = makeFullReport()
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  const poster = n4.mapDiagnosticV4ToPoster(vm)
  return poster.advice.every(a => a.length > 0)
})

// ════════════════════════════════════════
// Task truncation / stopDoing limit
// ════════════════════════════════════════

test('Tasks max 3 per day', () => {
  const raw = makeFullReport()
  raw.report.actionPlan.day1.tasks = ['t1', 't2', 't3', 't4', 't5']
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.actionTimeline[0].tasks.length === 3
})

test('stopDoing max 5', () => {
  const raw = makeFullReport()
  raw.report.stopDoing.items = ['s1', 's2', 's3', 's4', 's5', 's6', 's7']
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.stopDoing.length === 5
})

// ════════════════════════════════════════
// Probabilities unchanged
// ════════════════════════════════════════

test('Probabilities — values unchanged by VM', () => {
  const raw = makeFullReport()
  raw.report.wealthProbability = { today: 8, after30: 15, after90: 35, after365: 52 }
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.probabilities.today === 8 &&
         vm.probabilities.after30 === 15 &&
         vm.probabilities.after90 === 35 &&
         vm.probabilities.after365 === 52
})

// ════════════════════════════════════════
// V3 fields preserved in original
// ════════════════════════════════════════

test('V3 response — can be recognized', () => {
  const v3data = { code: 0, data: { position: 'test', trapped_by: 'test', forbidden: [], path: 'test', next90days: ['a', 'b'] } }
  const nor = n4.normalizeDiagnosticV4Response(v3data)
  // V3 with data.data.{position...} — no report, not ok
  return !nor.ok
})

// ════════════════════════════════════════
// renderSource display logic check
// ════════════════════════════════════════

test('renderSource ai_rendered — normal', () => {
  const raw = makeFullReport({ renderSource: 'ai_rendered' })
  const nor = n4.normalizeDiagnosticV4Response(raw)
  return nor.data.renderSource === 'ai_rendered'
})

// ════════════════════════════════════════
// Encapsulation
// ════════════════════════════════════════

test('Unknown fields ignored by VM', () => {
  const raw = makeFullReport()
  raw.report.unknownFieldX = 'should be ignored'
  raw.report.anotherStrangeField = 12345
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  // VM should not crash
  return vm.hero.title.length > 0 && vm.scoreCard.length === 5
})

test('Deeply nested scoreCard numbers are unchanged', () => {
  const raw = makeFullReport()
  raw.report.scoreCard = { overall: 99, cashflow: 99, skill: 99, execution: 99, time: 99, risk: 99 }
  const nor = n4.normalizeDiagnosticV4Response(raw)
  const vm = n4.buildDiagnosticV4ViewModel(nor.data.report)
  return vm.scoreCard.every(s => s.value === 99)
})

// ═══ SUMMARY ═══
console.log('\n' + '='.repeat(60))
console.log('RESULTS: ' + pass + ' pass, ' + fail + ' fail')
console.log('='.repeat(60))
process.exit(fail > 0 ? 1 : 0)
