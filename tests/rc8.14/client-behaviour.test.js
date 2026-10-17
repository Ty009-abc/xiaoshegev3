'use strict'
/**
 * tests/rc8.14/client-behaviour.test.js — RC814 Phase 1 client integration
 *
 * Category: LOCAL AUTOMATED CLIENT TEST.
 * It is NOT a device-based E2E, NOT a real WeChat payment E2E, and NOT a
 * mock-authorized network E2E. It loads the REAL page source and drives its real
 * methods with a stubbed wx runtime, so branching (1002/409/4001/resume/
 * completion) is exercised as code rather than asserted from grep alone.
 *
 * Covers the Phase-1 TEST list:
 *   staging client startup · free Day1–Day3 · Day4 payment wall · 409 refresh and
 *   resume · cold restart same recordId · completed state · no unintended
 *   production calls.
 *
 * NOTE ON FIXTURES (learned the hard way; product code was correct):
 *   - `loading` defaults to TRUE in page data, and onSubmit early-returns when
 *     it is truthy → every submit scenario must inject loading:false first.
 *   - getChallengeEvent payloads must carry eventId+title+choices[], otherwise
 *     the page correctly throws 题目数据不完整 and the scenario measures the
 *     guard instead of the branch under test.
 *   - onShow() calls nextEvent() fire-and-forget (correct for a lifecycle hook),
 *     so assertions must drain the microtask queue first.
 */
const path = require('path')
const fs = require('fs')

const REPO = path.resolve(__dirname, '..', '..')
const PAGE = path.join(REPO, 'pages/challenge-play/challenge-play.js')
const PROD_ID = 'fanshex-d2g0adgv7dfbc9bdc'
const STAGING_ID = 'fanshen002-d9g0rjr3b6e313af5'

let pass = 0
let fail = 0
const ok = (c, m) => { if (c) { pass++ } else { fail++; console.log('  FAIL ' + m) } }
const T = (s) => console.log('\n── ' + s)

// ── stubbed wx runtime ──
const calls = { toasts: [], modals: [], redirects: [], navs: [], switchTabs: [], reLaunch: [], storage: {} }
let scripted = []
let capturedReqs = []
let pageCfg = null

global.wx = {
  cloud: {
    init () {},
    callFunction ({ name, data }) {
      capturedReqs.push({ name, data: JSON.parse(JSON.stringify(data || {})) })
      const next = scripted.shift()
      if (next === undefined) return Promise.resolve({ result: { code: 0, data: {} } })
      if (next instanceof Error) return Promise.reject(next)
      return Promise.resolve({ result: next })
    },
  },
  getStorageSync: (k) => calls.storage[k],
  setStorageSync: (k, v) => { calls.storage[k] = v },
  showToast: (o) => calls.toasts.push(o),
  showModal: (o) => { calls.modals.push(o); if (o.success) o.success({ confirm: false, cancel: true }) },
  redirectTo: (o) => calls.redirects.push(o),
  navigateTo: (o) => calls.navs.push(o),
  switchTab: (o) => calls.switchTabs.push(o),
  reLaunch: (o) => calls.reLaunch.push(o),
  navigateBack: () => {},
  setEnableDebug: () => {},
}
global.getApp = () => ({ globalData: { openid: 'synth-rc814@staging.invalid' } })
global.__wxConfig = { envVersion: 'develop' }
global.Page = (cfg) => { pageCfg = cfg }
global.setTimeout = ((fn) => { try { fn() } catch (_) {} return 0 })

/** A realistic getChallengeEvent envelope (all fields the page validates). */
function ev (eventId, day, current) {
  return {
    code: 0,
    data: {
      eventId,
      title: '事件 ' + eventId,
      description: 'desc',
      day,
      difficulty: 2,
      progress: { current: current || day, total: 30, day },
      choices: [
        { key: 'A', text: '选项A', tags: [] },
        { key: 'B', text: '选项B', tags: [] },
        { key: 'C', text: '选项C', tags: [] },
      ],
      trialMode: false,
    },
  }
}

function makePage () {
  calls.toasts.length = 0; calls.modals.length = 0; calls.redirects.length = 0
  calls.navs.length = 0; calls.switchTabs.length = 0; calls.reLaunch.length = 0
  scripted = []; capturedReqs = []
  delete require.cache[require.resolve(PAGE)]
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(path.join(REPO, 'services')) || k.startsWith(path.join(REPO, 'utils'))) delete require.cache[k]
  }
  require(PAGE)
  if (!pageCfg) throw new Error('Page() was not called')
  const page = Object.assign({}, pageCfg)
  page.data = JSON.parse(JSON.stringify(pageCfg.data || {}))
  page.setData = function (patch) {
    for (const k of Object.keys(patch || {})) {
      if (k.includes('.')) {
        const [a, b] = k.split('.')
        this.data[a] = Object.assign({}, this.data[a], { [b]: patch[k] })
      } else this.data[k] = patch[k]
    }
  }
  return page
}

async function drain () { for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)) }

async function main () {
  console.log('RC814 PHASE 1 — CLIENT BEHAVIOUR (real page source, stubbed runtime)')

  // ── 0) env isolation: no hardcoded prod env, resolver-driven ──
  T('0) staging client startup + env isolation')
  const appSrc = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8')
  ok(!/env\s*:\s*'fanshex-d2g0adgv7dfbc9bdc'/.test(appSrc), 'app.js contains NO hardcoded production envId')
  ok(/resolveCloudEnv/.test(appSrc), 'app.js resolves the env at build target')
  ok(/CLOUD_ENV_UNRESOLVED|resolveCloudEnv\(\)/.test(appSrc), 'app.js wires the fail-closed resolver path')
  {
    // boot the real app.js against a staging generated target
    const genPath = path.join(REPO, 'config', 'cloudEnv.generated.js')
    const resPath = path.join(REPO, 'config', 'cloudEnv.js')
    const appPath = path.join(REPO, 'app.js')
    const trackPath = path.join(REPO, 'utils', 'userTrack.js')
    const savedGen = fs.readFileSync(genPath, 'utf8')
    const savedCacheGen = require.cache[genPath]
    fs.writeFileSync(genPath, "module.exports = { buildTarget: 'staging', envId: '" + STAGING_ID + "', buildTargetSealed: true }\n", 'utf8')
    delete require.cache[appPath]; delete require.cache[resPath]; delete require.cache[genPath]
    require.cache[trackPath] = { id: trackPath, filename: trackPath, loaded: true, exports: { event () {} } }
    const inits = []
    const fns = []
    const origWx = global.wx
    const origApp = global.App
    let appObj = null
    global.wx = {
      cloud: { init (o) { inits.push(o) }, callFunction (o) { fns.push(o); return Promise.resolve({ result: { code: 0, data: { user: {}, profile: {}, isNewUser: false, openid: 'x' } } }) } },
      showModal () {}, setEnableDebug () {}, getStorageSync () { return null }, setStorageSync () {},
    }
    global.App = (o) => { appObj = o }
    try {
      require(appPath)
      appObj.onLaunch.call(appObj)
      await drain()
    } finally {
      global.wx = origWx
      global.App = origApp
      fs.writeFileSync(genPath, savedGen, 'utf8')
      delete require.cache[appPath]; delete require.cache[resPath]; delete require.cache[genPath]
      if (savedCacheGen) require.cache[genPath] = savedCacheGen
    }
    ok(inits.length === 1, 'staging startup: wx.cloud.init called exactly once')
    ok(inits[0] && inits[0].env === STAGING_ID, 'staging startup: bound to the staging envId')
    ok(inits[0] && inits[0].env !== PROD_ID, 'staging startup: NOT bound to production')
    ok(fns.length > 0 && fns.every((f) => !f.env), 'no per-call env override can leak to production')
  }

  // ── 1) free Day1–Day3 are playable ──
  T('1) free challenge Day1 to Day3')
  {
    const p = makePage()
    p.data.recordId = 'CR_SYNTH'
    scripted.push(ev('CE001', 1))
    await p.nextEvent()
    ok(p.data.challengeLocked === false, 'Day1 opens without a paywall')
    ok(p.data.event && p.data.event.eventId === 'CE001', 'Day1 event rendered')
    ok(p.data.event.choices.length === 3, 'Day1 offers 3 choices')

    p.data.loading = false
    p.data.selectedKey = 'A'
    scripted.push({ code: 0, data: { isLast: false, currentEventIndex: 1 } })
    scripted.push(ev('CE002', 2))
    await p.onSubmit()
    ok(calls.toasts.length === 0, 'Day1 submit accepted with no error')
    ok(p.data.challengeLocked === false, 'still unlocked after Day1')

    p.data.loading = false
    p.data.selectedKey = 'B'
    scripted.push({ code: 0, data: { isLast: false, currentEventIndex: 2 } })
    scripted.push(ev('CE003', 3))
    await p.onSubmit()
    ok(p.data.challengeLocked === false, 'Day3 answer still free (TRIAL_LIMIT boundary is the 4th)')
  }

  // ── 2) Day4 payment wall ──
  T('2) Day4 payment wall')
  {
    const p = makePage()
    p.data.recordId = 'CR_SYNTH'
    scripted.push({ code: 1002, message: '免费体验已结束，付费后解锁完整30天挑战' })
    await p.nextEvent()
    ok(p.data.challengeLocked === true, 'Day4 read locks')
    ok(p.data.loadFailed === false, 'lock is NOT rendered as a load failure')
    ok(p.data.loading === false, 'spinner cleared (no endless loading)')
    ok(/免费体验已结束/.test(p.data.lockReason || ''), 'lockReason carries the server message')
    ok(!p.data.event, 'no event leaked behind the lock')
    p.onUnlock()
    ok(calls.navs.length === 1 && /membership/.test(calls.navs[0].url), 'onUnlock routes to membership/payment')

    const q = makePage()
    q.data.recordId = 'CR_SYNTH'
    q.data.loading = false
    q.data.event = { eventId: 'CE003' }
    q.data.selectedKey = 'B'
    q.data.progress = { current: 3, total: 30, day: 3 }
    scripted.push({ code: 1002, message: '免费体验已结束' })
    await q.onSubmit()
    ok(q.data.challengeLocked === true, 'Day3→Day4 submit locks')
    ok(q.data.progress.day === 3, 'progress not advanced past Day3')
    ok(calls.toasts.length === 0, 'no generic failure toast for the paywall')
  }

  // ── 3) 409 refresh and resume ──
  T('3) 409 refresh and resume')
  {
    const p = makePage()
    p.data.recordId = 'CR_SYNTH'
    p.data.loading = false
    p.data.event = { eventId: 'CE001' }
    p.data.selectedKey = 'A'
    scripted.push({ code: 409, message: '该题已用其他选项提交，请刷新' })
    scripted.push(ev('CE002', 2))
    await p.onSubmit()
    const gce = capturedReqs.filter((r) => r.name === 'getChallengeEvent')
    ok(gce.length === 1, 'exactly one re-fetch after 409')
    ok(capturedReqs[0].data.recordId === 'CR_SYNTH', 're-sync used the SAME recordId')
    ok(calls.toasts.some((t) => /同步/.test(t.title || '')), 'user told progress was re-synced')
    ok(p.data.challengeLocked === false, 'not locked on conflict')
    ok(p.data.submitted === false, 'submit flag reset so the user can retry')
    ok(p.data.event && p.data.event.eventId === 'CE002', 'advanced to the server-authoritative event')
  }

  // ── 4) cold restart keeps the same recordId ──
  T('4) cold restart same recordId')
  {
    const p = makePage()
    scripted.push(ev('CE005', 5))
    p.onLoad({ recordId: 'CR_KEEP', mode: 'challenge' })
    await drain()
    ok(p.data.recordId === 'CR_KEEP', 'recordId preserved from onLoad')
    ok(capturedReqs[0] && capturedReqs[0].data.recordId === 'CR_KEEP', 'first GCE used that exact recordId')

    const p2 = makePage()
    p2.data.recordId = 'CR_KEEP'
    p2.data.mode = 'challenge'
    p2.data.loading = false
    p2.data.event = null
    scripted.push(ev('CE006', 6))
    await p2.onShow()
    await drain()
    ok(capturedReqs.length === 1, 'onShow restored progress after restart')
    ok(capturedReqs[0].data.recordId === 'CR_KEEP', 'restore reused the SAME recordId (no new record)')
    ok(p2.data.event && p2.data.event.eventId === 'CE006', 'event reloaded from the server')
  }

  // ── 5) completed state ──
  T('5) completed state')
  {
    const p = makePage()
    p.data.recordId = 'CR_SYNTH'
    p.data.loading = false
    p.data.event = { eventId: 'CE030' }
    p.data.selectedKey = 'C'
    scripted.push({ code: 0, data: { isLast: true, completed: true, currentEventIndex: 30 } })
    await p.onSubmit()
    ok(calls.redirects.length === 1, 'redirected to the result page')
    ok(/challenge-result/.test(calls.redirects[0].url), 'target is challenge-result')
    ok(/CR_SYNTH/.test(calls.redirects[0].url), 'result page carries the same recordId')
  }

  // ── 6) no unintended production calls ──
  T('6) no unintended production calls')
  {
    const p = makePage()
    p.data.recordId = 'CR_SYNTH'
    p.data.loading = false
    p.data.event = { eventId: 'CE001' }
    p.data.selectedKey = 'A'
    scripted.push({ code: 0, data: { isLast: false, currentEventIndex: 1 } })
    scripted.push(ev('CE002', 2))
    await p.onSubmit()
    ok(capturedReqs.length > 0, 'the flow made real calls (control)')
    ok(capturedReqs.every((r) => !r.env), 'NO call carries an env override (env comes from init only)')
    const pageSrc = fs.readFileSync(PAGE, 'utf8')
    ok(!pageSrc.includes(PROD_ID), 'page source contains no production envId')
    ok(!pageSrc.includes(STAGING_ID), 'page source contains no staging envId either')
  }

  // ── 7) duplicate submit is idempotent success ──
  T('7) duplicate submit')
  {
    const p = makePage()
    p.data.recordId = 'CR_SYNTH'
    p.data.loading = false
    p.data.event = { eventId: 'CE001' }
    p.data.selectedKey = 'A'
    scripted.push({ code: 0, data: { duplicate: true, idempotent: true, isLast: false, currentEventIndex: 1 } })
    scripted.push(ev('CE002', 2))
    await p.onSubmit()
    ok(calls.toasts.length === 0, 'no error shown for an idempotent duplicate')
    ok(p.data.challengeLocked === false, 'not locked')
    ok(capturedReqs.filter((r) => r.name === 'getChallengeEvent').length === 1, 'advanced to the next event')
  }

  // ── 8) 4001 is a documented gap, not a hang ──
  T('8) 4001 handling')
  {
    const p = makePage()
    p.data.recordId = 'CR_SYNTH'
    scripted.push({ code: 4001, message: '暂时无法读取当前进度，请重试', data: { code: 'ACTIVE_TARGET_UNREADABLE' } })
    await p.nextEvent()
    ok(!/4001/.test(fs.readFileSync(PAGE, 'utf8')), 'CONFIRMED: no dedicated 4001 branch')
    ok(p.data.loadFailed === true, 'falls into the generic load-failed state')
    ok(p.data.loading === false, 'spinner cleared even on 4001 (no endless loading)')
    ok(calls.modals.length === 1, 'a retry modal is offered (not dead-ended)')
  }

  // ── 9) locked → unlocked after entitlement lands ──
  T('9) locked → unlocked')
  {
    const p = makePage()
    p.data.recordId = 'CR_SYNTH'
    p.data.challengeLocked = true
    scripted.push({ code: 0, data: { trialMode: false, unlocked: true } })
    scripted.push(ev('CE004', 4))
    await p.onShow()
    await drain()
    ok(p.data.challengeLocked === false, 'unlock detected after payment finalization')
    ok(capturedReqs.some((r) => r.name === 'getChallengeEvent'), 'progress resumed after unlock')
  }

  // ── 10) diagnostic mode isolated ──
  T('10) diagnostic isolation')
  {
    const p = makePage()
    p.data.mode = 'diagnostic'
    p.data.recordId = 'CR_DIAG'
    await p.onShow()
    ok(capturedReqs.length === 0, 'onShow is a no-op for diagnostic mode')
  }

  console.log('\n─────────────────────────────────────────')
  console.log('CLIENT_BEHAVIOUR_TEST pass=' + pass + ' fail=' + fail)
  console.log('CLIENT_BEHAVIOUR_VERDICT = ' + (fail === 0 ? 'PASS (local automated, NOT device E2E)' : 'FAIL'))
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
