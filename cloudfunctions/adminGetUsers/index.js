/**
 * adminGetUsers - 用户列表
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

const now = () => Date.now()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { page = 1, pageSize = 20, keyword = '', membershipLevel = '', status = '' } = event
  const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, pageSize))
  console.log(`[adminGetUsers] page=${page}`)

  try {
    if (!(await checkAdmin(db, openid))) return fail(CODES.PERMISSION_DENIED)

    // 构建查询
    const where = {}
    if (membershipLevel) where.membershipLevel = membershipLevel
    if (status) where.status = status

    let query = db.collection('users')
    if (Object.keys(where).length) query = query.where(where)

    // 模糊搜索 nickname（需在 users 表有 nickname 字段）
    if (keyword) {
      query = query.where(_.or([
        { nickname: db.RegExp({ regexp: keyword, options: 'i' }) },
      ]))
    }

    const [res, totalRes] = await Promise.all([
      query.orderBy('createdAt', 'desc').skip(skip).limit(Math.min(100, pageSize || 20)).get(),
      query.count(),
    ])

    const list = (res.data || []).map(u => ({
      openid: u.openid,
      nickname: u.nickname || '',
      avatarUrl: u.avatarUrl || '',
      cv: u.cv || 0,
      level: u.level || 1,
      membershipLevel: u.membershipLevel || 'free',
      membershipExpiredAt: u.membershipExpiredAt || 0,
      status: u.status || 'active',
      createdAt: u.createdAt || 0,
      lastActiveAt: u.lastActiveAt || 0,
    }))

    return ok({ list, total: totalRes.total, page, pageSize })
  } catch (err) {
    console.error('[adminGetUsers] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
