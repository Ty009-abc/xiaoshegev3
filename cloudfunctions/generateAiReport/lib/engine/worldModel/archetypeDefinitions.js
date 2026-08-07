/**
 * engine/worldModel/archetypeDefinitions.js
 *
 * RC8.3 Cognitive Archetype Vocabulary v2.
 *
 * Archetypes describe THINKING AND DECISION STRUCTURES — not occupations.
 * They answer: "How does this person understand the world and make choices?"
 *
 * Archetypes are based on cognitive patterns, not job titles.
 * Do NOT map occupations to archetypes. Do NOT use EMPLOYEE as an archetype.
 * Do NOT imply fate or capability ceiling from archetype.
 *
 * @version world_model_v1
 */

// ═══════════════════════════════════════════════════════════════
// 7 COGNITIVE ARCHETYPES
// ═══════════════════════════════════════════════════════════════

const ARCHETYPE_DEFINITIONS = Object.freeze({

  // ── EXPLORER ──
  EXPLORER: {
    id: 'EXPLORER',
    label: '探索者',
    description: 'Driven by curiosity and discovery. Seeks new information, diverse experiences, and novel combinations. Decision model: broad exploration before commitment.',
    cognitiveTraits: [
      'Actively seeks new information and experiences',
      'Comfortable with ambiguity and incomplete data',
      'Values learning over immediate results',
      'Tends to gather many possibilities before narrowing',
      'May struggle with commitment when exploration is pleasurable',
    ],
    signalAffinity: {
      high: [
        'LOW_COST_EXPERIMENTATION', 'OPTIONALITY_BUILDING',
        'ACTIVE_FEEDBACK_SEEKING', 'RESOURCE_RECOMBINATION',
        'UNCERTAINTY_TOLERANCE', 'EXPANDING_IDENTITY',
      ],
      low: [
        'SECURITY_FIRST_DECISION', 'RISK_AVOIDANCE',
        'BINARY_OUTCOME_THINKING', 'FIXED_ROLE_IDENTITY',
        'SINGLE_PATH_DEPENDENCE',
      ],
    },
    contract: {
      mustNotBeTriggeredBy: 'occupation_category',
      mustNotImply: 'career_ceiling',
      mustNotPredict: 'future_success_or_failure',
    },
  },

  // ── BUILDER ──
  BUILDER: {
    id: 'BUILDER',
    label: '构建者',
    description: 'Creates and assembles. Sees possibilities in raw materials and builds systems, products, or structures. Decision model: build first, validate through creation.',
    cognitiveTraits: [
      'Creates tangible outputs from ideas',
      'Systematically assembles components into wholes',
      'Learns through building rather than studying',
      'Values visible progress and completed artifacts',
      'May undervalue distribution and feedback in favor of building more',
    ],
    signalAffinity: {
      high: [
        'REPEATABLE_VALUE', 'CREATOR_IDENTITY',
        'LOW_COST_EXPERIMENTATION', 'SYSTEM_LEVERAGE',
        'POST_ACTION_REVIEW', 'RESOURCE_RECOMBINATION',
      ],
      low: [
        'LINEAR_TIME_VALUE', 'FEEDBACK_AVOIDANCE',
        'EMPLOYMENT_IDENTITY_DEPENDENCE', 'LEVERAGE_BLINDNESS',
        'BINARY_OUTCOME_THINKING',
      ],
    },
    contract: {
      mustNotBeTriggeredBy: 'content_skill_category',
      mustNotImply: 'technical_only_path',
      mustNotPredict: 'project_success',
    },
  },

  // ── OPERATOR ──
  OPERATOR: {
    id: 'OPERATOR',
    label: '执行者',
    description: 'Executes reliably and improves through repetition. Masters processes through consistent application. Decision model: find what works, then optimize through doing.',
    cognitiveTraits: [
      'Executes consistently with high reliability',
      'Optimizes existing processes through repeated application',
      'Values reliability and proven methods',
      'Builds deep expertise through sustained practice',
      'May default to existing methods when novel approaches are needed',
    ],
    signalAffinity: {
      high: [
        'DECISION_STABILITY', 'KNOWLEDGE_LEVERAGE',
        'POST_ACTION_REVIEW', 'FOCUSED_TIME_BLOCKS',
        'SKILL_IDENTITY',
      ],
      low: [
        'RESOURCE_RECOMBINATION', 'OPTIONALITY_BUILDING',
        'EXPANDING_IDENTITY', 'DISTRIBUTION_LEVERAGE',
        'UNCERTAINTY_TOLERANCE',
      ],
    },
    contract: {
      mustNotBeTriggeredBy: 'occupation_title',
      mustNotImply: 'only_execution_no_creation',
      mustNotPredict: 'career_trajectory',
    },
  },

  // ── STRATEGIST ──
  STRATEGIST: {
    id: 'STRATEGIST',
    label: '战略者',
    description: 'Sees the big picture and plans for leverage. Identifies high-impact leverage points. Decision model: find the move that changes everything.',
    cognitiveTraits: [
      'Identifies leverage points and system dynamics',
      'Thinks in terms of compounding effects',
      'Evaluates options by strategic position, not immediate return',
      'Plans multiple moves ahead',
      'May undervalue execution details in favor of strategic insight',
    ],
    signalAffinity: {
      high: [
        'LONG_TERM_ORIENTATION', 'COMPOUNDING_TIME_ALLOCATION',
        'EVIDENCE_BASED_DECISION', 'PROBABILISTIC_THINKING',
        'EXPECTED_VALUE_AWARENESS', 'SYSTEM_LEVERAGE',
      ],
      low: [
        'SHORT_TERM_PRIORITY', 'URGENCY_DOMINANCE',
        'BINARY_OUTCOME_THINKING', 'LINEAR_TIME_VALUE',
        'LEVERAGE_BLINDNESS',
      ],
    },
    contract: {
      mustNotBeTriggeredBy: 'income_level',
      mustNotImply: 'guaranteed_strategic_success',
      mustNotPredict: 'financial_outcome',
    },
  },

  // ── GUARDIAN ──
  GUARDIAN: {
    id: 'GUARDIAN',
    label: '守成者',
    description: 'Protects and preserves. Sees value in stability, security, and downside management. Decision model: ensure safety before growth.',
    cognitiveTraits: [
      'Prioritizes security and stability',
      'Makes careful, well-evaluated decisions',
      'Excels at risk management and downside protection',
      'Values predictability and known quantities',
      'May miss upside opportunities due to loss aversion',
    ],
    signalAffinity: {
      high: [
        'SECURITY_FIRST_DECISION', 'RISK_AVOIDANCE',
        'DOWNSIDE_AWARENESS', 'DECISION_STABILITY',
        'FIXED_ROLE_IDENTITY', 'LOSS_AVERSION',
      ],
      low: [
        'LOW_COST_EXPERIMENTATION', 'LARGE_BET_TENDENCY',
        'EXPANDING_IDENTITY', 'CREATOR_IDENTITY',
        'UNCERTAINTY_TOLERANCE',
      ],
    },
    contract: {
      mustNotBeTriggeredBy: 'age_or_life_stage',
      mustNotImply: 'no_growth_possible',
      mustNotPredict: 'stagnation',
    },
  },

  // ── CONNECTOR ──
  CONNECTOR: {
    id: 'CONNECTOR',
    label: '连接者',
    description: 'Connects people, ideas, and resources. Creates value through relationships and networks. Decision model: who can help, and how can I bring them together?',
    cognitiveTraits: [
      'Builds and leverages social networks',
      'Sees value in relationships and connections',
      'Creates opportunities through people, not just skills',
      'Excels at understanding others\' needs and bridging gaps',
      'May undervalue deep solo work in favor of collaboration',
    ],
    signalAffinity: {
      high: [
        'ACTIVE_FEEDBACK_SEEKING', 'NETWORK_LIMITATION',  // Note: NETWORK_LIMITATION absence = strength
        'OPPORTUNITY_RECOGNITION', 'RESOURCE_RECOMBINATION',
        'ADAPTIVE_IDENTITY', 'MARKET_EVIDENCE_PRESENT',
      ],
      low: [
        'LOW_OPPORTUNITY_EXPOSURE', 'FEEDBACK_AVOIDANCE',
        'FIXED_ROLE_IDENTITY', 'SINGLE_PATH_DEPENDENCE',
        'RISK_CONCENTRATION',
      ],
    },
    contract: {
      mustNotBeTriggeredBy: 'occupation_category',
      mustNotImply: 'social_butterfly_stereotype',
      mustNotPredict: 'network_size_or_value',
    },
  },

  // ── OPTIMIZER ──
  OPTIMIZER: {
    id: 'OPTIMIZER',
    label: '优化者',
    description: 'Improves existing systems and processes. Finds inefficiencies and eliminates them. Decision model: measure, improve, repeat.',
    cognitiveTraits: [
      'Systematically identifies inefficiencies',
      'Applies data and measurement to improvement',
      'Values incremental compounding gains',
      'Excels at refining existing systems rather than creating new ones',
      'May optimize local maxima at expense of exploring better alternatives',
    ],
    signalAffinity: {
      high: [
        'POST_ACTION_REVIEW', 'EVIDENCE_BASED_DECISION',
        'DECISION_STABILITY', 'FOCUSED_TIME_BLOCKS',
        'PROBABILISTIC_THINKING', 'SYSTEM_LEVERAGE',
      ],
      low: [
        'DECISION_DELAY', 'WEAK_FEEDBACK_LOOP',
        'INTUITION_DOMINANT_DECISION', 'ASSUMPTION_WITHOUT_TEST',
        'LEVERAGE_BLINDNESS',
      ],
    },
    contract: {
      mustNotBeTriggeredBy: 'skill_category',
      mustNotImply: 'only_incremental_progress',
      mustNotPredict: 'optimization_outcome',
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// ARCHETYPE OUTPUT CONTRACT
// ═══════════════════════════════════════════════════════════════

const ARCHETYPE_CONTRACT = Object.freeze({
  type: 'object',
  required: ['primary', 'secondary', 'scores', 'confidence', 'primaryTraits', 'contradictingTraits'],
  properties: {
    primary: { type: 'string', enum: Object.keys(ARCHETYPE_DEFINITIONS) },
    secondary: { type: 'string', enum: Object.keys(ARCHETYPE_DEFINITIONS) },
    scores: {
      type: 'object',
      description: 'Confidence scores for each archetype',
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    primaryTraits: {
      type: 'array',
      items: { type: 'string' },
      description: 'Verified cognitive traits supporting primary archetype',
    },
    contradictingTraits: {
      type: 'array',
      items: { type: 'string' },
      description: 'Traits that contradict the primary archetype assignment',
    },
  },
  prohibited: [
    'EMPLOYEE as archetype',
    'CREATOR triggered solely by content skills',
    'Occupation→Archetype direct mapping',
    'Archetype implying destiny or capability ceiling',
  ],
})

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

function getArchetypeIds() {
  return Object.keys(ARCHETYPE_DEFINITIONS)
}

function getArchetypeById(id) {
  return ARCHETYPE_DEFINITIONS[id] || null
}

module.exports = {
  ARCHETYPE_DEFINITIONS,
  ARCHETYPE_CONTRACT,
  getArchetypeIds,
  getArchetypeById,
}
