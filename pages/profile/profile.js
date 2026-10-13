/**
 * pages/profile — 成长档案 v3.1 (Part 6)
 *
 * RC8.9_P0_PROFILE_AUTHORITY — server-authoritative counts.
 *   challengeCount : challenge_records{openid} (server)
 *   reportCount     : ai_reports{openid} (server) — local 6Q history is secondary
 *                     compatibility ONLY and never overrides a non-zero server count.
 *   paidReportCount : ai_reports{openid, isPaid:true} (server)
 *   Auth identity   : app.globalData.openid (login authority). Missing openid →
 *                     explicit load-error state, never a silent false zero.
 */
const app = getApp()
const analytics = require('../../utils/analytics.js')
const { worldModelTypeLabel } = require('../../utils/worldModelLabels.js')

// 未分类 / 未知展示占位（绝不显示裸 enum 'unclassified'，绝不把未知当真实 0）
const UNKNOWN = '—'

// RC8_13_P0_MEMBER_ENTRY — 会员展示态。
//   权威：getMembership（服务端 memberships 表）。未知/失败态绝不伪装为 free。
function resolveMemberDisplay (memberState, expiryText, errText) {
  const state = memberState || 'unknown'
  if (state === 'unknown') {
    return {
      memberBadge: '⭐', memberDisplayTitle: '我的会员',
      memberDisplaySubtitle: '正在同步会员状态',
      memberStateLabel: '同步中', memberStateClass: 'unknown', memberIsPaid: false,
    }
  }
  if (state === 'free') {
    return {
      memberBadge: '⭐', memberDisplayTitle: '升级会员',
      memberDisplaySubtitle: '解锁完整认知操作系统',
      memberStateLabel: '未开通', memberStateClass: 'free', memberIsPaid: false,
    }
  }
  if (state === 'expired') {
    return {
      memberBadge: '⭐', memberDisplayTitle: '会员已到期',
      memberDisplaySubtitle: '查看续费选项',
      memberStateLabel: '已到期', memberStateClass: 'expired', memberIsPaid: false,
    }
  }
  if (state === 'monthly' || state === 'yearly' || state === 'quarterly') {
    const nameMap = { monthly: '认知会员 · 月卡', yearly: '认知会员 · 年卡', quarterly: '认知会员 · 季卡' }
    const sub = expiryText ? ('有效期至 ' + expiryText) : (errText || '会员生效中')
    return {
      memberBadge: '⭐', memberDisplayTitle: nameMap[state] || '认知会员',
      memberDisplaySubtitle: sub,
      memberStateLabel: '生效中', memberStateClass: 'active', memberIsPaid: true,
    }
  }
  return {
    memberBadge: '⭐', memberDisplayTitle: '我的会员',
    memberDisplaySubtitle: errText || '正在同步会员状态',
    memberStateLabel: '同步中', memberStateClass: 'unknown', memberIsPaid: false,
  }
}

function fmtExpiry (ts) {
  const n = Number(ts)
  if (!n || !isFinite(n)) return ''
  const d = new Date(n + 8 * 3600 * 1000)
  const p = (x) => String(x).padStart(2, '0')
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate())
}

