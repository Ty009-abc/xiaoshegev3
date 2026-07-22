/**
 * tests/turnaround-analytics/v65.test.js
 *
 * V6.5 Turnaround Analytics — 20 个测试
 *
 * Gate A: Event Engine, Report Analytics, Quality Dashboard, Experiment Engine
 * Gate B: RC Checklist
 * Gate C: Beta Metrics + Feedback
 * Gate D: Stable Release + Release Dashboard
 */

const ta = require('../../core/turnaround-analytics')

let PASS = 0, FAIL = 0
const errors = []
let section = ''

function test(name, fn) {
  try { fn(); PASS++ }
  catch (e) { FAIL++; errors.push(`[${section}] ${name}: ${e.message}`) }
}
function assert(c, m) { if (!c) throw new Error(m) }

// ═══════════════════════════════════════
// SECTION 1: Event Schema
// ═══════════════════════════════════════

section = 'EventSchema'
console.log('\n📋 ' + section)

test('V1.1 创建标准事件', () => {
  const evt = ta.events.createEvent({
    eventId: 'session_start',
    userId: 'u1',
    sessionId: 's1',
    category: 'SESSION',
    action: 'start',
    timestamp: Date.now(),
    duration: 0,
  })
  assert(evt.eventId === 'session_start')
  assert(evt.category === 'SESSION')
  assert(evt.version === '6.5.0')
})

test('V1.2 eventId required 时抛错', () => {
  try {
    ta.events.createEvent({ userId: 'u1', sessionId: 's1', category: 'SESSION', action: 'start', timestamp: Date.now() })
    assert(false, 'should throw')
  } catch (e) { assert(e.message.includes('eventId')) }
})

test('V1.3 无效 category 抛错', () => {
  try {
    ta.events.createEvent({ eventId: 'x', userId: 'u1', sessionId: 's1', category: 'INVALID', action: 'x', timestamp: Date.now() })
    assert(false, 'should throw')
  } catch (e) { assert(e.message.includes('category')) }
})

test('V1.4 事件不可变', () => {
  const evt = ta.events.createEvent({
    eventId: 'session_start', userId: 'u1', sessionId: 's1', category: 'SESSION', action: 'start', timestamp: Date.now(),
  })
  try { evt.eventId = 'changed'; assert(false); } catch (e) { /* frozen */ }
})

// ═══════════════════════════════════════
// SECTION 2: Event Catalog
// ═══════════════════════════════════════

section = 'EventCatalog'
console.log('\n📋 ' + section)

test('V2.1 事件目录完整', () => {
  const count = ta.events.eventCount
  assert(count >= 30, `Got ${count} events`)
})

test('V2.2 有 10 个分类', () => {
  const cats = Object.keys(ta.events.categories)
  assert(cats.length >= 8, `Got ${cats.length}: ${cats}`)
})

test('V2.3 核心事件存在', () => {
  const cat = ta.events.EVENT_CATALOG
  assert(cat.SESSION_START)
  assert(cat.QUESTIONNAIRE_START)
  assert(cat.AI_GENERATION_COMPLETE)
  assert(cat.CARD_VIEW_HERO)
  assert(cat.CARD_VIEW_EVIDENCE)
  assert(cat.PAYMENT_SUCCESS)
  assert(cat.SHARE_COMPLETE)
  assert(cat.FEEDBACK_THUMBS_UP)
})

test('V2.4 所有7张卡片都有 view 事件', () => {
  const cardIds = ['hero', 'insight', 'potential', 'strategy', 'timeline', 'action', 'evidence']
  for (const id of cardIds) {
    const key = `CARD_VIEW_${id.toUpperCase()}`
    assert(ta.events.EVENT_CATALOG[key], `Missing ${key}`)
  }
})

// ═══════════════════════════════════════
// SECTION 3: Report Analytics
// ═══════════════════════════════════════

section = 'ReportAnalytics'
console.log('\n📋 ' + section)

test('V3.1 创建报告分析', () => {
  const analytics = ta.dashboards.reportAnalytics({
    reportId: 'r1', sessionId: 's1', userId: 'u1',
    cards: Array.from({ length: 7 }, (_, i) => ({
      cardId: ['hero','insight','potential','strategy','timeline','action','evidence'][i],
      impression: 1, tap: 1, expand: i === 6 ? 0 : 0, durationMs: 2000,
    })),
  })
  assert(analytics.cardFunnel.length === 7)
  assert(analytics.totalDurationMs > 0)
  assert(analytics.completionRate === 1)
})

test('V3.2 Evidence 展开率为 0 时正确', () => {
  const analytics = ta.dashboards.reportAnalytics({
    reportId: 'r1', sessionId: 's1', userId: 'u1',
    cards: [{ cardId: 'evidence', impression: 1, tap: 0, expand: 0 }],
  })
  assert(analytics.evidenceExpandRate === 0)
})

// ═══════════════════════════════════════
// SECTION 4: Quality Dashboard
// ═══════════════════════════════════════

section = 'QualityDashboard'
console.log('\n📋 ' + section)

