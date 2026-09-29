#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/world-model-poster.test.js
 *
 * PAYMENT_STAGE5A_R10_WORLD_MODEL_REPORT_PAGE_PRODUCTIZATION — poster feature.
 *
 * Covers:
 *   POSTER_CONTENT_MAPPING_PASS, POSTER_FATAL_LINE_PRESENT,
 *   POSTER_CORE_PROBLEM_PRESENT, POSTER_SYSTEM_TRAP_PRESENT,
 *   POSTER_ACTION_SUGGESTIONS_PRESENT, POSTER_QR_BLOCK_PRESENT_OR_FALLBACK,
 *   POSTER_RENDER_FAILSAFE_PASS, POSTER_SAVE_FLOW_PASS,
 *   POSTER_STYLE_MATCHED_TO_REF, TEXT_LIMITS.
 *
 * Logic + source-asset only. No network / DB / payment / device claim.
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..', '..')
const CONTENT = path.join(ROOT, 'utils', 'worldModelPosterContent.js')
const RENDERER = path.join(ROOT, 'utils', 'worldModelPosterRenderer.js')
const PREVIEW_JS = path.join(ROOT, 'pages', 'report-preview', 'report-preview.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('PAYMENT_STAGE5A_R10 - POSTER')

const content = require(CONTENT)
const renderer = require(RENDERER)

const RD = {
  basicInsight: '认知已觉醒，杠杆未拉满',
  mechanism: '你有概率意识，但没有把验证过的能力沉淀成可复制的资产。',
  reverseReasoning: '你困在单点努力里，没有形成自动化与资本化闭环。',
  biasCorrection: '把已验证能力封装成产品。',
  actionPlan: '01 把谈判能力产品化；02 做内容模板化输出；03 配置安全垫控制试错成本；04 每月复盘资产化进度。',
}

// ── POSTER_CONTENT_MAPPING_PASS + block mapping ──
const cm = content.buildPosterContent(RD, { mainType: '普通觉醒型' })
eq(cm.brandTitle, '珠澳小事哥·认知操作系统', 'BRAND_TITLE mapping')
eq(cm.mainTitle, '世界模型报告', 'POSTER_MAIN_TITLE mapping')
ok(cm.subtitle.length > 0, 'subtitle mapped from fatalLine')

eq(cm.blocks[0].key, 'fatalLine', 'block 01 key = fatalLine')
eq(cm.blocks[0].title, '今日认知暴击', 'block 01 title')
ok(cm.blocks[0].text === RD.basicInsight, 'POSTER_FATAL_LINE_PRESENT')
eq(cm.blocks[0].maxLines, 3, 'block 01 maxLines = 3')

eq(cm.blocks[1].key, 'coreProblem', 'block 02 key = coreProblem')
ok(cm.blocks[1].text === RD.mechanism, 'POSTER_CORE_PROBLEM_PRESENT')
eq(cm.blocks[1].maxLines, 7, 'block 02 maxLines = 7')

eq(cm.blocks[2].key, 'systemTrap', 'block 03 key = systemTrap')
ok(cm.blocks[2].text === RD.reverseReasoning, 'POSTER_SYSTEM_TRAP_PRESENT')
eq(cm.blocks[2].maxLines, 7, 'block 03 maxLines = 7')

eq(cm.blocks[3].key, 'actions', 'block 04 key = actions')
ok(cm.blocks[3].text === RD.actionPlan, 'POSTER_ACTION_SUGGESTIONS_PRESENT')
ok(cm.blocks[3].items.length <= 4, 'block 04 items <= 4')
ok(cm.blocks[3].items.length >= 1, 'block 04 items >= 1')
eq(cm.limits.block04MaxLinesPerItem, 3, 'block 04 max lines per item = 3')

eq(cm.footerText[0], '扫码查看你的世界模型报告', 'footer text 1')
eq(cm.footerText[1], '看见自己的认知盲区', 'footer text 2')
eq(cm.footerTags.length, 3, 'footer tags = 3')

// ── block 04 item cap enforced ──
{
  const many = 'a；b；c；d；e；f；g；h'
  const c = content.buildPosterContent({ actionPlan: many })
  ok(c.blocks[3].items.length <= 4, 'action items capped at 4')
}

// ── empty report → no crash, no undefined ──
{
  const c = content.buildPosterContent(null)
  eq(c.blocks.length, 4, 'empty report still yields 4 blocks')
  ok(c.blocks.every((b) => typeof b.text === 'string'), 'block texts are strings on empty input')
}

// ── renderer is a pure, draw-safe function (stub ctx) ──
{
  const calls = []
  const handler = {
    get: function (t, k) {
      if (k === 'createCircularGradient') return function () { return { addColorStop: function () {} } }
      if (k === 'measureText') return function (s) { return { width: String(s).length * 10 } }
      return function () { calls.push(k) }
    },
  }
  const ctx = new Proxy({}, handler)
  const out = renderer.drawPoster(ctx, content.buildPosterContent(RD), { qrPath: '/images/qrcode.png' })
  eq(out.width, 1080, 'POSTER canvas width = 1080')
  eq(out.height, 1920, 'POSTER canvas height = 1920')
  eq(out.sections, 4, 'renderer drew 4 sections')
  ok(calls.indexOf('fillText') >= 0, 'renderer drew text')
  ok(calls.indexOf('fillRect') >= 0, 'renderer drew background/fills')
  eq(out.hasQR, true, 'POSTER_QR_BLOCK_PRESENT')
}

// ── POSTER_RENDER_FAILSAFE_PASS: ctx without gradient/qr support still returns ──
{
  const handler = {
    get: function (t, k) {
      if (k === 'createCircularGradient') return function () { throw new Error('unsupported') }
      if (k === 'drawImage') return function () { throw new Error('no qr') }
      if (k === 'measureText') return function (s) { return { width: String(s).length * 10 } }
      return function () {}
    },
  }
  const ctx = new Proxy({}, handler)
  let threw = false
  let out = null
  try { out = renderer.drawPoster(ctx, content.buildPosterContent(RD), { qrPath: '' }) } catch (e) { threw = true }
  ok(!threw, 'POSTER_RENDER_FAILSAFE_PASS (no throw on limited ctx)')
  eq(out.hasQR, false, 'QR fallback when unavailable')
}

// ── wrapText truncation ──
{
  const ctx = { setFontSize: function () {}, measureText: function (s) { return { width: String(s).length * 20 } } }
  const lines = renderer.wrapText(ctx, '甲'.repeat(100), 100, 30, 3)
  ok(lines.length <= 3, 'wrapText respects maxLines')
  ok(lines[lines.length - 1].indexOf('…') >= 0, 'truncated line ends with ellipsis')
}

// ── POSTER_STYLE_MATCHED_TO_REF (dark navy + neon + section coding) ──
{
  ok(renderer.PALETTE.bg0 === '#070B14', 'dark navy background')
  ok(/#7C5CFF/i.test(renderer.PALETTE.neon), 'neon purple present')
  const src = fs.readFileSync(RENDERER, 'utf8')
  ok(/setStrokeStyle\(b\.color/.test(src), 'per-section colour coding (border)')
  const c = content.buildPosterContent(RD)
  ok(c.blocks[0].color && c.blocks[2].color && c.blocks[3].color, 'red/orange/green section coding tokens')
}

// ── POSTER_SAVE_FLOW_PASS (source-level) ──
{
  const js = fs.readFileSync(PREVIEW_JS, 'utf8')
  ok(js.indexOf('_generateWorldModelPoster') >= 0, 'world-model poster generator present')
  ok(js.indexOf('canvasToTempFilePath') >= 0, 'canvas -> temp file')
  ok(/showPoster: true/.test(js), 'preview shown after generate')
  ok(js.indexOf('savePoster()') >= 0, 'savePoster entry present')
  ok(js.indexOf('saveImageToPhotosAlbum') >= 0, 'save to album')
  ok(/已保存到相册/.test(js), 'success toast after save')
  ok(/openSetting/.test(js), 'permission fallback (openSetting)')
  ok(/海报生成失败/.test(js), 'save/generate failure toast')
  ok(js.indexOf('正在生成海报...') >= 0, 'loading text 正在生成海报...')
}

console.log('\nworld-model-poster_TEST pass=*** fail=' + fail)
process.exit(fail ? 1 : 0)
