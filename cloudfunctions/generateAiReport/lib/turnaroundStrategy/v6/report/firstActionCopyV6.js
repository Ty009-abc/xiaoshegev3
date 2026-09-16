'use strict'
/**
 * turnaroundStrategy/v6/report/firstActionCopyV6.js
 *
 * CARD 05 — 现在就做 / REALITY TEST.
 * R33 §9 — one action that produces an EXTERNAL SIGNAL.
 * R34 §6/§7/§8 — REALITY TEST semantic contract: HYPOTHESIS · ACTION · TARGET ·
 * TIMEBOX · OBSERVABLE SIGNAL · DECISION, where the signal ANSWERS the
 * hypothesis and the decision reads the SAME signal. NOT habit formation.
 * R35 §4/§5/§6/§7 — EVIDENCE-STRENGTH gate: a single weak signal may be a FIRST
 * SIGNAL but must NOT be treated as a final direction decision; decision rules
 * must use evidence strength (weak/medium/strong) appropriately. DIRECTION and
 * REPEATABILITY decisions require several independent signals or one strong
 * economic signal; CONSISTENCY never treats the timebox itself as success.
 * Reality constraint may RESIZE the action (never replace the diagnosis).
 * CONSUMER LAYER ONLY. Deterministic. No AI.
 */

const copy = require('./reportCopyV6.js')

/**
 * @param {Object} r diagnoseTurnaroundV6 output (PRIMARY state only)
 * @returns {{hypothesis:string, action:string, target:string, checks:string[],
 *   timebox:string, verifyWith:string, done:string, decision:string,
 *   evidenceStrength:string, firstSignalOnly:boolean, overclaim:boolean,
 *   externalSignal:boolean, eventPrimary:boolean, text:string, provenance:Object}}
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

  const spec = copy.getRealityTest(action) || {}
  const checks = copy.getSupportChecks(pb).slice(0, 3)

  // Base reality-test action (the PRIMARY action itself creates a real-world
  // event: ask / send / show / contact / transact).
  let sized = spec.action || copy.getActionExpression(action)

  // Reality constraint may RESIZE (append a sizing clause), never replace.
  if (!cashflow && (rcTypes.includes('LOW_SURPLUS') || rcTypes.includes('UNSTABLE_INCOME'))) {
    sized = `${sized}（${copy.getScaleNote(q3)}。）`
  }

  const timebox = spec.timebox || '今天内完成'
  const verifyWith = spec.target || '一个真实的人'
  // §6: the observable signal IS the branch outcome (positive/negative/ambiguous)
  // so it clearly answers the hypothesis.
  const done = [spec.observableSignal, spec.ifPositive, spec.ifNegative, spec.ifAmbiguous]
    .filter(Boolean).join(' ')
  const decision = spec.decision || '只要拿到一条真实反馈，就用它修正下一步。'

  // §5 — EVIDENCE STRENGTH of the signal the decision-relevant core names.
  const evidenceStrength = copy.evidenceStrength(done)
  // §4 — a DIRECTION decision on a single weak/medium signal is an overclaim.
  const overclaim = copy.singleWeakSignalOverclaim(action, done, decision)
  const firstSignalOnly = overclaim

  const eventPrimary = copy.MARKET_FACING_PAT.test(sized)
  const externalSignal = copy.EXTERNAL_SIGNAL_PAT.test(done + ' ' + decision) && !copy.HABIT_ONLY_PAT.test(sized.replace(/每天把同一个/, ''))

  // R34 §10: one headline + structured REALITY-TEST lines. `text` is the
  // internal full form; the CLIENT renders the structured block.
  const headline = `今天要验证的是：${spec.hypothesis || '你的方向真的有人需要。'}`
  const line0 = `先赌一个假设：${spec.hypothesis || '你的方向真的有人需要。'}`
  const line1 = `怎么做：${sized}`
  const line2 = `找谁：${verifyWith}；多久：${timebox}`
  const line3 = `看什么信号：${done}`
  const line4 = `怎么用它：${decision}`
  // §2 distinctness: fold the goal into an otherwise-identical action block so two
  // same-action-type reports never render byte-identical CARD05 copy.
  const goalLine = `你现在${copy.getStageLead(stage)}，这一小步瞄准的是：${copy.getProblemRealization(q4)}。`
  const text = `${headline}${line0}${goalLine}${line1}${line2}${line3}${line4}${copy.getRelBridge(rel)}`

  return {
    hypothesis: spec.hypothesis || '',
    action: sized,
    target: verifyWith,
    checks,
    timebox,
    verifyWith,
    done,
    decision,
    evidenceStrength,
    firstSignalOnly,
    overclaim,
    externalSignal,
    eventPrimary,
    text,
    provenance: {
      sourceFields: ['firstActionType', 'executionStage', 'primaryBottleneck', 'realityConstraint', 'desiredChange.primaryProblem', 'beliefRelation.relation'],
      sourceQuestionIds: ['Q6', 'Q3', 'Q4', 'Q5'],
      sourceRuleIds: [r.trace.selectedRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildFirstAction }
