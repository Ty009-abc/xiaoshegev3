/**
 * pages/admin/user-detail — RC8.9B 用户详情（只读）
 *
 * 显示单个用户的 Basic / Usage / Monetization + 行为时间线(User Journey)。
 * 隐私：默认 masked OpenID；完整 OpenID 仅在 hasRawPermission 时可按需揭示。
 * 不展示任何支付密钥 / nonce / 签名。
 */
const adminService = require('../../../services/adminService.js')

function fmt(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 事件 → dot 颜色（成功绿 / 失败红 / 降级橙 / 其它信息蓝）
function dotFor(name) {
  if (name === 'report_success' || name === 'payment_success' || name === 'questionnaire_complete') return 'ok'
  if (name === 'report_fail' || name === 'payment_fail') return 'err'
  if (name === 'report_fallback') return 'warn'
  return 'info'
}

Page({
  data: {
    loading: true, error: '', detail: {}, showRaw: false,
    canReveal: false, paidYuan: '0',
  },
  onLoad(opt) {
    this._openid = decodeURIComponent(opt.openid || '')
    this.fetch()
  },
  onPullDownRefresh() { this.fetch().finally(() => wx.stopPullDownRefresh()) },
  retry() { this.fetch() },
  navToReport(e) {
    const reportId = e.currentTarget.dataset.reportid
    if (reportId) wx.navigateTo({ url: '/pages/admin/report-detail/report-detail?reportId=' + encodeURIComponent(reportId) })
  },
  async fetch() {
    if (!this._openid) { this.setData({ loading: false, error: '缺少用户标识' }); return }
    this.setData({ loading: true, error: '' })
    try {
      const r = await adminService.getUserDetail(this._openid, this.data.showRaw)
      if (r.code !== 0) {
        this.setData({ error: r.message || '加载失败' })
        return
      }
      const d = r.data || {}
      d.timeline = (d.timeline || []).map(e => ({ ...e, timeText: fmt(e.timestamp), dot: dotFor(e.eventName) }))
      const totalPaid = (d.monetization && d.monetization.totalPaid) || 0
      // 完整 OpenID 展示权限：仅当后端在 includeRawOpenid=true 时返回 openid 才允许揭示
      this.setData({
        detail: d,
        paidYuan: (totalPaid / 100).toFixed(2),
        canReveal: !!d.openid,
      })
    } catch (_) {
      this.setData({ error: '网络异常，请重试' })
    } finally {
      this.setData({ loading: false })
    }
  },
  async toggleRaw() {
    const showRaw = !this.data.showRaw
    this.setData({ showRaw })
    await this.fetch()
    // 保持用户点击前的显示意图
    this.setData({ showRaw })
  },
})
