'use strict'
/**
 * accessAuthority.js — RC8_11_STAGE1 单一权威访问判定器
 *
 * 由「活跃会员 → 历史永久权益(legacy source) → free」优先级，对
 * 报告 / 挑战 / 记忆 / 场景 / AI 五类访问做一次性、可证明的判定。
 *
 * 权威输入（服务端可信，绝不接受客户端声明）：
 *   - membership: memberships 集合实体（active + 未过期）
 *   - sources   : entitlements.sources[]（payment finalizer 写入；永久/限时）
 *   - report    : 当前报告实体（isPaid）
 *
 * 关键约束（RC8_11）：
 *   - 绝不因通用 'full_report' 权限字符串单独放行 legacy 报告访问
 *     （challenge_39_9 同样会写 'full_report'）。
 *   - challenge_39_9 绝不因共用 'full_report' 而解锁报告（报告只认 report_9_9 来源）。
 *   - report_9_9 绝不解锁挑战（挑战只认 challenge_39_9 来源 / challenge_member）。
 *   - 会员到期只影响会员派生权限；legacy expiresAt:0 来源永不回收。
 *   - free 用户的「记忆开关」既有行为在配额阶段前保持不变（本模块只新增能力）。
 *
 * 本文件为 canonical。需要时以字节一致副本分发到各云函数 lib 目录。
 */

// 会员商品 → 会员权利 token（RC8_11 权益模型）
const MEMBERSHIP_RIGHTS = {
  vip_month_39_9: ['ai_member', 'report_member', 'challenge_member', 'memory_member', 'scenario_member'],
  vip_month_99: ['ai_member', 'report_member', 'challenge_member', 'memory_member', 'scenario_member'],
  vip_year_299: [
    'ai_member', 'report_member', 'challenge_member', 'memory_member', 'scenario_member',
    'hard_truth_mode', 'advanced_reports', 'priority_model', // 年卡独占（保留）
  ],
}

const ANNUAL_EXCLUSIVES = ['hard_truth_mode', 'advanced_reports', 'priority_model']

// 会员类商品（时长制）
const MEMBERSHIP_PRODUCT_IDS = ['vip_month_39_9', 'vip_month_99', 'vip_year_299']

// 历史永久一次性商品（退休销售，权益永久保留）
const LEGACY_REPORT_PRODUCT = 'report_9_9'
const LEGACY_CHALLENGE_PRODUCT = 'challenge_39_9'

// ── RC8_12_STAGE_FREE_LAUNCH — 发售模式（服务端权威）────────────────────
// FREE_ONLY：本版本真实关闭【全部】虚拟商品新销售（含会员/报告/挑战/月卡）。
//   这是产品/发版策略 —— 绝不是审核账号检测、reviewer openid 识别、
//   或审核后远程重新打开的开关。历史已购权益/回调/校验一律不受影响。
// SALE_ENABLED：正常销售模式（非本版本）。
const RELEASE_SALES_MODE_FREE_ONLY = 'FREE_ONLY'
const RELEASE_SALES_MODE_SALE_ENABLED = 'SALE_ENABLED'
// 单一权威来源：环境变量 RELEASE_SALES_MODE；未设置时默认 FREE_ONLY（失败闭合，绝不放行新售）。
function currentSalesMode (env) {
  const e = env || (typeof process !== 'undefined' ? process.env : {}) || {}
  const v = e.RELEASE_SALES_MODE
  return v === RELEASE_SALES_MODE_SALE_ENABLED ? RELEASE_SALES_MODE_SALE_ENABLED : RELEASE_SALES_MODE_FREE_ONLY
}
function isFreeOnly (env) { return currentSalesMode(env) === RELEASE_SALES_MODE_FREE_ONLY }

// free 每日 AI 问答上限（本阶段仅定义，不接线）
const FREE_AI_DAILY_LIMIT = 3

// ── 辅助 ──────────────────────────────────────────────────────────────────

