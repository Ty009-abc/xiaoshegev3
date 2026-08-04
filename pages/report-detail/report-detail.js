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

    // V5 Loading stage carousel
    loadingSteps: [
      { active: true },
      { active: false },
      { active: false },
      { active: false },
      { active: false },
    ],
    loadingStepIndex: 1,
    loadingStepText: '正在分析你的现金流与安全边界',
    _loadingStepTimer: null,

    // V4 ViewModel
    viewModel: null,

    // RC6.0: Destiny Simulator + Cognitive Verdict cards
    destinySimulator: null,
    cognitiveVerdict: null,

    // V3 sections (legacy)
    sections: [],

    // Poster
    posterCanvasWidth: 750,
    posterCanvasHeight: 1600,
    posterGenerating: false,
    posterPath: '',
    showPoster: false,
    showPosterPreview: false,
    qrPath: '/images/qrcode.png',
  },

  onLoad(opt) {
    // 品牌标题安全区
    try {
      const sys = wx.getSystemInfoSync()
      const menuRect = wx.getMenuButtonBoundingClientRect()
      this.setData({ brandHeaderTop: (menuRect.bottom || 60) + 8 })
    } catch (_) {
      this.setData({ brandHeaderTop: 68 })
    }

    this.setData({ reportId: opt.reportId || '', mode: opt.mode || 'diagnostic' })
    this._startLoadingCarousel()
    this._startDiagnostic()
  },

  /* ═══════════════════════════════════
     V5 Loading: cognitive carousel
     ═══════════════════════════════════ */
  _startLoadingCarousel() {
    const self = this
    const phases = [
      '正在分析你的现金流与安全边界',
      '正在识别你当前玩的财富游戏',
      '正在排除不适合你的高风险路径',
      '正在匹配最值得下注的翻身方向',
      '正在生成你的30天行动路线',
    ]

    let current = 0

    const tick = function () {
      if (self.data.cancelled || !self.data.loading) return

      current = (current + 1) % phases.length
      const stepIdx = current + 1

      const steps = phases.map(function (_, i) { return { active: i <= current } })

      self.setData({
        loadingSteps: steps,
        loadingStepIndex: stepIdx,
        loadingStepText: phases[current],
      })

      self.data._loadingStepTimer = setTimeout(tick, 2600)
    }

    // Start cycle after first display
    this.data._loadingStepTimer = setTimeout(tick, 2600)
  },

  _stopLoadingCarousel() {
    if (this.data._loadingStepTimer) {
      clearTimeout(this.data._loadingStepTimer)
      this.data._loadingStepTimer = null
    }
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

      console.log('🚨 [FATAL CHECK] 完整报告数据:', JSON.stringify({
        renderSource: (normed.data && normed.data.renderSource) || '',
        fallbackReason: (normed.data && normed.data.report && normed.data.report._fallbackReason) || '',
        reportKeys: (normed.data && normed.data.report) ? Object.keys(normed.data.report).filter(function(k) { return !k.startsWith('_') }) : [],
        ok: normed.ok,
        error: normed.error,
      }))

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
      console.error('🚨 [report-detail CATCH] AI 生成失败:', e)
      console.error('🚨 [report-detail CATCH] 错误消息:', e.message)
      console.error('🚨 [report-detail CATCH] 完整错误:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2))
      console.error('🚨 [report-detail CATCH] 错误堆栈:', e.stack)
      this._showError('AI 诊断引擎暂时离线: ' + (e.message || e.errMsg || 'unknown'))
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
    this._prepareV6Cards(vm)
    this._stopLoadingCarousel()
  },

  /* ═══════════════════════════════════
     RC6.0: Prepare 05/06 cards with safe fallback
     ═══════════════════════════════════ */
  _prepareV6Cards(vm) {
    // ── 05 命运模拟器 ──
    var sim = vm.destinySimulator || {}

    var destinySimulator = {
      currentIndex: Number.isFinite(sim.currentIndex) ? sim.currentIndex : 0,
      currentLevelLabel: sim.currentLevelLabel || '待评估',
      horizonDays: sim.horizonDays || 365,
      repairCycleDays: sim.repairCycleDays || 90,

      baselinePath: {
        title: (sim.baselinePath && sim.baselinePath.title) || '继续保持现状',
        riskLabel: (sim.baselinePath && sim.baselinePath.riskLabel) || '待评估',
        systemProgress: (sim.baselinePath && typeof sim.baselinePath.systemProgress === 'number') ? sim.baselinePath.systemProgress : 0,
        summary: (sim.baselinePath && sim.baselinePath.summary) || '',
        outcome: (sim.baselinePath && sim.baselinePath.outcome) || '如果继续沿用当前方式，收入结构大概率不会出现明显变化。',
      },

      actionPath: {
        title: (sim.actionPath && sim.actionPath.title) || '执行翻身方案',
        riskLabel: (sim.actionPath && sim.actionPath.riskLabel) || '待评估',
        projectedIndex: (sim.actionPath && typeof sim.actionPath.projectedIndex === 'number') ? sim.actionPath.projectedIndex : (sim.currentIndex || 0),
        summary: (sim.actionPath && sim.actionPath.summary) || '',
        outcome: (sim.actionPath && sim.actionPath.outcome) || '完成关键动作后，收入结构有机会逐步改善。',
      },

      turningPoints: Array.isArray(sim.turningPoints) ? sim.turningPoints : [],
      keyVariable: sim.keyVariable || '建立可持续执行系统',

      // 风险颜色标签
      baselineRiskClass: this._riskClass((sim.baselinePath && sim.baselinePath.riskLevel) || 'high'),
      actionRiskClass: this._riskClass((sim.actionPath && sim.actionPath.riskLevel) || 'medium'),
    }

    // 确保 projectedIndex >= currentIndex
    if (destinySimulator.actionPath.projectedIndex < destinySimulator.currentIndex) {
      destinySimulator.actionPath.projectedIndex = destinySimulator.currentIndex
    }

    // ── 06 认知宣判 ──
    var cog = vm.cognitiveVerdict || {}
    var cognitiveVerdict = {
      statement: cog.statement || '你的翻身条件已在积累，但仍被一个关键缺口限制。',
      explanation: cog.explanation || '持续调整收入结构和执行系统，翻开新的发展路径。',
      actionAnchor: cog.actionAnchor || '把能量集中到一条有验证的方向。',
    }

    this.setData({
      destinySimulator: destinySimulator,
      cognitiveVerdict: cognitiveVerdict,
    })
  },

  _riskClass(level) {
    var map = { high: 'risk-high', medium: 'risk-medium', low: 'risk-low', critical: 'risk-critical', very_low: 'risk-low' }
    return map[level] || 'risk-medium'
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
    this._stopLoadingCarousel()

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
    this._stopLoadingCarousel()
    wx.showToast({ title: msg, icon: 'none', duration: 3000 })
    setTimeout(() => wx.redirectTo({ url: '/pages/challenge-play/challenge-play?mode=diagnostic' }), 3000)
  },

  onUnload() {
    this.setData({ cancelled: true })
    if (this.data._loadingStepTimer) {
      clearTimeout(this.data._loadingStepTimer)
      this.data._loadingStepTimer = null
    }
  },

  onRetry() {
    wx.redirectTo({ url: '/pages/challenge-play/challenge-play?mode=diagnostic' })
  },

  /* ═══════════════════════════════════
     Canvas 2D 底座 (Stage B1)
     ═══════════════════════════════════ */
  _setPosterCanvasSize(width, height) {
    return new Promise(resolve => {
      this.setData({
        posterCanvasWidth: width,
        posterCanvasHeight: height
      }, resolve)
    })
  },

  _waitNextTick() {
    return new Promise(resolve => {
      wx.nextTick(resolve)
    })
  },

  _getPosterCanvasNode() {
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#posterCanvas')
        .fields({
          node: true,
          size: true
        })
        .exec(result => {
          var target = result && result[0]
          if (!target || !target.node) {
            reject(new Error('POSTER_CANVAS_NODE_NOT_FOUND'))
            return
          }
          resolve({
            canvas: target.node,
            cssWidth: Number(target.width) || 0,
            cssHeight: Number(target.height) || 0
          })
        })
    })
  },

  _getPosterDpr() {
    var info = null
    try {
      info = typeof wx.getWindowInfo === 'function'
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync()
    } catch (e) {
      console.warn('[PosterRC6][2D] get window info failed', e)
    }
    return Math.max(1, Number(info && info.pixelRatio) || 2)
  },

  _initPosterCanvas2D(arg) {
    arg.canvas.width = Math.round(arg.width * arg.dpr)
    arg.canvas.height = Math.round(arg.height * arg.dpr)
    if (typeof arg.ctx.setTransform === 'function') {
      arg.ctx.setTransform(1, 0, 0, 1, 0, 0)
    }
    arg.ctx.scale(arg.dpr, arg.dpr)
    console.log('[PosterRC6][2D] canvas initialized', {
      logicalWidth: arg.width,
      logicalHeight: arg.height,
      dpr: arg.dpr,
      pixelWidth: arg.canvas.width,
      pixelHeight: arg.canvas.height
    })
  },

  async _probePosterCanvas2D() {
    var width = Number(this.data.posterCanvasWidth) || 750
    var height = Number(this.data.posterCanvasHeight) || 1600
    await this._setPosterCanvasSize(width, height)
    await this._waitNextTick()
    var result = await this._getPosterCanvasNode()
    var canvas = result.canvas
    var cssWidth = result.cssWidth
    var cssHeight = result.cssHeight
    var ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('POSTER_2D_CONTEXT_NOT_AVAILABLE')
    }
    var dpr = this._getPosterDpr()
    this._initPosterCanvas2D({ canvas: canvas, ctx: ctx, width: width, height: height, dpr: dpr })
    console.log('[PosterRC6][2D] probe pass', {
      cssWidth: cssWidth,
      cssHeight: cssHeight,
      width: width,
      height: height,
      dpr: dpr
    })
    return { canvas: canvas, ctx: ctx, cssWidth: cssWidth, cssHeight: cssHeight, width: width, height: height, dpr: dpr }
  },

  _loadPosterCanvasImage(canvas, src) {
    return new Promise((resolve, reject) => {
      if (!src) { reject(new Error('POSTER_IMAGE_SOURCE_EMPTY')); return }
      if (!canvas || typeof canvas.createImage !== 'function') {
        reject(new Error('POSTER_CANVAS_CREATE_IMAGE_UNAVAILABLE')); return
      }
      var image = canvas.createImage()
      image.onload = function () { resolve(image) }
      image.onerror = function (e) {
        reject(new Error('POSTER_IMAGE_LOAD_FAILED:' + (e && e.errMsg || src)))
      }
      image.src = src
    })
  },

  _waitPosterCanvasFrame(canvas) {
    return new Promise(function (resolve) {
      if (canvas && typeof canvas.requestAnimationFrame === 'function') {
        canvas.requestAnimationFrame(function () { resolve() })
        return
      }
      setTimeout(resolve, 80)
    })
  },

  _exportPosterCanvas2D(arg) {
    var self = this
    return new Promise(function (resolve, reject) {
      wx.canvasToTempFilePath({
        canvas: arg.canvas,
        x: 0, y: 0,
        width: arg.width, height: arg.height,
        destWidth: Math.round(arg.width * arg.dpr),
        destHeight: Math.round(arg.height * arg.dpr),
        fileType: 'png', quality: 1,
        success: function (result) {
          if (!result || !result.tempFilePath) { reject(new Error('POSTER_EXPORT_PATH_EMPTY')); return }
          resolve(result.tempFilePath)
        },
        fail: function (error) {
          reject(new Error('POSTER_EXPORT_FAILED:' + (error && error.errMsg || '')))
        }
      })
    })
  },

  /* ═══════════════════════════════════
     海报生成 (V4 poster data + Canvas 2D)
     ═══════════════════════════════════ */
  generatePoster() {
    if (this.data.posterGenerating) return
    var self = this
    this.setData({ posterGenerating: true })
    wx.showLoading({ title: '正在生成海报...', mask: true })

    // Build poster data from current viewModel or V3 sections
    var posterData
    if (this.data.reportVersion === 'v4' && this.data.viewModel) {
      posterData = n4.mapDiagnosticV4ToPoster(this.data.viewModel)
    } else {
      var secs = this.data.sections || []
      posterData = {
        fatalSentence: (secs[0] && secs[0].text) || '',
        coreProblem: (secs[1] && secs[1].text) || '',
        systemTrap: (secs[2] && secs[2].text) || '',
        strategyPath: (secs[3] && secs[3].text) || '',
        advice: (secs[4] && secs[4].text) || '',
      }
    }

    // Async Canvas 2D workflow
    this._buildAndExportPoster(posterData)
      .then(function (tempFilePath) {
        self.setData({
          posterPath: tempFilePath,
          posterGenerating: false,
          showPoster: true
        })
        wx.hideLoading()
        self._saveToAlbum(tempFilePath)
      })
      .catch(function (error) {
        console.error('[PosterRC6][2D] GENERATE_FATAL', {
          message: error && error.message,
          stack: error && error.stack,
          error: error
        })
        wx.hideLoading()
        self.setData({ posterGenerating: false })
        wx.showModal({
          title: '海报生成失败',
          content: '绘制过程中出现异常，请重新生成。',
          showCancel: false
        })
      })
  },

  _buildAndExportPoster(posterData) {
    var pd = posterData || {}
    var self = this

    return (async function () {
    var W = 750
    var safeX = 40
    var cardW = 670
    var leftW = 112
    var textX = safeX + leftW + 28
    var textMaxW = cardW - leftW - 52
    var qrPath = self.data.qrPath || '/images/qrcode.png'

    // ── Get V6 fields with safe fallback ──
    var sim = pd.destinySimulator || {}
    var cog = pd.cognitiveVerdict || {}

    var currentIndex = Number.isFinite(sim.currentIndex) ? sim.currentIndex : 0
    var projectedIndex = Number.isFinite(sim.actionPath && sim.actionPath.projectedIndex)
      ? sim.actionPath.projectedIndex
      : currentIndex
    if (projectedIndex < currentIndex) projectedIndex = currentIndex

    var currentLevelLabel = sim.currentLevelLabel || '待评估'
    var repairCycleDays = sim.repairCycleDays || 90

    var baselineOutcome = (sim.baselinePath && sim.baselinePath.outcome) ||
      '继续沿用当前方式，收入结构大概率不会明显改变。'

    var actionOutcome = (sim.actionPath && sim.actionPath.outcome) ||
      '完成关键动作后，收入结构有机会逐步改善。'

    var keyVariable = sim.keyVariable || '建立可持续执行系统'

    var turningPoints = Array.isArray(sim.turningPoints) ? sim.turningPoints : []

    var cogStatement = cog.statement || '你的翻身条件已在积累，但仍被一个关键缺口限制。'
    var cogActionAnchor = cog.actionAnchor || '把能量集中到一条有验证的方向。'

    var fatalSentence = pd.fatalSentence || ''
    var coreProblem = pd.coreProblem || ''
    var systemTrap = pd.systemTrap || ''
    var strategyPath = pd.strategyPath || ''
    var advice = pd.advice || ''

    var hasDestiny = (currentIndex > 0) || (projectedIndex > 0)
    var hasCogVerdict = (cogStatement && cogStatement.length > 5) || (cogActionAnchor && cogActionAnchor.length > 5)

    var cards = [
      { no: '01', icon: '📍', title: '致命一句话', color: '#ff2d55', text: fatalSentence || '' },
      { no: '02', icon: '🔍', title: '核心问题',   color: '#ff3b3b', text: coreProblem || '' },
      { no: '03', icon: '🚫', title: '系统困局',   color: '#ff6b6b', text: systemTrap || '' },
      { no: '04', icon: '🚀', title: '翻身路径',   color: '#ff9f1a', text: strategyPath || '' },
      { no: '05', icon: '🧭', title: '命运模拟器', color: '#108C59', text: '', type: 'destiny' },
      { no: '06', icon: '💥', title: '认知宣判',   color: '#7B3CFF', text: '', type: 'cogVerdict' },
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
      ctx.font = size + 'px sans-serif'
      var chars = String(text || '').replace(/\n/g, ' ').split('')
      var line = ''
      var lines = []
      for (var i = 0; i < chars.length; i++) {
        var test = line + chars[i]
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line)
          line = chars[i]
        } else {
          line = test
        }
      }
      if (line) lines.push(line)
      return lines
    }

    /**
     * drawWrappedText(ctx, text, x, y, options)
     * options: { maxWidth, lineHeight, fontSize, color, maxLines, ellipsis }
     * Returns: { height: number, lines: number }
     */
    function drawWrappedText(text, x, y, options) {
      var opts = options || {}
      var maxW = opts.maxWidth || textMaxW
      var lh = opts.lineHeight || 28
      var size = opts.fontSize || 24
      var color = opts.color || '#eaf0ff'
      var maxLines = opts.maxLines || 99
      var ellipsis = opts.ellipsis || ''

      ctx.font = size + 'px sans-serif'
      ctx.fillStyle = (color)
      ctx.textAlign = ('left')

      var lines = []
      var chars = String(text || '').replace(/\n/g, ' ').split('')
      var line = ''
      for (var i = 0; i < chars.length; i++) {
        var test = line + chars[i]
        if (ctx.measureText(test).width > maxW && line) {
          lines.push(line)
          if (lines.length >= maxLines) break
          line = chars[i]
        } else {
          line = test
        }
      }
      if (line && lines.length < maxLines) lines.push(line)

      // Apply ellipsis to last line if truncated
      if (lines.length >= maxLines && ellipsis && line.length < chars.length) {
        var last = lines[lines.length - 1]
        while (last.length > 0 && ctx.measureText(last + ellipsis).width > maxW) {
          last = last.slice(0, -1)
        }
        lines[lines.length - 1] = last + ellipsis
      }

      for (var j = 0; j < lines.length; j++) {
        ctx.fillText(lines[j], x, y + j * lh)
      }

      return { height: lines.length * lh, lines: lines.length }
    }

    function drawWrappedLines(lines, x, y, lineHeight, color, size) {
      ctx.textAlign = ('left')
      ctx.font = size + 'px sans-serif'
      ctx.fillStyle = (color)
      lines.forEach((line, i) => {
        ctx.fillText(line, x, y + i * lineHeight)
      })
    }

    function drawGlow(x, y, r, color, alpha) {
      const g = ctx.createRadialGradient(x, y, r)
      g.addColorStop(0, color)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalAlpha = (alpha)
      ctx.fillStyle = (g)
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
      ctx.globalAlpha = (1)
    }

    // ══════════════════════════════════════════════
    //  预计算每张卡片真实高度
    // ══════════════════════════════════════════════
    cards.forEach(function(item, index) {
      if (item.type === 'destiny') {
        // RC6.0 05: 命运模拟器压缩版
        var partsH = 0
        // Score line: "62分 · 中等"
        partsH += 32
        // Baseline outcome (max 3 lines @ 26px)
        ctx.font = '22px sans-serif'
        partsH += Math.min(splitLines(baselineOutcome, textMaxW - 4, 22).length, 3) * 28
        // Action projected: "62 → 81"
        partsH += 30
        // Repair cycle
        partsH += 28
        // Key variable (max 2 lines @ 22px)
        ctx.font = '22px sans-serif'
        partsH += Math.min(splitLines(keyVariable, textMaxW - 4, 22).length, 2) * 26
        // Turning points condensed (1 line)
        partsH += 22
        // Gap between sections
        partsH += 16
        item._height = Math.max(260, 95 + partsH + 24)
      } else if (item.type === 'cogVerdict') {
        // RC6.0 06: 认知宣判压缩版
        var cogH = 0
        // Statement (max 3 lines @ 24px)
        ctx.font = '24px sans-serif'
        var stLines = Math.min(splitLines(cogStatement, textMaxW - 4, 24).length, 3)
        cogH += stLines * 32
        // Action anchor (max 2 lines @ 22px)
        ctx.font = '22px sans-serif'
        var aaLines = Math.min(splitLines(cogActionAnchor, textMaxW - 4, 22).length, 2)
        cogH += aaLines * 28 + 20
        item._height = Math.max(200, 95 + cogH + 40)
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

    // ═══ Canvas 2D init (must happen after H is computed) ═══
    var probeResult = await self._probePosterCanvas2D()
    var canvas = probeResult.canvas
    var ctx = probeResult.ctx
    var dpr = probeResult.dpr
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    var renderState = { background: false, header: false, cards: 0, qrSection: false, footer: false }

    // 背景
    ctx.fillRect(0, 0, W, H)
    renderState.background = true

    drawGlow(160, 120, 220, '#7b3cff', 0.26)
    drawGlow(620, 120, 240, '#ff2d75', 0.18)
    drawGlow(375, H - 220, 300, '#2d6bff', 0.18)

    // 标题
    ctx.textAlign = ('center')
    ctx.font = '42px sans-serif'
    ctx.fillStyle = ('#ffffff')
    ctx.fillText('珠澳小事哥 · 认知翻身策略', W / 2, 76)

    ctx.font = '26px sans-serif'
    ctx.fillStyle = ('#ff5ca8')
    ctx.fillText('🧠 认知教练视角已激活', W / 2, 122)

    ctx.strokeStyle = ('rgba(255,92,168,0.45)')
    ctx.lineWidth = (1)
    ctx.beginPath()
    ctx.moveTo(70, 145)
    ctx.lineTo(680, 145)
    ctx.stroke()

    renderState.header = true

    // 卡片
    let y = 180

    cards.forEach(function(item, index) {
      var h = item._height

      roundRect(safeX, y, cardW, h, 16)
      ctx.fillStyle = ('rgba(8,14,32,0.88)')
      ctx.fill()
      ctx.strokeStyle = (item.color)
      ctx.lineWidth = (1.5)
      ctx.stroke()

      ctx.globalAlpha = (0.16)
      ctx.fillStyle = (item.color)
      ctx.fillRect(safeX, y, leftW, h)
      ctx.globalAlpha = (1)

      ctx.textAlign = ('center')
      ctx.font = '52px sans-serif'
      ctx.fillStyle = (item.color)
      ctx.fillText(item.no, safeX + leftW / 2, y + 62)

      ctx.font = '40px sans-serif'
      ctx.fillText(item.icon, safeX + leftW / 2, y + 112)

      ctx.textAlign = ('left')
      ctx.font = '30px sans-serif'
      ctx.fillStyle = (item.color)
      ctx.fillText(item.icon + ' ' + item.title, textX, y + 46)

      if (item.type === 'destiny') {
        // ── RC6.0 05: 命运模拟器 ──
        var dy = y + 88

        // 当前指数: "62分 · 中等"
        ctx.font = '36px sans-serif'
        ctx.fillStyle = ('#108C59')
        ctx.fillText(currentIndex + '分', textX, dy)
        ctx.font = '22px sans-serif'
        ctx.fillStyle = ('#108C59')
        ctx.fillText(' · ' + currentLevelLabel, textX + ctx.measureText(currentIndex + '分').width, dy)
        dy += 34

        // A 路径 — 保持现状
        ctx.font = '20px sans-serif'
        ctx.fillStyle = ('#8EA0B5')
        ctx.fillText('▸ 保持现状', textX, dy)
        dy += 26

        var baseLines = splitLines(baselineOutcome, textMaxW - 4, 22)
        if (baseLines.length > 3) baseLines = baseLines.slice(0, 3)
        ctx.font = '22px sans-serif'
        ctx.fillStyle = ('#8899B0')
        for (var bi = 0; bi < baseLines.length; bi++) {
          ctx.fillText(baseLines[bi], textX + 16, dy)
          dy += 28
        }
        dy += 10

        // B 路径 — 执行方案 + 指数变化
        ctx.font = '20px sans-serif'
        ctx.fillStyle = ('#108C59')
        ctx.fillText('▸ 执行方案', textX, dy)
        dy += 28

        ctx.font = '32px sans-serif'
        ctx.fillStyle = ('#108C59')
        ctx.fillText(currentIndex + '', textX + 16, dy)
        var arrW = ctx.measureText(currentIndex + '').width
        ctx.font = '24px sans-serif'
        ctx.fillStyle = ('#108C59')
        ctx.fillText(' → ', textX + 16 + arrW, dy)
        var arrowW = ctx.measureText(' → ').width
        ctx.font = '38px sans-serif'
        ctx.fillStyle = ('#108C59')
        ctx.fillText(projectedIndex + '', textX + 16 + arrW + arrowW, dy)
        dy += 38

        // 修复周期
        ctx.font = '22px sans-serif'
        ctx.fillStyle = ('#108C59')
        ctx.fillText('预计结构修复周期：' + repairCycleDays + '天', textX + 16, dy)
        dy += 32

        // 关键变量
        ctx.font = '20px sans-serif'
        ctx.fillStyle = ('#8EA0B5')
        ctx.fillText('关键变量', textX, dy)
        dy += 26

        ctx.font = '22px sans-serif'
        ctx.fillStyle = ('#2B4258')
        var kvLines = splitLines(keyVariable, textMaxW - 4, 22)
        if (kvLines.length > 2) kvLines = kvLines.slice(0, 2)
        for (var ki = 0; ki < kvLines.length; ki++) {
          ctx.fillText(kvLines[ki], textX + 16, dy)
          dy += 26
        }

        // 转折点压缩版（1行）
        if (turningPoints.length > 0) {
          dy += 4
          ctx.font = '18px sans-serif'
          ctx.fillStyle = ('#90B0C5')
          var tpText = turningPoints.map(function(t) { return '第' + t.day + '天:' + (t.label || '').slice(0, 8) }).join(' · ')
          var tpLines = splitLines(tpText, textMaxW, 18)
          if (tpLines.length > 1) tpText = tpLines[0] + '…'
          ctx.fillText(tpText, textX + 16, dy)
        }

      } else if (item.type === 'cogVerdict') {
        // ── RC6.0 06: 认知宣判 ──
        var cy = y + 86

        // 核心宣判 (max 3 lines)
        cy += drawWrappedText(cogStatement, textX, cy, {
          maxWidth: textMaxW - 4, lineHeight: 32, fontSize: 24,
          color: '#D9C5FF', maxLines: 3, ellipsis: '…',
        }).height + 16

        // 行动锚点 (max 2 lines)
        ctx.font = '20px sans-serif'
        ctx.fillStyle = ('#A68FCE')
        ctx.fillText('行动锚点', textX, cy)
        cy += 26

        drawWrappedText(cogActionAnchor, textX + 16, cy, {
          maxWidth: textMaxW - 4, lineHeight: 28, fontSize: 22,
          color: '#D9C5FF', maxLines: 2, ellipsis: '…',
        })

      } else {
        drawWrappedLines(item._lines, textX, y + 86, 34, '#eaf0ff', 26)
      }

      renderState.cards += 1
      y += h + gap
    })

    // CTA
    const ctaY = y + 48

    roundRect(safeX, ctaY, cardW, ctaH, 24)
    ctx.fillStyle = ('rgba(10,12,40,0.94)')
    ctx.fill()
    ctx.strokeStyle = ('#7b5cff')
    ctx.lineWidth = (2)
    ctx.stroke()

    roundRect(safeX + 20, ctaY + 20, 110, 110, 18)
    ctx.fillStyle = ('#ffffff')
    ctx.fill()
    // QR image via Canvas 2D createImage
    var qrImage = null
    try {
      qrImage = await self._loadPosterCanvasImage(canvas, qrPath)
    } catch (e) {
      console.error('[PosterRC6][2D] QR_IMAGE_LOAD_FAILED', { message: e && e.message, qrPath: qrPath })
    }
    if (qrImage) {
      ctx.drawImage(qrImage, safeX + 28, ctaY + 28, 94, 94)
    } else {
      // QR fallback: draw placeholder rect
      ctx.fillStyle = '#1a1a3a'
      ctx.fillRect(safeX + 28, ctaY + 28, 94, 94)
      ctx.font = '12px sans-serif'
      ctx.fillStyle = '#555'
      ctx.textAlign = 'center'
      ctx.fillText('扫码查看', safeX + 75, ctaY + 80)
    }

    ctx.textAlign = ('left')
    ctx.font = '34px sans-serif'
    ctx.fillStyle = ('#ff45c8')
    ctx.fillText('扫码测试你的翻身策略', safeX + 150, ctaY + 58)

    ctx.font = '28px sans-serif'
    ctx.fillStyle = ('#ffffff')
    ctx.fillText('看看你的认知在什么段位', safeX + 150, ctaY + 96)

    const tags = ['🧠 认知诊断', '📈 策略分析', '🎯 破局建议']
    tags.forEach((tag, i) => {
      const tx = safeX + 150 + i * 142
      roundRect(tx, ctaY + 111, 124, 25, 11)
      ctx.fillStyle = ('rgba(123,92,255,0.14)')
      ctx.fill()
      ctx.strokeStyle = ('rgba(180,130,255,0.7)')
      ctx.stroke()
      ctx.font = '15px sans-serif'
      ctx.fillStyle = ('#d9d6ff')
      ctx.textAlign = ('center')
      ctx.fillText(tag, tx + 62, ctaY + 129)
    })

    renderState.qrSection = true

    ctx.textAlign = ('center')
    ctx.font = '22px sans-serif'
    ctx.fillStyle = ('#7b6dff')
    ctx.fillText('»»» 长按识别小程序码 · 开启你的认知翻身之路 «««', W / 2, H - 30)

    renderState.footer = true

    // ═══ Render state sentinel ═══
    if (!renderState.background || !renderState.header || renderState.cards !== 6 || !renderState.qrSection || !renderState.footer) {
      throw new Error('POSTER_RENDER_INCOMPLETE:' + JSON.stringify(renderState))
    }

    // ═══ Canvas 2D frame wait + export ═══
    await self._waitPosterCanvasFrame(canvas)
    var tempFilePath = await self._exportPosterCanvas2D({ canvas: canvas, width: W, height: H, dpr: dpr })
    return tempFilePath
  }).call(self)
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
