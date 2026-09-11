'use strict'
/**
 * tests/v6/rc8.4-v6-integration.test.js
 *
 * Contract-shape + invariants + D-3 discriminator + malformed input.
 * No production wiring. Pure kernel conformance.
 */

const h = require('./_harness.js')
const { GOLDEN, D3 } = require('./fixtures.js')
const v6 = require('../../cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/index.js')
const { diagnoseTurnaroundV6 } = v6

h.section('RC8.4 V6 — contract shape / invariants')

// Contract version + counts
h.eq(v6.CONTRACT_VERSION, 'turnaround_strategy_v6_contract_v1', 'CONTRACT_VERSION')
h.eq(v6.PRIMARY_BOTTLENECKS.length, 5, 'PRIMARY_BOTTLENECK_COUNT')
h.eq(v6.EXECUTION_STAGE_COUNT, 7, 'EXECUTION_STAGE_COUNT')

// Output shape on a normal fixture
{
  const r = diagnoseTurnaroundV6(GOLDEN[0].answers)
  for (const k of ['contractVersion', 'profile', 'diagnosisState', 'primaryBottleneck',
    'eligibleCandidates', 'beliefRelation', 'realityConstraint', 'executionStage',
    'recommendedNextStage', 'firstActionType', 'trace']) {
    h.ok(Object.prototype.hasOwnProperty.call(r, k), `output has key ${k}`)
  }
  for (const k of ['sourceQuestionIds', 'sourceOptionIds', 'selectedRuleId',
    'requiredEvidence', 'supportingEvidence', 'contradictingEvidence',
    'selectionPriority', 'tieBreakReason', 'beliefSource', 'behaviorSources',
    'beliefRuleId', 'stageSource', 'bottleneckSource', 'constraintSources']) {
    h.ok(Object.prototype.hasOwnProperty.call(r.trace, k), `trace has key ${k}`)
  }
}

// D-3 discriminator: G01 gap / G07 no gap / G09 no gap
let d3Match = 0
for (const d of D3) {
  const r = diagnoseTurnaroundV6(d.answers)
  const gotGap = r.beliefRelation.relation === 'BELIEF_REALITY_GAP'
  if (gotGap === d.expectGap) d3Match++
  h.eq(gotGap, d.expectGap, `D-3 ${d.id} gap`)
  if (d.id === 'G01') h.eq(r.beliefRelation.explanationRuleId, 'RC84V6-GAP-DIRECTION', 'D-3 G01 ruleId')
}
console.log(`D3_GOLDEN_MATCH = ${d3Match}/3`)

// Invalid questionnaire contract -> INVALID_INPUT (distinct from NO_PRIMARY)
// missing required Q
{
  const r = diagnoseTurnaroundV6({ Q1: '25–30', Q2: '固定工资' })
  h.eq(r.diagnosisState, 'INVALID_INPUT', 'missing required -> INVALID_INPUT')
  h.eq(r.primaryBottleneck, null, 'missing required -> null primary')
  h.ok(r.inputErrors.missing.length > 0, 'missing required -> missing reported')
}
// unknown / unresolvable option
{
  const r = diagnoseTurnaroundV6({ Q1: 'nonsense', Q2: '固定工资', Q3: '1000–5000元', Q4: '收入一直上不去', Q5: '没时间', Q6: '主要还在想', Q7: '再等等，信息更充分再说', Q8: '先做马上有结果的', Q9: '再坚持一阵' })
  h.eq(r.diagnosisState, 'INVALID_INPUT', 'unresolved option -> INVALID_INPUT')
  h.ok(r.inputErrors.unresolved.includes('Q1'), 'unresolved Q1 reported')
}
// null input
{
  const r = diagnoseTurnaroundV6(null)
  h.eq(r.diagnosisState, 'INVALID_INPUT', 'null input -> INVALID_INPUT')
  h.eq(r.primaryBottleneck, null, 'null input -> null primary')
  h.ok(r.inputErrors.malformed.length > 0, 'null input -> malformed reported')
}
// empty object
{
  const r = diagnoseTurnaroundV6({})
  h.eq(r.diagnosisState, 'INVALID_INPUT', 'empty object -> INVALID_INPUT')
  h.ok(r.inputErrors.missing.length === 9, 'empty object -> all 9 missing')
}
// wrong top-level type
for (const [label, bad] of [['string', 'x'], ['number', 42], ['array', [1, 2]], ['boolean', true]]) {
  const r = diagnoseTurnaroundV6(bad)
  h.eq(r.diagnosisState, 'INVALID_INPUT', `wrong type (${label}) -> INVALID_INPUT`)
}
// unknown EXTRA field is non-blocking (still a valid diagnosis)
{
  const r = diagnoseTurnaroundV6({ Q1: '25–30', Q2: '固定工资', Q3: '1000–5000元', Q4: '收入一直上不去', Q5: '没时间', Q6: '主要还在想', Q7: '再等等，信息更充分再说', Q8: '先做马上有结果的', Q9: '再坚持一阵', Q10: 'whatever' })
  h.ok(r.diagnosisState !== 'INVALID_INPUT', 'extra field -> non-blocking')
}

// Valid submission with NO justified primary -> NO_PRIMARY (not INVALID_INPUT)
{
  const r = diagnoseTurnaroundV6({ Q1: '25–30', Q2: '自由职业 / 接单', Q3: '1000–5000元', Q4: '想做副业，但一直没做起来', Q5: '知道方向，但一直没真正行动', Q6: '主要还在想', Q7: '先做个很小的版本试试', Q8: '两边都会安排', Q9: '再坚持一阵' })
  h.eq(r.diagnosisState, 'NO_PRIMARY', 'valid no-primary -> NO_PRIMARY')
  h.eq(r.primaryBottleneck, null, 'valid no-primary -> null primary')
  h.eq(r.inputErrors.missing.length, 0, 'valid no-primary -> no missing')
}

// INVALID_INPUT must never be conflated with NO_PRIMARY
{
  const invalidStates = [null, {}, 'x', 42, [1], true, { Q1: '25–30' }, { Q1: 'bad', Q2: '固定工资', Q3: '1000–5000元', Q4: '收入一直上不去', Q5: '没时间', Q6: '主要还在想', Q7: '再等等，信息更充分再说', Q8: '先做马上有结果的', Q9: '再坚持一阵' }]
  let conflated = 0
  for (const bad of invalidStates) {
    if (diagnoseTurnaroundV6(bad).diagnosisState !== 'INVALID_INPUT') conflated++
  }
  h.eq(conflated, 0, 'INVALID_INPUT_AS_NO_PRIMARY_CASE_COUNT')
  console.log(`INVALID_INPUT_AS_NO_PRIMARY_CASE_COUNT = ${conflated}`)
}

// Semantic-ID input works identically to canonical-text input
{
  const text = { Q1: '25–30', Q2: '固定工资', Q3: '1000–5000元', Q4: '收入一直上不去', Q5: '没时间', Q6: '主要还在想', Q7: '再等等，信息更充分再说', Q8: '先做马上有结果的', Q9: '再坚持一阵' }
  const ids = { Q1: 'AGE_25_30', Q2: 'INCOME_SALARY', Q3: 'SURPLUS_1K_5K', Q4: 'PROBLEM_INCOME_STUCK', Q5: 'BELIEF_TIME', Q6: 'STAGE_THINKING', Q7: 'UNCERT_WAIT', Q8: 'TIME_SHORT_FIRST', Q9: 'NORESULT_PERSIST' }
  h.eq(diagnoseTurnaroundV6(ids).primaryBottleneck, diagnoseTurnaroundV6(text).primaryBottleneck, 'id/text equivalence')
}

h.summary('INTEGRATION')
module.exports = { d3Match }
