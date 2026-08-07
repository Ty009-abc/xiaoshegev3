/**
 * engine/worldModel/secondarySignalEvidenceMap.js
 *
 * RC8.3 C2-002A — Secondary Signal Evidence Contracts.
 *
 * Maps each of the 23 Secondary Signals to the specific evidence items
 * required to activate, suppress, or flag uncertainty for that signal.
 *
 * DESIGN CONSTRAINTS (HARD):
 * - Each signal MUST define all 10 contract fields
 * - Evidence items reference ONLY: Primary Signal IDs, structured questionnaire fields, normalized behavioral patterns
 * - NO occupation semantics
 * - NO income semantics
 * - NO business-direction reasoning
 * - NO direct Blind Spot determination
 * - NO direct Archetype determination
 * - NO direct Strategy determination
 * - Activation: 2 independent supporting OR 1 strong + 1 contextual
 * - Free text supports confidence only — NEVER independently creates strong cognitive conclusion
 *
 * CONFUSION PAIRS COVERED:
 * 1. DECISION_INERTIA vs FEEDBACK_LOOP_GAP
 * 2. LEVERAGE_MODEL_GAP vs TIME_HORIZON_TRAP
 * 3. RISK_MODEL_DISTORTION vs PROBABILITY_MISJUDGMENT
 * 4. SYSTEM_THINKING_GAP vs FEEDBACK_LOOP_GAP
 * 5. OPPORTUNITY_BLINDNESS vs IDENTITY_CONSTRAINT
 *
 * @version world_model_v2
 * @sprint c2-002a
 */

// ═══════════════════════════════════════════════════════════════
// EVIDENCE REFERENCE TAXONOMY
// ═══════════════════════════════════════════════════════════════
//
// All evidence items below reference one of three source types:
//
//   1. PRIMARY_SIGNAL:<id>
//      Any signal from signalDefinitions.js (e.g. DECISION_DELAY, POST_ACTION_REVIEW)
//
//   2. QUESTIONNAIRE:<field>
//      Any structured questionnaire answer field from evidenceNormalizer.js
//      (e.g. decisionStyle, failureResponse, pastAttemptStage, executionStability)
//
//   3. BEHAVIORAL:<pattern>
//      Normalized behavioral evidence extracted from answer patterns
//      (e.g. REPEATED_DECISION_POSTPONEMENT, CROSS_CONTEXT_PATTERN_CONSISTENCY)

// ═══════════════════════════════════════════════════════════════
// HELPER: Evidence item factory
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a structured evidence reference.
 * @param {'PRIMARY_SIGNAL'|'QUESTIONNAIRE'|'BEHAVIORAL'} sourceType
 * @param {string} reference — the signal ID, questionnaire field name, or behavioral pattern
 * @param {string} condition — under what condition this evidence item is met
 * @returns {Object}
 */
function ev(sourceType, reference, condition) {
  return Object.freeze({ sourceType, reference, condition })
}

// ═══════════════════════════════════════════════════════════════
// SECONDARY SIGNAL EVIDENCE CONTRACTS (23/23)
// ═══════════════════════════════════════════════════════════════

