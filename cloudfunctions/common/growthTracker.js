/**
 * cloudfunctions/common/growthTracker.js — 增长事件追踪（第六册 Part 1）
 *
 * 7 个核心增长事件：
 *   video_click → landing_view → mini_enter → challenge_start
 *   → challenge_complete → share_click → invite_success
 *
 * 自动计算：
 *   DAU / MAU / 分享率 / 邀请转化率
 */
const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)
const ONE_DAY = 86400000

const GROWTH_EVENTS = [
  'video_click',
  'landing_view',
  'mini_enter',
  'challenge_start',
  'challenge_complete',
  'share_click',
  'invite_success',
]

// ═══════════════════════════
// track — 单事件追踪
// ═══════════════════════════

async function track(db, { openid, event, source, properties = {} }) {
  if (!GROWTH_EVENTS.includes(event)) {
    return { error: `unknown event: ${event}`, valid: GROWTH_EVENTS }
  }

  const ts = now()
  const date = _todayKey(ts)

  const record = {
    openid,
    event,
    source: source || 'organic',
    properties,
    date,
    timestamp: ts,
    createdAt: ts,
  }

  try {
    await db.collection('growth_events').add({ data: record })

    // 异步聚合（不阻塞返回）
    _upsertDailyMetrics(db, date, evt, ts).catch(() => {})

    return { success: true, event }
  } catch (err) {
    console.error('[growthTracker] track 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// batchTrack — 批量追踪
// ═══════════════════════════

async function batchTrack(db, events = []) {
  const ts = now()
  const date = _todayKey(ts)
  const results = []

  for (const evt of events) {
    const res = await track(db, evt)
    results.push(res)
  }

  return { success: true, count: results.length, results }
}

// ═══════════════════════════
// getDailyMetrics — 获取每日增长指标
// ═══════════════════════════

async function getDailyMetrics(db, dateKey) {
  const date = dateKey || _todayKey(now())
  try {
    const res = await db.collection('growth_metrics')
      .where({ date })
      .limit(1)
      .get()
    return res.data[0] || _emptyMetrics(date)
  } catch (_) {
    return _emptyMetrics(date)
  }
}

// ═══════════════════════════
// getGrowthSummary — 增长概览（DAU/MAU等）
// ═══════════════════════════

async function getGrowthSummary(db, options = {}) {
  const ts = now()
  const today = _todayKey(ts)
  const thirtyDaysAgo = _todayKey(ts - 30 * ONE_DAY)

  try {
    // DAU — 今日 mini_enter
    const dau = await db.collection('growth_events')
      .where({ event: 'mini_enter', date: today })
      .count().then(r => r.total).catch(() => 0)

    // MAU — 近30天去重 mini_enter
    const mauEvents = await db.collection('growth_events')
      .where({ event: 'mini_enter', date: db.command.gte(thirtyDaysAgo) })
      .limit(1000)
      .get().catch(() => ({ data: [] }))
    const mau = new Set(mauEvents.data.map(e => e.openid)).size

    // 今日各事件计数
    const eventCounts = {}
    for (const event of GROWTH_EVENTS) {
      eventCounts[event] = await db.collection('growth_events')
        .where({ event, date: today })
        .count().then(r => r.total).catch(() => 0)
    }

    // 分享率 = share_click / challenge_complete
    const challengeComplete = eventCounts.challenge_complete || 0
    const shareClicks = eventCounts.share_click || 0
    const shareRate = challengeComplete > 0
      ? Math.round((shareClicks / challengeComplete) * 10000) / 100
      : 0

    // 邀请转化率 = invite_success / share_click
    const inviteSuccess = eventCounts.invite_success || 0
    const inviteRate = shareClicks > 0
      ? Math.round((inviteSuccess / shareClicks) * 10000) / 100
      : 0

    // K-Factor = 邀请人数 × 邀请转化率
    const avgInvites = inviteSuccess > 0
      ? Math.round((inviteSuccess / Math.max(dau, 1)) * 100) / 100
      : 0
    const kFactor = Math.round(avgInvites * (inviteRate / 100) * 100) / 100

    // 漏斗转化
    const funnel = {
      video_click:       eventCounts.video_click || 0,
      landing_view:      eventCounts.landing_view || 0,
      mini_enter:        eventCounts.mini_enter || 0,
      challenge_start:   eventCounts.challenge_start || 0,
      challenge_complete: challengeComplete,
      share_click:       shareClicks,
      invite_success:    inviteSuccess,
    }

    // 转化率
    const rates = {
      videoToLanding:   funnel.video_click > 0 ? Math.round((funnel.landing_view / funnel.video_click) * 10000) / 100 : 0,
      landingToMini:    funnel.landing_view > 0 ? Math.round((funnel.mini_enter / funnel.landing_view) * 10000) / 100 : 0,
      miniToChallenge:  funnel.mini_enter > 0 ? Math.round((funnel.challenge_start / funnel.mini_enter) * 10000) / 100 : 0,
      challengeDone:    funnel.challenge_start > 0 ? Math.round((funnel.challenge_complete / funnel.challenge_start) * 10000) / 100 : 0,
      doneToShare:      shareRate,
      shareToInvite:    inviteRate,
    }

    // 7日趋势
    const trend = []
    for (let i = 6; i >= 0; i--) {
      const d = _todayKey(ts - i * ONE_DAY)
      const dayDau = await db.collection('growth_events')
        .where({ event: 'mini_enter', date: d })
        .count().then(r => r.total).catch(() => 0)
      trend.push({ date: d, dau: dayDau })
    }

    return {
      date: today,
      dau, mau,
      dauMauRate: mau > 0 ? Math.round((dau / mau) * 10000) / 100 : 0,
      shareRate,
      inviteRate,
      kFactor,
      kFactorStatus: kFactor > 1 ? 'viral' : kFactor > 0.5 ? 'growing' : 'needs_push',
      funnel,
      rates,
      trend,
      newUsersToday: eventCounts.mini_enter || 0,
      analysedAt: ts,
    }
  } catch (err) {
    console.error('[growthTracker] getGrowthSummary 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// getCAC — 获客成本
// ═══════════════════════════

async function getCAC(db, options = {}) {
  const { period = 'month', totalSpend = 0 } = options
  const ts = now()
  const thisMonth = new Date(ts).toISOString().slice(0, 7)

  try {
    const newUsers = await db.collection('growth_events')
      .where({ event: 'mini_enter', date: db.command.gte(thisMonth + '-01') })
      .count().then(r => r.total).catch(() => 0)

    // 如果传入 totalSpend，计算 CAC
    const cac = newUsers > 0 ? Math.round(totalSpend / newUsers) : 0

    // 从配置中获取推广花费
    let configuredSpend = totalSpend
    if (!totalSpend) {
      const config = await db.collection('system_configs')
        .where({ key: 'growth_monthly_spend' })
        .limit(1)
        .get()
        .catch(() => ({ data: [] }))
      configuredSpend = config.data[0]?.value || 0
      const configuredCac = newUsers > 0 ? Math.round(configuredSpend / newUsers) : 0
      return { period, newUsers, totalSpend: configuredSpend, cac: configuredCac,
        status: configuredCac < 15 ? 'excellent' : configuredCac < 30 ? 'good' : 'warning',
        target: period === 'month' ? 'CAC < 15 (冷启动) → < 30 (成熟期)' : null,
        analysedAt: ts }
    }

    return {
      period, newUsers, totalSpend, cac,
      status: cac < 15 ? 'excellent' : cac < 30 ? 'good' : 'warning',
      target: 'CAC < 15 (冷启动) → < 30 (成熟期)',
      analysedAt: ts,
    }
  } catch (err) {
    console.error('[growthTracker] getCAC 异常:', err.message)
    return { error: err.message }
  }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

async function _upsertDailyMetrics(db, date, eventType, ts) {
  try {
    const existing = await db.collection('growth_metrics')
      .where({ date })
      .limit(1)
      .get()

    if (existing.data.length > 0) {
      const doc = existing.data[0]
      const update = { updatedAt: ts, [`counts.${eventType}`]: (doc.counts?.[eventType] || 0) + 1 }

      // 如果是 mini_enter，更新 DAU 去重
      if (eventType === 'mini_enter') {
        update.dau = (doc.dau || 0) + 1
      }

      await db.collection('growth_metrics').doc(doc._id).update({ data: update })
    } else {
      await db.collection('growth_metrics').add({
        data: {
          date,
          dau: eventType === 'mini_enter' ? 1 : 0,
          counts: { [eventType]: 1 },
          createdAt: ts,
          updatedAt: ts,
        },
      })
    }
  } catch (_) {}
}

function _emptyMetrics(date) {
  return {
    date,
    dau: 0,
    counts: {},
    createdAt: 0,
    updatedAt: 0,
  }
}

module.exports = {
  GROWTH_EVENTS,
  track,
  batchTrack,
  getDailyMetrics,
  getGrowthSummary,
  getCAC,
}
