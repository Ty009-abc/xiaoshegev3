/**
 * core/turnaround-os/simulators/worldBSimulator.js
 *
 * World B Simulator — 执行 Turnaround OS 战略的命运推演
 * 纯规则引擎，无随机数，同输入同输出
 *
 * 输入：用户画像 + 战略 (strategy) + 主杠杆
 * 输出：三个时间点（90天/365天/3年）的改善推演
 *
 * @version 6.0.0
 */

const { createWorldB } = require('../contracts/destinyProjectionContractV6')
const { explainBatch } = require('../engines/whyEngineV6')
const { WEALTH_STAGES, LEVERAGE_TYPES } = require('../constants')

/**
 * simulateWorldB — 推演「执行翻身战略」的未来
 *
 * @param {Object} profile — identityEngine 输出
 * @param {Object} strategy — turnaroundEngine 输出
 * @param {Object} leverageResult — leverageEngine 输出
 * @returns {Object} World B projection
 */
function simulateWorldB(profile, strategy, leverageResult) {
  const world = createWorldB()
  const lever = leverageResult && leverageResult.primaryLeverage
    ? leverageResult.primaryLeverage.type
    : null
  const readiness = profile.strategyReadinessScore || 0

  world.label = '执行 Turnaround OS 推荐战略'

  // 基于杠杆类型选择改善模式
  const patterns = selectImprovementPattern(profile, lever, readiness)

  world.day90 = applyPattern(patterns.day90, profile)
  world.day365 = applyPattern(patterns.day365, profile)
  world.year3 = applyPattern(patterns.year3, profile)

  // expectedChanges
  world.expectedChanges = calculateExpectedChanges(lever, profile)

  // prerequisites
  world.prerequisites = calculatePrerequisites(profile, lever)

  // probability
  world.probability = calculateWorldBProbability(profile, readiness)
  world.confidence = calculateWorldBConfidence(profile, strategy)

  // Why results
  world.whyResults = explainBatch(world.year3, profile, {
    trendRules: buildWorldBTrendRules(profile, lever),
    assumptions: buildWorldBAssumptions(profile),
  })

  return world
}

/**
 * selectImprovementPattern — 基于杠杆选改善模式
 */
function selectImprovementPattern(profile, lever, readiness) {
  const stage = profile.wealthStage
  const caps = profile.capabilities
  const hours = profile.reality.availableHoursPerWeek || 0

  // 改善速度由 readiness + 时间 + 阶段共同决定
  const isSlowStart = stage === WEALTH_STAGES.SURVIVAL || hours < 5 || readiness < 30
  const isVeryFast = readiness > 70 && hours >= 15
  const isFast = readiness > 50 && hours >= 10 && stage !== WEALTH_STAGES.SURVIVAL

  const speedModifier = isVeryFast ? '结构性改善' : isFast ? '明显改善' : isSlowStart ? '缓慢改善' : '改善'

  if (!lever) {
    return genericImprovement(speedModifier)
  }

  switch (lever) {
    case 'AI_PRODUCTIVITY':
      return aiProductivityPattern(isSlowStart, isVeryFast, isFast, hours, caps, speedModifier)
    case 'SALES_CONVERSION':
      return salesConversionPattern(isSlowStart, isVeryFast, isFast, caps, speedModifier)
    case 'CONTENT_DISTRIBUTION':
      return contentDistributionPattern(isSlowStart, isVeryFast, isFast, caps, speedModifier)
    case 'KNOWLEDGE_PRODUCT':
      return knowledgeProductPattern(isSlowStart, isVeryFast, isFast, caps, speedModifier)
    case 'SERVICE_PRODUCTIZATION':
      return serviceProductPattern(isSlowStart, isVeryFast, isFast, caps, speedModifier)
    case 'AUTOMATION_SYSTEM':
      return automationSystemPattern(isSlowStart, isVeryFast, isFast, caps, speedModifier)
    case 'TEAM_CAPITAL':
      return teamCapitalPattern(isSlowStart, isVeryFast, isFast, caps, speedModifier)
    case 'ASSET_COMPOUNDING':
      return assetCompoundingPattern(isSlowStart, isVeryFast, isFast, caps, speedModifier)
    default:
      return genericImprovement(speedModifier)
  }
}

/**
 * AI 效率杠杆模式
 */
function aiProductivityPattern(isSlow, isVeryFast, isFast, hours, caps, speedMod) {
  const day90Level = isSlow ? '缓慢改善' : '改善'
  const yearLevel = isVeryFast ? '明显改善' : isFast ? '改善' : isSlow ? '缓慢改善' : '改善'
  const year3Level = isVeryFast ? '结构性改善' : isFast ? '明显改善' : isSlow ? '改善' : '明显改善'

  return {
    day90: {
      status: day90Level, incomeTrend: '停滞', cashflowTrend: '缓慢改善',
      assetTrend: '停滞', freedomTrend: day90Level, stressTrend: '缓慢改善',
      careerTrend: '停滞', riskTrend: '缓慢改善', overallTrajectory: day90Level,
      summary: '开始使用AI工具提升效率，可支配时间边际增加',
      majorEvents: ['完成首批AI工具学习和工作流改造'],
      majorRisks: ['工具使用熟练度需要时间积累'],
      hiddenCosts: [],
    },
    day365: {
      status: yearLevel, incomeTrend: '缓慢改善', cashflowTrend: yearLevel,
      assetTrend: '缓慢改善', freedomTrend: yearLevel, stressTrend: yearLevel,
      careerTrend: '缓慢改善', riskTrend: yearLevel, overallTrajectory: yearLevel,
      summary: `AI效率释放出更多时间，每周可支配时间从${hours}小时提升`,
      majorEvents: ['至少一个工作流实现了70%以上AI替代'],
      majorRisks: ['需要持续学习和迭代AI工具'],
      hiddenCosts: [],
    },
    year3: {
      status: year3Level, incomeTrend: year3Level, cashflowTrend: year3Level,
      assetTrend: yearLevel, freedomTrend: year3Level, stressTrend: year3Level,
      careerTrend: yearLevel, riskTrend: '明显改善', overallTrajectory: year3Level,
      summary: 'AI效率已融入核心工作流，释放出足够时间建立第二收入来源或资产',
      majorEvents: ['建立至少一个非时间绑定的收入来源'],
      majorRisks: ['不能停留在工具使用层面，需要进一步利用释放的时间建资产'],
      hiddenCosts: [],
    },
  }
}

/**
 * 销售成交杠杆模式
 */
function salesConversionPattern(isSlow, isVeryFast, isFast, caps, speedMod) {
  const day90Level = isSlow ? '缓慢改善' : '改善'
  const yearLevel = '改善'
  const year3Level = isVeryFast ? '结构性改善' : isFast ? '明显改善' : '改善'

  // 销售能力当前值影响速度
  const salesNow = caps.sales || 0
  const salesSpeed = salesNow >= 50 ? '快速' : salesNow >= 30 ? '稳步' : '需要建立基础'

  return {
    day90: {
      status: day90Level, incomeTrend: '停滞', cashflowTrend: '缓慢改善',
      assetTrend: '停滞', freedomTrend: '停滞', stressTrend: '改善',
      careerTrend: '缓慢改善', riskTrend: '改善', overallTrajectory: day90Level,
      summary: `开始系统化建立销售能力，${salesSpeed}推进`,
      majorEvents: ['完成首批主动成交验证'],
      majorRisks: ['初期成交可能需要多次迭代'],
      hiddenCosts: [],
    },
    day365: {
      status: yearLevel, incomeTrend: yearLevel, cashflowTrend: yearLevel,
      assetTrend: '缓慢改善', freedomTrend: '缓慢改善', stressTrend: '改善',
      careerTrend: yearLevel, riskTrend: '改善', overallTrajectory: yearLevel,
      summary: '建立可复制的成交路径，开始有稳定的独立收入来源',
      majorEvents: ['建立至少一个完整的销售漏斗'],
      majorRisks: ['销售技巧需要持续打磨'],
      hiddenCosts: [],
    },
    year3: {
      status: year3Level, incomeTrend: year3Level, cashflowTrend: year3Level,
      assetTrend: yearLevel, freedomTrend: yearLevel, stressTrend: '明显改善',
      careerTrend: year3Level, riskTrend: '明显改善', overallTrajectory: year3Level,
      summary: '成交能力成为可迁移的核心资产，收入来源已经多元化',
      majorEvents: ['销售能力不再受限于单个场景，可复用到多种产品'],
      majorRisks: ['需要保持学习和迭代'],
      hiddenCosts: [],
    },
  }
}

/**
 * 内容分发杠杆模式
 */
