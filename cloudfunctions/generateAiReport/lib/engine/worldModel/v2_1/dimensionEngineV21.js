/**
 * engine/worldModel/v2_1/dimensionEngineV21.js
 *
 * World Model v2.1 — Dimension State Engine (Stage19A3).
 *
 * SHADOW ONLY. Evidence resolution / consistency state ONLY. No blindspot
 * ranking, no primary selection, no separation/sufficiency threshold, no
 * follow-up, no response validity, no strategy, no report, no runtime, no UI.
 *
 * Authority (priority R3D > R3C > R3B > R3A > R3 > R2 > R1):
 *   - docs/adr/ADR-RC8.3-STAGE18-R3D-DIMENSION-STATE-CONTRACT-ADDENDUM.md
 *     §15 (R3D R2 Two-Question State Model Repair) + §16 (Acceptance Patch).
 *
 * FROZEN RULES (R3D R2 §15.2 / §15.3):
 *   INDEPENDENT_SUPPORT_UNIT = unique matchedQuestionId (NOT evidenceId).
 *     — different questions may map to the same semantic evidenceId; support
 *       must count the distinct questions, never the deduped evidence rows.
 *   orientation ∈ { UNKNOWN, NEUTRAL, HEALTHY, DISTORTED, MIXED }
 *   state      ∈ { UNKNOWN, WEAK, MODERATE, STRONG }
 *
 *   orientation:
 *     h=0,d=0,n=0 → UNKNOWN
 *     h=0,d=0,n>0 → NEUTRAL
 *     h>0,d=0     → HEALTHY
 *     d>0,h=0     → DISTORTED
 *     h>0,d>0     → MIXED
 *
 *   state (deterministic precedence, input = support unit counts):
 *     A. directional == 0                        → UNKNOWN
 *     B. h > 0 AND d > 0                         → WEAK   (contradiction)
 *     C. directional == 1 AND n == 0             → WEAK   (single direction)
 *     D. directional == 1 AND n >= 1             → MODERATE (1 dir + 1 neutral)
 *     E. directional == 2 AND orientation∈{HEALTHY,DISTORTED} → STRONG
 *
 *   Each construct has exactly 2 questions ⇒ h+d+n <= 2. Any combination with
 *   h+d+n > 2 is an unexpected contract combination → deterministic INVALID
 *   (never guessed).
 *
 * state is CONSTRUCT-LOCAL evidence resolution ONLY. It is NOT a numeric
 * score, NOT a severity, NOT cross-construct comparable
 * (CROSS_CONSTRUCT_STATE_COMPARABILITY = FORBIDDEN, R3D §16).
 *
 * No numeric scoring, no weights, no strengthClass, no ID_OFFSET, no ontology
 * priority, no randomness, no displayPosition, no context/wealth/occupation.
 *
 * @version world_model_v2_1
 */

const { CONSTRUCTS_V21 } = require('./questionnaireV21')

const MAX_SUPPORT_PER_CONSTRUCT_V21 = 2 // frozen: exactly 2 questions per construct

/**
 * Resolve orientation from support-unit counts (R3D R2 §15.2).
 * @returns {'UNKNOWN'|'NEUTRAL'|'HEALTHY'|'DISTORTED'|'MIXED'|'INVALID'}
 */
function resolveOrientationV21(hSupport, dSupport, nSupport) {
  if (hSupport === 0 && dSupport === 0) {
    return nSupport > 0 ? 'NEUTRAL' : 'UNKNOWN'
  }
  if (dSupport === 0) return 'HEALTHY'
  if (hSupport === 0) return 'DISTORTED'
  return 'MIXED'
}

/**
 * Resolve state from support-unit counts (R3D R2 §15.2, deterministic precedence).
 * @returns {'UNKNOWN'|'WEAK'|'MODERATE'|'STRONG'|'INVALID'}
 */
function resolveStateV21(hSupport, dSupport, nSupport, orientation) {
  const directional = hSupport + dSupport

  // A.
  if (directional === 0) return 'UNKNOWN'
  // B.
  if (hSupport > 0 && dSupport > 0) return 'WEAK'
  // C.
  if (directional === 1 && nSupport === 0) return 'WEAK'
  // D.
  if (directional === 1 && nSupport >= 1) return 'MODERATE'
  // E.
  if (directional === 2 && (orientation === 'HEALTHY' || orientation === 'DISTORTED')) {
    return 'STRONG'
  }
  // Unexpected combination under the 2-question contract — never guessed.
  return 'INVALID'
}

/**
 * Pure, deterministic (orientation, state) resolution for a single construct.
 * This is the unit-level truth-table entry point (R3D §附 step 2).
 *
 * @param {number} hSupport
 * @param {number} dSupport
 * @param {number} nSupport
 * @returns {{orientation:string, state:string}}
 */
function resolveDimensionStateV21(hSupport, dSupport, nSupport) {
  const hs = Number(hSupport) || 0
  const ds = Number(dSupport) || 0
  const ns = Number(nSupport) || 0

  if (hs + ds + ns > MAX_SUPPORT_PER_CONSTRUCT_V21) {
    return { orientation: 'INVALID', state: 'INVALID' }
  }

  const orientation = resolveOrientationV21(hs, ds, ns)
  const state = resolveStateV21(hs, ds, ns, orientation)
  if (state === 'INVALID') {
    return { orientation: 'INVALID', state: 'INVALID' }
  }
  return { orientation, state }
}

/**
 * Compute the full 9-dimension state table from normalized atomic evidence.
 *
 * Input: the evidence array (or the full normalizer result
 * `{ ok, validationErrors, missingQuestionIds, evidence }`) produced by
 * `evidenceNormalizerV21.normalizeEvidenceV21`.
 *
 * Output: `{ dimensions, contractViolations }` where `dimensions` is exactly
 * one entry per frozen construct (CONSTRUCTS_V21 order). `contractViolations`
 * is empty for all valid V2.1 inputs; it only reports deterministic contract
 * defects (one question contributing multiple directions, or an unexpected
 * support combination) — these never occur under the frozen single-answer →
 * single-direction ontology and are not guessed.
 *
 * @param {Array|{evidence:Array}} normalizedEvidence
 * @returns {{dimensions:Array, contractViolations:Array}}
 */
function computeDimensionsV21(normalizedEvidence) {
  const evidenceList = Array.isArray(normalizedEvidence)
    ? normalizedEvidence
    : normalizedEvidence && Array.isArray(normalizedEvidence.evidence)
      ? normalizedEvidence.evidence
      : []

  const byConstruct = new Map()
  for (const e of evidenceList) {
    if (!e || typeof e.construct !== 'string') continue
    let list = byConstruct.get(e.construct)
    if (!list) {
      list = []
      byConstruct.set(e.construct, list)
    }
    list.push(e)
  }

  const contractViolations = []

  const dimensions = CONSTRUCTS_V21.map((construct) => {
    const list = byConstruct.get(construct) || []

    const hSet = new Set()
    const dSet = new Set()
    const nSet = new Set()
    const healthyEvidenceIds = new Set()
    const distortedEvidenceIds = new Set()
    const neutralEvidenceIds = new Set()
    const distortionTypes = new Set()

    for (const e of list) {
      const dir = e.direction
      const evidenceId = e.evidenceId

      // Semantic evidence trace (does NOT determine support strength).
      if (dir === 'H') {
        healthyEvidenceIds.add(evidenceId)
      } else if (dir === 'D') {
        distortedEvidenceIds.add(evidenceId)
        if (e.distortionType) distortionTypes.add(e.distortionType)
      } else if (dir === 'N') {
        neutralEvidenceIds.add(evidenceId)
      }

      // Support unit = unique matchedQuestionId (independent observations).
      const qids = Array.isArray(e.matchedQuestionIds) ? e.matchedQuestionIds : []
      for (const qid of qids) {
        if (dir === 'H') hSet.add(qid)
        else if (dir === 'D') dSet.add(qid)
        else if (dir === 'N') nSet.add(qid)
      }
    }

    // Guard: one question must never contribute to more than one direction.
    for (const qid of hSet) {
      if (dSet.has(qid) || nSet.has(qid)) {
        contractViolations.push({ type: 'ONE_QUESTION_MULTI_DIRECTION', construct, questionId: qid })
      }
    }
    for (const qid of dSet) {
      if (nSet.has(qid)) {
        contractViolations.push({ type: 'ONE_QUESTION_MULTI_DIRECTION', construct, questionId: qid })
      }
    }

    // Absorb N: a question that is H or D never also counts as N.
    const nSupportQuestionIds = [...nSet].filter((q) => !hSet.has(q) && !dSet.has(q)).sort()

    const hSupport = hSet.size
    const dSupport = dSet.size
    const nSupport = nSupportQuestionIds.length

    const resolved = resolveDimensionStateV21(hSupport, dSupport, nSupport)
    if (resolved.state === 'INVALID') {
      contractViolations.push({
        type: 'UNEXPECTED_SUPPORT_COMBINATION',
        construct,
        hSupport,
        dSupport,
        nSupport,
      })
    }

    return {
      construct,
      orientation: resolved.orientation,
      state: resolved.state,
      hSupport,
      dSupport,
      nSupport,
      hSupportQuestionIds: [...hSet].sort(),
      dSupportQuestionIds: [...dSet].sort(),
      nSupportQuestionIds,
      supportingEvidenceIds: [...new Set([...healthyEvidenceIds, ...distortedEvidenceIds, ...neutralEvidenceIds])].sort(),
      healthyEvidenceIds: [...healthyEvidenceIds].sort(),
      distortedEvidenceIds: [...distortedEvidenceIds].sort(),
      neutralEvidenceIds: [...neutralEvidenceIds].sort(),
      distortionTypes: [...distortionTypes].sort(),
      hasContradiction: hSupport > 0 && dSupport > 0,
    }
  })

  return { dimensions, contractViolations }
}

module.exports = {
  MAX_SUPPORT_PER_CONSTRUCT_V21,
  resolveOrientationV21,
  resolveStateV21,
  resolveDimensionStateV21,
  computeDimensionsV21,
}
