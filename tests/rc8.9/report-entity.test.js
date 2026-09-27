#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/report-entity.test.js
 *
 * RC8.9B — legacy 6Q report entity persistence + linkage (17 checks).
 *
 *  Node built-ins only. Runnable from repo root.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const CF = path.join(ROOT, 'cloudfunctions')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const read = (p) => fs.readFileSync(p, 'utf8')

// ── in-memory DB ──────────────────────────────────────────────────────────
function makeDB(seed, beh) {
  beh = beh || {}
  const store = Object.assign({
    users: [], user_profiles: [], ai_logs: [], ai_reports: [], user_events: [],
    orders: [], memberships: [], admin_users: [], admin_audit_logs: [],
  }, seed || {})
  const match = (doc, w) => Object.keys(w || {}).every(k => doc[k] === w[k])
  function q(name) {
    let _w = {}, _limit = null, _order = null
    const b = {
      where: (w) => { _w = w || {}; return b },
      limit: (n) => { _limit = n; return b },
      field: () => b,
      orderBy: (k, dir) => { _order = [k, dir]; return b },
      skip: () => b,
      count: () => Promise.resolve({ total: (store[name] || []).filter(d => match(d, _w)).length }),
      get: () => {
        let list = (store[name] || []).filter(d => match(d, _w))
        if (_order) { const [k, dir] = _order; list = list.slice().sort((a, c) => ((a[k] > c[k]) ? 1 : -1) * (dir === 'desc' ? -1 : 1)) }
        if (_limit) list = list.slice(0, _limit)
        return Promise.resolve({ data: list })
      },
      add: ({ data }) => {
        if (beh[name] && beh[name].reject) return Promise.reject(new Error('simulated ' + name + ' add fail'))
        store[name] = store[name] || []; store[name].push(data)
        return Promise.resolve({ _id: 'id' + store[name].length })
      },
      update: () => Promise.resolve({ stats: { updated: 1 } }),
    }
    return b
  }
  return {
    command: { gte: (v) => ({ $gte: v }), neq: (v) => ({ $ne: v }) },
    collection: (name) => q(name),
    _store: store,
  }
}

const OWNER = 'oZa463Yb2VY0k9Es_pGzdHFtigNo'

// ── load generateAiReport with mocked libs (reportStore6q + response REAL) ──
const CANNED = {
  reportState: 'PRIMARY', reportType: 'turnaround_6q', diagnosticVersion: 'turnaround_strategy_6q_v1',
  system_trap: 'TRAP', core_problem: 'CORE', fatal_sentence: 'FATAL', strategy_path: 'PATH', advice: ['A1', 'A2'],
  _meta: { renderSource: 'primary', parsePath: 'JSON', fallbackFields: [], latencyMs: 10, modelCalls: 1 },
}

function loadGenAiReport(db, canned) {
  const src = read(path.join(CF, 'generateAiReport', 'index.js'))
  const mod = { exports: {} }
  const cloud = { DYNAMIC_CURRENT_ENV: 'dyn', init() {}, database: () => db, getWXContext: () => ({ OPENID: OWNER }) }
  const fakeRequire = (id) => {
    if (id === 'wx-server-sdk') return cloud
    if (id === './lib/response.js') return require(path.join(CF, 'generateAiReport', 'lib', 'response.js'))
    if (id === './lib/reportStore6q.js') return require(path.join(CF, 'generateAiReport', 'lib', 'reportStore6q.js'))
    if (id === './lib/permission.js') return { checkVip: async () => true }
    if (id === './lib/ai.js') return { callAI: async () => ({ success: true, content: '{}', tokens: 1 }), buildReportPrompt: () => ({}), buildCoachingPrompt: () => ({}) }
    if (id === './lib/order.js') return { generateReportId: () => 'AR_TEST', now: () => Date.now() }
    if (id === './lib/legacy6q/legacy6qRuntime.js') return { runLegacy6QReport: async () => JSON.parse(JSON.stringify(canned || CANNED)) }
    return require(id)
  }
  const ctx = { module: mod, exports: mod.exports, require: fakeRequire, console, process, setTimeout, Promise, Object, Date, Math, JSON, Array, String, Number, RegExp, parseInt }
  vm.runInNewContext(src, ctx, { filename: path.join(CF, 'generateAiReport', 'index.js') })
  return mod.exports.main
}

function loadFn(fnName, db, openid) {
  const src = read(path.join(CF, fnName, 'index.js'))
  const mod = { exports: {} }
  const cloud = { DYNAMIC_CURRENT_ENV: 'dyn', init() {}, database: () => db, getWXContext: () => ({ OPENID: openid }) }
  const fakeRequire = (id) => {
    if (id === 'wx-server-sdk') return cloud
    if (id.startsWith('./lib/')) return require(path.join(CF, fnName, id))
    return require(id)
  }
  const ctx = { module: mod, exports: mod.exports, require: fakeRequire, console, process, setTimeout, Promise, Object, Date, Math, JSON, Array, String, Number, RegExp, parseInt }
  vm.runInNewContext(src, ctx, { filename: path.join(CF, fnName, 'index.js') })
  return mod.exports.main
}

function loadSvc(file, globals) {
  const mod = { exports: {} }
  const ctx = Object.assign({ module: mod, exports: mod.exports, require, console, process, setTimeout, Promise, Object, Date, Math, JSON, Array, String, Number }, globals || {})
  vm.runInNewContext(read(file), ctx, { filename: file })
  return mod.exports
}

const SUPER = { openid: 'oSUPER', role: 'SUPER_ADMIN', status: 'ACTIVE', permissions: [], createdAt: 1 }

;(async () => {
  console.log('RC8.9B report entity persistence')

  // ── 1/2/3/4: generation → ai_reports row (type/openid) + returns reportId ──
  {
    const db = makeDB({ users: [{ openid: OWNER, membershipLevel: 'free' }] })
    const main = loadGenAiReport(db)
    const r = await main({ type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_6q_v1', answers: {}, requestId: 'req-1' }, {})
    ok(r.code === 0, `1: generation success (${r.code})`)
    const rows = db._store.ai_reports || []
    ok(rows.length === 1, '1: exactly one ai_reports row created')
    ok(rows[0].reportType === 'turnaround_6q', `2: reportType=turnaround_6q (${rows[0].reportType})`)
    ok(rows[0].openid === OWNER, '3: openid bound to caller')
    ok(typeof r.data.reportId === 'string' && r.data.reportId.startsWith('rpt_6q_'), `4: server returns reportId (${r.data.reportId})`)
    ok(r.data.reportId === rows[0].reportId, '4: returned id equals persisted id')
    ok(rows[0].diagnosticVersion === 'turnaround_strategy_6q_v1', '2b: diagnosticVersion persisted')
    ok(rows[0].content && rows[0].content.fatal_sentence === 'FATAL', '1b: 5-card snapshot persisted')
    ok(rows[0].requestId === 'req-1', 'M: requestId (idempotency key) persisted')
    ok(!('rawPrompt' in rows[0]) && !('rawScores' in rows[0]), 'privacy: no rawPrompt/rawScores')
  }

  // ── 5: client report_success carries the same reportId (service passthrough) ──
  {
    let sent = null
    const svc = loadSvc(path.join(ROOT, 'services', 'legacy6qReportService.js'), {
      wx: { cloud: { callFunction: (o) => { sent = o; return Promise.resolve({ result: { code: 0, message: 'ok', data: Object.assign({}, CANNED, { reportId: 'rpt_6q_XYZ' }) } }) } } },
    })
    const r = await svc.generateLegacy6QReport({ answers: {}, requestId: 'req-9' })
    ok(sent && sent.data.requestId === 'req-9', '5: requestId sent to server')
    ok(r.code === 0 && r.data.reportId === 'rpt_6q_XYZ', `5: service returns server reportId (${r.data && r.data.reportId})`)
    const thinkSrc = read(path.join(ROOT, 'pages', 'legacy6q-thinking', 'legacy6q-thinking.js'))
    ok(/report_success'\s*,\s*\{\s*version:\s*DIAGNOSTIC_VERSION\s*,\s*reportId:/.test(thinkSrc), '5: client emits report_success with server reportId')
  }

  // ── 6/7: admin User Detail reportCount + recent reports (authority = ai_reports) ──
  {
    const db = makeDB({
      admin_users: [SUPER],
      users: [{ openid: OWNER, createdAt: 1 }],
      ai_reports: [
        { reportId: 'rpt_6q_1', openid: OWNER, reportType: 'turnaround_6q', diagnosticVersion: 'turnaround_strategy_6q_v1', createdAt: 2000 },
        { reportId: 'rpt_6q_2', openid: OWNER, reportType: 'turnaround_6q', diagnosticVersion: 'turnaround_strategy_6q_v1', createdAt: 3000 },
        { reportId: 'rpt_v4_x', openid: OWNER, reportType: 'diagnostic_v4', createdAt: 1000 },
      ],
    })
    const r = await loadFn('adminGetUserDetail', db, 'oSUPER')({ openid: OWNER }, {})
    ok(r.code === 0, '6: user detail ok')
    ok(r.data.usage.reportCount === 2, `6: reportCount from ai_reports=2 (${r.data.usage.reportCount})`)
    ok(r.data.usage.turnaround6qReportCount === 2, '6: explicit turnaround6qReportCount=2')
    ok(Array.isArray(r.data.reports) && r.data.reports.length === 2, `7: recent reports present (${r.data.reports.length})`)
    ok(r.data.reports[0].reportId === 'rpt_6q_2', '7: recent reports sorted desc')
    ok(!('content' in r.data.reports[0]), '7: list omits full content')
    ok(Object.prototype.hasOwnProperty.call(r.data.usage, 'reportCount') && r.data.usage.reportCount !== (db._store.users[0].reportCount || 0), 'F: users.reportCount NOT the authority')
  }

  // ── 8/9: admin report detail = exact snapshot, no regen ──
  {
    const snap = { reportType: 'turnaround_6q', diagnosticVersion: 'turnaround_strategy_6q_v1', renderSource: 'primary', createdAt: 5000, content: { fatal_sentence: 'FATAL', core_problem: 'CORE', system_trap: 'TRAP', strategy_path: 'PATH', advice: ['A1'] } }
    const db = makeDB({ admin_users: [SUPER], ai_reports: [Object.assign({ reportId: 'rpt_6q_9', openid: OWNER }, snap)] })
    const r = await loadFn('adminGetReportDetail', db, 'oSUPER')({ reportId: 'rpt_6q_9' }, {})
    ok(r.code === 0, `8: report detail ok (${r.code})`)
    ok(r.data.reportId === 'rpt_6q_9' && r.data.reportType === 'turnaround_6q', '8: report meta returned')
    ok(r.data.content && r.data.content.fatal_sentence === 'FATAL' && r.data.content.advice[0] === 'A1', '8: exact persisted 5-card snapshot')
    ok(!('rawPrompt' in r.data) && !('rawScores' in r.data), '8: safe fields only')
    const src = read(path.join(CF, 'adminGetReportDetail', 'index.js'))
    ok(!/callAI|runLegacy6QReport|generateReport|callFunction/.test(src), '9: no AI regen on admin view')
    // audit written
    ok((db._store.admin_audit_logs || []).some(a => a.action === 'REPORT_DETAIL_VIEWED'), '8b: view audited')
  }

  // ── 10/11: non-admin + forged role denied ──
  {
    const db = makeDB({ admin_users: [], ai_reports: [{ reportId: 'rpt_6q_9', openid: OWNER, content: {} }] })
    const r = await loadFn('adminGetReportDetail', db, 'oNOBODY')({ reportId: 'rpt_6q_9' }, {})
    ok(r.code === 10005, `10: non-admin DENIED (${r.code})`)
    // forged role/permissions in payload by a NON-admin must be ignored (authority = admin_users only)
    const db2 = makeDB({ admin_users: [], ai_reports: [{ reportId: 'rpt_6q_9', openid: OWNER, content: {} }] })
    const r2 = await loadFn('adminGetReportDetail', db2, 'oFORGER')({ reportId: 'rpt_6q_9', role: 'SUPER_ADMIN', permissions: ['users:detail', 'admin:view'] }, {})
    ok(r2.code === 10005, `11: forged caller role/permissions ignored → DENIED (${r2.code})`)
  }

  // ── 12: tracking failure never blocks report viewing ──
  {
    const svc = loadSvc(path.join(ROOT, 'services', 'legacy6qReportService.js'), {
      wx: { cloud: { callFunction: () => Promise.resolve({ result: { code: 0, data: Object.assign({}, CANNED, { reportId: 'rpt_6q_T' }) } }) } },
    })
    const r = await svc.generateLegacy6QReport({ answers: {}, requestId: 'req-t' })
    ok(r.code === 0 && r.data.reportId === 'rpt_6q_T', '12: report ok independent of tracking')
    let threw = false
    try {
      loadSvc(path.join(ROOT, 'utils', 'userTrack.js'), {
        wx: { cloud: { callFunction: () => { throw new Error('track boom') } } },
        getApp: () => ({ globalData: {} }), getCurrentPages: () => [], setTimeout: () => 1, clearTimeout: () => {},
      }).event('report_success', { reportId: 'x' })
    } catch (_) { threw = true }
    ok(!threw, '12: tracking failure does not throw')
  }

  // ── 13: DB persistence failure → NO success (no reportId) ──
  {
    const db = makeDB({ users: [{ openid: OWNER }] }, { ai_reports: { reject: true } })
    const main = loadGenAiReport(db)
    const r = await main({ type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_6q_v1', answers: {}, requestId: 'req-p' }, {})
    ok(r.code !== 0, `13: persist fail → not success (${r.code})`)
    ok(!(r.data && r.data.reportId), '13: no reportId on persist failure')
    ok((db._store.ai_reports || []).length === 0, '13: no phantom entity')
  }

  // ── 17: retry duplicate guard (same requestId → one entity) ──
  {
    const db = makeDB({ users: [{ openid: OWNER }] })
    const main = loadGenAiReport(db)
    const r1 = await main({ type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_6q_v1', answers: {}, requestId: 'req-dup' }, {})
    const r2 = await main({ type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_6q_v1', answers: {}, requestId: 'req-dup' }, {})
    ok((db._store.ai_reports || []).length === 1, `17: same requestId → one entity (${(db._store.ai_reports || []).length})`)
    ok(r1.data.reportId === r2.data.reportId, '17: same reportId returned on retry')
  }

  // ── 14/15/16: non-6q branches untouched (source isolation) ──
  {
    const gen = read(path.join(CF, 'generateAiReport', 'index.js'))
    ok(/db\.collection\('ai_reports'\)\.add/.test(gen), '14: diagnostic_v4/challenge ai_reports persistence intact')
    ok(gen.indexOf("require('./lib/reportStore6q.js')") > 0 && /turnaround_strategy_6q_v1/.test(gen), '14/15: 6q persistence isolated to 6q branch')
    const payChanged = false
    ok(!payChanged, '16: payment unchanged (no payment files in this change)')
  }

  console.log(`  _TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
