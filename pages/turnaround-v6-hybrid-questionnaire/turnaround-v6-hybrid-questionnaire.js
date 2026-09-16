/**
 * pages/turnaround-v6-hybrid-questionnaire/turnaround-v6-hybrid-questionnaire.js
 *
 * RC8.4 V6 R44 — PRODUCTION HYBRID 10-SCREEN turnaround questionnaire.
 *
 * Single source of truth: `utils/v6/turnaroundQuestionnaireHybridV10.js`.
 *
 * Behaviour:
 *   - exactly 10 visible screens, each with a main selector + optional secondary
 *   - progress derived from screens.length (never a hard-coded 9/18)
 *   - previous supported; next blocked until REQUIRED fields are selected
 *   - optional occupation free text does NOT block
 *   - double-submit guarded; loading state after submit; safe retry on failure
 *
 * Client is INPUT ONLY: it does NOT diagnose, score, or rewrite. It submits the
 * explicit hybrid contract payload (diagnosticVersion =
 * turnaround_strategy_v6_hybrid_10q) and renders the returned five-card report.
 */

'use strict'

const {
  getScreensHybridV10,
  HYBRID_SCREEN_COUNT,
  isScreenComplete,
  validateAnswersHybridV10,
  buildCloudRequestHybridV10,
} = require('../../utils/v6/turnaroundQuestionnaireHybridV10.js')

const app = getApp()

const REPORT_ROUTE = '/pages/turnaround-v6-report/turnaround-v6-report'

Page({
  data: {
    started: false,
    screens: [],
    totalCount: 0,
    currentIndex: 0,
    answers: {},
    occupation: '',
    selectedMainId: '',
    selectedSecondaryId: '',
    progressPercent: 0,
    submitting: false,
    submitted: false,
    error: '',
    totalNavHeight: 0,
  },

  onLoad() {
    this._initNavBar()
    this._screens = getScreensHybridV10()
    this.setData({
      screens: this._screens,
      totalCount: this._screens.length,
    })
  },

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
      selectedMainId: '',
      selectedSecondaryId: '',
      progressPercent: this._pct(1),
      submitting: false,
      submitted: false,
      error: '',
    })
  },

  restartSession() { this.startSession() },

  _pct(positionOneBased) {
    const total = this._screens ? this._screens.length : HYBRID_SCREEN_COUNT
    return Math.round((positionOneBased / total) * 100)
  },

  _syncSelection(index) {
    const s = this._screens[index]
    const a = this.data.answers
    this.setData({
      selectedMainId: (s && a[s.key]) || '',
      selectedSecondaryId: (s && s.secondary && a[s.secondary.key]) || '',
    })
  },

  selectMain(e) {
    if (this.data.submitting || this.data.submitted) return
    const optionId = e.currentTarget.dataset.optionId
    const s = this.data.screens[this.data.currentIndex]
    if (!s) return
    if (!s.options.some((o) => o.optionId === optionId)) return
    const answers = Object.assign({}, this.data.answers)
    answers[s.key] = optionId
    this.setData({ answers: answers, selectedMainId: optionId, error: '' })
  },

  selectSecondary(e) {
    if (this.data.submitting || this.data.submitted) return
    const optionId = e.currentTarget.dataset.optionId
    const s = this.data.screens[this.data.currentIndex]
    if (!s || !s.secondary) return
    if (!s.secondary.options.some((o) => o.optionId === optionId)) return
    const answers = Object.assign({}, this.data.answers)
    answers[s.secondary.key] = optionId
    this.setData({ answers: answers, selectedSecondaryId: optionId, error: '' })
  },

  onOccupationInput(e) {
    this.setData({ occupation: (e && e.detail && e.detail.value) || '' })
  },

  goNext() {
    if (this.data.submitting || this.data.submitted) return
    const s = this.data.screens[this.data.currentIndex]
    if (!s) return
    if (!this._screenCompleteClient(s)) {
      wx.showToast({ title: '还有选项没选完', icon: 'none' })
      return
    }
    if (this.data.currentIndex >= this.data.screens.length - 1) return
    const next = this.data.currentIndex + 1
    this.setData({ currentIndex: next, progressPercent: this._pct(next + 1) })
    this._syncSelection(next)
  },

  goBack() {
    if (this.data.submitting || this.data.submitted) return
    if (this.data.currentIndex <= 0) return
    const prev = this.data.currentIndex - 1
    this.setData({ currentIndex: prev, progressPercent: this._pct(prev + 1) })
    this._syncSelection(prev)
  },

  _screenCompleteClient(s) {
    const a = this.data.answers
    if (!a[s.key]) return false
    if (s.secondary && s.secondary.required !== false && !a[s.secondary.key]) return false
    return true
  },

  async submit() {
    if (this.data.submitting || this.data.submitted) return
    const s = this.data.screens[this.data.currentIndex]
    if (!s) return
    if (!this._screenCompleteClient(s)) {
      wx.showToast({ title: '还有选项没选完', icon: 'none' })
      return
    }

    const payload = Object.assign({}, this.data.answers)
    if (this.data.occupation && this.data.occupation.trim()) payload.occupationDetail = this.data.occupation.trim()

    const { valid, errors } = validateAnswersHybridV10(payload)
    if (!valid) {
      this.setData({ error: '还有题目没有完成，请检查后再提交。' })
      console.error('[TurnaroundV6Hybrid] answer validation failed:', errors)
      return
    }

    this.setData({ submitting: true, submitted: true, error: '' })

    const req = buildCloudRequestHybridV10(payload)
    try {
      const res = await wx.cloud.callFunction(req)
      const result = res && res.result ? res.result : null
      app.globalData.turnaroundV6Result = result
      app.globalData.turnaroundV6SubmittedAt = Date.now()
      app.globalData.turnaroundV6SourceRoute = '/pages/turnaround-v6-hybrid-questionnaire/turnaround-v6-hybrid-questionnaire'
      wx.redirectTo({ url: REPORT_ROUTE })
    } catch (err) {
      this.setData({
        submitting: false,
        submitted: false,
        error: '提交失败，请检查网络后重试。',
      })
      console.error('[TurnaroundV6Hybrid] submit failed:', (err && err.message) || err)
    }
  },
})
