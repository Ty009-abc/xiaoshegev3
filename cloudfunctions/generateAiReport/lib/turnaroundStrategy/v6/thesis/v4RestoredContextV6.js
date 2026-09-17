'use strict'
/**
 * turnaroundStrategy/v6/thesis/v4RestoredContextV6.js
 *
 * RC8.4 V6 R70 — FULL Hybrid-10Q CONTEXT payload for the V4-restored report method.
 *
 * Restores the OLD V4 philosophy: the model receives ONE complete user profile
 * (all 18 Hybrid answers, human-readable) + the deterministic diagnostic result
 * (B1 / asset / proof) AS CONTEXT, then forms ONE strategic thesis and writes the
 * five cards from it.
 *
 * BOUNDARY:
 *   - B1 is DIAGNOSTIC EVIDENCE, NOT COPY AUTHORITY. Every deterministic signal
 *     is passed under `context`; nothing is a hard-copy template.
 *   - ZERO fabrication: this builder only maps ALREADY-ANSWERED fields. It never
 *     invents occupation / income / customers / history.
 *   - CONSUMER LAYER ONLY. Deterministic. No AI. No I/O. No network.
 */

// Human-readable labels for every Hybrid-10Q optionId (the user's own language).
const L = {
  // reality
  LIFE_18_24: '18–24 岁', LIFE_25_30: '25–30 岁', LIFE_31_40: '31–40 岁', LIFE_41_50: '41–50 岁', LIFE_51_PLUS: '50 岁以上',
  INC_SALARY: '主要靠一份工资', INC_SKILL_SERVICE: '靠接单/技能服务', INC_COMMISSION: '靠提成/绩效',
  INC_BUSINESS: '有在经营的生意', INC_CONTENT: '靠内容/流量', INC_ASSET: '有资产性收入', INC_UNSTABLE: '收入不稳定',
  SURPLUS_NEGATIVE: '每月结余是负的', SURPLUS_ZERO: '每月基本没有结余', SURPLUS_UNDER_1K: '每月结余不足 1000 元',
  SURPLUS_1K_5K: '每月结余 1000–5000 元', SURPLUS_5K_10K: '每月结余 5000–10000 元', SURPLUS_OVER_10K: '每月结余 1 万元以上',
  SAFETY_UNDER_1: '存款撑不到 1 个月', SAFETY_1_3: '存款能撑 1–3 个月', SAFETY_3_6: '存款能撑 3–6 个月',
  SAFETY_6_12: '存款能撑 6–12 个月', SAFETY_12_24: '存款能撑 12–24 个月', SAFETY_24_PLUS: '存款能撑两年以上',
  DEBT_NONE: '目前没有负债', DEBT_MORTGAGE: '主要是房贷', DEBT_CONSUMER: '消费贷/信用卡压力偏大', DEBT_HIGH: '债务压力已经比较高',
  // asset
  ASSET_TECHNICAL: '技术类能力', ASSET_SALES: '销售/谈单能力', ASSET_OPS: '运营/统筹能力',
  ASSET_CONTENT: '内容创作能力', ASSET_NETWORK: '人脉/资源对接能力', ASSET_CRAFT: '手艺型能力', ASSET_UNCLEAR: '还没想清是哪一项能力',
  PROOF_NEVER: '这项能力还从没被人用过', PROOF_FREE_HELPED: '免费帮人做过、但没收过钱',
  PROOF_FREE_THANKED: '免费帮人做过、对方很认可', PROOF_PAID_ONCE: '被人付过一次钱', PROOF_OCCASIONAL: '断断续续有过付费',
  PROOF_STABLE: '已经有稳定客户/长期合作',
  // capacity
  TIME_UNDER_2: '每周自由时间不到 2 小时', TIME_2_5: '每周自由时间 2–5 小时', TIME_5_10: '每周自由时间 5–10 小时',
  TIME_10_20: '每周自由时间 10–20 小时', TIME_20_PLUS: '每周自由时间 20 小时以上',
  EXEC_VOLATILE: '执行很不稳定', EXEC_UNSTABLE: '执行不太稳定', EXEC_STABLE: '执行比较稳定', EXEC_VERY_STABLE: '执行非常稳定',
  COST_ZERO: '试错预算几乎为零', COST_UNDER_1K: '能承受 1000 元以内的试错', COST_1K_5K: '能承受 1000–5000 元的试错',
  COST_5K_20K: '能承受 5000–20000 元的试错', COST_OVER_20K: '能承受 20000 元以上的试错',
  // desiredChange
  PROBLEM_INCOME_STUCK: '收入卡住了、上不去', PROBLEM_NO_FUTURE: '看不到未来的方向',
  PROBLEM_DEBT: '被债务和现金流压着', PROBLEM_CAREER_SWITCH: '想转行/换赛道', PROBLEM_SIDE_UNSTARTED: '副业一直没真正开始',
  PROBLEM_MONETIZE: '有本事却变不成钱', PROBLEM_FOCUS: '事太多、无法聚焦', PROBLEM_OTHER: '其它问题',
  GOAL_SIDE_INCOME: '先搞出一份副业收入', GOAL_SKILL_MONETIZE: '把技能真正变现', GOAL_PERSONAL_BRAND: '把个人 IP 做起来',
  GOAL_CAREER_SWITCH: '转行进一个新领域', GOAL_SIDE_TO_MAIN: '把副业做成主业', GOAL_DEBT: '先把债务和现金流修好', GOAL_FIND_DIRECTION: '先找到一个方向',
  // stage
  ATTEMPT_NONE: '过去一年基本没真正尝试过', ATTEMPT_COURSE_ONLY: '只报过课/学过、没落地', ATTEMPT_UNDER_30D: '试过不到 30 天就停了',
  ATTEMPT_NO_SALE: '做过产品/服务、但没卖出去', ATTEMPT_FEW_SALES: '有过一两笔成交', ATTEMPT_STABLE_SIDE: '副业已经相对稳定',
  // behavior
  DECISION_ALL_IN: '做决定要么全押要么放弃', DECISION_SMALL_TEST: '习惯先小步试一下', DECISION_LEARN_FIRST: '习惯先学明白再动手',
  DECISION_WAIT_OTHERS: '习惯先看别人怎么做', DECISION_AVOID: '倾向先回避、拖着不做',
  TIME_SHORT_FIRST: '优先做眼前最急的事', TIME_BALANCE: '在生活和工作之间平衡', TIME_PROTECT_LONG: '会刻意保留长期投入的时间', TIME_LONG_DROPS: '长期投入一忙就断',
  // belief
  BELIEF_NO_DIRECTION: '觉得自己是没找到方向', BELIEF_KNOW_NO_ACTION: '知道该做什么、但没行动',
  BELIEF_TRIED_NO_RESULT: '试过但没结果', BELIEF_RESOURCE: '觉得自己缺资源/启动资金', BELIEF_TIME: '觉得自己没时间',
  BELIEF_FEAR: '怕失败/怕被拒绝', BELIEF_SWITCHING: '总在换方向', BELIEF_ABILITY: '怀疑自己能力不够',
  BELIEF_FAMILY: '受家庭/环境限制', BELIEF_OTHER: '其它原因',
  // failureResponse
  FAIL_GIVE_UP: '遇到挫折容易放弃', FAIL_SWITCH: '遇到挫折就换方向', FAIL_RECHECK: '遇到挫折会复盘再试',
  FAIL_ADD_MONEY: '遇到挫折会加大投入', FAIL_UNSURE: '还没想好失败后怎么办'
}
const lbl = (v) => (v == null ? null : (L[v] || String(v)))

