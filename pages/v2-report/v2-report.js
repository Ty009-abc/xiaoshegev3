/**
 * pages/v2-report/v2-report.js
 *
 * RC8.3 Stage 17A — world_model_v2 primary 报告页（单用户 canary）。
 *
 * 仅当服务端返回 renderSource = 'world_model_v2' 时才进入本页。
 * 展示 adaptWorldModelToLegacyV2 产出的中文报告结构，
 * 不含 V1 财富诊断内容，不含内部枚举/undefined/null。
 */
const app = getApp()

Page({
  data: {
    loading: true,
    error: '',
    report: null,
    primaryBlindSpot: '',
    strategy: '',
    inputHash: '',
  },

  onLoad() {
    const d = app.globalData.v2PrimaryReport
    if (d && d.report) {
      this.setData({
        report: d.report,
        primaryBlindSpot: (d.diagnosis && d.diagnosis.cognitiveBlindSpot && d.diagnosis.cognitiveBlindSpot.id) || '',
        strategy: (d.diagnosis && d.diagnosis.worldStrategy && d.diagnosis.worldStrategy.id) || '',
        inputHash: d.inputHash || '',
        loading: false,
      })
    } else {
      this.setData({ error: '未找到 V2 报告数据，请重新提交', loading: false })
    }
  },

  onBack() {
    wx.navigateBack()
  },
})
