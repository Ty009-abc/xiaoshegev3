/**
 * engine/worldModel/cognitiveArchetypeEngineV2.js
 *
 * Deterministic cognitive archetype inference from world model dimensions
 * and behavior signals.
 *
 * Archetypes describe THINKING AND DECISION STRUCTURES.
 * They are NOT occupations. Do NOT map occupation→archetype.
 * Do NOT use EMPLOYEE as an archetype.
 * Do NOT trigger CREATOR solely from content skills.
 *
 * @version world_model_v1
 */

const { ARCHETYPE_DEFINITIONS } = require('./archetypeDefinitions')
const { calculateArchetypeConfidence } = require('./confidenceCalculator')

// ═══════════════════════════════════════════════════════════════
// Main engine
// ═══════════════════════════════════════════════════════════════

function inferArchetype(worldModel, signalResult) {
  var allSignals = signalResult.signals || []
  var signalScoreMap = {}

  // Build signal score map
  allSignals.forEach(function(sig) {
    var weight = sig.state === 'SUPPRESSED' ? 0.3 : 1.0
    signalScoreMap[sig.id] = sig.score * weight
  })

  var archetypeIds = Object.keys(ARCHETYPE_DEFINITIONS)
  var candidateScores = {}

  archetypeIds.forEach(function(aid) {
    var arch = ARCHETYPE_DEFINITIONS[aid]
    if (!arch || !arch.signalAffinity) return

    var highSignals = arch.signalAffinity.high || []
    var lowSignals = arch.signalAffinity.low || []

    var matchScore = 0
    var matchCount = 0
    var mismatchCount = 0

    // High affinity signals: presence increases score
    highSignals.forEach(function(sigId) {
      var sigScore = signalScoreMap[sigId]
      if (sigScore !== undefined && sigScore > 0.4) {
        matchScore += sigScore
        matchCount++
      }
    })

    // Low affinity signals: strong presence decreases score
    lowSignals.forEach(function(sigId) {
      var sigScore = signalScoreMap[sigId]
      if (sigScore !== undefined && sigScore > 0.5) {
        matchScore -= sigScore * 0.3
        mismatchCount++
      }
    })

    // Normalize
    var maxPossible = highSignals.length
    var rawScore = maxPossible > 0 ? Math.max(0, matchScore / maxPossible) : 0

    candidateScores[aid] = {
      id: aid,
      score: Math.min(1, rawScore),
      matchCount: matchCount,
      mismatchCount: mismatchCount,
      confidence: calculateArchetypeConfidence(matchCount, highSignals.length, mismatchCount),
    }
  })

  // Sort by score descending
  var sorted = Object.values(candidateScores).sort(function(a, b) {
    return b.score - a.score
  })

  var primary = sorted[0]
  var secondary = sorted[1]

  // Ensure primary !== secondary
  if (secondary && secondary.id === primary.id) {
    secondary = sorted[2] || sorted[1]
  }

  // If top two are very close, record tie-break reason
  var tieBreakReason = null
  if (sorted.length >= 2 && Math.abs(primary.score - sorted[1].score) < 0.1) {
    tieBreakReason = 'Top two archetypes scored closely (' +
      Math.round(primary.score * 100) + ' vs ' + Math.round(sorted[1].score * 100) +
      '). Primary selected by higher confidence.'
    if (primary.confidence <= sorted[1].confidence) {
      tieBreakReason += ' Confidence was also close — consider reviewing evidence.'
    }
  }

  // Build scores map
  var scores = {}
  sorted.forEach(function(c) {
    scores[c.id] = Math.round(c.score * 100) / 100
  })

  // Get supporting/contradicting signal evidence
  var primaryArch = ARCHETYPE_DEFINITIONS[primary.id]
  var supportingSignals = []
  var contradictingSignals = []

  if (primaryArch && primaryArch.signalAffinity) {
    ;(primaryArch.signalAffinity.high || []).forEach(function(sigId) {
      if (signalScoreMap[sigId] && signalScoreMap[sigId] > 0.4) {
        supportingSignals.push(sigId)
      }
    })
    ;(primaryArch.signalAffinity.low || []).forEach(function(sigId) {
      if (signalScoreMap[sigId] && signalScoreMap[sigId] > 0.5) {
        contradictingSignals.push(sigId)
      }
    })
  }

  // Get primary traits from definition
  var primaryTraits = primaryArch ? (primaryArch.cognitiveTraits || []).slice(0, 3) : []
  var contradictingTraits = contradictingSignals.length > 0
    ? ['Evidence of counter-patterns: ' + contradictingSignals.join(', ')]
    : []

  return {
    primary: primary.id,
    secondary: secondary ? secondary.id : null,
    scores: scores,
    confidence: primary.confidence,
    primaryTraits: primaryTraits,
    contradictingTraits: contradictingTraits,
    tieBreakReason: tieBreakReason,
    candidateScores: sorted,
  }
}

module.exports = {
  inferArchetype,
}
