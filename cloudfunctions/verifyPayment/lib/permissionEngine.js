/**
 * cloudfunctions/common/permissionEngine.js — 权限引擎（第五册 Part 3）
 *
 * 职责：
 *   1. 统一权限判断 — 永远不要 if(user.vip)，统一 hasPermission(openid, permission)
 *   2. 商品→权限映射
 *   3. 免费用户额度控制
 *   4. 年卡独占权益
 *   5. 过期权限自动清理
 *
 * 架构：RBAC + Feature Flags
 */

const now = () => Date.now()

// ═══════════════════════════
// PERMISSION MATRIX — 原子化权限
// ═══════════════════════════

const ALL_PERMISSIONS = [
  // Free 层 — 所有用户
  'daily_insight',        // 每日认知暴击
  'challenge_preview',    // 挑战预览（10题）
  'basic_ai',             // 基础AI问答（3次/天）

  // Report 层 — 购买报告后解锁
  'full_report',          // 完整报告
  'report_history',       // 历史报告

  // VIP 层 — 会员核心
  'vip_rules',            // VIP世界规则
  'unlimited_ai',         // 无限AI问答
  'challenge_full',       // 完整挑战模式
  'growth_review',        // 成长复盘

  // Premium 层 — 季卡+
  'priority_ai',          // 优先AI处理
  'advanced_hooks',       // 进阶Hook Engine

  // Yearly 独占 — 年卡专属
  'hard_truth_mode',      // 最强人格模式 (personaIntensity=9)
  'advanced_reports',     // 深度报告（未来3年风险+财富路径模拟）
  'priority_model',       // 优先模型（更高token配额）

  // Consulting 层 — 1v1咨询
  'consult_booking',      // 咨询预约
  'private_analysis',     // 私人分析
  'priority_reply',       // 优先回复
]

// ═══════════════════════════
// PRODUCT → PERMISSIONS 映射
// ═══════════════════════════

const PRODUCT_PERMISSIONS = {
  REPORT_001: [
    'full_report',
    'report_history',
  ],

  VIP_MONTHLY: [
    'full_report', 'report_history',
    'vip_rules', 'challenge_full', 'growth_review',
    'unlimited_ai',
  ],

  VIP_QUARTERLY: [
    'full_report', 'report_history',
    'vip_rules', 'challenge_full', 'growth_review',
    'unlimited_ai',
    'priority_ai', 'advanced_hooks',        // 季卡+
  ],

  VIP_YEARLY: [
    'full_report', 'report_history',
    'vip_rules', 'challenge_full', 'growth_review',
    'unlimited_ai',
    'priority_ai', 'advanced_hooks',
    'hard_truth_mode', 'advanced_reports', 'priority_model',   // 年卡独占
  ],

  CONSULT_001: [
    'consult_booking',
    'private_analysis',
    'priority_reply',
    'full_report',
  ],

  challenge_39_9: [
    'challenge_full',
    'full_report',
    'report_history',
    'growth_review',
  ],

  report_9_9: [
    'full_report',
    'report_history',
  ],
}

// ═══════════════════════════
// FREE TIER QUOTAS
// ═══════════════════════════

const FREE_QUOTAS = {
  basic_ai:           { daily: 3,  description: '每日AI问答' },
  vip_rules:          { daily: 5,  description: '免费世界规则' },   // treated as preview
  challenge_full:     { daily: 10, description: '免费挑战题数' },    // treated as preview
}

// 免费用户默认权限（无需购买即有）
const FREE_PERMISSIONS = ['daily_insight', 'challenge_preview', 'basic_ai']

// ═══════════════════════════
// hasPermission — 核心判断
// ═══════════════════════════

/**
 * 判断用户是否拥有某权限
 *
 * @param {object}   db
 * @param {string}   openid
 * @param {string}   permission  — 如 'hard_truth_mode'
 * @param {object}   options     — { skipCache }
 * @returns {Promise<boolean>}
 */
