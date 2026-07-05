/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * getWorldRules 云函数
 *
 * 按分类分页读取世界规则列表
 * 入参: { category, page, pageSize }
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const { ok, fail, CODES } = require('./lib/response.js')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { category = '', page = 1, pageSize = 20 } = event
  const skip = (Math.max(1, page) - 1) * Math.min(50, Math.max(1, pageSize))
  console.log(`[getWorldRules] openid=${openid} category=${category} page=${page}`)

  try {
    const where = { status: 'active' }
    if (category) where.category = category

    const res = await db.collection('world_rules')
      .where(where)
      .orderBy('sort', 'asc')
      .skip(skip)
      .limit(Math.min(50, pageSize || 20))
      .get()

    const totalRes = await db.collection('world_rules').where(where).count()

    const list = res.data.map(item => ({
      ruleId: item.ruleId,
      title: item.title,
      category: item.category,
      tags: item.tags,
      unlockLevel: item.unlockLevel,
    }))

    return ok({
      list,
      total: totalRes.total,
      page,
      pageSize: Math.min(50, pageSize || 20),
      hasMore: skip + res.data.length < totalRes.total,
    })
  } catch (err) {
    console.error('[getWorldRules] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
