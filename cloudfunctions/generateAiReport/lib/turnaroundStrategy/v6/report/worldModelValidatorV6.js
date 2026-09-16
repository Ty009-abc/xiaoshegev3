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
const C01_LEAD_TEMPLATES = [
  /^你以为缺的是/,
  /^你一直以为缺的是/,
  /^卡住你的不是/,
  /^真正卡住你的是/,
  /^你把["「“].*["」”]当成了全部原因/,
  /^你想/,
  /^你要的是/,
  /^你的目标没错/,
  /^方向没错/,
  /^你以为["「“].*["」”]是在/,
  /^判断没错/,
  /^你一直在/,
  /^你判断得没错/
]

const C01_TEMPLATES = [
  /^你以为缺的是/,
  /^卡住你的不是/,
  /^你把["「“].*["」”]当成了全部原因/,
  /^你判断得没错，但/,
  /^你的目标没错，但/,
  /^判断没错，但/,
  /^你想.*，但/
]

// R34 §1 — DESIRED_STATE vs CURRENT_PROBLEM role inversion. A CURRENT_PROBLEM
// phrase dropped after 想要的是/目标是/希望的是 is ungrammatical (a problem is not
// a desire). Detect that specific inversion.
const DESIRE_FRAME = /(想要的是|目标是|希望的是|想要|希望是|目标是)\s*/
const PROBLEM_STATE_PAT = /(上不去|无法聚焦|没方向|没有方向|看不到未来|变不了现|没做起来|不知往哪走|一直被|压着)/

