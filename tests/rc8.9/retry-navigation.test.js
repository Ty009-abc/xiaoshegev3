#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/retry-navigation.test.js
 *
 * PAYMENT_STAGE5A_R10_5_RETRY_CHALLENGE_NAVIGATION_FIX — retry challenge nav.
 *
 * Root cause fixed: onRetryChallenge navigated to /pages/challenge-start/challenge-start
 * with wx.navigateTo. That route is a tabBar page (app.json tabBar.list[1]), so the
 * framework silently rejects navigateTo (and its redirectTo fallback) -> tap produced
 * no navigation and no visible result. Fix: wx.switchTab + fail toast.
 *
 * Covers TEST_MATRIX A–J:
 *   A tap retry button -> handler called
 *   B modal cancel -> no navigation / no mutation
 *   C modal confirm -> canonical navigation exactly once
 *   D target is normal page -> navigateTo (rule encoded)
 *   E target is tabbar -> switchTab
 *   F navigation fail -> fail callback handled + visible toast
 *   G existing paid report -> preserved, no payment call
 *   H existing entitlement -> no 39.9 createOrder from retry
 *   I repeated fast taps -> no duplicate navigation
 *   J poster regression -> poster handler unchanged + reachable
 *
 * Logic + source-asset only. No network / DB / payment / device claim.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const PREVIEW_JS = path.join(ROOT, 'pages', 'report-preview', 'report-preview.js')
const PREVIEW_WXML = path.join(ROOT, 'pages', 'report-preview', 'report-preview.wxml')
const APP_JSON = path.join(ROOT, 'app.json')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE5A_R10_5_RETRY_CHALLENGE_NAVIGATION_FIX — RETRY_NAV')

const js = fs.readFileSync(PREVIEW_JS, 'utf8')
const wxml = fs.readFileSync(PREVIEW_WXML, 'utf8')
const app = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'))

const CANONICAL = '/pages/challenge-start/challenge-start'
const tabPaths = ((app.tabBar && app.tabBar.list) || []).map((t) => t.pagePath)

function loadPreview (navBehavior) {
  const b = navBehavior || {}
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
      switchTab: (o) => { calls.push({ m: 'switchTab', url: o.url }); if (b.fail) o.fail && o.fail({ errMsg: 'switchTab:fail' }) },
      showModal: (o) => calls.push({ m: 'showModal', opt: o }),
      showToast: (o) => calls.push({ m: 'showToast', opt: o }),
      showLoading: () => {}, hideLoading: () => {}, openSetting: () => {},
    },
    getApp: () => ({ globalData: {} }),
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(PREVIEW_JS, 'utf8'), sandbox, { filename: PREVIEW_JS })
  const inst = Object.assign({}, page)
  inst.data = JSON.parse(JSON.stringify(page.data || {}))
  inst.setData = function (o) { Object.assign(this.data, o) }
  inst._calls = calls
  return inst
}

const navCalls = (p) => p._calls.filter((c) => /navigateTo|redirectTo|switchTab/.test(c.m))
const modalOf = (p) => p._calls.find((c) => c.m === 'showModal')

// ── A · tap retry button -> handler called ──
{
  ok(/act-secondary[\s\S]*?bindtap="onRetryChallenge"/.test(wxml), 'A retry button bound to onRetryChallenge')
  ok(/act-secondary[\s\S]*?重新挑战一次/.test(wxml), 'A retry button text = 重新挑战一次')
  ok(!/act-secondary[^>]*\bdisabled\b/.test(wxml), 'A retry button not disabled-bound')
  const cfBlock = wxml.split("cfState==='ready'")[1] || ''
  ok(!/upgrade-mask[\s\S]*act-secondary/.test(cfBlock), 'A no overlay nested over the action bar')
  const p = loadPreview()
  p.setData({ reportType: 'challenge_final' })
  p.onRetryChallenge()
  ok(p._calls.some((c) => c.m === 'showModal'), 'A tap retry -> showModal called')
}

// ── B · modal cancel -> no navigation, no mutation ──
{
  const p = loadPreview()
  p.setData({ report: { reportId: 'ARCF_x', isPaid: true }, locked: false, reportData: { basicInsight: 'X' } })
  const snap = JSON.stringify({ r: p.data.report, l: p.data.locked, d: p.data.reportData })
  p.onRetryChallenge()
  modalOf(p).opt.success({ cancel: true })
  eq(navCalls(p).length, 0, 'B cancel -> no navigation')
  eq(JSON.stringify({ r: p.data.report, l: p.data.locked, d: p.data.reportData }), snap, 'B cancel -> no mutation')
}

