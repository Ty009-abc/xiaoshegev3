/**
 * cloudfunctions/common/attributionEngine.js — 渠道归因引擎（第六册 Part 1）
 *
 * 记录用户来源 + 渠道效果分析
 *
 * 5 大渠道：
 *   douyin / wechat / referral / organic / xiaohongshu
 *
 * 归因模型：
 *   first_touch — 首次接触渠道
 *   last_touch  — 最后接触渠道（默认用于付费归因）
 */
const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)
const ONE_DAY = 86400000

const ACQUISITION_SOURCES = ['douyin', 'wechat', 'referral', 'organic', 'xiaohongshu']

// ═══════════════════════════
// attribute — 用户来源归因
// ═══════════════════════════

async function attribute(db, { openid, source, event }) {
  if (!ACQUISITION_SOURCES.includes(source)) {
    return { error: `unknown source: ${source}`, valid: ACQUISITION_SOURCES }
  }

  const ts = now()

  // 如果是 mini_enter，记录为用户首次来源
  if (event === 'mini_enter') {
    const existing = await db.collection('users')
      .where({ openid })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))

    if (existing.data.length > 0) {
      const user = existing.data[0]
      // 只在首次进入时设置 acquisitionSource
      if (!user.acquisitionSource) {
        await db.collection('users').doc(user._id).update({
          data: { acquisitionSource: source, sourceAttributedAt: ts },
        })
      }
    }
  }

  // 记录归因事件
  try {
    await db.collection('acquisition_sources').add({
      data: {
        openid,
        source,
        event: event || 'unknown',
        date: _todayKey(ts),
        timestamp: ts,
        createdAt: ts,
      },
    })
  } catch (_) {}

  return { success: true, openid, source, event }
}

// ═══════════════════════════
// getChannelStats — 渠道效果统计
// ═══════════════════════════

async function getChannelStats(db, options = {}) {
  const { period = 'month' } = options
  const ts = now()
  const thisMonth = new Date(ts).toISOString().slice(0, 7)

  try {
    // 获取本月的 acquisition_sources
    const sources = await db.collection('acquisition_sources')
      .where({ date: db.command.gte(thisMonth + '-01') })
      .limit(1000)
      .get()
      .catch(() => ({ data: [] }))

    // 按渠道聚合：用户数 / 事件数
    const bySource = {}
    for (const s of sources.data) {
      if (!bySource[s.source]) {
        bySource[s.source] = { users: new Set(), events: 0, miniEnter: 0, shareClick: 0, inviteSuccess: 0 }
      }
      bySource[s.source].users.add(s.openid)
      bySource[s.source].events++
      if (s.event === 'mini_enter') bySource[s.source].miniEnter++
      if (s.event === 'share_click') bySource[s.source].shareClick++
      if (s.event === 'invite_success') bySource[s.source].inviteSuccess++
    }

    // 获取各渠道的付费
    const orders = await db.collection('orders')
      .where({ status: 'paid', date: db.command.gte(thisMonth + '-01') })
      .get()
      .catch(() => ({ data: [] }))

    // 获取用户 acquisitionSource
    const users = await db.collection('users')
      .where({ openid: db.command.in(orders.data.map(o => o.openid)) })
      .get()
      .catch(() => ({ data: [] }))

    const userSourceMap = {}
    users.data.forEach(u => { userSourceMap[u.openid] = u.acquisitionSource || 'organic' })

    // 按渠道聚合付费
    for (const source of Object.keys(bySource)) {
      bySource[source].revenue = 0
      bySource[source].payingUsers = 0
    }

    orders.data.forEach(o => {
      const src = userSourceMap[o.openid] || 'organic'
      if (!bySource[src]) {
        bySource[src] = { users: new Set(), events: 0, miniEnter: 0, shareClick: 0, inviteSuccess: 0, revenue: 0, payingUsers: 0 }
      }
      bySource[src].revenue += (o.amount || 0)
      bySource[src].payingUsers++
    })

    const totalUsers = Object.values(bySource).reduce((s, v) => s + v.users.size, 0)
    const totalRevenue = Object.values(bySource).reduce((s, v) => s + (v.revenue || 0), 0)

    const channels = Object.entries(bySource)
      .map(([source, data]) => ({
        source,
        users: data.users.size,
        userShare: totalUsers > 0 ? Math.round((data.users.size / totalUsers) * 10000) / 100 : 0,
        events: data.events,
        miniEnter: data.miniEnter,
        shareClicks: data.shareClick,
        inviteSuccess: data.inviteSuccess,
        revenue: data.revenue || 0,
        revenueYuan: ((data.revenue || 0) / 100).toFixed(2),
        revenueShare: totalRevenue > 0 ? Math.round(((data.revenue || 0) / totalRevenue) * 10000) / 100 : 0,
        payingUsers: data.payingUsers,
        arpu: data.users.size > 0 ? Math.round((data.revenue || 0) / data.users.size) : 0,
        arpuYuan: data.users.size > 0 ? ((data.revenue || 0) / data.users.size / 100).toFixed(2) : '0.00',
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return {
      period,
      totalUsers,
      totalRevenue,
      totalRevenueYuan: (totalRevenue / 100).toFixed(2),
      channels,
      bestChannel: channels[0]?.source || null,
      worstChannel: channels[channels.length - 1]?.source || null,
      recommendation: _generateChannelRecommendation(channels),
      analysedAt: ts,
    }
  } catch (err) {
    console.error('[attributionEngine] getChannelStats 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// getUserSource — 查询单个用户的来源
// ═══════════════════════════

async function getUserSource(db, openid) {
  try {
    const user = await db.collection('users')
      .where({ openid })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))

    if (user.data.length === 0) return { source: 'unknown' }

    return {
      openid,
      source: user.data[0].acquisitionSource || 'organic',
      attributedAt: user.data[0].sourceAttributedAt || null,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getSourceDistribution — 来源分布饼图数据
// ═══════════════════════════

async function getSourceDistribution(db) {
  try {
    const users = await db.collection('users')
      .limit(1000)
      .get()
      .catch(() => ({ data: [] }))

    const dist = {}
    users.data.forEach(u => {
      const src = u.acquisitionSource || 'unknown'
      dist[src] = (dist[src] || 0) + 1
    })

    const total = users.data.length
    const distribution = Object.entries(dist)
      .map(([source, count]) => ({
        source,
        count,
        share: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    return { total, distribution }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

function _generateChannelRecommendation(channels) {
  if (!channels.length) return '暂无数据'

  const best = channels[0]
  const worst = channels[channels.length - 1]

  const recommendations = []

  if (best.revenueShare > 60) {
    recommendations.push(`${best.source} 贡献了 ${best.revenueShare}% 收入，继续加倍投入`)
  }

  if (worst.revenueShare < 5 && worst.users > 10) {
    recommendations.push(`${worst.source} 用户量还行但收入占比 ${worst.revenueShare}%，检查内容是否匹配`)
  }

  const referral = channels.find(c => c.source === 'referral')
  if (referral && referral.inviteSuccess < 5 && referral.users > 20) {
    recommendations.push('推荐裂变用户量可以但邀请成功率偏低 → 优化分享卡片文案')
  }

  return recommendations.length > 0 ? recommendations.join('。') : '渠道分布健康，继续维持'
}

module.exports = {
  ACQUISITION_SOURCES,
  attribute,
  getChannelStats,
  getUserSource,
  getSourceDistribution,
}
