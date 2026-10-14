/**
 * pages/challenge-records — RC8.13_P0_HISTORY_LIST_SERVER_AUTHORITY_FIX
 *
 * 「挑战记录」列表：消费**服务端权威**列表 API（getChallengeRecords）。
 *   - 身份由服务端 getWXContext().OPENID 解析；客户端不再直读数据库
 *     （直读无 `_openid` 的 private 集合会被安全规则拒绝 → 曾被误判为「暂无记录」）。
 *   - total ≡ profile.challengeCount（共用 canonical challengeListability 口径）。
 *   - 状态归一化：processing=进行中（可续玩）、finished=已完成（看结果）。
 *   - 明确区分 加载中 / 空 / 错误 / 未授权；查询失败绝不渲染「暂无挑战记录」。
 *
 * 只读展示，不改挑战系统。
 */

const challengeService = require('../../services/challengeService.js')

const DAY_LIMIT = 30 // 产品为 30 天挑战；绝不展示 > 30 的天数

function fmtDate (t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

Page({
  data: {
    records: [],
    loading: true,
    loadError: false,       // 服务端查询失败（可重试）
    unauthorized: false,    // 身份缺失/失效
    empty: false,           // 服务端确认 total===0
    status: 'loading',      // loading | success | empty | error | unauthorized
  },

  onShow () {
    this.load()
  },

  async load () {
    this.setData({ loading: true, loadError: false, unauthorized: false, empty: false, status: 'loading' })
    try {
      const r = await challengeService.getChallengeRecords({ pageSize: 100 })
      if (!r || typeof r.code !== 'number') {
        throw new Error('invalid response')
      }
      if (r.code === 401) {
        this.setData({ records: [], loading: false, unauthorized: true, status: 'unauthorized' })
        return
      }
      if (r.code !== 0 || !r.data) {
        throw new Error((r && r.message) || 'getChallengeRecords failed')
      }
      const items = Array.isArray(r.data.items) ? r.data.items : []
      const records = items.map((it) => {
        const day = (typeof it.day === 'number' && it.day > 0) ? Math.min(it.day, DAY_LIMIT) : 0
        return {
          recordId: it.recordId || '',
          status: it.status || 'unknown',
          statusText: it.statusText || (it.status === 'processing' ? '进行中' : (it.status === 'finished' ? '已完成' : '未知')),
          statusCls: it.status === 'processing' ? 'status-processing' : (it.status === 'finished' ? 'status-finished' : ''),
          dateText: fmtDate(it.startedAt || it.finishedAt),
          dayText: day ? `第 ${day} 天` : '',
          typeText: it.finalType || '',
          action: it.action || 'none',
        }
      })
      // EMPTY 仅当服务端确认 total===0（而非「本次 items 为空但仍有更多页」）
      const total = (typeof r.data.total === 'number') ? r.data.total : records.length
      if (total === 0) {
        this.setData({ records: [], loading: false, empty: true, status: 'empty' })
      } else {
        this.setData({ records, loading: false, status: 'success' })
      }
    } catch (e) {
      // 查询失败：绝不静默降级为空列表/本地数据
      console.warn('[challenge-records] load fail:', e && e.message)
      this.setData({ records: [], loading: false, loadError: true, status: 'error' })
    }
  },

  onRetry () { this.load() },

  onTapRecord (e) {
    const recordId = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    if (!recordId) return
    // 服务端权威动作：processing → 续玩；finished → 结果页
    if (status === 'processing') {
      wx.navigateTo({
        url: '/pages/challenge-play/challenge-play?mode=challenge&recordId=' + encodeURIComponent(recordId),
        fail: (err) => {
          console.warn('[challenge-records] navigateTo play fail:', err)
          wx.showToast({ title: '页面暂不可用', icon: 'none' })
        },
      })
      return
    }
    wx.navigateTo({
      url: '/pages/challenge-result/challenge-result?recordId=' + encodeURIComponent(recordId),
      fail: (err) => {
        console.warn('[challenge-records] navigateTo result fail:', err)
        wx.showToast({ title: '页面暂不可用', icon: 'none' })
      },
    })
  },

  onBack () { wx.navigateBack({ delta: 1 }) },
})
