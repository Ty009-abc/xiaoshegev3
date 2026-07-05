/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * getMembership 云函数
 *
 * 职责：
 *   1. 查询 memberships 表中 active 且未过期的会员
 *   2. 如果过期，自动标记 status=expired
 *   3. 同步 users.membershipLevel 回落
 *   4. 返回 permissions
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')

const now = () => Date.now()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return fail(CODES.AUTH_FAILED)
  }

  const ts = now()
  console.log(`[getMembership] openid=${openid}`)

  try {
    const membershipsCol = db.collection('memberships')
    const usersCol = db.collection('users')

    // 查询当前用户的 active 会员
    const res = await membershipsCol
      .where({ openid, status: 'active' })
      .orderBy('expiredAt', 'desc')
      .limit(1)
      .get()

    const membership = res.data[0] || null

    // 如果会员已过期 → 标记为 expired + 同步 users
    if (membership && membership.expiredAt && membership.expiredAt < ts) {
      console.log(`[getMembership] 会员已过期: ${membership.membershipId}`)
      await membershipsCol.doc(membership._id).update({
        data: { status: 'expired', updatedAt: ts },
      })

      // 同步 users.membershipLevel
      await usersCol.where({ openid }).update({
        data: {
          membershipLevel: 'free',
          membershipExpiredAt: null,
          updatedAt: ts,
        },
      })

      return ok({
        membership: null,
        isActive: false,
        permissions: ['daily_insight_read'],
        message: '会员已过期',
      })
    }

    if (membership) {
      return ok({
        membership,
        isActive: true,
        permissions: membership.permissions || [],
      })
    }

    // 查询 users 表快读字段（保底）
    const userRes = await usersCol.where({ openid }).limit(1).get()
    const user = userRes.data[0] || null

    if (user && user.membershipLevel !== 'free' && user.membershipExpiredAt) {
      if (user.membershipExpiredAt < ts) {
        // 快读字段也已过期
        console.log(`[getMembership] users 快读字段显示过期，同步为 free`)
        await usersCol.where({ openid }).update({
          data: {
            membershipLevel: 'free',
            membershipExpiredAt: null,
            updatedAt: ts,
          },
        })
      }
    }

    return ok({
      membership: null,
      isActive: false,
      permissions: ['daily_insight_read'],
    })

  } catch (err) {
    console.error('[getMembership] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
