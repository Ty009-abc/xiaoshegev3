#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/challenge-start-routing.test.js
 *
 * PAYMENT_STAGE5A_R6_CHALLENGE_ENTRY_AUTHORITY — client routing.
 *
 * The challenge entry page (pages/challenge-start) must route by the SERVER's
 * authoritative response:
 *   • completed=true / destination='challenge_result' → challenge-result
 *     with the SAME recordId (never the 3-question trial gate, never paywall)
 *   • unfinished owned record → challenge-play with the SAME recordId
 *   • a fresh trial (trialMode=true, no owned) → challenge-play (trial gate)
 *
 * vm harness; wx + challengeService stubbed. No network, no DB, no charge.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const START = path.join(ROOT, 'pages', 'challenge-start', 'challenge-start.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

let CALLS = []
function loadStart (startImpl) {
  const src = fs.readFileSync(START, 'utf8')
  let config = null
  const sandbox = {
    require: (req) => {
      if (req.indexOf('services/challengeService') >= 0) return { startChallenge: startImpl }
      throw new Error('unexpected require: ' + req)
    },
    Page: (c) => { config = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, Error, RegExp,
    setTimeout, clearTimeout,
    wx: {
      navigateTo: (o) => { CALLS.push({ m: 'navigateTo', url: o.url }); o.fail && o.fail({}) },
      redirectTo: (o) => { CALLS.push({ m: 'redirectTo', url: o.url }) },
      showToast: (o) => CALLS.push({ m: 'showToast', title: o.title }),
      showLoading: () => {}, hideLoading: () => {},
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(src, sandbox, { filename: START })
  const inst = Object.assign({}, config)
  inst.data = JSON.parse(JSON.stringify(config.data || {}))
  inst.setData = function (o) { Object.assign(inst.data, o) }
  return inst
}
const navOf = () => CALLS.find((c) => c.m === 'navigateTo' || c.m === 'redirectTo')

console.log('PAYMENT_STAGE5A_R6 challenge-start routing')

;(async () => {
  // K: finished paid response → challenge-result with SAME recordId
  {
    CALLS = []
    const p = loadStart(async () => ({ code: 0, data: { recordId: 'CR_PAID_FIN', resumed: true, completed: true, destination: 'challenge_result', trialMode: false, unlocked: true } }))
    await p.onStartChallenge()
    const nav = navOf()
    ok(!!nav, 'K.1 navigated')
    ok(nav.url.indexOf('/pages/challenge-result/challenge-result') >= 0, 'K.2 → challenge-result')
    ok(nav.url.indexOf('recordId=' + encodeURIComponent('CR_PAID_FIN')) >= 0, 'K.3 same recordId')
    ok(nav.url.indexOf('challenge-play') < 0, 'K.4 NOT challenge-play')
    ok(nav.url.indexOf('membership') < 0, 'K.5 NOT membership/paywall')
  }

  // K2: destination-only (no completed flag) also routes to result
  {
    CALLS = []
    const p = loadStart(async () => ({ code: 0, data: { recordId: 'CR_FIN2', destination: 'challenge_result', trialMode: false } }))
    await p.onStartChallenge()
    ok(navOf().url.indexOf('/pages/challenge-result/challenge-result') >= 0, 'K2.1 destination routes result')
  }

  // L: unfinished paid response → challenge-play with SAME recordId
  {
    CALLS = []
    const p = loadStart(async () => ({ code: 0, data: { recordId: 'CR_PAID_OPEN', resumed: true, completed: false, trialMode: false, unlocked: true } }))
    await p.onStartChallenge()
    const nav = navOf()
    ok(!!nav, 'L.1 navigated')
    ok(nav.url.indexOf('/pages/challenge-play/challenge-play') >= 0, 'L.2 → challenge-play')
    ok(nav.url.indexOf('recordId=' + encodeURIComponent('CR_PAID_OPEN')) >= 0, 'L.3 same recordId')
    ok(nav.url.indexOf('membership') < 0, 'L.4 no paywall')
  }

  // T: fresh trial (free user) → challenge-play (trial gate is legitimate here)
  {
    CALLS = []
    const p = loadStart(async () => ({ code: 0, data: { recordId: 'CR_TRIAL', trialMode: true, trialLimit: 3 } }))
    await p.onStartChallenge()
    const nav = navOf()
    ok(nav.url.indexOf('/pages/challenge-play/challenge-play') >= 0, 'T.1 trial → challenge-play')
    ok(nav.url.indexOf('recordId=' + encodeURIComponent('CR_TRIAL')) >= 0, 'T.2 trial recordId')
  }

  // E1: error response → no navigation + toast
  {
    CALLS = []
    const p = loadStart(async () => ({ code: 500, message: '挑战创建失败' }))
    await p.onStartChallenge()
    ok(!navOf(), 'E1.1 no navigation on error')
    ok(!!CALLS.find((c) => c.m === 'showToast'), 'E1.2 error toast shown')
  }

  console.log(`\nchallenge-start-routing_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
