'use strict'
/**
 * tests/v6/rc8.4-v6-mutation.test.js
 *
 * Mutation checks proving each gate is REAL (load-bearing).
 *
 * Method: inject a deliberately-broken ("mutant") exports object into the V6
 * module cache, run the orchestrator fresh, and assert the mutant output differs
 * from the correct output in the unsafe direction. If a mutant produces the SAME
 * output as the correct kernel, the gate is a no-op and the test FAILS.
 *
 * No production file is modified — only the in-process require cache.
 */

const h = require('./_harness.js')
const { GOLDEN, ADVERSARIAL } = require('./fixtures.js')

const V6_DIR = require('path').resolve(__dirname, '../../cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const P_INDEX = V6_DIR + '/index.js'
const P_ELIG = V6_DIR + '/bottleneckEligibilityV6.js'
const P_SEL = V6_DIR + '/bottleneckSelectorV6.js'
const P_BEL = V6_DIR + '/beliefRelationV6.js'

h.section('RC8.4 V6 — mutation tests')

function clearV6Cache () {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(V6_DIR)) delete require.cache[k]
  }
}

/** Inject mutant exports for modPath, run fn (which re-requires fresh), restore. */
function withMutant (modPath, mutantExports, fn) {
  const key = require.resolve(modPath)
  const orig = require.cache[key]
  clearV6Cache()
  require.cache[key] = { id: key, filename: key, loaded: true, exports: mutantExports }
  try {
    return fn()
  } finally {
    if (orig) require.cache[key] = orig; else delete require.cache[key]
    clearV6Cache()
  }
}

function primaryOfFresh (answers) { return require(P_INDEX).diagnoseTurnaroundV6(answers).primaryBottleneck }
function correctPrimaryOf (answers) { return require(P_INDEX).diagnoseTurnaroundV6(answers).primaryBottleneck }

let mutationCount = 0
const detected = []

function record (name, isDetected, detail) {
  mutationCount++
  h.ok(isDetected, `${name} must be DETECTED (${detail})`)
  detected.push({ name, isDetected })
  console.log(`  ${name}: ${isDetected ? 'DETECTED' : 'NOT DETECTED'} — ${detail}`)
}

// ── M1: remove required-evidence eligibility gate ─────────────────
// Mutant: mark every candidate eligible. On adversarial B (expected NO_PRIMARY),
// this must produce a primary.
{
  const orig = require(P_ELIG)
  const mutantElig = {
    ...orig,
    evaluateEligibility: (p) => orig.evaluateEligibility(p).map(c => ({ ...c, eligible: true }))
  }
  const b = ADVERSARIAL.find(c => c.id === 'B')
  const correct = correctPrimaryOf(b.answers)
  clearV6Cache()
  const mutated = withMutant(P_ELIG, mutantElig, () => primaryOfFresh(b.answers))
  record('M1 remove-eligibility-gate', correct === null && mutated !== null,
    `correct=${correct}, mutated=${mutated}`)
}

// ── M2: allow priority to rescue an ineligible candidate ──────────
// Mutant: selector ignores eligibility entirely (picks by priority over ALL).
{
  const orig = require(P_SEL)
  const origElig = require(P_ELIG)
  const stages = Object.keys(orig.PRIORITY)
  const mutantSel = {
    ...orig,
    selectPrimary: (profile, candidates) => {
      // deliberately WRONG: select highest-priority candidate even if ineligible
      const order = orig.PRIORITY[profile.executionStage.currentStage] || []
      const all = candidates.map(c => c.bottleneck)
      const pick = order.find(b => all.includes(b)) || all[0] || null
      return {
        primaryBottleneck: pick,
        diagnosisState: pick ? 'PRIMARY' : 'NO_PRIMARY',
        eligibleCandidates: candidates.filter(c => c.eligible).map(c => c.bottleneck),
        selectionPriority: order,
        tieBreakReason: 'MUTANT: ignores eligibility',
        selectedRuleId: pick
      }
    }
  }
  const b = ADVERSARIAL.find(c => c.id === 'B') // LEARNING, no eligible candidate
  clearV6Cache()
  const correct = require(P_INDEX).diagnoseTurnaroundV6(b.answers).primaryBottleneck
  const mutated = withMutant(P_SEL, mutantSel, () => primaryOfFresh(b.answers))
  record('M2 priority-rescues-ineligible', correct === null && mutated !== null,
    `correct=${correct}, mutated=${mutated}`)
}

// ── M3: force primary when no candidate eligible ──────────────────
{
  const orig = require(P_SEL)
  const mutantSel = {
    ...orig,
    selectPrimary: (profile, candidates) => {
      const r = orig.selectPrimary(profile, candidates)
      if (r.primaryBottleneck === null) return { ...r, primaryBottleneck: 'DIRECTION_GAP', diagnosisState: 'PRIMARY' }
      return r
    }
  }
  const a = ADVERSARIAL.find(c => c.id === 'A')
  clearV6Cache()
  const correct = require(P_INDEX).diagnoseTurnaroundV6(a.answers).primaryBottleneck
  const mutated = withMutant(P_SEL, mutantSel, () => primaryOfFresh(a.answers))
  record('M3 force-primary', correct === null && mutated !== null,
    `correct=${correct}, mutated=${mutated}`)
}