const SECONDARY_SIGNAL_EVIDENCE_MAP = Object.freeze({

  // ─────────────────────────────────────────────────────────────
  // PAIR 1: DECISION_INERTIA vs FEEDBACK_LOOP_GAP
  // ─────────────────────────────────────────────────────────────

  // ── 1. WAITING_DURATION_PATTERN ──

  WAITING_DURATION_PATTERN: {
    signalId: 'WAITING_DURATION_PATTERN',

    requiredEvidence: [
      ev('PRIMARY_SIGNAL', 'DECISION_DELAY', 'detected with confidence ≥ 0.6'),
      ev('QUESTIONNAIRE', 'pastAttemptStage', 'value indicates prolonged deliberation without execution'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'OPTION_PRESERVING_DECISION', 'detected — user preserves optionality rather than committing'),
      ev('QUESTIONNAIRE', 'decisionStyle', 'SAFETY_FIRST or consistently defers to external input'),
      ev('BEHAVIORAL', 'RECOGNIZABLE_DEFERRED_DECISION_TIMELINE',
        'at least one key decision has been deferred for ≥ 3 months with a traceable timeline'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'MULTI_YEAR_DECISION_POSTPONEMENT',
        'at least one identifiable major decision postponed for ≥ 1 year despite unchanged conditions'),
    ],

    contradictoryEvidence: [
      ev('PRIMARY_SIGNAL', 'DECISION_STABILITY', 'detected with confidence ≥ 0.7 — decisions are made and executed promptly'),
      ev('PRIMARY_SIGNAL', 'LOW_COST_EXPERIMENTATION', 'detected — user runs small experiments rather than waiting'),
      ev('BEHAVIORAL', 'ACTIVE_DECISION_PROGRESSION',
        'all identifiable decisions are in active progression, none long-deferred'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when identifiable deferred decisions exist with clear temporal boundaries',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + contextualEvidence[1]', 'requiredEvidence[1] + contextualEvidence[0]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[0]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] detected with confidence ≥ 0.8 (all decisions active)',
      ],
    },

    suppressionRule: {
      description: 'Suppress this signal when decisions are progressing actively',
      triggers: [
        'DECISION_STABILITY detected with confidence ≥ 0.8',
        'LOW_COST_EXPERIMENTATION detected — experiments count as decision-execution, not postponement',
      ],
      partialSuppression: [
        'Short deferral periods (< 1 month) attributable to external constraints',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when deferral duration is ambiguous or motivation unclear',
      conditions: [
        'Deferral period is short (< 3 months) — may be normal deliberation, not inertia',
        'Cannot distinguish between "waiting for more information" and "avoiding commitment"',
        'Only one decision shows deferral; all others are timely',
      ],
      resolution: 'Requires MINIMUM_STEP_EXECUTION or POST_ACTION_REVIEW_HABIT evidence to resolve direction',
    },

    relatedBoundaryPairs: [
      { pair: ['DECISION_INERTIA', 'FEEDBACK_LOOP_GAP'], relationship: 'differentiates' },
    ],
  },

  // ── 2. MINIMUM_STEP_EXECUTION ──

  MINIMUM_STEP_EXECUTION: {
    signalId: 'MINIMUM_STEP_EXECUTION',

    requiredEvidence: [
      ev('BEHAVIORAL', 'MINIMUM_VIABLE_STEP_TAKEN',
        'user has taken at least one concrete, scoped action toward resolving a key uncertainty'),
      ev('BEHAVIORAL', 'NEW_INFORMATION_GAINED_FROM_STEP',
        'the step produced observable new information that changed the user\'s understanding'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'LOW_COST_EXPERIMENTATION', 'detected — user\'s action pattern is experimental'),
      ev('QUESTIONNAIRE', 'pastAttemptStage', 'value indicates prior execution attempts'),
      ev('BEHAVIORAL', 'INTENTIONAL_STEP_NOT_COERCED',
        'the step was taken voluntarily, not forced by external deadlines or obligations'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'MULTIPLE_MINIMUM_STEPS_ACROSS_CONTEXTS',
        '≥ 2 distinct minimum steps taken across different decision contexts, each producing new information'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'PURE_MENTAL_SIMULATION_ONLY',
        'all known options remain in mental simulation — no step entered real-world testing'),
      ev('PRIMARY_SIGNAL', 'DECISION_DELAY', 'detected with confidence ≥ 0.8 — and no executing step has been taken'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when concrete, scoped action steps have been executed and produced information',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + requiredEvidence[1]', 'requiredEvidence[0] + contextualEvidence[0]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[2] (confirming intentionality)'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] confirmed — pure mental simulation with zero execution',
      ],
    },

    suppressionRule: {
      description: 'Suppress when the step was coerced or produced no new information',
      triggers: [
        'Step was externally mandated (deadline, obligation) — not a genuine minimum-probe',
        'Step produced ZERO new information — same understanding before and after',
        'DECISION_DELAY detected ≥ 0.8 and no steps executed',
      ],
      partialSuppression: [
        'Single step across all contexts — pattern not established',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when the boundary between coerced and voluntary steps is unclear',
      conditions: [
        'Only one minimum step identifiable across all contexts',
        'Cannot confirm whether new information was genuinely gained or merely rationalized post-hoc',
        'Step was taken but not followed by any behavioral change',
      ],
      resolution: 'Requires POST_ACTION_REVIEW_HABIT or DECISION_TO_ACTION_LATENCY evidence to contextualize',
    },

    relatedBoundaryPairs: [
      { pair: ['DECISION_INERTIA', 'FEEDBACK_LOOP_GAP'], relationship: 'differentiates' },
    ],
  },

  // ── 3. POST_ACTION_REVIEW_HABIT ──

  POST_ACTION_REVIEW_HABIT: {
    signalId: 'POST_ACTION_REVIEW_HABIT',

    requiredEvidence: [
      ev('PRIMARY_SIGNAL', 'POST_ACTION_REVIEW', 'detected with confidence ≥ 0.5'),
      ev('BEHAVIORAL', 'SPECIFIC_LEARNING_EXTRACTED',
        'user can articulate ≥ 2 concrete, actionable lessons from past actions'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'ACTIVE_FEEDBACK_SEEKING', 'detected — user proactively gathers external input'),
      ev('QUESTIONNAIRE', 'failureResponse', 'value indicates analytical post-mortem rather than emotional reaction'),
      ev('BEHAVIORAL', 'DOCUMENTED_REFLECTION_PATTERN',
        'user maintains some form of record (journal, notes, systematic mental checklist) for post-action reflection'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'CROSS_EVENT_CONSISTENT_REVIEW',
        'review pattern is consistent across ≥ 3 distinct events, not a one-off post-mortem'),
    ],

    contradictoryEvidence: [
      ev('PRIMARY_SIGNAL', 'FEEDBACK_AVOIDANCE', 'detected — user avoids post-action evaluation'),
      ev('BEHAVIORAL', 'VAGUE_POST_HOC_RATIONALIZATION',
        'user\'s post-action reflection is limited to generic statements without specific learning'),
      ev('PRIMARY_SIGNAL', 'ASSUMPTION_WITHOUT_TEST', 'detected with confidence ≥ 0.7'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when systematic post-action review produces specific, actionable learning',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + requiredEvidence[1]', 'requiredEvidence[0] + contextualEvidence[1]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[0]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] detected — feedback avoidance confirmed',
      ],
    },

    suppressionRule: {
      description: 'Suppress when reflection exists but produces no substantive learning',
      triggers: [
        'FEEDBACK_AVOIDANCE detected with confidence ≥ 0.6',
        'Review content is empty or generic — no specific, transferable learning identified',
        'ASSUMPTION_WITHOUT_TEST detected — actions were not structured to produce feedback',
      ],
      partialSuppression: [
        'Review habit exists but is domain-specific (only in one narrow context)',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when the depth and consistency of review is ambiguous',
      conditions: [
        'Review is sporadic — present in some contexts, absent in others',
        'Learning articulated is shallow — could be post-hoc justification rather than genuine extraction',
        'User describes review in abstract terms without concrete examples',
      ],
      resolution: 'Requires CROSS_DOMAIN_FEEDBACK_THINKING evidence to determine if review is systematic or incidental',
    },

    relatedBoundaryPairs: [
      { pair: ['DECISION_INERTIA', 'FEEDBACK_LOOP_GAP'], relationship: 'differentiates' },
      { pair: ['SYSTEM_THINKING_GAP', 'FEEDBACK_LOOP_GAP'], relationship: 'contextualizes' },
    ],
  },

  // ── 4. DECISION_TO_ACTION_LATENCY ──

  DECISION_TO_ACTION_LATENCY: {
    signalId: 'DECISION_TO_ACTION_LATENCY',

    requiredEvidence: [
      ev('BEHAVIORAL', 'DECISION_ACTION_TIME_GAP_MEASURABLE',
        'at least one identifiable decision-to-execution gap can be measured in days'),
      ev('PRIMARY_SIGNAL', 'DECISION_DELAY', 'detected or not-detected with clear confidence'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'LOW_COST_EXPERIMENTATION', 'detected — rapid execution suggests low latency'),
      ev('QUESTIONNAIRE', 'executionStability', 'value indicates behavioral consistency in follow-through'),
      ev('BEHAVIORAL', 'MULTIPLE_LOW_LATENCY_CASES',
        '≥ 2 cases where decision was followed by action within days'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'CONSISTENT_LOW_LATENCY_PATTERN',
        '≥ 3 cases across different domains showing rapid decision-to-action conversion, with specific timeline data'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'SIGNIFICANT_POST_DECISION_GAP',
        'even after deciding, execution was delayed by ≥ 1 month'),
      ev('PRIMARY_SIGNAL', 'DECISION_DELAY', 'detected with confidence ≥ 0.8 — chronic execution gap'),
    ],

    minimumEvidence: 1,

    activationRule: {
      description: 'Activate when low decision-to-action latency is observed across contexts',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[1] (not-detected) + contextualEvidence[0]', 'contextualEvidence[0] + contextualEvidence[2]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[1]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] confirmed — significant gap between decision and action',
      ],
    },

    suppressionRule: {
      description: 'Suppress when latency is attributable to external constraints rather than behavioral pattern',
      triggers: [
        'Latency increase is clearly caused by external factors beyond user control',
        'DECISION_DELAY detected with confidence ≥ 0.8 — and latency is chronic rather than situational',
      ],
      partialSuppression: [
        'Single case of low latency — not enough to establish pattern',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when the cause of latency cannot be attributed',
      conditions: [
        'Cannot distinguish external constraint delay from internal hesitation',
        'Only one decision-to-action case available — insufficient for pattern',
        'Mixed pattern: some decisions execute fast, others stall',
      ],
      resolution: 'Requires WAITING_DURATION_PATTERN and MINIMUM_STEP_EXECUTION evidence to resolve',
    },

    relatedBoundaryPairs: [
      { pair: ['DECISION_INERTIA', 'FEEDBACK_LOOP_GAP'], relationship: 'differentiates' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // PAIR 2: LEVERAGE_MODEL_GAP vs TIME_HORIZON_TRAP
  // ─────────────────────────────────────────────────────────────

  // ── 5. OUTPUT_DECOUPLING_AWARENESS ──

  OUTPUT_DECOUPLING_AWARENESS: {
    signalId: 'OUTPUT_DECOUPLING_AWARENESS',

    requiredEvidence: [
      ev('BEHAVIORAL', 'REUSABLE_OUTPUT_CREATED',
        'user has created at least one output element that can be reused independently of their time input'),
      ev('PRIMARY_SIGNAL', 'REPEATABLE_VALUE', 'detected or contextual evidence of value decoupling present'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'SYSTEM_LEVERAGE', 'detected — user thinks in terms of systems rather than tasks'),
      ev('PRIMARY_SIGNAL', 'KNOWLEDGE_LEVERAGE', 'detected — user leverages knowledge assets'),
      ev('BEHAVIORAL', 'INTENTIONAL_DECOUPLING_ATTEMPT',
        'user has deliberately tried to create something that works without their ongoing presence'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'MULTIPLE_REUSABLE_ASSETS',
        '≥ 2 distinct reusable elements created (templates, systems, tools, documented processes) that demonstrably operate without user\'s direct time input'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'PURE_LINEAR_TIME_VALUE',
        'all output value is strictly proportional to time invested — no decoupling pattern exists'),
      ev('PRIMARY_SIGNAL', 'LEVERAGE_BLINDNESS', 'detected with confidence ≥ 0.7'),
      ev('PRIMARY_SIGNAL', 'LINEAR_TIME_VALUE', 'detected with confidence ≥ 0.7'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when user demonstrates awareness of or attempts at value decoupling',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + contextualEvidence[0]', 'requiredEvidence[0] + contextualEvidence[2]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[1]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] confirmed — purely linear value relationship',
      ],
    },

    suppressionRule: {
      description: 'Suppress when reuse is incidental rather than intentional',
      triggers: [
        'Reuse pattern is accidental (forwarding same content) — not a designed decoupling',
        'LEVERAGE_BLINDNESS detected ≥ 0.7 and LINEAR_TIME_VALUE detected ≥ 0.7',
      ],
      partialSuppression: [
        'Only one reusable element exists — may be situational rather than systematic',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when the boundary between intentional and incidental reuse is unclear',
      conditions: [
        'Single reusable element — insufficient to establish pattern',
        'Cannot confirm whether reuse was by design or by accident',
        'Reusable element exists but does not demonstrably save time on second use',
      ],
      resolution: 'Requires EFFORT_VS_MECHANISM_FRAMING evidence to determine if awareness is genuine',
    },

    relatedBoundaryPairs: [
      { pair: ['LEVERAGE_MODEL_GAP', 'TIME_HORIZON_TRAP'], relationship: 'differentiates' },
    ],
  },

  // ── 6. EFFORT_VS_MECHANISM_FRAMING ──

  EFFORT_VS_MECHANISM_FRAMING: {
    signalId: 'EFFORT_VS_MECHANISM_FRAMING',

    requiredEvidence: [
      ev('BEHAVIORAL', 'GROWTH_FRAMING_ANALYSIS',
        'user\'s description of how to improve/grow can be categorized as mechanism-oriented or effort-oriented'),
      ev('QUESTIONNAIRE', 'primaryGoal', 'value provides context for growth framing analysis'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'SYSTEM_LEVERAGE', 'detected — user identifies systemic amplification paths'),
      ev('PRIMARY_SIGNAL', 'DISTRIBUTION_LEVERAGE', 'detected — user recognizes distribution as a mechanism'),
      ev('BEHAVIORAL', 'MECHANISM_LANGUAGE_PATTERN',
        'user spontaneously uses mechanism-oriented vocabulary: systems, processes, scale, automation, leverage points'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'CROSS_CONTEXT_MECHANISM_THINKING',
        '≥ 3 contexts where user defaults to mechanism-based improvement strategies rather than increased personal effort'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'PURE_EFFORT_LANGUAGE',
        'all improvement descriptions center on "more time", "harder work", "more focus" without mechanism references'),
      ev('PRIMARY_SIGNAL', 'LEVERAGE_BLINDNESS', 'detected with confidence ≥ 0.8'),
      ev('PRIMARY_SIGNAL', 'CAPITAL_DEPENDENCE', 'detected — user attributes improvement solely to resource quantity'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when user\'s default improvement framing can be categorized',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + contextualEvidence[0]', 'requiredEvidence[0] + contextualEvidence[1]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[2]'],
      },
      vetoConditions: [
        'All evidence is ambiguous between effort and mechanism framing',
      ],
    },

    suppressionRule: {
      description: 'Suppress when context-specific effort emphasis is rational rather than a cognitive pattern',
      triggers: [
        'Context genuinely rewards linear effort more than mechanism (e.g., early skill acquisition phase)',
        'LEVERAGE_BLINDNESS detected ≥ 0.8 — masking mechanism awareness',
        'CAPITAL_DEPENDENCE with no alternative framing attempts',
      ],
      partialSuppression: [
        'Mixed framing — mechanism thinking present in some contexts but weak',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when framing is context-dependent rather than dispositional',
      conditions: [
        'User shows mechanism thinking in one domain but pure effort in another',
        'Context may genuinely limit mechanism options — not just a cognitive gap',
        'Cannot determine if "more time" framing is a preference or a perceived constraint',
      ],
      resolution: 'Requires OUTPUT_DECOUPLING_AWARENESS and LONG_TERM_COMPOUNDING_AWARENESS to triangulate',
    },

    relatedBoundaryPairs: [
      { pair: ['LEVERAGE_MODEL_GAP', 'TIME_HORIZON_TRAP'], relationship: 'differentiates' },
    ],
  },

  // ── 7. DIRECTION_SWITCHING_FREQUENCY ──

  DIRECTION_SWITCHING_FREQUENCY: {
    signalId: 'DIRECTION_SWITCHING_FREQUENCY',

    requiredEvidence: [
      ev('BEHAVIORAL', 'DIRECTION_SWITCH_COUNT',
        'number of distinct direction changes in the most recent 12-month period is identifiable'),
      ev('BEHAVIORAL', 'SWITCH_MOTIVATION_ANALYSIS',
        'the stated or inferred reason for each switch can be categorized'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'SHORT_TERM_PRIORITY', 'detected — user has short-term orientation'),
      ev('BEHAVIORAL', 'IMPATIENCE_DRIVEN_SWITCH',
        'at least one switch was motivated by impatience with results rather than rational reassessment'),
      ev('QUESTIONNAIRE', 'executionStability', 'value indicates frequent context switching'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'HIGH_FREQUENCY_IMPATIENCE_SWITCHING',
        '≥ 3 direction changes in 12 months, and ≥ 2 are attributable to impatience rather than strategic reassessment'),
    ],

    contradictoryEvidence: [
      ev('PRIMARY_SIGNAL', 'LONG_TERM_ORIENTATION', 'detected with confidence ≥ 0.7'),
      ev('BEHAVIORAL', 'SUSTAINED_DIRECTION_WITH_ACCELERATION',
        'user has maintained a direction for ≥ 1 year with observable compounding or accelerating returns'),
      ev('PRIMARY_SIGNAL', 'DECISION_STABILITY', 'detected — and direction change count ≤ 1 per year'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when direction-switching frequency and motivation are identifiable',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + contextualEvidence[1]', 'requiredEvidence[1] + contextualEvidence[0]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[0]'],
      },
      vetoConditions: [
        'contradictoryEvidence[1] confirmed — sustained direction with acceleration',
      ],
    },

    suppressionRule: {
      description: 'Suppress when switching is rational adaptation rather than time-preference-driven',
      triggers: [
        'All switches are clearly motivated by superior information or genuine opportunity revaluation',
        'LONG_TERM_ORIENTATION detected with confidence ≥ 0.8 — and still present',
        'DECISION_STABILITY detected — direction changes are strategic, not impulsive',
      ],
      partialSuppression: [
        'Mixed motivation — some switches strategic, some impatient',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when the quality of switching motivation cannot be assessed',
      conditions: [
        'Insufficient data on why switches occurred — only that they occurred',
        'Switches may be reasonable given changing circumstances',
        'One switch attributable to impatience, others ambiguous',
      ],
      resolution: 'Requires ALTERNATIVE_PATH_COST_AWARENESS and LONG_TERM_COMPOUNDING_AWARENESS to disambiguate',
    },

    relatedBoundaryPairs: [
      { pair: ['LEVERAGE_MODEL_GAP', 'TIME_HORIZON_TRAP'], relationship: 'differentiates' },
    ],
  },

  // ── 8. LONG_TERM_COMPOUNDING_AWARENESS ──

  LONG_TERM_COMPOUNDING_AWARENESS: {
    signalId: 'LONG_TERM_COMPOUNDING_AWARENESS',

    requiredEvidence: [
      ev('BEHAVIORAL', 'COMPOUNDING_REFERENCE_IN_DECISION',
        'user referenced long-term cumulative effects in at least one decision narrative'),
      ev('PRIMARY_SIGNAL', 'LONG_TERM_ORIENTATION', 'detected or contextual evidence of future-oriented thinking'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'COMPOUNDING_TIME_ALLOCATION', 'detected — user allocates time to compounding activities'),
      ev('BEHAVIORAL', 'PERSONAL_COMPOUNDING_EXPERIENCE',
        'user has personal experience with something that compounded over time (skill, relationship, knowledge)'),
      ev('QUESTIONNAIRE', 'primaryGoal', 'value reflects multi-year rather than near-term orientation'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'EXPLICIT_COMPOUNDING_CALCULATION',
        'user has demonstrated explicit reasoning about how an investment compounds over a multi-year horizon, with a concrete example'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'PURE_SHORT_TERM_EVALUATION',
        'all decisions are evaluated only on immediate return — no future projection beyond months'),
      ev('PRIMARY_SIGNAL', 'SHORT_TERM_PRIORITY', 'detected with confidence ≥ 0.8'),
      ev('PRIMARY_SIGNAL', 'URGENCY_DOMINANCE', 'detected — short-term urgency overrides long-term thinking'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when user demonstrates awareness of long-term compounding effects',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + contextualEvidence[0]', 'requiredEvidence[1] + contextualEvidence[1]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[1]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] confirmed — purely short-term evaluation pattern',
      ],
    },

    suppressionRule: {
      description: 'Suppress when compounding awareness is theoretical without behavioral follow-through',
      triggers: [
        'User knows the concept intellectually but behavior is entirely short-term',
        'SHORT_TERM_PRIORITY detected ≥ 0.8 and URGENCY_DOMINANCE detected — behavior contradicts awareness',
        'Compounding reference is abstract (textbook knowledge) rather than experiential',
      ],
      partialSuppression: [
        'Awareness exists but does not influence actual decisions',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when conceptual awareness and behavioral evidence diverge',
      conditions: [
        'User uses compounding language but actions are time-inconsistent',
        'Cannot distinguish genuine experiential understanding from borrowed vocabulary',
        'Only one domain shows compounding awareness — may be domain-specific rather than general',
      ],
      resolution: 'Requires DIRECTION_SWITCHING_FREQUENCY and ALTERNATIVE_PATH_COST_AWARENESS to assess behavioral consistency',
    },

    relatedBoundaryPairs: [
      { pair: ['LEVERAGE_MODEL_GAP', 'TIME_HORIZON_TRAP'], relationship: 'differentiates' },
    ],
  },

  // ── 9. ALTERNATIVE_PATH_COST_AWARENESS ──

  ALTERNATIVE_PATH_COST_AWARENESS: {
    signalId: 'ALTERNATIVE_PATH_COST_AWARENESS',

    requiredEvidence: [
      ev('BEHAVIORAL', 'SWITCHING_COST_RECOGNITION',
        'user demonstrates awareness of what is lost when switching directions'),
      ev('PRIMARY_SIGNAL', 'LONG_TERM_ORIENTATION', 'detected or contextual evidence of value placed on continuity'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'COMPOUNDING_TIME_ALLOCATION', 'detected — user recognizes value of sustained investment'),
      ev('BEHAVIORAL', 'EXPLICIT_OPPORTUNITY_COST_ANALYSIS',
        'user has articulated the specific cumulative gains foregone by switching'),
      ev('QUESTIONNAIRE', 'decisionStyle', 'DATA_DRIVEN — suggests analytical rather than impulsive switching'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'RESISTED_SWITCH_WITH_COST_RATIONALE',
        'user faced a new direction opportunity and deliberately declined, articulating what cumulative value they would lose by switching'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'SWITCHING_WITHOUT_COST_ACKNOWLEDGMENT',
        'user switches directions without any acknowledgment of what is being left behind'),
      ev('BEHAVIORAL', 'EACH_TIME_DIFFERENT_RATIONALIZATION',
        'each switch is justified with "this time is different" without reference to cumulative cost'),
      ev('PRIMARY_SIGNAL', 'SHORT_TERM_PRIORITY', 'detected with confidence ≥ 0.8 — cost awareness absent'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when user demonstrates awareness of switching costs and opportunity costs',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + contextualEvidence[1]', 'requiredEvidence[0] + contextualEvidence[0]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[2]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] confirmed — switches without any cost acknowledgment',
      ],
    },

    suppressionRule: {
      description: 'Suppress when switching cost awareness is shallow or self-serving',
      triggers: [
        'Switching cost awareness cited only to justify staying — not applied symmetrically',
        'SHORT_TERM_PRIORITY detected ≥ 0.8 — and switching behavior contradicts cost awareness',
        'Cost awareness is abstract — never influences actual switching decisions',
      ],
      partialSuppression: [
        'Cost awareness present but inconsistently applied across domains',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when switching cost awareness cannot be distinguished from inertia rationalization',
      conditions: [
        'User cites switching cost as reason not to switch, but this may be rationalized inertia',
        'Cannot determine if staying is cost-aware or fear-driven',
        'Switching cost awareness only appears when direction is threatened',
      ],
      resolution: 'Requires DIRECTION_SWITCHING_FREQUENCY and LONG_TERM_COMPOUNDING_AWARENESS to assess behavioral pattern',
    },

    relatedBoundaryPairs: [
      { pair: ['LEVERAGE_MODEL_GAP', 'TIME_HORIZON_TRAP'], relationship: 'differentiates' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // PAIR 3: RISK_MODEL_DISTORTION vs PROBABILITY_MISJUDGMENT
  // ─────────────────────────────────────────────────────────────

  // ── 10. EMOTIONAL_RECENCY_IMPACT ──

  EMOTIONAL_RECENCY_IMPACT: {
    signalId: 'EMOTIONAL_RECENCY_IMPACT',

    requiredEvidence: [
      ev('BEHAVIORAL', 'RECENT_HIGH_IMPACT_EVENT',
        'a recent event with significant emotional impact has occurred (loss, failure, shock)'),
      ev('BEHAVIORAL', 'POST_EVENT_RISK_ATTITUDE_SHIFT',
        'risk attitude has measurably changed following the event'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'LOSS_AVERSION', 'detected with confidence ≥ 0.6 — suggests emotional sensitivity to loss'),
      ev('BEHAVIORAL', 'DIRECTION_OF_RISK_SHIFT_ANALYZABLE',
        'the direction of risk attitude change (more cautious or more aggressive) can be assessed against probabilistic expectations'),
      ev('QUESTIONNAIRE', 'failureResponse', 'value indicates strong emotional reaction to past outcomes'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'RISK_SHIFT_DEVIATES_FROM_EXPECTATION',
        'the post-event risk attitude systematically deviates from what probability would suggest — avoiding positive-asymmetric paths or embracing negative-asymmetric ones'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'STABLE_RISK_ATTITUDE_DESPITE_EVENTS',
        'risk attitude is stable across time — recent events do not visibly change decision-making'),
      ev('PRIMARY_SIGNAL', 'PROBABILISTIC_THINKING', 'detected with confidence ≥ 0.7 — suggests probability-based rather than emotion-based risk'),
      ev('PRIMARY_SIGNAL', 'REVERSIBILITY_AWARENESS', 'detected — risk decisions reference reversibility rather than emotion'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when a recent emotional event has measurably shifted risk perception',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + requiredEvidence[1]', 'requiredEvidence[0] + contextualEvidence[2]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[1]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] confirmed — risk attitude is demonstrably stable',
      ],
    },

    suppressionRule: {
      description: 'Suppress when risk attitude change is calibrated rather than distorted',
      triggers: [
        'Risk attitude shift is in the direction that probability would recommend (increased caution after genuine danger)',
        'PROBABILISTIC_THINKING detected ≥ 0.7 — and shift is reasoned rather than reactive',
        'No recent high-impact event identifiable',
      ],
      partialSuppression: [
        'Event is distant (> 24 months) — recency effect may have faded',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when the cause-effect link between event and risk shift is unclear',
      conditions: [
        'Multiple events occurred — cannot isolate which caused the risk shift',
        'Risk attitude change may be rational learning rather than emotional distortion',
        'Event impact cannot be objectively calibrated',
      ],
      resolution: 'Requires ABSTRACT_VS_EMBODIED_RISK_JUDGMENT to determine if risk assessment is globally impaired or contextually distorted',
    },

    relatedBoundaryPairs: [
      { pair: ['RISK_MODEL_DISTORTION', 'PROBABILITY_MISJUDGMENT'], relationship: 'differentiates' },
    ],
  },

  // ── 11. ABSTRACT_VS_EMBODIED_RISK_JUDGMENT ──

  ABSTRACT_VS_EMBODIED_RISK_JUDGMENT: {
    signalId: 'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT',

    requiredEvidence: [
      ev('BEHAVIORAL', 'ABSTRACT_RISK_JUDGMENT_QUALITY',
        'quality of risk judgment in abstract (non-personal) scenarios can be assessed'),
      ev('BEHAVIORAL', 'EMBODIED_RISK_JUDGMENT_QUALITY',
        'quality of risk judgment in personally relevant scenarios can be assessed'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'PROBABILISTIC_THINKING', 'detected in some but not all contexts — suggests partial framework'),
      ev('BEHAVIORAL', 'ABSTRACT_VS_PERSONAL_DIVERGENCE',
        'a measurable gap exists between risk assessment quality in abstract vs personal scenarios'),
      ev('PRIMARY_SIGNAL', 'EXPECTED_VALUE_AWARENESS', 'detected — suggests analytical capability exists'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'CONSISTENT_ABSTRACT_ACCURACY_PERSONAL_BIAS',
        '≥ 2 abstract risk judgments are well-calibrated but ≥ 2 personal risk judgments are systematically biased in the same direction'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'UNIFORMLY_POOR_RISK_JUDGMENT',
        'risk assessment quality is consistently low in both abstract and personal contexts'),
      ev('BEHAVIORAL', 'UNIFORMLY_GOOD_RISK_JUDGMENT',
        'risk assessment quality is consistently good in both abstract and personal contexts'),
      ev('PRIMARY_SIGNAL', 'SAMPLE_SIZE_BLINDNESS', 'detected with confidence ≥ 0.8 — and BASE_RATE_NEGLECT detected'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when a measurable gap exists between abstract and personal risk judgment quality',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + requiredEvidence[1]', 'contextualEvidence[1] + contextualEvidence[2]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[1]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] or contradictoryEvidence[1] confirmed — uniform judgment quality',
      ],
    },

    suppressionRule: {
      description: 'Suppress when apparent gap is a measurement artifact rather than genuine distortion',
      triggers: [
        'Only one abstract and one personal judgment available — insufficient for comparison',
        'Abstract judgment accuracy may be due to chance (single correct guess) rather than capability',
        'SAMPLE_SIZE_BLINDNESS detected ≥ 0.8 — and BASE_RATE_NEGLECT detected — suggests fundamental gap, not distortion',
      ],
      partialSuppression: [
        'Gap direction is inconsistent — sometimes abstract better, sometimes personal better',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when the number of comparable judgments is insufficient',
      conditions: [
        'Fewer than 2 abstract and 2 personal risk judgments available for comparison',
        'Abstract judgment may have been correct by luck rather than skill',
        'Cannot objectively assess judgment quality in either context',
      ],
      resolution: 'Requires EMOTIONAL_RECENCY_IMPACT and PROBABILISTIC_LANGUAGE_USAGE to triangulate nature of gap',
    },

    relatedBoundaryPairs: [
      { pair: ['RISK_MODEL_DISTORTION', 'PROBABILITY_MISJUDGMENT'], relationship: 'differentiates' },
    ],
  },

  // ── 12. PROBABILISTIC_LANGUAGE_USAGE ──

  PROBABILISTIC_LANGUAGE_USAGE: {
    signalId: 'PROBABILISTIC_LANGUAGE_USAGE',

    requiredEvidence: [
      ev('BEHAVIORAL', 'LANGUAGE_FRAMING_ANALYSIS',
        'user\'s language when discussing uncertain outcomes can be categorized as probabilistic or deterministic'),
      ev('PRIMARY_SIGNAL', 'PROBABILISTIC_THINKING', 'detected or not-detected — confirms or refutes language pattern'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'BINARY_OUTCOME_THINKING', 'not-detected — suggests user avoids deterministic framing'),
      ev('BEHAVIORAL', 'PROBABILITY_DISTRIBUTION_LANGUAGE',
        'user uses language that implies a distribution of possibilities rather than a single outcome'),
      ev('BEHAVIORAL', 'GRADED_CONFIDENCE_EXPRESSION',
        'user expresses graded confidence (very likely, somewhat possible, unlikely) rather than binary certain/uncertain'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'EXPLICIT_MULTI_OUTCOME_REASONING',
        '≥ 2 instances where user explicitly evaluates multiple possible outcomes with relative likelihoods'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'PURE_DETERMINISTIC_LANGUAGE',
        'all uncertainty discussions use binary framing: success/failure, can/cannot, will/won\'t'),
      ev('PRIMARY_SIGNAL', 'BINARY_OUTCOME_THINKING', 'detected with confidence ≥ 0.8'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when language reveals the presence or absence of probabilistic framing',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + contextualEvidence[1]', 'requiredEvidence[1] + contextualEvidence[2]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[1]'],
      },
      vetoConditions: [
        'Override: contradictoryEvidence[0] confirmed — purely deterministic language — signal still activates in negative direction',
      ],
    },

    suppressionRule: {
      description: 'Suppress when probabilistic language is superficial rather than substantive',
      triggers: [
        'User says "maybe" or "possibly" but does not differentiate between "possible" and "probable"',
        'BINARY_OUTCOME_THINKING detected ≥ 0.8 — language may be performative rather than substantive',
        'Probabilistic language is domain-specific (only in one context; binary elsewhere)',
      ],
      partialSuppression: [
        'Probabilistic words present but no evidence of distribution-level thinking',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when language pattern is ambiguous or inconsistent',
      conditions: [
        'Mixed language: probabilistic in some discussions, deterministic in others',
        'Conversational "maybe" vs genuine probabilistic assessment — cannot distinguish',
        'User uses probabilistic words but actions are binary',
      ],
      resolution: 'Requires LUCK_VS_SKILL_ATTRIBUTION and FEEDBACK_CALIBRATION_RATE to assess whether language reflects actual thinking',
    },

    relatedBoundaryPairs: [
      { pair: ['RISK_MODEL_DISTORTION', 'PROBABILITY_MISJUDGMENT'], relationship: 'differentiates' },
      { pair: ['SYSTEM_THINKING_GAP', 'FEEDBACK_LOOP_GAP'], relationship: 'contextualizes' },
    ],
  },

  // ── 13. LUCK_VS_SKILL_ATTRIBUTION ──

  LUCK_VS_SKILL_ATTRIBUTION: {
    signalId: 'LUCK_VS_SKILL_ATTRIBUTION',

    requiredEvidence: [
      ev('BEHAVIORAL', 'SUCCESS_ATTRIBUTION_PATTERN',
        'how user attributes past successes can be analyzed for luck/skill decomposition'),
      ev('BEHAVIORAL', 'FAILURE_ATTRIBUTION_PATTERN',
        'how user attributes past failures can be analyzed for luck/skill decomposition'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'PROBABILISTIC_THINKING', 'detected — user has framework for uncertainty decomposition'),
      ev('BEHAVIORAL', 'BALANCED_ATTRIBUTION_CASES',
        'at least 2 cases where user attributes both skill and luck to an outcome, with reasonable proportions'),
      ev('QUESTIONNAIRE', 'failureResponse', 'value suggests analytical rather than self-serving attribution'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'CROSS_OUTCOME_CONSISTENT_ATTRIBUTION',
        'attribution pattern is consistent across ≥ 3 outcomes: skill/luck split is proportional and not self-serving'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'SELF_SERVING_ATTRIBUTION_BIAS',
        'systematic pattern: successes attributed to skill, failures attributed to luck — across multiple cases'),
      ev('BEHAVIORAL', 'INVERSE_SELF_SERVING_ATTRIBUTION',
        'systematic pattern: successes attributed to luck, failures attributed to skill deficit'),
      ev('PRIMARY_SIGNAL', 'SAMPLE_SIZE_BLINDNESS', 'detected — contributing to attribution errors'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when attribution pattern across outcomes can be categorized',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + requiredEvidence[1]', 'contextualEvidence[1] + contextualEvidence[2]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[0]'],
      },
      vetoConditions: [
        'Insufficient outcome data to establish pattern',
      ],
    },

    suppressionRule: {
      description: 'Suppress when attribution analysis has insufficient data',
      triggers: [
        'Fewer than 2 outcomes with clear outcomes available for attribution analysis',
        'All outcomes are ambiguous — cannot determine skill vs luck contribution',
        'SAMPLE_SIZE_BLINDNESS detected — attribution may be random rather than systematic',
      ],
      partialSuppression: [
        'Self-serving bias is mild — may be normal human tendency rather than cognitive deficit',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when attribution quality cannot be objectively assessed',
      conditions: [
        'Outcome data insufficient to determine actual skill/luck contribution ratio',
        'Attribution that appears self-serving may be factually correct (user is genuinely skilled/unlucky)',
        'Only one domain has attribution data — may not generalize',
      ],
      resolution: 'Requires FEEDBACK_CALIBRATION_RATE to assess whether attribution pattern affects belief updating',
    },

    relatedBoundaryPairs: [
      { pair: ['RISK_MODEL_DISTORTION', 'PROBABILITY_MISJUDGMENT'], relationship: 'differentiates' },
    ],
  },

  // ── 14. FEEDBACK_CALIBRATION_RATE ──

  FEEDBACK_CALIBRATION_RATE: {
    signalId: 'FEEDBACK_CALIBRATION_RATE',

    requiredEvidence: [
      ev('BEHAVIORAL', 'BELIEF_UPDATE_CASE',
        'at least one identifiable case where user received new evidence about a prior belief'),
      ev('BEHAVIORAL', 'UPDATE_MAGNITUDE_ASSESSABLE',
        'the magnitude of belief change can be assessed relative to the information content of the new evidence'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'ACTIVE_FEEDBACK_SEEKING', 'detected — user proactively seeks calibration data'),
      ev('QUESTIONNAIRE', 'failureResponse', 'value suggests analytical revision rather than emotional reaction'),
      ev('BEHAVIORAL', 'MULTIPLE_UPDATE_CASES',
        '≥ 2 cases of belief updating available for comparison'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'APPROPRIATE_CALIBRATION_PATTERN',
        '≥ 2 cases where belief revision magnitude matches evidence informativeness — neither over-reacting nor under-reacting'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'ZERO_UPDATE_PATTERN',
        'user receives new evidence but does not revise beliefs at all'),
      ev('BEHAVIORAL', 'OVERREACTIVE_UPDATE_PATTERN',
        'user revises beliefs dramatically based on small amounts of weak evidence'),
      ev('PRIMARY_SIGNAL', 'ASSUMPTION_WITHOUT_TEST', 'detected with confidence ≥ 0.8'),
    ],

    minimumEvidence: 1,

    activationRule: {
      description: 'Activate when belief updating behavior can be assessed from specific cases',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + requiredEvidence[1]', 'contextualEvidence[2] + contextualEvidence[0]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[1]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] AND contradictoryEvidence[1] both detected — indicates fundamental calibration problem',
      ],
    },

    suppressionRule: {
      description: 'Suppress when calibration assessment is unreliable due to data insufficiency',
      triggers: [
        'No cases where user clearly received disconfirming evidence — no calibration opportunity',
        'ASSUMPTION_WITHOUT_TEST detected ≥ 0.8 — and no belief updates attempted',
        'Single update case — insufficient to establish pattern',
      ],
      partialSuppression: [
        'Update cases exist but evidence informativeness cannot be objectively assessed',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when update magnitude cannot be benchmarked',
      conditions: [
        'Cannot determine how informative the evidence actually was',
        'Belief change may be appropriate but reference point unknown',
        'User may have updated privately — no observable behavioral change',
      ],
      resolution: 'Requires LUCK_VS_SKILL_ATTRIBUTION and ABSTRACT_VS_EMBODIED_RISK_JUDGMENT to assess if calibration deficit is general or specific',
    },

    relatedBoundaryPairs: [
      { pair: ['RISK_MODEL_DISTORTION', 'PROBABILITY_MISJUDGMENT'], relationship: 'differentiates' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // PAIR 4: SYSTEM_THINKING_GAP vs FEEDBACK_LOOP_GAP
  // ─────────────────────────────────────────────────────────────

  // ── 15. FEEDBACK_LOOP_CONCEPT_AWARENESS ──

  FEEDBACK_LOOP_CONCEPT_AWARENESS: {
    signalId: 'FEEDBACK_LOOP_CONCEPT_AWARENESS',

    requiredEvidence: [
      ev('BEHAVIORAL', 'FEEDBACK_CONCEPT_USAGE',
        'user\'s explanation of phenomena can be assessed for feedback loop concepts'),
      ev('BEHAVIORAL', 'CAUSAL_CHAIN_COMPLEXITY',
        'user\'s causal explanations can be categorized as linear or systemic'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'ACTIVE_FEEDBACK_SEEKING', 'detected — suggests awareness of feedback value'),
      ev('PRIMARY_SIGNAL', 'POST_ACTION_REVIEW', 'detected — suggests systematic reflection'),
      ev('BEHAVIORAL', 'SECOND_ORDER_EFFECT_MENTION',
        'user spontaneously mentions second-order or indirect effects in at least one explanation'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'FEEDBACK_LOOP_EXPLICIT_IDENTIFICATION',
        'user has explicitly identified a feedback loop (reinforcing or balancing) in ≥ 2 distinct contexts'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'PURE_LINEAR_CAUSATION_ACROSS_CONTEXTS',
        'all causal explanations are simple A→B→C chains — no interaction, no loops, no second-order effects, across ≥ 3 contexts'),
      ev('PRIMARY_SIGNAL', 'WEAK_FEEDBACK_LOOP', 'detected with confidence ≥ 0.8 — and no feedback concept in language'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when the presence or absence of feedback loop concepts in causal reasoning is identifiable',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + contextualEvidence[2]', 'requiredEvidence[1] + contextualEvidence[1]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[2]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] confirmed — pure linear causation across all contexts',
      ],
    },

    suppressionRule: {
      description: 'Suppress when linear explanation is context-appropriate rather than a cognitive gap',
      triggers: [
        'Domain genuinely operates on simple linear causality — complex explanations would be overfitting',
        'WEAK_FEEDBACK_LOOP detected ≥ 0.8 — conceptual awareness may be present but behavioral gap exists',
      ],
      partialSuppression: [
        'Feedback concepts used in one domain but absent in others — suggests awareness exists but is not general',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when domain complexity makes causal analysis ambiguous',
      conditions: [
        'Domain is inherently simple — linear explanation may be appropriate, not a gap',
        'Cannot distinguish between "has the concept but doesn\'t use it" and "doesn\'t have the concept"',
        'Single context analyzed — may not reflect general thinking pattern',
      ],
      resolution: 'Requires CROSS_DOMAIN_FEEDBACK_THINKING and LINEARTY_VS_COMPLEXITY_DEFAULT to determine if pattern is dispositional',
    },

    relatedBoundaryPairs: [
      { pair: ['SYSTEM_THINKING_GAP', 'FEEDBACK_LOOP_GAP'], relationship: 'differentiates' },
    ],
  },

  // ── 16. CROSS_DOMAIN_FEEDBACK_THINKING ──

  CROSS_DOMAIN_FEEDBACK_THINKING: {
    signalId: 'CROSS_DOMAIN_FEEDBACK_THINKING',

    requiredEvidence: [
      ev('BEHAVIORAL', 'DOMAIN_A_FEEDBACK_ANALYSIS',
        'at least one domain where user\'s feedback-loop thinking can be assessed'),
      ev('BEHAVIORAL', 'DOMAIN_B_FEEDBACK_ANALYSIS',
        'at least one other distinct domain where user\'s feedback-loop thinking can be assessed'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'POST_ACTION_REVIEW', 'detected in some domains but not others'),
      ev('BEHAVIORAL', 'CROSS_DOMAIN_THINKING_VARIANCE',
        'measurable variance in feedback thinking quality across ≥ 2 domains'),
      ev('PRIMARY_SIGNAL', 'ACTIVE_FEEDBACK_SEEKING', 'detected in one domain but not another'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'DOMAIN_SPECIFIC_FEEDBACK_PRESENCE',
        'clear evidence of feedback thinking in ≥ 2 distinct domains AND clear evidence of its absence in ≥ 2 other domains'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'UNIFORM_FEEDBACK_ABSENCE',
        'feedback thinking is absent in ALL assessed domains — pattern is uniform, not domain-specific'),
      ev('BEHAVIORAL', 'UNIFORM_FEEDBACK_PRESENCE',
        'feedback thinking is present in ALL assessed domains — pattern is uniform, not domain-specific'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when feedback thinking quality varies across domains',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + requiredEvidence[1]', 'contextualEvidence[1] + contextualEvidence[2]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[1]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] or contradictoryEvidence[1] confirmed — uniform pattern, no domain variance',
      ],
    },

    suppressionRule: {
      description: 'Suppress when domain variance is attributable to domain characteristics rather than cognitive pattern',
      triggers: [
        'Domain genuinely does not support feedback thinking (e.g., one-shot decisions)',
        'UNIFORM_FEEDBACK_ABSENCE confirmed — variance is zero, not domain-specific',
        'Only one domain has sufficient data for analysis',
      ],
      partialSuppression: [
        'Variance is present but small — may be noise rather than pattern',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when domain boundaries are ambiguous',
      conditions: [
        'Domains overlap significantly — may not be truly distinct',
        'Cannot objectively assess feedback thinking quality in either domain',
        'Data from only one domain is reliable',
      ],
      resolution: 'Requires FEEDBACK_LOOP_CONCEPT_AWARENESS and LINEARTY_VS_COMPLEXITY_DEFAULT to triangulate whether variance is domain-specific or global',
    },

    relatedBoundaryPairs: [
      { pair: ['SYSTEM_THINKING_GAP', 'FEEDBACK_LOOP_GAP'], relationship: 'differentiates' },
    ],
  },

  // ── 17. LINEARTY_VS_COMPLEXITY_DEFAULT ──

  LINEARTY_VS_COMPLEXITY_DEFAULT: {
    signalId: 'LINEARTY_VS_COMPLEXITY_DEFAULT',

    requiredEvidence: [
      ev('BEHAVIORAL', 'FAILURE_ATTRIBUTION_PATTERN',
        'how user attributes unexpected negative outcomes can be assessed'),
      ev('BEHAVIORAL', 'CAUSAL_FACTOR_COUNT',
        'number of distinct causal factors user identifies for failures can be counted'),
    ],

    contextualEvidence: [
      ev('BEHAVIORAL', 'MULTI_FACTOR_ATTRIBUTION_CASES',
        '≥ 2 cases where user attributes outcomes to multiple interacting factors'),
      ev('PRIMARY_SIGNAL', 'POST_ACTION_REVIEW', 'detected — suggests systematic reflection capability'),
      ev('QUESTIONNAIRE', 'failureResponse', 'value suggests multi-causal rather than single-cause analysis'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'CONSISTENT_MULTI_FACTOR_ATTRIBUTION',
        'across ≥ 3 failure/outcome analyses, user consistently identifies ≥ 3 interacting causal factors'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'SINGLE_CAUSE_DEFAULT',
        'across ≥ 3 failure analyses, user consistently identifies only ONE cause — the most recent or most salient action'),
      ev('PRIMARY_SIGNAL', 'BINARY_OUTCOME_THINKING', 'detected with confidence ≥ 0.7'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when causal attribution pattern reveals linear vs systemic default',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + requiredEvidence[1]', 'contextualEvidence[0] + contextualEvidence[2]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[1]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] confirmed — single-cause default across all contexts',
      ],
    },

    suppressionRule: {
      description: 'Suppress when single-cause attribution is justified by the situation',
      triggers: [
        'The outcome genuinely had a single dominant cause — multi-factor attribution would be overcomplicating',
        'BINARY_OUTCOME_THINKING detected ≥ 0.8 — framing limits causal analysis',
        'Insufficient number of outcome analyses to establish pattern (fewer than 2)',
      ],
      partialSuppression: [
        'User shows multi-factor analysis in some contexts but defaults to single cause in others',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when the appropriate level of causal complexity is debatable',
      conditions: [
        'Cannot objectively determine how many factors actually contributed to an outcome',
        'Single cause identified may be the root cause — and others are downstream effects',
        'User may be summarizing rather than defaulting — real analysis is more nuanced',
      ],
      resolution: 'Requires FEEDBACK_LOOP_CONCEPT_AWARENESS and CROSS_DOMAIN_FEEDBACK_THINKING to assess if linearity is a pattern or a simplification',
    },

    relatedBoundaryPairs: [
      { pair: ['SYSTEM_THINKING_GAP', 'FEEDBACK_LOOP_GAP'], relationship: 'differentiates' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // PAIR 5: OPPORTUNITY_BLINDNESS vs IDENTITY_CONSTRAINT
  // ─────────────────────────────────────────────────────────────

  // ── 18. INFORMATION_SOURCE_DIVERSITY ──

  INFORMATION_SOURCE_DIVERSITY: {
    signalId: 'INFORMATION_SOURCE_DIVERSITY',

    requiredEvidence: [
      ev('BEHAVIORAL', 'INFORMATION_SOURCE_COUNT',
        'number of distinct information sources user regularly accesses can be estimated'),
      ev('BEHAVIORAL', 'DOMAIN_DIVERSITY_OF_SOURCES',
        'whether these sources span multiple distinct domains can be assessed'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'LOW_OPPORTUNITY_EXPOSURE', 'detected — suggests narrow information intake'),
      ev('PRIMARY_SIGNAL', 'NETWORK_LIMITATION', 'detected — suggests limited social/information network'),
      ev('PRIMARY_SIGNAL', 'OPPORTUNITY_RECOGNITION', 'detected — suggests broader exposure'),
      ev('BEHAVIORAL', 'CROSS_DOMAIN_CONTACT_PATTERN',
        'user has meaningful contact with people or ideas from ≥ 3 distinct domains'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'EXTREME_SOURCE_HOMOGENEITY',
        'all information sources are from a single domain/type — no meaningful cross-domain exposure, confirmed via multiple indicators'),
    ],

    contradictoryEvidence: [
      ev('PRIMARY_SIGNAL', 'RESOURCE_RECOMBINATION', 'detected with confidence ≥ 0.6 — suggests diverse input'),
      ev('BEHAVIORAL', 'DIVERSE_INFORMATION_DIET',
        '≥ 3 distinct domains of information intake with meaningful depth in each'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when information source breadth and diversity can be assessed',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + requiredEvidence[1]', 'contextualEvidence[0] + contextualEvidence[1]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[0]'],
      },
      vetoConditions: [
        'contradictoryEvidence[1] confirmed — diverse information diet',
      ],
    },

    suppressionRule: {
      description: 'Suppress when information source count is high but content is homogeneous',
      triggers: [
        'Multiple sources but all within same domain — diversity is illusory',
        'RESOURCE_RECOMBINATION detected ≥ 0.6 — suggests effective cross-domain synthesis',
        'OPPORTUNITY_RECOGNITION detected — user can identify paths despite narrow input',
      ],
      partialSuppression: [
        'Sources exist but engagement is superficial — exposure without absorption',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when source diversity is unknown or unverifiable',
      conditions: [
        'Cannot reliably estimate number or diversity of information sources',
        'Source count is high but quality/depth of engagement unclear',
        'User may have access to diverse sources but selectively engages with homogeneous subsets',
      ],
      resolution: 'Requires SERENDIPITOUS_PATH_DISCOVERY and NON_DOMAIN_PATH_AWARENESS to assess whether diversity translates to awareness',
    },

    relatedBoundaryPairs: [
      { pair: ['OPPORTUNITY_BLINDNESS', 'IDENTITY_CONSTRAINT'], relationship: 'differentiates' },
    ],
  },

  // ── 19. SERENDIPITOUS_PATH_DISCOVERY ──

  SERENDIPITOUS_PATH_DISCOVERY: {
    signalId: 'SERENDIPITOUS_PATH_DISCOVERY',

    requiredEvidence: [
      ev('BEHAVIORAL', 'SERENDIPITOUS_DISCOVERY_EVENT',
        'presence or absence of at least one identifiable instance where unexpected external contact revealed a new path'),
      ev('BEHAVIORAL', 'DISCOVERY_SOURCE_ANALYSIS',
        'whether the discovery source was within or outside the user\'s existing circle'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'LOW_OPPORTUNITY_EXPOSURE', 'detected — suggests limited chance encounters'),
      ev('PRIMARY_SIGNAL', 'OPPORTUNITY_RECOGNITION', 'detected — suggests history of recognizing paths'),
      ev('BEHAVIORAL', 'POST_DISCOVERY_BEHAVIOR',
        'if a discovery occurred, did user act on it or filter it out?'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'NO_SERENDIPITOUS_DISCOVERY_HISTORY',
        'confirmed absence of any serendipitous path discovery across the user\'s entire history — all paths originated from existing circle'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'MULTIPLE_SERENDIPITOUS_DISCOVERIES_ACTED_ON',
        '≥ 2 serendipitous discoveries that the user successfully acted on — suggesting diverse input AND execution'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when the presence or absence of serendipitous path discovery can be assessed',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + requiredEvidence[1]', 'contextualEvidence[0] + contextualEvidence[2]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[2]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] confirmed — multiple serendipitous discoveries acted on',
      ],
    },

    suppressionRule: {
      description: 'Suppress when discovery history is too limited to assess',
      triggers: [
        'User\'s history is too short to expect serendipitous discoveries',
        'OPPORTUNITY_RECOGNITION detected — and discoveries exist but user filtered them out',
      ],
      partialSuppression: [
        'One serendipitous discovery occurred but user did not act on it — could be IDENTITY filtering',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when serendipity cannot be distinguished from active search',
      conditions: [
        'Discovery may have been from existing circle (not truly serendipitous)',
        'Cannot confirm whether the discovery was genuinely unexpected or actively sought',
        'User may have had discoveries but does not recognize them as such',
      ],
      resolution: 'Requires NON_DOMAIN_PATH_AWARENESS and IDENTITY_BASED_EXCLUSION to determine if gap is exposure or filtering',
    },

    relatedBoundaryPairs: [
      { pair: ['OPPORTUNITY_BLINDNESS', 'IDENTITY_CONSTRAINT'], relationship: 'differentiates' },
    ],
  },

  // ── 20. NON_DOMAIN_PATH_AWARENESS ──

  NON_DOMAIN_PATH_AWARENESS: {
    signalId: 'NON_DOMAIN_PATH_AWARENESS',

    requiredEvidence: [
      ev('BEHAVIORAL', 'OTHER_PATH_KNOWLEDGE_CHECK',
        'user\'s knowledge of how people in other domains achieve their goals can be assessed'),
      ev('BEHAVIORAL', 'PATH_VARIETY_COUNT',
        'number of distinct non-domain paths the user can describe with reasonable accuracy'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'LOW_OPPORTUNITY_EXPOSURE', 'detected — suggests limited cross-domain awareness'),
      ev('PRIMARY_SIGNAL', 'NETWORK_LIMITATION', 'detected — suggests restricted social circles'),
      ev('BEHAVIORAL', 'CROSS_DOMAIN_PATH_DESCRIPTION_QUALITY',
        'user can describe ≥ 2 distinct paths outside their own domain with specific, accurate detail'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'ZERO_NON_DOMAIN_PATH_KNOWLEDGE',
        'user cannot describe a single path or approach from outside their own domain with any specificity'),
    ],

    contradictoryEvidence: [
      ev('PRIMARY_SIGNAL', 'OPPORTUNITY_RECOGNITION', 'detected with confidence ≥ 0.7'),
      ev('PRIMARY_SIGNAL', 'RESOURCE_RECOMBINATION', 'detected — suggests cross-domain synthesis'),
      ev('BEHAVIORAL', 'BROAD_PATH_KNOWLEDGE',
        'user can describe ≥ 3 paths from ≥ 3 distinct domains outside their own'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when user\'s awareness of non-domain paths can be assessed',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + requiredEvidence[1]', 'contextualEvidence[0] + contextualEvidence[1]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[2]'],
      },
      vetoConditions: [
        'contradictoryEvidence[2] confirmed — broad path knowledge detected',
      ],
    },

    suppressionRule: {
      description: 'Suppress when lack of path knowledge is irrelevant to user\'s situation',
      triggers: [
        'User\'s domain is sufficiently broad that "outside domain" is ill-defined',
        'OPPORTUNITY_RECOGNITION detected ≥ 0.7 — and RESOURCE_RECOMBINATION detected — suggests path knowledge is present',
      ],
      partialSuppression: [
        'User knows about paths but describes them in abstract rather than concrete terms',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when path knowledge is difficult to assess',
      conditions: [
        'User describes paths vaguely — may indicate knowledge or lack thereof',
        'Cannot confirm accuracy of user\'s path descriptions',
        'User claims to know paths but cannot articulate them under questioning',
      ],
      resolution: 'Requires INFORMATION_SOURCE_DIVERSITY and SERENDIPITOUS_PATH_DISCOVERY to determine if exposure or filtering is the root cause',
    },

    relatedBoundaryPairs: [
      { pair: ['OPPORTUNITY_BLINDNESS', 'IDENTITY_CONSTRAINT'], relationship: 'differentiates' },
    ],
  },

  // ── 21. IDENTITY_BASED_EXCLUSION ──

  IDENTITY_BASED_EXCLUSION: {
    signalId: 'IDENTITY_BASED_EXCLUSION',

    requiredEvidence: [
      ev('BEHAVIORAL', 'PATH_EXCLUSION_LANGUAGE_ANALYSIS',
        'user\'s language when explaining why they do not pursue certain paths can be analyzed'),
      ev('BEHAVIORAL', 'EXCLUSION_RATIONALE_CATEGORIZATION',
        'exclusion rationales can be categorized as identity-based or information-based'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'FIXED_ROLE_IDENTITY', 'detected — suggests identity-based self-definition'),
      ev('PRIMARY_SIGNAL', 'SINGLE_PATH_DEPENDENCE', 'detected — suggests narrow self-conception'),
      ev('BEHAVIORAL', 'IDENTITY_LANGUAGE_MARKERS',
        'user uses identity-anchored phrases in explanations: "I\'m the kind of person who...", "that\'s not me", "I\'m not that type"'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'SYSTEMATIC_IDENTITY_EXCLUSION_PATTERN',
        '≥ 3 distinct paths excluded using identity-based rationale, with no information-based counter-analysis for any'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'INFORMATION_BASED_EXCLUSION_ONLY',
        'user excludes paths based on concrete, verifiable information rather than identity labels'),
      ev('PRIMARY_SIGNAL', 'EXPANDING_IDENTITY', 'detected with confidence ≥ 0.6'),
      ev('PRIMARY_SIGNAL', 'ADAPTIVE_IDENTITY', 'detected — suggests flexible self-definition'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when path exclusion rationale can be categorized as identity-based or information-based',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + requiredEvidence[1]', 'contextualEvidence[0] + contextualEvidence[2]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[2]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] confirmed — all exclusions are information-based',
      ],
    },

    suppressionRule: {
      description: 'Suppress when identity-based exclusion mirrors genuine self-knowledge',
      triggers: [
        'Self-definition is accurate (user truly lacks the capability or interest) — not a constraint, a valid self-assessment',
        'EXPANDING_IDENTITY detected ≥ 0.6 — and ADAPTIVE_IDENTITY detected — identity is flexible',
        'Exclusion rationales are mixed — some identity-based, some information-based',
      ],
      partialSuppression: [
        'Identity language is mild ("prefer not to" vs "I cannot") — suggests preference rather than constraint',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when the boundary between self-knowledge and self-constraint is unclear',
      conditions: [
        'Cannot distinguish between "I know I\'m not suited for this" (knowledge) and "I cannot do this because of who I am" (constraint)',
        'Identity-based exclusion may reflect accurate self-assessment of genuine limitations',
        'User uses identity language casually rather than as a binding constraint',
      ],
      resolution: 'Requires CROSS_IDENTITY_ATTEMPT_HISTORY and SELF_ASSESSMENT_ASYMMETRY to determine if identity is locking or descriptive',
    },

    relatedBoundaryPairs: [
      { pair: ['OPPORTUNITY_BLINDNESS', 'IDENTITY_CONSTRAINT'], relationship: 'differentiates' },
    ],
  },

  // ── 22. CROSS_IDENTITY_ATTEMPT_HISTORY ──

  CROSS_IDENTITY_ATTEMPT_HISTORY: {
    signalId: 'CROSS_IDENTITY_ATTEMPT_HISTORY',

    requiredEvidence: [
      ev('BEHAVIORAL', 'CROSS_IDENTITY_ATTEMPT_EXISTS',
        'presence or absence of at least one attempt at something inconsistent with the user\'s self-definition'),
      ev('BEHAVIORAL', 'ATTEMPT_OUTCOME_AND_LEARNING',
        'whether the attempt produced information or led to behavioral change'),
    ],

    contextualEvidence: [
      ev('PRIMARY_SIGNAL', 'ADAPTIVE_IDENTITY', 'detected — suggests willingness to try'),
      ev('BEHAVIORAL', 'ATTEMPT_QUALITY_ANALYSIS',
        'whether the attempt was genuine exploration or a token gesture'),
      ev('QUESTIONNAIRE', 'pastAttemptStage', 'value suggests history of experimentation'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'MULTIPLE_CROSS_IDENTITY_ATTEMPTS_WITH_LEARNING',
        '≥ 2 cross-identity attempts that produced genuine learning — even if user ultimately returned to original path'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'ZERO_CROSS_IDENTITY_ATTEMPTS',
        'no attempt in the user\'s history that went against their self-definition — all behavior is identity-consistent'),
      ev('PRIMARY_SIGNAL', 'FIXED_ROLE_IDENTITY', 'detected with confidence ≥ 0.8'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when the presence or absence of cross-identity attempts can be assessed',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + requiredEvidence[1]', 'contextualEvidence[0] + contextualEvidence[1]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[0]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] confirmed — zero cross-identity attempts in history',
      ],
    },

    suppressionRule: {
      description: 'Suppress when the absence of cross-identity attempts reflects satisfaction rather than constraint',
      triggers: [
        'User has no reason to attempt cross-identity behavior — current path is working well',
        'FIXED_ROLE_IDENTITY detected ≥ 0.8 — and multiple attempts existed but were abandoned after "verification"',
      ],
      partialSuppression: [
        'Attempts existed but were low-quality — may not represent genuine exploration',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when attempt history is ambiguous',
      conditions: [
        'Cannot determine whether an attempt was genuinely cross-identity or within comfort zone',
        'Attempt may have been coerced (obligation) rather than voluntary exploration',
        'User claims to have tried but provides no detail about learning',
      ],
      resolution: 'Requires IDENTITY_BASED_EXCLUSION and SELF_ASSESSMENT_ASYMMETRY to determine if identity is constraining or descriptive',
    },

    relatedBoundaryPairs: [
      { pair: ['OPPORTUNITY_BLINDNESS', 'IDENTITY_CONSTRAINT'], relationship: 'differentiates' },
    ],
  },

  // ── 23. SELF_ASSESSMENT_ASYMMETRY ──

  SELF_ASSESSMENT_ASYMMETRY: {
    signalId: 'SELF_ASSESSMENT_ASYMMETRY',

    requiredEvidence: [
      ev('BEHAVIORAL', 'EXCLUSION_EVIDENCE_STANDARD',
        'evidence threshold user applies when excluding a path can be assessed'),
      ev('BEHAVIORAL', 'CONFIRMATION_EVIDENCE_STANDARD',
        'evidence threshold user applies when confirming a path can be assessed'),
    ],

    contextualEvidence: [
      ev('BEHAVIORAL', 'EVIDENCE_THRESHOLD_ASYMMETRY_DETECTED',
        'a measurable asymmetry exists between exclusion and confirmation evidence standards'),
      ev('PRIMARY_SIGNAL', 'FIXED_ROLE_IDENTITY', 'detected — may drive asymmetric assessment'),
      ev('PRIMARY_SIGNAL', 'EXPANDING_IDENTITY', 'detected — may counteract asymmetry'),
      ev('BEHAVIORAL', 'MULTIPLE_DECISION_CASES_FOR_COMPARISON',
        '≥ 3 decision cases available to compare exclusion and confirmation thresholds'),
    ],

    strongEvidence: [
      ev('BEHAVIORAL', 'CONSISTENT_ASYMMETRY_ACROSS_DECISIONS',
        '≥ 3 cases showing the same direction of asymmetry: exclusion decisions require very low evidence while confirmation requires very high — or vice versa'),
    ],

    contradictoryEvidence: [
      ev('BEHAVIORAL', 'SYMMETRIC_EVIDENCE_STANDARDS',
        'evidence standards are consistent across exclusion and confirmation decisions — both require similar levels of evidence'),
      ev('PRIMARY_SIGNAL', 'EVIDENCE_BASED_DECISION', 'detected with confidence ≥ 0.7'),
    ],

    minimumEvidence: 2,

    activationRule: {
      description: 'Activate when evidence standard asymmetry between exclusion and confirmation decisions is measurable',
      modeA: {
        condition: '2 independent supporting evidence items',
        exampleItems: ['requiredEvidence[0] + requiredEvidence[1]', 'contextualEvidence[0] + contextualEvidence[3]'],
      },
      modeB: {
        condition: '1 strong evidence + 1 contextual evidence',
        exampleItems: ['strongEvidence[0] + contextualEvidence[1]'],
      },
      vetoConditions: [
        'contradictoryEvidence[0] confirmed — symmetric evidence standards',
      ],
    },

    suppressionRule: {
      description: 'Suppress when asymmetry reflects genuine domain expertise rather than identity filtering',
      triggers: [
        'Asymmetry direction is rational: user knows more about familiar paths (lower evidence bar) than unfamiliar ones (higher bar)',
        'EVIDENCE_BASED_DECISION detected ≥ 0.7 — suggests evidence standards are calibrated',
        'Asymmetry appears in one domain but not others — may be domain-specific knowledge',
      ],
      partialSuppression: [
        'Asymmetry is mild — difference between thresholds is small',
      ],
    },

    uncertaintyRule: {
      description: 'Flag uncertainty when evidence thresholds cannot be objectively compared',
      conditions: [
        'Cannot objectively measure evidence quality for different types of decisions',
        'Asymmetry may reflect differing decision stakes — high-stakes decisions appropriately require more evidence',
        'Too few decision cases to establish pattern',
      ],
      resolution: 'Requires IDENTITY_BASED_EXCLUSION and CROSS_IDENTITY_ATTEMPT_HISTORY to determine if asymmetry is identity-driven or rational',
    },

    relatedBoundaryPairs: [
      { pair: ['OPPORTUNITY_BLINDNESS', 'IDENTITY_CONSTRAINT'], relationship: 'differentiates' },
    ],
  },

})

// ═══════════════════════════════════════════════════════════════
// VALIDATION UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Validates that a secondary signal evidence contract has all required fields.
 */
function validateEvidenceContract(signalKey) {
  const contract = SECONDARY_SIGNAL_EVIDENCE_MAP[signalKey]
  if (!contract) return { valid: false, error: 'NOT_FOUND', signal: signalKey }

  const requiredFields = [
    'signalId',
    'requiredEvidence',
    'contextualEvidence',
    'strongEvidence',
    'contradictoryEvidence',
    'minimumEvidence',
    'activationRule',
    'suppressionRule',
    'uncertaintyRule',
    'relatedBoundaryPairs',
  ]

  const missing = requiredFields.filter(f => !contract[f] || contract[f] === undefined)
  if (missing.length > 0) {
    return { valid: false, error: 'MISSING_FIELDS', signal: signalKey, missing }
  }

  if (!Array.isArray(contract.requiredEvidence) || contract.requiredEvidence.length === 0) {
    return { valid: false, error: 'EMPTY_REQUIRED_EVIDENCE', signal: signalKey }
  }

  if (!Array.isArray(contract.contradictoryEvidence) || contract.contradictoryEvidence.length === 0) {
    return { valid: false, error: 'EMPTY_CONTRADICTORY_EVIDENCE', signal: signalKey }
  }

  if (!contract.activationRule || !contract.activationRule.modeA || !contract.activationRule.modeB) {
    return { valid: false, error: 'INCOMPLETE_ACTIVATION_RULE', signal: signalKey }
  }

  if (!contract.suppressionRule || !contract.suppressionRule.triggers) {
    return { valid: false, error: 'INCOMPLETE_SUPPRESSION_RULE', signal: signalKey }
  }

  if (!contract.uncertaintyRule || !contract.uncertaintyRule.conditions) {
    return { valid: false, error: 'INCOMPLETE_UNCERTAINTY_RULE', signal: signalKey }
  }

  if (!Array.isArray(contract.relatedBoundaryPairs) || contract.relatedBoundaryPairs.length === 0) {
    return { valid: false, error: 'EMPTY_RELATED_BOUNDARY_PAIRS', signal: signalKey }
  }

  if (typeof contract.minimumEvidence !== 'number' || contract.minimumEvidence < 1) {
    return { valid: false, error: 'INVALID_MINIMUM_EVIDENCE', signal: signalKey }
  }

  return { valid: true, signal: signalKey }
}

/**
 * Returns all evidence contract signal IDs.
 */
function getAllEvidenceContractIds() {
  return Object.keys(SECONDARY_SIGNAL_EVIDENCE_MAP)
}

/**
 * Returns the evidence contract for a given secondary signal.
 */
function getEvidenceContract(signalId) {
  return SECONDARY_SIGNAL_EVIDENCE_MAP[signalId] || null
}

/**
 * Validates all 23 evidence contracts and returns a report.
 */
function validateAllEvidenceContracts() {
  const allIds = getAllEvidenceContractIds()
  const results = allIds.map(id => validateEvidenceContract(id))

  const valid = results.filter(r => r.valid)
  const invalid = results.filter(r => !r.valid)

  return {
    total: allIds.length,
    passed: valid.length,
    failed: invalid.length,
    details: invalid.length > 0 ? invalid : null,
    allValid: invalid.length === 0,
  }
}

/**
 * Counts the number of evidence contracts that have contradictoryEvidence defined.
 */
function countContractsWithContradiction() {
  const allIds = getAllEvidenceContractIds()
  return allIds.filter(id => {
    const contract = SECONDARY_SIGNAL_EVIDENCE_MAP[id]
    return contract.contradictoryEvidence && contract.contradictoryEvidence.length > 0
  }).length
}

/**
 * Counts the number of evidence contracts that have suppressionRule defined.
 */
function countContractsWithSuppression() {
  const allIds = getAllEvidenceContractIds()
  return allIds.filter(id => {
    const contract = SECONDARY_SIGNAL_EVIDENCE_MAP[id]
    return contract.suppressionRule && contract.suppressionRule.triggers && contract.suppressionRule.triggers.length > 0
  }).length
}

/**
 * Counts the number of evidence contracts that have uncertaintyRule defined.
 */
function countContractsWithUncertainty() {
  const allIds = getAllEvidenceContractIds()
  return allIds.filter(id => {
    const contract = SECONDARY_SIGNAL_EVIDENCE_MAP[id]
    return contract.uncertaintyRule && contract.uncertaintyRule.conditions && contract.uncertaintyRule.conditions.length > 0
  }).length
}

/**
 * Returns all boundary pairs covered by the evidence contracts.
 */
function getAllCoveredBoundaryPairs() {
  const allIds = getAllEvidenceContractIds()
  const pairSet = new Set()

  allIds.forEach(id => {
    const contract = SECONDARY_SIGNAL_EVIDENCE_MAP[id]
    contract.relatedBoundaryPairs.forEach(bp => {
      const key = [...bp.pair].sort().join('_vs_')
      pairSet.add(key)
    })
  })

  return Array.from(pairSet).map(key => {
    const parts = key.split('_vs_')
    return { pair: [parts[0], parts[1]] }
  })
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

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
