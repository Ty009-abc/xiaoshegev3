/**
 * core/turnaround-os/engines/wrongGameEngineV6.js
 *
 * V6 错误游戏识别引擎
 * 判断用户正在玩什么错误游戏
 * 纯规则引擎，不接AI
 *
 * @version 6.0.0
 */

const {
  WRONG_GAMES,
  WRONG_GAME_LABELS,
  WEALTH_STAGES,
} = require('../constants')

/**
 * detectWrongGame — 检测用户正在玩的错误游戏
 *
 * @param {Object} profile — 来自 identityEngineV6 的输出
 * @returns {Object} wrong game 检测结果
 */
function detectWrongGame(profile) {
  const games = evaluateAllGames(profile)

  // 按 score 降序排列（分高 = 该游戏越匹配）
  games.sort((a, b) => b.score - a.score)

  // 至少需要 2 个证据才能作为 primary
  const primary = games.find(g => g.evidence.length >= 2 && g.score > 0)
  // secondary 不能与 primary 相同类型
  const secondary1 = primary
    ? games.find(g => g.gameType !== primary.gameType && g.evidence.length >= 1 && g.score > 0)
    : null
  const secondary2 = secondary1
    ? games.find(g => g.gameType !== primary.gameType && g.gameType !== secondary1.gameType && g.evidence.length >= 1 && g.score > 0)
    : null

  const result = {
    primaryWrongGame: primary ? formatGameResult(primary) : null,
    secondaryWrongGames: [],
    allScores: games.map(g => ({
      gameType: g.gameType,
      gameLabel: g.gameLabel,
      score: g.score,
      evidenceCount: g.evidence.length,
    })),
    confidence: 0,
  }

  if (secondary1) result.secondaryWrongGames.push(formatGameResult(secondary1))
  if (secondary2) result.secondaryWrongGames.push(formatGameResult(secondary2))

  // 证据不足 → UNKNOWN
  if (!primary) {
    result.primaryWrongGame = createUnknownGame(profile)
    result.confidence = 10
    return result
  }

  result.confidence = Math.min(90, 40 + primary.evidence.length * 15)
  return result
}

/**
 * evaluateAllGames — 评估所有六类错误游戏
 */
function evaluateAllGames(profile) {
  const { reality, capabilities, psychology, assets, constraints } = profile

  return [
    evaluateSellingTime(profile, reality, capabilities, assets),
    evaluateSingleIncome(profile, reality, assets, constraints),
    evaluateOpportunityChasing(profile, psychology, capabilities, assets),
    evaluateSkillWithoutDistribution(profile, capabilities, assets),
    evaluateContentWithoutMonetization(profile, capabilities, assets),
    evaluateBusinessWithoutSystem(profile, capabilities, assets),
  ]
}

/**
 * SELLING_TIME — 收入与工作时间高度绑定
 */
