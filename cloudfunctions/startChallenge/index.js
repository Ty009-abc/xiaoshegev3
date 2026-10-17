/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * startChallenge 云函数
 *
 * 职责:
 *   1. 权益权威判定（entitlements → memberships，不再只看会员等级）
 *   2. 已拥有挑战记录优先复用（trialMode === false 或 unlocked === true）
 *   3. 仅真正无权益用户才创建 trialMode=true 记录
 *
 * PAYMENT_STAGE5A_R6_CHALLENGE_ENTRY_AUTHORITY
 *   入口优先级（服务端权威，绝不信任客户端声明）:
 *     A. 已拥有记录（trialMode===false 或 unlocked===true），取最新
 *        → 存在且未 finished: 返回同一 recordId（resumed, completed=false）
 *        → 存在且 finished:   返回同一 recordId（resumed, completed=true, destination=challenge_result）
 *        两种情况都【不新建】任何记录。
 *     B. 无已拥有记录但持有 challenge_39_9 权益（entitlements.challenge_full）
 *        → 全新一轮只能以 entitled 身份开始（trialMode=false），绝不降级为 trial。
 *     C. 既无已拥有记录也无权益 → trialMode=true（免费前 3 题）。
 *
 * PAYMENT_STAGE5A_R10_7_EXPLICIT_REPLAY_CONTRACT
 *   显式「重新挑战一次」（OPTION_C：客户端直接调用服务端）：
 *     当 event.replay === true 时，走独立重放分支（优先于 A/B/C）：
 *       1. 认证 openid（已在上方）
 *       2. 校验 replayRequestId（replay=true 时必填）
 *       3. 服务端权威校验 challenge 权益（hasChallengeEntitlement）
 *          → 无权益：FAIL_CLOSED（不建 unlocked 记录、不授予权益、不触发支付）
 *       4. 幂等：同一 openid + replayRequestId 已存在 → 返回既有记录，不新建
 *       5. 新建一条【全新】unlocked 记录（trialMode=false / status=processing /
 *          currentEventIndex=0），使用既有 _buildRecord 初始化器（不复制旧数据）
 *   不变式：NORMAL_ENTRY (replay!==true) 语义完全不变。
 *   客户端 replay 标志仅为意图，服务端为唯一权威。
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const { ok, fail, CODES } = require('./lib/response.js')
const activeSession = require('./lib/activeSession.js')
const { hasChallengeEntitlement } = require('./lib/challengeEntitlement.js')
const planAuthority = require('./lib/challengePlan.js')
const catalog = require('./lib/challengeEventCatalog.js')
const { buildPersonalizedPlan } = require('./lib/challengePersonalization.js')
const ucb = require('./lib/context/userContextBuilder.js')
const now = () => Date.now()

// ════════════════════════════════════════════════════════════════════════
// RC814_STARTCHALLENGE_MODE_AUTHORITY
// ════════════════════════════════════════════════════════════════════════
// `mode` is a CLIENT-SUPPLIED field. It may only select among a closed
// allow-list of shapes the server knows how to honor; it must never influence
// *authority*.
//
// Before this guard, `mode === 'diagnostic'` did two dangerous things:
//   1. it derived `trialMode = false` — the exact marker the payment finalizer
//      writes for a PAID user. A free user could therefore mint a record whose
//      persisted shape claims paid status, defeating any consumer that treats
//      `trialMode === false` as "entitled".
//   2. it claimed the per-user READY session (challenge_active), so a later
//      normal start resolved to a non-challenge record and fail-closed forever
//      (WRONG_MODE → LEGACY_PLAN_UNRECOVERABLE) — an account lockout.
//
// Invariants enforced now:
//   - unknown / malformed mode  → 400 PARAM_ERROR, ZERO writes
//   - `trialMode` derives ONLY from the server-resolved entitlement
//     (`trialMode = !hasAccess`), never from `mode`
//   - diagnostic never claims the challenge READY session and never resumes as one
const START_MODE = Object.freeze({ DEFAULT: 'default', DIAGNOSTIC: 'diagnostic' })
const ALLOWED_START_MODES = new Set([START_MODE.DEFAULT, START_MODE.DIAGNOSTIC])

/**
 * Fail-closed mode resolver. Absent/empty ⇒ default (legacy clients send
 * nothing at all). Anything not exactly in the allow-list ⇒ null (reject).
 * @returns {string|null} canonical mode, or null when not allow-listed
 */
