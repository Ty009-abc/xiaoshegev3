/**
 * core/turnaround-os/simulators/worldASimulator.js
 *
 * World A Simulator — 维持当前行为模式的命运推演
 * 纯规则引擎，无随机数，同输入同输出
 *
 * 输入：用户画像 (profile) + 错误游戏 (wrongGame)
 * 输出：三个时间点（90天/365天/3年）的推演快照
 *
 * @version 6.0.0
 */

const { createWorldA } = require('../contracts/destinyProjectionContractV6')
const { explainBatch } = require('../engines/whyEngineV6')
const { WEALTH_STAGES } = require('../constants')

/**
 * simulateWorldA — 推演"维持现状"的未来
 *
 * @param {Object} profile — identityEngine 输出
 * @param {Object} wrongGameResult — wrongGameEngine 输出
 * @returns {Object} World A projection
 */
function simulateWorldA(profile, wrongGameResult) {
  const world = createWorldA()
  const primaryGame = wrongGameResult && wrongGameResult.primaryWrongGame
    ? wrongGameResult.primaryWrongGame.gameType
    : null

  // 基于错误游戏类型推演（每个游戏有自己的恶化模式）
  const patterns = selectDegradationPattern(profile, primaryGame)

  world.day90 = applyPattern(patterns.day90, profile, 'day90')
  world.day365 = applyPattern(patterns.day365, profile, 'day365')
  world.year3 = applyPattern(patterns.year3, profile, 'year3')

  // missed opportunities
  world.missedOpportunities = calculateMissedOpportunities(profile, primaryGame)

  // probability（越稳定地在错误路径上概率越高）
  world.probability = calculateProbability(profile, wrongGameResult, 'worldA')
  world.confidence = calculateWorldAConfidence(profile, wrongGameResult)

  // Why 结果
  world.whyResults = explainBatch(world.year3, profile, {
    trendRules: buildWorldATrendRules(profile, primaryGame),
    assumptions: buildWorldAAssumptions(profile),
  })

  return world
}

/**
 * selectDegradationPattern — 选择恶化模式
 *
 * 不同错误游戏有不同的恶化路径
 */
