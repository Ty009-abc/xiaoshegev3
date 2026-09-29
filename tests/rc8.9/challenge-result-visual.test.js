#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/challenge-result-visual.test.js
 *
 * PAYMENT_STAGE5A_R9_CHALLENGE_RESULT_VISUAL_UPGRADE — deterministic checks.
 *
 * UI / render
 *   RAW_ENUM_NOT_VISIBLE, HERO_SECTION_PRESENT, RADAR_CHART_PRESENT,
 *   LEGACY_3X3_PRIMARY_LAYOUT_REMOVED, CORE_FEATURE_COUNT_MAX_8,
 *   CTA_TEXT = 查看我的世界模型报告, POSTER_ENTRY_ABSENT
 * Interaction
 *   CTA → canonical flow only; no payment/report authority side effect;
 *   animation classes do not affect static render
 * Regression
 *   result data / goReport / downstream report-preview navigation unchanged
 *
 * Logic + source-asset only. No network / DB / payment / device claim.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const RESULT_JS = path.join(ROOT, 'pages', 'challenge-result', 'challenge-result.js')
const RESULT_WXML = path.join(ROOT, 'pages', 'challenge-result', 'challenge-result.wxml')
const RESULT_WXSS = path.join(ROOT, 'pages', 'challenge-result', 'challenge-result.wxss')
const RADAR_JS = path.join(ROOT, 'utils', 'radarChart.js')
const TAGS_JS = path.join(ROOT, 'utils', 'worldModelTags.js')
const LABELS_JS = path.join(ROOT, 'utils', 'worldModelLabels.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE5A_R9_CHALLENGE_RESULT_VISUAL_UPGRADE')

const radar = require(RADAR_JS)
const tags = require(TAGS_JS)

// ── vm harness for the page ──
function loadResult (record) {
  const calls = []
  let page = null
  const sandbox = {
    Page: (c) => { page = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
    setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 0 },
    clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    wx: {
      navigateTo: (o) => calls.push({ m: 'navigateTo', url: o.url }),
      createSelectorQuery: () => ({ in: () => ({ select: () => ({ boundingClientRect: (cb) => ({ exec: () => cb(null) }) }) }) }),
      createCanvasContext: () => ({ beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {}, setStrokeStyle: () => {}, setLineWidth: () => {}, stroke: () => {}, setFontSize: () => {}, setFillStyle: () => {}, setTextAlign: () => {}, setTextBaseline: () => {}, fillText: () => {}, fill: () => {}, arc: () => {}, draw: () => {} }),
      getSystemInfoSync: () => ({ pixelRatio: 2 }),
      showToast: () => {},
    },
    getApp: () => ({ globalData: {} }),
  }
  sandbox.require = (req) => {
    if (req.indexOf('challengeService') >= 0) return { getChallengeRecord: async () => ({ code: 0, data: record }) }
    if (req.indexOf('analytics') >= 0) return { track: () => {}, flush: () => {} }
    if (req.indexOf('worldModelLabels') >= 0) return require(LABELS_JS)
    if (req.indexOf('worldModelTags') >= 0) return require(TAGS_JS)
    if (req.indexOf('radarChart') >= 0) return require(RADAR_JS)
    throw new Error('unexpected require: ' + req)
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(RESULT_JS, 'utf8'), sandbox, { filename: RESULT_JS })
  const inst = Object.assign({}, page)
  inst.data = JSON.parse(JSON.stringify(page.data || {}))
  inst.setData = function (o) { Object.assign(inst.data, o) }
  inst._calls = calls
  return inst
}

const RECORD = {
  recordId: 'CR1790632776226vtmih6', finalType: 'normal_awakened', scoringVersion: 'normalized_v2',
  scores: { laborMindset: 50, probabilityMindset: 90, systemThinking: 70, leverageThinking: 40, capitalThinking: 47, riskAwareness: 45, informationSensitivity: 65, longTermism: 47, decisionStability: 58 },
  tags: ['行动派', '低成本试错', '杠杆升级', '系统思维', '赌徒心态', '长期主义'],
}

