/**
 * core/turnaround-os/engines/leverageEngineV6.js
 *
 * V6 杠杆引擎
 * 基于用户画像推荐唯一主杠杆 + 最多2个辅助杠杆
 * 纯规则引擎，不接AI
 *
 * @version 6.0.0
 */

const {
  LEVERAGE_TYPES,
  LEVERAGE_LABELS,
  WEALTH_STAGES,
} = require('../constants')

/**
 * determineLeverage — 确定最适合用户的杠杆方案
 *
 * @param {Object} profile — identityEngine 输出
 * @param {Object} wrongGameResult — wrongGameEngine 输出
 * @returns {Object} 杠杆推荐结果
 */
function determineLeverage(profile, wrongGameResult) {
  const allLeverages = evaluateAllLeverages(profile, wrongGameResult)

  // 按 fitScore 降序
  allLeverages.sort((a, b) => b.fitScore - a.fitScore)

  // primary = 第一个
  const primary = allLeverages[0]
  // secondary = 下面两个不同维度的
  const secondary1 = findSecondary(allLeverages, primary)
  const secondary2 = findSecondary(allLeverages, primary, secondary1)

  // rejected = 剩余的（至少3个）
  const used = new Set([primary.type])
  if (secondary1) used.add(secondary1.type)
  if (secondary2) used.add(secondary2.type)
  const rejected = allLeverages.filter(l => !used.has(l.type))

  return {
    primaryLeverage: formatLeverageResult(primary),
    secondaryLeverages: [
      secondary1 ? formatLeverageResult(secondary1) : null,
      secondary2 ? formatLeverageResult(secondary2) : null,
    ].filter(Boolean),
    rejectedLeverages: rejected.map(l => ({
      type: l.type,
      label: l.label,
      fitScore: l.fitScore,
      reason: l.rejectionReason || '综合评分低于主推荐方案',
      blockingFactors: l.blockingFactors || [],
    })),
    allScores: allLeverages.map(l => ({
      type: l.type,
      label: l.label,
      fitScore: l.fitScore,
    })),
  }
}

/**
 * findSecondary — 找到不同于 primary 和已选的辅助杠杆
 */
function findSecondary(list, primary, existing) {
  const used = new Set([primary.type])
  if (existing) used.add(existing.type)
  return list.find(l => !used.has(l.type)) || null
}

/**
 * evaluateAllLeverages — 评估所有八类杠杆
 */
function evaluateAllLeverages(profile, wrongGameResult) {
  const primaryWrongGame = wrongGameResult && wrongGameResult.primaryWrongGame
    ? wrongGameResult.primaryWrongGame.gameType
    : null

  return [
    evaluateLeverage(profile, 'AI_PRODUCTIVITY', primaryWrongGame),
    evaluateLeverage(profile, 'CONTENT_DISTRIBUTION', primaryWrongGame),
    evaluateLeverage(profile, 'SALES_CONVERSION', primaryWrongGame),
    evaluateLeverage(profile, 'KNOWLEDGE_PRODUCT', primaryWrongGame),
    evaluateLeverage(profile, 'SERVICE_PRODUCTIZATION', primaryWrongGame),
    evaluateLeverage(profile, 'AUTOMATION_SYSTEM', primaryWrongGame),
    evaluateLeverage(profile, 'TEAM_CAPITAL', primaryWrongGame),
    evaluateLeverage(profile, 'ASSET_COMPOUNDING', primaryWrongGame),
  ]
}

/**
 * evaluateLeverage — 八维评分模型
 */
