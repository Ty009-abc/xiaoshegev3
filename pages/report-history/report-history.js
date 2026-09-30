/**
 * pages/report-history/report-history — 「我的报告」列表
 *
 * RC8_9_P0_PROFILE_DATA_CHAIN — 服务端权威。
 *   主来源：ai_reports{openid}（服务端权威，按 createdAt 倒序）。
 *   本地历史（legacy6q_report_history）= 次要兼容回退，仅当服务端为空/失败时使用。
 *   仅列出存在 canonical 渲染路由的报告（无死条目）：
 *     - challenge_final                     → /pages/report-preview?type=challenge_final&recordId=...
 *     - 诊断类（含 6Q 结果字段 fatal_sentence）→ /pages/legacy6q-report (globalData 交接，无 AI 调用)
 *   绝不在此发起任何 AI 调用。
 */

const reportHistory = require('../../utils/reportHistory.js')
const app = getApp()

const TITLE = {
  challenge_final: '世界模型报告',
  diagnostic: '认知诊断报告',
}

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

// 服务端报告 → 渲染方式（'' = 无 canonical 客户端路由 → 不列出，避免死条目）
function kindOf (r) {
  if (!r) return ''
  if (r.type === 'challenge_final') return r.recordId ? 'report_preview' : ''
  const c = r.content
  if (c && (c.fatal_sentence || c.system_trap)) return 'legacy6q'
  return ''
}

Page({
  data: {
    reports: [],
    loading: true,
    loadError: false,
  },

  onShow () {
    this.load()
  },

  async load () {
    this.setData({ loading: true })
    this._rawById = {}
    const openid = (app.globalData && app.globalData.openid) || ''
    if (!openid) {
      // 不以空 openid 查询；回退本地兼容历史（明确非服务端权威）
      console.warn('[report-history] openid missing — local compatibility history only')
      this._useLocal()
      this.setData({ loading: false, loadError: true })
      return
    }
    try {
      const db = wx.cloud.database()
      const res = await db.collection('ai_reports')
        .where({ openid })
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
      const rows = res.data || []
      const reports = []
      for (const r of rows) {
        const kind = kindOf(r)
        if (!kind) continue
        const id = r.reportId || r._id
        this._rawById[id] = r
        reports.push({
          id,
          kind,
          recordId: r.recordId || '',
          dateText: fmtDate(r.createdAt),
          title: TITLE[r.type] || (kind === 'legacy6q' ? '认知诊断报告' : '认知报告'),
          preview: preview((r.content && (r.content.oneSentence || r.content.fatal_sentence)) || ''),
        })
      }
      if (reports.length === 0) {
        this._useLocal()   // 服务端无可渲染 canonical 报告 → 本地兼容回退
      } else {
        this.setData({ reports, loadError: false })
      }
      this.setData({ loading: false })
    } catch (e) {
      console.warn('[report-history] authoritative load fail:', e)
      this._useLocal()
      this.setData({ loading: false, loadError: true })
    }
  },

  // 本地 canonical 历史（legacy6q_report_history）= 次要兼容回退
  _useLocal () {
    const list = reportHistory.list().map((r) => ({
      id: r.id,
      kind: 'legacy6q',
      recordId: '',
      dateText: fmtDate(r.createdAt),
      title: r.persona || '认知报告',
      preview: preview((r.report && r.report.fatal_sentence) || ''),
      summary: r.answersSummary || '',
    }))
    this.setData({ reports: list })
  },

  onTapReport (e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const item = this.data.reports.find((r) => r.id === id)
    if (!item) return

    if (item.kind === 'report_preview') {
      if (!item.recordId) { wx.showToast({ title: '报告暂不可用', icon: 'none' }); return }
      wx.navigateTo({
        url: '/pages/report-preview/report-preview?recordId=' + encodeURIComponent(item.recordId) + '&type=challenge_final',
        fail: (err) => { console.warn('[report-history] navigateTo fail:', err); wx.showToast({ title: '页面暂不可用', icon: 'none' }) },
      })
      return
    }

    // legacy6q：服务端 content 或本地历史 → 交接后渲染（无 AI 调用）
    const raw = (this._rawById && this._rawById[id])
    const payload = (raw && raw.content) || (reportHistory.get(id) && reportHistory.get(id).report)
    if (!payload) { wx.showToast({ title: '报告已不可用', icon: 'none' }); return }
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