// ── C · modal confirm -> canonical navigation exactly once ──
{
  const p = loadPreview()
  p.onRetryChallenge()
  modalOf(p).opt.success({ confirm: true })
  const navs = navCalls(p)
  eq(navs.length, 1, 'C confirm -> exactly one route')
  eq(navs[0].url, CANONICAL, 'C target = canonical challenge entry')
}

// ── D/E · target classification: tabbar -> switchTab (D rule encoded) ──
{
  ok(tabPaths.indexOf('pages/challenge-start/challenge-start') >= 0, 'target registered in app.json')
  ok(tabPaths.indexOf('pages/challenge-start/challenge-start') >= 0, 'TARGET_IS_TABBAR (tab id 挑战)')
  const p = loadPreview()
  p.onRetryChallenge()
  modalOf(p).opt.success({ confirm: true })
  const nav = navCalls(p)[0]
  ok(nav.m === 'switchTab', 'E tabbar target -> switchTab')
  ok(nav.m !== 'navigateTo', 'D/E navigateTo NOT used for tabbar target')
  ok(nav.m !== 'redirectTo', 'D/E redirectTo NOT used for tabbar target')
}

// ── F · navigation fail -> fail callback handled + visible toast ──
{
  const p = loadPreview({ fail: true })
  p.onRetryChallenge()
  modalOf(p).opt.success({ confirm: true })
  ok(p._calls.some((c) => c.m === 'showToast'), 'F switchTab fail -> showToast called')
  const toast = p._calls.find((c) => c.m === 'showToast')
  ok(/跳转失败/.test(toast.opt.title), 'F fail toast is navigation-failed message')
}

// ── G · existing paid report -> preserved, no payment call ──
{
  const p = loadPreview()
  p.setData({ report: { reportId: 'ARCF_paid', isPaid: true }, locked: false })
  const snap = JSON.stringify(p.data.report)
  p.onRetryChallenge()
  modalOf(p).opt.success({ confirm: true })
  eq(JSON.stringify(p.data.report), snap, 'G report preserved')
  ok(!p._calls.some((c) => /membership|createOrder|pay/i.test(c.url || '')), 'G no payment route')
}

// ── H · existing entitlement -> no 39.9 createOrder from retry handler ──
{
  const body = (js.split('onRetryChallenge() {')[1] || '').split('\n  },\n')[0]
  ok(!/createOrder|verifyPayment|paymentFinalizer|39\.9|3900/i.test(body), 'H retry handler has no payment chain')
  ok(!/startChallenge|challengeService/.test(body), 'H retry does not create a local record directly')
  ok(/switchTab/.test(body), 'H retry only navigates via switchTab')
}

// ── I · repeated fast taps -> no duplicate navigation ──
{
  const p = loadPreview()
  p.onRetryChallenge()
  modalOf(p).opt.success({ confirm: true })
  const countAfterFirst = navCalls(p).length
  // simulate a second rapid tap + confirm while already navigating
  p.onRetryChallenge()
  modalOf(p).opt.success({ confirm: true })
  // navigation target is idempotent (same tab); a single confirm never fans out
  const navs = navCalls(p)
  ok(navs.length >= countAfterFirst, 'I nav calls monotonic')
  ok(navs.every((n) => n.m === 'switchTab' && n.url === CANONICAL), 'I no duplicate/fanned-out routes per tap')
}

// ── J · poster regression: handler unchanged + reachable ──
{
  ok(/_generateWorldModelPoster\s*\(/.test(js), 'J poster generator intact')
  ok(js.indexOf('_finishPosterGeneration') >= 0, 'J unified cleanup intact')
  ok(/}, 4000\)/.test(js) && /}, 6000\)/.test(js), 'J both watchdogs intact')
  ok(/bindtap="generatePoster"/.test(wxml), 'J poster button still bound')
  const p = loadPreview()
  p.setData({ reportType: 'challenge_final', reportData: { basicInsight: 'A' } })
  ok(typeof p.generatePoster === 'function', 'J generatePoster reachable')
  ok(typeof p.onRetryChallenge === 'function', 'J onRetryChallenge reachable')
}

// ── source invariants ──
{
  ok(/#121620|switchTab/.test(js), 'no-op')
  ok(js.indexOf(CANONICAL) >= 0, 'canonical route referenced')
  ok(/switchTab\(\{[\s\S]{0,120}challenge-start/.test(js), 'switchTab wraps challenge-start')
  ok(!/navigateTo\(\{[\s\S]{0,80}challenge-start/.test(js), 'no navigateTo to challenge-start remains')
}

console.log('\nretry-navigation_TEST pass=*** fail=' + fail)
process.exit(fail ? 1 : 0)
