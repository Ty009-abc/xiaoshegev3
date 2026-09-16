'use strict'
/**
 * turnaroundStrategy/v6/report/systemLoopV6.js
 *
 * CARD 03 — 系统困局.
 * R33 §7 — CONSEQUENCE LOOP: ONE representation, exactly 5 short nodes.
 * R34 §4 — STRUCTURE VARIATION: the SAME "5 nodes" carrier can be expressed in
 * ≥3 different families, chosen by mechanism. Families in use:
 *   LOOP          (DIRECTION_GAP)      X → Y → Z → X
 *   CONTRADICTION (ACTION_GAP)         想得到X / 规则要求Y / 结果制造Z
 *   ACCUMULATION  (CONSISTENCY_GAP)    每次做A → 丢掉B → 重启 → 从不累积
 *   REFRAME       (VALIDATION/REPEAT)  误把A当成关键，其实是B
 * Steady state has exactly ONE family per report (no duplicate
 * paragraph+bullets); across the review set ≥3 families appear.
 *
 * NOTE: finalValidatorV6 requires exactly 5 loop nodes — keep the count at 5.
 * CONSUMER LAYER ONLY. Deterministic. No AI. No STEP labels.
 */

const copy = require('./reportCopyV6.js')

/**
 * @param {Object} r diagnoseTurnaroundV6 output (PRIMARY state only)
 * @returns {{steps:string[], insight:string, text:string, family:string, provenance:Object}}
 */
function buildSystemLoop (r) {
  const q6 = r.executionStage
  const q7 = r.profile.behavior.uncertaintyResponse
  const q9 = r.profile.behavior.noResultResponse
  const q4 = r.profile.desiredChange.primaryProblem
  const q5 = r.profile.userBelief.perceivedRootCause
  const pb = r.primaryBottleneck

  const family = copy.getCard03Family(pb)
  const problem = copy.getProblemPhrase(q4)
  const ruleShort = copy.getC01RuleShort(pb)
  const stageLead = copy.getStageLead(q6)

  let steps
  if (family === 'CONTRADICTION') {
    steps = [
      `你真正想要的是${copy.getDesiredState(q4)}，但你的规则是「${ruleShort}」。`,
      `它要求你“等一切都准备好再开始”；一遇到不确定，你就${copy.getQ7(q7)}。`,
      copy.getC03ContraMid(pb),
      `结果就是：你${stageLead}，手里始终没有能推翻判断的真实信息。`,
      `又回到同一个问题：${problem}。`
    ]
  } else if (family === 'ACCUMULATION') {
    steps = [
      `旧规则：${ruleShort}。`,
      copy.getC03AccStart(pb),
      copy.getC03AccMid(pb),
      copy.getC03AccCost(pb),
      `又回到同一个问题：${problem}。`
    ]
  } else if (family === 'REFRAME') {
    const mid = pb === 'REPEATABILITY_GAP'
      ? `你现在${stageLead}，也就更容易把这一次当成必然。`
      : copy.getC03ReframeMid(pb)
    steps = [
      `你一直在用「${ruleShort}」这条规则。`,
      copy.getC03ReframeBehavior(pb),
      mid,
      copy.getC03ReframeTruth(pb),
      `又回到同一个问题：${problem}。`
    ]
  } else {
    // LOOP
    steps = [
      `旧规则：${ruleShort}。`,
      `触发：你${copy.getStageLead(q6)}；一遇到不确定，就${copy.getQ7(q7)}。`,
      copy.getC03LoopRelief(pb),
      copy.getC03LoopCost(pb),
      `又回到同一个问题：${problem}。`
    ]
  }

  const insight = copy.getStructuralConsequence(pb)

  return {
    steps,
    insight,
    family,
    text: steps.join('\n'),
    provenance: {
      sourceFields: ['primaryBottleneck', 'executionStage', 'behavior.uncertaintyResponse', 'behavior.noResultResponse', 'desiredChange.primaryProblem', 'userBelief.perceivedRootCause'],
      sourceQuestionIds: ['Q6', 'Q7', 'Q9', 'Q4', 'Q5'],
      sourceRuleIds: [r.trace.selectedRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildSystemLoop }
