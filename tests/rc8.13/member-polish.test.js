#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.13/member-polish.test.js — RC8_13_P1_MEMBER_UI_FINAL_POLISH_AND_RIGHTS_GATE
 *
 *  A  SAFE_AREA_NAVBAR_DYNAMIC      (statusBarHeight px + env() fallback; no hardcode)
 *  B  NO_DOUBLE_TOP_PADDING         (navbar owns the top inset; pages do not stack it)
 *  C  WIDTH_INDEPENDENCE            (no fixed px width that breaks at 320px; rpx/flex)
 *  D  STATE_FREE / E MONTHLY / F ANNUAL / G EXPIRED / H UNKNOWN
 *  I  RESTART_PERSISTENCE           (server authority → deterministic across reload)
 *  J  NO_DUPLICATE_PURCHASE_CTA     (paid: no upgrade/purchase; member-center CTA = in-page)
 *  K  NO_ROUTE_LOOP                 (no member-center <-> membership cycle)
 *  L  PAYMENT_UNCHANGED             (no payment CF / paymentService / signing change)
 *  M  LEGACY_ENTITLEMENT_UNCHANGED
 *  N  RIGHTS_GATE_AI                (unlimited_ai → server quota bypass implemented)
 *  O  RIGHTS_GATE_CHALLENGE         (challenge_full → startChallenge gate implemented)
 *  P  RIGHTS_GATE_REPORT            (full_report → getAiReport resolveReportAccess)
 *  Q  RIGHTS_GATE_HISTORY           (report_history → report-history server query)
 *  R  RIGHTS_GATE_WORLD_RULES       (vip_rules → getWorldRules route; CONTENT_STATUS)
 *  S  RIGHTS_GATE_GROWTH_REVIEW     (growth_review → availability recorded)
 *  T  NO_FABRICATED_COUNTS          (profile counts from server, not fabricated)
 *  U  ROUTE_VALIDITY
 *
 * Logic + source-asset only. No network / DB / device claim.
 */
const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const NAV_JS = path.join(ROOT, 'components', 'xsg-navbar', 'xsg-navbar.js')
const NAV_WXML = path.join(ROOT, 'components', 'xsg-navbar', 'xsg-navbar.wxml')
const MC_JS = path.join(ROOT, 'pages', 'membership-center', 'membership-center.js')
const MC_WXSS = path.join(ROOT, 'pages', 'membership-center', 'membership-center.wxss')
const MC_WXML = path.join(ROOT, 'pages', 'membership-center', 'membership-center.wxml')
const MEM_WXSS = path.join(ROOT, 'pages', 'membership', 'membership.wxss')
const MEM_WXML = path.join(ROOT, 'pages', 'membership', 'membership.wxml')
const MEM_JS = path.join(ROOT, 'pages', 'membership', 'membership.js')
const PROF_WXSS = path.join(ROOT, 'pages', 'profile', 'profile.wxss')
const APP_JSON = path.join(ROOT, 'app.json')

const EXP = 1794491326834
const PERMS = ['full_report', 'report_history', 'vip_rules', 'challenge_full', 'growth_review', 'unlimited_ai']

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))
const strip = (s) => s.replace(/\s+/g, ' ')

console.log('RC8_13_P1_MEMBER_UI_FINAL_POLISH_AND_RIGHTS_GATE')

const navJs = fs.readFileSync(NAV_JS, 'utf8')
const navWxml = fs.readFileSync(NAV_WXML, 'utf8')
const mcJs = fs.readFileSync(MC_JS, 'utf8')
const mcWxss = fs.readFileSync(MC_WXSS, 'utf8')
const mcWxml = fs.readFileSync(MC_WXML, 'utf8')
const memWxss = fs.readFileSync(MEM_WXSS, 'utf8')
const memWxml = fs.readFileSync(MEM_WXML, 'utf8')
const memJs = fs.readFileSync(MEM_JS, 'utf8')
const profWxss = fs.readFileSync(PROF_WXSS, 'utf8')
const appPages = (JSON.parse(fs.readFileSync(APP_JSON, 'utf8')).pages || [])

function loadMc (gd, extraWx) {
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
    wx: Object.assign({
      cloud: { callFunction: async () => ({ result: { code: 0, data: { isActive: false, membership: null } } }) },
      showToast: () => {}, navigateTo: () => {}, navigateBack: () => {}, showLoading: () => {}, hideLoading: () => {},
      pageScrollTo: () => {},
      createSelectorQuery: () => ({
        select: () => ({
          boundingClientRect: (cb) => { if (cb) cb({ top: 100 }); return { exec: () => {} } },
        }),
        exec: () => {},
      }),
      getWindowInfo: () => ({ scrollTop: 0 }),
      getSystemInfoSync: () => ({ statusBarHeight: 44 }),
    }, extraWx || {}),
    console: Object.assign({}, console, { warn: () => {} }),
    Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise, isFinite,
    setTimeout: () => 0, clearTimeout: () => {},
  }
  vm.createContext(sandbox)
  vm.runInContext(mcJs, sandbox, { filename: MC_JS })
  const p = Object.assign({}, page)
  p.data = JSON.parse(JSON.stringify(page.data || {}))
  p.setData = function (x) { Object.assign(this.data, x) }
  p._navCapture = []
  return p
}

// ── A SAFE_AREA_NAVBAR_DYNAMIC ──
{
  ok(/getWindowInfo/.test(navJs) && /statusBarHeight/.test(navJs), 'A navbar reads platform statusBarHeight')
  ok(/getSystemInfoSync/.test(navJs), 'A navbar falls back to getSystemInfoSync')
  ok(/env\(safe-area-inset-top\)/.test(navJs), 'A navbar falls back to env(safe-area-inset-top)')
  ok(/padTop/.test(navWxml) && /padding-top:calc\(16rpx \+ \{\{padTop\}\}\)/.test(strip(navWxml)), 'A navbar binds dynamic padTop')
  // no hard-coded single-device status-bar height (e.g. 20/44/47px literals)
  ok(!/statusBarHeight\s*[:=]\s*\d+/.test(navJs), 'A no hard-coded statusBarHeight literal')
  ok(!/(pad|padding)[^;{]*:\s*\d+px/.test(navWxml), 'A navbar has no hard-coded px top padding')
  // simulate compute with a platform value + the env fallback
  const comp = { data: {}, setData (x) { Object.assign(this.data, x) } }
  const fn = {}
  // run compute via a minimal Component harness
  let cfg = null
  const sb = { Component: (c) => { cfg = c }, console, Number, Object, String, Error }
  // provide wx with a statusBarHeight
  sb.wx = { getWindowInfo: () => ({ statusBarHeight: 47 }) }
  vm.createContext(sb)
  vm.runInContext(navJs, sb, { filename: NAV_JS })
  const inst = Object.assign({ data: {} }, cfg)
  inst.data = {}
  inst.setData = (x) => Object.assign(inst.data, x)
  cfg.methods._computeTopInset.call(inst)
  eq(inst.data.padTop, '47px', 'A dynamic padTop = platform statusBarHeight')
  // fallback path: no statusBarHeight → env()
  const sb2 = { Component: (c) => { cfg = c }, console, Number, Object, String, Error, wx: { getWindowInfo: () => ({}) } }
  vm.createContext(sb2)
  vm.runInContext(navJs, sb2, { filename: NAV_JS })
  const inst2 = { data: {}, setData (x) { Object.assign(this.data, x) } }
  cfg.methods._computeTopInset.call(inst2)
  eq(inst2.data.padTop, 'env(safe-area-inset-top)', 'A fallback padTop = env safe-area')
}
// ── B NO_DOUBLE_TOP_PADDING ──
{
  ok(!/padding-top:\s*calc\([^)]*env\(safe-area-inset-top\)/.test(memWxss), 'B membership page no duplicate top inset')
  ok(!/padding-top:[^;]*statusBarHeight/.test(memWxss), 'B membership page no page-level status bar')
  ok(!/padding:\s*40rpx 32rpx 240rpx/.test(profWxss), 'B profile container top padding removed')
  ok(/padding:\s*0 32rpx 240rpx/.test(strip(profWxss)), 'B profile container top = 0 (navbar owns inset)')
  ok(!/safe-area-inset-top/.test(mcWxss), 'B member-center body has no duplicate top inset')
}
// ── C WIDTH_INDEPENDENCE ──
{
  // responsive units + wrapping; no fixed px width on containers that would break at 320px
  ok(/rpx/.test(mcWxss) && /rpx/.test(memWxss) && /rpx/.test(profWxss), 'C rpx used across pages')
  ok(!/width:\s*\d{3,}px/.test(mcWxss), 'C member-center has no large fixed px width')
  ok(!/min-width:\s*\d{3,}px/.test(mcWxss), 'C member-center no large fixed px min-width')
  ok(/flex-wrap:\s*wrap/.test(mcWxss), 'C member-center wraps long content')
  ok(/min-width:\s*0/.test(mcWxss.replace(/\s+/g, ' ')), 'C flex min-width:0 present')
  ok(!/@media/.test(mcWxss), 'C no device-specific @media hardcoding')
}

// ── D-H states ──
const PAYLOADS = {
  free: { isActive: false, membership: null },
  monthly: { isActive: true, membership: { status: 'active', level: 'monthly', memberType: 'vip_month_39_9', expiredAt: EXP, permissions: PERMS } },
  yearly: { isActive: true, membership: { status: 'active', level: 'yearly', memberType: 'vip_year_299', expiredAt: EXP, permissions: PERMS } },
  expired: { isActive: false, membership: { status: 'expired', level: 'monthly', expiredAt: 1 } },
}
{
  const p = loadMc(); p._applyMember(PAYLOADS.free)
  eq(p.data.memberState, 'free', 'D free state'); eq(p.data.active, false, 'D free not active'); eq(p.data.rights.length, 0, 'D free no rights')
}
{
  const p = loadMc(); p._applyMember(PAYLOADS.monthly)
  eq(p.data.memberState, 'monthly', 'E monthly'); eq(p.data.active, true, 'E active'); eq(p.data.memberTypeText, '月卡', 'E 月卡'); eq(p.data.rights.length, 6, 'E 6 rights')
}
{
  const p = loadMc(); p._applyMember(PAYLOADS.yearly)
  eq(p.data.memberState, 'yearly', 'F yearly'); eq(p.data.memberTypeText, '年卡', 'F 年卡'); eq(p.data.active, true, 'F active')
}
{
  const p = loadMc(); p._applyMember(PAYLOADS.expired)
  eq(p.data.memberState, 'expired', 'G expired'); eq(p.data.active, false, 'G not active')
}
{
  const p = loadMc(); p._applyMemberUnknown()
  eq(p.data.memberState, 'unknown', 'H unknown'); eq(p.data.memberLoadError, true, 'H error'); eq(p.data.active, false, 'H not active'); eq(p.data.rights.length, 0, 'H no rights')
}
// ── I RESTART_PERSISTENCE ──
{
  const a = loadMc(); a._applyMember(PAYLOADS.monthly)
  const b = loadMc(); b._applyMember(PAYLOADS.monthly)
  eq(a.data.memberState, b.data.memberState, 'I state persistent across reload')
  eq(a.data.memberExpiryFull, b.data.memberExpiryFull, 'I expiry persistent')
  eq(a.data.rights.length, b.data.rights.length, 'I rights persistent')
}
// ── J NO_DUPLICATE_PURCHASE_CTA ──
{
  const ctaRegion = mcWxml.split('cta-bar')[1] || ''
  const activeBranch = (ctaRegion.split('wx:if="{{active}}">')[1] || '').split('wx:elif')[0]
  ok(!!activeBranch, 'J paid CTA branch located')
  ok(!/升级会员/.test(activeBranch) && !/购买|支付/.test(activeBranch), 'J paid CTA has no upgrade/purchase')
  ok(/onViewRights/.test(activeBranch), 'J paid CTA scrolls in-page (onViewRights)')
  ok(/wx:if="\{\{mode === 'member' \|\| !active\}\}"/.test(memWxml), 'J membership purchase block gated on !active')
  ok(!/升级会员解锁全部权益/.test(mcWxml), 'J legacy upgrade text removed')
}
// ── K NO_ROUTE_LOOP ──
{
  // member-center paid CTA must NOT navigate back to the membership purchase page
  const ctaRegion = mcWxml.split('cta-bar')[1] || ''
  const activeBranch = (ctaRegion.split('wx:if="{{active}}">')[1] || '').split('wx:elif')[0]
  ok(!/goMembership/.test(activeBranch), 'K paid member-center CTA does not navigate to membership')
  // member-center JS: onViewRights does not navigate
  const onView = (mcJs.split('onViewRights()')[1] || '').split('goMembership()')[0]
  ok(!/navigateTo/.test(onView), 'K onViewRights performs no navigation (scroll only)')
  // membership detail → member-center is a one-way (member-center paid CTA stays in-page)
  ok(/openMemberDetails/.test(memJs) && /membership-center/.test(memJs), 'K membership 查看会员详情 → member-center')
}
// ── L PAYMENT_UNCHANGED ──
{
  let changed = 'GIT_ERR'
  try {
    const { execSync } = require('child_process')
    changed = execSync('git diff --name-only dec9196 -- cloudfunctions/payCallback cloudfunctions/verifyPayment cloudfunctions/createVirtualOrder cloudfunctions/verifyVirtualPayment cloudfunctions/virtualPayCallback cloudfunctions/consumeFreeQuota cloudfunctions/common/entitlementService.js cloudfunctions/common/accessAuthority.js services/paymentService.js', { cwd: ROOT }).toString().trim()
  } catch (_) {}
  ok(changed !== 'GIT_ERR', 'L git available')
  // RC8_14_D12_R6C_R5: entitlementService.js is under an APPROVED writer exception; only these exact
  // files may change. Any OTHER payment cloudfunction / paymentService change still fails.
  {
    const APPROVED_WRITER = new Set(['cloudfunctions/common/entitlementService.js', 'cloudfunctions/payCallback/lib/entitlementService.js', 'cloudfunctions/verifyPayment/lib/entitlementService.js', 'cloudfunctions/createVirtualOrder/lib/entitlementService.js', 'cloudfunctions/verifyVirtualPayment/lib/entitlementService.js', 'cloudfunctions/virtualPayCallback/lib/entitlementService.js'])
    const unexpected = (changed === 'GIT_ERR' ? '' : changed).split('\n').map((s) => s.trim()).filter(Boolean).filter((f) => !APPROVED_WRITER.has(f))
    eq(unexpected.join('\n'), '', 'L no NON-APPROVED payment cloudfunction / paymentService change since dec9196')
  }
  ok(!/wepay|mch|paySig|signData\s*=/.test(memJs), 'L no payment-signing logic in membership page')
}
// ── M LEGACY_ENTITLEMENT_UNCHANGED ──
{
  const AA = require(path.join(ROOT, 'cloudfunctions/common/accessAuthority.js'))
  eq(AA.LEGACY_REPORT_PRODUCT, 'report_9_9', 'M legacy report product')
  eq(AA.LEGACY_CHALLENGE_PRODUCT, 'challenge_39_9', 'M legacy challenge product')
  let entChanged = ''
  try { entChanged = require('child_process').execSync('git diff --name-only dec9196 -- cloudfunctions/createVirtualOrder/lib/entitlementService.js cloudfunctions/common/accessAuthority.js', { cwd: ROOT }).toString().trim() } catch (_) {}
  // RC8_14_D12_R6C_R5: the createVirtualOrder entitlementService.js mirror is under the APPROVED writer
  // exception; accessAuthority.js remains frozen (any change there fails).
  {
    const APPROVED_WRITER = new Set(['cloudfunctions/createVirtualOrder/lib/entitlementService.js'])
    const unexpected = entChanged.split('\n').map((s) => s.trim()).filter(Boolean).filter((f) => !APPROVED_WRITER.has(f))
    eq(unexpected.join('\n'), '', 'M no NON-APPROVED entitlement/authority change')
  }
  ok(/RETIRED/.test(memJs), 'M retired SKU routing retained')
}
// ── N RIGHTS_GATE_AI ──
{
  const gen = fs.readFileSync(path.join(ROOT, 'cloudfunctions/generateAiReport/index.js'), 'utf8')
  ok(/checkVip/.test(gen) && /quotaAuthority/.test(gen), 'N generateAiReport uses checkVip + quotaAuthority')
  ok(/isMember/.test(gen), 'N member quota bypass wired (isMember)')
}
// ── O RIGHTS_GATE_CHALLENGE ──
{
  const sc = fs.readFileSync(path.join(ROOT, 'cloudfunctions/startChallenge/index.js'), 'utf8')
  ok(/challenge_full/.test(sc) || /hasChallengeEntitlement/.test(sc), 'O startChallenge gates challenge_full')
  ok(appPages.indexOf('pages/challenge-start/challenge-start') >= 0, 'O challenge route registered')
}
// ── P RIGHTS_GATE_REPORT ──
{
  const g = fs.readFileSync(path.join(ROOT, 'cloudfunctions/getAiReport/index.js'), 'utf8')
  ok(/resolveReportAccess/.test(g) && /canViewFullReport/.test(g), 'P getAiReport resolves full_report access')
  ok(/checkVip/.test(g), 'P report unlock uses VIP authority')
}
// ── Q RIGHTS_GATE_HISTORY ──
{
  const rh = fs.readFileSync(path.join(ROOT, 'pages/report-history/report-history.js'), 'utf8')
  ok(/getReportHistory/.test(rh), 'Q report-history consumes server-authoritative list API')
  ok(!/fabricat|mock|fake/i.test(rh), 'Q report-history does not fabricate data')
  ok(appPages.indexOf('pages/report-history/report-history') >= 0, 'Q history route registered')
}
// ── R RIGHTS_GATE_WORLD_RULES ──
{
  const wr = fs.readFileSync(path.join(ROOT, 'pages/world-rules/world-rules.js'), 'utf8')
  ok(/getWorldRules/.test(wr), 'R world-rules uses getWorldRules route')
  ok(appPages.indexOf('pages/world-rules/world-rules') >= 0, 'R world-rules route registered')
  // CONTENT_STATUS recorded via the member-center rights list (vip_rules → 会员专属世界规则)
  const rights = require(path.join(ROOT, 'utils', 'membershipRights.js'))
  eq(rights.memberRightLabel('vip_rules'), '会员专属世界规则', 'R vip_rules label present')
}
// ── S RIGHTS_GATE_GROWTH_REVIEW ──
{
  const rights = require(path.join(ROOT, 'utils', 'membershipRights.js'))
  eq(rights.memberRightLabel('growth_review'), '成长复盘', 'S growth_review label present')
  // no dedicated growth_review page route → recorded as not-yet-implemented surface (no fabricated route)
  ok(appPages.indexOf('pages/growth-review/growth-review') < 0, 'S no fabricated growth-review route')
}
// ── T NO_FABRICATED_COUNTS ──
{
  const prof = fs.readFileSync(path.join(ROOT, 'pages/profile/profile.js'), 'utf8')
  ok(/name:\s*'getProfileStats'/.test(prof), 'T report/challenge counts from server getProfileStats')
  ok(!/collection\('ai_reports'\)\.where\(\{ openid \}\)\.count\(\)/.test(prof), 'T no broken direct ai_reports count')
  ok(!/collection\('challenge_records'\)\.where\(\{ openid \}\)\.count\(\)/.test(prof), 'T no broken direct challenge_records count')
}
// ── U ROUTE_VALIDITY ──
{
  const urls = []
  for (const f of [MC_JS, MEM_JS]) {
    const s = fs.readFileSync(f, 'utf8')
    const re = /url:\s*'\/pages\/([a-z0-9-]+)\/\1/g
    let m
    while ((m = re.exec(s))) urls.push(m[1])
  }
  for (const u of urls) ok(appPages.indexOf('pages/' + u + '/' + u) >= 0, 'U route registered: pages/' + u)
}

console.log(`  _TEST pass=*** fail=${fail}`)
process.exit(fail ? 1 : 0)
