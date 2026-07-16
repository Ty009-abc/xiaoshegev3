/**
 * report/reportMapperV4.js
 *
 * 职责：Engine Result → Report Contract 的数据转换。
 * 只做数据转换，禁止生成文案。文案由 AI Prompt 基于 contract 字段生成。
 */

const {
  deriveWealthStage,
  WEALTH_PATHS,
  ACTION_PLAN_DAYS,
  IDENTITY_STAGES,
} = require('./reportTypes')

const { createReportSkeleton } = require('./reportContractV4')

// ═══════════════════════════════════════════════════════════════
// Wealth Probability 未来预测
// ═══════════════════════════════════════════════════════════════

/**
 * 基于当前 wealthProbability，推算 30/90/365 天后的概率。
 * 公式：base 分数 × 时间衰减系数 × 修正因子
 */
function projectWealthProbability(baseProbability, enginescores) {
  const base = Math.max(0, Math.min(100, baseProbability))

  // 改进系数来自 execution 和 cashflow 分数的平均值
  const improvementFactor = (enginescores.execution + enginescores.cashflow) / 200

  const after30  = Math.round(Math.min(100, base * (1 + 0.15 * improvementFactor)))
  const after90  = Math.round(Math.min(100, base * (1 + 0.35 * improvementFactor)))
  const after365 = Math.round(Math.min(100, base * (1 + 0.80 * improvementFactor)))

  return { today: base, after30, after90, after365 }
}

// ═══════════════════════════════════════════════════════════════
// Wealth Path 推荐
// ═══════════════════════════════════════════════════════════════

function computeWealthPath(profile, scores) {
  // 基于用户画像计算每条路径的推荐指数
  const paths = {}

  // working: 工资依赖型 + 执行弱 → 修正
  let workingScore = 50
  if (profile.incomeStructureRaw?.level === 'salary') workingScore += 20
  if (profile.monetizableSkillRaw?.level === 'none') workingScore += 15
  if (profile.safetyMonthsRaw?.level === 'critical' || profile.safetyMonthsRaw?.level === 'very_low') workingScore += 20
  if (profile.skillValidationRaw?.level === 'market_validated' || profile.skillValidationRaw?.level === 'stable_clients') workingScore -= 30
  if (profile.executionStabilityRaw?.level === 'stable') workingScore -= 20
  paths.working = clampScore(workingScore)

  // sideBusiness: 副业
  let sideScore = 50
  if (profile.monetizableSkillRaw?.level !== 'none') sideScore += 15
  if (profile.weeklyTimeRaw?.level === 'high' || profile.weeklyTimeRaw?.level === 'moderate') sideScore += 20
  if (profile.weeklyTimeRaw?.level === 'very_low') sideScore -= 25
  if (profile.safetyMonthsRaw?.level === 'strong') sideScore += 10
  paths.sideBusiness = clampScore(sideScore)

  // freelance: 技术服务
  let freelanceScore = 50
  if (profile.monetizableSkillRaw?.level === 'technical' || profile.monetizableSkillRaw?.level === 'craft') freelanceScore += 25
  if (profile.skillValidationRaw?.level === 'market_validated' || profile.skillValidationRaw?.level === 'stable_clients') freelanceScore += 20
  if (profile.skillValidationRaw?.level === 'never') freelanceScore -= 20
  if (profile.incomeStructureRaw?.level === 'skill_service') freelanceScore += 15
  paths.freelance = clampScore(freelanceScore)

  // investment: 投资
  let investScore = 30 // 默认低
  if (profile.monthlySurplusRaw?.level === 'high') investScore += 15
  if (profile.safetyMonthsRaw?.level === 'strong') investScore += 20
  if (profile.safetyMonthsRaw?.level === 'critical' || profile.safetyMonthsRaw?.level === 'very_low') investScore -= 30
  if (profile.debtPressureRaw?.level === 'high' || profile.debtPressureRaw?.level === 'consumer') investScore -= 35
  paths.investment = clampScore(investScore)

  // content: 内容/IP
  let contentScore = 50
  if (profile.monetizableSkillRaw?.level === 'content') contentScore += 25
  if (profile.executionStabilityRaw?.level === 'stable') contentScore += 15
  if (profile.weeklyTimeRaw?.level === 'very_low') contentScore -= 20
  if (profile.primaryGoalRaw?.level === 'brand') contentScore += 15
  if (profile.skillValidationRaw?.level === 'never') contentScore -= 10
  paths.content = clampScore(contentScore)

  // ai: AI 赋能
  let aiScore = 60 // 默认较高
  if (profile.monetizableSkillRaw?.level === 'technical' || profile.monetizableSkillRaw?.level === 'content') aiScore += 20
  if (profile.executionStabilityRaw?.level === 'stable') aiScore += 10
  if (profile.weeklyTimeRaw?.level === 'very_low') aiScore -= 10
  paths.ai = clampScore(aiScore)

  // entrepreneur: 创业
  let entScore = 30
  if (profile.safetyMonthsRaw?.level === 'strong') entScore += 25
  if (profile.executionStabilityRaw?.level === 'stable') entScore += 20
  if (profile.safetyMonthsRaw?.level === 'critical' || profile.safetyMonthsRaw?.level === 'very_low') entScore -= 30
  if (profile.debtPressureRaw?.level === 'high') entScore -= 30
  if (profile.pastAttemptStageRaw?.level === 'stable_side') entScore += 15
  paths.entrepreneur = clampScore(entScore)

  // 格式化为 contract 格式
  return WEALTH_PATHS.map(name => ({
    name,
    recommend: getRecommendation(paths[name]),
    score: paths[name],
    reason: '', // 由 AI Prompt 填充
  }))
}

function getRecommendation(score) {
  if (score >= 75) return 'highly_recommended'
  if (score >= 55) return 'recommended'
  if (score >= 40) return 'neutral'
  return 'not_recommended'
}

function clampScore(s) {
  return Math.max(0, Math.min(100, Math.round(s)))
}

// ═══════════════════════════════════════════════════════════════
// Headline 生成
// ═══════════════════════════════════════════════════════════════

function computeHeadline(profile, result) {
  const fatalCount = result.fatalRules?.length || 0
  const advantageCount = result.advantageRules?.length || 0
  const overall = result.scores?.overall || 50

  // 基于数据确定 headline 基调
  let emotion, severity, title, subtitle

  if (fatalCount >= 4) {
    emotion = 'warning'
    severity = Math.min(95, 60 + fatalCount * 8)
    title = '你的财富系统已经陷入多维度危机'
    subtitle = `${fatalCount}个致命风险点被触发。现行路径正在加速资本损耗。`
  } else if (fatalCount >= 2) {
    emotion = 'alert'
    severity = Math.min(80, 40 + fatalCount * 15)
    title = '你的财富路径存在结构性隐患'
    subtitle = `${fatalCount}个关键风险需要立即纠正。`
  } else if (fatalCount >= 1) {
    emotion = 'alert'
    severity = Math.min(60, 30 + fatalCount * 25)
    title = '发现了一个值得关注的财富盲区'
    subtitle = '存在1个阻碍你前进的关键因素。'
  } else if (advantageCount >= 3) {
    emotion = 'confident'
    severity = Math.min(40, 10 + advantageCount * 8)
    title = '你已经站在财富跃迁的起跑线上'
    subtitle = `${advantageCount}个优势点已被系统识别。只需要聚焦行动。`
  } else if (overall >= 60) {
    emotion = 'hopeful'
    severity = 30
    title = '你的基础不错，方向比速度更重要'
    subtitle = '选择一个正确的路径，投入全部执行力。'
  } else {
    emotion = 'neutral'
    severity = 50
    title = '诊断完成 — 你的财富系统已就绪'
    subtitle = '以下是基于15个维度的完整评估。'
  }

  return { title, subtitle, emotion, severity }
}

