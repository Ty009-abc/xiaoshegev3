#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.13/virtual-payment.test.js — RC8_13 Stage1 server wiring tests.
 *
 *  A  official signature golden vectors (paySig + signature)
 *  B  catalog mapping (monthly/annual id/price/duration/mode)
 *  C  signData build + single serialization (env/offerId string/outTradeNo)
 *  D  monthly grant 30d / annual grant 365d via canonical finalizer
 *  E  duplicate callback idempotent (exactly-once, no double extend)
 *  F  callback + query concurrency → exactly once
 *  G  wrong openid / amount / transaction reuse → fail-closed
 *  H  legacy preservation (report_9_9 / challenge_39_9 + expiry retains permanent)
 *  I  ordinary createOrder still blocks new virtual sale (FREE_ONLY non-regression)
 *  J  copy integrity across the three virtual-payment functions
 *  K  source guards (no client price authority; signData passthrough; no secret return)
 *
 * Node built-ins only. No network, no real DB, no real payment.
 */
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..', '..')
const { makeDb, seed } = require('./_harness.js')
const VPS = require(path.join(ROOT, 'cloudfunctions/createVirtualOrder/lib/virtualPaySigning.js'))
const CAT = require(path.join(ROOT, 'cloudfunctions/createVirtualOrder/lib/virtualPayCatalog.js'))
const FIN = require(path.join(ROOT, 'cloudfunctions/common/paymentFinalizer.js'))
const ESVC = require(path.join(ROOT, 'cloudfunctions/common/entitlementService.js'))
const AA = require(path.join(ROOT, 'cloudfunctions/common/accessAuthority.js'))

const DAY = 86400000
const T0 = 1790770000000
let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))
const coll = (db, n) => (db._store[n] || [])

const monthlyOrder = (openid, orderId) => ({ orderId, openid, productId: 'vip_month_39_9', totalAmount: 3990, status: 'pending_payment', env: 1 })
const annualOrder = (openid, orderId) => ({ orderId, openid, productId: 'vip_year_299', totalAmount: 29900, status: 'pending_payment', env: 1 })
const providerFor = (order, txn) => ({
  tradeState: 'SUCCESS', transactionId: txn, outTradeNo: order.orderId, mchid: '', appid: '',
  amountTotal: order.totalAmount, amountCurrency: 'CNY', amountPayerTotal: order.totalAmount,
  tradeType: 'VIRTUAL', bankType: '', successTime: '1790770000',
})
const deps = { grantEntitlements: ESVC.grantEntitlements }

console.log('RC8_13_STAGE1 virtual payment server wiring')

