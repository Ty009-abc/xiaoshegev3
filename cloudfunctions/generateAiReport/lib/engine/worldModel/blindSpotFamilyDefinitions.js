/**
 * engine/worldModel/blindSpotFamilyDefinitions.js
 *
 * RC8.3 C3-002A R2 — Blind Spot Family Definitions (Score-Normalized).
 *
 * FAMILY MEMBERSHIP: Derived from C1 blindSpotBoundaryDefinitions.js
 * (BLIND_SPOT_FAMILIES). C3 does NOT redefine which Blind Spots belong
 * to which family. C1 is the authoritative source.
 *
 * R2 SCORING ARCHITECTURE:
 *   Family score = evidence mean, NOT weight-budget sum.
 *
 *   OLD (R1): familyScore = Σ(signal_weight × signal_score/100), Σweights=1.0
 *     → More signals → smaller per-signal contribution → family-size bias
 *
 *   NEW (R2): familyScore = mean(active_contributions) with suppression penalty
 *     → Score = (Σ active_evidence / evidence_opportunities) - suppression_penalty
 *     → Invariant to family size. Same evidence → same score.
 *
 * WEIGHTS IN R2:
 *   Signal weights represent evidence fidelity (how diagnostic the signal is),
 *   NOT a per-family budget distribution. Weights are normalized to [0,1] where
 *   1.0 = maximally diagnostic within its family.
 *
 * DESIGN CONSTRAINTS (HARD):
 * - C1 BLIND_SPOT_FAMILIES is the ONLY source of candidate membership
 * - No duplicate family taxonomy
 * - No family-specific boost factors, hidden offsets, or cap tuning
 * - No occupation, income, or business reasoning
 * - Score must be comparable across families
 *
 * @version world_model_v3
 * @sprint c3-002a-r2
 */

var C1 = require('./blindSpotBoundaryDefinitions')
var C1_FAMILIES = C1.BLIND_SPOT_FAMILIES

// ═══════════════════════════════════════════════════════════════
// C1→C3 IDENTITY MAPPING
// ═══════════════════════════════════════════════════════════════

var FAMILY_DISPLAY_IDS = Object.freeze({
  EXECUTION_ADAPTATION_GAP: 'DECISION_ADAPTATION',
  RESOURCE_COMPOUNDING_GAP: 'RESOURCE_COMPOUNDING',
  PERCEPTION_RISK_GAP: 'UNCERTAINTY_JUDGMENT',
  FRAMEWORK_GAP: 'MODEL_BOUNDARY',
})

var FAMILY_LABELS = Object.freeze({
  EXECUTION_ADAPTATION_GAP: '执行/适应',
  RESOURCE_COMPOUNDING_GAP: '资源/复利',
  PERCEPTION_RISK_GAP: '感知/风险',
  FRAMEWORK_GAP: '认知框架',
})

var FAMILY_DESCRIPTIONS = Object.freeze({
  EXECUTION_ADAPTATION_GAP: '行动与学习之间的落差：是"不行动所以没有信息"还是"行动了但没有学习"？',
  RESOURCE_COMPOUNDING_GAP: '价值放大与时间尺度之间的失衡：是"不会放大"还是"不愿等待"？',
  PERCEPTION_RISK_GAP: '在"看到什么"和"如何评估"上的缺陷：是"看不到路径"还是"看到了但被风险恐惧过滤"？',
  FRAMEWORK_GAP: '思维工具层面的缺陷：是缺少概率框架、身份过窄、还是只能用线性因果理解复杂系统？',
})

// ═══════════════════════════════════════════════════════════════
// SIGNAL WEIGHTS (R2: evidence fidelity, not budget)
// ═══════════════════════════════════════════════════════════════

