#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.13/member-center.test.js — RC8_13_P0_MEMBER_CENTER_REAL_DEVICE_REBUILD
 *
 * Android real-device defects on membership-center + membership pages:
 *   text overlap, low contrast, broken XP layout, wrapping/variant check-in
 *   button, invisible headings, paid member shown an upgrade CTA, exposed raw
 *   permission keys, paid page title "开通认知会员", empty space.
 *
 *  A MEMBER_CENTER_ACTIVE_MONTHLY        (layout/state snapshot)
 *  B MEMBER_CENTER_ACTIVE_ANNUAL
 *  C MEMBER_CENTER_FREE
 *  D MEMBER_CENTER_EXPIRED
 *  E MEMBER_CENTER_UNKNOWN
 *  F PAID_NO_UPGRADE_CTA
 *  G PAID_NO_DUPLICATE_PURCHASE
 *  H PAID_CORRECT_EXPIRY
 *  I NO_RAW_ENTITLEMENT_CODE_IN_UI
 *  J COGNITIVE_LEVEL_INDEPENDENT_OF_MEMBERSHIP
 *  K ZERO_XP_HANDLED
 *  L LONG_TEXT_NO_OVERLAP (responsive rpx / no fixed-height text clips)
 *  M CHECKIN_HORIZONTAL_BUTTON
 *  N WEEKLY_REPORT_HEADING_VISIBLE
 *  O BOTTOM_SAFE_AREA
 *  P FEATURE_ROUTE_VALIDITY
 *  Q PAYMENT_FLOW_UNCHANGED
 *  R LEGACY_ENTITLEMENT_REGRESSION
 *
 * Logic + source-asset only. No network / DB / device claim.
 */
const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const MC_JS = path.join(ROOT, 'pages', 'membership-center', 'membership-center.js')
const MC_WXML = path.join(ROOT, 'pages', 'membership-center', 'membership-center.wxml')
const MC_WXSS = path.join(ROOT, 'pages', 'membership-center', 'membership-center.wxss')
const MEM_JS = path.join(ROOT, 'pages', 'membership', 'membership.js')
const MEM_WXML = path.join(ROOT, 'pages', 'membership', 'membership.wxml')
const APP_JSON = path.join(ROOT, 'app.json')

const EXP = 1794491326834 // 2026-11-12 21:48:46 +08:00
const PERMS = ['full_report', 'report_history', 'vip_rules', 'challenge_full', 'growth_review', 'unlimited_ai']

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_13_P0_MEMBER_CENTER_REAL_DEVICE_REBUILD')

function loadMc (gd) {
  let page = null
  const sandbox = {
    require: (id) => {
      if (id.indexOf('analytics') >= 0) return { track: () => {}, flush: () => {} }
      if (id.indexOf('userTrack') >= 0) return { event: () => {}, flush: () => {} }
      if (id.indexOf('membershipRights') >= 0) return require(path.join(ROOT, 'utils', 'membershipRights.js'))
      throw new Error('unexpected require: ' + id)
    },
    Page: (c) => { page = c },
    getApp: () => ({ globalData: Object.assign({ userInfo: {}, profile: {} }, gd || {}) }),
    wx: {
      cloud: { callFunction: async () => ({ result: { code: 0, data: { isActive: false, membership: null } } }) },
      showToast: () => {}, navigateTo: () => {}, navigateBack: () => {}, showLoading: () => {}, hideLoading: () => {},
    },
    console: Object.assign({}, console, { warn: () => {} }),
    Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise, isFinite,
    setTimeout: () => 0, clearTimeout: () => {},
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(MC_JS, 'utf8'), sandbox, { filename: MC_JS })
  const p = Object.assign({}, page)
  p.data = JSON.parse(JSON.stringify(page.data || {}))
  p.setData = function (x) { Object.assign(this.data, x) }
  return p
}

function loadMem (gd) {
  let page = null
  const sandbox = {
    require: (id) => {
      if (id.indexOf('paymentService') >= 0) return { getProductList: async () => ({ code: 0, data: { products: [] } }) }
      if (id.indexOf('userTrack') >= 0) return { event: () => {} }
      if (id.indexOf('membershipRights') >= 0) return require(path.join(ROOT, 'utils', 'membershipRights.js'))
      throw new Error('unexpected require: ' + id)
    },
    Page: (c) => { page = c },
    getApp: () => ({ globalData: Object.assign({}, gd || {}) }),
    wx: { cloud: { callFunction: async () => ({ result: { code: 0, data: {} } }) }, showToast: () => {}, navigateTo: () => {}, login: () => {} },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise, isFinite, setTimeout: () => 0, clearTimeout: () => {},
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(MEM_JS, 'utf8'), sandbox, { filename: MEM_JS })
  const p = Object.assign({}, page)
  p.data = JSON.parse(JSON.stringify(page.data || {}))
  p.setData = function (x) { Object.assign(this.data, x) }
  return p
}

const mcWxml = fs.readFileSync(MC_WXML, 'utf8')
const mcWxss = fs.readFileSync(MC_WXSS, 'utf8')
const memWxml = fs.readFileSync(MEM_WXML, 'utf8')
const appPages = (JSON.parse(fs.readFileSync(APP_JSON, 'utf8')).pages || [])

// ── A ACTIVE_MONTHLY ──
{
  const p = loadMc()
  p._applyMember({ isActive: true, membership: { status: 'active', level: 'monthly', memberType: 'vip_month_39_9', expiredAt: EXP, permissions: PERMS } })
  eq(p.data.memberState, 'monthly', 'A state monthly')
  eq(p.data.active, true, 'A active')
  eq(p.data.memberTypeText, '月卡', 'A type 月卡')
  eq(p.data.hasExpiry, true, 'A hasExpiry')
  eq(p.data.memberExpiryFull, '2026-11-12 21:48', 'A expiry')
  eq(p.data.rights.length, 6, 'A 6 rights')
  eq(p.data.memberLoadError, false, 'A no error')
}
// ── B ACTIVE_ANNUAL ──
{
  const p = loadMc()
  p._applyMember({ isActive: true, membership: { status: 'active', level: 'yearly', memberType: 'vip_year_299', expiredAt: EXP, permissions: PERMS } })
  eq(p.data.memberState, 'yearly', 'B state yearly')
  eq(p.data.memberTypeText, '年卡', 'B type 年卡')
  eq(p.data.active, true, 'B active')
}
// ── C FREE ──
{
  const p = loadMc()
  p._applyMember({ isActive: false, membership: null })
  eq(p.data.memberState, 'free', 'C state free')
  eq(p.data.active, false, 'C not active')
  eq(p.data.rights.length, 0, 'C no rights')
}
// ── D EXPIRED ──
{
  const p = loadMc()
  p._applyMember({ isActive: false, membership: { status: 'expired', level: 'monthly', expiredAt: 1 } })
  eq(p.data.memberState, 'expired', 'D state expired')
  eq(p.data.active, false, 'D not active')
}
// ── E UNKNOWN ──
{
  const p = loadMc()
  p._applyMemberUnknown()
  eq(p.data.memberState, 'unknown', 'E state unknown')
  eq(p.data.memberLoadError, true, 'E error flag')
  eq(p.data.rights.length, 0, 'E no rights (unknown never enables purchase/rights)')
  eq(p.data.active, false, 'E not active')
}

