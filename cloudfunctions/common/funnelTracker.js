/**
 * cloudfunctions/common/funnelTracker.js — 漏斗埋点处理器（第五册 Part 4）
 *
 * 职责：
 *   1. 接收前端埋点事件 → 写入 funnel_events 集合
 *   2. 维护用户漏斗状态（user_funnel_state）
 *   3. 写 conversion_metrics 每日汇总
 *   4. 高性能：返回后异步写，不阻塞主流程
 *
 * 漏斗事件：
 *   home_view / insight_read / challenge_start / challenge_finish
 *   report_preview / report_unlock_click / payment_success
 *   membership_view / membership_purchase / consult_apply
 */

const now = () => Date.now()
const _todayKey = (ts) => new Date(ts).toISOString().slice(0, 10)

/** 漏斗事件定义 */
const FUNNEL_EVENTS = [
  { event: 'home_view',            stage: 'top',    step: 1,  description: '首页访问' },
  { event: 'insight_read',         stage: 'top',    step: 2,  description: '认知暴击阅读' },
  { event: 'challenge_start',      stage: 'mid',    step: 3,  description: '挑战开始' },
  { event: 'challenge_finish',     stage: 'mid',    step: 4,  description: '挑战完成' },
  { event: 'report_preview',       stage: 'mid',    step: 5,  description: '报告预览' },
  { event: 'report_unlock_click',  stage: 'bottom', step: 6,  description: '点击解锁报告' },
  { event: 'payment_success',      stage: 'bottom', step: 7,  description: '支付成功' },
  { event: 'membership_view',      stage: 'bottom', step: 8,  description: '会员页访问' },
  { event: 'membership_purchase',  stage: 'bottom', step: 9,  description: '会员购买' },
  { event: 'consult_apply',        stage: 'bottom', step: 10, description: '咨询申请' },
]

/** 事件→漏斗阶段映射 */
const EVENT_STAGE = {}
FUNNEL_EVENTS.forEach(e => { EVENT_STAGE[e.event] = e.stage })

/** 事件→步骤映射 */
const EVENT_STEP = {}
FUNNEL_EVENTS.forEach(e => { EVENT_STEP[e.event] = e.step })

// ═══════════════════════════
// track — 记录一次漏斗事件
// ═══════════════════════════

/**
 * @param {object} db
 * @param {object} payload — { openid, event, membershipLevel, cv, extra?:{} }
 */
async function track(db, payload) {
  const ts = now()
  const { openid, event, membershipLevel = 'free', cv = 0, extra = {} } = payload

  if (!openid || !event) return { success: false, reason: '缺少 openid 或 event' }

  const dateKey = _todayKey(ts)
  const stage = EVENT_STAGE[event] || 'unknown'
  const step = EVENT_STEP[event] || 0

  const entry = {
    openid,
    event,
    stage,
    step,
    membershipLevel,
    cv,
    date: dateKey,
    timestamp: ts,
    extra: typeof extra === 'object' ? extra : {},
  }

  try {
    // 1. 写入漏斗事件流水
    await db.collection('funnel_events').add({ data: entry })

    // 2. 更新用户漏斗状态（upsert）
    await _upsertFunnelState(db, openid, event, step, ts)

    // 3. 更新 conversion_metrics 每日汇总
    await _upsertDailyMetrics(db, dateKey, event, stage, ts)

    return { success: true, event, stage }
  } catch (err) {
    console.error('[funnelTracker] track 异常:', err.message)
    return { success: false, reason: err.message }
  }
}

/**
 * batchTrack — 批量写入（前端累积后批量上报）
 */
async function batchTrack(db, events) {
  const results = []
  for (const e of events) {
    results.push(await track(db, e))
  }
  return { success: true, count: results.length, results }
}

// ═══════════════════════════
// getFunnelState — 获取用户当前漏斗阶段
// ═══════════════════════════

async function getFunnelState(db, openid) {
  try {
    const res = await db.collection('user_funnel_state').where({ openid }).limit(1).get()
    if (res.data.length > 0) {
      return { ...res.data[0] }
    }
    return {
      openid,
      maxStep: 0,
      currentStage: 'top',
      events: [],
      lastEventAt: 0,
    }
  } catch (_) {
    return { openid, maxStep: 0, currentStage: 'top', events: [], lastEventAt: 0 }
  }
}

// ═══════════════════════════
// getConversionRates — 计算转化率
// ═══════════════════════════

async function getConversionRates(db, dateKey = null) {
  const today = dateKey || _todayKey(now())
  try {
    const metrics = await db.collection('conversion_metrics')
      .where({ date: dateKey || today })
      .limit(1)
      .get()

    if (metrics.data.length > 0) {
      const m = metrics.data[0]
      return {
        date: today,
        homeToInsight: _rate(m.insight_read, m.home_view),
        insightToChallenge: _rate(m.challenge_start, m.insight_read),
        challengeToFinish: _rate(m.challenge_finish, m.challenge_start),
        finishToReport: _rate(m.report_preview, m.challenge_finish),
        reportToUnlock: _rate(m.report_unlock_click, m.report_preview),
        unlockToPay: _rate(m.payment_success, m.report_unlock_click),
        payToMember: _rate(m.membership_purchase, m.payment_success),
        memberToConsult: _rate(m.consult_apply, m.membership_purchase),
      }
    }

    // 实时计算
    return await _computeRates(db, today)
  } catch (err) {
    console.error('[funnelTracker] getConversionRates 异常:', err.message)
    return null
  }
}

