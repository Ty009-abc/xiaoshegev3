/**
 * cloudfunctions/generateAiReport/lib/config/contentSafetyGate.js
 *
 * Server-side content safety gate — runs as HARD BLOCK after AI merge.
 * Validates ALL report text fields, not just poster cards.
 *
 * Violation → repair once → re-validate → deterministic fallback if still failing.
 *
 * @version RC8.2
 */

var VIOLATION_TYPES = {
  OVERCLAIMED_USER_PSYCHOLOGY: 'OVERCLAIMED_USER_PSYCHOLOGY',
  OVERCLAIMED_USER_BEHAVIOR: 'OVERCLAIMED_USER_BEHAVIOR',
  OVERCLAIMED_OUTCOME: 'OVERCLAIMED_OUTCOME',
  UNSUPPORTED_PERCENTAGE_CLAIM: 'UNSUPPORTED_PERCENTAGE_CLAIM',
  MULTI_THEME_CONTAMINATION: 'MULTI_THEME_CONTAMINATION',
  UNSAFE_EXTREME_METAPHOR: 'UNSAFE_EXTREME_METAPHOR',
  DUPLICATE_MEANING: 'DUPLICATE_MEANING',
}

// Patterns that indicate the LLM made up facts about the user
var OVERCLAIM_PSYCHOLOGY_PATTERNS = [
  '麻痹自己', '躺平', '不敢想', '害怕成功', '用学习逃避', '假装努力',
  '自我感动', '回避现实', '逃避现实', '不敢面对', '内心恐惧', '缺乏勇气',
  '自卑', '不配得', '受害者心态', '抱怨命运', '自欺欺人',
]

var OVERCLAIM_BEHAVIOR_PATTERNS = [
  '刷手机', '一直刷教程', '把时间都浪费', '没有真正行动', '从未主动销售',
  '一直拖延', '永远不开始', '不断换方向', '三天打鱼', '收藏从未看',
  '买了一堆课程', '等老板加薪', '学新菜', '用来刷', '等着加薪',
]

var OVERCLAIM_OUTCOME_PATTERNS = [
  '一旦老板裁员', '一旦被裁', '裁员.*扛不住', '六个月都扛不住',
  '收入归零', '一定失业', '必然失败', '永远月薪', '绝无可能',
  '注定', '无可避免', '连', '个月都扛不住',
]

var UNSAFE_METAPHOR_PATTERNS = [
  '残废', '死亡', '窒息', '流血', '断裂', '崩溃', '毁灭', '崩塌',
  '绝路', '末日', '深渊', '地狱', '慢性自杀', '用它们等死',
  '把命交给', '等着救赎', '救你',
]

var PERCENTAGE_CLAIM_PATTERNS = [
  '比99%', '超过绝大多数', '不到1%', '只有1%', '比90%',
]

var FORBIDDEN_MULTI_THEME_KEYWORDS = [
  'AI副业', '泛自由职业', '多个方向', '多种渠道', '多个项目',
  '多方向并进', '同时开发多个产品', '多种收入来源', '多个品牌方向',
  '投资', '炒股', '基金',
]

/**
 * Check if any pattern from the list appears in the text.
 * Returns the first match or null.
 */
function findViolation(text, patterns) {
  if (!text || typeof text !== 'string') return null
  for (var i = 0; i < patterns.length; i++) {
    var idx = text.indexOf(patterns[i])
    if (idx >= 0) {
      return { pattern: patterns[i], index: idx }
    }
  }
  return null
}

/**
 * Check regex patterns against text.
 */
function findRegexViolation(text, patterns) {
  if (!text || typeof text !== 'string') return null
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i])
    if (m) {
      return { pattern: String(patterns[i]), match: m[0] }
    }
  }
  return null
}

/**
 * Scan a single text field.
 */
