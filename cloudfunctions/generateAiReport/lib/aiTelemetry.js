'use strict'
/**
 * lib/aiTelemetry.js — RC8.9C_R1A canonical v2 AI telemetry core.
 *
 * ONE v2 row per REAL outbound provider attempt (operation='model_call').
 * Reuses the EXISTING `ai_logs` collection (NO new collection).
 *
 * Emitted at the provider-call boundary (lib/ai.js callAI) — see lib/ai.js.
 *
 * HARD RULES
 *  - Pure RULE fallback with NO provider call ⇒ NO model_call row.
 *  - Missing usage ⇒ tokens null (NEVER 0). Unknown model ⇒ cost null (NEVER 0).
 *  - Write failure is NON-BLOCKING (never breaks a user report) but OBSERVABLE
 *    (server log 'TELEMETRY_WRITE_FAILED'). Never a silent empty .catch().
 *  - NEVER persist: prompt body, API key, authorization header, full provider
 *    response, chain-of-thought, payment data.
 */

const MAX_ATTEMPTS = 3
const RETRY_BACKOFF_MS = 250

const { estimateCostCny } = require('./aiPricing.js')

const STATUS = {
  SUCCESS: 'SUCCESS',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  TIMEOUT: 'TIMEOUT',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
}

/** Map a callAI result → canonical v2 status. */
function mapStatus (r, explicit) {
  if (explicit) return explicit
  if (r && r.success) return STATUS.SUCCESS
  const code = (r && r.providerErrorCode) || ''
  if (code === 'AI_PROVIDER_TIMEOUT') return STATUS.TIMEOUT
  if (code === 'AI_PROVIDER_EMPTY_RESPONSE' || code === 'AI_PROVIDER_INVALID_RESPONSE') return STATUS.INVALID_RESPONSE
  if (code === 'AI_PROVIDER_NO_KEY') return STATUS.PROVIDER_ERROR
  if (code) return STATUS.PROVIDER_ERROR
  return STATUS.PROVIDER_ERROR
}

/** Extract tokens from a provider usage object (or null when absent). */
function extractTokens (usage) {
  if (!usage || typeof usage !== 'object') return { inputTokens: null, outputTokens: null, totalTokens: null }
  const pick = (...vals) => {
    for (const v of vals) if (typeof v === 'number' && isFinite(v)) return v
    return null
  }
  const inputTokens = pick(usage.prompt_tokens, usage.input_tokens)
  const outputTokens = pick(usage.completion_tokens, usage.output_tokens)
  let totalTokens = pick(usage.total_tokens)
  if (totalTokens === null && (inputTokens !== null || outputTokens !== null)) {
    totalTokens = (inputTokens || 0) + (outputTokens || 0)
  }
  return { inputTokens, outputTokens, totalTokens }
}

/**
 * Build the canonical v2 row. Returns null when this is NOT a real provider
 * attempt (e.g. callAI resolved without an API key ⇒ no network call).
 */
