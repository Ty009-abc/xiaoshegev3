/**
 * core/turnaround-os/engines/destinyProjectionEngineV6.js
 *
 * V6 Destiny Projection Engine — 命运推演引擎
 *
 * 输入：用户画像 + 战略结果 + 杠杆结果
 * 输出：World A / World B / Comparison / DecisionNodes
 *
 * @version 6.0.0
 */

const { createDefault } = require('../contracts/destinyProjectionContractV6')
const { simulateWorldA } = require('../simulators/worldASimulator')
const { simulateWorldB } = require('../simulators/worldBSimulator')
const { explainComparison, explainDecisionNode } = require('./whyEngineV6')

/**
 * projectDestiny — 双路径命运推演
 *
 * @param {Object} profile — identityEngine 输出
 * @param {Object} wrongGameResult — wrongGameEngine 输出
 * @param {Object} strategy — turnaroundEngine 输出
 * @param {Object} leverageResult — leverageEngine 输出
 * @returns {Object} 完整命运推演
 */
function projectDestiny(profile, wrongGameResult, strategy, leverageResult) {
  const projection = createDefault()

  // World A — 维持现状
  projection.worldA = simulateWorldA(profile, wrongGameResult)

  // World B — 执行翻身战略
  projection.worldB = simulateWorldB(profile, strategy, leverageResult)

  // Comparison — 双路径对比
  projection.comparison = buildComparison(profile, wrongGameResult, strategy, projection)

  // Decision Nodes — 决策节点
  projection.decisionNodes = buildDecisionNodes(profile, wrongGameResult, strategy, leverageResult)

  // Summary metadata
  projection.projectionConfidence = calculateProjectionConfidence(profile, wrongGameResult, strategy)
  projection.assumptions = buildProjectionAssumptions(profile, wrongGameResult, strategy)
  projection.limitingFactors = buildLimitingFactors(profile, strategy)

  return projection
}

/**
 * buildComparison — 双路径对比
 */
function buildComparison(profile, wrongGameResult, strategy, projection) {
  const game = wrongGameResult && wrongGameResult.primaryWrongGame
    ? wrongGameResult.primaryWrongGame.gameType
    : null
  const lever = strategy && strategy.primaryStrategy && strategy.primaryStrategy.primaryLeverage
    ? strategy.primaryStrategy.primaryLeverage.type
    : null

  const largestGapDimension = findLargestGap(projection)
  const irreversibleRisk = findIrreversibleRisk(game, profile)

  return {
    biggestGap: describeGap(largestGapDimension, lever, strategy),
    biggestRisk: findBiggestRisk(game, profile),
    biggestOpportunity: describeOpportunity(lever, strategy),
    mostWorthChanging: findMostWorthChanging(game, lever, strategy),
    forkPoint: describeForkPoint(game, lever),
    irreversibleRisk,
    summary: buildComparisonSummary(profile, wrongGameResult, strategy, projection),
  }
}

/**
 * findLargestGap — 找 World A vs World B 差距最大的维度
 */
function findLargestGap(projection) {
  const a = projection.worldA.year3
  const b = projection.worldB.year3

  const trendScore = { '明显下降': -2, '下降': -1, '停滞': 0, '缓慢改善': 1, '改善': 2, '明显改善': 3, '结构性改善': 4 }

  const dims = ['incomeTrend', 'cashflowTrend', 'assetTrend', 'freedomTrend', 'stressTrend']
  let maxGap = 0
  let maxDim = 'overallTrajectory'

  for (const dim of dims) {
    const aScore = trendScore[a[dim]] || 0
    const bScore = trendScore[b[dim]] || 0
    const gap = bScore - aScore
    if (gap > maxGap) {
      maxGap = gap
      maxDim = dim
    }
  }

  return maxDim
}

/**
 * describeGap
 */
function describeGap(dimension, lever, strategy) {
  const labels = {
    incomeTrend: '收入结构是两条路径差异最大的地方',
    cashflowTrend: '现金流安全性是分叉最明显的地方',
    assetTrend: '可复制资产的积累是两条路径的核心差异',
    freedomTrend: '时间自由度是差距最大的维度',
    stressTrend: '心理压力和焦虑水平是变化最直观的地方',
  }

  return labels[dimension] || `在${dimension}维度上，执行翻身战略将产生结构性的改善`
}

