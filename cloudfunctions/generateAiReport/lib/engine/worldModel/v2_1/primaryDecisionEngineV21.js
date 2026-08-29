/**
 * engine/worldModel/v2_1/primaryDecisionEngineV21.js
 *
 * World Model v2.1 — Primary Decision Engine (Stage19A5A).
 *
 * SHADOW ONLY. Consumes the 9 blindspot candidate containers produced by
 * `blindSpotCandidateEngineV21` and produces the PRE-FOLLOW-UP terminal
 * decision under the frozen uncertainty contract:
 *   docs/adr/ADR-RC8.3-STAGE19-A5-UNCERTAINTY-PRIMARY-SELECTION-CONTRACT.md
 *   (including the A5.1 / A5.1-R1 normative addenda for the follow-up edge set).
 *
 * This stage decides ONLY:
 *   1. which candidates are PRIMARY_ELIGIBLE;
 *   2. which terminal decision the current evidence yields:
 *        PRIMARY_ALLOWED | FOLLOW_UP_REQUIRED | NO_PRIMARY_DEFICIT | INSUFFICIENT_EVIDENCE
 *
 * This stage MUST NOT:
 *   - consume follow-up answers;
 *   - implement follow-up evidence / option mapping / question text / resolution;
 *   - render a report;
 *   - touch runtime integration / UI / deploy.
 *
 * Authority priority: A5 ADR > R3D > R3C > R3B > R3A > R3 > R2 > R1.
 *
 * FROZEN RULES:
 *
 *   PRIMARY ELIGIBILITY (A5 §4/§5, categorical only — no numeric score):
 *     eligible ⟺ candidate.status == SUPPORTED
 *               AND candidate.dimensionState == STRONG
 *               AND valid frozen base-question provenance (defensive check).
 *     SUPPORTED+STRONG ⟺ orientation == DISTORTED AND d_support == 2
 *                       AND h_support == 0 AND n_support == 0  (D + D).
 *
 *   DEFENSIVE PROVENANCE CHECK (A5 §4): never trust a STRONG label blindly.
 *     For a SUPPORTED+STRONG candidate verify, from existing provenance:
 *       - at least the frozen two independent supporting base question IDs;
 *       - zero counterevidence question IDs;
 *       - zero neutral-dilution question IDs.
 *     Support unit = unique base matchedQuestionId (NOT evidenceId count).
 *     If a STRONG label contradicts provenance → deterministic
 *     CONTRACT_PROVENANCE_ERROR (excluded, never silently repaired).
 *
 *   TERMINAL DECISION (A5 §17 exhaustive table):
 *     eligible == 1                     → PRIMARY_ALLOWED (UNIQUE_ELIGIBLE_CANDIDATE)
 *     eligible == 2 + relevant pair     → FOLLOW_UP_REQUIRED (FOLLOWUP_RELEVANT_PAIR)
 *     eligible == 2 + non-relevant pair → INSUFFICIENT_EVIDENCE (MULTIPLE_SUPPORTED_MODELS)
 *     eligible >= 3                     → INSUFFICIENT_EVIDENCE (MULTIPLE_SUPPORTED_MODELS)
 *     eligible == 0:
 *       0 SUPPORTED & 0 MIXED & >=1 COUNTERSUPPORTED → NO_PRIMARY_DEFICIT
 *       else                                          → INSUFFICIENT_EVIDENCE
 *
 *   FOLLOW-UP RELEVANT EDGE SET (A5.1 §2, order-invariant, exactly 5):
 *     DECISION↔FEEDBACK, PROBABILITY↔RISK, RISK↔TIME,
 *     IDENTITY↔OPPORTUNITY, TIME↔SYSTEMS
 *   Structural-only neighbors (NEVER trigger follow-up):
 *     DECISION↔PROBABILITY, FEEDBACK↔SYSTEMS, LEVERAGE↔TIME, LEVERAGE↔OPPORTUNITY
 *
 * FORBIDDEN (never implemented here): numeric candidate score, state→number,
 * D−H arithmetic, separation threshold, ID_OFFSET, ontology priority, ranking,
 * top-2, tournament, secondary blindspot, follow-up evidence/resolution.
 *
 * Order invariance: the decision does not depend on candidate array order,
 * construct serialization order, evidence order, or question order. Follow-up
 * pairs are canonicalized (sorted) so A+B == B+A.
 *
 * @version world_model_v2_1
 */

