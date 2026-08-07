/**
 * engine/worldModel/signalDefinitions.js
 *
 * RC8.3 Behavior Signal Vocabulary v2.
 *
 * All 55 signals defined here. Each signal:
 * - Has a unique id
 * - Has name and description
 * - Has evidence requirements
 * - Has minimum confidence threshold
 * - Has conflict rules (which signals contradict it)
 *
 * SIGNALS ARE NOT CONCLUSIONS.
 * They are observable patterns from questionnaire evidence.
 * The engine interprets signals; this file only defines them.
 *
 * @version world_model_v1
 */

// ═══════════════════════════════════════════════════════════════
// DECISION SIGNALS (8)
// ═══════════════════════════════════════════════════════════════

const DECISION_SIGNALS = Object.freeze({
  EVIDENCE_BASED_DECISION: {
    id: 'EVIDENCE_BASED_DECISION',
    name: '证据驱动决策',
    description: 'Decisions are based on data, testing, or evidence rather than intuition or assumption.',
    positiveIndicator: 'User describes testing, data collection, or seeking evidence before deciding.',
    negativeIndicator: 'Decisions described as gut feeling, intuition, or assumption without testing.',
    minConfidence: 0.6,
    conflictsWith: ['INTUITION_DOMINANT_DECISION', 'ASSUMPTION_WITHOUT_TEST'],
  },
  INTUITION_DOMINANT_DECISION: {
    id: 'INTUITION_DOMINANT_DECISION',
    name: '直觉主导决策',
    description: 'Decisions rely primarily on intuition or feeling rather than systematic evidence gathering.',
    positiveIndicator: 'User defaults to "feels right" or past experience without current validation.',
    negativeIndicator: 'User describes systematic evaluation before deciding.',
    minConfidence: 0.6,
    conflictsWith: ['EVIDENCE_BASED_DECISION'],
  },
  SECURITY_FIRST_DECISION: {
    id: 'SECURITY_FIRST_DECISION',
    name: '安全优先决策',
    description: 'Decisions prioritize downside protection over upside potential.',
    positiveIndicator: 'User frames choices in terms of what to avoid losing rather than what could be gained.',
    negativeIndicator: 'User frames choices in terms of potential gains even when risks exist.',
    minConfidence: 0.5,
    conflictsWith: ['OPTION_PRESERVING_DECISION'],
  },
  OPTION_PRESERVING_DECISION: {
    id: 'OPTION_PRESERVING_DECISION',
    name: '选项保留决策',
    description: 'Decisions are made to keep multiple paths open rather than committing to one.',
    positiveIndicator: 'User avoids committing to single path, keeps alternatives open.',
    negativeIndicator: 'User commits decisively and closes off alternatives.',
    minConfidence: 0.5,
    conflictsWith: ['SECURITY_FIRST_DECISION', 'LARGE_BET_TENDENCY'],
  },
  LOW_COST_EXPERIMENTATION: {
    id: 'LOW_COST_EXPERIMENTATION',
    name: '低成本实验倾向',
    description: 'User tests ideas with minimal investment before scaling commitment.',
    positiveIndicator: 'User describes small-scale tests, prototypes, or trial runs before full commitment.',
    negativeIndicator: 'User jumps directly to full-scale effort without intermediate testing.',
    minConfidence: 0.6,
    conflictsWith: ['LARGE_BET_TENDENCY'],
  },
  LARGE_BET_TENDENCY: {
    id: 'LARGE_BET_TENDENCY',
    name: '大赌注倾向',
    description: 'User tends to commit large resources to single decisions rather than running small experiments.',
    positiveIndicator: 'User describes all-in commitments, large upfront investments, or binary go/no-go decisions.',
    negativeIndicator: 'User describes incremental testing or staged commitment.',
    minConfidence: 0.6,
    conflictsWith: ['LOW_COST_EXPERIMENTATION', 'OPTION_PRESERVING_DECISION'],
  },
  DECISION_DELAY: {
    id: 'DECISION_DELAY',
    name: '决策延迟',
    description: 'User delays decisions waiting for more information or perfect conditions.',
    positiveIndicator: 'User describes waiting, preparing, or needing more certainty before acting.',
    negativeIndicator: 'User describes acting with incomplete information and iterating.',
    minConfidence: 0.5,
    conflictsWith: ['DECISION_STABILITY', 'UNCERTAINTY_TOLERANCE'],
  },
  DECISION_STABILITY: {
    id: 'DECISION_STABILITY',
    name: '决策稳定性',
    description: 'Decision quality remains consistent across different domains and contexts.',
    positiveIndicator: 'User consistently applies decision frameworks across situations.',
    negativeIndicator: 'User decision quality varies dramatically by domain or emotional state.',
    minConfidence: 0.7,
    conflictsWith: ['DECISION_DELAY'],
  },
})

