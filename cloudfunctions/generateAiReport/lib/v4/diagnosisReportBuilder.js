/**
 * lib/v4/diagnosisReportBuilder.js
 *
 * RC8.2: Deterministic Report Builder — constructs a complete V4 report
 * from the RC8 diagnosis object.
 *
 * v2.1: Content quality — duplicate suffix fix, occupation-aware templates,
 * diagnosis-strategy contract, empty opportunity filter, quality validation gate.
 */

const { normalizePotentialIndex } = require('../config/reportUtils')

// ═══════════════════════════════════════════════════════════════
// Archetype title normalization — prevents duplicate suffix
// ═══════════════════════════════════════════════════════════════

var ARCHETYPE_TITLE_SUFFIXES = ['型', '者', '人', '师', '家']

function normalizeArchetypeTitle(title) {
  if (!title) return '待识别'
  for (var i = 0; i < ARCHETYPE_TITLE_SUFFIXES.length; i++) {
    if (title.endsWith(ARCHETYPE_TITLE_SUFFIXES[i])) return title
  }
  return title + '型'
}

// ═══════════════════════════════════════════════════════════════
// Occupation-aware content mapping — prevents tech/office templates
// for non-technical occupations
// ═══════════════════════════════════════════════════════════════

var TECHNICAL_OCCUPATIONS = {
  PROGRAMMER: true, DEVELOPER: true, ENGINEER: true, DATA_SCIENTIST: true,
  DEV_OPS: true, DESIGNER_DIGITAL: true, IT_SUPPORT: true,
}

function isTechnicalOccupation(answers) {
  if (!answers) return false
  return !!(TECHNICAL_OCCUPATIONS[answers.occupationCategory] || answers.occupationDetail === '程序员' || answers.occupationDetail === '工程师')
}

function filterContentForOccupation(text, answers) {
  if (!text || !answers) return text
  // Remove tech-specific terms for non-technical users
  if (!isTechnicalOccupation(answers)) {
    text = text.replace(/代码杠杆/g, '经验杠杆')
    text = text.replace(/SaaS|自动化编程|技术咨询/g, '服务产品化')
  }
  return text
}

// ═══════════════════════════════════════════════════════════════
// Empty content detection
// ═══════════════════════════════════════════════════════════════

function isMeaningfulOpportunity(item) {
  if (!item) return false
  var reasonCheck = (item.reason || '').replace(/[备选路径：方向：——、.\s]/g, '')
  if (reasonCheck.length < 4) return false
  // Only check description if present
  if (item.description !== undefined && item.description !== null) {
    var descCheck = (item.description || '').replace(/[备选方向：：\s]/g, '')
    if (descCheck.length < 4) return false
  }
  return true
}

function filterEmptyOpportunityRules(rules) {
  if (!Array.isArray(rules)) return []
  return rules.filter(isMeaningfulOpportunity)
}

// ═══════════════════════════════════════════════════════════════
// SAFE_MINIMAL templates — occupation-aware
// ═══════════════════════════════════════════════════════════════

var SAFE_TEMPLATES = {
  TRAFFIC: {
    headlineTitle: '获客信号缺失——技能有但市场看不到',
    fatalMainProblem: '技能已验证且能小额成交，但缺乏持续获客渠道',
    fatalReason: '当前少量成交说明产品有市场需求；客户来源偶发，无法持续复制',
    strategyTagline: '建立持续获客能力',
    day1Mission: '整理一个固定服务套餐，写清价格和交付内容，并向3名潜在客户发出报价',
    milestones: ['整理核心服务产品清单', '制定标准报价和交付流程', '每天主动触达潜在客户'],
    finalStrike: '把已验证的技能转化为可复制的产品，建立持续获客渠道',
    stopDoingItems: [
      { action: '暂停零散接单模式', reason: '偶发成交无法验证获客效率' },
      { action: '暂停学习新技能方向', reason: '当前技能已验证，需要的是获客而非扩展技能' },
    ],
  },

  SELLING: {
    headlineTitle: '成交信号缺失——有流量但转化不足',
    fatalMainProblem: '有内容输出和流量基础，但流量到支付的转化路径不完整',
    fatalReason: '当前内容输出信号较强，但缺少明确的成交环节',
    strategyTagline: '建立完整的成交闭环',
    day1Mission: '设计一个低价入门产品，并在内容中嵌入明确的购买引导',
    milestones: ['定义成交路径（看到→了解→购买）', '制作第一个付费产品的销售页', '完成首次闭环成交'],
    finalStrike: '打通从内容触达到付费成交的完整路径',
    stopDoingItems: [
      { action: '暂停纯内容输出（无成交引导）', reason: '内容需要嵌入购买路径才有效' },
      { action: '暂停免费咨询模式', reason: '需要建立付费筛选机制' },
    ],
  },

  SYSTEM: {
    headlineTitle: '体系信号缺失——单点突破后未能复制',
    fatalMainProblem: '已有单一收入源验证，但未建立可复制交付体系',
    fatalReason: '当前已验证单项产品，但缺少系统化复制能力',
    strategyTagline: '建立可复制交付体系',
    day1Mission: '用文字记录一次完整交付流程，识别可标准化环节',
    milestones: ['记录并标准化交付流程', '建立交付检查清单', '培训或外包重复环节'],
    finalStrike: '将已验证的单点能力复制为系统化交付',
    stopDoingItems: [
      { action: '暂停亲力亲为所有交付', reason: '个人时间有限，需通过流程复制能力' },
      { action: '暂停接受无法标准化交付的订单', reason: '定制化越高，复制成本越高' },
    ],
  },

  SINGLE_INCOME: {
    headlineTitle: '收入结构单一——现金流过度集中',
    fatalMainProblem: '当前收入来源集中度过高，单一变化即可能影响整体财务安全',
    fatalReason: '当前现金流信号稳定，但集中在单一渠道',
    strategyTagline: '在主业基础上建立低风险副引擎',
    day1Mission: '列出3项可在业余时间验证的技术或资源，选择门槛最低的一项开始测试',
    milestones: ['盘点可货币化的技能和资源', '选择最底门槛方向投入测试', '完成首次副引擎收入'],
    finalStrike: '在不影响主业的前提下，逐步建立第二条收入线',
    stopDoingItems: [
      { action: '暂停将全部时间投入单一收入源', reason: '需要为副引擎留出测试窗口' },
      { action: '暂停高成本或长周期的副业方向', reason: '优先选择底门槛方向快速验证' },
    ],
  },
}

// ═══════════════════════════════════════════════════════════════
// Diagnosis–Strategy Contract
// ═══════════════════════════════════════════════════════════════

var BOTTLENECK_STRATEGY_CONTRACT = {
  BUILD_PRODUCT: ['TRAFFIC', 'SELLING', 'SYSTEM', 'PRODUCT', 'POSITIONING'],
  BUILD_ACQ_SYSTEM: ['TRAFFIC', 'SELLING', 'PRODUCT'],
  DIRECT_SELL: ['SELLING', 'TRAFFIC', 'SINGLE_INCOME'],
  SKILL_UPGRADE: ['SKILL_GAP', 'LEVERAGE', 'SINGLE_INCOME'],
  MULTI_INCOME: ['SINGLE_INCOME', 'CAPACITY', 'LEVERAGE'],
  CAPITAL_ACCUMULATION: ['CAPITAL', 'SYSTEM', 'LEVERAGE'],
  TEAM_BUILD: ['SYSTEM', 'CAPACITY', 'SELLING'],
}

var ARCHETYPE_OVERRIDE_RULES = {
  // If user has confirmed monetizable skill + small sales + execution + time
  // EMPLOYEE should NOT be the primary unless explicitly highest-scoring by ≥0.1 margin
  OPERATOR_BIAS: {
    triggerTags: ['CONFIRMED_SMALL', 'MONETIZABLE_SKILL', 'EXECUTION_STABLE', 'WEEKLY_TIME_HIGH'],
    biasedArchetypes: ['OPERATOR', 'CREATOR', 'BUILDER', 'SELLER'],
    suppressedArchetypes: ['EMPLOYEE', 'COLLECTOR'],
  },
}

/**
 * Validate diagnosis-strategy contract.
 * Returns { valid: boolean, code, reason }
 */
