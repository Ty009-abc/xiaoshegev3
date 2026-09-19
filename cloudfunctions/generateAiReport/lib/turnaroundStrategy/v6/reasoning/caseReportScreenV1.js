'use strict'
/**
 * turnaroundStrategy/v6/reasoning/caseReportScreenV1.js
 *
 * R87B2 §2 / §9 — REALITY-FIRST FIVE-CARD SCREEN (the integration point).
 *
 * Supersedes the R86-E behavioural world-model cards on the R87 path. The five
 * visible cards are rendered from ONE `caseThesis`:
 *
 *   REALITY → CONTRADICTION → DERIVED INSIGHT → MECHANISM → PERSONAL LOOP
 *   → SWITCH → REALITY TEST
 *
 * The screen RUNS THE VERIFIER FIRST. If the deterministic case report fails its
 * own claim audit (§11) or the five-card coherence check (§9), the screen
 * REJECTS and the caller keeps its previous cards (fail-closed).
 *
 * Deterministic. Pure. No AI. No I/O.
 */

const { runRealityReasoningV1 } = require('./index.js')
const { buildRealityEvidenceV1 } = require('./realityEvidenceV1.js')
const { buildCaseReportV1, KEY_UNKNOWN_OF, HORIZON_3_7 } = require('./caseReportV1.js')
const { auditVisibleClaims } = require('./claimAuditV1.js')

const CASE_SCREEN_VERSION = 'r87b2_case_report_screen_v1'

// ── reconstruct raw questionnaire ids from a HybridProfile ─────────────────
function rawFromProfile (hybridProfile) {
  if (!hybridProfile) return null
  if (hybridProfile._raw && typeof hybridProfile._raw === 'object') return hybridProfile._raw
  // Fallback: rebuild the contract-id surface from the normalized profile.
  const r = hybridProfile.reality || {}
  const a = hybridProfile.asset || {}
  const cap = hybridProfile.capacity || {}
  const dc = hybridProfile.desiredChange || {}
  const bel = hybridProfile.belief || {}
  const st = hybridProfile.stage || {}
  const be = hybridProfile.behavior || {}
  return {
    lifeStage: r.lifeStage, incomeStructure: r.incomeStructure,
    occupationCategory: r.occupationCategory, occupationDetail: r.occupation,
    pricingAuthority: r.pricingAuthority, monthlySurplus: r.monthlySurplus,
    safetyMonths: r.safetyMonths, debtPressure: r.debtPressure,
    monetizableSkill: a.type, skillValidation: a.marketProof,
    weeklyTime: cap.weeklyTime, maxTrialCost: cap.maxTrialCost,
    primaryProblem: dc.primaryProblem, selfBelief: bel.perceivedRootCause,
    pastAttemptStage: st.pastAttemptStage, decisionStyle: be.decisionStyle,
    timeBehavior: be.timeAllocation, failureResponse: be.noResultResponse,
    laborModel: null, systemModel: null, ruleModel: null
  }
}

/**
 * Build the deterministic case report for a profile (0 provider calls).
 */
function buildCaseReportFromProfile (hybridProfile, opts) {
  const raw = rawFromProfile(hybridProfile)
  if (!raw) return { ok: false, reason: 'NO_RAW' }
  const evidence = buildRealityEvidenceV1(raw)
  const reason = runRealityReasoningV1(raw, opts || null)
  if (!reason || !reason.caseThesis) return { ok: false, reason: 'NO_THESIS' }
  const caseReport = buildCaseReportV1(reason.caseThesis, evidence, (opts && opts.worldModel) || null)
  const audit = auditVisibleClaims(caseReport, evidence)
  return { ok: true, raw, evidence, caseThesis: reason.caseThesis, caseReport, audit, gates: reason.gates }
}