/**
 * Signal weights now represent EVIDENCE FIDELITY:
 *   1.0 = maximally diagnostic for its family
 *   0.1 = weakly diagnostic
 *
 * Weights are normalized within [0,1] per signal.
 * A signal with weight 1.0 in EA and a signal with weight 1.0 in FG
 * have the same contribution in their respective families —
 * unlike R1 where EA weight=0.40 vs FG weight=0.15 within budget.
 *
 * Within a family, stronger signals have higher fidelity weights.
 * Across families, all signals at weight 1.0 contribute equally.
 */
var FAMILY_SIGNAL_DEFINITIONS = Object.freeze({

  EXECUTION_ADAPTATION_GAP: {
    signals: [
      'WAITING_DURATION_PATTERN',      // supports DECISION_INERTIA
      'MINIMUM_STEP_EXECUTION',        // supports FEEDBACK_LOOP_GAP
      'POST_ACTION_REVIEW_HABIT',      // supports FEEDBACK_LOOP_GAP
      'DECISION_TO_ACTION_LATENCY',    // supports FEEDBACK_LOOP_GAP
    ],
    fidelity: {
      WAITING_DURATION_PATTERN: 1.0,
      MINIMUM_STEP_EXECUTION: 0.75,
      POST_ACTION_REVIEW_HABIT: 0.5,
      DECISION_TO_ACTION_LATENCY: 0.25,
    },
    minimumSignals: 1,
  },

  RESOURCE_COMPOUNDING_GAP: {
    signals: [
      'OUTPUT_DECOUPLING_AWARENESS',
      'EFFORT_VS_MECHANISM_FRAMING',
      'DIRECTION_SWITCHING_FREQUENCY',
      'LONG_TERM_COMPOUNDING_AWARENESS',
      'ALTERNATIVE_PATH_COST_AWARENESS',
    ],
    fidelity: {
      OUTPUT_DECOUPLING_AWARENESS: 1.0,
      EFFORT_VS_MECHANISM_FRAMING: 0.8,
      DIRECTION_SWITCHING_FREQUENCY: 1.0,
      LONG_TERM_COMPOUNDING_AWARENESS: 0.6,
      ALTERNATIVE_PATH_COST_AWARENESS: 0.6,
    },
    minimumSignals: 1,
  },

  PERCEPTION_RISK_GAP: {
    signals: [
      'INFORMATION_SOURCE_DIVERSITY',
      'SERENDIPITOUS_PATH_DISCOVERY',
      'NON_DOMAIN_PATH_AWARENESS',
      'EMOTIONAL_RECENCY_IMPACT',
      'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT',
    ],
    fidelity: {
      INFORMATION_SOURCE_DIVERSITY: 0.8,
      SERENDIPITOUS_PATH_DISCOVERY: 0.6,
      NON_DOMAIN_PATH_AWARENESS: 0.6,
      EMOTIONAL_RECENCY_IMPACT: 1.0,
      ABSTRACT_VS_EMBODIED_RISK_JUDGMENT: 1.0,
    },
    minimumSignals: 1,
  },

  FRAMEWORK_GAP: {
    signals: [
      'PROBABILISTIC_LANGUAGE_USAGE',
      'LUCK_VS_SKILL_ATTRIBUTION',
      'FEEDBACK_CALIBRATION_RATE',
      'IDENTITY_BASED_EXCLUSION',
      'CROSS_IDENTITY_ATTEMPT_HISTORY',
      'SELF_ASSESSMENT_ASYMMETRY',
      'FEEDBACK_LOOP_CONCEPT_AWARENESS',
      'CROSS_DOMAIN_FEEDBACK_THINKING',
      'LINEARTY_VS_COMPLEXITY_DEFAULT',
    ],
    fidelity: {
      PROBABILISTIC_LANGUAGE_USAGE: 1.0,
      LUCK_VS_SKILL_ATTRIBUTION: 1.0,
      FEEDBACK_CALIBRATION_RATE: 0.6,
      IDENTITY_BASED_EXCLUSION: 1.0,
      CROSS_IDENTITY_ATTEMPT_HISTORY: 0.6,
      SELF_ASSESSMENT_ASYMMETRY: 0.6,
      FEEDBACK_LOOP_CONCEPT_AWARENESS: 0.6,
      CROSS_DOMAIN_FEEDBACK_THINKING: 0.4,
      LINEARTY_VS_COMPLEXITY_DEFAULT: 0.6,
    },
    minimumSignals: 1,
  },
})

