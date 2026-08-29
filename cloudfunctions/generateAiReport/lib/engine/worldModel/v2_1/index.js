/**
 * engine/worldModel/v2_1/index.js
 *
 * World Model v2.1 public surface — STATIC CONTRACT + EVIDENCE/SIGNAL/DIMENSION/
 * BLINDSPOT-CANDIDATE LAYER (Stage19A1 static tables + Stage19A2 evidence
 * normalizer & typed signal extractor + Stage19A3 dimension state engine +
 * Stage19A4 blindspot candidate engine).
 *
 * SHADOW ONLY. Exposes frozen static tables plus the semantic layers:
 * normalizeEvidenceV21 (answers → atomic evidence), extractSignalsV21 (atomic
 * evidence → typed signals), computeDimensionsV21 / resolveDimensionStateV21
 * (evidence → 9 dimension orientation/state), buildBlindSpotCandidatesV21 /
 * resolveBlindSpotStatusV21 (dimension → 9 blindspot candidate containers).
 * It MUST NOT expose primary selection, follow-up, response-validity, strategy,
 * report, adapter, pipeline, or runtime (all later stages).
 *
 * Authority priority: R3D > R3C > R3B > R3A > R3 > R2 > R1.
 * displayPosition is FORBIDDEN in cognition.
 *
 * @version world_model_v2_1
 */

const {
  QUESTIONNAIRE_VERSION_V21,
  QUESTION_COUNT_V21,
  CONSTRUCT_COUNT_V21,
  OPTION_PROPOSITION_COUNT_V21,
  CONSTRUCTS_V21,
  QUESTIONS_V21,
} = require('./questionnaireV21')

const {
  ATOMIC_EVIDENCE_COUNT_V21,
  EVIDENCE_CATALOG_V21,
} = require('./evidenceCatalogV21')

const { normalizeEvidenceV21 } = require('./evidenceNormalizerV21')
const { extractSignalsV21 } = require('./signalExtractorV21')
const { computeDimensionsV21, resolveDimensionStateV21 } = require('./dimensionEngineV21')
const { buildBlindSpotCandidatesV21, resolveBlindSpotStatusV21 } = require('./blindSpotCandidateEngineV21')
const { decidePrimaryV21, PRIMARY_STATUS_SET_V21 } = require('./primaryDecisionEngineV21')

module.exports = {
  QUESTIONNAIRE_VERSION_V21,
  QUESTION_COUNT_V21,
  CONSTRUCT_COUNT_V21,
  OPTION_PROPOSITION_COUNT_V21,
  CONSTRUCTS_V21,
  QUESTIONS_V21,
  ATOMIC_EVIDENCE_COUNT_V21,
  EVIDENCE_CATALOG_V21,
  normalizeEvidenceV21,
  extractSignalsV21,
  computeDimensionsV21,
  resolveDimensionStateV21,
  buildBlindSpotCandidatesV21,
  resolveBlindSpotStatusV21,
  decidePrimaryV21,
  PRIMARY_STATUS_SET_V21,
}