function contentDistributionPattern(isSlow, isVeryFast, isFast, caps, speedMod) {
  const day90Level = isSlow ? '缓慢改善' : '改善'
  const yearLevel = '改善'
  const year3Level = isVeryFast ? '结构性改善' : isFast ? '明显改善' : '改善'

  return {
    day90: {
      status: day90Level, incomeTrend: '停滞', cashflowTrend: '停滞',
      assetTrend: day90Level, freedomTrend: '缓慢改善', stressTrend: '缓慢改善',
      careerTrend: '缓慢改善', riskTrend: '缓慢改善', overallTrajectory: day90Level,
      summary: '开始建立内容分发渠道，能力开始对市场可见',
      majorEvents: ['建立至少一个内容分发通道'],
      majorRisks: ['初期流量和关注可能很低'],
      hiddenCosts: ['内容输出初期需要大量时间投入'],
    },
    day365: {
      status: yearLevel, incomeTrend: '缓慢改善', cashflowTrend: '缓慢改善',
      assetTrend: yearLevel, freedomTrend: '改善', stressTrend: '改善',
      careerTrend: yearLevel, riskTrend: '改善', overallTrajectory: yearLevel,
      summary: '分发渠道开始产生稳定的获客流，技能有了市场定价',
      majorEvents: ['从分发渠道获得首批付费客户'],
      majorRisks: ['内容质量需要持续提升'],
      hiddenCosts: [],
    },
    year3: {
      status: year3Level, incomeTrend: year3Level, cashflowTrend: year3Level,
      assetTrend: year3Level, freedomTrend: yearLevel, stressTrend: '明显改善',
      careerTrend: year3Level, riskTrend: '明显改善', overallTrajectory: year3Level,
      summary: '个人品牌或渠道资产开始产生复利，客户开始主动找你',
      majorEvents: ['内容资产积累形成流量飞轮'],
      majorRisks: ['单一渠道风险需要多平台布局'],
      hiddenCosts: [],
    },
  }
}

/**
 * 知识产品杠杆模式
 */
function knowledgeProductPattern(isSlow, isVeryFast, isFast, caps, speedMod) {
  const day90Level = '缓慢改善'
  const yearLevel = isSlow ? '改善' : '明显改善'
  const year3Level = isVeryFast ? '结构性改善' : isFast ? '明显改善' : '改善'

  return {
    day90: {
      status: day90Level, incomeTrend: '停滞', cashflowTrend: '停滞',
      assetTrend: day90Level, freedomTrend: '停滞', stressTrend: '缓慢改善',
      careerTrend: '停滞', riskTrend: '缓慢改善', overallTrajectory: day90Level,
      summary: '开始将经验/技能打包为知识产品雏形',
      majorEvents: ['完成知识产品最小化可行版本'],
      majorRisks: ['产品验证周期可能较长'],
      hiddenCosts: ['前期投入较高，返现周期慢'],
    },
    day365: {
      status: yearLevel, incomeTrend: yearLevel, cashflowTrend: yearLevel,
      assetTrend: yearLevel, freedomTrend: '改善', stressTrend: '改善',
      careerTrend: yearLevel, riskTrend: '改善', overallTrajectory: yearLevel,
      summary: '产品经过几轮迭代后找到市场匹配，开始有持续销售',
      majorEvents: ['产品卖出首批N份，验证了市场需求'],
      majorRisks: ['持续需要营销和迭代'],
      hiddenCosts: [],
    },
    year3: {
      status: year3Level, incomeTrend: year3Level, cashflowTrend: year3Level,
      assetTrend: year3Level, freedomTrend: year3Level, stressTrend: '明显改善',
      careerTrend: year3Level, riskTrend: '明显改善', overallTrajectory: year3Level,
      summary: '知识产品成为可重复销售的资产，收入与时间投入脱钩',
      majorEvents: ['产品线可能已扩展或深化'],
      majorRisks: ['市场变化需要持续创新'],
      hiddenCosts: [],
    },
  }
}

/**
 * 服务产品化杠杆模式
 */
