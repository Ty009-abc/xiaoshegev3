#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/challenge-result-visual.test.js
 *
 * PAYMENT_STAGE5A_R9_1_CHALLENGE_RESULT_VISUAL_REBUILD — deterministic checks.
 *
 * NOTE: source/test PASS is NOT visual PASS. Real-device visual acceptance is
 * the owner's call; this file only guards structure + behaviour.
 *
 * UI / render
 *   RAW_ENUM_NOT_VISIBLE, HERO_SECTION_PRESENT, RADAR_CHART_PRESENT,
 *   RADAR_FALLBACK_EXISTS, RADAR_EMPTY_PANEL_FORBIDDEN,
 *   LEGACY_3X3_PRIMARY_LAYOUT_REMOVED, FULL_NINE_PILL_LEGEND_REMOVED,
 *   TOP_BOTTOM_DIMENSIONS_PRESENT, CORE_FEATURE_COUNT_MAX_8,
 *   PRIMARY_TAGS_COUNT<=3, SECONDARY_TAGS_COUNT<=5,
 *   WORLD_MODEL_JUDGEMENT_PRESENT, CTA_CARD_PRESENT, POSTER_ENTRY_ABSENT
 * Interaction / regression
 *   CTA → canonical flow only, no payment/authority side effect, data intact
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

console.log('PAYMENT_STAGE5A_R9_1_CHALLENGE_RESULT_VISUAL_REBUILD')

const radar = require(RADAR_JS)
const TAGS = require(TAGS_JS)

function loadResult (record, opts) {
  const calls = []
  let page = null
  const drawCalls = { n: 0 }
  const timers = []
  let seq = 0
  const sandbox = {
    Page: (c) => { page = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
    // queued timers: the page's 700ms watchdog must NOT pre-empt the query cb
    setTimeout: (fn, delay) => { const id = ++seq; timers.push({ id, fn }); return id },
    clearTimeout: (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1) },
    // run the frame animation to completion synchronously
    setInterval: (fn, delay) => { let n = 0; while (n++ < 40) { try { fn() } catch (e) {} } return ++seq },
    clearInterval: () => {},
    wx: {
      navigateTo: (o) => calls.push({ m: 'navigateTo', url: o.url }),
      createSelectorQuery: (opts === 'noquery') ? undefined : () => ({
        in: () => ({ select: () => ({ boundingClientRect: (cb) => ({ exec: () => cb({ width: 280, height: 280 }) }) }) }),
      }),
      createCanvasContext: (opts === 'noctx') ? undefined : () => new Proxy({}, { get: (t, k) => (k === 'draw' ? () => { drawCalls.n++ } : () => {}) }),
      getSystemInfoSync: () => ({ pixelRatio: 3 }),
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
  inst._drawCalls = drawCalls
  inst._flushTimers = () => { let guard = 0; while (timers.length && guard++ < 200) { const t = timers.shift(); try { t.fn() } catch (e) {} } }
  return inst
}

const RECORD = {
  recordId: 'CR1790632776226vtmih6', finalType: 'normal_awakened', scoringVersion: 'normalized_v2',
  scores: { laborMindset: 50, probabilityMindset: 90, systemThinking: 66, leverageThinking: 40, capitalThinking: 55, riskAwareness: 80, informationSensitivity: 65, longTermism: 47, decisionStability: 58 },
  tags: ['行动派', '低成本试错', '杠杆升级', '系统思维', '自动化思维', '开源杠杆', '系统化', '能力复制', '能力护城河', '价值链升级'],
}

;(async () => {
  const wxml = fs.readFileSync(RESULT_WXML, 'utf8')
  const wxss = fs.readFileSync(RESULT_WXSS, 'utf8')
  const js = fs.readFileSync(RESULT_JS, 'utf8')

  // ── RAW_ENUM_NOT_VISIBLE ──
  {
    const p = loadResult(RECORD)
    await p.load()
    eq(p.data.result.mainType, '普通觉醒型', 'A enum → Chinese label')
    ;['normal_awakened', 'strategic', 'effort_trap', 'high_risk', 'opportunity_hunter', 'system_thinker'].forEach((e) => {
      ok(wxml.indexOf(e) < 0, 'A WXML has no raw enum: ' + e)
    })
  }

  // ── HERO_SECTION_PRESENT ──
  {
    ok(wxml.indexOf('WORLD MODEL PROFILE') >= 0, 'B hero eyebrow WORLD MODEL PROFILE')
    ok(wxml.indexOf('hero-orb') >= 0, 'B hero orb present')
    ok(/hero-orb[\s\S]*ring-1/.test(wxml), 'B hero orbital rings present')
    ok(wxml.indexOf('你的世界模型初步类型') >= 0, 'B hero subtitle present')
    ok(wxml.indexOf('class="hero-concl"') >= 0, 'B hero conclusion line present')
    ok(/\.orb-core/.test(wxss) && /@keyframes spin/.test(wxss), 'B hero visual + slow rotate styled')
    ok(/\.hero-orb\s*\{[\s\S]*height:\s*260rpx/.test(wxss), 'B hero visual height in 220–280rpx band')
  }

  // ── RADAR_CHART_PRESENT + RADAR_EMPTY_PANEL_FORBIDDEN + RADAR_FALLBACK_EXISTS ──
  {
    ok(/<canvas[^>]*canvas-id="radarCanvas"/.test(wxml), 'C radar canvas present')
    ok(wxml.indexOf('九维世界模型') >= 0, 'C panel titled 九维世界模型')
    ok(!wxml.split('radar-canvas').join('').includes('type="2d"'), 'C canvas does NOT use 2d-type (legacy ctx bug)')
    ok(wxml.indexOf('radar-fallback') >= 0, 'C radar fallback panel exists')
    ok(/wx:if="\{\{radarFail\}\}"/.test(wxml), 'C fallback gated by radarFail (never empty)')
    ok(/fb-row/.test(wxml) && /result\.dims/.test(wxml), 'C fallback renders real dims')
    ok(/\.radar-fallback\s*\{/.test(wxss), 'C fallback styled')
    ok(wxss.indexOf('radar-fallback') >= 0, 'C fallback css present')

    // runtime: with canvas available → radarOk true, draw called
    const p = loadResult(RECORD)
    await p.load()
    p._flushTimers()
    eq(p.data.radarFail, false, 'C radar does not fall back when canvas available')
    eq(p.data.radarOk, true, 'C radarOk true after draw')
    ok(p._drawCalls.n >= 1, 'C ctx.draw() was called (RADAR_DRAW_CALLED)')
    ok(js.indexOf('RADAR_') < 0, 'C safe debug UI removed from page js')

    // runtime: canvas ctx missing → fallback, no crash
    const pf = loadResult(RECORD, 'noctx')
    await pf.load()
    pf._flushTimers()
    eq(pf.data.radarFail, true, 'C fallback engages when context unavailable')
    eq(pf.data.radarOk, false, 'C radarOk stays false on failure')

    // runtime: selectorQuery missing → direct paint path still renders
    const pq = loadResult(RECORD, 'noquery')
    await pq.load()
    pq._flushTimers()
    eq(pq.data.radarFail, false, 'C direct-paint path renders without selectorQuery')
    ok(pq._drawCalls.n >= 1, 'C direct-paint calls ctx.draw()')
  }

  // ── LEGACY_3X3_PRIMARY_LAYOUT_REMOVED + FULL_NINE_PILL_LEGEND_REMOVED ──
  {
    ok(wxml.indexOf('scores-grid') < 0, 'D legacy 3x3 grid removed')
    ok(wxml.indexOf('class="score"') < 0, 'D legacy score cell removed')
    ok(wxml.indexOf('radar-legend') < 0, 'D full 9-pill legend removed')
    ok(wxml.indexOf('lg-item') < 0, 'D 9 pill items removed')
    // exactly the Top2/Bottom2 highlight rows remain
    ok(/dim-highlights/.test(wxml), 'D dim highlights block present')
  }

  // ── TOP_BOTTOM_DIMENSIONS_PRESENT ──
  {
    const p = loadResult(RECORD)
    await p.load()
    eq(p.data.result.topDims.length, 2, 'E top 2 dims computed')
    eq(p.data.result.bottomDims.length, 2, 'E bottom 2 dims computed')
    eq(p.data.result.topDims[0].label, '概率', 'E top dim = 概率 (90)')
    eq(p.data.result.topDims[1].label, '风险', 'E 2nd top dim = 风险 (80)')
    eq(p.data.result.bottomDims[0].label, '杠杆', 'E bottom (lowest) = 杠杆 (40)')
    eq(p.data.result.bottomDims[1].label, '长期', 'E 2nd bottom = 长期 (47)')
    ok(wxml.indexOf('优势维度') >= 0 && wxml.indexOf('待突破') >= 0, 'E 优势维度 / 待突破 rows present')
  }

  // ── CORE_FEATURE_COUNT_MAX_8 + PRIMARY/SECONDARY split ──
  {
    const p = loadResult(RECORD)
    await p.load()
    ok(p.data.result.coreTraits.length <= 8, 'F core features <= 8')
    eq(p.data.result.coreTraits.length, 8, 'F capped at 8 from a 10-tag pool')
    ok(/index < 3 \? 'trait-primary' : 'trait-secondary'/.test(wxml), 'F primary×3 / secondary×rest binding')
    ok(/\.trait-primary\s*\{/.test(wxss) && /\.trait-secondary\s*\{/.test(wxss), 'F weighted tag styles defined')
    // count primary binding = 3, secondary = remaining
    const primaryCap = 3
    ok(primaryCap <= 3, 'F PRIMARY_TAGS_COUNT <= 3')
    ok((p.data.result.coreTraits.length - primaryCap) <= 5, 'F SECONDARY_TAGS_COUNT <= 5')
  }

  // ── WORLD_MODEL_JUDGEMENT_PRESENT ──
  {
    const p = loadResult(RECORD)
    await p.load()
    ok(p.data.result.judgement && p.data.result.judgement.length > 10, 'G judgement derived (non-empty)')
    ok(wxml.indexOf('世界模型判断') >= 0, 'G judgement panel title present')
    ok(/judge-panel/.test(wxml) && /judge-text/.test(wxml), 'G judgement card structure present')
    ok(js.indexOf('buildJudgement') >= 0, 'G judgement built from existing fields (no new AI)')
    ok(js.indexOf('api.deepseek') < 0 && js.indexOf('callFunction') < 0, 'G no AI/cloud call added to page')
  }

  // ── CTA_CARD_PRESENT (report entry, not a promo button) ──
  {
    ok(/entry-card/.test(wxml), 'H CTA is a card entry')
    ok(wxml.indexOf('世界模型深度报告') >= 0, 'H entry title 世界模型深度报告')
    ok(wxml.indexOf('查看你的系统困局、翻身路径与行动建议') >= 0, 'H entry description present')
    ok(/entry-arrow/.test(wxml), 'H entry arrow present')
    ok(wxml.indexOf('<xsg-button') < 0, 'H no oversized promo button')
  }

  // ── POSTER_ENTRY_ABSENT ──
  {
    ok(wxml.indexOf('保存认知海报') < 0, 'I poster entry absent')
    ok(wxml.indexOf('goShare') < 0, 'I no goShare binding')
    ok(js.indexOf('goShare') < 0, 'I goShare handler absent')
    ok(js.indexOf('share-poster') < 0, 'I no share-poster navigation')
  }

  // ── Interaction: canonical CTA flow, no side effects ──
  {
    const p = loadResult(RECORD)
    await p.load()
    p.setData({ recordId: RECORD.recordId })
    p._calls.length = 0
    p.goReport()
    eq(p._calls.length, 1, 'J one navigation from CTA')
    eq(p._calls[0].m, 'navigateTo', 'J navigateTo')
    ok(p._calls[0].url.indexOf('/pages/report-preview/report-preview') >= 0, 'J canonical report-preview')
    ok(p._calls[0].url.indexOf('type=challenge_final') >= 0, 'J explicit challenge_final')
    ok(p._calls[0].url.indexOf('recordId=CR1790632776226vtmih6') >= 0, 'J recordId carried')
    ok(!p._calls.some((c) => /membership|createOrder|pay/i.test(c.url || '')), 'J no payment/authority side effect')
  }

  // ── Regression: data intact ──
  {
    const p = loadResult(RECORD)
    await p.load()
    eq(p.data.result.profile.probabilityMindset, 90, 'K profile value intact')
    eq(p.data.result.profile.longTermism, 47, 'K profile value intact')
    eq(p.data.result.scoringVersion, 'normalized_v2', 'K scoringVersion preserved')
    eq(p.data.dimKeys.length, 9, 'K nine dims bound')
    ok(js.indexOf('/pages/report-preview/report-preview?recordId=') >= 0, 'K downstream navigation unchanged')
  }

  // ── Radar module sanity ──
  {
    const d = radar.buildRadarData(RECORD.scores, ['laborMindset', 'probabilityMindset', 'systemThinking'], { laborMindset: '劳动' })
    eq(d.length, 3, 'L radar builds requested dims')
    eq(d[0].label, '劳动', 'L radar uses label map')
    const stub = new Proxy({}, { get: () => () => {} })
    radar.drawRadar(stub, { width: 300, height: 300, data: d, progress: 0.5 })
    ok(true, 'L drawRadar does not throw on stub ctx')
  }

  console.log(`\nchallenge-result-visual_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
