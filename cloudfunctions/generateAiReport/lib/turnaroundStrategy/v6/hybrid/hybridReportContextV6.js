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
const { buildProofConsistencyV6 } = require('./proofConsistencyV6.js')

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

// ── R62 §5/§6/§11 — CROSS-OBJECT LINK-FIRST COPY ──────────────────────
// When the CAPABILITY axis (skillValidation = market proof) and the ATTEMPT
// axis (pastAttemptStage = past-year attempt) DIVERGE, the two facts describe
// DIFFERENT objects. The deterministic fallback must NOT collapse them: it may
// not assert the paid capability caused the recent attempt, nor that a past
// sale is about this capability. Instead it falls to a LINK test — verify
// whether the two are even the same object — exactly the R53 link-first
// philosophy. This is the deterministic counterpart of what the AI thesis is
// asked to do. ZERO B1 authority (it scopes the CARD04 target + CARD05 step
// only; bottleneck / stage / action type are untouched).
const CROSS_OBJECT_LINK = {
  PROVEN_CAPABILITY_RECENT_ATTEMPT_FAILED: {
    to: '先确认这项已经有付费证据的能力，能不能用在你现在想解决的问题上',
    stageLead: '你手里的能力已经被证明能换钱，但最近这一次尝试，未必是在验证同一件事',
    card03: {
      steps: [
        '你手里的这项能力，确实有过人愿意为它付费的证据。',
        '但你现在想解决的问题、以及最近这一次尝试，未必和当初被付费的那件事是同一件。',
        '你把这两件事当成了一件事，于是要么高估了这次尝试，要么低估了已有的证明。',
        '真正没被看清的，是这两者之间到底连不连得上。',
        '在连接被验证之前，任何“这条路行不行”的结论都还太早。'
      ],
      insight: '你已经证明过这项能力能换钱，但还没证明它就是你现在该走的那条路。'
    },
    card05: {
      hypothesis: '这项已经有人付过钱的能力，能不能用在你现在想解决的问题上。',
      action: '今天找1个已经走在你现在想解决问题那条路上的人，问清楚：他手上的事，能不能用上你这项已经有人付过钱的能力。',
      target: '1个已经走在你现在想解决问题那条路上的人',
      checks: ['写下你现在真正想解决的那一个问题', '列出这项能力可能的1种用法'],
      done: '对方明确说这件事用得上、或用不上你现有的这项能力。',
      decision: '只要这个连接被证实或证伪，就用它决定要不要把这项能力用在现在的问题上。'
    }
  },
  UNPROVEN_CAPABILITY_PRIOR_SALE_EXPERIENCE: {
    to: '先确认你过去成交过的那一件事，和你现在这条路是不是同一件事',
    stageLead: '你过去有过一次成交，但那是不是你现在这条路，还没有被看清',
    card03: {
      steps: [
        '你过去确实有过一次成交，那是一次真实发生过的结果。',
        '但现在这条路要用的能力，和你当时靠的那件事，未必是同一件事。',
        '你把那次成交直接当成了“这条路能走”的证据。',
        '真正没被看清的，是那次成交到底靠的是什么，以及它适不适用于现在。',
        '在这一点弄清楚之前，照搬上一次的做法也只是碰运气。'
      ],
      insight: '你有过一次成交，但还没看清它和你现在这条路是不是同一件事。'
    },
    card05: {
      hypothesis: '你过去那次成交，和你现在这条路是不是同一件事。',
      action: '今天把你过去有成交的那一次写清楚：买的人当时到底买的是什么，这件事和你现在想做的事是不是同一件。',
      target: '你自己（写清上次成交真正靠的是什么）',
      checks: ['写下那次成交里，客户当时真正买的是什么', '写下你现在这条路要用的能力'],
      done: '你能讲清上次成交靠的是什么，以及它适不适用于现在这条路。',
      decision: '只要搞清上次成交靠的是什么，就用它判断现在这条路能不能照做。'
    }
  }
}

