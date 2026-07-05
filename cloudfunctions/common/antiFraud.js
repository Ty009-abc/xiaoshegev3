/**
 * cloudfunctions/common/antiFraud.js — 支付防刷模块
 *
 * 第五册 Part 1：Payment Architecture
 *
 * 防刷策略：
 *   1. 重复订单检测 — 同一用户同一商品短时间内不可重复下单
 *   2. 价格校验 — 前端传价 vs 数据库价格
 *   3. 订单过期 — 30分钟未支付自动关闭
 *   4. 频率限制 — 同一用户每分钟最多 3 次下单
 */

const now = () => Date.now()

const ORDER_EXPIRE_MS = 30 * 60 * 1000   // 30分钟
const RATE_LIMIT_WINDOW_MS = 60 * 1000    // 1分钟
const RATE_LIMIT_MAX = 3                  // 最多3次

/**
 * checkDuplicateOrder(db, openid, productId)
 * 重复订单检测 — 同一用户在 ORDER_EXPIRE_MS 内不可重复购买同一商品
 */
async function checkDuplicateOrder(db, openid, productId) {
  try {
    const since = now() - ORDER_EXPIRE_MS
    const dup = await db.collection('orders')
      .where({
        openid,
        productId,
        status: db.command.in(['pending_payment', 'paid', 'pending']),
        createdAt: db.command.gte(since),
      })
      .limit(1)
      .get()

    if (dup.data.length > 0) {
      const existing = dup.data[0]
      return {
        isDuplicate: true,
        message: existing.status === 'paid'
          ? '你已购买过此商品'
          : '你有一个待支付订单，请先完成支付',  // 小事哥品牌话术
        existingOrderId: existing.orderId,
        existingStatus: existing.status,
      }
    }
    return { isDuplicate: false }
  } catch (e) {
    console.error('[antiFraud] 重复检测异常:', e.message)
    return { isDuplicate: false } // 降级放行
  }
}

/**
 * checkPrice(db, productId, clientPrice)
 * 价格校验 — 前端传价必须与数据库一致
 */
async function checkPrice(db, productId, clientPrice) {
  if (clientPrice === undefined || clientPrice === null) return { valid: true }

  try {
    const prodRes = await db.collection('products').where({ productId, status: 'active' }).limit(1).get()
    if (!prodRes.data[0]) {
      return { valid: false, reason: '商品不存在', dbPrice: 0, clientPrice }
    }
    const dbPrice = prodRes.data[0].price
    if (clientPrice !== dbPrice) {
      return {
        valid: false,
        reason: `价格校验失败：客户端传来 ${clientPrice} 分，数据库 ${dbPrice} 分`,
        dbPrice,
        clientPrice,
      }
    }
    return { valid: true, dbPrice }
  } catch (e) {
    console.error('[antiFraud] 价格校验异常:', e.message)
    return { valid: false, reason: '价格校验失败' }
  }
}

/**
 * checkRateLimit(rateBuckets, openid)
 * 频率限制 — 内存级简易限流（云函数冷启动会重置，可升级为 Redis）
 */
function checkRateLimit(rateBuckets, openid) {
  const ts = now()
  const bucket = rateBuckets[openid]

  if (!bucket) {
    rateBuckets[openid] = { count: 1, windowStart: ts }
    return { allowed: true }
  }

  if (ts - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateBuckets[openid] = { count: 1, windowStart: ts }
    return { allowed: true }
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    return { allowed: false, message: `下单太频繁，请${Math.ceil((RATE_LIMIT_WINDOW_MS - (ts - bucket.windowStart)) / 1000)}秒后再试` }
  }

  bucket.count++
  return { allowed: true }
}

/**
 * expirePendingOrders(db, openid)
 * 过期未支付订单自动关闭
 */
async function expirePendingOrders(db, openid) {
  try {
    const expireSince = now() - ORDER_EXPIRE_MS
    const res = await db.collection('orders')
      .where({
        openid,
        status: db.command.in(['pending_payment', 'created', 'pending']),
        createdAt: db.command.lte(expireSince),
      })
      .get()

    for (const order of res.data) {
      await db.collection('orders').doc(order._id).update({
        data: { status: 'closed', closeReason: '30分钟未支付，自动关闭', updatedAt: now() },
      })
    }

    if (res.data.length > 0) {
      console.log(`[antiFraud] 关闭 ${res.data.length} 个过期订单`)
    }

    return { closed: res.data.length }
  } catch (e) {
    console.error('[antiFraud] 过期清理异常:', e.message)
    return { closed: 0 }
  }
}

/**
 * checkOrderExpired(order)
 * 检查单个订单是否过期
 */
function checkOrderExpired(order) {
  if (!order || !order.createdAt) return { expired: false }
  const age = now() - order.createdAt
  if (age > ORDER_EXPIRE_MS && ['pending_payment', 'created', 'pending'].includes(order.status)) {
    return { expired: true, age, message: '订单已过期，请重新下单' }
  }
  return { expired: false }
}

module.exports = {
  checkDuplicateOrder,
  checkPrice,
  checkRateLimit,
  expirePendingOrders,
  checkOrderExpired,
  ORDER_EXPIRE_MS,
}
