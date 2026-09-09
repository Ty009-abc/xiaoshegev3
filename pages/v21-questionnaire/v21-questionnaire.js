/**
 * pages/v21-questionnaire/v21-questionnaire.js
 *
 * RC8.3 Stage1B R3 — V2.1 正式 18 题认知问卷（生产入口）。
 *
 * 与 shadow-only 测试页 `pages/v21-questionnaire-test` 严格区分：
 *   - 本页是正式诊断入口，以 `utils/v21Questionnaire.js` 为单一事实来源；
 *   - 渲染顺序会话内随机冻结（R3C，displayPosition = 渲染索引）；
 *   - 提交精确 { questionId, optionId, displayPosition } 裸 18 元组；
 *   - diagnosticVersion = 'world_model_v2_1'，并显式携带 previewMode = 'TEST_PREVIEW'
 *     以触发服务端 TEST_PREVIEW_ONLY 认知报告路由；
 *   - 成功后跳转 `pages/v21-cognitive-report` 渲染认知报告（非财富诊断）。
 *
 * 安全边界：不暴露服务端推理元数据，不渲染财富/概率/置信度/严重度。
 *
 * @version world_model_v2_1 (production entry)
 */

const {
  QUESTION_COUNT_V21,
  buildSessionQuestions,
  validateAnswers,
  buildCloudRequest,
} = require('../../utils/v21Questionnaire.js')

const app = getApp()

Page({
  data: {
    started: false,
    sessionQuestions: [],   // 冻结的渲染顺序（含 displayPosition）
    currentIndex: 0,        // 0-based
    answers: {},            // questionId -> { questionId, optionId, displayPosition }
    selectedOptionId: '',   // 当前题已选 optionId（用于高亮）
    progressPercent: 0,
    submitting: false,
    submitted: false,
    error: '',
    totalNavHeight: 0,      // 自定义导航下的状态栏+胶囊区安全高度（px，运行时测量）
  },

  onLoad() {
    this._sessionAnswers = {}
    this._submitted = false
    this._initNavBar()
  },

  // ── 自定义导航安全区（仅布局，不改任何答题逻辑）────────────────────────
  _initNavBar() {
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

  onUnload() {
    this._sessionAnswers = {}
  },

  // ── 会话控制 ────────────────────────────────────────────────────────────
  startSession() {
    // 初始化即随机并冻结整个会话的渲染顺序；后续 next/back/setData 不再重排。
    const sessionQuestions = buildSessionQuestions()
    this._sessionAnswers = {}
    this._submitted = false
    this.setData({
      started: true,
      sessionQuestions,
      currentIndex: 0,
      answers: {},
      selectedOptionId: '',
      progressPercent: Math.round((1 / QUESTION_COUNT_V21) * 100),
      submitting: false,
      submitted: false,
      error: '',
    })
  },

  restartSession() {
    this.startSession()
  },

  // ── 作答 ────────────────────────────────────────────────────────────────
  selectOption(e) {
    if (this.data.submitting || this.data.submitted) return
    const { optionId, displayPosition } = e.currentTarget.dataset
    if (optionId === undefined || optionId === null || optionId === '') return
    const q = this.data.sessionQuestions[this.data.currentIndex]
    if (!q) return
    const opt = q.options.find((o) => o.optionId === optionId)
    if (!opt) return

    const answers = Object.assign({}, this.data.answers)
    answers[q.questionId] = {
      questionId: q.questionId,
      optionId,
      displayPosition: Number(displayPosition),
    }
    this.setData({ answers, selectedOptionId: optionId })
  },

  goNext() {
    if (this.data.submitting || this.data.submitted) return
    const q = this.data.sessionQuestions[this.data.currentIndex]
    if (!q) return
    if (!this.data.answers[q.questionId]) {
      wx.showToast({ title: '请先选择一项', icon: 'none' })
      return
    }
    if (this.data.currentIndex >= QUESTION_COUNT_V21 - 1) return
    const next = this.data.currentIndex + 1
    this.setData({
      currentIndex: next,
      selectedOptionId: (this.data.answers[this.data.sessionQuestions[next].questionId] || {}).optionId || '',
      progressPercent: Math.round(((next + 1) / QUESTION_COUNT_V21) * 100),
    })
  },

  goBack() {
    if (this.data.submitting || this.data.submitted) return
    if (this.data.currentIndex <= 0) return
    const prev = this.data.currentIndex - 1
    this.setData({
      currentIndex: prev,
      selectedOptionId: (this.data.answers[this.data.sessionQuestions[prev].questionId] || {}).optionId || '',
      progressPercent: Math.round(((prev + 1) / QUESTION_COUNT_V21) * 100),
    })
  },

  // ── 提交 ────────────────────────────────────────────────────────────────
  submit() {
    if (this.data.submitting || this.data.submitted) return
    if (!this.data.started) return

    // 组装裸 18 元组数组（按 sessionQuestions 顺序）。
    const answerArray = this.data.sessionQuestions.map((q) => {
      const a = this.data.answers[q.questionId]
      return a ? { questionId: a.questionId, optionId: a.optionId, displayPosition: a.displayPosition } : null
    })

    // 客户端提交前校验（任一失败 BLOCK 提交）。
    const { valid, errors } = validateAnswers(this.data.sessionQuestions, answerArray.filter(Boolean))
    if (!valid) {
      wx.showToast({ title: '答案校验未通过', icon: 'none' })
      console.error('[V21Questionnaire] answer validation failed:', errors)
      this.setData({ error: '校验失败: ' + (errors[0] || 'unknown') })
      return
    }

    this.setData({ submitting: true, error: '' })

    // buildCloudRequest 产出 { name, data: { type, diagnosticVersion, answers } }；
    // 追加 previewMode 触发服务端 TEST_PREVIEW_ONLY 认知报告路由。
    const req = buildCloudRequest(answerArray)
    req.data.previewMode = 'TEST_PREVIEW'

    wx.cloud.callFunction(req).then((res) => {
      const result = res && res.result ? res.result : null
      const data = result && result.data ? result.data : null
      const report = data && data.report ? data.report : null

      this._submitted = true
      this.setData({ submitting: false, submitted: true })

      if (report) {
        // 通过 globalData 传给认知报告渲染页（不写 storage，不污染 normal 报告缓存）。
        app.globalData.v21CognitiveReport = report
        wx.navigateTo({ url: '/pages/v21-cognitive-report/v21-cognitive-report' })
      } else {
        // R4.2: 业务错误优先。服务端失败时业务 message 位于 result.data.message
        //（信封 result.message 恒为 'success'，不可作为错误文案）。
        const inputErrors = data && Array.isArray(data.inputErrors) ? data.inputErrors : []
        const businessMsg =
          (data && typeof data.message === 'string' && data.message) ||
          (inputErrors.length > 0 ? ('回答校验未通过: ' + inputErrors.join('、')) : '') ||
          (result && typeof result.message === 'string' && result.message !== 'success' ? result.message : '') ||
          '未返回认知报告'
        this.setData({ error: businessMsg })
      }
    }).catch((err) => {
      this.setData({
        submitting: false,
        error: (err && err.message) || '提交失败',
      })
    })
  },
})
