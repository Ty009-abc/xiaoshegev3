/**
 * contracts/report/turnaroundReportV4.contract.js
 *
 * V4 翻身报告契约 — 定义 Report Contract 的完整校验规则。
 * 所有字段必须存在、类型正确、值在有效范围内。
 */

const REQUIRED_REPORT_FIELDS = [
  'version',
  'generatedAt',
  'reportId',
  'engineVersion',
  'diagnosticVersion',
  'report',
]

const REQUIRED_REPORT_SECTIONS = [
  'headline',
  'wealthStage',
  'fatalDiagnosis',
  'fatalRules',
  'advantageRules',
  'opportunityRules',
  'scoreCard',
  'wealthProbability',
  'wealthPath',
  'actionPlan',
  'stopDoing',
  'identityUpgrade',
  'finalStrike',
]

const CONTRADICTION_REQUIRED = ['code', 'title', 'description']

const DECISION_REQUIRED = ['code', 'title', 'reason']

const POTENTIAL_REQUIRED = ['score', 'level', 'advantages', 'constraints']

const PRIMARY_ACTION_REQUIRED = ['title', 'checkpoint', 'successCriteria']

/**
 * Validator 统一返回结构:
 * { ok: boolean, errors: string[], warnings: string[], metadata: object }
 */
function createValidationResult() {
  return { ok: true, errors: [], warnings: [], metadata: {} }
}

/**
 * 校验完整的 Report Contract
 */
function validateReportContract(report) {
  const r = createValidationResult()

  if (!report || typeof report !== 'object') {
    r.ok = false
    r.errors.push('CONTRACT: report is null or not an object')
    return r
  }

  // 1. Top-level fields
  for (const f of REQUIRED_REPORT_FIELDS) {
    if (report[f] === undefined || report[f] === null) {
      r.errors.push(`CONTRACT: missing top-level field "${f}"`)
    }
  }
  if (report.version !== 'v4') {
    r.warnings.push(`CONTRACT: expected version "v4", got "${report.version}"`)
  }
  r.metadata.reportId = report.reportId || 'unknown'
  r.metadata.version = report.version || 'unknown'

  // 2. Report sections
  const rep = report.report
  if (!rep || typeof rep !== 'object') {
    r.ok = false
    r.errors.push('CONTRACT: report.content is null or not an object')
    return r
  }

  for (const s of REQUIRED_REPORT_SECTIONS) {
    if (rep[s] === undefined) {
      r.errors.push(`CONTRACT: missing report section "${s}"`)
    }
  }

  // 3. Verdict
  if (rep.fatalDiagnosis) {
    const fd = rep.fatalDiagnosis
    if (typeof (fd.headline || fd.mainProblem || "") !== "string" || (fd.headline || fd.mainProblem || "").trim() === '') {
      r.errors.push('CONTRACT: verdict (headline|mainProblem) must be a non-empty string')
    }
  }

  // 4. ScoreCard
  if (rep.scoreCard) {
    const sc = rep.scoreCard
    const dims = ['cashflow', 'skill', 'execution', 'time', 'risk', 'overall']
    for (const d of dims) {
      if (typeof sc[d] !== 'number' || sc[d] < 0 || sc[d] > 100) {
        r.errors.push(`CONTRACT: scoreCard.${d} must be a number 0-100`)
      }
    }
    r.metadata.overall = sc.overall
  }

  // 5. WealthProbability
  if (rep.wealthProbability) {
    const wp = rep.wealthProbability
    // Accept both formats: today/after30/after90/after365 (mapper) or current/in30Days/in90Days/in365Days (contract spec)
    const wpf = ['current', 'today', 'in30Days', 'after30', 'in90Days', 'after90', 'in365Days', 'after365']
    let hasValidWp = false
    if (typeof wp.current === 'number' || typeof wp.today === 'number') hasValidWp = true
    if ((typeof wp.in30Days === 'number' || typeof wp.after30 === 'number') &&
        (typeof wp.in90Days === 'number' || typeof wp.after90 === 'number') &&
        (typeof wp.in365Days === 'number' || typeof wp.after365 === 'number')) {
      // ok
    } else {
      r.errors.push('CONTRACT: wealthProbability missing day projections')
    }
    if (!hasValidWp) {
      r.warnings.push('CONTRACT: wealthProbability missing current/today value')
    }
  }

  // 6. Contradiction
  if (rep.contradiction) {
    const cc = rep.contradiction
    // Support both "description" and "desc" field names (mapper uses "desc" for brevity)
    const desc = cc.description || cc.desc
    if (!cc.code) r.errors.push('CONTRACT: contradiction missing "code"')
    if (!cc.title) r.errors.push('CONTRACT: contradiction missing "title"')
    if (!desc || (typeof desc === 'string' && desc.trim() === '')) {
      r.errors.push('CONTRACT: contradiction missing "description" (or desc)')
    }
    if (cc.code === 'FALLBACK') {
      r.warnings.push('CONTRACT: contradiction.code is FALLBACK — expected a specific code')
    }
  }

  // 7. Decision
  if (rep.decision) {
    const dc = rep.decision
    if (!dc.code && !dc.title) {
      r.warnings.push('CONTRACT: decision has no code and no title')
    }
    if (dc.code === 'COLLECT_MORE_EVIDENCE' && !dc.provisional) {
      r.warnings.push('CONTRACT: COLLECT_MORE_EVIDENCE should be provisional')
    }
  }

  // 8. Potential
  if (rep.potential) {
    const pt = rep.potential
    for (const f of POTENTIAL_REQUIRED) {
      if (pt[f] === undefined) {
        r.errors.push(`CONTRACT: potential missing "${f}"`)
      }
    }
    if (typeof pt.score !== 'number' || pt.score < 0 || pt.score > 100) {
      r.errors.push('CONTRACT: potential.score must be a number 0-100')
    }
    if (!Array.isArray(pt.advantages)) {
      r.errors.push('CONTRACT: potential.advantages must be an array')
    }
    if (!Array.isArray(pt.constraints)) {
      r.errors.push('CONTRACT: potential.constraints must be an array')
    }
  }

  // 9. PrimaryAction
  if (rep.primaryAction) {
    const pa = rep.primaryAction
    for (const f of PRIMARY_ACTION_REQUIRED) {
      if (!pa[f]) {
        r.errors.push(`CONTRACT: primaryAction missing "${f}"`)
      }
    }
    if (pa.title && typeof pa.title === 'string' && pa.title.trim() === '') {
      r.errors.push('CONTRACT: primaryAction.title is empty string')
    }
  }

  r.ok = r.errors.length === 0
  r.metadata.errorCount = r.errors.length
  r.metadata.warningCount = r.warnings.length
  return r
}

/**
 * 快速断言：报告是否为有效 V4 契约
 */
function assertValidReportContract(report) {
  const r = validateReportContract(report)
  if (!r.ok) {
    throw new Error(`Contract violation: ${r.errors.join('; ')}`)
  }
  return true
}

module.exports = {
  validateReportContract,
  assertValidReportContract,
  REQUIRED_REPORT_FIELDS,
  REQUIRED_REPORT_SECTIONS,
  CONTRADICTION_REQUIRED,
  DECISION_REQUIRED,
  POTENTIAL_REQUIRED,
  PRIMARY_ACTION_REQUIRED,
}
