'use strict'
/**
 * turnaroundStrategy/v6/hybrid/worldModelV1.js
 *
 * RC8.4 V6 R86-C — WORLD MODEL (deterministic, NO LLM).
 *
 * WHAT IT IS
 *   A deterministic EVIDENCE_LAYER model of HOW THE USER REASONS about the
 *   world — not what they earn, not their job, not their personality type.
 *   Five cognitive axes, each measured by exactly ONE primary cognitive
 *   scenario (a question about how the user THINKS), with optional reality /
 *   game SUPPORTING signals that may only move CONFIDENCE or surface a MIXED
 *   state — never own the axis.
 *
 *   LABOR       how the user models value creation   (S6 laborModel)
 *   PROBABILITY how the user models uncertainty      (S8 decisionStyle, reused)
 *   SYSTEM      how the user models recurring causes (S9 systemModel)
 *   RULE        how the user models who sets rules    (S10 ruleModel)
 *   EVIDENCE    how the user models what counts as proof (S10 failureResponse, reused)
 *
 * AUTHORITY (frozen, non-negotiable — R86-B1 §1/§6/§7/§8)
 *   - WORLD_MODEL is measured ONLY by how the user REASONS (cognitive input).
 *   - Reality facts (pricingAuthority / skillValidation / incomeStructure /
 *     occupation) are SUPPORTING CONTEXT ONLY. They can raise/lower confidence
 *     and feed the mismatch comparator, but they NEVER set or flip an axis.
 *     => REALITY_TO_WORLD_MODEL_DIRECT_AUTHORITY_COUNT = 0
 *   - SUPPORTING_MAY_FLIP_AXIS = NO (except the one documented intra-axis
 *     MIXED rule below, where a second OBSERVED behaviour signal on the SAME
 *     axis conflicts with the primary).
 *   - No axis is ranked / scored / called smart. States DESCRIBE a default
 *     model; they never judge the person.
 *
 * BOUNDARY: pure deterministic. No I/O. No AI. No network. No persistence.
 */

const { EVIDENCE, capConfidence } = require('./gameModelV6.js')

const WORLD_MODEL_VERSION = 'r86c_world_model_v1'

const AXES = Object.freeze(['LABOR', 'PROBABILITY', 'SYSTEM', 'RULE', 'EVIDENCE'])

// ── per-axis state vocabulary (frozen; UNKNOWN + MIXED supported) ────────────
const AXIS_STATES = Object.freeze({
  LABOR: ['TIME_LINEAR', 'REUSABLE_ASSET', 'LEVERAGED', 'PRICING_POSITION', 'UNKNOWN', 'MIXED'],
  PROBABILITY: ['BASE_RATE_AWARE', 'EXPERIMENT_FIRST', 'CERTAINTY_SEEKING', 'RESULT_BIASED', 'RISK_BOUNDED', 'UNKNOWN', 'MIXED'],
  SYSTEM: ['STRUCTURAL_FEEDBACK', 'PERSON_ATTRIBUTION', 'PER_EVENT', 'NO_AWARENESS', 'UNKNOWN', 'MIXED'],
  RULE: ['RULE_AWARE', 'EFFORT_DEFAULT', 'DEMAND_ROLE', 'NO_AWARENESS', 'UNKNOWN', 'MIXED'],
  EVIDENCE: ['REPEATABLE_EVIDENCE', 'PRAISE_BASED', 'LUCK_DISMISS', 'UNREFLECTIVE', 'UNKNOWN', 'MIXED']
})

// ── primary cognitive option → axis state (one primary scenario per axis) ────
const LABOR_OPTION_STATE = Object.freeze({
  LABOR_MORE_WORK: 'TIME_LINEAR',
  LABOR_REUSABLE: 'REUSABLE_ASSET',
  LABOR_LEVERAGE: 'LEVERAGED',
  LABOR_PRICING: 'PRICING_POSITION'
})
const PROBABILITY_OPTION_STATE = Object.freeze({
  DECISION_SMALL_TEST: 'EXPERIMENT_FIRST',
  DECISION_LEARN_FIRST: 'BASE_RATE_AWARE',
  DECISION_WAIT_OTHERS: 'CERTAINTY_SEEKING',
  DECISION_ALL_IN: 'RESULT_BIASED',
  DECISION_AVOID: 'RISK_BOUNDED'
})
const SYSTEM_OPTION_STATE = Object.freeze({
  SYS_PERSON: 'PERSON_ATTRIBUTION',
  SYS_STRUCTURE: 'STRUCTURAL_FEEDBACK',
  SYS_PER_EVENT: 'PER_EVENT',
  SYS_NONE: 'NO_AWARENESS'
})
const RULE_OPTION_STATE = Object.freeze({
  RULE_EFFORT: 'EFFORT_DEFAULT',
  RULE_AWARE: 'RULE_AWARE',
  RULE_DEMAND: 'DEMAND_ROLE',
  RULE_NONE: 'NO_AWARENESS'
})
const EVIDENCE_OPTION_STATE = Object.freeze({
  EVID_PRAISE: 'PRAISE_BASED',
  EVID_REPEATABLE: 'REPEATABLE_EVIDENCE',
  EVID_LUCK: 'LUCK_DISMISS',
  EVID_UNREFLECTIVE: 'UNREFLECTIVE'
})

// Which raw field is the ONE primary cognitive scenario for each axis.
const PRIMARY_SOURCE_KEY = Object.freeze({
  LABOR: 'laborModel',
  PROBABILITY: 'decisionStyle',
  SYSTEM: 'systemModel',
  RULE: 'ruleModel',
  EVIDENCE: 'failureResponse'
})

// ── adaptation rank: 0 = less broadly fitting (upgrade candidate); 1 = broadly
//    adapted. NOT a quality score — "less broadly fitting" only (§20). ────────
const ADAPT_RANK = Object.freeze({
  LABOR: { TIME_LINEAR: 0, REUSABLE_ASSET: 1, LEVERAGED: 1, PRICING_POSITION: 1 },
  PROBABILITY: { CERTAINTY_SEEKING: 0, RESULT_BIASED: 0, EXPERIMENT_FIRST: 1, BASE_RATE_AWARE: 1, RISK_BOUNDED: 1 },
  SYSTEM: { PERSON_ATTRIBUTION: 0, NO_AWARENESS: 0, PER_EVENT: 0, STRUCTURAL_FEEDBACK: 1 },
  RULE: { EFFORT_DEFAULT: 0, NO_AWARENESS: 0, DEMAND_ROLE: 0, RULE_AWARE: 1 },
  EVIDENCE: { PRAISE_BASED: 0, LUCK_DISMISS: 0, UNREFLECTIVE: 0, REPEATABLE_EVIDENCE: 1 }
})

// ── MODEL_UPGRADE map (§3): old model → new model, descriptive, never moral ──
const UPGRADE_MAP = Object.freeze({
  LABOR: {
    toState: 'REUSABLE_ASSET',
    toText: '价值可以沉淀、可以被重复使用',
    framing: '从「我投入多少时间就换多少」→「价值可以积累、可以被杠杆或被重新定价」'
  },
  PROBABILITY: {
    toState: 'EXPERIMENT_FIRST',
    toText: '用样本比例和有边界的试错代替确定性',
    framing: '从「先确定结果再行动」→「用样本比例与有边界的试错代替确定性」'
  },
  SYSTEM: {
    toState: 'STRUCTURAL_FEEDBACK',
    toText: '看激励结构、反馈回路与机制',
    framing: '从「换个靠谱的人就好」→「看激励结构、反馈回路与二阶效应，机制会重演结果」'
  },
  RULE: {
    toState: 'RULE_AWARE',
    toText: '先看规则制定者、收益归属与风险承担者',
    framing: '从「努力就是解法」→「先看规则制定者、收益归属与风险承担者，再看自己的位置」'
  },
  EVIDENCE: {
    toState: 'REPEATABLE_EVIDENCE',
    toText: '靠可重复、可被证伪的外部证据判断',
    framing: '从「靠感觉和别人的评价判断」→「靠可重复、可被证伪的外部证据判断」'
  }
})

// ── human-language state descriptions (descriptive; non-moral) ───────────────
const STATE_TEXT = Object.freeze({
  TIME_LINEAR: '价值 = 我投入的时间',
  REUSABLE_ASSET: '价值可以沉淀、重复使用',
  LEVERAGED: '价值可以被别人的时间或工具承接',
  PRICING_POSITION: '价值取决于站在哪个定价位置',
  BASE_RATE_AWARE: '先看这件事大概成的比例',
  EXPERIMENT_FIRST: '先小范围试，用结果说话',
  CERTAINTY_SEEKING: '要先确定结果才行动',
  RESULT_BIASED: '看到别人有结果就跟',
  RISK_BOUNDED: '先算清楚占用与代价再决定',
  STRUCTURAL_FEEDBACK: '回流与激励在决定反复出现的事',
  PERSON_ATTRIBUTION: '出了问题先想是谁不行',
  PER_EVENT: '每次都当独立的一次来看',
  NO_AWARENESS: '还没细想过这一类问题',
  RULE_AWARE: '先看是谁在定规则、谁在定价',
  EFFORT_DEFAULT: '努力一点、做好一点就好',
  DEMAND_ROLE: '先看市场还缺不缺人',
  REPEATABLE_EVIDENCE: '靠能不能重复、能不能被推翻判断',
  PRAISE_BASED: '靠别人的评价判断',
  LUCK_DISMISS: '把成绩归给运气',
  UNREFLECTIVE: '不回头看，直接做下一件',
  UNKNOWN: '还看不清'
})

// ── REALITY TEST per axis (§5): one bounded, reversible, NON-money-first test
//    — it asks "does the upgraded model explain reality better?" ─────────────
const REALITY_TEST = Object.freeze({
  LABOR: '把手停几天：如果不再往里投入时间，看还剩什么在自动运转。',
  PROBABILITY: '在结果出来之前，先写下自己的预测与把握程度，再对照结果。',
  SYSTEM: '动手改变之前，先画出这件事的激励结构与反馈回路（谁因此得到什么）。',
  RULE: '行动之前，先分清：规则是谁定的、收益归谁、风险谁担。',
  EVIDENCE: '先说清楚：什么情况出现，就说明我现在的看法是错的。'
})

// ────────────────────────────────────────────────────────────────────────────
// Direction rules for SUPPORTING signals.
//   ALIGNED  → corroborates the primary's state family (may raise confidence)
//   CONFLICT → disagrees with the primary (cognitive signal ⇒ MIXED; reality
//              signal ⇒ confidence effect only + mismatch comparator operand)
//   NEUTRAL  → no decisive direction
// `cognitive:true` marks an INDEPENDENT OBSERVED behaviour signal on the SAME
// axis that §18 rule 3 allows to (a) raise to HIGH when aligned, and (b) drive
// a MIXED state when it conflicts. Reality facts are `cognitive:false`.
// ────────────────────────────────────────────────────────────────────────────

function familyOf (axis, state) {
  if (axis === 'LABOR') return state === 'TIME_LINEAR' ? 'LINEAR' : (state === 'UNKNOWN' || state === 'MIXED' ? 'NEUTRAL' : 'ADAPTED')
  // For every other axis, rank 1 = 'ADAPTED', rank 0 = 'FIXED'.
  const r = ADAPT_RANK[axis][state]
  if (r == null) return 'NEUTRAL'
  return r === 1 ? 'ADAPTED' : 'FIXED'
}

function dirFromPreference (axis, state, preferredFamily) {
  if (preferredFamily === 'NEUTRAL') return 'NEUTRAL'
  const fam = familyOf(axis, state)
  if (fam === 'NEUTRAL') return 'NEUTRAL'
  return fam === preferredFamily ? 'ALIGNED' : 'CONFLICT'
}

function laborSupport (state, raw, gm, em) {
  const items = []
  const tb = raw.timeBehavior
  if (tb) {
    // a second distinct BEHAVIOUR signal (cognitive on this axis)
    const pref = (tb === 'TIME_PROTECT_LONG') ? 'ADAPTED'
      : (tb === 'TIME_SHORT_FIRST' || tb === 'TIME_LONG_DROPS') ? 'LINEAR' : 'NEUTRAL'
    items.push({ source: 'timeBehavior=' + tb, class: EVIDENCE.OBSERVED, cognitive: true, dir: dirFromPreference('LABOR', state, pref) })
  }
  const lev = gm && gm.leverageState && gm.leverageState.value
  if (lev) {
    const pref = lev === 'LEVERAGED' ? 'ADAPTED' : lev === 'TIME_BOUND' ? 'LINEAR' : 'NEUTRAL'
    items.push({ source: 'gameModel.leverageState=' + lev, class: EVIDENCE.DERIVED, cognitive: false, dir: dirFromPreference('LABOR', state, pref) })
  }
  const inc = raw.incomeStructure
  if (inc) {
    const pref = (inc === 'INC_SALARY' || inc === 'INC_COMMISSION' || inc === 'INC_UNSTABLE') ? 'LINEAR'
      : 'ADAPTED'
    items.push({ source: 'incomeStructure=' + inc, class: EVIDENCE.OBSERVED, cognitive: false, dir: dirFromPreference('LABOR', state, pref) })
  }
  return items
}

