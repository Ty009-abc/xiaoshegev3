#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.8/admin-dashboard-recovery.test.js
 *
 * RC8.8_ADMIN_DASHBOARD_RECOVERY — resilience contract for the admin dashboard.
 *
 *   A  ai_logs exists          -> dashboard success (code=0, real telemetry)
 *   B  ai_logs missing/fails   -> dashboard STILL success + safe defaults
 *   C  users query fails       -> DB_ERROR (core hard fail)
 *   D  orders query fails      -> DB_ERROR (core hard fail)
 *   E  client r.code !== 0     -> loading becomes false
 *   F  network exception       -> loading becomes false
 *   G  pull-down refresh       -> stopPullDownRefresh always called
 *
 * Node built-ins only. Runnable from repo root.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const FN = path.join(ROOT, 'cloudfunctions', 'adminGetDashboard', 'index.js')
const PAGE = path.join(ROOT, 'pages', 'admin', 'dashboard', 'dashboard.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

// ─────────────────────────────────────────────────────────────────────────
// Cloud-function harness
// ─────────────────────────────────────────────────────────────────────────
const OWNER = 'oOWNER_OPENID_FOR_TEST'

function makeQuery(name, beh) {
  const q = {
    where: () => q,
    field: () => q,
    limit: () => q,
    orderBy: () => q,
    skip: () => q,
    count: () => run(name, 'count', beh),
    get: () => run(name, 'get', beh),
  }
  return q
}

function run(name, kind, beh) {
  const b = beh[name] || {}
  if (b.reject) return Promise.reject(new Error(`simulated ${name} unavailable`))
  if (name === 'system_configs') {
    return Promise.resolve({ data: [{ key: 'admin_users', status: 'active', value: { openids: [OWNER] } }] })
  }
  if (kind === 'count') {
    // RC8.9C R1B: support an ordered queue (today-count, legacy-count, ...)
    if (Array.isArray(b.counts) && b.counts.length) {
      const v = b.counts.length > 1 ? b.counts.shift() : b.counts[0]
      return Promise.resolve({ total: v })
    }
    return Promise.resolve({ total: b.count != null ? b.count : 0 })
  }
  return Promise.resolve({ data: b.docs || [] })
}

function loadFn(beh) {
  const src = fs.readFileSync(FN, 'utf8')
  const mod = { exports: {} }
  const db = {
    command: { gte: (v) => ({ $gte: v }), neq: (v) => ({ $ne: v }) },
    collection: (name) => makeQuery(name, beh),
  }
  const cloud = {
    DYNAMIC_CURRENT_ENV: 'dyn',
    init() {},
    database: () => db,
    getWXContext: () => ({ OPENID: OWNER }),
  }
  const fakeRequire = (id) => {
    if (id === 'wx-server-sdk') return cloud
    if (id.startsWith('./lib/')) return require(path.join(ROOT, 'cloudfunctions', 'adminGetDashboard', id))
    return require(id)
  }
  const ctx = { module: mod, exports: mod.exports, require: fakeRequire, console, process, setTimeout, Promise, Object, Date, Math, JSON, Array }
  vm.runInNewContext(src, ctx, { filename: FN })
  return mod.exports.main
}

// ─────────────────────────────────────────────────────────────────────────
// Page harness
// ─────────────────────────────────────────────────────────────────────────
function loadPage(serviceStub, wxStub) {
  const src = fs.readFileSync(PAGE, 'utf8')
  let cfg = null
  const sandbox = {
    Page: (c) => { cfg = c },
    require: (id) => {
      if (id.includes('adminService')) return serviceStub
      return require(id)
    },
    console,
    wx: wxStub,
    setTimeout,
    Promise,
    Object,
    Math,
    Date,
    JSON,
  }
  vm.runInNewContext(src, sandbox, { filename: PAGE })
  return cfg
}

function mkPage(cfg) {
  const p = Object.assign({}, cfg)
  p.data = JSON.parse(JSON.stringify(cfg.data))
  p.setData = function (o) { Object.assign(this.data, o) }
  return p
}

const wait = () => new Promise((r) => setTimeout(r, 20))

;(async () => {
  console.log('RC8.8 admin dashboard recovery — resilience contract')

  // ── A: v2 model_call telemetry exists -> success with real telemetry ────
  {
    const v2 = [
      { telemetryVersion: 2, operation: 'model_call', status: 'SUCCESS', estimatedCostCny: 0.001668, latencyMs: 2644 },
      { telemetryVersion: 2, operation: 'model_call', status: 'SUCCESS', estimatedCostCny: 0.0005, latencyMs: 1200 },
      { telemetryVersion: 2, operation: 'model_call', status: 'PROVIDER_ERROR', estimatedCostCny: null, latencyMs: 40 },
    ]
    // get → cumulative rows; counts queue → [today, legacy]
    const beh = { ai_logs: { docs: v2, counts: [2, 1] } }
    const main = loadFn(beh)
    const r = await main({}, {})
    ok(r.code === 0, `A: code=0 (${r.code})`)
    ok(r.data.aiRuntime.totalCalls === 3, `A: cumulative=3 (${r.data.aiRuntime.totalCalls})`)
    ok(r.data.today.aiCalls === 2, `A: today=2 (${r.data.today.aiCalls})`)
    ok(r.data.aiRuntime.failedCalls === 1, `A: failedCalls=1 (${r.data.aiRuntime.failedCalls})`)
    ok(r.data.aiRuntime.errorRate === '33.3%', `A: errorRate=33.3% (${r.data.aiRuntime.errorRate})`)
    ok(r.data.aiRuntime.pricedCallCount === 2 && r.data.aiRuntime.unpricedCallCount === 1, 'A: priced/unpriced counts')
    ok(r.data.aiRuntime.estimatedCostCny === 0.002168, `A: cost sum (${r.data.aiRuntime.estimatedCostCny})`)
  }

  // ── B: ai_logs unavailable -> STILL success + safe defaults ─────────────
  {
    const beh = { ai_logs: { reject: true }, users: { count: 7 }, orders: { count: 2 } }
    const main = loadFn(beh)
    const r = await main({}, {})
    ok(r.code === 0, `B: code=0 despite ai_logs failure (${r.code})`)
    ok(r.data.aiRuntime.totalCalls === 0 && r.data.today.aiCalls === 0, 'B: telemetry defaults 0')
    ok(r.data.aiRuntime.estimatedCostCny === null, 'B: no telemetry → cost null (not ¥0)')
    ok(r.data.aiRuntime.errorRate === null, `B: 0 samples → errorRate null / UI -- (${r.data.aiRuntime.errorRate})`)
    ok(r.data.aiRuntime.available === false, 'B: telemetry marked unavailable')
    ok(r.data.totalUsers === 7, `B: core users still present (${r.data.totalUsers})`)
  }

  // ── C: users fails -> DB_ERROR ──────────────────────────────────────────
  {
    const beh = { users: { reject: true } }
    const main = loadFn(beh)
    const r = await main({}, {})
    ok(r.code === 10007, `C: DB_ERROR on users failure (${r.code})`)
  }

  // ── D: orders fails -> DB_ERROR ─────────────────────────────────────────
  {
    const beh = { orders: { reject: true } }
    const main = loadFn(beh)
    const r = await main({}, {})
    ok(r.code === 10007, `D: DB_ERROR on orders failure (${r.code})`)
  }

  // ── E: client r.code !== 0 -> loading false ─────────────────────────────
  {
    const toasts = []
    const wxStub = { showToast: (o) => toasts.push(o), stopPullDownRefresh() {}, navigateTo() {} }
    const svc = { getDashboard: () => Promise.resolve({ code: 10007, message: 'boom', data: null }) }
    const p = mkPage(loadPage(svc, wxStub))
    p.fetch(); await wait()
    ok(p.data.loading === false, 'E: loading cleared on server error')
    ok(toasts.length === 1, `E: toast shown (${toasts.length})`)
    ok(p.data.stats === null, 'E: stats not set on error')
  }

  // ── F: network exception -> loading false ───────────────────────────────
  {
    const wxStub = { showToast() {}, stopPullDownRefresh() {}, navigateTo() {} }
    const svc = { getDashboard: () => Promise.reject(new Error('net down')) }
    const p = mkPage(loadPage(svc, wxStub))
    p.fetch(); await wait()
    ok(p.data.loading === false, 'F: loading cleared on network exception')
  }

  // ── F2: success path still renders ──────────────────────────────────────
  {
    const wxStub = { showToast() {}, stopPullDownRefresh() {}, navigateTo() {} }
    const svc = { getDashboard: () => Promise.resolve({ code: 0, data: { totalUsers: 5, totalRevenue: 1234 } }) }
    const p = mkPage(loadPage(svc, wxStub))
    p.fetch(); await wait()
    ok(p.data.loading === false && p.data.stats && p.data.stats.totalUsers === 5, 'F2: success renders stats + loading false')
  }

  // ── G: pull-down refresh always stops ───────────────────────────────────
  {
    let stops = 0
    const wxStub = { showToast() {}, stopPullDownRefresh: () => { stops++ }, navigateTo() {} }
    // success
    let p = mkPage(loadPage({ getDashboard: () => Promise.resolve({ code: 0, data: {} }) }, wxStub))
    p.onPullDownRefresh(); await wait()
    ok(stops === 1, `G: stop on success (${stops})`)
    // server error
    p = mkPage(loadPage({ getDashboard: () => Promise.resolve({ code: 10007, message: 'x' }) }, wxStub))
    p.onPullDownRefresh(); await wait()
    ok(stops === 2, `G: stop on server error (${stops})`)
    // network error
    p = mkPage(loadPage({ getDashboard: () => Promise.reject(new Error('net')) }, wxStub))
    p.onPullDownRefresh(); await wait()
    ok(stops === 3, `G: stop on network error (${stops})`)
  }

  console.log(`  _TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
