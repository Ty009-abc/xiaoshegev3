'use strict'
/**
 * turnaroundStrategy/v6/report/systemLoopV6.js
 *
 * CARD 03 — 系统困局.
 * ONE behavioral loop in five short nodes (R31 §5):
 *   触发 → 默认反应 → 短期安慰 → 长期代价 → 原有错误认知被强化
 * Then one plain insight sentence.
 * CONSUMER LAYER ONLY. Deterministic. No abstract cognitive model. No AI.
 * No STEP labels / PPT feeling (§5/§11).
 *
 * NOTE: the deterministic report builder + final validator require EXACTLY 5
 * loop nodes (finalValidatorV6 `loopStepCount === 5`). R31 restyles the 5 nodes
 * but MUST keep the count at 5.
 */

const copy = require('./reportCopyV6.js')

/**
 * @param {Object} r diagnoseTurnaroundV6 output (PRIMARY state only)
 * @returns {{steps:string[], text:string, provenance:Object}}
 */
function buildSystemLoop (r) {
  const q2 = r.profile.reality.incomeMode
  const q4 = r.profile.desiredChange.primaryProblem
  const q5 = r.profile.userBelief.perceivedRootCause
  const q6 = r.profile.executionStage.currentStage
  const q7 = r.profile.behavior.uncertaintyResponse
  const q9 = r.profile.behavior.noResultResponse
  const pb = r.primaryBottleneck

  const steps = [
    `触发：${copy.getIncomeShort(q2)}，但${copy.getProblemPhrase(q4)}。`,
    `默认反应：${copy.getStageNow(q6)}；一遇到不确定，就${copy.getQ7(q7)}。`,
    `短期安慰：${copy.getQ7Relief(q7)}。`,
    `长期代价：${copy.getStall(pb)}；于是你${copy.getQ9(q9)}。`,
    `认知被强化：最后你更确信——${copy.getBeliefClause(q5)}。`
  ]

  const insight = `这个循环最麻烦的地方：${copy.getMechanism(pb)}`

  return {
    steps,
    text: steps.join('\n'),
    insight,
    provenance: {
      sourceFields: ['reality.incomeMode', 'desiredChange.primaryProblem', 'userBelief.perceivedRootCause', 'executionStage', 'behavior.uncertaintyResponse', 'behavior.noResultResponse'],
      sourceQuestionIds: ['Q2', 'Q4', 'Q5', 'Q6', 'Q7', 'Q9'],
      sourceRuleIds: [r.trace.selectedRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildSystemLoop }
