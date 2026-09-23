'use strict'
/**
 * cloudfunctions/generateAiReport/lib/legacy6q/legacy6qParser.js
 *
 * RC8.8 Stage2 (§11/§14) — RESTORED legacy tolerant parser.
 *
 * Philosophy (legacy cfd3598b): PRESERVE THE MODEL OUTPUT. A whole-report
 * replacement is NEVER triggered by a content problem — only a complete,
 * unrecoverable parse failure falls back. One imperfect field is repaired/filled
 * AT FIELD LEVEL only; the other four are kept verbatim.
 *
 * Pipeline:
 *   1. strip markdown fences
 *   2. extract outer JSON object
 *   3. strip // comments
 *   4. repair trailing commas
 *   5. JSON.parse
 *   6. on parse failure → regex field recovery
 *   7. per-field default only for fields still missing
 *
 * @version legacy6q_v1
 */

const { OUTPUT_FIELDS } = require('./legacy6qContract.js')

// Deterministic per-field defaults — used ONLY for an individual missing field.
const FIELD_DEFAULTS = {
  system_trap: '系统信号中断，请稍后再试',
  core_problem: '暂时无法分析，点击重试',
  fatal_sentence: '☠️ 你还没有被系统审判，再试一次',
  strategy_path: '重新测试以获取精准策略',
}
const ADVICE_DEFAULT = ['点击重试按钮重新测试', '或联系客服反馈问题']

function _s (v) { return (v === undefined || v === null) ? '' : String(v) }

/** §11 steps 1–4: strip fences / extract outer braces / strip comments / fix commas. */
function cleanJSON6Q (raw) {
  let jsonStr = _s(raw)
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  const bracketMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (bracketMatch) jsonStr = bracketMatch[0]
  else return { ok: false, reason: 'NO_BRACKET_FOUND', jsonStr: '' }

  jsonStr = jsonStr
    .replace(/\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1')

  return { ok: true, jsonStr }
}

/** §11 step 6: regex field recovery from the RAW text when JSON.parse fails. */
function regexRecover6Q (raw) {
  const text = _s(raw)
  const grab = (key) => {
    const m = text.match(new RegExp('["\']?' + key + '["\']?\\s*[:：]\\s*["\']([^"\']*)["\']'))
    return m ? m[1] : ''
  }
  const adviceMatch = text.match(/["']?advice["']?\s*[:：]\s*\[([\s\S]*?)\]/)
  let advice = []
  if (adviceMatch) {
    advice = (adviceMatch[1].match(/["']([^"']*)["']/g) || [])
      .map((x) => x.replace(/^["']|["']$/g, ''))
      .filter((x) => x.trim().length > 0)
  }
  return {
    system_trap: grab('system_trap'),
    core_problem: grab('core_problem'),
    fatal_sentence: grab('fatal_sentence'),
    strategy_path: grab('strategy_path'),
    advice,
  }
}

/**
 * §11 step 7: fill ONLY fields still missing with deterministic defaults.
 * Returns a new object; present fields are preserved verbatim.
 */
function fillMissingFields6Q (parsed) {
  const p = parsed && typeof parsed === 'object' ? parsed : {}
  const out = {}
  for (const key of ['system_trap', 'core_problem', 'fatal_sentence', 'strategy_path']) {
    const v = _s(p[key]).trim()
    out[key] = v || FIELD_DEFAULTS[key]
  }
  // advice must be an array of non-empty strings (minimal §10 guard).
  const rawAdvice = Array.isArray(p.advice)
    ? p.advice
    : (typeof p.advice === 'string' && p.advice.trim() ? [p.advice] : [])
  const cleaned = rawAdvice.map((a) => _s(a).trim()).filter((a) => a.length > 0)
  out.advice = cleaned.length ? cleaned : ADVICE_DEFAULT.slice()
  return out
}

/**
 * Full tolerant parse.
 * @returns {{report:object, parsePath:string, fallbackFields:string[]}}
 *   parsePath ∈ {JSON_PARSE, REGEX_RECOVERY, TOTAL_FAILURE}
 *   fallbackFields = the OUTPUT fields that fell back to a deterministic default.
 */
function parseLegacy6QReport (raw) {
  let parsed = null
  let parsePath = ''

  const cleaned = cleanJSON6Q(raw)
  if (cleaned.ok) {
    try {
      parsed = JSON.parse(cleaned.jsonStr)
      parsePath = 'JSON_PARSE'
    } catch (_) {
      parsed = null
    }
  }

  // §11 step 6: regex field recovery (NOT a whole-report replacement).
  if (!parsed) {
    const recovered = regexRecover6Q(raw)
    const anyHit = OUTPUT_FIELDS.some((k) => (k === 'advice' ? (recovered.advice || []).length : _s(recovered[k]).trim()))
    parsed = recovered
    parsePath = anyHit ? 'REGEX_RECOVERY' : 'TOTAL_FAILURE'
  }

  const filled = fillMissingFields6Q(parsed)

  const fallbackFields = []
  if (_s(parsed.system_trap).trim() === '') fallbackFields.push('system_trap')
  if (_s(parsed.core_problem).trim() === '') fallbackFields.push('core_problem')
  if (_s(parsed.fatal_sentence).trim() === '') fallbackFields.push('fatal_sentence')
  if (_s(parsed.strategy_path).trim() === '') fallbackFields.push('strategy_path')
  const hadAdvice = Array.isArray(parsed.advice)
    ? parsed.advice.map((x) => _s(x).trim()).filter((x) => x).length > 0
    : (typeof parsed.advice === 'string' && parsed.advice.trim().length > 0)
  if (!hadAdvice) fallbackFields.push('advice')

  // TOTAL_FAILURE = NOTHING was recovered from the model output; the whole
  // report is deterministic. This is the ONLY case a whole-report fallback is
  // permitted for a content-shaped failure (§14).
  return { report: filled, parsePath, fallbackFields }
}

module.exports = { FIELD_DEFAULTS, ADVICE_DEFAULT, cleanJSON6Q, regexRecover6Q, fillMissingFields6Q, parseLegacy6QReport }
