#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/paycallback-main-e2e.test.js
 *
 * RC8_9_PRELAUNCH_P0_PAYMENT_CALLBACK_RECOVERY — real payCallback.main() E2E.
 *
 * Loads the REAL cloudfunctions/payCallback/index.js in a vm sandbox with:
 *   - a stub wx-server-sdk (in-memory DB, unique-key enforcement)
 *   - the REAL ./lib/paymentAuthority.js (RSA-SHA256 verify + AES-256-GCM decrypt)
 *   - the REAL ./lib/paymentFinalizer.js and ./lib/entitlementService.js
 * so a valid signed+encrypted callback exercises the entire production path,
 * including the AES-GCM decrypt → field binding → finalizePaidOrder → entitlements.
 *
 * This is the suite that would have caught P0-1 (undeclared out_trade_no/...).
 *
 * Matrix:
 *   A valid signed SUCCESS            -> decrypt ok, fields bound, finalize once, HTTP 200
 *   B invalid signature               -> HTTP non-200, finalize not called
 *   C wrong public-key id             -> rejected, finalize not called
 *   D decrypt failure (wrong key)     -> rejected, finalize not called
 *   E trade_state != SUCCESS          -> acked 200, no finalize
 *   F amount mismatch                 -> rejected, no paid, no entitlement
 *   G mchid mismatch                  -> rejected
 *   H appid mismatch                  -> rejected
 *   I missing transaction_id          -> rejected
 *   J duplicate callback              -> idempotent, one payment row, one entitlement
 *   K callback + verify concurrent    -> one paid transition, one payment, one entitlement
 *   L valid payload                   -> no ReferenceError (regression pin)
 *
 * Node built-ins only. No network, no real payment, no real DB.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..', '..')
const FN_INDEX = path.join(ROOT, 'cloudfunctions', 'payCallback', 'index.js')

