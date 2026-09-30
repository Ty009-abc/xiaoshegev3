#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/ui-productization.test.js
 *
 * PAYMENT_STAGE5A_R9_UI_PRODUCTIZATION — deterministic client UI checks.
 *
 * Covers A–J of the task:
 *   A  raw internal enum never visible
 *   B  displayed core traits <= 8 (highest-value, no full-pool dump)
 *   C  incomplete poster entry absent
 *   D  paid report shows full sections
 *   E  paid report does NOT show 查看完整报告
 *   F  paid report does NOT show 立即升级
 *   G  paid report does NOT show ¥9.90 CTA
 *   H  unpaid report shows exactly one unlock CTA
 *   I  canonical user-facing name = 世界模型报告
 *   J  no legacy report-detail navigation for paid challenge_final
 *
 * Logic + source-asset only. No network / DB / payment / device claim.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const RESULT_JS = path.join(ROOT, 'pages', 'challenge-result', 'challenge-result.js')
const RESULT_WXML = path.join(ROOT, 'pages', 'challenge-result', 'challenge-result.wxml')
const PREVIEW_JS = path.join(ROOT, 'pages', 'report-preview', 'report-preview.js')
const PREVIEW_WXML = path.join(ROOT, 'pages', 'report-preview', 'report-preview.wxml')
const MEMBERSHIP_JS = path.join(ROOT, 'pages', 'membership', 'membership.js')
const HOME_WXML = path.join(ROOT, 'pages', 'home', 'home.wxml')
const LABELS_JS = path.join(ROOT, 'utils', 'worldModelLabels.js')
const TAGS_JS = path.join(ROOT, 'utils', 'worldModelTags.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE5A_R9_UI_PRODUCTIZATION')

const labels = require(LABELS_JS)
const tags = require(TAGS_JS)

// ═══════════════════════════════════════════════════════════════════════════
// A + B — canonical tag presenter + core-trait cap
// ═══════════════════════════════════════════════════════════════════════════
{
  eq(tags.MAX_CORE_TAGS, 8, 'B MAX_CORE_TAGS = 8')

  // 30+ raw tags (a full-pool style dump) → capped, priority-first
  const pool = ['行动派', '观望型', '杠杆升级', '系统思维', '赌徒心态', '劳动崇拜',
    '长期主义', '机会捕捉', '信息验证', '资产配置', '认知觉醒', '随机甲', '随机乙',
    '随机丙', '随机丁', '随机戊', '随机己', '随机庚', '随机辛', '随机壬', '随机癸']
  const r = tags.resolveCoreTraits(pool)
  eq(r.coreTraits.length, 8, 'B core traits capped at 8')
  ok(r.coreTraits.length <= 8, 'B never exceeds 8')
  eq(r.total, pool.length, 'B total reported')
  eq(r.hiddenCount, pool.length - 8, 'B hidden count = total - shown')
  // priority: a curated leverage tag must outrank an unlisted filler
  ok(r.coreTraits.indexOf('杠杆升级') >= 0, 'B curated high-value tag retained')
  ok(r.coreTraits.indexOf('随机甲') < 0, 'B low-value filler dropped by the cap')
  // deterministic
  eq(JSON.stringify(tags.resolveCoreTraits(pool).coreTraits), JSON.stringify(r.coreTraits), 'B deterministic')

  // dedupe + sanitize
  eq(tags.normalizeTags(['a', 'a', ' b ', '', null, 3, 'b']).join('|'), 'a|b', 'B dedupe + trim + drop non-string')
  eq(tags.resolveCoreTraits(null).coreTraits.length, 0, 'B null-safe')
  eq(tags.resolveCoreTraits(['x', 'y']).coreTraits.length, 2, 'B fewer than cap keeps all')
}

// ═══════════════════════════════════════════════════════════════════════════
// vm harness
// ═══════════════════════════════════════════════════════════════════════════
function makeRequire (stubs) {
  return function (req) {
    for (const k of Object.keys(stubs)) if (req.indexOf(k) >= 0) return stubs[k]
    throw new Error('unexpected require: ' + req)
  }
}
function emptyWx (calls) {
  return {
    navigateTo: (o) => calls.push({ m: 'navigateTo', url: o.url }),
    redirectTo: (o) => calls.push({ m: 'redirectTo', url: o.url }),
    showToast: () => {}, showLoading: () => {}, hideLoading: () => {},
    navigateBack: () => {}, getStorageSync: () => '', setStorageSync: () => {},
    removeStorageSync: () => {}, openSetting: () => {}, showModal: () => {},
    createCanvasContext: () => ({}), canvasToTempFilePath: () => {},
    saveImageToPhotosAlbum: () => {},
  }
}
function instantiate (config) {
  const inst = Object.assign({}, config)
  inst.data = JSON.parse(JSON.stringify(config.data || {}))
  inst.setData = function (o) { Object.assign(inst.data, o) }
  return inst
}

// ── challenge-result page ──
function loadResult (record) {
  const calls = []
  const config = { config: null }
  let page = null
  const sandbox = {
    require: makeRequire({
      'services/challengeService.js': { getChallengeRecord: async () => ({ code: 0, data: record }) },
      'utils/analytics.js': { track: () => {}, flush: () => {} },
    }),
    // REAL worldModelLabels.js + worldModelTags.js are used (no stub) so the
    // presenter + cap are exercised end-to-end.
    Page: (c) => { page = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
    setTimeout: (fn) => { fn(); return 0 }, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    wx: emptyWx(calls), getApp: () => ({ globalData: {} }),
  }
  // Route the two util requires to the real files on disk.
  const realRequire = sandbox.require
  sandbox.require = (req) => {
    if (req.indexOf('worldModelLabels') >= 0) return require(LABELS_JS)
    if (req.indexOf('worldModelTags') >= 0) return require(TAGS_JS)
    return realRequire(req)
  }
  vm.createContext(sandbox)
  // Patch Module._resolveFilename-free: run with a require that maps relative utils.
  const src = fs.readFileSync(RESULT_JS, 'utf8')
  // The page requires '../../utils/worldModelLabels.js' etc. — makeRequire above
  // already maps by substring; ensure real modules are returned.
  sandbox.require = (req) => {
    if (req.indexOf('challengeService') >= 0) return { getChallengeRecord: async () => ({ code: 0, data: record }) }
    if (req.indexOf('analytics') >= 0) return { track: () => {}, flush: () => {} }
    if (req.indexOf('worldModelLabels') >= 0) return require(LABELS_JS)
    if (req.indexOf('worldModelTags') >= 0) return require(TAGS_JS)
    if (req.indexOf('radarChart') >= 0) return require(path.join(ROOT, 'utils', 'radarChart.js'))
    throw new Error('unexpected require: ' + req)
  }
  vm.runInContext(src, sandbox, { filename: RESULT_JS })
  const inst = instantiate(page)
  inst._calls = calls
  return inst
}

// ── report-preview page ──
function loadPreview (genImpl) {
  const calls = []
  let page = null
  const sandbox = {
    require: makeRequire({
      'services/aiReportService.js': {
        generateAiReport: (type, recordId) => genImpl(type, recordId),
        getAiReport: async () => ({ code: 0, data: {} }),
      },
      'utils/analytics.js': { track: () => {}, flush: () => {} },
      'utils/worldModelPosterContent.js': require(path.join(ROOT, 'utils', 'worldModelPosterContent.js')),
      'utils/worldModelPosterRenderer.js': require(path.join(ROOT, 'utils', 'worldModelPosterRenderer.js')),
    }),
    Page: (c) => { page = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    wx: emptyWx(calls), getApp: () => ({ globalData: {} }),
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(PREVIEW_JS, 'utf8'), sandbox, { filename: PREVIEW_JS })
  const inst = instantiate(page)
  inst._calls = calls
  return inst
}

const PAID = { code: 0, data: { reportId: 'ARCF9bc1766a2b0fbbcdfc0cdc3f', reportType: 'challenge_final', isPaid: true, locked: false, canViewFullReport: true, content: { oneSentence: 'X', whyNotRich: 'Y', biggestCognitiveGap: 'Z', bestPath: 'P', thirtyDayActions: ['a'], finalStrike: 'F' } } }
const UNPAID = { code: 0, data: { reportId: 'ARCF9bc1766a2b0fbbcdfc0cdc3f', reportType: 'challenge_final', isPaid: false, locked: true, canViewFullReport: false, summary: { oneSentence: 'S' } } }

;(async () => {
  // ═════════════════════════════════════════════════════════════════════════
  // A — raw enum not visible (challenge-result renders only the label)
  // ═════════════════════════════════════════════════════════════════════════
  {
    const record = {
      recordId: 'CR1790632776226vtmih6', finalType: 'normal_awakened', scoringVersion: 'normalized_v2',
      scores: { laborMindset: 60, probabilityMindset: 55, systemThinking: 70, leverageThinking: 40, capitalThinking: 50, riskAwareness: 45, informationSensitivity: 65, longTermism: 80, decisionStability: 58 },
      tags: ['行动派', '低成本试错', '杠杆升级', '系统思维', '赌徒心态'],
    }
    const p = loadResult(record)
    await p.load()
    eq(p.data.result.mainType, '普通觉醒型', 'A enum → Chinese label')
    ok(p.data.result.mainType !== 'normal_awakened', 'A raw enum never surfaced')
    ok(Array.isArray(p.data.result.tags) && p.data.result.tags.length === 5, 'B raw tags preserved (5)')
    // raw enum must not appear in the page WXML
    const w = fs.readFileSync(RESULT_WXML, 'utf8')
    ;['normal_awakened', 'strategic', 'effort_trap', 'high_risk', 'opportunity_hunter', 'system_thinker'].forEach((e) => {
      ok(w.indexOf(e) < 0, 'A WXML has no raw enum: ' + e)
    })
  }

  // ═════════════════════════════════════════════════════════════════════════
  // C — owner-screenshot challenge-result UI: report entry + core sections present
  // ═════════════════════════════════════════════════════════════════════════
  {
    const w = fs.readFileSync(RESULT_WXML, 'utf8')
    const js = fs.readFileSync(RESULT_JS, 'utf8')
    ok(w.indexOf('世界模型深度报告') >= 0, 'C report entry = 世界模型深度报告 (owner screenshot)')
    ok(w.indexOf('查看你的系统困局、翻身路径与行动建议') >= 0, 'C report entry desc (owner screenshot)')
    ok(w.indexOf('bindtap="goReport"') >= 0, 'C report entry bound to goReport')
    ok(js.indexOf('goReport') >= 0, 'C goReport handler present')
    ok(js.indexOf('report-preview') >= 0, 'C report-preview navigation present')
    ok(w.indexOf('保存认知海报') < 0, 'C legacy 保存认知海报 CTA removed (golden)')
    ok(w.indexOf('核心特征') >= 0, 'C feature section heading = 核心特征 (owner screenshot)')
    ok(w.indexOf('九维世界模型') >= 0, 'C nine-dim radar panel present (owner screenshot)')
  }

  // ═════════════════════════════════════════════════════════════════════════
  // D/E/F/G/H — report-preview paid vs unpaid state
  // ═════════════════════════════════════════════════════════════════════════
  {
    const w = fs.readFileSync(PREVIEW_WXML, 'utf8')

    // D — paid renders full sections (5), gated !locked
    ok(/wx:if="\{\{!locked\}\}"/.test(w), 'D full block gated by !locked')
    ;['致命一句话', '核心问题', '系统困局', '翻身路径', '行动建议'].forEach((t) => {
      ok(w.indexOf(t) >= 0, 'D section present: ' + t)
    })

    // E — no 查看完整报告
    ok(w.indexOf('查看完整报告') < 0, 'E 查看完整报告 removed from WXML')

    // G — no ¥9.90 CTA copy on the paid path; old copy gone
    ok(w.indexOf('9.9元解锁完整报告') < 0, 'G old 9.9 CTA copy removed')
    ok(w.indexOf('解锁完整世界模型报告 ¥9.90') >= 0, 'G single canonical unlock CTA copy present')

    // H — exactly ONE unlock CTA (the lock card), no separate xsg-button CTA
    const lockCards = (w.match(/report-lock-card/g) || []).length
    eq(lockCards, 1, 'H exactly one lock card (single unlock CTA)')

    // no stray old buttons
    ok(!/text="9\.9元解锁完整报告"/.test(w), 'G/H no old unlock button')
    ok(!/text="查看完整报告"/.test(w), 'E no 查看完整报告 button')

    // F — 立即升级 only lives inside the locked-gated upgrade modal
    ok(/wx:if="\{\{showUpgradeModal && locked\}\}"/.test(w), 'F upgrade modal gated by (showUpgradeModal && locked)')
    const upgradeIdx = w.indexOf('立即升级')
    const gateIdx = w.indexOf('showUpgradeModal && locked')
    ok(upgradeIdx > gateIdx && gateIdx >= 0, 'F 立即升级 appears only after the locked gate')
  }

  // Runtime: paid → full content, no upgrade modal, no navigate
  {
    const p = loadPreview(async () => PAID)
    p.setData({ recordId: 'CR1790632776226vtmih6', reportType: 'challenge_final' })
    await p._requestChallengeReport()
    eq(p.data.locked, false, 'D paid → unlocked')
    eq(p.data.cfState, 'ready', 'D paid → ready')
    eq(p.data.showUpgradeModal, false, 'F paid → no upgrade modal')
    ok(!!(p.data.reportData && p.data.reportData.basicInsight), 'D paid → full content bound')
    eq(p.requestFullReportAccess(), true, 'D paid → full access')
    ok(typeof p.goFull === 'undefined', 'E redundant 查看完整报告 path removed')
    ok(!p._calls.some((c) => c.m === 'navigateTo'), 'J paid → no legacy report-detail navigation')
  }

  // Runtime: unpaid → locked, upgrade path available but no auto-navigate
  {
    const p = loadPreview(async () => UNPAID)
    p.setData({ recordId: 'CR1790632776226vtmih6', reportType: 'challenge_final' })
    await p._requestChallengeReport()
    eq(p.data.locked, true, 'H unpaid → locked')
    eq(p.requestFullReportAccess(), false, 'H unpaid → not authorized')
    ok(!p._calls.some((c) => c.m === 'navigateTo'), 'H unpaid → no early navigation')
  }

  // ═════════════════════════════════════════════════════════════════════════
  // I — canonical user-facing name = 世界模型报告 (all surfaces)
  // ═════════════════════════════════════════════════════════════════════════
  {
    const w = fs.readFileSync(PREVIEW_WXML, 'utf8')
    ok(/xsg-navbar title="世界模型报告"/.test(w), 'I report-preview navbar = 世界模型报告')
    ok(w.indexOf('AI诊断报告') < 0, 'I AI诊断报告 removed from report-preview')
    const rw = fs.readFileSync(RESULT_WXML, 'utf8')
    ok(rw.indexOf('世界模型深度报告') >= 0, 'I challenge-result report entry = 世界模型报告 (golden)')
    const mjs = fs.readFileSync(MEMBERSHIP_JS, 'utf8')
    ok(/productId === 'report_9_9' \? '世界模型报告'/.test(mjs), 'I membership displays 世界模型报告 for report_9_9')
    const hw = fs.readFileSync(HOME_WXML, 'utf8')
    ok(hw.indexOf('世界模型报告') >= 0, 'I home entry references 世界模型报告')
    ok(hw.indexOf('AI深度诊断') < 0, 'I home no longer advertises AI深度诊断 for the 9.9 entry')
  }

  // ═════════════════════════════════════════════════════════════════════════
  // J — no legacy report-detail routing for challenge_final
  // ═════════════════════════════════════════════════════════════════════════
  {
    const js = fs.readFileSync(PREVIEW_JS, 'utf8')
    ok(js.indexOf('/pages/report-detail') < 0, 'J report-preview never routes to legacy report-detail')
    ok(js.indexOf('goFull') < 0, 'J goFull removed')
  }

  console.log(`\nui-productization_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
