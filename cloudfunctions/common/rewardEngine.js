/**
 * rewardEngine.js — 裂变奖励引擎（第六册 Part 3）
 *
 * 分层奖励：
 *   1 invite  → +1 AI问答额度
 *   3 invites → 解锁3条VIP世界规则
 *   5 invites → 免费深度报告
 *   10 invites → 1次 AI 高级分析
 *
 * 三层升级：邀请成功 → 好友完成挑战 → 好友付费
 */
const now = () => Date.now()

// 奖励层级定义
const REWARD_TIERS = [
  { tier: 1,  name: '初级裂变者', invites: 1,  reward: 'ai_quota_1',        description: '+1 AI问答额度' },
  { tier: 2,  name: '社交连接者', invites: 3,  reward: 'vip_rules_3',        description: '解锁3条VIP世界规则' },
  { tier: 3,  name: '增长贡献者', invites: 5,  reward: 'free_report_1',      description: '免费深度报告' },
  { tier: 4,  name: '裂变引擎',   invites: 10, reward: 'advanced_analysis_1', description: '1次AI高级分析' },
]

// ═══════════════════════════
// grantReward — 按激活数发放奖励
// ═══════════════════════════

async function grantReward(db, openid, activatedCount) {
  const ts = now()

  // 找到触发的新 tier
  const triggered = REWARD_TIERS.filter(t => t.invites === activatedCount)

  if (triggered.length === 0) return { granted: false, note: 'no_new_tier' }

  const tier = triggered[0]

  // 检查是否已发放
  const existing = await db.collection('referrals')
    .where({ inviterOpenid: openid, 'rewardsGranted': db.command.all([tier.reward]) })
    .count()
    .then(r => r.total)
    .catch(() => 0)

  if (existing > 0) return { granted: false, note: 'already_granted' }

  try {
    switch (tier.reward) {
      case 'ai_quota_1': {
        // 增加用户 AI 问答额度
        await _grantAiQuota(db, openid, 1)
        break
      }
      case 'vip_rules_3': {
        // 授予临时 VIP 世界规则访问
        await _grantTempPermission(db, openid, 'vip_rules_access', 30 * 86400000) // 30天
        break
      }
      case 'free_report_1': {
        // 生成免费报告券
        await _grantCoupon(db, openid, 'free_report', 1, 30 * 86400000)
        break
      }
      case 'advanced_analysis_1': {
        // 授予高级分析权限
        await _grantCoupon(db, openid, 'advanced_analysis', 1, 90 * 86400000)
        break
      }
    }

    // 记录发放
    const inviter = await db.collection('referrals')
      .where({ inviterOpenid: openid })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))

    if (inviter.data.length > 0) {
      const doc = inviter.data[0]
      const granted = doc.rewardsGranted || []
      granted.push(tier.reward)
      await db.collection('referrals').doc(doc._id).update({
        data: {
          rewardsGranted: granted,
          currentTier: tier.tier,
          updatedAt: ts,
        },
      })
    }

    return { granted: true, tier: tier.tier, reward: tier.reward, description: tier.description }
  } catch (err) {
    console.error('[rewardEngine] grantReward 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// grantPaidReward — 好友付费大奖励
// ═══════════════════════════

async function grantPaidReward(db, openid) {
  const ts = now()
  try {
    // 额外 AI 问答额度 + VIP 体验 7 天
    await _grantAiQuota(db, openid, 2)
    await _grantTempPermission(db, openid, 'vip_premium_access', 7 * 86400000)

    return { granted: true, reward: 'paid_referral_bonus', description: '好友付费奖励：+2 AI额度 + 7天VIP体验' }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getRewardStatus — 用户奖励状态
// ═══════════════════════════

async function getRewardStatus(db, openid) {
  try {
    const inviter = await db.collection('referrals')
      .where({ inviterOpenid: openid })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))

    if (inviter.data.length === 0) return {
      activatedCount: 0,
      currentTier: 0,
      nextTier: 1,
      granted: [],
      pending: REWARD_TIERS.map(t => ({ tier: t.tier, reward: t.reward, description: t.description, achieved: false })),
    }

    const doc = inviter.data[0]
    const activated = doc.activatedInvites || 0
    const granted = doc.rewardsGranted || []

    return {
      activatedCount: activated,
      currentTier: doc.currentTier || _getCurrentTierNum(activated),
      nextTier: _getNextTierNum(activated),
      granted,
      pending: REWARD_TIERS.map(t => ({
        tier: t.tier,
        reward: t.reward,
        description: t.description,
        achieved: activated >= t.invites,
        granted: granted.includes(t.reward),
      })),
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ═══════════════════════════
// getTierInfo — 奖励层级信息
// ═══════════════════════════

function getTierInfo() {
  return REWARD_TIERS.map(t => ({
    tier: t.tier,
    name: t.name,
    invites: t.invites,
    reward: t.description,
    rewardKey: t.reward,
  }))
}

// ═══════════════════════════
// 辅助函数
// ═══════════════════════════

async function _grantAiQuota(db, openid, amount) {
  try {
    const user = await db.collection('users').where({ openid }).limit(1).get()
      .then(r => r.data[0]).catch(() => null)
    if (user) {
      const current = user.aiQuotaExtra || 0
      await db.collection('users').doc(user._id).update({
        data: { aiQuotaExtra: current + amount },
      })
    }
  } catch (_) {}
}

async function _grantTempPermission(db, openid, permission, durationMs) {
  try {
    const expiry = now() + durationMs
    await db.collection('entitlements').add({
      data: {
        openid,
        permission,
        grantedBy: 'referral_reward',
        expiresAt: expiry,
        createdAt: now(),
      },
    }).catch(() => {})
  } catch (_) {}
}

async function _grantCoupon(db, openid, couponType, quantity, durationMs) {
  try {
    const expiry = now() + durationMs
    await db.collection('entitlements').add({
      data: {
        openid,
        couponType,
        quantity,
        grantedBy: 'referral_reward',
        expiresAt: expiry,
        createdAt: now(),
      },
    }).catch(() => {})
  } catch (_) {}
}

function _getCurrentTierNum(count) {
  for (let i = REWARD_TIERS.length - 1; i >= 0; i--) {
    if (count >= REWARD_TIERS[i].invites) return i + 1
  }
  return 0
}

function _getNextTierNum(count) {
  for (const t of REWARD_TIERS) {
    if (t.invites > count) return t.tier
  }
  return null
}

module.exports = {
  REWARD_TIERS,
  grantReward,
  grantPaidReward,
  getRewardStatus,
  getTierInfo,
}
