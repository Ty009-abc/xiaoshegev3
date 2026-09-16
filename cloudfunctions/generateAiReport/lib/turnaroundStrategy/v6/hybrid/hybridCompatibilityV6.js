'use strict'
/**
 * turnaroundStrategy/v6/hybrid/hybridCompatibilityV6.js
 *
 * RC8.4 V6 R48 — DETERMINISTIC PRE-REPORT EVIDENCE COMPATIBILITY GATE.
 * RC8.4 V6 R62 — CROSS-OBJECT FALSE-CONFLICT FIX (this revision).
 *
 * Root cause (R47), confirmed on real device (R61):
 *   V6 B1 execution/stage evidence (Q7 `pastAttemptStage`) and the Hybrid
 *   asset/proof evidence (Q5 `skillValidation`) are collected as two INDEPENDENT
 *   answers that describe DIFFERENT SEMANTIC OBJECTS:
 *       skillValidation   = CAPABILITY / ASSET MARKET PROOF
 *       pastAttemptStage  = PAST-YEAR ATTEMPT / EXECUTION HISTORY
 *   R48 compared them directly and (wrongly) emitted a HARD conflict. A user can
 *   truthfully answer both ("my capability earned once, ever" AND "my most
 *   recent attempt this year didn't sell") — so the hard conflict was a
 *   CROSS-OBJECT FALSE CONFLICT (R61: 3/3 reachable "conflicts" were dual-true).
 *
 * R62 FIX (surgical — do NOT delete evidence):
 *   - REMOVE contradiction authority for the cross-object pair.
 *   - PRESERVE both fields (B1 / HybridProfile / asset / envelope keep them).
 *   - Resolve a divergence by limiting the cross-axis STRATEGY scope to UNPROVEN
 *     (fail closed): the report may state the factual market position, but may
 *     not assume the proven capability IS the object of the current change.
 *   - Add a neutral, deterministic `crossObjectEvidencePattern` signal. It has
 *     ZERO B1 diagnosis authority — it only informs Thesis interpretation.
 *
 * HARD EVIDENCE CONFLICT is now reserved for rules that satisfy R62 §7:
 *   SAME semantic object + SAME relevant scope + MUTUALLY EXCLUSIVE claims
 *   + EXPLICIT binding. No current questionnaire rule qualifies, so
 *   UNBOUND_HARD_CONFLICT_RULE_COUNT = 0. The conflict machinery is preserved
 *   (defense-in-depth downstream + client UX) but is not reachable from today's
 *   question set.
 *
 * POSITION IN THE PIPELINE (frozen):
 *   HybridProfile -> V6 B1 diagnosis -> asset/proof normalization
 *     -> [THIS LAYER] -> five-card report generation
 *
 * AUTHORITY (frozen, non-negotiable):
 *   - ZERO authority to change the B1 diagnosis. It may ONLY:
 *       (a) allow the report,
 *       (b) limit cross-axis strategy use (scope = UNPROVEN),
 *       (c) stop report generation (verdict = EVIDENCE_CONFLICT) — reserved for
 *           an explicitly-bound, same-object, mutually-exclusive rule (none now).
 *   - It NEVER picks a winner between the two axes, NEVER repaints B1 wording,
 *     NEVER invents "old asset vs new offer", NEVER silently downgrades to
 *     another bottleneck.
 *
 * CONSUMER LAYER ONLY. Pure, deterministic, no AI, no I/O, no network.
 */

// ── R62 §2 — FROZEN SEMANTIC AUTHORITY ──────────────────────────────
// The two questionnaire fields describe INDEPENDENT objects and therefore have
// NO authority to hard-contradict each other.
const SEMANTIC_OBJECT = Object.freeze({
  skillValidation: 'CURRENT_MONETIZABLE_CAPABILITY', // CAPABILITY / ASSET MARKET PROOF
  pastAttemptStage: 'HISTORICAL_ATTEMPT'              // PAST-YEAR ATTEMPT / EXECUTION HISTORY
})

// Frozen B1 stage anchors, in optionId terms (from bottleneckEligibilityV6 Q6).
const STAGE_PAID_EVIDENCE_STAGES = ['EARLY_TRACTION', 'STABLE_TRACTION']
const STAGE_TESTING_ANCHOR = 'TESTING'

// The two user-visible questionnaire fields whose DIVERGENCE is cross-object
// (kept for review-screens metadata / diagnostics — NOT for hard conflict).
const CONFLICT_FIELDS = ['skillValidation', 'pastAttemptStage']
const CONFLICT_SCREENS = [5, 7]

const VERDICT_COMPATIBLE = 'COMPATIBLE'
const VERDICT_CONDITIONAL = 'CONDITIONALLY_COMPATIBLE'
const VERDICT_CONFLICT = 'EVIDENCE_CONFLICT'