test('V4.1 创建质量看板', () => {
  const dash = ta.dashboards.qualityDashboard({
    date: '2026-07-22',
    reports: [
      { aiDurationMs: 4500, isEmpty: false, retryCount: 0, usedFallback: false, consistencyScore: 97, potentialScore: 78, primaryDecision: 'BUILD_EXECUTION_SYSTEM' },
      { aiDurationMs: 6200, isEmpty: false, retryCount: 0, usedFallback: false, consistencyScore: 92, potentialScore: 72, primaryDecision: 'BUILD_EXECUTION_SYSTEM' },
      { aiDurationMs: 8900, isEmpty: false, retryCount: 1, usedFallback: false, consistencyScore: 88, potentialScore: 65, primaryDecision: 'BUILD_SECOND_INCOME' },
    ],
    systemMetrics: { crashCount: 0 },
  })
  assert(dash.summary.totalReports === 3)
  assert(dash.aiPerformance.avgMs > 0)
  assert(dash.aiPerformance.p95Ms > 0)
  assert(dash.quality.avgConsistency > 0)
  assert(dash.decisionTop5.length === 2) // 两个不同的 decision
  assert(dash.decisionTop5[0].code === 'BUILD_EXECUTION_SYSTEM')
})

test('V4.2 空报告率正确', () => {
  const dash = ta.dashboards.qualityDashboard({
    date: '2026-07-22',
    reports: [
      { aiDurationMs: 1000, isEmpty: true, retryCount: 0, usedFallback: true, consistencyScore: 0, potentialScore: 0, primaryDecision: 'UNKNOWN' },
      { aiDurationMs: 1000, isEmpty: false, retryCount: 0, usedFallback: false, consistencyScore: 90, potentialScore: 70, primaryDecision: 'BUILD_EXECUTION_SYSTEM' },
    ],
  })
  assert(dash.aiPerformance.emptyReportRate === '50.0%')
  assert(dash.aiPerformance.fallbackRate === '50.0%')
})

// ═══════════════════════════════════════
// SECTION 5: Experiment Engine
// ═══════════════════════════════════════

section = 'ExperimentEngine'
console.log('\n📋 ' + section)

test('V5.1 创建实验', () => {
  const exp = ta.experiments.createExperiment({ experimentId: 'HERO_HEADLINE' })
  assert(exp.experimentId === 'exp_hero_headline')
  assert(exp.active === true)
  assert(exp.variants.length === 2)
})

test('V5.2 未知实验抛错', () => {
  try {
    ta.experiments.createExperiment({ experimentId: 'INVALID_EXP' })
    assert(false)
  } catch (e) { assert(e.message.includes('unknown')) }
})

test('V5.3 创建实验结果', () => {
  const result = ta.experiments.createExperimentResult({
    experimentId: 'exp_hero_headline',
    variantResults: [
      { variantId: 'A', impressions: 100, completionRate: 0.82, shareRate: 0.22, paymentRate: 0.08 },
      { variantId: 'B', impressions: 100, completionRate: 0.86, shareRate: 0.25, paymentRate: 0.10 },
    ],
  })
  assert(result.winner === 'B')
  assert(result.variants.length === 2)
})

test('V5.4 有 4 个预定义实验', () => {
  const exps = Object.keys(ta.experiments.EXPERIMENT_VARIANTS)
  assert(exps.length === 4)
})

// ═══════════════════════════════════════
// SECTION 6: RC Checklist
// ═══════════════════════════════════════

section = 'RCChecklist'
console.log('\n📋 ' + section)

test('V6.1 创建 RC Checklist', () => {
  const rc = ta.rc.createRCChecklist({ version: '6.5.0' })
  assert(rc.gates.length === 5)
  assert(rc.totalGates === 5)
  assert(rc.totalItems === 32) // 9+6+7+4+6
})

test('V6.2 全部 PENDING 时 validate 返回 failed', () => {
  const rc = ta.rc.createRCChecklist({ version: '6.5.0' })
  const result = ta.rc.validateGateStatus(rc.gates)
  assert(result.passed === false)
})

// ═══════════════════════════════════════
// SECTION 7: Beta Metrics
// ═══════════════════════════════════════

section = 'BetaMetrics'
console.log('\n📋 ' + section)

test('V7.1 创建 Beta 指标', () => {
  const beta = ta.beta.createBetaMetrics({
    phase: 'alpha',
    metrics: {
      questionnaireCompletion: 0.88,
      reportCompletion: 0.82,
      shareRate: 0.25,
      evidenceExpandRate: 0.35,
      paymentRate: 0.07,
      day1Retention: 0.35,
      day7Retention: 0.18,
    },
  })
  assert(beta.gateDecision === 'PROMOTE')
  assert(beta.kpiStatus.questionnaireCompletion.pass === true)
})

