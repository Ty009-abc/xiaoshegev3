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
const _ = db.command

const { ok, fail, CODES } = require('./lib/response.js')
const planAuthority = require('./lib/challengePlan.js')
const catalog = require('./lib/challengeEventCatalog.js')
const { buildPersonalizedPlan } = require('./lib/challengePersonalization.js')
const ucb = require('./lib/context/userContextBuilder.js')

// Conditional, conflict-safe persistence of a plan onto a record.
// Single-document conditional update (MongoDB per-doc atomic). The guard
// `planLocked != true` means: only the FIRST writer wins; a concurrent writer
// updates nothing (stats.updated === 0) and CONVERGES to the persisted plan.
// We never blind-overwrite an existing valid plan (no last-writer-wins).
async function _persistPlanConditional (db, record, plan) {
  const data = {
    plan, planVersion: plan.planVersion, planCreatedAt: plan.createdAt,
    planSource: plan.source, planLocked: true,
  }
  try {
    const r = await db.collection('challenge_records')
      .where({ _id: record._id, planLocked: _.neq(true) })
      .update({ data })
    const updated = (r && r.stats && (r.stats.updated || r.stats.modified)) || 0
    if (updated > 0) return { plan, persisted: true, converged: false }
  } catch (e) {
    // fall through to convergence check
  }
  // Someone else already locked/persisted → adopt the persisted plan (retry converges).
  try {
    const fresh = await db.collection('challenge_records').where({ _id: record._id }).limit(1).get()
    const fr = fresh.data[0]
    if (fr && planAuthority.hasPlan(fr) && planAuthority.validatePlan(fr.plan, fr).ok) {
      return { plan: fr.plan, persisted: true, converged: true }
    }
  } catch (_e) {}
  // Could not persist and nothing to converge on → use the freshly built plan
  // for THIS delivery only (do NOT clobber the record).
  return { plan, persisted: false, converged: false }
}

// 保障记录拥有一个不可变的 30 题计划：
//   - 结构有效 → 直接使用（绝不重建）
//   - 有历史答题（active legacy）→ recoverLegacyPlan：严格保留已答前缀，
//     未来题目绝不与已答事件相交；无法安全恢复 → 显式 UNRECOVERABLE
//   - 无历史 → 全新 buildPlan
//   - 持久化使用条件写（首个写入者胜出；并发重试收敛到已持久化计划）
async function _ensurePlan (db, openid, record) {
  if (planAuthority.hasPlan(record)) {
    const v = planAuthority.validatePlan(record.plan, record)
    if (v.ok) return { plan: record.plan, generated: false, recovered: false }
  }
  let ctx = {}
  try {
    ctx = await ucb.buildUserContext(db, openid, { scenario: 'career', message: '', memoryEnabled: true })
  } catch (_) { ctx = {} }

  const answered = (record.choices || []).map((c) => c && c.eventId).filter(Boolean)
  const hasHistory = answered.length > 0

  const res = hasHistory
    ? await planAuthority.recoverLegacyPlan({
        db, openid, record, ctx, buildPersonalizedPlan, eventMeta: catalog.EVENT_META,
      })
    : await planAuthority.buildPlan({
        // RC814 Phase 2 — the fresh-plan path must carry the same catalog scope as
        // the recovery path, otherwise a metadata-less historical row (GAME*) could
        // enter a brand-new plan.
        db, openid, record, ctx, buildPersonalizedPlan, eventMeta: catalog.EVENT_META,
      })

  if (res.status !== planAuthority.PLAN_STATUS.OK) {
    return {
      plan: null,
      status: res.status,
      reasonCode: res.reasonCode,
      eligibleCount: res.eligibleCount,
      required: res.required,
      recovered: hasHistory,
    }
  }
  const p = await _persistPlanConditional(db, record, res.plan)
  return { plan: p.plan, generated: true, recovered: hasHistory, persisted: p.persisted, converged: p.converged }
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
      if (ensured.status === planAuthority.PLAN_STATUS.UNRECOVERABLE) {
        // 历史答题无法安全恢复（如已答题目重复/溢出）——绝不静默重排或重发。
        return fail(CODES.DB_ERROR, '历史进度无法安全恢复，请联系客服', {
          code: 'LEGACY_PLAN_UNRECOVERABLE',
          reason: ensured.reasonCode || 'LEGACY_PLAN_UNRECOVERABLE',
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
