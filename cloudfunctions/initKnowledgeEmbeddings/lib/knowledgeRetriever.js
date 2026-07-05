/**
 * cloudfunctions/common/knowledgeRetriever.js — 知识检索器
 *
 * 四册 Part 3：世界模型知识库
 *
 * 检索策略（混合权重）：
 *   Title Keyword Match — 40%
 *   Tag Match            — 30%
 *   Semantic Similarity  — 30%
 *
 * 优先级：
 *   1. 预加载所有知识到内存（冷启动时完成）
 *   2. 关键词检索 → 粗筛
 *   3. 语义检索 → 精排
 *   4. 返回 Top-K
 */

const { cosineSimilarity } = require('./embeddingService.js')

// ═══════════════════════════════════════
// 1. 知识加载器
// ═══════════════════════════════════════

const fs = require('fs')
const path = require('path')

let _knowledgeCache = null

/**
 * loadAllKnowledge()
 * 从 knowledge/ 目录加载全部知识条目
 * @returns {Array} 知识条目数组
 */
function loadAllKnowledge() {
  if (_knowledgeCache) return _knowledgeCache

  const baseDir = path.resolve(__dirname, '../../knowledge')
  const categories = ['wealth', 'probability', 'humanity', 'system', 'ai', 'casino', 'cases']
  const all = []

  for (const cat of categories) {
    const dir = path.join(baseDir, cat)
    if (!fs.existsSync(dir)) continue

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'))
    for (const file of files) {
      try {
        const entry = require(path.join(dir, file))
        if (entry && entry.knowledgeId) {
          all.push({
            ...entry,
            _category: cat,         // 文件系统中的真实分类
            _file: file,
          })
        }
      } catch (_) {}
    }
  }

  _knowledgeCache = all
  console.log(`[Retriever] 已加载 ${all.length} 条知识 (${categories.length} 个分类)`)
  return all
}

/**
 * reloadKnowledge() — 强制重载（调试用）
 */
function reloadKnowledge() {
  _knowledgeCache = null
  return loadAllKnowledge()
}

// ═══════════════════════════════════════
// 2. 关键词匹配（Title + Tags）
// ═══════════════════════════════════════

/**
 * 中文分词（简单版）
 * 基于常见词库做最小分词，不依赖 jieba
 */
function _tokenize(text) {
  if (!text) return []
  // 移除标点，按字切分为 1-4 grams
  const cleaned = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
  const tokens = new Set()

  for (let len = 1; len <= 4; len++) {
    for (let i = 0; i <= cleaned.length - len; i++) {
      tokens.add(cleaned.slice(i, i + len))
    }
  }

  return [...tokens]
}

/**
 * titleMatch(query, entry) — 标题中命中查询关键词的分数
 * @returns {number} 0~1
 */
function titleMatch(query, entry) {
  const title = (entry.title || '').toLowerCase()
  const q = query.toLowerCase()
  const qtokens = _tokenize(q)

  let score = 0
  // 完整标题包含查询 → 高分
  if (title.includes(q)) score += 0.6

  // 查询词中包含标题词 → 逐词加分
  for (const token of qtokens) {
    if (token.length >= 2 && title.includes(token)) score += 0.1
  }

  // 查询中的关键词出现 → 加分
  const keywords = q.split(/\s+/).filter(k => k.length >= 2)
  for (const kw of keywords) {
    if (title.includes(kw)) score += 0.15
  }

  return Math.min(score, 1)
}

/**
 * tagMatch(query, entry) — 标签命中分数
 * @returns {number} 0~1
 */
function tagMatch(query, entry) {
  const tags = (entry.tags || []).map(t => t.toLowerCase())
  const q = query.toLowerCase()

  if (!tags.length) return 0

  let score = 0
  // 查询词出现在标签中
  for (const tag of tags) {
    if (q.includes(tag) || tag.includes(q)) {
      score += 0.3
    }
  }

  // 查询的关键词命中
  const keywords = q.split(/\s+/).filter(k => k.length >= 2)
  for (const kw of keywords) {
    for (const tag of tags) {
      if (tag.includes(kw)) score += 0.15
    }
  }

  return Math.min(score, 1)
}

// ═══════════════════════════════════════
// 3. 核心检索
// ═══════════════════════════════════════

/**
 * retrieveKnowledge(query, options)
 *
 * 混合检索：40% Title + 30% Tags + 30% Semantic
 *
 * @param {string} query     - 用户查询
 * @param {object} options   - { topK?, category?, minScore? }
 * @returns {Array} 排序后的知识条目列表
 */
function retrieveKnowledge(query, options = {}) {
  const { topK = 5, category = null, minScore = 0.1 } = options

  const all = loadAllKnowledge()
  if (!all.length) return []

  // 过滤分类
  const candidates = category
    ? all.filter(e => e.category === category || e._category === category)
    : all

  // 计算 Title + Tag 混合分数
  const scored = candidates.map(entry => {
    const tScore = titleMatch(query, entry) * 0.4
    const gScore = tagMatch(query, entry) * 0.3
    // Semantic 部分（如果有向量就用，否则标题分词兜底）
    const sScore = (tScore > 0 ? tScore * 0.3 : 0) + 0.15 // 兜底
    const totalScore = tScore + gScore + sScore

    return { entry, score: totalScore, titleScore: tScore, tagScore: gScore, semanticScore: sScore }
  })

  // 排序、过滤低分、取 Top-K
  return scored
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.entry)
}

/**
 * retrieveWithEmbedding(query, queryEmbedding, options)
 * 带语义向量的增强检索（如果有 embedding service）
 */
function retrieveWithEmbedding(query, queryEmbedding, options = {}) {
  const { topK = 5, category = null, minScore = 0.1 } = options

  const all = loadAllKnowledge()
  if (!all.length) return []

  const candidates = category
    ? all.filter(e => e.category === category || e._category === category)
    : all

  const scored = candidates.map(entry => {
    const tScore = titleMatch(query, entry) * 0.4
    const gScore = tagMatch(query, entry) * 0.3

    // Semantic：如果知识条目有预计算向量，用向量比；否则降级
    let sScore = 0
    if (queryEmbedding && entry._embedding && entry._embedding.length) {
      sScore = cosineSimilarity(queryEmbedding, entry._embedding) * 0.3
    } else {
      sScore = (tScore + gScore) * 0.15 // 降级
    }

    return { entry, score: tScore + gScore + sScore, titleScore: tScore, tagScore: gScore, semanticScore: sScore }
  })

  return scored
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.entry)
}

/**
 * formatKnowledgeForPrompt(knowledgeList) — 格式化为可注入 Prompt 的文本
 */
function formatKnowledgeForPrompt(knowledgeList) {
  if (!knowledgeList || !knowledgeList.length) return ''

  const parts = knowledgeList.map((k, i) => {
    return `规则${i + 1}：${k.title || ''}
核心公式：${k.coreRule || ''}
解释：${k.explanation || k.summary || ''}`
  })

  return `\n【相关知识库】\n${parts.join('\n\n')}\n`
}

/**
 * getCategoryStats() — 分类统计
 */
function getCategoryStats() {
  const all = loadAllKnowledge()
  const stats = {}
  for (const entry of all) {
    const cat = entry.category || entry._category || 'unknown'
    stats[cat] = (stats[cat] || 0) + 1
  }
  return stats
}

module.exports = {
  loadAllKnowledge,
  reloadKnowledge,
  retrieveKnowledge,
  retrieveWithEmbedding,
  formatKnowledgeForPrompt,
  getCategoryStats,
  titleMatch,
  tagMatch,
}
