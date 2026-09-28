/**
 * common/paymentLog.js - 支付审计日志「尽力而为」写入（PAYMENT_STAGE4D）
 *
 * 设计原则：
 *   - 审计/可观测性日志是「观测」而非「支付权威」。
 *   - payment_logs 写入失败【绝不】影响支付业务结果：不得把成功的微信预支付
 *     变成 PAYMENT_ERROR，不得阻止订单进入 pending_payment，不得阻止
 *     paymentParams 返回，不得把未支付订单标记为已支付，不得伪造 provider 成功。
 *   - 本助手内部吞掉一切异常（仅 console.error 安全元数据），永不向上抛出。
 *
 * 安全：
 *   - 仅接受白名单字段；绝不写入私钥 / APIv3 密钥 / 完整签名 / 其它密钥材料。
 *   - 失败时只打印 action / orderId / 错误码 / 截断错误消息，绝不打印密钥。
 *
 * @module common/paymentLog
 */

// 允许写入的字段白名单（安全、可观测）。其它字段一律忽略。
const SAFE_FIELDS = [
  'orderId', 'productId', 'stage', 'status', 'source', 'providerCode',
  'tradeState', 'errorCode', 'openid', 'message', 'request', 'response',
  'correlationId', 'relatedId', 'action',
]

/**
 * safeWritePaymentLog — 尽力而为地写入一条 payment_logs 审计记录。
 * 永不抛出；返回 { logged: boolean }。
 *
 * @param {object} db  wx-server-sdk 数据库句柄
 * @param {object} entry  { action, orderId?, productId?, stage?, status?, source?,
 *                          providerCode?, tradeState?, errorCode?, ts?, ...安全字段 }
 * @returns {Promise<{logged: boolean}>}
 */
async function safeWritePaymentLog (db, entry) {
  const e = entry || {}
  const doc = { createdAt: e.ts || Date.now() }
  for (let i = 0; i < SAFE_FIELDS.length; i++) {
    const k = SAFE_FIELDS[i]
    if (e[k] !== undefined) doc[k] = e[k]
  }
  try {
    await db.collection('payment_logs').add({ data: doc })
    return { logged: true }
  } catch (err) {
    // 绝不影响支付业务流：仅记录安全元数据。
    try {
      console.error('[paymentLog] best-effort write failed (non-fatal): ' + JSON.stringify({
        action: doc.action || null,
        orderId: doc.orderId || null,
        errorCode: (err && (err.errCode || err.code)) || null,
        error: String((err && err.message) || err).slice(0, 160),
      }))
    } catch (_) { /* even logging must not throw */ }
    return { logged: false }
  }
}

module.exports = { safeWritePaymentLog, SAFE_FIELDS }
