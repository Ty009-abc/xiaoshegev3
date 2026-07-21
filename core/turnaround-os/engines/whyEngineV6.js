/**
 * core/turnaround-os/engines/whyEngineV6.js
 *
 * V6 Why Engine — 因果解释引擎
 *
 * 每一个推演结果都必须能回答：
 * 1. 为什么会得到这个结果？
 * 2. 命中了哪些规则？
 * 3. 哪些用户信息支撑了这个结论？
 * 4. 哪些假设成立时结论才成立？
 * 5. 哪些条件变化会导致推演改变？
 *
 * @version 6.0.0
 */

const { createWhyResult } = require('../contracts/destinyProjectionContractV6')

/**
 * explain — 为一条推演结论生成因果解释
 *
 * @param {Object} params
 * @param {string} params.conclusion - 推演结论
 * @param {string} params.ruleId - 命中规则 ID
 * @param {string[]} params.sourceFields - 依赖的数据字段
 * @param {string[]} params.sourceValues - 源数据的值
 * @param {string[]} params.assumptions - 假设列表
 * @param {string} params.conditions - 条件成立才成立
 * @returns {Object} whyResult
 */
function explain(params = {}) {
  return createWhyResult(params)
}

/**
 * explainTrend — 解释趋势变化
 *
 * @param {string} tag - 趋势标签，如 "incomeTrend"
 * @param {string} direction - 变化方向 "改善"/"停滞"/"下降"
 * @param {Object} profile - 用户画像
 * @param {Object} context - 额外上下文
 * @returns {Object} whyResult
 */
function explainTrend(tag, direction, profile, context = {}) {
  const rules = context.trendRules || []
  const rule = rules.find(r => r.tag === tag && r.direction === direction) || {}

  const sourceFields = []
  const sourceValues = []

  // 从 profile 中提取相关的源数据
  if (profile.reality) {
    if (tag.includes('income')) {
      sourceFields.push('reality.monthlyIncome', 'reality.incomeStability')
      sourceValues.push(`${profile.reality.monthlyIncome}`, `${profile.reality.incomeStability}`)
    }
    if (tag.includes('cashflow') || tag.includes('safety')) {
      sourceFields.push('reality.safetyMonths', 'reality.debt')
      sourceValues.push(`${profile.reality.safetyMonths}`, `${profile.reality.debt}`)
    }
  }
  if (profile.capabilities) {
    if (tag.includes('execution')) {
      sourceFields.push('capabilities.execution')
      sourceValues.push(`${profile.capabilities.execution}`)
    }
  }

  return explain({
    conclusion: `${tag} → ${direction}`,
    ruleId: rule.ruleId || `RULE_TREND_${tag.toUpperCase()}_${direction.toUpperCase()}`,
    sourceFields: rule.sourceFields || sourceFields,
    sourceValues: rule.sourceValues || sourceValues,
    assumptions: rule.assumptions || context.assumptions || [],
    conditions: rule.conditions || tag,
  })
}

/**
 * explainBatch — 批量解释多个趋势
 *
 * @param {Object} snapshot - 世界快照
 * @param {Object} profile - 画像
 * @param {Object} context - 上下文
 * @returns {Object[]} whyResults 数组
 */
function explainBatch(snapshot, profile, context = {}) {
  const results = []
  const trendKeys = [
    'status', 'incomeTrend', 'cashflowTrend', 'assetTrend',
    'freedomTrend', 'stressTrend', 'careerTrend', 'riskTrend',
  ]

  for (const key of trendKeys) {
    if (snapshot[key]) {
      results.push(explainTrend(key, snapshot[key], profile, context))
    }
  }

  return results
}

/**
 * explainComparison — 解释两条路径的巨大差异原因
 *
 * @param {Object} comparison - 对比
 * @param {Object} profile - 画像
 * @param {Object} strategy - 战略
 * @returns {Object[]} whyResults
 */
function explainComparison(comparison, profile, strategy) {
  const results = []

  if (comparison.biggestGap) {
    results.push(explain({
      conclusion: comparison.biggestGap,
      ruleId: 'RULE_COMPARE_BIGGEST_GAP',
      sourceFields: ['wrongGame.type', 'primaryLeverage.type'],
      sourceValues: [
        strategy.wrongGame && strategy.wrongGame.type || '',
        strategy.primaryStrategy && strategy.primaryStrategy.primaryLeverage && strategy.primaryStrategy.primaryLeverage.type || '',
      ],
      assumptions: ['用户执行了推荐战略', '外部环境无重大变化'],
      conditions: 'biggestGap',
    }))
  }

  if (comparison.biggestOpportunity) {
    results.push(explain({
      conclusion: comparison.biggestOpportunity,
      ruleId: 'RULE_COMPARE_BIGGEST_OPPORTUNITY',
      sourceFields: ['potential.primaryOpportunity', 'primaryLeverage.type'],
      sourceValues: [
        profile.potential && profile.potential.primaryOpportunity || '',
        strategy.primaryStrategy && strategy.primaryStrategy.primaryLeverage && strategy.primaryStrategy.primaryLeverage.type || '',
      ],
      assumptions: ['市场条件支持杠杆方向'],
      conditions: 'biggestOpportunity',
    }))
  }

  return results
}

/**
 * explainDecisionNode — 解释决策节点
 *
 * @param {Object} node - 决策节点
 * @param {Object} profile - 画像
 * @returns {Object} whyResult
 */
function explainDecisionNode(node, profile) {
  return explain({
    conclusion: node.node,
    ruleId: 'RULE_DECISION_NODE_' + node.node.replace(/\s/g, '_').toUpperCase(),
    sourceFields: ['wealthStage', 'strategyReadinessScore'],
    sourceValues: [profile.wealthStage || '', `${profile.strategyReadinessScore}`],
    assumptions: ['用户在该节点做出正确选择'],
    conditions: `${node.trigger} 发生时`,
  })
}

module.exports = {
  explain,
  explainTrend,
  explainBatch,
  explainComparison,
  explainDecisionNode,
}