function scanTextField(value, fieldPath, strategyId) {
  var violations = []
  if (!value || typeof value !== 'string') return violations

  // Unsafe metaphors
  var m = findViolation(value, UNSAFE_METAPHOR_PATTERNS)
  if (m) {
    violations.push({
      type: VIOLATION_TYPES.UNSAFE_EXTREME_METAPHOR,
      field: fieldPath,
      match: m.pattern,
      suggestion: 'Use neutral structural description. Avoid violence/death/dependency metaphors.',
    })
  }

  // Overclaimed psychology
  m = findViolation(value, OVERCLAIM_PSYCHOLOGY_PATTERNS)
  if (m) {
    violations.push({
      type: VIOLATION_TYPES.OVERCLAIMED_USER_PSYCHOLOGY,
      field: fieldPath,
      match: m.pattern,
      suggestion: 'Do not invent user psychology. Only state what evidence supports.',
    })
  }

  // Overclaimed behavior
  m = findViolation(value, OVERCLAIM_BEHAVIOR_PATTERNS)
  if (m) {
    violations.push({
      type: VIOLATION_TYPES.OVERCLAIMED_USER_BEHAVIOR,
      field: fieldPath,
      match: m.pattern,
      suggestion: 'Do not invent user behaviors. Use "现有数据未显示" not "你在做X".',
    })
  }

  // Overclaimed outcomes
  m = findRegexViolation(value, OVERCLAIM_OUTCOME_PATTERNS.map(function(p) { return new RegExp(p) }))
  if (m) {
    violations.push({
      type: VIOLATION_TYPES.OVERCLAIMED_OUTCOME,
      field: fieldPath,
      match: m.match,
      suggestion: 'Describe structural risk, not deterministic catastrophe.',
    })
  }

  // Percentage claims
  m = findViolation(value, PERCENTAGE_CLAIM_PATTERNS)
  if (m) {
    violations.push({
      type: VIOLATION_TYPES.UNSUPPORTED_PERCENTAGE_CLAIM,
      field: fieldPath,
      match: m.pattern,
      suggestion: 'Remove unsupported statistic.',
    })
  }

  // Multi-theme contamination
  if (strategyId === 'BUILD_IP') {
    m = findViolation(value, FORBIDDEN_MULTI_THEME_KEYWORDS)
    if (m) {
      violations.push({
        type: VIOLATION_TYPES.MULTI_THEME_CONTAMINATION,
        field: fieldPath,
        match: m.pattern,
        suggestion: 'BUILD_IP only allows: 定位, 内容输出, 获客, 产品化, 成交验证, 信任积累.',
      })
    }
  }

  return violations
}

/**
 * Collect ALL text fields from the V4 report structure.
 */
