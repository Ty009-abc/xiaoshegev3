/**
 * pages/cognition-strike-records — RC8.8_MY_PAGE_FUNCTION_RECOVERY_B
 *
 * 认知暴击记录：读取本地「收藏的认知暴击」列表（canonical key: strike_collection）。
 * 产品含义 = 用户主动收藏/留下的认知暴击记录（不是浏览历史）。
 *
 * 只读 + 跳转最新详情页：不做 AI 调用，不做后端改动。
 * 旧 /pages/cognition-daily 不再是本入口目标。
 */

const STRIKE_COLLECTION_KEY = 'strike_collection'
const STRIKE_COLLECTION_KEY_LEGACY = 'strikecollection' // 兼容历史可能的无下划线写法

function fmtTime (t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  // 日期锚定 id（YYYYMMDD）单独展示更友好
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`
}

function loadRecords () {
  let list = []
  try {
    const raw = wx.getStorageSync(STRIKE_COLLECTION_KEY)
    if (Array.isArray(raw) && raw.length) list = raw
  } catch (_) {}
  // 一次性兼容迁移：历史无下划线 key → canonical（旧 key 保留不删）
  if (!list.length) {
    try {
      const legacy = wx.getStorageSync(STRIKE_COLLECTION_KEY_LEGACY)
      if (Array.isArray(legacy) && legacy.length) {
        list = legacy
        try { wx.setStorageSync(STRIKE_COLLECTION_KEY, legacy) } catch (_) {}
      }
    } catch (_) {}
  }
  return list
}

Page({
  data: {
    records: [],
    loading: true,
  },

  onShow () {
    const raw = loadRecords()
    const records = raw
      .filter((r) => r && r.id)
      .map((r) => ({
        id: r.id,
        title: r.title || '',
        time: r.time || '',
        timeText: fmtTime(r.time),
      }))
    this.setData({ records, loading: false })
  },

  onTapRecord (e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    // 详情页：STRIKE_0xx → ?sid=，日期锚定 id → ?id=
    const isPool = /^STRIKE_/i.test(id)
    const url = isPool
      ? `/subpkg-ai/cognitive-shock-detail/cognitive-shock-detail?sid=${id}`
      : `/subpkg-ai/cognitive-shock-detail/cognitive-shock-detail?id=${id}`
    wx.navigateTo({
      url,
      fail: (err) => {
        console.warn('[strike-records] navigateTo fail:', err)
        wx.showToast({ title: '页面暂不可用', icon: 'none' })
      },
    })
  },

  onBack () { wx.navigateBack({ delta: 1 }) },
})
