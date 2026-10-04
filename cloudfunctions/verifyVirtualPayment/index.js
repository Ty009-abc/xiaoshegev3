/**
 * verifyVirtualPayment — RC8_13 虚拟支付·查单兜底（SKELETON / BOOTSTRAP）
 *
 * 状态：骨架。仅实现订单自持校验 + 配置自检；官方 /xpay/query_order 查询与
 *       exactly-once 完成为 Stage1 实现点，当前以 NOT_IMPLEMENTED 显式返回。
 *
 * 用途（Stage1）：推送延迟/丢失、收银台返回、App 重启后的兜底确认。
 * 权威：查询应答即为支付权威，经与 payCallback/verifyPayment 共用的同一
 *       exactly-once finalizer 完成（绝不重复发放会员时长）。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const { resolveVirtualPayConfig } = require('./lib/virtualPayCatalog.js')

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED, '未认证用户')

  const cfg = resolveVirtualPayConfig(process.env)

  if (event && event.__selfcheck === true) {
    return ok({ virtualPay: cfg, service: 'verifyVirtualPayment', stage: 'bootstrap' })
  }

  const { orderId } = event || {}
  if (!orderId) return fail(CODES.PARAM_ERROR, '缺少 orderId')

  // 订单归属校验（本地权威）
  const res = await db.collection('orders').where({ orderId }).limit(1).get()
  const order = res.data && res.data[0]
  if (!order) return fail(CODES.NOT_FOUND, '订单不存在')
  if (order.openid !== openid) return fail(CODES.FORBIDDEN, '这不是你的订单')

  if (order.status === 'paid') return ok({ orderId, status: 'paid', message: '已支付' })

  // Stage1 实现点：调 /xpay/query_order（应答验签）→ finalizePaidOrder exactly-once
  return fail(CODES.NOT_IMPLEMENTED, 'verifyVirtualPayment 骨架：查单/完成待 Stage1 实现', {
    orderId,
    status: order.status || null,
    queryApi: '/xpay/query_order',
  })
}
