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

// 权益发放认领的过期接管窗口（崩溃/卡死后可被重新认领）
const GRANT_CLAIM_STALE_MS = 90 * 1000

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
 * _readGrant — 读取某订单的权益发放标记
 */
async function _readGrant (db, orderId) {
  const res = await db.collection('entitlement_grants').where({ orderId }).limit(1).get()
  return (res && res.data && res.data[0]) || null
}

/**
 * _updateGrant — 更新标记（不带终态语义，调用方负责状态含义）
 */
async function _updateGrant (db, orderId, data) {
  return db.collection('entitlement_grants').where({ orderId }).update({ data })
}

/**
 * _ensureGrant — G3 权益 exactly-once + target-proven 状态机
 *
 *   状态：applying → granted | failed
 *   - 只有「成功创建标记」或「CAS 接管（failed / 陈旧 applying）」的调用者才是 applier，
 *     由且仅由 applier 调用 grantEntitlements，从而在 verify+callback 并发下
 *     **恰有一个成功发放结果**。
 *   - status='granted' 仅在 grantEntitlements 回读证明目标已生效后才写入。
 *   - marker 存在 ≠ 成功；历史遗留 granted 但 applied!==true 不被信任，重走发放/证明。
 *   - 崩溃后重入：陈旧 applying 被接管重跑；目标幂等，证明后升为 granted。
 *
 * @returns {{ granted, idempotent, markerStatus, applied, pending?, reason? }}
 */
async function _ensureGrant (db, order, transactionId, ts, grantEntitlements) {
  let marker = await _readGrant(db, order.orderId)
  let isApplier = false

  // 1. 初次创建（orderId 唯一索引 = 幂等权威）
  if (!marker) {
    try {
      await db.collection('entitlement_grants').add({
        data: {
          orderId: order.orderId,
          openid: order.openid,
          productId: order.productId,
          transactionId,
          status: 'applying',
          applied: false,
          attempts: 1,
          claimAt: ts,
          createdAt: ts,
          updatedAt: ts,
        },
      })
      isApplier = true
    } catch (err) {
      if (!_isDuplicateKey(err)) throw err
    }
    marker = await _readGrant(db, order.orderId)
  }

  if (!marker) throw new Error('entitlement_grants marker unreadable after claim')

  // 2. 已完整发放（target-proven）→ 信任并跳过
  if (marker.status === 'granted' && marker.applied === true) {
    return { granted: marker.granted || [], idempotent: true, markerStatus: 'granted', applied: true }
  }

  // 3. 非创建者：判断是否接管（failed 重试 / 陈旧 applying 接管）
  if (!isApplier) {
    if (marker.status === 'failed') {
      const res = await db.collection('entitlement_grants')
        .where({ orderId: order.orderId, status: 'failed' })
        .update({ data: { status: 'applying', claimAt: ts, updatedAt: ts } })
      isApplier = !!(res && res.stats && res.stats.updated === 1)
    } else if (marker.status === 'applying') {
      const claimAt = marker.claimAt || 0
      const stale = (ts - claimAt) > GRANT_CLAIM_STALE_MS
      if (stale) {
        const res = await db.collection('entitlement_grants')
          .where({ orderId: order.orderId, status: 'applying', claimAt })
          .update({ data: { status: 'applying', claimAt: ts, updatedAt: ts } })
        isApplier = !!(res && res.stats && res.stats.updated === 1)
      }
    } else if (marker.status === 'granted' && marker.applied !== true) {
      // 历史遗留「假阳性」标记：status=granted 但从未经过目标证明。
      // 不盲信 → CAS 认领并重走发放+回读证明（reconcile）。
      const res = await db.collection('entitlement_grants')
        .where({ orderId: order.orderId, status: 'granted' })
        .update({ data: { status: 'applying', claimAt: ts, updatedAt: ts } })
      isApplier = !!(res && res.stats && res.stats.updated === 1)
      await _audit(db, { openid: order.openid, orderId: order.orderId, action: 'legacy_grant_marker_reconcile', priorStatus: 'granted', ts })
    }
  }

  const attempts = (marker.attempts || 0) + 1

  // 4. 非 applier：他人正在发放 → 反映当前状态，不重复写入
  if (!isApplier) {
    const cur = await _readGrant(db, order.orderId)
    if (cur && cur.status === 'granted' && cur.applied === true) {
      return { granted: cur.granted || [], idempotent: true, markerStatus: 'granted', applied: true }
    }
    return { granted: [], idempotent: true, markerStatus: (cur && cur.status) || 'applying', applied: false, pending: true }
  }

  // 5. applier：应用权益（目标权威 + 回读证明）
  const r = await grantEntitlements(db, order, ts)
  const granted = (r && r.granted) || []
  if (!r || r.success !== true) {
    const reason = (r && r.reason) || 'ENTITLEMENT_NOT_APPLIED'
    await _updateGrant(db, order.orderId, {
      status: 'failed', applied: false, attempts, lastReason: reason, updatedAt: ts,
    })
    await _audit(db, { openid: order.openid, orderId: order.orderId, action: 'grant_failed', status: 'failed', detail: { reason }, ts })
    return { granted: [], idempotent: false, markerStatus: 'failed', applied: false, reason }
  }

  // 6. 仅在目标证明通过后把标记提升为 granted
  await _updateGrant(db, order.orderId, {
    status: 'granted', applied: true, granted, attempts, grantedAt: ts, updatedAt: ts,
  })
  return { granted, idempotent: false, markerStatus: 'granted', applied: true }
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

  // ── 6. G3 权益 exactly-once（target-proven 状态机）──
  const grant = await _ensureGrant(db, order, transactionId, ts, grantEntitlements)
  return {
    ok: true,
    idempotent: false,
    transactionId,
    openid: order.openid,
    granted: grant.granted,
    grantIdempotent: grant.idempotent,
    entitlementApplied: grant.applied,
    entitlementReason: grant.reason || null,
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
  const grant = await _ensureGrant(db, order, transactionId, ts, grantEntitlements)
  return {
    ok: true, idempotent: true, transactionId, openid: order.openid,
    granted: grant.granted, grantIdempotent: grant.idempotent,
    entitlementApplied: grant.applied, entitlementReason: grant.reason || null,
  }
}

module.exports = {
  REASONS,
  FINALIZABLE_STATUSES,
  VALID_TERMINAL,
  TRANSACTION_ID_RE,
  validateProviderEvidence,
  finalizePaidOrder,
  _isDuplicateKey,
  _ensureGrant,
  _readGrant,
}
