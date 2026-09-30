#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/poster-recovery.test.js
 *
 * PAYMENT_STAGE5A_R10_4_POSTER_GENERATION_RECOVERY — poster pipeline recovery.
 *
 * Root cause fixed: challenge_final never mounted <canvas id="posterCanvas">, so
 * wx.createCanvasContext produced a context whose ctx.draw callback never fired,
 * leaving posterGenerating=true + loading forever (no watchdog / no cleanup).
 *
 * Covers TEST_MATRIX A–J:
 *   A challenge_final mounts posterCanvas         -> PASS
 *   B draw callback fires -> export called, terminal cleanup
 *   C draw callback never fires -> draw watchdog fires + cleanup + retry
 *   D export success -> preview reachable + cleanup
 *   E export fail -> cleanup + retry
 *   F export callback hangs -> export watchdog + cleanup
 *   G renderer throws synchronously -> cleanup
 *   H QR asset missing -> poster still generated (no throw)
 *   I second tap while generating -> blocked
 *   J tap after failed generation -> allowed
 *
 * Logic + source-asset only. No network / DB / payment / device claim.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const PREVIEW_JS = path.join(ROOT, 'pages', 'report-preview', 'report-preview.js')
const PREVIEW_WXML = path.join(ROOT, 'pages', 'report-preview', 'report-preview.wxml')
const RENDERER = path.join(ROOT, 'utils', 'worldModelPosterRenderer.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }

console.log('PAYMENT_STAGE5A_R10_4_POSTER_GENERATION_RECOVERY — RECOVERY')

const wxml = fs.readFileSync(PREVIEW_WXML, 'utf8')
const js = fs.readFileSync(PREVIEW_JS, 'utf8')
const renderer = require(RENDERER)

// ── harness ──────────────────────────────────────────────────────────────
function makeCtx (o) {
  const opt = o || {}
  const handler = {
    get: function (t, k) {
      if (k === 'draw') return function (_reserve, cb) { if (opt.noCallback) return; if (cb) cb() }
      if (k === 'drawImage') return function () { if (opt.qrThrows) throw new Error('qr missing'); }
      if (k === 'measureText') return function (s) { return { width: String(s).length * 10 } }
      if (k === 'createCircularGradient') return function () { return { addColorStop: function () {} } }
      return function () {}
    },
  }
  return new Proxy({}, handler)
}

function loadPreview (behavior) {
  const b = behavior || {}
  const calls = []
  const timers = []
  let timerId = 0
  let page = null

  const sandbox = {
    require: (req) => {
      if (req.indexOf('aiReportService') >= 0) return { generateAiReport: async () => ({ code: 0, data: {} }) }
      if (req.indexOf('analytics') >= 0) return { track: () => {}, flush: () => {} }
      if (req.indexOf('worldModelPosterContent') >= 0) return require(path.join(ROOT, 'utils', 'worldModelPosterContent.js'))
      if (req.indexOf('worldModelPosterRenderer') >= 0) {
        if (b.rendererThrows) return { drawPoster: function () { throw new Error('boom') } }
        return require(path.join(ROOT, 'utils', 'worldModelPosterRenderer.js'))
      }
      throw new Error('unexpected require: ' + req)
    },
    Page: (c) => { page = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
    setTimeout: (fn, ms) => { const id = ++timerId; timers.push({ id, fn, ms, cleared: false }); return id },
    clearTimeout: (id) => { const t = timers.find((x) => x.id === id); if (t) t.cleared = true },
    setInterval: () => 0, clearInterval: () => {},
    wx: {
      createCanvasContext: () => makeCtx(b),
      canvasToTempFilePath: (opt) => {
        calls.push({ m: 'canvasToTempFilePath' })
        if (b.exportHang) return
        if (b.exportFail) return opt.fail && opt.fail({ errMsg: 'export fail' })
        opt.success && opt.success({ tempFilePath: '/tmp/poster.png' })
      },
      showLoading: () => calls.push({ m: 'showLoading' }),
      hideLoading: () => calls.push({ m: 'hideLoading' }),
      showToast: (o) => calls.push({ m: 'showToast', o }),
      navigateTo: (o) => calls.push({ m: 'navigateTo', url: o.url }),
      redirectTo: (o) => calls.push({ m: 'redirectTo', url: o.url }),
      showModal: (o) => calls.push({ m: 'showModal', opt: o }),
      saveImageToPhotosAlbum: () => {}, openSetting: () => {},
    },
    getApp: () => ({ globalData: {} }),
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(PREVIEW_JS, 'utf8'), sandbox, { filename: PREVIEW_JS })
  const inst = Object.assign({}, page)
  inst.data = JSON.parse(JSON.stringify(page.data || {}))
  inst.setData = function (o) { Object.assign(this.data, o) }
  inst._calls = calls
  inst._timers = timers
  inst._runTimers = function () {
    this._timers.filter((t) => !t.cleared).forEach((t) => t.fn())
    // mark run so they don't fire twice (except re-armed, which won't happen here)
    this._timers.filter((t) => !t.cleared).forEach((t) => { t.cleared = true })
  }
  return inst
}

const RD = { basicInsight: 'A', mechanism: 'B', reverseReasoning: 'C', biasCorrection: 'D', actionPlan: 'E1；E2' }

// ── A · challenge_final mounts posterCanvas (common page root) ──
{
  const canvasMatches = wxml.match(/<canvas[^>]*canvas-id="posterCanvas"[^>]*>/g) || []
  ok(canvasMatches.length === 1, 'A exactly ONE shared posterCanvas')
  const idx = wxml.indexOf('canvas-id="posterCanvas"')
  const diagIdx = wxml.indexOf("reportType==='diagnostic'")
  ok(idx >= 0 && idx < diagIdx, 'A posterCanvas mounted at common page root (before diagnostic branch)')
  const tag = canvasMatches[0] || ''
  ok(/width:1080px/.test(tag) && /height:1920px/.test(tag), 'A canvas logical size 1080x1920')
  ok(/left:-9999px/.test(tag) && /top:-9999px/.test(tag), 'A canvas offscreen positioned')
  ok(!/display:\s*none/.test(tag), 'A display:none forbidden')
  ok(/pointer-events:\s*none/.test(tag), 'A pointer-events none')
}

// ── B · draw callback fires -> export called + terminal cleanup ──
{
  const p = loadPreview()
  p.setData({ reportType: 'challenge_final', reportData: RD })
  p.generatePoster()
  ok(p._calls.some((c) => c.m === 'showLoading'), 'B showLoading called')
  ok(p._calls.some((c) => c.m === 'canvasToTempFilePath'), 'B export called after draw callback')
  ok(p._calls.some((c) => c.m === 'hideLoading'), 'B hideLoading on terminal')
  ok(p.data.posterGenerating === false, 'B posterGenerating false after terminal')
  ok(p.data.showPoster === true, 'B preview opened (success)')
  ok(p.data.posterImageUrl === '/tmp/poster.png', 'B poster image bound')
}

// ── C · draw callback never fires -> draw watchdog fires + cleanup + retry ──
{
  const p = loadPreview({ noCallback: true })
  p.setData({ reportType: 'challenge_final', reportData: RD })
  p.generatePoster()
  ok(!p._calls.some((c) => c.m === 'canvasToTempFilePath'), 'C export NOT called before watchdog')
  ok(p.data.posterGenerating === true, 'C generating before watchdog')
  p._runTimers()   // fire draw watchdog
  ok(p._calls.some((c) => c.m === 'hideLoading'), 'C hideLoading after draw watchdog')
  ok(p.data.posterGenerating === false, 'C posterGenerating false after draw watchdog')
  ok(p._calls.some((c) => c.m === 'showToast'), 'C fail toast shown')
  // retry possible
  const p2 = loadPreview()
  p2.setData({ reportType: 'challenge_final', reportData: RD })
  p2.data.posterGenerating = false
  p2.generatePoster()
  ok(p2._calls.filter((c) => c.m === 'showLoading').length === 1, 'C retry after watchdog allowed')
}

// ── D · export success -> preview reachable + cleanup (== B, explicit) ──
{
  const p = loadPreview()
  p.setData({ reportType: 'challenge_final', reportData: RD })
  p.generatePoster()
  ok(p.data.showPoster === true && p.data.posterGenerating === false, 'D export success -> preview + cleanup')
  const toasts = p._calls.filter((c) => c.m === 'showToast')
  ok(toasts.length === 0, 'D no failure toast on success')
}

// ── E · export fail -> cleanup + retry ──
{
  const p = loadPreview({ exportFail: true })
  p.setData({ reportType: 'challenge_final', reportData: RD })
  p.generatePoster()
  ok(p.data.posterGenerating === false, 'E posterGenerating false after export fail')
  ok(p._calls.some((c) => c.m === 'hideLoading'), 'E hideLoading after export fail')
  ok(p._calls.some((c) => c.m === 'showToast'), 'E fail toast after export fail')
  ok(p.data.showPoster === false, 'E no preview on export fail')
}

// ── F · export callback hangs -> export watchdog fires + cleanup ──
{
  const p = loadPreview({ exportHang: true })
  p.setData({ reportType: 'challenge_final', reportData: RD })
  p.generatePoster()
  ok(p._calls.some((c) => c.m === 'canvasToTempFilePath'), 'F export invoked')
  ok(p.data.posterGenerating === true, 'F still generating while export hangs')
  p._runTimers()   // fire export watchdog (draw timer already cleared by callback)
  ok(p.data.posterGenerating === false, 'F posterGenerating false after export watchdog')
  ok(p._calls.some((c) => c.m === 'hideLoading'), 'F hideLoading after export watchdog')
}

// ── G · renderer throws synchronously -> cleanup ──
{
  const p = loadPreview({ rendererThrows: true })
  p.setData({ reportType: 'challenge_final', reportData: RD })
  p.generatePoster()
  ok(p.data.posterGenerating === false, 'G posterGenerating false after sync throw')
  ok(p._calls.some((c) => c.m === 'hideLoading'), 'G hideLoading after sync throw')
  ok(p._calls.some((c) => c.m === 'showToast'), 'G fail toast after sync throw')
  ok(!p._calls.some((c) => c.m === 'canvasToTempFilePath'), 'G no export after sync throw')
}

// ── H · QR asset missing -> poster still generated without QR ──
{
  const content = require(path.join(ROOT, 'utils', 'worldModelPosterContent.js'))
  const ctx = makeCtx({ qrThrows: true })
  let threw = false, out = null
  try { out = renderer.drawPoster(ctx, content.buildPosterContent(RD), { qrPath: '/images/missing.png' }) } catch (e) { threw = true }
  ok(!threw, 'H renderer does not throw without QR')
  ok(out && out.hasQR === false, 'H hasQR false when asset missing')
  ok(out && out.width === 1080 && out.height === 1920, 'H poster still produced at 1080x1920')
  // and the page-level default points at an existing asset
  ok(/qrcodePath:\s*'\/images\/qrcode\.png'/.test(js), 'H default qrcodePath points to existing asset')
  ok(!/gh_qrcode/.test(js), 'H broken gh_qrcode path removed')
}

// ── I · second tap while generating -> blocked ──
{
  const p = loadPreview({ noCallback: true })
  p.setData({ reportType: 'challenge_final', reportData: RD })
  p.generatePoster()
  p.generatePoster()
  ok(p._calls.filter((c) => c.m === 'showLoading').length === 1, 'I re-entrant tap blocked')
}

// ── J · tap after failed generation -> allowed ──
{
  const p = loadPreview({ rendererThrows: true })
  p.setData({ reportType: 'challenge_final', reportData: RD })
  p.generatePoster()                 // fails, terminal
  ok(p.data.posterGenerating === false, 'J terminal after fail')
  const before = p._calls.filter((c) => c.m === 'showLoading').length
  p.generatePoster()                 // retry allowed
  ok(p._calls.filter((c) => c.m === 'showLoading').length === before + 1, 'J retry after fail allowed')
}

// ── unified cleanup / watchdog source invariants ──
{
  ok(/_finishPosterGeneration\s*\(/.test(js), 'single cleanup fn present')
  ok(/}, 4000\)/.test(js), 'draw watchdog 4000ms present')
  ok(/}, 6000\)/.test(js), 'export watchdog 6000ms present')
  ok(js.indexOf('_drawWatchdogTimer') >= 0 && js.indexOf('_exportWatchdogTimer') >= 0, 'both timers tracked')
  // cleanup must reset posterGenerating exactly once inside the unified fn
  const finish = (js.split('_finishPosterGeneration(_ok, msg) {')[1] || '').split('},')[0]
  ok(/posterGenerating:\s*false/.test(finish), 'cleanup resets posterGenerating')
  ok(/wx\.hideLoading/.test(finish), 'cleanup hides loading')
  // no duplicated manual reset arms in the world-model path
  const worldModel = (js.split('_generateWorldModelPoster() {')[1] || '').split('savePoster() {')[0]
  ok(!/posterGenerating:\s*false/.test(worldModel), 'no duplicated manual reset arm in world-model path')
}

console.log('\nposter-recovery_TEST pass=' + pass + ' fail=' + fail)
process.exit(fail ? 1 : 0)
