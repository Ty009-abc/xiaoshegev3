/**
 * R2 MAIN JOURNEY — REAL Page() JS logic tests (TEST-ONLY Page shim).
 *
 * Covers the priority journey: home → challenge/questionnaire → challenge
 * result → report preview/detail → (poster is covered in r2-payment-poster).
 *
 * Logic-only. No WXML/WXSS/DevTools/device/E2E claim.
 * Guard contract: PAYMENT_REAL_CALL_COUNT=0, LIVE_AI_CALL_COUNT=0,
 * REAL_DB_MUTATION_COUNT=0, BATCH2/3=NO, PRIMARY=NO, GATE_B=NO.
 *
 * @env TEST_ONLY / NON_PRODUCTION / NO REAL PAYMENT / NO REAL DB
 * Run: NODE_PATH=/tmp/mpspike/node_modules node --test tests/ui/part-b/r2-main-journey.test.js
 */

const test = require('node:test')
const assert = require('node:assert')
const { loadPage } = require('../helpers/pageShim')
const { buildGuardedWx, getGuards, resetGuards, seedModule, svcPath } = require('../helpers/guards')

resetGuards()

// Deterministic cloud router used by REAL service modules (challengeService,
// aiReportService, permissionService) through the guarded wx mock.
function router(map) {
  return (opts) => {
    const fn = map[opts.name] || map['*']
    // Return RAW cloud-function result ({ code, data }); guards.callFunction
    // wraps it into { result } to match real wx.cloud.callFunction shape.
    const result = fn ? fn(opts) : { code: 0, data: {} }
    return Promise.resolve(result)
  }
}

// Seed the REAL aiReportService so report-preview/report-detail use a
// deterministic in-memory impl (NO live AI). Returns { reportService }.
function seedAiReport(behavior) {
  const b = behavior || {}
  const impl = {
    generateDiagnosticReport: async (p) => (b.diagResult !== undefined ? b.diagResult : { code: 0, data: b.diagData || { position: 'pos', trapped_by: 'trap', forbidden: ['f'], path: 'path', next90days: ['a'] } }),
    getAiReport: async () => (b.getResult || { code: 0, data: { reportType: 'challenge_final', content: { oneSentence: 's' } } }),
    generateAiReport: async () => (b.genResult || { code: 0, data: { reportType: 'challenge_final', content: { oneSentence: 's' } } }),
    generateV2ShadowReport: async () => ({ code: 0 }),
  }
  seedModule(svcPath('aiReportService.js'), impl)
  return impl
}

// Seed the REAL permissionService so report-preview's authority decision is
// deterministic (FIX A: single 'full_report' authority path).
function seedPermission({ granted, throws } = {}) {
  const impl = {
    checkPermission: async () => {
      if (throws) throw new Error('permission lookup failed')
      return { granted: !!granted, needPay: !granted }
    },
  }
  seedModule(svcPath('permissionService.js'), impl)
  return impl
}

test('HOME: initial data contract (loading=true, insight=null, cvPercent=0)', () => {
  const { harness, error } = loadPage('home')
  assert.ifError(error)
  assert.strictEqual(harness.data.loading, true)
  assert.strictEqual(harness.data.insight, null)
  assert.strictEqual(harness.data.cvPercent, 0)
  assert.strictEqual(harness.data.adminTapCount, 0)
})

test('HOME: loadAll with openid clears loading and maps user/insight', async () => {
  const { wx, calls } = buildGuardedWx({ dbGet: [{ cv: 42, streak: 3, membershipLevel: 'free' }] })
  const app = { globalData: { openid: 'o1', user: {}, userInfo: {}, configs: {} } }
  const { harness, error } = loadPage('home', wx, app)
  assert.ifError(error)
  await harness.loadAll()
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data.cvPercent, 42)
  assert.strictEqual(harness.data.showFreeValue, true)
})

test('HOME: loadAll WITHOUT openid early-returns and leaves loading=true (BUG)', async () => {
  // default app openid='' → loadAll returns without clearing loading.
  const { harness, error } = loadPage('home')
  assert.ifError(error)
  await harness.onShow()
  assert.strictEqual(harness.data.loading, true, 'observed: loading stuck true when openid missing')
})

