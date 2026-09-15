'use strict'
/**
 * turnaroundStrategy/v6/experimental/draft/draftAdapterV6.js
 *
 * R11_V2 — AI WORLDVIEW DRAFT adapter (B2.3-v2).
 *
 * Produces DRAFT MATERIAL only. Does NOT validate semantics (that is the draft
 * validator's job) and does NOT build final cards (that is the editor's job).
 *
 * BOUNDARY:
 *   MODEL_DIAGNOSIS_AUTHORITY = NONE
 *   The provider client is INJECTED (default = existing lib/ai.js callAI), so the
 *   experiment runs against the existing DeepSeek provider OR a stub.
 *
 * Model selection (R10 finding): the V6 path must NOT silently inherit
 * AI_MODEL_PRO. Callers pass an explicit model; this module never reads
 * AI_MODEL_PRO itself.
 */

const DEFAULT_CALL_AI = (() => {
  try { return require('../../../../ai.js').callAI } catch (_) { return null }
})()

const { buildDraftPrompt, DRAFT_VERSION, DRAFT_PROMPT_VERSION, DRAFT_LIMITS } = require('./draftPromptV6.js')

/**
 * Robustly extract a single JSON object from model text.
 * Handles ```json fences and prefers the FIRST balanced object so that a
 * trailing duplicate object cannot poison the parse (a failure mode observed
 * in R10 with deepseek-flash).
 */
function extractJsonObject (text) {
  if (!text) return { ok: false, error: 'EMPTY' }
  let s = String(text).trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const start = s.indexOf('{')
  if (start < 0) return { ok: false, error: 'NO_JSON_OBJECT' }

  // Walk to the matching close brace, honouring strings/escapes.
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (esc) { esc = false } else if (ch === '\\') { esc = true } else if (ch === '"') { inStr = false }
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) {
      const candidate = s.slice(start, i + 1)
      try { return { ok: true, value: JSON.parse(candidate), truncated: false } } catch (e) {
        return { ok: false, error: 'JSON_PARSE_ERROR: ' + e.message }
      }
    } }
  }
  // Balanced object never closed => truncated output.
  return { ok: false, error: 'JSON_TRUNCATED' }
}

function strLen (s) { return s == null ? 0 : [...String(s)].length }

/** Shape-normalise a parsed draft; never invents content. */
function normalizeDraft (value) {
  const v = value && typeof value === 'object' ? value : {}
  const candidates = Array.isArray(v.insightCandidates)
    ? v.insightCandidates.filter((x) => typeof x === 'string' && x.trim().length > 0).map((x) => String(x).trim())
    : []
  return {
    draftVersion: v.draftVersion || DRAFT_VERSION,
    insightCandidates: candidates,
    mechanismExplanation: typeof v.mechanismExplanation === 'string' ? v.mechanismExplanation.trim() : '',
    transitionExplanation: typeof v.transitionExplanation === 'string' ? v.transitionExplanation.trim() : '',
    actionExplanation: typeof v.actionExplanation === 'string' ? v.actionExplanation.trim() : ''
  }
}

/** Per-field length report (diagnostics only, no content). */
function draftFieldLengths (draft) {
  return {
    insightCandidates: draft.insightCandidates.map(strLen),
    mechanismExplanation: strLen(draft.mechanismExplanation),
    transitionExplanation: strLen(draft.transitionExplanation),
    actionExplanation: strLen(draft.actionExplanation)
  }
}

/**
 * Run the isolated draft adapter.
 * @returns {Promise<{ok, draft, raw, error, meta}>}
 */
async function runDraftAdapter (payload, opts) {
  const o = opts || {}
  const callAI = o.callAI || DEFAULT_CALL_AI
  if (typeof callAI !== 'function') return { ok: false, error: 'NO_CALL_AI', draft: null }
  const prompt = buildDraftPrompt(payload)
  const ai = await callAI({
    systemPrompt: prompt.systemPrompt,
    userMessage: prompt.userMessage,
    maxTokens: o.maxTokens || 1400,
    temperature: o.temperature != null ? o.temperature : 0,
    forceModel: o.forceModel
  })
  const meta = { promptVersion: DRAFT_PROMPT_VERSION }
  if (!ai || !ai.success) {
    return { ok: false, error: (ai && (ai.providerErrorCode || ai.error)) || 'AI_CALL_FAILED', draft: null, meta }
  }
  const parsed = extractJsonObject(ai.content)
  meta.finishReason = ai.finishReason || null
  meta.tokens = ai.tokens || 0
  meta.rawLen = strLen(ai.content)
  if (!parsed.ok) return { ok: false, error: parsed.error, raw: ai.content, draft: null, meta }
  const draft = normalizeDraft(parsed.value)
  meta.fieldLengths = draftFieldLengths(draft)
  return { ok: true, draft, raw: ai.content, meta }
}

module.exports = {
  DRAFT_VERSION,
  DRAFT_PROMPT_VERSION,
  DRAFT_LIMITS,
  extractJsonObject,
  normalizeDraft,
  draftFieldLengths,
  runDraftAdapter
}
