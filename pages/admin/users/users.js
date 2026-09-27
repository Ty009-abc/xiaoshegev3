/**
 * pages/admin/users - 用户管理（RC8.9A 浅色）
 */
const adminService = require('../../../services/adminService.js')

function maskOpenid(oid) {
  if (!oid || oid.length <= 8) return oid || ''
  return oid.slice(0, 4) + '***' + oid.slice(-4)
}

Page({
  data: { list: [], page: 1, total: 0, loading: false, keyword: '', level: '', filterStatus: '' },
  onLoad() { this.load() },
  load() {
    this.setData({ loading: true, list: [], page: 1 })
    return adminService.getUsers({ page: 1, pageSize: 20, keyword: this.data.keyword, membershipLevel: this.data.level, status: this.data.filterStatus })
      .then(r => {
        if (r.code === 0) {
          const list = (r.data.list || []).map(u => ({ ...u, maskedOpenid: maskOpenid(u.openid) }))
          this.setData({ list, total: r.data.total, page: 2, loading: false })
        } else this.setData({ loading: false })
      })
      .catch(() => this.setData({ loading: false }))
  },
  loadMore() {
    if (this.data.loading || this.data.list.length >= this.data.total) return
    this.setData({ loading: true })
    adminService.getUsers({ page: this.data.page, pageSize: 20, keyword: this.data.keyword, membershipLevel: this.data.level, status: this.data.filterStatus })
      .then(r => {
        if (r.code === 0) {
          const more = (r.data.list || []).map(u => ({ ...u, maskedOpenid: maskOpenid(u.openid) }))
          this.setData({ list: [...this.data.list, ...more], page: this.data.page + 1, loading: false })
        } else this.setData({ loading: false })
      })
      .catch(() => this.setData({ loading: false }))
  },
  onInput(e) { this.setData({ keyword: e.detail.value }) },
  onSearch() { this.load() },
  onFilterLevel(e) { this.setData({ level: e.currentTarget.dataset.l || '' }, () => this.load()) },
  onFilterStatus(e) { this.setData({ filterStatus: e.currentTarget.dataset.s || '' }, () => this.load()) },
  onTapUser(e) {
    const u = e.currentTarget.dataset.user
    wx.showActionSheet({
      itemList: ['查看详情', '封禁', '解封', '增加CV', '设为月卡', '设为年卡'],
      success: res => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/admin/user-detail/user-detail?openid=' + encodeURIComponent(u.openid) })
          return
        }
        const actions = ['', 'block', 'unblock', 'add_cv', 'set_membership', 'set_membership']
        const values = ['', '', '', '50', 'vip_month', 'vip_year']
        if (actions[res.tapIndex] === 'add_cv') {
          wx.showModal({ title: '增加CV', editable: true, placeholderText: '50', success: r2 => {
            if (r2.confirm) adminService.updateUser(u.openid, 'add_cv', r2.content || '50').then(() => this.load())
          }})
        } else {
          adminService.updateUser(u.openid, actions[res.tapIndex], values[res.tapIndex]).then(() => this.load())
        }
      },
    })
  },
  onReachBottom() { this.loadMore() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },
  formatTime(ts) { return ts ? new Date(ts).toLocaleDateString('zh-CN') : '-' },
})
