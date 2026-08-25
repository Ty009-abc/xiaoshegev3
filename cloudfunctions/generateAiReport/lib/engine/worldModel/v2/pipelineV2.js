/**
 * engine/worldModel/v2/pipelineV2.js
 *
 * World Model v2 — unified deterministic pipeline:
 *   answers → evidence → signals → dimensions → blindSpot → strategy
 *   (archetype: descriptive-only, computed last, never feeds back)
 *
 * @version world_model_v2
 */

const { normalizeEvidenceV2 } = require('./evidenceNormalizerV2')
const { extractSignalsV2 } = require('./signalExtractorV2')
const { buildDimensionsV2 } = require('./dimensionEngineV2')
const { inferBlindSpotV2 } = require('./blindSpotEngineV2')
const { selectStrategyV2 } = require('./strategyEngineV2')
const { computeArchetypeV2 } = require('./archetypeV2')
const { DIAGNOSTIC_VERSION_V2 } = require('./questionnaireV2')

function generateInputHashV2(answers) {
  if (!answers || typeof answers !== 'object') return 'v2_empty'
  // Only Q_* question keys form the inference identity. Context fields
  // (lifeStage / incomeStructure / occupationDetail / ...) have zero inference
  // weight and must NOT alter the input hash.
  var keys = Object.keys(answers).filter(function (k) { return k.indexOf('Q_') === 0 }).sort()
  var parts = keys.map(function (k) { return k + '=' + String(answers[k]) })
  var str = parts.join('|')
  var hash = 0
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return 'v2_' + Math.abs(hash).toString(16)
}

/**
 * Run the full world_model_v2 pipeline on frozen { questionId: optionId } answers.
 * Context fields (lifeStage/income/occupation/etc.) are IGNORED — inference
 * weight = 0 by construction (the normalizer only reads questionId+optionId).
 */
function runWorldModelPipelineV2(answers) {
  var normalized = normalizeEvidenceV2(answers)
  var signals = extractSignalsV2(normalized)
  var dimensions = buildDimensionsV2(signals)
  var blindSpot = inferBlindSpotV2(dimensions, normalized)
  var strategy = selectStrategyV2(blindSpot.id)
  var archetype = computeArchetypeV2() // descriptive-only, null for now

  var diagnosis = {
    version: DIAGNOSTIC_VERSION_V2,
    inputHash: generateInputHashV2(answers),
    deterministic: true,
    answeredCount: normalized.answeredCount,
    coverageRatio: normalized.coverageRatio,
    evidence: normalized.evidence,
    signals: signals,
    worldModel: dimensions,
    cognitiveBlindSpot: blindSpot,
    worldStrategy: strategy,
    cognitiveArchetype: archetype,
  }

  return {
    valid: !!(blindSpot && strategy),
    diagnosis: diagnosis,
  }
}

module.exports = {
  runWorldModelPipelineV2,
  generateInputHashV2,
}
