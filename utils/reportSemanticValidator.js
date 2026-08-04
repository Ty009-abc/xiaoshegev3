/**
 * utils/reportSemanticValidator.js — RC6.0 Semantic Validator
 *
 * 职责：验证报告海报数据（posterData）的语义完整性。
 * 确保 destinySimulator 和 cognitiveVerdict 字段完整且有内容差异。
 *
 * @version RC6.0_DESTINY_ENGINE
 */
'use strict'

/* ═══════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════ */

/**
 * validatePosterSemantics(pd)
 *
 * @param {Object} pd — posterData (from mapDiagnosticV4ToPoster or equivalent)
 * @returns {{ errors: string[], warnings: string[], scores: Object, passed: boolean }}
 */
function validatePosterSemantics(pd) {
  var errors = []
  var warnings = []
  var scores = {}

  // G0: Verdict ≠ Decision
  var verdictText = ((pd.verdict || {}).headline || '').trim()
  var decisionTitle = ((pd.decision || {}).title || '').trim()
  if (verdictText && decisionTitle) {
    if (verdictText === decisionTitle) {
      errors.push('VERDICT_DECISION_DUPLICATE')
    }
  }

  // G1: Verdict
  if (!pd.verdict || !pd.verdict.headline) {
    errors.push('VERDICT_MISSING')
  } else {
    scores.verdict = 1
  }

  // G2: Contradiction
  if (!pd.contradiction || !pd.contradiction.title) {
    errors.push('CONTRADICTION_MISSING')
  } else {
    scores.contradiction = 1
  }

  // G3: destinySimulator
  validateDestinySimulator(pd, errors, warnings, scores)

  // G4: Decision
  if (!pd.decision || !pd.decision.title) {
    errors.push('DECISION_MISSING')
  } else {
    scores.decision = 1
  }

  // G5: Action
  if (!pd.primaryAction || !pd.primaryAction.title) {
    errors.push('ACTION_MISSING')
  } else {
    scores.action = 1
  }

  // G6: cognitiveVerdict
  validateCognitiveVerdict(pd, errors, warnings, scores)

  // Aggregate
  var totalScore = Object.keys(scores).reduce(function(sum, k) { return sum + (scores[k] || 0) }, 0)
  return {
    errors: errors,
    warnings: warnings,
    scores: scores,
    passed: errors.length === 0,
    totalScore: totalScore,
  }
}

/* ═══════════════════════════════════════════════════════════════
   Destiny Simulator Validation
   ═══════════════════════════════════════════════════════════════ */

function validateDestinySimulator(pd, errors, warnings, scores) {
  var ds = pd.destinySimulator

  if (!ds) {
    errors.push('DESTINY_SIMULATOR_MISSING')
    scores.destinySimulator = 0
    return
  }

  var dsPass = true

  // currentIndex
  if (typeof ds.currentIndex !== 'number' || ds.currentIndex < 0 || ds.currentIndex > 100) {
    errors.push('DESTINY_CURRENT_INDEX_INVALID')
    dsPass = false
  }

  // level
  var validLevels = ['very_high', 'high', 'medium', 'low', 'very_low']
  if (!ds.currentLevel || validLevels.indexOf(ds.currentLevel) === -1) {
    errors.push('DESTINY_LEVEL_INVALID: ' + ds.currentLevel)
    dsPass = false
  }

  // baselinePath
  if (!ds.baselinePath || !ds.baselinePath.title) {
    errors.push('DESTINY_BASELINE_PATH_MISSING')
    dsPass = false
  }

  // actionPath
  if (!ds.actionPath || !ds.actionPath.title) {
    errors.push('DESTINY_ACTION_PATH_MISSING')
    dsPass = false
  }

  // projectedIndex ≥ currentIndex
  if (ds.actionPath && typeof ds.actionPath.projectedIndex === 'number') {
    var projected = ds.actionPath.projectedIndex
    var current = ds.currentIndex
    if (projected < current) {
      errors.push('DESTINY_PROJECTED_INDEX_INVALID: projected ' + projected + ' < current ' + current)
      dsPass = false
    }
  }

  // repairCycleDays range
  if (!ds.repairCycleDays || ds.repairCycleDays < 30 || ds.repairCycleDays > 180) {
    errors.push('DESTINY_REPAIR_CYCLE_INVALID: ' + ds.repairCycleDays)
    dsPass = false
  }

  // turningPoints ≥ 3
  if (!ds.turningPoints || ds.turningPoints.length < 3) {
    errors.push('DESTINY_TURNING_POINTS_EMPTY')
    dsPass = false
  }

  // keyVariable non-empty
  if (!ds.keyVariable || ds.keyVariable.trim() === '') {
    errors.push('DESTINY_KEY_VARIABLE_EMPTY')
    dsPass = false
  }

  // path duplicate
  if (ds.baselinePath && ds.actionPath) {
    var baseOutcome = normalizeText(ds.baselinePath.outcome || '')
    var actionOutcome = normalizeText(ds.actionPath.outcome || '')
    if (baseOutcome.length > 5 && baseOutcome === actionOutcome) {
      errors.push('DESTINY_PATH_DUPLICATE')
      dsPass = false
    }
  }

  scores.destinySimulator = dsPass ? 1 : 0
}

