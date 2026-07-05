/**
 * cloudfunctions/common/revenueAnalyzer.js — 收入结构分析（第五册 Part 6）
 *
 * 职责：
 *   1. 收入结构拆解（首购 / 续费 / 咨询）
 *   2. 收入健康度评分
 *   3. 收入趋势对比（环比增长）
 *   4. 用户生命周期收入分析
 */
const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)
const ONE_DAY = 86400000

// ═══════════════════════════
// analyzeRevenueStructure — 收入结构分析
// ═══════════════════════════

async function analyzeRevenueStructure(db, options = {}) {
  const { period = 'month' } = options
  const ts = now()
  const thisMonth = new Date(ts).toISOString().slice(0, 7)

  try {
    const dateFilter = period === 'month' ? { date: db.command.gte(thisMonth + '-01') } : {}

    const orders = await db.collection('orders')
      .where({ status: 'paid', ...dateFilter })
      .get()
      .catch(() => ({ data: [] }))

    let firstPurchase = 0
    let renewal = 0
    let consulting = 0

    for (const o of orders.data) {
      const amt = o.amount || 0

      // 判断订单类型
      if (o.productId === 'CONSULT_001') {
        consulting += amt
        continue
      }

      // 检查是否是首购（该用户只有一个 paid order）
      const userOrders = orders.data.filter(oo => oo.openid === o.openid && oo.status === 'paid')
      if (userOrders.length === 1 && userOrders[0]._id === o._id) {
        firstPurchase += amt
      } else {
        renewal += amt
      }
    }

    const totalRevenue = firstPurchase + renewal + consulting
    const pct = (v) => totalRevenue > 0 ? Math.round((v / totalRevenue) * 10000) / 100 : 0

    const structure = {
      firstPurchase: { revenue: firstPurchase, share: pct(firstPurchase), revenueYuan: (firstPurchase / 100).toFixed(2) },
      renewal:       { revenue: renewal,       share: pct(renewal),       revenueYuan: (renewal / 100).toFixed(2) },
      consulting:    { revenue: consulting,     share: pct(consulting),    revenueYuan: (consulting / 100).toFixed(2) },
    }

    // 健康度评分
    const healthScore = _calculateHealthScore(structure)
    const healthStatus = healthScore >= 80 ? 'excellent' : healthScore >= 60 ? 'good' : healthScore >= 40 ? 'warning' : 'critical'

    // 建议
    const suggestions = _generateStructureSuggestions(structure, healthStatus)

    return {
      period,
      totalRevenue,
      totalRevenueYuan: (totalRevenue / 100).toFixed(2),
      structure,
      healthScore,
      healthStatus,
      idealStructure: { firstPurchase: 40, renewal: 40, consulting: 20 },
      suggestions,
      analysedAt: ts,
    }
  } catch (err) {
    console.error('[revenueAnalyzer] analyzeRevenueStructure 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// analyzeRevenueTrend — 收入趋势
// ═══════════════════════════

async function analyzeRevenueTrend(db, days = 7) {
  const ts = now()
  const dates = []
  for (let i = days - 1; i >= 0; i--) {
    dates.push(_todayKey(ts - i * ONE_DAY))
  }

  try {
    const metrics = await db.collection('revenue_metrics')
      .where({ date: db.command.in(dates) })
      .get()
      .catch(() => ({ data: [] }))

    const trend = dates.map(date => {
      const m = metrics.data.find(d => d.date === date) || {}
      return {
        date,
        grossRevenue: m.grossRevenue || 0,
        grossYuan: ((m.grossRevenue || 0) / 100).toFixed(2),
        orderCount: m.orderCount || 0,
        refundRate: m.refundRate || 0,
      }
    })

    // 环比增长
    const thisWeek = trend.slice(-3).reduce((s, t) => s + t.grossRevenue, 0)
    const lastWeek = trend.slice(0, Math.min(3, trend.length - 3)).reduce((s, t) => s + t.grossRevenue, 0)
    const growthRate = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 10000) / 100 : 0

    return {
      trend,
      thisWeekRevenue: thisWeek,
      lastWeekRevenue: lastWeek,
      growthRate,
      growthDirection: growthRate > 5 ? 'up' : growthRate < -5 ? 'down' : 'flat',
      analysedAt: ts,
    }
  } catch (err) {
    console.error('[revenueAnalyzer] analyzeRevenueTrend 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// analyzeRefund — 退款分析
// ═══════════════════════════

async function analyzeRefund(db, options = {}) {
  const { period = 'month' } = options
  const ts = now()
  const thisMonth = new Date(ts).toISOString().slice(0, 7)

  try {
    const dateFilter = period === 'month' ? { date: db.command.gte(thisMonth + '-01') } : {}

    const refundMetrics = await db.collection('refund_metrics')
      .where(dateFilter)
      .get()
      .catch(() => ({ data: [] }))

    const orders = await db.collection('orders')
      .where({ status: db.command.in(['paid', 'refunded']), ...dateFilter })
      .get()
      .catch(() => ({ data: [] }))

    const totalOrders = orders.data.filter(o => o.status === 'paid' || o.status === 'refunded').length
    const refundOrders = orders.data.filter(o => o.status === 'refunded')

    // 按商品拆
    const byProduct = {}
    refundOrders.forEach(o => {
      const pid = o.productId || 'unknown'
      if (!byProduct[pid]) byProduct[pid] = { count: 0, amount: 0, total: 0 }
      byProduct[pid].count++
      byProduct[pid].amount += (o.amount || 0)
    })

    // 计算每商品 total
    orders.data.forEach(o => {
      const pid = o.productId || 'unknown'
      if (byProduct[pid]) byProduct[pid].total++
    })

    const productRefund = Object.entries(byProduct).map(([pid, v]) => ({
      productId: pid,
      refundCount: v.count,
      refundAmount: v.amount,
      refundAmountYuan: (v.amount / 100).toFixed(2),
      totalOrders: v.total,
      refundRate: v.total > 0 ? Math.round((v.count / v.total) * 10000) / 100 : 0,
    })).sort((a, b) => b.refundRate - a.refundRate)

    const overallRefundRate = totalOrders > 0
      ? Math.round((refundOrders.length / totalOrders) * 10000) / 100
      : 0

    // 风险标记
    const highRisk = productRefund.filter(p => p.refundRate > 10)

    return {
      period,
      totalOrders,
      refundCount: refundOrders.length,
      overallRefundRate,
      totalRefundAmount: refundOrders.reduce((s, o) => s + (o.amount || 0), 0),
      productRefund,
      highRiskProducts: highRisk,
      healthy: highRisk.length === 0,
      suggestion: highRisk.length > 0
        ? `${highRisk.map(p => p.productId).join('、')} 退款率偏高，检查商品价值感`
        : '退款率正常',
      analysedAt: ts,
    }
  } catch (err) {
    console.error('[revenueAnalyzer] analyzeRefund 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

function _calculateHealthScore(structure) {
  let score = 0

  // firstPurchase: ideal 40%
  const fpDiff = Math.abs(structure.firstPurchase.share - 40)
  if (fpDiff <= 10) score += 25
  else if (fpDiff <= 20) score += 15
  else score += 5

  // renewal: ideal 40%
  const rnDiff = Math.abs(structure.renewal.share - 40)
  if (rnDiff <= 10) score += 25
  else if (rnDiff <= 20) score += 15
  else score += 5

  // consulting: ideal 20%
  const csDiff = Math.abs(structure.consulting.share - 20)
  if (csDiff <= 10) score += 15
  else if (csDiff <= 20) score += 8
  else score += 2

  // penalty for extremes
  if (structure.firstPurchase.share > 70) score -= 15
  if (structure.renewal.share < 10 && structure.firstPurchase.share > 50) score -= 10

  return Math.max(0, Math.min(100, score))
}

function _generateStructureSuggestions(structure, health) {
  const suggestions = []

  if (structure.firstPurchase.share > 60) {
    suggestions.push({ priority: 1, issue: '新用户收入占比过高', action: '强化续费策略 — 到期前7/3天提醒、成长数据展示、损失厌恶弹窗' })
  }
  if (structure.renewal.share < 20) {
    suggestions.push({ priority: 1, issue: '续费收入不足', action: '检查会员价值兑现 — 用户是否真正体验到了core value？增加会员专属内容' })
  }
  if (structure.consulting.share > 30) {
    suggestions.push({ priority: 2, issue: '高价咨询占比异常高', action: '可能是会员价值不足导致用户跳过会员直接买咨询，检查会员权益吸引力' })
  }
  if (structure.consulting.share === 0 && structure.firstPurchase.share + structure.renewal.share > 90) {
    suggestions.push({ priority: 3, issue: '缺少高价服务收入', action: '对满足条件的高价值用户推送咨询入口' })
  }

  if (suggestions.length === 0) {
    suggestions.push({ priority: 3, issue: '收入结构健康', action: '保持现有策略' })
  }

  return suggestions
}

module.exports = {
  analyzeRevenueStructure,
  analyzeRevenueTrend,
  analyzeRefund,
}
