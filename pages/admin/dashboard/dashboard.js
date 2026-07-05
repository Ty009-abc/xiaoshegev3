/**
 * pages/admin/dashboard - 后台首页数据总览
 */
const adminService = require('../../../services/adminService.js')

Page({
  data: { stats: null, loading: true },
  onLoad() { this.fetch() },
  onPullDownRefresh() { this.fetch().then(() => wx.stopPullDownRefresh()) },
  async fetch() {
    this.setData({ loading: true })
    try {
      const r = await adminService.getDashboard()
      if (r.code !== 0) { wx.showToast({ title: r.message, icon: 'none' }); return }
      const stats = this._formatStats(r.data)
      this.setData({ stats, loading: false })
    } catch (_) { this.setData({ loading: false }) }
  },
  _formatStats(s) {
    if (!s) return s
    return {
      ...s,
      totalRevenueYuan: ((s.totalRevenue || 0) / 100).toFixed(0),
      todayRevenueYuan: ((s.todayRevenue || 0) / 100).toFixed(0),
    }
  },
  navTo(e) {
    const p = e.currentTarget.dataset.page
    wx.navigateTo({ url: '/pages/admin/' + p + '/' + p })
  },
})
