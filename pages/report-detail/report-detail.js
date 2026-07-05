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
    const self = this
    this.setData({ posterGenerating: true })
    wx.showLoading({ title: '正在淬炼海报...', mask: true })

    // 安全兜底：sections 可能未初始化
    const sections = Array.isArray(this.data.sections) ? this.data.sections : []
    const getText = (i) => {
      const item = sections[i] || {}
      return item.text || item.content || ''
    }
    const data = {
      fatal:      getText(0),
      core:       getText(1),
      trap:       getText(2),
      turnaround: getText(3),
      advice:     getText(4),
    }

    // 校验：至少有一条内容才画
    const hasAnyContent = Object.values(data).some(v => v && v.trim().length > 0)
    if (!hasAnyContent) {
      wx.hideLoading()
      self.setData({ posterGenerating: false })
      wx.showToast({ title: '报告内容尚未生成，请等待', icon: 'none' })
      return
    }

    const CANVAS_WIDTH = 750
    const paddingX = 50
    const contentWidth = 650
    const TITLE_Y = 80
    const SUBTITLE_Y = 130
    const BODY_START_Y = 220
    const SEC_HEADER_H = 45
    const LINE_HEIGHT = 38
    const SEC_GAP = 65
    const QR_SIZE = 140
    const QR_GAP = 30
    const QR_TEXT_H = 40
    const BOT_PAD = 80

    const query = wx.createSelectorQuery()
    query.select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          wx.hideLoading()
          self.setData({ posterGenerating: false })
          wx.showToast({ title: '画布初始化失败', icon: 'none' })
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')

        const secDefs = [
          { label: '⚡ 致命一句话', text: data.fatal, isRed: true },
          { label: '🎯 核心问题',   text: data.core,  isRed: false },
          { label: '🔍 系统困局',   text: data.trap,  isRed: false },
          { label: '🚀 翻身路径',   text: data.turnaround, isRed: false },
          { label: '📋 行动建议',   text: data.advice, isRed: false },
        ]

        // ═══ 阶段 1: 预计算所有换行高度 ═══
        // 使用临时大画布做 measureText（不对用户可见）
        canvas.width = 2000
        canvas.height = 2000

        let estY = BODY_START_Y
        secDefs.forEach(sec => {
          if (!sec.text) return
          estY += SEC_HEADER_H
          ctx.font = sec.isRed ? 'bold 26px sans-serif' : '24px sans-serif'
          let line = ''
          for (let n = 0; n < sec.text.length; n++) {
            const testLine = line + sec.text[n]
            if (ctx.measureText(testLine).width > contentWidth && line.length > 0) {
              estY += LINE_HEIGHT
              line = sec.text[n]
            } else { line = testLine }
          }
          estY += LINE_HEIGHT + SEC_GAP
        })

        const qrStartY = estY + QR_GAP
        const canvasHeight = Math.max(1800, qrStartY + QR_SIZE + QR_TEXT_H + BOT_PAD)

        // ═══ 阶段 2: 设定最终尺寸 → 一次性绘制，绝不二次修改 ═══
        canvas.width = CANVAS_WIDTH
        canvas.height = canvasHeight

        // 背景
        ctx.fillStyle = '#121620'
        ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight)

        // 标题
        ctx.textAlign = 'center'
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 36px sans-serif'
        ctx.fillText('珠澳小事哥 · 认知翻身策略', CANVAS_WIDTH / 2, TITLE_Y)
        ctx.fillStyle = '#FF7BB6'
        ctx.font = '24px sans-serif'
        ctx.fillText('🧠 认知教练视角已激活', CANVAS_WIDTH / 2, SUBTITLE_Y)

        // 5板块正文
        let drawY = BODY_START_Y
        secDefs.forEach(sec => {
          if (!sec.text) return
          ctx.textAlign = 'left'
          ctx.fillStyle = sec.isRed ? '#FF453A' : '#7B57FF'
          ctx.font = 'bold 26px sans-serif'
          ctx.fillText(sec.label, paddingX, drawY)
          drawY += SEC_HEADER_H

          ctx.fillStyle = sec.isRed ? '#FF453A' : '#D0D5E0'
          ctx.font = sec.isRed ? 'bold 26px sans-serif' : '24px sans-serif'
          let line = ''
          for (let n = 0; n < sec.text.length; n++) {
            const testLine = line + sec.text[n]
            if (ctx.measureText(testLine).width > contentWidth && line.length > 0) {
              ctx.fillText(line, paddingX, drawY)
              line = sec.text[n]
              drawY += LINE_HEIGHT
            } else { line = testLine }
          }
          ctx.fillText(line, paddingX, drawY)
          drawY += LINE_HEIGHT + SEC_GAP
        })

        // 二维码
        const qrX = (CANVAS_WIDTH - QR_SIZE) / 2
        const qrY = drawY + QR_GAP

        const finish = () => {
          wx.canvasToTempFilePath({
            canvas, destWidth: CANVAS_WIDTH, destHeight: canvasHeight,
            success: (tempRes) => {
              wx.hideLoading()
              self.setData({ posterPath: tempRes.tempFilePath })
              self._saveToAlbum(tempRes.tempFilePath)
            },
            fail: () => {
              wx.hideLoading()
              self.setData({ posterGenerating: false })
              wx.showToast({ title: '画布导出失败', icon: 'none' })
            }
          })
        }

        const qrImage = canvas.createImage()
        // 使用项目中真实存在的小程序码
        qrImage.src = '/images/qrcode.png'

        qrImage.onload = () => {
          ctx.fillStyle = '#FFFFFF'
          self._drawRoundedRect(ctx, qrX - 12, qrY - 12, QR_SIZE + 24, QR_SIZE + 24, 14)
          ctx.fill()
          ctx.drawImage(qrImage, qrX, qrY, QR_SIZE, QR_SIZE)
          ctx.textAlign = 'center'
          ctx.fillStyle = '#888888'
          ctx.font = '24px sans-serif'
          ctx.fillText('扫码测试你的翻身策略', CANVAS_WIDTH / 2, qrY + QR_SIZE + 24)
          ctx.fillText('看看你的认知在什么段位', CANVAS_WIDTH / 2, qrY + QR_SIZE + 52)
          finish()
        }

        qrImage.onerror = () => {
          console.error('[poster] 二维码加载失败，启动无码降级通道')
          finish()
        }
      })
  },

  _drawRoundedRect(ctx, x, y, w, h, r) {
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
