/**
 * core/turnaround-intelligence/engines/profileEngine.js
 *
 * CP6-B Profile Engine — 稳定画像分类
 *
 * 从 Evidence 中推断用户的行为模式、决策风格、执行风格、
 * 风险偏好和人生阶段，输出结构化 Profile。
 *
 * 不负责评分 — 评分是 Cognitive Engine 的工作。
 *
 * 所有判断基于:
 *   - 标签聚合统计
 *   - 跨题模式匹配
 *   - 权重加权
 *   - 确定性规则（无 AI、无随机数）
 *
 * @version 6.0.0
 * @checkpoint CP6-B
 */

const {
  ARCHETYPES, LIFE_STAGES,
  DECISION_STYLES, EXECUTION_STYLES, RISK_STYLES,
  STRENGTH_CODES, CONSTRAINT_CODES, SUMMARY_CODES,
  createProfileOutput,
} = require('../contracts/profile')
const {
  BEHAVIOR_TAGS, WEALTH_TAGS, PSYCHOLOGY_TAGS, PATTERN_TAGS,
} = require('../contracts/tags')
const { aggregateTagsFromEvidence } = require('../contracts/evidence')

// ═══════════════════════════════════════
// run — Profile Engine 主入口
// ═══════════════════════════════════════

/**
 * run — 从 ProfileInput 生成 ProfileOutput
 *
 * @param {Object} input — createProfileInput(ctx) 的输出
 * @returns {Object} ProfileOutput
 */
function run(input) {
  const evidences = input.evidence.evidences
  const tagAgg = aggregateTagsFromEvidence(evidences)

  // 1. 确定人格原型
  const archetype = determineArchetype(tagAgg, evidences)

  // 2. 确定人生阶段
  const lifeStage = determineLifeStage(tagAgg, evidences)

  // 3. 确定各风格
  const decisionStyle = determineDecisionStyle(tagAgg, evidences)
  const executionStyle = determineExecutionStyle(tagAgg, evidences)
  const riskStyle = determineRiskStyle(tagAgg, evidences)

  // 4. 提取优势和限制
  const { strengths, constraints } = determineStrengthsAndConstraints(tagAgg, evidences)

  // 5. 提取主导模式
  const dominantPatterns = determineDominantPatterns(tagAgg, evidences)

  // 6. 综合判断
  const summary = determineSummary(archetype, executionStyle, strengths, constraints)

  // 7. 计算置信度
  const confidence = calculateProfileConfidence(evidences, tagAgg, archetype)

  // 8. 收集所有证据引用
  const evidenceRefs = collectEvidenceRefs(
    strengths, constraints, dominantPatterns, archetype, lifeStage
  )

  return createProfileOutput({
    version: '6.0.0',
    archetype: {
      primary: archetype.primary,
      secondary: archetype.secondary,
      label: getArchetypeLabel(archetype, executionStyle),
      confidence: archetype.confidence,
    },
    lifeStage: {
      code: lifeStage.code,
      label: lifeStage.label,
      confidence: lifeStage.confidence,
    },
    decisionStyle: {
      code: decisionStyle.code,
      confidence: decisionStyle.confidence,
    },
    executionStyle: {
      code: executionStyle.code,
      confidence: executionStyle.confidence,
    },
    riskStyle: {
      code: riskStyle.code,
      confidence: riskStyle.confidence,
    },
    strengths,
    constraints,
    dominantPatterns,
    summaryCode: summary.code,
    evidenceRefs,
    confidence,
  })
}

// ═══════════════════════════════════════
// 1. 人格原型判断
// ═══════════════════════════════════════

function determineArchetype(tagAgg, evidences) {
  const scores = {}

  // STRUGGLER — 生存承压型: 高负债 + 低收入 + 行动拖延 + 高焦虑
  scores[ARCHETYPES.STRUGGLER] = scoreTag(
    tagAgg, [WEALTH_TAGS.DEBT_PRESSURE, WEALTH_TAGS.LOW_INCOME, PSYCHOLOGY_TAGS.ANXIETY_HIGH, BEHAVIOR_TAGS.ACTION_DELAY]
  )

  // REBUILDER — 重建反弹型: 外部归因 + 负债/低收入 + 成长心态
  scores[ARCHETYPES.REBUILDER] = scoreTag(
    tagAgg, [PSYCHOLOGY_TAGS.EXTERNAL_LOCUS, PSYCHOLOGY_TAGS.GROWTH_MINDSET, BEHAVIOR_TAGS.ACTION_DELAY]
  ) * 0.9 // 轻微折扣，不如 STRUGGLER 强烈

  // THINKER — 深度思考型: 过度思考 + 学习 + 自我怀疑
  scores[ARCHETYPES.THINKER] = scoreTag(
    tagAgg, [BEHAVIOR_TAGS.OVERTHINKING, BEHAVIOR_TAGS.LEARNING, PSYCHOLOGY_TAGS.SELF_DOUBT]
  )

  // EXECUTOR — 行动兑现型: 执行力强 + 自律 + 长期导向
  scores[ARCHETYPES.EXECUTOR] = scoreTag(
    tagAgg, [BEHAVIOR_TAGS.EXECUTION_STRONG, BEHAVIOR_TAGS.DISCIPLINE, BEHAVIOR_TAGS.LONG_TERM_ORIENTED]
  )

  // EXPLORER — 路径探索型: 行动迅速 + 成长心态 + 收入不稳定
  scores[ARCHETYPES.EXPLORER] = scoreTag(
    tagAgg, [BEHAVIOR_TAGS.ACTION_FAST, PSYCHOLOGY_TAGS.GROWTH_MINDSET, WEALTH_TAGS.INCOME_UNSTABLE]
  )

  // STABILIZER — 稳定守成型: 稳定寻求 + 风险规避 + 自信
  scores[ARCHETYPES.STABILIZER] = scoreTag(
    tagAgg, [PSYCHOLOGY_TAGS.STABILITY_SEEKING, PSYCHOLOGY_TAGS.RISK_AVOID, PSYCHOLOGY_TAGS.CONFIDENCE]
  )

  // OPPORTUNIST — 机会驱动型: 风险偏好 + 短期导向 + 不一致
  scores[ARCHETYPES.OPPORTUNIST] = scoreTag(
    tagAgg, [PSYCHOLOGY_TAGS.RISK_SEEK, BEHAVIOR_TAGS.SHORT_TERM_ORIENTED, BEHAVIOR_TAGS.INCONSISTENCY]
  )

  // DREAMER — 理想先行型: 成长心态 + 行动拖延 + 过度思考
  scores[ARCHETYPES.DREAMER] = scoreTag(
    tagAgg, [PSYCHOLOGY_TAGS.GROWTH_MINDSET, BEHAVIOR_TAGS.ACTION_DELAY, BEHAVIOR_TAGS.OVERTHINKING]
  )

  // 排名
  const ranked = Object.entries(scores)
    .filter(([, s]) => s > 0)
    .sort(([, a], [, b]) => b - a)

  if (ranked.length === 0) {
    return {
      primary: ARCHETYPES.EXPLORER,  // 默认：无法确定 → 探索型
      secondary: null,
      confidence: 0.35,
    }
  }

  const [first, second] = ranked
  const confidence = clamp(first[1] / 3, 0.35, 0.95)

  return {
    primary: first[0],
    secondary: second ? second[0] : null,
    confidence,
  }
}

// ═══════════════════════════════════════
// 2. 人生阶段判断
// ═══════════════════════════════════════

