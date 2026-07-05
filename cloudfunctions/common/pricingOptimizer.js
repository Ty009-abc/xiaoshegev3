/**
 * cloudfunctions/common/pricingOptimizer.js — 价格优化建议（第五册 Part 6）
 *
 * 基于收入数据 + 转化漏斗 + 同期群 → 输出定价建议
 *
 * 分析维度：
 *   1. 当前价格转化率
 *   2. 竞品参考 + 心理定价点
 *   3. 价格弹性估算
 *   4. 年卡价值感知
 *
 * ⚠️ 老板重要提示：年卡 299 偏低，DAU 起量后第二阶段改 399
 */
const now = () => Date.now()
const ONE_DAY = 86400000

// 当前价格（分）
const CURRENT_PRICES = {
  REPORT_001:       { price: 990,   type: 'one_time',   label: 'AI深度翻身报告',   originalPrice: 9900 },
  VIP_MONTHLY:      { price: 9900,  type: 'subscription', label: '月卡会员',         originalPrice: 9900, hidden: true },
  VIP_QUARTERLY:    { price: 19900, type: 'subscription', label: '季卡会员 ⭐',      originalPrice: 29700 },
  VIP_YEARLY:       { price: 29900, type: 'subscription', label: '年卡会员',         originalPrice: 118800 },
  CONSULT_001:      { price: 89900, type: 'consulting',   label: '1对1认知咨询',    originalPrice: 89900 },
}

// ═══════════════════════════
// analyze — 核心分析
// ═══════════════════════════

