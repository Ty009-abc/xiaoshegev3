/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * getUserProfile 云函数
 *
 * 职责：读取用户认知画像（user_profiles 集合）
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) return fail(CODES.AUTH_FAILED)

  console.log(`[getUserProfile] openid=${openid}`)

  try {
    const res = await db.collection('user_profiles')
      .where({ openid })
      .limit(1)
      .get()

    const profile = res.data[0] || null

    if (!profile) {
      return fail(CODES.NOT_FOUND, '用户认知画像不存在，请先登录')
    }

    return ok({ profile })
  } catch (err) {
    console.error('[getUserProfile] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
