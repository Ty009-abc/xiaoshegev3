'use strict'
/**
 * turnaroundStrategy/v6/realityConstraintV6.js
 *
 * REALITY_CONSTRAINT is a MODIFIER, evaluated separately from the bottleneck.
 * REALITY_CONSTRAINT_OVERRIDES_PRIMARY = NO (frozen).
 * Types here are INTERNAL only (no user-facing ontology).
 */

const { OPT } = require('./bottleneckEligibilityV6.js')

const CONSTRAINT_TYPES = [
  'CASHFLOW_PRESSURE',
  'LOW_SURPLUS',
  'UNSTABLE_INCOME',
  'FAMILY_ENVIRONMENT_CONSTRAINT',
  'TIME_PRESSURE_POSSIBLE'
]

const LOW_SURPLUS_OPTIONS = ['SURPLUS_NONE', 'SURPLUS_UNDER_1K']

/**
 * @param {Object} profile canonical profile
 * @returns {{present:boolean, types:string[], evidence:Array}}
 */
function computeRealityConstraint (profile) {
  const types = []
  const evidence = []
  const q2 = profile._optionIds.Q2
  const q3 = profile._optionIds.Q3
  const q4 = profile._optionIds.Q4
  const q5 = profile.userBelief.perceivedRootCause
  const q8 = profile.behavior.timeAllocation

  if (q4 === OPT.PROBLEM_DEBT) {
    types.push('CASHFLOW_PRESSURE')
    evidence.push({ questionId: 'Q4', value: q4 })
  }
  if (LOW_SURPLUS_OPTIONS.includes(q3)) {
    types.push('LOW_SURPLUS')
    evidence.push({ questionId: 'Q3', value: q3 })
  }
  if (q2 === 'INCOME_NONE') {
    types.push('UNSTABLE_INCOME')
    evidence.push({ questionId: 'Q2', value: q2 })
  }
  if (q5 === OPT.BELIEF_FAMILY) {
    types.push('FAMILY_ENVIRONMENT_CONSTRAINT')
    evidence.push({ questionId: 'Q5', value: q5 })
  }
  // TIME_PRESSURE_POSSIBLE: a real time load may exist. Requires corroborating
  // reality pressure — Q8 alone is a TIME_ALLOCATION_PATTERN, NOT a time constraint.
  const realityPressure = q2 === OPT.INCOME_NONE ||
    LOW_SURPLUS_OPTIONS.includes(q3) ||
    q4 === OPT.PROBLEM_DEBT ||
    q5 === OPT.BELIEF_FAMILY
  if ([OPT.TIME_SHORT_FIRST, OPT.TIME_LONG_DROPS].includes(q8) && realityPressure) {
    types.push('TIME_PRESSURE_POSSIBLE')
    evidence.push({ questionId: 'Q8', value: q8 })
  }

  return {
    present: types.length > 0,
    types,
    evidence
  }
}

/** Deterministic action-sizing constraint derived from reality (never primary). */
function actionConstraint (constraint) {
  const caps = {
    maxCost: 'any',
    maxHorizonHours: 48,
    requiresCashflowPreStep: false
  }
  if (constraint.types.includes('LOW_SURPLUS') || constraint.types.includes('UNSTABLE_INCOME')) {
    caps.maxCost = 'low_or_zero'
  }
  if (constraint.types.includes('CASHFLOW_PRESSURE')) {
    caps.maxCost = 'low_or_zero'
    caps.requiresCashflowPreStep = true
  }
  return caps
}

module.exports = { CONSTRAINT_TYPES, LOW_SURPLUS_OPTIONS, computeRealityConstraint, actionConstraint }
