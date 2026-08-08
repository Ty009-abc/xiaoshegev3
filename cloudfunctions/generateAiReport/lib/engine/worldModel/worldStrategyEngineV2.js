/**
 * engine/worldModel/worldStrategyEngineV2.js
 *
 * Deterministic world strategy selection from cognitive blind spot
 * and world model dimensions.
 *
 * Strategies address COGNITIVE SYSTEMS — not commercial directions.
 * Commercial tactics can only appear as firstExperiment carriers.
 *
 * CRITICAL: BUILD_PRODUCT, DO_CONTENT, DO_SALES, etc. are PROHIBITED.
 *
 * @version world_model_v1
 */

const { STRATEGY_DEFINITIONS, PROHIBITED_STRATEGIES } = require('./strategyDefinitions')

// ═══════════════════════════════════════════════════════════════
// Main engine
// ═══════════════════════════════════════════════════════════════

function selectStrategy(blindSpot, worldModel, signalResult) {
  if (!blindSpot || !blindSpot.id) {
    return buildDefaultStrategy()
  }

  // Find strategies targeting this blind spot
  var strategyIds = Object.keys(STRATEGY_DEFINITIONS)
  var matchingStrategies = []

  strategyIds.forEach(function(sid) {
    if (PROHIBITED_STRATEGIES.indexOf(sid) >= 0) return

    var strat = STRATEGY_DEFINITIONS[sid]
    if (!strat) return

    if (strat.targetBlindSpot === blindSpot.id) {
      matchingStrategies.push({
        id: sid,
        definition: strat,
        match: 1.0, // Exact blind spot match
      })
    }
  })

  // If no exact match, find closest
  if (matchingStrategies.length === 0) {
    return buildDefaultStrategy()
  }

  // Select the strategy with the strongest match
  // (for now, first exact match — all are equally valid for their blind spot)
  var selected = matchingStrategies[0]
  var stratDef = selected.definition

  // Select a first experiment from the templates
  var experimentTemplates = stratDef.experimentTemplates || []
  var firstExperiment = experimentTemplates.length > 0
    ? experimentTemplates[0]
    : { name: 'First experiment', description: 'Design a small, reversible test of a key assumption.' }

  // Build the strategy with the blind spot diagnosis
  return {
    id: stratDef.id,
    primary: stratDef.id,
    label: stratDef.label,
    targetBlindSpot: blindSpot.id,
    mechanism: stratDef.mechanism,
    firstExperiment: {
      name: firstExperiment.name,
      description: firstExperiment.description,
      cognitiveGoal: stratDef.cognitiveUpgrade || '',
    },
    successSignal: stratDef.successSignal,
    reviewWindow: stratDef.reviewWindow,
    stopCondition: stratDef.stopCondition,
    confidence: blindSpot.confidence || 0.35,
    cognitiveUpgrade: stratDef.cognitiveUpgrade || '',
  }
}

// ═══════════════════════════════════════════════════════════════
// Fallback strategy
// ═══════════════════════════════════════════════════════════════

function buildDefaultStrategy() {
  return {
    id: 'BUILD_FEEDBACK_LOOP',
    primary: 'BUILD_FEEDBACK_LOOP',
    label: '建立反馈回路',
    targetBlindSpot: 'FEEDBACK_LOOP_GAP',
    mechanism: '建立从行动到学习的最短路径，用真实世界反馈校准认知模型。',
    firstExperiment: {
      name: '假设验证',
      description: '选择一个当前最确信的想法，用最低成本的方式测试它是否正确。',
      cognitiveGoal: '从"我认为"切换到"我验证"',
    },
    successSignal: '用户能说出一个被外部反馈修正过的具体认知。',
    reviewWindow: '2周',
    stopCondition: '已形成行动-反馈-调整的闭环习惯。',
    confidence: 0.25,
    cognitiveUpgrade: '从假设驱动升级到验证驱动',
  }
}

module.exports = {
  selectStrategy,
}
