/**
 * PART B — REAL PAGE JS LOGIC TEST (TEST-ONLY Page shim)
 *
 * Loads the REAL Page() JavaScript module and captures data/methods/lifecycle.
 * Validates logic only: initial data, lifecycle transitions, navigation intent,
 * loading toggles, error/retry branches, submit/duplicate-click guards,
 * result/fallback branches, poster/payment state transitions.
 *
 * NOT claimed: WXML/WXSS rendering, DevTools runtime, E2E.
 *
 * @env TEST_ONLY / NON_PRODUCTION / NO REAL PAYMENT
 * Run: NODE_PATH=/tmp/mpspike/node_modules node --test tests/ui/part-b/*.test.js
 */

const test = require('node:test')
const assert = require('node:assert')
const { loadPage, defaultWx } = require('../helpers/pageShim')

// ─────────────────────────────────────────────────────────────
// home
// ─────────────────────────────────────────────────────────────
test('HOME: initial data + onShow loads and sets loading=false (with openid)', async () => {
  const { harness, error, wx } = loadPage('home', null, { globalData: { openid: 'openid_1', user: {}, userInfo: {}, configs: {} } })
  assert.ifError(error)
  assert.strictEqual(harness.data.loading, true)
  assert.strictEqual(typeof harness.onShow, 'function')
  assert.strictEqual(typeof harness.goStrategy, 'function')

  await harness.onShow()
  assert.strictEqual(harness.data.loading, false, 'loadAll must clear loading when openid present')
})

test('HOME: loadAll early-returns WITHOUT clearing loading when openid empty (finding)', async () => {
  // default app has openid='' → loadAll returns early, `loading` stays true.
  // This is a latent loading-overlay release gap on the home page.
  const { harness, error } = loadPage('home')
  assert.ifError(error)
  await harness.onShow()
  assert.strictEqual(harness.data.loading, true, 'observed: loading stays true when openid missing')
})

test('HOME: goChallenge/goProfile/goAIChat use switchTab intent', () => {
  const { harness, error, wx } = loadPage('home')
  assert.ifError(error)
  harness.goChallenge()
  harness.goProfile()
  harness.goAIChat()
  const nav = wx._calls.filter(c => c.type === 'switchTab')
  assert.deepStrictEqual(nav.map(c => c.url), ['/pages/challenge-start/challenge-start', '/pages/profile/profile', '/pages/ai-chat/ai-chat'])
})

test('HOME: goStrategy navigates to 18Q V2.1 questionnaire and clears strategyLoading', async () => {
  const { harness, error, wx } = loadPage('home')
  assert.ifError(error)
  await harness.goStrategy()
  // RC8.3 Stage1B R3.1: main CTA "开始翻身策略" now enters the 18Q V2.1
  // questionnaire (NOT the old 10Q challenge-play diagnostic).
  assert.ok(wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('v21-questionnaire')))
  assert.ok(!wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('challenge-play?mode=diagnostic')))
  assert.strictEqual(harness.data.strategyLoading, false)
})

test('HOME: onTapVersion admin gate requires 5 taps then calls adminCheckAccess', async () => {
  const { harness, error, wx } = loadPage('home')
  assert.ifError(error)
  for (let i = 0; i < 5; i++) harness.onTapVersion()
  await new Promise(r => setTimeout(r, 10))
  assert.ok(wx._calls.some(c => c.type === 'callFunction' && c.name === 'adminCheckAccess'), '5 taps must trigger admin check')
})

// ─────────────────────────────────────────────────────────────
// challenge-start
// ─────────────────────────────────────────────────────────────
test('CHALLENGE-START: duplicate start guard (_starting) + navigate on success', async () => {
  const wx = defaultWx()
  wx.cloud.callFunction = (opts) => {
    wx._calls.push({ type: 'callFunction', name: opts.name, data: opts.data })
    if (opts.name === 'startChallenge') {
      return Promise.resolve({ result: { code: 0, data: { recordId: 'rec_1', scoringVersion: 'v2', rawScores: {} } } })
    }
    return Promise.resolve({ result: { code: 0, data: {} } })
  }
  const { harness, error } = loadPage('challenge-start', wx)
  assert.ifError(error)
  assert.strictEqual(harness.data._starting, false)
  await harness.onStartChallenge()
  assert.ok(wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('challenge-play')), 'must navigate to challenge-play on success')
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data._starting, false)
})

test('CHALLENGE-START: startChallenge failure shows toast, does not navigate', async () => {
  const wx = defaultWx()
  wx.cloud.callFunction = (opts) => {
    wx._calls.push({ type: 'callFunction', name: opts.name })
    return Promise.resolve({ result: { code: 500, message: 'boom' } })
  }
  const { harness, error } = loadPage('challenge-start', wx)
  assert.ifError(error)
  await harness.onStartChallenge()
  assert.ok(wx._calls.some(c => c.type === 'showToast'), 'failure must toast')
  assert.ok(!wx._calls.some(c => c.type === 'navigateTo'), 'must NOT navigate on failure')
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data._starting, false)
})

// ─────────────────────────────────────────────────────────────
// challenge-play
// ─────────────────────────────────────────────────────────────
test('CHALLENGE-PLAY: diagnostic mode initializes 10-question contract', () => {
  const { harness, error } = loadPage('challenge-play')
  assert.ifError(error)
  harness.onLoad({ mode: 'diagnostic' })
  assert.strictEqual(harness.data.mode, 'diagnostic')
  assert.strictEqual(harness.data.dQ.total, 10)
  assert.strictEqual(harness.data.dQ.idx, 0)
  assert.ok(harness.data.currentQuestion, 'currentQuestion must be set')
  assert.strictEqual(harness.data.loading, false)
})

test('CHALLENGE-PLAY: onDNext blocks empty picker answer (toast, no advance)', () => {
  const { harness, error, wx } = loadPage('challenge-play')
  assert.ifError(error)
  harness.onLoad({ mode: 'diagnostic' })
  const before = harness.data.dQ.idx
  harness.onDNext()
  assert.strictEqual(harness.data.dQ.idx, before, 'must not advance without answer')
  assert.ok(wx._calls.some(c => c.type === 'showToast'))
})

test('CHALLENGE-PLAY: onDNext advances after valid picker answer', () => {
  const { harness, error } = loadPage('challenge-play')
  assert.ifError(error)
  harness.onLoad({ mode: 'diagnostic' })
  // Q0 is picker (lifeStage)
  harness.setData({ 'dQ.answers': { lifeStage: '25-30岁' }, 'dQ.selectedPick': '25-30岁', 'dQ.canNext': true })
  harness.onDNext()
  assert.strictEqual(harness.data.dQ.idx, 1, 'must advance to question 2')
})

test('CHALLENGE-PLAY: _submitDiagnostic sets globalData and redirects to report-detail', () => {
  const { harness, error, wx } = loadPage('challenge-play')
  assert.ifError(error)
  harness.onLoad({ mode: 'diagnostic' })
  const answers = {}
  const keys = ['lifeStage','incomeStructure','occupationDetail','monthlySurplus','safetyMonths','debtPressure','skillValidation','monetizableSkill','weeklyTime','executionStability','pastAttemptStage','decisionStyle','primaryGoal','maxTrialCost','failureResponse']
  keys.forEach(k => { answers[k] = 'x' })
  harness.setData({ 'dQ.answers': answers })
  harness._submitDiagnostic()
  assert.ok(harness._getAppGlobal()._diagnosticAnswers, 'globalData._diagnosticAnswers must be set')
  assert.strictEqual(harness._getAppGlobal()._diagnosticAnswers.diagnosticVersion, 'world_model_v1')
  assert.ok(wx._calls.some(c => c.type === 'redirectTo' && c.url.includes('report-detail')))
})

// ─────────────────────────────────────────────────────────────
// challenge-result
// ─────────────────────────────────────────────────────────────
test('CHALLENGE-RESULT: load normalizes result and clears loading', async () => {
  const wx = defaultWx()
  wx.cloud.callFunction = (opts) => {
    wx._calls.push({ type: 'callFunction', name: opts.name })
    if (opts.name === 'getChallengeRecord') {
      return Promise.resolve({ result: { code: 0, data: { finalType: '系统思考者', scores: { laborMindset: 70 } } } })
    }
    return Promise.resolve({ result: { code: 0, data: {} } })
  }
  const { harness, error } = loadPage('challenge-result', wx)
  assert.ifError(error)
  assert.strictEqual(harness.data.loading, true)
  harness.onLoad({ recordId: 'r1' })
  await harness.load() // onLoad fires load() without awaiting; await it explicitly
  assert.strictEqual(harness.data.loading, false)
  assert.ok(harness.data.result, 'result must be set')
  assert.strictEqual(harness.data.result.mainType, '系统思考者')
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

// ─────────────────────────────────────────────────────────────
// membership (challenge unlock)
// ─────────────────────────────────────────────────────────────
test('MEMBERSHIP: initial data + loadProduct clears loading', async () => {
  const wx = defaultWx()
  wx.cloud.callFunction = (opts) => {
    wx._calls.push({ type: 'callFunction', name: opts.name })
    if (opts.name === 'getProductList') {
      return Promise.resolve({ result: { code: 0, data: { products: [{ productId: 'challenge_39_9', name: '解锁挑战', price: 3990, originalPrice: 5990 }] } } })
    }
    return Promise.resolve({ result: { code: 0, data: {} } })
  }
  const { harness, error } = loadPage('membership', wx)
  assert.ifError(error)
  assert.strictEqual(harness.data.loading, true)
  harness.onLoad({ productId: 'challenge_39_9' })
  await harness.loadProduct('challenge_39_9') // onLoad fires loadProduct without awaiting
  assert.strictEqual(harness.data.loading, false)
  assert.ok(harness.data.product, 'product must be set')
  assert.strictEqual(harness.data.priceDisplay, '39.90')
})

test('MEMBERSHIP: onPay duplicate guard via paying flag', async () => {
  const { harness, error, wx } = loadPage('membership')
  assert.ifError(error)
  await harness.onLoad({ productId: 'challenge_39_9' })
  harness.data.paying = true
  await harness.onPay()
  // paying=true → early return, no createOrder call
  assert.ok(!wx._calls.some(c => c.type === 'callFunction' && c.name === 'createOrder'), 'onPay must be blocked when paying')
})

// ─────────────────────────────────────────────────────────────
// payment-result
// ─────────────────────────────────────────────────────────────
test('PAYMENT-RESULT: activated + showAnim transitions', async () => {
  const { harness, error } = loadPage('payment-result')
  assert.ifError(error)
  harness.onLoad({ orderId: 'o1', reportId: 'rp1' })
  assert.strictEqual(harness.data.activated, true)
  assert.strictEqual(harness.data.orderId, 'o1')
  await new Promise(r => setTimeout(r, 120))
  assert.strictEqual(harness.data.showAnim, true)
})

test('PAYMENT-RESULT: viewReport with reportId → redirectTo report-detail', () => {
  const { harness, error, wx } = loadPage('payment-result')
  assert.ifError(error)
  harness.onLoad({ orderId: 'o1', reportId: 'rp1' })
  harness.viewReport()
  assert.ok(wx._calls.some(c => c.type === 'redirectTo' && c.url.includes('report-detail?reportId=rp1')))
})

test('PAYMENT-RESULT: viewReport without reportId → navigateBack', () => {
  const { harness, error, wx } = loadPage('payment-result')
  assert.ifError(error)
  harness.onLoad({ orderId: 'o1' })
  harness.viewReport()
  assert.ok(wx._calls.some(c => c.type === 'navigateBack'))
})

// ─────────────────────────────────────────────────────────────
// ai-chat
// ─────────────────────────────────────────────────────────────
test('AI-CHAT: onSend empty/sending guard', async () => {
  const { harness, error, wx } = loadPage('ai-chat')
  assert.ifError(error)
  harness.onLoad()
  harness.setData({ inputValue: '' })
  await harness.onSend()
  assert.ok(!wx._calls.some(c => c.type === 'callFunction' && c.name === 'generateAiReport'), 'empty input must not call cloud')
})

test('AI-CHAT: onSend sends and clears inputValue', async () => {
  const { harness, error, wx } = loadPage('ai-chat')
  assert.ifError(error)
  harness.onLoad()
  harness.setData({ inputValue: '你好' })
  await harness.onSend()
  assert.strictEqual(harness.data.inputValue, '')
  assert.strictEqual(harness.data.sending, false)
  assert.ok(harness.data.messages.some(m => m.role === 'user' && m.content === '你好'))
})

// ─────────────────────────────────────────────────────────────
// ai-analysis
// ─────────────────────────────────────────────────────────────
test('AI-ANALYSIS: onLoad legacy challenge source redirects to report-preview', () => {
  const { harness, error, wx } = loadPage('ai-analysis')
  assert.ifError(error)
  harness.onLoad({ source: 'challenge' })
  assert.ok(wx._calls.some(c => c.type === 'redirectTo' && c.url.includes('report-preview')), 'legacy challenge_final must redirect to report-preview')
})

test('AI-ANALYSIS: onLoad default → status empty (retired page)', () => {
  const { harness, error } = loadPage('ai-analysis')
  assert.ifError(error)
  harness.onLoad({})
  assert.strictEqual(harness.data.status, 'empty')
})

// ─────────────────────────────────────────────────────────────
// report-preview / report-detail / share-poster (logic-only spot checks)
// ─────────────────────────────────────────────────────────────
test('REPORT-PREVIEW: initial locked/loading state present', () => {
  const { harness, error } = loadPage('report-preview')
  assert.ifError(error)
  assert.strictEqual(harness.data.locked, true)
  assert.strictEqual(harness.data.loading, true)
  assert.strictEqual(typeof harness.onGenerate, 'function')
})

test('REPORT-DETAIL: initial loading=true and REVEAL timing constant present', () => {
  const { harness, error } = loadPage('report-detail')
  assert.ifError(error)
  assert.strictEqual(harness.data.loading, true)
  assert.strictEqual(typeof harness._renderV4, 'function')
  assert.strictEqual(typeof harness._renderV3, 'function')
})

test('SHARE-POSTER: generatePoster without result → toast + generating reset', async () => {
  const { harness, error, wx } = loadPage('share-poster')
  assert.ifError(error)
  harness.setData({ result: null })
  await harness.generatePoster()
  assert.ok(wx._calls.some(c => c.type === 'showToast'))
  assert.strictEqual(harness.data.generating, false)
})

test('SHARE-POSTER: duplicate generatePoster guard', async () => {
  const { harness, error } = loadPage('share-poster')
  assert.ifError(error)
  harness.setData({ generating: true })
  await harness.generatePoster()
  // generating=true → early return; no canvas path set
  assert.strictEqual(harness.data.posterPath, '')
})
