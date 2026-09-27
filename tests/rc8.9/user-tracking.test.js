#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/user-tracking.test.js
 *
 * RC8.9B — user activity tracking contract.
 *
 *  A  utils/userTrack: event() queues; flush() calls trackEvent; never throws
 *  B  trackEvent fn: writes user_events; dedupes by eventId; rejects non-whitelist
 *  C  trackEvent fn: DB failure → still returns code 0 (never blocks business flow)
 *  D  adminGetDashboard: user_events missing → dashboard STILL code 0 (fail-soft funnel)
 *  E  adminGetDashboard: funnel stages + trend + recentUsers present on success
 *  F  adminGetUserDetail: masked OpenID by default; raw only when requested
 *  G  adminGetUserDetail: non-admin → PERMISSION_DENIED; missing openid → PARAM_ERROR
 *
 * Node built-ins only. Runnable from repo root.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const OWNER = 'oOWNER_OPENID_FOR_TEST'

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const read = (p) => fs.readFileSync(p, 'utf8')

// ── generic cloud-fn loader ───────────────────────────────────────────────
function loadFn(fnDir, beh, wxOpenid) {
  const src = read(path.join(ROOT, fnDir, 'index.js'))
  const mod = { exports: {} }
  const state = { added: [], events: beh.events || [] }
  function makeQuery(name) {
    const q = {
      where: (w) => { q._w = w; return q },
      field: () => q, limit: () => q, orderBy: () => q, skip: () => q,
      count: () => run(name, 'count'),
      get: () => run(name, 'get'),
    }
    return q
  }
  function run(name, kind) {
    const b = beh[name] || {}
    if (b.reject) return Promise.reject(new Error(`simulated ${name} unavailable`))
    if (name === 'system_configs') {
      const admin = beh.admin === false ? [] : [{ key: 'admin_users', status: 'active', value: { openids: [OWNER] } }]
      return Promise.resolve({ data: admin })
    }
    if (name === 'user_events') {
      if (kind === 'count') return Promise.resolve({ total: b.count != null ? b.count : (b.docs ? b.docs.length : 0) })
      return Promise.resolve({ data: b.docs || [] })
    }
    if (kind === 'count') return Promise.resolve({ total: b.count != null ? b.count : 0 })
    return Promise.resolve({ data: b.docs || [] })
  }
  const db = {
    command: { gte: (v) => ({ $gte: v }), neq: (v) => ({ $ne: v }) },
    collection: (name) => {
      const q = makeQuery(name)
      q.add = (o) => { if (beh[name] && beh[name].reject) return Promise.reject(new Error('add fail')); state.added.push({ name, data: o.data }); return Promise.resolve({ _id: 'x' }) }
      return q
    },
  }
  const cloud = { DYNAMIC_CURRENT_ENV: 'dyn', init() {}, database: () => db, getWXContext: () => ({ OPENID: wxOpenid }) }
  const fakeRequire = (id) => {
    if (id === 'wx-server-sdk') return cloud
    if (id.startsWith('./lib/')) return require(path.join(ROOT, fnDir, id))
    return require(id)
  }
  const ctx = { module: mod, exports: mod.exports, require: fakeRequire, console, process, setTimeout, Promise, Object, Date, Math, JSON, Array, String, Number, RegExp }
  vm.runInNewContext(src, ctx, { filename: path.join(fnDir, 'index.js') })
  return { main: mod.exports.main, state }
}

// ── page/util loader ──────────────────────────────────────────────────────
function loadModule(file, globals) {
  const mod = { exports: {} }
  const ctx = Object.assign({ module: mod, exports: mod.exports, require, console, process, setTimeout, clearTimeout, Date, Math, JSON, Object, Array, Promise, String, Number }, globals || {})
  vm.runInNewContext(read(file), ctx, { filename: file })
  return mod.exports
}