// real authoritative libs
const AUTH = require(path.join(ROOT, 'cloudfunctions', 'payCallback', 'lib', 'paymentAuthority.js'))
const FIN = require(path.join(ROOT, 'cloudfunctions', 'payCallback', 'lib', 'paymentFinalizer.js'))
const ENT = require(path.join(ROOT, 'cloudfunctions', 'payCallback', 'lib', 'entitlementService.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_9_PRELAUNCH_P0 — payCallback.main() E2E')

// ── in-memory cloud DB with exactly-once unique indexes ──────────────────────
const UNIQUES = { orders: ['orderId'], payments: ['transactionId'], entitlement_grants: ['orderId'] }
function makeDB (seed) {
  const store = JSON.parse(JSON.stringify(seed || {}))
  const tick = () => new Promise((r) => setTimeout(r, 0))
  const match = (doc, q) => Object.keys(q).every((k) => {
    const c = q[k]
    if (c && typeof c === 'object' && '$in' in c) return c.$in.includes(doc[k])
    if (c && typeof c === 'object' && '$gt' in c) return doc[k] > c.$gt
    return doc[k] === c
  })
  function collection (name) {
    store[name] = store[name] || []
    const api = {
      _f: {}, _limit: 1e9, _order: null,
      where (f) { api._f = f || {}; return api },
      orderBy (k, dir) { api._order = { k, dir }; return api },
      limit (n) { api._limit = n; return api },
      async get () {
        await tick()
        let docs = store[name].filter((d) => match(d, api._f))
        if (api._order) docs = docs.slice().sort((a, b) => api._order.dir === 'desc' ? (b[api._order.k] - a[api._order.k]) : (a[api._order.k] - b[api._order.k]))
        return { data: docs.slice(0, api._limit).map((d) => JSON.parse(JSON.stringify(d))) }
      },
      async update ({ data }) {
        await tick()
        const rows = store[name].filter((d) => match(d, api._f))
        rows.forEach((d) => Object.assign(d, data))
        return { stats: { updated: rows.length } }
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
    }
    return api
  }
  return { collection, _store: store, command: { in: (arr) => ({ $in: arr }), gt: (n) => ({ $gt: n }), inc: (x) => x, lte: (x) => ({ $lte: x }) } }
}

// ── sandbox loader (real code, stub sdk) ─────────────────────────────────────
const API_V3_KEY = 'A'.repeat(32)          // 32 bytes for AES-256-GCM
const NONCE = 'abcdefghijkl'               // 12 bytes
const KEY_ID = 'PUB_KEY_ID_TEST_E2E'
const MCHID = '1747400090'
const APPID = 'wxTESTAPPID0000000'
const ORDER_ID = 'XSG_E2E_1'
const REPORT_ID = 'ARCF_e2e_1'

const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const PUB_PEM = rsa.publicKey.export({ type: 'spki', format: 'pem' }).toString()

// buildAuthorities() runs in the REAL module scope and reads process.env → seed it here.
process.env.WXPAY_API_V3_KEY = API_V3_KEY
process.env.WXPAY_MCHID = MCHID
process.env.WXPAY_APPID = APPID
process.env.WXPAY_PUBLIC_KEY = PUB_PEM
process.env.WXPAY_PUBLIC_KEY_ID = KEY_ID

function seed () {
  return {
    orders: [{ orderId: ORDER_ID, openid: 'oUser', productId: 'report_9_9', relatedId: REPORT_ID, totalAmount: 990, status: 'created', createdAt: 1, transactionId: '', paidAt: 0 }],
    products: [{ productId: 'report_9_9', permission: 'report_unlock', type: 'single', price: 990, status: 'active' }],
    ai_reports: [{ reportId: REPORT_ID, openid: 'oUser', isPaid: false }],
    challenge_records: [], payments: [], entitlement_grants: [], payment_logs: [], entitlement_audit: [],
    entitlements: [], memberships: [], users: [{ openid: 'oUser', membershipLevel: 'free' }],
    evolution_logs: [], response_metrics: [],
  }
}

function encryptResource (plaintext, apiV3Key) {
  const cip = crypto.createCipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(NONCE, 'utf8'))
  cip.setAAD(Buffer.from('transaction', 'utf8'))
  const enc = Buffer.concat([cip.update(JSON.stringify(plaintext), 'utf8'), cip.final()])
  const tag = cip.getAuthTag()
  return { algorithm: 'AEAD_AES_256_GCM', ciphertext: Buffer.concat([enc, tag]).toString('base64'), nonce: NONCE, associated_data: 'transaction' }
}

function plain (over = {}) {
  return Object.assign({
    out_trade_no: ORDER_ID,
    transaction_id: '4200001234567890123',
    trade_state: 'SUCCESS',
    amount: { total: 990, payer_total: 990, currency: 'CNY' },
    mchid: MCHID,
    appid: APPID,
    trade_type: 'JSAPI', bank_type: 'ICBC', success_time: '2026-09-30T12:00:00+08:00',
  }, over)
}

// build a fully-formed signed callback event
function callbackEvent (opts = {}) {
  const body = {
    id: 'EV1', create_time: '2026-09-30T12:00:01+08:00', resource_type: 'encrypt-resource',
    event_type: opts.event_type || 'TRANSACTION.SUCCESS',
    resource: encryptResource(opts.plain || plain(), opts.apiV3Key || API_V3_KEY),
  }
  const rawBody = JSON.stringify(body)
  const ts = Math.floor(Date.now() / 1000).toString()
  const nonce = 'noncezzzzzzz'
  const signKey = opts.signKey || rsa.privateKey
  const sig = crypto.createSign('RSA-SHA256').update(ts + '\n' + nonce + '\n' + rawBody + '\n').sign(signKey, 'base64')
  const headers = {
    'Wechatpay-Timestamp': ts,
    'Wechatpay-Nonce': nonce,
    'Wechatpay-Signature': opts.badSig ? 'AAAA' + sig.slice(4) : sig,
    'Wechatpay-Serial': opts.serial || KEY_ID,
  }
  return { body: rawBody, headers }
}

function run (dbSeed) {
  const db = makeDB(dbSeed || seed())
  const counters = { finalize: 0, grant: 0 }
  const WFIN = Object.assign({}, FIN)
  WFIN.finalizePaidOrder = async (...a) => { counters.finalize++; return FIN.finalizePaidOrder(...a) }
  const WENT = Object.assign({}, ENT)
  WENT.grantEntitlements = async (...a) => { counters.grant++; return ENT.grantEntitlements(...a) }

  const env = process.env
  const sandbox = {
    require: (req) => {
      if (req === 'wx-server-sdk') return { init: () => {}, DYNAMIC_CURRENT_ENV: 'env', database: () => db, getWXContext: () => ({ OPENID: 'oUser' }) }
      if (req.indexOf('paymentAuthority.js') >= 0) return AUTH
      if (req.indexOf('paymentFinalizer.js') >= 0) return WFIN
      if (req.indexOf('entitlementService.js') >= 0) return WENT
      const builtin = ['crypto', 'fs', 'path', 'util', 'stream', 'http', 'https', 'zlib', 'events', 'buffer', 'os']
      if (builtin.includes(req)) return require(req)
      throw new Error('unexpected require: ' + req)
    },
    module: { exports: {} }, exports: {},
    console: { log: () => {}, error: () => {}, warn: () => {} },
    process,
    Buffer, setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise, Set, Map,
  }
  sandbox.global = sandbox
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(FN_INDEX, 'utf8'), sandbox, { filename: FN_INDEX })
  return { main: sandbox.module.exports.main || sandbox.exports.main, db, counters }
}

