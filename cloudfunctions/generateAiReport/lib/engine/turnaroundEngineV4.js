/**
 * engine/turnaroundEngineV4.js — TURNAROUND_DIAGNOSIS_V4_COGNITIVE_JUDGMENT
 *
 * V4 规则驱动认知诊断引擎
 * 输入: V4 15-key answers 对象
 * 输出: matchedRules, fatalRules, advantageRules, scores, labels, riskLevel, opportunityLevel, wealthProbability
 *
 * 职责：纯规则计算。
 * 禁止：AI 调用、自然语言生成、报告输出、数据库操作。
 */

const incomeRules    = require('./rules/incomeRules.js')
const cashflowRules  = require('./rules/cashflowRules.js')
const skillRules     = require('./rules/skillRules.js')
const timeRules      = require('./rules/timeRules.js')
const executionRules = require('./rules/executionRules.js')
const goalRules      = require('./rules/goalRules.js')
const riskRules      = require('./rules/riskRules.js')
const decisionRules  = require('./rules/decisionRules.js')

// ══════════════════════════════════════════════════════════════════
// 阶段 1: 答案归一化 — 将 V4 文本枚举转化为引擎内部 level
// ══════════════════════════════════════════════════════════════════

const LIFE_STAGE_MAP = {
  '18-24岁': 'young',
  '25-30岁': 'early_career',
  '31-40岁': 'mid_career',
  '41-50岁': 'late_career',
  '50岁以上': 'senior',
}

const INCOME_STRUCTURE_MAP = {
  '工资/固定薪资': 'salary',
  '技能服务（按次/项目收费）': 'skill_service',
  '销售/佣金/提成': 'sales_commission',
  '实体生意/经营收入': 'business',
  '线上内容/流量变现': 'content_online',
  '资产/投资/租金收入': 'asset_income',
  '收入不稳定': 'unstable',
}

const MONTHLY_SURPLUS_MAP = {
  '负数（入不敷出）': { level: 'negative', value: -1 },
  '基本为零': { level: 'zero', value: 0 },
  '1000元以下': { level: 'low', value: 500 },
  '1000-5000元': { level: 'low', value: 3000 },
  '5000-10000元': { level: 'moderate', value: 7500 },
  '10000元以上': { level: 'high', value: 15000 },
}

const SAFETY_MONTHS_MAP = {
  '不到1个月': { level: 'critical', value: 0.5 },
  '1-3个月': { level: 'very_low', value: 2 },
  '3-6个月': { level: 'low', value: 4.5 },
  '6-12个月': { level: 'moderate', value: 9 },
  '12-24个月': { level: 'moderate_high', value: 18 },
  '24个月以上': { level: 'strong', value: 30 },
}

const DEBT_PRESSURE_MAP = {
  '无负债': 'none',
  '房贷为主（低月供）': 'mortgage_low',
  '消费贷/信用卡压力较大': 'consumer',
  '债务压力高/以贷养贷': 'high',
}

const SKILL_VALIDATION_MAP = {
  '从未变现过': 'never',
  '免费帮人做过': 'unpaid',
  '免费被感谢过': 'unpaid',
  '赚到过一次钱': 'earned_once',
  '偶尔有付费需求': 'market_validated',
  '有稳定客户/收入': 'stable_clients',
}

const MONETIZABLE_SKILL_MAP = {
  '技术类（编程/设计/工程）': 'technical',
  '销售/商务谈单': 'sales',
  '运营/管理/统筹': 'operations',
  '内容创作（写/拍/剪/直播）': 'content',
  '人脉/资源对接': 'network',
  '手艺人（厨师/维修/美业）': 'craft',
  '暂时不清楚': 'none',
}

const WEEKLY_TIME_MAP = {
  '不到2小时': { level: 'very_low', value: 1 },
  '2-5小时': { level: 'low', value: 3.5 },
  '5-10小时': { level: 'moderate_low', value: 7.5 },
  '10-20小时': { level: 'moderate', value: 15 },
  '20小时以上': { level: 'high', value: 25 },
}

const EXECUTION_STABILITY_MAP = {
  '很容易三分钟热度，计划经常中断': 'very_low',
  '偶尔能坚持，但不稳定': 'low',
  '有固定计划，基本能执行': 'moderate',
  '非常稳定，不需要外部督促': 'stable',
}

const PAST_ATTEMPT_MAP = {
  '还没开始过任何尝试': 'never',
  '只买过课/看过教程，没真正做过': 'bought_only',
  '坚持不到30天就停了': 'under_30_days',
  '做了一个产品/服务但没卖出去': 'built_no_sale',
  '卖出过几个，有少量收入': 'small_sales',
  '已有稳定的副业/兼职收入': 'stable_side',
}

