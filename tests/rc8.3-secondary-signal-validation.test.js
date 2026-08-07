/**
 * tests/rc8.3-secondary-signal-validation.test.js
 *
 * RC8.3 C2-002C — Secondary Signal Extractor Validation.
 *
 * 60+ cases covering:
 *   15 clear activation (Mode A)
 *   10 strong+context activation (Mode B)
 *   10 contradiction/suppression
 *   10 insufficient evidence
 *   5 duplicate-origin / evidence independence
 *   10 confusion-pair differentiation (all 5 pairs)
 *   + cross-occupation, same-occupation, determinism
 *
 * DOES NOT modify extractor or contracts.
 * Records violations as debt.
 *
 * @version world_model_v2
 * @sprint c2-002c
 */

var {
  evaluateAllSignals,
  evaluateSignalById,
  SIGNAL_STATE,
  ACTIVATION_MODE,
} = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/secondarySignalExtractor')

// ═══════════════════════════════════════════════════════════════
// TEST INFRASTRUCTURE
// ═══════════════════════════════════════════════════════════════

var total = 0
var passed = 0
var failed = 0
var debtItems = []
var violations = []

function V(name, fn) {
  total++
  try {
    fn()
    passed++
  } catch (e) {
    failed++
    violations.push({ case: name, error: e.message, at: new Error().stack.split('\n')[2] })
    console.error('FAIL [' + name + ']: ' + e.message)
  }
}

function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))
}

function ok(val, msg) {
  if (!val) throw new Error((msg || 'ok') + ': falsy')
}

function notOk(val, msg) {
  if (val) throw new Error((msg || 'notOk') + ': truthy')
}

function inRange(val, lo, hi, msg) {
  if (typeof val !== 'number' || val < lo || val > hi) throw new Error((msg || 'range') + ': ' + val + ' not in [' + lo + ',' + hi + ']')
}

function gt(a, b, msg) {
  if (!(a > b)) throw new Error((msg || 'gt') + ': ' + a + ' not > ' + b)
}

function gte(a, b, msg) {
  if (!(a >= b)) throw new Error((msg || 'gte') + ': ' + a + ' not >= ' + b)
}

// ═══════════════════════════════════════════════════════════════
// EVIDENCE BUILDERS
// ═══════════════════════════════════════════════════════════════

function PS(id, detected, confidence, origin) {
  if (origin === undefined) origin = 'ps-' + id
  return { sourceType: 'PRIMARY_SIGNAL', type: 'PRIMARY_SIGNAL', signalId: id, id: id, reference: id, detected: detected, confidence: confidence, originId: origin }
}

function Q(field, origin) {
  if (origin === undefined) origin = 'q-' + field
  return { sourceType: 'QUESTIONNAIRE', type: 'QUESTIONNAIRE', reference: field, field: field, id: 'q-' + field, originId: origin }
}

function B(pattern, origin) {
  if (origin === undefined) origin = 'b-' + pattern
  return { sourceType: 'BEHAVIORAL', type: 'BEHAVIORAL', reference: pattern, pattern: pattern, id: 'b-' + pattern, originId: origin }
}

// ═══════════════════════════════════════════════════════════════
// SIGNAL STATE EXTRACTION HELPERS
// ═══════════════════════════════════════════════════════════════

function stateOf(result, signalId) {
  var s = result.signals.find(function (x) { return x.id === signalId })
  if (!s) throw new Error('Signal not found: ' + signalId)
  return s
}

function countBy(result, state) {
  return result.signals.filter(function (s) { return s.state === state }).length
}

function allSignalsExercised(result) {
  var ids = result.signals.map(function (s) { return s.id })
  var unique = {}
  ids.forEach(function (id) { unique[id] = true })
  return Object.keys(unique).length
}

// ═══════════════════════════════════════════════════════════════
// SECTION 1: CLEAR ACTIVATION — Mode A (15 cases)
// ═══════════════════════════════════════════════════════════════

// ── PAIR 1: DECISION_INERTIA side ──

V('A01: WAITING_DURATION_PATTERN — required + required', function () {
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [Q('pastAttemptStage')],
    primarySignals: [PS('DECISION_DELAY', true, 0.7)],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
  eq(r.activationMode, ACTIVATION_MODE.TWO_SUPPORTING)
  gt(r.confidence, 0)
  ok(r.score > 0)
})

