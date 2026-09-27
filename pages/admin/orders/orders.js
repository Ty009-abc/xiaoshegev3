/**
 * pages/admin/orders - 订单管理（RC8.9A 浅色）
 */
const adminService = require('../../../services/adminService.js')

function maskOpenid(oid) {
  if (!oid || oid.length <= 8) return oid || ''
  return oid.slice(0, 4) + '***' + oid.slice(-4)
}

Page({
  data: { list: [], page: 1, total: 0, loading: false, status: '', product: '' },
  onLoad() { this.load() },
  load() {
    this.setData({ loading: true, list: [], page: 1 })
    return adminService.getOrders({ page: 1, pageSize: 20, status: this.data.status, productId: this.data.product })
      .then(r => {
        if (r.code === 0) {
          const list = (r.data.list || []).map(o => ({ ...o, maskedOpenid: maskOpenid(o.openid) }))
          this.setData({ list, total: r.data.total, page: 2, loading: false })
        } else this.setData({ loading: false })
      })
      .catch(() => this.setData({ loading: false }))
  },
  loadMore() {
    if (this.data.loading || this.data.list.length >= this.data.total) return
    this.setData({ loading: true })
    adminService.getOrders({ page: this.data.page, pageSize: 20, status: this.data.status, productId: this.data.product })
      .then(r => {
        if (r.code === 0) {
          const more = (r.data.list || []).map(o => ({ ...o, maskedOpenid: maskOpenid(o.openid) }))
          this.setData({ list: [...this.data.list, ...more], page: this.data.page + 1, loading: false })
        } else this.setData({ loading: false })
      })
      .catch(() => this.setData({ loading: false }))
  },
  onFilterStatus(e) { this.setData({ status: e.currentTarget.dataset.s || '' }, () => this.load()) },
  onReachBottom() { this.loadMore() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },
  formatTime(ts) { return ts ? new Date(ts).toLocaleDateString('zh-CN') : '-' },
  formatPrice(fen) { return (fen / 100).toFixed(2) },
})