/**
 * findBiggestRisk
 */
function findBiggestRisk(game, profile) {
  if (!game || game === 'UNKNOWN_GAME') {
    return '最大的风险是维持现状——没有错但也没有进展，时间是你最宝贵的不可再生资源'
  }

  const riskMap = {
    SELLING_TIME: '最大的风险是随着年龄增长，出售时间的竞争力持续下降，而你没有建立任何对冲',
    SINGLE_INCOME: '最大的风险是单一收入来源的脆弱性：一次裁员、一次行业波动，就可能导致全面崩塌',
    OPPORTUNITY_CHASING: '最大的风险是持续消耗唯一不可再生的资源——时间，每个新方向都从零开始',
    SKILL_WITHOUT_DISTRIBUTION: '最大的风险是你的核心能力对市场完全隐形，越强反而越痛苦',
    CONTENT_WITHOUT_MONETIZATION: '最大的风险是内容资产在贬值但你没有把它转化为可消费的价值',
    BUSINESS_WITHOUT_SYSTEM: '最大的风险是生意的增长唯一依赖你本人，你的健康就是业务的上限',
  }

  return riskMap[game] || '最大风险是维持现有模式继续消耗时间和机会'
}

/**
 * describeOpportunity
 */
function describeOpportunity(lever, strategy) {
  if (!lever) return '执行翻身战略本身就是最大的机会'

  const oppMap = {
    AI_PRODUCTIVITY: '最大的机会是利用AI工具释放时间，用释放出来的时间建立资产',
    CONTENT_DISTRIBUTION: '最大的机会是让市场看见你——你的能力不再隐形',
    SALES_CONVERSION: '最大的机会是把现有资源和受众转化为可持续的收入流',
    KNOWLEDGE_PRODUCT: '最大的机会是把你的经验和能力变成可以重复销售的产品',
    SERVICE_PRODUCTIZATION: '最大的机会是把个人时间从收入方程式中逐渐移出',
    AUTOMATION_SYSTEM: '最大的机会是让系统替你工作，你的角色从执行者变为设计者',
    TEAM_CAPITAL: '最大的机会是倍数化你的产出——一个人只能做一份事，一个团队可以同时做多件事',
    ASSET_COMPOUNDING: '最大的机会是启动复利飞轮——初期变化小，后期指数级增长',
  }

  return oppMap[lever] || '执行翻身战略可以改变你当前的收入和生活结构'
}

/**
 * findMostWorthChanging
 */
function findMostWorthChanging(game, lever, strategy) {
  if (game === 'SELLING_TIME') return '最值得改变的是：从「卖时间」转向「建资产」'
  if (game === 'SINGLE_INCOME') return '最值得改变的是：建立不依赖单一来源的第二收入渠道'
  if (game === 'OPPORTUNITY_CHASING') return '最值得改变的是：选定一个方向，拒绝分心，深耕到底'
  if (game === 'SKILL_WITHOUT_DISTRIBUTION') return '最值得改变的是：建立一个让客户能持续找到你的渠道'
  if (game === 'CONTENT_WITHOUT_MONETIZATION') return '最值得改变的是：给你的内容加上价格标签'
  if (game === 'BUSINESS_WITHOUT_SYSTEM') return '最值得改变的是：开始把你的工作流程标准化和自动化'
  return '最值得改变的是：从现在开始执行，而不是继续等待'
}

/**
 * describeForkPoint
 */
function describeForkPoint(game, lever) {
  return '未来分叉点出现在你决定开始执行翻身战略的那一刻。' +
    '如果继续维持现状（World A），三年后的问题和三年前一样——只是叠加了三年时间成本。' +
    '如果开始执行并坚持（World B），差异从第90天开始累积。'
}

/**
 * findIrreversibleRisk
 */
function findIrreversibleRisk(game, profile) {
  const safetyMonths = profile.reality.safetyMonths || 0
  if (safetyMonths < 2) {
    return '当前最不可逆的风险：紧急财务事件发生前没有建立足够缓冲——一旦发生，修复成本极高且可能无法回到当前状态'
  }

  if (game === 'SELLING_TIME') {
    return '不可逆的风险：时间。每一年出售时间，都少了一年可以用来建资产。时间不会倒流。'
  }

  return '不可逆的风险：拖延。每一次「再等等」都在消耗选择空间。窗口不会一直打开。'
}

