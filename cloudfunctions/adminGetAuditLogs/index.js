/**
 * cloudfunctions/adminGetAuditLogs/index.js — RC8.9C 审计日志
 * 需要权限 admin:view。返回最近管理操作，权限修改可追溯。
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

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const caller = await adminAuth.resolveAdmin(db, openid)
  if (!caller) return fail(CODES.PERMISSION_DENIED, '非管理员')
  if (!adminAuth.hasPermission(caller, 'admin:view')) return fail(CODES.PERMISSION_DENIED, '无查看审计权限')

  const page = Math.max(1, parseInt((event && event.page) || 1, 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt((event && event.pageSize) || 30, 10) || 30))
  const canRaw = adminAuth.canSeeRawOpenid(caller)

  try {
    const r = await db.collection('admin_audit_logs')
      .orderBy('timestamp', 'desc')
      .skip((page - 1) * pageSize).limit(pageSize).get()
    const list = (r.data || []).map(d => ({
      adminOpenid: canRaw ? d.adminOpenid : maskOpenid(d.adminOpenid),
      action: d.action,
      targetType: d.targetType || '',
      targetId: canRaw ? d.targetId : maskOpenid(d.targetId),
      before: d.before || {},
      after: d.after || {},
      timestamp: d.timestamp || 0,
    }))
    return ok({ list, page, pageSize })
  } catch (err) {
    console.warn('[adminGetAuditLogs] unavailable:', err && err.message)
    return ok({ list: [], page, pageSize })
  }
}
