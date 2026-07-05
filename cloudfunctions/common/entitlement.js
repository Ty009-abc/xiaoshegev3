/**
 * cloudfunctions/common/entitlement.js — 权益管理公共模块
 *
 * 第五册 Part 1：Payment Architecture
 *
 * grantEntitlements(db, order, ts) → 发放权益
 * revokeEntitlements(db, order)    → 回收权益
 * hasPermission(db, openid, perm)  → 权限检查
 * getUserEntitlements(db, openid)  → 获取用户全部权益
 */

const now = () => Date.now()

/**
 * grantEntitlements(db, order, ts)
 * 根据订单商品类型发放对应权益
 *
 * @returns {{ success, granted, summary }}
 */
async function grantEntitlements(db, order, ts = now()) {
  const { openid, productId, relatedId } = order
  if (!openid || !productId) return { success: false, granted: [], summary: '缺少 openid 或 productId' }

  try {
    // 查商品
    const prodRes = await db.collection('products').where({ productId }).limit(1).get()
    const product = prodRes.data[0] || {}

    const totalGranted = []

    // ═══════════════════════
    // one_time / single — 一次性商品
    // ═══════════════════════
    if (product.type === 'one_time' || product.type === 'single') {
      if (product.permission === 'report_unlock') {
        totalGranted.push('report_unlock')
        if (relatedId) {
          await db.collection('ai_reports').where({ reportId: relatedId, openid }).update({
            data: { isPaid: true, unlockOrderId: order.orderId, updatedAt: ts },
          })
        }
      }
      if (product.permission === 'challenge_unlock') {
        totalGranted.push('challenge_unlock')
        if (relatedId) {
          await db.collection('challenge_records').where({ recordId: relatedId, openid }).update({
            data: { trialMode: false, updatedAt: ts },
          })
        }
      }
    }

    // ═══════════════════════
    // subscription / membership — 会员订阅
    // ═══════════════════════
    if (product.type === 'subscription' || product.type === 'membership') {
      const perms = ['vip', 'ai_unlimited', 'report_unlock', 'challenge_unlock',
        'world_rules_unlock', 'history_insights_unlock', 'poster_generate', 'advanced_profile']
      totalGranted.push(...perms)

      const durationDays = product.durationDays || 30
      const expiresAt = ts + durationDays * 86400 * 1000
      const level = _productIdToLevel(productId)

      // 延期 / 新开
      const existingMember = await db.collection('memberships')
        .where({ openid, status: 'active', expiredAt: db.command ? db.command.gt(ts) : { $gt: ts } })
        .limit(1).get()
      if (existingMember.data.length > 0) {
        const old = existingMember.data[0]
        const newExpiresAt = Math.max(old.expiredAt, ts) + durationDays * 86400 * 1000
        await db.collection('memberships').doc(old._id).update({
          data: { expiredAt: newExpiresAt, updatedAt: ts },
        })
      } else {
        await db.collection('memberships').add({
          data: {
            openid, status: 'active', level,
            memberType: productId, permissions: totalGranted,
            orderId: order.orderId, startedAt: ts, expiredAt: expiresAt,
            createdAt: ts, updatedAt: ts,
          },
        })
      }

      // 同步 users
      await db.collection('users').where({ openid }).update({
        data: { membershipLevel: level, membershipExpiredAt: expiresAt, updatedAt: ts },
      })
    }

    // ═══════════════════════
    // consumable / consulting — 可重复消费 / 咨询
    // ═══════════════════════
    if (product.type === 'consumable' || product.type === 'consulting') {
      totalGranted.push(product.permission || 'consumable')

      // consulting 专属追加
      if (product.type === 'consulting') {
        totalGranted.push('personal_report', 'follow_up_30d')
      }
    }

    // ═══════════════════════
    // bundle — 组合包
    // ═══════════════════════
    if (product.type === 'bundle') {
      const items = product.bundleItems || []
      totalGranted.push(...items)
      if (items.includes('vip')) {
        totalGranted.push('ai_unlimited', 'report_unlock', 'challenge_unlock',
          'world_rules_unlock', 'poster_generate')
        const durationDays = product.durationDays || 365
        const expiresAt = ts + durationDays * 86400 * 1000
        await db.collection('memberships').add({
          data: {
            openid, status: 'active', level: 'yearly',
            memberType: productId, permissions: totalGranted,
            orderId: order.orderId, startedAt: ts, expiredAt: expiresAt,
            createdAt: ts, updatedAt: ts,
          },
        })
        await db.collection('users').where({ openid }).update({
          data: { membershipLevel: 'yearly', membershipExpiredAt: expiresAt, updatedAt: ts },
        })
      }
    }

    // ═══════════════════════
    // 写入 entitlements 权限缓存
    // ═══════════════════════
    const uniquePerms = [...new Set(totalGranted)]
    const entRes = await db.collection('entitlements').where({ openid }).limit(1).get()
    if (entRes.data.length > 0) {
      const existing = entRes.data[0]
      const merged = [...new Set([...(existing.permissions || []), ...uniquePerms])]
      await db.collection('entitlements').doc(existing._id).update({
        data: { permissions: merged, updatedAt: ts },
      })
    } else {
      await db.collection('entitlements').add({
        data: { openid, permissions: uniquePerms, createdAt: ts, updatedAt: ts },
      })
    }

    return { success: true, granted: uniquePerms, summary: `已发放 ${uniquePerms.length} 项权益` }
  } catch (err) {
    console.error('[entitlement] grantEntitlements 异常:', err.message)
    return { success: false, granted: [], summary: '发放异常' }
  }
}

