'use strict'
/**
 * turnaroundStrategy/v6/experimental/draft/draftReportRuntimeV6.js
 *
 * R11_V2 — ISOLATED DRAFT→VALIDATE→EDIT→FINAL runtime chain.
 * EXPERIMENTAL — NOT WIRED into production.
 *
 *   B1 diagnoseTurnaroundV6            (authority: diagnosis)
 *     -> B2 buildReportV6              (deterministic facts / card structure)
 *     -> AI draft adapter              (insight material ONLY)
 *     -> draft semantic validator      (safety authority)
 *     -> deterministic editor          (final product copy, AI calls = 0)
 *     -> final validator               (shippable gate)
 *
 * CONTRACT FLAGS
 *   MODEL_OUTPUT_EQUALS_FINAL_OUTPUT   = NO
 *   EDITOR_AI_CALL_COUNT               = 0
 *   MAX_MODEL_ATTEMPTS                 = 2
 *   WHOLE_REPORT_FALLBACK              = deterministic B2 report
 *   FIELD_LEVEL_FALLBACK               = YES (unsafe field -> its B2 counterpart)
 *   VALIDATOR_BYPASS_PATH_COUNT        = 0
 */

const { diagnoseTurnaroundV6 } = require('../../index.js')
const { buildReportV6, REPORT_VERSION } = require('../../report/index.js')
const { runDraftAdapter } = require('./draftAdapterV6.js')
const { validateDraftV6 } = require('./draftValidatorV6.js')
const { editReportV6 } = require('./reportEditorV6.js')
const { validateFinalV6 } = require('./finalValidatorV6.js')
const { getV6WorldviewModelFromEnv, V6_DEFAULT_MODEL } = require('../../../../config/worldviewV6Model.js')

const MAX_MODEL_ATTEMPTS = 2
const MODEL_ATTEMPT_TIMEOUT_MS = 14000
const TOTAL_WORLDVIEW_BUDGET_MS = 30000

// §3 Frozen initial production-shadow draft budget. 2400 is the measured knee:
// it satisfies the product/runtime gates while keeping MODEL_P95 < 14000ms.
// 3000 is deliberately NOT used (P95 14467ms breaches the latency gate).
const DRAFT_MAX_TOKENS = 2400

const RENDER_SOURCE = { AI: 'ai_draft_edited', FALLBACK: 'deterministic_fallback' }

// R19 §2 SAFE per-attempt result categories (closed set — no raw content).
const ATTEMPT_RESULT = Object.freeze({
  PASS: 'PASS',
  INVALID_JSON: 'INVALID_JSON',
  SEMANTIC_FAIL: 'SEMANTIC_FAIL',
  FINAL_VALIDATION_FAIL: 'FINAL_VALIDATION_FAIL',
  MODEL_TIMEOUT: 'MODEL_TIMEOUT',
  MODEL_ERROR: 'MODEL_ERROR'
})

/** Map a runtime attempt outcome to the closed SAFE resultCategory set. */
function attemptResultCategory (failureReason, finalValid, draftValid) {
  if (finalValid) return ATTEMPT_RESULT.PASS
  if (failureReason === 'MODEL_TIMEOUT') return ATTEMPT_RESULT.MODEL_TIMEOUT
  if (failureReason === 'MODEL_ERROR') return ATTEMPT_RESULT.MODEL_ERROR
  if (failureReason === 'INVALID_JSON' || failureReason === 'JSON_TRUNCATED') return ATTEMPT_RESULT.INVALID_JSON
  if (draftValid === false) return ATTEMPT_RESULT.SEMANTIC_FAIL
  return ATTEMPT_RESULT.FINAL_VALIDATION_FAIL
}

/**
 * R19 §4 — derive SAFE aggregate latency metrics from an attempts[] array.
 * Pure, deterministic, no raw content. Percentile = nearest-rank.
 * @param {Array<{latencyMs:number,resultCategory:string}>} attempts
 */