const SCOPE_COMPATIBLE = 'COMPATIBLE'
const SCOPE_UNPROVEN = 'UNPROVEN'
const SCOPE_CONFLICT = 'CONFLICT'

// ── R62 §7/§8 — HARD CONFLICT RULES ─────────────────────────────────
// A rule may only fire when it binds the SAME semantic object with the SAME
// relevant scope and MUTUALLY EXCLUSIVE claims. The current questionnaire has
// NO such bound rule (skillValidation vs pastAttemptStage are different objects),
// so this list is EMPTY and UNBOUND_HARD_CONFLICT_RULE_COUNT = 0.
//
// Rule shape (for a future, explicitly-bound rule):
//   { id, fieldA, fieldB, semanticObject, explicitBinding:true, mutuallyExclusive:true }
const HARD_CONFLICT_RULES = []
const UNBOUND_HARD_CONFLICT_RULE_COUNT = 0

/**
 * R62 §5 — neutral deterministic cross-object evidence signal.
 * ZERO B1 diagnosis authority: derived from the two INDEPENDENT axes, it says
 * nothing about a bottleneck. It exists so the Thesis layer can interpret the
 * divergence WITHOUT collapsing the two objects into one claim.
 *
 * @param {{marketValidated?:boolean, executionStage?:string}} p
 * @returns {'PROVEN_CAPABILITY_RECENT_ATTEMPT_FAILED'|'UNPROVEN_CAPABILITY_PRIOR_SALE_EXPERIENCE'
 *   |'PROVEN_CAPABILITY_AND_SUCCESSFUL_ATTEMPT'|'NO_PROOF_AND_NO_SALE_HISTORY'|'NO_SIGNAL'|'UNKNOWN'}
 */
function crossObjectEvidencePattern (p) {
  const params = p || {}
  const mv = params.marketValidated
  const stage = params.executionStage || null
  const stagePaid = STAGE_PAID_EVIDENCE_STAGES.indexOf(stage) !== -1
  const stageTesting = stage === STAGE_TESTING_ANCHOR
  if (typeof mv !== 'boolean') return 'UNKNOWN'
  if (mv && stageTesting) return 'PROVEN_CAPABILITY_RECENT_ATTEMPT_FAILED'
  if (!mv && stagePaid) return 'UNPROVEN_CAPABILITY_PRIOR_SALE_EXPERIENCE'
  if (mv && stagePaid) return 'PROVEN_CAPABILITY_AND_SUCCESSFUL_ATTEMPT'
  if (!mv && stageTesting) return 'NO_PROOF_AND_NO_SALE_HISTORY'
  return 'NO_SIGNAL'
}

/**
 * The deterministic evidence-compatibility verdict for ONE diagnosis.
 *
 * @param {Object} p
 * @param {Object} p.diagnosis      V6 diagnosis (authority read-only)
 * @param {string} [p.executionStage] B1 stage anchor (optional; defaults to diagnosis)
 * @param {string} [p.assetState]   asset ladder state (optional)
 * @param {boolean} [p.marketValidated] asset axis paid flag (authority for proof)
 * @param {Object} [p.hybridProfile] HybridProfile (fallback source of stage/proof)
 * @returns {{
 *   verdict:string, crossAxisScope:string, conflictType:string|null,
 *   conflictingFields:string[], recommendedReviewScreens:number[],
 *   reasonCode:string|null, crossObjectEvidencePattern:string
 * }}
 */
function evaluateHybridEvidenceCompatibility (p) {
  const params = p || {}
  const diagnosis = params.diagnosis || null

  // No diagnosis, or a diagnosis that does NOT assert a primary bottleneck,
  // makes no cross-axis market claim -> always COMPATIBLE (never block).
  const state = (diagnosis && diagnosis.diagnosisState) || null
  const bottleneck = (diagnosis && diagnosis.primaryBottleneck) || null
  if (state !== 'PRIMARY' || !bottleneck) {
    return compatible('NO_PRIMARY_CLAIM', 'UNKNOWN')
  }

  // ── Read the TWO frozen evidence facts (never re-derive) ──
  const stage = params.executionStage ||
    (diagnosis && diagnosis.executionStage) || null

  let marketValidated = params.marketValidated
  if (typeof marketValidated !== 'boolean') {
    // Fallback: derive from the hybrid profile's raw proof option, using the
    // frozen asset ladder threshold (>= PAID_ONCE).
    const proof = params.hybridProfile && params.hybridProfile.asset
      ? params.hybridProfile.asset.marketProof : null
    marketValidated = ['PROOF_PAID_ONCE', 'PROOF_OCCASIONAL', 'PROOF_STABLE'].indexOf(proof) !== -1
  }

  const pattern = crossObjectEvidencePattern({ marketValidated, executionStage: stage })

  // ── R62 — EXPLICITLY-BOUND HARD CONFLICT (none today) ──
  // Only an explicitly-bound, same-object, mutually-exclusive rule may stop the
  // report. HARD_CONFLICT_RULES is empty -> this never fires.
  const bound = evaluateBoundHardConflict({ marketValidated, stage, bottleneck })
  if (bound) return bound

  // ── R62 — CROSS-OBJECT DIVERGENCE (was a false hard conflict) ──
  // skillValidation (capability proof) and pastAttemptStage (attempt stage) are
  // DIFFERENT objects. Their divergence is NOT a contradiction. Fail closed on
  // the STRATEGY link: scope = UNPROVEN (the report keeps the factual market
  // position but does not assert the proven capability IS the current path).
  const REPEATABILITY = 'REPEATABILITY_GAP'
  if (marketValidated && bottleneck !== REPEATABILITY) {
    // A paid capability + a bottleneck that is NOT about repeating that asset
    // -> cannot prove the paid asset is the object of the current gap.
    return conditional('PAID_ASSET_UNPROVEN_SCOPE', pattern)
  }
  if (!marketValidated && bottleneck === REPEATABILITY) {
    // A repeatability gap (prior success, from the ATTEMPT axis) + an UNPROVEN
    // capability axis -> cannot confirm they are the same object.
    return conditional('UNPROVEN_ASSET_VS_ATTEMPT_SUCCESS_SCOPE', pattern)
  }

  // ── COMPATIBLE: same-direction evidence (or a pre-payment stage + no proof). ──
  return compatible(null, pattern)
}

/**
 * Evaluate any EXPLICITLY-BOUND hard-conflict rules. Returns a conflict verdict
 * object, or null when no bound rule applies. With HARD_CONFLICT_RULES empty,
 * this is always null (UNBOUND_HARD_CONFLICT_RULE_COUNT = 0).
 */
function evaluateBoundHardConflict (facts) {
  for (const rule of HARD_CONFLICT_RULES) {
    if (!rule || !rule.explicitBinding || !rule.mutuallyExclusive) continue
    if (rule.semanticObjectA !== rule.semanticObjectB) continue
    // (No bound rule exists today; kept for architecture completeness.)
  }
  return null
}

function compatible (reasonCode, pattern) {
  return {
    verdict: VERDICT_COMPATIBLE,
    crossAxisScope: SCOPE_COMPATIBLE,
    conflictType: null,
    conflictingFields: [],
    recommendedReviewScreens: [],
    reasonCode: reasonCode || null,
    crossObjectEvidencePattern: pattern || 'UNKNOWN'
  }
}

function conditional (reasonCode, pattern) {
  return {
    verdict: VERDICT_CONDITIONAL,
    crossAxisScope: SCOPE_UNPROVEN,
    conflictType: null,
    conflictingFields: [],
    recommendedReviewScreens: [],
    reasonCode: reasonCode || null,
    crossObjectEvidencePattern: pattern || 'NO_SIGNAL'
  }
}

/**
 * HARD CONFLICT verdict — reserved for an explicitly-bound, same-object,
 * mutually-exclusive rule (R62 §7). Not reachable from the current
 * questionnaire. Kept so the downstream report-blocker + client UX remain
 * intact if a future bound rule is added.
 */
function conflict (reasonCode) {
  return {
    verdict: VERDICT_CONFLICT,
    crossAxisScope: SCOPE_CONFLICT,
    conflictType: 'MARKET_PROOF_VS_ATTEMPT_STAGE',
    conflictingFields: CONFLICT_FIELDS.slice(),
    recommendedReviewScreens: CONFLICT_SCREENS.slice(),
    reasonCode: reasonCode || null,
    crossObjectEvidencePattern: 'NO_SIGNAL'
  }
}

/**
 * Deterministic, non-directive user-facing conflict message (R48 §4).
 * Retained for the (now unreachable) bound-conflict path. It states that two
 * answers disagree; it NEVER says which one is correct.
 */
const CONFLICT_MESSAGE =
  '你前面的两处回答有点对不上：\n' +
  '一处显示这项能力还没有成交，\n' +
  '另一处显示你已经有过付费结果。\n' +
  '确认一下这两处后，我才能继续给你策略。'

module.exports = {
  evaluateHybridEvidenceCompatibility,
  crossObjectEvidencePattern,
  CONFLICT_MESSAGE,
  CONFLICT_FIELDS,
  CONFLICT_SCREENS,
  SEMANTIC_OBJECT,
  HARD_CONFLICT_RULES,
  UNBOUND_HARD_CONFLICT_RULE_COUNT,
  VERDICT_COMPATIBLE,
  VERDICT_CONDITIONAL,
  VERDICT_CONFLICT,
  SCOPE_COMPATIBLE,
  SCOPE_UNPROVEN,
  SCOPE_CONFLICT
}
