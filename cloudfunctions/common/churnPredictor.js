/**
 * cloudfunctions/common/churnPredictor.js — 流失预测（第五册 Part 5）
 *
 * 职责：
 *   1. 计算 churnRiskScore 0-100
 *   2. 高于 70 → 触发召回
 *   3. 写入 churn_predictions 集合
 *
 * 5 维加权模型:
 *   daysSinceLogin(30%) + aiUsageDrop(20%) + challengeDrop(15%)
 *   + streakLost(15%) + approachingExpiry(20%)
 */
const { CHURN_WEIGHTS } = require('./membershipEngine.js')
const { getRecallMessage } = require('./renewalManager.js')

const now = () => Date.now()
const ONE_DAY = 86400000

// ═══════════════════════════
// predictChurnRisk — 核心算法
// ═══════════════════════════

/**
 * @returns {{ riskScore, riskLevel, factors[], recommendation }}
 */
async function predictChurnRisk(db, openid) {
  const ts = now()
  const factors = []
  let totalScore = 0

  try {
    // 收集数据
    const [metricsRes, funnelRes, memberRes, chatRes] = await Promise.all([
      db.collection('membership_metrics').where({ openid }).limit(1).get(),
      db.collection('user_funnel_state').where({ openid }).limit(1).get(),
      db.collection('memberships').where({ openid, status: 'active' }).limit(1).get(),
      db.collection('funnel_events')
        .where({ openid, event: 'ai_chat' })
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get().catch(() => ({ data: [] })),
    ])

    const metrics = metricsRes.data[0] || {}
    const funnel = funnelRes.data[0] || {}
    const member = memberRes.data[0]

    // ── Factor 1: Days Since Last Login (30%) ──
    const lastEvent = funnel.lastEventAt || metrics.lastCheckIn || 0
    const daysSinceLogin = lastEvent ? Math.max(0, Math.floor((ts - lastEvent) / ONE_DAY)) : 30
    const loginScore = Math.min(100, daysSinceLogin * 8)  // 每 1 天 ≈ 8 分，12.5 天满
    totalScore += loginScore * CHURN_WEIGHTS.daysSinceLogin
    factors.push({ name: 'daysSinceLogin', value: daysSinceLogin, weight: CHURN_WEIGHTS.daysSinceLogin, subScore: Math.round(loginScore * CHURN_WEIGHTS.daysSinceLogin) })

    // ── Factor 2: AI Usage Drop (20%) ──
    const chats = chatRes.data || []
    const aiUsageDrop = _computeUsageDrop(chats, ts)
    const aiScore = Math.min(100, aiUsageDrop * 5)  // 每 1% 下降 ≈ 5 分
    totalScore += aiScore * CHURN_WEIGHTS.aiUsageDrop
    factors.push({ name: 'aiUsageDrop', value: aiUsageDrop + '%', weight: CHURN_WEIGHTS.aiUsageDrop, subScore: Math.round(aiScore * CHURN_WEIGHTS.aiUsageDrop) })

    // ── Factor 3: Challenge Drop (15%) ──
    const challengeEvents = await db.collection('funnel_events')
      .where({ openid, event: db.command.in(['challenge_start', 'challenge_finish']) })
      .orderBy('timestamp', 'desc')
      .limit(30)
      .get().catch(() => ({ data: [] }))
    const challengeDrop = _computeUsageDrop(challengeEvents.data, ts)
    const challengeScore = Math.min(100, challengeDrop * 4)
    totalScore += challengeScore * CHURN_WEIGHTS.challengeDrop
    factors.push({ name: 'challengeDrop', value: challengeDrop + '%', weight: CHURN_WEIGHTS.challengeDrop, subScore: Math.round(challengeScore * CHURN_WEIGHTS.challengeDrop) })

    // ── Factor 4: Streak Lost (15%) ──
    const streak = metrics.streak || 0
    const lastCheckInDate = metrics.lastCheckInDate || ''
    const todayStr = new Date(ts).toISOString().slice(0, 10)
    const yesterdayStr = new Date(ts - ONE_DAY).toISOString().slice(0, 10)
    const streakBroken = lastCheckInDate && lastCheckInDate !== todayStr && lastCheckInDate !== yesterdayStr
    const streakScore = streakBroken ? (streak >= 30 ? 80 : streak >= 7 ? 60 : 40) : 0
    totalScore += streakScore * CHURN_WEIGHTS.streakLost
    factors.push({ name: 'streakLost', value: streakBroken ? 'broken' : 'intact', streak, weight: CHURN_WEIGHTS.streakLost, subScore: Math.round(streakScore * CHURN_WEIGHTS.streakLost) })

    // ── Factor 5: Approaching Expiry (20%) ──
    let expiryScore = 0
    if (member) {
      const daysUntilExpiry = Math.max(0, Math.ceil((member.expiredAt - ts) / ONE_DAY))
      if (daysUntilExpiry <= 3) expiryScore = 90
      else if (daysUntilExpiry <= 7) expiryScore = 60
      else if (daysUntilExpiry <= 14) expiryScore = 30
    }
    totalScore += expiryScore * CHURN_WEIGHTS.approachingExpiry
    factors.push({ name: 'approachingExpiry', value: member ? `${Math.ceil((member.expiredAt - ts) / ONE_DAY)}天` : '无会员', weight: CHURN_WEIGHTS.approachingExpiry, subScore: Math.round(expiryScore * CHURN_WEIGHTS.approachingExpiry) })

    const riskScore = Math.round(Math.min(100, totalScore))
    const riskLevel = riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low'
    const recallMessage = riskScore >= 70 ? getRecallMessage(riskScore, { daysSinceLogin, lastActiveAction: funnel.lastEvent || '使用' }) : null

    // 写入 predictions
    const prediction = {
      openid,
      riskScore,
      riskLevel,
      factors,
      recallMessage,
      predictedAt: ts,
      memberType: member?.memberType || null,
      daysSinceLogin,
      streak,
    }

    try {
      const predRes = await db.collection('churn_predictions').where({ openid }).limit(1).get()
      if (predRes.data.length > 0) {
        await db.collection('churn_predictions').doc(predRes.data[0]._id).update({
          data: { ...prediction, updatedAt: ts },
        })
      } else {
        await db.collection('churn_predictions').add({
          data: { ...prediction, createdAt: ts, updatedAt: ts },
        })
      }
    } catch (_) {}

    return { riskScore, riskLevel, factors, recallMessage, recommendation: riskLevel === 'high' ? '立即触发召回' : riskLevel === 'medium' ? '监控中' : '健康' }
  } catch (err) {
    console.error('[churnPredictor] predictChurnRisk 异常:', err.message)
    return { riskScore: 0, riskLevel: 'unknown', error: err.message }
  }
}

