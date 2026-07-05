/**
 * pages/admin/revenue-dashboard — 收入仪表盘（第五册 Part 6）
 *
 * Revenue Intelligence Dashboard:
 *   - 今日/本月收入
 *   - MRR / ARR
 *   - 商品收入排行
 *   - 收入结构
 *   - 漏损检测
 *   - 收入预测
 *   - AI CFO 每日简报
 *   - 定价建议
 */
const app = getApp()

Page({
  data: {
    loading: true,
    summary: {},
    productRevenue: [],
    revenueStructure: {},
    leaks: [],
    forecast: null,
    dailyBrief: null,
    pricingSuggestions: [],
    trend: [],
  },

  onLoad() { this.loadDashboard() },

  async loadDashboard() {
    this.setData({ loading: true })
    try {
      // 获取收入概览
      const summaryRes = await wx.cloud.callFunction({
        name: 'adminGetAnalytics',
        data: { action: 'revenue_summary' },
      })
      if (summaryRes.result?.code === 0) {
        this.setData({ summary: this._formatRevenueMetrics(summaryRes.result.data || {}) })
      }

      // 获取商品收入
      const productRes = await wx.cloud.callFunction({
        name: 'adminGetAnalytics',
        data: { action: 'product_revenue' },
      })
      if (productRes.result?.code === 0) {
        this.setData({ productRevenue: productRes.result.data?.products || [] })
      }

      // 获取收入结构
      const structRes = await wx.cloud.callFunction({
        name: 'adminGetAnalytics',
        data: { action: 'revenue_structure' },
      })
      if (structRes.result?.code === 0) {
        this.setData({ revenueStructure: structRes.result.data || {} })
      }

      // 获取漏损
      const leakRes = await wx.cloud.callFunction({
        name: 'adminGetAnalytics',
        data: { action: 'revenue_leaks' },
      })
      if (leakRes.result?.code === 0) {
        this.setData({ leaks: leakRes.result.data?.leaks || [] })
      }

      // 获取预测
      const forecastRes = await wx.cloud.callFunction({
        name: 'adminGetAnalytics',
        data: { action: 'revenue_forecast' },
      })
      if (forecastRes.result?.code === 0) {
        this.setData({ forecast: forecastRes.result.data || null })
      }

      // 获取AI CFO简报
      const briefRes = await wx.cloud.callFunction({
        name: 'adminGetAnalytics',
        data: { action: 'daily_brief' },
      })
      if (briefRes.result?.code === 0) {
        this.setData({ dailyBrief: briefRes.result.data || null })
      }

      // 获取定价建议
      const priceRes = await wx.cloud.callFunction({
        name: 'adminGetAnalytics',
        data: { action: 'pricing_suggestions' },
      })
      if (priceRes.result?.code === 0) {
        this.setData({ pricingSuggestions: priceRes.result.data?.suggestions || [] })
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
    this.setData({ loading: false })
  },

  onPullDownRefresh() {
    this.loadDashboard().then(() => wx.stopPullDownRefresh())
  },

  // 格式化收入指标（分→元，在 JS 层处理）
  _formatRevenueMetrics(s) {
    if (!s) return s
    const d2 = v => v != null ? Number(v).toFixed(2) : '0.00'
    const d0 = v => v != null ? Number(v).toFixed(0) : '0'
    return {
      ...s,
      grossRevenueYuan: d0(s.grossRevenue),
      netRevenueYuan: d0(s.netRevenue),
      MRRYuan: d0(s.MRR),
      ARRYuan: d0(s.ARR),
      ARPUYuan: d2(s.ARPU),
      ARPPUYuan: d2(s.ARPPU),
      LTVYuan: d0(s.LTV),
    }
  },
  // 格式化金额（分→元）
  _formatYuan(fen) {
    if (!fen && fen !== 0) return '0.00'
    return (fen / 100).toFixed(2)
  },
})
