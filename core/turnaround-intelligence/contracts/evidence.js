/**
 * core/turnaround-intelligence/contracts/evidence.js
 *
 * CP6-B.1 证据模型 (Evidence Model) — 增强版
 *
 * Evidence 是整个 Turnaround Intelligence Engine 的基础数据类型。
 * 每条 Evidence 将用户原始答案转换为结构化推理素材。
 *
 * 新增 (CP6-B.1):
 *   - importance  — 影响力 (区分于可信度 weight)
 *   - direction   — 正/负/中性方向
 *
 * 以后 Verdict 引用 importance，不是 weight。
 * 以后 Score 直接用 direction，不用 Tag 反推。
 *
 * @version 6.1.0
 * @checkpoint CP6-B.1
 */

const { ALL_TAGS } = require('./tags')

// 负向标签集合（默认 direction = negative 的标签）
const NEGATIVE_TAGS = new Set([
  'ACTION_DELAY', 'INCONSISTENCY', 'EXECUTION_WEAK',
  'SHORT_TERM_ORIENTED', 'EMOTION_DRIVEN', 'OVERTHINKING',
  'SELF_DOUBT', 'ANXIETY_HIGH', 'FIXED_MINDSET', 'EXTERNAL_LOCUS',
  'RISK_SEEK', 'DEBT_PRESSURE', 'INCOME_UNSTABLE', 'SINGLE_INCOME',
])

// 正向标签集合（默认 direction = positive 的标签）
const POSITIVE_TAGS = new Set([
  'EXECUTION_STRONG', 'LEARNING', 'DISCIPLINE', 'PERSISTENCE',
  'LONG_TERM_ORIENTED', 'ACTION_FAST',
  'GROWTH_MINDSET', 'RESILIENCE_HIGH', 'CONFIDENCE',
  'FINANCIAL_BUFFER', 'INCOME_STABLE', 'MULTI_INCOME',
  'STABILITY_SEEKING', 'RISK_AVOID',
])

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
 * @param {number}  params.weight       — 可信度 0.0–1.0（关键词匹配强度）
 * @param {number}  [params.importance] — 影响力 0.0–1.0，该证据对结论的影响力（默认 = weight）
 * @param {'positive'|'negative'|'neutral'} [params.direction] — 方向（默认从 tags 推断）
 * @param {string[]} params.tags        — 关联标签（必须来自 ALL_TAGS）
 * @param {string}  params.reason       — 为什么这条答案构成证据
 * @param {Object}  [params.metadata]   — 额外元数据
 * @returns {Object} 冻结的 Evidence 对象
 */
function createEvidence({ id, questionId, answer, weight, importance, direction, tags, reason, metadata }) {
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

  // importance — 影响力（默认 = weight）
  if (importance !== undefined && (typeof importance !== 'number' || importance < 0 || importance > 1)) {
    throw new Error(`Evidence importance must be 0–1, got: ${importance}`)
  }
  const imp = importance !== undefined ? importance : weight

  // direction — 正/负/中性（默认从 tags 推断）
  if (direction !== undefined && !['positive', 'negative', 'neutral'].includes(direction)) {
    throw new Error(`Evidence direction must be positive|negative|neutral, got: ${direction}`)
  }
  const dir = direction || inferDirection(tags)

  const evidence = Object.freeze({
    id,
    questionId,
    answer: Object.freeze(typeof answer === 'string' ? answer : String(answer)),
    weight: clampWeight(weight, 2),         // 可信度
    importance: clampWeight(imp, 2),        // 影响力
    direction: dir,                          // positive | negative | neutral
    tags: Object.freeze([...tags]),
    reason,
    metadata: metadata ? Object.freeze({ ...metadata }) : Object.freeze({}),
  })

  return evidence
}

/**
 * inferDirection — 从标签推断方向
 */
function inferDirection(tags) {
  if (tags.length === 0) return 'neutral'
  let pos = 0, neg = 0
  for (const tag of tags) {
    if (POSITIVE_TAGS.has(tag)) pos++
    if (NEGATIVE_TAGS.has(tag)) neg++
  }
  if (pos > neg) return 'positive'
  if (neg > pos) return 'negative'
  return 'neutral'
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
 */
function getEvidencesByTag(evidences, tag) {
  if (!ALL_TAGS.has(tag)) {
    throw new Error(`Unknown tag for filtering: "${tag}"`)
  }
  return evidences.filter(e => e.tags.includes(tag))
}

/**
 * getEvidencesByQuestion — 按题目筛选证据
 */
function getEvidencesByQuestion(evidences, questionId) {
  return evidences.filter(e => e.questionId === questionId)
}

/**
 * getTopEvidences — 按 importance 取 top N 条证据
 */
function getTopEvidences(evidences, n = 5) {
  return [...evidences]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, n)
}

/**
 * getEvidencesByDirection — 按方向筛选
 */
function getEvidencesByDirection(evidences, direction) {
  return evidences.filter(e => e.direction === direction)
}

/**
 * aggregateTagsFromEvidence — 从证据集中聚合标签统计
 */
function aggregateTagsFromEvidence(evidences) {
  const agg = {}
  for (const ev of evidences) {
    for (const tag of ev.tags) {
      if (!agg[tag]) {
        agg[tag] = { count: 0, totalWeight: 0, totalImportance: 0, evidenceIds: [] }
      }
      agg[tag].count += 1
      agg[tag].totalWeight += ev.weight
      agg[tag].totalImportance += (ev.importance || ev.weight)
      agg[tag].evidenceIds.push(ev.id)
    }
  }
  return Object.freeze(agg)
}

/**
 * validateEvidenceChain — 验证证据链完整性
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
  getEvidencesByDirection,
  aggregateTagsFromEvidence,
  validateEvidenceChain,
  POSITIVE_TAGS,
  NEGATIVE_TAGS,
  inferDirection,
}
