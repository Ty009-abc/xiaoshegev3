'use strict'
/**
 * turnaroundStrategy/v6/report/fatalInsightV6.js
 *
 * CARD 01 — 致命一句话.
 * R33 §5 — WRONG RULE COLLISION: expose ONE mistaken decision rule and the
 * world rule that contradicts it, in one sharp sentence.
 * R33.1 §6/§13 — shorten to ≤40 Chinese chars with natural variation.
 *
 * CONSUMER LAYER ONLY: no diagnosis, no eligibility, no scoring, no AI.
 * Differentiation: keys on belief-lack (GAP), primaryProblem (MATCH), or belief
 * (PARTIAL) so two different 9Q profiles never receive identical copy.
 */

const copy = require('./reportCopyV6.js')

const REL_GAP = 'BELIEF_REALITY_GAP'
const REL_PARTIAL = 'BELIEF_PARTIAL'
// R33 §6/§13: CARD01 target ceiling (40 Chinese chars).
const CARD01_MAX = 40

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

  // §6/§13 — natural variation within ≤40 chars. Each rule-collision carries
  // the evidence anchor (belief-lack / belief / problem) so two distinct 9Q
  // profiles never receive identical copy, while no single template dominates.
  let text
  if (rel === REL_PARTIAL) {
    text = `你把“${copy.getBeliefShort(q5)}”当成了全部原因，规则其实是“${wrongRule}”。`
    if ([...text].length > CARD01_MAX) {
      text = `卡住你的不是“${copy.getBeliefShort(q5)}”，是“${wrongRule}”。`
    }
  } else if (rel === REL_GAP) {
    text = `你以为缺的是${copy.getBeliefLack(q5)}，真正卡住你的是“${wrongRule}”。`
    if ([...text].length > CARD01_MAX) {
      text = `卡住你的不是缺${copy.getBeliefLack(q5)}，是“${wrongRule}”。`
    }
  } else {
    // MATCH: the goal is right; the rule to reach it is wrong.
    text = copy.getMatchC01(pb, q4)
  }

  if ([...text].length > CARD01_MAX) {
    text = `卡住你的是“${wrongRule}”这条规则。`
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
