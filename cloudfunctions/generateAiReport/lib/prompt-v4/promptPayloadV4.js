/**
 * prompt-v4/promptPayloadV4.js (v3.2)
 *
 * 构造传给 AI 的 Prompt 输入 Payload。
 * v3.2: wealthPathStatus 注入完整 path name 列表（防止AI输出key不匹配）
 *       注入 fatal/advantage 规则原始文本（供 AI 场景像素级引用）
 */

/**
 * 从完整 report contract 中提取 AI 所需的最小 payload
 *
 * @param {Object} contract — 完整的 V4 Report Contract (含所有 section)
 * @param {Object} engineResult — turnaroundEngineV4.analyze() 原始输出
 * @returns {Object} AI 最小输入 payload
 */
function buildPromptPayload(contract, engineResult) {
  const profile = engineResult.normalizedProfile
  const report = contract.report

  return {
    reportVersion: 'v4',

    // ══ 原始诊断答案（15 个 V4 field）══
    userContext: {
      lifeStage: profile.lifeStage,
      incomeStructure: profile.incomeStructure,
      occupationDetail: profile.occupationDetail,
      monthlySurplus: profile.monthlySurplus,
      safetyMonths: profile.safetyMonths,
      debtPressure: profile.debtPressure,
      skillValidation: profile.skillValidation,
      monetizableSkill: profile.monetizableSkill,
      weeklyTime: profile.weeklyTime,
      executionStability: profile.executionStability,
      pastAttemptStage: profile.pastAttemptStage,
      decisionStyle: profile.decisionStyle,
      primaryGoal: profile.primaryGoal,
      maxTrialCost: profile.maxTrialCost,
      failureResponse: profile.failureResponse,
    },

    // ══ 引擎判断结果 ══
    judgment: {
      wealthStage: report.wealthStage,
      scores: report.scoreCard,
      matchedFatalRules: (report.fatalRules || []).map(r => ({
        ruleId: r.ruleId,
        title: r.title,
        description: r.description,
        weight: r.weight,
        why: r.why,
      })),
      matchedAdvantages: (report.advantageRules || []).map(r => ({
        ruleId: r.ruleId,
        title: r.title,
        description: r.description,
        weight: r.weight,
        why: r.why,
      })),
      matchedOpportunities: (report.opportunityRules || []).map(o => ({
        area: o.area,
        reason: o.reason,
        sourceRuleId: o.sourceRuleId,
      })),
      wealthProbability: report.wealthProbability,
      wealthPath: report.wealthPath,
      stopDoing: report.stopDoing,
      identityUpgrade: report.identityUpgrade,
    },

    // ══ v3.2: wealthPathStatus — 注入完整 path name 列表 ══
    wealthPathStatus: buildWealthPathStatus(report),

    // ══ 绝对不可改的锁定事实 ══
    lockedFacts: buildLockedFacts(report),

    // ══ 允许 AI 写入的 schema ══
    writableSchema: buildWritableSchema(),

    // ══ v3.2: 注入引擎原始规则文本 — 供 AI 做场景像素级引用 ══
    rawEngineData: buildRawEngineData(engineResult),
  }
}

/**
 * v3.2: 构建 wealthPathStatus — 明确列出每条路径的 name
 * 防止 AI 输出 key 时大小写或命名不匹配
 */
function buildWealthPathStatus(report) {
  if (!report.wealthPath || !Array.isArray(report.wealthPath)) return []
  return report.wealthPath.map(p => ({
    name: p.name,           // 例如 'working', 'freelance' 等
    recommend: p.recommend,
    score: p.score,
    reason: p.reason || '',
  }))
}

/**
 * v3.2: 从 engineResult 提取原始规则文本，让 AI 能引用规则的具体逻辑
 */
function buildRawEngineData(engineResult) {
  const data = {
    fatalRulesRaw: [],
    advantageRulesRaw: [],
    labelsAll: [],
  }

  // 致命规则原始文本
  for (const r of (engineResult.fatalRules || [])) {
    data.fatalRulesRaw.push({
      id: r.id,
      name: r.name,
      title: r.output?.title || r.name,
      description: r.output?.description || '',
      advice: r.output?.advice || '',
      weight: r.weight,
    })
  }

  // 优势规则原始文本
  for (const r of (engineResult.advantageRules || [])) {
    data.advantageRulesRaw.push({
      id: r.id,
      name: r.name,
      title: r.output?.title || r.name,
      description: r.output?.description || '',
      advice: r.output?.advice || '',
      weight: r.weight,
    })
  }

  // 全部标签
  data.labelsAll = (engineResult.labels || []).map(l => ({
    label: l.label,
    severity: l.severity,
  }))

  // 分数
  data.scores = engineResult.scores

  return data
}

/**
 * 提取锁定字段供 Prompt 声明
 */
function buildLockedFacts(report) {
  return {
    wealthStage: report.wealthStage,
    fatalDiagnosis: report.fatalDiagnosis ? {
      severity: report.fatalDiagnosis.severity,
      confidence: report.fatalDiagnosis.confidence,
      matchedRuleIds: report.fatalDiagnosis.matchedRuleIds,
    } : null,
    fatalRules: (report.fatalRules || []).map(r => ({ ruleId: r.ruleId, weight: r.weight })),
    advantageRules: (report.advantageRules || []).map(r => ({ ruleId: r.ruleId, weight: r.weight })),
    opportunityRules: (report.opportunityRules || []).map(o => ({
      area: o.area,
      sourceRuleId: o.sourceRuleId,
    })),
    scoreCard: report.scoreCard,
    wealthProbability: report.wealthProbability,
    wealthPathStatus: (report.wealthPath || []).map(p => ({
      name: p.name,
      recommend: p.recommend,
      score: p.score,
    })),
    stopDoingPriority: report.stopDoing?.priority,
  }
}

/**
 * 允许 AI 写入的字段声明
 */
function buildWritableSchema() {
  return {
    headline: { title: 'string (max 42 chars)', subtitle: 'string (max 100 chars)' },
    fatalDiagnosis: { mainProblem: 'string (max 100 chars)', reason: 'string (max 200 chars)' },
    fatalRules: 'array of { ruleId: must match lockedFacts, title, description, why }',
    advantageRules: 'array of { ruleId: must match lockedFacts, title, description, why }',
    opportunityRules: 'array of { area: must match lockedFacts, description, why }',
    wealthPathReasons: 'object — key 必须精确匹配 lockedFacts.wealthPathStatus 中的 name 字段（如 working, sideBusiness, freelance, investment, content, ai, entrepreneur），value 为 string (max 80 chars)',
    actionPlan: 'object with day1/day3/day7/day15/day30, each { goal, tasks[], checkpoint }',
    stopDoingItems: 'array of strings (stop-doing items)',
    identityUpgrade: { currentIdentity: 'string', targetIdentity: 'string', gap: 'string', upgradePath: 'string' },
    finalStrike: { sentence: 'string (20-50 chars)', shareTitle: 'string (max 20 chars)' },
  }
}

module.exports = { buildPromptPayload }
