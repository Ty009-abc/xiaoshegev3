/**
 * engine/worldModel/evidenceNormalizer.js
 *
 * Normalizes raw questionnaire answers into a structured evidence format
 * usable by the World Model Engine.
 *
 * CRITICAL RULES:
 * - Occupation must NOT directly produce archetype.
 * - Income must NOT directly determine blind spot.
 * - Primary goal must NOT alone decide strategy.
 * - Free text is auxiliary only — not primary evidence.
 * - Missing/low-quality answers produce weak confidence, not strong conclusions.
 * - Full raw answer text is NEVER logged — only normalized values.
 *
 * @version world_model_v1
 */

// ═══════════════════════════════════════════════════════════════
// Normalized answer categories
// ═══════════════════════════════════════════════════════════════

const CATEGORIES = {
  DECISION: [
    'decisionStyle', 'failureResponse', 'pastAttemptStage',
    'primaryGoal', 'maxTrialCost',
  ],
  RISK: [
    'safetyMonths', 'debtPressure', 'incomeStructure',
    'monthlySurplus', 'maxTrialCost',
  ],
  PROBABILITY: [
    'decisionStyle', 'failureResponse', 'pastAttemptStage',
    'primaryGoal',
  ],
  FEEDBACK: [
    'skillValidation', 'monetizableSkill', 'pastAttemptStage',
    'executionStability',
  ],
  OPPORTUNITY: [
    'monetizableSkill', 'skillValidation', 'pastAttemptStage',
    'occupationDetail', 'weeklyTime',
  ],
  LEVERAGE: [
    'monetizableSkill', 'incomeStructure', 'weeklyTime',
    'executionStability',
  ],
  IDENTITY: [
    'occupationDetail', 'monetizableSkill', 'decisionStyle',
    'pastAttemptStage',
  ],
  TIME: [
    'weeklyTime', 'lifeStage', 'primaryGoal',
    'executionStability',
  ],
}

// ═══════════════════════════════════════════════════════════════
// Normalization maps — raw enum → numeric strength
// ═══════════════════════════════════════════════════════════════

const SKILL_VALIDATION_STRENGTH = {
  '从未变现过': 0.1,
  '免费帮人做过': 0.2,
  '免费被感谢过': 0.25,
  '赚到过一次钱': 0.5,
  '偶尔有付费需求': 0.7,
  '有稳定客户/收入': 0.9,
}

const EXECUTION_STABILITY_STRENGTH = {
  '难以坚持/经常中断': 0.15,
  '偶尔能坚持': 0.35,
  '比较稳定': 0.65,
  '非常稳定/长期坚持': 0.9,
}

const DECISION_STYLE_STRENGTHS = {
  'GUT_FEEL': { evidenceBased: 0.15, intuitionDominant: 0.9, securityFirst: 0.3, optionPreserving: 0.5 },
  'DATA_DRIVEN': { evidenceBased: 0.85, intuitionDominant: 0.1, securityFirst: 0.4, optionPreserving: 0.5 },
  'SAFETY_FIRST': { evidenceBased: 0.3, intuitionDominant: 0.4, securityFirst: 0.85, optionPreserving: 0.2 },
  'OPTION_KEEPING': { evidenceBased: 0.4, intuitionDominant: 0.3, securityFirst: 0.2, optionPreserving: 0.85 },
  'QUICK_DECISIVE': { evidenceBased: 0.3, intuitionDominant: 0.8, securityFirst: 0.2, optionPreserving: 0.3 },
}

const FAILURE_RESPONSE_STRENGTHS = {
  'GIVE_UP': { feedbackAvoidance: 0.85, postActionReview: 0.1, uncertaintyTolerance: 0.1 },
  'ANALYZE_RETRY': { feedbackAvoidance: 0.1, postActionReview: 0.85, uncertaintyTolerance: 0.7 },
  'TRY_OTHER': { feedbackAvoidance: 0.3, postActionReview: 0.5, uncertaintyTolerance: 0.6 },
  'BLAME_EXTERNAL': { feedbackAvoidance: 0.8, postActionReview: 0.1, uncertaintyTolerance: 0.2 },
  'WAIT_BETTER': { feedbackAvoidance: 0.5, postActionReview: 0.3, uncertaintyTolerance: 0.2 },
}

const PAST_ATTEMPT_STRENGTHS = {
  'NEVER_TRIED': { experimentation: 0.05, marketEvidence: 0.1, feedbackLoop: 0.1 },
  'PLANNING': { experimentation: 0.2, marketEvidence: 0.1, feedbackLoop: 0.15 },
  'TRIED_ONCE': { experimentation: 0.5, marketEvidence: 0.3, feedbackLoop: 0.4 },
  'TRIED_MULTIPLE': { experimentation: 0.75, marketEvidence: 0.6, feedbackLoop: 0.65 },
  'ONGOING': { experimentation: 0.85, marketEvidence: 0.7, feedbackLoop: 0.7 },
}

const INCOME_STRUCTURE_STRENGTHS = {
  '工资/固定薪资': { leverageLinear: 0.85, diversification: 0.1, employmentDependence: 0.8 },
  '技能服务（按次/项目收费）': { leverageLinear: 0.5, diversification: 0.3, employmentDependence: 0.4 },
  '销售/佣金/提成': { leverageLinear: 0.3, diversification: 0.4, employmentDependence: 0.3 },
  '实体生意/经营收入': { leverageLinear: 0.2, diversification: 0.6, employmentDependence: 0.15 },
  '线上内容/流量变现': { leverageLinear: 0.1, diversification: 0.5, employmentDependence: 0.1 },
  '资产/投资/租金收入': { leverageLinear: 0.05, diversification: 0.7, employmentDependence: 0.05 },
  '收入不稳定': { leverageLinear: 0.4, diversification: 0.2, employmentDependence: 0.2 },
}

const SAFETY_MONTHS_STRENGTHS = {
  '不到1个月': { riskBuffer: 0.05, downsideAware: 0.9 },
  '1-3个月': { riskBuffer: 0.2, downsideAware: 0.7 },
  '3-6个月': { riskBuffer: 0.4, downsideAware: 0.5 },
  '6-12个月': { riskBuffer: 0.6, downsideAware: 0.4 },
  '12-24个月': { riskBuffer: 0.8, downsideAware: 0.3 },
  '24个月以上': { riskBuffer: 0.95, downsideAware: 0.2 },
}

const WEEKLY_TIME_STRENGTHS = {
  '几乎没时间': { timeAvailable: 0.05, timeFragmented: 0.1, focusedTime: 0.05 },
  '1-5小时': { timeAvailable: 0.25, timeFragmented: 0.3, focusedTime: 0.2 },
  '5-10小时': { timeAvailable: 0.5, timeFragmented: 0.4, focusedTime: 0.4 },
  '10-20小时': { timeAvailable: 0.7, timeFragmented: 0.5, focusedTime: 0.6 },
  '20小时以上': { timeAvailable: 0.9, timeFragmented: 0.6, focusedTime: 0.8 },
}

// ═══════════════════════════════════════════════════════════════
// Main normalizer
// ═══════════════════════════════════════════════════════════════

function normalizeEvidence(rawAnswers) {
  var evidence = []
  var idCounter = 0

  function add(key, category, normalizedValue, polarity, strength, confidence) {
    if (rawAnswers[key] === undefined || rawAnswers[key] === null || rawAnswers[key] === '') {
      return // Skip missing answers — no evidence, not negative evidence
    }
    idCounter++
    evidence.push({
      id: 'EVD_' + (idCounter < 100 ? (idCounter < 10 ? '00' + idCounter : '0' + idCounter) : String(idCounter)),
      questionId: key,
      rawCategory: category,
      rawValue: typeof rawAnswers[key] === 'string' ? rawAnswers[key].substring(0, 40) : String(rawAnswers[key]).substring(0, 40),
      normalizedValue: normalizedValue,
      polarity: polarity || 'NEUTRAL',
      strength: Math.min(1, Math.max(0, strength || 0.5)),
      confidence: Math.min(1, Math.max(0.1, confidence || 0.7)),
      sourceType: 'STRUCTURED_ANSWER',
      traceable: true,
    })
  }

  // ── Skill validation ──
  var sv = rawAnswers.skillValidation
  if (sv) {
    add('skillValidation', 'FEEDBACK', sv, 'NEUTRAL', SKILL_VALIDATION_STRENGTH[sv] || 0.3, 0.85)
    if (SKILL_VALIDATION_STRENGTH[sv] >= 0.7) {
      add('skillValidation', 'FEEDBACK', 'market_validated', 'SUPPORT', 0.8, 0.85)
    }
  }

  // ── Execution stability ──
  var es = rawAnswers.executionStability
  if (es) {
    add('executionStability', 'DECISION', es, 'NEUTRAL', EXECUTION_STABILITY_STRENGTH[es] || 0.4, 0.8)
  }

  // ── Decision style ──
  var ds = rawAnswers.decisionStyle
  var dsMap = DECISION_STYLE_STRENGTHS[ds]
  if (dsMap) {
    add('decisionStyle', 'DECISION', 'evidenceBased', 'NEUTRAL', dsMap.evidenceBased, 0.7)
    add('decisionStyle', 'DECISION', 'intuitionDominant', 'NEUTRAL', dsMap.intuitionDominant, 0.7)
    add('decisionStyle', 'DECISION', 'securityFirst', 'NEUTRAL', dsMap.securityFirst, 0.7)
    add('decisionStyle', 'DECISION', 'optionPreserving', 'NEUTRAL', dsMap.optionPreserving, 0.7)
  }

  // ── Failure response ──
  var fr = rawAnswers.failureResponse
  var frMap = FAILURE_RESPONSE_STRENGTHS[fr]
  if (frMap) {
    add('failureResponse', 'FEEDBACK', 'feedbackAvoidance', 'NEUTRAL', frMap.feedbackAvoidance, 0.7)
    add('failureResponse', 'FEEDBACK', 'postActionReview', 'NEUTRAL', frMap.postActionReview, 0.7)
    add('failureResponse', 'RISK', 'uncertaintyTolerance', 'NEUTRAL', frMap.uncertaintyTolerance, 0.7)
  }

  // ── Past attempt ──
  var pa = rawAnswers.pastAttemptStage
  var paMap = PAST_ATTEMPT_STRENGTHS[pa]
  if (paMap) {
    add('pastAttemptStage', 'DECISION', 'experimentation', 'NEUTRAL', paMap.experimentation, 0.8)
    add('pastAttemptStage', 'FEEDBACK', 'marketEvidence', 'NEUTRAL', paMap.marketEvidence, 0.8)
    add('pastAttemptStage', 'FEEDBACK', 'feedbackLoop', 'NEUTRAL', paMap.feedbackLoop, 0.8)
  }

  // ── Income structure ──
  var inc = rawAnswers.incomeStructure
  var incMap = INCOME_STRUCTURE_STRENGTHS[inc]
  if (incMap) {
    add('incomeStructure', 'LEVERAGE', 'leverageLinear', 'NEUTRAL', incMap.leverageLinear, 0.7)
    add('incomeStructure', 'RISK', 'diversification', 'NEUTRAL', incMap.diversification, 0.7)
    add('incomeStructure', 'IDENTITY', 'employmentDependence', 'NEUTRAL', incMap.employmentDependence, 0.7)
  }

  // ── Safety months ──
  var sm = rawAnswers.safetyMonths
  var smMap = SAFETY_MONTHS_STRENGTHS[sm]
  if (smMap) {
    add('safetyMonths', 'RISK', 'riskBuffer', 'NEUTRAL', smMap.riskBuffer, 0.85)
    add('safetyMonths', 'RISK', 'downsideAware', 'NEUTRAL', smMap.downsideAware, 0.85)
  }

  // ── Weekly time ──
  var wt = rawAnswers.weeklyTime
  var wtMap = WEEKLY_TIME_STRENGTHS[wt]
  if (wtMap) {
    add('weeklyTime', 'TIME', 'timeAvailable', 'NEUTRAL', wtMap.timeAvailable, 0.8)
    add('weeklyTime', 'TIME', 'timeFragmented', 'NEUTRAL', wtMap.timeFragmented, 0.8)
    add('weeklyTime', 'TIME', 'focusedTime', 'NEUTRAL', wtMap.focusedTime, 0.8)
  }

  // ── Monthly surplus (contextual) ──
  var ms = rawAnswers.monthlySurplus
  if (ms !== undefined && ms !== null && ms !== '') {
    var msStrength = 0.3
    if (ms.indexOf('负数') >= 0) msStrength = 0.1
    else if (ms.indexOf('10000') >= 0) msStrength = 0.9
    else if (ms.indexOf('5000') >= 0) msStrength = 0.7
    else if (ms.indexOf('1000') >= 0) msStrength = 0.5
    add('monthlySurplus', 'RISK', 'financialBuffer', 'NEUTRAL', msStrength, 0.7)
  }

  // ── Debt pressure ──
  var dp = rawAnswers.debtPressure
  if (dp) {
    var dpStrength = dp.indexOf('无负债') >= 0 ? 0.9 : dp.indexOf('房贷') >= 0 ? 0.6 : dp.indexOf('以贷养贷') >= 0 ? 0.1 : 0.3
    add('debtPressure', 'RISK', 'debtRisk', 'NEUTRAL', dpStrength, 0.8)
  }

  // ── Monetizable skill (contextual — NOT archetype trigger!) ──
  var msk = rawAnswers.monetizableSkill
  if (msk) {
    add('monetizableSkill', 'OPPORTUNITY', 'skillCategory', 'NEUTRAL', 0.5, 0.6)
  }

  // ── Primary goal (contextual — NOT strategy trigger!) ──
  var pg = rawAnswers.primaryGoal
  if (pg) {
    add('primaryGoal', 'DECISION', 'goalOrientation', 'NEUTRAL', 0.3, 0.5)
  }

  // ── Max trial cost ──
  var mtc = rawAnswers.maxTrialCost
  if (mtc) {
    var mtcStrength = 0.5
    if (mtc.indexOf('不愿投入') >= 0) mtcStrength = 0.1
    else if (mtc.indexOf('500以上') >= 0 || mtc.indexOf('1000以上') >= 0) mtcStrength = 0.8
    add('maxTrialCost', 'DECISION', 'experimentWillingness', 'NEUTRAL', mtcStrength, 0.7)
  }

  // ── Occupation detail (contextual only — NOT identity trigger!) ──
  var od = rawAnswers.occupationDetail
  if (od && typeof od === 'string' && od.trim().length > 0) {
    // Store only category, never the specific title
    add('occupationDetail', 'IDENTITY', 'occupationPresent', 'NEUTRAL', 0.3, 0.4)
  }

  // Compute summary stats
  var totalEvidence = evidence.length
  var avgStrength = totalEvidence > 0
    ? Math.round(evidence.reduce(function(s, e) { return s + e.strength }, 0) / totalEvidence * 100) / 100
    : 0

  return {
    evidence: evidence,
    count: totalEvidence,
    avgStrength: avgStrength,
    coverageRatio: Math.min(1, totalEvidence / 25), // Normalize to ~25 expected data points
    categories: CATEGORIES,
  }
}

/**
 * Collect evidence IDs for a given dimension tag.
 */
function getEvidenceByTag(normalizedEvidence, tag) {
  return (normalizedEvidence.evidence || []).filter(function(e) {
    return e.normalizedValue === tag
  }).map(function(e) { return e.id })
}

/**
 * Get aggregate strength for a set of evidence tags.
 */
function getAggregateStrength(normalizedEvidence, tags) {
  var relevant = (normalizedEvidence.evidence || []).filter(function(e) {
    return tags.indexOf(e.normalizedValue) >= 0
  })
  if (relevant.length === 0) return 0
  return relevant.reduce(function(s, e) { return s + e.strength }, 0) / relevant.length
}

module.exports = {
  normalizeEvidence,
  getEvidenceByTag,
  getAggregateStrength,
  CATEGORIES,
}
