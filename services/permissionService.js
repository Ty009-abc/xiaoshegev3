/**
 * services/permissionService.js — 前端权限服务（第五册 Part 3 升级版）
 *
 * 接口：
 *   checkPermission(permission)       → 检查单项权限
 *   checkPermissions(permissions[])   → 批量检查
 *   getPermissionState()              → 获取全部权限状态（含缓存）
 *   consumeQuota()                    → 消耗免费额度
 *   guardPage(permission)             → 页面守卫（含 CTA 建议）
 *   getQuotaStatus()                  → 查询剩余免费额度
 */

function callFunction(name, data) {
  return wx.cloud.callFunction({ name, data }).then(res => res.result)
}

// 本地缓存（减少云函数调用）
let _permCache = null
let _permCacheTime = 0
const CACHE_TTL = 5 * 60 * 1000  // 5分钟

/**
 * checkPermission — 检查单项权限
 * @param {string} permission  — 'full_report' | 'unlimited_ai' | ...
 * @returns {{ granted, needPay, productSuggested, message }}
 */
async function checkPermission(permission) {
  try {
    const state = await getPermissionState()
    if (state.permissions.includes(permission)) {
      return { granted: true, needPay: false }
    }

    // 降级到云函数
    const res = await callFunction('checkPermission', { permission })
    if (res.code === 0 && res.data) {
      return { granted: res.data.granted, needPay: res.data.needPay || false,
        productSuggested: res.data.productSuggested, message: res.data.message }
    }
    return { granted: false, needPay: false }
  } catch (_) {
    return { granted: false, needPay: false }
  }
}

/**
 * checkPermissions — 批量检查
 * @returns {{ allGranted, results: [{permission, granted}] }}
 */
async function checkPermissions(permissions) {
  const results = await Promise.all(
    permissions.map(async (perm) => {
      const result = await checkPermission(perm)
      return { permission: perm, ...result }
    })
  )
  return { allGranted: results.every(r => r.granted), results }
}

/**
 * getPermissionState — 获取用户权限完整状态
 * 带本地缓存
 */
async function getPermissionState(forceRefresh = false) {
  if (_permCache && !forceRefresh && (Date.now() - _permCacheTime < CACHE_TTL)) {
    return _permCache
  }

  try {
    // 优先读 entitlements 云函数
    const res = await callFunction('checkPermission', { permission: '_state' })
    if (res.code === 0 && res.data) {
      _permCache = {
        permissions: res.data.permissions || [],
        membershipLevel: res.data.membershipLevel || 'free',
        isVip: res.data.isVip || false,
        isYearly: res.data.isYearly || false,
        expiredAt: res.data.expiredAt || 0,
      }
      _permCacheTime = Date.now()
      return _permCache
    }
  } catch (_) {}

  // 降级到本地 storage
  try {
    const local = wx.getStorageSync('permission_state')
    if (local) return JSON.parse(local)
  } catch (_) {}

  return { permissions: [], membershipLevel: 'free', isVip: false, isYearly: false, expiredAt: 0 }
}

/**
 * savePermissionState — 支付成功后更新本地缓存
 */
function savePermissionState(state) {
  _permCache = state
  _permCacheTime = Date.now()
  try {
    wx.setStorageSync('permission_state', JSON.stringify(state))
  } catch (_) {}
}

/**
 * clearPermissionCache — 登出时清除
 */
function clearPermissionCache() {
  _permCache = null
  _permCacheTime = 0
  try { wx.removeStorageSync('permission_state') } catch (_) {}
}

/**
 * consumeQuota — 消耗免费额度
 * @returns {{ allowed, remaining, max, isVip, needPay, productSuggested }}
 */
async function consumeQuota() {
  try {
    const res = await callFunction('consumeFreeQuota', {})
    if (res.code === 0 && res.data) return res.data
  } catch (_) {}
  return { allowed: true, remaining: 0, max: 3 }
}

/**
 * guardPage — 页面守卫
 * @param {string} permission — 页面所需权限
 * @returns {{ granted, needPay, productSuggested, message }}
 */
async function guardPage(permission) {
  try {
    const res = await callFunction('checkPermission', { permission, context: 'page_guard' })
    if (res.code === 0 && res.data) {
      return {
        granted: res.data.granted,
        needPay: res.data.needPay || false,
        productSuggested: res.data.productSuggested || '',
        message: res.data.message || '',
      }
    }
  } catch (_) {}
  return { granted: true, needPay: false }  // 降级放行
}

/**
 * getQuotaStatus — 查询剩余免费额度（多个权限）
 */
async function getQuotaStatus() {
  try {
    const res = await callFunction('checkPermission', { permission: '_quota' })
    if (res.code === 0 && res.data) return res.data
  } catch (_) {}
  return { basic_ai: { remaining: 3, max: 3 }, vip_rules: { remaining: 5, max: 5 }, challenge_full: { remaining: 10, max: 10 } }
}

module.exports = {
  checkPermission,
  checkPermissions,
  getPermissionState,
  savePermissionState,
  clearPermissionCache,
  consumeQuota,
  guardPage,
  getQuotaStatus,
}
