/**
 * core/turnaround-intelligence/patterns/actionPatterns.js
 *
 * CP6-B.1 Pattern Graph — 行为模式
 *
 * 从 Evidence 的标签链中识别 > 1 跳的模式链。
 * Pattern 不直接接触 answers，只读取 Evidence.tags 序列。
 *
 * 以后 Risk Engine / Leverage Engine 读取的是 Pattern，不是 Evidence。
 *
 * @version 6.0.0
 * @checkpoint CP6-B.1
 */

const { BEHAVIOR_TAGS, PSYCHOLOGY_TAGS } = require('../contracts/tags')

// ═══════════════════════════════════════
// Pattern Definition
// ═══════════════════════════════════════

/**
 * 模式定义: { id, name, chain: [tag[]] }
 *
 * chain 是多条跳跃:
 *   chain[0] = 1 跳标签（直接命中 Evidence）
 *   chain[1] = 2 跳推论（连续出现后触发）
 *   chain[2] = 3 跳结论（模式最终形态）
 */

const ACTION_PATTERNS = [

  // ═══ 拖延 → 执行断裂 ═══
  {
    id: 'PATTERN_EXECUTION_BREAK',
    name: '执行断裂模式',
    chain: [
      [BEHAVIOR_TAGS.ACTION_DELAY],
      [BEHAVIOR_TAGS.INCONSISTENCY],
      // 3跳不设标签，用 patternConclusion
    ],
    conclusion: 'EXECUTION_BREAK',
    severityBase: 82,
    reversibility: 'HIGH',
    estimatedRecoveryDays: 45,
    evidenceTagsRequired: 2,
    description: '拖延 + 不一致 → 执行习惯断裂',
  },

  // ═══ 完美主义 → 分析瘫痪 → 机会成本 ═══
  {
    id: 'PATTERN_ANALYSIS_PARALYSIS',
    name: '分析瘫痪模式',
    chain: [
      [BEHAVIOR_TAGS.OVERTHINKING, PSYCHOLOGY_TAGS.SELF_DOUBT],
      [BEHAVIOR_TAGS.ACTION_DELAY],
    ],
    conclusion: 'ANALYSIS_PARALYSIS',
    severityBase: 75,
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 60,
    evidenceTagsRequired: 2,
    description: '思考过多 + 自我怀疑 → 行动延迟 → 机会流失',
  },

  // ═══ 情绪驱动 → 加速消耗 → 执行中断 ═══
  {
    id: 'PATTERN_EMOTIONAL_INTERRUPTION',
    name: '情绪中断模式',
    chain: [
      [BEHAVIOR_TAGS.EMOTION_DRIVEN],
      [BEHAVIOR_TAGS.INCONSISTENCY],
    ],
    conclusion: 'EMOTIONAL_INTERRUPTION',
    severityBase: 78,
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 90,
    evidenceTagsRequired: 2,
    description: '情绪驱动 + 不一致 → 周期性中断执行',
  },

  // ═══ 学习 → 行动 = 转化断裂 ═══
  {
    id: 'PATTERN_LEARNING_EXECUTION_GAP',
    name: '学习-执行断裂模式',
    chain: [
      [BEHAVIOR_TAGS.LEARNING],
      [BEHAVIOR_TAGS.ACTION_DELAY],
    ],
    conclusion: 'LEARNING_EXECUTION_GAP',
    severityBase: 72,
    reversibility: 'HIGH',
    estimatedRecoveryDays: 45,
    evidenceTagsRequired: 2,
    description: '学习输入多 + 行动延迟 → 知识未转化成行动',
  },

  // ═══ DISCIPLINE+PERSISTENCE → CONSISTENT_EXECUTION ═══
  {
    id: 'PATTERN_CONSISTENT_EXECUTION',
    name: '持续执行模式',
    chain: [
      [BEHAVIOR_TAGS.DISCIPLINE],
      [BEHAVIOR_TAGS.PERSISTENCE],
    ],
    conclusion: 'CONSISTENT_EXECUTION',
    severityBase: 0, // 这是正向模式，不产生 risk
    reversibility: 'NONE',
    estimatedRecoveryDays: 0,
    evidenceTagsRequired: 2,
    description: '纪律 + 坚持 → 执行闭环已形成',
  },

  // ═══ 学习+成长心态 → 适应力 ═══
  {
    id: 'PATTERN_ADAPTIVE_LEARNING',
    name: '适应学习模式',
    chain: [
      [BEHAVIOR_TAGS.LEARNING],
      [PSYCHOLOGY_TAGS.GROWTH_MINDSET],
    ],
    conclusion: 'ADAPTIVE_LEARNING',
    severityBase: 0,
    reversibility: 'NONE',
    estimatedRecoveryDays: 0,
    evidenceTagsRequired: 2,
    description: '学习欲望 + 成长心态 → 适应力基础稳固',
  },

  // ═══ 固定心态 + 行动计划 = 僵化 ═══
  {
    id: 'PATTERN_RIGID_BEHAVIOR',
    name: '行为僵化模式',
    chain: [
      [PSYCHOLOGY_TAGS.FIXED_MINDSET],
      [BEHAVIOR_TAGS.SHORT_TERM_ORIENTED],
    ],
    conclusion: 'RIGID_BEHAVIOR',
    severityBase: 80,
    reversibility: 'LOW',
    estimatedRecoveryDays: 180,
    evidenceTagsRequired: 2,
    description: '固定心态 + 短视 → 模式难以改变',
  },

  // ═══ 自信 + 长期导向 → 战略执行 ═══
  {
    id: 'PATTERN_STRATEGIC_EXECUTION',
    name: '战略执行模式',
    chain: [
      [PSYCHOLOGY_TAGS.CONFIDENCE],
      [BEHAVIOR_TAGS.LONG_TERM_ORIENTED],
    ],
    conclusion: 'STRATEGIC_EXECUTION',
    severityBase: 0,
    reversibility: 'NONE',
    estimatedRecoveryDays: 0,
    evidenceTagsRequired: 2,
    description: '自信 + 长期思维 → 战略执行能力强',
  },

  // ═══ 外部归因 + 短视 = 无自驱 ═══
  {
    id: 'PATTERN_NO_SELF_DRIVE',
    name: '无自驱模式',
    chain: [
      [PSYCHOLOGY_TAGS.EXTERNAL_LOCUS],
      [BEHAVIOR_TAGS.SHORT_TERM_ORIENTED],
    ],
    conclusion: 'NO_SELF_DRIVE',
    severityBase: 85,
    reversibility: 'LOW',
    estimatedRecoveryDays: 180,
    evidenceTagsRequired: 2,
    description: '外部归因 + 短视 → 缺乏内在动力',
  },
]