function evaluateSellingTime(profile, reality, capabilities, assets) {
  const evidence = []
  let score = 0

  const occType = profile.identity && profile.identity.occupationType

  // 收入稳定性高 + 无资产 → 稳定出售时间
  if ((reality.incomeStability || 0) >= 60 && (assets.reusableAssets || []).length === 0) {
    evidence.push({
      ruleId: 'RULE_SELL_HIGH_STABLE_NO_ASSET',
      sourceField: 'incomeStability + reusableAssets',
      sourceValue: `incomeStability=${reality.incomeStability}, reusableAssets=0`,
      reason: '收入稳定但无任何可重复使用资产，停止工作则收入归零',
      scoreContribution: 25,
    })
    score += 25
  }

  // 收入直接依赖本人时间 — 可支配时间极少
  if ((reality.availableHoursPerWeek || 0) < 7 && (reality.monthlyIncome || 0) > 0) {
    evidence.push({
      ruleId: 'RULE_SELL_LOW_DISPOSABLE_TIME',
      sourceField: 'availableHoursPerWeek',
      sourceValue: `${reality.availableHoursPerWeek}h/wk`,
      reason: '每周可自由支配时间极低，说明收入与时间深度绑定',
      scoreContribution: 20,
    })
    score += 20
  }

  // 打工者特有信号 — 低自主权
  if (occType === 'employee' && (capabilities.systemThinking || 0) < 30 && (assets.reusableAssets || []).length === 0) {
    evidence.push({
      ruleId: 'RULE_SELL_EMPLOYEE_NO_SYSTEM',
      sourceField: 'occupationType + systemThinking',
      sourceValue: `employee, systemThinking=${capabilities.systemThinking}`,
      reason: '以雇员身份出售时间，且未建立系统化能力',
      scoreContribution: 15,
    })
    score += 15
  }

  // 自由职业者但客户依赖本人
  if (occType === 'freelancer' && (assets.reusableAssets || []).length === 0) {
    evidence.push({
      ruleId: 'RULE_SELL_FREELANCER_NO_ASSET',
      sourceField: 'occupationType + reusableAssets',
      sourceValue: `freelancer, reusableAssets=0`,
      reason: '自由职业但收入仍与本人直接劳动绑定，未产品化',
      scoreContribution: 20,
    })
    score += 20
  }

  return {
    gameType: WRONG_GAMES.SELLING_TIME,
    gameLabel: WRONG_GAME_LABELS.SELLING_TIME,
    score: Math.min(100, score),
    evidence,
    hiddenCost: '你每月的自由支配时间都用于换钱了，而这些时间本可以用来建立资产',
    threeYearConsequence: '三年后你的收入仍然等于你的时间 × 时薪，没有增长飞轮',
    exitCondition: '至少建立一个不直接依赖个人时间的收入来源或可复用资产',
  }
}

/**
 * SINGLE_INCOME — 只有一个收入来源
 */
function evaluateSingleIncome(profile, reality, assets, constraints) {
  const evidence = []
  let score = 0
  const safetyMonths = reality.safetyMonths || 0

  // 低安全月数 + 有家庭压力 → 单一收入极其危险
  if (safetyMonths < 3 && (constraints.familyPressure || []).length > 0) {
    evidence.push({
      ruleId: 'RULE_SINGLE_LOW_SAFETY_FAMILY',
      sourceField: 'safetyMonths + familyPressure',
      sourceValue: `safetyMonths=${safetyMonths}, familyPressure=true`,
      reason: '安全缓冲不足且承担家庭责任，失去唯一收入将直接崩塌',
      scoreContribution: 30,
    })
    score += 30
  }

  // 无第二收入来源
  if ((assets.reusableAssets || []).length === 0 && (assets.resources || []).length < 2) {
    evidence.push({
      ruleId: 'RULE_SINGLE_NO_SECONDARY_STREAM',
      sourceField: 'reusableAssets + resources',
      sourceValue: `reusableAssets=${(assets.reusableAssets||[]).length}, resources=${(assets.resources||[]).length}`,
      reason: '没有第二收入渠道或可复用资源，收入来源单一',
      scoreContribution: 25,
    })
    score += 25
  }

  // 高收入稳定性反成陷阱 — 单一且过度稳定
  if ((reality.incomeStability || 0) >= 70 && safetyMonths < 6) {
    evidence.push({
      ruleId: 'RULE_SINGLE_STABLE_BUT_VULNERABLE',
      sourceField: 'incomeStability + safetyMonths',
      sourceValue: `incomeStability=${reality.incomeStability}, safetyMonths=${safetyMonths}`,
      reason: '收入虽稳定但安全垫薄，一旦中断没有缓冲',
      scoreContribution: 20,
    })
    score += 20
  }

  return {
    gameType: WRONG_GAMES.SINGLE_INCOME,
    gameLabel: WRONG_GAME_LABELS.SINGLE_INCOME,
    score: Math.min(100, score),
    evidence,
    hiddenCost: '每月的安全感其实建立在唯一的收入线之上，这条线一旦断了你没有任何 B 计划',
    threeYearConsequence: '三年后你仍在同一条跑道上，只是起薪可能涨了 20%，但收入结构没有质变',
    exitCondition: '建立至少一个不依赖主要雇主的收入渠道',
  }
}

