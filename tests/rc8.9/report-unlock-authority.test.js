#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/report-unlock-authority.test.js
 *
 * PAYMENT_STAGE5A_R8_P0_CANONICAL_REPORT_UNLOCK — deterministic authority checks.
 *
 * Proves the SINGLE canonical report-access authority and the removal of the
 * client's second (membership-only) gate that caused:
 *   "已购 ¥9.90 报告仍显示锁 + 9.9 CTA + 立即升级"（付款后不渲染）。
 *
 * No network / no real DB / no payment / no DB mutation.
 *
 * REQUIRED MATRIX (task §9):
 *   A  report.isPaid=false + no VIP           → locked=true
 *   B  report.isPaid=true  + membership free   → locked=false + full visible
 *   C  report.isPaid=false + valid VIP         → locked=false
 *   D  server locked=false → client cannot overwrite to true
 *   E  paid report re-entry → re-fetch → unlocked
 *   F  post-payment navigateBack → onShow re-fetch → unlocked
 *   G  paid report → 9.9 CTA hidden
 *   H  paid report → upgrade CTA hidden
 *   I  paid report → no second createOrder
 *   J  same reportId retained
 *   K  challenge_final does not route through legacy V6 authorization
 *   L  unpaid report remains fail-closed
 */

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const COMMON = path.join(ROOT, 'cloudfunctions', 'common', 'reportAccess.js')
const GEN_COPY = path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'reportAccess.js')
const GET_COPY = path.join(ROOT, 'cloudfunctions', 'getAiReport', 'lib', 'reportAccess.js')
const IDEM = path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'challengeReportIdempotency.js')
const GET_INDEX = path.join(ROOT, 'cloudfunctions', 'getAiReport', 'index.js')
const PREVIEW_JS = path.join(ROOT, 'pages', 'report-preview', 'report-preview.js')
const PREVIEW_WXML = path.join(ROOT, 'pages', 'report-preview', 'report-preview.wxml')

// ── real paid-report fixture metadata (READ-ONLY; never mutated) ──
const FIXTURE_REPORT_ID = 'ARCF9bc1766a2b0fbbcdfc0cdc3f'
const FIXTURE_RECORD_ID = 'CR1790632776226vtmih6'
const FIXTURE_OPENID = 'oZa463Yb2VY0k9Es_pGzdHFtigNo'
const FIXTURE_CONTENT = {
  oneSentence: '认知已觉醒，杠杆未拉满',
  worldModelType: 'normal_awakened',
  whyNotRich: '你被困在单点收入结构里',
  biggestCognitiveGap: '认知红利未变现',
  turnaroundProbability: 72,
  threeYearRisk: '路径依赖风险',
  bestPath: '把认知打包成可交付资产',
  thirtyDayActions: ['重写价值主张', '做一次公开输出'],
  finalStrike: '别让系统替你结算人生',
}

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))
const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')

console.log('PAYMENT_STAGE5A_R8_P0 canonical report unlock authority')

// ═══════════════════════════════════════════════════════════════════════════
// §1 — canonical authority module + byte-identical copies
// ═══════════════════════════════════════════════════════════════════════════
{
  ok(fs.existsSync(COMMON), 'canonical reportAccess.js exists')
  ok(fs.existsSync(GEN_COPY), 'generateAiReport copy exists')
  ok(fs.existsSync(GET_COPY), 'getAiReport copy exists')
  eq(sha256(COMMON), sha256(GEN_COPY), 'generateAiReport copy byte-identical')
  eq(sha256(COMMON), sha256(GET_COPY), 'getAiReport copy byte-identical')

  const RA = require(COMMON)
  ok(typeof RA.canAccessFullReport === 'function', 'exports canAccessFullReport')
  ok(typeof RA.resolveReportAccess === 'function', 'exports resolveReportAccess')
  ok(typeof RA.reportAccessFields === 'function', 'exports reportAccessFields')

  // A: isPaid=false + no VIP → locked
  const a = RA.resolveReportAccess({ isPaid: false }, false)
  eq(a.locked, true, 'A unpaid+noVIP → locked')
  eq(a.canViewFullReport, false, 'A unpaid+noVIP → cannot view full')
  eq(a.accessSource, 'NONE', 'A accessSource NONE')

  // B: isPaid=true + membership free (vipGranted=false) → unlocked
  const b = RA.resolveReportAccess({ isPaid: true }, false)
  eq(b.locked, false, 'B paid+free-membership → unlocked')
  eq(b.canViewFullReport, true, 'B paid+free-membership → can view full')
  eq(b.accessSource, 'REPORT_IS_PAID', 'B authority = REPORT_IS_PAID (not membership)')

  // C: isPaid=false + VIP → unlocked
  const c = RA.resolveReportAccess({ isPaid: false }, true)
  eq(c.locked, false, 'C unpaid+VIP → unlocked')
  eq(c.canViewFullReport, true, 'C unpaid+VIP → can view full')
  eq(c.accessSource, 'VIP_AUTHORITY', 'C authority = VIP')

  // report.isPaid must NEVER be overridden by membershipLevel free
  ok(RA.canAccessFullReport({ isPaid: true }, false) === true, 'REPORT_IS_PAID never overridden by free')
  // fail-closed defaults
  ok(RA.canAccessFullReport(null, false) === false, 'null entity fail-closed')
  ok(RA.canAccessFullReport({}, undefined) === false, 'empty entity fail-closed')
  ok(RA.canAccessFullReport({ isPaid: 'true' }, false) === false, 'string "true" is NOT paid (strict)')
  ok(RA.canAccessFullReport({ isPaid: true }, undefined) === true, 'paid alone sufficient')
}

// ═══════════════════════════════════════════════════════════════════════════
// §2 — server owns locked (generateAiReport idempotent ready path)
// ═══════════════════════════════════════════════════════════════════════════
function makeDB ({ reports, records }) {
  function match (name, q) {
    if (name === 'challenge_records') {
      return records.filter((r) => Object.keys(q).every((k) => r[k] === q[k]))
    }
    if (name === 'ai_reports') {
      return reports.filter((r) => Object.keys(q).every((k) => r[k] === q[k]))
    }
    return []
  }
  return {
    command: { set: (v) => ({ __op: 'set', value: v }), in: (a) => ({ __op: 'in', value: a }) },
    collection (name) {
      const st = { name, where: null, limit: null, data: undefined }
      const api = {
        where (w) { st.where = w; return api },
        limit (n) { st.limit = n; return api },
        async get () { const d = match(st.name, st.where || {}); return { data: st.limit ? d.slice(0, st.limit) : d } },
        async update () { return { stats: { updated: 1 } } },
        async add () { return { _id: 'x' } },
      }
      return api
    },
  }
}

async function runReady (reportEntity, vipGranted) {
  delete require.cache[require.resolve(IDEM)]
  const { runChallengeFinalReport } = require(IDEM)
  const db = makeDB({
    reports: [reportEntity],
    records: [{ recordId: FIXTURE_RECORD_ID, openid: FIXTURE_OPENID }],
  })
  return runChallengeFinalReport({
    db,
    openid: FIXTURE_OPENID,
    event: { recordId: FIXTURE_RECORD_ID },
    ts: Date.now(),
    deps: {
      checkVip: async () => vipGranted,
      callAI: async () => ({ success: false, error: 'must-not-be-called' }),
      buildReportPrompt: () => ({ systemPrompt: '', userMessage: '' }),
      emitModelCall: () => Promise.resolve(),
      staleMs: 90000,
    },
  })
}

;(async () => {
  const READY_PAID = {
    _id: FIXTURE_REPORT_ID, reportId: FIXTURE_REPORT_ID, openid: FIXTURE_OPENID,
    type: 'challenge_final', recordId: FIXTURE_RECORD_ID, status: 'ready',
    isPaid: true, content: FIXTURE_CONTENT,
  }
  const READY_UNPAID = Object.assign({}, READY_PAID, { isPaid: false })

  // B: paid + membership free → locked=false, full content, canViewFullReport
  {
    const r = await runReady(READY_PAID, false)
    eq(r.code, 0, 'B server ok')
    eq(r.data.locked, false, 'B server locked=false (isPaid)')
    eq(r.data.isPaid, true, 'B server isPaid=true')
    eq(r.data.canViewFullReport, true, 'B server canViewFullReport=true')
    ok(!!(r.data.content && r.data.content.oneSentence), 'B server full content present')
    eq(r.data.reportId, FIXTURE_REPORT_ID, 'B server reportId retained')
  }

  // A / L: unpaid + no VIP → locked=true, summary only (fail-closed)
  {
    const r = await runReady(READY_UNPAID, false)
    eq(r.data.locked, true, 'A/L server locked=true')
    eq(r.data.isPaid, false, 'A/L server isPaid=false')
    eq(r.data.canViewFullReport, false, 'A/L server canViewFullReport=false')
    ok(!r.data.content, 'A/L no full content when locked')
    ok(!!r.data.summary, 'A/L summary teaser only')
  }

  // C: unpaid + VIP → locked=false
  {
    const r = await runReady(READY_UNPAID, true)
    eq(r.data.locked, false, 'C server locked=false (VIP)')
    eq(r.data.canViewFullReport, true, 'C server canViewFullReport=true (VIP)')
    ok(!!(r.data.content && r.data.content.oneSentence), 'C server full content present (VIP)')
  }

  // D: server response for paid is authoritative; client must not flip it.
  {
    const r = await runReady(READY_PAID, false)
    ok(r.data.locked === false && r.data.canViewFullReport === true, 'D server authority = unlocked')
  }

  // getAiReport uses the canonical resolver + returns canViewFullReport
  {
    const src = fs.readFileSync(GET_INDEX, 'utf8')
    ok(/require\(['"]\.\/lib\/reportAccess\.js['"]\)/.test(src), 'getAiReport requires canonical reportAccess')
    ok(/resolveReportAccess\(/.test(src), 'getAiReport uses resolveReportAccess')
    ok(/canViewFullReport/.test(src), 'getAiReport returns canViewFullReport')
    ok(!/if\s*\(isVip\s*\|\|\s*report\.isPaid\)/.test(src), 'getAiReport no longer membership-first branch')
  }

  // ═════════════════════════════════════════════════════════════════════════
  // §3 — client rendering: single authority, no second gate
  // ═════════════════════════════════════════════════════════════════════════
  let CALLS = []
  function makeRequire (stubs) {
    return function (req) {
      for (const k of Object.keys(stubs)) if (req.indexOf(k) >= 0) return stubs[k]
      throw new Error('unexpected require (client should not require this): ' + req)
    }
  }
  function loadPreview (genImpl) {
    const calls = []
    const aiReportService = {
      generateAiReport: (type, recordId) => { calls.push({ type, recordId }); return genImpl(type, recordId) },
      getAiReport: async () => ({ code: 0, data: {} }),
    }
    const timers = []; let tid = 0
    const src = fs.readFileSync(PREVIEW_JS, 'utf8')
    let config = null
    const sandbox = {
      require: makeRequire({
        'services/aiReportService.js': aiReportService,
        'utils/analytics.js': { track: () => {}, flush: () => {} },
      }),
      Page: (c) => { config = c },
      Component: (c) => { config = c },
      console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
      setTimeout: (fn, ms) => { timers.push({ id: ++tid, fn, ms }); return tid },
      clearTimeout: (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1) },
      setInterval: () => 0, clearInterval: () => {},
      getApp: () => ({ globalData: {} }),
      wx: {
        navigateTo: (o) => { CALLS.push({ m: 'navigateTo', url: o.url }) },
        redirectTo: (o) => { CALLS.push({ m: 'redirectTo', url: o.url }) },
        showToast: (o) => { CALLS.push({ m: 'showToast', title: o.title }) },
        showLoading: () => {}, hideLoading: () => {}, navigateBack: () => {},
        getStorageSync: () => '', setStorageSync: () => {}, removeStorageSync: () => {},
        createCanvasContext: () => ({}), canvasToTempFilePath: () => {},
        saveImageToPhotosAlbum: () => {}, openSetting: () => {}, showModal: () => {},
      },
    }
    vm.createContext(sandbox)
    vm.runInContext(src, sandbox, { filename: PREVIEW_JS })
    const inst = Object.assign({}, config)
    inst.data = JSON.parse(JSON.stringify(config.data || {}))
    inst.setData = function (o) { Object.assign(inst.data, o) }
    inst._calls = calls
    return inst
  }

  const LOCKED = { code: 0, data: { reportId: FIXTURE_REPORT_ID, reportType: 'challenge_final', isPaid: false, locked: true, canViewFullReport: false, summary: { oneSentence: 'S', worldModelType: 'W', turnaroundProbability: 42 } } }
  const PAID = { code: 0, data: { reportId: FIXTURE_REPORT_ID, reportType: 'challenge_final', isPaid: true, locked: false, canViewFullReport: true, content: FIXTURE_CONTENT } }
  const VIP = { code: 0, data: { reportId: FIXTURE_REPORT_ID, reportType: 'challenge_final', isPaid: false, locked: false, canViewFullReport: true, content: FIXTURE_CONTENT } }

  // B: paid render → unlocked + full content bound
  {
    CALLS = []
    const p = loadPreview(async () => PAID)
    p.setData({ recordId: FIXTURE_RECORD_ID, reportType: 'challenge_final' })
    await p._requestChallengeReport()
    eq(p.data.locked, false, 'B client locked=false')
    eq(p.data.cfState, 'ready', 'B client ready')
    eq(p._calls[0].type, 'challenge_final', 'B client calls challenge_final')
    eq(p._calls[0].recordId, FIXTURE_RECORD_ID, 'B client passes challenge recordId')
    eq(p.data.cfReportId, FIXTURE_REPORT_ID, 'J client reportId retained')
    ok(p.data.reportData && p.data.reportData.basicInsight, 'B full content bound to reportData')
  }

  // A / L: unpaid render → locked stays true (fail-closed)
  {
    const p = loadPreview(async () => LOCKED)
    p.setData({ recordId: FIXTURE_RECORD_ID, reportType: 'challenge_final' })
    await p._requestChallengeReport()
    eq(p.data.locked, true, 'A/L client locked=true')
    eq(p.data.cfState, 'ready', 'A/L client ready (with lock)')
  }

  // C: VIP render (server locked=false) → unlocked
  {
    const p = loadPreview(async () => VIP)
    p.setData({ recordId: FIXTURE_RECORD_ID, reportType: 'challenge_final' })
    await p._requestChallengeReport()
    eq(p.data.locked, false, 'C client locked=false (VIP)')
  }

  // D: server locked=false must not become client locked=true
  {
    const p = loadPreview(async () => PAID)
    p.setData({ recordId: FIXTURE_RECORD_ID, reportType: 'challenge_final' })
    await p._requestChallengeReport()
    // simulate a stray secondary-check that would try to force lock
    eq(p.data.locked, false, 'D client cannot overwrite server unlocked')
    eq(p.requestFullReportAccess(), true, 'D requestFullReportAccess=true from server authority')
  }

  // E: paid report re-entry (fresh onLoad) → re-fetch → unlocked
  {
    const p = loadPreview(async () => PAID)
    p.setData({ recordId: FIXTURE_RECORD_ID, reportType: 'challenge_final' })
    p._startChallengeFinal()
    await new Promise((r) => setTimeout(r, 0))
    eq(p.data.locked, false, 'E re-entry unlocked after re-fetch')
  }

  // F: post-payment navigateBack → onShow re-fetches authoritative → unlocked
  {
    let n = 0
    const p = loadPreview(async () => (n++ === 0 ? LOCKED : PAID))
    p.setData({ recordId: FIXTURE_RECORD_ID, reportType: 'challenge_final' })
    await p._requestChallengeReport()
    eq(p.data.locked, true, 'F initial locked (pre-pay)')
    // return from membership: onShow (no transient _cfReturnFromPay needed)
    p.setData({ cfState: 'ready' })
    p._cfUnloaded = false
    const before = p._calls.length
    p.onShow()
    await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0))
    ok(p._calls.length === before + 1, 'F onShow re-fetched authoritative state')
    eq(p.data.locked, false, 'F post-pay unlocked after onShow re-fetch')
  }

  // F2: first onShow after onLoad must NOT duplicate the initial request
  {
    const p = loadPreview(async () => PAID)
    p.setData({ recordId: FIXTURE_RECORD_ID, reportType: 'challenge_final' })
    p._cfSuppressNextShow = true
    p._startChallengeFinal()
    await new Promise((r) => setTimeout(r, 0))
    const before = p._calls.length
    p.onShow()
    eq(p._calls.length, before, 'F2 first onShow suppressed (no duplicate generation)')
  }

  // I: paid report → no second createOrder / no membership navigation from full-report path
  {
    const p = loadPreview(async () => PAID)
    p.setData({ recordId: FIXTURE_RECORD_ID, reportType: 'challenge_final' })
    await p._requestChallengeReport()
    CALLS = []
    const r = p.goFull()
    ok(r === true, 'I goFull returns true when unlocked')
    ok(!CALLS.some((c) => c.m === 'navigateTo'), 'I goFull does NOT navigate away (renders in place)')
    ok(!CALLS.some((c) => c.m === 'createOrder'), 'I no createOrder from goFull')
    eq(p.data.showUpgradeModal, false, 'I no upgrade modal for paid report')
  }

  // G/H: WXML hides 9.9 CTA + lock card + upgrade modal when unlocked
  {
    const w = fs.readFileSync(PREVIEW_WXML, 'utf8')
    ok(/wx:if="\{\{locked\}\}"[^>]*text="9\.9元解锁完整报告"/.test(w) || (w.indexOf('9.9元解锁完整报告') >= 0 && /wx:if="\{\{locked\}\}"/.test(w)), 'G 9.9 CTA gated by locked')
    ok(/report-lock-card\s+wx:if="\{\{locked\}\}"/.test(w), 'H lock card gated by locked')
    ok(/wx:if="\{\{showUpgradeModal && locked\}\}"/.test(w), 'H upgrade modal gated by (showUpgradeModal && locked)')
    ok(/wx:if="\{\{!locked\}\}"/.test(w), 'full-content block gated by !locked')
  }

  // K: challenge_final does not route through legacy V6 report-detail authorization
  {
    const src = fs.readFileSync(PREVIEW_JS, 'utf8')
    ok(src.indexOf('/pages/report-detail') < 0, 'K report-preview no longer routes to legacy report-detail')
    ok(!/permissionService/.test(src), 'K client second authority (permissionService) removed')
    ok(!/FULL_REPORT_PERMISSION_KEY/.test(src), 'K membership-only full_report gate removed')
    ok(/locked: \(d\.canViewFullReport === true\)/.test(src), 'client locked derived from server canViewFullReport')
  }

  console.log(`\nreport-unlock-authority_TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
