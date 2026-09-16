'use strict'
/**
 * turnaroundStrategy/v6/report/worldModelValidatorV6.js
 *
 * R33 §10/§12/§14 — WORLD-MODEL-FIRST product validators over a finished
 * five-card report. Consumer layer only. No AI, no I/O, no randomness, no time.
 *
 *   §14 WORLD_MODEL_SHIFT_PRESENT — report clearly contains an OLD RULE and a
 *       BETTER RULE / REALITY MECHANISM.
 *   §10 GENERIC_PRODUCTIVITY_ACTION — CARD05 core action is habit-flavoured
 *       without an explicit external signal.
 *   §6  ANSWER_RESTATEMENT_ONLY — CARD02 merely restates answers without a
 *       diagnostic leap.
 *   §12 evidence anchors — UNIQUE vs REPEATED anchor counts.
 *   §9  ACTION_EXTERNAL_SIGNAL — CARD05 produces an external signal.
 *
 * ZERO diagnosis authority: never changes bottleneck/stage/action type.
 */

const copy = require('./reportCopyV6.js')

const CARD_KEYS = ['fatalInsight', 'coreProblem', 'systemLoop', 'turnaroundPath', 'firstAction']

const OLD_RULE_MARK = /(旧规则|你一直|你以为|按“|按"|你把|当成了全部原因|真正的规则)/
const NEW_RULE_MARK = /(新规则|换成|恰恰相反|真正的规则|现实|其实)/
const MECHANISM_MARK = /(概率|反馈|积累|买单|清零|重复|验证|说不清|运气|说了算|不由|市场|外部)/
const LEAP_MARK = /(概率|反馈|积累|买单|清零|重复|验证|说不清|运气|说了算|不由|市场|外部|恰恰|相反|只是|并非|并不|不代表)/

function text (v) { return typeof v === 'string' ? v : '' }

function allVisible (report) {
  const c = (report && report.cards) || {}
  return [
    text(c.fatalInsight && c.fatalInsight.text),
    text(c.coreProblem && c.coreProblem.text),
    (c.systemLoop && c.systemLoop.steps || []).join(' '),
    text(c.systemLoop && c.systemLoop.insight),
    text(c.turnaroundPath && c.turnaroundPath.from),
    text(c.turnaroundPath && c.turnaroundPath.to),
    text(c.turnaroundPath && c.turnaroundPath.logic),
    text(c.firstAction && c.firstAction.action),
    text(c.firstAction && c.firstAction.done),
    text(c.firstAction && c.firstAction.decision)
  ].join('\n')
}

/**
 * §14 WORLD_MODEL_SHIFT_PRESENT.
 * TRUE iff the report exposes an OLD rule AND (a NEW rule OR a reality
 * mechanism). Primary-gated: report must be PRIMARY with cards.
 */
function worldModelShiftPresent (report) {
  if (!report || report.reportState !== 'PRIMARY' || !report.cards) return false
  const c = report.cards
  const t = allVisible(report)
  const oldRule = OLD_RULE_MARK.test(text(c.fatalInsight && c.fatalInsight.text)) ||
    OLD_RULE_MARK.test(text(c.turnaroundPath && c.turnaroundPath.logic))
  const newRule = !!(c.turnaroundPath && text(c.turnaroundPath.from) && text(c.turnaroundPath.to) &&
    c.turnaroundPath.from !== c.turnaroundPath.to)
  const mechanism = MECHANISM_MARK.test(t)
  return oldRule && (newRule || mechanism)
}

/**
 * §10 GENERIC_PRODUCTIVITY_ACTION.
 * TRUE when CARD05's core action is habit-flavoured WITHOUT an explicit
 * external signal. An explicit external signal rescues it.
 */
function genericProductivityAction (card05) {
  const c = card05 || {}
  const core = [text(c.action), text(c.done), text(c.decision)].join(' ')
  const generic = copy.GENERIC_PRODUCTIVITY_PAT.test(text(c.action))
  const external = copy.EXTERNAL_SIGNAL_PAT.test(core) && c.externalSignal !== false
  return generic && !external
}

/**
 * §6 ANSWER_RESTATEMENT_ONLY.
 * TRUE when CARD02 has no diagnostic-leap marker (only restates facts).
 */
function answerRestatementOnly (card02) {
  const t = text(card02 && card02.text)
  return !LEAP_MARK.test(t)
}

/**
 * §12 evidence anchors.
 * @returns {{unique:number, repeated:number, hits:Object}}
 */
function evidenceAnchors (report, diagnosis) {
  const t = allVisible(report)
  const p = (diagnosis && diagnosis.profile) || {}
  const ph = []
  if (p.reality) ph.push(copy.getIncomeShort(p.reality.incomeMode))
  if (p.desiredChange) ph.push(copy.getProblemPhrase(p.desiredChange.primaryProblem))
  if (p.behavior) {
    ph.push(copy.getQ7(p.behavior.uncertaintyResponse))
    ph.push(copy.getQ9(p.behavior.noResultResponse))
  }
  // §12: anchors are reality / goal / behavior facts (belief is the diagnosis,
  // not an evidence anchor) — kept out to avoid double-counting the belief line.
  const hits = {}
  let unique = 0, repeated = 0
  for (const s of ph) {
    // Skip tiny/common anchors (e.g. belief-lack “方向”) that would false-match.
    if (!s || [...s].length < 3) continue
    const n = t.split(s).length - 1
    hits[s] = n
    if (n >= 1) unique++
    if (n >= 2) repeated++
  }
  return { unique, repeated, hits }
}

/** §9 external-signal check for CARD05. */
function actionExternalSignal (card05) {
  const c = card05 || {}
  return c.externalSignal === true ||
    copy.EXTERNAL_SIGNAL_PAT.test([text(c.action), text(c.done), text(c.decision)].join(' '))
}

/**
 * Aggregate R33 product validators.
 */
function assessWorldModelV6 (report, diagnosis) {
  const c = (report && report.cards) || {}
  const anchors = evidenceAnchors(report, diagnosis)
  return {
    WORLD_MODEL_SHIFT_PRESENT: worldModelShiftPresent(report),
    GENERIC_PRODUCTIVITY_ACTION: genericProductivityAction(c.firstAction),
    ANSWER_RESTATEMENT_ONLY: answerRestatementOnly(c.coreProblem),
    ACTION_EXTERNAL_SIGNAL: actionExternalSignal(c.firstAction),
    UNIQUE_PERSONAL_EVIDENCE_ANCHOR_COUNT: anchors.unique,
    REPEATED_EVIDENCE_ANCHOR_COUNT: anchors.repeated,
    ANCHOR_HITS: anchors.hits
  }
}

module.exports = {
  CARD_KEYS,
  worldModelShiftPresent,
  genericProductivityAction,
  answerRestatementOnly,
  evidenceAnchors,
  actionExternalSignal,
  assessWorldModelV6
}
