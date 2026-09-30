/**
 * challengeReportIdempotency.js — PAYMENT_STAGE5C
 *
 * Exactly-one logical report per (openid, recordId, type='challenge_final').
 *
 * ── Atomicity primitive ─────────────────────────────────────────────────────
 * The `ai_reports` collection carries MongoDB's built-in UNIQUE index on `_id`
 * (verified live: duplicate `_id` insert → E11000). We therefore make the
 * document `_id` (and the `reportId` field) a DETERMINISTIC function of the
 * logical report key. The insert itself becomes the atomic claim:
 *
 *     first writer  → add(_id = logicalId) SUCCEEDS   → owns generation right
 *     every racer   → add(_id = logicalId) E11000     → reads the winner's state
 *
 * No `where → add` race window, no client-side dedup. No new index, collection,
 * permission or env var is introduced (the `_id_` index already exists).
 *
 * ── State machine (one entity, reused across retries) ───────────────────────
 *     (absent)  --claim-->  generating  --ok-->   ready
 *                              |  \--fail-->      failed  --reclaim--> generating
 *                              \--stale-->       takeover (same entity)
 *
 * Every transition after the claim is a CONDITIONAL update guarded by the
 * caller's `claimToken` (and, for takeover, the observed `claimAt`). A writer
 * that lost its claim (stale takeover) can therefore never overwrite the newer
 * result — `stats.updated === 1` is the single-winner proof.
 *
 * ── AI / transaction invariant ──────────────────────────────────────────────
 * The AI network call happens BETWEEN claim and completion — never inside a DB
 * transaction. Completion is a separate conditional update.
 *
 * ── Completion durability (PAYMENT_STAGE5A_R4_P0_REPORT_RECOVERY) ────────────
 * Everything AFTER a successful model response is protected:
 *     model ok → parse (tolerant) → validate → persist content → ready → audit
 * Any recoverable failure is persisted as an EXPLICIT terminal-ish state on the
 * SAME entity (status='failed' + lastError), reusing the SAME deterministic
 * reportId. The entity therefore never remains permanently stuck at
 * `status='generating', content=null`: a later retry/re-entry reclaims it
 * (failed-retry path) or takes it over once stale. The parse step never throws;
 * an unparseable body becomes an explicit retryable failure. Persistence/parse
 * failures are audited best-effort to `ai_logs`. Generation still NEVER writes
 * `isPaid`.
 *
 * ── Paid authority (do NOT assume ai_reports.isPaid) ────────────────────────
 * Generation NEVER writes `isPaid`. The field is owned exclusively by the
 * exactly-once payment finalizer (`common/entitlement.js`,
 * `verifyPayment/lib/entitlementService.js`) and is written only for the
 * purchased reportId. Read-time entitlement is derived from the authoritative
 * membership check (`checkVip` → `memberships` active & unexpired) OR the
 * report's own finalizer-written `isPaid`. Unpaid readers never receive the
 * body; paid reloads do.
 */

const crypto = require('crypto')
const { ok, fail, CODES } = require('./response.js')
// PAYMENT_STAGE5A_R8_P0 — 唯一权威「完整报告查看权限」判定（report.isPaid || VIP）。
// RC8_10_P0 — 追加永久 report_9_9 产品权益通道（一次购买·永久解锁）。
// 绝不用 membership-only 权限去覆盖 report.isPaid / report_9_9 权益。
const { canAccessFullReport, reportAccessFields } = require('./reportAccess.js')
const { hasReport9_9Entitlement } = require('./reportEntitlement.js')

// 解析永久 report_9_9 权益（可按需注入 deps.hasReport9_9 以便测试）。
async function resolveReport9_9 (db, openid, deps) {
  const fn = (deps && deps.hasReport9_9) || hasReport9_9Entitlement
  try { return (await fn(db, openid)) === true } catch (_) { return false }
}

// Stale-generation takeover window. A `generating` entity older than this is
// considered abandoned (λ killed mid-AI) and may be re-claimed, reusing the
// SAME entity — no permanent stall, no duplicate.
const DEFAULT_STALE_MS = 90 * 1000

// Hard cap on the AI provider call FROM INSIDE the idempotent flow. Kept
// strictly below the cloud-function timeout so parse + persist + audit always
// have budget even if the model is slow. Deployment invariant: model 90s <
// function timeout 120s (>=30s reserved).
const MODEL_TIMEOUT_MS = 90 * 1000

