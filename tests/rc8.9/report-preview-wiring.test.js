#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/report-preview-wiring.test.js
 *
 * PAYMENT_STAGE5B_REPORT_9_9_WIRING_RESUME — deterministic client wiring checks.
 *
 * Static + simulated (vm) verification of the client wiring against the
 * verified server contracts. No network, no real DB, no charge.
 *
 *  Contracts asserted:
 *   • generateAiReport(type='challenge_final', recordId=<挑战记录ID>)  (recordId ≠ reportId)
 *   • 9.9 entry → membership?productId=report_9_9&recordId=<服务端reportId>
 *   • createOrder(productId='report_9_9', relatedId=<reportId>)
 *   • report_9_9 (unlike challenge_39_9) has NO default 39.9 fallback
 *   • missing reportId blocks order creation
 *
 *  Flows asserted (report-preview state machine):
 *   • ready(locked) → locked, summary only; 9.9 entry reachable
 *   • ready(unlocked) → locked=false
 *   • generating → status shown, bounded re-check, stops on unload
 *   • failed → explicit state + controlled retry; id stays stable
 *   • onGenerate passes the SERVER reportId (never the challenge recordId)
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const PREVIEW = path.join(ROOT, 'pages', 'report-preview', 'report-preview.js')
const MEMBERSHIP = path.join(ROOT, 'pages', 'membership', 'membership.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE5B report_9_9 client wiring')

// ── module stub map (by required suffix) ────────────────────────────────────
let CALLS = []
function makeRequire (stubs) {
  return function (req) {
    for (const k of Object.keys(stubs)) if (req.indexOf(k) >= 0) return stubs[k]
    throw new Error('unexpected require: ' + req)
  }
}

// ── Page harness: run a page source in a sandbox, capture config ─────────────
function loadPage (file, globals, stubs) {
  const src = fs.readFileSync(file, 'utf8')
  let config = null
  const timers = []
  let tid = 0
  const sandbox = Object.assign({
    require: makeRequire(stubs),
    Page: (c) => { config = c },
    Component: (c) => { config = c },
    console,
    Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
    setTimeout: (fn, ms) => { timers.push({ id: ++tid, fn, ms }); return tid },
    clearTimeout: (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1) },
    setInterval: () => 0, clearInterval: () => {},
    wx: {
      navigateTo: (o) => { CALLS.push({ m: 'navigateTo', url: o.url }) },
      redirectTo: (o) => { CALLS.push({ m: 'redirectTo', url: o.url }) },
      showToast: (o) => { CALLS.push({ m: 'showToast', title: o.title }) },
      showLoading: () => {}, hideLoading: () => {}, navigateBack: () => {},
      getStorageSync: () => '', setStorageSync: () => {}, removeStorageSync: () => {},
      createCanvasContext: () => ({}), canvasToTempFilePath: () => {},
      saveImageToPhotosAlbum: () => {}, openSetting: () => {}, showModal: () => {},
    },
  }, globals || {})
  vm.createContext(sandbox)
  vm.runInContext(src, sandbox, { filename: file })
  const inst = Object.assign({}, config)
  inst.data = JSON.parse(JSON.stringify(config.data || {}))
  inst.setData = function (o) { Object.assign(inst.data, o) }
  inst.selectComponent = () => ({ start () {}, finish () {} })
  inst._flushTimers = () => { const t = timers.splice(0, timers.length); t.forEach((x) => x.fn()) }
  inst._pendingTimers = () => timers.length
  return inst
}