// ═══════════════════════════════════════════════════════════════
// Fatal Diagnosis
// ═══════════════════════════════════════════════════════════════

function computeFatalDiagnosis(result) {
  const fatalRules = result.fatalRules || []
  if (fatalRules.length === 0) return null

  // 取权重最高的致命规则作为 main problem
  const sorted = [...fatalRules].sort((a, b) => b.weight - a.weight)
  const main = sorted[0]

  return {
    mainProblem: main.name,
    reason: main.output.description,
    matchedRuleIds: fatalRules.map(r => r.id),
    severity: Math.min(95, 30 + fatalRules.length * 15),
    confidence: Math.min(95, 60 + fatalRules.length * 5),
  }
}

// ═══════════════════════════════════════════════════════════════
// Top3 规则提取
// ═══════════════════════════════════════════════════════════════

function extractTop3Rules(rules) {
  if (!rules || rules.length === 0) return []
  const sorted = [...rules]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
  return sorted.map(r => ({
    ruleId: r.id,
    title: r.output.title,
    description: r.output.description,
    weight: r.weight,
    why: r.output.advice,
  }))
}

// ═══════════════════════════════════════════════════════════════
// Opportunity Rules 排序
// ═══════════════════════════════════════════════════════════════

function computeOpportunities(result) {
  // 从 advantage rules 中提取机会标签
  const opportunities = []
  const seen = new Set()

  // 从优势规则中推导机会
  const adv = result.advantageRules || []
  for (const r of adv) {
    // 从规则输出中提取机会关键词
    const text = (r.output.title + ' ' + r.output.description + ' ' + r.output.advice).toLowerCase()

    const keywords = [
      { key: 'AI', match: /ai|人工智能|自动化|编程|技术/g },
      { key: 'IP', match: /内容|ip|品牌|创作|流量/g },
      { key: '副业', match: /副业|兼职|额外收入/g },
      { key: '培训', match: /培训|课程|教学|指导/g },
      { key: '咨询', match: /咨询|顾问|服务/g },
      { key: '销售', match: /销售|变现|成交|客户/g },
      { key: '内容', match: /内容|写作|视频|直播/g },
      { key: '产品', match: /产品|产品化|工具|saas/g },
    ]

    for (const { key, match } of keywords) {
      if (match.test(text) && !seen.has(key)) {
        seen.add(key)
        opportunities.push({ area: key, sourceRuleId: r.id, reason: r.output.advice })
      }
    }
  }

  // 从 non-computed 标签补充
  const labels = result.labels || []
  for (const l of labels) {
    if (l.severity === 'advantage' && !seen.has(l.label)) {
      seen.add(l.label)
      opportunities.push({ area: l.label, sourceRuleId: 'label', reason: l.label })
    }
  }

  return opportunities.slice(0, 3)
}

// ═══════════════════════════════════════════════════════════════
// Action Plan (30天计划)
// ═══════════════════════════════════════════════════════════════

