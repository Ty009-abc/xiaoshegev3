/**
 * pages/ai-chat - AI 对话页
 */
const app = getApp()

Page({
  data: {
    messages: [],
    inputValue: '',
    sending: false,
    scrollTop: 0,
  },

  onLoad() {
    this._firstLoad = true
    this.setData({
      messages: [{
        role: 'assistant',
        content: '我是小事哥。一个用概率、赌场逻辑和认知科学帮你翻身的 AI。\n\n你可以问我任何关于财富、决策、世界规则的问题。\n\n或者直接说「分析我的认知模型」——我来帮你做一次诊断。',
      }],
    })
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
          // 将人格存入实例变量，onSend 时一并传递
          this._pendingPersonality = personality
          this.onSend()
        })
      })
    }
  },

  onUnload() {
    // 页面销毁时清理残留状态锁
    this.setData({ sending: false, inputValue: '' })
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
      // ═══ 暴力Debug：完整Payload（含人格注入） ═══
      const personality = this._pendingPersonality
      this._pendingPersonality = null
      const payload = {
        type: 'coaching',
        message: text,
        ...(personality ? { personality: personality.name, personalityEmoji: personality.emoji, personalityStyle: personality.style } : {}),
      }
      console.log('🔥 [PANIC-SEND] Payload:', JSON.stringify(payload))
      console.log('🔥 [PANIC-SEND] message typeof:', typeof text, 'length:', text.length, 'value:', text)

      const r = await wx.cloud.callFunction({ name: 'generateAiReport', data: payload })

      // ═══ 暴力Debug：完整云函数返回（不截断） ═══
      console.log('📡 [NET-SUCCESS] errMsg:', r.errMsg)
      console.log('📡 [NET-SUCCESS] result.code:', r.result?.code)
      console.log('📡 [NET-SUCCESS] result.message:', r.result?.message)
      console.log('📡 [NET-SUCCESS] result.data:', JSON.stringify(r.result?.data))

      // ═══ 核心修复：先检查 code！ ═══
      if (r.result?.code !== 0) {
        console.error('❌ [NET-FAIL] 云函数返回错误码:', r.result?.code, r.result?.message)
        this.setData({
          messages: [...msgs, { role: 'assistant', content: '信号不太好，再问一次？（' + (r.result?.code || '?') + '）' }],
          sending: false,
        })
        return
      }

      // coaching 分支返回 { code:0, data:{ content:'...' } }
      const resultData = r.result?.data
      console.log('🧩 [PARSE] resultData typeof:', typeof resultData)
      console.log('🧩 [PARSE] resultData keys:', resultData ? Object.keys(resultData).join(',') : 'NULL')

      const replyText = typeof resultData === 'string'
        ? resultData
        : (resultData?.content || resultData?.summary?.oneSentence || '换个说法试试？')

      console.log('📡 [FINAL] 最终回复文本:', (replyText || '').substring(0, 80))

      this.setData({
        messages: [...msgs, { role: 'assistant', content: replyText }],
        sending: false,
        scrollTop: 99999,
      })
    } catch (e) {
      console.error('🔥 [PANIC] 前端运行时代码崩溃：', e)
      console.error('🔥 [PANIC] error.name:', e.name)
      console.error('🔥 [PANIC] error.message:', e.message)
      console.error('🔥 [PANIC] error.stack:', e.stack)
      console.error('🔥 [PANIC] error 完整序列化:', JSON.stringify(e, Object.getOwnPropertyNames(e)))
      this.setData({
        messages: [...msgs, { role: 'assistant', content: '信号不太好，再问一次？' }],
        sending: false,
      })
    }
  },

  onQuickAsk(e) {
    const q = e.currentTarget.dataset.q
    this.setData({ inputValue: q }, () => this.onSend())
  },

  onShareAppMessage() {
    return { title: '珠澳小事哥 · AI认知教练', path: '/pages/splash/splash' }
  },
})
