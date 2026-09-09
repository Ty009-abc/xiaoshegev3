/**
 * presentation/worldModel/v2_1/worldPrinciplePresentationV21.js
 *
 * RC8.3 Stage1C-B — World Principle / User Model / Misalignment / Upgrade /
 * Decision Protocol presentation builders.
 *
 * DETERMINISTIC EXPLANATION ONLY. This module derives structured semantics
 * from FROZEN sources. It NEVER changes diagnosis, NEVER selects a different
 * blind spot, NEVER invents evidence or world rules, NEVER overrides strategy
 * or scenario, NEVER performs economic inference or fortune telling.
 *
 * Dependency direction (one-way, frozen by ADR-RC8.3-STAGE1C-A):
 *   presentation → engine outputs / frozen definitions   (this file)
 *   engine       → presentation                          (FORBIDDEN)
 *
 * Authoritative mapping path (single source, no duplicated shadow library):
 *   blindSpot → principle : worldPrinciples.getPrinciplesForBlindSpot (relatedBlindSpots)
 *   blindSpot → strategy  : strategyEngineV2.BLIND_SPOT_TO_STRATEGY_V2 → strategyDefinitions
 *
 * @version north_star_presentation_v1
 */

'use strict'

const { BLIND_SPOT_DEFINITIONS } = require('../../../engine/worldModel/blindSpotDefinitions')
const { getPrinciplesForBlindSpot } = require('../../../engine/worldModel/worldPrinciples')
const { STRATEGY_DEFINITIONS } = require('../../../engine/worldModel/strategyDefinitions')
const { BLIND_SPOT_TO_STRATEGY_V2 } = require('../../../engine/worldModel/v2/strategyEngineV2')

const PRESENTATION_VERSION = 'north_star_presentation_v1'

/**
 * Frozen: each blind spot maps to exactly one world principle via
 * `relatedBlindSpots` (strict bijection, ADR-RC8.3-STAGE1C-A-WORLD-PRINCIPLE-MAPPING).
 */
function getPrincipleForBlindSpot(blindSpotId) {
  if (!blindSpotId) return null
  const principles = getPrinciplesForBlindSpot(blindSpotId)
  return principles && principles.length > 0 ? principles[0] : null
}

/**
 * Frozen 1:1 blindSpot → strategy (strategyEngineV2.BLIND_SPOT_TO_STRATEGY_V2).
 */
function getStrategyForBlindSpot(blindSpotId) {
  if (!blindSpotId) return null
  const strategyId = BLIND_SPOT_TO_STRATEGY_V2[blindSpotId]
  if (!strategyId) return null
  return STRATEGY_DEFINITIONS[strategyId] || null
}

/**
 * USER_CURRENT_MODEL — the user's current/default mental model for a blind spot.
 * Canonical (frozen) statement only; case-specific evidence is carried
 * separately in the evidence explanation layer (§6 distinction).
 */
function buildUserCurrentModelV21(blindSpotId) {
  const def = BLIND_SPOT_DEFINITIONS[blindSpotId]
  if (!def) return null
  return {
    blindSpotId,
    pattern: def.mechanism || '',
    cognitiveRoot: def.cognitiveRoot || '',
    questionAnswered: def.questionAnswered || '',
    source: { file: 'engine/worldModel/blindSpotDefinitions.js', fields: ['mechanism', 'cognitiveRoot', 'questionAnswered'] },
    deterministic: true,
  }
}

/**
 * WORLD_OPERATING_RULE — the real-world operating rule the user's model
 * conflicts with. Wired strictly from the frozen worldPrinciples authority
 * (ADR-RC8.3-C1-001). No freehand invention.
 */
function buildWorldOperatingRuleV21(blindSpotId) {
  const principle = getPrincipleForBlindSpot(blindSpotId)
  if (!principle) return null
  return {
    principleId: principle.id,
    label: principle.label,
    statement: principle.statement,
    mechanism: principle.mechanism,
    consequence: principle.consequence,
    relatedBlindSpots: Array.isArray(principle.relatedBlindSpots) ? [...principle.relatedBlindSpots] : [],
    source: { file: 'engine/worldModel/worldPrinciples.js', authority: 'ADR-RC8.3-C1-001' },
    deterministic: true,
  }
}

