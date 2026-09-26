/**
 * adminGetDashboard - 后台数据总览
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { ok, fail, CODES } = require('./lib/response.js')

function checkAdmin(db, openid) {
  return db.collection('system_configs').where({ key: 'admin_users', status: 'active' }).limit(1).get()
    .then(r => { const c = r.data[0]; return c && c.value && c.value.openids && c.value.openids.includes(openid) })
    .catch(() => false)
}

const now = () => Date.now()
function startOfDay(ts) { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime() }

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const ts = now()
  console.log(`[adminGetDashboard] openid=${openid}`)

  try {
    if (!(await checkAdmin(db, openid))) return fail(CODES.PERMISSION_DENIED)

    const todayStart = startOfDay(ts)

    // ── CORE 指标（hard-required）：users / orders。任一失败 → 由外层 catch 返回 DB_ERROR ──
    const [
      totalUsers, todayUsers, totalOrders, paidOrders, allOrdersRes, vipUsers
    ] = await Promise.all([
      db.collection('users').count(),
      db.collection('users').where({ createdAt: _.gte(todayStart) }).count(),
      db.collection('orders').count(),
      db.collection('orders').where({ status: 'paid' }).count(),
      db.collection('orders').where({ status: 'paid' }).field({ totalAmount: true }).get(),
      db.collection('users').where({ membershipLevel: _.neq('free') }).count(),
    ])

    // 总收入
    const totalRevenue = (allOrdersRes.data || []).reduce((s, o) => s + (o.totalAmount || 0), 0)
    const todayOrders = (allOrdersRes.data || []).filter(o => o.paidAt && o.paidAt >= todayStart)
    const todayRevenue = todayOrders.reduce((s, o) => s + (o.totalAmount || 0), 0)

    // ── OPTIONAL 遥测（fail-soft）：ai_logs 缺失/查询失败不阻断仪表盘，回退安全默认值 ──
    let aiCalls = 0
    let aiCost = 0
    let aiErrors = 0
    let errorRate = '0%'
    try {
      const [aiLogsCount, aiLogsRes] = await Promise.all([
        db.collection('ai_logs').count(),
        db.collection('ai_logs').field({ tokens: true, createdAt: true, success: true }).get(),
      ])
      const aiLogs = aiLogsRes.data || []
      aiCalls = aiLogsCount.total
      const totalTokens = aiLogs.reduce((s, l) => s + (l.tokens || 0), 0)
      aiCost = Math.round(totalTokens * 0.000002) // 约 ¥0.002 / 1K tokens 估算
      aiErrors = aiLogs.filter(l => !l.success).length
      errorRate = aiCalls > 0 ? ((aiErrors / aiCalls) * 100).toFixed(1) + '%' : '0%'
    } catch (aiErr) {
      console.warn('[adminGetDashboard] optional ai_logs unavailable — telemetry defaults applied:', aiErr && aiErr.message)
    }

    // 付费率
    const paidRate = totalUsers.total > 0 ? ((paidOrders.total / totalUsers.total) * 100).toFixed(1) + '%' : '0%'

    return ok({
      totalUsers: totalUsers.total,
      todayNewUsers: todayUsers.total,
      totalOrders: totalOrders.total,
      paidOrders: paidOrders.total,
      totalRevenue,
      todayRevenue,
      aiCalls,
      aiCost,
      aiErrors,
      errorRate,
      paidRate,
      vipUsers: vipUsers.total,
    })
  } catch (err) {
    console.error('[adminGetDashboard] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
