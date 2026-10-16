#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.14/batch3-virtual-payment-security.test.js
 *   RC8_14_D12_R6C_R6_8 — MINIMAL_VIRTUAL_PAYMENT_SECURITY (local, no deploy).
 *
 * Covers the three security pillars of the minimal virtual-payment set
 * {createVirtualOrder, verifyVirtualPayment}:
 *
 *   P — SANDBOX ENVIRONMENT LOCK (virtualPayEnvLock):
 *       staging sandbox accepted; staging production-mode / production-key /
 *       missing-identity / ambiguous-identity / unknown-env / malformed-flag /
 *       missing-sandbox-key all rejected; production behaviour preserved;
 *       no production fallback; server controls provider choice; locked copies identical.
 *
 *   Q — QUERY-ONLY AUTHORITY (shared finalizer + source guards):
 *       official query path only (no callback); authenticated provider evidence;
 *       server-derived openid; order ownership; amount equality; transaction
 *       uniqueness / replay; idempotent exactly-once; client-asserted paid rejected;
 *       forged/unverified provider responses rejected; mock txn guard;
 *       expired VIP denied even with cached permissions; valid VIP / permanent valid;
 *       every failed path leaves ZERO entitlement/membership writes.
 *
 * Node built-ins only. No network, no real DB, no payment, no deploy.
 */
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..', '..')
// Use the harness that mirrors the REAL unique indexes (payments.transactionId,
// entitlement_grants.orderId) — the exactly-once guarantees depend on them.
const { makeDb, seed } = require('../rc8.13/_harness.js')

const LOCK = require(path.join(ROOT, 'cloudfunctions/createVirtualOrder/lib/virtualPayEnvLock.js'))
const FIN = require(path.join(ROOT, 'cloudfunctions/common/paymentFinalizer.js'))
const PE = require(path.join(ROOT, 'cloudfunctions/createVirtualOrder/lib/permissionEngine.js'))
const ESVC = require(path.join(ROOT, 'cloudfunctions/common/entitlementService.js'))

const STAGING = 'fanshen002-d9g0rjr3b6e313af5'
const PROD = 'fanshex-d2g0adgv7dfbc9bdc'
const DAY = 86400000
const T0 = 1790770000000

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))
const coll = (db, n) => (db._store[n] || [])

// ── lock helper: staging wxContext with overridable env vars ──
const stagingCtx = { ENV: STAGING }
const sandboxEnv = { VIRTUAL_PAY_ENV: '1', VIRTUAL_PAY_SANDBOX_APP_KEY: 'sandbox-key-xyz' }

const monthlyOrder = (openid, orderId) => ({ orderId, openid, productId: 'vip_month_39_9', totalAmount: 3990, status: 'pending_payment', env: 1 })
const providerFor = (order, txn) => ({
  tradeState: 'SUCCESS', transactionId: txn, outTradeNo: order.orderId, mchid: '', appid: '',
  amountTotal: order.totalAmount, amountCurrency: 'CNY', amountPayerTotal: order.totalAmount,
  tradeType: 'VIRTUAL', bankType: '', successTime: '1790770000',
})
const deps = { grantEntitlements: ESVC.grantEntitlements }

console.log('RC8_14_D12_R6C_R6_8 — MINIMAL VIRTUAL PAYMENT SECURITY')

;(async () => {
  // ══════════════════════════════════════════════════════════════════════
  // P — SANDBOX ENVIRONMENT LOCK
  // ══════════════════════════════════════════════════════════════════════

  // P1 staging sandbox mode accepted (explicit)
  {
    const r = LOCK.resolveVirtualPayEnv({ wxContext: stagingCtx, env: sandboxEnv, appKeyRequired: true })
    eq(r.ok, true, 'P1 staging sandbox accepted')
    eq(r.envFlag, 1, 'P1 envFlag locked to sandbox (1)')
    eq(r.provider, 'sandbox', 'P1 provider sandbox')
    eq(r.locked, true, 'P1 marked locked')
    ok(r.envId === STAGING, 'P1 resolved literal staging envId')
  }

  // P2 staging sandbox default (VIRTUAL_PAY_ENV absent → sandbox, never prod)
  {
    const r = LOCK.resolveVirtualPayEnv({ wxContext: stagingCtx, env: { VIRTUAL_PAY_SANDBOX_APP_KEY: 'k' }, appKeyRequired: true })
    eq(r.ok, true, 'P2 default (no flag) → sandbox accepted')
    eq(r.envFlag, 1, 'P2 no production fallback under staging')
    eq(r.provider, 'sandbox', 'P2 provider sandbox')
  }

  // P3 staging production mode rejected
  {
    const r = LOCK.resolveVirtualPayEnv({ wxContext: stagingCtx, env: { VIRTUAL_PAY_ENV: '0', VIRTUAL_PAY_SANDBOX_APP_KEY: 'k' }, appKeyRequired: true })
    eq(r.ok, false, 'P3 staging prod-mode rejected')
    eq(r.reason, LOCK.REASONS.PROD_MODE_FORBIDDEN, 'P3 reason PROD_MODE_FORBIDDEN')
    eq(r.provider, null, 'P3 no provider selected')
  }

  // P4 staging production key rejected
  {
    const r = LOCK.resolveVirtualPayEnv({ wxContext: stagingCtx, env: { VIRTUAL_PAY_ENV: '1', VIRTUAL_PAY_SANDBOX_APP_KEY: 'k', VIRTUAL_PAY_PROD_APP_KEY: 'prod-secret' }, appKeyRequired: true })
    eq(r.ok, false, 'P4 staging prod-key rejected')
    eq(r.reason, LOCK.REASONS.PROD_KEY_FORBIDDEN, 'P4 reason PROD_KEY_FORBIDDEN')
  }

  // P5 missing env identity rejected (ambiguous identity)
  {
    const r = LOCK.resolveVirtualPayEnv({ wxContext: {}, env: { VIRTUAL_PAY_SANDBOX_APP_KEY: 'k' }, appKeyRequired: true })
    eq(r.ok, false, 'P5 missing identity rejected')
    eq(r.reason, LOCK.REASONS.ENV_IDENTITY_MISSING, 'P5 reason ENV_IDENTITY_MISSING')
  }

  // P5b ambiguous env identity rejected (two sources disagree)
  {
    const r = LOCK.resolveVirtualPayEnv({ wxContext: { ENV: STAGING }, env: { TCB_ENV: PROD, VIRTUAL_PAY_SANDBOX_APP_KEY: 'k' }, appKeyRequired: true })
    eq(r.ok, false, 'P5b ambiguous identity rejected')
    eq(r.reason, LOCK.REASONS.ENV_IDENTITY_AMBIGUOUS, 'P5b reason ENV_IDENTITY_AMBIGUOUS')
  }

  // P5c unknown/undeclared env rejected (fail-closed)
  {
    const r = LOCK.resolveVirtualPayEnv({ wxContext: { ENV: 'unknown-env-123' }, env: { VIRTUAL_PAY_SANDBOX_APP_KEY: 'k' }, appKeyRequired: true })
    eq(r.ok, false, 'P5c unknown env rejected')
    eq(r.reason, LOCK.REASONS.ENV_NOT_ALLOWED, 'P5c reason ENV_NOT_ALLOWED')
  }

  // P6 missing sandbox key rejected (when a key is required)
  {
    const r = LOCK.resolveVirtualPayEnv({ wxContext: stagingCtx, env: { VIRTUAL_PAY_ENV: '1' }, appKeyRequired: true })
    eq(r.ok, false, 'P6 missing sandbox key rejected')
    eq(r.reason, LOCK.REASONS.SANDBOX_KEY_MISSING, 'P6 reason SANDBOX_KEY_MISSING')
    // absent-key tolerance when not required (selfcheck / config probe)
    const r2 = LOCK.resolveVirtualPayEnv({ wxContext: stagingCtx, env: { VIRTUAL_PAY_ENV: '1' }, appKeyRequired: false })
    eq(r2.ok, true, 'P6b key not required → still sandbox-locked accept')
    eq(r2.envFlag, 1, 'P6b still sandbox')
  }

  // P7 malformed env flag rejected
  {
    for (const bad of ['undefined', 'null', 'NaN', 'true', '2', 'sandbox', '']) {
      if (bad === '') {
        // empty string is treated as default (sandbox), NOT malformed
        const r = LOCK.resolveVirtualPayEnv({ wxContext: stagingCtx, env: { VIRTUAL_PAY_ENV: '', VIRTUAL_PAY_SANDBOX_APP_KEY: 'k' }, appKeyRequired: true })
        eq(r.ok, true, 'P7 empty flag → default sandbox (not malformed)')
        eq(r.envFlag, 1, 'P7 empty flag locked sandbox')
        continue
      }
      if (bad === 'true' || bad === '2' || bad === 'sandbox') {
        // non 0/1 literal → malformed
        const r = LOCK.resolveVirtualPayEnv({ wxContext: stagingCtx, env: { VIRTUAL_PAY_ENV: bad, VIRTUAL_PAY_SANDBOX_APP_KEY: 'k' }, appKeyRequired: true })
        eq(r.ok, false, `P7 malformed flag "${bad}" rejected`)
        eq(r.reason, LOCK.REASONS.MALFORMED_ENV_FLAG, `P7 "${bad}" reason MALFORMED`)
        continue
      }
      const r = LOCK.resolveVirtualPayEnv({ wxContext: stagingCtx, env: { VIRTUAL_PAY_ENV: bad, VIRTUAL_PAY_SANDBOX_APP_KEY: 'k' }, appKeyRequired: true })
      eq(r.ok, false, `P7 malformed flag "${bad}" rejected`)
      eq(r.reason, LOCK.REASONS.MALFORMED_ENV_FLAG, `P7 "${bad}" reason MALFORMED`)
    }
    eq(LOCK.isMalformedFlag('undefined'), true, 'P7 isMalformedFlag undefined')
    eq(LOCK.isMalformedFlag('1'), false, 'P7 isMalformedFlag valid 1')
    eq(LOCK.isMalformedFlag(null), false, 'P7 isMalformedFlag missing (null) not malformed')
  }

  // P8 production behaviour preserved (no new constraint / no deploy)
  {
    const rProd = LOCK.resolveVirtualPayEnv({ wxContext: { ENV: PROD }, env: { VIRTUAL_PAY_ENV: '0' }, appKeyRequired: true })
    eq(rProd.ok, true, 'P8 production env still resolves')
    eq(rProd.envFlag, 0, 'P8 production flag 0 preserved')
    eq(rProd.provider, 'prod', 'P8 production provider preserved')
    eq(rProd.locked, false, 'P8 production not sandbox-locked')
    const rProd2 = LOCK.resolveVirtualPayEnv({ wxContext: { ENV: PROD }, env: {}, appKeyRequired: true })
    eq(rProd2.ok, true, 'P8 production without flag still resolves')
    eq(rProd2.envFlag, 1, 'P8 production default flag preserved (=1)')
  }

  // P9 server controls provider choice (no client input path)
  {
    // resolveVirtualPayEnv ignores any event/caller-supplied env: only wxContext + process.env.
    const r = LOCK.resolveVirtualPayEnv({ wxContext: stagingCtx, env: sandboxEnv, appKeyRequired: true, event: { Env: 0, VIRTUAL_PAY_ENV: '0' } })
    eq(r.ok, true, 'P9 caller-supplied Env ignored')
    eq(r.envFlag, 1, 'P9 provider stays sandbox despite caller Env=0')
  }

  // P10 locked copies identical across the two target functions
  {
    const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex')
    eq(
      sha('cloudfunctions/createVirtualOrder/lib/virtualPayEnvLock.js'),
      sha('cloudfunctions/verifyVirtualPayment/lib/virtualPayEnvLock.js'),
      'P10 lock copy identical createVirtualOrder vs verifyVirtualPayment'
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // Q — QUERY-ONLY AUTHORITY (shared finalizer)
  // ══════════════════════════════════════════════════════════════════════

  // Q1 valid sandbox confirmation finalizes exactly once
  {
    const db = makeDb()
    seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o = monthlyOrder('oQ1', 'VOQ1'); seed(db, 'orders', o)
    const r1 = await FIN.finalizePaidOrder(db, { orderId: 'VOQ1', openid: 'oQ1', source: 'query', provider: providerFor(o, 'TXNQ01'), expect: { mchid: '', appid: '' }, ts: T0 }, deps)
    eq(r1.ok, true, 'Q1 query finalize ok')
    eq(r1.idempotent, false, 'Q1 first not idempotent')
    eq(coll(db, 'payments').length, 1, 'Q1 one payment')
    eq(coll(db, 'entitlement_grants').length, 1, 'Q1 one grant')
    eq(coll(db, 'memberships').length, 1, 'Q1 one membership')
    const r2 = await FIN.finalizePaidOrder(db, { orderId: 'VOQ1', openid: 'oQ1', source: 'query', provider: providerFor(o, 'TXNQ01'), expect: {}, ts: T0 + 10 }, deps)
    eq(r2.ok && r2.idempotent === true, true, 'Q2 duplicate query idempotent')
    eq(coll(db, 'payments').length, 1, 'Q2 still one payment (exactly-once)')
    eq(coll(db, 'memberships').length, 1, 'Q2 still one membership (no double extend)')
    eq(db._store.memberships[0].expiredAt, T0 + 30 * DAY, 'Q2 no double extend value')
  }

  // Q3 wrong-order openid denied
  {
    const db = makeDb(); seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o = monthlyOrder('ownerQ3', 'VOQ3'); seed(db, 'orders', o)
    const r = await FIN.finalizePaidOrder(db, { orderId: 'VOQ3', openid: 'attacker', source: 'query', provider: providerFor(o, 'TXNQ03'), expect: {}, ts: T0 }, deps)
    eq(r.ok, false, 'Q3 wrong openid denied')
    eq(r.reason, FIN.REASONS.OWNERSHIP_MISMATCH, 'Q3 OWNERSHIP_MISMATCH')
    eq(coll(db, 'memberships').length, 0, 'Q3 zero membership writes')
    eq(coll(db, 'entitlement_grants').length, 0, 'Q3 zero grant writes')
    eq(db._store.orders[0].status, 'pending_payment', 'Q3 order not marked paid')
  }

  // Q4 wrong amount denied
  {
    const db = makeDb(); seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o = monthlyOrder('oQ4', 'VOQ4'); seed(db, 'orders', o)
    const bad = providerFor(o, 'TXNQ04'); bad.amountTotal = 1
    const r = await FIN.finalizePaidOrder(db, { orderId: 'VOQ4', source: 'query', provider: bad, expect: {}, ts: T0 }, deps)
    eq(r.ok, false, 'Q4 amount mismatch denied')
    eq(r.reason, FIN.REASONS.AMOUNT_MISMATCH, 'Q4 AMOUNT_MISMATCH')
    eq(coll(db, 'memberships').length + coll(db, 'entitlement_grants').length, 0, 'Q4 zero entitlement writes')
  }

  // Q5 wrong product denied (unknown product → grant denied, zero writes)
  {
    const db = makeDb()
    const o = { orderId: 'VOQ5', openid: 'oQ5', productId: 'not_a_product', totalAmount: 123, status: 'pending_payment' }
    seed(db, 'orders', o)
    const r = await FIN.finalizePaidOrder(db, { orderId: 'VOQ5', openid: 'oQ5', source: 'query', provider: providerFor(o, 'TXNQ05'), expect: {}, ts: T0 }, deps)
    eq(r.entitlementApplied, false, 'Q5 unknown product → entitlement NOT applied')
    eq(coll(db, 'memberships').length, 0, 'Q5 zero membership writes')
    eq(coll(db, 'entitlements').length, 0, 'Q5 zero entitlement writes')
  }

  // Q6 unverified / forged provider response denied
  {
    // no provider at all
    let db = makeDb(); const o = monthlyOrder('oQ6', 'VOQ6'); seed(db, 'orders', o)
    let r = await FIN.finalizePaidOrder(db, { orderId: 'VOQ6', source: 'query', provider: null, expect: {}, ts: T0 }, deps)
    eq(r.ok, false, 'Q6 null provider denied'); eq(r.reason, FIN.REASONS.NO_PROVIDER, 'Q6 NO_PROVIDER')
    eq(coll(db, 'memberships').length, 0, 'Q6 zero writes (null provider)')
    // trade state not success (failed/absent query)
    db = makeDb(); seed(db, 'orders', { ...o }); const p = providerFor(o, 'TXNQ06'); p.tradeState = 'NOTPAY'
    r = await FIN.finalizePaidOrder(db, { orderId: 'VOQ6', source: 'query', provider: p, expect: {}, ts: T0 }, deps)
    eq(r.ok, false, 'Q6 non-SUCCESS trade state denied'); eq(r.reason, FIN.REASONS.TRADE_STATE_NOT_SUCCESS, 'Q6 TRADE_STATE_NOT_SUCCESS')
    eq(coll(db, 'memberships').length, 0, 'Q6 zero writes (not success)')
    // missing transaction id
    db = makeDb(); seed(db, 'orders', { ...o }); const p2 = providerFor(o, ''); p2.transactionId = ''
    r = await FIN.finalizePaidOrder(db, { orderId: 'VOQ6', source: 'query', provider: p2, expect: {}, ts: T0 }, deps)
    eq(r.ok, false, 'Q6 missing txid denied'); eq(r.reason, FIN.REASONS.TRANSACTION_ID_MISSING, 'Q6 TRANSACTION_ID_MISSING')
  }

  // Q7 replayed transaction rejected (reuse across orders)
  {
    const db = makeDb(); seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const a = monthlyOrder('oQ7', 'VOQ7A'); const b = monthlyOrder('oQ7', 'VOQ7B')
    seed(db, 'orders', a); seed(db, 'orders', b)
    await FIN.finalizePaidOrder(db, { orderId: 'VOQ7A', source: 'query', provider: providerFor(a, 'TXNQ07'), expect: {}, ts: T0 }, deps)
    const r = await FIN.finalizePaidOrder(db, { orderId: 'VOQ7B', source: 'query', provider: providerFor(b, 'TXNQ07'), expect: {}, ts: T0 }, deps)
    eq(r.ok, false, 'Q7 replay rejected'); eq(r.reason, FIN.REASONS.TRANSACTION_ID_REUSED, 'Q7 TRANSACTION_ID_REUSED')
    eq(db._store.orders.find((x) => x.orderId === 'VOQ7B').status, 'pending_payment', 'Q7 second order not paid')
    eq(coll(db, 'memberships').length, 1, 'Q7 only first membership')
  }

  // Q8 client-asserted paid rejected (finalizer never trusts caller "paid")
  {
    const db = makeDb(); seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o = monthlyOrder('oQ8', 'VOQ8'); seed(db, 'orders', o)
    // attacker "asserts" paid via ctx fields, but provides no provider evidence
    const r = await FIN.finalizePaidOrder(db, {
      orderId: 'VOQ8', source: 'query', provider: null,
      paid: true, clientPaid: true, success: true, tradeState: 'SUCCESS',
      expect: {}, ts: T0,
    }, deps)
    eq(r.ok, false, 'Q8 client-asserted paid rejected (no provider evidence)')
    eq(db._store.orders[0].status, 'pending_payment', 'Q8 order stays pending')
    eq(coll(db, 'memberships').length, 0, 'Q8 zero writes on client assertion')
  }

  // Q9 mock transaction id guard (when wired)
  {
    const db = makeDb(); seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o = monthlyOrder('oQ9', 'VOQ9'); seed(db, 'orders', o)
    const isMock = (t) => /^XPAY/.test(String(t))
    const r = await FIN.finalizePaidOrder(db, { orderId: 'VOQ9', source: 'query', provider: providerFor(o, 'XPAYVOQ9'), expect: {}, ts: T0 }, { grantEntitlements: ESVC.grantEntitlements, isMockTransactionId: isMock })
    eq(r.ok, false, 'Q9 mock txn rejected when guard wired')
    eq(r.reason, FIN.REASONS.MOCK_NOT_ALLOWED, 'Q9 MOCK_NOT_ALLOWED')
    eq(coll(db, 'memberships').length, 0, 'Q9 zero writes for mock txn')
  }

  // Q10 query-only flow: no callback dependency
  {
    const vp = fs.readFileSync(path.join(ROOT, 'cloudfunctions/verifyVirtualPayment/index.js'), 'utf8')
    ok(/xpay\/query_order/.test(vp), 'Q10 verify path uses official /xpay/query_order')
    ok(!/source:\s*'callback'/.test(vp), 'Q10 verify path does NOT use callback source')
    ok(!/require\(['"]\.\/lib\/virtualPayCallback/.test(vp), 'Q10 verify path does not import callback')
    // local order closure is only via finalizePaidOrder
    ok(/finalizePaidOrder\(/.test(vp), 'Q10 verify path completes via shared finalizer')
  }

  // Q11 transaction uniqueness / idempotent finalizer under concurrency
  {
    const db = makeDb(); seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o = monthlyOrder('oQ11', 'VOQ11'); seed(db, 'orders', o)
    const [r1, r2] = await Promise.all([
      FIN.finalizePaidOrder(db, { orderId: 'VOQ11', source: 'query', provider: providerFor(o, 'TXNQ011'), expect: {}, ts: T0 }, deps),
      FIN.finalizePaidOrder(db, { orderId: 'VOQ11', source: 'query', provider: providerFor(o, 'TXNQ011'), expect: {}, ts: T0 }, deps),
    ])
    eq(r1.ok && r2.ok, true, 'Q11 both concurrent ok')
    eq(coll(db, 'payments').length, 1, 'Q11 one payment (at-most-once)')
    eq(coll(db, 'entitlement_grants').length, 1, 'Q11 one grant')
    eq(coll(db, 'memberships').length, 1, 'Q11 one membership')
  }

  // Q12 expired or invalid orders cannot gain unauthorized access
  {
    const db = makeDb(); seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o = monthlyOrder('oQ12', 'VOQ12'); o.status = 'closed'; seed(db, 'orders', o)
    const r = await FIN.finalizePaidOrder(db, { orderId: 'VOQ12', source: 'query', provider: providerFor(o, 'TXNQ012'), expect: {}, ts: T0 }, deps)
    eq(r.ok, false, 'Q12 closed order not finalizable')
    eq(r.reason, FIN.REASONS.ORDER_STATUS_NOT_FINALIZABLE, 'Q12 ORDER_STATUS_NOT_FINALIZABLE')
    eq(coll(db, 'memberships').length, 0, 'Q12 zero writes for closed order')
  }

  // ══════════════════════════════════════════════════════════════════════
  // R — ENGINE EXPIRY / AUTHORITY (aligned hardened permissionEngine)
  // ══════════════════════════════════════════════════════════════════════

  // R1 expired VIP denied even with cached permissions present
  {
    const db = makeDb()
    seed(db, 'entitlements', { openid: 'oR1', permissions: ['vip_rules', 'full_report', 'challenge_full'], sources: [{ productId: 'vip_month_39_9', expiresAt: T0 - 1 }] })
    const nowSpy = Date.now
    Date.now = () => T0
    try {
      eq(await PE.hasPermission(db, 'oR1', 'vip_rules'), false, 'R1 expired VIP denied (vip_rules)')
      eq(await PE.hasPermission(db, 'oR1', 'full_report'), false, 'R1 expired VIP denied (full_report)')
    } finally { Date.now = nowSpy }
    eq(coll(db, 'entitlements')[0].permissions.includes('vip_rules'), true, 'R1 cached array untouched (read-only)')
  }

  // R2 valid VIP receives timed entitlement (and engine honours it)
  {
    const db = makeDb()
    seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o = monthlyOrder('oR2', 'VOR2'); seed(db, 'orders', o)
    const nowSpy = Date.now
    Date.now = () => T0
    try {
      const r = await FIN.finalizePaidOrder(db, { orderId: 'VOR2', openid: 'oR2', source: 'query', provider: providerFor(o, 'TXNR02'), expect: {}, ts: T0 }, deps)
      eq(r.ok, true, 'R2 valid VIP finalize ok')
      eq(coll(db, 'memberships').length, 1, 'R2 timed membership created')
      eq(db._store.memberships[0].expiredAt, T0 + 30 * DAY, 'R2 membership finite expiry')
      eq(await PE.hasPermission(db, 'oR2', 'vip_rules'), true, 'R2 valid VIP gets vip_rules')
      eq(await PE.hasPermission(db, 'oR2', 'hard_truth_mode'), false, 'R2 monthly VIP does NOT get year-exclusive')
    } finally { Date.now = nowSpy }
  }

  // R2b expired timed source (after expiry) denied
  {
    const db = makeDb()
    seed(db, 'entitlements', { openid: 'oR2b', permissions: [], sources: [{ productId: 'vip_year_299', expiresAt: T0 - 1 }] })
    const nowSpy = Date.now; Date.now = () => T0
    try { eq(await PE.hasPermission(db, 'oR2b', 'hard_truth_mode'), false, 'R2b expired year VIP denied hard_truth_mode') }
    finally { Date.now = nowSpy }
  }

  // R3 permanent purchase remains valid (expiresAt 0)
  {
    const db = makeDb()
    seed(db, 'entitlements', { openid: 'oR3', permissions: [], sources: [{ productId: 'report_9_9', expiresAt: 0 }] })
    const nowSpy = Date.now; Date.now = () => T0
    try {
      eq(await PE.hasPermission(db, 'oR3', 'report_unlock'), true, 'R3 permanent report valid')
      eq(await PE.hasPermission(db, 'oR3', 'full_report'), true, 'R3 permanent report grants full_report')
    } finally { Date.now = nowSpy }
  }

  // R3b unknown product source cannot authorize (no implicit permanent)
  {
    const db = makeDb()
    seed(db, 'entitlements', { openid: 'oR3b', permissions: ['vip_rules'], sources: [{ productId: 'ghost_product', expiresAt: 0 }] })
    const nowSpy = Date.now; Date.now = () => T0
    try { eq(await PE.hasPermission(db, 'oR3b', 'vip_rules'), false, 'R3b unknown source denied (cached not trusted)') }
    finally { Date.now = nowSpy }
  }

  // R4 all failed paths → zero unauthorized entitlement writes (aggregate invariant)
  {
    const db = makeDb(); seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o = monthlyOrder('oR4', 'VOR4'); seed(db, 'orders', o)
    // a battery of failing finalizations must never write entitlements/memberships
    await FIN.finalizePaidOrder(db, { orderId: 'VOR4', openid: 'x', source: 'query', provider: providerFor(o, 'TXNR04'), expect: {}, ts: T0 }, deps) // wrong openid
    await FIN.finalizePaidOrder(db, { orderId: 'VOR4', source: 'query', provider: null, expect: {}, ts: T0 }, deps) // no provider
    const bad = providerFor(o, 'TXNR04b'); bad.amountTotal = 5
    await FIN.finalizePaidOrder(db, { orderId: 'VOR4', source: 'query', provider: bad, expect: {}, ts: T0 }, deps) // amount
    eq(coll(db, 'memberships').length, 0, 'R4 zero membership after fail battery')
    eq(coll(db, 'entitlements').length, 0, 'R4 zero entitlement after fail battery')
    eq(coll(db, 'payments').length, 0, 'R4 zero payment after fail battery')
    eq(coll(db, 'entitlement_grants').length, 0, 'R4 zero grant after fail battery')
  }

  console.log(`\nbatch3-virtual-payment-security_TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
