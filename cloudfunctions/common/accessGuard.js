/**
 * cloudfunctions/common/accessGuard.js — 访问守卫（第五册 Part 3）
 *
 * 所有付费功能入口必须经过 Guard。
 *
 * 使用方式：
 *   const guarded = await guard(db, openid, 'full_report')
 *   if (!guarded.granted) return fail(CODES.PERMISSION_DENIED, guarded.message)
 *
 * 职责：
 *   1. 权限检查 → 有权限直接通过
 *   2. 免费额度 → 有额度消耗一次通过
 *   3. 无权限 → 返回 { granted: false, needPay: true, productSuggested }
 */

const { hasPermission, checkQuota, consumeQuota } = require('./permissionEngine.js')
const { CODES } = require('./errorCodes.js')

/**
 * guard — 访问守卫
 *
 * @param {object} db
 * @param {string} openid
 * @param {string} permission  — 如 'full_report'
 * @param {object} options     — { consume: true }  是否消耗免费额度
 * @returns {{ granted, needPay, productSuggested, message, level }}
 */
async function guard(db, openid, permission, options = {}) {
  const { consume = true } = options

  // 1. 直接权限检查
  const hasPerm = await hasPermission(db, openid, permission)
  if (hasPerm) {
    return { granted: true, needPay: false, level: 'vip' }
  }

  // 2. 免费额度检查
  const quotaCheck = await checkQuota(db, openid, permission)
  if (quotaCheck.allowed) {
    if (consume) {
      await consumeQuota(db, openid, permission)
    }
    return {
      granted: true,
      needPay: false,
      level: 'free',
      quota: { remaining: quotaCheck.remaining, max: quotaCheck.max },
    }
  }

  // 3. 拒绝访问 — 带转化信息
  return {
    granted: false,
    needPay: true,
    level: 'free',
    productSuggested: quotaCheck.productSuggested || 'VIP_QUARTERLY',
    message: quotaCheck.message || `此功能需要会员`,
    quota: { remaining: 0, max: quotaCheck.max },
  }
}

/**
 * bulkGuard — 批量检查多项权限
 *
 * @returns {{ allGranted, results: [{ permission, granted }] }}
 */
async function bulkGuard(db, openid, permissions, options = {}) {
  const results = await Promise.all(
    permissions.map(async (perm) => {
      const result = await guard(db, openid, perm, { consume: false })
      return { permission: perm, granted: result.granted, needPay: result.needPay, productSuggested: result.productSuggested }
    })
  )

  return {
    allGranted: results.every(r => r.granted),
    results,
  }
}

/**
 * pageGuard — 页面级守卫（前端可调用云函数）
 *
 * 前端页面 onLoad 时应调用：
 *   const result = await guardPage('full_report')
 *   if (!result.granted) { this.showPayModal(result.productSuggested) }
 */
async function pageGuard(db, openid, permission) {
  const result = await guard(db, openid, permission, { consume: false })

  return {
    granted: result.granted,
    needPay: result.needPay,
    productSuggested: result.productSuggested,
    message: result.message,
    // 附加用户当前权限快照
    permissionState: await _getPermissionState(db, openid),
  }
}

/**
 * aiGuard — AI 聊天入口守卫
 *
 * 专门用于 AI 对话：
 *   - VIP: 无限
 *   - Free: 每日3次
 *   - 超出后返回带 CTA 的拦截
 */
async function aiGuard(db, openid) {
  const result = await guard(db, openid, 'unlimited_ai', { consume: true })

  return {
    granted: result.granted,
    needPay: result.needPay,
    quota: result.quota,
    productSuggested: result.productSuggested || 'VIP_QUARTERLY',
    message: result.needPay
      ? '今日免费对话次数已用完\n解锁无限AI，继续你的认知升级之旅'
      : '',
  }
}

/**
 * reportGuard — 报告详情守卫
 */
async function reportGuard(db, openid, reportId) {
  const result = await guard(db, openid, 'full_report', { consume: false })

  return {
    granted: result.granted,
    needPay: result.needPay,
    reportId,
    productSuggested: result.productSuggested || 'REPORT_001',
    message: result.needPay
      ? '你的完整世界模型已生成\n立即解锁深度报告 — 限时 ¥9.9'
      : '',
  }
}

/**
 * challengeGuard — 挑战模式守卫
 */
async function challengeGuard(db, openid) {
  const result = await guard(db, openid, 'challenge_full', { consume: true })

  return {
    granted: result.granted,
    needPay: result.needPay,
    quota: result.quota,
    productSuggested: result.productSuggested || 'VIP_QUARTERLY',
    message: result.needPay
      ? '免费挑战题数已用完（10题/天）\n解锁30天完整挑战，系统解剖你的认知层级'
      : '',
  }
}

/**
 * ruleGuard — 世界规则守卫
 */
async function ruleGuard(db, openid) {
  const result = await guard(db, openid, 'vip_rules', { consume: false })

  return {
    granted: result.granted,
    needPay: result.needPay,
    quota: result.quota,
    productSuggested: result.productSuggested || 'VIP_QUARTERLY',
    message: result.needPay
      ? '免费规则预览已达上限（5条/天）\n解锁全部世界规则，看清100个底层逻辑'
      : '',
  }
}

async function _getPermissionState(db, openid) {
  try {
    const ent = await db.collection('entitlements').where({ openid }).limit(1).get()
    return {
      permissions: ent.data[0]?.permissions || [],
      isVip: ent.data[0]?.permissions?.includes('unlimited_ai') || false,
      isYearly: ent.data[0]?.permissions?.includes('hard_truth_mode') || false,
    }
  } catch (_) {
    return { permissions: [], isVip: false, isYearly: false }
  }
}

module.exports = {
  guard,
  bulkGuard,
  pageGuard,
  aiGuard,
  reportGuard,
  challengeGuard,
  ruleGuard,
}