const DECISION_STYLE_MAP = {
  '直接辞职/全职All-in': 'all_in',
  '边上班边小规模测试': 'side_test',
  '先学一阵子再判断': 'learn_first',
  '等别人先做了我再跟上': 'wait_for_proof',
  '能不动就不动': 'avoid_all',
}

const PRIMARY_GOAL_MAP = {
  '搞一份副业收入': 'side_hustle',
  '把技能变现/做咨询': 'monetize',
  '建立个人IP/品牌': 'brand',
  '转行进入新领域': 'transition',
  '从副业变主业/独立': 'transition_full',
  '还清债务/修复现金流': 'debt_repair',
  '先找到方向再说': 'find_direction',
}

const MAX_TRIAL_COST_MAP = {
  '几乎为零（赔不起）': { level: 'zero', value: 0 },
  '1000元以内': { level: 'very_low', value: 500 },
  '1000-5000元': { level: 'low', value: 3000 },
  '5000-20000元': { level: 'moderate', value: 12500 },
  '20000元以上': { level: 'high', value: 25000 },
}

const FAILURE_RESPONSE_MAP = {
  '直接放弃，不再尝试': 'give_up',
  '换个方向继续试': 'change_direction',
  '复盘优化后继续': 'review_optimize',
  '追加投入再试一次': 'add_money',
  '不确定': 'unclear',
}

// ══════════════════════════════════════════════════════════════════

function normalizeAnswers(rawAnswers) {
  const a = rawAnswers.answers || rawAnswers // 支持 { diagnosticVersion, answers:{...} } 和裸对象

  const lifeStage         = a.lifeStage || ''
  const incomeStructure   = a.incomeStructure || ''
  const occupationDetail   = a.occupationDetail || ''
  const monthlySurplus    = a.monthlySurplus || ''
  const safetyMonths      = a.safetyMonths || ''
  const debtPressure      = a.debtPressure || ''
  const skillValidation   = a.skillValidation || ''
  const monetizableSkill   = a.monetizableSkill || ''
  const weeklyTime        = a.weeklyTime || ''
  const executionStability = a.executionStability || ''
  const pastAttemptStage   = a.pastAttemptStage || ''
  const decisionStyle     = a.decisionStyle || ''
  const primaryGoal       = a.primaryGoal || ''
  const maxTrialCost      = a.maxTrialCost || ''
  const failureResponse   = a.failureResponse || ''

  const ms = MONTHLY_SURPLUS_MAP[monthlySurplus] || { level: 'unknown', value: 0 }
  const sm = SAFETY_MONTHS_MAP[safetyMonths] || { level: 'unknown', value: 0 }
  const wt = WEEKLY_TIME_MAP[weeklyTime] || { level: 'unknown', value: 0 }
  const mtc = MAX_TRIAL_COST_MAP[maxTrialCost] || { level: 'unknown', value: 0 }

  return {
    // 原始文本
    lifeStage,
    incomeStructure,
    occupationDetail,
    monthlySurplus,
    safetyMonths,
    debtPressure,
    skillValidation,
    monetizableSkill,
    weeklyTime,
    executionStability,
    pastAttemptStage,
    decisionStyle,
    primaryGoal,
    maxTrialCost,
    failureResponse,

    // 引擎内部 level
    lifeStageRaw: { level: LIFE_STAGE_MAP[lifeStage] || 'unknown', raw: lifeStage },
    incomeStructureRaw: { level: INCOME_STRUCTURE_MAP[incomeStructure] || 'unknown', raw: incomeStructure },
    occupationDetailRaw: { level: occupationDetail, raw: occupationDetail },
    monthlySurplusRaw: { level: ms.level, value: ms.value, raw: monthlySurplus },
    safetyMonthsRaw: { level: sm.level, value: sm.value, raw: safetyMonths },
    debtPressureRaw: { level: DEBT_PRESSURE_MAP[debtPressure] || 'unknown', raw: debtPressure },
    skillValidationRaw: { level: SKILL_VALIDATION_MAP[skillValidation] || 'unknown', raw: skillValidation },
    monetizableSkillRaw: { level: MONETIZABLE_SKILL_MAP[monetizableSkill] || 'unknown', raw: monetizableSkill },
    weeklyTimeRaw: { level: wt.level, value: wt.value, raw: weeklyTime },
    executionStabilityRaw: { level: EXECUTION_STABILITY_MAP[executionStability] || 'unknown', raw: executionStability },
    pastAttemptStageRaw: { level: PAST_ATTEMPT_MAP[pastAttemptStage] || 'unknown', raw: pastAttemptStage },
    decisionStyleRaw: { level: DECISION_STYLE_MAP[decisionStyle] || 'unknown', raw: decisionStyle },
    primaryGoalRaw: { level: PRIMARY_GOAL_MAP[primaryGoal] || 'unknown', raw: primaryGoal },
    maxTrialCostRaw: { level: mtc.level, value: mtc.value, raw: maxTrialCost },
    failureResponseRaw: { level: FAILURE_RESPONSE_MAP[failureResponse] || 'unknown', raw: failureResponse },
  }
}

