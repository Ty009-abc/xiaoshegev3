/**
 * utils/reportDestinySimulator.js — RC6.0 Destiny Simulator Engine
 *
 * 职责：基于 profile 和 reportContext 计算命运模拟器。
 * 生成基线路径（保持现状）和行动路径（执行方案）。
 * 禁止在页面层计算模拟结果。
 *
 * @version RC6.0_DESTINY_ENGINE
 */
'use strict'

/* ═══════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════ */

/**
 * computeDestinySimulator(profile, reportContext)
 *
 * @param {Object} profile — normalizedProfile (from engine)
 * @param {Object} reportContext — { scoreCard, fatalRules, advantageRules, ... }
 * @returns {Object} destinySimulator
 */
function computeDestinySimulator(profile, reportContext) {
  const context = buildStructuralContext(profile, reportContext)
  const currentIndex = computeCurrentIndex(context)
  const currentLevel = normalizeDestinyLevel(currentIndex)
  const repairCycleDays = computeRepairCycleDays(context)
  const baselinePath = buildBaselinePath(context)
  const actionPath = buildActionPath(currentIndex, context)
  const turningPoints = buildTurningPoints(context, repairCycleDays)
  const keyVariable = buildKeyVariable(context)

  return {
    currentIndex: currentIndex,
    currentLevel: currentLevel.key,
    currentLevelLabel: currentLevel.label,

    horizonDays: 365,
    repairCycleDays: repairCycleDays,

    baselinePath: baselinePath,
    actionPath: actionPath,

    strengths: buildStrengths(context),
    constraints: buildConstraints(context),

    turningPoints: turningPoints,
    keyVariable: keyVariable,
    confidence: 'rule_based',
  }
}

/* ═══════════════════════════════════════════════════════════════
   结构上下文推导
   ═══════════════════════════════════════════════════════════════ */

function buildStructuralContext(profile, reportContext) {
  var p = profile || {}
  var rc = reportContext || {}
  var sc = rc.scoreCard || {}
  var frs = rc.fatalRules || []
  var ars = rc.advantageRules || []

  var hasSkillValidation = p.skillValidationRaw
    ? (p.skillValidationRaw.level === 'market_validated' || p.skillValidationRaw.level === 'stable_clients')
    : _arrayHasKeywordTag(ars, '已验证', '付费', '市场验证', '客户')

  var hasPaidValidation = hasSkillValidation

  var hasStableAcquisition = p.clientAcquisitionRaw
    ? (p.clientAcquisitionRaw.level === 'stable' || p.clientAcquisitionRaw.level === 'growing')
    : _arrayHasKeywordTag(ars, '获客', '客户增长', '渠道')

  var hasProductizedOffer = p.productizationRaw
    ? (p.productizationRaw.level === 'done' || p.productizationRaw.level === 'partial')
    : _arrayHasKeywordTag(ars, '产品化', '标准化', '系统化', '可复制')

  var executionScore = toClampNum(sc.execution, 50)
  var overallScore = toClampNum(sc.overall, 50)
  var skillScore = toClampNum(sc.skill, 50)
  var cashflowScore = toClampNum(sc.cashflow, 50)
  var timeScore = toClampNum(sc.time, 50)
  var riskScore = toClampNum(sc.risk, 50)

  var availableHoursPerWeek = p.weeklyTimeRaw
    ? timeToHours(p.weeklyTimeRaw.level)
    : (timeScore >= 60 ? 15 : timeScore >= 35 ? 8 : 3)

  var incomeStructure = (p.incomeStructureRaw && p.incomeStructureRaw.level) || 'single'

  var cashflowHealth = 'moderate'
  if (cashflowScore >= 70) cashflowHealth = 'healthy'
  else if (cashflowScore <= 30) cashflowHealth = 'critical'

  var skillType = p.skillType || 'technical'

  var hasFatalSingleIncome = frs.some(function(r) {
    return (r.id || r.name || '').indexOf('SINGLE_INCOME') !== -1 ||
      (r.title || '').indexOf('单一收入') !== -1
  })

  var hasFatalSafetyNet = frs.some(function(r) {
    return (r.id || r.name || '').indexOf('SAFETY') !== -1 ||
      (r.title || '').indexOf('安全垫') !== -1
  })

  var fatalCount = frs.length

  return {
    hasSkillValidation: hasSkillValidation,
    hasPaidValidation: hasPaidValidation,
    hasStableAcquisition: hasStableAcquisition,
    hasProductizedOffer: hasProductizedOffer,
    executionScore: executionScore,
    overallScore: overallScore,
    skillScore: skillScore,
    cashflowScore: cashflowScore,
    timeScore: timeScore,
    riskScore: riskScore,
    availableHoursPerWeek: availableHoursPerWeek,
    incomeStructure: incomeStructure,
    cashflowHealth: cashflowHealth,
    skillType: skillType,
    hasFatalSingleIncome: hasFatalSingleIncome,
    hasFatalSafetyNet: hasFatalSafetyNet,
    fatalCount: fatalCount,
  }
}

