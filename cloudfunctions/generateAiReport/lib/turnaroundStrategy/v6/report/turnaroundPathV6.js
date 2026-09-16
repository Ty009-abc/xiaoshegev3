'use strict'
/**
 * turnaroundStrategy/v6/report/turnaroundPathV6.js
 *
 * CARD 04 — 翻身路径.
 * Shows the system to replace the old one (R31 §6): OLD decision rule →
 * NEW decision rule, plus one concrete operating mechanism.
 * CONSUMER LAYER ONLY. Deterministic. No promise of guaranteed success. No AI.
 *
 * `from` / `to` remain the FROZEN B2 authority (tests + editor depend on them).
 * `logic` is the concise, complete user-facing expression (client body); the
 * editor may replace `logic` with a validated AI transitionExplanation.
 * `text` is retained for the personalization/visibleText contract.
 */

const copy = require('./reportCopyV6.js')

/**
 * @param {Object} r diagnoseTurnaroundV6 output (PRIMARY state only)
 * @returns {{from:string, to:string, logic:string, text:string, provenance:Object}}
 */
function buildTurnaroundPath (r) {
  const stage = r.executionStage
  const pb = r.primaryBottleneck
  const q4 = r.profile.desiredChange.primaryProblem
  const rel = r.beliefRelation.relation

  const from = copy.getPathFrom(stage)
  const to = copy.getPathTo(pb)
  // R31 §6: user-facing decision-rule swap + one operating mechanism.
  const oldRule = copy.getDecisionFrom(pb)
  const newRule = copy.getDecisionTo(pb)
  const mech = copy.getOperatingMech(pb)
  const logic = `从「${oldRule}」换成「${newRule}」。具体就是：${mech}`

  const text = [
    `你现在：${from}。`,
    `卡在：${copy.getProblemPhrase(q4)}。`,
    `旧规则：${oldRule}。`,
    `新规则：${newRule}。`,
    copy.getRelBridge(rel)
  ].join('\n')

  return {
    from,
    to,
    logic,
    text,
    provenance: {
      sourceFields: ['executionStage', 'recommendedNextStage', 'primaryBottleneck', 'desiredChange.primaryProblem', 'beliefRelation.relation'],
      sourceQuestionIds: ['Q6', 'Q4', 'Q5'],
      sourceRuleIds: [r.trace.selectedRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildTurnaroundPath }
