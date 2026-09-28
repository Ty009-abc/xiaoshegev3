#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/payment-signing-foundation.test.js
 *
 * PAYMENT_STAGE2_SIGNING_AND_VERIFICATION_FOUNDATION — regression set.
 *
 * Covers the cryptographic foundation WITHOUT any real charge / network / DB:
 *   G1  merchant signing material: valid PEM + 40-hex serial → guard PASS
 *   G2  wrong/placeholder private key → guard FAIL (NOT_PEM)
 *   G3  wrong serial (45-hex/non-hex) → guard FAIL (SERIAL_INVALID)
 *   G4  missing private key → guard FAIL (MISSING)
 *   S1  merchant sign → verify with matching cert public key → PASS
 *   S2  merchant sign → verify with WRONG public key → FAIL
 *   R1  valid signed WeChat response → verifyResponseSignature valid
 *   R2  tampered body → signature verification FAIL
 *   R3  wrong Wechatpay-Serial / public-key-ID → FAIL
 *   R4  missing signature headers → FAIL
 *   R5  queryOrder rejects unsigned provider response (fail-closed)
 *   R6  queryOrder accepts correctly signed response
 *   C1  payCallback decryptResource: valid AEAD_AES_256_GCM → PASS
 *   C2  decryptResource: wrong apiV3 key → FAIL (null)
 *   C3  signature + decrypt chain PASS; tampered ciphertext → FAIL
 *   F1  refundOrder fails closed (no fake refund success)
 *
 * Node built-ins only. No network. No real payment. Runnable from repo root.
 */

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const Module = require('module')

