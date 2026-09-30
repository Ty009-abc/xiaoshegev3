#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/bottom-actions-layout.test.js
 *
 * PAYMENT_STAGE5A_R10_1_BOTTOM_ACTIONS_LAYOUT_FIX — bottom action section layout.
 *
 * Root cause fixed: the challenge_final bottom action bar was rendered as a
 * viewport overlay (`position:fixed; bottom:0; z-index:900`) covering report
 * content. It must now live in NORMAL DOCUMENT FLOW, placed after CARD_05.
 *
 * Covers:
 *   STRUCTURE: ACTION_SECTION_AFTER_CARD_05, ACTION_SECTION_IN_NORMAL_FLOW,
 *              NO_FIXED_ACTION_BAR, NO_STICKY_ACTION_BAR, NO_CONTENT_OVERLAY,
 *              POSTER_BUTTON_PRESENT, RETRY_BUTTON_PRESENT
 *   REGRESSION: POSTER_HANDLER_UNCHANGED, RETRY_HANDLER_UNCHANGED,
 *               PAYMENT_LOGIC_UNCHANGED, ENTITLEMENT_LOGIC_UNCHANGED,
 *               REPORT_AUTHORITY_UNCHANGED, CARD_COUNT_EQ_5
 *   CSS: required metrics (width / padding / safe-area), button order + roles.
 *
 * Logic + source-asset only. No network / DB / payment / device claim.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const PREVIEW_JS = path.join(ROOT, 'pages', 'report-preview', 'report-preview.js')
const PREVIEW_WXML = path.join(ROOT, 'pages', 'report-preview', 'report-preview.wxml')
const PREVIEW_WXSS = path.join(ROOT, 'pages', 'report-preview', 'report-preview.wxss')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE5A_R10_1_BOTTOM_ACTIONS_LAYOUT_FIX — LAYOUT')

const wxml = fs.readFileSync(PREVIEW_WXML, 'utf8')
const wxss = fs.readFileSync(PREVIEW_WXSS, 'utf8')
const js = fs.readFileSync(PREVIEW_JS, 'utf8')

// isolate the challenge_final branch (poster/retry/action-bar live here)
const cfBlock = wxml.split('challenge_final 世界模型报告')[1] || ''

// the .action-bar rule block only (selector -> first closing brace)
const abBlock = (wxss.split('.action-bar {')[1] || '').split('}')[0]

// ── STRUCTURE · NO_FIXED_ACTION_BAR / NO_STICKY_ACTION_BAR / NO_CONTENT_OVERLAY ──
{
  ok(!!abBlock, '.action-bar rule present')
  ok(!/position\s*:\s*fixed/.test(abBlock), 'NO_FIXED_ACTION_BAR (no position:fixed)')
  ok(!/position\s*:\s*sticky/.test(abBlock), 'NO_STICKY_ACTION_BAR (no position:sticky)')
  ok(!/(^|[\s;])bottom\s*:/.test(abBlock), 'NO_BOTTOM_PINNING (no bottom:*)')
  ok(!/z-index/.test(abBlock), 'NO_CONTENT_OVERLAY (no z-index overlay)')
  ok(!/backdrop-filter/.test(abBlock), 'NO_OVERLAY_GLASS (no backdrop-filter)')
  ok(/position\s*:\s*static/.test(abBlock), 'ACTION_SECTION explicit position:static')
}

// ── STRUCTURE · ACTION_SECTION_AFTER_CARD_05 ──
{
  const card05Idx = cfBlock.indexOf('行动建议')
  const abIdx = cfBlock.indexOf('class="action-bar"')
  ok(card05Idx >= 0, 'CARD_05 (行动建议) present in cf branch')
  ok(abIdx >= 0, 'action-bar present in cf branch')
  ok(card05Idx >= 0 && abIdx > card05Idx, 'ACTION_SECTION_AFTER_CARD_05')
  // action-bar must be nested inside the paid report-blocks container (document flow)
  const rbIdx = cfBlock.indexOf('class="report-blocks"')
  ok(rbIdx >= 0 && rbIdx < abIdx, 'ACTION_SECTION_IN_NORMAL_FLOW (inside report-blocks flow)')
  // spacer after the action section
  const spacerIdx = cfBlock.indexOf('safe-area-spacer')
  ok(spacerIdx > abIdx, 'SAFE_AREA_SPACER after action section')
}

// ── STRUCTURE · POSTER_BUTTON_PRESENT / RETRY_BUTTON_PRESENT + ORDER ──
{
  ok(/act-primary[\s\S]*?generatePoster/.test(cfBlock), 'POSTER_BUTTON_PRESENT (bound to generatePoster)')
  ok(cfBlock.indexOf('生成认知海报') >= 0, 'POSTER button text = 生成认知海报')
  ok(/act-secondary[\s\S]*?onRetryChallenge/.test(cfBlock), 'RETRY_BUTTON_PRESENT (bound to onRetryChallenge)')
  ok(cfBlock.indexOf('重新挑战一次') >= 0, 'RETRY button text = 重新挑战一次')
  ok(cfBlock.indexOf('act-primary') < cfBlock.indexOf('act-secondary'), 'BUTTON_ORDER primary before secondary')
}

// ── CSS_REQUIRED metrics ──
{
  ok(/width\s*:\s*100%/.test(abBlock), 'action section width:100%')
  ok(/box-sizing\s*:\s*border-box/.test(abBlock), 'action section box-sizing:border-box')
  ok(/margin-top\s*:\s*(\d+)rpx/.test(abBlock), 'action section margin-top in rpx')
  ok(/padding-(left|right)\s*:\s*3[2-9]rpx|padding-(left|right)\s*:\s*40rpx/.test(abBlock), 'action section side padding 32-40rpx')
  ok(/padding-bottom\s*:\s*calc\(32rpx \+ env\(safe-area-inset-bottom\)\)/.test(abBlock), 'action section safe-area bottom padding')
  ok(/flex-direction\s*:\s*column/.test(abBlock), 'action section is vertical stack')

  const primary = (wxss.split('.act-primary {')[1] || '').split('}')[0]
  ok(/width\s*:\s*100%/.test(primary), 'primary width:100%')
  ok(/min-height\s*:\s*96rpx/.test(primary), 'primary min-height:96rpx')
  ok(/border-radius\s*:\s*48rpx/.test(primary), 'primary border-radius:48rpx')
  ok(/linear-gradient/.test(primary), 'primary uses gradient (purple->pink)')
  ok(/box-shadow/.test(primary), 'primary has controlled glow')

  const secondary = (wxss.split('.act-secondary {')[1] || '').split('}')[0]
  ok(/width\s*:\s*100%/.test(secondary), 'secondary width:100%')
  ok(/min-height\s*:\s*88rpx/.test(secondary), 'secondary min-height:88rpx')
  ok(/margin-top\s*:\s*2[0-9]rpx/.test(secondary), 'secondary margin-top 20-29rpx')
  ok(/border-radius\s*:\s*44rpx/.test(secondary), 'secondary border-radius:44rpx')
  ok(/border\s*:\s*1rpx solid/.test(secondary), 'secondary dark outline border')
  ok(!/linear-gradient/.test(secondary), 'secondary lower visual weight (no gradient)')
}

// ── no viewport overlay container anywhere in the action section ──
{
  ok(!/floating_action_bar/.test(wxss), 'no floating_action_bar class')
  ok(!/viewport_overlay/.test(wxss), 'no viewport_overlay container')
}

