/**
 * engine/worldModel/v2_1/index.js
 *
 * World Model v2.1 public surface — STATIC CONTRACT + EVIDENCE/SIGNAL LAYER
 * (Stage19A1 static tables + Stage19A2 evidence normalizer & typed signal extractor).
 *
 * SHADOW ONLY. Exposes frozen static tables plus the A2 semantic layer:
 * normalizeEvidenceV21 (answers → atomic evidence) and extractSignalsV21
 * (atomic evidence → typed signals). It MUST NOT expose dimension scoring,
 * blindspot, primary selection, follow-up, response-validity, strategy, report,
 * adapter, pipeline, or runtime (all later stages).
 *
 * Authority priority: R3C > R3B > R3A > R3 > R2 > R1.
 * displayPosition is FORBIDDEN in the static contract.
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
}
