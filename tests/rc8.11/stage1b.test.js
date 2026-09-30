#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.11/stage1b.test.js
 *
 * RC8_11_STAGE1B — payment grant / membership write / expiry safety.
 *
 *  A  new monthly purchase → memberships active 30d + entitlements source with 30d expiry
 *  B  annual purchase → 365d + year exclusives
 *  E  membership expires → membership rights revoked by expiry, legacy expiresAt:0 retained
 *  F  createOrder rejects NEW purchase of retired SKUs
 *  G  historical grant for retired SKU still works (payCallback path)
 *  H  duplicate membership payment finalization → exactly once (no double extend)
 *  renewal: active membership extends from current expiredAt
 *
 * Node built-ins only. No network, no real payment, no real DB.
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..', '..')
const ESVC = require(path.join(ROOT, 'cloudfunctions', 'common', 'entitlementService.js'))
const PE = require(path.join(ROOT, 'cloudfunctions', 'common', 'permissionEngine.js'))
const AA = require(path.join(ROOT, 'cloudfunctions', 'common', 'accessAuthority.js'))

const DAY = 86400000
const T0 = 1790770000000

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_11_STAGE1B membership write / grant / expiry')

// ── fake DB (nested dot-path match + lte/gt/in, unique orderId on memberships) ──
function makeDb () {
  const store = { products: [], memberships: [], entitlements: [], users: [], ai_reports: [], challenge_records: [], entitlement_grants: [] }
  const tick = () => new Promise((r) => setTimeout(r, 0))
  const command = {
    in: (a) => ({ __op: 'in', v: a }),
    gt: (n) => ({ __op: 'gt', v: n }),
    lte: (n) => ({ __op: 'lte', v: n }),
    set: (v) => ({ __op: 'set', v }),
    inc: (n) => ({ __op: 'inc', v: n }),
  }
  function nested (doc, key) {
    // supports 'a.b' and 'arr[].b' style via array traversal
    const parts = key.split('.')
    let cur = [doc]
    for (const p of parts) {
      const next = []
      for (const node of cur) {
        if (node == null) continue
        if (Array.isArray(node)) node.forEach((n) => { if (n && n[p] !== undefined) next.push(n[p]) })
        else if (node[p] !== undefined) next.push(node[p])
      }
      cur = next
    }
    return cur
  }
  const match = (doc, q) => Object.keys(q).every((k) => {
    const c = q[k]
    const vals = nested(doc, k)
    if (c && c.__op === 'in') return vals.some((v) => c.v.includes(v))
    if (c && c.__op === 'gt') return vals.some((v) => v > c.v)
    if (c && c.__op === 'lte') return vals.some((v) => v <= c.v)
    return vals.some((v) => v === c)
  })
  function collection (name) {
    if (!store[name]) store[name] = []
    const api = {
      where (q) {
        return {
          limit () { return this },
          orderBy () { return this },
          async get () { await tick(); return { data: store[name].filter((d) => match(d, q)).map((d) => ({ ...d })) } },
          async update ({ data }) {
            await tick()
            const rows = store[name].filter((d) => match(d, q))
            rows.forEach((d) => Object.assign(d, data))
            return { stats: { updated: rows.length } }
          },
          async remove () { await tick(); return { stats: { removed: 0 } } },
        }
      },
      async add ({ data }) {
        await tick()
        if (name === 'memberships') { /* allow multi; idempotency enforced by orderId lookup */ }
        const doc = Object.assign({ _id: name + '_' + (store[name].length + 1) }, data)
        store[name].push(doc)
        return { _id: doc._id }
      },
      doc (id) { return { async update ({ data }) { await tick(); const d = store[name].find((x) => x._id === id); if (d) Object.assign(d, data); return { stats: { updated: d ? 1 : 0 } } } } },
    }
    return api
  }
  return { collection, command, _store: store }
}
const seed = (db, name, doc) => { db._store[name].push(Object.assign({ _id: name + '_' + (db._store[name].length + 1) }, doc)) }

