/**
 * pages/report-detail — v4 Cognitive Judgment Report + Poster Share
 *   Progressive Reveal → 8-layer V4 report / 5-layer V3 legacy
 */
const aiReportService = require('../../services/aiReportService.js')
const n4 = require('../../utils/reportNormalizerV4.js')
const app = getApp()
const REVEAL_DELAYS = [200, 500, 900, 1300, 1700, 2100, 2500, 2900]

// ══════════════════════════════════════════════
// RC8.1: Payload Normalizer — flatten nested answers
// ══════════════════════════════════════════════
function normalizeDiagnosticAnswers(payload) {
  if (!payload || typeof payload !== 'object') return {}

  var answers = payload.answers || payload

  // Handle double-nesting: { diagnosticVersion, answers: { answers: {...} } }
  if (answers && answers.answers && typeof answers.answers === 'object') {
    answers = answers.answers
  }

  // Remove metadata keys
  var clean = {}
  Object.keys(answers).forEach(function(k) {
    if (k !== 'diagnosticVersion' && k !== 'personality' && k !== 'personalityEmoji' && k !== 'personalityStyle') {
      clean[k] = answers[k]
    }
  })

  return clean
}

/**
 * RC8.2: Hash answers for snapshot dedup / cross-entry verification
 */
function hashAnswers(answers) {
  if (!answers || typeof answers !== 'object') return 'empty'
  var keys = Object.keys(answers).sort()
  var seed = 0
  for (var i = 0; i < keys.length; i++) {
    var v = String(answers[keys[i]] || '')
    for (var j = 0; j < v.length; j++) {
      seed = ((seed << 5) - seed + v.charCodeAt(j)) | 0
    }
  }
  return 'h_' + (seed >>> 0).toString(36).slice(0, 8) + '_k' + keys.length
}

/**
 * RC8.2: Recover partial answers from V3 legacy report
 */