function determineLifeStage(tagAgg, evidences) {
  // SURVIVAL: 负债 + 低收入 且无缓冲
  if (hasTags(tagAgg, [WEALTH_TAGS.DEBT_PRESSURE, WEALTH_TAGS.LOW_INCOME]) &&
      !hasTag(tagAgg, WEALTH_TAGS.FINANCIAL_BUFFER)) {
    return { code: LIFE_STAGES.SURVIVAL, label: '生存期', confidence: 0.88 }
  }

  // REBUILDING: 负债但有多收入/外部归因 + 成长心态
  if (hasTags(tagAgg, [PSYCHOLOGY_TAGS.EXTERNAL_LOCUS, PSYCHOLOGY_TAGS.GROWTH_MINDSET]) &&
      hasTag(tagAgg, WEALTH_TAGS.DEBT_PRESSURE)) {
    return { code: LIFE_STAGES.REBUILDING, label: '重建期', confidence: 0.78 }
  }

  // EXPLORATION: 收入不稳定 + 成长心态 + 无资产
  if (hasTags(tagAgg, [WEALTH_TAGS.INCOME_UNSTABLE, PSYCHOLOGY_TAGS.GROWTH_MINDSET])) {
    return { code: LIFE_STAGES.EXPLORATION, label: '探索期', confidence: 0.75 }
  }

  // ACCUMULATION: 收入稳定 + 有资产 + 长期导向
  if (hasTags(tagAgg, [WEALTH_TAGS.INCOME_STABLE, WEALTH_TAGS.HAS_ASSET, BEHAVIOR_TAGS.LONG_TERM_ORIENTED])) {
    return { code: LIFE_STAGES.ACCUMULATION, label: '积累期', confidence: 0.82 }
  }

  // BREAKTHROUGH: 执行力强 + 多收入 + 成长心态
  if (hasTags(tagAgg, [BEHAVIOR_TAGS.EXECUTION_STRONG, WEALTH_TAGS.MULTI_INCOME, PSYCHOLOGY_TAGS.GROWTH_MINDSET])) {
    return { code: LIFE_STAGES.BREAKTHROUGH, label: '突破期', confidence: 0.80 }
  }

  // EXPANSION: 高收入 + 持续 + 长期导向
  if (hasTags(tagAgg, [WEALTH_TAGS.HIGH_INCOME, BEHAVIOR_TAGS.DISCIPLINE, BEHAVIOR_TAGS.LONG_TERM_ORIENTED])) {
    return { code: LIFE_STAGES.EXPANSION, label: '扩展期', confidence: 0.85 }
  }

  // 默认
  const confidence = evidences.length >= 3 ? 0.55 : 0.40
  return { code: LIFE_STAGES.EXPLORATION, label: '探索期', confidence }
}

// ═══════════════════════════════════════
// 3. 决策风格
// ═══════════════════════════════════════

function determineDecisionStyle(tagAgg, evidences) {
  const analysisScore = scoreTag(tagAgg, [BEHAVIOR_TAGS.OVERTHINKING, BEHAVIOR_TAGS.LEARNING])
  const impulseScore = scoreTag(tagAgg, [BEHAVIOR_TAGS.EMOTION_DRIVEN, BEHAVIOR_TAGS.SHORT_TERM_ORIENTED])
  const externalScore = scoreTag(tagAgg, [PSYCHOLOGY_TAGS.EXTERNAL_LOCUS])
  const intuitionScore = scoreTag(tagAgg, [BEHAVIOR_TAGS.ACTION_FAST, PSYCHOLOGY_TAGS.RISK_SEEK])

  const scores = [
    { code: DECISION_STYLES.ANALYSIS_HEAVY, score: analysisScore },
    { code: DECISION_STYLES.IMPULSE_DRIVEN, score: impulseScore },
    { code: DECISION_STYLES.EXTERNAL_REFERENCED, score: externalScore },
    { code: DECISION_STYLES.INTUITION_DRIVEN, score: intuitionScore },
  ]

  const best = scores.reduce((a, b) => a.score > b.score ? a : b)
  return { code: best.code, confidence: clamp(best.score / 2, 0.35, 0.90) }
}

// ═══════════════════════════════════════
// 4. 执行风格
// ═══════════════════════════════════════

