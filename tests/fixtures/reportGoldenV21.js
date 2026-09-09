/**
 * tests/fixtures/reportGoldenV21.js
 *
 * RC8.3 Stage1C-E1 — Report Golden dataset (durable semantic layer).
 *
 * This is the REPORT GOLDEN — distinct from DIAGNOSIS GOLDEN.
 *
 *   DIAGNOSIS_GOLDEN: "Did the engine classify the evidence correctly?"
 *   REPORT_GOLDEN:    "Did the user-facing report faithfully explain the
 *                      frozen diagnosis according to North Star?"
 *
 * Report Golden MUST NOT change diagnosis labels / thresholds / inference /
 * reselect blind spot / strategy / archetype / scenario. It asserts SEMANTIC
 * OBLIGATIONS, not exact polished prose.
 *
 * This file is PURE DATA (no require side-effects, no engine import). It is
 * the frozen expectation table consumed by the E1 gate tests. Each case's
 * authoritative mapping (blindSpot → principle → strategy → archetype) is
 * recorded here as the frozen expectation, AND cross-checked against the live
 * engine sources at test time so a Golden-expectation drift is itself caught.
 *
 * Input authority: every unique-primary case is constructed from the SAME
 * trusted answer fixtures used by Stage1C-C2/D1/D2 (HEALTHY + DISTORTED_PAIR),
 * plus the accepted real-device R4.5 SYSTEMS fixture. No diagnosis is invented
 * to make a report fixture convenient.
 *
 * @version north_star_report_golden_v1
 */

'use strict'

const REPORT_GOLDEN_VERSION = 'north_star_report_golden_v1'

// ── Frozen answer fixtures (verbatim from Stage1C-C2/D1/D2) ────────────────
// HEALTHY: the 18-question answer map that yields NO_SUPPORTED_DEFICIT
// (all-healthy → NO_PRIMARY). DISTORTED_PAIR: the per-construct answer pair
// that flips a single construct to DISTORTED·STRONG → unique primary.

const HEALTHY = {
  DECISION: { 'SC_DEC_01': 'A', 'SC_DEC_02': 'A' },
  FEEDBACK: { 'SC_FB_01': 'A', 'SC_FB_02': 'A' },
  PROBABILITY: { 'SC_PROB_01': 'A', 'SC_PROB_02': 'A' },
  RISK: { 'SC_RISK_01': 'A', 'SC_RISK_02': 'A' },
  LEVERAGE: { 'SC_LEV_01': 'B', 'SC_LEV_02': 'B' },
  TIME: { 'SC_TIME_01': 'B', 'SC_TIME_02': 'A' },
  IDENTITY: { 'SC_ID_01': 'A', 'SC_ID_02': 'B' },
  OPPORTUNITY: { 'SC_OPP_01': 'A', 'SC_OPP_02': 'A' },
  SYSTEMS: { 'SC_SYS_01': 'A', 'SC_SYS_02': 'A' },
}

const DISTORTED_PAIR = {
  DECISION: { 'SC_DEC_01': 'B', 'SC_DEC_02': 'C' },
  FEEDBACK: { 'SC_FB_01': 'B', 'SC_FB_02': 'B' },
  PROBABILITY: { 'SC_PROB_01': 'B', 'SC_PROB_02': 'B' },
  RISK: { 'SC_RISK_01': 'B', 'SC_RISK_02': 'B' },
  LEVERAGE: { 'SC_LEV_01': 'A', 'SC_LEV_02': 'A' },
  TIME: { 'SC_TIME_01': 'A', 'SC_TIME_02': 'B' },
  IDENTITY: { 'SC_ID_01': 'B', 'SC_ID_02': 'A' },
  OPPORTUNITY: { 'SC_OPP_01': 'B', 'SC_OPP_02': 'C' },
  SYSTEMS: { 'SC_SYS_01': 'D', 'SC_SYS_02': 'C' },
}