function deriveAttemptLatencyMetrics (attempts) {
  const a = Array.isArray(attempts) ? attempts : []
  const nums = a.map((x) => (typeof x.latencyMs === 'number' ? x.latencyMs : 0)).filter((n) => n >= 0)
  const okNums = a.filter((x) => x.resultCategory === ATTEMPT_RESULT.PASS).map((x) => x.latencyMs).filter((n) => typeof n === 'number')
  const toNums = a.filter((x) => x.resultCategory === ATTEMPT_RESULT.MODEL_TIMEOUT).map((x) => x.latencyMs).filter((n) => typeof n === 'number')
  return {
    ATTEMPT_P50_MS: nearestRank(nums, 0.5),
    ATTEMPT_P95_MS: nearestRank(nums, 0.95),
    ATTEMPT_MAX_MS: nums.length ? Math.max(...nums) : 0,
    SUCCESSFUL_ATTEMPT_P50_MS: nearestRank(okNums, 0.5),
    SUCCESSFUL_ATTEMPT_P95_MS: nearestRank(okNums, 0.95),
    TIMEOUT_ATTEMPT_COUNT: toNums.length,
    TIMEOUT_ATTEMPT_MIN_MS: toNums.length ? Math.min(...toNums) : 0,
    TIMEOUT_ATTEMPT_MAX_MS: toNums.length ? Math.max(...toNums) : 0
  }
}

function nearestRank (sortedOrRaw, p) {
  const s = sortedOrRaw.slice().sort((x, y) => x - y)
  if (!s.length) return 0
  const idx = Math.max(0, Math.min(s.length - 1, Math.round(p * (s.length - 1))))
  return s[idx]
}

function withTimeout (promise, ms) {
  if (!ms || ms <= 0) return promise
  let timer
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('TIMEOUT')), ms); if (timer && timer.unref) timer.unref() })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** §7 WHOLE-REPORT fallback: deterministic B2 report, unchanged. */
function wholeReportFallback (detReport, meta) {
  return {
    renderSource: RENDER_SOURCE.FALLBACK,
    report: {
      reportVersion: detReport.reportVersion,
      reportState: detReport.reportState,
      cards: detReport.cards,
      provenance: detReport.provenance
    },
    meta: Object.assign({ renderSource: RENDER_SOURCE.FALLBACK, editor: { aiCallCount: 0, fieldsUsed: [], fieldsFellBack: [] } }, meta)
  }
}

/**
 * @param {Object} answers raw 9Q answers
 * @param {Object} [opts] { callAI?, forceModel?, maxTokens?, maxAttempts?, attemptTimeoutMs?, totalBudgetMs?, temperature? }
 */
