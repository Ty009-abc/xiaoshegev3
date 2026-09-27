#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/funnel-authority.test.js
 *
 * RC8.9D_R1 — Admin funnel canonical authority.
 *
 *  F1  distinct-user counting: repeated home_view by same user → home = 1
 *  F2  repeated questionnaire_start by same user → start = 1
 *  F3  stage 2 authority is questionnaire_start, NEVER strategy_start (no fabrication)
 *  F4  stage 6 authority is orders.status='paid' (server), NOT client payment_success
 *  F5  Beijing business day window: 09-27 23:59 vs 09-28 00:01 bucket correctly
 *  F6  conversion / dropoff: previous stage 0 → null (UI --, never "100% drop")
 *  F7  integrity: complete > start → valid=false + violation recorded; counts NOT clamped
 *  F8  valid fixture (home 10 > start 8 > complete 6 > report 5) → integrity.valid = true
 *  F9  backward-compat alias funnelStages[] preserved (6 stages)
 *  F10 client page: zero-denominator safe + neutral payment note + warning flag
 *  F11 server-local day removed from the funnel path; Beijing helper used
 *
 * Node built-ins only. Runnable from repo root.
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

const OWNER = 'oZOWNER_FUNNEL_TEST'
const DAY = 86400000
const BJ = 8 * 3600 * 1000
const startOfBeijingDay = (ts) => Math.floor((ts + BJ) / DAY) * DAY - BJ