test('HOME: navigation intents (goStrategy/goChallenge/goMembership/goAIChat)', async () => {
  const { harness, error, wx } = loadPage('home')
  assert.ifError(error)
  harness.goChallenge()
  harness.goMembership()
  harness.goAIChat()
  await harness.goStrategy()
  const nav = wx._calls.filter(c => c.type === 'navigateTo' || c.type === 'switchTab')
  assert.ok(nav.some(c => c.type === 'switchTab' && c.url.includes('challenge-start')))
  assert.ok(nav.some(c => c.type === 'navigateTo' && c.url.includes('membership')))
  assert.ok(nav.some(c => c.type === 'switchTab' && c.url.includes('ai-chat')))
  assert.ok(nav.some(c => c.type === 'navigateTo' && c.url.includes('challenge-play?mode=diagnostic')))
  assert.strictEqual(harness.data.strategyLoading, false)
})

test('CHALLENGE-START: success navigates to challenge-play with recordId', async () => {
  const { wx } = buildGuardedWx({ cloudFn: router({ startChallenge: () => ({ code: 0, data: { recordId: 'rec_9', scoringVersion: 'v2', rawScores: {} } }) }) })
  const { harness, error } = loadPage('challenge-start', wx)
  assert.ifError(error)
  await harness.onStartChallenge()
  assert.ok(wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('challenge-play') && c.url.includes('rec_9')))
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data._starting, false)
})

test('CHALLENGE-START: duplicate submit guard via _starting', async () => {
  let calls = 0
  const { wx } = buildGuardedWx({ cloudFn: router({ startChallenge: () => { calls++; return { code: 0, data: { recordId: 'r' } } } }) })
  const { harness, error } = loadPage('challenge-start', wx)
  assert.ifError(error)
  harness.setData({ _starting: true })
  await harness.onStartChallenge()
  assert.strictEqual(calls, 0, 'guarded: no cloud call while _starting=true')
})

test('CHALLENGE-START: invalid recordId response → toast, no navigate', async () => {
  const { wx } = buildGuardedWx({ cloudFn: router({ startChallenge: () => ({ code: 0, data: {} }) }) })
  const { harness, error } = loadPage('challenge-start', wx)
  assert.ifError(error)
  await harness.onStartChallenge()
  assert.ok(wx._calls.some(c => c.type === 'showToast'), 'failure toast expected')
  assert.ok(!wx._calls.some(c => c.type === 'navigateTo'), 'no navigate on failure')
  assert.strictEqual(harness.data.loading, false)
})

test('CHALLENGE-PLAY: diagnostic init builds 10-question contract', () => {
  const { harness, error } = loadPage('challenge-play')
  assert.ifError(error)
  harness.onLoad({ mode: 'diagnostic' })
  assert.strictEqual(harness.data.mode, 'diagnostic')
  assert.strictEqual(harness.data.dQ.total, 10)
  assert.strictEqual(harness.data.dQ.idx, 0)
  assert.strictEqual(harness.data.loading, false)
  assert.ok(harness.data.currentQuestion)
  assert.strictEqual(harness.data.currentQuestion.key, 'lifeStage')
})

test('CHALLENGE-PLAY: onDNext blocks empty answer (toast, no advance)', () => {
  const { harness, error, wx } = loadPage('challenge-play')
  assert.ifError(error)
  harness.onLoad({ mode: 'diagnostic' })
  const before = harness.data.dQ.idx
  harness.onDNext()
  assert.strictEqual(harness.data.dQ.idx, before)
  assert.ok(wx._calls.some(c => c.type === 'showToast'))
})

