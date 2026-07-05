/**
 * cloudfunctions/common/optimizationPlanner.js — 优化计划器
 *
 * 四册 Part 6：Self Evolution
 *
 * 职责：
 *   1. 基于质量评估 + 反馈分析 → 生成优化建议
 *   2. 管理 Prompt 版本演进（CHAT_V1 → V2 → V3）
 *   3. 管理 Knowledge 扩充建议
 *   4. 输出可执行的行动计划
 */

/**
 * planOptimizations(qualityReport, feedbackAnalysis, options)
 *
 * @param {object} qualityReport    — batchEvaluate / qualityEvaluator 输出
 * @param {object} feedbackAnalysis — analyzeFeedback 输出
 * @param {object} options          — { currentPromptVersions, knowledgeStats, driftHealth }
 * @returns {object} 优化行动计划
 */
function planOptimizations(qualityReport, feedbackAnalysis, options = {}) {
  const {
    currentPromptVersions = {},
    knowledgeStats = {},
    driftHealth = 'good',
  } = options

  const actions = []

  // ═══════════════════════
  // 1. Prompt 优化建议
  // ═══════════════════════
  const promptActions = _planPromptActions(feedbackAnalysis, currentPromptVersions)
  actions.push(...promptActions)

  // ═══════════════════════
  // 2. Knowledge 扩充建议
  // ═══════════════════════
  const knowledgeActions = _planKnowledgeActions(feedbackAnalysis, knowledgeStats)
  actions.push(...knowledgeActions)

  // ═══════════════════════
  // 3. Persona 强度调整
  // ═══════════════════════
  if (driftHealth === 'warning' || driftHealth === 'critical') {
    actions.push({
      priority: 'critical',
      category: 'persona',
      action: 'increase_persona_intensity',
      reason: `人格漂移检测：健康度=${driftHealth}`,
      detail: '提高 personaIntensity 全局参数（建议+2），增加 Hook Engine 使用频率',
    })
  }

  // ═══════════════════════
  // 4. Strategy 权重调整
  // ═══════════════════════
  const strategyActions = _planStrategyActions(feedbackAnalysis)
  actions.push(...strategyActions)

  // ═══════════════════════
  // 5. 模板/Hook 优化
  // ═══════════════════════
  if (feedbackAnalysis && feedbackAnalysis.topComplaints) {
    const boringTag = feedbackAnalysis.topComplaints.find(c => c.tag === 'boring' || c.tag === 'too_generic')
    if (boringTag && boringTag.count >= 3) {
      actions.push({
        priority: 'high',
        category: 'hooks',
        action: 'add_more_hook_templates',
        reason: `"${boringTag.tag}" 被投诉 ${boringTag.count} 次`,
        detail: '增加 5-10 个赌场型/打脸型 Hook 模板，降低反常识型模板重复率',
      })
    }
  }

  // ═══════════════════════
  // 6. 长度控制调整
  // ═══════════════════════
  const tooShallow = (feedbackAnalysis?.topComplaints || []).find(c => c.tag === 'too_shallow')
  if (tooShallow && tooShallow.count >= 3) {
    actions.push({
      priority: 'high',
      category: 'format',
      action: 'increase_response_depth',
      reason: `"too_shallow" 被投诉 ${tooShallow.count} 次`,
      detail: '将 medium 长度上限从 5 段 150 字提升到 6 段 180 字',
    })
  }

  // ═══════════════════════
  // 按优先级排序
  // ═══════════════════════
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return {
    planId: `PLAN_${Date.now()}`,
    createdAt: Date.now(),
    actions,
    summary: `${actions.length} 项优化建议：${actions.filter(a => a.priority === 'critical' || a.priority === 'high').length} 项高优`,
    estimatedImpact: _estimateImpact(actions),
  }
}

/**
 * _planPromptActions — Prompt 版本升级建议
 */
function _planPromptActions(feedbackAnalysis, currentVersions = {}) {
  const actions = []

  if (!feedbackAnalysis || !feedbackAnalysis.byIntent) return actions

  for (const [intent, data] of Object.entries(feedbackAnalysis.byIntent)) {
    if (data.poorCount >= 3 && parseFloat(data.avgRating) < 3.5) {
      const promptKey = _intentToPromptKey(intent)
      const currentVersion = currentVersions[promptKey] || 'v1'
      const nextVersion = _nextVersion(currentVersion)

      actions.push({
        priority: 'high',
        category: 'prompt',
        action: 'upgrade_prompt',
        target: promptKey,
        currentVersion,
        proposedVersion: nextVersion,
        reason: `${intent} 类回答评分偏低 (${data.avgRating})`,
        detail: `建议创建 ${promptKey}_${nextVersion.toUpperCase()}.js，重点提升深度和冲击力`,
      })
    }
  }

  return actions
}

function _intentToPromptKey(intent) {
  const map = {
    fact: 'FACT', advice: 'ADVICE', analysis: 'CHAT', coaching: 'COACHING',
    emotional: 'CHAT', strategic: 'STRATEGIC',
  }
  return map[intent] || 'CHAT'
}

function _nextVersion(currentVersion) {
  const num = parseInt(currentVersion.replace('v', '')) || 1
  return `v${num + 1}`
}

/**
 * _planKnowledgeActions — 知识库扩充建议
 */
function _planKnowledgeActions(feedbackAnalysis, knowledgeStats = {}) {
  const actions = []

  // 基于高频未命中话题
  const suggestionTags = (feedbackAnalysis?.topComplaints || [])
    .filter(c => c.tag === 'too_shallow' || c.tag === 'not_specific_enough')

  if (suggestionTags.length >= 2) {
    actions.push({
      priority: 'medium',
      category: 'knowledge',
      action: 'add_knowledge_entries',
      reason: `多个回答因"不够具体/深度不足"被投诉`,
      detail: '分析低分回答的话题分布，优先为高频未命中话题补充知识条目',
    })
  }

  // 基于现有知识库密度
  const totalKnowledge = Object.values(knowledgeStats).reduce((a, b) => a + b, 0)
  if (totalKnowledge < 200) {
    actions.push({
      priority: 'low',
      category: 'knowledge',
      action: 'expand_knowledge_base',
      reason: `知识库仅 ${totalKnowledge} 条`,
      detail: '目标 v2：扩展到 300 条，优先补充案例库和赌场规则库',
    })
  }

  return actions
}

/**
 * _planStrategyActions — 策略权重调整建议
 */
function _planStrategyActions(feedbackAnalysis) {
  const actions = []

  if (!feedbackAnalysis?.byStrategy) return actions

  // 找最优和最差策略
  const entries = Object.entries(feedbackAnalysis.byStrategy)
    .map(([s, d]) => ({ strategy: s, avgRating: parseFloat(d.avgRating) || 0, total: d.total }))
    .filter(e => e.total >= 3)
    .sort((a, b) => b.avgRating - a.avgRating)

  if (entries.length < 2) return actions

  const best = entries[0]
  const worst = entries[entries.length - 1]

  // 最差策略表现差 → 建议调整
  if (worst.avgRating < 3.5 && worst.total >= 3) {
    actions.push({
      priority: 'high',
      category: 'strategy',
      action: 'review_strategy',
      target: `strategy:${worst.strategy}`,
      reason: `${worst.strategy} 策略评分最低 (${worst.avgRating}，n=${worst.total})`,
      detail: `参考表现最好的 ${best.strategy} 策略 (${best.avgRating}) 的设计，调整 ${worst.strategy} 的输出结构和 Prompt`,
    })
  }

  // 如果有策略回复量高但评分低 → 可能是高频薄弱点
  const highVolumeLowQuality = entries.find(e => e.total >= 5 && e.avgRating < 4)
  if (highVolumeLowQuality) {
    actions.push({
      priority: 'high',
      category: 'strategy',
      action: 'fix_high_volume_weakness',
      target: `strategy:${highVolumeLowQuality.strategy}`,
      reason: `${highVolumeLowQuality.strategy} 策略使用频繁但评分偏低 (${highVolumeLowQuality.avgRating})`,
      detail: '这可能是影响最大的薄弱环节，优先修复',
    })
  }

  return actions
}

/**
 * _estimateImpact(actions) — 预估影响
 */
function _estimateImpact(actions) {
  const highCount = actions.filter(a => a.priority === 'critical' || a.priority === 'high').length
  if (highCount >= 5) return 'significant'
  if (highCount >= 2) return 'moderate'
  if (highCount >= 1) return 'minor'
  return 'negligible'
}

/**
 * createPromptEvolutionPlan(promptKey, currentContent, improvementGoals)
 * 生成 Prompt 版本升级计划的具体内容
 */
function createPromptEvolutionPlan(promptKey, currentContent, improvementGoals = []) {
  const currentVersion = 'v1'
  const newVersion = _nextVersion(currentVersion)

  const changelog = improvementGoals.map(g => {
    switch (g) {
      case 'increase_depth': return '增强底层逻辑拆解层次（从 3 层到 5 层）'
      case 'increase_shock': return '强化反常识 Hook（增加规则类比）'
      case 'improve_actionability': return '强制输出"第一步行动建议"'
      case 'reduce_fluff': return '移除冗余段落，每段控制 80 字以内'
      case 'strengthen_persona': return '增加小事哥标志性口语表达'
      default: return g
    }
  })

  return {
    promptKey,
    currentVersion,
    newVersion,
    changelog,
    createdAt: Date.now(),
    status: 'pending',
  }
}

module.exports = {
  planOptimizations,
  createPromptEvolutionPlan,
}
