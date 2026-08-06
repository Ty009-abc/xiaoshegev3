/**
 * cloudfunctions/generateAiReport/lib/v4/diagnosisReportBuilder.js
 *
 * RC8.2: Deterministic Report Builder — constructs a complete V4 report
 * from the RC8 diagnosis object (NOT from legacy rule engine fatalRules).
 *
 * Routes diagnosis fields to V4 report structure:
 *   bottleneck  → headline.title, fatalDiagnosis, identityUpgrade.current
 *   archetype   → headline.subtitle, advantageRules[0], identityUpgrade.target
 *   strategy    → actionPlan, finalStrike, wealthPath recommendation
 *   scoreCard   → computed from engine scores
 *   wealthPath  → from strategy + archetype hints
 *
 * Principles:
 *   - Zero AI dependency — deterministic mapping only
 *   - Single-theme enforcement — one bottleneck, one strategy
 *   - No unsupported claims — text is constrained by evidence
 *   - Legacy fatalRules → supportingEvidence array (not headline/fatalDiagnosis)
 *   - All templates are pre-validated against content safety gate
 */

const { normalizePotentialIndex } = require('../config/reportUtils')

// ═══════════════════════════════════════════════════════════════
// SAFE MINIMAL templates — pre-validated, zero-violation guarantee
// These templates can NEVER trigger content safety violations because
// they contain NO percentage claims about users, NO made-up behaviors,
// NO extreme metaphors, NO multi-theme contamination.
// ═══════════════════════════════════════════════════════════════

