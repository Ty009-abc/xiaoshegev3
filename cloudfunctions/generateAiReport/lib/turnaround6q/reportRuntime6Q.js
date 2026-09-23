'use strict'
/**
 * cloudfunctions/generateAiReport/lib/turnaround6q/reportRuntime6Q.js
 *
 * RC8.8 — 6Q report generation runtime.
 *
 *   R1    STABILIZATION: content-aware attempts + bounded retry + time budget + telemetry.
 *   R1.1  STRUCTURAL CONTRACT TRUTH: the overloaded MISSING_FIELDS bucket is gone;
 *         structural failures carry exact, independent codes; model-runtime success
 *         is defined by the 5-field contract (presence + types), NOT by policy.
 *
 *   6Q raw user facts
 *     → prompt (direct fact injection, thinking DISABLED)
 *     → attempt 1  → classify result (split structural codes)
 *        PASS (5 fields + types + policy OK) → semantic validator → done (AI draft)
 *        STRUCTURAL_FAIL (5 fields ok, policy failed) → NO auto-retry;
 *                                    safe mechanical normalization (§6) → ship or fallback
 *        missing/empty/type / invalid JSON / empty / reasoning → bounded retry
 *        non-retryable provider error → deterministic fallback (no retry)
 *     → deterministic fallback ONLY as last resort
 *
 * No V6 diagnosis authority; no bottleneck enum; no PRIMARY/NO_PRIMARY gate.
 *
 * @version turnaround_strategy_6q_v1
 */

const { normalizeFacts6Q } = require('./questionContract6Q.js')
const { buildSystemPrompt6Q, buildUserMessage6Q, getPersona, getRandomPersona6Q } = require('./promptBuilder6Q.js')
const {
  validateStructure6Q, validateRequiredFields6Q, validateFieldTypes6Q,
  validateStructuralPolicy6Q, requiredFieldsPresent, normalizeStructural6Q,
  validateSemantics6Q,
} = require('./reportValidator6Q.js')
const { buildFallbackReport6Q } = require('./fallbackReport6Q.js')

// ── R1 stabilization constants ──
const MAX_MODEL_ATTEMPTS = 2
const ATTEMPT_TIMEOUT_MS = 15000
const TOTAL_MODEL_BUDGET_MS = 30000
const REPORT_MAX_TOKENS = 1600
const REPORT_TEMPERATURE = 0.7
// Every 6Q model call MUST explicitly disable hidden reasoning. Never rely on
// the provider default: deepseek-v4-pro otherwise spends the whole max_tokens
// budget on reasoning_content and returns EMPTY visible content.
const THINKING_DISABLED = { thinking: { type: 'disabled' } }

// §6 — only these structural codes are likely improved by REGENERATION.
// Deterministic policy violations (length / advice count / loop count / enum leak)
// are NOT auto-retried; they get safe mechanical normalization instead.
const STRUCTURAL_RETRYABLE_CODES = new Set(['MISSING_REQUIRED_FIELD', 'EMPTY_REQUIRED_FIELD', 'FIELD_TYPE_INVALID'])

// ── prompt hardening: strip markdown fences / outer prose / trailing commas ──
function cleanJSON6Q (raw) {
  let t = String(raw == null ? '' : raw).trim()
  if (!t) return null
  t = t.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim()
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first >= 0 && last > first) t = t.slice(first, last + 1)
  t = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n\r]*/g, '$1')
  t = t.replace(/,\s*([}\]])/g, '$1')
  try { return JSON.parse(t) } catch (_) { return null }
}

// normalize an AI JSON object into the strict report contract
function normalizeReport6Q (obj) {
  const o = obj || {}
  const strArr = (v) => Array.isArray(v) ? v.map((x) => String(x == null ? '' : x).trim()).filter(Boolean) : []
  return {
    system_trap: String(o.system_trap == null ? '' : o.system_trap).trim(),
    system_loop: strArr(o.system_loop),
    core_problem: String(o.core_problem == null ? '' : o.core_problem).trim(),
    fatal_sentence: String(o.fatal_sentence == null ? '' : o.fatal_sentence).trim(),
    strategy_path: String(o.strategy_path == null ? '' : o.strategy_path).trim(),
    path_from: String(o.path_from == null ? '' : o.path_from).trim(),
    path_to: String(o.path_to == null ? '' : o.path_to).trim(),
    advice: strArr(o.advice),
    experiment: (o.experiment && typeof o.experiment === 'object') ? {
      goal: String(o.experiment.goal == null ? '' : o.experiment.goal).trim(),
      actions: strArr(o.experiment.actions),
      target: String(o.experiment.target == null ? '' : o.experiment.target).trim(),
      output: String(o.experiment.output == null ? '' : o.experiment.output).trim(),
      success_signal: String(o.experiment.success_signal == null ? '' : o.experiment.success_signal).trim(),
      time_horizon: String(o.experiment.time_horizon == null ? '' : o.experiment.time_horizon).trim(),
    } : null,
  }
}

