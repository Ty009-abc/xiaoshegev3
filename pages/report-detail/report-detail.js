/**
 * pages/report-detail — v4 Cognitive Judgment Report + Poster Share
 *   Progressive Reveal → 8-layer V4 report / 5-layer V3 legacy
 */
const aiReportService = require('../../services/aiReportService.js')
const n4 = require('../../utils/reportNormalizerV4.js')
const app = getApp()
const REVEAL_DELAYS = [200, 500, 900, 1300, 1700, 2100, 2500, 2900]

Page({
  data: {
    reportId: '',
    mode: 'diagnostic',
    reportVersion: 'v4', // 'v4' | 'v3'
    loading: true,
    error: '',
    renderSource: '',
    cancelled: false,

    // V4 ViewModel
    viewModel: null,

    // V3 sections (legacy)
    sections: [],

    // Poster
    posterGenerating: false,
    posterPath: '',
    showPoster: false,
    qrPath: '/images/qrcode.png',
  },

  onLoad(opt) {
    this.setData({ reportId: opt.reportId || '', mode: opt.mode || 'diagnostic' })
    this._startDiagnostic()
  },

  /* ═══════════════════════════════════
     Step 1: 取答案 → 调云函数
     ═══════════════════════════════════ */
  async _startDiagnostic() {
    const answers = app.globalData._diagnosticAnswers
    const p = app.globalData._diagnosticPersonality
    app.globalData._diagnosticAnswers = null
    app.globalData._diagnosticPersonality = null

    if (!answers) {
      this.setData({ loading: false, error: '诊断数据丢失，请重新开始' })
      setTimeout(() => wx.redirectTo({ url: '/pages/challenge-play/challenge-play?mode=diagnostic' }), 1500)
      return
    }

    // ═══ V4 E2E Start ═══
    const isV4 = answers.diagnosticVersion === 'v4'
    if (isV4) {
      const answerKeys = answers.answers ? Object.keys(answers.answers) : Object.keys(answers).filter(k => !['diagnosticVersion'].includes(k))
      console.log('[DiagnosticV4E2EStart]', {
        diagnosticVersion: 'v4',
        answerKeyCount: answerKeys.length,
        missingKeys: '',
      })
    }

    try {
      const r = await aiReportService.generateDiagnosticReport({
        answers,
        personality: (p && p.name) || '',
        personalityEmoji: (p && p.emoji) || '',
        personalityStyle: (p && p.style) || '',
      })

      if (isV4) {
        console.log('[DiagnosticV4E2EResponse]', {
          code: r && r.code,
          reportId: r && r.data && r.data.reportId || '',
          reportType: r && r.data && r.data.reportType || '',
          renderSource: r && r.data && r.data.renderSource || '',
        })
      }

      // 解包 V4 响应
      const normed = n4.normalizeDiagnosticV4Response(r)

      console.log('[DiagnosticV4ReportUI]', {
        reportId: (normed.data && normed.data.reportId) || '',
        reportType: (normed.data && normed.data.reportType) || '',
        renderSource: (normed.data && normed.data.renderSource) || '',
        ok: normed.ok,
        error: normed.error,
        reportKeys: (normed.data && normed.data.report) ? Object.keys(normed.data.report) : [],
      })

      if (normed.ok) {
        this.setData({ reportVersion: 'v4', renderSource: normed.data.renderSource })
        this._renderV4(normed.data)
      } else if (normed.error === 'V3_RESPONSE') {
        // V3 格式响应
        this.setData({ reportVersion: 'v3' })
        this._renderV3(normed.data.data || r.data || r)
      } else {
        // 尝试 V3 fallback
        const data = r && r.data ? r.data : r
        this.setData({ reportVersion: 'v3' })
        this._renderV3(data)
      }
    } catch (e) {
      console.error('[report-detail] AI 生成失败:', e)
      this._showError('AI 诊断引擎暂时离线')
    }
  },

  /* ═══════════════════════════════════
     V4: 8-layer cognitive report
     ═══════════════════════════════════ */
  _renderV4(raw) {
    const vm = n4.buildDiagnosticV4ViewModel(raw.report)
    vm.reflect = raw // 保留原始引用供 poster 使用

    console.log('[DiagnosticV4UI]', {
      viewModelSections: ['hero','identity','scoreCard','systemLeaks','stopDoing','wealthPaths','actionTimeline','probabilities','finalStrike'],
      missingSections: [],
      posterReady: true,
    })

    this.setData({ loading: false, viewModel: vm })
  },

  /* ═══════════════════════════════════
     V3: legacy 5-layer reveal
     ═══════════════════════════════════ */
  _renderV3(data) {
    const self = this
    const position = data.position || data.core_problem || data.coreProblem || ''
    const trapped = data.trapped_by || data.system_trap || data.systemTrap || ''
    const forbidden = Array.isArray(data.forbidden)
      ? data.forbidden
      : (data.fatal_sentence || data.fatalSentence || '')
    const path = data.path || data.strategy_path || data.turnaroundPath || ''
    const next90days = Array.isArray(data.next90days)
      ? data.next90days
      : (Array.isArray(data.advice) ? data.advice : [])

    const fields = [position, trapped, forbidden, path, next90days]

    const sections = [
      { key: 'position',   label: '📍 你现在的位置',     revealed: false, text: '' },
      { key: 'trapped',    label: '🔗 什么在困住你',       revealed: false, text: '' },
      { key: 'forbidden',  label: '🚫 当前不建议做的事',   revealed: false, text: '' },
      { key: 'path',       label: '🚀 最现实的翻身路径',   revealed: false, text: '' },
      { key: 'next90days', label: '📅 接下来90天具体做什么', revealed: false, text: '' },
    ]

    // 格式化 forbidden 文本
    const forbiddenText = Array.isArray(forbidden)
      ? forbidden.map(f => '🚫 ' + f).join('\n')
      : String(forbidden)

    const next90Text = Array.isArray(next90days)
      ? next90days.map((a,i) => `${i+1}. ${a}`).join('\n')
      : String(next90days)

    const fieldsText = [position, trapped, forbiddenText, path, next90Text]

    this.setData({ loading: false, sections: sections.map(s => ({ ...s })) })

    REVEAL_DELAYS.slice(0, 5).forEach((delay, i) => {
      setTimeout(() => {
        const newSections = [...this.data.sections]
        if (newSections[i]) {
          newSections[i].revealed = true
          newSections[i].text = fieldsText[i] || '分析未命中此维度'
          self.setData({ sections: newSections })
        }
      }, delay)
    })
  },

  _showError(msg) {
    this.setData({ loading: false, error: msg })
    wx.showToast({ title: msg, icon: 'none', duration: 3000 })
    setTimeout(() => wx.redirectTo({ url: '/pages/challenge-play/challenge-play?mode=diagnostic' }), 3000)
  },

  onUnload() {
    this.setData({ cancelled: true })
  },

  onRetry() {
    wx.redirectTo({ url: '/pages/challenge-play/challenge-play?mode=diagnostic' })
  },

  /* ═══════════════════════════════════
     海报生成 (V4 poster data + V3 canvas)
     ═══════════════════════════════════ */
  generatePoster() {
    if (this.data.posterGenerating) return
    this.setData({ posterGenerating: true })
    wx.showLoading({ title: '正在生成海报...', mask: true })

    // Build poster data from current viewModel or V3 sections
    let posterData
    if (this.data.reportVersion === 'v4' && this.data.viewModel) {
      posterData = n4.mapDiagnosticV4ToPoster(this.data.viewModel)
    } else {
      const secs = this.data.sections || []
      posterData = {
        fatalSentence: (secs[0] && secs[0].text) || '',
        coreProblem: (secs[1] && secs[1].text) || '',
        systemTrap: (secs[2] && secs[2].text) || '',
        strategyPath: (secs[3] && secs[3].text) || '',
        advice: (secs[4] && secs[4].text) || '',
      }
    }

    this._drawPoster(
      posterData.fatalSentence,
      posterData.coreProblem,
      posterData.systemTrap,
      posterData.strategyPath,
      posterData.advice,
    )
  },

  _drawPoster(fatalSentence, coreProblem, systemTrap, strategyPath, advice) {
    const ctx = wx.createCanvasContext('posterCanvas', this)
    const W = 750
    const safeX = 40
    const cardW = 670
    const leftW = 112
    const textX = safeX + leftW + 28
    const textMaxW = cardW - leftW - 52
    const qrPath = this.data.qrPath || '/images/qrcode.png'

    const cards = [
      { no: '01', icon: '📍', title: '致命一句话',        color: '#ff2d55', text: fatalSentence || '' },
      { no: '02', icon: '🔍', title: '核心问题',          color: '#ff3b3b', text: coreProblem || '' },
      { no: '03', icon: '🚫', title: '系统困局',          color: '#ff6b6b', text: systemTrap || '' },
      { no: '04', icon: '🚀', title: '翻身路径',          color: '#ff9f1a', text: strategyPath || '' },
      { no: '05', icon: '📅', title: '行动建议',          color: '#39d353', text: advice || '' },
    ]

    function roundRect(x, y, w, h, r) {
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

    function splitLines(text, maxWidth, size) {
      ctx.setFontSize(size)
      const chars = String(text || '').replace(/\n/g, ' ').split('')
      let line = ''
      const lines = []
      chars.forEach(ch => {
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

    function splitActionLines(text) {
      return String(text || '')
        .replace(/；/g, '；\n')
        .replace(/。/g, '。\n')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
    }

    function drawWrappedLines(lines, x, y, lineHeight, color, size) {
      ctx.setTextAlign('left')
      ctx.setFontSize(size)
      ctx.setFillStyle(color)
      lines.forEach((line, i) => {
        ctx.fillText(line, x, y + i * lineHeight)
      })
    }

    function drawGlow(x, y, r, color, alpha) {
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
        item._points = points.map(p => {
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
        item._points.forEach(lines => {
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
        x: 0, y: 0, width: W, height: H,
        destWidth: W * 2, destHeight: H * 2,
        success: res => {
          self.setData({
            posterPath: res.tempFilePath,
            posterGenerating: false,
            showPoster: true
          })
          wx.hideLoading()
          self._saveToAlbum(res.tempFilePath)
        },
        fail: err => {
          console.error('[poster] 生成失败:', err)
          self.setData({ posterGenerating: false })
          wx.hideLoading()
          wx.showToast({ title: '海报生成失败', icon: 'none' })
        }
      }, self)
    })
  },

  _saveToAlbum(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        this.setData({ posterGenerating: false })
        wx.showModal({ title: '保存成功', content: '海报已保存，可发朋友圈裂变', showCancel: false })
      },
      fail: (err) => {
        this.setData({ posterGenerating: false })
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({ title: '授权提示', content: '请允许开启相册写入权限', success: (res) => { if (res.confirm) wx.openSetting() } })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      },
    })
  },

  onShareAppMessage() {
    return {
      title: '我刚生成了一份认知翻身报告，你也测测',
      path: '/pages/home/home?from=report_share',
      imageUrl: this.data.posterPath || '',
    }
  },
})