// ── deterministic logical report id ─────────────────────────────────────────
// Pure function of the trusted server identity + record. Same key → same id.
function logicalReportId (openid, recordId) {
  const h = crypto
    .createHash('sha1')
    .update(String(openid) + '|' + String(recordId) + '|challenge_final')
    .digest('hex')
    .slice(0, 24)
  return 'ARCF' + h
}

function newClaimToken () {
  return crypto.randomBytes(12).toString('hex')
}

function isDuplicateKey (err) {
  if (!err) return false
  if (err.errCode === -502001 || err.code === -502001) return true
  return /duplicate key|E11000|-502001/i.test(String(err.message || err.errMsg || ''))
}

// ── tolerant input coercion ─────────────────────────────────────────────────
// The provider body is normally a string, but a defensive caller could hand us
// an object/array/null. Coerce to a string so `.replace` can NEVER throw.
function coerceText (value) {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  try { return JSON.stringify(value) } catch (_) { return String(value) }
}

// ── tolerant AI JSON cleaning (identical JSON semantics to the legacy branch) ─
// Returns { ok:true, value } on success, or { ok:false, error, raw } on a
// NON-RETRYABLE-parse body. NEVER throws. A parse failure is surfaced as an
// explicit failure by the caller (persisted) rather than fabricating content.
function parseAiReport (aiContent) {
  const content = coerceText(aiContent)
  try {
    let jsonStr = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()
    const bracketMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (bracketMatch) jsonStr = bracketMatch[0]
    jsonStr = jsonStr.replace(/\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1')
    const obj = JSON.parse(jsonStr)
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('解析结果不是 JSON 对象')
    }
    return { ok: true, value: obj }
  } catch (parseErr) {
    console.error('【challenge_final JSON清洗失败】错误:', parseErr && parseErr.message)
    console.error('【challenge_final 原始AI返回】:', content.substring(0, 800))
    return {
      ok: false,
      error: String((parseErr && parseErr.message) || 'JSON 解析失败'),
      raw: content.substring(0, 800),
    }
  }
}

// ── bounded provider-call guard ─────────────────────────────────────────────
// Races the AI promise against a hard timer so the idempotent flow can never
// out-wait the cloud-function budget. The underlying provider call is NOT
// cancelled (http timeout still applies) — we simply stop waiting on it and
// persist an explicit failure, so the entity is recoverable on retry.
function withTimeout (promise, ms, fallback) {
  if (!ms || ms <= 0) return Promise.resolve(promise)
  let timer
  const guard = new Promise((resolve) => {
    timer = setTimeout(() => resolve(typeof fallback === 'function' ? fallback() : fallback), ms)
  })
  return Promise.race([promise, guard]).then(
    (v) => { clearTimeout(timer); return v },
    (e) => { clearTimeout(timer); throw e }
  )
}

async function safeUpdate (db, where, data) {
  try {
    const res = await db.collection('ai_reports').where(where).update({ data })
    return !!(res && res.stats && res.stats.updated === 1)
  } catch (_) {
    return false
  }
}

// Persist an explicit `failed` (retryable) terminal state. Never throws, NEVER
// writes `isPaid`. Only touches a row we still own (claimToken) — so a stale
// writer can never clobber a newer takeover's in-flight generation.
async function persistFailed (db, reportId, claimToken, message, extra, ts) {
  const data = Object.assign({
    status: 'failed',
    lastError: String(message || '生成失败').substring(0, 200),
    updatedAt: ts,
  }, extra || {})
  if (await safeUpdate(db, { _id: reportId, claimToken, status: 'generating' }, data)) return true
  // status field may have drifted but we still own the token → force by _id
  const cur = await readEntity(db, reportId).catch(() => null)
  if (cur && cur.status === 'generating' && cur.claimToken === claimToken) {
    return await safeUpdate(db, { _id: reportId, claimToken }, data)
  }
  return false
}

// Best-effort completion audit — never throws, never affects the flow.
async function auditCompletion (db, row) {
  try { await db.collection('ai_logs').add({ data: row }) } catch (_) { /* best effort */ }
}

async function readEntity (db, reportId) {
  const res = await db.collection('ai_reports').where({ reportId }).limit(1).get()
  return res && res.data && res.data[0] ? res.data[0] : null
}

