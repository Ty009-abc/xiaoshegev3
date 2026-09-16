'use strict'
/**
 * turnaroundStrategy/v6/report/systemLoopV6.js
 *
 * CARD 03 — 系统困局.
 * R33 §7 — CONSEQUENCE LOOP: ONE representation only, exactly 5 short nodes:
 *   旧规则 → 触发/默认反应 → 短期安慰 → 长期代价 → 同一问题回来
 * Then one structural-consequence line. No STEP labels.
 * CONSUMER LAYER ONLY. Deterministic. No AI. No STEP labels.
 *
 * NOTE: finalValidatorV6 requires exactly 5 loop nodes — keep the count at 5.
 * Differentiation (report test uniqueness): stage (Q6) + q7 + q9 + q4.
 */

const copy = require('./reportCopyV6.js')

/**
 * @param {Object} r diagnoseTurnaroundV6 output (PRIMARY state only)
 * @returns {{steps:string[], insight:string, text:string, provenance:Object}}
 */
function buildSystemLoop (r) {
  const q6 = r.executionStage
  const q7 = r.profile.behavior.uncertaintyResponse
  const q9 = r.profile.behavior.noResultResponse
  const q4 = r.profile.desiredChange.primaryProblem
  const pb = r.primaryBottleneck

  const steps = [
    copy.getLoopNode1(pb),
    `触发：你${copy.getStageLead(q6)}；一遇到不确定，就${copy.getQ7(q7)}。`,
    copy.getLoopNode3(pb),
    `${copy.getLoopNode4(pb)}于是你${copy.getQ9(q9)}。`,
    `又回到同一个问题：${copy.getProblemPhrase(q4)}。`
  ]

  const insight = copy.getStructuralConsequence(pb)

  return {
    steps,
    insight,
    text: steps.join('\n'),
    provenance: {
      sourceFields: ['primaryBottleneck', 'executionStage', 'behavior.uncertaintyResponse', 'behavior.noResultResponse', 'desiredChange.primaryProblem'],
      sourceQuestionIds: ['Q6', 'Q7', 'Q9', 'Q4'],
      sourceRuleIds: [r.trace.selectedRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildSystemLoop }
