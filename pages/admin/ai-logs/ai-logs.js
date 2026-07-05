/**
 * pages/admin/ai-logs - AI调用日志
 */
const adminService = require('../../../services/adminService.js')
Page({
  data: { stats: null, list: [], page: 1, total: 0, loading: false },
  onLoad() { this.fetch() },
  async fetch() {
    this.setData({ loading: true })
    try {
      const r = await adminService.getAiLogs({ page: 1, pageSize: 20 })
      if (r.code !== 0) { wx.showToast({ title: r.message, icon: 'none' }); return }
      this.setData({ stats: r.data, list: r.data.list, total: r.data.total, page: 2, loading: false })
    } catch (_) { this.setData({ loading: false }) }
  },
  loadMore() {
    if (this.data.loading || this.data.list.length >= this.data.total) return
    this.setData({ loading: true })
    adminService.getAiLogs({ page: this.data.page, pageSize: 20 })
      .then(r => { if (r.code === 0) this.setData({ list: [...this.data.list, ...r.data.list], page: this.data.page + 1, loading: false }); else this.setData({ loading: false }) })
      .catch(() => this.setData({ loading: false }))
  },
  onReachBottom() { this.loadMore() },
  onPullDownRefresh() { this.fetch().then(() => wx.stopPullDownRefresh()) },
  formatTime(ts) { return ts ? new Date(ts).toLocaleString('zh-CN') : '-' },
})
