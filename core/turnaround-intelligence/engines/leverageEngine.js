/**
 * core/turnaround-intelligence/engines/leverageEngine.js
 *
 * CP6-C Leverage Engine — 杠杆检测引擎
 *
 * 回答："翻身靠什么？"
 *
 * 数据流: Evidence(positive direction) + Pattern(正向) + Profile(优势) → Leverage
 *
 * 所有判断基于确定性规则，
 * 不使用 AI、随机数或隐藏常量。
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

const { LEVERAGE_CODES, getImpactLevel, createLeverageOutput } = require('../contracts/leverage')
const { getEvidencesByDirection } = require('../contracts/evidence')
const { BEHAVIOR_TAGS, PSYCHOLOGY_TAGS, WEALTH_TAGS } = require('../contracts/tags')

// ═══════════════════════════════════════
// Evidence Tag → Leverage 映射
// ═══════════════════════════════════════

const TAG_TO_LEVERAGE = [
  // 能力杠杆
  { tag: 'LEARNING', leverageCode: 'LEARNING_CAPACITY_LEVERAGE', baseStrength: 70 },
  { tag: 'DISCIPLINE', leverageCode: 'EXECUTION_CONSISTENCY_LEVERAGE', baseStrength: 75 },
  { tag: 'PERSISTENCE', leverageCode: 'EXECUTION_CONSISTENCY_LEVERAGE', baseStrength: 70 },
  { tag: 'EXECUTION_STRONG', leverageCode: 'EXECUTION_CONSISTENCY_LEVERAGE', baseStrength: 80 },
  { tag: 'OVERTHINKING', leverageCode: 'SELF_AWARENESS_LEVERAGE', baseStrength: 60 },

  // 资源杠杆
  { tag: 'MULTI_INCOME', leverageCode: 'MULTI_INCOME_LEVERAGE', baseStrength: 85 },
  { tag: 'INCOME_STABLE', leverageCode: 'STABLE_INCOME_LEVERAGE', baseStrength: 70 },
  { tag: 'FINANCIAL_BUFFER', leverageCode: 'FINANCIAL_BUFFER_LEVERAGE', baseStrength: 80 },
  { tag: 'HAS_ASSET', leverageCode: 'FINANCIAL_BUFFER_LEVERAGE', baseStrength: 75 },

  // 心态杠杆
  { tag: 'GROWTH_MINDSET', leverageCode: 'GROWTH_MINDSET_LEVERAGE', baseStrength: 80 },
  { tag: 'RESILIENCE_HIGH', leverageCode: 'RESILIENCE_LEVERAGE', baseStrength: 75 },
  { tag: 'CONFIDENCE', leverageCode: 'CONFIDENCE_LEVERAGE', baseStrength: 70 },
]

// ═══════════════════════════════════════
// Pattern → Leverage 映射
// ═══════════════════════════════════════

const PATTERN_TO_LEVERAGE = [
  { patternConclusion: 'CONSISTENT_EXECUTION', leverageCode: 'EXECUTION_CONSISTENCY_LEVERAGE', baseStrength: 85 },
  { patternConclusion: 'ADAPTIVE_LEARNING', leverageCode: 'LEARNING_CAPACITY_LEVERAGE', baseStrength: 80 },
  { patternConclusion: 'STRATEGIC_EXECUTION', leverageCode: 'COGNITION_LEVERAGE', baseStrength: 82 },
  { patternConclusion: 'FINANCIAL_INDEPENDENCE', leverageCode: 'FINANCIAL_BUFFER_LEVERAGE', baseStrength: 85 },
  { patternConclusion: 'GROWTH_POTENTIAL', leverageCode: 'GROWTH_MINDSET_LEVERAGE', baseStrength: 88 },
  { patternConclusion: 'INCOME_TRANSITION_READY', leverageCode: 'LEARNING_CAPACITY_LEVERAGE', baseStrength: 65 },
]

// ═══════════════════════════════════════
// Profile → Leverage 映射
// ═══════════════════════════════════════

const STRENGTH_TO_LEVERAGE = [
  { strengthCode: 'LEARNING_CAPACITY', leverageCode: 'LEARNING_CAPACITY_LEVERAGE', baseStrength: 75 },
  { strengthCode: 'SELF_AWARENESS', leverageCode: 'SELF_AWARENESS_LEVERAGE', baseStrength: 70 },
  { strengthCode: 'ACCEPTING_REALITY', leverageCode: 'SELF_AWARENESS_LEVERAGE', baseStrength: 60 },
]

// ═══════════════════════════════════════
// run — Leverage Engine 主入口
// ═══════════════════════════════════════

/**
 * run — 从 LeverageInput 生成 LeverageOutput
 *
 * @param {Object} input — createLeverageInput(ctx) 的输出
 * @returns {Object} LeverageOutput
 */