;(async () => {
  const wxml = fs.readFileSync(RESULT_WXML, 'utf8')
  const wxss = fs.readFileSync(RESULT_WXSS, 'utf8')
  const js = fs.readFileSync(RESULT_JS, 'utf8')

  // ═══ UI / render ═══
  // RAW_ENUM_NOT_VISIBLE
  {
    const p = loadResult(RECORD)
    await p.load()
    eq(p.data.result.mainType, '普通觉醒型', 'A enum → Chinese label')
    ;['normal_awakened', 'strategic', 'effort_trap', 'high_risk', 'opportunity_hunter', 'system_thinker'].forEach((e) => {
      ok(wxml.indexOf(e) < 0, 'A WXML has no raw enum: ' + e)
    })
  }

  // HERO_SECTION_PRESENT
  {
    ok(/class="hero[ "]/i.test(wxml) || wxml.indexOf('class="hero ') >= 0, 'B hero section present')
    ok(wxml.indexOf('hero-sphere') >= 0, 'B hero visual sphere present')
    ok(wxml.indexOf('你的世界模型初步类型') >= 0, 'B hero subtitle present')
    ok(wxml.indexOf('class="hero-summary"') >= 0, 'B hero summary block present')
    ok(/\.hero-sphere|\.sphere-core/.test(wxss), 'B hero sphere styled')
    ok(/@keyframes spin/.test(wxss), 'B sphere animation defined')
  }

  // RADAR_CHART_PRESENT
  {
    ok(/<canvas[^>]*canvas-id="radarCanvas"/.test(wxml), 'C radar canvas present')
    ok(wxml.indexOf('九维认知画像') >= 0, 'C radar title present')
    ok(/drawRadar/.test(js), 'C page calls radar renderer')
    ok(radar.buildRadarData({ a: 1 }, ['a'], { a: 'X' }).length === 1, 'C radar builder works')
    // radar builds 9 dims
    eq(radar.buildRadarData(p0(), p1(), p2()).length, 9, 'C radar 9 dimensions')
    function p0 () { return { laborMindset: 10, probabilityMindset: 20, systemThinking: 30, leverageThinking: 40, capitalThinking: 50, riskAwareness: 60, informationSensitivity: 70, longTermism: 80, decisionStability: 90 } }
    function p1 () { return ['laborMindset', 'probabilityMindset', 'systemThinking', 'leverageThinking', 'capitalThinking', 'riskAwareness', 'informationSensitivity', 'longTermism', 'decisionStability'] }
    function p2 () { return { laborMindset: '劳动', probabilityMindset: '概率', systemThinking: '系统', leverageThinking: '杠杆', capitalThinking: '资本', riskAwareness: '风险', informationSensitivity: '信息', longTermism: '长期', decisionStability: '决策' } }
    // drawRadar is draw-safe on a stub ctx
    const stub = new Proxy({}, { get: () => () => {} })
    radar.drawRadar(stub, { width: 300, height: 300, data: radar.buildRadarData(p0(), p1(), p2()), progress: 0.5 })
    ok(true, 'C drawRadar does not throw on stub ctx')
  }

  // LEGACY_3X3_PRIMARY_LAYOUT_REMOVED
  {
    ok(wxml.indexOf('scores-grid') < 0, 'D legacy 3x3 grid removed from WXML')
    ok(wxml.indexOf('class="score"') < 0, 'D legacy score cell removed')
    ok(/radar-legend/.test(wxml), 'D compact legend retained (not a 3x3 primary grid)')
  }

  // CORE_FEATURE_COUNT_MAX_8
  {
    const p = loadResult(RECORD)
    await p.load()
    ok(p.data.result.coreTraits.length <= 8, 'E core features <= 8')
    eq(p.data.result.coreTraits.length, 6, 'E six tags kept')
    ok(wxml.indexOf('核心特征') >= 0, 'E heading 核心特征 present')
    ok(wxml.indexOf('trait-chip') >= 0, 'E premium trait chip styling present')
    ok(/\.trait-chip\s*\{/.test(wxss), 'E trait-chip class defined')
    ok(/rgba\(123,97,255/.test(wxss), 'E purple neon border token used')
  }

  // CTA_TEXT + POSTER_ENTRY_ABSENT
  {
    ok(wxml.indexOf('查看我的世界模型报告') >= 0, 'F CTA text = 查看我的世界模型报告')
    ok(/\.neon-cta/.test(wxss), 'F neon CTA styled')
    ok(/@keyframes breath/.test(wxss), 'F CTA breathing glow defined')
    ok(/neon-cta-hover/.test(wxml), 'F CTA press feedback wired')
    ok(wxml.indexOf('保存认知海报') < 0, 'G poster entry absent')
    ok(wxml.indexOf('goShare') < 0, 'G no goShare binding')
    ok(js.indexOf('goShare') < 0, 'G goShare handler absent')
    ok(js.indexOf('share-poster') < 0, 'G no share-poster navigation')
  }

  // ═══ Interaction ═══
  {
    const p = loadResult(RECORD)
    await p.load()
    p.setData({ recordId: RECORD.recordId })
    p._calls.length = 0
    p.goReport()
    eq(p._calls.length, 1, 'H CTA triggers exactly one navigation')
    eq(p._calls[0].m, 'navigateTo', 'H navigation via navigateTo')
    ok(p._calls[0].url.indexOf('/pages/report-preview/report-preview') >= 0, 'H navigates to canonical report-preview')
    ok(p._calls[0].url.indexOf('type=challenge_final') >= 0, 'H explicit challenge_final type')
    ok(p._calls[0].url.indexOf('recordId=CR1790632776226vtmih6') >= 0, 'H carries recordId')
    ok(!p._calls.some((c) => /membership|createOrder|pay/i.test(c.url || '')), 'H no payment/authority side effect')
    // animation classes are on the WXML, not required for static content
    ok(wxml.indexOf('anim-fade-up') >= 0, 'I animation class present')
    ok(wxml.indexOf('{{result.mainType') >= 0, 'I static content independent of animation')
  }

  // ═══ Regression ═══
  {
    const p = loadResult(RECORD)
    await p.load()
    eq(p.data.result.laborMindset, undefined, 'J no stray field')
    eq(p.data.result.profile.laborMindset, 50, 'J profile normalized')
    eq(p.data.result.profile.probabilityMindset, 90, 'J profile value intact')
    eq(p.data.result.scoringVersion, 'normalized_v2', 'J scoringVersion preserved')
    ok(p.data.result.summary.indexOf('概率') >= 0, 'J summary derived from data (概率最强)')
    ok(js.indexOf('/pages/report-preview/report-preview?recordId=') >= 0, 'J downstream report navigation unchanged')
    eq(p.data.dimKeys.length, 9, 'J nine dims bound for legend')
  }

  console.log(`\nchallenge-result-visual_TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
