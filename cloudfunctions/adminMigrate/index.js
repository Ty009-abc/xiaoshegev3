/**
 * cloudfunctions/adminMigrate/index.js — RC8.9C 显式迁移
 *
 * 将 legacy 管理员（system_configs.admin_users.value.openids）一次性迁移为
 * admin_users 文档（role=SUPER_ADMIN）。迁移后最终权威只来自 admin_users。
 *
 * 幂等：已存在的 openid 不重复创建。
 * 仅允许引导窗口内的管理员调用（admin_users 为空时，legacy openid 可执行）。
 *
 * @version RC8.9C
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { ok, fail, CODES } = require('./lib/response.js')
const adminAuth = require('./lib/adminAuth.js')

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const caller = await adminAuth.resolveAdmin(db, openid)
  if (!caller || !adminAuth.hasPermission(caller, 'admin:create')) {
    return fail(CODES.PERMISSION_DENIED, '无迁移权限')
  }

  let legacyIds = []
  try {
    const r = await db.collection('system_configs').where({ key: 'admin_users', status: 'active' }).limit(1).get()
    const c = r.data && r.data[0]
    legacyIds = (c && c.value && c.value.openids) || []
  } catch (_) {}

  let created = 0
  let skipped = 0
  const ts = Date.now()
  for (const oid of legacyIds) {
    const existing = await adminAuth.getAdmin(db, oid)
    if (existing) { skipped++; continue }
    try {
      await db.collection('admin_users').add({
        data: {
          openid: oid, role: 'SUPER_ADMIN', permissions: adminAuth.permsForRole('SUPER_ADMIN'),
          status: 'ACTIVE', createdAt: ts, updatedAt: ts, createdBy: openid,
        },
      })
      created++
      await adminAuth.audit(db, { adminOpenid: openid, action: 'ADMIN_CREATED', targetType: 'admin', targetId: oid, before: {}, after: { role: 'SUPER_ADMIN', source: 'legacy_migration' } })
    } catch (_) { /* skip individual failure */ }
  }

  // 确保调用者自身也在 admin_users（若调用者是 legacy-only）
  if (!(await adminAuth.getAdmin(db, openid))) {
    try {
      await db.collection('admin_users').add({
        data: { openid, role: 'SUPER_ADMIN', permissions: adminAuth.permsForRole('SUPER_ADMIN'), status: 'ACTIVE', createdAt: ts, updatedAt: ts, createdBy: openid },
      })
      created++
      await adminAuth.audit(db, { adminOpenid: openid, action: 'ADMIN_CREATED', targetType: 'admin', targetId: openid, before: {}, after: { role: 'SUPER_ADMIN', source: 'legacy_migration_self' } })
    } catch (_) {}
  }

  return ok({ migratedFrom: legacyIds.length, created, skipped })
}
