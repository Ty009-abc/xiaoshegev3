/**
 * presentation/worldModel/v2_1/northStarPresentationModelV21.js
 *
 * RC8.3 Stage1C-B — North Star Presentation Model.
 *
 * The deterministic semantic bridge between the Diagnosis Contract and the
 * future Report Builder. It converts trusted engine truth into a
 * user-explainable STRUCTURED model. It does NOT implement final UI copy or
 * final cards (that is Stage1C-C report builder + Stage1C-D UI).
 *
 * Architecture (frozen by ADR-RC8.3-STAGE1C-A):
 *   Questionnaire Evidence → Behavior Signals → World Model Engine →
 *   Diagnosis Contract → North Star Presentation Model (THIS) → Report Builder → UI
 *
 * HARD FREEZE: this module NEVER mutates engine truth, NEVER re-runs inference,
 * NEVER selects a different blind spot, NEVER invents evidence/world rules,
 * NEVER overrides strategy/scenario, NEVER performs economic inference or
 * fortune telling. Dependency direction is one-way (presentation → engine).
 *
 * Input (trusted existing engine outputs only):
 *   diagnosis  { status, primaryBlindSpotId, primaryConstruct, reasonCode, trace }
 *   answerTrace, evidenceTrace, dimensions, signals
 *
 * Multi-state support (frozen): A UNIQUE PRIMARY, B MULTIPLE_SUPPORTED_MODELS,
 * C NO_PRIMARY_DEFICIT, D INSUFFICIENT_DIRECTIONAL_EVIDENCE,
 * E CONTRADICTORY_EVIDENCE, F validity blocked / not executed.
 *
 * @version north_star_presentation_v1
 */

'use strict'

const { BLIND_SPOT_DEFINITIONS } = require('../../../engine/worldModel/blindSpotDefinitions')
const {
  buildUserCurrentModelV21,
  buildWorldOperatingRuleV21,
  buildModelMisalignmentV21,
  buildUpgradedModelV21,
  buildDecisionProtocolV21,
} = require('./worldPrinciplePresentationV21')
const {
  buildEvidenceExplanationV21,
  buildMultiModelEvidenceV21,
} = require('./evidenceExplanationV21')

const PRESENTATION_VERSION = 'north_star_presentation_v1'
const PRESENTATION_MODE = 'NORTH_STAR_PRESENTATION'

/**
 * PRIMARY_DIAGNOSIS — structured truth for unique-primary states.
 * Internal IDs stay in structured/provenance fields; raw enum tokens are not
 * user copy (the report builder localizes them later).
 */
function buildPrimaryDiagnosisV21(diagnosis) {
  const primaryId = diagnosis && diagnosis.primaryBlindSpotId
  if (!primaryId) return null
  const def = BLIND_SPOT_DEFINITIONS[primaryId] || {}
  return {
    blindSpotId: primaryId,
    blindSpotLabel: def.label || primaryId,
    sourceDimension: (diagnosis.primaryConstruct) || null,
    reasonCode: diagnosis.reasonCode || null,
  }
}

/**
 * SCENARIO_CONTRAST — transform scenario output into a structured
 * CURRENT_MODEL vs UPGRADED_MODEL comparison. Distinguishes decision/
 * interpretation change from future-outcome claim. Preserves uncertainty.
 */
function buildScenarioContrastV21(scenarioSimulation) {
  if (!scenarioSimulation) return null
  const cur = scenarioSimulation.currentModelScenario
  const up = scenarioSimulation.upgradedModelScenario
  if (!cur && !up) return null

  return {
    currentModel: cur ? {
      assumptions: Array.isArray(cur.assumptions) ? cur.assumptions : [],
      likelyDecisionPattern: Array.isArray(cur.likelyDecisionPattern) ? cur.likelyDecisionPattern : [],
      possibleConsequences: Array.isArray(cur.possibleConsequences) ? cur.possibleConsequences : [],
      uncertainty: Array.isArray(cur.uncertainty) ? cur.uncertainty : [],
    } : null,
    upgradedModel: up ? {
      changedVariable: up.changedVariable || '',
      assumptions: Array.isArray(up.assumptions) ? up.assumptions : [],
      likelyDecisionPattern: Array.isArray(up.likelyDecisionPattern) ? up.likelyDecisionPattern : [],
      possibleConsequences: Array.isArray(up.possibleConsequences) ? up.possibleConsequences : [],
      observableSignals: Array.isArray(up.observableSignals) ? up.observableSignals : [],
      uncertainty: Array.isArray(up.uncertainty) ? up.uncertainty : [],
    } : null,
    isDecisionChangeNotOutcomeClaim: true,
    noFortuneTelling: true,
    noPercentagePromise: true,
    noCertainWealthOutcome: true,
    uncertaintyPreserved: true,
  }
}

/**
 * SECONDARY_CONTEXT — collapsed archetype + full dimension map (per governance:
 * ARCHETYPE_REPORT_ROLE=COLLAPSE, DIMENSION_DASHBOARD_ROLE=SECONDARY). Archetype
 * contributes explanatory context only, never primary diagnosis authority.
 */
function buildSecondaryContextV21(cognitiveArchetype, dimensions) {
  const modelMap = (Array.isArray(dimensions) ? dimensions : []).map((d) => ({
    construct: d.construct,
    orientation: d.orientation,
    state: d.state,
    hSupport: d.hSupport,
    dSupport: d.dSupport,
    nSupport: d.nSupport,
  }))

  return {
    archetype: cognitiveArchetype
      ? {
          id: cognitiveArchetype.id,
          label: cognitiveArchetype.label,
          description: cognitiveArchetype.description,
          mode: cognitiveArchetype.mode || 'DESCRIPTIVE_ONLY',
          sourceBlindSpot: cognitiveArchetype.sourceBlindSpot || null,
        }
      : null,
    modelMap,
  }
}

/**
 * Build the full North Star presentation model for a single diagnosis.
 *
 * @param {object} params
 * @param {object} params.diagnosis        decidePrimaryV21 output (or null when blocked)
 * @param {Array}  params.answerTrace      {questionId, optionId, displayPosition}[]
 * @param {Array}  params.dimensions       computeDimensionsV21 output array
 * @param {object} params.cognitiveBlindSpot  report cognitiveBlindSpot (or null)
 * @param {object} params.worldStrategy        report worldStrategy (or null)
 * @param {object} params.cognitiveArchetype   report cognitiveArchetype (or null)
 * @param {object} params.scenarioSimulation   report scenarioSimulation (or null)
 * @param {object} params.validityStatus       'RESPONSE_VALID' | 'RESPONSE_QUALITY_LOW' | 'INSUFFICIENT_RESPONSE_QUALITY' | null
 * @returns {object} north star presentation model
 */
