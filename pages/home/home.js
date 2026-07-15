/**
 * pages/home — v3.12 cognition-strike + personality injection
 */
const analytics = require('../../utils/analytics.js')
const { getTodayStrike } = require('../../utils/cognitionStrike.js')
const { getRandomPersonality } = require('../../utils/personalityModes.js')
const app = getApp()

Page({
  data: {
    user: {}, insight: null, loading: true, strategyLoading: false,
    cvPercent: 0, streak: 0, streakLost: false, adminTapCount: 0, adminTimer: null,
    daysSinceLastVisit: 0, showReturnNudge: false,
    showFreeValue: false,
  },
  onShow() {
    this.loadAll()
    analytics.track('home_visit')
  },
  onUnload() { clearTimeout(this.data.adminTimer); analytics.flush() },

  async loadAll() {
    try {
      const db = wx.cloud.database()
      const openid = app.globalData.openid
      if (!openid) return
      const [userRes, insightRes] = await Promise.all([
        db.collection('users').where({ openid }).limit(1).get(),
        db.collection('insights').where({ status: 'published' }).orderBy('createdAt', 'desc').limit(1).get(),
      ])
      const user = userRes.data[0] || {}
      const insight = insightRes.data[0] || null
      const cv = user.cv || 0
      this.setData({
        user,
        insight,
        cvPercent: Math.min(100, Math.round(cv % 100)),
        streak: user.streak || 0,
        loading: false,
        showFreeValue: !(user.membershipLevel && user.membershipLevel !== 'free'),
      })
    } catch (_) {
      this.setData({ loading: false })
    }
  },

  // ═══ 导航 ═══

  async goStrategy() {
    analytics.track('strategy_start')
    this.setData({ strategyLoading: true })
    // 诊断模式直接跳转 challenge-play，无需先调 startChallenge
    wx.navigateTo({ url:'/pages/challenge-play/challenge-play?mode=diagnostic' })
    this.setData({ strategyLoading: false })
  },

  goChallenge()   { analytics.track('challenge_start'); wx.switchTab({ url:'/pages/challenge-start/challenge-start' }) },
  goWorldRules()  { wx.navigateTo({ url:'/pages/world-rules/world-rules' }) },
  goMembership()  { analytics.track('membership_visit'); wx.navigateTo({ url:'/pages/membership/membership' }) },
  goProfile()     { wx.switchTab({ url:'/pages/profile/profile' }) },
  goReports()     { wx.navigateTo({ url:'/pages/report-preview/report-preview' }) },
  goInvite()      { wx.navigateTo({ url:'/pages/invite/invite' }) },
  goRanking()     { wx.navigateTo({ url:'/pages/growth-ranking/growth-ranking' }) },
  goAIChat()      { wx.switchTab({ url:'/pages/ai-chat/ai-chat' }) },
  goDaily()       { wx.navigateTo({ url:'/pages/cognition-daily/cognition-daily' }) },

  onQuickAsk(e)  {
    const q = e.currentTarget.dataset.q
    if (!q) return
    // 💉 随机人格注入
    const personality = getRandomPersonality()
    console.log('[home] 场景快捷提问:', q, '| 人格:', personality.name)
    analytics.track('quick_ask', { topic: q, personality: personality.name })
    app.globalData._quickAskTopic = q
    app.globalData._quickAskPersonality = personality
    wx.switchTab({ url:'/pages/ai-chat/ai-chat' })
  },

  // ════════════════════════════════════════
  //  每日认知暴击 — navigateTo 独立详情页
  // ════════════════════════════════════════

  onStrikeTap() {
    analytics.track('strike_tap')
    const strike = getTodayStrike()
    const id = strike.id || ''
    wx.navigateTo({
      url: `/subpkg-ai/cognitive-shock-detail/cognitive-shock-detail?id=${id}`
    })
  },

  // ═══ 其他 ═══

  onTapVersion() {
    const count = this.data.adminTapCount + 1
    this.setData({ adminTapCount: count })
    clearTimeout(this.data.adminTimer)
    if (count >= 5) {
      this.setData({ adminTapCount: 0 })
      wx.cloud.callFunction({ name:'adminCheckAccess', data:{} }).then(r => {
        if (r.result?.code === 0) wx.navigateTo({ url:'/pages/admin/dashboard/dashboard' })
        else wx.showToast({ title:'无管理员权限', icon:'none' })
      })
    } else {
      this.data.adminTimer = setTimeout(() => this.setData({ adminTapCount: 0 }), 2000)
    }
  },

  onShareAppMessage() {
    const strike = getTodayStrike()
    const tip = strike.core_strike ? `💥 ${strike.core_strike.substring(0, 30)}...` : '用底层逻辑探索你的认知密码'
    return { title: tip, path: '/pages/splash/splash' }
  },
})