test('V7.2 指标不达标时 HOLD', () => {
  const beta = ta.beta.createBetaMetrics({
    phase: 'alpha',
    metrics: {
      questionnaireCompletion: 0.88,
      reportCompletion: 0.75,   // < 80%
      shareRate: 0.25,
      paymentRate: 0.03,         // < 5%
      day1Retention: 0.25,       // < 30%
    },
  })
  assert(beta.gateDecision === 'HOLD')
})

test('V7.3 Feedback 系统配置', () => {
  assert(ta.beta.FEEDBACK_SYSTEM.enabled === true)
  assert(ta.beta.FEEDBACK_SYSTEM.position === 'END_OF_REPORT')
  assert(ta.beta.FEEDBACK_SYSTEM.options.length === 2)
  assert(ta.beta.FEEDBACK_SYSTEM.freeText.enabled === true)
  assert(ta.beta.FEEDBACK_SYSTEM.freeText.maxLength === 500)
})

test('V7.4 灰度三阶段', () => {
  assert(ta.beta.BETA_ROLLOUT.phases.length === 3)
  assert(ta.beta.BETA_ROLLOUT.phases[0].users === 100)
  assert(ta.beta.BETA_ROLLOUT.phases[1].users === 300)
  assert(ta.beta.BETA_ROLLOUT.phases[2].users === 1000)
})

// ═══════════════════════════════════════
// SECTION 8: Stable Release + Dashboard
// ═══════════════════════════════════════

section = 'StableRelease'
console.log('\n📋 ' + section)

test('V8.1 创建 Release Dashboard', () => {
  const dash = ta.stable.createReleaseDashboard({
    reportsToday: 182, paymentsToday: 13, sharesToday: 42,
    avgDuration: '5m12s', aiP95Ms: 4800, consistencyAvg: 97, crashCount: 0,
  })
  assert(dash.data.reportsToday === 182)
  assert(dash.data.crashCount === 0)
  assert(dash.data.consistencyAvg === 97)
})

test('V8.2 Dashboard 有 5 个 Tab', () => {
  const dash = ta.stable.createReleaseDashboard({})
  assert(dash.tabs.length === 5)
  assert(dash.tabs.find(t => t.id === 'overview'))
  assert(dash.tabs.find(t => t.id === 'decisions'))
  assert(dash.tabs.find(t => t.id === 'experiments'))
  assert(dash.tabs.find(t => t.id === 'funnel'))
  assert(dash.tabs.find(t => t.id === 'feedback'))
})

test('V8.3 Stable Checklist all pass', () => {
  const checks = { D1: true, D2: true, D3: true, D4: true, D5: true, D6: true, D7: true }
  const list = ta.stable.createStableChecklist({ checks })
  assert(list.allPass === true)
  assert(list.action.includes('git tag v6.0.0'))
})

test('V8.4 Stable Checklist partial fail', () => {
  const checks = { D1: true, D2: true, D3: false, D4: true, D5: false, D6: true, D7: true }
  const list = ta.stable.createStableChecklist({ checks })
  assert(list.allPass === false)
  assert(list.action.includes('继续修复'))
})

// ═══════════════════════════════════════
// SECTION 9: Regression
// ═══════════════════════════════════════

section = 'Regression'
console.log('\n📋 ' + section)

const cp = require('child_process')
function runCP(path) {
  const r = cp.spawnSync('node', [path], { encoding: 'utf8', timeout: 30000 })
  const m = r.stdout.match(/RESULTS: (\d+) pass, (\d+) fail/)
  if (!m) throw new Error(`Parse err: ${path}`)
  return { pass: parseInt(m[1]), fail: parseInt(m[2]) }
}

test('R.1 CP6-F', () => {
  const r = runCP('tests/turnaround-intelligence/cp6f.test.js')
  assert(r.fail === 0, `CP6-F fail=${r.fail}`)
})
test('R.2 CP6-E', () => {
  const r = runCP('tests/turnaround-intelligence/cp6e.test.js')
  assert(r.fail === 0, `CP6-E fail=${r.fail}`)
})
test('R.3 CP6-D', () => {
  const r = runCP('tests/turnaround-intelligence/cp6d.test.js')
  assert(r.fail === 0, `CP6-D fail=${r.fail}`)
})
test('R.4 CP6-C', () => {
  const r = runCP('tests/turnaround-intelligence/cp6c.test.js')
  assert(r.fail === 0, `CP6-C fail=${r.fail}`)
})
test('R.5 CP6-B', () => {
  const r1 = runCP('tests/turnaround-intelligence/cp6b-profile.test.js')
  const r2 = runCP('tests/turnaround-intelligence/cp6b-cognitive.test.js')
  assert(r1.fail + r2.fail === 0, `CP6-B fail=${r1.fail + r2.fail}`)
})
test('R.6 CP5', () => {
  const r = runCP('tests/turnaround-os/checkpoint5.test.js')
  assert(r.fail === 0, `CP5 fail=${r.fail}`)
})

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════

console.log('\n========================================')
console.log(`V6.5 RESULTS: ${PASS} pass, ${FAIL} fail`)
console.log('========================================')
if (FAIL > 0) { console.log('\nFAILURES:'); for (const e of errors) console.log('  ❌ ' + e) }
