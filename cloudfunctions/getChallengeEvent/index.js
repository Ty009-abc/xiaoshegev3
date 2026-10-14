/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * getChallengeEvent 云函数
 *
 * 规则:
 *   1. 查询 challenge_records 获取 currentEventIndex
 *   2. 根据 currentEventIndex 取 challenge_events（按 sort 排序）
 *   3. trialMode 且 currentEventIndex >= 3 → need_payment
 *   4. 不返回 choices.effects 给前端
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const { resolvePersonalizedEvent } = require('./lib/context/challengePersonalizationRuntime.js')
const planAuthority = require('./lib/challengePlan.js')
const catalog = require('./lib/challengeEventCatalog.js')
const { buildPersonalizedPlan } = require('./lib/challengePersonalization.js')
const ucb = require('./lib/context/userContextBuilder.js')

// 保障记录拥有一个不可变的 30 题计划：
//   - 结构有效 → 直接使用（绝不重建）
//   - 缺失 → 显式生成（内存中，本次投递生效）
//   - 由 startChallenge 在开始时持久化；此处为防御性生成，避免重复发题。
async function _ensurePlan (db, openid, record) {
  if (planAuthority.hasPlan(record)) {
    const v = planAuthority.validatePlan(record.plan, record)
    if (v.ok) return { plan: record.plan, generated: false }
  }
  let ctx = {}
  try {
    ctx = await ucb.buildUserContext(db, openid, { scenario: 'career', message: '', memoryEnabled: true })
  } catch (_) { ctx = {} }
  const res = await planAuthority.buildPlan({
    db, openid, record, ctx, buildPersonalizedPlan,
  })
  if (res.status === planAuthority.PLAN_STATUS.OK) {
    // best-effort persist so subsequent requests reuse the same plan
    try {
      await db.collection('challenge_records').doc(record._id).update({
        data: { plan: res.plan, planVersion: res.plan.planVersion, planCreatedAt: res.plan.createdAt },
      })
    } catch (_) {}
    return { plan: res.plan, generated: true }
  }
  return { plan: null, status: res.status, reasonCode: res.reasonCode, eligibleCount: res.eligibleCount, required: res.required }
}

// RC8_10B observability — counts / reason codes / domain tags / latency ONLY.
// NEVER logs full 6Q, full memory, full prompt, or plaintext openid.
function _logPersonalization (evt, detail) {
  try { console.log('[challengePersonalization] ' + JSON.stringify(Object.assign({ event: evt }, detail || {}))) } catch (_) {}
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { recordId } = event
  if (!recordId) return fail(CODES.PARAM_ERROR, '缺少 recordId')

  console.log(`[getChallengeEvent] openid=${openid} recordId=${recordId}`)

  try {
    // 读取挑战记录
    const recordRes = await db.collection('challenge_records')
      .where({ recordId, openid })
      .limit(1)
      .get()

    const record = recordRes.data[0]
    if (!record) return fail(CODES.NOT_FOUND, '挑战记录不存在')

    const isDiagnostic = record.mode === 'diagnostic'
    const diagLimit = 6

    if (record.status === 'finished') {
      return ok({
        finished: true,
        recordId,
        finalType: record.finalType,
        message: '挑战已完成，请查看结果',
      })
    }

    // 诊断模式：6题上限 → 标记完成
    if (isDiagnostic && record.currentEventIndex >= diagLimit) {
      await db.collection('challenge_records').doc(record._id).update({
        data: { status: 'finished', finishedAt: Date.now(), updatedAt: Date.now() }
      }).catch(() => {})
      return ok({ finished: true, recordId, finalType: record.finalType || 'diagnostic_done', message: '诊断完成，请查看翻身策略报告' })
    }

    // trialMode 限制（非诊断模式）
    if (!isDiagnostic && record.trialMode && record.currentEventIndex >= 3) {
      return ok({
        recordId,
        locked: true,
        trialMode: true,
        needPayment: true,
        currentEventIndex: record.currentEventIndex,
        message: '免费体验已结束，付费后解锁完整30天挑战',
      })
    }

    // ── RC8_14_A: delivery is a pure lookup into the IMMUTABLE plan ──
    // The plan is the ONLY source of the served eventId. There is NO bank-skip
    // fallback — that was the repeat-producing path (PLAN_EXHAUSTED → bank.skip).
    const ensured = await _ensurePlan(db, openid, record)
    if (!ensured.plan) {
      if (ensured.status === planAuthority.PLAN_STATUS.INSUFFICIENT) {
        return fail(CODES.NEED_PAYMENT, '可用题目不足，无法开始完整挑战', {
          code: 'INSUFFICIENT_ELIGIBLE_EVENTS',
          eligibleCount: ensured.eligibleCount,
          required: ensured.required,
        })
      }
      return fail(CODES.DB_ERROR, '挑战计划不可用', { code: ensured.reasonCode || 'PLAN_UNAVAILABLE' })
    }

    const plan = ensured.plan
    const planTotal = plan.eventIds.length
    const idx = record.currentEventIndex || 0
    const serveId = planAuthority.eventIdAtIndex(plan, idx)
    // index beyond plan length → challenge is complete (NEVER re-serve / day-31)
    if (!serveId) {
      return ok({
        finished: true,
        recordId,
        finalType: record.finalType || '',
        progress: { current: planTotal, total: planTotal, day: planTotal },
        message: '挑战已完成，请查看结果',
      })
    }

    const eventsRes = await db.collection('challenge_events')
      .where({ eventId: serveId, status: 'active' })
      .limit(1)
      .get()
    const ce = eventsRes.data[0]
    if (!ce) return fail(CODES.DB_ERROR, '计划题目不存在', { code: 'PLANNED_EVENT_MISSING', eventId: serveId })

    const total = planTotal

    // 构造返回：不暴露 effects
    const choices = (ce.choices || []).map(c => ({
      key: c.key,
      text: c.text,
      tags: c.tags,
    }))

    // display day clamped to the challenge length — never Day 31
    const displayDay = Math.min((record.currentEventIndex || 0) + 1, planTotal)

    return ok({
      finished: false,
      eventId: ce.eventId,
      day: displayDay,
      title: ce.title,
      description: ce.description,
      choices,
      difficulty: ce.difficulty,
      progress: {
        current: (record.currentEventIndex || 0) + 1,
        total: total,
        day: displayDay,
      },
      planVersion: plan.planVersion,
      trialMode: record.trialMode || false,
      ...(record.trialMode ? { trialRemaining: Math.max(0, 3 - (record.currentEventIndex || 0)) } : {}),
    })
  } catch (err) {
    console.error('[getChallengeEvent] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
