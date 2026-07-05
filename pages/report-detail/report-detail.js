/**
 * pages/report-detail — v3.17 Report Progressive Reveal Mode
 *   先跳后加载：立即显示5标题骨架 → AI返回后逐段揭晓
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
    // 5模块标题（始终可见）
    sections: [
      { key: 'fatal',      label: '⚡ 致命一句话', revealed: false, text: '' },
      { key: 'core',       label: '🎯 核心问题',   revealed: false, text: '' },
      { key: 'trap',       label: '🔍 系统困局',   revealed: false, text: '' },
      { key: 'turnaround', label: '🚀 翻身路径',   revealed: false, text: '' },
      { key: 'advice',     label: '📋 行动建议',   revealed: false, text: '' },
    ],
  },

  onLoad(opt) {
    this.setData({
      reportId: opt.reportId || '',
      mode: opt.mode || 'diagnostic',
    })
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
     Step 2: 分段揭晓 (Progressive Reveal)
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

    // 第一帧：关闭 loading，标题可见，正文为空
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

  /* 重新诊断 */
  onRetry() {
    wx.redirectTo({ url: '/pages/challenge-play/challenge-play?mode=diagnostic' })
  },
})
