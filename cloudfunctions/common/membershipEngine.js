/**
 * cloudfunctions/common/membershipEngine.js — 会员引擎（第五册 Part 5）
 *
 * 职责：
 *   1. 5 级会员等级体系 + XP 经验值
 *   2. 每日签到 + Streak 连续天数
 *   3. 会员权益快照
 *   4. Daily Habit Engine（暴击/AI/挑战三项打卡）
 *   5. KPI 统计：active_members / ARPPU
 */
const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)
const ONE_DAY = 86400000

// ═══════════════════════════
// MEMBERSHIP LEVELS
// ═══════════════════════════
const MEMBERSHIP_LEVELS = {
  free:           { level: 0, name: '观察者',      xpThreshold: 0,    badge: '👀', color: '#888' },
  report_buyer:   { level: 1, name: '觉察者',      xpThreshold: 100,  badge: '🧠', color: '#4ecdc4' },
  vip:            { level: 2, name: '认知升级者',   xpThreshold: 500,  badge: '⚡', color: '#a084dc' },
  yearly_vip:     { level: 3, name: '系统操盘者',   xpThreshold: 2000, badge: '🔮', color: '#f39c12' },
  premium:        { level: 4, name: '内圈成员',     xpThreshold: 5000, badge: '💎', color: '#e74c3c' },
}

// ═══════════════════════════
// XP ACTION DEFINITIONS
// ═══════════════════════════
const XP_ACTIONS = {
  daily_insight:    { xp: 5,  description: '阅读认知暴击',   dailyMax: 5 },
  ai_chat:          { xp: 3,  description: 'AI对话',        dailyMax: 30 },
  challenge_round:  { xp: 5,  description: '完成一轮挑战',   dailyMax: 25 },
  streak_7:         { xp: 20, description: '连续7天',       dailyMax: 1 },
  streak_30:        { xp: 50, description: '连续30天',      dailyMax: 1 },
  streak_90:        { xp: 100,description: '连续90天',      dailyMax: 1 },
  report_unlock:    { xp: 30, description: '解锁报告',       dailyMax: 5 },
  membership_upgrade: { xp: 50, description: '升级会员',     dailyMax: 1 },
  share:            { xp: 10, description: '分享',           dailyMax: 20 },
  invite:           { xp: 15, description: '邀请好友',        dailyMax: 50 },
  rule_read:        { xp: 2,  description: '阅读世界规则',    dailyMax: 10 },
}

// ═══════════════════════════
// STREAK MILESTONES
// ═══════════════════════════
const STREAK_MILESTONES = [
  { days: 7,  reward: { xp: 20, title: '连续7天', description: '一周全勤，认知在升级' } },
  { days: 30, reward: { xp: 50, title: '连续30天', description: '一个月习惯固化' } },
  { days: 90, reward: { xp: 100, title: '连续90天', description: '认知基因已重写' } },
]

// ═══════════════════════════
// RENEWAL PHASES
// ═══════════════════════════
const RENEWAL_PHASES = {
  '7_days':  { daysBefore: 7,  urgency: 'low',    message: '你的认知升级权限将在 7 天后到期' },
  '3_days':  { daysBefore: 3,  urgency: 'medium', message: '仅剩 3 天 — 你的成长数据随时可能中断' },
  'expired': { daysBefore: 0,  urgency: 'high',   message: '续费后可继续保留：成长记录 · AI历史 · 高级权限' },
}

// ═══════════════════════════
// CHURN RISK WEIGHTS
// ═══════════════════════════
const CHURN_WEIGHTS = {
  daysSinceLogin:   0.30,   // 权重最高
  aiUsageDrop:      0.20,
  challengeDrop:    0.15,
  streakLost:       0.15,
  approachingExpiry:0.20,
}

