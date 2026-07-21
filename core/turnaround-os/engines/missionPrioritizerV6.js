/**
 * core/turnaround-os/engines/missionPrioritizerV6.js
 *
 * V6 Mission Prioritizer — 十维度任务优先级评分
 * 纯规则引擎，0–100 分，同输入同输出
 *
 * @version 6.0.0
 * @status CHECKPOINT_4B
 */

const {
  WEALTH_STAGES,
  MISSION_CATEGORIES_V6,
  COST_LEVELS,
  RISK_LEVELS,
  DIFFICULTY_LEVELS,
} = require('../constants')

const SURVIVAL = WEALTH_STAGES.SURVIVAL
const CAT = MISSION_CATEGORIES_V6

/**
 * scoreMissionPriority — 为单条 Mission 计算优先级
 *
 * @param {Object} mission — 待评分 Mission（已含 category/phase/cost/risk）
 * @param {Object} profile — identityEngine 输出
 * @param {Object} strategy — turnaroundEngine 输出
 * @param {Object} projection — destinyProjectionEngine 输出
 * @returns {{ priorityScore: number, scoreBreakdown: object, ruleHits: string[] }}
 */
function scoreMissionPriority({ mission, profile, strategy, projection }) {
  const stage = (profile.wealthStage || SURVIVAL).toUpperCase()
  const readiness = profile.strategyReadinessScore || 50
  const caps = profile.capabilities || {}
  const safetyMonths = (profile.reality && profile.reality.safetyMonths) || 0
  const hasFamily = profile.constraints
    && profile.constraints.familyPressure
    && profile.constraints.familyPressure.length > 0

  const ruleHits = []

  // 安全重要性
  const safetyImportance = scoreSafety(stage, mission, safetyMonths, ruleHits)
  // 战略重要性
  const strategicImportance = scoreStrategic(mission, strategy, ruleHits)
  // 验证速度
  const proofSpeed = scoreProofSpeed(mission, ruleHits)
  // 可逆性
  const reversibility = scoreReversibility(mission, ruleHits)
  // 成本适配
  const costFit = scoreCostFit(stage, mission, ruleHits)
  // 时间适配
  const timeFit = scoreTimeFit(profile, mission, hasFamily, readiness, ruleHits)
  // 依赖就绪
  const dependencyReadiness = scoreDependencyReadiness(mission, capsule, ruleHits)
  // 杠杆匹配
  const leverageFit = scoreLeverageFit(mission, strategy, ruleHits)
  // 推演影响
  const projectionImpact = scoreProjectionImpact(mission, projection, ruleHits)
  // 用户能力匹配
  const userCapabilityFit = scoreUserCapabilityFit(mission, capsule, ruleHits)

  const dimensions = [
    safetyImportance, strategicImportance, proofSpeed, reversibility, costFit,
    timeFit, dependencyReadiness, leverageFit, projectionImpact, userCapabilityFit,
  ]

  // 加权平均 → 0–100
  const weights = [0.20, 0.18, 0.12, 0.10, 0.10, 0.08, 0.06, 0.08, 0.04, 0.04]
  let weighted = 0
  for (let i = 0; i < dimensions.length; i++) {
    weighted += dimensions[i] * weights[i]
  }
  const priorityScore = Math.max(0, Math.min(100, Math.round(weighted)))

  // 硬约束修正
  const finalScore = applyHardConstraints(mission, stage, priorityScore, ruleHits)

  return {
    priorityScore: finalScore,
    scoreBreakdown: {
      safetyImportance,
      strategicImportance,
      proofSpeed,
      reversibility,
      costFit,
      timeFit,
      dependencyReadiness,
      leverageFit,
      projectionImpact,
      userCapabilityFit,
    },
    ruleHits,
  }
}

// ═══════════════════════════════════════
// 维度1: 安全重要性 (0–100)
// ═══════════════════════════════════════

function scoreSafety(stage, mission, safetyMonths, hits) {
  let score = 0
  const cat = mission.category

  if (cat === CAT.SAFETY_REPAIR) {
    if (safetyMonths < 2) {
      score = 100
      hits.push('PRIO_SAFETY_CRITICAL')
    } else if (safetyMonths < 4) {
      score = 85
      hits.push('PRIO_SAFETY_HIGH')
    } else {
      score = 60
    }
  } else if (cat === CAT.SECOND_INCOME_TEST) {
    if (safetyMonths < 6) {
      score = 70
      hits.push('PRIO_INCOME_NEED')
    } else {
      score = 40
    }
  } else {
    score = 30
  }

  // SURVIVAL 阶段放大安全权重
  if (stage === SURVIVAL && score > 0) {
    score = Math.min(100, score + 15)
  }

  return score
}

// ═══════════════════════════════════════
// 维度2: 战略重要性 (0–100)
// ═══════════════════════════════════════

function scoreStrategic(mission, strategy, hits) {
  const lever = (strategy.primaryStrategy
    && strategy.primaryStrategy.primaryLeverage
    && strategy.primaryStrategy.primaryLeverage.type) || ''
  const cat = mission.category

  // 直接关联主杠杆
  if (mission.linkedLeverage === lever) {
    hits.push('PRIO_LEVERAGE_MATCH')
    return 90
  }

  // 核心商业验证
  if (cat === CAT.SALES_VALIDATION || cat === CAT.MINIMUM_OFFER) {
    return 80
  }

  // 流程/资产建设
  if (cat === CAT.SOP_BUILD || cat === CAT.SERVICE_PRODUCTIZATION
    || cat === CAT.AUTOMATION_BUILD || cat === CAT.ASSET_BUILD) {
    return 70
  }

  // 基础能力
  if (cat === CAT.SKILL_INVENTORY || cat === CAT.CONTENT_SYSTEM
    || cat === CAT.AI_WORKFLOW) {
    return 55
  }

  // 审计与决策
  if (cat === CAT.TIME_AUDIT || cat === CAT.REVIEW_AND_DECIDE) {
    return 45
  }

  return 35
}

// ═══════════════════════════════════════
// 维度3: 验证速度 (0–100)
// ═══════════════════════════════════════

function scoreProofSpeed(mission, hits) {
  const cat = mission.category

  // 快速验证类
  if (cat === CAT.CUSTOMER_RESEARCH || cat === CAT.DISTRIBUTION_TEST) {
    hits.push('PRIO_FAST_PROOF')
    return 85
  }

  if (cat === CAT.SALES_VALIDATION || cat === CAT.MINIMUM_OFFER) {
    return 75
  }

  if (cat === CAT.SECOND_INCOME_TEST || cat === CAT.TIME_AUDIT) {
    return 65
  }

  // 中期建设
  if (cat === CAT.CONTENT_SYSTEM || cat === CAT.VALUE_PROPOSITION
    || cat === CAT.SAFETY_REPAIR) {
    return 50
  }

  // 长期建设
  if (cat === CAT.SOP_BUILD || cat === CAT.AUTOMATION_BUILD
    || cat === CAT.ASSET_BUILD || cat === CAT.DELEGATION_TEST) {
    return 30
  }

  return 40
}

// ═══════════════════════════════════════
// 维度4: 可逆性 (0–100)
// ═══════════════════════════════════════

function scoreReversibility(mission, hits) {
  const risk = mission.riskLevel

  if (risk === RISK_LEVELS.LOW) return 95
  if (risk === RISK_LEVELS.MEDIUM) return 55
  if (risk === RISK_LEVELS.HIGH) {
    hits.push('PRIO_HIGH_RISK_PENALTY')
    return 15
  }
  return 50
}

// ═══════════════════════════════════════
// 维度5: 成本适配 (0–100)
// ═══════════════════════════════════════

function scoreCostFit(stage, mission, hits) {
  const cost = mission.estimatedCostLevel

  if (cost === COST_LEVELS.NONE) return 95
  if (cost === COST_LEVELS.LOW) {
    if (stage === SURVIVAL) return 70
    return 80
  }
  if (cost === COST_LEVELS.MEDIUM) {
    if (stage === SURVIVAL) {
      hits.push('PRIO_MEDIUM_COST_SURVIVAL_PENALTY')
      return 15
    }
    return 50
  }
  return 50
}

// ═══════════════════════════════════════
// 维度6: 时间适配 (0–100)
// ═══════════════════════════════════════

function scoreTimeFit(profile, mission, hasFamily, readiness, hits) {
  const mins = mission.estimatedMinutes || 30
  const available = (profile.reality && profile.reality.availableHoursPerWeek) || 5
  const availableMinPerWeek = available * 60

  // 单任务不能超过总可用时间的 40%
  if (mins > availableMinPerWeek * 0.4) {
    hits.push('PRIO_TIME_OVERLOAD')
    return 10
  }

  let score = 80

  // 短任务加分
  if (mins <= 45) score += 10
  else if (mins <= 90) score += 5
  else if (mins > 180) score -= 15

  // 家庭责任扣分
  if (hasFamily) score -= 10

  // readiness 低 → 偏好短反馈任务
  if (readiness < 40) {
    if (mins > 120) score -= 20
    else if (mins <= 60) score += 10
  }

  return Math.max(0, Math.min(100, score))
}

// ═══════════════════════════════════════
// 维度7: 依赖就绪 (0–100)
// ═══════════════════════════════════════

function scoreDependencyReadiness(mission, caps, hits) {
  const prereqs = mission.prerequisites || []

  // 无依赖 → 高分
  if (prereqs.length === 0) return 85

  // 有依赖 → 偏低
  if (prereqs.length <= 2) return 60

  return 40
}

// ═══════════════════════════════════════
// 维度8: 杠杆匹配 (0–100)
// ═══════════════════════════════════════

function scoreLeverageFit(mission, strategy, hits) {
  const lever = (strategy.primaryStrategy
    && strategy.primaryStrategy.primaryLeverage
    && strategy.primaryStrategy.primaryLeverage.type) || ''
  const linked = mission.linkedLeverage || ''

  if (linked === lever) return 95

  // 同族杠杆
  const famMap = {
    AI_PRODUCTIVITY: [CAT.AI_WORKFLOW, CAT.AUTOMATION_BUILD, CAT.TIME_AUDIT],
    CONTENT_DISTRIBUTION: [CAT.CONTENT_SYSTEM, CAT.DISTRIBUTION_TEST],
    SALES_CONVERSION: [CAT.SALES_VALIDATION, CAT.MINIMUM_OFFER, CAT.VALUE_PROPOSITION],
    SERVICE_PRODUCTIZATION: [CAT.SERVICE_PRODUCTIZATION, CAT.CUSTOMER_RESEARCH, CAT.SOP_BUILD],
    AUTOMATION_SYSTEM: [CAT.AUTOMATION_BUILD, CAT.SOP_BUILD, CAT.DELEGATION_TEST],
    KNOWLEDGE_PRODUCT: [CAT.CONTENT_SYSTEM, CAT.VALUE_PROPOSITION],
    TEAM_CAPITAL: [CAT.DELEGATION_TEST, CAT.SOP_BUILD],
    ASSET_COMPOUNDING: [CAT.ASSET_BUILD, CAT.AUTOMATION_BUILD],
  }

  const fam = famMap[lever] || []
  if (fam.includes(mission.category)) {
    hits.push('PRIO_LEVERAGE_FAMILY')
    return 70
  }

  return 30
}

// ═══════════════════════════════════════
// 维度9: 推演影响 (0–100)
// ═══════════════════════════════════════

function scoreProjectionImpact(mission, projection, hits) {
  const nodes = (projection && projection.decisionNodes) || []
  const cat = mission.category

  // 有决策节点 → 高置信
  if (nodes.length >= 3) return 60

  // 核心验证类影响最大
  if (cat === CAT.SALES_VALIDATION || cat === CAT.SECOND_INCOME_TEST) return 75
  if (cat === CAT.CUSTOMER_RESEARCH || cat === CAT.DISTRIBUTION_TEST) return 65
  if (cat === CAT.MINIMUM_OFFER || cat === CAT.VALUE_PROPOSITION) return 60
  if (cat === CAT.REVIEW_AND_DECIDE) return 50

  return 40
}

// ═══════════════════════════════════════
// 维度10: 用户能力匹配 (0–100)
// ═══════════════════════════════════════

function scoreUserCapabilityFit(mission, caps, hits) {
  const diff = mission.difficulty

  if (diff === DIFFICULTY_LEVELS.EASY) return 90
  if (diff === DIFFICULTY_LEVELS.MODERATE) {
    // 检查执行能力
    if (caps.execution < 40) {
      hits.push('PRIO_LOW_EXECUTION_MODERATE')
      return 55
    }
    return 70
  }
  if (diff === DIFFICULTY_LEVELS.HARD) {
    if (caps.execution < 50) {
      hits.push('PRIO_LOW_EXECUTION_HARD')
      return 20
    }
    return 50
  }
  return 50
}

// ═══════════════════════════════════════
// 硬约束修正
// ═══════════════════════════════════════

function applyHardConstraints(mission, stage, score, hits) {
  let s = score
  const cat = mission.category

  // SAFETY_REPAIR 在 SURVIVAL 中不可被降权太低
  if (cat === CAT.SAFETY_REPAIR && stage === SURVIVAL && s < 75) {
    s = 75
    hits.push('PRIO_HARD_SAFETY_FLOOR')
  }

  // CUSTOMER_RESEARCH 应在完整产品前
  if (cat === CAT.CUSTOMER_RESEARCH && s < 50 && stage !== SURVIVAL) {
    s = 50
    hits.push('PRIO_HARD_RESEARCH_FLOOR')
  }

  // MEDIUM 成本在 SURVIVAL 中强降权
  if (mission.estimatedCostLevel === COST_LEVELS.MEDIUM && stage === SURVIVAL) {
    s = Math.min(s, 30)
    hits.push('PRIO_HARD_MEDIUM_COST_SURVIVAL')
  }

  // HIGH 风险在 SURVIVAL 中强降权
  if (mission.riskLevel === RISK_LEVELS.HIGH && stage === SURVIVAL) {
    s = Math.min(s, 20)
    hits.push('PRIO_HARD_HIGH_RISK_SURVIVAL')
  }

  return Math.max(0, Math.min(100, Math.round(s)))
}

module.exports = {
  scoreMissionPriority,
}
