#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/retry-tap-dispatch.test.js
 *
 * RC8_9_P0_REPLAY_REAL_DEVICE_TAP_DISPATCH_FIX — the 重新挑战一次 control must
 * be reachable/cickable on device: a real tap dispatches onRetryChallenge ONCE
 * and the confirm modal appears immediately.
 *
 * Root cause class: D_DYNAMIC_DISABLED_STYLE / G_NATIVE_BUTTON_STYLE_STATE —
 * the native <button> act-secondary rendered disabled-like and its tap did not
 * dispatch, while the sibling native <button> act-primary did (real-device
 * accepted in R10.4). Fix = view role=button (spec-sanctioned alternative) +
 * remove the disabled-ish appearance.
 *
 *  A  retry control = view role=button (accessible), single bindtap
 *  B  no disabled attribute / no pointer-events:none / opacity:1 in normal state
 *  C  no catchtap / no duplicate binding / no overlay covering the action bar
 *  D  tap → handler executes exactly once → challenge_retry_tap once → modal once
 *  E  runtime: tap shows the confirm modal '重新挑战一次？' immediately
 *  F  posterGenerating false → retry control clickable (not gated)
 *
 * Static-asset + runtime-logic only. No network / DB / device claim.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const WXML = path.join(ROOT, 'pages', 'report-preview', 'report-preview.wxml')
const WXSS = path.join(ROOT, 'pages', 'report-preview', 'report-preview.wxss')
const JS = path.join(ROOT, 'pages', 'report-preview', 'report-preview.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

const wxml = fs.readFileSync(WXML, 'utf8')
const wxss = fs.readFileSync(WXSS, 'utf8')

console.log('RC8_9_P0_REPLAY_TAP_DISPATCH')

// the retry control markup (from the node that carries 重新挑战一次)
const retryNode = (wxml.split('重新挑战一次')[0].split('<').pop() || '') // not used directly
const retryLine = (wxml.match(/<[^>]*class="act-secondary"[^>]*>/) || [''])[0]

;(async () => {
  // ── A · retry control is a view role=button with a single bindtap ──
  {
    ok(/class="act-secondary"/.test(wxml), 'A1: act-secondary present')
    ok(/<view[^>]*class="act-secondary"[^>]*bindtap="onRetryChallenge"/.test(wxml), 'A2: act-secondary is a <view> bound to onRetryChallenge')
    ok(/<view[^>]*class="act-secondary"[^>]*role="button"/.test(wxml), 'A3: retry control has role=button (accessible tap area)')
    const binds = (wxml.match(/bindtap="onRetryChallenge"/g) || []).length
    eq(binds, 1, 'A4: exactly one bindtap=onRetryChallenge (no duplicate events)')
    ok(!/<button[^>]*class="act-secondary"/.test(wxml), 'A5: no longer a native <button> (native-state defect removed)')
  }

  // ── B · no disabled appearance / no pointer block ──
  {
    ok(!/act-secondary[^>]*\bdisabled\b/.test(wxml), 'B1: no disabled attribute on retry control')
    const sec = (wxss.split('.act-secondary {')[1] || '').split('}')[0]
    ok(/opacity\s*:\s*1/.test(sec), 'B2: .act-secondary normal-state opacity:1')
    ok(!/pointer-events\s*:\s*none/.test(sec), 'B3: .act-secondary has no pointer-events:none')
    ok(!/pointer-events\s*:\s*none/.test(wxss), 'B4: page wxss has no pointer-events:none at all')
    ok(!/linear-gradient/.test(sec), 'B5: secondary keeps lower visual weight (no gradient)')
  }

  // ── C · no interceptor / no overlay over the action bar ──
  {
    const cf = wxml.split("reportType==='diagnostic'")[1] || wxml
    ok(!/catchtap/.test(cf), 'C1: no catchtap in challenge_final branch')
    ok(!/catchtouchstart|catchtouchend|catchtouchmove/.test(cf.replace('catchtouchmove="true"', '')), 'C2: no touch-catch interceptor (poster-mask catchtouchmove excluded)')
    // overlays are independently gated by their own flags
    ok(/upgrade-mask" wx:if="\{\{showUpgradeModal && locked\}\}"/.test(wxml), 'C3: upgrade-mask gated by showUpgradeModal && locked')
    ok(/poster-mask" wx:if="\{\{showPoster\}\}"/.test(wxml), 'C4: poster-mask gated by showPoster')
    ok(!/position:\s*fixed/.test((wxss.split('.action-bar {')[1] || '').split('}')[0]), 'C5: action-bar is in normal flow (not fixed/overlay)')
  }

  // ── D/E/F · runtime: tap → handler once → telemetry once → modal immediately ──
  {
    const events = []
    const calls = []
    let page = null
    const sandbox = {
      require: (id) => {
        if (id.indexOf('aiReportService') >= 0) return { generateAiReport: async () => ({ code: 0, data: {} }) }
        if (id.indexOf('analytics') >= 0) return { track: (e) => events.push(e), flush: () => {} }
        if (id.indexOf('worldModelPosterContent') >= 0) return require(path.join(ROOT, 'utils', 'worldModelPosterContent.js'))
        if (id.indexOf('worldModelPosterRenderer') >= 0) return require(path.join(ROOT, 'utils', 'worldModelPosterRenderer.js'))
        throw new Error('unexpected require: ' + id)
      },
      Page: (c) => { page = c },
      console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
      setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
      wx: {
        navigateTo: (o) => calls.push({ m: 'navigateTo', url: o.url }),
        showModal: (o) => calls.push({ m: 'showModal', opt: o }),
        showToast: () => {}, showLoading: () => {}, hideLoading: () => {}, openSetting: () => {},
        cloud: { callFunction: () => Promise.resolve({ result: { code: 0, data: {} } }) },
      },
      getApp: () => ({ globalData: {} }),
    }
    vm.createContext(sandbox)
    vm.runInContext(fs.readFileSync(JS, 'utf8'), sandbox, { filename: JS })
    const p = Object.assign({}, page)
    p.data = Object.assign(JSON.parse(JSON.stringify(page.data || {})), { locked: false, posterGenerating: false, retryCreating: false })
    p.setData = function (o) { Object.assign(this.data, o) }

    // simulate one tap
    p.onRetryChallenge()
    eq(events.filter((e) => e === 'challenge_retry_tap').length, 1, 'D1: exactly one challenge_retry_tap')
    eq(calls.filter((c) => c.m === 'showModal').length, 1, 'D2: exactly one modal (handler ran once)')
    const modal = calls.find((c) => c.m === 'showModal')
    eq(modal.opt.title, '重新挑战一次？', 'E1: confirm modal appears immediately with correct title')
    // F: posterGenerating false did not gate the retry control
    eq(p.data.posterGenerating, false, 'F1: posterGenerating false')
    eq(p.data.retryCreating, false, 'F2: retry not stuck creating before confirm')
  }

  console.log(`  _TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
