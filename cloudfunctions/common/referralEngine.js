/**
 * referralEngine.js — 邀请系统引擎（第六册 Part 3）
 *
 * 能力：
 *   1. 生成唯一邀请码 (XSG + 4位随机)
 *   2. 记录邀请链 (referral chain)
 *   3. 查询邀请状态 / 邀请统计
 *   4. 关联 rewards
 */
const now = () => Date.now()

// ═══════════════════════════
// generateCode — 生成邀请码
// ═══════════════════════════

function generateCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return `XSG${code}`
}

// ═══════════════════════════
// createInviteCode — 为用户创建邀请码
// ═══════════════════════════

async function createInviteCode(db, openid, code) {
  const ts = now()
  const inviteCode = code || generateCode()

  // 检查是否已存在
  try {
    const existing = await db.collection('referrals')
      .where({ inviterOpenid: openid })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))

    if (existing.data.length > 0) {
      return { code: existing.data[0].inviterCode || inviteCode, existed: true }
    }
  } catch (_) {}

  // 确保邀请码唯一（简化）
  const conflict = await db.collection('referrals')
    .where({ inviterCode: inviteCode })
    .count()
    .then(r => r.total)
    .catch(() => 0)

  if (conflict > 0) return { error: 'code_conflict', suggestion: '重试' }

  await db.collection('referrals').add({
    data: {
      inviterOpenid: openid,
      inviterCode: inviteCode,
      status: 'active',
      totalInvites: 0,
      activatedInvites: 0,
      paidInvites: 0,
      createdAt: ts,
      updatedAt: ts,
    },
  })

  return { code: inviteCode, existed: false }
}

// ═══════════════════════════
// recordInvite — 记录邀请事件
// ═══════════════════════════

async function recordInvite(db, { inviterCode, inviteeOpenid, source }) {
  const ts = now()
  if (!inviterCode || !inviteeOpenid) return { error: '缺少参数' }

  // 反作弊检查（快速）
  try {
    const fraudDetector = require('./fraudDetector.js')
    const fraudCheck = await fraudDetector.quickCheck(db, { inviterCode, inviteeOpenid })
    if (fraudCheck.block) return { error: 'fraud_blocked', reason: fraudCheck.reason }
  } catch (_) {}

  // 检查是否已存在
  const existCheck = await db.collection('referrals')
    .where({ inviteeOpenid })
    .count()
    .then(r => r.total)
    .catch(() => 0)

  if (existCheck > 0) return { error: 'already_invited' }

  // 写入
  await db.collection('referrals').add({
    data: {
      inviterCode,
      inviteeOpenid,
      status: 'sent',
      source: source || 'share',
      createdAt: ts,
      updatedAt: ts,
    },
  })

  // 更新邀请人计数
  try {
    const inviter = await db.collection('referrals')
      .where({ inviterCode, inviterOpenid: db.command.exists(true) })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))
    if (inviter.data.length > 0) {
      await db.collection('referrals').doc(inviter.data[0]._id).update({
        data: { totalInvites: db.command.inc(1), updatedAt: ts },
      })
    }
  } catch (_) {}

  // 记录 share_events
  try {
    await db.collection('share_events').add({
      data: { inviterCode, inviteeOpenid, event: 'invite_sent', source: source || 'share', createdAt: ts, date: new Date(ts).toISOString().slice(0, 10) },
    })
  } catch (_) {}

  return { success: true, status: 'sent' }
}

// ═══════════════════════════
// activateInvite — 被邀请人激活（进入小程序）
// ═══════════════════════════

async function activateInvite(db, inviteeOpenid) {
  const ts = now()
  try {
    const ref = await db.collection('referrals')
      .where({ inviteeOpenid, status: 'sent' })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))

    if (ref.data.length === 0) return { success: true, note: 'no_pending_invite' }

    await db.collection('referrals').doc(ref.data[0]._id).update({
      data: { status: 'activated', activatedAt: ts, updatedAt: ts },
    })

    // 更新邀请人激活数
    const inviterCode = ref.data[0].inviterCode
    const inviter = await db.collection('referrals')
      .where({ inviterCode, inviterOpenid: db.command.exists(true) })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))

    if (inviter.data.length > 0) {
      const current = inviter.data[0]
      const newActivated = (current.activatedInvites || 0) + 1

      await db.collection('referrals').doc(current._id).update({
        data: { activatedInvites: db.command.inc(1), updatedAt: ts },
      })

      // 触发奖励
      try {
        const rewardEngine = require('./rewardEngine.js')
        await rewardEngine.grantReward(db, current.inviterOpenid, newActivated)
      } catch (_) {}
    }

    // 记录 share_events
    await db.collection('share_events').add({
      data: { inviterCode, inviteeOpenid, event: 'invite_activated', createdAt: ts, date: new Date(ts).toISOString().slice(0, 10) },
    })

    return { success: true, status: 'activated', inviterCode }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// markInvitePaid — 被邀请人付费
// ═══════════════════════════

async function markInvitePaid(db, inviteeOpenid) {
  const ts = now()
  try {
    const ref = await db.collection('referrals')
      .where({ inviteeOpenid, status: db.command.in(['sent', 'activated']) })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))

    if (ref.data.length === 0) return { success: true, note: 'no_referral' }

    await db.collection('referrals').doc(ref.data[0]._id).update({
      data: { status: 'paid', paidAt: ts, updatedAt: ts },
    })

    // 更新邀请人
    const inviterCode = ref.data[0].inviterCode
    const inviter = await db.collection('referrals')
      .where({ inviterCode, inviterOpenid: db.command.exists(true) })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))

    if (inviter.data.length > 0) {
      await db.collection('referrals').doc(inviter._id || inviter.data[0]._id).update({
        data: { paidInvites: db.command.inc(1), updatedAt: ts },
      })

      // 大奖励
      try {
        const rewardEngine = require('./rewardEngine.js')
        await rewardEngine.grantPaidReward(db, inviter.data[0].inviterOpenid)
      } catch (_) {}
    }

    return { success: true, status: 'paid' }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getReferralStats — 邀请统计
// ═══════════════════════════

async function getReferralStats(db, openid) {
  const ts = now()
  try {
    // 邀请人的记录
    const myCode = await db.collection('referrals')
      .where({ inviterOpenid: openid })
      .limit(1)
      .get()
      .then(r => r.data[0])
      .catch(() => null)

    // 被邀请人列表
    const invitees = myCode
      ? await db.collection('referrals')
        .where({ inviterCode: myCode.inviterCode, inviteeOpenid: db.command.exists(true) })
        .get()
        .then(r => r.data)
        .catch(() => [])
      : []

    const stats = {
      inviterCode: myCode?.inviterCode || null,
      totalInvites: invitees.length,
      activated: invitees.filter(i => i.status === 'activated' || i.status === 'paid').length,
      paid: invitees.filter(i => i.status === 'paid').length,
      invitees: invitees.map(i => ({ status: i.status, activatedAt: i.activatedAt || null, paidAt: i.paidAt || null })),
      rewards: myCode ? {
        nextTier: _nextRewardTier((myCode.activatedInvites || 0)),
        currentTier: _currentTier((myCode.activatedInvites || 0)),
        activatedCount: myCode.activatedInvites || 0,
      } : null,
    }

    return stats
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getTopInviters — 邀请排行榜
// ═══════════════════════════

async function getTopInviters(db, limit = 10) {
  try {
    const top = await db.collection('referrals')
      .where({ inviterOpenid: db.command.exists(true), activatedInvites: db.command.gt(0) })
      .orderBy('activatedInvites', 'desc')
      .limit(limit)
      .get()
      .catch(() => ({ data: [] }))

    return top.data.map(r => ({
      inviterCode: r.inviterCode,
      totalInvites: r.totalInvites || 0,
      activatedInvites: r.activatedInvites || 0,
      paidInvites: r.paidInvites || 0,
    }))
  } catch (_) {
    return []
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

const REWARD_TIERS = [1, 3, 5, 10]

function _currentTier(count) {
  for (let i = REWARD_TIERS.length - 1; i >= 0; i--) {
    if (count >= REWARD_TIERS[i]) return REWARD_TIERS[i]
  }
  return 0
}

function _nextRewardTier(count) {
  for (const tier of REWARD_TIERS) {
    if (tier > count) return tier
  }
  return null
}

module.exports = {
  generateCode,
  createInviteCode,
  recordInvite,
  activateInvite,
  markInvitePaid,
  getReferralStats,
  getTopInviters,
}