function buildNorthStarPresentationModelV21({
  diagnosis,
  answerTrace,
  dimensions,
  cognitiveBlindSpot,
  worldStrategy,
  cognitiveArchetype,
  scenarioSimulation,
  validityStatus,
}) {
  const decision = diagnosis || null
  const status = decision ? decision.status : (validityStatus ? 'NOT_EXECUTED' : 'NOT_EXECUTED')
  const reasonCode = decision ? decision.reasonCode : (validityStatus ? 'BLOCKED_BY_RESPONSE_VALIDITY' : 'NOT_EXECUTED')
  const primaryBlindSpotId = decision ? decision.primaryBlindSpotId : null

  const diagnosisState = {
    status,
    reasonCode,
    primaryBlindSpotId,
    primaryConstruct: decision ? decision.primaryConstruct : null,
    eligibleCandidateIds: decision && Array.isArray(decision.eligibleCandidateIds) ? decision.eligibleCandidateIds : [],
    eligibleConstructs: decision && Array.isArray(decision.eligibleConstructs) ? decision.eligibleConstructs : [],
    followupPair: decision && decision.followupPair ? decision.followupPair : null,
  }

  const primaryDiagnosis = buildPrimaryDiagnosisV21(decision)

  // ── Unique primary: full deterministic explanation surface ──────────────
  let userCurrentModel = null
  let worldOperatingRule = null
  let modelMisalignment = null
  let upgradedModel = null
  let decisionProtocol = null
  let evidenceExplanation = null
  let multiModelEvidence = null

  const primaryDim = primaryBlindSpotId
    ? (Array.isArray(dimensions) ? dimensions.find((d) => d && d.construct === (decision.primaryConstruct)) : null) || {}
    : null

  if (primaryBlindSpotId) {
    userCurrentModel = buildUserCurrentModelV21(primaryBlindSpotId)
    worldOperatingRule = buildWorldOperatingRuleV21(primaryBlindSpotId)
    modelMisalignment = buildModelMisalignmentV21(primaryBlindSpotId)
    upgradedModel = buildUpgradedModelV21(primaryBlindSpotId)
    decisionProtocol = buildDecisionProtocolV21(primaryBlindSpotId)

    const supportingQuestionIds = primaryDim && Array.isArray(primaryDim.dSupportQuestionIds)
      ? primaryDim.dSupportQuestionIds
      : []
    const rows = buildEvidenceExplanationV21({
      blindSpotId: primaryBlindSpotId,
      supportingQuestionIds,
      answerTrace,
      dimension: primaryDim,
    })
    evidenceExplanation = { blindSpotId: primaryBlindSpotId, rows, rowCount: rows.length }
  } else if (reasonCode === 'MULTIPLE_SUPPORTED_MODELS') {
    // Multi-model: no fabricated primary, preserve evidence per eligible model.
    const eligibleTrace = decision && Array.isArray(decision.trace)
      ? decision.trace.filter((t) => t && t.eligible === true)
      : []
    multiModelEvidence = buildMultiModelEvidenceV21({
      eligibleTrace,
      answerTrace,
      dimensions,
    })
  }

  // ── CAUSAL CHAIN — structured truth (answer evidence → behavior pattern →
  // world-model distortion → blind spot → likely decision consequence). The
  // decision consequence comes from frozen scenario definitions, never invented.
  const causalChain = {
    evidenceStep: evidenceExplanation ? { rowCount: evidenceExplanation.rowCount, source: 'answerTrace + evidenceCatalog' } : null,
    behaviorStep: null, // behavior signals are exposed via dimensions (construct-local)
    distortionStep: primaryDim ? { construct: primaryDim.construct, orientation: primaryDim.orientation, state: primaryDim.state } : null,
    blindSpotStep: primaryBlindSpotId ? { blindSpotId: primaryBlindSpotId } : null,
    decisionConsequenceStep: scenarioSimulation && scenarioSimulation.currentModelScenario
      ? { source: 'scenarioSimulation.currentModelScenario.possibleConsequences', conditional: true }
      : null,
    noInventedLifeOutcome: true,
    noWealthInference: true,
    noUnsupportedPsychologicalClaim: true,
  }

  const scenarioContrast = buildScenarioContrastV21(scenarioSimulation)
  const secondaryContext = buildSecondaryContextV21(cognitiveArchetype, dimensions)

  return {
    version: PRESENTATION_VERSION,
    presentationMode: PRESENTATION_MODE,
    diagnosisState,
    primaryDiagnosis,
    userCurrentModel,
    worldOperatingRule,
    modelMisalignment,
    evidenceExplanation,
    multiModelEvidence,
    causalChain,
    upgradedModel,
    decisionProtocol,
    scenarioContrast,
    secondaryContext,
    provenance: {
      sources: [
        'questionnaireV21',
        'evidenceCatalogV21',
        'blindSpotDefinitions',
        'worldPrinciples',
        'strategyDefinitions',
        'strategyEngineV2',
        'scenarioSimulationEngineV2',
        'archetypeDefinitions',
      ],
      deterministic: true,
      engineAuthority: 'WORLD_MODEL_V2_1_ENGINE',
      presentationOnly: true,
    },
  }
}

module.exports = {
  PRESENTATION_VERSION,
  PRESENTATION_MODE,
  buildPrimaryDiagnosisV21,
  buildScenarioContrastV21,
  buildSecondaryContextV21,
  buildNorthStarPresentationModelV21,
}
