/**
 * pages/v21-cognitive-report/v21-cognitive-report.js
 *
 * RC8.3 Stage1B R3 — V2.1 认知报告渲染页（TEST_PREVIEW_ONLY）。
 *
 * 渲染 `runCognitiveReportBuilderV21` 产出的确定性认知报告。
 * 引擎诊断为权威，AI 仅可丰富表达（此处为确定性表达，未调用 AI）。
 *
 * R4.4 变更：
 *   - P1 自定义导航安全区（与 R4.1 问卷页同款运行时测量，无机型检测）；
 *   - P2 展示层本地化（内部枚举 token 不直接暴露给用户）。
 *
 * 严格安全边界：
 *   - 不渲染财富 / 收入 / 职业 / 债务 / 概率 / 置信度 / 严重度；
 *   - 不预测未来结果（所有后果均为条件语言）；
 *   - 仅展示世界模型 9 维度 / 认知盲区 / 策略 / 场景推演 / 确定性表达。
 *
 * @version world_model_v2_1 (cognitive report render)
 */

const app = getApp()
const labels = require('../../utils/v21DisplayLabels.js')

Page({
  data: {
    loading: true,
    error: '',
    report: null,
    worldModel: null,
    blindSpot: null,
    strategy: null,
    archetype: null,
    scenario: null,
    verdict: null,
    expression: '',
    multiModel: null,
    totalNavHeight: 0,
  },

  onLoad() {
    this._initNavBar()
    const report = app.globalData.v21CognitiveReport
    if (report && report.worldModel) {
      this.setData({
        report,
        worldModel: this._localizeDimensions(report.worldModel),
        blindSpot: report.cognitiveBlindSpot || null,
        strategy: report.worldStrategy || null,
        archetype: report.cognitiveArchetype || null,
        scenario: report.scenarioSimulation || null,
        verdict: report.finalVerdict || null,
        expression: report.expression || '',
        multiModel: this._localizeMultiModel(report.multiModelSummary),
        loading: false,
      })
    } else {
      this.setData({ error: '未找到认知报告数据，请重新测评', loading: false })
    }
  },

  // ── 自定义导航安全区（R4.1 同款，仅布局，不改任何渲染逻辑）───────────
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

  // ── 展示层本地化（不改内部值，仅构造渲染视图模型）──────────────────────
  _localizeDimensions(worldModel) {
    const dims = (worldModel && Array.isArray(worldModel.dimensions)) ? worldModel.dimensions : []
    return {
      dimensions: dims.map((d) => ({
        constructLabel: labels.constructLabel(d.construct),
        orientationLabel: labels.orientationLabel(d.orientation),
        stateLabel: labels.stateLabel(d.state),
      })),
    }
  },

  _localizeMultiModel(multiModelSummary) {
    if (!multiModelSummary || !Array.isArray(multiModelSummary.models)) return null
    return {
      state: multiModelSummary.state,
      supportedModelCount: multiModelSummary.supportedModelCount,
      models: multiModelSummary.models.map((m) => ({
        label: m.label,
        questionAnswered: m.questionAnswered || '',
        dimensionStateLabel: labels.stateLabel(m.dimensionState),
      })),
    }
  },

  onBack() {
    wx.navigateBack()
  },
})
