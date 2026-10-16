'use strict'
/**
 * RC8_14_D12_R6D — MOCKED-RUNTIME UI test for the Day1–Day3 submit guard + stale-result fix.
 *
 * Loads the REAL test-client `app.js` + `pages/index/index.js` in a VM with a MOCKED `wx`
 * (no network, no real startChallenge/submit, no DB). Drives the actual R6D handlers and
 * asserts the guard contract:
 *   - correct event ⇒ phase 'choose', manual choices enabled, NO auto-select;
 *   - correct event + explicit confirm ⇒ EXACTLY one submit with the SERVER eventId + chosen key;
 *   - mismatched event ⇒ phase 'mismatch', event=null (choices hidden), submit blocked, ZERO calls;
 *   - direct handler call under mismatch ⇒ ZERO submit requests + selection cleared;
 *   - locked/needPayment response ⇒ distinct 'blocked' phase, needPayment rendered, ZERO calls;
 *   - fetch entry clears stale success; fetch failure clears stale event;
 *   - manual confirmation still required; no retry; no cross-identity payload.
 *
 * Run:  node rc814-staging/staging-infra/test-client/tests/d12-day3-guard.test.js
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

function setDeep (obj, dotted, val) {
  const parts = dotted.split('.')
  let o = obj
  for (let i = 0; i < parts.length - 1; i++) { if (typeof o[parts[i]] !== 'object' || o[parts[i]] === null) o[parts[i]] = {}; o = o[parts[i]] }
  o[parts[parts.length - 1]] = val
}

function build (opts) {
  opts = opts || {}
  const state = { names: [], payloads: [], modalCalls: 0 }
  const call = (name, data) => {
    state.names.push(name); state.payloads.push({ name, data })
    const r = opts.responses && opts.responses[name]
    if (opts.reject && opts.reject[name]) return Promise.reject(new Error('net-boom'))
    if (typeof r === 'function') return Promise.resolve({ result: r(data) })
    return Promise.resolve({ result: r || { code: 0, message: 'ok', data: {} } })
  }
  const wx = {
    cloud: { init () {}, callFunction ({ name, data }) { return call(name, data) } },
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
  const base = {
    wx, console, setTimeout, clearTimeout, setImmediate, Date, Math, JSON, Promise, Number, String, Boolean, Object, Array, Error, RegExp,
    App: (cfg) => { app = cfg; return cfg }, Page: (cfg) => { page = cfg; return cfg }, getApp: () => app,
  }
  const sb1 = Object.assign({}, base, { require: (p) => requireFrom(TC, p) })
  vm.createContext(sb1); vm.runInContext('(function(){' + appSrc + '\n})()', sb1)
  const sb2 = Object.assign({}, base, { require: (p) => requireFrom(path.join(TC, 'pages/index'), p) })
  vm.createContext(sb2); vm.runInContext('(function(){' + idxSrc + '\n})()', sb2)
  app.globalData = app.globalData || {}
  page.setData = (obj) => { for (const k of Object.keys(obj)) setDeep(page.data, k, obj[k]) }
  ;['_log', '_toast', '_redact', '_d3Expected', 'onD3RecordIdInput', 'onD3SlotChange', 'onD3Fetch', 'onD3Select', 'onD3Submit', '_d3DoSubmit'].forEach((fn) => { if (typeof page[fn] === 'function') page[fn] = page[fn].bind(page) })
  return { wx, app, page, state }
}

const GAME = { code: 0, message: 'ok', data: { eventId: 'GAME015', day: 2, title: '快递爆仓', choices: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], trialMode: true, trialRemaining: 1 } }
const SLOT_DAY2 = 1 // slots[1].eventId === GAME015

;(async () => {
  // ── 0) static bindings ──
  ok(/bindtap="onD3Submit"/.test(wxml), 'WXML submit binds onD3Submit')
  ok(/onD3Submit[^>]*disabled="\{\{[^}]*day3\.phase !== 'choose'/.test(wxml), 'WXML submit disabled includes day3.phase !== choose')
  ok(/day3\.phase === 'mismatch'/.test(wxml), 'WXML renders mismatch banner')
  ok(/day3\.phase === 'blocked'/.test(wxml), 'WXML renders locked/blocked banner')
  ok(typeof build().page.onD3Submit === 'function', 'page defines onD3Submit')

  // ── 1) correct event => phase choose, event set, choices present, NO auto-select ──
  {
    const { page, state } = build({ responses: { getChallengeEvent: GAME } })
    page.data.identityOk = true; page.data.day3.slotIndex = SLOT_DAY2
    await page.onD3Fetch()
    ok(page.data.day3.phase === 'choose', 'correct event: phase=choose')
    ok(page.data.day3.event && page.data.day3.event.eventId === 'GAME015', 'correct event: event delivered to UI')
    ok(page.data.day3.selected === null, 'correct event: NO auto-select (selected=null)')
    ok(state.names.filter((n) => n === 'submitChallengeChoice').length === 0, 'correct event fetch: 0 submit calls')
  }

  // ── 2) correct event + confirm => EXACTLY one submit, server eventId + chosen key ──
  {
    const { page, state } = build({ modalSync: true, responses: { getChallengeEvent: GAME, submitChallengeChoice: { code: 0, message: 'ok', data: { recordId: 'CRx', currentEventIndex: 2 } } } })
    page.data.identityOk = true; page.data.day3.slotIndex = SLOT_DAY2
    await page.onD3Fetch()
    page.onD3Select({ currentTarget: { dataset: { key: 'B' } } })
    ok(page.data.day3.selected === 'B', 'manual select sets B')
    page.onD3Submit()
    await waitFor(() => page.data.day3.busy === false, 1000)
    const subs = state.payloads.filter((p) => p.name === 'submitChallengeChoice')
    ok(subs.length === 1, 'confirm: EXACTLY one submit call (got ' + subs.length + ')')
    ok(subs[0] && subs[0].data.eventId === 'GAME015' && subs[0].data.choiceKey === 'B', 'confirm: payload uses SERVER eventId + chosen key')
    ok(subs[0] && !('openid' in subs[0].data), 'confirm: no openid in payload (no cross-identity)')
  }

  // ── 3) mismatched event => mismatch phase, event null (choices hidden), ZERO submits ──
  {
    const { page, state } = build({ responses: { getChallengeEvent: GAME } })
    page.data.identityOk = true; page.data.day3.slotIndex = 0 // expects CE012, server returns GAME015
    await page.onD3Fetch()
    ok(page.data.day3.phase === 'mismatch', 'mismatch: phase=mismatch')
    ok(page.data.day3.event === null, 'mismatch: event=null (choices hidden)')
    ok(state.names.filter((n) => n === 'submitChallengeChoice').length === 0, 'mismatch fetch: 0 submit calls')
    ok(/不匹配/.test(page.data.day3.fetchText), 'mismatch: explicit explanation shown')
  }

  // ── 4) direct handler call under mismatch => ZERO submit requests + selection cleared ──
  {
    const { page, state } = build({ modalSync: true, responses: { submitChallengeChoice: { code: 0 } } })
    page.data.identityOk = true; page.data.day3.slotIndex = 0
    page.data.day3.phase = 'mismatch'; page.data.day3.selected = 'B'
    page.data.day3.event = { eventId: 'GAME015', choices: [{ key: 'A' }, { key: 'B' }] }
    page.onD3Submit()
    await sleep(20)
    ok(state.names.filter((n) => n === 'submitChallengeChoice').length === 0, 'mismatch handler: ZERO submit calls')
    ok(state.modalCalls === 0, 'mismatch handler: no confirm modal even shown')
  }
  {
    // phase=choose but event.eventId != expected slot => second line of defense
    const { page, state } = build({ modalSync: true, responses: { submitChallengeChoice: { code: 0 } } })
    page.data.identityOk = true; page.data.day3.slotIndex = 0 // expects CE012
    page.data.day3.phase = 'choose'; page.data.day3.selected = 'A'
    page.data.day3.event = { eventId: 'GAME015', choices: [{ key: 'A' }] } // served ≠ expected
    page.onD3Submit()
    await sleep(20)
    ok(state.names.filter((n) => n === 'submitChallengeChoice').length === 0, 'servedId≠expectedId: ZERO submit calls')
    ok(page.data.day3.event === null && page.data.day3.selected === null && page.data.day3.phase === 'mismatch', 'servedId≠expectedId: cleared + forced mismatch')
  }

  // ── 5) mismatched event clears a pre-existing selection ──
  {
    const { page } = build({ responses: { getChallengeEvent: GAME } })
    page.data.identityOk = true; page.data.day3.slotIndex = 0
    page.data.day3.selected = 'B'
    await page.onD3Fetch()
    ok(page.data.day3.selected === null, 'mismatch fetch clears prior selection')
  }

  // ── 6) guard failure clears stale success (identity guard returns early) ──
  {
    const { page, state } = build({ responses: { getChallengeEvent: GAME } })
    page.data.day3.submitText = '✅ 提交成功 code=0'
    page.data.identityOk = false // guard returns BEFORE network
    await page.onD3Fetch()
    ok(page.data.day3.submitText === '', 'identity guard failure clears stale success text')
    ok(state.names.length === 0, 'identity guard failure: 0 network calls')
  }

  // ── 7) fetch failure clears stale event ──
  {
    const { page } = build({ reject: { getChallengeEvent: true } })
    page.data.identityOk = true; page.data.day3.slotIndex = SLOT_DAY2
    page.data.day3.event = { eventId: 'GAME015' }
    await page.onD3Fetch()
    ok(page.data.day3.event === null, 'fetch failure clears stale event')
    ok(page.data.day3.phase === 'error', 'fetch failure phase=error')
  }

  // ── 8) locked response => blocked phase, needPayment rendered, choices hidden, submit blocked ──
  {
    const LOCK = { code: 0, message: 'ok', data: { locked: true, needPayment: true, currentEventIndex: 3 } }
    const { page, state } = build({ modalSync: true, responses: { getChallengeEvent: LOCK, submitChallengeChoice: { code: 0 } } })
    page.data.identityOk = true; page.data.day3.slotIndex = 2
    await page.onD3Fetch()
    ok(page.data.day3.phase === 'blocked', 'locked: distinct blocked phase')
    ok(page.data.day3.event === null, 'locked: no answer choices delivered')
    ok(/needPayment=true/.test(page.data.day3.fetchText) && /locked=true/.test(page.data.day3.fetchText), 'locked: needPayment/locked rendered')
    page.data.day3.selected = 'A' // even if a choice were somehow set
    page.onD3Submit()
    await sleep(20)
    ok(state.names.filter((n) => n === 'submitChallengeChoice').length === 0, 'locked: ZERO submit calls')
  }

  // ── 9) manual confirmation required ──
  {
    const { page, state } = build({ modalSync: true, modalResult: false, responses: { getChallengeEvent: GAME, submitChallengeChoice: { code: 0 } } })
    page.data.identityOk = true; page.data.day3.slotIndex = SLOT_DAY2
    await page.onD3Fetch()
    page.onD3Select({ currentTarget: { dataset: { key: 'A' } } })
    page.onD3Submit()
    await sleep(20)
    ok(state.names.filter((n) => n === 'submitChallengeChoice').length === 0, 'cancel: ZERO submits (confirmation required)')
  }

  // ── 10) no automatic retry on submit rejection ──
  {
    const { page, state } = build({ modalSync: true, reject: { submitChallengeChoice: true }, responses: { getChallengeEvent: GAME } })
    page.data.identityOk = true; page.data.day3.slotIndex = SLOT_DAY2
    await page.onD3Fetch()
    page.onD3Select({ currentTarget: { dataset: { key: 'A' } } })
    page.onD3Submit()
    await waitFor(() => page.data.day3.busy === false, 1000)
    await sleep(40)
    ok(state.names.filter((n) => n === 'submitChallengeChoice').length === 1, 'rejection: exactly 1 attempt (no retry)')
  }

  // ── 11) source-level: submit path never invokes startChallenge / has no prod fallback / no openid ──
  const stripC = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const idxCode = stripC(idxSrc)
  ok(!/startChallenge/.test(idxCode.match(/onD3[\s\S]*?\n  \},/g) ? idxCode.match(/onD3[\s\S]*?\n  \},/g).join('\n') : ''), 'R6D handlers never reference startChallenge')
  ok(!/DYNAMIC_CURRENT_ENV/.test(idxCode), 'no DYNAMIC_CURRENT_ENV (no prod fallback)')
  ok(!/fanshex-d2g0adgv7dfbc9bdc/.test(idxCode), 'no production envId literal in index.js')

  console.log('D12_DAY3_GUARD pass=' + pass + ' fail=' + fail)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('HARNESS_ERROR', e); process.exit(2) })
