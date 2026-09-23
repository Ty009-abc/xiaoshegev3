/**
 * pages/turnaround-6q-report/turnaround-6q-report.js
 *
 * RC8.8 Stage2 (§15–§19) — revived legacy 6Q five-card report page.
 *
 * • Progressive reveal restored (§16): titles first, then cards revealed at
 *   300 / 700 / 1100 / 1500 / 1900 ms.
 * • Visible order 01 致命一句话 → 05 行动建议 (§15); Card01 is the hero (§17).
 * • Local persistence (§19): the generated 5-card report is cached so reopening
 *   does NOT regenerate unexpectedly. NO cloud DB dependency.
 *
 * Client is PRESENTATION ONLY: it renders the backend contract verbatim.
 *
 * @version legacy6q_v1
 */

'use strict'

const { buildTurnaroundReportViewModel6Q } = require('../../utils/legacy6q/legacy6qReportViewModel.js')

const app = getApp()
const QUESTIONNAIRE_ROUTE = '/pages/turnaround-6q-questionnaire/turnaround-6q-questionnaire'
const CACHE_KEY = 'turnaround6q_last_report'

// §16 progressive reveal schedule (ms) — one per visible card.
const REVEAL_DELAYS = [300, 700, 1100, 1500, 1900]

Page({
  data: {
    loading: true,
    uiState: '',
    hasReport: false,
    cards: [],
    revealed: [],
    message: '',
    retake: false,
    personality: null,
    totalNavHeight: 0,
  },

  onLoad () {
    this._initNavBar()
    this._render()
  },

  onUnload () {
    this._clearTimers()
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

  _clearTimers () {
    (this._timers || []).forEach((t) => clearTimeout(t))
    this._timers = []
  },

  _render () {
    this._clearTimers()
    // §19: prefer the freshly returned envelope; else fall back to the locally
    // persisted report so reopening shows the SAME content (no regeneration).
    let result = app.globalData.turnaround6qResult
    if (!result) {
      try { result = wx.getStorageSync(CACHE_KEY) || null } catch (_) { result = null }
    } else {
      try { wx.setStorageSync(CACHE_KEY, result) } catch (_) {}
    }

    const vm = buildTurnaroundReportViewModel6Q(result)
    const cards = vm.cards || []
    this.setData({
      loading: false,
      uiState: vm.uiState,
      hasReport: vm.hasReport,
      cards,
      revealed: cards.map(() => false),
      message: vm.message,
      retake: vm.retake,
      personality: vm.personality || null,
    })

    // §16 progressive reveal — titles are already visible; bodies appear in order.
    if (vm.hasReport && cards.length) {
      cards.forEach((_, i) => {
        const delay = REVEAL_DELAYS[i] !== undefined ? REVEAL_DELAYS[i] : REVEAL_DELAYS[REVEAL_DELAYS.length - 1]
        const t = setTimeout(() => {
          const revealed = (this.data.revealed || []).slice()
          revealed[i] = true
          this.setData({ revealed })
        }, delay)
        this._timers.push(t)
      })
    }
  },

  onRetake () {
    this._clearTimers()
    app.globalData.turnaround6qResult = null
    try { wx.removeStorageSync(CACHE_KEY) } catch (_) {}
    wx.redirectTo({ url: QUESTIONNAIRE_ROUTE })
  },

  onRetry () { this._render() },

  onBack () { wx.navigateBack({ delta: 1 }) },

  onGoHome () { wx.switchTab({ url: '/pages/home/home' }) },

  onSharePoster () {
    wx.navigateTo({ url: '/pages/turnaround-6q-poster/turnaround-6q-poster' })
  },
})
