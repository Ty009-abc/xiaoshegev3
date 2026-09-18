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
    selectedSecondary2Id: '',
    progressPercent: 0,
    submitting: false,
    submitted: false,
    error: '',
    reviewMode: false,
    revertToLatest: false,
    totalNavHeight: 0,
  },

  onLoad() {
    this._initNavBar()
    this._screens = getScreensHybridV10()
    this.setData({
      screens: this._screens,
      totalCount: this._screens.length,
    })
    this._maybeRestoreForReview()
  },

  // R48 §5/§15 — conflict review handoff.
  // The EVIDENCE_CONFLICT "返回确认" CTA returns here with EXISTING answers
  // preserved (saved on submit) and jumps straight to the first screen that
  // needs confirming. It NEVER forces a full questionnaire restart.
  _maybeRestoreForReview() {
    const app0 = getApp()
    const review = app0 && app0.globalData ? app0.globalData.turnaroundV6Review : null
    if (!review || review.mode !== 'REVIEW') return
    const saved = (app0.globalData && app0.globalData.turnaroundV6HybridAnswers) || null
    if (!saved) return

    const screens = this._screens
    const targets = Array.isArray(review.screens) ? review.screens : []
    // 1-based screen numbers -> 0-based index of the first to confirm.
    let idx = 0
    if (targets.length) {
      const oneBased = Math.min.apply(null, targets)
      idx = Math.max(0, Math.min(screens.length - 1, (oneBased || 1) - 1))
    }
    const s = screens[idx]
    const app1 = getApp()
    app1.globalData.turnaroundV6Review = null // consume the marker
    this.setData({
      started: true,
      reviewMode: true,
      currentIndex: idx,
      answers: Object.assign({}, saved),
      occupation: (app1.globalData && app1.globalData.turnaroundV6HybridOccupation) || this.data.occupation,
      selectedMainId: (s && saved[s.key]) || '',
      selectedSecondaryId: (s && s.secondary && saved[s.secondary.key]) || '',
      selectedSecondary2Id: (s && s.secondary2 && saved[s.secondary2.key]) || '',
      progressPercent: this._pct(idx + 1),
      submitting: false,
      submitted: false,
      error: '',
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
      reviewMode: false,
      currentIndex: 0,
      answers: {},
      occupation: '',
      selectedMainId: '',
      selectedSecondaryId: '',
      selectedSecondary2Id: '',
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
      selectedSecondary2Id: (s && s.secondary2 && a[s.secondary2.key]) || '',
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

  selectSecondary2(e) {
    if (this.data.submitting || this.data.submitted) return
    const optionId = e.currentTarget.dataset.optionId
    const s = this.data.screens[this.data.currentIndex]
    if (!s || !s.secondary2) return
    if (!s.secondary2.options.some((o) => o.optionId === optionId)) return
    const answers = Object.assign({}, this.data.answers)
    answers[s.secondary2.key] = optionId
    this.setData({ answers: answers, selectedSecondary2Id: optionId, error: '' })
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
    // R85-C §4 — pricing authority is required on this screen.
    if (s.secondary2 && s.secondary2.required !== false && !a[s.secondary2.key]) return false
    // R85-B §3/§5 — required occupation text must be meaningfully non-empty.
    if (s.secondaryText && s.secondaryText.required === true) {
      const t = this.data.occupation
      if (typeof t !== 'string' || !t.trim()) return false
    }
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
    // R85-B §3/§5 — occupation is a required real-world input now.
    if (this.data.occupation && this.data.occupation.trim()) payload.occupationDetail = this.data.occupation.trim()

    const { valid, errors } = validateAnswersHybridV10(payload)
    if (!valid) {
      const occMissing = errors.some((e) => /occupationDetail|occupationCategory/.test(e))
      const priceMissing = errors.some((e) => /pricingAuthority/.test(e))
      this.setData({ error: priceMissing ? '请选择这份主要收入最后由谁决定你能拿多少钱。' : occMissing ? '请把你的具体职业写具体一点（比如：前端开发、厨师、房产销售）。' : '还有题目没有完成，请检查后再提交。' })
      console.error('[TurnaroundV6Hybrid] answer validation failed:', errors)
      return
    }

    this.setData({ submitting: true, submitted: true, error: '' })

    // R48 §15 — persist the exact submission so a conflict "返回确认" can
    // restore every answer (EXISTING_ANSWER_LOSS_COUNT = 0).
    app.globalData.turnaroundV6HybridAnswers = Object.assign({}, payload)
    app.globalData.turnaroundV6HybridOccupation = payload.occupationDetail || ''

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
