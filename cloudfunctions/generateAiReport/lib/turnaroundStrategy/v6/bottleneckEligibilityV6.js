'use strict'
/**
 * turnaroundStrategy/v6/bottleneckEligibilityV6.js
 *
 * ELIGIBILITY_FIRST. Deterministic per-bottleneck eligibility.
 * If REQUIRED evidence is absent -> eligible = false. Priority never rescues.
 *
 * AUTHORITATIVE for the D-1 and D-2 corrections:
 *  - VALIDATION_GAP does NOT require Q7 waiting/analysis (D-1).
 *  - ACTION_GAP eligible in {THINKING, RESEARCHING, LEARNING} but stage alone
 *    is never sufficient (D-2).
 *
 * No scores. No weights. No percentages. No probability.
 */

const STAGE = {
  THINKING: 'THINKING',
  RESEARCHING: 'RESEARCHING',
  LEARNING: 'LEARNING',
  STARTED: 'STARTED',
  TESTING: 'TESTING',
  EARLY_TRACTION: 'EARLY_TRACTION',
  STABLE_TRACTION: 'STABLE_TRACTION'
}

const PRIMARY_BOTTLENECKS = [
  'DIRECTION_GAP',
  'ACTION_GAP',
  'CONSISTENCY_GAP',
  'VALIDATION_GAP',
  'REPEATABILITY_GAP'
]

const Q6 = {
  THINKING: 'STAGE_THINKING',
  RESEARCHING: 'STAGE_RESEARCHING',
  LEARNING: 'STAGE_LEARNING',
  STARTED: 'STAGE_STARTED',
  TESTING: 'STAGE_TESTING',
  EARLY_TRACTION: 'STAGE_EARLY_TRACTION',
  STABLE_TRACTION: 'STAGE_STABLE_TRACTION'
}

const OPT = {
  // Q2 income mode
  INCOME_SALARY: 'INCOME_SALARY',
  INCOME_BUSINESS: 'INCOME_BUSINESS',
  INCOME_FREELANCE: 'INCOME_FREELANCE',
  INCOME_ASSET: 'INCOME_ASSET',
  INCOME_NONE: 'INCOME_NONE',
  INCOME_OTHER: 'INCOME_OTHER',
  // Q3 monthly surplus
  SURPLUS_NONE: 'SURPLUS_NONE',
  SURPLUS_UNDER_1K: 'SURPLUS_UNDER_1K',
  SURPLUS_1K_5K: 'SURPLUS_1K_5K',
  SURPLUS_5K_10K: 'SURPLUS_5K_10K',
  SURPLUS_OVER_10K: 'SURPLUS_OVER_10K',
  // Q4 primary problem
  PROBLEM_INCOME_STUCK: 'PROBLEM_INCOME_STUCK',
  PROBLEM_NO_FUTURE: 'PROBLEM_NO_FUTURE',
  PROBLEM_DEBT: 'PROBLEM_DEBT',
  PROBLEM_CAREER_SWITCH: 'PROBLEM_CAREER_SWITCH',
  PROBLEM_SIDE_UNSTARTED: 'PROBLEM_SIDE_UNSTARTED',
  PROBLEM_MONETIZE: 'PROBLEM_MONETIZE',
  PROBLEM_FOCUS: 'PROBLEM_FOCUS',
  PROBLEM_OTHER: 'PROBLEM_OTHER',
  // Q5
  BELIEF_NO_DIRECTION: 'BELIEF_NO_DIRECTION',
  BELIEF_KNOW_NO_ACTION: 'BELIEF_KNOW_NO_ACTION',
  BELIEF_TRIED_NO_RESULT: 'BELIEF_TRIED_NO_RESULT',
  BELIEF_RESOURCE: 'BELIEF_RESOURCE',
  BELIEF_TIME: 'BELIEF_TIME',
  BELIEF_FEAR: 'BELIEF_FEAR',
  BELIEF_SWITCHING: 'BELIEF_SWITCHING',
  BELIEF_ABILITY: 'BELIEF_ABILITY',
  BELIEF_FAMILY: 'BELIEF_FAMILY',
  BELIEF_OTHER: 'BELIEF_OTHER',
  // Q7
  UNCERT_SMALL_TEST: 'UNCERT_SMALL_TEST',
  UNCERT_WAIT: 'UNCERT_WAIT',
  UNCERT_ASK_OTHERS: 'UNCERT_ASK_OTHERS',
  UNCERT_ANALYZE: 'UNCERT_ANALYZE',
  // Q8
  TIME_SHORT_FIRST: 'TIME_SHORT_FIRST',
  TIME_BALANCE: 'TIME_BALANCE',
  TIME_PROTECT_LONG: 'TIME_PROTECT_LONG',
  TIME_LONG_DROPS: 'TIME_LONG_DROPS',
  // Q9
  NORESULT_SWITCH: 'NORESULT_SWITCH',
  NORESULT_PERSIST: 'NORESULT_PERSIST',
  NORESULT_ASK_OTHERS: 'NORESULT_ASK_OTHERS',
  NORESULT_RECHECK: 'NORESULT_RECHECK',
  NORESULT_STOP: 'NORESULT_STOP'
}