// ── M4: Q5=没时间 + Q8 -> automatic hard gap ──────────────────────
{
  const orig = require(P_BEL)
  const mutantBel = {
    ...orig,
    computeBeliefRelation: (p) => {
      const r = orig.computeBeliefRelation(p)
      if (p.userBelief.perceivedRootCause === 'BELIEF_TIME') {
        return { ...r, relation: 'BELIEF_REALITY_GAP', explanationRuleId: 'RC84V6-TIME-GAP-MUTANT' }
      }
      return r
    }
  }
  const hh = ADVERSARIAL.find(c => c.id === 'H')
  clearV6Cache()
  const correct = require(P_INDEX).diagnoseTurnaroundV6(hh.answers).beliefRelation.relation
  const mutated = withMutant(P_BEL, mutantBel,
    () => require(P_INDEX).diagnoseTurnaroundV6(hh.answers).beliefRelation.relation)
  record('M4 time-single-signal-hard-gap', correct === 'BELIEF_PARTIAL' && mutated === 'BELIEF_REALITY_GAP',
    `correct=${correct}, mutated=${mutated}`)
}

// ── M5: let reality constraint overwrite primary bottleneck ───────
{
  const orig = require(P_INDEX)
  const mutantOrch = {
    ...orig,
    diagnoseTurnaroundV6: (a) => {
      const r = orig.diagnoseTurnaroundV6(a)
      if (r.realityConstraint && r.realityConstraint.present) r.primaryBottleneck = 'CASHFLOW_PRESSURE'
      return r
    }
  }
  const j = ADVERSARIAL.find(c => c.id === 'J')
  clearV6Cache()
  const correct = require(P_INDEX).diagnoseTurnaroundV6(j.answers).primaryBottleneck
  const mutated = withMutant(P_INDEX, mutantOrch,
    () => require(P_INDEX).diagnoseTurnaroundV6(j.answers).primaryBottleneck)
  record('M5 reality-overrides-primary', correct === 'VALIDATION_GAP' && mutated === 'CASHFLOW_PRESSURE',
    `correct=${correct}, mutated=${mutated}`)
}

// ── M6: add special 总在换方向 hard-gap rule ──────────────────────
{
  const orig = require(P_BEL)
  const mutantBel = {
    ...orig,
    computeBeliefRelation: (p) => {
      if (p.userBelief.perceivedRootCause === 'BELIEF_SWITCHING') {
        return {
          relation: 'BELIEF_REALITY_GAP',
          subType: 'SWITCHING',
          beliefSource: { questionId: 'Q5', value: 'BELIEF_SWITCHING' },
          behaviorSources: [],
          explanationRuleId: 'RC84V6-GAP-SWITCHING-MUTANT'
        }
      }
      return orig.computeBeliefRelation(p)
    }
  }
  const m = ADVERSARIAL.find(c => c.id === 'M')
  clearV6Cache()
  const correct = require(P_INDEX).diagnoseTurnaroundV6(m.answers).beliefRelation.relation
  const mutated = withMutant(P_BEL, mutantBel,
    () => require(P_INDEX).diagnoseTurnaroundV6(m.answers).beliefRelation.relation)
  record('M6 switching-hard-gap', correct === 'BELIEF_MATCH' && mutated === 'BELIEF_REALITY_GAP',
    `correct=${correct}, mutated=${mutated}`)
}

// ── M7: make VALIDATION require Q7 waiting behavior again ─────────
{
  const orig = require(P_ELIG)
  const WAIT = ['UNCERT_WAIT', 'UNCERT_ANALYZE']
  // Re-derive eligibility with the extra Q7 requirement for VALIDATION.
  const mutantElig = {
    ...orig,
    evaluateEligibility: (p) => orig.evaluateEligibility(p).map((c) => {
      if (c.bottleneck !== 'VALIDATION_GAP') return c
      const q7ok = WAIT.includes(p.behavior.uncertaintyResponse)
      return { ...c, eligible: c.eligible && q7ok, ruleId: c.ruleId + '+MUT' }
    })
  }
  const g11 = GOLDEN.find(g => g.id === 'G11') // Q7 = 先做个很小的版本试试 (NOT waiting)
  clearV6Cache()
  const correct = require(P_INDEX).diagnoseTurnaroundV6(g11.answers).primaryBottleneck
  const mutated = withMutant(P_ELIG, mutantElig, () => primaryOfFresh(g11.answers))
  record('M7 validation-requires-Q7', correct === 'VALIDATION_GAP' && mutated !== 'VALIDATION_GAP',
    `correct=${correct}, mutated=${mutated}`)
}

h.summary('MUTATION')
console.log(`\nMUTATION_TEST_COUNT = ${mutationCount}`)
console.log(`MUTATIONS_DETECTED = ${detected.filter(d => d.isDetected).length}/${mutationCount}`)
module.exports = { mutationCount, detected }