// ── Cloud-function harness (user_events/orders support aggregate + where) ──
function loadFn(beh) {
  const src = read(FN)
  const mod = { exports: {} }
  const wheres = []
  const aggMatches = []

  function makeQuery(name) {
    const q = {
      where: (w) => { wheres.push({ name, w }); return q },
      field: () => q, limit: () => q, orderBy: () => q, skip: () => q,
      count: () => {
        const b = beh[name] || {}
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
      aggregate: () => makeAgg(name),
    }
    return q
  }

  function makeAgg(name) {
    let match = {}
    const a = {
      match: (m) => { match = m || {}; aggMatches.push({ name, match }); return a },
      group: () => a,
      count: () => a,
      sort: () => a,
      limit: () => a,
      project: () => a,
      end: () => {
        const b = beh[name] || {}
        if (b.reject) return Promise.reject(new Error('simulated ' + name + ' unavailable'))
        // distinct-openid groups: dedupe by openid within the matched docs
        const docs = (b.docs || []).filter((d) => {
          const ts = d.__ts != null ? d.__ts : (d.timestamp != null ? d.timestamp : d.paidAt)
          if (match.eventName && d.eventName !== match.eventName) return false
          if (match.status && d.status !== match.status) return false
          const g = match.timestamp || match.paidAt
          if (g && typeof g.$gte === 'number' && !(ts >= g.$gte)) return false
          return true
        })
        const uniq = new Set(docs.map((d) => d.openid))
        return Promise.resolve({ list: [{ n: uniq.size }] })
      },
    }
    return a
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
  return { main: mod.exports.main, wheres, aggMatches }
}

// build user_events docs from a spec { home_view: ['u1','u1','u2'], ... } using a ts
function evDocs(spec, ts) {
  const out = []
  for (const name of Object.keys(spec)) for (const openid of spec[name]) out.push({ eventName: name, openid, timestamp: ts, __ts: ts })
  return out
}

// ── Page harness ───────────────────────────────────────────────────────────
function loadPage() {
  let cfg = null
  const sandbox = {
    Page: (c) => { cfg = c },
    require: (id) => (id.includes('adminService') ? { getDashboard: () => Promise.resolve({ code: 0, data: {} }) } : require(id)),
    console, wx: { showToast() {}, stopPullDownRefresh() {}, navigateTo() {} }, setTimeout, Promise, Object, Math, Date, JSON, Number, isFinite, undefined,
  }
  vm.runInNewContext(read(PAGE), sandbox, { filename: PAGE })
  return cfg
}
function mkCfg(cfg) { const p = Object.assign({}, cfg); p.data = { stats: null }; p.setData = function (o) { Object.assign(this.data, o) }; return p }

;(async () => {
  console.log('RC8.9D R1 funnel authority (canonical unique users)')
  const TS = startOfBeijingDay(Date.now()) + 3 * 3600 * 1000 // +3h into the Beijing day

  // ── F1 + F2: distinct-user counting ────────────────────────────────────
  {
    const beh = { user_events: { docs: evDocs({ home_view: ['u1', 'u1', 'u1'], questionnaire_start: ['u1', 'u1'] }, TS) } }
    const { main } = loadFn(beh)
    const r = await main({}, {})
    ok(r.code === 0, `F1: code=0 (${r.code})`)
    ok(r.data.funnel.stages.home.count === 1, `F1: home_view x3 same user → 1 (${r.data.funnel.stages.home.count})`)
    ok(r.data.funnel.stages.start.count === 1, `F2: questionnaire_start x2 same user → 1 (${r.data.funnel.stages.start.count})`)
  }

  // ── F3: no strategy_start fabrication ──────────────────────────────────
  {
    const src = read(FN)
    ok(/stages\[s\.key\]/.test(src) && /FUNNEL_EVENT_STAGES/.test(src), 'F3a: stages driven by canonical event list')
    const m = src.match(/FUNNEL_EVENT_STAGES\s*=\s*\[([\s\S]*?)\]/)
    const block = (m && m[1]) || ''
    ok(/start'[\s\S]*questionnaire_start/.test(block), 'F3b: stage start bound to questionnaire_start')
    ok(!/'start'[\s\S]{0,40}strategy_start/.test(block), 'F3c: strategy_start NOT bound to any stage')
    // even if a strategy_start doc exists in data, the funnel must ignore it
    const beh = { user_events: { docs: evDocs({ strategy_start: ['u9', 'u9', 'u9'] }, TS) } }
    const { main } = loadFn(beh)
    const r = await main({}, {})
    ok(r.data.funnel.stages.start.count === 0, 'F3d: stray strategy_start does NOT inflate start')
  }

  // ── F4: stage 6 = orders.status='paid' ─────────────────────────────────
  {
    const beh = {
      user_events: { docs: evDocs({ payment_view: ['u1'], payment_success: ['u1', 'u1', 'u1'] }, TS) },
      orders: { docs: [{ status: 'paid', openid: 'u7', paidAt: TS }, { status: 'paid', openid: 'u7', paidAt: TS }, { status: 'created', openid: 'u8', paidAt: TS }] },
    }
    const { main, aggMatches } = loadFn(beh)
    const r = await main({}, {})
    ok(r.data.funnel.stages.paid.count === 1, `F4a: paid = distinct paid openids (${r.data.funnel.stages.paid.count})`)
    const om = aggMatches.find((a) => a.name === 'orders')
    ok(om && om.match.status === 'paid', 'F4b: orders aggregate filtered by status=paid')
    ok(om && om.match.paidAt && typeof om.match.paidAt.$gte === 'number', 'F4c: orders aggregate uses paidAt window')
    // client payment_success alone (no paid order) → paid stays 0
    const beh2 = { user_events: { docs: evDocs({ payment_success: ['u1', 'u2'] }, TS) }, orders: { docs: [] } }
    const { main: main2 } = loadFn(beh2)
    const r2 = await main2({}, {})
    ok(r2.data.funnel.stages.paid.count === 0, 'F4d: client payment_success without paid order → paid=0')
  }

  // ── F5: Beijing day bucketing (23:59 vs 00:01) ─────────────────────────
  {
    const dayStart = startOfBeijingDay(Date.now())
    const t2359 = dayStart - 60 * 1000          // 09-27 23:59 Beijing
    const t0001 = dayStart + 60 * 1000          // 09-28 00:01 Beijing
    const beh = { user_events: { docs: [
      { eventName: 'home_view', openid: 'old', timestamp: t2359, __ts: t2359 },
      { eventName: 'home_view', openid: 'new', timestamp: t0001, __ts: t0001 },
    ] } }
    const { main, aggMatches } = loadFn(beh)
    const r = await main({}, {})
    ok(r.data.funnel.stages.home.count === 1, `F5a: only current Beijing-day user counted (${r.data.funnel.stages.home.count})`)
    const um = aggMatches.find((a) => a.name === 'user_events')
    ok(um && um.match.timestamp.$gte === dayStart, `F5b: window == Beijing midnight (${um && um.match.timestamp.$gte} vs ${dayStart})`)
  }

  // ── F6: zero denominator → conversion/dropoff null ─────────────────────
  {
    const beh = { user_events: { docs: evDocs({ home_view: ['u1'], questionnaire_complete: ['u1'] }, TS) } }
    const { main } = loadFn(beh)
    const r = await main({}, {})
    // start = 0, complete = 1 → complete is first stage; transitions from start(0) → complete(1) has prev 0
    ok(r.data.funnel.stages.complete.conversion === null, 'F6a: prev stage 0 → conversion null')
    ok(r.data.funnel.stages.complete.dropoff === null, 'F6b: prev stage 0 → dropoff null')
    // alias array must not render "100%" for that transition either
    const aliasComplete = r.data.funnelStages.find((s) => s.key === 'complete')
    ok(aliasComplete.drop === '', 'F6c: alias drop empty when denominator 0 (not "100%")')
  }

  // ── F7: integrity violation, no clamping ───────────────────────────────
  {
    const beh = { user_events: { docs: evDocs({ home_view: ['u1'], questionnaire_start: ['u1'], questionnaire_complete: ['u1', 'u2', 'u3'] }, TS) } }
    const { main } = loadFn(beh)
    const r = await main({}, {})
    ok(r.data.funnel.integrity.valid === false, 'F7a: integrity.valid=false when complete > start')
    const v = r.data.funnel.integrity.violations.find((x) => x.to === 'complete')
    ok(!!v && v.from === 'start', 'F7b: violation record {from:start, to:complete}')
    ok(r.data.funnel.stages.complete.count === 3 && r.data.funnel.stages.start.count === 1, 'F7c: counts NOT clamped into descending order')
    ok(r.data.funnelIntegrity === false, 'F7d: top-level funnelIntegrity flag = false')
  }

  // ── F8: valid fixture stays valid ──────────────────────────────────────
  {
    const beh = { user_events: { docs: evDocs({
      home_view: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
      questionnaire_start: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      questionnaire_complete: ['a', 'b', 'c', 'd', 'e', 'f'],
      report_success: ['a', 'b', 'c', 'd', 'e'],
    }, TS) } }
    const { main } = loadFn(beh)
    const r = await main({}, {})
    const s = r.data.funnel.stages
    ok(s.home.count === 10 && s.start.count === 8 && s.complete.count === 6 && s.report.count === 5, `F8a: counts 10/8/6/5 (${s.home.count}/${s.start.count}/${s.complete.count}/${s.report.count})`)
    ok(r.data.funnel.integrity.valid === true && r.data.funnel.integrity.violations.length === 0, 'F8b: integrity valid')
    ok(s.start.conversion === 0.8, `F8c: start conversion = 8/10 = 0.8 (${s.start.conversion})`)
    ok(Math.abs(s.complete.dropoff - (1 - 6 / 8)) < 1e-9, 'F8d: complete dropoff = 1-6/8')
  }

  // ── F9: backward-compat alias ──────────────────────────────────────────
  {
    const { main } = loadFn({ user_events: { docs: [] } })
    const r = await main({}, {})
    ok(Array.isArray(r.data.funnelStages) && r.data.funnelStages.length === 6, `F9a: funnelStages[] 6 stages (${(r.data.funnelStages || []).length})`)
    ok(r.data.funnelStages.map((s) => s.key).join(',') === 'home,start,complete,report,paymentView,paid', 'F9b: canonical stage order')
    ok(r.data.funnel.countUnit === 'unique_users' && r.data.funnel.timezone === 'Asia/Shanghai' && r.data.funnel.scope === 'today', 'F9c: funnel meta scope/timezone/countUnit')
  }

  // ── F10: client page rendering guards ──────────────────────────────────
  {
    const cfg = loadPage()
    const p = mkCfg(cfg)
    const out = p._formatStats({
      funnelStages: [{ key: 'home', name: '打开首页', count: 0, rate: '', w: 0, drop: '' }],
      funnel: { stages: { paymentView: { count: 0 } }, countUnit: 'unique_users', timezone: 'Asia/Shanghai' },
      funnelIntegrity: true, funnelViolations: [],
    })
    ok(out.paymentNeutral === true && /暂无付款入口/.test(out.paymentNeutralNote), 'F10a: neutral payment note when paymentView=0')
    ok(out.funnelCountUnitNote === '去重用户', 'F10b: count-unit note rendered')
    ok(out.funnelWarn === false, 'F10c: no warning when integrity ok')
    const out2 = p._formatStats({ funnelStages: [], funnel: { stages: {} }, funnelIntegrity: false, funnelViolations: [{ from: 'start', to: 'complete' }] })
    ok(out2.funnelWarn === true, 'F10d: warning flag when integrity=false')
    const wxml = read(path.join(ROOT, 'pages', 'admin', 'dashboard', 'dashboard.wxml'))
    ok(/数据口径异常/.test(wxml), 'F10e: wxml shows 数据口径异常')
    ok(/item\.rate \?/.test(wxml), 'F10f: wxml suppresses empty rate (no fake 0%)')
    ok(/adm-funnel-note/.test(wxml) && /paymentNeutral/.test(wxml), 'F10g: wxml neutral payment note wired')
  }

  // ── F11: server-local day removed from funnel path ─────────────────────
  {
    const src = read(FN)
    // strip line comments so doc references don't count as call sites
    const code = src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')
    ok(!/function startOfDay/.test(code), 'F11a: server-local startOfDay() removed')
    ok(!/\bstartOfDay\s*\(/.test(code), 'F11b: no startOfDay() call sites remain')
    ok(/const todayStart = startOfBeijingDay\(ts\)/.test(src), 'F11c: KPI/funnel boundary = startOfBeijingDay')
    ok(/beijingDayKey/.test(src), 'F11d: trend buckets use Beijing day key')
  }

  console.log(`  _TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