const WAITING_ANALYSIS = [OPT.UNCERT_WAIT, OPT.UNCERT_ANALYZE] // Q7 gate set (NOT required for VALIDATION)

function ev (q, value, ok, text) {
  return { questionId: q, value, ok, text }
}

// ── DIRECTION_GAP ────────────────────────────────────────────────
function eligibilityDirection (p) {
  const stage = p.executionStage.currentStage
  const q5 = p.userBelief.perceivedRootCause
  const q9 = p.behavior.noResultResponse
  const q7 = p.behavior.uncertaintyResponse
  const q8 = p.behavior.timeAllocation
  const q4 = p.desiredChange.primaryProblem

  const required = [
    ev('Q6', stage, stage === STAGE.THINKING || stage === STAGE.RESEARCHING,
      'stage ∈ {THINKING, RESEARCHING}'),
    ev('Q5', q5, q5 === OPT.BELIEF_NO_DIRECTION || q5 === OPT.BELIEF_SWITCHING,
      'Q5 ∈ {不知道该往哪走, 总在换方向}'),
    ev('Q9', q9, q9 === OPT.NORESULT_SWITCH, 'Q9 = 换个方向试试')
  ]
  const supporting = [
    ev('Q7', q7, q7 === OPT.UNCERT_WAIT, 'waiting behavior supports uncertainty-narrowing'),
    ev('Q8', q8, q8 === OPT.TIME_LONG_DROPS, 'long-term work displaced'),
    ev('Q4', q4, [OPT.PROBLEM_NO_FUTURE, OPT.PROBLEM_CAREER_SWITCH, OPT.PROBLEM_MONETIZE].includes(q4),
      'problem is future/direction/ monetization')
  ]
  const contradicting = []
  return {
    bottleneck: 'DIRECTION_GAP',
    eligible: required.every(e => e.ok),
    requiredEvidence: required,
    supportingEvidence: supporting.filter(e => e.ok),
    contradictingEvidence: contradicting.filter(e => e.ok),
    ruleId: 'RC84V6-DIRECTION-01'
  }
}

// ── ACTION_GAP ───────────────────────────────────────────────────
function eligibilityAction (p) {
  const stage = p.executionStage.currentStage
  const q5 = p.userBelief.perceivedRootCause
  const q6 = p._optionIds.Q6
  const q7 = p.behavior.uncertaintyResponse
  const q8 = p.behavior.timeAllocation
  const q9 = p.behavior.noResultResponse

  const inStage = stage === STAGE.THINKING || stage === STAGE.RESEARCHING || stage === STAGE.LEARNING
  const required = [
    ev('Q6', stage, inStage, 'stage ∈ {THINKING, RESEARCHING, LEARNING}'),
    ev('Q7', q7, WAITING_ANALYSIS.includes(q7), 'Q7 ∈ {再等等, 先把问题想清楚}'),
    ev('Q5/Q6', { q5, q6 }, q5 === OPT.BELIEF_KNOW_NO_ACTION || q6 === Q6.LEARNING,
      'Q5 = 知道方向但没行动 OR Q6 = 学过但没开始')
  ]
  const supporting = [
    ev('Q6', q6, q6 === Q6.RESEARCHING, 'researched heavily'),
    ev('Q8', q8, q8 === OPT.TIME_LONG_DROPS, 'long-term work displaced'),
    ev('Q9', q9, q9 === OPT.NORESULT_STOP, 'stopped investing')
  ]
  return {
    bottleneck: 'ACTION_GAP',
    eligible: required.every(e => e.ok),
    requiredEvidence: required,
    supportingEvidence: supporting.filter(e => e.ok),
    contradictingEvidence: [],
    ruleId: 'RC84V6-ACTION-01'
  }
}

// ── CONSISTENCY_GAP ──────────────────────────────────────────────
function eligibilityConsistency (p) {
  const q6 = p._optionIds.Q6
  const q8 = p.behavior.timeAllocation
  const q9 = p.behavior.noResultResponse
  const q5 = p.userBelief.perceivedRootCause
  const q7 = p.behavior.uncertaintyResponse

  const required = [
    ev('Q6', q6, q6 === Q6.STARTED, 'Q6 = 开始做过但没坚持多久'),
    ev('Q9/Q8', { q9, q8 }, q9 === OPT.NORESULT_SWITCH || q8 === OPT.TIME_LONG_DROPS,
      'Q9 = 换个方向试试 OR Q8 = 一忙长期就停')
  ]
  const supporting = [
    ev('Q5', q5, q5 === OPT.BELIEF_SWITCHING, 'belief: always switching'),
    ev('Q7', q7, q7 === OPT.UNCERT_WAIT, 'waiting behavior')
  ]
  const contradicting = [
    ev('Q8', q8, q8 === OPT.TIME_PROTECT_LONG, 'protected long-term time')
  ]
  const eligible = required.every(e => e.ok) && !contradicting.some(e => e.ok)
  return {
    bottleneck: 'CONSISTENCY_GAP',
    eligible,
    requiredEvidence: required,
    supportingEvidence: supporting.filter(e => e.ok),
    contradictingEvidence: contradicting.filter(e => e.ok),
    ruleId: 'RC84V6-CONSISTENCY-01'
  }
}

