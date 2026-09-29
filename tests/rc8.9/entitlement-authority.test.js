#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/entitlement-authority.test.js
 *
 * PAYMENT_STAGE5A_R2_ENTITLEMENT_AUTHORITY_REPAIR — deterministic regression set.
 *
 *  A  challenge_39_9 correct recordId → 1 target → trialMode=false/unlocked=true → grant granted
 *  B  regression: challenge selector uses recordId (never _id=relatedId)
 *  C  challenge target missing → grant NOT granted
 *  D  challenge target ambiguous (2) → fail closed, no mutation
 *  E  target update returns 0 → grant NOT granted
 *  F  crash after target mutation, before marker promotion → retry verifies → grants once
 *  G  legacy premature grant.status=granted (target locked) → detected → reconciled
 *  H  duplicate verifyPayment → no duplicate entitlement
 *  I  duplicate callback → no duplicate entitlement
 *  J  verify + callback concurrency → exactly one successful entitlement result
 *  K  challenge_39_9 never mutates ai_reports
 *  L  report_9_9 never mutates challenge_records
 *  M  report_9_9 correct reportId → isPaid=true → verified → granted
 *  N  report target missing → grant NOT granted
 *  O  vip_month_99 same-order replay → membership extended once only
 *  P  vip_year_299 same-order replay → membership extended once only
 *  Q  explicit product routing (no permList.includes('full_report') bleed)
 *  R  finalizer + entitlementService copies byte-identical across verify/callback
 *
 * Node built-ins only. No network, no real payment, no real DB.
 */

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..', '..')
const ESVC = require(path.join(ROOT, 'cloudfunctions', 'common', 'entitlementService.js'))
const PF = require(path.join(ROOT, 'cloudfunctions', 'verifyPayment', 'lib', 'paymentFinalizer.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE5A_R2 entitlement authority')

// ── fake DB with unique-index enforcement + zero-update injection ──────────
const UNIQUES = { orders: ['orderId'], payments: ['transactionId'], entitlement_grants: ['orderId'] }
function makeDb (opts = {}) {
  const store = {
    orders: [], payments: [], entitlement_grants: [], entitlements: [], entitlement_audit: [],
    payment_logs: [], products: [], ai_reports: [], challenge_records: [], memberships: [], users: [],
  }
  const zero = new Set(opts.zeroUpdate || [])
  const tick = () => new Promise((r) => setTimeout(r, 0))
  const command = { in: (arr) => ({ __op: 'in', $in: arr }), gt: (n) => ({ __op: 'gt', $gt: n }) }
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
            if (zero.has(name)) return { stats: { updated: 0 } }
            rows.forEach((d) => Object.assign(d, data))
            return { stats: { updated: rows.length } }
          },
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
const EXPECT = { mchid: MCHID, appid: APPID }

function pushRaw (db, name, doc) {
  const raw = Object.assign({ _id: name + '_' + (db._store[name].length + 1) }, doc)
  db._store[name].push(raw)
  return raw
}
function seedOrder (db, over = {}) {
  return pushRaw(db, 'orders', Object.assign({
    orderId: 'XSG_T1', openid: 'oUser', productId: 'report_9_9', totalAmount: 990,
    status: 'created', relatedId: '', createdAt: 1, transactionId: '', paidAt: 0,
  }, over))
}
function provider (over = {}) {
  return Object.assign({
    tradeState: 'SUCCESS', transactionId: '4200001111222233334444', outTradeNo: 'XSG_T1',
    mchid: MCHID, appid: APPID, amountTotal: 990, amountCurrency: 'CNY', amountPayerTotal: 990,
    tradeType: 'JSAPI', bankType: 'ICBC', successTime: '2026-09-29T06:00:00+08:00',
  }, over)
}
const deps = () => ({ grantEntitlements: ESVC.grantEntitlements, isMockTransactionId: (t) => typeof t === 'string' && t.indexOf('MOCK_TXN_') === 0 })

function seedChallengeProduct (db, over = {}) {
  pushRaw(db, 'products', Object.assign({ productId: 'challenge_39_9', type: 'single', permission: 'challenge_unlock', durationDays: 0 }, over))
}
function seedReportProduct (db, over = {}) {
  pushRaw(db, 'products', Object.assign({ productId: 'report_9_9', type: 'single', permission: 'report_unlock', durationDays: 0 }, over))
}

;(async () => {
  // ── A: challenge happy path ──
  {
    const db = makeDb(); seedChallengeProduct(db)
    pushRaw(db, 'challenge_records', { _id: 'recA', recordId: 'CR_X', openid: 'oUser', trialMode: true })
    seedOrder(db, { orderId: 'XSG_A', productId: 'challenge_39_9', totalAmount: 3990, relatedId: 'CR_X' })
    const r = await PF.finalizePaidOrder(db, { orderId: 'XSG_A', openid: 'oUser', source: 'query', provider: provider({ outTradeNo: 'XSG_A', amountTotal: 3990 }), expect: EXPECT, ts: 100 }, deps())
    ok(r.ok === true, 'A0: finalize ok')
    const rec = db._store.challenge_records.find((c) => c.recordId === 'CR_X')
    eq(rec.trialMode, false, 'A1: trialMode=false')
    eq(rec.unlocked, true, 'A2: unlocked=true')
    eq(db._store.entitlement_grants.length, 1, 'A3: one grant marker')
    eq(db._store.entitlement_grants[0].status, 'granted', 'A4: grant.status=granted')
    eq(db._store.entitlement_grants[0].applied, true, 'A5: grant.applied=true')
    eq(r.entitlementApplied, true, 'A6: entitlementApplied')
  }

  // ── B: selector regression (recordId, not _id) ──
  {
    const src = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'common', 'entitlementService.js'), 'utf8')
    ok(/challenge_records'\)\.where\(\{ recordId: relatedId, openid \}\)/.test(src), 'B1: challenge selector = { recordId: relatedId, openid }')
    ok(!/_id: relatedId/.test(src), 'B2: no _id: relatedId selector remains')
    // behavioral: _id != recordId, correct target still mutated
    const db = makeDb(); seedChallengeProduct(db)
    pushRaw(db, 'challenge_records', { _id: 'WONKY_MONGO_ID', recordId: 'CR_B', openid: 'oUser', trialMode: true })
    seedOrder(db, { orderId: 'XSG_B', productId: 'challenge_39_9', totalAmount: 3990, relatedId: 'CR_B' })
    await PF.finalizePaidOrder(db, { orderId: 'XSG_B', openid: 'oUser', source: 'query', provider: provider({ outTradeNo: 'XSG_B', amountTotal: 3990 }), expect: EXPECT, ts: 100 }, deps())
    eq(db._store.challenge_records[0].trialMode, false, 'B3: correct (recordId-keyed) target mutated even when _id differs')
  }

  // ── C: challenge target missing ──
  {
    const db = makeDb(); seedChallengeProduct(db)
    seedOrder(db, { orderId: 'XSG_C', productId: 'challenge_39_9', totalAmount: 3990, relatedId: 'CR_MISSING' })
    const r = await PF.finalizePaidOrder(db, { orderId: 'XSG_C', openid: 'oUser', source: 'query', provider: provider({ outTradeNo: 'XSG_C', amountTotal: 3990 }), expect: EXPECT, ts: 100 }, deps())
    ok(r.ok === true, 'C0: finalize resolves')
    eq(db._store.entitlement_grants[0].status, 'failed', 'C1: grant NOT granted (missing target)')
    eq(r.entitlementApplied, false, 'C2: entitlementApplied=false')
    ok(db._store.entitlement_audit.some((a) => a.action === 'challenge_target_not_unique'), 'C3: audit recorded')
  }

  // ── D: challenge target ambiguous ──
  {
    const db = makeDb(); seedChallengeProduct(db)
    pushRaw(db, 'challenge_records', { _id: 'd1', recordId: 'CR_D', openid: 'oUser', trialMode: true })
    pushRaw(db, 'challenge_records', { _id: 'd2', recordId: 'CR_D', openid: 'oUser', trialMode: true })
    seedOrder(db, { orderId: 'XSG_D', productId: 'challenge_39_9', totalAmount: 3990, relatedId: 'CR_D' })
    await PF.finalizePaidOrder(db, { orderId: 'XSG_D', openid: 'oUser', source: 'query', provider: provider({ outTradeNo: 'XSG_D', amountTotal: 3990 }), expect: EXPECT, ts: 100 }, deps())
    eq(db._store.entitlement_grants[0].status, 'failed', 'D1: ambiguous → fail closed')
    ok(db._store.challenge_records.every((c) => c.trialMode === true), 'D2: no mutation on ambiguous')
  }

  // ── E: target update returns 0 ──
  {
    const db = makeDb({ zeroUpdate: ['challenge_records'] }); seedChallengeProduct(db)
    pushRaw(db, 'challenge_records', { _id: 'e1', recordId: 'CR_E', openid: 'oUser', trialMode: true })
    seedOrder(db, { orderId: 'XSG_E', productId: 'challenge_39_9', totalAmount: 3990, relatedId: 'CR_E' })
    await PF.finalizePaidOrder(db, { orderId: 'XSG_E', openid: 'oUser', source: 'query', provider: provider({ outTradeNo: 'XSG_E', amountTotal: 3990 }), expect: EXPECT, ts: 100 }, deps())
    eq(db._store.entitlement_grants[0].status, 'failed', 'E1: update=0 → grant NOT granted')
    ok(db._store.entitlement_audit.some((a) => a.action === 'challenge_update_zero'), 'E2: audit recorded')
  }

  // ── F: crash after target mutation, before marker promotion ──
  {
    const db = makeDb(); seedChallengeProduct(db)
    pushRaw(db, 'challenge_records', { _id: 'f1', recordId: 'CR_F', openid: 'oUser', trialMode: true })
    const order = { orderId: 'XSG_F', openid: 'oUser', productId: 'challenge_39_9', relatedId: 'CR_F' }
    // target mutated (as if grantEntitlements ran) but marker left 'applying', applied:false (crash)
    await ESVC.grantEntitlements(db, order, 100)
    eq(db._store.challenge_records[0].trialMode, false, 'F1: target mutated pre-crash')
    pushRaw(db, 'entitlement_grants', { orderId: 'XSG_F', openid: 'oUser', productId: 'challenge_39_9', status: 'applying', applied: false, attempts: 1, claimAt: 50 })
    // retry (stale claim → takeover) → verifies target idempotently → promotes once
    const g = await PF._ensureGrant(db, order, '4200009999000011112222', 100000, ESVC.grantEntitlements)
    eq(g.applied, true, 'F2: retry proves target')
    eq(g.markerStatus, 'granted', 'F3: marker promoted to granted')
    eq(db._store.entitlement_grants.length, 1, 'F4: still one marker')
    eq(db._store.challenge_records.length, 1, 'F5: no duplicate target')
    eq(db._store.challenge_records[0].trialMode, false, 'F6: target still unlocked (no re-corruption)')
  }

  // ── G: legacy premature grant=granted but target locked ──
  {
    const db = makeDb(); seedChallengeProduct(db)
    pushRaw(db, 'challenge_records', { _id: 'g1', recordId: 'CR_G', openid: 'oUser', trialMode: true })
    // legacy marker: granted but NO applied flag (pre-5A_R2 false positive)
    pushRaw(db, 'entitlement_grants', { orderId: 'XSG_G', openid: 'oUser', productId: 'challenge_39_9', transactionId: '42000000000000000000XX', status: 'granted', grantedAt: 50 })
    const order = { orderId: 'XSG_G', openid: 'oUser', productId: 'challenge_39_9', relatedId: 'CR_G' }
    const g = await PF._ensureGrant(db, order, '42000000000000000000XX', 100, ESVC.grantEntitlements)
    eq(g.applied, true, 'G1: legacy marker not trusted → reconciled')
    eq(db._store.challenge_records[0].trialMode, false, 'G2: target now mutated')
    eq(db._store.entitlement_grants[0].applied, true, 'G3: marker upgraded with proof')
    eq(db._store.entitlement_grants.length, 1, 'G4: still one marker (no dup)')
  }

  // ── H: duplicate verifyPayment ──
  {
    const db = makeDb(); seedChallengeProduct(db)
    pushRaw(db, 'challenge_records', { _id: 'h1', recordId: 'CR_H', openid: 'oUser', trialMode: true })
    seedOrder(db, { orderId: 'XSG_H', productId: 'challenge_39_9', totalAmount: 3990, relatedId: 'CR_H' })
    const d = deps()
    const p = provider({ outTradeNo: 'XSG_H', amountTotal: 3990 })
    const a = await PF.finalizePaidOrder(db, { orderId: 'XSG_H', openid: 'oUser', source: 'query', provider: p, expect: EXPECT, ts: 100 }, d)
    const b = await PF.finalizePaidOrder(db, { orderId: 'XSG_H', openid: 'oUser', source: 'query', provider: p, expect: EXPECT, ts: 120 }, d)
    ok(a.ok && b.ok, 'H1: both ok')
    eq(db._store.entitlement_grants.length, 1, 'H2: one marker')
    eq(db._store.challenge_records.length, 1, 'H3: one target')
    ok(db._store.payments.length === 1, 'H4: one payment')
  }

  // ── I: duplicate callback ──
  {
    const db = makeDb(); seedChallengeProduct(db)
    pushRaw(db, 'challenge_records', { _id: 'i1', recordId: 'CR_I', openid: 'oUser', trialMode: true })
    seedOrder(db, { orderId: 'XSG_I', productId: 'challenge_39_9', totalAmount: 3990, relatedId: 'CR_I' })
    const d = deps()
    const p = provider({ outTradeNo: 'XSG_I', amountTotal: 3990 })
    const a = await PF.finalizePaidOrder(db, { orderId: 'XSG_I', source: 'callback', provider: p, expect: EXPECT, ts: 100 }, d)
    const b = await PF.finalizePaidOrder(db, { orderId: 'XSG_I', source: 'callback', provider: p, expect: EXPECT, ts: 110 }, d)
    ok(a.ok && b.ok, 'I1: both ok')
    eq(db._store.entitlement_grants.length, 1, 'I2: one marker')
    eq(db._store.payments.length, 1, 'I3: one payment')
  }

  // ── J: verify + callback concurrency ──
  {
    const db = makeDb(); seedChallengeProduct(db)
    pushRaw(db, 'challenge_records', { _id: 'j1', recordId: 'CR_J', openid: 'oUser', trialMode: true })
    seedOrder(db, { orderId: 'XSG_J', productId: 'challenge_39_9', totalAmount: 3990, relatedId: 'CR_J' })
    const d = deps()
    const p = provider({ outTradeNo: 'XSG_J', amountTotal: 3990 })
    const [a, b] = await Promise.all([
      PF.finalizePaidOrder(db, { orderId: 'XSG_J', openid: 'oUser', source: 'query', provider: p, expect: EXPECT, ts: 100 }, d),
      PF.finalizePaidOrder(db, { orderId: 'XSG_J', source: 'callback', provider: p, expect: EXPECT, ts: 100 }, d),
    ])
    ok(a.ok && b.ok, 'J1: both resolve ok')
    eq(db._store.entitlement_grants.length, 1, 'J2: exactly one marker')
    eq(db._store.payments.length, 1, 'J3: exactly one payment')
    const winners = [a, b].filter((r) => r.grantIdempotent === false)
    eq(winners.length, 1, 'J4: exactly one successful (non-idempotent) entitlement result')
    eq(db._store.challenge_records[0].trialMode, false, 'J5: target unlocked once')
    eq(db._store.entitlement_grants[0].status, 'granted', 'J6: final marker granted')
  }

  // ── K: challenge never mutates ai_reports ──
  {
    const db = makeDb(); seedChallengeProduct(db)
    pushRaw(db, 'challenge_records', { _id: 'k1', recordId: 'CR_K', openid: 'oUser', trialMode: true })
    pushRaw(db, 'ai_reports', { _id: 'kar', reportId: 'CR_K', openid: 'oUser', isPaid: false })
    seedOrder(db, { orderId: 'XSG_K', productId: 'challenge_39_9', totalAmount: 3990, relatedId: 'CR_K' })
    await PF.finalizePaidOrder(db, { orderId: 'XSG_K', openid: 'oUser', source: 'query', provider: provider({ outTradeNo: 'XSG_K', amountTotal: 3990 }), expect: EXPECT, ts: 100 }, deps())
    eq(db._store.ai_reports[0].isPaid, false, 'K1: challenge_39_9 did NOT mutate ai_reports')
    eq(db._store.challenge_records[0].trialMode, false, 'K2: challenge record unlocked')
  }

  // ── L: report never mutates challenge_records ──
  {
    const db = makeDb(); seedReportProduct(db)
    pushRaw(db, 'ai_reports', { _id: 'lar', reportId: 'RPT_L', openid: 'oUser', isPaid: false })
    pushRaw(db, 'challenge_records', { _id: 'lch', recordId: 'RPT_L', openid: 'oUser', trialMode: true })
    seedOrder(db, { orderId: 'XSG_L', productId: 'report_9_9', totalAmount: 990, relatedId: 'RPT_L' })
    await PF.finalizePaidOrder(db, { orderId: 'XSG_L', openid: 'oUser', source: 'query', provider: provider({ outTradeNo: 'XSG_L', amountTotal: 990 }), expect: EXPECT, ts: 100 }, deps())
    eq(db._store.ai_reports[0].isPaid, true, 'L1: report unlocked')
    eq(db._store.challenge_records[0].trialMode, true, 'L2: report_9_9 did NOT mutate challenge_records')
  }

  // ── M: report happy path ──
  {
    const db = makeDb(); seedReportProduct(db)
    pushRaw(db, 'ai_reports', { _id: 'mar', reportId: 'RPT_M', openid: 'oUser', isPaid: false })
    seedOrder(db, { orderId: 'XSG_M', productId: 'report_9_9', totalAmount: 990, relatedId: 'RPT_M' })
    const r = await PF.finalizePaidOrder(db, { orderId: 'XSG_M', openid: 'oUser', source: 'query', provider: provider({ outTradeNo: 'XSG_M', amountTotal: 990 }), expect: EXPECT, ts: 100 }, deps())
    eq(db._store.ai_reports[0].isPaid, true, 'M1: isPaid=true')
    eq(r.entitlementApplied, true, 'M2: proven applied')
    eq(db._store.entitlement_grants[0].status, 'granted', 'M3: grant granted')
  }

  // ── N: report target missing ──
  {
    const db = makeDb(); seedReportProduct(db)
    seedOrder(db, { orderId: 'XSG_N', productId: 'report_9_9', totalAmount: 990, relatedId: 'RPT_MISSING' })
    const r = await PF.finalizePaidOrder(db, { orderId: 'XSG_N', openid: 'oUser', source: 'query', provider: provider({ outTradeNo: 'XSG_N', amountTotal: 990 }), expect: EXPECT, ts: 100 }, deps())
    eq(db._store.entitlement_grants[0].status, 'failed', 'N1: report target missing → NOT granted')
    eq(r.entitlementApplied, false, 'N2: entitlementApplied=false')
  }

  // ── O: vip_month replay extends once ──
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_month_99', type: 'membership', permission: 'vip', durationDays: 30 })
    const order = { orderId: 'XSG_OM', openid: 'oUser', productId: 'vip_month_99', relatedId: '' }
    await ESVC.grantEntitlements(db, order, 1000)
    const first = db._store.memberships[0].expiredAt
    await ESVC.grantEntitlements(db, order, 2000) // replay same orderId
    eq(db._store.memberships.length, 1, 'O1: one membership row (no dup)')
    eq(db._store.memberships[0].expiredAt, first, 'O2: expiry unchanged on same-order replay')
    // different order → legitimately extends
    await ESVC.grantEntitlements(db, { orderId: 'XSG_OM2', openid: 'oUser', productId: 'vip_month_99', relatedId: '' }, 5000)
    ok(db._store.memberships[0].expiredAt > first, 'O3: a NEW order extends membership')
  }

  // ── P: vip_year replay extends once ──
  {
    const db = makeDb()
    pushRaw(db, 'products', { productId: 'vip_year_299', type: 'membership', permission: 'vip', durationDays: 365 })
    const order = { orderId: 'XSG_OY', openid: 'oUser', productId: 'vip_year_299', relatedId: '' }
    await ESVC.grantEntitlements(db, order, 1000)
    const first = db._store.memberships[0].expiredAt
    await ESVC.grantEntitlements(db, order, 3000)
    await ESVC.grantEntitlements(db, order, 9000)
    eq(db._store.memberships.length, 1, 'P1: one membership row')
    eq(db._store.memberships[0].expiredAt, first, 'P2: exact 365d once, no double-extend')
  }

  // ── Q: explicit product routing ──
  {
    const src = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'common', 'entitlementService.js'), 'utf8')
    ok(!/permList\.includes\('full_report'\)/.test(src), 'Q1: no permList.includes(full_report) branch')
    ok(!/permList\.includes\('challenge_full'\)/.test(src), 'Q2: no permList.includes(challenge_full) branch')
    ok(/product\.permission === PERM\.REPORT_UNLOCK/.test(src), 'Q3: report routed by explicit product.permission')
    ok(/product\.permission === PERM\.CHALLENGE_UNLOCK/.test(src), 'Q4: challenge routed by explicit product.permission')
    ok(/MEMBERSHIP_TYPES\.includes\(product\.type\)/.test(src), 'Q5: membership routed by product.type')
  }

  // ── R: copy integrity ──
  {
    const files = [
      ['common', 'verifyPayment/lib', 'payCallback/lib'],
    ]
    const esvc = ['common/entitlementService.js', 'verifyPayment/lib/entitlementService.js', 'payCallback/lib/entitlementService.js']
      .map((p) => crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'cloudfunctions', p))).digest('hex'))
    ok(esvc[0] === esvc[1] && esvc[1] === esvc[2], 'R1: entitlementService copies byte-identical')
    const pfin = ['common/paymentFinalizer.js', 'verifyPayment/lib/paymentFinalizer.js', 'payCallback/lib/paymentFinalizer.js']
      .map((p) => crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'cloudfunctions', p))).digest('hex'))
    ok(pfin[0] === pfin[1] && pfin[1] === pfin[2], 'R2: paymentFinalizer copies byte-identical')
    // no inline grant left in callback
    const pc = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'payCallback', 'index.js'), 'utf8')
    ok(/finalizePaidOrder/.test(pc) && !/grantEntitlements\(db, order, ts\)/.test(pc), 'R3: callback uses shared finalizer, no inline grant')
    // permissionEngine maps the SKUs (so explicit routing resolves)
    const pe = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'common', 'permissionEngine.js'), 'utf8')
    ok(/challenge_39_9/.test(pe) && /report_9_9/.test(pe), 'R4: permissionEngine maps both SKUs')
  }

  console.log(`ENTITLEMENT_AUTHORITY_TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
