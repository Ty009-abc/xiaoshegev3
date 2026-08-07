/**
 * engine/worldModel/scenarioDefinitions.js
 *
 * RC8.3 Scenario Simulation Vocabulary v2.
 *
 * Scenarios simulate decision consequences without making predictions.
 * They answer: "If the current cognitive model continues, what decision
 * patterns will likely emerge? If a dimension is upgraded, how would
 * decisions change?"
 *
 * ABSOLUTE PROHIBITIONS:
 * - No income predictions
 * - No success/failure predictions
 * - No fate/destiny statements
 * - No precise probability claims
 * - No time-bound outcome guarantees
 *
 * @version world_model_v1
 */

// ═══════════════════════════════════════════════════════════════
// SCENARIO FRAMEWORK
// ═══════════════════════════════════════════════════════════════

const SCENARIO_FRAMEWORK = Object.freeze({

  /**
   * CURRENT_MODEL_CONTINUES scenario:
   * What decision patterns will likely emerge if the user continues
   * operating with their current cognitive model?
   *
   * This is NOT a prediction of what will happen.
   * It describes the DECISION PATTERNS that the current model produces.
   */
  CURRENT_MODEL_CONTINUES: {
    id: 'CURRENT_MODEL_CONTINUES',
    label: '当前模型持续',
    question: '如果继续保持当前的认知方式，会产生什么样的决策模式？',
    outputStructure: {
      assumptions: 'What does the current model assume about the world that may be inaccurate?',
      likelyDecisionPattern: 'Given the current model, what types of decisions will likely be made?',
      possibleConsequences: 'What outcomes are more likely under this decision pattern? (NOT guaranteed)',
      uncertainty: 'What cannot be predicted from the current information?',
    },
    expressionRules: {
      mustUse: [
        '如果继续保持当前的认知方式……',
        '在当前条件下，更可能出现的决策模式是……',
        '这会提高某类结果出现的可能性……',
        '结果仍受市场、环境、执行和运气的综合影响……',
      ],
      mustNotUse: [
        '一定会……', '必然……', '三年后……',
        '成功率达到……', '收入将达到……',
        '注定……', '命运……',
      ],
    },
  },

  /**
   * WORLD_MODEL_UPGRADED scenario:
   * How would decision patterns change if the user upgrades
   * a specific cognitive dimension?
   *
   * This is NOT a promise of better outcomes.
   * It describes the new DECISION OPTIONS that become available.
   */
  WORLD_MODEL_UPGRADED: {
    id: 'WORLD_MODEL_UPGRADED',
    label: '认知升级后',
    question: '如果升级某个认知维度，决策模式会发生什么变化？',
    outputStructure: {
      changedVariable: 'Which cognitive dimension is being upgraded and how?',
      likelyDecisionPattern: 'What new decision patterns become available?',
      possibleConsequences: 'What outcomes become more possible under these new patterns? (NOT guaranteed)',
      observableSignals: 'What early signals would indicate the upgrade is working?',
      uncertainty: 'What remains uncertain even after the upgrade?',
    },
    expressionRules: {
      mustUse: [
        '如果能在认知层面升级……',
        '这会带来新的决策可能性……',
        '可能观察到的早期信号包括……',
        '这不保证任何特定结果，但会改变可用的决策选项……',
      ],
      mustNotUse: [
        '只要升级就……', '保证……', '必然实现……',
        '成功率提升到……', '收入翻倍……',
        '命运改变……', '人生逆转……',
      ],
    },
  },

})

// ═══════════════════════════════════════════════════════════════
// DIMENSION-SPECIFIC SCENARIO PATTERNS
// ═══════════════════════════════════════════════════════════════

/**
 * For each cognitive dimension, these are the decision pattern shifts
 * that the scenario simulation should model.
 *
 * These are TEMPLATES for the engine — they describe the direction
 * of change, not the specific content.
 */