function computeActionPlan(result) {
  const fatalCount = result.fatalRules?.length || 0

  // 基于致命规则数量调整计划强度
  const plan = {
    day1: {
      goal: fatalCount >= 2 ? '停损并盘点现状' : '明确一个可执行的小方向',
      tasks: fatalCount >= 2
        ? ['列出所有高息债务','停止所有非必要支出','下载账单工具/记账APP']
        : ['选择一个可用的技能标签','列出3个潜在获客渠道','完成当前能力自评'],
      checkpoint: '24小时内完成',
    },
    day3: {
      goal: fatalCount >= 2 ? '建立现金流监控体系' : '完成第一次对外输出',
      tasks: fatalCount >= 2
        ? ['建立每日收支记录','制定债务还款优先级','寻找一个额外收入来源']
        : ['发布一条专业内容','联系3个潜在客户','整理服务报价'],
      checkpoint: '3天内完成',
    },
    day7: {
      goal: fatalCount >= 2 ? '执行第一笔债务修复' : '获得第一个市场反馈',
      tasks: fatalCount >= 2
        ? ['偿还一笔最高利率债务','建立最小应急基金（500元）','取消所有自动续费订阅']
        : ['完成一次免费或低价服务','收集客户反馈','根据反馈调整服务'],
      checkpoint: '7天内完成',
    },
    day15: {
      goal: fatalCount >= 2 ? '建立最小安全垫' : '完成第一次成交',
      tasks: fatalCount >= 2
        ? ['积累1个月基本生活费','评估是否需要副业补充收入','制定3个月还款路径']
        : ['向10个人报价','尝试成交1-3单','记录完整的获客→成交路径'],
      checkpoint: '15天内完成',
    },
    day30: {
      goal: fatalCount >= 2 ? '进入正现金流循环' : '建立可持续获客模式',
      tasks: fatalCount >= 2
        ? ['月结余转正','应急基金达标','开始考虑副业或技能变现']
        : ['复盘30天成交数据','固化获客渠道','制定下月目标'],
      checkpoint: '30天内完成',
    },
  }

  return plan
}

// ═══════════════════════════════════════════════════════════════
// Stop Doing 列表
// ═══════════════════════════════════════════════════════════════

function computeStopDoing(result) {
  const fatalRules = result.fatalRules || []
  const items = new Set()

  // 从致命规则中提取"应该停止"的行为
  const stopMap = {
    'R_CF_014': '借新债还旧债',
    'R_CF_015': '高息消费贷',
    'R_INC_001': '把"学习"当成行动',
    'R_INC_010': '炒短线/高频交易',
    'R_INC_013': '无计划跳槽',
    'R_INC_014': '冲动消费',
    'R_EXEC_005': '购买新课/盲目考证',
    'R_EXEC_006': '不停换方向',
    'R_RISK_009': '亏损后追加投入',
    'R_RISK_010': '用必需资金投资',
    'R_DEC_001': '裸辞创业',
    'R_DEC_004': '"学完再说"型拖延',
    'R_DEC_006': '等别人验证',
    'R_DEC_007': '不作为',
  }

  for (const r of fatalRules) {
    const item = stopMap[r.id]
    if (item) items.add(item)
  }

  // 底限
  if (items.size === 0) {
    items.add('拖延症')
    items.add('无效社交')
  }

  return {
    priority: 1,
    items: Array.from(items).slice(0, 5),
  }
}

// ═══════════════════════════════════════════════════════════════
// Identity Upgrade
// ═══════════════════════════════════════════════════════════════

function computeIdentityUpgrade(profile, result) {
  const overall = result.scores?.overall || 50
  const sv = profile.skillValidationRaw?.level
  const pa = profile.pastAttemptStageRaw?.level

  let currentIdentity, targetIdentity, gap

  if (overall <= 20) {
    currentIdentity = '打工者'
    targetIdentity = '技能经营者'
    gap = '需要从零开发一项可以变现的技能'
  } else if (overall <= 40) {
    currentIdentity = '打工者'
    targetIdentity = '技能经营者'
    gap = '技能已验证但尚未形成稳定收入'
  } else if (pa === 'stable_side' || sv === 'stable_clients') {
    currentIdentity = '技能经营者'
    targetIdentity = '生产效率者'
    gap = '已有稳定客户，需要将服务产品化以放大'
  } else if (pa === 'small_sales') {
    currentIdentity = '打工者'
    targetIdentity = '技能经营者'
    gap = '已有成交记录，需要建立系统化获客流程'
  } else {
    currentIdentity = '打工者'
    targetIdentity = '技能经营者'
    gap = '尚未开始变现，第一步是完成付费验证'
  }

  return {
    currentIdentity,
    targetIdentity,
    nextIdentity: getNextIdentity(targetIdentity),
    gap,
    upgradePath: `${currentIdentity} → ${targetIdentity} → ${getNextIdentity(targetIdentity)} → 资产拥有者 → 系统建设者`,
  }
}

