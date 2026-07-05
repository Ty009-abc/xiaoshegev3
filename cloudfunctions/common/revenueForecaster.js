/**
 * cloudfunctions/common/revenueForecaster.js — 收入预测（第五册 Part 6）
 *
 * 基于：DAU / 支付率 / ARPPU / 续费率
 * 预测：7天 / 30天 / 90天收入
 */
const now = () => Date.now()
const ONE_DAY = 86400000

// ═══════════════════════════
// forecast — 核心预测函数
// ═══════════════════════════

async function forecast(db, options = {}) {
  const { horizonDays = [7, 30, 90] } = options
  const ts = now()

  try {
    // 收集历史数据（最近30天）
    const thirtyDaysAgo = ts - 30 * ONE_DAY
    const metrics = await db.collection('revenue_metrics')
      .where({ date: db.command.gte(new Date(thirtyDaysAgo).toISOString().slice(0, 10)) })
      .orderBy('date', 'asc')
      .get()
      .catch(() => ({ data: [] }))

    const data = metrics.data
    if (data.length < 7) {
      return { error: '历史数据不足（< 7天），无法预测', suggestion: '至少需要 7 天收入数据' }
    }

    // 计算日均指标
    const totalRevenue = data.reduce((s, m) => s + (m.grossRevenue || 0), 0)
    const totalOrders = data.reduce((s, m) => s + (m.orderCount || 0), 0)
    const days = data.length

    const dailyAvgRevenue = Math.round(totalRevenue / days)
    const dailyAvgOrders = Math.round(totalOrders / days)
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

    // 趋势（线性回归简化版：最近7天 vs 前7天）
    const recent7 = data.slice(-7)
    const previous = data.slice(0, Math.min(7, data.length - 7))

    const recentAvg = recent7.reduce((s, m) => s + (m.grossRevenue || 0), 0) / Math.max(recent7.length, 1)
    const previousAvg = previous.length > 0
      ? previous.reduce((s, m) => s + (m.grossRevenue || 0), 0) / previous.length
      : recentAvg

    const trendFactor = previousAvg > 0 ? recentAvg / previousAvg : 1
    const trendLabel = trendFactor > 1.1 ? 'up' : trendFactor < 0.9 ? 'down' : 'stable'

    // 支付率
    const activeUsers = await db.collection('funnel_events')
      .where({ event: 'home_view', date: db.command.gte(new Date(thirtyDaysAgo).toISOString().slice(0, 10)) })
      .count().then(r => r.total).catch(() => 0)
    const dau = activeUsers > 0 ? Math.round(activeUsers / days) : 0
    const payRate = dau > 0 ? Math.round((dailyAvgOrders / dau) * 10000) / 100 : 0

    // 续费率
    const renewalCount = await db.collection('memberships')
      .where({ status: 'active', renewCount: db.command.gt(0) })
      .count().then(r => r.total).catch(() => 0)
    const totalMembers = await db.collection('memberships')
      .where({ status: db.command.in(['active', 'expired']) })
      .count().then(r => r.total).catch(() => 1)
    const renewalRate = totalMembers > 0 ? Math.round((renewalCount / totalMembers) * 10000) / 100 : 0

    // 预测各 horizon
    const forecasts = {}
    for (const h of horizonDays) {
      // 乐观/保守/基准
      const baseRevenue = Math.round(dailyAvgRevenue * h * trendFactor)
      const conservativeRevenue = Math.round(baseRevenue * 0.75)
      const optimisticRevenue = Math.round(baseRevenue * 1.25)

      forecasts[`${h}d`] = {
        days: h,
        base: baseRevenue,
        baseYuan: (baseRevenue / 100).toFixed(2),
        conservative: conservativeRevenue,
        conservativeYuan: (conservativeRevenue / 100).toFixed(2),
        optimistic: optimisticRevenue,
        optimisticYuan: (optimisticRevenue / 100).toFixed(2),
        estimatedOrders: Math.round(dailyAvgOrders * h * trendFactor),
      }
    }

    // 写入 forecast_revenue
    const forecastRecord = {
      predictedAt: ts,
      inputs: {
        dailyAvgRevenue,
        dailyAvgOrders,
        avgOrderValue,
        trendFactor: Math.round(trendFactor * 100) / 100,
        trendLabel,
        dau,
        payRate,
        renewalRate,
        dataPoints: days,
      },
      forecasts,
    }

    try {
      await db.collection('forecast_revenue').add({
        data: { ...forecastRecord, createdAt: ts },
      })
    } catch (_) {}

    return forecastRecord
  } catch (err) {
    console.error('[revenueForecaster] forecast 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// getLatestForecast
// ═══════════════════════════

async function getLatestForecast(db) {
  try {
    const res = await db.collection('forecast_revenue')
      .orderBy('predictedAt', 'desc')
      .limit(1)
      .get()
    return res.data[0] || null
  } catch (_) {
    return null
  }
}

// ═══════════════════════════
// getForecastAccuracy — 回溯评估
// ═══════════════════════════

async function getForecastAccuracy(db) {
  const ts = now()
  try {
    const pastForecasts = await db.collection('forecast_revenue')
      .where({ predictedAt: db.command.lte(ts - 7 * ONE_DAY) })
      .orderBy('predictedAt', 'desc')
      .limit(5)
      .get()
      .catch(() => ({ data: [] }))

    if (!pastForecasts.data.length) return { message: '暂无足够数据评估准确度', accuracy: null }

    let totalError = 0
    let count = 0

    for (const f of pastForecasts.data) {
      const predictedAt = f.predictedAt
      const predicted7d = f.forecasts?.['7d']?.base || 0

      // 实际7天收入
      const actualStart = new Date(predictedAt).toISOString().slice(0, 10)
      const actualEnd = new Date(predictedAt + 7 * ONE_DAY).toISOString().slice(0, 10)

      const actual = await db.collection('revenue_metrics')
        .where({ date: db.command.gte(actualStart).and(db.command.lte(actualEnd)) })
        .get()
        .then(r => r.data.reduce((s, m) => s + (m.grossRevenue || 0), 0))
        .catch(() => 0)

      if (predicted7d > 0 && actual > 0) {
        const error = Math.abs(actual - predicted7d) / predicted7d
        totalError += error
        count++
      }
    }

    const avgError = count > 0 ? Math.round((totalError / count) * 10000) / 100 : 0
    const accuracy = count > 0 ? Math.round((1 - avgError / 100) * 100) : null

    return { accuracy, avgErrorPercent: avgError, samples: count,
      evaluation: accuracy && accuracy > 80 ? 'good' : accuracy && accuracy > 60 ? 'acceptable' : 'poor' }
  } catch (err) {
    console.error('[revenueForecaster] getForecastAccuracy 异常:', err.message)
    return { error: err.message }
  }
}

module.exports = {
  forecast,
  getLatestForecast,
  getForecastAccuracy,
}
