#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.14/callback-containment.test.js
 *   RC8_14_P0_PROD_CALLBACK_FAIL_CLOSED_PATCH — local security tests (no deploy).
 *
 * Proves the fail-closed caller-authority gate (callbackAuthority.js), wired into
 * virtualPayCallback/index.js, denies EVERY external callback BEFORE any DB
 * access — including complete-looking payloads, attacker-supplied trust flags and
 * the vulnerable 'XPAY'+outTradeNo fallback — with ZERO paid/entitlement writes.
 *
 * The trusted push allow-list is EMPTY, so no input can finalize. The query-based
 * confirmation path (verifyVirtualPayment) remains the independent authority.
 *
 * Uses the index-harness that mirrors the real unique indexes
 * (payments.transactionId, entitlement_grants.orderId).
 */
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..', '..')
const { makeDb, seed } = require('../rc8.13/_harness.js')

const AUTH = require(path.join(ROOT, 'cloudfunctions/virtualPayCallback/lib/callbackAuthority.js'))
const FIN = require(path.join(ROOT, 'cloudfunctions/common/paymentFinalizer.js'))
const ESVC = require(path.join(ROOT, 'cloudfunctions/common/entitlementService.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))
const coll = (db, n) => (db._store[n] || [])

const deps = { finalizePaidOrder: FIN.finalizePaidOrder, grantEntitlements: ESVC.grantEntitlements }
const OWNER = 'oVICTIM0000000000000000000000'

function freshOrder (db, { orderId = 'VO261017000000AAAAAA', openid = OWNER, productId = 'vip_month_39_9', amount = 3990 } = {}) {
  seed(db, 'products', { productId, type: 'membership', permission: 'vip', durationDays: 30 })
  const o = { orderId, openid, productId, totalAmount: amount, status: 'pending_payment', env: 1, virtualProductId: '30' }
  seed(db, 'orders', o)
  return o
}
const writes = (db) => ({
  orders_paid: coll(db, 'orders').filter((o) => o.status === 'paid').length,
  payments: coll(db, 'payments').length,
  grants: coll(db, 'entitlement_grants').length,
  memberships: coll(db, 'memberships').length,
  entitlements: coll(db, 'entitlements').length,
})
const allZero = (w) => w.orders_paid === 0 && w.payments === 0 && w.grants === 0 && w.memberships === 0 && w.entitlements === 0

const full = (o, over) => Object.assign({
  Event: 'xpay_goods_deliver_notify', OpenId: o.openid, OutTradeNo: o.orderId, Env: 1,
  WeChatPayInfo: { TransactionId: '4500000468202610172043174649' },
  GoodsInfo: { ProductId: '30', Quantity: 1, ActualPrice: o.totalAmount },
}, over || {})

console.log('RC8_14_P0_PROD_CALLBACK_FAIL_CLOSED_PATCH — callback authority tests')

;(async () => {
  // ═══ PHASE_2 — every forged/own/arbitrary/fallback/complete payload DENIED ═══

  // D1 forged callback (no provider txn) — the exact shape the deployed func accepted
  {
    const db = makeDb(); const o = freshOrder(db)
    const forged = { Event: 'xpay_goods_deliver_notify', OpenId: o.openid, OutTradeNo: o.orderId, WeChatPayInfo: {}, GoodsInfo: { ProductId: '30', Quantity: 1 } }
    const r = await AUTH.applyContainedCallback(db, forged, deps, {})
    eq(r.applied, false, 'D1 forged callback denied')
    eq(r.reason, AUTH.REASONS.TRANSACTION_ID_MISSING, 'D1 reason TRANSACTION_ID_MISSING')
    eq(db._store.orders[0].status, 'pending_payment', 'D1 pending order NOT marked paid')
    ok(allZero(writes(db)), 'D1 ZERO DB writes')
  }

  // D2 own-order callback still denied (ownership is not authority)
  {
    const db = makeDb(); const o = freshOrder(db)
    const r = await AUTH.applyContainedCallback(db, full(o), deps, { wxContext: {} })
    eq(r.applied, false, 'D2 own-order complete-looking callback denied')
    eq(r.reason, AUTH.REASONS.CALLBACK_DISABLED, 'D2 reason CALLBACK_DISABLED')
    ok(allZero(writes(db)), 'D2 ZERO DB writes')
  }

  // D3 arbitrary transactionId denied
  {
    const db = makeDb(); const o = freshOrder(db)
    const r = await AUTH.applyContainedCallback(db, full(o, { WeChatPayInfo: { TransactionId: 'MY-ARBITRARY-TXN-ID-123456' } }), deps, {})
    eq(r.applied, false, 'D3 arbitrary txn denied'); eq(r.reason, AUTH.REASONS.CALLBACK_DISABLED, 'D3 CALLBACK_DISABLED')
    ok(allZero(writes(db)), 'D3 ZERO writes')
  }

  // D4 fallback XPAY transaction denied
  {
    const db = makeDb(); const o = freshOrder(db)
    const r = await AUTH.applyContainedCallback(db, full(o, { WeChatPayInfo: { TransactionId: 'XPAY' + o.orderId } }), deps, {})
    eq(r.applied, false, 'D4 XPAY fallback denied'); eq(r.reason, AUTH.REASONS.TRANSACTION_ID_FALLBACK, 'D4 TRANSACTION_ID_FALLBACK')
    ok(allZero(writes(db)), 'D4 ZERO writes')
  }

  // D5 missing provider evidence denied
  {
    const db = makeDb(); const o = freshOrder(db)
    const r = await AUTH.applyContainedCallback(db, full(o, { WeChatPayInfo: {} }), deps, {})
    eq(r.applied, false, 'D5 missing evidence denied'); eq(r.reason, AUTH.REASONS.TRANSACTION_ID_MISSING, 'D5 TRANSACTION_ID_MISSING')
    ok(allZero(writes(db)), 'D5 ZERO writes')
  }

  // D6 forged trusted-source flag DENIED (event-level trust ignored)
  {
    const db = makeDb(); const o = freshOrder(db)
    const r = await AUTH.applyContainedCallback(db, full(o, { trustedPushSource: true, __trustedPush: true, trusted: true }), deps, {})
    eq(r.applied, false, 'D6 event-supplied trust flag ignored'); eq(r.reason, AUTH.REASONS.CALLBACK_DISABLED, 'D6 CALLBACK_DISABLED')
    ok(allZero(writes(db)), 'D6 ZERO writes')
  }

  // D7 forged trusted marker via wxContext DENIED (allow-list is empty)
  {
    const db = makeDb(); const o = freshOrder(db)
    const r = await AUTH.applyContainedCallback(db, full(o), deps, { wxContext: { __trustedPushOrigin: 'xpay_goods_deliver_notify' } })
    eq(r.applied, false, 'D7 forged wxContext trust marker ignored'); eq(r.reason, AUTH.REASONS.CALLBACK_DISABLED, 'D7 CALLBACK_DISABLED')
    ok(allZero(writes(db)), 'D7 ZERO writes')
    eq(AUTH.isTrustedPushSource({ wxContext: { __trustedPushOrigin: 'xpay_goods_deliver_notify' } }), false, 'D7 isTrustedPushSource false (empty allow-list)')
  }

  // D8 callback with complete-looking payload STILL DENIED (zero writes)
  {
    const db = makeDb(); const o = freshOrder(db)
    const r = await AUTH.applyContainedCallback(db, full(o), deps, { wxContext: {}, env: process.env })
    eq(r.applied, false, 'D8 complete-looking payload denied'); eq(r.reason, AUTH.REASONS.CALLBACK_DISABLED, 'D8 CALLBACK_DISABLED')
    ok(allZero(writes(db)), 'D8 ZERO DB writes')
    eq(coll(db, 'orders')[0].status, 'pending_payment', 'D8 order not marked paid')
  }

  // D9 client-asserted paid denied (checked before trust gate)
  {
    const db = makeDb(); const o = freshOrder(db)
    const r = await AUTH.applyContainedCallback(db, full(o, { ClientPaid: true }), deps, {})
    eq(r.applied, false, 'D9 client-asserted paid denied'); eq(r.reason, AUTH.REASONS.CLIENT_ASSERTED_PAID, 'D9 CLIENT_ASSERTED_PAID')
    ok(allZero(writes(db)), 'D9 ZERO writes')
  }

  // D10 non-delivery event is a benign no-op (ack 0, no write)
  {
    const db = makeDb(); const o = freshOrder(db)
    const r = await AUTH.applyContainedCallback(db, { Event: 'something_else', OutTradeNo: o.orderId }, deps, {})
    eq(r.applied, false, 'D10 non-event no-op'); eq(r.ack, 0, 'D10 benign ack 0'); eq(r.reason, AUTH.REASONS.NOT_NOTIFY_EVENT, 'D10 NOT_NOTIFY_EVENT')
    ok(allZero(writes(db)), 'D10 ZERO writes')
  }

  // D11 allow-list is empty and can never be populated by env/client
  {
    eq(Array.isArray(AUTH.TRUSTED_PUSH_SOURCES) && AUTH.TRUSTED_PUSH_SOURCES.length, 0, 'D11 TRUSTED_PUSH_SOURCES empty')
    ok(Object.isFrozen(AUTH.TRUSTED_PUSH_SOURCES), 'D11 allow-list frozen')
  }

  // D12 no denied path performs ANY DB access (order lookup must not run)
  {
    const db = makeDb(); const o = freshOrder(db)
    const original = db.collection.bind(db)
    let reads = 0
    db.collection = (n) => { reads++; return original(n) }
    await AUTH.applyContainedCallback(db, full(o), deps, { wxContext: {} })
    eq(reads, 0, 'D12 denied path performs ZERO collection reads (deny before DB)')
  }

  // ═══ PHASE_3 — index.js wiring / no bypass ═══
  {
    const idx = fs.readFileSync(path.join(ROOT, 'cloudfunctions/virtualPayCallback/index.js'), 'utf8')
    const idxCode = idx.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n')
    ok(/require\(['"]\.\/lib\/callbackAuthority\.js['"]\)/.test(idxCode), 'I1 index.js requires callbackAuthority')
    ok(/applyContainedCallback\(/.test(idxCode), 'I2 index.js applies the contained callback')
    ok(!/'XPAY'\s*\+\s*outTradeNo/.test(idxCode), 'I3 index.js has NO synthetic XPAY fallback')
    ok(!/finalizePaidOrder\(/.test(idxCode), 'I4 index.js does NOT call finalizePaidOrder directly')
    ok(!/db\.collection\(['"]orders['"]\)/.test(idxCode), 'I5 index.js performs no direct order read')
  }

  // ═══ PHASE_3 — query path unchanged ═══
  {
    const vp = fs.readFileSync(path.join(ROOT, 'cloudfunctions/verifyVirtualPayment/index.js'), 'utf8')
    ok(/xpay\/query_order/.test(vp), 'Q1 verifyVirtualPayment still query-authoritative (unchanged)')
    ok(/finalizePaidOrder\(/.test(vp), 'Q2 verifyVirtualPayment still finalizes via shared path (unchanged)')
  }

  console.log(`\ncallback-containment_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
