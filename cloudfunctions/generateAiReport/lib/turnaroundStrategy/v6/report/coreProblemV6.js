'use strict'
/**
 * turnaroundStrategy/v6/report/coreProblemV6.js
 *
 * CARD 02 — 核心问题.
 * R33 §6 — WHY THE RULE FAILS: 2–3 personal evidence anchors, then explain why
 * the user's current rule conflicts with how the world actually works
 * (a DIAGNOSTIC LEAP, never an answer restatement).
 * CONSUMER LAYER ONLY. Deterministic. No diagnosis. No AI.
 */

const copy = require('./reportCopyV6.js')

/**
 * @param {Object} r diagnoseTurnaroundV6 output (PRIMARY state only)
 * @returns {{text:string, provenance:Object}}
 */
function buildCoreProblem (r) {
  const q2 = r.profile.reality.incomeMode
  const q5 = r.profile.userBelief.perceivedRootCause
  const q4 = r.profile.desiredChange.primaryProblem
  const pb = r.primaryBottleneck

  // L1 USER EVIDENCE (<=2 anchors): reality + goal.
  const e1 = `你现在${copy.getIncomeShort(q2)}，想要的其实是${copy.getProblemPhrase(q4)}。`
  const e2 = `你以为${copy.getBeliefShort(q5)}。`
  // L2 -> L3 leap: why the operating rule conflicts with the world mechanism.
  const leap = copy.getWhyRuleFails(pb)

  const text = `${e1}${e2}${leap}`

  return {
    text,
    provenance: {
      sourceFields: ['reality.incomeMode', 'desiredChange.primaryProblem', 'userBelief.perceivedRootCause', 'primaryBottleneck'],
      sourceQuestionIds: ['Q2', 'Q4', 'Q5'],
      sourceRuleIds: [r.trace.selectedRuleId, r.beliefRelation.explanationRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildCoreProblem }
