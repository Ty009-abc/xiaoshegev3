/**
 * core/turnaround-intelligence/contracts/verdict.js
 *
 * CP6-A Verdict Engine 数据契约
 *
 * 定义 Verdict Engine 的输入、输出和数据格式。
 *
 * Verdict Engine 不允许直接读取原始答案。
 * 必须基于 Evidence + Profile + Scores。
 *
 * @version 6.0.0
 * @checkpoint CP6-A
 */

const { ALL_TAGS, PATTERN_TAGS } = require('./tags')
const { SCORE_RANGE } = require('../../turnaround-os/constants')

// ═══════════════════════════════════════
// P0-01 命运判决 (Fatal Diagnosis)
// ═══════════════════════════════════════

/**
 * createVerdict — 创建命运判决
 *
 * @param {Object} params
 * @param {string}  params.verdict        — 核心判断，≤40 汉字
 * @param {string}  params.corePattern    — 核心模式（来自 PATTERN_TAGS）
 * @param {string[]} params.evidenceRefs   — 证据引用（至少 2 条 Evidence ID）
 * @param {number}  params.confidence     — 置信度 0.0–1.0
 * @param {string[]} [params.supportTags]  — 支撑标签
 * @returns {Object} 冻结的 Verdict
 */
function createVerdict({ verdict, corePattern, evidenceRefs, confidence, supportTags }) {
  // 长度验证
  if (!verdict || typeof verdict !== 'string') {
    throw new Error('Verdict text required')
  }
  const len = [...verdict].length
  if (len > 40) {
    throw new Error(`Verdict exceeds 40 chars (${len} chars): "${verdict}"`)
  }

  // 禁止词校验
  const bannedPatterns = [
    /废物/, /无能/, /没救/, /注定/, /永远/, /绝[无望]/,
    /活该/, /该死/, /不配/, /天生/, /命中注定/,
  ]
  for (const pattern of bannedPatterns) {
    if (pattern.test(verdict)) {
      throw new Error(`Verdict contains banned pattern: "${pattern}" → "${verdict}"`)
    }
  }

  // corePattern 验证
  if (!corePattern || !PATTERN_TAGS[corePattern]) {
    throw new Error(`Invalid corePattern: "${corePattern}". Must be a PATTERN_TAG.`)
  }

  // 证据链验证
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length < 2) {
    throw new Error(`Verdict must reference at least 2 evidences, got ${evidenceRefs ? evidenceRefs.length : 0}`)
  }

  // 置信度
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error(`Confidence must be 0.0–1.0, got ${confidence}`)
  }

  // 标签验证
  const tags = supportTags || []
  for (const tag of tags) {
    if (!ALL_TAGS.has(tag)) {
      throw new Error(`Verdict support tag not in ALL_TAGS: "${tag}"`)
    }
  }

  return Object.freeze({
    verdict,
    corePattern,
    evidenceRefs: Object.freeze([...evidenceRefs]),
    confidence,
    supportTags: Object.freeze([...tags]),
  })
}

// ═══════════════════════════════════════
// P0-02 翻身潜力 (Turnaround Potential)
// ═══════════════════════════════════════

/**
 * Potential Levels
 */
const POTENTIAL_LEVELS = {
  HIGH: 'HIGH',
  MODERATE: 'MODERATE',
  LOW: 'LOW',
}

const POTENTIAL_LEVEL_LABELS = {
  HIGH: '高',
  MODERATE: '中',
  LOW: '低',
}

/**
 * Potential State
 */
const POTENTIAL_STATES = {
  REVERSIBLE: '可逆',
  PROGRESSIVE: '渐进式可改',
  CONSTRAINED: '受限',
  DEEP_ROOTED: '根深蒂固',
}

/**
 * Score Breakdown Dimensions (5 维度)
 */
const POTENTIAL_DIMENSIONS = {
  COGNITION: 'cognition',       // 认知能力
  EXECUTION: 'execution',       // 执行力
  ADAPTABILITY: 'adaptability', // 适应力
  LEVERAGE: 'leverage',         // 杠杆空间
  RISK_CONTROL: 'riskControl',  // 风险控制
}

const POTENTIAL_DIMENSION_LABELS = {
  cognition: '认知潜力',
  execution: '执行力',
  adaptability: '适应力',
  leverage: '杠杆空间',
  riskControl: '风险控制',
}

const POTENTIAL_DIMENSION_MAX = 20  // 每个维度最高 20 分 → 总分 100

/**
 * createPotential — 创建翻身潜力评分
 *
 * @param {Object} params
 * @param {number}  params.score              — 总评分 0–100
 * @param {string}  params.level              — POTENTIAL_LEVELS 之一
 * @param {string}  params.state              — POTENTIAL_STATES 之一
 * @param {string[]} params.strengths         — 优势（2–3 条）
 * @param {string[]} params.constraints        — 约束/劣势（1–3 条）
 * @param {Object}  params.scoreBreakdown     — { cognition, execution, adaptability, leverage, riskControl }
 * @param {string}  params.disclaimer         — 免责声明
 * @param {string[]} [params.evidenceRefs]    — 支撑证据
 * @returns {Object} 冻结的 Potential
 */