;(async () => {
  console.log('RC8.9B user tracking')

  // ── A: userTrack queues + flush + never throws ──────────────────────────
  {
    let called = null
    const calls = []
    const wx = { cloud: { callFunction: (o) => { called = o; calls.push(o); return Promise.resolve({ result: { code: 0 } }) } } }
    let timerFn = null
    const app = { globalData: {} }
    const track = loadModule(path.join(ROOT, 'utils', 'userTrack.js'), {
      wx, getApp: () => app, getCurrentPages: () => [{ route: 'pages/home/home' }],
      setTimeout: (fn, t) => { timerFn = fn; return 1 }, clearTimeout: () => {},
    })
    track.event('home_view', { a: 1 })
    ok(track.getQueueLength() === 1, 'A: event queued')
    track.flush()
    ok(called && called.name === 'trackEvent', 'A: flush calls trackEvent fn')
    ok(called && called.data.events[0].eventName === 'home_view', 'A: event name forwarded')
    ok(called.data.events[0].page === 'pages/home/home', 'A: page captured')
    ok(called.data.events[0].sessionId, 'A: sessionId present')
    // throwing wx must not throw into caller
    let threw = false
    try {
      const track2 = loadModule(path.join(ROOT, 'utils', 'userTrack.js'), {
        wx: { cloud: { callFunction: () => { throw new Error('boom') } } },
        getApp: () => ({ globalData: {} }), getCurrentPages: () => [], setTimeout: () => 1, clearTimeout: () => {},
      })
      track2.event('qa_open'); track2.flush()
    } catch (_) { threw = true }
    ok(!threw, 'A: tracking never throws into business flow')
  }

  // ── B: trackEvent writes + dedupes + rejects non-whitelist ──────────────
  {
    const { main, state } = loadFn('cloudfunctions/trackEvent', {}, OWNER)
    const r = await main({ events: [{ eventName: 'strategy_start', timestamp: 1, metadata: { x: 1 } }, { eventName: 'HACKED_EVENT' }] })
    ok(r.code === 0, 'B: returns code 0')
    ok(r.data.accepted === 1, `B: accepted only whitelisted (${r.data.accepted})`)
    const doc = state.added.find(a => a.name === 'user_events')
    ok(doc && doc.data.eventName === 'strategy_start', 'B: wrote user_events doc')
    ok(doc.data.userId === OWNER && doc.data.openid === OWNER, 'B: userId from server context')
    ok(doc.data.eventVersion === 1, 'B: eventVersion stamped')
    // dedupe
    const { main: main2, state: st2 } = loadFn('cloudfunctions/trackEvent', { user_events: { docs: [{ eventId: 'dup1' }] } }, OWNER)
    const r2 = await main2({ events: [{ eventId: 'dup1', eventName: 'home_view' }] })
    ok(r2.code === 0 && st2.added.length === 0, 'B: duplicate eventId not re-written')
  }

  // ── C: trackEvent DB failure → still code 0 (non-blocking) ──────────────
  {
    const { main } = loadFn('cloudfunctions/trackEvent', { user_events: { reject: true } }, OWNER)
    const r = await main({ events: [{ eventName: 'report_success' }] })
    ok(r.code === 0, 'C: soft-fail keeps code 0 on DB error')
  }

  // ── D + E: dashboard fail-soft funnel + present on success ──────────────
  {
    // user_events missing → dashboard still success
    const { main } = loadFn('cloudfunctions/adminGetDashboard', { user_events: { reject: true }, users: { count: 5 }, orders: { count: 2 } }, OWNER)
    const r = await main({}, {})
    ok(r.code === 0, 'D: dashboard code 0 when user_events unavailable')
    ok(r.data.funnel === null && r.data.recentUsers === null, 'D: optional sections null (not crashing)')

    // success: funnel + trend + recentUsers
    const beh = {
      users: { count: 10, docs: [{ createdAt: Date.now() }] },
      orders: { count: 3 },
      user_events: { count: 4, docs: [{ openid: 'oABCdef1234', eventName: 'report_success', timestamp: Date.now() }, { openid: 'oXYZ9999', eventName: 'payment_view', timestamp: Date.now() }] },
    }
    const { main: main2 } = loadFn('cloudfunctions/adminGetDashboard', beh, OWNER)
    const r2 = await main2({}, {})
    ok(r2.code === 0 && Array.isArray(r2.data.funnel) && r2.data.funnel.length === 6, 'E: 6-stage funnel')
    ok(Array.isArray(r2.data.trend) && r2.data.trend.length === 7, 'E: 7-day trend')
    ok(Array.isArray(r2.data.recentUsers) && r2.data.recentUsers.length === 2, 'E: recentUsers list')
    ok(/^User #[0-9A-Z]{4}$/.test(r2.data.recentUsers[0].label), 'E: recentUser label masked')
  }

  // ── F: user detail masking + raw on request ─────────────────────────────
  {
    const beh = { users: { docs: [{ openid: 'oABCDEFGHIJK1234xyz', createdAt: 1000, lastActiveAt: 2000 }] }, orders: { docs: [] }, user_events: { docs: [{ eventName: 'home_view', timestamp: 2000 }] }, memberships: { docs: [] } }
    const { main } = loadFn('cloudfunctions/adminGetUserDetail', beh, OWNER)
    const r = await main({ openid: 'oABCDEFGHIJK1234xyz' }, {})
    ok(r.code === 0, 'F: detail ok')
    ok(r.data.openid === undefined, 'F: raw openid NOT returned by default')
    ok(/^\w{4}\*\*\*\w{4}$/.test(r.data.maskedOpenid), `F: maskedOpenid (${r.data.maskedOpenid})`)
    ok(r.data.label === 'User #1234' || /^User #/.test(r.data.label), 'F: label present')
    ok(Array.isArray(r.data.timeline) && r.data.timeline[0].text === '打开首页', 'F: timeline text mapped')
    const r2 = await main({ openid: 'oABCDEFGHIJK1234xyz', includeRawOpenid: true }, {})
    ok(r2.data.openid === 'oABCDEFGHIJK1234xyz', 'F: raw returned only when requested')
  }

  // ── G: user detail auth ─────────────────────────────────────────────────
  {
    const beh = { admin: false, users: { docs: [] }, orders: { docs: [] }, user_events: { docs: [] } }
    const { main } = loadFn('cloudfunctions/adminGetUserDetail', beh, OWNER)
    const r = await main({ openid: 'oX' }, {})
    ok(r.code === 10005, `G: non-admin denied (${r.code})`)
    const { main: main2 } = loadFn('cloudfunctions/adminGetUserDetail', {}, OWNER)
    const r2 = await main2({}, {})
    ok(r2.code === 10003, `G: missing openid PARAM_ERROR (${r2.code})`)
  }

  console.log(`  _TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
