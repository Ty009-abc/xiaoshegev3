/**
 * core/turnaround-intelligence/contracts/risk.js
 *
 * CP6-C Risk Contract — 12 个固定风险编码
 *
 * 每个风险项包含:
 *   riskCode, title, severity, priority, reversibility,
 *   estimatedRecoveryDays, confidence, patternRefs, evidenceRefs, actionHints
 *
 * actionHints 是内部暗示，供 Action Engine 用
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

// ═══════════════════════════════════════
// Risk Catalog — 12 个固定 Code
// ═══════════════════════════════════════

const RISK_CATALOG = Object.freeze({

  EXECUTION_FRAGMENTATION: {
    code: 'EXECUTION_FRAGMENTATION',
    title: '执行碎片化',
    category: 'EXECUTION',
    reversibility: 'HIGH',
    estimatedRecoveryDays: 45,
    description: '计划频繁中断，无法形成持续执行闭环',
    actionHints: ['BUILD_ROUTINE', 'CREATE_FEEDBACK', 'MINI_HABITS'],
  },

  ANALYSIS_PARALYSIS: {
    code: 'ANALYSIS_PARALYSIS',
    title: '分析瘫痪',
    category: 'EXECUTION',
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 60,
    description: '过度思考导致无法启动行动',
    actionHints: ['TIME_BOX_DECISION', 'ACTION_FIRST', 'CUT_OVERPLANNING'],
  },

  LOW_DISCIPLINE: {
    code: 'LOW_DISCIPLINE',
    title: '纪律缺失',
    category: 'EXECUTION',
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 90,
    description: '无法坚持计划，三天打鱼两天晒网',
    actionHints: ['BUILD_ROUTINE', 'ACCOUNTABILITY_PARTNER', 'STREAK_TRACKING'],
  },

  SHORT_TERM_ADDICTION: {
    code: 'SHORT_TERM_ADDICTION',
    title: '短期奖赏成瘾',
    category: 'EXECUTION',
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 90,
    description: '偏好即时满足，难以延迟奖赏',
    actionHints: ['CUT_DISTRACTION', 'BUILD_ROUTINE', 'REWARD_RESTRUCTURE'],
  },

  EMOTIONAL_VOLATILITY: {
    code: 'EMOTIONAL_VOLATILITY',
    title: '情绪波动',
    category: 'PSYCHOLOGY',
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 90,
    description: '情绪驱动决策，导致执行周期性中断',
    actionHints: ['EMOTION_JOURNAL', 'CREATE_FEEDBACK', 'TRIGGER_AWARENESS'],
  },

  INCOME_STRUCTURE_RISK: {
    code: 'INCOME_STRUCTURE_RISK',
    title: '收入结构风险',
    category: 'WEALTH',
    reversibility: 'HIGH',
    estimatedRecoveryDays: 60,
    description: '单一收入来源，抗风险能力极弱',
    actionHints: ['DIVERSIFY_INCOME', 'SKILL_MONETIZATION'],
  },

  LOW_SKILL_COMPOUNDING: {
    code: 'LOW_SKILL_COMPOUNDING',
    title: '技能复利不足',
    category: 'WEALTH',
    reversibility: 'HIGH',
    estimatedRecoveryDays: 90,
    description: '学习多但无积累，技能未形成复利效应',
    actionHints: ['DEEPEN_SPECIALIZATION', 'CREATE_FEEDBACK'],
  },

  LOW_ASSET_ACCUMULATION: {
    code: 'LOW_ASSET_ACCUMULATION',
    title: '资产积累不足',
    category: 'WEALTH',
    reversibility: 'HIGH',
    estimatedRecoveryDays: 120,
    description: '无财务缓冲，小风险即可造成危机',
    actionHints: ['BUILD_EMERGENCY_FUND', 'CUT_DISTRACTION'],
  },

  RISK_MISJUDGMENT: {
    code: 'RISK_MISJUDGMENT',
    title: '风险误判',
    category: 'PSYCHOLOGY',
    reversibility: 'LOW',
    estimatedRecoveryDays: 180,
    description: '高风险偏好 + 焦虑 → 成瘾型决策循环',
    actionHints: ['CREATE_FEEDBACK', 'RISK_FRAMEWORK', 'TRIGGER_AWARENESS'],
  },

  PASSIVE_MINDSET: {
    code: 'PASSIVE_MINDSET',
    title: '被动心态',
    category: 'PSYCHOLOGY',
    reversibility: 'LOW',
    estimatedRecoveryDays: 180,
    description: '外部归因 + 短视 → 缺乏内在改变动力',
    actionHints: ['INTERNAL_LOCUS_TRAINING', 'SMALL_WINS', 'CREATE_FEEDBACK'],
  },

  DECISION_FATIGUE: {
    code: 'DECISION_FATIGUE',
    title: '决策疲劳',
    category: 'PSYCHOLOGY',
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 60,
    description: '过度思考 + 自我怀疑 → 决策成本过高',
    actionHints: ['TIME_BOX_DECISION', 'DECISION_RULES', 'CUT_OVERPLANNING'],
  },

  HIGH_OPPORTUNITY_COST: {
    code: 'HIGH_OPPORTUNITY_COST',
    title: '高机会成本',
    category: 'COMPOSITE',
    reversibility: 'MEDIUM',
    estimatedRecoveryDays: 90,
    description: '认知能力强但执行弱，能力未兑现',
    actionHints: ['ACTION_FIRST', 'SKILL_MONETIZATION', 'BUILD_ROUTINE'],
  },
})

// ═══════════════════════════════════════
// Risk Output
// ═══════════════════════════════════════

/**
 * 只输出 Top 3 Risk
 */