/**
 * OPPORTUNITY_CHASING — 不断追逐新机会但无积累
 */
function evaluateOpportunityChasing(profile, psychology, capabilities, assets) {
  const evidence = []
  let score = 0

  const desire = psychology.desire || 0
  const patience = psychology.patience || 0
  const discipline = capabilities.discipline || 0
  const execution = capabilities.execution || 0

  // 高欲望 + 低耐心 + 低纪律 → 追逐型
  if (desire >= 60 && patience <= 30 && discipline <= 30) {
    evidence.push({
      ruleId: 'RULE_CHASE_HIGH_DESIRE_LOW_PATIENCE',
      sourceField: 'desire + patience + discipline',
      sourceValue: `desire=${desire}, patience=${patience}, discipline=${discipline}`,
      reason: '强烈渴望改变但缺乏耐心和纪律，容易频繁切换方向',
      scoreContribution: 25,
    })
    score += 25
  }

  // 多技能但无资产积累 → 样样通样样松
  if ((assets.skills || []).length >= 3 && (assets.reusableAssets || []).length === 0 && execution <= 40) {
    evidence.push({
      ruleId: 'RULE_CHASE_MANY_SKILLS_NO_ASSET',
      sourceField: 'skills + reusableAssets + execution',
      sourceValue: `skills=${(assets.skills||[]).length}, reusableAssets=0, execution=${execution}`,
      reason: '多项技能但未转化为可复用资产，可能在不同方向间切换',
      scoreContribution: 20,
    })
    score += 20
  }

  // 高焦虑 + 高欲望 + 低自知 → 焦虑驱动追逐
  if ((psychology.anxiety || 0) >= 70 && desire >= 50 && (psychology.selfAwareness || 0) <= 40) {
    evidence.push({
      ruleId: 'RULE_CHASE_ANXIETY_DRIVEN',
      sourceField: 'anxiety + desire + selfAwareness',
      sourceValue: `anxiety=${psychology.anxiety}, desire=${desire}, selfAwareness=${psychology.selfAwareness}`,
      reason: '高焦虑驱动高欲望，低自我认知可能使人不断转向新方向以求快速解脱',
      scoreContribution: 15,
    })
    score += 15
  }

  return {
    gameType: WRONG_GAMES.OPPORTUNITY_CHASING,
    gameLabel: WRONG_GAME_LABELS.OPPORTUNITY_CHASING,
    score: Math.min(100, score),
    evidence,
    hiddenCost: '每一次换方向都重置了积累曲线，三年后你可能什么都试过但什么都不深',
    threeYearConsequence: '三年后技能浅尝辄止，收入模式没有变化，但年龄和焦虑都在增长',
    exitCondition: '选定一个方向深耕至少90天，完成一次完整商业验证',
  }
}

/**
 * SKILL_WITHOUT_DISTRIBUTION — 有技能无分发
 */