const OLD_RULE_MARK = /(旧规则|你一直|你以为|按“|按"|你把|当成了全部原因|真正的规则|真正卡住你的是|卡住你的不是|但「|但“|你的目标没错|判断没错|你要的是|方向没错|你想|行不通|撑不下去|只灵一次)/
const NEW_RULE_MARK = /(新规则|换成|恰恰相反|真正的规则|现实|其实)/
const MECHANISM_MARK = /(概率|反馈|积累|买单|清零|重复|验证|说不清|运气|说了算|不由|市场|外部)/
const LEAP_MARK = /(概率|反馈|积累|买单|清零|重复|验证|说不清|运气|说了算|不由|市场|外部|恰恰|相反|只是|并非|并不|不代表|猜|换不来|准备|重启|自我打分|自认|单方面|作废)/

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

// ════════════════════════════════════════════════════════════════════
// R34 — human-copy + reality-test metrics
// ════════════════════════════════════════════════════════════════════

/** §1 SEMANTIC_ROLE_INVERSION_COUNT — CURRENT_PROBLEM dropped after a desire frame. */
function semanticRoleInversion (report) {
  const t = allVisible(report)
  let n = 0
  const sentences = t.split(/(?<=[。！？!?\n])/)
  for (const s of sentences) {
    const m = s.match(DESIRE_FRAME)
    if (!m) continue
    const rest = s.slice(s.indexOf(m[0]) + m[0].length, s.indexOf(m[0]) + m[0].length + 10)
    if (PROBLEM_STATE_PAT.test(rest)) n++
  }
  return n
}

/** §3 ANY_SINGLE_CARD01_PATTERN_RATE — max share of CARD01 leading families. */
function card01PatternRate (reports) {
  const counts = {}; const n = (reports || []).length
  for (const r of reports || []) {
    const s = text(r && r.cards && r.cards.fatalInsight && r.cards.fatalInsight.text)
    let hit = 'OTHER'
    for (let i = 0; i < C01_LEAD_TEMPLATES.length; i++) { if (C01_LEAD_TEMPLATES[i].test(s)) { hit = 'T' + i; break } }
    counts[hit] = (counts[hit] || 0) + 1
  }
  const max = n ? Math.max.apply(null, Object.keys(counts).map((k) => counts[k])) : 0
  return { rate: n ? 100 * max / n : 0, counts: counts, n: n }
}

/** §3 CARD01_CAN_STAND_ALONE_AS_SHAREABLE_INSIGHT — names a rule + collides it. */
function card01StandaloneShareable (card01) {
  const s = text(card01 && card01.text)
  const hasRule = /(「[^」]+」|"[^"]+"|“[^”]+”)/.test(s)
  const collides = /(其实|真正|不是|而是|行不通|换不来|撑不下去|只灵|当成了全部原因)/.test(s)
  const noJargon = !/(DIRECTION_GAP|ACTION_GAP|CONSISTENCY_GAP|VALIDATION_GAP|REPEATABILITY_GAP|执行阶段|行为模式)/.test(s)
  return hasRule && collides && noJargon
}

/** §4 CARD03 structure-family distribution. */
function card03StructureDistribution (reports) {
  const counts = {}; const n = (reports || []).length
  for (const r of reports || []) {
    const f = text(r && r.cards && r.cards.systemLoop && r.cards.systemLoop.family) || 'LOOP'
    counts[f] = (counts[f] || 0) + 1
  }
  const families = Object.keys(counts).filter((k) => counts[k] > 0)
  const max = n ? Math.max.apply(null, Object.keys(counts).map((k) => counts[k])) : 0
  return { familyCount: families.length, families: families, counts: counts, dominantRate: n ? 100 * max / n : 0, n: n }
}

/** §5/§7 GENERIC_PRODUCTIVITY_WITH_DECORATIVE_SIGNAL — habit action + decorative "feedback" add-on. */
function genericProductivityWithDecorativeSignal (card05) {
  const c = card05 || {}
  const act = text(c.action)
  const habit = copy.HABIT_ONLY_PAT.test(act)
  if (!habit) return false
  const marketFacing = copy.MARKET_FACING_PAT.test(act)
  // A habit-framed action whose "external signal" is merely an add-on clause
  // (the signal does not decide the action) is decorative.
  return !marketFacing
}

/** §6 ACTION_SIGNAL_SEMANTIC_MATCH — the signal answers the hypothesis topic. */
function actionSignalSemanticMatch (card05, actionType) {
  const c = card05 || {}
  const topic = copy.SIGNAL_TOPIC[actionType]
  if (!topic) return true
  return topic.test(text(c.done))
}

/** §6 SIGNAL_DECISION_SEMANTIC_MATCH — the decision reads the SAME signal. */
function signalDecisionSemanticMatch (card05, actionType) {
  const c = card05 || {}
  const topic = copy.DECISION_TOPIC[actionType]
  if (!topic) return true
  return topic.test(text(c.decision))
}

/** §8 REPEATABILITY_SIGNAL_DECISION_MISMATCH — signal & decision measure different things. */
function repeatabilitySignalDecisionMismatch (card05, actionType) {
  if (actionType !== 'REPEAT_SUCCESS_PATH') return false
  const c = card05 || {}
  const sigRepro = /(成交|拒绝|再来|复制|重复)/.test(text(c.done))
  const decRepro = /(复制|成交|拒绝|重复|照搬)/.test(text(c.decision))
  return !(sigRepro && decRepro)
}

/** §9 FORM_FIELD_ASSEMBLY_FEEL — CARD02 reads like questionnaire playback. */
function formFieldAssemblyFeel (card02) {
  const t = text(card02 && card02.text)
  // The old stamped form: “你现在…，想要的其实是…。你以为缺的是…。”
  const stamped = /想要的其实是/.test(t) || /^你以为缺的是/.test(t) || /你现在.*，想要的是/.test(t)
  return stamped
}

/** §10 SHAREABLE_WORLD_RULE_LINE_RATE — CARD04 carries a short human world-rule line. */
function hasShareableWorldRuleLine (report) {
  const p = report && report.cards && report.cards.turnaroundPath
  const line = text(p && p.worldRuleLine)
  return line.length >= 8 && /[。！？!?]$/.test(line)
}

// ════════════════════════════════════════════════════════════════════
// R35 — natural-language + probability + evidence-strength metrics
// ════════════════════════════════════════════════════════════════════

// §1 — awkward Chinese assembly: ungrammatical/stilted renderings.
const AWKWARD_PAT = /(上上|卡在[^。，；]{0,20}?上上|把[^。，；]{0,24}?这件事推过去|这件事推过去|想要的是[^。，；]{0,12}(上不去|没做起来|变不了现|无法聚焦|看不到未来)|目标是[^。，；]{0,12}(上不去|没做起来|变不了现|无法聚焦)|希望的是[^。，；]{0,12}(上不去|没做起来|变不了现))/g

/** §1 AWKWARD_CHINESE_ASSEMBLY_COUNT across a report's visible text. */
function awkwardChineseAssembly (report) {
  const t = allVisible(report)
  const m = t.match(AWKWARD_PAT)
  return m ? m.length : 0
}

/** §2 PROBLEM_AS_DESIRE_COUNT — a problem state rendered as a desire. */
function problemAsDesire (report) {
  const t = allVisible(report)
  let n = 0
  const sentences = t.split(/(?<=[。！？!?\n])/)
  for (const s of sentences) {
    const m = s.match(/(想要的是|目标是|希望的是|想要|希望|目标是)/)
    if (!m) continue
    const rest = s.slice(s.indexOf(m[0]) + m[0].length, s.indexOf(m[0]) + m[0].length + 12)
    if (PROBLEM_STATE_PAT.test(rest)) n++
  }
  return n
}

/** §3 PERCEPTUALLY_SAME_CARD03_PATTERN_COUNT — two reports share a shape. */
function perceptuallySameCard03 (reports) {
  const seen = {}
  let same = 0
  for (const r of reports || []) {
    const c = r && r.cards && r.cards.systemLoop
    const key = text(c && c.shape) || text(c && c.family) || 'LOOP'
    if (seen[key]) same++
    seen[key] = (seen[key] || 0) + 1
  }
  return same
}

/** §4/§6 SINGLE_WEAK_SIGNAL_OVERCLAIM_COUNT over the reports. */
function singleWeakSignalOverclaimCount (pairs) {
  let n = 0
  for (const x of pairs || []) {
    const c = x && x.report && x.report.cards && x.report.cards.firstAction
    const actionType = x && x.actionType
    if (copy.singleWeakSignalOverclaim(actionType, text(c && c.done), text(c && c.decision))) n++
  }
  return n
}

/** §6 DIRECTION_SINGLE_PERSON_FINAL_DECISION_COUNT. */
function directionSinglePersonFinalDecision (pairs) {
  let n = 0
  for (const x of pairs || []) {
    if (!x || x.actionType !== 'DIRECTION_NARROWING') continue
    const c = x.report && x.report.cards && x.report.cards.firstAction
    if (copy.singleWeakSignalOverclaim('DIRECTION_NARROWING', text(c && c.done), text(c && c.decision))) n++
  }
  return n
}

/** §7 CONSISTENCY_TIMEBOX_AS_SUCCESS_COUNT. */
function consistencyTimeboxAsSuccessCount (pairs) {
  let n = 0
  for (const x of pairs || []) {
    if (!x || x.actionType !== 'CONSISTENCY_PROTECTION') continue
    const c = x.report && x.report.cards && x.report.cards.firstAction
    if (copy.consistencyTimeboxAsSuccess(text(c && c.decision), text(c && c.done))) n++
  }
  return n
}

/** §10 REPORT_C_HABIT_COACHING_DOMINANT — CONSISTENCY report centers on habit/self-discipline. */
function reportCHabitCoachingDominant (report) {
  const c = (report && report.cards) || {}
  const pool = [text(c.fatalInsight && c.fatalInsight.text), text(c.coreProblem && c.coreProblem.text), (c.systemLoop && c.systemLoop.steps || []).join(' '), text(c.turnaroundPath && c.turnaroundPath.logic), text(c.firstAction && c.firstAction.action), text(c.firstAction && c.firstAction.decision)].join('\n')
  const habit = /(每天固定\s*\d+\s*分钟|养成习惯|保持自律|自律|坚持\s*\d*\s*[天周月]|执行纪律)/.test(pool)
  const mechanism = /(累积|外部|市场|反馈|重启|归零|清零|证据)/.test(pool)
  return habit && !mechanism
}

/** §10 REPORT_D_PROBABILITY_LOGIC_PASS — DIRECTION decision requires aggregation or strong signal. */
function reportDProbabilityLogicPass (report) {
  const c = (report && report.cards) || {}
  const fa = c.firstAction || {}
  const t = [text(fa.done), text(fa.decision)].join(' ')
  if (!/(定方向|方向|拍板)/.test(text(fa.decision))) return true
  const aggregated = /(3个|三个人|3人|三条|多条|独立|直到问满|问满|持续|累积|经济信号|真金白银|付款|签约|定金)/.test(t)
  return aggregated
}

/** §15 SHAREABLE_INSIGHT_RATE — report carries >=1 standalone screenshot-worthy line. */
function shareableInsight (report) {
  const c = (report && report.cards) || {}
  const pool = [text(c.fatalInsight && c.fatalInsight.text), text(c.turnaroundPath && c.turnaroundPath.worldRuleLine)]
  for (const s of pool) {
    const t = String(s || '').trim()
    if (t.length >= 10 && /[。！？!?]$/.test(t) && /(不是|而是|其实|真正|换不来|才算|才是|撑不下去|只灵|贵|昂贵|事件|能力|试出来)/.test(t)) return true
  }
  return false
}

/**
 * Aggregate R35 human-language + probability + evidence-strength validators.
 */
function assessHumanLanguageV6 (report, diagnosis) {
  const c = (report && report.cards) || {}
  const actionType = diagnosis && diagnosis.firstActionType
  const fa = c.firstAction || {}
  return {
    AWKWARD_CHINESE_ASSEMBLY_COUNT: awkwardChineseAssembly(report),
    PROBLEM_AS_DESIRE_COUNT: problemAsDesire(report),
    SINGLE_WEAK_SIGNAL_OVERCLAIM: copy.singleWeakSignalOverclaim(actionType, text(fa.done), text(fa.decision)),
    CONSISTENCY_TIMEBOX_AS_SUCCESS: actionType === 'CONSISTENCY_PROTECTION' && copy.consistencyTimeboxAsSuccess(text(fa.decision), text(fa.done)),
    SHAREABLE_INSIGHT: shareableInsight(report)
  }
}

/**
 * Aggregate R34 human-copy + reality-test validators.
 */
function assessHumanCopyV6 (report, diagnosis) {
  const c = (report && report.cards) || {}
  const actionType = diagnosis && diagnosis.firstActionType
  return {
    SEMANTIC_ROLE_INVERSION_COUNT: semanticRoleInversion(report),
    GENERIC_PRODUCTIVITY_WITH_DECORATIVE_SIGNAL: genericProductivityWithDecorativeSignal(c.firstAction),
    ACTION_SIGNAL_SEMANTIC_MATCH: actionSignalSemanticMatch(c.firstAction, actionType),
    SIGNAL_DECISION_SEMANTIC_MATCH: signalDecisionSemanticMatch(c.firstAction, actionType),
    REPEATABILITY_SIGNAL_DECISION_MISMATCH: repeatabilitySignalDecisionMismatch(c.firstAction, actionType),
    FORM_FIELD_ASSEMBLY_FEEL: formFieldAssemblyFeel(c.coreProblem),
    CARD01_STANDALONE_SHAREABLE: card01StandaloneShareable(c.fatalInsight),
    SHAREABLE_WORLD_RULE_LINE: hasShareableWorldRuleLine(report)
  }
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
  card01PatternRate,
  card01StandaloneShareable,
  card03StructureDistribution,
  worldRuleEvidenceSupport,
  genericProductivityWithDecorativeSignal,
  actionSignalSemanticMatch,
  signalDecisionSemanticMatch,
  repeatabilitySignalDecisionMismatch,
  formFieldAssemblyFeel,
  hasShareableWorldRuleLine,
  assessHumanCopyV6,
  semanticRoleInversion,
  realityTestIsPrimaryAction,
  decorativeExternalSignal,
  assessWorldModelV6,
  // R35
  awkwardChineseAssembly,
  problemAsDesire,
  perceptuallySameCard03,
  singleWeakSignalOverclaimCount,
  directionSinglePersonFinalDecision,
  consistencyTimeboxAsSuccessCount,
  reportCHabitCoachingDominant,
  reportDProbabilityLogicPass,
  shareableInsight,
  assessHumanLanguageV6
}
