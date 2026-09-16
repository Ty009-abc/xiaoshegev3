'use strict'
/**
 * turnaroundStrategy/v6/report/firstActionCopyV6.js
 *
 * CARD 05 — 现在就做.
 * ONE dominant action executable within 24h, plus 0–3 short checks, PLUS the
 * R31 §7/§12 specification: TIME BOX · WHO VERIFIES · DONE CRITERION.
 * Reality constraint may RESIZE the action (never replace the diagnosis).
 * CONSUMER LAYER ONLY. Deterministic. No AI.
 */

const copy = require('./reportCopyV6.js')

/**
 * @param {Object} r diagnoseTurnaroundV6 output (PRIMARY state only)
 * @returns {{action:string, checks:string[], timebox:string, verifyWith:string, done:string, text:string, provenance:Object}}
 */
function buildFirstAction (r) {
  const action = r.firstActionType
  const pb = r.primaryBottleneck
  const q3 = r.profile.reality.monthlySurplus
  const q4 = r.profile.desiredChange.primaryProblem
  const rel = r.beliefRelation.relation
  const stage = r.executionStage
  const rcTypes = (r.realityConstraint && r.realityConstraint.types) || []
  const cashflow = rcTypes.includes('CASHFLOW_PRESSURE')

  // Base action sentence from the frozen firstActionType.
  const base = copy.getActionExpression(action)

  // Reality constraint may RESIZE (append a sizing clause), never replace.
  let sized = base
  if (cashflow) {
    // Base CASHFLOW_SAFE_EXPERIMENT copy is already capital-safe; no extra note.
    sized = base
  } else if (rcTypes.includes('LOW_SURPLUS') || rcTypes.includes('UNSTABLE_INCOME')) {
    sized = `${base}（${copy.getScaleNote(q3)}。）`
  }

  const checks = copy.getSupportChecks(pb).slice(0, 3)
  const spec = copy.getActionSpec(action)

  // R31 §7/§12: concise, structured, external-evidence based. Grounded in this
  // user's stage + problem; never "努力/坚持/多尝试".
  const lead = `你现在${copy.getStageLead(stage)}，针对“${copy.getProblemPhrase(q4)}”，今天只做一件：${sized}`
  const box = `时限：${spec.timebox}；拿给${spec.verifyWith}验证。`
  const doneLine = `完成标准：${spec.done}（不是“我想清楚了”）。`
  const text = `${lead}${box}${doneLine}${copy.getRelBridge(rel)}`

  return {
    action: sized,
    checks,
    timebox: spec.timebox,
    verifyWith: spec.verifyWith,
    done: spec.done,
    text,
    provenance: {
      sourceFields: ['firstActionType', 'executionStage', 'primaryBottleneck', 'realityConstraint', 'desiredChange.primaryProblem', 'beliefRelation.relation'],
      sourceQuestionIds: ['Q6', 'Q3', 'Q4', 'Q5'],
      sourceRuleIds: [r.trace.selectedRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildFirstAction }
