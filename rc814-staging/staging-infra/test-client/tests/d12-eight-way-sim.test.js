'use strict'
/**
 * RC8_14_D12_R5B_4 — LOCAL SIMULATION of the 8-way control (no network, no DB,
 * no cloud). Loads the test-client's `app.js` in a VM with a mocked
 * `wx.cloud.callFunction`, then drives `startChallengeEightWay(8)` and asserts
 * the dispatch/collection contract that the on-device run must satisfy:
 *   - exactly 8 dispatches;
 *   - all 8 dispatched BEFORE any settles (true concurrency, no serialization);
 *   - independent per-request dispatch + settlement timestamps;
 *   - Promise.allSettled collects all 8;
 *   - success/conflict/error counts + distinct success recordIds computed;
 *   - NO automatic retry (each slot calls exactly once).
 *
 * Run:  node rc814-staging/staging-infra/test-client/tests/d12-eight-way-sim.test.js
 */
const fs = require('fs')
const vm = require('vm')
const path = require('path')

const TC = path.join(__dirname, '..')
const appSrc = fs.readFileSync(path.join(TC, 'app.js'), 'utf8')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

// ── mock wx.cloud.callFunction: tracks concurrency + call count ──
const state = { inflight: 0, maxInflight: 0, calls: 0, dispatchOrder: [] }
const wx = {
  cloud: {
    init () {},
    callFunction ({ name }) {
      state.calls++
      const n = state.calls
      state.inflight++
      state.maxInflight = Math.max(state.maxInflight, state.inflight)
      state.dispatchOrder.push({ n, at: Date.now() })
      return new Promise((resolve) => {
        setTimeout(() => {
          state.inflight--
          resolve({ result: { code: 0, message: 'success', data: { recordId: 'CR_SIM_' + n, resumed: n > 1, trialMode: true, currentEventIndex: 0 } } })
        }, 25 + n * 3) // staggered settle times so per-request timestamps are genuinely distinct
      })
    },
  },
}

const sandbox = {
  wx, console,
  setTimeout, clearTimeout, Date, Math, JSON, Promise, Number, String, Boolean, Object, Array, Error,
  require: (p) => require(path.join(TC, p.replace(/^\.\//, ''))),
}
let appCfg = null
sandbox.App = (cfg) => { appCfg = cfg; return cfg }
sandbox.App.prototype = {}
vm.createContext(sandbox)
vm.runInContext(appSrc, sandbox)

;(async () => {
  ok(appCfg && typeof appCfg.startChallengeEightWay === 'function', 'app.js exposes startChallengeEightWay (via App config)')
  appCfg.globalData = appCfg.globalData || {}
  appCfg.globalData.identityPresent = true

  const s = await appCfg.startChallengeEightWay(8)

  ok(s && s.ok === true, 'batch reports ok')
  ok(state.calls === 8, 'exactly 8 dispatches issued (got ' + state.calls + ')')
  ok(s.perRequest.length === 8, '8 per-request results captured')
  ok(s.responseCodes.length === 8 && s.responseCodes.every((c) => c === 0), 'all 8 responses code=0')

  // concurrency: all 8 dispatched before any settled → maxInflight should be 8
  ok(state.maxInflight === 8, 'true concurrency: all 8 in flight simultaneously (maxInflight=' + state.maxInflight + ')')

  // independent timestamps: not all equal
  const dts = s.perRequest.map((r) => r.dispatchTimestamp)
  const sts = s.perRequest.map((r) => r.settlementTimestamp)
  ok(new Set(dts).size >= 1, 'dispatch timestamps present')
  ok(sts.every((t, i) => t >= dts[i]), 'each settlement >= its dispatch')
  ok(new Set(sts).size > 1, 'settlements are NOT a single shared completion time')

  ok(s.successCount === 8, 'successCount=8')
  ok(s.successRecordIds.length === 8, '8 distinct success recordIds (unique per mock)')
  ok(s.errorCount === 0 && s.conflictCount === 0, 'no errors/conflicts in happy path')
  ok(typeof s.clientOverlap === 'boolean', 'clientOverlap computed')

  // no retry: call count == 8 exactly (one per slot), independent of settle time
  ok(state.calls === 8, 'no automatic retry (call count stayed 8)')

  // failure path: rejected call is captured, not retried
  let calls2 = 0
  sandbox.wx.cloud.callFunction = () => { calls2++; return Promise.reject(new Error('boom')) }
  const s2 = await appCfg.startChallengeEightWay(8)
  ok(calls2 === 8, 'failure path: still exactly 8 attempts (no retry)')
  ok(s2.errorCount === 8, 'failure path: 8 network errors surfaced')
  ok(s2.successCount === 0, 'failure path: 0 fabricated successes')

  console.log('D12_EIGHT_WAY_SIM pass=' + pass + ' fail=' + fail)
  process.exit(fail ? 1 : 0)
})()
