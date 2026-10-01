#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/payment-log-resilience.test.js
 *
 * PAYMENT_STAGE4D_PAYMENT_LOG_RESILIENCE — deterministic regression set.
 *
 *  A  prepay success + payment_logs write OK        → pending_payment + paymentParams
 *  B  prepay success + payment_logs collection MISSING → pending_payment + paymentParams + safe warning
 *  C  prepay success + payment_logs.add THROWS      → same successful business result
 *  D  prepay FAILS + payment_logs missing → failure NOT converted to success
 *  E  verifyPayment authoritative validation failure → no paid, regardless of log outcome
 *  F  payCallback invalid signature → no paid, regardless of log outcome
 *  G  finalizePaidOrder audit(_audit) failure → payment authority invariants unchanged
 *  H  error-code regression: ORDER_CLOSED/REFUNDED/EXPIRED/FORBIDDEN resolve (no UNKNOWN degrade)
 *
 * Uses the REAL cloudfunction handlers (createOrder/verifyPayment/payCallback) with a
 * stubbed wx-server-sdk + stubbed outbound network only. No network, no real payment, no real DB.
 */

const path = require('path')
const Module = require('module')

const ROOT = path.resolve(__dirname, '..', '..')
const CO = path.join(ROOT, 'cloudfunctions', 'createOrder')
const VP = path.join(ROOT, 'cloudfunctions', 'verifyPayment')
const PC = path.join(ROOT, 'cloudfunctions', 'payCallback')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE4D payment-log resilience')

// ── mock DB (unique indexes + injectable collection failure) ────────────────
const UNIQUES = { orders: ['orderId'], payments: ['transactionId'], entitlement_grants: ['orderId'] }
const CTRL = {
  failOn: {},          // e.g. { payment_logs: 'MISSING' | 'THROW' }
  prepay: null,        // jsapiOrder result
  query: null,         // queryOrder result
  openid: 'oUser',
  moduleStubs: {},
}

function makeErr (kind) {
  if (kind === 'MISSING') {
    const e = new Error('collection.add:fail -502005 database collection not exists. [ResourceNotFound] Db or Table not exist: payment_logs')
    e.errCode = -502005; return e
  }
  const e = new Error('simulated add failure'); e.errCode = -1; return e
}

function makeDb () {
  const store = { orders: [], payments: [], entitlement_grants: [], payment_logs: [], entitlements: [], products: [], memberships: [], users: [], ai_reports: [], challenge_records: [], evolution_logs: [], funnel_events: [] }
  const tick = () => new Promise((r) => setTimeout(r, 0))
  const command = { in: (a) => ({ __op: 'in', $in: a }), gt: (n) => ({ __op: 'gt', $gt: n }), gte: (n) => ({ __op: 'gte', $gte: n }), lte: (n) => ({ __op: 'lte', $lte: n }) }
  const match = (doc, q) => Object.keys(q).every((k) => {
    const c = q[k]
    if (c && c.__op === 'in') return c.$in.includes(doc[k])
    if (c && c.__op === 'gt') return doc[k] > c.$gt
    if (c && c.__op === 'gte') return doc[k] >= c.$gte
    if (c && c.__op === 'lte') return doc[k] <= c.$lte
    return doc[k] === c
  })
  function collection (name) {
    const api = {
      where (q) {
        const self = {
          limit () { return self },
          orderBy () { return self },
          async get () { await tick(); return { data: store[name].filter((d) => match(d, q)).map((d) => ({ ...d })) } },
          async update ({ data }) { await tick(); const rows = store[name].filter((d) => match(d, q)); rows.forEach((d) => Object.assign(d, data)); return { stats: { updated: rows.length } } },
        }
        return self
      },
      async add ({ data }) {
        await tick()
        if (CTRL.failOn[name]) throw makeErr(CTRL.failOn[name])
        for (const key of (UNIQUES[name] || [])) {
          if (store[name].some((d) => d[key] === data[key])) { const e = new Error('E11000 duplicate key error'); e.errCode = -502001; throw e }
        }
        const doc = Object.assign({ _id: name + '_' + (store[name].length + 1) }, data)
        store[name].push(doc)
        return { _id: doc._id }
      },
      doc (id) {
        return { async update ({ data }) { await tick(); const d = store[name].find((x) => x._id === id); if (d) Object.assign(d, data); return { stats: { updated: d ? 1 : 0 } } } }
      },
      async count () { await tick(); return { total: store[name].length } },
    }
    return api
  }
  return { collection, command, _store: store }
}

const DB = makeDb()