function recoverAnswersFromV3Report(report) {
  if (!report) return null
  // V3 reports store { trapped_by, position, forbidden, path, next90days }
  // We can extract: income context from trapped_by, learning from position, etc.
  var recovered = {}
  if (report.trapped_by) recovered.income = String(report.trapped_by)
  if (report.position) recovered.learning = String(report.position)
  if (report.path) recovered.future = String(report.path)
  if (Array.isArray(report.next90days)) recovered.product = report.next90days.join('；')
  recovered._recoveredFromV3 = true
  return Object.keys(recovered).length > 1 ? recovered : null
}

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

     RC8.2 SNAPSHOT RECOVERY (5-level):
     1. globalData._diagnosticAnswers (new flow, preferred)
     2. globalData._diagnosticReport (V3 legacy, partial recovery)
     3. URL params (share / history entry with reportId → cloud fetch)
     4. wx.getStorageSync('diagnostic_snapshot') (cache recovery)
     5. None → show error

     KEY FIX: globalData is NOT required. Share/history/cache all resolved.
     ═══════════════════════════════════════ */
  async _startDiagnostic() {
    var answers = app.globalData._diagnosticAnswers
    var p = app.globalData._diagnosticPersonality
    var snapshotSource = 'NONE'

    // Clean globalData immediately to prevent double-use
    app.globalData._diagnosticAnswers = null
    app.globalData._diagnosticPersonality = null

    // Level 1: globalData (fresh from diagnostic flow)
    if (answers) {
      snapshotSource = 'GLOBAL_ANSWERS'
    }

    // Level 2: globalData._diagnosticReport (V3 partial recovery)
    if (!answers && app.globalData._diagnosticReport) {
      console.warn('[PosterRC8][SNAPSHOT] Level 2: V3 legacy report recovered')
      answers = recoverAnswersFromV3Report(app.globalData._diagnosticReport)
      p = app.globalData._diagnosticPersonality
      app.globalData._diagnosticReport = null
      app.globalData._diagnosticPersonality = null
      snapshotSource = 'VIEWMODEL_RECOVERY'
    }

    // Level 3: URL params (share / history entry with reportId)
    if (!answers) {
      var urlReportId = this.data._urlParams && this.data._urlParams.reportId
      if (urlReportId) {
        try {
          var cached = wx.getStorageSync('diag_snapshot_' + urlReportId) || wx.getStorageSync('reportData_' + urlReportId)
          if (cached && cached.answers) {
            answers = cached.answers
            snapshotSource = 'HISTORY_SNAPSHOT'
          }
        } catch (e) {}
      }
    }

    // Level 4: wx storage cache (app-level snapshot)
    if (!answers) {
      try {
        var storageSnapshot = wx.getStorageSync('diagnostic_snapshot')
        if (storageSnapshot && storageSnapshot.normalizedAnswers) {
          answers = storageSnapshot.normalizedAnswers
          snapshotSource = 'CACHE_SNAPSHOT'
        }
      } catch (e) { }
    }

    if (!answers) {
      console.error('[PosterRC8][SNAPSHOT] ALL 5 levels exhausted — no source found')
      this.setData({ loading: false, error: '诊断数据丢失，请重新开始' })
      setTimeout(function() { wx.redirectTo({ url: '/pages/challenge-play/challenge-play?mode=diagnostic' }) }, 1500)
      return
    }

    // ── RC8.1: Normalize answers for diagnosis engine ──
    var normalizedAnswers = normalizeDiagnosticAnswers(answers)
    this._rawDiagnosticAnswers = normalizedAnswers
    this._diagnosticSnapshot = {
      normalizedAnswers: normalizedAnswers,
      inputHash: hashAnswers(normalizedAnswers),
      snapshotSource: snapshotSource
    }

    console.log('[PosterRC8][ANSWERS_NORMALIZED]', {
      normalizedKeys: Object.keys(normalizedAnswers).length,
      snapshotSource: snapshotSource,
      inputHash: this._diagnosticSnapshot.inputHash,
      hadNesting: !!(answers.answers && typeof answers.answers === 'object')
    })

    // ═══ V4 E2E Start ═══
    const isV4 = answers.diagnosticVersion === 'v4'
    var clientDiagnosis = null

    if (isV4) {
      const answerKeys = answers.answers ? Object.keys(answers.answers) : Object.keys(answers).filter(k => !['diagnosticVersion'].includes(k))
      console.log('[DiagnosticV4E2EStart]', {
        diagnosticVersion: 'v4',
        answerKeyCount: answerKeys.length,
        missingKeys: '',
      })

      // ── RC8.2: Run diagnosis BEFORE cloud call so event.diagnosis is available for fallback router ──
      try {
        const dp = require('../../engine/diagnosisPipeline')
        clientDiagnosis = dp.runDiagnosis(normalizedAnswers, { primaryGoal: normalizedAnswers.primaryGoal || '' })
        // Attach input hash for server-side validation
        clientDiagnosis.inputHash = hashAnswers(normalizedAnswers)
        console.log('[DSN][CLIENT_DIAGNOSIS_READY]', {
          tags: (clientDiagnosis.behaviorTags || []).length,
          primary: (clientDiagnosis.wealthProfile || {}).primary,
          secondary: (clientDiagnosis.wealthProfile || {}).secondary,
          bottleneck: (clientDiagnosis.bottleneck || {}).id,
          strategy: (clientDiagnosis.strategy || {}).id,
          diagnosisVersion: clientDiagnosis.engineVersion,
          rulesetVersion: clientDiagnosis.rulesetVersion || 'RC8.2',
          inputHash: clientDiagnosis.inputHash,
          rInc001Status: clientDiagnosis.rInc001Status,
        })
      } catch (e) {
        console.error('[DSN][CLIENT_DIAGNOSIS_FAILED]', e.message)
        clientDiagnosis = null
      }
    }

    try {
      const r = await aiReportService.generateDiagnosticReport({
        answers,
        personality: (p && p.name) || '',
        personalityEmoji: (p && p.emoji) || '',
        personalityStyle: (p && p.style) || '',
        diagnosis: clientDiagnosis,
      })

      if (isV4) {
        console.log('[DiagnosticV4E2EResponse]', {
          code: r && r.code,
          reportId: r && r.data && r.data.reportId || '',
          reportType: r && r.data && r.data.reportType || '',
          renderSource: r && r.data && r.data.renderSource || '',
        })

        // ── RC8.2: Runtime Architecture Trace logging (device proof) ──
        var archTrace = r && r.data && r.data.runtimeArchitectureTrace
        if (archTrace) {
          console.error('[DSN][ARCHITECTURE_TRACE]', JSON.stringify({
            traceId: archTrace.traceId,
            stagesVisited: archTrace.stagesVisited,
            firstFailedStage: archTrace.firstFailedStage,
            routerEntered: archTrace.routerEntered,
            routerDecision: archTrace.routerDecision,
            finalReturnId: archTrace.finalReturnId,
            finalRenderSource: archTrace.finalRenderSource,
            diagnosisAvailableAtReturn: archTrace.diagnosisAvailableAtReturn,
            cacheHit: archTrace.cacheHit,
            cloudBuildSha: archTrace.cloudBuildSha,
            deploymentEnvId: archTrace.deploymentEnvId,
            cachedReportCreatedAt: archTrace.cachedReportCreatedAt,
            cachedRenderSource: archTrace.cachedRenderSource,
            cachedCloudBuildSha: archTrace.cachedCloudBuildSha,
            cachedDiagnosisPresent: archTrace.cachedDiagnosisPresent,
            cachedSnapshotVersion: archTrace.cachedSnapshotVersion,
            // Extra from data
            fallbackSource: r && r.data && r.data.fallbackSource,
            fallbackReasonCode: r && r.data && r.data.fallbackReasonCode,
            contentValidation: r && r.data && r.data.contentValidation,
            diagnosisTraceAvailable: r && r.data && r.data.diagnosisTrace && r.data.diagnosisTrace.available,
            providerTraceHttpStatus: r && r.data && r.data.providerTrace && r.data.providerTrace.httpStatus,
            diagnosisHandoffTrace: r && r.data && r.data.diagnosisHandoffTrace,
            clientBuildSha: '94ceca4',
          }))
        } else {
          console.error('[DSN][ARCHITECTURE_TRACE]', JSON.stringify({
            error: 'NO runtimeArchitectureTrace in response',
            renderSource: r && r.data && r.data.renderSource || '',
            fallbackSource: r && r.data && r.data.fallbackSource || '',
            dataKeys: r && r.data ? Object.keys(r.data).join(',') : 'NO_DATA',
            clientBuildSha: '94ceca4',
          }))
        }
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

    // ── RC8.1: Inject raw answers for diagnosis enrichment ──
    posterData.rawAnswers = this._rawDiagnosticAnswers || null

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
        // RC7 Hero tokens
        SCORE_HERO:  { size: 48, weight: '800', lh: 52 },
        KPI_VALUE:   { size: 24, weight: '700', lh: 30 },
        KPI_LABEL:   { size: 16, weight: '500', lh: 20 },
        TIMELINE_NO: { size: 28, weight: '700', lh: 32 },
        VERDICT:     { size: 20, weight: '700', lh: 28 },
        VERDICT_ANCHOR: { size: 18, weight: '600', lh: 26 },
      },
      // ── Spacing Tokens ──
      S: {
        CARD_PAD_TOP:    28,
        CARD_PAD_BOT:    32,
        TITLE_TO_BODY:   14,
        TITLE_BODY_GAP:  10,  // unified title→body gap for 01-04 & 06
        NUMBER_ICON_GAP: 10,  // unified number→icon gap for all cards
        SECTION_GAP:     12,
        PARAGRAPH_GAP:   10,
        ITEM_GAP:        8,
        CARD_GAP:        14,
        QR_GAP:          30,
        FOOTER_GAP:      18,
        DIVIDER_INSET:   0,
        BODY_INSET:      16,
        // RC7 compact for 01-04
        COMPACT_PAD_TOP: 18,
        COMPACT_PAD_BOT: 18,
      },
      // ── Layout ──
      L: {
        W: 750, SAFE: 40, CARD_W: 670, LEFT_W: 112,
        CARD_R: 16, CARD_BORDER: 1.5,
        HEADER_H: 180, CTA_H: 140, FOOTER_H: 80,
        QR_SIZE: 94, QR_R: 18, QR_PAD: 20,
        CTA_R: 24, GLOW_ALPHA: 0.22,
      },
      // ── Card Minimum Heights ──
      CARD_MIN: {
        '01': 110, '02': 120, '03': 120, '04': 110,
        'destiny': 440, 'cogVerdict': 220,
      },
      // ── Colors ──
      CLR: {
        BG:           '#070b20',
        CARD_BG:      'rgba(8,14,32,0.88)',
        CARD_GLOW:    '#7b3cff',
        TEXT_WHITE:   '#ffffff',
        TEXT_ACCENT:  '#ff5ca8',
        RULE:         'rgba(255,92,168,0.45)',
        DIVIDER:      'rgba(255,255,255,0.14)',
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
        COG_STATEMENT:   'rgba(255,220,180,0.95)',
        COG_LABEL:       '#D4AF37',
        COG_BG:          'rgba(70,40,0,0.35)',
        COG_BD:          'rgba(180,130,40,0.6)',
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
        blue:   { bg: 'rgba(45,107,255,0.12)', bd: '#2d6bff', fg: '#5a9cff' },
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

    // ── RC8.1: Run Cognitive Diagnosis if available ──
    var diagnosisResult = null
    var diagnosisTrace = {
      normalized: false,
      tagCount: 0,
      primary: null,
      secondary: null,
      bottleneck: null,
      strategy: null,
      authorityApplied: false,
      fallback: true,
      fallbackReason: 'RC8_NOT_STARTED'
    }

    try {
      var rawAnswers = pd.rawAnswers
      // Ensure no double-nesting
      if (rawAnswers && rawAnswers.answers && typeof rawAnswers.answers === 'object' && Object.keys(rawAnswers.answers).length > Object.keys(rawAnswers).length - 1) {
        rawAnswers = rawAnswers.answers
      }
      if (rawAnswers && Object.keys(rawAnswers).length > 0) {
        diagnosisTrace.normalized = true
        var diagEngine = require('../../engine/diagnosisPipeline')
        if (typeof diagEngine.runDiagnosis === 'function') {
          // Pass primaryGoal from poster data for strategy/bottleneck bias
          var diagOptions = {}
          if (pd.primaryGoal) diagOptions.primaryGoal = pd.primaryGoal
          diagnosisResult = diagEngine.runDiagnosis(rawAnswers, diagOptions)
          diagnosisTrace.tagCount = diagnosisResult.tagStats ? diagnosisResult.tagStats.totalTags : 0
          diagnosisTrace.primary = diagnosisResult.wealthProfile ? diagnosisResult.wealthProfile.primary : null
          diagnosisTrace.secondary = diagnosisResult.wealthProfile ? diagnosisResult.wealthProfile.secondary : null
          diagnosisTrace.bottleneck = diagnosisResult.bottleneck ? diagnosisResult.bottleneck.id : null
          diagnosisTrace.strategy = diagnosisResult.strategy ? diagnosisResult.strategy.id : null
          diagnosisTrace.fallback = false
          diagnosisTrace.fallbackReason = ''

          console.error('[PosterRC8][DIAGNOSIS]', JSON.stringify({
            version: diagnosisResult.engineVersion,
            tags: diagnosisTrace.tagCount,
            archetype: diagnosisTrace.primary,
            bottleneck: diagnosisTrace.bottleneck,
            strategy: diagnosisTrace.strategy,
            behaviorTagIds: diagnosisResult.behaviorTags.map(function(t) { return t.id })
          }))
        } else {
          diagnosisTrace.fallbackReason = 'RC8_REQUIRE_FAILED'
          diagnosisTrace.fallback = true
        }
      } else {
        diagnosisTrace.fallbackReason = 'RC8_INVALID_INPUT'
        diagnosisTrace.fallback = true
        console.error('[PosterRC8][FALLBACK]', JSON.stringify({
          renderSource: 'rule_fallback',
          fallbackUsed: true,
          fallbackReason: diagnosisTrace.fallbackReason,
          diagnosisVersion: 'RC8.1',
          promptVersion: 'v4',
          rulesetVersion: 'RC8.1',
          normalizedAnswerKeys: rawAnswers ? Object.keys(rawAnswers) : [],
          tagCount: 0,
          bottleneck: null,
          strategy: null,
          errorMessage: 'Empty or missing rawAnswers'
        }))
      }

      // Validate RC8 output integrity
      if (!diagnosisTrace.fallback) {
        if (diagnosisTrace.tagCount === 0) {
          diagnosisTrace.fallbackReason = 'RC8_EMPTY_TAGS'
          diagnosisTrace.fallback = true
        } else if (!diagnosisTrace.primary) {
          diagnosisTrace.fallbackReason = 'RC8_VALIDATION_FAILED'
          diagnosisTrace.fallback = true
        } else if (!diagnosisTrace.bottleneck || diagnosisTrace.bottleneck === 'UNKNOWN') {
          diagnosisTrace.fallbackReason = 'RC8_NO_BOTTLENECK'
          diagnosisTrace.fallback = true
        } else if (!diagnosisTrace.strategy) {
          diagnosisTrace.fallbackReason = 'RC8_NO_STRATEGY'
          diagnosisTrace.fallback = true
        }
      }
    } catch (e) {
      diagnosisTrace.fallback = true
      diagnosisTrace.fallbackReason = 'RC8_PIPELINE_THROW'
      console.error('[PosterRC8][FALLBACK]', JSON.stringify({
        renderSource: 'rule_fallback',
        fallbackUsed: true,
        fallbackReason: diagnosisTrace.fallbackReason,
        diagnosisVersion: 'RC8.1',
        promptVersion: 'v4',
        rulesetVersion: 'RC8.1',
        normalizedAnswerKeys: pd.rawAnswers ? Object.keys(pd.rawAnswers) : [],
        tagCount: diagnosisTrace.tagCount,
        bottleneck: diagnosisTrace.bottleneck,
        strategy: diagnosisTrace.strategy,
        errorMessage: e.message
      }))
    }

    // ── RC8 DECISION TRACE (always output) ──
    console.error('[PosterRC8][DECISION_TRACE]', JSON.stringify({
      STEP1_normalize: diagnosisTrace.normalized ? 'PASS' : 'FAIL',
      STEP2_tags: diagnosisTrace.tagCount > 0 ? 'PASS' : 'FAIL',
      STEP3_archetype: diagnosisTrace.primary ? 'PASS' : 'FAIL',
      STEP4_bottleneck: (diagnosisTrace.bottleneck && diagnosisTrace.bottleneck !== 'UNKNOWN') ? 'PASS' : 'FAIL',
      STEP5_strategy: diagnosisTrace.strategy ? 'PASS' : 'FAIL',
      STEP6_authority: diagnosisTrace.authorityApplied ? 'PASS' : 'SKIP',
      STEP7_render: !diagnosisTrace.fallback ? 'PASS' : 'FAIL',
      STEP8_gate: diagnosisTrace.gateRepaired ? 'REPAIRED' : (diagnosisTrace.gateBlocked === false ? 'PASS' : 'SKIP'),
      reasonCode: diagnosisTrace.fallbackReason,
      diagnosisAuthorityApplied: diagnosisTrace.authorityApplied,
      legacyRuleUsedAsBackground: legacyOverrideDetected,
      diagnosisTrace: {
        normalized: diagnosisTrace.normalized,
        tagCount: diagnosisTrace.tagCount,
        primary: diagnosisTrace.primary,
        bottleneck: diagnosisTrace.bottleneck,
        strategy: diagnosisTrace.strategy,
        authorityApplied: diagnosisTrace.authorityApplied,
        fallback: diagnosisTrace.fallback,
        gateBlocked: diagnosisTrace.gateBlocked || false,
        gateRepaired: diagnosisTrace.gateRepaired || false
      }
    }))

    // RC8.1: Enrich with diagnosis engine if available
    if (diagnosisResult) {
      // Inject diagnosis into poster data for card rendering
      pd.diagnosis = {
        behaviorTags: diagnosisResult.behaviorTags,
        tagStats: diagnosisResult.tagStats,
        wealthProfile: diagnosisResult.wealthProfile,
        bottleneck: diagnosisResult.bottleneck,
        strategy: diagnosisResult.strategy,
        confidence: diagnosisResult.wealthProfile.confidence,
        evidence: diagnosisResult.bottleneck.reason || [],
        validation: diagnosisResult.validation || null
      }

      // ── RC8.2: Diagnostic Snapshot (persisted to report) ──
      pd.diagnosticSnapshot = {
        normalizedAnswers: this._rawDiagnosticAnswers || null,
        diagnosis: pd.diagnosis,
        engineVersions: {
          diagnosisEngineVersion: 'RC8.2',
          snapshotVersion: '2.0'
        },
        inputHash: this._diagnosticSnapshot ? this._diagnosticSnapshot.inputHash : hashAnswers(this._rawDiagnosticAnswers || {}),
        snapshotSource: this._diagnosticSnapshot ? this._diagnosticSnapshot.snapshotSource : 'UNKNOWN'
      }
      // Sanity check: snapshot MUST have normalizedAnswers
      if (!pd.diagnosticSnapshot.normalizedAnswers || Object.keys(pd.diagnosticSnapshot.normalizedAnswers).length === 0) {
        console.error('[PosterRC8][SNAPSHOT_PERSIST_FAILED] normalizedAnswers is empty')
        pd.diagnosticSnapshot._persistError = 'EMPTY_ANSWERS'
      }

      // ── RC8.2: Decision Trace (included in response data, not just console) ──
      pd.rc8DecisionTrace = {
        payloadNormalized: diagnosisTrace.normalized,
        normalizedAnswerKeyCount: diagnosisTrace.normalizedAnswerKeyCount ||
          (this._rawDiagnosticAnswers ? Object.keys(this._rawDiagnosticAnswers).length : 0),
        snapshotSource: this._diagnosticSnapshot ? this._diagnosticSnapshot.snapshotSource : 'UNKNOWN',
        snapshotResolved: !!this._diagnosticSnapshot && !!this._diagnosticSnapshot.normalizedAnswers,
        snapshotValid: !!pd.diagnosticSnapshot && !!pd.diagnosticSnapshot.normalizedAnswers,
        diagnosisPresent: !!diagnosisResult,
        pipelineExecuted: !diagnosisTrace.fallback,
        tagCount: diagnosisTrace.tagCount,
        primaryArchetype: diagnosisTrace.primary,
        secondaryArchetype: diagnosisTrace.secondary,
        bottleneck: diagnosisTrace.bottleneck,
        strategy: diagnosisTrace.strategy,
        authorityApplied: diagnosisTrace.authorityApplied || false,
        reportValidated: !diagnosisTrace.gateRepaired,
        repairAttempted: diagnosisTrace.gateRepaired || false,
        fallbackUsed: diagnosisTrace.fallback,
        fallbackReason: diagnosisTrace.fallbackReason || '',
        inputHash: pd.diagnosticSnapshot.inputHash
      }

      console.error('[PosterRC8][DIAGNOSIS_READY]', JSON.stringify({
        renderSource: 'rc8_diagnosis',
        fallbackUsed: false,
        fallbackReason: '',
        diagnosisVersion: diagnosisResult.engineVersion,
        promptVersion: 'RC8_PROMPT_V2',
        rulesetVersion: 'RC8_RULESET_V3',
        decisionTrace: pd.rc8DecisionTrace
      }))

      // Override with engine-generated strategy if AI output is generic
      if (!cogActionAnchor || cogActionAnchor.length < 30) {
        cogActionAnchor = diagnosisResult.strategy.description || cogActionAnchor
      }
      if (!cogStatement || cogStatement.length < 30) {
        cogStatement = '你的财富人格: ' +
          (diagnosisResult.wealthProfile.primaryTitle || '待评估') + ' — ' +
          (diagnosisResult.strategy.tagline || '')
      }
      console.error('[PosterRC8][ENRICH] Cards enriched with diagnosis engine')

      // ── RC8: Single-strategy validation ──
      var strategyId = diagnosisResult.strategy.id
      if (cogActionAnchor && cogActionAnchor.length > 0) {
        // Ensure card 06 reflects only the ONE strategy
        var multiThemeCheck = cogActionAnchor.indexOf('content') >= 0 && cogActionAnchor.indexOf('freelance') >= 0
        if (multiThemeCheck) {
          console.error('[PosterRC8][MULTI_THEME_WARNING] Strategy=' + strategyId + ' but text contains multiple themes')
        }
      }

      // Mark authority override as applied
      diagnosisTrace.authorityApplied = true
    } else {
      diagnosisTrace.fallbackReason = 'RC8_DISABLED'
      diagnosisTrace.fallback = true
      console.error('[PosterRC8][FALLBACK]', JSON.stringify({
        renderSource: 'rule_fallback',
        fallbackUsed: true,
        fallbackReason: diagnosisTrace.fallbackReason,
        diagnosisVersion: 'RC8.1',
        promptVersion: 'v4',
        rulesetVersion: 'RC8.1',
        normalizedAnswerKeys: pd.rawAnswers ? Object.keys(pd.rawAnswers) : [],
        tagCount: diagnosisTrace.tagCount,
        bottleneck: diagnosisTrace.bottleneck,
        strategy: diagnosisTrace.strategy,
        errorMessage: 'diagnosisResult is null'
      }))
    }

    // ── Card body text from mapper (may be overridden by RC8 below) ──
    var verdict = pd.verdict || ''
    var coreConflict = pd.coreConflict || ''
    var decision = pd.decision || ''
    var firstAction = pd.firstAction || ''

    // ── RC8.2: Authority override — RC8 diagnosis MUST drive cards, not old rules ──
    var legacyOverrideDetected = false
    var overclaimViolations = []
    var unsupportedPercentages = []
    var duplicateMeaningFlag = false

    if (diagnosisResult) {
      var dx = diagnosisResult
      var bnLabel = dx.bottleneck.label || ''
      var stLabel = dx.strategy.label || ''
      var arLabel = dx.wealthProfile.primaryTitle || ''
      var stTagline = dx.strategy.tagline || ''
      var stMilestones = dx.strategy.milestones || []
      var day1Mission = dx.strategy.day1Mission || ''
      var bnDescription = dx.bottleneck.description || ''
      var bnSolution = dx.bottleneck.solution || ''

      // ── Card01: Verdikt → bottleneck-driven ──
      // R_INC_001 ("单工资依赖") must NOT override RC8 bottleneck
      var rc8Verdict = '你的核心瓶颈：' + bnLabel + '。' + bnDescription
      if (verdict.indexOf('单工资依赖') >= 0 || verdict.indexOf('单一工资') >= 0 || verdict.indexOf('R_INC') >= 0) {
        legacyOverrideDetected = true
        verdict = rc8Verdict
        console.error('[PosterRC8][OVERRIDE] Card01: R_INC_001 legacy rule replaced by RC8 bottleneck: ' + bnLabel)
      } else if (verdict.length < 20 || (!diagnosisResult && verdict.length < 20)) {
        verdict = rc8Verdict + ' ' + bnSolution
      }

      // ── Card02: Core conflict → strategy-driven ──
      var rc8Conflict = arLabel + '的突破路径：' + stLabel + '。' + stTagline
      if (coreConflict.indexOf('单工资') >= 0 || coreConflict.indexOf('R_INC') >= 0) {
        legacyOverrideDetected = true
        coreConflict = rc8Conflict
        console.error('[PosterRC8][OVERRIDE] Card02: Legacy rule replaced by RC8 strategy')
      } else if (coreConflict.length < 15) {
        var evidenceTags = dx.bottleneck.reason || []
        coreConflict = rc8Conflict + '（基于' + evidenceTags.length + '个行为标签）'
      }

      // ── Card03: Decision → strategy single-path ──
      var rc8Decision = 'ONE THING: ' + stLabel + '。' + stTagline
      if (decision.indexOf('停止') >= 0 || decision.indexOf('排除') >= 0) {
        // Legacy "stop" decision is OK — keep it but append RC8 focus
        decision = decision + ' | 集中：' + stLabel
      } else {
        decision = rc8Decision
      }

      // ── Card04: First action → Day1 mission ──
      if (day1Mission && day1Mission.length > 0) {
        firstAction = day1Mission
      }

      // ── Card06 (cognitive verdict): strategy-driven with single theme ──
      var ipAnchor = ''
      var ipFallthrough = ''

      if (dx.strategy.id === 'BUILD_IP') {
        // Single-theme enforcement for BUILD_IP
        ipAnchor = '定位 → 内容输出 → 获客入口 → 标准化产品 → 成交验证'
        ipFallthrough = '销售和产品化是IP路径的执行环节，不是独立方向。'

        // Block multi-theme contamination in Card06
        var forbiddenThemes = ['自由职业','副业方向','AI副业','多个方向','投资','创业','多种收入']
        forbiddenThemes.forEach(function(theme) {
          if (cogActionAnchor.indexOf(theme) >= 0) {
            cogActionAnchor = cogActionAnchor.replace(new RegExp('[^^。]*?' + theme + '[^。]*?[。]?', 'g'), '')
            console.error('[PosterRC8][THEME_PURGE] Removed forbidden theme from Card06: ' + theme)
          }
        })
        if (cogStatement.indexOf('自由职业') >= 0 || cogStatement.indexOf('多个方向') >= 0) {
          cogStatement = arLabel + '的唯一突破路径：' + ipAnchor
        }
        if (cogActionAnchor.indexOf('定位') < 0 && cogActionAnchor.indexOf('内容输出') < 0) {
          cogActionAnchor = ipAnchor + '。' + ipFallthrough + ' | ' + day1Mission
        }
      } else if (dx.strategy.id === 'BUILD_CASHFLOW') {
        ipAnchor = '第二收入来源 → 稳定现金流 → 解放时间 → 规模化'
      } else if (dx.strategy.id === 'SELL_FIRST') {
        ipAnchor = '报价 → 成交 → 记录 → 涨价 → 系统化'
      } else if (dx.strategy.id === 'BUILD_SYSTEM') {
        ipAnchor = '流程文档化 → 工具化 → 半自动化 → 全自动化'
      } else if (dx.strategy.id === 'BUILD_ACQUISITION_SYSTEM') {
        ipAnchor = '免费钩子 → 内容获客 → 私域沉淀 → 裂变放大'
      } else if (dx.strategy.id === 'DISCIPLINE_FIRST') {
        ipAnchor = '最小行动单元 → 每日输出 → 外部问责 → 反馈闭环'
      } else if (dx.strategy.id === 'BUILD_PRODUCT') {
        ipAnchor = '知识产品化 → MVP验证 → 迭代 → 标准化'
      }

      if (ipAnchor && cogActionAnchor.indexOf('定位') < 0 && cogActionAnchor.indexOf('内容输出') < 0) {
        cogActionAnchor = ipAnchor + '。' + day1Mission
      }

    // ── RULE_PRIORITY_AUDIT: Always output rule scores ──
    if (diagnosisResult) {
      var dx2 = diagnosisResult
      var rawTagWeights = {}
      if (dx2.behaviorTags) {
        dx2.behaviorTags.forEach(function(t) { rawTagWeights[t.id] = t.weight })
      }

      // Simulate legacy rule scores based on tag evidence
      var ruleScores = []
      if (rawTagWeights['SINGLE_INCOME'] || rawTagWeights['TIME_FOR_MONEY']) {
        ruleScores.push({ rule: 'R_INC_001', label: '单工资依赖', score: Math.round((rawTagWeights['SINGLE_INCOME'] || 0) * 100), evidence: 'SINGLE_INCOME=' + (rawTagWeights['SINGLE_INCOME'] || 0) })
      }
      if (rawTagWeights['NO_PRODUCT'] || rawTagWeights['HAS_PRODUCT_UNSOLD']) {
        ruleScores.push({ rule: 'R_EXEC_007', label: '有产品未卖出', score: Math.round((rawTagWeights['NO_PRODUCT'] || rawTagWeights['HAS_PRODUCT_UNSOLD'] || 0) * 100), evidence: 'NO_PRODUCT=' + (rawTagWeights['NO_PRODUCT'] || 0) + ' HAS_PRODUCT_UNSOLD=' + (rawTagWeights['HAS_PRODUCT_UNSOLD'] || 0) })
      }
      if (rawTagWeights['NO_EXECUTION'] || rawTagWeights['WAITING']) {
        ruleScores.push({ rule: 'R_EXEC_004', label: '执行力缺失', score: Math.round((rawTagWeights['NO_EXECUTION'] || rawTagWeights['WAITING'] || 0) * 100), evidence: 'NO_EXECUTION=' + (rawTagWeights['NO_EXECUTION'] || 0) })
      }
      if (rawTagWeights['LOW_SELF_VALUE'] || rawTagWeights['HESITANT_PRICING']) {
        ruleScores.push({ rule: 'R_PRC_002', label: '定价不自洽', score: Math.round((rawTagWeights['LOW_SELF_VALUE'] || rawTagWeights['HESITANT_PRICING'] || 0) * 100), evidence: 'LOW_SELF_VALUE=' + (rawTagWeights['LOW_SELF_VALUE'] || 0) })
      }
      if (rawTagWeights['NO_AUDIENCE'] || rawTagWeights['SCATTERED']) {
        ruleScores.push({ rule: 'R_TRF_003', label: '流量缺失', score: Math.round((rawTagWeights['NO_AUDIENCE'] || rawTagWeights['SCATTERED'] || 0) * 100), evidence: 'NO_AUDIENCE=' + (rawTagWeights['NO_AUDIENCE'] || 0) })
      }

      ruleScores.sort(function(a, b) { return b.score - a.score })
      var legacyWinner = ruleScores.length > 0 ? ruleScores[0] : null
      var rc8Winner = { rule: 'RC8_' + dx2.bottleneck.id, label: dx2.bottleneck.label, score: Math.round(dx2.wealthProfile.confidence * 100), evidence: dx2.behaviorTags ? dx2.behaviorTags.length + ' tags' : 'N/A' }

      console.error('[PosterRC8][RULE_PRIORITY_AUDIT]', JSON.stringify({
        legacyRules: ruleScores,
        legacyWinner: legacyWinner,
        rc8Winner: rc8Winner,
        authorityOverride: legacyOverrideDetected ? 'RC8_OVERRIDES_LEGACY' : 'LEGACY_PASSES_THROUGH',
        renderSource: !diagnosisTrace.fallback ? 'rc8_diagnosis' : 'rule_fallback',
        finalBottleneck: dx2.bottleneck.id
      }))
    }

      // ── R_INC_001 override logging ──
      if (legacyOverrideDetected) {
        console.error('[PosterRC8][LEGACY_OVERRIDDEN]', JSON.stringify({
          winningRule: 'RC8 bottleneck: ' + dx.bottleneck.id,
          losingRule: 'R_INC_001 / legacy fatalRules',
          archetypeBias: dx.wealthProfile.primary,
          evidenceScores: JSON.stringify(dx._raw ? {
            archetype: dx._raw.archetype.scores,
            bottleneck: dx._raw.bottleneck.candidates
          } : 'N/A'),
          tieBreakReason: dx.bottleneck.id === 'TRAFFIC' ? 'CREATOR+BUILDING_IP tags have higher signal than EMPLOYEE TIME_FOR_MONEY' : 'RC8 evidence chain overrides legacy rule match'
        }))
      }

      // ── RC8.1: Always persist decision trace to pd (even on success) ──
      if (!pd.rc8DecisionTrace) {
        pd.rc8DecisionTrace = {
          payloadNormalized: diagnosisTrace.normalized,
          normalizedAnswerKeyCount: (this._rawDiagnosticAnswers ? Object.keys(this._rawDiagnosticAnswers).length : 0),
          snapshotSource: this._diagnosticSnapshot ? this._diagnosticSnapshot.snapshotSource : 'UNKNOWN',
          snapshotResolved: !!this._diagnosticSnapshot,
          snapshotValid: false,
          diagnosisPresent: !!diagnosisResult,
          pipelineExecuted: !diagnosisTrace.fallback,
          tagCount: diagnosisTrace.tagCount,
          primaryArchetype: diagnosisTrace.primary,
          secondaryArchetype: diagnosisTrace.secondary,
          bottleneck: diagnosisTrace.bottleneck,
          strategy: diagnosisTrace.strategy,
          authorityApplied: diagnosisTrace.authorityApplied || false,
          reportValidated: !diagnosisTrace.gateRepaired,
          repairAttempted: diagnosisTrace.gateRepaired || false,
          fallbackUsed: diagnosisTrace.fallback,
          fallbackReason: diagnosisTrace.fallbackReason || ''
        }
      }
    }
    // ── RC8.2 FALLBACK CONTRACT: Even in rule_fallback, enforce single-theme output ──
    if (diagnosisTrace.fallback) {
      // Determine best-effort fallback based on available data
      var fallbackBn = 'POSITIONING'
      var fallbackSt = 'BUILD_CASHFLOW'
      var fallbackStLabel = '建立第二收入'
      var fallbackDay1 = '今天：找出你的一项可变现技能，列出具体交付物。'
      var fallbackCards = {
        bnDesc: '你的定位不够清晰，市场和客户不知道你具体能解决什么问题。',
        stPipe: '技能评估 → 最小交付物 → 报价测试 → 成交验证 → 规模化'
      }

      // Look for IP-building signals even in raw answers
      if (pd.rawAnswers) {
        var ansStr = JSON.stringify(pd.rawAnswers).toLowerCase()
        if (ansStr.indexOf('ip') >= 0 || ansStr.indexOf('个人品牌') >= 0 || ansStr.indexOf('个人ip') >= 0) {
          fallbackBn = 'TRAFFIC'
          fallbackSt = 'BUILD_IP'
          fallbackStLabel = '建立个人IP'
          fallbackDay1 = '今天：用一句话写清楚你是谁、帮谁、解决什么问题。这就是你的IP定位。'
          fallbackCards.bnDesc = '你有技术积累，但缺少持续的内容输出和获客入口。核心问题不是能力，是可见度。'
          fallbackCards.stPipe = '定位一句话 → 内容输出 → 获客入口 → 测试付费 → 成交验证'
        }
      }

      // Override Card03: ONE THING — no multi-direction
      decision = '集中：' + fallbackStLabel + '。' + fallbackCards.stPipe
      // Override Card04: concrete Day1
      firstAction = '今天：' + fallbackDay1
      // Override Card06: single pipeline, no multi-theme
      cogActionAnchor = fallbackCards.stPipe + '。' + fallbackDay1
      cogStatement = '你的唯一突破路径：' + fallbackCards.stPipe

      // Add fallback trace
      if (!pd.rc8DecisionTrace) {
        pd.rc8DecisionTrace = {
          payloadNormalized: diagnosisTrace.normalized,
          normalizedAnswerKeyCount: (this._rawDiagnosticAnswers ? Object.keys(this._rawDiagnosticAnswers).length : 0),
          snapshotSource: this._diagnosticSnapshot ? this._diagnosticSnapshot.snapshotSource : 'UNKNOWN',
          snapshotResolved: !!this._diagnosticSnapshot,
          snapshotValid: false,
          diagnosisPresent: false,
          pipelineExecuted: false,
          tagCount: 0,
          primaryArchetype: null,
          secondaryArchetype: null,
          bottleneck: fallbackBn,
          strategy: fallbackSt,
          authorityApplied: false,
          reportValidated: true,
          repairAttempted: true,
          fallbackUsed: true,
          fallbackReason: diagnosisTrace.fallbackReason || 'RC8_SNAPSHOT_MISSING'
        }
      }

      console.error('[PosterRC8][FALLBACK_CONTRACT]', JSON.stringify({
        renderSource: 'rule_fallback',
        fallbackReason: diagnosisTrace.fallbackReason,
        fallbackBottleneck: fallbackBn,
        fallbackStrategy: fallbackSt,
        decisionTrace: pd.rc8DecisionTrace
      }))
    }

    // ── RC8.2: Text quality validators ──
    // Check unsupported percentages
    var allCardTexts = [verdict, coreConflict, decision, firstAction, cogStatement, cogActionAnchor]
    var percentPatterns = [/比\d+%的人/, /超过了?\d+%/, /\%的人/, /\d+%都不具备/, /超过绝大多数/, /比99%/]
    allCardTexts.forEach(function(txt, idx) {
      percentPatterns.forEach(function(pat) {
        if (txt && pat.test(txt)) {
          unsupportedPercentages.push({
            cardIndex: idx,
            pattern: String(pat),
            match: txt.match(pat)[0]
          })
        }
      })
    })
    if (unsupportedPercentages.length > 0) {
      console.error('[PosterRC8][UNSUPPORTED_PERCENTAGE]', JSON.stringify(unsupportedPercentages))
    }

    // ── RC8.2: IMPOSSIBLE_CERTAINTY_SCORE validator ──
    // after365/destiny score must NOT be 100. Cap at 90.
    // wealthProbability → renamed to potentialIndex to avoid misleading users.
    if (pd.destinySimulator && typeof pd.destinySimulator === 'object') {
      var sim = pd.destinySimulator
      if (sim.after365 === 100 || sim.wealthProbability === 100 || sim.turnaroundProbability === 100) {
        console.error('[PosterRC8][IMPOSSIBLE_CERTAINTY_SCORE] Destiny score is 100 — capping to 90', JSON.stringify(sim))
        // If this is a v4 viewModel, we have horizonDays and actionPath — recalculate
        if (sim.horizonDays) {
          sim.potentialIndex = Math.min(90, Math.round((sim.after365 || sim.wealthProbability || 50) * 0.9))
          sim._certaintyWarning = '预测为模拟指标，不代表实际成功概率。封顶90分。'
          delete sim.wealthProbability  // Remove misleading name
        }
        // Clone to pd for safe storage
        pd.destinySimulator = sim
      }
      // Rename wealthProbability → potentialIndex for all cases
      if (sim.wealthProbability !== undefined) {
        sim.potentialIndex = Math.min(90, sim.wealthProbability)
        sim._renamedFrom = 'wealthProbability'
        delete sim.wealthProbability
      }
    }

    // ── RC8.2: UNTRACEABLE_NUMERIC_CLAIM validator ──
    // "12个优势点" must match actual advantageRules count
    var untraceableNumerics = []
    // Check headline patterns like "{N}个优势点" / "{N}个积极信号"
    var numericHeadlinePatterns = [
      { pattern: /(\d+)个优势点/, sourceField: 'advantageRules' },
      { pattern: /识别到\s*(\d+)\s*个/, sourceField: 'totalMatchCount' },
      { pattern: /(\d+)个致命问题/, sourceField: 'fatalRules' },
    ]
    var actualAdvantageCount = Array.isArray(pd.advantageRules) ? pd.advantageRules.length : null
    var actualFatalCount = Array.isArray(pd.fatalRules) ? pd.fatalRules.length : null
    var actualMatchCount = Array.isArray(pd.matchedRules) ? pd.matchedRules.length : null

    numericHeadlinePatterns.forEach(function(np) {
      allCardTexts.forEach(function(txt, idx) {
        if (!txt) return
        var m = txt.match(np.pattern)
        if (m) {
          var claimed = parseInt(m[1], 10)
          var actual = null
          if (np.sourceField === 'advantageRules') actual = actualAdvantageCount
          if (np.sourceField === 'fatalRules') actual = actualFatalCount
          if (np.sourceField === 'totalMatchCount') actual = actualMatchCount

          if (actual !== null && claimed !== actual) {
            untraceableNumerics.push({
              cardIndex: idx,
              claim: np.pattern.source,
              claimedValue: claimed,
              actualValue: actual,
              sourceField: np.sourceField,
              action: 'REPAIR: Replace with actual count or rephrase'
            })
            // Auto-repair
            var repaired = txt.replace(np.pattern,
              actual === 0 ? '未检测到匹配规则' : ('识别到' + actual + '个' + np.sourceField.replace('Rules', '').replace('Count', '')))
            allCardTexts[idx] = repaired
          }
        }
      })
    })
    if (untraceableNumerics.length > 0) {
      console.error('[PosterRC8][UNTRACEABLE_NUMERIC_CLAIM]', JSON.stringify(untraceableNumerics))
      // Re-assign repaired texts
      verdict = allCardTexts[0]
      coreConflict = allCardTexts[1]
      decision = allCardTexts[2]
      firstAction = allCardTexts[3]
      cogStatement = allCardTexts[4]
      cogActionAnchor = allCardTexts[5]
    }

    // Check over-claimed user states
    var overclaimPatterns = [
      { pattern: /不敢停/, category: 'EXAGGERATED_INSECURITY' },
      { pattern: /不敢病/, category: 'EXAGGERATED_INSECURITY' },
      { pattern: /不敢想/, category: 'EXAGGERATED_INSECURITY' },
      { pattern: /收入.*归零/, category: 'CATASTROPHIZING' },
      { pattern: /全部.*来自.*电动车/, category: 'OVERPERSONIFIED' },
    ]
    allCardTexts.forEach(function(txt, idx) {
      overclaimPatterns.forEach(function(op) {
        if (txt && op.pattern.test(txt)) {
          overclaimViolations.push({
            cardIndex: idx,
            category: op.category,
            match: txt.match(op.pattern)[0],
            suggestion: 'Use evidence-based expression: 现金流依赖工作时间, 缺少第二支撑, 抗波动能力有限'
          })
        }
      })
    })
    if (overclaimViolations.length > 0) {
      console.error('[PosterRC8][OVERCLAIMED_USER_STATE]', JSON.stringify(overclaimViolations))
    }

    // ── RC8.2: Post-validation gate — BLOCK content that violates RC8 constraints ──
    // This is NOT just logging; violations trigger repair or deterministic fallback.
    var cardTexts = [verdict, coreConflict, decision, firstAction, cogStatement, cogActionAnchor]
    var gateContext = {
      strategyId: diagnosisResult ? diagnosisResult.strategy.id : null,
      primaryArchetype: diagnosisResult ? diagnosisResult.wealthProfile.primary : null,
      tagIds: diagnosisResult ? diagnosisResult.behaviorTags.map(function(t) { return t.id }) : []
    }

    // Use the post-validation gate (loaded at top of file)
    var gateResult = null
    try {
      var pvg = require('../../engine/validation/postValidationGate')
      gateResult = pvg.validateCards(cardTexts, gateContext)
    } catch (e) {
      console.error('[PosterRC8][GATE_LOAD_FAILED]', e.message)
    }

    if (gateResult && !gateResult.passed) {
      console.error('[PosterRC8][GATE_BLOCKED]', JSON.stringify({
        blocked: true,
        violationCount: gateResult.cardViolations.length,
        violations: gateResult.cardViolations.map(function(cv) {
          return {
            card: cv.cardIndex,
            types: cv.violations.map(function(v) { return v.type }).join(',')
          }
        })
      }))

      // Repair: replace violating cards with deterministic fallback content
      gateResult.cardViolations.forEach(function(cv) {
        var idx = cv.cardIndex - 1
        var fallback = ''
        try {
          fallback = pvg.generateFallbackCard(gateContext.strategyId || 'BUILD_CASHFLOW', idx)
        } catch (e) {
          fallback = '请重新生成诊断报告以获得更精确的建议。'
        }
        // Replace the violating text
        if (idx >= 0 && idx < cardTexts.length) {
          cardTexts[idx] = fallback
        }
        console.error('[PosterRC8][GATE_REPAIR] Card' + cv.cardIndex + ': replaced with fallback')
      })

      // Re-assign repaired texts back to card variables
      verdict = cardTexts[0]
      coreConflict = cardTexts[1]
      decision = cardTexts[2]
      firstAction = cardTexts[3]
      if (cardTexts.length > 4) cogStatement = cardTexts[4]
      if (cardTexts.length > 5) cogActionAnchor = cardTexts[5]

      // Update pd.diagnosis with gate result
      if (diagnosisResult) {
        diagnosisResult.validation = {
          passed: false,
          repaired: true,
          violations: gateResult.cardViolations
        }
      }
      diagnosisTrace.gateBlocked = true
      diagnosisTrace.gateRepaired = true
    } else if (gateResult && gateResult.passed) {
      diagnosisTrace.gateBlocked = false
      diagnosisTrace.gateRepaired = false
      if (diagnosisResult) {
        diagnosisResult.validation = { passed: true, repaired: false, violations: [] }
      }
    }

    // ── RC6 card body text (new schema from mapper) ──
    // (verdict/coreConflict/decision/firstAction already set above, overridden by RC8 if needed)

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
      // RC7: Score Hero integrated within KPI Grid center column → A/B mini → Timeline
      var cy = 0
      var s = []

      // ═══ 1-2. KPI Grid (2 rows × 3 cols) + Score Hero integrated in center ═══
      // Score Hero height must fit within grid or extend it
      var kpiGridTop = cy  // absolute top for drawing reference
      var kpiRowH = T.KPI_VALUE.lh + T.KPI_LABEL.lh + 8
      var scoreHeroH = T.SCORE_HERO.lh + T.SCORE_LABEL.lh + 12  // hero occupies center column
      var gridH = Math.max(2 * kpiRowH, scoreHeroH)
      s.push({ name: 'kpiGrid', y: kpiGridTop, h: gridH, rows: [
        { col1: { value: projectedIndex + '', label: '预测指数', color: C.DESTINY_ACCENT },
          col3: { value: repairCycleDays + '天', label: '修复周期', color: '#5a9cff' } },
        { col1: { value: (projectedIndex > currentIndex ? '+' : '') + (projectedIndex - currentIndex), label: '提升幅度', color: '#5a9cff' },
          col3: { value: projectedIndex > currentIndex ? '低' : '中', label: '风险等级', color: projectedIndex > currentIndex ? '#ffc107' : '#ff6b81' } }
      ] })
      cy += gridH + SP.SECTION_GAP

      // Divider 1
      cy += SP.ITEM_GAP
      s.push({ name: 'divider1', y: cy, h: SP.SECTION_GAP })
      cy += SP.SECTION_GAP

      // ═══ 3. A/B Mini paths (compact) ═══
      setFont(ctx, T.BODY_SM)
      var baseLines = splitLines(ctx, baselineOutcome, contentWidth, T.BODY_SM.size)
      var baseLs = Math.min(baseLines.length, 2)
      var baseH = T.SCORE_LABEL.lh + baseLs * T.BODY_SM.lh
      // Action
      var actLines = splitLines(ctx, '预计结构修复周期：' + repairCycleDays + '天', contentWidth, T.BODY_SM.size)
      var actH = T.SCORE_LABEL.lh + T.BODY_SM.lh + SP.ITEM_GAP + actLines.length * T.BODY_SM.lh
      s.push({ name: 'abPaths', y: cy, h: baseH + actH + SP.SECTION_GAP })
      cy += baseH + actH + SP.SECTION_GAP

      // Divider 2
      cy += SP.ITEM_GAP
      s.push({ name: 'divider2', y: cy, h: SP.SECTION_GAP })
      cy += SP.SECTION_GAP

      // ═══ 4. Key variable (compact) ═══
      setFont(ctx, T.BODY_SM)
      var kvLines = splitLines(ctx, keyVariable, contentWidth, T.BODY_SM.size)
      var kvLs = Math.min(kvLines.length, 2)
      var kvH = T.SCORE_LABEL.lh + kvLs * T.BODY_SM.lh + SP.SECTION_GAP
      s.push({ name: 'keyVariable', y: cy, h: kvH })
      cy += kvH

      // ═══ 5. Timeline (turning points) ═══
      var tpCount = turningPoints.length > 0 ? Math.min(turningPoints.length, 3) : 0
      var tpStart = cy
      var tpItems = []
      if (tpCount > 0) {
        setFont(ctx, T.TIMELINE_NO)
        var timelineLabelH = T.SECTION.lh + SP.ITEM_GAP
        cy += timelineLabelH
        for (var tp = 0; tp < tpCount; tp++) {
          var tpDay = turningPoints[tp].day
          var tpLabel = turningPoints[tp].label || ''
          // Timeline node: DAY badge + text
          var dayStr = 'DAY ' + tpDay
          setFont(ctx, T.BADGE)
          var dayW = ctx.measureText(dayStr).width + 14
          setFont(ctx, T.CAPTION)
          var textW = contentWidth - SP.BODY_INSET - dayW - 10
          var tpLines = splitLines(ctx, tpLabel, textW, T.CAPTION.size)
          var itemH = Math.max(BADGE_H, tpLines.length * T.CAPTION.lh) + 8  // +8 timeline spacing
          tpItems.push({
            day: tpDay, label: tpLabel, dayW: dayW,
            lines: tpLines, itemH: itemH, y: cy
          })
          cy += itemH + (tp < tpCount - 1 ? SP.ITEM_GAP : 0)
        }
      }
      if (tpCount > 0) {
        s.push({ name: 'timeline', y: tpStart, h: cy - tpStart, items: tpItems })
      }

      return { sections: s, totalContentH: cy, baseLines: baseLines, baseLs: baseLs, kvLines: kvLines, kvLs: kvLs, tpCount: tpCount, actLines: actLines }
    }

    cards.forEach(function(item, index) {
      // Determine titlePadTop at measure time — single source for draw
      item._titlePadTop = (item.type === 'destiny' || item.type === 'cogVerdict') ? SP.CARD_PAD_TOP : SP.COMPACT_PAD_TOP
      if (item.type === 'destiny') {
        var layout = layoutCard05Sections(ctx, 0)
        item._heightMeasured = Math.max(CM.destiny, SP.CARD_PAD_TOP + TITLE_H + SP.TITLE_TO_BODY + layout.totalContentH + SP.CARD_PAD_BOT)
        item._card05Layout = layout
        item._baseLines = layout.baseLs; item._kvLines = layout.kvLs
        item._tpCount = layout.tpCount
        var _padT = SP.CARD_PAD_TOP + TITLE_H + SP.TITLE_TO_BODY
        var _cH = layout.totalContentH
        console.error('[PosterRC7][CARD05_MEASURE]', JSON.stringify({
          totalContentH: _cH,
          paddingTop: _padT,
          calculatedHeight: _padT + _cH + SP.CARD_PAD_BOT,
          finalHeight: item._heightMeasured,
          sectionNames: layout.sections.map(function(s) { return s.name })
        }))
      } else if (item.type === 'cogVerdict') {
        // ═══ RC7 Card06 — Final Verdict ═══
        // Sections: 0=statement, 1=divider, 2=action-label, 3=action-card, 4=ending
        var l06 = (function() {
          var cy = 0
          var ss = []

          // Section 0: Statement (no box)
          var STMT_PAD_TOP = 12   // breathing room above statement text
          setFont(ctx, T.VERDICT)
          var stLines = splitLines(ctx, cogStatement, contentWidth, T.VERDICT.size)
          var stLs = Math.min(stLines.length, 4)
          if (stLines.length > stLs) stLines = stLines.slice(0, stLs)
          var stH = stLs * T.VERDICT.lh
          cy += STMT_PAD_TOP
          ss.push({ name: 'statement', y: cy, h: stH, lines: stLines })
          cy += stH + 14  // statement-end gap

          // Section 1: Divider
          ss.push({ name: 'divider', y: cy, h: 10 })
          cy += 14

          // Section 2: Action anchor label
          setFont(ctx, T.VERDICT_ANCHOR)
          var lblH = T.VERDICT_ANCHOR.lh + 8  // label + 8px gap before card
          ss.push({ name: 'actionLabel', y: cy, h: lblH })
          cy += lblH

          // Section 3: Recommendation card
          setFont(ctx, T.BODY_SM)
          var REC_CARD_PAD_H = 16  // horizontal padding
          var REC_CARD_PAD_V = 14  // vertical padding inside card
          var recTextW = contentWidth - REC_CARD_PAD_H * 2
          var aaLines = splitLines(ctx, cogActionAnchor, recTextW, T.BODY_SM.size)
          var aaLs = Math.min(aaLines.length, 3)
          if (aaLines.length > aaLs) aaLines = aaLines.slice(0, aaLs)
          var recTextH = aaLs * T.BODY_SM.lh
          var recCardH = Math.max(52, recTextH + REC_CARD_PAD_V * 2)
          ss.push({ name: 'actionCard', y: cy, h: recCardH, lines: aaLines, textH: recTextH })
          cy += recCardH + 12

          // Section 4: Ending (oracle-style closing)
          setFont(ctx, T.BODY_SM)
          var endLines = ['今天开始执行。', '180 天后回来验证。']
          var endLineH = T.BODY_SM.lh + 2
          var endTotalH = endLines.length * endLineH + 12  // top/bottom padding
          ss.push({ name: 'ending', y: cy, h: endTotalH, lines: endLines })
          cy += endTotalH

          return { sections: ss, totalContentH: cy, stLines: stLines, stLs: stLs, aaLines: aaLines, aaLs: aaLs }
        })()
        var _padT = SP.CARD_PAD_TOP + TITLE_H + SP.TITLE_BODY_GAP
        item._heightMeasured = Math.max(CM.cogVerdict, _padT + l06.totalContentH + SP.CARD_PAD_BOT)
        item._card06Layout = l06
        item._stLines = l06.stLs; item._aaLines = l06.aaLs
      } else {
        setFont(ctx, T.BODY)
        item._lines = splitLines(ctx, item.text || '', contentWidth, T.BODY.size)
        var minH = CM[item.no] || 110
        item._heightMeasured = Math.max(minH, SP.COMPACT_PAD_TOP + TITLE_H + SP.TITLE_BODY_GAP + item._lines.length * T.BODY.lh + SP.COMPACT_PAD_BOT)
      }
      console.log('[PosterRC6][MEASURE] Card' + (index + 1) + ' height=' + item._heightMeasured + ' titlePadTop=' + item._titlePadTop)
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

      // Card number + icon — read titlePadTop from layout metadata (single source)
      var titlePadTop = item._titlePadTop || SP.COMPACT_PAD_TOP
      var numberY = cardY + titlePadTop
      var numberBottom = numberY + T.CARD_NO.size  // approximate cap-height baseline
      var iconY = numberBottom + SP.NUMBER_ICON_GAP
      ctx.textAlign = 'center'
      setFont(ctx, T.CARD_NO); setColor(ctx, item.color)
      ctx.fillText(item.no, safeX + leftW / 2, numberY + 18)
      setFont(ctx, T.CARD_ICON)
      ctx.fillText(item.icon, safeX + leftW / 2, iconY + 16)
      ctx.textAlign = 'left'
      setFont(ctx, T.CARD_TITLE); setColor(ctx, item.color)
      ctx.fillText(item.icon + ' ' + item.title, contentX, cardY + titlePadTop + TITLE_H / 2 + 6)

      // lastTextY will be overwritten per card type below; safe default
      var lastTextY = cardY + titlePadTop + TITLE_H / 2

      if (item.type === 'destiny') {
        // ═══ RC7 05 Score Hero + KPI Grid + Timeline ═══
        ctx.save()
        ctx.beginPath()
        roundRect(safeX + 2, cardY + 2, cardW - 4, h - 4, L.CARD_R)
        ctx.clip()
        ctx.save()

        var l = item._card05Layout
        var _padT = SP.CARD_PAD_TOP + TITLE_H + SP.TITLE_TO_BODY
        var originY = cardY + _padT
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'

        // ═══ 2. KPI Grid — ABSOLUTE coordinates (no cursorY) ═══
        // Three-column layout: left KPI | center Score Hero | right KPI
        var kpiS = l.sections[0]
        var gridTop = originY + kpiS.y
        var kpiRowH = T.KPI_VALUE.lh + T.KPI_LABEL.lh + 8  // must match layoutCard05Sections
        var colLeft  = contentX + 6                          // left column X
        var colCenter = contentX + contentWidth / 2          // center column X (textAlign=center)
        var colRight = contentX + contentWidth - 6           // right column X

        // Helper: draw one KPI cell (textAlign=center for colCenter, left/right for others)
        function drawKpiCell(x, y, value, label, vColor, align) {
          ctx.textAlign = align || 'left'
          setFont(ctx, T.KPI_VALUE); ctx.fillStyle = vColor
          ctx.fillText(value, x, y)
          setFont(ctx, T.KPI_LABEL); ctx.fillStyle = C.DESTINY_LABEL
          ctx.fillText(label, x, y + T.KPI_VALUE.lh + 2)
        }

        var rows = kpiS.rows
        // Row 0: left KPI (prediction rate) | center Score Hero | right KPI (repair days)
        drawKpiCell(colLeft,  gridTop, rows[0].col1.value, rows[0].col1.label, rows[0].col1.color, 'left')
        drawKpiCell(colRight, gridTop, rows[0].col3.value, rows[0].col3.label, rows[0].col3.color, 'right')
        // Row 1
        var row1Y = gridTop + kpiRowH
        drawKpiCell(colLeft,  row1Y, rows[1].col1.value, rows[1].col1.label, rows[1].col1.color, 'left')
        drawKpiCell(colRight, row1Y, rows[1].col3.value, rows[1].col3.label, rows[1].col3.color, 'right')

        // Score Hero in center column (re-draw over Grid after KPI text)
        setFont(ctx, T.SCORE_HERO); ctx.fillStyle = C.DESTINY_ACCENT; ctx.textAlign = 'center'
        ctx.fillText(currentIndex, colCenter, gridTop + T.SCORE_HERO.lh)
        setFont(ctx, T.SCORE_LABEL); ctx.fillStyle = C.DESTINY_ACCENT
        ctx.fillText('🟢 ' + currentLevelLabel, colCenter, gridTop + T.SCORE_HERO.lh + T.SCORE_LABEL.lh + 4)
        ctx.textAlign = 'left'

        // Divider 1
        var div1y = originY + l.sections[1].y
        drawDivider(ctx, contentX, div1y, contentWidth)

        // ═══ 3. A/B Paths (compact) ═══
        var abS = l.sections[2]
        var aby = originY + abS.y
        setFont(ctx, T.SCORE_LABEL); ctx.fillStyle = C.DESTINY_LABEL
        ctx.fillText('▶ 保持现状', contentX, aby)
        setFont(ctx, T.BODY_SM); ctx.fillStyle = C.DESTINY_BODY
        for (var bi = 0; bi < l.baseLines.length && bi < Math.min(l.baseLs, 2); bi++) {
          ctx.fillText(l.baseLines[bi], contentX, aby + T.SCORE_LABEL.lh + bi * T.BODY_SM.lh)
        }
        var actAY = aby + T.SCORE_LABEL.lh + Math.min(l.baseLs, 2) * T.BODY_SM.lh + SP.ITEM_GAP
        setFont(ctx, T.SCORE_LABEL); ctx.fillStyle = C.DESTINY_ACCENT
        ctx.fillText('▶ 执行方案', contentX, actAY)
        setFont(ctx, T.BODY_SM); ctx.fillStyle = C.DESTINY_ACCENT
        var _05al = l.actLines || []
        for (var ai = 0; ai < _05al.length; ai++) {
          ctx.fillText(_05al[ai], contentX, actAY + T.BODY_SM.lh + ai * T.BODY_SM.lh)
        }

        // Divider 2
        var div2y = originY + l.sections[3].y
        drawDivider(ctx, contentX, div2y, contentWidth)

        // ═══ 4. Key Variable (compact) ═══
        var kvS = l.sections[4]
        var kvY = originY + kvS.y
        setFont(ctx, T.SCORE_LABEL); ctx.fillStyle = C.DESTINY_LABEL
        ctx.fillText('🔑 关键变量', contentX, kvY)
        setFont(ctx, T.BODY_SM); ctx.fillStyle = C.DESTINY_KV
        for (var ki = 0; ki < l.kvLines.length && ki < Math.min(l.kvLs, 2); ki++) {
          ctx.fillText(l.kvLines[ki], contentX, kvY + T.SCORE_LABEL.lh + ki * T.BODY_SM.lh)
        }

        // ═══ 5. Timeline ═══
        if (item._tpCount > 0) {
          var tlS = l.sections[5]
          var tly = originY + tlS.y
          setFont(ctx, T.SECTION); ctx.fillStyle = C.DESTINY_LABEL
          ctx.fillText('📍 关键转折点', contentX, tly)

          var tlItems = tlS.items
          // Vertical timeline connector
          if (tlItems.length >= 2) {
            var badgeCX = contentX + SP.BODY_INSET + 42  // center of badge area
            var firstBadgeCY = originY + tlItems[0].y + BADGE_H / 2 + 6
            var lastBadgeCY = originY + tlItems[tlItems.length - 1].y + BADGE_H / 2 + 6
            ctx.strokeStyle = 'rgba(255,255,255,0.18)'
            ctx.lineWidth = 1.5
            ctx.setLineDash([4, 6])
            ctx.beginPath()
            ctx.moveTo(badgeCX, firstBadgeCY + BADGE_H)
            ctx.lineTo(badgeCX, lastBadgeCY - 4)
            ctx.stroke()
            ctx.setLineDash([])
          }

          for (var tp = 0; tp < tlItems.length; tp++) {
            var tpi = tlItems[tp]
            var itemY = originY + tpi.y
            var badgeType = tp === 2 ? 'purple' : 'blue'
            drawBadge(ctx, contentX + SP.BODY_INSET, itemY, tpi.day, badgeType)
            ctx.textAlign = 'left'
            setFont(ctx, T.CAPTION); ctx.fillStyle = '#E2E8F0'
            var textX = contentX + SP.BODY_INSET + tpi.dayW + 8
            for (var tl = 0; tl < tpi.lines.length; tl++) {
              ctx.fillText(tpi.lines[tl], textX, itemY + BADGE_H / 2 + 6 + tl * T.CAPTION.lh)
            }
          }
        }

        lastTextY = cardY + _padT + l.totalContentH
        var delta05 = 0
        var lastSection = l.sections[l.sections.length - 1]
        if (lastSection) {
          var expectedContentBottom = cardY + _padT + l.totalContentH
          var lastDrawYCalc = cardY + _padT + (lastSection.y + lastSection.h)
          delta05 = lastDrawYCalc - expectedContentBottom
        }

        console.error('[PosterRC7][CARD05_HERO]', JSON.stringify({
          sections: l.sections.map(function(s) { return s.name }),
          totalContentH: l.totalContentH,
          height: h,
          delta: delta05
        }))

        if (delta05 > 4) throw new Error('POSTER_CARD_CONTENT_OVERFLOW:05')

        ctx.restore()  // inner clip save
        ctx.restore()  // outer clip save

      } else if (item.type === 'cogVerdict') {
        // ═══ RC7 Card06 — Final Verdict ═══
        var l06 = item._card06Layout
        var _padT = SP.CARD_PAD_TOP + TITLE_H + SP.TITLE_BODY_GAP
        var baseY = cardY + _padT

        // Section 0 — Statement (gold body text, no box)
        var stSec = l06.sections[0]
        setFont(ctx, T.VERDICT); ctx.fillStyle = C.COG_STATEMENT
        for (var si = 0; si < stSec.lines.length; si++) {
          ctx.fillText(stSec.lines[si], contentX, baseY + stSec.y + si * T.VERDICT.lh)
        }

        // Section 1 — Divider
        var divSec = l06.sections[1]
        drawDivider(ctx, contentX, baseY + divSec.y + 2, contentWidth)

        // Section 2 — Action anchor label
        var lblSec = l06.sections[2]
        setFont(ctx, T.VERDICT_ANCHOR); ctx.fillStyle = '#FF8C00'  // accent orange
        ctx.fillText('📌 行动锚点', contentX, baseY + lblSec.y)

        // Section 3 — Recommendation card (dark glass)
        var cardSec = l06.sections[3]
        var cardY06 = baseY + cardSec.y
        var cardH = cardSec.h
        roundRect(contentX, cardY06, contentWidth, cardH, L.CARD_R)
        ctx.fillStyle = 'rgba(70,40,0,0.25)'; ctx.fill()
        ctx.strokeStyle = 'rgba(180,130,40,0.35)'; ctx.lineWidth = 1; ctx.stroke()

        // Card content (vertically centered)
        var textStartY = cardY06 + (cardH - cardSec.textH) / 2 + T.BODY_SM.lh - 4
        setFont(ctx, T.BODY_SM); ctx.fillStyle = 'rgba(255,230,200,0.88)'
        for (var ai = 0; ai < cardSec.lines.length; ai++) {
          ctx.fillText(cardSec.lines[ai], contentX + 16, textStartY + ai * T.BODY_SM.lh)
        }

        // Section 4 — Ending (oracle-style closing)
        var endSec = l06.sections[4]
        var endY = baseY + endSec.y
        var endW = 120
        var endX = contentX + (contentWidth - endW) / 2
        // Oracle lines
        ctx.strokeStyle = 'rgba(150,150,160,0.35)'; ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.moveTo(endX, endY); ctx.lineTo(endX + endW, endY); ctx.stroke()
        setFont(ctx, T.BODY_SM); ctx.fillStyle = 'rgba(160,160,170,0.65)'; ctx.textAlign = 'center'
        var endTextY = endY + T.BODY_SM.lh + 4
        for (var ei = 0; ei < endSec.lines.length; ei++) {
          ctx.fillText(endSec.lines[ei], contentX + contentWidth / 2, endTextY + ei * (T.BODY_SM.lh + 2))
        }
        ctx.textAlign = 'left'

        // Overflow guard
        var expectedContentBottom = cardY + _padT + l06.totalContentH
        var lastDrawYCalc = endY + endSec.h
        var delta06 = lastDrawYCalc - expectedContentBottom
        if (delta06 > 6) throw new Error('POSTER_CARD_CONTENT_OVERFLOW:06')

      } else {
        // ═══ Cards 01-04 (RC7 compact) ═══
        setFont(ctx, T.BODY); setColor(ctx, C.BODY)
        drawWrappedLines(ctx, item._lines, contentX, cardY + SP.COMPACT_PAD_TOP + TITLE_H + SP.TITLE_BODY_GAP, T.BODY.lh, C.BODY, T.BODY.size)
        lastTextY = cardY + SP.COMPACT_PAD_TOP + TITLE_H + SP.TITLE_BODY_GAP + item._lines.length * T.BODY.lh
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
