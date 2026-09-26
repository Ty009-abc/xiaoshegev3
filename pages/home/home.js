/**
 * pages/home — v3.12 cognition-strike + personality injection
 */
const analytics = require('../../utils/analytics.js')
const { getTodayStrike } = require('../../utils/cognitionStrike.js')
const { getRandomPersonality } = require('../../utils/personalityModes.js')
const personalizedContent = require('../../services/personalizedContentService.js')
const cognitionEntry = require('../../utils/cognitionEntry.js')
const app = getApp()

// R78.2 — concise strike preview (visible product text only; never ids/codes).
function shortStrike(text) {
  const s = String(text || '')
  return s.length > 28 ? s.substring(0, 28) + '…' : s
}

Page({
  data: {
    user: {}, insight: null, loading: true, strategyLoading: false,
    cvPercent: 0, streak: 0, streakLost: false, adminTapCount: 0, adminTimer: null,
    daysSinceLastVisit: 0, showReturnNudge: false,
    showFreeValue: false,
    // R78.2 personalized strike (empty when not personalized → legacy look).
    strikePreview: '', strikeLabel: '', _strikeId: '',
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
      // R78.2 §4 — the previous `insights` read was NEVER consumed by home.wxml,
      // so it is replaced (not duplicated) by ONE personalization feed call.
      // Home stays at 2 network sources: users + feed.
      const [userRes, feed] = await Promise.all([
        db.collection('users').where({ openid }).limit(1).get(),
        personalizedContent.getFeed(),
      ])
      const user = userRes.data[0] || {}
      const cv = user.cv || 0
      // R78.2 §5/§6 — personalized strike when the feed is genuinely
      // profile-driven, otherwise keep the EXACT legacy look (no preview/label).
      let strikePreview = ''
      let strikeLabel = ''
      let strikeId = ''
      const picked = personalizedContent.pickStrike(feed)
      if (picked) {
        strikePreview = shortStrike(picked.strike.core_strike)
        strikeLabel = picked.label || ''
        strikeId = picked.id || ''
      }
      this.setData({
        user,
        insight: null,
        cvPercent: Math.min(100, Math.round(cv % 100)),
        streak: user.streak || 0,
        loading: false,
        showFreeValue: !(user.membershipLevel && user.membershipLevel !== 'free'),
        strikePreview: strikePreview,
        strikeLabel: strikeLabel,
        _strikeId: strikeId,
      })
    } catch (_) {
      this.setData({ loading: false })
    }
  },

  // ═══ 导航 ═══

  async goStrategy() {
    analytics.track('strategy_start')
    this.setData({ strategyLoading: true })
    // RC8.8 Stage2：主 CTA “开始翻身策略” 指向复活的 legacy 6Q 问卷。
    // Hybrid 10 屏 / V6 9 题 / legacy V4 10 题 / legacy 18 题页保留为可回滚参考
    // （LEGACY_FILES_DELETED = 0），不再是首页主入口。
    wx.navigateTo({ url:'/pages/turnaround-6q-questionnaire/turnaround-6q-questionnaire' })
    this.setData({ strategyLoading: false })
  },

  goChallenge()   { analytics.track('challenge_start'); wx.switchTab({ url:'/pages/challenge-start/challenge-start' }) },
  goWorldRules()  { cognitionEntry.openWorldRules() },
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
  //  每日认知暴击 — 共享导航权限（utils/cognitionEntry.js）
  //  结果页「每日认知」复用同一 handler，杜繝路由再次分叉
  // ════════════════════════════════════════

  onStrikeTap() {
    analytics.track('strike_tap')
    cognitionEntry.openCognitionStrike(this)
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
