#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/order-entitlement-guard.test.js
 *
 * Double-charge guard: createOrder must refuse a NEW order for a one-time unlock
 * SKU when the server already shows the entitlement (challenge trialMode:false /
 * unlocked:true, or report isPaid:true). Membership SKUs are NOT pre-blocked.
 *
 * Node built-ins only; in-memory db stub.
 */

const path = require('path')
const ROOT = path.resolve(__dirname, '..', '..')
const { checkAlreadyEntitled } = require(path.join(ROOT, 'cloudfunctions', 'createOrder', 'lib', 'entitlementGuard.js'))
const antiFraudSrc = require('fs').readFileSync(path.join(ROOT, 'cloudfunctions', 'createOrder', 'lib', 'antiFraud.js'), 'utf8')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

function makeDb (rows) {
  return {
    collection: (name) => ({
      where: (q) => ({
        limit: () => ({ get: async () => ({ data: (rows[name] || []).filter((d) => Object.keys(q).every((k) => d[k] === q[k])) }) }),
      }),
    }),
  }
}

;(async () => {
  // G1: challenge already unlocked via trialMode:false → entitled
  {
    const db = makeDb({ challenge_records: [{ recordId: 'CR1', openid: 'o1', trialMode: false }] })
    const r = await checkAlreadyEntitled(db, 'o1', 'challenge_39_9', 'CR1')
    eq(r.entitled, true, 'G1.1: challenge trialMode=false → entitled')
  }
  // G2: challenge unlocked via unlocked:true only → entitled
  {
    const db = makeDb({ challenge_records: [{ recordId: 'CR2', openid: 'o1', unlocked: true }] })
    const r = await checkAlreadyEntitled(db, 'o1', 'challenge_39_9', 'CR2')
    eq(r.entitled, true, 'G2.1: challenge unlocked=true → entitled')
  }
  // G3: challenge still trial → not entitled
  {
    const db = makeDb({ challenge_records: [{ recordId: 'CR3', openid: 'o1', trialMode: true }] })
    const r = await checkAlreadyEntitled(db, 'o1', 'challenge_39_9', 'CR3')
    eq(r.entitled, false, 'G3.1: trial record → not entitled')
  }
  // G4: report already isPaid → entitled
  {
    const db = makeDb({ ai_reports: [{ reportId: 'R1', openid: 'o1', isPaid: true }] })
    const r = await checkAlreadyEntitled(db, 'o1', 'report_9_9', 'R1')
    eq(r.entitled, true, 'G4.1: report isPaid → entitled')
  }
  // G5: report not paid → not entitled
  {
    const db = makeDb({ ai_reports: [{ reportId: 'R2', openid: 'o1', isPaid: false }] })
    const r = await checkAlreadyEntitled(db, 'o1', 'report_9_9', 'R2')
    eq(r.entitled, false, 'G5.1: unpaid report → not entitled')
  }
  // G6: cross-user isolation
  {
    const db = makeDb({ challenge_records: [{ recordId: 'CR6', openid: 'oOTHER', trialMode: false }] })
    const r = await checkAlreadyEntitled(db, 'o1', 'challenge_39_9', 'CR6')
    eq(r.entitled, false, 'G6.1: other user unlock does not entitle')
  }
  // G7: membership SKU never pre-blocked
  {
    const db = makeDb({ memberships: [{ openid: 'o1', status: 'active' }] })
    const r = await checkAlreadyEntitled(db, 'o1', 'vip_month_99', '')
    eq(r.entitled, false, 'G7.1: vip SKU not pre-blocked (renewal allowed)')
    const r2 = await checkAlreadyEntitled(db, 'o1', 'vip_year_299', '')
    eq(r2.entitled, false, 'G7.2: vip year not pre-blocked')
  }
  // G8: missing relatedId → no block (cannot resolve target)
  {
    const db = makeDb({})
    const r = await checkAlreadyEntitled(db, 'o1', 'challenge_39_9', '')
    eq(r.entitled, false, 'G8.1: empty relatedId → not entitled')
  }
  // G9: db error → fail-open (not entitled), never假阻断
  {
    const db = { collection: () => ({ where: () => ({ limit: () => ({ get: async () => { throw new Error('boom') } }) }) }) }
    const r = await checkAlreadyEntitled(db, 'o1', 'challenge_39_9', 'CR9')
    eq(r.entitled, false, 'G9.1: db error → fail-open')
  }
  // G10: wiring — createOrder calls the guard and returns DUPLICATE before price/prepay
  {
    const src = require('fs').readFileSync(path.join(ROOT, 'cloudfunctions', 'createOrder', 'index.js'), 'utf8')
    ok(/checkAlreadyEntitled/.test(src), 'G10.1: createOrder imports+uses guard')
    const gi = src.indexOf('checkAlreadyEntitled(')
    const pi = src.indexOf('jsapiOrder(')
    ok(gi > -1 && pi > -1 && gi < pi, 'G10.2: guard runs before any prepay call')
    ok(/CODES\.DUPLICATE/.test(src), 'G10.3: returns DUPLICATE code')
    ok(/entitled: true/.test(src), 'G10.4: returns entitled flag')
  }
  // G11: antiFraud window reminder (documents why the guard is needed) — module has no entitlement awareness
  {
    ok(!/isPaid|trialMode|unlocked/.test(antiFraudSrc), 'G11.1: antiFraud has no entitlement awareness (window-only dup check)')
  }
  // G12: client handles DUPLICATE gracefully
  {
    const cli = require('fs').readFileSync(path.join(ROOT, 'pages', 'membership', 'membership.js'), 'utf8')
    ok(/10020/.test(cli) && /r\.data\.entitled/.test(cli), 'G12.1: client detects entitled duplicate and backs out')
  }

  console.log(`ORDER_ENTITLEMENT_GUARD_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
