/**
 * cloudfunctions/common/renewalManager.js — 续费管理（第五册 Part 5）
 *
 * 职责：
 *   1. 三阶段续费提醒（7天/3天/到期当天）
 *   2. 续费成功后的权益延续
 *   3. 召回策略（churnScore >70 触发）
 *   4. 续费提醒记录
 *
 * 策略核心：
 *   到期前 7 天 — 提醒 + 预览
 *   到期前 3 天 — 展示成长数据（沉没成本）
 *   到期当天 — 损失厌恶（续费保留一切）
 */
const { RENEWAL_PHASES } = require('./membershipEngine.js')
const now = () => Date.now()
const ONE_DAY = 86400000

// ═══════════════════════════
// getRenewalStatus — 获取续费状态
// ═══════════════════════════
async function getRenewalStatus(db, openid) {
  const ts = now()
  try {
    const memRes = await db.collection('memberships')
      .where({ openid, status: 'active' })
      .orderBy('expiredAt', 'desc')
      .limit(1)
      .get()

    if (!memRes.data.length) {
      return { status: 'no_membership', phase: null, daysUntilExpiry: 0, message: '暂无会员' }
    }

    const member = memRes.data[0]
    const daysUntil = Math.max(0, Math.ceil((member.expiredAt - ts) / ONE_DAY))

    if (daysUntil === 0 || member.expiredAt <= ts) {
      return { status: 'expired', phase: 'expired', daysUntilExpiry: 0, message: RENEWAL_PHASES.expired.message,
        member, perks: _getExpiryLosses(member) }
    }

    if (daysUntil <= 3) {
      // Phase 2: 展示成长数据
      const growthData = await _getGrowthSummary(db, openid)
      return { status: 'active', phase: '3_days', daysUntilExpiry: daysUntil,
        message: `仅剩 ${daysUntil} 天 — 你的成长数据随时可能中断`,
        member, growthData, urgency: 'medium' }
    }

    if (daysUntil <= 7) {
      return { status: 'active', phase: '7_days', daysUntilExpiry: daysUntil,
        message: '你的认知升级权限将在 7 天后到期',
        member, urgency: 'low' }
    }

    return { status: 'active', phase: null, daysUntilExpiry: daysUntil,
      message: `剩余 ${daysUntil} 天`, member, urgency: 'none' }
  } catch (err) {
    console.error('[renewalManager] getRenewalStatus 异常:', err.message)
    return { status: 'error', error: err.message }
  }
}

// ═══════════════════════════
// shouldRenewalNotify — 是否应发送续费提醒
// ═══════════════════════════
async function shouldRenewalNotify(db, openid) {
  const status = await getRenewalStatus(db, openid)
  if (!status.phase) return { shouldNotify: false }

  const ts = now()

  // 检查是否已提醒过（同一 phase 24h 内不重复）
  try {
    const lastNotify = await db.collection('membership_metrics')
      .where({ openid })
      .limit(1)
      .get()

    const lastNotifyTime = lastNotify.data[0]?.lastRenewalNotify || 0
    const lastNotifyPhase = lastNotify.data[0]?.lastRenewalPhase || ''

    if (lastNotifyPhase === status.phase && ts - lastNotifyTime < ONE_DAY) {
      return { shouldNotify: false, reason: '24h内已提醒' }
    }
  } catch (_) {}

  return { shouldNotify: true, phase: status.phase, message: status.message, daysUntil: status.daysUntilExpiry }
}

// ═══════════════════════════
// recordRenewalNotify — 记录提醒
// ═══════════════════════════
async function recordRenewalNotify(db, openid, phase) {
  const ts = now()
  try {
    const metricsRes = await db.collection('membership_metrics').where({ openid }).limit(1).get()
    if (metricsRes.data.length > 0) {
      await db.collection('membership_metrics').doc(metricsRes.data[0]._id).update({
        data: { lastRenewalNotify: ts, lastRenewalPhase: phase, updatedAt: ts },
      })
    } else {
      await db.collection('membership_metrics').add({
        data: { openid, lastRenewalNotify: ts, lastRenewalPhase: phase, xp: 0, streak: 0,
          lastCheckIn: 0, lastCheckInDate: '', insightDays: 0, aiDays: 0, challengeDays: 0,
          createdAt: ts, updatedAt: ts },
      })
    }
  } catch (_) {}
}

