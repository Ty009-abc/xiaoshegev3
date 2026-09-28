#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/payment-finalizer.test.js
 *
 * PAYMENT_STAGE3_PAID_AUTHORITY_EXACTLY_ONCE — deterministic regression set.
 *
 *  A  correct SUCCESS → paid once + payment once + entitlement once
 *  B  duplicate verifyPayment → no 2nd payment row, no 2nd entitlement, idempotent
 *  C  duplicate callback → idempotent
 *  D  verify + callback concurrent race → exactly one each
 *  E  wrong amount → rejected, no paid, no entitlement
 *  F  wrong mchid → rejected
 *  G  wrong appid → rejected
 *  H  mismatched out_trade_no → rejected
 *  I  reused transaction_id on different order → rejected (+ audit signal)
 *  J  unverified/tampered provider evidence (UNVERIFIED) → rejected
 *  K  callback decrypt/signature failure → rejected (shared authority)
 *  L  already-paid order → idempotent success (no dup)
 *  M  closed/failed order → NOT reopened by client claim
 *  N  unique indexes declared/copied: finalizer convergence + entropy_service sync
 *  O  provider-evidence unit validation
 *
 * Node built-ins only. No network, no real payment, no real DB.
 */

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..', '..')
const FINALIZER = require(path.join(ROOT, 'cloudfunctions', 'verifyPayment', 'lib', 'paymentFinalizer.js'))
const AUTH = require(path.join(ROOT, 'cloudfunctions', 'payCallback', 'lib', 'paymentAuthority.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE3 finalizer / exactly-once')

// ── fake DB with unique-index enforcement + async interleave ────────────────
const UNIQUES = { orders: ['orderId'], payments: ['transactionId'], entitlement_grants: ['orderId'] }
function makeDb () {
  const store = { orders: [], payments: [], entitlement_grants: [], payment_logs: [], entitlements: [] }
  const tick = () => new Promise((r) => setTimeout(r, 0))
  const command = {
    in: (arr) => ({ __op: 'in', $in: arr }),
    gt: (n) => ({ __op: 'gt', $gt: n }),
  }
  const match = (doc, q) => Object.keys(q).every((k) => {
    const c = q[k]
    if (c && c.__op === 'in') return c.$in.includes(doc[k])
    if (c && c.__op === 'gt') return doc[k] > c.$gt
    return doc[k] === c
  })
  function collection (name) {
    return {
      where (q) {
        return {
          limit () { return this },
          async get () { await tick(); return { data: store[name].filter((d) => match(d, q)).map((d) => ({ ...d })) } },
          async update ({ data }) { await tick(); const rows = store[name].filter((d) => match(d, q)); rows.forEach((d) => Object.assign(d, data)); return { stats: { updated: rows.length } } },
        }
      },
      async add ({ data }) {
        await tick()
        for (const key of (UNIQUES[name] || [])) {
          if (store[name].some((d) => d[key] === data[key])) {
            const e = new Error('E11000 duplicate key error'); e.errCode = -502001; throw e
          }
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

const MCHID = '1747400090'
const APPID = 'wxTESTAPPID0000000'
function seedOrder (db, over = {}) {
  const o = Object.assign({
    orderId: 'XSG_T1', openid: 'oUser', productId: 'report_9_9', totalAmount: 990,
    status: 'created', createdAt: 1, transactionId: '', paidAt: 0,
  }, over)
  const c = db.collection('orders')
  const raw = Object.assign({ _id: 'orders_' + (db._store.orders.length + 1) }, o)
  db._store.orders.push(raw)
  return raw
}
function provider (over = {}) {
  return Object.assign({
    tradeState: 'SUCCESS', transactionId: '4200001111222233334444', outTradeNo: 'XSG_T1',
    mchid: MCHID, appid: APPID, amountTotal: 990, amountCurrency: 'CNY', amountPayerTotal: 990,
    tradeType: 'JSAPI', bankType: 'ICBC', successTime: '2026-09-28T12:00:00+08:00',
  }, over)
}
function deps (grantCalls) {
  return {
    grantEntitlements: async (db, order, ts) => { grantCalls.push(order.orderId); return { success: true, granted: ['full_report'], summary: 'ok' } },
    isMockTransactionId: (t) => typeof t === 'string' && t.indexOf('MOCK_TXN_') === 0,
  }
}
const EXPECT = { mchid: MCHID, appid: APPID }

;(async () => {
  // ── A: happy path ──
  {
    const db = makeDb(); seedOrder(db); const g = []
    const r = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_T1', openid: 'oUser', source: 'query', provider: provider(), expect: EXPECT, ts: 100 }, deps(g))
    ok(r.ok === true && r.idempotent === false, 'A1: finalize ok')
    eq(db._store.orders[0].status, 'paid', 'A2: order paid')
    eq(db._store.payments.length, 1, 'A3: exactly one payment row')
    eq(g.length, 1, 'A4: entitlement granted once')
    eq(db._store.entitlement_grants.length, 1, 'A5: grant marker once')
    eq(db._store.payments[0].authoritativeAmount, 990, 'A6: authoritative amount stored')
  }

  // ── B: duplicate verifyPayment (same txn) ──
  {
    const db = makeDb(); seedOrder(db); const g = []
    const a = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_T1', openid: 'oUser', source: 'query', provider: provider(), expect: EXPECT, ts: 100 }, deps(g))
    const b = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_T1', openid: 'oUser', source: 'query', provider: provider(), expect: EXPECT, ts: 120 }, deps(g))
    ok(a.ok && b.ok, 'B1: both succeed')
    eq(db._store.payments.length, 1, 'B2: no second payment row')
    eq(g.length, 1, 'B3: no second entitlement')
    ok(b.idempotent === true, 'B4: second is idempotent')
  }

  // ── C: duplicate callback ──
  {
    const db = makeDb(); seedOrder(db); const g = []
    const a = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_T1', source: 'callback', provider: provider(), expect: EXPECT, ts: 100 }, deps(g))
    const b = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_T1', source: 'callback', provider: provider(), expect: EXPECT, ts: 110 }, deps(g))
    ok(a.ok && b.ok && b.idempotent, 'C1: duplicate callback idempotent')
    eq(db._store.payments.length, 1, 'C2: one payment row')
    eq(g.length, 1, 'C3: one entitlement')
  }

  // ── D: race verify + callback ──
  {
    const db = makeDb(); seedOrder(db); const g = []
    const d = deps(g)
    const [a, b] = await Promise.all([
      FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_T1', openid: 'oUser', source: 'query', provider: provider(), expect: EXPECT, ts: 100 }, d),
      FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_T1', source: 'callback', provider: provider(), expect: EXPECT, ts: 100 }, d),
    ])
    ok(a.ok && b.ok, 'D1: both resolve ok (one real, one idempotent)')
    eq(db._store.orders.filter((o) => o.status === 'paid').length, 1, 'D2: exactly one paid transition')
    eq(db._store.payments.length, 1, 'D3: exactly one payment row')
    eq(g.length, 1, 'D4: exactly one entitlement grant')
    eq(db._store.entitlement_grants.length, 1, 'D5: exactly one grant marker')
  }

  // ── E: wrong amount ──
  {
    const db = makeDb(); seedOrder(db); const g = []
    const r = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_T1', openid: 'oUser', source: 'query', provider: provider({ amountTotal: 1 }), expect: EXPECT, ts: 100 }, deps(g))
    ok(r.ok === false && r.reason === FINALIZER.REASONS.AMOUNT_MISMATCH, 'E1: wrong amount rejected')
    eq(db._store.orders[0].status, 'created', 'E2: not paid')
    eq(db._store.payments.length, 0, 'E3: no payment row')
    eq(g.length, 0, 'E4: no entitlement')
  }

  // ── F: wrong mchid ──
  {
    const db = makeDb(); seedOrder(db); const g = []
    const r = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_T1', source: 'callback', provider: provider({ mchid: '999' }), expect: EXPECT, ts: 100 }, deps(g))
    ok(r.ok === false && r.reason === FINALIZER.REASONS.MCHID_MISMATCH, 'F1: wrong mchid rejected')
    eq(db._store.orders[0].status, 'created', 'F2: not paid')
  }

  // ── G: wrong appid ──
  {
    const db = makeDb(); seedOrder(db); const g = []
    const r = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_T1', source: 'callback', provider: provider({ appid: 'wxOTHER' }), expect: EXPECT, ts: 100 }, deps(g))
    ok(r.ok === false && r.reason === FINALIZER.REASONS.APPID_MISMATCH, 'G1: wrong appid rejected')
  }

  // ── H: mismatched out_trade_no ──
  {
    const db = makeDb(); seedOrder(db); const g = []
    const r = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_T1', source: 'callback', provider: provider({ outTradeNo: 'XSG_OTHER' }), expect: EXPECT, ts: 100 }, deps(g))
    ok(r.ok === false && r.reason === FINALIZER.REASONS.OUT_TRADE_NO_MISMATCH, 'H1: out_trade_no mismatch rejected')
  }

  // ── I: reused transaction_id on a different order ──
  {
    const db = makeDb(); seedOrder(db, { orderId: 'XSG_A' }); seedOrder(db, { orderId: 'XSG_B' }); const g = []
    const d = deps(g)
    const a = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_A', source: 'query', provider: provider({ outTradeNo: 'XSG_A' }), expect: EXPECT, ts: 100 }, d)
    const b = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_B', source: 'callback', provider: provider({ outTradeNo: 'XSG_B' }), expect: EXPECT, ts: 110 }, d)
    ok(a.ok === true, 'I1: first order settles')
    ok(b.ok === false && b.reason === FINALIZER.REASONS.TRANSACTION_ID_REUSED, 'I2: tx reuse on other order rejected')
    eq(db._store.orders.find((o) => o.orderId === 'XSG_B').status, 'created', 'I3: XSG_B not paid')
    ok(db._store.payment_logs.some((l) => l.action === 'transaction_id_reused'), 'I4: security audit signal written')
  }

  // ── J: unverified / tampered provider evidence ──
  {
    const db = makeDb(); seedOrder(db); const g = []
    const r = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_T1', openid: 'oUser', source: 'query', provider: provider({ tradeState: 'UNVERIFIED' }), expect: EXPECT, ts: 100 }, deps(g))
    ok(r.ok === false && r.reason === FINALIZER.REASONS.TRADE_STATE_NOT_SUCCESS, 'J1: UNVERIFIED evidence rejected')
    eq(g.length, 0, 'J2: no entitlement')
  }

  // ── K: callback decrypt / signature failure (shared authority) ──
  {
    const wx = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const keyId = 'PUB_KEY_ID_TEST_K'
    const env = { WXPAY_PUBLIC_KEY: wx.publicKey.export({ type: 'spki', format: 'pem' }).toString(), WXPAY_PUBLIC_KEY_ID: keyId }
    const body = JSON.stringify({ resource_type: 'encrypt-resource' })
    const ts = Math.floor(Date.now() / 1000).toString(), nonce = 'noncekkkkkkkkkk'
    const sig = crypto.createSign('RSA-SHA256').update(ts + '\n' + nonce + '\n' + body + '\n').sign(wx.privateKey, 'base64')
    // tampered body → verify FAIL
    const vBad = AUTH.verifyResponseSignature({ 'Wechatpay-Timestamp': ts, 'Wechatpay-Nonce': nonce, 'Wechatpay-Signature': sig, 'Wechatpay-Serial': keyId }, body + 'x', env)
    ok(vBad.valid === false, 'K1: tampered callback body → signature FAIL')
    // wrong key id → FAIL
    const vWrong = AUTH.verifyResponseSignature({ 'Wechatpay-Timestamp': ts, 'Wechatpay-Nonce': nonce, 'Wechatpay-Signature': sig, 'Wechatpay-Serial': 'PUB_KEY_ID_OTHER' }, body, env)
    ok(vWrong.valid === false, 'K2: wrong public-key-id → FAIL')
    // decrypt with wrong apiV3 key → null
    const apiV3 = crypto.randomBytes(16).toString('hex')
    const cn = 'abcdefghijkl', aad = 'transaction'
    const cip = crypto.createCipheriv('aes-256-gcm', Buffer.from(apiV3, 'utf8'), Buffer.from(cn, 'utf8')); cip.setAAD(Buffer.from(aad, 'utf8'))
    const enc = Buffer.concat([cip.update('{"out_trade_no":"XSG_T1"}', 'utf8'), cip.final()]); const tag = cip.getAuthTag()
    const res = { algorithm: 'AEAD_AES_256_GCM', ciphertext: Buffer.concat([enc, tag]).toString('base64'), nonce: cn, associated_data: aad }
    ok(AUTH.decryptResource(res, crypto.randomBytes(16).toString('hex')) === null, 'K3: wrong apiV3 key → decrypt FAIL')
    ok(AUTH.decryptResource(res, apiV3).out_trade_no === 'XSG_T1', 'K4: correct apiV3 key → decrypt PASS')
  }

  // ── L: already-paid order (fully settled) → idempotent, no dup ──
  {
    const db = makeDb()
    seedOrder(db, { orderId: 'XSG_P', status: 'paid', transactionId: '4200009999888877776666', paidAt: 50 })
    // pre-existing authoritative payment row + grant marker (normal settled state)
    db._store.payments.push({ _id: 'pay_seed', orderId: 'XSG_P', transactionId: '4200009999888877776666' })
    db._store.entitlement_grants.push({ _id: 'g_seed', orderId: 'XSG_P' })
    const g = []
    const r = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_P', openid: 'oUser', source: 'query', provider: provider({ transactionId: '4200009999888877776666', outTradeNo: 'XSG_P' }), expect: EXPECT, ts: 200 }, deps(g))
    ok(r.ok === true && r.idempotent === true, 'L1: already-paid idempotent success')
    eq(db._store.payments.length, 1, 'L2: no duplicate payment row added')
    eq(db._store.entitlement_grants.length, 1, 'L3: no duplicate grant marker')
    eq(g.length, 0, 'L4: entitlement NOT granted again')
  }

  // ── L2: crash recovery — order paid but payment row + grant missing → self-heal ──
  {
    const db = makeDb()
    seedOrder(db, { orderId: 'XSG_PR', status: 'paid', transactionId: '4200007777666655554444', paidAt: 60 }); const g = []
    const r = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_PR', openid: 'oUser', source: 'query', provider: provider({ transactionId: '4200007777666655554444', outTradeNo: 'XSG_PR' }), expect: EXPECT, ts: 210 }, deps(g))
    ok(r.ok === true, 'L2a: paid-with-missing-artifacts self-heals (ok)')
    eq(db._store.payments.length, 1, 'L2b: payment row restored')
    eq(g.length, 1, 'L2c: entitlement restored once')
    // 再次重入 → 完全幂等，无新增
    const r2 = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_PR', openid: 'oUser', source: 'query', provider: provider({ transactionId: '4200007777666655554444', outTradeNo: 'XSG_PR' }), expect: EXPECT, ts: 220 }, deps(g))
    ok(r2.ok === true && r2.idempotent === true, 'L2d: re-entry fully idempotent')
    eq(db._store.payments.length, 1, 'L2e: still one payment row')
    eq(g.length, 1, 'L2f: still one entitlement')
  }

  // ── M: closed order not reopened ──
  {
    const db = makeDb(); seedOrder(db, { orderId: 'XSG_C', status: 'closed' }); const g = []
    const r = await FINALIZER.finalizePaidOrder(db, { orderId: 'XSG_C', openid: 'oUser', source: 'query', provider: provider({ outTradeNo: 'XSG_C' }), expect: EXPECT, ts: 100 }, deps(g))
    ok(r.ok === false && r.reason === FINALIZER.REASONS.ORDER_STATUS_NOT_FINALIZABLE, 'M1: closed order not reopened')
    eq(db._store.orders[0].status, 'closed', 'M2: still closed')
    eq(g.length, 0, 'M3: no entitlement')
  }

  // ── N: convergence + copy integrity ──
  {
    const vp = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'verifyPayment', 'index.js'), 'utf8')
    const pc = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'payCallback', 'index.js'), 'utf8')
    ok(/require\('\.\/lib\/paymentFinalizer\.js'\)/.test(vp) && /finalizePaidOrder/.test(vp), 'N1: verifyPayment uses shared finalizer')
    ok(/require\('\.\/lib\/paymentFinalizer\.js'\)/.test(pc) && /finalizePaidOrder/.test(pc), 'N2: payCallback uses shared finalizer')
    const a = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'common', 'paymentFinalizer.js'))).digest('hex')
    const b = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'verifyPayment', 'lib', 'paymentFinalizer.js'))).digest('hex')
    const c = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'payCallback', 'lib', 'paymentFinalizer.js'))).digest('hex')
    ok(a === b && b === c, 'N3: finalizer copies byte-identical')
    const e1 = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'verifyPayment', 'lib', 'entitlementService.js'))).digest('hex')
    const e2 = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'payCallback', 'lib', 'entitlementService.js'))).digest('hex')
    ok(e1 === e2, 'N4: entitlementService copies in sync (challenge_unlock unified)')
    // no duplicated grant logic left in the callback
    ok(!/grantEntitlements\(db, order, ts\)/.test(pc), 'N5: callback no longer grants inline')
  }

  // ── O: provider-evidence unit validation ──
  {
    const order = { orderId: 'XSG_U', openid: 'o', totalAmount: 990 }
    const good = FINALIZER.validateProviderEvidence(order, provider({ outTradeNo: 'XSG_U' }), EXPECT)
    ok(good.valid === true, 'O1: valid evidence passes')
    ok(FINALIZER.validateProviderEvidence(order, { tradeState: 'SUCCESS', transactionId: '', amountTotal: 990, mchid: MCHID }, EXPECT).issues.includes(FINALIZER.REASONS.TRANSACTION_ID_MISSING), 'O2: missing txn flagged')
    ok(FINALIZER.validateProviderEvidence(order, provider({ amountTotal: null, outTradeNo: 'XSG_U' }), EXPECT).issues.includes(FINALIZER.REASONS.AMOUNT_MISMATCH), 'O3: null amount flagged')
    ok(FINALIZER.validateProviderEvidence(order, provider({ amountCurrency: 'USD', outTradeNo: 'XSG_U' }), EXPECT).issues.includes(FINALIZER.REASONS.CURRENCY_MISMATCH), 'O4: wrong currency flagged')
    ok(FINALIZER.validateProviderEvidence(order, provider({ transactionId: 'x', outTradeNo: 'XSG_U' }), EXPECT).issues.includes(FINALIZER.REASONS.TRANSACTION_ID_INVALID), 'O5: bad txn shape flagged')
  }

  console.log(`PAYMENT_FINALIZER_TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})()