// Entitlement is derived from the SERVER authority, never from the client.
// canonical: report.isPaid (single-purchase) OR membership/VIP (checkVip).
// report.isPaid is NEVER overridden by membershipLevel='free'.
async function isEntitled (db, openid, entity, checkVip, deps) {
  const vip = await checkVip(db, openid)
  const owned9_9 = await resolveReport9_9(db, openid, deps)
  return canAccessFullReport(entity, vip === true, owned9_9)
}

// Response for an already-materialised (ready) entity. Preserves the existing
// response shape + summary semantics exactly.
async function respondReady (db, openid, entity, checkVip, deps) {
  const vip = await checkVip(db, openid)
  const owned9_9 = await resolveReport9_9(db, openid, deps)
  const access = reportAccessFields(entity, vip === true, owned9_9)
  if (access.canViewFullReport) {
    return ok({
      reportId: entity.reportId,
      reportType: 'challenge_final',
      isPaid: true,
      locked: false,
      canViewFullReport: true,
      content: entity.content || {},
    })
  }
  const c = entity.content || {}
  return ok({
    reportId: entity.reportId,
    isPaid: false,
    locked: true,
    canViewFullReport: false,
    summary: {
      oneSentence: c.oneSentence || '',
      worldModelType: c.worldModelType || '',
      turnaroundProbability: c.turnaroundProbability || 0,
    },
    preview: '完整报告需解锁认知操作系统会员或单独购买。',
  })
}

// In-progress response: explicit status, NEVER an incomplete body.
function respondGenerating (reportId) {
  return ok({
    reportId,
    reportType: 'challenge_final',
    status: 'generating',
    isPaid: false,
    locked: true,
    preview: '报告正在生成中，请稍候。',
  })
}

// Extract the pre-claim input snapshot (scores/tags/choices) from the owned
// challenge record — same derivation as the legacy branch.
function buildInputs (record) {
  let scores = record.scores || {}
  const rawScoresRef = record.rawScores || null
  const scoringVer = record.scoringVersion || 'legacy_v1'
  const tags = record.tags || []
  let choicesSummary = ''
  if (record.choices && record.choices.length) {
    choicesSummary = record.choices
      .map((c, i) => `${i + 1}. [${c.choice}] ${c.choiceText || ''}`)
      .join('\n')
  }
  if (rawScoresRef) {
    try {
      const { normalizeScores } = require('./scoring.js')
      scores = normalizeScores(rawScoresRef)
    } catch (_) { /* fallback to record.scores */ }
  }
  return { scores, tags, choicesSummary, rawScoresRef, scoringVer }
}

/**
 * runChallengeFinalReport — idempotent challenge_final report generation.
 *
 * @param {object} opts
 * @param {object} opts.db      cloud DB handle
 * @param {string} opts.openid  TRUSTED server identity (wxContext.OPENID)
 * @param {object} opts.event   request event (recordId etc.)
 * @param {number} opts.ts      request timestamp
 * @param {object} [opts.deps]  injectable { callAI, buildReportPrompt, checkVip,
 *                              emitModelCall, staleMs }
 * @returns {Promise<object>}   the CF response envelope (ok/fail)
 */
