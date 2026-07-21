/**
 * core/turnaround-os/engines/turnaroundEngineV6.js
 *
 * V6 翻身战略引擎
 * 集成 identity + wrongGame + leverage → 输出 strategy contract 骨架
 * 本轮仅生成战略骨架：verdict, identitySummary, primaryStrategy, evidence
 * 不含 roadmap/futureProjection/cognitiveStrike/dailySystem/finalJudgment
 *
 * @version 6.0.0
 */

const {
  PROBABILITY_TYPE,
  WEALTH_STAGES,
  LEVERAGE_LABELS,
} = require('../constants')

/**
 * generateStrategy — 从身份+错误游戏+杠杆生成战略骨架
 *
 * @param {Object} profile — identityEngine 输出
 * @param {Object} wrongGameResult — wrongGameEngine 输出
 * @param {Object} leverageResult — leverageEngine 输出
 * @param {Object} options — { generatedAt: 'ISO string' | null }
 *   如果未传入 generatedAt，使用 null（不自动生成时间）
 * @returns {Object} partial strategyContractV6
 */
function generateStrategy(profile, wrongGameResult, leverageResult, options = {}) {
  const generatedAt = options.generatedAt || null

  const readinessScore = profile.strategyReadinessScore || 0
  const confidence = calculateConfidence(profile, wrongGameResult, leverageResult)

  const limitingFactors = identifyLimitingFactors(profile)
  const assumptions = buildAssumptions(profile, wrongGameResult)

  // 构建标题
  const identitySummary = buildIdentitySummary(profile, wrongGameResult, leverageResult)

  // 最大敌人与机会
  const biggestEnemy = identifyBiggestEnemy(profile, wrongGameResult)
  const biggestOpportunity = identifyBiggestOpportunity(profile, leverageResult)

  // headline 与 coreJudgment
  const headline = buildHeadline(profile, wrongGameResult, leverageResult)
  const coreJudgment = buildCoreJudgment(profile, wrongGameResult, leverageResult)

  // primary strategy
  const primaryStrategy = buildPrimaryStrategy(profile, wrongGameResult, leverageResult)

  // evidence
  const evidence = collectEvidence(profile, wrongGameResult, leverageResult)

  return {
    version: '6.0',
    generatedAt,

    verdict: {
      strategyReadinessScore: readinessScore,
      probabilityType: PROBABILITY_TYPE,
      confidence,
      headline,
      coreJudgment,
      biggestEnemy,
      biggestOpportunity,
      limitingFactors,
      assumptions,
    },

    identitySummary,

    wrongGame: wrongGameResult.primaryWrongGame || {
      type: '',
      title: '',
      evidence: [],
      hiddenCost: '',
      threeYearConsequence: '',
      exitCondition: '',
    },

    primaryStrategy,

    evidence,
  }
}

/**
 * calculateConfidence — 置信度（证据充足度）
 */
function calculateConfidence(profile, wrongGameResult, leverageResult) {
  let conf = 50

  // 有 meaningful 数据则加分
  const hasIncome = (profile.reality.monthlyIncome || 0) > 0
  const hasCaps = Object.values(profile.capabilities).some(v => v > 0)
  const hasAssets = Object.values(profile.assets).some(arr => Array.isArray(arr) && arr.length > 0)

  if (hasIncome) conf += 10
  if (hasCaps) conf += 10
  if (hasAssets) conf += 5

  // 错误游戏置信度贡献
  if (wrongGameResult && wrongGameResult.primaryWrongGame && wrongGameResult.primaryWrongGame.gameType !== 'UNKNOWN_GAME') {
    conf += 15
  }

  // 杠杆分差足够大说明差异明确
  if (leverageResult) {
    const allScores = leverageResult.allScores
    if (allScores && allScores.length >= 2) {
      const gap = allScores[0].fitScore - allScores[1].fitScore
      if (gap >= 15) conf += 10
    }
  }

  return Math.min(90, conf)
}

/**
 * identifyLimitingFactors — 识别限制翻身的主要因素
 */
