/**
 * pages/v21-cognitive-report/v21-cognitive-report.js
 *
 * RC8.3 Stage1C-D1 — North Star report UI (information architecture).
 *
 * Renders a `north_star_report_v1` report object (produced by Stage1C-C).
 * This page is PURE PRESENTATION: it answers "HOW TO PRESENT", never
 * "WHAT IS TRUE". It consumes the report content model verbatim; it does
 * NOT reinterpret diagnosis semantics, does NOT map the blind-spot id to custom
 * copy/principle/strategy/archetype/scenario, and carries no duplicate copy
 * tables.
 *
 * UI INFORMATION ARCHITECTURE (frozen by Stage1C-D1 §4):
 *   PRIMARY FLOW = 8 sections (verdict → current model → world-rule alignment
 *   → evidence → consequence → upgrade → protocol → scenario contrast).
 *   SECONDARY (collapsed by default) = 完整认知地图 (archetype / strengths /
 *   primary distortion / related dimensions / full model map).
 *
 * RAW TOKEN SAFETY: provenance fields (blind-spot id / strategy id / reason code /
 * signal id / question id / option id / raw dimension enum) are dropped in the
 * view-model builder and never reach WXML binding.
 *
 * R4.4 preserved: custom-nav safe-area (runtime measurement, no device
 * detection); no raw enum token exposure.
 *
 * State-aware foundation (§17): supports UNIQUE / MULTIPLE / NO_PRIMARY /
 * INSUFFICIENT / CONTRADICTORY / BLOCKED via section presence, never
 * fabricating missing sections. Full state acceptance is Stage1C-D2.
 *
 * @version north_star_report_v1 (UI)
 */

'use strict'

const app = getApp()
const { buildNorthStarReportViewModel } = require('../../utils/northStarReportViewModel.js')

Page({
  data: {
    loading: true,
    unsupported: false,
    error: '',
    totalNavHeight: 0,

    // Rendered view model (flat, raw-token-free)
    uiState: '',
    hasPrimary: false,
    stateMessage: '',
    retakeAvailable: false,
    verdict: null,
    currentModel: null,
    worldRule: null,
    evidence: null,
    consequence: null,
    upgrade: null,
    protocol: null,
    scenario: null,
    secondary: null,

    // Secondary context collapsed by default (§13)
    secondaryExpanded: false,
  },

  onLoad() {
    this._initNavBar()
    const report = app.globalData.v21CognitiveReport

    if (report && report.version === 'north_star_report_v1') {
      const vm = buildNorthStarReportViewModel(report)
      if (!vm.supported) {
        this.setData({ unsupported: true, loading: false })
        return
      }
      this.setData({
        uiState: vm.uiState,
        hasPrimary: vm.hasPrimary,
        stateMessage: vm.stateMessage,
        retakeAvailable: vm.retakeAvailable,
        verdict: vm.verdict,
        currentModel: vm.currentModel,
        worldRule: vm.worldRule,
        evidence: vm.evidence,
        consequence: vm.consequence,
        upgrade: vm.upgrade,
        protocol: vm.protocol,
        scenario: vm.scenario,
        secondary: vm.secondary,
        loading: false,
      })
    } else if (report && report.worldModel) {
      // Legacy diagnostic_v2_1 object (pre-Stage1C): not rendered by this page.
      this.setData({ unsupported: true, loading: false })
    } else {
      this.setData({ error: '未找到认知报告数据，请重新测评', loading: false })
    }
  },

  // ── 自定义导航安全区（R4.1 同款，仅布局，不改渲染逻辑）───────────────
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

  toggleSecondary() {
    this.setData({ secondaryExpanded: !this.data.secondaryExpanded })
  },

  onBack() {
    wx.navigateBack()
  },
})
