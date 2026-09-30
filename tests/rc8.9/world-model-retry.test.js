#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/world-model-retry.test.js
 *
 * PAYMENT_STAGE5A_R10_WORLD_MODEL_REPORT_PAGE_PRODUCTIZATION — retry challenge.
 *
 * Covers:
 *   RETRY_CONFIRM_MODAL_PRESENT, RETRY_ACTION_DOES_NOT_TOUCH_PAYMENT,
 *   RETRY_ACTION_PRESERVES_EXISTING_REPORT, RETRY_ACTION_USES_CANONICAL_ENTRY.
 *
 * Logic + source-asset only. No network / DB / payment / device claim.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const PREVIEW_JS = path.join(ROOT, 'pages', 'report-preview', 'report-preview.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE5A_R10 — RETRY')

function loadPreview () {
  const calls = []
  let page = null
  const sandbox = {
    require: (req) => {
      if (req.indexOf('aiReportService') >= 0) return { generateAiReport: async () => ({ code: 0, data: {} }) }
      if (req.indexOf('analytics') >= 0) return { track: () => {}, flush: () => {} }
      if (req.indexOf('worldModelPosterContent') >= 0) return require(path.join(ROOT, 'utils', 'worldModelPosterContent.js'))
      if (req.indexOf('worldModelPosterRenderer') >= 0) return require(path.join(ROOT, 'utils', 'worldModelPosterRenderer.js'))
      throw new Error('unexpected require: ' + req)
    },
    Page: (c) => { page = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    wx: {
      navigateTo: (o) => calls.push({ m: 'navigateTo', url: o.url }),
      redirectTo: (o) => calls.push({ m: 'redirectTo', url: o.url }),
      switchTab: (o) => { calls.push({ m: 'switchTab', url: o.url }); o.fail && o.fail({ errMsg: 'x' }) },
      showModal: (o) => calls.push({ m: 'showModal', opt: o }),
      showToast: () => {}, showLoading: () => {}, hideLoading: () => {}, openSetting: () => {},
    },
    getApp: () => ({ globalData: {} }),
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(PREVIEW_JS, 'utf8'), sandbox, { filename: PREVIEW_JS })
  const inst = Object.assign({}, page)
  inst.data = JSON.parse(JSON.stringify(page.data || {}))
  inst.setData = function (o) { Object.assign(inst.data, o) }
  inst._calls = calls
  return inst
}

// ── RETRY_CONFIRM_MODAL_PRESENT ──
{
  const p = loadPreview()
  const before = p.data.report
  p.onRetryChallenge()
  const modal = p._calls.find((c) => c.m === 'showModal')
  ok(!!modal, 'RETRY_CONFIRM_MODAL_PRESENT (showModal called)')
  eq(modal.opt.title, '重新挑战一次？', 'modal title')
  ok(modal.opt.content.indexOf('当前报告会继续保留') >= 0, 'modal content mentions report preserved')
  ok(modal.opt.content.indexOf('不影响已购权益') >= 0, 'modal content mentions entitlement untouched')
  eq(modal.opt.cancelText, '取消', 'cancel text')
  eq(modal.opt.confirmText, '确认重新挑战', 'confirm text')
  // no navigation until confirmed
  eq(p._calls.filter((c) => /navigateTo|redirectTo|switchTab/.test(c.m)).length, 0, 'no navigation before confirm')
}

// ── RETRY_ACTION_USES_CANONICAL_ENTRY + does NOT touch payment ──
// challenge-start is a tabBar page -> wx.switchTab is the only API that works.
{
  const p = loadPreview()
  const calls = p._calls
  p.onRetryChallenge()
  const modal = calls.find((c) => c.m === 'showModal')
  const navBefore = calls.filter((c) => /navigateTo|redirectTo|switchTab/.test(c.m)).length
  modal.opt.success({ confirm: true })
  const navAfter = calls.filter((c) => /navigateTo|redirectTo|switchTab/.test(c.m))
  eq(navAfter.length, navBefore + 1, 'confirm triggers exactly one route')
  const target = navAfter[navAfter.length - 1]
  ok(target.m === 'switchTab', 'RETRY uses switchTab for tabBar target')
  ok(target.url.indexOf('/pages/challenge-start/challenge-start') >= 0, 'RETRY_ACTION_USES_CANONICAL_ENTRY (challenge-start)')
  ok(!/membership|createOrder|pay/i.test(target.url), 'route is not a payment route')
  ok(!calls.some((c) => /report_9_9|membership/.test(c.url || '')), 'RETRY_ACTION_DOES_NOT_TOUCH_PAYMENT (no membership/report route)')
}

// ── cancel does nothing ──
{
  const p = loadPreview()
  p.onRetryChallenge()
  const modal = p._calls.find((c) => c.m === 'showModal')
  modal.opt.success({ confirm: false })
  eq(p._calls.filter((c) => /navigateTo|redirectTo|switchTab/.test(c.m)).length, 0, 'cancel performs no navigation')
}

// ── RETRY_ACTION_PRESERVES_EXISTING_REPORT (no report mutation) ──
{
  const p = loadPreview()
  p.setData({ report: { reportId: 'ARCF_x', isPaid: true }, locked: false, reportData: { basicInsight: 'X' } })
  const snapshot = JSON.stringify({ report: p.data.report, locked: p.data.locked, reportData: p.data.reportData })
  p.onRetryChallenge()
  const modal = p._calls.find((c) => c.m === 'showModal')
  modal.opt.success({ confirm: true })
  eq(JSON.stringify({ report: p.data.report, locked: p.data.locked, reportData: p.data.reportData }), snapshot, 'RETRY_ACTION_PRESERVES_EXISTING_REPORT (no state mutation)')
}

// ── source-level: no payment chain references ──
{
  const js = fs.readFileSync(PREVIEW_JS, 'utf8')
  ok(js.indexOf('createOrder') < 0, 'no createOrder')
  ok(js.indexOf('verifyPayment') < 0, 'no verifyPayment')
  ok(js.indexOf('paymentFinalizer') < 0, 'no paymentFinalizer')
  ok(js.indexOf('/pages/challenge-start/challenge-start') >= 0, 'canonical start route referenced')
  ok(/switchTab\(\{[^}]*challenge-start/.test(js), 'switchTab used for challenge-start (tabBar page)')
}

console.log(`\nworld-model-retry_TEST pass=*** fail=${fail}`)
process.exit(fail ? 1 : 0)
