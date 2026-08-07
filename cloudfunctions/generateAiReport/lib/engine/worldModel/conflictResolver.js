/**
 * engine/worldModel/conflictResolver.js
 *
 * Deterministic conflict resolution for World Model Engine.
 *
 * When signals conflict (e.g., both RISK_AVOIDANCE and DOWNSIDE_AWARENESS
 * are detected), this module resolves the conflict by:
 * 1. Comparing evidence quality and quantity
 * 2. Applying context-specific precedence rules
 * 3. Recording the conflict for audit
 *
 * All resolution is fully deterministic. No randomness.
 *
 * @version world_model_v1
 */

const { ALL_SIGNALS } = require('./signalDefinitions')

// ═══════════════════════════════════════════════════════════════
// Resolution strategies
// ═══════════════════════════════════════════════════════════════

const RESOLUTION_STRATEGIES = Object.freeze({
  STRONGER_WINS: 'stronger_wins',       // Signal with higher confidence wins
  EVIDENCE_WEIGHTED: 'evidence_weighted', // Weight by evidence count × confidence
  SUPPRESS_BOTH: 'suppress_both',       // Conflict too high → suppress both
  KEEP_BOTH: 'keep_both',               // Both valid in different contexts
})

// ═══════════════════════════════════════════════════════════════
// Main conflict detector and resolver
// ═══════════════════════════════════════════════════════════════

/**
 * Detect all conflicting signal pairs in a signal array.
 * Returns list of conflict pairs with resolution.
 */
function detectConflicts(activeSignals) {
  var conflicts = []
  var signalMap = {}

  activeSignals.forEach(function(sig) {
    signalMap[sig.id] = sig
  })

  activeSignals.forEach(function(sig) {
    var def = ALL_SIGNALS[sig.id]
    if (!def || !def.conflictsWith) return

    def.conflictsWith.forEach(function(conflictId) {
      var conflictSig = signalMap[conflictId]
      if (!conflictSig) return

      // Avoid duplicate pairs
      var alreadyRecorded = conflicts.some(function(c) {
        return (c.signalA === sig.id && c.signalB === conflictId) ||
               (c.signalA === conflictId && c.signalB === sig.id)
      })
      if (alreadyRecorded) return

      var resolution = resolvePair(sig, conflictSig)
      conflicts.push({
        signalA: sig.id,
        signalB: conflictId,
        scoreA: sig.score,
        scoreB: conflictSig.score,
        confidenceA: sig.confidence,
        confidenceB: conflictSig.confidence,
        evidenceCountA: (sig.supportingEvidence || []).length,
        evidenceCountB: (conflictSig.supportingEvidence || []).length,
        resolution: resolution,
      })
    })
  })

  return conflicts
}

/**
 * Resolve a single conflicting pair.
 */
function resolvePair(signalA, signalB) {
  var scoreDiff = signalA.score - signalB.score
  var confDiff = signalA.confidence - signalB.confidence
  var evidenceDiff = (signalA.supportingEvidence || []).length - (signalB.supportingEvidence || []).length

  // If one signal is significantly stronger in all dimensions, it wins
  if (scoreDiff > 0.3 && confDiff > 0.1 && evidenceDiff >= 0) {
    return {
      strategy: RESOLUTION_STRATEGIES.STRONGER_WINS,
      winner: signalA.id,
      loser: signalB.id,
      reason: 'Signal A has higher score (+' + Math.round(scoreDiff * 100) / 100 + '), confidence (+' + Math.round(confDiff * 100) / 100 + '), and more evidence',
    }
  }

  if (scoreDiff < -0.3 && confDiff < -0.1 && evidenceDiff <= 0) {
    return {
      strategy: RESOLUTION_STRATEGIES.STRONGER_WINS,
      winner: signalB.id,
      loser: signalA.id,
      reason: 'Signal B has higher score (+' + Math.round(-scoreDiff * 100) / 100 + '), confidence (+' + Math.round(-confDiff * 100) / 100 + '), and more evidence',
    }
  }

  // Evidence-weighted: both have meaningful evidence
  var weightedA = signalA.score * signalA.confidence * (signalA.supportingEvidence || []).length
  var weightedB = signalB.score * signalB.confidence * (signalB.supportingEvidence || []).length

  if (Math.abs(weightedA - weightedB) > 0.5) {
    return {
      strategy: RESOLUTION_STRATEGIES.EVIDENCE_WEIGHTED,
      winner: weightedA > weightedB ? signalA.id : signalB.id,
      loser: weightedA > weightedB ? signalB.id : signalA.id,
      reason: 'Evidence-weighted decision: A=' + Math.round(weightedA * 100) / 100 + ' vs B=' + Math.round(weightedB * 100) / 100,
    }
  }

  // Close conflict — suppress both
  return {
    strategy: RESOLUTION_STRATEGIES.SUPPRESS_BOTH,
    winner: null,
    loser: null,
    reason: 'Conflict too close to resolve (' + Math.round(scoreDiff * 100) / 100 + '); both signals suppressed',
  }
}

/**
 * Apply conflict resolution to a signal array.
 * Suppresses losing signals and adjusts scores accordingly.
 */
function applyConflictResolution(activeSignals, conflicts) {
  var suppressed = {}

  conflicts.forEach(function(c) {
    if (c.resolution.strategy === RESOLUTION_STRATEGIES.SUPPRESS_BOTH) {
      suppressed[c.signalA] = true
      suppressed[c.signalB] = true
    } else if (c.resolution.loser) {
      suppressed[c.resolution.loser] = true
    }
  })

  return activeSignals.map(function(sig) {
    if (suppressed[sig.id]) {
      return Object.assign({}, sig, {
        state: 'SUPPRESSED',
        score: Math.min(sig.score * 0.3, 0.2),
        confidence: Math.min(sig.confidence * 0.5, 0.15),
        suppressed: true,
        suppressedBy: 'CONFLICT_RESOLUTION',
      })
    }
    return sig
  })
}

module.exports = {
  detectConflicts,
  applyConflictResolution,
  RESOLUTION_STRATEGIES,
}
