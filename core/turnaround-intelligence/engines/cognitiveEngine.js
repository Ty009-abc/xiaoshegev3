/**
 * core/turnaround-intelligence/engines/cognitiveEngine.js
 *
 * CP6-B Cognitive Engine — 五维确定性评分
 *
 * 从 Evidence + Profile 中计算五个认知维度的评分。
 *
 * 评分规则:
 *   BASE_SCORE(50) + Σ(rule.contribution × evidence.weight) + consistencyBonus - contradictionPenalty
 *
 * 所有评分可通过 factors 重新计算。
 * 不使用 AI、随机数或隐藏常量。
 *
 * @version 6.0.0
 * @checkpoint CP6-B
 */

const {
  COGNITIVE_DIMENSIONS, DIMENSION_ORDER,
  getScoreLevel, OVERALL_WEIGHTS,
  BASE_SCORE, MAX_SINGLE_CONTRIBUTION, MIN_EVIDENCE_FOR_DIMENSION,
  GAP_TYPES, getGapSeverity, CONFIDENCE_LEVELS,
  createCognitiveOutput,
} = require('../contracts/cognitive')
const { BEHAVIOR_TAGS, PSYCHOLOGY_TAGS, WEALTH_TAGS } = require('../contracts/tags')
const { aggregateTagsFromEvidence } = require('../contracts/evidence')

// ═══════════════════════════════════════
// Scoring Rules — 标签 → 维度贡献映射
// ═══════════════════════════════════════

/**
 * 每条规则定义:
 *   tag: 目标标签
 *   dimension: 影响哪个维度
 *   baseContribution: 基础贡献值 (±)
 *   type: 'positive' | 'negative'
 *   minWeight: 证据权重必须 ≥ 此值才能触发
 */
const SCORING_RULES = [
  // --- COGNITION (认知判断力) ---
  { tag: BEHAVIOR_TAGS.LEARNING, dimension: 'cognition', baseContribution: 8, type: 'positive' },
  { tag: BEHAVIOR_TAGS.OVERTHINKING, dimension: 'cognition', baseContribution: 4, type: 'positive', note: '分析能力有正向价值' },
  { tag: PSYCHOLOGY_TAGS.GROWTH_MINDSET, dimension: 'cognition', baseContribution: 7, type: 'positive' },
  { tag: BEHAVIOR_TAGS.SHORT_TERM_ORIENTED, dimension: 'cognition', baseContribution: -5, type: 'negative' },
  { tag: PSYCHOLOGY_TAGS.SELF_DOUBT, dimension: 'cognition', baseContribution: -3, type: 'negative', note: '自我怀疑降低判断信心' },
  { tag: PSYCHOLOGY_TAGS.CONFIDENCE, dimension: 'cognition', baseContribution: 5, type: 'positive' },
  { tag: BEHAVIOR_TAGS.LONG_TERM_ORIENTED, dimension: 'cognition', baseContribution: 6, type: 'positive' },

  // --- EXECUTION (执行兑现力) ---
  { tag: BEHAVIOR_TAGS.EXECUTION_STRONG, dimension: 'execution', baseContribution: 10, type: 'positive' },
  { tag: BEHAVIOR_TAGS.ACTION_DELAY, dimension: 'execution', baseContribution: -8, type: 'negative' },
  { tag: BEHAVIOR_TAGS.INCONSISTENCY, dimension: 'execution', baseContribution: -7, type: 'negative' },
  { tag: BEHAVIOR_TAGS.ACTION_FAST, dimension: 'execution', baseContribution: 6, type: 'positive' },
  { tag: BEHAVIOR_TAGS.EMOTION_DRIVEN, dimension: 'execution', baseContribution: -5, type: 'negative', note: '情绪打断执行' },
  { tag: BEHAVIOR_TAGS.PERSISTENCE, dimension: 'execution', baseContribution: 7, type: 'positive' },
  { tag: WEALTH_TAGS.DEBT_PRESSURE, dimension: 'execution', baseContribution: -4, type: 'negative', note: '负债压缩执行空间' },
  { tag: PSYCHOLOGY_TAGS.ANXIETY_HIGH, dimension: 'execution', baseContribution: -4, type: 'negative' },

  // --- DISCIPLINE (纪律持续力) ---
  { tag: BEHAVIOR_TAGS.DISCIPLINE, dimension: 'discipline', baseContribution: 10, type: 'positive' },
  { tag: BEHAVIOR_TAGS.INCONSISTENCY, dimension: 'discipline', baseContribution: -8, type: 'negative' },
  { tag: BEHAVIOR_TAGS.PERSISTENCE, dimension: 'discipline', baseContribution: 8, type: 'positive' },
  { tag: BEHAVIOR_TAGS.ACTION_DELAY, dimension: 'discipline', baseContribution: -6, type: 'negative' },
  { tag: BEHAVIOR_TAGS.LONG_TERM_ORIENTED, dimension: 'discipline', baseContribution: 5, type: 'positive' },
  { tag: BEHAVIOR_TAGS.SHORT_TERM_ORIENTED, dimension: 'discipline', baseContribution: -5, type: 'negative' },
  { tag: PSYCHOLOGY_TAGS.STABILITY_SEEKING, dimension: 'discipline', baseContribution: 4, type: 'positive', note: '追求稳定增强纪律' },
  { tag: BEHAVIOR_TAGS.EMOTION_DRIVEN, dimension: 'discipline', baseContribution: -5, type: 'negative', note: '情绪驱动侵蚀纪律' },

  // --- ADAPTABILITY (学习适应力) ---
  { tag: BEHAVIOR_TAGS.LEARNING, dimension: 'adaptability', baseContribution: 9, type: 'positive' },
  { tag: PSYCHOLOGY_TAGS.GROWTH_MINDSET, dimension: 'adaptability', baseContribution: 8, type: 'positive' },
  { tag: PSYCHOLOGY_TAGS.RESILIENCE_HIGH, dimension: 'adaptability', baseContribution: 9, type: 'positive' },
  { tag: PSYCHOLOGY_TAGS.FIXED_MINDSET, dimension: 'adaptability', baseContribution: -8, type: 'negative' },
  { tag: PSYCHOLOGY_TAGS.SELF_DOUBT, dimension: 'adaptability', baseContribution: -4, type: 'negative' },
  { tag: PSYCHOLOGY_TAGS.EXTERNAL_LOCUS, dimension: 'adaptability', baseContribution: -5, type: 'negative', note: '外部归因降低适应主动性' },
  { tag: BEHAVIOR_TAGS.ACTION_FAST, dimension: 'adaptability', baseContribution: 5, type: 'positive' },
  { tag: PSYCHOLOGY_TAGS.STABILITY_SEEKING, dimension: 'adaptability', baseContribution: -3, type: 'negative', note: '过度稳定抑制适应性' },

  // --- RISK_CONTROL (风险控制力) ---
  { tag: PSYCHOLOGY_TAGS.RISK_AVOID, dimension: 'riskControl', baseContribution: 6, type: 'positive', note: '风险意识是正面信号' },
  { tag: PSYCHOLOGY_TAGS.RISK_SEEK, dimension: 'riskControl', baseContribution: -5, type: 'negative', note: '高风险倾向需要框架' },
  { tag: WEALTH_TAGS.FINANCIAL_BUFFER, dimension: 'riskControl', baseContribution: 9, type: 'positive' },
  { tag: WEALTH_TAGS.DEBT_PRESSURE, dimension: 'riskControl', baseContribution: -7, type: 'negative' },
  { tag: WEALTH_TAGS.SINGLE_INCOME, dimension: 'riskControl', baseContribution: -5, type: 'negative' },
  { tag: WEALTH_TAGS.MULTI_INCOME, dimension: 'riskControl', baseContribution: 7, type: 'positive' },
  { tag: BEHAVIOR_TAGS.DISCIPLINE, dimension: 'riskControl', baseContribution: 5, type: 'positive', note: '自律降低风险' },
  { tag: BEHAVIOR_TAGS.EMOTION_DRIVEN, dimension: 'riskControl', baseContribution: -6, type: 'negative' },
  { tag: BEHAVIOR_TAGS.OVERTHINKING, dimension: 'riskControl', baseContribution: 3, type: 'positive', note: '分析有助风险评估' },
]

// ═══════════════════════════════════════
// run — Cognitive Engine 主入口
// ═══════════════════════════════════════

/**
 * run — 从 CognitiveInput 生成 CognitiveOutput
 *
 * @param {Object} input — createCognitiveInput(ctx) 的输出
 * @returns {Object} CognitiveOutput
 */
function run(input) {
  const evidences = input.evidence.evidences
  const tagAgg = aggregateTagsFromEvidence(evidences)

  // 为每个维度计算评分
  const dimensionResults = {}
  for (const dim of DIMENSION_ORDER) {
    dimensionResults[dim] = scoreDimension(dim, evidences, tagAgg)
  }

  // 计算 Overall
  const overall = calculateOverall(dimensionResults, evidences, tagAgg)

  // 找最强和最弱维度
  const sorted = DIMENSION_ORDER
    .map(d => ({ dim: d, score: dimensionResults[d].score }))
    .sort((a, b) => b.score - a.score)

  const strongestDimension = sorted[0].dim
  const weakestDimension = sorted[sorted.length - 1].dim

  // 差距检测
  const keyGap = detectKeyGap(dimensionResults, evidences)

  // 收集证据引用
  const evidenceRefs = collectAllEvidenceRefs(dimensionResults)

  return createCognitiveOutput({
    version: '6.0.0',
    scoringVersion: 'cp6-b-v1',
    dimensions: dimensionResults,
    overall,
    strongestDimension,
    weakestDimension,
    keyGap,
    evidenceRefs,
  })
}

// ═══════════════════════════════════════
// scoreDimension — 单维度评分
// ═══════════════════════════════════════

function scoreDimension(dim, evidences, tagAgg) {
  let score = BASE_SCORE
  const factors = []
  const usedEvidenceIds = new Set()
  const positiveEvidenceRefs = []
  const negativeEvidenceRefs = []

  // 筛选该维度的评分规则
  const rules = SCORING_RULES.filter(r => r.dimension === dim)

  for (const evidence of evidences) {
    for (const rule of rules) {
      if (!evidence.tags.includes(rule.tag)) continue
      if (usedEvidenceIds.has(evidence.id)) continue

      // 计算贡献
      const contribution = clamp(
        rule.baseContribution * evidence.weight,
        -MAX_SINGLE_CONTRIBUTION,
        MAX_SINGLE_CONTRIBUTION
      )

      if (contribution === 0) continue

      score += contribution
      usedEvidenceIds.add(evidence.id)

      factors.push({
        tag: rule.tag,
        contribution: Math.round(contribution),
      })

      if (rule.type === 'positive') {
        positiveEvidenceRefs.push(evidence.id)
      } else {
        negativeEvidenceRefs.push(evidence.id)
      }
    }
  }

  // 跨题一致性修正
  const consistencyBonus = calculateConsistencyBonus(dim, evidences, tagAgg, usedEvidenceIds)
  score += consistencyBonus

  // 冲突检测
  const confusion = detectContradiction(dim, evidences, tagAgg)
  if (confusion.conflict) {
    score -= confusion.penalty
  }

  // Clamp 到 [0, 100]
  score = clamp(Math.round(score), 0, 100)

  // 计算该维度的置信度
  const confidence = calculateDimensionConfidence(
    evidences, tagAgg, usedEvidenceIds, confusion.conflict
  )

  return {
    score,
    level: getScoreLevel(score),
    confidence: clamp(confidence, 0.25, 0.95),
    positiveEvidenceRefs: [...new Set(positiveEvidenceRefs)].slice(0, 5),
    negativeEvidenceRefs: [...new Set(negativeEvidenceRefs)].slice(0, 5),
    factors,
  }
}

// ═══════════════════════════════════════
// calculateConsistencyBonus — 跨题一致性修正
// ═══════════════════════════════════════

