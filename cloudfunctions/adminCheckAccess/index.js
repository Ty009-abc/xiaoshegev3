/**
 * adminCheckAccess - 校验管理员权限入口
 * 查询 system_configs.admin_users 匹配当前 openid
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { ok, fail, CODES } = require('./lib/response.js')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  console.log(`[adminCheckAccess] openid=${openid}`)

  try {
    const res = await db.collection('system_configs').where({ key: 'admin_users', status: 'active' }).limit(1).get()
    const cfg = res.data[0]
    if (!cfg || !cfg.value || !cfg.value.openids) return fail(CODES.PERMISSION_DENIED, '无管理员权限')

    if (!cfg.value.openids.includes(openid)) return fail(CODES.PERMISSION_DENIED, '无管理员权限')

    const ts = Date.now()
    // 写入审计日志
    try { await db.collection('admin_logs').add({ data: { adminOpenid: openid, action: 'admin_login', target: '', before: {}, after: {}, createdAt: ts } }) } catch (_) {}

    return ok({ isAdmin: true, message: '欢迎管理员' })
  } catch (err) {
    console.error('[adminCheckAccess] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
