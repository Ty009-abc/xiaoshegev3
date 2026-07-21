/**
 * core/turnaround-os/engines/identityEngineV6.js
 *
 * V6 身份引擎：从用户输入构建统一翻身画像
 * 纯规则引擎，不接AI
 *
 * @version 6.0.0
 */

const { normalize } = require('../schemas/identityProfileV6')
const {
  WEALTH_STAGES,
  WEALTH_STAGE_LABELS,
  STAGE_THRESHOLDS,
  SCORE_RANGE,
} = require('../constants')
const { weightedSum } = require('../utils/score')

/**
 * buildIdentity — 从用户原始输入构建完整画像
 *
 * @param {Object} input — 用户回答数据
 * @returns {Object} 清洗后的 identityProfileV6
 */
function buildIdentity(input) {
  // 先清洗
  const profile = normalize(input)

  // 阶段判断
  const stageResult = determineStage(profile)
  profile.wealthStage = stageResult.stage
  profile.wealthStageLabel = stageResult.label
  profile.stageReason = stageResult.reason
  profile.nextStageRequirement = stageResult.nextRequirement

  // 能力综合评分
  profile.capabilityScore = calculateCapabilityScore(profile.capabilities)

  // 心理评分
  profile.psychologyScore = calculatePsychologyScore(profile.psychology)

  // 资产评分
  profile.assetScore = calculateAssetScore(profile.assets)

  // 约束评分（越高约束越少）
  profile.freedomScore = calculateFreedomScore(profile.constraints, profile.reality)

  // 综合翻身准备度
  profile.strategyReadinessScore = calculateReadinessScore(profile)

  // evidence 增强
  profile.evidence.ruleHits.push(...(stageResult.ruleHits || []))
  profile.evidence.confidence = Math.min(85, profile.evidence.confidence + stageResult.confidence || 50)

  return profile
}

/**
 * determineStage — 判断用户所处阶段
 *
 * 阶段判断权重优先级：
 * P1 生存安全 > P2 可执行条件 > P3 可利用资产 > P4 可复制能力
 */