function resolveStartMode (raw) {
  if (raw === undefined || raw === null || raw === '') return START_MODE.DEFAULT
  if (typeof raw === 'string' && ALLOWED_START_MODES.has(raw)) return raw
  return null
}

// ── RC8_14_A: build an immutable, distinct 30-event plan BEFORE activation ──
// Fail-closed: if the eligible pool < challenge length, NO record is created and
// the caller maps the failure to INSUFFICIENT_ELIGIBLE_EVENTS (never partial/dup).
async function _buildPlanOrFail ({ db, openid, record, isDiagnostic }) {
  let ctx = {}
  try {
    ctx = await ucb.buildUserContext(db, openid, { scenario: 'career', message: '', memoryEnabled: true })
  } catch (_) { ctx = {} }
  const res = await planAuthority.buildPlan({
    db, openid, record, ctx, buildPersonalizedPlan,
  })
  if (res.status !== planAuthority.PLAN_STATUS.OK) {
    return {
      ok: false,
      code: res.status === planAuthority.PLAN_STATUS.INSUFFICIENT
        ? 'INSUFFICIENT_ELIGIBLE_EVENTS'
        : (res.reasonCode || 'PLAN_UNAVAILABLE'),
      eligibleCount: res.eligibleCount,
      required: res.required,
    }
  }
  return { ok: true, plan: res.plan }
}

const VIP_LEVELS = ['vip_month', 'vip_quarter', 'vip_year', 'svip', 'lifetime']

// 生成 recordId（接收请求级 ts，确保 recordId 时间戳与记录时间一致）
function genRecordId(ts) {
  const rnd = Math.random().toString(36).slice(2, 8)
  return `CR${ts}${rnd}`
}

const DEFAULT_INIT = {
  laborMindset: 0, probabilityMindset: 0, systemThinking: 0,
  leverageThinking: 0, capitalThinking: 0, riskAwareness: 0,
  informationSensitivity: 0, longTermism: 0, decisionStability: 0,
  cv: 0,
}

// ── 权益权威：entitlements(挑战权益) 优先；会员仅作快速路径（真正裁量在 permissionEngine）──
async function _resolveChallengeAccess(openid, ts) {
  let hasAccess = false

  // (1) 会员快速路径：仅在会员有效且权限含 challenge_unlock/challenge_full 时
  try {
    const memberRes = await db.collection('memberships')
      .where({ openid, status: 'active' })
      .limit(1)
      .get()
    const member = memberRes.data[0]
    if (member && (!member.expiredAt || member.expiredAt > ts)) {
      const perms = member.permissions || []
      if (perms.includes('challenge_unlock') || perms.includes('challenge_full')) hasAccess = true
    }
  } catch (_) {}

  // (2) 权威权益：entitlements / memberships 的 challenge_full（canonical permissionEngine）
  if (!hasAccess) {
    try { hasAccess = await hasChallengeEntitlement(db, openid) } catch (_) { hasAccess = false }
  }

  return hasAccess
}

// ════════════════════════════════════════════════════════════════════════
// RC8_14_D12 — TRIAL RESUME + ATOMIC ACTIVE-SESSION AUTHORITY
// ════════════════════════════════════════════════════════════════════════

// Resume response shape (kept compatible with the existing owned-record resume).
function _resumeStateFromRecord (record) {
  const trial = record.trialMode === true
  return ok({
    recordId: record.recordId,
    currentDay: record.currentDay,
    currentEventIndex: record.currentEventIndex,
    trialMode: trial,
    ...(trial ? {} : { unlocked: true }),
    mode: record.mode,
    scoringVersion: record.scoringVersion || 'normalized_v2',
    rawScores: record.rawScores,
    planVersion: record.planVersion,
    resumed: true,
    completed: false,
  })
}

// Day-3 trial boundary (mirrors getChallengeEvent's need_payment contract).
function _trialBoundaryResponse (record) {
  return ok({
    recordId: record.recordId,
    currentDay: record.currentDay,
    currentEventIndex: record.currentEventIndex,
    trialMode: true,
    locked: true,
    needPayment: true,
    mode: 'challenge',
    scoringVersion: record.scoringVersion || 'normalized_v2',
    rawScores: record.rawScores,
    planVersion: record.planVersion,
    resumed: true,
    completed: false,
  })
}

