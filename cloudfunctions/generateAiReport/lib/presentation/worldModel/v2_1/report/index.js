/**
 * presentation/worldModel/v2_1/report/index.js
 *
 * RC8.3 Stage1C-C — North Star Report Builder public surface.
 *
 * DETERMINISTIC REPORT CONTENT MODEL ONLY. Converts north_star_presentation_v1
 * into structured Chinese report sections. No WXML/WXSS/UI, no runtime wiring,
 * no engine calls.
 *
 * Dependency direction (one-way, frozen):
 *   report builder → northStarPresentationModel   (allowed)
 *   presentation model → report builder           (FORBIDDEN)
 *   engine → report builder                       (FORBIDDEN)
 *
 * @version north_star_report_v1
 */

'use strict'

const {
  REPORT_VERSION,
  buildNorthStarReportV21,
  buildVerdictSection,
  buildCurrentModelSection,
  buildWorldRuleSection,
  buildEvidenceSection,
  buildConsequenceSection,
  buildUpgradeSection,
  buildProtocolSection,
  buildScenarioSection,
  buildSecondaryContextSection,
} = require('./northStarReportBuilderV21')

const {
  validateNorthStarReportV21,
  collectUserStrings,
  isEnglishParagraph,
} = require('./northStarReportValidatorV21')

const copy = require('./northStarReportCopyV21')

module.exports = {
  REPORT_VERSION,
  buildNorthStarReportV21,
  buildVerdictSection,
  buildCurrentModelSection,
  buildWorldRuleSection,
  buildEvidenceSection,
  buildConsequenceSection,
  buildUpgradeSection,
  buildProtocolSection,
  buildScenarioSection,
  buildSecondaryContextSection,
  validateNorthStarReportV21,
  collectUserStrings,
  isEnglishParagraph,
  copy,
}
