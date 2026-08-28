/**
 * engine/worldModel/v2_1/blindSpotCandidateEngineV21.js
 *
 * World Model v2.1 — Blindspot Candidate Engine (Stage19A4).
 *
 * SHADOW ONLY. Produces 9 blindspot CANDIDATE containers (one per construct).
 * A candidate is an EVIDENCE CONTAINER — it answers "is this blindspot
 * supported by current evidence, and by which mechanisms / counterevidence?"
 *
 * It MUST NOT answer "which blindspot is primary?" — no ranking, no argmax,
 * no tie breaking, no threshold, no follow-up, no primary/secondary.
 *
 * Authority (priority R3D > R3C > R3B > R3A > R3 > R2 > R1):
 *   - docs/adr/ADR-RC8.3-STAGE18-R3D-DIMENSION-STATE-CONTRACT-ADDENDUM.md
 *     §16 (Acceptance Patch: CROSS_CONSTRUCT_STATE_COMPARABILITY = FORBIDDEN).
 *
 * FROZEN RULES:
 *   Exact 1:1 construct → blindSpotId mapping (§3):
 *     DECISION → DECISION_INERTIA
 *     FEEDBACK → FEEDBACK_LOOP_GAP
 *     PROBABILITY → PROBABILITY_MISJUDGMENT
 *     RISK → RISK_MODEL_DISTORTION
 *     LEVERAGE → LEVERAGE_MODEL_GAP
 *     TIME → TIME_HORIZON_TRAP
 *     IDENTITY → IDENTITY_CONSTRAINT
 *     OPPORTUNITY → OPPORTUNITY_BLINDNESS
 *     SYSTEMS → SYSTEM_THINKING_GAP
 *
 *   Candidate status is derived from dimension ORIENTATION ONLY (§6):
 *     DISTORTED → SUPPORTED
 *     HEALTHY   → COUNTERSUPPORTED
 *     MIXED     → MIXED
 *     UNKNOWN/NEUTRAL → INSUFFICIENT
 *   dimension.state expresses evidence resolution only, NOT support direction.
 *
 *   Evidence → support direction mapping (§7):
 *     D evidence → supportingEvidenceIds / supportingQuestionIds
 *     H evidence → counterEvidenceIds   / counterQuestionIds
 *     N evidence → neutralEvidenceIds   / neutralQuestionIds
 *   H is explicit counterevidence, never "weak support".
 *
 *   hasContradiction = supportingQuestionIds.length>0 AND counterQuestionIds.length>0.
 *   Contradiction is preserved, never resolved (later uncertainty layer).
 *
 * No numeric score, no severity, no confidence, no cross-construct ranking, no
 * ontology priority, no ID_OFFSET, no randomness, no displayPosition, no
 * strengthClass, no nearNeighborRelations, no primary thresholds, no follow-up.
 *
 * @version world_model_v2_1
 */

const { CONSTRUCTS_V21 } = require('./questionnaireV21')

// Exact 1:1 frozen mapping — construct → blindSpotId. No ontology priority.
const CONSTRUCT_TO_BLINDSPOT_V21 = {
  DECISION: 'DECISION_INERTIA',
  FEEDBACK: 'FEEDBACK_LOOP_GAP',
  PROBABILITY: 'PROBABILITY_MISJUDGMENT',
  RISK: 'RISK_MODEL_DISTORTION',
  LEVERAGE: 'LEVERAGE_MODEL_GAP',
  TIME: 'TIME_HORIZON_TRAP',
  IDENTITY: 'IDENTITY_CONSTRAINT',
  OPPORTUNITY: 'OPPORTUNITY_BLINDNESS',
  SYSTEMS: 'SYSTEM_THINKING_GAP',
}

/**
 * Resolve candidate status from dimension orientation (R3D §6, A4 §6).
 * @returns {'SUPPORTED'|'COUNTERSUPPORTED'|'MIXED'|'INSUFFICIENT'|'INVALID'}
 */
function resolveBlindSpotStatusV21(orientation) {
  switch (orientation) {
    case 'DISTORTED':
      return 'SUPPORTED'
    case 'HEALTHY':
      return 'COUNTERSUPPORTED'
    case 'MIXED':
      return 'MIXED'
    case 'UNKNOWN':
    case 'NEUTRAL':
      return 'INSUFFICIENT'
    default:
      return 'INVALID'
  }
}