var SAFE_TEMPLATES = {
  TRAFFIC: {
    headlineTitle: '获客信号缺失——技能有但市场看不到',
    headlineSubtitle: '手艺人型 · 需要稳定客户来源',
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
    headlineSubtitle: '创作者型 · 需要成交闭环',
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
    headlineSubtitle: '运营者型 · 需要系统化',
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
    headlineSubtitle: '执行者型 · 需要建立第二发动机',
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
// SAFE MINIMAL: guaranteed zero-violation fallback
// ═══════════════════════════════════════════════════════════════

/**
 * Build a SAFE_MINIMAL report from diagnosis using pre-validated templates.
 * This template is GUARANTEED to pass content safety validation — it contains
 * zero percentage claims, zero made-up behaviors, zero extreme metaphors,
 * and zero multi-theme contamination.
 *
 * It does NOT contain:
 *   - "80%/90%/99%的人不具备"
 *   - "100%精力投入"
 *   - "10倍投入"
 *   - "一定成功" / "必须辞职" / "把命交给" / "扛不住"
 *   - Any unsupported psychology claims
 *   - Any multi-direction opportunity market
 *
 * If no template matches the bottleneck, uses a catch-all generic template.
 */
function buildSafeMinimalFromDiagnosis(diagnosis) {
  if (!diagnosis) {
    return buildMinimalEmptyReport()
  }

  var bottleneckId = (diagnosis.bottleneck || {}).id || 'UNKNOWN'
  var archetype = diagnosis.wealthProfile || {}
  var strategy = diagnosis.strategy || {}
  var template = SAFE_TEMPLATES[bottleneckId] || buildGenericSafeTemplate(diagnosis)

  // Archetype label for subtitle — 7 canonical archetypes
  var primaryTitle = archetype.primaryTitle || archetype.primary || '待识别'

  // Strategy label for context
  var strategyLabel = strategy.strategyLabel || strategy.id || '聚焦行动'

  // Scores: clamped to [10, 90]
  var overall = Math.min(90, Math.max(10, Math.round(
    50 + (archetype.confidence || 0.5) * 20 + (strategy.confidence || 0.5) * 15
  )))

  var report = {
    _fallbackSource: 'SAFE_MINIMAL_DIAGNOSIS',
    _renderSource: 'safe_minimal_diagnosis',
    _bottleneckId: bottleneckId,
    _strategyId: strategy.id || bottleneckId,
    _archetypeId: primaryTitle,

    headline: {
      title: template.headlineTitle,
      subtitle: primaryTitle + '型 · ' + template.headlineSubtitle.split('·').pop().trim(),
    },

    wealthStage: 'STABLE',

    fatalDiagnosis: {
      mainProblem: template.fatalMainProblem,
      reason: template.fatalReason,
      severity: 'critical',
      confidence: strategy.confidence || 0.5,
      matchedRuleIds: [],
    },

    fatalRules: [{
      ruleId: 'DIAG_SAFE_BOTTLENECK',
      title: '核心瓶颈：' + (diagnosis.bottleneck || {}).label || template.headlineTitle,
      description: template.fatalMainProblem,
      weight: 90,
      role: 'SAFE_MINIMAL_DIAGNOSIS',
    }],

    advantageRules: [{
      ruleId: 'DIAG_SAFE_ADVANTAGE',
      title: primaryTitle + '型信号验证',
      description: '当前诊断显示' + primaryTitle + '型优势信号，可作为突破基础',
      weight: 70,
      role: 'SAFE_MINIMAL_DIAGNOSIS',
    }],

    opportunityRules: [{
      sourceRuleId: 'DIAG_SAFE_OPP',
      reason: '完成当前核心瓶颈突破后，可基于已验证信号扩展',
      description: '单点突破 → 验证复制 → 扩展方向',
      why: '聚焦当前瓶颈是降低执行风险的最优策略',
    }],

    scoreCard: {
      cashflow: Math.min(90, Math.max(10, overall - 5)),
      skill: Math.min(90, Math.max(10, overall + 5)),
      execution: Math.min(90, Math.max(10, overall)),
      time: Math.min(90, Math.max(10, overall - 5)),
      risk: Math.min(90, Math.max(10, overall + 5)),
      overall: overall,
    },

    wealthProbability: normalizePotentialIndex({
      today: overall,
      after30: Math.min(90, overall + 5),
      after90: Math.min(90, overall + 10),
      after365: Math.min(90, overall + 20),
    }),

    potentialIndex: normalizePotentialIndex({
      today: overall,
      after30: Math.min(90, overall + 5),
      after90: Math.min(90, overall + 10),
      after365: Math.min(90, overall + 20),
    }),

    wealthPath: [
      {
        name: strategyLabel + '路径',
        recommend: 'recommended',
        score: 85,
        reason: '基于当前诊断信号的最优行动方向',
      },
      {
        name: '技能延伸',
        recommend: 'conditional',
        score: 55,
        reason: '完成核心瓶颈突破后可作为扩展方向',
      },
    ],

    actionPlan: {
      day1: {
        goal: template.day1Mission,
        tasks: [template.day1Mission],
        checkpoint: '发出第一份报价',
      },
      day3: {
        goal: (template.milestones[0] || '持续推进'),
        tasks: [(template.milestones[0] || '持续推进')],
        checkpoint: '完成第一步里程碑',
      },
      day7: {
        goal: (template.milestones[1] || '持续推进'),
        tasks: [(template.milestones[1] || '持续推进')],
        checkpoint: '完成第二步里程碑',
      },
      day15: {
        goal: (template.milestones[2] || '持续推进'),
        tasks: [(template.milestones[2] || '持续推进')],
        checkpoint: '完成第三步里程碑',
      },
      day30: {
        goal: '复盘并调整行动策略',
        tasks: ['检查里程碑完成情况', '调整下一阶段行动方向'],
        checkpoint: '完成首月复盘',
      },
    },

    stopDoing: {
      priority: 'HIGH',
      items: template.stopDoingItems.map(function(item) {
        return { action: item.action, reason: item.reason }
      }),
    },

    identityUpgrade: {
      current: primaryTitle + '型——已积累可验证的信号基础',
      target: '突破' + ((diagnosis.bottleneck || {}).label || '核心瓶颈'),
      bridge: (template.milestones || []).join(' → '),
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

/**
 * Catch-all generic safe template when bottleneck is unknown.
 */
function buildGenericSafeTemplate(diagnosis) {
  var bottleneckLabel = (diagnosis.bottleneck || {}).label || '核心瓶颈'
  return {
    headlineTitle: bottleneckLabel + '——当前最需要突破的信号缺口',
    headlineSubtitle: '待完善方向 · 聚焦行动',
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
        severity: 'warning',
        confidence: 0.1,
        matchedRuleIds: [],
      },
      fatalRules: [],
      advantageRules: [{ ruleId: 'DIAG_DEFAULT', title: '重新诊断', description: '请至少完成15题以获得诊断结果', weight: 100, role: 'SAFE_MINIMAL' }],
      opportunityRules: [],
      scoreCard: { cashflow: 50, skill: 50, execution: 50, time: 50, risk: 50, overall: 50 },
      wealthProbability: { today: 50, after30: 55, after90: 60, after365: 70 },
      potentialIndex: { today: 50, after30: 55, after90: 60, after365: 70 },
      wealthPath: [{ name: '重新诊断', recommend: 'recommended', score: 100, reason: '当前数据不足，请重新完成诊断' }],
      actionPlan: { day1: { goal: '重新完成诊断问卷', tasks: ['完成至少15题'], checkpoint: '提交诊断' } },
      stopDoing: { priority: 'LOW', items: [] },
      identityUpgrade: { current: '待诊断', target: '重新诊断', bridge: '完成问卷 → 获得个性化报告' },
      finalStrike: '完成诊断问卷以获取你的专属突破路线图',
      version: 'RC8.2',
      engineVersion: 'RC8.2',
      generatedAt: new Date().toISOString(),
    },
    engineVersion: 'RC8.2',
  }
}

// ═══════════════════════════════════════════════════════════════
// Card01: bottleneck → headline.title, fatalDiagnosis
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
  var archetypeTitle = archetype.primaryTitle || archetype.primary || '待识别'

  // Select template-based headline for known bottleneck types
  var headlineTitle = bottleneckId === 'TRAFFIC' ? '获客信号缺失——技能有但市场看不到'
    : bottleneckId === 'SELLING' ? '成交信号缺失——有流量但转化不足'
    : bottleneckId === 'SYSTEM' ? '体系信号缺失——单点突破后未能复制'
    : bottleneckId === 'SINGLE_INCOME' ? '收入结构单一——现金流过度集中'
    : bottleneckLabel + '：核心瓶颈'

  return {
    headline: {
      title: headlineTitle,
      subtitle: archetypeTitle + '型 · ' + (tagEvidence || '基于当前诊断数据'),
    },
    fatalDiagnosis: {
      mainProblem: bottleneckDesc,
      reason: bottleneck.solution || bottleneck.reason || bottleneckDesc,
      severity: ['fatal', 'critical', 'warning'][Math.min(2, Math.floor((1 - (bottleneck.confidence || 0.5)) * 3))] || 'fatal',
      confidence: bottleneck.confidence || 0.5,
      matchedRuleIds: (diagnosis._raw && diagnosis._raw.bottleneck && diagnosis._raw.bottleneck.evidenceIds)
        ? diagnosis._raw.bottleneck.evidenceIds
        : [],
    },
  }
}

// ═══════════════════════════════════════════════════════════════
// Card02: archetype → advantage, identityUpgrade
// ═══════════════════════════════════════════════════════════════

function buildAdvantageAndIdentity(diagnosis) {
  var archetype = diagnosis.wealthProfile || {}
  var primaryTitle = archetype.primaryTitle || archetype.primary || '待识别'
  var traits = archetype.primaryTraits || []
  var confidence = archetype.confidence || 0.5
  var tagline = archetype.primaryTagline || ''

  return {
    advantageRules: [{
      ruleId: 'DIAG_ADV_IDENTITY',
      title: primaryTitle + '型优势信号',
      description: tagline || ('具备' + (traits[0] || '已验证技能') + '的执行基础'),
      why: traits.length > 1 ? traits.slice(0, 3).join('、') + '——可作为突破基础'
        : '当前角色下的核心优势信号',
      weight: Math.round(confidence * 100),
      score: Math.round(confidence * 100),
    }],
    identityUpgrade: {
      current: primaryTitle + '型——' + (tagline || '当前已验证信号'),
      target: '突破' + ((diagnosis.bottleneck || {}).label || '核心瓶颈'),
      bridge: ((diagnosis.strategy || {}).milestones || []).slice(0, 3).join(' → ') || '建立第一个里程碑',
    },
  }
}

// ═══════════════════════════════════════════════════════════════
// Card03: strategy → actionPlan, finalStrike
// ═══════════════════════════════════════════════════════════════

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
        checkpoint: '完成' + milestone,
      }
    } else {
      var lastMs = milestones[milestones.length - 1] || day1Mission
      actionPlan[day] = {
        goal: '持续推进：' + lastMs,
        tasks: ['检查' + lastMs + '推进状态', '调整下一阶段行动'],
        checkpoint: '复盘' + lastMs + '进展',
      }
    }
  })

  var stopDoingItems = buildStopDoingFromTags(diagnosis.behaviorTags || [])

  return {
    actionPlan: actionPlan,
    finalStrike: tagline + '，' + duration + '聚焦。'
      + (milestones.length > 0
        ? milestones[0] + (milestones.length > 1 ? ' → ' + milestones[milestones.length - 1] : '')
        : day1Mission),
    stopDoing: {
      priority: 'HIGH',
      items: stopDoingItems,
    },
  }
}

function buildStopDoingFromTags(tags) {
  if (!tags || tags.length === 0) {
    return [{ action: '暂停分散注意力的次要方向', reason: '聚焦核心瓶颈需要完整注意力' }]
  }

  var items = []
  tags.filter(function(t) { return t.weight >= 0.4 && t.signal === 'NEGATIVE' })
    .slice(0, 3)
    .forEach(function(t) {
      items.push({
        action: '停止 ' + (t.label || t.id),
        reason: t.description || '当前信号不支持此行为方向',
        tagId: t.id,
      })
    })

  if (items.length === 0) {
    tags.filter(function(t) { return t.signal === 'NEGATIVE' })
      .slice(0, 3)
      .forEach(function(t) {
        items.push({
          action: '审视 ' + (t.label || t.id),
          reason: '信号方向需要调整 (' + ((t.weight || 0) * 100).toFixed(0) + '%)',
          tagId: t.id,
        })
      })
  }

  if (items.length === 0) {
    items.push({ action: '暂停分散注意力的次要方向', reason: '聚焦核心瓶颈需要完整注意力' })
  }

  return items
}

// ═══════════════════════════════════════════════════════════════
// Card04: scoreCard from engine data
// ═══════════════════════════════════════════════════════════════

function buildScoreCard(diagnosis) {
  var bottleneck = diagnosis.bottleneck || {}
  var archetype = diagnosis.wealthProfile || {}
  var strategy = diagnosis.strategy || {}

  var cashflow = 50
  var skill = 50
  var execution = 50
  var time = 50
  var risk = 50

  if (bottleneck.id === 'SINGLE_INCOME') { cashflow = Math.max(60, cashflow); risk = Math.max(55, risk) }
  else if (bottleneck.id === 'TRAFFIC') { skill = Math.max(60, skill); execution = Math.max(55, execution) }

  if (archetype.confidence > 0.6) { cashflow += 10; skill += 10 }
  if (strategy.confidence > 0.5) { execution += 10; time += 10 }

  cashflow = Math.min(90, Math.max(10, cashflow))
  skill = Math.min(90, Math.max(10, skill))
  execution = Math.min(90, Math.max(10, execution))
  time = Math.min(90, Math.max(10, time))
  risk = Math.min(90, Math.max(10, risk))

  var overall = Math.round((cashflow + skill + execution + time + risk) / 5)

  return {
    scoreCard: { cashflow, skill, execution, time, risk, overall },
    wealthProbability: normalizePotentialIndex({
      today: overall, after30: Math.min(90, overall + 5),
      after90: Math.min(90, overall + 10), after365: Math.min(90, overall + 20),
    }),
    potentialIndex: normalizePotentialIndex({
      today: overall, after30: Math.min(90, overall + 5),
      after90: Math.min(90, overall + 10), after365: Math.min(90, overall + 20),
    }),
  }
}

