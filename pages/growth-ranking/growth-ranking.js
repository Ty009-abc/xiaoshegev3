/**
 * pages/growth-ranking — 认知成长榜
 */
Page({
  data: {
    list: [],
    myRank: null,
    loading: true,
    loadFailed: false,
    loadError: '',
    tab: 'cv',
  },

  onShow() {
    this.load()
  },

  async load() {
    this.setData({ loading: true, loadFailed: false, loadError: '' })
    try {
      const db = wx.cloud.database()
      const _ = db.command
      const res = await db.collection('users')
        .field({ nickname: true, avatarUrl: true, cv: true, level: true, streak: true })
        .orderBy(this.data.tab, 'desc')
        .limit(50)
        .get()

      console.log('[GrowthRankingRuntime]', {
        activeTab: this.data.tab,
        loading: true,
        rawKeys: res ? Object.keys(res) : [],
        dataKeys: res.data ? (res.data[0] ? Object.keys(res.data[0]) : []) : [],
        listLength: res.data ? res.data.length : 0,
        error: null,
      })

      const list = (res.data || []).map((u, i) => ({
        ...u,
        rank: i + 1,
      }))

      const openid = getApp().globalData.openid || ''
      const me = list.find(u => u._openid === openid)

      this.setData({
        list,
        myRank: me || null,
        loading: false,
        loadFailed: false,
      })
    } catch (err) {
      console.error('[GrowthRankingRuntime] fail', err)
      this.setData({
        loading: false,
        loadFailed: true,
        loadError: err.message || '榜单加载失败',
      })
    }
  },

  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab !== this.data.tab) {
      this.setData({ tab })
      this.load()
    }
  },

  onRetry() {
    this.load()
  },
})
