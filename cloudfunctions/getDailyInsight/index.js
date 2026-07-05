/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * getDailyInsight 云函数
 *
 * 规则：
 *   1. 每天固定返回一条（所有用户当天看到同一条）
 *   2. 根据日期对 active daily_insights 总数取模
 *   3. 写入 analytics_logs 阅读事件
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const { ok, fail, CODES } = require('./lib/response.js')
const now = () => Date.now()

function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const ts = now()
  console.log(`[getDailyInsight] openid=${openid}`)

  try {
    // 查询所有 active 的认知暴击，按 sort 排序
    const res = await db.collection('daily_insights')
      .where({ status: 'active' })
      .orderBy('sort', 'asc')
      .limit(500)
      .get()

    const insights = res.data
    if (!insights || insights.length === 0) {
      return fail(CODES.NOT_FOUND, '暂无认知暴击内容')
    }

    // 根据当天日期取模
    const todayStart = startOfDay(ts)
    const index = Math.floor(todayStart / 86400000) % insights.length
    const insight = insights[index]

    // 写入阅读事件
    try {
      await db.collection('analytics_logs').add({
        data: {
          openid,
          event: 'insight_read',
          page: 'cognition_daily',
          module: 'daily_insight',
          params: { insightId: insight.insightId, date: todayStart },
          createdAt: ts,
        },
      })
    } catch (logErr) {
      console.warn('[getDailyInsight] 写入 analytics_logs 失败:', logErr.message)
    }

    return ok({
      insightId: insight.insightId,
      title: insight.title,
      content: insight.content,
      reverseReasoning: insight.reverseReasoning,
      caseText: insight.caseText,
      action: insight.action,
      tags: insight.tags,
      difficulty: insight.difficulty,
    })
  } catch (err) {
    console.error('[getDailyInsight] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