function evaluateSkillWithoutDistribution(profile, capabilities, assets) {
  const evidence = []
  let score = 0

  const sales = capabilities.sales || 0
  const content = capabilities.content || 0
  const comm = capabilities.communication || 0
  const hasSkills = (assets.skills || []).length >= 2
  const hasExp = (assets.experiences || []).length >= 1
  const hasAudience = (assets.audience || []).length > 0

  // 有技能/经验但无获客渠道
  if ((hasSkills || hasExp) && !hasAudience && sales <= 30) {
    evidence.push({
      ruleId: 'RULE_SKILL_NO_DISTRIBUTION',
      sourceField: 'skills + experiences + audience + sales',
      sourceValue: `skills=${(assets.skills||[]).length}, exps=${(assets.experiences||[]).length}, audience=${hasAudience}, sales=${sales}`,
      reason: '有价值的能力但缺乏获客渠道，技能无法有效分发',
      scoreContribution: 25,
    })
    score += 25
  }

  // 内容能力弱 + 传播能力弱
  if (content <= 30 && comm <= 30 && sales <= 30) {
    evidence.push({
      ruleId: 'RULE_SKILL_NO_CONTENT_COMM',
      sourceField: 'content + communication + sales',
      sourceValue: `content=${content}, comm=${comm}, sales=${sales}`,
      reason: '内容、沟通、销售三项分发相关能力均薄弱，技能无法触达市场',
      scoreContribution: 20,
    })
    score += 20
  }

  // 自由职业者 + 无客户渠道
  const occType = profile.identity && profile.identity.occupationType
  if (occType === 'freelancer' && !hasAudience && sales <= 40) {
    evidence.push({
      ruleId: 'RULE_SKILL_FREELANCER_NO_CHANNEL',
      sourceField: 'occupationType + audience + sales',
      sourceValue: `freelancer, audience=${hasAudience}, sales=${sales}`,
      reason: '自由职业者无稳定获客渠道，每次找客户都从零开始',
      scoreContribution: 20,
    })
    score += 20
  }

  return {
    gameType: WRONG_GAMES.SKILL_WITHOUT_DISTRIBUTION,
    gameLabel: WRONG_GAME_LABELS.SKILL_WITHOUT_DISTRIBUTION,
    score: Math.min(100, score),
    evidence,
    hiddenCost: '你的能力存在但隐形的——市场不知道你，你也不知道如何让市场知道',
    threeYearConsequence: '三年后能力可能更强了，但发现和今天一样困难',
    exitCondition: '建立至少一个稳定的获客渠道或分发通道',
  }
}

/**
 * CONTENT_WITHOUT_MONETIZATION — 有内容/流量但无变现
 */
function evaluateContentWithoutMonetization(profile, capabilities, assets) {
  const evidence = []
  let score = 0

  const hasAudience = (assets.audience || []).length > 0
  const contentCap = capabilities.content || 0
  const sales = capabilities.sales || 0
  const hasReusable = (assets.reusableAssets || []).length > 0
  const occType = profile.identity && profile.identity.occupationType

  // 有受众/内容能力但无变现
  if ((hasAudience || contentCap >= 50) && sales <= 30 && !hasReusable) {
    evidence.push({
      ruleId: 'RULE_CONTENT_NO_MONETIZATION',
      sourceField: 'audience + content + sales + reusableAssets',
      sourceValue: `audience=${hasAudience}, content=${contentCap}, sales=${sales}, reusableAssets=${hasReusable}`,
      reason: '具备内容或受众基础，但未建立商业变现闭环',
      scoreContribution: 25,
    })
    score += 25
  }

  // 创作者但低销售
  if (occType === 'creator' && sales <= 40) {
    evidence.push({
      ruleId: 'RULE_CONTENT_CREATOR_NO_SALES',
      sourceField: 'occupationType + sales',
      sourceValue: `creator, sales=${sales}`,
      reason: '创作者未建立销售成交能力，流量无法转化为收入',
      scoreContribution: 20,
    })
    score += 20
  }

  // 有 content 能力但无产品
  if (contentCap >= 40 && (assets.reusableAssets || []).length === 0) {
    evidence.push({
      ruleId: 'RULE_CONTENT_NO_PRODUCT',
      sourceField: 'content + reusableAssets',
      sourceValue: `content=${contentCap}, reusableAssets=0`,
      reason: '内容能力强但没有任何可销售产品',
      scoreContribution: 15,
    })
    score += 15
  }

  return {
    gameType: WRONG_GAMES.CONTENT_WITHOUT_MONETIZATION,
    gameLabel: WRONG_GAME_LABELS.CONTENT_WITHOUT_MONETIZATION,
    score: Math.min(100, score),
    evidence,
    hiddenCost: '你的内容或受众在免费消耗你的时间，但没有产生可持续的收入',
    threeYearConsequence: '三年后你可能有了更多关注者，但收入结构没有本质变化',
    exitCondition: '建立一个可销售的产品或服务，验证一次完整交易闭环',
  }
}

