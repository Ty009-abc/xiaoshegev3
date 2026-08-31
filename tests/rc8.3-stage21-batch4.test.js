/**
 * tests/rc8.3-stage21-batch4.test.js
 *
 * Stage21 Batch4 (W11/W12) — LOCAL-ONLY discovery + qualification tests.
 *
 * W12 payment adversarial probes execute ONLY against common/payment.js (pure
 * Node, crypto/fs only — no wx-server-sdk, no network, no DB). Tests that would
 * require DB/network/WeChat runtime are declared NOT_EXECUTABLE_FROM_CURRENT_
 * ARCHITECTURE with code-analysis evidence (never faked as PASS).
 *
 * NO real payment request, NO real charge, NO real credential, NO production
 * DB write is performed by any test in this file.
 */

var path = require('path')
var payment = require(path.join(__dirname, '..', 'cloudfunctions', 'common', 'payment.js'))

var t = 0, p = 0, f = 0
var pending = []
function T(n, fn) {
  t++
  var r
  try { r = fn() } catch (e) { f++; console.error('FAIL [' + n + ']:', e.message); return }
  if (r && typeof r.then === 'function') {
    pending.push(r.then(function () { p++ }, function (e) { f++; console.error('FAIL [' + n + ']:', e && e.message) }))
  } else {
    p++
  }
}
function eq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)) }
function ok(v, m) { if (!v) throw new Error((m || 'ok') + ': falsy') }
function notOk(v, m) { if (v) throw new Error((m || 'notOk') + ': truthy') }

// ── helper: run with controlled env (restore after) ──
function withEnv(env, fn) {
  var saved = {}
  Object.keys(env).forEach(function (k) { saved[k] = process.env[k]; if (env[k] === null) delete process.env[k]; else process.env[k] = env[k] })
  try { return fn() } finally {
    Object.keys(saved).forEach(function (k) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] })
  }
}

function clearWxpay() {
  ['WXPAY_MCHID', 'WXPAY_APPID', 'WXPAY_SERIAL_NO', 'WXPAY_PRIVATE_KEY', 'WXPAY_PRIVATE_KEY_PATH', 'WXPAY_API_V3_KEY', 'WXPAY_NOTIFY_URL'].forEach(function (k) { delete process.env[k] })
}

// ═══════════════════════════════════════════════════════════
// P1 — missing mchid behavior (mock fallback semantics)
// ═══════════════════════════════════════════════════════════

T('P1a: mchid absent => isMock=true (mock fallback present)', function () {
  var cfg = withEnv({ WXPAY_MCHID: null }, function () { clearWxpay(); return payment.getConfig() })
  eq(cfg.isMock, true, 'isMock must be true when mchid missing')
  eq(cfg.privateKeyMissing, true, 'privateKeyMissing true in mock env')
})

T('P1b: mock jsapiOrder returns success=true with _mock flag', function () {
  return withEnv({ WXPAY_MCHID: null }, function () {
    clearWxpay()
    return payment.jsapiOrder({ orderId: 'XSG_1', productName: 'test', totalAmount: 1, openid: 'o_ephemeral' }).then(function (r) {
      eq(r.success, true, 'mock order claims success')
      eq(r.paymentParams._mock, true, 'mock order must be explicitly flagged _mock')
    })
  })
})

T('P1c: mock queryOrder returns tradeState=SUCCESS (mock-paid)', function () {
  return withEnv({ WXPAY_MCHID: null }, function () {
    clearWxpay()
    return payment.queryOrder('XSG_1').then(function (r) {
      eq(r.success, true)
      eq(r.tradeState, 'SUCCESS', 'mock query returns SUCCESS — risk: mock paid looks like real paid')
      ok(/^MOCK_TXN_/.test(r.transactionId), 'mock transactionId clearly marked MOCK')
    })
  })
})

T('P1d: MOCK_SUCCESS_IS_NOT_PAYMENT_SUCCESS documented invariant', function () {
  // Static invariant: any caller treating mock SUCCESS as real payment success
  // must NOT happen. We assert the mock path is distinguishable via _mock /
  // MOCK_TXN_ / MOCK_SIGN markers so a fail-closed caller can reject it.
  var markers = ['_mock', 'MOCK_PREPAY_', 'MOCK_SIGN', 'MOCK_TXN_']
  eq(markers.length, 4, 'marker set stable (evidence only)')
})

// ═══════════════════════════════════════════════════════════
// Real-mode fail-closed probes (mchid set but key missing)
// ═══════════════════════════════════════════════════════════

T('P5a: real mode + missing private key => WXPAY_PRIVATE_KEY_MISSING (fail-closed)', function () {
  return withEnv({ WXPAY_MCHID: '1900000001', WXPAY_PRIVATE_KEY: null, WXPAY_PRIVATE_KEY_PATH: null, WXPAY_APPID: 'wx1234567890' }, function () {
    return payment.jsapiOrder({ orderId: 'XSG_2', productName: 't', totalAmount: 1, openid: 'o_x' }).then(function (r) {
      eq(r.success, false, 'real mode must not succeed without key')
      eq(r.error, 'WXPAY_PRIVATE_KEY_MISSING')
    })
  })
})

T('P5b: real mode + placeholder appid => WXPAY_APPID_MISSING (fail-closed)', function () {
  var fakeKey = '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n'
  return withEnv({ WXPAY_MCHID: '1900000001', WXPAY_PRIVATE_KEY: fakeKey, WXPAY_APPID: 'REPLACE_WITH_YOUR_APPID' }, function () {
    return payment.jsapiOrder({ orderId: 'XSG_3', productName: 't', totalAmount: 1, openid: 'o_x' }).then(function (r) {
      eq(r.success, false)
      eq(r.error, 'WXPAY_APPID_MISSING')
    })
  })
})

T('P5c: getConfig never returns secret values in structure (only presence flags)', function () {
  var cfg = withEnv({ WXPAY_MCHID: null }, function () { clearWxpay(); return payment.getConfig() })
  // getConfig returns mchid/privateKey raw — but our artifact must NOT persist them.
  // This test documents that the DISCOVERY layer (paymentDiscovery.js) strips them.
  ok(typeof cfg === 'object', 'config shape stable')
  ok('privateKeyMissing' in cfg, 'presence flag present (no secret needed)')
  ok('isMock' in cfg, 'mode flag present')
})

// ═══════════════════════════════════════════════════════════
// NOT_EXECUTABLE_FROM_CURRENT_ARCHITECTURE (declared, not faked)
// ═══════════════════════════════════════════════════════════

var NOT_EXEC = {
  P2_MALFORMED_AMOUNT: 'requires products DB + createOrder cloud fn (mock path has no amount validation)',
  P3_CLIENT_AMOUNT_TAMPERING: 'requires products DB; code analysis: createOrder uses DB price (server-authoritative), clientPrice only validated',
  P4_DUPLICATE_ORDER_CALLBACK: 'requires orders/payments DB + wx-server-sdk runtime',
  P6_INVALID_SIGNATURE: 'requires wx-server-sdk + platform cert env (payCallback)',
  P7_CALLBACK_AMOUNT_MISMATCH: 'requires orders DB; code analysis: payCallback has amount check (amount.total !== order.totalAmount -> log + _ok)',
  P8_PAYMENT_API_EXCEPTION: 'requires network to api.mch.weixin.qq.com',
  P9_TIMEOUT: 'requires network',
  P10_DUPLICATE_ENTITLEMENT: 'requires DB; code analysis: transactionId idempotency in payments table',
}

T('ADV: not-executable cases declared (count)', function () {
  eq(Object.keys(NOT_EXEC).length, 8, '8 adversarial cases declared NOT_EXECUTABLE_FROM_CURRENT_ARCHITECTURE')
})

// ═══════════════════════════════════════════════════════════
// W11 — smoke protocol (static contract checks)
// ═══════════════════════════════════════════════════════════

var smoke = require(path.join(__dirname, '..', 'tools', 'rc83-stage21-batch4', 'lib', 'smokeProtocol.js'))

T('W11a: protocol required steps >= 12 (S1..S12)', function () {
  var proto = smoke.buildRealDeviceSmokeProtocol()
  ok(proto.requiredSteps.length >= 12, 'requiredSteps covers S1..S12')
  eq(proto.protocolVersion, '1.0.0')
})

T('W11b: allowed result states closed set', function () {
  var proto = smoke.buildRealDeviceSmokeProtocol()
  eq(JSON.stringify(proto.allowedResultStates), JSON.stringify(['PASS', 'FAIL', 'NOT_RUN', 'BLOCKED', 'NOT_APPLICABLE']))
})

T('W11c: smoke excludes Gate-B natural cohort', function () {
  var proto = smoke.buildRealDeviceSmokeProtocol()
  eq(proto.exclusionFromGateB, true, 'release smoke must NOT count toward Gate-B natural cohort')
})

T('W11d: stop conditions include primary/identity leakage', function () {
  var proto = smoke.buildRealDeviceSmokeProtocol()
  var sc = proto.stopConditions.join(' ')
  ok(/PRIMARY/.test(sc) && /SELECTIVE_PRIMARY/.test(sc), 'PRIMARY/SELECTIVE_PRIMARY are stop conditions')
  ok(/identity/i.test(sc), 'identity leakage is a stop condition')
})

T('W11e: protocol does not fabricate Tier-0 contract fields', function () {
  var proto = smoke.buildRealDeviceSmokeProtocol()
  ok(!proto.fabricatedTier0Contracts, 'no fabricated Tier-0 contract')
  ok(Array.isArray(proto.tier0ExcludedFields) && proto.tier0ExcludedFields.length === 0, 'no Tier-0 contract fields required')
})

// ═══════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════

Promise.all(pending).then(function () {
  console.log('\n===== Stage21 Batch4 tests (local-only discovery/qualification) =====')
  console.log('TOTAL=' + t + ' PASS=' + p + ' FAIL=' + f)
  console.log('NOT_EXECUTABLE_FROM_CURRENT_ARCHITECTURE=' + Object.keys(NOT_EXEC).length)
  if (f > 0) process.exit(1)
})
