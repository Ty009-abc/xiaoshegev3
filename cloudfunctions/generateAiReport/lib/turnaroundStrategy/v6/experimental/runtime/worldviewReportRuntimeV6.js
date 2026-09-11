'use strict'
/**
 * turnaroundStrategy/v6/experimental/runtime/worldviewReportRuntimeV6.js
 *
 * ISOLATED V6 worldview runtime chain (B2.4). EXPERIMENTAL — NOT WIRED.
 *
 *   B1 diagnoseTurnaroundV6
 *     -> B2.1 deterministic report   (buildReportV6)
 *     -> B2.2 worldview model call    (modelAdapterWorldviewV6)
 *     -> validator (worldviewValidatorV6)
 *
 *   PASS            -> return worldview report            (renderSource = worldview_ai)
 *   FAIL (attempt 1)-> retry ONCE (same frozen facts, same prompt, temp 0)
 *   FAIL (attempt 2)-> return deterministic B2.1 fallback (renderSource = deterministic_fallback)
 *
 * CONTRACT FLAGS
 *   MODEL_IS_OPTIONAL_ENHANCEMENT      = YES
 *   DETERMINISTIC_FALLBACK_ALWAYS_AVAILABLE = YES
 *   MAX_MODEL_ATTEMPTS                 = 2
 *   VALIDATOR_BYPASS_PATH_COUNT        = 0   (model output can NEVER bypass validator)
 *
 * SAFETY
 *   - Must NOT be imported by generateAiReport/index.js (production).
 *   - No secret logging; no raw-prompt logging; no full user-answer dump.
 *   - Never recomputes diagnosis; never changes facts between retries.
 *   - Diagnostics authority stays with B1; this module never invents labels.
 *   - TOTAL budget gate: the 2nd attempt only starts if the remaining budget
 *     can still accommodate it; otherwise fall back to deterministic B2.1
 *     immediately (FALLBACK_BEFORE_FUNCTION_TIMEOUT = YES).
 */

const { diagnoseTurnaroundV6 } = require('../../index.js')
const { buildReportV6, REPORT_VERSION } = require('../../report/index.js')
const adapter = require('../worldview/modelAdapterWorldviewV6.js')
const { validateWorldviewV6, WORLDVIEW_REPORT_VERSION } = require('./worldviewValidatorV6.js')

const MAX_MODEL_ATTEMPTS = 2
const MODEL_IS_OPTIONAL_ENHANCEMENT = true
const DETERMINISTIC_FALLBACK_ALWAYS_AVAILABLE = true

// Audited production-wiring budget (design-only; platform timeout NOT modified).
// 2 attempts × 14000ms = 28000ms + ~2s overhead ≈ 30s, leaving ~30s headroom
// under the 60000ms cloud-function ceiling → fallback always lands before timeout.
const MODEL_ATTEMPT_TIMEOUT_MS = 14000
const TOTAL_WORLDVIEW_BUDGET_MS = 30000

const RENDER_SOURCE = { AI: 'worldview_ai', FALLBACK: 'deterministic_fallback' }

/** Race a promise against a timeout. Rejects with Error('TIMEOUT'). */
function withTimeout (promise, ms) {
  if (!ms || ms <= 0) return promise
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('TIMEOUT')), ms)
    if (timer && typeof timer.unref === 'function') timer.unref()
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** Build one deterministic fallback result from a diagnosis + report. */
function fallbackResult (diagnosis, report, meta) {
  return {
    reportVersion: REPORT_VERSION, // turnaround_strategy_v6_report_v1
    reportState: report.reportState,
    cards: report.cards,
    provenance: report.provenance,
    meta: Object.assign({
      renderSource: RENDER_SOURCE.FALLBACK,
      attemptCount: 0,
      validatorFailures: [],
      modelLatencyMs: 0,
      fallbackReason: 'DETERMINISTIC_BY_DESIGN'
    }, meta)
  }
}

/**
 * Run the isolated worldview runtime chain.
 * @param {Object} answers  9Q raw answers (frozen questionnaire)
 * @param {Object} [opts]   { callAI?, maxAttempts?, attemptTimeoutMs?, temperature? }
 * @returns {Promise<Object>} report with `meta` (renderSource NOT in user copy)
 */
async function runWorldviewReportRuntimeV6 (answers, opts) {
  const o = opts || {}
  const maxAttempts = o.maxAttempts || MAX_MODEL_ATTEMPTS
  const attemptTimeoutMs = o.attemptTimeoutMs != null ? o.attemptTimeoutMs : MODEL_ATTEMPT_TIMEOUT_MS
  const totalBudgetMs = o.totalBudgetMs != null ? o.totalBudgetMs : TOTAL_WORLDVIEW_BUDGET_MS
  const budgetStart = Date.now()
  const remainingBudget = () => totalBudgetMs - (Date.now() - budgetStart)

  // ── 1. B1 diagnosis (authority) ───────────────────────────────
  const diagnosis = diagnoseTurnaroundV6(answers)

  // ── 2. B2.1 deterministic report (always available) ───────────
  const detReport = buildReportV6(diagnosis)

  // Non-PRIMARY states never call the model (no primary to express).
  if (diagnosis.diagnosisState !== 'PRIMARY') {
    return fallbackResult(diagnosis, detReport, {
      fallbackReason: diagnosis.diagnosisState === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'NO_PRIMARY',
      attempts: []
    })
  }

  const payload = { id: null, answers, diagnosis, b2Report: detReport, userFacts: answers }

  // ── 3. model + validator, up to maxAttempts ───────────────────
  const attempts = []
  let totalLatency = 0
  let lastValidatorFailures = []
  let lastFailureReason = 'MODEL_ATTEMPTS_EXHAUSTED'

  for (let i = 1; i <= maxAttempts; i++) {
    // Budget gate: the next attempt may only start if the remaining total
    // budget can still accommodate an attempt. Otherwise fall back NOW.
    if (i > 1 && remainingBudget() < attemptTimeoutMs) {
      lastFailureReason = 'TOTAL_BUDGET_EXHAUSTED'
      break
    }
    const t0 = Date.now()
    let res
    let failureReason = null
    try {
      res = await withTimeout(
        adapter.runWorldviewAdapter(payload, {
          callAI: o.callAI,
          temperature: o.temperature != null ? o.temperature : 0
        }),
        attemptTimeoutMs
      )
    } catch (e) {
      res = null
      failureReason = (e && e.message === 'TIMEOUT') ? 'MODEL_TIMEOUT' : 'MODEL_ERROR'
    }
    const latencyMs = Date.now() - t0
    totalLatency += latencyMs

    if (!res || !res.ok) {
      failureReason = failureReason || (res && res.error ? 'MODEL_ERROR' : 'MODEL_ERROR')
      if (res && /JSON_PARSE_ERROR|NO_JSON_OBJECT|EMPTY/.test(String(res.error || ''))) failureReason = 'INVALID_JSON'
      attempts.push({ attempt: i, ok: false, failureReason, latencyMs })
      lastFailureReason = failureReason
      continue
    }

    // 4. hard validator gate — NO bypass
    const verdict = validateWorldviewV6(res.report, diagnosis)
    attempts.push({ attempt: i, ok: verdict.valid, failureReason: verdict.valid ? null : 'VALIDATION_FAIL', validatorFailures: verdict.hardFailures, latencyMs })

    if (verdict.valid) {
      return {
        reportVersion: WORLDVIEW_REPORT_VERSION,
        reportState: 'PRIMARY',
        cards: res.report.cards,
        provenance: detReport.provenance,
        meta: {
          renderSource: RENDER_SOURCE.AI,
          attemptCount: i,
          validatorFailures: [],
          modelLatencyMs: totalLatency,
          fallbackReason: null,
          attempts
        }
      }
    }
    lastValidatorFailures = verdict.hardFailures
    lastFailureReason = 'VALIDATION_FAIL'
  }

  // ── 5. deterministic fallback (always available) ──────────────
  return fallbackResult(diagnosis, detReport, {
    fallbackReason: lastFailureReason === 'MODEL_TIMEOUT' ? 'MODEL_TIMEOUT'
      : lastFailureReason === 'TOTAL_BUDGET_EXHAUSTED' ? 'TOTAL_BUDGET_EXHAUSTED'
        : lastValidatorFailures.length ? 'DOUBLE_VALIDATION_FAIL' : lastFailureReason,
    attemptCount: attempts.length,
    validatorFailures: lastValidatorFailures,
    modelLatencyMs: totalLatency,
    attempts
  })
}

module.exports = {
  runWorldviewReportRuntimeV6,
  MAX_MODEL_ATTEMPTS,
  MODEL_IS_OPTIONAL_ENHANCEMENT,
  DETERMINISTIC_FALLBACK_ALWAYS_AVAILABLE,
  MODEL_ATTEMPT_TIMEOUT_MS,
  TOTAL_WORLDVIEW_BUDGET_MS,
  RENDER_SOURCE
}
