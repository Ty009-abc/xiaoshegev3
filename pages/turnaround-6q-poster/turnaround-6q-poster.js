/**
 * pages/turnaround-6q-poster/turnaround-6q-poster.js
 *
 * RC8.8 Stage2 (§18) — revived 6Q share poster.
 *
 * Uses the SAME report text as the report page (read from the locally persisted
 * 5-card report — NO poster-specific AI rewrite, NO recomputation). Order is the
 * product order: 致命一句话 / 核心问题 / 系统困局 / 翻身路径 / 行动建议.
 *
 * Canvas2D (`type="2d"`) — NOT the obsolete Canvas API. QR handling reuses the
 * current stable image (`/images/qrcode.png`) with runtime-safe guards.
 *
 * @version legacy6q_v1
 */

'use strict'

const app = getApp()
const CACHE_KEY = 'turnaround6q_last_report'
const QR_SRC = '/images/qrcode.png'

Page({
  data: {
    loading: true,
    hasReport: false,
    posterPath: '',
    generating: false,
    totalNavHeight: 0,
    lines: { fatal: '', core: '', trap: '', strategy: '', advice: '' },
  },

  onLoad () {
    this._initNavBar()
    this._load()
  },

  _initNavBar () {
    try {
      const s = (typeof wx.getWindowInfo === 'function') ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const m = wx.getMenuButtonBoundingClientRect()
      const sbh = s.statusBarHeight || 0
      const nbh = (m.top - sbh) * 2 + m.height
      this.setData({ totalNavHeight: sbh + nbh })
    } catch (_) {
      this.setData({ totalNavHeight: 88 })
    }
  },

  _load () {
    let result = app.globalData.turnaround6qResult
    if (!result) {
      try { result = wx.getStorageSync(CACHE_KEY) || null } catch (_) { result = null }
    }
    const d = (result && result.data) || null
    if (!d || d.reportState !== 'PRIMARY') {
      this.setData({ loading: false, hasReport: false })
      return
    }
    const advice = Array.isArray(d.advice) ? d.advice.map((x) => String(x || '').trim()).filter((x) => x) : []
    this._report = {
      // Poster order == product order (§18). SAME copy as the report page.
      fatal: String(d.fatal_sentence || ''),
      core: String(d.core_problem || ''),
      trap: String(d.system_trap || ''),
      strategy: String(d.strategy_path || ''),
      advice: advice.join('\n'),
      persona: d.personality || null,
    }
    this.setData({
      loading: false,
      hasReport: true,
      lines: {
        fatal: this._report.fatal,
        core: this._report.core,
        trap: this._report.trap,
        strategy: this._report.strategy,
        advice: advice.join(' / '),
      },
    })
  },

  _wrap (ctx, text, x, y, maxWidth, lineHeight) {
    const chars = String(text || '').split('')
    let line = ''
    let yy = y
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i]
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy)
        line = chars[i]
        yy += lineHeight
      } else {
        line = test
      }
    }
    if (line) { ctx.fillText(line, x, yy); yy += lineHeight }
    return yy
  },

  async generatePoster () {
    if (this.data.generating || !this._report) return
    this.setData({ generating: true })
    try {
      const canvas = await new Promise((resolve, reject) => {
        wx.createSelectorQuery().select('#posterCanvas')
          .fields({ node: true, size: true })
          .exec((res) => { (res && res[0] && res[0].node) ? resolve(res[0].node) : reject(new Error('NO_CANVAS_NODE')) })
      })
      const ctx = canvas.getContext('2d')
      const W = 600, H = 1000
      const dpr = 2
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)

      // background
      ctx.fillStyle = '#0a0a14'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#F5C16C'
      ctx.fillRect(40, 40, W - 80, 4)

      ctx.fillStyle = '#F5F7FA'
      ctx.font = 'bold 30px sans-serif'
      ctx.fillText('珠澳小事哥 · 翻身策略', 60, 100)

      let y = 170
      const L = { fatal: '☠️ 致命一句话', core: '🎯 核心问题', trap: '🔍 系统困局', strategy: '🚀 翻身路径', advice: '📋 行动建议' }
      const order = ['fatal', 'core', 'trap', 'strategy', 'advice']
      for (const k of order) {
        ctx.fillStyle = (k === 'fatal') ? '#ff6b6b' : '#7C5CFF'
        ctx.font = 'bold 24px sans-serif'
        ctx.fillText(L[k], 60, y)
        y += 40
        ctx.fillStyle = '#F5F7FA'
        ctx.font = (k === 'fatal') ? 'bold 26px sans-serif' : '22px sans-serif'
        y = this._wrap(ctx, this._report[k] || '—', 60, y, W - 120, 36) + 24
      }

      // footer + QR (runtime-safe: draw if the image loads, else text fallback)
      ctx.fillStyle = '#F5C16C'
      ctx.font = '22px sans-serif'
      ctx.fillText('扫码生成你的翻身策略 →', 60, H - 150)
      try {
        const img = canvas.createImage()
        await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; img.src = QR_SRC })
        if (img.width) ctx.drawImage(img, W - 170, H - 190, 110, 110)
      } catch (_) { /* QR optional — never break the poster */ }
      ctx.fillStyle = '#333'
      ctx.font = '16px sans-serif'
      ctx.fillText('珠澳小事哥 · 认知操作系统', 60, H - 60)

      const tmp = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({ canvas, success: (r) => resolve(r.tempFilePath), fail: reject })
      })
      this.setData({ posterPath: tmp, generating: false })
    } catch (e) {
      this.setData({ generating: false })
      wx.showToast({ title: '海报生成失败，请重试', icon: 'none' })
      console.error('[6QPoster]', (e && e.message) || e)
    }
  },

  onSave () {
    if (!this.data.posterPath) return
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterPath,
      success: () => wx.showToast({ title: '海报已保存到相册', icon: 'success' }),
      fail: () => wx.showToast({ title: '请允许保存相册权限', icon: 'none' }),
    })
  },

  onBack () { wx.navigateBack({ delta: 1 }) },
})