async function runChallengeFinalReport (opts) {
  const { db, openid, event = {}, ts } = opts
  const deps = opts.deps || {}
  const callAI = deps.callAI || require('./ai.js').callAI
  const buildReportPrompt = deps.buildReportPrompt || require('./ai.js').buildReportPrompt
  const checkVip = deps.checkVip || require('./permission.js').checkVip
  const emitModelCall = deps.emitModelCall || require('./aiTelemetry.js').emitModelCall
  const staleMs = deps.staleMs || DEFAULT_STALE_MS

  const recordId = event.recordId

  // ── 1. ownership + eligibility (trusted identity ONLY) ────────────────────
  // Never trust a client-supplied openid. Access is denied unless the record
  // belongs to the authenticated caller. Cache hits are gated behind this too.
  const recRes = await db.collection('challenge_records').where({ recordId, openid }).limit(1).get()
  const record = recRes && recRes.data && recRes.data[0] ? recRes.data[0] : null
  if (!record) return fail(CODES.NOT_FOUND, '挑战记录不存在或无权访问')

  const reportId = logicalReportId(openid, recordId)

  // ── 2. resolve existing entity / claim generation right ───────────────────
  let entity = await readEntity(db, reportId)

  // cross-user defence: deterministic id already isolates users, assert anyway
  if (entity && entity.openid && entity.openid !== openid) {
    return fail(CODES.PERMISSION_DENIED, '无权访问该报告')
  }

  let claimed = false
  let claimToken = newClaimToken()

  if (!entity) {
    // first writer wins: deterministic _id insert = atomic claim
    const inputs = buildInputs(record)
    try {
      await db.collection('ai_reports').add({
        data: {
          _id: reportId,
          reportId,
          openid,
          type: 'challenge_final',
          recordId,
          status: 'generating',
          claimToken,
          claimAt: ts,
          scores: inputs.scores,
          tags: inputs.tags,
          rawScores: inputs.rawScoresRef,
          scoringVersion: inputs.scoringVer,
          content: null,
          // isPaid intentionally NOT written by generation (owned by finalizer)
          createdAt: ts,
          updatedAt: ts,
        },
      })
      claimed = true
      entity = { reportId, openid, status: 'generating', claimToken, claimAt: ts }
    } catch (err) {
      if (!isDuplicateKey(err)) throw err
      // lost the race → re-read the winner's entity and branch below
      entity = await readEntity(db, reportId)
      if (!entity) throw err
    }
  }

  if (entity && entity.status === 'ready') {
    return respondReady(db, openid, entity, checkVip, deps)
  }

  if (!claimed && entity && entity.status === 'generating') {
    const claimAt = entity.claimAt || 0
    const stale = (ts - claimAt) > staleMs
    if (stale) {
      // conditional (compare-and-set) takeover: only one taker can flip the
      // observed claimAt → atomic single winner reusing the SAME entity
      const res = await db.collection('ai_reports')
        .where({ _id: reportId, status: 'generating', claimAt })
        .update({ data: { claimToken, claimAt: ts, updatedAt: ts } })
      claimed = !!(res && res.stats && res.stats.updated === 1)
      if (!claimed) {
        // someone else took over (or it completed) → reflect current state
        entity = await readEntity(db, reportId)
        if (entity && entity.status === 'ready') return respondReady(db, openid, entity, checkVip, deps)
        return respondGenerating(reportId)
      }
    } else {
      // an active generation is in flight → explicit status, no body
      return respondGenerating(reportId)
    }
  } else if (!claimed && entity && entity.status === 'failed') {
    // controlled retry reusing the SAME entity
    const res = await db.collection('ai_reports')
      .where({ _id: reportId, status: 'failed' })
      .update({ data: { status: 'generating', claimToken, claimAt: ts, lastError: '', updatedAt: ts } })
    claimed = !!(res && res.stats && res.stats.updated === 1)
    if (!claimed) {
      entity = await readEntity(db, reportId)
      if (entity && entity.status === 'ready') return respondReady(db, openid, entity, checkVip, deps)
      return respondGenerating(reportId)
    }
  } else if (!claimed && entity) {
    // legacy/unknown state with no content → allow a controlled retry
    if (entity.content) return respondReady(db, openid, entity, checkVip, deps)
    const res = await db.collection('ai_reports')
      .where({ _id: reportId, status: entity.status })
      .update({ data: { status: 'generating', claimToken, claimAt: ts, updatedAt: ts } })
    claimed = !!(res && res.stats && res.stats.updated === 1)
    if (!claimed) return respondGenerating(reportId)
  }

  // ── 3. generation right acquired → call AI (OUTSIDE any DB transaction) ───
  const inputs = buildInputs(record)
  const { systemPrompt, userMessage } = buildReportPrompt(inputs.scores, inputs.tags, inputs.choicesSummary)
  const reportModel = process.env.AI_MODEL_PRO || 'v4-pro'
  const modelTimeoutMs = deps.modelTimeoutMs || MODEL_TIMEOUT_MS

  let aiResult
  const __aiStart = Date.now()
  try {
    // Bounded: never wait past modelTimeoutMs, so completion always has budget.
    aiResult = await withTimeout(
      callAI({ systemPrompt, userMessage, forceModel: reportModel }),
      modelTimeoutMs,
      { success: false, error: 'AI 调用超时（' + Math.round(modelTimeoutMs / 1000) + 's）', providerErrorCode: 'AI_PROVIDER_TIMEOUT' }
    )
  } catch (e) {
    aiResult = { success: false, error: (e && e.message) || 'AI 调用异常' }
  }
  if (aiResult && aiResult.latencyMs === undefined) aiResult.latencyMs = Date.now() - __aiStart

  if (emitModelCall) {
    emitModelCall(db, aiResult, {
      requestId: event.requestId || recordId || '', reportId,
      productLine: 'challenge_final', diagnosticVersion: null, openid, ts,
      latencyMs: aiResult && aiResult.latencyMs,
    }).catch(() => {})
  }

  if (!aiResult || !aiResult.success) {
    // explicit retryable terminal state — the entity NEVER stays generating
    const reason = (aiResult && aiResult.error) || 'AI 调用失败'
    await persistFailed(db, reportId, claimToken, reason, null, ts)
    return fail(CODES.AI_ERROR, reason)
  }

  // ── 4. completion (PROTECTED): parse → validate → persist → ready → audit ─
  // Every step below is guarded. parseAiReport never throws; a bad body is
  // persisted as an explicit retryable failure instead of stranded generating.
  const parsed = parseAiReport(aiResult.content)
  if (!parsed || !parsed.ok) {
    const reason = '报告内容解析失败：' + ((parsed && parsed.error) || 'JSON 解析失败')
    await persistFailed(db, reportId, claimToken, reason, { parseFailed: true }, ts)
    await auditCompletion(db, {
      openid, action: 'generate_report', type: 'challenge_final', reportId, recordId,
      tokens: (aiResult.tokens) || 0, success: false, errorMessage: reason, createdAt: ts,
    })
    return fail(CODES.AI_ERROR, '报告生成失败，请重试')
  }
  const parsedReport = parsed.value

  // ── 5. persist content + flip to ready (conditional on our claimToken) ────
  // If a stale takeover already replaced us, updated!==1 → we must NOT clobber.
  let completed = false
  let persistError = null
  try {
    // ── R7 P0: whole-field assignment for `content` ──────────────────────
    // The claim placeholder created this row with `content: null`. The SDK's
    // update serializer FLATTENS a nested plain object into dot-paths
    // (`content.bestPath`, `content.oneSentence`, …). Applying those over a
    // `null` parent makes Mongo throw:
    //   Cannot create field 'bestPath' in element {content: null}
    // `db.command.set(obj)` is encoded as `{ $set: { content: <whole object> } }`
    // (verified: it is NOT flattened) → whole-field replacement, atomic and
    // semantically correct. Fallback keeps correctness if `command` is absent.
    const wholeContent = (db.command && typeof db.command.set === 'function')
      ? db.command.set(parsedReport)
      : parsedReport
    const upd = await db.collection('ai_reports')
      .where({ _id: reportId, claimToken, status: 'generating' })
      .update({ data: {
        status: 'ready',
        content: wholeContent,
        rawPrompt: { systemPrompt, userMessage },
        aiModel: reportModel,
        aiTokens: (aiResult.tokens) || 0,
        updatedAt: ts,
        // isPaid intentionally untouched
      } })
    completed = !!(upd && upd.stats && upd.stats.updated === 1)
  } catch (e) {
    persistError = (e && e.message) || '持久化异常'
  }

  if (!completed) {
    // Either we lost the claim (a newer winner completed) OR persistence threw.
    const cur = await readEntity(db, reportId).catch(() => null)
    if (cur && cur.status === 'ready') return respondReady(db, openid, cur, checkVip, deps)
    if (persistError) {
      // Persistence failed while we still own the row → explicit retryable state.
      await persistFailed(db, reportId, claimToken, '报告持久化失败：' + persistError, { persistFailed: true }, ts)
      await auditCompletion(db, {
        openid, action: 'generate_report', type: 'challenge_final', reportId, recordId,
        tokens: (aiResult.tokens) || 0, success: false, errorMessage: persistError, createdAt: ts,
      })
      return fail(CODES.AI_ERROR, '报告保存失败，请重试')
    }
    // Lost the claim but not ready yet → report in-flight status (no clobber).
    return respondGenerating(reportId)
  }

  // ── 6. completion audit (best-effort) + response ──────────────────────────
  await auditCompletion(db, {
    openid, action: 'generate_report', type: 'challenge_final', reportId, recordId,
    tokens: (aiResult.tokens) || 0, success: true, errorMessage: '', createdAt: ts,
  })

  const finalEntity = { reportId, openid, status: 'ready', content: parsedReport, isPaid: false }
  return respondReady(db, openid, finalEntity, checkVip, deps)
}

module.exports = {
  runChallengeFinalReport,
  logicalReportId,
  parseAiReport,
  DEFAULT_STALE_MS,
  MODEL_TIMEOUT_MS,
}
