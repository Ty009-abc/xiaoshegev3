/**
 * cloudfunctions/common/weeklyReportGenerator.js — 每周认知复盘报告（第五册 Part 5）
 *
 * 职责：
 *   1. 每周自动生成成长报告
 *   2. 认知值变化 / 成长趋势 / 主要弱点 / 本周暴击 / 下周建议
 *   3. 写入 weekly_reports 集合
 *   4. 支持 AI 增强（调用 aiEngine）
 *
 * 结构：
 *   cognitionChange / growthTrend / weaknesses / insights / recommendations
 */
const now = () => Date.now()
const ONE_DAY = 86400000
const ONE_WEEK = 7 * ONE_DAY

// ═══════════════════════════
// generateWeeklyReport — 核心函数
// ═══════════════════════════

/**
 * @param {object} db
 * @param {string} openid
 * @param {object} options — { weekStart, weekEnd, useAI }
 * @returns {object} weekly report
 */
async function generateWeeklyReport(db, openid, options = {}) {
  const ts = now()
  const weekEnd = options.weekEnd || ts
  const weekStart = options.weekStart || weekEnd - ONE_WEEK

  try {
    // 1. 收集本周数据
    const [metricsRes, eventsRes, lastWeekReportRes] = await Promise.all([
      db.collection('membership_metrics').where({ openid }).limit(1).get(),
      db.collection('funnel_events')
        .where({ openid, timestamp: db.command.gte(weekStart).and(db.command.lte(weekEnd)) })
        .orderBy('timestamp', 'asc')
        .limit(200)
        .get(),
      db.collection('weekly_reports')
        .where({ openid })
        .orderBy('weekEnd', 'desc')
        .limit(1)
        .get().catch(() => ({ data: [] })),
    ])

    const metrics = metricsRes.data[0] || {}
    const events = eventsRes.data || []
    const lastReport = lastWeekReportRes.data[0]

    // ═══════════════════
    // 2. 认知值变化
    // ═══════════════════
    const xp = metrics.xp || 0
    const lastXp = lastReport?.xp || 0
    const xpChange = xp - lastXp
    const xpChangePercent = lastXp > 0 ? Math.round((xpChange / lastXp) * 100) : 0

    // ═══════════════════
    // 3. 活动统计
    // ═══════════════════
    const insightCount = events.filter(e => e.event === 'insight_read').length
    const aiChatCount = events.filter(e => e.event === 'ai_chat').length
    const challengeCount = events.filter(e => e.event === 'challenge_start').length
    const challengeFinishCount = events.filter(e => e.event === 'challenge_finish').length
    const totalActions = insightCount + aiChatCount + challengeCount

    // ═══════════════════
    // 4. 成长趋势分析
    // ═══════════════════
    const growthTrend = _analyzeGrowthTrend(events, lastReport)

    // ═══════════════════
    // 5. 弱点识别
    // ═══════════════════
    const weaknesses = _identifyWeaknesses(events, metrics)

    // ═══════════════════
    // 6. 本周暴击
    // ═══════════════════
    const insights = _extractInsights(events, growthTrend)

    // ═══════════════════
    // 7. 下周建议
    // ═══════════════════
    const recommendations = _generateRecommendations(growthTrend, weaknesses, metrics)

    // ═══════════════════
    // 8. 组装报告
    // ═══════════════════
    const report = {
      openid,
      weekStart,
      weekEnd,
      xp,
      xpChange,
      xpChangePercent,
      level: _xpToLevel(xp),
      levelName: _levelName(_xpToLevel(xp)),
      cognitionChange: {
        xp, xpChange, xpChangePercent,
        trend: xpChange > 0 ? 'up' : xpChange < 0 ? 'down' : 'flat',
      },
      activitySummary: {
        totalActions,
        insightCount,
        aiChatCount,
        challengeCount,
        challengeFinishCount,
        challengeCompletionRate: challengeCount > 0 ? Math.round((challengeFinishCount / challengeCount) * 100) : 0,
      },
      growthTrend,
      weaknesses,
      insights,
      recommendations,
      streak: metrics.streak || 0,
      generatedAt: ts,
      aiEnhanced: false,
    }

    // 写入 weekly_reports
    await db.collection('weekly_reports').add({ data: { ...report, createdAt: ts } })

    return report
  } catch (err) {
    console.error('[weeklyReportGenerator] generateWeeklyReport 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// getLatestWeeklyReport
// ═══════════════════════════

async function getLatestWeeklyReport(db, openid) {
  try {
    const res = await db.collection('weekly_reports')
      .where({ openid })
      .orderBy('weekEnd', 'desc')
      .limit(1)
      .get()
    return res.data[0] || null
  } catch (_) {
    return null
  }
}

// ═══════════════════════════
// getWeeklyReports — 历史周报
// ═══════════════════════════

async function getWeeklyReports(db, openid, limit = 12) {
  try {
    const res = await db.collection('weekly_reports')
      .where({ openid })
      .orderBy('weekEnd', 'desc')
      .limit(limit)
      .get()
    return res.data
  } catch (_) {
    return []
  }
}

// ═══════════════════════════
// batchGenerate — 批量生成所有活跃会员周报
// ═══════════════════════════

async function batchGenerate(db, limit = 200) {
  const members = await db.collection('memberships')
    .where({ status: 'active' })
    .limit(limit)
    .get()

  const results = []
  for (const m of members.data) {
    try {
      const report = await generateWeeklyReport(db, m.openid)
      results.push({ openid: m.openid, success: !report.error })
    } catch (_) {
      results.push({ openid: m.openid, success: false })
    }
  }

  return { total: members.data.length, generated: results.filter(r => r.success).length, results }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

function _analyzeGrowthTrend(events, lastReport) {
  const trend = { direction: 'stable', momentum: 0, details: [] }

  if (!events.length) {
    trend.direction = 'inactive'
    trend.details.push('本周无活动')
    return trend
  }

  // 按天分组
  const byDay = {}
  events.forEach(e => {
    const day = new Date(e.timestamp).toISOString().slice(0, 10)
    if (!byDay[day]) byDay[day] = 0
    byDay[day]++
  })

  const days = Object.keys(byDay).sort()
  if (days.length >= 3) {
    const first3 = days.slice(0, 3).reduce((s, d) => s + byDay[d], 0)
    const last3 = days.slice(-3).reduce((s, d) => s + byDay[d], 0)
    if (last3 > first3 * 1.2) {
      trend.direction = 'accelerating'
      trend.momentum = Math.min(100, Math.round(((last3 - first3) / Math.max(first3, 1)) * 100))
      trend.details.push('后期活动量明显上升')
    } else if (last3 < first3 * 0.7) {
      trend.direction = 'slowing'
      trend.momentum = Math.min(100, Math.round(((first3 - last3) / Math.max(first3, 1)) * 100))
      trend.details.push('后期活动量下降')
    } else {
      trend.direction = 'consistent'
      trend.momentum = 0
      trend.details.push('活动量稳定')
    }
  }

  // vs 上周
  if (lastReport?.xp) trend.details.push('与上周比较已生成（见认知值变化）')
  else trend.details.push('暂无上周对比数据')

  return trend
}

function _identifyWeaknesses(events, metrics) {
  const weaknesses = []

  const insightCount = events.filter(e => e.event === 'insight_read').length
  const aiCount = events.filter(e => e.event === 'ai_chat').length
  const challengeFinish = events.filter(e => e.event === 'challenge_finish').length
  const challengeStart = events.filter(e => e.event === 'challenge_start').length

  if (insightCount < 3) weaknesses.push({ area: '认知暴击', severity: 'medium',
    detail: '本周认知暴击阅读不足（<3次）', suggestion: '每天只需要2分钟看一条暴击' })
  if (aiCount < 3) weaknesses.push({ area: 'AI对话', severity: 'medium',
    detail: 'AI深度对话不足', suggestion: '试着问小事哥一个你一直想不通的问题' })
  if (challengeStart > 0 && challengeFinish < challengeStart * 0.5) {
    weaknesses.push({ area: '挑战完成率', severity: 'high',
      detail: `本周挑战完成率仅 ${Math.round((challengeFinish / challengeStart) * 100)}%`,
      suggestion: '完整做完一次挑战，你会看到自己的认知地图' })
  }
  if (totalActivity(events) === 0) {
    weaknesses.push({ area: '总体参与', severity: 'high',
      detail: '本周完全无活动', suggestion: '回来打开今天的认知暴击' })
  }

  return weaknesses
}

function _extractInsights(events, trend) {
  const insights = []

  if (trend.direction === 'accelerating') {
    insights.push({ type: 'positive', text: '你正在加速升级你的认知系统' })
  }
  if (trend.direction === 'slowing') {
    insights.push({ type: 'warning', text: '你的认知成长速度在放缓，可能是遇到了瓶颈' })
  }
  if (trend.direction === 'consistent') {
    insights.push({ type: 'positive', text: '你在稳步前进，坚持是最强的策略' })
  }

  const challengeCount = events.filter(e => e.event === 'challenge_start').length
  if (challengeCount >= 5) {
    insights.push({ type: 'positive', text: '高挑战参与度表明你在主动寻找认知突破点' })
  }

  return insights
}

function _generateRecommendations(trend, weaknesses, metrics) {
  const recs = []

  if (weaknesses.some(w => w.area === '总体参与' && w.severity === 'high')) {
    recs.push({ priority: 1, action: '每天打开小事哥看一条认知暴击', reason: '2分钟即可启动成长惯性' })
  }

  if (weaknesses.some(w => w.area === 'AI对话')) {
    recs.push({ priority: 2, action: '尝试用AI分析一个你最近困惑的问题', reason: '深度对话是最快的认知加速器' })
  }

  if (weaknesses.some(w => w.area === '挑战完成率')) {
    recs.push({ priority: 1, action: '完整做完一轮挑战', reason: '挑战是你认知边界的探测雷达' })
  }

  if (metrics.streak >= 6) {
    recs.push({ priority: 3, action: `保持签到 — 再坚持 ${7 - (metrics.streak % 7)} 天达成连续7天奖励`, reason: '习惯正在形成' })
  }

  if (recs.length === 0) {
    recs.push({ priority: 3, action: '继续坚持现有节奏', reason: '稳定的认知训练最有效' })
  }

  return recs
}

function totalActivity(events) {
  return events.filter(e => ['insight_read', 'ai_chat', 'challenge_start', 'challenge_finish'].includes(e.event)).length
}

function _xpToLevel(xp) {
  if (xp >= 5000) return 'premium'
  if (xp >= 2000) return 'yearly_vip'
  if (xp >= 500) return 'vip'
  if (xp >= 100) return 'report_buyer'
  return 'free'
}

function _levelName(level) {
  const names = { free: '观察者', report_buyer: '觉察者', vip: '认知升级者', yearly_vip: '系统操盘者', premium: '内圈成员' }
  return names[level] || '观察者'
}

module.exports = {
  generateWeeklyReport,
  getLatestWeeklyReport,
  getWeeklyReports,
  batchGenerate,
}
