/**
 * getOrderDetail - 订单详情
 * 仅返回当前 openid 的订单
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

  console.log(`[getOrderDetail] openid=${openid} orderId=${orderId}`)

  try {
    const res = await db.collection('orders').where({ orderId, openid }).limit(1).get()
    const order = res.data[0]
    if (!order) return fail(CODES.NOT_FOUND, '订单不存在')

    return ok({
      orderId: order.orderId,
      productId: order.productId,
      productName: order.productName,
      totalAmount: order.totalAmount,
      status: order.status,
      transactionId: order.transactionId || '',
      relatedId: order.relatedId || '',
      relatedType: order.relatedType || '',
      paidAt: order.paidAt || 0,
      createdAt: order.createdAt,
    })
  } catch (err) {
    console.error('[getOrderDetail] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
