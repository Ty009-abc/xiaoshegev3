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
const { jsapiOrder } = require('./lib/payment.js')
const { generateOrderId } = require('./lib/order.js')
const { checkDuplicateOrder, checkPrice, expirePendingOrders } = require('./lib/antiFraud.js')

exports.main = async (event) => {
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

    // ═══ 7. 调微信支付 JSAPI ═══
    const payResult = await jsapiOrder({
      orderId,
      productName: product.name,
      totalAmount,
      openid,
    })

    // ═══ 8. 写 payment_logs ═══
    await db.collection('payment_logs').add({
      data: {
        openid, orderId,
        action: 'create_order',
        status: payResult.success ? 'success' : 'failed',
        request: { productId, relatedId, totalAmount },
        response: payResult,
        errorMessage: payResult.error || '',
        createdAt: ts,
      },
    })

    if (!payResult.success) {
      await db.collection('orders').doc(addRes._id).update({
        data: { status: 'failed', updatedAt: ts },
      })
      return fail(CODES.PAYMENT_ERROR, payResult.error || '创建支付订单失败')
    }

    // ═══ 9. 更新 orders → pending_payment ═══
    await db.collection('orders').where({ orderId }).update({
      data: {
        status: 'pending_payment',
        paymentParams: payResult.paymentParams,
        updatedAt: ts,
      },
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
