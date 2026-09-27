/**
 * adminCheckAccess - 校验管理员权限入口
 *
 * RC8.9C：最终权威来自 admin_users（RBAC）。
 *   - 返回当前管理员的 role / permissions，供前端按权限展示（仅展示，不构成安全控制）。
 *   - 引导窗口（admin_users 为空）允许 legacy system_configs 管理员以 SUPER_ADMIN 进入，
 *     以便执行显式迁移；迁移完成后 legacy 引导自动失效。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { ok, fail, CODES } = require('./lib/response.js')
const adminAuth = require('./lib/adminAuth.js')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  console.log(`[adminCheckAccess] openid=${openid}`)

  try {
    const admin = await adminAuth.resolveAdmin(db, openid)
    if (!admin) return fail(CODES.PERMISSION_DENIED, '无管理员权限')

    const ts = Date.now()
    // 审计登录 + 记录最后登录（best-effort）
    try {
      await db.collection('admin_audit_logs').add({ data: { adminOpenid: openid, action: 'admin_login', targetType: '', targetId: '', before: {}, after: {}, timestamp: ts } })
    } catch (_) {}
    try {
      await db.collection('admin_users').where({ openid }).update({ data: { lastLoginAt: ts } })
    } catch (_) {}

    return ok({
      isAdmin: true,
      role: admin.role,
      permissions: admin.permissions,
      legacy: !!admin.legacy,
      message: '欢迎管理员',
    })
  } catch (err) {
    console.error('[adminCheckAccess] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