/**
 * Build the report specificity context. Returns null when no hybrid profile is
 * present (keeps the 9Q path byte-identical).
 * @param {Object} hybrid HybridProfile
 * @param {Object} [diagnosis] V6 diagnosis (authority for proof-aware wording)
 */
function buildHybridReportContextV6 (hybrid, diagnosis) {
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

  // ── R46 §6–§11 — MARKET-PROOF FACT CONSISTENCY (paid bands only). ──
  // Produces proof-aware overrides for cards that ASSERT a market fact, so no
  // visible card contradicts the known proof state. ZERO bottleneck authority:
  // the diagnosis (bottleneck/actionType) is read, never changed.
  const proof = buildProofConsistencyV6({
    assetState: asset.state,
    bottleneck: (diagnosis && diagnosis.primaryBottleneck) || null,
    actionType: (diagnosis && diagnosis.firstActionType) || null
  })

  // ── R48 §7 — CONDITIONALLY COMPATIBLE cross-axis scope ──
  // When the two axes are UNPROVEN-same-object (a paid asset + a pre-payment
  // execution gap), the asset axis may still state the FACTUAL market position,
  // but the STRATEGY may not be linked across axes (it may not assume the paid
  // asset IS the object of the current desired change). Scope-limited contexts
  // therefore KEEP the factual CARD04-FROM + CARD02 asset line, and DROP the
  // proof-aware strategy overrides (CARD02 leap / CARD04 TO / CARD03 / CARD05) so
  // the cards fall back to the frozen, axis-agnostic base copy.
  const crossAxisScope = (diagnosis && diagnosis.compatibility && diagnosis.compatibility.crossAxisScope) || 'COMPATIBLE'
  const scopeLimited = crossAxisScope === 'UNPROVEN'

  // ── R62 §5 — NEUTRAL CROSS-OBJECT EVIDENCE SIGNAL ──
  // Describes how the CAPABILITY axis and the ATTEMPT axis DIVERGE (e.g. a
  // proven capability + a recent failed attempt). It carries ZERO B1 diagnosis
  // authority and never claims a contradiction: the two facts are about
  // different objects, so the divergence is not a conflict. It exists only so
  // the Thesis layer may interpret the divergence without collapsing objects.
  const crossObjectEvidencePattern = (diagnosis && diagnosis.compatibility && diagnosis.compatibility.crossObjectEvidencePattern) || 'UNKNOWN'
  // R62 — divergence of the two INDEPENDENT axes => link-first deterministic
  // copy (no same-object collapse). Only the two divergence patterns qualify.
  const crossLink = scopeLimited ? (CROSS_OBJECT_LINK[crossObjectEvidencePattern] || null) : null

  return {
    occupation,
    occupationCategory: (hybrid.reality && hybrid.reality.occupationCategory) || null,
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
    // R51 — raw Hybrid-only evidence for the first-class NO_PRIMARY builder.
    // Not bottleneck authority: the NO_PRIMARY path never states a primary.
    evidence: {
      occupation: occupation,
      incomeStructure: hybrid.reality && hybrid.reality.incomeStructure ? hybrid.reality.incomeStructure : null,
      monthlySurplus: hybrid.reality && hybrid.reality.monthlySurplus ? hybrid.reality.monthlySurplus : null,
      weeklyTime: hybrid.capacity && hybrid.capacity.weeklyTime ? hybrid.capacity.weeklyTime : null,
      maxTrialCost: hybrid.capacity && hybrid.capacity.maxTrialCost ? hybrid.capacity.maxTrialCost : null,
      decisionStyle: hybrid.behavior && hybrid.behavior.decisionStyle ? hybrid.behavior.decisionStyle : null,
      selfBelief: hybrid.belief && hybrid.belief.perceivedRootCause ? hybrid.belief.perceivedRootCause : null,
      primaryProblem: hybrid.desiredChange && hybrid.desiredChange.primaryProblem ? hybrid.desiredChange.primaryProblem : null,
      // R53 — desired-change / asset-identity evidence for the NO_PRIMARY
      // cross-axis scope (fail-closed). Not bottleneck authority.
      primaryGoal: hybrid.desiredChange && hybrid.desiredChange.primaryGoal ? hybrid.desiredChange.primaryGoal : null,
      monetizableSkill: hybrid.asset && hybrid.asset.type ? hybrid.asset.type : null,
      assetNamed: !!(hybrid.asset && hybrid.asset.type && hybrid.asset.type !== 'ASSET_UNCLEAR')
    },
    crossAxisScope,
    scopeLimited,
    crossObjectEvidencePattern,
    // R85-B §11/§13 — deterministic real economy model (runtime context only).
    realEconomyModel: hybrid.realEconomyModel || null,
    // proof-aware overrides (null/absent => card uses frozen base copy)
    // R46 §8: CARD04 "现在"(FROM) is a pure market-position FACT and is
    // proof-aware for ALL states (the stage-keyed base copy can contradict the
    // proof state). R48 §7: this FACT is KEPT even when the scope is limited -
    // it asserts the user's market position, never a cross-axis strategy link.
    proofFrom: proof.card04.from,
    // R46 §8: "接下来"(TO) is proof-refined only for paid bands, and (R48 §7)
    // only when the cross-axis scope is NOT limited. R62: when the two axes
    // DIVERGE (cross-object), the TO is a deterministic LINK-FIRST target so the
    // fallback never asserts the paid asset IS the current path.
    proofTo: crossLink ? crossLink.to : ((!scopeLimited && proof.isPaidBand) ? proof.card04.to : null),
    card02Leap: (!scopeLimited && proof.card02Leap) ? proof.card02Leap : null,
    // R62: cross-object divergence => link-first CARD03 loop (never a same-object
    // claim). Routed through the existing `card03` field that systemLoopV6 reads.
    card03: crossLink ? crossLink.card03 : ((!scopeLimited && proof.card03) ? proof.card03 : null),
    // R62: cross-object divergence => link-first CARD05 (never a same-object step).
    card05: crossLink ? crossLink.card05 : ((!scopeLimited && proof.card05) ? proof.card05 : null),
    // R62: neutral link-framed stage lead for divergence (prevents a B1 stage lead
    // from asserting the opposite market fact as if it were the SAME object).
    crossStageLead: crossLink ? crossLink.stageLead : null,
    sources: ['reality', 'asset', 'capacity', 'desiredChange.primaryGoal', 'proofConsistency', 'compatibility', 'crossObjectEvidencePattern', 'realEconomyModel']
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

/**
 * CARD04 asset ANCHOR sentence — occupation + asset-position, NON-strategic.
 * R46 §10: the strategy now lives in the proof-aware from/to (turnaroundPathV6),
 * so this line stays an identity/evidence anchor to avoid duplicate rendering.
 * Never overclaims market validation.
 */
function pathSpecificityFor (asset, assetTypeText, occupation) {
  const occ = occupation ? `你现在的「${occupation}」` : '你现在这份能力'
  switch (asset.state) {
    case 'NO_CLEAR_ASSET':
      return occupation
        ? `你现在的「${occupation}」还只是一个身份，还没变成一个别人能买的能力。`
        : '你现在还没有一个别人愿意购买的能力。'
    case 'SKILL_IDENTIFIED_UNPROVEN':
      return `${occ}不是白练的——你已经有一个具体的能力，只是还没人验证过。`
    case 'SKILL_USED_FREE':
      return `${occ}不是白做的——你已经能帮人解决问题，只是还没收过钱。`
    case 'PROBLEM_SOLVING_PROOF':
      return `${occ}不是白做的——它实实在在解决过别人的问题。`
    case 'PAID_ONCE':
      return `${occ}不是白做的——它已经被真实验证过一次。`
    case 'OCCASIONAL_PAID':
      return `${occ}不是白做的——已经有人反复为它付过钱。`
    case 'REPEATABLE_PAID':
      return `${occ}不是白做的——它已经是一份能重复的收入。`
    default:
      return ''
  }
}

module.exports = { buildHybridReportContextV6, LIFE_STAGE, ASSET_TYPE, CROSS_OBJECT_LINK }