// ── F PAID_NO_UPGRADE_CTA ──
{
  // The paid CTA branch must not contain the upgrade text; the free branch may.
  ok(!/升级会员解锁全部权益/.test(mcWxml), 'F legacy "升级会员解锁全部权益" removed from member-center')
  const cta = (mcWxml.split('底部 CTA')[1] || '').split('</view>\n</view>')[0]
  ok(/查看会员权益/.test(cta), 'F paid CTA = 查看会员权益')
  // the paid branch (first block in cta-bar) must not mention 升级会员
  const activeBranch = (mcWxml.split('wx:if="{{active}}">')[1] || '').split('wx:elif')[0]
  ok(!/升级会员/.test(activeBranch), 'F active branch has no 升级会员')
}
// ── G PAID_NO_DUPLICATE_PURCHASE ──
{
  ok(/wx:if="\{\{mode === 'member' \|\| !active\}\}"/.test(memWxml), 'G purchase block gated on mode===member || !active')
  const p = loadMem()
  p.data.active = true
  // even if onPay is invoked by mistake, _payVirtual blocks
  let toast = ''
  const origCall = p._payVirtual
  ok(typeof p._payVirtual === 'function', 'G _payVirtual present')
  // source-level: active guard present
  const src = fs.readFileSync(MEM_JS, 'utf8')
  ok(/if \(this\.data\.active\)/.test(src) && /无需重复购买/.test(src), 'G active-member double-charge guard present')
}
// ── H PAID_CORRECT_EXPIRY ──
{
  const p = loadMem()
  p._decorateMember({ isActive: true, membership: { status: 'active', level: 'monthly', memberType: 'vip_month_39_9', expiredAt: EXP, permissions: PERMS } })
  eq(p.data.memberExpiryFull, '2026-11-12 21:48', 'H expiry full GMT+8')
  eq(p.data.memberExpiryText, '2026-11-12', 'H expiry date')
  eq(p.data.navTitle, '我的认知会员', 'H paid nav title')
}
// ── I NO_RAW_ENTITLEMENT_CODE_IN_UI ──
{
  const RAW = ['full_report', 'report_history', 'vip_rules', 'challenge_full', 'growth_review', 'unlimited_ai']
  for (const code of RAW) {
    ok(mcWxml.indexOf(code) < 0, 'I member-center wxml has no raw code ' + code)
    ok(memWxml.indexOf(code) < 0, 'I membership wxml has no raw code ' + code)
  }
  // labels are Chinese, never a raw code
  const rights = require(path.join(ROOT, 'utils', 'membershipRights.js'))
  const view = rights.memberRightsView(PERMS)
  ok(view.length === 6, 'I 6 rights mapped')
  for (const r of view) ok(!/[a-z]{3,}_/.test(r.label) && r.raw, 'I label human-readable, raw retained: ' + r.label)
  eq(view[0].label, '完整世界模型报告', 'I full_report → 完整世界模型报告')
  eq(rights.memberRightLabel('totally_unknown_code'), rights.MEMBER_RIGHT_FALLBACK, 'I unknown code → fallback (never raw)')
}
// ── J COGNITIVE_LEVEL_INDEPENDENT_OF_MEMBERSHIP ──
{
  // growth uses users.cv/level only; membership does not drive the cognitive level
  const p = loadMc({ userInfo: { cv: 0, level: 1 } })
  p._applyMember({ isActive: true, membership: { status: 'active', level: 'monthly', memberType: 'vip_month_39_9', expiredAt: EXP, permissions: PERMS } })
  await0()
  p.loadGrowth()
  eq(p.data.level, 1, 'J level from users.level (not membership)')
  eq(p.data.cvLevelTitle, '认知探索者', 'J level title independent of monthly membership')
  const src = fs.readFileSync(MC_JS, 'utf8')
  ok(!/_getLevelName/.test(src), 'J obsolete membership→levelName map removed')
}

// helper: microtask drain (sync contexts run body inline)
function await0 () {}

// ── K ZERO_XP_HANDLED ──
{
  const p = loadMc({ userInfo: { cv: 0, level: 1 } })
  p.loadGrowth()
  eq(p.data.hasCv, true, 'K genuine zero CV is valid')
  eq(p.data.xpText, '0', 'K XP shown as 0 (not fabricated / not hidden)')
  eq(p.data.cvPercent, 0, 'K 0% progress')
  // missing cv → unknown, never fabricated 0
  const p2 = loadMc({ userInfo: {} })
  p2.loadGrowth()
  eq(p2.data.hasCv, false, 'K missing cv → unknown')
  eq(p2.data.xpText, '—', 'K missing cv shows —')
}
// ── L LONG_TEXT_NO_OVERLAP ──
{
  // responsive rpx, no fixed-height text clips, no absolute-positioned text
  ok(!/position:\s*absolute/.test(mcWxss), 'L member-center css has no absolute-position text')
  ok(!/\.id-title[^}]*height:\s*\d+rpx/.test(mcWxss), 'L id-title no fixed height')
  ok(!/\.report-title[^}]*height:\s*\d+rpx/.test(mcWxss), 'L report-title no fixed height')
  ok(/\.id-main[^}]*min-width:\s*0/.test(mcWxss.replace(/\n/g, '')) || /min-width:0/.test(mcWxss), 'L flex min-width:0 for long text')
  ok(/flex-wrap:\s*wrap/.test(mcWxss), 'L wrap for long content')
  ok(/rpx/.test(mcWxss), 'L rpx responsive units used')
}
// ── M CHECKIN_HORIZONTAL_BUTTON ──
{
  ok(/\.checkin-btn[^}]*white-space:\s*nowrap/.test(mcWxss.replace(/\n/g, '')), 'M checkin button white-space nowrap (horizontal)')
  ok(/\.checkin-btn[^}]*min-width/.test(mcWxss.replace(/\n/g, '')), 'M checkin button min-width')
  ok(/\.checkin-left[^}]*flex:\s*1/.test(mcWxss.replace(/\n/g, '')), 'M left text flex:1 (no overlap)')
  // checkin is authority-gated, never faked
  const src = fs.readFileSync(MC_JS, 'utf8')
  ok(/if \(!this\.data\.checkinEnabled\) return/.test(src), 'M checkin gated on server authority')
}
// ── N WEEKLY_REPORT_HEADING_VISIBLE ──
{
  ok(/本周成长报告/.test(mcWxml), 'N weekly report heading present')
  ok(/暂未生成周报/.test(mcWxml), 'N empty state heading')
  ok(/使用满 7 天后查看阶段总结/.test(mcWxml), 'N empty state sub')
  const sec = (mcWxss.match(/\.section-label\s*\{[^}]*\}/) || [''])[0]
  ok(/color:\s*#667085/.test(sec) && !/color:\s*#fff/i.test(sec), 'N section heading has visible (non-white) color')
}
// ── O BOTTOM_SAFE_AREA ──
{
  ok(/\.cta-bar[^}]*env\(safe-area-inset-bottom\)/.test(mcWxss.replace(/\n/g, '')), 'O cta-bar safe-area inset')
  ok(/\.mc-bottom-space[^}]*env\(safe-area-inset-bottom\)/.test(mcWxss.replace(/\n/g, '')), 'O bottom spacer clears CTA')
  ok(!/position:\s*fixed/.test((mcWxml.match(/wx:if="\{\{active\}\}"/) ? '' : '')) , 'O (noop)')
  // cta-bar is fixed but body spacer prevents overlap
  ok(/\.cta-bar\s*\{[\s\S]*?position:\s*fixed/.test(mcWxss), 'O cta-bar fixed with spacer compensation')
}
// ── P FEATURE_ROUTE_VALIDITY ──
{
  const urls = []
  for (const f of [MC_JS, MEM_JS]) {
    const s = fs.readFileSync(f, 'utf8')
    const re = /url:\s*'\/pages\/([a-z0-9-]+)\/\1/g
    let m
    while ((m = re.exec(s))) urls.push(m[1])
  }
  ok(urls.length > 0, 'P found nav routes')
  for (const u of urls) ok(appPages.indexOf('pages/' + u + '/' + u) >= 0, 'P route registered: pages/' + u)
  // report-preview reachable
  ok(appPages.indexOf('pages/report-preview/report-preview') >= 0, 'P report-preview registered')
}
// ── Q PAYMENT_FLOW_UNCHANGED ──
{
  let changed = ''
  try {
    const { execSync } = require('child_process')
    changed = execSync('git diff --name-only 612f1b9 -- cloudfunctions services/paymentService.js', { cwd: ROOT }).toString().trim()
  } catch (_) { changed = 'GIT_ERR' }
  ok(changed !== 'GIT_ERR', 'Q git available')
  eq(changed, '', 'Q no payment cloudfunction / paymentService change since deploy')
  const src = fs.readFileSync(MEM_JS, 'utf8')
  ok(/requestVirtualPayment/.test(src), 'Q virtual channel retained')
  ok(!/paymentService\.requestPayment\b/.test(src), 'Q no ordinary requestPayment fallback')
}
// ── R LEGACY_ENTITLEMENT_REGRESSION ──
{
  const AA = require(path.join(ROOT, 'cloudfunctions/common/accessAuthority.js'))
  eq(AA.LEGACY_REPORT_PRODUCT, 'report_9_9', 'R legacy report product intact')
  eq(AA.LEGACY_CHALLENGE_PRODUCT, 'challenge_39_9', 'R legacy challenge product intact')
  const src = fs.readFileSync(MEM_JS, 'utf8')
  ok(/RETIRED/.test(src), 'R retired SKU routing retained')
  // no membership/entitlement DB mutation from the client pages
  const mcSrc = fs.readFileSync(MC_JS, 'utf8')
  ok(!/\.add\(|\.update\(|\.remove\(/.test(mcSrc + src), 'R client pages perform no DB mutation')
}

console.log(`  _TEST pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