// ── Frozen authoritative mapping (recorded Golden expectation) ────────────
// blindSpot → principle → strategy → archetype. Cross-checked at test time.
const GOLDEN_MAPPING = Object.freeze({
  OPPORTUNITY_BLINDNESS: {
    construct: 'OPPORTUNITY',
    principle: 'OPPORTUNITY_EMERGES_THROUGH_EXPOSURE',
    strategy: 'EXPAND_OPTIONALITY',
    archetype: 'GUARDIAN',
  },
  FEEDBACK_LOOP_GAP: {
    construct: 'FEEDBACK',
    principle: 'FEEDBACK_UPDATES_MODELS',
    strategy: 'BUILD_FEEDBACK_LOOP',
    archetype: 'OPERATOR',
  },
  DECISION_INERTIA: {
    construct: 'DECISION',
    principle: 'DECISION_CREATES_INFORMATION',
    strategy: 'INCREASE_EXPERIMENT_RATE',
    archetype: 'GUARDIAN',
  },
  RISK_MODEL_DISTORTION: {
    construct: 'RISK',
    principle: 'RISK_IS_ASYMMETRICAL',
    strategy: 'REFRAME_RISK_MODEL',
    archetype: 'GUARDIAN',
  },
  PROBABILITY_MISJUDGMENT: {
    construct: 'PROBABILITY',
    principle: 'PROBABILITY_GOVERNS_OUTCOMES',
    strategy: 'UPGRADE_PROBABILITY_THINKING',
    archetype: 'EXPLORER',
  },
  IDENTITY_CONSTRAINT: {
    construct: 'IDENTITY',
    principle: 'IDENTITY_CONSTRAINS_CHOICES',
    strategy: 'EXPAND_IDENTITY_BOUNDARY',
    archetype: 'GUARDIAN',
  },
  LEVERAGE_MODEL_GAP: {
    construct: 'LEVERAGE',
    principle: 'LEVERAGE_MULTIPLIES_VALUE',
    strategy: 'BUILD_LEVERAGE_MODEL',
    archetype: 'OPERATOR',
  },
  SYSTEM_THINKING_GAP: {
    construct: 'SYSTEMS',
    principle: 'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR',
    strategy: 'BUILD_DECISION_SYSTEM',
    archetype: 'OPERATOR',
  },
  TIME_HORIZON_TRAP: {
    construct: 'TIME',
    principle: 'TIME_COMPOUNDS_ADVANTAGE',
    strategy: 'EXTEND_TIME_HORIZON',
    archetype: 'OPERATOR',
  },
})

// ── 9 unique-primary Golden cases ──────────────────────────────────────────
const UNIQUE_PRIMARY_CASES = Object.freeze([
  {
    caseId: 'GOLDEN_UP_DECISION_INERTIA',
    blindSpot: 'DECISION_INERTIA',
    inputSource: 'frozen DISTORTED_PAIR[DECISION] + HEALTHY rest (Stage1C-C2 fixture)',
  },
  {
    caseId: 'GOLDEN_UP_FEEDBACK_LOOP_GAP',
    blindSpot: 'FEEDBACK_LOOP_GAP',
    inputSource: 'frozen DISTORTED_PAIR[FEEDBACK] + HEALTHY rest',
  },
  {
    caseId: 'GOLDEN_UP_PROBABILITY_MISJUDGMENT',
    blindSpot: 'PROBABILITY_MISJUDGMENT',
    inputSource: 'frozen DISTORTED_PAIR[PROBABILITY] + HEALTHY rest',
  },
  {
    caseId: 'GOLDEN_UP_RISK_MODEL_DISTORTION',
    blindSpot: 'RISK_MODEL_DISTORTION',
    inputSource: 'frozen DISTORTED_PAIR[RISK] + HEALTHY rest',
  },
  {
    caseId: 'GOLDEN_UP_LEVERAGE_MODEL_GAP',
    blindSpot: 'LEVERAGE_MODEL_GAP',
    inputSource: 'frozen DISTORTED_PAIR[LEVERAGE] + HEALTHY rest',
  },
  {
    caseId: 'GOLDEN_UP_TIME_HORIZON_TRAP',
    blindSpot: 'TIME_HORIZON_TRAP',
    inputSource: 'frozen DISTORTED_PAIR[TIME] + HEALTHY rest',
  },
  {
    caseId: 'GOLDEN_UP_IDENTITY_CONSTRAINT',
    blindSpot: 'IDENTITY_CONSTRAINT',
    inputSource: 'frozen DISTORTED_PAIR[IDENTITY] + HEALTHY rest',
  },
  {
    caseId: 'GOLDEN_UP_OPPORTUNITY_BLINDNESS',
    blindSpot: 'OPPORTUNITY_BLINDNESS',
    inputSource: 'frozen DISTORTED_PAIR[OPPORTUNITY] + HEALTHY rest',
  },
  {
    caseId: 'GOLDEN_UP_SYSTEM_THINKING_GAP',
    blindSpot: 'SYSTEM_THINKING_GAP',
    inputSource: 'accepted real-device R4.5 fixture (SC_SYS_01:D attribution-blind + SC_SYS_02:C luck-attribution)',
  },
])

