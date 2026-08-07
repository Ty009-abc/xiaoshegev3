/**
 * engine/worldModel/blindSpotFamilyDefinitions.js
 *
 * RC8.3 C3-002A R1 — Blind Spot Family Definitions (Lineage Corrected).
 *
 * FAMILY MEMBERSHIP: Derived from C1 blindSpotBoundaryDefinitions.js
 * (BLIND_SPOT_FAMILIES). C3 does NOT redefine which Blind Spots belong
 * to which family. C1 is the authoritative source.
 *
 * C3 ADDS inference metadata on top of C1:
 *   - secondary signal mappings
 *   - signal weights
 *   - display labels
 *   - relevant dimensions
 *
 * FAMILIES (C1 IDs → C3 display labels):
 *   1. EXECUTION_ADAPTATION_GAP  → 执行/适应
 *   2. RESOURCE_COMPOUNDING_GAP  → 资源/复利
 *   3. PERCEPTION_RISK_GAP       → 感知/风险
 *   4. FRAMEWORK_GAP             → 认知框架
 *
 * DESIGN CONSTRAINTS (HARD):
 * - C1 BLIND_SPOT_FAMILIES is the ONLY source of candidate membership
 * - No duplicate family taxonomy
 * - No direct Blind Spot, Archetype, or Strategy determination
 * - No occupation, income, or business reasoning
 *
 * @version world_model_v3
 * @sprint c3-002a-r1
 */

// ═══════════════════════════════════════════════════════════════
// C1 ARCHITECTURE — SOURCE OF TRUTH
// ═══════════════════════════════════════════════════════════════

var C1 = require('./blindSpotBoundaryDefinitions')
var C1_FAMILIES = C1.BLIND_SPOT_FAMILIES

// ═══════════════════════════════════════════════════════════════
// C1→C3 IDENTITY MAPPING
// ═══════════════════════════════════════════════════════════════

/**
 * C3 uses the C1 family ID as the canonical identifier.
 * Display labels are metadata, not alternate IDs.
 *
 * Architecture ID (canonical, from C1) → Display label (C3)
 */
var FAMILY_DISPLAY_IDS = Object.freeze({
  EXECUTION_ADAPTATION_GAP: 'DECISION_ADAPTATION',
  RESOURCE_COMPOUNDING_GAP: 'RESOURCE_COMPOUNDING',
  PERCEPTION_RISK_GAP: 'UNCERTAINTY_JUDGMENT',
  FRAMEWORK_GAP: 'MODEL_BOUNDARY',
})

/**
 * Human-readable labels for each C1 family.
 */
var FAMILY_LABELS = Object.freeze({
  EXECUTION_ADAPTATION_GAP: '执行/适应',
  RESOURCE_COMPOUNDING_GAP: '资源/复利',
  PERCEPTION_RISK_GAP: '感知/风险',
  FRAMEWORK_GAP: '认知框架',
})

/**
 * Derived descriptions from C1 + C3 intent.
 */
var FAMILY_DESCRIPTIONS = Object.freeze({
  EXECUTION_ADAPTATION_GAP: '行动与学习之间的落差：是"不行动所以没有信息"还是"行动了但没有学习"？',
  RESOURCE_COMPOUNDING_GAP: '价值放大与时间尺度之间的失衡：是"不会放大"还是"不愿等待"？',
  PERCEPTION_RISK_GAP: '在"看到什么"和"如何评估"上的缺陷：是"看不到路径"还是"看到了但被风险恐惧过滤"？',
  FRAMEWORK_GAP: '思维工具层面的缺陷：是缺少概率框架、身份过窄、还是只能用线性因果理解复杂系统？',
})

// ═══════════════════════════════════════════════════════════════
// C3 INFERENCE METADATA (on top of C1 membership)
// ═══════════════════════════════════════════════════════════════

/**
 * Secondary signals mapped to each C1 family.
 * Keyed by C1 family ID (architecture authority).
 */
