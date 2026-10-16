/**
 * virtualPayCallback — RC8_13 虚拟支付·道具发货推送 xpay_goods_deliver_notify
 *
 * ── RC8_14_P0_PROD_CALLBACK_FAIL_CLOSED_PATCH ────────────────────────────────
 * 本函数【无】可信推送通道（无 HTTP 路由、无消息推送触发器；生产唯一 HTTP 路由为
 * /payCallback → payCallback）。因此唯一入站路径是同环境 authenticated client 的
 * wx.cloud.callFunction，客户端可完全伪造推送负载 ⇒ 绝不可作为支付权威。
 *
 * 本次补丁：在【最早入口】接入 fail-closed 调用方权威（lib/callbackAuthority.js）。
 *   - 可信推送来源白名单为空（TRUSTED_PUSH_SOURCES = ∅）——没有合法推送通道可放行。
 *   - 默认 DENY：任何外部事件在【任何订单读取 / finalize / 写库之前】一律拒绝。
 *   - 客户端自带的 trusted 标志 / provider 证据一律不信任、不能覆盖 DENY。
 *   - 绝不构造合成 transactionId（不再有 'XPAY'+outTradeNo 兜底）。
 *   - 无订单 paid 跃迁 / 无权益发放 / 无 payments 写入。
 *   - 非发货事件：安全空确认（ack 0，不触发发货）。
 *
 * 合法支付确认【不受影响】：由 verifyVirtualPayment 经官方 /xpay/query_order
 * （access_token + pay_sig）独立完成（同一 finalizePaidOrder，exactly-once）。
 * 未来接入真实可信推送通道需【单独评审】的改动；白名单永不由 env 或客户端输入填充。
 *
 * 推送契约（官方）：xpay_goods_deliver_notify
 *   应答 { "ErrCode": 0, "ErrMsg": "success" }；非 0 微信最多重试 15 次。
 *
 * 安全：绝不打印 openid 明文以外敏感信息；绝不打印任何密钥/session_key/access_token。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { finalizePaidOrder } = require('./lib/paymentFinalizer.js')
const { grantEntitlements } = require('./lib/entitlementService.js')
const { resolveVirtualPayConfig, presenceOnly } = require('./lib/virtualPayCatalog.js')
// RC8_14_P0_PROD_CALLBACK_FAIL_CLOSED_PATCH — fail-closed caller authority.
// Empty trusted allow-list ⇒ every external callback is denied before any DB access.
const { applyContainedCallback } = require('./lib/callbackAuthority.js')

function _ack (errCode) {
  return { ErrCode: errCode || 0, ErrMsg: errCode ? 'error' : 'success' }
}

exports.main = async (event) => {
  // ── 配置自检（仅布尔，只读，不涉支付）──
  if (event && event.__selfcheck === true) {
    return { ok: true, service: 'virtualPayCallback', stage: 'stage1', virtualPay: presenceOnly(resolveVirtualPayConfig(process.env)) }
  }

  // ── FAIL-CLOSED CALLER AUTHORITY（最早入口）──
  // 在任何订单读取 / finalize / 写库【之前】判定调用方权威。
  // 可信推送白名单为空 ⇒ 发货推送一律拒绝（ack 1）；非发货事件安全空确认（ack 0）。
  // 合法支付确认由 verifyVirtualPayment（/xpay/query_order）独立完成，不受影响。
  try {
    const res = await applyContainedCallback(db, event, { finalizePaidOrder, grantEntitlements }, {
      wxContext: cloud.getWXContext(),
      env: process.env,
      ts: Date.now(),
    })
    if (!res.applied && !res.benign) {
      console.error(`[virtualPayCallback] 调用方权威拒绝 reason=${res.reason || 'DENIED'}`)
    }
    return _ack(res.ack)
  } catch (err) {
    console.error('[virtualPayCallback] 异常:', err.message)
    return _ack(1)
  }
}