// Authoritative READY session (challenge_active) — the SINGLE source of truth
// for "which record is this user's active challenge". Never inferred from an
// ordinary challenge_records list scan.
async function _readReadySession (db, openid) {
  const s = await activeSession.readActive(db, openid)
  return (s && s.state === activeSession.CLAIM_STATE.READY && s.recordId) ? s : null
}

// ════════════════════════════════════════════════════════════════════════
// RC814_CHALLENGE_30DAY_DELIVERY — LEGACY PLAN RECOVERY (resume path)
// ════════════════════════════════════════════════════════════════════════
// A record created before the plan mechanism has no `plan`. Recovery ALIGNS a
// plan prefix with the answers already given and backfills the remainder from
// the eligible pool. It NEVER rewrites choices, rawScores, tags, currentEventIndex,
// trialMode, ownership, or reporting fields.
//
// Post-condition on success: record.plan/planVersion/planCreatedAt/planLocked are
// persisted (CAS: first writer wins), so getChallengeEvent and submitChallengeChoice
// afterwards read the SAME immutable plan. Idempotent: a second call adopts the
// persisted plan instead of building a different one.
//
// On any failure the record is left BYTE-IDENTICAL (no write), so progress is
// never destroyed — the caller surfaces a recoverable error instead.
async function _ensureLegacyPlan ({ db, openid, record }) {
  // Already planned (concurrent recovery won) → adopt, validate, never rebuild.
  if (planAuthority.hasPlan(record)) {
    const v = planAuthority.validatePlan(record.plan, record)
    if (v.ok) return { ok: true, plan: record.plan, recovered: false }
    return { ok: false, code: 'PLAN_INVALID', reason: v.reasonCode }
  }

  let ctx = {}
  try {
    ctx = await ucb.buildUserContext(db, openid, { scenario: 'career', message: '', memoryEnabled: true })
  } catch (_) { ctx = {} }

  const res = await planAuthority.recoverLegacyPlan({
    db, openid, record, ctx, buildPersonalizedPlan, eventMeta: catalog.EVENT_META,
  })
  if (res.status !== planAuthority.PLAN_STATUS.OK) {
    return {
      ok: false,
      code: res.status === planAuthority.PLAN_STATUS.INSUFFICIENT
        ? 'INSUFFICIENT_ELIGIBLE_EVENTS'
        : (res.reasonCode || 'LEGACY_PLAN_UNRECOVERABLE'),
      eligibleCount: res.eligibleCount,
      required: res.required,
    }
  }

  const plan = res.plan
  // Defence in depth: the recovered plan MUST keep the answered prefix intact.
  const answered = (record.choices || []).map((c) => c && c.eventId).filter(Boolean)
  for (let i = 0; i < answered.length; i++) {
    if (plan.eventIds[i] !== answered[i]) {
      return { ok: false, code: 'LEGACY_PREFIX_NOT_PRESERVED', reason: 'PREFIX_MISMATCH' }
    }
  }

  const data = {
    plan, planVersion: plan.planVersion, planCreatedAt: plan.createdAt,
    planSource: plan.source, planLocked: true, updatedAt: Date.now(),
  }
  // CAS: only the FIRST writer locks. A concurrent recovery that already locked
  // wins and we converge onto ITS plan (never last-writer-wins).
  try {
    const r = await db.collection('challenge_records')
      .where({ _id: record._id, planLocked: _.neq(true) })
      .update({ data })
    const updated = (r && r.stats && (r.stats.updated || r.stats.modified)) || 0
    if (updated > 0) {
      console.log(`[startChallenge] legacy plan recovered recordId=${record.recordId} len=${plan.eventIds.length}`)
      return { ok: true, plan, recovered: true }
    }
  } catch (_e) { /* fall through to convergence */ }

  try {
    const fresh = await db.collection('challenge_records').where({ _id: record._id }).limit(1).get()
    const fr = fresh.data[0]
    if (fr && planAuthority.hasPlan(fr.plan) && planAuthority.validatePlan(fr.plan, fr).ok) {
      return { ok: true, plan: fr.plan, recovered: true, converged: true }
    }
  } catch (_e) {}

  return { ok: false, code: 'PLAN_PERSIST_UNCONFIRMED', reason: 'CAS_LOST_NO_PLAN' }
}