const ROOT = path.resolve(__dirname, '..', '..')
const AUTH = require(path.join(ROOT, 'cloudfunctions', 'payCallback', 'lib', 'paymentAuthority.js'))
const GUARD = require(path.join(ROOT, 'scripts', 'lib', 'secret-guard.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE2 signing & verification foundation')

const MERCHANT_SERIAL = '3AF9A0887378AAF102E498F9847AE76C4FEF9225'

// ── fixtures ───────────────────────────────────────────────────────────────
function genRsa () {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
}
function pemPriv (kp) { return kp.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }
function pemPub (kp) { return kp.publicKey.export({ type: 'spki', format: 'pem' }).toString() }

function signMessage (priv, message) {
  return crypto.createSign('RSA-SHA256').update(message).sign(priv, 'base64')
}

// ═══ G: deploy guard (value shape on merchant signing material) ═══
{
  const good = { WXPAY_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----', WXPAY_SERIAL_NO: MERCHANT_SERIAL }
  const r1 = GUARD.scanPaymentSigning('createOrder', good)
  ok(r1.length === 0, 'G1: valid PEM + 40-hex serial → no issues')

  const r2 = GUARD.scanPaymentSigning('createOrder', { WXPAY_PRIVATE_KEY: '<NEED_PRIVATE_KEY>', WXPAY_SERIAL_NO: MERCHANT_SERIAL })
  ok(r2.some((i) => i.reason === 'PAYMENT_PRIVATE_KEY_NOT_PEM'), 'G2: placeholder key → NOT_PEM')

  const r3 = GUARD.scanPaymentSigning('verifyPayment', { WXPAY_PRIVATE_KEY: pemPriv(genRsa()), WXPAY_SERIAL_NO: 'ABC123' })
  ok(r3.some((i) => i.reason === 'PAYMENT_SERIAL_INVALID'), 'G3: short serial → SERIAL_INVALID')
  const r3b = GUARD.scanPaymentSigning('verifyPayment', { WXPAY_PRIVATE_KEY: pemPriv(genRsa()), WXPAY_SERIAL_NO: 'Z'.repeat(40) })
  ok(r3b.some((i) => i.reason === 'PAYMENT_SERIAL_INVALID'), 'G3b: non-hex 40 → SERIAL_INVALID')

  const r4 = GUARD.scanPaymentSigning('createOrder', { WXPAY_SERIAL_NO: MERCHANT_SERIAL })
  ok(r4.some((i) => i.reason === 'PAYMENT_PRIVATE_KEY_MISSING'), 'G4: missing key → MISSING')

  // payment-signing functions must not ship a committed key in config
  const cfg = { functions: [{ name: 'createOrder', envVariables: good }] }
  const ci = GUARD.scanConfig(cfg)
  ok(ci.some((i) => i.reason === 'COMMITTED_SECRET_VALUE'), 'G5: committed real key in config → blocked')
  ok(GUARD.isValidMerchantSerial(MERCHANT_SERIAL), 'G6: 3AF9 serial is valid 40-hex')
}

// ═══ S: merchant sign→verify with cert public key ═══
{
  const merchant = genRsa()
  const msg = ['GET', '/v3/pay/transactions/out-trade-no/XSG1?mchid=1747400090', '1700000000', 'abc123', ''].join('\n')
  const sig = signMessage(merchant.privateKey, msg)
  const good = crypto.createVerify('RSA-SHA256').update(msg).end().verify(merchant.publicKey, sig, 'base64')
  ok(good === true, 'S1: sign → verify with matching public key PASS')

  const other = genRsa()
  const bad = crypto.createVerify('RSA-SHA256').update(msg).end().verify(other.publicKey, sig, 'base64')
  ok(bad === false, 'S2: sign → verify with wrong public key FAIL')
}

// ═══ R: WeChat response verification (shared authority) ═══
function wechatEnv (kp, keyId) {
  return { WXPAY_PUBLIC_KEY: pemPub(kp), WXPAY_PUBLIC_KEY_ID: keyId }
}
{
  const wx = genRsa()
  const keyId = 'PUB_KEY_ID_TEST_0001'
  const env = wechatEnv(wx, keyId)
  const rawBody = JSON.stringify({ trade_state: 'SUCCESS', transaction_id: '4200001234567890123' })
  const ts = '1700000000', nonce = 'nonce1234567890'
  const message = ts + '\n' + nonce + '\n' + rawBody + '\n'
  const sig = signMessage(wx.privateKey, message)
  const hdrs = { 'Wechatpay-Timestamp': ts, 'Wechatpay-Nonce': nonce, 'Wechatpay-Signature': sig, 'Wechatpay-Serial': keyId }

  const r1 = AUTH.verifyResponseSignature(hdrs, rawBody, env)
  ok(r1.valid === true && r1.authorityType === 'PUBLIC_KEY', 'R1: valid signed response → accepted')

  const tampered = JSON.stringify({ trade_state: 'SUCCESS', transaction_id: 'MALLORY' })
  const r2 = AUTH.verifyResponseSignature(hdrs, tampered, env)
  ok(r2.valid === false && r2.reason === 'SIGNATURE_ERROR', 'R2: tampered body → signature FAIL')

  const wrongSerial = AUTH.verifyResponseSignature(Object.assign({}, hdrs, { 'Wechatpay-Serial': 'PUB_KEY_ID_OTHER' }), rawBody, env)
  ok(wrongSerial.valid === false && wrongSerial.reason === 'CERT_OR_KEY_NOT_FOUND', 'R3: wrong public-key-id → FAIL')

  const missing = AUTH.verifyResponseSignature({ 'Wechatpay-Timestamp': ts }, rawBody, env)
  ok(missing.valid === false && missing.reason === 'MISSING_HEADERS', 'R4: missing headers → FAIL')
}

// ═══ R5/R6: queryOrder (verifyPayment path) rejects unsigned provider response ═══
// Install a PERSISTENT axios stub for the whole async section (must stay active
// while the async queryOrder runs — restoring it in a sync helper would bypass it).
let __axiosResponse = null
const __origLoad = Module._load
Module._load = function (request) {
  if (request === 'axios') return async () => __axiosResponse
  return __origLoad.apply(this, arguments)
}
function loadPayment () {
  const PAY = path.join(ROOT, 'cloudfunctions', 'verifyPayment', 'lib', 'payment.js')
  const src = fs.readFileSync(PAY, 'utf8')
  process.env.WXPAY_MCHID = '1747400090'
  process.env.WXPAY_SERIAL_NO = MERCHANT_SERIAL
  process.env.WXPAY_PRIVATE_KEY = pemPriv(genRsa())
  const m = new Module(PAY, null)
  m.filename = PAY
  m.paths = Module._nodeModulePaths(path.dirname(PAY))
  m._compile(src, PAY)
  return m.exports
}
;(async () => {
  // unsigned 200 response → must be rejected (UNVERIFIED, success:false)
  __axiosResponse = {
    status: 200,
    headers: { 'wechatpay-nonce': 'x' }, // no signature headers
    data: JSON.stringify({ trade_state: 'SUCCESS', transaction_id: '4200001234567890123' }),
  }
  const q1 = await loadPayment().queryOrder('XSG1')
  ok(q1.success === false && q1.tradeState === 'UNVERIFIED' && q1.error === 'RESPONSE_SIGNATURE_INVALID', 'R5: unsigned provider response → rejected (fail-closed)')

  // valid signed response → accepted
  const wx = genRsa()
  const keyId = 'PUB_KEY_ID_TEST_0001'
  process.env.WXPAY_PUBLIC_KEY = pemPub(wx)
  process.env.WXPAY_PUBLIC_KEY_ID = keyId
  const rawBody = JSON.stringify({ trade_state: 'SUCCESS', transaction_id: '4200001234567890123' })
  const ts = Math.floor(Date.now() / 1000).toString(), nonce = 'nonceabcdef1234'
  const sig = signMessage(wx.privateKey, ts + '\n' + nonce + '\n' + rawBody + '\n')
  __axiosResponse = {
    status: 200,
    headers: {
      'wechatpay-timestamp': ts, 'wechatpay-nonce': nonce,
      'wechatpay-signature': sig, 'wechatpay-serial': keyId,
    },
    data: rawBody,
  }
  const q2 = await loadPayment().queryOrder('XSG1')
  ok(q2.success === true && q2.tradeState === 'SUCCESS' && q2.transactionId === '4200001234567890123', 'R6: correctly signed response → accepted')
  Module._load = __origLoad

  // ═══ C: callback decrypt (AEAD_AES_256_GCM, base64) ═══
  const apiV3Key = crypto.randomBytes(16).toString('hex') // 32 ascii chars = 32 bytes
  const gcmNonce = 'abcdefghijkl' // 12 bytes
  const aad = 'transaction'
  const plaintext = JSON.stringify({ out_trade_no: 'XSG1', transaction_id: '4200001234567890123', trade_state: 'SUCCESS', amount: { total: 3990 } })
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(gcmNonce, 'utf8'))
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const resource = { algorithm: 'AEAD_AES_256_GCM', ciphertext: Buffer.concat([enc, tag]).toString('base64'), nonce: gcmNonce, associated_data: aad }

  const d1 = AUTH.decryptResource(resource, apiV3Key)
  ok(d1 && d1.out_trade_no === 'XSG1' && d1.amount.total === 3990, 'C1: valid AEAD_AES_256_GCM (base64) → decrypt PASS')

  const d2 = AUTH.decryptResource(resource, crypto.randomBytes(16).toString('hex'))
  ok(d2 === null, 'C2: wrong apiV3 key → decrypt FAIL (null)')

  // chain: signature verify + decrypt
  const wx2 = genRsa()
  const keyId2 = 'PUB_KEY_ID_TEST_0002'
  const env2 = { WXPAY_PUBLIC_KEY: pemPub(wx2), WXPAY_PUBLIC_KEY_ID: keyId2 }
  const body2 = JSON.stringify({ resource_type: 'encrypt-resource', resource })
  const ts2 = Math.floor(Date.now() / 1000).toString(), n2 = 'nonce000011112222'
  const sig2 = signMessage(wx2.privateKey, ts2 + '\n' + n2 + '\n' + body2 + '\n')
  const v = AUTH.verifyResponseSignature({ 'Wechatpay-Timestamp': ts2, 'Wechatpay-Nonce': n2, 'Wechatpay-Signature': sig2, 'Wechatpay-Serial': keyId2 }, body2, env2)
  ok(v.valid === true, 'C3a: callback signature verify PASS')
  const parsed = JSON.parse(body2)
  const dec = AUTH.decryptResource(parsed.resource, apiV3Key)
  ok(dec && dec.trade_state === 'SUCCESS', 'C3b: verify + decrypt chain PASS')

  // tampered ciphertext → decrypt FAIL
  const badRes = Object.assign({}, resource, { ciphertext: Buffer.from('tampered').toString('base64') })
  ok(AUTH.decryptResource(badRes, apiV3Key) === null, 'C3c: tampered ciphertext → decrypt FAIL')

  // ═══ F: refundOrder fails closed ═══
  const REFUND = path.join(ROOT, 'cloudfunctions', 'refundOrder', 'index.js')
  const origLoad = Module._load
  let updates = []
  const paidOrder = { orderId: 'XSG_REF', openid: 'oUser', productId: 'challenge_39_9', type: 'single', relatedId: 'R1', totalAmount: 3990, status: 'paid', paidAt: Date.now() }
  const mkColl = (name) => ({
    where () { return this },
    limit () { return this },
    update (arg) { updates.push({ name, arg }); return Promise.resolve({ stats: { updated: 0 } }) },
    add (arg) { updates.push({ name, add: arg }); return Promise.resolve({ _id: 'x' }) },
    get () { return Promise.resolve({ data: name === 'orders' ? [paidOrder] : [] }) },
  })
  Module._load = function (request) {
    if (request === 'wx-server-sdk') {
      return {
        init () {},
        DYNAMIC_CURRENT_ENV: 'x',
        getWXContext () { return { OPENID: 'oUser' } },
        database () { return { collection: mkColl, command: { in: (x) => x } } },
      }
    }
    return origLoad.apply(this, arguments)
  }
  delete process.env.__WXPAY_REFUND_IMPLEMENTED
  delete process.env.WXPAY_MCHID
  const m2 = new Module(REFUND, null)
  m2.filename = REFUND
  m2.paths = Module._nodeModulePaths(path.dirname(REFUND))
  m2._compile(fs.readFileSync(REFUND, 'utf8'), REFUND)
  Module._load = origLoad
  const res = await m2.exports.main({ orderId: 'XSG_REF' })
  ok(res.code === -1 && /NOT_IMPLEMENTED|退款/.test(res.message), 'F1: refund fails closed (no fake success)')
  ok(!updates.some((u) => u.name === 'orders' && u.arg && u.arg.data && u.arg.data.status === 'refunded'), 'F2: no order marked refunded on disabled path')

  console.log(`PAYMENT_SIGNING_TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})()
