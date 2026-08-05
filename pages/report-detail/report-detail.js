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

    // ══════════════════════════════════════════════
    //  RC6.1 Poster Design System
    // ══════════════════════════════════════════════
    var DS = {
      // ── Typography Tokens ──
      T: {
        PLATE:       { size: 42, weight: '700', lh: 48 },
        PLATE_SUB:   { size: 26, weight: '600', lh: 32 },
        CARD_TITLE:  { size: 26, weight: '600', lh: 34 },
        SCORE:       { size: 30, weight: '700', lh: 36 },
        SCORE_LABEL: { size: 20, weight: '600', lh: 26 },
        SECTION:     { size: 20, weight: '600', lh: 28 },
        SECTION:     { size: 20, weight: '600', lh: 28 },
        BODY:        { size: 22, weight: '400', lh: 33 },
        BODY_SM:     { size: 20, weight: '400', lh: 30 },
        LABEL:       { size: 18, weight: '600', lh: 24 },
        BADGE:       { size: 16, weight: '700', lh: 20 },
        CAPTION:     { size: 17, weight: '400', lh: 22 },
        CARD_NO:     { size: 52, weight: '700', lh: 56 },
        CARD_ICON:   { size: 40, weight: '400', lh: 46 },
        QR_TITLE:    { size: 34, weight: '600', lh: 40 },
        QR_SUB:      { size: 28, weight: '600', lh: 34 },
        QR_TAG:      { size: 15, weight: '400', lh: 20 },
        FOOTER:      { size: 22, weight: '600', lh: 28 },
        HEADER_RULE: { size: 26, weight: '600', lh: 32 },
      },
      // ── Spacing Tokens ──
      S: {
        CARD_PAD_TOP:    28,
        CARD_PAD_BOT:    32,
        TITLE_TO_BODY:   14,
        SECTION_GAP:     18,
        PARAGRAPH_GAP:   14,
        ITEM_GAP:        10,
        CARD_GAP:        16,
        QR_GAP:          36,
        FOOTER_GAP:      18,
        DIVIDER_INSET:   0,
        BODY_INSET:      16,
      },
      // ── Layout ──
      L: {
        W: 750, SAFE: 40, CARD_W: 670, LEFT_W: 112,
        CARD_R: 16, CARD_BORDER: 1.5,
        HEADER_H: 180, CTA_H: 150, FOOTER_H: 80,
        QR_SIZE: 94, QR_R: 18, QR_PAD: 20,
        CTA_R: 24, GLOW_ALPHA: 0.22,
      },
      // ── Card Minimum Heights ──
      CARD_MIN: {
        '01': 140, '02': 150, '03': 150, '04': 140,
        'destiny': 420, 'cogVerdict': 180,
      },
      // ── Colors ──
      CLR: {
        BG:           '#070b20',
        CARD_BG:      'rgba(8,14,32,0.88)',
        CARD_GLOW:    '#7b3cff',
        TEXT_WHITE:   '#ffffff',
        TEXT_ACCENT:  '#ff5ca8',
        RULE:         'rgba(255,92,168,0.45)',
        DIVIDER:      'rgba(255,255,255,0.08)',
        BODY:         '#eaf0ff',
        FOOTER:       '#7b6dff',
        QR_TITLE:     '#ff45c8',
        QR_TAG_BG:    'rgba(123,92,255,0.14)',
        QR_TAG_BD:    'rgba(180,130,255,0.7)',
        QR_TAG_TEXT:  '#d9d6ff',
        CTA_BG:       'rgba(10,12,40,0.94)',
        CTA_BD:       '#7b5cff',
        CTA_BD_W:     2,
        // 05 colors
        DESTINY_ACCENT:  '#108C59',
        DESTINY_LABEL:   '#94A3B8',
        DESTINY_BODY:    'rgba(185,210,200,0.88)',
        DESTINY_KV:      'rgba(210,225,218,0.88)',
        DESTINY_TP:      '#E2E8F0',
        // 06 colors
        COG_STATEMENT:   'rgba(225,210,255,0.92)',
        COG_LABEL:       '#B8A5E0',
        // Glow colors
        GLOW_1:          '#7b3cff',
        GLOW_2:          '#ff2d75',
        GLOW_3:          '#2d6bff',
      },
    }

    // ── Token Helpers ──
    function font(tok) { return (tok.weight || '400') + ' ' + tok.size + 'px sans-serif' }
    function setFont(ctx, tok) { ctx.font = font(tok) }
    function setColor(ctx, c) { ctx.fillStyle = (c) }

    // ── Divider ──
    function drawDivider(ctx, x, y, w) {
      ctx.strokeStyle = DS.CLR.DIVIDER
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(x + DS.S.DIVIDER_INSET, y)
      ctx.lineTo(x + w - DS.S.DIVIDER_INSET, y)
      ctx.stroke()
    }

    // ── Badge ──
    function drawBadge(ctx, x, y, text, type) {
      var badges = {
        yellow: { bg: 'rgba(255,193,7,0.18)', bd: '#ffc107', fg: '#ffc107' },
        green:  { bg: 'rgba(16,140,89,0.18)',  bd: '#108C59', fg: '#108C59' },
        purple: { bg: 'rgba(123,60,255,0.18)', bd: '#7b3cff', fg: '#b07cff' },
        blue:   { bg: 'rgba(45,107,255,0.18)', bd: '#2d6bff', fg: '#5a9cff' },
        red:    { bg: 'rgba(255,45,85,0.18)',  bd: '#ff2d55', fg: '#ff6b81' },
      }
      var b = badges[type] || badges.yellow
      var t = DS.T.BADGE
      setFont(ctx, t)
      var tw = ctx.measureText(text).width
      var bw = tw + 14; var bh = t.lh + 6
      roundRect(x, y, bw, bh, bh / 2)
      ctx.fillStyle = b.bg; ctx.fill()
      ctx.strokeStyle = b.bd; ctx.lineWidth = 1; ctx.stroke()
      ctx.fillStyle = b.fg; ctx.textAlign = 'center'
      ctx.fillText(text, x + bw / 2, y + bh / 2 + t.size / 3)
    }

    // ── Layout computed ──
    var L = DS.L
    var W = L.W; var safeX = L.SAFE; var cardW = L.CARD_W; var leftW = L.LEFT_W
    var contentX = safeX + leftW + DS.S.BODY_INSET * 2
    var contentRight = safeX + cardW - DS.S.BODY_INSET * 2
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
    //  Layout: real ctx measureText for all cards
    // ══════════════════════════════════════════════
    var SP = DS.S; var CM = DS.CARD_MIN; var T = DS.T; var C = DS.CLR
    var TITLE_H = T.CARD_TITLE.lh

    // ══════════════════════════════════════════════
    //  Card05 single-source layout (shared by measurement & drawing)
    // ══════════════════════════════════════════════
    var BADGE_H = T.BADGE.lh + 10  // badge visual height

    function layoutCard05Sections(ctx, cardY) {
      // Returns sections with y relative to CONTENT AREA TOP (after paddingTop + title)
      // Each section: { name, y, h } — drawing uses baseY + section.y
      var cy = 0
      var s = []

      // 1. Score
      s.push({ name: 'score', y: cy, h: T.SCORE.lh + SP.ITEM_GAP })
      cy += s[s.length - 1].h

      // Divider 1
      cy += SP.ITEM_GAP
      s.push({ name: 'divider1', y: cy, h: SP.SECTION_GAP })
      cy += SP.SECTION_GAP

      // 2. Baseline section: label + body
      setFont(ctx, T.SECTION)
      cy += T.SECTION.lh
      setFont(ctx, T.BODY_SM)
      var baseLines = splitLines(ctx, baselineOutcome, contentWidth - SP.BODY_INSET, T.BODY_SM.size)
      var baseLs = Math.min(baseLines.length, 3)
      var baseBodyH = baseLs * T.BODY_SM.lh
      s.push({ name: 'baseline', y: cy - T.SECTION.lh, h: T.SECTION.lh + baseBodyH + SP.SECTION_GAP })
      cy += baseBodyH + SP.SECTION_GAP

      // 3. Action section: label + badge + repair
      setFont(ctx, T.SECTION)
      cy += T.SECTION.lh
      var badgeText = currentIndex + ' → ' + projectedIndex
      setFont(ctx, T.BADGE)
      var badgeW = ctx.measureText(badgeText).width + 14
      var actionBodyH = BADGE_H + SP.ITEM_GAP + T.BODY_SM.lh
      s.push({ name: 'action', y: cy - T.SECTION.lh, h: T.SECTION.lh + actionBodyH + SP.SECTION_GAP })
      cy += actionBodyH + SP.SECTION_GAP

      // Divider 2
      cy += SP.ITEM_GAP
      s.push({ name: 'divider2', y: cy, h: SP.SECTION_GAP })
      cy += SP.SECTION_GAP

      // 4. Key variable: label + body
      setFont(ctx, T.SECTION)
      cy += T.SECTION.lh
      setFont(ctx, T.BODY_SM)
      var kvLines = splitLines(ctx, keyVariable, contentWidth - SP.BODY_INSET, T.BODY_SM.size)
      var kvLs = Math.min(kvLines.length, 3)
      var kvBodyH = kvLs * T.BODY_SM.lh
      s.push({ name: 'keyVariable', y: cy - T.SECTION.lh, h: T.SECTION.lh + kvBodyH + SP.SECTION_GAP })
      cy += kvBodyH + SP.SECTION_GAP

      // 5. Turning points — each as independent row with absolute Y
      var tpCount = turningPoints.length > 0 ? Math.min(turningPoints.length, 3) : 0
      var tpStart = cy
      var tpItems = []  // pre-measured items with absolute Y

      if (tpCount > 0) {
        setFont(ctx, T.SECTION)
        cy += T.SECTION.lh + SP.ITEM_GAP
        for (var tp = 0; tp < tpCount; tp++) {
          var tpDay = 'DAY ' + turningPoints[tp].day
          var tpLabel = turningPoints[tp].label || ''
          setFont(ctx, T.BADGE)
          var dayW = ctx.measureText(tpDay).width + 14
          setFont(ctx, T.CAPTION)
          var textW = contentWidth - SP.BODY_INSET - dayW - 10
          var tpLines = splitLines(ctx, tpLabel, textW, T.CAPTION.size)
          var itemH = Math.max(BADGE_H, tpLines.length * T.CAPTION.lh)
          tpItems.push({
            day: tpDay, label: tpLabel, dayW: dayW,
            lines: tpLines, itemH: itemH, y: cy
          })
          cy += itemH + (tp < tpCount - 1 ? SP.ITEM_GAP : 0)
        }
      }
      if (tpCount > 0) {
        s.push({ name: 'turningPoints', y: tpStart, h: cy - tpStart, items: tpItems })
        // No trailing SECTION_GAP — card pad bottom handles whitespace
      }

      return { sections: s, totalContentH: cy, baseLines: baseLines, baseLs: baseLs, kvLines: kvLines, kvLs: kvLs, tpCount: tpCount }
    }

    cards.forEach(function(item, index) {
      if (item.type === 'destiny') {
        var layout = layoutCard05Sections(ctx, 0) // measured from card top=0
        item._heightMeasured = Math.max(CM.destiny, SP.CARD_PAD_TOP + TITLE_H + SP.TITLE_TO_BODY + layout.totalContentH + SP.CARD_PAD_BOT)
        item._card05Layout = layout
        item._baseLines = layout.baseLs; item._kvLines = layout.kvLs
        item._tpCount = layout.tpCount
        // 审计：console.error + JSON.stringify 保证真机输出
        var _padT = SP.CARD_PAD_TOP + TITLE_H + SP.TITLE_TO_BODY
        var _padB = SP.CARD_PAD_BOT
        var _cH = layout.totalContentH
        console.error('[PosterRC6][CARD05_MEASURE]', JSON.stringify({
          totalContentH: _cH,
          paddingTop: _padT,
          paddingBottom: _padB,
          calculatedHeight: _padT + _cH + _padB,
          finalHeight: item._heightMeasured,
          sections: layout.sections.map(function(s) { return { type: s.name, y: s.y, h: s.h, bottom: s.y + s.h } })
        }))
      } else if (item.type === 'cogVerdict') {
        // Single-source Card06 layout (compact statement → divider → action anchor)
        var l06 = (function() {
          var cy = 0
          var ss = []
          // Statement — lighter font (weight 500, size 23)
          setFont(ctx, { size: 23, weight: '500' })
          var stLines = splitLines(ctx, cogStatement, contentWidth, 23)
          var stLs = Math.min(stLines.length, 4)
          if (stLines.length > stLs) stLines = stLines.slice(0, stLs)
          var stH = stLs * 34
          ss.push({ name: 'statement', y: cy, h: stH, lines: stLines })
          cy += stH + 16  // 16px gap before divider
          // Divider
          ss.push({ name: 'divider', y: cy, h: 14 })
          cy += 14  // divider region
          // Action: label + body
          var actY = cy
          setFont(ctx, { size: 18, weight: '600' })
          var lblH = 24
          setFont(ctx, { size: 21, weight: '400' })
          var aaLines = splitLines(ctx, cogActionAnchor, contentWidth, 21)
          var aaLs = Math.min(aaLines.length, 3)
          if (aaLines.length > aaLs) aaLines = aaLines.slice(0, aaLs)
          var aaBodyH = aaLs * 31
          ss.push({ name: 'action', y: actY, h: lblH + 6 + aaBodyH, lines: aaLines })
          cy += lblH + 6 + aaBodyH
          return { sections: ss, totalContentH: cy, stLines: stLines, stLs: stLs, aaLines: aaLines, aaLs: aaLs }
        })()
        var _padT = SP.CARD_PAD_TOP + TITLE_H + SP.TITLE_TO_BODY
        item._heightMeasured = Math.max(CM.cogVerdict, _padT + l06.totalContentH + SP.CARD_PAD_BOT)
        item._card06Layout = l06
        item._stLines = l06.stLs; item._aaLines = l06.aaLs

        console.error('[PosterRC6][CARD06_MEASURE]', JSON.stringify({
          totalContentH: l06.totalContentH,
          paddingTop: _padT,
          paddingBottom: SP.CARD_PAD_BOT,
          calculatedHeight: _padT + l06.totalContentH + SP.CARD_PAD_BOT,
          finalHeight: item._heightMeasured
        }))
        console.error('[PosterRC6][CARD06_LAYOUT]', JSON.stringify({
          sections: l06.sections.map(function(s) { return { type: s.name, y: s.y, h: s.h, bottom: s.y + s.h } })
        }))
      } else {
        setFont(ctx, T.BODY)
        item._lines = splitLines(ctx, item.text || '', contentWidth, T.BODY.size)
        var minH = CM[item.no] || 140
        item._heightMeasured = Math.max(minH, SP.CARD_PAD_TOP + TITLE_H + SP.TITLE_TO_BODY + item._lines.length * T.BODY.lh + SP.CARD_PAD_BOT)
      }
      console.log('[PosterRC6][MEASURE] Card' + (index + 1) + ' height=' + item._heightMeasured)
    })

    var headerH = L.HEADER_H; var ctaH = L.CTA_H; var footerH = L.FOOTER_H
    var cardsH = cards.reduce(function(sum, item) { return sum + item._heightMeasured }, 0) + SP.CARD_GAP * (cards.length - 1)
    var H = headerH + cardsH + SP.QR_GAP + SP.QR_GAP + ctaH + footerH

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

    drawGlow(160, 120, 220, C.GLOW_1, L.GLOW_ALPHA + 0.04)
    drawGlow(620, 120, 240, C.GLOW_2, L.GLOW_ALPHA - 0.04)
    drawGlow(375, H - 220, 300, C.GLOW_3, L.GLOW_ALPHA - 0.04)

    // 标题
    ctx.textAlign = 'center'
    setFont(ctx, T.PLATE); setColor(ctx, C.TEXT_WHITE)
    ctx.fillText('珠澳小事哥 · 认知翻身策略', W / 2, headerH / 2 - 14)
    setFont(ctx, T.PLATE_SUB); setColor(ctx, C.TEXT_ACCENT)
    ctx.fillText('🧠 认知教练视角已激活', W / 2, headerH / 2 + 28)
    ctx.strokeStyle = C.RULE; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(70, headerH - 35); ctx.lineTo(680, headerH - 35); ctx.stroke()
    renderState.header = true
    console.log('[PosterRC6][P10] header done')

    // 卡片
    var cardY = headerH
    var cardCount = cards.length

    for (var ci = 0; ci < cardCount; ci++) {
      var item = cards[ci]; var index = ci; var h = item._heightMeasured
      console.log('[PosterRC6][P11] Card' + (index + 1) + ' start', { title: item.title, cardY: cardY, height: h })
      ctx.save()

      // ── Card background ──
      roundRect(safeX, cardY, cardW, h, L.CARD_R)
      ctx.fillStyle = C.CARD_BG; ctx.fill()
      ctx.strokeStyle = item.color; ctx.lineWidth = L.CARD_BORDER; ctx.stroke()
      ctx.globalAlpha = 0.16; ctx.fillStyle = item.color
      ctx.fillRect(safeX, cardY, leftW, h); ctx.globalAlpha = 1

      // Card number + icon
      ctx.textAlign = 'center'
      setFont(ctx, T.CARD_NO); setColor(ctx, item.color)
      ctx.fillText(item.no, safeX + leftW / 2, cardY + SP.CARD_PAD_TOP + 18)
      setFont(ctx, T.CARD_ICON)
      ctx.fillText(item.icon, safeX + leftW / 2, cardY + SP.CARD_PAD_TOP + 52)

      // Card title
      ctx.textAlign = 'left'
      setFont(ctx, T.CARD_TITLE); setColor(ctx, item.color)
      ctx.fillText(item.icon + ' ' + item.title, contentX, cardY + SP.CARD_PAD_TOP + TITLE_H / 2 + 6)

      var lastTextY = cardY + SP.CARD_PAD_TOP + TITLE_H / 2

      if (item.type === 'destiny') {
        // ═══ Soft card clip — protects card rounded corners ═══
        ctx.save()
        ctx.beginPath()
        roundRect(safeX + 2, cardY + 2, cardW - 4, h - 4, L.CARD_R)
        ctx.clip()
        ctx.save()  // inner save for section-level clip restore

        // ═══ 05 命运模拟器 — unified content origin ═══
        var l = item._card05Layout
        var _padT = SP.CARD_PAD_TOP + TITLE_H + SP.TITLE_TO_BODY
        var originY = cardY + _padT  // content area top
        // Reset text state
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'

        function assert05X(name, x, w, textAlign) {
          w = w || 0
          var align = textAlign || ctx.textAlign || 'left'
          var realLeft = x
          if (align === 'center') realLeft = x - w / 2
          else if (align === 'right') realLeft = x - w
          var realRight = realLeft + w
          if (realLeft < contentX || realRight > contentRight) {
            console.error('[PosterRC6][CARD05_TEXT_X_OVERFLOW]', JSON.stringify({
              name: name, x: x, w: w, textAlign: align,
              realLeft: realLeft, realRight: realRight,
              contentX: contentX, contentRight: contentRight
            }))
          }
        }

        // Score
        setFont(ctx, T.SCORE); setColor(ctx, C.DESTINY_ACCENT)
        var scoreStr = currentIndex + '分'
        assert05X('score', contentX, ctx.measureText(scoreStr).width)
        ctx.fillText(scoreStr, contentX, originY + l.sections[0].y)
        var scoreW = ctx.measureText(scoreStr).width
        setFont(ctx, T.SCORE_LABEL)
        ctx.fillText(' · ' + currentLevelLabel, contentX + scoreW, originY + l.sections[0].y)

        // Divider 1
        var div1y = originY + l.sections[1].y
        assert05X('divider1', contentX, contentWidth)
        drawDivider(ctx, contentX, div1y, contentWidth)

        // A 路径: label at section y, body indented
        var aSec = l.sections[2]
        var ay = originY + aSec.y
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
        setFont(ctx, T.SECTION); ctx.fillStyle = C.DESTINY_LABEL
        ctx.fillText('▶ 保持现状', contentX, ay)
        setFont(ctx, T.BODY_SM); setColor(ctx, C.DESTINY_BODY)
        for (var bi = 0; bi < l.baseLines.length && bi < (item._baseLines || 3); bi++) {
          ctx.fillText(l.baseLines[bi], contentX + SP.BODY_INSET, ay + T.SECTION.lh + bi * T.BODY_SM.lh)
        }

        // B 路径: label + badge + repair
        var actSec = l.sections[3]
        var actY = originY + actSec.y
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
        setFont(ctx, T.SECTION); ctx.fillStyle = C.DESTINY_ACCENT
        ctx.fillText('▶ 执行方案', contentX, actY)
        // Badge
        var badgeText = currentIndex + ' → ' + projectedIndex
        var badgeAY = actY + T.SECTION.lh
        drawBadge(ctx, contentX + SP.BODY_INSET, badgeAY, badgeText, 'green')
        ctx.textAlign = 'left'
        // Repair text — aligned to contentX + BODY_INSET (same as badge start)
        assert05X('repairCycle', contentX + SP.BODY_INSET, ctx.measureText('预计结构修复周期：' + repairCycleDays + '天').width)
        setFont(ctx, T.BODY_SM); setColor(ctx, C.DESTINY_ACCENT)
        ctx.fillText('预计结构修复周期：' + repairCycleDays + '天', contentX + SP.BODY_INSET, badgeAY + BADGE_H + SP.ITEM_GAP)

        // Divider 2
        var div2y = originY + l.sections[4].y
        assert05X('divider2', contentX, contentWidth)
        drawDivider(ctx, contentX, div2y, contentWidth)

        // 🔑 关键变量
        var kvSec = l.sections[5]
        var kvY = originY + kvSec.y
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
        setFont(ctx, T.SECTION); ctx.fillStyle = C.DESTINY_LABEL
        ctx.fillText('🔑 关键变量', contentX, kvY)
        setFont(ctx, T.BODY_SM); setColor(ctx, C.DESTINY_KV)
        for (var ki = 0; ki < l.kvLines.length && ki < (item._kvLines || 3); ki++) {
          ctx.fillText(l.kvLines[ki], contentX + SP.BODY_INSET, kvY + T.SECTION.lh + ki * T.BODY_SM.lh)
        }

        // 📍 关键转折点 — absolute Y from pre-measured items
        if (item._tpCount > 0) {
          var tpSec = l.sections[6]
          var tpY = originY + tpSec.y
          ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
          setFont(ctx, T.SECTION); ctx.fillStyle = C.DESTINY_LABEL
          ctx.fillText('📍 关键转折点', contentX, tpY)

          var tpItems = tpSec.items
          for (var tp = 0; tp < tpItems.length; tp++) {
            var tpi = tpItems[tp]
            var itemY = originY + tpi.y
            // Badge
            assert05X('tpBadge_' + tp, contentX + SP.BODY_INSET, tpi.dayW)
            drawBadge(ctx, contentX + SP.BODY_INSET, itemY, tpi.day, 'blue')
            // Text to right of badge — use light color for contrast
            ctx.textAlign = 'left'
            setFont(ctx, T.CAPTION); setColor(ctx, '#E2E8F0')
            var textX = contentX + SP.BODY_INSET + tpi.dayW + 8
            assert05X('tpText_' + tp, textX, contentWidth - SP.BODY_INSET - tpi.dayW - 8)
            for (var tl = 0; tl < tpi.lines.length; tl++) {
              ctx.fillText(tpi.lines[tl], textX, itemY + BADGE_H / 2 + 6 + tl * T.CAPTION.lh)
            }
            console.log('[PosterRC6][TP_DRAW] item ' + tp + ': itemY=' + itemY + ' day=' + tpi.day)
          }
        }

        // ── Compute real content bottom (no redraw — bg drawn before content) ──
        lastTextY = cardY + _padT + l.totalContentH
        console.error('[PosterRC6][CARD05_DIVIDER_CHECK]', JSON.stringify({
          dividerCount: 2,
          divider1: { y: l.sections[1].y, h: l.sections[1].h },
          divider2: { y: l.sections[4].y, h: l.sections[4].h },
          totalContentH: l.totalContentH,
          cardHeight: h,
          lastTextY: lastTextY
        }))

        // ── Audit logs ──
        var lastSection = l.sections[l.sections.length - 1]
        var expectedContentBottom = cardY + _padT + l.totalContentH
        var lastDrawYCalc = cardY + _padT + lastSection.y + lastSection.h
        var delta05 = lastDrawYCalc - expectedContentBottom

        console.error('[PosterRC6][CARD05_LAYOUT_ID]', JSON.stringify({
          measuredLayoutTotal: (item._card05Layout ? item._card05Layout.totalContentH : null),
          drawLayoutTotal: l.totalContentH,
          sameReference: item._card05Layout === l
        }))
        console.error('[PosterRC6][CARD05_VISUAL_LAYOUT]', JSON.stringify({
          cardY: cardY, cardHeight: h,
          contentOriginX: contentX,
          contentWidth: contentWidth,
          sections: l.sections.map(function(s) { return { type: s.name, y: s.y, h: s.h, bottom: s.y + s.h } })
        }))
        console.error('[PosterRC6][CARD05_FINAL_METRICS]', JSON.stringify({
          cardY: cardY,
          expectedContentBottom: expectedContentBottom,
          lastDrawY: lastDrawYCalc,
          delta: delta05,
          lastSectionType: lastSection ? lastSection.name : null,
          lastSectionY: lastSection ? lastSection.y : null,
          lastSectionH: lastSection ? lastSection.h : null,
          trailingGapApplied: false
        }))
        console.error('[PosterRC6][CARD05_HEIGHT]', JSON.stringify({
          card05StartY: cardY,
          card05ContentBottomY: expectedContentBottom,
          card05Height: h,
          contentBottom: expectedContentBottom,
          safeContentBottom: cardY + h - SP.CARD_PAD_BOT,
          padBottom: SP.CARD_PAD_BOT
        }))

        if (delta05 > 4) throw new Error('POSTER_CARD_CONTENT_OVERFLOW:05')

        // ── Release clip ──
        ctx.restore()  // inner save
        ctx.restore()  // outer save (card clip)

      } else if (item.type === 'cogVerdict') {
        // ═══ 06 认知宣判 — compact visual hierarchy ═══
        var l06 = item._card06Layout
        var _padT = SP.CARD_PAD_TOP + TITLE_H + SP.TITLE_TO_BODY
        var baseY = cardY + _padT

        // Statement — lighter weight for readability
        var stSec = l06.sections[0]
        setFont(ctx, { size: 23, weight: '500' }); setColor(ctx, C.COG_STATEMENT)
        for (var si = 0; si < stSec.lines.length; si++) {
          ctx.fillText(stSec.lines[si], contentX, baseY + stSec.y + si * 34)
        }

        // Divider
        var divSec = l06.sections[1]
        drawDivider(ctx, contentX, baseY + divSec.y + 4, contentWidth)

        // Action: label + body
        var actSec = l06.sections[2]
        setFont(ctx, { size: 18, weight: '600' }); setColor(ctx, C.COG_LABEL)
        ctx.fillText('行动锚点', contentX, baseY + actSec.y)
        setFont(ctx, { size: 21, weight: '400' }); setColor(ctx, C.COG_STATEMENT)
        for (var ai = 0; ai < actSec.lines.length; ai++) {
          ctx.fillText(actSec.lines[ai], contentX, baseY + actSec.y + 24 + 6 + ai * 31)
        }

        // lastDrawY from single-source layout
        var expectedContentBottom = cardY + _padT + l06.totalContentH
        var lastDrawYCalc = cardY + _padT + actSec.y + actSec.h
        var delta06 = lastDrawYCalc - expectedContentBottom

        console.error('[PosterRC6][CARD06_VISUAL_LAYOUT]', JSON.stringify({
          cardY: cardY, cardHeight: h,
          contentOriginX: contentX,
          contentWidth: contentWidth,
          sections: l06.sections.map(function(s) { return { type: s.name, y: s.y, h: s.h, bottom: s.y + s.h } })
        }))
        console.error('[PosterRC6][CARD06_OVERFLOW]', JSON.stringify({
          cardY: cardY, cardHeight: h, cardBottom: cardY + h,
          totalContentH: l06.totalContentH,
          expectedContentBottom: expectedContentBottom,
          lastDrawY: lastDrawYCalc,
          delta: delta06
        }))

        if (delta06 > 4) throw new Error('POSTER_CARD_CONTENT_OVERFLOW:06')

      } else {
        // ═══ Cards 01-04 ═══
        setFont(ctx, T.BODY); setColor(ctx, C.BODY)
        drawWrappedLines(ctx, item._lines, contentX, cardY + SP.CARD_PAD_TOP + TITLE_H + SP.TITLE_TO_BODY, T.BODY.lh, C.BODY, T.BODY.size)
        lastTextY = cardY + SP.CARD_PAD_TOP + TITLE_H + SP.TITLE_TO_BODY + item._lines.length * T.BODY.lh
      }

      ctx.restore()
      console.log('[PosterRC6][P11] Card' + (index + 1) + ' OK')
      renderState.cards += 1
      cardY += h + SP.CARD_GAP
    }

    var y = cardY

    // ═══ CTA ═══
    var ctaY = y + SP.QR_GAP

    roundRect(safeX, ctaY, cardW, ctaH, L.CTA_R)
    ctx.fillStyle = C.CTA_BG; ctx.fill()
    ctx.strokeStyle = C.CTA_BD; ctx.lineWidth = C.CTA_BD_W; ctx.stroke()

    roundRect(safeX + L.QR_PAD, ctaY + L.QR_PAD, L.QR_SIZE + 16, L.QR_SIZE + 16, L.QR_R)
    ctx.fillStyle = C.TEXT_WHITE; ctx.fill()

    var qrImage = null
    try { qrImage = await self._loadPosterCanvasImage(canvas, qrPath) }
    catch (e) { console.error('[PosterRC6][2D] QR_IMAGE_LOAD_FAILED', { message: e && e.message }) }
    if (qrImage) { ctx.drawImage(qrImage, safeX + L.QR_PAD + 8, ctaY + L.QR_PAD + 8, L.QR_SIZE, L.QR_SIZE) }
    else { ctx.fillStyle = '#1a1a3a'; ctx.fillRect(safeX + L.QR_PAD + 8, ctaY + L.QR_PAD + 8, L.QR_SIZE, L.QR_SIZE) }

    ctx.textAlign = 'left'
    var qrTextX = safeX + L.QR_PAD + L.QR_SIZE + 30
    setFont(ctx, T.QR_TITLE); setColor(ctx, C.QR_TITLE)
    ctx.fillText('扫码测试你的翻身策略', qrTextX, ctaY + 58)
    setFont(ctx, T.QR_SUB); setColor(ctx, C.TEXT_WHITE)
    ctx.fillText('看看你的认知在什么段位', qrTextX, ctaY + 96)

    var tags = ['🧠 认知诊断', '📈 策略分析', '🎯 破局建议']
    tags.forEach(function(tag, i) {
      var tx = qrTextX + i * 142
      roundRect(tx, ctaY + 111, 124, 25, 11)
      ctx.fillStyle = C.QR_TAG_BG; ctx.fill()
      ctx.strokeStyle = C.QR_TAG_BD; ctx.stroke()
      ctx.textAlign = 'center'
      setFont(ctx, T.QR_TAG); setColor(ctx, C.QR_TAG_TEXT)
      ctx.fillText(tag, tx + 62, ctaY + 129)
    })

    renderState.qrSection = true

    ctx.textAlign = 'center'
    setFont(ctx, T.FOOTER); setColor(ctx, C.FOOTER)
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
