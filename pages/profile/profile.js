/**
 * pages/profile — 成长档案 v3.1 (Part 6)
 */
const app = getApp()
const analytics = require('../../utils/analytics.js')

Page({
  data: {
    user: {}, profile: {}, isVip: false,
    challengeCount: 0, reportCount: 0, badges: [], streak: 0,
    adminTapCount: 0, adminTimer: null,
    memoryEnabled: true,
  },
  onShow() { this.loadData() },
  onUnload() { analytics.flush() },
  async loadData() {
    const gd = app.globalData
    this.setData({
      user: gd.userInfo || {},
      profile: gd.profile || {},
      isVip: gd.userInfo?.membershipLevel !== 'free',
      streak: gd.userInfo?.streak || 0,
    })
    // 加载记忆开关状态
    try {
      const mRes = await wx.cloud.callFunction({ name: 'getMemory' })
      this.setData({ memoryEnabled: mRes.result?.data?.memoryEnabled !== false })
      // 首次记忆说明
      this._maybeShowMemoryNotice()
    } catch (_) {}
    try {
      const db = wx.cloud.database()
      const openid = gd.openid || ''
      const [cRes, rRes, bRes] = await Promise.all([
        db.collection('challenge_records').where({ openid }).count(),
        db.collection('ai_reports').where({ openid }).count(),
        db.collection('badges').limit(10).get(),
      ])
      const badgeDefs = bRes.data || []
      const earned = gd.profile?.badges || []
      const badges = badgeDefs.map(b => ({ ...b, unlocked: earned.includes(b.id || b._id) }))
      this.setData({ challengeCount: cRes.total, reportCount: rRes.total, badges })
    } catch (_) {}
  },

  goDaily()       { wx.navigateTo({ url: '/pages/cognition-daily/cognition-daily' }) },
  goRules()       { wx.navigateTo({ url: '/pages/world-rules/world-rules?favorites=1' }) },
  goChallenges()  { wx.switchTab({ url: '/pages/challenge-start/challenge-start' }) },
  goReports()     { wx.navigateTo({ url: '/pages/report-preview/report-preview' }) },
  goMembership()  { wx.navigateTo({ url: '/pages/membership/membership' }) },
  goInvite()      { wx.navigateTo({ url: '/pages/invite/invite' }) },
  goRanking()     { wx.navigateTo({ url: '/pages/growth-ranking/growth-ranking' }) },
  goSettings()       { wx.showToast({ title: '设置页待上线', icon: 'none' }) },
  goMemoryProfile()  { this._showMemoryProfile() },

  // 首次记忆说明提示
  _maybeShowMemoryNotice() {
    const gd = getApp().globalData
    if (gd.userInfo?.memoryNoticeShown) return
    wx.showModal({
      title: '关于记忆档案',
      content: '为了让小事哥更懂你的认知轨迹，系统会保存你的成长记忆。\n\n包括你的核心目标、认知维度变化、行为统计等。\n\n你可以随时在个人中心关闭或清除记忆。',
      confirmText: '我知道了',
      showCancel: false,
      success: async (res) => {
        if (!res.confirm) return
        try {
          const db = wx.cloud.database()
          const openid = gd.openid
          if (openid) {
            await db.collection('users').where({ openid }).update({ data: { memoryNoticeShown: true } })
          }
          if (gd.userInfo) gd.userInfo.memoryNoticeShown = true
        } catch (_) {}
      },
    })
  },

  async onToggleMemory(e) {
    const enabled = e.detail.value
    this.setData({ memoryEnabled: enabled })
    try {
      await wx.cloud.callFunction({ name: 'toggleMemory', data: { enabled } })
      wx.showToast({ title: enabled ? '记忆已开启' : '记忆已关闭', icon: 'none' })
    } catch (_) {}
  },
  onClearMemory() {
    wx.showModal({
      title: '清除全部记忆',
      content: '将清除小事哥对你的所有记忆记录。包括基本信息、对话摘要、成长轨迹等。此操作不可恢复。',
      confirmText: '确认清除',
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await wx.cloud.callFunction({ name: 'clearMemory', data: {} })
          wx.showToast({ title: '记忆已清除', icon: 'success' })
        } catch (_) {
          wx.showToast({ title: '清除失败，请稍后再试', icon: 'none' })
        }
      },
    })
  },
  async _showMemoryProfile() {
    wx.showLoading({ title: '加载记忆档案...' })
    try {
      const r = await wx.cloud.callFunction({ name: 'getMemory' })
      wx.hideLoading()
      if (r.result?.code !== 0 || !r.result?.data?.memoryEnabled) {
        wx.showModal({ title: '认知档案', content: '记忆功能已关闭或暂无记忆数据。', showCancel: false })
        return
      }
      const d = r.result.data
      const parts = []
      // 长期记忆
      const um = d.userMemory || {}
      if (um.coreGoals?.length) parts.push(`🎯 核心目标：\n${um.coreGoals.join('\n')}`)
      if (um.riskFlags?.length) parts.push(`⚠️ 风险信号：\n${um.riskFlags.join('\n')}`)
      if (um.stableTraits?.length) parts.push(`🧬 稳定特征：\n${um.stableTraits.join('\n')}`)
      // 认知画像
      const dims = d.cognitionMemory?.dimensions
      if (dims) {
        parts.push(`📊 认知维度：\n劳动思维${dims.laborMindset||0} | 概率${dims.probabilityMindset||0} | 系统${dims.systemThinking||0}`)
      }
      // 行为统计
      const bm = d.behaviorMemory || {}
      if (bm) parts.push(`📈 行为统计：暴击${bm.dailyInsightReadCount||0} | 挑战${bm.challengeFinishedCount||0} | 报告${bm.reportGeneratedCount||0}`)
      // 对话摘要
      if (d.conversationMemory?.longTermSummary) parts.push(`💬 对话摘要：${d.conversationMemory.longTermSummary}`)
      // 里程碑
      const gm = d.growthMemory || {}
      if (gm.milestones?.length) parts.push(`🏅 里程碑：\n${gm.milestones.slice(-5).map(m=>m.title).join('\n')}`)

      wx.showModal({ title: '🧠 我的认知档案', content: parts.join('\n\n') || '暂无记忆数据', showCancel: false, confirmText: '知道了' })
    } catch (_) {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onTapVersion() {
    const c = this.data.adminTapCount + 1; this.setData({ adminTapCount: c })
    clearTimeout(this.data.adminTimer)
    if (c >= 5) { this.setData({ adminTapCount: 0 }); this._checkAdmin() }
    else this.data.adminTimer = setTimeout(() => this.setData({ adminTapCount: 0 }), 2000)
  },
  async _checkAdmin() {
    try {
      const r = await wx.cloud.callFunction({ name: 'adminCheckAccess', data: {} })
      if (r.result?.code === 0) wx.navigateTo({ url: '/pages/admin/dashboard/dashboard' })
      else wx.showToast({ title: '无管理权限', icon: 'none' })
    } catch (_) {}
  },
})
