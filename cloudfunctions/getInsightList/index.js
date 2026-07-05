/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * getInsightList 云函数
 *
 * 分页读取认知暴击列表
 *   free 用户 → 只返回标题 + locked=true
 *   VIP  用户 → 返回完整内容
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const { ok, fail, CODES } = require('./lib/response.js')
const now = () => Date.now()

const VIP_LEVELS = ['vip_month', 'vip_quarter', 'vip_year', 'svip', 'lifetime']

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { page = 1, pageSize = 20 } = event
  const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, pageSize))
  console.log(`[getInsightList] openid=${openid} page=${page} skip=${skip}`)

  try {
    // 判断是否 VIP
    let isVip = false
    const userRes = await db.collection('users').where({ openid }).limit(1).get()
    if (userRes.data[0] && VIP_LEVELS.includes(userRes.data[0].membershipLevel)) {
      isVip = true
    }

    // 查询列表
    const res = await db.collection('daily_insights')
      .where({ status: 'active' })
      .orderBy('sort', 'asc')
      .skip(skip)
      .limit(Math.min(100, pageSize || 20))
      .get()

    const totalRes = await db.collection('daily_insights')
      .where({ status: 'active' })
      .count()

    const list = res.data.map(item => {
      if (isVip) {
        return {
          insightId: item.insightId,
          title: item.title,
          content: item.content,
          reverseReasoning: item.reverseReasoning,
          caseText: item.caseText,
          action: item.action,
          tags: item.tags,
          difficulty: item.difficulty,
          locked: false,
        }
      }
      return {
        insightId: item.insightId,
        title: item.title,
        locked: true,
      }
    })

    return ok({
      list,
      total: totalRes.total,
      page,
      pageSize: Math.min(100, pageSize || 20),
      hasMore: skip + res.data.length < totalRes.total,
    })
  } catch (err) {
    console.error('[getInsightList] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
