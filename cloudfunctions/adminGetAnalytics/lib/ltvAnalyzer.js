/**
 * ltvAnalyzer.js — LTV 分析引擎（第六册 Part 5）
 *
 * 能力：
 *   1. LTV 分层分析（按来源/内容/段位）
 *   2. LTV 预测（用户终身价值预估）
 *   3. LTV 健康度（LTV/CAC 比率）
 *   4. LTV 趋势追踪
 *
 * LTV 目标 > 80
 * LTV/CAC > 4 = 商业健康
 */
const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)
const ONE_DAY = 86400000

// ── LTV 基准 ──
const LTV_TARGET = 80
const HEALTH_RATIO = 4

// ── LTV 分层段位 ──
const LTV_TIERS = [
  { tier: 'whale',   label: '鲸鱼用户', min: 300, color: '#8e44ad' },
  { tier: 'dolphin', label: '海豚用户', min: 150, color: '#2980b9' },
  { tier: 'fish',    label: '鱼类用户', min: 50,  color: '#27ae60' },
  { tier: 'shrimp',  label: '虾米用户', min: 0,   color: '#95a5a6' },
]

// ═══════════════════════════
// getLtvBySegment — LTV 分层分析
// ═══════════════════════════

async function getLtvBySegment(db) {
  const ts = now()
  try {
    const all = await db.collection('acquisition_metrics').get().catch(() => ({ data: [] }))
    const users = all.data.filter(u => u.paid || u.ltv > 0)

    const byTier = { whale: [], dolphin: [], fish: [], shrimp: [] }
    users.forEach(u => {
      const ltv = (u.ltv || 0) / 100 // 分→元
      const tier = LTV_TIERS.find(t => ltv >= t.min / 100)
      if (tier) byTier[tier.tier].push(ltv)
    })

    const tierStats = {}
    for (const [tier, values] of Object.entries(byTier)) {
      const def = LTV_TIERS.find(t => t.tier === tier)
      tierStats[tier] = {
        label: def?.label || tier,
        color: def?.color || '#ccc',
        count: values.length,
        percent: users.length > 0 ? Math.round((values.length / users.length) * 10000) / 100 : 0,
        avgLtv: values.length > 0 ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100 : 0,
      }
    }

    return {
      totalPaidUsers: users.length,
      tierStats,
      whaleDensity: users.length > 0 ? Math.round((tierStats.whale?.count || 0) / users.length * 10000) / 100 : 0,
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getLtvForecast — LTV 预测
// ═══════════════════════════

async function getLtvForecast(db) {
  const ts = now()
  const today = _todayKey(ts)

  try {
    // 获取历史数据
    const historical = await db.collection('ltv_by_source')
      .orderBy('date', 'asc')
      .limit(90)
      .get()
      .catch(() => ({ data: [] }))

    // 简化的线性预测
    const sources = {}
    historical.data.forEach(record => {
      Object.entries(record).forEach(([key, val]) => {
        if (key === 'date' || key === '_id' || key === 'createdAt' || key === 'updatedAt') return
        if (typeof val === 'object' && val.averageLtv !== undefined) {
          if (!sources[key]) sources[key] = []
          sources[key].push(val.averageLtv)
        }
      })
    })

    const forecasts = {}
    for (const [source, values] of Object.entries(sources)) {
      if (values.length < 3) continue
      const recent = values.slice(-7) // 最近 7 天
      const avg = recent.reduce((s, v) => s + v, 0) / recent.length
      // 简单趋势：最近值是否在上升
      const trend = recent.length >= 2 ? recent[recent.length - 1] - recent[0] : 0
      forecasts[source] = {
        currentAvgLtv: Math.round(avg * 100) / 100,
        trend: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable',
        forecast30d: Math.round((avg + trend * 0.5) * 100) / 100, // 保守预测
        confidence: values.length >= 7 ? 'high' : 'medium',
      }
    }

    return {
      forecasts,
      target: LTV_TARGET,
      notes: '30日保守预测，置信度随数据量提升',
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getLtvHealth — LTV 健康度
// ═══════════════════════════

async function getLtvHealth(db) {
  const ts = now()
  try {
    const acquisitionEngine = require('./acquisitionEngine.js')
    const ltvData = await acquisitionEngine.getLTVBySource(db)
    const cacData = await acquisitionEngine.getCAC(db)

    if (ltvData.error || cacData.error) return { error: '获取数据失败' }

    const health = {}
    for (const source of Object.keys(ltvData.ltvBySource || {})) {
      const ltv = ltvData.ltvBySource[source]
      const cac = cacData.cacBySource[source]
      const avgLtv = ltv?.averageLtv || 0
      const srcCac = cac?.cac || 1
      const ratio = Math.round((avgLtv / Math.max(srcCac, 1)) * 100) / 100

      health[source] = {
        avgLtv,
        cac: srcCac,
        ltvCacRatio: ratio,
        health: ratio >= HEALTH_RATIO ? 'healthy' : ratio >= 2 ? 'ok' : ratio >= 1 ? 'weak' : 'critical',
        statusIcon: ratio >= HEALTH_RATIO ? '🟢' : ratio >= 2 ? '🟡' : ratio >= 1 ? '🟠' : '🔴',
      }
    }

    return { health, target: LTV_TARGET, healthRatio: HEALTH_RATIO, analysedAt: ts }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getLtvTrend — LTV 趋势追踪（30日）
// ═══════════════════════════

async function getLtvTrend(db, days = 30) {
  const ts = now()
  const trendData = []

  try {
    for (let i = days - 1; i >= 0; i--) {
      const d = _todayKey(ts - i * ONE_DAY)
      const record = await db.collection('ltv_by_source')
        .where({ date: d })
        .limit(1)
        .get()
        .catch(() => ({ data: [] }))

      if (record.data.length > 0) {
        const r = record.data[0]
        const allSources = Object.entries(r).filter(([k]) => !['date', '_id', 'createdAt', 'updatedAt'].includes(k))
        const totalLtv = allSources.reduce((s, [, v]) => s + (v.averageLtv || 0), 0)
        const avgLtv = allSources.length > 0 ? Math.round((totalLtv / allSources.length) * 100) / 100 : 0
        trendData.push({ date: d, avgLtv, sources: allSources.length })
      } else {
        trendData.push({ date: d, avgLtv: 0, sources: 0 })
      }
    }

    return { trend: trendData, days, analysedAt: ts }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getLtvSummary — LTV 总览
// ═══════════════════════════

async function getLtvSummary(db) {
  const ts = now()
  try {
    const [segment, health, forecast] = await Promise.all([
      getLtvBySegment(db),
      getLtvHealth(db),
      getLtvForecast(db),
    ])

    return {
      segment,
      health,
      forecast,
      target: LTV_TARGET,
      healthRatio: HEALTH_RATIO,
      analysedAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

module.exports = {
  LTV_TARGET,
  HEALTH_RATIO,
  LTV_TIERS,
  getLtvBySegment,
  getLtvForecast,
  getLtvHealth,
  getLtvTrend,
  getLtvSummary,
}
