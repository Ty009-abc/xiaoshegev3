#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/bottom-whitespace.test.js
 *
 * PAYMENT_STAGE5A_R10_2_REPORT_PAGE_BOTTOM_WHITESPACE_FIX — bottom whitespace.
 *
 * Root cause fixed:
 *   WHITE_BLOCK  — app.wxss `page { background:#f4f5f7 }` (bright) plus
 *                  `page { padding-bottom: env(safe-area-inset-bottom) }` showed
 *                  a light band at the very bottom of this dark page.
 *   DARK_EMPTY   — `.page { min-height:100vh }` (viewport fill) plus a legacy
 *                  `.report-blocks { padding-bottom: calc(280rpx + safe-area) }`
 *                  fixed spacer left a large empty dark area after the buttons.
 *
 * Covers:
 *   STRUCTURE: NO_LARGE_BOTTOM_SPACER, NO_FIXED_VIEWPORT_HEIGHT,
 *              PAGE_BACKGROUND_CONTINUOUS, SAFE_AREA_BACKGROUND_MATCHES,
 *              ACTION_SECTION_LAST_CONTENT_BLOCK
 *   REGRESSION: POSTER_BUTTON_PRESENT, RETRY_BUTTON_PRESENT,
 *               POSTER_HANDLER_UNCHANGED, RETRY_HANDLER_UNCHANGED, CARD_COUNT_EQ_5,
 *               PAYMENT_LOGIC_UNCHANGED, ENTITLEMENT_LOGIC_UNCHANGED,
 *               REPORT_AUTHORITY_UNCHANGED
 *
 * Logic + source-asset only. No network / DB / payment / device claim.
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..', '..')
const PREVIEW_JS = path.join(ROOT, 'pages', 'report-preview', 'report-preview.js')
const PREVIEW_WXML = path.join(ROOT, 'pages', 'report-preview', 'report-preview.wxml')
const PREVIEW_WXSS = path.join(ROOT, 'pages', 'report-preview', 'report-preview.wxss')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE5A_R10_2_REPORT_PAGE_BOTTOM_WHITESPACE_FIX — WHITESPACE')

const wxml = fs.readFileSync(PREVIEW_WXML, 'utf8')
const wxss = fs.readFileSync(PREVIEW_WXSS, 'utf8')
const js = fs.readFileSync(PREVIEW_JS, 'utf8')

const cfBlock = wxml.split('challenge_final 世界模型报告')[1] || ''
const DARK = '#121620'

// rule block helpers: `selector {` -> up to first `}`
const rule = (sel) => (wxss.split(sel + ' {')[1] || '').split('}')[0]
const pageRule = rule('page')
const rootRule = rule('.page')
const blocksRule = rule('.report-blocks')
const abRule = rule('.action-bar')
const spacerRule = rule('.safe-area-spacer')

// ── STRUCTURE · NO_FIXED_VIEWPORT_HEIGHT ──
{
  ok(!/100vh/.test(wxss), 'NO 100vh anywhere')
  ok(!/calc\(\s*100vh/.test(wxss), 'NO calc(100vh - ...) anywhere')
  ok(/min-height\s*:\s*auto/.test(rootRule), 'page root min-height:auto (shrink to content)')
  ok(/height\s*:\s*auto/.test(rootRule), 'page root height:auto')
  ok(!/min-height\s*:\s*100vh/.test(wxss), 'no min-height:100vh')
  ok(!/min-height\s*:\s*100vh/.test(blocksRule), 'no min-height:100vh in blocks')
}

// ── STRUCTURE · NO_LARGE_BOTTOM_SPACER ──
{
  ok(!/280rpx/.test(wxss), 'legacy 280rpx bottom spacer removed')
  ok(!/180rpx/.test(wxss), 'legacy 180rpx bottom padding removed')
  ok(/padding\s*:\s*32rpx 32rpx 0\s*;?/.test(blocksRule), 'report-blocks bottom padding = 0 (no fixed filler)')
  // the safe-area spacer must not add artificial height
  ok(/display\s*:\s*none/.test(spacerRule) || !/height\s*:\s*[1-9]\d*rpx/.test(spacerRule), 'safe-area-spacer adds no fixed height')
  // no large fixed bottom padding/margin in the action section
  ok(!/padding-bottom\s*:\s*(1[0-9]{2,}|[2-9][0-9]{2,})rpx/.test(abRule), 'action section has no large fixed bottom padding')
  ok(/margin-bottom\s*:\s*0/.test(abRule), 'action section margin-bottom:0')
}

// ── STRUCTURE · PAGE_BACKGROUND_CONTINUOUS ──
{
  const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase()
  ok(norm(pageRule).indexOf(norm(DARK)) >= 0, 'app/global page background matches report dark bg')
  ok(norm(rootRule).indexOf(norm(DARK)) >= 0, '.page root background matches report dark bg')
  ok(wxss.indexOf('page {') >= 0, 'page-level background override present in this page wxss')
  ok(!/#f4f5f7|#f8f9fa|#ffffff|white/i.test(rootRule), 'page root is not white/light')
  // no default-white page background leaking on this scope
  ok(!/(^|\})\s*page\s*\{[^}]*#f4f5f7/.test(wxss), 'no bright page background for this scope')
}

// ── STRUCTURE · SAFE_AREA_BACKGROUND_MATCHES ──
{
  ok(/env\(safe-area-inset-bottom\)/.test(abRule), 'safe-area only applied via action section padding-bottom')
  ok(!/padding-bottom\s*:\s*calc\([^)]*env\(safe-area-inset-bottom\)[^)]*\)\s*;[\s\S]*padding-bottom\s*:\s*calc\([^)]*env/.test(wxss), 'safe-area not double-applied')
  // root page does not add its own safe-area band (background already continuous)
  ok(!/env\(safe-area-inset-bottom\)/.test(rootRule), 'page root adds no separate safe-area padding band')
  ok(!/env\(safe-area-inset-bottom\)/.test(pageRule), 'page selector adds no separate safe-area padding band')
}

// ── STRUCTURE · ACTION_SECTION_LAST_CONTENT_BLOCK ──
{
  const abIdx = cfBlock.indexOf('class="action-bar"')
  const card05 = cfBlock.indexOf('行动建议')
  const spacerIdx = cfBlock.indexOf('safe-area-spacer')
  ok(abIdx > card05 && card05 >= 0, 'action section is after CARD_05')
  ok(spacerIdx > abIdx, 'safe-area spacer after action section')
  // nothing content-bearing after the action section (only the spacer + closing tags)
  const afterAb = cfBlock.slice(abIdx)
  const contentAfter = (afterAb.match(/class="(section-card|report-blocks|report-hero|global-loading-bar)[^"]*"/g) || [])
  eq(contentAfter.length, 0, 'no content card/hero after the action section')
  // exactly one action-bar, one safe-area spacer
  eq((cfBlock.match(/class="action-bar"/g) || []).length, 1, 'exactly one action section')
  ok((cfBlock.match(/class="action-bar"/g) || []).length === 1, 'ACTION_SECTION_LAST_CONTENT_BLOCK (only bottom block)')
}

// ── REGRESSION ──
{
  ok(/act-primary[\s\S]*?generatePoster/.test(cfBlock), 'POSTER_BUTTON_PRESENT')
  ok(/act-secondary[\s\S]*?onRetryChallenge/.test(cfBlock), 'RETRY_BUTTON_PRESENT')
  ok(cfBlock.indexOf('生成认知海报') >= 0, 'poster text intact')
  ok(cfBlock.indexOf('重新挑战一次') >= 0, 'retry text intact')
  eq(((cfBlock.match(/class="section-card/g) || []).length), 5, 'CARD_COUNT_EQ_5')

  ok(/generatePoster\s*\(/.test(js), 'POSTER_HANDLER_UNCHANGED')
  ok(/onRetryChallenge\s*\(/.test(js), 'RETRY_HANDLER_UNCHANGED')
  ok(js.indexOf('/pages/challenge-play/challenge-play') >= 0, 'retry target = challenge-play (R10.7 OPTION_C)')
  ok(js.indexOf('createOrder') < 0, 'PAYMENT_LOGIC_UNCHANGED (no createOrder)')
  ok(js.indexOf('verifyPayment') < 0, 'PAYMENT_LOGIC_UNCHANGED (no verifyPayment)')
  ok(js.indexOf('paymentFinalizer') < 0, 'PAYMENT_LOGIC_UNCHANGED (no paymentFinalizer)')
  ok(!/grantEntitlement|setEntitlement/.test(js), 'ENTITLEMENT_LOGIC_UNCHANGED')
  ok(js.indexOf('/pages/report-detail') < 0, 'REPORT_AUTHORITY_UNCHANGED (no legacy route)')
  ok(/locked:\s*\(d\.canViewFullReport === true\)/.test(js), 'REPORT_AUTHORITY_UNCHANGED (server canViewFullReport)')
}

console.log(`\nbottom-whitespace_TEST pass=*** fail=${fail}`)
process.exit(fail ? 1 : 0)
