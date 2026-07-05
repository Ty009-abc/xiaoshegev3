/**
 * common/dynamicTokenBudget.js — 动态 Token 预算分配器
 *
 * 替代静态固定 cap，改为动态分配。
 *
 * MAX_INPUT_TOKENS = 3000
 *
 * Budget 分配:
 *   SYSTEM        = 500  (SYSTEM_CORE + Scene Prompt)
 *   RAG           = 900  (知识检索结果)
 *   MEMORY        = 700  (用户记忆)
 *   USER_CONTEXT  = 900  (用户消息 + 历史 + 上下文)
 *   ─────────────────
 *   TOTAL         = 3000
 *
 * 超出时按 relevance score 裁剪 chunk。
 * 优先级: USER_CONTEXT > SYSTEM > MEMORY > RAG
 *
 * 使用:
 *   const budget = allocateBudget(scene, { system, rag, memory, userContext })
 *   // budget = { system: 500, rag: 800, memory: 700, userContext: 900, truncated: { rag: true } }
 */

// ═══════════════════════════════════════
// Budget Constants
// ═══════════════════════════════════════

const MAX_INPUT_TOKENS = 3000

const BUDGET = {
  SYSTEM:       500,   // SYSTEM_CORE + Scene Prompt
  RAG:          900,   // 知识检索 (含 relevance score)
  MEMORY:       700,   // 用户记忆
  USER_CONTEXT: 900,   // 用户消息 + 历史 + profile
}

// 裁剪优先级 (越低越先被裁)
const TRIM_PRIORITY = {
  RAG:          0,  // 最先裁知识
  MEMORY:       1,  // 次裁记忆
  SYSTEM:       2,  // system prompt 不裁（但可压缩）
  USER_CONTEXT: 3,  // 用户上下文尽量保留
}

// ═══════════════════════════════════════
// Token Estimation
// ═══════════════════════════════════════

/**
 * 估算文本 token 数
 * 中文 ≈ 1.5 chars/token, 英文 ≈ 4 chars/token
 */
function estimateTokens(text) {
  if (!text) return 0
  if (Array.isArray(text)) {
    return text.reduce((sum, item) => sum + estimateTokens(typeof item === 'string' ? item : item.content || ''), 0)
  }
  let chineseChars = 0
  let otherChars = 0
  for (const ch of String(text)) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
      chineseChars++
    } else {
      otherChars++
    }
  }
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}

// ═══════════════════════════════════════
// Budget Allocation
// ═══════════════════════════════════════

/**
 * 分配 token 预算
 *
 * @param {string} scene - AI 场景
 * @param {object}  chunks - { system, rag, memory, userContext }
 *   system:      string
 *   rag:         [{ content, relevanceScore }]   — 带 relevance score 的知识块
 *   memory:      [{ content, importance }]        — 带 importance 的记忆块
 *   userContext: string
 *
 * @returns {{
 *   system:       string,
 *   rag:           string,
 *   memory:        string,
 *   userContext:   string,
 *   totalTokens:   number,
 *   budget:        object,
 *   truncated:     { rag: bool, memory: bool, system: bool, userContext: bool },
 *   tokenBreakdown: { system: number, rag: number, memory: number, userContext: number }
 * }}
 */
function allocateBudget(scene, chunks = {}) {
  const result = {
    system: chunks.system || '',
    rag: '',
    memory: '',
    userContext: chunks.userContext || '',
    totalTokens: 0,
    budget: { ...BUDGET },
    truncated: { rag: false, memory: false, system: false, userContext: false },
    tokenBreakdown: { system: 0, rag: 0, memory: 0, userContext: 0 },
  }

  // 1. System prompt (不裁，但超了就截断)
  const systemTokens = estimateTokens(result.system)
  if (systemTokens > BUDGET.SYSTEM) {
    result.system = trimByBudget(result.system, BUDGET.SYSTEM, false)
    result.truncated.system = true
  }
  result.tokenBreakdown.system = estimateTokens(result.system)

  // 2. User context
  const ctxTokens = estimateTokens(result.userContext)
  if (ctxTokens > BUDGET.USER_CONTEXT) {
    result.userContext = trimByBudget(result.userContext, BUDGET.USER_CONTEXT, false)
    result.truncated.userContext = true
  }
  result.tokenBreakdown.userContext = estimateTokens(result.userContext)

  // 3. RAG — 按 relevance score 裁剪
  const ragItems = chunks.rag || []
  const ragResult = trimChunksByRelevance(ragItems, BUDGET.RAG, 'relevanceScore')
  result.rag = ragResult.text
  result.truncated.rag = ragResult.truncated
  result.tokenBreakdown.rag = estimateTokens(result.rag)

  // 4. Memory — 按 importance 裁剪
  const memItems = chunks.memory || []
  const memResult = trimChunksByRelevance(memItems, BUDGET.MEMORY, 'importance')
  result.memory = memResult.text
  result.truncated.memory = memResult.truncated
  result.tokenBreakdown.memory = estimateTokens(result.memory)

  // 5. 溢出再分配 (budget 用不完的转给需要的地方)
  redistributeBudget(result, scene, chunks)

  // 6. 计算总量
  result.totalTokens = estimateTokens([
    result.system, result.rag, result.memory, result.userContext
  ].filter(Boolean).join('\n'))

  return result
}

/**
 * 按 relevance score 裁剪 chunk 数组到 token budget
 * @param {Array<{content:string, [scoreKey]:number}>} items
 * @param {number} budget                       - token 上限
 * @param {string} scoreKey                     - 打分字段 (relevanceScore / importance)
 * @returns {{ text: string, truncated: boolean }}
 */
function trimChunksByRelevance(items, budget, scoreKey = 'relevanceScore') {
  if (!items || items.length === 0) return { text: '', truncated: false }

  // 按 score 降序排列
  const sorted = [...items].sort((a, b) => (b[scoreKey] || 0) - (a[scoreKey] || 0))

  let totalTokens = 0
  const selected = []
  let truncated = false

  for (const item of sorted) {
    const content = item.content || item.text || String(item)
    const tokens = estimateTokens(content)

    if (totalTokens + tokens <= budget) {
      selected.push(content)
      totalTokens += tokens
    } else if (!truncated) {
      // 还有一点空间，塞部分
      const remaining = budget - totalTokens
      if (remaining > 50) {
        const trimmed = trimByBudget(content, remaining, true)
        if (trimmed) selected.push(trimmed)
      }
      truncated = true
    } else {
      truncated = true
    }
  }

  return {
    text: selected.join('\n'),
    truncated: truncated || sorted.length > selected.length,
  }
}

/**
 * 按 token 预算截断单个文本
 * @param {string}  text
 * @param {number}  budget        - token 上限
 * @param {boolean} preserveLast  - 尽量保留最后一句完整的话
 */
function trimByBudget(text, budget, preserveLast = false) {
  if (!text) return ''

  const currentTokens = estimateTokens(text)
  if (currentTokens <= budget) return text

  // 粗略字符截断 (中文为主: budget * 1.2)
  const maxChars = Math.floor(budget * 1.2)
  if (text.length <= maxChars) return text

  // 找最近的语义断点
  let cutPoint = maxChars
  if (preserveLast) {
    // 从后往前找断点
    for (let i = maxChars - 1; i >= maxChars - 300; i--) {
      if (text[i] === '\n' || text[i] === '。' || text[i] === '.') {
        cutPoint = i + 1
        break
      }
    }
  }

  return text.slice(0, cutPoint) + '\n[已按预算裁剪]'
}

/**
 * 溢出再分配 — RAG/Memory 没用完的转给 user context
 * @param {object} allocation - allocateBudget 的中间结果 (mutated in place)
 * @param {string} scene
 * @param {object} chunks     - 原始 chunks 引用, 用于 userContext 溢出时取原始文本
 */
function redistributeBudget(allocation, scene, chunks = {}) {
  const used = { ...allocation.tokenBreakdown }
  const caps = { ...BUDGET }

  // Map BUDGET keys (UPPER) to tokenBreakdown keys (lower)
  const keyMap = { SYSTEM: 'system', RAG: 'rag', MEMORY: 'memory', USER_CONTEXT: 'userContext' }

  // 计算每个 slot 的剩余
  const remaining = {}
  for (const [capKey, tkKey] of Object.entries(keyMap)) {
    remaining[capKey] = Math.max(0, caps[capKey] - (used[tkKey] || 0))
  }

  // 如果有剩余且 user context 被截断 → 用原始文本重新裁
  const totalRemaining = Object.values(remaining).reduce((s, v) => s + v, 0)
  if (totalRemaining > 0 && allocation.truncated.userContext) {
    const newBudget = caps.USER_CONTEXT + totalRemaining
    const originalCtx = chunks?.userContext || allocation.userContext || ''
    allocation.userContext = trimByBudget(originalCtx, newBudget, false)
    allocation.truncated.userContext = estimateTokens(allocation.userContext) > newBudget * 0.95
    allocation.tokenBreakdown.userContext = estimateTokens(allocation.userContext)
  }

  return allocation
}

// ═══════════════════════════════════════
// Convenience
// ═══════════════════════════════════════

/**
 * 快速检查是否所有 slot 都未超预算
 */
function isWithinBudget(allocation) {
  return !Object.values(allocation.truncated).some(Boolean)
}

/**
 * 获取预算摘要（用于日志/监控）
 */
function getBudgetSummary(allocation) {
  return {
    totalTokens: allocation.totalTokens,
    withinBudget: isWithinBudget(allocation),
    truncatedSlots: Object.entries(allocation.truncated)
      .filter(([, v]) => v)
      .map(([k]) => k),
    breakdown: allocation.tokenBreakdown,
  }
}

module.exports = {
  MAX_INPUT_TOKENS,
  BUDGET,
  TRIM_PRIORITY,
  estimateTokens,
  allocateBudget,
  trimByBudget,
  trimChunksByRelevance,
  isWithinBudget,
  getBudgetSummary,
}