// Race a promise against a per-attempt timeout. 6Q-LOCAL: does NOT modify the
// shared lib/ai.js (which keeps its own 60s timeout for every other feature).
function withTimeout (p, ms) {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => { if (!settled) { settled = true; resolve({ __timeout: true }) } }, ms)
    Promise.resolve(p).then(
      (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v) } },
      (e) => { if (!settled) { settled = true; clearTimeout(timer); resolve({ __error: e }) } },
    )
  })
}

// Non-recoverable provider failures must NOT be retried (§4).
function providerFailureRetryable (raw) {
  const code = String((raw && raw.providerErrorCode) || '')
  const status = raw && raw.httpStatus
  if (status === 401 || status === 403 || /AUTH|NO_KEY|UNAUTHORIZED|FORBIDDEN/i.test(code)) return false
  if (status === 400 || status === 404 || status === 422 || /INVALID_REQUEST|MODEL_NOT_ALLOWED|MODEL_NOT_FOUND|BAD_REQUEST/i.test(code)) return false
  if (status === 402 || status === 429 || /QUOTA|RATE_LIMIT|BALANCE|INSUFFICIENT/i.test(code)) return false
  if ((status >= 500) || /TIMEOUT|NETWORK|EMPTY_RESPONSE|UPSTREAM|CONNECTION/i.test(code)) return true
  return false
}

// §11 — EMPTY vs REASONING-ONLY must be classified separately and NEVER
// double-count the same attempt.
function isReasoningOnly (raw) {
  if (!raw) return false
  const emptyVisible = !String(raw.content == null ? '' : raw.content).trim()
  if (!emptyVisible) return false
  const evidence = raw.reasoningOnly === true ||
    raw.hasReasoning === true ||
    (typeof raw.reasoningContentLength === 'number' && raw.reasoningContentLength > 0) ||
    raw.finishReason === 'length'
  return !!evidence
}
function isEmptyVisibleContent (raw) {
  if (!raw) return false
  const emptyVisible = !String(raw.content == null ? '' : raw.content).trim()
  return emptyVisible && !isReasoningOnly(raw)
}

/**
 * Classify ONE provider attempt (§3 + R1.1 §1/§2). HTTP 200 alone is NOT success.
 * resultCategory ∈ PASS | STRUCTURAL_FAIL | EMPTY_VISIBLE_CONTENT | REASONING_ONLY |
 *                    INVALID_JSON | TIMEOUT | PROVIDER_ERROR
 *
 * STRUCTURAL_FAIL carries the EXACT structural codes (never a coarse bucket) and
 * is retryable ONLY when the codes are regeneration-fixable (§6).
 */
function classifyAttempt (raw) {
  if (!raw) return { category: 'PROVIDER_ERROR', retryable: false }
  if (raw.__error) return { category: 'PROVIDER_ERROR', retryable: false }
  if (raw.__timeout || raw.timedOut) return { category: 'TIMEOUT', retryable: true }
  if (raw.success !== true) {
    return { category: 'PROVIDER_ERROR', retryable: providerFailureRetryable(raw) }
  }
  const content = String(raw.content == null ? '' : raw.content)
  if (!content.trim()) {
    return isReasoningOnly(raw)
      ? { category: 'REASONING_ONLY', retryable: true }
      : { category: 'EMPTY_VISIBLE_CONTENT', retryable: true }
  }
  const parsed = cleanJSON6Q(content)
  if (!parsed) return { category: 'INVALID_JSON', retryable: true }
  const report = normalizeReport6Q(parsed)
  const struct = validateStructure6Q(report)
  if (struct.ok) return { category: 'PASS', retryable: false, report, struct, parsed }
  const retryable = struct.codes.some((c) => STRUCTURAL_RETRYABLE_CODES.has(c))
  return { category: 'STRUCTURAL_FAIL', retryable, report, struct, parsed, structuralCodes: struct.codes }
}

/**
 * Full per-draft assessment (§2 + §8). Separates EVERY signal so nothing is
 * conflated: provider visibility / parse / five fields / types / policy / semantic.
 */
