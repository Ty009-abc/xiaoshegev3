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

// Stale-generation takeover window. A `generating` entity older than this is
// considered abandoned (λ killed mid-AI) and may be re-claimed, reusing the
// SAME entity — no permanent stall, no duplicate.
const DEFAULT_STALE_MS = 90 * 1000

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

// ── tolerant AI JSON cleaning (identical semantics to the legacy branch) ────
function parseAiReport (aiContent) {
  const content = aiContent || ''
  try {
    let jsonStr = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()
    const bracketMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (bracketMatch) jsonStr = bracketMatch[0]
    jsonStr = jsonStr.replace(/\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1')
    return JSON.parse(jsonStr)
  } catch (parseErr) {
    console.error('【challenge_final JSON清洗失败】错误:', parseErr.message)
    console.error('【challenge_final 原始AI返回】:', content.substring(0, 800))
    return {
      rawContent: content,
      oneSentence: '报告生成中，请稍后重试',
      worldModelType: '系统信号中断',
      whyNotRich: '暂时无法解析，点击重试',
      biggestCognitiveGap: '重试获取分析',
      turnaroundProbability: 0,
      threeYearRisk: '请重试',
      bestPath: '重新测试以获取结果',
      thirtyDayActions: ['重试报告生成'],
      finalStrike: '⚠️ 系统暂时无法审判你，再试一次',
    }
  }
}

async function readEntity (db, reportId) {
  const res = await db.collection('ai_reports').where({ reportId }).limit(1).get()
  return res && res.data && res.data[0] ? res.data[0] : null
}

// Entitlement is derived from the SERVER authority, never from the client.
// membership (checkVip) OR the finalizer-written report.isPaid.
async function isEntitled (db, openid, entity, checkVip) {
  if (entity && entity.isPaid === true) return true
  const vip = await checkVip(db, openid)
  return vip === true
}

// Response for an already-materialised (ready) entity. Preserves the existing
// response shape + summary semantics exactly.
async function respondReady (db, openid, entity, checkVip) {
  const entitled = await isEntitled(db, openid, entity, checkVip)
  if (entitled) {
    return ok({
      reportId: entity.reportId,
      reportType: 'challenge_final',
      isPaid: true,
      locked: false,
      content: entity.content || {},
    })
  }
  const c = entity.content || {}
  return ok({
    reportId: entity.reportId,
    isPaid: false,
    locked: true,
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
    return respondReady(db, openid, entity, checkVip)
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
        if (entity && entity.status === 'ready') return respondReady(db, openid, entity, checkVip)
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
      if (entity && entity.status === 'ready') return respondReady(db, openid, entity, checkVip)
      return respondGenerating(reportId)
    }
  } else if (!claimed && entity) {
    // legacy/unknown state with no content → allow a controlled retry
    if (entity.content) return respondReady(db, openid, entity, checkVip)
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

  let aiResult
  try {
    aiResult = await callAI({ systemPrompt, userMessage, forceModel: reportModel })
  } catch (e) {
    aiResult = { success: false, error: e.message }
  }

  if (emitModelCall) {
    emitModelCall(db, aiResult, {
      requestId: event.requestId || recordId || '', reportId,
      productLine: 'challenge_final', diagnosticVersion: null, openid, ts,
      latencyMs: aiResult && aiResult.latencyMs,
    }).catch(() => {})
  }

  if (!aiResult || !aiResult.success) {
    // mark failed so a later request can retry on the SAME entity
    await db.collection('ai_reports')
      .where({ _id: reportId, claimToken })
      .update({ data: {
        status: 'failed',
        lastError: String((aiResult && aiResult.error) || 'AI 调用失败').substring(0, 200),
        updatedAt: ts,
      } })
      .catch(() => {})
    return fail(CODES.AI_ERROR, (aiResult && aiResult.error) || 'AI 调用失败')
  }

  const parsedReport = parseAiReport(aiResult.content)

  // ── 4. completion: conditional on our claimToken + still generating ───────
  // If a stale takeover already replaced us, updated!==1 → we must NOT clobber.
  const upd = await db.collection('ai_reports')
    .where({ _id: reportId, claimToken, status: 'generating' })
    .update({ data: {
      status: 'ready',
      content: parsedReport,
      rawPrompt: { systemPrompt, userMessage },
      aiModel: reportModel,
      aiTokens: (aiResult.tokens) || 0,
      updatedAt: ts,
      // isPaid intentionally untouched
    } })

  if (!upd || !upd.stats || upd.stats.updated !== 1) {
    // lost the claim → return whatever the current (newer) entity holds
    const cur = await readEntity(db, reportId)
    if (cur && cur.status === 'ready') return respondReady(db, openid, cur, checkVip)
    return respondGenerating(reportId)
  }

  // ── 5. best-effort log + response ─────────────────────────────────────────
  await db.collection('ai_logs').add({
    data: {
      openid,
      action: 'generate_report',
      type: 'challenge_final',
      reportId,
      recordId,
      tokens: (aiResult.tokens) || 0,
      success: aiResult.success,
      errorMessage: aiResult.error || '',
      createdAt: ts,
    },
  }).catch(() => {})

  const finalEntity = { reportId, openid, status: 'ready', content: parsedReport, isPaid: false }
  return respondReady(db, openid, finalEntity, checkVip)
}

module.exports = {
  runChallengeFinalReport,
  logicalReportId,
  parseAiReport,
  DEFAULT_STALE_MS,
}
