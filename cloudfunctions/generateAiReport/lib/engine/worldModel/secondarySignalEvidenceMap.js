/**
 * engine/worldModel/secondarySignalEvidenceMap.js
 *
 * RC8.3 C3-001A — Secondary Signal Evidence Contracts (Predicate Migration).
 *
 * Maps each of the 23 Secondary Signals to the specific evidence items
 * required to activate, suppress, or flag uncertainty for that signal.
 *
 * PREDICATE MIGRATION (C3-001A):
 * - All executable rules now use structured { humanRule, predicate } format.
 * - 0 free-text executable rules.
 * - 0 regex-required executable semantics.
 * - Predicate types: AND, OR, NOT, SIGNAL_PRESENT, SIGNAL_ABSENT,
 *   CONFIDENCE_GTE, CONFIDENCE_LTE, EVIDENCE_PRESENT, EVIDENCE_ABSENT,
 *   SOURCE_TYPE_IS, INDEPENDENT_EVIDENCE_COUNT_GTE,
 *   SUPPORT_COUNT_GTE, CONTRADICTION_COUNT_GTE.
 *
 * DESIGN CONSTRAINTS (HARD):
 * - Each signal MUST define all 10 contract fields
 * - 0 occupation semantics, 0 income semantics, 0 business-direction reasoning
 * - 0 direct Blind Spot / Archetype / Strategy determination
 * - Activation: 2 independent supporting OR 1 strong + 1 contextual
 *
 * CONFUSION PAIRS COVERED:
 * 1. DECISION_INERTIA vs FEEDBACK_LOOP_GAP
 * 2. LEVERAGE_MODEL_GAP vs TIME_HORIZON_TRAP
 * 3. RISK_MODEL_DISTORTION vs PROBABILITY_MISJUDGMENT
 * 4. SYSTEM_THINKING_GAP vs FEEDBACK_LOOP_GAP
 * 5. OPPORTUNITY_BLINDNESS vs IDENTITY_CONSTRAINT
 *
 * @version world_model_v3
 * @sprint c3-001a
 */

const {
  and, or, not,
  signalPresent, signalAbsent,
  confidenceGte, confidenceLte,
  evidencePresent, evidenceAbsent,
  sourceTypeIs,
  independentEvidenceCountGte, supportCountGte, contradictionCountGte,
} = require('./predicateSchema')

function ev(sourceType, reference, condition) {
  return Object.freeze({ sourceType, reference, condition })
}