// ── stubbed wx-server-sdk + outbound payment modules (network) ──────────────
const WX_STUB = {
  DYNAMIC_CURRENT_ENV: 'test-env',
  init () {},
  database () { return DB },
  getWXContext () { return { OPENID: CTRL.openid } },
}
CTRL.moduleStubs[path.join(CO, 'lib', 'payment.js')] = { jsapiOrder: async () => CTRL.prepay, selfCheckSigning: () => ({ ok: true }) }
CTRL.moduleStubs[path.join(VP, 'lib', 'payment.js')] = { queryOrder: async () => CTRL.query, selfCheckSigning: () => ({ ok: true }) }

const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return WX_STUB
  try {
    const resolved = Module._resolveFilename(request, parent, isMain)
    if (CTRL.moduleStubs[resolved]) return CTRL.moduleStubs[resolved]
  } catch (_) {}
  return origLoad.apply(this, arguments)
}

// load real handlers AFTER stubs are installed
// RC8_12: this suite exercises the historical order/verify/callback pipeline, which
// remains supported — set SALE_ENABLED so FREE_ONLY does not block order creation.
process.env.RELEASE_SALES_MODE = 'SALE_ENABLED'
const createOrder = require(path.join(CO, 'index.js'))
const verifyPayment = require(path.join(VP, 'index.js'))
const payCallback = require(path.join(PC, 'index.js'))
const FINALIZER = require(path.join(VP, 'lib', 'paymentFinalizer.js'))
const CODES = require(path.join(CO, 'lib', 'errorCodes.js')).CODES

function resetStore (extra) {
  for (const k of Object.keys(DB._store)) DB._store[k].length = 0
  CTRL.failOn = {}
  CTRL.openid = 'oUser'
  // RC8_11: report_9_9 is retired from new sales → use the saleable member SKU.
  DB._store.products.push({ _id: 'p1', productId: 'vip_month_39_9', name: '认知会员月卡', price: 3990, status: 'active', type: 'membership', durationDays: 30 })
  if (extra) extra()
}
function seedOrder (over) {
  const o = Object.assign({ orderId: 'XSG_T1', openid: 'oUser', productId: 'report_9_9', totalAmount: 990, status: 'created', createdAt: Date.now(), transactionId: '', paidAt: 0 }, over)
  DB._store.orders.push(Object.assign({ _id: 'orders_' + (DB._store.orders.length + 1) }, o))
}
const PREPAY_OK = { success: true, prepayId: 'wx28173500000000000000000000', paymentParams: { timeStamp: '1759000000', nonceStr: 'abc123', package: 'prepay_id=wx28173500000000000000000000', signType: 'RSA', paySign: 'SIG' } }

;(async () => {
  // ── A: prepay success + log OK ──
  {
    resetStore(); CTRL.prepay = PREPAY_OK
    const r = await createOrder.main({ productId: 'vip_month_39_9' })
    eq(r.code, 0, 'A1: success')
    eq(DB._store.orders[0].status, 'pending_payment', 'A2: order pending_payment')
    ok(!!(r.data && r.data.paymentParams && r.data.paymentParams.package), 'A3: paymentParams returned')
    eq(DB._store.payment_logs.length, 1, 'A4: one audit log row')
  }

  // ── B: prepay success + payment_logs collection MISSING ──
  {
    resetStore(); CTRL.prepay = PREPAY_OK; CTRL.failOn = { payment_logs: 'MISSING' }
    const r = await createOrder.main({ productId: 'vip_month_39_9' })
    eq(r.code, 0, 'B1: still success (log missing must not break prepay)')
    eq(DB._store.orders[0].status, 'pending_payment', 'B2: order still pending_payment')
    ok(!!(r.data && r.data.paymentParams && r.data.paymentParams.package), 'B3: paymentParams still returned')
    eq(DB._store.payment_logs.length, 0, 'B4: no log row (as expected)')
  }

  // ── C: prepay success + payment_logs.add THROWS ──
  {
    resetStore(); CTRL.prepay = PREPAY_OK; CTRL.failOn = { payment_logs: 'THROW' }
    const r = await createOrder.main({ productId: 'vip_month_39_9' })
    eq(r.code, 0, 'C1: still success (generic throw must not break prepay)')
    eq(DB._store.orders[0].status, 'pending_payment', 'C2: order still pending_payment')
    ok(!!(r.data && r.data.paymentParams && r.data.paymentParams.package), 'C3: paymentParams still returned')
  }

  // ── D: prepay FAILS + log missing → not converted to success ──
  {
    resetStore(); CTRL.prepay = { success: false, error: 'WECHAT_DOWNSTREAM_ERROR' }; CTRL.failOn = { payment_logs: 'MISSING' }
    const r = await createOrder.main({ productId: 'vip_month_39_9' })
    eq(r.code, CODES.PAYMENT_ERROR, 'D1: failure preserved as PAYMENT_ERROR')
    eq(DB._store.orders[0].status, 'failed', 'D2: order marked failed (not pending_payment, not paid)')
    ok(!(r.data && r.data.paymentParams), 'D3: no paymentParams on failure')
  }

  // ── E: verifyPayment authoritative failure → no paid, regardless of log ──
  {
    resetStore(); seedOrder({ orderId: 'XSG_T1' })
    CTRL.failOn = { payment_logs: 'MISSING' }
    // authenticated response but WRONG amount → finalizer must reject
    CTRL.query = { success: true, tradeState: 'SUCCESS', transactionId: '4200_WRONG_AMT', outTradeNo: 'XSG_T1', mchid: '1747400090', appid: process.env.WXPAY_APPID || 'wxd441fbf3b9f10aa3', amountTotal: 1, amountCurrency: 'CNY', amountPayerTotal: 1, tradeType: 'JSAPI', bankType: '' }
    // make expectation mchid/appid match env-ish
    process.env.WXPAY_MCHID = '1747400090'; process.env.WXPAY_APPID = process.env.WXPAY_APPID || 'wxd441fbf3b9f10aa3'
    const r = await verifyPayment.main({ orderId: 'XSG_T1' })
    ok(r.code !== 0, 'E1: verify rejects (non-zero)')
    eq(DB._store.orders[0].status, 'created', 'E2: order NOT paid')
    eq(DB._store.payments.length, 0, 'E3: no payment row')
    eq(DB._store.entitlement_grants.length, 0, 'E4: no entitlement grant')
  }

  // ── F: payCallback invalid signature → no paid, regardless of log ──
  {
    resetStore(); seedOrder({ orderId: 'XSG_T1' })
    CTRL.failOn = { payment_logs: 'MISSING', evolution_logs: 'THROW' }
    const r = await payCallback.main({ body: '{}', headers: {} })   // missing Wechatpay-* headers
    ok(r && (r.statusCode === 401 || r.statusCode === 400), 'F1: callback rejected (statusCode=' + (r && r.statusCode) + ')')
    eq(DB._store.orders[0].status, 'created', 'F2: order NOT paid')
    eq(DB._store.payments.length, 0, 'F3: no payment row')
  }

  // ── G: finalizePaidOrder _audit failure → authority invariants unchanged ──
  {
    resetStore(); seedOrder({ orderId: 'XSG_T1' })
    CTRL.failOn = { payment_logs: 'MISSING' }
    const g = []
    const r = await FINALIZER.finalizePaidOrder(DB, {
      orderId: 'XSG_T1', source: 'callback',
      provider: { tradeState: 'SUCCESS', transactionId: '4200_OK_TXN', outTradeNo: 'XSG_T1', mchid: '1747400090', appid: 'wxd441fbf3b9f10aa3', amountTotal: 990, amountCurrency: 'CNY', amountPayerTotal: 990, tradeType: 'JSAPI', bankType: 'ICBC', successTime: '' },
      expect: { mchid: '1747400090', appid: 'wxd441fbf3b9f10aa3' }, ts: 100,
    }, { grantEntitlements: async (db, order) => { g.push(order.orderId); return { granted: ['full_report'], summary: 'ok' } }, isMockTransactionId: (t) => String(t).indexOf('MOCK_TXN_') === 0 })
    ok(r.ok === true, 'G1: finalize still ok despite audit failure')
    eq(DB._store.orders[0].status, 'paid', 'G2: order paid')
    eq(DB._store.payments.length, 1, 'G3: exactly one payment row')
    eq(g.length, 1, 'G4: exactly one entitlement grant')
    eq(DB._store.entitlement_grants.length, 1, 'G5: exactly one grant marker')
    eq(DB._store.payment_logs.length, 0, 'G6: audit row absent (failure tolerated)')
  }

  // ── H: error-code regression (no UNKNOWN degrade) ──
  {
    ok(CODES.ORDER_CLOSED === 10017, 'H1: ORDER_CLOSED=10017')
    ok(CODES.ORDER_REFUNDED === 10018, 'H2: ORDER_REFUNDED=10018')
    ok(CODES.ORDER_EXPIRED === 10016, 'H3: ORDER_EXPIRED=10016')
    ok(CODES.FORBIDDEN === 10019, 'H4: FORBIDDEN=10019')
    ok(CODES.DUPLICATE === 10020, 'H5: DUPLICATE=10020')
    ok(CODES.PRICE_ERROR === 10015, 'H6: PRICE_ERROR=10015')
    const { fail } = require(path.join(VP, 'lib', 'response.js'))
    eq(fail(CODES.ORDER_CLOSED, 'x').code, 10017, 'H7: fail(ORDER_CLOSED) keeps 10017')
    ok(fail(CODES.ORDER_CLOSED).code !== CODES.UNKNOWN, 'H8: not degraded to UNKNOWN')
  }

  console.log(`PAYMENT_LOG_RESILIENCE_TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})()
