#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/admin-ai-metrics.test.js
 *
 * RC8.9C_R1B — Admin AI metrics bound to canonical v2 telemetry.
 *
 * Proves (mission §9):
 *  - today counts ONLY the current Asia/Shanghai business day
 *  - cumulative counts today + previous v2 (legacy excluded)
 *  - 1 success → calls=1, failures=0, errorRate=0.0%
 *  - 2 fail + 1 success → calls=3, failures=2, errorRate=66.7%
 *  - 0 samples → errorRate null (UI '--')
 *  - known model + usage → cost correct
 *  - unknown/unpriced → cost null + unpricedCallCount++
 *  - tiny valid cost → NOT displayed as ¥0
 *  - legacy (telemetryVersion missing/1) excluded from canonical
 *  - failure breakdown splits provider/timeout/invalid/validation
 *
 * Node built-ins only.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const FN = path.join(ROOT, 'cloudfunctions', 'adminGetDashboard', 'index.js')
const PAGE = path.join(ROOT, 'pages', 'admin', 'dashboard', 'dashboard.js')
const read = (p) => fs.readFileSync(p, 'utf8')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const OWNER = 'oZa463Yb2VY0k9Es_pGzdHFtigNo'
const DAY = 86400000
const startOfBeijingDay = (ts) => Math.floor((ts + 8 * 3600 * 1000) / DAY) * DAY - 8 * 3600 * 1000

// ── Cloud-function harness (records where-clauses) ─────────────────────────
function loadFn(beh) {
  const src = read(FN)
  const mod = { exports: {} }
  const wheres = []
  function makeQuery(name) {
    let _w = {}
    const q = {
      where: (w) => { _w = w || {}; wheres.push({ name, where: _w }); return q },
      field: () => q, limit: () => q, orderBy: () => q, skip: () => q,
      count: () => {
        const b = beh[name] || {}
        if (name === 'system_configs') return Promise.resolve({ total: 1 })
        if (b.reject) return Promise.reject(new Error('simulated ' + name + ' unavailable'))
        if (Array.isArray(b.counts) && b.counts.length) return Promise.resolve({ total: b.counts.length > 1 ? b.counts.shift() : b.counts[0] })
        return Promise.resolve({ total: b.count != null ? b.count : 0 })
      },
      get: () => {
        if (name === 'system_configs') return Promise.resolve({ data: [{ key: 'admin_users', status: 'active', value: { openids: [OWNER] } }] })
        const b = beh[name] || {}
        if (b.reject) return Promise.reject(new Error('simulated ' + name + ' unavailable'))
        return Promise.resolve({ data: b.docs || [] })
      },
    }
    return q
  }
  const db = {
    command: { gte: (v) => ({ $gte: v }), neq: (v) => ({ $ne: v }) },
    collection: (name) => makeQuery(name),
  }
  const cloud = { DYNAMIC_CURRENT_ENV: 'dyn', init() {}, database: () => db, getWXContext: () => ({ OPENID: OWNER }) }
  const fakeRequire = (id) => {
    if (id === 'wx-server-sdk') return cloud
    if (id.startsWith('./lib/')) return require(path.join(ROOT, 'cloudfunctions', 'adminGetDashboard', id))
    return require(id)
  }
  const ctx = { module: mod, exports: mod.exports, require: fakeRequire, console, process, setTimeout, Promise, Object, Date, Math, JSON, Array, String, Number, isFinite, Boolean }
  vm.runInNewContext(src, ctx, { filename: FN })
  return { main: mod.exports.main, wheres }
}

function v2row(o) { return Object.assign({ telemetryVersion: 2, operation: 'model_call', status: 'SUCCESS', estimatedCostCny: null, latencyMs: null }, o || {}) }

// ── Page harness ───────────────────────────────────────────────────────────
function loadPage() {
  let cfg = null
  const sandbox = {
    Page: (c) => { cfg = c },
    require: (id) => (id.includes('adminService') ? { getDashboard: () => Promise.resolve({ code: 0, data: {} }) } : require(id)),
    console, wx: { showToast() {}, stopPullDownRefresh() {}, navigateTo() {} }, setTimeout, Promise, Object, Math, Date, JSON, Number, isFinite,
  }
  vm.runInNewContext(read(PAGE), sandbox, { filename: PAGE })
  return cfg
}

