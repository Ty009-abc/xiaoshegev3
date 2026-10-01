/**
 * pages/ai-chat - AI 对话页 v3.16（RC8_11_STAGE2D_FOLLOWUP_FLOW_UI_STABILITY）
 * - 回答后展示 3 条【同一决策线程】的追问（主：服务端 contextual）
 * - 无回答时用 100 题库的 3 条起始问题（fallback）
 * - 追问归属（ownership）：每条追问集只属于「最新一条 AI 回答」，
 *   点击任一追问立即作废上一组，避免新旧两代追问混在一起
 * - 追问固定渲染在滚动内容内（答案下方），不悬浮、不覆盖答案
 * - 免费额度：今日免费还可问 X 次；3 次用完后弹会员付费墙
 * - 付费墙：月卡 vip_month_39_9 / 年卡 vip_year_299（无 ¥9.9/¥39.9/¥99 独立 CTA）
 */
const app = getApp()
const { pickQuestions } = require('../../data/aiChatSuggestions.js')
const ownership = require('./followupOwnership.js')
const userTrack = require('../../utils/userTrack.js')

Page({
  data: {
    messages: [],
    inputValue: '',
    sending: false,
    scrollTop: 0,
    scrollIntoView: '',
    starters: [],          // 起始问题（100 题库 fallback，仅在无回答时展示）
    startQuestionTexts: [],
    // ── 追问归属（ownership）──────────────────────────────
    activeFollowUps: [],          // 仅当前「最新回答」拥有的追问
    activeFollowUpParentId: '',   // 该追问集所属的 assistant 消息 id
    activeFollowUpGenerationId: '',// 该追问集所属的代际 id
    followUpAnchorId: '',         // topicAnchorId（同一话题锚）
    followUpLoading: false,       // 点击追问后、新答案返回前的加载态
    followUpVisible: false,       // 是否处于「答案已完成、可展示追问」态
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
    this._seq = 0
    this._generationId = ''
    userTrack.event('qa_open')
    this.setData({
      messages: [{
        id: ownership.messageId(++this._seq),
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
        // 重置对话线程与追问归属（避免上一线程的追问串入新线程）
        this.setData({
          messages: [{ id: ownership.messageId(++this._seq), role: 'assistant', content: `正在以「${personality?.name || '认知教练'}」视角分析「${topic}」...` }],
          activeFollowUps: [],
          activeFollowUpParentId: '',
          activeFollowUpGenerationId: '',
          followUpAnchorId: '',
          followUpVisible: false,
        }, () => {
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

  // ── 点击追问：立即作废上一组 → 追加用户消息 → 进入加载态 ──
  onSelectFollowUp(e) {
    // §E 快速连点防护：加载/发送中直接忽略，避免重复请求与重复提问
    if (this.data.followUpLoading || this.data.sending) return
    const q = e.currentTarget.dataset.q
    if (!q) return
    userTrack.event('qa_follow_up_tap')
    // STATE_B IMMEDIATE —— 同步清空旧追问集（Q2/Q3 不再残留），再发送
    this.setData(Object.assign({ inputValue: q }, ownership.invalidateOnTap()), () => this.onSend())
  },

  onQuickAsk(e) {
    if (this.data.sending) return
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

    const userMsg = { id: ownership.messageId(++this._seq), role: 'user', content: text }
    const msgs = [...this.data.messages, userMsg]
    // 发送即进入加载态；追问区随 sending/loading 一起隐藏，任何旧追问都不会与结果同屏
    this.setData(Object.assign({ messages: msgs, inputValue: '', sending: true, scrollIntoView: userMsg.id }, ownership.invalidateOnTap()))
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
      // 回答与追问都为空；付费墙不得与任何旧追问混排
      if (code === 10006 || (r.result?.data && r.result.data.quotaExhausted)) {
        this.setData(Object.assign({}, ownership.invalidateOnTap(), {
          messages: msgs,
          sending: false,
          followUpLoading: false,
          remaining: 0,
          isMember: false,
          quotaKnown: true,
          showPaywall: true,
          paywall: r.result?.data?.paywall || null,
          scrollIntoView: userMsg.id,
        }))
        userTrack.event('qa_quota_exhausted')
        return
      }

      if (code !== 0) {
        console.error('[ai-chat] 云函数返回错误码:', code)
        const errMsg = { id: ownership.messageId(++this._seq), role: 'assistant', content: '信号不太好，再问一次？' }
        this.setData(Object.assign({}, ownership.invalidateOnTap(), { messages: [...msgs, errMsg], sending: false, followUpLoading: false, scrollIntoView: errMsg.id }))
        return
      }

      const resultData = r.result?.data
      const replyText = typeof resultData === 'string'
        ? resultData
        : (resultData?.content || resultData?.summary?.oneSentence || '换个说法试试？')
      const quota = resultData && resultData.quota

      // STATE_C —— 新答案：先追加并完成渲染，再把「精确 3 条」追问绑定到这条回答
      const genId = ownership.genId('gen')
      this._generationId = genId
      const complete = ownership.completeFollowUps(
        (resultData && resultData.followUps) || [],
        { scenario, topicAnchorId: (resultData && resultData.topicAnchorId) || '', selectedText: text }
      )
      const assistantMsg = { id: ownership.messageId(++this._seq), role: 'assistant', content: replyText }
      const msgsWithAnswer = [...msgs, assistantMsg]

      this.setData(Object.assign({
        sending: false,
        isMember: quota ? !!quota.isMember : this.data.isMember,
        remaining: quota && !quota.isMember ? quota.remaining : (quota && quota.isMember ? null : this.data.remaining),
        limit: quota?.limit || this.data.limit,
        quotaKnown: true,
        scrollIntoView: assistantMsg.id,
      }, ownership.stampFollowUps(msgsWithAnswer, complete, genId)))
    } catch (e) {
      console.error('[ai-chat] 崩溃', e)
      const errMsg = { id: ownership.messageId(++this._seq), role: 'assistant', content: '信号不太好，再问一次？' }
      this.setData(Object.assign({}, ownership.invalidateOnTap(), { messages: [...msgs, errMsg], sending: false, followUpLoading: false, scrollIntoView: errMsg.id }))
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