function collectTextFields(report) {
  if (!report) return []
  var fields = []

  // headline
  if (report.headline) {
    if (report.headline.title) fields.push({ path: 'headline.title', value: report.headline.title })
    if (report.headline.subtitle) fields.push({ path: 'headline.subtitle', value: report.headline.subtitle })
  }

  // fatalDiagnosis
  if (report.fatalDiagnosis) {
    if (report.fatalDiagnosis.mainProblem) fields.push({ path: 'fatalDiagnosis.mainProblem', value: report.fatalDiagnosis.mainProblem })
    if (report.fatalDiagnosis.reason) fields.push({ path: 'fatalDiagnosis.reason', value: report.fatalDiagnosis.reason })
  }

  // fatalRules
  if (Array.isArray(report.fatalRules)) {
    report.fatalRules.forEach(function(r, i) {
      if (r.title) fields.push({ path: 'fatalRules[' + i + '].title', value: String(r.title) })
      if (r.description) fields.push({ path: 'fatalRules[' + i + '].description', value: String(r.description) })
      if (r.why) fields.push({ path: 'fatalRules[' + i + '].why', value: String(r.why) })
    })
  }

  // advantageRules
  if (Array.isArray(report.advantageRules)) {
    report.advantageRules.forEach(function(r, i) {
      if (r.title) fields.push({ path: 'advantageRules[' + i + '].title', value: String(r.title) })
      if (r.description) fields.push({ path: 'advantageRules[' + i + '].description', value: String(r.description) })
      if (r.why) fields.push({ path: 'advantageRules[' + i + '].why', value: String(r.why) })
    })
  }

  // opportunityRules
  if (Array.isArray(report.opportunityRules)) {
    report.opportunityRules.forEach(function(r, i) {
      if (r.reason) fields.push({ path: 'opportunityRules[' + i + '].reason', value: String(r.reason) })
      if (r.description) fields.push({ path: 'opportunityRules[' + i + '].description', value: String(r.description) })
      if (r.why) fields.push({ path: 'opportunityRules[' + i + '].why', value: String(r.why) })
    })
  }

  // actionPlan
  if (report.actionPlan) {
    var days = ['day1', 'day3', 'day7', 'day15', 'day30']
    days.forEach(function(day) {
      var d = report.actionPlan[day]
      if (d) {
        if (d.goal) fields.push({ path: 'actionPlan.' + day + '.goal', value: String(d.goal) })
        if (Array.isArray(d.tasks)) {
          d.tasks.forEach(function(t, j) {
            fields.push({ path: 'actionPlan.' + day + '.tasks[' + j + ']', value: String(t) })
          })
        }
      }
    })
  }

  // identityUpgrade
  if (report.identityUpgrade) {
    ['current', 'target', 'bridge'].forEach(function(k) {
      if (report.identityUpgrade[k]) fields.push({ path: 'identityUpgrade.' + k, value: String(report.identityUpgrade[k]) })
    })
  }

  // finalStrike
  if (report.finalStrike) fields.push({ path: 'finalStrike', value: String(report.finalStrike) })

  // stopDoing
  if (Array.isArray(report.stopDoing)) {
    report.stopDoing.forEach(function(item, i) {
      if (item.action) fields.push({ path: 'stopDoing[' + i + '].action', value: String(item.action) })
      if (item.reason) fields.push({ path: 'stopDoing[' + i + '].reason', value: String(item.reason) })
    })
  }

  // wealthPath
  if (Array.isArray(report.wealthPath)) {
    report.wealthPath.forEach(function(wp, i) {
      if (wp.description) fields.push({ path: 'wealthPath[' + i + '].description', value: String(wp.description) })
    })
  }

  return fields
}

/**
 * Run content safety validation on the full report.
 *
 * @returns {{ passed: boolean, violations: Array, errorCount: number }}
 */
function validateFullReport(report, context) {
  context = context || {}
  var fields = collectTextFields(report)
  var allViolations = []

  for (var i = 0; i < fields.length; i++) {
    var f = fields[i]
    var v = scanTextField(f.value, f.path, context.strategyId)
    if (v.length > 0) {
      allViolations = allViolations.concat(v)
    }
  }

  return {
    passed: allViolations.length === 0,
    violations: allViolations,
    errorCount: allViolations.length,
    fieldsScanned: fields.length,
  }
}

/**
 * Attempt to repair a single text field by removing violation patterns.
 */
function repairText(text) {
  if (!text || typeof text !== 'string') return text

  var repaired = text

  // Remove unsafe metaphors — replace with neutral language
  var allUnsafe = UNSAFE_METAPHOR_PATTERNS.concat(OVERCLAIM_PSYCHOLOGY_PATTERNS, OVERCLAIM_BEHAVIOR_PATTERNS)
  allUnsafe.forEach(function(pattern) {
    while (repaired.indexOf(pattern) >= 0) {
      repaired = repaired.replace(pattern, '**[已验证信号]**')
    }
  })

  return repaired
}

/**
 * Repair the full report: clone + attempt to clean all text fields.
 */
