'use strict'
/**
 * paymentFinalizer.js — 唯一权威支付完成路径（PAYMENT_STAGE3 exactly-once）
 *
 * 目标：verifyPayment（查单）与 payCallback（异步回调）**必须汇聚到同一权威完成路径**，
 * 杜绝重复发放权益 / 重复标记 paid / 同一 transactionId 结掉多个订单。
 *
 * 权威原则（fail-closed）：
 *   1. 客户端声明（client paid=true / 金额 / 交易号 / SKU）永不作为支付权威。
 *   2. 只有经过「微信应答验签」或「回调验签+解密」的 provider 证据才能进入本模块。
 *   3. 本模块只接受已认证的 provider 证据，并再次做金额 / 商户号 / appId / out_trade_no 校验。
 *
 * exactly-once 三重闸门（不依赖「先写 A 再写 B」的裸顺序）：
 *   G1 订单终态：orders.where({orderId, status∈可终态}).update → stats.updated===1 的唯一赢家。
 *   G2 支付流水：payments.transactionId 唯一索引 → 同一交易号最多一条；跨订单复用 → fail-closed。
 *   G3 权益发放：entitlement_grants.orderId 唯一索引 → 同一订单最多发放一次；缺失=可自愈。
 *
 * 崩溃一致性（§9）：
 *   - order=paid 但权益未发放：重入本模块时 G3 标记缺失 → 补发（自愈）。
 *   - 权益已发放但 order 未 paid：G1 重新认领；G3 已存在 → 不重复发放。
 *
 * 本文件为 canonical。verifyPayment/lib 与 payCallback/lib 各持一份字节一致的副本。
 */

const now = () => Date.now()

const REASONS = {
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  OWNERSHIP_MISMATCH: 'OWNERSHIP_MISMATCH',
  NO_PROVIDER: 'NO_PROVIDER',
  TRADE_STATE_NOT_SUCCESS: 'TRADE_STATE_NOT_SUCCESS',
  TRANSACTION_ID_MISSING: 'TRANSACTION_ID_MISSING',
  TRANSACTION_ID_INVALID: 'TRANSACTION_ID_INVALID',
  TRANSACTION_ID_REUSED: 'TRANSACTION_ID_REUSED',
  OUT_TRADE_NO_MISMATCH: 'OUT_TRADE_NO_MISMATCH',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  MCHID_MISMATCH: 'MCHID_MISMATCH',
  APPID_MISMATCH: 'APPID_MISMATCH',
  ORDER_STATUS_NOT_FINALIZABLE: 'ORDER_STATUS_NOT_FINALIZABLE',
  MOCK_NOT_ALLOWED: 'MOCK_NOT_ALLOWED',
}

// 允许 → paid 的起始状态（其余状态不得被静默重开，需显式文档授权）
const FINALIZABLE_STATUSES = ['created', 'pending', 'pending_payment']
const VALID_TERMINAL = ['paid']

// 微信支付交易号结构：商户可自定义，但进入权威前必须非空且为安全 token
const TRANSACTION_ID_RE = /^[A-Za-z0-9_-]{6,64}$/

function _isDuplicateKey (err) {
  if (!err) return false
  if (err.errCode === -502001 || err.code === -502001) return true
  return /duplicate key|E11000/i.test(String(err.message || err.errMsg || ''))
}

/**
 * validateProviderEvidence — 纯函数：认证后的 provider 证据校验（fail-closed）
 *
 * @param {object} order    本地权威订单（含 orderId, totalAmount）
 * @param {object} provider 微信权威证据 { tradeState, transactionId, outTradeNo, mchid, appid, amountTotal, amountCurrency }
 * @param {object} expect   { mchid, appid }
 * @returns {{valid:boolean, reason:string|null, issues:string[]}}
 */
