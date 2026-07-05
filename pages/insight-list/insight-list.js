/**
 * pages/insight-list - 认知暴击历史列表
 */
const insightService = require('../../services/insightService.js')

Page({
  data: {
    list: [],
    page: 1,
    hasMore: true,
    loading: false,
    isVip: false,
  },

  onLoad() {
    const app = getApp()
    this.setData({ isVip: app.globalData.isVip })
    this.loadMore()
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return
    this.setData({ loading: true })
    try {
      const res = await insightService.getInsightList(this.data.page, 20)
      if (res.code !== 0) { wx.showToast({ title: res.message, icon: 'none' }); return }
      this.setData({
        list: [...this.data.list, ...res.data.list],
        page: this.data.page + 1,
        hasMore: res.data.hasMore,
        loading: false,
      })
    } catch (e) {
      wx.showToast({ title: '系统暂时看不清这个世界，请稍后再试', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  onReachBottom() { this.loadMore() },

  onTapItem(e) {
    const { id, locked } = e.currentTarget.dataset
    if (locked) {
      wx.showToast({ title: 'VIP 解锁完整内容', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/cognition-daily/cognition-daily' })
  },
})
