/**
 * core/turnaround-intelligence/contracts/opportunity.js
 *
 * CP6-C.1 Opportunity Contract — 12 个固定机会编码
 *
 * Opportunity 是 Risk × Leverage × Conflict 的交汇产物。
 *
 * 回答："现阶段最值得抓住的机会是什么？"
 *
 * @version 6.1.0
 * @checkpoint CP6-C.1
 */

// ═══════════════════════════════════════
// Opportunity Catalog — 12 个固定 Code
// ═══════════════════════════════════════

const OPPORTUNITY_CATALOG = Object.freeze({

  KNOWLEDGE_TO_EXECUTION: {
    code: 'KNOWLEDGE_TO_EXECUTION',
    title: '知识转化为执行',
    description: '利用现有的学习能力，建立最小执行闭环',
    window: 'NEXT_90_DAYS',
    difficulty: 'MEDIUM',
  },

  INCOME_DIVERSIFICATION: {
    code: 'INCOME_DIVERSIFICATION',
    title: '收入多元化',
    description: '利用可调用时间或技能，开辟第二条收入线',
    window: 'NEXT_90_DAYS',
    difficulty: 'MEDIUM',
  },

  DISCIPLINE_BUILDING: {
    code: 'DISCIPLINE_BUILDING',
    title: '建立纪律习惯',
    description: '利用已有自律能力，建立可复制的执行习惯',
    window: 'NEXT_60_DAYS',
    difficulty: 'MEDIUM',
  },

  SPEED_TO_CONSISTENCY: {
    code: 'SPEED_TO_CONSISTENCY',
    title: '从速度到持续性',
    description: '从快速启动升级为可持续执行',
    window: 'NEXT_90_DAYS',
    difficulty: 'MEDIUM',
  },

  RISK_FRAMEWORK_BUILDING: {
    code: 'RISK_FRAMEWORK_BUILDING',
    title: '建立风控框架',
    description: '在保持行动力的同时，构建基本风险边界',
    window: 'NEXT_60_DAYS',
    difficulty: 'LOW',
  },

  MINDSET_SHIFT: {
    code: 'MINDSET_SHIFT',
    title: '心态转移',
    description: '从被动心态转向主动心态，建立反馈闭环',
    window: 'NEXT_90_DAYS',
    difficulty: 'HIGH',
  },

  SKILL_DEEPENING: {
    code: 'SKILL_DEEPENING',
    title: '技能深化',
    description: '聚焦一个方向深度积累，建立竞争壁垒',
    window: 'NEXT_180_DAYS',
    difficulty: 'HIGH',
  },

  NETWORK_MONETIZATION: {
    code: 'NETWORK_MONETIZATION',
    title: '人脉变现',
    description: '利用现有人脉资源，寻找合作和变现机会',
    window: 'NEXT_60_DAYS',
    difficulty: 'LOW',
  },

  HABIT_COMPOUNDING: {
    code: 'HABIT_COMPOUNDING',
    title: '习惯复利',
    description: '利用已有坚持力，建立多个可复利的小习惯',
    window: 'NEXT_180_DAYS',
    difficulty: 'MEDIUM',
  },

  ASSET_ACCUMULATION_START: {
    code: 'ASSET_ACCUMULATION_START',
    title: '启动资产积累',
    description: '开始建立基本的财务安全垫',
    window: 'NEXT_180_DAYS',
    difficulty: 'HIGH',
  },

  CREATIVITY_TO_OUTPUT: {
    code: 'CREATIVITY_TO_OUTPUT',
    title: '创意到产出',
    description: '将思考和创造力转化为可见输出',
    window: 'NEXT_90_DAYS',
    difficulty: 'MEDIUM',
  },

  DECISION_SIMPLIFICATION: {
    code: 'DECISION_SIMPLIFICATION',
    title: '决策简化',
    description: '减少决策疲劳，建立自动化决策规则',
    window: 'NEXT_30_DAYS',
    difficulty: 'LOW',
  },
})

// ═══════════════════════════════════════
// 时间窗口
// ═══════════════════════════════════════

const TIME_WINDOWS = Object.freeze({
  NEXT_30_DAYS: { code: 'NEXT_30_DAYS', label: '30天内' },
  NEXT_60_DAYS: { code: 'NEXT_60_DAYS', label: '60天内' },
  NEXT_90_DAYS: { code: 'NEXT_90_DAYS', label: '90天内' },
  NEXT_180_DAYS: { code: 'NEXT_180_DAYS', label: '180天内' },
})

const DIFFICULTY_LEVELS = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
})

// ═══════════════════════════════════════
// Conflict → Opportunity 映射
// ═══════════════════════════════════════

const CONFLICT_TO_OPPORTUNITY = Object.freeze({
  LEARNING_EXECUTION_CONFLICT: 'KNOWLEDGE_TO_EXECUTION',
  AMBITION_DISCIPLINE_CONFLICT: 'DISCIPLINE_BUILDING',
  SPEED_CONSISTENCY_CONFLICT: 'SPEED_TO_CONSISTENCY',
  THINKING_ACTION_CONFLICT: 'CREATIVITY_TO_OUTPUT',
  RISK_REWARD_CONFLICT: 'RISK_FRAMEWORK_BUILDING',
  STABILITY_GROWTH_CONFLICT: 'MINDSET_SHIFT',
})

// ═══════════════════════════════════════
// createOpportunityOutput — Top 3
// ═══════════════════════════════════════

function createOpportunityOutput({ version, topOpportunities, totalOpportunityScore }) {
  if (!version) throw new Error('OpportunityOutput: version required')
  if (!Array.isArray(topOpportunities)) throw new Error('OpportunityOutput: topOpportunities must be an array')
  if (topOpportunities.length > 3) throw new Error('OpportunityOutput: max 3')

  for (let i = 0; i < topOpportunities.length; i++) {
    const o = topOpportunities[i]
    if (!o.opportunityCode) throw new Error(`topOpportunities[${i}]: opportunityCode required`)
    if (!OPPORTUNITY_CATALOG[o.opportunityCode]) throw new Error(`Unknown opportunity: "${o.opportunityCode}"`)
    if (typeof o.expectedImpact !== 'number' || o.expectedImpact < 0 || o.expectedImpact > 100) {
      throw new Error(`Opportunity ${o.opportunityCode}: expectedImpact out of range`)
    }
    if (o.priority !== i + 1) throw new Error(`topOpportunities[${i}]: priority must be ${i + 1}`)
    if (typeof o.confidence !== 'number') throw new Error(`Opportunity ${o.opportunityCode}: confidence required`)
    if (!o.basedOn || !o.basedOn.conflict) throw new Error(`Opportunity ${o.opportunityCode}: basedOn.conflict required`)
  }

  return Object.freeze({
    version,
    topOpportunities: Object.freeze(topOpportunities.map(o => Object.freeze({ ...o }))),
    totalOpportunityScore: Math.round(clamp(totalOpportunityScore, 0, 100)),
  })
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
module.exports = { OPPORTUNITY_CATALOG, CONFLICT_TO_OPPORTUNITY, TIME_WINDOWS, DIFFICULTY_LEVELS, createOpportunityOutput }
