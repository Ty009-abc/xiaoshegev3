/**
 * pages/ai-chat - AI 对话页 v3.14
 * - 100 题高质量问题池
 * - 每次随机推荐 6 条（不同分类）
 * - 支持换一批
 */
const app = getApp()
const { pickQuestions } = require('../../data/aiChatSuggestions.js')

Page({
  data: {
    messages: [],
    inputValue: '',
    sending: false,
    scrollTop: 0,
    displayQuestions: [],
    lastQuestionTexts: [],
  },

  onLoad() {
    this._firstLoad = true
    this.setData({
      messages: [{
        role: 'assistant',
        content: '我是小事哥。一个用概率、赌场逻辑和认知科学帮你翻身的 AI。\n\n你可以问我任何关于财富、决策、世界规则的问题。\n\n或者直接说「分析我的认知模型」——我来帮你做一次诊断。',
      }],
    })
    this._refreshQuestions()
    this._maybeShowMemoryNotice()
  },

  onShow() {
    const topic = app.globalData._quickAskTopic
    const personality = app.globalData._quickAskPersonality
    if (topic) {
      app.globalData._quickAskTopic = null
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
    this.setData({ sending: false, inputValue: '' })
  },

  _refreshQuestions() {
    try {
      const questions = pickQuestions(6, this.data.lastQuestionTexts)
      const texts = questions.map(q => q.text)
      console.log('[AIQuickQuestionsRuntime]', {
        source: 'data/aiChatSuggestions.js',
        totalQuestionCount: 100,
        selectedCount: questions.length,
        selectedIds: questions.map(q => q.text.substring(0, 20)),
        loadError: null,
        fallbackUsed: false,
        fallbackReason: '',
      })
      this.setData({
        displayQuestions: questions,
        lastQuestionTexts: texts,
      })
    } catch (err) {
      console.error('[AIQuickQuestionsRuntime] fail', err)
      this.setData({
        displayQuestions: [],
        loadError: '推荐问题加载失败',
      })
    }
  },

  onRefreshQuestions() {
    this._refreshQuestions()
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

    try {
      const personality = this._pendingPersonality
      this._pendingPersonality = null
      const payload = {
        type: 'coaching',
        message: text,
        ...(personality ? { personality: personality.name, personalityEmoji: personality.emoji, personalityStyle: personality.style } : {}),
      }

      const r = await wx.cloud.callFunction({ name: 'generateAiReport', data: payload })

      if (r.result?.code !== 0) {
        console.error('[ai-chat] 云函数返回错误码:', r.result?.code)
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

      this.setData({
        messages: [...msgs, { role: 'assistant', content: replyText }],
        sending: false,
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

  onShareAppMessage() {
    return { title: '珠澳小事哥 · AI认知教练', path: '/pages/splash/splash' }
  },
})