// ═══════════════════════════
// batchPredict — 批量预测
// ═══════════════════════════

async function batchPredict(db, limit = 200) {
  const ts = now()
  try {
    const members = await db.collection('memberships')
      .where({ status: 'active' })
      .limit(limit)
      .get()

    const results = []
    for (const m of members.data) {
      const result = await predictChurnRisk(db, m.openid)
      results.push({ openid: m.openid, ...result })
    }

    const highRisk = results.filter(r => r.riskLevel === 'high')
    return { total: results.length, highRiskCount: highRisk.length, highRisk, results }
  } catch (err) {
    console.error('[churnPredictor] batchPredict 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// getHighRiskUsers — 获取高风险用户列表
// ═══════════════════════════

async function getHighRiskUsers(db, minScore = 70) {
  try {
    const res = await db.collection('churn_predictions')
      .where({ riskScore: db.command.gte(minScore) })
      .orderBy('riskScore', 'desc')
      .limit(100)
      .get()
    return res.data
  } catch (err) {
    console.error('[churnPredictor] getHighRiskUsers 异常:', err.message)
    return []
  }
}

// ═══════════════════════════
// 辅助 — 计算使用量下降幅度
// ═══════════════════════════
function _computeUsageDrop(events, ts) {
  if (!events || events.length === 0) return 100  // 完全无使用

  // 最近7天 vs 前7天
  const sevenDaysAgo = ts - 7 * ONE_DAY
  const fourteenDaysAgo = ts - 14 * ONE_DAY

  const recent = events.filter(e => e.timestamp >= sevenDaysAgo).length
  const previous = events.filter(e => e.timestamp >= fourteenDaysAgo && e.timestamp < sevenDaysAgo).length

  if (previous === 0 && recent === 0) return 0
  if (previous === 0 && recent > 0) return -100  // 增长
  if (recent === 0 && previous > 0) return 100   // 完全消失

  const drop = ((previous - recent) / previous) * 100
  return Math.max(0, Math.round(drop))
}

module.exports = {
  predictChurnRisk,
  batchPredict,
  getHighRiskUsers,
}
