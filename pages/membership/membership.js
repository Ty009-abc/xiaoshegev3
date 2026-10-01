/**
 * pages/membership/membership.js — 认知会员页（RC8_12 FREE_ONLY 审核冻结版）
 *
 * 本版本（FREE_ONLY）不提供任何虚拟商品/会员新售：
 *   - 无价格卡片、无购买按钮、无微信支付、无商品选择（RC8_12 审核合规）
 *   - 绝不因审核账号/环境差异而动态隐藏或重新打开（真实关闭，非审核规避）
 *   - 历史已购权益由服务端权威保留、本页只做展示，不参与放行判定
 *
 * 产品决策：本页仅保留「已有权益状态 / 产品能力说明 / 相关功能持续开放中」。
 * 购买路径已从正常用户旅程移除，深链 productId 不再触发任何下单。
 */
const userTrack = require('../../utils/userTrack.js')

Page({
  data: {
    source: '',
    // 已有权益（只读展示）
    entitlement: null,
    hasLegacy: false,
  },

  onLoad(opt) {
    // RC8_12：不再解析 productId/plan；任何深链（含带 productId 参数）
    // 都只进入「信息展示」态，不触发价格加载、不触发下单、不触发支付。
    const source = (opt && opt.source) || ''
    this.setData({ source })
    userTrack.event('membership_view', { source, mode: 'FREE_ONLY' })
    this._loadEntitlement()
  },

  async _loadEntitlement() {
    // 只读：历史权益状态展示（失败闭合，不编造）。
    try {
      const membershipService = require('../../services/membershipService.js')
      const r = await membershipService.getMembership()
      const d = (r && r.code === 0 && r.data) || null
      const legacy = !!(
        d && (
          (Array.isArray(d.sources) && d.sources.length > 0) ||
          (d.level && d.level !== 'free') ||
          (d.active === true)
        )
      )
      this.setData({ entitlement: d, hasLegacy: legacy })
    } catch (_) {
      this.setData({ entitlement: null, hasLegacy: false })
    }
  },

  onBack() {
    wx.navigateBack()
  },
})
