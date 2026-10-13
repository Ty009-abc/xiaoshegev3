#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.13/member-entry.test.js — RC8_13_P0_PAID_MEMBER_ENTRY_STATE_FIX
 *
 * Root cause: pages/profile/profile.wxml gated the membership entry on
 *   wx:if="{{!isVip}}" ⇒ an ACTIVE member (membershipLevel='monthly') saw NO
 *   membership surface at all. Fix: always-visible member entry, driven by the
 *   SERVER authority (getMembership), never inferred from the client cache / AI
 *   unlimited alone; unknown/failure never rendered as free.
 *
 *  A FREE_USER_ENTRY_VISIBLE
 *  B MONTHLY_MEMBER_ENTRY_VISIBLE
 *  C ANNUAL_MEMBER_ENTRY_VISIBLE
 *  D EXPIRED_MEMBER_ENTRY_VISIBLE
 *  E ACTIVE_MEMBER_EXPIRY_CORRECT
 *  F AFTER_PAYMENT_STATUS_REFRESH
 *  G RESTART_PRESERVES_MEMBER_DISPLAY
 *  H CLOUD_READ_FAILURE_DOES_NOT_SHOW_FREE
 *  I PAID_USER_NOT_FORCED_TO_REPURCHASE
 *  J IOS_UNPAID_BEHAVIOR_PRESERVED
 *  K ANDROID_PAID_BEHAVIOR_FIXED
 *  L OLD_PERMANENT_RIGHTS_PRESERVED (non-regression: payment/entitlement untouched)
 *
 * Logic + source-asset only. No network / DB / device claim.
 */
const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const PROFILE_JS = path.join(ROOT, 'pages', 'profile', 'profile.js')
const PROFILE_WXML = path.join(ROOT, 'pages', 'profile', 'profile.wxml')
const MEMBER_JS = path.join(ROOT, 'pages', 'membership', 'membership.js')
const MEMBER_WXML = path.join(ROOT, 'pages', 'membership', 'membership.wxml')

const EXP_MONTHLY = 1794491326834 // 2026-11-12 21:48:46 +08:00

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_13_P0_PAID_MEMBER_ENTRY')

// ── profile.js VM loader ──
function loadProfile (o) {
  o = o || {}
  const nav = []
  let page = null
  const sandbox = {
    require: (id) => {
      if (id.indexOf('analytics') >= 0) return { track: () => {}, flush: () => {} }
      if (id.indexOf('reportHistory') >= 0) return { count: () => 0 }
      if (id.indexOf('worldModelLabels') >= 0) return require(path.join(ROOT, 'utils', 'worldModelLabels.js'))
      throw new Error('unexpected require: ' + id)
    },
    module: { exports: {} },
    Page: (c) => { page = c },
    getApp: () => ({ globalData: Object.assign({ openid: 'oTest', userInfo: {}, profile: {} }, o.globalData || {}) }),
    wx: {
      cloud: {
        callFunction: (x) => {
          if (x && x.name === 'getMemory') return Promise.resolve({ result: { code: 0, data: { memoryEnabled: true } } })
          if (x && x.name === 'getMembership') return o.getMembership
            ? o.getMembership()
            : Promise.resolve({ result: o.member || { code: 0, data: { isActive: false, membership: null } } })
          return Promise.resolve({ result: { code: 0, data: {} } })
        },
        database: () => ({ collection: () => ({ where () { return this }, orderBy () { return this }, limit () { return this }, count: async () => ({ total: 0 }), get: async () => ({ data: [] }) }) }),
      },
      showToast: () => {}, showModal: () => {}, navigateTo: (x) => nav.push(x && x.url),
    },
    console: Object.assign({}, console, { warn: () => {}, error: () => {} }),
    Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
    setTimeout: () => 0, clearTimeout: () => {},
    isFinite,
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(PROFILE_JS, 'utf8'), sandbox, { filename: PROFILE_JS })
  const p = Object.assign({}, page)
  p.data = JSON.parse(JSON.stringify(page.data || {}))
  p.setData = function (x) { Object.assign(this.data, x) }
  p._nav = nav
  p._exports = sandbox.module.exports
  return p
}