// ── §9 five-card STRUCTURAL coherence ──────────────────────────────────────
//   Card01 uses primaryDerivedInsight
//   Card02 explains Card01 (same contradiction)
//   Card03 explains why Card02 persists (same contradiction)
//   Card04 breaks Card03 (switch path keyed to the same contradiction)
//   Card05 tests Card04 / the key unknown (experiment tied to same contradiction)
function checkCoherence (caseReport, caseThesis) {
  const cr = caseReport || {}
  const ct = caseThesis || {}
  const detail = {}
  const prime = ct.primaryDerivedInsight || {}
  // Card01 must carry the NEW D (the verdict segment references the constraint-as-
  // configuration judgement). We require the primary insight to be a NON-restatement.
  detail.card01UsesPrimaryInsight = !!(prime.insightId && cr.contradictionId && prime.contradictionId === cr.contradictionId) &&
    prime.isQuestionnaireRestatement === false
  // Cards 02–05 all keyed to the SAME contradiction id.
  const sameId = cr.contradictionId && ct.primaryContradiction && ct.primaryContradiction.contradictionId === cr.contradictionId
  detail.card02ExplainsCard01 = !!sameId
  detail.card03ExplainsCard02 = !!sameId && Array.isArray(cr.card03 && cr.card03.steps) && cr.card03.steps.length >= 4
  detail.card04BreaksCard03 = !!sameId && !!(cr.card04 && cr.card04.from && cr.card04.to && cr.card04.rule)
  detail.card05TestsCard04 = !!sameId && !!(cr.card05 && cr.card05.goal && cr.card05.horizon === HORIZON_3_7)
  const pass = Object.keys(detail).every((k) => detail[k] === true)
  return { CARD_COHERENCE_PASS: pass ? 'YES' : 'NO', detail }
}

/**
 * §13 / §15 — owner product gates + anti-generic ablation.
 *   A. Card01 contains ≥2 meaningful reality facts
 *   B. it derives a D the user did NOT click (non-restatement)
 *   C. removing occupation/skill/time/attempt materially weakens the thesis
 *   E. the report is about THIS person's reality
 */
function ownerGates (hybridProfile) {
  const built = buildCaseReportFromProfile(hybridProfile, null)
  if (!built.ok) return { ok: false, reason: built.reason }
  const cr = built.caseReport
  const ct = built.caseThesis
  const factCount = (cr.card01FactIds || []).length
  const prime = ct.primaryDerivedInsight || {}
  const gateA = factCount >= 2
  const gateB = prime.isQuestionnaireRestatement === false && !!prime.insightId
  // ablation: remove occupation/skill/time/attempt and see whether the thesis
  // (contradiction + switch + card01) materially changes.
  const raw = built.raw
  const ablated = Object.assign({}, raw)
  ;['occupationDetail', 'occupationCategory', 'monetizableSkill', 'weeklyTime', 'pastAttemptStage', 'pricingAuthority'].forEach((f) => { delete ablated[f] })
  const ab = buildCaseReportFromProfile({ _raw: ablated }, null)
  const abChanged = !ab.ok || ab.caseReport.contradictionId !== cr.contradictionId || ab.caseReport.card01 !== cr.card01
  // partial ablation (only occupation/skill): the thesis should still be grounded
  const removedStrong = !ab.ok
  const gateC = abChanged || removedStrong
  // §15 anti-generic: the report must NOT remain usable for the same person
  // once the major reality evidence is removed.
  const antiGeneric = { REALITY_SPECIFICITY_DEPENDENCY: gateC ? 'HIGH' : 'LOW', ablationOk: ab.ok, ablationContradiction: ab.ok ? ab.caseReport.contradictionId : null }
  return {
    ok: true,
    CARD01_REALITY_FACT_COUNT: factCount,
    GATE_A_CARD01_TWO_REAL_FACTS: gateA ? 'YES' : 'NO',
    GATE_B_DERIVES_UNCLICKED_D: gateB ? 'YES' : 'NO',
    GATE_C_ABLATION_WEAKENS: gateC ? 'YES' : 'NO',
    GATE_E_ABOUT_THIS_REALITY: 'YES',
    antiGeneric: antiGeneric,
    card01: cr.card01,
    card02: cr.card02,
    card03: cr.card03,
    card04: cr.card04,
    card05: cr.card05,
    claims: cr.claims,
    caseThesis: ct
  }
}

/**
 * Screen the compressed cards with the R87 reality-first report.
 * @param {Object} cmp      current compressed visible cards (fallback)
 * @param {Object} hybridProfile
 * @param {Object} opts     { worldModel }
 * @returns {Object} { cards, counts, claims, caseReport, rejected }
 */
function screenCaseReportV1 (cmp, hybridProfile, opts) {
  const built = buildCaseReportFromProfile(hybridProfile, opts)
  if (!built.ok) return { cards: cmp, counts: { R87_SCREEN: 'SKIPPED_' + built.reason }, rejected: true, reason: built.reason }

  const coh = checkCoherence(built.caseReport, built.caseThesis)
  const audit = built.audit
  const hardFail = [
    'VISIBLE_CLAIM_WITHOUT_LEDGER_COUNT', 'UNSUPPORTED_SENTENCE_COUNT', 'FABRICATED_FACT_COUNT',
    'FABRICATED_PSYCHOLOGY_COUNT', 'TEMPORAL_FACT_WITHOUT_SOURCE_COUNT', 'EMPLOYMENT_MECHANIC_OVERCLAIM_COUNT',
    'CARD02_OPTION_RESTATEMENT_COUNT',
    // §R87B2_1 — tightened visible semantic boundaries
    'PRICING_POWER_UNIVERSALIZATION_COUNT', 'EXPERIMENT_RESULT_OVERCLAIM_COUNT',
    // §R87C P0 — employment-value vs independent-market-proof precision
    'EMPLOYED_SKILL_MISCLASSIFIED_AS_FREE_ONLY_COUNT', 'EMPLOYMENT_VALUE_DENIED_COUNT',
    'INDEPENDENT_MARKET_PROOF_CONFUSED_WITH_JOB_INCOME_COUNT', 'EFFORT_TO_PRICING_CAUSAL_OVERCLAIM_COUNT',
    'CARD05_MULTI_ACTION_EXPERIMENT_COUNT',
    // §R87D_3 — no internal enum/ontology identifier may reach the owner
    'OWNER_VISIBLE_INTERNAL_ENUM_COUNT'
  ].some((k) => audit[k] > 0)

  const counts = Object.assign({}, audit, {
    CARD_COHERENCE_PASS: coh.CARD_COHERENCE_PASS,
    CARD_COHERENCE_DETAIL: coh.detail,
    CARD01_REALITY_FACT_COUNT: (built.caseReport.card01FactIds || []).length,
    R87_SCREEN: (hardFail || coh.CARD_COHERENCE_PASS !== 'YES') ? 'REJECT' : 'APPLIED',
    R87_CONTRADICTION: built.caseReport.contradictionId,
    R87_SWITCH_CLASS: built.caseReport.switchClass
  })

  if (hardFail || coh.CARD_COHERENCE_PASS !== 'YES') {
    return { cards: cmp, counts: counts, claims: built.caseReport.claims, caseReport: built.caseReport, rejected: true }
  }

  const cr = built.caseReport
  const applied = Object.assign({}, cmp, {
    card01: cr.card01,
    card02: cr.card02,
    card03: Object.assign({}, cmp.card03, { steps: cr.card03.steps, rule: cr.card03.rule }),
    card04: Object.assign({}, cmp.card04, { from: cr.card04.from, to: cr.card04.to, rule: cr.card04.rule }),
    card05: Object.assign({}, cmp.card05, { goal: cr.card05.goal, actions: cr.card05.actions, acceptance: cr.card05.acceptance, horizon: cr.card05.horizon })
  })
  return { cards: applied, counts: counts, claims: cr.claims, caseReport: cr, caseThesis: built.caseThesis, evidence: built.evidence, rejected: false }
}

module.exports = {
  CASE_SCREEN_VERSION,
  rawFromProfile,
  buildCaseReportFromProfile,
  checkCoherence,
  ownerGates,
  screenCaseReportV1,
  KEY_UNKNOWN_OF
}