// ══════════════════════════════════════════════════════════════════
// 阶段 2: 规则评估
// ══════════════════════════════════════════════════════════════════

const ALL_RULES = [
  ...incomeRules,
  ...cashflowRules,
  ...skillRules,
  ...timeRules,
  ...executionRules,
  ...goalRules,
  ...riskRules,
  ...decisionRules,
]

function evaluateRules(data) {
  const matched = []
  const fatal = []
  const advantage = []

  for (const rule of ALL_RULES) {
    try {
      if (rule.condition(data)) {
        const result = {
          id: rule.id,
          name: rule.name,
          weight: rule.weight,
          level: rule.level,
          output: { ...rule.output },
        }
        matched.push(result)
        if (rule.level === 'fatal') fatal.push(result)
        if (rule.level === 'advantage') advantage.push(result)
      }
    } catch (e) {
      // 单个规则异常不影响其他规则评估
      console.error(`[turnaroundEngineV4] Rule ${rule.id} threw:`, e.message)
    }
  }

  return { matched, fatal, advantage }
}

// ══════════════════════════════════════════════════════════════════
// 阶段 3: 评分 & 标签
// ══════════════════════════════════════════════════════════════════

function computeScores(data, matchedRules) {
  // 权重加权分数
  let totalFatalWeight = 0
  let totalAdvantageWeight = 0
  let totalWeight = 0

  for (const r of matchedRules) {
    if (r.level === 'fatal') totalFatalWeight += r.weight
    if (r.level === 'advantage') totalAdvantageWeight += r.weight
    totalWeight += r.weight
  }

  // 各维度分数 (0-100, 越高越好)
  const cashflowScore = computeCashflowScore(data)
  const skillScore    = computeSkillScore(data)
  const executionScore = computeExecutionScore(data)
  const timeScore     = computeTimeScore(data)
  const riskScore     = computeRiskScore(data)

  return {
    totalFatalWeight,
    totalAdvantageWeight,
    totalWeight,
    cashflow: cashflowScore,
    skill: skillScore,
    execution: executionScore,
    time: timeScore,
    risk: riskScore,
    overall: Math.round((cashflowScore + skillScore + executionScore + timeScore + riskScore) / 5),
  }
}

function computeCashflowScore(data) {
  let score = 50
  const ms = data.monthlySurplusRaw
  const sm = data.safetyMonthsRaw
  const db = data.debtPressureRaw

  if (ms.level === 'negative') score -= 30
  else if (ms.level === 'zero') score -= 20
  else if (ms.level === 'low') score -= 5
  else if (ms.level === 'high') score += 15

  if (sm.level === 'critical') score -= 25
  else if (sm.level === 'very_low') score -= 15
  else if (sm.level === 'strong') score += 20

  if (db.level === 'high') score -= 25
  else if (db.level === 'none') score += 10

  return Math.max(0, Math.min(90, score))
}

function computeSkillScore(data) {
  let score = 50
  const sv = data.skillValidationRaw
  const ms_ = data.monetizableSkillRaw

  if (sv.level === 'never') score -= 20
  else if (sv.level === 'unpaid') score -= 10
  else if (sv.level === 'market_validated') score += 15
  else if (sv.level === 'stable_clients') score += 25

  if (ms_.level === 'none') score -= 15
  else if (ms_.level === 'technical' || ms_.level === 'sales') score += 10

  return Math.max(0, Math.min(90, score))
}

function computeExecutionScore(data) {
  let score = 50
  const es = data.executionStabilityRaw
  const pa = data.pastAttemptStageRaw

  if (es.level === 'very_low') score -= 25
  else if (es.level === 'stable') score += 20

  if (pa.level === 'bought_only') score -= 20
  else if (pa.level === 'under_30_days') score -= 10
  else if (pa.level === 'small_sales') score += 10
  else if (pa.level === 'stable_side') score += 25

  return Math.max(0, Math.min(90, score))
}

function computeTimeScore(data) {
  let score = 50
  const wt = data.weeklyTimeRaw

  if (wt.level === 'very_low') score -= 25
  else if (wt.level === 'low') score -= 5
  else if (wt.level === 'high') score += 25
  else if (wt.level === 'moderate') score += 15

  return Math.max(0, Math.min(90, score))
}