function validateDiagnosisContract(diagnosis) {
  if (!diagnosis) return { valid: false, code: 'DIAGNOSIS_NULL', reason: 'No diagnosis provided' }

  var bottleneckId = (diagnosis.bottleneck || {}).id || null
  var strategyId = (diagnosis.strategy || {}).id || null
  var archetypeId = (diagnosis.wealthProfile || {}).primary || null
  var tagIds = (diagnosis.behaviorTags || []).map(function(t) { return t.id || t.name || '' })

  if (!bottleneckId || !strategyId) {
    return { valid: false, code: 'DIAGNOSIS_INCOMPLETE', reason: 'bottleneck=' + bottleneckId + ' strategy=' + strategyId }
  }

  // Check bottleneck-strategy contract
  var allowedBottlenecks = BOTTLENECK_STRATEGY_CONTRACT[strategyId]
  if (allowedBottlenecks && allowedBottlenecks.indexOf(bottleneckId) === -1) {
    // LEVERAGE + BUILD_PRODUCT mismatch
    return {
      valid: false,
      code: 'DIAGNOSIS_STRATEGY_MISMATCH',
      reason: 'Strategy ' + strategyId + ' requires bottleneck in [' + allowedBottlenecks.join(',') + '] but got ' + bottleneckId,
    }
  }

  // Check OPERATOR bias — if user shows operator signals, don't default to EMPLOYEE
  if (archetypeId === 'EMPLOYEE') {
    // Only flag if archetype signal is weak AND operator signals are strong
    var hasOperatorSignals = true
    var rules = ARCHETYPE_OVERRIDE_RULES.OPERATOR_BIAS
    for (var i = 0; i < rules.triggerTags.length; i++) {
      var found = false
      for (var j = 0; j < tagIds.length; j++) {
        if (tagIds[j].toUpperCase().indexOf(rules.triggerTags[i].toUpperCase()) >= 0) { found = true; break }
      }
      if (!found) { hasOperatorSignals = false; break }
    }
    if (hasOperatorSignals) {
      return {
        valid: false,
        code: 'DIAGNOSIS_ARCHETYPE_MISMATCH',
        reason: 'EMPLOYEE archetype with confirmed operator signals — score evidence required',
      }
    }
  }

  return { valid: true, code: null, reason: null }
}

// ═══════════════════════════════════════════════════════════════
// Build safe_minimal from diagnosis
// ═══════════════════════════════════════════════════════════════