// Resume / payment-boundary result for an owned trial record (shared by the
// explicit READY authority and by legacy scan selection). Recovers a legacy
// plan BEFORE resuming so downstream functions can serve/submit against it.
async function _trialResumeResult (record, hasAccess, openid) {
  if (!planAuthority.hasPlan(record)) {
    const rec = await _ensureLegacyPlan({ db, openid, record })
    if (!rec.ok) {
      return fail(CODES.DB_ERROR, '历史进度正在修复，请稍后重试', {
        code: rec.code || 'LEGACY_PLAN_UNRECOVERABLE',
        reason: rec.reason,
        eligibleCount: rec.eligibleCount,
        required: rec.required,
        retryable: rec.code === 'PLAN_PERSIST_UNCONFIRMED',
      })
    }
    record = Object.assign({}, record, { plan: rec.plan, planVersion: rec.plan.planVersion })
  }
  if (record.trialMode && !hasAccess && (record.currentEventIndex || 0) >= activeSession.TRIAL_LIMIT) {
    console.log(`[startChallenge] trial boundary reached recordId=${record.recordId}`)
    return _trialBoundaryResponse(record)
  }
  console.log(`[startChallenge] resume record recordId=${record.recordId} idx=${record.currentEventIndex}`)
  return _resumeStateFromRecord(record)
}

// Finalize an ACTIVE claim into a concrete record and mark the session READY.
// Deterministic identity = session._id (=openid); at most one record per claim.
// Fencing: a stale creator (lease stolen while it was paused) MUST abort before
// insertion (pre-insert fence) so it can never create an independently
// authoritative orphan record. Success is reported ONLY when the session is
// confirmed to be READY and pointing at our exact recordId.
async function _finishCreate ({ db, openid, ts, token, creationId, trialMode, mode, isDiagnostic }) {
  const entitled = !trialMode && !isDiagnostic
  // Prefer the claim's DETERMINISTIC creation identity (stable across lease
  // takeover) so retries/concurrent identical attempts converge on ONE record.
  const recordId = creationId || genRecordId(ts)
  const record = _buildRecord({ recordId, openid, ts, trialMode, mode, extra: entitled ? { unlocked: true } : {} })
  // Bind the DETERMINISTIC identity to the document `_id` so uniqueness is
  // enforced by the database: a duplicate key means the SAME logical creation
  // already committed. (recordId is also kept as a field for lookups.)
  record._id = recordId
  const planned = await _buildPlanOrFail({ db, openid, record, isDiagnostic })
  if (!planned.ok) {
    await activeSession.release({ db, openid, token })
    return fail(CODES.NEED_PAYMENT, entitled ? '可用题目不足，暂无法开启完整挑战' : '可用题目不足，暂无法开启挑战', {
      code: 'INSUFFICIENT_ELIGIBLE_EVENTS', eligibleCount: planned.eligibleCount, required: planned.required,
    })
  }
  record.plan = planned.plan
  record.planVersion = planned.plan.planVersion
  record.planCreatedAt = planned.plan.createdAt

  // Pre-insert fence: if we were superseded while building, do NOT insert.
  if (!(await activeSession.stillClaiming({ db, openid, token }))) {
    const conv = await activeSession.converge({ db, openid })
    if (conv) return _resumeStateFromRecord(conv.record)
    return fail(CODES.SERVER_ERROR, '并发开始冲突，请重试', { code: 'CONCURRENT_START_CONFLICT' })
  }

  try {
    await db.collection('challenge_records').add({ data: record })
  } catch (e) {
    // Duplicate key on our deterministic `_id` means the SAME logical creation
    // already committed (uncertain earlier commit / concurrent identical
    // attempt) → reconcile NON-destructively on that exact record.
    const dup = await activeSession.loadRecord(db, openid, recordId)
    if (!dup) {
      await activeSession.release({ db, openid, token })
      return fail(CODES.DB_ERROR, e.message)
    }
  }

  // Finalize with BOUNDED markReady retries. Success is reported ONLY when the
  // session is CONFIRMED READY and pointing at exactly our recordId.
  let confirmed = false
  for (let i = 0; i < 3 && !confirmed; i++) {
    await activeSession.markReady({ db, openid, token, recordId, now: ts })
    confirmed = await activeSession.isAuthoritative({ db, openid, token, recordId })
  }
  if (confirmed) {
    return ok({
      recordId, currentDay: 1, currentEventIndex: 0, trialMode,
      ...(entitled ? { unlocked: true } : {}),
      mode, scoringVersion: 'normalized_v2', rawScores: { ...DEFAULT_INIT },
      planVersion: planned.plan.planVersion,
      ...(trialMode ? { trialLimit: 3 } : {}),
    })
  }

  // Unconfirmed. NEVER delete: a READY session may already point at this record
  // (that was the R2.4 P0). Our record is authoritative ONLY if markReady
  // (fenced CAS) set the READY pointer; otherwise it is a RECOVERABLE PENDING
  // record. Converge on the winner if one exists (its markReady won the CAS),
  // else surface a recoverable-failure (retry is idempotent on the identity).
  const conv = await activeSession.converge({ db, openid })
  if (conv) return _resumeStateFromRecord(conv.record)
  return fail(CODES.SERVER_ERROR, '开始请求未确认，请重试', { code: 'START_UNCONFIRMED_RECOVERABLE', retryable: true })
}

// Atomically acquire the create token, then finalize. Losers converge on the
// winner's READY record instead of creating.
async function _createViaClaim ({ db, openid, ts, trialMode, mode, isDiagnostic }) {
  const cl = await activeSession.claim({ db, openid, now: ts })
  if (cl.won) return await _finishCreate({ db, openid, ts, token: cl.token, creationId: cl.creationId, trialMode, mode, isDiagnostic })
  const conv = await activeSession.converge({ db, openid })
  if (conv) {
    console.log(`[startChallenge] concurrent start converged recordId=${conv.record.recordId}`)
    return _resumeStateFromRecord(conv.record)
  }
  return fail(CODES.SERVER_ERROR, '并发开始冲突，请重试', { code: 'CONCURRENT_START_CONFLICT' })
}

/**
 * For a FREE (no-entitlement) user with NO READY authority and NO owned record:
 * reuse an existing ACTIVE trial record (legacy scan) instead of creating one.
 * Returns:
 *   - resume response (valid active trial, idx 0..2)
 *   - payment-boundary response (idx >= 3 — never create another free trial)
 *   - fail(UNRECOVERABLE) when only malformed active trials exist
 *   - null when there is no active trial (caller falls through to create)
 */
async function _resumeTrialOrBoundary ({ db, openid, hasAccess }) {
  let rows = []
  try {
    const r = await db.collection('challenge_records')
      .where({ openid, mode: 'challenge', trialMode: true, status: _.neq('finished') })
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()
    rows = r.data || []
  } catch (_e) { rows = [] }
  if (!rows.length) return null

  const sel = activeSession.selectResumable(rows, { hasAccess })
  if (sel.action === activeSession.ACTIONS.RESUME || sel.action === activeSession.ACTIONS.NEED_PAYMENT) {
    // Recover the legacy plan (if any) BEFORE resuming/boundary so every
    // downstream function reads one immutable plan. Failures write nothing.
    return await _trialResumeResult(sel.record, hasAccess, openid)
  }
  if (sel.action === activeSession.ACTIONS.UNRECOVERABLE) {
    // Malformed active trial(s): refuse — never silently reset and never
    // grant another free trial.
    return fail(CODES.DB_ERROR, '历史进度无法安全恢复，请联系客服', {
      code: 'LEGACY_PLAN_UNRECOVERABLE',
      reason: sel.reason,
    })
  }
  return null
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  // 请求级时间戳 —— 同一个请求内所有时间字段使用同一个 ts
  const ts = now()

  const { replay = false, replayRequestId = '', replaySource = '' } = event

  // ── RC814_STARTCHALLENGE_MODE_AUTHORITY: server-side mode allow-list ──
  // Reject unknown/malformed mode BEFORE any DB access: zero writes, zero
  // session claim, zero record creation. Never echo the offending value back.
  const resolvedMode = resolveStartMode(event.mode)
  if (resolvedMode === null) {
    console.warn('[startChallenge] rejected unsupported mode')
    return fail(CODES.PARAM_ERROR, '不支持的启动模式')
  }
  const mode = resolvedMode
  const isDiagnostic = mode === START_MODE.DIAGNOSTIC

  try {
    const userRes = await db.collection('users').where({ openid }).limit(1).get()
    if (!userRes.data[0]) return fail(CODES.AUTH_FAILED, '用户不存在')

    // ── R10.7 显式重放分支（OPTION_C）——优先于常规入口 A/B/C ──
    // 仅 challenge 模式支持；客户端 replay 仅为意图，权益由服务端权威判定。
    if (replay === true && !isDiagnostic) {
      return await _handleExplicitReplay({ db, openid, ts, replayRequestId, replaySource })
    }

    // 服务端权威权益（一次性解析，后续复用）
    // RC814_STARTCHALLENGE_MODE_AUTHORITY: trialMode is derived ONLY from the
    // server-resolved entitlement. `mode` can no longer inject `trialMode=false`
    // (the paid marker) for a free user.
    const hasAccess = await _resolveChallengeAccess(openid, ts)
    const trialMode = !hasAccess

    // ── A. 已拥有记录优先（trialMode===false 或 unlocked===true，取最新）──
    if (!isDiagnostic) {
      let owned = null

      // A1：trialMode === false（支付 finalizer 写入的解锁权威）
      const ownedRes = await db.collection('challenge_records')
        .where({ openid, mode: 'challenge', trialMode: false })
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()
      owned = ownedRes.data[0] || null

      // A2：兜底 unlocked === true（字段/旧数据形态）
      if (!owned) {
        const ownedRes2 = await db.collection('challenge_records')
          .where({ openid, mode: 'challenge', unlocked: true })
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get()
        owned = ownedRes2.data[0] || null
      }

      if (owned) {
        if (owned.status !== 'finished') {
          // 未完成 → 续玩同一记录
          // RC814_CHALLENGE_30DAY_DELIVERY: an OWNED record can also predate the
          // plan mechanism. Recover it here too (same fail-closed contract) so
          // every entry point converges on ONE immutable plan. Failure writes
          // nothing and never touches progress.
          if (!planAuthority.hasPlan(owned)) {
            const rec = await _ensureLegacyPlan({ db, openid, record: owned })
            if (!rec.ok) {
              return fail(CODES.DB_ERROR, '历史进度正在修复，请稍后重试', {
                code: rec.code || 'LEGACY_PLAN_UNRECOVERABLE',
                reason: rec.reason,
                eligibleCount: rec.eligibleCount,
                required: rec.required,
                retryable: rec.code === 'PLAN_PERSIST_UNCONFIRMED',
              })
            }
            owned = Object.assign({}, owned, { plan: rec.plan, planVersion: rec.plan.planVersion })
          }
          console.log(`[startChallenge] resume owned record recordId=${owned.recordId}`)
          return ok({
            recordId: owned.recordId,
            currentDay: owned.currentDay,
            currentEventIndex: owned.currentEventIndex,
            trialMode: false,
            unlocked: true,
            mode: 'challenge',
            scoringVersion: owned.scoringVersion || 'normalized_v2',
            rawScores: owned.rawScores,
            planVersion: owned.planVersion,
            resumed: true,
            completed: false,
          })
        }
        // 已完成 → 返回同一记录并路由到结果页（不新建、不 trial）
        console.log(`[startChallenge] owned record finished → route result recordId=${owned.recordId}`)
        return ok({
          recordId: owned.recordId,
          currentDay: owned.currentDay,
          currentEventIndex: owned.currentEventIndex,
          trialMode: false,
          unlocked: true,
          mode: 'challenge',
          scoringVersion: owned.scoringVersion || 'normalized_v2',
          rawScores: owned.rawScores,
          finalType: owned.finalType || '',
          resumed: true,
          completed: true,
          destination: 'challenge_result',
        })
      }

      // ── A0. challenge_active READY 是用户活跃会话的唯一权威 ──
      // 绝不因普通 challenge_records 列表扫描未命中而判定其无效（B1 重复窗口修复）。
      const ready = await _readReadySession(db, openid)
      if (ready) {
        // 按 recordId + openid 精确校验被指记录。
        // 用 strict 变体：读取**出错**（暂时不可读）→ fail-closed，绝不当成“缺失”而失效 READY。
        let rec
        try {
          rec = await activeSession.loadRecordStrict(db, openid, ready.recordId)
        } catch (_e) {
          return fail(CODES.DB_ERROR, '暂时无法读取当前进度，请重试', { code: 'ACTIVE_TARGET_UNREADABLE' })
        }
        if (rec && rec.status !== 'finished') {
          const v = activeSession.validateCandidate(rec)
          if (v.ok) return await _trialResumeResult(rec, hasAccess, openid)
          // 畸形目标 → fail-closed（未证明可安全恢复前不新建/不重认领）。
          return fail(CODES.DB_ERROR, '历史进度无法安全恢复，请联系客服', {
            code: 'LEGACY_PLAN_UNRECOVERABLE', reason: v.reason,
          })
        }
        if (rec && rec.status === 'finished') {
          // 已完成目标 → 路由结果页，绝不新建/重认领。
          return ok({
            recordId: rec.recordId, currentDay: rec.currentDay, currentEventIndex: rec.currentEventIndex,
            trialMode: rec.trialMode === true, ...(rec.trialMode === true ? {} : { unlocked: true }),
            mode: 'challenge', scoringVersion: rec.scoringVersion || 'normalized_v2', rawScores: rec.rawScores,
            finalType: rec.finalType || '', resumed: true, completed: true, destination: 'challenge_result',
          })
        }
        // 目标缺失/非本人：先尝试**非新建**地重指向另一条自有有效记录；
        // 否则经 CAS 显式失效（reclaimInvalid）后方可新建。
        let reconRecord = null
        try {
          const rr = await db.collection('challenge_records')
            .where({ openid, mode: 'challenge', status: _.neq('finished') })
            .orderBy('createdAt', 'desc').limit(20).get()
          const sel = activeSession.selectResumable(rr.data || [], { hasAccess })
          if (sel.action === activeSession.ACTIONS.RESUME || sel.action === activeSession.ACTIONS.NEED_PAYMENT) reconRecord = sel.record
        } catch (_e) {}
        if (reconRecord) {
          await activeSession.reconcileReady({ db, openid, expectedToken: ready.ownerToken, expectedRecordId: ready.recordId, recordId: reconRecord.recordId })
          return await _trialResumeResult(reconRecord, hasAccess, openid)
        }
        const rl = await activeSession.reclaimInvalid({ db, openid, expectedRecordId: ready.recordId, expectedToken: ready.ownerToken, now: ts })
        if (rl.won) return await _finishCreate({ db, openid, ts, token: rl.token, trialMode, mode: 'challenge', isDiagnostic: false })
        const conv = await activeSession.converge({ db, openid })
        if (conv) return _resumeStateFromRecord(conv.record)
        return fail(CODES.SERVER_ERROR, '并发开始冲突，请重试', { code: 'CONCURRENT_START_CONFLICT' })
      }

      // ── B. 无 READY、无 owned：持有权益 → entitled 新一轮（原子认领，并发收敛）──
      if (hasAccess) {
        return await _createViaClaim({ db, openid, ts, trialMode: false, mode: 'challenge', isDiagnostic: false })
      }

      // ── A1. 无 READY、无 owned、免费：legacy 活跃试用扫描（不创建）──
      // 复用而非新建；到达 Day-3 边界返回支付门槛；畸形活跃记录显式拒绝。
      const resumedTrial = await _resumeTrialOrBoundary({ db, openid, hasAccess })
      if (resumedTrial) return resumedTrial
    }

    // ── C. 无任何可复用 → 新建 trial / diagnostic ──
    // RC814_STARTCHALLENGE_MODE_AUTHORITY: a diagnostic record is NOT a challenge
    // session. It must never claim the per-user READY pointer (that would later
    // resolve to a non-challenge record and lock the account out), so it is
    // created directly with no session claim.
    if (isDiagnostic) {
      const recordId = genRecordId(ts)
      const record = _buildRecord({ recordId, openid, ts, trialMode, mode: START_MODE.DIAGNOSTIC, extra: {} })
      record._id = recordId
      const planned = await _buildPlanOrFail({ db, openid, record, isDiagnostic: true })
      if (!planned.ok) {
        // Preserve the pre-existing contract for this (practically unreachable)
        // branch: the diagnosis needs only 6 events from a 30-event bank.
        return fail(CODES.NEED_PAYMENT, '可用题目不足，暂无法开启诊断', {
          code: 'INSUFFICIENT_ELIGIBLE_EVENTS', eligibleCount: planned.eligibleCount, required: planned.required,
        })
      }
      record.plan = planned.plan
      record.planVersion = planned.plan.planVersion
      record.planCreatedAt = planned.plan.createdAt
      try {
        await db.collection('challenge_records').add({ data: record })
      } catch (e) {
        const dup = await activeSession.loadRecord(db, openid, recordId)
        if (!dup) return fail(CODES.DB_ERROR, e.message)
      }
      console.log(`[startChallenge] diagnostic created recordId=${recordId}`)
      return ok({
        recordId, currentDay: 1, currentEventIndex: 0, trialMode,
        mode: START_MODE.DIAGNOSTIC, scoringVersion: 'normalized_v2', rawScores: { ...DEFAULT_INIT },
        planVersion: planned.plan.planVersion,
        ...(trialMode ? { trialLimit: 3 } : {}),
      })
    }
    return await _createViaClaim({
      db, openid, ts, trialMode,
      mode: 'challenge',
      isDiagnostic: false,
    })
  } catch (err) {
    console.error('[startChallenge] 异常:', err)
    return fail(CODES.DB_ERROR, err.message)
  }
}