// ═══════════════════════════
// getBottleneck — 找出最大流失阶段
// ═══════════════════════════

async function getBottleneck(db, dateKey = null) {
  const rates = await getConversionRates(db, dateKey)
  if (!rates) return null

  const steps = [
    { name: '首页→暴击', rate: rates.homeToInsight },
    { name: '暴击→挑战', rate: rates.insightToChallenge },
    { name: '挑战→完成', rate: rates.challengeToFinish },
    { name: '完成→报告', rate: rates.finishToReport },
    { name: '报告→解锁', rate: rates.reportToUnlock },
    { name: '解锁→支付', rate: rates.unlockToPay },
    { name: '支付→会员', rate: rates.payToMember },
    { name: '会员→咨询', rate: rates.memberToConsult },
  ]

  let bottleneck = steps[0]
  for (const s of steps) {
    if (s.rate < bottleneck.rate) bottleneck = s
  }

  return { ...rates, bottleneck, steps }
}

// ═══════════════════════════
// 辅助
// ═══════════════════════════

async function _upsertFunnelState(db, openid, event, step, ts) {
  try {
    const res = await db.collection('user_funnel_state').where({ openid }).limit(1).get()
    if (res.data.length > 0) {
      const state = res.data[0]
      const events = state.events || []
      const maxStep = Math.max(state.maxStep || 0, step)
      events.push({ event, step, timestamp: ts })
      // 保留最近 50 个事件
      const trimmed = events.slice(-50)

      await db.collection('user_funnel_state').doc(state._id).update({
        data: {
          maxStep,
          currentStage: EVENT_STAGE[event] || state.currentStage,
          lastEventAt: ts,
          lastEvent: event,
          events: trimmed,
          updatedAt: ts,
        },
      })
    } else {
      await db.collection('user_funnel_state').add({
        data: {
          openid,
          maxStep: step,
          currentStage: EVENT_STAGE[event] || 'top',
          lastEventAt: ts,
          lastEvent: event,
          events: [{ event, step, timestamp: ts }],
          createdAt: ts,
          updatedAt: ts,
        },
      })
    }
  } catch (_) {}
}

async function _upsertDailyMetrics(db, date, event, stage, ts) {
  try {
    const res = await db.collection('conversion_metrics').where({ date }).limit(1).get()
    const fieldMap = {
      home_view: 'home_view',
      insight_read: 'insight_read',
      challenge_start: 'challenge_start',
      challenge_finish: 'challenge_finish',
      report_preview: 'report_preview',
      report_unlock_click: 'report_unlock_click',
      payment_success: 'payment_success',
      membership_view: 'membership_view',
      membership_purchase: 'membership_purchase',
      consult_apply: 'consult_apply',
    }

    const field = fieldMap[event]
    if (!field) return

    if (res.data.length > 0) {
      await db.collection('conversion_metrics').doc(res.data[0]._id).update({
        data: {
          [field]: db.command.inc(1),
          updatedAt: ts,
        },
      })
    } else {
      const init = {
        date, stage,
        home_view: 0, insight_read: 0, challenge_start: 0, challenge_finish: 0,
        report_preview: 0, report_unlock_click: 0, payment_success: 0,
        membership_view: 0, membership_purchase: 0, consult_apply: 0,
        createdAt: ts, updatedAt: ts,
      }
      init[field] = 1
      await db.collection('conversion_metrics').add({ data: init })
    }
  } catch (_) {}
}

async function _computeRates(db, date) {
  try {
    const counts = await Promise.all(FUNNEL_EVENTS.map(e =>
      db.collection('funnel_events').where({ event: e.event, date }).count().then(r => r.total)
    ))

    const [home, insight, cStart, cFinish, report, unlock, pay, memView, memBuy, consult] = counts

    return {
      date,
      homeToInsight: _rate(insight, home),
      insightToChallenge: _rate(cStart, insight),
      challengeToFinish: _rate(cFinish, cStart),
      finishToReport: _rate(report, cFinish),
      reportToUnlock: _rate(unlock, report),
      unlockToPay: _rate(pay, unlock),
      payToMember: _rate(memBuy, pay),
      memberToConsult: _rate(consult, memBuy),
      raw: { home_view: home, insight_read: insight, challenge_start: cStart,
        challenge_finish: cFinish, report_preview: report, report_unlock_click: unlock,
        payment_success: pay, membership_purchase: memBuy, consult_apply: consult },
    }
  } catch (_) {
    return null
  }
}

function _rate(numerator, denominator) {
  if (!denominator || denominator === 0) return 0
  return Math.round((numerator / denominator) * 10000) / 100  // 百分比，保留2位小数
}

module.exports = {
  FUNNEL_EVENTS,
  EVENT_STAGE,
  EVENT_STEP,
  track,
  batchTrack,
  getFunnelState,
  getConversionRates,
  getBottleneck,
}