const okAsync = async (p) => { try { return await p } catch (e) { return { __err: e } } }
const status = (res) => res && res.statusCode

;(async () => {
  // ── L (regression pin) + A · valid signed SUCCESS ──
  {
    const { main, db, counters } = run()
    const res = await okAsync(main(callbackEvent()))
    ok(!(res && res.__err), 'L/A: valid callback does NOT throw ReferenceError')
    eq(status(res), 200, 'A1: HTTP 200')
    const body = JSON.parse(res.body)
    eq(body.code, 'SUCCESS', 'A2: SUCCESS body')
    eq(counters.finalize, 1, 'A3: finalizePaidOrder called exactly once')
    eq(counters.grant, 1, 'A4: entitlement grant called once')
    eq(db._store.orders[0].status, 'paid', 'A5: order paid (fields were bound)')
    eq(db._store.orders[0].transactionId, '4200001234567890123', 'A6: transaction bound')
    eq(db._store.payments.length, 1, 'A7: one payment row')
    eq(db._store.entitlement_grants.length, 1, 'A8: one grant marker')
    eq(db._store.ai_reports[0].isPaid, true, 'A9: report unlocked via entitlement')
  }

  // ── B · invalid signature ──
  {
    const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const { main, db, counters } = run()
    const res = await okAsync(main(callbackEvent({ signKey: other.privateKey })))
    ok(status(res) !== 200, 'B1: HTTP non-200')
    eq(status(res), 401, 'B2: 401')
    eq(counters.finalize, 0, 'B3: finalize not called')
    eq(db._store.payments.length, 0, 'B4: no payment')
  }

  // ── C · wrong public-key id (serial not routed) ──
  {
    const { main, db, counters } = run()
    const res = await okAsync(main(callbackEvent({ serial: 'PUB_KEY_ID_OTHER' })))
    eq(status(res), 401, 'C1: rejected (401)')
    eq(counters.finalize, 0, 'C2: finalize not called')
    eq(db._store.orders[0].status, 'created', 'C3: not paid')
  }

  // ── D · decrypt failure (wrong apiV3 key) ──
  {
    const { main, db, counters } = run()
    const res = await okAsync(main(callbackEvent({ apiV3Key: 'B'.repeat(32) })))
    eq(status(res), 500, 'D1: rejected (500 DECRYPT_FAILED)')
    eq(JSON.parse(res.body).code, 'DECRYPT_FAILED', 'D2: DECRYPT_FAILED')
    eq(counters.finalize, 0, 'D3: finalize not called')
  }

  // ── E · trade_state != SUCCESS ──
  {
    const { main, db, counters } = run()
    const res = await okAsync(main(callbackEvent({ plain: plain({ trade_state: 'NOTPAY' }) })))
    eq(status(res), 200, 'E1: acked 200')
    eq(counters.finalize, 0, 'E2: no finalize')
    eq(db._store.orders[0].status, 'created', 'E3: not paid')
  }

  // ── F · amount mismatch ──
  {
    const { main, db, counters } = run()
    const res = await okAsync(main(callbackEvent({ plain: plain({ amount: { total: 1, payer_total: 1, currency: 'CNY' } }) })))
    ok(status(res) !== 200, 'F1: rejected')
    eq(counters.finalize, 1, 'F2: finalize invoked')
    eq(db._store.orders[0].status, 'created', 'F3: no paid')
    eq(db._store.payments.length, 0, 'F4: no payment')
    eq(counters.grant, 0, 'F5: no entitlement')
  }

  // ── G · mchid mismatch ──
  {
    const { main, db } = run()
    const res = await okAsync(main(callbackEvent({ plain: plain({ mchid: '999' }) })))
    ok(status(res) !== 200 && JSON.parse(res.body).code === 'MCHID_MISMATCH', 'G1: rejected MCHID_MISMATCH')
    eq(db._store.orders[0].status, 'created', 'G2: not paid')
  }

  // ── H · appid mismatch ──
  {
    const { main, db } = run()
    const res = await okAsync(main(callbackEvent({ plain: plain({ appid: 'wxOTHER' }) })))
    ok(status(res) !== 200 && JSON.parse(res.body).code === 'APPID_MISMATCH', 'H1: rejected APPID_MISMATCH')
    eq(db._store.orders[0].status, 'created', 'H2: not paid')
  }

  // ── I · missing transaction_id ──
  {
    const { main, db, counters } = run()
    const res = await okAsync(main(callbackEvent({ plain: plain({ transaction_id: '' }) })))
    ok(status(res) !== 200 && JSON.parse(res.body).code === 'TRANSACTION_ID_MISSING', 'I1: rejected TRANSACTION_ID_MISSING')
    eq(counters.grant, 0, 'I2: no entitlement')
  }

  // ── J · duplicate callback → idempotent ──
  {
    const { main, db, counters } = run()
    const r1 = await okAsync(main(callbackEvent()))
    const r2 = await okAsync(main(callbackEvent()))
    eq(status(r1), 200, 'J1: first 200')
    eq(status(r2), 200, 'J2: second 200 (idempotent)')
    eq(db._store.payments.length, 1, 'J3: exactly one payment row')
    eq(db._store.entitlement_grants.length, 1, 'J4: exactly one grant marker')
    eq(counters.grant, 1, 'J5: entitlement granted once total')
  }

  // ── K · callback + verify concurrent → exactly one each ──
  {
    const { main, db } = run()
    const provider = {
      tradeState: 'SUCCESS', transactionId: '4200001234567890123', outTradeNo: ORDER_ID,
      mchid: MCHID, appid: APPID, amountTotal: 990, amountCurrency: 'CNY', amountPayerTotal: 990,
      tradeType: 'JSAPI', bankType: 'ICBC', successTime: '2026-09-30T12:00:00+08:00',
    }
    const [a, b] = await Promise.all([
      okAsync(main(callbackEvent())),
      okAsync(FIN.finalizePaidOrder(db, { orderId: ORDER_ID, openid: 'oUser', source: 'query', provider, expect: { mchid: MCHID, appid: APPID }, ts: Date.now() }, { grantEntitlements: ENT.grantEntitlements })),
    ])
    eq(status(a), 200, 'K1: callback 200')
    ok(b && b.ok === true, 'K2: verify finalize ok')
    eq(db._store.orders.filter((o) => o.status === 'paid').length, 1, 'K3: one paid transition')
    eq(db._store.payments.length, 1, 'K4: one payment row')
    eq(db._store.entitlement_grants.length, 1, 'K5: one grant marker')
  }

  // ── source guard: binding precedes first use; no unbound references ──
  {
    const src = fs.readFileSync(FN_INDEX, 'utf8')
    const lines = src.split('\n')
    const bindIdx = lines.findIndex((l) => /const\s*\{\s*out_trade_no\s*,\s*transaction_id\s*,\s*trade_state\s*,\s*amount\s*,\s*mchid\s*,\s*appid\s*\}\s*=\s*decrypted/.test(l))
    ok(bindIdx >= 0, 'SRC1: fields bound from decrypted (destructure present)')
    const firstUse = lines.findIndex((l) => /const orderId = out_trade_no/.test(l))
    ok(bindIdx >= 0 && firstUse > bindIdx, 'SRC2: binding precedes first use')
    // every executable (non-comment) reference sits at/after the binding line
    let stray = 0
    for (let i = 0; i < bindIdx; i++) {
      const code = lines[i].replace(/\/\/.*$/, '')
      if (/^\s*(\*|\/\*)/.test(code)) continue   // skip block-comment lines
      if (/\b(out_trade_no|transaction_id|trade_state|mchid|appid)\b/.test(code) || /\bamount\b/.test(code)) stray++
    }
    eq(stray, 0, 'SRC3: no executable reference before binding')
  }

  console.log(`\npaycallback-main-e2e_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})()
