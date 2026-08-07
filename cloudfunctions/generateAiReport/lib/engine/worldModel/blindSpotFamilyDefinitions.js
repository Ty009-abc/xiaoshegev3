/**
 * engine/worldModel/blindSpotFamilyDefinitions.js
 *
 * RC8.3 C3-002A — Blind Spot Family Definitions.
 *
 * Defines 4 cognitive families that group confusable Blind Spots
 * by their underlying cognitive mechanism. Family-level inference
 * precedes final Blind Spot selection.
 *
 * FAMILIES:
 *   1. DECISION_ADAPTATION    — Action vs Learning gap
 *   2. RESOURCE_COMPOUNDING   — Leverage vs Time horizon gap
 *   3. UNCERTAINTY_JUDGMENT   — Risk perception vs Probability framework gap
 *   4. MODEL_BOUNDARY         — Opportunity vs Identity vs System thinking gap
 *
 * DESIGN CONSTRAINTS (HARD):
 * - Each family must reference C1 Boundary architecture
 * - No direct Blind Spot, Archetype, or Strategy determination
 * - No occupation, income, or business reasoning
 *
 * @version world_model_v3
 * @sprint c3-002a
 */

// ═══════════════════════════════════════════════════════════════
// BLIND SPOT FAMILIES
// ═══════════════════════════════════════════════════════════════

