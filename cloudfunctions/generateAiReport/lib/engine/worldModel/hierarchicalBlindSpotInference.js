/**
 * engine/worldModel/hierarchicalBlindSpotInference.js
 *
 * RC8.3 C3-003 — Integrated Hierarchical Blind Spot Inference.
 *
 * Orchestrates frozen inference layers:
 *   Secondary Signals → Family → Within-Family Blind Spot → Final Inference
 *
 * NO bypass. NO 9-way fallback. NO cross-family rescue.
 *
 * Output: { family, blindSpot, evidence, trace, inferenceState }
 *
 * @version world_model_v3
 * @sprint c3-003
 */

var { inferBlindSpotFamily } = require('./blindSpotFamilyInference')
var { inferWithinFamilyBlindSpot, ELIGIBILITY } = require('./withinFamilyBlindSpotInference')
var { BLIND_SPOT_FAMILIES } = require('./blindSpotFamilyDefinitions')

// ═══════════════════════════════════════════════════════════════
// INFERENCE STATES
// ═══════════════════════════════════════════════════════════════

var INFERENCE_STATE = Object.freeze({
  CLEAR: 'CLEAR',
  AMBIGUOUS_FAMILY: 'AMBIGUOUS_FAMILY',
  AMBIGUOUS_BLIND_SPOT: 'AMBIGUOUS_BLIND_SPOT',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
})

// ═══════════════════════════════════════════════════════════════
// PREDICATE TYPE CONSTANTS (for document correction)
// ═══════════════════════════════════════════════════════════════

// Note: Predicate types = 13 (corrected from 12).
// The original C3-001A documentation stated 12 types but 13 are implemented.
// See: predictionSchema.js for the authoritative list.

// ═══════════════════════════════════════════════════════════════
// MAIN: INTEGRATED HIERARCHICAL INFERENCE
// ═══════════════════════════════════════════════════════════════

function inferHierarchicalBlindSpot(input) {
  if (!input) input = {}
  var secondarySignals = input.secondarySignals || []

  // ── STEP 1: Validate input ──

  if (!Array.isArray(secondarySignals) || secondarySignals.length === 0) {
    return insufficientResult('Empty secondary signals input', secondarySignals)
  }

  // ── STEP 2: Family inference ──

  var familyResult = inferBlindSpotFamily({
    secondarySignals: secondarySignals,
  })

  var family = familyResult.family

  if (!family) {
    return {
      family: {
        primary: null,
        alternate: null,
        ambiguous: true,
        rawGap: 0,
        confidence: 0,
        scores: familyResult.familyScores,
      },
      blindSpot: {
        primary: null,
        alternate: null,
        ambiguous: true,
        rawGap: 0,
        confidence: 0,
        eligibility: null,
      },
      evidence: {
        supporting: [],
        contradicting: [],
        disqualifying: [],
        missing: familyResult.missingEvidenceNeeded || ['No family could be determined from available evidence'],
      },
      missingEvidence: {
        purpose: 'ESTABLISH_COGNITIVE_ISSUE',
        items: buildNullFamilyItems(familyResult, secondarySignals),
        candidateSpecific: {},
        provenance: buildNullFamilyProvenance(secondarySignals),
      },
      trace: {
        familyTrace: familyResult.trace,
        boundaryTrace: null,
        candidateTrace: null,
        provenanceTrace: { independentOrigins: familyResult.trace ? familyResult.trace.totalActiveSignals : 0 },
      },
      inferenceState: INFERENCE_STATE.INSUFFICIENT_EVIDENCE,
    }
  }

  // ── STEP 3: Family ambiguity check ──

  var familyAmbiguous = familyResult.ambiguous

  // ── STEP 4: Within-family blind spot selection ──

  var withinFamilyResult = inferWithinFamilyBlindSpot({
    family: family,
    secondarySignals: secondarySignals,
  })

  var primaryBlindSpot = withinFamilyResult.primaryBlindSpot
  var blindSpotAmbiguous = withinFamilyResult.ambiguous

  // ── HIERARCHY HARD GUARANTEE ──
  // Primary blind spot MUST belong to the selected family

  if (primaryBlindSpot) {
    var familyDef = BLIND_SPOT_FAMILIES[family]
    if (familyDef && familyDef.candidates.indexOf(primaryBlindSpot) === -1) {
      throw new Error(
        'ARCHITECTURE VIOLATION: primaryBlindSpot ' + primaryBlindSpot +
        ' does not belong to family ' + family
      )
    }
  }

  // ── DISQUALIFIER GUARANTEE ──
  // A disqualified blind spot can NEVER be primary

  if (primaryBlindSpot) {
    var primaryCandidate = withinFamilyResult.candidateStates.find(function (c) {
      return c.id === primaryBlindSpot
    })
    if (primaryCandidate && primaryCandidate.eligibility === ELIGIBILITY.DISQUALIFIED) {
      throw new Error(
        'ARCHITECTURE VIOLATION: disqualified candidate ' + primaryBlindSpot + ' selected as primary'
      )
    }
  }

  // ── STEP 5: Determine inference state (R1: refined state machine) ──

  var inferenceState
  if (familyAmbiguous) {
    inferenceState = INFERENCE_STATE.AMBIGUOUS_FAMILY
  } else if (!primaryBlindSpot) {
    // Family established but no candidate selected → inspect WHY
    var candidates = withinFamilyResult.candidateStates || []

    var allDisqualified = candidates.length > 0 &&
      candidates.every(function (c) { return c.eligibility === ELIGIBILITY.DISQUALIFIED })

    // R1: non-disqualified candidates that are guard-blocked
    var nonDQCandidates = candidates.filter(function (c) {
      return c.eligibility !== ELIGIBILITY.DISQUALIFIED
    })

    function isGuardBlocked(c) {
      return c.eligibility !== ELIGIBILITY.ELIGIBLE &&
        c.externalConstraintTrace &&
        c.externalConstraintTrace.guardState !== 'COGNITIVE_EVIDENCE_INDEPENDENT' &&
        c.externalConstraintTrace.matchedConstraints &&
        c.externalConstraintTrace.matchedConstraints.length > 0
    }

    var allNonDQCandidatesGuardBlocked = nonDQCandidates.length > 0 &&
      nonDQCandidates.every(function (c) { return isGuardBlocked(c) })

    if (allDisqualified) {
      // All candidates DISQUALIFIED → no valid blind spot mechanism fits
      inferenceState = INFERENCE_STATE.INSUFFICIENT_EVIDENCE
    } else if (allNonDQCandidatesGuardBlocked) {
      // ALL non-DQ candidates are guard-blocked → external constraint explains evidence
      inferenceState = INFERENCE_STATE.INSUFFICIENT_EVIDENCE
    } else {
      // NC-unresolved or mixed guard+NC: cognitive issue exists, cannot resolve which
      inferenceState = INFERENCE_STATE.AMBIGUOUS_BLIND_SPOT
    }
  } else if (blindSpotAmbiguous) {
    inferenceState = INFERENCE_STATE.AMBIGUOUS_BLIND_SPOT
  } else {
    inferenceState = INFERENCE_STATE.CLEAR
  }

  // ── STEP 6: Confidence aggregation ──
  // Conservative: min of family and blind-spot confidence

  var finalConfidence = Math.min(
    familyResult.confidence,
    withinFamilyResult.confidence
  )

  // ── Build evidence aggregation ──

  var allSupporting = withinFamilyResult.candidateStates
    .filter(function (c) { return c.eligibility === ELIGIBILITY.ELIGIBLE })
    .reduce(function (acc, c) { return acc.concat(c.differentiatingEvidenceIds) }, [])

  var allContradicting = withinFamilyResult.candidateStates
    .reduce(function (acc, c) { return acc.concat(c.contradictingEvidenceIds) }, [])

  var allDisqualifying = withinFamilyResult.candidateStates
    .reduce(function (acc, c) { return acc.concat(c.disqualifyingEvidenceIds) }, [])

  var allMissing = withinFamilyResult.candidateStates
    .reduce(function (acc, c) { return acc.concat(c.missingEvidenceNeeded) }, [])
    .concat(familyResult.missingEvidenceNeeded || [])

  // Deduplicate
  var unique = function (arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i }) }

  // ── Build enriched candidate traces (R4: guard + ambiguity propagation) ──

  var allCandidateTraces = withinFamilyResult.candidateStates.map(function (c) {
    var guardInfo = {}
    if (c.externalConstraintTrace) {
      guardInfo = {
        guardState: c.externalConstraintTrace.guardState,
        matchedConstraints: c.externalConstraintTrace.matchedConstraints,
        explanatoryCoverage: c.externalConstraintTrace.explanatoryCoverage,
        uncoveredEvidenceIds: c.externalConstraintTrace.independentCognitiveEvidence || [],
        uncoveredIndependentCount: c.externalConstraintTrace.uncoveredIndependentCount || 0,
      }
    }

    return {
      id: c.id,
      eligibility: c.eligibility,
      supportStrength: c.supportStrength,
      confidence: c.confidence,
      necessaryMet: c.necessaryConditionsMet,
      necessaryMissing: c.necessaryConditionsMissing,
      necessaryPolicy: c.necessaryPolicy,
      differentiators: c.trace.differentiators,
      contradiction: c.trace.contradiction,
      disqualifier: c.trace.disqualifier,
      guardInfo: guardInfo,
      ambiguityReasons: c.ambiguityReasons || [],
      missingEvidenceNeeded: c.missingEvidenceNeeded || [],
    }
  })

  // ── Build structured missingEvidence (R4: purpose-classified) ──

  var missingEvidence = buildMissingEvidence(inferenceState, allCandidateTraces, familyResult)

  // ── Compose final output ──

  return {
    family: {
      primary: family,
      alternate: familyResult.familyScores
        ? Object.keys(familyResult.familyScores)
            .filter(function (f) { return f !== family })
            .sort(function (a, b) { return familyResult.familyScores[b] - familyResult.familyScores[a] })[0] || null
        : null,
      ambiguous: familyAmbiguous,
      rawGap: familyResult.rawGap || 0,
      confidence: familyResult.confidence,
      scores: familyResult.familyScores || {},
    },

    blindSpot: {
      primary: primaryBlindSpot,
      alternate: withinFamilyResult.alternateBlindSpot,
      ambiguous: blindSpotAmbiguous,
      rawGap: withinFamilyResult.rawGap,
      confidence: withinFamilyResult.confidence,
      eligibility: primaryBlindSpot
        ? ((withinFamilyResult.candidateStates.find(function (c) { return c.id === primaryBlindSpot }) || {}).eligibility || null)
        : null,
    },

    evidence: {
      supporting: unique(allSupporting),
      contradicting: unique(allContradicting),
      disqualifying: unique(allDisqualifying),
      missing: unique(allMissing),
    },

    missingEvidence: missingEvidence,

    trace: {
      familyTrace: familyResult.trace,
      boundaryTrace: withinFamilyResult.candidateStates.length > 0
        ? withinFamilyResult.candidateStates[0].trace : null,
      candidateTrace: allCandidateTraces,
      provenanceTrace: {
        familyIndependentOrigins: familyResult.trace ? (familyResult.trace.totalActiveSignals || 0) : 0,
        downstreamIndependentOrigins: withinFamilyResult.candidateStates
          .filter(function (c) { return c.eligibility === ELIGIBILITY.ELIGIBLE })
          .reduce(function (sum, c) { return sum + (c.trace.differentiators ? c.trace.differentiators.independentCount : 0) }, 0),
      },
    },

    inferenceState: inferenceState,
  }
}

