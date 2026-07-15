/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * getWorldRules 云函数
 *
 * mode=index  → 返回轻量完整索引 { index: [{ ruleId, category }], total }
 * categories  → 多分类 OR 查询
 * category    → 单分类筛选
 * full=true   → 返回完整字段
 * page/pageSize → 分页
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

  const {
    mode = '',
    category = '',
    categories = null,
    page = 1,
    pageSize = 20,
    full = false
  } = event

  console.log(`[getWorldRules] openid=${openid} mode=${mode} category=${category} page=${page}`)

  try {
    // ── mode=index: 返回完整轻量索引 ──
    if (mode === 'index') {
      const MAX_INDEX = 500
      let all = []
      let offset = 0
      const limit = 100

      while (all.length < MAX_INDEX) {
        const batch = await db.collection('world_rules')
          .where({ status: 'active' })
          .field({ ruleId: true, category: true })
          .orderBy('sort', 'asc')
          .skip(offset)
          .limit(limit)
          .get()

        if (!batch.data || batch.data.length === 0) break
        all = all.concat(batch.data)
        if (batch.data.length < limit) break
        offset += limit
      }

      return ok({
        index: all,
        total: all.length,
      })
    }

    // ── 构建 WHERE ──
    const where = { status: 'active' }

    if (categories && Array.isArray(categories) && categories.length > 0) {
      where.category = _.in(categories)
    } else if (category) {
      where.category = category
    }

    const skip = (Math.max(1, page) - 1) * Math.min(50, Math.max(1, pageSize))

    const res = await db.collection('world_rules')
      .where(where)
      .orderBy('sort', 'asc')
      .skip(skip)
      .limit(Math.min(50, pageSize || 20))
      .get()

    const totalRes = await db.collection('world_rules').where(where).count()

    const list = res.data.map(item => (full ? {
      ruleId: item.ruleId,
      title: item.title,
      category: item.category,
      tags: item.tags,
      unlockLevel: item.unlockLevel,
      summary: item.summary || item.content || '',
      detail: item.detail || '',
      action: item.action || item.action_advice || '',
      sort: item.sort,
    } : {
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
