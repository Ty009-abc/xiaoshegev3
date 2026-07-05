/**
 * adminGetOrders - 订单列表
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { ok, fail, CODES } = require('./lib/response.js')

function checkAdmin(db, openid) {
  return db.collection('system_configs').where({ key: 'admin_users', status: 'active' }).limit(1).get()
    .then(r => { const c = r.data[0]; return c && c.value && c.value.openids && c.value.openids.includes(openid) })
    .catch(() => false)
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { page = 1, pageSize = 20, status = '', productId = '', startDate = 0, endDate = 0 } = event
  const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, pageSize))
  console.log(`[adminGetOrders] page=${page} status=${status}`)

  try {
    if (!(await checkAdmin(db, openid))) return fail(CODES.PERMISSION_DENIED)

    const where = {}
    if (status) where.status = status
    if (productId) where.productId = productId
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt = _.gte(startDate)
      if (endDate) where.createdAt = { ...where.createdAt, ..._.lte(endDate) }
    }

    const query = db.collection('orders')
    const [res, totalRes] = await Promise.all([
      Object.keys(where).length ? query.where(where).orderBy('createdAt','desc').skip(skip).limit(Math.min(100, pageSize||20)).get() : query.orderBy('createdAt','desc').skip(skip).limit(Math.min(100, pageSize||20)).get(),
      Object.keys(where).length ? query.where(where).count() : query.count(),
    ])

    const list = (res.data || []).map(o => ({
      orderId: o.orderId,
      openid: o.openid,
      productName: o.productName,
      totalAmount: o.totalAmount,
      status: o.status,
      transactionId: o.transactionId || '',
      paidAt: o.paidAt || 0,
      createdAt: o.createdAt,
    }))

    return ok({ list, total: totalRes.total, page, pageSize })
  } catch (err) {
    console.error('[adminGetOrders] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
