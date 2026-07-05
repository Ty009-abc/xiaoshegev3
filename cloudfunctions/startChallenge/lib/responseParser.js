/**
 * common/responseParser.js - 响应解析器
 *
 * 把 LLM 的 raw text 解析为结构化 JSON
 * 处理 markdown 包裹、多行、不完整等情况
 */

/**
 * 从 AI 输出中提取 JSON
 * @param {string} rawText - LLM 原始输出
 * @returns {object|null} 解析后的 JSON 对象
 */
function parseJSON(rawText) {
  if (!rawText) return null

  let text = rawText.trim()

  // 1. 移除 markdown 代码块
  const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (mdMatch) {
    text = mdMatch[1].trim()
  } else {
    // 2. 尝试找到第一个 { 到最后一个 }
    const startIdx = text.indexOf('{')
    const endIdx = text.lastIndexOf('}')
    if (startIdx !== -1 && endIdx > startIdx) {
      text = text.slice(startIdx, endIdx + 1)
    }
  }

  // 3. 尝试解析
  try {
    return JSON.parse(text)
  } catch (_) {
    // 4. 修复常见问题后重试
    try {
      const fixed = fixCommonJSONIssues(text)
      return JSON.parse(fixed)
    } catch (_2) {
      return null
    }
  }
}

/**
 * 修复常见的 JSON 格式问题
 */
function fixCommonJSONIssues(text) {
  let fixed = text
    // 单引号 → 双引号
    .replace(/'/g, '"')
    // 未加引号的 key
    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    // 尾部多余逗号
    .replace(/,(\s*[}\]])/g, '$1')
    // 中文标点替换
    .replace(/：/g, ':')
    .replace(/，/g, ',')
    .replace(/"/g, '\'')
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    // 换行中的非法转义
    .replace(/\\([^"\\/bfnrtu])/g, '$1')
  return fixed
}

/**
 * 解析挑战报告
 */
function parseReport(rawText) {
  const parsed = parseJSON(rawText)
  if (parsed) return parsed

  // fallback：手动提取
  const result = {}
  const lines = rawText.split('\n').filter(Boolean)

  for (const line of lines) {
    const m = line.match(/^["']?(\w+)["']?\s*[:：]\s*(.+)/)
    if (m) result[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }

  return Object.keys(result).length > 2 ? result : { rawContent: rawText }
}

/**
 * 解析挑战总结
 */
function parseChallengeSummary(rawText) {
  return parseJSON(rawText) || { summary: rawText }
}

/**
 * 解析认知暴击解读
 */
function parseDailyInsight(rawText) {
  return parseJSON(rawText) || { explanation: rawText }
}

/**
 * 从原始文本提取翻身概率数字
 */
function extractProbability(text) {
  if (!text) return 0
  const m = text.match(/翻身概率[：:\s]*(\d{1,3})/i)
  if (m) return parseInt(m[1], 10)
  const m2 = text.match(/(\d{1,3})\s*%/ )
  if (m2) return parseInt(m2[1], 10)
  return 0
}

/**
 * 根据 scene 选择合适的解析器
 */
function parseResponse(scene, rawText) {
  switch (scene) {
    case 'report_generation':
      return parseReport(rawText)
    case 'challenge_summary':
      return parseChallengeSummary(rawText)
    case 'daily_insight':
      return parseDailyInsight(rawText)
    default:
      // ai_chat / coaching / world_model_analysis → 纯文本
      return { content: rawText }
  }
}

module.exports = {
  parseJSON,
  parseReport,
  parseChallengeSummary,
  parseDailyInsight,
  extractProbability,
  parseResponse,
}
