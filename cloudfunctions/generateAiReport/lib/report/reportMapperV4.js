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
// v6.5.2: 结构化语义字段
// ═══════════════════════════════════════════════════════════════

const CONTRADICTION_PATTERNS = [
  // 高认知低执行: HIGH_COGNITION + LOW_EXECUTION
  { leftRisk: 'ANALYSIS_PARALYSIS', leftRiskAlt: 'HIGH_OPPORTUNITY_COST', right: 'LEARNING_SPEED',
    code: 'LEARNING_EXECUTION_CONFLICT', title: '学习强 × 执行弱',
    leftSide: '学习吸收能力强', rightSide: '执行连续性弱',
    desc: '你吸收信息的速度远高于产出结果的速度，知识长期停留在输入端' },
  // 学习强变现弱: LEARNING_STRONG + LOW_MONETIZATION
  { leftRisk: 'LOW_MONETIZATION', right: 'LEARNING_SPEED',
    code: 'LEARNING_EXECUTION_CONFLICT', title: '学习强 × 变现弱',
    leftSide: '学习能力强', rightSide: '变现能力弱',
    desc: '你的能力从未换到过钱。在商业世界，未被付费验证的能力等于不存在' },
  // 高欲望低纪律: HIGH_DESIRE + LOW_DISCIPLINE
  { leftRisk: 'LOW_DISCIPLINE', leftRiskAlt: 'SHORT_TERM_ADDICTION', right: 'CREATIVITY',
    code: 'AMBITION_DISCIPLINE_CONFLICT', title: '高欲 × 低律',
    leftSide: '欲望/野心高', rightSide: '纪律/坚持力弱',
    desc: '你的目标很大但坚持力不足，频繁在启动和放弃间循环' },
  // 收入单一抗风险弱: SINGLE_INCOME + LOW_RISK_BUFFER
  { leftRisk: 'SINGLE_INCOME_DEPENDENCY', right: 'SAFETY_MARGIN',
    code: 'STABILITY_GROWTH_CONFLICT', title: '收入单一 × 抗风险弱',
    leftSide: '收入来源单一', rightSide: '抗风险能力弱',
    desc: '连一次行业波动都扛不过去。焦虑来源于这个现实，不是认知问题' },
  // 风险过度自信
  { leftRisk: 'DEBT_PRESSURE', right: 'EXECUTION_SPEED',
    code: 'RISK_REWARD_CONFLICT', title: '敢赌 × 缺框',
    leftSide: '风险偏好高/负债多', rightSide: '缺乏风控框架',
    desc: '消费贷/高负债是认知翻身的最大障碍。利息在吞噬你未来的一切可能性' },
  // 现金流断裂
  { leftRisk: 'NEGATIVE_CASHFLOW', right: 'SKILL_ASSETS',
    code: 'SPEED_CONSISTENCY_CONFLICT', title: '入不敷出 × 技能闲置',
    leftSide: '每月入不敷出', rightSide: '有技能未变现',
    desc: '收支刚好持平/负结余，没有燃料积累。这不是发展问题，是生存问题' },
  // 执行力强但方向杂乱
  { leftRisk: 'DIRECTION_CHAOS', leftRiskAlt: 'EXECUTION_FRAGMENTATION', right: 'EXECUTION_SPEED',
    code: 'SPEED_CONSISTENCY_CONFLICT', title: '快进 × 不持续',
    leftSide: '执行力强', rightSide: '方向/持续性弱',
    desc: '你有爆发力但缺持久力，碎片化执行导致每次都从零开始' },
]

/**
 * v6.5.3: 输入守卫
 */
function assertValidEngineResult(engineResult) {
  if (!engineResult || typeof engineResult !== 'object') {
    const error = new Error('Invalid engine result')
    error.code = 'E_ENGINE_RESULT_INVALID'
    throw error
  }
}

/**
 * FALLBACK 二级结构化分类
 * 基于 fatal rules + scores + profile 确定二级矛盾类型。
 * 只使用结构化字段，禁止自然语言模糊匹配。
 */
