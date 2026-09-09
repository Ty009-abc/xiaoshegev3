/**
 * presentation/worldModel/v2_1/index.js
 *
 * RC8.3 Stage1C-B — North Star Presentation Model public surface.
 *
 * DETERMINISTIC EXPLANATION ONLY. Presentation modules consume engine outputs
 * and frozen definitions; they are NEVER imported by inference modules.
 *
 * Dependency direction (one-way, frozen):
 *   presentation → engine outputs / frozen definitions   (allowed)
 *   engine       → presentation                          (FORBIDDEN)
 *
 * @version north_star_presentation_v1
 */

'use strict'

const {
  PRESENTATION_VERSION,
  PRESENTATION_MODE,
  buildNorthStarPresentationModelV21,
  buildPrimaryDiagnosisV21,
  buildScenarioContrastV21,
  buildSecondaryContextV21,
} = require('./northStarPresentationModelV21')

const {
  buildUserCurrentModelV21,
  buildWorldOperatingRuleV21,
  buildModelMisalignmentV21,
  buildUpgradedModelV21,
  buildDecisionProtocolV21,
  getPrincipleForBlindSpot,
  getStrategyForBlindSpot,
} = require('./worldPrinciplePresentationV21')

const {
  buildEvidenceExplanationV21,
  buildMultiModelEvidenceV21,
  indexAnswersV21,
  optionTextV21,
} = require('./evidenceExplanationV21')

const {
  validateNorthStarPresentationV21,
  FORBIDDEN_FIELDS,
  PREDICTION_TOKENS,
} = require('./northStarPresentationValidatorV21')

module.exports = {
  PRESENTATION_VERSION,
  PRESENTATION_MODE,
  buildNorthStarPresentationModelV21,
  buildPrimaryDiagnosisV21,
  buildScenarioContrastV21,
  buildSecondaryContextV21,
  buildUserCurrentModelV21,
  buildWorldOperatingRuleV21,
  buildModelMisalignmentV21,
  buildUpgradedModelV21,
  buildDecisionProtocolV21,
  getPrincipleForBlindSpot,
  getStrategyForBlindSpot,
  buildEvidenceExplanationV21,
  buildMultiModelEvidenceV21,
  indexAnswersV21,
  optionTextV21,
  validateNorthStarPresentationV21,
  FORBIDDEN_FIELDS,
  PREDICTION_TOKENS,
}
