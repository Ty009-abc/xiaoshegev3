/**
 * prompt-v4/aiOutputParserV4.js
 *
 * AI 输出解析器。
 * 支持：提取 JSON、去代码围栏、JSON repair、清理原型污染、截断超长。
 * 禁止：eval()、new Function()、执行任意代码。
 *
 * RC8.3: Multi-strategy extraction with controlled JSON repair.
 * Returns parseTrace with detailed extraction metadata.
 */

const { AI_OUTPUT_SCHEMA, getWritableTopLevelKeys } = require('./aiOutputSchemaV4')

// ═══════════════════════════════════════════════════════════════
// JSON 提取（多策略 + 受控修复）
// ═══════════════════════════════════════════════════════════════

/**
 * Extract valid JSON from raw AI output with multiple strategies.
 * Returns { ok, data, rawLength, parseTrace }
 */
function extractJSON(rawText, aiMeta) {
  aiMeta = aiMeta || {}

  var parseTrace = {
    attempted: true,
    rawOutputPresent: !!(rawText && typeof rawText === 'string' && rawText.trim().length > 0),
    rawOutputLength: rawText ? rawText.length : 0,
    extractionMethod: 'NONE',
    parseAttempts: 0,
    parseErrorCode: null,
    parseErrorMessage: null,
    repairAttempted: false,
    repairSucceeded: false,
    // AI output metadata
    responseTruncated: !!aiMeta.responseTruncated,
    finishReason: aiMeta.finishReason || null,
    closingBracePresent: rawText ? rawText.trim().endsWith('}') || rawText.indexOf('}') >= 0 : false,
    hasCodeFence: rawText ? (rawText.indexOf('```') >= 0) : false,
    // Sanitized preview: max 80 chars each, redacted if output is short enough
    // to be fully contained in preview (prevents full output leakage)
    outputPreviewStart: rawText ? (rawText.trim().length <= 160 ? '[REDACTED: short output]' : rawText.trim().slice(0, 80)) : '',
    outputPreviewEnd: rawText ? (rawText.trim().length <= 160 ? '[REDACTED: short output]' : rawText.trim().slice(-80)) : '',
    outputHash: rawText ? simpleHash(rawText) : null,
  }

  if (!rawText || typeof rawText !== 'string') {
    parseTrace.parseErrorCode = 'V4_AI_EMPTY_INPUT'
    parseTrace.parseErrorMessage = 'Input is empty or not string'
    return { ok: false, code: 'V4_AI_EMPTY_INPUT', reason: 'Input is empty or not string', rawLength: 0, parseTrace: parseTrace }
  }

  var trimmed = rawText.trim()
  if (trimmed.length === 0) {
    parseTrace.parseErrorCode = 'V4_AI_EMPTY_INPUT'
    parseTrace.parseErrorMessage = 'Input is whitespace only'
    return { ok: false, code: 'V4_AI_EMPTY_INPUT', reason: 'Input is whitespace only', rawLength: 0, parseTrace: parseTrace }
  }

  // Strategy 1: Direct JSON.parse
  parseTrace.parseAttempts++
  try {
    var obj = JSON.parse(trimmed)
    parseTrace.extractionMethod = 'DIRECT_JSON'
    return { ok: true, data: obj, rawLength: trimmed.length, parseTrace: parseTrace }
  } catch (e1) {
    parseTrace.parseErrorCode = 'DIRECT_PARSE_FAILED'
    parseTrace.parseErrorMessage = safeErrorMessage(e1)
  }

  // Strategy 2: Strip code fence (```json ... ``` or ``` ... ```)
  parseTrace.parseAttempts++
  var fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    var fenceInner = fenceMatch[1].trim()
    try {
      var obj2 = JSON.parse(fenceInner)
      parseTrace.extractionMethod = 'CODE_FENCE_JSON'
      return { ok: true, data: obj2, rawLength: trimmed.length, parseTrace: parseTrace }
    } catch (e2) {
      parseTrace.parseErrorCode = 'FENCE_PARSE_FAILED'
      parseTrace.parseErrorMessage = safeErrorMessage(e2)
    }
  }

  // Strategy 3: Extract first balanced { ... } object
  parseTrace.parseAttempts++
  var firstBrace = trimmed.indexOf('{')
  var lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    var balancedCandidate = trimmed.slice(firstBrace, lastBrace + 1)

    // CRITICAL: If output was truncated by token limit and closing brace is
    // the result of our repair (not original), it means the JSON is incomplete.
    // Check: is the balanced candidate missing expected keys?
    var isClosingBraceOriginal = trimmed.trim().endsWith('}')
    if (aiMeta.responseTruncated && !isClosingBraceOriginal) {
      parseTrace.parseErrorCode = 'V4_AI_OUTPUT_TRUNCATED'
      parseTrace.parseErrorMessage = 'AI output was truncated (finishReason=' + (aiMeta.finishReason || 'unknown') + '), closing brace might be from previous content'
      return {
        ok: false,
        code: 'V4_AI_OUTPUT_TRUNCATED',
        reason: 'AI output truncated before JSON completion — closing brace not at end of output',
        rawLength: trimmed.length,
        parseTrace: parseTrace,
      }
    }

    try {
      var obj3 = JSON.parse(balancedCandidate)
      parseTrace.extractionMethod = 'BALANCED_OBJECT'

      // Even if parse succeeds, mark truncated if output was cut off
      if (aiMeta.responseTruncated) {
        // Parse succeeded but output was truncated — warn in trace
        parseTrace.parseWarning = 'TRUNCATED_BUT_PARSEABLE'
      }

      return { ok: true, data: obj3, rawLength: trimmed.length, parseTrace: parseTrace }
    } catch (e3) {
      parseTrace.parseErrorCode = 'BALANCED_PARSE_FAILED'
      parseTrace.parseErrorMessage = safeErrorMessage(e3)

      // Strategy 4: Controlled JSON repair on balanced candidate
      parseTrace.parseAttempts++
      parseTrace.repairAttempted = true
      var repaired = repairJSON(balancedCandidate)
      try {
        var obj4 = JSON.parse(repaired)
        parseTrace.extractionMethod = 'REPAIRED_JSON'
        parseTrace.repairSucceeded = true
        return { ok: true, data: obj4, rawLength: trimmed.length, parseTrace: parseTrace }
      } catch (e4) {
        parseTrace.parseErrorCode = 'REPAIR_PARSE_FAILED'
        parseTrace.parseErrorMessage = safeErrorMessage(e4)
      }
    }
  }

  // All strategies exhausted
  parseTrace.extractionMethod = 'NONE'
  if (aiMeta.responseTruncated || aiMeta.finishReason === 'length') {
    parseTrace.parseErrorCode = 'V4_AI_OUTPUT_TRUNCATED'
    parseTrace.parseErrorMessage = 'AI output was truncated (finishReason=' + (aiMeta.finishReason || 'unknown') + ')'
    return {
      ok: false,
      code: 'V4_AI_OUTPUT_TRUNCATED',
      reason: 'AI output was truncated before JSON completion',
      rawLength: trimmed.length,
      parseTrace: parseTrace,
    }
  }

  return {
    ok: false,
    code: 'V4_AI_JSON_PARSE_FAILED',
    reason: 'Could not extract valid JSON from output',
    rawLength: trimmed.length,
    parseTrace: parseTrace,
  }
}