const { CONSTRUCTS_V21 } = require('./questionnaireV21')

// ── Frozen follow-up relevant construct pairs (order-invariant) ────────────
const FOLLOWUP_RELEVANT_EDGE_SET = [
  ['DECISION', 'FEEDBACK'],
  ['PROBABILITY', 'RISK'],
  ['RISK', 'TIME'],
  ['IDENTITY', 'OPPORTUNITY'],
  ['TIME', 'SYSTEMS'],
]

// Structural neighbors — semantically adjacent but NOT follow-up relevant.
// They must never trigger a follow-up question.
const STRUCTURAL_NEIGHBOR_EDGE_SET = [
  ['DECISION', 'PROBABILITY'],
  ['FEEDBACK', 'SYSTEMS'],
  ['LEVERAGE', 'TIME'],
  ['LEVERAGE', 'OPPORTUNITY'],
]

const FOLLOWUP_RELEVANT_EDGE_COUNT = FOLLOWUP_RELEVANT_EDGE_SET.length // 5
const STRUCTURAL_NEIGHBOR_EDGE_COUNT = STRUCTURAL_NEIGHBOR_EDGE_SET.length // 4

// Allowed terminal states (exact closed set — no other status is legal).
const PRIMARY_STATUS_SET_V21 = Object.freeze([
  'PRIMARY_ALLOWED',
  'FOLLOW_UP_REQUIRED',
  'NO_PRIMARY_DEFICIT',
  'INSUFFICIENT_EVIDENCE',
])

// Categorical reason codes (deterministic, no numeric values encoded).
const REASON = {
  UNIQUE_ELIGIBLE_CANDIDATE: 'UNIQUE_ELIGIBLE_CANDIDATE',
  FOLLOWUP_RELEVANT_PAIR: 'FOLLOWUP_RELEVANT_PAIR',
  MULTIPLE_SUPPORTED_MODELS: 'MULTIPLE_SUPPORTED_MODELS',
  NO_SUPPORTED_DEFICIT: 'NO_SUPPORTED_DEFICIT',
  INSUFFICIENT_DIRECTIONAL_EVIDENCE: 'INSUFFICIENT_DIRECTIONAL_EVIDENCE',
  CONTRADICTORY_EVIDENCE: 'CONTRADICTORY_EVIDENCE',
  CONTRACT_PROVENANCE_ERROR: 'CONTRACT_PROVENANCE_ERROR',
}

/**
 * Canonicalize a construct pair to be order-invariant (A+B == B+A).
 * Returns [a, b] with a <= b by code-unit order.
 */
function canonicalizePairV21(constructA, constructB) {
  return constructA < constructB ? [constructA, constructB] : [constructB, constructA]
}

const FOLLOWUP_RELEVANT_KEYS = new Set(
  FOLLOWUP_RELEVANT_EDGE_SET.map(([a, b]) => canonicalizePairV21(a, b).join('\u0000'))
)

/**
 * Is this (unordered) construct pair follow-up relevant?
 * Order invariant: A+B == B+A.
 */
function isFollowupRelevantPairV21(constructA, constructB) {
  return FOLLOWUP_RELEVANT_KEYS.has(canonicalizePairV21(constructA, constructB).join('\u0000'))
}

/**
 * Defensive provenance validation for a candidate that claims eligibility
 * (SUPPORTED + STRONG). Returns a list of violation descriptors (empty = valid).
 *
 * Verifies, from existing candidate provenance, the frozen contract:
 *   - status label == SUPPORTED;
 *   - dimensionState label == STRONG;
 *   - at least two distinct independent supporting base question IDs;
 *   - zero counterevidence question IDs;
 *   - zero neutral-dilution question IDs.
 *
 * Support unit = unique base matchedQuestionId (NOT evidenceId count).
 */