/**
 * 当前翻身指数 — 从 overall score 衍生
 */
function computeCurrentIndex(context) {
  return clamp(context.overallScore || 50, 0, 100)
}

/**
 * 确定性等级映射
 */
function normalizeDestinyLevel(score) {
  if (score >= 85) return { key: 'very_high', label: '很高' }
  if (score >= 70) return { key: 'high', label: '较高' }
  if (score >= 50) return { key: 'medium', label: '中等' }
  if (score >= 30) return { key: 'low', label: '较低' }
  return { key: 'very_low', label: '很低' }
}

/**
 * 等级标签
 */
function normalizeRiskLabel(level) {
  var map = { high: '较高', medium: '中等', low: '较低', very_low: '很低', critical: '严重' }
  return map[level] || '未知'
}

/* ═══════════════════════════════════════════════════════════════
   基线路径（保持现状）
   ═══════════════════════════════════════════════════════════════ */

function buildBaselinePath(context) {
  var systemProgress = 35
  var riskLevel = 'medium'

  if (!context.hasStableAcquisition) {
    systemProgress -= 8
  }
  if (!context.hasProductizedOffer) {
    systemProgress -= 6
  }
  if (context.executionScore < 50) {
    systemProgress -= 5
  }
  if (context.incomeStructure === 'single') {
    riskLevel = 'high'
  }
  if (context.fatalCount >= 3) {
    riskLevel = 'critical'
  }

  return {
    title: '继续保持现状',
    summary: buildBaselineSummary(context),
    systemProgress: clamp(systemProgress, 5, 45),
    riskLevel: riskLevel,
    riskLabel: normalizeRiskLabel(riskLevel),
    outcome: buildBaselineOutcome(context),
  }
}

function buildBaselineSummary(context) {
  var parts = []
  if (context.incomeStructure === 'single') {
    parts.push('收入依赖单一来源，空窗期资金链易断裂')
  }
  if (!context.hasStableAcquisition) {
    parts.push('没有持续获客系统，每次都需要重新找客户')
  }
  if (!context.hasProductizedOffer) {
    parts.push('交付方式依赖个人时间，无法规模化')
  }
  if (context.executionScore < 50) {
    parts.push('执行持续性不足，容易在关键节点断开')
  }
  if (parts.length === 0) {
    parts.push('保持现状的惯性正在压制制度性突破')
  }
  return parts.slice(0, 2).join('。') + '。'
}

function buildBaselineOutcome(context) {
  if (context.incomeStructure === 'single' && !context.hasStableAcquisition) {
    return '一年后大概率仍在用时间换钱，收入天花板不变但压力逐月增加。'
  }
  if (!context.hasProductizedOffer && context.executionScore < 50) {
    return '继续交付体力型服务，边际成本恒定，成长曲线趋于水平。'
  }
  if (context.incomeStructure === 'single') {
    return '只要唯一的收入源头出现问题，整个财务系统就会立刻承压。'
  }
  return '有机会维持现状，但系统成长速度会持续落后于市场变化。'
}

/* ═══════════════════════════════════════════════════════════════
   行动路径（执行方案）
   ═══════════════════════════════════════════════════════════════ */

function buildActionPath(currentIndex, context) {
  var projectedIndex = computeProjectedIndex(currentIndex, context)

  return {
    title: '执行翻身方案',
    summary: buildActionPathSummary(context),
    systemProgress: projectedIndex,
    riskLevel: 'medium',
    riskLabel: '中等',
    projectedIndex: projectedIndex,
    outcome: buildActionPathOutcome(context, projectedIndex),
  }
}

function computeProjectedIndex(currentIndex, context) {
  var gain = 0

  if (!context.hasStableAcquisition) {
    gain += 8
  }
  if (!context.hasProductizedOffer) {
    gain += 6
  }
  if (context.executionScore < 60) {
    gain += 5
  }
  if (context.hasSkillValidation) {
    gain += 4
  }
  if (context.availableHoursPerWeek < 6) {
    gain -= 3
  }
  // skill type modifier
  if (context.skillType === 'technical' && context.skillScore >= 60) {
    gain += 2
  }
  // cashflow health penalized if critical
  if (context.cashflowHealth === 'critical') {
    gain -= 4
  }

  return clamp(currentIndex + gain, currentIndex, 92)
}

function buildActionPathSummary(context) {
  var items = []
  if (!context.hasStableAcquisition) {
    items.push('建立持续获客渠道，摆脱每次重新寻找客户')
  }
  if (!context.hasProductizedOffer) {
    items.push('将个人交付转化为可复制的产品')
  }
  if (context.executionScore < 60) {
    items.push('通过微量行动链提高执行持续性')
  }
  if (context.hasSkillValidation) {
    items.push('充分利用已验证的技能优势')
  }
  if (items.length === 0) {
    items.push('在当前基础上建立获客和产品体系')
  }
  return items.slice(0, 2).join('。') + '。'
}

function buildActionPathOutcome(context, projectedIndex) {
  var improvement = projectedIndex - (context.overallScore || 50)
  var timePrefix = ''
  if (context.availableHoursPerWeek >= 15) {
    timePrefix = '利用充裕时间'
  } else if (context.availableHoursPerWeek <= 4) {
    timePrefix = '即使时间有限，'
  } else {
    timePrefix = '投入持续执行力，'
  }
  if (improvement >= 20) {
    return timePrefix + '通过结构优化，潜力显著提升。翻身指数可达' + projectedIndex + '分水平。'
  }
  if (improvement >= 10) {
    return timePrefix + '扎实补齐获客和产品缺口后，上升空间明确可见。'
  }
  return timePrefix + '稳步提升现有基础，潜力温和上行但不成井喷。'
}

/* ═══════════════════════════════════════════════════════════════
   预计修复周期
   ═══════════════════════════════════════════════════════════════ */

function computeRepairCycleDays(context) {
  var days = 90

  if (!context.hasSkillValidation) {
    days += 60
  }
  if (!context.hasStableAcquisition) {
    days += 30
  }
  if (!context.hasProductizedOffer) {
    days += 15
  }
  if (context.executionScore >= 75) {
    days -= 20
  }
  if (context.availableHoursPerWeek >= 15) {
    days -= 15
  }

  return clamp(roundToStep(days, 15), 30, 180)
}

/* ═══════════════════════════════════════════════════════════════
   关键转折点
   ═══════════════════════════════════════════════════════════════ */

function buildTurningPoints(context, repairCycleDays) {
  // 确定画像类型
  if (context.hasSkillValidation && !context.hasStableAcquisition) {
    // 类型A：有技能验证，无获客系统
    return [
      { day: 7, label: '复盘首个付费客户来源' },
      { day: 30, label: '固定一个主攻平台' },
      { day: repairCycleDays, label: '验证一条可复制获客路径' },
    ]
  }

  if (!context.hasSkillValidation) {
    // 类型B：无技能验证
    return [
      { day: 7, label: '确认一项可出售技能' },
      { day: 30, label: '完成第一次真实报价' },
      { day: repairCycleDays, label: '获得第一次市场反馈' },
    ]
  }

  if (context.hasStableAcquisition && context.hasProductizedOffer) {
    // 类型C 变体：已有稳定客户，但交付过重
    return [
      { day: 7, label: '拆分现有交付流程' },
      { day: 30, label: '完成标准化产品雏形' },
      { day: repairCycleDays, label: '降低个人时间依赖' },
    ]
  }

  // 默认（类型C变体）
  return [
    { day: 7, label: '拆分现有交付流程' },
    { day: 30, label: '完成标准化产品雏形' },
    { day: repairCycleDays, label: '建立可复制的交付系统' },
  ]
}

