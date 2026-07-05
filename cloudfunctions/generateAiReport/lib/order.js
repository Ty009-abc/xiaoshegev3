/**
 * common/order.js - 订单 & 权益发放公共方法
 */

const { now } = require('./permission.js')

/**
 * 生成订单号
 */
function generateOrderId() {
  const ts = now()
  const rnd = Math.random().toString(36).slice(2, 8)
  return `XSG${ts}${rnd}`
}

/**
 * 生成报告 ID
 */
function generateReportId() {
  const ts = now()
  const rnd = Math.random().toString(36).slice(2, 8)
  return `AR${ts}${rnd}`
}

/**
 * 发放权益 — 根据 product.permission 类型
 *
 * @param {object}   db
 * @param {string}   openid
 * @param {object}   product    - products 表记录
 * @param {string}   orderId    - 关联订单号
 * @param {string}   relatedId  - 关联报告/挑战 ID
 */
async function activatePermission(db, openid, product, orderId, relatedId) {
  const ts = now()
  const { permission, type, durationDays, permissions } = product

  try {
    // ======================== membership 类型 ========================
    if (type === 'membership') {
      const durationMs = (durationDays || 30) * 86400 * 1000
      const expiredAt = ts + durationMs

      // 构建权限列表
      const perms = permissions || [
        'ai_unlimited','report_unlock','challenge_unlock',
        'world_rules_unlock','history_insights_unlock',
        'poster_generate','advanced_profile',
      ]

      const memberRes = await db.collection('memberships').where({ openid, status: 'active' }).limit(1).get()

      if (memberRes.data[0]) {
        // 已有会员，延期或覆盖
        const old = memberRes.data[0]
        const newExpiredAt = Math.max(old.expiredAt || 0, ts) + durationMs
        await db.collection('memberships').doc(old._id).update({
          data: {
            status: 'renewed',
            expiredAt: ts,
            updatedAt: ts,
          },
        })
        await db.collection('memberships').add({
          data: {
            openid,
            status: 'active',
            memberType: product.productId,
            permissions: perms,
            orderId,
            startedAt: ts,
            expiredAt: newExpiredAt,
            createdAt: ts,
            updatedAt: ts,
          },
        })
      } else {
        await db.collection('memberships').add({
          data: {
            openid,
            status: 'active',
            memberType: product.productId,
            permissions: perms,
            orderId,
            startedAt: ts,
            expiredAt,
            createdAt: ts,
            updatedAt: ts,
          },
        })
      }

      // 同步 users 快照
      const level = product.productId || 'vip_month'
      await db.collection('users').where({ openid }).update({
        data: { membershipLevel: level, membershipExpiredAt: expiredAt, updatedAt: ts },
      })

      return { success: true, type: 'membership', message: '会员已激活' }
    }

    // ======================== single 类型 ========================
    if (type === 'single') {
      if (permission === 'report_unlock') {
        // 解锁对应报告
        if (relatedId) {
          await db.collection('ai_reports').where({ reportId: relatedId, openid }).update({
            data: { isPaid: true, unlockOrderId: orderId, updatedAt: ts },
          })
        }
        return { success: true, type: 'single', message: '报告已解锁' }
      }

      if (permission === 'challenge_unlock') {
        // 解锁当前挑战
        if (relatedId) {
          await db.collection('challenge_records').where({ recordId: relatedId, openid }).update({
            data: { trialMode: false, updatedAt: ts },
          })
        }
        return { success: true, type: 'single', message: '挑战已解锁' }
      }

      // 通用权限标记
      return { success: true, type: 'single', message: '权限已激活' }
    }

    return { success: false, message: '未知商品类型: ' + type }
  } catch (err) {
    console.error('[activatePermission] 异常:', err.message)
    return { success: false, message: err.message }
  }
}

module.exports = {
  generateOrderId,
  generateReportId,
  activatePermission,
  now,
}