// ═══════════════════════════════════════════════════════════════════════════
;(async () => {
  // ── membership page ──────────────────────────────────────────────────────
  function loadMembership (productList, createOrderImpl) {
    const paymentService = {
      getProductList: async () => productList,
      createOrder: createOrderImpl || (async (p, r) => { CALLS.push({ m: 'createOrder', p, r }); return { code: 0, data: { orderId: 'O1' } } }),
      requestPayment: async () => ({ success: true }),
      verifyPayment: async () => ({ code: 0, data: { status: 'paid' } }),
    }
    return loadPage(MEMBERSHIP, {}, {
      'services/paymentService.js': paymentService,
      'utils/userTrack.js': { event: () => {} },
    })
  }

  const SERVER_PRODUCTS = { code: 0, data: { products: [
    { productId: 'report_9_9', name: 'AI深度翻身报告', price: 990, originalPrice: 1990, type: 'single', permission: 'report_unlock' },
    { productId: 'challenge_39_9', name: '30天认知翻身挑战', price: 3990, originalPrice: 5990, type: 'single', permission: 'challenge_unlock' },
    { productId: 'vip_month_99', name: '月卡', price: 9900, type: 'membership', permission: 'vip' },
  ] } }

  // M1: report_9_9 + reportId → server price, no fallback
  {
    CALLS = []
    const m = loadMembership(SERVER_PRODUCTS)
    m.onLoad({ productId: 'report_9_9', recordId: 'ARCFabc123', source: 'report' })
    await new Promise((r) => setTimeout(r, 0))
    eq(m.data.productId, 'report_9_9', 'M1 productId')
    eq(m.data.recordId, 'ARCFabc123', 'M1 recordId = reportId')
    eq(m.data.blockedNoRecord, false, 'M1 not blocked')
    eq(m.data.product && m.data.product.productId, 'report_9_9', 'M1 product = report_9_9')
    eq(m.data.priceDisplay, '9.90', 'M1 price from server config (990→9.90)')
  }

  // M2: report_9_9 WITHOUT reportId → blocked, no product, no order
  {
    CALLS = []
    let createCalled = false
    const m = loadMembership(SERVER_PRODUCTS, async () => { createCalled = true; return { code: 0, data: {} } })
    m.onLoad({ productId: 'report_9_9', source: 'report' })
    await m.onPay()
    eq(m.data.blockedNoRecord, true, 'M2 blockedNoRecord set')
    eq(m.data.product, null, 'M2 no product loaded')
    ok(!createCalled, 'M2 createOrder NOT called')
  }

  // M3: report_9_9 not in server list → fail closed, NO 39.9 fallback
  {
    const m = loadMembership({ code: 0, data: { products: [
      { productId: 'challenge_39_9', name: 'x', price: 3990, type: 'single' },
    ] } })
    m.onLoad({ productId: 'report_9_9', recordId: 'ARCFxyz' })
    await new Promise((r) => setTimeout(r, 0))
    ok(!!m.data.loadError, 'M3 loadError set for report_9_9')
    eq(m.data.product, null, 'M3 no product (no 39.9 default)')
    ok(!(m.data.priceDisplay), 'M3 no fabricated price')
  }

  // M4: onPay report_9_9 → createOrder('report_9_9', <reportId>)
  {
    CALLS = []
    const m = loadMembership(SERVER_PRODUCTS)
    m.onLoad({ productId: 'report_9_9', recordId: 'ARCF_report_id' })
    await new Promise((r) => setTimeout(r, 0))
    await m.onPay()
    const co = CALLS.find((c) => c.m === 'createOrder')
    ok(!!co, 'M4 createOrder called')
    eq(co.p, 'report_9_9', 'M4 productId report_9_9')
    eq(co.r, 'ARCF_report_id', 'M4 relatedId = server reportId')
  }

  // M5: challenge_39_9 legacy fallback preserved (product found) + relatedId=recordId
  {
    CALLS = []
    const m = loadMembership(SERVER_PRODUCTS)
    m.onLoad({ productId: 'challenge_39_9', recordId: 'REC1', source: 'challenge' })
    await new Promise((r) => setTimeout(r, 0))
    eq(m.data.priceDisplay, '39.90', 'M5 39.9 price')
    await m.onPay()
    const co = CALLS.find((c) => c.m === 'createOrder')
    eq(co.p, 'challenge_39_9', 'M5 product challenge_39_9')
    eq(co.r, 'REC1', 'M5 relatedId = recordId')
  }

  // M6: challenge_39_9 missing-in-list keeps legacy local fallback (unchanged)
  {
    const m = loadMembership({ code: 0, data: { products: [] } })
    m.onLoad({ productId: 'challenge_39_9', recordId: 'REC1' })
    await new Promise((r) => setTimeout(r, 0))
    ok(m.data.product && m.data.product.productId === 'challenge_39_9', 'M6 legacy fallback preserved')
    eq(m.data.priceDisplay, '39.90', 'M6 fallback price 39.90')
  }

  // ── report-preview page ──────────────────────────────────────────────────
  function loadPreview (genImpl, opt) {
    const calls = []
    const aiReportService = {
      generateAiReport: (type, recordId) => { calls.push({ type, recordId }); return genImpl(type, recordId, calls.length) },
      getAiReport: async () => ({ code: 0, data: {} }),
    }
    const permissionService = { checkPermission: async () => ({ granted: (opt && opt.granted) === true }) }
    const inst = loadPage(PREVIEW, { getApp: () => ({ globalData: {} }) }, {
      'services/aiReportService.js': aiReportService,
      'services/permissionService.js': permissionService,
      'utils/analytics.js': { track: () => {}, flush: () => {} },
    })
    inst._calls = calls
    return inst
  }

  const READY_LOCKED = { code: 0, data: { reportId: 'ARCF_1', reportType: 'challenge_final', locked: true, isPaid: false, summary: { oneSentence: 'S1', worldModelType: 'W', turnaroundProbability: 42 } } }
  const READY_PAID = { code: 0, data: { reportId: 'ARCF_1', reportType: 'challenge_final', locked: false, isPaid: true, content: { oneSentence: 'S1', worldModelType: 'W', turnaroundProbability: 42, finalStrike: 'F' } } }
  const GENERATING = { code: 0, data: { reportId: 'ARCF_1', status: 'generating', locked: true, isPaid: false } }
  const AIFAIL = { code: 10008, message: 'AI 调用失败' }

  // P1: first load ready(locked) → summary, locked, 9.9 entry reachable
  {
    CALLS = []
    const p = loadPreview(async () => READY_LOCKED)
    p.setData({ recordId: 'REC1', reportType: 'challenge_final' })
    await p._requestChallengeReport()
    eq(p._calls[0].type, 'challenge_final', 'P1 calls generateAiReport challenge_final')
    eq(p._calls[0].recordId, 'REC1', 'P1 passes challenge recordId')
    eq(p.data.cfState, 'ready', 'P1 state ready')
    eq(p.data.locked, true, 'P1 locked true (from server)')
    eq(p.data.cfReportId, 'ARCF_1', 'P1 server reportId stored')
    ok(p.data.cfSummaryText, 'P1 summary text present')
    // 9.9 entry → membership?productId=report_9_9&recordId=<reportId>
    p.onGenerate()
    const nav = CALLS.find((c) => c.m === 'navigateTo')
    ok(!!nav, 'P1 navigates on 9.9 entry')
    ok(nav.url.indexOf('/pages/membership/membership') >= 0, 'P1 → membership page')
    ok(nav.url.indexOf('productId=report_9_9') >= 0, 'P1 → productId=report_9_9')
    ok(nav.url.indexOf('recordId=' + encodeURIComponent('ARCF_1')) >= 0, 'P1 → recordId = server reportId (NOT challenge recordId)')
    ok(nav.url.indexOf('REC1') < 0, 'P1 never leaks challenge recordId as relatedId')
  }

  // P2: ready(unlocked) → locked=false; onGenerate not applicable (goFull path)
  {
    const p = loadPreview(async () => READY_PAID)
    p.setData({ recordId: 'REC1', reportType: 'challenge_final' })
    await p._requestChallengeReport()
    eq(p.data.locked, false, 'P2 unlocked (server)')
    eq(p.data.cfState, 'ready', 'P2 ready')
  }

  // P3: generating → state generating + bounded re-check scheduled
  {
    let n = 0
    const p = loadPreview(async () => (n++ === 0 ? GENERATING : READY_LOCKED))
    p.setData({ recordId: 'REC1', reportType: 'challenge_final' })
    await p._requestChallengeReport()
    eq(p.data.cfState, 'generating', 'P3 state generating')
    eq(p.data.cfReportId, 'ARCF_1', 'P3 reportId stable while generating')
    ok(p._pendingTimers() >= 1, 'P3 re-check scheduled')
    // flush the poll → second call returns ready
    await (async () => { p._flushTimers() })()
    await new Promise((r) => setTimeout(r, 0))
    // _flushTimers triggers _requestChallengeReport (async, not awaited) — give it a tick
    await new Promise((r) => setTimeout(r, 0))
    eq(p.data.cfState, 'ready', 'P3 transitions to ready after recheck')
  }

  // P4: generating bounded — never exceeds CF_MAX_POLLS; client budget is
  // exhausted → NEUTRAL "still generating" state (not a false server failure)
  {
    const p = loadPreview(async () => GENERATING)
    p.setData({ recordId: 'REC1', reportType: 'challenge_final' })
    await p._requestChallengeReport()
    for (let i = 0; i < 40; i++) { p._flushTimers(); await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)) }
    eq(p.data.cfState, 'failed', 'P4 gives up (failed) after bound')
    eq(p.data.cfSoftTimeout, true, 'P4 soft-timeout flag set (server may still generate)')
    ok(/仍在生成中/.test(p.data.cfMsg), 'P4 neutral still-generating message')
    ok(p._calls.length <= 1 + 24, 'P4 bounded request count (<= 25)')
  }

  // P5: unload stops re-check
  {
    const p = loadPreview(async () => GENERATING)
    p.setData({ recordId: 'REC1', reportType: 'challenge_final' })
    await p._requestChallengeReport()
    const before = p._calls.length
    p.onUnload()
    p._flushTimers()
    await new Promise((r) => setTimeout(r, 0))
    eq(p._calls.length, before, 'P5 no further requests after unload')
  }

  // P6: failed (AI error) → explicit state + controlled retry, id stable
  {
    let n = 0
    const p = loadPreview(async () => (n++ === 0 ? AIFAIL : READY_LOCKED))
    p.setData({ recordId: 'REC1', reportType: 'challenge_final' })
    await p._requestChallengeReport()
    eq(p.data.cfState, 'failed', 'P6 failed state')
    ok(!!p.data.cfMsg, 'P6 failure message shown')
    // onGenerate while failed must NOT navigate
    CALLS = []
    p.onGenerate()
    ok(!CALLS.find((c) => c.m === 'navigateTo'), 'P6 no 9.9 entry while failed')
    // controlled retry → ready
    await p.onRetryReport()
    await new Promise((r) => setTimeout(r, 0))
    eq(p.data.cfState, 'ready', 'P6 recovers on retry')
    eq(p._calls[0].recordId, p._calls[1].recordId, 'P6 same challenge recordId across retry')
  }

  // P7: missing recordId → error state, no request
  {
    const p = loadPreview(async () => READY_LOCKED)
    p.setData({ recordId: '', reportType: 'challenge_final' })
    p._startChallengeFinal()
    eq(p.data.cfState, 'error', 'P7 error without recordId')
    eq(p._calls.length, 0, 'P7 no request issued')
  }

  // P8: onGenerate fail-closed when not ready
  {
    const p = loadPreview(async () => GENERATING)
    p.setData({ recordId: 'REC1', reportType: 'challenge_final', cfState: 'generating' })
    CALLS = []
    p.onGenerate()
    ok(!CALLS.find((c) => c.m === 'navigateTo'), 'P8 no navigation while generating')
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAYMENT_STAGE5A_R4_P0_REPORT_RECOVERY — FIX-2 client polling matrix
  //   T1 polls beyond the old 30s cap without premature failure
  //   T2 stops immediately at ready
  //   T3 stops immediately at server-side failed (+ controlled retry)
  //   T4 unload cancels polling
  //   T5 no duplicate poll loops (at most one live timer)
  // ═══════════════════════════════════════════════════════════════════════

  // T1: polls beyond 30s (>=7 polls) and only then becomes ready
  {
    let n = 0
    const p = loadPreview(async () => (n++ < 8 ? GENERATING : READY_LOCKED))
    p.setData({ recordId: 'REC1', reportType: 'challenge_final' })
    await p._requestChallengeReport()
    for (let i = 0; i < 7; i++) { p._flushTimers(); await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)) }
    eq(p.data.cfState, 'generating', 'T1 still generating after >30s (no premature fail)')
    ok(p.data.cfPollCount >= 7, 'T1 polled >= 7 times (>=35s budget)')
    p._flushTimers(); await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0))
    eq(p.data.cfState, 'ready', 'T1 becomes ready after extended polling')
  }

  // T2: ready → polling stops immediately (no pending timer, no extra call)
  {
    const p = loadPreview(async () => READY_LOCKED)
    p.setData({ recordId: 'REC1', reportType: 'challenge_final' })
    await p._requestChallengeReport()
    eq(p.data.cfState, 'ready', 'T2 ready')
    const calls = p._calls.length
    eq(p._pendingTimers(), 0, 'T2 no pending timer at ready')
    p._flushTimers(); await new Promise((r) => setTimeout(r, 0))
    eq(p._calls.length, calls, 'T2 no further request after ready')
  }

  // T3: server-side explicit failed → stops immediately + controlled retry
  {
    let n = 0
    const p = loadPreview(async () => (n++ === 0 ? { code: 0, data: { reportId: 'ARCF_1', status: 'failed', locked: true } } : READY_LOCKED))
    p.setData({ recordId: 'REC1', reportType: 'challenge_final' })
    await p._requestChallengeReport()
    eq(p.data.cfState, 'failed', 'T3 server status:failed → failed state')
    eq(p.data.cfSoftTimeout, false, 'T3 not a client soft-timeout')
    eq(p._pendingTimers(), 0, 'T3 no pending timer after failed')
    await p.onRetryReport()
    await new Promise((r) => setTimeout(r, 0))
    eq(p.data.cfState, 'ready', 'T3 controlled retry recovers')
  }

  // T4: unload cancels polling
  {
    const p = loadPreview(async () => GENERATING)
    p.setData({ recordId: 'REC1', reportType: 'challenge_final' })
    await p._requestChallengeReport()
    const before = p._calls.length
    p.onUnload()
    eq(p._pendingTimers(), 0, 'T4 unload clears pending timer')
    p._flushTimers(); await new Promise((r) => setTimeout(r, 0))
    eq(p._calls.length, before, 'T4 no further requests after unload')
  }

  // T5: no duplicate poll loops (single live timer even under re-entry)
  {
    const p = loadPreview(async () => GENERATING)
    p.setData({ recordId: 'REC1', reportType: 'challenge_final' })
    await p._requestChallengeReport()
    // re-entry without unload must not stack timers
    p._schedulePoll(); p._schedulePoll(); p._schedulePoll()
    eq(p._pendingTimers(), 1, 'T5 at most one live poll timer')
    for (let i = 0; i < 5; i++) { p._flushTimers(); await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)) }
    eq(p._pendingTimers(), 1, 'T5 still single timer after several polls')
    // bounded: never runs away
    ok(p._calls.length <= 1 + 24, 'T5 bounded call count')
  }

  console.log(`\nreport-preview-wiring_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
