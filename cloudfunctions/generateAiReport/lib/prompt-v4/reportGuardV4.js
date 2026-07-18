/**
 * prompt-v4/reportGuardV4.js
 *
 * 合并后的最终守卫。
 * 检查：
 * - LOCKED_FIELDS 未被 AI 修改
 * - RULE_IDS 未变
 * - SCORES 未变
 * - PROBABILITIES 未变
 * - WEALTH_PATH_STATUS 未变
 * - 无未知字段
 * - 无禁止路径推荐
 * - 无空 fatal sentence
 * - 无空 action plan
 */

// ═══════════════════════════════════════════════════════════════
// 锁定字段路径
// ═══════════════════════════════════════════════════════════════

const LOCKED_PATHS = [
  'version',
  'reportId',
  'generatedAt',
  'engineVersion',
  'diagnosticVersion',
  'report.wealthStage',
  'report.fatalDiagnosis.severity',
  'report.fatalDiagnosis.confidence',
  'report.fatalDiagnosis.matchedRuleIds',
  'report.fatalRules.*.ruleId',
  'report.fatalRules.*.weight',
  'report.advantageRules.*.ruleId',
  'report.advantageRules.*.weight',
  'report.opportunityRules.*.sourceRuleId',
  'report.scoreCard.cashflow',
  'report.scoreCard.skill',
  'report.scoreCard.execution',
  'report.scoreCard.time',
  'report.scoreCard.risk',
  'report.scoreCard.overall',
  'report.wealthProbability.today',
  'report.wealthProbability.after30',
  'report.wealthProbability.after90',
  'report.wealthProbability.after365',
  'report.wealthPath.*.recommend',
  'report.wealthPath.*.score',
  'report.stopDoing.priority',
]

function getValue(obj, path) {
  const parts = path.split('.')
  let cur = obj
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined
    if (p === '*') return cur // wildcard — handled differently
    cur = cur[p]
  }
  return cur
}

// ═══════════════════════════════════════════════════════════════
// 守卫
// ═══════════════════════════════════════════════════════════════

/**
 * @param {Object} baseContract — 合并前的原始 base contract
 * @param {Object} mergedContract — 合并后的 contract
 * @returns {{ ok: boolean, code?: string, violations?: string[] }}
 */
function guardReportV4(baseContract, mergedContract) {
  const violations = []

  // ── 1. LOCKED_FIELDS_UNCHANGED ──
  for (const path of LOCKED_PATHS) {
    // 跳过通配符路径 — 在专门检查中处理
    if (path.includes('*')) continue

    const baseVal = getValue(baseContract, path)
    const mergedVal = getValue(mergedContract, path)

    if (JSON.stringify(baseVal) !== JSON.stringify(mergedVal)) {
      violations.push(`LOCKED_FIELDS_UNCHANGED: ${path} was modified (${JSON.stringify(baseVal)} → ${JSON.stringify(mergedVal)})`)
    }
  }

  // ── 2. RULE_IDS_UNCHANGED ──
  checkRuleIdsUnchanged(baseContract, mergedContract, violations)

  // ── 3. WEALTH_PATH_STATUS_UNCHANGED ──
  checkWealthPathUnchanged(baseContract, mergedContract, violations)

  // ── 4. NO_UNKNOWN_FIELDS ──
  checkNoUnknownFields(mergedContract, violations)

  // ── 5. NO_FORBIDDEN_PATH_RECOMMENDATION ──
  checkForbiddenPaths(mergedContract, violations)

  // ── 6. NO_EMPTY_FATAL_SENTENCE ──
  checkEmptyFatalSentence(mergedContract, violations)

  // ── 7. NO_EMPTY_ACTION_PLAN ──
  checkEmptyActionPlan(mergedContract, violations)

  // ── 8. SCORES_UNCHANGED —— 已在 LOCKED_PATHS 中，但做额外验证 ──
  checkScoresUnchanged(baseContract, mergedContract, violations)

  // ── 9. PROBABILITIES_UNCHANGED ──
  checkProbabilitiesUnchanged(baseContract, mergedContract, violations)

  if (violations.length > 0) {
    return { ok: false, code: 'V4_AI_CONTRACT_VIOLATION', violations }
  }

  return { ok: true }
}

// ────────── guard helpers ──────────

function checkRuleIdsUnchanged(base, merged, violations) {
  const baseFatalIds = (base.report.fatalRules || []).map(r => r.ruleId).sort()
  const mergedFatalIds = (merged.report.fatalRules || []).map(r => r.ruleId).sort()
  if (JSON.stringify(baseFatalIds) !== JSON.stringify(mergedFatalIds)) {
    violations.push(`RULE_IDS_UNCHANGED: fatalRules changed from [${baseFatalIds}] to [${mergedFatalIds}]`)
  }

  const baseAdvIds = (base.report.advantageRules || []).map(r => r.ruleId).sort()
  const mergedAdvIds = (merged.report.advantageRules || []).map(r => r.ruleId).sort()
  if (JSON.stringify(baseAdvIds) !== JSON.stringify(mergedAdvIds)) {
    violations.push(`RULE_IDS_UNCHANGED: advantageRules changed from [${baseAdvIds}] to [${mergedAdvIds}]`)
  }

  // 检查 weight（按 ruleId 排序后比较）
  const mapToSortedWeights = (rules) => {
    return [...rules].sort((a, b) => a.ruleId.localeCompare(b.ruleId)).map(r => r.weight)
  }
  const baseFatalWeights = mapToSortedWeights(base.report.fatalRules || [])
  const mergedFatalWeights = mapToSortedWeights(merged.report.fatalRules || [])
  if (JSON.stringify(baseFatalWeights) !== JSON.stringify(mergedFatalWeights)) {
    violations.push('RULE_WEIGHTS_UNCHANGED: fatalRules weight changed')
  }

  const baseAdvWeights = mapToSortedWeights(base.report.advantageRules || [])
  const mergedAdvWeights = mapToSortedWeights(merged.report.advantageRules || [])
  if (JSON.stringify(baseAdvWeights) !== JSON.stringify(mergedAdvWeights)) {
    violations.push('RULE_WEIGHTS_UNCHANGED: advantageRules weight changed')
  }
}

function checkWealthPathUnchanged(base, merged, violations) {
  const basePaths = (base.report.wealthPath || []).map(p => ({ name: p.name, recommend: p.recommend, score: p.score }))
  const mergedPaths = (merged.report.wealthPath || []).map(p => ({ name: p.name, recommend: p.recommend, score: p.score }))
  if (JSON.stringify(basePaths) !== JSON.stringify(mergedPaths)) {
    violations.push('WEALTH_PATH_STATUS_UNCHANGED: path recommend/score was modified')
  }
}

function checkNoUnknownFields(merged, violations) {
  const allowedReportFields = [
    'headline', 'wealthStage', 'fatalDiagnosis', 'fatalRules', 'advantageRules',
    'opportunityRules', 'scoreCard', 'wealthProbability', 'wealthPath', 'actionPlan',
    'stopDoing', 'identityUpgrade', 'finalStrike',
  ]
  const extraKeys = Object.keys(merged.report || {}).filter(k => !allowedReportFields.includes(k))
  if (extraKeys.length > 0) {
    violations.push(`NO_UNKNOWN_FIELDS: extra keys in report: ${extraKeys.join(', ')}`)
  }
}

