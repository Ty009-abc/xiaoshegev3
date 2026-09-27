/**
 * pages/admin/dashboard — 后台首页数据总览（RC8.9A 浅色重构）
 */
const adminService = require('../../../services/adminService.js')

Page({
  data: { stats: null, loading: true, error: '' },
  onLoad() { this.fetch() },
  onPullDownRefresh() { this.fetch().finally(() => wx.stopPullDownRefresh()) },
  retry() { this.fetch() },
  async fetch() {
    this.setData({ loading: true, error: '' })
    try {
      const r = await adminService.getDashboard()
      if (r.code !== 0) {
        wx.showToast({ title: r.message || '加载失败', icon: 'none' })
        this.setData({ error: r.message || '加载失败' })
      } else {
        this.setData({ stats: this._formatStats(r.data) })
      }
    } catch (_) {
      // 网络异常：保持页面可交互，由 finally 统一收起 loading
      this.setData({ error: '网络异常，请重试' })
    } finally {
      this.setData({ loading: false })
    }
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
  navToUser(e) {
    const openid = e.currentTarget.dataset.openid
    if (openid) wx.navigateTo({ url: '/pages/admin/user-detail/user-detail?openid=' + encodeURIComponent(openid) })
  },
})