function serviceProductPattern(isSlow, isVeryFast, isFast, caps, speedMod) {
  const day90Level = '缓慢改善'
  const yearLevel = isSlow ? '改善' : '明显改善'
  const year3Level = '明显改善'

  return {
    day90: {
      status: day90Level, incomeTrend: '停滞', cashflowTrend: '缓慢改善',
      assetTrend: day90Level, freedomTrend: '缓慢改善', stressTrend: '改善',
      careerTrend: '缓慢改善', riskTrend: '改善', overallTrajectory: day90Level,
      summary: '开始将服务流程标准化，编写SOP',
      majorEvents: ['完成首个服务产品的标准化文档'],
      majorRisks: ['标准化可能开始时增加工作量'],
      hiddenCosts: [],
    },
    day365: {
      status: yearLevel, incomeTrend: yearLevel, cashflowTrend: yearLevel,
      assetTrend: yearLevel, freedomTrend: yearLevel, stressTrend: '明显改善',
      careerTrend: yearLevel, riskTrend: '改善', overallTrajectory: yearLevel,
      summary: '标准化服务开始减少个人直接交付时间，可同时服务更多客户',
      majorEvents: ['至少一个环节不再完全依赖本人执行'],
      majorRisks: ['品质控制需要新机制'],
      hiddenCosts: [],
    },
    year3: {
      status: year3Level, incomeTrend: year3Level, cashflowTrend: year3Level,
      assetTrend: year3Level, freedomTrend: year3Level, stressTrend: '明显改善',
      careerTrend: year3Level, riskTrend: '明显改善', overallTrajectory: year3Level,
      summary: '服务已完全产品化，收入增长不再线性绑定个人时间投入',
      majorEvents: ['收入与个人工作时长开始脱钩'],
      majorRisks: ['市场规模限制'],
      hiddenCosts: [],
    },
  }
}

/**
 * 自动化系统杠杆模式
 */
function automationSystemPattern(isSlow, isVeryFast, isFast, caps, speedMod) {
  const day90Level = '缓慢改善'
  const yearLevel = isSlow ? '缓慢改善' : '改善'
  const year3Level = '明显改善'

  return {
    day90: {
      status: day90Level, incomeTrend: '停滞', cashflowTrend: '停滞',
      assetTrend: day90Level, freedomTrend: '缓慢改善', stressTrend: '改善',
      careerTrend: '停滞', riskTrend: '缓慢改善', overallTrajectory: day90Level,
      summary: '开始建立第一个业务的标准化流程和自动化',
      majorEvents: ['完成首项业务流程自动化的设计和搭建'],
      majorRisks: ['自动化初期需要投入额外时间'],
      hiddenCosts: [],
    },
    day365: {
      status: yearLevel, incomeTrend: '缓慢改善', cashflowTrend: yearLevel,
      assetTrend: yearLevel, freedomTrend: yearLevel, stressTrend: '明显改善',
      careerTrend: '缓慢改善', riskTrend: '改善', overallTrajectory: yearLevel,
      summary: '关键流程自动化后，老板开始有其他可用时间',
      majorEvents: ['至少一个核心流程可在不依赖老板的情况下运行'],
      majorRisks: ['系统需要持续维护'],
      hiddenCosts: [],
    },
    year3: {
      status: year3Level, incomeTrend: year3Level, cashflowTrend: year3Level,
      assetTrend: year3Level, freedomTrend: year3Level, stressTrend: '明显改善',
      careerTrend: year3Level, riskTrend: '明显改善', overallTrajectory: year3Level,
      summary: '生意系统化完成，收入增长和老板时间投入已脱钩',
      majorEvents: ['老板从日常运营中抽身，可投入战略或新方向'],
      majorRisks: ['系统需要团队维护，管理能力成为新重点'],
      hiddenCosts: [],
    },
  }
}

/**
 * 团队资本杠杆模式
 */
function teamCapitalPattern(isSlow, isVeryFast, isFast, caps, speedMod) {
  const day90Level = '缓慢改善'
  const yearLevel = isSlow ? '缓慢改善' : '改善'
  const year3Level = isVeryFast ? '结构性改善' : isFast ? '明显改善' : '改善'

  return {
    day90: {
      status: day90Level, incomeTrend: '停滞', cashflowTrend: '停滞',
      assetTrend: '缓慢改善', freedomTrend: '停滞', stressTrend: '下降',
      careerTrend: '停滞', riskTrend: '下降', overallTrajectory: day90Level,
      summary: '开始建立最小可行团队，初期管理工作量大增',
      majorEvents: ['团队初建，初期磨合和培训'],
      majorRisks: ['团队初期会增加管理负担，短期效率可能下降'],
      hiddenCosts: ['人力成本增加，现金流压力上升'],
    },
    day365: {
      status: yearLevel, incomeTrend: yearLevel, cashflowTrend: yearLevel,
      assetTrend: yearLevel, freedomTrend: '改善', stressTrend: '缓慢改善',
      careerTrend: yearLevel, riskTrend: '改善', overallTrajectory: yearLevel,
      summary: '团队开始分担核心业务，个人时间开始释放',
      majorEvents: ['关键岗位可独立运行'],
      majorRisks: ['人才流失风险'],
      hiddenCosts: [],
    },
    year3: {
      status: year3Level, incomeTrend: year3Level, cashflowTrend: year3Level,
      assetTrend: year3Level, freedomTrend: year3Level, stressTrend: '明显改善',
      careerTrend: year3Level, riskTrend: '明显改善', overallTrajectory: year3Level,
      summary: '团队已可独立运转完整业务，个人角色升级为战略和管理',
      majorEvents: ['业务规模可能已有显著增长'],
      majorRisks: ['需要持续培养管理能力'],
      hiddenCosts: [],
    },
  }
}

/**
 * 资产复利杠杆模式
 */
function assetCompoundingPattern(isSlow, isVeryFast, isFast, caps, speedMod) {
  const day90Level = '缓慢改善'
  const yearLevel = isSlow ? '缓慢改善' : '改善'
  const year3Level = isVeryFast ? '结构性改善' : isFast ? '明显改善' : '改善'

  return {
    day90: {
      status: day90Level, incomeTrend: '停滞', cashflowTrend: '停滞',
      assetTrend: '缓慢改善', freedomTrend: '停滞', stressTrend: '停滞',
      careerTrend: '停滞', riskTrend: '缓慢改善', overallTrajectory: day90Level,
      summary: '开始建立资产组合基础，初期的改善肉眼不可见',
      majorEvents: ['资产配置初始搭建'],
      majorRisks: ['初期收益不明显，需要坚持'],
      hiddenCosts: ['纪律消耗，初期回报感受弱'],
    },
    day365: {
      status: yearLevel, incomeTrend: '缓慢改善', cashflowTrend: yearLevel,
      assetTrend: yearLevel, freedomTrend: '缓慢改善', stressTrend: '改善',
      careerTrend: '缓慢改善', riskTrend: '改善', overallTrajectory: yearLevel,
      summary: '资产开始产生可见的复利效果，安全垫逐步增厚',
      majorEvents: ['首次看到资产收益的超线性增长'],
      majorRisks: ['市场波动影响'],
      hiddenCosts: [],
    },
    year3: {
      status: year3Level, incomeTrend: year3Level, cashflowTrend: year3Level,
      assetTrend: year3Level, freedomTrend: year3Level, stressTrend: '明显改善',
      careerTrend: year3Level, riskTrend: '明显改善', overallTrajectory: year3Level,
      summary: '资产组合开始产生非劳动收入，复合效应加速',
      majorEvents: ['资产收益开始产生显著影响'],
      majorRisks: ['不能过早乐观，需要持续纪律'],
      hiddenCosts: [],
    },
  }
}

/**
 * genericImprovement — 通用改善模式
 */
function genericImprovement(mod) {
  return {
    day90: {
      status: '缓慢改善', incomeTrend: '停滞', cashflowTrend: '缓慢改善',
      assetTrend: '停滞', freedomTrend: '缓慢改善', stressTrend: '缓慢改善',
      careerTrend: '停滞', riskTrend: '缓慢改善', overallTrajectory: '缓慢改善',
      summary: '开始执行战略，第一步是建立稳定的基础',
    },
    day365: {
      status: mod, incomeTrend: mod, cashflowTrend: mod,
      assetTrend: '改善', freedomTrend: '改善', stressTrend: '改善',
      careerTrend: mod, riskTrend: '改善', overallTrajectory: mod,
      summary: '一年后开始看到结构化改善的成果',
    },
    year3: {
      status: '明显改善', incomeTrend: '明显改善', cashflowTrend: '明显改善',
      assetTrend: '明显改善', freedomTrend: '明显改善', stressTrend: '明显改善',
      careerTrend: '明显改善', riskTrend: '明显改善', overallTrajectory: '结构性改善',
      summary: '三年后收入结构已发生质变，不再完全依赖个人时间',
    },
  }
}

/**
 * applyPattern — 应用模式
 */
