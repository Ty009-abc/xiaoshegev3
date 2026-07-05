/**
 * sourceAnalyzer.js — 渠道分析引擎（第六册 Part 5）
 *
 * 能力：
 *   1. 渠道对比分析（雷达图数据）
 *   2. 渠道趋势追踪（7/30日）
 *   3. 渠道质量评分
 *   4. 最优投放渠道推荐
 *
 * 7 渠道：
 *   douyin / wechat / video_account / xiaohongshu / organic / referral / paid_ads
 */
const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)
const ONE_DAY = 86400000

// ── 渠道质量权重 ──
const QUALITY_WEIGHTS = {
  activationRate: 0.25,
  paidRate: 0.35,
  ltvLevel: 0.20,
  retentionSignal: 0.20,
}

// ═══════════════════════════
// getSourceComparison — 渠道对比
// ═══════════════════════════

async function getSourceComparison(db) {
  const ts = now()
  try {
    const all = await db.collection('acquisition_metrics').get().catch(() => ({ data: [] }))
    const sourceMap = {}

    all.data.forEach(a => {
      const s = a.source || 'organic'
      if (!sourceMap[s]) sourceMap[s] = { acquired: 0, activated: 0, paid: 0, totalLtv: 0, totalCost: 0 }
      sourceMap[s].acquired++
      if (a.activated) sourceMap[s].activated++
      if (a.paid) sourceMap[s].paid++
      sourceMap[s].totalLtv += (a.ltv || 0)
      sourceMap[s].totalCost += (a.cost || 0)
    })

    const comparison = Object.entries(sourceMap).map(([source, d]) => ({
      source,
      acquired: d.acquired,
      activationRate: d.acquired > 0 ? Math.round((d.activated / d.acquired) * 10000) / 100 : 0,
      paidRate: d.acquired > 0 ? Math.round((d.paid / d.acquired) * 10000) / 100 : 0,
      avgLtv: d.acquired > 0 ? Math.round((d.totalLtv / d.acquired) * 100) / 100 : 0,
      cac: d.acquired > 0 ? Math.round((d.totalCost / d.acquired) * 100) / 100 : 0,
      totalCost: d.totalCost,
    })).sort((a, b) => b.avgLtv - a.avgLtv)

    return { comparison, analysedAt: ts }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getSourceQuality — 渠道质量评分（0-100）
// ═══════════════════════════

async function getSourceQuality(db) {
  const ts = now()
  try {
    const comparison = await getSourceComparison(db)
    if (comparison.error) return comparison

    const list = comparison.comparison

    // 归一化各维度
    const maxActivation = Math.max(...list.map(s => s.activationRate), 1)
    const maxPaidRate = Math.max(...list.map(s => s.paidRate), 1)
    const maxLtv = Math.max(...list.map(s => s.avgLtv), 1)

    const quality = list.map(s => {
      const activationScore = (s.activationRate / maxActivation) * 100
      const paidScore = (s.paidRate / maxPaidRate) * 100
      const ltvScore = (s.avgLtv / maxLtv) * 100
      const retentionScore = Math.min(100, s.paidRate * 3 + s.activationRate * 0.3)

      const total = Math.round(
        activationScore * QUALITY_WEIGHTS.activationRate +
        paidScore * QUALITY_WEIGHTS.paidRate +
        ltvScore * QUALITY_WEIGHTS.ltvLevel +
        retentionScore * QUALITY_WEIGHTS.retentionSignal
      )

      return {
        source: s.source,
        qualityScore: total,
        grade: total >= 80 ? 'A' : total >= 60 ? 'B' : total >= 40 ? 'C' : 'D',
        breakdown: {
          activation: Math.round(activationScore * 100) / 100,
          paidConversion: Math.round(paidScore * 100) / 100,
          ltvLevel: Math.round(ltvScore * 100) / 100,
          retentionSignal: Math.round(retentionScore * 100) / 100,
        },
      }
    }).sort((a, b) => b.qualityScore - a.qualityScore)

    return { quality, bestSource: quality.length > 0 ? quality[0].source : null, analysedAt: ts }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getSourceTrend — 渠道趋势（7/30日）
// ═══════════════════════════

async function getSourceTrend(db, days = 7) {
  const ts = now()
  const trend = []

  for (let i = days - 1; i >= 0; i--) {
    const d = _todayKey(ts - i * ONE_DAY)
    const dayData = await db.collection('acquisition_metrics')
      .where({ createdAt: db.command.gte(d + 'T00:00:00Z') })
      .count().then(r => r.total).catch(() => 0)
    trend.push({ date: d, newUsers: dayData })
  }

  return { trend, days, analysedAt: ts }
}

// ═══════════════════════════
// recommendChannels — 推荐最优投放渠道
// ═══════════════════════════

async function recommendChannels(db) {
  const quality = await getSourceQuality(db)
  if (quality.error) return quality

  const q = quality.quality || []
  const A = q.filter(s => s.grade === 'A').map(s => s.source)
  const B = q.filter(s => s.grade === 'B').map(s => s.source)
  const CD = q.filter(s => s.grade === 'C' || s.grade === 'D').map(s => s.source)

  return {
    primaryRecommendation: A.length > 0 ? A : B.slice(0, 2),
    secondaryRecommendation: B,
    avoid: CD,
    rationale: A.length > 0
      ? `${A.join('、')} 渠道质量 A 级，建议优先投放`
      : CD.length > 0
        ? `${CD.join('、')} 渠道质量低，建议优化后再投放`
        : '数据收集阶段，继续全渠道测试',
    analysedAt: now(),
  }
}

module.exports = {
  QUALITY_WEIGHTS,
  getSourceComparison,
  getSourceQuality,
  getSourceTrend,
  recommendChannels,
}
