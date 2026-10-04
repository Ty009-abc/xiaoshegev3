#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.13/client-wiring.test.js — RC8_13 PHASE_3 minimal client wiring guards.
 * Static contract checks (no network). Node built-ins only.
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.resolve(__dirname, '..', '..')
let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const svc = fs.readFileSync(path.join(ROOT, 'services/paymentService.js'), 'utf8')
const mem = fs.readFileSync(path.join(ROOT, 'pages/membership/membership.js'), 'utf8')

// ── A: service exposes the three virtual-pay functions ──
ok(/function createVirtualOrder\s*\(productId, jsCode\)/.test(svc), 'A service createVirtualOrder(productId, jsCode)')
ok(/call\('createVirtualOrder',\s*\{ productId, jsCode \}\)/.test(svc), 'A createVirtualOrder sends ONLY productId + jsCode')
ok(/function requestVirtualPayment\s*\(payload\)/.test(svc), 'A service requestVirtualPayment(payload)')
ok(/function verifyVirtualPayment\s*\(orderId\)/.test(svc), 'A service verifyVirtualPayment(orderId)')
ok(/createVirtualOrder,\s*\n\s*requestVirtualPayment,\s*\n\s*verifyVirtualPayment,/.test(svc), 'A exports all three')

// ── B: client does NOT send price / offerId / openid ──
ok(!/price\s*[:,]/.test(svc.split('function requestVirtualPayment')[0].split('createVirtualOrder')[1] || ''), 'B no price in createVirtualOrder payload')
ok(!/offerId/.test(svc.match(/function createVirtualOrder[\s\S]*?\n\}/)[0]), 'B no offerId in createVirtualOrder payload')
ok(!/openid/i.test(svc.match(/function createVirtualOrder[\s\S]*?\n\}/)[0]), 'B no openid in createVirtualOrder payload')

// ── C: signData passed byte-exact (no parse/stringify) in the invoke helper ──
const invokeBlock = svc.match(/function requestVirtualPayment[\s\S]*?\n\}/)[0]
ok(/signData,/.test(invokeBlock), 'C passes signData by reference')
ok(!/JSON\.parse\(\s*payload\.signData|JSON\.stringify\(/.test(invokeBlock), 'C no JSON.parse/stringify on signData')
ok(/wx\.requestVirtualPayment\(\{/.test(invokeBlock), 'C calls wx.requestVirtualPayment')

// ── D: membership page uses the virtual flow, no ordinary fallback ──
ok(/_payVirtual/.test(mem) && /createVirtualOrder/.test(mem), 'D membership calls createVirtualOrder')
ok(/requestVirtualPayment/.test(mem), 'D membership invokes requestVirtualPayment')
ok(/verifyVirtualPayment/.test(mem), 'D membership confirms via verifyVirtualPayment')
ok(/wx\.login\(\{/.test(mem), 'D membership obtains jsCode via wx.login')
ok(!/paymentService\.requestPayment\b/.test(mem), 'D NO ordinary requestPayment call in membership')
ok(!/paymentService\.createOrder\b/.test(mem), 'D NO ordinary createOrder call in membership')
ok(!/paymentService\.verifyPayment\b/.test(mem), 'D NO ordinary verifyPayment call in membership')
// no local entitlement grant
ok(!/setStorageSync\(['"]entitlements['"]\s*,/.test(mem), 'D membership does not locally grant entitlements')

// ── E: success is "verifying" only; poll server before granting ──
ok(/支付确认中/.test(mem), 'E client success shows verifying state')
ok(/_pollVirtual/.test(mem) && /verifyVirtualPayment\(orderId\)/.test(mem), 'E polls server authority before refresh')

// ── F: legacy service functions preserved ──
ok(/function createOrder\s*\(/.test(svc) && /function verifyPayment\s*\(/.test(svc) && /function requestPayment\s*\(/.test(svc), 'F legacy service functions intact')

console.log(`\nclient-wiring_TEST pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
