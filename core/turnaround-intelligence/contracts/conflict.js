/**
 * core/turnaround-intelligence/contracts/conflict.js
 *
 * CP6-C Conflict Contract — 冲突（Risk × Leverage）
 *
 * Conflict 是 Risk 和 Leverage 之间的张力。
 * 例如：学习能力强但执行力弱 → 高认知低兑现
 *
 * Verdict Engine 后续只读取 context.conflicts
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

// ═══════════════════════════════════════
// Conflict Codes — 固定冲突类型
// ═══════════════════════════════════════

const CONFLICT_CATALOG = Object.freeze({

  LEARNING_EXECUTION_CONFLICT: {
    code: 'LEARNING_EXECUTION_CONFLICT',
    title: '学习强 × 执行弱',
    description: '学习能力远高于执行能力，知识无法转化为结果',
  },

  AMBITION_DISCIPLINE_CONFLICT: {
    code: 'AMBITION_DISCIPLINE_CONFLICT',
    title: '高欲 × 低律',
    description: '目标很高但坚持力不足，频繁放弃',
  },

  SPEED_CONSISTENCY_CONFLICT: {
    code: 'SPEED_CONSISTENCY_CONFLICT',
    title: '快进 × 不持续',
    description: '启动快但不能持续，碎片化执行',
  },

  THINKING_ACTION_CONFLICT: {
    code: 'THINKING_ACTION_CONFLICT',
    title: '思多 × 行少',
    description: '过度思考但行动迟滞，陷入分析瘫痪',
  },

  RISK_REWARD_CONFLICT: {
    code: 'RISK_REWARD_CONFLICT',
    title: '敢赌 × 缺框',
    description: '风险偏好高但缺乏风控框架',
  },

  STABILITY_GROWTH_CONFLICT: {
    code: 'STABILITY_GROWTH_CONFLICT',
    title: '求稳 × 求变',
    description: '追求稳定但同时渴望突破，两难',
  },
})

// ═══════════════════════════════════════
// 冲突检测规则 — Risk × Leverage 对
// ═══════════════════════════════════════

/**
 * 每条规则定义:
 *   riskCode — 风险编码
 *   leverageCode — 杠杆编码
 *   conflictCode — 触发的冲突类型
 */
const CONFLICT_RULES = Object.freeze([
  // 学习强 × 执行弱
  { riskCode: 'HIGH_OPPORTUNITY_COST', leverageCode: 'LEARNING_SPEED', conflictCode: 'LEARNING_EXECUTION_CONFLICT' },
  { riskCode: 'ANALYSIS_PARALYSIS', leverageCode: 'LEARNING_SPEED', conflictCode: 'LEARNING_EXECUTION_CONFLICT' },
  { riskCode: 'EXECUTION_FRAGMENTATION', leverageCode: 'LEARNING_SPEED', conflictCode: 'LEARNING_EXECUTION_CONFLICT' },

  // 高欲 × 低律
  { riskCode: 'LOW_DISCIPLINE', leverageCode: 'CREATIVITY', conflictCode: 'AMBITION_DISCIPLINE_CONFLICT' },
  { riskCode: 'SHORT_TERM_ADDICTION', leverageCode: 'EXECUTION_SPEED', conflictCode: 'AMBITION_DISCIPLINE_CONFLICT' },

  // 快进 × 不持续
  { riskCode: 'EXECUTION_FRAGMENTATION', leverageCode: 'EXECUTION_SPEED', conflictCode: 'SPEED_CONSISTENCY_CONFLICT' },
  { riskCode: 'SHORT_TERM_ADDICTION', leverageCode: 'CONSISTENCY', conflictCode: 'SPEED_CONSISTENCY_CONFLICT' },

  // 思多 × 行少
  { riskCode: 'ANALYSIS_PARALYSIS', leverageCode: 'CREATIVITY', conflictCode: 'THINKING_ACTION_CONFLICT' },
  { riskCode: 'DECISION_FATIGUE', leverageCode: 'LEARNING_SPEED', conflictCode: 'THINKING_ACTION_CONFLICT' },

  // 敢赌 × 缺框
  { riskCode: 'RISK_MISJUDGMENT', leverageCode: 'EXECUTION_SPEED', conflictCode: 'RISK_REWARD_CONFLICT' },
  { riskCode: 'EMOTIONAL_VOLATILITY', leverageCode: 'CREATIVITY', conflictCode: 'RISK_REWARD_CONFLICT' },

  // 求稳 × 求变
  { riskCode: 'PASSIVE_MINDSET', leverageCode: 'SPECIALIZATION', conflictCode: 'STABILITY_GROWTH_CONFLICT' },
  { riskCode: 'INCOME_STRUCTURE_RISK', leverageCode: 'CONSISTENCY', conflictCode: 'STABILITY_GROWTH_CONFLICT' },
])

// ═══════════════════════════════════════
// createConflictOutput — Top 1~3
// ═══════════════════════════════════════

function createConflictOutput({
  version,
  conflicts,
}) {
  if (!version) throw new Error('ConflictOutput: version required')
  if (!Array.isArray(conflicts)) throw new Error('ConflictOutput: conflicts must be an array')
  if (conflicts.length > 3) throw new Error('ConflictOutput: max 3 conflicts')

  for (const c of conflicts) {
    if (!c.code) throw new Error('Conflict missing code')
    if (!CONFLICT_CATALOG[c.code]) throw new Error(`Unknown conflict code: "${c.code}"`)
    if (typeof c.severity !== 'number' || c.severity < 0 || c.severity > 100) {
      throw new Error(`Conflict ${c.code}: severity out of range`)
    }
    if (!c.riskRef) throw new Error(`Conflict ${c.code}: riskRef required`)
    if (!c.leverageRef) throw new Error(`Conflict ${c.code}: leverageRef required`)
  }

  return Object.freeze({
    version,
    conflicts: Object.freeze(conflicts.map(c => Object.freeze({ ...c }))),
  })
}

module.exports = {
  CONFLICT_CATALOG,
  CONFLICT_RULES,
  createConflictOutput,
}