function classifyFallbackContradiction(engineResult) {
  const fatalIds = (engineResult.fatalRules || []).map(r => r.id)
  const scores = engineResult.scores || {}
  const profile = engineResult.normalizedProfile || {}

  // ── 信号采集 ──
  const income = profile.incomeStructureRaw?.level
  const skillVal = profile.skillValidationRaw?.level
  const safety = profile.safetyMonthsRaw?.level
  const debt = profile.debtPressureRaw?.level
  const surplus = profile.monthlySurplusRaw?.level
  const skillType = profile.monetizableSkillRaw?.level
  const weeklyTime = profile.weeklyTimeRaw?.level
  const pastAttempt = profile.pastAttemptStageRaw?.level
  const execScore = scores.execution || 0
  const skillScore = scores.skill || 0
  const riskScore = scores.risk || 0
  const overall = scores.overall || 0
  const fatalCount = (engineResult.fatalRules || []).length
  const evidenceCount = [profile.incomeStructureRaw, profile.monthlySurplusRaw, profile.safetyMonthsRaw,
    profile.debtPressureRaw, profile.monetizableSkillRaw, profile.skillValidationRaw,
    profile.weeklyTimeRaw, profile.pastAttemptStageRaw, profile.decisionStyleRaw]
    .filter(v => v && typeof v.level === 'string' && v.level !== 'none' && v.level !== 'undefined')
    .length

  // ── 二级分类逻辑（按优先级）──

  // CASE A: 证据不足 — evidenceCount < 4 → 无法形成可靠判断
  if (evidenceCount < 4) {
    return {
      code: 'INSUFFICIENT_EVIDENCE',
      title: '信息不足 × 决策可靠性不足',
      leftSide: '可用数据不足',
      rightSide: '需要更多确定性信息',
      desc: '当前回答不足以支持高置信度的路径判断。在商业世界，盲人摸象是指数级风险的加速器',
      confidence: 0.3,
      evidenceRefs: ['incomeStructure', 'monthlySurplus', 'safetyMonths', 'monetizableSkill', 'skillValidation'],
      classificationSource: 'classifyFallbackContradiction[evidenceCount<4]',
    }
  }

  // CASE B: 单一收入 + 低缓冲 → SINGLE_INCOME_LOW_BUFFER
  if (income === 'salary' && (safety === 'critical' || safety === 'very_low' || safety === 'low')) {
    return {
      code: 'SINGLE_INCOME_LOW_BUFFER',
      title: '收入来源单一 × 抗风险缓冲不足',
      leftSide: '工资/单一收入',
      rightSide: '抗风险缓冲不足',
      desc: safety === 'critical'
        ? '你的收入全部依赖单一工资，但安全垫不到1个月。任何收入中断都会立即压缩选择空间'
        : safety === 'very_low'
          ? '你的收入全部依赖单一工资，仅1-3个月缓冲。行业波动会在你找到方向前耗光积累'
          : '收入来源单一，结余有限。你需要在稳定期中积累选择性，而不是等问题爆发',
      confidence: 0.85,
      evidenceRefs: ['incomeStructure:salary', 'safetyMonths:' + (safety || 'unknown'), 'fatalCount:' + fatalCount],
      classificationSource: 'classifyFallbackContradiction[singleIncome+lowBuffer]',
    }
  }

  // CASE C: 内容能力 + 获客弱 → CONTENT_WITHOUT_ACQUISITION
  if (skillType === 'content' && (skillVal === 'earned_once' || skillVal === 'unpaid')) {
    return {
      code: 'CONTENT_WITHOUT_ACQUISITION',
      title: '内容能力 × 获客能力不足',
      leftSide: '有内容创作能力',
      rightSide: '缺少稳定获客/成交能力',
      desc: '你的内容能力已经存在，但从内容到成交的转化链尚未建立。能力存在但杠杆不足',
      confidence: 0.80,
      evidenceRefs: ['monetizableSkill:content', 'skillValidation:' + (skillVal || 'unknown')],
      classificationSource: 'classifyFallbackContradiction[content+weakAcquisition]',
    }
  }

  // CASE D: 风险规避 × 机会暴露不足 → RISK_AVOIDANCE_OPPORTUNITY
  if ((safety === 'strong' || safety === 'moderate_high') && execScore <= 30 && weeklyTime === 'very_low') {
    return {
      code: 'RISK_AVOIDANCE_OPPORTUNITY',
      title: '风险规避 × 机会暴露不足',
      leftSide: '安全垫充裕但过度保守',
      rightSide: '几乎不暴露于任何新机会',
      desc: '你的安全垫足够，但每周可自由支配时间不足2小时。不暴露于机会的人，无法被机会选中',
      confidence: 0.80,
      evidenceRefs: ['safetyMonths:' + safety, 'execution:' + execScore, 'weeklyTime:' + weeklyTime],
      classificationSource: 'classifyFallbackContradiction[riskAvoidance+lowExposure]',
    }
  }

  // CASE E: 稳定职业 + 成长焦虑 → STABILITY_GROWTH_CONFLICT
  if (income === 'salary' && debt === 'mortgage_low' && (skillVal === 'never' || skillVal === 'unpaid')) {
    return {
      code: 'STABILITY_GROWTH_CONFLICT',
      title: '稳定需求 × 成长焦虑',
      leftSide: '职业稳定但有房贷/家庭责任',
      rightSide: '成长空间受限，技能未验证',
      desc: '你有稳定工作，但稳定的代价是成长缓慢。你的能力从未在市场中被定价——这就是焦虑的真正来源',
      confidence: 0.85,
      evidenceRefs: ['incomeStructure:salary', 'debtPressure:mortgage_low', 'skillValidation:' + (skillVal || 'unknown')],
      classificationSource: 'classifyFallbackContradiction[stability+growthAnxiety]',
    }
  }

  // CASE F: 执行强 + 方向弱 → EXECUTION_WITHOUT_DIRECTION
  // 注意：无论 execScore 是否达到 60，只要 skillType 为 sales 且 pastAttempt 有尝试记录，就属于此类
  const hasExecutionEvidence =
    execScore >= 60 ||
    (skillType === 'sales' && pastAttempt === 'small_sales') ||
    (weeklyTime === 'high' && (pastAttempt === 'small_sales' || pastAttempt === 'stable_side'))
  if (hasExecutionEvidence && riskScore <= 30) {
    return {
      code: 'EXECUTION_WITHOUT_DIRECTION',
      title: '行动速度 × 方向判断不足',
      leftSide: '执行力强/时间充裕',
      rightSide: '方向判断不足/风险暴露',
      desc: '你的执行能量存在，但当前路径风险敞口过高。需要的是方向校准，而不是更多的行动',
      confidence: 0.75,
      evidenceRefs: ['execution:' + execScore, 'risk:' + riskScore,
        'weeklyTime:' + weeklyTime, 'pastAttempt:' + pastAttempt, 'skillType:' + skillType],
      classificationSource: 'classifyFallbackContradiction[execution+directionGap]',
    }
  }

  // CASE G: 低变现 + 无线索 → LOW_MONETIZATION_WITHOUT_LEVERAGE
  if ((skillVal === 'never' || skillVal === 'unpaid') && execScore <= 30) {
    return {
      code: 'LOW_MONETIZATION_WITHOUT_LEVERAGE',
      title: '能力存在 × 变现杠杆不足',
      leftSide: '具备个人能力基础',
      rightSide: '从未被市场验证或定价',
      desc: '你的能力从未换到过钱。在商业世界，未被付费验证的能力等于不存在',
      confidence: 0.85,
      evidenceRefs: ['skillValidation:' + skillVal, 'execution:' + execScore, 'fatalCount:' + fatalCount],
      classificationSource: 'classifyFallbackContradiction[lowMonetization+noLeverage]',
    }
  }

  // CASE H: 通用的 STABILITY_GROWTH_CONFLICT（仅用于不适用以上分类的高分画像）
  if (overall >= 50) {
    const variantTitle = skillType === 'content' ? '能力完整 × 方向聚焦不足' : '求稳 × 求变'
    const variantDesc = skillType === 'content'
      ? '你的内容能力和变现资源都已具备。矛盾不是生存，而是你还没有把优势集中在最值得的方向'
      : '你已经有良好的基础条件，矛盾不在于生存而在于突破——能否把现有优势转化为更大成果'
    return {
      code: 'STABILITY_GROWTH_CONFLICT',
      title: variantTitle,
      leftSide: '基础条件好',
      rightSide: '尚未完全释放潜力',
      desc: variantDesc,
      confidence: 0.70,
      evidenceRefs: ['overall:' + overall, 'skillType:' + (skillType || 'unknown')],
      classificationSource: 'classifyFallbackContradiction[genericStabilityGrowth]',
    }
  }

  // 绝对兜底 — 到达这里说明所有分类失败（不会发生，但保留安全）
  const fd = computeFatalDiagnosis(engineResult)
  return {
    code: 'LOW_MONETIZATION_WITHOUT_LEVERAGE',
    title: fd ? (fd.mainProblem || '关键矛盾') : '变现与执行的落差',
    leftSide: '当前困境',
    rightSide: '期望方向',
    desc: fd ? (fd.reason || '需要补足关键信息') : '你的能力基础存在，但执行和变现两个关键链路尚未打通',
    confidence: 0.5,
    evidenceRefs: ['fatalDiagnosis:' + (fd ? fatalCount : 0)],
    classificationSource: 'classifyFallbackContradiction[absoluteFallback]',
  }
}

