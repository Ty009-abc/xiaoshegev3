/**
 * common/permission.js - 权限校验公共方法
 *
 * 所有权限以 memberships 表为准
 * users.membershipLevel 为快照，可能过期
 */

const VIP_LEVELS = ['vip_month', 'vip_quarter', 'vip_year', 'svip', 'lifetime']

const PERMISSION_MAP = {
  vip_month:    ['ai_unlimited','report_unlock','challenge_unlock','world_rules_unlock','history_insights_unlock'],
  vip_quarter:  ['ai_unlimited','report_unlock','challenge_unlock','world_rules_unlock','history_insights_unlock','poster_generate'],
  vip_year:     ['ai_unlimited','report_unlock','challenge_unlock','world_rules_unlock','history_insights_unlock','poster_generate','advanced_profile'],
  svip:         ['ai_unlimited','report_unlock','challenge_unlock','world_rules_unlock','history_insights_unlock','poster_generate','advanced_profile','priority_support'],
  lifetime:     ['ai_unlimited','report_unlock','challenge_unlock','world_rules_unlock','history_insights_unlock','poster_generate','advanced_profile','priority_support'],
}

const now = () => Date.now()

/**
 * 检查用户是否 VIP
 * @returns {boolean}
 */
function checkVip(db, openid) {
  return new Promise(async (resolve) => {
    try {
      const res = await db.collection('users').where({ openid }).limit(1).get()
      const user = res.data[0]
      if (!user || !user.membershipLevel || user.membershipLevel === 'free') return resolve(false)
      const ts = now()
      const memberRes = await db.collection('memberships')
        .where({ openid, status: 'active' })
        .limit(1)
        .get()
      const member = memberRes.data[0]
      if (member && (!member.expiredAt || member.expiredAt > ts)) return resolve(true)
      return resolve(false)
    } catch (_) {
      resolve(false)
    }
  })
}

/**
 * 检查用户是否有某权限
 * @param {object} db
 * @param {string} openid
 * @param {string} perm - 如 'challenge_unlock'
 * @returns {boolean}
 */
function checkPermission(db, openid, perm) {
  return new Promise(async (resolve) => {
    try {
      const ts = now()
      const memberRes = await db.collection('memberships')
        .where({ openid, status: 'active' })
        .limit(1)
        .get()

      const member = memberRes.data[0]
      if (!member) return resolve(false)
      if (member.expiredAt && member.expiredAt <= ts) return resolve(false)

      const perms = member.permissions || []
      return resolve(perms.includes(perm))
    } catch (_) {
      resolve(false)
    }
  })
}

/**
 * 同步 users.membershipLevel 快照
 */
async function syncUserLevel(db, openid, level) {
  try {
    await db.collection('users').where({ openid }).update({
      data: { membershipLevel: level || 'free', updatedAt: now() },
    })
  } catch (_) {}
}

module.exports = {
  VIP_LEVELS,
  PERMISSION_MAP,
  checkVip,
  checkPermission,
  syncUserLevel,
  now,
}