function selectDegradationPattern(profile, primaryGame) {
  const safetyMonths = profile.reality.safetyMonths || 0
  const debt = profile.reality.debt || 0
  const income = profile.reality.monthlyIncome || 0
  const debtToIncome = income > 0 ? debt / income : (debt > 0 ? 10 : 0)
  const stage = profile.wealthStage

  const baseRisk = {
    status: '停滞',
    incomeTrend: '停滞',
    cashflowTrend: '停滞',
    assetTrend: '停滞',
    freedomTrend: '停滞',
    stressTrend: '停滞',
    careerTrend: '停滞',
    riskTrend: '停滞',
    overallTrajectory: '停滞',
    summary: '',
    majorEvents: [],
    majorRisks: [],
    hiddenCosts: [],
  }

  // 生存期用户 → 快速恶化
  if (stage === WEALTH_STAGES.SURVIVAL || safetyMonths < 2) {
    return {
      day90: buildSnapshot(baseRisk, {
        status: '停滞',
        incomeTrend: '停滞',
        cashflowTrend: '停滞',
        assetTrend: '停滞',
        freedomTrend: '停滞',
        stressTrend: '下降', // 高压力
        careerTrend: '停滞',
        riskTrend: '下降',
        overallTrajectory: '停滞',
        summary: '90天内现金流紧张持续，没有缓冲空间，任何意外都可能触发危机',
        majorRisks: ['一次意外开支就可以击穿当前的现金流'],
        hiddenCosts: ['因为没有安全垫，错过所有需要前期投入的机会'],
      }),
      day365: buildSnapshot(baseRisk, {
        status: '下降',
        incomeTrend: '停滞',
        cashflowTrend: '下降',
        assetTrend: '停滞',
        freedomTrend: '停滞',
        stressTrend: '下降',
        careerTrend: '停滞',
        riskTrend: '下降',
        overallTrajectory: '下降',
        summary: '一年后债务压力可能累积，安全隐患进一步放大，可支配时间更少',
        majorEvents: ['可能经历至少一次现金流紧急事件'],
        majorRisks: ['债务滚雪球风险', '收入来源单一，裁员或降薪直接致命'],
        hiddenCosts: ['焦虑和精力被财务压力消耗，没有余力思考发展方向'],
      }),
      year3: buildSnapshot(baseRisk, {
        status: '下降',
        incomeTrend: '停滞',
        cashflowTrend: '下降',
        assetTrend: '停滞',
        freedomTrend: '下降',
        stressTrend: '明显下降',
        careerTrend: '停滞',
        riskTrend: '明显下降',
        overallTrajectory: '下降',
        summary: '三年后仍在同一循环中，债务未清，安全月数未改善，机会成本巨大',
        majorEvents: ['长期处于生存状态，错过所有积累窗口'],
        majorRisks: ['年龄增长降低重新选择的窗口', '家庭责任增加进一步压缩空间'],
        hiddenCosts: ['三年的可支配时间全部被低效能劳动消耗'],
      }),
    }
  }

  // 按错误游戏类型推演
  if (primaryGame === 'SELLING_TIME') {
    return sellingTimeDegradation(profile, baseRisk)
  }
  if (primaryGame === 'SINGLE_INCOME') {
    return singleIncomeDegradation(profile, baseRisk)
  }
  if (primaryGame === 'OPPORTUNITY_CHASING') {
    return opportunityChasingDegradation(profile, baseRisk)
  }
  if (primaryGame === 'SKILL_WITHOUT_DISTRIBUTION') {
    return skillWithoutDistDegradation(profile, baseRisk)
  }
  if (primaryGame === 'CONTENT_WITHOUT_MONETIZATION') {
    return contentWithoutMonetDegradation(profile, baseRisk)
  }
  if (primaryGame === 'BUSINESS_WITHOUT_SYSTEM') {
    return businessWithoutSysDegradation(profile, baseRisk)
  }

  // 默认通用模式
  return {
    day90: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '停滞', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '停滞', stressTrend: '缓慢改善',
      careerTrend: '停滞', riskTrend: '停滞', overallTrajectory: '停滞',
      summary: '90天内变化不大，维持现有节奏',
      majorRisks: ['没有主动变化就是最大的风险'],
    }),
    day365: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '缓慢改善', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '停滞', stressTrend: '停滞',
      careerTrend: '缓慢改善', riskTrend: '停滞', overallTrajectory: '停滞',
      summary: '一年后收入可能有小幅增长，但结构未变',
      majorRisks: ['核心问题未被解决'],
      hiddenCosts: ['一年的时间可用于建设却没有被投入'],
    }),
    year3: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '缓慢改善', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '停滞', stressTrend: '下降',
      careerTrend: '缓慢改善', riskTrend: '下降', overallTrajectory: '停滞',
      summary: '三年后收入可能略涨，但债务和焦虑同步增长',
      majorRisks: ['年龄和家庭责任让转型窗口缩小'],
      hiddenCosts: ['三年的可支配时间和复利窗口全部浪费'],
    }),
  }
}

/**
 * sellingTimeDegradation — 出售时间的恶化
 */
function sellingTimeDegradation(profile, baseRisk) {
  const hours = profile.reality.availableHoursPerWeek || 0
  return {
    day90: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '停滞', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '停滞', stressTrend: '下降',
      careerTrend: '停滞', riskTrend: '停滞', overallTrajectory: '停滞',
      summary: '90天内继续出售时间换取收入，没有开始建设任何资产',
      majorRisks: ['只要停止工作，收入立刻归零'],
      hiddenCosts: [`每周${hours}小时可支配时间没有用于建立资产`],
    }),
    day365: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '缓慢改善', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '停滞', stressTrend: '下降',
      careerTrend: '缓慢改善', riskTrend: '下降', overallTrajectory: '停滞',
      summary: '一年后收入可能有小幅增长，但收入结构没有任何改变',
      majorEvents: ['时薪略有提高但仍完全依赖个人劳动'],
      majorRisks: ['随着年龄增长，出售时间的竞争力会逐年下降'],
      hiddenCosts: ['一年时间如果用来建资产，现在已经有第一个可复用产品'],
    }),
    year3: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '缓慢改善', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '停滞', stressTrend: '明显下降',
      careerTrend: '缓慢改善', riskTrend: '明显下降', overallTrajectory: '下降',
      summary: '三年后仍然是「停手即停收」，焦虑和年龄同步增长',
      majorRisks: ['职场竞争力下降', '没有技能之外的任何积累'],
      hiddenCosts: ['三年可用来建立完整资产组合的时间全部消耗在售时劳动中'],
    }),
  }
}

/**
 * singleIncomeDegradation — 单一收入的恶化
 */
function singleIncomeDegradation(profile, baseRisk) {
  const safetyMonths = profile.reality.safetyMonths || 0
  return {
    day90: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '停滞', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '停滞', stressTrend: '下降',
      careerTrend: '停滞', riskTrend: '下降', overallTrajectory: '停滞',
      summary: `90天内仍依赖唯一收入来源，安全月数${safetyMonths}个月未改善`,
      majorRisks: ['唯一的收入线一旦断裂，没有第二道防线'],
    }),
    day365: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '缓慢改善', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '停滞', stressTrend: '明显下降',
      careerTrend: '缓慢改善', riskTrend: '明显下降', overallTrajectory: '下降',
      summary: '一年后收入可能上升，但脆弱性不降反升（生活成本跟着涨）',
      majorRisks: ['失业/降薪直接导致生活水平崩塌'],
      hiddenCosts: ['安全感的代价是自由选择的丧失'],
    }),
    year3: buildSnapshot(baseRisk, {
      status: '下降', incomeTrend: '缓慢改善', cashflowTrend: '下降',
      assetTrend: '停滞', freedomTrend: '下降', stressTrend: '明显下降',
      careerTrend: '缓慢改善', riskTrend: '明显下降', overallTrajectory: '下降',
      summary: '三年后即使收入涨了30%，仍然只有一条命脉',
      majorEvents: ['可能经历一次裁员/行业波动导致的深度焦虑'],
      majorRisks: ['家庭责任增加加重单一收入结构的不稳定性'],
      hiddenCosts: ['三年如果分散收入风险，现在已经拥有第二和第三收入来源'],
    }),
  }
}

/**
 * opportunityChasingDegradation
 */
function opportunityChasingDegradation(profile, baseRisk) {
  return {
    day90: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '停滞', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '停滞', stressTrend: '下降',
      careerTrend: '停滞', riskTrend: '下降', overallTrajectory: '停滞',
      summary: '90天内可能在探索新方向，但没有深耕任何一个',
      majorRisks: ['再次切换方向导致之前的积累归零'],
    }),
    day365: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '停滞', cashflowTrend: '下降',
      assetTrend: '停滞', freedomTrend: '停滞', stressTrend: '明显下降',
      careerTrend: '停滞', riskTrend: '明显下降', overallTrajectory: '下降',
      summary: '一年内可能尝试了2-3个新方向，但都没有完成商业验证',
      majorRisks: ['频繁切换导致无法在任何领域积累深度竞争力'],
      hiddenCosts: ['每次切换都重置了学习曲线和社交资本'],
    }),
    year3: buildSnapshot(baseRisk, {
      status: '明显下降', incomeTrend: '停滞', cashflowTrend: '明显下降',
      assetTrend: '停滞', freedomTrend: '下降', stressTrend: '明显下降',
      careerTrend: '下降', riskTrend: '明显下降', overallTrajectory: '明显下降',
      summary: '三年后可能尝试了更多方向但无一深入，时间和精力大量消耗',
      majorRisks: ['机会成本极高——如果选定一个方向深耕3年，现在已是专家'],
      hiddenCosts: ['最大的成本不是失败的尝试，而是没有坚持的尝试'],
    }),
  }
}

/**
 * skillWithoutDistDegradation
 */
function skillWithoutDistDegradation(profile, baseRisk) {
  return {
    day90: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '停滞', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '停滞', stressTrend: '下降',
      careerTrend: '缓慢改善', riskTrend: '停滞', overallTrajectory: '停滞',
      summary: '90天内技能在提升，但市场仍然不知道你的存在',
    }),
    day365: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '停滞', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '停滞', stressTrend: '明显下降',
      careerTrend: '缓慢改善', riskTrend: '下降', overallTrajectory: '停滞',
      summary: '一年后技能可能更强了，但获客仍然困难',
      majorEvents: ['可能因为缺乏渠道错过几个关键项目'],
      majorRisks: ['技能增长曲线与收入增长曲线脱钩'],
      hiddenCosts: ['一年分发渠道的积累窗口被错过了'],
    }),
    year3: buildSnapshot(baseRisk, {
      status: '下降', incomeTrend: '缓慢改善', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '下降', stressTrend: '明显下降',
      careerTrend: '缓慢改善', riskTrend: '明显下降', overallTrajectory: '下降',
      summary: '三年的能力积累没有转化为商业价值，能力和市场之间仍然隔着一堵墙',
      majorRisks: ['最有价值的资产（技能）对市场不可见'],
      hiddenCosts: ['三年如果同时建立分发管道，现在已有稳定客户流'],
    }),
  }
}

/**
 * contentWithoutMonetDegradation
 */
function contentWithoutMonetDegradation(profile, baseRisk) {
  return {
    day90: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '停滞', cashflowTrend: '停滞',
      assetTrend: '缓慢改善', freedomTrend: '停滞', stressTrend: '下降',
      careerTrend: '停滞', riskTrend: '停滞', overallTrajectory: '停滞',
      summary: '90天内继续产出内容，但变现仍然是零',
    }),
    day365: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '停滞', cashflowTrend: '下降',
      assetTrend: '缓慢改善', freedomTrend: '停滞', stressTrend: '明显下降',
      careerTrend: '停滞', riskTrend: '下降', overallTrajectory: '下降',
      summary: '一年后受众可能扩大了，但没有产品可以销售',
      majorEvents: ['看到同赛道创作者开始变现但自己仍在免费输出'],
      majorRisks: ['免费内容消耗时间但无法转化为收入'],
      hiddenCosts: ['如果建立变现闭环，当前受众就是第一波付费用户'],
    }),
    year3: buildSnapshot(baseRisk, {
      status: '明显下降', incomeTrend: '停滞', cashflowTrend: '明显下降',
      assetTrend: '缓慢改善', freedomTrend: '下降', stressTrend: '明显下降',
      careerTrend: '停滞', riskTrend: '明显下降', overallTrajectory: '明显下降',
      summary: '三年后内容资产可能很大，但收入结构和三年前一样',
      majorRisks: ['最大的资产（内容和受众）没有被货币化'],
      hiddenCosts: ['三年内容积累足够支撑完整知识产品线，但从未开始'],
    }),
  }
}

/**
 * businessWithoutSysDegradation
 */
function businessWithoutSysDegradation(profile, baseRisk) {
  return {
    day90: buildSnapshot(baseRisk, {
      status: '缓慢改善', incomeTrend: '缓慢改善', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '下降', stressTrend: '下降',
      careerTrend: '缓慢改善', riskTrend: '停滞', overallTrajectory: '停滞',
      summary: '90天内生意照常运转，但老板仍然亲力亲为',
    }),
    day365: buildSnapshot(baseRisk, {
      status: '缓慢改善', incomeTrend: '缓慢改善', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '明显下降', stressTrend: '明显下降',
      careerTrend: '缓慢改善', riskTrend: '下降', overallTrajectory: '停滞',
      summary: '一年后生意有增长，但增长直接等价于更忙、更累',
      majorEvents: ['收入增长伴随身体健康下降'],
      majorRisks: ['一旦生病或家庭变故，生意直接受影响'],
      hiddenCosts: ['增长的每一分钱都付出了等量或更多的时间'],
    }),
    year3: buildSnapshot(baseRisk, {
      status: '停滞', incomeTrend: '缓慢改善', cashflowTrend: '停滞',
      assetTrend: '停滞', freedomTrend: '明显下降', stressTrend: '明显下降',
      careerTrend: '缓慢改善', riskTrend: '明显下降', overallTrajectory: '下降',
      summary: '三年后可能有了更多利润，但本质上仍是『升级版打工』',
      majorRisks: ['没有系统的生意三年后可能遇到增长天花板或老板体能极限'],
      hiddenCosts: ['如果三年前开始系统化，现在已有更多自由时间或可出售资产'],
    }),
  }
}

/**
 * calculateMissedOpportunities
 */
