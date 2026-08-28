/**
 * engine/worldModel/v2_1/index.js
 *
 * World Model v2.1 public surface — STATIC CONTRACT EXPORTS ONLY (Stage19A1).
 *
 * SHADOW ONLY. This layer exposes frozen static tables. It MUST NOT expose
 * inference, signal extraction, dimension scoring, response-validity,
 * blindspot, follow-up, strategy, report, adapter, or pipeline (all later stages).
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

module.exports = {
  QUESTIONNAIRE_VERSION_V21,
  QUESTION_COUNT_V21,
  CONSTRUCT_COUNT_V21,
  OPTION_PROPOSITION_COUNT_V21,
  CONSTRUCTS_V21,
  QUESTIONS_V21,
  ATOMIC_EVIDENCE_COUNT_V21,
  EVIDENCE_CATALOG_V21,
}