test('CHALLENGE-PLAY: full walkthrough reaches submit and redirects to report-detail', () => {
  const { harness, error, wx } = loadPage('challenge-play')
  assert.ifError(error)
  harness.onLoad({ mode: 'diagnostic' })
  const answers = {
    lifeStage: '25-30岁', incomeStructure: '工资/固定薪资', occupationDetail: '程序员',
    monthlySurplus: '1000-5000元', safetyMonths: '1-3个月', debtPressure: '无负债',
    skillValidation: '偶尔有付费需求', monetizableSkill: '技术类（编程/设计/工程）',
    weeklyTime: '10-20小时', executionStability: '有固定计划，基本能执行',
    pastAttemptStage: '卖出过几个，有少量收入', decisionStyle: '边上班边小规模测试',
    primaryGoal: '搞一份副业收入', maxTrialCost: '1000-5000元', failureResponse: '复盘优化后继续',
  }
  harness.setData({ 'dQ.answers': answers })
  // step through all 10 questions
  for (let i = 0; i < 10; i++) {
    assert.strictEqual(harness.data.dQ.idx, i)
    harness.onDNext()
  }
  const gd = harness._getAppGlobal()
  assert.ok(gd._diagnosticAnswers, 'globalData._diagnosticAnswers must be set')
  assert.strictEqual(gd._diagnosticAnswers.diagnosticVersion, 'world_model_v1')
  assert.strictEqual(gd._diagnosticAnswers.answers.primaryGoal, '搞一份副业收入')
  assert.ok(wx._calls.some(c => c.type === 'redirectTo' && c.url.includes('report-detail?mode=diagnostic')))
})

test('CHALLENGE-PLAY: _submitDiagnostic duplicate guard (submitting)', () => {
  const { harness, error, wx } = loadPage('challenge-play')
  assert.ifError(error)
  harness.onLoad({ mode: 'diagnostic' })
  harness.setData({ 'dQ.submitting': true })
  harness._submitDiagnostic()
  assert.ok(!wx._calls.some(c => c.type === 'redirectTo'), 'no redirect when already submitting')
})

test('CHALLENGE-PLAY: challenge mode nextEvent → locked → challengeLocked=true', async () => {
  const { wx } = buildGuardedWx({ cloudFn: router({ getChallengeEvent: () => ({ code: 0, data: { locked: true, message: '免费体验已完成' } }) }) })
  const { harness, error } = loadPage('challenge-play', wx)
  assert.ifError(error)
  harness.setData({ mode: 'challenge', recordId: 'r1' })
  await harness.nextEvent()
  assert.strictEqual(harness.data.challengeLocked, true)
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data.lockReason, '免费体验已完成')
})

test('CHALLENGE-PLAY: challenge mode nextEvent → finished → goResult redirect', async () => {
  const { wx } = buildGuardedWx({ cloudFn: router({ getChallengeEvent: () => ({ code: 0, data: { finished: true } }) }) })
  const { harness, error } = loadPage('challenge-play', wx)
  assert.ifError(error)
  harness.setData({ mode: 'challenge', recordId: 'r1' })
  await harness.nextEvent()
  assert.ok(wx._calls.some(c => c.type === 'redirectTo' && c.url.includes('challenge-result')))
})

test('CHALLENGE-PLAY: nextEvent malformed (no eventId) → loadFailed + modal', async () => {
  const { wx } = buildGuardedWx({ modalAuto: false, cloudFn: router({ getChallengeEvent: () => ({ code: 0, data: { title: 'x', choices: [] } }) }) })
  const { harness, error } = loadPage('challenge-play', wx)
  assert.ifError(error)
  harness.setData({ mode: 'challenge', recordId: 'r1' })
  await harness.nextEvent()
  assert.strictEqual(harness.data.loadFailed, true)
  assert.ok(wx._calls.some(c => c.type === 'showModal'))
})

test('CHALLENGE-PLAY: onUnload clears typewriter timer', () => {
  const { harness, error } = loadPage('challenge-play')
  assert.ifError(error)
  harness.onLoad({ mode: 'diagnostic' })
  assert.ok(harness._twTimer, 'typewriter timer should be active after init')
  harness.onUnload()
  assert.strictEqual(harness._twTimer, null)
})

