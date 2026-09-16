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

// §6 — leading template phrases whose over-use would make copy feel stamped.
const C01_TEMPLATES = [
  /^你以为缺的是/,
  /^卡住你的不是/,
  /^你把["「“].*["」”]当成了全部原因/,
  /^你判断得没错，但/,
  /^你的目标没错，但/,
  /^判断没错，但/,
  /^你想.*，但/
]

const OLD_RULE_MARK = /(旧规则|你一直|你以为|按“|按"|你把|当成了全部原因|真正的规则|真正卡住你的是|卡住你的不是|但「|但“)/
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
 * §6 TEMPLATE_PHRASE_DOMINANCE_RATE.
 * Share of PRIMARY reports whose CARD01 opens with the SAME leading template
 * (the max over templates, as a percentage). Target < 30%.
 * @param {Array<Object>} reports
 * @returns {{rate:number, counts:Object, max:number, n:number}}
 */
function templatePhraseDominance (reports) {
  const counts = {}; const n = (reports || []).length
  for (const r of reports || []) {
    const s = text(r && r.cards && r.cards.fatalInsight && r.cards.fatalInsight.text)
    let hit = null
    for (let i = 0; i < C01_TEMPLATES.length; i++) { if (C01_TEMPLATES[i].test(s)) { hit = 'T' + i; break } }
    const key = hit || 'OTHER'
    counts[key] = (counts[key] || 0) + 1
  }
  const max = n ? Math.max.apply(null, Object.keys(counts).map((k) => counts[k])) : 0
  return { rate: n ? 100 * max / n : 0, counts: counts, max: max, n: n }
}

/**
 * §4 WORLD_RULE_EVIDENCE_SUPPORT_RATE.
 * Share of PRIMARY reports whose world-rule selection was evidence-gated
 * (`reason === 'evidence_guard'`), NOT chosen by bottleneck mapping alone.
 * @returns {{rate:number, supported:number, bottleneckOnly:number, n:number}}
 */
function worldRuleEvidenceSupport (diagnoses) {
  const lib = require('./worldRuleLibraryV6.js')
  let supported = 0; let bottleneckOnly = 0
  for (const d of diagnoses || []) {
    const sel = lib.selectWorldRule(d)
    if (!sel) continue
    if (sel.reason === 'evidence_guard') supported++; else bottleneckOnly++
  }
  const n = (diagnoses || []).length
  return { rate: n ? 100 * supported / n : 0, supported: supported, bottleneckOnly: bottleneckOnly, n: n }
}

// §10 — external-world event verbs: the PRIMARY action must itself create a
// real-world event (publish/quote/send/ask/show/contact/transaction).
const REALITY_EVENT_PAT = /(发布|上传|公开|展示|寄出|发出|发一份|递交|提交|报价|定价|收费|收款|付款|收款|开价|联系|约谈|面试|报名|参加|上线|投放|寄样|寄送|拿给|递给|问|请人|找人|发给|卖出|出售|挂出|接单|成交|招募|邀请|演示|试卖|试产|投稿|申请)/
// §11 — habit/inner-state completion markers that are NOT an external world
// event (used by the §10 DECORATIVE_EXTERNAL_SIGNAL completion check).
const DECORATIVE_SIGNAL_PAT = /(打卡|想清楚|想明白|做了个?计划|有了计划|坚持\s*\d*\s*[天周月]|感觉|心情|心态|状态|自律|复盘|思考|反思|整理了?)/

/**
 * §10 REALITY_TEST_IS_PRIMARY_ACTION.
 * TRUE when CARD05's PRIMARY action itself creates a real-world event (not a
 * habit/inner state) AND is paired with an external signal + decision rule.
 */
function realityTestIsPrimaryAction (card05) {
  const c = card05 || {}
  const act = text(c.action)
  const eventPrimary = REALITY_EVENT_PAT.test(act)
  const external = actionExternalSignal(c)
  const hasDecision = text(c.decision).trim().length > 0
  return eventPrimary && external && hasDecision
}

/**
 * §10 DECORATIVE_EXTERNAL_SIGNAL.
 * TRUE when CARD05's completion `done` is missing or is an internal/habitistic
 * state (打卡/自己打卡/想清楚了/坚持N天) rather than a real external-world event.
 * Scoped to the SIGNAL (§10: completion cannot merely be “worked 30 minutes /
 * thought clearly / made a plan”); the action-habit concern is covered by
 * genericProductivityAction.
 */
function decorativeExternalSignal (card05) {
  const c = card05 || {}
  const sig = text(c.done)
  if (!sig.trim()) return true
  const external = copy.EXTERNAL_SIGNAL_PAT.test(sig)
  const decorative = DECORATIVE_SIGNAL_PAT.test(sig)
  return decorative && !external
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
  C01_TEMPLATES,
  REALITY_EVENT_PAT,
  DECORATIVE_SIGNAL_PAT,
  worldModelShiftPresent,
  genericProductivityAction,
  answerRestatementOnly,
  evidenceAnchors,
  actionExternalSignal,
  templatePhraseDominance,
  worldRuleEvidenceSupport,
  realityTestIsPrimaryAction,
  decorativeExternalSignal,
  assessWorldModelV6
}
