#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/world-model-retry.test.js
 *
 * PAYMENT_STAGE5A_R10_7_EXPLICIT_REPLAY_CONTRACT — retry challenge (client side).
 *
 * Covers (client):
 *   RETRY_MODAL_PRESENT, RETRY_CONFIRM_MODAL_COPY,
 *   RETRY_ACTION_DOES_NOT_TOUCH_PAYMENT, RETRY_ACTION_PRESERVES_EXISTING_REPORT,
 *   RETRY_CALLS_SERVER_WITH_REPLAY_INTENT, RETRY_NAVIGATES_TO_CHALLENGE_PLAY,
 *   RETRY_NO_SWITCHTAB, RETRY_DOUBLE_TAP_GUARD, RETRY_FAIL_UI.
 *
 * Logic + source-asset only. No network / DB / payment / device claim.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const PREVIEW_JS = path.join(ROOT, 'pages', 'report-preview', 'report-preview.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE5A_R10_7 — RETRY (client)')

function loadPreview (behavior) {
  const b = behavior || {}
  const calls = []
  let page = null
  let resolveCloud = null
  const sandbox = {
    require: (req) => {
      if (req.indexOf('aiReportService') >= 0) return { generateAiReport: async () => ({ code: 0, data: {} }) }
      if (req.indexOf('analytics') >= 0) return { track: () => {}, flush: () => {} }
      if (req.indexOf('worldModelPosterContent') >= 0) return require(path.join(ROOT, 'utils', 'worldModelPosterContent.js'))
      if (req.indexOf('worldModelPosterRenderer') >= 0) return require(path.join(ROOT, 'utils', 'worldModelPosterRenderer.js'))
      throw new Error('unexpected require: ' + req)
    },
    Page: (c) => { page = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    wx: {
      navigateTo: (o) => {
        calls.push({ m: 'navigateTo', url: o.url })
        if (b.navFail) { o.fail && o.fail({ errMsg: 'navigateTo:fail' }); o.complete && o.complete() }
        else { o.success && o.success({}); o.complete && o.complete() }
      },
      redirectTo: (o) => calls.push({ m: 'redirectTo', url: o.url }),
      switchTab: (o) => calls.push({ m: 'switchTab', url: o.url }),
      showModal: (o) => calls.push({ m: 'showModal', opt: o }),
      showToast: (o) => calls.push({ m: 'showToast', opt: o }),
      showLoading: () => {}, hideLoading: () => {}, openSetting: () => {},
      cloud: {
        callFunction: (o) => {
          calls.push({ m: 'callFunction', name: o.name, data: o.data })
          if (b.cloudPending) return new Promise((res) => { resolveCloud = res })
          if (b.cloudFail) return Promise.resolve({ result: { code: 5000, message: 'boom' } })
          if (b.cloudNoRecord) return Promise.resolve({ result: { code: 0, data: {} } })
          if (b.cloudTrial) return Promise.resolve({ result: { code: 0, data: { recordId: 'CRnew', trialMode: true } } })
          return Promise.resolve({ result: { code: 0, data: { recordId: 'CRnew123', trialMode: false, unlocked: true } } })
        },
      },
    },
    getApp: () => ({ globalData: {} }),
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(PREVIEW_JS, 'utf8'), sandbox, { filename: PREVIEW_JS })
  const inst = Object.assign({}, page)
  inst.data = JSON.parse(JSON.stringify(page.data || {}))
  inst.setData = function (o) { Object.assign(this.data, o) }
  inst._calls = calls
  inst._resolveCloud = (v) => resolveCloud && resolveCloud(v)
  return inst
}
const modalOf = (p) => p._calls.find((c) => c.m === 'showModal')
const navCalls = (p) => p._calls.filter((c) => /navigateTo|redirectTo|switchTab/.test(c.m))
const tick = () => new Promise((r) => setTimeout(r, 0))

;(async () => {
  // ── RETRY_MODAL_PRESENT + copy ──
  {
    const p = loadPreview()
    p.onRetryChallenge()
    const modal = modalOf(p)
    ok(!!modal, 'RETRY_CONFIRM_MODAL_PRESENT')
    eq(modal.opt.title, '重新挑战一次？', 'modal title')
    ok(modal.opt.content.indexOf('当前挑战结果和世界模型报告都会保留') >= 0, 'modal copy states report preserved')
    ok(modal.opt.content.indexOf('不影响已购权益') >= 0, 'modal copy states entitlement intact')
    eq(modal.opt.cancelText, '取消', 'cancel text')
    eq(modal.opt.confirmText, '确认', 'confirm text')
    ok([...modal.opt.confirmText].length <= 4, 'confirm text <= 4 chars (wx.showModal limit)')
    ok([...modal.opt.cancelText].length <= 4, 'cancel text <= 4 chars (wx.showModal limit)')
    eq(navCalls(p).length, 0, 'no navigation before confirm')
    eq(p._calls.filter((c) => c.m === 'callFunction').length, 0, 'no server call before confirm')
  }

  // ── confirm → server replay intent + navigate challenge-play (NEW recordId) ──
  {
    const p = loadPreview()
    p.onRetryChallenge()
    modalOf(p).opt.success({ confirm: true })
    const cf = p._calls.find((c) => c.m === 'callFunction')
    ok(!!cf, 'confirm → server call made (OPTION_C)')
    eq(cf.name, 'startChallenge', 'calls startChallenge')
    eq(cf.data.replay, true, 'replay intent = true')
    eq(cf.data.mode, 'challenge', 'mode = challenge')
    ok(/^RP\d+_[a-z0-9]+$/.test(cf.data.replayRequestId), 'replayRequestId is a unique id')
    eq(cf.data.replaySource, 'world_model_report', 'replaySource tag')
    await tick()
    const nav = navCalls(p)[0]
    ok(!!nav, 'navigate called after server ok')
    eq(nav.m, 'navigateTo', 'uses wx.navigateTo (not switchTab)')
    ok(/\/pages\/challenge-play\/challenge-play\?mode=challenge&recordId=CRnew123/.test(nav.url), 'navigates to challenge-play with NEW recordId')
    eq(p.data.retryCreating, false, 'retryCreating reset after success')
  }

  // ── no switchTab anywhere in retry path ──
  {
    const p = loadPreview()
    p.onRetryChallenge()
    modalOf(p).opt.success({ confirm: true })
    await tick()
    eq(p._calls.filter((c) => c.m === 'switchTab').length, 0, 'REPLAY never uses switchTab')
    const body = (fs.readFileSync(PREVIEW_JS, 'utf8').split('onRetryChallenge() {')[1] || '').split('\n  },')[0]
    ok(!/switchTab/.test(body), 'retry handler source has no switchTab')
    ok(!/challenge-start/.test(body), 'retry handler no longer routes to challenge-start')
  }

  // ── cancel → zero server calls, zero records ──
  {
    const p = loadPreview()
    p.onRetryChallenge()
    modalOf(p).opt.success({ cancel: true })
    await tick()
    eq(p._calls.filter((c) => c.m === 'callFunction').length, 0, 'cancel → zero server calls')
    eq(navCalls(p).length, 0, 'cancel → zero navigation')
  }

  // ── double-tap guard: second confirm while creating is blocked ──
  {
    const p = loadPreview({ cloudPending: true })
    p.onRetryChallenge()
    modalOf(p).opt.success({ confirm: true })
    eq(p.data.retryCreating, true, 'retryCreating true in-flight')
    modalOf(p).opt.success({ confirm: true })   // second tap
    eq(p._calls.filter((c) => c.m === 'callFunction').length, 1, 'fast double tap → single server call')
  }

  // ── server failure → toast + reset (retry possible) ──
  {
    const p = loadPreview({ cloudFail: true })
    p.onRetryChallenge()
    modalOf(p).opt.success({ confirm: true })
    await tick()
    const toast = p._calls.find((c) => c.m === 'showToast')
    ok(!!toast, 'server fail → toast')
    eq(toast.opt.title, '无法开始新挑战，请重试', 'server fail toast copy')
    eq(p.data.retryCreating, false, 'retryCreating reset after failure')
    eq(navCalls(p).length, 0, 'no navigation on server failure')
  }

  // ── not-entitled (server returns trialMode true) → treated as failure ──
  {
    const p = loadPreview({ cloudTrial: true })
    p.onRetryChallenge()
    modalOf(p).opt.success({ confirm: true })
    await tick()
    ok(p._calls.some((c) => c.m === 'showToast'), 'trial replay → failure toast')
    eq(navCalls(p).length, 0, 'trial replay → no navigation (fail closed)')
    eq(p.data.retryCreating, false, 'reset after not-entitled')
  }

  // ── navigate failure → toast + reset ──
  {
    const p = loadPreview({ navFail: true })
    p.onRetryChallenge()
    modalOf(p).opt.success({ confirm: true })
    await tick()
    const toasts = p._calls.filter((c) => c.m === 'showToast')
    ok(toasts.some((t) => /无法进入挑战/.test(t.opt.title)), 'nav fail toast copy')
    eq(p.data.retryCreating, false, 'retryCreating reset after nav failure')
  }

  // ── payment regression (source) ──
  {
    const js = fs.readFileSync(PREVIEW_JS, 'utf8')
    ok(js.indexOf('createOrder') < 0, 'no createOrder in report-preview')
    ok(js.indexOf('requestPayment') < 0, 'no wx.requestPayment in report-preview')
    ok(js.indexOf('paymentFinalizer') < 0, 'no paymentFinalizer in report-preview')
    const body = (js.split('onRetryChallenge() {')[1] || '').split('\n  },')[0]
    ok(!/membership|createOrder|requestPayment|39\.9/i.test(body), 'retry handler has no payment chain')
  }

  // ── preservation: no report/state mutation on retry ──
  {
    const p = loadPreview()
    p.setData({ report: { reportId: 'ARCF_x', isPaid: true }, locked: false, reportData: { basicInsight: 'X' } })
    const snap = JSON.stringify({ r: p.data.report, l: p.data.locked, d: p.data.reportData })
    p.onRetryChallenge()
    modalOf(p).opt.success({ confirm: true })
    await tick()
    eq(JSON.stringify({ r: p.data.report, l: p.data.locked, d: p.data.reportData }), snap, 'RETRY_ACTION_PRESERVES_EXISTING_REPORT')
  }

  // ── poster regression ──
  {
    const js = fs.readFileSync(PREVIEW_JS, 'utf8')
    ok(/_generateWorldModelPoster\s*\(/.test(js), 'poster generator intact')
    ok(js.indexOf('_finishPosterGeneration') >= 0, 'poster unified cleanup intact')
    ok(/}, 4000\)/.test(js) && /}, 6000\)/.test(js), 'poster watchdogs intact')
    const p = loadPreview()
    ok(typeof p.generatePoster === 'function', 'generatePoster reachable')
  }

  console.log('\nworld-model-retry_TEST pass=*** fail=' + fail)
  process.exit(fail ? 1 : 0)
})()
