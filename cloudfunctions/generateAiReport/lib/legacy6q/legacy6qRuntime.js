'use strict'
/**
 * cloudfunctions/generateAiReport/lib/legacy6q/legacy6qRuntime.js
 *
 * RC8.8 Stage2 (§9/§12/§13/§14) — revived legacy 6Q report runtime.
 *
 * PHILOSOPHY: MODEL FIRST + LIGHT STRUCTURAL RECOVERY.
 *
 *   • ONE bounded model call (no whole-report regeneration — §14 forbids
 *     regenerating the other four fields to fix one). The legacy product made a
 *     single call; this matches it.
 *   • Tolerant parse with per-FIELD repair only (§11).
 *   • Minimal safety guards, repaired at field level (§10).
 *   • NO semantic validator, NO grounding taxonomy, NO field-repair AI pipeline,
 *     NO whole-report deterministic content fallback.
 *
 * The ONLY route to a deterministic whole-report body is a TOTAL failure of the
 * provider / transport / parse (§14): provider total failure, unrecoverable
 * response, complete parse failure.
 *
 * Model config (§12): deepseek-v4-pro via the CURRENT provider contract,
 * temperature 0.65, max_tokens 2048, thinking disabled. §13: measured honestly
 * under the 15s attempt window; the window is NOT silently changed.
 *
 * @version legacy6q_v1
 */

const { normalizeFacts6Q, DIAGNOSTIC_VERSION } = require('./legacy6qContract.js')
const { buildLegacy6QPrompt } = require('./legacy6qPrompt.js')
const { parseLegacy6QReport } = require('./legacy6qParser.js')
const { inspectLegacy6QReport } = require('./legacy6qGuards.js')

// §14 — single generation. Model-first; no whole-report regeneration.
const MAX_MODEL_ATTEMPTS = 1
const ATTEMPT_TIMEOUT_MS = 15000
// §12 — closest viable legacy behaviour.
const REPORT_MAX_TOKENS = 2048
const REPORT_TEMPERATURE = 0.65
const THINKING_DISABLED = { thinking: { type: 'disabled' } }

function withTimeout (p, ms) {
  return new Promise((resolve) => {
    let done = false
    const t = setTimeout(() => { if (!done) { done = true; resolve({ success: false, error: 'ATTEMPT_TIMEOUT', timeout: true }) } }, ms)
    Promise.resolve(p).then((v) => { if (!done) { done = true; clearTimeout(t); resolve(v) } })
      .catch((e) => { if (!done) { done = true; clearTimeout(t); resolve({ success: false, error: (e && e.message) || String(e) }) } })
  })
}

function buildInvalidInput6Q (errors) {
  return {
    reportType: 'turnaround_6q',
    diagnosticVersion: DIAGNOSTIC_VERSION,
    reportState: 'INVALID_INPUT',
    inputErrors: Array.isArray(errors) ? errors : [],
    system_trap: '', core_problem: '', fatal_sentence: '', strategy_path: '', advice: [],
    personality: null,
    _meta: { renderSource: 'invalid_input', parsePath: 'NONE', fallbackFields: [], latencyMs: 0, modelCalls: 0 },
  }
}

/**
 * @param {object} args
 *   event  — cloud function event (answers + optional personality/lastPersonality)
 *   callAI — the injected provider wrapper (lib/ai.js callAI)
 *   model  — resolved model id (current provider contract; NEVER an obsolete alias)
 * @returns {object} public 5-field envelope + _meta (presence-only observability)
 */