// ═══════════════════════════════════════════════════════════════
// RISK SIGNALS (7)
// ═══════════════════════════════════════════════════════════════

const RISK_SIGNALS = Object.freeze({
  RISK_AVOIDANCE: {
    id: 'RISK_AVOIDANCE',
    name: '风险回避',
    description: 'User systematically avoids situations involving uncertainty or potential loss.',
    positiveIndicator: 'User describes avoiding situations with uncertain outcomes, preferring known quantities.',
    negativeIndicator: 'User engages with uncertain situations as learning opportunities.',
    minConfidence: 0.5,
    conflictsWith: ['DOWNSIDE_AWARENESS', 'UNCERTAINTY_TOLERANCE'],
  },
  RISK_CONCENTRATION: {
    id: 'RISK_CONCENTRATION',
    name: '风险集中',
    description: 'User concentrates resources (time, money, attention) in a single domain or bet.',
    positiveIndicator: 'User describes allocating most resources to one area, bet, or income source.',
    negativeIndicator: 'User describes deliberate diversification or hedging across domains.',
    minConfidence: 0.5,
    conflictsWith: ['RISK_DIVERSIFICATION'],
  },
  RISK_DIVERSIFICATION: {
    id: 'RISK_DIVERSIFICATION',
    name: '风险分散',
    description: 'User spreads resources across multiple domains to reduce single-point failure risk.',
    positiveIndicator: 'User describes multiple income sources, skill areas, or bet hedging.',
    negativeIndicator: 'User describes all-in focus on a single domain.',
    minConfidence: 0.5,
    conflictsWith: ['RISK_CONCENTRATION'],
  },
  DOWNSIDE_AWARENESS: {
    id: 'DOWNSIDE_AWARENESS',
    name: '下行风险意识',
    description: 'User explicitly considers worst-case scenarios and plans for downside.',
    positiveIndicator: 'User calculates what they can afford to lose, has fallback plans.',
    negativeIndicator: 'User focuses only on upside without considering potential losses.',
    minConfidence: 0.5,
    conflictsWith: ['UPSIDE_BLINDNESS', 'RISK_AVOIDANCE'],
  },
  UPSIDE_BLINDNESS: {
    id: 'UPSIDE_BLINDNESS',
    name: '上行忽视',
    description: 'User focuses on avoiding loss to the point of missing upside opportunities.',
    positiveIndicator: 'User describes passing on opportunities with manageable risk due to loss fear.',
    negativeIndicator: 'User describes calculated risk-taking where upside justifies potential loss.',
    minConfidence: 0.6,
    conflictsWith: ['DOWNSIDE_AWARENESS'],
  },
  LOSS_AVERSION: {
    id: 'LOSS_AVERSION',
    name: '损失厌恶',
    description: 'User overweights potential losses relative to equivalent gains.',
    positiveIndicator: 'User frames equivalent outcomes differently when framed as loss vs gain.',
    negativeIndicator: 'User evaluates gains and losses proportionally.',
    minConfidence: 0.6,
    conflictsWith: [],
  },
  REVERSIBILITY_AWARENESS: {
    id: 'REVERSIBILITY_AWARENESS',
    name: '可逆性意识',
    description: 'User considers whether decisions can be undone and at what cost.',
    positiveIndicator: 'User evaluates the reversibility of commitments before making them.',
    negativeIndicator: 'User makes irreversible commitments without considering exit paths.',
    minConfidence: 0.6,
    conflictsWith: [],
  },
})

// ═══════════════════════════════════════════════════════════════
// PROBABILITY SIGNALS (6)
// ═══════════════════════════════════════════════════════════════

