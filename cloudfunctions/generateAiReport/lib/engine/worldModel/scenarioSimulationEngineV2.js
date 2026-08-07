/**
 * engine/worldModel/scenarioSimulationEngineV2.js
 *
 * Deterministic scenario simulation from world model dimensions,
 * cognitive blind spot, and strategy.
 *
 * CRITICAL RULES:
 * - NO income predictions
 * - NO success/failure predictions
 * - NO fate/destiny language
 * - NO precise probability claims
 * - All outcomes use conditional language
 * - Must acknowledge external factors (market, environment, luck)
 *
 * @version world_model_v1
 */

const { SCENARIO_FRAMEWORK, DIMENSION_SCENARIO_PATTERNS } = require('./scenarioDefinitions')
const { PROHIBITED_EXPRESSIONS } = require('./contracts')

// ═══════════════════════════════════════════════════════════════
// Main engine
// ═══════════════════════════════════════════════════════════════

function simulateScenarios(blindSpot, strategy, worldModel) {
  if (!blindSpot || !blindSpot.id) {
    return buildEmptyScenarios()
  }

  // Determine the primary dimension to simulate
  var primaryDim = getPrimaryDimensionForBlindSpot(blindSpot.id)
  var dimData = worldModel[primaryDim]
  var dimPatterns = DIMENSION_SCENARIO_PATTERNS[primaryDim]

  if (!dimPatterns) {
    return buildEmptyScenarios()
  }

  // Build CURRENT_MODEL_CONTINUES scenario
  var currentScenario = buildCurrentModelScenario(dimPatterns, dimData, blindSpot)

  // Build WORLD_MODEL_UPGRADED scenario
  var upgradedScenario = buildUpgradedModelScenario(dimPatterns, dimData, strategy, primaryDim)

  return {
    currentModelScenario: currentScenario,
    upgradedModelScenario: upgradedScenario,
  }
}

// ═══════════════════════════════════════════════════════════════
// Scenario builders
// ═══════════════════════════════════════════════════════════════

function buildCurrentModelScenario(dimPatterns, dimData, blindSpot) {
  var currentP = dimPatterns.currentPattern

  return {
    assumptions: [
      '用户继续保持当前的认知模式，不做有意识的认知升级。',
      '决策方式、风险感知、反馈处理模式与当前一致。',
      '外部环境和个人条件不发生剧烈变化。',
    ],
    likelyDecisionPattern: currentP.patterns.map(adaptPattern),
    possibleConsequences: buildCurrentConsequences(blindSpot),
    uncertainty: [
      '结果受市场环境、执行质量和不可控因素的多重影响。',
      '个人的主动学习能力可能自发改变部分模式。',
      '以上仅为基于当前认知模式的推演，不构成确定性预测。',
    ],
  }
}

function buildUpgradedModelScenario(dimPatterns, dimData, strategy, primaryDim) {
  var upgradedP = dimPatterns.upgradedPattern

  return {
    changedVariable: primaryDim
      ? '认知升级维度：' + primaryDim + '（从当前模式向更功能性的认知模式转变）'
      : '认知升级维度：基于诊断的核心认知维度',
    assumptions: [
      '用户主动采用策略进行认知系统升级。',
      '升级过程需要持续实践和外部反馈。',
      '认知模型的改变需要时间，不会一夜之间完成。',
    ],
    likelyDecisionPattern: upgradedP.patterns.map(adaptPattern),
    possibleConsequences: buildUpgradedConsequences(strategy),
    observableSignals: [
      '用户能够描述在特定场景下做出的与以往不同的决策。',
      '外部反馈的频率和质量有所提升。',
      '面对不确定性的反应从回避变为小步实验。',
    ],
    uncertainty: [
      '认知升级的实际效果取决于执行的一致性和外部环境的配合。',
      '不同个体的升级速度和程度存在显著差异。',
      '这不保证任何特定结果，但会改变可用的决策选项范围。',
    ],
  }
}

// ═══════════════════════════════════════════════════════════════
// Consequence builders — conditional, non-predictive
// ═══════════════════════════════════════════════════════════════

