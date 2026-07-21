/**
 * core/turnaround-os/engines/missionEngineV6.js
 *
 * V6 Mission Engine — 从 profile + strategy + projection 生成完整 Mission Plan
 *
 * 输入契约（仅允许）：
 *   - profile      (identityEngine → buildIdentity 输出)
 *   - strategy     (turnaroundEngine → generateStrategy 输出)
 *   - projection   (destinyProjectionEngine → projectDestiny 输出)
 *
 * 禁止调用任何上游 Engine。Mission Engine 是消费者，不推导。
 *
 * @version 6.0.0
 * @status CHECKPOINT_4B
 */

const {
  VERSION,
  WEALTH_STAGES,
  MISSION_PHASES,
  MISSION_CATEGORIES_V6,
  MISSION_CATEGORY_LABELS_V6,
  COST_LEVELS,
  RISK_LEVELS,
  DIFFICULTY_LEVELS,
  FORBIDDEN_MISSIONS,
  WEEKLY_TIME_BUDGET_MINUTES,
  REVIEW_DECISIONS,
  LEVERAGE_LABELS,
} = require('../constants')

const {
  createMissionPlan,
  createMissionTheme,
  createPlanPrinciple,
  createCheckpoint,
  createPhasePlan,
  createWeeklyRhythm,
  createStrategicMetric,
  createDependency,
  createRejectedMission,
  normalizeMissionId,
} = require('../contracts/missionPlanContractV6')

const { createMission, createFallback, FALLBACK_TYPES } = require('../schemas/missionContractV6')
const { scoreMissionPriority } = require('./missionPrioritizerV6')

const CAT = MISSION_CATEGORIES_V6
const ALL_CATEGORIES = Object.values(CAT)

// ═══════════════════════════════════════
// 主导入函数
// ═══════════════════════════════════════

/**
 * generateMissionPlan — 从上行事实源生成完整 Mission Plan
 *
 * @param {Object} params
 * @param {Object} params.profile    — identityEngine 输出
 * @param {Object} params.strategy   — turnaroundEngine 输出
 * @param {Object} params.projection — destinyProjectionEngine 输出
 * @returns {Object} 完整 Mission Plan（符合 missionPlanContractV6）
 */
function generateMissionPlan({ profile, strategy, projection } = {}) {
  const plan = createMissionPlan()

  // 0. 引擎与 schema 版本
  plan.engineVersion = '6.0.0'
  plan.schemaVersion = 'mission-plan/1.0'

  // 1. 主题
  plan.missionTheme = buildTheme(strategy, profile)

  // 2. 计划原则
  plan.planPrinciples = buildPrinciples(profile, strategy)

  // 3. 生成三阶段任务
  plan.day7 = buildPhasePlan(profile, strategy, projection, MISSION_PHASES.DAY_7)
  plan.day30 = buildPhasePlan(profile, strategy, projection, MISSION_PHASES.DAY_30)
  plan.day90 = buildPhasePlan(profile, strategy, projection, MISSION_PHASES.DAY_90)

  // 4. 全部阶段任务统一评分
  const allMissions = [...plan.day7.missions, ...plan.day30.missions, ...plan.day90.missions]
  for (const mission of allMissions) {
    const { priorityScore, scoreBreakdown, ruleHits } = scoreMissionPriority({
      mission,
      profile,
      strategy,
      projection,
    })
    mission.priorityScore = priorityScore
    if (scoreBreakdown) {
      mission._scoreBreakdown = scoreBreakdown
    }
    if (ruleHits && ruleHits.length > 0) {
      mission._ruleHits = ruleHits
    }
  }

  // 5. 周节奏
  plan.weeklyRhythm = buildWeeklyRhythm(profile)

  // 6. 战略指标
  plan.strategicMetrics = buildMetrics(strategy, projection)

  // 7. 依赖图谱
  plan.dependencies = buildDependencies(plan, allMissions, strategy, projection)

  // 8. 禁止任务
  plan.rejectedMissions = buildRejectedList(profile, strategy)

  // 9. 假设与限制
  plan.assumptions = buildEngineAssumptions(profile, strategy, projection)
  plan.limitations = buildEngineLimitations(profile, strategy)

  // 10. 置信度
  plan.confidence = calculatePlanConfidence(profile, strategy, projection)

  // 11. 证据
  plan.evidence = collectPlanEvidence(profile, strategy, projection, allMissions)

  return plan
}

// ═══════════════════════════════════════
// 主题构建
// ═══════════════════════════════════════

function buildTheme(strategy, profile) {
  const head = strategy && strategy.verdict ? strategy.verdict.headline || '' : ''
  const goal = strategy && strategy.primaryStrategy ? strategy.primaryStrategy.strategicGoal || '' : ''
  const lever = (strategy && strategy.primaryStrategy && strategy.primaryStrategy.primaryLeverage)
    ? strategy.primaryStrategy.primaryLeverage.type
    : ''
  const stage = profile.wealthStageLabel || ''
  const game = strategy && strategy.wrongGame ? strategy.wrongGame.gameType || '' : ''

  return createMissionTheme({
    title: head || '翻身行动方案',
    strategicGoal: goal,
    primaryLeverage: lever,
    currentStage: stage,
    primaryWrongGame: game,
    successDefinition: strategy && strategy.primaryStrategy && strategy.primaryStrategy.successCondition
      ? strategy.primaryStrategy.successCondition.join('；')
      : '',
  })
}

// ═══════════════════════════════════════
// 计划原则
// ═══════════════════════════════════════

function buildPrinciples(profile, strategy) {
  const principles = []

  const notToDo = strategy && strategy.primaryStrategy && strategy.primaryStrategy.whatNotToDo
    ? strategy.primaryStrategy.whatNotToDo
    : []

  notToDo.forEach((item, i) => {
    principles.push(createPlanPrinciple({
      principleId: `PRI_${String(i + 1).padStart(2, '0')}`,
      title: item,
      reason: '基于当前约束条件的策略判断',
    }))
  })

  // 通用原则
  principles.push(createPlanPrinciple({
    principleId: 'PRI_GEN_01',
    title: '先验证再放大，先完成再完美',
    reason: '翻身战略的核心是快速验证假设，不追求一次到位',
  }))
  principles.push(createPlanPrinciple({
    principleId: 'PRI_GEN_02',
    title: '每 30 天复盘一次，根据结果调整下阶段任务',
    reason: '策略不是一成不变的，需要基于实际执行数据迭代',
  }))

  return principles
}

// ═══════════════════════════════════════
// 阶段任务生成
// ═══════════════════════════════════════

function buildPhasePlan(profile, strategy, projection, phase) {
  const missions = generateMissionsForPhase(profile, strategy, projection, phase)
  const plan = createPhasePlan(phase)

  plan.missions = missions
  plan.objective = buildPhaseObjective(phase, strategy, profile)
  plan.exitCriteria = buildPhaseExitCriteria(phase, profile, strategy)
  plan.failureResponse = buildPhaseFailureResponse(phase, profile)
  plan.checkpoint = createPhaseCheckpoint(phase, missions)

  return plan
}

/**
 * generateMissionsForPhase — 为核心阶段生成任务
 */
function generateMissionsForPhase(profile, strategy, projection, phase) {
  const missions = []
  const lever = getLeverageType(strategy)
  const stage = profile.wealthStage
  const game = strategy && strategy.wrongGame ? strategy.wrongGame.gameType : ''
  const readiness = profile.strategyReadinessScore || 50

  // 获取决策节点截止时间
  const deadlines = getPhaseDeadlines(phase, projection)

  let seq = 0

  if (phase === MISSION_PHASES.DAY_7) {
    seq = buildDay7Missions(missions, profile, strategy, lever, game, stage, phase, seq, deadlines)
  } else if (phase === MISSION_PHASES.DAY_30) {
    seq = buildDay30Missions(missions, profile, strategy, lever, game, stage, phase, seq, deadlines, readiness)
  } else if (phase === MISSION_PHASES.DAY_90) {
    seq = buildDay90Missions({ missions, profile, strategy, lever, game, stage, phase, seq, deadlines, readiness, projection })
  }

  return missions
}

/**
 * getLeverageType
 */
function getLeverageType(strategy) {
  return (strategy && strategy.primaryStrategy && strategy.primaryStrategy.primaryLeverage)
    ? strategy.primaryStrategy.primaryLeverage.type
    : ''
}

/**
 * getPhaseDeadlines
 */
function getPhaseDeadlines(phase, projection) {
  const nodes = (projection && projection.decisionNodes) || []
  return nodes.filter(n => {
    const dl = n.deadline || ''
    if (phase === MISSION_PHASES.DAY_7) return dl.includes('7') || dl.includes('14')
    if (phase === MISSION_PHASES.DAY_30) return dl.includes('30') || dl.includes('14')
    return true
  })
}

// ═══════════════════════════════════════
// DAY_7 任务
// ═══════════════════════════════════════

function buildDay7Missions(missions, profile, strategy, lever, game, stage, phase, seq) {
  const safetyMonths = (profile.reality && profile.reality.safetyMonths) || 0

  // 安全修复（SURVIVAL 阶段必做）
  if (safetyMonths < 3) {
    seq++
    missions.push(createMission({
      missionId: normalizeMissionId(phase, CAT.SAFETY_REPAIR, seq),
      phase,
      category: CAT.SAFETY_REPAIR,
      title: '建立现金流安全垫',
      instruction: '盘点未来7天所有非必要支出，砍掉至少20%。记录每笔支出并归类。目标是让安全月数增加至少0.5个月。',
      whyNow: `当前安全月数仅${safetyMonths}个月，处于高脆弱状态。不修复安全边界前任何增长操作都有崩塌风险。`,
      strategicPurpose: '先修复生存安全，再考虑增长',
      validatesAssumption: '用户可以在不增加收入的情况下通过削减支出来改善现金流',
      linkedLeverage: lever,
      linkedWrongGame: game,
      sourceEvidence: [`safetyMonths=${safetyMonths}`],
      prerequisites: [],
      estimatedMinutes: 60,
      estimatedCostLevel: COST_LEVELS.NONE,
      riskLevel: RISK_LEVELS.LOW,
      difficulty: DIFFICULTY_LEVELS.EASY,
      expectedOutput: '一份支出削减清单，至少3项已确认削减',
      proofOfCompletion: ['支出削减清单', '确认削减的支出项'],
      successCriteria: ['识别至少3项可削减支出', '至少执行2项削减'],
      failureSignals: ['无法找到可削减支出', '削减后仍无法改善安全月数'],
      fallback: createFallback({ type: FALLBACK_TYPES.ALTERNATE_MISSION, trigger: "无法找到可削减支出", targetCategory: CAT.SECOND_INCOME_TEST, instruction: "如果无法削减支出，说明当前支出已经是最低水平，转向探索低门槛的第二收入渠道作为补救方案。不要盲目投入资金或借债，从零成本的方式开始。" }),
      nextMissionIds: [],
    }))
  }

  // 时间审计
  seq++
  const timeStr = (profile.reality && profile.reality.availableHoursPerWeek) ? `当前每周可支配时间约${profile.reality.availableHoursPerWeek}小时` : ''
  missions.push(createMission({
    missionId: normalizeMissionId(phase, CAT.TIME_AUDIT, seq),
    phase,
    category: CAT.TIME_AUDIT,
    title: '时间结构审计',
    instruction: '记录接下来7天的时间去向（每小时记录一次）。按类别分：工作、通勤、家务、娱乐、社交、可支配。找出至少3个可以优化/压缩的时间段。' + (timeStr ? ` ${timeStr}。` : ''),
    whyNow: '翻身需要可支配时间，不了解时间的真实去向就无法有效分配',
    strategicPurpose: '为后续任务分配时间预算',
    validatesAssumption: '用户可以找到至少3个可压缩的时间段',
    linkedLeverage: lever,
    linkedWrongGame: game,
    sourceEvidence: [`availableHoursPerWeek=${profile.reality && profile.reality.availableHoursPerWeek}`],
    prerequisites: [],
    estimatedMinutes: 30,
    estimatedCostLevel: COST_LEVELS.NONE,
    riskLevel: RISK_LEVELS.LOW,
    difficulty: DIFFICULTY_LEVELS.EASY,
    expectedOutput: '一周时间记录 + 至少3个优化建议',
    proofOfCompletion: ['时间记录表', '优化建议清单'],
    successCriteria: ['完成至少5天的时间记录', '找到至少3个可优化时间段'],
    failureSignals: ['无法坚持记录', '发现时间已极度紧张无法再优化'],
    fallback: createFallback({ type: FALLBACK_TYPES.ALTERNATE_MISSION, trigger: "时间已极度紧张无法再优化", targetCategory: CAT.AI_WORKFLOW, instruction: "时间已极度紧张，转向低时间消耗任务：优先用AI工具自动化现有工作流程来释放时间" }),
    nextMissionIds: [],
  }))

  // 技能盘点
  seq++
  missions.push(createMission({
    missionId: normalizeMissionId(phase, CAT.SKILL_INVENTORY, seq),
    phase,
    category: CAT.SKILL_INVENTORY,
    title: '技能资产盘点',
    instruction: '列出你所有的技能（工作技能+业余技能+隐藏技能）。对每项技能回答：这项技能能否在我不在场的情况下产生价值？如果能，如何变现？',
    whyNow: '了解自己已有的可迁移资产是选择翻身方向的基础',
    strategicPurpose: '为选择杠杆方向和任务类型建立能力基线',
    validatesAssumption: '用户拥有一项或多项可市场化的技能',
    linkedLeverage: lever,
    linkedWrongGame: game,
    sourceEvidence: profile.assets && profile.assets.skills ? [`skills=${profile.assets.skills.join(',')}`] : [],
    prerequisites: [],
    estimatedMinutes: 45,
    estimatedCostLevel: COST_LEVELS.NONE,
    riskLevel: RISK_LEVELS.LOW,
    difficulty: DIFFICULTY_LEVELS.EASY,
    expectedOutput: '一份技能清单，至少标注3项可变现技能',
    proofOfCompletion: ['技能清单', '变现可行性分析'],
    successCriteria: ['列出至少5项技能', '对至少3项技能给出变现路径'],
    failureSignals: ['自我评估过于保守', '无法识别可迁移技能'],
    fallback: createFallback({ type: FALLBACK_TYPES.RETRY, trigger: "无法识别可迁移技能", instruction: "从最想学的技能开始，制定学习计划，在30天后重新评估技能变现可能性" }),
    nextMissionIds: [],
  }))

  return seq
}