const PROBABILITY_SIGNALS = Object.freeze({
  BINARY_OUTCOME_THINKING: {
    id: 'BINARY_OUTCOME_THINKING',
    name: '二元结果思维',
    description: 'User frames outcomes as success/failure rather than probability distributions.',
    positiveIndicator: 'User uses success/failure, win/lose framing for complex multi-variable situations.',
    negativeIndicator: 'User describes ranges, likelihoods, or conditional outcomes.',
    minConfidence: 0.5,
    conflictsWith: ['PROBABILISTIC_THINKING'],
  },
  PROBABILISTIC_THINKING: {
    id: 'PROBABILISTIC_THINKING',
    name: '概率思维',
    description: 'User understands outcomes as probability distributions rather than deterministic.',
    positiveIndicator: 'User describes likelihoods, ranges, "more/less likely" framings.',
    negativeIndicator: 'User describes outcomes as certain or impossible.',
    minConfidence: 0.6,
    conflictsWith: ['BINARY_OUTCOME_THINKING'],
  },
  SAMPLE_SIZE_BLINDNESS: {
    id: 'SAMPLE_SIZE_BLINDNESS',
    name: '样本量忽视',
    description: 'User draws conclusions from too few data points or single examples.',
    positiveIndicator: 'User generalizes from one or two examples, ignores statistical significance.',
    negativeIndicator: 'User seeks multiple data points before drawing conclusions.',
    minConfidence: 0.6,
    conflictsWith: [],
  },
  BASE_RATE_NEGLECT: {
    id: 'BASE_RATE_NEGLECT',
    name: '基础概率忽视',
    description: 'User ignores statistical base rates in favor of vivid specific cases.',
    positiveIndicator: 'User references specific success stories while ignoring general failure rates.',
    negativeIndicator: 'User considers the baseline probability before evaluating specific cases.',
    minConfidence: 0.6,
    conflictsWith: [],
  },
  EXPECTED_VALUE_AWARENESS: {
    id: 'EXPECTED_VALUE_AWARENESS',
    name: '期望值意识',
    description: 'User evaluates decisions by expected value (probability × payoff) rather than gut feel.',
    positiveIndicator: 'User evaluates whether expected return justifies risk.',
    negativeIndicator: 'User evaluates only potential payoff without considering probability.',
    minConfidence: 0.7,
    conflictsWith: [],
  },
  UNCERTAINTY_TOLERANCE: {
    id: 'UNCERTAINTY_TOLERANCE',
    name: '不确定性容忍',
    description: 'User can act in conditions of incomplete information without freezing.',
    positiveIndicator: 'User describes acting despite uncertainty, iterating as information comes.',
    negativeIndicator: 'User requires certainty or complete information before acting.',
    minConfidence: 0.5,
    conflictsWith: ['DECISION_DELAY', 'RISK_AVOIDANCE'],
  },
})

// ═══════════════════════════════════════════════════════════════
// FEEDBACK SIGNALS (6)
// ═══════════════════════════════════════════════════════════════

const FEEDBACK_SIGNALS = Object.freeze({
  ACTIVE_FEEDBACK_SEEKING: {
    id: 'ACTIVE_FEEDBACK_SEEKING',
    name: '主动寻求反馈',
    description: 'User proactively seeks external feedback including from the market.',
    positiveIndicator: 'User describes asking for feedback, showing work, seeking market response.',
    negativeIndicator: 'User works in isolation without external validation.',
    minConfidence: 0.6,
    conflictsWith: ['FEEDBACK_AVOIDANCE'],
  },
  WEAK_FEEDBACK_LOOP: {
    id: 'WEAK_FEEDBACK_LOOP',
    name: '弱反馈回路',
    description: 'User receives feedback rarely or through unreliable channels.',
    positiveIndicator: 'User describes long gaps between action and feedback, unclear feedback sources.',
    negativeIndicator: 'User has tight, rapid, clear feedback mechanisms.',
    minConfidence: 0.5,
    conflictsWith: ['MARKET_EVIDENCE_PRESENT'],
  },
  POST_ACTION_REVIEW: {
    id: 'POST_ACTION_REVIEW',
    name: '行动后复盘',
    description: 'User systematically reviews outcomes after taking action.',
    positiveIndicator: 'User describes reviewing what worked, what didn\'t, and adjusting.',
    negativeIndicator: 'User moves to next action without reviewing previous outcomes.',
    minConfidence: 0.6,
    conflictsWith: [],
  },
  FEEDBACK_AVOIDANCE: {
    id: 'FEEDBACK_AVOIDANCE',
    name: '反馈回避',
    description: 'User avoids situations where their work or decisions could be evaluated.',
    positiveIndicator: 'User describes anxiety about showing work, avoiding critique.',
    negativeIndicator: 'User describes seeking evaluation and critique as growth opportunities.',
    minConfidence: 0.6,
    conflictsWith: ['ACTIVE_FEEDBACK_SEEKING'],
  },
  MARKET_EVIDENCE_PRESENT: {
    id: 'MARKET_EVIDENCE_PRESENT',
    name: '市场证据存在',
    description: 'User has received real market feedback (payments, rejections, interest).',
    positiveIndicator: 'User describes having been paid, rejected by market, or received interest signals.',
    negativeIndicator: 'User has never exposed their output to market evaluation.',
    minConfidence: 0.6,
    conflictsWith: ['WEAK_FEEDBACK_LOOP', 'ASSUMPTION_WITHOUT_TEST'],
  },
  ASSUMPTION_WITHOUT_TEST: {
    id: 'ASSUMPTION_WITHOUT_TEST',
    name: '未验证假设',
    description: 'User holds beliefs about what will work without having tested them.',
    positiveIndicator: 'User makes confident statements about market demand, user preferences without test data.',
    negativeIndicator: 'User distinguishes between assumptions and validated findings.',
    minConfidence: 0.6,
    conflictsWith: ['EVIDENCE_BASED_DECISION', 'MARKET_EVIDENCE_PRESENT'],
  },
})

