/**
 * adminGetDashboard - 后台数据总览
 *
 * RC8.8 — CORE(users/orders) 硬失败 → DB_ERROR；OPTIONAL(ai_logs) 软失败 → 默认值。
 * RC8.9B — 新增 fail-soft 运营聚合：funnel / trend / recentUsers（user_events）。
 *          任一失败仅该项降级，绝不阻断 dashboard。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { ok, fail, CODES } = require('./lib/response.js')

// RC8.9B — user_events 事件元数据（内联，避免额外模块依赖）
const FUNNEL_STEPS = [
  { key: 'home_view', name: '打开首页' },
  { key: 'strategy_start', name: '开始测试' },
  { key: 'questionnaire_complete', name: '完成问卷' },
  { key: 'report_success', name: '报告成功' },
  { key: 'payment_view', name: '进入付款' },
  { key: 'payment_success', name: '支付成功' },
]
const EVENT_TEXT = {
  app_open: '打开小程序', home_view: '打开首页', strategy_start: '开始翻身策略',
  questionnaire_start: '开始问卷', question_answered: '作答一题', questionnaire_complete: '完成问卷',
  report_request: '请求生成报告', report_success: '报告生成成功', report_fallback: '报告降级（规则兜底）',
  report_fail: '报告生成失败', report_view: '查看报告', poster_generate: '生成海报',
  poster_save: '保存海报', qa_open: '打开AI问答', qa_send: '发送AI提问',
  payment_view: '进入付款页', payment_create: '创建订单', payment_success: '支付成功',
  payment_fail: '支付失败', membership_view: '查看会员页',
}
function userLabel(oid) { if (!oid) return 'User #----'; return 'User #' + String(oid).slice(-4).toUpperCase() }

function checkAdmin(db, openid) {
  return db.collection('system_configs').where({ key: 'admin_users', status: 'active' }).limit(1).get()
    .then(r => { const c = r.data[0]; return c && c.value && c.value.openids && c.value.openids.includes(openid) })
    .catch(() => false)
}

const now = () => Date.now()
function startOfDay(ts) { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime() }
const DAY = 86400000
// Asia/Shanghai (+8h) → HH:MM
function hhmm(ts) {
  const d = new Date((ts || 0) + 8 * 3600 * 1000)
  const h = String(d.getUTCHours()).padStart(2, '0')
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

// ── OPTIONAL 运营聚合（fail-soft）──
async function buildFunnel(todayStart) {
  try {
    const counts = await Promise.all(FUNNEL_STEPS.map(s =>
      db.collection('user_events').where({ eventName: s.key, timestamp: _.gte(todayStart) }).count()
    ))
    const raw = FUNNEL_STEPS.map((s, i) => ({ key: s.key, name: s.name, count: counts[i].total || 0 }))
    const base = raw[0] ? raw[0].count : 0
    return raw.map((r, i) => {
      const prev = i > 0 ? raw[i - 1].count : r.count
      return {
        key: r.key,
        name: r.name,
        count: r.count,
        rate: base > 0 ? ((r.count / base) * 100).toFixed(0) + '%' : '0%',
        w: base > 0 ? Math.round((r.count / base) * 100) : 0,
        drop: i > 0 && prev > 0 ? (((prev - r.count) / prev) * 100).toFixed(0) + '%' : '',
      }
    })
  } catch (e) {
    console.warn('[adminGetDashboard] funnel unavailable:', e && e.message)
    return null
  }
}

async function buildTrend(todayStart) {
  try {
    const from = todayStart - 6 * DAY
    const res = await db.collection('users').where({ createdAt: _.gte(from) }).field({ createdAt: true }).get()
    const days = []
    const counts = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(new Date(todayStart - (6 - i) * DAY).getTime())
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      days.push(key); counts[key] = 0
    }
    ;(res.data || []).forEach(u => {
      const k = u.createdAt || 0
      const d = new Date(k)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (counts[key] != null) counts[key]++
    })
    const max = Math.max(1, ...days.map(k => counts[k]))
    return days.map(k => ({ date: k.slice(5), count: counts[k], h: Math.round((counts[k] / max) * 100) }))
  } catch (e) {
    console.warn('[adminGetDashboard] trend unavailable:', e && e.message)
    return null
  }
}

async function buildRecentUsers() {
  try {
    const res = await db.collection('user_events')
      .orderBy('timestamp', 'desc').limit(10)
      .field({ openid: true, eventName: true, timestamp: true }).get()
    return (res.data || []).map(e => ({
      userId: e.openid,
      openid: e.openid,
      label: userLabel(e.openid),
      action: EVENT_TEXT[e.eventName] || e.eventName,
      timeText: hhmm(e.timestamp),
    }))
  } catch (e) {
    console.warn('[adminGetDashboard] recentUsers unavailable:', e && e.message)
    return null
  }
}

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

    // ── OPTIONAL 运营聚合（fail-soft）：funnel / trend / recentUsers ──
    const [funnel, trend, recentUsers] = await Promise.all([
      buildFunnel(todayStart),
      buildTrend(todayStart),
      buildRecentUsers(),
    ])

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
      funnel,
      trend,
      recentUsers,
    })
  } catch (err) {
    console.error('[adminGetDashboard] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
