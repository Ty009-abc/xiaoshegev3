/**
 * virtualPayCallback — RC8_13 虚拟支付·发货推送 (xpay_goods_deliver_notify)（SKELETON / BOOTSTRAP）
 *
 * 状态：骨架。仅实现请求形状识别 + 配置存在性自检；发货校验与「exactly-once 完成」
 *       为 Stage1 实现点，当前以 NOT_IMPLEMENTED 显式返回（绝不放发权益、不写库）。
 *
 * 官方（已核）：
 *   - 推送事件：xpay_goods_deliver_notify（道具直购现金单发货）
 *   - 应答：{ "ErrCode": 0, "ErrMsg": "success" }（推送为 JSON 则回 JSON），非 0 微信最多重试 15 次
 *   - 关键字段：OpenId / OutTradeNo / Env / WeChatPayInfo{TransactionId,PaidTime} /
 *               GoodsInfo{ProductId,Quantity,OrigPrice,ActualPrice,Attach}
 *
 * 权威（Stage1 实现约定）：客户端 success 永不作为发货权威；以本推送或 /xpay/query_order
 *   核对后，经与 payCallback/verifyPayment 共用的同一 exactly-once finalizer 完成。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { resolveVirtualPayConfig } = require('./lib/virtualPayCatalog.js')

function _ack (errCode) {
  return { ErrCode: errCode || 0, ErrMsg: errCode ? 'error' : 'success' }
}

exports.main = async (event) => {
  const cfg = resolveVirtualPayConfig(process.env)

  // 形状识别（真机推送）——仅记录是否为发货事件，不落敏感字段。
  const evt = (event && (event.Event || event.event)) || ''
  const outTradeNo = (event && (event.OutTradeNo || event.outTradeNo)) || ''
  if (evt === 'xpay_goods_deliver_notify') {
    console.log('[virtualPayCallback] deliver notify received', {
      hasOutTradeNo: !!outTradeNo,
      envFlag: cfg.envFlag,
      // 不打印 openid / attach / 任何密钥
    })
    // Stage1 实现点：验签/核对 → 校验 outTradeNo/商品/金额/数量 → 映射本地订单 →
    //   经 exactly-once finalizer 完成（幂等）。骨架阶段不发放权益。
    // 返回非 0 让微信按策略重试直至 Stage1 上线（避免静默确认后丢失发货）。
    console.error('[virtualPayCallback] bootstrap: finalizer 未实现，返回非0以便微信重试')
    return _ack(1)
  }

  // 配置自检（真机调试用；只回布尔）
  if (event && event.__selfcheck === true) {
    return { ok: true, service: 'virtualPayCallback', stage: 'bootstrap', virtualPay: cfg }
  }

  // 非发货事件：安全确认，避免无谓重试。
  return _ack(0)
}
