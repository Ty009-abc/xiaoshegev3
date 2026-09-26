/**
 * pages/legacy6q-report/legacy6q-report.js
 *
 * RC8.8_STAGE2_R5_LEGACY_THINKING_PAGE_REVIVAL — 2026-07-11 legacy 6Q result UI
 * (Progressive Reveal + Canvas poster + share), now fed by a READY report that
 * the dedicated thinking page produced with ONE model call.
 *
 * §4 REPORT_PAGE_OPENS_WITH_COMPLETE_CONTENT = YES:
 *   The result page makes NO model call and generates NO loading skeleton. It
 *   reads the completed five-field report from the temporary handoff and shows
 *   it immediately. Existing progressive reveal (300/700/1100/1500/1900) may
 *   still run, but NO card ever contains loading placeholder text.
 *
 * §10: an emergency failure state exists (missing / invalid handoff only). It is
 * NOT the normal path and it never renders five empty skeletons.
 *
 * Visible order: 01 致命一句话 → 02 核心问题 → 03 系统困局 → 04 翻身路径 → 05 行动建议.
 *
 * @version legacy_ui_0711 + turnaround_strategy_6q_v1 (ready-handoff)
 */

'use strict'

const app = getApp()
const cognitionEntry = require('../../utils/cognitionEntry.js')
const QUESTIONNAIRE_ROUTE = '/pages/turnaround-6q-questionnaire/turnaround-6q-questionnaire'
const REVEAL_DELAYS = [300, 700, 1100, 1500, 1900]