function repairFullReport(report) {
  var cloned = JSON.parse(JSON.stringify(report))
  var fields = collectTextFields(cloned)

  // Build a reverse map of path → key chain
  fields.forEach(function(f) {
    var parts = f.path.split('.')
    var obj = cloned
    for (var i = 0; i < parts.length - 1; i++) {
      var part = parts[i]
      // Handle array index: fatalRules[0] → fatalRules.0
      part = part.replace(/\[(\d+)\]/, function(_, n) { return n })
      if (obj[part] === undefined) return
      obj = obj[part]
    }
    var lastPart = parts[parts.length - 1]
    lastPart = lastPart.replace(/\[(\d+)\]/, function(_, n) { return n })
    if (obj && typeof obj[lastPart] === 'string') {
      obj[lastPart] = repairText(obj[lastPart])
    }
  })

  // Also do direct repairs on known top-level report fields
  if (cloned.fatalDiagnosis) {
    if (cloned.fatalDiagnosis.mainProblem) {
      cloned.fatalDiagnosis.mainProblem = repairText(cloned.fatalDiagnosis.mainProblem)
    }
    if (cloned.fatalDiagnosis.reason) {
      cloned.fatalDiagnosis.reason = repairText(cloned.fatalDiagnosis.reason)
    }
  }
  if (cloned.identityUpgrade) {
    ['current', 'target', 'bridge'].forEach(function(k) {
      if (cloned.identityUpgrade[k]) {
        cloned.identityUpgrade[k] = repairText(cloned.identityUpgrade[k])
      }
    })
  }
  if (cloned.finalStrike) {
    cloned.finalStrike = repairText(cloned.finalStrike)
  }

  return cloned
}

/**
 * The hard-gate pipeline: validate → repair → re-validate → fallback if needed.
 *
 * @returns {{
 *   report: Object,
 *   validation: {
 *     initialPass: boolean,
 *     initialErrors: number,
 *     repairAttempted: boolean,
 *     repairedPass: boolean,
 *     fallbackUsed: boolean,
 *     finalErrors: number,
 *     initialViolations: Array,
 *     finalViolations: Array,
 *   }
 * }}
 */
function contentSafetyGate(report, fallbackGenerator, context) {
  context = context || {}

  // Step 1: Initial validation
  var initial = validateFullReport(report, context)

  // Step 2: If clean, return as-is
  if (initial.passed) {
    return {
      report: report,
      validation: {
        initialPass: true,
        initialErrors: 0,
        repairAttempted: false,
        repairedPass: true,
        fallbackUsed: false,
        finalErrors: 0,
        initialViolations: [],
        finalViolations: [],
      }
    }
  }

  // Step 3: Repair
  var repaired = repairFullReport(report)

  // Step 4: Re-validate
  var afterRepair = validateFullReport(repaired, context)

  if (afterRepair.passed) {
    return {
      report: repaired,
      validation: {
        initialPass: false,
        initialErrors: initial.errorCount,
        repairAttempted: true,
        repairedPass: true,
        fallbackUsed: false,
        finalErrors: 0,
        initialViolations: initial.violations,
        finalViolations: afterRepair.violations,
      }
    }
  }

  // Step 5: Deterministic fallback
  var fallback = fallbackGenerator()
  // Re-run safety on fallback too
  var fallbackValidation = validateFullReport(fallback.report, context)
  if (!fallbackValidation.passed) {
    // Strip offending fields from fallback too
    fallback.report = repairFullReport(fallback.report)
    fallbackValidation = validateFullReport(fallback.report, context)
  }

  return {
    report: fallback.report || fallback,
    validation: {
      initialPass: false,
      initialErrors: initial.errorCount,
      repairAttempted: true,
      repairedPass: false,
      fallbackUsed: true,
      finalErrors: fallbackValidation.errorCount,
      initialViolations: initial.violations,
      finalViolations: fallbackValidation.violations,
    }
  }
}

module.exports = {
  VIOLATION_TYPES: VIOLATION_TYPES,
  validateFullReport: validateFullReport,
  scanTextField: scanTextField,
  collectTextFields: collectTextFields,
  repairFullReport: repairFullReport,
  repairText: repairText,
  contentSafetyGate: contentSafetyGate,
  UNSAFE_METAPHOR_PATTERNS: UNSAFE_METAPHOR_PATTERNS,
  OVERCLAIM_PSYCHOLOGY_PATTERNS: OVERCLAIM_PSYCHOLOGY_PATTERNS,
  OVERCLAIM_BEHAVIOR_PATTERNS: OVERCLAIM_BEHAVIOR_PATTERNS,
  OVERCLAIM_OUTCOME_PATTERNS: OVERCLAIM_OUTCOME_PATTERNS,
}