;(async () => {
  // ── A: monthly purchase ──
  {
    const db = makeDb()
    seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const r = await ESVC.grantEntitlements(db, { openid: 'o1', productId: 'vip_month_39_9', orderId: 'O1', relatedId: '' }, T0)
    eq(r.success, true, 'A grant success')
    eq(db._store.memberships.length, 1, 'A one membership row')
    const m = db._store.memberships[0]
    eq(m.status, 'active', 'A status active')
    eq(m.expiredAt, T0 + 30 * DAY, 'A expiredAt = +30d')
    eq(m.level, 'monthly', 'A level monthly')
    ok(Array.isArray(m.rights) && m.rights.includes('report_member') && m.rights.includes('challenge_member'), 'A rights tokens')
    const ent = db._store.entitlements[0]
    const src = (ent.sources || []).find((s) => s.productId === 'vip_month_39_9')
    ok(!!src, 'A entitlements source present')
    eq(src.expiresAt, T0 + 30 * DAY, 'A entitlements source carries membership expiry (non-permanent)')
    // resolver agrees
    const acc = AA.resolveAccess({ membership: m, sources: ent.sources, now: T0 })
    eq(acc.report.allowed, true, 'A resolver report true')
    eq(acc.challenge.allowed, true, 'A resolver challenge true')
  }

  // ── B: annual purchase ──
  {
    const db = makeDb()
    seed(db, 'products', { productId: 'vip_year_299', type: 'membership', permission: 'vip', durationDays: 365 })
    const r = await ESVC.grantEntitlements(db, { openid: 'o2', productId: 'vip_year_299', orderId: 'O2', relatedId: '' }, T0)
    eq(r.success, true, 'B grant success')
    const m = db._store.memberships[0]
    eq(m.expiredAt, T0 + 365 * DAY, 'B expiredAt = +365d')
    eq(m.level, 'yearly', 'B level yearly')
    ok(m.rights.includes('hard_truth_mode') && m.rights.includes('advanced_reports') && m.rights.includes('priority_model'), 'B year exclusives')
    ok(m.rights.includes('report_member') && m.rights.includes('challenge_member'), 'B core rights')
  }

  // ── H + renewal: duplicate finalize exactly once; new order extends ──
  {
    const db = makeDb()
    seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o1 = { openid: 'o3', productId: 'vip_month_39_9', orderId: 'OA', relatedId: '' }
    await ESVC.grantEntitlements(db, o1, T0)
    const exp1 = db._store.memberships[0].expiredAt
    // duplicate finalize same order → no double extend
    const dup = await ESVC.grantEntitlements(db, o1, T0 + 1000)
    eq(dup.idempotent, true, 'H duplicate finalize idempotent')
    eq(db._store.memberships.length, 1, 'H one membership row')
    eq(db._store.memberships[0].expiredAt, exp1, 'H no double extend on duplicate')
    // new order (renewal) extends from current expiredAt
    await ESVC.grantEntitlements(db, { openid: 'o3', productId: 'vip_month_39_9', orderId: 'OB', relatedId: '' }, T0 + 5 * DAY)
    eq(db._store.memberships.length, 1, 'renewal reuses one row')
    eq(db._store.memberships[0].expiredAt, exp1 + 30 * DAY, 'renewal extends from current expiredAt (not completion time)')
  }

  // ── F: createOrder rejects retired SKU (source guard) ──
  {
    const src = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'createOrder', 'index.js'), 'utf8')
    ok(/isRetiredNewSale/.test(src), 'F createOrder imports isRetiredNewSale')
    ok(/product\.notNewSale === true/.test(src), 'F createOrder checks notNewSale flag')
    ok(/PRODUCT_INACTIVE/.test(src), 'F createOrder returns PRODUCT_INACTIVE for retired')
    ok(AA.isRetiredNewSale('report_9_9') && AA.isRetiredNewSale('challenge_39_9') && AA.isRetiredNewSale('vip_month_99'), 'F retired set correct')
    ok(!AA.isRetiredNewSale('vip_month_39_9') && !AA.isRetiredNewSale('vip_year_299'), 'F memberships NOT retired')
  }

  // ── G: historical grant for retired SKU still works (payCallback path) ──
  {
    const db = makeDb()
    seed(db, 'products', { productId: 'report_9_9', type: 'single', permission: 'report_unlock', durationDays: 0 })
    seed(db, 'ai_reports', { reportId: 'AR1', openid: 'o9', isPaid: false })
    const r = await ESVC.grantEntitlements(db, { openid: 'o9', productId: 'report_9_9', orderId: 'OR1', relatedId: 'AR1' }, T0)
    eq(r.success, true, 'G retired report_9_9 still grantable (historical order)')
    eq(db._store.ai_reports[0].isPaid, true, 'G report unlocked')
    const ent = db._store.entitlements[0]
    const src = (ent.sources || []).find((s) => s.productId === 'report_9_9')
    eq(src.expiresAt, 0, 'G legacy report_9_9 source is permanent (expiresAt 0)')
  }

  // ── E: expiry revokes membership-derived perms, retains legacy expiresAt:0 ──
  {
    const db = makeDb()
    // owner-like: expired monthly membership + permanent legacy report_9_9 + challenge_39_9
    seed(db, 'memberships', { openid: 'o4', status: 'active', level: 'monthly', memberType: 'vip_month_39_9', expiredAt: T0 - 1000, permissions: ['full_report', 'challenge_full', 'unlimited_ai'] })
    seed(db, 'entitlements', {
      openid: 'o4',
      permissions: ['challenge_full', 'full_report', 'report_history', 'growth_review', 'report_unlock'],
      sources: [
        { productId: 'challenge_39_9', expiresAt: 0 },
        { productId: 'report_9_9', expiresAt: 0 },
        { productId: 'vip_month_39_9', expiresAt: T0 - 1000 },
      ],
    })
    const res = await PE.revokeExpiredPermissions(db)
    eq(res.success, true, 'E revoke ran')
    const ent = db._store.entitlements[0]
    const ids = (ent.sources || []).map((s) => s.productId).sort()
    eq(JSON.stringify(ids), JSON.stringify(['challenge_39_9', 'report_9_9']), 'E legacy permanent sources retained, expired membership source dropped')
    ok(ent.permissions.includes('full_report') && ent.permissions.includes('challenge_full'), 'E legacy perms rebuilt')
    ok(ent.permissions.includes('report_unlock'), 'E report_unlock retained')
    eq(db._store.memberships[0].status, 'expired', 'E membership marked expired')
    // resolver: legacy rights survive
    const acc = AA.resolveAccess({ membership: null, sources: ent.sources, now: T0 })
    eq(acc.report.source, 'LEGACY_REPORT_9_9', 'E legacy report survives expiry')
    eq(acc.challenge.source, 'LEGACY_CHALLENGE_39_9', 'E legacy challenge survives expiry')
  }

  // ── E2: no legacy sources → clean downgrade to free ──
  {
    const db = makeDb()
    seed(db, 'memberships', { openid: 'o5', status: 'active', level: 'monthly', memberType: 'vip_month_39_9', expiredAt: T0 - 1 })
    seed(db, 'entitlements', { openid: 'o5', permissions: ['full_report', 'challenge_full'], sources: [{ productId: 'vip_month_39_9', expiresAt: T0 - 1 }] })
    await PE.revokeExpiredPermissions(db)
    const ent = db._store.entitlements[0]
    eq((ent.sources || []).length, 0, 'E2 materialized membership source removed when expired')
    ok(!ent.permissions.includes('full_report') && !ent.permissions.includes('challenge_full'), 'E2 membership perms removed')
  }

  // ── copy integrity (payment bundles) ──
  {
    const crypto = require('crypto')
    const sha = (p) => crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, p))).digest('hex')
    eq(sha('cloudfunctions/common/entitlementService.js'), sha('cloudfunctions/payCallback/lib/entitlementService.js'), 'entitlementService copy identical')
    eq(sha('cloudfunctions/common/entitlementService.js'), sha('cloudfunctions/verifyPayment/lib/entitlementService.js'), 'entitlementService verify copy identical')
    eq(sha('cloudfunctions/common/permissionEngine.js'), sha('cloudfunctions/payCallback/lib/permissionEngine.js'), 'permissionEngine copy identical')
    eq(sha('cloudfunctions/common/permissionEngine.js'), sha('cloudfunctions/startChallenge/lib/permissionEngine.js'), 'permissionEngine startChallenge copy identical')
    eq(sha('cloudfunctions/common/accessAuthority.js'), sha('cloudfunctions/createOrder/lib/accessAuthority.js'), 'accessAuthority copy identical')
  }

  console.log(`\nstage1b_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
