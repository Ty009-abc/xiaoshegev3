'use strict'
/**
 * turnaroundStrategy/v6/report/reportValidatorV6.js
 *
 * Consumer-layer validation for the V6 five-card report.
 * Checks: report shape, forbidden ontology leakage, card01 length target,
 * provenance completeness.
 * CONSUMER LAYER ONLY. Deterministic. No AI.
 */

// Internal vocabulary that must NEVER surface in user-visible copy.
const FORBIDDEN_USER_TOKENS = [
  'DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP', 'VALIDATION_GAP', 'REPEATABILITY_GAP',
  'BELIEF_MATCH', 'BELIEF_PARTIAL', 'BELIEF_REALITY_GAP',
  'THINKING', 'RESEARCHING', 'LEARNING', 'STARTED', 'TESTING', 'EARLY_TRACTION', 'STABLE_TRACTION',
  '世界模型', 'world model', '盲区', 'blind spot', '认知维度', '模型候选',
  'Primary', 'primary', 'MULTIPLE', 'UNIQUE', 'evidence strength',
  'rule id', 'RC84V6', 'CASHFLOW_SAFE_EXPERIMENT', 'SMALLEST_EXTERNAL_TEST', 'BUYER_FEEDBACK_COLLECTION',
  'REPEAT_SUCCESS_PATH', 'DIRECTION_NARROWING', 'CONSISTENCY_PROTECTION',
  'CASHFLOW_PRESSURE', 'LOW_SURPLUS', 'UNSTABLE_INCOME', 'TIME_PRESSURE_POSSIBLE', 'FAMILY_ENVIRONMENT_CONSTRAINT'
]

const CARD_KEYS = ['fatalInsight', 'coreProblem', 'systemLoop', 'turnaroundPath', 'firstAction']
const CARD01_MAX_CHARS = 60

/** Collect all user-visible text from a report. */
function visibleText (report) {
  if (!report || !report.cards) return ''
  const c = report.cards
  const parts = [
    c.fatalInsight && c.fatalInsight.text,
    c.coreProblem && c.coreProblem.text,
    c.systemLoop && (c.systemLoop.steps || []).join(' '),
    c.turnaroundPath && c.turnaroundPath.text,
    c.firstAction && c.firstAction.text
  ]
  return parts.filter(Boolean).join('\n')
}

/**
 * Validate a report. Returns a findings object.
 */
function validateReportV6 (report) {
  const findings = {
    hasAllCards: false,
    cardCount: 0,
    forbiddenTokens: [],
    card01OverLength: false,
    provenanceComplete: false,
    invalidShape: false
  }

  if (!report || typeof report !== 'object') {
    findings.invalidShape = true
    return findings
  }

  if (report.reportState === 'INVALID_INPUT') {
    findings.cardCount = 0
    return findings
  }

  const c = report.cards
  if (!c) { findings.invalidShape = true; return findings }

  let count = 0
  for (const k of CARD_KEYS) if (c[k]) count++
  findings.cardCount = count
  findings.hasAllCards = count === 5

  const text = visibleText(report)
  for (const tok of FORBIDDEN_USER_TOKENS) {
    if (text.includes(tok)) findings.forbiddenTokens.push(tok)
  }

  if (c.fatalInsight && c.fatalInsight.text &&
      [...c.fatalInsight.text].length > CARD01_MAX_CHARS) {
    findings.card01OverLength = true
  }

  findings.provenanceComplete = CARD_KEYS.every(k =>
    c[k] && c[k].provenance && Array.isArray(c[k].provenance.sourceQuestionIds))

  return findings
}

module.exports = { validateReportV6, visibleText, FORBIDDEN_USER_TOKENS, CARD_KEYS, CARD01_MAX_CHARS }