async function runLegacy6QReport (args) {
  const a = args || {}
  const event = a.event || {}
  const callAI = a.callAI
  const model = a.model // may be undefined → callAI resolves from env (no alias hardcoded)
  const attemptTimeoutMs = Number(a.attemptTimeoutMs) > 0 ? Number(a.attemptTimeoutMs) : ATTEMPT_TIMEOUT_MS

  const nf = normalizeFacts6Q(event.answers || event)
  if (!nf.valid) return buildInvalidInput6Q(nf.errors)

  const lastPersonality = event.lastPersonality || event.last_personality || ''
  const built = buildLegacy6QPrompt(nf.facts, event.personality, lastPersonality)
  const { systemPrompt, userMessage, personality } = built

  const start = Date.now()
  let modelCalls = 0
  let attemptResults = []
  let accepted = null

  for (let i = 0; i < MAX_MODEL_ATTEMPTS; i++) {
    modelCalls++
    const callOpts = {
      systemPrompt,
      userMessage,
      maxTokens: REPORT_MAX_TOKENS,
      temperature: REPORT_TEMPERATURE,
      extraBody: THINKING_DISABLED,
    }
    if (model) callOpts.forceModel = model

    const r = await withTimeout(callAI(callOpts), attemptTimeoutMs)
    const ok = !!(r && r.success && r.content)
    const parsed = ok ? parseLegacy6QReport(r.content) : null

    attemptResults.push({
      attempt: i + 1,
      success: ok,
      latencyMs: (r && r.latencyMs) || 0,
      finishReason: (r && r.finishReason) || null,
      truncated: !!(r && r.truncated),
      hadReasoning: !!(r && r.hasReasoning),
      httpStatus: (r && r.httpStatus) || null,
      providerErrorCode: (r && r.providerErrorCode) || null,
      parsePath: parsed ? parsed.parsePath : 'NO_CONTENT',
      fallbackFields: parsed ? parsed.fallbackFields : [],
    })

    if (parsed && parsed.parsePath !== 'TOTAL_FAILURE') {
      accepted = { parsed, provider: r }
      break
    }
  }

  const latencyMs = Date.now() - start

  // Provider total failure / complete parse failure → deterministic whole-report
  // fallback. This is the ONLY permitted whole-report content fallback (§14).
  if (!accepted) {
    const last = attemptResults[attemptResults.length - 1] || {}
    const fallback = parseLegacy6QReport('').report // nothing recovered → deterministic body
    const guarded = inspectLegacy6QReport(fallback)
    return {
      reportType: 'turnaround_6q',
      diagnosticVersion: DIAGNOSTIC_VERSION,
      reportState: 'FALLBACK',
      ...guarded.safeReport,
      personality: personality || null,
      _meta: {
        renderSource: 'deterministic_fallback',
        parsePath: 'TOTAL_FAILURE',
        fallbackFields: ['system_trap', 'core_problem', 'fatal_sentence', 'strategy_path', 'advice'],
        latencyMs,
        modelCalls,
        attempts: attemptResults,
        providerErrorCode: last.providerErrorCode || null,
        httpStatus: last.httpStatus || null,
      },
    }
  }

  const { parsed, provider } = accepted
  const guarded = inspectLegacy6QReport(parsed.report)

  return {
    reportType: 'turnaround_6q',
    diagnosticVersion: DIAGNOSTIC_VERSION,
    reportState: 'PRIMARY',
    system_trap: guarded.safeReport.system_trap,
    core_problem: guarded.safeReport.core_problem,
    fatal_sentence: guarded.safeReport.fatal_sentence,
    strategy_path: guarded.safeReport.strategy_path,
    advice: guarded.safeReport.advice,
    personality: personality || null,
    _meta: {
      renderSource: 'ai',
      parsePath: parsed.parsePath,
      fallbackFields: parsed.fallbackFields,
      guardViolations: guarded.violations,
      latencyMs,
      modelCalls,
      finishReason: provider.finishReason || null,
      truncated: !!provider.truncated,
      tokens: provider.tokens || 0,
      attempts: attemptResults,
    },
  }
}

module.exports = {
  runLegacy6QReport,
  MAX_MODEL_ATTEMPTS,
  ATTEMPT_TIMEOUT_MS,
  REPORT_MAX_TOKENS,
  REPORT_TEMPERATURE,
  THINKING_DISABLED,
}
