#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/admin-rbac.test.js
 *
 * RC8.9C — role based access control (server authority).
 *
 *  A  SUPER_ADMIN → adminGetDashboard PASS
 *  B  OPERATOR    → adminGetDashboard PASS
 *  C  ANALYST     → adminGetAnalytics PASS
 *  D  SUPPORT     → adminGetAnalytics DENIED
 *  E  NON_ADMIN   → adminCheckAccess DENIED
 *  F  client-forged role → DENIED (operators cannot admin:create)
 *  G  last SUPER_ADMIN: disable → DENIED ; downgrade → DENIED
 *  H  role change produces admin_audit_logs with before/after/operator/timestamp
 *  I  ANALYST cannot reveal raw OpenID; SUPER_ADMIN can
 *
 * Node built-ins only. Runnable from repo root.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const CF = path.join(ROOT, 'cloudfunctions')
const { CODES } = require(path.join(CF, 'adminCheckAccess', 'lib', 'errorCodes.js'))
const adminAuth = require(path.join(CF, 'adminCheckAccess', 'lib', 'adminAuth.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

// ── in-memory DB ──────────────────────────────────────────────────────────
function makeDB(seed) {
  const store = Object.assign({ admin_users: [], admin_audit_logs: [], system_configs: [], users: [], orders: [], memberships: [], user_events: [], ai_logs: [], analytics_logs: [] }, seed || {})
  const match = (doc, where) => Object.keys(where || {}).every(k => {
    const v = where[k]
    return doc[k] === v
  })
  function q(name) {
    let _w = {}
    const builder = {
      where: (w) => { _w = w || {}; return builder },
      field: () => builder, limit: () => builder, skip: () => builder, orderBy: () => builder,
      count: () => Promise.resolve({ total: (store[name] || []).filter(d => match(d, _w)).length }),
      get: () => Promise.resolve({ data: (store[name] || []).filter(d => match(d, _w)) }),
      add: ({ data }) => { store[name] = store[name] || []; store[name].push(data); return Promise.resolve({ _id: 'id' + store[name].length }) },
      update: ({ data }) => { (store[name] || []).forEach(d => { if (match(d, _w)) Object.assign(d, data) }); return Promise.resolve({ stats: { updated: 1 } }) },
    }
    return builder
  }
  const db = {
    command: { gte: (v) => ({ $gte: v }), neq: (v) => ({ $ne: v }) },
    collection: (name) => q(name),
    _store: store,
  }
  return db
}

function loadFn(fnName, db, openid) {
  const src = fs.readFileSync(path.join(CF, fnName, 'index.js'), 'utf8')
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

const ADMIN = (openid, role, status) => ({ openid, role, status: status || 'ACTIVE', permissions: [], createdAt: 1, updatedAt: 1 })

function baseSeed() {
  return {
    admin_users: [ADMIN('oSUPER', 'SUPER_ADMIN'), ADMIN('oOPER', 'OPERATOR'), ADMIN('oANALYST', 'ANALYST'), ADMIN('oSUPPORT', 'SUPPORT')],
    system_configs: [],
    users: [{ openid: 'oU1', createdAt: 1, membershipLevel: 'free' }],
    orders: [],
    user_events: [{ openid: 'oU1', eventName: 'home_view', timestamp: 1 }],
  }
}

;(async () => {
  console.log('RC8.9C admin RBAC')

  // ── A/B: dashboard for SUPER_ADMIN + OPERATOR ──
  {
    const r1 = await loadFn('adminGetDashboard', makeDB(baseSeed()), 'oSUPER')({}, {})
    ok(r1.code === 0, `A: SUPER_ADMIN dashboard PASS (${r1.code})`)
    const r2 = await loadFn('adminGetDashboard', makeDB(baseSeed()), 'oOPER')({}, {})
    ok(r2.code === 0, `B: OPERATOR dashboard PASS (${r2.code})`)
  }

  // ── C/D: analytics ANALYST PASS, SUPPORT DENIED ──
  {
    const r1 = await loadFn('adminGetAnalytics', makeDB(baseSeed()), 'oANALYST')({}, {})
    ok(r1.code === 0, `C: ANALYST analytics PASS (${r1.code})`)
    const r2 = await loadFn('adminGetAnalytics', makeDB(baseSeed()), 'oSUPPORT')({}, {})
    ok(r2.code === CODES.PERMISSION_DENIED, `D: SUPPORT analytics DENIED (${r2.code})`)
  }

  // ── E: non-admin denied at entry ──
  {
    const r = await loadFn('adminCheckAccess', makeDB(baseSeed()), 'oNOBODY')({}, {})
    ok(r.code === CODES.PERMISSION_DENIED, `E: NON_ADMIN denied (${r.code})`)
    const r2 = await loadFn('adminCheckAccess', makeDB(baseSeed()), 'oSUPER')({}, {})
    ok(r2.code === 0 && r2.data.role === 'SUPER_ADMIN', `E: SUPER_ADMIN entry ok (${r2.code}, ${r2.data.role})`)
  }

  // ── F: client-forged role → operators cannot admin:create ──
  {
    // operator tries to create an admin (forged "I am super admin" claim in payload)
    const db = makeDB(baseSeed())
    const r = await loadFn('adminUpsertAdmin', db, 'oOPER')({ action: 'create', openid: 'oNEW', role: 'SUPER_ADMIN', callerRole: 'SUPER_ADMIN' }, {})
    ok(r.code === CODES.PERMISSION_DENIED, `F: forged callerRole ignored, create DENIED (${r.code})`)
    ok((db._store.admin_users.find(a => a.openid === 'oNEW')) === undefined, 'F: no admin created by operator')
    // super admin CAN create
    const db2 = makeDB(baseSeed())
    const r2 = await loadFn('adminUpsertAdmin', db2, 'oSUPER')({ action: 'create', openid: 'oNEW', role: 'OPERATOR' }, {})
    ok(r2.code === 0, `F: SUPER_ADMIN create allowed (${r2.code})`)
  }

  // ── G: last super admin guard ──
  {
    // only one super admin → disable BLOCKED
    const db = makeDB({ admin_users: [ADMIN('oSUPER', 'SUPER_ADMIN'), ADMIN('oOPER', 'OPERATOR')] })
    const r = await loadFn('adminUpsertAdmin', db, 'oSUPER')({ action: 'disable', openid: 'oSUPER' }, {})
    ok(r.code === CODES.PERMISSION_DENIED, `G: disable last SUPER_ADMIN DENIED (${r.code})`)
    // downgrade last super admin BLOCKED
    const r2 = await loadFn('adminUpsertAdmin', db, 'oSUPER')({ action: 'update', openid: 'oSUPER', role: 'OPERATOR' }, {})
    ok(r2.code === CODES.PERMISSION_DENIED, `G: downgrade last SUPER_ADMIN DENIED (${r2.code})`)
    // with two super admins → downgrade allowed
    const db2 = makeDB({ admin_users: [ADMIN('oSUPER', 'SUPER_ADMIN'), ADMIN('oSUPER2', 'SUPER_ADMIN')] })
    const r3 = await loadFn('adminUpsertAdmin', db2, 'oSUPER')({ action: 'update', openid: 'oSUPER2', role: 'OPERATOR' }, {})
    ok(r3.code === 0, `G: downgrade when 2 supers exist allowed (${r3.code})`)
  }

  // ── H: audit log completeness ──
  {
    const db = makeDB({ admin_users: [ADMIN('oSUPER', 'SUPER_ADMIN'), ADMIN('oSUPER2', 'SUPER_ADMIN')] })
    await loadFn('adminUpsertAdmin', db, 'oSUPER')({ action: 'update', openid: 'oSUPER2', role: 'ANALYST' }, {})
    const log = (db._store.admin_audit_logs || [])[0]
    ok(!!log, 'H: audit log written')
    ok(log.adminOpenid === 'oSUPER', 'H: operator recorded')
    ok(log.action === 'ADMIN_ROLE_CHANGED', 'H: action recorded')
    ok(log.before && log.before.role === 'SUPER_ADMIN', 'H: before recorded')
    ok(log.after && log.after.role === 'ANALYST', 'H: after recorded')
    ok(typeof log.timestamp === 'number', 'H: timestamp recorded')
  }

  // ── I: raw OpenID gating ──
  {
    const seed = Object.assign(baseSeed(), { users: [{ openid: 'oABCDEFGH1234', createdAt: 1 }] })
    // ANALYST cannot reveal raw
    const dbA = makeDB(seed)
    const rA = await loadFn('adminGetUserDetail', dbA, 'oANALYST')({ openid: 'oABCDEFGH1234', includeRawOpenid: true }, {})
    ok(rA.code === CODES.PERMISSION_DENIED, `I: ANALYST raw OpenID DENIED (${rA.code})`)
    // ANALYST can view masked
    const rA2 = await loadFn('adminGetUserDetail', dbA, 'oANALYST')({ openid: 'oABCDEFGH1234' }, {})
    ok(rA2.code === 0 && rA2.data.openid === undefined && !!rA2.data.maskedOpenid, 'I: ANALYST sees masked only')
    // SUPER_ADMIN can reveal raw
    const rS = await loadFn('adminGetUserDetail', makeDB(seed), 'oSUPER')({ openid: 'oABCDEFGH1234', includeRawOpenid: true }, {})
    ok(rS.code === 0 && rS.data.openid === 'oABCDEFGH1234', 'I: SUPER_ADMIN raw allowed')
  }

  console.log(`  _TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