const BLIND_SPOT_FAMILIES = Object.freeze({

  // ─────────────────────────────────────────────────────────────
  // FAMILY 1: DECISION_ADAPTATION
  // ─────────────────────────────────────────────────────────────

  DECISION_ADAPTATION: {
    id: 'DECISION_ADAPTATION',
    label: '执行/适应',
    description: '行动与学习之间的落差：是"不行动所以没有信息"还是"行动了但没有学习"？',
    c1Boundary: 'EXECUTION_ADAPTATION_GAP',
    candidates: ['DECISION_INERTIA', 'FEEDBACK_LOOP_GAP'],

    // Secondary signals that support this family
    secondarySignals: [
      'WAITING_DURATION_PATTERN',      // supports DECISION_INERTIA
      'MINIMUM_STEP_EXECUTION',        // supports FEEDBACK_LOOP_GAP
      'POST_ACTION_REVIEW_HABIT',      // supports FEEDBACK_LOOP_GAP
      'DECISION_TO_ACTION_LATENCY',    // supports FEEDBACK_LOOP_GAP
    ],

    // Weight per signal for family scoring
    signalWeights: {
      WAITING_DURATION_PATTERN: 0.4,
      MINIMUM_STEP_EXECUTION: 0.3,
      POST_ACTION_REVIEW_HABIT: 0.2,
      DECISION_TO_ACTION_LATENCY: 0.1,
    },

    // Dimensions from World Model that indicate this family
    relevantDimensions: ['DECISION_MODEL', 'FEEDBACK_MODEL'],

    // Minimum supporting signals to consider this family
    minimumSignals: 1,
  },

  // ─────────────────────────────────────────────────────────────
  // FAMILY 2: RESOURCE_COMPOUNDING
  // ─────────────────────────────────────────────────────────────

  RESOURCE_COMPOUNDING: {
    id: 'RESOURCE_COMPOUNDING',
    label: '资源/复利',
    description: '价值放大与时间尺度之间的失衡：是"不会放大"还是"不愿等待"？',
    c1Boundary: 'RESOURCE_COMPOUNDING_GAP',
    candidates: ['LEVERAGE_MODEL_GAP', 'TIME_HORIZON_TRAP'],

    secondarySignals: [
      'OUTPUT_DECOUPLING_AWARENESS',       // supports LEVERAGE_MODEL_GAP
      'EFFORT_VS_MECHANISM_FRAMING',       // supports LEVERAGE_MODEL_GAP
      'DIRECTION_SWITCHING_FREQUENCY',     // supports TIME_HORIZON_TRAP
      'LONG_TERM_COMPOUNDING_AWARENESS',   // supports TIME_HORIZON_TRAP
      'ALTERNATIVE_PATH_COST_AWARENESS',   // supports TIME_HORIZON_TRAP
    ],

    signalWeights: {
      OUTPUT_DECOUPLING_AWARENESS: 0.25,
      EFFORT_VS_MECHANISM_FRAMING: 0.2,
      DIRECTION_SWITCHING_FREQUENCY: 0.25,
      LONG_TERM_COMPOUNDING_AWARENESS: 0.15,
      ALTERNATIVE_PATH_COST_AWARENESS: 0.15,
    },

    relevantDimensions: ['LEVERAGE_MODEL', 'TIME_MODEL'],

    minimumSignals: 1,
  },

  // ─────────────────────────────────────────────────────────────
  // FAMILY 3: UNCERTAINTY_JUDGMENT
  // ─────────────────────────────────────────────────────────────

  UNCERTAINTY_JUDGMENT: {
    id: 'UNCERTAINTY_JUDGMENT',
    label: '不确定性判断',
    description: '风险感知与概率框架之间的缺陷：是"判断被情绪扭曲"还是"缺少判断工具"？',
    c1Boundary: 'PERCEPTION_RISK_GAP',
    candidates: ['RISK_MODEL_DISTORTION', 'PROBABILITY_MISJUDGMENT'],

    secondarySignals: [
      'EMOTIONAL_RECENCY_IMPACT',            // supports RISK_MODEL_DISTORTION
      'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT',  // supports RISK_MODEL_DISTORTION
      'PROBABILISTIC_LANGUAGE_USAGE',        // supports PROBABILITY_MISJUDGMENT
      'LUCK_VS_SKILL_ATTRIBUTION',           // supports PROBABILITY_MISJUDGMENT
      'FEEDBACK_CALIBRATION_RATE',           // supports PROBABILITY_MISJUDGMENT
    ],

    signalWeights: {
      EMOTIONAL_RECENCY_IMPACT: 0.25,
      ABSTRACT_VS_EMBODIED_RISK_JUDGMENT: 0.2,
      PROBABILISTIC_LANGUAGE_USAGE: 0.2,
      LUCK_VS_SKILL_ATTRIBUTION: 0.2,
      FEEDBACK_CALIBRATION_RATE: 0.15,
    },

    relevantDimensions: ['RISK_MODEL', 'PROBABILITY_MODEL'],

    minimumSignals: 1,
  },

  // ─────────────────────────────────────────────────────────────
  // FAMILY 4: MODEL_BOUNDARY
  // ─────────────────────────────────────────────────────────────

  MODEL_BOUNDARY: {
    id: 'MODEL_BOUNDARY',
    label: '模型边界',
    description: '认知模型的边界限制：是"看不到"、"被身份过滤"还是"线性思维无法理解复杂系统"？',
    c1Boundary: 'FRAMEWORK_GAP',
    candidates: ['OPPORTUNITY_BLINDNESS', 'IDENTITY_CONSTRAINT', 'SYSTEM_THINKING_GAP'],

    secondarySignals: [
      // Opportunity side
      'INFORMATION_SOURCE_DIVERSITY',
      'SERENDIPITOUS_PATH_DISCOVERY',
      'NON_DOMAIN_PATH_AWARENESS',
      // Identity side
      'IDENTITY_BASED_EXCLUSION',
      'CROSS_IDENTITY_ATTEMPT_HISTORY',
      'SELF_ASSESSMENT_ASYMMETRY',
      // System thinking side
      'FEEDBACK_LOOP_CONCEPT_AWARENESS',
      'CROSS_DOMAIN_FEEDBACK_THINKING',
      'LINEARTY_VS_COMPLEXITY_DEFAULT',
    ],

    signalWeights: {
      INFORMATION_SOURCE_DIVERSITY: 0.15,
      SERENDIPITOUS_PATH_DISCOVERY: 0.1,
      NON_DOMAIN_PATH_AWARENESS: 0.1,
      IDENTITY_BASED_EXCLUSION: 0.15,
      CROSS_IDENTITY_ATTEMPT_HISTORY: 0.1,
      SELF_ASSESSMENT_ASYMMETRY: 0.1,
      FEEDBACK_LOOP_CONCEPT_AWARENESS: 0.1,
      CROSS_DOMAIN_FEEDBACK_THINKING: 0.1,
      LINEARTY_VS_COMPLEXITY_DEFAULT: 0.1,
    },

    relevantDimensions: ['OPPORTUNITY_MODEL', 'IDENTITY_MODEL'],

    minimumSignals: 1,
  },

})

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

function getAllFamilyIds() {
  return Object.keys(BLIND_SPOT_FAMILIES)
}

function getFamily(familyId) {
  return BLIND_SPOT_FAMILIES[familyId] || null
}

function getCandidates(familyId) {
  var f = BLIND_SPOT_FAMILIES[familyId]
  return f ? f.candidates.slice() : []
}

/**
 * Returns which family a secondary signal supports.
 */
function getFamilyForSignal(signalId) {
  var ids = getAllFamilyIds()
  for (var i = 0; i < ids.length; i++) {
    var f = BLIND_SPOT_FAMILIES[ids[i]]
    if (f.secondarySignals.indexOf(signalId) !== -1) return f.id
  }
  return null
}

/**
 * Returns which family a candidate blind spot belongs to.
 */
function getFamilyForCandidate(candidateId) {
  var ids = getAllFamilyIds()
  for (var i = 0; i < ids.length; i++) {
    var f = BLIND_SPOT_FAMILIES[ids[i]]
    if (f.candidates.indexOf(candidateId) !== -1) return f.id
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  BLIND_SPOT_FAMILIES,
  getAllFamilyIds,
  getFamily,
  getCandidates,
  getFamilyForSignal,
  getFamilyForCandidate,
}
