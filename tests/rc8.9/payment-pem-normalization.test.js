#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/payment-pem-normalization.test.js
 *
 * PAYMENT_STAGE4B — canonical PEM normalization + private-key type guard.
 *
 *  A  proper multiline PKCS#8 private key            → normalize + parse PASS
 *  B  literal "\\n" (escaped) private key             → PASS
 *  C  single-line space-flattened private key        → PASS (no spaces left in body)
 *  D  CRLF PEM                                        → PASS
 *  E  PUBLIC KEY in the private slot                  → FAIL CLOSED
 *  F  CERTIFICATE in the private slot                 → FAIL CLOSED
 *  G  malformed BEGIN/END label mismatch              → FAIL CLOSED
 *  H  invalid base64 body                             → FAIL CLOSED
 *  I  empty / missing key                             → FAIL CLOSED
 *  J  authoritative public fingerprint anchor = 624437be…  (+ format-insensitivity)
 *  K  production sign() output verifies with the key's own public half; wrong key = FAIL
 *  L  real cloud-env REPRESENTATION shape (single-line, space-flattened) → production
 *     normalization path succeeds structurally (no secret content involved)
 *
 * Node built-ins only. No network. No real key material embedded.
 */

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..', '..')
const AUTH = require(path.join(ROOT, 'cloudfunctions', 'createOrder', 'lib', 'paymentAuthority.js'))
const PAY = require(path.join(ROOT, 'cloudfunctions', 'createOrder', 'lib', 'payment.js'))

const AUTHORITATIVE_FP = '624437be66cd9b153c133752c71f2c2fa32ce95aafbb870a92b2033ca54bd92f'

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

console.log('PAYMENT_STAGE4B canonical PEM normalization')

// stable test fixtures (generated; no secret committed)
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' })       // -----BEGIN PRIVATE KEY-----
const PUB = publicKey.export({ type: 'spki', format: 'pem' })         // -----BEGIN PUBLIC KEY-----
const PUB_DER_B64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
const FAKE_CERT = '-----BEGIN CERTIFICATE-----\n' + (PUB_DER_B64.match(/.{1,64}/g).join('\n')) + '\n-----END CERTIFICATE-----\n'

const isPem = (s) => typeof s === 'string' && s.indexOf('-----BEGIN') === 0 && s.indexOf('-----END') > 0 && s.endsWith('-----\n')
const fpOf = (pem) => AUTH.derivePrivateKeyFingerprint(AUTH.normalizePem(pem))

// ── A: proper multiline PKCS#8 ──
{
  const n = AUTH.normalizePrivateKeyPem(PEM)
  ok(isPem(n), 'A1: multiline PKCS#8 normalizes to a PEM')
  ok(AUTH.normalizePrivateKeyPem(PEM).indexOf('BEGIN PRIVATE KEY') >= 0, 'A2: PRIVATE KEY label preserved')
  ok(n.split('\n').slice(1, -2).every((l) => l.length <= 64), 'A3: body wrapped <= 64 cols')
}

// ── B: literal "\n" escaped form ──
{
  const escaped = PEM.replace(/\n/g, '\\n')
  const n = AUTH.normalizePrivateKeyPem(escaped)
  ok(isPem(n), 'B1: literal \\\\n form normalizes')
  ok(fpOf(escaped) === fpOf(PEM), 'B2: escaped form → same fingerprint as normal PEM')
}

// ── C: single-line space-flattened (the Stage4A defect) ──
{
  const flat = PEM.trim().replace(/\n/g, ' ')
  const n = AUTH.normalizePrivateKeyPem(flat)
  ok(isPem(n), 'C1: space-flattened PEM normalizes')
  const bodyLines = n.split('\n').filter((l) => l && l.indexOf('-----') !== 0)
  ok(bodyLines.every((l) => !/\s/.test(l)), 'C2: no whitespace remains in the normalized base64 body')
  ok(fpOf(flat) === fpOf(PEM), 'C3: flattened → same fingerprint as normal PEM')
}

// ── D: CRLF ──
{
  const crlf = PEM.replace(/\n/g, '\r\n')
  ok(isPem(AUTH.normalizePrivateKeyPem(crlf)), 'D1: CRLF PEM normalizes')
  ok(fpOf(crlf) === fpOf(PEM), 'D2: CRLF → same fingerprint')
}

// ── E: PUBLIC KEY in the private slot → fail closed ──
{
  ok(AUTH.normalizePem(PUB).indexOf('BEGIN PUBLIC KEY') >= 0, 'E1: public key is structurally a PEM')
  ok(AUTH.normalizePrivateKeyPem(PUB) === '', 'E2: PUBLIC KEY rejected from private slot (fail closed)')
}

// ── F: CERTIFICATE in the private slot → fail closed ──
{
  ok(AUTH.normalizePem(FAKE_CERT).indexOf('BEGIN CERTIFICATE') >= 0, 'F1: cert is structurally a PEM')
  ok(AUTH.normalizePrivateKeyPem(FAKE_CERT) === '', 'F2: CERTIFICATE rejected from private slot (fail closed)')
}

// ── G: BEGIN/END label mismatch → fail closed ──
{
  const body = PEM.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const mismatch = '-----BEGIN PRIVATE KEY-----\n' + (body.match(/.{1,64}/g).join('\n')) + '\n-----END RSA PRIVATE KEY-----\n'
  ok(AUTH.normalizePem(mismatch) === '', 'G1: label mismatch → normalizePem fail closed')
  ok(AUTH.normalizePrivateKeyPem(mismatch) === '', 'G2: label mismatch → private guard fail closed')
}

// ── H: invalid base64 → fail closed ──
{
  const bad = '-----BEGIN PRIVATE KEY-----\n@@@not base64@@@\n-----END PRIVATE KEY-----\n'
  ok(AUTH.normalizePem(bad) === '', 'H1: invalid base64 → normalizePem fail closed')
}

// ── I: empty / missing → fail closed ──
{
  ok(AUTH.normalizePrivateKeyPem('') === '', 'I1: empty rejected')
  ok(AUTH.normalizePrivateKeyPem(null) === '', 'I2: null rejected')
  ok(AUTH.normalizePrivateKeyPem(undefined) === '', 'I3: undefined rejected')
  ok(AUTH.normalizePrivateKeyPem('just some text') === '', 'I4: arbitrary text rejected (no coercion)')
}

// ── J: authoritative fingerprint anchor + format-insensitivity ──
{
  const fixture = fs.readFileSync(path.join(ROOT, 'tests', 'rc8.9', 'fixtures', 'merchant_pub_3af9.pem'), 'utf8')
  ok(fpOf(fixture) === AUTHORITATIVE_FP, 'J1: committed merchant pub fixture fp == 624437be… (authoritative anchor)')
  // the same key material in three formats must normalize to the SAME fingerprint
  const flat = PEM.trim().replace(/\n/g, ' ')
  const esc = PEM.replace(/\n/g, '\\n')
  ok(fpOf(PEM) === fpOf(flat) && fpOf(flat) === fpOf(esc), 'J2: multiline == flattened == escaped fingerprint')
}

// ── K: production sign() → verify against own public half ──
{
  const normalized = AUTH.normalizePrivateKeyPem(PEM)
  const res = PAY.selfCheckSigning({
    WXPAY_PRIVATE_KEY: PEM.trim().replace(/\n/g, ' '),   // space-flattened input, exercises the full path
    WXPAY_MCHID: '1747400090',
    WXPAY_SERIAL_NO: '3AF9A0887378AAF102E498F9847AE76C4FEF9225',
  })
  ok(res.ok === true && res.verified === true, 'K1: production selfCheckSigning PASS on flattened key')
  ok(res.fingerprint === fpOf(normalized), 'K2: selfCheck fingerprint matches derived fingerprint')
  ok(typeof res.signatureLen === 'number' && res.signatureLen > 300, 'K3: RSA-2048 signature produced')
  // negative: signature must NOT verify with a DIFFERENT key
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const otherPub = other.publicKey.export({ type: 'spki', format: 'pem' })
  const headers = PAY.sign('POST', '/v3/pay/transactions/jsapi', { x: 1 }, '1747400090', 'SERIAL', normalized).Authorization
  const sig = /signature="([^"]+)"/.exec(headers)[1]
  const ts = /timestamp="([^"]+)"/.exec(headers)[1]
  const nonce = /nonce_str="([^"]+)"/.exec(headers)[1]
  const msg = ['POST', '/v3/pay/transactions/jsapi', ts, nonce, JSON.stringify({ x: 1 }) + '\n'].join('\n')
  const vOther = crypto.createVerify('RSA-SHA256'); vOther.update(msg); vOther.end()
  ok(vOther.verify(otherPub, sig, 'base64') === false, 'K4: signature does NOT verify with a different key (real crypto)')
}

// ── L: real cloud-env REPRESENTATION shape → normalization succeeds structurally ──
{
  // Mirrors the live env shape: ONE line, newlines replaced by spaces, no secret content.
  const shape = '-----BEGIN PRIVATE KEY----- ' +
    (privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64').match(/.{1,4}/g).join(' ')) +
    ' -----END PRIVATE KEY-----'
  ok(shape.indexOf('\n') === -1 && shape.indexOf(' ') > 0, 'L1: fixture is single-line space-flattened shape')
  const n = AUTH.normalizePrivateKeyPem(shape)
  ok(isPem(n), 'L2: cloud-env shape normalizes successfully (structural)')
  ok(n.split('\n').length > 3, 'L3: normalized into multi-line PEM')
}

console.log(`PAYMENT_PEM_NORMALIZATION_TEST pass=*** fail=${fail}`)
process.exit(fail ? 1 : 0)