function probabilitySupport (state, raw) {
  const items = []
  const st = raw.pastAttemptStage
  if (st) {
    const pref = (st === 'ATTEMPT_NONE' || st === 'ATTEMPT_COURSE_ONLY') ? 'FIXED' : 'ADAPTED'
    items.push({ source: 'pastAttemptStage=' + st, class: EVIDENCE.OBSERVED, cognitive: false, dir: dirFromPreference('PROBABILITY', state, pref) })
  }
  const sm = raw.safetyMonths
  if (sm) {
    const pref = (sm === 'SAFETY_24_PLUS') ? 'ADAPTED' : (sm === 'SAFETY_UNDER_1') ? 'FIXED' : 'NEUTRAL'
    items.push({ source: 'safetyMonths=' + sm, class: EVIDENCE.OBSERVED, cognitive: false, dir: dirFromPreference('PROBABILITY', state, pref) })
  }
  const ct = raw.maxTrialCost
  if (ct) {
    const pref = (ct === 'COST_ZERO') ? 'FIXED' : (ct === 'COST_5K_20K' || ct === 'COST_OVER_20K') ? 'ADAPTED' : 'NEUTRAL'
    items.push({ source: 'maxTrialCost=' + ct, class: EVIDENCE.OBSERVED, cognitive: false, dir: dirFromPreference('PROBABILITY', state, pref) })
  }
  return items
}

function systemSupport (state, raw, gm) {
  const items = []
  const ro = gm && gm.ruleOwner && gm.ruleOwner.value
  if (ro) {
    const pref = (ro === 'EMPLOYER' || ro === 'PLATFORM' || ro === 'CLIENT') ? 'ADAPTED' : 'NEUTRAL'
    items.push({ source: 'gameModel.ruleOwner=' + ro, class: EVIDENCE.DERIVED, cognitive: false, dir: dirFromPreference('SYSTEM', state, pref) })
  }
  const fr = raw.failureResponse
  if (fr) {
    items.push({ source: 'failureResponse=' + fr, class: EVIDENCE.OBSERVED, cognitive: false, dir: 'NEUTRAL' })
  }
  return items
}

function ruleSupport (state, raw, gm, ppm) {
  const items = []
  const pa = raw.pricingAuthority
  if (pa) {
    const pref = (pa === 'PRICE_EMPLOYER' || pa === 'PRICE_PLATFORM' || pa === 'PRICE_CLIENT') ? 'FIXED'
      : (pa === 'PRICE_SELF' ? 'ADAPTED' : 'NEUTRAL')
    items.push({ source: 'pricingAuthority=' + pa, class: EVIDENCE.OBSERVED, cognitive: false, dir: dirFromPreference('RULE', state, pref) })
  }
  const gt = gm && gm.gameType && gm.gameType.value
  if (gt) items.push({ source: 'gameModel.gameType=' + gt, class: EVIDENCE.DERIVED, cognitive: false, dir: 'NEUTRAL' })
  const au = ppm && ppm.authority && (ppm.authority.value || ppm.authority)
  if (au) items.push({ source: 'pricingPower.authority=' + au, class: EVIDENCE.DERIVED, cognitive: false, dir: 'NEUTRAL' })
  return items
}

function evidenceSupport (state, raw) {
  const items = []
  const sv = raw.skillValidation
  if (sv) {
    const pref = (sv === 'PROOF_PAID_ONCE' || sv === 'PROOF_OCCASIONAL' || sv === 'PROOF_STABLE') ? 'ADAPTED' : 'NEUTRAL'
    items.push({ source: 'skillValidation=' + sv, class: EVIDENCE.OBSERVED, cognitive: false, dir: dirFromPreference('EVIDENCE', state, pref) })
  }
  const ms = raw.monetizableSkill
  if (ms) items.push({ source: 'monetizableSkill=' + ms, class: EVIDENCE.OBSERVED, cognitive: false, dir: 'NEUTRAL' })
  return items
}

const SUPPORT_BUILDERS = Object.freeze({
  LABOR: laborSupport,
  PROBABILITY: probabilitySupport,
  SYSTEM: systemSupport,
  RULE: ruleSupport,
  EVIDENCE: evidenceSupport
})

// ── axis resolver ────────────────────────────────────────────────────────────

