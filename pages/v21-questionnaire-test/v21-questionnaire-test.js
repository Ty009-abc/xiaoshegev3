/**
 * pages/v21-questionnaire-test/v21-questionnaire-test.js
 *
 * RC8.3 Stage20 R6-R4 — V2.1 内部真人测试问卷（18 题）。
 *
 * SHADOW ONLY 测试工具，不是正式诊断入口：
 *   - 渲染 canonical 18 题，选项展示顺序随机（R3C），捕获 displayPosition
 *   - 提交精确 { questionId, optionId, displayPosition } 裸 18 元组
 *   - diagnosticVersion = world_model_v2_1
 *   - 真实微信登录态认证（不伪造 openid，不绕 getWXContext()）
 *   - 不写数据库，不碰 normal 报告状态/缓存/历史，不导航到正式报告渲染
 *   - 云响应仅作「操作反馈」，不渲染 primary 诊断/盲点/财富概率/置信度
 *
 * @version world_model_v2_1 (internal real-user test)
 */

const {
  QUESTION_COUNT_V21,
  buildSessionQuestions,
  validateAnswers,
  buildCloudRequest,
} = require('../../utils/v21Questionnaire.js')

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
    resultCode: null,
    resultMessage: '',
    resultReportType: null,
    resultValidityStatus: null,
    resultError: '',
  },

  onLoad() {
    // 纯内部测试页：不依赖 openid 做客户端白名单门（R6-R3 无客户端 dedupe 要求）。
    // 服务端 getWXContext() 才是认证门；未登录/非白名单时由云函数 fail(AUTH_FAILED) 处理。
    this._sessionAnswers = {}
    this._submitted = false
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
      resultCode: null,
      resultMessage: '',
      resultReportType: null,
      resultValidityStatus: null,
      resultError: '',
    })
  },

  restartSession() {
    // 显式重启：全新会话（重新随机、清空答案）。
    this.startSession()
  },

  // ── 作答 ────────────────────────────────────────────────────────────────
  selectOption(e) {
    if (this.data.submitting || this.data.submitted) return
    const { optionId, displayPosition } = e.currentTarget.dataset
    if (optionId === undefined || optionId === null || optionId === '') return
    const q = this.data.sessionQuestions[this.data.currentIndex]
    if (!q) return
    // 防御：所选 optionId 必须存在于当前题渲染选项中。
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
      console.error('[V21Test] answer validation failed:', errors)
      this.setData({ resultError: '校验失败: ' + (errors[0] || 'unknown') })
      return
    }

    // 客户端 pending 锁：请求期间禁止二次提交。
    this.setData({ submitting: true, resultError: '' })

    const req = buildCloudRequest(answerArray)
    wx.cloud.callFunction(req).then((res) => {
      const result = res && res.result ? res.result : null
      const code = result && typeof result.code === 'number' ? result.code : null
      const data = result && result.data ? result.data : null
      const shadowRecord = data && data.shadowRecord ? data.shadowRecord : null
      // 仅展示契约安全字段；不渲染 primary 诊断/盲点/财富/置信度。
      const validityStatus = shadowRecord && shadowRecord.responseValidityStatus ? shadowRecord.responseValidityStatus : null

      this._submitted = true
      this.setData({
        submitting: false,
        submitted: true,
        resultCode: code,
        resultMessage: (result && result.message) || '',
        resultReportType: data ? (data.reportType || null) : null,
        resultValidityStatus: validityStatus,
        resultError: '',
      })
    }).catch((err) => {
      this.setData({
        submitting: false,
        resultCode: null,
        resultMessage: '',
        resultReportType: null,
        resultValidityStatus: null,
        resultError: (err && err.message) || '提交失败',
      })
    })
  },
})
