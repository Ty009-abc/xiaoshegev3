/**
 * pages/membership-center — 会员中心（第五册 Part 5）
 *
 * 功能：
 *   1. 会员等级展示 + XP 进度条
 *   2. 每日签到 + Streak
 *   3. 会员权益列表
 *   4. 每周报告入口
 *   5. 续费提醒
 */
const app = getApp()
const analytics = require('../../utils/analytics.js')

Page({
  data: {
    profile: {},
    level: 'free', levelName: '观察者', levelBadge: '👀', levelColor: '#888',
    xp: 0, xpToNext: 100, xpPercent: 0,
    streak: 0, canCheckIn: true, checkedIn: false,
    perks: [],
    weeklyReport: null,
    daysUntilExpiry: 0, isExpiring: false, renewalPhase: null,
  },

  onLoad() { this.data._app = app; this.loadAll() },
  onShow() { this.loadAll() },
  onUnload() { analytics.flush() },

  async loadAll() {
    wx.showLoading({ title: '加载中' })
    try {
      // 用现有云函数 getMembership 获取基础数据
      const memberRes = await wx.cloud.callFunction({ name: 'getMembership' })
      const memberData = memberRes.result?.data || {}

      // 本地 globalData 同步
      const gd = app.globalData || {}
      const userInfo = gd.userInfo || {}
      this.setData({
        profile: { cv: userInfo.cv || 0, level: userInfo.level || 1, ...memberData },
        level: memberData.level || userInfo.membershipLevel || 'free',
        levelName: memberData.levelName || this._getLevelName(memberData.level || userInfo.membershipLevel || 'free'),
        levelBadge: memberData.levelBadge || '👀',
        levelColor: memberData.levelColor || '#888',
        xp: memberData.xp || 0,
        xpToNext: memberData.xpToNext || 100,
        xpPercent: memberData.xpPercent || 0,
        streak: memberData.streak || userInfo.streak || 0,
        perks: memberData.perks || [],
        daysUntilExpiry: memberData.daysUntilExpiry || 0,
        isExpiring: memberData.isExpiringWithin || false,
        renewalPhase: memberData.renewalPhase || null,
      })

      // 加载周报
      this.loadWeeklyReport()
    } catch (_) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
    wx.hideLoading()
  },

  async loadWeeklyReport() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getMembership',
        data: { action: 'weekly_report' },
      })
      if (res.result?.data?.report) {
        this.setData({ weeklyReport: res.result.data.report })
      }
    } catch (_) {}
  },

  async doCheckIn() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getMembership',
        data: { action: 'check_in' },
      })
      const data = res.result?.data || {}
      if (data.alreadyCheckedIn) {
        wx.showToast({ title: '今日已签到', icon: 'none' })
        return
      }
      this.setData({
        streak: data.streak || this.data.streak + 1,
        canCheckIn: false, checkedIn: true,
      })
      if (data.milestone) {
        wx.showToast({ title: `🏆 ${data.milestone.reward.title}！+${data.milestone.reward.xp}XP`, icon: 'none', duration: 2000 })
      } else {
        wx.showToast({ title: `签到成功！连续 ${data.streak} 天`, icon: 'success' })
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

  goMembership() {
    analytics.track('membership_view')
    wx.navigateTo({ url: '/pages/membership/membership' })
  },

  _getLevelName(level) {
    const names = { free: '观察者', report_buyer: '觉察者', vip: '认知升级者', yearly_vip: '系统操盘者', premium: '内圈成员' }
    return names[level] || '观察者'
  },
})