async function hasPermission(db, openid, permission) {
  if (!openid) return false

  // 免费权限 — 所有人都有
  if (FREE_PERMISSIONS.includes(permission)) return true

  const ts = now()

  try {
    // 1. 查 entitlements 缓存
    const entRes = await db.collection('entitlements').where({ openid }).limit(1).get()
    const ent = entRes.data[0]

    if (ent && ent.permissions) {
      // 检查 sources 中是否有过期
      const expiredSources = (ent.sources || []).filter(s => s.expiresAt && s.expiresAt <= ts)
      if (expiredSources.length > 0) {
        // 有过期来源 → 降级检查（异步清理）
        _cleanExpiredSources(db, openid, expiredSources, ent).catch(() => {})
      }

      if (ent.permissions.includes(permission)) return true
    }

    // 2. 查 memberships（会员一定比 entitlements 全）
    const memRes = await db.collection('memberships')
      .where({ openid, status: 'active', expiredAt: db.command ? db.command.gt(ts) : { $gt: ts } })
      .limit(1)
      .get()

    const member = memRes.data[0]
    if (!member) return false

    // 会员一定有全面权限
    const memberPerms = member.permissions || []
    if (memberPerms.includes(permission)) return true

    // 3. 按会员等级推断
    const levelPerms = PRODUCT_PERMISSIONS[member.memberType] || []
    if (levelPerms.includes(permission)) return true

    return false
  } catch (_) {
    return false
  }
}

/**
 * hasPremiumPermission — 判断是否有某个等级的权限
 */
async function hasPremiumPermission(db, openid, permission) {
  // 年卡独占
  const yearlyExclusive = ['hard_truth_mode', 'advanced_reports', 'priority_model']
  if (yearlyExclusive.includes(permission)) {
    return hasPermission(db, openid, permission)
  }
  return hasPermission(db, openid, permission)
}

// ═══════════════════════════
// 免费用户额度控制
// ═══════════════════════════

/**
 * checkQuota — 检查免费额度
 *
 * @param {object} db
 * @param {string} openid
 * @param {string} permission — 'basic_ai' | 'vip_rules' | 'challenge_full'
 * @returns {{ allowed, remaining, max, isVip, needPay, productSuggested }}
 */
async function checkQuota(db, openid, permission) {
  const ts = now()

  // 先查是否已付费
  const isVip = await hasPermission(db, openid, 'unlimited_ai')
  if (isVip) {
    return { allowed: true, remaining: Infinity, max: Infinity, isVip: true, needPay: false }
  }

  const quota = FREE_QUOTAS[permission]
  if (!quota) {
    // 没有免费试用的权限 → 直接收费
    return { allowed: false, remaining: 0, max: 0, isVip: false, needPay: true,
      productSuggested: 'VIP_QUARTERLY', message: '此功能需要会员' }
  }

  try {
    const today = _todayKey(ts)

    // 查今日用量
    const usageRes = await db.collection('quota_usage')
      .where({ openid, date: today, permission })
      .limit(1)
      .get()

    const used = usageRes.data[0]?.count || 0
    const remaining = Math.max(0, quota.daily - used)

    if (remaining <= 0) {
      return {
        allowed: false, remaining: 0, max: quota.daily, used,
        isVip: false, needPay: true,
        productSuggested: permission === 'basic_ai' ? 'VIP_QUARTERLY' : 'REPORT_001',
        message: `你已触达${quota.description}免费上限（${quota.daily}次/天），解锁完整认知系统`,
      }
    }

    return { allowed: true, remaining: remaining - 1, max: quota.daily, used, isVip: false, needPay: false }
  } catch (_) {
    return { allowed: true, remaining: 1, max: quota.daily, isVip: false, needPay: false }
  }
}

/**
 * consumeQuota — 消耗一次免费额度
 */
async function consumeQuota(db, openid, permission) {
  const ts = now()
  const today = _todayKey(ts)

  try {
    const usageRes = await db.collection('quota_usage')
      .where({ openid, date: today, permission })
      .limit(1)
      .get()

    if (usageRes.data.length > 0) {
      await db.collection('quota_usage').doc(usageRes.data[0]._id).update({
        data: { count: db.command.inc(1), updatedAt: ts },
      })
    } else {
      await db.collection('quota_usage').add({
        data: { openid, date: today, permission, count: 1, createdAt: ts, updatedAt: ts },
      })
    }
    return true
  } catch (_) {
    return false
  }
}

