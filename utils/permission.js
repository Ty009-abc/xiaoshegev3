/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * 权限校验工具
 */

const { COLLECTIONS } = require('./collections.js')
const { now, isExpired } = require('./time.js')

/** 会员等级排序权重（越大越高级） */
const LEVEL_WEIGHT = {
  free:        0,
  vip_month:   1,
  vip_quarter: 2,
  vip_year:    3,
  svip:        4,
  lifetime:    5,
}

/** 各权限对应的最低会员等级 */
const PERMISSION_REQUIREMENTS = {
  ai_unlimited:            'vip_month',
  report_unlock:           'free',         // 可单购
  challenge_unlock:        'free',
  world_rules_unlock:      'free',
  history_insights_unlock: 'vip_month',
  poster_generate:         'vip_month',
  advanced_profile:        'vip_month',
}

/**
 * 判断用户是否拥有某项权限
 * @param {Object} user        - 用户对象 (users 集合记录)
 * @param {Object} membership  - 会员记录 (memberships 集合记录，可选)
 * @param {string} permission  - 权限标识
 * @returns {boolean}
 */
function hasPermission(user, membership, permission) {
  if (!user) return false
  if (user.status !== 'active') return false

  // 会员记录优先
  if (membership && membership.status === 'active') {
    if (!isExpired(membership.expiredAt)) {
      if (membership.permissions && membership.permissions.includes(permission)) {
        return true
      }
    }
  }

  // Fallback: 按 users.membershipLevel 快速判断
  const requiredLevel = PERMISSION_REQUIREMENTS[permission]
  if (!requiredLevel) return false

  const userWeight = LEVEL_WEIGHT[user.membershipLevel] || 0
  const requiredWeight = LEVEL_WEIGHT[requiredLevel] || 0

  return userWeight >= requiredWeight
}

/**
 * 判断是否为 VIP 用户
 */
function isVip(user, membership) {
  if (!user) return false
  if (user.membershipLevel === 'free') return false
  // 有会员记录则看是否过期
  if (membership) {
    return membership.status === 'active' && !isExpired(membership.expiredAt)
  }
  // 无会员记录则看 users 表快读字段
  return !isExpired(user.membershipExpiredAt)
}

/**
 * 判断会员是否有效（未过期）
 */
function isMembershipValid(user, membership) {
  if (!user) return false
  if (membership) {
    return membership.status === 'active' && !isExpired(membership.expiredAt)
  }
  return user.membershipLevel !== 'free' && !isExpired(user.membershipExpiredAt)
}

/**
 * 获取用户当前有效权限列表
 */
function getPermissions(user, membership) {
  const perms = new Set()

  // 免费用户默认权限
  perms.add('daily_insight_read')

  // 按 membershipLevel 授予
  const userWeight = LEVEL_WEIGHT[user.membershipLevel] || 0
  for (const [perm, level] of Object.entries(PERMISSION_REQUIREMENTS)) {
    if (userWeight >= (LEVEL_WEIGHT[level] || 0)) {
      perms.add(perm)
    }
  }

  // 会员记录中的额外权限
  if (membership && membership.status === 'active' && !isExpired(membership.expiredAt)) {
    if (membership.permissions) {
      membership.permissions.forEach(p => perms.add(p))
    }
  }

  return Array.from(perms)
}

module.exports = {
  hasPermission,
  isVip,
  isMembershipValid,
  getPermissions,
  LEVEL_WEIGHT,
  PERMISSION_REQUIREMENTS,
}