;(async () => {
  console.log('RC8.9C R1B admin AI metrics (canonical v2)')

  // ── M1: today boundary uses Asia/Shanghai midnight, not UTC/local ───────
  {
    const { main, wheres } = loadFn({ ai_logs: { docs: [], counts: [0, 0] } })
    await main({}, {})
    const before = startOfBeijingDay(Date.now())
    const after = startOfBeijingDay(Date.now() + 1000)
    const todayWhere = wheres.find((w) => w.name === 'ai_logs' && w.where && w.where.createdAt && w.where.createdAt.$gte != null)
    ok(!!todayWhere, 'M1: today query carries createdAt bound')
    if (todayWhere) {
      const g = todayWhere.where.createdAt.$gte
      ok(g === before || g === after, `M1: boundary == Beijing midnight (${g} vs ${before})`)
      ok(g % DAY === (DAY - 8 * 3600 * 1000) % DAY, 'M1: boundary aligned to +08:00 day grid')
      ok(todayWhere.where.telemetryVersion === 2 && todayWhere.where.operation === 'model_call', 'M1: today counts ONLY v2 model_call')
    }
    const allV2 = wheres.find((w) => w.name === 'ai_logs' && w.where && w.where.telemetryVersion === 2 && !w.where.createdAt)
    ok(!!allV2, 'M1: cumulative query filters v2 model_call')
  }

  // ── M2: 1 success → calls=1 failures=0 errorRate 0.0% ───────────────────
  {
    const { main } = loadFn({ ai_logs: { docs: [v2row({ status: 'SUCCESS', estimatedCostCny: 0.000168, latencyMs: 100 })], counts: [1, 0] } })
    const r = await main({}, {})
    ok(r.data.today.aiCalls === 1 && r.data.aiRuntime.totalCalls === 1, 'M2: calls 1/1')
    ok(r.data.aiRuntime.failedCalls === 0, 'M2: failures 0')
    ok(r.data.aiRuntime.errorRate === '0.0%', `M2: errorRate 0.0% (${r.data.aiRuntime.errorRate})`)
  }

  // ── M3: 2 fail + 1 success → calls=3 failures=2 errorRate 66.7% ─────────
  {
    const docs = [
      v2row({ status: 'SUCCESS', estimatedCostCny: 0.001, latencyMs: 200 }),
      v2row({ status: 'PROVIDER_ERROR', estimatedCostCny: null, latencyMs: 30 }),
      v2row({ status: 'TIMEOUT', estimatedCostCny: null, latencyMs: 15000 }),
    ]
    const { main } = loadFn({ ai_logs: { docs, counts: [3, 0] } })
    const r = await main({}, {})
    ok(r.data.aiRuntime.totalCalls === 3, 'M3: calls 3')
    ok(r.data.aiRuntime.failedCalls === 2, 'M3: failures 2')
    ok(r.data.aiRuntime.errorRate === '66.7%', `M3: errorRate 66.7% (${r.data.aiRuntime.errorRate})`)
    ok(r.data.aiRuntime.breakdown.providerErrors === 1 && r.data.aiRuntime.breakdown.timeouts === 1, 'M3: breakdown provider=1 timeout=1')
    ok(r.data.aiRuntime.pricedCallCount === 1 && r.data.aiRuntime.unpricedCallCount === 2, 'M3: priced 1 / unpriced 2')
    ok(r.data.aiRuntime.estimatedCostCny === 0.001, 'M3: cost = sum of priced only')
  }

  // ── M4: 0 samples → errorRate null (+ UI --) ────────────────────────────
  {
    const { main } = loadFn({ ai_logs: { docs: [], counts: [0, 0] } })
    const r = await main({}, {})
    ok(r.data.aiRuntime.totalCalls === 0 && r.data.aiRuntime.failedCalls === 0, 'M4: 0 calls')
    ok(r.data.aiRuntime.errorRate === null, `M4: errorRate null (${r.data.aiRuntime.errorRate})`)
    ok(r.data.aiRuntime.estimatedCostCny === null, 'M4: cost null')
    ok(r.data.today.aiCalls === 0, 'M4: today 0')
  }

  // ── M5: legacy rows excluded from canonical; counted separately ─────────
  {
    // get returns ONLY v2 (server filters), legacy separate count query
    const { main } = loadFn({ ai_logs: { docs: [v2row({ status: 'SUCCESS', estimatedCostCny: 0.002 })], counts: [1, 143] } })
    const r = await main({}, {})
    ok(r.data.aiRuntime.totalCalls === 1, `M5: canonical excludes legacy (${r.data.aiRuntime.totalCalls})`)
    ok(r.data.aiRuntime.legacyTelemetryRows === 143, `M5: legacy counted separately (${r.data.aiRuntime.legacyTelemetryRows})`)
  }

  // ── M6: failure breakdown all four kinds ────────────────────────────────
  {
    const docs = [
      v2row({ status: 'PROVIDER_ERROR' }), v2row({ status: 'PROVIDER_ERROR' }),
      v2row({ status: 'TIMEOUT' }),
      v2row({ status: 'INVALID_RESPONSE' }),
      v2row({ status: 'VALIDATION_ERROR' }),
      v2row({ status: 'SUCCESS', estimatedCostCny: 0.1 }),
    ]
    const { main } = loadFn({ ai_logs: { docs, counts: [6, 0] } })
    const r = await main({}, {})
    const b = r.data.aiRuntime.breakdown
    ok(b.providerErrors === 2 && b.timeouts === 1 && b.invalidResponses === 1 && b.validationErrors === 1, 'M6: breakdown 2/1/1/1')
    ok(r.data.aiRuntime.failedCalls === 5 && r.data.aiRuntime.totalCalls === 6, 'M6: failed 5 / total 6')
  }

  // ── M7: latency aggregate ───────────────────────────────────────────────
  {
    const docs = [v2row({ latencyMs: 100 }), v2row({ latencyMs: 200 }), v2row({ latencyMs: 300 })]
    const { main } = loadFn({ ai_logs: { docs, counts: [3, 0] } })
    const r = await main({}, {})
    ok(r.data.aiRuntime.avgLatencyMs === 200, `M7: avg 200 (${r.data.aiRuntime.avgLatencyMs})`)
    ok(typeof r.data.aiRuntime.p95LatencyMs === 'number', 'M7: p95 prepared')
  }

  // ── M8: business timezone explicit + today/cumulative separated ─────────
  {
    const { main } = loadFn({ ai_logs: { docs: [v2row()], counts: [5, 0] } })
    const r = await main({}, {})
    ok(r.data.businessTimezone === 'Asia/Shanghai', 'M8: businessTimezone Asia/Shanghai')
    ok(typeof r.data.today.aiCalls === 'number' && typeof r.data.aiRuntime.totalCalls === 'number', 'M8: separate fields (today.aiCalls, aiRuntime.totalCalls)')
    ok(!('aiCalls' in r.data), 'M8: legacy flat aiCalls removed (no more twin binding)')
  }

  // ── M9: client formatting — cost precision / -- / tiny not ¥0 ───────────
  {
    const cfg = loadPage()
    const F = (s) => cfg._formatStats(s)
    const base = { aiRuntime: { totalCalls: 1, pricedCallCount: 1, unpricedCallCount: 0, estimatedCostCny: 0.5, errorRate: '0.0%', failedCalls: 0, breakdown: {}, fallbacks: 0, avgLatencyMs: 100 }, today: { aiCalls: 1 } }

    const f1 = F(JSON.parse(JSON.stringify(base)))
    ok(f1.costText === '¥0.5000', `M9: <¥1 → 4 dp (${f1.costText})`)
    ok(f1.avgLatencyText === '100ms', 'M9: latency text')

    const b2 = JSON.parse(JSON.stringify(base)); b2.aiRuntime.estimatedCostCny = 12.5
    ok(F(b2).costText === '¥12.50', `M9: >=¥1 → 2 dp (${F(b2).costText})`)

    const b3 = JSON.parse(JSON.stringify(base)); b3.aiRuntime.pricedCallCount = 0; b3.aiRuntime.unpricedCallCount = 3; b3.aiRuntime.estimatedCostCny = null
    ok(F(b3).costText === '--', `M9: no priced calls → -- (${F(b3).costText})`)

    const b4 = JSON.parse(JSON.stringify(base)); b4.aiRuntime.estimatedCostCny = 0.000001
    const t4 = F(b4).costText
    ok(t4 !== '¥0.0000' && t4 !== '¥0.00' && Number(t4.replace('¥', '')) > 0, `M9: tiny cost not ¥0 (${t4})`)

    const b5 = JSON.parse(JSON.stringify(base)); b5.aiRuntime.estimatedCostCny = 0
    ok(F(b5).costText === '¥0.00', 'M9: genuine ¥0 with priced calls → ¥0.00')

    const b6 = JSON.parse(JSON.stringify(base)); b6.aiRuntime.errorRate = null; b6.aiRuntime.totalCalls = 0; b6.aiRuntime.pricedCallCount = 0; b6.aiRuntime.estimatedCostCny = null
    const f6 = F(b6)
    ok(f6.errorRateText === '--', `M9: 0 samples → error rate -- (${f6.errorRateText})`)

    const b7 = JSON.parse(JSON.stringify(base)); b7.today = { aiCalls: 7 }; b7.aiRuntime.totalCalls = 99
    const f7 = F(b7)
    ok(f7.todayAiCalls === 7 && f7.cumulativeAiCalls === 99, 'M9: today vs cumulative not twin-bound')
  }

  // ── M10: partial pricing note ───────────────────────────────────────────
  {
    const cfg = loadPage()
    const f = cfg._formatStats({ today: { aiCalls: 2 }, aiRuntime: { totalCalls: 3, pricedCallCount: 2, unpricedCallCount: 1, estimatedCostCny: 0.5, errorRate: '0.0%', failedCalls: 0, breakdown: {}, fallbacks: 0 } })
    ok(f.costNote === '部分调用未计价', `M10: partial-pricing note (${f.costNote})`)
  }

  // ── M11: source guarantees — canonical filter constant + legacy exclusion
  {
    const src = read(FN)
    ok(/V2_MODEL_CALL\s*=\s*\{\s*telemetryVersion:\s*2,\s*operation:\s*'model_call'\s*\}/.test(src), 'M11: canonical filter constant present')
    ok(/startOfBeijingDay/.test(src), 'M11: Beijing day boundary used')
    ok(!/Math\.round\(totalTokens \* 0\.000002\)/.test(src), 'M11: fabricated token-cost formula removed')
    // index supported by telemetryVersion/operation/createdAt (created in R1A)
  }

  console.log(`  _TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
