/**
 * pages/report-history/report-history — RC8.13_P0_HISTORY_LIST_SERVER_AUTHORITY_FIX
 *
 * 「我的报告」列表：消费**服务端权威**列表 API（getReportHistory）。
 *   - 身份由服务端 getWXContext().OPENID 解析；客户端不再直读数据库
 *     （直读无 `_openid` 的 private 集合会被安全规则拒绝 → 曾静默回退本地）。
 *   - total ≡ profile.reportCount（共用 canonical reportVisibility 口径）。
 *   - 每个服务端项都有 canonical 详情路由（challenge_final→report-preview；
 *     legacy6q→legacy6q-report 本地交接）；每个 count 项都可打开。
 *   - 明确区分 加载中 / 空 / 错误 / 未授权；服务端失败绝不静默回退本地，
 *     也绝不以空列表伪装成「暂无报告」。
 *
 * 本地历史（legacy6q_report_history）= 设备本地补充，仅在**服务端确认零**时
 * 可选展示，且明确标注为本机记录，绝不并入服务端 total，不暗示服务端权益。
 */

const reportHistory = require('../../utils/reportHistory.js')
const aiReportService = require('../../services/aiReportService.js')
const app = getApp()

function fmtDate (t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function preview (text) {
  const s = String(text || '')
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}

Page({
  data: {
    reports: [],
    loading: true,
    loadError: false,       // 服务端查询失败（可重试）
    unauthorized: false,    // 身份缺失/失效
    empty: false,           // 服务端确认 total===0
    localOnly: false,       // 当前展示为设备本地记录（服务器确认零时的补充）
    status: 'loading',      // loading | success | empty | error | unauthorized
  },

  onShow () {
    this.load()
  },

  async load () {
    this.setData({ loading: true, loadError: false, unauthorized: false, empty: false, localOnly: false, status: 'loading' })
    this._rawById = {}
    try {
      const r = await aiReportService.getReportHistory({ pageSize: 50 })
      if (!r || typeof r.code !== 'number') {
        throw new Error('invalid response')
      }
      if (r.code === 401) {
        // 未授权：不展示本地历史（不得以本地数据掩盖身份失败）
        this.setData({ reports: [], loading: false, unauthorized: true, status: 'unauthorized' })
        return
      }
      if (r.code !== 0 || !r.data) {
        throw new Error((r && r.message) || 'getReportHistory failed')
      }
      const items = Array.isArray(r.data.items) ? r.data.items : []
      const reports = []
      for (const it of items) {
        const id = it.id || it.reportId || ''
        if (!id) continue
        this._rawById[id] = it
        reports.push({
          id,
          kind: it.kind || '',
          recordId: it.recordId || '',
          dateText: it.dateText || fmtDate(it.createdAt),
          title: it.title || '认知报告',
          preview: it.preview || '',
          local: false,
        })
      }
      const total = (typeof r.data.total === 'number') ? r.data.total : reports.length
      if (total === 0) {
        // 服务端确认零：完成态，非错误、非加载。
        const local = this._localRecords()
        this.setData({
          reports: local,
          localOnly: local.length > 0,
          loading: false,
          empty: local.length === 0,
          status: 'empty',
        })
      } else {
        this.setData({ reports, loading: false, status: 'success' })
      }
    } catch (e) {
      // 查询失败：绝不静默回退本地、绝不伪装为空
      console.warn('[report-history] server load fail:', e && e.message)
      this.setData({ reports: [], loading: false, loadError: true, status: 'error' })
    }
  },

  onRetry () { this.load() },

  // 设备本地 6Q 记录（仅服务端确认零时的补充展示；明确标注本机）
  _localRecords () {
    try {
      return reportHistory.list().map((r) => ({
        id: r.id,
        kind: 'legacy6q',
        recordId: '',
        dateText: fmtDate(r.createdAt),
        title: r.persona || '认知报告',
        preview: preview((r.report && r.report.fatal_sentence) || ''),
        local: true,
      }))
    } catch (_) { return [] }
  },

  onTapReport (e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const item = this.data.reports.find((r) => r.id === id)
    if (!item) return

    if (item.kind === 'challenge_final' || item.recordId) {
      if (!item.recordId) { wx.showToast({ title: '报告暂不可用', icon: 'none' }); return }
      wx.navigateTo({
        url: '/pages/report-preview/report-preview?recordId=' + encodeURIComponent(item.recordId) + '&type=challenge_final',
        fail: (err) => { console.warn('[report-history] navigateTo fail:', err); wx.showToast({ title: '页面暂不可用', icon: 'none' }) },
      })
      return
    }

    // legacy6q：优先用服务端随项返回的规范化载荷；否则本地记录载荷。均无 → 明确报错。
    const raw = (this._rawById && this._rawById[id]) || null
    const payload = (raw && raw.payload) || (reportHistory.get(id) && reportHistory.get(id).report) || null
    if (!payload || (!payload.fatal_sentence && !payload.system_trap)) {
      wx.showToast({ title: '报告内容已不可用', icon: 'none' })
      return
    }
    app.globalData._legacy6qReport = payload
    app.globalData._legacy6qReportRequestId = id
    app.globalData._legacy6qReportAt = (raw && raw.createdAt) || Date.now()
    wx.navigateTo({
      url: '/pages/legacy6q-report/legacy6q-report?mode=history',
      fail: (err) => { console.warn('[report-history] navigateTo fail:', err); wx.showToast({ title: '页面暂不可用', icon: 'none' }) },
    })
  },

  onBack () { wx.navigateBack({ delta: 1 }) },
})
