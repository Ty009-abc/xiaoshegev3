#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.14/entitlement-writer-fail-closed.test.js — RC8_14_D12_R6C_R5
 *
 * Entitlement-WRITER fail-closed tests for the trusted product-policy layer in
 * `cloudfunctions/common/entitlementService.js` (grantEntitlements / applyMembership).
 *
 * Invariant under test: a grant is decided by the server-owned STATIC product policy
 * FIRST, never by whether a runtime `products` row happens to exist.
 *   - permanent products (report_9_9 / challenge_39_9): permanent source (expiresAt 0).
 *   - timed products  (vip_month_39_9 / vip_month_99 / vip_year_299): MUST receive a finite,
 *     positive expiration (now + durationDays*DAY_MS). Missing/0/negative/malformed duration
 *     or missing products row => DENY, ZERO membership/entitlement writes.
 *   - unknown productId => DENY (never implicit permanent).
 * Reads stay side-effect-free; failure returns success:false and leaves the paid order intact.
 *
 * Node built-ins only. No network, no real payment, no real DB.
 */

const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const ESVC = require(path.join(ROOT, 'cloudfunctions', 'common', 'entitlementService.js'))
const PF = require(path.join(ROOT, 'cloudfunctions', 'verifyPayment', 'lib', 'paymentFinalizer.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))
const DAY = 86400 * 1000

console.log('RC8_14_D12_R6C_R5 — ENTITLEMENT WRITER FAIL-CLOSED')

// ── fake DB (CloudBase-like) ───────────────────────────────────────────────
function makeDb () {
  const store = {
    orders: [], entitlements: [], entitlement_audit: [], products: [],
    ai_reports: [], challenge_records: [], memberships: [], users: [],
  }
  const tick = () => new Promise((r) => setTimeout(r, 0))
  const command = { in: (arr) => ({ __op: 'in', $in: arr }), gt: (n) => ({ __op: 'gt', $gt: n }) }
  const UNIQUES = { entitlement_grants: ['orderId'], payments: ['transactionId'] }
  const match = (doc, q) => Object.keys(q).every((k) => {
    const c = q[k]
    if (c && c.__op === 'in') return c.$in.includes(doc[k])
    if (c && c.__op === 'gt') return doc[k] > c.$gt
    return doc[k] === c
  })
  function collection (name) {
    if (!store[name]) store[name] = []
    return {
      where (q) {
        return {
          limit () { return this },
          async get () { await tick(); return { data: store[name].filter((d) => match(d, q)).map((d) => ({ ...d })) } },
          async update ({ data }) {
            await tick()
            const rows = store[name].filter((d) => match(d, q))
            rows.forEach((d) => Object.assign(d, data))
            return { stats: { updated: rows.length } }
          },
        }
      },
      async add ({ data }) {
        await tick()
        for (const key of (UNIQUES[name] || [])) {
          if (store[name].some((d) => d[key] === data[key])) { const e = new Error('E11000 duplicate key'); e.errCode = -502001; throw e }
        }
        const doc = Object.assign({ _id: name + '_' + (store[name].length + 1) }, data)
        store[name].push(doc)
        return { _id: doc._id }
      },
      doc (id) {
        return { async update ({ data }) { await tick(); const d = store[name].find((x) => x._id === id); if (d) Object.assign(d, data); return { stats: { updated: d ? 1 : 0 } } } }
      },
      _all: () => store[name],
    }
  }
  return { collection, command, _store: store }
}

const pushRaw = (db, name, doc) => {
  const raw = Object.assign({ _id: name + '_' + (db._store[name].length + 1) }, doc)
  db._store[name].push(raw)
  return raw
}
const NOW = 1700000000000
const order = (over = {}) => Object.assign({ orderId: 'XSG_W', openid: 'oUser', productId: 'vip_month_39_9', relatedId: '' }, over)
const writes = (db) => ['memberships', 'entitlements', 'users', 'ai_reports', 'challenge_records'].reduce((n, k) => n + ((db._store[k] || []).length), 0)
const auditOnly = (db) => db._store.entitlement_audit.length

async function main () {
  // ═══ A. valid monthly VIP → 30-day source ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'A1' }), NOW)
    eq(r.success, true, 'A monthly VIP granted')
    eq(db._store.memberships.length, 1, 'A one membership row')
    eq(db._store.memberships[0].expiredAt, NOW + 30 * DAY, 'A expiredAt = now + 30d')
    const src = db._store.entitlements[0].sources.find((s) => s.productId === 'vip_month_39_9')
    eq(src.expiresAt, NOW + 30 * DAY, 'A source expiresAt finite positive (30d)')
  }

  // ═══ B. valid annual VIP → 365-day source ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_year_299', type: 'membership', permission: 'vip', durationDays: 365 })
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'B1', productId: 'vip_year_299' }), NOW)
    eq(r.success, true, 'B annual VIP granted')
    eq(db._store.memberships[0].expiredAt, NOW + 365 * DAY, 'B expiredAt = now + 365d')
  }

  // ═══ C. permanent challenge purchase → permanent challenge_full ═══
  {
    const db = makeDb()
    pushRaw(db, 'challenge_records', { recordId: 'REC1', openid: 'oUser', trialMode: true, unlocked: false })
    pushRaw(db, 'products', { productId: 'challenge_39_9', type: 'single', permission: 'challenge_unlock', durationDays: 0 })
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'C1', productId: 'challenge_39_9', relatedId: 'REC1' }), NOW)
    eq(r.success, true, 'C challenge purchase granted')
    ok(r.granted.indexOf('challenge_full') >= 0, 'C challenge_full granted')
    eq(db._store.challenge_records[0].trialMode, false, 'C record unlocked')
    const src = db._store.entitlements[0].sources.find((s) => s.productId === 'challenge_39_9')
    eq(src.expiresAt, 0, 'C permanent source (expiresAt 0)')
  }

  // ═══ D. permanent report purchase works ═══
  {
    const db = makeDb()
    pushRaw(db, 'ai_reports', { reportId: 'RPT1', openid: 'oUser', isPaid: false })
    pushRaw(db, 'products', { productId: 'report_9_9', type: 'single', permission: 'report_unlock', durationDays: 0 })
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'D1', productId: 'report_9_9', relatedId: 'RPT1' }), NOW)
    eq(r.success, true, 'D report purchase granted')
    eq(db._store.ai_reports[0].isPaid, true, 'D report unlocked')
  }

  // ═══ E. products row ABSENT → timed membership fails closed, zero writes ═══
  {
    const db = makeDb() // NO products row
    const before = writes(db)
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'E1' }), NOW)
    eq(r.success, false, 'E missing products row → NOT granted')
    eq(r.reason, 'PRODUCT_NOT_FOUND', 'E reason PRODUCT_NOT_FOUND')
    eq(db._store.memberships.length, 0, 'E zero membership writes')
    eq(writes(db), before, 'E no authoritative writes (audit excluded) before=' + before)
    ok(auditOnly(db) >= 1, 'E denial is audited')
  }

  // ═══ F. timed product: live durationDays MISSING → DENY ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip' }) // no durationDays
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'F1' }), NOW)
    eq(r.success, false, 'F missing durationDays → NOT granted')
    eq(db._store.memberships.length, 0, 'F zero membership writes')
  }

  // ═══ G. timed product: durationDays=0 → DENY ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 0 })
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'G1' }), NOW)
    eq(r.success, false, 'G durationDays=0 → NOT granted')
    eq(db._store.memberships.length, 0, 'G zero membership writes')
  }

  // ═══ H. negative duration denied ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: -5 })
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'H1' }), NOW)
    eq(r.success, false, 'H negative duration → NOT granted')
    eq(db._store.memberships.length, 0, 'H zero membership writes')
  }

  // ═══ I. NaN / Infinity duration denied ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: NaN })
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'I1' }), NOW)
    eq(r.success, false, 'I NaN duration → NOT granted')
    const db2 = makeDb()
    pushRaw(db2, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: Infinity })
    const r2 = await ESVC.grantEntitlements(db2, order({ orderId: 'I2' }), NOW)
    eq(r2.success, false, 'I Infinity duration → NOT granted')
  }

  // ═══ J. string / object duration denied ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: '30' })
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'J1' }), NOW)
    eq(r.success, false, 'J string duration → NOT granted')
    const db2 = makeDb()
    pushRaw(db2, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: {} })
    const r2 = await ESVC.grantEntitlements(db2, order({ orderId: 'J2' }), NOW)
    eq(r2.success, false, 'J object duration → NOT granted')
  }

  // ═══ K. unknown productId denied (row present, not in trusted catalog) ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'ghost_sku', type: 'membership', permission: 'vip', durationDays: 30 })
    const before = writes(db)
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'K1', productId: 'ghost_sku' }), NOW)
    eq(r.success, false, 'K unknown productId → NOT granted')
    eq(r.reason, 'UNKNOWN_PRODUCT', 'K reason UNKNOWN_PRODUCT')
    eq(writes(db), before, 'K no writes')
  }

  // ═══ L. product policy conflict (live type not membership) denied ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'single', permission: 'vip', durationDays: 30 })
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'L1' }), NOW)
    eq(r.success, false, 'L type/single conflict → NOT granted')
    eq(r.reason, 'PRODUCT_POLICY_CONFLICT', 'L reason PRODUCT_POLICY_CONFLICT')
    eq(db._store.memberships.length, 0, 'L zero membership writes')
  }

  // ═══ M. live durationDays disagrees with trusted catalog → denied ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 999 })
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'M1' }), NOW)
    eq(r.success, false, 'M duration/policy disagreement → NOT granted')
    eq(r.reason, 'PRODUCT_DURATION_INVALID', 'M reason PRODUCT_DURATION_INVALID')
  }

  // ═══ N. forged client duration ignored (order.durationDays never trusted) ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const f = order({ orderId: 'N1' }); f.durationDays = 99999; f.expiresAt = NOW + 999999 * DAY
    const r = await ESVC.grantEntitlements(db, f, NOW)
    eq(r.success, true, 'N forged client duration → still granted via policy')
    eq(db._store.memberships[0].expiredAt, NOW + 30 * DAY, 'N expiry from POLICY (30d), not client')
  }

  // ═══ O. grant failure does NOT fabricate success ═══
  {
    const db = makeDb() // missing products row
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'O1' }), NOW)
    eq(r.success, false, 'O failure not fabricated as success')
    eq(r.applied, false, 'O applied=false')
    eq((r.granted || []).length, 0, 'O granted empty')
  }

  // ═══ P. paid order state preserved on grant error (writer does not touch orders) ═══
  {
    const db = makeDb()
    const o = pushRaw(db, 'orders', { orderId: 'P1', openid: 'oUser', productId: 'vip_month_39_9', status: 'paid', paidAt: 1 })
    const before = JSON.stringify(o)
    await ESVC.grantEntitlements(db, order({ orderId: 'P1' }), NOW)
    eq(JSON.stringify(db._store.orders[0]), before, 'P paid order untouched by writer')
  }

  // ═══ Q. retry after configuration repair grants exactly once ═══
  {
    const db = makeDb() // products row absent
    const r1 = await ESVC.grantEntitlements(db, order({ orderId: 'Q1' }), NOW)
    eq(r1.success, false, 'Q first attempt fails closed')
    eq(db._store.memberships.length, 0, 'Q no membership after failure')
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 }) // "repair"
    const r2 = await ESVC.grantEntitlements(db, order({ orderId: 'Q1' }), NOW + 1000)
    eq(r2.success, true, 'Q retry after repair succeeds')
    eq(db._store.memberships.length, 1, 'Q exactly one membership row')
    eq(db._store.memberships[0].expiredAt, (NOW + 1000) + 30 * DAY, 'Q correct expiry on repaired retry')
  }

  // ═══ R. repeated grant idempotent (same order) ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    await ESVC.grantEntitlements(db, order({ orderId: 'R1' }), NOW)
    const first = db._store.memberships[0].expiredAt
    await ESVC.grantEntitlements(db, order({ orderId: 'R1' }), NOW + 5000)
    eq(db._store.memberships.length, 1, 'R one membership row')
    eq(db._store.memberships[0].expiredAt, first, 'R expiry unchanged on replay')
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'R1' }), NOW + 9000)
    eq(r.idempotent, true, 'R reported idempotent')
  }

  // ═══ S. concurrent grant attempts do not duplicate entitlement (finalizer marker guards exactly-once) ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o = { orderId: 'S1', openid: 'oUser', productId: 'vip_month_39_9', relatedId: '' }
    const [a, b] = await Promise.all([
      PF._ensureGrant(db, o, 'TXN_S1', NOW, ESVC.grantEntitlements),
      PF._ensureGrant(db, o, 'TXN_S1', NOW, ESVC.grantEntitlements),
    ])
    eq(db._store.memberships.length, 1, 'S concurrent same-order → one membership row (exactly-once)')
    const appliers = [a, b].filter((r) => r && r.applied === true).length
    eq(appliers, 1, 'S exactly one applier proved the grant')
  }

  // ═══ T. no permanent timed source written (the core P0) ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip' }) // no durationDays
    const r = await ESVC.grantEntitlements(db, order({ orderId: 'T1' }), NOW)
    eq(r.success, false, 'T timed w/o duration → denied')
    const anyPermSource = db._store.entitlements.some((e) => (e.sources || []).some((s) => s.productId === 'vip_month_39_9' && !s.expiresAt))
    ok(!anyPermSource, 'T NO permanent timed source ever written')
  }

  // ═══ U. writer & permissionEngine agree — written timed source authorizes then expires ═══
  {
    const PE = require(path.join(ROOT, 'cloudfunctions', 'common', 'permissionEngine.js'))
    const T = Date.now()
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    await ESVC.grantEntitlements(db, order({ orderId: 'U1' }), T)
    const src = db._store.entitlements[0].sources.find((s) => s.productId === 'vip_month_39_9')
    const dbNow = makeDb(); dbNow._store.entitlements = [{ _id: 'e', openid: 'oUser', permissions: ['challenge_full'], sources: [{ productId: src.productId, expiresAt: src.expiresAt }] }]
    ok(await PE.hasPermission(dbNow, 'oUser', 'challenge_full') === true, 'U written source authorizes while valid')
    const dbExp = makeDb(); dbExp._store.entitlements = [{ _id: 'e', openid: 'oUser', permissions: ['challenge_full'], sources: [{ productId: src.productId, expiresAt: T - 1 }] }]
    ok(await PE.hasPermission(dbExp, 'oUser', 'challenge_full') === false, 'U written source DENIED once past (engine agrees)')
  }

  // ═══ V. no unintended payment state change (writer never writes orders/payments) ═══
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    await ESVC.grantEntitlements(db, order({ orderId: 'V1' }), NOW)
    eq(db._store.orders.length, 0, 'V writer creates no order docs')
    ok(!('payments' in db._store) || db._store.payments.length === 0, 'V writer touches no payments')
  }

  console.log(`  _TEST pass=${pass} fail=${fail}`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