// ═══════════════════════════
// getMembershipProfile — 完整会员画像
// ═══════════════════════════
async function getMembershipProfile(db, openid) {
  const ts = now()
  try {
    const [userRes, memRes, metricsRes, streakRes] = await Promise.all([
      db.collection('users').where({ openid }).limit(1).get(),
      db.collection('memberships').where({ openid, status: 'active' }).limit(1).get(),
      db.collection('membership_metrics').where({ openid }).limit(1).get(),
      db.collection('membership_metrics').where({ openid }).limit(1).get(),
    ])

    const user = userRes.data[0] || {}
    const member = memRes.data[0] || null
    const metrics = metricsRes.data[0] || {}

    // determine level
    let level = 'free'
    if (user.membershipLevel === 'premium') level = 'premium'
    else if (user.membershipLevel && user.membershipLevel !== 'free') {
      level = member?.level === 'yearly' ? 'yearly_vip' : 'vip'
    } else if (user.hasReport) level = 'report_buyer'

    const levelInfo = MEMBERSHIP_LEVELS[level] || MEMBERSHIP_LEVELS.free

    // streak
    const streak = metrics.streak || 0
    const lastCheckIn = metrics.lastCheckIn || 0

    // compute next level
    const nextLevelKey = _nextLevel(level)
    const nextLevelInfo = MEMBERSHIP_LEVELS[nextLevelKey] || null
    const xpToNext = nextLevelInfo ? nextLevelInfo.xpThreshold - (metrics.xp || 0) : 0

    return {
      openid,
      level,
      levelName: levelInfo.name,
      levelBadge: levelInfo.badge,
      levelColor: levelInfo.color,
      xp: metrics.xp || 0,
      xpToNext,
      nextLevel: nextLevelKey,
      nextLevelName: nextLevelInfo?.name || '',
      streak,
      streakMilestones: STREAK_MILESTONES.filter(m => m.days > streak),
      lastCheckIn,
      daysUntilExpiry: member ? Math.max(0, Math.ceil((member.expiredAt - ts) / ONE_DAY)) : 0,
      isExpiringWithin: member ? (member.expiredAt - ts < 7 * ONE_DAY) : false,
      membershipType: member?.memberType || null,
      membershipStartedAt: member?.startedAt || 0,
      membershipExpiredAt: member?.expiredAt || 0,
      perks: _getPerks(level, member?.memberType),
      habits: {
        insight: metrics.insightDays || 0,
        ai: metrics.aiDays || 0,
        challenge: metrics.challengeDays || 0,
      },
    }
  } catch (err) {
    console.error('[membershipEngine] getMembershipProfile 异常:', err.message)
    return { openid, level: 'free', levelName: '观察者', levelBadge: '👀', levelColor: '#888', xp: 0, streak: 0 }
  }
}

// ═══════════════════════════
// checkIn — 每日签到
// ═══════════════════════════
async function checkIn(db, openid) {
  const ts = now()
  const today = _todayKey(ts)

  try {
    const metricsRes = await db.collection('membership_metrics').where({ openid }).limit(1).get()
    let metrics = metricsRes.data[0]
    const yesterday = _todayKey(ts - ONE_DAY)

    if (!metrics) {
      // 新用户
      await db.collection('membership_metrics').add({
        data: {
          openid, xp: 0, streak: 1,
          lastCheckIn: ts, lastCheckInDate: today,
          insightDays: 0, aiDays: 0, challengeDays: 0,
          createdAt: ts, updatedAt: ts,
        },
      })
      return { streak: 1, isNewStreak: true, xpGained: 0, milestone: null }
    }

    if (metrics.lastCheckInDate === today) {
      // 今天已签到
      return { streak: metrics.streak || 0, isNewStreak: false, xpGained: 0, alreadyCheckedIn: true }
    }

    // 计算连续
    const isConsecutive = metrics.lastCheckInDate === yesterday
    const newStreak = isConsecutive ? (metrics.streak || 0) + 1 : 1
    let xpGained = 0
    let milestone = null

    // streak 奖励
    const matchedMilestone = STREAK_MILESTONES.find(m => m.days === newStreak)
    if (matchedMilestone && isConsecutive) {
      xpGained += matchedMilestone.reward.xp
      milestone = matchedMilestone
    }

    // 更新
    await db.collection('membership_metrics').doc(metrics._id).update({
      data: {
        streak: newStreak,
        lastCheckIn: ts,
        lastCheckInDate: today,
        xp: db.command.inc(xpGained),
        updatedAt: ts,
      },
    })

    // 同步 users
    await db.collection('users').where({ openid }).update({
      data: { streak: newStreak, updatedAt: ts },
    })

    return { streak: newStreak, isNewStreak: !isConsecutive, xpGained, milestone }
  } catch (err) {
    console.error('[membershipEngine] checkIn 异常:', err.message)
    return { streak: 0, error: err.message }
  }
}

// ═══════════════════════════
// addXP — 发放经验值
// ═══════════════════════════
async function addXP(db, openid, actionType, count = 1) {
  const ts = now()
  const action = XP_ACTIONS[actionType]
  if (!action) return { xpGained: 0, error: '未知行动类型' }

  try {
    // 检查每日上限
    const today = _todayKey(ts)
    const metricsRes = await db.collection('membership_metrics').where({ openid }).limit(1).get()
    const metrics = metricsRes.data[0]
    const dailyKey = `daily_${actionType}`
    const dailyUsed = metrics?.[dailyKey] || 0

    if (dailyUsed >= action.dailyMax) {
      return { xpGained: 0, dailyCapReached: true }
    }

    const effectiveCount = Math.min(count, action.dailyMax - dailyUsed)
    const xpGained = effectiveCount * action.xp

    if (!metrics) {
      await db.collection('membership_metrics').add({
        data: {
          openid, xp: xpGained, streak: 0,
          lastCheckIn: 0, lastCheckInDate: '',
          insightDays: 0, aiDays: 0, challengeDays: 0,
          [dailyKey]: effectiveCount,
          createdAt: ts, updatedAt: ts,
        },
      })
    } else {
      const updateData = {
        xp: db.command.inc(xpGained),
        updatedAt: ts,
        [dailyKey]: db.command.inc(effectiveCount),
      }
      // habit tracking
      if (actionType === 'daily_insight') updateData.insightDays = db.command.inc(1)
      if (actionType === 'ai_chat') updateData.aiDays = db.command.inc(1)

      await db.collection('membership_metrics').doc(metrics._id).update({ data: updateData })
    }

    // 检查等级提升
    const xp = (metrics?.xp || 0) + xpGained
    const oldLevel = metrics?.level || 'free'
    const newLevel = _computeLevel(xp)
    let levelUp = null

    if (newLevel !== oldLevel) {
      levelUp = { from: oldLevel, to: newLevel, fromName: MEMBERSHIP_LEVELS[oldLevel]?.name, toName: MEMBERSHIP_LEVELS[newLevel]?.name }
      await db.collection('membership_metrics').doc(metrics._id).update({
        data: { level: newLevel, updatedAt: ts },
      })
    }

    return { xpGained, totalXp: xp, level: newLevel, levelUp }
  } catch (err) {
    console.error('[membershipEngine] addXP 异常:', err.message)
    return { xpGained: 0, error: err.message }
  }
}