function isActiveMembership (membership, now) {
  if (!membership) return false
  if (membership.status && membership.status !== 'active') return false
  const exp = membership.expiredAt
  // expiredAt 0/缺省 → 永久/未设置（与既有 checkVip 语义一致，仍视为活跃）
  if (exp && exp > 0 && exp <= now) return false
  return true
}

function sourceActive (src, now) {
  if (!src || !src.productId) return false
  const exp = src.expiresAt
  if (exp === undefined || exp === null || exp === 0) return true
  return Number(exp) > now
}

function hasLegacySource (sources, productId, now) {
  return (sources || []).some((s) => s && s.productId === productId && sourceActive(s, now))
}

function membershipRights (membership) {
  if (!membership) return []
  // 优先 canonical 会员权利（按 memberType 解析，保证 report_member/challenge_member 等 token 一致）；
  // 其次显式 rights；最后回退既有 permissions（legacy 名称，如 full_report/challenge_full）。
  const canonical = MEMBERSHIP_RIGHTS[membership.memberType]
  if (canonical) return canonical.slice()
  if (Array.isArray(membership.rights)) return membership.rights
  if (Array.isArray(membership.permissions)) return membership.permissions
  return []
}

// legacy 权限名称 → 会员权利 token（用于识别既有 memberships.permissions）
function _legacyPermsAsRights (perms) {
  const s = perms || []
  const out = []
  if (s.indexOf('unlimited_ai') >= 0 || s.indexOf('vip_rules') >= 0) out.push('ai_member')
  if (s.indexOf('full_report') >= 0 || s.indexOf('report_history') >= 0) out.push('report_member')
  if (s.indexOf('challenge_full') >= 0 || s.indexOf('challenge_unlock') >= 0) out.push('challenge_member')
  return out
}

function _has (rights, token) { return rights.indexOf(token) >= 0 }

// 会员权利（含 legacy permissions 归一化）——供 resolveAccess 使用
function effectiveRights (membership, now) {
  if (!isActiveMembership(membership, now)) return []
  const direct = membershipRights(membership)
  const legacy = _legacyPermsAsRights(membership && membership.permissions)
  return [...new Set([...direct, ...legacy])]
}

function _levelOf (productId) {
  if (productId === 'vip_year_299') return 'yearly'
  if (productId === 'vip_month_39_9' || productId === 'vip_month_99') return 'monthly'
  return 'free'
}

/**
 * resolveAccess — 单一权威判定。
 * @param {object} input
 * @param {object} [input.membership]  memberships 实体 { status, expiredAt, memberType, level, rights?/permissions? }
 * @param {Array}  [input.sources]     entitlements.sources[] [{ productId, expiresAt }]
 * @param {object} [input.report]      报告实体 { isPaid }
 * @param {number} [input.now]         时间戳（默认 Date.now）
 * @returns {{ membership, report, challenge, memory, scenario, ai }} 每项 { allowed, source }
 */
function resolveAccess (input) {
  const now = (input && input.now) || Date.now()
  const membership = (input && input.membership) || null
  const sources = (input && input.sources) || []
  const report = (input && input.report) || null

  const activeMember = isActiveMembership(membership, now)
  const rights = activeMember ? effectiveRights(membership, now) : []

  // REPORT — report.isPaid > legacy report_9_9 source > membership report_member
  let reportAccess = { allowed: false, source: 'NONE' }
  if (report && report.isPaid === true) {
    reportAccess = { allowed: true, source: 'REPORT_IS_PAID' }
  } else if (hasLegacySource(sources, LEGACY_REPORT_PRODUCT, now)) {
    reportAccess = { allowed: true, source: 'LEGACY_REPORT_9_9' }
  } else if (activeMember && _has(rights, 'report_member')) {
    reportAccess = { allowed: true, source: 'MEMBERSHIP' }
  }

  // CHALLENGE — legacy challenge_39_9 source > membership challenge_member
  let challengeAccess = { allowed: false, source: 'NONE' }
  if (hasLegacySource(sources, LEGACY_CHALLENGE_PRODUCT, now)) {
    challengeAccess = { allowed: true, source: 'LEGACY_CHALLENGE_39_9' }
  } else if (activeMember && _has(rights, 'challenge_member')) {
    challengeAccess = { allowed: true, source: 'MEMBERSHIP' }
  }

  const memoryAccess = (activeMember && _has(rights, 'memory_member'))
    ? { allowed: true, source: 'MEMBERSHIP' } : { allowed: false, source: 'NONE' }
  const scenarioAccess = (activeMember && _has(rights, 'scenario_member'))
    ? { allowed: true, source: 'MEMBERSHIP' } : { allowed: false, source: 'NONE' }
  const aiAccess = (activeMember && _has(rights, 'ai_member'))
    ? { allowed: true, source: 'MEMBERSHIP' } : { allowed: false, source: 'NONE' }

  const membershipInfo = activeMember
    ? { active: true, level: membership.level || _levelOf(membership.memberType), productId: membership.memberType || null, source: 'MEMBERSHIP' }
    : { active: false, level: 'free', productId: null, source: 'NONE' }

  return {
    membership: membershipInfo,
    report: reportAccess,
    challenge: challengeAccess,
    memory: memoryAccess,
    scenario: scenarioAccess,
    ai: aiAccess,
  }
}