function assessDraft6Q (report, facts) {
  const required = validateRequiredFields6Q(report)
  const types = validateFieldTypes6Q(report)
  const policy = validateStructuralPolicy6Q(report)
  const sem = validateSemantics6Q(report, facts)
  const fivePresent = requiredFieldsPresent(report)
  const typesValid = types.ok
  const policyOk = policy.ok
  const structuralOk = required.ok && types.ok && policy.ok
  const structuralCodes = [].concat(required.codes, types.codes, policy.codes)
  return {
    fiveFieldsPresent: fivePresent,
    requiredFieldTypesValid: typesValid,
    structuralPolicyPass: policyOk,
    structuralOk,
    semanticOk: sem.ok,
    structuralCodes,
    semanticErrors: sem.errors,
    factGroundingCount: sem.FACT_GROUNDING_COUNT,
    genericCopyCount: sem.GENERIC_COPY_COUNT,
    unsupportedFactCount: sem.UNSUPPORTED_FACT_COUNT,
    requiredErrors: required.errors,
    typeErrors: types.errors,
    policyErrors: policy.errors,
  }
}

function tally (counts, codes) { for (const c of codes) counts[c] = (counts[c] || 0) + 1; return counts }

/**
 * Run the 6Q report generation. `callAI` is injected so the runtime is testable
 * offline. Returns an envelope-shaped object (NOT wrapped in ok()).
 */
