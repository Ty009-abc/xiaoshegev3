/**
 * pages/admin/ai-logs - AI调用日志（RC8.9A 浅色 + loading 始终收起）
 */
const adminService = require('../../../services/adminService.js')
Page({
  data: { stats: null, list: [], page: 1, total: 0, loading: false },
  onLoad() { this.fetch() },
  async fetch() {
    this.setData({ loading: true })
    try {
      const r = await adminService.getAiLogs({ page: 1, pageSize: 20 })
      if (r.code !== 0) { wx.showToast({ title: r.message || '加载失败', icon: 'none' }); return }
      this.setData({ stats: r.data, list: r.data.list || [], total: r.data.total, page: 2 })
    } catch (_) {
      // ignore
    } finally {
      this.setData({ loading: false })
    }
  },
  loadMore() {
    if (this.data.loading || this.data.list.length >= this.data.total) return
    this.setData({ loading: true })
    adminService.getAiLogs({ page: this.data.page, pageSize: 20 })
      .then(r => { if (r.code === 0) this.setData({ list: [...this.data.list, ...(r.data.list || [])], page: this.data.page + 1, loading: false }); else this.setData({ loading: false }) })
      .catch(() => this.setData({ loading: false }))
  },
  onReachBottom() { this.loadMore() },
  onPullDownRefresh() { this.fetch().finally(() => wx.stopPullDownRefresh()) },
  formatTime(ts) { return ts ? new Date(ts).toLocaleString('zh-CN') : '-' },
})