function canAccessReport (input) { return resolveAccess(input).report.allowed === true }
function canAccessChallenge (input) { return resolveAccess(input).challenge.allowed === true }

/** 会员商品 → 权利 token（发放时使用） */
function rightsForProduct (productId) {
  const r = MEMBERSHIP_RIGHTS[productId]
  return r ? r.slice() : []
}

/** 是否为退休（不再新售）的独立商品 */
const RETIRED_NEW_SALE_PRODUCTS = ['report_9_9', 'challenge_39_9', 'vip_month_99']
function isRetiredNewSale (productId) {
  return RETIRED_NEW_SALE_PRODUCTS.indexOf(productId) >= 0
}

/**
 * 虚拟商品「新售」判定（RC8_12）。
 * 本版本（FREE_ONLY）关闭全部虚拟商品新售：任何虚拟商品的新订单一律拒绝。
 * 权威输入：服务端 RELEASE_SALES_MODE + 服务端商品文档（product.type/notNewSale）。
 * 绝不接受客户端声明；绝不因审核身份/环境差异而改变。
 * @returns {{isVirtual:boolean, blocked:boolean, reason:string}}
 */
const VIRTUAL_PRODUCT_TYPES = ['membership', 'subscription', 'one_time', 'single', 'consumable', 'bundle']
function classifyVirtualNewSale (product, productId, env) {
  const pid = productId || (product && product.productId) || ''
  const type = (product && product.type) || ''
  const isVirtual = VIRTUAL_PRODUCT_TYPES.indexOf(type) >= 0 || !!product
  if (isFreeOnly(env)) {
    return { isVirtual: isVirtual, blocked: true, reason: 'PRODUCT_INACTIVE_OR_SALES_DISABLED' }
  }
  if ((product && product.notNewSale === true) || isRetiredNewSale(pid)) {
    return { isVirtual: isVirtual, blocked: true, reason: 'RETIRED_NEW_SALE' }
  }
  return { isVirtual: isVirtual, blocked: false, reason: '' }
}

module.exports = {
  MEMBERSHIP_RIGHTS,
  ANNUAL_EXCLUSIVES,
  MEMBERSHIP_PRODUCT_IDS,
  LEGACY_REPORT_PRODUCT,
  LEGACY_CHALLENGE_PRODUCT,
  RETIRED_NEW_SALE_PRODUCTS,
  FREE_AI_DAILY_LIMIT,
  RELEASE_SALES_MODE_FREE_ONLY,
  RELEASE_SALES_MODE_SALE_ENABLED,
  VIRTUAL_PRODUCT_TYPES,
  currentSalesMode,
  isFreeOnly,
  classifyVirtualNewSale,
  isActiveMembership,
  sourceActive,
  hasLegacySource,
  membershipRights,
  effectiveRights,
  resolveAccess,
  canAccessReport,
  canAccessChallenge,
  rightsForProduct,
  isRetiredNewSale,
}
