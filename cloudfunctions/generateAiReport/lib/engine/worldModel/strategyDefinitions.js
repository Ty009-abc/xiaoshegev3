/**
 * engine/worldModel/strategyDefinitions.js
 *
 * RC8.3 World Strategy Vocabulary v2.
 *
 * Strategies address COGNITIVE SYSTEMS — not commercial directions.
 * A strategy upgrades a dimension of the user's world model.
 *
 * Commercial tactics (product, content, sales, IP) can only appear
 * as firstExperiment carriers — never as the strategy itself.
 *
 * @version world_model_v1
 */

// ═══════════════════════════════════════════════════════════════
// 9 WORLD STRATEGIES
// ═══════════════════════════════════════════════════════════════

const STRATEGY_DEFINITIONS = Object.freeze({

  BUILD_FEEDBACK_LOOP: {
    id: 'BUILD_FEEDBACK_LOOP',
    label: '建立反馈回路',
    mechanism: "Upgrade the FEEDBACK_MODEL dimension. Transform the user's relationship with external feedback — from passive receipt or avoidance to active seeking and systematic processing.",
    targetBlindSpot: 'FEEDBACK_LOOP_GAP',
    cognitiveUpgrade: '从"假设→行动→猜测结果"升级到"假设→低成本实验→市场反馈→调整假设"',
    experimentTemplates: [
      {
        name: 'Market signal test',
        description: 'Expose an existing skill or output to a real market signal (offer, quote, proposal) and observe the response — not to sell, but to learn.',
      },
      {
        name: 'Post-action review habit',
        description: 'After every significant action, write down: what was expected, what actually happened, what was learned. Do this 5 times.',
      },
      {
        name: 'Feedback request',
        description: 'Ask 3 people (not friends/family) for honest feedback on a specific output or decision.',
      },
    ],
    successSignal: 'User can name a specific belief that was revised based on external feedback within the review window.',
    reviewWindow: '2 weeks',
    stopCondition: 'Feedback loop is actively generating calibration data; user no longer operates on untested assumptions.',
    contract: {
      isNotCommercialDirection: true,
      firstExperimentMustBeCognitive: true,
      commercialCarrierOptional: true,
    },
  },

  EXPAND_OPTIONALITY: {
    id: 'EXPAND_OPTIONALITY',
    label: '扩展可选择性',
    mechanism: 'Upgrade the OPPORTUNITY_MODEL dimension. Build multiple parallel options so the user can choose later when they have more information — rather than committing to a single path prematurely.',
    targetBlindSpot: 'OPPORTUNITY_BLINDNESS',
    cognitiveUpgrade: '从"找到一条最好的路"升级到"同时培育多个可能路径，让时间带来更多信息后再选择"',
    experimentTemplates: [
      {
        name: 'Skill/asset inventory',
        description: 'List all skills, resources, and relationships. For each, identify at least one alternative use outside current context.',
      },
      {
        name: 'Low-cost path test',
        description: 'Identify 3 possible directions. Spend minimal time/money testing each (not committing). After 2 weeks, evaluate which showed most signal.',
      },
      {
        name: 'Network expansion',
        description: 'Meet or connect with 5 people outside current professional circle. Ask what opportunities they see in the world.',
      },
    ],
    successSignal: 'User can list 3+ viable alternative paths with at least preliminary evidence for each.',
    reviewWindow: '4 weeks',
    stopCondition: 'User has genuine optionality — multiple viable paths with real (not imagined) evidence.',
    contract: {
      isNotCommercialDirection: true,
      firstExperimentMustBeCognitive: true,
      commercialCarrierOptional: true,
    },
  },

  INCREASE_EXPERIMENT_RATE: {
    id: 'INCREASE_EXPERIMENT_RATE',
    label: '提高实验密度',
    mechanism: 'Upgrade the DECISION_MODEL dimension. Replace large-bet or delayed-decision patterns with rapid, low-cost experiments that generate learning through action rather than analysis.',
    targetBlindSpot: 'DECISION_INERTIA',
    cognitiveUpgrade: '从"准备充分再行动" / "一次押注"升级到"用最小的成本最快的速度获得真实反馈"',
    experimentTemplates: [
      {
        name: 'One-day experiment',
        description: 'Pick one assumption. Design and execute a test in one day. The goal is learning, not result.',
      },
      {
        name: 'Decision journal',
        description: 'For one week, write down every significant decision: what you decided, why, and what you expected. Review after one week.',
      },
      {
        name: 'Reversibility audit',
        description: 'For each pending decision, ask: "If this goes wrong, can I undo it? At what cost?" Prioritize reversible decisions for immediate action.',
      },
    ],
    successSignal: 'User completes 3+ low-cost experiments in the review window and can articulate what was learned from each.',
    reviewWindow: '2 weeks',
    stopCondition: 'User defaults to testing rather than deliberating; experiment rate is sustained without external prompting.',
    contract: {
      isNotCommercialDirection: true,
      firstExperimentMustBeCognitive: true,
      commercialCarrierOptional: true,
    },
  },

  REFRAME_RISK_MODEL: {
    id: 'REFRAME_RISK_MODEL',
    label: '重构风险认知',
    mechanism: "Upgrade the RISK_MODEL dimension. Correct systematic distortions in the user's risk perception — teaching calibrated risk assessment rather than avoidance or concentration.",
    targetBlindSpot: 'RISK_MODEL_DISTORTION',
    cognitiveUpgrade: '从"避免所有风险" / "无视风险"升级到"评估风险大小、可逆性、上行空间，做知情决策"',
    experimentTemplates: [
      {
        name: 'Risk mapping',
        description: 'Map current risks: what could go wrong, probability, impact, reversibility. Identify which are overestimated and which are underestimated.',
      },
      {
        name: 'Controlled exposure',
        description: 'Take one small, reversible risk that was previously avoided. Set a clear limit on downside. Observe outcome and emotional response.',
      },
      {
        name: 'Downside calculation',
        description: 'For the next opportunity considered, explicitly calculate: best case, worst case, most likely case. Compare worst case to ability to recover.',
      },
    ],
    successSignal: 'User can articulate a calibrated risk assessment (with probabilities) for a real decision, and the assessment is grounded in evidence.',
    reviewWindow: '3 weeks',
    stopCondition: 'User makes risk decisions based on expected value and reversibility rather than fear or overconfidence.',
    contract: {
      isNotCommercialDirection: true,
      firstExperimentMustBeCognitive: true,
      commercialCarrierOptional: true,
    },
  },

  UPGRADE_PROBABILITY_THINKING: {
    id: 'UPGRADE_PROBABILITY_THINKING',
    label: '升级概率思维',
    mechanism: 'Upgrade the PROBABILITY_MODEL dimension. Move from binary success/failure framing to probabilistic thinking — understanding ranges, likelihoods, and expected value.',
    targetBlindSpot: 'PROBABILITY_MISJUDGMENT',
    cognitiveUpgrade: '从"这事能成吗？"升级到"在不同条件下，成和不成各有多大概率？我做这个决定的期望值是多少？"',
    experimentTemplates: [
      {
        name: 'Probability calibration',
        description: 'For 5 predictions about upcoming events, assign probabilities (not yes/no). Track accuracy over 2 weeks.',
      },
      {
        name: 'Base rate research',
        description: 'For one major decision, research: "In similar situations, what percentage of people succeed/fail?" Compare to personal estimate.',
      },
      {
        name: 'Expected value framing',
        description: 'Reframe one pending decision in expected value terms: (probability of success × value of success) + (probability of failure × cost of failure).',
      },
    ],
    successSignal: 'User can express a real decision in probabilistic terms with explicit assumptions about probabilities.',
    reviewWindow: '3 weeks',
    stopCondition: 'User habitually thinks in likelihoods and expected value rather than binary outcomes.',
    contract: {
      isNotCommercialDirection: true,
      firstExperimentMustBeCognitive: true,
      commercialCarrierOptional: true,
    },
  },

  EXPAND_IDENTITY_BOUNDARY: {
    id: 'EXPAND_IDENTITY_BOUNDARY',
    label: '扩展身份边界',
    mechanism: "Upgrade the IDENTITY_MODEL dimension. Break the user's self-concept out of a fixed role by creating evidence of capability in new domains.",
    targetBlindSpot: 'IDENTITY_CONSTRAINT',
    cognitiveUpgrade: '从"我是XX职业的人"升级到"我拥有这些能力，可以在多个领域创造价值"',
    experimentTemplates: [
      {
        name: 'Identity experiment',
        description: 'Do one small project outside current professional identity. The point is not quality but proof that "I can do something different."',
      },
      {
        name: 'Skill transfer mapping',
        description: 'List current skills. For each, identify 3 different contexts where it applies. Choose one to test.',
      },
      {
        name: 'Role narrative rewrite',
        description: "Rewrite how you describe yourself — from role-based to capability-based. Test this description with 3 people.",
      },
    ],
    successSignal: 'User describes themselves using capabilities and values rather than a single role or occupation.',
    reviewWindow: '4 weeks',
    stopCondition: 'User has evidence of effectiveness in at least one domain outside their original identity frame.',
    contract: {
      isNotCommercialDirection: true,
      firstExperimentMustBeCognitive: true,
      commercialCarrierOptional: true,
    },
  },

  BUILD_LEVERAGE_MODEL: {
    id: 'BUILD_LEVERAGE_MODEL',
    label: '建立杠杆意识',
    mechanism: 'Upgrade the LEVERAGE_MODEL dimension. Help the user see and deploy leverage — moving from linear time-value to multiplied output through systems, knowledge, or distribution.',
    targetBlindSpot: 'LEVERAGE_MODEL_GAP',
    cognitiveUpgrade: '从"一份时间换一份回报"升级到"识别并用好杠杆——系统/知识/分发——让一份投入产生多份回报"',
    experimentTemplates: [
      {
        name: 'Leverage audit',
        description: 'Audit current work: what percentage is linear (one time = one output)? Identify the highest-leverage activity and increase its share.',
      },
      {
        name: 'Repeatable output',
        description: 'Create one piece of output that can be used more than once (template, guide, recording, process). Observe the multiplier effect.',
      },
      {
        name: 'Delegation/automation test',
        description: 'Identify one recurring task. Either automate it or delegate it. Measure time freed up and quality of outcome.',
      },
    ],
    successSignal: 'User can identify and articulate at least one leverage point in their work and has taken action on it.',
    reviewWindow: '3 weeks',
    stopCondition: 'User actively seeks and deploys leverage in daily work rather than defaulting to linear effort.',
    contract: {
      isNotCommercialDirection: true,
      firstExperimentMustBeCognitive: true,
      commercialCarrierOptional: true,
    },
  },

  BUILD_DECISION_SYSTEM: {
    id: 'BUILD_DECISION_SYSTEM',
    label: '建立决策系统',
    mechanism: 'Upgrade the DECISION_MODEL and SYSTEM_THINKING dimensions. Move from isolated event-level thinking to systematic decision-making with feedback, calibration, and compounding.',
    targetBlindSpot: 'SYSTEM_THINKING_GAP',
    cognitiveUpgrade: '从"解决眼前问题"升级到"建立持续产生好决策的系统，让今天的决策为明天的决策创造更好的条件"',
    experimentTemplates: [
      {
        name: 'Decision process design',
        description: 'Write down your current decision process. Identify the weakest step. Design one improvement and test it on the next 3 decisions.',
      },
      {
        name: 'System mapping',
        description: 'Map one recurring problem as a system: inputs, process, outputs, feedback loops. Identify the highest-leverage intervention point.',
      },
      {
        name: 'Compounding audit',
        description: 'Audit time allocation: what percentage goes to activities whose value compounds vs one-time payoff? Shift 5% toward compounding.',
      },
    ],
    successSignal: 'User can describe their decision system and has evidence of improved decision quality from systematic calibration.',
    reviewWindow: '4 weeks',
    stopCondition: 'User has a repeatable decision process that generates compounding improvements.',
    contract: {
      isNotCommercialDirection: true,
      firstExperimentMustBeCognitive: true,
      commercialCarrierOptional: true,
    },
  },

  EXTEND_TIME_HORIZON: {
    id: 'EXTEND_TIME_HORIZON',
    label: '延伸时间视野',
    mechanism: 'Upgrade the TIME_MODEL dimension. Break the urgency trap by creating protected time for important-but-not-urgent activities that compound over time.',
    targetBlindSpot: 'TIME_HORIZON_TRAP',
    cognitiveUpgrade: '从"被紧急任务推着走"升级到"主动配置时间——给重要的事留出不可侵犯的空间，让复利发生"',
    experimentTemplates: [
      {
        name: 'Time audit',
        description: 'Track time for 3 days. Categorize each activity: urgent/not-urgent × important/not-important. Identify the pattern.',
      },
      {
        name: 'Protected block',
        description: 'Schedule and defend one 2-hour block per week for important-but-not-urgent work. Do this for 3 weeks.',
      },
      {
        name: 'Long-term bet',
        description: 'Identify one activity whose value compounds over years. Invest a small, consistent amount of time in it weekly.',
      },
    ],
    successSignal: 'User has a recurring protected time block for compounding activities and can show progress on a long-term goal.',
    reviewWindow: '4 weeks',
    stopCondition: 'User routinely allocates time based on importance rather than urgency; long-term projects show consistent progress.',
    contract: {
      isNotCommercialDirection: true,
      firstExperimentMustBeCognitive: true,
      commercialCarrierOptional: true,
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// STRATEGY OUTPUT CONTRACT
// ═══════════════════════════════════════════════════════════════

const STRATEGY_CONTRACT = Object.freeze({
  type: 'object',
  required: ['id', 'label', 'targetBlindSpot', 'mechanism', 'firstExperiment', 'successSignal', 'reviewWindow', 'stopCondition'],
  properties: {
    id: { type: 'string', enum: Object.keys(STRATEGY_DEFINITIONS) },
    label: { type: 'string' },
    targetBlindSpot: { type: 'string', description: 'The cognitive blind spot this strategy addresses' },
    mechanism: { type: 'string', description: 'How this strategy upgrades the user\'s world model' },
    firstExperiment: {
      type: 'object',
      required: ['name', 'description', 'cognitiveGoal'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        cognitiveGoal: { type: 'string', description: 'What cognitive upgrade this experiment tests' },
        commercialCarrier: { type: 'string', description: 'OPTIONAL — a commercial context for the experiment, e.g., "Package your existing skill as a service offering and quote 3 people"' },
      },
    },
    successSignal: { type: 'string', description: 'Observable signal that the cognitive upgrade is working' },
    reviewWindow: { type: 'string', description: 'When to review progress' },
    stopCondition: { type: 'string', description: 'When this strategy has achieved its goal' },
  },
  rules: {
    strategyMustAddressCognitiveSystem: true,
    commercialDirectionOnlyAsExperimentCarrier: true,
    mustPairWithBlindSpot: true,
    mustHaveObservableSuccessSignal: true,
    mustHaveStopCondition: true,
  },
})

// ═══════════════════════════════════════════════════════════════
// PROHIBITED STRATEGIES — these are NOT cognitive strategies
// ═══════════════════════════════════════════════════════════════

const PROHIBITED_STRATEGIES = Object.freeze([
  'BUILD_PRODUCT',     // Commercial direction, not cognitive upgrade
  'DO_CONTENT',        // Commercial direction, not cognitive upgrade
  'DO_SALES',          // Commercial direction, not cognitive upgrade
  'BUILD_IP',          // Commercial direction, not cognitive upgrade
  'DO_FREELANCE',      // Commercial direction, not cognitive upgrade
  'DO_AI_SIDE_HUSTLE', // Commercial direction, not cognitive upgrade
  'DO_SHORT_VIDEO',    // Commercial direction, not cognitive upgrade
  'START_BUSINESS',    // Commercial direction, not cognitive upgrade
  'DIRECT_SELL',       // Commercial direction, not cognitive upgrade
  'MULTI_INCOME',      // Financial outcome, not cognitive upgrade
  'CAPITAL_ACCUMULATION', // Financial outcome, not cognitive upgrade
  'TEAM_BUILD',        // Organizational tactic, not cognitive upgrade
  'SKILL_UPGRADE',     // Capability upgrade, not cognitive model upgrade
])

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

function getStrategyIds() {
  return Object.keys(STRATEGY_DEFINITIONS)
}

function getStrategyById(id) {
  return STRATEGY_DEFINITIONS[id] || null
}

function isStrategyProhibited(id) {
  return PROHIBITED_STRATEGIES.indexOf(id) >= 0
}

module.exports = {
  STRATEGY_DEFINITIONS,
  STRATEGY_CONTRACT,
  PROHIBITED_STRATEGIES,
  getStrategyIds,
  getStrategyById,
  isStrategyProhibited,
}
