/**
 * getPaymentResult - 支付结果查询
 * 前端轮询用：查订单最终状态
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { orderId } = event
  if (!orderId) return fail(CODES.PARAM_ERROR, '缺少 orderId')

  console.log(`[getPaymentResult] openid=${openid} orderId=${orderId}`)

  try {
    const res = await db.collection('orders').where({ orderId, openid }).limit(1).get()
    const order = res.data[0]
    if (!order) return fail(CODES.NOT_FOUND, '订单不存在')

    if (order.status === 'paid') {
      return ok({
        status: 'paid',
        orderId: order.orderId,
        productId: order.productId,
        message: '支付成功',
      })
    }

    return ok({
      status: order.status || 'pending',
      orderId: order.orderId,
      message: order.status === 'pending_payment' ? '等待支付' : '订单未支付',
    })
  } catch (err) {
    console.error('[getPaymentResult] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
