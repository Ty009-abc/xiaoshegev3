/**
 * engine/worldModel/contracts.js
 *
 * RC8.3 Unified Contract System.
 *
 * All contracts are defined here. Every engine output must conform
 * to these contracts. Validators enforce compliance.
 *
 * The contract system ensures:
 * - Consistent output shape across engines
 * - Mandatory uncertainty reporting
 * - Evidence traceability
 * - No prohibited inference patterns
 * - Legacy adapter compatibility
 *
 * @version world_model_v1
 */

const { ONTOLOGY_VERSION, DIMENSION_SCORE_CONTRACT } = require('./ontology')

// ═══════════════════════════════════════════════════════════════
// WORLD MODEL OUTPUT CONTRACT (ROOT)
// ═══════════════════════════════════════════════════════════════

const WORLD_MODEL_CONTRACT = Object.freeze({
  version: 'world_model_v1',
  schema: 'https://xiaoshige.ai/schemas/world-model/v1',
  required: [
    'version',
    'behaviorSignals',
    'worldModel',
    'cognitiveArchetype',
    'cognitiveBlindSpot',
    'worldStrategy',
    'scenarioSimulation',
    'trace',
  ],
  type: 'object',
  properties: {
    version: { type: 'string', const: ONTOLOGY_VERSION },
    behaviorSignals: {
      type: 'array',
      items: {
        type: 'object',
        required: ['signalId', 'detected', 'confidence'],
        properties: {
          signalId: { type: 'string' },
          detected: { type: 'boolean' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          evidence: { type: 'array', items: { type: 'string' } },
          counterEvidence: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    worldModel: {
      type: 'object',
      required: [
        'DECISION_MODEL', 'RISK_MODEL', 'PROBABILITY_MODEL',
        'FEEDBACK_MODEL', 'OPPORTUNITY_MODEL', 'LEVERAGE_MODEL',
        'IDENTITY_MODEL', 'TIME_MODEL',
      ],
    },
    cognitiveArchetype: {
      type: 'object',
      required: ['primary', 'secondary', 'scores', 'confidence', 'primaryTraits', 'contradictingTraits'],
    },
    cognitiveBlindSpot: {
      type: 'object',
      required: ['id', 'label', 'confidence', 'mechanism', 'evidence', 'counterEvidence', 'whyItMatters', 'uncertainty'],
      properties: {
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        evidence: { type: 'array', minItems: 2 },
        counterEvidence: { type: 'array', minItems: 1 },
        uncertainty: { type: 'string', minLength: 10 },
      },
    },
    worldStrategy: {
      type: 'object',
      required: ['id', 'label', 'targetBlindSpot', 'mechanism', 'firstExperiment', 'successSignal', 'reviewWindow'],
    },
    scenarioSimulation: {
      type: 'object',
      required: ['currentModelScenario', 'upgradedModelScenario'],
    },
    trace: {
      type: 'object',
      required: ['evidenceIds', 'rulesTriggered', 'rulesSuppressed', 'conflictResolution', 'inputHash'],
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// LEGACY ADAPTER CONTRACT
// ═══════════════════════════════════════════════════════════════

const LEGACY_ADAPTER_CONTRACT = Object.freeze({
  version: 'world_model_v1',
  direction: 'WORLD_MODEL_TO_LEGACY',
  description: 'Adapts World Model output to legacy RC8 diagnosis format for backward compatibility with existing Runtime, Poster, and Cache.',
  rules: {
    neverReverseMap: true,
    legacyFieldsPreserved: [
      'code', 'message', 'data.reportId', 'data.reportType',
      'data.diagnosticVersion', 'data.engineVersion',
      'data.diagnosticSnapshot', 'data.fallbackSource',
      'data.fallbackReasonCode', 'data.legacyFallbackInvoked',
      'data.answersSnapshot',
    ],
    newFieldsAdded: [
      'data.worldModel',
      'data.renderSource',
    ],
    forbidden: [
      'Old diagnosis fields overwriting new worldModel fields',
      'Commercial direction as primary diagnosis in legacy output',
      'EMPLOYEE as archetype in legacy output',
      'Fortune-telling expressions in legacy output',
    ],
  },
  mapping: {
    worldModelArchetypeToLegacyWealthProfile: true,
    worldModelBlindSpotToLegacyBottleneck: true,
    worldModelStrategyToLegacyStrategy: true,
  },
})

// ═══════════════════════════════════════════════════════════════
// VALIDATION CONTRACT
// ═══════════════════════════════════════════════════════════════

const VALIDATION_CONTRACT = Object.freeze({
  version: 'world_model_v1',
  checks: {
    ontology: [
      'versionMatches',
      'allDimensionsPresent',
      'dimensionScoresInRange',
      'noProhibitedInferences',
      'evidenceMeetsMinimum',
      'uncertaintyStatementsPresent',
    ],
    signals: [
      'signalIdsValid',
      'signalConfidenceInRange',
      'detectedSignalsHaveEvidence',
      'conflictingSignalsNotBothDetected',
      'noOccupationBasedSignalDetection',
    ],
    archetype: [
      'archetypeIdValid',
      'primarySecondaryDistinct',
      'scoresSumReasonable',
      'noEmployeeAsArchetype',
      'noOccupationToArchetypeDirectMapping',
      'contradictingTraitsPresent',
    ],
    blindSpot: [
      'blindSpotIdValid',
      'notProhibitedBlindSpot',
      'onlyOnePrimary',
      'minimumEvidenceMet',
      'counterEvidenceReported',
      'uncertaintyMeaningful',
    ],
    strategy: [
      'strategyIdValid',
      'notProhibitedStrategy',
      'matchesTargetBlindSpot',
      'hasCognitiveMechanism',
      'firstExperimentIsCognitive',
      'hasObservableSuccessSignal',
    ],
    scenario: [
      'bothScenariosPresent',
      'noPredictionViolations',
      'noFortuneTellingLanguage',
      'noChickenSoupLanguage',
      'uncertaintySectionsPopulated',
      'changedVariableSpecified',
    ],
  },
  severity: {
    ontology: 'FATAL',
    archetype: 'FATAL',
    blindSpot: 'FATAL',
    strategy: 'ERROR',
    scenario: 'ERROR',
    signals: 'WARNING',
  },
})

// ═══════════════════════════════════════════════════════════════
// PROHIBITED EXPRESSION PATTERNS
// ═══════════════════════════════════════════════════════════════

const PROHIBITED_EXPRESSIONS = Object.freeze({
  prediction: [
    /一定会/g,
    /必然/g,
    /注定/g,
    /命中/g,
    /运势/g,
    /三年后/g,
    /五年后/g,
    /成功率\s*\d+%/g,
    /收入将达到/g,
    /月入\s*\d+/g,
    /年入\s*\d+/g,
  ],
  fortuneTelling: [
    /你的命运/g,
    /天注定/g,
    /命里/g,
    /天生/g,
    /星座/g,
    /运势/g,
  ],
  chickenSoup: [
    /加油/g,
    /坚持就会成功/g,
    /相信自己/g,
    /未来可期/g,
    /你一定可以/g,
    /你是最棒的/g,
  ],
  commercialDirectionAsDiagnosis: [
    /做AI/g,
    /做副业/g,
    /做短视频/g,
    /做个人IP/g,
    /接外包/g,
    /去创业/g,
    /做自媒体/g,
    /做网店/g,
  ],
})

// ═══════════════════════════════════════════════════════════════
// FEATURE FLAG CONTRACT
// ═══════════════════════════════════════════════════════════════

const FEATURE_FLAG_CONTRACT = Object.freeze({
  flagName: 'WORLD_MODEL_ENGINE_VERSION',
  allowedValues: ['legacy_rc8', 'world_model_v1'],
  defaultValue: 'legacy_rc8',
  requiresWhitelist: true,
  description: 'Switches between legacy RC8 engine and new World Model engine.',
  migrationRules: {
    noAutoEnable: true,
    requiresExplicitOptIn: true,
    whiteListOnlyForWorldModel: true,
    legacyAlwaysAvailable: true,
  },
})

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  WORLD_MODEL_CONTRACT,
  LEGACY_ADAPTER_CONTRACT,
  VALIDATION_CONTRACT,
  PROHIBITED_EXPRESSIONS,
  FEATURE_FLAG_CONTRACT,
}
