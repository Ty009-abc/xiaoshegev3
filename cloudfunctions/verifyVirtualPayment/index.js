/**
 * verifyVirtualPayment — RC8_13 虚拟支付·查单兜底（服务器权威 · 同一 exactly-once finalizer）
 *
 * 用途：发货推送延迟/丢失、用户从收银台返回、App 重启后的兜底确认。
 * 权威：official /xpay/query_order 应答（需 access_token + pay_sig）为支付权威；
 *       经与 virtualPayCallback / payCallback / verifyPayment 共用的唯一权威完成路径
 *       finalizePaidOrder 完成（幂等，回调/查单并发下仍 exactly-once）。
 *
 * 官方契约（已核 https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_query_order）：
 *   GET https://api.weixin.qq.com/xpay/query_order?access_token=xxx&pay_sig=xxx
 *   body { openid, env, order_id | wx_order_id }
 *   resp.order.status: 2 已支付待发货 / 3 发货中 / 4 已发货（>=2 且 <=4 视为已支付成功）
 *
 * 安全：access_token / AppKey / session_key 绝不返回客户端、绝不入日志。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const { finalizePaidOrder, REASONS } = require('./lib/paymentFinalizer.js')
const { grantEntitlements } = require('./lib/entitlementService.js')
const { resolveVirtualPayConfig } = require('./lib/virtualPayCatalog.js')
const {
  resolveEnvFlag,
  selectAppKey,
  calcPaySig,
  getAccessToken,
  httpsRequestJson,
} = require('./lib/virtualPaySigning.js')

const now = () => Date.now()
const QUERY_URI = '/xpay/query_order'

exports.main = async (event) => {
  // ── 配置自检（仅布尔）──
  if (event && event.__selfcheck === true) {
    return ok({ virtualPay: resolveVirtualPayConfig(process.env), service: 'verifyVirtualPayment', stage: 'stage1' })
  }

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED, '未认证用户')

  const { orderId } = event || {}
  if (!orderId) return fail(CODES.PARAM_ERROR, '缺少 orderId')

  const ts = now()
  const envFlag = resolveEnvFlag(process.env)

  const res = await db.collection('orders').where({ orderId }).limit(1).get()
  const order = res.data && res.data[0]
  if (!order) return fail(CODES.NOT_FOUND, '订单不存在')
  if (order.openid !== openid) return fail(CODES.FORBIDDEN, '这不是你的订单')

  if (order.status === 'paid') return ok({ orderId, status: 'paid', message: '已支付' })
  if (order.status === 'closed') return fail(CODES.ORDER_CLOSED, '订单已关闭')
  if (order.status === 'refunded') return fail(CODES.ORDER_REFUNDED, '订单已退款')

  const cfg = resolveVirtualPayConfig(process.env)
  if (!cfg.offerIdPresent) return fail(CODES.CONFIG_ERROR, '虚拟支付环境未配置')

  // ── /xpay/query_order（服务端 API：access_token + pay_sig）──
  const accessToken = await getAccessToken(process.env)
  if (!accessToken) return fail(CODES.CONFIG_ERROR, 'access_token 获取失败（需配置 WX_APPID/WX_APPSECRET）')

  const appKey = selectAppKey(process.env, envFlag)
  if (!appKey) return fail(CODES.CONFIG_ERROR, '虚拟支付 AppKey 缺失', { envFlag })

  const postBody = JSON.stringify({ openid, env: envFlag, order_id: order.orderId })
  const paySig = calcPaySig(QUERY_URI, postBody, appKey)
  if (!paySig) return fail(CODES.CONFIG_ERROR, '查询签名生成失败')

  const url = 'https://api.weixin.qq.com' + QUERY_URI +
    '?access_token=' + encodeURIComponent(accessToken) + '&pay_sig=' + encodeURIComponent(paySig)
  const resp = await httpsRequestJson('POST', url, postBody)

  if (!resp || (resp.errcode && resp.errcode !== 0)) {
    const code = resp && resp.errcode
    console.warn(`[verifyVirtualPayment] query_order 失败 errcode=${code || 'null'}`)
    // 268490009: session_key 不存在/过期；其它错误一律 fail-closed（不发放）
    return fail(CODES.PAYMENT_ERROR, '查单失败', { errcode: code || null })
  }

  const o = (resp && resp.order) || {}
  const status = Number(o.status)
  const paidConfirmed = status >= 2 && status <= 4 // 2 已支付待发货 / 3 发货中 / 4 已发货

  if (!paidConfirmed) {
    return ok({ orderId, status: 'pending_payment', message: '等待支付中', providerStatus: status })
  }

  const amountTotal = o.paid_fee != null ? Number(o.paid_fee)
    : (o.order_fee != null ? Number(o.order_fee) : Number(order.totalAmount))
  const transactionId = String(o.wxpay_order_id || o.channel_order_id || o.wx_order_id || ('XPAY' + order.orderId))

  const provider = {
    tradeState: 'SUCCESS',
    transactionId,
    outTradeNo: o.order_id || order.orderId,
    mchid: '',
    appid: process.env.WX_APPID || process.env.WXPAY_APPID || '',
    amountTotal,
    amountCurrency: 'CNY',
    amountPayerTotal: amountTotal,
    tradeType: 'VIRTUAL',
    bankType: '',
    successTime: o.paid_time ? String(o.paid_time) : '',
  }

  const result = await finalizePaidOrder(db, {
    orderId: order.orderId,
    openid,
    source: 'query',
    provider,
    expect: { mchid: '', appid: '' },
    ts,
  }, { grantEntitlements })

  if (!result.ok) {
    console.warn(`[verifyVirtualPayment] finalize 拒绝 orderId=${orderId} reason=${result.reason}`)
    return fail(CODES.PAYMENT_ERROR, '支付未通过权威校验', { reason: result.reason })
  }

  return ok({
    orderId,
    status: 'paid',
    transactionId: result.transactionId,
    idempotent: !!result.idempotent,
    activation: result.granted || [],
  })
}