function run(input) {
  const { evidence, patterns, profile } = input
  const evidences = evidence.evidences
  const allEvidenceRefs = new Set()

  // 正方向证据
  const positiveEvidences = getEvidencesByDirection(evidences, 'positive')

  // 所有正向 Pattern
  const allPositivePatterns = [
    ...(patterns.action || []).filter(p => p.severity === 0),
    ...(patterns.wealth || []).filter(p => p.severity === 0),
    ...(patterns.psychology || []).filter(p => p.severity === 0),
  ]

  const leverageMap = new Map()

  // ========== 来源 1: 正向 Evidence 标签 ==========
  for (const ev of positiveEvidences) {
    for (const mapping of TAG_TO_LEVERAGE) {
      if (!ev.tags.includes(mapping.tag)) continue

      const existing = leverageMap.get(mapping.leverageCode)
      const strength = Math.round(mapping.baseStrength * (0.7 + 0.3 * ev.importance))

      if (!existing || strength > existing.strength) {
        leverageMap.set(mapping.leverageCode, {
          code: mapping.leverageCode,
          strength,
          source: 'evidence',
          sourceDetail: ev.id,
          evidenceRefs: [ev.id],
        })
      }
      allEvidenceRefs.add(ev.id)
    }
  }

  // ========== 来源 2: 正向 Pattern ==========
  for (const pattern of allPositivePatterns) {
    for (const mapping of PATTERN_TO_LEVERAGE) {
      if (pattern.conclusion !== mapping.patternConclusion) continue

      const existing = leverageMap.get(mapping.leverageCode)
      const strength = Math.round(mapping.baseStrength * (0.7 + 0.3 * 0.5))

      if (!existing || strength > existing.strength) {
        leverageMap.set(mapping.leverageCode, {
          code: mapping.leverageCode,
          strength,
          source: 'pattern',
          sourceDetail: pattern.id,
          evidenceRefs: pattern.evidenceRefs || [],
        })
      }
      for (const ref of (pattern.evidenceRefs || [])) allEvidenceRefs.add(ref)
    }
  }

  // ========== 来源 3: Profile 优势 ==========
  for (const strength of (profile.strengths || [])) {
    for (const mapping of STRENGTH_TO_LEVERAGE) {
      if (strength.code !== mapping.strengthCode) continue

      const existing = leverageMap.get(mapping.leverageCode)
      const s = Math.round(mapping.baseStrength * (0.7 + 0.3 * 0.6))

      if (!existing || s > existing.strength) {
        leverageMap.set(mapping.leverageCode, {
          code: mapping.leverageCode,
          strength: s,
          source: 'profile',
          sourceDetail: strength.code,
          evidenceRefs: strength.evidenceRefs || [],
        })
      }
      for (const ref of (strength.evidenceRefs || [])) allEvidenceRefs.add(ref)
    }
  }

  // ========== 构建输出 ==========
  const leverages = []
  for (const [, lev] of leverageMap) {
    const codeDef = LEVERAGE_CODES[lev.code]
    if (!codeDef) continue

    leverages.push({
      code: lev.code,
      label: codeDef.label,
      category: codeDef.category,
      strength: Math.round(clamp(lev.strength, 0, 100)),
      impact: getImpactLevel(lev.strength),
      estimatedTimeToImpact: codeDef.estimatedTimeToImpact,
      source: lev.source,
      evidenceRefs: [...new Set(lev.evidenceRefs)].slice(0, 5),
    })
  }

  // 按强度排序
  leverages.sort((a, b) => b.strength - a.strength)

  // topLeverage
  const topLeverage = leverages.length > 0
    ? { code: leverages[0].code, label: leverages[0].label, strength: leverages[0].strength }
    : { code: 'NONE', label: '未检测到明显杠杆', strength: 0 }

  // 总杠杆分
  let totalLeverageScore = 0
  if (leverages.length > 0) {
    totalLeverageScore = Math.round(
      leverages.reduce((sum, l, i) => sum + l.strength / (i + 1), 0) /
      leverages.reduce((sum, _, i) => sum + 1 / (i + 1), 0)
    )
  }

  return createLeverageOutput({
    version: '6.1.0',
    leverages,
    topLeverage,
    totalLeverageScore,
    evidenceRefs: [...allEvidenceRefs],
  })
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

module.exports = { run }
