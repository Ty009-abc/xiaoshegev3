/**
 * cloudfunctions/common/embeddingService.js — Embedding 服务
 *
 * 四册 Part 3：世界模型知识库
 *
 * 职责：
 *   1. 文本向量化（调用 DeepSeek / OpenAI 兼容 API）
 *   2. 批量向量化
 *   3. 余弦相似度计算
 *
 * 支持 Embedding 模型：
 *   - deepseek-embedding (推荐，便宜)
 *   - text-embedding-3-small (OpenAI)
 */

const now = () => Date.now()

/**
 * 配置 — 通过环境变量注入
 */
const EMBEDDING_CONFIG = {
  model: process.env.EMBEDDING_MODEL || 'deepseek-embedding',
  apiKey: process.env.EMBEDDING_API_KEY || process.env.DEEPSEEK_API_KEY || '',
  apiBase: process.env.EMBEDDING_API_BASE || 'https://api.deepseek.com/v1',
  timeoutMs: 10000,
  dimensions: 1024,
}

/**
 * callEmbeddingAPI(texts)
 * 调用 DeepSeek / OpenAI 兼容 embedding API
 */
async function callEmbeddingAPI(texts) {
  const { apiKey, apiBase, model, timeoutMs } = EMBEDDING_CONFIG

  if (!apiKey) {
    // 无 API Key → 降级为本地 TF-IDF 模拟
    console.warn('[Embedding] ⚠️ 未配置 API Key，使用本地模拟 embedding')
    return texts.map(() => _localSimulateEmbedding())
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const res = await fetch(`${apiBase}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: texts }),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) throw new Error(`Embedding API error: ${res.status}`)
    const data = await res.json()
    return (data.data || []).map(d => d.embedding)
  } catch (e) {
    console.error('[Embedding] API 调用失败:', e.message)
    // 降级
    return texts.map(() => _localSimulateEmbedding())
  }
}

/**
 * _localSimulateEmbedding()
 * 本地模拟 — 基于文本哈希生成确定性向量
 * 用于开发/测试环境，生产环境应配置真实 API Key
 */
function _localSimulateEmbedding(text = '') {
  const dim = 256
  const vec = new Array(dim)

  // 基于文本生成确定性向量
  let h = 0
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h) + text.charCodeAt(i)
    h |= 0
  }

  // 伪随机填充
  for (let i = 0; i < dim; i++) {
    const seed = ((h * (i + 1) * 2654435761) | 0) >>> 0
    vec[i] = ((seed % 2000) - 1000) / 1000
  }

  // 归一化
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm
  }

  return vec
}

/**
 * embedText(text) — 单文本向量化
 * @returns {number[]} 向量
 */
async function embedText(text) {
  if (!text) return _localSimulateEmbedding('')
  const results = await callEmbeddingAPI([text])
  return results[0]
}

/**
 * embedBatch(texts) — 批量向量化
 * @returns {number[][]} 向量数组
 */
async function embedBatch(texts) {
  if (!texts || !texts.length) return []
  const results = await callEmbeddingAPI(texts)
  return results
}

/**
 * cosineSimilarity(vecA, vecB) — 余弦相似度
 * @returns {number} 0~1
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0

  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i]
    na += vecA[i] * vecA[i]
    nb += vecB[i] * vecB[i]
  }

  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

/**
 * bulkSimilarity(queryVec, docVecs) — 批量计算相似度
 * @returns {number[]} 相似度分数数组
 */
function bulkSimilarity(queryVec, docVecs) {
  return docVecs.map(dv => cosineSimilarity(queryVec, dv))
}

module.exports = {
  EMBEDDING_CONFIG,
  embedText,
  embedBatch,
  cosineSimilarity,
  bulkSimilarity,
}