function buildSafeMinimalFromDiagnosis(diagnosis) {
  if (!diagnosis) {
    return buildMinimalEmptyReport()
  }

  var bottleneckId = (diagnosis.bottleneck || {}).id || 'UNKNOWN'
  var archetype = diagnosis.wealthProfile || {}
  var strategy = diagnosis.strategy || {}
  var template = SAFE_TEMPLATES[bottleneckId] || buildGenericSafeTemplate(diagnosis)
  var primaryTitle = normalizeArchetypeTitle(archetype.primaryTitle || archetype.primary || '待识别')
  var strategyLabel = strategy.strategyLabel || strategy.id || '聚焦行动'
  var overall = Math.min(90, Math.max(10, Math.round(
    ((diagnosis.bottleneck.confidence || 0.5) * 30 + (diagnosis.strategy.confidence || 0.5) * 30 + 30)
  )))

  var scores = buildComputedScores(overall)
  var milestones = template.milestones || ['明确第一步行动', '完成首次尝试', '复盘并调整']
  var actionPlan = {}
  var dayKeys = ['day1', 'day3', 'day7', 'day15', 'day30']
  dayKeys.forEach(function(day, idx) {
    var ml = milestones[idx]
    actionPlan[day] = idx === 0 ? {
      goal: template.day1Mission || '明确第一步具体行动',
      tasks: [template.day1Mission || '确定首个可执行行动'],
      checkpoint: '完成第一步并记录结果',
    } : ml ? {
      goal: ml,
      tasks: [ml],
      checkpoint: '完成后复盘',
    } : {
      goal: '持续推进',
      tasks: ['执行并复盘'],
      checkpoint: '完成本轮周期',
    }
  })

  var stopDoingItems = template.stopDoingItems || []
  var stopDoing = {
    priority: stopDoingItems.length > 1 ? 'HIGH' : 'MEDIUM',
    items: stopDoingItems.map(function(item) { return item.action + '（' + item.reason + '）' }),
  }

  var report = {
    _fallbackSource: 'SAFE_MINIMAL_DIAGNOSIS',
    _renderSource: 'safe_minimal_diagnosis',
    _bottleneckId: bottleneckId,
    _strategyId: (diagnosis.strategy || {}).id || null,
    _archetypeId: primaryTitle,
    _version: 'v2.1',

    headline: {
      title: template.headlineTitle,
      subtitle: primaryTitle + ' · ' + strategyLabel + '方向',
    },

    wealthStage: 'STABLE',

    fatalDiagnosis: {
      mainProblem: template.fatalMainProblem,
      reason: template.fatalReason,
      severity: 'high',
      confidence: (diagnosis.bottleneck || {}).confidence || 0.7,
      matchedRuleIds: [],
    },

    fatalRules: [],
    advantageRules: [
      { ruleId: 'DIAG_ADV_' + primaryTitle, title: primaryTitle + '信号验证', description: '当前诊断显示' + primaryTitle + '优势信号，可作为突破基础', weight: 100, role: 'SAFE_MINIMAL', score: Math.round((archetype.confidence || 0.6) * 100) },
    ],
    opportunityRules: [],

    scoreCard: scores.scoreCard,
    wealthProbability: scores.wealthProbability,
    potentialIndex: scores.potentialIndex,

    wealthPath: [
      { name: strategyLabel + '路径', recommend: 'recommended', score: Math.round((strategy.confidence || 0.6) * 100), reason: '基于诊断瓶颈和战略推荐' },
    ],

    actionPlan: actionPlan,
    stopDoing: stopDoing,
    identityUpgrade: {
      current: primaryTitle + '——当前已验证信号',
      target: '突破' + (template.headlineTitle.split('——')[0] || '核心瓶颈'),
      bridge: milestones.slice(0, 3).join(' → ') || '建立第一个里程碑',
    },

    finalStrike: template.finalStrike,
    version: 'RC8.2',
    engineVersion: diagnosis.engineVersion || 'RC8.2',
    diagnosticVersion: 'v4',
    generatedAt: new Date().toISOString(),
  }

  return {
    reportId: 'diag_safe_' + Date.now(),
    report: report,
    engineVersion: 'RC8.2',
    _fallbackSource: 'SAFE_MINIMAL_DIAGNOSIS',
  }
}

function buildGenericSafeTemplate(diagnosis) {
  var bottleneckLabel = (diagnosis.bottleneck || {}).label || '核心瓶颈'
  return {
    headlineTitle: bottleneckLabel + '——当前最需要突破的信号缺口',
    fatalMainProblem: '当前诊断数据显示在' + bottleneckLabel + '方向存在最显著信号缺口',
    fatalReason: '基于问卷数据的客观分析，' + bottleneckLabel + '方向是当前最需要聚焦的突破点',
    strategyTagline: '聚焦' + bottleneckLabel + '突破',
    day1Mission: '明确在' + bottleneckLabel + '方向的第一步具体行动',
    milestones: ['明确第一步行动', '完成首次尝试', '复盘并调整'],
    finalStrike: '聚焦' + bottleneckLabel + '方向，在可见时间内完成突破',
    stopDoingItems: [
      { action: '暂停与核心瓶颈无关的方向探索', reason: '注意力分散会延缓核心突破' },
    ],
  }
}

function buildComputedScores(overall) {
  var base = Math.round(overall * 0.7)
  return {
    scoreCard: {
      cashflow: Math.min(90, base + 5),
      skill: Math.min(90, base + 15),
      execution: Math.min(90, base + 10),
      time: Math.min(90, base + 10),
      risk: Math.min(90, Math.round(base * 0.8)),
      overall: overall,
    },
    wealthProbability: normalizePotentialIndex({ today: overall - 10, after30: overall, after90: overall + 10, after365: overall + 20 }),
    potentialIndex: normalizePotentialIndex({ today: overall - 10, after30: overall, after90: overall + 10, after365: overall + 20 }),
  }
}

