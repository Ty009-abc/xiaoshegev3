'use strict'
/**
 * callbackAuthority.js — RC8_14_P0_PROD_CALLBACK_FAIL_CLOSED_PATCH
 *
 * Fail-closed caller authority for the `xpay_goods_deliver_notify` delivery push.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * A delivery push carries NO cryptographic authentication that a same-environment
 * client cannot forge. An authenticated mini-program user can call
 *   wx.cloud.callFunction('virtualPayCallback', { Event:'xpay_goods_deliver_notify', ... })
 * The CloudBase function has no HTTP route and no message-push trigger (verified:
 * the ONLY prod HTTP route is /payCallback → payCallback), so the sole inbound
 * path is a client callFunction. The push MUST NOT be treated as payment
 * authority.
 *
 * ── POLICY (this patch) ─────────────────────────────────────────────────────
 *   TRUSTED PUSH SOURCES = ∅  (EMPTY).
 * No legitimate delivery-push channel is registered for this function, so there
 * is NOTHING to allow. Every external event — including a complete-looking
 * payload, an attacker-supplied "trusted" flag, or the user's own order — is
 * DENIED before any order lookup, any finalize, any write.
 *
 *   • default DENY for all external events
 *   • no client-supplied trusted flag (event trust fields are ignored)
 *   • no client-supplied provider evidence can override DENY (evidence is only
 *     honoured AFTER a trusted channel is bound, which never happens here)
 *   • no synthetic transactionId fallback (`'XPAY'+outTradeNo`) is ever built
 *   • no order paid transition / entitlement grant / payments insert
 *
 * Enabling a genuine trusted push requires a SEPARATELY REVIEWED change that
 * binds a platform-verifiable origin (populate TRUSTED_PUSH_SOURCES with a real
 * platform marker). This allow-list must NEVER be populated from env vars or any
 * caller/client input. The query-based confirmation path (verifyVirtualPayment)
 * is independent and unaffected.
 *
 * This module requires no secrets and returns only boolean/existence facts.
 */

const NOTIFY_EVENT = 'xpay_goods_deliver_notify'

const REASONS = {
  NOT_NOTIFY_EVENT: 'NOT_NOTIFY_EVENT',
  CLIENT_ASSERTED_PAID: 'CLIENT_ASSERTED_PAID',
  TRANSACTION_ID_MISSING: 'TRANSACTION_ID_MISSING',
  TRANSACTION_ID_FALLBACK: 'TRANSACTION_ID_FALLBACK',
  TRANSACTION_ID_INVALID: 'TRANSACTION_ID_INVALID',
  TRANSACTION_ID_SYNTHETIC: 'TRANSACTION_ID_SYNTHETIC',
  CALLBACK_DISABLED: 'CALLBACK_DISABLED',
}

// Real provider id shape (WeChat pay order ids are long numeric/alnum strings).
const PROVIDER_TXN_RE = /^[A-Za-z0-9_-]{16,64}$/

// ── Trust gate ──────────────────────────────────────────────────────────────
// EMPTY by design. Populating this list is a reviewed change, never a runtime or
// client-controllable value.
const TRUSTED_PUSH_SOURCES = Object.freeze([])

function _str (v) { return v == null ? '' : String(v).trim() }

/**
 * Extract a transaction id from REAL provider fields only. No synthetic fallback.
 * @param {object} payInfo  event.WeChatPayInfo
 * @returns {string}  '' when no real id is present
 */
function extractProviderTxnId (payInfo) {
  const p = payInfo || {}
  if (p.TransactionId != null) return _str(p.TransactionId)
  if (p.WxOrderId != null) return _str(p.WxOrderId)
  return ''
}

/**
 * Is this invocation bound to a trusted (non-client) delivery channel?
 *
 * Always false in this patch: the allow-list is empty and a same-environment
 * client call can never present a platform-verifiable origin. Only a real
 * platform marker (never client-supplied, never env-supplied) present in
 * TRUSTED_PUSH_SOURCES could ever return true.
 *
 * @param {object} opts { wxContext }
 * @returns {boolean}
 */
function isTrustedPushSource (opts) {
  const wx = (opts && opts.wxContext) || {}
  const marker = wx.__trustedPushOrigin          // platform runtime marker (reserved)
  if (!marker) return false
  return TRUSTED_PUSH_SOURCES.includes(marker)   // empty ⇒ always false
}

/**
 * Decide whether a callback event may be treated as payment authority.
 *
 * PURE (no DB, no I/O). Ordering: benign classification → client-asserted-paid
 * denial → provider-evidence shape checks → trust gate (which always denies).
 *
 * @param {object} input { event, wxContext, env }
 * @returns {{allow, reason, transactionId, evidenceComplete, provider, benign}}
 */
