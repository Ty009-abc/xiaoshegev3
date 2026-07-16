/**
 * prompt-v4/promptPayloadV4.js
 *
 * 构造传给 AI 的 Prompt 输入 Payload。
 * 只提供必要事实，禁止泄漏私密信息。
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

    // ══ 绝对不可改的锁定事实 ══
    lockedFacts: buildLockedFacts(report),

    // ══ 允许 AI 写入的 schema ══
    writableSchema: buildWritableSchema(),
  }
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
    wealthPathReasons: 'object mapping pathName → reason string',
    actionPlan: 'object with day1/day3/day7/day15/day30, each { goal, tasks[], checkpoint }',
    stopDoingItems: 'array of strings (stop-doing items)',
    identityUpgrade: { currentIdentity: 'string', targetIdentity: 'string', gap: 'string', upgradePath: 'string' },
    finalStrike: { sentence: 'string (20-50 chars)', shareTitle: 'string (max 20 chars)' },
  }
}

module.exports = { buildPromptPayload }
