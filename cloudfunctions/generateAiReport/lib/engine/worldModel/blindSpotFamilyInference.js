/**
 * engine/worldModel/blindSpotFamilyInference.js
 *
 * RC8.3 C3-002A R2 — Hierarchical Blind Spot Family Inference (Score-Normalized).
 *
 * Pure function: Secondary Signals + World Model Dimensions → Blind Spot Family.
 *
 * DOES NOT determine final Blind Spot — family-level only.
 *
 * R2 SCORING ARCHITECTURE:
 *   Evidence Density replaces per-family weight-budget scoring.
 *
 *   OLD (R1 per-family budget):
 *     familyScore = Σ(weight × sigScore/100) - Σ(weight × 0.5 for suppressed)
 *     Σweights = 1.0 per family → NOT comparable (EA weight=0.40 vs FG weight=0.15)
 *
 *   NEW (R2 evidence density):
 *     familyScore = Σ(fidelity × sigScore/100) - Σ(fidelity × 0.5 for suppressed)
 *     Fidelity weights use the same [0,1] scale across all families.
 *     A signal at fidelity 1.0 contributes 1.0 × score/100 in ANY family.
 *     → Comparable across families.
 *
 *   Saturation (secondary metric):
 *     saturation = familyScore / totalFidelity
 *     Measures how much of the family's diagnostic budget is activated.
 *     Used in confidence calculation, NOT ranking.
 *
 * FAMILY CONFIDENCE:
 *   Based on: saturation, gap magnitude, contradiction ratio, active count.
 *   Confidence is about RELIABILITY of inference, separate from raw density.
 *
 * DESIGN CONSTRAINTS:
 * - Family-size-invariant evidence density
 * - No family-specific boost factors or hidden offsets
 * - Deterministic
 * - 0 occupation/income/business reasoning
 * - Family scores must be comparable across families
 *
 * @version world_model_v3
 * @sprint c3-002a-r2
 */

var {
  BLIND_SPOT_FAMILIES,
  getAllFamilyIds,
  getFamily,
  SUPPRESSION_PENALTY_BASE,
} = require('./blindSpotFamilyDefinitions')

// ═══════════════════════════════════════════════════════════════
// EVIDENCE DENSITY SCORING (R2: family-size-invariant)
// ═══════════════════════════════════════════════════════════════

/**
 * Scores one family using Evidence Density.
 *
 * density = Σ(active_fidelity × sigScore/100) - Σ(suppressed_fidelity × PENALTY_BASE)
 * saturation = density / totalFidelity (secondary: family completeness)
 *
 * Density uses fidelity weights on a COMMON [0,1] scale:
 *   fidelity=1.0 means "maximally diagnostic signal"
 *   fidelity=0.25 means "weakly diagnostic signal"
 * These scales are the same across all families → comparable evidence density.
 */
function scoreFamily(family, secondarySignals) {
  var signalMap = {}
  secondarySignals.forEach(function (s) { signalMap[s.id] = s })

  var supporting = []
  var contradicting = []
  var rawDensity = 0
  var suppressedPenalty = 0
  var totalFidelity = 0

  family.secondarySignals.forEach(function (signalId) {
    totalFidelity += family.signalFidelity[signalId] || 0
  })

  family.secondarySignals.forEach(function (signalId) {
    var sig = signalMap[signalId]
    var fidelity = family.signalFidelity[signalId] || 0
    if (!sig || fidelity === 0) return

    if (sig.state === 'ACTIVE') {
      var sigScore = typeof sig.score === 'number' ? sig.score : 50
      var contribution = fidelity * (sigScore / 100)
      rawDensity += contribution
      supporting.push({
        signalId: signalId,
        state: sig.state,
        score: sig.score,
        fidelity: fidelity,
        contribution: Math.round(contribution * 1000) / 1000,
      })
    } else if (sig.state === 'SUPPRESSED') {
      var penalty = fidelity * SUPPRESSION_PENALTY_BASE
      suppressedPenalty += penalty
      contradicting.push({
        signalId: signalId,
        state: sig.state,
        fidelity: fidelity,
        penalty: Math.round(penalty * 1000) / 1000,
      })
    }
  })

  var density = Math.max(0, rawDensity - suppressedPenalty)
  var saturation = totalFidelity > 0 ? density / totalFidelity : 0
  var activeCount = supporting.length

  return {
    score: Math.round(density * 1000) / 1000,
    saturation: Math.round(saturation * 10000) / 10000,
    rawDensity: Math.round(rawDensity * 1000) / 1000,
    suppressedPenalty: Math.round(suppressedPenalty * 1000) / 1000,
    totalFidelity: totalFidelity,
    activeCount: activeCount,
    suppressedCount: contradicting.length,
    signalCount: family.secondarySignals.length,
    supporting: supporting,
    contradicting: contradicting,
  }
}