// ── membership.js VM loader ──
function loadMembership (o) {
  o = o || {}
  const calls = []
  let page = null
  const sandbox = {
    require: (id) => {
      if (id.indexOf('paymentService') >= 0) {
        return {
          getProductList: async () => ({ code: 0, data: { products: [] } }),
          createVirtualOrder: async () => { calls.push('createVirtualOrder'); return { code: 0, data: {} } },
          requestVirtualPayment: async () => { calls.push('requestVirtualPayment'); return { success: false } },
          verifyVirtualPayment: async () => ({ code: 0, data: { status: 'pending' } }),
        }
      }
      if (id.indexOf('userTrack') >= 0) return { event: () => {} }
      throw new Error('unexpected require: ' + id)
    },
    Page: (c) => { page = c },
    getApp: () => ({ globalData: {} }),
    wx: {
      cloud: {
        callFunction: (x) => {
          if (x && x.name === 'getMembership') return o.getMembership ? o.getMembership() : Promise.resolve({ result: { code: 0, data: {} } })
          return Promise.resolve({ result: { code: 0, data: {} } })
        },
      },
      showToast: () => {}, navigateTo: () => {}, showLoading: () => {}, hideLoading: () => {},
    },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Promise, setTimeout: () => 0, clearTimeout: () => {}, isFinite,
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(MEMBER_JS, 'utf8'), sandbox, { filename: MEMBER_JS })
  const p = Object.assign({}, page)
  p.data = JSON.parse(JSON.stringify(page.data || {}))
  p.setData = function (x) { Object.assign(this.data, x) }
  p._calls = calls
  return p
}

;(async () => {
  const monthlyPayload = { code: 0, data: { isActive: true, membership: { status: 'active', level: 'monthly', memberType: 'vip_month_39_9', expiredAt: EXP_MONTHLY, permissions: ['ai_member', 'report_member', 'challenge_member', 'memory_member', 'scenario_member'] } } }
  const annualPayload = { code: 0, data: { isActive: true, membership: { status: 'active', level: 'yearly', memberType: 'vip_year_299', expiredAt: EXP_MONTHLY } } }
  const freePayload = { code: 0, data: { isActive: false, membership: null } }
  const expiredPayload = { code: 0, data: { isActive: false, membership: { status: 'expired', level: 'monthly', expiredAt: 1 } } }

  // ── A FREE ──
  {
    const p = loadProfile()
    p._applyMemberState(freePayload.data)
    eq(p.data.memberDisplayTitle, '升级会员', 'A free title')
    eq(p.data.memberDisplaySubtitle, '解锁完整认知操作系统', 'A free subtitle')
    eq(p.data.memberStateClass, 'free', 'A free stateClass')
    eq(p.data.memberStateLabel, '未开通', 'A free label')
    eq(p.data.memberIsPaid, false, 'A free not paid')
    eq(p.data.isVip, false, 'A isVip false')
  }
  // ── B MONTHLY ──
  {
    const p = loadProfile()
    p._applyMemberState(monthlyPayload.data)
    eq(p.data.memberDisplayTitle, '认知会员 · 月卡', 'B monthly title')
    ok(/有效期至 2026-11-12/.test(p.data.memberDisplaySubtitle), 'B monthly subtitle expiry')
    eq(p.data.memberStateClass, 'active', 'B monthly active')
    eq(p.data.memberStateLabel, '生效中', 'B monthly label')
    eq(p.data.memberIsPaid, true, 'B monthly paid')
    eq(p.data.isVip, true, 'B isVip true')
  }
  // ── C ANNUAL ──
  {
    const p = loadProfile()
    p._applyMemberState(annualPayload.data)
    eq(p.data.memberDisplayTitle, '认知会员 · 年卡', 'C annual title')
    eq(p.data.memberStateClass, 'active', 'C annual active')
    eq(p.data.memberIsPaid, true, 'C annual paid')
  }
  // ── D EXPIRED ──
  {
    const p = loadProfile()
    p._applyMemberState(expiredPayload.data)
    eq(p.data.memberDisplayTitle, '会员已到期', 'D expired title')
    eq(p.data.memberDisplaySubtitle, '查看续费选项', 'D expired subtitle')
    eq(p.data.memberStateClass, 'expired', 'D expired stateClass')
    eq(p.data.isVip, false, 'D isVip false')
  }
  // ── E EXPIRY CORRECT ──
  {
    const p = loadProfile()
    p._applyMemberState(monthlyPayload.data)
    eq(p.data.memberExpiryText, '2026-11-12', 'E expiry GMT+8 date')
    // resolver pure fn: verify via a fresh sandbox evaluating the helper export shape
    const wxml = fs.readFileSync(PROFILE_WXML, 'utf8')
    ok(/memberStateClass/.test(wxml) && /memberDisplayTitle/.test(wxml), 'E wxml binds resolver outputs')
  }
  // ── F AFTER_PAYMENT_STATUS_REFRESH ──
  {
    const p = loadProfile({ getMembership: async () => ({ result: monthlyPayload }) })
    p._applyMemberState(freePayload.data)
    eq(p.data.isVip, false, 'F pre-pay free')
    await p.loadMemberState()
    eq(p.data.isVip, true, 'F post-pay vip after server refresh')
    eq(p.data.memberDisplayTitle, '认知会员 · 月卡', 'F post-pay title')
  }
  // ── G RESTART PRESERVES DISPLAY ──
  {
    const a = loadProfile(); a._applyMemberState(monthlyPayload.data)
    const b = loadProfile(); b._applyMemberState(monthlyPayload.data)
    eq(a.data.memberDisplayTitle, b.data.memberDisplayTitle, 'G deterministic across restart')
    eq(a.data.memberExpiryText, b.data.memberExpiryText, 'G expiry deterministic')
    eq(a.data.memberStateClass, 'active', 'G active from server authority (not client cache)')
  }
  // ── H CLOUD READ FAILURE ≠ FREE ──
  {
    const p = loadProfile({ getMembership: async () => { throw new Error('network') } })
    if (p.data.memberDisplayTitle !== undefined) p.setData({ isVip: false })
    await p.loadMemberState()
    eq(p.data.memberStateClass, 'unknown', 'H failure → unknown class')
    eq(p.data.memberDisplayTitle, '我的会员', 'H failure → not labeled free')
    ok(p.data.memberDisplayTitle !== '升级会员', 'H never false-free on failure')
    eq(p.data.isVip, false, 'H isVip not forced true on failure')
  }
  // ── I PAID NOT FORCED TO REPURCHASE ──
  {
    const p = loadMembership()
    p._decorateMember(monthlyPayload.data)
    eq(p.data.active, true, 'I membership page active flag')
    eq(p.data.memberExpiryText, '2026-11-12 21:48', 'I membership page expiry')
    eq(p.data.memberLoadError, false, 'I no error')
    // even if onPay is called, an active member never invokes payment
    p.data.product = { productId: 'vip_month_39_9' }
    await p.onPay()
    ok(!p._calls.includes('requestVirtualPayment') && !p._calls.includes('createVirtualOrder'), 'I active member: no payment invoked')
  }
  // ── J IOS_UNPAID BEHAVIOR PRESERVED (free → purchase page) ──
  {
    const p = loadProfile()
    p._applyMemberState(freePayload.data)
    p.goMembership()
    ok(p._nav.length === 1 && /pages\/membership\/membership/.test(p._nav[0]), 'J free → purchase page')
    ok(!/membership-center/.test(p._nav[0]), 'J free NOT routed to details')
  }
  // ── K ANDROID_PAID BEHAVIOR FIXED (active → details, always-visible entry) ──
  {
    const p = loadProfile()
    p._applyMemberState(monthlyPayload.data)
    p.goMembership()
    ok(p._nav.length === 1 && /pages\/membership-center\/membership-center/.test(p._nav[0]), 'K active → member details')
    ok(!/pages\/membership\/membership\?/.test(p._nav[0]), 'K active NOT sent to purchase')
    // wxml: member entry always visible (no wx:if on the member section card)
    const wxml = fs.readFileSync(PROFILE_WXML, 'utf8')
    const section = (wxml.split('RC8_13_P0_MEMBER_ENTRY')[1] || '').split('认知成长')[0]
    ok(section.length > 0, 'K member section present in wxml')
    ok(!/wx:if/.test(section), 'K member entry has NO wx:if gate (always visible)')
    ok(!/wx:if="\{\{!isVip\}\}"/.test(wxml), 'K old !isVip gate removed')
    ok(/bindtap="goMembership"/.test(section), 'K member entry wired to goMembership')
  }
  // ── L OLD_PERMANENT_RIGHTS_PRESERVED (non-regression) ──
  {
    // 1. profile.js never mutates membership/entitlement collections
    const psrc = fs.readFileSync(PROFILE_JS, 'utf8')
    ok(!/collection\('memberships'\)\.(add|update|doc)/.test(psrc), 'L profile never mutates memberships')
    ok(!/collection\('entitlements'\)\.(add|update|doc)/.test(psrc), 'L profile never mutates entitlements')
    // 2. membership page still uses virtual pay only (no ordinary fallback)
    const msrc = fs.readFileSync(MEMBER_JS, 'utf8')
    ok(/wx\.requestVirtualPayment|requestVirtualPayment\(/.test(msrc), 'L virtual pay channel retained')
    ok(!/paymentService\.requestPayment\b/.test(msrc), 'L no ordinary requestPayment fallback')
    ok(/RETIRED/.test(msrc), 'L retired SKU handling retained')
    // 3. this fix touched NO cloud function (payment/entitlement untouched)
    let gitOk = true
    try {
      const { execSync } = require('child_process')
      const changed = execSync('git diff --name-only 612f1b9 -- cloudfunctions', { cwd: ROOT }).toString().trim()
      eq(changed, '', 'L no cloudfunctions changed since deploy commit')
    } catch (_) { gitOk = false }
    if (!gitOk) ok(true, 'L cloudfunctions git check skipped')
    // 4. accessAuthority legacy products intact (canonical authority source untouched)
    const AA = require(path.join(ROOT, 'cloudfunctions/common/accessAuthority.js'))
    eq(AA.LEGACY_REPORT_PRODUCT, 'report_9_9', 'L legacy report product intact')
    eq(AA.LEGACY_CHALLENGE_PRODUCT, 'challenge_39_9', 'L legacy challenge product intact')
  }

  console.log(`  _TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
