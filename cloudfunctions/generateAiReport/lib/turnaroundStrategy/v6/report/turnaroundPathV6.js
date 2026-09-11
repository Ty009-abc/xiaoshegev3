'use strict'
/**
 * turnaroundStrategy/v6/report/turnaroundPathV6.js
 *
 * CARD 04 — 翻身路径.
 * Shows current → next: what the user is doing now vs the next productive state.
 * CONSUMER LAYER ONLY. Deterministic. No promise of guaranteed success. No AI.
 */

const copy = require('./reportCopyV6.js')

/**
 * @param {Object} r diagnoseTurnaroundV6 output (PRIMARY state only)
 * @returns {{from:string, to:string, text:string, provenance:Object}}
 */
function buildTurnaroundPath (r) {
  const stage = r.executionStage
  const pb = r.primaryBottleneck
  const q4 = r.profile.desiredChange.primaryProblem
  const rel = r.beliefRelation.relation

  const from = copy.getPathFrom(stage)
  const to = copy.getPathTo(pb)
  const text = `你现在的状态：${from}。\n具体卡在：${copy.getProblemPhrase(q4)}。\n接下来要做的：${to}。\n${copy.getRelBridge(rel)}`

  return {
    from,
    to,
    text,
    provenance: {
      sourceFields: ['executionStage', 'recommendedNextStage', 'primaryBottleneck', 'desiredChange.primaryProblem', 'beliefRelation.relation'],
      sourceQuestionIds: ['Q6', 'Q4', 'Q5'],
      sourceRuleIds: [r.trace.selectedRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildTurnaroundPath }
