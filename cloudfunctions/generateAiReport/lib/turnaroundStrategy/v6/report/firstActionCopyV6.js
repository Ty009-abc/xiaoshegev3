'use strict'
/**
 * turnaroundStrategy/v6/report/firstActionCopyV6.js
 *
 * CARD 05 — 现在就做 / REALITY TEST.
 * R33 §9 — one action that produces an EXTERNAL SIGNAL, with WHAT · WHO/WHERE ·
 * TIMEBOX · EXTERNAL SIGNAL · DECISION RULE. NOT habit formation.
 * Reality constraint may RESIZE the action (never replace the diagnosis).
 * CONSUMER LAYER ONLY. Deterministic. No AI.
 *
 * Differentiation (report test uniqueness): stage (Q6) + q4 + firstActionType.
 */

const copy = require('./reportCopyV6.js')

/**
 * @param {Object} r diagnoseTurnaroundV6 output (PRIMARY state only)
 * @returns {{action:string, checks:string[], timebox:string, verifyWith:string, done:string, decision:string, externalSignal:boolean, text:string, provenance:Object}}
 */
function buildFirstAction (r) {
  const action = r.firstActionType
  const pb = r.primaryBottleneck
  const q3 = r.profile.reality.monthlySurplus
  const q4 = r.profile.desiredChange.primaryProblem
  const stage = r.executionStage
  const rel = r.beliefRelation.relation
  const rcTypes = (r.realityConstraint && r.realityConstraint.types) || []
  const cashflow = rcTypes.includes('CASHFLOW_PRESSURE')

  // Base action sentence from the frozen firstActionType.
  const base = copy.getActionExpression(action)

  // Reality constraint may RESIZE (append a sizing clause), never replace.
  let sized = base
  if (!cashflow && (rcTypes.includes('LOW_SURPLUS') || rcTypes.includes('UNSTABLE_INCOME'))) {
    sized = `${base}（${copy.getScaleNote(q3)}。）`
  }

  const checks = copy.getSupportChecks(pb).slice(0, 3)
  const spec = copy.getActionSpec(action)
  let decision = copy.getRealityDecision(action)
  const externalSignal = copy.EXTERNAL_SIGNAL_PAT.test(base + ' ' + spec.done + ' ' + decision)

  // §10 GENERIC_PRODUCTIVITY rescue: if the core action reads habit-flavoured
  // WITHOUT an explicit external signal, append a deterministic external-signal
  // line so CARD05 always produces external evidence (never bare habit advice).
  if (copy.GENERIC_PRODUCTIVITY_PAT.test(sized) && !copy.EXTERNAL_SIGNAL_PAT.test(sized + ' ' + spec.done)) {
    decision = `${decision}同时把每一天的完成结果，发给一个真实的人，拿到一句真实反馈。`
  }

  // R33 §9/§13: one headline + max 3 short execution lines.
  const headline = `你${copy.getStageLead(stage)}，最想解决的是${copy.getProblemPhrase(q4)}。今天就做这一件：${sized}`
  const line1 = `在哪做：${spec.verifyWith}；时限：${spec.timebox}。`
  const line2 = `看什么信号：${spec.done}——是外部反馈，不是“我想清楚了”。`
  const line3 = `怎么用它：${decision}`
  const text = `${headline}${line1}${line2}${line3}${copy.getRelBridge(rel)}`

  return {
    action: sized,
    checks,
    timebox: spec.timebox,
    verifyWith: spec.verifyWith,
    done: spec.done,
    decision,
    externalSignal: externalSignal || copy.EXTERNAL_SIGNAL_PAT.test(decision),
    text,
    provenance: {
      sourceFields: ['firstActionType', 'executionStage', 'primaryBottleneck', 'realityConstraint', 'desiredChange.primaryProblem', 'beliefRelation.relation'],
      sourceQuestionIds: ['Q6', 'Q3', 'Q4', 'Q5'],
      sourceRuleIds: [r.trace.selectedRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildFirstAction }
