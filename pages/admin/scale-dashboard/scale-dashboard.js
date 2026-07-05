// pages/admin/scale-dashboard/scale-dashboard.js
// 第六册 Part 6 — 规模化增长后台

const app = getApp()

Page({
  data: {
    loading: true,
    activeTab: 'phase',
    phase: null,
    scaleKPIs: null,
    simulation: null,
    bottlenecks: null,
    expansionPlan: null,
    contentScalingPlan: null,
    accountMatrix: null,
    paidRules: null,
    timeline: null,
    milestones: null,
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
        data: { action: 'scaleDashboard' },
      })
      if (res.result && res.result.code === 0) {
        const d = res.result.data
        this.setData({
          phase: d.phase || null,
          scaleKPIs: d.scaleKPIs || null,
          simulation: d.simulation || null,
          bottlenecks: d.bottlenecks || null,
          expansionPlan: d.expansionPlan || null,
          contentScalingPlan: d.contentScalingPlan || null,
          accountMatrix: d.accountMatrix || null,
          paidRules: d.paidRules || null,
          timeline: d.timeline || null,
          milestones: d.simulation?.scenarios?.baseline?.milestones || null,
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
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  // ── 格式化 ──
  formatNum(v) { return v != null ? Number(v).toLocaleString() : '--' },
  formatPercent(v) { return v != null ? v.toFixed(1) + '%' : '--' },
  formatScore(v) { return v != null ? Math.round(v) + '分' : '--' },

  getSeverityColor(s) {
    const map = { critical: '#e74c3c', warning: '#f39c12', low: '#95a5a6' }
    return map[s] || '#999'
  },
  getSeverityIcon(s) {
    const map = { critical: '🔴', warning: '🟡', low: '🟢' }
    return map[s] || '⚪'
  },
  getPhaseColor(phase) {
    const map = { validation: '#4ecdc4', flywheel: '#4a90e2', scaling: '#f39c12', brand: '#e74c3c' }
    return map[phase] || '#999'
  },
})
