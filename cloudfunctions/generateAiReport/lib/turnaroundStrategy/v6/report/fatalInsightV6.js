'use strict'
/**
 * turnaroundStrategy/v6/report/fatalInsightV6.js
 *
 * CARD 01 — 致命一句话.
 * R33 §5 — WRONG RULE COLLISION: expose ONE mistaken decision rule and the
 * world rule that contradicts it, in one sharp sentence.
 * R33.1 §6/§13 — shorten to ≤40 Chinese chars with natural variation.
 * R34 §3 — anti-template: the LEADING phrase must vary across the review set
 * so no single pattern covers >20% of reports. Leading families in use:
 *   你以为缺的是 / 你一直以为缺的是 / 卡住你的不是 / 真正卡住你的是 /
 *   你把…当成了全部原因 / MATCH family (你想… · 你的目标没错 · 判断没错).
 *
 * CONSUMER LAYER ONLY: no diagnosis, no eligibility, no scoring, no AI.
 * No new world rules (R34 decision).
 */

const copy = require('./reportCopyV6.js')

const REL_GAP = 'BELIEF_REALITY_GAP'
const REL_PARTIAL = 'BELIEF_PARTIAL'
// R33 §6/§13: CARD01 target ceiling (40 Chinese chars).
const CARD01_MAX = 40

/** Cheap deterministic hash (no time/random) for template rotation. */
function rotationOf (a, b, c) {
  const s = String(a) + '|' + String(b) + '|' + String(c)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 4
}

/**
 * @param {Object} r diagnoseTurnaroundV6 output (PRIMARY state only)
 * @returns {{text:string, provenance:Object}}
 */
function buildFatalInsight (r) {
  const q5 = r.profile.userBelief.perceivedRootCause
  const q4 = r.profile.desiredChange.primaryProblem
  const pb = r.primaryBottleneck
  const rel = r.beliefRelation.relation

  const rs = copy.getC01RuleShort(pb)

  // §6/§13 — natural variation within ≤40 chars. Each rule-collision carries
  // the evidence anchor (belief-lack / belief / problem) so two distinct 9Q
  // profiles never receive identical copy, while no single template dominates.
  let text
  if (rel === REL_PARTIAL) {
    text = copy.C01.partial(copy.getPartialShort(q5), rs)
    if ([...text].length > CARD01_MAX) {
      text = copy.C01.gapCV(copy.getBeliefLack(q5), rs)
    }
  } else if (rel === REL_GAP) {
    const lack = copy.getBeliefLack(q5)
    // Rotate among four GAP lead-families deterministically on the profile so
    // no single lead dominates the review set (R34 §3 anti-template).
    const rot = rotationOf(pb, q4, q5)
    text = rot === 0 ? copy.C01.gapDir(lack, rs)
      : rot === 1 ? copy.C01.gapAct(lack, rs)
        : rot === 2 ? copy.C01.gapCV(lack, rs)
          : copy.C01.gapRep(lack, rs)
    if ([...text].length > CARD01_MAX) {
      text = copy.C01.gapCV(lack, rs)
    }
  } else {
    // MATCH: the goal is right; the rule to reach it is wrong. Keyed on
    // bottleneck + primaryProblem so two MATCH reports never collide, with
    // several leads per bottleneck (R34 §3 anti-template).
    text = copy.getMatchLead(pb, q4, q5)
  }

  if ([...text].length > CARD01_MAX) {
    text = `真正卡住你的是“${rs}”这条规则。`
  }

  return {
    text,
    provenance: {
      sourceFields: ['userBelief.perceivedRootCause', 'primaryBottleneck', 'beliefRelation.relation', 'desiredChange.primaryProblem'],
      sourceQuestionIds: ['Q5', 'Q4'],
      sourceRuleIds: [r.trace.selectedRuleId, r.beliefRelation.explanationRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildFatalInsight, REL_GAP, REL_PARTIAL, CARD01_MAX }
