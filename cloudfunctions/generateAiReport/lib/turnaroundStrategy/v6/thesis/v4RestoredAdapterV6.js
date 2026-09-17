'use strict'
/**
 * turnaroundStrategy/v6/thesis/v4RestoredAdapterV6.js
 *
 * RC8.4 V6 R70 — ONE-CALL V4-restored adapter.
 *
 * Runs EXACTLY ONE model call per report (no second rewriting call). The
 * provider client is INJECTED (default = lib/ai.js callAI). The model receives
 * the COMPLETE user profile + diagnostic context and returns ONE strategicThesis
 * + five cards.
 *
 * BOUNDARY: MODEL_DIAGNOSIS_AUTHORITY = NONE. No card/fact authority is
 * derived here; the adapter only transports + shape-normalises.
 */

const DEFAULT_CALL_AI = (() => {
  try { return require('../../../ai.js').callAI } catch (_) { return null }
})()

// R70 §18 — the restored expression call is NOT a hidden-reasoning task.
// Ask the provider for normal content directly; does NOT mutate global provider.
const V4R_EXPRESSION_MODE = { thinking: { type: 'disabled' } }

// R70 §18 — enough for thesis + five rich cards (real-provider calibrated).
const V4R_DEFAULT_MAX_TOKENS = 2200

const { buildV4RestoredPrompt, PROMPT_VERSION } = require('./v4RestoredPromptV6.js')

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

/** Shape-normalise the V4-restored output; never invents content. */
function normalizeV4RestoredOutput (value) {
  const v = value && typeof value === 'object' ? value : {}
  const st = v.strategicThesis && typeof v.strategicThesis === 'object' ? v.strategicThesis : {}
  const cards = v.cards && typeof v.cards === 'object' ? v.cards : {}
  const str = (x) => (typeof x === 'string' ? x.trim() : '')
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x)) ? x : {}
  const arr = (x) => Array.isArray(x) ? x.map(str).filter(Boolean) : (typeof x === 'string' && x.trim() ? [str(x)] : [])
  const mig = obj(st.strategicMigration) // allow object with from/to/steps
  const ct = obj(st.commercialThesis)
  const c4 = cards.card04 && typeof cards.card04 === 'object' ? cards.card04 : {}
  const c5 = cards.card05 && typeof cards.card05 === 'object' ? cards.card05 : {}
  // R84-A §14 — actions may arrive as plain strings (legacy) OR as objects
  // carrying a Chinese MICRO-HEADING (title) + text. We expose BOTH shapes so
  // every existing consumer (string arrays) stays byte-compatible while the
  // visible layer can render the thesis-specific micro-heading.
  const rawActions = Array.isArray(c5.actions) && c5.actions.length ? c5.actions : c5.supporting
  const actionItems = (Array.isArray(rawActions) ? rawActions : []).map((x) => {
    if (typeof x === 'string') { const t = x.trim(); return t ? { title: '', text: t } : null }
    if (x && typeof x === 'object' && !Array.isArray(x)) {
      const title = str(x.title) || str(x.heading) || str(x.name) || str(x.label) || str(x.microTitle) || ''
      const text = str(x.text) || str(x.action) || str(x.detail) || str(x.body) || str(x.content) || str(x.desc) || ''
      if (!title && !text) return null
      return { title: title, text: text || title }
    }
    return null
  }).filter(Boolean)
  const actionsText = actionItems.map((a) => (a.title && a.text && a.title !== a.text) ? (a.title + '：' + a.text) : (a.text || a.title)).filter(Boolean)
  return {
    strategicThesis: {
      identityInterpretation: str(st.identityInterpretation),
      coreContradiction: str(st.coreContradiction),
      systemTrap: str(st.systemTrap),
      worldRule: str(st.worldRule),
      strategicMigration: {
        from: str(mig.from) || str(c4.from),
        to: str(mig.to) || str(c4.to),
        steps: arr(mig.steps).length ? arr(mig.steps) : arr(c4.steps)
      },
      commercialThesis: {
        objective: str(ct.objective),
        offer: str(ct.offer),
        buyer: str(ct.buyer),
        delivery: str(ct.delivery),
        distribution: str(ct.distribution),
        repeatSale: str(ct.repeatSale),
        productization: str(ct.productization),
        text: str(ct.text)
      }
    },
    cards: {
      card01: str(cards.card01),
      card02: str(cards.card02),
      card03: arr(cards.card03),
      card04: {
        from: str(c4.from) || str(mig.from),
        to: str(c4.to) || str(mig.to),
        steps: arr(c4.steps).length ? arr(c4.steps) : arr(mig.steps)
      },
      card05: {
        objective: str(c5.objective) || str(c5.primary),
        // legacy STRING array (all existing consumers stay byte-compatible)
        actions: actionsText.length ? actionsText : arr(c5.actions).concat(arr(c5.supporting)),
        // R84-A §14 — structured micro-heading + text
        actionItems: actionItems,
        primary: str(c5.primary) || str(c5.objective),
        supporting: arr(c5.supporting).length ? arr(c5.supporting) : actionsText,
        target: str(c5.target),
        timebox: str(c5.timebox),
        successSignal: str(c5.successSignal)
      }
    }
  }
}