function createPotential({
  score, level, state, strengths, constraints,
  scoreBreakdown, disclaimer, evidenceRefs,
}) {
  // 总分
  if (typeof score !== 'number' || score < SCORE_RANGE.MIN || score > SCORE_RANGE.MAX) {
    throw new Error(`Potential score must be ${SCORE_RANGE.MIN}–${SCORE_RANGE.MAX}, got ${score}`)
  }

  // 等级
  if (!POTENTIAL_LEVELS[level]) {
    throw new Error(`Invalid potential level: "${level}"`)
  }

  // 状态
  if (!Object.values(POTENTIAL_STATES).includes(state)) {
    throw new Error(`Invalid potential state: "${state}"`)
  }

  // 优势
  if (!Array.isArray(strengths) || strengths.length < 2 || strengths.length > 3) {
    throw new Error(`Potential strengths: need 2–3 items, got ${strengths ? strengths.length : 0}`)
  }

  // 约束
  if (!Array.isArray(constraints) || constraints.length < 1 || constraints.length > 3) {
    throw new Error(`Potential constraints: need 1–3 items, got ${constraints ? constraints.length : 0}`)
  }

  // 分项验证
  if (!scoreBreakdown || typeof scoreBreakdown !== 'object') {
    throw new Error('Potential scoreBreakdown required')
  }
  let breakdownSum = 0
  for (const dim of Object.values(POTENTIAL_DIMENSIONS)) {
    const val = scoreBreakdown[dim]
    if (typeof val !== 'number' || val < 0 || val > POTENTIAL_DIMENSION_MAX) {
      throw new Error(`Potential scoreBreakdown.${dim} must be 0–${POTENTIAL_DIMENSION_MAX}, got ${val}`)
    }
    breakdownSum += val
  }
  // 各维度之和应接近总分
  if (Math.abs(breakdownSum - score) > 10) {
    throw new Error(`Potential score breakdown sum (${breakdownSum}) deviates too much from score (${score})`)
  }

  // 免责声明
  if (!disclaimer || typeof disclaimer !== 'string') {
    throw new Error('Potential disclaimer required')
  }

  return Object.freeze({
    score,
    level,
    state,
    strengths: Object.freeze([...strengths]),
    constraints: Object.freeze([...constraints]),
    scoreBreakdown: Object.freeze({ ...scoreBreakdown }),
    disclaimer,
    evidenceRefs: evidenceRefs ? Object.freeze([...evidenceRefs]) : Object.freeze([]),
  })
}

/**
 * getLevelFromScore — 从评分映射到等级
 *
 * 规则:
 *   ≥ 70 → HIGH
 *   40–69 → MODERATE
 *   < 40 → LOW
 *
 * @param {number} score
 * @returns {string} POTENTIAL_LEVEL
 */
function getLevelFromScore(score) {
  if (score >= 70) return POTENTIAL_LEVELS.HIGH
  if (score >= 40) return POTENTIAL_LEVELS.MODERATE
  return POTENTIAL_LEVELS.LOW
}

/**
 * getStateFromScore — 从评分映射到状态
 *
 * @param {number} score
 * @returns {string} POTENTIAL_STATE
 */
function getStateFromScore(score) {
  if (score >= 70) return POTENTIAL_STATES.REVERSIBLE
  if (score >= 50) return POTENTIAL_STATES.PROGRESSIVE
  if (score >= 30) return POTENTIAL_STATES.CONSTRAINED
  return POTENTIAL_STATES.DEEP_ROOTED
}

// ═══════════════════════════════════════
// VerdictInput — Verdict Engine 统一输入
// ═══════════════════════════════════════

/**
 * createVerdictInput — 从 TurnaroundContext 提取 Verdict Engine 输入
 *
 * Verdict Engine 只接收此对象，不允许直接读取 answers。
 *
 * @param {Object} ctx — TurnaroundContext (after all engines have run)
 * @returns {Object} VerdictInput（冻结）
 */
function createVerdictInput(ctx) {
  // 必须验证输入完整性
  const missing = []
  if (!ctx.evidence || !ctx.evidence.evidences) missing.push('evidence')
  if (!ctx.profile) missing.push('profile')
  if (!ctx.cognitive) missing.push('cognitive')
  if (!ctx.risks) missing.push('risks')
  if (!ctx.leverages) missing.push('leverages')
  if (!ctx.strategy) missing.push('strategy')

  if (missing.length > 0) {
    throw new Error(`VerdictInput incomplete: missing [${missing.join(', ')}]`)
  }

  return Object.freeze({
    evidence: ctx.evidence,
    profile: ctx.profile,
    cognitive: ctx.cognitive,
    risks: ctx.risks,
    leverages: ctx.leverages,
    strategy: ctx.strategy,
  })
}

// ═══════════════════════════════════════
// VerdictOutput — Verdict Engine 统一输出
// ═══════════════════════════════════════

/**
 * createVerdictOutput — 包装 Verdict + Potential
 *
 * @param {Object} verdict   — createVerdict 输出
 * @param {Object} potential — createPotential 输出
 * @returns {Object} VerdictOutput（冻结）
 */
function createVerdictOutput(verdict, potential) {
  if (!verdict || !verdict.verdict) throw new Error('Verdict output requires valid verdict')
  if (!potential || typeof potential.score !== 'number') throw new Error('Verdict output requires valid potential')

  return Object.freeze({
    verdict,
    potential,
  })
}

module.exports = {
  // Verdict
  createVerdict,
  // Potential
  createPotential,
  POTENTIAL_LEVELS,
  POTENTIAL_LEVEL_LABELS,
  POTENTIAL_STATES,
  POTENTIAL_DIMENSIONS,
  POTENTIAL_DIMENSION_LABELS,
  POTENTIAL_DIMENSION_MAX,
  getLevelFromScore,
  getStateFromScore,
  // I/O
  createVerdictInput,
  createVerdictOutput,
}