// ═══════════════════════════
// 过期权限清理
// ═══════════════════════════

/**
 * revokeExpiredPermissions — 清理过期权限
 * 建议每日定时执行
 */
async function revokeExpiredPermissions(db) {
  const ts = now()
  let expiredCount = 0

  try {
    // 1. 过期会员 → 更新 entitlements
    const expiredMembers = await db.collection('memberships')
      .where({ status: 'active', expiredAt: db.command ? db.command.lte(ts) : { $lte: ts } })
      .limit(200)
      .get()

    for (const mem of expiredMembers.data) {
      await db.collection('memberships').doc(mem._id).update({
        data: { status: 'expired', updatedAt: ts },
      })
      expiredCount++

      // 同步 entitlements 降级
      await _downgradeEntitlements(db, mem.openid, ts)
    }

    // 2. 清理 entitlements 中过期的 sources
    const allEnts = await db.collection('entitlements')
      .where({ 'sources.expiresAt': db.command ? db.command.lte(ts) : { $lte: ts } })
      .limit(200)
      .get()

    for (const ent of allEnts.data) {
      const validSources = (ent.sources || []).filter(s => !s.expiresAt || s.expiresAt > ts)
      const validPerms = _rebuildPermissions(validSources)

      await db.collection('entitlements').doc(ent._id).update({
        data: { permissions: validPerms, sources: validSources, updatedAt: ts },
      })

      if (validSources.length < (ent.sources || []).length) {
        expiredCount++
      }
    }

    return { success: true, expiredCount, message: `清理了 ${expiredCount} 个过期权限记录` }
  } catch (err) {
    console.error('[permissionEngine] revokeExpiredPermissions 异常:', err.message)
    return { success: false, expiredCount, message: err.message }
  }
}

// ═══════════════════════════
// 辅助函数
// ═══════════════════════════

function _todayKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function _cleanExpiredSources(db, openid, expiredSources, ent) {
  try {
    const validSources = (ent.sources || []).filter(s => !expiredSources.includes(s))
    const validPerms = _rebuildPermissions(validSources)
    await db.collection('entitlements').doc(ent._id).update({
      data: { permissions: validPerms, sources: validSources, updatedAt: now() },
    })
  } catch (_) {}
}

async function _downgradeEntitlements(db, openid, ts) {
  try {
    // 检查是否还有其他有效会员
    const otherMember = await db.collection('memberships')
      .where({ openid, status: 'active', expiredAt: db.command ? db.command.gt(ts) : { $gt: ts } })
      .limit(1)
      .get()

    if (otherMember.data.length === 0) {
      // 无有效会员 → 降级到 free
      await db.collection('entitlements').where({ openid }).update({
        data: { permissions: FREE_PERMISSIONS, sources: [], updatedAt: ts },
      })
      await db.collection('users').where({ openid }).update({
        data: { membershipLevel: 'free', membershipExpiredAt: 0, updatedAt: ts },
      })
    }
  } catch (_) {}
}

function _rebuildPermissions(sources) {
  const permSet = new Set(FREE_PERMISSIONS)
  for (const src of (sources || [])) {
    const perms = PRODUCT_PERMISSIONS[src.productId] || []
    perms.forEach(p => permSet.add(p))
  }
  return [...permSet]
}

/**
 * getProductPermissions — 查询某个商品对应的权限列表
 */
function getProductPermissions(productId) {
  return PRODUCT_PERMISSIONS[productId] || []
}

/**
 * getMembershipLevel — 获取用户会员等级
 */
async function getMembershipLevel(db, openid) {
  try {
    const mem = await db.collection('memberships')
      .where({ openid, status: 'active' })
      .limit(1)
      .get()
    if (!mem.data[0]) return 'free'
    return mem.data[0].level || 'free'
  } catch (_) {
    return 'free'
  }
}

module.exports = {
  ALL_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  FREE_PERMISSIONS,
  FREE_QUOTAS,
  hasPermission,
  hasPremiumPermission,
  checkQuota,
  consumeQuota,
  revokeExpiredPermissions,
  getProductPermissions,
  getMembershipLevel,
}
