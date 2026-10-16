'use strict'
/**
 * RC8_14_D12_R6D — MOCKED-RUNTIME test for the Day4 payment-boundary NEGATIVE probes (Test B / Test C).
 *
 * Loads the REAL test-client `app.js` + `pages/index/index.js` in a VM with a MOCKED `wx`
 * (no network, no real startChallenge/submit, no DB). Asserts the probe contract:
 *   - probes are staging-only, DEFAULT-LOCKED, and require explicit arm + confirm;
 *   - cancel => ZERO network calls;
 *   - confirmed => EXACTLY one call, then locked (single-shot, locked BEFORE the first await);
 *   - rapid repeated taps => at most one call; rejection => NO retry;
 *   - denial (code 1002 / needPayment / locked) renders correctly;
 *   - probes never change the answer UI, never call the other function, never carry openid;
 *   - the normal D3 mismatch guard remains enforced (regression).
 *
 * Run:  node rc814-staging/staging-infra/test-client/tests/d12-day4-probe.test.js
 */
const fs = require('fs')
const vm = require('vm')
const path = require('path')

const TC = path.join(__dirname, '..')
const appSrc = fs.readFileSync(path.join(TC, 'app.js'), 'utf8')
const idxSrc = fs.readFileSync(path.join(TC, 'pages/index/index.js'), 'utf8')
const wxml = fs.readFileSync(path.join(TC, 'pages/index/index.wxml'), 'utf8')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor (fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 2000)) { if (fn()) return true; await sleep(10) } return false }
function setDeep (obj, dotted, val) { const parts = dotted.split('.'); let o = obj; for (let i = 0; i < parts.length - 1; i++) { if (typeof o[parts[i]] !== 'object' || o[parts[i]] === null) o[parts[i]] = {}; o = o[parts[i]] } o[parts[parts.length - 1]] = val }

function build (opts) {
  opts = opts || {}
  const state = { names: [], payloads: [], modalCalls: 0 }
  const NOT_READY = Symbol('pend')
  const wx = {
    cloud: { init () {}, callFunction ({ name, data }) {
      state.names.push(name); state.payloads.push({ name, data })
      if (opts.reject && opts.reject[name]) return Promise.reject(new Error('net-boom'))
      const r = (opts.responses && opts.responses[name]) || { code: 0, message: 'ok', data: {} }
      return Promise.resolve({ result: r })
    } },
    showToast () {},
    showModal (o) {
      state.modalCalls++
      const bad = (t) => typeof t === 'string' && Array.from(t).length > 4
      if (bad(o.confirmText) || bad(o.cancelText)) { if (o.fail) o.fail({ errMsg: 'showModal:fail length' }); return }
      const m = (opts.modalResult !== undefined) ? { confirm: opts.modalResult } : { confirm: true }
      if (opts.modalSync) { if (o.success) o.success(m) } else { setImmediate(() => { if (o.success) o.success(m) }) }
    },
    navigateTo () {},
  }
  const requireFrom = (base, p) => require(path.resolve(base, p))
  let app = null, page = null
  const base = { wx, console, setTimeout, clearTimeout, setImmediate, Date, Math, JSON, Promise, Number, String, Boolean, Object, Array, Error, RegExp, Symbol,
    App: (cfg) => { app = cfg; return cfg }, Page: (cfg) => { page = cfg; return cfg }, getApp: () => app }
  const sb1 = Object.assign({}, base, { require: (p) => requireFrom(TC, p) })
  vm.createContext(sb1); vm.runInContext('(function(){' + appSrc + '\n})()', sb1)
  const sb2 = Object.assign({}, base, { require: (p) => requireFrom(path.join(TC, 'pages/index'), p) })
  vm.createContext(sb2); vm.runInContext('(function(){' + idxSrc + '\n})()', sb2)
  app.globalData = app.globalData || {}
  page.setData = (obj) => { for (const k of Object.keys(obj)) setDeep(page.data, k, obj[k]) }
  ;['_log', '_toast', '_redact', '_d3Expected', 'onD3Fetch', 'onD3Select', 'onD3Submit', '_d3DoSubmit',
    'onTBArm', 'onTCArm', 'onTBStart', '_tbDoStart', 'onTCSubmit', '_tcDoSubmit'].forEach((fn) => { if (typeof page[fn] === 'function') page[fn] = page[fn].bind(page) })
  return { wx, app, page, state }
}
const count = (state, n) => state.names.filter((x) => x === n).length

const STEP = (page, ms) => waitFor(() => page.data.tc.busy === false && page.data.tb.busy === false, ms || 500)

;(async () => {
  // ── 0) static: staging-only buttons + bindings present ──
  ok(/bindtap="onTBStart"/.test(wxml), 'WXML binds onTBStart (Test B)')
  ok(/bindtap="onTCSubmit"/.test(wxml), 'WXML binds onTCSubmit (Test C)')
  ok(/bindchange="onTBArm"/.test(wxml) && /bindchange="onTCArm"/.test(wxml), 'WXML arm switches present')
  ok(/Day4 付费边界负向探针/.test(wxml), 'probe card rendered in staging test client only')
  { const b = build().page; ok(typeof b.onTCSubmit === 'function' && typeof b.onTBStart === 'function', 'page defines probe handlers') }

  // ── 1) DEFAULT-LOCKED: tap while not armed => ZERO calls ──
  { const { page, state } = build({ modalSync: true }); page.data.identityOk = true
    page.onTCSubmit(); page.onTBStart(); await sleep(20)
    ok(count(state, 'submitChallengeChoice') === 0 && count(state, 'startChallenge') === 0, 'not armed: ZERO network calls (both probes)') }

  // ── 2) identity guard: armed but not self-checked => ZERO calls ──
  { const { page, state } = build({ modalSync: true }); page.data.identityOk = false
    page.data.tc.armed = true; page.data.tb.armed = true
    page.onTCSubmit(); page.onTBStart(); await sleep(20)
    ok(count(state, 'submitChallengeChoice') === 0 && count(state, 'startChallenge') === 0, 'no identity: ZERO network calls') }

  // ── 3) armed + CANCEL => ZERO calls (both) ──
  { const { page, state } = build({ modalSync: true, modalResult: false }); page.data.identityOk = true
    page.data.tc.armed = true; page.data.tb.armed = true
    page.onTCSubmit(); page.onTBStart(); await sleep(20)
    ok(count(state, 'submitChallengeChoice') === 0, 'Test C cancel: ZERO submit calls')
    ok(count(state, 'startChallenge') === 0, 'Test B cancel: ZERO startChallenge calls') }

  // ── 4) armed + CONFIRM => EXACTLY one call each, correct payloads, no openid ──
  { const { page, state } = build({ modalSync: true, responses: {
      submitChallengeChoice: { code: 1002, message: 'need payment', data: { locked: true, needPayment: true, code: 'TRIAL_BOUNDARY_REACHED' }, currentEventIndex: 3 },
      startChallenge: { code: 0, message: 'ok', data: { recordId: 'CRmvakykxsq5m5s6zj', locked: true, needPayment: true, currentEventIndex: 3, resumed: true, trialMode: true } },
    } })
    page.data.identityOk = true; page.data.tc.armed = true; page.data.tb.armed = true
    page.onTCSubmit(); page.onTBStart(); await STEP(page, 800)
    const subs = state.payloads.filter((p) => p.name === 'submitChallengeChoice')
    const starts = state.payloads.filter((p) => p.name === 'startChallenge')
    ok(subs.length === 1, 'Test C confirm: EXACTLY one submit call (got ' + subs.length + ')')
    ok(subs[0] && subs[0].data.recordId === 'CRmvakykxsq5m5s6zj' && subs[0].data.eventId === 'CE014' && subs[0].data.choiceKey === 'A', 'Test C payload = fixed recordId + CE014/A')
    ok(subs[0] && !('openid' in subs[0].data), 'Test C: no openid (server identity authority)')
    ok(starts.length === 1, 'Test B confirm: EXACTLY one startChallenge call (got ' + starts.length + ')')
    ok(starts[0] && starts[0].data && starts[0].data.mode === 'challenge', 'Test B payload mode=challenge')
    ok(starts[0] && !('openid' in starts[0].data), 'Test B: no openid')
    ok(page.data.tb.done === true && page.data.tc.done === true, 'both probes LOCKED after single shot') }

  // ── 5) rapid repeated taps => at most one call ──
  { const { page, state } = build({ modalSync: true, responses: { submitChallengeChoice: { code: 1002, data: { needPayment: true, locked: true } }, startChallenge: { code: 0, data: { needPayment: true, locked: true } } } })
    page.data.identityOk = true; page.data.tc.armed = true; page.data.tb.armed = true
    page.onTCSubmit(); page.onTCSubmit(); page.onTCSubmit()
    page.onTBStart(); page.onTBStart(); page.onTBStart()
    await STEP(page, 800)
    ok(count(state, 'submitChallengeChoice') === 1, 'rapid taps: Test C at most one call (got ' + count(state, 'submitChallengeChoice') + ')')
    ok(count(state, 'startChallenge') === 1, 'rapid taps: Test B at most one call (got ' + count(state, 'startChallenge') + ')') }

  // ── 6) denial renders correctly (1002 / needPayment / locked) ──
  { const { page, state } = build({ modalSync: true, responses: {
      submitChallengeChoice: { code: 1002, message: 'need payment', data: { locked: true, needPayment: true, code: 'TRIAL_BOUNDARY_REACHED' }, currentEventIndex: 3 },
      startChallenge: { code: 0, data: { recordId: 'CRx', locked: true, needPayment: true, currentEventIndex: 3 } },
    } })
    page.data.identityOk = true; page.data.tc.armed = true; page.data.tb.armed = true
    page.onTCSubmit(); page.onTBStart(); await STEP(page, 800)
    ok(/1002/.test(page.data.tc.resultText) && /needPayment=true/.test(page.data.tc.resultText) && /locked=true/.test(page.data.tc.resultText), 'Test C denial renders 1002 + needPayment + locked')
    ok(/needPayment=true/.test(page.data.tb.resultText) && /locked=true/.test(page.data.tb.resultText), 'Test B boundary renders needPayment + locked') }

  // ── 7) NO retry after network rejection ──
  { const { page, state } = build({ modalSync: true, reject: { submitChallengeChoice: true, startChallenge: true } })
    page.data.identityOk = true; page.data.tc.armed = true; page.data.tb.armed = true
    page.onTCSubmit(); page.onTBStart(); await STEP(page, 800); await sleep(60)
    ok(count(state, 'submitChallengeChoice') === 1 && count(state, 'startChallenge') === 1, 'rejection: exactly 1 attempt each (NO retry)') }

  // ── 8) probes do NOT unlock the normal answer UI, do NOT call the other fn, keep D3 phase idle ──
  { const { page, state } = build({ modalSync: true, responses: { submitChallengeChoice: { code: 1002, data: { needPayment: true, locked: true } } } })
    page.data.identityOk = true; page.data.tc.armed = true
    page.onTCSubmit(); await STEP(page, 800)
    ok(page.data.day3.phase === 'idle' && page.data.day3.event === null, 'Test C does not unlock normal answer UI (day3 idle, event null)')
    ok(count(state, 'startChallenge') === 0, 'Test C never invokes startChallenge') }
  { const { page, state } = build({ modalSync: true, responses: { startChallenge: { code: 0, data: { needPayment: true, locked: true } } } })
    page.data.identityOk = true; page.data.tb.armed = true
    page.onTBStart(); await STEP(page, 800)
    ok(count(state, 'submitChallengeChoice') === 0, 'Test B never invokes submitChallengeChoice') }

  // ── 9) arm switch handler toggles state and emits a log ──
  { const { page } = build(); page.onTCArm({ detail: { value: true } }); page.onTBArm({ detail: { value: true } })
    ok(page.data.tc.armed === true && page.data.tb.armed === true, 'arm switch sets armed=true')
    page.onTCArm({ detail: { value: false } }); ok(page.data.tc.armed === false, 'arm switch sets armed=false') }

  // ── 10) D3 mismatch guard REGRESSION (unchanged by probe additions) ──
  { const GAME = { code: 0, message: 'ok', data: { eventId: 'GAME015', day: 2, title: 'x', choices: [{ key: 'A' }, { key: 'B' }] } }
    const { page, state } = build({ modalSync: true, responses: { getChallengeEvent: GAME, submitChallengeChoice: { code: 0 } } })
    page.data.identityOk = true; page.data.day3.slotIndex = 0 // expects CE012, gets GAME015
    await page.onD3Fetch()
    ok(page.data.day3.phase === 'mismatch' && page.data.day3.event === null, 'D3 regression: mismatch still hides event')
    page.data.day3.selected = 'A'
    page.onD3Submit(); await sleep(20)
    ok(count(state, 'submitChallengeChoice') === 0, 'D3 regression: mismatch still blocks submit (0 calls)') }

  // ── 11) source-level: no prod fallback / staging literal / no openid literals in probe code ──
  const stripC = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const idxCode = stripC(idxSrc)
  ok(!/DYNAMIC_CURRENT_ENV/.test(idxCode), 'no DYNAMIC_CURRENT_ENV (no prod fallback)')
  ok(!/fanshex-d2g0adgv7dfbc9bdc/.test(idxCode), 'no production envId literal in client code')

  console.log('D12_DAY4_PROBE pass=' + pass + ' fail=' + fail)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('HARNESS_ERROR', e); process.exit(2) })