// ── 6 multi-state Golden cases ─────────────────────────────────────────────
const MULTI_STATE_CASES = Object.freeze([
  {
    caseId: 'GOLDEN_MS_MULTIPLE_SUPPORTED_MODELS',
    reasonCode: 'MULTIPLE_SUPPORTED_MODELS',
    inputSource: 'frozen MULTIPLE answers (6 competing distorted models, Stage1C-C2 fixture)',
  },
  {
    caseId: 'GOLDEN_MS_NO_SUPPORTED_DEFICIT',
    reasonCode: 'NO_SUPPORTED_DEFICIT',
    inputSource: 'frozen HEALTHY answers (all healthy, Stage1C-C2 fixture)',
  },
  {
    caseId: 'GOLDEN_MS_INSUFFICIENT_DIRECTIONAL_EVIDENCE',
    reasonCode: 'INSUFFICIENT_DIRECTIONAL_EVIDENCE',
    inputSource: 'HEALTHY + OPPORTUNITY single-direction distortion (Stage1C-C2 fixture)',
  },
  {
    caseId: 'GOLDEN_MS_CONTRADICTORY_EVIDENCE',
    reasonCode: 'CONTRADICTORY_EVIDENCE',
    inputSource: 'HEALTHY + DECISION mixed signals (Stage1C-C2 fixture)',
  },
  {
    caseId: 'GOLDEN_MS_BLOCKED_BY_RESPONSE_VALIDITY',
    reasonCode: 'BLOCKED_BY_RESPONSE_VALIDITY',
    inputSource: 'duplicate questionId → INSUFFICIENT_RESPONSE_QUALITY (Stage1C-C2 fixture)',
  },
  {
    caseId: 'GOLDEN_MS_NOT_EXECUTED',
    reasonCode: 'NOT_EXECUTED',
    inputSource: 'diagnosis=null with validityStatus=null (represented separately per §3B)',
  },
])

// ── Multi-state answer builders (no engine import — pure data) ────────────

// MULTIPLE: 6 constructs simultaneously DISTORTED·STRONG.
const MULTIPLE_ANSWERS = Object.freeze([
  { questionId: 'SC_DEC_01', optionId: 'B' }, { questionId: 'SC_DEC_02', optionId: 'C' },
  { questionId: 'SC_FB_01', optionId: 'B' }, { questionId: 'SC_FB_02', optionId: 'B' },
  { questionId: 'SC_PROB_01', optionId: 'B' }, { questionId: 'SC_PROB_02', optionId: 'B' },
  { questionId: 'SC_RISK_01', optionId: 'B' }, { questionId: 'SC_RISK_02', optionId: 'B' },
  { questionId: 'SC_LEV_01', optionId: 'B' }, { questionId: 'SC_LEV_02', optionId: 'A' },
  { questionId: 'SC_TIME_01', optionId: 'A' }, { questionId: 'SC_TIME_02', optionId: 'B' },
  { questionId: 'SC_ID_01', optionId: 'A' }, { questionId: 'SC_ID_02', optionId: 'B' },
  { questionId: 'SC_OPP_01', optionId: 'B' }, { questionId: 'SC_OPP_02', optionId: 'C' },
  { questionId: 'SC_SYS_01', optionId: 'A' }, { questionId: 'SC_SYS_02', optionId: 'B' },
])

// INSUFFICIENT: HEALTHY except OPPORTUNITY single-direction (B/B → not STRONG).
const INSUFFICIENT_MAP = (() => {
  const m = {}
  for (const c of Object.keys(HEALTHY)) m[c] = { ...HEALTHY[c] }
  m.OPPORTUNITY = { 'SC_OPP_01': 'B', 'SC_OPP_02': 'B' }
  return m
})()

// CONTRADICTORY: HEALTHY except DECISION mixed (A/C).
const CONTRADICTORY_MAP = (() => {
  const m = {}
  for (const c of Object.keys(HEALTHY)) m[c] = { ...HEALTHY[c] }
  m.DECISION = { 'SC_DEC_01': 'A', 'SC_DEC_02': 'C' }
  return m
})()

module.exports = {
  REPORT_GOLDEN_VERSION,
  HEALTHY,
  DISTORTED_PAIR,
  GOLDEN_MAPPING,
  UNIQUE_PRIMARY_CASES,
  MULTI_STATE_CASES,
  MULTIPLE_ANSWERS,
  INSUFFICIENT_MAP,
  CONTRADICTORY_MAP,
}