function buildCurrentConsequences(blindSpot) {
  var map = {
    OPPORTUNITY_BLINDNESS: [
      '在当前的认知模式下，可能会持续忽视或低估某些类型的可能性。',
      '对机会的判断可能更多依赖已有经验，而非对新兴可能性的敏感度。',
      '在面临多个选项时，可能倾向于选择最熟悉而非最有潜力的方向。',
    ],
    FEEDBACK_LOOP_GAP: [
      '在当前的反馈模式下，行动和结果之间的因果关系可能不够清晰。',
      '同一个策略可能被反复使用而没有实质性的调整，因为缺乏有效的外部校准。',
      '知识增长可能主要来自理论而非实践检验。',
    ],
    DECISION_INERTIA: [
      '在当前的决策模式下，可能倾向于等待更多信息而非在不确定中行动。',
      '可能反复修改计划而迟迟不执行，导致行动和反馈之间的时间间隔过长。',
      '重要决策可能被推迟到"更好的时机"，但理想时机往往不会自行出现。',
    ],
    RISK_MODEL_DISTORTION: [
      '在当前的风险模式下，风险判断可能系统性偏离实际概率。',
      '可能高估某些风险的严重性而低估其他风险，导致资源的不均衡分配。',
      '对"安全"选择的偏好可能导致机会成本累积。',
    ],
    PROBABILITY_MISJUDGMENT: [
      '在当前的思维模式下，可能用成败二元的眼光评估复杂得多因素系统。',
      '对成功的判断可能受到个别高调案例的影响，而忽视基础概率。',
      '可能高估小概率高回报事件的发生可能性。',
    ],
    IDENTITY_CONSTRAINT: [
      '在当前的认知下，身份边界可能限制探索的范围和深度。',
      '可能倾向于选择与现有身份一致的路径，而非最能发挥潜力的方向。',
      '自我认知的更新速度可能落后于外部环境的变化速度。',
    ],
    LEVERAGE_MODEL_GAP: [
      '在当前的杠杆模式下，产出的增长可能高度依赖投入的时间。',
      '可能存在"更努力=更好结果"的线性假设，而忽视放大效应。',
      '可能用个人精力替代系统和流程，导致增长碰到个人能力的天花板。',
    ],
    SYSTEM_THINKING_GAP: [
      '在当前的思维模式下，可能将反复出现的问题当作独立事件处理。',
      '对系统层面的解决方案关注可能少于对症状的处理。',
      '今天的"解决"可能在明天以另一种形式重新出现。',
    ],
    TIME_HORIZON_TRAP: [
      '在当前的时间模式下，紧急事务可能持续挤压重要事务的空间。',
      '长期目标的进展可能被日常紧迫需求一再推迟。',
      '短期优化的行为可能累积成长期的次优路径。',
    ],
  }

  return map[blindSpot.id] || [
    '当前的认知模式可能导致某些维度的持久低效。',
    '在没有意识干预的情况下，模式倾向于自我强化而非自动修正。',
    '外部环境的变化可能需要认知升级来适应，而停留当前模式可能导致适应滞后。',
  ]
}

function buildUpgradedConsequences(strategy) {
  // These are CONDITIONAL statements — not predictions
  if (!strategy) {
    return [
      '如果能在盲区维度进行认知升级，决策的空间和选项会扩大。',
      '可观察的早期变化通常表现为决策模式的微调和反馈质量的提升。',
    ]
  }

  return [
    '如果能在该维度进行认知升级，新的决策选项会变得更加可用。',
    '当新的认知模式逐渐取代旧模式时，重复出现的困境可能以不同的方式被处理。',
    '这不保证任何特定结果，但会影响在面对同样情况时做出的选择和产生的路径。',
  ]
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function adaptPattern(pattern) {
  // Ensure patterns use conditional language, not deterministic
  if (pattern.indexOf('会') >= 0 && pattern.indexOf('可能') < 0 && pattern.indexOf('条件') < 0) {
    return pattern.replace('会', '可能会')
  }
  return pattern
}

function getPrimaryDimensionForBlindSpot(blindSpotId) {
  var map = {
    OPPORTUNITY_BLINDNESS: 'OPPORTUNITY_MODEL',
    FEEDBACK_LOOP_GAP: 'FEEDBACK_MODEL',
    DECISION_INERTIA: 'DECISION_MODEL',
    RISK_MODEL_DISTORTION: 'RISK_MODEL',
    PROBABILITY_MISJUDGMENT: 'PROBABILITY_MODEL',
    IDENTITY_CONSTRAINT: 'IDENTITY_MODEL',
    LEVERAGE_MODEL_GAP: 'LEVERAGE_MODEL',
    SYSTEM_THINKING_GAP: 'DECISION_MODEL',
    TIME_HORIZON_TRAP: 'TIME_MODEL',
  }
  return map[blindSpotId] || 'FEEDBACK_MODEL'
}

function buildEmptyScenarios() {
  return {
    currentModelScenario: {
      assumptions: ['数据不足，无法生成有效的当前情景分析。'],
      likelyDecisionPattern: [],
      possibleConsequences: [],
      uncertainty: ['需要更多诊断数据来进行情景推演。'],
    },
    upgradedModelScenario: {
      changedVariable: '未知',
      assumptions: ['数据不足，无法生成有效的升级情景分析。'],
      likelyDecisionPattern: [],
      possibleConsequences: [],
      observableSignals: [],
      uncertainty: ['需要更多诊断数据来进行情景推演。'],
    },
  }
}

module.exports = {
  simulateScenarios,
}