const SECONDARY_SIGNAL_EVIDENCE_MAP = {
  ABSTRACT_VS_EMBODIED_RISK_JUDGMENT: {
    signalId: "ABSTRACT_VS_EMBODIED_RISK_JUDGMENT",

    requiredEvidence: [
      ev("BEHAVIORAL", "ABSTRACT_RISK_JUDGMENT_QUALITY", "quality of risk judgment in abstract (non-personal) scenarios can be assessed"),
      ev("BEHAVIORAL", "EMBODIED_RISK_JUDGMENT_QUALITY", "quality of risk judgment in personally relevant scenarios can be assessed"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "PROBABILISTIC_THINKING", "detected in some but not all contexts — suggests partial framework"),
      ev("BEHAVIORAL", "ABSTRACT_VS_PERSONAL_DIVERGENCE", "a measurable gap exists between risk assessment quality in abstract vs personal scenarios"),
      ev("PRIMARY_SIGNAL", "EXPECTED_VALUE_AWARENESS", "detected — suggests analytical capability exists"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "CONSISTENT_ABSTRACT_ACCURACY_PERSONAL_BIAS", "≥ 2 abstract risk judgments are well-calibrated but ≥ 2 personal risk judgments are systematically biased in the same direction"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "UNIFORMLY_POOR_RISK_JUDGMENT", "risk assessment quality is consistently low in both abstract and personal contexts"),
      ev("BEHAVIORAL", "UNIFORMLY_GOOD_RISK_JUDGMENT", "risk assessment quality is consistently good in both abstract and personal contexts"),
      ev("PRIMARY_SIGNAL", "SAMPLE_SIZE_BLINDNESS", "detected with confidence ≥ 0.8 — and BASE_RATE_NEGLECT detected"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when a measurable gap exists between abstract and personal risk judgment quality",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when apparent gap is a measurement artifact rather than genuine distortion",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("SAMPLE_SIZE_BLINDNESS"),
          confidenceGte("SAMPLE_SIZE_BLINDNESS", 0.8)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when the number of comparable judgments is insufficient",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["RISK_MODEL_DISTORTION","PROBABILITY_MISJUDGMENT"], relationship: "differentiates" },
    ],
  },

  ALTERNATIVE_PATH_COST_AWARENESS: {
    signalId: "ALTERNATIVE_PATH_COST_AWARENESS",

    requiredEvidence: [
      ev("BEHAVIORAL", "SWITCHING_COST_RECOGNITION", "user demonstrates awareness of what is lost when switching directions"),
      ev("PRIMARY_SIGNAL", "LONG_TERM_ORIENTATION", "detected or contextual evidence of value placed on continuity"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "COMPOUNDING_TIME_ALLOCATION", "detected — user recognizes value of sustained investment"),
      ev("BEHAVIORAL", "EXPLICIT_OPPORTUNITY_COST_ANALYSIS", "user has articulated the specific cumulative gains foregone by switching"),
      ev("QUESTIONNAIRE", "decisionStyle", "DATA_DRIVEN — suggests analytical rather than impulsive switching"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "RESISTED_SWITCH_WITH_COST_RATIONALE", "user faced a new direction opportunity and deliberately declined, articulating what cumulative value they would lose by switching"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "SWITCHING_WITHOUT_COST_ACKNOWLEDGMENT", "user switches directions without any acknowledgment of what is being left behind"),
      ev("BEHAVIORAL", "EACH_TIME_DIFFERENT_RATIONALIZATION", "each switch is justified with \"this time is different\" without reference to cumulative cost"),
      ev("PRIMARY_SIGNAL", "SHORT_TERM_PRIORITY", "detected with confidence ≥ 0.8 — cost awareness absent"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when user demonstrates awareness of switching costs and opportunity costs",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when switching cost awareness is shallow or self-serving",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("SHORT_TERM_PRIORITY"),
          confidenceGte("SHORT_TERM_PRIORITY", 0.8)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when switching cost awareness cannot be distinguished from inertia rationalization",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["LEVERAGE_MODEL_GAP","TIME_HORIZON_TRAP"], relationship: "differentiates" },
    ],
  },

  CROSS_DOMAIN_FEEDBACK_THINKING: {
    signalId: "CROSS_DOMAIN_FEEDBACK_THINKING",

    requiredEvidence: [
      ev("BEHAVIORAL", "DOMAIN_A_FEEDBACK_ANALYSIS", "at least one domain where user's feedback-loop thinking can be assessed"),
      ev("BEHAVIORAL", "DOMAIN_B_FEEDBACK_ANALYSIS", "at least one other distinct domain where user's feedback-loop thinking can be assessed"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "POST_ACTION_REVIEW", "detected in some domains but not others"),
      ev("BEHAVIORAL", "CROSS_DOMAIN_THINKING_VARIANCE", "measurable variance in feedback thinking quality across ≥ 2 domains"),
      ev("PRIMARY_SIGNAL", "ACTIVE_FEEDBACK_SEEKING", "detected in one domain but not another"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "DOMAIN_SPECIFIC_FEEDBACK_PRESENCE", "clear evidence of feedback thinking in ≥ 2 distinct domains AND clear evidence of its absence in ≥ 2 other domains"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "UNIFORM_FEEDBACK_ABSENCE", "feedback thinking is absent in ALL assessed domains — pattern is uniform, not domain-specific"),
      ev("BEHAVIORAL", "UNIFORM_FEEDBACK_PRESENCE", "feedback thinking is present in ALL assessed domains — pattern is uniform, not domain-specific"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when feedback thinking quality varies across domains",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when domain variance is attributable to domain characteristics rather than cognitive pattern",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when domain boundaries are ambiguous",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["SYSTEM_THINKING_GAP","FEEDBACK_LOOP_GAP"], relationship: "differentiates" },
    ],
  },

  CROSS_IDENTITY_ATTEMPT_HISTORY: {
    signalId: "CROSS_IDENTITY_ATTEMPT_HISTORY",

    requiredEvidence: [
      ev("BEHAVIORAL", "CROSS_IDENTITY_ATTEMPT_EXISTS", "presence or absence of at least one attempt at something inconsistent with the user's self-definition"),
      ev("BEHAVIORAL", "ATTEMPT_OUTCOME_AND_LEARNING", "whether the attempt produced information or led to behavioral change"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "ADAPTIVE_IDENTITY", "detected — suggests willingness to try"),
      ev("BEHAVIORAL", "ATTEMPT_QUALITY_ANALYSIS", "whether the attempt was genuine exploration or a token gesture"),
      ev("QUESTIONNAIRE", "pastAttemptStage", "value suggests history of experimentation"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "MULTIPLE_CROSS_IDENTITY_ATTEMPTS_WITH_LEARNING", "≥ 2 cross-identity attempts that produced genuine learning — even if user ultimately returned to original path"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "ZERO_CROSS_IDENTITY_ATTEMPTS", "no attempt in the user's history that went against their self-definition — all behavior is identity-consistent"),
      ev("PRIMARY_SIGNAL", "FIXED_ROLE_IDENTITY", "detected with confidence ≥ 0.8"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when the presence or absence of cross-identity attempts can be assessed",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when the absence of cross-identity attempts reflects satisfaction rather than constraint",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("FIXED_ROLE_IDENTITY"),
          confidenceGte("FIXED_ROLE_IDENTITY", 0.8)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when attempt history is ambiguous",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["OPPORTUNITY_BLINDNESS","IDENTITY_CONSTRAINT"], relationship: "differentiates" },
    ],
  },

  DECISION_TO_ACTION_LATENCY: {
    signalId: "DECISION_TO_ACTION_LATENCY",

    requiredEvidence: [
      ev("BEHAVIORAL", "DECISION_ACTION_TIME_GAP_MEASURABLE", "at least one identifiable decision-to-execution gap can be measured in days"),
      ev("PRIMARY_SIGNAL", "DECISION_DELAY", "detected or not-detected with clear confidence"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "LOW_COST_EXPERIMENTATION", "detected — rapid execution suggests low latency"),
      ev("QUESTIONNAIRE", "executionStability", "value indicates behavioral consistency in follow-through"),
      ev("BEHAVIORAL", "MULTIPLE_LOW_LATENCY_CASES", "≥ 2 cases where decision was followed by action within days"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "CONSISTENT_LOW_LATENCY_PATTERN", "≥ 3 cases across different domains showing rapid decision-to-action conversion, with specific timeline data"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "SIGNIFICANT_POST_DECISION_GAP", "even after deciding, execution was delayed by ≥ 1 month"),
      ev("PRIMARY_SIGNAL", "DECISION_DELAY", "detected with confidence ≥ 0.8 — chronic execution gap"),
    ],

    minimumEvidence: 1,

    activationRule: {
    humanRule: "Activate when low decision-to-action latency is observed across contexts",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when latency is attributable to external constraints rather than behavioral pattern",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("DECISION_DELAY"),
          confidenceGte("DECISION_DELAY", 0.8)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when the cause of latency cannot be attributed",
    predicate: and([
        not(supportCountGte(1)),
        not(independentEvidenceCountGte(1))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["DECISION_INERTIA","FEEDBACK_LOOP_GAP"], relationship: "differentiates" },
    ],
  },

  DIRECTION_SWITCHING_FREQUENCY: {
    signalId: "DIRECTION_SWITCHING_FREQUENCY",

    requiredEvidence: [
      ev("BEHAVIORAL", "DIRECTION_SWITCH_COUNT", "number of distinct direction changes in the most recent 12-month period is identifiable"),
      ev("BEHAVIORAL", "SWITCH_MOTIVATION_ANALYSIS", "the stated or inferred reason for each switch can be categorized"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "SHORT_TERM_PRIORITY", "detected — user has short-term orientation"),
      ev("BEHAVIORAL", "IMPATIENCE_DRIVEN_SWITCH", "at least one switch was motivated by impatience with results rather than rational reassessment"),
      ev("QUESTIONNAIRE", "executionStability", "value indicates frequent context switching"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "HIGH_FREQUENCY_IMPATIENCE_SWITCHING", "≥ 3 direction changes in 12 months, and ≥ 2 are attributable to impatience rather than strategic reassessment"),
    ],

    contradictoryEvidence: [
      ev("PRIMARY_SIGNAL", "LONG_TERM_ORIENTATION", "detected with confidence ≥ 0.7"),
      ev("BEHAVIORAL", "SUSTAINED_DIRECTION_WITH_ACCELERATION", "user has maintained a direction for ≥ 1 year with observable compounding or accelerating returns"),
      ev("PRIMARY_SIGNAL", "DECISION_STABILITY", "detected — and direction change count ≤ 1 per year"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when direction-switching frequency and motivation are identifiable",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when switching is rational adaptation rather than time-preference-driven",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("LONG_TERM_ORIENTATION"),
          confidenceGte("LONG_TERM_ORIENTATION", 0.8)
        ]),
        signalPresent("DECISION_STABILITY")
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when the quality of switching motivation cannot be assessed",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["LEVERAGE_MODEL_GAP","TIME_HORIZON_TRAP"], relationship: "differentiates" },
    ],
  },

  EFFORT_VS_MECHANISM_FRAMING: {
    signalId: "EFFORT_VS_MECHANISM_FRAMING",

    requiredEvidence: [
      ev("BEHAVIORAL", "GROWTH_FRAMING_ANALYSIS", "user's description of how to improve/grow can be categorized as mechanism-oriented or effort-oriented"),
      ev("QUESTIONNAIRE", "primaryGoal", "value provides context for growth framing analysis"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "SYSTEM_LEVERAGE", "detected — user identifies systemic amplification paths"),
      ev("PRIMARY_SIGNAL", "DISTRIBUTION_LEVERAGE", "detected — user recognizes distribution as a mechanism"),
      ev("BEHAVIORAL", "MECHANISM_LANGUAGE_PATTERN", "user spontaneously uses mechanism-oriented vocabulary: systems, processes, scale, automation, leverage points"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "CROSS_CONTEXT_MECHANISM_THINKING", "≥ 3 contexts where user defaults to mechanism-based improvement strategies rather than increased personal effort"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "PURE_EFFORT_LANGUAGE", "all improvement descriptions center on \"more time\", \"harder work\", \"more focus\" without mechanism references"),
      ev("PRIMARY_SIGNAL", "LEVERAGE_BLINDNESS", "detected with confidence ≥ 0.8"),
      ev("PRIMARY_SIGNAL", "CAPITAL_DEPENDENCE", "detected — user attributes improvement solely to resource quantity"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when user's default improvement framing can be categorized",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when context-specific effort emphasis is rational rather than a cognitive pattern",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("LEVERAGE_BLINDNESS"),
          confidenceGte("LEVERAGE_BLINDNESS", 0.8)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when framing is context-dependent rather than dispositional",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["LEVERAGE_MODEL_GAP","TIME_HORIZON_TRAP"], relationship: "differentiates" },
    ],
  },

  EMOTIONAL_RECENCY_IMPACT: {
    signalId: "EMOTIONAL_RECENCY_IMPACT",

    requiredEvidence: [
      ev("BEHAVIORAL", "RECENT_HIGH_IMPACT_EVENT", "a recent event with significant emotional impact has occurred (loss, failure, shock)"),
      ev("BEHAVIORAL", "POST_EVENT_RISK_ATTITUDE_SHIFT", "risk attitude has measurably changed following the event"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "LOSS_AVERSION", "detected with confidence ≥ 0.6 — suggests emotional sensitivity to loss"),
      ev("BEHAVIORAL", "DIRECTION_OF_RISK_SHIFT_ANALYZABLE", "the direction of risk attitude change (more cautious or more aggressive) can be assessed against probabilistic expectations"),
      ev("QUESTIONNAIRE", "failureResponse", "value indicates strong emotional reaction to past outcomes"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "RISK_SHIFT_DEVIATES_FROM_EXPECTATION", "the post-event risk attitude systematically deviates from what probability would suggest — avoiding positive-asymmetric paths or embracing negative-asymmetric ones"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "STABLE_RISK_ATTITUDE_DESPITE_EVENTS", "risk attitude is stable across time — recent events do not visibly change decision-making"),
      ev("PRIMARY_SIGNAL", "PROBABILISTIC_THINKING", "detected with confidence ≥ 0.7 — suggests probability-based rather than emotion-based risk"),
      ev("PRIMARY_SIGNAL", "REVERSIBILITY_AWARENESS", "detected — risk decisions reference reversibility rather than emotion"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when a recent emotional event has measurably shifted risk perception",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when risk attitude change is calibrated rather than distorted",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("PROBABILISTIC_THINKING"),
          confidenceGte("PROBABILISTIC_THINKING", 0.7)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when the cause-effect link between event and risk shift is unclear",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["RISK_MODEL_DISTORTION","PROBABILITY_MISJUDGMENT"], relationship: "differentiates" },
    ],
  },

  FEEDBACK_CALIBRATION_RATE: {
    signalId: "FEEDBACK_CALIBRATION_RATE",

    requiredEvidence: [
      ev("BEHAVIORAL", "BELIEF_UPDATE_CASE", "at least one identifiable case where user received new evidence about a prior belief"),
      ev("BEHAVIORAL", "UPDATE_MAGNITUDE_ASSESSABLE", "the magnitude of belief change can be assessed relative to the information content of the new evidence"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "ACTIVE_FEEDBACK_SEEKING", "detected — user proactively seeks calibration data"),
      ev("QUESTIONNAIRE", "failureResponse", "value suggests analytical revision rather than emotional reaction"),
      ev("BEHAVIORAL", "MULTIPLE_UPDATE_CASES", "≥ 2 cases of belief updating available for comparison"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "APPROPRIATE_CALIBRATION_PATTERN", "≥ 2 cases where belief revision magnitude matches evidence informativeness — neither over-reacting nor under-reacting"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "ZERO_UPDATE_PATTERN", "user receives new evidence but does not revise beliefs at all"),
      ev("BEHAVIORAL", "OVERREACTIVE_UPDATE_PATTERN", "user revises beliefs dramatically based on small amounts of weak evidence"),
      ev("PRIMARY_SIGNAL", "ASSUMPTION_WITHOUT_TEST", "detected with confidence ≥ 0.8"),
    ],

    minimumEvidence: 1,

    activationRule: {
    humanRule: "Activate when belief updating behavior can be assessed from specific cases",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when calibration assessment is unreliable due to data insufficiency",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("ASSUMPTION_WITHOUT_TEST"),
          confidenceGte("ASSUMPTION_WITHOUT_TEST", 0.8)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when update magnitude cannot be benchmarked",
    predicate: and([
        not(supportCountGte(1)),
        not(independentEvidenceCountGte(1))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["RISK_MODEL_DISTORTION","PROBABILITY_MISJUDGMENT"], relationship: "differentiates" },
    ],
  },

  FEEDBACK_LOOP_CONCEPT_AWARENESS: {
    signalId: "FEEDBACK_LOOP_CONCEPT_AWARENESS",

    requiredEvidence: [
      ev("BEHAVIORAL", "FEEDBACK_CONCEPT_USAGE", "user's explanation of phenomena can be assessed for feedback loop concepts"),
      ev("BEHAVIORAL", "CAUSAL_CHAIN_COMPLEXITY", "user's causal explanations can be categorized as linear or systemic"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "ACTIVE_FEEDBACK_SEEKING", "detected — suggests awareness of feedback value"),
      ev("PRIMARY_SIGNAL", "POST_ACTION_REVIEW", "detected — suggests systematic reflection"),
      ev("BEHAVIORAL", "SECOND_ORDER_EFFECT_MENTION", "user spontaneously mentions second-order or indirect effects in at least one explanation"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "FEEDBACK_LOOP_EXPLICIT_IDENTIFICATION", "user has explicitly identified a feedback loop (reinforcing or balancing) in ≥ 2 distinct contexts"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "PURE_LINEAR_CAUSATION_ACROSS_CONTEXTS", "all causal explanations are simple A→B→C chains — no interaction, no loops, no second-order effects, across ≥ 3 contexts"),
      ev("PRIMARY_SIGNAL", "WEAK_FEEDBACK_LOOP", "detected with confidence ≥ 0.8 — and no feedback concept in language"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when the presence or absence of feedback loop concepts in causal reasoning is identifiable",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when linear explanation is context-appropriate rather than a cognitive gap",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("WEAK_FEEDBACK_LOOP"),
          confidenceGte("WEAK_FEEDBACK_LOOP", 0.8)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when domain complexity makes causal analysis ambiguous",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["SYSTEM_THINKING_GAP","FEEDBACK_LOOP_GAP"], relationship: "differentiates" },
    ],
  },

  IDENTITY_BASED_EXCLUSION: {
    signalId: "IDENTITY_BASED_EXCLUSION",

    requiredEvidence: [
      ev("BEHAVIORAL", "PATH_EXCLUSION_LANGUAGE_ANALYSIS", "user's language when explaining why they do not pursue certain paths can be analyzed"),
      ev("BEHAVIORAL", "EXCLUSION_RATIONALE_CATEGORIZATION", "exclusion rationales can be categorized as identity-based or information-based"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "FIXED_ROLE_IDENTITY", "detected — suggests identity-based self-definition"),
      ev("PRIMARY_SIGNAL", "SINGLE_PATH_DEPENDENCE", "detected — suggests narrow self-conception"),
      ev("BEHAVIORAL", "IDENTITY_LANGUAGE_MARKERS", "user uses identity-anchored phrases in explanations: \"I'm the kind of person who...\", \"that's not me\", \"I'm not that type\""),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "SYSTEMATIC_IDENTITY_EXCLUSION_PATTERN", "≥ 3 distinct paths excluded using identity-based rationale, with no information-based counter-analysis for any"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "INFORMATION_BASED_EXCLUSION_ONLY", "user excludes paths based on concrete, verifiable information rather than identity labels"),
      ev("PRIMARY_SIGNAL", "EXPANDING_IDENTITY", "detected with confidence ≥ 0.6"),
      ev("PRIMARY_SIGNAL", "ADAPTIVE_IDENTITY", "detected — suggests flexible self-definition"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when path exclusion rationale can be categorized as identity-based or information-based",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when identity-based exclusion mirrors genuine self-knowledge",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("EXPANDING_IDENTITY"),
          confidenceGte("EXPANDING_IDENTITY", 0.6)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when the boundary between self-knowledge and self-constraint is unclear",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["OPPORTUNITY_BLINDNESS","IDENTITY_CONSTRAINT"], relationship: "differentiates" },
    ],
  },

  INFORMATION_SOURCE_DIVERSITY: {
    signalId: "INFORMATION_SOURCE_DIVERSITY",

    requiredEvidence: [
      ev("BEHAVIORAL", "INFORMATION_SOURCE_COUNT", "number of distinct information sources user regularly accesses can be estimated"),
      ev("BEHAVIORAL", "DOMAIN_DIVERSITY_OF_SOURCES", "whether these sources span multiple distinct domains can be assessed"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "LOW_OPPORTUNITY_EXPOSURE", "detected — suggests narrow information intake"),
      ev("PRIMARY_SIGNAL", "NETWORK_LIMITATION", "detected — suggests limited social/information network"),
      ev("PRIMARY_SIGNAL", "OPPORTUNITY_RECOGNITION", "detected — suggests broader exposure"),
      ev("BEHAVIORAL", "CROSS_DOMAIN_CONTACT_PATTERN", "user has meaningful contact with people or ideas from ≥ 3 distinct domains"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "EXTREME_SOURCE_HOMOGENEITY", "all information sources are from a single domain/type — no meaningful cross-domain exposure, confirmed via multiple indicators"),
    ],

    contradictoryEvidence: [
      ev("PRIMARY_SIGNAL", "RESOURCE_RECOMBINATION", "detected with confidence ≥ 0.6 — suggests diverse input"),
      ev("BEHAVIORAL", "DIVERSE_INFORMATION_DIET", "≥ 3 distinct domains of information intake with meaningful depth in each"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when information source breadth and diversity can be assessed",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when information source count is high but content is homogeneous",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("RESOURCE_RECOMBINATION"),
          confidenceGte("RESOURCE_RECOMBINATION", 0.6)
        ]),
        signalPresent("OPPORTUNITY_RECOGNITION")
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when source diversity is unknown or unverifiable",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["OPPORTUNITY_BLINDNESS","IDENTITY_CONSTRAINT"], relationship: "differentiates" },
    ],
  },

  LINEARTY_VS_COMPLEXITY_DEFAULT: {
    signalId: "LINEARTY_VS_COMPLEXITY_DEFAULT",

    requiredEvidence: [
      ev("BEHAVIORAL", "FAILURE_ATTRIBUTION_PATTERN", "how user attributes unexpected negative outcomes can be assessed"),
      ev("BEHAVIORAL", "CAUSAL_FACTOR_COUNT", "number of distinct causal factors user identifies for failures can be counted"),
    ],

    contextualEvidence: [
      ev("BEHAVIORAL", "MULTI_FACTOR_ATTRIBUTION_CASES", "≥ 2 cases where user attributes outcomes to multiple interacting factors"),
      ev("PRIMARY_SIGNAL", "POST_ACTION_REVIEW", "detected — suggests systematic reflection capability"),
      ev("QUESTIONNAIRE", "failureResponse", "value suggests multi-causal rather than single-cause analysis"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "CONSISTENT_MULTI_FACTOR_ATTRIBUTION", "across ≥ 3 failure/outcome analyses, user consistently identifies ≥ 3 interacting causal factors"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "SINGLE_CAUSE_DEFAULT", "across ≥ 3 failure analyses, user consistently identifies only ONE cause — the most recent or most salient action"),
      ev("PRIMARY_SIGNAL", "BINARY_OUTCOME_THINKING", "detected with confidence ≥ 0.7"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when causal attribution pattern reveals linear vs systemic default",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when single-cause attribution is justified by the situation",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("BINARY_OUTCOME_THINKING"),
          confidenceGte("BINARY_OUTCOME_THINKING", 0.8)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when the appropriate level of causal complexity is debatable",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["SYSTEM_THINKING_GAP","FEEDBACK_LOOP_GAP"], relationship: "differentiates" },
    ],
  },

  LONG_TERM_COMPOUNDING_AWARENESS: {
    signalId: "LONG_TERM_COMPOUNDING_AWARENESS",

    requiredEvidence: [
      ev("BEHAVIORAL", "COMPOUNDING_REFERENCE_IN_DECISION", "user referenced long-term cumulative effects in at least one decision narrative"),
      ev("PRIMARY_SIGNAL", "LONG_TERM_ORIENTATION", "detected or contextual evidence of future-oriented thinking"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "COMPOUNDING_TIME_ALLOCATION", "detected — user allocates time to compounding activities"),
      ev("BEHAVIORAL", "PERSONAL_COMPOUNDING_EXPERIENCE", "user has personal experience with something that compounded over time (skill, relationship, knowledge)"),
      ev("QUESTIONNAIRE", "primaryGoal", "value reflects multi-year rather than near-term orientation"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "EXPLICIT_COMPOUNDING_CALCULATION", "user has demonstrated explicit reasoning about how an investment compounds over a multi-year horizon, with a concrete example"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "PURE_SHORT_TERM_EVALUATION", "all decisions are evaluated only on immediate return — no future projection beyond months"),
      ev("PRIMARY_SIGNAL", "SHORT_TERM_PRIORITY", "detected with confidence ≥ 0.8"),
      ev("PRIMARY_SIGNAL", "URGENCY_DOMINANCE", "detected — short-term urgency overrides long-term thinking"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when user demonstrates awareness of long-term compounding effects",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when compounding awareness is theoretical without behavioral follow-through",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("SHORT_TERM_PRIORITY"),
          confidenceGte("SHORT_TERM_PRIORITY", 0.8)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when conceptual awareness and behavioral evidence diverge",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["LEVERAGE_MODEL_GAP","TIME_HORIZON_TRAP"], relationship: "differentiates" },
    ],
  },

  LUCK_VS_SKILL_ATTRIBUTION: {
    signalId: "LUCK_VS_SKILL_ATTRIBUTION",

    requiredEvidence: [
      ev("BEHAVIORAL", "SUCCESS_ATTRIBUTION_PATTERN", "how user attributes past successes can be analyzed for luck/skill decomposition"),
      ev("BEHAVIORAL", "FAILURE_ATTRIBUTION_PATTERN", "how user attributes past failures can be analyzed for luck/skill decomposition"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "PROBABILISTIC_THINKING", "detected — user has framework for uncertainty decomposition"),
      ev("BEHAVIORAL", "BALANCED_ATTRIBUTION_CASES", "at least 2 cases where user attributes both skill and luck to an outcome, with reasonable proportions"),
      ev("QUESTIONNAIRE", "failureResponse", "value suggests analytical rather than self-serving attribution"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "CROSS_OUTCOME_CONSISTENT_ATTRIBUTION", "attribution pattern is consistent across ≥ 3 outcomes: skill/luck split is proportional and not self-serving"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "SELF_SERVING_ATTRIBUTION_BIAS", "systematic pattern: successes attributed to skill, failures attributed to luck — across multiple cases"),
      ev("BEHAVIORAL", "INVERSE_SELF_SERVING_ATTRIBUTION", "systematic pattern: successes attributed to luck, failures attributed to skill deficit"),
      ev("PRIMARY_SIGNAL", "SAMPLE_SIZE_BLINDNESS", "detected — contributing to attribution errors"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when attribution pattern across outcomes can be categorized",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when attribution analysis has insufficient data",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        signalPresent("SAMPLE_SIZE_BLINDNESS")
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when attribution quality cannot be objectively assessed",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["RISK_MODEL_DISTORTION","PROBABILITY_MISJUDGMENT"], relationship: "differentiates" },
    ],
  },

  MINIMUM_STEP_EXECUTION: {
    signalId: "MINIMUM_STEP_EXECUTION",

    requiredEvidence: [
      ev("BEHAVIORAL", "MINIMUM_VIABLE_STEP_TAKEN", "user has taken at least one concrete, scoped action toward resolving a key uncertainty"),
      ev("BEHAVIORAL", "NEW_INFORMATION_GAINED_FROM_STEP", "the step produced observable new information that changed the user's understanding"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "LOW_COST_EXPERIMENTATION", "detected — user's action pattern is experimental"),
      ev("QUESTIONNAIRE", "pastAttemptStage", "value indicates prior execution attempts"),
      ev("BEHAVIORAL", "INTENTIONAL_STEP_NOT_COERCED", "the step was taken voluntarily, not forced by external deadlines or obligations"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "MULTIPLE_MINIMUM_STEPS_ACROSS_CONTEXTS", "≥ 2 distinct minimum steps taken across different decision contexts, each producing new information"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "PURE_MENTAL_SIMULATION_ONLY", "all known options remain in mental simulation — no step entered real-world testing"),
      ev("PRIMARY_SIGNAL", "DECISION_DELAY", "detected with confidence ≥ 0.8 — and no executing step has been taken"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when concrete, scoped action steps have been executed and produced information",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when the step was coerced or produced no new information",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("DECISION_DELAY"),
          confidenceGte("DECISION_DELAY", 0.8)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when the boundary between coerced and voluntary steps is unclear",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["DECISION_INERTIA","FEEDBACK_LOOP_GAP"], relationship: "differentiates" },
    ],
  },

  NON_DOMAIN_PATH_AWARENESS: {
    signalId: "NON_DOMAIN_PATH_AWARENESS",

    requiredEvidence: [
      ev("BEHAVIORAL", "OTHER_PATH_KNOWLEDGE_CHECK", "user's knowledge of how people in other domains achieve their goals can be assessed"),
      ev("BEHAVIORAL", "PATH_VARIETY_COUNT", "number of distinct non-domain paths the user can describe with reasonable accuracy"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "LOW_OPPORTUNITY_EXPOSURE", "detected — suggests limited cross-domain awareness"),
      ev("PRIMARY_SIGNAL", "NETWORK_LIMITATION", "detected — suggests restricted social circles"),
      ev("BEHAVIORAL", "CROSS_DOMAIN_PATH_DESCRIPTION_QUALITY", "user can describe ≥ 2 distinct paths outside their own domain with specific, accurate detail"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "ZERO_NON_DOMAIN_PATH_KNOWLEDGE", "user cannot describe a single path or approach from outside their own domain with any specificity"),
    ],

    contradictoryEvidence: [
      ev("PRIMARY_SIGNAL", "OPPORTUNITY_RECOGNITION", "detected with confidence ≥ 0.7"),
      ev("PRIMARY_SIGNAL", "RESOURCE_RECOMBINATION", "detected — suggests cross-domain synthesis"),
      ev("BEHAVIORAL", "BROAD_PATH_KNOWLEDGE", "user can describe ≥ 3 paths from ≥ 3 distinct domains outside their own"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when user's awareness of non-domain paths can be assessed",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when lack of path knowledge is irrelevant to user's situation",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("OPPORTUNITY_RECOGNITION"),
          confidenceGte("OPPORTUNITY_RECOGNITION", 0.7)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when path knowledge is difficult to assess",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["OPPORTUNITY_BLINDNESS","IDENTITY_CONSTRAINT"], relationship: "differentiates" },
    ],
  },

  OUTPUT_DECOUPLING_AWARENESS: {
    signalId: "OUTPUT_DECOUPLING_AWARENESS",

    requiredEvidence: [
      ev("BEHAVIORAL", "REUSABLE_OUTPUT_CREATED", "user has created at least one output element that can be reused independently of their time input"),
      ev("PRIMARY_SIGNAL", "REPEATABLE_VALUE", "detected or contextual evidence of value decoupling present"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "SYSTEM_LEVERAGE", "detected — user thinks in terms of systems rather than tasks"),
      ev("PRIMARY_SIGNAL", "KNOWLEDGE_LEVERAGE", "detected — user leverages knowledge assets"),
      ev("BEHAVIORAL", "INTENTIONAL_DECOUPLING_ATTEMPT", "user has deliberately tried to create something that works without their ongoing presence"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "MULTIPLE_REUSABLE_ASSETS", "≥ 2 distinct reusable elements created (templates, systems, tools, documented processes) that demonstrably operate without user's direct time input"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "PURE_LINEAR_TIME_VALUE", "all output value is strictly proportional to time invested — no decoupling pattern exists"),
      ev("PRIMARY_SIGNAL", "LEVERAGE_BLINDNESS", "detected with confidence ≥ 0.7"),
      ev("PRIMARY_SIGNAL", "LINEAR_TIME_VALUE", "detected with confidence ≥ 0.7"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when user demonstrates awareness of or attempts at value decoupling",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when reuse is incidental rather than intentional",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("LEVERAGE_BLINDNESS"),
          confidenceGte("LEVERAGE_BLINDNESS", 0.7)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when the boundary between intentional and incidental reuse is unclear",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["LEVERAGE_MODEL_GAP","TIME_HORIZON_TRAP"], relationship: "differentiates" },
    ],
  },

  POST_ACTION_REVIEW_HABIT: {
    signalId: "POST_ACTION_REVIEW_HABIT",

    requiredEvidence: [
      ev("PRIMARY_SIGNAL", "POST_ACTION_REVIEW", "detected with confidence ≥ 0.5"),
      ev("BEHAVIORAL", "SPECIFIC_LEARNING_EXTRACTED", "user can articulate ≥ 2 concrete, actionable lessons from past actions"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "ACTIVE_FEEDBACK_SEEKING", "detected — user proactively gathers external input"),
      ev("QUESTIONNAIRE", "failureResponse", "value indicates analytical post-mortem rather than emotional reaction"),
      ev("BEHAVIORAL", "DOCUMENTED_REFLECTION_PATTERN", "user maintains some form of record (journal, notes, systematic mental checklist) for post-action reflection"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "CROSS_EVENT_CONSISTENT_REVIEW", "review pattern is consistent across ≥ 3 distinct events, not a one-off post-mortem"),
    ],

    contradictoryEvidence: [
      ev("PRIMARY_SIGNAL", "FEEDBACK_AVOIDANCE", "detected — user avoids post-action evaluation"),
      ev("BEHAVIORAL", "VAGUE_POST_HOC_RATIONALIZATION", "user's post-action reflection is limited to generic statements without specific learning"),
      ev("PRIMARY_SIGNAL", "ASSUMPTION_WITHOUT_TEST", "detected with confidence ≥ 0.7"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when systematic post-action review produces specific, actionable learning",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when reflection exists but produces no substantive learning",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("FEEDBACK_AVOIDANCE"),
          confidenceGte("FEEDBACK_AVOIDANCE", 0.6)
        ]),
        signalPresent("ASSUMPTION_WITHOUT_TEST")
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when the depth and consistency of review is ambiguous",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["DECISION_INERTIA","FEEDBACK_LOOP_GAP"], relationship: "differentiates" },
      { pair: ["SYSTEM_THINKING_GAP","FEEDBACK_LOOP_GAP"], relationship: "contextualizes" },
    ],
  },

  PROBABILISTIC_LANGUAGE_USAGE: {
    signalId: "PROBABILISTIC_LANGUAGE_USAGE",

    requiredEvidence: [
      ev("BEHAVIORAL", "LANGUAGE_FRAMING_ANALYSIS", "user's language when discussing uncertain outcomes can be categorized as probabilistic or deterministic"),
      ev("PRIMARY_SIGNAL", "PROBABILISTIC_THINKING", "detected or not-detected — confirms or refutes language pattern"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "BINARY_OUTCOME_THINKING", "not-detected — suggests user avoids deterministic framing"),
      ev("BEHAVIORAL", "PROBABILITY_DISTRIBUTION_LANGUAGE", "user uses language that implies a distribution of possibilities rather than a single outcome"),
      ev("BEHAVIORAL", "GRADED_CONFIDENCE_EXPRESSION", "user expresses graded confidence (very likely, somewhat possible, unlikely) rather than binary certain/uncertain"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "EXPLICIT_MULTI_OUTCOME_REASONING", "≥ 2 instances where user explicitly evaluates multiple possible outcomes with relative likelihoods"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "PURE_DETERMINISTIC_LANGUAGE", "all uncertainty discussions use binary framing: success/failure, can/cannot, will/won't"),
      ev("PRIMARY_SIGNAL", "BINARY_OUTCOME_THINKING", "detected with confidence ≥ 0.8"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when language reveals the presence or absence of probabilistic framing",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when probabilistic language is superficial rather than substantive",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("BINARY_OUTCOME_THINKING"),
          confidenceGte("BINARY_OUTCOME_THINKING", 0.8)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when language pattern is ambiguous or inconsistent",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["RISK_MODEL_DISTORTION","PROBABILITY_MISJUDGMENT"], relationship: "differentiates" },
      { pair: ["SYSTEM_THINKING_GAP","FEEDBACK_LOOP_GAP"], relationship: "contextualizes" },
    ],
  },

  SELF_ASSESSMENT_ASYMMETRY: {
    signalId: "SELF_ASSESSMENT_ASYMMETRY",

    requiredEvidence: [
      ev("BEHAVIORAL", "EXCLUSION_EVIDENCE_STANDARD", "evidence threshold user applies when excluding a path can be assessed"),
      ev("BEHAVIORAL", "CONFIRMATION_EVIDENCE_STANDARD", "evidence threshold user applies when confirming a path can be assessed"),
    ],

    contextualEvidence: [
      ev("BEHAVIORAL", "EVIDENCE_THRESHOLD_ASYMMETRY_DETECTED", "a measurable asymmetry exists between exclusion and confirmation evidence standards"),
      ev("PRIMARY_SIGNAL", "FIXED_ROLE_IDENTITY", "detected — may drive asymmetric assessment"),
      ev("PRIMARY_SIGNAL", "EXPANDING_IDENTITY", "detected — may counteract asymmetry"),
      ev("BEHAVIORAL", "MULTIPLE_DECISION_CASES_FOR_COMPARISON", "≥ 3 decision cases available to compare exclusion and confirmation thresholds"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "CONSISTENT_ASYMMETRY_ACROSS_DECISIONS", "≥ 3 cases showing the same direction of asymmetry: exclusion decisions require very low evidence while confirmation requires very high — or vice versa"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "SYMMETRIC_EVIDENCE_STANDARDS", "evidence standards are consistent across exclusion and confirmation decisions — both require similar levels of evidence"),
      ev("PRIMARY_SIGNAL", "EVIDENCE_BASED_DECISION", "detected with confidence ≥ 0.7"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when evidence standard asymmetry between exclusion and confirmation decisions is measurable",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when asymmetry reflects genuine domain expertise rather than identity filtering",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("EVIDENCE_BASED_DECISION"),
          confidenceGte("EVIDENCE_BASED_DECISION", 0.7)
        ])
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when evidence thresholds cannot be objectively compared",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["OPPORTUNITY_BLINDNESS","IDENTITY_CONSTRAINT"], relationship: "differentiates" },
    ],
  },

  SERENDIPITOUS_PATH_DISCOVERY: {
    signalId: "SERENDIPITOUS_PATH_DISCOVERY",

    requiredEvidence: [
      ev("BEHAVIORAL", "SERENDIPITOUS_DISCOVERY_EVENT", "presence or absence of at least one identifiable instance where unexpected external contact revealed a new path"),
      ev("BEHAVIORAL", "DISCOVERY_SOURCE_ANALYSIS", "whether the discovery source was within or outside the user's existing circle"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "LOW_OPPORTUNITY_EXPOSURE", "detected — suggests limited chance encounters"),
      ev("PRIMARY_SIGNAL", "OPPORTUNITY_RECOGNITION", "detected — suggests history of recognizing paths"),
      ev("BEHAVIORAL", "POST_DISCOVERY_BEHAVIOR", "if a discovery occurred, did user act on it or filter it out?"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "NO_SERENDIPITOUS_DISCOVERY_HISTORY", "confirmed absence of any serendipitous path discovery across the user's entire history — all paths originated from existing circle"),
    ],

    contradictoryEvidence: [
      ev("BEHAVIORAL", "MULTIPLE_SERENDIPITOUS_DISCOVERIES_ACTED_ON", "≥ 2 serendipitous discoveries that the user successfully acted on — suggesting diverse input AND execution"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when the presence or absence of serendipitous path discovery can be assessed",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress when discovery history is too limited to assess",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        signalPresent("OPPORTUNITY_RECOGNITION")
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when serendipity cannot be distinguished from active search",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["OPPORTUNITY_BLINDNESS","IDENTITY_CONSTRAINT"], relationship: "differentiates" },
    ],
  },

  WAITING_DURATION_PATTERN: {
    signalId: "WAITING_DURATION_PATTERN",

    requiredEvidence: [
      ev("PRIMARY_SIGNAL", "DECISION_DELAY", "detected with confidence ≥ 0.6"),
      ev("QUESTIONNAIRE", "pastAttemptStage", "value indicates prolonged deliberation without execution"),
    ],

    contextualEvidence: [
      ev("PRIMARY_SIGNAL", "OPTION_PRESERVING_DECISION", "detected — user preserves optionality rather than committing"),
      ev("QUESTIONNAIRE", "decisionStyle", "SAFETY_FIRST or consistently defers to external input"),
      ev("BEHAVIORAL", "RECOGNIZABLE_DEFERRED_DECISION_TIMELINE", "at least one key decision has been deferred for ≥ 3 months with a traceable timeline"),
    ],

    strongEvidence: [
      ev("BEHAVIORAL", "MULTI_YEAR_DECISION_POSTPONEMENT", "at least one identifiable major decision postponed for ≥ 1 year despite unchanged conditions"),
    ],

    contradictoryEvidence: [
      ev("PRIMARY_SIGNAL", "DECISION_STABILITY", "detected with confidence ≥ 0.7 — decisions are made and executed promptly"),
      ev("PRIMARY_SIGNAL", "LOW_COST_EXPERIMENTATION", "detected — user runs small experiments rather than waiting"),
      ev("BEHAVIORAL", "ACTIVE_DECISION_PROGRESSION", "all identifiable decisions are in active progression, none long-deferred"),
    ],

    minimumEvidence: 2,

    activationRule: {
    humanRule: "Activate when identifiable deferred decisions exist with clear temporal boundaries",
    predicate: and([
        and([
          independentEvidenceCountGte(2),
          supportCountGte(2)
        ]),
        and([
          supportCountGte(1),
          supportCountGte(2),
          independentEvidenceCountGte(2)
        ])
      ])
  },

    suppressionRule: {
    humanRule: "Suppress this signal when decisions are progressing actively",
    predicate: or([
        and([
          contradictionCountGte(2),
          independentEvidenceCountGte(2)
        ]),
        and([
          signalPresent("DECISION_STABILITY"),
          confidenceGte("DECISION_STABILITY", 0.8)
        ]),
        signalPresent("LOW_COST_EXPERIMENTATION")
      ])
  },

    uncertaintyRule: {
    humanRule: "Flag uncertainty when deferral duration is ambiguous or motivation unclear",
    predicate: and([
        not(supportCountGte(2)),
        not(independentEvidenceCountGte(2))
      ])
  },

    relatedBoundaryPairs: [
      { pair: ["DECISION_INERTIA","FEEDBACK_LOOP_GAP"], relationship: "differentiates" },
    ],
  },
}

function validateEvidenceContract(signalKey) {
  var contract = SECONDARY_SIGNAL_EVIDENCE_MAP[signalKey]
  if (!contract) return { valid: false, error: 'NOT_FOUND', signal: signalKey }
  var required = ['signalId','requiredEvidence','contextualEvidence','strongEvidence','contradictoryEvidence','minimumEvidence','activationRule','suppressionRule','uncertaintyRule','relatedBoundaryPairs']
  var missing = required.filter(function(f) { return !contract[f] || contract[f] === undefined })
  if (missing.length > 0) return { valid: false, error: 'MISSING_FIELDS', signal: signalKey, missing: missing }
  if (!contract.activationRule || !contract.activationRule.predicate) return { valid: false, error: 'MISSING_ACTIVATION_PREDICATE', signal: signalKey }
  if (!contract.suppressionRule || !contract.suppressionRule.predicate) return { valid: false, error: 'MISSING_SUPPRESSION_PREDICATE', signal: signalKey }
  if (!contract.uncertaintyRule || !contract.uncertaintyRule.predicate) return { valid: false, error: 'MISSING_UNCERTAINTY_PREDICATE', signal: signalKey }
  return { valid: true, signal: signalKey }
}

function getAllEvidenceContractIds() { return Object.keys(SECONDARY_SIGNAL_EVIDENCE_MAP) }
function getEvidenceContract(signalId) { return SECONDARY_SIGNAL_EVIDENCE_MAP[signalId] || null }

function validateAllEvidenceContracts() {
  var ids = getAllEvidenceContractIds()
  var results = ids.map(function(id) { return validateEvidenceContract(id) })
  var valid = results.filter(function(r) { return r.valid })
  var invalid = results.filter(function(r) { return !r.valid })
  return { total: ids.length, passed: valid.length, failed: invalid.length, allValid: invalid.length === 0 }
}

function countContractsWithContradiction() {
  return getAllEvidenceContractIds().filter(function(id) {
    var c = SECONDARY_SIGNAL_EVIDENCE_MAP[id]
    return c.contradictoryEvidence && c.contradictoryEvidence.length > 0
  }).length
}

function countContractsWithSuppression() {
  return getAllEvidenceContractIds().filter(function(id) {
    var c = SECONDARY_SIGNAL_EVIDENCE_MAP[id]
    return c.suppressionRule && c.suppressionRule.predicate
  }).length
}

function countContractsWithUncertainty() {
  return getAllEvidenceContractIds().filter(function(id) {
    var c = SECONDARY_SIGNAL_EVIDENCE_MAP[id]
    return c.uncertaintyRule && c.uncertaintyRule.predicate
  }).length
}

function getAllCoveredBoundaryPairs() {
  var ids = getAllEvidenceContractIds()
  var set = new (require('util').types ? Set : Set)()
  ids.forEach(function(id) {
    var c = SECONDARY_SIGNAL_EVIDENCE_MAP[id]
    c.relatedBoundaryPairs.forEach(function(bp) {
      set.add(bp.pair.slice().sort().join('_vs_'))
    })
  })
  return Array.from(set).map(function(k) {
    var p = k.split('_vs_')
    return { pair: [p[0], p[1]] }
  })
}

module.exports = {
  SECONDARY_SIGNAL_EVIDENCE_MAP,
  validateEvidenceContract,
  getAllEvidenceContractIds,
  getEvidenceContract,
  validateAllEvidenceContracts,
  countContractsWithContradiction,
  countContractsWithSuppression,
  countContractsWithUncertainty,
  getAllCoveredBoundaryPairs,
}