function applyPattern(pattern, _profile) {
  return {
    status: pattern.status || '停滞',
    incomeTrend: pattern.incomeTrend || '停滞',
    cashflowTrend: pattern.cashflowTrend || '停滞',
    assetTrend: pattern.assetTrend || '停滞',
    freedomTrend: pattern.freedomTrend || '停滞',
    stressTrend: pattern.stressTrend || '停滞',
    careerTrend: pattern.careerTrend || '停滞',
    riskTrend: pattern.riskTrend || '停滞',
    overallTrajectory: pattern.overallTrajectory || '停滞',
    summary: pattern.summary || '',
    majorEvents: pattern.majorEvents || [],
    majorRisks: pattern.majorRisks || [],
    hiddenCosts: pattern.hiddenCosts || [],
  }
}

/**
 * calculateExpectedChanges — 预期变化
 */
function calculateExpectedChanges(lever, profile) {
  const readiness = profile.strategyReadinessScore || 0
  const mod = readiness >= 60 ? '明显改善' : readiness >= 30 ? '改善' : '缓慢改善'

  const base = {
    newCashflow: mod,
    secondIncome: '缓慢改善',
    assetGrowth: '改善',
    timeFreedom: mod,
    aiUsage: lever === 'AI_PRODUCTIVITY' ? '明显改善' : '改善',
    businessProgress: '改善',
    systemLevel: lever === 'AUTOMATION_SYSTEM' ? '明显改善' : '缓慢改善',
  }

  if (lever === 'SALES_CONVERSION') {
    base.newCashflow = '明显改善'
    base.secondIncome = '改善'
  }
  if (lever === 'KNOWLEDGE_PRODUCT') {
    base.assetGrowth = '明显改善'
    base.newCashflow = '改善'
  }
  if (lever === 'SERVICE_PRODUCTIZATION') {
    base.timeFreedom = '明显改善'
    base.businessProgress = '明显改善'
  }
  if (lever === 'AUTOMATION_SYSTEM') {
    base.timeFreedom = '明显改善'
    base.systemLevel = '结构性改善'
  }

  return base
}

/**
 * calculatePrerequisites — 前提条件
 */
function calculatePrerequisites(profile, lever) {
  const prereqs = [
    '用户持续执行至少90天',
    '保持当前主要收入来源',
    '每周投入至少3小时在新方向上',
  ]

  if ((profile.capabilities.execution || 0) < 30) {
    prereqs.push('通过超小任务建立执行惯性')
  }
  if ((profile.capabilities.discipline || 0) < 30) {
    prereqs.push('建立外部问责机制或习惯追踪')
  }
  if ((profile.psychology.anxiety || 0) >= 70) {
    prereqs.push('管理焦虑预期，接受渐进式改善')
  }

  if (lever === 'AI_PRODUCTIVITY') {
    prereqs.push('愿意学习至少一个AI工具')
  }
  if (lever === 'CONTENT_DISTRIBUTION') {
    prereqs.push('坚持定期内容输出至少6个月')
  }
  if (lever === 'SALES_CONVERSION') {
    prereqs.push('接受初期被拒绝并持续优化成交话术')
  }
  if (lever === 'AUTOMATION_SYSTEM') {
    prereqs.push('愿意先投入时间建设再收获效率')
  }

  return prereqs
}

/**
 * calculateWorldBProbability
 */
function calculateWorldBProbability(profile, readiness) {
  // readiness 越高 → 越可能执行成功 → World B 概率越高
  return Math.min(90, Math.max(10, Math.round(readiness * 0.7 + 15)))
}

/**
 * calculateWorldBConfidence
 */
function calculateWorldBConfidence(profile, strategy) {
  let conf = 55
  if (strategy && strategy.evidence && strategy.evidence.ruleHits) {
    conf += Math.min(15, strategy.evidence.ruleHits.length * 3)
  }
  if (profile.evidence && profile.evidence.ruleHits) {
    conf += Math.min(10, profile.evidence.ruleHits.length * 2)
  }
  return Math.min(85, conf)
}

function buildWorldBTrendRules(profile, lever) {
  return [
    {
      tag: 'incomeTrend', direction: '改善',
      ruleId: 'RULE_WORLDB_INCOME_IMPROVING',
      sourceFields: ['primaryLeverage.type', 'strategyReadinessScore'],
      sourceValues: [lever || '', `${profile.strategyReadinessScore}`],
      assumptions: ['用户执行推荐战略', '杠杆选择正确'],
      conditions: `主杠杆=${lever}`,
    },
  ]
}

function buildWorldBAssumptions(profile) {
  return [
    '用户按照战略执行至少90天',
    '每周投入足够时间在新方向上',
    '外部环境不发生重大变化',
    '用户保持学习和调整',
  ]
}

module.exports = {
  simulateWorldB,
}
