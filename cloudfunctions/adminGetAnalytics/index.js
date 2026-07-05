/**
 * adminGetAnalytics - 运营数据分析
 * 留存 / 漏斗 / topEvents
 * + 第六册 Part 1 增长分析 action 路由
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

  const action = event.action

  try {
    if (!(await checkAdmin(db, openid))) return fail(CODES.PERMISSION_DENIED)

    // ═══ 第六册 Part 1 — 增长分析路由 ═══
    if (action && action.startsWith('growth_')) {
      return await handleGrowthAction(db, action, event)
    }

    // ═══ 第六册 Part 5 — 获客分析 ═══
    if (action === 'acquisitionDashboard') {
      return await handleAcquisitionDashboard(db)
    }

    // ═══ 第六册 Part 6 — 规模化增长 ═══
    if (action === 'scaleDashboard') {
      return await handleScaleDashboard(db)
    }

    // 原有分析
    const ts = now()
    const d1Start = startOfDay(ts)
    const d7Start = d1Start - 6 * 86400000
    const d30Start = d1Start - 29 * 86400000

    let d1 = '0%', d7 = '0%', d30 = '0%'
    try {
      const [todayLogs, d7Logs] = await Promise.all([
        db.collection('analytics_logs').where({ createdAt: _.gte(d1Start) }).field({ openid: true }).get(),
        db.collection('analytics_logs').where({ createdAt: _.gte(d7Start) }).field({ openid: true }).get(),
      ])
      const todayOids = new Set((todayLogs.data||[]).map(l => l.openid))
      const d7Oids = new Set((d7Logs.data||[]).map(l => l.openid))
      const returning = [...todayOids].filter(o => d7Oids.has(o)).length
      if (todayOids.size > 0) {
        d1 = '100%'
        d7 = ((returning / todayOids.size) * 100).toFixed(1) + '%'
      }
      d30 = d7
    } catch (_) {}

    let funnel = { visitHome: 0, startChallenge: 0, finishChallenge: 0, viewPay: 0, paid: 0 }
    try {
      const eventsRes = await db.collection('analytics_logs').where({ createdAt: _.gte(d30Start) }).field({ event: true }).get()
      const events = (eventsRes.data||[]).map(l => l.event)
      funnel.visitHome = events.filter(e => e === 'page_home' || e === 'visit').length || 1
      funnel.startChallenge = events.filter(e => e === 'start_challenge').length
      funnel.finishChallenge = events.filter(e => e === 'finish_challenge').length
      funnel.viewPay = events.filter(e => e === 'view_pay' || e === 'view_membership').length
      funnel.paid = events.filter(e => e === 'paid_success').length
    } catch (_) {}

    let topEvents = []
    try {
      const allEvt = await db.collection('analytics_logs').where({ createdAt: _.gte(d30Start) }).field({ event: true }).get()
      const counts = {}
      ;(allEvt.data||[]).forEach(l => { counts[l.event] = (counts[l.event]||0) + 1 })
      topEvents = Object.entries(counts)
        .sort((a,b) => b[1]-a[1])
        .slice(0, 10)
        .map(([event, count]) => ({ event, count }))
    } catch (_) {}

    return ok({ retention: { d1, d7, d30 }, funnel, topEvents })
  } catch (err) {
    console.error('[adminGetAnalytics] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}

// ═══════════════════════════
// growth action handler
// ═══════════════════════════

async function handleGrowthAction(db, action, event) {
  // lazy load to avoid cold-start perf hit for non-growth calls
  try {
    switch (action) {
      case 'growth_summary': {
        const { getGrowthSummary } = require('./lib/growthTracker.js')
        const summary = await getGrowthSummary(db)
        return ok(summary)
      }
      case 'growth_health': {
        const { analyzeGrowthHealth } = require('./lib/growthAnalyzer.js')
        const health = await analyzeGrowthHealth(db)
        return ok(health)
      }
      case 'growth_bottleneck': {
        const { detectBottleneck } = require('./lib/growthAnalyzer.js')
        const bottle = await detectBottleneck(db)
        return ok(bottle)
      }
      case 'growth_flywheel': {
        const { analyzeFlywheel } = require('./lib/growthAnalyzer.js')
        const fly = await analyzeFlywheel(db)
        return ok(fly)
      }
      case 'growth_channels': {
        const { getChannelStats } = require('./lib/attributionEngine.js')
        const ch = await getChannelStats(db, { period: 'month' })
        return ok(ch)
      }
      case 'growth_cac': {
        const { getCAC } = require('./lib/growthTracker.js')
        const cac = await getCAC(db, { period: 'month' })
        return ok(cac)
      }
      default:
        return fail(CODES.BAD_REQUEST, `unknown growth action: ${action}`)
    }
  } catch (err) {
    console.error('[adminGetAnalytics] growth action 异常:', err.message)
    return fail(CODES.DB_ERROR, err.message)
  }
}

// ═══════════════════════════════════════════
// 第六册 Part 5 — 获客分析 Dashboard
// ═══════════════════════════════════════════

async function handleAcquisitionDashboard(db) {
  try {
    const acqEngine = require('./lib/acquisitionEngine.js')
    const srcAnalyzer = require('./lib/sourceAnalyzer.js')
    const attrAnalyzer = require('./lib/attributionAnalyzer.js')
    const ltvAnalyzer = require('./lib/ltvAnalyzer.js')

    const [
      summary,
      cacBySource,
      activationBySource,
      paidConversionBySource,
      ltvBySource,
      sourceQuality,
      attributionReport,
      contentROI,
      highValueSegments,
      budgetOptimizer,
      ltvHealth,
      ltvTrend,
    ] = await Promise.all([
      acqEngine.getAcquisitionSummary(db),
      acqEngine.getCAC(db),
      acqEngine.getActivationRate(db),
      acqEngine.getPaidConversionRate(db),
      acqEngine.getLTVBySource(db),
      srcAnalyzer.getSourceQuality(db),
      attrAnalyzer.getAttributionReport(db),
      acqEngine.getContentROI(db),
      acqEngine.getHighValueSegments(db),
      acqEngine.getBudgetOptimizer(db),
      ltvAnalyzer.getLtvHealth(db),
      ltvAnalyzer.getLtvTrend(db, 7),
    ])

    return ok({
      summary,
      cacBySource,
      activationBySource,
      paidConversionBySource,
      ltvBySource,
      sourceQuality,
      attributionReport,
      contentROI,
      highValueSegments,
      budgetOptimizer,
      ltvHealth,
      ltvTrend,
    })
  } catch (err) {
    console.error('[adminGetAnalytics] acquisitionDashboard 异常:', err.message)
    return fail(CODES.DB_ERROR, err.message)
  }
}

// ═══════════════════════════════════════════
// 第六册 Part 6 — 规模化增长 Dashboard
// ═══════════════════════════════════════════

async function handleScaleDashboard(db) {
  try {
    const scaleEngine = require('./lib/scaleEngine.js')
    const growthSimulator = require('./lib/growthSimulator.js')
    const bottleneckDetector = require('./lib/bottleneckDetector.js')
    const expansionPlanner = require('./lib/expansionPlanner.js')

    const [
      phase,
      scaleKPIs,
      simulation,
      bottlenecks,
      expansionPlan,
    ] = await Promise.all([
      scaleEngine.detectPhase(db),
      scaleEngine.getScaleKPIs(db),
      growthSimulator.simulateGrowth(db),
      bottleneckDetector.detectBottlenecks(db),
      expansionPlanner.getExpansionPlan(db),
    ])

    return ok({
      phase,
      scaleKPIs,
      simulation,
      bottlenecks,
      expansionPlan,
      contentScalingPlan: scaleEngine.getContentScalingPlan(),
      accountMatrix: scaleEngine.getAccountMatrix(),
      paidRules: await scaleEngine.getPaidGrowthRules(db),
      timeline: scaleEngine.getScaleTimeline(),
    })
  } catch (err) {
    console.error('[adminGetAnalytics] scaleDashboard 异常:', err.message)
    return fail(CODES.DB_ERROR, err.message)
  }
}