// ── VALIDATION_GAP (D-1: Q7 NOT required) ────────────────────────
function eligibilityValidation (p) {
  const q6 = p._optionIds.Q6
  const q7 = p.behavior.uncertaintyResponse
  const q8 = p.behavior.timeAllocation
  const q9 = p.behavior.noResultResponse
  const q5 = p.userBelief.perceivedRootCause
  const q4 = p.desiredChange.primaryProblem

  const required = [
    ev('Q6', q6, q6 === Q6.TESTING, 'Q6 = 做过产品/服务但没人买单'),
    ev('Q6', q6, q6 !== Q6.EARLY_TRACTION && q6 !== Q6.STABLE_TRACTION, 'no payment evidence')
  ]
  const supporting = [
    ev('Q7', q7, WAITING_ANALYSIS.includes(q7), 'Q7 waiting/analysis SUPPORTS (not required, D-1)'),
    ev('Q4', q4, [OPT.PROBLEM_SIDE_UNSTARTED, OPT.PROBLEM_MONETIZE].includes(q4), 'problem: side/monetize'),
    ev('Q5', q5, q5 === OPT.BELIEF_ABILITY, 'belief: ability'),
    ev('Q9', q9, [OPT.NORESULT_SWITCH, OPT.NORESULT_STOP].includes(q9), 'switch/stop')
  ]
  const contradicting = [
    ev('Q6', q6, q6 === Q6.EARLY_TRACTION || q6 === Q6.STABLE_TRACTION, 'payment evidence present')
  ].filter(e => e.ok)
  return {
    bottleneck: 'VALIDATION_GAP',
    eligible: required.every(e => e.ok) && contradicting.length === 0,
    requiredEvidence: required,
    supportingEvidence: supporting.filter(e => e.ok),
    contradictingEvidence: contradicting,
    ruleId: 'RC84V6-VALIDATION-01'
  }
}

// ── REPEATABILITY_GAP ────────────────────────────────────────────
function eligibilityRepeatability (p) {
  const q6 = p._optionIds.Q6
  const q8 = p.behavior.timeAllocation
  const q7 = p.behavior.uncertaintyResponse
  const q4 = p.desiredChange.primaryProblem

  const hasTraction = q6 === Q6.EARLY_TRACTION || q6 === Q6.STABLE_TRACTION
  const noRepeatProcess = q8 !== OPT.TIME_PROTECT_LONG
  const required = [
    ev('Q6', q6, hasTraction, 'Q6 ∈ {已经有人愿意付钱, 已经有一点稳定结果}'),
    ev('Q8', q8, q8 === OPT.TIME_SHORT_FIRST || q8 === OPT.TIME_LONG_DROPS,
      'Q8 ∈ {先做马上有结果的, 一忙长期就停}'),
    ev('Q8', q8, noRepeatProcess, 'no repeatable-process evidence')
  ]
  const supporting = [
    ev('Q4', q4, q4 === OPT.PROBLEM_INCOME_STUCK, 'problem: income stuck'),
    ev('Q7', q7, q7 === OPT.UNCERT_SMALL_TEST, 'trial ability proven, not a system')
  ]
  const contradicting = [
    ev('Q8', q8, q6 === Q6.STABLE_TRACTION && q8 === OPT.TIME_PROTECT_LONG,
      'stable + protected long-term time -> system present')
  ].filter(e => e.ok)
  return {
    bottleneck: 'REPEATABILITY_GAP',
    eligible: required.every(e => e.ok) && contradicting.length === 0,
    requiredEvidence: required,
    supportingEvidence: supporting.filter(e => e.ok),
    contradictingEvidence: contradicting,
    ruleId: 'RC84V6-REPEATABILITY-01'
  }
}

const EVALUATORS = {
  DIRECTION_GAP: eligibilityDirection,
  ACTION_GAP: eligibilityAction,
  CONSISTENCY_GAP: eligibilityConsistency,
  VALIDATION_GAP: eligibilityValidation,
  REPEATABILITY_GAP: eligibilityRepeatability
}

/** Evaluate all 5 candidates. Returns array in PRIMARY_BOTTLENECKS order. */
function evaluateEligibility (profile) {
  return PRIMARY_BOTTLENECKS.map(b => EVALUATORS[b](profile))
}

module.exports = {
  PRIMARY_BOTTLENECKS,
  STAGE,
  Q6,
  OPT,
  WAITING_ANALYSIS,
  evaluateEligibility
}
