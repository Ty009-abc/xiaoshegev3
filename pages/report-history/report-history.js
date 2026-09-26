/**
 * pages/report-history/report-history — RC8.8_MY_PAGE_FUNCTION_RECOVERY_D3
 *
 * 「我的报告」列表：读取本地 canonical 报告历史（legacy6q_report_history）。
 * 展示 日期 / 人格 / Card01 致命一句话 预览；点击进入既有 6Q 结果页渲染器
 * （通过 globalData 交接同一份报告，不发起任何 AI 调用）。
 *
 * 旧 /pages/report-preview 保持不动（旧调用方兼容）。
 */

const reportHistory = require('../../utils/reportHistory.js')

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
  },

  onShow () {
    const list = reportHistory.list().map((r) => ({
      id: r.id,
      dateText: fmtDate(r.createdAt),
      persona: r.persona || '',
      summary: r.answersSummary || '',
      preview: preview((r.report && r.report.fatal_sentence) || ''),
    }))
    this.setData({ reports: list, loading: false })
  },

  onTapReport (e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const rec = reportHistory.get(id)
    if (!rec || !rec.report) { wx.showToast({ title: '报告已不可用', icon: 'none' }); return }
    // 复用既有 6Q 结果渲染器：把存储的报告交接过去（无 AI 调用）。
    const app = getApp()
    app.globalData._legacy6qReport = rec.report
    app.globalData._legacy6qReportRequestId = rec.id
    app.globalData._legacy6qReportAt = rec.createdAt
    wx.navigateTo({
      url: '/pages/legacy6q-report/legacy6q-report?mode=history',
      fail: (err) => {
        console.warn('[report-history] navigateTo fail:', err)
        wx.showToast({ title: '页面暂不可用', icon: 'none' })
      },
    })
  },

  onBack () { wx.navigateBack({ delta: 1 }) },
})