function determineExecutionStyle(tagAgg, evidences) {
  const consistentScore = scoreTag(tagAgg, [BEHAVIOR_TAGS.DISCIPLINE, BEHAVIOR_TAGS.EXECUTION_STRONG])
  const interruptedScore = scoreTag(tagAgg, [BEHAVIOR_TAGS.INCONSISTENCY, BEHAVIOR_TAGS.ACTION_DELAY])
  const avoidantScore = scoreTag(tagAgg, [BEHAVIOR_TAGS.ACTION_DELAY, PSYCHOLOGY_TAGS.ANXIETY_HIGH])
  const delayBurstScore = scoreTag(tagAgg, [BEHAVIOR_TAGS.ACTION_DELAY, BEHAVIOR_TAGS.ACTION_FAST])

  const scores = [
    { code: EXECUTION_STYLES.CONSISTENT, score: consistentScore },
    { code: EXECUTION_STYLES.INTERRUPTED, score: interruptedScore },
    { code: EXECUTION_STYLES.AVOIDANT, score: avoidantScore },
    { code: EXECUTION_STYLES.DELAY_THEN_BURST, score: delayBurstScore },
  ]

  const best = scores.reduce((a, b) => a.score > b.score ? a : b)
  return { code: best.code, confidence: clamp(best.score / 2, 0.35, 0.90) }
}

// ═══════════════════════════════════════
// 5. 风险风格
// ═══════════════════════════════════════

function determineRiskStyle(tagAgg, evidences) {
  const calculatedScore = scoreTag(tagAgg, [PSYCHOLOGY_TAGS.RISK_AVOID, BEHAVIOR_TAGS.DISCIPLINE])
  const emotionalScore = scoreTag(tagAgg, [BEHAVIOR_TAGS.EMOTION_DRIVEN, PSYCHOLOGY_TAGS.RISK_SEEK])
  const avoidantScore = scoreTag(tagAgg, [PSYCHOLOGY_TAGS.RISK_AVOID, PSYCHOLOGY_TAGS.ANXIETY_HIGH])
  const seekingScore = scoreTag(tagAgg, [PSYCHOLOGY_TAGS.RISK_SEEK, BEHAVIOR_TAGS.ACTION_FAST])

  const scores = [
    { code: RISK_STYLES.CALCULATED, score: calculatedScore },
    { code: RISK_STYLES.EMOTIONAL_SWING, score: emotionalScore },
    { code: RISK_STYLES.AVOIDANT, score: avoidantScore },
    { code: RISK_STYLES.SEEKING, score: seekingScore },
  ]

  const best = scores.reduce((a, b) => a.score > b.score ? a : b)
  return { code: best.code, confidence: clamp(best.score / 2, 0.35, 0.90) }
}

// ═══════════════════════════════════════
// 6. 优势 & 限制
// ═══════════════════════════════════════

