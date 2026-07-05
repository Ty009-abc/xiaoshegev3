/**
 * cloudfunctions/common/entitlementService.js — 权益生命周期服务（第五册 Part 3）
 *
 * 在 permissionEngine 基础上提供事务性权益操作：
 *   grantEntitlements — 支付成功发放权益
 *   revokeEntitlements — 退款回收权益
 *   refreshEntitlements — 重算权限（用于清理过期后）
 *   getEntitlementState  — 获取用户当前权限快照
 */

const {
  PRODUCT_PERMISSIONS,
  FREE_PERMISSIONS,
  hasPermission,
  getMembershipLevel,
} = require('./permissionEngine.js')

const now = () => Date.now()

/**
 * grantEntitlements — 支付成功后发放权益（事务版本）
 *
 * @param {object} db
 * @param {object} order — { openid, productId, orderId, relatedId }
 * @param {number} ts    — 时间戳
 * @returns {{ success, granted, summary }}
 */
async function grantEntitlements(db, order, ts = now()) {
  const { openid, productId, orderId, relatedId } = order
  if (!openid || !productId) return { success: false, granted: [], summary: '缺少 openid 或 productId' }

  try {
    const productRes = await db.collection('products').where({ productId }).limit(1).get()
    const product = productRes.data[0] || {}
    const durationDays = product.durationDays || 0
    const expiresAt = durationDays > 0 ? ts + durationDays * 86400 * 1000 : 0
    const level = _productIdToLevel(productId)
    const permList = PRODUCT_PERMISSIONS[productId] || [product.permission || productId]

    const granted = []

    // ═══════════════════
    // 1. 会员类：写入 memberships
    // ═══════════════════
    if (['subscription', 'membership', 'bundle'].includes(product.type)) {
      granted.push(...permList)

      const existingMember = await db.collection('memberships')
        .where({ openid, status: 'active', expiredAt: db.command.gt(ts) })
        .limit(1).get()

      if (existingMember.data.length > 0) {
        // 延期
        const old = existingMember.data[0]
        const newExpires = Math.max(old.expiredAt, ts) + durationDays * 86400 * 1000
        await db.collection('memberships').doc(old._id).update({
          data: { expiredAt: newExpires, updatedAt: ts },
        })
      } else {
        await db.collection('memberships').add({
          data: {
            openid, status: 'active', level,
            memberType: productId, permissions: granted,
            orderId: orderId || order.orderId,
            startedAt: ts, expiredAt: expiresAt,
            createdAt: ts, updatedAt: ts,
          },
        })
      }

      // 同步 users
      await db.collection('users').where({ openid }).update({
        data: { membershipLevel: level, membershipExpiredAt: expiresAt, updatedAt: ts },
      })
    }

    // ═══════════════════
    // 2. 一次性 / 咨询
    // ═══════════════════
    if (['one_time', 'single', 'consulting'].includes(product.type)) {
      granted.push(...permList)

      if (permList.includes('full_report') && relatedId) {
        await db.collection('ai_reports').where({ reportId: relatedId, openid }).update({
          data: { isPaid: true, unlockOrderId: orderId || order.orderId, updatedAt: ts },
        })
      }
    }

    // ═══════════════════
    // 3. 更新 entitlements 缓存
    // ═══════════════════
    const uniquePerms = [...new Set(granted)]
    await _upsertEntitlements(db, openid, uniquePerms, productId, expiresAt, ts)

    return { success: true, granted: uniquePerms, summary: `已发放 ${uniquePerms.length} 项权益` }
  } catch (err) {
    console.error('[entitlementService] grantEntitlements 异常:', err.message)
    return { success: false, granted: [], summary: '发放异常' }
  }
}

/**
 * revokeEntitlements — 退款回收权益
 */
async function revokeEntitlements(db, order) {
  const { openid, productId } = order
  try {
    const productRes = await db.collection('products').where({ productId }).limit(1).get()
    const product = productRes.data[0] || {}

    // 会员类 → 取消 activation
    if (['subscription', 'membership', 'bundle'].includes(product.type)) {
      await db.collection('memberships').where({ openid, status: 'active' }).update({
        data: { status: 'refunded', updatedAt: now() },
      })
      await db.collection('users').where({ openid }).update({
        data: { membershipLevel: 'free', membershipExpiredAt: 0, updatedAt: now() },
      })
    }

    // 一次性 → 重置解锁
    if (['one_time', 'single', 'consulting'].includes(product.type)) {
      if (PRODUCT_PERMISSIONS[productId]?.includes('full_report') && order.relatedId) {
        await db.collection('ai_reports').where({ reportId: order.relatedId, openid }).update({
          data: { isPaid: false, updatedAt: now() },
        })
      }
    }

    // 清理 entitlements
    await _downgradeToFree(db, openid)
  } catch (e) {
    console.error('[entitlementService] revokeEntitlements 异常:', e.message)
  }
}