// ═══════════════════════════════════════════════════════════════
// NULL-FAMILY MISSING EVIDENCE HELPERS (R1)
// ═══════════════════════════════════════════════════════════════

function buildNullFamilyItems(familyResult, secondarySignals) {
  var items = []
  var activeCount = secondarySignals.filter(function (s) { return s.state === 'ACTIVE' }).length
  var insufficientCount = secondarySignals.filter(function (s) { return s.state === 'INSUFFICIENT_EVIDENCE' }).length
  var suppressedCount = secondarySignals.filter(function (s) { return s.state === 'SUPPRESSED' }).length

  if (activeCount === 0 && insufficientCount > 0) {
    items.push('No active cognitive signals detected — all evidence is insufficient to establish a pattern')
  } else if (activeCount === 0 && suppressedCount > 0) {
    items.push('Only suppressed signals present — no active cognitive pattern detected')
  } else if (activeCount === 0) {
    items.push('No cognitive signal evidence available — cannot establish any cognitive mechanism')
  } else if (familyResult.missingEvidenceNeeded && familyResult.missingEvidenceNeeded.length > 0) {
    items = familyResult.missingEvidenceNeeded
  } else {
    items.push('Insufficient evidence to identify a cognitive family — need stronger signal patterns')
    if (activeCount > 0) {
      items.push(activeCount + ' active signal(s) detected but insufficient to distinguish a cognitive family')
    }
  }

  // Use family trace info if available
  if (familyResult.trace && familyResult.trace.totalActiveSignals !== undefined) {
    if (familyResult.trace.totalActiveSignals === 0 && items.length === 0) {
      items.push('Zero active signals — minimum evidence threshold not met')
    }
  }

  return items
}

function buildNullFamilyProvenance(secondarySignals) {
  return secondarySignals
    .filter(function (s) { return s.state === 'ACTIVE' || s.state === 'SUPPRESSED' })
    .map(function (s) { return s.id + ':' + s.state })
    .slice(0, 10)
}

// ═══════════════════════════════════════════════════════════════
// MISSING EVIDENCE BUILDER (R4: purpose-classified)
// ═══════════════════════════════════════════════════════════════