/**
 * BUSINESS_WITHOUT_SYSTEM — 有生意但无系统
 */
function evaluateBusinessWithoutSystem(profile, capabilities, assets) {
  const evidence = []
  let score = 0

  const occType = profile.identity && profile.identity.occupationType
  const systemThinking = capabilities.systemThinking || 0
  const hasReusable = (assets.reusableAssets || []).length > 0
  const disposableHours = profile.reality.availableHoursPerWeek || 0
  const monthlyIncome = profile.reality.monthlyIncome || 0

  // 小生意老板但事事亲力亲为
  if (occType === 'business_owner' && systemThinking <= 30 && !hasReusable) {
    evidence.push({
      ruleId: 'RULE_BIZ_NO_SYSTEM_OWNER',
      sourceField: 'occupationType + systemThinking + reusableAssets',
      sourceValue: `business_owner, systemThinking=${systemThinking}, reusableAssets=${hasReusable}`,
      reason: '生意经营者但未建立标准化系统，一切依赖老板本人',
      scoreContribution: 25,
    })
    score += 25
  }

  // 高收入 + 低可支配时间 → 被生意锁死
  if (monthlyIncome >= 15000 && disposableHours < 10 && !hasReusable) {
    evidence.push({
      ruleId: 'RULE_BIZ_HIGH_INCOME_TRAPPED',
      sourceField: 'monthlyIncome + availableHoursPerWeek + reusableAssets',
      sourceValue: `income=${monthlyIncome}, hours=${disposableHours}, reusableAssets=${hasReusable}`,
      reason: '收入不错但个人时间被完全占据，生意增长依赖个人投入而非系统',
      scoreContribution: 20,
    })
    score += 20
  }

  // 有资源但无团队/无自动化
  if ((assets.resources || []).length >= 2 && (assets.credentials || []).length === 0 && systemThinking <= 40) {
    evidence.push({
      ruleId: 'RULE_BIZ_RESOURCE_NO_SYSTEM',
      sourceField: 'resources + systemThinking',
      sourceValue: `resources=${(assets.resources||[]).length}, systemThinking=${systemThinking}`,
      reason: '有一定资源但未转化为可复制系统',
      scoreContribution: 15,
    })
    score += 15
  }

  return {
    gameType: WRONG_GAMES.BUSINESS_WITHOUT_SYSTEM,
    gameLabel: WRONG_GAME_LABELS.BUSINESS_WITHOUT_SYSTEM,
    score: Math.min(100, score),
    evidence,
    hiddenCost: '生意的每一次增长都意味着你更忙，而不是更自由',
    threeYearConsequence: '三年后收入可能翻倍了，但你每天仍然在同样的位置亲自处理同样的细节',
    exitCondition: '建立至少一项标准化流程或自动化，使收入增长与个人时间投入脱钩',
  }
}

/**
 * formatGameResult — 格式化游戏输出
 */
function formatGameResult(game) {
  return {
    gameType: game.gameType,
    gameLabel: game.gameLabel || '',
    score: game.score,
    evidence: game.evidence,
    hiddenCost: game.hiddenCost,
    threeYearConsequence: game.threeYearConsequence,
    exitCondition: game.exitCondition,
  }
}

/**
 * createUnknownGame — 证据不足时
 */
function createUnknownGame(profile) {
  return {
    gameType: 'UNKNOWN_GAME',
    gameLabel: '证据不足',
    score: 0,
    evidence: [{
      ruleId: 'RULE_UNKNOWN_INSUFFICIENT_EVIDENCE',
      sourceField: 'global',
      sourceValue: 'profile',
      reason: '当前数据不足以做出高置信判断，建议补充更多个人信息',
      scoreContribution: 0,
    }],
    hiddenCost: '',
    threeYearConsequence: '',
    exitCondition: '补充足够信息后重新分析',
  }
}

module.exports = {
  detectWrongGame,
}
