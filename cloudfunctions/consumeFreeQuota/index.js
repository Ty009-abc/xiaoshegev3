/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * consumeFreeQuota 云函数
 *
 * 职责：
 *   1. VIP/会员不扣次数
 *   2. 免费用户次数 > 0 才扣减
 *   3. 次数不足返回 FREE_QUOTA_USED_UP
 *   4. 每日重置逻辑：基于 lastActiveAt 跨天重置
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')

const now = () => Date.now()

function isSameDay(a, b) {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate()
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) return fail(CODES.AUTH_FAILED)

  const ts = now()
  console.log(`[consumeFreeQuota] openid=${openid}`)

  try {
    const usersCol = db.collection('users')
    const userRes = await usersCol.where({ openid }).limit(1).get()
    const user = userRes.data[0]

    if (!user) return fail(CODES.AUTH_FAILED, '用户不存在')

    // ── VIP/会员不扣次数 ──
    const vipLevels = ['vip_month', 'vip_quarter', 'vip_year', 'svip', 'lifetime']
    if (vipLevels.includes(user.membershipLevel)) {
      console.log(`[consumeFreeQuota] VIP用户，不扣次数 level=${user.membershipLevel}`)
      return ok({
        quotaConsumed: false,
        remaining: -1, // -1 表示无限
        level: user.membershipLevel,
        isVip: true,
      })
    }

    // ── 跨天重置 ──
    let dailyUsed = user.dailyAiUsed || 0
    if (user.lastActiveAt && !isSameDay(user.lastActiveAt, ts)) {
      console.log(`[consumeFreeQuota] 跨天，重置免费次数`)
      dailyUsed = 0
      await usersCol.doc(user._id).update({
        data: { dailyAiUsed: 0, updatedAt: ts },
      })
    }

    // ── 免费次数上限 ──
    const maxFree = user.freeAiCount || 3
    if (dailyUsed >= maxFree) {
      return ok({
        quotaConsumed: false,
        remaining: 0,
        used: dailyUsed,
        max: maxFree,
        level: 'free',
        isVip: false,
        needPay: true,
      })
    }

    // ── 扣减次数 ──
    const newUsed = dailyUsed + 1
    const remaining = maxFree - newUsed

    await usersCol.doc(user._id).update({
      data: {
        dailyAiUsed: newUsed,
        lastActiveAt: ts,
        updatedAt: ts,
      },
    })

    console.log(`[consumeFreeQuota] 扣减成功 remaining=${remaining}`)

    return ok({
      quotaConsumed: true,
      remaining,
      used: newUsed,
      max: maxFree,
      level: 'free',
      isVip: false,
    })

  } catch (err) {
    console.error('[consumeFreeQuota] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