function buildMinimalEmptyReport() {
  return {
    reportId: 'diag_empty_' + Date.now(),
    report: {
      _fallbackSource: 'SAFE_MINIMAL_EMPTY',
      _renderSource: 'safe_minimal_empty',
      headline: { title: '诊断信号不足', subtitle: '请重新完成诊断问卷' },
      wealthStage: 'STABLE',
      fatalDiagnosis: {
        mainProblem: '当前问卷数据未能触发有效诊断',
        reason: '建议完成至少15题以获得准确的诊断结果',
        severity: 'warning', confidence: 0.1, matchedRuleIds: [],
      },
      fatalRules: [], advantageRules: [{ ruleId: 'DIAG_DEFAULT', title: '重新诊断', description: '请至少完成15题以获得诊断结果', weight: 100, role: 'SAFE_MINIMAL' }],
      opportunityRules: [],
      scoreCard: { cashflow: 50, skill: 50, execution: 50, time: 50, risk: 50, overall: 50 },
      wealthProbability: { today: 50, after30: 55, after90: 60, after365: 70 },
      potentialIndex: { today: 50, after30: 55, after90: 60, after365: 70 },
      wealthPath: [{ name: '重新诊断', recommend: 'recommended', score: 100, reason: '当前数据不足，请重新完成诊断' }],
      actionPlan: { day1: { goal: '重新完成诊断问卷', tasks: ['完成至少15题'], checkpoint: '提交诊断' } },
      stopDoing: { priority: 'LOW', items: [] },
      identityUpgrade: { current: '待诊断', target: '重新诊断', bridge: '完成问卷 → 获得个性化报告' },
      finalStrike: '完成诊断问卷以获取你的专属突破路线图',
      version: 'RC8.2', engineVersion: 'RC8.2', generatedAt: new Date().toISOString(),
    },
    engineVersion: 'RC8.2',
  }
}

// ═══════════════════════════════════════════════════════════════
// buildReportFromDiagnosis — full deterministic report
// ═══════════════════════════════════════════════════════════════

function buildHeadlineAndFatalDiagnosis(diagnosis) {
  var bottleneck = diagnosis.bottleneck || {}
  var archetype = diagnosis.wealthProfile || {}
  var behaviorTags = diagnosis.behaviorTags || []
  var tagCategoryCounts = {}
  behaviorTags.forEach(function(t) {
    var cat = t.category || 'OTHER'
    tagCategoryCounts[cat] = (tagCategoryCounts[cat] || 0) + 1
  })

  var tagEvidence = Object.keys(tagCategoryCounts)
    .filter(function(c) { return tagCategoryCounts[c] >= 2 })
    .map(function(c) { return c + '信号(' + tagCategoryCounts[c] + '个)' })
    .join('、')

  var bottleneckId = bottleneck.id || 'UNKNOWN'
  var bottleneckLabel = bottleneck.label || '待评估'
  var bottleneckDesc = bottleneck.description || bottleneckLabel + '：当前最显著突破方向'
  var archetypeTitle = normalizeArchetypeTitle(archetype.primaryTitle || archetype.primary || '待识别')

  var headlineTitle = bottleneckId === 'TRAFFIC' ? '获客信号缺失——技能有但市场看不到'
    : bottleneckId === 'SELLING' ? '成交信号缺失——有流量但转化不足'
    : bottleneckId === 'SYSTEM' ? '体系信号缺失——单点突破后未能复制'
    : bottleneckId === 'SINGLE_INCOME' ? '收入结构单一——现金流过度集中'
    : bottleneckLabel + '：核心瓶颈'

  return {
    headline: {
      title: headlineTitle,
      subtitle: archetypeTitle + ' · ' + (tagEvidence || '基于当前诊断数据'),
    },
    fatalDiagnosis: {
      mainProblem: bottleneckDesc,
      reason: bottleneck.solution || bottleneck.reason || bottleneckDesc,
      severity: ['fatal', 'critical', 'warning'][Math.min(2, Math.floor((1 - (bottleneck.confidence || 0.5)) * 3))] || 'fatal',
      confidence: bottleneck.confidence || 0.5,
      matchedRuleIds: (diagnosis._raw && diagnosis._raw.bottleneck && diagnosis._raw.bottleneck.evidenceIds)
        ? diagnosis._raw.bottleneck.evidenceIds : [],
    },
  }
}

