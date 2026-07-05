/**
 * cloudfunctions/common/ragEngine.js — RAG 编排引擎
 *
 * 四册 Part 3：世界模型知识库
 *
 * 回答前检索知识 → 注入 Prompt → LLM 回答
 *
 * 流程：
 *   User Query
 *     ↓
 *   embedText(query) → queryVector
 *     ↓
 *   Vector Search (knowledge_embeddings)
 *     ↓
 *   Top-K Knowledge
 *     ↓
 *   formatKnowledgeForPrompt()
 *     ↓
 *   注入 buildPrompt.context
 *     ↓
 *   LLM Response
 */

const { embedText } = require('./embeddingService.js')
const { retrieveKnowledge, retrieveWithEmbedding, formatKnowledgeForPrompt, getCategoryStats } = require('./knowledgeRetriever.js')
const { buildPrompt: _buildLibPrompt } = require('./promptLibrary.js')
const { formatMemoryForPrompt } = require('./memoryEngine.js')

/**
 * ragBuildPrompt(scene, userInput, options)
 * 
 * RAG 版本 buildPrompt — 自动检索知识并注入
 *
 * @param {string} scene      - AI 场景
 * @param {string} userInput  - 用户输入
 * @param {object} options    - { context?, variables?, extraRules?, db?, category?, topK?, memory? }
 * @returns {{ systemPrompt, userMessage, promptVersion, knowledgeUsed, memoryUsed }}
 */
async function ragBuildPrompt(scene, userInput, options = {}) {
  const { category = null, topK = 5 } = options

  let knowledgeUsed = []
  let knowledgeContext = ''

  try {
    // 1. 尝试向量检索（如果有 embedding API）
    const queryEmbedding = await embedText(userInput)

    // 2. 从 DB 检索预计算的向量（如果有）
    const { db } = options
    let embeddingsFromDB = []
    if (db && queryEmbedding) {
      try {
        const res = await db.collection('knowledge_embeddings').limit(topK * 3).get()
        embeddingsFromDB = (res.data || []).map(e => ({ ...e, _score: cosineSimilarity(queryEmbedding, e.embedding || []) }))
        embeddingsFromDB.sort((a, b) => (b._score || 0) - (a._score || 0))
      } catch (_) {}
    }

    // 3. 混合检索
    if (queryEmbedding && embeddingsFromDB.length) {
      // 有向量 → 语义检索
      knowledgeUsed = retrieveWithEmbedding(userInput, queryEmbedding, { topK, category, minScore: 0.1 })
    } else {
      // 无向量 → 关键词检索
      knowledgeUsed = retrieveKnowledge(userInput, { topK, category, minScore: 0.1 })
    }

    knowledgeContext = formatKnowledgeForPrompt(knowledgeUsed)
  } catch (e) {
    console.warn('[RAG] 知识检索异常:', e.message)
  }

  // 4. 注入记忆（如果提供）
  let memoryContext = ''
  if (options.memory) {
    try {
      memoryContext = formatMemoryForPrompt(options.memory)
    } catch (_) {}
  }

  // 5. 构建 Prompt（注入：记忆 + 知识 + 原始上下文）
  const fullContext = [memoryContext, knowledgeContext, options.context || ''].filter(Boolean).join('\n')

  const { systemPrompt, userMessage, promptVersion } = _buildLibPrompt(scene, userInput, {
    ...options,
    context: fullContext,
  })

  return { systemPrompt, userMessage, promptVersion, knowledgeUsed }
}

/**
 * ragSearch(query, options) — 纯知识检索（不构建 Prompt）
 */
async function ragSearch(query, options = {}) {
  const { topK = 10, category = null } = options

  let results = retrieveKnowledge(query, { topK, category })

  // 如果有 embedding API，尝试语义精排
  try {
    const queryEmbedding = await embedText(query)
    if (queryEmbedding) {
      results = retrieveWithEmbedding(query, queryEmbedding, { topK, category })
    }
  } catch (_) {}

  return results
}

/**
 * ragStats() — 知识库统计
 */
function ragStats() {
  return getCategoryStats()
}

// 从 embeddingService 引入 cosineSimilarity（避免循环引用）
const { cosineSimilarity } = require('./embeddingService.js')

module.exports = {
  ragBuildPrompt,
  ragSearch,
  ragStats,
  formatKnowledgeForPrompt,
}