function validateProviderEvidence (order, provider, expect) {
  const issues = []
  if (!provider || typeof provider !== 'object') {
    return { valid: false, reason: REASONS.NO_PROVIDER, issues: [REASONS.NO_PROVIDER] }
  }
  const exp = expect || {}

  if (provider.tradeState !== 'SUCCESS') issues.push(REASONS.TRADE_STATE_NOT_SUCCESS)

  if (provider.transactionId == null || provider.transactionId === '') {
    issues.push(REASONS.TRANSACTION_ID_MISSING)
  } else if (!TRANSACTION_ID_RE.test(String(provider.transactionId))) {
    issues.push(REASONS.TRANSACTION_ID_INVALID)
  }

  // out_trade_no：当提供方给出时必须等于本地 orderId
  if (provider.outTradeNo != null && provider.outTradeNo !== '' && provider.outTradeNo !== order.orderId) {
    issues.push(REASONS.OUT_TRADE_NO_MISMATCH)
  }

  // mchid：权威必备，缺失或不一致 → fail-closed
  if (exp.mchid) {
    if (!provider.mchid || provider.mchid !== exp.mchid) issues.push(REASONS.MCHID_MISMATCH)
  }

  // appid：给定方提供时校验
  if (exp.appid && provider.appid && provider.appid !== exp.appid) issues.push(REASONS.APPID_MISMATCH)

  // amount.total：必须与服务端权威订单金额精确一致
  if (provider.amountTotal == null || Number(provider.amountTotal) !== Number(order.totalAmount)) {
    issues.push(REASONS.AMOUNT_MISMATCH)
  }

  // currency：提供时必须是 CNY
  if (provider.amountCurrency && provider.amountCurrency !== 'CNY') issues.push(REASONS.CURRENCY_MISMATCH)

  return { valid: issues.length === 0, reason: issues.length ? issues[0] : null, issues }
}

/**
 * _claimOrderPaid — G1：原子条件更新，唯一赢家把订单推进到 paid
 */
async function _claimOrderPaid (db, order, transactionId, ts) {
  if (order.status === 'paid') return { won: false, alreadyPaid: true }
  if (!FINALIZABLE_STATUSES.includes(order.status)) {
    return { won: false, alreadyPaid: false, status: order.status }
  }
  const res = await db.collection('orders')
    .where({ orderId: order.orderId, status: db.command.in(FINALIZABLE_STATUSES) })
    .update({ data: { status: 'paid', transactionId, paidAt: ts, updatedAt: ts } })
  const n = res && res.stats ? (res.stats.updated || 0) : 0
  return { won: n === 1, alreadyPaid: false, status: n === 1 ? 'paid' : 'contended' }
}

/**
 * _grantOnce — G3：entitlement_grants.orderId 唯一索引 → 同一订单最多发放一次
 */
async function _grantOnce (db, order, transactionId, ts, grantEntitlements) {
  try {
    await db.collection('entitlement_grants').add({
      data: {
        orderId: order.orderId,
        openid: order.openid,
        productId: order.productId,
        transactionId,
        status: 'granted',
        grantedAt: ts,
        createdAt: ts,
      },
    })
  } catch (err) {
    if (_isDuplicateKey(err)) return { granted: false, idempotent: true }
    throw err
  }
  const r = await grantEntitlements(db, order, ts)
  return { granted: (r && r.granted) || [], idempotent: false, summary: r && r.summary }
}

/**
 * _paymentDoc — 权威支付流水（不含任何敏感密钥材料）
 */
function _paymentDoc (order, provider, source, ts) {
  return {
    paymentId: 'PAY_' + provider.transactionId,
    orderId: order.orderId,
    openid: order.openid,
    productId: order.productId,
    transactionId: String(provider.transactionId),
    amount: Number(order.totalAmount),
    authoritativeAmount: Number(order.totalAmount),
    currency: provider.amountCurrency || 'CNY',
    payerTotal: provider.amountPayerTotal != null ? provider.amountPayerTotal : Number(order.totalAmount),
    tradeState: 'SUCCESS',
    tradeType: provider.tradeType || 'JSAPI',
    bankType: provider.bankType || '',
    successTime: provider.successTime || '',
    source,
    status: 'paid',
    paidAt: ts,
    createdAt: ts,
  }
}

async function _audit (db, doc) {
  try {
    await db.collection('payment_logs').add({ data: Object.assign({ createdAt: doc.ts || now() }, doc) })
  } catch (_) {}
}

/**
 * finalizePaidOrder — 唯一权威完成路径
 *
 * @param {object} db
 * @param {object} ctx {
 *   orderId, openid?, source: 'query'|'callback',
 *   provider: {tradeState, transactionId, outTradeNo, mchid, appid, amountTotal, amountCurrency, amountPayerTotal, tradeType, bankType, successTime},
 *   expect: {mchid, appid}, ts?
 * }
 * @param {object} deps { grantEntitlements, isMockTransactionId } （便于测试注入）
 * @returns {{ok, reason?, idempotent?, transactionId?, granted?, issues?}}
 */