function evaluateLeverage(profile, type, primaryWrongGame) {
  const stageFit = stageFitScore(profile, type)
  const cashflowFit = cashflowFitScore(profile, type)
  const timeFit = timeFitScore(profile, type)
  const capabilityFit = capabilityFitScore(profile, type)
  const assetFit = assetFitScore(profile, type)
  const riskFit = riskFitScore(profile, type)
  const gameFit = gameFitScore(profile, type, primaryWrongGame)
  const proofSpeed = proofSpeedScore(profile, type)

  const dimensions = [
    { name: 'stageFit', score: stageFit },
    { name: 'cashflowFit', score: cashflowFit },
    { name: 'timeFit', score: timeFit },
    { name: 'capabilityFit', score: capabilityFit },
    { name: 'assetFit', score: assetFit },
    { name: 'riskFit', score: riskFit },
    { name: 'gameFit', score: gameFit },
    { name: 'proofSpeed', score: proofSpeed },
  ]

  const weights = [15, 15, 10, 20, 15, 10, 10, 5]
  let total = 0
  for (let i = 0; i < dimensions.length; i++) {
    total += dimensions[i].score * weights[i]
  }
  const fitScore = Math.round(total / 100)

  const blockingFactors = []
  const rejectionReason = buildRejectionReason(type, profile, fitScore, blockingFactors)

  return {
    type,
    label: LEVERAGE_LABELS[type],
    fitScore,
    dimensions,
    blockingFactors,
    rejectionReason,
  }
}

/**
 * stageFit — 阶段适配度
 */
function stageFitScore(profile, type) {
  const stage = profile.wealthStage

  const stageMap = {
    AI_PRODUCTIVITY:         { SURVIVAL: 80, STABILITY: 90, LEVERAGE: 85, SYSTEM: 70, COMPOUNDING: 50 },
    CONTENT_DISTRIBUTION:    { SURVIVAL: 40, STABILITY: 70, LEVERAGE: 90, SYSTEM: 85, COMPOUNDING: 60 },
    SALES_CONVERSION:        { SURVIVAL: 50, STABILITY: 80, LEVERAGE: 90, SYSTEM: 80, COMPOUNDING: 60 },
    KNOWLEDGE_PRODUCT:       { SURVIVAL: 20, STABILITY: 60, LEVERAGE: 85, SYSTEM: 90, COMPOUNDING: 70 },
    SERVICE_PRODUCTIZATION:  { SURVIVAL: 30, STABILITY: 70, LEVERAGE: 90, SYSTEM: 85, COMPOUNDING: 65 },
    AUTOMATION_SYSTEM:       { SURVIVAL: 10, STABILITY: 40, LEVERAGE: 75, SYSTEM: 95, COMPOUNDING: 80 },
    TEAM_CAPITAL:            { SURVIVAL: 5,  STABILITY: 20, LEVERAGE: 50, SYSTEM: 80, COMPOUNDING: 95 },
    ASSET_COMPOUNDING:       { SURVIVAL: 5,  STABILITY: 15, LEVERAGE: 40, SYSTEM: 70, COMPOUNDING: 95 },
  }

  return (stageMap[type] && stageMap[type][stage]) || 30
}

/**
 * cashflowFit — 现金流适配度
 */
function cashflowFitScore(profile, type) {
  const safetyMonths = profile.reality.safetyMonths || 0
  const debt = profile.reality.debt || 0
  const monthlyIncome = profile.reality.monthlyIncome || 0

  // 生存期用户不能承受高风险投入
  const needCashflow = safetyMonths < 3 || debt > monthlyIncome * 3

  const cashflowMap = {
    AI_PRODUCTIVITY:         needCashflow ? 90 : 70,
    CONTENT_DISTRIBUTION:    needCashflow ? 60 : 80,
    SALES_CONVERSION:        needCashflow ? 50 : 85,
    KNOWLEDGE_PRODUCT:       needCashflow ? 20 : 70,
    SERVICE_PRODUCTIZATION:  needCashflow ? 40 : 75,
    AUTOMATION_SYSTEM:       needCashflow ? 15 : 65,
    TEAM_CAPITAL:            needCashflow ? 5  : 40,
    ASSET_COMPOUNDING:       needCashflow ? 5  : 30,
  }

  return (cashflowMap[type]) || 50
}

/**
 * timeFit — 时间适配度
 */
function timeFitScore(profile, type) {
  const hours = profile.reality.availableHoursPerWeek || 0

  // 时间极少者不适合需要大量运营的杠杆
  const timeMap = {
    AI_PRODUCTIVITY:         hours < 5 ? 90 : 80,
    CONTENT_DISTRIBUTION:    hours < 5 ? 20 : 70,
    SALES_CONVERSION:        hours < 5 ? 30 : 70,
    KNOWLEDGE_PRODUCT:       hours < 5 ? 15 : 65,
    SERVICE_PRODUCTIZATION:  hours < 5 ? 25 : 60,
    AUTOMATION_SYSTEM:       hours < 5 ? 20 : 60,
    TEAM_CAPITAL:            hours < 5 ? 10 : 50,
    ASSET_COMPOUNDING:       hours < 5 ? 10 : 50,
  }

  return (timeMap[type]) || 50
}

