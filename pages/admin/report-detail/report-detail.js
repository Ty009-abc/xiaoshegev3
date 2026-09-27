/**
 * pages/admin/report-detail — RC8.9B 报告详情（只读历史快照）
 *
 * 展示用户当时实际收到的 5 卡片快照。绝不重算 / 不重新推理 / 不调 AI。
 * 数据完全来自 ai_reports 持久化内容（adminGetReportDetail）。
 */
const adminService = require('../../../services/adminService.js')

// 与用户侧 result 页一致的字段优先级，仅做展示映射（不改内容）
const SECTION_DEFS = [
  { key: 'fatal', label: '⚡ 致命一句话' },
  { key: 'core', label: '🎯 核心问题' },
  { key: 'trap', label: '🔍 系统困局' },
  { key: 'turnaround', label: '🚀 翻身路径' },
  { key: 'advice', label: '📋 行动建议' },
]

function fmt(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function buildSections(content) {
  const data = content || {}
  const fields = [
    data.fatal_sentence || '',
    data.core_problem || '',
    data.system_trap || '',
    data.turnaround_path || data.strategy_path || '',
    data.action_advice || (Array.isArray(data.advice) ? data.advice.join('\n') : (data.advice || '')),
  ]
  return SECTION_DEFS.map((s, i) => ({ key: s.key, label: s.label, text: fields[i] || '该维度无内容' }))
}

Page({
  data: {
    loading: true, error: '', detail: {}, sections: [], createdAtText: '',
  },
  onLoad(opt) {
    this._reportId = decodeURIComponent(opt.reportId || '')
    this.fetch()
  },
  onPullDownRefresh() { this.fetch().finally(() => wx.stopPullDownRefresh()) },
  async fetch() {
    if (!this._reportId) { this.setData({ loading: false, error: '缺少报告ID' }); return }
    this.setData({ loading: true, error: '' })
    try {
      const r = await adminService.getReportDetail(this._reportId)
      if (r.code !== 0) { this.setData({ error: r.message || '加载失败' }); return }
      const d = r.data || {}
      this.setData({
        detail: d,
        sections: buildSections(d.content),
        createdAtText: fmt(d.createdAt),
      })
    } catch (_) {
      this.setData({ error: '网络异常，请重试' })
    } finally {
      this.setData({ loading: false })
    }
  },
})