// ═══════════════════════════════════════
// detectActionPatterns — 主入口
// ═══════════════════════════════════════

/**
 * detectActionPatterns — 从 Evidence 标签中检测行为模式
 *
 * @param {Object[]} evidences — 证据数组
 * @returns {Object[]} 命中的模式数组
 */
function detectActionPatterns(evidences) {
  const matched = []

  for (const pattern of ACTION_PATTERNS) {
    const result = matchPattern(pattern, evidences)
    if (result) {
      matched.push(result)
    }
  }

  return matched
}

// ═══════════════════════════════════════
// matchPattern — 单 Pattern 匹配
// ═══════════════════════════════════════

function matchPattern(pattern, evidences) {
  // 收集所有标签
  const allTags = new Set()
  const evidenceMap = new Map()
  for (const ev of evidences) {
    for (const tag of ev.tags) {
      allTags.add(tag)
      if (!evidenceMap.has(tag)) evidenceMap.set(tag, [])
      evidenceMap.get(tag).push(ev.id)
    }
  }

  // 逐跳匹配
  const hitIds = []
  const evidenceRefs = []

  for (const hop of pattern.chain) {
    // hop 是 tag[]，至少命中一个
    const anyMatch = hop.some(tag => allTags.has(tag))
    if (!anyMatch) return null

    for (const tag of hop) {
      if (allTags.has(tag)) {
        hitIds.push(tag)
      }
    }
    // 收集该跳的证据引用
    const hopTag = hop.find(tag => allTags.has(tag))
    if (hopTag && evidenceMap.has(hopTag)) {
      for (const eid of evidenceMap.get(hopTag)) {
        if (!evidenceRefs.includes(eid)) evidenceRefs.push(eid)
      }
    }
  }

  // 最少标签数要求
  if (hitIds.length < pattern.evidenceTagsRequired) return null

  // 计算权重（基于命中标签的证据平均权重）
  const avgWeight = evidenceRefs.length > 0
    ? evidenceRefs.reduce(
        (sum, eid) => sum + (evidences.find(e => e.id === eid)?.weight || 0), 0
      ) / evidenceRefs.length
    : 0.5

  // 严重度 = baseSeverity × avgWeight (上限 100)
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

// ═══════════════════════════════════════
// getPositivePatterns / getNegativePatterns
// ═══════════════════════════════════════

/**
 * getPositivePatterns — 筛选正向模式（不是风险）
 */
function getPositivePatterns(patterns) {
  return patterns.filter(p => p.severity === 0)
}

/**
 * getNegativePatterns — 筛选负向模式（风险源）
 */
function getNegativePatterns(patterns) {
  return patterns.filter(p => p.severity > 0)
}

/**
 * getPatternsByReversibility — 按可逆性筛选
 */
function getPatternsByReversibility(patterns, level) {
  return patterns.filter(p => p.reversibility === level)
}

/**
 * getTotalPatternRisk — 计算总风险严重度
 */
function getTotalPatternRisk(patterns) {
  const negative = getNegativePatterns(patterns)
  if (negative.length === 0) return 0

  const weights = negative.map((_, i) => 1 / (i + 1))
  const weightSum = weights.reduce((a, b) => a + b, 0)

  return Math.round(
    negative.reduce(
      (sum, p, i) => sum + p.severity * (weights[i] / weightSum),
      0
    )
  )
}

module.exports = {
  ACTION_PATTERNS,
  detectActionPatterns,
  getPositivePatterns,
  getNegativePatterns,
  getPatternsByReversibility,
  getTotalPatternRisk,
}