function buildV2Row (r, meta) {
  const m = meta || {}
  const provider = (r && r.providerTrace && r.providerTrace.provider) || m.provider || null
  const model = (r && r.providerTrace && r.providerTrace.model) || m.model || null
  // requestAttempted may arrive via meta OR the call result's providerTrace
  // (the single source of truth for "a real outbound attempt happened").
  const requestAttempted = (m.requestAttempted === true) || !!(r && r.providerTrace && r.providerTrace.requestAttempted === true)
  if (!requestAttempted) return null // no outbound call → no model_call row
  const t = extractTokens(r && r.usage)
  const status = mapStatus(r, m.status)
  const ts = m.ts || Date.now()
  const pricing = estimateCostCny({
    provider,
    model,
    inputTokens: t.inputTokens,
    outputTokens: t.outputTokens,
    tsMs: ts,
  })
  return {
    telemetryVersion: 2,
    operation: 'model_call',
    createdAt: ts,
    requestId: m.requestId || null,
    reportId: m.reportId || null,
    productLine: m.productLine || null,
    diagnosticVersion: m.diagnosticVersion || null,
    provider,
    model,
    status,
    inputTokens: t.inputTokens,
    outputTokens: t.outputTokens,
    totalTokens: t.totalTokens,
    latencyMs: (typeof m.latencyMs === 'number' && isFinite(m.latencyMs)) ? m.latencyMs : null,
    estimatedCostCny: (pricing.estimatedCostCny === undefined ? null : pricing.estimatedCostCny),
    currency: pricing.currency || 'CNY',
    costReason: pricing.costReason || null,
    priceBasis: pricing.priceBasis || null,
    priceVersion: pricing.priceVersion || null,
    errorType: status === STATUS.SUCCESS ? null : ((r && r.providerErrorCode) || (status === STATUS.TIMEOUT ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_ERROR')),
    errorCode: (r && r.httpStatus) || null,
    openid: m.openid || null,
    // optional
    renderSource: m.renderSource || null,
    attempt: (typeof m.attempt === 'number') ? m.attempt : null,
    parsePath: m.parsePath || null,
  }
}

function sleep (ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

/**
 * Persist a v2 row to ai_logs. NON-BLOCKING + OBSERVABLE.
 * @returns Promise<{written:boolean, attempts:number, error?:string}>
 */
async function persistV2 (db, row) {
  if (!row) return { written: false, attempts: 0, error: 'NO_ROW' }
  let lastErr = null
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      await db.collection('ai_logs').add({ data: row })
      return { written: true, attempts: i }
    } catch (e) {
      lastErr = (e && e.message) || String(e)
      if (i < MAX_ATTEMPTS) await sleep(RETRY_BACKOFF_MS * i)
    }
  }
  console.error('TELEMETRY_WRITE_FAILED', JSON.stringify({
    operation: row.operation,
    telemetryVersion: row.telemetryVersion,
    model: row.model,
    status: row.status,
    attempts: MAX_ATTEMPTS,
    error: lastErr,
  }))
  return { written: false, attempts: MAX_ATTEMPTS, error: lastErr }
}

/**
 * Fire-and-forget emit. NEVER throws, NEVER changes the AI result.
 * `onResult` (optional) receives the persist outcome for tests/observability.
 */
function emitModelCall (db, r, meta) {
  let row
  try {
    row = buildV2Row(r, meta)
  } catch (e) {
    console.error('TELEMETRY_WRITE_FAILED', JSON.stringify({ stage: 'build', error: (e && e.message) || String(e) }))
    return Promise.resolve({ written: false, attempts: 0, error: 'BUILD_FAILED' })
  }
  if (!row) return Promise.resolve({ written: false, attempts: 0, error: 'NO_PROVIDER_ATTEMPT' })
  const p = persistV2(db, row).catch((e) => {
    console.error('TELEMETRY_WRITE_FAILED', JSON.stringify({ stage: 'persist', error: (e && e.message) || String(e) }))
    return { written: false, attempts: MAX_ATTEMPTS, error: 'UNEXPECTED' }
  })
  return p
}

/**
 * Emit ONE v2 row per REAL provider attempt from runtime attemptResults.
 * Only attempts with requestAttempted===true produce a row (pure fallback w/o a
 * provider call produces NOTHING). Non-blocking for every row.
 * @param ctx { requestId, reportId, productLine, diagnosticVersion, openid, renderSource, ts }
 */
function emitAttempts (db, attempts, ctx) {
  const c = ctx || {}
  const jobs = []
  for (const a of (attempts || [])) {
    if (!a || a.requestAttempted !== true) continue
    const result = {
      success: a.success === true,
      providerErrorCode: a.providerErrorCode || (a.timeout ? 'AI_PROVIDER_TIMEOUT' : null),
      httpStatus: a.httpStatus || null,
      providerTrace: { provider: a.provider || null, model: a.model || null, requestAttempted: a.requestAttempted === true },
      usage: a.usage || null,
    }
    jobs.push(emitModelCall(db, result, {
      requestId: c.requestId,
      reportId: c.reportId,
      productLine: c.productLine,
      diagnosticVersion: c.diagnosticVersion,
      openid: c.openid,
      renderSource: c.renderSource,
      ts: c.ts,
      latencyMs: a.latencyMs,
      attempt: a.attempt,
      status: a.timeout ? STATUS.TIMEOUT : undefined,
    }))
  }
  return Promise.all(jobs)
}

module.exports = {
  STATUS,
  MAX_ATTEMPTS,
  mapStatus,
  extractTokens,
  buildV2Row,
  persistV2,
  emitModelCall,
  emitAttempts,
}