/**
 * Resolve ONE axis deterministically.
 * @param {string} axis
 * @param {Object} raw validated raw answers
 * @param {Object} tables { optionToState, supportBuilder }
 * @param {Object} deps { gm, em, ppm }
 */
function resolveAxis (axis, raw, optionToState, buildSupport) {
  const srcKey = PRIMARY_SOURCE_KEY[axis]
  const rawVal = raw[srcKey]
  const recognized = typeof rawVal === 'string' && Object.prototype.hasOwnProperty.call(optionToState, rawVal)
  let state = recognized ? optionToState[rawVal] : 'UNKNOWN'

  const primaryEvidence = recognized
    ? [{ source: srcKey + '=' + rawVal, class: EVIDENCE.OBSERVED, note: 'primary cognitive answer' }]
    : [{ source: srcKey + '=' + (rawVal == null ? 'ABSENT' : String(rawVal)), class: EVIDENCE.UNKNOWN, note: 'absent or unrecognized' }]

  const support = (buildSupport || (() => []))(state, raw) || []
  const supportingEvidence = support.map((s) => ({ source: s.source, class: s.class, dir: s.dir, cognitive: !!s.cognitive }))

  // MIXED — an independent OBSERVED cognitive signal on the SAME axis conflicts.
  const conflictCognitive = support.some((s) => s.cognitive && s.class === EVIDENCE.OBSERVED && s.dir === 'CONFLICT')
  if (recognized && conflictCognitive) state = 'MIXED'

  // Confidence.
  let confidence = 'UNKNOWN'
  if (state !== 'UNKNOWN') {
    const alignedIndependentObserved = support.some((s) => s.class === EVIDENCE.OBSERVED && s.dir === 'ALIGNED')
    // §18 rule 3: a lone primary can at most support MEDIUM; an independent
    // aligned OBSERVED support (behaviour or reality) unlocks HIGH.
    let declared = alignedIndependentObserved ? 'HIGH' : 'MEDIUM'
    if (state === 'MIXED') declared = 'MEDIUM' // §18 rule 4
    const evidence = primaryEvidence.concat(supportingEvidence.map((s) => ({ class: s.class })))
    confidence = capConfidence(declared, evidence)
    if (state === 'MIXED' && confidence === 'HIGH') confidence = 'MEDIUM'
  }

  return {
    axis: axis,
    state: state,
    stateText: STATE_TEXT[state] || STATE_TEXT.UNKNOWN,
    primaryEvidence: primaryEvidence,
    supportingEvidence: supportingEvidence,
    confidence: confidence,
    provenance: ['worldModelV1', 'axis=' + axis, 'primary=' + srcKey]
  }
}

/**
 * Compute the deterministic World Model.
 * @param {Object} raw validated raw hybrid answers
 * @param {Object} [deps] { profile, gameModel, realEconomyModel, pricingPower }
 * @returns {Object}
 */