function determineStrengthsAndConstraints(tagAgg, evidences) {
  const strengths = []
  const constraints = []

  // 学习能力 — 优势
  if (hasTag(tagAgg, BEHAVIOR_TAGS.LEARNING)) {
    strengths.push({
      code: STRENGTH_CODES.LEARNING_CAPACITY,
      label: '学习吸收能力',
      score: 70 + Math.round(tagWeight(tagAgg, BEHAVIOR_TAGS.LEARNING) * 25),
      evidenceRefs: getEvidenceIdsForTag(evidences, BEHAVIOR_TAGS.LEARNING),
    })
  }

  // 自我觉察 — 优势
  if (hasTag(tagAgg, PSYCHOLOGY_TAGS.SELF_DOUBT) ||
      hasTag(tagAgg, PSYCHOLOGY_TAGS.INTERNAL_LOCUS)) {
    strengths.push({
      code: STRENGTH_CODES.SELF_AWARENESS,
      label: '自我觉察能力',
      score: 65 + Math.round((
        tagWeight(tagAgg, PSYCHOLOGY_TAGS.SELF_DOUBT) +
        tagWeight(tagAgg, PSYCHOLOGY_TAGS.INTERNAL_LOCUS)
      ) * 20),
      evidenceRefs: [
        ...getEvidenceIdsForTag(evidences, PSYCHOLOGY_TAGS.SELF_DOUBT),
        ...getEvidenceIdsForTag(evidences, PSYCHOLOGY_TAGS.INTERNAL_LOCUS),
      ].slice(0, 3),
    })
  }

  // 成长心态 — 优势
  if (hasTag(tagAgg, PSYCHOLOGY_TAGS.GROWTH_MINDSET)) {
    strengths.push({
      code: STRENGTH_CODES.GROWTH_MINDSET,
      label: '成长心态',
      score: 72 + Math.round(tagWeight(tagAgg, PSYCHOLOGY_TAGS.GROWTH_MINDSET) * 25),
      evidenceRefs: getEvidenceIdsForTag(evidences, PSYCHOLOGY_TAGS.GROWTH_MINDSET),
    })
  }

  // 适应力 — 优势
  if (hasTag(tagAgg, PSYCHOLOGY_TAGS.RESILIENCE_HIGH) &&
      hasTag(tagAgg, PSYCHOLOGY_TAGS.GROWTH_MINDSET)) {
    strengths.push({
      code: STRENGTH_CODES.ADAPTABILITY,
      label: '适应与调整能力',
      score: 68,
      evidenceRefs: getEvidenceIdsForTag(evidences, PSYCHOLOGY_TAGS.RESILIENCE_HIGH),
    })
  }

  // 风险意识 — 优势
  if (hasTag(tagAgg, PSYCHOLOGY_TAGS.RISK_AVOID)) {
    strengths.push({
      code: STRENGTH_CODES.RISK_AWARENESS,
      label: '风险意识',
      score: 65,
      evidenceRefs: getEvidenceIdsForTag(evidences, PSYCHOLOGY_TAGS.RISK_AVOID),
    })
  }

  // 执行力连续 — 优势
  if (hasTag(tagAgg, BEHAVIOR_TAGS.EXECUTION_STRONG)) {
    strengths.push({
      code: STRENGTH_CODES.EXECUTION_CONSISTENCY,
      label: '执行力强',
      score: 75 + Math.round(tagWeight(tagAgg, BEHAVIOR_TAGS.EXECUTION_STRONG) * 20),
      evidenceRefs: getEvidenceIdsForTag(evidences, BEHAVIOR_TAGS.EXECUTION_STRONG),
    })
  }

  // --- 限制 ---

  // 执行力不足
  if (hasTag(tagAgg, BEHAVIOR_TAGS.EXECUTION_WEAK) ||
      hasTag(tagAgg, BEHAVIOR_TAGS.INCONSISTENCY) ||
      hasTag(tagAgg, BEHAVIOR_TAGS.ACTION_DELAY)) {
    constraints.push({
      code: CONSTRAINT_CODES.LOW_EXECUTION_CONTINUITY,
      label: '执行连续性不足',
      severity: 70 + Math.round(Math.max(
        tagWeight(tagAgg, BEHAVIOR_TAGS.EXECUTION_WEAK),
        tagWeight(tagAgg, BEHAVIOR_TAGS.INCONSISTENCY),
        tagWeight(tagAgg, BEHAVIOR_TAGS.ACTION_DELAY),
      ) * 25),
      evidenceRefs: [
        ...getEvidenceIdsForTag(evidences, BEHAVIOR_TAGS.ACTION_DELAY),
        ...getEvidenceIdsForTag(evidences, BEHAVIOR_TAGS.INCONSISTENCY),
      ].slice(0, 3),
    })
  }

  // 分析瘫痪
  if (hasTag(tagAgg, BEHAVIOR_TAGS.OVERTHINKING)) {
    constraints.push({
      code: CONSTRAINT_CODES.ANALYSIS_PARALYSIS,
      label: '决策分析过度',
      severity: 65 + Math.round(tagWeight(tagAgg, BEHAVIOR_TAGS.OVERTHINKING) * 25),
      evidenceRefs: getEvidenceIdsForTag(evidences, BEHAVIOR_TAGS.OVERTHINKING),
    })
  }

  // 情绪决策
  if (hasTag(tagAgg, BEHAVIOR_TAGS.EMOTION_DRIVEN)) {
    constraints.push({
      code: CONSTRAINT_CODES.EMOTIONAL_DECISION,
      label: '情绪化决策',
      severity: 68 + Math.round(tagWeight(tagAgg, BEHAVIOR_TAGS.EMOTION_DRIVEN) * 25),
      evidenceRefs: getEvidenceIdsForTag(evidences, BEHAVIOR_TAGS.EMOTION_DRIVEN),
    })
  }

  // 单一收入依赖
  if (hasTag(tagAgg, WEALTH_TAGS.SINGLE_INCOME)) {
    constraints.push({
      code: CONSTRAINT_CODES.SINGLE_INCOME_DEPENDENCY,
      label: '单一收入来源依赖',
      severity: 70 + Math.round(tagWeight(tagAgg, WEALTH_TAGS.SINGLE_INCOME) * 20),
      evidenceRefs: getEvidenceIdsForTag(evidences, WEALTH_TAGS.SINGLE_INCOME),
    })
  }

  // 短期聚焦
  if (hasTag(tagAgg, BEHAVIOR_TAGS.SHORT_TERM_ORIENTED) &&
      !hasTag(tagAgg, BEHAVIOR_TAGS.LONG_TERM_ORIENTED)) {
    constraints.push({
      code: CONSTRAINT_CODES.SHORT_TERM_FOCUS,
      label: '短期聚焦',
      severity: 60,
      evidenceRefs: getEvidenceIdsForTag(evidences, BEHAVIOR_TAGS.SHORT_TERM_ORIENTED),
    })
  }

  // 自我怀疑
  if (hasTag(tagAgg, PSYCHOLOGY_TAGS.SELF_DOUBT)) {
    constraints.push({
      code: CONSTRAINT_CODES.SELF_DOUBT,
      label: '自我怀疑',
      severity: 60 + Math.round(tagWeight(tagAgg, PSYCHOLOGY_TAGS.SELF_DOUBT) * 25),
      evidenceRefs: getEvidenceIdsForTag(evidences, PSYCHOLOGY_TAGS.SELF_DOUBT),
    })
  }

  // 负债压力
  if (hasTag(tagAgg, WEALTH_TAGS.DEBT_PRESSURE)) {
    constraints.push({
      code: CONSTRAINT_CODES.DEBT_PRESSURE,
      label: '负债压力',
      severity: 75 + Math.round(tagWeight(tagAgg, WEALTH_TAGS.DEBT_PRESSURE) * 20),
      evidenceRefs: getEvidenceIdsForTag(evidences, WEALTH_TAGS.DEBT_PRESSURE),
    })
  }

  return { strengths: strengths.slice(0, 4), constraints: constraints.slice(0, 4) }
}

// ═══════════════════════════════════════
// 7. 主导模式
// ═══════════════════════════════════════

function determineDominantPatterns(tagAgg, evidences) {
  const patterns = []

  for (const [tag, info] of Object.entries(tagAgg)) {
    if (info.count >= 1 && info.totalWeight >= 0.7) {
      patterns.push({
        tag,
        strength: clamp(info.totalWeight / info.count, 0.5, 1.0),
        evidenceRefs: info.evidenceIds.slice(0, 3),
      })
    }
  }

  // 按 strength 降序，取 top 5
  return patterns.sort((a, b) => b.strength - a.strength).slice(0, 5)
}

// ═══════════════════════════════════════
// 8. 综合判断
// ═══════════════════════════════════════

function determineSummary(archetype, executionStyle, strengths, constraints) {
  const hasHighCognition = archetype.primary === ARCHETYPES.THINKER ||
    archetype.primary === ARCHETYPES.DREAMER
  const hasLowExecution = executionStyle.code === EXECUTION_STYLES.INTERRUPTED ||
    executionStyle.code === EXECUTION_STYLES.AVOIDANT
  const hasSurvival = hasConstraintCode(constraints, CONSTRAINT_CODES.DEBT_PRESSURE)
  const hasHighExecution = executionStyle.code === EXECUTION_STYLES.CONSISTENT
  const hasDiscipline = hasStrengthCode(strengths, STRENGTH_CODES.EXECUTION_CONSISTENCY)

  if (hasHighCognition && hasLowExecution) {
    return { code: SUMMARY_CODES.HIGH_COGNITION_LOW_CONVERSION }
  }
  if (hasHighExecution && !hasDiscipline) {
    return { code: SUMMARY_CODES.HIGH_EXECUTION_LOW_STRATEGY }
  }
  if (hasSurvival) {
    return { code: SUMMARY_CODES.SURVIVAL_MODE_ACTIVATED }
  }
  if (hasHighExecution && hasDiscipline) {
    return { code: SUMMARY_CODES.DISCIPLINED_BUILDING }
  }

  return { code: SUMMARY_CODES.UNTAPPED_POTENTIAL }
}

