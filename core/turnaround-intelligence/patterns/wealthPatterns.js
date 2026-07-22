/**
 * core/turnaround-intelligence/patterns/wealthPatterns.js
 *
 * CP6-B.1 Pattern Graph — 财富模式
 *
 * @version 6.0.0
 * @checkpoint CP6-B.1
 */

const { BEHAVIOR_TAGS, WEALTH_TAGS, PSYCHOLOGY_TAGS } = require('../contracts/tags')

const WEALTH_PATTERNS = [

  // ═══ 单一收入 + 无投资 = 收入脆弱 ═══
  {
    id: 'PATTERN_INCOME_FRAGILITY',
    name: '收入脆弱模式',
    chain: [
      [WEALTH_TAGS.SINGLE_INCOME],
      [WEALTH_TAGS.INCOME_STABLE],
    ],
    conclusion: 'INCOME_FRAGILITY',
    severityBase: 70,
    reversibility: 'HIGH',
    estimatedRecoveryDays: 60,
    evidenceTagsRequired: 2,
    description: '单一稳定收入 → 抗风险能力极弱',
  },

  // ═══ 负债 + 收入不稳 = 流动性危机 ═══
  {
    id: 'PATTERN_LIQUIDITY_CRISIS',
    name: '流动性危机模式',
    chain: [
      [WEALTH_TAGS.DEBT_PRESSURE],
      [WEALTH_TAGS.INCOME_UNSTABLE],
    ],
    conclusion: 'LIQUIDITY_CRISIS',
    severityBase: 92,
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 120,
    evidenceTagsRequired: 2,
    description: '负债 + 收入不稳定 → 严重流动性风险',
  },

  // ═══ 负债 + 固定收入 = 可控风险 ═══
  {
    id: 'PATTERN_MANAGEABLE_DEBT',
    name: '可控负债模式',
    chain: [
      [WEALTH_TAGS.DEBT_PRESSURE],
      [WEALTH_TAGS.INCOME_STABLE],
    ],
    conclusion: 'MANAGEABLE_DEBT',
    severityBase: 55,
    reversibility: 'HIGH',
    estimatedRecoveryDays: 90,
    evidenceTagsRequired: 2,
    description: '负债但有稳定收入 → 可规划还款',
  },

  // ═══ 多收入 + 有财务缓冲 = 财务独立 ═══
  {
    id: 'PATTERN_FINANCIAL_INDEPENDENCE',
    name: '财务独立模式',
    chain: [
      [WEALTH_TAGS.MULTI_INCOME],
      [WEALTH_TAGS.FINANCIAL_BUFFER],
    ],
    conclusion: 'FINANCIAL_INDEPENDENCE',
    severityBase: 0,
    reversibility: 'NONE',
    estimatedRecoveryDays: 0,
    evidenceTagsRequired: 2,
    description: '多收入 + 财务缓冲 → 财务基础稳固',
  },

  // ═══ 短视 + 无积蓄 + 单一收入 = 财务失控 ═══
  {
    id: 'PATTERN_FINANCIAL_DISORDER',
    name: '财务失控模式',
    chain: [
      [BEHAVIOR_TAGS.SHORT_TERM_ORIENTED],
      [WEALTH_TAGS.SINGLE_INCOME],
      [WEALTH_TAGS.DEBT_PRESSURE],
    ],
    conclusion: 'FINANCIAL_DISORDER',
    severityBase: 85,
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 150,
    evidenceTagsRequired: 2,
    description: '短视消费 + 单一收入 → 逐步恶化 → 负债累积',
  },

  // ═══ 高欲望 + 高冲动 + 无积累 = 消费主义陷阱 ═══
  {
    id: 'PATTERN_CONSUMERISM_TRAP',
    name: '消费主义陷阱模式',
    chain: [
      [PSYCHOLOGY_TAGS.RISK_SEEK],
      [BEHAVIOR_TAGS.EMOTION_DRIVEN],
      [WEALTH_TAGS.FINANCIAL_BUFFER],
    ],
    conclusion: 'CONSUMERISM_TRAP',
    severityBase: 65,
    reversibility: 'HIGH',
    estimatedRecoveryDays: 45,
    evidenceTagsRequired: 2,
    description: '冲动消费 + 无积蓄 → 收入即花完',
  },

  // ═══ 单一收入 + 学习能力强 → 收入转型可预期 ═══
  {
    id: 'PATTERN_INCOME_TRANSITION_READY',
    name: '收入转型准备模式',
    chain: [
      [WEALTH_TAGS.SINGLE_INCOME],
      [BEHAVIOR_TAGS.LEARNING],
    ],
    conclusion: 'INCOME_TRANSITION_READY',
    severityBase: 30,
    reversibility: 'HIGH',
    estimatedRecoveryDays: 60,
    evidenceTagsRequired: 2,
    description: '单一收入但学习能力强 → 转型在望',
  },
]

// ═══════════════════════════════════════
// detectWealthPatterns — 主入口
// ═══════════════════════════════════════

function detectWealthPatterns(evidences) {
  const matched = []

  for (const pattern of WEALTH_PATTERNS) {
    const result = matchPattern(pattern, evidences)
    if (result) matched.push(result)
  }

  return matched
}

// ═══════════════════════════════════════
// matchPattern (与 actionPatterns 共享逻辑)
// ═══════════════════════════════════════

function matchPattern(pattern, evidences) {
  const allTags = new Set()
  const evidenceMap = new Map()
  for (const ev of evidences) {
    for (const tag of ev.tags) {
      allTags.add(tag)
      if (!evidenceMap.has(tag)) evidenceMap.set(tag, [])
      evidenceMap.get(tag).push(ev.id)
    }
  }

  const hitIds = []
  const evidenceRefs = []

  for (const hop of pattern.chain) {
    const anyMatch = hop.some(tag => allTags.has(tag))
    if (!anyMatch) return null
    for (const tag of hop) {
      if (allTags.has(tag)) hitIds.push(tag)
    }
    const hopTag = hop.find(tag => allTags.has(tag))
    if (hopTag && evidenceMap.has(hopTag)) {
      for (const eid of evidenceMap.get(hopTag)) {
        if (!evidenceRefs.includes(eid)) evidenceRefs.push(eid)
      }
    }
  }

  if (hitIds.length < pattern.evidenceTagsRequired) return null

  const avgWeight = evidenceRefs.length > 0
    ? evidenceRefs.reduce((sum, eid) => sum + (evidences.find(e => e.id === eid)?.weight || 0), 0) / evidenceRefs.length
    : 0.5

  const severity = Math.min(
    Math.round(pattern.severityBase * (0.7 + 0.3 * avgWeight)),
    100
  )

  return {
    id: pattern.id,
    name: pattern.name,
    conclusion: pattern.conclusion,
    severity,
    reversibility: pattern.reversibility,
    estimatedRecoveryDays: pattern.estimatedRecoveryDays,
    evidenceRefs,
    tags: [...new Set(hitIds)],
  }
}

module.exports = {
  WEALTH_PATTERNS,
  detectWealthPatterns,
  getPositivePatterns: (patterns) => patterns.filter(p => p.severity === 0),
  getNegativePatterns: (patterns) => patterns.filter(p => p.severity > 0),
}