function computeWorldModelV1 (raw, deps) {
  const r = raw || {}
  const d = deps || {}
  const profile = d.profile || null
  const gm = d.gameModel || (profile && profile.gameModel) || null
  const ppm = d.pricingPower || (profile && profile.pricingPower) || null
  const em = d.realEconomyModel || (profile && profile.realEconomyModel) || null

  const S = SUPPORT_BUILDERS
  const axes = {
    LABOR: resolveAxis('LABOR', r, LABOR_OPTION_STATE, (st, rr) => S.LABOR(st, rr, gm, em)),
    PROBABILITY: resolveAxis('PROBABILITY', r, PROBABILITY_OPTION_STATE, (st, rr) => S.PROBABILITY(st, rr)),
    SYSTEM: resolveAxis('SYSTEM', r, SYSTEM_OPTION_STATE, (st, rr) => S.SYSTEM(st, rr, gm)),
    RULE: resolveAxis('RULE', r, RULE_OPTION_STATE, (st, rr) => S.RULE(st, rr, gm, ppm)),
    EVIDENCE: resolveAxis('EVIDENCE', r, EVIDENCE_OPTION_STATE, (st, rr) => S.EVIDENCE(st, rr))
  }

  // Focus axis = the axis whose state is LEAST broadly fitting (min rank);
  // ties resolve by the frozen AXES order. UNKNOWN axes cannot be upgraded.
  let focusAxis = null
  let minRank = Infinity
  let anyDefined = false
  for (const a of AXES) {
    const st = axes[a].state
    if (st === 'UNKNOWN') continue
    anyDefined = true
    const rank = st === 'MIXED' ? 0 : (ADAPT_RANK[a][st] != null ? ADAPT_RANK[a][st] : 0)
    if (rank < minRank) { minRank = rank; focusAxis = a }
  }
  const needsModelUpgrade = anyDefined && minRank === 0

  let upgrade = null
  if (focusAxis) {
    const st = axes[focusAxis].state
    const map = UPGRADE_MAP[focusAxis]
    const alreadyAdapted = !needsModelUpgrade
    upgrade = {
      axis: focusAxis,
      fromState: st,
      fromText: STATE_TEXT[st] || STATE_TEXT.UNKNOWN,
      toState: alreadyAdapted ? st : map.toState,
      toText: alreadyAdapted ? (STATE_TEXT[st] || STATE_TEXT.UNKNOWN) : map.toText,
      framing: alreadyAdapted
        ? '模型已经够贴近现实，这次要升级的是「位置」而不是「模型」'
        : map.framing,
      realityTest: REALITY_TEST[focusAxis],
      needsModelUpgrade: needsModelUpgrade
    }
  }

  const unknownCount = AXES.filter((a) => axes[a].state === 'UNKNOWN').length
  const mixedCount = AXES.filter((a) => axes[a].state === 'MIXED').length

  // A GENUINE R86-C submission answers all three NEW world-model cognitive
  // fields. Legacy / frozen fixtures never do → downstream screens must stay
  // byte-identical for them.
  const isR86C = !!(r.laborModel && LABOR_OPTION_STATE[r.laborModel]) &&
    !!(r.systemModel && SYSTEM_OPTION_STATE[r.systemModel]) &&
    !!(r.ruleModel && RULE_OPTION_STATE[r.ruleModel])

  return {
    version: WORLD_MODEL_VERSION,
    axes: axes,
    isR86C: isR86C,
    focusAxis: focusAxis,
    dominantAxis: focusAxis,
    weakestAxis: focusAxis,
    needsModelUpgrade: needsModelUpgrade,
    upgrade: upgrade,
    // measure-only diagnostics
    unknownCount: unknownCount,
    mixedCount: mixedCount,
    primarySignalCountPerAxis: 1,
    realityDirectAuthorityCount: 0
  }
}

/**
 * Render the world model + upgrade as human-readable prompt lines (deterministic).
 */
function renderWorldModelLines (wm) {
  const m = wm || null
  if (!m || !m.axes) return []
  const lines = []
  lines.push('世界模型版本：' + m.version)
  const label = { LABOR: '价值/劳动', PROBABILITY: '不确定性', SYSTEM: '反复出现的原因', RULE: '规则与定价', EVIDENCE: '什么算证据' }
  for (const a of AXES) {
    const ax = m.axes[a]
    lines.push('- ' + label[a] + '（' + a + '）：' + (ax.stateText || ax.state) + '｜置信 ' + (ax.confidence || 'UNKNOWN'))
  }
  if (m.upgrade) {
    lines.push('焦点轴：' + m.upgrade.axis + '｜当前模型：' + m.upgrade.fromText)
    if (m.upgrade.needsModelUpgrade) {
      lines.push('模型升级方向：' + m.upgrade.framing)
    } else {
      lines.push('模型升级方向：' + m.upgrade.framing)
    }
    lines.push('现实检验（非先谈钱）：' + m.upgrade.realityTest)
  }
  lines.push('约束：世界模型只描述「他习惯怎么理解问题」，不是智商/高低/对错；不因为现实事实（职业/收入/定价方）而改变某一个轴的判断。')
  return lines
}

const WORLD_MODEL_UPGRADE_MAP = UPGRADE_MAP
const WORLD_MODEL_STATE_TEXT = STATE_TEXT
const WORLD_MODEL_REALITY_TEST = REALITY_TEST

module.exports = {
  WORLD_MODEL_VERSION,
  AXES,
  AXIS_STATES,
  LABOR_OPTION_STATE,
  PROBABILITY_OPTION_STATE,
  SYSTEM_OPTION_STATE,
  RULE_OPTION_STATE,
  EVIDENCE_OPTION_STATE,
  PRIMARY_SOURCE_KEY,
  ADAPT_RANK,
  WORLD_MODEL_UPGRADE_MAP,
  WORLD_MODEL_STATE_TEXT,
  WORLD_MODEL_REALITY_TEST,
  computeWorldModelV1,
  renderWorldModelLines
}
