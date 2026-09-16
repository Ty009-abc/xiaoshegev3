'use strict'
/**
 * turnaroundStrategy/v6/hybrid/hybridReportContextV6.js
 *
 * RC8.4 V6 R44 — ADDITIVE report specificity context (CARD02 / CARD04 / CARD05).
 *
 * HARD RULES:
 *   - ZERO bottleneck authority (never touches primaryBottleneck / stage / action type).
 *   - ZERO AI authority.
 *   - Evidence-gated: copy that asserts market validation is emitted ONLY when the
 *     asset axis is genuinely validated (MARKET_PROOF_OVERCLAIM_COUNT = 0).
 *   - No age stereotypes · no income shaming · no unsupported career predictions ·
 *     no guaranteed-earning claims (UNSUPPORTED_ASSET_STRATEGY_COUNT = 0).
 *   - When `hybrid` is null/undefined the returned context is null and every card
 *     builder stays byte-identical to the pre-R44 9Q output.
 *
 * CONSUMER LAYER ONLY. Deterministic. No AI. No I/O. No network.
 */

const { computeAssetStateV6 } = require('./assetAxisV6.js')

// Reality/capacity phrasing (neutral, non-judging).
const LIFE_STAGE = {
  LIFE_18_24: '刚起步的阶段', LIFE_25_30: '25–30 岁这个阶段',
  LIFE_31_40: '31–40 岁这个阶段', LIFE_41_50: '41–50 岁这个阶段',
  LIFE_51_PLUS: '50 岁以后这个阶段'
}
const SURPLUS = {
  SURPLUS_NEGATIVE: '每月结余是负的', SURPLUS_ZERO: '每月基本没有结余',
  SURPLUS_UNDER_1K: '每月结余不足 1000 元', SURPLUS_1K_5K: '每月结余 1000–5000 元',
  SURPLUS_5K_10K: '每月结余 5000–10000 元', SURPLUS_OVER_10K: '每月结余 1 万元以上'
}
const SAFETY = {
  SAFETY_UNDER_1: '存款撑不到 1 个月', SAFETY_1_3: '存款大概能撑 1–3 个月',
  SAFETY_3_6: '存款大概能撑 3–6 个月', SAFETY_6_12: '存款大概能撑 6–12 个月',
  SAFETY_12_24: '存款大概能撑 12–24 个月', SAFETY_24_PLUS: '存款能撑两年以上'
}
const DEBT = {
  DEBT_NONE: '目前没有负债', DEBT_MORTGAGE: '身上主要是房贷',
  DEBT_CONSUMER: '消费贷/信用卡压力偏大', DEBT_HIGH: '债务压力已经比较高'
}
const WEEKLY = {
  TIME_UNDER_2: '每周自由时间不到 2 小时', TIME_2_5: '每周自由时间 2–5 小时',
  TIME_5_10: '每周自由时间 5–10 小时', TIME_10_20: '每周自由时间 10–20 小时',
  TIME_20_PLUS: '每周自由时间 20 小时以上'
}
const COST = {
  COST_ZERO: '试错预算几乎为零', COST_UNDER_1K: '能承受的试错成本在 1000 元以内',
  COST_1K_5K: '能承受的试错成本在 1000–5000 元', COST_5K_20K: '能承受的试错成本在 5000–20000 元',
  COST_OVER_20K: '能承受的试错成本在 20000 元以上'
}
const ASSET_TYPE = {
  ASSET_TECHNICAL: '技术类能力', ASSET_SALES: '销售/谈单能力', ASSET_OPS: '运营/统筹能力',
  ASSET_CONTENT: '内容创作能力', ASSET_NETWORK: '人脉/资源对接能力', ASSET_CRAFT: '手艺型能力'
}
const GOAL = {
  GOAL_SIDE_INCOME: '先搞出一份副业收入', GOAL_SKILL_MONETIZE: '把技能真正变现',
  GOAL_PERSONAL_BRAND: '把个人 IP 做起来', GOAL_CAREER_SWITCH: '转行进一个新领域',
  GOAL_SIDE_TO_MAIN: '把副业做成主业', GOAL_DEBT: '先把债务和现金流修好',
  GOAL_FIND_DIRECTION: '先找到一个方向'
}

function pick (map, v, fb) {
  return (v && Object.prototype.hasOwnProperty.call(map, v)) ? map[v] : (fb || null)
}

/**
 * Build the report specificity context. Returns null when no hybrid profile is
 * present (keeps the 9Q path byte-identical).
 */