test('CHALLENGE-RESULT: load normalizes scores + clears loading', async () => {
  const { wx } = buildGuardedWx({ cloudFn: router({ getChallengeRecord: () => ({ code: 0, data: { finalType: '系统思考者', scores: { laborMindset: 70, decisionStability: 30 } } }) }) })
  const { harness, error } = loadPage('challenge-result', wx)
  assert.ifError(error)
  harness.onLoad({ recordId: 'r1' })
  await harness.load()
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data.result.mainType, '系统思考者')
  assert.strictEqual(harness.data.result.profile.laborMindset, 70)
  assert.strictEqual(harness.data.result.profile.decisionStability, 30)
})

test('CHALLENGE-RESULT: empty/malformed result → loading cleared, result stays null', async () => {
  const { wx } = buildGuardedWx({ cloudFn: router({ getChallengeRecord: () => ({ code: 500 }) }) })
  const { harness, error } = loadPage('challenge-result', wx)
  assert.ifError(error)
  harness.onLoad({ recordId: 'r1' })
  await harness.load()
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data.result, null)
})

test('CHALLENGE-RESULT: goReport/goShare/goRanking navigation intents', () => {
  const { harness, error, wx } = loadPage('challenge-result')
  assert.ifError(error)
  harness.goReport()
  harness.goShare()
  harness.goRanking()
  assert.ok(wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('report-preview')))
  assert.ok(wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('share-poster')))
  assert.ok(wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('growth-ranking')))
})

test('REPORT-PREVIEW: diagnostic mode with globalData._diagnosticAnswers loads via aiReportService', async () => {
  seedAiReport({ diagData: { position: 'pos', trapped_by: 'trap', forbidden: ['f1'], path: 'path', next90days: ['a1', 'a2'] } })
  const { wx } = buildGuardedWx({ cloudFn: router({}) })
  const app = { globalData: { _diagnosticAnswers: { diagnosticVersion: 'v3', answers: {} }, _diagnosticPersonality: { name: 'n', emoji: 'e', style: 's' } } }
  const { harness, error } = loadPage('report-preview', wx, app)
  assert.ifError(error)
  harness.onLoad({ type: 'diagnostic' })
  await harness._loadDiagnostic()
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data.locked, false)
  assert.ok(harness.data.report)
})

test('REPORT-PREVIEW: dead load() authority removed (no load method)', () => {
  const { harness, error } = loadPage('report-preview')
  assert.ifError(error)
  assert.strictEqual(typeof harness.load, 'undefined', 'dead load() authority path must be removed')
})

test('REPORT-PREVIEW: goFull denied (isVip=true) shows upgrade modal, no navigate', async () => {
  seedPermission({ granted: false })
  const { harness, error, wx } = loadPage('report-preview', null, { globalData: { isVip: true } })
  assert.ifError(error)
  harness.setData({ recordId: 'r1', report: { _id: 'rep1' } })
  const r = await harness.goFull()
  assert.strictEqual(r, false)
  assert.strictEqual(harness.data.showUpgradeModal, true)
  assert.ok(!wx._calls.some(c => c.type === 'navigateTo'))
})

test('REPORT-PREVIEW: goFull authorized (isVip=false) navigates to report-detail', async () => {
  seedPermission({ granted: true })
  const { harness, error, wx } = loadPage('report-preview', null, { globalData: { isVip: false } })
  assert.ifError(error)
  harness.setData({ recordId: 'r1', report: { reportId: 'AR_TEST_VALID' } })
  const r = await harness.goFull()
  assert.strictEqual(r, true)
  assert.ok(wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('report-detail')))
})

test('REPORT-PREVIEW: onCloseUpgrade (先看报告) cannot bypass authority (fixed)', async () => {
  seedPermission({ granted: false })
  const { harness, error, wx } = loadPage('report-preview', null, { globalData: { isVip: true } })
  assert.ifError(error)
  harness.setData({ recordId: 'r1', report: { _id: 'rep1' } })
  const r = await harness.onCloseUpgrade()
  assert.strictEqual(r, false)
  assert.strictEqual(harness.data.showUpgradeModal, true)
  assert.ok(!wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('report-detail')), 'skip must no longer bypass the reportfull gate')
})

