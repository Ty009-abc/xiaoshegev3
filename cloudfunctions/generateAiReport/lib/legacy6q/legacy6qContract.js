'use strict'
/**
 * cloudfunctions/generateAiReport/lib/legacy6q/legacy6qContract.js
 *
 * RC8.8 Stage2 (§3/§7) — revived legacy 6Q fact contract + five-field business
 * contract.
 *
 * §3: the exact six product questions. Keys and raw wording preserved verbatim.
 *     age(number) / job(free text) / education(free text) / income(number) /
 *     anxiety(textarea, maxlength 300) / rootCause(textarea, maxlength 500).
 * §7: the output is EXACTLY five fields — system_trap, core_problem,
 *     fatal_sentence, strategy_path, advice[]. No system_loop[] / path_from /
 *     path_to / experiment / enums / diagnosis metadata.
 *
 * NO optionId. NO hidden profile transformation. NO bottleneck engine.
 * NO PRIMARY / NO_PRIMARY. NO diagnosis enum.
 *
 * @version legacy6q_v1
 */

const DIAGNOSTIC_VERSION = 'turnaround_strategy_6q_v1'
const QUESTION_COUNT = 6

// Canonical order + exact payload keys (legacy field names).
const FACT_KEYS = ['age', 'job', 'education', 'income', 'anxiety', 'rootCause']

const FACT_LABELS = {
  age: '年龄',
  job: '职业',
  education: '学历',
  income: '月收入',
  anxiety: '当前最焦虑',
  rootCause: '自认为翻不了身的原因',
}

const MAXLEN = { age: 3, job: 40, education: 20, income: 7, anxiety: 300, rootCause: 500 }

// The five-field business contract (§7). Order here is the JSON/schema order;
// the VISIBLE result-page order is different (fatal_sentence promoted to Card01).
const OUTPUT_FIELDS = ['system_trap', 'core_problem', 'fatal_sentence', 'strategy_path', 'advice']

function s (v) { return (v === undefined || v === null) ? '' : String(v) }

/**
 * Normalize + validate the raw 6Q answers. Raw job / anxiety / rootCause text is
 * preserved VERBATIM (trimmed only) — never sanitized into a taxonomy, never
 * reduced to optionIds.
 * @returns {{valid:boolean, facts:object|null, errors:string[]}}
 */
function normalizeFacts6Q (answers) {
  const a = answers || {}
  const errors = []
  const facts = {}
  for (const k of FACT_KEYS) {
    const v = s(a[k]).trim()
    if (!v) { errors.push('MISSING:' + k); continue }
    if (MAXLEN[k] && v.length > MAXLEN[k]) { errors.push('TOO_LONG:' + k); continue }
    if (k === 'age' || k === 'income') {
      if (!/^\d+$/.test(v)) { errors.push('NOT_NUMERIC:' + k); continue }
    }
    facts[k] = v
  }
  return { valid: errors.length === 0, facts: errors.length ? null : facts, errors }
}

module.exports = {
  DIAGNOSTIC_VERSION,
  QUESTION_COUNT,
  FACT_KEYS,
  FACT_LABELS,
  MAXLEN,
  OUTPUT_FIELDS,
  normalizeFacts6Q,
}