// ═══════════════════════════════════════
// DAY_30 任务
// ═══════════════════════════════════════

function buildDay30Missions(missions, profile, strategy, lever, game, stage, phase, seq, deadlines, readiness) {
  const stageLabel = profile.wealthStageLabel || stage
  const goal = strategy && strategy.primaryStrategy ? strategy.primaryStrategy.strategicGoal || '' : ''

  // 基于杠杆的任务
  if (lever === 'AI_PRODUCTIVITY') {
    seq++
    missions.push(createMission({
      missionId: normalizeMissionId(phase, CAT.AI_WORKFLOW, seq),
      phase,
      category: CAT.AI_WORKFLOW,
      title: 'AI 工作流上线',
      instruction: '选择你工作中最重复的一项任务（邮件/文档/数据处理/客服），使用AI工具覆盖该任务的至少50%。记录使用前后的时间对比。',
      whyNow: `${stageLabel}阶段，AI是最低成本的效率放大器。${goal}`,
      strategicPurpose: '释放时间，为建立资产创造空间',
      validatesAssumption: 'AI工具能显著降低日常重复任务的时间消耗',
      linkedLeverage: lever,
      linkedWrongGame: game,
      sourceEvidence: ['primaryLeverage=AI_PRODUCTIVITY'],
      prerequisites: ['完成技能盘点', '完成时间审计'],
      estimatedMinutes: 120,
      estimatedCostLevel: COST_LEVELS.LOW,
      riskLevel: RISK_LEVELS.LOW,
      difficulty: DIFFICULTY_LEVELS.MODERATE,
      expectedOutput: '一个运行中的AI工作流 + 时间节省报告',
      proofOfCompletion: ['工作流截图/链接', '使用前后时间对比'],
      successCriteria: ['至少一个重复任务由AI覆盖50%以上', '每周节省至少1小时'],
      failureSignals: ['选择的AI工具无法适配工作场景', '学习成本超过节省的时间'],
      fallback: createFallback({ type: FALLBACK_TYPES.RETRY, trigger: "AI工具无法适配工作场景", instruction: "切换AI工具或简化任务范围，从最简单的任务开始重新尝试" }),
      nextMissionIds: [],
    }))
  }

  if (lever === 'CONTENT_DISTRIBUTION') {
    seq++
    missions.push(createMission({
      missionId: normalizeMissionId(phase, CAT.CONTENT_SYSTEM, seq),
      phase,
      category: CAT.CONTENT_SYSTEM,
      title: '建立内容分发频道',
      instruction: '选择一个平台（公众号/知乎/小红书/B站），确定内容定位，发布至少4篇内容。每篇内容需要有一个明确的"钩子"引导关注或互动。',
      whyNow: '你的能力目前对市场是隐形的。建立分发渠道是让能力产生市场价值的第一步。',
      strategicPurpose: '让市场看到你的能力，建立个人品牌和获客渠道',
      validatesAssumption: '持续内容输出能为用户带来关注和潜在客户',
      linkedLeverage: lever,
      linkedWrongGame: game,
      sourceEvidence: ['primaryLeverage=CONTENT_DISTRIBUTION'],
      prerequisites: ['完成技能盘点'],
      estimatedMinutes: 180,
      estimatedCostLevel: COST_LEVELS.LOW,
      riskLevel: RISK_LEVELS.MEDIUM,
      difficulty: DIFFICULTY_LEVELS.MODERATE,
      expectedOutput: '4篇已发布内容 + 内容计划表',
      proofOfCompletion: ['内容链接', '发布时间记录', '互动数据'],
      successCriteria: ['发布至少4篇内容', '获得至少20次有效互动'],
      failureSignals: ['发布后零互动', '无法坚持每周产出'],
      fallback: createFallback({ type: FALLBACK_TYPES.RETRY, trigger: "发布后零互动", instruction: "降低内容频率，聚焦质量；分析高互动内容类型并迭代" }),
      nextMissionIds: [],
    }))

    seq++
    missions.push(createMission({
      missionId: normalizeMissionId(phase, CAT.DISTRIBUTION_TEST, seq),
      phase,
      category: CAT.DISTRIBUTION_TEST,
      title: '分发渠道测试',
      instruction: '在至少两个不同平台各发布一条内容，对比72小时内的曝光量、互动率和引流效果。记录每个平台的有效触达成本。',
      whyNow: '不同平台的分发效率差异巨大，需要数据而非直觉来判断',
      strategicPurpose: '找到最高效的分发渠道，避免资源分散',
      validatesAssumption: '存在至少一个高效的分发渠道可以持续运营',
      linkedLeverage: lever,
      linkedWrongGame: game,
      sourceEvidence: ['primaryLeverage=CONTENT_DISTRIBUTION'],
      prerequisites: ['建立内容分发频道'],
      estimatedMinutes: 90,
      estimatedCostLevel: COST_LEVELS.LOW,
      riskLevel: RISK_LEVELS.LOW,
      difficulty: DIFFICULTY_LEVELS.MODERATE,
      expectedOutput: '渠道对比数据 + 主渠道选定',
      proofOfCompletion: ['各平台数据截图', '渠道选择分析'],
      successCriteria: ['测试至少2个平台', '选定一个主渠道'],
      failureSignals: ['所有平台表现一致差', '无法获得有效数据'],
      fallback: createFallback({ type: FALLBACK_TYPES.REASSESS, trigger: "所有平台表现一致差", instruction: "重新审视内容质量和定位，必要时调整目标受众或内容方向" }),
      nextMissionIds: [],
    }))
  }

  if (lever === 'SALES_CONVERSION') {
    seq++
    missions.push(createMission({
      missionId: normalizeMissionId(phase, CAT.SALES_VALIDATION, seq),
      phase,
      category: CAT.SALES_VALIDATION,
      title: '首次主动成交验证',
      instruction: '从你的联系人/受众中找出3-5个潜在客户，主动联系并尝试促成至少1笔成交。记录每次沟通的话术和反馈，迭代优化。',
      whyNow: '成交是变现链条上最关键的环节。不验证成交能力就不知道整个链条是否成立。',
      strategicPurpose: '验证变现能力，建立可复制的成交路径',
      validatesAssumption: '存在愿意为用户提供的价值付费的客户',
      linkedLeverage: lever,
      linkedWrongGame: game,
      sourceEvidence: ['primaryLeverage=SALES_CONVERSION'],
      prerequisites: ['完成技能盘点'],
      estimatedMinutes: 120,
      estimatedCostLevel: COST_LEVELS.NONE,
      riskLevel: RISK_LEVELS.MEDIUM,
      difficulty: DIFFICULTY_LEVELS.HARD,
      expectedOutput: '成交记录 + 成交话术模板',
      proofOfCompletion: ['沟通记录', '成交/拒绝记录', '话术迭代记录'],
      successCriteria: ['主动联系至少3人', '至少1笔成交或获得明确付费意向'],
      failureSignals: ['所有联系人均拒绝', '无法找到潜在客户'],
      fallback: createFallback({ type: FALLBACK_TYPES.ALTERNATE_MISSION, trigger: "无法直接成交", targetCategory: CAT.VALUE_PROPOSITION, instruction: "先做免费服务或咨询来建立信任和用户关系，延迟直接成交直到有足够信任基础" }),
      nextMissionIds: [],
    }))
  }

  if (lever === 'KNOWLEDGE_PRODUCT') {
    seq++
    missions.push(createMission({
      missionId: normalizeMissionId(phase, CAT.MINIMUM_OFFER, seq),
      phase,
      category: CAT.MINIMUM_OFFER,
      title: '知识产品 MVP 设计',
      instruction: '选择一项你最擅长的技能/经验，设计一个最小化的知识产品（课程大纲/电子书框架/咨询服务包）。明确：谁需要、解决什么问题、定价多少、如何交付。',
      whyNow: '知识产品是典型的高杠杆资产——一次创作可以重复销售。当前阶段需要先验证是否有市场。',
      strategicPurpose: '将个人能力转化为可复制的产品资产',
      validatesAssumption: '用户的技能/经验有足够市场价值可以产品化',
      linkedLeverage: lever,
      linkedWrongGame: game,
      sourceEvidence: ['primaryLeverage=KNOWLEDGE_PRODUCT'],
      prerequisites: ['完成技能盘点'],
      estimatedMinutes: 180,
      estimatedCostLevel: COST_LEVELS.LOW,
      riskLevel: RISK_LEVELS.MEDIUM,
      difficulty: DIFFICULTY_LEVELS.MODERATE,
      expectedOutput: '产品设计文档，包含完整的产品画布',
      proofOfCompletion: ['产品设计文档', '产品画布'],
      successCriteria: ['明确目标用户画像', '明确定价策略', '明确交付方式'],
      failureSignals: ['无法找到差异化定位', '目标用户过于宽泛'],
      fallback: createFallback({ type: FALLBACK_TYPES.RETRY, trigger: "无法找到差异化定位", instruction: "缩小产品范围，从一个非常具体的痛点开始，重新定义产品范围" }),
      nextMissionIds: [],
    }))
  }

  if (lever === 'SERVICE_PRODUCTIZATION') {
    seq++
    missions.push(createMission({
      missionId: normalizeMissionId(phase, CAT.SERVICE_PRODUCTIZATION, seq),
      phase,
      category: CAT.SERVICE_PRODUCTIZATION,
      title: '服务标准化第一步',
      instruction: '选中当前最常交付的一项服务，创建完整的SOP文档：服务范围、交付流程、检查清单、定价、时间线。目标是让另一个有基础技能的人能按SOP完成60%以上的工作。',
      whyNow: '服务如果不标准化，你的收入永远和你的时间成正比。标准化是脱离"卖时间"的第一步。',
      strategicPurpose: '减少个人在服务交付中的不可替代性，为规模化打基础',
      validatesAssumption: '服务可以标准化到非本人可执行的程度',
      linkedLeverage: lever,
      linkedWrongGame: game,
      sourceEvidence: ['primaryLeverage=SERVICE_PRODUCTIZATION'],
      prerequisites: ['完成技能盘点', '完成时间审计'],
      estimatedMinutes: 180,
      estimatedCostLevel: COST_LEVELS.NONE,
      riskLevel: RISK_LEVELS.LOW,
      difficulty: DIFFICULTY_LEVELS.MODERATE,
      expectedOutput: '一份完整的服务SOP文档',
      proofOfCompletion: ['SOP文档', '检查清单'],
      successCriteria: ['SOP覆盖服务全流程', '非本人可按SOP理解60%以上'],
      failureSignals: ['服务本身过于定制化无法标准', 'SOP过于复杂无人能执行'],
      fallback: createFallback({ type: FALLBACK_TYPES.RETRY, trigger: "服务过于定制化无法标准", instruction: "从服务中最重复的环节开始标准化，而不是整个服务" }),
      nextMissionIds: [],
    }))
  }

  if (lever === 'AUTOMATION_SYSTEM') {
    seq++
    missions.push(createMission({
      missionId: normalizeMissionId(phase, CAT.AUTOMATION_BUILD, seq),
      phase,
      category: CAT.AUTOMATION_BUILD,
      title: '首个流程自动化',
      instruction: '识别业务中最耗时的重复性流程（客户跟进/订单处理/数据分析/报表生成），使用工具完成该流程的自动化。记录自动化前后的时间对比。',
      whyNow: '自动化是让生意不再依赖你个人的关键步骤。每自动化一个流程，你就多一分自由。',
      strategicPurpose: '让系统替代人工完成重复性工作',
      validatesAssumption: '业务流程可以被自动化到不需要人工干预的程度',
      linkedLeverage: lever,
      linkedWrongGame: game,
      sourceEvidence: ['primaryLeverage=AUTOMATION_SYSTEM'],
      prerequisites: ['完成时间审计'],
      estimatedMinutes: 240,
      estimatedCostLevel: COST_LEVELS.LOW,
      riskLevel: RISK_LEVELS.MEDIUM,
      difficulty: DIFFICULTY_LEVELS.HARD,
      expectedOutput: '一个运行中的自动化流程 + 效率对比数据',
      proofOfCompletion: ['自动化流程截图', '时间节省对比'],
      successCriteria: ['至少一个流程被自动化', '节省至少30%时间'],
      failureSignals: ['自动化工具过于复杂', '流程本身不适合自动化'],
      fallback: createFallback({ type: FALLBACK_TYPES.RETRY, trigger: "自动化工具过于复杂", instruction: "选择更简单的流程开始，或寻求技术帮助降低实现难度" }),
      nextMissionIds: [],
    }))
  }

  // 通用 DAY_30 任务
  seq++
  missions.push(createMission({
    missionId: normalizeMissionId(phase, CAT.VALUE_PROPOSITION, seq),
    phase,
    category: CAT.VALUE_PROPOSITION,
    title: '价值主张提炼',
    instruction: '回答三个问题：我能帮谁解决什么问题？为什么选我不选别人？我的解决方案独特在哪里？把答案浓缩成一句话。',
    whyNow: '明确的价值主张是所有后续商业行动的前提——没有清晰的定位，营销和销售都是浪费。',
    strategicPurpose: '建立清晰的市场定位和差异化',
    validatesAssumption: '用户能清晰表达自己的价值区别于竞争对手',
    linkedLeverage: lever,
    linkedWrongGame: game,
    sourceEvidence: ['skills', 'experiences'],
    prerequisites: ['完成技能盘点'],
    estimatedMinutes: 60,
    estimatedCostLevel: COST_LEVELS.NONE,
    riskLevel: RISK_LEVELS.LOW,
    difficulty: DIFFICULTY_LEVELS.MODERATE,
    expectedOutput: '一句话价值主张 + 目标客户画像',
    proofOfCompletion: ['价值主张文档', '客户画像'],
    successCriteria: ['价值主张明确具体', '能用一个具体场景说明'],
    failureSignals: ['价值主张过于宽泛无法区分', '与竞争对手无差异'],
    fallback: createFallback({ type: FALLBACK_TYPES.RETRY, trigger: "价值主张过于宽泛无法区分", instruction: "缩小目标客户范围，聚焦到一个非常具体的场景重新提炼" }),
    nextMissionIds: [],
  }))

  // customerResearch if we identified it
  const gameNeedsResearch = game === 'SKILL_WITHOUT_DISTRIBUTION' || game === 'CONTENT_WITHOUT_MONETIZATION'
  if (gameNeedsResearch) {
    seq++
    missions.push(createMission({
      missionId: normalizeMissionId(phase, CAT.CUSTOMER_RESEARCH, seq),
      phase,
      category: CAT.CUSTOMER_RESEARCH,
      title: '客户需求验证',
      instruction: '找到3-5个你认为的目标客户，做一次非正式访谈。问他们：最大的痛点是什么？愿意为什么付费？之前用过什么解决方案？为什么不满意？',
      whyNow: '不了解客户的真实痛点就设计产品，是最常见的失败模式',
      strategicPurpose: '确保产品和市场需求匹配，避免闭门造车',
      validatesAssumption: '用户对目标市场的需求判断与实际相符',
      linkedLeverage: lever,
      linkedWrongGame: game,
      sourceEvidence: ['gameNeedsResearch=true'],
      prerequisites: ['完成价值主张提炼'],
      estimatedMinutes: 90,
      estimatedCostLevel: COST_LEVELS.NONE,
      riskLevel: RISK_LEVELS.LOW,
      difficulty: DIFFICULTY_LEVELS.MODERATE,
      expectedOutput: '客户访谈记录 + 需求洞察总结',
      proofOfCompletion: ['访谈记录', '需求洞察总结'],
      successCriteria: ['完成至少3次访谈', '总结出至少3个关键需求'],
      failureSignals: ['无法找到目标客户访谈', '访谈结果与假设完全相反'],
      fallback: createFallback({ type: FALLBACK_TYPES.REASSESS, trigger: "无法找到目标客户", instruction: "目标客户定义有问题，需要重新定义目标受众并调整研究方法" }),
      nextMissionIds: [],
    }))
  }

  return seq
}

// ═══════════════════════════════════════
// DAY_90 任务
// ═══════════════════════════════════════

function buildDay90Missions(ctx) {
  var m = ctx.missions;
  var p = ctx.profile;
  var s = ctx.strategy;
  var l = ctx.lever;
  var g = ctx.game;
  var st = ctx.stage;
  var ph = ctx.phase;
  var sq = ctx.seq;
  var dl = ctx.deadlines;
  var rd = ctx.readiness;
  var pj = ctx.projection;
  var sl = p.wealthStageLabel || st;
  var gl = s && s.primaryStrategy ? s.primaryStrategy.strategicGoal || "" : "";

  // 复盘决策
  sq = sq + 1;
  m.push(createMission({
    missionId: normalizeMissionId(ph, CAT.REVIEW_AND_DECIDE, sq),
    phase: ph,
    category: CAT.REVIEW_AND_DECIDE,
    title: "90天战略复盘",
    instruction: "回顾过去90天的所有任务执行结果：哪些完成了？哪些卡住了？验证了什么假设？推翻/修正了什么假设？基于实际数据决定下一步方向。",
    whyNow: "90天是一个完整的战略周期。基于实际执行数据调整策略比基于直觉决策可靠得多。",
    strategicPurpose: "用实际数据代替假设来校准战略方向",
    validatesAssumption: "90天的执行数据足以提供方向调整的依据",
    linkedLeverage: l,
    linkedWrongGame: g,
    sourceEvidence: ["phase=DAY_90"],
    prerequisites: ["完成DAY_7和DAY_30阶段任务"],
    estimatedMinutes: 120,
    estimatedCostLevel: COST_LEVELS.NONE,
    riskLevel: RISK_LEVELS.LOW,
    difficulty: DIFFICULTY_LEVELS.MODERATE,
    expectedOutput: "90天复盘报告 + 下阶段调整方案",
    proofOfCompletion: ["复盘报告", "调整方案"],
    successCriteria: ["完整复盘所有任务执行情况", "基于数据做出方向决策"],
    failureSignals: ["90天内执行率低于50%", "无法从数据中提取有效结论"],
    fallback: createFallback({ type: FALLBACK_TYPES.REASSESS, trigger: "执行率低于50%", instruction: "先分析执行障碍（时间/精力/动力/方向），再做方向决策" }),
    nextMissionIds: []
  }));

  // SOP / 自动化 / 资产建设
  var needSop = l === "SERVICE_PRODUCTIZATION" || l === "AUTOMATION_SYSTEM";
  if (needSop) {
    sq = sq + 1;
    m.push(createMission({
      missionId: normalizeMissionId(ph, CAT.SOP_BUILD, sq),
      phase: ph,
      category: CAT.SOP_BUILD,
      title: "核心SOP体系建立",
      instruction: "将已验证的服务/流程完善为完整的SOP体系。包含：标准操作流程、常见问题处理、质量检查标准、异常处理流程。",
      whyNow: "SOP是可复制系统的基石。有了SOP，你才能从执行者转变为管理者。",
      strategicPurpose: "建立可复制、可授权的运营系统",
      validatesAssumption: "核心业务流程可以完整文档化",
      linkedLeverage: l,
      linkedWrongGame: g,
      sourceEvidence: ["primaryLeverage=" + l],
      prerequisites: ["完成服务标准化第一步", "完成首个流程自动化"],
      estimatedMinutes: 240,
      estimatedCostLevel: COST_LEVELS.LOW,
      riskLevel: RISK_LEVELS.LOW,
      difficulty: DIFFICULTY_LEVELS.HARD,
      expectedOutput: "完整的SOP体系文档",
      proofOfCompletion: ["SOP文档集", "流程图", "检查清单集"],
      successCriteria: ["覆盖至少3个核心流程", "非本人可执行所有流程"],
      failureSignals: ["流程本身变化太快无法固化", "文档过于复杂"],
      fallback: createFallback({ type: FALLBACK_TYPES.RETRY, trigger: "流程变化太快无法固化", instruction: "从最重要的1-2个流程开始，逐步扩展，等待流程稳定后再固化更多" }),
      nextMissionIds: []
    }));
  }

  // 资产建设
  sq = sq + 1;
  m.push(createMission({
    missionId: normalizeMissionId(ph, CAT.ASSET_BUILD, sq),
    phase: ph,
    category: CAT.ASSET_BUILD,
    title: "可复制资产盘点与规划",
    instruction: "梳理你在过去90天积累的所有可重复使用的资产：内容、代码、模板、客户列表、渠道、经验文档。制定将这些资产系统化管理的计划。",
    whyNow: "资产是可复利增长的燃料。不知道有什么资产就无法利用它们。",
    strategicPurpose: "建立资产管理系统，启动复利飞轮",
    validatesAssumption: "用户在执行过程中积累了可重复使用的资产",
    linkedLeverage: l,
    linkedWrongGame: g,
    sourceEvidence: [],
    prerequisites: ["完成90天战略复盘"],
    estimatedMinutes: 90,
    estimatedCostLevel: COST_LEVELS.NONE,
    riskLevel: RISK_LEVELS.LOW,
    difficulty: DIFFICULTY_LEVELS.EASY,
    expectedOutput: "资产清单 + 资产管理计划",
    proofOfCompletion: ["资产清单", "管理计划"],
    successCriteria: ["盘点至少5项可复用资产", "制定资产复用计划"],
    failureSignals: ["90天内未积累可复用资产"],
    fallback: createFallback({ type: FALLBACK_TYPES.REASSESS, trigger: "90天内未积累可复用资产", instruction: "说明需要调整策略，优先积累可复用的产出而不是一次性任务" }),
    nextMissionIds: []
  }));

  // 第二收入
  var isSV = st === WEALTH_STAGES.SURVIVAL || st === WEALTH_STAGES.STABILITY;
  if (isSV) {
    sq = sq + 1;
    m.push(createMission({
      missionId: normalizeMissionId(ph, CAT.SECOND_INCOME_TEST, sq),
      phase: ph,
      category: CAT.SECOND_INCOME_TEST,
      title: "第二收入验证",
      instruction: "基于前90天的执行结果，选择一个已验证的方向，尝试建立持续的第二收入来源。设定收入目标和时间线。",
      whyNow: sl + "阶段，建立第二收入是打破单一收入依赖的关键一步。目标不是立刻赚很多，而是证明可以。",
      strategicPurpose: "建立多元收入结构，降低单一来源的脆弱性",
      validatesAssumption: "存在可行的第二收入路径",
      linkedLeverage: l,
      linkedWrongGame: g,
      sourceEvidence: ["stage=" + st],
      prerequisites: ["完成90天战略复盘"],
      estimatedMinutes: 180,
      estimatedCostLevel: COST_LEVELS.LOW,
      riskLevel: RISK_LEVELS.MEDIUM,
      difficulty: DIFFICULTY_LEVELS.HARD,
      expectedOutput: "第二收入执行计划 + 首次收入记录",
      proofOfCompletion: ["收入计划", "收入记录"],
      successCriteria: ["制定清晰的第二收入计划", "执行至少一次收入尝试"],
      failureSignals: ["尝试后无任何收入", "找不到可行的方向"],
      fallback: createFallback({ type: FALLBACK_TYPES.RETRY, trigger: "尝试后无任何收入", instruction: "从最低门槛的副业开始，不追求收入金额先追求验证" }),
      nextMissionIds: []
    }));
  }

  // 委托测试
  var canDel = rd >= 50 && (l === "SERVICE_PRODUCTIZATION" || l === "AUTOMATION_SYSTEM" || l === "TEAM_CAPITAL");
  if (canDel) {
    sq = sq + 1;
    m.push(createMission({
      missionId: normalizeMissionId(ph, CAT.DELEGATION_TEST, sq),
      phase: ph,
      category: CAT.DELEGATION_TEST,
      title: "委托测试",
      instruction: "选择一个你已经建立了SOP的任务，委托给他人执行。记录委托过程中的问题和收获。",
      whyNow: "委托是杠杆效应的第一步。你能委托的越多，你的时间越自由",
      strategicPurpose: "验证委托可行性，为团队扩张打基础",
      validatesAssumption: "SOP化后的任务可以委托他人执行",
      linkedLeverage: l,
      linkedWrongGame: g,
      sourceEvidence: ["rd>=50", "l=" + l],
      prerequisites: ["完成核心SOP体系建立"],
      estimatedMinutes: 120,
      estimatedCostLevel: COST_LEVELS.LOW,
      riskLevel: RISK_LEVELS.MEDIUM,
      difficulty: DIFFICULTY_LEVELS.HARD,
      expectedOutput: "委托记录 + 委托改进方案",
      proofOfCompletion: ["委托记录", "改进方案"],
      successCriteria: ["完成至少一次委托", "记录委托问题和改进"],
      failureSignals: ["SOP不够清晰导致委托失败", "找不到合适的人委托"],
      fallback: createFallback({ type: FALLBACK_TYPES.RETRY, trigger: "SOP不够清晰导致委托失败", instruction: "先优化SOP质量，补充更多细节和检查清单，然后重新委托" }),
      nextMissionIds: []
    }));
  }

  return sq;
}

// ═══════════════════════════════════════
// 阶段目标与出口条件
// ═══════════════════════════════════════

function buildPhaseObjective(phase, strategy, profile) {
  if (phase === MISSION_PHASES.DAY_7) {
    return '在7天内完成基础评估和自我认知建立，为后续行动提供清晰的方向基线'
  }
  if (phase === MISSION_PHASES.DAY_30) {
    return '在30天内开始行动并验证核心假设，形成首批可观测的结果'
  }
  return '在90天内完成一个完整的战略周期，建立可持续的执行系统并做出下一步决策'
}

function buildPhaseExitCriteria(phase, profile, strategy) {
  if (phase === MISSION_PHASES.DAY_7) {
    return [
      '完成时间审计',
      '完成技能盘点',
      '明确杠杆方向',
      '（如需要）启动安全垫修复',
    ]
  }
  if (phase === MISSION_PHASES.DAY_30) {
    return [
      '完成至少3项核心任务',
      '有至少1项可验证的结果（数据/产品/收入）',
      '验证或修正至少1个核心假设',
    ]
  }
  return [
    '完成90天战略复盘',
    '有足够的执行数据支撑下一步决策',
    '明确下一阶段的继续/调整/停止方向',
  ]
}

function buildPhaseFailureResponse(phase, profile) {
  if (phase === MISSION_PHASES.DAY_7) {
    return [
      '如果无法完成基础评估：可能需要更高的外部支持或更大的时间投入承诺',
      '如果评估结果低于预期：不要气馁，了解现实是改变现实的第一步',
    ]
  }
  if (phase === MISSION_PHASES.DAY_30) {
    return [
      '如果执行率低于50%：分析执行障碍（时间/精力/动力/方向），调整任务颗粒度',
      '如果验证结果全为负面：不是失败，是成功排除了错误方向——重新校准',
    ]
  }
  return [
    '如果90天执行率低于30%：可能需要考虑是否在当前约束条件下适合启动翻身计划',
    '如果方向验证失败：基于失败数据重新进行诊断',
  ]
}

function createPhaseCheckpoint(phase, missions) {
  const desc = phase === MISSION_PHASES.DAY_7
    ? '7天基础评估完成，具备清晰的方向和行动基线'
    : phase === MISSION_PHASES.DAY_30
      ? '30天验证周期完成，核心假设得到初步验证'
      : '90天完整战略周期完成，基于执行数据做出下一步决策'

  return createCheckpoint({
    description: desc,
    criteria: missions.slice(0, 3).map(m => m.title || m.instruction.slice(0, 50)),
    minEvidenceRequired: phase === MISSION_PHASES.DAY_7 ? '时间记录 + 技能清单' : '至少1项可验证结果',
  })
}

// ═══════════════════════════════════════
// 周节奏
// ═══════════════════════════════════════

function buildWeeklyRhythm(profile) {
  const stage = profile.wealthStage || WEALTH_STAGES.SURVIVAL
  const budget = WEEKLY_TIME_BUDGET_MINUTES[stage] || WEEKLY_TIME_BUDGET_MINUTES.SURVIVAL

  return createWeeklyRhythm({
    executionDays: ['周一', '周三', '周五', '周六'],
    reviewDay: '周日',
    minimumWeeklyHours: Math.round(budget.min / 60),
    maximumWeeklyHours: Math.round(budget.max / 60),
    focusRule: '每次执行前先确认本周优先级最高的1个任务，在完成它之前不切换',
    stopRule: '每日超过计划时间30%以上仍未完成的任务，标记并留到下个执行日',
  })
}

// ═══════════════════════════════════════
// 战略指标
// ═══════════════════════════════════════

function buildMetrics(strategy, projection) {
  const metrics = []

  // 安全指标
  metrics.push(createStrategicMetric({
    metricId: 'MET_SAFETY',
    name: '现金流安全月数',
    purpose: '确保生存安全边界不被击穿',
    targetType: 'QUANTITATIVE',
    targetValue: '>=3个月',
    measurementMethod: '月储蓄 / 月支出',
    reviewPhase: '每30天',
  }))

  // 执行指标
  metrics.push(createStrategicMetric({
    metricId: 'MET_EXECUTION',
    name: '任务执行率',
    purpose: '衡量行动承诺的兑现程度',
    targetType: 'QUANTITATIVE',
    targetValue: '>=70%',
    measurementMethod: '(已完成任务数 / 总计划任务数) × 100',
    reviewPhase: '每30天',
  }))

  // 验证指标
  metrics.push(createStrategicMetric({
    metricId: 'MET_VALIDATION',
    name: '假设验证进度',
    purpose: '跟踪核心商业假设的验证情况',
    targetType: 'BINARY',
    targetValue: '每阶段至少验证1个核心假设',
    measurementMethod: '已验证假设数 / 待验证假设数',
    reviewPhase: '每30天',
  }))

  // 杠杆指标
  const lever = (strategy && strategy.primaryStrategy && strategy.primaryStrategy.primaryLeverage)
    ? strategy.primaryStrategy.primaryLeverage.type
    : ''

  if (lever === 'CONTENT_DISTRIBUTION') {
    metrics.push(createStrategicMetric({
      metricId: 'MET_CONTENT',
      name: '内容产出量与互动率',
      purpose: '衡量分发渠道的建立进度',
      targetType: 'QUANTITATIVE',
      targetValue: '每阶段 >=4篇，互动率 >=5%',
      measurementMethod: '平台数据统计',
      reviewPhase: '每30天',
    }))
  }

  if (lever === 'SALES_CONVERSION') {
    metrics.push(createStrategicMetric({
      metricId: 'MET_SALES',
      name: '成交转化',
      purpose: '衡量变现能力的建立进度',
      targetType: 'QUANTITATIVE',
      targetValue: '每阶段 >=1笔成交',
      measurementMethod: '成交记录统计',
      reviewPhase: '每30天',
    }))
  }

  return metrics
}

