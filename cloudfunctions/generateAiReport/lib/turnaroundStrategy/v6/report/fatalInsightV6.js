'use strict'
/**
 * turnaroundStrategy/v6/report/fatalInsightV6.js
 *
 * CARD 01 — 致命一句话.
 * Translates the frozen B1 diagnosis into ONE strong, personal sentence.
 * CONSUMER LAYER ONLY: no diagnosis, no eligibility, no scoring, no AI.
 */

const copy = require('./reportCopyV6.js')

const REL_GAP = 'BELIEF_REALITY_GAP'
const REL_PARTIAL = 'BELIEF_PARTIAL'

/**
 * @param {Object} r diagnoseTurnaroundV6 output (PRIMARY state only)
 * @returns {{text:string, provenance:{sourceFields:string[],sourceQuestionIds:string[],sourceRuleIds:string[]}}}
 */
function buildFatalInsight (r) {
  const q5 = r.profile.userBelief.perceivedRootCause
  const pb = r.primaryBottleneck
  const rel = r.beliefRelation.relation
  const q4 = r.profile.desiredChange.primaryProblem

  let text
  if (rel === REL_GAP) {
    // Break the mistaken self-explanation with a sharp contrast (R31 §3/§10).
    // Phrased to avoid the REALITY_DENIAL guard (never “你不是缺X，只是…”).
    text = `缺的从来不是${copy.getBeliefLack(q5)}，而是${copy.getGapTail(pb)}。`
  } else if (rel === REL_PARTIAL) {
    text = `你把${copy.getBeliefShort(q5)}当成了全部原因，其实更卡住你的是${copy.getGapTail(pb)}。`
  } else {
    text = `你判断得没错，${copy.getProblemPhrase(q4)}；但答案不在想，而在${copy.getMatchTail(pb)}。`
  }

  return {
    text,
    provenance: {
      sourceFields: ['userBelief.perceivedRootCause', 'primaryBottleneck', 'beliefRelation.relation', 'desiredChange.primaryProblem'],
      sourceQuestionIds: ['Q5', 'Q4'],
      sourceRuleIds: [r.trace.selectedRuleId, r.beliefRelation.explanationRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildFatalInsight, REL_GAP, REL_PARTIAL }
