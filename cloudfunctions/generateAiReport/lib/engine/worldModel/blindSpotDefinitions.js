/**
 * engine/worldModel/blindSpotDefinitions.js
 *
 * RC8.3 Cognitive Blind Spot Vocabulary v2.
 *
 * Blind spots describe what the user CANNOT SEE in their own world model —
 * not what they are bad at, not what they lack commercially.
 *
 * A blind spot is a structural gap in the cognitive model that produces
 * consistent errors in decision-making, opportunity recognition, or feedback processing.
 *
 * CRITICAL: Commercial phenomena (TRAFFIC, SELLING, PRODUCT, etc.) are NOT blind spots.
 * They are external manifestations — not cognitive gaps.
 *
 * @version world_model_v1
 */

// ═══════════════════════════════════════════════════════════════
// 9 COGNITIVE BLIND SPOTS
// ═══════════════════════════════════════════════════════════════

const BLIND_SPOT_DEFINITIONS = Object.freeze({

  OPPORTUNITY_BLINDNESS: {
    id: 'OPPORTUNITY_BLINDNESS',
    label: '机会盲区',
    mechanism: 'The user cannot see opportunities that exist because their mental model filters out possibilities outside current context. They only see paths that are visible within their current professional/social circle.',
    cognitiveRoot: 'Narrow opportunity exposure + skill identity locking + no optionality building',
    questionAnswered: '为什么明明有技能，却看不到出路？',
    signalProfile: {
      supporting: ['LOW_OPPORTUNITY_EXPOSURE', 'SINGLE_PATH_DEPENDENCE', 'FIXED_ROLE_IDENTITY', 'NETWORK_LIMITATION'],
      contradicting: ['OPPORTUNITY_RECOGNITION', 'OPTIONALITY_BUILDING', 'RESOURCE_RECOMBINATION', 'EXPANDING_IDENTITY'],
    },
    externalManifestations: [
      'User may have monetizable skills but no awareness of how to deploy them',
      'User may describe "not knowing what else I could do"',
      'Low market exposure despite having valuable capabilities',
    ],
    contract: {
      isNot: ['TRAFFIC problem', 'SELLING problem', 'MARKETING deficiency'],
      minimumEvidenceCount: 2,
      mustAllowCounterEvidence: true,
    },
  },

  FEEDBACK_LOOP_GAP: {
    id: 'FEEDBACK_LOOP_GAP',
    label: '反馈回路断裂',
    mechanism: 'The user does not receive or process external feedback effectively. Without feedback, they cannot calibrate their decisions or improve their world model. They operate on unvalidated assumptions.',
    cognitiveRoot: 'Assumptions without testing + feedback avoidance or weak feedback channels + no post-action review habit',
    questionAnswered: '为什么一直在行动却没有进步？',
    signalProfile: {
      supporting: ['WEAK_FEEDBACK_LOOP', 'FEEDBACK_AVOIDANCE', 'ASSUMPTION_WITHOUT_TEST', 'INTUITION_DOMINANT_DECISION'],
      contradicting: ['ACTIVE_FEEDBACK_SEEKING', 'POST_ACTION_REVIEW', 'MARKET_EVIDENCE_PRESENT', 'EVIDENCE_BASED_DECISION'],
    },
    externalManifestations: [
      'User may describe "I tried but it didn\'t work" without understanding why',
      'Repeated same approach without modification',
      'No market validation of skills or products',
    ],
    contract: {
      isNot: ['SALES skill gap', 'NETWORKING problem'],
      minimumEvidenceCount: 2,
      mustAllowCounterEvidence: true,
    },
  },

  DECISION_INERTIA: {
    id: 'DECISION_INERTIA',
    label: '决策惯性',
    mechanism: 'The user delays or avoids decisions requiring commitment. They wait for perfect information, more preparation, or external validation before acting. This creates a self-reinforcing cycle of inaction.',
    cognitiveRoot: 'Decision delay + binary outcome thinking (fear of wrong choice) + low uncertainty tolerance',
    questionAnswered: '为什么知道该做什么却总是不行动？',
    signalProfile: {
      supporting: ['DECISION_DELAY', 'BINARY_OUTCOME_THINKING', 'INTUITION_DOMINANT_DECISION', 'RISK_AVOIDANCE'],
      contradicting: ['DECISION_STABILITY', 'LOW_COST_EXPERIMENTATION', 'UNCERTAINTY_TOLERANCE', 'PROBABILISTIC_THINKING'],
    },
    externalManifestations: [
      'User describes "preparing" or "planning" without executing',
      'Analysis paralysis — more information does not lead to action',
      'Waiting for the "right time" or "right conditions"',
    ],
    contract: {
      isNot: ['LAZINESS', 'LACK OF MOTIVATION'],
      minimumEvidenceCount: 2,
      mustAllowCounterEvidence: true,
    },
  },

  RISK_MODEL_DISTORTION: {
    id: 'RISK_MODEL_DISTORTION',
    label: '风险模型失真',
    mechanism: 'The user\'s perception of risk is systematically distorted — either overestimating risks (missing upside) or underestimating them (concentration without awareness). Their risk calibration does not match reality.',
    cognitiveRoot: 'Loss aversion + risk avoidance or risk concentration + upside blindness + no reversibility awareness',
    questionAnswered: '为什么安全感从未真正换来安全？',
    signalProfile: {
      supporting: ['LOSS_AVERSION', 'UPSIDE_BLINDNESS', 'RISK_AVOIDANCE', 'SECURITY_FIRST_DECISION'],
      contradicting: ['DOWNSIDE_AWARENESS', 'REVERSIBILITY_AWARENESS', 'RISK_DIVERSIFICATION'],
    },
    externalManifestations: [
      'User may avoid all risk, preserving current state but missing growth',
      'Or: user may concentrate risk without diversification awareness',
      'Overestimating the safety of "safe" choices',
    ],
    contract: {
      isNot: ['FEARFUL personality', 'ANXIETY disorder'],
      minimumEvidenceCount: 2,
      mustAllowCounterEvidence: true,
    },
  },

  PROBABILITY_MISJUDGMENT: {
    id: 'PROBABILITY_MISJUDGMENT',
    label: '概率误判',
    mechanism: 'The user systematically misjudges probabilities — overestimating rare positive outcomes (lottery thinking), generalizing from small samples, or ignoring base rates. This leads to poor expected-value decisions.',
    cognitiveRoot: 'Binary outcome thinking + sample size blindness + base rate neglect + no expected value awareness',
    questionAnswered: '为什么对结果的判断总是偏离现实？',
    signalProfile: {
      supporting: ['BINARY_OUTCOME_THINKING', 'SAMPLE_SIZE_BLINDNESS', 'BASE_RATE_NEGLECT', 'LARGE_BET_TENDENCY'],
      contradicting: ['PROBABILISTIC_THINKING', 'EXPECTED_VALUE_AWARENESS', 'UNCERTAINTY_TOLERANCE'],
    },
    externalManifestations: [
      'User may overestimate chances of "hitting it big" with a single bet',
      'Generalizes from one success story while ignoring failure rates',
      'Cannot distinguish between possible and probable',
    ],
    contract: {
      isNot: ['INTELLIGENCE deficit', 'MATH skill gap'],
      minimumEvidenceCount: 2,
      mustAllowCounterEvidence: true,
    },
  },

  IDENTITY_CONSTRAINT: {
    id: 'IDENTITY_CONSTRAINT',
    label: '身份锁定',
    mechanism: 'The user\'s self-concept is locked into a fixed role, preventing them from seeing alternative paths. They define themselves by what they are (occupation, skill, role) rather than what they could become.',
    cognitiveRoot: 'Fixed role identity + skill identity + employment dependence + no expanding identity',
    questionAnswered: '为什么总觉得自己只能做这件事？',
    signalProfile: {
      supporting: ['FIXED_ROLE_IDENTITY', 'SKILL_IDENTITY', 'EMPLOYMENT_IDENTITY_DEPENDENCE', 'SINGLE_PATH_DEPENDENCE'],
      contradicting: ['EXPANDING_IDENTITY', 'ADAPTIVE_IDENTITY', 'CREATOR_IDENTITY', 'OPTIONALITY_BUILDING'],
    },
    externalManifestations: [
      'User says "I\'m a [role], that\'s all I know"',
      'Difficulty imagining alternative professional identities',
      'Self-worth tied to specific role or employer',
    ],
    contract: {
      isNot: ['LOW_SELF_ESTEEM', 'IMPERSONATOR_SYNDROME'],
      minimumEvidenceCount: 2,
      mustAllowCounterEvidence: true,
    },
  },

  LEVERAGE_MODEL_GAP: {
    id: 'LEVERAGE_MODEL_GAP',
    label: '杠杆模型缺失',
    mechanism: 'The user does not perceive or deploy leverage. They operate in linear time-value mode — one hour of work produces one hour of output. They cannot see how to multiply their impact through systems, knowledge, distribution, or capital.',
    cognitiveRoot: 'Linear time value + leverage blindness + no system leverage + capital dependence without leverage awareness',
    questionAnswered: '为什么越努力越累，结果却没有倍数增长？',
    signalProfile: {
      supporting: ['LINEAR_TIME_VALUE', 'LEVERAGE_BLINDNESS', 'CAPITAL_DEPENDENCE', 'TIME_FRAGMENTATION'],
      contradicting: ['SYSTEM_LEVERAGE', 'REPEATABLE_VALUE', 'DISTRIBUTION_LEVERAGE', 'KNOWLEDGE_LEVERAGE'],
    },
    externalManifestations: [
      'User trades time directly for money with no multiplier',
      'No systems, automation, or delegation in work process',
      'Cannot see how to scale beyond personal capacity',
    ],
    contract: {
      isNot: ['HARD_WORK problem', 'PRODUCTIVITY issue'],
      minimumEvidenceCount: 2,
      mustAllowCounterEvidence: true,
    },
  },

  SYSTEM_THINKING_GAP: {
    id: 'SYSTEM_THINKING_GAP',
    label: '系统思维缺失',
    mechanism: 'The user sees individual events rather than systems. They react to symptoms without understanding the underlying structure. They cannot perceive feedback loops, delays, or emergent behavior in complex situations.',
    cognitiveRoot: 'Short-term priority + urgency dominance + no compounding awareness + binary outcome thinking',
    questionAnswered: '为什么解决了这个问题，同样的问题又以新面孔出现？',
    signalProfile: {
      supporting: ['SHORT_TERM_PRIORITY', 'URGENCY_DOMINANCE', 'BINARY_OUTCOME_THINKING', 'SAMPLE_SIZE_BLINDNESS'],
      contradicting: ['LONG_TERM_ORIENTATION', 'COMPOUNDING_TIME_ALLOCATION', 'SYSTEM_LEVERAGE', 'PROBABILISTIC_THINKING'],
    },
    externalManifestations: [
      'User treats recurring problems as isolated incidents',
      'No understanding of how today\'s actions compound over time',
      'Focuses on symptom relief rather than structural change',
    ],
    contract: {
      isNot: ['INTELLIGENCE level', 'EDUCATION gap'],
      minimumEvidenceCount: 2,
      mustAllowCounterEvidence: true,
    },
  },

  TIME_HORIZON_TRAP: {
    id: 'TIME_HORIZON_TRAP',
    label: '时间视野陷阱',
    mechanism: 'The user operates on an extremely short time horizon, optimizing for immediate outcomes while ignoring long-term compounding. Urgent matters crowd out important ones, and the future is discounted to near-zero.',
    cognitiveRoot: 'Short-term priority + urgency dominance + time fragmentation + no compounding awareness',
    questionAnswered: '为什么总是被紧急的事推着走，却离重要目标越来越远？',
    signalProfile: {
      supporting: ['SHORT_TERM_PRIORITY', 'URGENCY_DOMINANCE', 'TIME_FRAGMENTATION', 'LOSS_AVERSION'],
      contradicting: ['LONG_TERM_ORIENTATION', 'COMPOUNDING_TIME_ALLOCATION', 'FOCUSED_TIME_BLOCKS', 'DECISION_STABILITY'],
    },
    externalManifestations: [
      'User constantly firefights urgent tasks, never works on important ones',
      'No long-term planning or investment in future capabilities',
      'Time feels scarce and reactive rather than allocated and proactive',
    ],
    contract: {
      isNot: ['BUSY schedule', 'STRESS management'],
      minimumEvidenceCount: 2,
      mustAllowCounterEvidence: true,
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// BLIND SPOT OUTPUT CONTRACT
// ═══════════════════════════════════════════════════════════════

const BLIND_SPOT_CONTRACT = Object.freeze({
  type: 'object',
  required: ['id', 'label', 'confidence', 'mechanism', 'evidence', 'counterEvidence', 'whyItMatters', 'uncertainty'],
  properties: {
    id: { type: 'string', enum: Object.keys(BLIND_SPOT_DEFINITIONS) },
    label: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    mechanism: { type: 'string', description: 'How this blind spot operates in the user\'s cognition' },
    evidence: {
      type: 'array',
      items: { type: 'object', properties: { signalId: { type: 'string' }, source: { type: 'string' }, weight: { type: 'number' } } },
      minItems: 2,
    },
    counterEvidence: {
      type: 'array',
      description: 'Signals that contradict this blind spot diagnosis — must be reported',
    },
    whyItMatters: { type: 'string', description: 'Why this blind spot is the primary one to address now' },
    uncertainty: { type: 'string', description: 'What we cannot be certain about in this diagnosis' },
  },
  rules: {
    maxOnePrimary: true,
    noCommercialPhenomenaAsBlindSpot: true,
    mustReportCounterEvidence: true,
    mustAllowRevision: true,
  },
})

// ═══════════════════════════════════════════════════════════════
// PROHIBITED BLIND SPOTS — these are NOT cognitive blind spots
// ═══════════════════════════════════════════════════════════════

const PROHIBITED_BLIND_SPOTS = Object.freeze([
  'TRAFFIC',      // This is a commercial outcome, not a cognitive gap
  'SELLING',      // This is a skill/business function, not a cognitive gap
  'PRODUCT',      // This is a deliverable, not a cognitive gap
  'PRICING',      // This is a pricing strategy, not a cognitive gap
  'SINGLE_INCOME', // This is a financial state, not a cognitive gap
  'BUILD_IP',     // This is a business strategy, not a cognitive gap
  'BUILD_PRODUCT', // This is a business strategy, not a cognitive gap
  'SKILL_GAP',    // This is a capability gap, not a cognitive blind spot
  'CAPITAL',      // This is a resource state, not a cognitive gap
])

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

function getBlindSpotIds() {
  return Object.keys(BLIND_SPOT_DEFINITIONS)
}

function getBlindSpotById(id) {
  return BLIND_SPOT_DEFINITIONS[id] || null
}

function isBlindSpotProhibited(id) {
  return PROHIBITED_BLIND_SPOTS.indexOf(id) >= 0
}

module.exports = {
  BLIND_SPOT_DEFINITIONS,
  BLIND_SPOT_CONTRACT,
  PROHIBITED_BLIND_SPOTS,
  getBlindSpotIds,
  getBlindSpotById,
  isBlindSpotProhibited,
}
