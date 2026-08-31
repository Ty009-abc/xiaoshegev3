/**
 * cloudfunctions/verifyPayment/lib/paymentAuthority.js
 *
 * 服务端支付权威守卫 (Stage21 Batch4 R1 — PAYMENT_MOCK_AUTHORITY_GUARD).
 *
 * 唯一职责：在 verifyPayment 的权威 SUCCESS 状态转换之前，识别并拒绝
 * mock 支付结果，保证 mock 结果永远无法进入：
 *   - order.status = paid
 *   - grantEntitlements(...)
 *   - membership / entitlement 激活
 *   - 权威支付成功
 *
 * 这是纯函数模块（无 wx-server-sdk / 无 DB / 无网络），可被单测直接验证。
 *
 * 安全语义：
 *   - 前端 paymentService.js 的 `_mock` 短路仅为 UX 行为，非安全权威。
 *   - 本模块的判定基于服务端派生的 mock 标记（MOCK_TXN_ 前缀由服务端
 *     common/payment.js 的 mock queryOrder 分支写入，非客户端可控）。
 *   - `_mock` 字段当前未在 queryOrder 服务端结果中传播（仅在 jsapiOrder 的
 *     paymentParams 中出现），这里仍做防御性检查，未来若被传播亦可拦截。
 */

'use strict'

/**
 * mock 交易号命名空间前缀（服务端 payment.js mock 分支写入）。
 * 真实微信支付交易号不会以此前缀开头。
 */
const MOCK_TXN_PREFIX = 'MOCK_TXN_'

/**
 * 判断交易号是否为 mock 命名空间。
 * @param {string|undefined} txnId
 * @returns {boolean}
 */
function isMockTransactionId(txnId) {
  return typeof txnId === 'string' && txnId.indexOf(MOCK_TXN_PREFIX) === 0
}

/**
 * 判断查询结果是否为 mock 支付结果（应被权威路径拒绝）。
 *
 * 仅识别已知 mock 标记，不扩大范围：
 *   - queryResult._mock === true（若被传播）
 *   - transactionId 匹配 ^MOCK_TXN_
 *
 * 返回 false 表示“非已知 mock”，由现有 SUCCESS / 非 SUCCESS 逻辑继续处理，
 * 不改变真实支付路径与未支付状态的既有行为。
 *
 * @param {object|undefined} queryResult — queryOrder 的返回值
 * @returns {boolean} true = mock 结果（必须拒绝）
 */
function isMockPaymentResult(queryResult) {
  if (!queryResult || typeof queryResult !== 'object') return false
  if (queryResult._mock === true) return true
  if (isMockTransactionId(queryResult.transactionId)) return true
  return false
}

module.exports = {
  MOCK_TXN_PREFIX,
  isMockTransactionId,
  isMockPaymentResult,
}
