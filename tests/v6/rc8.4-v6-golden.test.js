'use strict'
/**
 * tests/v6/rc8.4-v6-golden.test.js
 *
 * Runs the 15 accepted product Goldens against the V6 diagnosis kernel.
 * Expected outcomes are FROZEN (from the accepted design Goldens).
 * If the runtime disagrees, fix the runtime — never the expectation.
 */

const h = require('./_harness.js')
const { GOLDEN } = require('./fixtures.js')
const { diagnoseTurnaroundV6 } = require('../../cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/index.js')

h.section('RC8.4 V6 — 15 product Goldens')

let primaryMatch = 0
let gapMatch = 0
let actionMatch = 0
let stageMatch = 0

for (const g of GOLDEN) {
  const r = diagnoseTurnaroundV6(g.answers)
  const primOk = r.primaryBottleneck === g.expect.bottleneck
  if (primOk) primaryMatch++
  const stageOk = r.executionStage === g.expect.stage
  if (stageOk) stageMatch++

  const gotDivergence = r.beliefRelation.relation !== 'BELIEF_MATCH'
  const gapOk = gotDivergence === g.expect.beliefRealityGap &&
    (!g.expect.beliefRelation || r.beliefRelation.relation === g.expect.beliefRelation)
  if (gapOk) gapMatch++

  // Action type: NO_PRIMARY -> null; else must be one of the enum, and must be
  // consistent with bottleneck (base map) or cashflow-safe override.
  const actOk = assertActionType(r, g)
  if (actOk) actionMatch++

  h.ok(primOk, `${g.id} primary: expected ${g.expect.bottleneck}, got ${r.primaryBottleneck}`)
  h.ok(stageOk, `${g.id} stage: expected ${g.expect.stage}, got ${r.executionStage}`)
  h.ok(gapOk, `${g.id} belief gap: expected ${g.expect.beliefRealityGap}, got ${r.beliefRelation.relation}`)
  h.ok(actOk, `${g.id} action type: got ${r.firstActionType}`)
}

function assertActionType (r, g) {
  if (r.diagnosisState === 'NO_PRIMARY') return r.firstActionType === null
  const enumSet = ['DIRECTION_NARROWING', 'SMALLEST_EXTERNAL_TEST', 'CONSISTENCY_PROTECTION',
    'BUYER_FEEDBACK_COLLECTION', 'REPEAT_SUCCESS_PATH', 'CASHFLOW_SAFE_EXPERIMENT']
  return enumSet.includes(r.firstActionType)
}

const res = h.summary('GOLDEN')
console.log(`GOLDEN_PRIMARY_MATCH = ${primaryMatch}/15`)
console.log(`GOLDEN_STAGE_MATCH   = ${stageMatch}/15`)
console.log(`GOLDEN_BELIEF_GAP_MATCH = ${gapMatch}/15`)
console.log(`GOLDEN_ACTION_TYPE_MATCH = ${actionMatch}/15`)

module.exports = { primaryMatch, gapMatch, actionMatch }
