/**
 * engine/worldModel/confidenceCalculator.js
 *
 * Deterministic confidence calculation utilities for World Model Engine.
 *
 * All confidence values are:
 * - Computed deterministically (no randomness)
 * - Based on evidence quality and quantity
 * - Never derived from occupation or income labels
 *
 * @version world_model_v1
 */

// ═══════════════════════════════════════════════════════════════
// Confidence thresholds
// ═══════════════════════════════════════════════════════════════

const CONFIDENCE_THRESHOLDS = Object.freeze({
  HIGH: 0.75,
  MEDIUM: 0.5,
  LOW: 0.3,
  MINIMUM: 0.1,
})

// ═══════════════════════════════════════════════════════════════
// Evidence quality scoring
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate confidence for a single signal based on evidence.
 *
 * @param {Array} supportingEvidence - list of evidence objects with strength
 * @param {Array} contradictingEvidence - list of contradicting evidence objects
 * @param {number} minEvidence - minimum required evidence pieces
 * @returns {number} confidence 0-1
 */
function calculateSignalConfidence(supportingEvidence, contradictingEvidence, minEvidence) {
  minEvidence = minEvidence || 1
  var supCount = (supportingEvidence || []).length
  var conCount = (contradictingEvidence || []).length

  if (supCount < minEvidence) {
    return CONFIDENCE_THRESHOLDS.MINIMUM * (supCount / minEvidence)
  }

  var supStrength = (supportingEvidence || []).reduce(function(s, e) {
    return s + (e.strength || 0.5)
  }, 0) / Math.max(1, supCount)

  var conStrength = conCount === 0 ? 0 : (contradictingEvidence || []).reduce(function(s, e) {
    return s + (e.strength || 0.5)
  }, 0) / conCount

  var rawConfidence = supStrength * (1 - conStrength * 0.5) * Math.min(1, supCount / (minEvidence * 2))

  return clamp(rawConfidence, CONFIDENCE_THRESHOLDS.MINIMUM, 0.95)
}

/**
 * Calculate dimension confidence based on signal evidence.
 */
function calculateDimensionConfidence(supportingSignals, contradictingSignals) {
  var supCount = (supportingSignals || []).length
  var conCount = (contradictingSignals || []).length

  if (supCount === 0) return CONFIDENCE_THRESHOLDS.LOW

  var supAvgConf = supportingSignals.reduce(function(s, sig) {
    return s + (sig.confidence || 0.3)
  }, 0) / supCount

  // Contradicting signals reduce confidence
  var conPenalty = conCount > 0 ? 0.15 * conCount : 0

  return clamp(supAvgConf - conPenalty, CONFIDENCE_THRESHOLDS.MINIMUM, 0.95)
}

/**
 * Calculate blind spot confidence.
 */
function calculateBlindSpotConfidence(supportingSignals, contradictingSignals, dimensionScore) {
  var supCount = (supportingSignals || []).length
  var conCount = (contradictingSignals || []).length

  if (supCount < 2) return CONFIDENCE_THRESHOLDS.LOW

  var supAvg = supportingSignals.reduce(function(s, sig) {
    return s + (sig.confidence || sig.score || 0.3)
  }, 0) / supCount

  var conAvg = conCount === 0 ? 0 : contradictingSignals.reduce(function(s, sig) {
    return s + (sig.confidence || sig.score || 0.3)
  }, 0) / conCount

  var raw = (supAvg * 0.6 + (dimensionScore || 0.5) * 0.4) * (1 - conAvg * 0.4)

  return clamp(raw, CONFIDENCE_THRESHOLDS.MINIMUM, 0.92)
}

/**
 * Calculate archetype confidence.
 */
function calculateArchetypeConfidence(matchedSignals, totalRelevantSignals, contradictingCount) {
  if (totalRelevantSignals === 0) return CONFIDENCE_THRESHOLDS.LOW

  var matchRatio = matchedSignals / Math.max(1, totalRelevantSignals)
  var conPenalty = contradictingCount * 0.1

  return clamp(matchRatio - conPenalty, CONFIDENCE_THRESHOLDS.MINIMUM, 0.95)
}

/**
 * Determine overall confidence level category.
 */
function confidenceLevel(confidence) {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'HIGH'
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'MEDIUM'
  return 'LOW'
}

/**
 * Generate uncertainty statement based on evidence quality.
 */
function buildUncertainty(supportingCount, contradictingCount, evidenceQuality) {
  if (supportingCount === 0) {
    return '当前证据不足，此评估存在较大不确定性。结论基于有限信息，需要更多数据进行验证。'
  }
  if (contradictingCount > supportingCount) {
    return '检测到多处矛盾证据，此评估的置信度较低。不同信号指向不同方向，建议更多数据确认。'
  }
  if (evidenceQuality < 0.3) {
    return '部分关键数据缺失或质量较低，此评估存在不确定性。建议补充信息后重新评估。'
  }
  if (supportingCount === 1) {
    return '当前基于单一证据来源，可能存在偏差。多数据点交叉验证会增加结论可靠性。'
  }
  return '此评估基于当前可用证据，但仍受数据完整性和个体差异影响。结果仅供认知参考，不应视为确定性结论。'
}

// ═══════════════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════════════

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

module.exports = {
  calculateSignalConfidence,
  calculateDimensionConfidence,
  calculateBlindSpotConfidence,
  calculateArchetypeConfidence,
  confidenceLevel,
  buildUncertainty,
  CONFIDENCE_THRESHOLDS,
}