/**
 * Controlled JSON repair — only fixes common AI output artifacts.
 * Does NOT modify semantic content, only fixes syntax.
 */
function repairJSON(text) {
  if (!text || typeof text !== 'string') return text

  var repaired = text

  // 1. Remove trailing commas before ] or }
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1')

  // 2. Fix missing commas between consecutive string values on new lines
  //    "key": "value"\n  "key2" → "key": "value",\n  "key2"
  repaired = repaired.replace(/"\s*\n\s*"/g, '",\n  "')

  // 3. Fix unescaped quotes inside strings (rare)
  //    Skip — too risky, could corrupt valid content

  // 4. Count braces — if unbalanced, try to close
  var openBraces = (repaired.match(/{/g) || []).length
  var closeBraces = (repaired.match(/}/g) || []).length
  if (openBraces > closeBraces) {
    repaired += '\n' + '}'.repeat(openBraces - closeBraces)
  }

  return repaired
}

/**
 * Sanitize error message — NEVER include raw AI output in error traces.
 * Only return error type/code, never the actual text that caused it.
 */
function safeErrorMessage(e) {
  if (!e) return 'Parse failed'
  var msg = String(e.message || e)
  // Strip everything after "is not valid JSON" including the quoted input
  var idx = msg.indexOf(' is not valid JSON')
  if (idx >= 0) return 'JSON.parse failed (syntax error)'
  // Strip "Unexpected token" follow-ups which contain raw text
  if (msg.indexOf('Unexpected token') >= 0) {
    var posMatch = msg.match(/position (\d+)/)
    return 'Unexpected token at position ' + (posMatch ? posMatch[1] : 'unknown')
  }
  // General: only return first sentence, max 80 chars, no quoting
  var short = msg.split('.')[0]
  return short.slice(0, 80)
}

