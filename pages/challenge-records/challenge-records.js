/**
 * pages/challenge-records — RC8.8_MY_PAGE_FUNCTION_RECOVERY_C
 *
 * 「挑战记录」列表：读取 challenge_records（按 openid），展示日期/状态/进度，
 * 点击进入 challenge-result 详情。只读展示，不改挑战系统。
 *
 * 说明：与 challenge-ranking 一致，使用客户端直读 challenge_records
 * （database 权限允许按 openid 读取本人记录）。
 */

const app = getApp()

const STATUS_META = {
  processing: { text: '进行中', cls: 'status-processing' },
  finished: { text: '已完成', cls: 'status-finished' },
}

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
  },

  onShow () {
    this.load()
  },

  async load () {
    this.setData({ loading: true })
    const openid = (app.globalData && app.globalData.openid) || ''
    if (!openid) {
      this.setData({ records: [], loading: false })
      return
    }
    try {
      const db = wx.cloud.database()
      const res = await db.collection('challenge_records')
        .where({ openid })
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
      const records = (res.data || []).map((r) => {
        const meta = STATUS_META[r.status] || { text: r.status || '未知', cls: '' }
        return {
          recordId: r.recordId || '',
          dateText: fmtDate(r.startedAt || r.createdAt),
          statusText: meta.text,
          statusCls: meta.cls,
          dayText: r.currentDay ? `第 ${r.currentDay} 天` : '',
          typeText: r.finalType || '',
        }
      })
      this.setData({ records, loading: false })
    } catch (e) {
      console.warn('[challenge-records] load fail:', e)
      this.setData({ records: [], loading: false })
    }
  },

  onTapRecord (e) {
    const recordId = e.currentTarget.dataset.id
    if (!recordId) return
    wx.navigateTo({
      url: '/pages/challenge-result/challenge-result?recordId=' + encodeURIComponent(recordId),
      fail: (err) => {
        console.warn('[challenge-records] navigateTo fail:', err)
        wx.showToast({ title: '页面暂不可用', icon: 'none' })
      },
    })
  },

  onBack () { wx.navigateBack({ delta: 1 }) },
})