function _buildRecord({ recordId, openid, ts, trialMode, mode, extra }) {
  return {
    recordId,
    openid,
    currentDay: 1,
    currentEventIndex: 0,
    status: 'processing',
    rawScores: { ...DEFAULT_INIT },
    scoringVersion: 'normalized_v2',
    choices: [],
    tags: [],
    finalType: '',
    trialMode,
    mode,
    startedAt: ts,
    finishedAt: null,
    createdAt: ts,
    updatedAt: ts,
    ...(extra || {}),
  }
}

/**
 * R10.7 —— 显式重放（OPTION_C）：为「已拥有权益」用户创建一轮【全新】解锁挑战。
 * 不触碰支付/权益写入/旧记录/旧报告；非权益用户 fail-closed。幂等按 replayRequestId。
 *
 * @returns {Promise<object>} ok(...) | fail(...)
 */
async function _handleExplicitReplay ({ db, openid, ts, replayRequestId, replaySource }) {
  // 1) 校验 replayRequestId（必填）
  if (!replayRequestId || typeof replayRequestId !== 'string' || !replayRequestId.trim()) {
    return fail(CODES.PARAM_ERROR, '缺少 replayRequestId')
  }
  const rid = replayRequestId.trim()

  // 2) 服务端权威权益校验（绝不信任客户端 unlocked/trialMode/membership 声明）
  const entitled = await _resolveChallengeAccess(openid, ts)
  if (!entitled) {
    // fail-closed：不建 unlocked 记录、不授予权益、不触发支付
    console.warn(`[startChallenge] replay denied (no entitlement) openid=${openid}`)
    return fail(CODES.NEED_PAYMENT, '当前账号暂无挑战权益，无法开启新一轮')
  }

  // 3) 幂等：同一 openid + replayRequestId 已存在 → 返回既有记录，不新建
  const existingRes = await db.collection('challenge_records')
    .where({ openid, replayRequestId: rid })
    .limit(1)
    .get()
  const existing = existingRes.data[0]
  if (existing) {
    console.log(`[startChallenge] replay idempotent hit recordId=${existing.recordId} rid=${rid}`)
    return ok({
      recordId: existing.recordId,
      currentDay: existing.currentDay,
      currentEventIndex: existing.currentEventIndex,
      trialMode: false,
      unlocked: true,
      mode: 'challenge',
      scoringVersion: existing.scoringVersion || 'normalized_v2',
      rawScores: existing.rawScores,
      replay: true,
      replayed: true,
      idempotent: true,
    })
  }

  // 4) 新建一轮全新 unlocked 记录（复用既有初始化器，绝不复制旧数据/旧答案/旧报告）
  const recordId = genRecordId(ts)
  const record = _buildRecord({
    recordId,
    openid,
    ts,
    trialMode: false,
    mode: 'challenge',
    extra: {
      unlocked: true,
      replayRequestId: rid,
      replaySource: replaySource || 'world_model_report',
      replayAt: ts,
    },
  })
  const planned = await _buildPlanOrFail({ db, openid, record, isDiagnostic: false })
  if (!planned.ok) {
    // fail-closed：未创建记录、未消耗权益
    return fail(CODES.NEED_PAYMENT, '可用题目不足，暂无法开启新一轮挑战', {
      code: 'INSUFFICIENT_ELIGIBLE_EVENTS',
      eligibleCount: planned.eligibleCount,
      required: planned.required,
    })
  }
  record.plan = planned.plan
  record.planVersion = planned.plan.planVersion
  record.planCreatedAt = planned.plan.createdAt
  await db.collection('challenge_records').add({ data: record })
  console.log(`[startChallenge] replay created new record recordId=${recordId} rid=${rid}`)

  return ok({
    recordId,
    currentDay: 1,
    currentEventIndex: 0,
    trialMode: false,
    unlocked: true,
    mode: 'challenge',
    scoringVersion: 'normalized_v2',
    rawScores: { ...DEFAULT_INIT },
    replay: true,
    replayRequestId: rid,
    planVersion: planned.plan.planVersion,
  })
}
