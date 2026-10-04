/**
 * virtualPayCallback — RC8_13 虚拟支付·道具发货推送 xpay_goods_deliver_notify（服务器权威 · exactly-once）
 *
 * 权威原则：
 *   - 客户端 wx.requestVirtualPayment success 永不作为发货/权益权威。
 *   - 发货推送（或 /xpay/query_order 兜底）经校验后，交由与 payCallback/verifyPayment
 *     共用的唯一权威完成路径 finalizePaidOrder 完成（订单→paid + 支付流水 + 会员权益，exactly-once）。
 *
 * 推送契约（官方）：xpay_goods_deliver_notify
 *   { Event, OpenId, OutTradeNo, Env, WeChatPayInfo{MchOrderNo,TransactionId,PaidTime},
 *     GoodsInfo{ProductId,Quantity,OrigPrice,ActualPrice,Attach} }
 *   应答 { "ErrCode": 0, "ErrMsg": "success" }；非 0 微信最多重试 15 次。
 *
 * 安全：绝不打印 openid 明文以外敏感信息；绝不打印任何密钥/session_key/access_token。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { finalizePaidOrder } = require('./lib/paymentFinalizer.js')
const { grantEntitlements } = require('./lib/entitlementService.js')
const { findByVirtualProductId, resolveVirtualPayConfig } = require('./lib/virtualPayCatalog.js')

const now = () => Date.now()

function _ack (errCode) {
  return { ErrCode: errCode || 0, ErrMsg: errCode ? 'error' : 'success' }
}

exports.main = async (event) => {
  const ts = now()

  // ── 配置自检（仅布尔）──
  if (event && event.__selfcheck === true) {
    return { ok: true, service: 'virtualPayCallback', stage: 'stage1', virtualPay: resolveVirtualPayConfig(process.env) }
  }

  const evt = (event && (event.Event || event.event)) || ''
  if (evt !== 'xpay_goods_deliver_notify') {
    // 非发货事件（含未识别推送）：安全确认，不触发发货。
    return _ack(0)
  }

  const openid = event.OpenId || event.openid || ''
  const outTradeNo = event.OutTradeNo || event.outTradeNo || ''
  const envIn = event.Env != null ? Number(event.Env) : null
  const payInfo = event.WeChatPayInfo || {}
  const goods = event.GoodsInfo || {}

  if (!outTradeNo) {
    console.error('[virtualPayCallback] 缺少 OutTradeNo，拒绝')
    return _ack(1)
  }

  try {
    // ── 本地订单映射 ──
    const orderRes = await db.collection('orders').where({ orderId: outTradeNo }).limit(1).get()
    const order = orderRes.data && orderRes.data[0]
    if (!order) {
      console.error(`[virtualPayCallback] 订单不存在 outTradeNo=${outTradeNo}`)
      return _ack(1)
    }

    // ── 归属校验 ──
    if (openid && order.openid && openid !== order.openid) {
      console.error('[virtualPayCallback] openid 与订单归属不一致，拒绝')
      return _ack(1)
    }
    // ── 环境校验（防跨环境串单）──
    if (envIn != null && order.env != null && envIn !== order.env) {
      console.error('[virtualPayCallback] Env 与订单环境不一致，拒绝')
      return _ack(1)
    }
    // ── 商品校验（virtualProductId ↔ 本地目录）──
    const mapped = findByVirtualProductId(goods.ProductId != null ? goods.ProductId : order.virtualProductId)
    if (!mapped || !order.productId || mapped.localProductId !== order.productId) {
      console.error('[virtualPayCallback] 商品与订单不一致，拒绝')
      return _ack(1)
    }
    // ── 数量校验 ──
    if (goods.Quantity != null && Number(goods.Quantity) !== 1) {
      console.error('[virtualPayCallback] 数量异常，拒绝')
      return _ack(1)
    }
    // ── 金额校验（分）──
    const actual = goods.ActualPrice != null ? Number(goods.ActualPrice) : null
    if (actual != null && actual !== Number(order.totalAmount)) {
      console.error('[virtualPayCallback] 金额与订单不一致，拒绝')
      return _ack(1)
    }

    const transactionId = String(
      payInfo.TransactionId || payInfo.WxOrderId || ('XPAY' + outTradeNo)
    )
    const provider = {
      tradeState: 'SUCCESS',
      transactionId,
      outTradeNo,
      mchid: '', // 虚拟支付无商户号字段；金额/商品/归属由本函数 + finalizer 校验
      appid: process.env.WX_APPID || process.env.WXPAY_APPID || '',
      amountTotal: actual != null ? actual : Number(order.totalAmount),
      amountCurrency: 'CNY',
      amountPayerTotal: actual != null ? actual : Number(order.totalAmount),
      tradeType: 'VIRTUAL',
      bankType: '',
      successTime: payInfo.PaidTime ? String(payInfo.PaidTime) : '',
    }

    // ── 唯一权威完成路径（exactly-once）──
    const result = await finalizePaidOrder(db, {
      orderId: outTradeNo,
      source: 'callback',
      provider,
      expect: { mchid: '', appid: '' },
      ts,
    }, { grantEntitlements })

    if (!result.ok) {
      console.error(`[virtualPayCallback] finalize 拒绝 orderId=${outTradeNo} reason=${result.reason}`)
      // 非 0 → 微信按策略重试（避免静默失败导致漏发）
      return _ack(1)
    }

    console.log(`[virtualPayCallback] ✅ 完成 outTradeNo=${outTradeNo} idempotent=${!!result.idempotent}`)
    return _ack(0)
  } catch (err) {
    console.error('[virtualPayCallback] 异常:', err.message)
    return _ack(1)
  }
}
