/**
 * pages/report-detail — v3.18 Report Poster Share Mode
 *   Progressive Reveal + Canvas海报 + 分享好友
 */
const aiReportService = require('../../services/aiReportService.js')
const app = getApp()
const REVEAL_DELAYS = [300, 700, 1100, 1500, 1900]

Page({
  data: {
    reportId: '',
    mode: 'diagnostic',
    loading: true,
    cancelled: false,
    posterGenerating: false,
    posterPath: '',          // 海报临时路径（用于分享图）
    showPoster: false,       // 海报预览模态
    qrPath: '/images/qrcode.png',
    sections: [
      { key: 'fatal',      label: '⚡ 致命一句话', revealed: false, text: '' },
      { key: 'core',       label: '🎯 核心问题',   revealed: false, text: '' },
      { key: 'trap',       label: '🔍 系统困局',   revealed: false, text: '' },
      { key: 'turnaround', label: '🚀 翻身路径',   revealed: false, text: '' },
      { key: 'advice',     label: '📋 行动建议',   revealed: false, text: '' },
    ],
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
      this.setData({ loading: false })
      wx.showToast({ title: '诊断数据丢失，请重新开始', icon: 'none' })
      setTimeout(() => wx.redirectTo({ url: '/pages/challenge-play/challenge-play?mode=diagnostic' }), 1500)
      return
    }

    try {
      const r = await aiReportService.generateDiagnosticReport({
        answers,
        personality: p?.name || '',
        personalityEmoji: p?.emoji || '',
        personalityStyle: p?.style || '',
      })
      if (r.code === 0 && r.data) {
        this._progressiveReveal(r.data)
      } else {
        this._showError(r.message || '分析失败')
      }
    } catch (e) {
      console.error('[report-detail] AI 生成失败:', e)
      this._showError('AI 诊断引擎暂时离线')
    }
  },

  /* ═══════════════════════════════════
     Step 2: 分段揭晓
     ═══════════════════════════════════ */
  _progressiveReveal(data) {
    const self = this
    const fields = [
      data.fatal_sentence || data.fatalSentence || '',
      data.core_problem || data.coreProblem || '',
      data.system_trap || data.systemTrap || '',
      data.turnaround_path || data.turnaroundPath || data.strategy_path || '',
      data.action_advice || data.actionAdvice || (Array.isArray(data.advice) ? data.advice.join('\n') : ''),
    ]

    this.setData({ loading: false })

    REVEAL_DELAYS.forEach((delay, i) => {
      setTimeout(() => {
        const sections = [...this.data.sections]
        sections[i].revealed = true
        sections[i].text = fields[i] || '分析未命中此维度'
        self.setData({ sections })
      }, delay)
    })
  },

  /* ═══════════════════════════════════
     Step 3: 错误处理
     ═══════════════════════════════════ */
  _showError(msg) {
    this.setData({ loading: false })
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
     海报生成引擎
     ═══════════════════════════════════ */
  generatePoster() {
    if (this.data.posterGenerating) return
    this.setData({ posterGenerating: true })
    wx.showLoading({ title: '正在生成海报...', mask: true })

    const ctx = wx.createCanvasContext('posterCanvas', this)
    const W = 750
    const H = 1334
    const safeX = 40
    const cardW = 670
    const leftW = 112
    const textStartX = safeX + leftW + 28
    const textMaxW = cardW - leftW - 52

    const sections = this.data.sections || []
    const qrPath = this.data.qrPath || '/images/qrcode.png'

    const cards = [
      { no: '01', icon: '⚡', title: '致命一句话', color: '#ff3b3b', text: sections[0]?.text || '' },
      { no: '02', icon: '🎯', title: '核心问题',   color: '#8b5cff', text: sections[1]?.text || '' },
      { no: '03', icon: '🔍', title: '系统困局',   color: '#3b8cff', text: sections[2]?.text || '' },
      { no: '04', icon: '🚀', title: '翻身路径',   color: '#ff9f1a', text: sections[3]?.text || '' },
      { no: '05', icon: '📋', title: '行动建议',   color: '#39d353', text: sections[4]?.text || '' }
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

    function drawWrappedText(text, x, y, maxWidth, lineHeight, maxLines, color, size) {
      ctx.setTextAlign('left')
      ctx.setFontSize(size)
      ctx.setFillStyle(color)

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

      const final = lines.slice(0, maxLines)
      if (lines.length > maxLines) {
        final[maxLines - 1] = final[maxLines - 1].slice(0, -1) + '…'
      }

      final.forEach((l, i) => {
        ctx.fillText(l, x, y + i * lineHeight)
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

    // 背景
    ctx.setFillStyle('#050914')
    ctx.fillRect(0, 0, W, H)
    drawGlow(160, 120, 220, '#7b3cff', 0.26)
    drawGlow(620, 120, 240, '#ff2d75', 0.18)
    drawGlow(375, 1120, 300, '#2d6bff', 0.18)

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

    // 内容卡片
    let y = 180

    cards.forEach((item, index) => {
      const isLast = index === 4
      const h = isLast ? 220 : 145

      // 卡片背景
      roundRect(safeX, y, cardW, h, 16)
      ctx.setFillStyle('rgba(8,14,32,0.88)')
      ctx.fill()
      ctx.setStrokeStyle(item.color)
      ctx.setLineWidth(1.5)
      ctx.stroke()

      // 左侧编号区
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

      // 标题
      ctx.setTextAlign('left')
      ctx.setFontSize(30)
      ctx.setFillStyle(item.color)
      ctx.fillText(item.icon + ' ' + item.title, textStartX, y + 46)

      // 正文
      if (isLast) {
        const points = String(item.text || '')
          .replace(/。/g, '。\n')
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean)
          .slice(0, 5)

        points.forEach((p, i) => {
          const py = y + 82 + i * 27
          ctx.setFontSize(22)
          ctx.setFillStyle('#39d353')
          ctx.fillText('•', textStartX, py)
          drawWrappedText(p, textStartX + 22, py, textMaxW - 22, 26, 1, '#eaf0ff', 22)
        })
      } else {
        drawWrappedText(item.text, textStartX, y + 84, textMaxW, 32, 2, '#eaf0ff', 26)
      }

      y += h + 14
    })

    // 底部 CTA 区
    const ctaY = 1120
    const ctaH = 150

    roundRect(safeX, ctaY, cardW, ctaH, 24)
    ctx.setFillStyle('rgba(10,12,40,0.94)')
    ctx.fill()
    ctx.setStrokeStyle('#7b5cff')
    ctx.setLineWidth(2)
    ctx.stroke()

    // 二维码底座
    roundRect(safeX + 20, ctaY + 20, 110, 110, 18)
    ctx.setFillStyle('#ffffff')
    ctx.fill()
    ctx.drawImage(qrPath, safeX + 28, ctaY + 28, 94, 94)

    // CTA 文字
    ctx.setTextAlign('left')
    ctx.setFontSize(34)
    ctx.setFillStyle('#ff45c8')
    ctx.fillText('扫码测试你的翻身策略', safeX + 150, ctaY + 58)

    ctx.setFontSize(28)
    ctx.setFillStyle('#ffffff')
    ctx.fillText('看看你的认知在什么段位', safeX + 150, ctaY + 96)

    // 三标签
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

    // 底部提示
    ctx.setTextAlign('center')
    ctx.setFontSize(22)
    ctx.setFillStyle('#7b6dff')
    ctx.fillText('»»» 长按识别小程序码 · 开启你的认知翻身之路 «««', W / 2, 1310)

    const self = this
    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'posterCanvas',
        width: 750,
        height: 1334,
        destWidth: 1500,
        destHeight: 2668,
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
    const self = this
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        self.setData({ posterGenerating: false })
        wx.showModal({
          title: '保存成功',
          content: '海报已保存，可发朋友圈裂变',
          showCancel: false,
        })
      },
      fail: (err) => {
        self.setData({ posterGenerating: false })
        if (err.errMsg.includes('auth deny')) {
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
  onShareAppMessage() {
    return {
      title: '我刚生成了一份认知翻身报告，你也测测',
      path: '/pages/home/home?from=report_share',
      imageUrl: this.data.posterPath || '',
    }
  },
})
