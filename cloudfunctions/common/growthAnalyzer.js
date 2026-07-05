/**
 * cloudfunctions/common/growthAnalyzer.js — 增长分析引擎（第六册 Part 1）
 *
 * 核心分析能力：
 *   1. 增长健康度评分
 *   2. 漏斗瓶颈检测
 *   3. 增长趋势预测
 *   4. 增长飞轮状态
 *   5. 增长建议生成
 */
const now = () => Date.now()
const ONE_DAY = 86400000

// 权重配置
const HEALTH_WEIGHTS = {
  dauGrowth:       25, // DAU 增长率
  shareRate:       25, // 分享率
  inviteRate:      20, // 邀请转化率
  kFactor:         15, // K-Factor
  retention:       15, // 次日留存
}

// ═══════════════════════════
// analyzeGrowthHealth — 增长健康度评分
// ═══════════════════════════

async function analyzeGrowthHealth(db) {
  const ts = now()

  try {
    // 获取基础数据
    const growthTracker = require('./growthTracker.js')
    const summary = await growthTracker.getGrowthSummary(db)
    if (summary.error) return summary

    let score = 0

    // 1. DAU 增长（近3天 vs 前3天）
    const trend = summary.trend || []
    if (trend.length >= 6) {
      const recent3 = trend.slice(-3).reduce((s, t) => s + t.dau, 0)
      const older3 = trend.slice(0, 3).reduce((s, t) => s + t.dau, 0)
      const dauGrowth = older3 > 0 ? (recent3 - older3) / older3 : 0
      if (dauGrowth > 0.2) score += HEALTH_WEIGHTS.dauGrowth
      else if (dauGrowth > 0) score += HEALTH_WEIGHTS.dauGrowth * 0.6
      else score += HEALTH_WEIGHTS.dauGrowth * 0.1
    }

    // 2. 分享率
    const shareRate = summary.shareRate || 0
    if (shareRate > 30) score += HEALTH_WEIGHTS.shareRate
    else if (shareRate > 15) score += HEALTH_WEIGHTS.shareRate * 0.7
    else if (shareRate > 5) score += HEALTH_WEIGHTS.shareRate * 0.3

    // 3. 邀请转化率
    const inviteRate = summary.inviteRate || 0
    if (inviteRate > 40) score += HEALTH_WEIGHTS.inviteRate
    else if (inviteRate > 20) score += HEALTH_WEIGHTS.inviteRate * 0.7
    else if (inviteRate > 5) score += HEALTH_WEIGHTS.inviteRate * 0.3

    // 4. K-Factor
    const kFactor = summary.kFactor || 0
    if (kFactor > 1) score += HEALTH_WEIGHTS.kFactor
    else if (kFactor > 0.5) score += HEALTH_WEIGHTS.kFactor * 0.7
    else if (kFactor > 0.2) score += HEALTH_WEIGHTS.kFactor * 0.3

    // 5. 次日留存 (approximation: challenge_attrition)
    const yesterday = new Date(ts - ONE_DAY).toISOString().slice(0, 10)
    const yesterdayEnter = await db.collection('growth_events')
      .where({ event: 'mini_enter', date: yesterday })
      .count().then(r => r.total).catch(() => 0)
    const todayReenter = await db.collection('growth_events')
      .where({ event: 'mini_enter', date: new Date(ts).toISOString().slice(0, 10) })
      .count().then(r => r.total).catch(() => 0)
    const retentionRate = yesterdayEnter > 0 ? Math.min(1, todayReenter / yesterdayEnter) : 0
    if (retentionRate > 0.5) score += HEALTH_WEIGHTS.retention
    else if (retentionRate > 0.3) score += HEALTH_WEIGHTS.retention * 0.6
    else score += HEALTH_WEIGHTS.retention * 0.2

    const status = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'warning' : 'critical'

    // 增长建议
    const suggestions = _generateHealthSuggestions({
      shareRate,
      inviteRate,
      kFactor,
      retentionRate,
      dauGrowth: trend.length >= 6
        ? (trend.slice(-3).reduce((s, t) => s + t.dau, 0) / Math.max(trend.slice(0, 3).reduce((s, t) => s + t.dau, 0), 1) - 1)
        : 0,
    })

    return {
      healthScore: Math.round(score),
      status,
      breakdown: {
        dauGrowth:    { score: Math.round(score * HEALTH_WEIGHTS.dauGrowth / 100), weight: HEALTH_WEIGHTS.dauGrowth },
        shareRate:    { score: Math.round(shareRate > 30 ? 25 : shareRate > 15 ? 17.5 : shareRate > 5 ? 7.5 : 0), weight: HEALTH_WEIGHTS.shareRate },
        inviteRate:   { score: Math.round(inviteRate > 40 ? 20 : inviteRate > 20 ? 14 : inviteRate > 5 ? 6 : 0), weight: HEALTH_WEIGHTS.inviteRate },
        kFactor:      { score: Math.round(kFactor > 1 ? 15 : kFactor > 0.5 ? 10.5 : kFactor > 0.2 ? 4.5 : 0), weight: HEALTH_WEIGHTS.kFactor },
        retention:    { score: Math.round(retentionRate > 0.5 ? 15 : retentionRate > 0.3 ? 9 : 3), weight: HEALTH_WEIGHTS.retention },
      },
      retentionRate: Math.round(retentionRate * 10000) / 100,
      suggestions,
      analysedAt: ts,
    }
  } catch (err) {
    console.error('[growthAnalyzer] analyzeGrowthHealth 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// detectBottleneck — 漏斗瓶颈检测
// ═══════════════════════════

async function detectBottleneck(db) {
  try {
    const growthTracker = require('./growthTracker.js')
    const summary = await growthTracker.getGrowthSummary(db)
    if (summary.error) return summary

    const rates = summary.rates || {}
    const bottlenecks = []

    // 标准转化率基线
    const baselines = {
      videoToLanding:  { good: 50, ok: 30, stage: '短视频 → 落地页', fix: '优化视频封面和前三秒钩子' },
      landingToMini:   { good: 40, ok: 20, stage: '落地页 → 小程序', fix: '强化进入按钮视觉、加急迫感文案' },
      miniToChallenge: { good: 60, ok: 35, stage: '进入 → 开始挑战', fix: '首页强化认知钩子、减少无关内容' },
      challengeDone:   { good: 70, ok: 45, stage: '挑战 → 完成', fix: '挑战题目控制在 5-7 题、进度条可视化' },
      doneToShare:     { good: 25, ok: 10, stage: '完成 → 分享', fix: '优化结果卡片可分享性、加社交货币文案' },
      shareToInvite:   { good: 30, ok: 15, stage: '分享 → 邀请成功', fix: '分享卡片加强 CTA、落地页优化' },
    }

    for (const [key, config] of Object.entries(baselines)) {
      const rate = rates[key] || 0
      if (rate < config.ok) {
        bottlenecks.push({
          stage: config.stage,
          currentRate: rate,
          target: config.good,
          gap: config.good - rate,
          severity: rate < config.ok / 2 ? 'critical' : 'warning',
          fix: config.fix,
        })
      }
    }

    // 排序：最严重的在前
    bottlenecks.sort((a, b) => {
      const sev = { critical: 3, warning: 2, ok: 1 }
      return (sev[b.severity] || 0) - (sev[a.severity] || 0)
    })

    return {
      bottlenecks,
      worstBottleneck: bottlenecks[0] || null,
      healthy: bottlenecks.length === 0,
      totalBottlenecks: bottlenecks.length,
      analysedAt: now(),
    }
  } catch (err) {
    console.error('[growthAnalyzer] detectBottleneck 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// analyzeFlywheel — 增长飞轮状态
// ═══════════════════════════

async function analyzeFlywheel(db) {
  try {
    const growthTracker = require('./growthTracker.js')
    const summary = await growthTracker.getGrowthSummary(db)
    if (summary.error) return summary

    const { kFactor, shareRate, inviteRate, dau } = summary

    // 飞轮阶段判定
    let stage, energy, nextAction

    if (kFactor > 1.2) {
      stage = 'viral'
      energy = '🔥🔥🔥 自增长引擎运转中'
      nextAction = '加大内容供给、维持病毒传播'
    } else if (kFactor > 0.8) {
      stage = 'spinning'
      energy = '🔥🔥 飞轮加速中'
      nextAction = '优化邀请机制、增加分享触点'
    } else if (kFactor > 0.3) {
      stage = 'starting'
      energy = '🔥 飞轮刚开始转'
      nextAction = '提升内容质量 → 提升分享率 → 触发裂变'
    } else {
      stage = 'manual'
      energy = '❄️ 需要手动推动'
      nextAction = '当前主要靠外部推广。优先提升挑战完成→分享转化'
    }

    // 飞轮各环节健康度
    const flywheel = {
      content:   { rating: dau > 50 ? 'good' : 'weak', metric: `DAU ${dau}`,
        suggestion: dau < 50 ? '需要更多内容引流' : '继续' },
      traffic:   { rating: summary.rates?.videoToLanding > 30 ? 'good' : 'weak',
        metric: `视频→落地 ${summary.rates?.videoToLanding || 0}%` },
      experience:{ rating: summary.rates?.challengeDone > 50 ? 'good' : 'weak',
        metric: `挑战完成率 ${summary.rates?.challengeDone || 0}%` },
      share:     { rating: shareRate > 15 ? 'good' : 'weak',
        metric: `分享率 ${shareRate}%` },
      invite:    { rating: inviteRate > 20 ? 'good' : 'weak',
        metric: `邀请转化 ${inviteRate}%` },
    }

    return {
      stage, energy, nextAction,
      kFactor, shareRate, inviteRate,
      flywheel,
      analysedAt: now(),
    }
  } catch (err) {
    console.error('[growthAnalyzer] analyzeFlywheel 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

function _generateHealthSuggestions(data) {
  const suggestions = []

  if (data.dauGrowth < 0) {
    suggestions.push({ priority: 1, issue: 'DAU 下降', action: '检查流量来源是否中断、内容更新频率是否下降' })
  }
  if (data.shareRate < 10) {
    suggestions.push({ priority: 1, issue: '分享率低于10%', action: '强化结果卡片分享 -> 加入"炫耀型"文案和对比数据' })
  }
  if (data.inviteRate < 15) {
    suggestions.push({ priority: 2, issue: '邀请转化率偏低', action: '优化分享卡片落地页、考虑双人奖励机制' })
  }
  if (data.kFactor < 0.3) {
    suggestions.push({ priority: 2, issue: 'K-Factor < 0.3', action: '需要至少 3 个分享触点 + 强化邀请奖励' })
  }
  if (data.retentionRate < 0.3) {
    suggestions.push({ priority: 3, issue: '次日留存 < 30%', action: '首日体验后 push 再访提醒、每日认知签到' })
  }

  if (suggestions.length === 0) {
    suggestions.push({ priority: 3, issue: '增长健康', action: '保持当前策略' })
  }

  return suggestions.sort((a, b) => a.priority - b.priority)
}

module.exports = {
  analyzeGrowthHealth,
  detectBottleneck,
  analyzeFlywheel,
}
