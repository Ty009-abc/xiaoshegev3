/**
 * pages/turnaround-v6-questionnaire/turnaround-v6-questionnaire.js
 *
 * RC8.4 V6 — PRODUCTION 9-question turnaround strategy questionnaire.
 *
 * Single source of truth: `utils/v6/turnaroundQuestionnaireV6.js`
 * (mirror of the frozen backend contract questionnaireContractV6.js).
 *
 * Behaviour:
 *   - exactly 9 questions (Q1..Q9), single choice
 *   - progress derived from questions.length (never a hard-coded 18)
 *   - previous supported, next blocked until a selection exists
 *   - final question CTA = 生成我的翻身策略
 *   - double-submit guarded; loading state after submit; safe retry on failure
 *
 * Client is INPUT ONLY: it does NOT diagnose, score, or rewrite. It submits the
 * exact V6 payload (diagnosticVersion = turnaround_strategy_v6) to
 * generateAiReport and renders the returned five-card report page.
 *
 * @version turnaround_strategy_v6 (production client)
 */

'use strict'

const {
  getQuestionsV6,
  QUESTION_COUNT_V6,
  validateAnswersV6,
  buildCloudRequestV6,
} = require('../../utils/v6/turnaroundQuestionnaireV6.js')

const app = getApp()

const REPORT_ROUTE = '/pages/turnaround-v6-report/turnaround-v6-report'

Page({
  data: {
    started: false,
    questions: [],          // frozen question list (UI derives everything from .length)
    totalCount: 0,          // = questions.length
    currentIndex: 0,        // 0-based
    answers: {},            // qid -> optionId
    occupation: '',         // optional free text (Q2 step only)
    selectedOptionId: '',   // highlight for current question
    progressPercent: 0,
    submitting: false,
    submitted: false,
    error: '',
    totalNavHeight: 0,      // custom-nav safe area (runtime measured)
  },

  onLoad() {
    this._initNavBar()
    this._questions = getQuestionsV6()
    this.setData({
      questions: this._questions,
      totalCount: QUESTION_COUNT_V6, // == this._questions.length
    })
  },

  // ── custom nav safe area (layout only) ──────────────────────────────────
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

  startSession() {
    this.setData({
      started: true,
      currentIndex: 0,
      answers: {},
      occupation: '',
      selectedOptionId: '',
      progressPercent: this._pct(1),
      submitting: false,
      submitted: false,
      error: '',
    })
  },

  restartSession() {
    // Guided retake: return to the first question, keep nothing from before.
    this.startSession()
  },

  _pct(positionOneBased) {
    const total = this._questions ? this._questions.length : QUESTION_COUNT_V6
    return Math.round((positionOneBased / total) * 100)
  },

  // ── answer / navigation ─────────────────────────────────────────────────
  selectOption(e) {
    if (this.data.submitting || this.data.submitted) return
    const optionId = e.currentTarget.dataset.optionId
    if (optionId === undefined || optionId === null || optionId === '') return
    const q = this.data.questions[this.data.currentIndex]
    if (!q) return
    if (!q.options.some((o) => o.optionId === optionId)) return

    const answers = Object.assign({}, this.data.answers)
    answers[q.qid] = optionId
    this.setData({ answers: answers, selectedOptionId: optionId, error: '' })
  },

  onOccupationInput(e) {
    this.setData({ occupation: (e && e.detail && e.detail.value) || '' })
  },

  goNext() {
    if (this.data.submitting || this.data.submitted) return
    const q = this.data.questions[this.data.currentIndex]
    if (!q) return
    if (!this.data.answers[q.qid]) {
      wx.showToast({ title: '请先选择一项', icon: 'none' })
      return
    }
    if (this.data.currentIndex >= this.data.questions.length - 1) return
    const next = this.data.currentIndex + 1
    const nq = this.data.questions[next]
    this.setData({
      currentIndex: next,
      selectedOptionId: this.data.answers[nq.qid] || '',
      progressPercent: this._pct(next + 1),
    })
  },

  goBack() {
    if (this.data.submitting || this.data.submitted) return
    if (this.data.currentIndex <= 0) return
    const prev = this.data.currentIndex - 1
    const pq = this.data.questions[prev]
    this.setData({
      currentIndex: prev,
      selectedOptionId: this.data.answers[pq.qid] || '',
      progressPercent: this._pct(prev + 1),
    })
  },

  // ── submit ──────────────────────────────────────────────────────────────
  async submit() {
    if (this.data.submitting || this.data.submitted) return
    const q = this.data.questions[this.data.currentIndex]
    if (!q) return
    if (!this.data.answers[q.qid]) {
      wx.showToast({ title: '请先选择一项', icon: 'none' })
      return
    }

    // Assemble payload answers (Q1..Q9 + optional occupation).
    const payload = Object.assign({}, this.data.answers)
    if (this.data.occupation && this.data.occupation.trim()) payload.occupation = this.data.occupation.trim()

    const { valid, errors } = validateAnswersV6(payload)
    if (!valid) {
      this.setData({ error: '还有题目没有完成，请检查后再提交。' })
      console.error('[TurnaroundV6] answer validation failed:', errors)
      return
    }

    this.setData({ submitting: true, submitted: true, error: '' })

    const req = buildCloudRequestV6(payload)
    try {
      const res = await wx.cloud.callFunction(req)
      const result = res && res.result ? res.result : null
      // Hand the raw envelope to the report page via globalData (no storage,
      // no persistence of answers). Report page owns interpretation.
      app.globalData.turnaroundV6Result = result
      app.globalData.turnaroundV6SubmittedAt = Date.now()
      wx.redirectTo({ url: REPORT_ROUTE })
    } catch (err) {
      // Safe retry: reset to an editable state with a human-readable message.
      this.setData({
        submitting: false,
        submitted: false,
        error: '提交失败，请检查网络后重试。',
      })
      console.error('[TurnaroundV6] submit failed:', (err && err.message) || err)
    }
  },
})
