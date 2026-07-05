/**
 * cloudfunctions/refundOrder/index.js — 退款处理
 *
 * 第五册 Part 1：Payment Architecture
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const now = () => Date.now()

exports.main = async (event) => {
  const { orderId, reason = '', isAdmin = false } = event
  if (!orderId) return { code: -1, message: '缺少 orderId' }

  const ts = now()
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return { code: -1, message: '未获取到 openid' }

  console.log(`[refundOrder] orderId=${orderId} openid=${openid} admin=${isAdmin}`)

  try {
    // 1. 查订单
    const orderRes = await db.collection('orders')
      .where(isAdmin ? { orderId } : { orderId, openid })
      .limit(1).get()
    const order = orderRes.data[0]
    if (!order) return { code: -1, message: '订单不存在' }

    // 2. 状态校验
    if (order.status === 'refunded') return { code: -1, message: '已退款' }
    if (order.status === 'closed') return { code: -1, message: '订单已关闭' }
    if (order.status !== 'paid') return { code: -1, message: `订单状态不可退款: ${order.status}` }

    // 3. 退款时效检查（7天内可退款）
    const sevenDaysMs = 7 * 86400 * 1000
    if (order.paidAt && (ts - order.paidAt) > sevenDaysMs && !isAdmin) {
      return { code: -1, message: '超过7天退款期限' }
    }

    // 4. 尝试真实退款（Mock 模式直接跳过）
    const refundResult = await _processRefund(order)
    if (!refundResult.success) {
      return { code: -1, message: refundResult.error || '退款处理失败' }
    }

    // 5. 更新 orders → refunded
    await db.collection('orders').where({ orderId }).update({
      data: {
        status: 'refunded',
        refundReason: reason,
        refundId: refundResult.refundId || '',
        refundedAt: ts,
        updatedAt: ts,
      },
    })

    // 6. 写 payments 退款流水
    await db.collection('payments').add({
      data: {
        paymentId: `REFUND_${orderId}_${ts}`,
        orderId,
        openid: order.openid,
        transactionId: order.transactionId || '',
        amount: -order.totalAmount,
        currency: 'CNY',
        tradeState: 'REFUND',
        reason,
        createdAt: ts,
      },
    })

    // 7. 回收权益
    await _revokeEntitlements(db, order)

    // 8. 写日志
    await db.collection('evolution_logs').add({
      data: {
        operation: 'refund',
        targetId: orderId,
        detail: { openid: order.openid, amount: order.totalAmount, reason },
        createdAt: ts,
      },
    })

    return { code: 0, message: '退款成功', refundId: refundResult.refundId }
  } catch (err) {
    console.error('[refundOrder] 异常:', err.message)
    return { code: -1, message: err.message }
  }
}

async function _processRefund(order) {
  // Mock 模式 — 跳过真实退款 API
  if (!process.env.WXPAY_MCHID) {
    console.warn('[refund] Mock 模式退款')
    return { success: true, refundId: `MOCK_REFUND_${order.orderId}` }
  }
  // TODO: 接入微信退款 API
  return { success: true, refundId: `REFUND_${order.orderId}` }
}

async function _revokeEntitlements(db, order) {
  const { openid, productId } = order
  try {
    // 查商品类型
    const prodRes = await db.collection('products').where({ productId }).limit(1).get()
    const product = prodRes.data[0] || {}

    // 会员类型：取消会员
    if (product.type === 'subscription' || product.type === 'membership' || product.type === 'bundle') {
      await db.collection('memberships').where({ openid, status: 'active' }).update({
        data: { status: 'refunded', updatedAt: Date.now() },
      })
      // 同步 users
      await db.collection('users').where({ openid }).update({
        data: { membershipLevel: 'free', membershipExpiredAt: 0, updatedAt: Date.now() },
      })
    }

    // 一键报告转锁定
    if (product.type === 'one_time' || product.type === 'single') {
      if (product.permission === 'report_unlock' && order.relatedId) {
        await db.collection('ai_reports').where({ reportId: order.relatedId, openid }).update({
          data: { isPaid: false, updatedAt: Date.now() },
        })
      }
    }

    // 清理 entitlements 缓存
    await db.collection('entitlements').where({ openid }).update({
      data: { updatedAt: Date.now() },
    })
  } catch (e) {
    console.error('[revokeEntitlements] 异常:', e.message)
  }
}