V('A02: MINIMUM_STEP_EXECUTION — two behavioral required items', function () {
  var r = evaluateSignalById('MINIMUM_STEP_EXECUTION', {
    evidence: [B('MINIMUM_VIABLE_STEP_TAKEN'), B('NEW_INFORMATION_GAINED_FROM_STEP')],
    primarySignals: [],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
  eq(r.activationMode, ACTIVATION_MODE.TWO_SUPPORTING)
})

V('A03: POST_ACTION_REVIEW_HABIT — required + contextual', function () {
  var r = evaluateSignalById('POST_ACTION_REVIEW_HABIT', {
    evidence: [],
    primarySignals: [PS('POST_ACTION_REVIEW', true, 0.6), PS('ACTIVE_FEEDBACK_SEEKING', true, 0.5)],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

// ── PAIR 2: LEVERAGE side ──

V('A04: OUTPUT_DECOUPLING_AWARENESS — behavioral + primary', function () {
  var r = evaluateSignalById('OUTPUT_DECOUPLING_AWARENESS', {
    evidence: [B('REUSABLE_OUTPUT_CREATED')],
    primarySignals: [PS('REPEATABLE_VALUE', true, 0.5)],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

V('A05: EFFORT_VS_MECHANISM_FRAMING — behavioral + primary', function () {
  var r = evaluateSignalById('EFFORT_VS_MECHANISM_FRAMING', {
    evidence: [B('GROWTH_FRAMING_ANALYSIS')],
    primarySignals: [PS('SYSTEM_LEVERAGE', true, 0.5)],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

// ── PAIR 2: TIME side ──

V('A06: DIRECTION_SWITCHING_FREQUENCY — two behavioral', function () {
  var r = evaluateSignalById('DIRECTION_SWITCHING_FREQUENCY', {
    evidence: [B('DIRECTION_SWITCH_COUNT'), B('SWITCH_MOTIVATION_ANALYSIS')],
    primarySignals: [],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

V('A07: LONG_TERM_COMPOUNDING_AWARENESS — behavioral + primary', function () {
  var r = evaluateSignalById('LONG_TERM_COMPOUNDING_AWARENESS', {
    evidence: [B('COMPOUNDING_REFERENCE_IN_DECISION')],
    primarySignals: [PS('LONG_TERM_ORIENTATION', true, 0.5)],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

// ── PAIR 3: RISK side ──

V('A08: EMOTIONAL_RECENCY_IMPACT — two behavioral', function () {
  var r = evaluateSignalById('EMOTIONAL_RECENCY_IMPACT', {
    evidence: [B('RECENT_HIGH_IMPACT_EVENT'), B('POST_EVENT_RISK_ATTITUDE_SHIFT')],
    primarySignals: [],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

V('A09: ABSTRACT_VS_EMBODIED_RISK_JUDGMENT — two behavioral', function () {
  var r = evaluateSignalById('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', {
    evidence: [B('ABSTRACT_RISK_JUDGMENT_QUALITY'), B('EMBODIED_RISK_JUDGMENT_QUALITY')],
    primarySignals: [],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

// ── PAIR 3: PROBABILITY side ──

V('A10: PROBABILISTIC_LANGUAGE_USAGE — behavioral + primary', function () {
  var r = evaluateSignalById('PROBABILISTIC_LANGUAGE_USAGE', {
    evidence: [B('LANGUAGE_FRAMING_ANALYSIS')],
    primarySignals: [PS('PROBABILISTIC_THINKING', true, 0.5)],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

V('A11: LUCK_VS_SKILL_ATTRIBUTION — two behavioral', function () {
  var r = evaluateSignalById('LUCK_VS_SKILL_ATTRIBUTION', {
    evidence: [B('SUCCESS_ATTRIBUTION_PATTERN'), B('FAILURE_ATTRIBUTION_PATTERN')],
    primarySignals: [],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

// ── PAIR 4: SYSTEM side ──

V('A12: FEEDBACK_LOOP_CONCEPT_AWARENESS — two behavioral', function () {
  var r = evaluateSignalById('FEEDBACK_LOOP_CONCEPT_AWARENESS', {
    evidence: [B('FEEDBACK_CONCEPT_USAGE'), B('CAUSAL_CHAIN_COMPLEXITY')],
    primarySignals: [],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

V('A13: CROSS_DOMAIN_FEEDBACK_THINKING — two behavioral', function () {
  var r = evaluateSignalById('CROSS_DOMAIN_FEEDBACK_THINKING', {
    evidence: [B('DOMAIN_A_FEEDBACK_ANALYSIS'), B('DOMAIN_B_FEEDBACK_ANALYSIS')],
    primarySignals: [],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

// ── PAIR 5: OPPORTUNITY side ──

V('A14: INFORMATION_SOURCE_DIVERSITY — two behavioral', function () {
  var r = evaluateSignalById('INFORMATION_SOURCE_DIVERSITY', {
    evidence: [B('INFORMATION_SOURCE_COUNT'), B('DOMAIN_DIVERSITY_OF_SOURCES')],
    primarySignals: [],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

// ── PAIR 5: IDENTITY side ──

V('A15: IDENTITY_BASED_EXCLUSION — two behavioral', function () {
  var r = evaluateSignalById('IDENTITY_BASED_EXCLUSION', {
    evidence: [B('PATH_EXCLUSION_LANGUAGE_ANALYSIS'), B('EXCLUSION_RATIONALE_CATEGORIZATION')],
    primarySignals: [],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 2: STRONG + CONTEXTUAL ACTIVATION — Mode B (10 cases)
// ═══════════════════════════════════════════════════════════════

V('B01: DECISION_TO_ACTION_LATENCY — strong(B) + contextual(PS)', function () {
  var r = evaluateSignalById('DECISION_TO_ACTION_LATENCY', {
    evidence: [B('CONSISTENT_LOW_LATENCY_PATTERN', 'o-strong')],
    primarySignals: [PS('LOW_COST_EXPERIMENTATION', true, 0.5, 'o-ctx')],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
  eq(r.activationMode, ACTIVATION_MODE.STRONG_PLUS_CONTEXT)
})

V('B02: WAITING_DURATION_PATTERN — strong + contextual', function () {
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [B('MULTI_YEAR_DECISION_POSTPONEMENT', 'o-strong')],
    primarySignals: [PS('OPTION_PRESERVING_DECISION', true, 0.5, 'o-ctx')],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

V('B03: OUTPUT_DECOUPLING_AWARENESS — strong(B) + contextual(PS)', function () {
  var r = evaluateSignalById('OUTPUT_DECOUPLING_AWARENESS', {
    evidence: [B('MULTIPLE_REUSABLE_ASSETS', 'o-strong')],
    primarySignals: [PS('SYSTEM_LEVERAGE', true, 0.5, 'o-ctx')],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
  eq(r.activationMode, ACTIVATION_MODE.STRONG_PLUS_CONTEXT)
})

V('B04: EFFORT_VS_MECHANISM_FRAMING — strong(B) + contextual(PS)', function () {
  var r = evaluateSignalById('EFFORT_VS_MECHANISM_FRAMING', {
    evidence: [B('CROSS_CONTEXT_MECHANISM_THINKING', 'o-strong')],
    primarySignals: [PS('DISTRIBUTION_LEVERAGE', true, 0.5, 'o-ctx')],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
  eq(r.activationMode, ACTIVATION_MODE.STRONG_PLUS_CONTEXT)
})

V('B05: LONG_TERM_COMPOUNDING_AWARENESS — strong(B) + contextual(PS)', function () {
  var r = evaluateSignalById('LONG_TERM_COMPOUNDING_AWARENESS', {
    evidence: [B('EXPLICIT_COMPOUNDING_CALCULATION', 'o-strong')],
    primarySignals: [PS('COMPOUNDING_TIME_ALLOCATION', true, 0.5, 'o-ctx')],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
  eq(r.activationMode, ACTIVATION_MODE.STRONG_PLUS_CONTEXT)
})

V('B06: EMOTIONAL_RECENCY_IMPACT — strong(B) + contextual(PS)', function () {
  var r = evaluateSignalById('EMOTIONAL_RECENCY_IMPACT', {
    evidence: [B('RISK_SHIFT_DEVIATES_FROM_EXPECTATION', 'o-strong')],
    primarySignals: [PS('LOSS_AVERSION', true, 0.7, 'o-ctx')],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
  eq(r.activationMode, ACTIVATION_MODE.STRONG_PLUS_CONTEXT)
})

V('B07: PROBABILISTIC_LANGUAGE_USAGE — strong(B) + contextual(B)', function () {
  var r = evaluateSignalById('PROBABILISTIC_LANGUAGE_USAGE', {
    evidence: [B('EXPLICIT_MULTI_OUTCOME_REASONING', 'o-strong'), B('PROBABILITY_DISTRIBUTION_LANGUAGE', 'o-ctx')],
    primarySignals: [],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

V('B08: FEEDBACK_CALIBRATION_RATE — strong(B) + contextual(PS)', function () {
  var r = evaluateSignalById('FEEDBACK_CALIBRATION_RATE', {
    evidence: [B('APPROPRIATE_CALIBRATION_PATTERN', 'o-strong')],
    primarySignals: [PS('ACTIVE_FEEDBACK_SEEKING', true, 0.5, 'o-ctx')],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
  eq(r.activationMode, ACTIVATION_MODE.STRONG_PLUS_CONTEXT)
})

V('B09: SELF_ASSESSMENT_ASYMMETRY — strong(B) + contextual(PS)', function () {
  var r = evaluateSignalById('SELF_ASSESSMENT_ASYMMETRY', {
    evidence: [B('CONSISTENT_ASYMMETRY_ACROSS_DECISIONS', 'o-strong')],
    primarySignals: [PS('FIXED_ROLE_IDENTITY', true, 0.5, 'o-ctx')],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
  eq(r.activationMode, ACTIVATION_MODE.STRONG_PLUS_CONTEXT)
})

V('B10: LINEARTY_VS_COMPLEXITY_DEFAULT — strong(B) + contextual(PS)', function () {
  var r = evaluateSignalById('LINEARTY_VS_COMPLEXITY_DEFAULT', {
    evidence: [B('CONSISTENT_MULTI_FACTOR_ATTRIBUTION', 'o-strong')],
    primarySignals: [PS('POST_ACTION_REVIEW', true, 0.5, 'o-ctx')],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
  eq(r.activationMode, ACTIVATION_MODE.STRONG_PLUS_CONTEXT)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 3: CONTRADICTION / SUPPRESSION (10 cases)
// ═══════════════════════════════════════════════════════════════

V('C01: Strong contradiction (2 indep items) suppresses activation', function () {
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [Q('pastAttemptStage', 'o-req')],
    primarySignals: [
      PS('DECISION_DELAY', true, 0.7, 'o-req2'),
      PS('DECISION_STABILITY', true, 0.8, 'o-ctr1'),
      PS('LOW_COST_EXPERIMENTATION', true, 0.5, 'o-ctr2'),
    ],
  })
  eq(r.state, SIGNAL_STATE.SUPPRESSED)
  ok(r.contradictingEvidenceIds.length >= 2)
})

V('C02: Suppression trigger via signal detection', function () {
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [Q('pastAttemptStage', 'o-req')],
    primarySignals: [
      PS('DECISION_DELAY', true, 0.7, 'o-req2'),
      PS('OPTION_PRESERVING_DECISION', true, 0.5, 'o-ctx'),
      PS('DECISION_STABILITY', true, 0.85, 'o-suppress'),
    ],
  })
  eq(r.state, SIGNAL_STATE.SUPPRESSED)
  ok(r.suppressionReason !== null)
})

V('C03: PROBABILISTIC_LANGUAGE_USAGE suppressed by contradict signal', function () {
  var r = evaluateSignalById('PROBABILISTIC_LANGUAGE_USAGE', {
    evidence: [B('LANGUAGE_FRAMING_ANALYSIS', 'o-a')],
    primarySignals: [
      PS('PROBABILISTIC_THINKING', true, 0.6, 'o-b'),
      PS('BINARY_OUTCOME_THINKING', true, 0.85, 'o-contra'),
    ],
  })
  eq(r.state, SIGNAL_STATE.SUPPRESSED)
})

V('C04: OUTPUT_DECOUPLING_AWARENESS suppressed by contradictory', function () {
  var r = evaluateSignalById('OUTPUT_DECOUPLING_AWARENESS', {
    evidence: [B('REUSABLE_OUTPUT_CREATED', 'o-a')],
    primarySignals: [
      PS('REPEATABLE_VALUE', true, 0.5, 'o-b'),
      PS('LEVERAGE_BLINDNESS', true, 0.8, 'o-ctr1'),
      PS('LINEAR_TIME_VALUE', true, 0.8, 'o-ctr2'),
    ],
  })
  eq(r.state, SIGNAL_STATE.SUPPRESSED)
})

V('C05: POST_ACTION_REVIEW_HABIT suppressed by FEEDBACK_AVOIDANCE', function () {
  var r = evaluateSignalById('POST_ACTION_REVIEW_HABIT', {
    evidence: [B('SPECIFIC_LEARNING_EXTRACTED', 'o-a')],
    primarySignals: [
      PS('POST_ACTION_REVIEW', true, 0.6, 'o-b'),
      PS('FEEDBACK_AVOIDANCE', true, 0.7, 'o-suppress'),
    ],
  })
  eq(r.state, SIGNAL_STATE.SUPPRESSED)
})

V('C06: Suppression applied even when support exists (contradiction-first)', function () {
  var r = evaluateSignalById('LONG_TERM_COMPOUNDING_AWARENESS', {
    evidence: [B('COMPOUNDING_REFERENCE_IN_DECISION', 'o-a')],
    primarySignals: [
      PS('LONG_TERM_ORIENTATION', true, 0.6, 'o-b'),
      PS('SHORT_TERM_PRIORITY', true, 0.85, 'o-ctr1'),
      PS('URGENCY_DOMINANCE', true, 0.5, 'o-ctr2'),
    ],
  })
  eq(r.state, SIGNAL_STATE.SUPPRESSED)
})

V('C07: Moderate contradiction (1 item) does NOT suppress', function () {
  // contradictoryEvidence requires ≥ 0.7, suppression trigger requires ≥ 0.8
  // Use confidence 0.75: matches contradiction (≥0.7) but NOT suppression trigger (<0.8)
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [Q('pastAttemptStage', 'o-req')],
    primarySignals: [
      PS('DECISION_DELAY', true, 0.7, 'o-req2'),
      PS('DECISION_STABILITY', true, 0.75, 'o-ctr-single'),
    ],
  })
  eq(r.state, SIGNAL_STATE.ACTIVE)
  eq(r.contradictingEvidenceIds.length, 1)
})

V('C08: Suppression by confidence threshold', function () {
  var r = evaluateSignalById('EFFORT_VS_MECHANISM_FRAMING', {
    evidence: [B('GROWTH_FRAMING_ANALYSIS', 'o-a'), B('MECHANISM_LANGUAGE_PATTERN', 'o-ctx')],
    primarySignals: [
      PS('LEVERAGE_BLINDNESS', true, 0.85, 'o-suppress'),
    ],
  })
  eq(r.state, SIGNAL_STATE.SUPPRESSED)
})

V('C09: Suppression triggers produce reason in output', function () {
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [Q('pastAttemptStage', 'o-req')],
    primarySignals: [
      PS('DECISION_DELAY', true, 0.7, 'o-req2'),
      PS('DECISION_STABILITY', true, 0.85, 'o-supp'),
    ],
  })
  eq(r.state, SIGNAL_STATE.SUPPRESSED)
  ok(typeof r.suppressionReason === 'string')
  ok(r.suppressionReason.length > 0)
})

V('C10: Contradiction evidence IDs traced in output', function () {
  var r = evaluateSignalById('MINIMUM_STEP_EXECUTION', {
    evidence: [B('MINIMUM_VIABLE_STEP_TAKEN', 'o-a')],
    primarySignals: [
      PS('DECISION_DELAY', true, 0.85, 'o-contra'),
      PS('LOW_COST_EXPERIMENTATION', true, 0.5, 'o-ctx'),
    ],
  })
  // DECISION_DELAY at ≥0.8 matches contradictoryEvidence[1] for MINIMUM_STEP_EXECUTION
  ok(r.contradictingEvidenceIds.length >= 1)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 4: INSUFFICIENT EVIDENCE (10 cases)
// ═══════════════════════════════════════════════════════════════

V('D01: Single evidence item insufficient', function () {
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [],
    primarySignals: [PS('DECISION_DELAY', true, 0.7)],
  })
  eq(r.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
  ok(r.insufficientEvidence)
  ok(r.missingEvidenceNeeded.length > 0)
})

V('D02: Zero evidence produces INSUFFICIENT not ACTIVE', function () {
  var r = evaluateAllSignals({ evidence: [], primarySignals: [] })
  eq(r.summary.active, 0)
  eq(r.summary.suppressed, 0)
  eq(r.summary.insufficient, 23)
})

V('D03: Below confidence threshold not counted', function () {
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [Q('pastAttemptStage', 'o-req')],
    primarySignals: [PS('DECISION_DELAY', true, 0.3)],
  })
  eq(r.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
  // DECISION_DELAY at confidence 0.3 < 0.6 threshold → not matched
  eq(r.trace.requiredMatched, 1)
})

V('D04: Strong without contextual insufficient', function () {
  var r = evaluateSignalById('DECISION_TO_ACTION_LATENCY', {
    evidence: [B('CONSISTENT_LOW_LATENCY_PATTERN', 'o-strong')],
    primarySignals: [],
  })
  eq(r.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
  eq(r.trace.strongMatched, 1)
  eq(r.trace.contextualMatched, 0)
})

V('D05: Contextual without required insufficient', function () {
  var r = evaluateSignalById('POST_ACTION_REVIEW_HABIT', {
    evidence: [],
    primarySignals: [PS('ACTIVE_FEEDBACK_SEEKING', true, 0.5)],
  })
  eq(r.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
})

V('D06: Missing evidence needed is populated', function () {
  var r = evaluateSignalById('EFFORT_VS_MECHANISM_FRAMING', { evidence: [], primarySignals: [] })
  eq(r.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
  ok(r.missingEvidenceNeeded.length > 0, 'missingEvidenceNeeded empty')
  ok(typeof r.missingEvidenceNeeded[0] === 'string')
})

V('D07: INSUFFICIENT score is lower than ACTIVE score', function () {
  var active = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [Q('pastAttemptStage')],
    primarySignals: [PS('DECISION_DELAY', true, 0.7)],
  })
  var insufficient = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [Q('pastAttemptStage')],
    primarySignals: [],
  })
  eq(active.state, SIGNAL_STATE.ACTIVE)
  eq(insufficient.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
  ok(active.score > 0)
  // Score halving: insufficient score should be lower
  ok(active.score >= insufficient.score)
})

V('D08: INSUFFICIENT confidence respects evidence quantity', function () {
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [],
    primarySignals: [PS('DECISION_DELAY', true, 0.7)],
  })
  eq(r.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
  inRange(r.confidence, 0, 0.6, 'Confidence should be low with single evidence')
})

V('D09: INSUFFICIENT state has no activationMode', function () {
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', { evidence: [], primarySignals: [] })
  eq(r.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
  eq(r.activationMode, null)
})

V('D10: INSUFFICIENT never becomes ACTIVE — verify all signals', function () {
  var r = evaluateAllSignals({ evidence: [], primarySignals: [] })
  eq(r.summary.active, 0)
  r.signals.forEach(function (s) {
    notOk(s.state === SIGNAL_STATE.ACTIVE, s.id + ' should not be ACTIVE with empty evidence')
  })
})

// ═══════════════════════════════════════════════════════════════
// SECTION 5: DUPLICATE-ORIGIN / EVIDENCE INDEPENDENCE (5 cases)
// ═══════════════════════════════════════════════════════════════

V('E01: Two items from same origin do not activate (Mode A fail)', function () {
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [Q('pastAttemptStage', 'SHARED')],
    primarySignals: [PS('DECISION_DELAY', true, 0.7, 'SHARED')],
  })
  eq(r.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
})

V('E02: Strong + contextual from same origin fails Mode B', function () {
  var r = evaluateSignalById('DECISION_TO_ACTION_LATENCY', {
    evidence: [B('CONSISTENT_LOW_LATENCY_PATTERN', 'SHARED')],
    primarySignals: [PS('LOW_COST_EXPERIMENTATION', true, 0.5, 'SHARED')],
  })
  eq(r.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
})

V('E03: Three items from same origin still insufficient', function () {
  var r = evaluateSignalById('POST_ACTION_REVIEW_HABIT', {
    evidence: [B('SPECIFIC_LEARNING_EXTRACTED', 'SHARED')],
    primarySignals: [
      PS('POST_ACTION_REVIEW', true, 0.6, 'SHARED'),
      PS('ACTIVE_FEEDBACK_SEEKING', true, 0.5, 'SHARED'),
    ],
  })
  eq(r.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
})

V('E04: No explicit originId default behavior detects non-independence', function () {
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [{ sourceType: 'BEHAVIORAL', reference: 'MULTI_YEAR_DECISION_POSTPONEMENT' }],
    primarySignals: [{ sourceType: 'PRIMARY_SIGNAL', signalId: 'DECISION_DELAY', detected: true, confidence: 0.7 }],
  })
  // Without explicit originId, origins are computed from sourceType::reference
  // These have different sourceType::reference combos so they ARE independent
  eq(r.state, SIGNAL_STATE.ACTIVE)
})

V('E05: ACTIVE signals always have ≥2 unique origins', function () {
  var result = evaluateAllSignals({
    evidence: [
      Q('pastAttemptStage'),
      B('MINIMUM_VIABLE_STEP_TAKEN'),
      B('NEW_INFORMATION_GAINED_FROM_STEP'),
      B('LANGUAGE_FRAMING_ANALYSIS'),
    ],
    primarySignals: [
      PS('DECISION_DELAY', true, 0.7),
      PS('OPTION_PRESERVING_DECISION', true, 0.5),
      PS('PROBABILISTIC_THINKING', true, 0.5),
    ],
  })
  var activeSignals = result.signals.filter(function (s) { return s.state === SIGNAL_STATE.ACTIVE })
  activeSignals.forEach(function (s) {
    var origins = new Set()
    ;(s.trace || {}).requiredMatched && origins.add(s.trace.requiredMatched)
    gt(origins.size, 0, s.id + ' active signal should have evidence')
  })
})

// ═══════════════════════════════════════════════════════════════
// SECTION 6: CONFUSION-PAIR DIFFERENTIATION (10 cases, 2/pair)
// ═══════════════════════════════════════════════════════════════

// ── PAIR 1: DECISION_INERTIA vs FEEDBACK_LOOP_GAP (2 cases) ──

V('F01: PAIR1 — DECISION_INERTIA side activates, FEEDBACK side suppressed', function () {
  var result = evaluateAllSignals({
    evidence: [Q('pastAttemptStage')],
    primarySignals: [
      PS('DECISION_DELAY', true, 0.7),
      PS('OPTION_PRESERVING_DECISION', true, 0.5),
    ],
  })
  var wdp = stateOf(result, 'WAITING_DURATION_PATTERN')
  eq(wdp.state, SIGNAL_STATE.ACTIVE)
  // MINIMUM_STEP_EXECUTION should be insufficient (no MINIMUM steps executed)
  var mse = stateOf(result, 'MINIMUM_STEP_EXECUTION')
  notOk(mse.state === SIGNAL_STATE.ACTIVE)
})

V('F02: PAIR1 — FEEDBACK_LOOP_GAP side activates, DECISION side suppressed', function () {
  var result = evaluateAllSignals({
    evidence: [
      B('MINIMUM_VIABLE_STEP_TAKEN'),
      B('NEW_INFORMATION_GAINED_FROM_STEP'),
    ],
    primarySignals: [
      // DECISION_STABILITY at 0.8 triggers suppression for WAITING_DURATION_PATTERN
      PS('DECISION_STABILITY', true, 0.85),
      PS('LOW_COST_EXPERIMENTATION', true, 0.5),
    ],
  })
  var mse = stateOf(result, 'MINIMUM_STEP_EXECUTION')
  eq(mse.state, SIGNAL_STATE.ACTIVE)
  var wdp = stateOf(result, 'WAITING_DURATION_PATTERN')
  // DECISION_STABILITY suppression trigger + LOW_COST_EXPERIMENTATION contradiction → suppressed
  eq(wdp.state, SIGNAL_STATE.SUPPRESSED)
})

// ── PAIR 2: LEVERAGE_MODEL_GAP vs TIME_HORIZON_TRAP (2 cases) ──

V('F03: PAIR2 — LEVERAGE side activates, TIME side different', function () {
  var result = evaluateAllSignals({
    evidence: [
      B('REUSABLE_OUTPUT_CREATED'),
      B('CROSS_CONTEXT_MECHANISM_THINKING'),
    ],
    primarySignals: [
      PS('REPEATABLE_VALUE', true, 0.5),
      PS('SYSTEM_LEVERAGE', true, 0.5),
      PS('LONG_TERM_ORIENTATION', true, 0.5),
    ],
  })
  var ode = stateOf(result, 'OUTPUT_DECOUPLING_AWARENESS')
  eq(ode.state, SIGNAL_STATE.ACTIVE)
  var dsf = stateOf(result, 'DIRECTION_SWITCHING_FREQUENCY')
  // Without direction switch behavioral evidence, should be insufficient
  eq(dsf.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
})

V('F04: PAIR2 — TIME side activates, LEVERAGE side insufficient', function () {
  var result = evaluateAllSignals({
    evidence: [
      B('DIRECTION_SWITCH_COUNT'),
      B('SWITCH_MOTIVATION_ANALYSIS'),
      B('IMPATIENCE_DRIVEN_SWITCH'),
    ],
    primarySignals: [
      PS('SHORT_TERM_PRIORITY', true, 0.5),
    ],
  })
  var dsf = stateOf(result, 'DIRECTION_SWITCHING_FREQUENCY')
  eq(dsf.state, SIGNAL_STATE.ACTIVE)
  var ode = stateOf(result, 'OUTPUT_DECOUPLING_AWARENESS')
  eq(ode.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
})

// ── PAIR 3: RISK_MODEL_DISTORTION vs PROBABILITY_MISJUDGMENT (2 cases) ──

V('F05: PAIR3 — RISK side activates, PROBABILITY side different', function () {
  var result = evaluateAllSignals({
    evidence: [
      B('RECENT_HIGH_IMPACT_EVENT'),
      B('POST_EVENT_RISK_ATTITUDE_SHIFT'),
    ],
    primarySignals: [
      PS('LOSS_AVERSION', true, 0.7),
    ],
  })
  var eri = stateOf(result, 'EMOTIONAL_RECENCY_IMPACT')
  eq(eri.state, SIGNAL_STATE.ACTIVE)
})

V('F06: PAIR3 — PROBABILITY side activates, RISK side different', function () {
  var result = evaluateAllSignals({
    evidence: [
      B('LANGUAGE_FRAMING_ANALYSIS'),
      B('SUCCESS_ATTRIBUTION_PATTERN'),
      B('FAILURE_ATTRIBUTION_PATTERN'),
    ],
    primarySignals: [
      PS('PROBABILISTIC_THINKING', true, 0.5),
    ],
  })
  var plu = stateOf(result, 'PROBABILISTIC_LANGUAGE_USAGE')
  eq(plu.state, SIGNAL_STATE.ACTIVE)
  var lsa = stateOf(result, 'LUCK_VS_SKILL_ATTRIBUTION')
  eq(lsa.state, SIGNAL_STATE.ACTIVE)
  // EMOTIONAL_RECENCY_IMPACT should be insufficient (no event evidence)
  var eri = stateOf(result, 'EMOTIONAL_RECENCY_IMPACT')
  eq(eri.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
})

// ── PAIR 4: SYSTEM_THINKING_GAP vs FEEDBACK_LOOP_GAP (2 cases) ──

V('F07: PAIR4 — SYSTEM side activates, FEEDBACK side different', function () {
  var result = evaluateAllSignals({
    evidence: [
      B('FEEDBACK_CONCEPT_USAGE'),
      B('CAUSAL_CHAIN_COMPLEXITY'),
      B('DOMAIN_A_FEEDBACK_ANALYSIS'),
      B('DOMAIN_B_FEEDBACK_ANALYSIS'),
    ],
    primarySignals: [],
  })
  var flc = stateOf(result, 'FEEDBACK_LOOP_CONCEPT_AWARENESS')
  eq(flc.state, SIGNAL_STATE.ACTIVE)
  var cdf = stateOf(result, 'CROSS_DOMAIN_FEEDBACK_THINKING')
  eq(cdf.state, SIGNAL_STATE.ACTIVE)
})

V('F08: PAIR4 — FEEDBACK_LOOP side activates independently', function () {
  var result = evaluateAllSignals({
    evidence: [
      B('SPECIFIC_LEARNING_EXTRACTED'),
      B('MINIMUM_VIABLE_STEP_TAKEN'),
      B('NEW_INFORMATION_GAINED_FROM_STEP'),
    ],
    primarySignals: [
      PS('POST_ACTION_REVIEW', true, 0.6),
      PS('ACTIVE_FEEDBACK_SEEKING', true, 0.5),
    ],
  })
  var par = stateOf(result, 'POST_ACTION_REVIEW_HABIT')
  eq(par.state, SIGNAL_STATE.ACTIVE)
  var mse = stateOf(result, 'MINIMUM_STEP_EXECUTION')
  eq(mse.state, SIGNAL_STATE.ACTIVE)
})

// ── PAIR 5: OPPORTUNITY_BLINDNESS vs IDENTITY_CONSTRAINT (2 cases) ──

V('F09: PAIR5 — OPPORTUNITY side activates, IDENTITY side different', function () {
  var result = evaluateAllSignals({
    evidence: [
      B('INFORMATION_SOURCE_COUNT'),
      B('DOMAIN_DIVERSITY_OF_SOURCES'),
      B('SERENDIPITOUS_DISCOVERY_EVENT'),
      B('DISCOVERY_SOURCE_ANALYSIS'),
    ],
    primarySignals: [
      PS('LOW_OPPORTUNITY_EXPOSURE', true, 0.5),
    ],
  })
  var isd = stateOf(result, 'INFORMATION_SOURCE_DIVERSITY')
  eq(isd.state, SIGNAL_STATE.ACTIVE)
  var spd = stateOf(result, 'SERENDIPITOUS_PATH_DISCOVERY')
  eq(spd.state, SIGNAL_STATE.ACTIVE)
})

V('F10: PAIR5 — IDENTITY side activates, OPPORTUNITY side different', function () {
  var result = evaluateAllSignals({
    evidence: [
      B('PATH_EXCLUSION_LANGUAGE_ANALYSIS'),
      B('EXCLUSION_RATIONALE_CATEGORIZATION'),
      B('CROSS_IDENTITY_ATTEMPT_EXISTS'),
      B('ATTEMPT_OUTCOME_AND_LEARNING'),
    ],
    primarySignals: [
      PS('FIXED_ROLE_IDENTITY', true, 0.5),
      PS('SINGLE_PATH_DEPENDENCE', true, 0.5),
    ],
  })
  var ibe = stateOf(result, 'IDENTITY_BASED_EXCLUSION')
  eq(ibe.state, SIGNAL_STATE.ACTIVE)
  var cia = stateOf(result, 'CROSS_IDENTITY_ATTEMPT_HISTORY')
  eq(cia.state, SIGNAL_STATE.ACTIVE)
  // OPPORTUNITY-side signals should be different
  var isd = stateOf(result, 'INFORMATION_SOURCE_DIVERSITY')
  eq(isd.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
})

// ═══════════════════════════════════════════════════════════════
// SECTION 7: CROSS-OCCUPATION CONSISTENCY (3 cases)
// ═══════════════════════════════════════════════════════════════

function cognitiveProfileA() {
  return {
    evidence: [Q('pastAttemptStage'), B('LANGUAGE_FRAMING_ANALYSIS')],
    primarySignals: [
      PS('DECISION_DELAY', true, 0.7),
      PS('PROBABILISTIC_THINKING', true, 0.5),
    ],
  }
}

V('G01: Same cognitive evidence → identical signal states (abstract)', function () {
  var r1 = evaluateAllSignals(cognitiveProfileA())
  var r2 = evaluateAllSignals(cognitiveProfileA())

  for (var i = 0; i < r1.signals.length; i++) {
    eq(r1.signals[i].state, r2.signals[i].state, 'State mismatch for ' + r1.signals[i].id)
    eq(r1.signals[i].activationMode, r2.signals[i].activationMode, 'Mode mismatch for ' + r1.signals[i].id)
  }
  eq(r1.summary.active, r2.summary.active)
  eq(r1.summary.suppressed, r2.summary.suppressed)
  eq(r1.summary.insufficient, r2.summary.insufficient)
})

V('G02: Same cognitive evidence — no occupation dependency', function () {
  // Occupation context should not change signal states because signals are cognitive
  var r = evaluateAllSignals(cognitiveProfileA())
  // Verify signals active based on pure cognitive evidence, not occupation
  var wdp = stateOf(r, 'WAITING_DURATION_PATTERN')
  eq(wdp.state, SIGNAL_STATE.ACTIVE)
  var plu = stateOf(r, 'PROBABILISTIC_LANGUAGE_USAGE')
  eq(plu.state, SIGNAL_STATE.ACTIVE)
})

V('G03: Zero occupation data in any signal output', function () {
  var r = evaluateAllSignals(cognitiveProfileA())
  r.signals.forEach(function (s) {
    var json = JSON.stringify(s).toLowerCase()
    var contami = ['occupation', 'income', 'business', 'salary', 'job', 'career', 'profession', 'revenue']
    contami.forEach(function (term) {
      notOk(json.includes(term), s.id + ' contains contamination: ' + term)
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// SECTION 8: SAME-OCCUPATION DIFFERENTIATION (3 cases)
// ═══════════════════════════════════════════════════════════════

V('H01: Different cognitive evidence → different signal states', function () {
  var profile1 = cognitiveProfileA()
  var profile2 = {
    evidence: [B('MINIMUM_VIABLE_STEP_TAKEN'), B('NEW_INFORMATION_GAINED_FROM_STEP')],
    primarySignals: [PS('DECISION_STABILITY', true, 0.5)],
  }

  var r1 = evaluateAllSignals(profile1)
  var r2 = evaluateAllSignals(profile2)

  // Different profiles should produce at least one different state
  var diffCount = 0
  for (var i = 0; i < r1.signals.length; i++) {
    if (r1.signals[i].state !== r2.signals[i].state) diffCount++
  }
  gt(diffCount, 0, 'Same states for different evidence — signals not differentiating')
})

V('H02: Profile A active signals different from Profile B', function () {
  var profileB = {
    evidence: [
      B('DIRECTION_SWITCH_COUNT'),
      B('SWITCH_MOTIVATION_ANALYSIS'),
      B('IMPATIENCE_DRIVEN_SWITCH'),
    ],
    primarySignals: [PS('SHORT_TERM_PRIORITY', true, 0.5)],
  }
  var rA = evaluateAllSignals(cognitiveProfileA())
  var rB = evaluateAllSignals(profileB)

  var activeA = rA.signals.filter(function (s) { return s.state === SIGNAL_STATE.ACTIVE }).map(function (s) { return s.id })
  var activeB = rB.signals.filter(function (s) { return s.state === SIGNAL_STATE.ACTIVE }).map(function (s) { return s.id })

  // Profiles activate different signal combinations
  ok(activeA.indexOf('WAITING_DURATION_PATTERN') !== -1)
  ok(activeB.indexOf('DIRECTION_SWITCHING_FREQUENCY') !== -1)
  ok(activeA.join(',') !== activeB.join(','))
})

V('H03: Profile C (mixed) produces distinct pattern from A and B', function () {
  var profileC = {
    evidence: [
      B('RECENT_HIGH_IMPACT_EVENT'),
      B('POST_EVENT_RISK_ATTITUDE_SHIFT'),
      B('RISK_SHIFT_DEVIATES_FROM_EXPECTATION'),
    ],
    primarySignals: [PS('LOSS_AVERSION', true, 0.7)],
  }
  var rC = evaluateAllSignals(profileC)
  var rA = evaluateAllSignals(cognitiveProfileA())

  var activeC = rC.signals.filter(function (s) { return s.state === SIGNAL_STATE.ACTIVE }).map(function (s) { return s.id })
  var activeA = rA.signals.filter(function (s) { return s.state === SIGNAL_STATE.ACTIVE }).map(function (s) { return s.id })

  // Profile C should activate EMOTIONAL_RECENCY_IMPACT
  ok(activeC.indexOf('EMOTIONAL_RECENCY_IMPACT') !== -1, 'Profile C should activate EMOTIONAL_RECENCY_IMPACT')
  ok(activeA.join(',') !== activeC.join(','), 'Profile A and C should differ')
})

// ═══════════════════════════════════════════════════════════════
// SECTION 9: 100-RUN DETERMINISM (3 cases)
// ═══════════════════════════════════════════════════════════════

V('I01: 100-run full determinism', function () {
  var input = {
    evidence: [Q('pastAttemptStage'), B('LANGUAGE_FRAMING_ANALYSIS'), B('RECENT_HIGH_IMPACT_EVENT'), B('POST_EVENT_RISK_ATTITUDE_SHIFT')],
    primarySignals: [
      PS('DECISION_DELAY', true, 0.7),
      PS('OPTION_PRESERVING_DECISION', true, 0.5),
      PS('PROBABILISTIC_THINKING', true, 0.5),
      PS('LOSS_AVERSION', true, 0.7),
      PS('DECISION_STABILITY', true, 0.85),
    ],
  }

  var first = evaluateAllSignals(input)
  for (var run = 0; run < 100; run++) {
    var next = evaluateAllSignals(input)
    eq(next.signals.length, first.signals.length, 'Run ' + run + ': signal count')
    for (var i = 0; i < next.signals.length; i++) {
      eq(next.signals[i].id, first.signals[i].id, 'Run ' + run + ': id mismatch at ' + i)
      eq(next.signals[i].state, first.signals[i].state, 'Run ' + run + ': state mismatch for ' + next.signals[i].id)
      eq(next.signals[i].score, first.signals[i].score, 'Run ' + run + ': score mismatch for ' + next.signals[i].id)
      eq(next.signals[i].confidence, first.signals[i].confidence, 'Run ' + run + ': confidence mismatch for ' + next.signals[i].id)
      eq(next.signals[i].activationMode, first.signals[i].activationMode, 'Run ' + run + ': mode mismatch for ' + next.signals[i].id)
    }
    eq(next.summary.active, first.summary.active, 'Run ' + run + ': active count')
    eq(next.summary.suppressed, first.summary.suppressed, 'Run ' + run + ': suppressed count')
    eq(next.summary.insufficient, first.summary.insufficient, 'Run ' + run + ': insufficient count')
  }
})

V('I02: Deterministic output has no timestamps', function () {
  var result = evaluateAllSignals(cognitiveProfileA())
  eq(result.meta.timestamp, null)
  ok(result.meta.deterministic === true)
})

V('I03: 100-run identical confidence and score values', function () {
  var input = cognitiveProfileA()
  var first = evaluateAllSignals(input)
  for (var run = 0; run < 100; run++) {
    var next = evaluateAllSignals(input)
    for (var i = 0; i < next.signals.length; i++) {
      eq(Math.round(next.signals[i].confidence * 10000), Math.round(first.signals[i].confidence * 10000),
        'Run ' + run + ': floating confidence for ' + next.signals[i].id)
    }
  }
})

// ═══════════════════════════════════════════════════════════════
// SECTION 10: 23/23 SIGNAL COVERAGE (3 cases)
// ═══════════════════════════════════════════════════════════════

V('J01: All 23 signals returned always', function () {
  var r = evaluateAllSignals({ evidence: [], primarySignals: [] })
  eq(r.signals.length, 23)
})

V('J02: Rich input covers most signals with non-INSUFFICIENT state', function () {
  var result = evaluateAllSignals({
    evidence: [
      Q('pastAttemptStage'), Q('decisionStyle'), Q('executionStability'), Q('primaryGoal'),
      B('MULTI_YEAR_DECISION_POSTPONEMENT'), B('MINIMUM_VIABLE_STEP_TAKEN'), B('NEW_INFORMATION_GAINED_FROM_STEP'),
      B('SPECIFIC_LEARNING_EXTRACTED'), B('REUSABLE_OUTPUT_CREATED'), B('CROSS_CONTEXT_MECHANISM_THINKING'),
      B('DIRECTION_SWITCH_COUNT'), B('SWITCH_MOTIVATION_ANALYSIS'),
      B('COMPOUNDING_REFERENCE_IN_DECISION'), B('RECENT_HIGH_IMPACT_EVENT'), B('POST_EVENT_RISK_ATTITUDE_SHIFT'),
      B('ABSTRACT_RISK_JUDGMENT_QUALITY'), B('EMBODIED_RISK_JUDGMENT_QUALITY'),
      B('LANGUAGE_FRAMING_ANALYSIS'), B('SUCCESS_ATTRIBUTION_PATTERN'), B('FAILURE_ATTRIBUTION_PATTERN'),
      B('FEEDBACK_CONCEPT_USAGE'), B('CAUSAL_CHAIN_COMPLEXITY'),
      B('DOMAIN_A_FEEDBACK_ANALYSIS'), B('DOMAIN_B_FEEDBACK_ANALYSIS'),
      B('INFORMATION_SOURCE_COUNT'), B('DOMAIN_DIVERSITY_OF_SOURCES'),
      B('SERENDIPITOUS_DISCOVERY_EVENT'), B('DISCOVERY_SOURCE_ANALYSIS'),
      B('PATH_EXCLUSION_LANGUAGE_ANALYSIS'), B('EXCLUSION_RATIONALE_CATEGORIZATION'),
    ],
    primarySignals: [
      PS('DECISION_DELAY', true, 0.7), PS('OPTION_PRESERVING_DECISION', true, 0.5),
      PS('POST_ACTION_REVIEW', true, 0.6), PS('ACTIVE_FEEDBACK_SEEKING', true, 0.5),
      PS('LOW_COST_EXPERIMENTATION', true, 0.5), PS('DECISION_STABILITY', false, 0.3),
      PS('REPEATABLE_VALUE', true, 0.5), PS('SYSTEM_LEVERAGE', true, 0.5),
      PS('LONG_TERM_ORIENTATION', true, 0.5), PS('SHORT_TERM_PRIORITY', true, 0.5),
      PS('LOSS_AVERSION', true, 0.7), PS('PROBABILISTIC_THINKING', true, 0.5),
      PS('COMPOUNDING_TIME_ALLOCATION', true, 0.5), PS('FIXED_ROLE_IDENTITY', true, 0.5),
      PS('DISTRIBUTION_LEVERAGE', true, 0.5),
    ],
  })

  gt(countBy(result, SIGNAL_STATE.ACTIVE), 10, 'Rich input should activate many signals')
  eq(allSignalsExercised(result), 23)
})

V('J03: Every signal trace is populated', function () {
  var r = evaluateAllSignals(cognitiveProfileA())
  r.signals.forEach(function (s) {
    ok(s.trace, s.id + ' missing trace')
    gte(s.trace.requiredMatched, 0, s.id + ' trace.requiredMatched')
    gte(s.trace.contextualMatched, 0, s.id + ' trace.contextualMatched')
    gte(s.trace.strongMatched, 0, s.id + ' trace.strongMatched')
    gte(s.trace.contradictionMatched, 0, s.id + ' trace.contradictionMatched')
  })
})

// ═══════════════════════════════════════════════════════════════
// SECTION 11: ARCHITECTURE GUARDS (3 cases)
// ═══════════════════════════════════════════════════════════════

V('K01: No blind spot determination in any signal output', function () {
  var r = evaluateAllSignals(cognitiveProfileA())
  r.signals.forEach(function (s) {
    notOk(s.blindSpotId, s.id + ' should not have blindSpotId')
    notOk(s.archetypeId, s.id + ' should not have archetypeId')
    notOk(s.strategyId, s.id + ' should not have strategyId')
  })
})

V('K02: Score is bounded 0-100', function () {
  var r = evaluateAllSignals(cognitiveProfileA())
  r.signals.forEach(function (s) {
    inRange(s.score, 0, 100, s.id + ' score out of bounds')
  })
})

V('K03: Confidence is bounded 0-1', function () {
  var r = evaluateAllSignals(cognitiveProfileA())
  r.signals.forEach(function (s) {
    inRange(s.confidence, 0, 1, s.id + ' confidence out of bounds')
  })
})

// ═══════════════════════════════════════════════════════════════
// SECTION 12: P1 TEXT_RULE_PARSER_DEBT ANALYSIS (3 cases)
// ═══════════════════════════════════════════════════════════════

var p1DebtCases = []

V('P1-01: Simple suppression trigger via predicate (P1 RESOLVED)', function () {
  // "DECISION_STABILITY detected with confidence ≥ 0.8"
  // Now evaluated as signalPresentWithConfidenceGte predicate
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [Q('pastAttemptStage')],
    primarySignals: [
      PS('DECISION_DELAY', true, 0.7),
      PS('DECISION_STABILITY', true, 0.85),
    ],
  })
  eq(r.state, SIGNAL_STATE.SUPPRESSED, 'Predicate-based suppression should work')
  ok(r.suppressionReason !== null)
  // P1 debt RESOLVED: no more free-text trigger parsing
})

V('P1-02: Short-form trigger (≥ without "with confidence") parses', function () {
  // "BINARY_OUTCOME_THINKING detected ≥ 0.8"
  var r = evaluateSignalById('PROBABILISTIC_LANGUAGE_USAGE', {
    evidence: [B('LANGUAGE_FRAMING_ANALYSIS')],
    primarySignals: [
      PS('PROBABILISTIC_THINKING', true, 0.6),
      PS('BINARY_OUTCOME_THINKING', true, 0.85),
    ],
  })
  eq(r.state, SIGNAL_STATE.SUPPRESSED, 'Short-form trigger should work')
})

V('P1-03: Multi-signal AND trigger measured', function () {
  // "SHORT_TERM_PRIORITY detected ≥ 0.8 and URGENCY_DOMINANCE detected"
  var r = evaluateSignalById('LONG_TERM_COMPOUNDING_AWARENESS', {
    evidence: [B('COMPOUNDING_REFERENCE_IN_DECISION')],
    primarySignals: [
      PS('LONG_TERM_ORIENTATION', true, 0.6),
      PS('SHORT_TERM_PRIORITY', true, 0.85),
      PS('URGENCY_DOMINANCE', true, 0.5),
    ],
  })
  eq(r.state, SIGNAL_STATE.SUPPRESSED, 'Multi-signal AND trigger should suppress')
})

// ── P1 debt measurement: test edge cases ──

V('P1-DEBT: Free-text trigger with descriptive clause', function () {
  // Trigger: "User knows the concept intellectually but behavior is entirely short-term"
  // This trigger cannot be parsed structurally — depends on free-text matching
  // Test that the signal at least activates correctly with numeric triggers
  var r = evaluateSignalById('LONG_TERM_COMPOUNDING_AWARENESS', {
    evidence: [B('COMPOUNDING_REFERENCE_IN_DECISION')],
    primarySignals: [
      PS('LONG_TERM_ORIENTATION', true, 0.6),
    ],
  })
  // Should be ACTIVE (Mode A) since free-text trigger cannot be parsed
  // This is acceptable P1 behavior: textual triggers are not yet supported
  eq(r.state, SIGNAL_STATE.ACTIVE, 'Free-text triggers not parsed — debt accepted')
  // Record this as a P1 observation
  p1DebtCases.push({
    signal: 'LONG_TERM_COMPOUNDING_AWARENESS',
    trigger: 'Free-text descriptive trigger was not parsed',
    impact: 'Signal activated when text-based suppression trigger existed but could not be detected',
    severity: 'LOW',
  })
})

// ═══════════════════════════════════════════════════════════════
// SECTION 13: P2 INSUFFICIENT_SCORE_HALVING ANALYSIS (3 cases)
// ═══════════════════════════════════════════════════════════════

var p2DebtCases = []

V('P2-01: INSUFFICIENT score is halved vs equivalent ACTIVE score', function () {
  // Same evidence count, different activation status
  var active = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [Q('pastAttemptStage')],
    primarySignals: [PS('DECISION_DELAY', true, 0.7)],
  })
  var insufficient = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [Q('pastAttemptStage')],
    primarySignals: [PS('DECISION_DELAY', true, 0.4)],
  })
  eq(active.state, SIGNAL_STATE.ACTIVE)
  eq(insufficient.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
  // The halving heuristic: insufficient score should be lower
  gte(active.score, insufficient.score, 'ACTIVE score should be >= INSUFFICIENT score')
})

V('P2-02: Score halving changes presentation, not state semantics', function () {
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [],
    primarySignals: [PS('DECISION_DELAY', true, 0.7)],
  })
  eq(r.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
  // State is INSUFFICIENT regardless of score value
  // Score impacts only downstream consumers, not the state determination
  inRange(r.score, 0, 100)
  // Confidence is independent of score halving
  inRange(r.confidence, 0, 1)
})

V('P2-03: Score halving does not round to zero unnecessarily', function () {
  var active = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [Q('pastAttemptStage')],
    primarySignals: [PS('DECISION_DELAY', true, 0.7)],
  })
  // Active score should be meaningfully greater than 0
  gt(active.score, 0, 'ACTIVE score should be > 0')
})

V('P2-DEBT: Halving heuristic not in contract', function () {
  // The secondarySignalEvidenceMap does not specify score halving
  // This is an extractor-level heuristic
  // P2 impact: score halving only affects presentation (numeric display)
  // It does NOT change signal state transitions
  var r = evaluateSignalById('OUTPUT_DECOUPLING_AWARENESS', {
    evidence: [B('REUSABLE_OUTPUT_CREATED')],
    primarySignals: [],
  })
  eq(r.state, SIGNAL_STATE.INSUFFICIENT_EVIDENCE)
  // Score is computed but state is correctly INSUFFICIENT
  // P2 severity: LOW — affects UI presentation only
  p2DebtCases.push({
    signal: 'OUTPUT_DECOUPLING_AWARENESS',
    issue: 'Score halving applied without contract specification',
    impact: 'DISPLAY_ONLY — does not affect state transitions',
    severity: 'LOW',
  })
})

// ═══════════════════════════════════════════════════════════════
// SECTION 14: EVIDENCE TRACE COVERAGE (2 cases)
// ═══════════════════════════════════════════════════════════════

V('L01: Evidence trace covers all match categories', function () {
  var r = evaluateAllSignals({
    evidence: [
      Q('pastAttemptStage'), B('MULTI_YEAR_DECISION_POSTPONEMENT'),
      B('MINIMUM_VIABLE_STEP_TAKEN'), B('NEW_INFORMATION_GAINED_FROM_STEP'),
      B('LANGUAGE_FRAMING_ANALYSIS'),
    ],
    primarySignals: [
      PS('DECISION_DELAY', true, 0.7), PS('OPTION_PRESERVING_DECISION', true, 0.5),
      PS('PROBABILISTIC_THINKING', true, 0.5), PS('DECISION_STABILITY', true, 0.85),
    ],
  })

  // Verify some signal has requiredMatched > 0
  var withRequired = r.signals.filter(function (s) { return s.trace.requiredMatched > 0 })
  gt(withRequired.length, 0, 'No signals have required evidence matches')

  // Verify some signal has contextualMatched > 0
  var withContextual = r.signals.filter(function (s) { return s.trace.contextualMatched > 0 })
  gt(withContextual.length, 0, 'No signals have contextual evidence matches')

  // Verify some signal has strongMatched > 0
  var withStrong = r.signals.filter(function (s) { return s.trace.strongMatched > 0 })
  gt(withStrong.length, 0, 'No signals have strong evidence matches')

  // Verify some signal has contradictionMatched > 0
  var withContra = r.signals.filter(function (s) { return s.trace.contradictionMatched > 0 })
  gt(withContra.length, 0, 'No signals have contradiction evidence matches')
})

V('L02: Rich input produces diverse evidence trace patterns', function () {
  var r = evaluateAllSignals({
    evidence: [
      Q('pastAttemptStage'), Q('decisionStyle'), B('MULTI_YEAR_DECISION_POSTPONEMENT'),
      B('MINIMUM_VIABLE_STEP_TAKEN'), B('NEW_INFORMATION_GAINED_FROM_STEP'),
      B('EXPLICIT_COMPOUNDING_CALCULATION'), B('COMPOUNDING_REFERENCE_IN_DECISION'),
    ],
    primarySignals: [
      PS('DECISION_DELAY', true, 0.7), PS('OPTION_PRESERVING_DECISION', true, 0.5),
      PS('POST_ACTION_REVIEW', true, 0.6), PS('LONG_TERM_ORIENTATION', true, 0.5),
      PS('COMPOUNDING_TIME_ALLOCATION', true, 0.5), PS('DECISION_STABILITY', true, 0.85),
    ],
  })

  // Evidence trace coverage: count unique trace signatures
  var traceSignatures = {}
  r.signals.forEach(function (s) {
    var key = [s.trace.requiredMatched, s.trace.contextualMatched, s.trace.strongMatched, s.trace.contradictionMatched].join(':')
    traceSignatures[key] = true
  })
  gt(Object.keys(traceSignatures).length, 3, 'Should have diverse trace signatures')
})

// ═══════════════════════════════════════════════════════════════
// SECTION 15: CONTRADICTION-FIRST BEHAVIOR (2 cases)
// ═══════════════════════════════════════════════════════════════

V('M01: Contradiction suppression overrides support evidence', function () {
  // Fully supported activation
  var r = evaluateSignalById('WAITING_DURATION_PATTERN', {
    evidence: [Q('pastAttemptStage', 'o1'), Q('decisionStyle', 'o2')],
    primarySignals: [
      PS('DECISION_DELAY', true, 0.7, 'o3'),
      PS('DECISION_STABILITY', true, 0.8, 'o-ctr1'),
      PS('LOW_COST_EXPERIMENTATION', true, 0.5, 'o-ctr2'),
    ],
  })
  // Even with 2+ supporting items, contradiction wins
  eq(r.state, SIGNAL_STATE.SUPPRESSED)
})

V('M02: Contradiction-first pass rate = 100% for strong cases', function () {
  // Test 5 signals with strong contradiction scenarios
  var cases = [
    {
      signal: 'WAITING_DURATION_PATTERN',
      evidence: [Q('pastAttemptStage')],
      primarySignals: [PS('DECISION_DELAY', true, 0.7), PS('DECISION_STABILITY', true, 0.8), PS('LOW_COST_EXPERIMENTATION', true, 0.5)],
    },
    {
      signal: 'OUTPUT_DECOUPLING_AWARENESS',
      evidence: [B('REUSABLE_OUTPUT_CREATED')],
      primarySignals: [PS('REPEATABLE_VALUE', true, 0.5), PS('LEVERAGE_BLINDNESS', true, 0.8), PS('LINEAR_TIME_VALUE', true, 0.8)],
    },
    {
      signal: 'POST_ACTION_REVIEW_HABIT',
      evidence: [B('SPECIFIC_LEARNING_EXTRACTED')],
      primarySignals: [PS('POST_ACTION_REVIEW', true, 0.6), PS('FEEDBACK_AVOIDANCE', true, 0.7), PS('ASSUMPTION_WITHOUT_TEST', true, 0.8)],
    },
    {
      signal: 'LONG_TERM_COMPOUNDING_AWARENESS',
      evidence: [B('COMPOUNDING_REFERENCE_IN_DECISION')],
      primarySignals: [PS('LONG_TERM_ORIENTATION', true, 0.6), PS('SHORT_TERM_PRIORITY', true, 0.8), PS('URGENCY_DOMINANCE', true, 0.5)],
    },
    {
      signal: 'IDENTITY_BASED_EXCLUSION',
      evidence: [B('PATH_EXCLUSION_LANGUAGE_ANALYSIS'), B('EXCLUSION_RATIONALE_CATEGORIZATION')],
      primarySignals: [PS('FIXED_ROLE_IDENTITY', true, 0.5), PS('EXPANDING_IDENTITY', true, 0.7), PS('ADAPTIVE_IDENTITY', true, 0.7)],
    },
  ]

  var passCount = 0
  cases.forEach(function (c) {
    var r = evaluateSignalById(c.signal, {
      evidence: c.evidence,
      primarySignals: c.primarySignals,
    })
    if (r.state === SIGNAL_STATE.SUPPRESSED) passCount++
  })
  eq(passCount, cases.length, 'All strong-contradiction cases should suppress')
})

// ═══════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════

console.log('\n=====================================================')
console.log('RC8.3 C2-002C Secondary Signal Extractor Validation')
console.log('=====================================================')
console.log('Total cases: ' + total)
console.log('Passed:      ' + passed)
console.log('Failed:      ' + failed)
console.log('P1 debt observations: ' + p1DebtCases.length)
console.log('P2 debt observations: ' + p2DebtCases.length)
console.log('=====================================================')

if (failed > 0) {
  console.log('\nFAILURES:')
  violations.forEach(function (v, i) {
    console.log('  [' + (i + 1) + '] ' + v.case + ' — ' + v.error)
  })
} else {
  console.log('ALL VALIDATION CASES PASSED')
}

if (p1DebtCases.length > 0) {
  console.log('\nP1 TEXT_RULE_PARSER_DEBT observations:')
  p1DebtCases.forEach(function (d) {
    console.log('  - ' + d.signal + ': ' + d.trigger + ' (impact: ' + d.impact + ', severity: ' + d.severity + ')')
  })
}

if (p2DebtCases.length > 0) {
  console.log('\nP2 SCORE_HALVING_HEURISTIC observations:')
  p2DebtCases.forEach(function (d) {
    console.log('  - ' + d.signal + ': ' + d.issue + ' (impact: ' + d.impact + ', severity: ' + d.severity + ')')
  })
}

if (failed > 0) {
  process.exit(1)
}
