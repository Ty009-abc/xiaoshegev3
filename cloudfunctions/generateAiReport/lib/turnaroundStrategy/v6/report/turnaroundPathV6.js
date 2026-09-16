'use strict'
/**
 * turnaroundStrategy/v6/report/turnaroundPathV6.js
 *
 * CARD 04 — 翻身路径.
 * R33 §8 — REPLACEMENT WORLD MODEL (intellectual core): OLD decision rule ->
 * NEW decision rule, plus one concrete operating mechanism.
 * R34 §10 — append ONE short human world-rule statement (the shareable line).
 * CONSUMER LAYER ONLY. Deterministic. No promise of guaranteed success. No AI.
 *
 * `from` / `to` remain the FROZEN B2 authority (tests + editor depend on them).
 * `logic` is the concise user-facing expression (client body).
 */

const copy = require('./reportCopyV6.js')

/**
 * @param {Object} r diagnoseTurnaroundV6 output (PRIMARY state only)
 * @returns {{from:string, to:string, logic:string, worldRuleLine:string, text:string, provenance:Object}}
 */
function buildTurnaroundPath (r) {
  const stage = r.executionStage
  const pb = r.primaryBottleneck
  const q4 = r.profile.desiredChange.primaryProblem
  const rel = r.beliefRelation.relation

  const hy = r.hybrid || null
  // R46 §8/§10: for PAID bands the FROM/TO are proof-aware (hy.proofFrom /
  // hy.proofTo); otherwise the frozen B2 authority copy (byte-identical when no
  // hybrid context). The market-proof FACT outranks the generic B2 phrase.
  const from = (hy && hy.proofFrom) || copy.getPathFrom(stage)
  const to = (hy && hy.proofTo) || copy.getPathTo(pb)
  // R33 §8 + R34 §10: OLD RULE -> NEW RULE (world model) + one operating
  // mechanism + one short human world-rule statement.
  const oldRule = copy.getWrongRule(pb)
  const newRule = copy.getNewRule(pb)
  const mech = copy.getOperatingMech(pb)
  const worldRuleLine = copy.getWorldOneLiner(pb)
  const logic = `从「${oldRule}」换成「${newRule}」。具体就是：${mech}`
  const display = `${logic}\n${worldRuleLine}`

  // R44 §16/§17/§18 — ADDITIVE strategy specificity (old value position -> new
  // value/strategy position), evidence-gated by the asset axis. Gated: when
  // `r.hybrid` is absent this is '' and the card is byte-identical to pre-R44.
  const specificity = hy ? (hy.pathLine || '') : ''

  const text = [
    `你现在：${from}。`,
    `卡在：${copy.getProblemPhrase(q4)}。`,
    `旧规则：${oldRule}。`,
    `新规则：${newRule}。`,
    worldRuleLine,
    copy.getRelBridge(rel)
  ].join('\n')

  return {
    from,
    to,
    logic,
    display,
    worldRuleLine,
    specificity,
    text,
    provenance: {
      sourceFields: ['executionStage', 'recommendedNextStage', 'primaryBottleneck', 'desiredChange.primaryProblem', 'beliefRelation.relation']
        .concat(hy ? ['asset.state', 'reality.occupation'] : []),
      sourceQuestionIds: ['Q6', 'Q4', 'Q5'],
      sourceRuleIds: [r.trace.selectedRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildTurnaroundPath }
