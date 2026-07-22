/**
 * core/turnaround-intelligence/contracts/cognitive.js
 *
 * CP6-B Cognitive 数据契约
 *
 * 定义 Cognitive Engine 的输出结构、五维评分维度、评分规则、
 * 差距检测类型和置信度计算方法。
 *
 * Cognitive Engine 回答: "这些模式在五个能力维度上表现如何？"
 *
 * 本模块的 overall 评分是 Cognitive Overall Score，
 * 不是最终的 Turnaround Potential（P0-02 由 Verdict Engine 综合计算）。
 *
 * @version 6.0.0
 * @checkpoint CP6-B
 */

const { SCORE_RANGE } = require('../../turnaround-os/constants')

// ═══════════════════════════════════════
// 五维认知维度
// ═══════════════════════════════════════

const COGNITIVE_DIMENSIONS = {
  COGNITION: 'cognition',           // 认知判断力
  EXECUTION: 'execution',           // 执行兑现力
  DISCIPLINE: 'discipline',         // 纪律持续力
  ADAPTABILITY: 'adaptability',     // 学习适应力
  RISK_CONTROL: 'riskControl',      // 风险控制力
}

const COGNITIVE_DIMENSION_LABELS = {
  cognition: '认知判断力',
  execution: '执行兑现力',
  discipline: '纪律持续力',
  adaptability: '学习适应力',
  riskControl: '风险控制力',
}

const DIMENSION_ORDER = ['cognition', 'execution', 'discipline', 'adaptability', 'riskControl']

// ═══════════════════════════════════════
// 评分等级
// ═══════════════════════════════════════

const SCORE_LEVELS = {
  EXCELLENT: 'EXCELLENT',   // ≥ 80
  GOOD: 'GOOD',             // 65–79
  MEDIUM: 'MEDIUM',         // 45–64
  WEAK: 'WEAK',             // 25–44
  CRITICAL: 'CRITICAL',     // < 25
}

const SCORE_LEVEL_RANGES = {
  EXCELLENT: { min: 80, max: 100 },
  GOOD: { min: 65, max: 79 },
  MEDIUM: { min: 45, max: 64 },
  WEAK: { min: 25, max: 44 },
  CRITICAL: { min: 0, max: 24 },
}

function getScoreLevel(score) {
  if (score >= 80) return SCORE_LEVELS.EXCELLENT
  if (score >= 65) return SCORE_LEVELS.GOOD
  if (score >= 45) return SCORE_LEVELS.MEDIUM
  if (score >= 25) return SCORE_LEVELS.WEAK
  return SCORE_LEVELS.CRITICAL
}

// ═══════════════════════════════════════
// Overall 权重
// ═══════════════════════════════════════

const OVERALL_WEIGHTS = {
  cognition: 0.20,
  execution: 0.25,       // 权重最高 — 翻身产品核心是行动
  discipline: 0.20,
  adaptability: 0.20,
  riskControl: 0.15,
}

// ═══════════════════════════════════════
// 评分常量
// ═══════════════════════════════════════

const BASE_SCORE = 50                 // 基础分 — 不从 0 开始
const MAX_SINGLE_CONTRIBUTION = 12    // 单条 Evidence 对单维最大影响
const MIN_EVIDENCE_FOR_DIMENSION = 2  // 单维度最少证据数才输出强判断

// ═══════════════════════════════════════
// 差距检测类型
// ═══════════════════════════════════════

const GAP_TYPES = {
  COGNITION_EXECUTION_GAP: 'COGNITION_EXECUTION_GAP',           // 认知 vs 执行
  AMBITION_DISCIPLINE_GAP: 'AMBITION_DISCIPLINE_GAP',           // 志向 vs 纪律
  LEARNING_MONETIZATION_GAP: 'LEARNING_MONETIZATION_GAP',       // 学习 vs 变现
  RISK_REWARD_MISMATCH: 'RISK_REWARD_MISMATCH',                 // 风险 vs 回报
  STABILITY_GROWTH_CONFLICT: 'STABILITY_GROWTH_CONFLICT',       // 稳定 vs 增长
}

const GAP_THRESHOLDS = {
  NORMAL: { max: 14, label: '正常' },
  NOTICEABLE: { max: 24, label: '明显' },
  HIGH: { max: 34, label: '高' },
  SEVERE: { min: 35, label: '严重' },
}

function getGapSeverity(gap) {
  if (gap >= 35) return 'SEVERE'
  if (gap >= 25) return 'HIGH'
  if (gap >= 15) return 'NOTICEABLE'
  return 'NORMAL'
}

// ═══════════════════════════════════════
// 置信度常量
// ═══════════════════════════════════════

const CONFIDENCE_LEVELS = {
  STRONG: { min: 0.80, label: '明确判断' },
  MODERATE: { min: 0.65, label: '较明显' },
  WEAK: { min: 0.45, label: '可能' },
  INSUFFICIENT: { max: 0.45, label: '证据不足，不输出强判断' },
}

// ═══════════════════════════════════════
// createCognitiveOutput — 创建 Cognitive 输出
// ═══════════════════════════════════════

