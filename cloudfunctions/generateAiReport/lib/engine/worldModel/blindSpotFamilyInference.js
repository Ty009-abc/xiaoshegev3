/**
 * engine/worldModel/blindSpotFamilyInference.js
 *
 * RC8.3 C3-002A — Hierarchical Blind Spot Family Inference.
 *
 * Pure function: Secondary Signals + World Model Dimensions → Blind Spot Family.
 *
 * DOES NOT determine final Blind Spot — family-level only.
 *
 * Input: { secondarySignals, worldModelDimensions, evidenceTrace }
 * Output: { family, familyScores, confidence, supportingSignals,
 *           contradictingSignals, ambiguous, alternateFamily, rawGap,
 *           missingEvidenceNeeded, trace }
 *
 * DESIGN CONSTRAINTS:
 * - No flat 9-way competition — family only
 * - No blindSpotId output
 * - Deterministic
 * - 0 occupation/income/business reasoning
 *
 * @version world_model_v3
 * @sprint c3-002a
 */

var {
  BLIND_SPOT_FAMILIES,
  getAllFamilyIds,
  getFamily,
} = require('./blindSpotFamilyDefinitions')

// ═══════════════════════════════════════════════════════════════
// FAMILY SCORING
// ═══════════════════════════════════════════════════════════════

var SIGNAL_STATE = {
  ACTIVE: 'ACTIVE',
  SUPPRESSED: 'SUPPRESSED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
}

/**
 * Computes a score for one family based on secondary signal states.
 *
 * Active signals contribute positively (weight × score).
 * Suppressed signals contribute negatively.
 * Insufficient signals contribute nothing.
 *
 * @param {Object} family — family definition
 * @param {Array} secondarySignals — array of { id, state, score, confidence }
 * @returns {{ score: number, supporting: Array, contradicting: Array, totalWeight: number }}
 */
function scoreFamily(family, secondarySignals) {
  var score = 0
  var supporting = []
  var contradicting = []

  var signalMap = {}
  secondarySignals.forEach(function (s) { signalMap[s.id] = s })

  var signalCount = family.secondarySignals.length
  if (signalCount === 0) return { score: 0, supporting: [], contradicting: [], activeCount: 0, suppressedCount: 0 }

  // Each active signal contributes equally: score/100 to family total
  // No per-signal weight differentiation — all signals equally contribute
  family.secondarySignals.forEach(function (signalId) {
    var sig = signalMap[signalId]
    if (!sig) return

    if (sig.state === 'ACTIVE') {
      var sigScore = typeof sig.score === 'number' ? sig.score : 50
      var contribution = sigScore / 100 / signalCount
      score += contribution
      supporting.push({
        signalId: signalId,
        state: sig.state,
        score: sig.score,
        contribution: Math.round(contribution * 1000) / 1000,
      })
    } else if (sig.state === 'SUPPRESSED') {
      var penalty = 0.5 / signalCount
      score -= penalty
      contradicting.push({
        signalId: signalId,
        state: sig.state,
        penalty: Math.round(penalty * 1000) / 1000,
      })
    }
  })

  return {
    score: Math.max(0, Math.round(score * 1000) / 1000),
    supporting: supporting,
    contradicting: contradicting,
    activeCount: supporting.length,
    suppressedCount: contradicting.length,
  }
}

// ═══════════════════════════════════════════════════════════════
// AMBIGUITY DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Detects ambiguity between top two families.
 *
 * @param {Array} ranked — families sorted by score desc
 * @returns {{ ambiguous: boolean, rawGap: number, alternateFamily: string|null }}
 */
function detectAmbiguity(ranked) {
  if (ranked.length < 2) return { ambiguous: false, rawGap: 0, alternateFamily: null }

  var top = ranked[0]
  var second = ranked[1]

  // Gap between top and second
  var rawGap = Math.round((top.score - second.score) * 100) / 100

  // Ambiguity thresholds:
  // - Gap < 0.1 → strongly ambiguous
  // - Gap < 0.2 → weakly ambiguous
  // - Top score < 0.15 → too little signal for any family
  var ambiguous = rawGap < 0.1 || (rawGap < 0.2 && top.score < 0.3) || top.score < 0.05

  return {
    ambiguous: ambiguous,
    rawGap: rawGap,
    alternateFamily: ambiguous ? second.familyId : null,
  }
}

// ═══════════════════════════════════════════════════════════════
// MISSING EVIDENCE
// ═══════════════════════════════════════════════════════════════

/**
 * Determines what evidence is missing for stronger family determination.
 *
 * @param {Object} topFamily — top-scoring family
 * @param {Object} familyDef — family definition
 * @returns {Array<string>}
 */
function determineMissingEvidence(topFamily, familyDef) {
  var missing = []

  if (!topFamily || topFamily.activeCount === 0) {
    missing.push('No active secondary signals in any family')
    return missing
  }

  if (topFamily.activeCount < (familyDef.minimumSignals || 1)) {
    missing.push('Insufficient active signals in top family: ' + topFamily.activeCount + ' < ' + familyDef.minimumSignals)
  }

  if (topFamily.suppressedCount > topFamily.activeCount) {
    missing.push('More suppressed than active signals — family evidence conflicted')
  }

  if (topFamily.score < 0.1) {
    missing.push('Family score too low for confident determination')
  }

  return missing
}