Page({
  data: {
    error: '',
    cancelled: false,
    posterGenerating: false,
    posterPath: '',
    showPoster: false,
    qrPath: '/images/qrcode.png',
    sections: [
      { key: 'fatal',      label: '⚡ 致命一句话', revealed: false, text: '' },
      { key: 'core',       label: '🎯 核心问题',   revealed: false, text: '' },
      { key: 'trap',       label: '🔍 系统困局',   revealed: false, text: '' },
      { key: 'turnaround', label: '🚀 翻身路径',   revealed: false, text: '' },
      { key: 'advice',     label: '📋 行动建议',   revealed: false, text: '' },
    ],
  },

  onLoad (opt) {
    // §12 — consume the READY report from the temporary handoff. Never regenerate.
    const report = app.globalData._legacy6qReport
    app.globalData._legacy6qReport = null
    app.globalData._legacy6qReportRequestId = null
    app.globalData._legacy6qReportAt = null

    if (!report) {
      // §10 emergency state only — the thinking page is the normal error surface.
      this.setData({ error: '报告数据丢失，请重新推演' })
      return
    }
    // P0 — mirror the home page's feed-driven `_strikeId` so the「每日认知」entry
    // opens the SAME 今日认知暴击 as home. Non-blocking: never delays the reveal.
    try { cognitionEntry.primeStrikeContext(this) } catch (_) {}
    this._progressiveReveal(report)
  },

  /* ═══════════════════════════════════
     Ready report → progressive reveal (§9).
     All five fields are already present; reveal only controls the animation.
     ═══════════════════════════════════ */
  _progressiveReveal (data) {
    const self = this
    const fields = [
      data.fatal_sentence || data.fatalSentence || '',
      data.core_problem || data.coreProblem || '',
      data.system_trap || data.systemTrap || '',
      data.turnaround_path || data.turnaroundPath || data.strategy_path || '',
      data.action_advice || data.actionAdvice || (Array.isArray(data.advice) ? data.advice.join('\n') : ''),
    ]

    // Populate the complete content up-front (NO skeletons), then reveal cards.
    const sections = this.data.sections.map((s, i) => ({ ...s, text: fields[i] || '分析未命中此维度' }))
    this.setData({ sections })

    REVEAL_DELAYS.forEach((delay, i) => {
      setTimeout(() => {
        if (this.data.cancelled) return
        const next = [...this.data.sections]
        next[i].revealed = true
        self.setData({ sections: next })
      }, delay)
    })
  },

  onUnload () {
    this.setData({ cancelled: true })
  },

  onRetry () {
    wx.redirectTo({ url: QUESTIONNAIRE_ROUTE + '?mode=diagnostic' })
  },

  /* ═══════════════════════════════════
     接下来去哪儿 — 三入口跳转
     （已有页面直接走现有路由；缺失则兜底不报错）
     ═══════════════════════════════════ */
  _safeNavigate (url) {
    if (!url) return
    wx.navigateTo({
      url,
      fail: (err) => {
        console.warn('[legacy6q-report] navigateTo 失败:', url, err)
        wx.showToast({ title: '页面暂不可用', icon: 'none' })
      },
    })
  },

  goWorldRules () {
    cognitionEntry.openWorldRules()
  },

  // 每日认知 — 复用首页「今日认知暴击」同一导航权限
  // （旧 /pages/cognition-daily 已降级为兜底，不再作为主路径）
  goCognitionDaily () {
    cognitionEntry.openDailyCognition(this)
  },

  // ai-chat 是 tabBar 页，必须用 switchTab
  goAskXiaoshige () {
    cognitionEntry.openAskXiaoshige()
  },

  /* ═══════════════════════════════════
     海报生成引擎（旧版 API / 750 x 动态高）
     ═══════════════════════════════════ */
  generatePoster () {
    if (this.data.posterGenerating) return
    this.setData({ posterGenerating: true })
    wx.showLoading({ title: '正在生成海报...', mask: true })

    const ctx = wx.createCanvasContext('posterCanvas', this)
    const W = 750
    const safeX = 40
    const cardW = 670
    const leftW = 112
    const textX = safeX + leftW + 28
    const textMaxW = cardW - leftW - 52
    const qrPath = this.data.qrPath || '/images/qrcode.png'

    const sections = this.data.sections || []

    const cards = [
      { no: '01', icon: '⚡', title: '致命一句话', color: '#ff3b3b', text: (sections[0] || {}).text || '' },
      { no: '02', icon: '🎯', title: '核心问题',   color: '#8b5cff', text: (sections[1] || {}).text || '' },
      { no: '03', icon: '🔍', title: '系统困局',   color: '#3b8cff', text: (sections[2] || {}).text || '' },
      { no: '04', icon: '🚀', title: '翻身路径',   color: '#ff9f1a', text: (sections[3] || {}).text || '' },
      { no: '05', icon: '📋', title: '行动建议',   color: '#39d353', text: (sections[4] || {}).text || '' },
    ]

    function roundRect (x, y, w, h, r) {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
    }

    function splitLines (text, maxWidth, size) {
      ctx.setFontSize(size)
      const chars = String(text || '').replace(/\n/g, ' ').split('')
      let line = ''
      const lines = []
      chars.forEach((ch) => {
        const test = line + ch
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line)
          line = ch
        } else {
          line = test
        }
      })
      if (line) lines.push(line)
      return lines
    }

    function splitActionLines (text) {
      return String(text || '')
        .replace(/；/g, '；\n')
        .replace(/。/g, '。\n')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    }

    function drawWrappedLines (lines, x, y, lineHeight, color, size) {
      ctx.setTextAlign('left')
      ctx.setFontSize(size)
      ctx.setFillStyle(color)
      lines.forEach((line, i) => {
        ctx.fillText(line, x, y + i * lineHeight)
      })
    }

    function drawGlow (x, y, r, color, alpha) {
      const g = ctx.createCircularGradient(x, y, r)
      g.addColorStop(0, color)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.setGlobalAlpha(alpha)
      ctx.setFillStyle(g)
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
      ctx.setGlobalAlpha(1)
    }

    // 预计算每张卡片真实高度
    cards.forEach((item, index) => {
      if (index === 4) {
        const points = splitActionLines(item.text)
        let totalLines = 0
        item._points = points.map((p) => {
          const lines = splitLines(p, textMaxW - 30, 22)
          totalLines += lines.length
          return lines
        })
        item._height = Math.max(220, 90 + totalLines * 28 + points.length * 8 + 30)
      } else {
        item._lines = splitLines(item.text, textMaxW, 26)
        item._height = Math.max(145, 95 + item._lines.length * 34 + 28)
      }
    })

    const headerH = 180
    const gap = 14
    const cardsH = cards.reduce((sum, item) => sum + item._height, 0) + gap * (cards.length - 1)
    const ctaH = 150
    const footerH = 80
    const H = headerH + cardsH + 60 + ctaH + footerH

    // 背景
    ctx.setFillStyle('#050914')
    ctx.fillRect(0, 0, W, H)

    drawGlow(160, 120, 220, '#7b3cff', 0.26)
    drawGlow(620, 120, 240, '#ff2d75', 0.18)
    drawGlow(375, H - 220, 300, '#2d6bff', 0.18)

    // 标题
    ctx.setTextAlign('center')
    ctx.setFontSize(42)
    ctx.setFillStyle('#ffffff')
    ctx.fillText('珠澳小事哥 · 认知翻身策略', W / 2, 76)

    ctx.setFontSize(26)
    ctx.setFillStyle('#ff5ca8')
    ctx.fillText('🧠 认知教练视角已激活', W / 2, 122)

    ctx.setStrokeStyle('rgba(255,92,168,0.45)')
    ctx.setLineWidth(1)
    ctx.beginPath()
    ctx.moveTo(70, 145)
    ctx.lineTo(680, 145)
    ctx.stroke()

    // 卡片
    let y = 180

    cards.forEach((item, index) => {
      const h = item._height

      roundRect(safeX, y, cardW, h, 16)
      ctx.setFillStyle('rgba(8,14,32,0.88)')
      ctx.fill()
      ctx.setStrokeStyle(item.color)
      ctx.setLineWidth(1.5)
      ctx.stroke()

      ctx.setGlobalAlpha(0.16)
      ctx.setFillStyle(item.color)
      ctx.fillRect(safeX, y, leftW, h)
      ctx.setGlobalAlpha(1)

      ctx.setTextAlign('center')
      ctx.setFontSize(52)
      ctx.setFillStyle(item.color)
      ctx.fillText(item.no, safeX + leftW / 2, y + 62)

      ctx.setFontSize(40)
      ctx.fillText(item.icon, safeX + leftW / 2, y + 112)

      ctx.setTextAlign('left')
      ctx.setFontSize(30)
      ctx.setFillStyle(item.color)
      ctx.fillText(item.icon + ' ' + item.title, textX, y + 46)

      if (index === 4) {
        let py = y + 86
        item._points.forEach((lines) => {
          ctx.setFontSize(22)
          ctx.setFillStyle('#39d353')
          ctx.fillText('•', textX, py)
          drawWrappedLines(lines, textX + 24, py, 28, '#eaf0ff', 22)
          py += lines.length * 28 + 8
        })
      } else {
        drawWrappedLines(item._lines, textX, y + 86, 34, '#eaf0ff', 26)
      }

      y += h + gap
    })

    // CTA
    const ctaY = y + 48

    roundRect(safeX, ctaY, cardW, ctaH, 24)
    ctx.setFillStyle('rgba(10,12,40,0.94)')
    ctx.fill()
    ctx.setStrokeStyle('#7b5cff')
    ctx.setLineWidth(2)
    ctx.stroke()

    roundRect(safeX + 20, ctaY + 20, 110, 110, 18)
    ctx.setFillStyle('#ffffff')
    ctx.fill()
    ctx.drawImage(qrPath, safeX + 28, ctaY + 28, 94, 94)

    ctx.setTextAlign('left')
    ctx.setFontSize(34)
    ctx.setFillStyle('#ff45c8')
    ctx.fillText('扫码测试你的翻身策略', safeX + 150, ctaY + 58)

    ctx.setFontSize(28)
    ctx.setFillStyle('#ffffff')
    ctx.fillText('看看你的认知在什么段位', safeX + 150, ctaY + 96)

    const tags = ['🧠 认知诊断', '📈 策略分析', '🎯 破局建议']
    tags.forEach((tag, i) => {
      const tx = safeX + 150 + i * 142
      roundRect(tx, ctaY + 111, 124, 25, 11)
      ctx.setFillStyle('rgba(123,92,255,0.14)')
      ctx.fill()
      ctx.setStrokeStyle('rgba(180,130,255,0.7)')
      ctx.stroke()
      ctx.setFontSize(15)
      ctx.setFillStyle('#d9d6ff')
      ctx.setTextAlign('center')
      ctx.fillText(tag, tx + 62, ctaY + 129)
    })

    ctx.setTextAlign('center')
    ctx.setFontSize(22)
    ctx.setFillStyle('#7b6dff')
    ctx.fillText('»»» 长按识别小程序码 · 开启你的认知翻身之路 «««', W / 2, H - 30)

    const self = this
    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'posterCanvas',
        x: 0,
        y: 0,
        width: W,
        height: H,
        destWidth: W * 2,
        destHeight: H * 2,
        success: (res) => {
          self.setData({ posterPath: res.tempFilePath, posterGenerating: false, showPoster: true })
          wx.hideLoading()
          self._saveToAlbum(res.tempFilePath)
        },
        fail: (err) => {
          console.error('[poster] 生成失败:', err)
          self.setData({ posterGenerating: false })
          wx.hideLoading()
          wx.showToast({ title: '海报生成失败', icon: 'none' })
        },
      }, self)
    })
  },

  _saveToAlbum (filePath) {
    const self = this
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        self.setData({ posterGenerating: false })
        wx.showModal({ title: '保存成功', content: '海报已保存，可发朋友圈裂变', showCancel: false })
      },
      fail: (err) => {
        self.setData({ posterGenerating: false })
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '授权提示',
            content: '请允许开启相册写入权限',
            success: (res) => { if (res.confirm) wx.openSetting() },
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      },
    })
  },

  /* ═══════════════════════════════════
     分享好友
     ═══════════════════════════════════ */
  onShareAppMessage () {
    return {
      title: '我刚生成了一份认知翻身报告，你也测测',
      path: '/pages/home/home?from=report_share',
      imageUrl: this.data.posterPath || '',
    }
  },
})