async function runTurnaround6QReport (args) {
  const a = args || {}
  const { event, callAI, model } = a
  const attemptTimeoutMs = Number(a.attemptTimeoutMs) > 0 ? Number(a.attemptTimeoutMs) : ATTEMPT_TIMEOUT_MS
  const totalBudgetMs = Number(a.totalBudgetMs) > 0 ? Number(a.totalBudgetMs) : TOTAL_MODEL_BUDGET_MS
  const temperature = Number.isFinite(Number(a.temperature)) ? Number(a.temperature) : REPORT_TEMPERATURE
  const answers = (event && event.answers) || {}

  const { valid, facts, errors } = normalizeFacts6Q(answers)
  if (!valid) {
    return {
      reportState: 'INVALID_INPUT',
      diagnosticVersion: 'turnaround_strategy_6q_v1',
      errors,
      cards: {},
    }
  }

  const persona = getPersona(event && event.personality) || getRandomPersona6Q()
  const systemPrompt = buildSystemPrompt6Q(persona)
  const userMessage = buildUserMessage6Q(facts)

  const startedAt = Date.now()
  const attemptResults = []
  const structuralErrorCounts = {}
  let retryReason = null
  let budgetSkipped = false
  let chosen = null            // { report, struct, sem, source }
  let overrejection = false    // 5 fields + types valid but semantic validator rejected
  let structuralCandidate = null // { report, struct } — a STRUCTURAL_FAIL draft (policy) held for normalization
  let normalizationApplied = null
  let normalizationFailedCodes = null
  let draftStructVerdict = null  // the MODEL DRAFT's own structural verdict (pre-fallback)
  let draftSemVerdict = null     // the MODEL DRAFT's own semantic verdict (pre-fallback)

  const callOnce = async (attemptNumber, note) => {
    const t0 = Date.now()
    const um = note ? userMessage + note : userMessage
    let raw
    if (typeof callAI !== 'function') {
      raw = { success: false, providerErrorCode: 'AI_PROVIDER_NO_KEY' }
    } else {
      try {
        raw = await withTimeout(callAI({
          systemPrompt,
          userMessage: um,
          forceModel: model,
          maxTokens: REPORT_MAX_TOKENS,
          temperature,
          extraBody: THINKING_DISABLED,
        }), attemptTimeoutMs)
      } catch (e) { raw = { __error: e } }
    }
    const latencyMs = Date.now() - t0
    const cls = classifyAttempt(raw)
    const visibleContent = !!(raw && raw.success === true && String(raw.content == null ? '' : raw.content).trim())
    const jsonParsed = !!cls.parsed
    const assess = jsonParsed ? assessDraft6Q(cls.report, facts) : null

    const row = {
      attemptNumber,
      latencyMs,
      finishReason: (raw && raw.finishReason) || null,
      visibleContentLength: raw && typeof raw.content === 'string' ? raw.content.length : 0,
      resultCategory: cls.category,
      visibleContent,
      jsonParsed,
      fiveFieldsPresent: assess ? assess.fiveFieldsPresent : false,
      requiredFieldTypesValid: assess ? assess.requiredFieldTypesValid : false,
      structuralPolicyPass: assess ? assess.structuralPolicyPass : false,
      semanticOk: assess ? assess.semanticOk : false,
      structuralCodes: assess ? assess.structuralCodes : [],
    }
    attemptResults.push(row)
    if (assess) tally(structuralErrorCounts, assess.structuralCodes)
    return { cls, assess }
  }

  const considerCandidate = (r, attemptNumber) => {
    if (r.cls.category === 'PASS') {
      const sem = r.cls.struct ? validateSemantics6Q(r.cls.report, facts) : null
      draftStructVerdict = r.cls.struct || null
      draftSemVerdict = sem
      if (sem && sem.ok) {
        if (!chosen) chosen = { report: r.cls.report, struct: r.cls.struct, sem, source: attemptNumber > 1 ? 'ai_regenerated' : 'ai_draft' }
      } else overrejection = true
    } else if (r.cls.category === 'STRUCTURAL_FAIL') {
      structuralCandidate = { report: r.cls.report, struct: r.cls.struct }
      draftStructVerdict = r.cls.struct
      if (r.cls.retryable) retryReason = 'STRUCTURAL_FAIL'
    } else if (r.cls.retryable) {
      retryReason = r.cls.category
    }
  }

  // ── attempt 1 ──
  const r1 = await callOnce(1, null)
  considerCandidate(r1, 1)

  // ── attempt 2 — ONLY for retryable failures, and ONLY if budget allows ──
  if (!chosen && retryReason) {
    const remaining = totalBudgetMs - (Date.now() - startedAt)
    if (remaining >= attemptTimeoutMs) {
      const note = '\n\n上一次输出不合格（' + retryReason + '）。请只输出一个合法的 JSON 对象，不要任何解释文字、不要 Markdown 代码块。'
      const r2 = await callOnce(2, note)
      considerCandidate(r2, 2)
    } else {
      budgetSkipped = true
    }
  }

  // ── §6 SAFE MECHANICAL NORMALIZATION (policy-only, meaning-preserving) ──
  // A deterministic policy violation (slightly too long / advice count off / loop
  // count off) is NOT regenerated; if the draft has all five fields + valid types
  // we repair it mechanically and, if it then validates, ship it.
  if (!chosen && structuralCandidate) {
    const cand = structuralCandidate
    const candRequired = validateRequiredFields6Q(cand.report)
    const candTypes = validateFieldTypes6Q(cand.report)
    if (candRequired.ok && candTypes.ok) {
      const norm = normalizeStructural6Q(cand.report)
      const st2 = validateStructure6Q(norm.report)
      normalizationApplied = norm.ops
      if (st2.ok) {
        const sem2 = validateSemantics6Q(norm.report, facts)
        if (sem2.ok) chosen = { report: norm.report, struct: st2, sem: sem2, source: 'ai_normalized' }
        else overrejection = true
      } else {
        normalizationFailedCodes = st2.codes
      }
    }
  }

  // ── finalize ──
  let report, struct, sem, usedFallback, renderSource
  let fallbackReason = null

  if (chosen) {
    report = chosen.report
    struct = chosen.struct
    sem = chosen.sem
    usedFallback = false
    renderSource = chosen.source
  } else {
    report = buildFallbackReport6Q(facts)
    struct = validateStructure6Q(report)
    sem = validateSemantics6Q(report, facts)
    usedFallback = true
    renderSource = 'deterministic_fallback'
    if (overrejection) fallbackReason = 'VALIDATOR_REJECT'
    else if (normalizationFailedCodes) fallbackReason = 'STRUCTURAL_REJECT:' + normalizationFailedCodes.join('|')
    else if (budgetSkipped) fallbackReason = 'INSUFFICIENT_BUDGET:' + (retryReason || '')
    else if (attemptResults.length >= MAX_MODEL_ATTEMPTS && retryReason) fallbackReason = 'RETRY_EXHAUSTED:' + retryReason
    else if (retryReason) fallbackReason = 'CONTENT_FAIL:' + retryReason
    else if (structuralCandidate) fallbackReason = 'STRUCTURAL_REJECT'
    else fallbackReason = 'PROVIDER_ERROR'
  }

  const cards = {
    fatalInsight: { title: '致命一句话', text: report.fatal_sentence },
    coreProblem: { title: '核心问题', text: report.core_problem },
    systemLoop: { title: '系统困局', steps: report.system_loop, insight: report.system_trap },
    turnaroundPath: { title: '翻身路径', from: report.path_from, to: report.path_to, worldRuleLine: report.strategy_path },
    firstAction: {
      title: '行动建议',
      visible: {
        goal: report.experiment ? report.experiment.goal : '',
        actions: (report.experiment && Array.isArray(report.experiment.actions)) ? report.experiment.actions : [],
        target: report.experiment ? report.experiment.target : '',
        output: report.experiment ? report.experiment.output : '',
        acceptance: report.experiment ? report.experiment.success_signal : '',
        timebox: report.experiment ? report.experiment.time_horizon : '',
      },
    },
  }

  const last = attemptResults[attemptResults.length - 1] || {}
  const modelLatencyMs = attemptResults.reduce((s, x) => s + (x.latencyMs || 0), 0)

  // ── §2/§8 SEPARATED SUCCESS SIGNALS — never conflated ──
  const providerVisibleSuccess = attemptResults.some((x) => x.visibleContent)
  const jsonParseSuccess = attemptResults.some((x) => x.jsonParsed)
  const fiveFieldsPresent = attemptResults.some((x) => x.fiveFieldsPresent)
  const requiredFieldTypesValid = attemptResults.some((x) => x.requiredFieldTypesValid)
  const structuralPolicyPass = attemptResults.some((x) => x.structuralPolicyPass) ||
    !!(chosen && chosen.struct && chosen.struct.ok)
  const semanticValidatorPass = !!(chosen && chosen.sem && chosen.sem.ok)
  const bestParsed = attemptResults.filter((x) => x.jsonParsed).slice(-1)[0] || null
  // §2 MODEL-RUNTIME success = visible content + JSON parsed + five fields exist
  // + required field types valid. INDEPENDENT of policy and of semantic validator.
  const modelRuntimePass = !!(bestParsed && bestParsed.fiveFieldsPresent && bestParsed.requiredFieldTypesValid)

  const _meta = {
    aiCallCount: attemptResults.length,
    attemptCount: attemptResults.length,
    attemptResults: attemptResults,
    finishReason: last.finishReason || null,
    visibleContentLength: last.visibleContentLength || 0,
    reasoningOnlyDetected: attemptResults.some((x) => x.resultCategory === 'REASONING_ONLY'),
    parseResult: jsonParseSuccess
      ? 'PARSED'
      : (attemptResults.some((x) => x.resultCategory === 'INVALID_JSON') ? 'INVALID_JSON' : 'EMPTY'),
    retryReason: retryReason,
    modelLatencyMs: modelLatencyMs,
    totalModelLatencyMs: Date.now() - startedAt,
    temperature,
    wholeReportFallback: usedFallback,
    fallbackReason: fallbackReason,
    // ── R1.1 SEPARATED SUCCESS SIGNALS (§2/§8) ──
    providerVisibleSuccess,
    jsonParseSuccess,
    fiveFieldsPresent,
    requiredFieldTypesValid,
    structuralPolicyPass,
    semanticValidatorPass,
    // Structural truth: EXACT code tallies across every attempt (never a coarse bucket)
    structuralErrorCounts,
    normalizationApplied: normalizationApplied || [],
    normalizationSource: (chosen && chosen.source === 'ai_normalized') || false,
    // §10 MODEL-RUNTIME success (5-field contract) — INDEPENDENT of validator policy
    modelRuntimePass,
    validatorOverrejectionCandidate: overrejection,
    // validator policy output (thresholds UNCHANGED in R1/R1.1)
    factGroundingCount: sem.FACT_GROUNDING_COUNT,
    genericCopyCount: sem.GENERIC_COPY_COUNT,
    unsupportedFactCount: sem.UNSUPPORTED_FACT_COUNT,
    // SHIPPED report verdict (what the user actually receives)
    structuralOk: struct.ok,
    semanticOk: sem.ok,
    // MODEL DRAFT verdict (pre-fallback)
    draftStructuralOk: draftStructVerdict ? draftStructVerdict.ok : struct.ok,
    draftSemanticOk: draftSemVerdict ? draftSemVerdict.ok : sem.ok,
    draftStructuralErrors: draftStructVerdict ? draftStructVerdict.errors : [],
    draftSemanticErrors: draftSemVerdict ? draftSemVerdict.errors : [],
    validatorErrors: [...struct.errors, ...sem.errors],
  }

  return {
    reportType: 'turnaround_6q',
    diagnosticVersion: 'turnaround_strategy_6q_v1',
    reportState: 'PRIMARY',
    primaryActive: true,
    renderSource,
    usedFallback,
    persona: { name: persona.name, emoji: persona.emoji },
    cards,
    _report: report,
    _meta,
  }
}

module.exports = {
  runTurnaround6QReport,
  cleanJSON6Q,
  normalizeReport6Q,
  classifyAttempt,
  assessDraft6Q,
  isReasoningOnly,
  isEmptyVisibleContent,
  MAX_MODEL_ATTEMPTS,
  ATTEMPT_TIMEOUT_MS,
  TOTAL_MODEL_BUDGET_MS,
  REPORT_TEMPERATURE,
  STRUCTURAL_RETRYABLE_CODES,
}