// ═══════════════════════════
// handleRenewal — 续费成功后延展
// ═══════════════════════════
async function handleRenewal(db, openid, newOrder) {
  const ts = now()
  try {
    const productRes = await db.collection('products').where({ productId: newOrder.productId }).limit(1).get()
    const product = productRes.data[0] || {}
    const durationDays = product.durationDays || 90

    // 找当前会员
    const memRes = await db.collection('memberships')
      .where({ openid, status: db.command.in(['active', 'expired']) })
      .orderBy('expiredAt', 'desc')
      .limit(1)
      .get()

    if (memRes.data.length > 0) {
      const old = memRes.data[0]
      const baseTime = Math.max(old.expiredAt || ts, ts)
      const newExpires = baseTime + durationDays * ONE_DAY

      await db.collection('memberships').doc(old._id).update({
        data: {
          status: 'active',
          level: _productLevel(newOrder.productId),
          memberType: newOrder.productId,
          expiredAt: newExpires,
          renewedAt: ts,
          renewCount: db.command.inc(1),
          updatedAt: ts,
        },
      })

      await db.collection('users').where({ openid }).update({
        data: { membershipLevel: _productLevel(newOrder.productId), membershipExpiredAt: newExpires, updatedAt: ts },
      })

      return { success: true, action: 'extended', newExpiresAt: newExpires, daysAdded: durationDays }
    }

    // 新会员
    const newExpires = ts + durationDays * ONE_DAY
    await db.collection('memberships').add({
      data: {
        openid, status: 'active', level: _productLevel(newOrder.productId),
        memberType: newOrder.productId,
        startedAt: ts, expiredAt: newExpires,
        renewedAt: 0, renewCount: 0,
        createdAt: ts, updatedAt: ts,
      },
    })

    return { success: true, action: 'new', newExpiresAt: newExpires, daysAdded: durationDays }
  } catch (err) {
    console.error('[renewalManager] handleRenewal 异常:', err.message)
    return { success: false, error: err.message }
  }
}

// ═══════════════════════════
// getRecallMessage — 召回文案
// ═══════════════════════════
function getRecallMessage(riskScore, context = {}) {
  if (riskScore >= 90) {
    return {
      title: '你已经很久没有升级世界模型了',
      body: `${context.daysSinceLogin || '多'}天没有打开小事哥，你的认知成长数据正在被冻结。\n\n世界每个小时都在变，你的模型不更新就会被淘汰。`,
      cta: '回到认知升级',
    }
  }
  if (riskScore >= 70) {
    return {
      title: '关于你未完成的认知成长…',
      body: `你上次在${context.lastActiveAction || '挑战'}中表现出了很强的潜力，但这需要持续训练。\n\n回来完成今天的暴击，保持你的成长 momentum。`,
      cta: '继续升级',
    }
  }
  return {
    title: '小事哥想到了你',
    body: '今天的认知暴击刚好命中了你的盲区，过来看看。',
    cta: '查看今日暴击',
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

async function _getGrowthSummary(db, openid) {
  try {
    const metrics = await db.collection('membership_metrics').where({ openid }).limit(1).get()
    const funnelState = await db.collection('user_funnel_state').where({ openid }).limit(1).get()

    const m = metrics.data[0] || {}
    const fs = funnelState.data[0] || {}

    return {
      xp: m.xp || 0,
      streak: m.streak || 0,
      insightDays: m.insightDays || 0,
      aiDays: m.aiDays || 0,
      challengeDays: m.challengeDays || 0,
      level: _computeLevel(m.xp || 0),
      levelName: _levelName(_computeLevel(m.xp || 0)),
      maxStep: fs.maxStep || 0,
    }
  } catch (_) {
    return { xp: 0, streak: 0, insightDays: 0, aiDays: 0, challengeDays: 0, level: 'free', levelName: '观察者', maxStep: 0 }
  }
}

function _getExpiryLosses(member) {
  return [
    { name: '成长记录', description: `${member.startedAt ? Math.floor((member.expiredAt - member.startedAt) / ONE_DAY) : 0} 天的认知历史将被冻结` },
    { name: 'AI 对话历史', description: '你的问答记录、模型理解将无法访问' },
    { name: '高级权限', description: '无限 AI / 完整挑战 / VIP 规则' },
  ]
}

function _computeLevel(xp) {
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

function _productLevel(productId) {
  if (productId === 'VIP_YEARLY') return 'yearly'
  if (productId === 'VIP_QUARTERLY') return 'quarterly'
  if (productId === 'VIP_MONTHLY') return 'monthly'
  return 'vip'
}

module.exports = {
  getRenewalStatus,
  shouldRenewalNotify,
  recordRenewalNotify,
  handleRenewal,
  getRecallMessage,
}
