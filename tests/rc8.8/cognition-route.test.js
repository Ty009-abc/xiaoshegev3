#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.8/cognition-route.test.js
 *
 * B. Primary route → latest cognition strike. Proves home 「今日认知暴击」and
 *    result 「每日认知」open the SAME latest experience (never the old
 *    /pages/cognition-daily), via the shared authority utils/cognitionEntry.js.
 *
 * Node built-ins only. Runnable from repo root.
 */

const path = require('path')
const ROOT = path.resolve(__dirname, '..', '..')

// advance the clock so the module-scoped double-tap guard doesn't cross-talk
let OFFSET = 0
const realNow = Date.now
Date.now = () => realNow() + (OFFSET += 700)

function makeWx() {
  const calls = []
  return {
    calls,
    navigateTo(o) { calls.push({ type: 'navigateTo', url: o.url }); if (o.success) o.success({}) },
    switchTab(o) { calls.push({ type: 'switchTab', url: o.url }); if (o.success) o.success({}) },
    showToast() {}, redirectTo(o) { calls.push({ type: 'redirectTo', url: o.url }); if (o.success) o.success({}) },
    cloud: { callFunction: () => Promise.resolve({ result: { code: 0, data: null } }) },
  }
}
function load(rel, wx) {
  global.wx = wx
  global.getApp = () => ({ globalData: {} })
  let captured = null
  global.Page = (cfg) => { captured = cfg }
  global.Component = () => {}
  const abs = path.join(ROOT, rel)
  delete require.cache[require.resolve(abs)]
  require(abs)
  return captured
}

const entry = require(path.join(ROOT, 'utils/cognitionEntry.js'))
const STRIKE = '/subpkg-ai/cognitive-shock-detail/cognitive-shock-detail'
const today = require(path.join(ROOT, 'utils/cognitionStrike.js')).getTodayStrike().id

let pass = 0, fail = 0
const check = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const navUrl = (wx) => (wx.calls.find(c => c.type === 'navigateTo') || {}).url

// 1) canonical urls
check(entry.computeStrikeUrl('') === `${STRIKE}?id=${today}`, `non-personalized url (${entry.computeStrikeUrl('')})`)
check(entry.computeStrikeUrl('STRIKE_007') === `${STRIKE}?sid=STRIKE_007`, `personalized url (${entry.computeStrikeUrl('STRIKE_007')})`)
check(!/cognition-daily/.test(entry.computeStrikeUrl('')), 'authority url never legacy')

// 2) result 每日认知 (non-personalized) → authority url, not old page
const wxR = makeWx(); const rc = load('pages/legacy6q-report/legacy6q-report.js', wxR)
rc.goCognitionDaily.call({ data: { _strikeId: '' }, setData() {} })
check(navUrl(wxR) === entry.computeStrikeUrl(''), `result url == authority (${navUrl(wxR)})`)
check(!wxR.calls.some(c => /cognition-daily/.test(c.url)), 'result primary path avoids old cognition-daily')

// 3) home strike (personalized) → authority url, not old page
const wxH = makeWx(); const hc = load('pages/home/home.js', wxH)
hc.onStrikeTap.call({ data: { _strikeId: 'STRIKE_007' }, setData() {} })
const homeUrl = navUrl(wxH)
check(homeUrl === entry.computeStrikeUrl('STRIKE_007'), `home personalized url authority (${homeUrl})`)
check(!/cognition-daily/.test(homeUrl), 'home strike avoids old cognition-daily')

// 4) HOME_AND_RESULT_TARGET_SAME for identical personalization
const wxR2 = makeWx(); const rc2 = load('pages/legacy6q-report/legacy6q-report.js', wxR2)
rc2.goCognitionDaily.call({ data: { _strikeId: 'STRIKE_007' }, setData() {} })
check(navUrl(wxR2) === homeUrl, `HOME_AND_RESULT_TARGET_SAME (${navUrl(wxR2)} vs ${homeUrl})`)

// 5) other two entries
const wxW = makeWx(); const rcW = load('pages/legacy6q-report/legacy6q-report.js', wxW)
rcW.goWorldRules.call({ data: {}, setData() {} })
check(navUrl(wxW) === '/pages/world-rules/world-rules', `world-rules route (${navUrl(wxW)})`)
const wxA = makeWx(); const rcA = load('pages/legacy6q-report/legacy6q-report.js', wxA)
rcA.goAskXiaoshige.call({ data: {}, setData() {} })
check((wxA.calls.find(c => c.type === 'switchTab') || {}).url === '/pages/ai-chat/ai-chat', 'ai-chat switchTab')

// 6) fallback: detail route fails → legacy daily (no dead end)
const wxF = makeWx()
wxF.navigateTo = (o) => { wxF.calls.push({ type: 'navigateTo', url: o.url }); if (o.fail && /cognitive-shock-detail/.test(o.url)) o.fail({ errMsg: 'fail' }) }
global.wx = wxF
entry.openCognitionStrike({ data: { _strikeId: '' } })
check(wxF.calls.some(c => /cognition-daily/.test(c.url)), 'fallback → legacy daily when detail fails')

// 7) double-tap guard: two rapid identical taps → one navigation
const wxD = makeWx(); const rcD = load('pages/legacy6q-report/legacy6q-report.js', wxD)
const fixed = realNow() + 1000000
Date.now = () => fixed // true freeze
rcD.goCognitionDaily.call({ data: { _strikeId: '' }, setData() {} })
rcD.goCognitionDaily.call({ data: { _strikeId: '' }, setData() {} })
Date.now = () => realNow() + (OFFSET += 700)
check(wxD.calls.filter(c => c.type === 'navigateTo').length === 1, `double tap → one nav (${wxD.calls.length})`)

console.log(`\nROUTE_TEST pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
