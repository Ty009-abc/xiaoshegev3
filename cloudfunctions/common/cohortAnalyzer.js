/**
 * cloudfunctions/common/cohortAnalyzer.js — 同期群分析（第五册 Part 6）
 *
 * 按用户注册月份分组：
 *   D30 收入 / D90 收入 / 续费率 / LTV
 *
 * 回答：
 *   新用户质量是否在变差？
 *   哪个月的用户最值钱？
 */
const now = () => Date.now()
const ONE_DAY = 86400000

// ═══════════════════════════
// analyzeCohorts — 核心分析
// ═══════════════════════════

async function analyzeCohorts(db, options = {}) {
  const { months = 6 } = options
  const ts = now()

  // 生成最近 N 个月的月份列表
  const monthKeys = []
  for (let i = 0; i < months; i++) {
    const d = new Date(ts - i * 30 * ONE_DAY)
    monthKeys.push(d.toISOString().slice(0, 7))
  }

  try {
    // 获取所有用户
    const users = await db.collection('users').limit(1000).get().catch(() => ({ data: [] }))

    // 按注册月份分组
    const byCohort = {}
    users.data.forEach(u => {
      if (!u.createdAt) return
      const cohortMonth = new Date(u.createdAt).toISOString().slice(0, 7)
      if (!monthKeys.includes(cohortMonth) && monthKeys.length > 0) return // 跳过太早的

      if (!byCohort[cohortMonth]) byCohort[cohortMonth] = { users: [], openids: [] }
      byCohort[cohortMonth].users.push(u)
      byCohort[cohortMonth].openids.push(u.openid)
    })

    const cohorts = []

    for (const [cohortMonth, data] of Object.entries(byCohort).sort()) {
      const openids = data.openids
      const cohortSize = openids.length
      if (cohortSize === 0) continue

      // D30 收入（注册后30天内）
      const cohortStart = new Date(cohortMonth + '-01').getTime()
      const d30End = cohortStart + 30 * ONE_DAY

      const d30Orders = await db.collection('orders')
        .where({
          openid: db.command.in(openids),
          status: 'paid',
          createdAt: db.command.gte(cohortStart).and(db.command.lte(d30End)),
        })
        .get().catch(() => ({ data: [] }))

      const d30Revenue = d30Orders.data.reduce((s, o) => s + (o.amount || 0), 0)
      const d30PayingUsers = [...new Set(d30Orders.data.map(o => o.openid))].length

      // D90 收入
      const d90End = cohortStart + 90 * ONE_DAY
      const d90Orders = await db.collection('orders')
        .where({
          openid: db.command.in(openids),
          status: 'paid',
          createdAt: db.command.gte(cohortStart).and(db.command.lte(d90End)),
        })
        .get().catch(() => ({ data: [] }))

      const d90Revenue = d90Orders.data.reduce((s, o) => s + (o.amount || 0), 0)
      const d90PayingUsers = [...new Set(d90Orders.data.map(o => o.openid))].length

      // 续费率（购买了会员且后来续费的）
      const membersInCohort = await db.collection('memberships')
        .where({
          openid: db.command.in(openids),
          status: db.command.in(['active', 'expired']),
        })
        .get().catch(() => ({ data: [] }))

      const renewed = membersInCohort.data.filter(m => (m.renewCount || 0) > 0).length
      const totalMembers = membersInCohort.data.length
      const renewalRate = totalMembers > 0 ? Math.round((renewed / totalMembers) * 10000) / 100 : 0

      // 活跃率 (D90 内至少活跃一次)
      const d90Active = await db.collection('funnel_events')
        .where({
          openid: db.command.in(openids),
          timestamp: db.command.gte(cohortStart).and(db.command.lte(d90End)),
        })
        .count().then(r => r.total).catch(() => 0)
      const activeRate = cohortSize > 0 ? Math.round((d90Active / cohortSize) * 10000) / 100 : 0

      // ARPU
      const arpu = cohortSize > 0 ? Math.round(d90Revenue / cohortSize) : 0

      cohorts.push({
        cohortMonth,
        cohortSize,
        d30: {
          revenue: d30Revenue,
          revenueYuan: (d30Revenue / 100).toFixed(2),
          payingUsers: d30PayingUsers,
          payRate: cohortSize > 0 ? Math.round((d30PayingUsers / cohortSize) * 10000) / 100 : 0,
        },
        d90: {
          revenue: d90Revenue,
          revenueYuan: (d90Revenue / 100).toFixed(2),
          payingUsers: d90PayingUsers,
          payRate: cohortSize > 0 ? Math.round((d90PayingUsers / cohortSize) * 10000) / 100 : 0,
        },
        renewalRate,
        activeRate,
        arpu,
        arpuYuan: (arpu / 100).toFixed(2),
        ltv: arpu * (1 + (renewalRate / 100)),
        ltvYuan: ((arpu * (1 + (renewalRate / 100))) / 100).toFixed(2),
      })
    }

    // 趋势分析
    const trend = _analyzeCohortTrend(cohorts)

    return { cohorts, trend, totalCohorts: cohorts.length, analysedAt: ts }
  } catch (err) {
    console.error('[cohortAnalyzer] analyzeCohorts 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// compareCohorts — 同期群对比
// ═══════════════════════════

async function compareCohorts(db, cohortA, cohortB) {
  const cohorts = await analyzeCohorts(db, { months: 12 })
  if (cohorts.error) return cohorts

  const a = cohorts.cohorts.find(c => c.cohortMonth === cohortA)
  const b = cohorts.cohorts.find(c => c.cohortMonth === cohortB)

  if (!a || !b) return { error: '找不到指定的同期群' }

  return {
    cohortA: { month: cohortA, d30Revenue: a.d30.revenueYuan, d90Revenue: a.d90.revenueYuan, payRate: a.d30.payRate, renewalRate: a.renewalRate },
    cohortB: { month: cohortB, d30Revenue: b.d30.revenueYuan, d90Revenue: b.d90.revenueYuan, payRate: b.d30.payRate, renewalRate: b.renewalRate },
    comparison: {
      d30RevenueChange: b.d30.revenue - a.d30.revenue,
      d30RevenueChangePercent: a.d30.revenue > 0 ? Math.round(((b.d30.revenue - a.d30.revenue) / a.d30.revenue) * 10000) / 100 : 0,
      payRateChange: Math.round((b.d30.payRate - a.d30.payRate) * 100) / 100,
      renewalRateChange: Math.round((b.renewalRate - a.renewalRate) * 100) / 100,
    },
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

function _analyzeCohortTrend(cohorts) {
  if (cohorts.length < 2) return { direction: 'insufficient_data', detail: '需要至少 2 个同期群' }

  const recent = cohorts.slice(-3)
  const older = cohorts.slice(0, Math.max(1, cohorts.length - 3))

  const recentAvgPayRate = recent.reduce((s, c) => s + c.d30.payRate, 0) / recent.length
  const olderAvgPayRate = older.reduce((s, c) => s + c.d30.payRate, 0) / older.length

  const recentAvgLTV = recent.reduce((s, c) => s + c.ltv, 0) / recent.length
  const olderAvgLTV = older.reduce((s, c) => s + c.ltv, 0) / older.length

  const direction = recentAvgPayRate > olderAvgPayRate * 1.05 ? 'improving'
    : recentAvgPayRate < olderAvgPayRate * 0.95 ? 'declining'
    : 'stable'

  return {
    direction,
    detail: direction === 'improving' ? '近期用户付费率上升 → 产品在优化'
      : direction === 'declining' ? '近期用户付费率下降 → 需要关注获客质量'
      : '用户质量稳定',
    recentAvgPayRate: Math.round(recentAvgPayRate * 100) / 100,
    olderAvgPayRate: Math.round(olderAvgPayRate * 100) / 100,
    recentAvgLTVYuan: (recentAvgLTV / 100).toFixed(2),
    olderAvgLTVYuan: (olderAvgLTV / 100).toFixed(2),
  }
}

module.exports = {
  analyzeCohorts,
  compareCohorts,
}