/** Flatten an output to user-visible text for hard-ban scans. */
function visibleTextOf (out) {
  const o = normalizeV4RestoredOutput(out)
  const st = o.strategicThesis
  const c = o.cards
  return [
    st.identityInterpretation, st.coreContradiction, st.systemTrap, st.worldRule,
    st.strategicMigration.from, st.strategicMigration.to, st.strategicMigration.steps.join(' '),
    Object.keys(st.commercialThesis).map((k) => st.commercialThesis[k]).join(' '),
    c.card01, c.card02, c.card03.join(' '),
    c.card04.from, c.card04.to, c.card04.steps.join(' '),
    c.card05.objective, c.card05.actions.join(' '), c.card05.primary, c.card05.supporting.join(' '),
    c.card05.target, c.card05.timebox, c.card05.successSignal
  ].filter(Boolean).join('\n')
}

/**
 * Run the ONE V4-restored call.
 * @returns {Promise<{ok, output, raw, error, meta}>}
 */
async function runV4RestoredAdapter (payload, opts) {
  const o = opts || {}
  const callAI = o.callAI || DEFAULT_CALL_AI
  if (typeof callAI !== 'function') return { ok: false, error: 'NO_CALL_AI', output: null }
  const prompt = buildV4RestoredPrompt(payload)
  const ai = await callAI({
    systemPrompt: prompt.systemPrompt,
    userMessage: prompt.userMessage,
    maxTokens: o.maxTokens != null ? o.maxTokens : V4R_DEFAULT_MAX_TOKENS,
    temperature: o.temperature != null ? o.temperature : 0.7,
    forceModel: o.forceModel,
    extraBody: o.extraBody != null ? o.extraBody : V4R_EXPRESSION_MODE
  })
  const meta = { promptVersion: PROMPT_VERSION }
  if (!ai || !ai.success) return { ok: false, error: (ai && (ai.providerErrorCode || ai.error)) || 'AI_CALL_FAILED', output: null, meta }
  const parsed = extractJsonObject(ai.content)
  meta.finishReason = ai.finishReason || null
  meta.tokens = ai.tokens || 0
  meta.rawLen = ai.content ? [...String(ai.content)].length : 0
  if (!parsed.ok) return { ok: false, error: parsed.error, raw: ai.content, output: null, meta }
  return { ok: true, output: normalizeV4RestoredOutput(parsed.value), raw: ai.content, meta }
}

module.exports = {
  runV4RestoredAdapter,
  extractJsonObject,
  normalizeV4RestoredOutput,
  visibleTextOf,
  PROMPT_VERSION,
  V4R_EXPRESSION_MODE,
  V4R_DEFAULT_MAX_TOKENS
}