function identifyLimitingFactors(profile) {
  const factors = []

  if ((profile.reality.safetyMonths || 0) < 3) {
    factors.push('现金流紧张，安全月数不足')
  }
  if ((profile.reality.debt || 0) > (profile.reality.monthlyIncome || 1) * 6) {
    factors.push('较高的债务负担限制行动空间')
  }
  if ((profile.reality.availableHoursPerWeek || 0) < 7) {
    factors.push('可支配时间有限，无法同步推进多条路线')
  }
  if ((profile.capabilities.execution || 0) < 30) {
    factors.push('执行能力偏低，需要更小的任务颗粒度')
  }
  if ((profile.capabilities.sales || 0) < 30 && (profile.capabilities.content || 0) < 30) {
    factors.push('缺乏变现端能力（销售和内容均薄弱）')
  }
  if ((profile.constraints.familyPressure || []).length >= 2) {
    factors.push('家庭责任限制了可承担的风险水平')
  }
  if ((profile.psychology.anxiety || 0) >= 70) {
    factors.push('高焦虑可能影响长期持续行动的稳定性')
  }

  if (factors.length === 0) {
    factors.push('没有明显限制因素 — 具备较好的翻身基础')
  }

  return factors
}

/**
 * buildAssumptions — 模型依赖的假设
 */
function buildAssumptions(profile, wrongGameResult) {
  const assumptions = [
    '用户提供信息真实可复核',
    '用户当前情况属于策略模型覆盖的正常范围',
    '战略依赖用户按时完成建议任务',
    '外部环境不发生重大结构性变化（失业、重大疾病等）',
  ]

  if (wrongGameResult && wrongGameResult.primaryWrongGame) {
    const game = wrongGameResult.primaryWrongGame.gameType
    if (game === 'SELLING_TIME') {
      assumptions.push('用户同意将可支配时间用于建立非时间直接绑定的资产')
    }
    if (game === 'SINGLE_INCOME') {
      assumptions.push('用户愿意在保持主收入期间探索第二收入来源')
    }
  }

  return assumptions
}

/**
 * buildIdentitySummary
 */
function buildIdentitySummary(profile, wrongGameResult, leverageResult) {
  const stageLabel = profile.wealthStageLabel || ''
  const wrongGameLabel = wrongGameResult && wrongGameResult.primaryWrongGame
    ? wrongGameResult.primaryWrongGame.gameLabel
    : '待确认'
  const leverLabel = leverageResult && leverageResult.primaryLeverage
    ? leverageResult.primaryLeverage.label
    : ''

  // 最强资产
  let strongestAsset = '执行力'
  const caps = profile.capabilities
  if (caps.systemThinking >= 50) strongestAsset = '系统化思维'
  else if (caps.learning >= 50) strongestAsset = '学习能力'
  else if (caps.execution >= 40) strongestAsset = '执行力'
  else if (caps.communication >= 40) strongestAsset = '沟通能力'

  // 最弱环节
  let weakestLink = '待评估'
  if (caps.sales <= 20 && caps.content <= 20) weakestLink = '商业变现能力'
  else if (caps.discipline <= 20) weakestLink = '纪律与持续输出'
  else if (caps.systemThinking <= 20) weakestLink = '系统化思维'
  else if (caps.execution <= 20) weakestLink = '执行力'

  return {
    title: `${stageLabel}${wrongGameLabel ? ' · ' + wrongGameLabel : ''}`,
    subtitle: `推荐主杠杆：${leverLabel || '待评估'}`,
    currentStage: stageLabel,
    currentGame: wrongGameLabel,
    strongestAsset,
    weakestLink,
  }
}

/**
 * identifyBiggestEnemy
 */
function identifyBiggestEnemy(profile, wrongGameResult) {
  const game = wrongGameResult && wrongGameResult.primaryWrongGame
    ? wrongGameResult.primaryWrongGame.gameType
    : null

  if (!game) return '信息不充分，无法精确判断最大阻碍'

  if (game === 'SELLING_TIME') return '收入完全依赖出售个人时间，没有资产积累机制'
  if (game === 'SINGLE_INCOME') return `仅依赖单一收入来源，安全月数${profile.reality.safetyMonths}个月`
  if (game === 'OPPORTUNITY_CHASING') return '缺乏持续深耕单一方向的能力和耐心'
  if (game === 'SKILL_WITHOUT_DISTRIBUTION') return '有能力但缺乏让市场知道你的渠道'
  if (game === 'CONTENT_WITHOUT_MONETIZATION') return '有内容基础但没有变现闭环'
  if (game === 'BUSINESS_WITHOUT_SYSTEM') return '生意增长与个人投入深度绑定，没有可复制系统'

  return '当前模式无法积累长期竞争优势'
}

/**
 * identifyBiggestOpportunity
 */
function identifyBiggestOpportunity(profile, leverageResult) {
  const lever = leverageResult && leverageResult.primaryLeverage
  if (!lever) return '待进一步分析'

  if (lever.type === 'AI_PRODUCTIVITY') return '利用AI工具大幅提升个人效率，释放更多可支配时间'
  if (lever.type === 'CONTENT_DISTRIBUTION') return '建立内容分发渠道，让能力不再隐形'
  if (lever.type === 'SALES_CONVERSION') return '把现有受众或潜在客户转化为可持续的收入流'
  if (lever.type === 'KNOWLEDGE_PRODUCT') return '将经验和能力转化为可重复销售的知识产品'
  if (lever.type === 'SERVICE_PRODUCTIZATION') return '将当前服务标准化为可复制产品，减少个人时间绑定'
  if (lever.type === 'AUTOMATION_SYSTEM') return '建立自动化流程，让生意运行不再依赖老板本人'
  if (lever.type === 'TEAM_CAPITAL') return '引入团队分担和放大现有业务'
  if (lever.type === 'ASSET_COMPOUNDING') return '利用已有资产建立复利增长飞轮'

  return '优先建立可复制性'
}

/**
 * buildHeadline — 生成战略标题（基于游戏+杠杆组合）
 */
function buildHeadline(profile, wrongGameResult, leverageResult) {
  const game = wrongGameResult && wrongGameResult.primaryWrongGame
    ? wrongGameResult.primaryWrongGame.gameType
    : null
  const lever = leverageResult && leverageResult.primaryLeverage
    ? leverageResult.primaryLeverage.type
    : null
  const stage = profile.wealthStage

  if (stage === WEALTH_STAGES.SURVIVAL) {
    return '第一步不是翻身，是活得更稳'
  }

  if (game === 'SELLING_TIME' && lever === 'AI_PRODUCTIVITY') {
    return '用AI释放时间，把省下来的时间用于建设资产'
  }
  if (game === 'SINGLE_INCOME' && (lever === 'CONTENT_DISTRIBUTION' || lever === 'SALES_CONVERSION')) {
    return '在保住主收入的同时，建立不取决于雇主的第二收入渠道'
  }
  if (game === 'SKILL_WITHOUT_DISTRIBUTION') {
    return '你的能力不差，差的是一个让客户找到你的路径'
  }
  if (game === 'CONTENT_WITHOUT_MONETIZATION') {
    return '停止免费输出，把你的内容变成可以卖的产品'
  }
  if (game === 'BUSINESS_WITHOUT_SYSTEM') {
    return '让你的生意学会自己运转，而不是全靠你亲自顶着'
  }
  if (game === 'OPPORTUNITY_CHASING') {
    return '选定一个方向，深耕90天，比追逐十个新机会更有价值'
  }

  return '从当前阶段开始，建立可复制可积累的翻身路径'
}

/**
 * buildCoreJudgment — 核心判断（不空泛）
 */
function buildCoreJudgment(profile, wrongGameResult, leverageResult) {
  const game = wrongGameResult && wrongGameResult.primaryWrongGame
    ? wrongGameResult.primaryWrongGame.gameType
    : null
  const lever = leverageResult && leverageResult.primaryLeverage
    ? leverageResult.primaryLeverage.label
    : ''

  if (game === 'SELLING_TIME') {
    return `当前收入模式的核心问题是：你的收入完全取决于你本人是否在工作。一旦你停下来，收入立刻归零。这不是收入高低的问题——而是收入结构的问题。推荐主杠杆：${lever}。`
  }
  if (game === 'SINGLE_INCOME') {
    return `你只有一个收入来源。在当前的经济环境下，把所有鸡蛋放在一个篮子里——无论工资多高——都是高度脆弱的结构。当务之急不是追求高收入，而是建立收入的第二条腿。`
  }
  if (game === 'OPPORTUNITY_CHASING') {
    return `你不是没有能力，而是没有积累。每次换方向都重新归零，这不是在探索——这是在消耗你唯一的不可再生资源：时间。`
  }
  if (game === 'SKILL_WITHOUT_DISTRIBUTION') {
    return `你的技能在市场中是隐形的。不是能力不够，而是没有让需要你的人找到你的渠道。`
  }
  if (game === 'CONTENT_WITHOUT_MONETIZATION') {
    return `你有创作能力或已有受众，但缺少最关键的一环：把关注变成收入。目前你的内容是在免费消耗你的时间而没有回报。`
  }
  if (game === 'BUSINESS_WITHOUT_SYSTEM') {
    return `你有一门运转中的生意，但问题是——这门生意离开了你就转不动。你的收入增长和你的时间投入成正比，这本质上是换了个壳出售时间。`
  }

  return '需要建立可复制的收入和资产结构，逐步减少对个人时间的直接依赖'
}

