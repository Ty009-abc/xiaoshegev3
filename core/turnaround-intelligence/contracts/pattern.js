/**
 * core/turnaround-intelligence/contracts/pattern.js
 *
 * CP6-C Pattern Contract — 统一模式定义
 *
 * Pattern 是 Evidence 和 Risk/Leverage 之间的中间层。
 * 12 个固定 Pattern，不分类，统一管理。
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

const { BEHAVIOR_TAGS, WEALTH_TAGS, PSYCHOLOGY_TAGS } = require('./tags')

// ═══════════════════════════════════════
// Pattern Catalog — 12 个固定 Pattern
// ═══════════════════════════════════════

const PATTERN_CATALOG = Object.freeze({

  ACTION_FRAGMENTATION: {
    code: 'ACTION_FRAGMENTATION',
    name: '行动碎片化',
    category: 'EXECUTION',
    chainTags: [[BEHAVIOR_TAGS.ACTION_DELAY], [BEHAVIOR_TAGS.INCONSISTENCY]],
    conclusion: 'EXECUTION_BREAK',
    severityBase: 82,
    reversibility: 'HIGH',
    estimatedRecoveryDays: 45,
    description: '拖延 + 不一致 → 执行习惯断裂',
  },

  HIGH_INPUT_LOW_OUTPUT: {
    code: 'HIGH_INPUT_LOW_OUTPUT',
    name: '高输入低输出',
    category: 'EXECUTION',
    chainTags: [[BEHAVIOR_TAGS.LEARNING], [BEHAVIOR_TAGS.ACTION_DELAY]],
    conclusion: 'LEARNING_EXECUTION_GAP',
    severityBase: 72,
    reversibility: 'HIGH',
    estimatedRecoveryDays: 45,
    description: '学习多 + 行动拖 → 知识未转化',
  },

  SHORT_TERM_REWARD: {
    code: 'SHORT_TERM_REWARD',
    name: '短期奖赏偏好',
    category: 'EXECUTION',
    chainTags: [[BEHAVIOR_TAGS.SHORT_TERM_ORIENTED], [BEHAVIOR_TAGS.EMOTION_DRIVEN]],
    conclusion: 'SHORT_TERM_ADDICTION',
    severityBase: 78,
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 90,
    description: '短视 + 冲动 → 沉迷即时满足',
  },

  EMOTIONAL_DECISION: {
    code: 'EMOTIONAL_DECISION',
    name: '情绪驱动决策',
    category: 'EXECUTION',
    chainTags: [[BEHAVIOR_TAGS.EMOTION_DRIVEN], [BEHAVIOR_TAGS.INCONSISTENCY]],
    conclusion: 'EMOTIONAL_INTERRUPTION',
    severityBase: 78,
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 90,
    description: '情绪驱动 + 不一致 → 周期中断',
  },

  RISK_AVOIDANCE: {
    code: 'RISK_AVOIDANCE',
    name: '过度风险规避',
    category: 'PSYCHOLOGY',
    chainTags: [[PSYCHOLOGY_TAGS.RISK_AVOID], [PSYCHOLOGY_TAGS.STABILITY_SEEKING]],
    conclusion: 'DEFENSIVE_STANCE',
    severityBase: 60,
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 120,
    description: '风险规避 + 稳定追求 → 防御心态',
  },

  RISK_OVERCONFIDENCE: {
    code: 'RISK_OVERCONFIDENCE',
    name: '风险过度自信',
    category: 'PSYCHOLOGY',
    chainTags: [[PSYCHOLOGY_TAGS.RISK_SEEK], [PSYCHOLOGY_TAGS.ANXIETY_HIGH]],
    conclusion: 'ADDICTIVE_RISK',
    severityBase: 90,
    reversibility: 'LOW',
    estimatedRecoveryDays: 180,
    description: '高风险偏好 + 焦虑 → 成瘾型循环',
  },

  SINGLE_INCOME_DEPENDENCY: {
    code: 'SINGLE_INCOME_DEPENDENCY',
    name: '单一收入依赖',
    category: 'WEALTH',
    chainTags: [[WEALTH_TAGS.SINGLE_INCOME], [WEALTH_TAGS.INCOME_STABLE]],
    conclusion: 'INCOME_FRAGILITY',
    severityBase: 70,
    reversibility: 'HIGH',
    estimatedRecoveryDays: 60,
    description: '单一稳定收入 → 抗风险弱',
  },

  LOW_COMPOUNDING: {
    code: 'LOW_COMPOUNDING',
    name: '低复利积累',
    category: 'WEALTH',
    chainTags: [[WEALTH_TAGS.FINANCIAL_BUFFER], [BEHAVIOR_TAGS.EMOTION_DRIVEN]],
    conclusion: 'CONSUMERISM_TRAP',
    severityBase: 65,
    reversibility: 'HIGH',
    estimatedRecoveryDays: 45,
    description: '冲动消费 + 无积蓄 → 消费主义陷阱',
  },

  LOW_MONETIZATION: {
    code: 'LOW_MONETIZATION',
    name: '低变现能力',
    category: 'WEALTH',
    chainTags: [[BEHAVIOR_TAGS.LEARNING], [WEALTH_TAGS.SINGLE_INCOME]],
    conclusion: 'LOW_MONETIZATION',
    severityBase: 68,
    reversibility: 'HIGH',
    estimatedRecoveryDays: 60,
    description: '学得多 + 单一收入 → 变现弱',
  },

  PASSIVE_EXPECTATION: {
    code: 'PASSIVE_EXPECTATION',
    name: '被动期待',
    category: 'PSYCHOLOGY',
    chainTags: [[PSYCHOLOGY_TAGS.EXTERNAL_LOCUS], [BEHAVIOR_TAGS.SHORT_TERM_ORIENTED]],
    conclusion: 'NO_SELF_DRIVE',
    severityBase: 85,
    reversibility: 'LOW',
    estimatedRecoveryDays: 180,
    description: '外部归因 + 短视 → 无内在驱动',
  },

  LEARNING_WITHOUT_PRACTICE: {
    code: 'LEARNING_WITHOUT_PRACTICE',
    name: '学而不练',
    category: 'EXECUTION',
    chainTags: [[BEHAVIOR_TAGS.LEARNING], [BEHAVIOR_TAGS.ACTION_DELAY], [PSYCHOLOGY_TAGS.SELF_DOUBT]],
    conclusion: 'ANALYSIS_PARALYSIS',
    severityBase: 75,
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 60,
    description: '学 + 拖 + 自我怀疑 → 分析瘫痪',
  },

  GOAL_INSTABILITY: {
    code: 'GOAL_INSTABILITY',
    name: '目标不稳定',
    category: 'EXECUTION',
    chainTags: [[BEHAVIOR_TAGS.INCONSISTENCY], [PSYCHOLOGY_TAGS.FIXED_MINDSET]],
    conclusion: 'RIGID_BEHAVIOR',
    severityBase: 80,
    reversibility: 'LOW',
    estimatedRecoveryDays: 180,
    description: '不一致 + 固定心态 → 模式难以改变',
  },
})

// ═══════════════════════════════════════
// Pattern Detection Level
// ═══════════════════════════════════════

const PATTERN_STRENGTH_LEVELS = Object.freeze({
  STRONG: { min: 0.75, label: '强匹配' },
  MODERATE: { min: 0.50, label: '中等匹配' },
  WEAK: { min: 0.25, label: '弱匹配' },
})

function getStrengthLevel(strength) {
  if (strength >= 0.75) return 'STRONG'
  if (strength >= 0.50) return 'MODERATE'
  return 'WEAK'
}

// ═══════════════════════════════════════
// createPatternOutput
// ═══════════════════════════════════════

function createPatternOutput({ version, patterns, meta }) {
  if (!version) throw new Error('PatternOutput: version required')
  if (!Array.isArray(patterns)) throw new Error('PatternOutput: patterns must be an array')
  if (patterns.length === 0) {
    return Object.freeze({
      version,
      patterns: Object.freeze([]),
      meta: Object.freeze({ totalMatched: 0 }),
    })
  }

  for (const p of patterns) {
    if (!p.code) throw new Error('Pattern missing code')
    if (!PATTERN_CATALOG[p.code]) throw new Error(`Unknown pattern code: "${p.code}"`)
    if (typeof p.strength !== 'number' || p.strength < 0 || p.strength > 1) {
      throw new Error(`Pattern ${p.code}: strength must be 0–1, got ${p.strength}`)
    }
    if (typeof p.confidence !== 'number' || p.confidence < 0 || p.confidence > 1) {
      throw new Error(`Pattern ${p.code}: confidence must be 0–1, got ${p.confidence}`)
    }
    if (!Array.isArray(p.evidenceRefs)) {
      throw new Error(`Pattern ${p.code}: evidenceRefs must be an array`)
    }
  }

  return Object.freeze({
    version,
    patterns: Object.freeze(patterns.map(p => Object.freeze({ ...p }))),
    meta: Object.freeze(meta || {}),
  })
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

module.exports = {
  PATTERN_CATALOG,
  PATTERN_STRENGTH_LEVELS,
  getStrengthLevel,
  createPatternOutput,
}