/**
 * Build the full user-profile block (all 18 answered fields, human language).
 * @param {Object} hybrid HybridProfile
 * @returns {Object} { lifeStage, occupation, incomeStructure, ... } with labels
 */
function buildUserContext (hybrid) {
  const h = hybrid || {}
  const r = h.reality || {}
  const a = h.asset || {}
  const c = h.capacity || {}
  const d = h.desiredChange || {}
  const g = h.stage || {}
  const b = h.behavior || {}
  const bl = h.belief || {}
  return {
    lifeStage: lbl(r.lifeStage),
    occupationDetail: r.occupation || null,
    incomeStructure: lbl(r.incomeStructure),
    monthlySurplus: lbl(r.monthlySurplus),
    safetyMonths: lbl(r.safetyMonths),
    debtPressure: lbl(r.debtPressure),
    monetizableSkill: lbl(a.type),
    skillValidation: lbl(a.marketProof),
    weeklyTime: lbl(c.weeklyTime),
    executionStability: lbl(c.executionStability),
    maxTrialCost: lbl(c.maxTrialCost),
    primaryProblem: lbl(d.primaryProblem),
    primaryGoal: lbl(d.primaryGoal),
    pastAttemptStage: lbl(g.pastAttemptStage),
    decisionStyle: lbl(b.decisionStyle),
    timeBehavior: lbl(b.timeAllocation),
    selfBelief: lbl(bl.perceivedRootCause),
    failureResponse: lbl(b.noResultResponse)
  }
}

/**
 * Build the DIAGNOSTIC-EVIDENCE block (context only; never copy authority).
 */
function buildDiagnosticContext (diagnosis, hybridContext) {
  const d = diagnosis || {}
  const hc = hybridContext || {}
  return {
    diagnosisState: d.diagnosisState || null,
    primaryBottleneck: d.primaryBottleneck || null,
    executionStage: d.executionStage || null,
    beliefRelation: (d.beliefRelation && d.beliefRelation.relation) || null,
    firstActionType: d.firstActionType || null,
    // asset / proof axis — a CONTEXT FACT the model may interpret broadly
    assetState: hc.assetState || null,
    assetTypeText: hc.assetTypeText || null,
    marketValidated: hc.marketValidated === true,
    crossAxisScope: hc.crossAxisScope || null,
    crossObjectEvidencePattern: hc.crossObjectEvidencePattern || 'UNKNOWN'
  }
}

/**
 * Build the full V4-restored payload.
 * @returns {Object} { userContext, diagnosticContext, hasUserOccupation, answeredFieldCount }
 */
function buildV4RestoredPayload (hybrid, diagnosis, hybridContext) {
  const userContext = buildUserContext(hybrid)
  const diagnosticContext = buildDiagnosticContext(diagnosis, hybridContext)
  const answeredFieldCount = Object.keys(userContext).filter((k) => userContext[k] != null).length
  return {
    reportVersion: 'v4-restored',
    userContext,
    diagnosticContext,
    hasUserOccupation: !!userContext.occupationDetail,
    answeredFieldCount
  }
}

module.exports = { buildV4RestoredPayload, buildUserContext, buildDiagnosticContext, LABELS: L }
