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

const MAX_MODEL_ATTEMPTS = 2
const MODEL_ATTEMPT_TIMEOUT_MS = 14000
const TOTAL_WORLDVIEW_BUDGET_MS = 30000

const RENDER_SOURCE = { AI: 'ai_draft_edited', FALLBACK: 'deterministic_fallback' }

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
  const remaining = () => totalBudgetMs - (Date.now() - budgetStart)

  const diagnosis = diagnoseTurnaroundV6(answers)
  const detReport = buildReportV6(diagnosis)

  if (diagnosis.diagnosisState !== 'PRIMARY') {
    return wholeReportFallback(detReport, { attempts: [], fallbackReason: diagnosis.diagnosisState === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'NO_PRIMARY' })
  }

  const payload = { id: null, answers, diagnosis, b2Report: detReport, userFacts: answers }
  const attempts = []
  let lastFailure = 'DRAFT_ATTEMPTS_EXHAUSTED'
  let draftMetrics = null

  for (let i = 1; i <= maxAttempts; i++) {
    if (i > 1 && remaining() < attemptTimeoutMs) { lastFailure = 'TOTAL_BUDGET_EXHAUSTED'; break }
    const t0 = Date.now()
    let res = null
    let failureReason = null
    try {
      res = await withTimeout(
        runDraftAdapter(payload, { callAI: o.callAI, forceModel: o.forceModel, maxTokens: o.maxTokens, temperature: o.temperature != null ? o.temperature : 0 }),
        attemptTimeoutMs
      )
    } catch (e) {
      res = null
      failureReason = (e && e.message === 'TIMEOUT') ? 'MODEL_TIMEOUT' : 'MODEL_ERROR'
    }
    const latencyMs = Date.now() - t0

    if (!res || !res.ok) {
      attempts.push({ attempt: i, ok: false, failureReason: failureReason || 'INVALID_JSON', latencyMs, rawLen: res && res.meta ? res.meta.rawLen : 0, finishReason: res && res.meta ? res.meta.finishReason : null })
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
          draftHardFailures: dv.hardFailures,
          finalHardFailures: [],
          attempts
        }
      }
    }
    lastFailure = 'FINAL_VALIDATION_FAIL'
    draftMetrics = res.meta
  }

  return wholeReportFallback(detReport, { attempts, fallbackReason: lastFailure, attemptCount: attempts.length })
}

module.exports = {
  runDraftReportRuntimeV6,
  MAX_MODEL_ATTEMPTS,
  MODEL_ATTEMPT_TIMEOUT_MS,
  TOTAL_WORLDVIEW_BUDGET_MS,
  RENDER_SOURCE,
  REPORT_VERSION
}
