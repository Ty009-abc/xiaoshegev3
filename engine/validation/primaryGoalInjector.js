/**
 * RC8.2 Primary Goal Injector
 *
 * Injects user's explicit primaryGoal into strategy/bottleneck scoring,
 * without overriding the evidence chain. AI can only be a leverage tool,
 * never a standalone strategy.
 */

/**
 * Compute primaryGoal influence on bottleneck scoring.
 *
 * Goal → Bottleneck mapping:
 *   BUILD_IP → POSITIONING / TRAFFIC / SYSTEM
 *   BUILD_BUSINESS → SYSTEM / TRAFFIC / TEAM
 *   MAKE_MONEY_FAST → SELLING / EXECUTION / PRICING
 *   ESCAPE_WAGE → CASHFLOW / LEVERAGE
 *   SIDE_HUSTLE → PRODUCT / TRAFFIC
 *   FIND_DIRECTION → POSITIONING / DISCIPLINE
 *
 * @param {string} primaryGoal
 * @returns {{ boostedBottlenecks: {[bottleneckId]: number}, rInc001Suppress: boolean }}
 */
function computeGoalInfluence(primaryGoal) {
  if (!primaryGoal) return { boostedBottlenecks: {}, rInc001Suppress: false }

  var goalMap = {
    BUILD_IP: {
      boostedBottlenecks: { POSITIONING: 0.3, TRAFFIC: 0.3, SYSTEM: 0.2 },
      rInc001Suppress: true
    },
    BUILD_BUSINESS: {
      boostedBottlenecks: { SYSTEM: 0.3, TRAFFIC: 0.25, TEAM: 0.2 },
      rInc001Suppress: true
    },
    MAKE_MONEY_FAST: {
      boostedBottlenecks: { SELLING: 0.3, EXECUTION: 0.2, PRICING: 0.2 },
      rInc001Suppress: false
    },
    ESCAPE_WAGE: {
      boostedBottlenecks: { LEVERAGE: 0.3, CASHFLOW: 0.2, SYSTEM: 0.15 },
      rInc001Suppress: false
    },
    SIDE_HUSTLE: {
      boostedBottlenecks: { PRODUCT: 0.3, TRAFFIC: 0.2, POSITIONING: 0.15 },
      rInc001Suppress: false
    },
    FIND_DIRECTION: {
      boostedBottlenecks: { POSITIONING: 0.3, DISCIPLINE: 0.2 },
      rInc001Suppress: false
    }
  }

  return goalMap[primaryGoal] || { boostedBottlenecks: {}, rInc001Suppress: false }
}

/**
 * Check if SINGLE_INCOME bottleneck should be suppressed based on user evidence.
 *
 * Conditions that collectively suppress R_INC_001 / SINGLE_INCOME bottleneck:
 *   1. VALIDATED_SKILL present in tags
 *   2. SMALL_SCALE_SALES or CONTENT_CREATOR or SALES_ORIENTED
 *   3. weeklyTime evidence (via tag SYSTEM_THINKING or CONTENT_CREATOR)
 *   4. ACTION_FIRST present
 *   5. primaryGoal is defined
 *   6. SAFE_FIRST weight > 0.15 (indicates safety cushion)
 *
 * When ≥3 of the above are true, R_INC_001 is demoted to background only.
 *
 * @param {string[]} tagIds
 * @param {Object|null} primaryGoal
 * @returns {boolean}
 */
function shouldSuppressSingleIncomeBottleneck(tagIds, primaryGoal) {
  var score = 0

  if (tagIds.indexOf('VALIDATED_SKILL') >= 0) score++
  if (tagIds.indexOf('CONTENT_CREATOR') >= 0 || tagIds.indexOf('SALES_ORIENTED') >= 0) score++
  if (tagIds.indexOf('SYSTEM_THINKING') >= 0 || tagIds.indexOf('ACTION_FIRST') >= 0) score++
  if (tagIds.indexOf('LONG_TERM') >= 0 || tagIds.indexOf('BUILDING_IP') >= 0) score++
  if (primaryGoal) score++
  if (tagIds.indexOf('SAFE_FIRST') >= 0) score++

  return score >= 3
}

/**
 * Compute strategy scoring modifiers from primaryGoal.
 *
 * @param {string} primaryGoal
 * @returns {{ boostedStrategies: {[strategyId]: number}, suppressedStrategies: {[strategyId]: number} }}
 */
function computeStrategyModifiers(primaryGoal) {
  if (!primaryGoal) return { boostedStrategies: {}, suppressedStrategies: {} }

  var strategyMap = {
    BUILD_IP: {
      boosted: { BUILD_IP: 0.35, BUILD_ACQUISITION_SYSTEM: 0.25 },
      suppressed: { BUILD_CASHFLOW: -0.3, DISCIPLINE_FIRST: -0.2 }
    },
    BUILD_BUSINESS: {
      boosted: { BUILD_SYSTEM: 0.3, BUILD_ACQUISITION_SYSTEM: 0.2 },
      suppressed: { DISCIPLINE_FIRST: -0.2, BUILD_CASHFLOW: -0.2 }
    },
    MAKE_MONEY_FAST: {
      boosted: { SELL_FIRST: 0.3, BUILD_PRODUCT: 0.2 },
      suppressed: { BUILD_SYSTEM: -0.2 }
    },
    ESCAPE_WAGE: {
      boosted: { BUILD_CASHFLOW: 0.3, BUILD_PRODUCT: 0.2 },
      suppressed: { BUILD_IP: -0.2 }
    },
    SIDE_HUSTLE: {
      boosted: { BUILD_PRODUCT: 0.3, SELL_FIRST: 0.2 },
      suppressed: { BUILD_IP: -0.15 }
    },
    FIND_DIRECTION: {
      boosted: { DISCIPLINE_FIRST: 0.3, BUILD_ACQUISITION_SYSTEM: 0.2 },
      suppressed: { BUILD_SYSTEM: -0.2, SELL_FIRST: -0.1 }
    }
  }

  var m = strategyMap[primaryGoal] || { boosted: {}, suppressed: {} }
  return {
    boostedStrategies: m.boosted || {},
    suppressedStrategies: m.suppressed || {}
  }
}

/**
 * AI is always a leverage tool, not a standalone strategy.
 * Returns true if text promotes AI as a primary strategy (not just a tool).
 *
 * @param {string} text
 * @returns {boolean}
 */
function isAiAsStrategy(text) {
  if (!text) return false
  var aiStrategyPatterns = [
    /AI副业/, /AI创业/, /用AI赚钱/, /靠AI/, /做AI/,
    /AI.*方向/, /AI.*赛道/, /AI.*机会/, /AI.*变现/
  ]
  var aiToolPatterns = [
    /用AI.*提高/, /用AI.*辅助/, /借助AI/, /AI工具/,
    /AI.*效率/, /AI.*加速/, /AI.*帮助/
  ]

  for (var i = 0; i < aiStrategyPatterns.length; i++) {
    if (text.indexOf(aiStrategyPatterns[i]) >= 0) return true
  }

  // If AI is mentioned only as tool, it's fine
  for (var j = 0; j < aiToolPatterns.length; j++) {
    if (text.indexOf(aiToolPatterns[j]) >= 0) return false
  }

  return false
}

module.exports = {
  computeGoalInfluence: computeGoalInfluence,
  shouldSuppressSingleIncomeBottleneck: shouldSuppressSingleIncomeBottleneck,
  computeStrategyModifiers: computeStrategyModifiers,
  isAiAsStrategy: isAiAsStrategy
}
