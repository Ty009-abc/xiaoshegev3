#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/replay-observability.test.js
 *
 * RC8_9_P0_REPLAY_OBSERVABILITY — telemetry-only instrumentation of the
 * "重新挑战一次" handler. Proves the 7 events fire on each branch AND that the
 * replay business contract is byte-identical.
 *
 *  A  tap handler      → challenge_retry_tap
 *  B  modal confirm    → challenge_retry_modal_confirm
 *  C  cloud call sent  → challenge_retry_request_sent
 *  D  success          → challenge_retry_request_success
 *  E  fail             → challenge_retry_request_fail + toast
 *  F  nav success      → challenge_retry_nav_success
 *  G  nav fail         → challenge_retry_nav_fail + toast
 *  H  contract unchanged: mode=challenge, replay=true, replayRequestId present,
 *     replaySource=world_model_report (no switchTab / no payment)
 *
 * Logic + source-asset only. No network / DB / device claim.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const PREVIEW_JS = path.join(ROOT, 'pages', 'report-preview', 'report-preview.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_9_P0_REPLAY_OBSERVABILITY')

function load (behavior) {
  const b = behavior || {}
  const events = []
  const calls = []
  let page = null
  let resolveCloud = null
  const sandbox = {
    require: (req) => {
      if (req.indexOf('aiReportService') >= 0) return { generateAiReport: async () => ({ code: 0, data: {} }) }
      if (req.indexOf('analytics') >= 0) return { track: (e) => events.push(e), flush: () => {} }
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
  inst._events = events
  inst._calls = calls
  return inst
}
const modalOf = (p) => p._calls.find((c) => c.m === 'showModal')
const has = (p, e) => p._events.indexOf(e) >= 0
const tick = () => new Promise((r) => setTimeout(r, 0))

;(async () => {
  // ── A ──
  {
    const p = load()
    p.onRetryChallenge()
    ok(has(p, 'challenge_retry_tap'), 'A: challenge_retry_tap emitted on tap')
    ok(!has(p, 'challenge_retry_modal_confirm'), 'A: no confirm event before confirm')
  }
  // ── B ──
  {
    const p = load()
    p.onRetryChallenge()
    modalOf(p).opt.success({ confirm: true })
    ok(has(p, 'challenge_retry_modal_confirm'), 'B: challenge_retry_modal_confirm emitted')
  }
  // ── C + D + F + H (happy path) ──
  {
    const p = load()
    p.onRetryChallenge()
    modalOf(p).opt.success({ confirm: true })
    const cf = p._calls.find((c) => c.m === 'callFunction')
    ok(has(p, 'challenge_retry_request_sent'), 'C: challenge_retry_request_sent emitted')
    await tick()
    ok(has(p, 'challenge_retry_request_success'), 'D: challenge_retry_request_success emitted')
    ok(has(p, 'challenge_retry_nav_success'), 'F: challenge_retry_nav_success emitted')
    // H — contract unchanged
    ok(!!cf, 'H: server call made')
    eq(cf.name, 'startChallenge', 'H: calls startChallenge')
    eq(cf.data.mode, 'challenge', 'H: mode=challenge')
    eq(cf.data.replay, true, 'H: replay=true')
    ok(/^RP\d+_[a-z0-9]+$/.test(cf.data.replayRequestId), 'H: replayRequestId present/unique')
    eq(cf.data.replaySource, 'world_model_report', 'H: replaySource tag')
    eq(p._calls.filter((c) => c.m === 'switchTab').length, 0, 'H: no switchTab')
  }
  // ── E ──
  {
    const p = load({ cloudFail: true })
    p.onRetryChallenge()
    modalOf(p).opt.success({ confirm: true })
    await tick()
    ok(has(p, 'challenge_retry_request_fail'), 'E: challenge_retry_request_fail emitted')
    ok(p._calls.some((c) => c.m === 'showToast'), 'E: failure toast visible')
  }
  // ── G ──
  {
    const p = load({ navFail: true })
    p.onRetryChallenge()
    modalOf(p).opt.success({ confirm: true })
    await tick()
    ok(has(p, 'challenge_retry_nav_fail'), 'G: challenge_retry_nav_fail emitted')
    ok(p._calls.some((c) => c.m === 'showToast' && /无法进入挑战/.test(c.opt.title)), 'G: nav-fail toast visible')
  }
  // ── cancel: tap only, no confirm ──
  {
    const p = load()
    p.onRetryChallenge()
    modalOf(p).opt.success({ cancel: true })
    await tick()
    ok(has(p, 'challenge_retry_tap'), 'cancel: tap emitted')
    ok(!has(p, 'challenge_retry_modal_confirm'), 'cancel: no confirm event')
    eq(p._calls.filter((c) => c.m === 'callFunction').length, 0, 'cancel: zero server calls')
  }
  // ── source invariants ──
  {
    const src = fs.readFileSync(PREVIEW_JS, 'utf8')
    const body = (src.split('onRetryChallenge() {')[1] || '').split('\n  },')[0]
    ok(!/switchTab/.test(body), 'SRC: no switchTab in retry handler')
    ok(!/createOrder|requestPayment|membership|39\.9/i.test(body), 'SRC: no payment chain in retry handler')
    for (const e of ['challenge_retry_tap', 'challenge_retry_modal_confirm', 'challenge_retry_request_sent',
      'challenge_retry_request_success', 'challenge_retry_request_fail', 'challenge_retry_nav_success', 'challenge_retry_nav_fail']) {
      ok(body.indexOf(e) >= 0, 'SRC: telemetry ' + e + ' present')
    }
    const ana = fs.readFileSync(path.join(ROOT, 'utils', 'analytics.js'), 'utf8')
    ok(/challenge_retry_tap/.test(ana) && /challenge_retry_nav_fail/.test(ana), 'SRC: events registered in existing analytics (funnel) infra')
  }

  console.log(`  _TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
