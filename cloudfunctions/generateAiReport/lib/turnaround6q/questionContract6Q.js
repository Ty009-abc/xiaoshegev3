'use strict'
/**
 * cloudfunctions/generateAiReport/lib/turnaround6q/questionContract6Q.js
 *
 * RC8.8 — server-side contract + validation for the 6Q product line.
 * Single authoritative fact model. Mirrors the client module exactly.
 *
 * @version turnaround_strategy_6q_v1
 */

const QUESTIONNAIRE_VERSION = 'turnaround_strategy_6q_v1'
const QUESTION_COUNT = 6

// canonical order + the exact payload keys
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

function s (v) { return (v === undefined || v === null) ? '' : String(v) }

/**
 * Normalize + validate the raw 6Q answers. Raw Q2/Q5/Q6 text is preserved
 * verbatim (trimmed only) — never reduced to optionIds.
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

module.exports = { QUESTIONNAIRE_VERSION, QUESTION_COUNT, FACT_KEYS, FACT_LABELS, MAXLEN, normalizeFacts6Q }
