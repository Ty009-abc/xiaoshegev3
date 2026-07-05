/**
 * verifyPayment — 确认支付 & 发放权益（第五册 Part 1 升级版）
 *
 * 升级：
 *   1. + 订单过期检查 (30分钟)
 *   2. + 幂等保护 (payments 表去重)
 *   3. + grantEntitlements 一体化
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const { now } = require('./lib/permission.js')
const { queryOrder } = require('./lib/payment.js')
const { checkOrderExpired } = require('./lib/antiFraud.js')

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { orderId } = event
  if (!orderId) return fail(CODES.PARAM_ERROR, '缺少 orderId')

  const ts = now()
  console.log(`[verifyPayment] openid=${openid} orderId=${orderId}`)

  try {
    // ═══ 1. 查订单 ═══
    const orderRes = await db.collection('orders').where({ orderId }).limit(1).get()
    const order = orderRes.data[0]
    if (!order) return fail(CODES.NOT_FOUND, '订单不存在')
    if (order.openid !== openid) return fail(CODES.FORBIDDEN, '这不是你的订单')

    // ═══ 2. 过期检查 ═══
    const expireCheck = checkOrderExpired(order)
    if (expireCheck.expired) {
      await db.collection('orders').where({ orderId }).update({
        data: { status: 'closed', closeReason: expireCheck.message, closedAt: ts, updatedAt: ts },
      })
      return fail(CODES.ORDER_EXPIRED, expireCheck.message)
    }

    // ═══ 3. 已支付 → 直接返回 ═══
    if (order.status === 'paid') {
      return ok({ orderId, status: 'paid', message: '已支付' })
    }

    // ═══ 4. 已关闭/已退款 ═══
    if (order.status === 'closed') return fail(CODES.ORDER_CLOSED, '订单已过期关闭')
    if (order.status === 'refunded') return fail(CODES.ORDER_REFUNDED, '订单已退款')

    // ═══ 5. 调微信查单 ═══
    const queryResult = await queryOrder(orderId)

    // ═══ 6. 写 payment_logs ═══
    await db.collection('payment_logs').add({
      data: {
        openid, orderId,
        action: 'verify_payment',
        status: queryResult.tradeState === 'SUCCESS' ? 'success' : 'pending',
        request: { orderId },
        response: queryResult,
        createdAt: ts,
      },
    })

    // ═══ 7. 支付成功 → 发放权益 ═══
    if (queryResult.tradeState === 'SUCCESS') {
      // 幂等检查
      const payRes = await db.collection('payments').where({ transactionId: queryResult.transactionId }).limit(1).get()
      if (payRes.data.length > 0) {
        console.log('[verifyPayment] 已处理，跳过（幂等）')
        return ok({ orderId, status: 'paid', message: '支付已完成', transactionId: queryResult.transactionId })
      }

      // 更新订单
      await db.collection('orders').where({ orderId }).update({
        data: {
          status: 'paid',
          transactionId: queryResult.transactionId,
          paidAt: ts,
          updatedAt: ts,
        },
      })

      // 写 payments 流水
      await db.collection('payments').add({
        data: {
          paymentId: `PAY_${queryResult.transactionId}`,
          orderId,
          openid: order.openid,
          transactionId: queryResult.transactionId,
          amount: order.totalAmount,
          currency: 'CNY',
          tradeState: 'SUCCESS',
          createdAt: ts,
        },
      })

      // 发放权益
      const { grantEntitlements } = require('./lib/entitlementService.js')
      const grantResult = await grantEntitlements(db, order, ts)

      return ok({
        orderId,
        status: 'paid',
        transactionId: queryResult.transactionId,
        activation: grantResult,
      })
    }

    // 未支付
    return ok({ orderId, status: 'pending_payment', message: '等待支付中', tradeState: queryResult.tradeState })
  } catch (err) {
    console.error('[verifyPayment] 异常:', err)
    return fail(CODES.PAYMENT_ERROR, err.message)
  }
}