function validateCandidateProvenanceV21(candidate) {
  const violations = []
  if (!candidate || typeof candidate !== 'object') {
    return [{ type: 'NOT_A_CANDIDATE' }]
  }

  const supporting = Array.isArray(candidate.supportingQuestionIds)
    ? candidate.supportingQuestionIds
    : []
  const counter = Array.isArray(candidate.counterQuestionIds)
    ? candidate.counterQuestionIds
    : []
  const neutral = Array.isArray(candidate.neutralQuestionIds)
    ? candidate.neutralQuestionIds
    : []

  if (candidate.status !== 'SUPPORTED') {
    violations.push({ type: 'STATUS_NOT_SUPPORTED', status: candidate.status })
  }
  if (candidate.dimensionState !== 'STRONG') {
    violations.push({ type: 'STATE_NOT_STRONG', dimensionState: candidate.dimensionState })
  }
  // Frozen: two independent supporting base question IDs required (D + D).
  if (supporting.length < 2 || new Set(supporting).size < 2) {
    violations.push({ type: 'INSUFFICIENT_SUPPORTING_QUESTION_IDS', supportingQuestionIds: [...supporting] })
  }
  if (counter.length > 0) {
    violations.push({ type: 'COUNTEREVIDENCE_PRESENT', counterQuestionIds: [...counter] })
  }
  if (neutral.length > 0) {
    violations.push({ type: 'NEUTRAL_DILUTION_PRESENT', neutralQuestionIds: [...neutral] })
  }

  return violations
}

/**
 * Decide the pre-follow-up terminal decision for the primary blindspot.
 *
 * @param {Array|{candidates:Array, contractViolations?:Array}} candidatesInput
 *   The `buildBlindSpotCandidatesV21` output (object) or a bare candidates array.
 * @returns {{
 *   status: 'PRIMARY_ALLOWED'|'FOLLOW_UP_REQUIRED'|'NO_PRIMARY_DEFICIT'|'INSUFFICIENT_EVIDENCE',
 *   primaryBlindSpotId: string|null,
 *   primaryConstruct: string|null,
 *   eligibleCandidateIds: Array<string>,
 *   eligibleConstructs: Array<string>,
 *   followupPair: Array<string>|null,
 *   reasonCode: string,
 *   trace: Array,
 *   contractViolations: Array
 * }}
 */