// ═══════════════════════════════════════════════════════════════
// CONFIDENCE CALCULATION
// ═══════════════════════════════════════════════════════════════

/**
 * Calculates confidence in family determination.
 *
 * Factors:
 * - Top family score magnitude
 * - Gap between top and second
 * - Active vs suppressed signal ratio
 * - Number of active signals
 *
 * @param {Object} topFamily — scored family result
 * @param {number} gap — gap to second family
 * @param {number} totalFamilies — total number of families scored
 * @returns {number} 0.0 – 1.0
 */
function calculateFamilyConfidence(topFamily, gap, totalFamilies) {
  if (!topFamily || topFamily.activeCount === 0) return 0

  var scoreConf = Math.min(topFamily.score * 2, 0.5) // up to 0.5 from score magnitude
  var gapConf = Math.min(gap * 3, 0.3) // up to 0.3 from gap size
  var ratioConf = topFamily.activeCount > 0 && topFamily.suppressedCount === 0 ? 0.15 : 0.05 // bonus for no suppression
  var countConf = Math.min(topFamily.activeCount * 0.05, 0.05) // up to 0.05 from count

  return Math.max(0, Math.min(1, Math.round((scoreConf + gapConf + ratioConf + countConf) * 100) / 100))
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════

/**
 * Infers the most likely Blind Spot Family from secondary signal states.
 *
 * @param {Object} input
 * @param {Array<Object>} input.secondarySignals — array of { id, state, score, confidence }
 * @param {Object} [input.worldModelDimensions] — optional dimension state
 * @param {Object} [input.evidenceTrace] — optional trace
 * @returns {{
 *   family: string|null,
 *   familyScores: Object,
 *   confidence: number,
 *   supportingSignals: Array,
 *   contradictingSignals: Array,
 *   ambiguous: boolean,
 *   alternateFamily: string|null,
 *   rawGap: number,
 *   missingEvidenceNeeded: Array<string>,
 *   trace: Object
 * }}
 */
function inferBlindSpotFamily(input) {
  if (!input) input = {}
  var secondarySignals = input.secondarySignals || []
  var worldModelDimensions = input.worldModelDimensions || {}

  var familyIds = getAllFamilyIds()

  // ── Score all families ──

  var scored = familyIds.map(function (familyId) {
    var family = getFamily(familyId)
    var result = scoreFamily(family, secondarySignals)
    return {
      familyId: familyId,
      score: result.score,
      supportingSignals: result.supporting,
      contradictingSignals: result.contradicting,
      activeCount: result.activeCount,
      suppressedCount: result.suppressedCount,
    }
  })

  // ── Rank by score ──

  scored.sort(function (a, b) { return b.score - a.score })

  var top = scored[0]
  var allZero = scored.every(function (s) { return s.score === 0 })

  // ── All zero → insufficient ──

  if (allZero || !top || top.score === 0) {
    return {
      family: null,
      familyScores: buildScoreMap(scored),
      confidence: 0,
      supportingSignals: [],
      contradictingSignals: [],
      ambiguous: true,
      alternateFamily: null,
      rawGap: 0,
      missingEvidenceNeeded: ['No active secondary signals in any family — insufficient evidence for family inference'],
      trace: {
        familiesScored: familyIds.length,
        topFamilyScore: 0,
        gapToSecond: 0,
        totalActiveSignals: secondarySignals.filter(function (s) { return s.state === SIGNAL_STATE.ACTIVE }).length,
        totalSuppressedSignals: secondarySignals.filter(function (s) { return s.state === SIGNAL_STATE.SUPPRESSED }).length,
      },
    }
  }

  // ── Detect ambiguity ──

  var ambiguity = detectAmbiguity(scored)

  // ── Determine missing evidence ──

  var familyDef = getFamily(top.familyId)
  var missingEvidence = determineMissingEvidence(top, familyDef)

  // ── Build result ──

  return {
    family: top.familyId,
    familyScores: buildScoreMap(scored),
    confidence: calculateFamilyConfidence(top, ambiguity.rawGap, familyIds.length),
    supportingSignals: top.supportingSignals.map(function (s) { return s.signalId }),
    contradictingSignals: top.contradictingSignals.map(function (s) { return s.signalId }),
    ambiguous: ambiguity.ambiguous,
    alternateFamily: ambiguity.alternateFamily,
    rawGap: ambiguity.rawGap,
    missingEvidenceNeeded: missingEvidence.length > 0 ? missingEvidence : [],
    trace: {
      familiesScored: familyIds.length,
      topFamily: top.familyId,
      topFamilyScore: top.score,
      topActiveCount: top.activeCount,
      topSuppressedCount: top.suppressedCount,
      gapToSecond: ambiguity.rawGap,
      totalActiveSignals: secondarySignals.filter(function (s) { return s.state === SIGNAL_STATE.ACTIVE }).length,
      totalSuppressedSignals: secondarySignals.filter(function (s) { return s.state === SIGNAL_STATE.SUPPRESSED }).length,
      topSupporting: top.supportingSignals,
      topContradicting: top.contradictingSignals,
    },
  }
}

function buildScoreMap(scored) {
  var map = {}
  scored.forEach(function (s) {
    map[s.familyId] = s.score
  })
  return map
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  inferBlindSpotFamily,
  scoreFamily,
  detectAmbiguity,
  getAllFamilyIds,
}