/**
 * revokeEntitlements(db, order)
 */
async function revokeEntitlements(db, order) {
  const { openid, productId } = order
  try {
    const prodRes = await db.collection('products').where({ productId }).limit(1).get()
    const product = prodRes.data[0] || {}

    if (product.type === 'subscription' || product.type === 'membership' || product.type === 'bundle') {
      await db.collection('memberships').where({ openid, status: 'active' }).update({
        data: { status: 'refunded', updatedAt: Date.now() },
      })
      await db.collection('users').where({ openid }).update({
        data: { membershipLevel: 'free', membershipExpiredAt: 0, updatedAt: Date.now() },
      })
    }
    if (product.type === 'one_time' || product.type === 'single' || product.type === 'consulting') {
      if (product.permission === 'report_unlock' && order.relatedId) {
        await db.collection('ai_reports').where({ reportId: order.relatedId, openid }).update({
          data: { isPaid: false, updatedAt: Date.now() },
        })
      }
    }
    await db.collection('entitlements').where({ openid }).update({
      data: { permissions: ['free'], updatedAt: Date.now() },
    })
  } catch (e) {
    console.error('[entitlement] revokeEntitlements 异常:', e.message)
  }
}

/**
 * hasPermission(db, openid, permission)
 * 快速权限检查 — 优先查 entitlements 缓存
 */
async function hasPermission(db, openid, permission) {
  if (!openid) return false
  try {
    const ent = await db.collection('entitlements').where({ openid }).limit(1).get()
    if (ent.data.length > 0 && (ent.data[0].permissions || []).includes(permission)) {
      return true
    }
    // 降级查 memberships
    const mem = await db.collection('memberships')
      .where({ openid, status: 'active', expiredAt: db.command ? db.command.gt(Date.now()) : { $gt: Date.now() } })
      .limit(1).get()
    if (mem.data.length > 0) return true
    return false
  } catch (_) {
    return false
  }
}

/**
 * getUserEntitlements(db, openid)
 */
async function getUserEntitlements(db, openid) {
  try {
    const [ent, mem] = await Promise.all([
      db.collection('entitlements').where({ openid }).limit(1).get(),
      db.collection('memberships').where({ openid, status: 'active' }).limit(1).get(),
    ])
    return {
      permissions: ent.data[0]?.permissions || [],
      membership: mem.data[0] || null,
    }
  } catch (_) {
    return { permissions: [], membership: null }
  }
}

function _productIdToLevel(productId) {
  if (productId.includes('month')) return 'monthly'
  if (productId.includes('quarter')) return 'quarterly'
  if (productId.includes('year')) return 'yearly'
  if (productId.includes('bundle')) return 'yearly'
  return 'vip'
}

module.exports = { grantEntitlements, revokeEntitlements, hasPermission, getUserEntitlements }