// ── REGRESSION · CARD_COUNT_EQ_5 ──
{
  const cards = (cfBlock.match(/class="section-card/g) || []).length
  eq(cards, 5, 'CARD_COUNT_EQ_5')
}

// ── REGRESSION · handlers untouched (source-level) ──
{
  ok(/generatePoster\s*\(/.test(js), 'POSTER_HANDLER_UNCHANGED (generatePoster present)')
  ok(/_generateWorldModelPoster\s*\(/.test(js), 'world-model poster impl present')
  ok(/onRetryChallenge\s*\(/.test(js), 'RETRY_HANDLER_UNCHANGED (onRetryChallenge present)')
  ok(/bind\s*:\s*'?unlock'?\s*:\s*'onGenerate'/.test(js) || js.indexOf('onGenerate') >= 0, 'unlock -> onGenerate unchanged')
  ok(js.indexOf('/pages/challenge-play/challenge-play') >= 0, 'retry target = challenge-play (R10.7 OPTION_C)')
  ok(js.indexOf('createOrder') < 0, 'PAYMENT_LOGIC_UNCHANGED (no createOrder)')
  ok(js.indexOf('verifyPayment') < 0, 'PAYMENT_LOGIC_UNCHANGED (no verifyPayment)')
  ok(js.indexOf('paymentFinalizer') < 0, 'PAYMENT_LOGIC_UNCHANGED (no paymentFinalizer)')
  ok(js.indexOf('/pages/report-detail') < 0, 'REPORT_AUTHORITY_UNCHANGED (no legacy report-detail)')
  ok(/locked:\s*\(d\.canViewFullReport === true\)/.test(js), 'REPORT_AUTHORITY_UNCHANGED (server canViewFullReport)')
}

// ── REGRESSION · ENTITLEMENT unchanged (no client-side entitlement mutation) ──
{
  ok(!/ENTITLEMENT\s*=/.test(js), 'no entitlement constant mutation')
  ok(!/grantEntitlement|setEntitlement/.test(js), 'ENTITLEMENT_LOGIC_UNCHANGED (no grant calls)')
}

// ── runtime: handlers still work after layout move ──
{
  function loadPreview () {
    const calls = []
    let page = null
    const sandbox = {
      require: (req) => {
        if (req.indexOf('aiReportService') >= 0) return { generateAiReport: async () => ({ code: 0, data: {} }) }
        if (req.indexOf('analytics') >= 0) return { track: () => {}, flush: () => {} }
        if (req.indexOf('worldModelPosterContent') >= 0) return require(path.join(ROOT, 'utils', 'worldModelPosterContent.js'))
        if (req.indexOf('worldModelPosterRenderer') >= 0) return require(path.join(ROOT, 'utils', 'worldModelPosterRenderer.js'))
        throw new Error('unexpected require: ' + req)
      },
      Page: (c) => { page = c },
      console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
      setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
      wx: {
        navigateTo: (o) => calls.push({ m: 'navigateTo', url: o.url }),
        redirectTo: (o) => calls.push({ m: 'redirectTo', url: o.url }),
        showModal: (o) => calls.push({ m: 'showModal', opt: o }),
        showToast: () => {}, showLoading: () => {}, hideLoading: () => {}, openSetting: () => {},
      },
      getApp: () => ({ globalData: {} }),
    }
    vm.createContext(sandbox)
    vm.runInContext(fs.readFileSync(PREVIEW_JS, 'utf8'), sandbox, { filename: PREVIEW_JS })
    const inst = Object.assign({}, page)
    inst.data = JSON.parse(JSON.stringify(page.data || {}))
    inst.setData = function (o) { Object.assign(inst.data, o) }
    inst._calls = calls
    return inst
  }

  const p = loadPreview()
  ok(typeof p.generatePoster === 'function', 'runtime: generatePoster is a function')
  ok(typeof p.onRetryChallenge === 'function', 'runtime: onRetryChallenge is a function')
  // challenge_final branch is the non-diagnostic path (default)
  eq(p.data.reportType === '' || p.data.reportType === 'challenge_final', true, 'runtime: default reportType is the non-diagnostic branch')
  p.setData({ reportType: 'challenge_final' })
  p.onRetryChallenge()
  const modal = p._calls.find((c) => c.m === 'showModal')
  ok(!!modal, 'runtime: retry confirm modal still shown')
  eq(modal.opt.title, '重新挑战一次？', 'runtime: retry modal title unchanged')
}

console.log(`\nbottom-actions-layout_TEST pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
