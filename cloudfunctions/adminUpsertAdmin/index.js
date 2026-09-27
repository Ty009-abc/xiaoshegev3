/**
 * cloudfunctions/adminUpsertAdmin/index.js — RC8.9C 管理员增改
 *
 * 支持：
 *   action: 'create'  → 新增管理员（需 admin:create）
 *   action: 'update'  → 修改角色（需 admin:update + permission:update）
 *   action: 'disable' → 禁用管理员（需 admin:update）
 *   action: 'enable'  → 启用管理员（需 admin:update）
 *
 * 安全护栏（§11）：
 *   - 不能禁用/降级最后一个 ACTIVE SUPER_ADMIN（hard block）。
 *   - 自身 SUPER_ADMIN 降级：若自己是最后一个 → BLOCK。
 *
 * 所有写操作写 admin_audit_logs（before/after/operator/timestamp）。
 * 最终 authority 来自 admin_users；客户端角色不被信任。
 *
 * @version RC8.9C
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { ok, fail, CODES } = require('./lib/response.js')
const adminAuth = require('./lib/adminAuth.js')

const VALID_ACTIONS = ['create', 'update', 'disable', 'enable']

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const operator = wxContext.OPENID
  if (!operator) return fail(CODES.AUTH_FAILED)

  const { action, openid: targetOpenid, role } = event || {}
  if (!action || !VALID_ACTIONS.includes(action)) return fail(CODES.PARAM_ERROR, '无效 action')

  const caller = await adminAuth.resolveAdmin(db, operator)
  if (!caller) return fail(CODES.PERMISSION_DENIED, '非管理员')

  // ── 权限门（服务端权威）──
  if (action === 'create') {
    if (!adminAuth.hasPermission(caller, 'admin:create')) return fail(CODES.PERMISSION_DENIED, '无新增管理员权限')
  } else {
    if (!adminAuth.hasPermission(caller, 'admin:update')) return fail(CODES.PERMISSION_DENIED, '无修改管理员权限')
  }
  if (role && !adminAuth.ALL_ROLES.includes(role)) return fail(CODES.PARAM_ERROR, '无效角色')

  const ts = Date.now()

  // ── create ──
  if (action === 'create') {
    if (!targetOpenid || !role) return fail(CODES.PARAM_ERROR, '缺少 openid 或 role')
    const existing = await adminAuth.getAdmin(db, targetOpenid)
    if (existing) return fail(CODES.PARAM_ERROR, '该管理员已存在')
    try {
      await db.collection('admin_users').add({
        data: { openid: targetOpenid, role, permissions: adminAuth.permsForRole(role), status: 'ACTIVE', createdAt: ts, updatedAt: ts, createdBy: operator },
      })
    } catch (err) { return fail(CODES.DB_ERROR, err.message) }
    await adminAuth.audit(db, { adminOpenid: operator, action: 'ADMIN_CREATED', targetType: 'admin', targetId: targetOpenid, before: {}, after: { role, status: 'ACTIVE' } })
    return ok({ action, target: targetOpenid, role })
  }

  // ── update / disable / enable 需要目标存在 ──
  if (!targetOpenid) return fail(CODES.PARAM_ERROR, '缺少 openid')
  const target = await adminAuth.getAdmin(db, targetOpenid)
  if (!target) return fail(CODES.NOT_FOUND, '管理员不存在')

  const before = { role: target.role, status: target.status }

  // ── LAST SUPER ADMIN GUARD ──
  const isSuperTarget = target.role === 'SUPER_ADMIN' && target.status === 'ACTIVE'
  const wouldRemoveSuper =
    isSuperTarget && (
      action === 'disable' ||
      (action === 'update' && role && role !== 'SUPER_ADMIN')
    )
  if (wouldRemoveSuper) {
    const remaining = await adminAuth.countActiveSuperAdmins(db, targetOpenid)
    // remaining === -1（未知）按不安全处理
    if (remaining <= 0) return fail(CODES.PERMISSION_DENIED, '不能移除最后一个超级管理员')
  }

  let updateData = { updatedAt: ts }
  if (action === 'update') {
    if (!role) return fail(CODES.PARAM_ERROR, '缺少 role')
    updateData.role = role
    updateData.permissions = adminAuth.permsForRole(role)
  } else if (action === 'disable') {
    updateData.status = 'DISABLED'
  } else if (action === 'enable') {
    updateData.status = 'ACTIVE'
  }

  try {
    await db.collection('admin_users').where({ openid: targetOpenid }).update({ data: updateData })
  } catch (err) { return fail(CODES.DB_ERROR, err.message) }

  const after = { role: updateData.role || before.role, status: updateData.status || before.status }
  const auditAction = action === 'update' ? 'ADMIN_ROLE_CHANGED' : (action === 'disable' ? 'ADMIN_DISABLED' : 'ADMIN_ENABLED')
  await adminAuth.audit(db, { adminOpenid: operator, action: auditAction, targetType: 'admin', targetId: targetOpenid, before, after })

  return ok({ action, target: targetOpenid, before, after })
}