/**
 * capabilityFit — 能力适配度
 */
function capabilityFitScore(profile, type) {
  const caps = profile.capabilities

  const capReqMap = {
    AI_PRODUCTIVITY:         [{ key: 'aiAdaptability', w: 0.5 }, { key: 'learning', w: 0.3 }, { key: 'execution', w: 0.2 }],
    CONTENT_DISTRIBUTION:    [{ key: 'content', w: 0.6 }, { key: 'communication', w: 0.3 }, { key: 'execution', w: 0.1 }],
    SALES_CONVERSION:        [{ key: 'sales', w: 0.5 }, { key: 'communication', w: 0.3 }, { key: 'execution', w: 0.2 }],
    KNOWLEDGE_PRODUCT:       [{ key: 'content', w: 0.4 }, { key: 'systemThinking', w: 0.3 }, { key: 'sales', w: 0.3 }],
    SERVICE_PRODUCTIZATION:  [{ key: 'systemThinking', w: 0.5 }, { key: 'communication', w: 0.2 }, { key: 'sales', w: 0.3 }],
    AUTOMATION_SYSTEM:       [{ key: 'systemThinking', w: 0.6 }, { key: 'aiAdaptability', w: 0.2 }, { key: 'execution', w: 0.2 }],
    TEAM_CAPITAL:            [{ key: 'communication', w: 0.4 }, { key: 'systemThinking', w: 0.3 }, { key: 'sales', w: 0.3 }],
    ASSET_COMPOUNDING:       [{ key: 'systemThinking', w: 0.5 }, { key: 'discipline', w: 0.3 }, { key: 'learning', w: 0.2 }],
  }

  const reqs = capReqMap[type] || []
  let score = 0
  for (const req of reqs) {
    score += (caps[req.key] || 0) * req.w
  }
  return Math.round(Math.max(10, Math.min(100, score)))
}

/**
 * assetFit — 资产适配度
 */
function assetFitScore(profile, type) {
  const assets = profile.assets
  const hasSkills = (assets.skills || []).length > 0
  const hasAudience = (assets.audience || []).length > 0
  const hasReusable = (assets.reusableAssets || []).length > 0
  const hasResources = (assets.resources || []).length > 0
  const hasExp = (assets.experiences || []).length > 0

  let score = 30
  switch (type) {
    case 'AI_PRODUCTIVITY':
      if (hasExp) score += 30
      break
    case 'CONTENT_DISTRIBUTION':
      if (hasAudience) score += 30
      if (hasSkills) score += 15
      break
    case 'SALES_CONVERSION':
      if (hasAudience) score += 25
      if (hasResources) score += 15
      break
    case 'KNOWLEDGE_PRODUCT':
      if (hasSkills || hasExp) score += 25
      if (hasAudience) score += 20
      break
    case 'SERVICE_PRODUCTIZATION':
      if (hasSkills || hasExp) score += 30
      if (hasReusable) score += 15
      break
    case 'AUTOMATION_SYSTEM':
      if (hasReusable) score += 25
      if (hasResources) score += 15
      break
    case 'TEAM_CAPITAL':
      if (hasResources) score += 20
      if (hasReusable) score += 10
      break
    case 'ASSET_COMPOUNDING':
      if (hasReusable) score += 25
      if (hasResources) score += 15
      break
  }
  return Math.min(100, score)
}

/**
 * riskFit — 风险适配度
 */
function riskFitScore(profile, type) {
  const safetyMonths = profile.reality.safetyMonths || 0
  const debt = profile.reality.debt || 0
  const monthlyIncome = profile.reality.monthlyIncome || 0
  const riskTolerance = profile.psychology.riskTolerance || 0

  const isRisky = safetyMonths < 3 || debt > monthlyIncome * 6
  const isVeryRisky = safetyMonths < 1

  // 高风险杠杆类型
  const isHighRiskLeverage = ['TEAM_CAPITAL', 'ASSET_COMPOUNDING', 'KNOWLEDGE_PRODUCT'].includes(type)

  if (isVeryRisky && isHighRiskLeverage) return 5
  if (isRisky && isHighRiskLeverage) return 15
  if (isVeryRisky) return 30
  if (isRisky) return 50

  // 正常情况：风险承受力越强，高风险杠杆分越高
  if (isHighRiskLeverage) return Math.min(100, 40 + riskTolerance * 0.6)
  return 70
}

/**
 * gameFit — 对错误游戏的针对度
 */
function gameFitScore(profile, type, primaryWrongGame) {
  if (!primaryWrongGame) return 50

  const gameLeverageMap = {
    SELLING_TIME:                  { AI_PRODUCTIVITY: 85, SERVICE_PRODUCTIZATION: 80, KNOWLEDGE_PRODUCT: 75, AUTOMATION_SYSTEM: 70 },
    SINGLE_INCOME:                 { SALES_CONVERSION: 80, CONTENT_DISTRIBUTION: 75, KNOWLEDGE_PRODUCT: 70, SERVICE_PRODUCTIZATION: 70 },
    OPPORTUNITY_CHASING:           { SERVICE_PRODUCTIZATION: 70, KNOWLEDGE_PRODUCT: 65, SALES_CONVERSION: 60 },
    SKILL_WITHOUT_DISTRIBUTION:    { CONTENT_DISTRIBUTION: 85, SALES_CONVERSION: 75, AI_PRODUCTIVITY: 60 },
    CONTENT_WITHOUT_MONETIZATION:  { SALES_CONVERSION: 85, KNOWLEDGE_PRODUCT: 85, SERVICE_PRODUCTIZATION: 65 },
    BUSINESS_WITHOUT_SYSTEM:       { AUTOMATION_SYSTEM: 90, TEAM_CAPITAL: 70, AI_PRODUCTIVITY: 65 },
  }

  const scores = gameLeverageMap[primaryWrongGame] || {}
  return scores[type] || 40
}

/**
 * proofSpeedScore — 验证速度
 */
function proofSpeedScore(profile, type) {
  const proofSpeedMap = {
    AI_PRODUCTIVITY:         90, // 快速见效
    CONTENT_DISTRIBUTION:    60, // 需要积累
    SALES_CONVERSION:        70, // 可快速测试
    KNOWLEDGE_PRODUCT:       40, // 需要一定积累
    SERVICE_PRODUCTIZATION:  65, // 中速
    AUTOMATION_SYSTEM:       35, // 需要时间建设
    TEAM_CAPITAL:            20, // 慢
    ASSET_COMPOUNDING:       15, // 最慢
  }

  return proofSpeedMap[type] || 50
}

/**
 * buildRejectionReason — 构建有具体原因的被拒理由
 */