async function finalizePaidOrder (db, ctx, deps) {
  deps = deps || {}
  const grantEntitlements = deps.grantEntitlements
  const isMockTransactionId = deps.isMockTransactionId
  const ts = ctx.ts || now()
  const { orderId, openid, source, provider, expect } = ctx

  if (!grantEntitlements) throw new Error('finalizePaidOrder: grantEntitlements dep required')

  // ── 1. 定位本地订单 ──
  const orderRes = await db.collection('orders').where({ orderId }).limit(1).get()
  const order = orderRes.data[0]
  if (!order) return { ok: false, reason: REASONS.ORDER_NOT_FOUND }

  // 归属（查单路径有 openid；回调路径以订单自身 openid 为准）
  if (openid && order.openid && openid !== order.openid) {
    return { ok: false, reason: REASONS.OWNERSHIP_MISMATCH }
  }

  // ── 2. provider 证据校验（fail-closed）──
  const v = validateProviderEvidence(order, provider, expect)
  if (!v.valid) return { ok: false, reason: v.reason, issues: v.issues }

  const transactionId = String(provider.transactionId)

  // mock 交易号永不进入权威
  if (isMockTransactionId && isMockTransactionId(transactionId)) {
    return { ok: false, reason: REASONS.MOCK_NOT_ALLOWED }
  }

  // ── 3. G2 跨订单复用检测 + 支付流水 at-most-once ──
  const dupRes = await db.collection('payments').where({ transactionId }).limit(1).get()
  if (dupRes.data.length > 0) {
    const existing = dupRes.data[0]
    if (existing.orderId !== orderId) {
      await _audit(db, {
        openid: order.openid,
        orderId,
        action: 'transaction_id_reused',
        status: 'rejected',
        detail: { transactionId, existingOrderId: existing.orderId },
        ts,
      })
      return { ok: false, reason: REASONS.TRANSACTION_ID_REUSED }
    }
    // 同订单 → 幂等：确保 paid + 权益
    return await _ensure(db, order, transactionId, source, ts, grantEntitlements)
  }

  // ── 4. G1 原子终态 ──
  const claim = await _claimOrderPaid(db, order, transactionId, ts)
  if (!claim.won && !claim.alreadyPaid) {
    // 可能是并发对手已抢先置 paid → 重读确认后走幂等/自愈路径
    const re = await db.collection('orders').where({ orderId }).limit(1).get()
    const cur = re.data[0]
    if (cur && cur.status === 'paid') {
      return await _ensure(db, cur, transactionId, source, ts, grantEntitlements)
    }
    return { ok: false, reason: REASONS.ORDER_STATUS_NOT_FINALIZABLE, status: claim.status }
  }

  // ── 5. 支付流水（唯一索引 → 全局 at-most-once）──
  try {
    await db.collection('payments').add({ data: _paymentDoc(order, provider, source, ts) })
  } catch (err) {
    if (_isDuplicateKey(err)) {
      // 并发对手已写入 → 幂等
      return await _ensure(db, order, transactionId, source, ts, grantEntitlements)
    }
    throw err
  }

  // ── 6. G3 权益 exactly-once ──
  const grant = await _grantOnce(db, order, transactionId, ts, grantEntitlements)
  return {
    ok: true,
    idempotent: false,
    transactionId,
    openid: order.openid,
    granted: grant.granted,
    grantIdempotent: grant.idempotent,
    summary: grant.summary,
  }
}

/**
 * _ensure — 幂等/自愈路径：订单已 paid（或可认领）时，确保流水与权益存在
 */
async function _ensure (db, order, transactionId, source, ts, grantEntitlements) {
  const claim = await _claimOrderPaid(db, order, transactionId, ts)
  if (!claim.won && !claim.alreadyPaid) {
    return { ok: false, reason: REASONS.ORDER_STATUS_NOT_FINALIZABLE, status: claim.status }
  }
  const grant = await _grantOnce(db, order, transactionId, ts, grantEntitlements)
  return { ok: true, idempotent: true, transactionId, openid: order.openid, granted: grant.granted, grantIdempotent: grant.idempotent }
}

module.exports = {
  REASONS,
  FINALIZABLE_STATUSES,
  VALID_TERMINAL,
  TRANSACTION_ID_RE,
  validateProviderEvidence,
  finalizePaidOrder,
  _isDuplicateKey,
}
