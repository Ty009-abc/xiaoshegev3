/**
 * core/turnaround-intelligence/contracts/evidence.js
 *
 * CP6-A 证据模型 (Evidence Model)
 *
 * Evidence 是整个 Turnaround Intelligence Engine 的基础数据类型。
 * 每条 Evidence 将用户原始答案转换为结构化推理素材。
 *
 * 所有 Engine 只能读取 Evidence，不允许直接读取原始答案。
 *
 * @version 6.0.0
 * @checkpoint CP6-A
 */

const { ALL_TAGS } = require('./tags')

// ═══════════════════════════════════════
// Evidence — 单条证据
// ═══════════════════════════════════════

/**
 * createEvidence — 创建一条证据
 *
 * @param {Object} params
 * @param {string}  params.id           — 证据ID，格式 E-NNN
 * @param {string}  params.questionId   — 来源题目ID，如 "Q4"
 * @param {string}  params.answer       — 用户答案摘要
 * @param {number}  params.weight       — 权重 0.0–1.0，表示该证据在推理中的重要程度
 * @param {string[]} params.tags        — 关联标签（必须来自 ALL_TAGS）
 * @param {string}  params.reason       — 为什么这条答案构成证据
 * @param {Object}  [params.metadata]   — 额外元数据
 * @returns {Object} 冻结的 Evidence 对象
 */
function createEvidence({ id, questionId, answer, weight, tags, reason, metadata }) {
  if (!id || typeof id !== 'string') {
    throw new Error(`Evidence id required and must be a string, got: ${JSON.stringify(id)}`)
  }
  if (!questionId) {
    throw new Error('Evidence questionId required')
  }
  if (answer === undefined || answer === null) {
    throw new Error('Evidence answer required')
  }
  if (typeof weight !== 'number' || weight < 0 || weight > 1) {
    throw new Error(`Evidence weight must be 0–1, got: ${weight}`)
  }
  if (!Array.isArray(tags)) {
    throw new Error('Evidence tags must be an array')
  }
  // 允许空标签（证据不足的场景）
  for (const tag of tags) {
    if (!ALL_TAGS.has(tag)) {
      throw new Error(`Evidence tag not in ALL_TAGS: "${tag}"`)
    }
  }
  if (!reason || typeof reason !== 'string') {
    throw new Error('Evidence reason required')
  }

  const evidence = Object.freeze({
    id,
    questionId,
    answer: Object.freeze(typeof answer === 'string' ? answer : String(answer)),
    weight: clampWeight(weight, 2),
    tags: Object.freeze([...tags]),
    reason,
    metadata: metadata ? Object.freeze({ ...metadata }) : Object.freeze({}),
  })

  return evidence
}

/**
 * createEvidenceSet — 创建一组证据
 *
 * @param {Object[]} evidenceList — createEvidence 参数数组
 * @returns {Object[]} 冻结的 Evidence 数组 + 元数据
 */
function createEvidenceSet(evidenceList) {
  const evidences = evidenceList.map(e => createEvidence(e))

  // 验证 ID 唯一性
  const ids = new Set()
  for (const ev of evidences) {
    if (ids.has(ev.id)) {
      throw new Error(`Duplicate Evidence id: ${ev.id}`)
    }
    ids.add(ev.id)
  }

  // 验证覆盖情况（不强制要求最小题目数，因为用户可能只答了几道题）
  const questions = new Set(evidences.map(e => e.questionId))

  return Object.freeze({
    evidences: Object.freeze(evidences),
    meta: Object.freeze({
      totalCount: evidences.length,
      questionCount: questions.size,
      totalWeight: round(evidences.reduce((sum, e) => sum + e.weight, 0), 2),
    }),
  })
}

/**
 * getEvidencesByTag — 按标签筛选证据
 *
 * @param {Object[]} evidences
 * @param {string} tag
 * @returns {Object[]}
 */
function getEvidencesByTag(evidences, tag) {
  if (!ALL_TAGS.has(tag)) {
    throw new Error(`Unknown tag for filtering: "${tag}"`)
  }
  return evidences.filter(e => e.tags.includes(tag))
}

/**
 * getEvidencesByQuestion — 按题目筛选证据
 *
 * @param {Object[]} evidences
 * @param {string} questionId
 * @returns {Object[]}
 */
function getEvidencesByQuestion(evidences, questionId) {
  return evidences.filter(e => e.questionId === questionId)
}

/**
 * getTopEvidences — 按权重取 top N 条证据
 *
 * @param {Object[]} evidences
 * @param {number} [n=5]
 * @returns {Object[]}
 */
function getTopEvidences(evidences, n = 5) {
  return [...evidences]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, n)
}

/**
 * aggregateTagsFromEvidence — 从证据集中聚合标签统计
 *
 * @param {Object[]} evidences
 * @returns {Object} { tag → { count, totalWeight, evidences[] } }
 */
function aggregateTagsFromEvidence(evidences) {
  const agg = {}
  for (const ev of evidences) {
    for (const tag of ev.tags) {
      if (!agg[tag]) {
        agg[tag] = { count: 0, totalWeight: 0, evidenceIds: [] }
      }
      agg[tag].count += 1
      agg[tag].totalWeight += ev.weight
      agg[tag].evidenceIds.push(ev.id)
    }
  }
  return Object.freeze(agg)
}

/**
 * validateEvidenceChain — 验证证据链完整性
 *
 * 检查点:
 *  1. 最少 2 条证据
 *  2. 最少覆盖 2 道题
 *  3. 无重复ID
 *  4. 所有权重在 [0,1]
 *  5. 所有标签有效
 *
 * @param {Object[]} evidences
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateEvidenceChain(evidences) {
  const errors = []

  if (!evidences || evidences.length < 2) {
    errors.push('Evidence chain must contain at least 2 evidences')
  }

  const questionIds = new Set()
  const ids = new Set()
  for (let i = 0; i < evidences.length; i++) {
    const ev = evidences[i]
    if (!ev || !ev.id) {
      errors.push(`Evidence[${i}] missing id`)
      continue
    }
    if (ids.has(ev.id)) {
      errors.push(`Duplicate Evidence id: ${ev.id}`)
    }
    ids.add(ev.id)
    if (ev.questionId) questionIds.add(ev.questionId)
    if (typeof ev.weight !== 'number' || ev.weight < 0 || ev.weight > 1) {
      errors.push(`Evidence[${ev.id}] weight out of range: ${ev.weight}`)
    }
    if (Array.isArray(ev.tags)) {
      for (const tag of ev.tags) {
        if (!ALL_TAGS.has(tag)) {
          errors.push(`Evidence[${ev.id}] invalid tag: "${tag}"`)
        }
      }
    } else {
      errors.push(`Evidence[${ev.id}] tags must be an array`)
    }
  }

  // 不强制最小题目数 — 由上层 Verdict Engine 决定证据是否足够

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  })
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function clampWeight(val, decimals) {
  return round(Math.max(0, Math.min(1, val)), decimals)
}

function round(val, decimals) {
  const factor = Math.pow(10, decimals)
  return Math.round(val * factor) / factor
}

module.exports = {
  createEvidence,
  createEvidenceSet,
  getEvidencesByTag,
  getEvidencesByQuestion,
  getTopEvidences,
  aggregateTagsFromEvidence,
  validateEvidenceChain,
}