Page({
  data: {
    user: {}, profile: {}, isVip: false,
    // 服务端权威计数。null = 未知/未加载（展示 '—'）；数字 = 真实计数（含 0）。
    challengeCount: null, reportCount: null, reportTotalRecords: null, paidReportCount: null,
    badges: [], streak: null,
    classificationLabel: '',
    cvText: UNKNOWN, streakText: UNKNOWN, cvNextText: UNKNOWN,
    countsLoaded: false, loadError: false, countsError: false,
    adminTapCount: 0, adminTimer: null,
    memoryEnabled: true,
    // RC8_13_P0_MEMBER_ENTRY —— 会员展示态（服务端 getMembership 权威）
    memberState: 'unknown', memberExpiryText: '', memberErrText: '',
    memberBadge: '⭐', memberDisplayTitle: '我的会员',
    memberDisplaySubtitle: '正在同步会员状态',
    memberStateLabel: '同步中', memberStateClass: 'unknown', memberIsPaid: false,
  },
  onShow() { this.loadData() },
  onUnload() { analytics.flush() },

  async loadData() {
    const gd = (app && app.globalData) || {}
    const user = gd.userInfo || {}
    const profile = gd.profile || {}

    // ── 字段级权威 ──
    // cv：users 文档中的真实字段（存在即权威）。缺失 → '—'（未知，绝不伪造 0）。
    const cvText = (user && typeof user.cv === 'number') ? String(user.cv) : UNKNOWN
    // streak：服务端 users 模式无此字段 → 未知，展示 '—'（绝不伪造 0）。
    const streakText = (user && user.streak !== undefined && user.streak !== null) ? String(user.streak) : UNKNOWN

    this.setData({
      user,
      profile,
      isVip: user.membershipLevel !== 'free',   // 会员权威 = 登录/profile 缓存（canonical）
      streak: streakText === UNKNOWN ? null : user.streak,
      cvText,
      streakText,
      cvNextText: (typeof user.cv === 'number') ? String(user.cv % 100) + '/100' : UNKNOWN,
      classificationLabel: this._resolveClassificationLabel(profile),
    })
    // 加载记忆开关状态（best-effort，但不静默吞错）
    try {
      const mRes = await wx.cloud.callFunction({ name: 'getMemory' })
      this.setData({ memoryEnabled: mRes.result?.data?.memoryEnabled !== false })
      this._maybeShowMemoryNotice()
    } catch (err) {
      console.warn('[profile] getMemory failed:', err && err.message)
    }

    // RC8_13_P0_MEMBER_ENTRY —— 服务端会员态（权威）；未知/失败绝不伪装为 free。
    await this.loadMemberState()

    // 服务端权威计数 —— 必须使用已认证 openid（绝不以空 openid 查询）
    const openid = gd.openid || ''
    if (!openid) {
      console.error('[profile] openid missing — authoritative data unavailable')
      this.setData({
        countsLoaded: false, loadError: true, countsError: true,
        challengeCount: null, reportCount: null, reportTotalRecords: null, paidReportCount: null,
      })
      return
    }

    try {
      // 服务端权威统计（identity 由 getWXContext().OPENID 解析；客户端直读 DB 已废弃）
      const statsRes = await wx.cloud.callFunction({ name: 'getProfileStats', data: {} })
      const stats = (statsRes && statsRes.result) || {}
      if (stats.code !== 0 || !stats.data || !stats.data.counts) {
        throw new Error((stats && stats.message) || 'getProfileStats failed')
      }
      const c = stats.data.counts
      const n = (v) => (typeof v === 'number' ? v : 0)

      // 徽章（非权威外观集合；失败不影响计数）
      let badges = []
      try {
        const db = wx.cloud.database()
        const bRes = await db.collection('badges').limit(10).get()
        const earned = (profile && profile.badges) || []
        badges = (bRes.data || []).map(b => ({ ...b, unlocked: earned.includes(b.id || b._id) }))
      } catch (err) {
        console.warn('[profile] badges load failed:', err && err.message)
      }

      // 分类：画像 mainType（若已被权威填写）否则服务端最新已完成挑战 finalType
      // （两者均通过既有 canonical 映射 worldModelLabels，无客户端臆造）
      const classificationLabel = this._resolveClassificationLabel(profile, stats.data.latestFinishedType)

      this.setData({
        challengeCount: n(c.challengeCount),
        reportCount: n(c.reportCount),
        reportTotalRecords: n(c.reportTotalRecords),
        paidReportCount: n(c.paidReportCount),
        classificationLabel,
        badges,
        countsLoaded: true,
        loadError: false,
        countsError: false,
      })
    } catch (err) {
      // 显式失败：不静默吞零。保留上一次有效计数；若从未加载则计数保持 null（展示 '—'）。
      console.error('[profile] getProfileStats failed:', err && err.message)
      this.setData({ countsLoaded: false, loadError: true, countsError: true })
    }
  },

  // 分类标签：绝不显示裸 enum 'unclassified'。
  // 优先级：画像 mainType（非 unclassified）> 最近权威 finalType > 中性兜底。
  _resolveClassificationLabel(profile, finalType) {
    const mainType = profile && profile.mainType
    if (mainType && mainType !== 'unclassified') return worldModelTypeLabel(mainType)
    if (finalType) return worldModelTypeLabel(finalType)
    return ''   // 无权威结果 → 交由 UI 使用中性兜底（绝不显示 'unclassified'）
  },

  goDaily()       { wx.navigateTo({ url: '/pages/cognition-strike-records/cognition-strike-records' }) },
  goRules()       { wx.navigateTo({ url: '/pages/world-rules/world-rules?favorites=1' }) },
  goChallenges()  { wx.navigateTo({ url: '/pages/challenge-records/challenge-records' }) },
  goReports()     { wx.navigateTo({ url: '/pages/report-history/report-history' }) },
  // ── RC8_13_P0_MEMBER_ENTRY —— 会员态服务端权威 ──
  //   权威：getMembership（memberships 表）。优先级 active_membership > legacy_permanent > free。
  //   绝不从客户端缓存/仅 AI 免限推断会员；不修改会员记录；不手工发放权益。
  async loadMemberState() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getMembership', data: {} })
      const r = (res && res.result) || {}
      if (r.code !== 0) throw new Error((r && r.message) || 'getMembership failed')
      this._applyMemberState(r.data || {})
    } catch (err) {
      console.warn('[profile] getMembership failed:', err && err.message)
      this._applyMemberState(null, '会员状态同步失败')
    }
  },

  _applyMemberState(d, errText) {
    let state = 'unknown'
    let expiryText = ''
    if (d) {
      const m = d.membership
      if (d.isActive && m && (m.status === 'active')) {
        const lv = m.level
        state = (lv === 'monthly' || lv === 'yearly' || lv === 'quarterly') ? lv : 'monthly'
        expiryText = fmtExpiry(m.expiredAt)
      } else if (m && m.status === 'expired') {
        state = 'expired'
      } else {
        state = 'free'
      }
    }
    const disp = resolveMemberDisplay(state, expiryText, errText)
    const patch = {
      memberState: state,
      memberExpiryText: expiryText,
      memberErrText: errText || '',
      memberBadge: disp.memberBadge,
      memberDisplayTitle: disp.memberDisplayTitle,
      memberDisplaySubtitle: disp.memberDisplaySubtitle,
      memberStateLabel: disp.memberStateLabel,
      memberStateClass: disp.memberStateClass,
      memberIsPaid: disp.memberIsPaid,
    }
    // 仅在服务端明确判定时同步 isVip；unknown 不强制改动（不误报 free）。
    if (state === 'monthly' || state === 'yearly' || state === 'quarterly') patch.isVip = true
    else if (state === 'free' || state === 'expired') patch.isVip = false
    this.setData(patch)
  },

  goMembership() {
    const s = this.data.memberState
    if (s === 'monthly' || s === 'yearly' || s === 'quarterly') {
      // ACTIVE_* → 会员详情（不进入购买，不强制复购）
      wx.navigateTo({ url: '/pages/membership-center/membership-center' })
      return
    }
    if (s === 'free' || s === 'expired') {
      // FREE / EXPIRED → 会员购买/续费页
      wx.navigateTo({ url: '/pages/membership/membership?source=profile' })
      return
    }
    // LOADING_OR_UNKNOWN → 先刷新服务端会员态，再路由（刷新后仍未知则安全进入购买页）
    this.loadMemberState().then(() => {
      const s2 = this.data.memberState
      if (s2 === 'monthly' || s2 === 'yearly' || s2 === 'quarterly') {
        wx.navigateTo({ url: '/pages/membership-center/membership-center' })
      } else {
        wx.navigateTo({ url: '/pages/membership/membership?source=profile' })
      }
    })
  },
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
        } catch (err) {
          console.warn('[profile] memoryNotice persist failed:', err && err.message)
        }
      },
    })
  },

  // 记忆开关：切换 = 持久化权威设置（绝不删除任何数据）。
  // 立即更新 UI；持久化失败则回滚到上一个权威值（绝不留下“UI 开/后端关”的不一致）。
  async onToggleMemory(e) {
    const enabled = e.detail.value
    const prev = this.data.memoryEnabled
    this.setData({ memoryEnabled: enabled })          // 立即反馈
    try {
      const res = await wx.cloud.callFunction({ name: 'toggleMemory', data: { enabled } })
      if (!res || !res.result || res.result.code !== 0) {
        throw new Error((res && res.result && res.result.message) || 'toggleMemory failed')
      }
      this.setData({ memoryEnabled: enabled })        // 权威确认
      wx.showToast({ title: enabled ? '记忆已开启' : '记忆已关闭', icon: 'none' })
    } catch (err) {
      console.warn('[profile] toggleMemory persist failed:', err && err.message)
      this.setData({ memoryEnabled: prev })           // 回滚（权威未变）
      wx.showToast({ title: '设置失败，请重试', icon: 'none' })
    }
  },

  // 清除记忆：与开关分离的显式破坏性操作，仅限记忆域数据，需二次确认。
  // 服务端 clearMemory 默认只清 user_memory/conversation_memory/behavior_memory/
  // growth_memory/cognition_memory，绝不触碰挑战/报告/订单/权益。
  onClearMemory() {
    wx.showModal({
      title: '清除全部记忆',
      content: '将清除小事哥对你的记忆记录（长期记忆、对话摘要、成长轨迹等）。\n\n你的挑战记录、世界模型报告、订单与已购权益不受影响。此操作不可恢复。',
      confirmText: '确认清除',
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const r = await wx.cloud.callFunction({ name: 'clearMemory', data: {} })
          if (!r || !r.result || r.result.code !== 0) {
            throw new Error((r && r.result && r.result.message) || 'clearMemory failed')
          }
          wx.showToast({ title: '记忆已清除', icon: 'success' })
        } catch (err) {
          console.warn('[profile] clearMemory failed:', err && err.message)
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
    } catch (err) {
      console.warn('[profile] adminCheckAccess failed:', err && err.message)
    }
  },
})