// ═══════════════════════════════════════════════════════════════
// OPPORTUNITY SIGNALS (6)
// ═══════════════════════════════════════════════════════════════

const OPPORTUNITY_SIGNALS = Object.freeze({
  LOW_OPPORTUNITY_EXPOSURE: {
    id: 'LOW_OPPORTUNITY_EXPOSURE',
    name: '低机会曝光',
    description: 'User has limited exposure to diverse opportunities due to narrow network or context.',
    positiveIndicator: 'User describes limited awareness of what is possible, narrow professional circle.',
    negativeIndicator: 'User describes exposure to diverse ideas, people, and opportunity types.',
    minConfidence: 0.5,
    conflictsWith: ['OPPORTUNITY_RECOGNITION'],
  },
  OPPORTUNITY_RECOGNITION: {
    id: 'OPPORTUNITY_RECOGNITION',
    name: '机会识别能力',
    description: 'User demonstrates ability to identify and evaluate potential opportunities.',
    positiveIndicator: 'User describes having identified and evaluated multiple potential directions.',
    negativeIndicator: 'User describes difficulty seeing what is possible or available.',
    minConfidence: 0.6,
    conflictsWith: ['LOW_OPPORTUNITY_EXPOSURE'],
  },
  SINGLE_PATH_DEPENDENCE: {
    id: 'SINGLE_PATH_DEPENDENCE',
    name: '单一路径依赖',
    description: 'User relies on a single path or strategy without developing alternatives.',
    positiveIndicator: 'User describes only one viable path forward, no backup plans.',
    negativeIndicator: 'User maintains multiple parallel paths or fallback strategies.',
    minConfidence: 0.5,
    conflictsWith: ['OPTIONALITY_BUILDING'],
  },
  OPTIONALITY_BUILDING: {
    id: 'OPTIONALITY_BUILDING',
    name: '可选择性构建',
    description: 'User creates multiple options and preserves the right to choose later.',
    positiveIndicator: 'User describes developing skills, relationships, or assets that create future options.',
    negativeIndicator: 'User focuses narrowly on a single path without creating alternatives.',
    minConfidence: 0.6,
    conflictsWith: ['SINGLE_PATH_DEPENDENCE'],
  },
  NETWORK_LIMITATION: {
    id: 'NETWORK_LIMITATION',
    name: '网络局限性',
    description: 'User has limited network reach for opportunity flow.',
    positiveIndicator: 'User describes narrow professional network, few connections to opportunity sources.',
    negativeIndicator: 'User describes strong network with diverse connections.',
    minConfidence: 0.5,
    conflictsWith: [],
  },
  RESOURCE_RECOMBINATION: {
    id: 'RESOURCE_RECOMBINATION',
    name: '资源重组能力',
    description: 'User combines existing resources (skills, knowledge, relationships) in novel ways.',
    positiveIndicator: 'User describes combining unrelated skills or experiences for new purposes.',
    negativeIndicator: 'User sees current resources only in their original context.',
    minConfidence: 0.6,
    conflictsWith: [],
  },
})

