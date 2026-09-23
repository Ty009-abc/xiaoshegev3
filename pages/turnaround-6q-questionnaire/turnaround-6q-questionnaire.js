/**
 * pages/turnaround-6q-questionnaire/turnaround-6q-questionnaire.js
 *
 * RC8.8 — dedicated 6-question "翻身策略" questionnaire (client entry).
 *
 * Single source of truth: utils/turnaround6q/turnaround6qQuestionnaire.js
 * A NEW dedicated page (does NOT reuse the challenge-play mode architecture).
 *
 * UX (§4): progress 1/6..6/6 · previous supported · per-step validation ·
 * keyboard-safe · values restored on back navigation · no placeholder bugs ·
 * no debug markers.
 *
 * Client is INPUT ONLY: no diagnosis, no scoring, no rewriting. On submit it
 * forwards the raw 6Q facts to generateAiReport (turnaround_strategy_6q_v1)
 * and redirects to the 6Q report page.
 *
 * @version turnaround_strategy_6q_v1
 */

'use strict'

const {
  getQuestions6Q,
  QUESTION_COUNT_6Q,
  validateField6Q,
  validateAnswers6Q,
  buildCloudRequest6Q,
} = require('../../utils/turnaround6q/turnaround6qQuestionnaire.js')
const { getRandomPersonality } = require('../../utils/personalityModes.js')

const app = getApp()
const REPORT_ROUTE = '/pages/turnaround-6q-report/turnaround-6q-report'

Page({
  data: {
    started: false,
    questions: [],
    totalCount: 0,
    currentIndex: 0,
    current: null,
    answers: {},
    progressPercent: 0,
    submitting: false,
    submitted: false,
    error: '',
    totalNavHeight: 0,
    personality: null,
  },

  onLoad () {
    this._initNavBar()
    this._questions = getQuestions6Q()
    // §5: select the persona ONCE per session (random, exclude the immediately
    // previous one, persist last_personality). The persona is shown to the user
    // as an active analytical lens; its INTERNAL system text is never exposed.
    let last = ''
    try { last = wx.getStorageSync('last_personality') || '' } catch (_) { last = '' }
    const p = getRandomPersonality(last)
    try { wx.setStorageSync('last_personality', p.name) } catch (_) {}
    this._personality = p
    this._lastPersonality = last
    this.setData({
      questions: this._questions,
      totalCount: QUESTION_COUNT_6Q,
      current: this._questions[0],
      personality: { name: p.name, emoji: p.emoji },
    })
  },

  _initNavBar () {
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

  _pct (positionOneBased) {
    const total = this.data.totalCount || QUESTION_COUNT_6Q
    return Math.round((positionOneBased / total) * 100)
  },

  startSession () {
    this.setData({
      started: true,
      currentIndex: 0,
      current: this._questions[0],
      answers: {},
      progressPercent: this._pct(1),
      submitting: false,
      submitted: false,
      error: '',
    })
  },

  restartSession () {
    this.startSession()
  },

  // ── input (raw language preserved verbatim) ────────────────────────────
  onInput (e) {
    if (this.data.submitting || this.data.submitted) return
    const key = e.currentTarget.dataset.key
    const q = this.data.current
    if (!key || !q) return
    let v = (e && e.detail && e.detail.value !== undefined && e.detail.value !== null)
      ? String(e.detail.value)
      : ''
    // numeric fields: digits only
    if (q.inputMode === 'number') v = v.replace(/[^0-9]/g, '')
    // defensive length clamp (never lose prior text)
    if (q.maxlength && v.length > q.maxlength) v = v.slice(0, q.maxlength)
    const answers = Object.assign({}, this.data.answers)
    answers[key] = v
    this.setData({ answers, error: '' })
  },

  // ── navigation ─────────────────────────────────────────────────────────
  goNext () {
    if (this.data.submitting || this.data.submitted) return
    const q = this.data.current
    if (!q) return
    const err = validateField6Q(q, this.data.answers[q.key])
    if (err) {
      wx.showToast({ title: err, icon: 'none' })
      return
    }
    if (this.data.currentIndex >= this.data.totalCount - 1) return
    const next = this.data.currentIndex + 1
    this.setData({
      currentIndex: next,
      current: this._questions[next],
      error: '',
      progressPercent: this._pct(next + 1),
    })
  },

  goBack () {
    if (this.data.submitting || this.data.submitted) return
    if (this.data.currentIndex <= 0) return
    const prev = this.data.currentIndex - 1
    this.setData({
      currentIndex: prev,
      current: this._questions[prev],
      error: '',
      progressPercent: this._pct(prev + 1),
    })
  },

  // ── submit ─────────────────────────────────────────────────────────────
  async submit () {
    if (this.data.submitting || this.data.submitted) return

    const { valid, errors } = validateAnswers6Q(this.data.answers)
    if (!valid) {
      // Jump to the FIRST invalid step and explain why (no silent dead-end).
      const first = (errors[0] || '').split(':')[0].trim()
      const idx = this._questions.findIndex((x) => x.key === first)
      if (idx >= 0) {
        this.setData({ currentIndex: idx, current: this._questions[idx], progressPercent: this._pct(idx + 1) })
      }
      wx.showToast({ title: (errors[0] || '还有题目没有完成').split(': ').slice(-1)[0], icon: 'none' })
      return
    }

    this.setData({ submitting: true, submitted: true, error: '' })

    const req = buildCloudRequest6Q(this.data.answers, this._personality && this._personality.name, this._lastPersonality)
    try {
      const res = await wx.cloud.callFunction(req)
      const result = res && res.result ? res.result : null
      // Hand the raw envelope to the report page (no storage, no persistence).
      app.globalData.turnaround6qResult = result
      app.globalData.turnaround6qSubmittedAt = Date.now()
      wx.redirectTo({ url: REPORT_ROUTE })
    } catch (err) {
      this.setData({
        submitting: false,
        submitted: false,
        error: '提交失败，请检查网络后重试。',
      })
      console.error('[Turnaround6Q] submit failed:', (err && err.message) || err)
    }
  },
})