async function runDraftReportRuntimeV6 (answers, opts) {
  const o = opts || {}
  const maxAttempts = o.maxAttempts || MAX_MODEL_ATTEMPTS
  const attemptTimeoutMs = o.attemptTimeoutMs != null ? o.attemptTimeoutMs : MODEL_ATTEMPT_TIMEOUT_MS
  const totalBudgetMs = o.totalBudgetMs != null ? o.totalBudgetMs : TOTAL_WORLDVIEW_BUDGET_MS
  const budgetStart = Date.now()
  const shadowStart = Date.now() // R19 §3 total shadow side-path elapsed
  const remaining = () => totalBudgetMs - (Date.now() - budgetStart)

  // §2 Dedicated V6 model: RC84_V6_WORLDVIEW_MODEL → V6_DEFAULT_MODEL.
  // NEVER falls back to AI_MODEL_PRO (R10 finding: reasoning tier).
  const model = o.forceModel || o.model || getV6WorldviewModelFromEnv()
  const maxTokens = o.maxTokens != null ? o.maxTokens : DRAFT_MAX_TOKENS

  const diagnosis = diagnoseTurnaroundV6(answers)
  const detReport = buildReportV6(diagnosis)

  if (diagnosis.diagnosisState !== 'PRIMARY') {
    return wholeReportFallback(detReport, { attempts: [], shadowTotalLatencyMs: Date.now() - shadowStart, fallbackReason: diagnosis.diagnosisState === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'NO_PRIMARY' })
  }

  const payload = { id: null, answers, diagnosis, b2Report: detReport, userFacts: answers }
  const attempts = []
  let lastFailure = 'DRAFT_ATTEMPTS_EXHAUSTED'
  let draftMetrics = null
  // R21 §15 OPTION B (ON only): a retry is allowed ONLY if the previous attempt
  // failed FAST (<= retryFastFailMs) AND the remaining deadline can still fit a
  // full attempt. SHADOW does not pass retryFastFailMs, so its retry behavior
  // is unchanged.
  const retryFastFailMs = o.retryFastFailMs != null ? o.retryFastFailMs : null

  for (let i = 1; i <= maxAttempts; i++) {
    if (i > 1) {
      if (remaining() < attemptTimeoutMs) { lastFailure = 'TOTAL_BUDGET_EXHAUSTED'; break }
      if (retryFastFailMs != null) {
        const prev = attempts[attempts.length - 1]
        const prevLatency = prev ? (prev.latencyMs || 0) : Infinity
        if (prevLatency > retryFastFailMs) { lastFailure = 'RETRY_SKIPPED_SLOW_FAILURE'; break }
      }
    }
    const t0 = Date.now()
    let res = null
    let failureReason = null
    try {
      res = await withTimeout(
        runDraftAdapter(payload, { callAI: o.callAI, forceModel: model, maxTokens, temperature: o.temperature != null ? o.temperature : 0 }),
        attemptTimeoutMs
      )
    } catch (e) {
      res = null
      failureReason = (e && e.message === 'TIMEOUT') ? 'MODEL_TIMEOUT' : 'MODEL_ERROR'
    }
    const latencyMs = Date.now() - t0

    if (!res || !res.ok) {
      const cat = attemptResultCategory(failureReason || 'INVALID_JSON', false, null)
      attempts.push({ attempt: i, ok: false, failureReason: failureReason || 'INVALID_JSON', resultCategory: cat, latencyMs, rawLen: res && res.meta ? res.meta.rawLen : 0, finishReason: res && res.meta ? res.meta.finishReason : null })
      lastFailure = failureReason || 'INVALID_JSON'
      draftMetrics = res && res.meta ? res.meta : null
      continue
    }

    // Draft-level semantic validation (material; length not enforced here).
    const dv = validateDraftV6(res.draft, diagnosis)

    // §7 FIELD-LEVEL fallback: hand the editor the draft + per-field verdicts.
    // The editor substitutes B2 copy for any field that is unsafe/too short.
    const edited = editReportV6({ diagnosis, b2Report: detReport, draft: res.draft, draftVerdict: dv })
    const finalVerdict = validateFinalV6(edited, diagnosis)

    attempts.push({
      attempt: i, ok: finalVerdict.valid, failureReason: finalVerdict.valid ? null : 'FINAL_VALIDATION_FAIL',
      resultCategory: attemptResultCategory(null, finalVerdict.valid, dv.valid),
      latencyMs, rawLen: res.meta ? res.meta.rawLen : 0, finishReason: res.meta ? res.meta.finishReason : null,
      draftValid: dv.valid, draftHardFailures: dv.hardFailures,
      finalHardFailures: finalVerdict.hardFailures,
      fieldsUsed: edited.editor.fieldsUsed, fieldsFellBack: edited.editor.fieldsFellBack
    })

    if (finalVerdict.valid) {
      return {
        renderSource: RENDER_SOURCE.AI,
        report: edited,
        meta: {
          renderSource: RENDER_SOURCE.AI,
          attemptCount: i,
          editor: edited.editor,
          modelLatencyMs: latencyMs,
          shadowTotalLatencyMs: Date.now() - shadowStart,
          attemptLatencyMetrics: deriveAttemptLatencyMetrics(attempts),
          draftHardFailures: dv.hardFailures,
          finalHardFailures: [],
          attempts
        }
      }
    }
    lastFailure = 'FINAL_VALIDATION_FAIL'
    draftMetrics = res.meta
  }

  return wholeReportFallback(detReport, { attempts, shadowTotalLatencyMs: Date.now() - shadowStart, attemptLatencyMetrics: deriveAttemptLatencyMetrics(attempts), fallbackReason: lastFailure, attemptCount: attempts.length })
}

module.exports = {
  runDraftReportRuntimeV6,
  MAX_MODEL_ATTEMPTS,
  MODEL_ATTEMPT_TIMEOUT_MS,
  TOTAL_WORLDVIEW_BUDGET_MS,
  DRAFT_MAX_TOKENS,
  V6_DEFAULT_MODEL,
  RENDER_SOURCE,
  REPORT_VERSION,
  ATTEMPT_RESULT,
  attemptResultCategory,
  deriveAttemptLatencyMetrics
}