/**
 * createCognitiveOutput
 *
 * @param {Object} params
 * @param {string} params.version
 * @param {string} params.scoringVersion   — 评分规则版本，如 "cp6-b-v1"
 * @param {Object} params.dimensions       — { cognition: {}, execution: {}, ... }
 * @param {Object} params.overall          — { score, level, confidence }
 * @param {string} params.strongestDimension
 * @param {string} params.weakestDimension
 * @param {Object|null} params.keyGap       — { code, gap, severity, evidenceRefs }
 * @param {string[]} params.evidenceRefs
 * @returns {Object} 冻结的 CognitiveOutput
 */
function createCognitiveOutput({
  version, scoringVersion, dimensions, overall,
  strongestDimension, weakestDimension, keyGap, evidenceRefs,
}) {
  if (!version) throw new Error('CognitiveOutput: version required')
  if (!scoringVersion) throw new Error('CognitiveOutput: scoringVersion required')

  // 维度验证
  for (const dim of DIMENSION_ORDER) {
    const d = dimensions[dim]
    if (!d) throw new Error(`CognitiveOutput: missing dimension "${dim}"`)
    if (typeof d.score !== 'number' || d.score < SCORE_RANGE.MIN || d.score > SCORE_RANGE.MAX) {
      throw new Error(`CognitiveOutput: ${dim}.score must be ${SCORE_RANGE.MIN}–${SCORE_RANGE.MAX}, got ${d.score}`)
    }
    if (!SCORE_LEVELS[d.level]) {
      throw new Error(`CognitiveOutput: ${dim}.level invalid: "${d.level}"`)
    }
    if (typeof d.confidence !== 'number' || d.confidence < 0 || d.confidence > 1) {
      throw new Error(`CognitiveOutput: ${dim}.confidence must be 0–1, got ${d.confidence}`)
    }
  }

  // Overall 验证
  if (typeof overall.score !== 'number' || overall.score < 0 || overall.score > 100) {
    throw new Error(`CognitiveOutput: overall.score must be 0–100, got ${overall.score}`)
  }

  // 最强/最弱 — 接受 dimension key (小写)
  const validDims = Object.values(COGNITIVE_DIMENSIONS)
  if (!validDims.includes(strongestDimension)) {
    throw new Error(`CognitiveOutput: invalid strongestDimension "${strongestDimension}". Must be one of: ${validDims.join(', ')}`)
  }
  if (!validDims.includes(weakestDimension)) {
    throw new Error(`CognitiveOutput: invalid weakestDimension "${weakestDimension}". Must be one of: ${validDims.join(', ')}`)
  }

  // KeyGap 验证
  if (keyGap) {
    if (!GAP_TYPES[keyGap.code]) {
      throw new Error(`CognitiveOutput: invalid keyGap code "${keyGap.code}"`)
    }
    // 验证 gap 值的严重等级是否匹配
    const expectedSeverity = getGapSeverity(Math.abs(keyGap.gap))
    if (keyGap.severity && keyGap.severity !== expectedSeverity) {
      throw new Error(
        `CognitiveOutput: keyGap.severity "${keyGap.severity}" ` +
        `does not match gap value ${keyGap.gap} (expected "${expectedSeverity}")`
      )
    }
  }

  return Object.freeze({
    version,
    scoringVersion,
    dimensions: Object.freeze(
      Object.fromEntries(DIMENSION_ORDER.map(dim => [
        dim,
        Object.freeze({
          score: dimensions[dim].score,
          level: dimensions[dim].level,
          confidence: dimensions[dim].confidence,
          positiveEvidenceRefs: Object.freeze([...(dimensions[dim].positiveEvidenceRefs || [])]),
          negativeEvidenceRefs: Object.freeze([...(dimensions[dim].negativeEvidenceRefs || [])]),
          factors: Object.freeze((dimensions[dim].factors || []).map(f =>
            Object.freeze({ tag: f.tag, contribution: f.contribution })
          )),
        }),
      ]))
    ),
    overall: Object.freeze({
      score: overall.score,
      level: overall.level,
      confidence: overall.confidence,
    }),
    strongestDimension,
    weakestDimension,
    keyGap: keyGap ? Object.freeze({
      code: keyGap.code,
      gap: keyGap.gap,
      severity: keyGap.severity || getGapSeverity(Math.abs(keyGap.gap)),
      evidenceRefs: Object.freeze([...(keyGap.evidenceRefs || [])]),
    }) : null,
    evidenceRefs: Object.freeze([...(evidenceRefs || [])]),
  })
}

module.exports = {
  COGNITIVE_DIMENSIONS,
  COGNITIVE_DIMENSION_LABELS,
  DIMENSION_ORDER,
  SCORE_LEVELS,
  SCORE_LEVEL_RANGES,
  getScoreLevel,
  OVERALL_WEIGHTS,
  BASE_SCORE,
  MAX_SINGLE_CONTRIBUTION,
  MIN_EVIDENCE_FOR_DIMENSION,
  GAP_TYPES,
  GAP_THRESHOLDS,
  getGapSeverity,
  CONFIDENCE_LEVELS,
  createCognitiveOutput,
}