/**
 * 从 engine 数据推导核心矛盾
 * 使用 fatal rules + scores 判定冲突类型。
 * FALLBACK 不再直接返回，而是通过 classifyFallbackContradiction 二级结构化。
 */
function computeContradiction(engineResult) {
  assertValidEngineResult(engineResult)

  const fatalIds = (engineResult.fatalRules || []).map(r => r.id)
  const scores = engineResult.scores || {}
  const profile = engineResult.normalizedProfile || {}

  // 收集关键信号
  const signals = {
    hasAnalysisParalysis: fatalIds.some(id => /R_DEC_004|R_DEC_006|R_EXEC_005/.test(id)),
    hasLowExecution: scores.execution <= 30,
    hasLowMonetization: profile.skillValidationRaw?.level === 'never' || profile.skillValidationRaw?.level === 'unpaid',
    hasLearningStrength: scores.skill >= 50,
    hasLowDiscipline: fatalIds.some(id => /R_DEC_007|R_EXEC_006/.test(id)) || scores.execution <= 25,
    hasHighAmbition: scores.skill >= 50,
    hasSingleIncome: profile.incomeStructureRaw?.level === 'salary',
    hasLowRiskBuffer: profile.safetyMonthsRaw?.level === 'critical' || profile.safetyMonthsRaw?.level === 'very_low',
    hasDebtPressure: profile.debtPressureRaw?.level === 'high' || profile.debtPressureRaw?.level === 'consumer',
    hasNegativeCashflow: profile.monthlySurplusRaw?.level === 'negative' || profile.monthlySurplusRaw?.level === 'zero',
    hasHighExecution: scores.execution >= 60,
    hasFragmentedExecution: fatalIds.some(id => /R_EXEC_006|R_DEC_007/.test(id)),
    hasContentSkill: profile.monetizableSkillRaw?.level === 'content',
    hasContentButWeakAcquisition: profile.monetizableSkillRaw?.level === 'content' &&
      (profile.skillValidationRaw?.level === 'earned_once' || profile.skillValidationRaw?.level === 'unpaid'),
    hasStrongSafetyWithLowExecution: (profile.safetyMonthsRaw?.level === 'strong' || profile.safetyMonthsRaw?.level === 'moderate_high') &&
      scores.execution <= 30,
    hasStabilityAnxiety: profile.incomeStructureRaw?.level === 'salary' &&
      profile.debtPressureRaw?.level === 'mortgage_low' &&
      (profile.skillValidationRaw?.level === 'never' || profile.skillValidationRaw?.level === 'unpaid'),
    hasHighExecutionWithDirectionGap:
      scores.execution >= 60 ||
      (profile.monetizableSkillRaw?.level === 'sales' && profile.pastAttemptStageRaw?.level === 'small_sales'),
  }

  // 匹配模式（按优先级）
  if (signals.hasAnalysisParalysis && signals.hasLearningStrength) {
    return CONTRADICTION_PATTERNS[0]
  }
  if (signals.hasLowMonetization && signals.hasLearningStrength) {
    return CONTRADICTION_PATTERNS[1]
  }
  if (signals.hasLowDiscipline && signals.hasHighAmbition) {
    return CONTRADICTION_PATTERNS[2]
  }
  if (signals.hasSingleIncome && signals.hasLowRiskBuffer && fatalIds.length >= 3) {
    // v6.5.3: 动态化 desc
    const bufferLevel = profile.safetyMonthsRaw?.level || 'low'
    const variantDesc = bufferLevel === 'critical'
      ? '你的收入全部依赖单一工资，但安全垫不到1个月。任何一个意外支出都能打乱你的全盘计划'
      : '收入来源单一且安全垫不足。行业波动会在你找到新方向前把积累耗光'
    return { ...CONTRADICTION_PATTERNS[3], desc: variantDesc }
  }
  if (signals.hasDebtPressure && scores.risk <= 30) {
    // v6.5.3: 动态化 desc 以提高多样性
    const debtLevel = profile.debtPressureRaw?.level || 'unknown'
    const variantDesc = debtLevel === 'high'
      ? '以贷养贷正在吞噬你未来的一切可能性。利息不是问题，是问题放大器'
      : '消费贷/信用卡压力是你的机会成本黑洞。先止血，再想进攻'
    return { ...CONTRADICTION_PATTERNS[4], desc: variantDesc }
  }
  if (signals.hasNegativeCashflow) {
    return CONTRADICTION_PATTERNS[5]
  }
  if (signals.hasHighExecution && signals.hasFragmentedExecution) {
    return CONTRADICTION_PATTERNS[6]
  }

  // ── v6.5.3: 新增确定性信号直通 ──
  if (signals.hasContentButWeakAcquisition) {
    return classifyFallbackContradiction(engineResult) // → CONTENT_WITHOUT_ACQUISITION
  }
  if (signals.hasStrongSafetyWithLowExecution) {
    return classifyFallbackContradiction(engineResult) // → RISK_AVOIDANCE_OPPORTUNITY
  }
  if (signals.hasStabilityAnxiety) {
    return classifyFallbackContradiction(engineResult) // → STABILITY_GROWTH_CONFLICT
  }
  if (signals.hasHighExecutionWithDirectionGap && scores.risk <= 30) {
    return classifyFallbackContradiction(engineResult) // → EXECUTION_WITHOUT_DIRECTION
  }
  if (signals.hasSingleIncome && scores.overall < 50 && !signals.hasLowRiskBuffer) {
    return classifyFallbackContradiction(engineResult) // → SINGLE_INCOME_LOW_BUFFER
  }

  // 兜底: 二级结构化分类
  return classifyFallbackContradiction(engineResult)
}

/**
 * v6.5.3: 完整 CONTRADICTION_TO_DECISION 映射表
 * 覆盖所有可能的 contradiction code → decision。
 * INSUFFICIENT_EVIDENCE → COLLECT_MORE_EVIDENCE（provisional decision）
 */
const CONTRADICTION_TO_DECISION = {
  LEARNING_EXECUTION_CONFLICT: {
    code: 'BUILD_EXECUTION_SYSTEM',
    title: '先建立连续执行系统',
    reason: '核心矛盾是学习强执行弱，在知识再次堆积之前，必须连续执行21天以上',
    expectedCycleDays: 90,
    confidence: 0.85,
    provisional: false,
  },
  AMBITION_DISCIPLINE_CONFLICT: {
    code: 'BUILD_DISCIPLINE',
    title: '先建立纪律系统',
    reason: '野心和纪律之间的落差是目前最大问题，固定时间做固定动作比什么都重要',
    expectedCycleDays: 60,
    confidence: 0.85,
    provisional: false,
  },
  SPEED_CONSISTENCY_CONFLICT: {
    code: 'BUILD_EXECUTION_SYSTEM',
    title: '先聚焦一个方向连续执行',
    reason: '爆发力不是问题，持续性才是。把碎片化执行合并为一个固定节奏',
    expectedCycleDays: 90,
    confidence: 0.80,
    provisional: false,
  },
  STABILITY_GROWTH_CONFLICT: {
    code: 'BUILD_SECOND_INCOME',
    title: '在不辞职的前提下启动第二收入线',
    reason: '单一收入是最大风险。在不影响主业的前提下验证技能变现',
    expectedCycleDays: 180,
    confidence: 0.85,
    provisional: false,
  },
  RISK_REWARD_CONFLICT: {
    code: 'REBUILD_RISK_FRAMEWORK',
    title: '先止住出血再谈翻身',
    reason: '当前负债正在吞噬未来的一切机会。停损是第一优先，任何投资都要等现金流转正之后',
    expectedCycleDays: 60,
    confidence: 0.90,
    provisional: false,
  },
  SINGLE_INCOME_LOW_BUFFER: {
    code: 'BUILD_SECOND_INCOME',
    title: '在不辞职的前提下启动第二收入线',
    reason: '单一收入是最大风险。在不影响主业的前提下验证技能变现，未来90～180天建立独立于工资的第二收入线',
    expectedCycleDays: 180,
    confidence: 0.85,
    provisional: false,
  },
  CONTENT_WITHOUT_ACQUISITION: {
    code: 'INCREASE_MONETIZATION',
    title: '把已验证的能力规模化变现',
    reason: '你的能力已经存在并且有过初步验证，下一步是建立从内容到成交的最小转化链',
    expectedCycleDays: 90,
    confidence: 0.80,
    provisional: false,
  },
  RISK_AVOIDANCE_OPPORTUNITY: {
    code: 'REDUCE_DECISION_FATIGUE',
    title: '释放安全垫红利，增加低风险机会暴露',
    reason: '你的安全垫是优势而非枷锁。在维持安全垫的前提下，每周投入1个低风险小实验，增加被机会选中的概率',
    expectedCycleDays: 90,
    confidence: 0.80,
    provisional: false,
  },
  EXECUTION_WITHOUT_DIRECTION: {
    code: 'DEEPEN_SPECIALIZATION',
    title: '校准方向后再释放执行力',
    reason: '你的执行能量不是问题，问题是当前方向风险敞口过高。先确定一个可积累的方向再全速前进',
    expectedCycleDays: 90,
    confidence: 0.75,
    provisional: false,
  },
  LOW_MONETIZATION_WITHOUT_LEVERAGE: {
    code: 'INCREASE_MONETIZATION',
    title: '用最小代价完成首次付费验证',
    reason: '你的能力从未换到过钱。在商业世界，未被付费验证的能力等于不存在。优先完成一次真实的技能变现',
    expectedCycleDays: 90,
    confidence: 0.85,
    provisional: false,
  },
  INSUFFICIENT_EVIDENCE: {
    code: 'COLLECT_MORE_EVIDENCE',
    title: '先补齐关键证据，再确定翻身主线',
    reason: '当前回答不足以支持高置信度的路径判断。盲人摸象是指数级风险的加速器——先补信息，不假装已经知道答案',
    expectedCycleDays: 7,
    confidence: 0.4,
    provisional: true,
  },
}

/**
 * 从矛盾推导唯一决策
 *
 * v6.5.3 变更:
 *  - 不再返回 null
 *  - FALLBACK 被二级分类覆盖，不再有 FALLBACK code
 *  - INSUFFICIENT_EVIDENCE → COLLECT_MORE_EVIDENCE（provisional decision）
 *  - 固定返回 { code, title, reason, expectedCycleDays, confidence, provisional, source }
 */
function computeDecision(contradiction, engineResult) {
  if (!contradiction || !contradiction.code) {
    const error = new Error('computeDecision requires a valid contradiction with code')
    error.code = 'E_DECISION_INPUT_INVALID'
    throw error
  }

  if (!engineResult || typeof engineResult !== 'object') {
    const error = new Error('computeDecision requires a valid engineResult')
    error.code = 'E_DECISION_INPUT_INVALID'
    throw error
  }

  const code = contradiction.code
  const match = CONTRADICTION_TO_DECISION[code]

  if (!match) {
    // 已知 code 但不在映射表中 → fallback to low-monetization path
    const scores = engineResult.scores || {}
    const overall = scores.overall || 0
    if (overall >= 50) {
      return {
        code: 'INCREASE_MONETIZATION',
        title: '把已验证的能力规模化变现',
        reason: '你的基础条件已经具备，下一步是把能力转化为可重复的收入系统',
        expectedCycleDays: 90,
        confidence: 0.70,
        provisional: false,
        source: 'computeDecision[unknownCode:' + code + '][overall:' + overall + ']',
      }
    }
    return {
      code: 'INCREASE_MONETIZATION',
      title: '用最小代价完成首次付费验证',
      reason: '当前画像数据不足以确定最优路径，但优先策略是完成一次真实变现',
      expectedCycleDays: 90,
      confidence: 0.5,
      provisional: false,
      source: 'computeDecision[unknownCode:' + code + '][overall:' + overall + ']',
    }
  }

  return {
    code: match.code,
    title: match.title,
    reason: match.reason,
    expectedCycleDays: match.expectedCycleDays,
    confidence: match.confidence,
    provisional: match.provisional || false,
    source: 'CONTRADICTION_TO_DECISION[' + code + ']',
  }
}

/**
 * v6.5.3: 从 contradiction + engine 推导命运判决
 * 绑定 contradiction.code → verdict 变量化以提高多样性
 */
function computeVerdict(contradiction, engineResult) {
  assertValidEngineResult(engineResult)

  const profile = engineResult.normalizedProfile || {}
  const scores = engineResult.scores || {}
  const fatalCount = (engineResult.fatalRules || []).length
  const cc = contradiction || {}
  const code = cc.code || 'UNKNOWN'

  // ── 基于 contradiction.code 的确定性 verdict mapping ──
  const verdictByCode = {
    LEARNING_EXECUTION_CONFLICT: {
      headline: fatalCount >= 3 ? '你的财富系统存在关键的知行缺口' : '你的学习速度需要匹配执行强度',
      explanation: fatalCount >= 3
        ? fatalCount + '个风险信号指向执行链断裂。输入和产出的速度严重不匹配'
        : '你吸收信息的速度高于产出结果的速度，知识长期停留在输入端',
    },
    AMBITION_DISCIPLINE_CONFLICT: {
      headline: '你的野心和纪律之间存在致命裂缝',
      explanation: '你的目标很大但坚持力不足，频繁在启动和放弃间循环。这正在侵蚀你的机会成本',
    },
    SPEED_CONSISTENCY_CONFLICT: {
      headline: '你的爆发力在消耗你的可能性',
      explanation: '你有爆发力但缺持久力，碎片化执行导致每次都从零开始。连续性比强度更重要',
    },
    STABILITY_GROWTH_CONFLICT: {
      headline: scores.overall >= 60 ?
        (profile.monetizableSkillRaw?.level === 'content' ? '你的创造力和系统化能力在等待引爆' : '你已经站在财富跃迁的起跑线上')
        : '你的稳定正在成为你成长的代价',
      explanation: scores.overall >= 60
        ? ((engineResult.advantageRules || []).length + '个优势点已被系统识别。只需要聚焦行动')
        : '你已经有良好的基础条件，但稳定的惯性正在压制突破的可能性',
    },
    RISK_REWARD_CONFLICT: {
      headline: (profile.debtPressureRaw?.level === 'high')
        ? '风险杠杆已经透支你未来的可能性'
        : '风险敞口已经超过你的回收能力',
      explanation: (profile.debtPressureRaw?.level === 'high')
        ? '以贷养贷是指数级风险的加速器。利息不是问题，利息是问题放大器。任何投资都要等现金流转正之后'
        : '当前负债正在吞噬未来的一切机会。停损是第一优先，任何投资都要等现金流转正之后',
    },
    SINGLE_INCOME_LOW_BUFFER: {
      headline: scores.overall <= 25 ? '你的财富系统已经陷入多维度危机' : '收入结构是你当前所有问题的放大镜',
      explanation: '收入来源单一且抗风险缓冲不足。任何行业波动都会在你找到方向前耗光积累',
    },
    CONTENT_WITHOUT_ACQUISITION: {
      headline: '你的创造力和变现能力不在同一个量级',
      explanation: '内容能力已经存在，但从内容到成交的转化链尚未建立。能力存在但杠杆不足',
    },
    RISK_AVOIDANCE_OPPORTUNITY: {
      headline: '你的安全感正在让你错过系统性机会',
      explanation: '安全垫充裕，但几乎不暴露于任何新机会。不暴露于机会的人，无法被机会选中',
    },
    EXECUTION_WITHOUT_DIRECTION: {
      headline: '你的行动力需要一个正确的方向校准',
      explanation: '执行力强/时间充裕，但当前路径风险敞口过高。方向校准后你的能量才能形成复利',
    },
    LOW_MONETIZATION_WITHOUT_LEVERAGE: {
      headline: fatalCount >= 4 ? '你的财富系统已经陷入多维度危机' : '你的能力还在等待第一次市场投票',
      explanation: fatalCount >= 4
        ? fatalCount + '个致命风险点被触发。现行路径正在加速资本损耗'
        : '你的能力从未换到过钱。在商业世界，未被付费验证的能力等于不存在',
    },
    INSUFFICIENT_EVIDENCE: {
      headline: '尚未形成完整画像 — 暂定诊断',
      explanation: '当前回答不足以支撑高置信度的路径判断。先补齐收入、时间、技能、负债四项关键信息再进入正式诊断',
    },
  }

  const match = verdictByCode[code]
  if (match) {
    return {
      headline: match.headline,
      explanation: match.explanation,
      contradictionCode: code,
    }
  }

  // fallback: 保留旧的 computeHeadline 逻辑
  const h = computeHeadline(profile, engineResult)
  return {
    headline: h.title,
    explanation: h.subtitle,
    contradictionCode: code,
  }
}

/**
 * v6.5.3: 从 scoreCard 和 profile 推导翻身潜力三要素
 */
function computePotential(engineResult) {
  assertValidEngineResult(engineResult)
  const scores = engineResult.scores || {}
  const profile = engineResult.normalizedProfile || {}

  // 优势
  const advantages = []
  if (scores.skill >= 60) advantages.push('技能变现已验证')
  if (scores.execution >= 60) advantages.push('执行力强')
  if (scores.time >= 60) advantages.push('可投入时间充裕')
  if (scores.cashflow >= 60) advantages.push('现金流健康')
  if (profile.skillValidationRaw?.level === 'market_validated' || profile.skillValidationRaw?.level === 'stable_clients') advantages.push('市场已付费验证')
  if (profile.safetyMonthsRaw?.level === 'strong' || profile.safetyMonthsRaw?.level === 'moderate_high') advantages.push('安全垫充裕')

  // 约束
  const constraints = []
  if (scores.risk <= 30) constraints.push('风险抵抗弱')
  if (scores.execution <= 30) constraints.push('执行持续性差')
  if (scores.skill <= 30) constraints.push('技能未验证')
  if (scores.time <= 30) constraints.push('可投入时间少')
  if (profile.debtPressureRaw?.level === 'high' || profile.debtPressureRaw?.level === 'consumer') constraints.push('负债压力大')
  if (profile.safetyMonthsRaw?.level === 'critical') constraints.push('生存安全垫不足')
  if (profile.monthlySurplusRaw?.level === 'negative') constraints.push('月结余为负')

  // 预计修复周期
  const fatalCount = (engineResult.fatalRules || []).length
  const estimatedDays = fatalCount >= 4 ? 180 : fatalCount >= 2 ? 120 : 60

  return {
    score: scores.overall || 0,
    level: scores.overall >= 75 ? 'high' : scores.overall >= 45 ? 'moderate' : 'critical',
    advantages: advantages.length ? advantages : ['个人能力基础'],
    constraints: constraints.length ? constraints : ['数据不足，待深入诊断'],
    estimatedRecoveryDays: estimatedDays,
  }
}

/**
 * v6.5.3: 从 actionPlan + decision 推导第一行动
 * PrimaryAction 必须与 Decision code 对应
 */
