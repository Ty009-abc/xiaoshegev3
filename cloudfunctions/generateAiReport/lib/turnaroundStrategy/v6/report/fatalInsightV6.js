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
    text = `你以为缺的是${copy.getBeliefLack(q5)}，其实真正卡住你的，是${copy.getGapTail(pb)}。`
  } else if (rel === REL_PARTIAL) {
    text = `你以为是${copy.getBeliefShort(q5)}，它确实占了一部分；但更关键的，是${copy.getGapTail(pb)}。`
  } else {
    text = `你对自己的判断基本没错：${copy.getProblemPhrase(q4)}，真正要解决的是——${copy.getMatchTail(pb)}。`
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
