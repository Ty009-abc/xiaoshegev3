/**
 * engine/worldModel/worldModelPipeline.js
 *
 * Unified World Model Pipeline — deterministic end-to-end diagnosis.
 *
 * Flow:
 *   normalizeEvidence
 *   → extractBehaviorSignalsV2
 *   → buildWorldModel
 *   → inferCognitiveArchetypeV2
 *   → inferCognitiveBlindSpotV2
 *   → selectWorldStrategyV2
 *   → simulateScenariosV2
 *   → validateWorldModelDiagnosis
 *   → return diagnosis
 *
 * 100% deterministic — same input → same output (including hash).
 *
 * @version world_model_v1
 */

const { normalizeEvidence } = require('./evidenceNormalizer')
const { extractSignals } = require('./behaviorSignalExtractorV2')
const { buildWorldModel } = require('./worldModelEngine')
const { inferArchetype } = require('./cognitiveArchetypeEngineV2')
const { inferBlindSpot } = require('./cognitiveBlindSpotEngineV2')
const { selectStrategy } = require('./worldStrategyEngineV2')
const { simulateScenarios } = require('./scenarioSimulationEngineV2')
const { validateWorldModelOutput } = require('./validators')

// ═══════════════════════════════════════════════════════════════
// Main pipeline entry point
// ═══════════════════════════════════════════════════════════════

/**
 * @param {Object} rawAnswers — raw questionnaire answers
 * @param {Object} options
 * @param {string} options.version — must be 'world_model_v1'
 * @returns {Object} World Model Diagnosis
 */
function runWorldModelPipeline(rawAnswers, options) {
  options = options || {}
  var version = options.version || 'world_model_v1'

  // Step 1: Normalize evidence
  var normalizedEvidence = normalizeEvidence(rawAnswers)

  // Step 2: Extract behavior signals
  var signalResult = extractSignals(normalizedEvidence)

  // Step 3: Build world model dimensions
  var worldModel = buildWorldModel(signalResult)

  // Step 4: Infer cognitive archetype
  var archetype = inferArchetype(worldModel, signalResult)

  // Step 5: Infer cognitive blind spot
  var blindSpot = inferBlindSpot(worldModel, signalResult)

  // Step 6: Select world strategy
  var strategy = selectStrategy(blindSpot, worldModel, signalResult)

  // Step 7: Simulate scenarios
  var scenarios = simulateScenarios(blindSpot, strategy, worldModel)

  // Step 8: Build trace
  var trace = buildTrace(normalizedEvidence, signalResult, blindSpot, strategy)

  // Step 9: Assemble output
  var diagnosis = {
    version: version,
    behaviorSignals: signalResult.signals,
    worldModel: worldModel,
    cognitiveArchetype: {
      primary: archetype.primary,
      secondary: archetype.secondary,
      scores: archetype.scores,
      confidence: archetype.confidence,
      primaryTraits: archetype.primaryTraits,
      contradictingTraits: archetype.contradictingTraits,
      tieBreakReason: archetype.tieBreakReason,
    },
    cognitiveBlindSpot: {
      id: blindSpot.id,
      label: blindSpot.label,
      confidence: blindSpot.confidence,
      mechanism: blindSpot.mechanism,
      evidence: blindSpot.evidence,
      counterEvidence: blindSpot.counterEvidence,
      whyItMatters: blindSpot.whyItMatters,
      uncertainty: blindSpot.uncertainty,
      ambiguity: blindSpot.ambiguity,
      rawGap: blindSpot.rawGap,
      tieDetected: blindSpot.tieDetected,
      tieBrokenBy: blindSpot.tieBrokenBy,
      candidateScores: blindSpot.candidateScores,
    },
    worldStrategy: {
      id: strategy.id,
      label: strategy.label,
      targetBlindSpot: strategy.targetBlindSpot,
      mechanism: strategy.mechanism,
      firstExperiment: strategy.firstExperiment,
      successSignal: strategy.successSignal,
      reviewWindow: strategy.reviewWindow,
      stopCondition: strategy.stopCondition,
      confidence: strategy.confidence,
      cognitiveUpgrade: strategy.cognitiveUpgrade,
    },
    scenarioSimulation: scenarios,
    trace: trace,
    // Metadata
    featureFlag: 'world_model_v1',
    inputHash: generateInputHash(rawAnswers),
    deterministic: true,
    generatedAt: new Date().toISOString(),
    inputCoverage: normalizedEvidence.coverageRatio,
  }

  // Validate output
  var validation = validateWorldModelOutput(diagnosis)

  return {
    valid: validation.valid,
    errors: validation.errors,
    diagnosis: diagnosis,
  }
}

// ═══════════════════════════════════════════════════════════════
// Trace builder
// ═══════════════════════════════════════════════════════════════

function buildTrace(normalizedEvidence, signalResult, blindSpot, strategy) {
  var evidenceIds = (normalizedEvidence.evidence || []).map(function(e) { return e.id })

  var conflictResolutions = (signalResult.conflicts || []).filter(function(c) {
    return c.resolution && c.resolution.winner
  }).map(function(c) {
    return {
      conflict: c.signalA + ' vs ' + c.signalB,
      resolution: c.resolution.strategy,
      winner: c.resolution.winner,
    }
  })

  return {
    evidenceIds: evidenceIds,
    evidenceCount: evidenceIds.length,
    rulesTriggered: signalResult.activeCount || 0,
    rulesSuppressed: signalResult.suppressedCount || 0,
    conflictResolution: conflictResolutions,
    inputHash: generateInputHash(null), // Will be set at pipeline level
    blindSpotCandidateCount: blindSpot ? (blindSpot.candidateScores || []).length : 0,
  }
}

// ═══════════════════════════════════════════════════════════════
// Input hash — deterministic fingerprint
// ═══════════════════════════════════════════════════════════════

function generateInputHash(rawAnswers) {
  if (!rawAnswers || typeof rawAnswers !== 'object') return 'empty_input'

  var keys = Object.keys(rawAnswers).sort()
  var parts = keys.map(function(k) {
    var v = rawAnswers[k]
    if (v === undefined || v === null) return k + '=null'
    return k + '=' + String(v)
  })

  // Simple deterministic hash
  var str = parts.join('|')
  var hash = 0
  for (var i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return 'wm_' + Math.abs(hash).toString(16)
}

module.exports = {
  runWorldModelPipeline,
  generateInputHash,
}
