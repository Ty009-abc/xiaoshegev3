/**
 * engine/worldModel/v2/index.js
 *
 * World Model v2 public surface. Fully isolated from v1.
 * @version world_model_v2
 */

const { QUESTIONS_V2, OPTIONS_V2, DIAGNOSTIC_VERSION_V2 } = require('./questionnaireV2')
const { normalizeEvidenceV2, EVIDENCE_DEFINITIONS_V2 } = require('./evidenceNormalizerV2')
const { extractSignalsV2, SIGNAL_DEFINITIONS_V2 } = require('./signalExtractorV2')
const { buildDimensionsV2, DIMENSION_DEFINITIONS_V2, STATE_THRESHOLDS_V2 } = require('./dimensionEngineV2')
const { inferBlindSpotV2, BLIND_SPOT_DEFINITIONS_V2 } = require('./blindSpotEngineV2')
const { selectStrategyV2, BLIND_SPOT_TO_STRATEGY_V2 } = require('./strategyEngineV2')
const { computeArchetypeV2 } = require('./archetypeV2')
const { runWorldModelPipelineV2 } = require('./pipelineV2')
const { adaptWorldModelToLegacyV2 } = require('./adapterV2')
const { validateV2Answers, REQUIRED_COUNT_V2 } = require('./payloadValidatorV2')

module.exports = {
  DIAGNOSTIC_VERSION_V2,
  QUESTIONS_V2,
  OPTIONS_V2,
  EVIDENCE_DEFINITIONS_V2,
  SIGNAL_DEFINITIONS_V2,
  DIMENSION_DEFINITIONS_V2,
  BLIND_SPOT_DEFINITIONS_V2,
  BLIND_SPOT_TO_STRATEGY_V2,
  STATE_THRESHOLDS_V2,
  normalizeEvidenceV2,
  extractSignalsV2,
  buildDimensionsV2,
  inferBlindSpotV2,
  selectStrategyV2,
  computeArchetypeV2,
  runWorldModelPipelineV2,
  adaptWorldModelToLegacyV2,
  validateV2Answers,
  REQUIRED_COUNT_V2,
}
