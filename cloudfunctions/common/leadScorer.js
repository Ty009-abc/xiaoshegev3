/**
 * leadScorer.js — 线索评分引擎（第六册 Part 4）
 *
 * 评分维度（权重）：
 *   AI使用频率  25%  — 日活/周活
 *   付费记录    25%  — 累计付费金额/频次
 *   CV认知值    20%  — 认知成长值
 *   分享/裂变   15%  — 分享数/邀请数
 *   互动深度    15%  — 连续天数/挑战次数
 *
 * 分数 0-100
 *   > 80  → 高价值线索 (hot lead)
 *   50-80 → 潜力线索 (warm lead)
 *   < 50  → 低价值 (cold lead)
 *
 * 核心用途：
 *   聚焦 200 个高净值核心用户
 */
const now = () => Date.now()

// ── 评分维度定义 ──
const SCORING_DIMENSIONS = {
  engagement:  { label: '互动深度',   weight: 15, maxScore: 100 },
  aiUsage:     { label: 'AI使用频率', weight: 25, maxScore: 100 },
  payment:     { label: '付费记录',   weight: 25, maxScore: 100 },
  cognition:   { label: 'CV认知值',  weight: 20, maxScore: 100 },
  sharing:     { label: '分享/裂变',  weight: 15, maxScore: 100 },
}

// ── 评分基准 ──
const LEAD_TIERS = [
  { tier: 'hot',   min: 80, label: '高价值线索', color: '#e74c3c', action: '立即联系' },
  { tier: 'warm',  min: 50, label: '潜力线索',   color: '#f39c12', action: '持续培育' },
  { tier: 'cold',  min: 0,  label: '低优先级',   color: '#95a5a6', action: '公域运营' },
]

// ═══════════════════════════
// scoreLead — 为单个用户评分
// ═══════════════════════════