function buildHybridReportContextV6 (hybrid) {
  if (!hybrid || typeof hybrid !== 'object') return null

  const asset = computeAssetStateV6(hybrid)
  const occupation = hybrid.reality && hybrid.reality.occupation ? hybrid.reality.occupation : null
  const assetTypeText = pick(ASSET_TYPE, hybrid.asset && hybrid.asset.type, null)

  // ── CARD02 — reality + asset position (why the current rule blocks conversion)
  const realityParts = []
  if (occupation) realityParts.push(`你的职业是「${occupation}」`)
  const life = pick(LIFE_STAGE, hybrid.reality && hybrid.reality.lifeStage)
  const surplus = pick(SURPLUS, hybrid.reality && hybrid.reality.monthlySurplus)
  if (life) realityParts.push(life)
  if (surplus) realityParts.push(surplus)
  const realityLine = realityParts.length ? realityParts.join('，') + '。' : ''

  const assetLine = assetLineFor(asset, assetTypeText)

  // ── CARD04 — old value position → new value/strategy position (evidence-gated)
  const pathLine = pathSpecificityFor(asset, assetTypeText, occupation)

  // ── CARD05 — sizing for the reality test (time/budget/proof stage)
  const sizingParts = []
  const wk = pick(WEEKLY, hybrid.capacity && hybrid.capacity.weeklyTime)
  const cost = pick(COST, hybrid.capacity && hybrid.capacity.maxTrialCost)
  if (wk) sizingParts.push(wk)
  if (cost) sizingParts.push(cost)
  const sizingLine = sizingParts.length ? sizingParts.join('，') + '。' : ''

  // ── risk context (report-only; never a diagnosis input)
  const riskParts = []
  const safety = pick(SAFETY, hybrid.reality && hybrid.reality.safetyMonths)
  const debt = pick(DEBT, hybrid.reality && hybrid.reality.debtPressure)
  if (safety) riskParts.push(safety)
  if (debt) riskParts.push(debt)
  const riskLine = riskParts.length ? riskParts.join('，') + '。' : ''

  // ── goal (REPORT-ONLY; PRIMARY_GOAL_B1_USAGE_COUNT = 0)
  const goalLine = pick(GOAL, hybrid.desiredChange && hybrid.desiredChange.primaryGoal)

  return {
    occupation,
    assetState: asset.state,
    assetIndex: asset.index,
    marketValidated: asset.marketValidated,
    assetNamed: asset.assetNamed,
    assetTypeText,
    realityLine,
    assetLine,
    pathLine,
    sizingLine,
    riskLine,
    goalLine,
    sources: ['reality', 'asset', 'capacity', 'desiredChange.primaryGoal']
  }
}

/** CARD02 asset-position sentence. Never overclaims market validation. */
function assetLineFor (asset, assetTypeText) {
  switch (asset.state) {
    case 'NO_CLEAR_ASSET':
      return '你目前还没有一个真正被市场碰过的能力。'
    case 'SKILL_IDENTIFIED_UNPROVEN':
      return `你身上有一个具体能力（${assetTypeText || '某一类能力'}），但它还没有被市场验证过。`
    case 'SKILL_USED_FREE':
      return `你的${assetTypeText || '这项能力'}有人用过、也认可，但一直没有产生收入。`
    case 'PROBLEM_SOLVING_PROOF':
      return `你的${assetTypeText || '这项能力'}实实在在解决过别人的问题，但还没人为此付过钱。`
    case 'PAID_ONCE':
      return `你的${assetTypeText || '这项能力'}已经被人付过一次钱，说明它真的能换钱。`
    case 'OCCASIONAL_PAID':
      return `你的${assetTypeText || '这项能力'}已经有断断续续的付费需求，缺的是稳定。`
    case 'REPEATABLE_PAID':
      return `你的${assetTypeText || '这项能力'}已经有了能重复付费的客户。`
    default:
      return ''
  }
}

/** CARD04 strategy-specificity sentence. Evidence-gated; no invented leverage. */
function pathSpecificityFor (asset, assetTypeText, occupation) {
  const occClause = occupation ? `你现在的「${occupation}」不是白做的——` : ''
  switch (asset.state) {
    case 'NO_CLEAR_ASSET':
      return '你现在最该做的不是谈方向，而是先用最小成本，做出一个真正卖得出去的能力雏形——先让一个真实的人愿意为它付第一笔钱。'
    case 'SKILL_IDENTIFIED_UNPROVEN':
      return `${occClause}下一步不是继续学，而是把「${assetTypeText || '这项能力'}」做成一个具体的、可以被别人购买的东西。`
    case 'SKILL_USED_FREE':
      return `${occClause}你已经能帮人解决问题，接下来要从「免费帮忙」变成「明码标价的服务」。`
    case 'PROBLEM_SOLVING_PROOF':
      return `${occClause}你的能力已经能解决问题，缺的只是把它变成一个别人愿意付费的形态。`
    case 'PAID_ONCE':
      return `${occClause}既然已经有人为它付过钱，下一步的重点不是再证明会不会，而是测试这项能力能否被重复购买。`
    case 'OCCASIONAL_PAID':
      return `${occClause}你已经有零星付费，接下来要把它从「偶尔有人买」变成「有固定的供给和交付方式」。`
    case 'REPEATABLE_PAID':
      return `${occClause}你已经有了可重复的收入来源，下一步是把这套已经跑通的模式放大，而不是从头再来。`
    default:
      return ''
  }
}

module.exports = { buildHybridReportContextV6, LIFE_STAGE, ASSET_TYPE }
