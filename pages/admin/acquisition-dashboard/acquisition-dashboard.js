// pages/admin/acquisition-dashboard/acquisition-dashboard.js
// 第六册 Part 5 — 获客分析后台

const app = getApp()

Page({
  data: {
    loading: true,
    activeTab: 'overview',
    summary: null,
    cacBySource: null,
    activationBySource: null,
    paidConversionBySource: null,
    ltvBySource: null,
    sourceQuality: null,
    attributionReport: null,
    contentROI: null,
    highValueSegments: null,
    budgetOptimizer: null,
    ltvHealth: null,
    ltvTrend: null,
  },

  onLoad() {
    this.loadAll()
  },

  onPullDownRefresh() {
    this.loadAll().then(() => wx.stopPullDownRefresh())
  },

  async loadAll() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminGetAnalytics',
        data: { action: 'acquisitionDashboard' },
      })
      if (res.result && res.result.code === 0) {
        const d = res.result.data
        this.setData({
          summary: d.summary || null,
          cacBySource: d.cacBySource || null,
          activationBySource: d.activationBySource || null,
          paidConversionBySource: d.paidConversionBySource || null,
          ltvBySource: d.ltvBySource || null,
          sourceQuality: d.sourceQuality || null,
          attributionReport: d.attributionReport || null,
          contentROI: d.contentROI || null,
          highValueSegments: d.highValueSegments || null,
          budgetOptimizer: d.budgetOptimizer || null,
          ltvHealth: d.ltvHealth || null,
          ltvTrend: d.ltvTrend || null,
          loading: false,
        })
      } else {
        this.setData({ loading: false })
        wx.showToast({ title: res.result?.message || '加载失败', icon: 'none' })
      }
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  // ── 格式化 ──
  formatPercent(v) { return v != null ? v.toFixed(1) + '%' : '--' },
  formatPrice(v) { return v != null ? '¥' + (v / 100).toFixed(2) : '--' },
  formatRatio(v) { return v != null ? v.toFixed(1) + 'x' : '--' },

  getHealthColor(h) {
    if (h === 'healthy' || h === '🟢') return '#2ecc71'
    if (h === 'ok' || h === '🟡') return '#f39c12'
    return '#e74c3c'
  },

  getTierColor(tier) {
    const map = { A: '#2ecc71', B: '#4a90e2', C: '#f39c12', D: '#e74c3c' }
    return map[tier] || '#999'
  },

  getActionColor(action) {
    const map = { increase: '#2ecc71', maintain: '#4a90e2', optimize: '#f39c12', reduce: '#e74c3c', pause: '#e74c3c' }
    return map[action] || '#999'
  },

  getActionLabel(action) {
    const map = { increase: '↑ 增加', maintain: '→ 保持', optimize: '↻ 优化', reduce: '↓ 减少', pause: '⏸ 暂停' }
    return map[action] || action
  },
})