function computeRiskScore(data) {
  let score = 50
  const mtc = data.maxTrialCostRaw
  const fr = data.failureResponseRaw

  if (mtc.level === 'zero') score -= 15
  else if (mtc.level === 'high') score += 10

  if (fr.level === 'give_up') score -= 15
  else if (fr.level === 'add_money') score -= 20
  else if (fr.level === 'review_optimize') score += 15

  return Math.max(0, Math.min(90, score))
}

function deriveLabels(data, matchedRules) {
  const labels = []

  // 现金流标签
  if (data.monthlySurplusRaw?.level === 'negative') labels.push({ label: '现金流断裂', severity: 'fatal' })
  if (data.safetyMonthsRaw?.level === 'critical') labels.push({ label: '无安全垫', severity: 'fatal' })

  // 收入标签
  if (data.incomeStructureRaw?.level === 'salary') labels.push({ label: '工资依赖型', severity: 'info' })
  if (data.incomeStructureRaw?.level === 'unstable') labels.push({ label: '收入不稳定', severity: 'warning' })

  // 技能标签
  if (data.skillValidationRaw?.level === 'never' || data.skillValidationRaw?.level === 'unpaid') {
    labels.push({ label: '技能未验证', severity: 'warning' })
  }
  if (data.skillValidationRaw?.level === 'market_validated' || data.skillValidationRaw?.level === 'stable_clients') {
    labels.push({ label: '市场已验证', severity: 'advantage' })
  }
  if (data.monetizableSkillRaw?.level === 'technical') labels.push({ label: '技术型', severity: 'info' })
  if (data.monetizableSkillRaw?.level === 'sales') labels.push({ label: '销售型', severity: 'info' })

  // 执行标签
  if (data.executionStabilityRaw?.level === 'very_low') labels.push({ label: '执行弱', severity: 'warning' })
  if (data.executionStabilityRaw?.level === 'stable') labels.push({ label: '执行强', severity: 'advantage' })
  if (data.pastAttemptStageRaw?.level === 'bought_only') labels.push({ label: '学习替代行动', severity: 'fatal' })
  if (data.pastAttemptStageRaw?.level === 'stable_side') labels.push({ label: '已有副业收入', severity: 'advantage' })

  // 决策标签
  if (data.decisionStyleRaw?.level === 'all_in') labels.push({ label: '冲动决策型', severity: 'warning' })
  if (data.decisionStyleRaw?.level === 'avoid_all') labels.push({ label: '过度保守', severity: 'warning' })

  // 风险标签
  if (data.failureResponseRaw?.level === 'add_money') labels.push({ label: '沉没成本风险', severity: 'fatal' })

  return labels
}

function determineLevels(data, matchedRules) {
  const fatalCount = matchedRules.filter(r => r.level === 'fatal').length
  const advantageCount = matchedRules.filter(r => r.level === 'advantage').length

  // 风险等级
  let riskLevel
  if (fatalCount >= 4) riskLevel = 'extreme'
  else if (fatalCount >= 2) riskLevel = 'high'
  else if (fatalCount >= 1) riskLevel = 'moderate'
  else riskLevel = 'low'

  // 机会等级
  let opportunityLevel
  if (advantageCount >= 4) opportunityLevel = 'high'
  else if (advantageCount >= 2) opportunityLevel = 'moderate'
  else if (advantageCount >= 1) opportunityLevel = 'low'
  else opportunityLevel = 'very_low'

  // 翻身概率 (0-100)
  let wealthProbability = 50
  if (fatalCount >= 3) wealthProbability -= 20
  else if (fatalCount >= 1) wealthProbability -= 10
  if (advantageCount >= 3) wealthProbability += 20
  else if (advantageCount >= 1) wealthProbability += 10
  wealthProbability = Math.max(0, Math.min(90, wealthProbability))

  return { riskLevel, opportunityLevel, wealthProbability }
}

// ══════════════════════════════════════════════════════════════════
// 主入口
// ══════════════════════════════════════════════════════════════════

function analyze(rawAnswers) {
  const data = normalizeAnswers(rawAnswers)
  const { matched: matchedRules, fatal: fatalRules, advantage: advantageRules } = evaluateRules(data)
  const scores = computeScores(data, matchedRules)
  const labels = deriveLabels(data, matchedRules)
  const { riskLevel, opportunityLevel, wealthProbability } = determineLevels(data, matchedRules)

  return {
    normalizedProfile: data,
    matchedRules,
    fatalRules,
    advantageRules,
    scores,
    labels,
    riskLevel,
    opportunityLevel,
    wealthProbability,
    meta: {
      ruleCount: ALL_RULES.length,
      matchedCount: matchedRules.length,
      fatalCount: fatalRules.length,
      advantageCount: advantageRules.length,
      engineVersion: 'v4',
      generatedAt: new Date().toISOString(),
    },
  }
}

module.exports = { analyze, normalizeAnswers, evaluateRules, ALL_RULES }