function determineStage(profile) {
  const { reality, capabilities, assets } = profile
  const ruleHits = []
  let confidence = 0

  // ═══ P1: 生存安全检查 ═══
  const safetyMonths = reality.safetyMonths || 0
  const debtToIncomeRatio = reality.monthlyIncome > 0
    ? (reality.debt || 0) / (reality.monthlyIncome * 12)
    : (reality.debt > 0 ? 999 : 0)
  const incomeStability = reality.incomeStability || 0

  // 生存判断
  if (safetyMonths < 1) {
    ruleHits.push('RULE_STAGE_SURVIVAL_NO_SAFETY')
    return stageResult(WEALTH_STAGES.SURVIVAL, ruleHits, 95, '现金流安全月数不足1个月，处于生存紧急状态',
      `安全月数达到${STAGE_THRESHOLDS.SURVIVAL_TO_STABILITY.minSafetyMonths}个月，收入稳定性达到${STAGE_THRESHOLDS.SURVIVAL_TO_STABILITY.minIncomeStability}分`)
  }

  if (debtToIncomeRatio > 1.0) {
    ruleHits.push('RULE_STAGE_SURVIVAL_HIGH_DEBT')
    return stageResult(WEALTH_STAGES.SURVIVAL, ruleHits, 90,
      '债务超过年收入，财务结构已进入危险区',
      `债务/年收入比降至${STAGE_THRESHOLDS.SURVIVAL_TO_STABILITY.maxDebtToIncomeRatio}以下`)
  }

  if (safetyMonths < STAGE_THRESHOLDS.SURVIVAL_TO_STABILITY.minSafetyMonths) {
    ruleHits.push('RULE_STAGE_SURVIVAL_LOW_SAFETY')
    return stageResult(WEALTH_STAGES.SURVIVAL, ruleHits, 85,
      `现金流安全月数${safetyMonths}个月，低于生存底线${STAGE_THRESHOLDS.SURVIVAL_TO_STABILITY.minSafetyMonths}个月`,
      `安全月数达到${STAGE_THRESHOLDS.SURVIVAL_TO_STABILITY.minSafetyMonths}个月`)
  }

  if (incomeStability < STAGE_THRESHOLDS.SURVIVAL_TO_STABILITY.minIncomeStability) {
    ruleHits.push('RULE_STAGE_SURVIVAL_UNSTABLE_INCOME')
    return stageResult(WEALTH_STAGES.SURVIVAL, ruleHits, 80,
      `收入稳定性${incomeStability}分，现金流不稳定是核心风险`,
      `收入稳定性达到${STAGE_THRESHOLDS.SURVIVAL_TO_STABILITY.minIncomeStability}分`)
  }

  // ═══ 稳定性判断 ═══
  const hasSecondary = assets.reusableAssets && assets.reusableAssets.length > 0
  const disposableHours = reality.availableHoursPerWeek || 0
  const execution = capabilities.execution || 0

  if (safetyMonths < STAGE_THRESHOLDS.STABILITY_TO_LEVERAGE.minSafetyMonths) {
    ruleHits.push('RULE_STAGE_STABILITY_INSUFFICIENT_BUFFER')
    return stageResult(WEALTH_STAGES.STABILITY, ruleHits, 70,
      `安全月数${safetyMonths}个月，仍需继续积累`,
      `安全月数达到${STAGE_THRESHOLDS.STABILITY_TO_LEVERAGE.minSafetyMonths}个月，且每周可支配时间>=${STAGE_THRESHOLDS.STABILITY_TO_LEVERAGE.minDisposableHoursPerWeek}小时`)
  }

  if (disposableHours < STAGE_THRESHOLDS.STABILITY_TO_LEVERAGE.minDisposableHoursPerWeek) {
    ruleHits.push('RULE_STAGE_STABILITY_NO_TIME')
    return stageResult(WEALTH_STAGES.STABILITY, ruleHits, 65,
      `可支配时间${disposableHours}小时/周，没有建立杠杆的时间基础`,
      `可支配时间达到${STAGE_THRESHOLDS.STABILITY_TO_LEVERAGE.minDisposableHoursPerWeek}小时/周`)
  }

  if (execution < STAGE_THRESHOLDS.STABILITY_TO_LEVERAGE.minExecution) {
    ruleHits.push('RULE_STAGE_STABILITY_LOW_EXECUTION')
    return stageResult(WEALTH_STAGES.STABILITY, ruleHits, 60,
      `执行能力${execution}分，需要先通过小任务建立执行惯性`,
      `执行能力达到${STAGE_THRESHOLDS.STABILITY_TO_LEVERAGE.minExecution}分`)
  }

  // ═══ 杠杆判断 ═══
  const reusableCount = (assets.reusableAssets || []).length
  const systemThinking = capabilities.systemThinking || 0

  if (reusableCount < STAGE_THRESHOLDS.LEVERAGE_TO_SYSTEM.minReusableAssets && !hasSecondary) {
    ruleHits.push('RULE_STAGE_LEVERAGE_NO_ASSETS')
    return stageResult(WEALTH_STAGES.LEVERAGE, ruleHits, 55,
      '已有安全垫和可执行时间，但尚未建立可重复使用资产',
      `拥有至少${STAGE_THRESHOLDS.LEVERAGE_TO_SYSTEM.minReusableAssets}个可重复使用资产`)
  }

  if (systemThinking < STAGE_THRESHOLDS.LEVERAGE_TO_SYSTEM.minSystemThinking) {
    ruleHits.push('RULE_STAGE_LEVERAGE_NO_SYSTEM_THINKING')
    return stageResult(WEALTH_STAGES.LEVERAGE, ruleHits, 50,
      `系统化思维${systemThinking}分，需要从"做事"转变为"建系统"`,
      `系统化思维达到${STAGE_THRESHOLDS.LEVERAGE_TO_SYSTEM.minSystemThinking}分`)
  }

  // ═══ 系统/复利判断 ═══
  if (reusableCount < STAGE_THRESHOLDS.SYSTEM_TO_COMPOUNDING.minReusableAssets) {
    ruleHits.push('RULE_STAGE_SYSTEM_BUILDING')
    return stageResult(WEALTH_STAGES.SYSTEM, ruleHits, 40,
      `已建立${reusableCount}个可重复使用资产，正在系统化`,
      `拥有至少${STAGE_THRESHOLDS.SYSTEM_TO_COMPOUNDING.minReusableAssets}个可重复使用资产并具备团队`
    )
  }

  // 复利阶段
  ruleHits.push('RULE_STAGE_COMPOUNDING')
  return stageResult(WEALTH_STAGES.COMPOUNDING, ruleHits, 30,
    '资产、系统和团队正在产生复利效应',
    '保持当前增长节奏')
}

function stageResult(stage, ruleHits, confidence, reason, nextRequirement) {
  return {
    stage,
    label: WEALTH_STAGE_LABELS[stage],
    reason,
    nextRequirement,
    ruleHits,
    confidence,
  }
}

/**
 * 能力综合评分
 */
function calculateCapabilityScore(caps) {
  return weightedSum(caps, {
    execution: 0.25,
    learning: 0.15,
    communication: 0.10,
    sales: 0.15,
    content: 0.10,
    aiAdaptability: 0.10,
    systemThinking: 0.10,
    discipline: 0.05,
  })
}

/**
 * 心理综合评分
 */
function calculatePsychologyScore(psych) {
  // 正向指标（越高越好）
  const positive = weightedSum(psych, {
    riskTolerance: 0.15,
    desire: 0.20,
    patience: 0.25,
    selfAwareness: 0.30,
  })
  // 负向指标（越高越差）
  const negative = weightedSum(psych, {
    anxiety: 0.25,
    externalAttribution: 0.25,
  })
  return Math.max(0, Math.min(100, positive - Math.round(negative * 0.5)))
}

/**
 * 资产综合评分
 */
function calculateAssetScore(assets) {
  let score = 0
  if (assets.skills && assets.skills.length > 0) score += Math.min(20, assets.skills.length * 5)
  if (assets.experiences && assets.experiences.length > 0) score += Math.min(15, assets.experiences.length * 5)
  if (assets.resources && assets.resources.length > 0) score += Math.min(15, assets.resources.length * 5)
  if (assets.audience && assets.audience.length > 0) score += Math.min(20, assets.audience.length * 10)
  if (assets.credentials && assets.credentials.length > 0) score += Math.min(15, assets.credentials.length * 5)
  if (assets.reusableAssets && assets.reusableAssets.length > 0) score += Math.min(15, assets.reusableAssets.length * 10)
  return Math.min(100, score)
}

/**
 * 自由度评分
 */
function calculateFreedomScore(constraints, reality) {
  let score = 100

  // 压力扣分
  if (constraints.familyPressure && constraints.familyPressure.length > 0) score -= constraints.familyPressure.length * 5
  if (constraints.cashflowPressure && constraints.cashflowPressure.length > 0) score -= constraints.cashflowPressure.length * 8
  if (constraints.timePressure && constraints.timePressure.length > 0) score -= constraints.timePressure.length * 6
  if (constraints.healthPressure && constraints.healthPressure.length > 0) score -= constraints.healthPressure.length * 7
  if (constraints.geographicPressure && constraints.geographicPressure.length > 0) score -= constraints.geographicPressure.length * 3
  if (constraints.psychologicalPressure && constraints.psychologicalPressure.length > 0) score -= constraints.psychologicalPressure.length * 5

  // 时间加分
  const hours = reality.availableHoursPerWeek || 0
  if (hours >= 20) score += 10
  else if (hours >= 10) score += 5

  return Math.max(0, Math.min(100, score))
}

/**
 * 翻身准备度 — 综合多个维度
 */
function calculateReadinessScore(profile) {
  const { reality, capabilities, psychology, assets, constraints, wealthStage } = profile

  const safetyMonths = reality.safetyMonths || 0

  // 生存权重（P1 最高）
  const survivalScore = Math.min(100, safetyMonths * 10 + (reality.incomeStability || 0) * 0.5)
  const survivalWeight = wealthStage === WEALTH_STAGES.SURVIVAL ? 0.50 : 0.20

  // 能力权重（P2）
  const capScore = calculateCapabilityScore(capabilities)
  const capWeight = 0.25

  // 心理权重（P2）
  const psychScore = calculatePsychologyScore(psychology)
  const psychWeight = 0.15

  // 资产权重（P3）
  const assetScore = calculateAssetScore(assets)
  const assetWeight = 0.15

  // 自由权重（P4）
  const freeScore = calculateFreedomScore(constraints, reality)
  const freeWeight = 0.15

  return clamp(
    survivalScore * survivalWeight +
    capScore * capWeight +
    psychScore * psychWeight +
    assetScore * assetWeight +
    freeScore * freeWeight
  )
}

function clamp(value) {
  return Math.max(SCORE_RANGE.MIN, Math.min(SCORE_RANGE.MAX, Math.round(value || 0)))
}

module.exports = {
  buildIdentity,
  determineStage,
  calculateCapabilityScore,
  calculatePsychologyScore,
  calculateAssetScore,
  calculateFreedomScore,
  calculateReadinessScore,
}
