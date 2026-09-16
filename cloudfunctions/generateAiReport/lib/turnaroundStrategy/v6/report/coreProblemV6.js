'use strict'
/**
 * turnaroundStrategy/v6/report/coreProblemV6.js
 *
 * CARD 02 — 核心问题.
 * R33 §6 — WHY THE RULE FAILS: personal evidence anchors, then explain why the
 * user's current rule conflicts with how the world actually works (a DIAGNOSTIC
 * LEAP, never an answer restatement).
 * R34 §9 — humanized: reads like reasoning, NOT questionnaire playback. Leads
 * with a compact reality anchor + belief clause, then a mechanism leap.
 *
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
  const rel = r.beliefRelation.relation

  // L1 USER EVIDENCE (2–3 compact anchors): reality + belief-lack + goal.
  // §1 semantic-role fix — the CURRENT_PROBLEM is the object of 卡在/最想解决
  // (never dropped after 想要的是, which would be ungrammatical).
  // §9 humanization — natural clauses, not form-field assembly.
  let lead
  if (rel === 'BELIEF_REALITY_GAP') {
    lead = `你现在${copy.getIncomeShort(q2)}，卡在${copy.getProblemPhrase(q4)}上。`
  } else if (rel === 'BELIEF_PARTIAL') {
    lead = `你现在${copy.getIncomeShort(q2)}，最想解决的是${copy.getProblemPhrase(q4)}。`
  } else {
    lead = `你现在${copy.getIncomeShort(q2)}，一心想把${copy.getProblemPhrase(q4)}这件事推过去。`
  }
  const belief = copy.beliefLead(copy.getBeliefLack(q5))
  // L2 -> L3 leap: why the operating rule conflicts with the world mechanism.
  const leap = copy.getCard02Leap(pb)

  const text = `${lead}${belief}${leap}`

  return {
    text,
    provenance: {
      sourceFields: ['reality.incomeMode', 'desiredChange.primaryProblem', 'userBelief.perceivedRootCause', 'primaryBottleneck', 'beliefRelation.relation'],
      sourceQuestionIds: ['Q2', 'Q4', 'Q5'],
      sourceRuleIds: [r.trace.selectedRuleId, r.beliefRelation.explanationRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildCoreProblem }
