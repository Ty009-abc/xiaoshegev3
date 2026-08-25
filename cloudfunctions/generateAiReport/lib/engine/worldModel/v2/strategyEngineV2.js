/**
 * engine/worldModel/v2/strategyEngineV2.js
 *
 * World Model v2 — strategy selection is a strict 1:1 blindSpot → strategy
 * map. Never influenced by occupation / income / context / archetype.
 * Strategy CONTENT (labels, firstExperiment, successSignal, etc.) is reused
 * from the frozen v1 strategyDefinitions vocabulary (unchanged).
 *
 * @version world_model_v2
 */

const { getStrategyById } = require('../strategyDefinitions')

// 9 blindSpot → 9 strategy (frozen 1:1). Derived from strategyDefinitions
// targetBlindSpot, declared explicitly here to lock the mapping.
const BLIND_SPOT_TO_STRATEGY_V2 = Object.freeze({
  DECISION_INERTIA: 'INCREASE_EXPERIMENT_RATE',
  FEEDBACK_LOOP_GAP: 'BUILD_FEEDBACK_LOOP',
  OPPORTUNITY_BLINDNESS: 'EXPAND_OPTIONALITY',
  RISK_MODEL_DISTORTION: 'REFRAME_RISK_MODEL',
  PROBABILITY_MISJUDGMENT: 'UPGRADE_PROBABILITY_THINKING',
  IDENTITY_CONSTRAINT: 'EXPAND_IDENTITY_BOUNDARY',
  LEVERAGE_MODEL_GAP: 'BUILD_LEVERAGE_MODEL',
  SYSTEM_THINKING_GAP: 'BUILD_DECISION_SYSTEM',
  TIME_HORIZON_TRAP: 'EXTEND_TIME_HORIZON',
})

function selectStrategyV2(blindSpotId) {
  var strategyId = BLIND_SPOT_TO_STRATEGY_V2[blindSpotId]
  if (!strategyId) return null

  var def = getStrategyById(strategyId)
  if (!def) return null

  var firstExperiment = (def.experimentTemplates && def.experimentTemplates[0]) || null

  return {
    id: strategyId,
    label: def.label,
    targetBlindSpot: blindSpotId,
    mechanism: def.mechanism,
    cognitiveUpgrade: def.cognitiveUpgrade || '',
    firstExperiment: firstExperiment
      ? { name: firstExperiment.name, description: firstExperiment.description }
      : null,
    successSignal: def.successSignal || '',
    reviewWindow: def.reviewWindow || '',
    stopCondition: def.stopCondition || '',
  }
}

module.exports = {
  selectStrategyV2,
  BLIND_SPOT_TO_STRATEGY_V2,
}
