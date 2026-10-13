/**
 * pages/membership-center — 会员中心（RC8_13_P0 真机重建）
 *
 * 职责：
 *   1. 认知会员身份卡（类型 + 生效中 + 服务端到期日）  ← 会员 authority = getMembership
 *   2. 认知成长（等级 + XP + 进度）                    ← 独立于会员；users.cv/level 权威
 *   3. 每日签到 + Streak                               ← 仅当服务端提供权威时展示，否则隐藏（绝不伪造）
 *   4. 本周成长报告入口                                ← 无数据 → 空态文案
 *   5. 我的会员权益（人类可读文案，绝不暴露权限码）      ← 仅展示实际已授予
 *   6. 底部 CTA 按会员态分流（已付费绝不出现升级/复购按钮）
 *
 * 权威原则：会员态一律来自服务端 getMembership；未知/失败绝不伪装为 free。
 *          认知成长来自 users.cv/level（缺省 → 未知，绝不伪造 0）。
 */
const app = getApp()
const analytics = require('../../utils/analytics.js')
const userTrack = require('../../utils/userTrack.js')
const rights = require('../../utils/membershipRights.js')

Page({
  data: {
    // 会员态（服务端权威）
    memberState: 'unknown',   // free | monthly | yearly | quarterly | expired | unknown
    active: false,
    memberType: '', memberTypeText: '', memberBadge: '',
    memberExpiryText: '', memberExpiryFull: '',
    hasExpiry: false,
    memberLoading: false, memberLoadError: false,

    // 记名/成长（独立于会员）
    cv: 0, hasCv: false, level: 1,
    cvLevelTitle: '认知探索者', cvPercent: 0, cvNextText: '', xpText: '—',

    // 签到（仅权威提供时展示）
    checkinEnabled: false, streak: 0, checkedIn: false,

    // 周报
    weeklyReport: null, weeklyLoading: false,

    // 权益（人类可读；来自服务端 permissions）
    rights: [],

    // 兼容旧字段（保留内部 raw，不渲染）
    levelName: '', levelBadge: '', levelColor: '',
  },

  onLoad() { this.data._app = app; this.loadAll() },
  onShow() { this.loadAll() },
  onBack() { wx.navigateBack({ delta: 1 }) },
  onUnload() { analytics.flush(); userTrack.flush() },

  async loadAll() {
    this.setData({ memberLoading: true, memberLoadError: false, weeklyLoading: true })
    await Promise.all([this.loadMember(), this.loadGrowth(), this.loadWeeklyReport()])
    this.setData({ memberLoading: false, weeklyLoading: false })
  },

  // ── 会员态：服务端权威 ──
  async loadMember() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getMembership', data: {} })
      const r = (res && res.result) || {}
      if (r.code !== 0) throw new Error((r && r.message) || 'getMembership failed')
      this._applyMember(r.data || {})
    } catch (err) {
      console.warn('[membership-center] getMembership failed:', err && err.message)
      this._applyMemberUnknown()
    }
  },

  _applyMember(d) {
    const m = (d && d.membership) || null
    const isActive = !!(d && d.isActive)
    if (isActive && m) {
      const lv = (m.level === 'yearly' || m.level === 'quarterly') ? m.level : 'monthly'
      const typeText = lv === 'yearly' ? '年卡' : lv === 'quarterly' ? '季卡' : '月卡'
      const exp = this._fmtExpiry(m.expiredAt)
      this.setData({
        memberState: lv, active: true,
        memberType: m.memberType || '', memberTypeText: typeText, memberBadge: '⭐',
        memberExpiryText: exp.date, memberExpiryFull: exp.full, hasExpiry: !!exp.full,
        rights: rights.memberRightsView(m.permissions || []),
        // 兼容旧字段
        levelName: '认知会员 · ' + typeText, levelBadge: '⭐', levelColor: '#8056DF',
        memberLoadError: !exp.full, // 权威会员缺到期日 → 显式失败态
      })
      return
    }
    if (m && m.status === 'expired') {
      this.setData({
        memberState: 'expired', active: false,
        memberType: m.memberType || '', memberTypeText: '', memberBadge: '⏳',
        memberExpiryText: '', memberExpiryFull: '', hasExpiry: false,
        rights: [], levelBadge: '⏳',
      })
      return
    }
    if (d && d.membership === null && d.isActive === false && !d.message) {
      // 服务端明确 free
      this.setData({
        memberState: 'free', active: false,
        memberType: '', memberTypeText: '', memberBadge: '⭐',
        rights: [], levelBadge: '👀',
      })
      return
    }
    // free（含 message=会员已过期 的空 membership 回落）
    this.setData({
      memberState: d && d.message ? 'expired' : 'free', active: false,
      memberType: '', memberTypeText: '', memberBadge: '⭐', rights: [], levelBadge: '👀',
    })
  },

  _applyMemberUnknown() {
    this.setData({
      memberState: 'unknown', active: false,
      memberLoadError: true, hasExpiry: false, memberExpiryText: '', memberExpiryFull: '',
      memberTypeText: '', memberBadge: '', rights: [],
    })
  },

  // ── 认知成长：独立于会员，users.cv/level 权威；未知 → '—' ──
  async loadGrowth() {
    const gd = (app && app.globalData) || {}
    const user = gd.userInfo || {}
    const hasCv = (user && typeof user.cv === 'number')
    const cv = hasCv ? user.cv : 0
    const level = (user && typeof user.level === 'number') ? user.level : 1
    const lvTitles = ['', '认知探索者', '思维破局者', '系统思考者', '深度分析者',
      '跨界洞察者', '认知架构师', '维度穿越者', '认知炼金师', '觉醒者']
    const cur = cv % 100
    const nextTitle = lvTitles[level + 1] || lvTitles[lvTitles.length - 1]
    this.setData({
      cv, hasCv, level,
      cvLevelTitle: lvTitles[level] || '认知探索者',
      cvPercent: hasCv ? Math.min(cur, 100) : 0,
      cvNextText: hasCv ? ('距「' + nextTitle + '」还需 ' + Math.max(100 - cur, 0) + ' CV') : '成长数据同步中',
      xpText: hasCv ? String(cv) : '—',
    })
    // 签到权威：仅当 users 提供 streak 字段才启用（服务端未提供 → 隐藏，绝不伪造）
    const hasStreak = (user && user.streak !== undefined && user.streak !== null)
    this.setData({ checkinEnabled: hasStreak, streak: hasStreak ? Number(user.streak) || 0 : 0 })
  },

  async loadWeeklyReport() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getMembership', data: { action: 'weekly_report' } })
      const report = res && res.result && res.result.data && res.result.data.report
      this.setData({ weeklyReport: report || null })
    } catch (_) {
      this.setData({ weeklyReport: null })
    }
  },

  async doCheckIn() {
    if (!this.data.checkinEnabled) return
    try {
      const res = await wx.cloud.callFunction({ name: 'getMembership', data: { action: 'check_in' } })
      const data = (res && res.result && res.result.data) || {}
      if (data.alreadyCheckedIn) { wx.showToast({ title: '今日已签到', icon: 'none' }); return }
      this.setData({ checkedIn: true, streak: data.streak || this.data.streak })
      if (data.milestone && data.milestone.reward) {
        wx.showToast({ title: '🏆 ' + data.milestone.reward.title + '！+' + data.milestone.reward.xp + 'XP', icon: 'none', duration: 2000 })
      } else {
        wx.showToast({ title: '签到成功！连续 ' + (data.streak || this.data.streak) + ' 天', icon: 'success' })
      }
      analytics.track('check_in')
    } catch (_) {
      wx.showToast({ title: '签到失败，请重试', icon: 'none' })
    }
  },

  goReport() {
    analytics.track('membership_weekly_report_view')
    wx.navigateTo({ url: '/pages/report-preview/report-preview' })
  },

  // 服务端权威重试
  retryMember() { this.loadAll() },

  // 已付费：滚动到页内「我的会员权益」（避免跳到同一购买页造成自导航/信息重复）
  onViewRights() {
    try {
      wx.pageScrollTo({ selector: '.rights-card', duration: 300, offsetTop: -160 })
    } catch (_) {
      // 兼容：不支持 selector 时按选择器类名节点查询后滚动
      const q = wx.createSelectorQuery && wx.createSelectorQuery()
      if (q) q.select('.rights-card').boundingClientRect((rect) => { if (rect) wx.pageScrollTo({ scrollTop: rect.top + (wx.getWindowInfo ? wx.getWindowInfo().scrollTop || 0 : 0) - 160, duration: 300 }) }).exec()
    }
  },

  // 免费/到期 → 会员购买/续费页；显式操作才分流
  goMembership() {
    wx.navigateTo({ url: '/pages/membership/membership' })
  },

  _fmtExpiry(ts) {
    const n = Number(ts)
    if (!n || !isFinite(n)) return { date: '', full: '' }
    const d = new Date(n + 8 * 3600 * 1000)
    const p = (x) => String(x).padStart(2, '0')
    const date = d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate())
    const full = date + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes())
    return { date, full }
  },
})
