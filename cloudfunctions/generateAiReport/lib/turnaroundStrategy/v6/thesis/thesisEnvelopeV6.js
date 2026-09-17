'use strict'
/**
 * turnaroundStrategy/v6/thesis/thesisEnvelopeV6.js
 *
 * RC8.4 V6 R57 — DETERMINISTIC THESIS ENVELOPE.
 *
 * The envelope is the MACHINE-CONTROLLED authority object the AI may interpret
 * INSIDE. It is built ONLY from frozen deterministic inputs:
 *   user facts + V6 B1 diagnosis + asset/proof + R48 compatibility +
 *   R53 NO_PRIMARY cross-axis scope + desiredChange + world-rule candidates.
 *
 * HARD RULES:
 *   - ZERO diagnosis authority: never mutates primaryBottleneck / stage /
 *     beliefRelation / realityConstraint / firstActionType.
 *   - Never infers occupation from skill (SKILL_TO_OCCUPATION_INFERENCE_COUNT=0):
 *     an absent occupation is ABSENT, not derived.
 *   - EVIDENCE_CONFLICT => returns null (NO thesis, NO AI call).
 *   - Fail closed: unknown => the narrower, link-first envelope.
 *
 * CONSUMER LAYER ONLY. Deterministic. No AI. No I/O. No network.
 */

const { selectWorldRule, WORLD_RULE_LIBRARY } = require('../report/worldRuleLibraryV6.js')
const { buildNoPrimaryReportV6 } = require('../report/noPrimaryReportV6.js')

const ENVELOPE_VERSION = 'turnaround_strategy_v6_thesis_envelope_v1'

// ── world-rule lenses permitted for the NO_PRIMARY path, grouped by scope ──
// COMPATIBLE (monetization of the SAME captured asset): repeat/pattern allowed.
// UNPROVEN   (link-first): MUST NOT include leverage/systematize lenses.
const NP_WORLD_RULES_COMPATIBLE = [
  'MARKET_PROOF_OVER_SELF_ASSESSMENT',
  'REPEATABILITY_OVER_OCCASIONAL_SUCCESS',
  'LOW_COST_EXPERIMENT_OVER_PERFECT_DIRECTION'
]
const NP_WORLD_RULES_UNPROVEN = [
  'LOW_COST_EXPERIMENT_OVER_PERFECT_DIRECTION',
  'EXTERNAL_EVIDENCE_OVER_INTERNAL_CERTAINTY',
  'PROBABILITY_OVER_CERTAINTY'
]

// ── PRIMARY bottleneck -> permitted migration (B1 authority unchanged) ──
const PRIMARY_MIGRATION_BY_BOTTLENECK = {
  DIRECTION_GAP: { id: 'NARROW_TO_ONE_TESTABLE_DIRECTION', from: '等一个想清楚的方向', to: '用一个方向先换回真实反馈' },
  ACTION_GAP: { id: 'START_ONE_REAL_TEST', from: '等准备好再开始', to: '先开始一次，用反馈修正' },
  CONSISTENCY_GAP: { id: 'BUILD_ONE_REPEATABLE_CADENCE', from: '靠一股劲一次做完', to: '把动作绑进固定节奏，让它不断档' },
  VALIDATION_GAP: { id: 'GET_ONE_BUYER_SIGNAL', from: '把东西做到最好，等人来买', to: '先向真实的人要一次买单反馈' },
  REPEATABILITY_GAP: { id: 'TURN_ONE_SUCCESS_INTO_METHOD', from: '做成一次就当会了', to: '把有效那次的步骤固定成可重复的方法' }
}

// ── NO_PRIMARY migration, by value position + scope ──
const NP_MIGRATION_LINK_FIRST = { id: 'TEST_ASSET_TO_GOAL_LINK', from: '把已证明的能力直接当成下一步的路', to: '先验证这项能力和当前目标之间到底连不连得上', conditional: true }

// R65 §7/§8 — value-position TRUTHFUL migrations (NO_PRIMARY, COMPATIBLE scope).
// A migration may advance the user by exactly ONE evidence step. It must never
// assume a proof level the user has not reached: an UNPAID, recognised capability
// may NOT be told to jump straight to stable / repeatable / systematized income.
// Semantic chain: recognised/used-free capability -> sellable offer -> first paid
// proof -> second paid proof/repeatable offer -> repeatable pattern -> system.
const NP_VALUE_MIGRATIONS = {
  VALUE_NONE_YET: { id: 'BUILD_TESTABLE_CAPABILITY', from: '还没有一个能被验证的具体能力', to: '先做出一个能被真实的人检验的最小能力', conditional: false },
  VALUE_UNVALIDATED_SKILL: { id: 'GET_FIRST_EXTERNAL_PROOF', from: '有具体能力，但还没被市场验证过', to: '先拿到一次外部真实反馈，验证它值不值得做下去', conditional: false },
  VALUE_UNPAID_PROVEN_HELP: { id: 'TURN_RECOGNIZED_CAPABILITY_INTO_FIRST_PAID_OFFER', from: '一项被认可、却一直免费提供的能力', to: '把它变成一个别人愿意付费的最小交付，先拿到第一笔真实付费证据', conditional: false },
  VALUE_ONE_OFF_PAID: { id: 'TURN_FIRST_PAYMENT_INTO_REPEATABLE_OFFER', from: '已经有人付过一次钱的能力', to: '把这次成交变成一份可以重复出售的报价', conditional: false },
  VALUE_REPEATABLE_PAID: { id: 'TURN_REPEAT_SALES_INTO_SYSTEMATIZED_OFFER', from: '已经有能重复付费的客户', to: '把稳定成交的方式固定成可复用的方法', conditional: false },
  VALUE_UNCLEAR: { id: 'TURN_RECOGNIZED_CAPABILITY_INTO_FIRST_PAID_OFFER', from: '一项被认可、却一直免费提供的能力', to: '把它变成一个别人愿意付费的最小交付，先拿到第一笔真实付费证据', conditional: false }
}
// Backwards-compatible alias: the COMPATIBLE migration is now value-position
// selected; this remains only for callers that import the old symbol.
const NP_MIGRATION_COMPATIBLE = NP_VALUE_MIGRATIONS.VALUE_UNPAID_PROVEN_HELP

// ── allowed strategy hypotheses (commercial imagination, bounded) ──
const HYP_MONETIZE = ['SERVICE_PACKAGING', 'OFFER_SHAPE', 'TARGET_CUSTOMER_CLASS', 'WILLINGNESS_TO_PAY_TEST']
const HYP_REPEAT = ['REPEAT_SALE', 'OFFER_SHAPE', 'TARGET_CUSTOMER_CLASS', 'DISTRIBUTION_EXPERIMENT']
const HYP_SYSTEMATIZE = ['PROCESS_TO_METHOD', 'DELEGATION', 'SECOND_INCOME_MODEL']
const HYP_LINK = ['LINK_TEST', 'TARGET_CUSTOMER_CLASS', 'DISCOVERY_CONVERSATION']

// ── base forbidden claims (fabrication / certainty) ──
const BASE_FORBIDDEN = [
  'INVENT_USER_HISTORY', 'INVENT_CUSTOMERS', 'INVENT_INCOME', 'INVENT_FAMILY',
  'INVENT_CREDENTIALS', 'INVENT_OCCUPATION', 'INVENT_EXACT_MARKET_DEMAND',
  'GUARANTEED_EARNINGS', 'GUARANTEED_CAREER_OUTCOME', 'SPECULATION_AS_FACT'
]

// ── value position from the asset ladder ──
function currentValuePositionFor (assetState) {
  switch (assetState) {
    case 'NO_CLEAR_ASSET': return 'VALUE_NONE_YET'
    case 'SKILL_IDENTIFIED_UNPROVEN': return 'VALUE_UNVALIDATED_SKILL'
    case 'SKILL_USED_FREE':
    case 'PROBLEM_SOLVING_PROOF': return 'VALUE_UNPAID_PROVEN_HELP'
    case 'PAID_ONCE':
    case 'OCCASIONAL_PAID': return 'VALUE_ONE_OFF_PAID'
    case 'REPEATABLE_PAID': return 'VALUE_REPEATABLE_PAID'
    default: return 'VALUE_UNCLEAR'
  }
}

// ── experiment class from the frozen firstActionType / NO_PRIMARY proof stage ──
function experimentClassForPrimary (firstActionType) {
  switch (firstActionType) {
    case 'DIRECTION_NARROWING': return 'NARROW_DIRECTION'
    case 'SMALLEST_EXTERNAL_TEST': return 'SMALLEST_EXTERNAL_TEST'
    case 'CONSISTENCY_PROTECTION': return 'CONSISTENCY_CADENCE'
    case 'BUYER_FEEDBACK_COLLECTION': return 'BUYER_SIGNAL'
    case 'REPEAT_SUCCESS_PATH': return 'REPEAT_PATTERN'
    case 'CASHFLOW_SAFE_EXPERIMENT': return 'CASHFLOW_SAFE_TEST'
    default: return 'SMALLEST_EXTERNAL_TEST'
  }
}

/**
 * Build the deterministic ThesisEnvelope.
 * @param {Object} input
 * @param {Object} input.hybridProfile  HybridProfile (may be null)
 * @param {Object} input.diagnosis      V6 diagnosis (B1 authority + compatibility)
 * @param {Object} [input.hybridContext] buildHybridReportContextV6 output (for NO_PRIMARY evidence)
 * @param {Object} [input.noPrimaryReport] buildNoPrimaryReportV6 output (clusters/proof)
 * @param {'COMPATIBLE'|'UNPROVEN'} [input.crossAxisScope]
 * @returns {Object|null} envelope, or null on EVIDENCE_CONFLICT / invalid
 */
function buildThesisEnvelopeV6 (input) {
  const i = input || {}
  const d = i.diagnosis
  if (!d || typeof d !== 'object') return null
  if (d.diagnosisState === 'INVALID_INPUT') return null

  // §2 — EVIDENCE_CONFLICT => DO NOT invoke AI. No envelope at all.
  if (d.compatibility && d.compatibility.verdict === 'EVIDENCE_CONFLICT') return null

  const hp = i.hybridProfile || null
  const isNoPrimary = d.diagnosisState === 'NO_PRIMARY'
  // NO_PRIMARY needs its deterministic evidence report for clusters + proof
  // question. Self-build when not supplied so the envelope is standalone.
  const npReport = isNoPrimary
    ? (i.noPrimaryReport || buildNoPrimaryReportV6(d, i.hybridContext || null))
    : (i.noPrimaryReport || null)

  // ── §3 FACT LEDGER — only facts actually present. Absence is meaningful. ──
  const facts = []
  const push = (id, field, value, source) => {
    if (value === undefined || value === null || value === '') return
    facts.push({ id: id, field: field, value: value, source: source || 'questionnaire', confidence: 'FACT' })
  }
  if (hp) {
    push('f.ageStage', 'lifeStage', hp.reality && hp.reality.lifeStage)
    // occupation: ONLY if the user typed it. NEVER derived from skill.
    push('f.occupation', 'occupationDetail', hp.reality && hp.reality.occupation)
    push('f.incomeStructure', 'incomeStructure', hp.reality && hp.reality.incomeStructure)
    push('f.monthlySurplus', 'monthlySurplus', hp.reality && hp.reality.monthlySurplus)
    push('f.safetyMonths', 'safetyMonths', hp.reality && hp.reality.safetyMonths)
    push('f.debtPressure', 'debtPressure', hp.reality && hp.reality.debtPressure)
    push('f.monetizableSkill', 'monetizableSkill', hp.asset && hp.asset.type)
    push('f.marketProof', 'skillValidation', hp.asset && hp.asset.marketProof)
    push('f.weeklyTime', 'weeklyTime', hp.capacity && hp.capacity.weeklyTime)
    push('f.maxTrialCost', 'maxTrialCost', hp.capacity && hp.capacity.maxTrialCost)
    push('f.executionStability', 'executionStability', hp.capacity && hp.capacity.executionStability)
    push('f.primaryProblem', 'primaryProblem', hp.desiredChange && hp.desiredChange.primaryProblem, 'engine-canonical')
    push('f.primaryGoal', 'primaryGoal', hp.desiredChange && hp.desiredChange.primaryGoal)
    push('f.selfBelief', 'selfBelief', hp.belief && hp.belief.perceivedRootCause, 'engine-canonical')
    push('f.pastAttemptStage', 'pastAttemptStage', hp.stage && hp.stage.pastAttemptStage)
    push('f.decisionStyle', 'decisionStyle', hp.behavior && hp.behavior.decisionStyle)
    push('f.failureResponse', 'failureResponse', hp.behavior && hp.behavior.noResultResponse)
    push('f.timeBehavior', 'timeBehavior', hp.behavior && hp.behavior.timeAllocation, 'engine-canonical')
  }

  const assetState = (i.hybridContext && i.hybridContext.assetState) || null
  const marketValidated = !!(i.hybridContext && i.hybridContext.marketValidated)
  const crossAxisScope = i.crossAxisScope || (isNoPrimary
    ? ((npReport && npReport.noPrimaryScope) || 'UNPROVEN')
    : ((d.compatibility && d.compatibility.crossAxisScope) || 'COMPATIBLE'))
  const currentValuePosition = currentValuePositionFor(assetState)

  const rcTypes = (d.realityConstraint && d.realityConstraint.types) || []
  const realityConstraints = {
    cashflowPressure: rcTypes.indexOf('CASHFLOW_PRESSURE') !== -1,
    lowSurplus: rcTypes.indexOf('LOW_SURPLUS') !== -1,
    unstableIncome: rcTypes.indexOf('UNSTABLE_INCOME') !== -1,
    timePressure: rcTypes.indexOf('TIME_PRESSURE_POSSIBLE') !== -1,
    familyEnv: rcTypes.indexOf('FAMILY_ENVIRONMENT_CONSTRAINT') !== -1
  }

  // ── allowed world rules / migrations / hypotheses / experiment class ──
  let allowedWorldRules
  let allowedTargetPositions
  let allowedStrategyHypotheses
  let experimentClass
  let forbiddenClaims = BASE_FORBIDDEN.slice()

  if (isNoPrimary) {
    if (crossAxisScope === 'UNPROVEN') {
      allowedWorldRules = NP_WORLD_RULES_UNPROVEN.slice()
      allowedTargetPositions = [NP_MIGRATION_LINK_FIRST]
      allowedStrategyHypotheses = HYP_LINK.slice()
      experimentClass = 'LINK_TEST'
      forbiddenClaims.push('CLAIM_ASSET_IS_GOAL_PATH', 'CLAIM_PRIMARY_BOTTLENECK', 'SCALE_PROVEN_ASSET')
    } else {
      allowedWorldRules = NP_WORLD_RULES_COMPATIBLE.slice()
      // R65 §7 — truthful ONE-STEP migration for THIS value position. An unpaid,
      // recognised capability is never offered a paid-level target (stable /
      // repeatable / systematized income) before it has first-paid evidence.
      allowedTargetPositions = [NP_VALUE_MIGRATIONS[currentValuePosition] || NP_MIGRATION_COMPATIBLE]
      allowedStrategyHypotheses = (currentValuePosition === 'VALUE_REPEATABLE_PAID' ? HYP_SYSTEMATIZE : HYP_REPEAT).slice()
      experimentClass = currentValuePosition === 'VALUE_UNPAID_PROVEN_HELP'
        ? 'FIRST_PAID_PROOF'
        : ((npReport && npReport.proofStageProgression) || 'REPEAT')
      forbiddenClaims.push('CLAIM_PRIMARY_BOTTLENECK')
      if (!marketValidated) forbiddenClaims.push('CLAIM_STABLE_INCOME_WITHOUT_PAID_PROOF', 'CLAIM_REPEATABLE_INCOME_WITHOUT_PAID_PROOF')
    }
  } else {
    // PRIMARY — B1 is authority. AI explains MEANING, may not rename/replace.
    const wr = selectWorldRule(d)
    allowedWorldRules = wr ? wr.candidates.slice() : []
    const mig = PRIMARY_MIGRATION_BY_BOTTLENECK[d.primaryBottleneck]
    allowedTargetPositions = mig ? [mig] : []
    allowedStrategyHypotheses = HYP_MONETIZE.slice()
    experimentClass = experimentClassForPrimary(d.firstActionType)
    forbiddenClaims.push('RENAME_BOTTLENECK', 'CONTRADICT_B1_STAGE', 'CHANGE_FIRST_ACTION_TYPE', 'INVENT_STRONGER_EVIDENCE')
  }

  const env = {
    envelopeVersion: ENVELOPE_VERSION,
    facts: facts,
    diagnosisState: d.diagnosisState,
    primaryBottleneck: isNoPrimary ? null : d.primaryBottleneck,
    secondaryConstraint: rcTypes.slice(),
    beliefRealityGap: (d.beliefRelation && d.beliefRelation.relation) || null,
    executionStage: d.executionStage || null,
    firstActionType: d.firstActionType || null,
    assetState: assetState,
    marketProof: {
      validated: marketValidated,
      index: (i.hybridContext && typeof i.hybridContext.assetIndex === 'number') ? i.hybridContext.assetIndex : null,
      assetNamed: !!(i.hybridContext && i.hybridContext.assetNamed)
    },
    crossAxisScope: crossAxisScope,
    // R62 §5/§6 — neutral cross-object divergence signal (ZERO diagnosis
    // authority). Lets the AI interpret the capability/attempt divergence as
    // MATERIAL, never as a contradiction. The two facts stay independent.
    crossObjectEvidencePattern: (i.hybridContext && i.hybridContext.crossObjectEvidencePattern) || 'UNKNOWN',
    currentValuePosition: currentValuePosition,
    allowedTargetPositions: allowedTargetPositions,
    allowedWorldRules: allowedWorldRules,
    allowedStrategyHypotheses: allowedStrategyHypotheses,
    forbiddenClaims: forbiddenClaims,
    experimentClass: experimentClass,
    realityConstraints: realityConstraints,
    numericPriceEnabled: false
  }

  // §2 — NO_PRIMARY additionally carries evidence clusters + the proof question.
  if (isNoPrimary) {
    env.evidenceClusters = (npReport && npReport.evidenceClusters) || []
    env.proofQuestion = (npReport && npReport.nextUncertainty) || null
  }

  return env
}

module.exports = {
  buildThesisEnvelopeV6,
  ENVELOPE_VERSION,
  PRIMARY_MIGRATION_BY_BOTTLENECK,
  NP_MIGRATION_LINK_FIRST,
  NP_MIGRATION_COMPATIBLE,
  NP_VALUE_MIGRATIONS,
  NP_WORLD_RULES_UNPROVEN,
  NP_WORLD_RULES_COMPATIBLE,
  BASE_FORBIDDEN,
  currentValuePositionFor,
  experimentClassForPrimary,
  WORLD_RULE_LIBRARY
}