/* ═══════════════════════════════════════════════════════════════
   Cognitive Verdict Validation
   ═══════════════════════════════════════════════════════════════ */

var FORBIDDEN_SLOGANS = [
  '相信自己', '未来可期', '坚持就是胜利', '努力终有回报',
  '你是最棒的', '一定会成功', '东山再起', '前程似锦',
]

function validateCognitiveVerdict(pd, errors, warnings, scores) {
  var cv = pd.cognitiveVerdict

  if (!cv) {
    errors.push('COGNITIVE_VERDICT_MISSING')
    scores.cognitiveVerdict = 0
    return
  }

  var cvPass = true

  // statement
  if (!cv.statement || cv.statement.trim() === '') {
    errors.push('COGNITIVE_VERDICT_EMPTY')
    cvPass = false
  }

  // explanation
  if (!cv.explanation || cv.explanation.trim() === '') {
    errors.push('COGNITIVE_VERDICT_EMPTY')
    cvPass = false
  }

  // actionAnchor
  if (!cv.actionAnchor || cv.actionAnchor.trim() === '') {
    errors.push('COGNITIVE_ACTION_ANCHOR_EMPTY')
    cvPass = false
  }

  // too generic
  for (var i = 0; i < FORBIDDEN_SLOGANS.length; i++) {
    var s = FORBIDDEN_SLOGANS[i]
    if ((cv.statement || '').indexOf(s) !== -1 || (cv.explanation || '').indexOf(s) !== -1) {
      errors.push('COGNITIVE_VERDICT_TOO_GENERIC: ' + s)
      cvPass = false
      break
    }
  }

  // duplicate with other fields
  var cvText = normalizeText((cv.statement || '') + (cv.explanation || ''))
  var otherFields = [
    pd.verdict && pd.verdict.headline,
    pd.contradiction && pd.contradiction.title,
    pd.decision && pd.decision.title,
    pd.primaryAction && pd.primaryAction.title,
    pd.destinySimulator && pd.destinySimulator.baselinePath && pd.destinySimulator.baselinePath.outcome,
    pd.destinySimulator && pd.destinySimulator.actionPath && pd.destinySimulator.actionPath.outcome,
  ]

  for (var j = 0; j < otherFields.length; j++) {
    var of = normalizeText(otherFields[j] || '')
    if (of.length > 8 && cvText.indexOf(of) !== -1) {
      errors.push('COGNITIVE_VERDICT_DUPLICATE: shares content with ' + j)
      cvPass = false
      break
    }
  }

  scores.cognitiveVerdict = cvPass ? 1 : 0
}

/* ═══════════════════════════════════════════════════════════════
   Utility
   ═══════════════════════════════════════════════════════════════ */

function normalizeText(text) {
  if (!text) return ''
  return String(text)
    .replace(/[\s\u3000，。！？,.!?、：；（）()《》"" ''\u2018\u2019\u201c\u201d_-]/g, '')
    .toLowerCase()
}

/* ═══════════════════════════════════════════════════════════════
   Export
   ═══════════════════════════════════════════════════════════════ */

module.exports = {
  validatePosterSemantics,
}
