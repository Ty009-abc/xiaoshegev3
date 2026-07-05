/**
 * cloudfunctions/common/revenueEngine.js — 收入引擎（第五册 Part 6）
 *
 * Revenue Intelligence 核心：
 *   1. 每日/月度收入聚合 → revenue_metrics
 *   2. 按商品拆分收入 → product_revenue
 *   3. 收入归因（source 追溯）
 *   4. 退款统计 → refund_metrics
 *   5. 核心指标：grossRevenue / netRevenue / ARPU / ARPPU / LTV / MRR / ARR
 */
const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)
const _monthKey = (ts) => new Date(ts).toISOString().slice(0, 7)
const ONE_DAY = 86400000

// 平台手续费率（微信支付 0.6%）
const PLATFORM_FEE_RATE = 0.006

// ═══════════════════════════
// aggregateDailyRevenue — 每日收入聚合
// ═══════════════════════════

async function aggregateDailyRevenue(db, dateKey) {
  const today = dateKey || _todayKey(now())
  const ts = now()

  try {
    // paid orders
    const paidOrders = await db.collection('orders')
      .where({ status: 'paid', date: today })
      .get()
      .catch(() => ({ data: [] }))

    // refunds
    const refundOrders = await db.collection('orders')
      .where({ status: 'refunded', date: today })
      .get()
      .catch(() => ({ data: [] }))

    const grossRevenue = paidOrders.data.reduce((s, o) => s + (o.amount || 0), 0)
    const refundAmount = refundOrders.data.reduce((s, o) => s + (o.amount || 0), 0)
    const platformFees = Math.round(grossRevenue * PLATFORM_FEE_RATE)
    const netRevenue = grossRevenue - refundAmount - platformFees
    const orderCount = paidOrders.data.length

    // 按商品拆分
    const byProduct = {}
    paidOrders.data.forEach(o => {
      const pid = o.productId || 'unknown'
      if (!byProduct[pid]) byProduct[pid] = { revenue: 0, count: 0 }
      byProduct[pid].revenue += (o.amount || 0)
      byProduct[pid].count++
    })

    // 按来源归因
    const bySource = {}
    paidOrders.data.forEach(o => {
      const src = o.source || 'unknown'
      if (!bySource[src]) bySource[src] = { revenue: 0, count: 0 }
      bySource[src].revenue += (o.amount || 0)
      bySource[src].count++
    })

    const metric = {
      date: today,
      grossRevenue,
      netRevenue,
      refundAmount,
      platformFees,
      orderCount,
      refundCount: refundOrders.data.length,
      refundRate: orderCount > 0 ? Math.round((refundOrders.data.length / orderCount) * 10000) / 100 : 0,
      byProduct,
      bySource,
      createdAt: ts,
      updatedAt: ts,
    }

    // upsert
    const existing = await db.collection('revenue_metrics')
      .where({ date: today })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))

    if (existing.data.length > 0) {
      await db.collection('revenue_metrics').doc(existing.data[0]._id).update({
        data: { ...metric, updatedAt: ts },
      })
    } else {
      await db.collection('revenue_metrics').add({ data: metric })
    }

    // 同步 product_revenue
    await _upsertProductRevenue(db, today, byProduct, ts)

    // 同步 refund_metrics
    await _upsertRefundMetrics(db, today, refundOrders.data, ts)

    return metric
  } catch (err) {
    console.error('[revenueEngine] aggregateDailyRevenue 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// getRevenueSummary — 收入概览
// ═══════════════════════════

async function getRevenueSummary(db, options = {}) {
  const { period = 'month', dateFrom, dateTo } = options
  const ts = now()
  const today = _todayKey(ts)
  const thisMonth = _monthKey(ts)

  try {
    let where = {}
    if (period === 'today') {
      where = { date: today }
    } else if (period === 'month') {
      where = { date: db.command.gte(thisMonth + '-01') }
    } else if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date = { ...where.date, ...db.command.gte(dateFrom) }
      if (dateTo)   where.date = { ...where.date, ...db.command.lte(dateTo) }
    }

    const metrics = await db.collection('revenue_metrics')
      .where(where)
      .get()
      .catch(() => ({ data: [] }))

    const total = metrics.data.reduce((acc, m) => {
      acc.grossRevenue += m.grossRevenue || 0
      acc.netRevenue += m.netRevenue || 0
      acc.refundAmount += m.refundAmount || 0
      acc.platformFees += m.platformFees || 0
      acc.orderCount += m.orderCount || 0
      acc.refundCount += m.refundCount || 0
      return acc
    }, { grossRevenue: 0, netRevenue: 0, refundAmount: 0, platformFees: 0, orderCount: 0, refundCount: 0 })

    // ARPU / ARPPU / LTV
    const activeUsers = await db.collection('funnel_events')
      .where({ event: 'home_view', date: db.command.gte(thisMonth + '-01') })
      .count().then(r => r.total).catch(() => 0)
    const payingUsers = await db.collection('memberships')
      .where({ status: db.command.in(['active', 'expired', 'refunded']) })
      .count().then(r => r.total).catch(() => 0)
    const payingUsersThisMonth = await db.collection('orders')
      .where({ status: 'paid', date: db.command.gte(thisMonth + '-01') })
      .count().then(r => r.total).catch(() => 0)

    const arpu = activeUsers > 0 ? Math.round(total.grossRevenue / activeUsers) : 0
    const arppu = payingUsersThisMonth > 0 ? Math.round(total.grossRevenue / payingUsersThisMonth) : 0

    // MRR = sum of subscription orders this month
    const subOrders = await db.collection('orders')
      .where({ status: 'paid', productId: db.command.in(['VIP_MONTHLY', 'VIP_QUARTERLY', 'VIP_YEARLY']),
        date: db.command.gte(thisMonth + '-01') })
      .get().catch(() => ({ data: [] }))

    const mrr = subOrders.data.reduce((s, o) => {
      // normalize to monthly
      if (o.productId === 'VIP_QUARTERLY') return s + Math.round((o.amount || 0) / 3)
      if (o.productId === 'VIP_YEARLY')   return s + Math.round((o.amount || 0) / 12)
      return s + (o.amount || 0)
    }, 0)

    // ARR = MRR × 12 (run-rate)
    const arr = mrr * 12

    // LTV: 平均客单价 × 平均续费次数估算
    const avgOrderValue = total.orderCount > 0 ? Math.round(total.grossRevenue / total.orderCount) : 0
    const avgRenewCount = await db.collection('memberships')
      .where({ status: 'active' })
      .field({ renewCount: true })
      .get()
      .then(r => r.data.reduce((s, m) => s + (m.renewCount || 0), 0))
      .catch(() => 0)
    const activeMemberCount = await db.collection('memberships')
      .where({ status: 'active' })
      .count().then(r => r.total).catch(() => 1)
    const avgRenew = activeMemberCount > 0 ? avgRenewCount / activeMemberCount : 0
    const ltv = Math.round(avgOrderValue * (1 + avgRenew))

    const refundRate = total.orderCount > 0
      ? Math.round((total.refundCount / total.orderCount) * 10000) / 100
      : 0

    return {
      period,
      grossRevenue: total.grossRevenue,
      netRevenue: total.netRevenue,
      refundAmount: total.refundAmount,
      platformFees: total.platformFees,
      orderCount: total.orderCount,
      refundCount: total.refundCount,
      refundRate,
      ARPU: arpu,           // 分
      ARPPU: arppu,         // 分
      LTV: ltv,             // 分
      MRR: mrr,             // 分
      ARR: arr,             // 分
      activeUsers,
      payingUsers,
      payingUsersThisMonth,
      analysedAt: ts,
    }
  } catch (err) {
    console.error('[revenueEngine] getRevenueSummary 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// getProductRevenue — 商品收入拆分
// ═══════════════════════════

async function getProductRevenue(db, period = 'month') {
  const thisMonth = _monthKey(now())
  try {
    const where = period === 'month' ? { date: db.command.gte(thisMonth + '-01') } : {}
    const res = await db.collection('product_revenue').where(where).get().catch(() => ({ data: [] }))

    // 聚合
    const aggregated = {}
    res.data.forEach(r => {
      for (const [pid, data] of Object.entries(r.byProduct || {})) {
        if (!aggregated[pid]) aggregated[pid] = { revenue: 0, count: 0, productName: r.productNames?.[pid] || pid }
        aggregated[pid].revenue += data.revenue || 0
        aggregated[pid].count += data.count || 0
      }
    })

    // 排序
    const products = Object.entries(aggregated)
      .map(([id, v]) => ({ productId: id, ...v, revenueYuan: (v.revenue / 100).toFixed(2) }))
      .sort((a, b) => b.revenue - a.revenue)

    const totalRevenue = products.reduce((s, p) => s + p.revenue, 0)

    return {
      period,
      totalRevenue,
      totalRevenueYuan: (totalRevenue / 100).toFixed(2),
      products,
      topProduct: products[0] || null,
      topProductShare: totalRevenue > 0 && products[0] ? Math.round((products[0].revenue / totalRevenue) * 100) : 0,
    }
  } catch (err) {
    console.error('[revenueEngine] getProductRevenue 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// getRevenueAttribution — 收入来源归因
// ═══════════════════════════

async function getRevenueAttribution(db, period = 'month') {
  const thisMonth = _monthKey(now())
  try {
    const where = period === 'month' ? { date: db.command.gte(thisMonth + '-01') } : {}
    const res = await db.collection('revenue_metrics').where(where).get().catch(() => ({ data: [] }))

    const bySource = {}
    res.data.forEach(m => {
      for (const [src, data] of Object.entries(m.bySource || {})) {
        if (!bySource[src]) bySource[src] = { revenue: 0, count: 0 }
        bySource[src].revenue += data.revenue || 0
        bySource[src].count += data.count || 0
      }
    })

    const total = Object.values(bySource).reduce((s, v) => s + v.revenue, 0)

    const sources = Object.entries(bySource)
      .map(([source, v]) => ({
        source,
        revenue: v.revenue,
        revenueYuan: (v.revenue / 100).toFixed(2),
        count: v.count,
        share: total > 0 ? Math.round((v.revenue / total) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return { period, totalRevenue: total, sources, bestSource: sources[0] || null }
  } catch (err) {
    console.error('[revenueEngine] getRevenueAttribution 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// detectRevenueLeaks — 收入漏损检测
// ═══════════════════════════

async function detectRevenueLeaks(db) {
  const ts = now()
  const thisMonth = _monthKey(ts)
  const leaks = []

  try {
    // 1. 支付失败率
    const failedOrders = await db.collection('orders')
      .where({ status: 'failed', date: db.command.gte(thisMonth + '-01') })
      .count().then(r => r.total).catch(() => 0)
    const totalOrderAttempts = await db.collection('orders')
      .where({ date: db.command.gte(thisMonth + '-01') })
      .count().then(r => r.total).catch(() => 1)
    const failRate = Math.round((failedOrders / Math.max(totalOrderAttempts, 1)) * 10000) / 100
    if (failRate > 10) leaks.push({
      type: 'payment_fail_high',
      severity: 'high',
      metric: `支付失败率 ${failRate}%`,
      detail: '支付失败率偏高，检查支付流程/网络/价格敏感度',
      suggestion: '优化支付UI引导、增加支付安全保障提示',
    })

    // 2. 待支付订单
    const pendingOrders = await db.collection('orders')
      .where({ status: 'pending', createdAt: db.command.gte(ts - 2 * 3600000) })
      .count().then(r => r.total).catch(() => 0)
    if (pendingOrders > 20) leaks.push({
      type: 'pending_orders_high',
      severity: 'medium',
      metric: `待支付订单 ${pendingOrders} 笔`,
      detail: '大量订单未完成支付，可能支付流程中断',
      suggestion: '强化订单恢复机制、发送支付提醒',
    })

    // 3. 报告页流失
    const reportViews = await db.collection('funnel_events')
      .where({ event: 'report_preview', date: db.command.gte(thisMonth + '-01') })
      .count().then(r => r.total).catch(() => 0)
    const reportUnlocks = await db.collection('funnel_events')
      .where({ event: 'report_unlock_click', date: db.command.gte(thisMonth + '-01') })
      .count().then(r => r.total).catch(() => 0)
    const reportDrop = reportViews > 0 ? Math.round((1 - reportUnlocks / reportViews) * 10000) / 100 : 0
    if (reportDrop > 70) leaks.push({
      type: 'report_unlock_drop_high',
      severity: 'high',
      metric: `报告解锁流失率 ${reportDrop}%`,
      detail: '用户看了报告但不解锁，4 触发器需要优化',
      suggestion: '强化限时/损失厌恶文案、增加社会证明数字',
    })

    // 4. 会员续费低
    const expiringMembers = await db.collection('memberships')
      .where({ status: 'active', expiredAt: db.command.lte(ts + 14 * ONE_DAY) })
      .count().then(r => r.total).catch(() => 0)
    const recentRenewals = await db.collection('memberships')
      .where({ status: 'active', renewedAt: db.command.gte(ts - 30 * ONE_DAY) })
      .count().then(r => r.total).catch(() => 0)
    if (expiringMembers > 10 && recentRenewals < expiringMembers * 0.3) {
      leaks.push({
        type: 'low_renewal',
        severity: 'medium',
        metric: `近期续费 ${recentRenewals} / 即将到期 ${expiringMembers}`,
        detail: '会员续费率偏低，需要强化续费提醒',
        suggestion: '增加到期前7天/3天/当天三阶段续费提醒',
      })
    }

    // 5. 退款率异常
    const refundRate = await db.collection('revenue_metrics')
      .where({ date: _todayKey(ts) })
      .limit(1).get()
      .then(r => r.data[0]?.refundRate || 0)
      .catch(() => 0)
    if (refundRate > 5) leaks.push({
      type: 'refund_rate_high',
      severity: 'high',
      metric: `退款率 ${refundRate}%`,
      detail: '退款率高于正常水平，可能商品价值感不足',
      suggestion: '分析退款原因、优化商品描述和价值展示',
    })

    return {
      totalLeaks: leaks.length,
      leaks,
      healthy: leaks.length === 0,
      analysedAt: ts,
    }
  } catch (err) {
    console.error('[revenueEngine] detectRevenueLeaks 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// generateDailyBrief — AI CFO 每日收入简报
// ═══════════════════════════

async function generateDailyBrief(db) {
  const ts = now()
  const today = _todayKey(ts)

  try {
    const [summary, productRevenue, leaks] = await Promise.all([
      getRevenueSummary(db, { period: 'today' }),
      getProductRevenue(db, 'today'),
      detectRevenueLeaks(db),
    ])

    const topProduct = productRevenue.topProduct
    const topSource = (await getRevenueAttribution(db, 'today')).bestSource

    return {
      date: today,
      headline: `今日收入 ¥${((summary.grossRevenue || 0) / 100).toFixed(2)}`,
      breakdown: {
        grossRevenue: summary.grossRevenue,
        netRevenue: summary.netRevenue,
        orderCount: summary.orderCount,
        refundCount: summary.refundCount,
      },
      topProduct: topProduct ? {
        productId: topProduct.productId,
        revenue: topProduct.revenueYuan,
        share: productRevenue.topProductShare + '%',
      } : null,
      topSource: topSource ? {
        source: topSource.source,
        share: topSource.share + '%',
      } : null,
      leaks: leaks.leaks.map(l => ({ type: l.type, suggestion: l.suggestion })),
      summary: _generateBriefSummary(summary, topProduct, topSource, leaks),
      generatedAt: ts,
    }
  } catch (err) {
    console.error('[revenueEngine] generateDailyBrief 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

async function _upsertProductRevenue(db, date, byProduct, ts) {
  try {
    const existing = await db.collection('product_revenue').where({ date }).limit(1).get()
    if (existing.data.length > 0) {
      // merge
      const old = existing.data[0].byProduct || {}
      const merged = { ...old }
      for (const [pid, data] of Object.entries(byProduct)) {
        if (!merged[pid]) merged[pid] = { revenue: 0, count: 0 }
        merged[pid].revenue += data.revenue
        merged[pid].count += data.count
      }
      await db.collection('product_revenue').doc(existing.data[0]._id).update({
        data: { byProduct: merged, updatedAt: ts },
      })
    } else {
      await db.collection('product_revenue').add({
        data: { date, byProduct, productNames: {}, createdAt: ts, updatedAt: ts },
      })
    }
  } catch (_) {}
}

async function _upsertRefundMetrics(db, date, refundOrders, ts) {
  try {
    if (!refundOrders.length) return
    const byProduct = {}
    refundOrders.forEach(o => {
      const pid = o.productId || 'unknown'
      if (!byProduct[pid]) byProduct[pid] = { count: 0, amount: 0 }
      byProduct[pid].count++
      byProduct[pid].amount += (o.amount || 0)
    })

    const existing = await db.collection('refund_metrics').where({ date }).limit(1).get()
    if (existing.data.length > 0) {
      const old = existing.data[0].byProduct || {}
      const merged = { ...old }
      for (const [pid, data] of Object.entries(byProduct)) {
        if (!merged[pid]) merged[pid] = { count: 0, amount: 0, refundRate: 0 }
        merged[pid].count += data.count
        merged[pid].amount += data.amount
      }
      await db.collection('refund_metrics').doc(existing.data[0]._id).update({
        data: { byProduct: merged, totalRefundCount: refundOrders.length, updatedAt: ts },
      })
    } else {
      await db.collection('refund_metrics').add({
        data: { date, byProduct, totalRefundCount: refundOrders.length, createdAt: ts, updatedAt: ts },
      })
    }
  } catch (_) {}
}

function _generateBriefSummary(summary, productRevenue, topSource, leaks) {
  const parts = []
  const rev = ((summary.grossRevenue || 0) / 100).toFixed(2)

  if (productRevenue?.topProduct) {
    parts.push(`主要收入来自 ${productRevenue.topProduct.productId}（${productRevenue.topProductShare}%）`)
  }
  if (topSource) {
    parts.push(`最赚钱入口：${topSource.source}（${topSource.share}%）`)
  }
  if (leaks.leaks.length > 0) {
    parts.push(`⚠️ 发现 ${leaks.leaks.length} 个收入漏损点`)
    const worst = leaks.leaks[0]
    parts.push(`最严重：${worst.type} — ${worst.suggestion}`)
  } else {
    parts.push('✅ 未发现显著收入漏损')
  }

  return `今日收入 ¥${rev}。${parts.join('。')}`
}

module.exports = {
  aggregateDailyRevenue,
  getRevenueSummary,
  getProductRevenue,
  getRevenueAttribution,
  detectRevenueLeaks,
  generateDailyBrief,
}
