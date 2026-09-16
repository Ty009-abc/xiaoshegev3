'use strict'
/**
 * turnaroundStrategy/v6/report/coreProblemV6.js
 *
 * CARD 02 — 核心问题.
 * Explains WHY Card 01 is true: belief → actual behavior → pattern → consequence.
 * CONSUMER LAYER ONLY. Deterministic. No diagnosis. No AI.
 *
 * Causal shape: 你以为…… 但…… 而且……时你…… 所以……
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

  // R31 §4: REALITY ANCHOR + HIDDEN MECHANISM + WHY IT MATTERS.
  // Diagnostic leap (not a questionnaire restatement). Behavior/Q7 lives in
  // CARD03 so the two cards stay non-repetitive (§9).
  const anchor = `你现在${copy.getIncomeShort(q2)}，最想解决的是：${copy.getProblemPhrase(q4)}。`
  const belief = `你以为${copy.getBeliefShort(q5)}。`
  const mechanism = `${copy.getHiddenMechanism(pb)}`
  const consequence = `于是${copy.getStall(pb)}——这才是卡住你的地方。`

  const text = `${anchor}${belief}${mechanism}${consequence}`

  return {
    text,
    provenance: {
      sourceFields: ['desiredChange.primaryProblem', 'userBelief.perceivedRootCause', 'executionStage', 'behavior.uncertaintyResponse', 'primaryBottleneck'],
      sourceQuestionIds: ['Q4', 'Q5', 'Q6', 'Q7'],
      sourceRuleIds: [r.trace.selectedRuleId, r.beliefRelation.explanationRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildCoreProblem }
