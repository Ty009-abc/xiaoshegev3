#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/challenge-result-visual.test.js
 *
 * CHALLENGE_RESULT_OWNER_SCREENSHOT_GOLDEN — deterministic structural checks for
 * the rebuilt pages/challenge-result ("世界模型控制台", DARK) that matches the
 * OWNER_REFERENCE_SCREENSHOT (2026-09-30 10:24真机, two shots: top + bottom).
 *
 * Golden source = owner screenshot. The screenshot (and the R9.1 console it depicts,
 * 9469e78) shows: nav 挑战结果; eyebrow WORLD MODEL PROFILE; purple hero orb;
 * 普通觉醒型; 你的世界模型初步类型; conclusion line; 九维世界模型 radar (满分100)
 * with 优势维度/待突破; 世界模型判断 card; 核心特征 chips; and a
 * "世界模型深度报告" entry card (NOT a 保存认知海报 button).
 *
 * NOTE: source/test PASS is NOT visual PASS. Real-device visual acceptance is the
 * owner's call; this file only guards structure + behaviour.
 *
 * Covered:
 *   A  raw internal enum never visible (presenter → 普通觉醒型)
 *   B  hero world-model block (WORLD MODEL PROFILE eyebrow + orb + gradient type)
 *   C  nine-dimension radar panel + fallback (Top2/Bottom2 highlights)
 *   D  core features ≤ 8 (weighted trait chips, primary×3)
 *   E  "世界模型深度报告" entry card → report-preview?type=challenge_final
 *   F  legacy 保存认知海报 poster CTA removed from the golden
 *   G  dark console theme (owner screenshot) with NO undefined layout classes
 *   H  no debug-style layout (every WXML class defined)
 *   I  data intact + no payment/authority side effect
 *
 * Logic + source-asset only. No network / DB / payment / device claim.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const R = path.join(ROOT, 'pages', 'challenge-result')
const RESULT_JS = path.join(R, 'challenge-result.js')
const RESULT_WXML = path.join(R, 'challenge-result.wxml')
const RESULT_WXSS = path.join(R, 'challenge-result.wxss')
const RESULT_JSON = path.join(R, 'challenge-result.json')
const LABELS_JS = path.join(ROOT, 'utils', 'worldModelLabels.js')
const TAGS_JS = path.join(ROOT, 'utils', 'worldModelTags.js')
const RADAR_JS = path.join(ROOT, 'utils', 'radarChart.js')

const RAW_ENUMS = ['normal_awakened', 'strategic', 'effort_trap', 'high_risk', 'opportunity_hunter', 'system_thinker']

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('CHALLENGE_RESULT_OWNER_SCREENSHOT_GOLDEN')

function loadResult (record, opts) {
  const calls = []
  let page = null
  const drawCalls = { n: 0 }
  const timers = []
  let seq = 0
  const sandbox = {
    Page: (c) => { page = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
    setTimeout: (fn) => { const id = ++seq; timers.push({ id, fn }); return id },
    clearTimeout: () => {},
    setInterval: (fn) => { let n = 0; while (n++ < 40) { try { fn() } catch (e) {} } return ++seq },
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
  inst._flushTimers = () => { let g = 0; while (timers.length && g++ < 50) { const t = timers.shift(); try { t.fn() } catch (e) {} } }
  return inst
}

// Authoritative server scores for the golden record CR1790632776226vtmih6.
const RECORD = {
  recordId: 'CR1790632776226vtmih6', finalType: 'normal_awakened', scoringVersion: 'normalized_v2',
  scores: { laborMindset: 0, probabilityMindset: 90, systemThinking: 66, leverageThinking: 64, capitalThinking: 55, riskAwareness: 80, informationSensitivity: 51, longTermism: 47, decisionStability: 62 },
  tags: ['行动派', '低成本试错', '杠杆升级', '系统思维', '自动化思维', '开源杠杆', '系统化', '能力复制', '能力护城河', '价值链升级'],
}

;(async () => {
  const wxml = fs.readFileSync(RESULT_WXML, 'utf8')
  const wxss = fs.readFileSync(RESULT_WXSS, 'utf8')
  const js = fs.readFileSync(RESULT_JS, 'utf8')
  const conf = JSON.parse(fs.readFileSync(RESULT_JSON, 'utf8'))

  // ── A — raw enum never rendered; presenter maps it ──
  {
    const p = loadResult(RECORD)
    await p.load()
    eq(p.data.result.mainType, '普通觉醒型', 'A enum → 普通觉醒型')
    ok(p.data.result.mainType !== 'normal_awakened', 'A raw enum never surfaced')
    ok(js.indexOf('worldModelTypeLabel(raw.finalType)') >= 0, 'A page maps via canonical presenter')
    RAW_ENUMS.forEach((e) => ok(wxml.indexOf(e) < 0, 'A WXML clean of raw enum: ' + e))
  }

  // ── B — hero world-model block (owner screenshot) ──
  {
    ok(wxml.indexOf('WORLD MODEL PROFILE') >= 0, 'B hero eyebrow present (owner screenshot)')
    ok(wxml.indexOf('hero-orb') >= 0, 'B hero orb present')
    ok(/hero-orb[\s\S]*orb-core/.test(wxml), 'B hero orb core present')
    ok(/class="hero-type"/.test(wxml) && wxml.indexOf('{{result.mainType') >= 0, 'B hero type binds presenter')
    ok(wxml.indexOf('你的世界模型初步类型') >= 0, 'B hero subtitle present')
    ok(/\.hero-orb\s*\{[\s\S]*width:\s*260rpx/.test(wxss), 'B hero orb sized')
    ok(/@keyframes spin/.test(wxss), 'B orb rings rotate')
  }

  // ── C — nine-dimension radar panel + fallback + Top2/Bottom2 ──
  {
    ok(/<canvas[^>]*canvas-id="radarCanvas"/.test(wxml), 'C radar canvas present')
    ok(wxml.indexOf('九维世界模型') >= 0, 'C panel titled 九维世界模型')
    ok(wxml.indexOf('radar-fallback') >= 0 && /wx:if="\{\{radarFail\}\}"/.test(wxml), 'C fallback gated by radarFail')
    ok(/fb-row/.test(wxml) && /result\.dims/.test(wxml), 'C fallback renders real dims')
    ok(/dim-highlights/.test(wxml) && wxml.indexOf('优势维度') >= 0 && wxml.indexOf('待突破') >= 0, 'C Top2/Bottom2 highlights present')
    ok(/\.radar-fallback\s*\{/.test(wxss) && /\.dh-line\s*\{/.test(wxss), 'C radar + highlights styled')
    const p = loadResult(RECORD)
    await p.load(); p._flushTimers()
    eq(p.data.radarFail, false, 'C radar draws when canvas available')
    eq(p.data.radarOk, true, 'C radarOk true after draw')
    ok(p._drawCalls.n >= 1, 'C ctx.draw() called')
    eq(p.data.result.topDims.length, 2, 'C top2 dims')
    eq(p.data.result.bottomDims.length, 2, 'C bottom2 dims')
    eq(p.data.result.topDims[0].label, '概率', 'C top dim = 概率 (90)')
    eq(p.data.result.bottomDims[0].label, '劳动', 'C bottom dim = 劳动 (0)')
    eq(p.data.result.dims.length, 9, 'C nine dims bound')
    // ctx missing → fallback, no crash
    const pf = loadResult(RECORD, 'noctx'); await pf.load(); pf._flushTimers()
    eq(pf.data.radarFail, true, 'C fallback engages when ctx unavailable')
  }

  // ── D — core features ≤ 8, weighted chips ──
  {
    const p = loadResult(RECORD)
    await p.load()
    ok(p.data.result.coreTraits.length <= 8, 'D core features ≤ 8')
    eq(p.data.result.coreTraits.slice(0, 3).join('|'), '杠杆升级|开源杠杆|自动化思维', 'D chip order matches golden screenshot')
    ok(p.data.result.coreTraits.indexOf('系统化') >= 0 && p.data.result.coreTraits.indexOf('能力复制') >= 0, 'D golden chips present')
    ok(/index < 3 \? 'trait-primary' : 'trait-secondary'/.test(wxml), 'D primary×3 / secondary binding')
    ok(/\.trait-primary\s*\{/.test(wxss) && /\.trait-secondary\s*\{/.test(wxss), 'D weighted chip styles defined')
    ok(wxml.indexOf('核心特征') >= 0, 'D section titled 核心特征')
  }

  // ── E — 世界模型深度报告 entry card (owner screenshot) ──
  {
    ok(wxml.indexOf('世界模型深度报告') >= 0, 'E entry title 世界模型深度报告 (owner screenshot)')
    ok(wxml.indexOf('查看你的系统困局、翻身路径与行动建议') >= 0, 'E entry desc matches screenshot')
    ok(/bindtap="goReport"/.test(wxml), 'E entry card bound to goReport')
    const p = loadResult(RECORD)
    await p.load(); p.setData({ recordId: RECORD.recordId }); p._calls.length = 0
    p.goReport()
    eq(p._calls.length, 1, 'E one navigation from report entry')
    ok(p._calls[0].url.indexOf('/pages/report-preview/report-preview') >= 0, 'E → report-preview')
    ok(p._calls[0].url.indexOf('type=challenge_final') >= 0, 'E → explicit challenge_final')
    ok(p._calls[0].url.indexOf('recordId=' + RECORD.recordId) >= 0, 'E → recordId carried')
  }

  // ── F — legacy poster CTA removed (golden screenshot has no 保存认知海报) ──
  {
    ok(wxml.indexOf('保存认知海报') < 0, 'F legacy 保存认知海报 CTA removed from WXML (golden)')
    ok(js.indexOf('goShare') >= 0, 'F goShare handler retained (unused, non-breaking)')
    const p = loadResult(RECORD)
    await p.load(); p._calls.length = 0
    p.goReport()
    ok(p._calls.every((c) => c.url.indexOf('share-poster') < 0), 'F report entry does not route to share-poster')
  }

  // ── G — dark console theme (owner screenshot) ──
  {
    ok(wxss.indexOf('#070B14') >= 0, 'G dark page background token')
    ok(wxss.indexOf('bg-base') >= 0 && wxss.indexOf('radial-gradient') >= 0, 'G ambient gradient background')
    ok(wxml.indexOf('WORLD MODEL PROFILE') >= 0, 'G dark console hero eyebrow')
    ok(wxml.indexOf('hero-orb') >= 0, 'G dark console orb')
    eq(conf.backgroundColor, '#070B14', 'G page json dark bg')
    eq(conf.navigationStyle, 'custom', 'G custom nav preserved')
  }

  // ── H — no undefined layout classes (debug-looking regression) ──
  {
    const tokens = fs.readFileSync(path.join(ROOT, 'styles', 'tokens.wxss'), 'utf8')
    const cssAll = wxss + '\n' + tokens
    const classes = new Set()
    for (const m of wxml.matchAll(/class="([^"]+)"/g)) {
      m[1].split(/\s+/).forEach((c) => { if (c && !/\{\{|\}\}/.test(c) && /^[a-zA-Z]/.test(c)) classes.add(c) })
    }
    ;['trait-primary', 'trait-secondary'].forEach((c) => classes.add(c))
    const missing = [...classes].filter((c) => !new RegExp('\\.[a-zA-Z0-9_-]*' + c.replace(/[-]/g, '\\-') + '([\\s,{:.]|$)').test(cssAll))
    eq(missing.length, 0, 'H no undefined WXML classes: ' + missing.join(','))
  }

  // ── I — data intact + no side effect ──
  {
    const p = loadResult(RECORD)
    await p.load()
    p.setData({ recordId: RECORD.recordId }); p._calls.length = 0
    p.goReport(); p.goShare()
    ok(!p._calls.some((c) => /membership|createOrder|pay|verifyPayment/i.test(c.url || '')), 'I no payment/authority side effect')
    eq(p.data.result.profile.probabilityMindset, 90, 'I profile intact (概率 90)')
    eq(p.data.result.profile.laborMindset, 0, 'I server value 0 preserved (劳动 0)')
    eq(p.data.result.scoringVersion, 'normalized_v2', 'I scoringVersion preserved')
    ok(js.indexOf('/pages/report-preview/report-preview?recordId=') >= 0, 'I downstream navigation unchanged')
  }

  console.log(`\nchallenge-result-visual_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