// ═══════════════════════════════════════════════════════════════
// AMBIGUITY DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * R2: gap is in density units [0, unbounded], comparable across families.
 *
 * Thresholds tuned for density scale (fidelity=1.0 @ score=100 → max per signal = 1.0):
 *   gap < 0.1 → strongly ambiguous (less than one weak signal's contribution)
 *   gap < 0.2 with top < 0.5 → weakly ambiguous
 *   top < 0.1 → insufficient signal
 *
 * Note: gap in density units is now comparable — 0.1 means the same thing
 * regardless of which family pair is being compared.
 */
function detectAmbiguity(ranked) {
  if (ranked.length < 2) return { ambiguous: false, rawGap: 0, alternateFamily: null }

  var top = ranked[0]
  var second = ranked[1]
  var rawGap = Math.round((top.score - second.score) * 1000) / 1000

  var ambiguous = rawGap < 0.1 || (rawGap < 0.2 && top.score < 0.5) || top.score < 0.1

  return {
    ambiguous: ambiguous,
    rawGap: rawGap,
    alternateFamily: ambiguous ? second.familyId : null,
  }
}

// ═══════════════════════════════════════════════════════════════
// MISSING EVIDENCE
// ═══════════════════════════════════════════════════════════════

function determineMissingEvidence(topFamily, familyDef) {
  var missing = []

  if (!topFamily || topFamily.activeCount === 0) {
    missing.push('No active secondary signals in any family')
    return missing
  }

  if (topFamily.activeCount < (familyDef.minimumSignals || 1)) {
    missing.push('Insufficient active signals: ' + topFamily.activeCount + ' < ' + familyDef.minimumSignals)
  }

  if (topFamily.suppressedCount > topFamily.activeCount) {
    missing.push('More suppressed than active signals — family evidence conflicted')
  }

  if (topFamily.score < 0.1) {
    missing.push('Evidence density too low for confident determination')
  }

  return missing
}

// ═══════════════════════════════════════════════════════════════
// FAMILY CONFIDENCE (R2: saturation-based)
// ═══════════════════════════════════════════════════════════════

/**
 * R2: Confidence uses saturation (family-completeness) and gap.
 *
 * Components:
 *   saturationConf: up to 0.45 from evidence saturation
 *   gapConf: up to 0.30 from gap magnitude (density-comparable)
 *   contradictionConf: up to 0.15 from clean evidence
 *   countConf: up to 0.10 from multiple independent signals
 */
function calculateFamilyConfidence(topFamily, gap) {
  if (!topFamily || topFamily.activeCount === 0) return 0

  var saturationConf = Math.min(topFamily.saturation * 0.6, 0.45)
  var gapConf = Math.min(gap * 1.5, 0.30)

  var ratio = topFamily.activeCount > 0
    ? topFamily.suppressedCount / (topFamily.activeCount + topFamily.suppressedCount)
    : 0
  var contradictionConf = 0.15 * (1 - Math.min(ratio, 1))
  var countConf = Math.min(topFamily.activeCount * 0.025, 0.10)

  return Math.max(0, Math.min(1, Math.round((saturationConf + gapConf + contradictionConf + countConf) * 100) / 100))
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════

function inferBlindSpotFamily(input) {
  if (!input) input = {}
  var secondarySignals = input.secondarySignals || []

  var familyIds = getAllFamilyIds()

  var scored = familyIds.map(function (familyId) {
    var family = getFamily(familyId)
    var result = scoreFamily(family, secondarySignals)
    return {
      familyId: familyId,
      score: result.score,
      saturation: result.saturation,
      evidenceDensity: result.rawDensity,
      suppressedPenalty: result.suppressedPenalty,
      totalFidelity: result.totalFidelity,
      supportingSignals: result.supporting,
      contradictingSignals: result.contradicting,
      activeCount: result.activeCount,
      suppressedCount: result.suppressedCount,
      signalCount: result.signalCount,
    }
  })

  scored.sort(function (a, b) { return b.score - a.score })

  var top = scored[0]
  var allZero = scored.every(function (s) { return s.score === 0 })

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
      missingEvidenceNeeded: ['No active secondary signals in any family — insufficient evidence'],
      trace: buildTrace(familyIds, secondarySignals, null, 0),
    }
  }

  var ambiguity = detectAmbiguity(scored)
  var familyDef = getFamily(top.familyId)
  var missingEvidence = determineMissingEvidence(top, familyDef)

  return {
    family: top.familyId,
    familyScores: buildScoreMap(scored),
    confidence: calculateFamilyConfidence(top, ambiguity.rawGap),
    supportingSignals: top.supportingSignals.map(function (s) { return s.signalId }),
    contradictingSignals: top.contradictingSignals.map(function (s) { return s.signalId }),
    ambiguous: ambiguity.ambiguous,
    alternateFamily: ambiguity.alternateFamily,
    rawGap: ambiguity.rawGap,
    missingEvidenceNeeded: missingEvidence.length > 0 ? missingEvidence : [],
    trace: buildTrace(familyIds, secondarySignals, top, ambiguity.rawGap),
  }
}

function buildTrace(familyIds, signals, top, gap) {
  return {
    familiesScored: familyIds.length,
    topFamily: top ? top.familyId : null,
    topFamilyScore: top ? top.score : 0,
    topSaturation: top ? top.saturation : 0,
    topActiveCount: top ? top.activeCount : 0,
    topSuppressedCount: top ? top.suppressedCount : 0,
    gapToSecond: gap,
    totalActiveSignals: signals.filter(function (s) { return s.state === 'ACTIVE' }).length,
    totalSuppressedSignals: signals.filter(function (s) { return s.state === 'SUPPRESSED' }).length,
    topSupporting: top ? top.supportingSignals : [],
    topContradicting: top ? top.contradictingSignals : [],
  }
}

function buildScoreMap(scored) {
  var map = {}
  scored.forEach(function (s) { map[s.familyId] = s.score })
  return map
}

module.exports = {
  inferBlindSpotFamily,
  scoreFamily,
  detectAmbiguity,
  calculateFamilyConfidence,
  getAllFamilyIds,
}