// ═══════════════════════════════════════
// 依赖图谱
// ═══════════════════════════════════════

function buildDependencies(plan, allMissions, strategy, projection) {
  const graph = []
  const warnings = []

  // 从 missions 中提取依赖关系
  for (const m of allMissions) {
    if (m.prerequisites && m.prerequisites.length > 0) {
      for (const prereq of m.prerequisites) {
        // 查找是否有对应的前置 mission
        const prereqMission = allMissions.find(pm =>
          pm.title === prereq || pm.missionId === prereq
        )
        if (prereqMission) {
          graph.push(createDependency({
            from: prereqMission.missionId,
            to: m.missionId,
            type: 'REQUIRED',
            reason: `${prereq} 必须在 ${m.title} 之前完成`,
          }))
        }
      }
    }
  }

  // 计算关键路径（简化：取依赖链条最长的路径）
  if (graph.length > 0) {
    const blockedIds = new Set(graph.map(d => d.to))
    const sourceIds = new Set(graph.map(d => d.from))
    // 计算入度
    const inDegree = {}
    for (const d of graph) {
      inDegree[d.to] = (inDegree[d.to] || 0) + 1
      if (!(d.from in inDegree)) inDegree[d.from] = 0
    }
    // 拓扑排序取最长链
    const queue = Array.from(sourceIds).filter(id => (inDegree[id] || 0) === 0)
    const levels = {}
    for (const id of queue) levels[id] = 0
    while (queue.length > 0) {
      const current = queue.shift()
      for (const d of graph) {
        if (d.from === current) {
          levels[d.to] = Math.max(levels[d.to] || 0, (levels[current] || 0) + 1)
          inDegree[d.to]--
          if (inDegree[d.to] === 0) queue.push(d.to)
        }
      }
    }
    const maxLevel = Math.max(...Object.values(levels), 0)
    if (maxLevel > 1) {
      warnings.push('存在较长的任务依赖链（>2层），如果前置任务延迟会影响后续进度')
    }
  }

  return {
    missionGraph: graph,
    blockedMissions: graph.map(d => d.to).filter((v, i, a) => a.indexOf(v) === i),
    criticalPath: graph.filter(d => d.type === 'REQUIRED'),
    dependencyWarnings: warnings,
  }
}

// ═══════════════════════════════════════
// 禁止任务
// ═══════════════════════════════════════

function buildRejectedList(profile, strategy) {
  const rejected = []
  const stage = profile.wealthStage

  for (const [key, rule] of Object.entries(FORBIDDEN_MISSIONS)) {
    const isBlocked = rule.blockingStage === 'ALL' || rule.blockingStage === stage

    if (isBlocked) {
      rejected.push(createRejectedMission({
        missionType: key,
        title: rule.keyword,
        rejectionReason: rule.reason,
        blockingFactors: [`当前阶段: ${stage}`, `规则: ${rule.keyword} - ${rule.reason}`],
        reconsiderCondition: stage !== WEALTH_STAGES.SURVIVAL
          ? `进入更高财富阶段后重新评估`
          : '完成生存修复，安全月数>=3后重新评估',
      }))
    }
  }

  return rejected
}

// ═══════════════════════════════════════
// 假设与限制
// ═══════════════════════════════════════

function buildEngineAssumptions(profile, strategy, projection) {
  const assumptions = [
    '用户提交的 profile 数据真实有效',
    '外部经济环境不发生剧烈变化',
    '用户能够每周投入计划要求的最少时间',
    '用户保持基本的学习和行动意愿',
  ]

  // 来自 strategy
  if (strategy && strategy.verdict && strategy.verdict.assumptions) {
    for (const a of strategy.verdict.assumptions) {
      if (!assumptions.includes(a)) assumptions.push(a)
    }
  }

  // 来自 projection
  if (projection && projection.assumptions) {
    for (const a of projection.assumptions) {
      if (!assumptions.includes(a)) assumptions.push(a)
    }
  }

  return assumptions
}

function buildEngineLimitations(profile, strategy) {
  const limits = [
    '任务计划基于规则引擎生成，不包含实时 AI 个性化',
    '计划假设用户在指定时间内完成前置任务',
    '如果中途出现重大生活变化（失业、疾病等），需要重新生成计划',
  ]

  if (strategy && strategy.verdict && strategy.verdict.limitingFactors) {
    for (const l of strategy.verdict.limitingFactors) {
      limits.push(l)
    }
  }

  return limits
}

// ═══════════════════════════════════════
// 置信度
// ═══════════════════════════════════════

function calculatePlanConfidence(profile, strategy, projection) {
  let conf = 50

  // 数据完整度
  if (profile.strategyReadinessScore) conf += Math.min(15, profile.strategyReadinessScore / 5)

  // 战略置信度
  if (strategy && strategy.verdict && strategy.verdict.confidence) {
    conf += Math.min(10, strategy.verdict.confidence / 5)
  }

  // 推演置信度
  if (projection && projection.projectionConfidence) {
    conf += Math.min(10, projection.projectionConfidence / 5)
  }

  // 错误游戏确定性
  if (strategy && strategy.wrongGame && strategy.wrongGame.gameType && strategy.wrongGame.gameType !== 'UNKNOWN_GAME') {
    conf += 8
  }

  return Math.min(90, Math.max(10, Math.round(conf)))
}

// ═══════════════════════════════════════
// 证据
// ═══════════════════════════════════════

function collectPlanEvidence(profile, strategy, projection, allMissions) {
  const evidence = createMissionPlan().evidence

  // 来源字段
  evidence.sourceFields = [
    'profile.wealthStage',
    'profile.reality',
    'profile.capabilities',
    'strategy.verdict',
    'strategy.primaryStrategy',
    'strategy.wrongGame',
    'projection.decisionNodes',
  ]

  // 规则命中
  const hits = new Set()
  for (const m of allMissions) {
    if (m._ruleHits) {
      for (const h of m._ruleHits) hits.add(h)
    }
  }
  evidence.ruleHits = Array.from(hits)

  // 战略链接
  if (strategy && strategy.verdict) {
    evidence.strategyLinks = [
      `strategy.verdict.headline = ${strategy.verdict.headline || ''}`,
      `strategy.verdict.confidence = ${strategy.verdict.confidence || 0}`,
    ]
  }

  // 推演链接
  if (projection && projection.decisionNodes) {
    evidence.projectionLinks = projection.decisionNodes.map(n => n.node || '')
  }

  return evidence
}

// ═══════════════════════════════════════
// 导出
// ═══════════════════════════════════════

module.exports = {
  generateMissionPlan,
}
