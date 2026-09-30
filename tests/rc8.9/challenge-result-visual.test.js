#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/challenge-result-visual.test.js
 *
 * CHALLENGE_RESULT_0926_GOLDEN — deterministic structural checks for the
 * restored 2026-09-26 product UI of pages/challenge-result (golden = c41be06,
 * the last coherent LIGHT "product result" UI; superseded by the R9/R9.1 dark
 * world-model console which was not accepted).
 *
 * NOTE: source/test PASS is NOT visual PASS. Real-device visual acceptance is
 * the owner's call; this file only guards structure + behaviour.
 *
 * Covered:
 *   A  raw internal enum never visible (presenter maps enum → 普通觉醒型)
 *   B  hero world-model block present
 *   C  nine-dimension score grid present + all 9 rendered
 *   D  core tags section present (xsg-tag list)
 *   E  report CTA "生成我的世界模型报告" → canonical report-preview challenge_final
 *   F  poster entry "保存认知海报 · 分享翻身概率" → share-poster
 *   G  LIGHT golden theme (no R9 dark console)
 *   H  every WXML class is defined in WXSS (no class drift)
 *   I  no raw enum / no internal enum tokens in rendered copy
 *   J  CTA has no payment/authority side effect; data intact
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
const RESULT_JSON = path.join(ROOT, 'pages', 'challenge-result', 'challenge-result.json')
const LABELS_JS = path.join(ROOT, 'utils', 'worldModelLabels.js')

const RAW_ENUMS = ['normal_awakened', 'strategic', 'effort_trap', 'high_risk', 'opportunity_hunter', 'system_thinker']

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('CHALLENGE_RESULT_0926_GOLDEN')

function loadResult (record) {
  const calls = []
  let page = null
  const sandbox = {
    Page: (c) => { page = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
    setTimeout: (fn) => { fn(); return 0 }, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    wx: { navigateTo: (o) => calls.push({ m: 'navigateTo', url: o.url }), showToast: () => {} },
    getApp: () => ({ globalData: {} }),
  }
  sandbox.require = (req) => {
    if (req.indexOf('challengeService') >= 0) return { getChallengeRecord: async () => ({ code: 0, data: record }) }
    if (req.indexOf('analytics') >= 0) return { track: () => {}, flush: () => {} }
    if (req.indexOf('worldModelLabels') >= 0) return require(LABELS_JS)
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
  scores: { laborMindset: 50, probabilityMindset: 90, systemThinking: 66, leverageThinking: 40, capitalThinking: 55, riskAwareness: 80, informationSensitivity: 65, longTermism: 47, decisionStability: 58 },
  tags: ['行动派', '低成本试错', '杠杆升级', '系统思维', '自动化思维', '开源杠杆'],
}

const DIM_CLASSES = ['laborMindset', 'probabilityMindset', 'systemThinking', 'leverageThinking', 'capitalThinking', 'riskAwareness', 'informationSensitivity', 'longTermism', 'decisionStability']

;(async () => {
  const wxml = fs.readFileSync(RESULT_WXML, 'utf8')
  const wxss = fs.readFileSync(RESULT_WXSS, 'utf8')
  const js = fs.readFileSync(RESULT_JS, 'utf8')
  const conf = JSON.parse(fs.readFileSync(RESULT_JSON, 'utf8'))

  // ── A — raw enum present as internal, NEVER rendered; presenter maps it ──
  {
    const p = loadResult(RECORD)
    await p.load()
    eq(p.data.result.mainType, '普通觉醒型', 'A enum → Chinese label 普通觉醒型')
    ok(p.data.result.mainType !== 'normal_awakened', 'A raw enum never surfaced in data')
    ok(js.indexOf('worldModelLabels') >= 0 && js.indexOf('worldModelTypeLabel') >= 0, 'A page uses canonical presenter')
    RAW_ENUMS.forEach((e) => ok(wxml.indexOf(e) < 0, 'A WXML has no raw enum: ' + e))
  }

  // ── B — hero world-model block ──
  {
    ok(/class="result-hero/.test(wxml), 'B hero block present')
    ok(/class="r-type"/.test(wxml), 'B hero type line present')
    ok(wxml.indexOf('{{result.mainType') >= 0, 'B hero binds presenter mainType')
    ok(wxml.indexOf('你的世界模型初步类型') >= 0, 'B hero subtitle present')
    ok(/\.result-hero\s*\{/.test(wxss) && /\.r-type\s*\{/.test(wxss), 'B hero styled')
  }

  // ── C — nine-dimension score grid ──
  {
    ok(wxml.indexOf('九维评分') >= 0, 'C section titled 九维评分')
    ok(/class="scores-grid"/.test(wxml), 'C scores grid present')
    ok(/class="score"/.test(wxml), 'C score cell present')
    ok(/class="sc-num"/.test(wxml) && /class="sc-label"/.test(wxml), 'C score number + label present')
    DIM_CLASSES.forEach((d) => ok(wxml.indexOf(d) >= 0, 'C dim rendered: ' + d))
    ok(/评分/.test(wxml) || wxml.indexOf('九维评分') >= 0, 'C labelled readable grid')
    const p = loadResult(RECORD)
    await p.load()
    eq(Object.keys(p.data.result.profile).length, 9, 'C profile has 9 dims')
    eq(p.data.result.profile.probabilityMindset, 90, 'C value intact (概率 90)')
    eq(p.data.result.profile.leverageThinking, 40, 'C value intact (杠杆 40)')
    ok(/\.scores-grid\s*\{/.test(wxss) && /\.sc-num\s*\{/.test(wxss) && /\.sc-label\s*\{/.test(wxss), 'C grid + values styled')
  }

  // ── D — core tags section ──
  {
    ok(wxml.indexOf('核心标签') >= 0, 'D section titled 核心标签')
    ok(/class="tag-row"/.test(wxml), 'D tag row present')
    ok(wxml.indexOf('<xsg-tag') >= 0, 'D uses xsg-tag component')
    ok(wxml.indexOf('{{result.tags') >= 0 || wxml.indexOf('for="{{result.tags}}"') >= 0, 'D renders result.tags')
    ok(/\.tag-row\s*\{/.test(wxss), 'D tag row styled')
  }

  // ── E — report CTA ──
  {
    ok(wxml.indexOf('生成我的世界模型报告') >= 0, 'E CTA copy 生成我的世界模型报告')
    ok(/bind:tapbutton="goReport"/.test(wxml) || /bindtap="goReport"/.test(wxml), 'E CTA bound to goReport')
    const p = loadResult(RECORD)
    await p.load()
    p.setData({ recordId: RECORD.recordId })
    p._calls.length = 0
    p.goReport()
    eq(p._calls.length, 1, 'E one navigation from CTA')
    ok(p._calls[0].url.indexOf('/pages/report-preview/report-preview') >= 0, 'E → canonical report-preview')
    ok(p._calls[0].url.indexOf('type=challenge_final') >= 0, 'E → explicit challenge_final')
    ok(p._calls[0].url.indexOf('recordId=' + RECORD.recordId) >= 0, 'E → recordId carried')
  }

  // ── F — poster entry ──
  {
    ok(wxml.indexOf('保存认知海报') >= 0, 'F poster entry copy present')
    ok(wxml.indexOf('分享翻身概率') >= 0, 'F poster entry share copy present')
    ok(/bindtap="goShare"/.test(wxml), 'F bound to goShare')
    const p = loadResult(RECORD)
    await p.load()
    p.setData({ recordId: RECORD.recordId })
    p._calls.length = 0
    p.goShare()
    eq(p._calls.length, 1, 'F one navigation from poster entry')
    ok(p._calls[0].url.indexOf('/pages/share-poster/share-poster') >= 0, 'F → share-poster')
  }

  // ── G — LIGHT golden theme (no R9/R9.1 dark console) ──
  {
    ok(wxss.indexOf('#f8f9fa') >= 0, 'G light background token present')
    ok(wxss.indexOf('#0f0f1a') < 0 && wxss.indexOf('bg-base') < 0, 'G no dark console background')
    ok(wxml.indexOf('hero-orb') < 0 && wxml.indexOf('WORLD MODEL PROFILE') < 0, 'G no R9.1 hero orb / english eyebrow')
    ok(wxml.indexOf('radarCanvas') < 0 && wxml.indexOf('radar-fallback') < 0, 'G no R9 radar canvas')
    ok(wxml.indexOf('trait-chip') < 0 && wxml.indexOf('entry-card') < 0, 'G no R9.1 chip/entry-card layout')
    eq(conf.navigationStyle, 'custom', 'G custom nav kept')
    ok(conf.usingComponents && conf.usingComponents['xsg-card'] && conf.usingComponents['xsg-tag'] && conf.usingComponents['xsg-button'], 'G required components declared')
  }

  // ── H — every WXML class is defined in WXSS (no class drift) ──
  {
    // page stylesheet + the tokens stylesheet it @imports (canonical shared classes)
    const tokens = fs.readFileSync(path.join(ROOT, 'styles', 'tokens.wxss'), 'utf8')
    const cssAll = wxss + '\n' + tokens
    const classes = new Set()
    for (const m of wxml.matchAll(/class="([^"]+)"/g)) {
      m[1].split(/\s+/).forEach((c) => { if (c && !/\{\{|\}\}/.test(c) && /^[a-zA-Z]/.test(c)) classes.add(c) })
    }
    const missing = [...classes].filter((c) => !new RegExp('\\.[a-zA-Z0-9_-]*' + c.replace(/[-]/g, '\\-') + '([\\s,{:.]|$)').test(cssAll))
    eq(missing.length, 0, 'H no undefined WXML classes: ' + missing.join(','))
  }

  // ── I — no internal enum tokens anywhere in rendered copy ──
  {
    RAW_ENUMS.forEach((e) => {
      ok(wxml.indexOf(e) < 0, 'I wxml clean of ' + e)
      ok(wxss.indexOf(e) < 0, 'I wxss clean of ' + e)
    })
    ok(js.indexOf("mainType: raw.finalType") < 0, 'I page never binds raw finalType directly')
    ok(js.indexOf('worldModelTypeLabel(raw.finalType)') >= 0, 'I page maps finalType via presenter')
  }

  // ── J — no payment/authority side effect; data intact ──
  {
    const p = loadResult(RECORD)
    await p.load()
    p.setData({ recordId: RECORD.recordId })
    p._calls.length = 0
    p.goReport(); p.goShare()
    ok(!p._calls.some((c) => /membership|createOrder|pay|verifyPayment/i.test(c.url || '')), 'J no payment/authority side effect')
    eq(p.data.result.scoringVersion, 'normalized_v2', 'J scoringVersion preserved')
    eq(p.data.result.profile.probabilityMindset, 90, 'J profile intact after interactions')
    ok(js.indexOf('/pages/report-preview/report-preview?recordId=') >= 0, 'J downstream navigation unchanged')
  }

  console.log(`\nchallenge-result-visual_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
