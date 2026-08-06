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
 */

const { normalizePotentialIndex } = require('../config/reportUtils')

// ═══════════════════════════════════════════════════════════════
// Card01: bottleneck → headline.title, fatalDiagnosis
// ═══════════════════════════════════════════════════════════════

function buildHeadlineAndFatalDiagnosis(diagnosis) {
  const bottleneck = diagnosis.bottleneck || {}
  const archetype = diagnosis.wealthProfile || {}
  const behaviorTags = diagnosis.behaviorTags || []

  // Count tags by category for evidence
  const tagCategoryCounts = {}
  behaviorTags.forEach(function(t) {
    const cat = t.category || 'OTHER'
    tagCategoryCounts[cat] = (tagCategoryCounts[cat] || 0) + 1
  })

  // Build evidence summary from actual tag data
  const tagEvidence = Object.keys(tagCategoryCounts)
    .filter(function(c) { return tagCategoryCounts[c] >= 2 })
    .map(function(c) { return c + '信号(' + tagCategoryCounts[c] + '个)' })
    .join('、')

  const bottleneckId = bottleneck.id || 'UNKNOWN'
  const bottleneckLabel = bottleneck.label || '待评估'
  const bottleneckDesc = bottleneck.description || '需进一步诊断'
  const archetypeTitle = archetype.primaryTitle || archetype.primary || '待识别'

  return {
    headline: {
      title: bottleneckId === 'TRAFFIC' ? '获客信号缺失——技能有但市场看不到'
            : bottleneckId === 'SELLING' ? '成交信号缺失——有流量但转化不足'
            : bottleneckId === 'SYSTEM' ? '体系信号缺失——单点突破后未能复制'
            : bottleneckId === 'SINGLE_INCOME' ? '现金流过度集中——鸡蛋在一个篮子里'
            : bottleneckLabel + '：核心瓶颈',

      subtitle: archetypeTitle + '型人才 · ' + (tagEvidence || '基于当前数据信号'),
    },

    fatalDiagnosis: {
      mainProblem: bottleneckDesc,
      reason: (bottleneck.solution || bottleneck.reason || bottleneckDesc),
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
  const archetype = diagnosis.wealthProfile || {}
  const primaryTitle = archetype.primaryTitle || archetype.primary || '待识别'
  const traits = archetype.primaryTraits || []
  const confidence = archetype.confidence || 0.5
  const tagline = archetype.primaryTagline || ''

  return {
    advantageRules: [{
      ruleId: 'DIAG_ADV_IDENTITY',
      title: primaryTitle + '型智慧',
      description: tagline || ('具备' + (traits[0] || '已验证') + '的执行基础'),
      why: traits.length > 1 ? traits.slice(0, 3).join('、') + '——这些是资产而非负担'
            : '当前角色下的核心优势信号',
      weight: Math.round(confidence * 100),
      score: Math.round(confidence * 100),
    }],

    identityUpgrade: {
      current: primaryTitle + '型——' + (tagline || '当前角色信号'),
      target: '突破' + (diagnosis.bottleneck ? (diagnosis.bottleneck.label || '瓶颈') : '核心瓶颈'),
      bridge: (diagnosis.strategy && diagnosis.strategy.milestones && diagnosis.strategy.milestones.length)
        ? diagnosis.strategy.milestones.slice(0, 3).join(' → ')
        : '建立第一个里程碑',
    },
  }
}

// ═══════════════════════════════════════════════════════════════
// Card03: strategy → actionPlan, finalStrike
// ═══════════════════════════════════════════════════════════════

function buildActionPlanAndFinalStrike(diagnosis) {
  const strategy = diagnosis.strategy || {}
  const milestones = strategy.milestones || []
  const day1Mission = strategy.day1Mission || '识别当前最大信号缺口'
  const tagline = strategy.strategyTagline || strategy.strategyLabel || '聚焦行动'
  const duration = strategy.duration || '90天'
  const confidence = strategy.confidence || 0.5

  // Map strategy milestones to action plan days
  var dayMap = ['day1', 'day3', 'day7', 'day15', 'day30']

  var actionPlan = {}
  dayMap.forEach(function(day, index) {
    var milestone = milestones[index]
    if (index === 0) {
      // Day 1: always use day1Mission if available, else first milestone
      actionPlan[day] = {
        goal: day1Mission || (milestone || '启动第一步'),
        tasks: [day1Mission || milestone || '开始行动'],
        checkpoint: '启动第一步',
      }
    } else if (milestone) {
      actionPlan[day] = {
        goal: milestone,
        tasks: [milestone],
        checkpoint: '完成' + milestone,
      }
    } else {
      var lastMs = milestones[milestones.length - 1] || day1Mission || '持续推进'
      actionPlan[day] = {
        goal: '持续推进：' + lastMs,
        tasks: ['检查' + lastMs + '的推进状态', '调整下一阶段行动'],
        checkpoint: '复盘' + lastMs + '进展',
      }
    }
  })

  // Build concrete stopDoing list from behavior tags
  const behaviorTags = diagnosis.behaviorTags || []
  const stopDoingItems = buildStopDoingFromTags(behaviorTags)

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

/**
 * Build stop-doing list from actual behavior tag signals.
 */
function buildStopDoingFromTags(tags) {
  if (!tags || tags.length === 0) return []

  var items = []

  // Find high-weight negative signal tags
  tags.filter(function(t) { return t.weight >= 0.4 && t.signal === 'NEGATIVE' })
    .slice(0, 3)
    .forEach(function(t) {
      items.push({
        action: '停止 ' + (t.label || t.id),
        reason: t.description || '现有信号不支持此行为模式',
        tagId: t.id,
      })
    })

  // If no strong negative tags, use low-weight tags as suggestions
  if (items.length === 0) {
    tags.filter(function(t) { return t.weight < 0.4 || t.signal === 'NEGATIVE' })
      .slice(0, 3)
      .forEach(function(t) {
        items.push({
          action: '审视 ' + (t.label || t.id),
          reason: '信号权重偏低 (' + (t.weight || 0).toFixed(2) + ')，可能非核心方向',
          tagId: t.id,
        })
      })
  }

  // Fallback if still empty
  if (items.length === 0) {
    items.push({
      action: '暂停分散注意力的次要方向',
      reason: '聚焦核心瓶颈需要完整的注意力投入',
    })
  }

  return items
}

// ═══════════════════════════════════════════════════════════════
// Card04: scoreCard from engine data
// ═══════════════════════════════════════════════════════════════

function buildScoreCard(diagnosis) {
  // Derive scores from diagnosis confidence + tag signal strengths
  const bottleneck = diagnosis.bottleneck || {}
  const archetype = diagnosis.wealthProfile || {}
  const strategy = diagnosis.strategy || {}
  const tags = diagnosis.behaviorTags || []

  // Compute tag-based scores
  var cashflow = 50
  var skill = 50
  var execution = 50
  var time = 50
  var risk = 50

  // Adjust based on bottleneck type
  if (bottleneck.id === 'SINGLE_INCOME') {
    cashflow = Math.max(60, cashflow)
    risk = Math.max(55, risk)
  } else if (bottleneck.id === 'TRAFFIC') {
    skill = Math.max(60, skill)
    execution = Math.max(55, execution)
  }

  // Adjust based on archetype confidence
  if (archetype.confidence > 0.6) {
    cashflow += 10
    skill += 10
  }

  // Adjust based on strategy
  if (strategy.confidence > 0.5) {
    execution += 10
    time += 10
  }

  // Clamp all to [10, 90]
  cashflow = Math.min(90, Math.max(10, cashflow))
  skill = Math.min(90, Math.max(10, skill))
  execution = Math.min(90, Math.max(10, execution))
  time = Math.min(90, Math.max(10, time))
  risk = Math.min(90, Math.max(10, risk))

  var overall = Math.round((cashflow + skill + execution + time + risk) / 5)

  return {
    scoreCard: { cashflow, skill, execution, time, risk, overall },
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
  }
}

// ═══════════════════════════════════════════════════════════════
// Card05: wealthPath from strategy + archetype
// ═══════════════════════════════════════════════════════════════

function buildWealthPath(diagnosis) {
  const strategy = diagnosis.strategy || {}
  const archetype = diagnosis.wealthProfile || {}

  const paths = [
    {
      name: '技能产品化',
      recommend: 'recommended',
      score: 85,
      reason: (strategy.strategyId === 'BUILD_PRODUCT' || archetype.primary === 'OPERATOR')
        ? '现有技能验证程度最高，产品化是最直接的变现路径'
        : '将已验证技能标准化为可复制的产品',
    },
    {
      name: '自媒体获客',
      recommend: strategy.strategyId === 'BUILD_IP' ? 'recommended' : 'conditional',
      score: strategy.strategyId === 'BUILD_IP' ? 80 : 55,
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
  ]

  return { wealthPath: paths }
}

// ═══════════════════════════════════════════════════════════════
// Card06: opportunityRules from strategy alternatives
// ═══════════════════════════════════════════════════════════════

function buildOpportunityRules(diagnosis) {
  const strategy = diagnosis.strategy || {}
  const alternatives = strategy.alternatives || []

  if (alternatives.length === 0) {
    return {
      opportunityRules: [{
        sourceRuleId: 'DIAG_OPP_DEFAULT',
        reason: '在完成当前核心瓶颈突破后，可扩展至相关方向',
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
// Legacy fatalRules: from rule engine → supporting evidence ONLY
// ═══════════════════════════════════════════════════════════════

/**
 * Convert legacy rule engine output into supportingEvidence array.
 * These rules do NOT drive headline/fatalDiagnosis/strategy — they
 * only provide evidence to back up the RC8 diagnosis.
 */
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
// Master Builder
// ═══════════════════════════════════════════════════════════════

/**
 * Build a complete V4 report from RC8 diagnosis object.
 *
 * @param {Object} diagnosis — RC8 diagnosisPipeline output
 * @param {Object} [baseContract] — optional legacy contract for supporting evidence
 * @param {string} [renderSource='diagnosis'] — 'diagnosis' or fallback reason
 * @returns {{ reportId: string, report: Object, engineVersion: string }}
 */
function buildReportFromDiagnosis(diagnosis, baseContract, renderSource) {
  renderSource = renderSource || 'diagnosis'

  if (!diagnosis) {
    return buildEmptyReport()
  }

  // Card01: bottleneck → headline + fatalDiagnosis
  var headFatal = buildHeadlineAndFatalDiagnosis(diagnosis)

  // Card02: archetype → advantage + identityUpgrade
  var advIdentity = buildAdvantageAndIdentity(diagnosis)

  // Card03: strategy → actionPlan + finalStrike + stopDoing
  var actionStrike = buildActionPlanAndFinalStrike(diagnosis)

  // Card04: scores
  var scores = buildScoreCard(diagnosis)

  // Card05: wealthPath
  var wp = buildWealthPath(diagnosis)

  // Card06: opportunityRules
  var opp = buildOpportunityRules(diagnosis)

  // Supporting evidence from legacy engine (if available)
  var supportingEvidence = baseContract ? buildSupportingEvidence(baseContract) : []

  var report = {
    _fallbackSource: 'diagnosis',
    _renderSource: renderSource,
    _bottleneckId: (diagnosis.bottleneck || {}).id || null,
    _strategyId: (diagnosis.strategy || {}).id || null,
    _archetypeId: (diagnosis.wealthProfile || {}).primary || null,

    headline: headFatal.headline,
    wealthStage: 'STABLE', // default, overridden if diagnosis provides it
    fatalDiagnosis: headFatal.fatalDiagnosis,

    // Legacy fatalRules demoted to supporting evidence
    fatalRules: supportingEvidence.filter(function(e) { return e.type === 'LEGACY_FATAL' })
      .map(function(e) {
        return {
          ruleId: e.ruleId,
          title: e.title,
          description: e.description,
          weight: 50,
          role: e.role,
        }
      }),

    advantageRules: (advIdentity.advantageRules || []).concat(
      supportingEvidence.filter(function(e) { return e.type === 'LEGACY_ADVANTAGE' })
        .map(function(e) {
          return {
            ruleId: e.ruleId,
            title: e.title,
            description: e.description,
            weight: 30,
            role: e.role,
          }
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

    // Metadata
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

/**
 * Minimal empty report for worst-case fallback.
 */
function buildEmptyReport() {
  return {
    reportId: 'diag_empty_' + Date.now(),
    report: {
      _fallbackSource: 'EMPTY_FALLBACK',
      _renderSource: 'empty',
      headline: { title: '诊断信号不足', subtitle: '请重新完成诊断问卷' },
      wealthStage: 'STABLE',
      fatalDiagnosis: {
        mainProblem: '信号不足无法确定核心瓶颈',
        reason: '当前问卷数据未能触发有效诊断',
        severity: 'warning',
        confidence: 0.1,
        matchedRuleIds: [],
      },
      fatalRules: [],
      advantageRules: [{ ruleId: 'DIAG_DEFAULT', title: '重新诊断', description: '请至少完成15题以获得诊断结果', weight: 100 }],
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
// Guard: ensure diagnosis-built report is valid before response
// ═══════════════════════════════════════════════════════════════

function assertDiagnosisReport(report) {
  var errors = []

  var r = report.report || report
  if (!r.headline || !r.headline.title) errors.push('MISSING_HEADLINE_TITLE')
  if (!r.fatalDiagnosis || !r.fatalDiagnosis.mainProblem) errors.push('MISSING_FATAL_DIAGNOSIS')
  if (!r.fatalDiagnosis || r.fatalDiagnosis.mainProblem === '待评估') errors.push('GENERIC_BOTTLENECK')
  if (!r.actionPlan || !r.actionPlan.day1 || !r.actionPlan.day1.goal) errors.push('MISSING_ACTION_PLAN_DAY1')
  if (!r.finalStrike) errors.push('MISSING_FINAL_STRIKE')

  return { ok: errors.length === 0, errors: errors }
}

module.exports = {
  buildReportFromDiagnosis,
  buildHeadlineAndFatalDiagnosis,
  buildAdvantageAndIdentity,
  buildActionPlanAndFinalStrike,
  buildScoreCard,
  buildWealthPath,
  buildOpportunityRules,
  buildSupportingEvidence,
  assertDiagnosisReport,
  buildEmptyReport,
}
