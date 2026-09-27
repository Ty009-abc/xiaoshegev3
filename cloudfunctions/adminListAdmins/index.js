/**
 * cloudfunctions/adminListAdmins/index.js — RC8.9C 管理员列表
 * 需要权限 admin:view。
 * @version RC8.9C
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { ok, fail, CODES } = require('./lib/response.js')
const adminAuth = require('./lib/adminAuth.js')

function maskOpenid(oid) {
  if (!oid || oid.length <= 8) return oid || ''
  return oid.slice(0, 4) + '***' + oid.slice(-4)
}

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const caller = await adminAuth.resolveAdmin(db, openid)
  if (!caller) return fail(CODES.PERMISSION_DENIED, '非管理员')
  if (!adminAuth.hasPermission(caller, 'admin:view')) return fail(CODES.PERMISSION_DENIED, '无查看管理员权限')

  let list = []
  try {
    const r = await db.collection('admin_users').orderBy('createdAt', 'desc').limit(100).get()
    list = (r.data || []).map(d => ({
      openid: adminAuth.canSeeRawOpenid(caller) ? d.openid : undefined,
      maskedOpenid: maskOpenid(d.openid),
      role: d.role,
      status: d.status,
      permissions: d.permissions || adminAuth.permsForRole(d.role),
      createdAt: d.createdAt || 0,
      updatedAt: d.updatedAt || 0,
      lastLoginAt: d.lastLoginAt || 0,
    }))
  } catch (_) { list = [] }

  return ok({ list, roles: adminAuth.ALL_ROLES, callerRole: caller.role })
}
