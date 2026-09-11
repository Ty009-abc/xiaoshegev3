'use strict'
/**
 * turnaroundStrategy/v6/report/systemLoopV6.js
 *
 * CARD 03 — 系统困局.
 * A five-step real-life loop:
 *   STEP1 现实起点  STEP2 想改变  STEP3 默认行为  STEP4 停滞结果  STEP5 旧解释被强化
 * CONSUMER LAYER ONLY. Deterministic. No abstract cognitive model. No AI.
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
    `STEP 1　现实起点：${copy.getIncomeShort(q2)}，但${copy.getProblemPhrase(q4)}。`,
    `STEP 2　想改变：${copy.getChangeIntent(pb)}。`,
    `STEP 3　默认行为：${copy.getStageNow(q6)}；一遇到不确定，就${copy.getQ7(q7)}。`,
    `STEP 4　停滞结果：${copy.getStall(pb)}；于是你${copy.getQ9(q9)}。`,
    `STEP 5　旧解释被强化：最后你更相信——${copy.getBeliefClause(q5)}。`
  ]

  return {
    steps,
    text: steps.join('\n'),
    provenance: {
      sourceFields: ['reality.incomeMode', 'desiredChange.primaryProblem', 'userBelief.perceivedRootCause', 'executionStage', 'behavior.uncertaintyResponse', 'behavior.noResultResponse'],
      sourceQuestionIds: ['Q2', 'Q4', 'Q5', 'Q6', 'Q7', 'Q9'],
      sourceRuleIds: [r.trace.selectedRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildSystemLoop }
