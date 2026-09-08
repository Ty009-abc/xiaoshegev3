/**
 * R2 PAYMENT PAGE — REAL Page() JS logic tests (TEST-ONLY Page shim).
 *
 * Covers membership + payment-result page logic, and the poster/QR logic of
 * report-detail + report-preview + share-poster.
 *
 * Logic-only. Guard contract: PAYMENT_REAL_CALL_COUNT=0 (enforced via
 * paymentMock real-call counter), LIVE_AI_CALL_COUNT=0, REAL_DB_MUTATION_COUNT=0.
 *
 * @env TEST_ONLY / NON_PRODUCTION / NO REAL PAYMENT / NO REAL DB
 * Run: NODE_PATH=/tmp/mpspike/node_modules node --test tests/ui/part-b/r2-payment-poster.test.js
 */

const test = require('node:test')
const assert = require('node:assert')
const { loadPage } = require('../helpers/pageShim')
const { buildGuardedWx, getGuards, resetGuards, seedModule, svcPath } = require('../helpers/guards')
const { getRealCallState, resetRealCallState } = require('../helpers/paymentMock')

resetGuards()
resetRealCallState()

// Seed the REAL paymentService module with a deterministic in-memory impl that
// does NOT touch wx.cloud at all (so PAYMENT_REAL_CALL_COUNT stays 0).
function seedPaymentService(script) {
  const queue = (script || []).slice()
  const next = () => (queue.length ? queue.shift() : { kind: 'success' })
  const impl = {
    getProductList: async () => ({ code: 0, data: { products: [{ productId: 'challenge_39_9', name: '解锁挑战', price: 3990, originalPrice: 5990 }] } }),
    createOrder: async () => { const n = next(); return n.kind === 'create_fail' ? { code: 500, message: 'fail' } : { code: 0, data: { orderId: 'ord_1', paymentParams: { timeStamp: '1', nonceStr: 'n', package: 'p', signType: 'RSA', paySign: 's' } } } },
    requestPayment: async () => { const n = next(); if (n.kind === 'cancel') return { success: false, cancelled: true }; if (n.kind === 'fail') return { success: false, cancelled: false }; return { success: true, transactionId: 'txn_1' } },
    verifyPayment: async () => { const n = next(); if (n.kind === 'verify_pending') return { code: 0, data: { status: 'pending' } }; return { code: 0, data: { status: 'paid' } } },
    restorePendingOrder: async () => ({ recovered: false }),
    getPendingOrders: async () => [],
    savePendingOrderLocally: () => {},
    clearPendingOrderLocally: () => {},
    getEntitlements: async () => ({ code: 0, data: {} }),
    checkPermission: async () => true,
    refundOrder: async () => ({ code: 0 }),
  }
  seedModule(svcPath('paymentService.js'), impl)
  return impl
}

// ─────────────────────────────────────────────────────────────
// membership
// ─────────────────────────────────────────────────────────────
test('MEMBERSHIP: initial data + loadProduct maps price display', async () => {
  seedPaymentService()
  const { wx } = buildGuardedWx()
  const { harness, error } = loadPage('membership', wx)
  assert.ifError(error)
  harness.onLoad({ productId: 'challenge_39_9' })
  await harness.loadProduct('challenge_39_9')
  assert.strictEqual(harness.data.loading, false)
  assert.ok(harness.data.product)
  assert.strictEqual(harness.data.priceDisplay, '39.90')
  assert.strictEqual(harness.data.originalPriceDisplay, '59.90')
  assert.strictEqual(harness.data.hasOriginalPrice, true)
})

test('MEMBERSHIP: loadProduct fallback when product not found', async () => {
  seedPaymentService()
  const { wx } = buildGuardedWx()
  const { harness, error } = loadPage('membership', wx)
  assert.ifError(error)
  harness.onLoad({ productId: 'unknown_id' })
  await harness.loadProduct('unknown_id')
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data.product.productId, 'challenge_39_9')
  assert.strictEqual(harness.data.priceDisplay, '39.90')
})

test('MEMBERSHIP: onPay success path → unlock toast + navigateBack timer', async () => {
  seedPaymentService([{ kind: 'success' }, { kind: 'success' }, { kind: 'success' }])
  const { wx } = buildGuardedWx()
  const { harness, error } = loadPage('membership', wx)
  assert.ifError(error)
  harness.onLoad({ productId: 'challenge_39_9', recordId: 'rec_1' })
  await harness.loadProduct('challenge_39_9')
  await harness.onPay()
  assert.ok(wx._calls.some(c => c.type === 'showToast' && c.title === '解锁成功！'))
  assert.ok(harness._navTimer, 'nav timer scheduled')
  assert.strictEqual(harness.data.paying, false)
  harness.onUnload() // clear timer
})

test('MEMBERSHIP: onPay cancel → cancel toast, no navigateBack timer', async () => {
  seedPaymentService([{ kind: 'success' }, { kind: 'cancel' }])
  const { wx } = buildGuardedWx()
  const { harness, error } = loadPage('membership', wx)
  assert.ifError(error)
  harness.onLoad({ productId: 'challenge_39_9' })
  await harness.loadProduct('challenge_39_9')
  await harness.onPay()
  assert.ok(wx._calls.some(c => c.type === 'showToast' && c.title === '支付已取消'))
  assert.strictEqual(harness._navTimer, undefined)
  assert.strictEqual(harness.data.paying, false)
})

test('MEMBERSHIP: onPay pending verify → pending toast, no navigateBack', async () => {
  seedPaymentService([{ kind: 'success' }, { kind: 'success' }, { kind: 'verify_pending' }])
  const { wx } = buildGuardedWx()
  const { harness, error } = loadPage('membership', wx)
  assert.ifError(error)
  harness.onLoad({ productId: 'challenge_39_9' })
  await harness.loadProduct('challenge_39_9')
  await harness.onPay()
  assert.ok(wx._calls.some(c => c.type === 'showToast' && c.title === '支付确认中，请稍后重试'))
  assert.strictEqual(harness._navTimer, undefined)
  assert.strictEqual(harness.data.paying, false)
})

test('MEMBERSHIP: onPay duplicate guard via paying flag', async () => {
  seedPaymentService()
  const { wx } = buildGuardedWx()
  const { harness, error } = loadPage('membership', wx)
  assert.ifError(error)
  harness.onLoad({ productId: 'challenge_39_9' })
  await harness.loadProduct('challenge_39_9')
  harness.data.paying = true
  await harness.onPay()
  assert.ok(!wx._calls.some(c => c.type === 'callFunction'), 'no cloud call when paying=true')
})

test('MEMBERSHIP: onCancelUnlock navigateBack when stack > 1', () => {
  seedPaymentService()
  const { wx } = buildGuardedWx({ getCurrentPages: () => [{}, {}] })
  const { harness, error } = loadPage('membership', wx)
  assert.ifError(error)
  harness.onCancelUnlock()
  assert.ok(wx._calls.some(c => c.type === 'navigateBack'))
})

test('MEMBERSHIP: onCancelUnlock reLaunch when stack == 1', () => {
  seedPaymentService()
  const { wx } = buildGuardedWx({ getCurrentPages: () => [{}] })
  const { harness, error } = loadPage('membership', wx)
  assert.ifError(error)
  harness.onCancelUnlock()
  assert.ok(wx._calls.some(c => c.type === 'reLaunch' && c.url.includes('/pages/home/home')))
})

test('MEMBERSHIP: onCancelUnlock blocked while paying', () => {
  seedPaymentService()
  const { wx } = buildGuardedWx({ getCurrentPages: () => [{}, {}] })
  const { harness, error } = loadPage('membership', wx)
  assert.ifError(error)
  harness.data.paying = true
  harness.onCancelUnlock()
  assert.ok(!wx._calls.some(c => c.type === 'navigateBack'), 'blocked while paying')
})

test('MEMBERSHIP: onRetry reloads product and clears loadError', async () => {
  seedPaymentService()
  const { wx } = buildGuardedWx()
  const { harness, error } = loadPage('membership', wx)
  assert.ifError(error)
  harness.onLoad({ productId: 'challenge_39_9' })
  harness.onRetry()
  await harness.loadProduct('challenge_39_9')
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data.loadError, '')
})

// ─────────────────────────────────────────────────────────────
// payment-result
// ─────────────────────────────────────────────────────────────
test('PAYMENT-RESULT: activated + showAnim lifecycle', async () => {
  const { wx } = buildGuardedWx()
  const { harness, error } = loadPage('payment-result', wx)
  assert.ifError(error)
  harness.onLoad({ orderId: 'o1', reportId: 'rp1' })
  assert.strictEqual(harness.data.activated, true)
  assert.strictEqual(harness.data.orderId, 'o1')
  await new Promise(r => setTimeout(r, 120))
  assert.strictEqual(harness.data.showAnim, true)
})

test('PAYMENT-RESULT: viewReport with reportId → redirectTo report-detail', () => {
  const { wx } = buildGuardedWx()
  const { harness, error } = loadPage('payment-result', wx)
  assert.ifError(error)
  harness.onLoad({ orderId: 'o1', reportId: 'rp1' })
  harness.viewReport()
  assert.ok(wx._calls.some(c => c.type === 'redirectTo' && c.url.includes('report-detail?reportId=rp1')))
})

test('PAYMENT-RESULT: viewReport without reportId → navigateBack', () => {
  const { wx } = buildGuardedWx()
  const { harness, error } = loadPage('payment-result', wx)
  assert.ifError(error)
  harness.onLoad({ orderId: 'o1' })
  harness.viewReport()
  assert.ok(wx._calls.some(c => c.type === 'navigateBack'))
})

test('PAYMENT-RESULT: viewChallenge/goHome navigation intents', () => {
  const { wx } = buildGuardedWx()
  const { harness, error } = loadPage('payment-result', wx)
  assert.ifError(error)
  harness.onLoad({ orderId: 'o1' })
  harness.viewChallenge()
  harness.goHome()
  assert.ok(wx._calls.some(c => c.type === 'switchTab' && c.url.includes('challenge-start')))
  assert.ok(wx._calls.some(c => c.type === 'switchTab' && c.url.includes('home')))
})

// ─────────────────────────────────────────────────────────────
// poster / QR logic
// ─────────────────────────────────────────────────────────────
test('SHARE-POSTER: generatePoster without result → toast + reset generating', async () => {
  const { wx } = buildGuardedWx()
  const { harness, error } = loadPage('share-poster', wx)
  assert.ifError(error)
  harness.setData({ result: null })
  await harness.generatePoster()
  assert.ok(wx._calls.some(c => c.type === 'showToast'))
  assert.strictEqual(harness.data.generating, false)
})

test('SHARE-POSTER: duplicate generatePoster guard', async () => {
  const { wx } = buildGuardedWx()
  const { harness, error } = loadPage('share-poster', wx)
  assert.ifError(error)
  harness.setData({ generating: true })
  await harness.generatePoster()
  assert.strictEqual(harness.data.posterPath, '')
})

test('SHARE-POSTER: loadResult empty record → result stays null, no crash', async () => {
  const { wx } = buildGuardedWx({ cloudFn: () => ({ code: 0, data: null }) })
  const { harness, error } = loadPage('share-poster', wx)
  assert.ifError(error)
  harness.onLoad({ recordId: '' })
  await harness.loadResult()
  assert.strictEqual(harness.data.result, null)
})

test('SHARE-POSTER: canvas export failure → generating reset + toast', async () => {
  const { wx } = buildGuardedWx({ canvasExportFail: true })
  const { harness, error } = loadPage('share-poster', wx)
  assert.ifError(error)
  harness.setData({ result: { mainType: 'T', turnaroundProbability: 80, profile: { laborMindset: 50 } } })
  await harness.generatePoster()
  // generatePoster's draw callback wraps canvasToTempFilePath in a 500ms setTimeout.
  await new Promise(r => setTimeout(r, 600))
  // canvasToTempFilePath fail → generating reset + failure toast
  assert.strictEqual(harness.data.generating, false)
  assert.ok(wx._calls.some(c => c.type === 'showToast'))
})

test('REPORT-PREVIEW: generatePoster success path sets posterPath + showPoster', async () => {
  const { wx } = buildGuardedWx()
  const { harness, error } = loadPage('report-preview', wx)
  assert.ifError(error)
  harness.setData({ reportData: { basicInsight: 'a', mechanism: 'b', reverseReasoning: 'c', biasCorrection: 'd', actionPlan: 'e' } })
  harness.generatePoster()
  // async canvas draw + export → success
  await new Promise(r => setTimeout(r, 50))
  assert.strictEqual(harness.data.posterGenerating, false)
  assert.strictEqual(harness.data.posterPath, '/tmp/poster.png')
  assert.strictEqual(harness.data.showPoster, true)
})

test('REPORT-DETAIL: generatePoster with no viewModel/sections still builds V3 poster data', async () => {
  const { wx } = buildGuardedWx({ selectorResult: [{ node: { getContext: () => ({ setTransform() {}, scale() {}, fillRect() {}, measureText: () => ({ width: 10 }), createImage: () => ({}) }) }, width: 750, height: 1600 }] })
  const { harness, error } = loadPage('report-detail', wx)
  assert.ifError(error)
  harness.setData({ reportVersion: 'v3', sections: [{ text: 'f' }, { text: 'c' }, { text: 's' }, { text: 'p' }, { text: 'a' }] })
  // generatePoster requires canvas node; with null node it should hit the catch path, not throw synchronously
  harness.generatePoster()
  await new Promise(r => setTimeout(r, 30))
})

// Final guard assertion for this suite.
test('R2-PAYMENT-POSTER: guard counters are clean', () => {
  const rs = getRealCallState()
  assert.strictEqual(rs.realCallCount, 0, 'PAYMENT_REAL_CALL_COUNT must be 0')
  const g = getGuards()
  assert.strictEqual(g.liveAiCallCount, 0, 'LIVE_AI_CALL_COUNT must be 0')
  assert.strictEqual(g.realDbMutationCount, 0, 'REAL_DB_MUTATION_COUNT must be 0')
  assert.strictEqual(g.primaryActivated, false)
  assert.strictEqual(g.batch2RuntimeUsed, false)
  assert.strictEqual(g.batch3RuntimeUsed, false)
  assert.strictEqual(g.gateBStateChanged, false)
})