function createRiskOutput({
  version,
  topRisks,
  totalRiskScore,
}) {
  if (!version) throw new Error('RiskOutput: version required')
  if (!Array.isArray(topRisks)) throw new Error('RiskOutput: topRisks must be an array')
  if (topRisks.length > 3) {
    throw new Error('RiskOutput: topRisks max 3, got ' + topRisks.length)
  }
  if (typeof totalRiskScore !== 'number') throw new Error('RiskOutput: totalRiskScore required')

  for (let i = 0; i < topRisks.length; i++) {
    const r = topRisks[i]
    if (!r.riskCode) throw new Error(`topRisks[${i}]: riskCode required`)
    if (!RISK_CATALOG[r.riskCode]) throw new Error(`Unknown riskCode: "${r.riskCode}"`)
    if (typeof r.severity !== 'number' || r.severity < 0 || r.severity > 100) {
      throw new Error(`Risk ${r.riskCode}: severity out of range`)
    }
    if (r.priority !== i + 1) throw new Error(`topRisks[${i}]: priority must be ${i + 1}`)
    if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1) {
      throw new Error(`Risk ${r.riskCode}: confidence out of range`)
    }
    if (!Array.isArray(r.patternRefs)) throw new Error(`Risk ${r.riskCode}: patternRefs required`)
    if (!Array.isArray(r.evidenceRefs)) throw new Error(`Risk ${r.riskCode}: evidenceRefs required`)
    if (!Array.isArray(r.actionHints)) throw new Error(`Risk ${r.riskCode}: actionHints required`)
  }

  return Object.freeze({
    version,
    topRisks: Object.freeze(topRisks.map(r => Object.freeze({ ...r }))),
    totalRiskScore: Math.round(clamp(totalRiskScore, 0, 100)),
  })
}

// ═══════════════════════════════════════
// Pattern → Risk 映射
// ═══════════════════════════════════════

const PATTERN_TO_RISK = {
  ACTION_FRAGMENTATION: 'EXECUTION_FRAGMENTATION',
  HIGH_INPUT_LOW_OUTPUT: 'HIGH_OPPORTUNITY_COST',
  SHORT_TERM_REWARD: 'SHORT_TERM_ADDICTION',
  EMOTIONAL_DECISION: 'EMOTIONAL_VOLATILITY',
  RISK_AVOIDANCE: 'DECISION_FATIGUE',
  RISK_OVERCONFIDENCE: 'RISK_MISJUDGMENT',
  SINGLE_INCOME_DEPENDENCY: 'INCOME_STRUCTURE_RISK',
  LOW_COMPOUNDING: 'LOW_ASSET_ACCUMULATION',
  LOW_MONETIZATION: 'LOW_SKILL_COMPOUNDING',
  PASSIVE_EXPECTATION: 'PASSIVE_MINDSET',
  LEARNING_WITHOUT_PRACTICE: 'ANALYSIS_PARALYSIS',
  GOAL_INSTABILITY: 'LOW_DISCIPLINE',
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

module.exports = {
  RISK_CATALOG,
  PATTERN_TO_RISK,
  createRiskOutput,
}