function buildAdvantageAndIdentity(diagnosis) {
  var archetype = diagnosis.wealthProfile || {}
  var primaryTitle = normalizeArchetypeTitle(archetype.primaryTitle || archetype.primary || '待识别')
  var traits = archetype.primaryTraits || []
  var confidence = archetype.confidence || 0.5
  var tagline = archetype.primaryTagline || ''
  return {
    advantageRules: [{
      ruleId: 'DIAG_ADV_IDENTITY',
      title: primaryTitle + '优势信号',
      description: tagline || ('具备' + (traits[0] || '已验证技能') + '的执行基础'),
      why: traits.length > 1 ? traits.slice(0, 3).join('、') + '——可作为突破基础' : '当前角色下的核心优势信号',
      weight: Math.round(confidence * 100), score: Math.round(confidence * 100),
    }],
    identityUpgrade: {
      current: primaryTitle + '——' + (tagline || '当前已验证信号'),
      target: '突破' + ((diagnosis.bottleneck || {}).label || '核心瓶颈'),
      bridge: ((diagnosis.strategy || {}).milestones || []).slice(0, 3).join(' → ') || '建立第一个里程碑',
    },
  }
}

function buildActionPlanAndFinalStrike(diagnosis) {
  var strategy = diagnosis.strategy || {}
  var milestones = strategy.milestones || []
  var day1Mission = strategy.day1Mission || '识别当前最需突破的方向'
  var tagline = strategy.strategyTagline || strategy.strategyLabel || '聚焦行动'
  var duration = strategy.duration || '90天'

  var dayMap = ['day1', 'day3', 'day7', 'day15', 'day30']
  var actionPlan = {}
  dayMap.forEach(function(day, index) {
    var milestone = milestones[index]
    if (index === 0) {
      actionPlan[day] = {
        goal: day1Mission,
        tasks: [day1Mission],
        checkpoint: '启动并完成第一步行动',
      }
    } else if (milestone) {
      actionPlan[day] = {
        goal: milestone,
        tasks: [milestone],
        checkpoint: '完成：' + milestone,
      }
    } else {
      actionPlan[day] = {
        goal: '持续推进' + tagline,
        tasks: ['执行并复盘'],
        checkpoint: '推进一个里程碑',
      }
    }
  })

  return {
    actionPlan: actionPlan,
    finalStrike: strategy.tagline || tagline || '聚焦核心瓶颈，在' + duration + '内完成突破',
    stopDoing: {
      priority: 'MEDIUM',
      items: ['暂停与核心瓶颈无关的多方向探索', '暂停零散不产生验证信号的行动'],
    },
  }
}

function buildScoreCard(diagnosis) {
  var overall = Math.min(90, Math.max(10, Math.round(
    ((diagnosis.bottleneck.confidence || 0.5) * 30 + (diagnosis.strategy.confidence || 0.5) * 30 + 30)
  )))
  return buildComputedScores(overall)
}

function buildWealthPath(diagnosis) {
  var strategy = diagnosis.strategy || {}
  var strategyLabel = strategy.strategyLabel || strategy.id || '推荐的路径'
  var confidence = Math.round((strategy.confidence || 0.6) * 100)
  return {
    wealthPath: [
      { name: strategyLabel + '路径', recommend: 'recommended', score: confidence, reason: '基于诊断的战略层推荐' },
    ],
  }
}

function buildOpportunityRules(diagnosis) {
  // Diagnosis fallback should NOT output multi-direction opportunity rules
  // Single-strategy execution steps are preferred
  var strategy = diagnosis.strategy || {}
  var milestones = strategy.milestones || []
  if (milestones.length < 1) return { opportunityRules: [] }

  var executionSteps = milestones.slice(0, 3).map(function(ml, i) {
    return {
      id: 'EXEC_' + (i + 1),
      area: '执行步骤',
      title: ml,
      description: '战略执行步骤' + (i + 1) + '：' + ml,
      recommendation: 'recommended',
      weight: 50 + (3 - i) * 10,
      role: 'EXECUTION_STEP',
    }
  })

  return { opportunityRules: filterEmptyOpportunityRules(executionSteps) }
}

