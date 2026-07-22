/**
 * core/turnaround-intelligence/builders/normalizer.js
 *
 * CP6-A Normalizer — 原始答案标准化器
 *
 * 将用户 10 题原始答案转换为标准化的结构化答案对象。
 *
 * 职责:
 *   - 清洗空白、乱码
 *   - 截断过长文本
 *   - 标准化键名 (Q1–Q10)
 *   - 添加元数据标记 (答案长度、是否有效)
 *
 * 这是 pipeline 第一个处理步骤。所有后续 Engine 只能读取
 * 标准化后的 answers，不允许直接读取原始输入。
 *
 * @version 6.0.0
 * @checkpoint CP6-A
 */

const QUESTION_COUNT = 10

// ═══════════════════════════════════════
// normalize — 标准化原始答案
// ═══════════════════════════════════════

/**
 * normalize — 将原始输入转换为标准化答案对象
 *
 * @param {Object} raw — 原始输入，可能来自问卷、小程序表单等
 *   e.g., { Q1: "...", Q2: "...", ... } 或 { q1: "...", ... }
 * @param {Object} [options]
 * @param {number} [options.maxAnswerLength=500] — 单题最大字符数
 * @param {number} [options.expectedQuestionCount=10] — 预期问题数
 * @returns {Object} {
 *   answers: { Q1: "...", Q2: "...", ... },
 *   meta: { questionCount, validCount, emptyCount, tooLongCount, maxLength },
 *   warnings: string[]
 * }
 */
function normalize(raw, options = {}) {
  const maxLen = options.maxAnswerLength || 500
  const expectedCount = options.expectedQuestionCount || QUESTION_COUNT

  const warnings = []
  const answers = {}
  let validCount = 0
  let emptyCount = 0
  let tooLongCount = 0

  // 支持 Q1-Q10 和 q1-q10 两种键名格式
  for (let i = 1; i <= expectedCount; i++) {
    const key = `Q${i}`
    const altKey = `q${i}`
    const rawVal = raw[key] !== undefined ? raw[key] : raw[altKey]

    if (rawVal === undefined || rawVal === null || rawVal === '') {
      answers[key] = ''
      emptyCount++
      continue
    }

    let val = String(rawVal).trim()

    // 裁切过长答案
    if (val.length > maxLen) {
      val = val.slice(0, maxLen)
      tooLongCount++
      warnings.push(`${key}: answer truncated from ${rawVal.length} to ${maxLen} chars`)
    }

    answers[key] = val
    if (val.length > 0) validCount++
  }

  // 检查题目覆盖率
  if (validCount < 3) {
    warnings.push(`Only ${validCount}/${expectedCount} questions answered — insights will be limited`)
  }

  return Object.freeze({
    answers: Object.freeze(answers),
    meta: Object.freeze({
      questionCount: expectedCount,
      validCount,
      emptyCount,
      tooLongCount,
      maxLength: maxLen,
    }),
    warnings: Object.freeze(warnings),
  })
}

// ═══════════════════════════════════════
// extractAnswerSummary — 从标准化 answers 提取摘要
// ═══════════════════════════════════════

/**
 * extractAnswerSummary — 为下游 Engine 提供快速摘要
 *
 * @param {Object} answers — 标准化的 { Q1: "...", Q2: "...", ... }
 * @returns {Object} {
 *   totalChars, avgCharsPerAnswer, answeredQuestions, emptyQuestions
 * }
 */
function extractAnswerSummary(answers) {
  const keys = Object.keys(answers)
  let totalChars = 0
  const answered = []
  const empty = []

  for (const key of keys) {
    const val = answers[key] || ''
    totalChars += val.length
    if (val.length > 0) {
      answered.push(key)
    } else {
      empty.push(key)
    }
  }

  return Object.freeze({
    totalChars,
    avgCharsPerAnswer: answered.length > 0 ? Math.round(totalChars / answered.length) : 0,
    answeredQuestions: Object.freeze(answered),
    emptyQuestions: Object.freeze(empty),
    coverageRatio: answered.length / keys.length,
  })
}

// ═══════════════════════════════════════
// validateNormalized — 验证标准化结果
// ═══════════════════════════════════════

/**
 * validateNormalized — 验证标准化后的 answers 是否可用
 *
 * @param {Object} normalized — normalize() 的输出
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateNormalized(normalized) {
  const errors = []

  if (!normalized || !normalized.answers) {
    errors.push('Normalized output missing answers')
    return Object.freeze({ valid: false, errors: Object.freeze(errors) })
  }

  if (normalized.meta.validCount < 3) {
    errors.push(`Too few valid answers: ${normalized.meta.validCount} (min 3 required)`)
  }

  // 验证键名格式
  for (const key of Object.keys(normalized.answers)) {
    if (!/^Q\d+$/.test(key)) {
      errors.push(`Invalid answer key format: "${key}" (expected Q1–Q10)`)
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  })
}

module.exports = {
  normalize,
  extractAnswerSummary,
  validateNormalized,
  QUESTION_COUNT,
}