// ═══════════════════════════════════════════════════════════════
// BUILD FAMILY MAP
// ═══════════════════════════════════════════════════════════════

function buildFamilyMap() {
  var map = {}
  var c1Ids = Object.keys(C1_FAMILIES)

  c1Ids.forEach(function (c1Id) {
    var c1Family = C1_FAMILIES[c1Id]
    var c3SigDef = FAMILY_SIGNAL_DEFINITIONS[c1Id] || { signals: [], fidelity: {} }

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
      secondarySignals: c3SigDef.signals.slice(),
      signalFidelity: Object.freeze(Object.assign({}, c3SigDef.fidelity)),
      minimumSignals: c3SigDef.minimumSignals || 1,
    })
  })

  return Object.freeze(map)
}

var BLIND_SPOT_FAMILIES = buildFamilyMap()

// ═══════════════════════════════════════════════════════════════
// SCORING CONSTANTS (R2: family-size-invariant)
// ═══════════════════════════════════════════════════════════════

/**
 * SUPPRESSION_PENALTY_BASE:
 *   Maximum penalty a suppressed signal can cause.
 *   Scaled by fidelity weight. Same across families.
 *
 *   0.5 = a suppressed signal at fidelity 1.0 cancels half an active signal.
 */
var SUPPRESSION_PENALTY_BASE = 0.5

/**
 * Evidence provenance: shared evidence origin IDs.
 * When multiple signals derive from the same underlying evidence event,
 * their contributions are capped to prevent double-counting.
 *
 * Currently: all signals are independent provenance.
 * Signal conflicts use the existing secondarySignalDefinitions.differentiates.
 */
var EVIDENCE_ORIGINS = Object.freeze({
  // Each secondary signal is its own origin (no shared provenance yet)
  // Add origins here if multiple signals share evidence source
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

function getDisplayId(familyId) {
  var f = BLIND_SPOT_FAMILIES[familyId]
  return f ? f.displayId : null
}

function getFamilyForSignal(signalId) {
  var ids = getAllFamilyIds()
  for (var i = 0; i < ids.length; i++) {
    var f = BLIND_SPOT_FAMILIES[ids[i]]
    if (f.secondarySignals.indexOf(signalId) !== -1) return f.id
  }
  return null
}

function getFamilyForCandidate(candidateId) {
  var ids = getAllFamilyIds()
  for (var i = 0; i < ids.length; i++) {
    var f = BLIND_SPOT_FAMILIES[ids[i]]
    if (f.candidates.indexOf(candidateId) !== -1) return f.id
  }
  return null
}

function verifyLineageIdentity() {
  var mismatches = []
  var c1Ids = Object.keys(C1_FAMILIES)

  c1Ids.forEach(function (c1Id) {
    var c1Members = (C1_FAMILIES[c1Id].members || []).slice().sort().join(',')
    var c3Family = BLIND_SPOT_FAMILIES[c1Id]
    if (!c3Family) {
      mismatches.push('C3 missing family: ' + c1Id)
      return
    }
    var c3Members = c3Family.candidates.slice().sort().join(',')
    if (c1Members !== c3Members) {
      mismatches.push(c1Id + ': C1=[' + c1Members + '] vs C3=[' + c3Members + ']')
    }
  })

  return { pass: mismatches.length === 0, mismatches: mismatches }
}

module.exports = {
  BLIND_SPOT_FAMILIES,
  C1_FAMILIES,
  FAMILY_SIGNAL_DEFINITIONS,
  SUPPRESSION_PENALTY_BASE,
  EVIDENCE_ORIGINS,
  getAllFamilyIds,
  getFamily,
  getCandidates,
  getFamilyForSignal,
  getFamilyForCandidate,
  getDisplayId,
  verifyLineageIdentity,
}
