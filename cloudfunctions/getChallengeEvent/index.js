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
const { resolvePersonalizedEvent, CANONICAL_TOTAL } = require('./lib/context/challengePersonalizationRuntime.js')

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

    // ── RC8_12 FREE_ONLY: free-3 trial paywall REMOVED ──────────────────
    // Trial records are simply records with fewer answered events; they advance
    // to the canonical completion like any other. No locked/needPayment is ever
    // returned. (No membership CTA, no price; legacy entitled records unaffected.)
    const answeredCount = (record.choices || []).length || record.currentEventIndex || 0

    // Canonical completion = exactly CANONICAL_TOTAL answered events (one authority).
    if (!isDiagnostic && answeredCount >= CANONICAL_TOTAL) {
      await db.collection('challenge_records').doc(record._id).update({
        data: { status: 'finished', finishedAt: record.finishedAt || Date.now(), updatedAt: Date.now() }
      }).catch(() => {})
      return ok({ finished: true, recordId, finalType: record.finalType, message: '挑战已完成，请查看结果' })
    }

    // ── RC8_10B: personalized selection (SINGLE authority, no repeats) ──
    // Primary path resolves the event from the user's REAL situation AND excludes
    // every already-answered event; on any failure we fall back to the legacy
    // day-ordered bank, which ALSO excludes seen events (never recycles).
    let ce = null
    let total = isDiagnostic ? diagLimit : CANONICAL_TOTAL
    const pr = await resolvePersonalizedEvent({ db, openid, record })
    if (!pr.fallback && !pr.exhausted && pr.event) {
      ce = pr.event
      total = isDiagnostic ? diagLimit : CANONICAL_TOTAL
      const filtered = (pr.filteredOut || [])
      if (filtered.length) {
        _logPersonalization('challenge_event_filtered', {
          count: filtered.length,
          reasonCodes: Array.from(new Set(filtered.map(f => f.reasonCode))),
          latencyMs: pr.latencyMs,
        })
      }
      _logPersonalization('challenge_personalization_success', {
        position: answeredCount + 1,
        total: total,
        domains: (pr.metrics && pr.metrics.domains) || [],
        filteredOutCount: filtered.length,
        personalizedRatio: pr.metrics && pr.metrics.personalizedRatio,
        latencyMs: pr.latencyMs,
      })
    } else if (!pr.fallback && pr.exhausted) {
      // Plan / bank genuinely exhausted (no UNSEEN event remains) → finish, never recycle.
      _logPersonalization('challenge_plan_exhausted', {
        position: answeredCount + 1,
        seenEventRejected: pr.seenEventRejected || null,
        latencyMs: pr.latencyMs,
      })
      await db.collection('challenge_records').doc(record._id).update({
        data: { status: 'finished', finishedAt: record.finishedAt || Date.now(), updatedAt: Date.now() }
      }).catch(() => {})
      return ok({ finished: true, recordId, finalType: record.finalType, message: '挑战已完成，请查看结果' })
    } else {
      _logPersonalization('challenge_personalization_fallback', {
        reasonCode: pr.reasonCode || 'UNKNOWN',
        position: answeredCount + 1,
        latencyMs: pr.latencyMs,
      })
      // Legacy day-ordered bank — STILL exclude seen events + canonical total (hard no-repeat).
      const seen = new Set((record.choices || []).map(c => c.eventId))
      const bankRes = await db.collection('challenge_events')
        .where({ status: 'active' })
        .orderBy('day', 'asc')
        .limit(100)
        .get()
      ce = (bankRes.data || []).find(e => !seen.has(e.eventId)) || null
      total = isDiagnostic ? diagLimit : CANONICAL_TOTAL
      if (!ce) {
        await db.collection('challenge_records').doc(record._id).update({
          data: { status: 'finished', finishedAt: record.finishedAt || Date.now(), updatedAt: Date.now() }
        }).catch(() => {})
        return ok({ finished: true, recordId, finalType: record.finalType, message: '挑战已完成，请查看结果' })
      }
    }

    if (!ce) return fail(CODES.NOT_FOUND, '题目已用完，恭喜完成挑战！')

    // 构造返回：不暴露 effects
    const choices = (ce.choices || []).map(c => ({
      key: c.key,
      text: c.text,
      tags: c.tags,
    }))

    return ok({
      finished: false,
      eventId: ce.eventId,
      day: ce.day,
      title: ce.title,
      description: ce.description,
      choices,
      difficulty: ce.difficulty,
      progress: {
        current: answeredCount + 1,
        total: total,
        day: ce.day,
      },
      trialMode: record.trialMode || false,
    })
  } catch (err) {
    console.error('[getChallengeEvent] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}