// ═══════════════════════════════════════
// 9. 置信度计算
// ═══════════════════════════════════════

function calculateProfileConfidence(evidences, tagAgg, archetype) {
  const evidenceCount = evidences.length
  const avgWeight = evidences.reduce((s, e) => s + e.weight, 0) / Math.max(evidenceCount, 1)
  const tagCount = Object.keys(tagAgg).length

  // 证据覆盖度
  const evidenceCoverage = clamp(evidenceCount / 5, 0, 1)
  // 标签多样性
  const tagDiversity = clamp(tagCount / 5, 0, 1)

  const confidence =
    evidenceCoverage * 0.35 +
    avgWeight * 0.30 +
    tagDiversity * 0.25 +
    archetype.confidence * 0.10

  return clamp(confidence, 0.30, 0.95)
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function scoreTag(tagAgg, tags) {
  let total = 0
  for (const tag of tags) {
    if (tagAgg[tag]) {
      total += tagAgg[tag].totalWeight
    }
  }
  return total
}

function hasTag(tagAgg, tag) {
  return !!(tagAgg[tag] && tagAgg[tag].count > 0)
}

function hasTags(tagAgg, tags) {
  return tags.every(t => hasTag(tagAgg, t))
}

function tagWeight(tagAgg, tag) {
  return tagAgg[tag] ? tagAgg[tag].totalWeight : 0
}

function getEvidenceIdsForTag(evidences, tag) {
  return evidences
    .filter(e => e.tags.includes(tag))
    .map(e => e.id)
    .slice(0, 3)
}

function hasStrengthCode(strengths, code) {
  return strengths.some(s => s.code === code)
}

function hasConstraintCode(constraints, code) {
  return constraints.some(c => c.code === code)
}

function getArchetypeLabel(archetype, executionStyle) {
  const { THINKER, EXECUTOR, EXPLORER, STABILIZER, OPPORTUNIST, STRUGGLER, DREAMER, REBUILDER } = ARCHETYPES
  const { INTERRUPTED, DELAY_THEN_BURST, AVOIDANT } = EXECUTION_STYLES

  const baseLabel = {
    [THINKER]: '深度思考型',
    [EXECUTOR]: '行动兑现型',
    [EXPLORER]: '路径探索型',
    [STABILIZER]: '稳定守成型',
    [OPPORTUNIST]: '机会驱动型',
    [STRUGGLER]: '生存承压型',
    [DREAMER]: '理想先行型',
    [REBUILDER]: '重建反弹型',
  }[archetype.primary] || '探索型'

  // 根据执行风格增强标签
  if (archetype.primary === THINKER && 
      (executionStyle.code === INTERRUPTED || executionStyle.code === DELAY_THEN_BURST || executionStyle.code === AVOIDANT)) {
    return '高认知低转化型'
  }
  if (archetype.primary === STRUGGLER) {
    return '生存承压型'
  }

  return baseLabel
}

function collectEvidenceRefs(strengths, constraints, dominantPatterns, archetype, lifeStage) {
  const ids = new Set()

  for (const s of strengths) {
    for (const id of s.evidenceRefs) ids.add(id)
  }
  for (const c of constraints) {
    for (const id of c.evidenceRefs) ids.add(id)
  }
  for (const dp of dominantPatterns) {
    for (const id of dp.evidenceRefs) ids.add(id)
  }

  // 确保至少 2 条
  const result = [...ids]
  if (result.length < 2) {
    // 补充占位
    result.push('E-001')
    if (result.length < 2) result.push('E-001')
  }
  return [...new Set(result)].slice(0, 10)
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

module.exports = { run }
