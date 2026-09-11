'use strict'
/**
 * turnaroundStrategy/v6/beliefRelationV6.js
 *
 * Belief-reality relation. Output relation ∈
 *   BELIEF_MATCH | BELIEF_PARTIAL | BELIEF_REALITY_GAP | UNRESOLVED
 *
 * Contract v1 rules:
 *  - Hard BELIEF_REALITY_GAP requires explicit contradicting evidence.
 *  - TIME: Q5=没时间 + Q8 long-term displaced is NOT sufficient alone -> PARTIAL
 *    (TIME_GAP_SINGLE_SIGNAL_ALLOWED = NO). A hard TIME gap needs an independent
 *    contradiction flag that V6.0 never sets.
 *  - Q5=总在换方向: no special hard-gap rule (DEFER_PENDING_GOLDEN).
 *  - No fake gap. No stylistic hard gap.
 */

const { Q6, OPT, WAITING_ANALYSIS } = require('./bottleneckEligibilityV6.js')

/**
 * @param {Object} profile canonical profile
 * @returns {{relation:string, subType:string|null, beliefSource:Object|null,
 *   behaviorSources:Array, explanationRuleId:string|null}}
 */
function computeBeliefRelation (profile) {
  const q5 = profile.userBelief.perceivedRootCause
  const q6 = profile._optionIds.Q6
  const q7 = profile.behavior.uncertaintyResponse
  const q8 = profile.behavior.timeAllocation
  const q9 = profile.behavior.noResultResponse

  const beliefSource = { questionId: 'Q5', value: q5 }
  const b = (q, v) => ({ questionId: q, value: v })

  // ── Hard gap rules (evidence-based; ordered; first match wins) ──
  // G12: 缺资源 | 还在学习/准备阶段
  if (q5 === OPT.BELIEF_RESOURCE &&
      [Q6.THINKING, Q6.RESEARCHING, Q6.LEARNING].includes(q6)) {
    return gap('RESOURCE', beliefSource, [b('Q6', q6)], 'RC84V6-GAP-RESOURCE')
  }
  // G05: 能力不够 | 已有人付钱 / 稳定结果
  if (q5 === OPT.BELIEF_ABILITY &&
      [Q6.EARLY_TRACTION, Q6.STABLE_TRACTION].includes(q6)) {
    return gap('ABILITY_1', beliefSource, [b('Q6', q6)], 'RC84V6-GAP-ABILITY-1')
  }
  // G14: 能力不够 | 做过产品没人买单 + 等待/分析 或 停下来
  if (q5 === OPT.BELIEF_ABILITY && q6 === Q6.TESTING &&
      (WAITING_ANALYSIS.includes(q7) || q9 === OPT.NORESULT_STOP)) {
    return gap('ABILITY_2', beliefSource, [b('Q6', q6), b('Q7', q7), b('Q9', q9)],
      'RC84V6-GAP-ABILITY-2')
  }
  // G08: 能力不够 | 长期被挤掉 + 再坚持一阵
  if (q5 === OPT.BELIEF_ABILITY &&
      [OPT.TIME_SHORT_FIRST, OPT.TIME_LONG_DROPS].includes(q8) &&
      q9 === OPT.NORESULT_PERSIST) {
    return gap('ABILITY_3', beliefSource, [b('Q8', q8), b('Q9', q9)], 'RC84V6-GAP-ABILITY-3')
  }
  // G15: 做过不少尝试但没结果 | 已经有一点稳定结果
  if (q5 === OPT.BELIEF_TRIED_NO_RESULT && q6 === Q6.STABLE_TRACTION) {
    return gap('TRIED', beliefSource, [b('Q6', q6)], 'RC84V6-GAP-TRIED')
  }
  // G01: 不知道该往哪走 | 换个方向 + 等待/分析 (D-3 discriminator)
  if (q5 === OPT.BELIEF_NO_DIRECTION && q9 === OPT.NORESULT_SWITCH &&
      WAITING_ANALYSIS.includes(q7)) {
    return gap('DIRECTION', beliefSource, [b('Q7', q7), b('Q9', q9)], 'RC84V6-GAP-DIRECTION')
  }

  // ── TIME: partial by default (OQ-1). Single signal never hard. ──
  if (q5 === OPT.BELIEF_TIME &&
      [OPT.TIME_SHORT_FIRST, OPT.TIME_LONG_DROPS].includes(q8)) {
    return {
      relation: 'BELIEF_PARTIAL',
      subType: 'TIME',
      beliefSource,
      behaviorSources: [b('Q8', q8)],
      explanationRuleId: 'RC84V6-TIME-PARTIAL'
    }
  }

  // ── No contradiction -> belief holds ──
  return {
    relation: 'BELIEF_MATCH',
    subType: null,
    beliefSource,
    behaviorSources: [],
    explanationRuleId: null
  }
}

function gap (subType, beliefSource, behaviorSources, ruleId) {
  return {
    relation: 'BELIEF_REALITY_GAP',
    subType,
    beliefSource,
    behaviorSources,
    explanationRuleId: ruleId
  }
}

module.exports = { computeBeliefRelation }