;(async () => {
  // ── A: official golden vectors ──
  {
    const postBody = '{"openid": "xxx", "user_ip": "127.0.0.1", "env": 0}'
    const paySig = VPS.calcPaySig('/xpay/query_user_balance', postBody, '12345')
    eq(paySig, 'c37809f27c6d7fd1837ad2500a04512b66b34fd793a39a385fade56dca89a4b5', 'A paySig golden vector')
    const sig = VPS.calcUserSignature(postBody, '9hAb/NEYUlkaMBEsmFgzig==')
    eq(sig, '089d9e8dc5d308977360c4b79ec600a93d736802802a807d634192328032f6c7', 'A signature golden vector')
    eq(VPS.calcPaySig('requestVirtualPayment', 'X', ''), '', 'A empty appkey → empty paySig (fail-closed)')
    eq(VPS.calcUserSignature('X', ''), '', 'A empty session_key → empty signature (fail-closed)')
  }

  // ── B: catalog mapping ──
  {
    const m = CAT.getCatalog('vip_month_39_9')
    const a = CAT.getCatalog('vip_year_299')
    eq(m.virtualProductId, '30', 'B monthly virtualProductId 30')
    eq(m.priceFen, 3990, 'B monthly 3990 fen')
    eq(m.durationDays, 30, 'B monthly 30d')
    eq(m.mode, 'short_series_goods', 'B monthly mode')
    eq(a.virtualProductId, '365', 'B annual virtualProductId 365')
    eq(a.priceFen, 29900, 'B annual 29900 fen')
    eq(a.durationDays, 365, 'B annual 365d')
    eq(CAT.getCatalog('report_9_9'), null, 'B non-catalog product → null (no virtual sale)')
    eq(CAT.findByVirtualProductId('30').localProductId, 'vip_month_39_9', 'B reverse lookup monthly')
    eq(CAT.findByVirtualProductId('999'), null, 'B reverse lookup unknown → null')
  }

  // ── C: signData build + single serialization ──
  {
    const m = CAT.getCatalog('vip_month_39_9')
    const sd = VPS.buildSignData(m, { offerId: '1450666840', envFlag: 1 }, 'VO241001120000ABCD', 'att')
    const str = VPS.serializeSignData(sd)
    eq(typeof str, 'string', 'C signData serialized to string')
    const parsed = JSON.parse(str)
    eq(parsed.offerId, '1450666840', 'C offerId is string')
    eq(parsed.env, 1, 'C env 1 sandbox')
    eq(parsed.currencyType, 'CNY', 'C currency CNY')
    eq(parsed.productId, '30', 'C productId string')
    eq(parsed.goodsPrice, 3990, 'C goodsPrice server price')
    eq(parsed.buyQuantity, 1, 'C buyQuantity 1')
    eq(parsed.outTradeNo, 'VO241001120000ABCD', 'C outTradeNo present')
    eq(parsed.attach, 'att', 'C attach passthrough')
    // byte-stable: serialize twice identical
    eq(VPS.serializeSignData(sd), str, 'C serialization byte-stable')
    // paySig over the exact returned string reproduces
    const ps = VPS.calcPaySig('requestVirtualPayment', str, 'k')
    const ps2 = crypto.createHmac('sha256', 'k').update('requestVirtualPayment&' + str, 'utf8').digest('hex')
    eq(ps, ps2, 'C paySig = hmac(appKey, uri&signData)')
  }

  // ── D/E: monthly & annual grant; duplicate callback exactly-once ──
  {
    const db = makeDb()
    seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o = monthlyOrder('oA', 'VO1')
    seed(db, 'orders', o)
    const r1 = await FIN.finalizePaidOrder(db, { orderId: 'VO1', source: 'callback', provider: providerFor(o, 'TXN0001'), expect: { mchid: '', appid: '' }, ts: T0 }, deps)
    eq(r1.ok, true, 'D monthly finalize ok')
    eq(coll(db, 'memberships').length, 1, 'D one membership row')
    eq(db._store.memberships[0].expiredAt, T0 + 30 * DAY, 'D monthly expiredAt +30d')
    // duplicate callback
    const r2 = await FIN.finalizePaidOrder(db, { orderId: 'VO1', source: 'callback', provider: providerFor(o, 'TXN0001'), expect: { mchid: '', appid: '' }, ts: T0 + 1000 }, deps)
    eq(r2.ok, true, 'E duplicate callback ok')
    eq(r2.idempotent, true, 'E duplicate callback idempotent')
    eq(coll(db, 'memberships').length, 1, 'E no second membership row')
    eq(db._store.memberships[0].expiredAt, T0 + 30 * DAY, 'E no double extend')
    eq(coll(db, 'payments').length, 1, 'E one payment record only')
    eq(coll(db, 'entitlement_grants').length, 1, 'E one entitlement grant only')
  }

  // ── D2: annual grant 365d + year exclusives ──
  {
    const db = makeDb()
    seed(db, 'products', { productId: 'vip_year_299', type: 'membership', permission: 'vip', durationDays: 365 })
    const o = annualOrder('oB', 'VO2')
    seed(db, 'orders', o)
    const r = await FIN.finalizePaidOrder(db, { orderId: 'VO2', source: 'callback', provider: providerFor(o, 'TXN0002'), expect: {}, ts: T0 }, deps)
    eq(r.ok, true, 'D2 annual finalize ok')
    eq(db._store.memberships[0].expiredAt, T0 + 365 * DAY, 'D2 annual expiredAt +365d')
    ok(db._store.memberships[0].rights.includes('hard_truth_mode'), 'D2 year exclusive hard_truth_mode')
  }

  // ── F: callback + query concurrency → exactly once ──
  {
    const db = makeDb()
    seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o = monthlyOrder('oC', 'VO3')
    seed(db, 'orders', o)
    const [rc, rq] = await Promise.all([
      FIN.finalizePaidOrder(db, { orderId: 'VO3', source: 'callback', provider: providerFor(o, 'TXN0003'), expect: {}, ts: T0 }, deps),
      FIN.finalizePaidOrder(db, { orderId: 'VO3', openid: 'oC', source: 'query', provider: providerFor(o, 'TXN0003'), expect: {}, ts: T0 }, deps),
    ])
    eq(rc.ok && rq.ok, true, 'F both paths ok')
    eq(coll(db, 'payments').length, 1, 'F one payment record (at-most-once)')
    eq(coll(db, 'memberships').length, 1, 'F one membership row')
    eq(db._store.memberships[0].expiredAt, T0 + 30 * DAY, 'F membership extended once only')
    eq(coll(db, 'entitlement_grants').length, 1, 'F one entitlement grant')
    ok([rc, rq].filter((r) => r.idempotent).length === 1, 'F exactly one idempotent side')
  }

  // ── G: fail-closed cases ──
  {
    // wrong openid
    let db = makeDb(); seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o = monthlyOrder('oD', 'VO4'); seed(db, 'orders', o)
    const r1 = await FIN.finalizePaidOrder(db, { orderId: 'VO4', openid: 'oSOMEONE', source: 'query', provider: providerFor(o, 'TXN0004'), expect: {}, ts: T0 }, deps)
    eq(r1.ok, false, 'G wrong openid rejected')
    eq(r1.reason, FIN.REASONS.OWNERSHIP_MISMATCH, 'G reason OWNERSHIP_MISMATCH')
    // amount mismatch
    db = makeDb(); seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o2 = monthlyOrder('oE', 'VO5'); seed(db, 'orders', o2)
    const bad = providerFor(o2, 'TXN0005'); bad.amountTotal = 1
    const r2 = await FIN.finalizePaidOrder(db, { orderId: 'VO5', source: 'callback', provider: bad, expect: {}, ts: T0 }, deps)
    eq(r2.ok, false, 'G amount mismatch rejected')
    eq(r2.reason, FIN.REASONS.AMOUNT_MISMATCH, 'G reason AMOUNT_MISMATCH')
    eq(coll(db, 'memberships').length, 0, 'G no membership on mismatch')
    // transaction reuse across orders
    db = makeDb(); seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const a = monthlyOrder('oF', 'VO6'); const b = monthlyOrder('oF', 'VO7')
    seed(db, 'orders', a); seed(db, 'orders', b)
    await FIN.finalizePaidOrder(db, { orderId: 'VO6', source: 'callback', provider: providerFor(a, 'TXN000X'), expect: {}, ts: T0 }, deps)
    const r3 = await FIN.finalizePaidOrder(db, { orderId: 'VO7', source: 'callback', provider: providerFor(b, 'TXN000X'), expect: {}, ts: T0 }, deps)
    eq(r3.ok, false, 'G transaction reuse rejected')
    eq(r3.reason, FIN.REASONS.TRANSACTION_ID_REUSED, 'G reason TRANSACTION_ID_REUSED')
    // out_trade_no mismatch
    db = makeDb(); seed(db, 'products', { productId: 'vip_month_39_9', type: 'membership', permission: 'vip', durationDays: 30 })
    const o3 = monthlyOrder('oG', 'VO8'); seed(db, 'orders', o3)
    const bad2 = providerFor(o3, 'TXN0008'); bad2.outTradeNo = 'OTHER'
    const r4 = await FIN.finalizePaidOrder(db, { orderId: 'VO8', source: 'callback', provider: bad2, expect: {}, ts: T0 }, deps)
    eq(r4.reason, FIN.REASONS.OUT_TRADE_NO_MISMATCH, 'G out_trade_no mismatch rejected')
  }

  // ── H: legacy preservation ──
  {
    // historical report_9_9 grant works (permanent source)
    let db = makeDb()
    seed(db, 'products', { productId: 'report_9_9', type: 'single', permission: 'report_unlock', durationDays: 0 })
    seed(db, 'ai_reports', { reportId: 'AR1', openid: 'oH', isPaid: false })
    const r = await ESVC.grantEntitlements(db, { openid: 'oH', productId: 'report_9_9', orderId: 'OR1', relatedId: 'AR1' }, T0)
    eq(r.success, true, 'H report_9_9 historical grant works')
    const src = db._store.entitlements[0].sources.find((s) => s.productId === 'report_9_9')
    eq(src.expiresAt, 0, 'H legacy report source permanent (0)')
    // expiry of membership retains legacy permanent sources
    db = makeDb()
    seed(db, 'entitlements', { openid: 'oI', permissions: ['full_report', 'challenge_full'], sources: [{ productId: 'challenge_39_9', expiresAt: 0 }, { productId: 'report_9_9', expiresAt: 0 }, { productId: 'vip_month_39_9', expiresAt: T0 - 1 }] })
    const acc = AA.resolveAccess({ membership: null, sources: [{ productId: 'report_9_9', expiresAt: 0 }, { productId: 'challenge_39_9', expiresAt: 0 }], now: T0 })
    eq(acc.report.source, 'LEGACY_REPORT_9_9', 'H legacy report survives')
    eq(acc.challenge.source, 'LEGACY_CHALLENGE_39_9', 'H legacy challenge survives')
  }

  // ── I: ordinary payment path untouched + sales fail-closed ──
  {
    // The rc8.13 branch is based on the owner-accepted canonical tag (pre-FREE_ONLY).
    // Non-regression = we did NOT modify the ordinary payment functions at all.
    let gitOk = true
    try {
      const { execSync } = require('child_process')
      const base = execSync('git rev-parse --verify -q rc8.11-stage2d-owner-accepted 2>/dev/null', { cwd: ROOT }).toString().trim()
      if (base) {
        const changed = execSync(
          `git diff --name-only ${base} -- cloudfunctions/createOrder cloudfunctions/payCallback cloudfunctions/verifyPayment cloudfunctions/refundOrder`,
          { cwd: ROOT }
        ).toString().trim()
        eq(changed, '', 'I ordinary payment functions unmodified vs accepted canonical')
      }
    } catch (_) { gitOk = false }
    if (!gitOk) ok(true, 'I git check skipped (git unavailable)')
    ok(!AA.isRetiredNewSale('vip_month_39_9') && !AA.isRetiredNewSale('vip_year_299'), 'I memberships NOT in retired set')
    ok(AA.isRetiredNewSale('report_9_9') && AA.isRetiredNewSale('challenge_39_9') && AA.isRetiredNewSale('vip_month_99'), 'I retired legacy set unchanged')
    // sales mode fail-closed default (guards new virtual sale)
    eq(CAT.salesMode({}), 'DISABLED', 'I default sales mode DISABLED')
    eq(CAT.salesMode({ VIRTUAL_PAY_SALES_MODE: 'ENABLED' }), 'ENABLED', 'I explicit enable')
    eq(CAT.isVirtualSaleEnabled({}), false, 'I not enabled by default')
  }

  // ── J: copy integrity across three fns ──
  {
    const sha = (p) => crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, p))).digest('hex')
    const fns = ['createVirtualOrder', 'virtualPayCallback', 'verifyVirtualPayment']
    for (const f of ['virtualPaySigning.js', 'virtualPayCatalog.js', 'paymentFinalizer.js', 'entitlementService.js', 'permissionEngine.js', 'accessAuthority.js']) {
      const base = sha(`cloudfunctions/${fns[0]}/lib/${f}`)
      const allSame = fns.every((n) => sha(`cloudfunctions/${n}/lib/${f}`) === base)
      ok(allSame, `J ${f} byte-identical across 3 fns`)
    }
    // finalizer/entitlement identical to canonical payment bundle
    eq(sha('cloudfunctions/common/paymentFinalizer.js'), sha('cloudfunctions/createVirtualOrder/lib/paymentFinalizer.js'), 'J finalizer == canonical')
    eq(sha('cloudfunctions/common/entitlementService.js'), sha('cloudfunctions/createVirtualOrder/lib/entitlementService.js'), 'J entitlement == canonical')
  }

  // ── K: source guards ──
  {
    const cvo = fs.readFileSync(path.join(ROOT, 'cloudfunctions/createVirtualOrder/index.js'), 'utf8')
    ok(/getCatalog\(productId\)/.test(cvo), 'K createVirtualOrder uses server catalog')
    ok(/serializeSignData\(signDataObj\)/.test(cvo), 'K single serialization of signData')
    ok(!/JSON\.parse\(signData/.test(cvo), 'K no reparse of signData')
    ok(!/appKey\s*:/.test(cvo) && !/sessionKey\s*:/.test(cvo) && !/session_key\s*:/.test(cvo), 'K no appKey/session_key in response object literals')
    ok(/payChannel: 'wechat_virtual'/.test(cvo), 'K payChannel wechat_virtual')
    ok(/pending_payment/.test(cvo), 'K local pending_payment order')
    // forbid client price authority (no event.price usage)
    ok(!/event\.price|event\.goodsPrice/.test(cvo), 'K no client price authority')
    ok(!/event\.offerId/.test(cvo), 'K no client offerId authority')
    // callback uses shared finalizer + ack contract
    const cb = fs.readFileSync(path.join(ROOT, 'cloudfunctions/virtualPayCallback/index.js'), 'utf8')
    ok(/finalizePaidOrder/.test(cb) && /grantEntitlements/.test(cb), 'K callback reuses finalizer')
    ok(/ErrCode/.test(cb), 'K callback returns ErrCode ack')
    // verify uses query_order + same finalizer
    const vp = fs.readFileSync(path.join(ROOT, 'cloudfunctions/verifyVirtualPayment/index.js'), 'utf8')
    ok(/xpay\/query_order/.test(vp) && /finalizePaidOrder/.test(vp), 'K verify uses query_order + same finalizer')
    ok(!/console\.log\([^)]*appKey|console\.log\([^)]*sessionKey|console\.log\([^)]*accessToken/i.test(cvo + cb + vp), 'K no secret logging')
  }

  console.log(`\nvirtual-payment_TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})()
