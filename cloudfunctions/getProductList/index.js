/**
 * getProductList — 商品列表（第五册 Part 2 升级版）
 *
 * 升级点：
 *   1. 用户分层展示 — 不同用户看到不同商品
 *   2. 月卡隐藏 — 不在任何用户端展示
 *   3. 季卡 recommended=true 加徽章
 *   4. 价格锚定 — originalPrice 对比
 *   5. 年卡高价值专属权益标注
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const { now } = require('./lib/permission.js')

const TIER_MAP = {
  free: 'free',
  report_buyer: 'report_buyer',
  vip: 'vip',
  heavy_user: 'heavy_user',
}

async function getUserTier(db, openid) {
  const ts = now()
  try {
    // 1. 是否 VIP
    const [memRes, entRes] = await Promise.all([
      db.collection('memberships').where({ openid, status: 'active', expiredAt: db.command.gt(ts) }).limit(1).get(),
      db.collection('entitlements').where({ openid }).limit(1).get(),
    ])

    const isVip = memRes.data.length > 0
    const perms = entRes.data[0]?.permissions || []

    // 2. 是否重度用户（≥3次付费 or ≥50次AI对话）
    if (isVip) {
      const [orderCount, chatCount] = await Promise.all([
        db.collection('orders').where({ openid, status: 'paid' }).count(),
        db.collection('ai_chats').where({ openid }).count(),
      ])
      if (orderCount.total >= 3 || chatCount.total >= 50) return 'heavy_user'
      return 'vip'
    }

    // 3. 是否购买过报告
    const hasReport = perms.includes('report_unlock')
    if (hasReport) return 'report_buyer'

    return 'free'
  } catch (_) {
    return 'free'
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  console.log(`[getProductList] openid=${openid}`)

  try {
    // ═══ 1. 用户分层 ═══
    const tier = await getUserTier(db, openid)
    console.log(`[getProductList] user tier: ${tier}`)

    // ═══ 2. 查所有 active 商品 ═══
    const res = await db.collection('products')
      .where({ status: db.command.in(['active', 'hidden']) })
      .orderBy('sort', 'asc')
      .limit(50)
      .get()

    // ═══ 3. 按用户层级过滤 ═══
    const allProducts = res.data || []
    const visible = allProducts.filter(p => {
      // hidden 商品不展示
      if (p.status === 'hidden') return false
      // 无限流 → 全可见
      if (!p.visibleTo || p.visibleTo.length === 0) return true
      // 按层级匹配
      return p.visibleTo.includes(tier)
    })

    // ═══ 4. 格式化输出 ═══
    const list = visible.map(p => ({
      productId: p.productId,
      name: p.name,
      description: p.description,
      type: p.type,
      price: p.price,
      originalPrice: p.originalPrice || 0,
      discountPercent: p.originalPrice
        ? Math.round((1 - p.price / p.originalPrice) * 100)
        : 0,
      durationDays: p.durationDays || 0,
      permissions: p.permissions || [],
      recommended: p.recommended || false,
      badge: p.badge || '',
      maxPerMonth: p.maxPerMonth || 0,
    }))

    // ═══ 5. 价格锚定数据 ═══
    const yearlyAnchor = allProducts.find(p => p.productId === 'VIP_YEARLY')
    const monthlyAnchor = allProducts.find(p => p.productId === 'VIP_MONTHLY')

    return ok({
      userTier: tier,
      products: list,
      anchor: {
        monthlyPrice: monthlyAnchor ? monthlyAnchor.price : 9900,
        monthlyOriginal: monthlyAnchor ? monthlyAnchor.originalPrice : 0,
        yearlyPrice: yearlyAnchor ? yearlyAnchor.price : 29900,
        yearlyOriginal: yearlyAnchor ? yearlyAnchor.originalPrice : 118800,
        message: '月卡 ¥99 × 12 = ¥1188，年卡仅 ¥299',
      },
    })
  } catch (err) {
    console.error('[getProductList] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