const DECISION_ACTION_MAP = {
  BUILD_EXECUTION_SYSTEM: {
    title: '21天连续执行——选择一个固定动作，每天完成并记录',
    tasks: ['选定一个可重复执行的固定动作', '设置每日提醒与执行时间窗口', '建立执行日志（纸笔或APP均可）'],
    checkpoint: '7天内建立执行习惯的初步反馈',
    successCriteria: ['连续7天完成每日执行', '执行日志中至少有一个阶段的回顾'],
  },
  BUILD_DISCIPLINE: {
    title: '固定作息计划——锁定每天90分钟不可变通的执行时间',
    tasks: ['从日程中去掉1个最无关紧要的活动', '确立每天的固定执行时间段', '设定一个本周必须完成的小目标'],
    checkpoint: '7天内验证作息是否可持续',
    successCriteria: ['本周内至少5天遵守固定执行时间', '完成一个小目标的产出'],
  },
  BUILD_SECOND_INCOME: {
    title: '7天内完成一个可售卖副业样本',
    tasks: ['从技能标签中选择一个可交付的服务', '定义服务的具体交付物和报价', '向3个潜在客户发出服务邀约'],
    checkpoint: '7天内有一个可被外部人评估的样本',
    successCriteria: ['至少1个外部人对样本给出了反馈', '明确了报价和服务边界'],
  },
  REBUILD_RISK_FRAMEWORK: {
    title: '7天内完成一次小额、可逆、有限损失的机会测试',
    tasks: ['列出不依赖主业以外的3个低成本收入实验', '选择一个损失上限最低的实验', '设定一个清晰的止损条件'],
    checkpoint: '7天内完成第一次实验并记录结果',
    successCriteria: ['实验实际花费不超过预设上限', '已记录实验的关键数据和反思'],
  },
  INCREASE_MONETIZATION: {
    title: '7天内设计一个明确报价并联系3个潜在客户',
    tasks: ['选定一个可交付的技能服务', '写下具体的服务描述和价格', '联系至少3个人——不推销，只告知服务'],
    checkpoint: '7天内获得第一个外部反应',
    successCriteria: ['至少1个人表达了兴趣或拒绝（拒绝也是有价值的反馈数据）', '形成了可复用的服务描述'],
  },
  REDUCE_DECISION_FATIGUE: {
    title: '每周投资1个低风险小实验',
    tasks: ['列出3个不超过2小时就能完成的机会测试', '选择一个风险最低的立即执行', '记录实验结论：值不值得深入？'],
    checkpoint: '7天内完成一个实验并做出价值判断',
    successCriteria: ['完成一个实验并记录结论', '下一个实验方向基于上一个实验的结论'],
  },
  DEEPEN_SPECIALIZATION: {
    title: '14天内完成一个专精方向的作品或案例',
    tasks: ['从现有技能中选出最想深耕的一个方向', '定义一个可展示的作品/案例标准', '制定14天内的产出里程碑'],
    checkpoint: '14天内有一个可被评估的专精作品',
    successCriteria: ['作品达到了预设的质量标准', '能够用一句话说明自己的专注领域和价值'],
  },
  COLLECT_MORE_EVIDENCE: {
    title: '7天内补齐收入、时间、技能、负债四项信息',
    tasks: ['记录近3个月的月度收入与支出', '记录一周的时间开销分布', '列出所有可交付技能及历史上的付费记录', '整理所有负债项目的利率和还款计划'],
    checkpoint: '7天内完成四项信息的收集',
    successCriteria: ['四项信息至少三项有可用的数据', '可以回答：我现在每个月到底能留下多少钱？'],
  },
}

function computePrimaryAction(engineResult) {
  assertValidEngineResult(engineResult)
  const fd = computeFatalDiagnosis(engineResult)
  const contradiction = computeContradiction(engineResult)
  const decision = computeDecision(contradiction, engineResult)
  const dCode = (decision && decision.code) || ''

  // ── v6.5.3: 基于 decision code 匹配行动 ──
  const mapped = DECISION_ACTION_MAP[dCode]
  if (mapped) {
    return {
      title: mapped.title,
      why: decision ? decision.reason : (fd ? fd.reason || '' : '诊断结果显示需要立刻行动'),
      tasks: mapped.tasks || [],
      checkpoint: mapped.checkpoint || '24小时内完成',
      successCriteria: mapped.successCriteria || ['完成第一步任务'],
      decisionCode: dCode,
    }
  }

  // fallback to action plan
  const ap = computeActionPlan(engineResult)
  const d1 = ap.day1 || {}
  return {
    title: d1.goal || '明确方向并执行第一步',
    why: decision ? decision.reason : (fd ? fd.reason || '' : '诊断结果显示需要立刻行动'),
    tasks: d1.tasks || [],
    checkpoint: d1.checkpoint || '24小时内完成',
    successCriteria: d1.checkpoint ? [d1.checkpoint] : ['完成第一步任务'],
    decisionCode: dCode,
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

  // ── v6.5.3: 结构化语义字段 ──
  // 14. contradiction（核心矛盾 — 永不为 null，至少返回二级分类结果）
  const contradiction = computeContradiction(engineResult)
  skeleton.contradiction = contradiction || { code: 'LOW_MONETIZATION_WITHOUT_LEVERAGE', title: '', leftSide: '', rightSide: '', desc: '' }

  // 15. decision（唯一决策 — 永不为 null，provisional 标记用于证据不足）
  const decision = computeDecision(contradiction || { code: 'LOW_MONETIZATION_WITHOUT_LEVERAGE' }, engineResult)
  skeleton.decision = decision

  // 16. verdict（命运判决）
  skeleton.verdict = computeVerdict(contradiction || { code: 'UNKNOWN' }, engineResult)

  // 17. potential（翻身潜力三要素）
  skeleton.potential = computePotential(engineResult)

  // 18. primaryAction（第一行动含 checkpoint，与 decision code 对应）
  skeleton.primaryAction = computePrimaryAction(engineResult)

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
  // v6.5.3
  computeContradiction,
  computeDecision,
  computeVerdict,
  computePotential,
  computePrimaryAction,
  classifyFallbackContradiction,
  assertValidEngineResult,
  CONTRADICTION_TO_DECISION,
  DECISION_ACTION_MAP,
}
