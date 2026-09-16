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
  // R46 §9/§11 — MARKER: proof-aware CARD05 overrides (paid bands).
  const hy = r.hybrid || null
  const proofAction = hy && hy.card05
  const checks = (proofAction && Array.isArray(proofAction.checks) && proofAction.checks.length)
    ? proofAction.checks.slice(0, 3)
    : copy.getSupportChecks(pb).slice(0, 3)

  // Base reality-test action (the PRIMARY action itself creates a real-world
  // event: ask / send / show / contact / transact).
  let sized = (proofAction && proofAction.action) || spec.action || copy.getActionExpression(action)

  // Reality constraint may RESIZE (append a sizing clause), never replace.
  if (!cashflow && (rcTypes.includes('LOW_SURPLUS') || rcTypes.includes('UNSTABLE_INCOME'))) {
    sized = `${sized}（${copy.getScaleNote(q3)}。）`
  }

  // R44 §16/§17/§18 — ADDITIVE capacity sizing from the hybrid profile (time /
  // budget / proof stage). Gated: absent `r.hybrid` -> sizingLine '' and the
  // action is byte-identical to pre-R44 output.
  const specificity = hy ? (hy.sizingLine || '') : ''

  const timebox = spec.timebox || '今天内完成'
  const verifyWith = (proofAction && proofAction.target) || spec.target || '一个真实的人'
  // §6: the observable signal IS the branch outcome (positive/negative/ambiguous)
  // so it clearly answers the hypothesis. R46 §9: paid bands use the proof-aware
  // observable signal / decision (action TYPE authority unchanged).
  const done = (proofAction && proofAction.done) ||
    [spec.observableSignal, spec.ifPositive, spec.ifNegative, spec.ifAmbiguous]
      .filter(Boolean).join(' ')
  const decision = (proofAction && proofAction.decision) || spec.decision || '只要拿到一条真实反馈，就用它修正下一步。'

  // §5 — EVIDENCE STRENGTH of the signal the decision-relevant core names.
  const evidenceStrength = copy.evidenceStrength(done)
  // §4 — a DIRECTION decision on a single weak/medium signal is an overclaim.
  const overclaim = copy.singleWeakSignalOverclaim(action, done, decision)
  const firstSignalOnly = overclaim

  const eventPrimary = copy.MARKET_FACING_PAT.test(sized)
  const externalSignal = copy.EXTERNAL_SIGNAL_PAT.test(done + ' ' + decision) && !copy.HABIT_ONLY_PAT.test(sized.replace(/每天把同一个/, ''))

  // R34 §10: one headline + structured REALITY-TEST lines. `text` is the
  // internal full form; the CLIENT renders the structured block.
  // R62 — cross-object divergence: the hypothesis must be the LINK hypothesis
  // (not a same-object repeat/reproduce claim), so the observable signal and the
  // decision stay about verifying the connection between the two objects.
  const headline = `今天要验证的是：${(proofAction && proofAction.hypothesis) || spec.hypothesis || '你的方向真的有人需要。'}`
  const line0 = `先赌一个假设：${(proofAction && proofAction.hypothesis) || spec.hypothesis || '你的方向真的有人需要。'}`
  const line1 = `怎么做：${sized}`
  const line2 = `找谁：${verifyWith}；多久：${timebox}`
  const line3 = `看什么信号：${done}`
  const line4 = `怎么用它：${decision}`
  // §2 distinctness: fold the goal into an otherwise-identical action block so two
  // same-action-type reports never render byte-identical CARD05 copy.
  // R62 — cross-object divergence uses a neutral link-framed stage lead so a B1
  // stage lead (e.g. “却还没人买单”) never asserts the opposite market fact as
  // if it were the SAME object as the paid capability.
  const stageLead = (hy && hy.crossStageLead) || copy.getStageLead(stage)
  const goalLine = `你现在${stageLead}，这一小步瞄准的是：${copy.getProblemRealization(q4)}。`
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
    specificity,
    evidenceStrength,
    firstSignalOnly,
    overclaim,
    externalSignal,
    eventPrimary,
    text,
    provenance: {
      sourceFields: ['firstActionType', 'executionStage', 'primaryBottleneck', 'realityConstraint', 'desiredChange.primaryProblem', 'beliefRelation.relation']
        .concat(hy ? ['capacity.weeklyTime', 'capacity.maxTrialCost', 'asset.state'] : []),
      sourceQuestionIds: ['Q6', 'Q3', 'Q4', 'Q5'],
      sourceRuleIds: [r.trace.selectedRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildFirstAction }
