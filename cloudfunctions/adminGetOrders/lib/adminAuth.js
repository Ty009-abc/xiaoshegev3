/**
 * lib/adminAuth.js — RC8.9C 服务端权限权威层（RBAC）
 *
 * 最终 authority 只能来自 admin_users 集合。客户端角色/权限一律不被信任 ——
 * 云函数每次调用都重新解析，UI 隐藏仅作展示。
 *
 * 迁移策略（§20，单向、可追溯，无双轨）：
 *   - 正常：仅读取 admin_users。
 *   - 引导（仅当 admin_users 为空，即迁移尚未执行）：允许 legacy
 *     system_configs.admin_users.value.openids 内的 openid 以 SUPER_ADMIN 进入，
 *     以便执行显式迁移。一旦 admin_users 出现任何文档，legacy 引导立即失效，
 *     不再有第二权威源。
 *
 * @version RC8.9C
 */

const ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    'dashboard:view', 'users:view', 'users:detail', 'users:manage', 'analytics:view',
    'payments:view', 'admin:view', 'admin:create', 'admin:update', 'permission:update',
    'content:manage', 'config:manage',
  ],
  OPERATOR: [
    'dashboard:view', 'users:view', 'users:detail', 'users:manage', 'analytics:view',
    'payments:view', 'content:manage',
  ],
  ANALYST: ['dashboard:view', 'analytics:view', 'users:view', 'users:detail'],
  SUPPORT: ['users:view', 'users:detail'],
}

const ROLE_RANK = { SUPER_ADMIN: 4, OPERATOR: 3, ANALYST: 2, SUPPORT: 1 }
const ALL_ROLES = Object.keys(ROLE_PERMISSIONS)
const RAW_OPENID_ROLES = ['SUPER_ADMIN', 'OPERATOR']

function permsForRole(role) { return (ROLE_PERMISSIONS[role] || []).slice() }

/** 仅按 admin_users 读取（最终权威） */
async function getAdmin(db, openid) {
  if (!openid) return null
  try {
    const r = await db.collection('admin_users').where({ openid, status: 'ACTIVE' }).limit(1).get()
    const doc = r.data && r.data[0]
    if (!doc) return null
    const permissions = (Array.isArray(doc.permissions) && doc.permissions.length) ? doc.permissions : permsForRole(doc.role)
    return { openid, role: doc.role, permissions, status: doc.status, doc }
  } catch (_) {
    return null
  }
}

/** 计算 admin_users 文档数；集合缺失按 -1（未知） */
async function adminCount(db) {
  try { const r = await db.collection('admin_users').count(); return r.total }
  catch (_) { return -1 }
}

/**
 * resolveAdmin(db, openid) → admin | null
 * 最终权威 = admin_users；仅当集合为空时启用 legacy 一次性引导。
 */
async function resolveAdmin(db, openid) {
  if (!openid) return null
  const admin = await getAdmin(db, openid)
  if (admin) return admin
  // 引导窗口：admin_users 为空 → 允许 legacy 管理员以 SUPER_ADMIN 执行迁移
  const cnt = await adminCount(db)
  if (cnt === 0) {
    try {
      const r = await db.collection('system_configs').where({ key: 'admin_users', status: 'active' }).limit(1).get()
      const c = r.data && r.data[0]
      const list = (c && c.value && c.value.openids) || []
      if (list.includes(openid)) {
        return { openid, role: 'SUPER_ADMIN', permissions: permsForRole('SUPER_ADMIN'), status: 'ACTIVE', legacy: true }
      }
    } catch (_) { /* ignore */ }
  }
  return null
}

function hasPermission(admin, perm) {
  return !!(admin && Array.isArray(admin.permissions) && admin.permissions.includes(perm))
}
function canSeeRawOpenid(admin) {
  return !!(admin && RAW_OPENID_ROLES.includes(admin.role))
}

async function audit(db, entry) {
  try {
    await db.collection('admin_audit_logs').add({
      data: {
        adminOpenid: entry.adminOpenid,
        action: entry.action,
        targetType: entry.targetType || '',
        targetId: entry.targetId || '',
        before: entry.before || {},
        after: entry.after || {},
        timestamp: Date.now(),
      },
    })
  } catch (_) { /* audit never blocks the operation */ }
}

/** ACTIVE SUPER_ADMIN 数量（排除某 openid），-1 表示未知 */
async function countActiveSuperAdmins(db, excludeOpenid) {
  try {
    const r = await db.collection('admin_users').where({ role: 'SUPER_ADMIN', status: 'ACTIVE' }).get()
    const list = (r.data || []).filter(d => !excludeOpenid || d.openid !== excludeOpenid)
    return list.length
  } catch (_) { return -1 }
}

module.exports = {
  ROLE_PERMISSIONS, ROLE_RANK, ALL_ROLES, RAW_OPENID_ROLES,
  permsForRole, getAdmin, adminCount, resolveAdmin, hasPermission, canSeeRawOpenid,
  audit, countActiveSuperAdmins,
}