function calculateMissedOpportunities(profile, primaryGame) {
  const opportunities = []
  const game = primaryGame || 'GENERIC'
  const map = {
    SELLING_TIME: ['建立可复用资产的机会', '投资于学习而非加班的窗口', '建立第二收入的起步期'],
    SINGLE_INCOME: ['分散收入来源的机会', '在不依赖雇主的领域建立能力', '利用当前收入投资未来资产'],
    OPPORTUNITY_CHASING: ['深耕单一方向成为专家的窗口', '完成首次商业验证的机会', '累积行业深度信任的时间'],
    SKILL_WITHOUT_DISTRIBUTION: ['建立内容分发渠道的起步期', '让技能被市场看到的窗口'],
    CONTENT_WITHOUT_MONETIZATION: ['将内容转化为可销售产品的窗口', '验证变现闭环的机会', '建立销售能力的时间'],
    BUSINESS_WITHOUT_SYSTEM: ['建立标准化流程的窗口', '培训团队替代老板的时间', '自动化流程建设期'],
    GENERIC: ['建设可复制资产的时间', '分散收入来源的窗口'],
  }
  return map[game] || map.GENERIC
}

/**
 * calculateProbability — 推演概率（非科学预测，表示当前模式的持续性置信度）
 */
function calculateProbability(profile, wrongGameResult, _world) {
  const game = wrongGameResult && wrongGameResult.primaryWrongGame
    ? wrongGameResult.primaryWrongGame.gameType
    : null

  // 越高 = 当前模式越可能持续
  if (!game || game === 'UNKNOWN_GAME') return 60

  const readiness = profile.strategyReadinessScore || 0
  // readiness 越低 → 越难跳出当前模式 → World A 概率越高
  return Math.min(95, Math.max(20, 100 - readiness))
}

/**
 * calculateWorldAConfidence
 */
function calculateWorldAConfidence(profile, wrongGameResult) {
  let conf = 60
  const game = wrongGameResult && wrongGameResult.primaryWrongGame
    ? wrongGameResult.primaryWrongGame.gameType
    : null

  if (game && game !== 'UNKNOWN_GAME') conf += 15
  if (profile.evidence && profile.evidence.ruleHits && profile.evidence.ruleHits.length >= 3) conf += 10
  if (profile.wealthStage) conf += 5

  return Math.min(90, conf)
}

/**
 * buildSnapshot — 基于模板构建快照
 */
function buildSnapshot(base, overrides) {
  const snap = {}
  for (const key of Object.keys(base)) {
    if (Array.isArray(base[key])) {
      snap[key] = overrides[key] || []
    } else {
      snap[key] = overrides[key] || base[key]
    }
  }
  return snap
}

/**
 * applyPattern — 应用模式（同输入同输出）
 */
function applyPattern(pattern, _profile, _period) {
  // 直接返回模式结果（规则驱动）
  return pattern
}

function buildWorldATrendRules(profile, _primaryGame) {
  const safetyMonths = profile.reality.safetyMonths || 0
  return [
    {
      tag: 'incomeTrend', direction: '停滞',
      ruleId: 'RULE_WORLDA_INCOME_STAGNANT',
      sourceFields: ['reality.monthlyIncome', 'assets.reusableAssets'],
      sourceValues: [`${profile.reality.monthlyIncome}`, `${(profile.assets.reusableAssets || []).length}`],
      assumptions: ['保持现有收入模式'],
      conditions: '没有新增收入来源',
    },
    {
      tag: 'cashflowTrend', direction: safetyMonths < 3 ? '下降' : '停滞',
      ruleId: 'RULE_WORLDA_CASHFLOW',
      sourceFields: ['reality.safetyMonths'],
      sourceValues: [`${safetyMonths}`],
      assumptions: ['安全月数不变'],
      conditions: `安全月数当前=${safetyMonths}`,
    },
  ]
}

function buildWorldAAssumptions(profile) {
  const assumptions = [
    '用户维持当前行为模式不变',
    '外部经济环境无重大变化',
    '没有意外重大事件迫使改变',
    '没有主动开始执行翻身战略',
  ]
  if ((profile.reality.safetyMonths || 0) < 3) {
    assumptions.push('安全垫不会自行改善')
  }
  return assumptions
}

module.exports = {
  simulateWorldA,
}
