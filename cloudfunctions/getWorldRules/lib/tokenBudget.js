/**
 * common/tokenBudget.js - Token 预算控制系统
 *
 * 每种场景的 token 上限 & 压缩策略
 * 超预算时自动裁剪上下文，保留核心信息
 */

// 每种场景的最大 token 上限
const TOKEN_LIMITS = {
  ai_chat:              2000,
  daily_insight:        1200,
  report_generation:    8000,
  world_model_analysis: 3000,
  challenge_summary:    6000,
  coaching:             3000,
}

// 上下文 token 分配比例（占总数百分比）
const CONTEXT_BUDGET_RATIO = {
  ai_chat:              0.20,   // 20% 给上下文，80% 给推理
  daily_insight:        0.10,
  report_generation:    0.15,
  world_model_analysis: 0.25,
  challenge_summary:    0.15,
  coaching:             0.25,
}

// 最大输出 token（非 JSON 场景兜底）
const MAX_OUTPUT_TOKENS = {
  ai_chat:              600,
  daily_insight:        400,
  report_generation:    2000,
  world_model_analysis: 1000,
  challenge_summary:    1500,
  coaching:             800,
}

/**
 * 获取场景对应的 token 上限
 */
function getTokenLimit(scene) {
  return TOKEN_LIMITS[scene] || 2000
}

/**
 * 获取上下文可用的 token 数
 */
function getContextBudget(scene) {
  const total = getTokenLimit(scene)
  const ratio = CONTEXT_BUDGET_RATIO[scene] || 0.2
  return Math.floor(total * ratio)
}

/**
 * 获取最大输出 token
 */
function getMaxOutputTokens(scene) {
  return MAX_OUTPUT_TOKENS[scene] || 600
}

/**
 * 估算文本 token 数（中文 ≈ 1.5 字符/token，英文 ≈ 4 字符/token）
 */
function estimateTokens(text) {
  if (!text) return 0
  let chineseChars = 0
  let otherChars = 0
  for (const ch of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
      chineseChars++
    } else {
      otherChars++
    }
  }
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}

/**
 * 检查是否在预算内
 * @returns {{ withinBudget:boolean, estimatedTokens:number, limit:number, overflow:number }}
 */
function checkBudget(text, scene) {
  const limit = getTokenLimit(scene)
  const estimated = estimateTokens(text)
  const overflow = Math.max(0, estimated - limit)
  return {
    withinBudget: overflow === 0,
    estimatedTokens: estimated,
    limit,
    overflow,
  }
}

/**
 * 按 token 预算截断文本
 * 优先保留前面的内容（prompt/system 在前，context 在后）
 */
function truncateToBudget(text, scene) {
  const limit = getTokenLimit(scene)
  if (estimateTokens(text) <= limit) return text

  // 粗略截断：limit * 1.5 字符（中文为主的混合）
  const maxChars = Math.floor(limit * 1.5)
  if (text.length <= maxChars) return text

  // 找到最近的句号/换行截断
  let cutPoint = maxChars
  for (let i = maxChars - 1; i >= maxChars - 200; i--) {
    if (text[i] === '\n' || text[i] === '。' || text[i] === '.') {
      cutPoint = i + 1
      break
    }
  }

  return text.slice(0, cutPoint) + '\n\n[内容过长，已截断]'
}

/**
 * 计算 Token 成本（人民币分）
 * @param {number} tokens - token 数
 * @param {string} model  - 模型名（用于定价）
 * @returns {number} 分
 */
function calculateCost(tokens, model) {
  // 按真实 API model 名定价
  const prices = {
    'v4-flash':  0.0001,   // ¥0.1 / 1K tokens
    'v4-pro':    0.0004,   // ¥0.4 / 1K tokens
  }
  const pricePerK = prices[model] || 0.0002
  return Math.round(tokens * pricePerK * 100) // → 分
}

module.exports = {
  TOKEN_LIMITS,
  CONTEXT_BUDGET_RATIO,
  MAX_OUTPUT_TOKENS,
  getTokenLimit,
  getContextBudget,
  getMaxOutputTokens,
  estimateTokens,
  checkBudget,
  truncateToBudget,
  calculateCost,
}
