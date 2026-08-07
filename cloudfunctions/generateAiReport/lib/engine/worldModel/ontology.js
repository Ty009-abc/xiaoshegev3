/**
 * engine/worldModel/ontology.js
 *
 * RC8.3 World Model Ontology — the single source of truth for the cognitive model.
 *
 * All engines, signals, archetypes, blind spots, strategies, and simulations
 * are validated against this ontology.
 *
 * Principle: The Ontology defines the Engine — not the other way around.
 *
 * @version world_model_v1
 */

// ═══════════════════════════════════════════════════════════════
// VERSION
// ═══════════════════════════════════════════════════════════════

const ONTOLOGY_VERSION = 'world_model_v1'

// ═══════════════════════════════════════════════════════════════
// EIGHT CORE DIMENSIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Each dimension captures one fundamental aspect of how a person's
 * world model operates. These are NOT personality traits — they are
 * cognitive operating principles that produce observable behavioral patterns.
 */
const DIMENSIONS = Object.freeze({
  DECISION_MODEL: {
    id: 'DECISION_MODEL',
    label: '决策模型',
    description: 'How decisions are made — evidence-driven vs intuition-dominant, speed vs deliberation, commitment vs optionality-preserving.',
    question: '这个人如何做出选择？',
    states: ['WEAK', 'DEVELOPING', 'FUNCTIONAL', 'STRONG'],
  },
  RISK_MODEL: {
    id: 'RISK_MODEL',
    label: '风险模型',
    description: 'How risk is perceived, assessed, and managed — avoidance vs diversification, loss aversion strength, reversibility awareness.',
    question: '这个人如何看待和处理风险？',
    states: ['WEAK', 'DEVELOPING', 'FUNCTIONAL', 'STRONG'],
  },
  PROBABILITY_MODEL: {
    id: 'PROBABILITY_MODEL',
    label: '概率模型',
    description: 'How probability and uncertainty are understood — binary vs probabilistic thinking, sample-size awareness, base-rate awareness.',
    question: '这个人如何理解概率和不确定性？',
    states: ['WEAK', 'DEVELOPING', 'FUNCTIONAL', 'STRONG'],
  },
  FEEDBACK_MODEL: {
    id: 'FEEDBACK_MODEL',
    label: '反馈模型',
    description: 'How feedback is sought, processed, and acted upon — active seeking vs avoidance, post-action review tendency, market evidence awareness.',
    question: '这个人如何获取和使用反馈？',
    states: ['WEAK', 'DEVELOPING', 'FUNCTIONAL', 'STRONG'],
  },
  OPPORTUNITY_MODEL: {
    id: 'OPPORTUNITY_MODEL',
    label: '机会识别模型',
    description: 'How opportunities are recognized and evaluated — exposure breadth, optionality building, resource recombination, network reach.',
    question: '这个人如何发现和评估机会？',
    states: ['WEAK', 'DEVELOPING', 'FUNCTIONAL', 'STRONG'],
  },
  LEVERAGE_MODEL: {
    id: 'LEVERAGE_MODEL',
    label: '杠杆模型',
    description: 'How leverage is understood and deployed — linear vs repeatable value creation, system leverage, distribution leverage, knowledge leverage.',
    question: '这个人如何理解和使用杠杆？',
    states: ['WEAK', 'DEVELOPING', 'FUNCTIONAL', 'STRONG'],
  },
  IDENTITY_MODEL: {
    id: 'IDENTITY_MODEL',
    label: '身份模型',
    description: 'How identity constrains or enables action — fixed role vs expanding identity, skill identity vs adaptive identity, employment dependence.',
    question: '身份如何限制或赋能这个人的行动？',
    states: ['WEAK', 'DEVELOPING', 'FUNCTIONAL', 'STRONG'],
  },
  TIME_MODEL: {
    id: 'TIME_MODEL',
    label: '时间配置模型',
    description: 'How time is allocated and valued — short-term priority vs long-term orientation, urgency dominance, compounding allocation.',
    question: '这个人如何分配和评价时间？',
    states: ['WEAK', 'DEVELOPING', 'FUNCTIONAL', 'STRONG'],
  },
})

// ═══════════════════════════════════════════════════════════════
// DIMENSION SCORE CONTRACT
// ═══════════════════════════════════════════════════════════════

/**
 * Every dimension evaluation must conform to this contract.
 * No dimension may be scored on a single data point.
 */
const DIMENSION_SCORE_CONTRACT = Object.freeze({
  type: 'object',
  required: ['score', 'state', 'confidence', 'supportingEvidence', 'contradictingEvidence', 'explanation', 'uncertainty'],
  properties: {
    score: { type: 'number', minimum: 0, maximum: 1 },
    state: { type: 'string', enum: ['WEAK', 'DEVELOPING', 'FUNCTIONAL', 'STRONG'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    supportingEvidence: {
      type: 'array',
      items: { type: 'object', properties: { signalId: { type: 'string' }, source: { type: 'string' }, weight: { type: 'number' } } },
      minItems: 1,  // At least one piece required
    },
    contradictingEvidence: { type: 'array' },
    explanation: { type: 'string', minLength: 1 },
    uncertainty: { type: 'string', minLength: 1 },
  },
})

// ═══════════════════════════════════════════════════════════════
// EVIDENCE REQUIREMENT CONTRACT
// ═══════════════════════════════════════════════════════════════

const EVIDENCE_REQUIREMENT = Object.freeze({
  minSupportingPieces: 2,       // At least 2 supporting OR 1 strong + 1 contextual
  strongSignalMinWeight: 0.8,
  contextualSignalMinWeight: 0.4,
  noSingleAnswerConclusion: true,
  occupationMustNotDirectlyTrigger: true,
  incomeMustNotDirectlyDetermine: true,
  skillMustNotDirectlyDetermine: true,
  allStrongConclusionsMustAllowCounterEvidence: true,
})

// ═══════════════════════════════════════════════════════════════
// INFERENCE BOUNDARY
// ═══════════════════════════════════════════════════════════════

const INFERENCE_BOUNDARY = Object.freeze({
  prohibitedInferences: [
    'OCCUPATION_TO_ARCHETYPE',
    'INCOME_TO_BLIND_SPOT',
    'SKILL_CATEGORY_TO_STRATEGY',
    'AGE_TO_FATE',
    'LIFE_STAGE_TO_CAPABILITY',
    'SINGLE_ANSWER_TO_DIAGNOSIS',
    'CERTAIN_FUTURE_PREDICTION',
    'FORTUNE_TELLING',
    'CHICKEN_SOUP_ENCOURAGEMENT',
    'COMMERCIAL_DIRECTION_AS_PRIMARY_DIAGNOSIS',
  ],
  requiredUncertainty: [
    'WORLD_MODEL_SCORE',
    'BLIND_SPOT_DIAGNOSIS',
    'SCENARIO_PREDICTION',
    'STRATEGY_OUTCOME',
  ],
})

// ═══════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY
// ═══════════════════════════════════════════════════════════════

const LEGACY_COMPAT = Object.freeze({
  version: 'world_model_v1',
  preservesDiagnosisObject: true,
  adapterRequired: true,
  adapterDirection: 'WORLD_MODEL_TO_LEGACY',
  neverReverseMap: true,
  legacyFieldsSafe: [
    'code', 'message', 'data.reportId', 'data.reportType',
    'data.diagnosticVersion', 'data.engineVersion',
    'data.diagnosticSnapshot', 'data.fallbackSource',
    'data.fallbackReasonCode', 'data.legacyFallbackInvoked',
    'data.answersSnapshot',
  ],
})

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  ONTOLOGY_VERSION,
  DIMENSIONS,
  DIMENSION_SCORE_CONTRACT,
  EVIDENCE_REQUIREMENT,
  INFERENCE_BOUNDARY,
  LEGACY_COMPAT,
}