function buildSupportingEvidence(baseContract) {
  if (!baseContract || !baseContract.report) return []
  var report = baseContract.report
  var evidence = []
  ;(report.fatalRules || []).forEach(function(r) {
    evidence.push({
      type: 'LEGACY_FATAL',
      ruleId: r.ruleId,
      title: r.title,
      description: r.description,
      role: 'SUPPORTING_EVIDENCE',
    })
  })
  ;(report.advantageRules || []).forEach(function(r) {
    evidence.push({
      type: 'LEGACY_ADVANTAGE',
      ruleId: r.ruleId,
      title: r.title,
      description: r.description,
      role: 'SUPPORTING_EVIDENCE',
    })
  })
  return evidence
}

function buildReportFromDiagnosis(diagnosis, baseContract, renderSource) {
  renderSource = renderSource || 'diagnosis'

  if (!diagnosis) return buildEmptyReport()

  var headFatal = buildHeadlineAndFatalDiagnosis(diagnosis)
  var advIdentity = buildAdvantageAndIdentity(diagnosis)
  var actionStrike = buildActionPlanAndFinalStrike(diagnosis)
  var scores = buildScoreCard(diagnosis)
  var wp = buildWealthPath(diagnosis)
  var opp = buildOpportunityRules(diagnosis)
  var supportingEvidence = baseContract ? buildSupportingEvidence(baseContract) : []

  var report = {
    _fallbackSource: 'diagnosis',
    _renderSource: renderSource,
    _bottleneckId: (diagnosis.bottleneck || {}).id || null,
    _strategyId: (diagnosis.strategy || {}).id || null,
    _archetypeId: normalizeArchetypeTitle((diagnosis.wealthProfile || {}).primary || '待识别'),
    _version: 'v2.1',

    headline: headFatal.headline,
    wealthStage: 'STABLE',
    fatalDiagnosis: headFatal.fatalDiagnosis,

    fatalRules: supportingEvidence.filter(function(e) { return e.type === 'LEGACY_FATAL' })
      .map(function(e) { return { ruleId: e.ruleId, title: e.title, description: e.description, weight: 50, role: e.role } }),

    advantageRules: (advIdentity.advantageRules || []).concat(
      supportingEvidence.filter(function(e) { return e.type === 'LEGACY_ADVANTAGE' })
        .map(function(e) { return { ruleId: e.ruleId, title: e.title, description: e.description, weight: 30, role: e.role } })
    ),

    opportunityRules: opp.opportunityRules || [],
    scoreCard: scores.scoreCard,
    wealthProbability: scores.wealthProbability,
    potentialIndex: scores.potentialIndex,
    wealthPath: wp.wealthPath || [],
    actionPlan: actionStrike.actionPlan,
    stopDoing: actionStrike.stopDoing,
    identityUpgrade: advIdentity.identityUpgrade,
    finalStrike: actionStrike.finalStrike,

    version: 'RC8.2',
    engineVersion: diagnosis.engineVersion || 'RC8.2',
    diagnosticVersion: 'v4',
    generatedAt: new Date().toISOString(),
  }

  return {
    reportId: 'diag_' + Date.now(),
    report: report,
    engineVersion: 'RC8.2',
    _fallbackSource: 'diagnosis',
  }
}

// ═══════════════════════════════════════════════════════════════
// Quality Validation Gate
// ═══════════════════════════════════════════════════════════════

function validateFallbackQuality(report, diagnosis) {
  var errors = []
  var warnings = []
  var r = report.report || report
  var dump = typeof r === 'string' ? r : JSON.stringify(r)

  // DIAGNOSIS_STRATEGY_MISMATCH
  if (diagnosis) {
    var contract = validateDiagnosisContract(diagnosis)
    if (!contract.valid) errors.push({ code: contract.code, reason: contract.reason })
  }

  // OCCUPATION_TEMPLATE_MISMATCH — check standalone terms, not in code/comments
  // Use word-boundary check for SaaS to avoid matching constants like 'SAFE_MINIMAL_...aaS...'
  if (/\bSaaS\b/.test(dump) && diagnosis && diagnosis.wealthProfile && diagnosis.wealthProfile.primary !== 'DEVELOPER') {
    errors.push({ code: 'OCCUPATION_TEMPLATE_MISMATCH', reason: 'SaaS term found in non-technical report' })
  }
  if (dump.indexOf('代码杠杆') >= 0 && diagnosis && diagnosis.wealthProfile && diagnosis.wealthProfile.primary !== 'DEVELOPER') {
    errors.push({ code: 'OCCUPATION_TEMPLATE_MISMATCH', reason: 'Tech-specific content (代码杠杆) found in non-technical report' })
  }

  // DUPLICATED_SUFFIX
  var dupSuffixMatch = dump.match(/(\S+型型)/)
  if (dupSuffixMatch) {
    errors.push({ code: 'DUPLICATED_SUFFIX', reason: 'Duplicate suffix detected: ' + dupSuffixMatch[1] })
  }

  // EMPTY_PLACEHOLDER_CONTENT
  var contentStripped = dump.replace(/[备选路径：方向：、.\s\[\]{}"",]/g, '')
  if (contentStripped.length < 50 && r.finalStrike && r.finalStrike.length < 5) {
    errors.push({ code: 'EMPTY_PLACEHOLDER_CONTENT', reason: 'Content after stripping placeholders is below minimum threshold' })
  }

  // EMPTY_OPPORTUNITY
  var opps = r.opportunityRules || []
  if (!Array.isArray(opps) || opps.length === 0) {
    // No opportunity rules is OK — single strategy doesn't need them
  } else {
    var meaningfulCount = filterEmptyOpportunityRules(opps).length
    if (meaningfulCount < opps.length) {
      errors.push({ code: 'EMPTY_OPPORTUNITY', reason: (opps.length - meaningfulCount) + ' placeholder opportunity rules detected' })
    }
  }

  // SINGLE_THEME_CONTAMINATION — check real content fields, not stopDoing warnings
  // Exclude stopDoing items which may mention multi-direction as a negative warning
  var contentWithoutStopDoing = dump
  if (r.stopDoing && r.stopDoing.items) {
    contentWithoutStopDoing = dump.replace(/"stopDoing"[\s\S]*?\]\}/g, '')
  }
  var multiDirectionPatterns = ['AI副业', '自由职业', '多渠道变现', 'freelance']
  var hasContamination = false
  for (var i = 0; i < multiDirectionPatterns.length; i++) {
    if (contentWithoutStopDoing.indexOf(multiDirectionPatterns[i]) >= 0) {
      hasContamination = true
      errors.push({ code: 'SINGLE_THEME_CONTAMINATION', reason: 'Multi-direction content detected: ' + multiDirectionPatterns[i] })
      break
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    passed: errors.length === 0,
  }
}

function buildEmptyReport() { return buildMinimalEmptyReport() }

function assertDiagnosisReport(report) {
  var errors = []
  var r = report.report || report
  if (!r.headline || !r.headline.title) errors.push('MISSING_HEADLINE_TITLE')
  if (!r.fatalDiagnosis || !r.fatalDiagnosis.mainProblem) errors.push('MISSING_FATAL_DIAGNOSIS')
  if (!r.actionPlan || !r.actionPlan.day1 || !r.actionPlan.day1.goal) errors.push('MISSING_ACTION_PLAN_DAY1')
  if (!r.finalStrike) errors.push('MISSING_FINAL_STRIKE')
  return { ok: errors.length === 0, errors: errors }
}

module.exports = {
  buildSafeMinimalFromDiagnosis,
  buildReportFromDiagnosis,
  assertDiagnosisReport,
  buildEmptyReport,
  buildMinimalEmptyReport,
  validateDiagnosisContract,
  validateFallbackQuality,
  normalizeArchetypeTitle,
  filterEmptyOpportunityRules,
  isMeaningfulOpportunity,
  SAFE_TEMPLATES,
}
