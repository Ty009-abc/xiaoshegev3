/**
 * pages/admin/growth-dashboard — 增长仪表盘（第六册 Part 1）
 *
 * Growth Dashboard:
 *   核心指标：DAU / MAU / 新增用户 / 分享率 / 邀请转化率 / CAC / K-Factor
 *   增长漏斗可视化
 *   7日 DAU 趋势
 *   渠道归因
 *   增长飞轮状态
 *   增长健康度评分
 *   漏斗瓶颈检测
 */
const app = getApp()

Page({
  data: {
    loading: true,
    summary: {},
    healthScore: null,
    bottlenecks: [],
    flywheel: null,
    channelStats: null,
    cac: null,
    trend: [],
  },

  onLoad() { this.loadDashboard() },

  async loadDashboard() {
    this.setData({ loading: true })
    try {
      // 1. 增长概览
      const summaryRes = await wx.cloud.callFunction({
        name: 'adminGetAnalytics',
        data: { action: 'growth_summary' },
      })
      if (summaryRes.result?.code === 0) {
        const s = summaryRes.result.data
        this.setData({ summary: s, trend: this._formatTrend(s.trend || []) })
      }

      // 2. 健康度评分
      const healthRes = await wx.cloud.callFunction({
        name: 'adminGetAnalytics',
        data: { action: 'growth_health' },
      })
      if (healthRes.result?.code === 0) {
        this.setData({ healthScore: healthRes.result.data })
      }

      // 3. 漏斗瓶颈
      const bottleRes = await wx.cloud.callFunction({
        name: 'adminGetAnalytics',
        data: { action: 'growth_bottleneck' },
      })
      if (bottleRes.result?.code === 0) {
        this.setData({ bottlenecks: bottleRes.result.data?.bottlenecks || [] })
      }

      // 4. 飞轮状态
      const flyRes = await wx.cloud.callFunction({
        name: 'adminGetAnalytics',
        data: { action: 'growth_flywheel' },
      })
      if (flyRes.result?.code === 0) {
        this.setData({ flywheel: flyRes.result.data })
      }

      // 5. 渠道归因
      const chRes = await wx.cloud.callFunction({
        name: 'adminGetAnalytics',
        data: { action: 'growth_channels' },
      })
      if (chRes.result?.code === 0) {
        this.setData({ channelStats: chRes.result.data })
      }

      // 6. CAC
      const cacRes = await wx.cloud.callFunction({
        name: 'adminGetAnalytics',
        data: { action: 'growth_cac' },
      })
      if (cacRes.result?.code === 0) {
        this.setData({ cac: cacRes.result.data })
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
    this.setData({ loading: false })
  },

  onPullDownRefresh() {
    this.loadDashboard().then(() => wx.stopPullDownRefresh())
  },

  _barWidth(val, max) {
    if (!max || !val) return 0
    return Math.min(100, Math.round((val / max) * 100))
  },

  _maxDau(trend) {
    return Math.max(...trend.map(t => t.dau || 0), 1)
  },
  _formatTrend(trend) {
    return trend.map(item => ({
      ...item,
      dateLabel: (item.date || '').slice(5),
    }))
  },
})
