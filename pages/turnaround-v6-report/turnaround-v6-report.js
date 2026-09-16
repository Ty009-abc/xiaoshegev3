/**
 * pages/turnaround-v6-report/turnaround-v6-report.js
 *
 * RC8.4 V6 — PRODUCTION five-card turnaround strategy report (presentation only).
 *
 * The client is PRESENTATION ONLY (R29 §11 CLIENT_DIAGNOSIS_AUTHORITY = 0):
 * it renders the backend-authoritative V6 report verbatim. It NEVER
 * rediagnoses, rewrites primaryBottleneck, invents scores/percentages, changes
 * firstActionType, or performs client-side AI calls. Engineering metadata
 * (provenance / reportVersion / reportState / renderSource / validator state /
 * model name) is dropped by the view-model builder and never reaches WXML.
 *
 * Input: `app.globalData.turnaroundV6Result` = the raw cloud envelope
 * ({ code, message, data:{ reportType, diagnosticVersion, v6PrimaryActive,
 *    reportVersion, reportState, cards } }).
 *
 * @version turnaround_strategy_v6 (production report UI)
 */

'use strict'

const {
  buildTurnaroundReportViewModelV6,
} = require('../../utils/v6/turnaroundReportViewModelV6.js')

const app = getApp()

const QUESTIONNAIRE_ROUTE = '/pages/turnaround-v6-questionnaire/turnaround-v6-questionnaire'
const HYBRID_QUESTIONNAIRE_ROUTE = '/pages/turnaround-v6-hybrid-questionnaire/turnaround-v6-hybrid-questionnaire'
const ALLOWED_RETAKE_ROUTES = [QUESTIONNAIRE_ROUTE, HYBRID_QUESTIONNAIRE_ROUTE]

Page({
  data: {
    loading: true,
    uiState: '',
    hasReport: false,
    cards: [],
    message: '',
    title: '',
    retake: false,
    conflict: null,
    ctas: [],
    totalNavHeight: 0,
  },

  onLoad() {
    this._initNavBar()
    this._render()
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

  _render() {
    const result = app.globalData.turnaroundV6Result
    const vm = buildTurnaroundReportViewModelV6(result)
    this.setData({
      loading: false,
      uiState: vm.uiState,
      hasReport: vm.hasReport,
      cards: vm.cards,
      message: vm.message,
      title: vm.title || '',
      retake: vm.retake,
      conflict: vm.conflict || null,
      ctas: vm.ctas || [],
    })
  },

  // R48 §5/§15 — EVIDENCE_CONFLICT CTA "返回确认".
  // Return the user to the relevant questionnaire answers with their EXISTING
  // selections preserved (no full restart). The review handoff carries the
  // recommended review screens; the questionnaire page keeps every saved answer
  // and only jumps to the first screen that needs confirming.
  onReviewConflict() {
    const src = app.globalData.turnaroundV6SourceRoute
    const url = ALLOWED_RETAKE_ROUTES.indexOf(src) !== -1 ? src : HYBRID_QUESTIONNAIRE_ROUTE
    const vm = buildTurnaroundReportViewModelV6(app.globalData.turnaroundV6Result)
    const screens = (vm && vm.conflict && vm.conflict.recommendedReviewScreens) || []
    app.globalData.turnaroundV6Review = {
      mode: 'REVIEW',
      screens: screens,
    }
    wx.redirectTo({ url: url })
  },

  // Retake the questionnaire (clear prior result so a stale report can't show).
  // R44 §19: returns to the ORIGINATING questionnaire — the hybrid source when
  // the session came from the hybrid flow, otherwise the frozen V6 9Q route.
  // Only the two in-product V6 routes are ever allowed (no legacy leak).
  onRetake() {
    app.globalData.turnaroundV6Result = null
    const src = app.globalData.turnaroundV6SourceRoute
    const url = ALLOWED_RETAKE_ROUTES.indexOf(src) !== -1 ? src : QUESTIONNAIRE_ROUTE
    wx.redirectTo({ url: url })
  },

  // R48 §5 — conflict state CTA router.
  onConflictCta(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.cta : ''
    if (id === 'back') return this.onBack()
    return this.onReviewConflict()
  },

  // Plain back to the previous page.
  onBack() {
    wx.navigateBack({ delta: 1 })
  },

  onRetry() {
    this._render()
  },
})