// ═══════════════════════════
// getKPI — 会员运营 KPI
// ═══════════════════════════
async function getKPI(db) {
  const ts = now()
  try {
    const [activeCount, membersRes, churnRes] = await Promise.all([
      db.collection('memberships')
        .where({ status: 'active', expiredAt: db.command.gt(ts) })
        .count().then(r => r.total),
      db.collection('memberships')
        .where({ status: db.command.in(['active', 'expired', 'refunded']) })
        .get().then(r => r.data),
      db.collection('churn_predictions')
        .where({ riskScore: db.command.gte(70) })
        .count().then(r => r.total),
    ])

    const active = membersRes.filter(m => m.status === 'active' && m.expiredAt > ts)
    const expired = membersRes.filter(m => m.status === 'expired')

    // ARPPU (平均每付费用户收入)
    const totalRevenue = membersRes.reduce((sum, m) => {
      const price = _productPrice(m.memberType)
      return sum + price
    }, 0)
    const arppu = active.length > 0 ? Math.round(totalRevenue / membersRes.length) : 0

    // LTV = ARPPU × avg lifetime (months)
    const avgLifetimeMonths = active.length > 0
      ? active.reduce((s, m) => s + (m.startedAt ? (ts - m.startedAt) / (ONE_DAY * 30) : 0), 0) / active.length
      : 0
    const ltv = Math.round(arppu * Math.max(1, avgLifetimeMonths))

    // renewal_rate (近30天到期后续费的/到期总数)
    const thirtyDaysAgo = ts - 30 * ONE_DAY
    const recentlyExpired = expired.filter(e => e.expiredAt && e.expiredAt > thirtyDaysAgo)
    const renewed = recentlyExpired.filter(e => membersRes.some(m => m.openid === e.openid && m.status === 'active'))
    const renewalRate = recentlyExpired.length > 0
      ? Math.round((renewed.length / recentlyExpired.length) * 10000) / 100
      : 0

    // churn_rate (月)
    const monthExpired = expired.filter(e => e.expiredAt && e.expiredAt > ts - 30 * ONE_DAY)
    const monthNew = membersRes.filter(m => m.startedAt && m.startedAt > ts - 30 * ONE_DAY)
    const churnRate = monthNew.length > 0
      ? Math.round((monthExpired.length / monthNew.length) * 10000) / 100
      : 0

    return {
      active_members: activeCount,
      renewal_rate: renewalRate,
      churn_rate: churnRate,
      ARPPU: arppu,           // 分
      LTV: ltv,               // 分
      high_churn_risk: churnRes,
      analysedAt: ts,
    }
  } catch (err) {
    console.error('[membershipEngine] getKPI 异常:', err.message)
    return { active_members: 0, renewal_rate: 0, churn_rate: 0, ARPPU: 0, LTV: 0, error: err.message }
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════
function _getPerks(level, memberType) {
  const perks = {
    free: [
      { name: '每日认知暴击', icon: '⚡' },
      { name: '免费挑战 10 题/天', icon: '🎯' },
      { name: '基础 AI 3 次/天', icon: '🤖' },
    ],
    report_buyer: [
      { name: '完整报告解锁', icon: '📊' },
      { name: '历史报告', icon: '📚' },
    ],
    vip: [
      { name: '无限 AI 问答', icon: '♾️' },
      { name: '完整挑战模式', icon: '🎯' },
      { name: 'VIP 世界规则库', icon: '📖' },
      { name: '成长复盘', icon: '📈' },
      { name: '优先 AI 处理', icon: '⚡' },
      { name: '进阶 Hook Engine', icon: '🎮' },
    ],
    yearly_vip: [
      { name: 'Hard Truth Mode', icon: '💀', exclusive: true },
      { name: '深度报告（3年风险+财富模拟）', icon: '🔮', exclusive: true },
      { name: '优先 AI 模型', icon: '🧬', exclusive: true },
      { name: '年卡独享规则库', icon: '🔐', exclusive: true },
    ],
    premium: [
      { name: '1对1认知诊断', icon: '🎓' },
      { name: '私人分析报告', icon: '📋' },
      { name: '优先回复', icon: '📞' },
    ],
  }
  return perks[level] || perks.free
}

function _nextLevel(current) {
  const order = ['free', 'report_buyer', 'vip', 'yearly_vip', 'premium']
  const idx = order.indexOf(current)
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null
}

function _computeLevel(xp) {
  if (xp >= 5000) return 'premium'
  if (xp >= 2000) return 'yearly_vip'
  if (xp >= 500)  return 'vip'
  if (xp >= 100)  return 'report_buyer'
  return 'free'
}

function _productPrice(productId) {
  const prices = {
    VIP_MONTHLY: 9900, VIP_QUARTERLY: 19900, VIP_YEARLY: 29900,
    REPORT_001: 990, CONSULT_001: 89900,
  }
  return prices[productId] || 0
}

module.exports = {
  MEMBERSHIP_LEVELS,
  XP_ACTIONS,
  STREAK_MILESTONES,
  RENEWAL_PHASES,
  CHURN_WEIGHTS,
  getMembershipProfile,
  checkIn,
  addXP,
  getKPI,
}
