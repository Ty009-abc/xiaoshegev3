/**
 * verifyPayment — 确认支付 & 发放权益（PAYMENT_STAGE3 权威完成路径版）
 *
 * 关键变更（exactly-once）：
 *   - 支付成功后的「订单→paid + 写流水 + 发权益」全部收敛到唯一权威路径
 *     lib/paymentFinalizer.js :: finalizePaidOrder()（与 payCallback 共用同一路径）。
 *   - 不再在函数内重复实现发权益逻辑。
 *   - 只有经过「微信应答验签」的 provider 证据才可进入 finalizePaidOrder。
 *   - 金额 / 商户号 / appId / out_trade_no / 交易号 一律以服务端权威校验，永不采信客户端。
 *   - 客户端声明（paid=true / 金额 / 交易号）永不作为支付权威。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const { now } = require('./lib/permission.js')
const { queryOrder, selfCheckSigning } = require('./lib/payment.js')
const { isMockPaymentResult } = require('./lib/paymentAuthority.js')
const { checkOrderExpired } = require('./lib/antiFraud.js')
const { grantEntitlements } = require('./lib/entitlementService.js')
const { finalizePaidOrder, REASONS } = require('./lib/paymentFinalizer.js')
const { safeWritePaymentLog } = require('./lib/paymentLog.js')

// finalizer 原因 → 对外错误码（fail-closed，绝不返回 paid）
const REASON_TO_CODE = {
  [REASONS.AMOUNT_MISMATCH]: CODES.PAYMENT_ERROR,
  [REASONS.CURRENCY_MISMATCH]: CODES.PAYMENT_ERROR,
  [REASONS.MCHID_MISMATCH]: CODES.PAYMENT_ERROR,
  [REASONS.APPID_MISMATCH]: CODES.PAYMENT_ERROR,
  [REASONS.OUT_TRADE_NO_MISMATCH]: CODES.PAYMENT_ERROR,
  [REASONS.TRANSACTION_ID_MISSING]: CODES.PAYMENT_ERROR,
  [REASONS.TRANSACTION_ID_INVALID]: CODES.PAYMENT_ERROR,
  [REASONS.TRANSACTION_ID_REUSED]: CODES.PAYMENT_ERROR,
  [REASONS.MOCK_NOT_ALLOWED]: CODES.PAYMENT_ERROR,
  [REASONS.ORDER_STATUS_NOT_FINALIZABLE]: CODES.ORDER_CLOSED,
  [REASONS.ORDER_NOT_FOUND]: CODES.NOT_FOUND,
  [REASONS.OWNERSHIP_MISMATCH]: CODES.FORBIDDEN,
}

exports.main = async (event) => {
  // ═══ 部署/运行时签名自查（PAYMENT_STAGE4B）═══
  // 仅显式 __selfcheck=true 时触发，走与下单/查单完全相同的归一化+签名路径；
  // 不创建订单、不触支付、不发权益、不写库，只返回结构事实 + 公钥指纹。
  if (event && event.__selfcheck === true) {
    return ok({ selfCheck: selfCheckSigning(process.env) })
  }

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { orderId } = event
  if (!orderId) return fail(CODES.PARAM_ERROR, '缺少 orderId')

  const ts = now()
  console.log(`[verifyPayment] openid=${openid} orderId=${orderId}`)

  try {
    // ═══ 1. 查订单 ═══
    const orderRes = await db.collection('orders').where({ orderId }).limit(1).get()
    const order = orderRes.data[0]
    if (!order) return fail(CODES.NOT_FOUND, '订单不存在')
    if (order.openid !== openid) return fail(CODES.FORBIDDEN, '这不是你的订单')

    // ═══ 2. 过期检查 ═══
    const expireCheck = checkOrderExpired(order)
    if (expireCheck.expired) {
      await db.collection('orders').where({ orderId }).update({
        data: { status: 'closed', closeReason: expireCheck.message, closedAt: ts, updatedAt: ts },
      })
      return fail(CODES.ORDER_EXPIRED, expireCheck.message)
    }

    // ═══ 3. 已支付 → 直接返回 ═══
    if (order.status === 'paid') {
      return ok({ orderId, status: 'paid', message: '已支付' })
    }

    // ═══ 4. 已关闭/已退款 ═══
    if (order.status === 'closed') return fail(CODES.ORDER_CLOSED, '订单已过期关闭')
    if (order.status === 'refunded') return fail(CODES.ORDER_REFUNDED, '订单已退款')

    // ═══ 5. 调微信查单（应答已验签，fail-closed）═══
    const q = await queryOrder(orderId)

    // ═══ 5.1 mock 权威守卫（fail-closed）═══
    if (isMockPaymentResult(q)) {
      console.warn(`[verifyPayment] 拒绝 mock 支付结果 orderId=${orderId} txn=${q && q.transactionId}`)
      return fail(CODES.PAYMENT_ERROR, '模拟支付结果不可作为真实支付')
    }

    // ═══ 6. 审计日志（非权威，尽力而为；写入失败绝不影响支付权威结果）═══
    await safeWritePaymentLog(db, {
      openid, orderId,
      action: 'verify_payment',
      status: q.tradeState === 'SUCCESS' ? 'success' : 'pending',
      tradeState: q.tradeState || null,
      source: 'query',
      request: { orderId },
      ts,
    })

    if (q.tradeState !== 'SUCCESS') {
      return ok({ orderId, status: 'pending_payment', message: '等待支付中', tradeState: q.tradeState })
    }

    if (!q.success || q.tradeState === 'UNVERIFIED') {
      // 应答未通过验签 → 绝不可作为支付权威
      return fail(CODES.PAYMENT_ERROR, '支付应答未通过验签')
    }

    // ═══ 7. 唯一权威完成路径（exactly-once）═══
    const result = await finalizePaidOrder(db, {
      orderId,
      openid,
      source: 'query',
      provider: {
        tradeState: q.tradeState,
        transactionId: q.transactionId,
        outTradeNo: q.outTradeNo,
        mchid: q.mchid,
        appid: q.appid,
        amountTotal: q.amountTotal,
        amountCurrency: q.amountCurrency,
        amountPayerTotal: q.amountPayerTotal,
        tradeType: q.tradeType,
        bankType: q.bankType,
        successTime: q.successTime,
      },
      expect: { mchid: process.env.WXPAY_MCHID || '', appid: process.env.WXPAY_APPID || '' },
      ts,
    }, { grantEntitlements })

    if (!result.ok) {
      const code = REASON_TO_CODE[result.reason] || CODES.PAYMENT_ERROR
      console.warn(`[verifyPayment] finalize 拒绝 orderId=${orderId} reason=${result.reason}`)
      return fail(code, '支付未通过权威校验: ' + result.reason)
    }

    return ok({
      orderId,
      status: 'paid',
      transactionId: result.transactionId,
      idempotent: !!result.idempotent,
      activation: result.granted || [],
    })
  } catch (err) {
    console.error('[verifyPayment] 异常:', err)
    return fail(CODES.PAYMENT_ERROR, err.message)
  }
}
