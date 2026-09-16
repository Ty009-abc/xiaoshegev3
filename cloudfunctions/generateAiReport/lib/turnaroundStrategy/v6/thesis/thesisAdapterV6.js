'use strict'
/**
 * turnaroundStrategy/v6/thesis/thesisAdapterV6.js
 *
 * RC8.4 V6 R57 — ONE-CALL shared-strategic-thesis adapter.
 *
 * Runs EXACTLY ONE model call per report (no second rewriting call). The
 * provider client is INJECTED (default = existing lib/ai.js callAI). The model
 * receives the deterministic envelope and returns thesis + five cards.
 *
 * BOUNDARY: MODEL_DIAGNOSIS_AUTHORITY = NONE. The model never re-derives or
 * contradicts the diagnosis; it only interprets inside the envelope.
 */

const DEFAULT_CALL_AI = (() => {
  // R59 FIX — correct path: lib/ai.js (was ../../../../ai.js → nonexistent,
  // so the production default resolved to null and every report fell back
  // with NO_CALL_AI).
  try { return require('../../../ai.js').callAI } catch (_) { return null }
})()

// R59 — the thesis expression call is NOT a deep reasoning task (B1 / proof /
// scope / migration authority is already computed deterministically). Ask the
// provider for normal content directly, WITHOUT spending the token budget on
// hidden reasoning. Scoped to THIS call only (via callAI extraBody) — never a
// global provider/model change.
const THESIS_EXPRESSION_MODE = { thinking: { type: 'disabled' } }

// Smallest practical output budget that reliably contains thesis + 5 cards
// (real-provider benchmark: no truncation, finish_reason=stop).
const THESIS_DEFAULT_MAX_TOKENS = 1800

const { buildThesisPrompt, PROMPT_VERSION } = require('./thesisPromptV6.js')

/** Robustly extract ONE balanced JSON object (fence-aware, duplicate-safe). */
function extractJsonObject (text) {
  if (!text) return { ok: false, error: 'EMPTY' }
  let s = String(text).trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const start = s.indexOf('{')
  if (start < 0) return { ok: false, error: 'NO_JSON_OBJECT' }
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const candidate = s.slice(start, i + 1)
        try { return { ok: true, value: JSON.parse(candidate), truncated: false } } catch (e) { return { ok: false, error: 'JSON_PARSE_ERROR: ' + e.message } }
      }
    }
  }
  return { ok: false, error: 'JSON_TRUNCATED' }
}

/** Shape-normalise a parsed output; never invents content. */
function normalizeThesisOutput (value) {
  const v = value && typeof value === 'object' ? value : {}
  const st = v.strategicThesis && typeof v.strategicThesis === 'object' ? v.strategicThesis : {}
  const cards = v.cards && typeof v.cards === 'object' ? v.cards : {}
  const str = (x) => (typeof x === 'string' ? x.trim() : '')
  const wr = st.worldRule && typeof st.worldRule === 'object' ? st.worldRule : {}
  const mig = st.strategicMigration && typeof st.strategicMigration === 'object' ? st.strategicMigration : {}
  const c4 = cards.card04 && typeof cards.card04 === 'object' ? cards.card04 : {}
  const c5 = cards.card05 && typeof cards.card05 === 'object' ? cards.card05 : {}
  return {
    strategicThesis: {
      identityInterpretation: str(st.identityInterpretation),
      coreContradiction: str(st.coreContradiction),
      structuralMechanism: str(st.structuralMechanism),
      worldRule: { id: str(wr.id), expression: str(wr.expression) },
      strategicMigration: { from: str(mig.from) || str(c4.from), to: str(mig.to) || str(c4.to), logic: str(mig.logic) || str(c4.logic) },
      commercialHypothesis: str(st.commercialHypothesis),
      actionThesis: str(st.actionThesis)
    },
    cards: {
      card01: str(cards.card01),
      card02: str(cards.card02),
      card03: Array.isArray(cards.card03)
        ? cards.card03.map(str).filter(Boolean)
        : (typeof cards.card03 === 'string' ? [str(cards.card03)] : []),
      card04: { from: str(c4.from) || str(mig.from), to: str(c4.to) || str(mig.to), logic: str(c4.logic) || str(mig.logic) },
      card05: {
        primary: str(c5.primary),
        supporting: Array.isArray(c5.supporting) ? c5.supporting.map(str).filter(Boolean) : [],
        target: str(c5.target),
        timebox: str(c5.timebox),
        successSignal: str(c5.successSignal)
      }
    }
  }
}

/** Flatten an output to user-visible text for forbidden-token scans. */
function visibleTextOf (out) {
  const o = normalizeThesisOutput(out)
  const c = o.cards
  const st = o.strategicThesis
  return [
    st.identityInterpretation, st.coreContradiction, st.structuralMechanism,
    st.worldRule.expression, st.strategicMigration.logic, st.commercialHypothesis, st.actionThesis,
    c.card01, c.card02, c.card03.join(' '), c.card04.from, c.card04.to, c.card04.logic,
    c.card05.primary, c.card05.supporting.join(' '), c.card05.target, c.card05.timebox, c.card05.successSignal
  ].filter(Boolean).join('\n')
}

/**
 * Run the ONE thesis call.
 * @returns {Promise<{ok, output, raw, error, meta}>}
 */
async function runThesisAdapter (envelope, fallbackCards, opts) {
  const o = opts || {}
  const callAI = o.callAI || DEFAULT_CALL_AI
  if (typeof callAI !== 'function') return { ok: false, error: 'NO_CALL_AI', output: null }
  const prompt = buildThesisPrompt(envelope, fallbackCards)
  const ai = await callAI({
    systemPrompt: prompt.systemPrompt,
    userMessage: prompt.userMessage,
    maxTokens: o.maxTokens != null ? o.maxTokens : THESIS_DEFAULT_MAX_TOKENS,
    temperature: o.temperature != null ? o.temperature : 0.6,
    forceModel: o.forceModel,
    // Per-call expression mode; does NOT mutate global provider behavior.
    // An injected test callAI may ignore unknown option keys.
    extraBody: o.extraBody != null ? o.extraBody : THESIS_EXPRESSION_MODE
  })
  const meta = { promptVersion: PROMPT_VERSION }
  if (!ai || !ai.success) return { ok: false, error: (ai && (ai.providerErrorCode || ai.error)) || 'AI_CALL_FAILED', output: null, meta }
  const parsed = extractJsonObject(ai.content)
  meta.finishReason = ai.finishReason || null
  meta.tokens = ai.tokens || 0
  meta.rawLen = ai.content ? [...String(ai.content)].length : 0
  if (!parsed.ok) return { ok: false, error: parsed.error, raw: ai.content, output: null, meta }
  return { ok: true, output: normalizeThesisOutput(parsed.value), raw: ai.content, meta }
}

module.exports = { runThesisAdapter, extractJsonObject, normalizeThesisOutput, visibleTextOf, PROMPT_VERSION, THESIS_EXPRESSION_MODE, THESIS_DEFAULT_MAX_TOKENS }
