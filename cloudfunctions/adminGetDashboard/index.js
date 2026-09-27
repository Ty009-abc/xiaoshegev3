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
const adminAuth = require('./lib/adminAuth.js')

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

async function checkAdmin(db, openid) {
  const admin = await adminAuth.resolveAdmin(db, openid)
  return !!(admin && adminAuth.hasPermission(admin, 'dashboard:view'))
}

const now = () => Date.now()
function startOfDay(ts) { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime() }
const DAY = 86400000
// RC8.9C R1B — 显式业务时区 Asia/Shanghai(+8h，无 DST)。
// 服务器为 UTC，绝不能拿本地/UTC 午夜当“今日”边界。
const BEIJING_OFFSET = 8 * 3600 * 1000
function startOfBeijingDay(ts) { return Math.floor((ts + BEIJING_OFFSET) / DAY) * DAY - BEIJING_OFFSET }
function pctStr(failed, total) { return (total > 0) ? ((failed / total) * 100).toFixed(1) + '%' : null }

// RC8.9C R1B — 规范 AI 计量口径：仅 telemetryVersion=2 且 operation='model_call' 的行。
// legacy ai_logs（无 telemetryVersion 的历史行）不计入任何主指标，仅做诊断计数。
const V2_MODEL_CALL = { telemetryVersion: 2, operation: 'model_call' }
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

    // ── OPTIONAL AI 遥测（fail-soft）：规范口径 = telemetryVersion 2 + operation 'model_call'。
    //      旧 ai_logs（无 telemetryVersion）不计入任何主指标，仅作诊断计数。
    //      查询失败绝不阻断 dashboard（回退安全默认，显式标注 available=false）。
    let todayAiCalls = 0
    let cumulativeCalls = 0
    let estimatedCostCnyTotal = null   // null → UI 显示 --（无已计价调用）
    let pricedCallCount = 0
    let unpricedCallCount = 0
    let failedCalls = 0
    let errorRate = null               // null → UI 显示 --（0 样本）
    let providerErrors = 0
    let timeouts = 0
    let invalidResponses = 0
    let validationErrors = 0
    let avgLatencyMs = null
    let p95LatencyMs = null
    let legacyTelemetryRows = 0
    let aiFallbacks = 0
    let telemetryAvailable = false
    try {
      const todayStartBeijing = startOfBeijingDay(ts)
      const [cumRes, todayCount, legacyCount] = await Promise.all([
        db.collection('ai_logs').where(V2_MODEL_CALL)
          .field({ status: true, estimatedCostCny: true, latencyMs: true, isFallback: true, renderSource: true }).get(),
        db.collection('ai_logs').where(Object.assign({}, V2_MODEL_CALL, { createdAt: _.gte(todayStartBeijing) })).count(),
        db.collection('ai_logs').where({ telemetryVersion: _.neq(2) }).count(),
      ])
      const rows = cumRes.data || []
      cumulativeCalls = rows.length
      todayAiCalls = todayCount.total || 0
      legacyTelemetryRows = legacyCount.total || 0

      let costSum = 0
      const latencies = []
      rows.forEach(l => {
        // 失败 = 真实外部模型尝试且 status != SUCCESS（不含规则兜底/入库失败/追踪失败）
        const st = l.status
        if (st !== 'SUCCESS') {
          failedCalls++
          if (st === 'TIMEOUT') timeouts++
          else if (st === 'INVALID_RESPONSE') invalidResponses++
          else if (st === 'VALIDATION_ERROR') validationErrors++
          else providerErrors++
        }
        if (typeof l.estimatedCostCny === 'number' && isFinite(l.estimatedCostCny) && l.estimatedCostCny >= 0) {
          costSum += l.estimatedCostCny
          pricedCallCount++
        } else {
          unpricedCallCount++
        }
        if (typeof l.latencyMs === 'number' && isFinite(l.latencyMs) && l.latencyMs >= 0) latencies.push(l.latencyMs)
        if (l.isFallback === true || l.renderSource === 'deterministic_fallback') aiFallbacks++
      })
      // UNKNOWN ≠ 0：无任何已计价调用 → null（UI 显示 --），绝不伪造 ¥0。
      estimatedCostCnyTotal = pricedCallCount > 0 ? Number(costSum.toFixed(6)) : null
      if (latencies.length) {
        avgLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        const sorted = latencies.slice().sort((a, b) => a - b)
        p95LatencyMs = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
      }
      errorRate = pctStr(failedCalls, cumulativeCalls)
      telemetryAvailable = true
    } catch (aiErr) {
      console.warn('[adminGetDashboard] ai telemetry unavailable — defaults applied:', aiErr && aiErr.message)
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
      // RC8.9C R1B — 今日 与 累计 严格分离（修复二者同绑 stats.aiCalls 的 bug）。
      today: { aiCalls: todayAiCalls },
      aiRuntime: {
        totalCalls: cumulativeCalls,
        pricedCallCount,
        unpricedCallCount,
        estimatedCostCny: estimatedCostCnyTotal,   // null = 无定价数据（UI --），非 ¥0
        avgLatencyMs,
        p95LatencyMs,
        failedCalls,
        errorRate,                                  // null = 0 样本（UI --），非 0.0%
        breakdown: { providerErrors, timeouts, invalidResponses, validationErrors },
        fallbacks: aiFallbacks,
        legacyTelemetryRows,
        available: telemetryAvailable,
      },
      businessTimezone: 'Asia/Shanghai',
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
