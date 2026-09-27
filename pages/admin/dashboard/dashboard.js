/**
 * pages/admin/dashboard — 后台首页数据总览（RC8.9A 浅色重构）
 */
const adminService = require('../../../services/adminService.js')

Page({
  data: { stats: null, loading: true, error: '' },
  onLoad() { this.fetch() },
  onPullDownRefresh() { this.fetch().finally(() => wx.stopPullDownRefresh()) },
  retry() { this.fetch() },
  async fetch() {
    this.setData({ loading: true, error: '' })
    try {
      const r = await adminService.getDashboard()
      if (r.code !== 0) {
        wx.showToast({ title: r.message || '加载失败', icon: 'none' })
        this.setData({ error: r.message || '加载失败' })
      } else {
        this.setData({ stats: this._formatStats(r.data) })
      }
    } catch (_) {
      // 网络异常：保持页面可交互，由 finally 统一收起 loading
      this.setData({ error: '网络异常，请重试' })
    } finally {
      this.setData({ loading: false })
    }
  },
  _formatStats(s) {
    if (!s) return s
    const rt = s.aiRuntime || {}
    const today = s.today || {}
    const totalCalls = rt.totalCalls || 0
    const fallbacks = rt.fallbacks || 0
    const priced = rt.pricedCallCount || 0
    const unpriced = rt.unpricedCallCount || 0
    // RC8.9D_R1 — 规范漏斗（canonical）：独立用户计数 + 北京日 + 完整性标记。
    const fn = s.funnel || {}
    const fst = fn.stages || {}
    const pv = (fst.paymentView && fst.paymentView.count) || 0
    return {
      ...s,
      // wxml 消费的数组形态（向后兼容别名 s.funnelStages）
      funnel: s.funnelStages || s.funnel,
      funnelCountUnitNote: fn.countUnit === 'unique_users' ? '去重用户' : '',
      funnelTimezone: fn.timezone || 'Asia/Shanghai',
      funnelIntegrity: s.funnelIntegrity,
      funnelWarn: s.funnelIntegrity === false,
      funnelViolations: s.funnelViolations || [],
      // 6Q 当前路径无付款入口 → 阶段 5/6 为 0 属正常，显式中性说明（不伪造转化）
      paymentNeutral: pv === 0,
      paymentNeutralNote: '当前路径暂无付款入口',
      totalRevenueYuan: ((s.totalRevenue || 0) / 100).toFixed(0),
      todayRevenueYuan: ((s.todayRevenue || 0) / 100).toFixed(0),
      // RC8.9C R1B — 今日 与 累计 严格分离
      todayAiCalls: today.aiCalls || 0,
      cumulativeAiCalls: totalCalls,
      // 估算成本：仅已计价 v2 调用求和；无任何定价数据 → '--'（绝不伪造 ¥0）
      costText: this._fmtCost(rt.estimatedCostCny, priced),
      costNote: (priced > 0 && unpriced > 0) ? '部分调用未计价' : '',
      // 错误率：0 样本 → '--'（绝不显示 0.0%）
      errorRateText: rt.errorRate || '--',
      failuresText: rt.failedCalls || 0,
      breakdown: rt.breakdown || {},
      avgLatencyMs: rt.avgLatencyMs,
      avgLatencyText: (typeof rt.avgLatencyMs === 'number' && isFinite(rt.avgLatencyMs)) ? (rt.avgLatencyMs + 'ms') : '--',
      // RC8.9B_P0 — 规则兜底显式展示/占比
      aiFallbacks: fallbacks,
      fallbackRate: totalCalls > 0 ? ((fallbacks / totalCalls) * 100).toFixed(1) + '%' : '0%',
    }
  },
  _fmtCost(v, priced) {
    if (!priced || typeof v !== 'number' || !isFinite(v) || v < 0) return '--'
    if (v === 0) return '¥0.00'
    const s = v >= 1 ? v.toFixed(2) : v.toFixed(4)
    if (v > 0 && Number(s) === 0) return '¥' + v.toFixed(6) // 极小但有价值 → 不显示为 ¥0
    return '¥' + s
  },
  navTo(e) {
    const p = e.currentTarget.dataset.page
    wx.navigateTo({ url: '/pages/admin/' + p + '/' + p })
  },
  navToUser(e) {
    const openid = e.currentTarget.dataset.openid
    if (openid) wx.navigateTo({ url: '/pages/admin/user-detail/user-detail?openid=' + encodeURIComponent(openid) })
  },
})