// ═══════════════════════════════════════════════════════════════
// LEVERAGE SIGNALS (7)
// ═══════════════════════════════════════════════════════════════

const LEVERAGE_SIGNALS = Object.freeze({
  LINEAR_TIME_VALUE: {
    id: 'LINEAR_TIME_VALUE',
    name: '线性时间价值',
    description: 'User earns in direct proportion to time spent — one hour of work = one hour of pay.',
    positiveIndicator: 'User describes income directly tied to hours worked with no multiplier.',
    negativeIndicator: 'User describes income that is not directly proportional to hours (systems, products, leverage).',
    minConfidence: 0.6,
    conflictsWith: ['REPEATABLE_VALUE', 'SYSTEM_LEVERAGE'],
  },
  REPEATABLE_VALUE: {
    id: 'REPEATABLE_VALUE',
    name: '可重复价值',
    description: 'User creates output that can be reused or sold multiple times.',
    positiveIndicator: 'User describes creating once and selling/distributing multiple times.',
    negativeIndicator: 'User describes one-time delivery for one-time payment.',
    minConfidence: 0.6,
    conflictsWith: ['LINEAR_TIME_VALUE', 'LEVERAGE_BLINDNESS'],
  },
  SYSTEM_LEVERAGE: {
    id: 'SYSTEM_LEVERAGE',
    name: '系统杠杆',
    description: 'User uses systems, processes, or delegation to multiply personal output.',
    positiveIndicator: 'User describes processes, automation, or delegation that multiplies their work.',
    negativeIndicator: 'User describes doing everything themselves without systems.',
    minConfidence: 0.7,
    conflictsWith: ['LINEAR_TIME_VALUE', 'LEVERAGE_BLINDNESS'],
  },
  KNOWLEDGE_LEVERAGE: {
    id: 'KNOWLEDGE_LEVERAGE',
    name: '知识杠杆',
    description: 'User applies specialized knowledge for disproportionate returns.',
    positiveIndicator: 'User describes rare or deep expertise that commands premium or scale.',
    negativeIndicator: 'User describes generic skills with commodity pricing.',
    minConfidence: 0.6,
    conflictsWith: ['LEVERAGE_BLINDNESS'],
  },
  DISTRIBUTION_LEVERAGE: {
    id: 'DISTRIBUTION_LEVERAGE',
    name: '分发杠杆',
    description: 'User has or builds channels to reach many people with minimal marginal cost.',
    positiveIndicator: 'User describes content, platforms, or channels that reach many at low incremental cost.',
    negativeIndicator: 'User has no distribution channel beyond direct 1-on-1 contact.',
    minConfidence: 0.6,
    conflictsWith: ['LEVERAGE_BLINDNESS'],
  },
  CAPITAL_DEPENDENCE: {
    id: 'CAPITAL_DEPENDENCE',
    name: '资本依赖性',
    description: 'User\'s ability to act is constrained by access to financial capital.',
    positiveIndicator: 'User describes needing funding, investment, or savings before acting.',
    negativeIndicator: 'User describes acting with minimal capital via skills, creativity, or social capital.',
    minConfidence: 0.5,
    conflictsWith: [],
  },
  LEVERAGE_BLINDNESS: {
    id: 'LEVERAGE_BLINDNESS',
    name: '杠杆盲区',
    description: 'User does not perceive or pursue leverage opportunities even when they exist.',
    positiveIndicator: 'User has skills/resources but operates only linearly without seeking multiplier effects.',
    negativeIndicator: 'User actively identifies and builds leverage in their work.',
    minConfidence: 0.7,
    conflictsWith: ['SYSTEM_LEVERAGE', 'REPEATABLE_VALUE', 'KNOWLEDGE_LEVERAGE', 'DISTRIBUTION_LEVERAGE'],
  },
})

// ═══════════════════════════════════════════════════════════════
// IDENTITY SIGNALS (6)
// ═══════════════════════════════════════════════════════════════

