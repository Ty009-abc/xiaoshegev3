'use strict'
/**
 * utils/turnaround6q/turnaround6qQuestionnaire.js
 *
 * RC8.8 — 6-question "翻身策略" refoundation (CLIENT single source of truth).
 *
 * Restores the OLD 6-question real-life product model (age / job / education /
 * income / anxiety / rootCause) on top of the CURRENT stable engineering
 * baseline. This is a SEPARATE product line from Native 9Q / V6: it does NOT
 * use the V6 diagnosis kernel and does NOT require PRIMARY / NO_PRIMARY.
 *
 * Core product principle (§3): Q2/Q5/Q6 preserve REAL USER LANGUAGE. They are
 * free-text and the raw text is forwarded verbatim — never reduced to optionIds.
 *
 * Pure data + pure helpers. No I/O, no wx, no AI, no network.
 *
 * @version turnaround_strategy_6q_v1 (client contract)
 */

const CONTRACT_VERSION = 'turnaround_strategy_6q_v1_contract'
const QUESTIONNAIRE_VERSION = 'turnaround_strategy_6q_v1'
const QUESTION_COUNT_6Q = 6

// Canonical order. `key` is the payload key (matches the legacy 6Q field names
// AND the §5 request contract). `inputMode` drives the input control.
const Q6_QUESTIONS = [
  {
    qid: 'Q1', key: 'age',
    title: '你今年几岁？',
    subtitle: '年龄决定你的牌桌大小',
    inputMode: 'number',
    placeholder: '请输入数字',
    maxlength: 3, min: 1, max: 120,
  },
  {
    qid: 'Q2', key: 'job',
    title: '你现在做什么工作？',
    subtitle: '职业是你当前的筹码形式',
    inputMode: 'text',
    placeholder: '例如：厨师 / 销售 / 程序员',
    maxlength: 40,
  },
  {
    qid: 'Q3', key: 'education',
    title: '你的学历？',
    subtitle: '学历在这张牌桌上并不决定一切',
    inputMode: 'text',
    placeholder: '例如：高中 / 大专 / 本科 / 硕士',
    maxlength: 20,
  },
  {
    qid: 'Q4', key: 'income',
    title: '你现在月收入多少？',
    subtitle: '收入 = 认知在这个世界的兑现速度',
    inputMode: 'number',
    placeholder: '请输入数字（元）',
    maxlength: 7, min: 0, max: 10000000,
  },
  {
    qid: 'Q5', key: 'anxiety',
    title: '你现在最焦虑什么？',
    subtitle: '焦虑是你看懂规则的第一步',
    inputMode: 'textarea',
    placeholder: '认真说一次真话…',
    maxlength: 300,
  },
  {
    qid: 'Q6', key: 'rootCause',
    title: '你觉得自己为什么翻不了身？',
    subtitle: '⚠️ 这里决定 AI 分析深度，请认真作答',
    inputMode: 'textarea',
    placeholder: '坦诚面对自己，这是最关键的一问…',
    maxlength: 500,
  },
]

const REQUIRED_KEYS = ['age', 'job', 'education', 'income', 'anxiety', 'rootCause']

function _s (v) { return (v === undefined || v === null) ? '' : String(v) }

function getQuestions6Q () {
  return Q6_QUESTIONS.map((q) => Object.assign({}, q))
}

/**
 * Validate ONE field (used for per-step gating + keyboard "next").
 * @returns {string} error message, or '' when valid.
 */
function validateField6Q (q, value) {
  const v = _s(value).trim()
  if (!v) return '请填写这一题'
  if (q.maxlength && v.length > q.maxlength) return '内容太长，请精简一下'
  if (q.inputMode === 'number') {
    if (!/^\d+$/.test(v)) return '请输入数字'
    const n = Number(v)
    if (q.min !== undefined && n < q.min) return '数值太小了'
    if (q.max !== undefined && n > q.max) return '数值太大了'
  }
  return ''
}

/**
 * Validate a COMPLETE answer set.
 * @returns {{valid:boolean, errors:string[]}}
 */
function validateAnswers6Q (answers) {
  const errors = []
  const a = answers || {}
  for (const q of Q6_QUESTIONS) {
    const err = validateField6Q(q, a[q.key])
    if (err) errors.push(q.key + ': ' + err)
  }
  return { valid: errors.length === 0, errors }
}

/**
 * Normalize raw answers into the exact §5 payload answer object. Raw Q2/Q5/Q6
 * text is preserved verbatim (trimmed only).
 */
function normalizeAnswers6Q (answers) {
  const a = answers || {}
  const out = {}
  for (const q of Q6_QUESTIONS) out[q.key] = _s(a[q.key]).trim()
  return out
}

/**
 * Build the 6Q cloud request. New, clean contract — NEVER routed through
 * diagnoseTurnaroundV6(); no V6 authority, no previewMode.
 *
 * The selected persona (§5) is carried as `personality` (name) plus
 * `lastPersonality` so the server can honour the client's random
 * exclude-previous selection. Raw Q2/Q5/Q6 wording is forwarded verbatim.
 * @returns {{name:string, data:object}}
 */
function buildCloudRequest6Q (answers, personalityName, lastPersonality) {
  const data = {
    type: 'diagnostic',
    diagnosticVersion: QUESTIONNAIRE_VERSION,
    answers: normalizeAnswers6Q(answers),
  }
  if (personalityName) data.personality = personalityName
  if (lastPersonality) data.lastPersonality = lastPersonality
  return { name: 'generateAiReport', data }
}

module.exports = {
  CONTRACT_VERSION,
  QUESTIONNAIRE_VERSION,
  QUESTION_COUNT_6Q,
  REQUIRED_KEYS,
  Q6_QUESTIONS,
  getQuestions6Q,
  validateField6Q,
  validateAnswers6Q,
  normalizeAnswers6Q,
  buildCloudRequest6Q,
}
