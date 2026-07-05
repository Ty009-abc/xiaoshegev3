/**
 * adminGetReports - 查看所有用户报告
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

  const { page = 1, pageSize = 20, isPaid = '' } = event
  const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, pageSize))
  console.log(`[adminGetReports] page=${page}`)

  try {
    if (!(await checkAdmin(db, openid))) return fail(CODES.PERMISSION_DENIED)

    const where = {}
    if (isPaid === 'true') where.isPaid = true
    else if (isPaid === 'false') where.isPaid = false

    const query = db.collection('ai_reports')
    const [res, totalRes] = await Promise.all([
      Object.keys(where).length
        ? query.where(where).orderBy('createdAt','desc').skip(skip).limit(Math.min(100, pageSize||20)).get()
        : query.orderBy('createdAt','desc').skip(skip).limit(Math.min(100, pageSize||20)).get(),
      Object.keys(where).length ? query.where(where).count() : query.count(),
    ])

    const list = (res.data || []).map(r => ({
      reportId: r.reportId,
      openid: r.openid,
      type: r.type,
      isPaid: r.isPaid || false,
      aiTokens: r.aiTokens || 0,
      summary: r.content ? {
        oneSentence: r.content.oneSentence || '',
        worldModelType: r.content.worldModelType || '',
        turnaroundProbability: r.content.turnaroundProbability || 0,
      } : {},
      createdAt: r.createdAt,
    }))

    return ok({ list, total: totalRes.total, page })
  } catch (err) {
    console.error('[adminGetReports] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