/**
 * Simple hash of text for traceability without storing raw output.
 */
function simpleHash(text) {
  var hash = 0
  for (var i = 0; i < text.length; i++) {
    var chr = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return Math.abs(hash).toString(16)
}

// ═══════════════════════════════════════════════════════════════
// 合法性校验
// ═══════════════════════════════════════════════════════════════

var FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype']

function validateAIOutput(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, code: 'V4_AI_NOT_OBJECT', reason: 'Parsed result is not an object' }
  }

  var errors = []

  for (var i = 0; i < FORBIDDEN_KEYS.length; i++) {
    var key = FORBIDDEN_KEYS[i]
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      errors.push('Forbidden own key: ' + key)
    }
  }

  var vals = Object.values(parsed)
  for (var j = 0; j < vals.length; j++) {
    var val = vals[j]
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      for (var k = 0; k < FORBIDDEN_KEYS.length; k++) {
        var fk = FORBIDDEN_KEYS[k]
        if (Object.prototype.hasOwnProperty.call(val, fk)) {
          errors.push('Forbidden own key in nested object: ' + fk)
        }
      }
    }
  }

  var allowedTopLevel = getWritableTopLevelKeys()
  var unknownTopLevel = Object.keys(parsed).filter(function(k) { return allowedTopLevel.indexOf(k) === -1 })
  if (unknownTopLevel.length > 0) {
    for (var u = 0; u < unknownTopLevel.length; u++) {
      delete parsed[unknownTopLevel[u]]
    }
  }

  if (errors.length > 0) {
    return { ok: false, code: 'V4_AI_SCHEMA_VIOLATION', reason: errors.join('; ') }
  }

  return { ok: true, data: parsed }
}

// ═══════════════════════════════════════════════════════════════
// 字符串截断
// ═══════════════════════════════════════════════════════════════

var MAX_CHARS_MAP = {
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

function truncateStrings(obj, maxMap, path) {
  path = path || ''
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') {
    var keys = Object.keys(maxMap)
    for (var i = 0; i < keys.length; i++) {
      var pattern = keys[i]
      var max = maxMap[pattern]
      var regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]+') + '$')
      if (regex.test(path)) {
        return obj.slice(0, max)
      }
    }
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(function(item, idx) {
      return truncateStrings(item, maxMap, path ? path + '[' + idx + ']' : '[' + idx + ']')
    })
  }
  if (typeof obj === 'object') {
    var result = {}
    var objKeys = Object.keys(obj)
    for (var j = 0; j < objKeys.length; j++) {
      var key = objKeys[j]
      result[key] = truncateStrings(obj[key], maxMap, path ? path + '.' + key : key)
    }
    return result
  }
  return obj
}

function trimEmptyFields(obj) {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(trimEmptyFields).filter(function(item) { return item !== null })
  if (typeof obj === 'object') {
    var result = {}
    var objKeys = Object.keys(obj)
    for (var i = 0; i < objKeys.length; i++) {
      var key = objKeys[i]
      var val = trimEmptyFields(obj[key])
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
 * @param {Object} [aiMeta] — AI response metadata { finishReason, responseTruncated }
 * @returns {{ ok: boolean, data?: Object, code?: string, reason?: string, rawLength?: number, parseTrace?: Object }}
 */
function parseAIOutput(rawText, aiMeta) {
  // 1. Extract JSON
  var extracted = extractJSON(rawText, aiMeta)
  if (!extracted.ok) return extracted

  // 2. Validate structure
  var validated = validateAIOutput(extracted.data)
  if (!validated.ok) {
    return {
      ok: false,
      code: validated.code,
      reason: validated.reason,
      rawLength: extracted.rawLength,
      parseTrace: extracted.parseTrace,
    }
  }

  // 3. Truncate oversize
  var truncated = truncateStrings(validated.data, MAX_CHARS_MAP)

  // 4. Clean empty
  var cleaned = trimEmptyFields(truncated)

  return { ok: true, data: cleaned, rawLength: extracted.rawLength, parseTrace: extracted.parseTrace }
}

module.exports = { parseAIOutput, extractJSON, repairJSON, validateAIOutput, truncateStrings, trimEmptyFields, simpleHash }
