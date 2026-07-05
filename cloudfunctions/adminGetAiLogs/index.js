/**
 * adminGetAiLogs - AI 调用统计
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

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { page = 1, pageSize = 20 } = event
  const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, pageSize))
  console.log(`[adminGetAiLogs] page=${page}`)

  try {
    if (!(await checkAdmin(db, openid))) return fail(CODES.PERMISSION_DENIED)

    const [res, totalRes, allRes] = await Promise.all([
      db.collection('ai_logs').orderBy('createdAt','desc').skip(skip).limit(Math.min(100, pageSize||20)).get(),
      db.collection('ai_logs').count(),
      db.collection('ai_logs').field({ tokens: true, success: true, createdAt: true }).get(),
    ])

    const all = allRes.data || []
    const totalCalls = totalRes.total
    const totalTokens = all.reduce((s, l) => s + (l.tokens || 0), 0)
    const totalCost = Math.round(totalTokens * 0.000002)
    const errors = all.filter(l => !l.success).length
    const errorRate = totalCalls > 0 ? ((errors / totalCalls) * 100).toFixed(1) + '%' : '0%'

    // 估算平均耗时（简单统计）
    const durations = all.filter(l => l.createdAt).map(l => l.tokens ? Math.round(l.tokens / 20) * 1000 : 3000)
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0

    return ok({
      totalCalls,
      totalTokens,
      totalCost,
      avgDuration,
      errorRate,
      list: (res.data || []).map(l => ({
        openid: l.openid,
        action: l.action,
        type: l.type,
        reportId: l.reportId || '',
        tokens: l.tokens || 0,
        success: l.success,
        errorMessage: l.errorMessage || '',
        createdAt: l.createdAt,
      })),
      page,
      total: totalRes.total,
    })
  } catch (err) {
    console.error('[adminGetAiLogs] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