function buildRejectionReason(type, profile, fitScore, blockingFactors) {
  const stage = profile.wealthStage
  const safetyMonths = profile.reality.safetyMonths || 0
  const caps = profile.capabilities
  const hours = profile.reality.availableHoursPerWeek || 0
  const hasSkills = (profile.assets.skills || []).length > 0
  const hasAudience = (profile.assets.audience || []).length > 0

  const reasons = []

  switch (type) {
    case 'TEAM_CAPITAL':
      if (safetyMonths < 7) {
        blockingFactors.push('团队建设需要至少6个月以上的现金流缓冲')
        reasons.push(`当前安全月数${safetyMonths}个月，建议至少7个月缓冲后再考虑团队扩张`)
      }
      if (stage === WEALTH_STAGES.SURVIVAL) {
        blockingFactors.push('处于生存阶段，不应承担团队管理风险')
        reasons.push('生存期不应冒险扩张团队')
      }
      if (stage === WEALTH_STAGES.STABILITY) {
        blockingFactors.push('稳定性阶段应以个人积累为主，团队扩张风险过高')
        reasons.push('先巩固个人收入结构再考虑团队')
      }
      break
    case 'ASSET_COMPOUNDING':
      if (safetyMonths < 7) {
        blockingFactors.push('资产复利需要至少6-12个月的安全垫')
        reasons.push(`安全月数${safetyMonths}个月，远低于复利投资所需缓冲`)
      }
      if (stage === WEALTH_STAGES.SURVIVAL || stage === WEALTH_STAGES.STABILITY) {
        reasons.push('尚未具备可复利资产基础')
        blockingFactors.push('缺乏基础资产积累')
      }
      if (stage !== WEALTH_STAGES.COMPOUNDING) {
        blockingFactors.push('资产复利阶段要求已有可复制系统和稳定现金流')
        reasons.push(`当前处于${stage}阶段，复利需要先完成前面阶段的积累`)
      }
      break
    case 'KNOWLEDGE_PRODUCT':
      if (!(caps.content >= 30 || caps.communication >= 30)) {
        blockingFactors.push('内容/表达能力不足，知识产品化难度高')
        reasons.push(`内容能力${caps.content}分、沟通能力${caps.communication}分，暂时无法支撑知识产品`)
      }
      if (safetyMonths < 2) {
        reasons.push('安全月数不足，知识产品验证周期长，当前优先修复现金流')
        blockingFactors.push('生存压力下不适合做长周期产品')
      }
      if (!hasSalesChannel(caps, profile.assets)) {
        blockingFactors.push('缺少可验证的销售渠道或受众基础')
        reasons.push('没有销售渠道或受众，知识产品的冷启成本过高')
      }
      if (caps.sales < 30) {
        blockingFactors.push('销售能力不足，知识产品需要较强的成交能力')
        reasons.push(`销售能力${caps.sales}分，知识产品变现需要销售基础`)
      }
      if (stage === WEALTH_STAGES.STABILITY || stage === WEALTH_STAGES.LEVERAGE) {
        blockingFactors.push('当下面临更直接的紧急问题，知识产品周期较长')
        reasons.push('存在更适合当前阶段的短周期杠杆选项')
      }
      break
    case 'CONTENT_DISTRIBUTION':
      if (hours < 5) {
        blockingFactors.push('可支配时间极低，无法持续内容输出')
        reasons.push(`每周可用${hours}小时，不足以维持内容分发节奏`)
      }
      if (!hasSkills && !hasAudience) {
        blockingFactors.push('缺乏内容创作技能和初始受众')
        reasons.push('无内容技能且无初始受众，内容分发冷启动周期过长')
      }
      break
    case 'AUTOMATION_SYSTEM':
      if (caps.systemThinking < 30) {
        blockingFactors.push('系统化思维不足，无法有效设计和维护自动化')
        reasons.push(`系统化思维仅${caps.systemThinking}分`)
      }
      break
    case 'SALES_CONVERSION':
      if (!hasAudience && caps.sales < 40) {
        blockingFactors.push('无受众基础且销售能力较弱')
        reasons.push(`无受众渠道，销售能力${caps.sales}分，成交杠杆缺乏基础`)
      }
      break
    case 'SERVICE_PRODUCTIZATION':
      if (!hasSkills) {
        blockingFactors.push('无可服务的专业技能')
        reasons.push('缺乏明确的专业技能，无法进行服务产品化')
      }
      if (caps.systemThinking < 30) {
        blockingFactors.push('系统化思维不足，难以将服务抽象为标准产品')
        reasons.push(`系统化思维${caps.systemThinking}分，产品化需要抽象和标准化能力`)
      }
      break
    case 'AI_PRODUCTIVITY':
      if (caps.aiAdaptability < 20) {
        blockingFactors.push('AI适应能力偏低')
        reasons.push(`AI适应度${caps.aiAdaptability}分，使用AI工具的门槛较高`)
      }
      break
    default:
      if (fitScore < 60) {
        reasons.push('综合评分低于主推荐方案')
        blockingFactors.push('多维适配度综合偏低')
      } else if (fitScore < 80) {
        blockingFactors.push('综合竞争力略低于主推荐方案')
        reasons.push('多维评分总和稍逊于当前最优选择')
      }
  }

  return reasons.length > 0 ? reasons.join('；') : '综合评分低于主推荐方案'
}

function hasSalesChannel(caps, assets) {
  return (caps.sales || 0) >= 40 || (assets.audience || []).length > 0
}

/**
 * formatLeverageResult
 */
function formatLeverageResult(lever) {
  return {
    type: lever.type,
    label: lever.label,
    fitScore: lever.fitScore,
    dimensions: lever.dimensions,
    blockingFactors: lever.blockingFactors || [],
  }
}

module.exports = {
  determineLeverage,
}
