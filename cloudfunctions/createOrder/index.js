/**
 * createOrder - 创建支付订单（第五册 Part 1 升级版）
 *
 * 升级点：
 *   1. + antiFraud (重复检测 / 价格校验 / 30分钟过期)
 *   2. + 过期订单自动清理
 *   3. + products 支持 4 种 type
 *   4. + 订单状态标准化 pending/pending_payment/paid/failed/refunded/closed
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const { now } = require('./lib/permission.js')
const { jsapiOrder, selfCheckSigning } = require('./lib/payment.js')
const { generateOrderId } = require('./lib/order.js')
const { checkDuplicateOrder, checkPrice, expirePendingOrders } = require('./lib/antiFraud.js')
const { checkAlreadyEntitled } = require('./lib/entitlementGuard.js')
const { safeWritePaymentLog } = require('./lib/paymentLog.js')
// RC8_11_STAGE1 — 退休商品新售拒绝（退休 ≠ 删除：历史订单/权益/回调仍完整识别）
const { isRetiredNewSale } = require('./lib/accessAuthority.js')

exports.main = async (event) => {
  // ═══ 部署/运行时签名自查（PAYMENT_STAGE4B）═══
  // 仅显式 __selfcheck=true 时触发，走与下单完全相同的归一化+签名路径；
  // 不创建订单、不触支付、不发权益、不写库，只返回结构事实 + 公钥指纹。
  if (event && event.__selfcheck === true) {
    return ok({ selfCheck: selfCheckSigning(process.env) })
  }

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { productId, relatedId = '', clientPrice = null } = event
  if (!productId) return fail(CODES.PARAM_ERROR, '缺少 productId')

  const ts = now()
  console.log(`[createOrder] openid=${openid} productId=${productId} relatedId=${relatedId}`)

  try {
    // ═══ 1. 过期订单清理 ═══
    await expirePendingOrders(db, openid)

    // ═══ 2. 重复订单检测 (Anti-Fraud) ═══
    const dupCheck = await checkDuplicateOrder(db, openid, productId)
    if (dupCheck.isDuplicate) {
      return fail(CODES.DUPLICATE, dupCheck.message, {
        existingOrderId: dupCheck.existingOrderId,
        existingStatus: dupCheck.existingStatus,
      })
    }

    // ═══ 2.1 已拥有权益前置校验（一次性解锁类防重复扣款）═══
    //     权威来源：服务端实体状态（challenge trialMode/unlocked、report isPaid）
    const already = await checkAlreadyEntitled(db, openid, productId, relatedId)
    if (already.entitled) {
      return fail(CODES.DUPLICATE, already.message || '已拥有该权益，无需重复购买', {
        entitled: true,
        source: already.source || null,
      })
    }

    // ═══ 3. 价格校验 (Anti-Fraud) ═══
    if (clientPrice !== null) {
      const priceCheck = await checkPrice(db, productId, clientPrice)
      if (!priceCheck.valid) {
        return fail(CODES.PRICE_ERROR, priceCheck.reason)
      }
    }

    // ═══ 4. 查商品 ═══
    const prodRes = await db.collection('products')
      .where({
        productId,
        status: db.command.in(['active', 'draft']), // draft 可测试下单
      })
      .limit(1).get()
    const product = prodRes.data[0]
    if (!product) return fail(CODES.NOT_FOUND, '商品不存在或已下架')
    // RC8_11：退休商品（report_9_9 / challenge_39_9 / vip_month_99）拒绝【新】购买。
    //   权威 = 服务端商品文档 notNewSale 标记（+ canonical list 兜底）；
    //   绝不影响历史订单支付回调/校验/幂等（那些走 payCallback/verifyPayment）。
    if (product.notNewSale === true || isRetiredNewSale(productId)) {
      return fail(CODES.PRODUCT_INACTIVE, '该商品已停售，请选择会员方案', { retiredProduct: true })
    }
    if (product.status === 'draft') {
      console.warn(`[createOrder] ⚠️ 草稿商品下单: ${productId}`)
    }

    // ═══ 5. 价格以数据库为准 ═══
    const totalAmount = product.price
    if (!totalAmount || totalAmount <= 0) return fail(CODES.CONFIG_ERROR, '商品价格异常')

    // ═══ 6. 创建订单 ═══
    const orderId = generateOrderId()
    const orderData = {
      orderId,
      openid,
      productId,
      productName: product.name,
      totalAmount,
      originalAmount: product.originalPrice || totalAmount,
      type: product.type || 'one_time',
      relatedId,
      relatedType: _mapRelatedType(product.type),
      status: 'created',
      transactionId: '',
      paidAt: 0,
      refundedAt: 0,
      refundReason: '',
      closedAt: 0,
      closeReason: '',
      createdAt: ts,
      updatedAt: ts,
    }

    const addRes = await db.collection('orders').add({ data: orderData })

    // ═══ 7. 调微信支付 JSAPI（已认证的预支付应答）═══
    const payResult = await jsapiOrder({
      orderId,
      productName: product.name,
      totalAmount,
      openid,
    })

    // ═══ 8. 支付失败：先落失败态（业务关键），审计日志尽力而为（非致命）═══
    if (!payResult.success) {
      await db.collection('orders').doc(addRes._id).update({
        data: { status: 'failed', updatedAt: ts },
      })
      await safeWritePaymentLog(db, {
        action: 'create_order', orderId, productId, openid,
        stage: 'prepay', status: 'failed', source: 'jsapi',
        errorCode: payResult.error || null,
        request: { productId, relatedId, totalAmount },
        ts,
      })
      return fail(CODES.PAYMENT_ERROR, payResult.error || '创建支付订单失败')
    }

    // ═══ 9. 支付成功：先持久化订单 → pending_payment（业务关键，绝不因日志失败而中断）═══
    await db.collection('orders').where({ orderId }).update({
      data: {
        status: 'pending_payment',
        paymentParams: payResult.paymentParams,
        updatedAt: ts,
      },
    })

    // ═══ 9.1 审计日志（尽力而为，非权威；失败不影响业务结果）═══
    await safeWritePaymentLog(db, {
      action: 'create_order', orderId, productId, openid,
      stage: 'prepay', status: 'success', source: 'jsapi',
      request: { productId, relatedId, totalAmount },
      ts,
    })

    // ═══ 10. 返回 ═══
    return ok({
      orderId,
      totalAmount,
      productName: product.name,
      paymentParams: payResult.paymentParams,
      expireMinutes: 30,
    })
  } catch (err) {
    console.error('[createOrder] 异常:', err)
    return fail(CODES.PAYMENT_ERROR, err.message)
  }
}

function _mapRelatedType(type) {
  const map = { one_time: 'report', single: 'report', subscription: 'membership', membership: 'membership', consumable: 'consult', bundle: 'membership' }
  return map[type] || 'report'
}
