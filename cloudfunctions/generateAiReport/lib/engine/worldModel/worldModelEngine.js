/**
 * engine/worldModel/worldModelEngine.js
 *
 * Builds the 8 World Model Dimensions from extracted behavior signals.
 *
 * Each dimension is scored based on its associated signals.
 * The engine does NOT introduce new evidence — it synthesizes from signals.
 * Explanations are derived from signal patterns, not generated.
 *
 * @version world_model_v1
 */

const { DIMENSIONS } = require('./ontology')
const { SIGNAL_CATEGORIES } = require('./signalDefinitions')
const { calculateDimensionConfidence, buildUncertainty } = require('./confidenceCalculator')

// ═══════════════════════════════════════════════════════════════
// Dimension score thresholds
// ═══════════════════════════════════════════════════════════════

const STATE_THRESHOLDS = Object.freeze({
  STRONG: 0.7,
  FUNCTIONAL: 0.5,
  DEVELOPING: 0.3,
  // Below 0.3 = WEAK
})

// ═══════════════════════════════════════════════════════════════
// Main engine
// ═══════════════════════════════════════════════════════════════

function buildWorldModel(signalResult) {
  var allSignals = signalResult.signals || []
  var signalsByDim = {}

  // Group signals by dimension
  allSignals.forEach(function(sig) {
    if (!signalsByDim[sig.dimension]) signalsByDim[sig.dimension] = []
    signalsByDim[sig.dimension].push(sig)
  })

  // Build each dimension
  var dimIds = Object.keys(DIMENSIONS)
  var worldModel = {}

  dimIds.forEach(function(dimId) {
    var dimSignals = signalsByDim[dimId] || []
    var supporting = dimSignals.filter(function(s) { return s.state === 'ACTIVE' || s.state === 'WEAK' })
    var contradicting = dimSignals.filter(function(s) { return s.state === 'SUPPRESSED' })

    var score = calculateDimensionScore(supporting, contradicting)
    var state = determineState(score)
    var confidence = calculateDimensionConfidence(supporting, contradicting)
    var explanation = buildDimensionExplanation(dimId, state, score, supporting, contradicting)
    var uncertainty = buildUncertainty(supporting.length, contradicting.length, score)

    worldModel[dimId] = {
      id: dimId,
      score: score,
      state: state,
      confidence: confidence,
      supportingSignals: supporting.map(function(s) { return s.id }),
      contradictingSignals: contradicting.map(function(s) { return s.id }),
      explanation: explanation,
      uncertainty: uncertainty,
    }
  })

  return worldModel
}

// ═══════════════════════════════════════════════════════════════
// Dimension score calculation
// ═══════════════════════════════════════════════════════════════

function calculateDimensionScore(supporting, contradicting) {
  if (supporting.length === 0 && contradicting.length === 0) {
    return 0.3 // Default neutral — no evidence either way
  }

  // Safe score extraction: valid numeric 0..1 preserved, invalid/missing → fallback
  function safeSupScore(sig) { var v = Number(sig.score); return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.3 }
  function safeConScore(sig) { var v = Number(sig.score); return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0 }

  var supScore = supporting.length === 0 ? 0
    : supporting.reduce(function(s, sig) { return s + safeSupScore(sig) }, 0) / supporting.length

  var conPenalty = contradicting.length === 0 ? 0
    : contradicting.reduce(function(s, sig) { return s + safeConScore(sig) }, 0) * 0.25

  // Weight active signals more heavily
  var activeCount = supporting.filter(function(s) { return s.state === 'ACTIVE' }).length
  var activeBonus = activeCount > 0 ? 0.05 * Math.min(3, activeCount) : 0

  return Math.max(0, Math.min(1, supScore - conPenalty + activeBonus))
}

// ═══════════════════════════════════════════════════════════════
// State determination
// ═══════════════════════════════════════════════════════════════

function determineState(score) {
  if (score >= STATE_THRESHOLDS.STRONG) return 'STRONG'
  if (score >= STATE_THRESHOLDS.FUNCTIONAL) return 'FUNCTIONAL'
  if (score >= STATE_THRESHOLDS.DEVELOPING) return 'DEVELOPING'
  return 'WEAK'
}

// ═══════════════════════════════════════════════════════════════
// Explanation generation — derived from signal patterns, not AI
// ═══════════════════════════════════════════════════════════════

function buildDimensionExplanation(dimId, state, score, supporting, contradicting) {
  var dim = DIMENSIONS[dimId]
  if (!dim) return 'Dimension evaluation based on available evidence.'

  var activeKeys = supporting.filter(function(s) { return s.state === 'ACTIVE' }).map(function(s) { return s.id })
  var weakKeys = supporting.filter(function(s) { return s.state === 'WEAK' }).map(function(s) { return s.id })

  switch (state) {
    case 'STRONG':
      return '该维度表现较强，多项信号一致指向功能性良好的认知模式。'
    case 'FUNCTIONAL':
      return '该维度基本达到功能性水平，存在部分发展空间。'
    case 'DEVELOPING':
      return '该维度处于发展中，存在可识别的成长空间。当前模式在部分情境下有效，但在复杂或新情境下可能受限。'
    case 'WEAK':
    default:
      if (supporting.length === 0 && contradicting.length === 0) {
        return '该维度缺乏足够数据进行评估。建议完成更多相关问题的回答以获得更准确的结果。'
      }
      return '该维度当前表现较弱，多项信号存在不一致或缺乏证据支持的模式。此区域可能是认知升级的重点。'
  }
}

// ═══════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════

function getDimensionById(worldModel, dimId) {
  return worldModel[dimId] || null
}

function getWeakestDimension(worldModel) {
  var dims = Object.keys(worldModel)
  var weakest = null
  var lowest = 1

  dims.forEach(function(dimId) {
    var d = worldModel[dimId]
    if (d && d.score < lowest) {
      lowest = d.score
      weakest = d
    }
  })

  return weakest
}

function getStrongestDimension(worldModel) {
  var dims = Object.keys(worldModel)
  var strongest = null
  var highest = -1

  dims.forEach(function(dimId) {
    var d = worldModel[dimId]
    if (d && d.score > highest) {
      highest = d.score
      strongest = d
    }
  })

  return strongest
}

module.exports = {
  buildWorldModel,
  calculateDimensionScore,
  determineState,
  buildDimensionExplanation,
  getDimensionById,
  getWeakestDimension,
  getStrongestDimension,
  STATE_THRESHOLDS,
}