function buildMissingEvidence(inferenceState, candidateTraces, familyResult) {
  var items = []
  var candidateSpecific = {}
  var purpose

  if (inferenceState === INFERENCE_STATE.INSUFFICIENT_EVIDENCE) {
    purpose = 'ESTABLISH_COGNITIVE_ISSUE'

    // Collect evidence gaps that explain WHY no cognitive issue is established
    var allDisqualified = candidateTraces.length > 0 &&
      candidateTraces.every(function (c) { return c.eligibility === 'DISQUALIFIED' })

    var allGuardBlocked = candidateTraces.length > 0 &&
      candidateTraces.filter(function (c) { return c.eligibility !== 'DISQUALIFIED' })
        .every(function (c) { return c.eligibility !== 'ELIGIBLE' && c.guardInfo && c.guardInfo.guardState !== 'COGNITIVE_EVIDENCE_INDEPENDENT' })

    if (candidateTraces.length === 0) {
      items.push('No candidate blind spot mechanisms could be evaluated')
    } else if (allDisqualified) {
      items.push('All candidate mechanisms disqualified — observed evidence does not cleanly instantiate any valid blind spot')
      candidateTraces.forEach(function (c) {
        if (c.eligibility === 'DISQUALIFIED') {
          candidateSpecific[c.id] = ['Disqualified: conflicting evidence rules out this mechanism']
        }
      })
    } else if (allGuardBlocked) {
      items.push('Observed behavior has external/false-positive explanation; independent cognitive evidence insufficient')
      candidateTraces.forEach(function (c) {
        if (c.guardInfo && c.guardInfo.guardState !== 'COGNITIVE_EVIDENCE_INDEPENDENT') {
          candidateSpecific[c.id] = ['Externally explained: ' + c.guardInfo.guardState]
        }
      })
    } else {
      items.push('Insufficient evidence to establish a cognitive mechanism problem')
      items.push('Family evidence: ' + (familyResult.confidence > 0.5 ? 'present but weak' : 'insufficient'))
      candidateTraces.forEach(function (c) {
        candidateSpecific[c.id] = c.missingEvidenceNeeded.length > 0
          ? c.missingEvidenceNeeded
          : ['Insufficient evidence for this candidate mechanism']
      })
    }
  }

  else if (inferenceState === INFERENCE_STATE.AMBIGUOUS_BLIND_SPOT) {
    purpose = 'DISAMBIGUATE_BLIND_SPOT'

    var eligibleCandidates = candidateTraces.filter(function (c) { return c.eligibility === 'ELIGIBLE' })
    var nonDisqualified = candidateTraces.filter(function (c) { return c.eligibility !== 'DISQUALIFIED' })

    if (eligibleCandidates.length >= 2) {
      items.push(eligibleCandidates.length + ' candidate mechanisms are eligible — need evidence to distinguish between them')
    } else if (nonDisqualified.length >= 2) {
      items.push('Multiple potential mechanisms unresolved — evidence needed to confirm or rule out')
    } else {
      items.push('Cognitive issue likely exists within this family, but specific mechanism unresolved')
    }

    candidateTraces.forEach(function (c) {
      var gaps = []
      if (c.eligibility === 'INSUFFICIENT') {
        gaps = c.missingEvidenceNeeded.length > 0
          ? c.missingEvidenceNeeded
          : ['Necessary conditions incomplete for this mechanism']
      } else if (c.eligibility === 'ELIGIBLE') {
        if (c.ambiguityReasons.length > 0) {
          gaps = c.ambiguityReasons
        } else {
          gaps = ['Eligible but competing with other candidates — need differentiator evidence']
        }
      }
      if (c.guardInfo && c.guardInfo.guardState !== 'COGNITIVE_EVIDENCE_INDEPENDENT') {
        gaps.push('Externally explained pattern: ' + c.guardInfo.guardState)
      }
      candidateSpecific[c.id] = gaps
    })
  }

  else {
    // CLEAR or AMBIGUOUS_FAMILY — no missing evidence at this layer
    purpose = 'NONE'
  }

  return {
    purpose: purpose,
    items: items,
    candidateSpecific: candidateSpecific,
    provenance: candidateTraces.map(function (c) { return c.id + ':' + c.eligibility }),
  }
}

function insufficientResult(reason, secondarySignals) {
  var activeCount = secondarySignals.filter(function (s) { return s.state === 'ACTIVE' }).length
  return {
    family: { primary: null, alternate: null, ambiguous: true, rawGap: 0, confidence: 0, scores: {} },
    blindSpot: { primary: null, alternate: null, ambiguous: true, rawGap: 0, confidence: 0, eligibility: null },
    evidence: { supporting: [], contradicting: [], disqualifying: [], missing: [reason] },
    missingEvidence: {
      purpose: 'ESTABLISH_COGNITIVE_ISSUE',
      items: [reason],
      candidateSpecific: {},
      provenance: [],
    },
    trace: {
      familyTrace: { topFamily: null, totalActiveSignals: activeCount },
      boundaryTrace: null,
      candidateTrace: [],
      provenanceTrace: { independentOrigins: 0 },
    },
    inferenceState: INFERENCE_STATE.INSUFFICIENT_EVIDENCE,
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  inferHierarchicalBlindSpot,
  INFERENCE_STATE,
}
