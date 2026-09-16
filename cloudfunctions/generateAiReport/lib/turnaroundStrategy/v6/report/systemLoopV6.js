'use strict'
/**
 * turnaroundStrategy/v6/report/systemLoopV6.js
 *
 * CARD 03 — 系统困局.
 * R33 §7 — CONSEQUENCE LOOP: ONE representation, exactly 5 short nodes.
 * R34 §4 / R35 §3 — GENUINELY DIFFERENT user-facing structures (not one
 * skeleton reworded). EACH family is a different reasoning shape:
 *   LOOP          (DIRECTION_GAP)     X → Y → Z → X (causal loop)
 *   CONTRADICTION (ACTION_GAP)        want X / rule rewards Y / keep getting Z
 *   ACCUMULATION  (CONSISTENCY_GAP)   each A → reset → next attempt starts at zero
 *   REFRAME       (VALIDATION_GAP)    mistake A as key, actually B
 *   FALSE_SAFETY  (REPEATABILITY_GAP) avoid short-term pain → create long-term cost
 * No forced "又回到同一个问题" line — each family resolves in its own way.
 *
 * NOTE: finalValidatorV6 requires exactly 5 loop nodes — keep the count at 5.
 * CONSUMER LAYER ONLY. Deterministic. No AI. No STEP labels.
 */

const copy = require('./reportCopyV6.js')

// §3 — a distinct SHAPE per family (header + reasoning form) so two reports with
// different families cannot be perceived as the same skeleton reworded.
const SHAPE = {
  LOOP: { shape: 'CAUSAL_LOOP', header: '这个循环是这样转起来的', form: 'X→Y→Z→X' },
  CONTRADICTION: { shape: 'CONTRADICTION', header: '你想要的和规则在打架', form: '想要X/规则奖励Y/得到Z' },
  ACCUMULATION: { shape: 'ACCUMULATION_RESET', header: '你做得多，却一直在归零', form: '做A→重置→从零' },
  REFRAME: { shape: 'REFRAME', header: '你以为的关键，其实不是', form: '误把A当关键/其实是B' },
  FALSE_SAFETY: { shape: 'FALSE_SAFETY', header: '你在躲一个短痛，换来一个长痛', form: '避短痛→成长痛' }
}

/**
 * @param {Object} r diagnoseTurnaroundV6 output (PRIMARY state only)
 * @returns {{steps:string[], insight:string, text:string, family:string, provenance:Object}}
 */
function buildSystemLoop (r) {
  const q6 = r.executionStage
  const q7 = r.profile.behavior.uncertaintyResponse
  const pb = r.primaryBottleneck
  const problem = copy.getProblemRealization(r.profile.desiredChange.primaryProblem)

  const family = copy.getCard03Family(pb)
  const ruleShort = copy.getC01RuleShort(pb)
  const stageLead = copy.getStageLead(q6)
  const q7Phrase = copy.getQ7(q7)

  // R46 §9: for PAID bands the loop must not assert "却没人买单 / 靠的是一次运气"
  // — the proof-aware loop (hy.card03) replaces the generic SCAFFOLD when present.
  // Family + shape stay keyed on the bottleneck (B1 authority unchanged).
  const hy = r.hybrid || null
  const proofLoop = hy && hy.card03

  let steps
  if (proofLoop && Array.isArray(proofLoop.steps) && proofLoop.steps.length === 5) {
    steps = proofLoop.steps.slice()
  } else if (family === 'CONTRADICTION') {
    steps = [
      `你要的是${copy.getDesiredState(r.profile.desiredChange.primaryProblem)}，你的规则却是：等一切都准备好再开始。`,
      `这条规则每次奖励的都是“再准备一下”，而不是“先做一次”。`,
      `所以一遇到不确定，你就${q7Phrase}；准备越多，越像离“就绪”更近。`,
      `可准备从不产生真实反馈，那件事也就迟迟没有起色。`,
      `你越准备，离“先做一次”越远。`
    ]
  } else if (family === 'ACCUMULATION') {
    steps = [
      `每次你都靠一股劲开头，一开始就全力往前冲。`,
      `一旦停下来，之前那段的积累就全部作废。`,
      `下一次又只能从零重新开始，等于把之前的投入清零。`,
      `于是你一遍遍重启，却从来没有真正往前累积。`,
      `${problem}，不是因为你不够努力，而是每次都在归零。`
    ]
  } else if (family === 'REFRAME') {
    steps = [
      `你把“再打磨得更好一点”当成了关键动作。`,
      `可东西好不好，不是自己说了算，而是由愿意掏钱的人说了算。`,
      `你把判断权留在了自己手里，市场就一直没被真正问过。`,
      `于是你越打磨越自信，却始终没拿到一条来自市场的真实答案。`,
      `所以${problem}，卡在你从未让市场真正回答过一次。`
    ]
  } else if (family === 'FALSE_SAFETY') {
    steps = [
      `你现在${stageLead}，却不再问上一次为什么成，只是照旧再试一遍。`,
      `这一步确实回避了当面确认“会不会失败”的不适感。`,
      `但它也让原因永远不透明：你始终不知道这一次能不能再来一次。`,
      `于是一次成功只能算一次事件，攒不成可以重复的做法。`,
      `下次换个客户、换个条件，你依然会回到同一个不确定里。`
    ]
  } else {
    // LOOP — X → Y → Z → X
    steps = [
      `你想选对方向，于是定了一条规则：先想清楚，再动手。`,
      `可方向对不对只有试过才知道；一遇到不确定，你就${q7Phrase}。`,
      `拿不到真实反馈，你更不敢拍板，只好回到“想清楚”这一步。`,
      `于是“我该选哪个方向”又被推回起点，循环重新开始。`,
      `转得越久，你越分不清是方向不对，还是只是没试过。`
    ]
  }

  const insight = (proofLoop && proofLoop.insight) || copy.getStructuralConsequence(pb)
  const shapeInfo = SHAPE[family] || SHAPE.LOOP

  return {
    steps,
    insight,
    family,
    shape: shapeInfo.shape,
    header: shapeInfo.header,
    form: shapeInfo.form,
    text: steps.join('\n'),
    provenance: {
      sourceFields: ['primaryBottleneck', 'executionStage', 'behavior.uncertaintyResponse', 'behavior.noResultResponse', 'desiredChange.primaryProblem', 'userBelief.perceivedRootCause'],
      sourceQuestionIds: ['Q6', 'Q7', 'Q9', 'Q4', 'Q5'],
      sourceRuleIds: [r.trace.selectedRuleId].filter(Boolean)
    }
  }
}

module.exports = { buildSystemLoop }