/* ═══════════════════════════════════════════════════════════════
   关键变量
   ═══════════════════════════════════════════════════════════════ */

function buildKeyVariable(context) {
  var priorities = []

  if (!context.hasSkillValidation) {
    priorities.push('完成第一次市场验证')
  }
  if (!context.hasStableAcquisition && context.hasSkillValidation) {
    priorities.push('建立持续获客系统')
  }
  if (!context.hasProductizedOffer && context.hasSkillValidation) {
    priorities.push('把个人交付产品化')
  }
  if (context.executionScore < 50) {
    priorities.push('提高执行持续性')
  }
  if (context.fatalCount >= 3) {
    priorities.push('先修复收入安全垫')
  }
  if (priorities.length === 0) {
    priorities.push('固定一个主攻方向')
  }

  return priorities[0]
}

/* ═══════════════════════════════════════════════════════════════
   优势/约束
   ═══════════════════════════════════════════════════════════════ */

function buildStrengths(context) {
  var s = []
  if (context.hasSkillValidation) s.push('技能已获市场验证')
  if (context.hasPaidValidation) s.push('有付费客户基础')
  if (context.skillScore >= 60) s.push('技能得分' + context.skillScore + '分，基础扎实')
  if (context.executionScore >= 60) s.push('执行力持续稳定')
  if (context.availableHoursPerWeek >= 15) s.push('可投入时间充裕')
  if (context.cashflowHealth === 'healthy') s.push('现金流健康')
  if (s.length === 0) s.push('个人能力基础')
  return s.slice(0, 3)
}

function buildConstraints(context) {
  var c = []
  if (!context.hasSkillValidation) c.push('技能尚未在市场中验证')
  if (!context.hasStableAcquisition) c.push('缺乏持续获客能力')
  if (!context.hasProductizedOffer) c.push('交付过于依赖个人时间')
  if (context.executionScore < 50) c.push('执行持续性差')
  if (context.incomeStructure === 'single') c.push('收入来源单一')
  if (context.cashflowHealth === 'critical') c.push('现金流压力较大')
  if (context.riskScore <= 30) c.push('风险抵抗力较弱')
  if (c.length === 0) c.push('数据不足，待深入诊断')
  return c.slice(0, 3)
}

/* ═══════════════════════════════════════════════════════════════
   Utility
   ═══════════════════════════════════════════════════════════════ */

function clamp(v, min, max) {
  var n = Number(v)
  if (isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

function roundToStep(v, step) {
  return Math.round(Number(v || 0) / step) * step
}

function toClampNum(v, fallback) {
  var n = Number(v)
  if (isNaN(n)) return fallback || 0
  return n
}

function timeToHours(level) {
  if (!level) return 5
  var lower = String(level).toLowerCase()
  if (lower.indexOf('high') !== -1 || lower.indexOf('充足') !== -1) return 20
  if (lower.indexOf('moderate') !== -1 || lower.indexOf('中等') !== -1) return 10
  if (lower.indexOf('limited') !== -1 || lower.indexOf('有限') !== -1) return 4
  if (lower.indexOf('busy') !== -1) return 2
  return 5
}

function _arrayHasKeywordTag(arr) {
  for (var i = 1; i < arguments.length; i++) {
    var kw = arguments[i]
    for (var j = 0; j < (arr || []).length; j++) {
      var txt = ((arr[j] || {}).title || '') + ((arr[j] || {}).name || '') + ((arr[j] || {}).output || {}).title || ''
      if (txt.indexOf(kw) !== -1) return true
    }
  }
  return false
}

/* ═══════════════════════════════════════════════════════════════
   Export
   ═══════════════════════════════════════════════════════════════ */

module.exports = {
  computeDestinySimulator,
  buildStructuralContext,
  computeCurrentIndex,
  normalizeDestinyLevel,
  buildBaselinePath,
  buildBaselineSummary,
  buildBaselineOutcome,
  buildActionPath,
  computeProjectedIndex,
  buildActionPathSummary,
  buildActionPathOutcome,
  computeRepairCycleDays,
  buildTurningPoints,
  buildKeyVariable,
  buildStrengths,
  buildConstraints,
  normalizeRiskLabel,
}