const IDENTITY_SIGNALS = Object.freeze({
  FIXED_ROLE_IDENTITY: {
    id: 'FIXED_ROLE_IDENTITY',
    name: '固定角色身份',
    description: 'User defines themselves by a fixed role, limiting perceived possibilities.',
    positiveIndicator: 'User describes themselves in immutable terms: "I am a [role], that\'s what I do."',
    negativeIndicator: 'User describes multiple possible roles and evolving identity.',
    minConfidence: 0.6,
    conflictsWith: ['EXPANDING_IDENTITY', 'ADAPTIVE_IDENTITY', 'CREATOR_IDENTITY'],
  },
  EXPANDING_IDENTITY: {
    id: 'EXPANDING_IDENTITY',
    name: '扩展中身份',
    description: 'User is actively expanding their perceived possible roles and capabilities.',
    positiveIndicator: 'User describes learning new domains, exploring new roles, breaking from past identity.',
    negativeIndicator: 'User restricts themselves to familiar roles.',
    minConfidence: 0.6,
    conflictsWith: ['FIXED_ROLE_IDENTITY', 'EMPLOYMENT_IDENTITY_DEPENDENCE'],
  },
  EMPLOYMENT_IDENTITY_DEPENDENCE: {
    id: 'EMPLOYMENT_IDENTITY_DEPENDENCE',
    name: '雇佣身份依赖',
    description: 'User\'s sense of capability and security is strongly tied to employment status.',
    positiveIndicator: 'User describes their worth, security, or capability primarily through employment lens.',
    negativeIndicator: 'User derives identity from multiple sources beyond employment.',
    minConfidence: 0.5,
    conflictsWith: ['ADAPTIVE_IDENTITY', 'EXPANDING_IDENTITY', 'CREATOR_IDENTITY'],
  },
  SKILL_IDENTITY: {
    id: 'SKILL_IDENTITY',
    name: '技能身份',
    description: 'User defines themselves primarily by their professional skill set.',
    positiveIndicator: 'User describes identity as "I am a [skill]" rather than "I do [skill]".',
    negativeIndicator: 'User describes skills as tools they use, not as who they are.',
    minConfidence: 0.6,
    conflictsWith: ['ADAPTIVE_IDENTITY'],
  },
  CREATOR_IDENTITY: {
    id: 'CREATOR_IDENTITY',
    name: '创造者身份',
    description: 'User sees themselves as someone who creates and builds, not just executes.',
    positiveIndicator: 'User describes initiating projects, building things from scratch, creating value.',
    negativeIndicator: 'User describes executing existing processes without initiating.',
    minConfidence: 0.6,
    conflictsWith: ['FIXED_ROLE_IDENTITY', 'EMPLOYMENT_IDENTITY_DEPENDENCE'],
  },
  ADAPTIVE_IDENTITY: {
    id: 'ADAPTIVE_IDENTITY',
    name: '适应性身份',
    description: 'User adapts their self-concept based on context and learning, not fixed labels.',
    positiveIndicator: 'User describes changing roles, learning new domains, flexible self-concept.',
    negativeIndicator: 'User describes rigid self-concept resistant to context change.',
    minConfidence: 0.7,
    conflictsWith: ['FIXED_ROLE_IDENTITY', 'SKILL_IDENTITY', 'EMPLOYMENT_IDENTITY_DEPENDENCE'],
  },
})

// ═══════════════════════════════════════════════════════════════
// TIME SIGNALS (6)
// ═══════════════════════════════════════════════════════════════

