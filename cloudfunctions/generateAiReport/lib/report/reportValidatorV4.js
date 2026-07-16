/**
 * report/reportValidatorV4.js
 *
 * 报告验证器。
 * 检查 Report Contract 所有 13 个 section 的完整性。
 * 任何字段缺失 → throw Error，禁止进入 AI Prompt。
 */

const { REPORT_SECTIONS, WEALTH_STAGES, HEADLINE_EMOTIONS, SEVERITY_RANGE, ACTION_PLAN_DAYS } = require('./reportTypes')

/**
 * @param {Object} contract — createReportContract 返回的完整 contract
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validate(contract) {
  const errors = []

  // ── Top-level ──
  if (!contract || typeof contract !== 'object') {
    errors.push('contract is null or not an object')
    return { valid: false, errors }
  }

  if (contract.version !== 'v4') errors.push('contract.version must be "v4"')
  if (!contract.reportId || typeof contract.reportId !== 'string') errors.push('contract.reportId is required')
  if (!contract.generatedAt) errors.push('contract.generatedAt is required')
  if (!contract.engineVersion) errors.push('contract.engineVersion is required')
  if (!contract.diagnosticVersion) errors.push('contract.diagnosticVersion is required')

  // ── report object ──
  const report = contract.report
  if (!report || typeof report !== 'object') {
    errors.push('contract.report is null or not an object')
    return { valid: false, errors }
  }

  // ── 1. headline ──
  if (!report.headline) {
    errors.push('report.headline is missing')
  } else {
    const h = report.headline
    if (!h.title || typeof h.title !== 'string') errors.push('report.headline.title is missing or invalid')
    if (!h.subtitle || typeof h.subtitle !== 'string') errors.push('report.headline.subtitle is missing or invalid')
    if (!HEADLINE_EMOTIONS.includes(h.emotion)) {
      errors.push(`report.headline.emotion must be one of: ${HEADLINE_EMOTIONS.join(', ')}; got "${h.emotion}"`)
    }
    if (typeof h.severity !== 'number' || h.severity < SEVERITY_RANGE.min || h.severity > SEVERITY_RANGE.max) {
      errors.push(`report.headline.severity must be in [${SEVERITY_RANGE.min},${SEVERITY_RANGE.max}]; got ${h.severity}`)
    }
  }

  // ── 2. wealthStage ──
  if (!WEALTH_STAGES.includes(report.wealthStage)) {
    errors.push(`report.wealthStage must be one of: ${WEALTH_STAGES.join(', ')}; got "${report.wealthStage}"`)
  }

  // ── 3. fatalDiagnosis ──
  if (report.fatalDiagnosis !== null && report.fatalDiagnosis !== undefined) {
    const fd = report.fatalDiagnosis
    if (!fd.mainProblem) errors.push('fatalDiagnosis.mainProblem is missing')
    if (!fd.reason) errors.push('fatalDiagnosis.reason is missing')
    if (!Array.isArray(fd.matchedRuleIds)) errors.push('fatalDiagnosis.matchedRuleIds must be an array')
    if (typeof fd.severity !== 'number') errors.push('fatalDiagnosis.severity must be a number')
    if (typeof fd.confidence !== 'number') errors.push('fatalDiagnosis.confidence must be a number')
  }

  // ── 4. fatalRules ──
  if (!Array.isArray(report.fatalRules)) {
    errors.push('report.fatalRules must be an array')
  } else {
    for (let i = 0; i < report.fatalRules.length; i++) {
      const fr = report.fatalRules[i]
      if (!fr.ruleId) errors.push(`fatalRules[${i}].ruleId is missing`)
      if (!fr.title) errors.push(`fatalRules[${i}].title is missing`)
      if (!fr.description) errors.push(`fatalRules[${i}].description is missing`)
      if (typeof fr.weight !== 'number') errors.push(`fatalRules[${i}].weight must be a number`)
      if (!fr.why) errors.push(`fatalRules[${i}].why is missing`)
    }
    if (report.fatalRules.length > 3) {
      errors.push(`fatalRules must have max 3 items; got ${report.fatalRules.length}`)
    }
  }

  // ── 5. advantageRules ──
  if (!Array.isArray(report.advantageRules)) {
    errors.push('report.advantageRules must be an array')
  } else {
    for (let i = 0; i < report.advantageRules.length; i++) {
      const ar = report.advantageRules[i]
      if (!ar.ruleId) errors.push(`advantageRules[${i}].ruleId is missing`)
      if (!ar.title) errors.push(`advantageRules[${i}].title is missing`)
      if (!ar.description) errors.push(`advantageRules[${i}].description is missing`)
      if (typeof ar.weight !== 'number') errors.push(`advantageRules[${i}].weight must be a number`)
      if (!ar.why) errors.push(`advantageRules[${i}].why is missing`)
    }
    if (report.advantageRules.length > 3) {
      errors.push(`advantageRules must have max 3 items; got ${report.advantageRules.length}`)
    }
  }

  // ── 6. opportunityRules ──
  if (!Array.isArray(report.opportunityRules)) {
    errors.push('report.opportunityRules must be an array')
  } else {
    for (let i = 0; i < report.opportunityRules.length; i++) {
      const o = report.opportunityRules[i]
      if (!o.area) errors.push(`opportunityRules[${i}].area is missing`)
    }
    if (report.opportunityRules.length > 5) {
      errors.push(`opportunityRules must have max 5 items; got ${report.opportunityRules.length}`)
    }
  }

  // ── 7. scoreCard ──
  if (!report.scoreCard) {
    errors.push('report.scoreCard is missing')
  } else {
    const requiredScores = ['cashflow', 'skill', 'execution', 'time', 'risk', 'overall']
    for (const key of requiredScores) {
      if (typeof report.scoreCard[key] !== 'number' || report.scoreCard[key] < 0 || report.scoreCard[key] > 100) {
        errors.push(`report.scoreCard.${key} must be a number in [0,100]; got ${report.scoreCard[key]}`)
      }
    }
  }

  // ── 8. wealthProbability ──
  if (!report.wealthProbability) {
    errors.push('report.wealthProbability is missing')
  } else {
    const wp = report.wealthProbability
    for (const key of ['today', 'after30', 'after90', 'after365']) {
      if (typeof wp[key] !== 'number') errors.push(`wealthProbability.${key} is missing or not a number`)
      else if (wp[key] < 0 || wp[key] > 100) errors.push(`wealthProbability.${key} must be in [0,100]; got ${wp[key]}`)
    }
    if (wp.after90 < wp.after30) errors.push('wealthProbability.after90 should be >= after30')
    if (wp.after365 < wp.after90) errors.push('wealthProbability.after365 should be >= after90')
  }

  // ── 9. wealthPath ──
  if (!report.wealthPath) {
    errors.push('report.wealthPath is missing')
  } else if (!Array.isArray(report.wealthPath)) {
    errors.push('report.wealthPath must be an array')
  } else {
    const pathNames = report.wealthPath.map(p => p.name)
    const expected = ['working', 'sideBusiness', 'freelance', 'investment', 'content', 'ai', 'entrepreneur']
    for (const p of expected) {
      if (!pathNames.includes(p)) errors.push(`wealthPath missing entry: ${p}`)
    }
    for (const p of report.wealthPath) {
      if (typeof p.score !== 'number' || p.score < 0 || p.score > 100) {
        errors.push(`wealthPath.${p.name}.score must be in [0,100]; got ${p.score}`)
      }
      const validRecs = ['highly_recommended', 'recommended', 'neutral', 'not_recommended']
      if (!validRecs.includes(p.recommend)) {
        errors.push(`wealthPath.${p.name}.recommend must be one of: ${validRecs.join(', ')}; got "${p.recommend}"`)
      }
    }
  }

  // ── 10. actionPlan ──
  if (!report.actionPlan) {
    errors.push('report.actionPlan is missing')
  } else {
    for (const day of ACTION_PLAN_DAYS) {
      const d = report.actionPlan[day]
      if (!d) {
        errors.push(`actionPlan.${day} is missing`)
        continue
      }
      if (!d.goal) errors.push(`actionPlan.${day}.goal is missing`)
      if (!Array.isArray(d.tasks) || d.tasks.length === 0) errors.push(`actionPlan.${day}.tasks must be a non-empty array`)
      if (!d.checkpoint) errors.push(`actionPlan.${day}.checkpoint is missing`)
    }
  }

  // ── 11. stopDoing ──
  if (!report.stopDoing) {
    errors.push('report.stopDoing is missing')
  } else {
    if (typeof report.stopDoing.priority !== 'number') errors.push('stopDoing.priority must be a number')
    if (!Array.isArray(report.stopDoing.items) || report.stopDoing.items.length === 0) {
      errors.push('stopDoing.items must be a non-empty array')
    }
  }

  // ── 12. identityUpgrade ──
  if (!report.identityUpgrade) {
    errors.push('report.identityUpgrade is missing')
  } else {
    const iu = report.identityUpgrade
    if (!iu.currentIdentity) errors.push('identityUpgrade.currentIdentity is missing')
    if (!iu.targetIdentity) errors.push('identityUpgrade.targetIdentity is missing')
    if (!iu.gap) errors.push('identityUpgrade.gap is missing')
    if (!iu.upgradePath) errors.push('identityUpgrade.upgradePath is missing')
  }

  // ── 13. finalStrike ──
  if (!report.finalStrike) {
    errors.push('report.finalStrike is missing')
  } else {
    const fs = report.finalStrike
    if (!fs.sentence) errors.push('finalStrike.sentence is missing')
    if (!fs.emotion) errors.push('finalStrike.emotion is missing')
    if (!fs.shareTitle) errors.push('finalStrike.shareTitle is missing')
  }

  // ── 额外字段检测（禁止扩展）──
  const allowedTopLevel = ['headline', 'wealthStage', 'fatalDiagnosis', 'fatalRules',
    'advantageRules', 'opportunityRules', 'scoreCard', 'wealthProbability',
    'wealthPath', 'actionPlan', 'stopDoing', 'identityUpgrade', 'finalStrike']
  const extraKeys = Object.keys(report).filter(k => !allowedTopLevel.includes(k))
  if (extraKeys.length > 0) {
    errors.push(`report has extra keys not allowed by contract: ${extraKeys.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * 快速断言：无效则 throw
 */
function assertValid(contract) {
  const result = validate(contract)
  if (!result.valid) {
    throw new Error(`V4 Report Contract validation failed:\n  - ${result.errors.join('\n  - ')}`)
  }
  return true
}

module.exports = { validate, assertValid }
