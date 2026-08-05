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
    console.log('[PosterRC6][P3] _setPosterCanvasSize', { width: width, height: height })
    return new Promise(resolve => {
      this.setData({
        posterCanvasWidth: width,
        posterCanvasHeight: height
      }, resolve)
    })
  },

  _waitNextTick() {
    return new Promise(resolve => {
      wx.nextTick(function () {
        console.log('[PosterRC6][P4] _waitNextTick finished')
        resolve()
      })
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
          console.log('[PosterRC6][P5] _getPosterCanvasNode', {
            hasCanvas: !!(target && target.node),
            cssWidth: target ? Number(target.width) || 0 : 0,
            cssHeight: target ? Number(target.height) || 0 : 0,
            canvasType: target && target.node ? typeof target.node : 'N/A'
          })
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
    var dpr = Math.max(1, Number(info && info.pixelRatio) || 2)
    console.log('[PosterRC6][P7] _getPosterDpr', {
      pixelRatio: dpr
    })
    return dpr
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
    console.log('[PosterRC6][P6] getContext("2d")', {
      hasCtx: !!ctx,
      ctxType: typeof ctx
    })
    if (!ctx) {
      throw new Error('POSTER_2D_CONTEXT_NOT_AVAILABLE')
    }
    var dpr = this._getPosterDpr()
    this._initPosterCanvas2D({ canvas: canvas, ctx: ctx, width: width, height: height, dpr: dpr })
    console.log('[PosterRC6][P8] Canvas init complete', {
      logicalWidth: width,
      logicalHeight: height,
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      dpr: dpr
    })
    return { canvas: canvas, ctx: ctx, cssWidth: cssWidth, cssHeight: cssHeight, width: width, height: height, dpr: dpr }
  },

  _loadPosterCanvasImage(canvas, src) {
    return new Promise((resolve, reject) => {
      console.log('[PosterRC6][P13] canvas.createImage start', { src: src })
      if (!src) { reject(new Error('POSTER_IMAGE_SOURCE_EMPTY')); return }
      if (!canvas || typeof canvas.createImage !== 'function') {
        reject(new Error('POSTER_CANVAS_CREATE_IMAGE_UNAVAILABLE')); return
      }
      var image = canvas.createImage()
      image.onload = function () {
        console.log('[PosterRC6][P13] image loaded', { width: image.width, height: image.height })
        resolve(image)
      }
      image.onerror = function (e) {
        console.error('[PosterRC6][P13] image error', { message: e && e.errMsg || src })
        reject(new Error('POSTER_IMAGE_LOAD_FAILED:' + (e && e.errMsg || src)))
      }
      image.src = src
    })
  },

  _waitPosterCanvasFrame(canvas) {
    return new Promise(function (resolve) {
      if (canvas && typeof canvas.requestAnimationFrame === 'function') {
        canvas.requestAnimationFrame(function () {
          console.log('[PosterRC6][P17] waitPosterCanvasFrame finished')
          resolve()
        })
        return
      }
      setTimeout(function () {
        console.log('[PosterRC6][P17] waitPosterCanvasFrame finished (timeout fallback)')
        resolve()
      }, 80)
    })
  },

  _exportPosterCanvas2D(arg) {
    var self = this
    console.log('[PosterRC6][P18] canvasToTempFilePath args', {
      x: 0, y: 0,
      width: arg.width, height: arg.height,
      destWidth: Math.round(arg.width * arg.dpr),
      destHeight: Math.round(arg.height * arg.dpr)
    })
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
          console.log('[PosterRC6][P19] export success', { tempFilePath: result.tempFilePath })
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

    console.log('[PosterRC6][P1] generatePoster start', {
      posterGenerating: this.data.posterGenerating,
      reportGenerating: this.data.reportGenerating,
      timestamp: Date.now(),
      timeStr: new Date().toISOString()
    })

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

    console.log('[PosterRC6][P2] posterData built', {
      cardsLength: posterData.cards ? posterData.cards.length : 'N/A',
      hasHeader: !!posterData.header,
      hasFooter: !!posterData.footer,
      qrPath: this.data.qrPath || '/images/qrcode.png',
      posterHeight: this.data.posterCanvasHeight
    })

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
        console.error('[PosterRC6][FATAL] GENERATE_FATAL', {
          message: error && error.message,
          stack: error && error.stack,
          error: error
        })
        wx.hideLoading()
        self.setData({ posterGenerating: false })
        wx.showModal({
          title: '海报生成失败',
          content: (error && error.message) || '绘制过程中出现异常，请重新生成。',
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
    var contentX = safeX + leftW + 28
    var contentRight = safeX + cardW - 28
    var contentWidth = contentRight - contentX
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

    // ── RC6 card body text (new schema from mapper) ──
    var verdict = pd.verdict || ''
    var coreConflict = pd.coreConflict || ''
    var decision = pd.decision || ''
    var firstAction = pd.firstAction || ''

    // ── Cards 01-04 body assertions ──
    var requiredBodies = [verdict, coreConflict, decision, firstAction]
    var requiredNames = ['verdict', 'coreConflict', 'decision', 'firstAction']
    for (var rb = 0; rb < requiredBodies.length; rb++) {
      if (!requiredBodies[rb] || String(requiredBodies[rb]).trim().length < 8) {
        console.error('[PosterRC6] CARD_BODY_INVALID:' + (rb + 1), { field: requiredNames[rb], value: requiredBodies[rb] })
      }
    }

    var cards = [
      { no: '01', icon: '📍', title: '命运判决', color: '#ff2d55', text: verdict || '' },
      { no: '02', icon: '🔍', title: '核心矛盾', color: '#ff3b3b', text: coreConflict || '' },
      { no: '03', icon: '🚫', title: '唯一决策', color: '#ff6b6b', text: decision || '' },
      { no: '04', icon: '🚀', title: '第一行动', color: '#ff9f1a', text: firstAction || '' },
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

    function splitLines(ctx, text, maxWidth, size) {
      var safeText = text == null ? '' : String(text)
      var realCtx = ctx
      if (realCtx && typeof realCtx.measureText === 'function') {
        realCtx.font = size + 'px sans-serif'
      }
      var chars = String(text || '').replace(/\n/g, ' ').split('')
      var line = ''
      var lines = []
      for (var i = 0; i < chars.length; i++) {
        var test = line + chars[i]
        var charW = realCtx && typeof realCtx.measureText === 'function' ? realCtx.measureText(test).width : test.length * size * 0.6
        if (charW > maxWidth && line) {
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
    function drawWrappedText(ctx, text, x, y, options) {
      if (!ctx || typeof ctx.measureText !== 'function') {
        throw new Error('POSTER_TEXT_CONTEXT_MISSING')
      }
      var opts = options || {}
      var maxW = opts.maxWidth || contentWidth
      var lh = opts.lineHeight || 28
      var size = opts.fontSize || 24
      var color = opts.color || '#eaf0ff'
      var maxLines = opts.maxLines || 99
      var ellipsis = opts.ellipsis || ''
      var safeText = text == null ? '' : String(text)

      ctx.font = size + 'px sans-serif'
      ctx.fillStyle = (color)
      ctx.textAlign = ('left')

      var lines = []
      var chars = safeText.replace(/\n/g, ' ').split('')
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

    function drawWrappedLines(ctx, lines, x, y, lineHeight, color, size) {
      if (!ctx || typeof ctx.measureText !== 'function') {
        throw new Error('POSTER_TEXT_CONTEXT_MISSING')
      }
      ctx.textAlign = ('left')
      ctx.font = size + 'px sans-serif'
      ctx.fillStyle = (color)
      lines.forEach((line, i) => {
        ctx.fillText(line, x, y + i * lineHeight)
      })
    }

    function createPosterRadialGradient(targetCtx, centerX, centerY, radius) {
      if (!targetCtx || typeof targetCtx.createRadialGradient !== 'function') {
        throw new Error('POSTER_RADIAL_GRADIENT_UNAVAILABLE')
      }
      var safeRadius = Math.max(1, Number(radius) || 1)
      var gradient = targetCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, safeRadius)
      if (!gradient || typeof gradient.addColorStop !== 'function') {
        throw new Error('POSTER_GRADIENT_CREATE_FAILED')
      }
      return gradient
    }

    function drawGlow(x, y, r, color, alpha) {
      console.log('[PosterRC6][GRADIENT]', { section: 'drawGlow', x: x, y: y, r: r, hasCtx: !!ctx, hasCreateRadial: !!ctx && typeof ctx.createRadialGradient === 'function' })
      var g = createPosterRadialGradient(ctx, x, y, r)
      g.addColorStop(0, color)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalAlpha = (alpha)
      ctx.fillStyle = (g)
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
      ctx.globalAlpha = (1)
    }

    // ═══ Canvas 2D init ═══
    // Use a generous initial height (re-measured after layout)
    var probeResult = await self._probePosterCanvas2D()
    var canvas = probeResult.canvas
    var ctx = probeResult.ctx
    var dpr = probeResult.dpr
    // Set initial larger canvas; true height computed below
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(2800 * dpr)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    // ══════════════════════════════════════════════
    //  用真实 ctx 重新计算所有卡片高度
    // ══════════════════════════════════════════════
    var CARD_PAD_TOP = 40
    var CARD_PAD_BOT = 28
    var TITLE_H = 38
    var GAP = 16  // card gap
    var CARD_MIN_H = {
      '01': 142,
      '02': 155,
      '03': 155,
      '04': 142,
      'destiny': 300,
      'cogVerdict': 205
    }

    cards.forEach(function(item, index) {
      if (item.type === 'destiny') {
        // RC6.0 05: 命运模拟器 — per-section accumulated
        var dY = CARD_PAD_TOP + TITLE_H + 6
        // Score: "63分 · 中等"
        dY += 36
        // Baseline label
        dY += 28
        ctx.font = '22px sans-serif'
        var baseLs = Math.min(splitLines(ctx, baselineOutcome, contentWidth - 16, 22).length, 3)
        dY += baseLs * 30
        dY += 14
        // Action label
        dY += 28
        // Index change: "63 → 79"
        dY += 40
        // Repair cycle
        dY += 34
        // "关键变量" label
        dY += 28
        ctx.font = '21px sans-serif'
        var kvLs = Math.min(splitLines(ctx, keyVariable, contentWidth - 16, 21).length, 3)
        dY += kvLs * 30
        dY += 14
        // "关键转折点" label + points line-by-line
        if (turningPoints.length > 0) {
          dY += 28  // label
          var tpCount = Math.min(turningPoints.length, 3)
          ctx.font = '19px sans-serif'
          for (var tp = 0; tp < tpCount; tp++) {
            var tpText = '第' + turningPoints[tp].day + '天：' + (turningPoints[tp].label || '')
            var tpLines = splitLines(ctx, tpText, contentWidth - 16, 19)
            dY += tpLines.length * 27 + 8
          }
        }
        dY += CARD_PAD_BOT
        item._heightMeasured = Math.max(CARD_MIN_H.destiny, dY)
        item._baseLines = baseLs
        item._kvLines = kvLs
        item._tpCount = turningPoints.length > 0 ? Math.min(turningPoints.length, 3) : 0
      } else if (item.type === 'cogVerdict') {
        // RC6.0 06: 认知宣判 — compact
        ctx.font = '24px sans-serif'
        var stLs = Math.min(splitLines(ctx, cogStatement, contentWidth - 8, 24).length, 4)
        ctx.font = '22px sans-serif'
        var aaLs = Math.min(splitLines(ctx, cogActionAnchor, contentWidth - 16, 22).length, 3)
        var cogH = CARD_PAD_TOP + TITLE_H + 18 + stLs * 34 + 18 + 26 + aaLs * 31 + CARD_PAD_BOT
        item._heightMeasured = Math.max(CARD_MIN_H.cogVerdict, cogH)
        item._stLines = stLs
        item._aaLines = aaLs
      } else {
        // Cards 01-04 — compact dynamic height
        ctx.font = '26px sans-serif'
        item._lines = splitLines(ctx, item.text || '', contentWidth, 26)
        var minH = CARD_MIN_H[item.no] || 142
        item._heightMeasured = Math.max(minH, CARD_PAD_TOP + TITLE_H + 12 + item._lines.length * 34 + CARD_PAD_BOT)
      }
      console.log('[PosterRC6][MEASURE] Card' + (index + 1) + ' height=' + item._heightMeasured)
    })

    var headerH = 180
    var cardsH = cards.reduce(function(sum, item) { return sum + item._heightMeasured }, 0) + GAP * (cards.length - 1)
    var ctaH = 150
    var footerH = 80
    var H = headerH + cardsH + 60 + ctaH + footerH

    // Re-init canvas with correct height
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    var renderState = { background: false, header: false, cards: 0, qrSection: false, footer: false }

    // 背景
    ctx.fillRect(0, 0, W, H)
    renderState.background = true
    console.log('[PosterRC6][P9] background ok')

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
    console.log('[PosterRC6][P10] header done')

    // 卡片
    var cardY = 180
    var cardCount = cards.length

    for (var ci = 0; ci < cardCount; ci++) {
      var item = cards[ci]
      var index = ci
      var h = item._heightMeasured

      console.log('[PosterRC6][P11] Card' + (index + 1) + ' start', { title: (item.label||item.title||'card' + (index+1)), cardY: cardY, height: h })

      ctx.save()

      // ── Card background ──
      roundRect(safeX, cardY, cardW, h, 16)
      ctx.fillStyle = ('rgba(8,14,32,0.88)')
      ctx.fill()
      ctx.strokeStyle = (item.color)
      ctx.lineWidth = (1.5)
      ctx.stroke()

      // Left accent bar
      ctx.globalAlpha = (0.16)
      ctx.fillStyle = (item.color)
      ctx.fillRect(safeX, cardY, leftW, h)
      ctx.globalAlpha = (1)

      // Card number + icon (centered in left bar)
      ctx.textAlign = ('center')
      ctx.font = '52px sans-serif'
      ctx.fillStyle = (item.color)
      ctx.fillText(item.no, safeX + leftW / 2, cardY + 62)
      ctx.font = '40px sans-serif'
      ctx.fillText(item.icon, safeX + leftW / 2, cardY + 112)

      // Card title
      ctx.textAlign = ('left')
      ctx.font = '30px sans-serif'
      ctx.fillStyle = (item.color)
      ctx.fillText(item.icon + ' ' + item.title, contentX, cardY + 46)

      var lastTextY = cardY + 46

      if (item.type === 'destiny') {
        // ── RC6.0 05: 命运模拟器 ──
        var dy = cardY + CARD_PAD_TOP + TITLE_H + 6

        // 评分: "63分 · 中等"
        ctx.font = '29px sans-serif'
        ctx.fillStyle = ('#108C59')
        var scoreStr = currentIndex + '分'
        ctx.fillText(scoreStr, contentX, dy)
        var scoreW = ctx.measureText(scoreStr).width
        ctx.font = '22px sans-serif'
        ctx.fillStyle = ('#108C59')
        ctx.fillText(' · ' + currentLevelLabel, contentX + scoreW, dy)
        dy += 36

        // A 路径 — 保持现状
        ctx.font = '21px sans-serif'
        ctx.fillStyle = ('#8EA0B5')
        ctx.fillText('▸ 保持现状', contentX, dy)
        dy += 28

        console.log('[PosterRC6][FONT_CALL]', { section: 'card05-baseline', hasCtx: !!ctx, ctxType: typeof ctx, hasMeasureText: !!ctx && typeof ctx.measureText === 'function', textType: typeof baselineOutcome, fontSize: 22 })
        ctx.font = '22px sans-serif'
        ctx.fillStyle = ('#8899B0')
        var baseLs = item._baseLines || 3
        for (var bi = 0; bi < baseLs; bi++) {
          var bl = splitLines(ctx, baselineOutcome, contentWidth - 16, 22)[bi] || ''
          ctx.fillText(bl, contentX + 16, dy)
          dy += 30
        }
        dy += 14

        // B 路径 — 执行方案
        ctx.font = '21px sans-serif'
        ctx.fillStyle = ('#108C59')
        ctx.fillText('▸ 执行方案', contentX, dy)
        dy += 28

        // 指数变化: "63 → 79"
        ctx.font = '28px sans-serif'
        ctx.fillStyle = ('#108C59')
        var fromStr = currentIndex + ''
        ctx.fillText(fromStr, contentX + 16, dy)
        var fromW = ctx.measureText(fromStr).width
        ctx.font = '24px sans-serif'
        ctx.fillText(' → ', contentX + 16 + fromW, dy)
        var arrowW = ctx.measureText(' → ').width
        ctx.font = '28px sans-serif'
        ctx.fillText(projectedIndex + '', contentX + 16 + fromW + arrowW, dy)
        dy += 40

        // 修复周期
        ctx.font = '20px sans-serif'
        ctx.fillStyle = ('#108C59')
        ctx.fillText('预计结构修复周期：' + repairCycleDays + '天', contentX + 16, dy)
        dy += 34

        // ── 关键变量 (独立区块) ──
        ctx.font = '19px sans-serif'
        ctx.fillStyle = ('#8EA0B5')
        ctx.fillText('关键变量', contentX, dy)
        dy += 28

        ctx.font = '21px sans-serif'
        ctx.fillStyle = ('#2B4258')
        var kvLines = splitLines(ctx, keyVariable, contentWidth - 16, 21)
        var kvLs = item._kvLines || kvLines.length
        if (kvLines.length > kvLs) kvLines = kvLines.slice(0, kvLs)
        for (var ki = 0; ki < kvLines.length; ki++) {
          ctx.fillText(kvLines[ki], contentX + 16, dy)
          dy += 30
        }
        dy += 14

        // ── 关键转折点 (逐条换行) ──
        if (turningPoints.length > 0) {
          ctx.font = '19px sans-serif'
          ctx.fillStyle = ('#8EA0B5')
          ctx.fillText('关键转折点', contentX, dy)
          dy += 28

          var tpCount = Math.min(turningPoints.length, 3)
          ctx.font = '19px sans-serif'
          ctx.fillStyle = ('#90B0C5')
          for (var tp = 0; tp < tpCount; tp++) {
            var pointLabel = '第' + turningPoints[tp].day + '天：' + (turningPoints[tp].label || '')
            var pointLines = splitLines(ctx, pointLabel, contentWidth - 16, 19)
            for (var pl = 0; pl < pointLines.length; pl++) {
              ctx.fillText(pointLines[pl], contentX + 16, dy)
              dy += 27
            }
            dy += 8
          }
        }

        lastTextY = dy
        console.log('[PosterRC6][LAYOUT]', { card: '05', cardY: cardY, cardHeight: h, cardBottom: cardY + h, lastTextY: lastTextY })
        if (lastTextY > cardY + h - CARD_PAD_BOT) {
          throw new Error('POSTER_CARD_CONTENT_OVERFLOW:05')
        }

      } else if (item.type === 'cogVerdict') {
        // ── RC6.0 06: 认知宣判 ──
        var cy = cardY + CARD_PAD_TOP + TITLE_H + 18

        // 核心宣判
        console.log('[PosterRC6][FONT_CALL]', { section: 'card06-statement', hasCtx: !!ctx, ctxType: typeof ctx, hasMeasureText: !!ctx && typeof ctx.measureText === 'function', textType: typeof cogStatement, fontSize: 24 })
        cy += drawWrappedText(ctx, cogStatement, contentX, cy, {
          maxWidth: contentWidth - 8, lineHeight: 32, fontSize: 24,
          color: '#D9C5FF', maxLines: 4, ellipsis: '…',
        }).height + 16

        // 行动锚点 label
        ctx.font = '20px sans-serif'
        ctx.fillStyle = ('#A68FCE')
        ctx.fillText('行动锚点', contentX, cy)
        cy += 26

        console.log('[PosterRC6][FONT_CALL]', { section: 'card06-anchor', hasCtx: !!ctx, ctxType: typeof ctx, hasMeasureText: !!ctx && typeof ctx.measureText === 'function', textType: typeof cogActionAnchor, fontSize: 22 })
        drawWrappedText(ctx, cogActionAnchor, contentX + 16, cy, {
          maxWidth: contentWidth - 16, lineHeight: 28, fontSize: 22,
          color: '#D9C5FF', maxLines: 3, ellipsis: '…',
        })

        lastTextY = cy + (item._aaLines || 2) * 28
        console.log('[PosterRC6][LAYOUT]', { card: '06', cardY: cardY, cardHeight: h, cardBottom: cardY + h, lastTextY: lastTextY })
        if (lastTextY > cardY + h - CARD_PAD_BOT) {
          throw new Error('POSTER_CARD_CONTENT_OVERFLOW:06')
        }

      } else {
        // ── Cards 01-04 ──
        console.log('[PosterRC6][FONT_CALL]', { section: 'card' + item.no + '-body', hasCtx: !!ctx, ctxType: typeof ctx, hasMeasureText: !!ctx && typeof ctx.measureText === 'function', textType: typeof item.text, fontSize: 26 })
        drawWrappedLines(ctx, item._lines, contentX, cardY + CARD_PAD_TOP + TITLE_H + 12, 34, '#eaf0ff', 26)
        lastTextY = cardY + CARD_PAD_TOP + TITLE_H + 12 + item._lines.length * 34
      }

      ctx.restore()

      console.log('[PosterRC6][P11] Card' + (index + 1) + ' OK')
      renderState.cards += 1
      cardY += h + GAP
    }

    var y = cardY

    // CTA (dynamic position from last card)
    var ctaY = y + 36

    roundRect(safeX, ctaY, cardW, ctaH, 24)
    ctx.fillStyle = ('rgba(10,12,40,0.94)')
    ctx.fill()
    ctx.strokeStyle = ('#7b5cff')
    ctx.lineWidth = (2)
    ctx.stroke()

    roundRect(safeX + 20, ctaY + 20, 110, 110, 18)
    ctx.fillStyle = ('#ffffff')
    ctx.fill()
    console.log('[PosterRC6][P12] QR section start', { qrPath: qrPath })
    // QR image via Canvas 2D createImage
    var qrImage = null
    try {
      qrImage = await self._loadPosterCanvasImage(canvas, qrPath)
    } catch (e) {
      console.error('[PosterRC6][2D] QR_IMAGE_LOAD_FAILED', { message: e && e.message, qrPath: qrPath })
    }
    if (qrImage) {
      console.log('[PosterRC6][P14] drawImage QR', { qrX: safeX + 28, qrY: ctaY + 28, qrSize: 94 })
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
    console.log('[PosterRC6][P15] footer done')

    console.log('[PosterRC6][P16] renderState', {
      background: renderState.background,
      header: renderState.header,
      cards: renderState.cards,
      qrSection: renderState.qrSection,
      footer: renderState.footer
    })

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
    console.log('[PosterRC6][P20] _saveToAlbum start', { filePath: filePath })
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        console.log('[PosterRC6][P20] save success')
        this.setData({ posterGenerating: false })
        wx.showModal({ title: '保存成功', content: '海报已保存，可发朋友圈裂变', showCancel: false })
      },
      fail: (err) => {
        console.log('[PosterRC6][P20] save fail', { errMsg: err && err.errMsg })
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
