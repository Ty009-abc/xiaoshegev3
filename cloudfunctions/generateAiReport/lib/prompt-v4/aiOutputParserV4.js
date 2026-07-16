/**
 * prompt-v4/aiOutputParserV4.js
 *
 * AI 输出解析器。
 * 支持：提取 JSON、去代码围栏、清理原型污染、截断超长。
 * 禁止：eval()、new Function()、执行任意代码。
 */

const { AI_OUTPUT_SCHEMA, getWritableTopLevelKeys } = require('./aiOutputSchemaV4')

// ═══════════════════════════════════════════════════════════════
// JSON 提取
// ═══════════════════════════════════════════════════════════════

/**
 * 从模型原始输出中提取首个合法 JSON
 */
function extractJSON(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { ok: false, code: 'V4_AI_EMPTY_INPUT', reason: 'Input is empty or not string', rawLength: 0 }
  }

  const trimmed = rawText.trim()
  if (trimmed.length === 0) {
    return { ok: false, code: 'V4_AI_EMPTY_INPUT', reason: 'Input is whitespace only', rawLength: 0 }
  }

  // 策略 1: 直接 parse
  try {
    const obj = JSON.parse(trimmed)
    return { ok: true, data: obj, rawLength: trimmed.length }
  } catch (_) { /* continue */ }

  // 策略 2: 去代码围栏 ```
  const fenceTrimmed = trimmed.replace(/```(?:json)?\s*([\s\S]*?)```/g, (_, inner) => inner).trim()
  try {
    const obj = JSON.parse(fenceTrimmed)
    return { ok: true, data: obj, rawLength: trimmed.length }
  } catch (_) { /* continue */ }

  // 策略 3: 寻找第一个 { 到最后一个 }
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const obj = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1))
      return { ok: true, data: obj, rawLength: trimmed.length }
    } catch (_) { /* continue */ }
  }

  // 全部失败
  return {
    ok: false,
    code: 'V4_AI_JSON_PARSE_FAILED',
    reason: 'Could not extract valid JSON from output',
    rawLength: trimmed.length,
  }
}

// ═══════════════════════════════════════════════════════════════
// 合法性校验
// ═══════════════════════════════════════════════════════════════

const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype']

/**
 * 校验解析后的对象是否符合 AI 输出 schema
 */
function validateAIOutput(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, code: 'V4_AI_NOT_OBJECT', reason: 'Parsed result is not an object' }
  }

  const errors = []

  // 原型污染检测 — 只检查自有属性（hasOwnProperty），不是原型链上的
  for (const key of FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      errors.push(`Forbidden own key: ${key}`)
    }
  }
  // 递归检查子对象
  for (const val of Object.values(parsed)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      for (const key of FORBIDDEN_KEYS) {
        if (Object.prototype.hasOwnProperty.call(val, key)) {
          errors.push(`Forbidden own key in nested object: ${key}`)
        }
      }
    }
  }

  // 顶层字段检查
  const allowedTopLevel = getWritableTopLevelKeys()
  const unknownTopLevel = Object.keys(parsed).filter(k => !allowedTopLevel.includes(k))
  if (unknownTopLevel.length > 0) {
    errors.push(`Unknown top-level keys: ${unknownTopLevel.join(', ')}`)
  }

  if (errors.length > 0) {
    return { ok: false, code: 'V4_AI_SCHEMA_VIOLATION', reason: errors.join('; ') }
  }

  return { ok: true, data: parsed }
}

// ═══════════════════════════════════════════════════════════════
// 字符串截断
// ═══════════════════════════════════════════════════════════════

const MAX_CHARS_MAP = {
  'headline.title': 42,
  'headline.subtitle': 100,
  'fatalDiagnosis.mainProblem': 100,
  'fatalDiagnosis.reason': 200,
  'fatalRules.*.ruleId': 20,
  'fatalRules.*.title': 60,
  'fatalRules.*.description': 150,
  'fatalRules.*.why': 150,
  'advantageRules.*.ruleId': 20,
  'advantageRules.*.title': 60,
  'advantageRules.*.description': 150,
  'advantageRules.*.why': 150,
  'opportunityRules.*.area': 30,
  'opportunityRules.*.description': 120,
  'opportunityRules.*.why': 120,
  'wealthPathReasons.*': 80,
  'actionPlan.*.goal': 60,
  'actionPlan.*.tasks[*]': 80,
  'actionPlan.*.checkpoint': 40,
  'stopDoingItems[*]': 40,
  'identityUpgrade.currentIdentity': 20,
  'identityUpgrade.targetIdentity': 20,
  'identityUpgrade.gap': 100,
  'identityUpgrade.upgradePath': 80,
  'finalStrike.sentence': 50,
  'finalStrike.shareTitle': 20,
}

/**
 * 递归截断所有超长字符串
 */
function truncateStrings(obj, maxMap, path = '') {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') {
    // 匹配 * 通配符
    for (const [pattern, max] of Object.entries(maxMap)) {
      const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]+') + '$')
      if (regex.test(path)) {
        return obj.slice(0, max)
      }
    }
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map((item, i) => truncateStrings(item, maxMap, path ? `${path}[${i}]` : `[${i}]`))
  }
  if (typeof obj === 'object') {
    const result = {}
    for (const key of Object.keys(obj)) {
      result[key] = truncateStrings(obj[key], maxMap, path ? `${path}.${key}` : key)
    }
    return result
  }
  return obj
}

/**
 * 修剪空字段（null、空字符串、空数组）——保留结构但清理垃圾
 */
function trimEmptyFields(obj) {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(trimEmptyFields).filter(item => item !== null)
  if (typeof obj === 'object') {
    const result = {}
    for (const key of Object.keys(obj)) {
      const val = trimEmptyFields(obj[key])
      if (val !== undefined && val !== null) {
        result[key] = val
      }
    }
    return result
  }
  return obj === '' ? null : obj
}

// ═══════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════

/**
 * @param {string} rawText — 模型原始输出文本
 * @returns {{ ok: boolean, data?: Object, code?: string, reason?: string, rawLength?: number }}
 */
function parseAIOutput(rawText) {
  // 1. 提取 JSON
  const extracted = extractJSON(rawText)
  if (!extracted.ok) return extracted

  // 2. 校验结构
  const validated = validateAIOutput(extracted.data)
  if (!validated.ok) return validated

  // 3. 截断超长
  const truncated = truncateStrings(validated.data, MAX_CHARS_MAP)

  // 4. 清理空字段
  const cleaned = trimEmptyFields(truncated)

  return { ok: true, data: cleaned, rawLength: extracted.rawLength }
}

module.exports = { parseAIOutput, extractJSON, validateAIOutput, truncateStrings, trimEmptyFields }