function decidePrimaryV21(candidatesInput) {
  let candidates = []
  let upstreamViolations = []

  if (Array.isArray(candidatesInput)) {
    candidates = candidatesInput
  } else if (candidatesInput && Array.isArray(candidatesInput.candidates)) {
    candidates = candidatesInput.candidates
    upstreamViolations = Array.isArray(candidatesInput.contractViolations)
      ? candidatesInput.contractViolations
      : []
  }

  const contractViolations = [...upstreamViolations]
  const trace = []

  const supported = []
  const counter = []
  const mixed = []
  const eligible = []

  for (const c of candidates) {
    if (!c || typeof c.construct !== 'string') continue

    const status = c.status
    const dimensionState = c.dimensionState
    const claimsEligible = status === 'SUPPORTED' && dimensionState === 'STRONG'

    // Defensive provenance check only for candidates that claim eligibility.
    let provenanceViolations = []
    if (claimsEligible) {
      provenanceViolations = validateCandidateProvenanceV21(c)
      if (provenanceViolations.length > 0) {
        for (const v of provenanceViolations) {
          contractViolations.push({
            type: 'CONTRACT_PROVENANCE_ERROR',
            construct: c.construct,
            blindSpotId: c.blindSpotId,
            detail: v,
          })
        }
      }
    }

    const eligibleFlag = claimsEligible && provenanceViolations.length === 0

    trace.push({
      construct: c.construct,
      blindSpotId: c.blindSpotId,
      status: c.status,
      dimensionState: c.dimensionState,
      supportingQuestionIds: [...(c.supportingQuestionIds || [])],
      counterQuestionIds: [...(c.counterQuestionIds || [])],
      eligible: eligibleFlag,
      provenanceViolations,
    })

    if (status === 'SUPPORTED') supported.push(c)
    else if (status === 'COUNTERSUPPORTED') counter.push(c)
    else if (status === 'MIXED') mixed.push(c)

    if (eligibleFlag) eligible.push(c)
  }

  // ── Terminal decision (categorical, order-invariant) ────────────────────
  let status = 'INSUFFICIENT_EVIDENCE'
  let reasonCode = REASON.INSUFFICIENT_DIRECTIONAL_EVIDENCE
  let primaryBlindSpotId = null
  let primaryConstruct = null
  let followupPair = null

  if (eligible.length === 1) {
    status = 'PRIMARY_ALLOWED'
    reasonCode = REASON.UNIQUE_ELIGIBLE_CANDIDATE
    primaryBlindSpotId = eligible[0].blindSpotId
    primaryConstruct = eligible[0].construct
  } else if (eligible.length === 2) {
    const [a, b] = eligible
    if (isFollowupRelevantPairV21(a.construct, b.construct)) {
      status = 'FOLLOW_UP_REQUIRED'
      reasonCode = REASON.FOLLOWUP_RELEVANT_PAIR
      followupPair = canonicalizePairV21(a.construct, b.construct)
    } else {
      status = 'INSUFFICIENT_EVIDENCE'
      reasonCode = REASON.MULTIPLE_SUPPORTED_MODELS
    }
  } else if (eligible.length >= 3) {
    status = 'INSUFFICIENT_EVIDENCE'
    reasonCode = REASON.MULTIPLE_SUPPORTED_MODELS
  } else {
    // eligible.length === 0 → frozen no-deficit / insufficient rules.
    if (supported.length === 0 && mixed.length === 0 && counter.length >= 1) {
      status = 'NO_PRIMARY_DEFICIT'
      reasonCode = REASON.NO_SUPPORTED_DEFICIT
    } else if (supported.length > 0) {
      // SUPPORTED present but none eligible (D+missing / D+N only).
      status = 'INSUFFICIENT_EVIDENCE'
      reasonCode = REASON.INSUFFICIENT_DIRECTIONAL_EVIDENCE
    } else if (mixed.length > 0) {
      // MIXED present with no eligible SUPPORTED → contradiction unresolved.
      status = 'INSUFFICIENT_EVIDENCE'
      reasonCode = REASON.CONTRADICTORY_EVIDENCE
    } else {
      // All INSUFFICIENT → no directional evidence at all.
      status = 'INSUFFICIENT_EVIDENCE'
      reasonCode = REASON.INSUFFICIENT_DIRECTIONAL_EVIDENCE
    }
  }

  // Deterministic (order-invariant) output ordering.
  const eligibleCandidateIds = eligible.map((c) => c.blindSpotId).sort()
  const eligibleConstructs = eligible.map((c) => c.construct).sort()

  trace.sort((a, b) => (a.construct < b.construct ? -1 : a.construct > b.construct ? 1 : 0))
  contractViolations.sort((a, b) => {
    const ka = `${a.construct || ''}\u0000${a.type || ''}`
    const kb = `${b.construct || ''}\u0000${b.type || ''}`
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })

  return {
    status,
    primaryBlindSpotId,
    primaryConstruct,
    eligibleCandidateIds,
    eligibleConstructs,
    followupPair,
    reasonCode,
    trace,
    contractViolations,
  }
}

module.exports = {
  FOLLOWUP_RELEVANT_EDGE_SET,
  STRUCTURAL_NEIGHBOR_EDGE_SET,
  FOLLOWUP_RELEVANT_EDGE_COUNT,
  STRUCTURAL_NEIGHBOR_EDGE_COUNT,
  PRIMARY_STATUS_SET_V21,
  canonicalizePairV21,
  isFollowupRelevantPairV21,
  validateCandidateProvenanceV21,
  decidePrimaryV21,
}
