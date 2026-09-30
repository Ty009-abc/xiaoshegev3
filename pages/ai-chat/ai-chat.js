/**
 * pages/ai-chat - AI 对话页 v3.15（RC8_11_STAGE2）
 * - 回答后展示 3 条【同一决策线程】的追问（主：服务端 contextual）
 * - 无回答时用 100 题库的 3 条起始问题（fallback）
 * - 免费额度：今日免费还可问 X 次；3 次用完后弹会员付费墙
 * - 付费墙：月卡 vip_month_39_9 / 年卡 vip_year_299（无 ¥9.9/¥39.9/¥99 独立 CTA）
 */
const app = getApp()
const { pickQuestions } = require('../../data/aiChatSuggestions.js')
const userTrack = require('../../utils/userTrack.js')

Page({
  data: {
    messages: [],
    inputValue: '',
    sending: false,
    scrollTop: 0,
    starters: [],          // 起始问题（100 题库 fallback，仅在无回答时展示）
    startQuestionTexts: [],
    followUps: [],         // 最近一次回答后的 3 条追问
    // 免费额度
    isMember: false,
    remaining: null,       // null = 未知/会员无限
    limit: 3,
    quotaKnown: false,
    // 付费墙
    showPaywall: false,
    paywall: null,
  },

  onLoad() {
    this._firstLoad = true
    userTrack.event('qa_open')
    this.setData({
      messages: [{
        role: 'assistant',
        content: '我是小事哥。一个用概率、赌场逻辑和认知科学帮你翻身的 AI。\n\n你可以问我任何关于财富、决策、世界规则的问题。\n\n或者直接说「分析我的认知模型」——我来帮你做一次诊断。',
      }],
    })
    this._refreshStarters()
    this._loadQuota()
    this._maybeShowMemoryNotice()
  },

  onShow() {
    const topic = app.globalData._quickAskTopic
    const personality = app.globalData._quickAskPersonality
    if (topic) {
      this._pendingScenario = app.globalData._quickAskScenario || ''
      app.globalData._quickAskTopic = null
      app.globalData._quickAskScenario = null
      app.globalData._quickAskPersonality = null
      const personalityTag = personality ? ` [${personality.emoji} ${personality.name}]` : ''
      console.log('[ai-chat] onShow 收到快捷提问话题:', topic, '| 人格:', personality?.name)
      this.setData({ inputValue: topic }, () => {
        this.setData({ messages: [{ role: 'assistant', content: `正在以「${personality?.name || '认知教练'}」视角分析「${topic}」...` }] }, () => {
          this._pendingPersonality = personality
          this.onSend()
        })
      })
    }
  },

  onUnload() {
    clearTimeout(this._sendTimer)
    this.setData({ sending: false, inputValue: '' })
  },

  // ── 起始问题（100 题库 fallback；仅在尚无回答时展示）──
  _refreshStarters() {
    try {
      const questions = pickQuestions(3, this.data.startQuestionTexts)
      const texts = questions.map(q => q.text)
      console.log('[AIQuickQuestionsRuntime]', {
        source: 'FALLBACK_BANK',
        totalQuestionCount: 100,
        selectedCount: questions.length,
        fallbackUsed: true,
      })
      this.setData({ starters: questions, startQuestionTexts: texts })
    } catch (err) {
      console.error('[AIQuickQuestionsRuntime] fail', err)
      this.setData({ starters: [] })
    }
  },

  onRefreshStarters() {
    this._refreshStarters()
  },

  // ── 免费额度（服务端权威；不消耗）──
  async _loadQuota() {
    try {
      const r = await wx.cloud.callFunction({ name: 'generateAiReport', data: { type: 'coaching', action: 'quota_status' } })
      const q = r.result?.data?.quota
      if (q) {
        this.setData({
          isMember: !!q.isMember,
          remaining: q.isMember ? null : (typeof q.remaining === 'number' ? q.remaining : null),
          limit: q.limit || 3,
          quotaKnown: true,
        })
      }
    } catch (_) {
      // 读不到就保持未知；真正发送时以服务端为准
    }
  },

  onSelectFollowUp(e) {
    const q = e.currentTarget.dataset.q
    if (!q) return
    userTrack.event('qa_follow_up_tap')
    this.setData({ inputValue: q }, () => this.onSend())
  },

  onQuickAsk(e) {
    const q = e.currentTarget.dataset.q
    if (!q) return
    this.setData({ inputValue: q }, () => this.onSend())
  },

  _maybeShowMemoryNotice() {
    const gd = getApp().globalData
    if (gd.userInfo?.memoryNoticeShown) return
    wx.showModal({
      title: '关于记忆',
      content: '为了让小事哥更懂你的认知轨迹，系统会保存你的成长记忆。\n\n你可以随时在个人中心关闭或清除。',
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

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  async onSend() {
    const text = this.data.inputValue.trim()
    if (!text || this.data.sending) return

    const msgs = [...this.data.messages, { role: 'user', content: text }]
    this.setData({ messages: msgs, inputValue: '', sending: true, scrollTop: 99999 })
    userTrack.event('qa_send')

    try {
      const personality = this._pendingPersonality
      this._pendingPersonality = null
      const scenario = this._pendingScenario || 'ask'
      this._pendingScenario = null
      const payload = {
        type: 'coaching',
        message: text,
        scenario,
        ...(personality ? { personality: personality.name, personalityEmoji: personality.emoji, personalityStyle: personality.style } : {}),
      }

      const r = await wx.cloud.callFunction({ name: 'generateAiReport', data: payload })
      const code = r.result?.code

      // ── 免费额度用完 → 会员付费墙（服务端 BLOCK，未调用模型）──
      if (code === 10006 || (r.result?.data && r.result.data.quotaExhausted)) {
        this.setData({
          messages: msgs,
          sending: false,
          followUps: [],
          remaining: 0,
          isMember: false,
          quotaKnown: true,
          showPaywall: true,
          paywall: r.result?.data?.paywall || null,
          scrollTop: 99999,
        })
        userTrack.event('qa_quota_exhausted')
        return
      }

      if (code !== 0) {
        console.error('[ai-chat] 云函数返回错误码:', code)
        this.setData({
          messages: [...msgs, { role: 'assistant', content: '信号不太好，再问一次？' }],
          sending: false,
        })
        return
      }

      const resultData = r.result?.data
      const replyText = typeof resultData === 'string'
        ? resultData
        : (resultData?.content || resultData?.summary?.oneSentence || '换个说法试试？')
      const followUps = (resultData && Array.isArray(resultData.followUps)) ? resultData.followUps : []
      const quota = resultData && resultData.quota

      this.setData({
        messages: [...msgs, { role: 'assistant', content: replyText }],
        sending: false,
        followUps,
        isMember: quota ? !!quota.isMember : this.data.isMember,
        remaining: quota && !quota.isMember ? quota.remaining : (quota && quota.isMember ? null : this.data.remaining),
        limit: quota?.limit || this.data.limit,
        quotaKnown: true,
        scrollTop: 99999,
      })
    } catch (e) {
      console.error('[ai-chat] 崩溃', e)
      this.setData({
        messages: [...msgs, { role: 'assistant', content: '信号不太好，再问一次？' }],
        sending: false,
      })
    }
  },

  // ── 会员付费墙 ──
  onGoMember(e) {
    const productId = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.productid) || 'vip_month_39_9'
    userTrack.event('qa_paywall_member_click', { productId })
    wx.navigateTo({ url: '/pages/membership/membership?source=ai_quota&productId=' + encodeURIComponent(productId) })
  },
  onClosePaywall() {
    this.setData({ showPaywall: false })
  },

  onShareAppMessage() {
    return { title: '珠澳小事哥 · AI认知教练', path: '/pages/splash/splash' }
  },
})
