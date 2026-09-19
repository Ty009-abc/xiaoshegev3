'use strict'
/**
 * turnaroundStrategy/v6/reasoning/caseReportPolishV1.js
 *
 * R87B2 §10 — CONTROLLED PROVIDER (max 1 call/report) — the ONLY surface where a
 * model may touch the visible text, and only to IMPROVE clarity / rhythm /
 * compression / sharpness.
 *
 * HARD RULES: the provider may NOT change
 *   primary contradiction · primary derived insight · switch class · experiment ·
 *   facts · claim level.
 *
 * Every provider-rewritten card string is validated against the deterministic
 * case report + claim ledger. On ANY violation the rewrite is REJECTED and the
 * deterministic text is kept (fail-closed). The provider never sees or emits
 * new facts.
 *
 * Deterministic. Pure. No AI. No I/O.
 */

const { auditVisibleClaims, FABRICATED_PSYCHOLOGY_TOKENS, TEMPORAL_TOKENS, EMPLOYMENT_OVERCLAIM_TOKENS } = require('./claimAuditV1.js')

const POLISH_VERSION = 'r87b2_case_report_polish_v1'
const MAX_PROVIDER_CALLS_PER_REPORT = 1

// a polish pass may only touch these CARD FIELDS (never ids / switch / ledger)
const POLISHABLE = Object.freeze(['card01', 'card02'])

function sameAnchorSet (a, b) {
  const A = new Set(a || [])
  const B = new Set(b || [])
  if (A.size !== B.size) return false
  for (const x of A) if (!B.has(x)) return false
  return true
}

/**
 * Validate a provider-rewritten report against the deterministic one.
 * @returns {Object} { ok, violations[] }
 */
function validateProviderOutput (deterministic, candidate, evidence) {
  const violations = []
  const d = deterministic || {}
  const c = candidate || {}
  if (c.contradictionId !== undefined && c.contradictionId !== d.contradictionId) violations.push('MUTATED_CONTRADICTION')
  if (c.switchClass !== undefined && c.switchClass !== d.switchClass) violations.push('MUTATED_SWITCH_CLASS')
  if (c.keyUnknown !== undefined && c.keyUnknown !== d.keyUnknown) violations.push('MUTATED_KEY_UNKNOWN')
  // experiment must be byte-identical (never re-authored by the provider)
  if (c.card05 && d.card05) {
    const de = [d.card05.goal, (d.card05.actions || []).join(''), d.card05.acceptance].join('|')
    const ce = [c.card05.goal, (c.card05.actions || []).join(''), c.card05.acceptance].join('|')
    if (de !== ce) violations.push('MUTATED_EXPERIMENT')
  }
  // claim level must not change per card
  if (c.card01Level && c.card01Level !== d.card01Level) violations.push('MUTATED_CLAIM_LEVEL')
  if (c.card02Level && c.card02Level !== d.card02Level) violations.push('MUTATED_CLAIM_LEVEL')
  // forbidden content in any rewritten visible text
  const blob = [c.card01, c.card02].filter((x) => typeof x === 'string').join(' ')
  if (FABRICATED_PSYCHOLOGY_TOKENS.some((t) => blob.indexOf(t) >= 0)) violations.push('INTRODUCED_PSYCHOLOGY')
  if (EMPLOYMENT_OVERCLAIM_TOKENS.some((t) => blob.indexOf(t) >= 0)) violations.push('INTRODUCED_EMPLOYMENT_OVERCLAIM')
  return { ok: violations.length === 0, violations: violations }
}

/**
 * Apply a bounded provider polish to the deterministic case report.
 * @param {Object} caseReport   deterministic buildCaseReportV1 output
 * @param {Object} evidence     RealityEvidenceV1 store
 * @param {Object} [provider]   { card01?, card02? } rewritten strings
 * @returns {Object} { caseReport, applied, rejected, violations, providerCalls }
 */
function polishCaseReport (caseReport, evidence, provider) {
  const det = caseReport || {}
  if (!provider || (provider.card01 === undefined && provider.card02 === undefined)) {
    return { caseReport: det, applied: false, rejected: [], violations: [], providerCalls: 0 }
  }
  const candidate = {
    contradictionId: det.contradictionId,
    switchClass: det.switchClass,
    keyUnknown: det.keyUnknown,
    card05: provider.card05 !== undefined ? provider.card05 : det.card05,
    card01: provider.card01 !== undefined ? provider.card01 : det.card01,
    card02: provider.card02 !== undefined ? provider.card02 : det.card02
  }
  const v = validateProviderOutput(det, candidate, evidence)
  if (!v.ok) {
    return { caseReport: det, applied: false, rejected: Object.keys(provider), violations: v.violations, providerCalls: 1 }
  }
  // semantic re-audit of the polished text against the ledger
  const polished = Object.assign({}, det, {
    card01: candidate.card01,
    card02: candidate.card02,
    claims: (det.claims || []).map((cl) => (cl.card === 'card01' || cl.card === 'card02') ? cl : cl)
  })
  const audit = auditVisibleClaims(polished, evidence)
  const bad = ['VISIBLE_CLAIM_WITHOUT_LEDGER_COUNT', 'UNSUPPORTED_SENTENCE_COUNT', 'FABRICATED_FACT_COUNT', 'FABRICATED_PSYCHOLOGY_COUNT', 'TEMPORAL_FACT_WITHOUT_SOURCE_COUNT', 'EMPLOYMENT_MECHANIC_OVERCLAIM_COUNT'].some((k) => audit[k] > 0)
  if (bad) {
    return { caseReport: det, applied: false, rejected: Object.keys(provider), violations: ['SEMANTIC_AUDIT_FAILED'], providerCalls: 1 }
  }
  return { caseReport: polished, applied: true, rejected: [], violations: [], providerCalls: 1 }
}

module.exports = { POLISH_VERSION, MAX_PROVIDER_CALLS_PER_REPORT, POLISHABLE, polishCaseReport, validateProviderOutput, sameAnchorSet }