/**
 * buildPrimaryStrategy
 */
function buildPrimaryStrategy(profile, wrongGameResult, leverageResult) {
  const lever = leverageResult && leverageResult.primaryLeverage
  const game = wrongGameResult && wrongGameResult.primaryWrongGame

  const strategyName = lever ? `${lever.label}为核心的翻身路径` : '待确定'
  const strategicGoal = buildStrategicGoal(profile, wrongGameResult, leverageResult)
  const whyThisPath = buildWhyThisPath(profile, wrongGameResult, leverageResult)
  const whatNotToDo = buildWhatNotToDo(profile, wrongGameResult, leverageResult)
  const successCondition = buildSuccessConditions(profile, wrongGameResult, leverageResult)
  const failureRisks = buildFailureRisks(profile, wrongGameResult, leverageResult)

  return {
    strategyName,
    strategicGoal,
    primaryLeverage: lever || {},
    whyThisPath,
    whatNotToDo,
    successCondition,
    failureRisks,
  }
}

/**
 * buildStrategicGoal
 */
function buildStrategicGoal(profile, wrongGameResult, leverageResult) {
  const lever = leverageResult && leverageResult.primaryLeverage
    ? leverageResult.primaryLeverage.type
    : null

  if (lever === 'AI_PRODUCTIVITY') return '在90天内用AI工具每周释放至少5小时并验证一次非时间绑定的收入'
  if (lever === 'SERVICE_PRODUCTIZATION') return '在90天内将当前服务标准化为可复制的产品包，降低个人交付占比'
  if (lever === 'CONTENT_DISTRIBUTION') return '在90天内建立至少一个稳定获客渠道并完成首次客户闭环'
  if (lever === 'SALES_CONVERSION') return '在90天内优化成交链路，从现有受众中验证至少3笔主动转化'
  if (lever === 'KNOWLEDGE_PRODUCT') return '在90天内将一项经验或能力打包为可销售产品并完成首次销售'
  if (lever === 'AUTOMATION_SYSTEM') return '在90天内完成至少一个业务流程的自动化，减少老板个人参与'
  if (lever === 'TEAM_CAPITAL') return '在90天内完成团队最小可行单元的搭建和职责授权'
  if (lever === 'ASSET_COMPOUNDING') return '在90天内建立资产配置基础并验证首期复利增长'

  return '在90天内完成一次最小可行翻身验证'
}

/**
 * buildWhyThisPath
 */
function buildWhyThisPath(profile, wrongGameResult, leverageResult) {
  const game = wrongGameResult && wrongGameResult.primaryWrongGame
    ? wrongGameResult.primaryWrongGame.gameType
    : null
  const lever = leverageResult && leverageResult.primaryLeverage
    ? leverageResult.primaryLeverage.label
    : ''
  const stage = profile.wealthStage

  if (stage === WEALTH_STAGES.SURVIVAL) {
    return `当前处于生存修复期，$优先修复现金流安全问题、控制风险比追求增长更重要。${lever}是最适配当前约束的杠杆方向。`
  }

  if (game === 'SELLING_TIME') {
    return `${lever}直接针对你收入结构中最关键的问题：收入与个人时间的绑定。这是从"卖时间"转向"建资产"的第一块基石。`
  }
  if (game === 'SINGLE_INCOME') {
    return `${lever}帮你建立不依赖单一雇主/客户的收入基础，逐步降低收入结构的脆弱性。`
  }

  return `${lever}是当前阶段最匹配的能力、约束和机会的杠杆方向。`
}

/**
 * buildWhatNotToDo
 */
function buildWhatNotToDo(profile, wrongGameResult, leverageResult) {
  const list = []
  const stage = profile.wealthStage

  if (stage === WEALTH_STAGES.SURVIVAL || (profile.reality.safetyMonths || 0) < 3) {
    list.push('不要裸辞——在现金流稳定前必须保持现有收入来源')
    list.push('不要贷款投入新方向——先修安全边界再谈增长')
  }

  if ((profile.reality.debt || 0) > (profile.reality.monthlyIncome || 1) * 6) {
    list.push('不要激进投入资本——当前债务水平不允许高风险操作')
  }

  if ((profile.constraints.familyPressure || []).length >= 2) {
    list.push('不要在家庭责任确认前做 All-in 决策')
  }

  const game = wrongGameResult && wrongGameResult.primaryWrongGame
    ? wrongGameResult.primaryWrongGame.gameType
    : null

  if (game === 'OPPORTUNITY_CHASING') {
    list.push('不要在选定的方向之外同时开展超过两个新尝试')
  }

  if (list.length === 0) {
    list.push('不要在未完成首轮验证前大幅扩张投入')
  }

  return list
}

/**
 * buildSuccessConditions
 */
function buildSuccessConditions(profile, wrongGameResult, leverageResult) {
  const lever = leverageResult && leverageResult.primaryLeverage
    ? leverageResult.primaryLeverage.type
    : null

  const conditions = []

  if (lever === 'AI_PRODUCTIVITY') {
    conditions.push('每周可用时间增加至少5小时')
    conditions.push('至少一个工作流由AI工具覆盖70%以上')
  }
  if (lever === 'SERVICE_PRODUCTIZATION') {
    conditions.push('服务交付流程有明确SOP文档')
    conditions.push('至少一个环节不依赖本人直接执行')
  }
  if (lever === 'CONTENT_DISTRIBUTION') {
    conditions.push('建立至少一个持续产出的分发渠道')
    conditions.push('从该渠道获得首批真正的潜在客户')
  }
  if (lever === 'SALES_CONVERSION') {
    conditions.push('完成至少3笔主动成交')
    conditions.push('有可复制的成交路径（而非每次靠运气）')
  }
  if (lever === 'KNOWLEDGE_PRODUCT') {
    conditions.push('完成产品最小化可行版本')
    conditions.push('至少实现首次销售')
  }
  if (lever === 'AUTOMATION_SYSTEM') {
    conditions.push('至少一个业务流程完成自动化')
    conditions.push('该流程在不依赖老板情况下正常运行')
  }

  conditions.push('90天后安全月数不低于当前水平')

  return conditions
}

/**
 * buildFailureRisks
 */
function buildFailureRisks(profile, wrongGameResult, leverageResult) {
  const risks = []

  if ((profile.capabilities.execution || 0) < 30) {
    risks.push('执行能力偏低可能导致任务启动困难，需要超小颗粒度的第一步')
  }
  if ((profile.capabilities.discipline || 0) < 30) {
    risks.push('纪律性弱可能导致中期放弃，需要建立外部问责机制')
  }
  if ((profile.psychology.anxiety || 0) >= 70) {
    risks.push('高焦虑可能导致过早放弃或过度追求即时反馈')
  }
  if ((profile.reality.availableHoursPerWeek || 0) < 5) {
    risks.push('可支配时间极为有限，战略推进速度会低于预期')
  }
  if ((profile.psychology.externalAttribution || 0) >= 70) {
    risks.push('外部归因倾向可能导致在遇到阻力时将问题归咎于外部而非调整策略')
  }

  if (risks.length === 0) {
    risks.push('主要风险在于外部环境变化超出策略覆盖范围')
  }

  return risks
}

/**
 * collectEvidence
 */
function collectEvidence(profile, wrongGameResult, leverageResult) {
  const ruleHits = []
  const sourceFields = []

  if (profile.evidence && profile.evidence.ruleHits) {
    ruleHits.push(...profile.evidence.ruleHits)
  }

  if (wrongGameResult && wrongGameResult.primaryWrongGame && wrongGameResult.primaryWrongGame.evidence) {
    for (const ev of wrongGameResult.primaryWrongGame.evidence) {
      ruleHits.push(ev.ruleId)
      if (ev.sourceField) sourceFields.push(ev.sourceField)
    }
  }

  return {
    ruleHits: [...new Set(ruleHits)],
    sourceFields: [...new Set(sourceFields)],
    confidence: calculateConfidence(profile, wrongGameResult, leverageResult),
  }
}

module.exports = {
  generateStrategy,
}
