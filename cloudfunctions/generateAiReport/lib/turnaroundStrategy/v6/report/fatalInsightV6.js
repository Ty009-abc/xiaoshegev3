'use strict'
/**
 * turnaroundStrategy/v6/report/fatalInsightV6.js
 *
 * CARD 01 — 致命一句话.
 * R33 §5 — WRONG RULE COLLISION: expose ONE mistaken decision rule and the
 * world rule that contradicts it, in one sharp sentence.
 *
 * CONSUMER LAYER ONLY: no diagnosis, no eligibility, no scoring, no AI.
 * Differentiation: keys on belief-lack (GAP), primaryProblem (MATCH), or belief
 * (PARTIAL) so two different 9Q profiles never receive identical copy.
 */

const copy = require('./reportCopyV6.js')

const REL_GAP = 'BELIEF_REALITY_GAP'
const REL_PARTIAL = 'BELIEF_PARTIAL'

/**
 * @param {Object} r diagnoseTurnaroundV6 output (PRIMARY state only)
 * @returns {{text:string, provenance:Object}}
 */
function buildFatalInsight (r) {
  const q5 = r.profile.userBelief.perceivedRootCause
  const q4 = r.profile.desiredChange.primaryProblem
  const pb = r.primaryBottleneck
  const rel = r.beliefRelation.relation

  const wrongRule = copy.getWrongRule(pb)
  const worldTail = copy.getWorldRuleTail(pb)

  let text
  if (rel === REL_PARTIAL) {
    text = `你把“${copy.getBeliefShort(q5)}”当成了全部原因，真正的规则是：${worldTail}。`
  } else if (rel === REL_GAP) {
    // Expose the mistaken lack-frame, then the mistaken rule, then the world rule.
    text = `你以为缺的是${copy.getBeliefLack(q5)}，其实卡住你的是“${wrongRule}”——${worldTail}。`
  } else {
    // MATCH: the goal is right; the rule to reach it is wrong.
    text = `你判断得没错，${copy.getProblemPhrase(q4)}；但按“${wrongRule}”做行不通——${worldTail}。`
  }

  if ([...text].length > 60) {
    text = `问题不在缺${copy.getBeliefLack(q5)}，而在于“${wrongRule}”——${worldTail}。`
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