/**
 * buildComparisonSummary
 */
function buildComparisonSummary(profile, wrongGameResult, strategy, projection) {
  const aTrajectory = projection.worldA.year3.overallTrajectory
  const bTrajectory = projection.worldB.year3.overallTrajectory

  if (aTrajectory === '下降' || aTrajectory === '明显下降') {
    return `World A 三年后方向是${aTrajectory}，World B 三年后方向是${bTrajectory}。差距不是微小的优化，而是完全不同的生活轨迹。`
  }

  return `World A 三年后维持在${aTrajectory}，而 World B 可以达到${bTrajectory}。差异不在于收入金额，而在于收入结构和生活自主权。`
}

/**
 * buildDecisionNodes — 构建决策节点
 */
function buildDecisionNodes(profile, wrongGameResult, strategy, _leverageResult) {
  const stage = profile.wealthStage
  // Unified source: strategy.primaryStrategy.primaryLeverage
  const lever = strategy && strategy.primaryStrategy && strategy.primaryStrategy.primaryLeverage
    ? strategy.primaryStrategy.primaryLeverage.type
    : null
  const game = wrongGameResult && wrongGameResult.primaryWrongGame
    ? wrongGameResult.primaryWrongGame.gameType
    : null

  const nodes = []

  // 节点 1: 是否开始执行（所有用户都有）
  nodes.push({
    node: '第一次行动',
    trigger: '现在',
    deadline: '7天内开始第一步',
    cost: '每周2-5小时的投入',
    benefit: '启动翻身飞轮的第一步',
    risk: '如果没有坚持至少90天，前功尽弃',
    reversible: true,
  })

  // 节点 2: 安全垫建立
  const safetyMonths = profile.reality.safetyMonths || 0
  if (safetyMonths < 3) {
    nodes.push({
      node: '现金流安全边界',
      trigger: '安全月数 < 3个月',
      deadline: '90天内建立至少1个月的安全垫',
      cost: '减少非必要支出，储蓄',
      benefit: '承受意外冲击的能力提升',
      risk: '没有安全垫之前不能进行任何需要现金投入的尝试',
      reversible: true,
    })
  }

  // 节点 3: 基于杠杆的特色节点
  if (lever === 'AI_PRODUCTIVITY') {
    nodes.push({
      node: 'AI工具上手',
      trigger: '选定要用的AI工具',
      deadline: '14天内完成首批AI工具学习',
      cost: '每次学习30-60分钟',
      benefit: '释放每周至少2小时时间',
      risk: '如果停留在浅层使用，效果有限',
      reversible: true,
    })
  }

  if (lever === 'CONTENT_DISTRIBUTION') {
    nodes.push({
      node: '发布第一篇内容',
      trigger: '确定分发平台和内容定位',
      deadline: '14天内发布第一篇内容',
      cost: '准备时间2-3小时',
      benefit: '开启让市场看到你的第一步',
      risk: '初期关注很低是正常的，不要因此放弃',
      reversible: true,
    })
  }

  if (lever === 'SALES_CONVERSION') {
    nodes.push({
      node: '首次成交验证',
      trigger: '有至少一个潜在客户可接触',
      deadline: '30天内完成首次主动成交',
      cost: '沟通和跟进时间',
      benefit: '验证成交能力的第一步',
      risk: '初期可能被拒绝多次，需要持续迭代',
      reversible: true,
    })
  }

  if (lever === 'KNOWLEDGE_PRODUCT') {
    nodes.push({
      node: '产品MVP完成',
      trigger: '选定要产品化的经验/技能',
      deadline: '30天内完成产品雏形',
      cost: '产出时间10-20小时',
      benefit: '拥有第一个可销售的产品',
      risk: 'MVP不需要完美，需要的是尽快验证市场',
      reversible: true,
    })
  }

  if (lever === 'SERVICE_PRODUCTIZATION') {
    nodes.push({
      node: '首份服务SOP',
      trigger: '选定第一个要标准化的服务',
      deadline: '14天内完成SOP文档',
      cost: '文档整理时间2-4小时',
      benefit: '服务交付开始有标准可循',
      risk: '过度标准化可能降低灵活性',
      reversible: true,
    })
  }

  if (lever === 'AUTOMATION_SYSTEM') {
    nodes.push({
      node: '首个自动化流程',
      trigger: '识别最耗时的重复性工作',
      deadline: '30天内完成首个流程自动化',
      cost: '搭建时间+即期效率下降',
      benefit: '长期释放大量时间',
      risk: '自动化初期可能比手动更慢',
      reversible: true,
    })
  }

  // 节点 4: 90天复查（所有用户都有）
  nodes.push({
    node: '90天战略复查',
    trigger: '完成90天执行',
    deadline: '第90天',
    cost: '1-2小时回顾和记录',
    benefit: '基于实际执行数据调整策略',
    risk: '如果90天内没有任何执行，可能需要彻底重新评估',
    reversible: false,
  })

  return nodes
}

/**
 * calculateProjectionConfidence
 */
function calculateProjectionConfidence(profile, wrongGameResult, strategy) {
  let conf = 50

  // 数据完整度
  const hasIncome = (profile.reality.monthlyIncome || 0) > 0
  const hasCaps = Object.values(profile.capabilities).some(v => v > 0)
  if (hasIncome) conf += 8
  if (hasCaps) conf += 7

  // 规则命中
  if (profile.evidence && profile.evidence.ruleHits) {
    conf += Math.min(15, profile.evidence.ruleHits.length * 3)
  }

  // 错误游戏确定性
  if (wrongGameResult && wrongGameResult.primaryWrongGame && wrongGameResult.primaryWrongGame.gameType !== 'UNKNOWN_GAME') {
    conf += 12
  }

  // 杠杆差异度
  if (strategy && strategy.evidence && strategy.evidence.confidence) {
    conf += Math.min(8, strategy.evidence.confidence / 10)
  }

  return Math.min(90, Math.max(10, conf))
}

/**
 * buildProjectionAssumptions
 */
function buildProjectionAssumptions(profile, wrongGameResult, strategy) {
  const assumptions = [
    '用户提供的信息真实且可复核',
    '外部经济环境不发生重大结构性变化',
    '用户保持学习能力和意愿',
    '行业没有遭遇不可抗力',
    '现金流没有突然恶化',
  ]

  const stage = profile.wealthStage
  if (stage === 'SURVIVAL') {
    assumptions.push('用户优先修复生存安全边界再考虑增长')
  }

  const game = wrongGameResult && wrongGameResult.primaryWrongGame
    ? wrongGameResult.primaryWrongGame.gameType
    : null
  if (game === 'SINGLE_INCOME') {
    assumptions.push('用户的主要收入来源在过渡期内保持稳定')
  }

  return assumptions
}

/**
 * buildLimitingFactors
 */
function buildLimitingFactors(profile, strategy) {
  const limits = []

  if ((profile.reality.safetyMonths || 0) < 3) {
    limits.push('现金流安全月数不足，推演前提是安全边界不被击穿')
  }
  if ((profile.reality.debt || 0) > (profile.reality.monthlyIncome || 1) * 6) {
    limits.push('高负债水平限制投资和试错空间')
  }
  if ((profile.reality.availableHoursPerWeek || 0) < 5) {
    limits.push('每周可支配时间极低，改善速度会慢于有更多时间的人')
  }
  if ((profile.constraints.familyPressure || []).length >= 2) {
    limits.push('家庭责任限制风险承担能力——推演假设不牺牲家庭责任')
  }
  if ((profile.capabilities.execution || 0) < 30) {
    limits.push('执行能力偏低，需要比标准时间多1.5-2倍才能达到同样结果')
  }
  if ((profile.capabilities.discipline || 0) < 30) {
    limits.push('纪律性弱可能导致执行中断，推演假设用户会建立问责机制')
  }
  if ((profile.psychology.anxiety || 0) >= 70) {
    limits.push('高焦虑可能在执行过程中造成过早放弃——需要设定更短周期的反馈')
  }

  if (limits.length === 0) {
    limits.push('主要限制因素是外部环境变化和用户执行承诺的持续性')
  }

  return limits
}

module.exports = {
  projectDestiny,
}
