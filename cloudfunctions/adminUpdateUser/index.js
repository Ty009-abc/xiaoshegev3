/**
 * adminUpdateUser - 管理用户
 * actions: block / unblock / add_cv / set_membership / extend_membership
 * 写入 admin_logs
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { ok, fail, CODES } = require('./lib/response.js')

function checkAdmin(db, openid) {
  return db.collection('system_configs').where({ key: 'admin_users', status: 'active' }).limit(1).get()
    .then(r => { const c = r.data[0]; return c && c.value && c.value.openids && c.value.openids.includes(openid) })
    .catch(() => false)
}
const now = () => Date.now()

const VALID_ACTIONS = ['block', 'unblock', 'add_cv', 'set_membership', 'extend_membership']

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const adminOpenid = wxContext.OPENID
  if (!adminOpenid) return fail(CODES.AUTH_FAILED)

  const { openid: targetOid, action, value = '' } = event
  if (!targetOid || !action) return fail(CODES.PARAM_ERROR, '缺少 openid 或 action')
  if (!VALID_ACTIONS.includes(action)) return fail(CODES.PARAM_ERROR, '无效 action: ' + action)

  const ts = now()
  console.log(`[adminUpdateUser] admin=${adminOpenid} target=${targetOid} action=${action}`)

  try {
    if (!(await checkAdmin(db, adminOpenid))) return fail(CODES.PERMISSION_DENIED)

    const userRes = await db.collection('users').where({ openid: targetOid }).limit(1).get()
    const user = userRes.data[0]
    if (!user) return fail(CODES.NOT_FOUND, '用户不存在')

    const before = { status: user.status, membershipLevel: user.membershipLevel, cv: user.cv, membershipExpiredAt: user.membershipExpiredAt }
    let updateData = { updatedAt: ts }

    switch (action) {
      case 'block':
        updateData.status = 'blocked'
        break
      case 'unblock':
        updateData.status = 'active'
        break
      case 'add_cv':
        updateData.cv = (user.cv || 0) + (parseInt(value, 10) || 0)
        break
      case 'set_membership':
        updateData.membershipLevel = value || 'vip_month'
        // 同时创建/更新 memberships
        const dur = value === 'vip_year' ? 365 : 30
        updateData.membershipExpiredAt = ts + dur * 86400000
        await db.collection('memberships').add({
          data: {
            openid: targetOid, status: 'active', memberType: updateData.membershipLevel,
            permissions: ['ai_unlimited','report_unlock','challenge_unlock','world_rules_unlock','history_insights_unlock'],
            startedAt: ts, expiredAt: updateData.membershipExpiredAt, createdAt: ts, updatedAt: ts,
          },
        })
        break
      case 'extend_membership':
        const oldExp = user.membershipExpiredAt || ts
        updateData.membershipExpiredAt = oldExp + (parseInt(value, 10) || 30) * 86400000
        break
    }

    await db.collection('users').where({ openid: targetOid }).update({ data: updateData })

    // 写入 admin_logs
    await db.collection('admin_logs').add({
      data: {
        adminOpenid,
        action,
        target: targetOid,
        before,
        after: { ...before, ...updateData },
        createdAt: ts,
      },
    })

    return ok({ message: '操作成功', action, target: targetOid })
  } catch (err) {
    console.error('[adminUpdateUser] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