// ═══════════════════════════════════════════════════════════════
// Card05: wealthPath from strategy + archetype
// ═══════════════════════════════════════════════════════════════

function buildWealthPath(diagnosis) {
  var strategy = diagnosis.strategy || {}
  var archetype = diagnosis.wealthProfile || {}

  return {
    wealthPath: [
      {
        name: '技能产品化',
        recommend: 'recommended',
        score: 85,
        reason: (strategy.id === 'BUILD_PRODUCT' || archetype.primary === 'OPERATOR')
          ? '现有技能已验证，产品化是最直接变现路径'
          : '将已验证技能转化为可复制产品',
      },
      {
        name: '内容获客',
        recommend: strategy.id === 'BUILD_IP' ? 'recommended' : 'conditional',
        score: strategy.id === 'BUILD_IP' ? 80 : 55,
        reason: '建立内容输出体系，用内容持续吸引客户',
      },
      {
        name: '知识付费',
        recommend: archetype.primary === 'CREATOR' ? 'conditional' : 'not_recommended',
        score: archetype.primary === 'CREATOR' ? 60 : 25,
        reason: archetype.primary === 'CREATOR'
          ? '有内容输出意识，但需先验证市场'
          : '当前信号不支撑此方向',
      },
      {
        name: '投资理财',
        recommend: 'not_recommended',
        score: 20,
        reason: '在完成核心瓶颈突破前，投资方向不推荐',
      },
    ],
  }
}

// ═══════════════════════════════════════════════════════════════
// Card06: opportunityRules from strategy alternatives
// ═══════════════════════════════════════════════════════════════

function buildOpportunityRules(diagnosis) {
  var strategy = diagnosis.strategy || {}
  var alternatives = strategy.alternatives || []

  if (alternatives.length === 0) {
    return {
      opportunityRules: [{
        sourceRuleId: 'DIAG_OPP_DEFAULT',
        reason: '完成当前核心瓶颈突破后，可基于已验证信号扩展',
        description: '单点突破后再考虑多元化',
        why: '先聚焦再扩展是降低执行风险的最优路径',
      }],
    }
  }

  return {
    opportunityRules: alternatives.slice(0, 2).map(function(alt, i) {
      return {
        sourceRuleId: 'DIAG_OPP_ALT_' + i,
        reason: (alt.label || alt.id || '备选路径') + '——' + (alt.description || ''),
        description: '备选方向：' + (alt.label || alt.id || ''),
        why: alt.reason || '暂不推荐作为主策略',
      }
    }),
  }
}

// ═══════════════════════════════════════════════════════════════
// Legacy fatalRules → supporting evidence ONLY
// ═══════════════════════════════════════════════════════════════

function buildSupportingEvidence(baseContract) {
  if (!baseContract || !baseContract.report) return []

  var evidence = []
  var fatalRules = baseContract.report.fatalRules || []
  var advantageRules = baseContract.report.advantageRules || []

  fatalRules.forEach(function(r) {
    evidence.push({
      type: 'LEGACY_FATAL',
      ruleId: r.ruleId || '',
      title: r.title || '',
      description: r.description || '',
      role: 'SUPPORTING_EVIDENCE',
    })
  })

  advantageRules.forEach(function(r) {
    evidence.push({
      type: 'LEGACY_ADVANTAGE',
      ruleId: r.ruleId || '',
      title: r.title || '',
      description: r.description || '',
      role: 'SUPPORTING_EVIDENCE',
    })
  })

  return evidence
}

// ═══════════════════════════════════════════════════════════════
// Master Builder: full V4 report from RC8 diagnosis
// ═══════════════════════════════════════════════════════════════

function buildReportFromDiagnosis(diagnosis, baseContract, renderSource) {
  renderSource = renderSource || 'diagnosis'

  if (!diagnosis) {
    return buildEmptyReport()
  }

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
    _archetypeId: (diagnosis.wealthProfile || {}).primary || null,

    headline: headFatal.headline,
    wealthStage: 'STABLE',
    fatalDiagnosis: headFatal.fatalDiagnosis,

    fatalRules: supportingEvidence.filter(function(e) { return e.type === 'LEGACY_FATAL' })
      .map(function(e) {
        return { ruleId: e.ruleId, title: e.title, description: e.description, weight: 50, role: e.role }
      }),

    advantageRules: (advIdentity.advantageRules || []).concat(
      supportingEvidence.filter(function(e) { return e.type === 'LEGACY_ADVANTAGE' })
        .map(function(e) {
          return { ruleId: e.ruleId, title: e.title, description: e.description, weight: 30, role: e.role }
        })
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

function buildEmptyReport() {
  return buildMinimalEmptyReport()
}

// ═══════════════════════════════════════════════════════════════
// Guard: ensure diagnosis-built report is structurally valid
// ═══════════════════════════════════════════════════════════════

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
  buildReportFromDiagnosis,
  buildSafeMinimalFromDiagnosis,
  buildHeadlineAndFatalDiagnosis,
  buildAdvantageAndIdentity,
  buildActionPlanAndFinalStrike,
  buildScoreCard,
  buildWealthPath,
  buildOpportunityRules,
  buildSupportingEvidence,
  assertDiagnosisReport,
  buildEmptyReport,
  SAFE_TEMPLATES,
}
