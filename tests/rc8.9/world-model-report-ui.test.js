#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/world-model-report-ui.test.js
 *
 * PAYMENT_STAGE5A_R10_WORLD_MODEL_REPORT_PAGE_PRODUCTIZATION — report page UI.
 *
 * Covers:
 *   REPORT_HERO_PRESENT, HERO_FIELDS_BOUND (badge/title/conclusion/interpretation),
 *   REPORT_ACTION_BAR_PRESENT, PRIMARY_POSTER_BUTTON_PRESENT, RETRY_BUTTON_PRESENT,
 *   CONTENT_CARD_COUNT_EQ_5, LEGACY_HALF_DONE_ENTRY_REMOVED.
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

console.log('PAYMENT_STAGE5A_R10_WORLD_MODEL_REPORT_PAGE_PRODUCTIZATION — UI')

// ── load the page via vm ──
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

const wxml = fs.readFileSync(PREVIEW_WXML, 'utf8')
const wxss = fs.readFileSync(PREVIEW_WXSS, 'utf8')
const js = fs.readFileSync(PREVIEW_JS, 'utf8')
// isolate the challenge_final branch
const cfBlock = wxml.split('challenge_final 世界模型报告')[1] || ''

// ── REPORT_HERO_PRESENT + HERO_FIELDS_BOUND ──
{
  ok(/class="report-hero/.test(cfBlock), 'REPORT_HERO_PRESENT')
  ok(/rh-badge/.test(cfBlock) && cfBlock.indexOf('AI诊断') >= 0, 'HERO small badge = AI诊断')
  ok(/rh-title[^>]*>世界模型报告/.test(cfBlock), 'HERO page title = 世界模型报告')
  ok(/rh-conclusion[\s\S]{0,40}\{\{heroConclusion\}\}/.test(cfBlock), 'HERO core conclusion bound')
  ok(/rh-sub[\s\S]{0,40}\{\{heroInterpretation\}\}/.test(cfBlock), 'HERO one-line interpretation bound')
  ok(/\.rh-title\s*\{/.test(wxss) && /\.rh-conclusion\s*\{/.test(wxss), 'HERO styles defined')
  ok(/#A78BFA/.test(wxss), 'HERO emphasis uses purple')
}

// ── REPORT_ACTION_BAR_PRESENT + PRIMARY/RETRY buttons ──
{
  ok(/class="action-bar"/.test(cfBlock), 'REPORT_ACTION_BAR_PRESENT')
  ok(/act-primary[\s\S]*?generatePoster/.test(cfBlock), 'PRIMARY_POSTER_BUTTON_PRESENT (bound to generatePoster)')
  ok(cfBlock.indexOf('生成认知海报') >= 0, 'PRIMARY button text = 生成认知海报')
  ok(/act-secondary[\s\S]*?onRetryChallenge/.test(cfBlock), 'RETRY_BUTTON_PRESENT (bound to onRetryChallenge)')
  ok(cfBlock.indexOf('重新挑战一次') >= 0, 'RETRY button text = 重新挑战一次')
  ok(/posterGenerating \? '正在生成海报\.\.\.'/.test(cfBlock), 'poster loading text = 正在生成海报...')
  // primary first, secondary second
  ok(cfBlock.indexOf('act-primary') < cfBlock.indexOf('act-secondary'), 'primary rendered before secondary')
  ok(/\.action-bar\s*\{[\s\S]*env\(safe-area-inset-bottom\)/.test(wxss), 'action bar supports safe-area bottom')
  ok(/flex-direction:\s*column/.test(wxss.split('.action-bar')[1] || ''), 'action bar is a vertical stack')
}

// ── CONTENT_CARD_COUNT_EQ_5 ──
{
  const cards = (cfBlock.match(/class="section-card/g) || []).length
  eq(cards, 5, 'CONTENT_CARD_COUNT_EQ_5')
  ;['致命一句话', '核心问题', '系统困局', '翻身路径', '行动建议'].forEach((t) => {
    ok(cfBlock.indexOf(t) >= 0, 'card present: ' + t)
  })
  ok(/bg-red">01/.test(cfBlock), 'card 01 uses red coding')
}

// ── LEGACY_HALF_DONE_ENTRY_REMOVED ──
{
  ok(wxml.indexOf('保存认知海报') < 0, 'legacy 保存认知海报 removed')
  ok(wxml.indexOf('分享翻身概率') < 0, 'legacy 分享翻身概率 removed')
  ok(js.indexOf('分享翻身概率') < 0, 'legacy text removed from js')
}

// ── HERO runtime binding ──
{
  const p = loadPreview()
  p.setData({ cfSummaryText: '你的概率维度最强' })
  const n = { basicInsight: '认知已觉醒，杠杆未拉满', coreProblem: '资本化能力不足', systemTrap: '', turnaroundPath: '', actionAdvice: '', worldModelType: '普通觉醒型', turnaroundProbability: 72, threeYearRisk: '' }
  const interp = p._deriveHeroInterpretation(n)
  ok(interp && interp.length > 0, 'interpretation derived at runtime')
  ok(interp !== n.basicInsight, 'interpretation differs from conclusion')
  const n2 = { basicInsight: 'X', coreProblem: '', systemTrap: '', turnaroundPath: '', actionAdvice: '' }
  p.setData({ cfSummaryText: '' })
  eq(p._deriveHeroInterpretation(n2), '基于你的30天认知挑战、九维评分与行为标签生成', 'interpretation fallback (no AI)')
}

// ── poster preview markup present ──
{
  ok(/poster-mask/.test(cfBlock) && /showPoster/.test(cfBlock), 'poster preview overlay present')
  ok(/posterImageUrl/.test(cfBlock), 'poster image bound')
  ok(/bindtap="savePoster"/.test(cfBlock), 'poster save wired')
}

// ── no payment/authority side effects added ──
{
  ok(js.indexOf('createOrder') < 0, 'no createOrder in report-preview')
  ok(js.indexOf('verifyPayment') < 0, 'no verifyPayment in report-preview')
  ok(js.indexOf('paymentFinalizer') < 0, 'no paymentFinalizer in report-preview')
}

console.log(`\nworld-model-report-ui_TEST pass=*** fail=${fail}`)
process.exit(fail ? 1 : 0)