/**
 * Build the 9 blindspot candidate containers from dimension outputs.
 *
 * Input: the result of `computeDimensionsV21` (either the full
 * `{ dimensions, contractViolations }` object or the bare `dimensions` array).
 *
 * Output: `{ candidates, contractViolations }` where `candidates` has exactly
 * one entry per frozen construct (CONSTRUCTS_V21 order, serialization order
 * only — NOT semantic priority). `contractViolations` passes through upstream
 * dimension violations plus any INVALID-orientation/status candidates.
 *
 * @param {Array|{dimensions:Array, contractViolations?:Array}} dimensionsInput
 * @returns {{candidates:Array, contractViolations:Array}}
 */
function buildBlindSpotCandidatesV21(dimensionsInput) {
  const dimensions = Array.isArray(dimensionsInput)
    ? dimensionsInput
    : dimensionsInput && Array.isArray(dimensionsInput.dimensions)
      ? dimensionsInput.dimensions
      : []

  const upstreamViolations = (dimensionsInput && Array.isArray(dimensionsInput.contractViolations))
    ? dimensionsInput.contractViolations
    : []

  const byConstruct = new Map()
  for (const d of dimensions) {
    if (d && typeof d.construct === 'string') byConstruct.set(d.construct, d)
  }

  const contractViolations = [...upstreamViolations]
  const candidates = []

  for (const construct of CONSTRUCTS_V21) {
    const dim = byConstruct.get(construct)

    if (!dim) {
      // Construct absent from dimensions → no evidence → INSUFFICIENT candidate.
      candidates.push({
        blindSpotId: CONSTRUCT_TO_BLINDSPOT_V21[construct],
        construct,
        dimensionOrientation: 'UNKNOWN',
        dimensionState: 'UNKNOWN',
        status: 'INSUFFICIENT',
        supportingEvidenceIds: [],
        counterEvidenceIds: [],
        neutralEvidenceIds: [],
        supportingQuestionIds: [],
        counterQuestionIds: [],
        neutralQuestionIds: [],
        distortionTypes: [],
        hasContradiction: false,
        evidenceSummary: 'no-evidence',
      })
      continue
    }

    const orientation = dim.orientation
    const status = resolveBlindSpotStatusV21(orientation)

    // D evidence → support; H evidence → counter; N evidence → neutral.
    const supportingEvidenceIds = [...(dim.distortedEvidenceIds || [])].sort()
    const counterEvidenceIds = [...(dim.healthyEvidenceIds || [])].sort()
    const neutralEvidenceIds = [...(dim.neutralEvidenceIds || [])].sort()
    const supportingQuestionIds = [...(dim.dSupportQuestionIds || [])].sort()
    const counterQuestionIds = [...(dim.hSupportQuestionIds || [])].sort()
    const neutralQuestionIds = [...(dim.nSupportQuestionIds || [])].sort()
    const distortionTypes = [...(dim.distortionTypes || [])].sort()

    const hasContradiction =
      supportingQuestionIds.length > 0 && counterQuestionIds.length > 0

    if (status === 'INVALID') {
      contractViolations.push({
        type: 'INVALID_ORIENTATION',
        construct,
        orientation,
      })
    }

    candidates.push({
      blindSpotId: CONSTRUCT_TO_BLINDSPOT_V21[construct],
      construct,
      dimensionOrientation: orientation,
      dimensionState: dim.state,
      status,
      supportingEvidenceIds,
      counterEvidenceIds,
      neutralEvidenceIds,
      supportingQuestionIds,
      counterQuestionIds,
      neutralQuestionIds,
      distortionTypes,
      hasContradiction,
      evidenceSummary: `support=${supportingQuestionIds.length} counter=${counterQuestionIds.length} neutral=${neutralQuestionIds.length}`,
    })
  }

  return { candidates, contractViolations }
}

module.exports = {
  CONSTRUCT_TO_BLINDSPOT_V21,
  resolveBlindSpotStatusV21,
  buildBlindSpotCandidatesV21,
}
