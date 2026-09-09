/**
 * pages/v21-cognitive-report/v21-cognitive-report.js
 *
 * RC8.3 Stage1B R3 — V2.1 认知报告渲染页（TEST_PREVIEW_ONLY）。
 *
 * 渲染 `runCognitiveReportBuilderV21` 产出的确定性认知报告。
 * 引擎诊断为权威，AI 仅可丰富表达（此处为确定性表达，未调用 AI）。
 *
 * 严格安全边界：
 *   - 不渲染财富 / 收入 / 职业 / 债务 / 概率 / 置信度 / 严重度；
 *   - 不预测未来结果（所有后果均为条件语言）；
 *   - 仅展示世界模型 9 维度 / 认知盲区 / 策略 / 场景推演 / 确定性表达。
 *
 * @version world_model_v2_1 (cognitive report render)
 */

const app = getApp()

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
  },

  onLoad() {
    const report = app.globalData.v21CognitiveReport
    if (report && report.worldModel) {
      this.setData({
        report,
        worldModel: report.worldModel,
        blindSpot: report.cognitiveBlindSpot || null,
        strategy: report.worldStrategy || null,
        archetype: report.cognitiveArchetype || null,
        scenario: report.scenarioSimulation || null,
        verdict: report.finalVerdict || null,
        expression: report.expression || '',
        loading: false,
      })
    } else {
      this.setData({ error: '未找到认知报告数据，请重新测评', loading: false })
    }
  },

  onBack() {
    wx.navigateBack()
  },
})