function checkForbiddenPaths(merged, violations) {
  // 检查 wealthPath 中被标记为 not_recommended 的路径，AI 是否改变了推荐状态或写了推荐性文案
  for (const path of (merged.report.wealthPath || [])) {
    if (path.recommend !== 'not_recommended') continue

    const reason = path.reason || ''
    if (!reason) continue

    // v3.2: 核心校验 — recommend 状态不能被 AI 改为 positive（Merge 层已守卫）
    // 这里只检查 reason 里是否包含「明确的鼓励性推荐措辞」
    // 注意：反面警示（"这叫赌博""等于找死"等）是合法劝退文案，必须放行
    const RECOMMEND_PATTERNS = [
      /强烈推荐/,
      /建议你做/,
      /建议搞/,
      /可以试试/,
      /值得一试/,
      /推荐你/,
      /这是个好/,
      /不错/,
      /很适合/,
    ]
    const hasRecommendation = RECOMMEND_PATTERNS.some(p => p.test(reason))
    if (hasRecommendation) {
      violations.push(`NO_FORBIDDEN_PATH_RECOMMENDATION: path "${path.name}" is not_recommended but reason contains recommendation: "${reason}"`)
    }
  }
}

function checkEmptyFatalSentence(merged, violations) {
  const fatalRules = merged.report.fatalRules || []
  if (fatalRules.length === 0) return // no fatal rules → ok

  for (const r of fatalRules) {
    if (!r.title || r.title.trim() === '') {
      violations.push(`NO_EMPTY_FATAL_SENTENCE: fatalRule ${r.ruleId} has empty title`)
    }
    if (!r.description || r.description.trim() === '') {
      violations.push(`NO_EMPTY_FATAL_SENTENCE: fatalRule ${r.ruleId} has empty description`)
    }
  }

  const fd = merged.report.fatalDiagnosis
  if (fd && (!fd.mainProblem || fd.mainProblem.trim() === '')) {
    violations.push('NO_EMPTY_FATAL_SENTENCE: fatalDiagnosis.mainProblem is empty')
  }
}

function checkEmptyActionPlan(merged, violations) {
  const plan = merged.report.actionPlan
  if (!plan) {
    violations.push('NO_EMPTY_ACTION_PLAN: actionPlan is missing')
    return
  }
  const days = ['day1', 'day3', 'day7', 'day15', 'day30']
  let filledDays = 0
  for (const day of days) {
    const d = plan[day]
    if (!d) continue
    const hasGoal = d.goal && d.goal.trim() !== ''
    const hasTasks = Array.isArray(d.tasks) && d.tasks.length > 0
    if (hasGoal && hasTasks) filledDays++
  }
  // v3.2: 从全空报错改为至少1天有内容即可 — AI 可能聚焦核心几天
  if (filledDays === 0) {
    violations.push('NO_EMPTY_ACTION_PLAN: all 5 days have empty goal or tasks')
  }
}

function checkScoresUnchanged(base, merged, violations) {
  const scoreFields = ['cashflow', 'skill', 'execution', 'time', 'risk', 'overall']
  for (const field of scoreFields) {
    if (base.report.scoreCard[field] !== merged.report.scoreCard[field]) {
      violations.push(`SCORES_UNCHANGED: scoreCard.${field} changed (${base.report.scoreCard[field]} → ${merged.report.scoreCard[field]})`)
    }
  }
}

function checkProbabilitiesUnchanged(base, merged, violations) {
  const probFields = ['today', 'after30', 'after90', 'after365']
  for (const field of probFields) {
    if (base.report.wealthProbability[field] !== merged.report.wealthProbability[field]) {
      violations.push(`PROBABILITIES_UNCHANGED: wealthProbability.${field} changed`)
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Fallback 生成
// ═══════════════════════════════════════════════════════════════

/**
 * 当 AI 解析/Guard 失败时，用 Contract 内确定性模板生成报告。
 * 不调用第二次 AI，不修改数字。
 */
function generateFallbackReport(baseContract) {
  const report = JSON.parse(JSON.stringify(baseContract.report))

  // 标记 renderSource
  report._renderSource = 'rule_fallback'

  // 使用 Base 的 title/description 作为文案（无 AI 润色）
  // 这些字段在 Base 中已经存在（来自 Mapper）

  // identityUpgrade — 用 Mapper 原值
  // finalStrike — 用 Mapper 原值
  // actionPlan — 用 Mapper 原值

  const result = JSON.parse(JSON.stringify(baseContract))
  result.report = report

  return result
}

module.exports = { guardReportV4, generateFallbackReport, LOCKED_PATHS }
