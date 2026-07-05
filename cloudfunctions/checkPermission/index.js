/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * checkPermission 云函数
 *
 * 职责：
 *   1. 检查用户是否拥有某项权限
 *   2. lifetime 用户直接通过
 *   3. membership 有效且包含该权限 → 通过
 *   4. free 用户 → 返回 need_payment
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')

const now = () => Date.now()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) return fail(CODES.AUTH_FAILED)

  const { permission } = event
  if (!permission || typeof permission !== 'string') {
    return fail(CODES.PARAM_ERROR, '缺少 permission 参数')
  }

  const ts = now()
  console.log(`[checkPermission] openid=${openid} permission=${permission}`)

  try {
    const usersCol = db.collection('users')
    const membershipsCol = db.collection('memberships')

    // 读取用户
    const userRes = await usersCol.where({ openid }).limit(1).get()
    const user = userRes.data[0]

    if (!user) {
      return fail(CODES.AUTH_FAILED, '用户不存在')
    }

    if (user.status !== 'active') {
      return fail(CODES.AUTH_FAILED, '用户已被禁用')
    }

    // ── lifetime 直接通过 ──
    if (user.membershipLevel === 'lifetime') {
      console.log(`[checkPermission] lifetime 用户，直接通过`)
      return ok({
        granted: true,
        permission,
        level: 'lifetime',
        reason: '永久会员',
      })
    }

    // ── 查询有效会员 ──
    let membership = null
    const memberRes = await membershipsCol
      .where({ openid, status: 'active' })
      .orderBy('expiredAt', 'desc')
      .limit(1)
      .get()

    if (memberRes.data[0]) {
      membership = memberRes.data[0]

      // 检查过期
      if (membership.expiredAt && membership.expiredAt < ts) {
        console.log(`[checkPermission] 会员已过期，标记 expired`)
        await membershipsCol.doc(membership._id).update({
          data: { status: 'expired', updatedAt: ts },
        })
        await usersCol.where({ openid }).update({
          data: { membershipLevel: 'free', membershipExpiredAt: null, updatedAt: ts },
        })
        membership = null
      }
    }

    // ── 会员有效 → 检查权限 ──
    if (membership && membership.permissions && membership.permissions.includes(permission)) {
      console.log(`[checkPermission] 会员有效，权限已授予`)
      return ok({
        granted: true,
        permission,
        level: membership.level || user.membershipLevel,
        reason: `会员 ${membership.level}`,
      })
    }

    // ── free 用户 ──
    // 免费权限：daily_insight_read 始终允许
    if (permission === 'daily_insight_read') {
      return ok({
        granted: true,
        permission,
        level: 'free',
        reason: '免费权限',
      })
    }

    console.log(`[checkPermission] 权限不足`)
    return ok({
      granted: false,
      permission,
      level: 'free',
      reason: 'need_payment',
      productRequired: permission === 'report_unlock' ? 'report_9_9'
        : permission === 'challenge_unlock' ? 'challenge_39_9'
        : null,
    })

  } catch (err) {
    console.error('[checkPermission] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