var FAMILY_SIGNAL_MAP = Object.freeze({

  EXECUTION_ADAPTATION_GAP: [
    'WAITING_DURATION_PATTERN',      // supports DECISION_INERTIA
    'MINIMUM_STEP_EXECUTION',        // supports FEEDBACK_LOOP_GAP
    'POST_ACTION_REVIEW_HABIT',      // supports FEEDBACK_LOOP_GAP
    'DECISION_TO_ACTION_LATENCY',    // supports FEEDBACK_LOOP_GAP
  ],

  RESOURCE_COMPOUNDING_GAP: [
    'OUTPUT_DECOUPLING_AWARENESS',       // supports LEVERAGE_MODEL_GAP
    'EFFORT_VS_MECHANISM_FRAMING',       // supports LEVERAGE_MODEL_GAP
    'DIRECTION_SWITCHING_FREQUENCY',     // supports TIME_HORIZON_TRAP
    'LONG_TERM_COMPOUNDING_AWARENESS',   // supports TIME_HORIZON_TRAP
    'ALTERNATIVE_PATH_COST_AWARENESS',   // supports TIME_HORIZON_TRAP
  ],

  PERCEPTION_RISK_GAP: [
    'INFORMATION_SOURCE_DIVERSITY',       // supports OPPORTUNITY_BLINDNESS
    'SERENDIPITOUS_PATH_DISCOVERY',       // supports OPPORTUNITY_BLINDNESS
    'NON_DOMAIN_PATH_AWARENESS',          // supports OPPORTUNITY_BLINDNESS
    'EMOTIONAL_RECENCY_IMPACT',           // supports RISK_MODEL_DISTORTION
    'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', // supports RISK_MODEL_DISTORTION
  ],

  FRAMEWORK_GAP: [
    'PROBABILISTIC_LANGUAGE_USAGE',       // supports PROBABILITY_MISJUDGMENT
    'LUCK_VS_SKILL_ATTRIBUTION',          // supports PROBABILITY_MISJUDGMENT
    'FEEDBACK_CALIBRATION_RATE',          // supports PROBABILITY_MISJUDGMENT
    'IDENTITY_BASED_EXCLUSION',           // supports IDENTITY_CONSTRAINT
    'CROSS_IDENTITY_ATTEMPT_HISTORY',     // supports IDENTITY_CONSTRAINT
    'SELF_ASSESSMENT_ASYMMETRY',          // supports IDENTITY_CONSTRAINT
    'FEEDBACK_LOOP_CONCEPT_AWARENESS',    // supports SYSTEM_THINKING_GAP
    'CROSS_DOMAIN_FEEDBACK_THINKING',     // supports SYSTEM_THINKING_GAP
    'LINEARTY_VS_COMPLEXITY_DEFAULT',     // supports SYSTEM_THINKING_GAP
  ],
})

var FAMILY_SIGNAL_WEIGHTS = Object.freeze({

  EXECUTION_ADAPTATION_GAP: {
    WAITING_DURATION_PATTERN: 0.4,
    MINIMUM_STEP_EXECUTION: 0.3,
    POST_ACTION_REVIEW_HABIT: 0.2,
    DECISION_TO_ACTION_LATENCY: 0.1,
  },

  RESOURCE_COMPOUNDING_GAP: {
    OUTPUT_DECOUPLING_AWARENESS: 0.25,
    EFFORT_VS_MECHANISM_FRAMING: 0.2,
    DIRECTION_SWITCHING_FREQUENCY: 0.25,
    LONG_TERM_COMPOUNDING_AWARENESS: 0.15,
    ALTERNATIVE_PATH_COST_AWARENESS: 0.15,
  },

  PERCEPTION_RISK_GAP: {
    INFORMATION_SOURCE_DIVERSITY: 0.2,
    SERENDIPITOUS_PATH_DISCOVERY: 0.15,
    NON_DOMAIN_PATH_AWARENESS: 0.15,
    EMOTIONAL_RECENCY_IMPACT: 0.25,
    ABSTRACT_VS_EMBODIED_RISK_JUDGMENT: 0.25,
  },

  FRAMEWORK_GAP: {
    PROBABILISTIC_LANGUAGE_USAGE: 0.15,
    LUCK_VS_SKILL_ATTRIBUTION: 0.15,
    FEEDBACK_CALIBRATION_RATE: 0.1,
    IDENTITY_BASED_EXCLUSION: 0.15,
    CROSS_IDENTITY_ATTEMPT_HISTORY: 0.1,
    SELF_ASSESSMENT_ASYMMETRY: 0.1,
    FEEDBACK_LOOP_CONCEPT_AWARENESS: 0.1,
    CROSS_DOMAIN_FEEDBACK_THINKING: 0.05,
    LINEARTY_VS_COMPLEXITY_DEFAULT: 0.1,
  },
})

var FAMILY_RELEVANT_DIMENSIONS = Object.freeze({
  EXECUTION_ADAPTATION_GAP: ['DECISION_MODEL', 'FEEDBACK_MODEL'],
  RESOURCE_COMPOUNDING_GAP: ['LEVERAGE_MODEL', 'TIME_MODEL'],
  PERCEPTION_RISK_GAP: ['OPPORTUNITY_MODEL', 'RISK_MODEL'],
  FRAMEWORK_GAP: ['PROBABILITY_MODEL', 'IDENTITY_MODEL'],
})

var FAMILY_MINIMUM_SIGNALS = Object.freeze({
  EXECUTION_ADAPTATION_GAP: 1,
  RESOURCE_COMPOUNDING_GAP: 1,
  PERCEPTION_RISK_GAP: 1,
  FRAMEWORK_GAP: 1,
})

// ═══════════════════════════════════════════════════════════════
// DERIVED FAMILY OBJECT
// ═══════════════════════════════════════════════════════════════

/**
 * Builds the runtime BLIND_SPOT_FAMILIES object by combining:
 *   - C1 BLIND_SPOT_FAMILIES (authoritative membership)
 *   - C3 inference metadata (signals, weights, display labels)
 *
 * Keyed by ARCHITECTURE family ID (C1).
 */
function buildFamilyMap() {
  var map = {}
  var c1Ids = Object.keys(C1_FAMILIES)

  for (var i = 0; i < c1Ids.length; i++) {
    var c1Id = c1Ids[i]
    var c1Family = C1_FAMILIES[c1Id]

    map[c1Id] = Object.freeze({
      // Architecture identity
      id: c1Id,
      displayId: FAMILY_DISPLAY_IDS[c1Id] || c1Id,
      label: FAMILY_LABELS[c1Id] || c1Id,
      description: FAMILY_DESCRIPTIONS[c1Id] || c1Family.description || '',

      // C1 authority: candidate membership
      candidates: (c1Family.members || []).slice(),
      c1Description: c1Family.description || '',
      distinguishingQuestion: c1Family.distinguishingQuestion || '',

      // C3 inference metadata
      secondarySignals: (FAMILY_SIGNAL_MAP[c1Id] || []).slice(),
      signalWeights: Object.freeze(Object.assign({}, FAMILY_SIGNAL_WEIGHTS[c1Id] || {})),
      relevantDimensions: (FAMILY_RELEVANT_DIMENSIONS[c1Id] || []).slice(),
      minimumSignals: FAMILY_MINIMUM_SIGNALS[c1Id] || 1,
    })
  }

  return Object.freeze(map)
}

var BLIND_SPOT_FAMILIES = buildFamilyMap()

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

function getDisplayId(familyId) {
  var f = BLIND_SPOT_FAMILIES[familyId]
  return f ? f.displayId : null
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
 * Derived from C1 BLIND_SPOT_FAMILIES.members.
 */
function getFamilyForCandidate(candidateId) {
  var ids = getAllFamilyIds()
  for (var i = 0; i < ids.length; i++) {
    var f = BLIND_SPOT_FAMILIES[ids[i]]
    if (f.candidates.indexOf(candidateId) !== -1) return f.id
  }
  return null
}

/**
 * Verifies C3 family membership matches C1 source of truth.
 * @returns {{ pass: boolean, mismatches: Array }}
 */
function verifyLineageIdentity() {
  var mismatches = []
  var c1Ids = Object.keys(C1_FAMILIES)

  for (var i = 0; i < c1Ids.length; i++) {
    var c1Id = c1Ids[i]
    var c1Members = (C1_FAMILIES[c1Id].members || []).slice().sort().join(',')
    var c3Family = BLIND_SPOT_FAMILIES[c1Id]
    if (!c3Family) {
      mismatches.push('C3 missing family: ' + c1Id)
      continue
    }
    var c3Members = c3Family.candidates.slice().sort().join(',')
    if (c1Members !== c3Members) {
      mismatches.push(c1Id + ': C1=[' + c1Members + '] vs C3=[' + c3Members + ']')
    }
  }

  return {
    pass: mismatches.length === 0,
    mismatches: mismatches,
  }
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
  getDisplayId,
  verifyLineageIdentity,
}