test('REPORT-DETAIL: initial loading=true and V4/V3 render fns present', () => {
  const { harness, error } = loadPage('report-detail')
  assert.ifError(error)
  assert.strictEqual(harness.data.loading, true)
  assert.strictEqual(typeof harness._renderV4, 'function')
  assert.strictEqual(typeof harness._renderV3, 'function')
  assert.strictEqual(typeof harness.generatePoster, 'function')
})

test('REPORT-DETAIL: no answers → error + redirect to challenge-play (data-loss recovery)', async () => {
  const { wx } = buildGuardedWx({ cloudFn: router({}) })
  const { harness, error } = loadPage('report-detail', wx, { globalData: {} })
  assert.ifError(error)
  harness.onLoad({ mode: 'diagnostic' })
  await harness._startDiagnostic()
  await new Promise(r => setTimeout(r, 1600)) // redirect is scheduled at 1500ms
  assert.strictEqual(harness.data.loading, false)
  assert.ok(harness.data.error.includes('诊断数据丢失'))
  assert.ok(wx._calls.some(c => c.type === 'redirectTo' && c.url.includes('challenge-play?mode=diagnostic')))
})

test('REPORT-DETAIL: _urlParams is NEVER assigned → share/history reportId recovery is dead (BUG)', async () => {
  // Level-3 recovery reads this.data._urlParams.reportId, but _urlParams is never
  // assigned anywhere in report-detail.js. So a user opening report-detail?reportId=X
  // with no globalData/storage will ALWAYS hit "诊断数据丢失" instead of fetching X.
  const { wx } = buildGuardedWx({ cloudFn: router({ getAiReport: () => ({ code: 0, data: { reportType: 'challenge_final' } }) }) })
  const { harness, error } = loadPage('report-detail', wx, { globalData: {} })
  assert.ifError(error)
  harness.onLoad({ mode: 'diagnostic', reportId: 'HISTORY_ID_123' })
  await harness._startDiagnostic()
  assert.ok(harness.data.error.includes('诊断数据丢失'), 'observed: history entry still loses data')
  assert.ok(!wx._calls.some(c => c.type === 'callFunction' && c.name === 'getAiReport'), 'observed: getAiReport never invoked for reportId recovery')
})

test('REPORT-DETAIL: _renderV3 builds 5 sections and clears loading', () => {
  const { harness, error } = loadPage('report-detail')
  assert.ifError(error)
  harness._renderV3({ position: 'p', trapped_by: 't', forbidden: ['f'], path: 'path', next90days: ['a'] })
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data.sections.length, 5)
  // NOTE: _renderV3 does NOT set reportVersion (the caller does). Assert sections only.
})

test('REPORT-DETAIL: _renderV4 builds viewModel and stops loading carousel', () => {
  const { harness, error } = loadPage('report-detail')
  assert.ifError(error)
  const n4 = require('../../../utils/reportNormalizerV4')
  const raw = { report: { reportType: 'diagnostic_v4', hero: {}, identity: {}, scoreCard: {}, systemLeaks: [], stopDoing: [], wealthPaths: [], actionTimeline: [], probabilities: {}, finalStrike: {} } }
  const vm = n4.buildDiagnosticV4ViewModel(raw.report)
  harness._renderV4({ report: raw.report })
  assert.strictEqual(harness.data.loading, false)
  assert.ok(harness.data.viewModel, 'viewModel must be set')
  assert.strictEqual(harness.data._loadingStepTimer, null, 'carousel timer cleared after render')
})

// Final guard assertion for this suite.
test('R2-MAIN-JOURNEY: guard counters are clean', () => {
  const g = getGuards()
  assert.strictEqual(g.liveAiCallCount, 0, 'LIVE_AI_CALL_COUNT must be 0')
  assert.strictEqual(g.realDbMutationCount, 0, 'REAL_DB_MUTATION_COUNT must be 0')
  assert.strictEqual(g.primaryActivated, false)
  assert.strictEqual(g.batch2RuntimeUsed, false)
  assert.strictEqual(g.batch3RuntimeUsed, false)
  assert.strictEqual(g.gateBStateChanged, false)
})