const DIMENSION_SCENARIO_PATTERNS = Object.freeze({

  DECISION_MODEL: {
    currentPattern: {
      label: '当前决策模式',
      patterns: [
        'Decision quality varies with emotional state',
        'Large commitments made without incremental testing',
        'Decisions delayed waiting for perfect information',
      ],
    },
    upgradedPattern: {
      label: '升级后决策模式',
      patterns: [
        'Small, reversible experiments before large commitments',
        'Decisions made with explicit assumptions that can be tested',
        'Faster action with embedded learning mechanisms',
      ],
    },
  },

  RISK_MODEL: {
    currentPattern: {
      label: '当前风险模式',
      patterns: [
        'Avoidance of any situation with uncertain outcome',
        'Concentration of resources without diversification awareness',
        'Overestimation of downside, underestimation of ability to recover',
      ],
    },
    upgradedPattern: {
      label: '升级后风险模式',
      patterns: [
        'Risk decisions based on expected value and reversibility',
        'Portfolio approach — small bets across multiple directions',
        'Explicit downside calculation: "What is the worst that can happen? Can I recover?"',
      ],
    },
  },

  PROBABILITY_MODEL: {
    currentPattern: {
      label: '当前概率模式',
      patterns: [
        'Binary success/failure framing of complex situations',
        'Conclusions drawn from one or two examples',
        'Focus on vivid success stories, ignoring base rates',
      ],
    },
    upgradedPattern: {
      label: '升级后概率模式',
      patterns: [
        'Decisions evaluated by expected value, not binary outcome',
        'Understanding that most outcomes fall in a range, not a point',
        'Seeking base rates before evaluating specific cases',
      ],
    },
  },

  FEEDBACK_MODEL: {
    currentPattern: {
      label: '当前反馈模式',
      patterns: [
        'Actions taken without systematic outcome review',
        'Assumptions held without market or external testing',
        'Feedback avoided or received only through unreliable channels',
      ],
    },
    upgradedPattern: {
      label: '升级后反馈模式',
      patterns: [
        'Tight feedback loops — act, measure, adjust, repeat',
        'Assumptions explicitly tested against market or external evidence',
        'Active seeking of feedback from diverse, unbiased sources',
      ],
    },
  },

  OPPORTUNITY_MODEL: {
    currentPattern: {
      label: '当前机会模式',
      patterns: [
        'Single path pursued without developing alternatives',
        'Limited awareness of what is possible outside current context',
        'Current skills seen only in their original application',
      ],
    },
    upgradedPattern: {
      label: '升级后机会模式',
      patterns: [
        'Multiple parallel paths with real evidence for each',
        'Broader network bringing diverse opportunity awareness',
        'Creative recombination of existing skills for new applications',
      ],
    },
  },

  LEVERAGE_MODEL: {
    currentPattern: {
      label: '当前杠杆模式',
      patterns: [
        'Linear time-for-money exchange without multiplier',
        'No systems, automation, or delegation in work process',
        'Unable to see how to scale beyond personal capacity',
      ],
    },
    upgradedPattern: {
      label: '升级后杠杆模式',
      patterns: [
        'Creating repeatable outputs that generate value beyond time invested',
        'Building systems and processes that multiply personal output',
        'Identifying and deploying leverage points in daily work',
      ],
    },
  },

  IDENTITY_MODEL: {
    currentPattern: {
      label: '当前身份模式',
      patterns: [
        'Self-concept locked into a single professional role',
        'Perceived capability limited by current job title',
        'Identity derived from employer or occupation rather than capabilities',
      ],
    },
    upgradedPattern: {
      label: '升级后身份模式',
      patterns: [
        'Identity based on capabilities and values, not roles',
        'Evidence of effectiveness in multiple domains',
        'Self-concept that expands with new experiences',
      ],
    },
  },

  TIME_MODEL: {
    currentPattern: {
      label: '当前时间模式',
      patterns: [
        'Driven by urgency — reactive rather than proactive',
        'Time fragmented across many small, non-compounding activities',
        'Important-but-not-urgent work perpetually delayed',
      ],
    },
    upgradedPattern: {
      label: '升级后时间模式',
      patterns: [
        'Protected blocks for compounding-return activities',
        'Decision to invest in long-term capabilities, not just immediate tasks',
        'Time allocated by importance, not urgency',
      ],
    },
  },

})

// ═══════════════════════════════════════════════════════════════
// SCENARIO OUTPUT CONTRACT
// ═══════════════════════════════════════════════════════════════

const SCENARIO_CONTRACT = Object.freeze({
  type: 'object',
  required: ['currentModelScenario', 'upgradedModelScenario'],
  properties: {
    currentModelScenario: {
      type: 'object',
      required: ['assumptions', 'likelyDecisionPattern', 'possibleConsequences', 'uncertainty'],
      properties: {
        assumptions: { type: 'array', items: { type: 'string' }, minItems: 1 },
        likelyDecisionPattern: { type: 'array', items: { type: 'string' }, minItems: 1 },
        possibleConsequences: { type: 'array', items: { type: 'string' }, minItems: 1 },
        uncertainty: { type: 'array', items: { type: 'string' }, minItems: 1 },
      },
    },
    upgradedModelScenario: {
      type: 'object',
      required: ['changedVariable', 'likelyDecisionPattern', 'possibleConsequences', 'observableSignals', 'uncertainty'],
      properties: {
        changedVariable: { type: 'string', minLength: 1 },
        likelyDecisionPattern: { type: 'array', items: { type: 'string' }, minItems: 1 },
        possibleConsequences: { type: 'array', items: { type: 'string' }, minItems: 1 },
        observableSignals: { type: 'array', items: { type: 'string' }, minItems: 1 },
        uncertainty: { type: 'array', items: { type: 'string' }, minItems: 1 },
      },
    },
  },
  prohibited: [
    'Income predictions',
    'Success/failure predictions',
    'Fate/destiny statements',
    'Precise probability claims',
    'Time-bound outcome guarantees',
    'Fortune-telling language',
    'Chicken-soup encouragement',
    'Deterministic future statements',
  ],
})

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

function getScenarioFramework() {
  return SCENARIO_FRAMEWORK
}

function getDimensionScenarioPatterns() {
  return DIMENSION_SCENARIO_PATTERNS
}

function getScenarioPatternForDimension(dimensionId) {
  return DIMENSION_SCENARIO_PATTERNS[dimensionId] || null
}

module.exports = {
  SCENARIO_FRAMEWORK,
  DIMENSION_SCENARIO_PATTERNS,
  SCENARIO_CONTRACT,
  getScenarioFramework,
  getDimensionScenarioPatterns,
  getScenarioPatternForDimension,
}