/**
 * MODEL_MISALIGNMENT — explicit USER_CURRENT_MODEL vs WORLD_OPERATING_RULE
 * divergence. Structured to answer, without the report builder inventing
 * reasoning: "我原来怎么理解？" / "世界实际怎么运行？" / "错位发生在哪里？".
 */
function buildModelMisalignmentV21(blindSpotId) {
  const userModel = buildUserCurrentModelV21(blindSpotId)
  const worldRule = buildWorldOperatingRuleV21(blindSpotId)
  if (!userModel || !worldRule) return null
  return {
    blindSpotId,
    userModelStatement: userModel.pattern,
    worldRuleStatement: worldRule.statement,
    divergence: worldRule.consequence,
    source: { file: 'engine/worldModel/worldPrinciples.js', field: 'consequence' },
    deterministic: true,
  }
}

/**
 * UPGRADED_MODEL — the upgraded cognitive model (blindSpot → strategy →
 * cognitiveUpgrade). Structured semantics: what changes in the model, what the
 * user should pay attention to differently. NOT final prose.
 */
function buildUpgradedModelV21(blindSpotId) {
  const strategy = getStrategyForBlindSpot(blindSpotId)
  if (!strategy) return null
  return {
    blindSpotId,
    strategyId: strategy.id,
    strategyLabel: strategy.label || '',
    cognitiveUpgrade: strategy.cognitiveUpgrade || '',
    whatChanges: strategy.mechanism || '',
    whatToPayAttentionDifferently: strategy.successSignal || '',
    source: { file: 'engine/worldModel/strategyDefinitions.js', authority: 'BLIND_SPOT_TO_STRATEGY_V2' },
    deterministic: true,
  }
}

/**
 * DECISION_PROTOCOL — deterministic protocol representation from the frozen
 * strategy definition (mechanism / experimentTemplates / successSignal /
 * reviewWindow / stopCondition). Steps come ONLY from frozen experimentTemplates.
 * No generic self-help fill for gaps: completeness is declared, never padded.
 */
function buildDecisionProtocolV21(blindSpotId) {
  const strategy = getStrategyForBlindSpot(blindSpotId)
  if (!strategy) return null

  const templates = Array.isArray(strategy.experimentTemplates) ? strategy.experimentTemplates : []
  const steps = templates.map((t, i) => ({
    order: i + 1,
    name: t && t.name ? t.name : '',
    description: t && t.description ? t.description : '',
  }))
  const firstExperiment = steps.length > 0
    ? { name: steps[0].name, description: steps[0].description }
    : null

  const hasMechanism = !!(strategy.mechanism)
  const hasUpgrade = !!(strategy.cognitiveUpgrade)
  const hasSteps = steps.length > 0
  const hasSuccess = !!(strategy.successSignal)
  const hasReview = !!(strategy.reviewWindow)
  const hasStop = !!(strategy.stopCondition)
  const completeness = (hasMechanism && hasUpgrade && hasSteps && hasSuccess && hasReview && hasStop)
    ? 'FULL'
    : 'PARTIAL'

  const def = BLIND_SPOT_DEFINITIONS[blindSpotId]

  return {
    strategyId: strategy.id,
    targetBlindSpot: strategy.targetBlindSpot || blindSpotId,
    trigger: def && def.questionAnswered ? def.questionAnswered : '',
    steps,
    firstExperiment,
    successSignal: strategy.successSignal || '',
    reviewWindow: strategy.reviewWindow || '',
    stopCondition: strategy.stopCondition || '',
    completeness,
    deterministic: true,
  }
}

module.exports = {
  PRESENTATION_VERSION,
  getPrincipleForBlindSpot,
  getStrategyForBlindSpot,
  buildUserCurrentModelV21,
  buildWorldOperatingRuleV21,
  buildModelMisalignmentV21,
  buildUpgradedModelV21,
  buildDecisionProtocolV21,
}