function evaluateCallbackAuthority (input) {
  input = input || {}
  const event = input.event || {}

  const _deny = (reason, extra) => Object.assign({
    allow: false, reason, transactionId: '', evidenceComplete: false, provider: null, benign: false,
  }, extra || {})

  const evt = _str(event.Event || event.event)
  if (evt !== NOTIFY_EVENT) return _deny(REASONS.NOT_NOTIFY_EVENT, { benign: true })

  // Arbitrary client-asserted paid status — never authoritative.
  if (event.ClientPaid === true || event.Paid === true ||
      _str(event.status) === 'paid' || _str(event.Status) === 'paid') {
    return _deny(REASONS.CLIENT_ASSERTED_PAID)
  }

  // Real provider transaction evidence only (no synthetic fallback).
  const txn = extractProviderTxnId(event.WeChatPayInfo || {})
  if (!txn) return _deny(REASONS.TRANSACTION_ID_MISSING)
  if (/^XPAY/i.test(txn)) return _deny(REASONS.TRANSACTION_ID_FALLBACK)
  if (!PROVIDER_TXN_RE.test(txn)) return _deny(REASONS.TRANSACTION_ID_INVALID)
  if (/^(.)\1+$/.test(txn)) return _deny(REASONS.TRANSACTION_ID_SYNTHETIC)

  const evidenceComplete = true

  // Trust gate — the single authority. Empty allow-list ⇒ always deny.
  if (!isTrustedPushSource({ wxContext: input.wxContext })) {
    return _deny(REASONS.CALLBACK_DISABLED, { transactionId: txn, evidenceComplete })
  }

  return {
    allow: true,
    reason: null,
    transactionId: txn,
    evidenceComplete,
    provider: buildProvider(event, txn),
    benign: false,
  }
}

/**
 * Build provider evidence from a push (only reachable behind the trust gate).
 * Retained for a future reviewed trusted-channel change.
 */
function buildProvider (event, txn) {
  const goods = (event && event.GoodsInfo) || {}
  const payInfo = (event && event.WeChatPayInfo) || {}
  const actual = goods.ActualPrice != null ? Number(goods.ActualPrice) : null
  return {
    tradeState: 'SUCCESS',
    transactionId: txn,
    outTradeNo: _str(event.OutTradeNo || event.outTradeNo),
    mchid: '',
    appid: (typeof process !== 'undefined' && (process.env.WX_APPID || process.env.WXPAY_APPID)) || '',
    amountTotal: actual,
    amountCurrency: 'CNY',
    amountPayerTotal: actual,
    tradeType: 'VIRTUAL',
    bankType: '',
    successTime: payInfo.PaidTime != null ? String(payInfo.PaidTime) : '',
  }
}

/**
 * Contained callback application: authority gate FIRST (pure, no DB). With the
 * allow-list empty, every delivery push is denied here and ZERO DB access occurs.
 * The order-level guards below are unreachable defence-in-depth retained for a
 * future trusted-channel change.
 *
 * @param {object} db
 * @param {object} event
 * @param {object} deps { finalizePaidOrder, grantEntitlements }
 * @param {object} opts { wxContext, env, ts }
 * @returns {Promise<{ack:0|1, applied:boolean, reason?:string, result?:object}>}
 */
async function applyContainedCallback (db, event, deps, opts) {
  opts = opts || {}
  const d = evaluateCallbackAuthority({ event, wxContext: opts.wxContext, env: opts.env })
  if (!d.allow) {
    // benign non-delivery events ack 0 (no retry); anything else acks 1.
    return { ack: d.benign ? 0 : 1, applied: false, reason: d.reason }
  }

  // ── unreachable while TRUSTED_PUSH_SOURCES is empty ──
  const outTradeNo = _str(event.OutTradeNo || event.outTradeNo)
  const openid = _str(event.OpenId || event.openid)
  const envIn = event.Env != null ? Number(event.Env) : null
  const goods = event.GoodsInfo || {}

  const orderRes = await db.collection('orders').where({ orderId: outTradeNo }).limit(1).get()
  const order = orderRes.data && orderRes.data[0]
  if (!order) return { ack: 1, applied: false, reason: REASONS.ORDER_NOT_FOUND }
  if (openid && order.openid && openid !== order.openid) return { ack: 1, applied: false, reason: REASONS.OWNERSHIP_MISMATCH }
  if (envIn != null && order.env != null && envIn !== order.env) return { ack: 1, applied: false, reason: REASONS.ENV_MISMATCH }

  const mapped = require('./virtualPayCatalog.js').findByVirtualProductId(
    goods.ProductId != null ? goods.ProductId : order.virtualProductId
  )
  if (!mapped || !order.productId || mapped.localProductId !== order.productId) {
    return { ack: 1, applied: false, reason: REASONS.PRODUCT_MISMATCH }
  }
  if (goods.Quantity != null && Number(goods.Quantity) !== 1) {
    return { ack: 1, applied: false, reason: REASONS.QUANTITY_INVALID }
  }
  const actual = goods.ActualPrice != null ? Number(goods.ActualPrice) : null
  if (actual != null && actual !== Number(order.totalAmount)) {
    return { ack: 1, applied: false, reason: REASONS.AMOUNT_MISMATCH }
  }

  const provider = Object.assign({}, d.provider, {
    amountTotal: actual != null ? actual : Number(order.totalAmount),
    amountPayerTotal: actual != null ? actual : Number(order.totalAmount),
  })

  const result = await deps.finalizePaidOrder(db, {
    orderId: outTradeNo,
    source: 'callback',
    provider,
    expect: { mchid: '', appid: '' },
    ts: opts.ts || Date.now(),
  }, { grantEntitlements: deps.grantEntitlements })

  return { ack: result.ok ? 0 : 1, applied: !!result.ok, result }
}

module.exports = {
  NOTIFY_EVENT,
  REASONS,
  PROVIDER_TXN_RE,
  TRUSTED_PUSH_SOURCES,
  extractProviderTxnId,
  isTrustedPushSource,
  evaluateCallbackAuthority,
  buildProvider,
  applyContainedCallback,
}
