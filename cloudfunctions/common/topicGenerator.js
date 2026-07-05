/**
 * topicGenerator.js — 选题生成器（第六册 Part 2）
 *
 * 1000 选题池，按矩阵分类：
 *   casino(300) / cognition(250) / ai(250) / trending(200)
 *
 * 支持：
 *   随机选题 / 矩阵选题 / 热点追加 / 已用过滤 / 选题评分
 */

// ── 选题库加载（lazy，避免冷启动加载 1000 条）──
let TOPIC_CACHE = null

function _loadTopics() {
  if (TOPIC_CACHE) return TOPIC_CACHE
  try {
    TOPIC_CACHE = require('../content/topics/index.js')
  } catch (_) {
    // fallback built-in
    TOPIC_CACHE = require('../../content/topics/index.js')
  }
  return TOPIC_CACHE
}

// ═══════════════════════════
// getRandomTopic — 随机选题
// ═══════════════════════════

async function getRandomTopic(matrix, excludeIds = []) {
  const topics = _loadTopics()
  let pool = topics.filter(t => t.matrix === matrix)

  if (excludeIds.length > 0) {
    pool = pool.filter(t => !excludeIds.includes(t.id))
  }

  if (pool.length === 0) {
    // fallback = 跨矩阵
    pool = topics.filter(t => !excludeIds.includes(t.id))
  }
  if (pool.length === 0) {
    return { id: `${matrix}_000`, key: `fresh_${matrix}`, title: `${MATRIX_NAMES[matrix] || '未知'} · 新选题`, matrix, score: 70 }
  }

  // 按 score 加权随机（高分更容易被选中，但不是绝对的）
  const totalScore = pool.reduce((s, t) => s + (t.score || 70), 0)
  let rand = Math.random() * totalScore
  for (const topic of pool) {
    rand -= (topic.score || 70)
    if (rand <= 0) return topic
  }
  return pool[pool.length - 1]
}

// ═══════════════════════════
// getTopicPool — 获取指定矩阵的选题池
// ═══════════════════════════

async function getTopicPool(matrix, options = {}) {
  const { limit = 20, excludeIds = [], minScore = 0 } = options
  const topics = _loadTopics()
  let pool = topic.filter(t => t.matrix === matrix)

  if (excludeIds.length > 0) pool = pool.filter(t => !excludeIds.includes(t.id))
  if (minScore > 0) pool = pool.filter(t => (t.score || 70) >= minScore)

  return pool.sort((a, b) => (b.score || 70) - (a.score || 70)).slice(0, limit)
}

// ═══════════════════════════
// getMatrixStats — 矩阵选题统计
// ═══════════════════════════

async function getMatrixStats() {
  const topics = _loadTopics()
  const stats = {}
  for (const t of topics) {
    if (!stats[t.matrix]) stats[t.matrix] = { total: 0, avgScore: 0, scores: [] }
    stats[t.matrix].total++
    stats[t.matrix].scores.push(t.score || 70)
  }

  return Object.entries(stats).map(([matrix, s]) => ({
    matrix,
    label: MATRIX_NAMES[matrix] || matrix,
    count: s.total,
    target: MATRIX_TARGETS[matrix] || 0,
    progress: Math.round((s.total / (MATRIX_TARGETS[matrix] || 1)) * 10000) / 100,
    avgScore: Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length),
  }))
}

// ═══════════════════════════
// addTopic — 动态添加选题
// ═══════════════════════════

async function addTopic(topic) {
  const topics = _loadTopics()
  const id = `${topic.matrix || 'custom'}_custom_${topics.length + 1}`
  const newTopic = {
    id,
    key: topic.key || topic.title?.slice(0, 20) || 'custom',
    title: topic.title || '',
    matrix: topic.matrix || 'cognition',
    hooks: topic.hooks || [],
    score: topic.score || 70,
    tag: topic.tag || '',
    addedAt: Date.now(),
  }
  topics.push(newTopic)
  return newTopic
}

const MATRIX_NAMES = {
  casino: '赌场认知',
  cognition: '认知暴击',
  ai: 'AI翻身',
  trending: '热点拆解',
}

const MATRIX_TARGETS = {
  casino: 300,
  cognition: 250,
  ai: 250,
  trending: 200,
}

module.exports = {
  getRandomTopic,
  getTopicPool,
  getMatrixStats,
  addTopic,
  MATRIX_NAMES,
  MATRIX_TARGETS,
}
