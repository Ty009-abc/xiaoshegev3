/**
 * knowledge/index.js — 知识库统一导出
 *
 * 四册 Part 3：世界模型知识库
 *
 * 提供：
 *   1. 按分类获取所有知识
 *   2. 按 ID 获取单条知识
 *   3. 全量统计
 *   4. 关键词搜索
 */

const { loadAllKnowledge, retrieveKnowledge, getCategoryStats } = require('../cloudfunctions/common/knowledgeRetriever.js')

/**
 * getAll(category?) — 获取所有知识（可选按分类过滤）
 */
function getAll(category) {
  const all = loadAllKnowledge()
  if (category) return all.filter(e => e.category === category)
  return all
}

/**
 * getById(knowledgeId) — 按 ID 获取
 */
function getById(knowledgeId) {
  const all = loadAllKnowledge()
  return all.find(e => e.knowledgeId === knowledgeId) || null
}

/**
 * search(query, topK) — 关键词搜索
 */
function search(query, topK = 10) {
  return retrieveKnowledge(query, { topK })
}

/**
 * stats() — 知识库统计
 */
function stats() {
  const all = loadAllKnowledge()
  const catStats = getCategoryStats()
  return {
    total: all.length,
    categories: catStats,
    avgDifficulty: (all.reduce((s, e) => s + (e.difficulty || 1), 0) / all.length).toFixed(1),
    avgImportance: (all.reduce((s, e) => s + (e.importance || 5), 0) / all.length).toFixed(1),
  }
}

module.exports = { getAll, getById, search, stats }