async function analyze(db) {
  const ts = now()
  const thisMonth = new Date(ts).toISOString().slice(0, 7)

  try {
    const suggestions = []

    // 收集数据
    const [orders, productRevenue, cohortData] = await Promise.all([
      db.collection('orders')
        .where({ status: db.command.in(['paid', 'refunded']), date: db.command.gte(thisMonth + '-01') })
        .get().catch(() => ({ data: [] })),
      db.collection('product_revenue')
        .where({ date: db.command.gte(thisMonth + '-01') })
        .get().catch(() => ({ data: [] })),
      require('./cohortAnalyzer.js').analyzeCohorts(db, { months: 3 }),
    ])

    // ── 1. 分析每个商品 ──
    for (const [productId, config] of Object.entries(CURRENT_PRICES)) {
      if (config.hidden) continue

      const productOrders = orders.data.filter(o => o.productId === productId)
      const paidCount = productOrders.filter(o => o.status === 'paid').length
      const refundedCount = productOrders.filter(o => o.status === 'refunded').length
      const totalRevenue = productOrders.filter(o => o.status === 'paid').reduce((s, o) => s + (o.amount || 0), 0)
      const refundRate = paidCount + refundedCount > 0
        ? Math.round((refundedCount / (paidCount + refundedCount)) * 10000) / 100
        : 0

      // 转化率（report → payment for REPORT_001, membership_view → payment for subscriptions）
      const funnelEvent = productId === 'REPORT_001' ? 'report_unlock_click' : 'membership_purchase'
      const viewEvent = productId === 'REPORT_001' ? 'report_preview' : 'membership_view'

      const views = await db.collection('funnel_events')
        .where({ event: viewEvent, date: db.command.gte(thisMonth + '-01') })
        .count().then(r => r.total).catch(() => 0)
      const conversions = await db.collection('funnel_events')
        .where({ event: funnelEvent, date: db.command.gte(thisMonth + '-01') })
        .count().then(r => r.total).catch(() => 0)

      const conversionRate = views > 0 ? Math.round((conversions / views) * 10000) / 100 : 0

      const analysis = { productId, label: config.label, currentPrice: config.price,
        currentPriceYuan: (config.price / 100).toFixed(2),
        paidCount, refundedCount, refundRate, totalRevenue, totalRevenueYuan: (totalRevenue / 100).toFixed(2),
        views, conversions, conversionRate }

      // ── 年卡专属分析 + 老板建议 ──
      if (productId === 'VIP_YEARLY') {
        if (conversionRate > 3 && refundRate < 3) {
          suggestions.push({
            productId: 'VIP_YEARLY',
            type: 'price_increase',
            confidence: 'high',
            currentPrice: config.price,
            currentPriceYuan: (config.price / 100).toFixed(2),
            suggestedPrice: 39900,
            suggestedPriceYuan: '399.00',
            increasePercent: 33.4,
            reasoning: '年卡当前 ¥299 偏低。转化率健康(>3%)、退款率低(<3%)表明用户认可价值。DAU 起量后提价到 ¥399 可提升 ARPPU 33%。299 对高认知产品太便宜。',
            note: '⚠️ 老板决策：DAU 起量后第二阶段改 399',
            impact: `预计增收 ¥${(paidCount * 10000 / 100).toFixed(0)}/月`,
          })
        }
      }

      // ── 季卡 ──
      if (productId === 'VIP_QUARTERLY') {
        if (conversionRate > 0 && conversionRate < 2) {
          suggestions.push({
            productId: 'VIP_QUARTERLY',
            type: 'price_review',
            confidence: 'medium',
            currentPrice: config.price,
            currentPriceYuan: (config.price / 100).toFixed(2),
            suggestedPrice: 16800,
            suggestedPriceYuan: '168.00',
            reasoning: '季卡转化率偏低。¥168 是心理定价甜点（比 199 少 31 元但心理门槛差一档）。测试 A/B：199 vs 168，看转化率变化。',
            note: '建议 AB 测试而非直接改价',
          })
        }
      }

      // ── 咨询卡 ──
      if (productId === 'CONSULT_001') {
        if (paidCount >= 5 && refundRate < 5) {
          suggestions.push({
            productId: 'CONSULT_001',
            type: 'price_increase',
            confidence: 'medium',
            currentPrice: config.price,
            currentPriceYuan: (config.price / 100).toFixed(2),
            suggestedPrice: 129900,
            suggestedPriceYuan: '1,299.00',
            reasoning: '咨询需求旺盛、退款率低 → 价格可以上探。¥1,299 与 ¥899 面值差距不大但收入提升 44%。1对1认知诊断在市场上稀缺。',
          })
        }
      }

      // ── 报告卡 ──
      if (productId === 'REPORT_001') {
        if (conversionRate > 8) {
          suggestions.push({
            productId: 'REPORT_001',
            type: 'price_test',
            confidence: 'low',
            currentPrice: config.price,
            currentPriceYuan: (config.price / 100).toFixed(2),
            suggestedPrice: 1490,
            suggestedPriceYuan: '14.90',
            reasoning: '报告转化率较高(>8%)，可以测试 ¥14.9。但 9.9 是首单心理门槛的关键价格 — 提价可能伤害梯子第一阶。',
            note: '⚠️ 不建议现在改。9.9 是梯子第一步。',
          })
        }
      }
    }

    // ── 2. 全局价格健康度 ──
    const avgOrderValue = orders.data.filter(o => o.status === 'paid').length > 0
      ? Math.round(orders.data.filter(o => o.status === 'paid').reduce((s, o) => s + (o.amount || 0), 0)
        / orders.data.filter(o => o.status === 'paid').length)
      : 0

    const summary = {
      totalProducts: Object.keys(CURRENT_PRICES).length,
      activeProducts: Object.values(CURRENT_PRICES).filter(c => !c.hidden).length,
      avgOrderValue,
      avgOrderValueYuan: (avgOrderValue / 100).toFixed(2),
      suggestions: suggestions.sort((a, b) => {
        const conf = { high: 3, medium: 2, low: 1 }
        return (conf[b.confidence] || 0) - (conf[a.confidence] || 0)
      }),
      analysedAt: ts,
    }

    return summary
  } catch (err) {
    console.error('[pricingOptimizer] analyze 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// suggestPricePoint — 单一商品定价建议
// ═══════════════════════════

async function suggestPricePoint(db, productId) {
  const result = await analyze(db)
  if (result.error) return result

  const productSuggestions = result.suggestions.filter(s => s.productId === productId)

  if (productSuggestions.length === 0) {
    return {
      productId,
      suggestion: '当前价格健康，暂无调整建议',
      currentPrice: CURRENT_PRICES[productId]?.price || 0,
      reason: '保持现有定价策略',
    }
  }

  return {
    productId,
    ...productSuggestions[0],
    allSuggestions: productSuggestions,
  }
}

// ═══════════════════════════
// getPricingBenchmarks — 定价基准参考
// ═══════════════════════════

function getPricingBenchmarks() {
  return {
    mentalPricePoints: [
      { range: '9.9–19.9',   psychology: '冲动消费区间 — 不需思考即下单',            recommended: 'REPORT_001' },
      { range: '99–199',      psychology: '合理消费区间 — 会想一下但不超过预算线',      recommended: 'VIP_QUARTERLY' },
      { range: '299–399',     psychology: '认真决策区间 — 需要看到明确价值回报',        recommended: 'VIP_YEARLY' },
      { range: '899+',        psychology: '高信任区间 — 只对铁粉和刚需售卖',            recommended: 'CONSULT_001' },
    ],
    priceEndings: [
      { ending: 9, effect: '+转化 3-5%', reason: '9.9 比 10 好卖 30%' },
      { ending: 99, effect: '+转化 5-8%', reason: '199 和 200 心理上差一个数量级' },
    ],
    stageNotes: {
      cold_start: {
        strategy: '低价获客，快速验证 PMF',
        report: '9.9 是最优首单价',
        member: '季卡 199 平衡转化和现金流',
        yearly: '299 偏低但冷启动不宜提价',
        consult: '899 不变 — 筛选 > 走量',
      },
      growth: {
        strategy: '提价扩 ARPU，丰富 SKU',
        yearly: '399 — 价值已验证，提价 33%',
        quarterly: '考虑 168–199 的 AB 测试',
        new_sku: '考虑增加 ¥49.9 的"认知急救包"（单次深度分析）',
      },
    },
  }
}

module.exports = {
  analyze,
  suggestPricePoint,
  getPricingBenchmarks,
}
