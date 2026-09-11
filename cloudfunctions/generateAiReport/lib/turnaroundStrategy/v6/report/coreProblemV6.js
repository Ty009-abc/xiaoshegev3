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
  const q5 = r.profile.userBelief.perceivedRootCause
  const q7 = r.profile.behavior.uncertaintyResponse
  const q4 = r.profile.desiredChange.primaryProblem
  const pb = r.primaryBottleneck
  const stage = r.executionStage

  const clause0 = `你现在最卡的一点：${copy.getProblemPhrase(q4)}。`
  const clause1 = `你以为${copy.getBeliefShort(q5)}。可实际上，${copy.getStageNow(stage)}。`
  const clause2 = `一遇到不确定，你又会${copy.getQ7(q7)}。`
  const clause3 = `结果就是：${copy.getStall(pb)}。所以${copy.getMechanism(pb)}`

  const text = `${clause0}${clause1}${clause2}${clause3}`

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
