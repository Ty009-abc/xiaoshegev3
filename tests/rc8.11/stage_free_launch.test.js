#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.11/stage_free_launch.test.js
 *
 * RC8_12_FREE_LAUNCH_REVIEW_COMPLIANCE — FREE_ONLY launch invariants.
 *
 *  SALES   : FREE_ONLY blocks ALL virtual new sales (server authority);
 *            SALE_ENABLED still blocks only retired standalone SKUs.
 *  CLIENT  : no requestPayment / createOrder / membership purchase route /
 *            price copy / payment CTA on any reachable page (static scan).
 *  AI      : quota exhaustion → free-exhaustion state (no paid wall, no CTA).
 *  LEGACY  : report_9_9 / challenge_39_9 permanent sources still resolve.
 *  DEEP    : membership page exposes no purchase API (deep link cannot sell).
 *  PAYMENT : historical order/callback/verify pipeline remains intact.
 *
 * Node built-ins only. No network.
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..', '..')
const AA = require(path.join(ROOT, 'cloudfunctions', 'common', 'accessAuthority.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

function walk (dir, out) {
  out = out || []
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(js|wxml)$/.test(name)) out.push(p)
  }
  return out
}

console.log('RC8_12_FREE_LAUNCH review-compliance invariants')

;(async () => {
  // ── SALES: server FREE_ONLY authority ──
  {
    eq(AA.currentSalesMode({}), 'FREE_ONLY', 'default sales mode = FREE_ONLY (fail-closed)')
    const SKUS = ['vip_month_39_9', 'vip_year_299', 'vip_month_99', 'report_9_9', 'challenge_39_9']
    for (const pid of SKUS) {
      const d = AA.classifyVirtualNewSale({ productId: pid, type: 'membership' }, pid, {})
      ok(d.blocked === true, 'FREE_ONLY blocks new sale: ' + pid)
    }
    // SALE_ENABLED → only retired blocked
    ok(AA.classifyVirtualNewSale({ productId: 'vip_month_39_9', type: 'membership' }, 'vip_month_39_9', { RELEASE_SALES_MODE: 'SALE_ENABLED' }).blocked === false, 'SALE_ENABLED allows vip_month_39_9')
    ok(AA.classifyVirtualNewSale({ productId: 'report_9_9', type: 'one_time' }, 'report_9_9', { RELEASE_SALES_MODE: 'SALE_ENABLED' }).blocked === true, 'SALE_ENABLED still blocks retired report_9_9')
  }

  // ── SERVER: createOrder rejects new virtual sale under FREE_ONLY ──
  {
    const src = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'createOrder', 'index.js'), 'utf8')
    ok(/classifyVirtualNewSale/.test(src), 'createOrder uses FREE_ONLY classifier')
    ok(/currentSalesMode/.test(src), 'createOrder reads sales mode')
    // lib copy byte-identical to canonical
    const canon = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'common', 'accessAuthority.js'), 'utf8')
    const copy = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'createOrder', 'lib', 'accessAuthority.js'), 'utf8')
    ok(canon === copy, 'createOrder/lib/accessAuthority.js byte-identical to canonical')
  }

  // ── PAYMENT REGRESSION: historical pipeline handlers present & untouched ──
  {
    for (const fn of ['payCallback', 'verifyPayment', 'createOrder']) {
      const p = path.join(ROOT, 'cloudfunctions', fn, 'index.js')
      ok(fs.existsSync(p), 'payment function retained: ' + fn)
    }
    const vp = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'verifyPayment', 'index.js'), 'utf8')
    ok(/exports\.main/.test(vp), 'verifyPayment main intact (historical orders supported)')
  }

  // ── CLIENT: no payment surface reachable ──
  {
    const files = []
      .concat(walk(path.join(ROOT, 'pages')))
      .concat(walk(path.join(ROOT, 'subpkg-ai')))
      .concat(walk(path.join(ROOT, 'components')))
    const offenders = { requestPayment: [], createOrder: [], priceCopy: [], membershipRoute: [], productId: [] }
    for (const f of files) {
      const s = fs.readFileSync(f, 'utf8')
      const rel = path.relative(ROOT, f)
      // strip line comments for copy checks
      const noComment = s.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      if (/wx\.requestPayment|\.requestPayment\(/.test(noComment)) offenders.requestPayment.push(rel)
      if (/\bcreateOrder\b/.test(noComment)) offenders.createOrder.push(rel)
      if (/微信支付|立即支付|立即购买|开通月卡|开通年卡|购买会员|一次购买|限时优惠|超值年卡|¥\s*39\.9|¥\s*299|¥\s*9\.9|¥\s*99/.test(noComment)) offenders.priceCopy.push(rel)
      if (/pages\/membership\/membership/.test(noComment)) offenders.membershipRoute.push(rel)
      if (/(vip_month_39_9|vip_year_299|vip_month_99|report_9_9|challenge_39_9)/.test(noComment)) offenders.productId.push(rel)
    }
    eq(offenders.requestPayment.length, 0, 'no requestPayment in any client page/component')
    eq(offenders.createOrder.length, 0, 'no createOrder in any client page/component')
    eq(offenders.priceCopy.length, 0, 'no price/purchase copy in any client page/component')
    eq(offenders.membershipRoute.length, 0, 'no membership purchase route in any client page/component')
    eq(offenders.productId.length, 0, 'no purchasable productId in any client page/component')
  }

  // ── app.json: no dev payment probe / pay-modal ──
  {
    const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
    const flat = JSON.stringify(app)
    ok(flat.indexOf('dev-prepay-probe') < 0, 'app.json no dev prepay probe page')
    ok(flat.indexOf('pay-modal') < 0, 'app.json no pay-modal component')
  }

  // ── AI: free-exhaustion state, no paid wall ──
  {
    const js = fs.readFileSync(path.join(ROOT, 'pages', 'ai-chat', 'ai-chat.js'), 'utf8')
    const wxml = fs.readFileSync(path.join(ROOT, 'pages', 'ai-chat', 'ai-chat.wxml'), 'utf8')
    ok(/quotaExhausted/.test(js), 'AI quota-exhausted state handled')
    ok(/明天继续/.test(wxml), 'AI exhaustion primary action = 明天继续')
    ok(!/showPaywall/.test(js), 'AI no paywall flag')
    ok(wxml.indexOf('¥39.9') < 0 && wxml.indexOf('¥299') < 0, 'AI no price copy')
    ok(!/paywall\.offer/.test(wxml), 'AI no purchase offer block')
  }

  // ── LEGACY RIGHTS: permanent sources still resolve ──
  {
    const now = Date.now()
    const rep = AA.resolveAccess({ membership: null, sources: [{ productId: 'report_9_9', expiresAt: 0 }], report: null, now })
    ok(rep.report.allowed === true && rep.report.source === 'LEGACY_REPORT_9_9', 'legacy report_9_9 still resolves')
    const cha = AA.resolveAccess({ membership: null, sources: [{ productId: 'challenge_39_9', expiresAt: 0 }], report: null, now })
    ok(cha.challenge.allowed === true && cha.challenge.source === 'LEGACY_CHALLENGE_39_9', 'legacy challenge_39_9 still resolves')
    // active member keeps rights
    const mem = AA.resolveAccess({ membership: { status: 'active', expiredAt: 0, memberType: 'vip_year_299' }, sources: [], report: null, now })
    ok(mem.report.allowed === true && mem.challenge.allowed === true, 'active member keeps report+challenge rights')
  }

  // ── DEEP LINK: membership page exposes no purchase API ──
  {
    const mjs = fs.readFileSync(path.join(ROOT, 'pages', 'membership', 'membership.js'), 'utf8')
    ok(!/onPay/.test(mjs), 'membership page has no onPay')
    ok(!/onSelectPlan/.test(mjs), 'membership page has no plan selection')
    ok(!/createOrder/.test(mjs), 'membership page has no createOrder')
    ok(!/requestPayment/.test(mjs), 'membership page has no requestPayment')
  }

  console.log(`\nstage_free_launch_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