async function scoreLead(db, openid) {
  const ts = now()

  try {
    // 收集用户数据
    let profile = {}
    try {
      const user = await db.collection('users').where({ openid }).limit(1).get()
        .then(r => r.data[0]).catch(() => null)
      if (user) {
        profile = {
          cv: user.cv || 0,
          totalChallenges: user.totalChallenges || 0,
          streakDays: user.streakDays || 0,
          totalShares: user.totalShares || 0,
          totalInvites: user.totalInvites || 0,
          totalPaid: user.totalPaid || 0,
          lastActiveAt: user.lastActiveAt || user.updatedAt || ts,
          membershipType: user.membershipType || null,
          hasReport: user.hasReport || false,
        }
      }
    } catch (_) {}

    // AI 使用频率（通过记录计算）
    let aiChatCount = 0, aiUsageScore = 0
    try {
      aiChatCount = await db.collection('ai_logs')
        .where({ openid, createdAt: db.command.gte(ts - 7 * 86400000) })
        .count().then(r => r.total).catch(() => 0)
    } catch (_) {}
    // AI使用评分
    if (aiChatCount > 20) aiUsageScore = 100
    else if (aiChatCount > 10) aiUsageScore = 80
    else if (aiChatCount > 5) aiUsageScore = 60
    else if (aiChatCount > 0) aiUsageScore = 30
    else aiUsageScore = 0

    // 分享/邀请评分
    const shareScore = _scoreSharing(profile.totalShares || 0, profile.totalInvites || 0)

    // 付费评分
    const paymentScore = _scorePayment(profile)

    // CV评分
    const cvScore = _scoreCv(profile.cv || 0)

    // 互动深度评分
    const engagementScore = _scoreEngagement(profile)

    // ═══ 加权总评分 ═══
    const breakdown = {
      aiUsage:     { score: aiUsageScore,     weight: SCORING_DIMENSIONS.aiUsage.weight,     weighted: Math.round(aiUsageScore * 0.25 * 100) / 100 },
      payment:     { score: paymentScore,     weight: SCORING_DIMENSIONS.payment.weight,     weighted: Math.round(paymentScore * 0.25 * 100) / 100 },
      cognition:   { score: cvScore,          weight: SCORING_DIMENSIONS.cognition.weight,   weighted: Math.round(cvScore * 0.20 * 100) / 100 },
      sharing:     { score: shareScore,       weight: SCORING_DIMENSIONS.sharing.weight,     weighted: Math.round(shareScore * 0.15 * 100) / 100 },
      engagement:  { score: engagementScore,  weight: SCORING_DIMENSIONS.engagement.weight,  weighted: Math.round(engagementScore * 0.15 * 100) / 100 },
    }

    const totalScore = Math.round(
      aiUsageScore * 0.25 +
      paymentScore * 0.25 +
      cvScore * 0.20 +
      shareScore * 0.15 +
      engagementScore * 0.15
    )

    const tier = LEAD_TIERS.find(t => totalScore >= t.min) || LEAD_TIERS[2]

    const result = {
      openid,
      leadScore: totalScore,
      tier: tier.tier,
      tierLabel: tier.label,
      tierAction: tier.action,
      breakdown,
      scoredAt: ts,
    }

    // 写入 lead_scores
    try {
      const exist = await db.collection('lead_scores').where({ openid }).limit(1).get()
      if (exist.data.length > 0) {
        await db.collection('lead_scores').doc(exist.data[0]._id).update({
          data: { ...result, updatedAt: ts },
        })
      } else {
        await db.collection('lead_scores').add({ data: { ...result, createdAt: ts } })
      }
    } catch (_) {}

    // 高分线索自动标记 CRM
    if (totalScore >= 80) {
      try {
        const crmEngine = require('./crmEngine.js')
        await crmEngine.upsertContact(db, {
          openid,
          segment: profile.membershipType ? 'vip' : profile.hasReport ? 'report' : 'free',
          source: 'lead_scorer',
          tags: ['high_value', 'hot_lead'],
          extra: { leadScore: totalScore },
        })
      } catch (_) {}
    }

    return result
  } catch (err) {
    console.error('[leadScorer] scoreLead 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// scoreAllLeads — 批量评分
// ═══════════════════════════

async function scoreAllLeads(db, limit = 200) {
  const ts = now()
  const results = []

  try {
    const users = await db.collection('users')
      .where({ cv: db.command.gt(0) })
      .orderBy('cv', 'desc')
      .limit(limit)
      .get()
      .catch(() => ({ data: [] }))

    for (const user of users.data) {
      try {
        const score = await scoreLead(db, user.openid)
        results.push(score)
      } catch (_) {}
    }

    return {
      scored: results.length,
      total: users.data.length,
      hotLeads: results.filter(r => r.leadScore >= 80).length,
      warmLeads: results.filter(r => r.leadScore >= 50 && r.leadScore < 80).length,
      coldLeads: results.filter(r => r.leadScore < 50).length,
      results,
      scoredAt: ts,
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getTopLeads — Top 高价值线索
// ═══════════════════════════

async function getTopLeads(db, limit = 50) {
  try {
    const top = await db.collection('lead_scores')
      .orderBy('leadScore', 'desc')
      .limit(limit)
      .get()
      .catch(() => ({ data: [] }))

    return top.data.map(l => ({
      openid: l.openid,
      leadScore: l.leadScore,
      tier: l.tier,
      tierLabel: l.tierLabel,
    }))
  } catch (_) {
    return []
  }
}

// ═══════════════════════════
// getLeadScoreDistribution — 评分分布
// ═══════════════════════════

async function getLeadScoreDistribution(db) {
  try {
    const all = await db.collection('lead_scores').get().catch(() => ({ data: [] }))
    const dist = { hot: 0, warm: 0, cold: 0 }
    all.data.forEach(l => {
      if (l.leadScore >= 80) dist.hot++
      else if (l.leadScore >= 50) dist.warm++
      else dist.cold++
    })

    return {
      total: all.data.length,
      distribution: dist,
      hotPercent: all.data.length > 0 ? Math.round((dist.hot / all.data.length) * 10000) / 100 : 0,
      highValueDensity: all.data.length > 0 ? Math.round((dist.hot / all.data.length) * 10000) / 100 : 0,
    }
  } catch (_) {
    return { total: 0, distribution: { hot: 0, warm: 0, cold: 0 } }
  }
}

// ═══════════════════════════
// getScoringDimensions — 获取评分维度
// ═══════════════════════════

function getScoringDimensions() {
  return SCORING_DIMENSIONS
}

// ═══════════════════════════
// 辅助评分函数
// ═══════════════════════════

function _scoreSharing(totalShares, totalInvites) {
  const combined = (totalShares || 0) + (totalInvites || 0) * 2 // 邀请权重×2
  if (combined > 20) return 100
  if (combined > 10) return 80
  if (combined > 5) return 60
  if (combined > 0) return 30
  return 0
}

function _scorePayment(profile) {
  const paid = profile.totalPaid || 0
  if (paid > 50000) return 100     // > 500元
  if (paid > 20000) return 80      // > 200元
  if (paid > 9900) return 60       // > 99元
  if (paid > 0) return 40
  return 0
}

function _scoreCv(cv) {
  if (cv > 500) return 100
  if (cv > 300) return 80
  if (cv > 200) return 60
  if (cv > 100) return 40
  if (cv > 50) return 20
  return 0
}

function _scoreEngagement(profile) {
  const streak = profile.streakDays || 0
  const challenges = profile.totalChallenges || 0
  let score = 0
  if (streak > 30) score += 40
  else if (streak > 14) score += 25
  else if (streak > 7) score += 15
  else if (streak > 0) score += 5

  if (challenges > 20) score += 60
  else if (challenges > 10) score += 40
  else if (challenges > 5) score += 25
  else if (challenges > 0) score += 10

  return Math.min(100, score)
}

module.exports = {
  SCORING_DIMENSIONS,
  LEAD_TIERS,
  scoreLead,
  scoreAllLeads,
  getTopLeads,
  getLeadScoreDistribution,
  getScoringDimensions,
}