const TIME_SIGNALS = Object.freeze({
  SHORT_TERM_PRIORITY: {
    id: 'SHORT_TERM_PRIORITY',
    name: '短期优先',
    description: 'User prioritizes immediate outcomes over long-term compounding.',
    positiveIndicator: 'User describes optimizing for this week/month rather than this year/decade.',
    negativeIndicator: 'User describes making short-term sacrifices for long-term outcomes.',
    minConfidence: 0.5,
    conflictsWith: ['LONG_TERM_ORIENTATION', 'COMPOUNDING_TIME_ALLOCATION'],
  },
  LONG_TERM_ORIENTATION: {
    id: 'LONG_TERM_ORIENTATION',
    name: '长期导向',
    description: 'User makes decisions optimized for long-term outcomes even at short-term cost.',
    positiveIndicator: 'User describes investing time now for future payoff, delaying gratification.',
    negativeIndicator: 'User always optimizes for immediate results.',
    minConfidence: 0.6,
    conflictsWith: ['SHORT_TERM_PRIORITY'],
  },
  TIME_FRAGMENTATION: {
    id: 'TIME_FRAGMENTATION',
    name: '时间碎片化',
    description: 'User\'s time is fragmented across many small activities without focus blocks.',
    positiveIndicator: 'User describes many small activities, frequent context switching, lack of deep work.',
    negativeIndicator: 'User describes dedicated focus blocks for deep work.',
    minConfidence: 0.5,
    conflictsWith: ['FOCUSED_TIME_BLOCKS', 'COMPOUNDING_TIME_ALLOCATION'],
  },
  FOCUSED_TIME_BLOCKS: {
    id: 'FOCUSED_TIME_BLOCKS',
    name: '专注时间块',
    description: 'User allocates and protects large blocks of uninterrupted time.',
    positiveIndicator: 'User describes having dedicated focus time for important work.',
    negativeIndicator: 'User describes constant interruptions, no protected focus time.',
    minConfidence: 0.6,
    conflictsWith: ['TIME_FRAGMENTATION'],
  },
  URGENCY_DOMINANCE: {
    id: 'URGENCY_DOMINANCE',
    name: '紧急主导',
    description: 'User is driven by what is urgent rather than what is important.',
    positiveIndicator: 'User describes reacting to urgent demands, firefighting, deadline-driven.',
    negativeIndicator: 'User describes proactively allocating time to important non-urgent work.',
    minConfidence: 0.5,
    conflictsWith: ['COMPOUNDING_TIME_ALLOCATION'],
  },
  COMPOUNDING_TIME_ALLOCATION: {
    id: 'COMPOUNDING_TIME_ALLOCATION',
    name: '复利时间配置',
    description: 'User allocates time to activities whose value compounds over time.',
    positiveIndicator: 'User describes investing in learning, relationships, systems that grow over time.',
    negativeIndicator: 'User spends time only on activities with one-time payoffs.',
    minConfidence: 0.7,
    conflictsWith: ['URGENCY_DOMINANCE', 'SHORT_TERM_PRIORITY', 'TIME_FRAGMENTATION'],
  },
})

// ═══════════════════════════════════════════════════════════════
// ALL SIGNALS — FLAT INDEX
// ═══════════════════════════════════════════════════════════════

const ALL_SIGNALS = Object.freeze(Object.assign(
  {},
  DECISION_SIGNALS,
  RISK_SIGNALS,
  PROBABILITY_SIGNALS,
  FEEDBACK_SIGNALS,
  OPPORTUNITY_SIGNALS,
  LEVERAGE_SIGNALS,
  IDENTITY_SIGNALS,
  TIME_SIGNALS,
))

// ═══════════════════════════════════════════════════════════════
// SIGNAL_CATEGORIES — grouped by dimension
// ═══════════════════════════════════════════════════════════════

const SIGNAL_CATEGORIES = Object.freeze({
  DECISION_MODEL: DECISION_SIGNALS,
  RISK_MODEL: RISK_SIGNALS,
  PROBABILITY_MODEL: PROBABILITY_SIGNALS,
  FEEDBACK_MODEL: FEEDBACK_SIGNALS,
  OPPORTUNITY_MODEL: OPPORTUNITY_SIGNALS,
  LEVERAGE_MODEL: LEVERAGE_SIGNALS,
  IDENTITY_MODEL: IDENTITY_SIGNALS,
  TIME_MODEL: TIME_SIGNALS,
})

// ═══════════════════════════════════════════════════════════════
// UTILITY — get all signal IDs
// ═══════════════════════════════════════════════════════════════

function getSignalIds() {
  return Object.keys(ALL_SIGNALS)
}

function getSignalById(id) {
  return ALL_SIGNALS[id] || null
}

function getSignalsByCategory(categoryId) {
  return SIGNAL_CATEGORIES[categoryId] || {}
}

module.exports = {
  DECISION_SIGNALS,
  RISK_SIGNALS,
  PROBABILITY_SIGNALS,
  FEEDBACK_SIGNALS,
  OPPORTUNITY_SIGNALS,
  LEVERAGE_SIGNALS,
  IDENTITY_SIGNALS,
  TIME_SIGNALS,
  ALL_SIGNALS,
  SIGNAL_CATEGORIES,
  getSignalIds,
  getSignalById,
  getSignalsByCategory,
}
