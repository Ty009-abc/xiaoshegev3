'use strict'
/**
 * tests/v6/rc8.4-v6-adversarial.test.js
 *
 * Runs all 16 accepted adversarial cases against the V6 kernel.
 * Expected outcomes are FROZEN (from docs/RC8.4_V6_ADVERSARIAL_CASES.md).
 *
 * Tracks:
 *   FORCED_DIAGNOSIS_COUNT       (a NO_PRIMARY case that got a primary)
 *   FAKE_BELIEF_GAP_COUNT        (hard gap where none is justified)
 *   FAKE_TIME_BELIEF_GAP_COUNT   (hard TIME gap from single signal)
 *   REALITY_OVERRIDE_ERROR_COUNT (reality constraint became the primary)
 *   STAGE_PRIORITY_OVERRIDE_ERROR_COUNT (ineligible rescued by priority)
 */

const h = require('./_harness.js')
const { ADVERSARIAL } = require('./fixtures.js')
const v6 = require('../../cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/index.js')
const { diagnoseTurnaroundV6 } = v6
const { evaluateEligibility } = v6.bottleneckEligibilityV6
const { selectPrimary } = v6.bottleneckSelectorV6
const { buildProfileV6 } = v6.profileBuilderV6

h.section('RC8.4 V6 — 16 adversarial cases')

let forcedDiagnosis = 0
let fakeBeliefGap = 0
let fakeTimeGap = 0
let realityOverride = 0
let stagePriorityOverride = 0

for (const c of ADVERSARIAL) {
  const r = diagnoseTurnaroundV6(c.answers)
  const got = r.primaryBottleneck // null == NO_PRIMARY

  h.eq(got, c.expectPrimary, `${c.id} primary`)

  // FORCED_DIAGNOSIS: expected NO_PRIMARY but got a primary
  if (c.expectPrimary === null && got !== null) forcedDiagnosis++

  // FAKE_BELIEF_GAP: expectNoHardGap but got a hard gap
  if (c.expectNoHardGap && r.beliefRelation.relation === 'BELIEF_REALITY_GAP') fakeBeliefGap++

  // FAKE_TIME_BELIEF_GAP: TIME belief turned into a hard gap
  if (c.answers.Q5 === '没时间' && r.beliefRelation.relation === 'BELIEF_REALITY_GAP') fakeTimeGap++

  // REALITY_OVERRIDE: reality present but became the primary name (never allowed)
  if (r.realityConstraint && r.realityConstraint.present &&
      ['CASHFLOW_PRESSURE', 'LOW_SURPLUS', 'UNSTABLE_INCOME',
        'FAMILY_ENVIRONMENT_CONSTRAINT', 'TIME_PRESSURE_POSSIBLE'].includes(r.primaryBottleneck)) {
    realityOverride++
  }

  // STAGE_PRIORITY_OVERRIDE: prove no ineligible candidate was ever selected
  const built = buildProfileV6(c.answers)
  const cands = evaluateEligibility(built.profile)
  const sel = selectPrimary(built.profile, cands)
  if (sel.primaryBottleneck) {
    const chosen = cands.find(x => x.bottleneck === sel.primaryBottleneck)
    if (!chosen || !chosen.eligible) stagePriorityOverride++
  }

  // Optional structured expectations
  if (Object.prototype.hasOwnProperty.call(c, 'expectRealityConstraint')) {
    const present = !!(r.realityConstraint && r.realityConstraint.present)
    h.eq(present, c.expectRealityConstraint, `${c.id} realityConstraint.present`)
  }
  if (c.expectRelation) {
    h.eq(r.beliefRelation.relation, c.expectRelation, `${c.id} beliefRelation`)
  }

  console.log(`  ${c.id}: ${got || 'NO_PRIMARY'} · rel=${r.beliefRelation.relation} · rc=${r.realityConstraint.present}`)
}

h.summary('ADVERSARIAL')

console.log(`\nADVERSARIAL_CASE_COUNT = ${ADVERSARIAL.length}`)
console.log(`FORCED_DIAGNOSIS_COUNT = ${forcedDiagnosis}`)
console.log(`FAKE_BELIEF_GAP_COUNT = ${fakeBeliefGap}`)
console.log(`FAKE_TIME_BELIEF_GAP_COUNT = ${fakeTimeGap}`)
console.log(`REALITY_OVERRIDE_ERROR_COUNT = ${realityOverride}`)
console.log(`STAGE_PRIORITY_OVERRIDE_ERROR_COUNT = ${stagePriorityOverride}`)

h.eq(forcedDiagnosis, 0, 'FORCED_DIAGNOSIS_COUNT must be 0')
h.eq(fakeBeliefGap, 0, 'FAKE_BELIEF_GAP_COUNT must be 0')
h.eq(fakeTimeGap, 0, 'FAKE_TIME_BELIEF_GAP_COUNT must be 0')
h.eq(realityOverride, 0, 'REALITY_OVERRIDE_ERROR_COUNT must be 0')
h.eq(stagePriorityOverride, 0, 'STAGE_PRIORITY_OVERRIDE_ERROR_COUNT must be 0')

module.exports = { forcedDiagnosis, fakeBeliefGap, fakeTimeGap, realityOverride, stagePriorityOverride }