function calculateConsistencyBonus(dim, evidences, tagAgg, usedEvidenceIds) {
  const dimRules = SCORING_RULES.filter(r => r.dimension === dim)
  let bonus = 0

  // 如果同方向标签在多道题中出现 → 加分
  for (const rule of dimRules) {
    const tagInfo = tagAgg[rule.tag]
    if (!tagInfo || tagInfo.count < 2) continue

    // 获取该标签的证据
    const tagEvidences = evidences.filter(e => e.tags.includes(rule.tag))

    // 如果分布在 ≥ 2 道不同题目中 → 一致性加分
    const questionSet = new Set(tagEvidences.map(e => e.questionId))
    if (questionSet.size >= 2) {
      bonus += rule.type === 'positive' ? 3 : 0 // 正向一致性加分，负向不加额外惩罚
      break // 只加一次
    }
  }

  return bonus
}

// ═══════════════════════════════════════
// detectContradiction — 冲突检测
// ═══════════════════════════════════════

function detectContradiction(dim, evidences, tagAgg) {
  // 冲突对: 同时存在正面标签和负面标签
  const contradictionPairs = [
    [BEHAVIOR_TAGS.EXECUTION_STRONG, BEHAVIOR_TAGS.EXECUTION_WEAK],
    [BEHAVIOR_TAGS.DISCIPLINE, BEHAVIOR_TAGS.INCONSISTENCY],
    [PSYCHOLOGY_TAGS.CONFIDENCE, PSYCHOLOGY_TAGS.SELF_DOUBT],
    [BEHAVIOR_TAGS.LONG_TERM_ORIENTED, BEHAVIOR_TAGS.SHORT_TERM_ORIENTED],
    [PSYCHOLOGY_TAGS.GROWTH_MINDSET, PSYCHOLOGY_TAGS.FIXED_MINDSET],
    [WEALTH_TAGS.INCOME_STABLE, WEALTH_TAGS.INCOME_UNSTABLE],
  ]

  for (const [posTag, negTag] of contradictionPairs) {
    if (hasTag(tagAgg, posTag) && hasTag(tagAgg, negTag)) {
      return {
        conflict: true,
        penalty: 5,
        confidencePenalty: 0.12,
      }
    }
  }

  return { conflict: false, penalty: 0, confidencePenalty: 0 }
}

// ═══════════════════════════════════════
// calculateDimensionConfidence — 维度置信度
// ═══════════════════════════════════════

function calculateDimensionConfidence(evidences, tagAgg, usedEvidenceIds, hasConflict) {
  const relevantEvidences = evidences.filter(e => e.tags.some(t => t))
  const evidenceCount = usedEvidenceIds.size

  // 证据数量因子
  const countFactor = clamp(evidenceCount / MIN_EVIDENCE_FOR_DIMENSION, 0.3, 1.0)

  // 加权平均权重
  const usedEvidences = evidences.filter(e => usedEvidenceIds.has(e.id))
  const avgWeight = usedEvidences.length > 0
    ? usedEvidences.reduce((s, e) => s + e.weight, 0) / usedEvidences.length
    : 0.5

  // 跨题覆盖度
  const questionSet = new Set(relevantEvidences.map(e => e.questionId))
  const questionDiversity = clamp(questionSet.size / 3, 0, 1)

  let confidence =
    countFactor * 0.35 +
    avgWeight * 0.30 +
    questionDiversity * 0.20 +
    0.15 // 基础分

  if (hasConflict) {
    confidence -= 0.12
  }

  return clamp(confidence, 0.25, 0.95)
}

// ═══════════════════════════════════════
// calculateOverall — 综合评分
// ═══════════════════════════════════════

function calculateOverall(dimensionResults, evidences, tagAgg) {
  let score = 0
  for (const dim of DIMENSION_ORDER) {
    score += dimensionResults[dim].score * OVERALL_WEIGHTS[dim]
  }
  score = Math.round(score)

  const level = getScoreLevel(score)
  const avgConfidence = DIMENSION_ORDER.reduce(
    (sum, d) => sum + dimensionResults[d].confidence, 0
  ) / 5

  return {
    score,
    level,
    confidence: clamp(avgConfidence, 0.25, 0.95),
  }
}

// ═══════════════════════════════════════
// detectKeyGap — 关键差距检测
// ═══════════════════════════════════════

function detectKeyGap(dimensionResults, evidences) {
  const gaps = []

  // COGNITION_EXECUTION_GAP
  const cogExecGap = dimensionResults.cognition.score - dimensionResults.execution.score
  if (cogExecGap >= 15) {
    gaps.push({
      code: GAP_TYPES.COGNITION_EXECUTION_GAP,
      gap: cogExecGap,
      severity: getGapSeverity(cogExecGap),
      evidenceRefs: [
        ...(dimensionResults.cognition.positiveEvidenceRefs || []).slice(0, 2),
        ...(dimensionResults.execution.negativeEvidenceRefs || []).slice(0, 2),
      ],
    })
  }

  // AMBITION_DISCIPLINE_GAP (适应力 vs 纪律)
  const ambDiscGap = dimensionResults.adaptability.score - dimensionResults.discipline.score
  if (ambDiscGap >= 15) {
    gaps.push({
      code: GAP_TYPES.AMBITION_DISCIPLINE_GAP,
      gap: ambDiscGap,
      severity: getGapSeverity(ambDiscGap),
      evidenceRefs: [
        ...(dimensionResults.adaptability.positiveEvidenceRefs || []).slice(0, 2),
        ...(dimensionResults.discipline.negativeEvidenceRefs || []).slice(0, 2),
      ],
    })
  }

  // LEARNING_MONETIZATION_GAP (认知+适应 vs 执行)
  const learnMonetGap = Math.round(
    (dimensionResults.cognition.score + dimensionResults.adaptability.score) / 2 -
    dimensionResults.execution.score
  )
  if (learnMonetGap >= 15) {
    gaps.push({
      code: GAP_TYPES.LEARNING_MONETIZATION_GAP,
      gap: learnMonetGap,
      severity: getGapSeverity(learnMonetGap),
      evidenceRefs: [
        ...(dimensionResults.cognition.positiveEvidenceRefs || []).slice(0, 2),
        ...(dimensionResults.execution.negativeEvidenceRefs || []).slice(0, 2),
      ],
    })
  }

  // RISK_REWARD_MISMATCH (风险控制低 + 执行高 = 高风险行为)
  if (dimensionResults.riskControl.score < 45 && dimensionResults.execution.score > 60) {
    gaps.push({
      code: GAP_TYPES.RISK_REWARD_MISMATCH,
      gap: dimensionResults.execution.score - dimensionResults.riskControl.score,
      severity: getGapSeverity(dimensionResults.execution.score - dimensionResults.riskControl.score),
      evidenceRefs: [
        ...(dimensionResults.riskControl.negativeEvidenceRefs || []).slice(0, 3),
      ],
    })
  }

  // STABILITY_GROWTH_CONFLICT
  const stabGrowGap = dimensionResults.discipline.score - dimensionResults.adaptability.score
  if (stabGrowGap >= 15 && dimensionResults.discipline.score > 60) {
    gaps.push({
      code: GAP_TYPES.STABILITY_GROWTH_CONFLICT,
      gap: stabGrowGap,
      severity: getGapSeverity(stabGrowGap),
      evidenceRefs: [
        ...(dimensionResults.discipline.positiveEvidenceRefs || []).slice(0, 2),
        ...(dimensionResults.adaptability.negativeEvidenceRefs || []).slice(0, 2),
      ],
    })
  }

  // 找最大的 gap
  if (gaps.length === 0) return null
  gaps.sort((a, b) => b.gap - a.gap)
  return gaps[0]
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function hasTag(tagAgg, tag) {
  return !!(tagAgg[tag] && tagAgg[tag].count > 0)
}

function collectAllEvidenceRefs(dimensionResults) {
  const ids = new Set()
  for (const dim of DIMENSION_ORDER) {
    for (const id of (dimensionResults[dim].positiveEvidenceRefs || [])) ids.add(id)
    for (const id of (dimensionResults[dim].negativeEvidenceRefs || [])) ids.add(id)
  }
  return [...ids].slice(0, 15)
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

module.exports = { run }