function getNextIdentity(current) {
  const idx = IDENTITY_STAGES.indexOf(current)
  if (idx < 0 || idx >= IDENTITY_STAGES.length - 1) return '资产拥有者'
  return IDENTITY_STAGES[idx + 1]
}

// ═══════════════════════════════════════════════════════════════
// Final Strike
// ═══════════════════════════════════════════════════════════════

const FINAL_STRIKES = [
  {
    sentence: '未来真正拉开人与人差距的，不是努力，而是你有没有建立自己的财富系统。',
    emotion: 'insight',
    shareTitle: '我的财富系统诊断结果',
  },
  {
    sentence: '赚钱是短期行为，建立系统是长期资产。你现在的选择，决定了3年后的你。',
    emotion: 'forward_looking',
    shareTitle: '看看我的财富诊断',
  },
  {
    sentence: '你需要的不是更努力，而是更聪明——把1年的执行力投在正确的方向上。',
    emotion: 'encouraging',
    shareTitle: '我的诊断结果',
  },
  {
    sentence: '认知改变行动，行动改变结果。今天的诊断是你财富系统的第一次全面体检。',
    emotion: 'motivational',
    shareTitle: '财富系统体检报告',
  },
]

function computeFinalStrike(result) {
  const overall = result.scores?.overall || 50
  // 根据 overall 选择不同 tone 的 final strike
  if (overall <= 30) {
    return FINAL_STRIKES[0] // insight
  } else if (overall <= 60) {
    return FINAL_STRIKES[3] // motivational
  } else {
    return FINAL_STRIKES[1] // forward_looking
  }
}

// ═══════════════════════════════════════════════════════════════
// 主入口：Engine Result → Report Skeleton
// ═══════════════════════════════════════════════════════════════

function mapEngineToReport(engineResult) {
  const profile = engineResult.normalizedProfile
  const scores = engineResult.scores

  const skeleton = createReportSkeleton()

  // 1. headline
  skeleton.headline = computeHeadline(profile, engineResult)

  // 2. wealthStage
  skeleton.wealthStage = deriveWealthStage(scores.overall)

  // 3. fatalDiagnosis
  skeleton.fatalDiagnosis = computeFatalDiagnosis(engineResult)

  // 4. fatalRules (Top3)
  skeleton.fatalRules = extractTop3Rules(engineResult.fatalRules)

  // 5. advantageRules (Top3)
  skeleton.advantageRules = extractTop3Rules(engineResult.advantageRules)

  // 6. opportunityRules (Top3)
  skeleton.opportunityRules = computeOpportunities(engineResult)

  // 7. scoreCard — 直接引用 Engine 输出
  skeleton.scoreCard = {
    cashflow: scores.cashflow,
    skill: scores.skill,
    execution: scores.execution,
    time: scores.time,
    risk: scores.risk,
    overall: scores.overall,
  }

  // 8. wealthProbability
  skeleton.wealthProbability = projectWealthProbability(
    engineResult.wealthProbability,
    scores
  )

  // 9. wealthPath
  skeleton.wealthPath = computeWealthPath(profile, scores)

  // 10. actionPlan
  skeleton.actionPlan = computeActionPlan(engineResult)

  // 11. stopDoing
  skeleton.stopDoing = computeStopDoing(engineResult)

  // 12. identityUpgrade
  skeleton.identityUpgrade = computeIdentityUpgrade(profile, engineResult)

  // 13. finalStrike
  skeleton.finalStrike = computeFinalStrike(engineResult)

  return skeleton
}

module.exports = {
  mapEngineToReport,
  // 导出各子函数供测试
  computeHeadline,
  computeFatalDiagnosis,
  extractTop3Rules,
  computeOpportunities,
  projectWealthProbability,
  computeWealthPath,
  computeActionPlan,
  computeStopDoing,
  computeIdentityUpgrade,
  computeFinalStrike,
  deriveWealthStage,
}