/**
 * refreshEntitlements — 重算用户权限
 * 用于过期清理后确保 entitlements 与 memberships 一致
 */
async function refreshEntitlements(db, openid) {
  const ts = now()
  try {
    const [memRes, entRes] = await Promise.all([
      db.collection('memberships')
        .where({ openid, status: 'active', expiredAt: db.command.gt(ts) })
        .limit(1).get(),
      db.collection('entitlements').where({ openid }).limit(1).get(),
    ])

    const member = memRes.data[0]
    const ent = entRes.data[0]

    if (member) {
      // 有有效会员 → 重算权限
      const newPerms = [...new Set([
        ...FREE_PERMISSIONS,
        ...(member.permissions || []),
        ...(PRODUCT_PERMISSIONS[member.memberType] || []),
      ])]

      if (ent) {
        await db.collection('entitlements').doc(ent._id).update({
          data: { permissions: newPerms, updatedAt: ts },
        })
      } else {
        await db.collection('entitlements').add({
          data: {
            openid, permissions: newPerms,
            sources: [{ productId: member.memberType, expiresAt: member.expiredAt }],
            createdAt: ts, updatedAt: ts,
          },
        })
      }
    } else {
      // 无会员 → 免费
      await _downgradeToFree(db, openid)
    }

    return { success: true }
  } catch (err) {
    console.error('[entitlementService] refreshEntitlements 异常:', err.message)
    return { success: false }
  }
}

/**
 * getEntitlementState — 获取用户权限完整状态
 */
async function getEntitlementState(db, openid) {
  try {
    const ts = now()
    const [entRes, memRes] = await Promise.all([
      db.collection('entitlements').where({ openid }).limit(1).get(),
      db.collection('memberships').where({ openid, status: 'active', expiredAt: db.command.gt(ts) }).limit(1).get(),
    ])

    const level = await getMembershipLevel(db, openid)
    const member = memRes.data[0]

    return {
      openid,
      permissions: entRes.data[0]?.permissions || FREE_PERMISSIONS,
      membershipLevel: level,
      membershipExpiredAt: member?.expiredAt || 0,
      isVip: level !== 'free',
      isYearly: level === 'yearly',
      sources: entRes.data[0]?.sources || [],
    }
  } catch (_) {
    return {
      openid,
      permissions: FREE_PERMISSIONS,
      membershipLevel: 'free',
      membershipExpiredAt: 0,
      isVip: false,
      isYearly: false,
      sources: [],
    }
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

async function _upsertEntitlements(db, openid, newPerms, productId, expiresAt, ts) {
  const entRes = await db.collection('entitlements').where({ openid }).limit(1).get()
  const newSource = { productId, expiresAt }

  if (entRes.data.length > 0) {
    const existing = entRes.data[0]
    const mergedPerms = [...new Set([...(existing.permissions || []), ...newPerms])]
    const mergedSources = [...(existing.sources || []), newSource]
    await db.collection('entitlements').doc(existing._id).update({
      data: { permissions: mergedPerms, sources: mergedSources, updatedAt: ts },
    })
  } else {
    await db.collection('entitlements').add({
      data: { openid, permissions: newPerms, sources: [newSource], createdAt: ts, updatedAt: ts },
    })
  }
}

async function _downgradeToFree(db, openid) {
  await db.collection('entitlements').where({ openid }).update({
    data: { permissions: FREE_PERMISSIONS, sources: [], updatedAt: now() },
  })
  await db.collection('users').where({ openid }).update({
    data: { membershipLevel: 'free', membershipExpiredAt: 0, updatedAt: now() },
  })
}

function _productIdToLevel(productId) {
  if (productId.includes('MONTHLY')) return 'monthly'
  if (productId.includes('QUARTERLY')) return 'quarterly'
  if (productId.includes('YEARLY')) return 'yearly'
  if (productId.includes('bundle')) return 'yearly'
  return 'vip'
}

module.exports = {
  grantEntitlements,
  revokeEntitlements,
  refreshEntitlements,
  getEntitlementState,
}
