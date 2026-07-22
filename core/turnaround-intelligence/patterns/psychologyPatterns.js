/**
 * core/turnaround-intelligence/patterns/psychologyPatterns.js
 *
 * CP6-B.1 Pattern Graph — 心理模式
 *
 * @version 6.0.0
 * @checkpoint CP6-B.1
 */

const { BEHAVIOR_TAGS, PSYCHOLOGY_TAGS, WEALTH_TAGS } = require('../contracts/tags')

const PSYCHOLOGY_PATTERNS = [

  // ═══ 低信心 + 外部归因 = 习得性无助 ═══
  {
    id: 'PATTERN_LEARNED_HELPLESSNESS',
    name: '习得性无助模式',
    chain: [
      [PSYCHOLOGY_TAGS.SELF_DOUBT],
      [PSYCHOLOGY_TAGS.EXTERNAL_LOCUS],
    ],
    conclusion: 'LEARNED_HELPLESSNESS',
    severityBase: 88,
    reversibility: 'LOW',
    estimatedRecoveryDays: 180,
    evidenceTagsRequired: 2,
    description: '自我否定 + 外部归因 → 失去改变动力',
  },

  // ═══ 高焦虑 + 无安全感 = 焦虑驱动型决策 ═══
  {
    id: 'PATTERN_ANXIETY_DRIVEN',
    name: '焦虑驱动模式',
    chain: [
      [PSYCHOLOGY_TAGS.ANXIETY_HIGH],
      [PSYCHOLOGY_TAGS.STABILITY_SEEKING],
    ],
    conclusion: 'ANXIETY_DRIVEN',
    severityBase: 75,
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 90,
    evidenceTagsRequired: 2,
    description: '高焦虑 + 追求稳定 → 决策偏向保守 → 错过机会',
  },

  // ═══ 风险偏好 + 高焦虑 = 成瘾型决策 ═══
  {
    id: 'PATTERN_ADDICTIVE_RISK',
    name: '成瘾型风险模式',
    chain: [
      [PSYCHOLOGY_TAGS.RISK_SEEK],
      [PSYCHOLOGY_TAGS.ANXIETY_HIGH],
    ],
    conclusion: 'ADDICTIVE_RISK',
    severityBase: 90,
    reversibility: 'LOW',
    estimatedRecoveryDays: 180,
    evidenceTagsRequired: 2,
    description: '高风险偏好 + 焦虑 → 赌博式决策循环',
  },

  // ═══ 成长心态 + 韧性 = 成长潜力 ═══
  {
    id: 'PATTERN_GROWTH_POTENTIAL',
    name: '成长潜力模式',
    chain: [
      [PSYCHOLOGY_TAGS.GROWTH_MINDSET],
      [PSYCHOLOGY_TAGS.RESILIENCE_HIGH],
    ],
    conclusion: 'GROWTH_POTENTIAL',
    severityBase: 0,
    reversibility: 'NONE',
    estimatedRecoveryDays: 0,
    evidenceTagsRequired: 2,
    description: '成长心态 + 韧性 → 翻身最强的心理基础',
  },

  // ═══ 固定心态 + 低韧性 + 单一收入 = 无出路感 ═══
  {
    id: 'PATTERN_DEAD_END',
    name: '无出路感模式',
    chain: [
      [PSYCHOLOGY_TAGS.FIXED_MINDSET],
      [PSYCHOLOGY_TAGS.RESILIENCE_HIGH],
    ],
    conclusion: 'CONTRADICTORY_MINDSET',
    severityBase: 60,
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 90,
    evidenceTagsRequired: 2,
    description: '固定心态但有一定韧性 → 矛盾状态，有成长空间',
  },

  // ═══ 自信 + 风险偏好 = 攻击性成长 ═══
  {
    id: 'PATTERN_AGGRESSIVE_GROWTH',
    name: '攻击性成长模式',
    chain: [
      [PSYCHOLOGY_TAGS.CONFIDENCE],
      [PSYCHOLOGY_TAGS.RISK_SEEK],
    ],
    conclusion: 'AGGRESSIVE_GROWTH',
    severityBase: 40,
    reversibility: 'HIGH',
    estimatedRecoveryDays: 45,
    evidenceTagsRequired: 2,
    description: '自信 + 高风险偏好 → 要么爆发要么吃亏',
  },

  // ═══ 风险规避 + 稳定心理 = 防御型心理 ═══
  {
    id: 'PATTERN_DEFENSIVE_STANCE',
    name: '防御型心态模式',
    chain: [
      [PSYCHOLOGY_TAGS.RISK_AVOID],
      [PSYCHOLOGY_TAGS.STABILITY_SEEKING],
    ],
    conclusion: 'DEFENSIVE_STANCE',
    severityBase: 45,
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 120,
    evidenceTagsRequired: 2,
    description: '风险规避 + 稳定追求 → 防御型心态，翻身需要突破心理',
  },
]

// ═══════════════════════════════════════
// detectPsychologyPatterns — 主入口
// ═══════════════════════════════════════

function detectPsychologyPatterns(evidences) {
  const matched = []
  for (const pattern of PSYCHOLOGY_PATTERNS) {
    const result = matchPattern(pattern, evidences)
    if (result) matched.push(result)
  }
  return matched
}

// ═══════════════════════════════════════
// matchPattern (same logic as other patterns)
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
  PSYCHOLOGY_PATTERNS,
  detectPsychologyPatterns,
  getPositivePatterns: (patterns) => patterns.filter(p => p.severity === 0),
  getNegativePatterns: (patterns) => patterns.filter(p => p.severity > 0),
}
