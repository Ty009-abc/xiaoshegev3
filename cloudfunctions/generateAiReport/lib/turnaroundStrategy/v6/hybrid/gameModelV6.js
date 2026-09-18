'use strict'
/**
 * turnaroundStrategy/v6/hybrid/gameModelV6.js
 *
 * RC8.4 V6 R85C1 — DETERMINISTIC GAME MODEL (珠澳小事哥 IP restore) + AUTHORITY REPAIR.
 *
 * The R85-B RealEconomyModel answers "靠什么换钱 / 谁在定价 / 什么能迁移" and is
 * kept as an EVIDENCE / REALITY layer. THIS layer answers the ORIGINAL IP
 * question ABOVE it:
 *
 *   你现在玩的是什么局？谁定规则？谁掌握定价权？为什么越努力越容易被锁住？
 *   要换的是努力还是位置？下一步最小现实下注是什么？
 *
 * ── AUTHORITY REPAIR (R85C1) ────────────────────────────────────────────────
 * The first R85-C cut let occupation / incomeStructure infer pricing authority,
 * customer ownership and customer recognition more strongly than evidence
 * permits. Repaired rules:
 *   §4  DIRECT user answer (pricingAuthority) ALWAYS outranks inference from
 *       occupation / incomeStructure. Income only performs a COMPATIBILITY check.
 *   §5  PRICE_UNKNOWN (or an unresolvable signal conflict) → the model outputs
 *       UNKNOWN — it NEVER fabricates EMPLOYER / PLATFORM / CLIENT / USER.
 *   §6  Occupation / occupationCategory NEVER defines pricing authority.
 *   §10 gameType derives from pricingAuthority (+ incomeStructure compatibility),
 *       NOT from an occupation stereotype. A genuine conflict → MIXED / UNKNOWN.
 *   §11 every deterministic field exposes value + sourceEvidence[] + confidence +
 *       provenance; a claim is never stronger than its strongest evidence.
 *   §12 no "程序员通常… / 厨师一般… / 骑手一定…" career common-sense as fact.
 *
 * It adds NO new taxonomy of people, NO salary/market data, NO career destiny.
 * Each evidence contribution is classified OBSERVED / DERIVED / INFERRED /
 * UNKNOWN — never a fake number, never a single-signal stereotype.
 *
 * AUTHORITY (frozen):
 *   - ZERO bottleneck authority. NEVER read by any B1 file.
 *   - EVIDENCE_LAYER only. Grounded causal INPUT for the thesis prompt; NOT copy
 *     authority and NOT a final diagnosis.
 *   - NO external market data.
 *   - RUNTIME ONLY (not persisted as a permanent profile fact).
 *
 * CONSUMER LAYER ONLY. Deterministic. No AI. No I/O. No network.
 */

const GAME_VERSION = 'r85c1_game_model_v1'

const EVIDENCE = Object.freeze({
  OBSERVED: 'OBSERVED',
  DERIVED: 'DERIVED',
  INFERRED: 'INFERRED',
  UNKNOWN: 'UNKNOWN'
})

// §7 — deliberately SMALL structural game types.
const GAME_TYPES = Object.freeze([
  'EMPLOYER_PRICED', 'PLATFORM_PRICED', 'CLIENT_PRICED',
  'COMMISSION_PRICED', 'SELF_PRICED', 'MIXED', 'UNKNOWN'
])
// §8 — what the user is actually exchanging.
const VALUE_EXCHANGE = Object.freeze([
  'TIME', 'PHYSICAL_LABOR', 'TECHNICAL_SKILL', 'SALES_RESULT',
  'CONTENT', 'SERVICE', 'CAPITAL', 'SYSTEM', 'MIXED', 'UNKNOWN'
])
// §6 — who currently holds most pricing authority (central to the IP).
const PRICING_AUTHORITY = Object.freeze([
  'EMPLOYER', 'PLATFORM', 'CLIENT', 'USER', 'MARKET', 'MIXED', 'UNKNOWN'
])
// §9 — who controls the critical rule / pricing POSITION (becomes central).
const RULE_OWNER = Object.freeze([
  'EMPLOYER', 'PLATFORM', 'CLIENT', 'USER', 'MIXED', 'UNKNOWN'
])
const CUSTOMER_DISTANCE = Object.freeze(['DIRECT', 'INTERMEDIATED', 'FAR', 'UNKNOWN'])
const DEPENDENCY_STRUCTURE = Object.freeze([
  'EMPLOYER_DEP', 'PLATFORM_DEP', 'CLIENT_DEP', 'MIXED', 'LOW', 'UNKNOWN'
])
const MARKET_PROOF_STATE = Object.freeze([
  'NO_PROOF', 'FREE_ONLY', 'PAID_ONCE', 'OCCASIONAL', 'REPEATABLE', 'UNKNOWN'
])
const REPEATABILITY_STATE = Object.freeze([
  'ONE_OFF', 'PARTIAL', 'REPEATABLE', 'UNKNOWN'
])
const LEVERAGE_STATE = Object.freeze(['TIME_BOUND', 'MIXED', 'LEVERAGED', 'UNKNOWN'])

// ── §3/§4 pricingAuthority FIELD — who decides the FINAL income ──
// DIRECT authority: the user answered it. It outranks every inference.
const PRICE_TO_PRICING_AUTHORITY = Object.freeze({
  PRICE_EMPLOYER: 'EMPLOYER',
  PRICE_PLATFORM: 'PLATFORM',
  PRICE_CLIENT: 'CLIENT',
  PRICE_SELF: 'USER',
  PRICE_MIXED: 'MIXED',
  PRICE_UNKNOWN: 'UNKNOWN'
})
const PRICE_TO_GAME_TYPE = Object.freeze({
  PRICE_EMPLOYER: 'EMPLOYER_PRICED',
  PRICE_PLATFORM: 'PLATFORM_PRICED',
  PRICE_CLIENT: 'CLIENT_PRICED',
  PRICE_SELF: 'SELF_PRICED',
  PRICE_MIXED: 'MIXED',
  PRICE_UNKNOWN: 'UNKNOWN'
})

// ── gameType from income structure — FALLBACK ONLY, used when the direct
//    pricing answer is ABSENT / UNKNOWN. Occupation never participates. ──
//    CONTENT_MONETIZATION is deliberately UNKNOWN: content can be platform-,
//    client- or self-priced, so it MUST come from the direct answer.
const GAME_TYPE_BY_INCOME_MODEL = Object.freeze({
  SALARIED_LABOR: 'EMPLOYER_PRICED',
  SERVICE_FEE: 'CLIENT_PRICED',
  COMMISSION: 'COMMISSION_PRICED',
  OWNED_BUSINESS: 'SELF_PRICED',
  CONTENT_MONETIZATION: 'UNKNOWN',
  ASSET_INCOME: 'SELF_PRICED',
  IRREGULAR: 'MIXED'
})

// ── §5 pricingAuthority derived from gameType — FALLBACK ONLY, used when the
//    direct answer is ABSENT. UNKNOWN → UNKNOWN (never fabricated). ──
const PRICING_BY_GAME_TYPE = Object.freeze({
  EMPLOYER_PRICED: 'EMPLOYER',
  PLATFORM_PRICED: 'PLATFORM',
  CLIENT_PRICED: 'CLIENT',
  COMMISSION_PRICED: 'MIXED',
  SELF_PRICED: 'USER',
  MIXED: 'MIXED',
  UNKNOWN: 'UNKNOWN'
})

// ── §4/§10 compatibility: the only CLEARLY contradictory (income → game) pairs.
//    A direct answer is preferred, but a genuine contradiction is surfaced as
//    MIXED rather than silently accepted. Anything not listed is compatible. ──
const INCOMPATIBLE_INCOME = Object.freeze({
  SELF_PRICED: ['SALARIED_LABOR'], // "I price myself" but income is a fixed salary
  EMPLOYER_PRICED: ['OWNED_BUSINESS'], // "employer prices me" but income is my own business
  PLATFORM_PRICED: ['OWNED_BUSINESS']
})

// ── §9 ruleOwner. DIRECT answer: the party that controls the income RULE. When
//    the direct answer is MIXED / UNKNOWN (or absent), the rule owner is NOT
//    invented from income — it stays MIXED / UNKNOWN. ──
const RULE_OWNER_BY_PRICE = Object.freeze({
  PRICE_EMPLOYER: 'EMPLOYER',
  PRICE_PLATFORM: 'PLATFORM',
  PRICE_CLIENT: 'CLIENT',
  PRICE_SELF: 'USER',
  PRICE_MIXED: 'MIXED',
  PRICE_UNKNOWN: 'UNKNOWN'
})
const RULE_OWNER_BY_INCOME_MODEL = Object.freeze({
  SALARIED_LABOR: 'EMPLOYER',
  SERVICE_FEE: 'CLIENT',
  COMMISSION: 'UNKNOWN',
  OWNED_BUSINESS: 'USER',
  CONTENT_MONETIZATION: 'UNKNOWN',
  ASSET_INCOME: 'USER',
  IRREGULAR: 'UNKNOWN'
})

// ── valueExchange from asset type, with an INFERRED category prior (context
//    only — never authority). ──
const VALUE_BY_ASSET = Object.freeze({
  ASSET_TECHNICAL: 'TECHNICAL_SKILL',
  ASSET_SALES: 'SALES_RESULT',
  ASSET_OPS: 'SYSTEM',
  ASSET_CONTENT: 'CONTENT',
  ASSET_NETWORK: 'SALES_RESULT',
  ASSET_CRAFT: 'SERVICE'
})
const VALUE_BY_CATEGORY = Object.freeze({
  OCC_PLATFORM_LABOR: 'PHYSICAL_LABOR',
  OCC_SERVICE: 'SERVICE',
  OCC_TECH: 'TECHNICAL_SKILL',
  OCC_SALES: 'SALES_RESULT',
  OCC_CONTENT_CREATIVE: 'CONTENT',
  OCC_SELF_EMPLOYED: 'SERVICE',
  OCC_OPERATIONS_ADMIN: 'SYSTEM'
})

// ── market proof ladder (§3: skillValidation) ──
const PROOF_STATE = Object.freeze({
  PROOF_NEVER: 'NO_PROOF',
  PROOF_FREE_HELPED: 'FREE_ONLY',
  PROOF_FREE_THANKED: 'FREE_ONLY',
  PROOF_PAID_ONCE: 'PAID_ONCE',
  PROOF_OCCASIONAL: 'OCCASIONAL',
  PROOF_STABLE: 'REPEATABLE'
})

// ── §27 authority gate: a claim is never stronger than its strongest evidence ──
// OBSERVED and DERIVED (a deterministic transform of an observed answer) can
// support HIGH; an occupancy/category-only INFERRED signal caps at MEDIUM; an
// all-UNKNOWN evidence set caps at UNKNOWN.
const CLASS_RANK = Object.freeze({ OBSERVED: 3, DERIVED: 2, INFERRED: 1, UNKNOWN: 0 })
const CONF_ORDER = Object.freeze(['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH'])
function allowedConfidence (evidence) {
  let r = 0
  for (const e of (evidence || [])) r = Math.max(r, CLASS_RANK[e && e.class] != null ? CLASS_RANK[e.class] : 0)
  return r >= 2 ? 'HIGH' : r === 1 ? 'MEDIUM' : 'UNKNOWN'
}
function capConfidence (declared, evidence) {
  const allowed = allowedConfidence(evidence)
  return CONF_ORDER[Math.min(CONF_ORDER.indexOf(declared), CONF_ORDER.indexOf(allowed))] || 'UNKNOWN'
}

function value (dim, model) {
  const d = (model && model.dimensions && model.dimensions[dim]) || null
  return d ? (d.value || 'UNKNOWN') : 'UNKNOWN'
}
function dimEvidence (dim, model) {
  const d = (model && model.dimensions && model.dimensions[dim]) || null
  return (d && Array.isArray(d.sourceEvidence)) ? d.sourceEvidence.slice() : []
}
function dimConf (dim, model) {
  const d = (model && model.dimensions && model.dimensions[dim]) || null
  return d ? (d.confidence || 'UNKNOWN') : 'UNKNOWN'
}
function ev (source, cls, note) { return { source: source, class: cls, note: note } }
function prov (...f) { const o = []; for (const x of f) if (x) o.push(x); return o }

/**
 * §4/§5/§6/§10 — resolve the game type.
 * The DIRECT pricing answer outranks income inference. A genuine contradiction
 * between the direct answer and the income structure surfaces as MIXED.
 * @returns {{gameType:string, via:string, note:string, conflict:boolean}}
 */
function resolveGameType (incomeModel, priceRaw) {
  const fromPrice = priceRaw && PRICE_TO_GAME_TYPE[priceRaw]
  if (fromPrice) {
    if (fromPrice === 'UNKNOWN') {
      return { gameType: 'UNKNOWN', via: 'pricingAuthority', note: '用户自答说不清定价方', conflict: false }
    }
    // Commission is structurally its own game even when pricing is "mixed"
    // (the client decides the sale; the settlement is only partly owned).
    if (fromPrice === 'MIXED' && incomeModel === 'COMMISSION') {
      return { gameType: 'COMMISSION_PRICED', via: 'pricingAuthority+income', note: 'PRICE_MIXED + 提成结构 = 提成定价局', conflict: false }
    }
    const incompat = INCOMPATIBLE_INCOME[fromPrice]
    if (incomeModel && incompat && incompat.indexOf(incomeModel) !== -1) {
      return { gameType: 'MIXED', via: 'conflict', note: '直接答案与收入结构冲突，降级为 MIXED', conflict: true }
    }
    return { gameType: fromPrice, via: 'pricingAuthority', note: '定价权字段直接决定', conflict: false }
  }
  // Direct answer ABSENT → income fallback (inferred; never occupation).
  if (incomeModel && GAME_TYPE_BY_INCOME_MODEL[incomeModel]) {
    return { gameType: GAME_TYPE_BY_INCOME_MODEL[incomeModel], via: 'incomeModel', note: '无直接答案，仅由收入结构推导', conflict: false }
  }
  return { gameType: 'UNKNOWN', via: 'none', note: '证据不足', conflict: false }
}

/**
 * Compute the deterministic game model.
 * @param {Object} economy RealEconomyModel (computeRealEconomyModelV6 output)
 * @param {Object} [profile] HybridProfile (pricingAuthority / raw skill / stage / goal)
 * @returns {Object} game model (version + fields, each {value, sourceEvidence, confidence, provenance})
 */
function computeGameModelV6 (economy, profile) {
  const m = economy || null
  const p = profile || {}
  const r = p.reality || {}
  const asset = p.asset || {}
  const stage = p.stage || {}
  const desired = p.desiredChange || {}

  const incomeModel = (m && m.incomeModel) || null
  const category = (m && m.occupationCategory) || r.occupationCategory || null
  const incomeStructure = (m && m.incomeStructure) || r.incomeStructure || null
  const proof = asset.marketProof || (m && m.marketProof) || null
  const priceRaw = r.pricingAuthority || null
  const priceVal = r.pricingAuthorityValue || (priceRaw ? PRICE_TO_PRICING_AUTHORITY[priceRaw] : null) || null
  const hasDirect = !!priceRaw

  // ── gameType (§4/§5/§10) ──
  const rt = resolveGameType(incomeModel, priceRaw)
  const gameType = rt.gameType
  const gameTypeEv = []
  if (hasDirect) gameTypeEv.push(ev('pricingAuthority=' + priceRaw, EVIDENCE.OBSERVED, '用户自答：谁决定最终收入'))
  if (rt.conflict && incomeModel) gameTypeEv.push(ev('incomeStructure=' + incomeModel, EVIDENCE.OBSERVED, '与直接答案冲突'))
  else if (incomeModel) gameTypeEv.push(ev('incomeStructure=' + incomeModel, EVIDENCE.DERIVED, hasDirect ? '兼容性校验' : '收入结构推导'))
  if (!gameTypeEv.length) gameTypeEv.push(ev('incomeStructure=' + (incomeStructure || 'UNKNOWN'), EVIDENCE.UNKNOWN, '证据不足'))

  // ── valueExchange (§8) — asset answer first, category prior is context only ──
  const veEv = []
  const catVal = category && VALUE_BY_CATEGORY[category] ? VALUE_BY_CATEGORY[category] : null
  const assetVal = asset.type && VALUE_BY_ASSET[asset.type] ? VALUE_BY_ASSET[asset.type] : null
  let valueExchange = catVal || assetVal || 'UNKNOWN'
  if (catVal && assetVal && catVal !== assetVal) valueExchange = 'MIXED'
  if (catVal) veEv.push(ev('occupationCategory=' + category, EVIDENCE.INFERRED, '职业类别先验（仅语境）'))
  if (assetVal) veEv.push(ev('monetizableSkill=' + asset.type, EVIDENCE.OBSERVED, '用户自选的可变现能力'))
  if (!veEv.length) veEv.push(ev('incomeStructure=' + (incomeStructure || 'UNKNOWN'), EVIDENCE.UNKNOWN, '证据不足'))

  // ── pricingAuthority (§3/§4/§5/§6): DIRECT answer wins; else inferred ──
  const paEv = []
  let pricingAuthority
  let paConf
  if (hasDirect) {
    pricingAuthority = PRICE_TO_PRICING_AUTHORITY[priceRaw] || 'UNKNOWN'
    paEv.push(ev('pricingAuthority=' + priceRaw, EVIDENCE.OBSERVED, '用户自答的定价方'))
    paConf = 'HIGH'
  } else {
    pricingAuthority = PRICING_BY_GAME_TYPE[gameType] || 'UNKNOWN'
    paEv.push(ev('gameType=' + gameType, EVIDENCE.DERIVED, '无直接答案，由局推导定价方'))
    paConf = gameType === 'UNKNOWN' ? 'UNKNOWN' : 'MEDIUM'
  }

  // ── ruleOwner (§9): DIRECT answer wins; MIXED/UNKNOWN never invented ──
  const ruleOwnerEv = []
  let ruleOwner
  if (hasDirect) {
    ruleOwner = RULE_OWNER_BY_PRICE[priceRaw] || 'UNKNOWN'
    ruleOwnerEv.push(ev('pricingAuthority=' + priceRaw, EVIDENCE.OBSERVED, '定价方即规则方（直接自答）'))
  } else {
    ruleOwner = RULE_OWNER_BY_INCOME_MODEL[incomeModel] || 'UNKNOWN'
    ruleOwnerEv.push(ev('incomeStructure=' + (incomeModel || 'UNKNOWN'), EVIDENCE.DERIVED, '无直接答案，由收入结构推导'))
  }

  // ── customerDistance (context; occupation prior is INFERRED) ──
  const cp = value('CLIENT_PROXIMITY', m)
  const customerDistance = cp === 'HIGH' ? 'DIRECT' : cp === 'MEDIUM' ? 'INTERMEDIATED' : cp === 'LOW' ? 'FAR' : 'UNKNOWN'

  // ── dependencyStructure ──
  const pd = value('PLATFORM_DEPENDENCE', m)
  const ed = value('EMPLOYER_DEPENDENCE', m)
  let dependencyStructure = 'UNKNOWN'
  if (pd === 'HIGH') dependencyStructure = 'PLATFORM_DEP'
  else if (ed === 'HIGH') dependencyStructure = 'EMPLOYER_DEP'
  else if (ed === 'LOW' && pd === 'LOW') dependencyStructure = 'LOW'
  else if (ed !== 'UNKNOWN' || pd !== 'UNKNOWN') dependencyStructure = 'MIXED'

  // ── marketProofState ──
  const marketProofState = (proof && PROOF_STATE[proof]) || 'UNKNOWN'

  // ── repeatabilityState ──
  const rp = value('REPEATABILITY', m)
  const repeatabilityState = rp === 'HIGH' ? 'REPEATABLE' : rp === 'MEDIUM' ? 'PARTIAL' : rp === 'LOW' ? 'ONE_OFF' : 'UNKNOWN'

  // ── leverageState ──
  const t4m = value('TIME_FOR_MONEY', m)
  const port = value('PORTABILITY', m)
  let leverageState = 'UNKNOWN'
  if (t4m === 'HIGH' && port !== 'HIGH') leverageState = 'TIME_BOUND'
  else if (port === 'HIGH' && (t4m === 'LOW' || t4m === 'MEDIUM')) leverageState = 'LEVERAGED'
  else if (t4m !== 'UNKNOWN' || port !== 'UNKNOWN') leverageState = 'MIXED'

  // ── §10/§11 rule / trap / switch / bet — evidence-safe, no occupation destiny ──
  const rctx = { hasDirect: hasDirect, priceRaw: priceRaw, priceVal: priceVal, incomeModel: incomeModel, ed: ed, pd: pd, cp: cp, proof: marketProofState, conflict: rt.conflict }
  const rule = gameRuleFor(gameType, valueExchange, rctx)
  const trap = trapFor(gameType, valueExchange, rctx)
  const sw = switchFor(gameType, valueExchange, rctx)
  const bet = smallBetFor(gameType, valueExchange, { goal: desired.primaryGoal, stage: stage.pastAttemptStage, hasDirect: hasDirect, priceRaw: priceRaw })

  const dimsFor = (list) => { const o = []; for (const d of list) for (const e of dimEvidence(d, m)) o.push(e); return o }
  const confOf = (list) => {
    const cs = list.map((d) => dimConf(d, m))
    if (cs.some((c) => c === 'HIGH')) return 'HIGH'
    if (cs.some((c) => c === 'MEDIUM')) return 'MEDIUM'
    return 'UNKNOWN'
  }

  const out = {
    version: GAME_VERSION,
    gameType: { value: gameType, sourceEvidence: gameTypeEv, provenance: prov(hasDirect ? 'pricingAuthority' : null, incomeModel ? 'incomeStructure' : null) },
    valueExchange: { value: valueExchange, sourceEvidence: veEv, provenance: prov(asset.type ? 'monetizableSkill' : null, category ? 'occupationCategory' : null) },
    pricingAuthority: { value: pricingAuthority, sourceEvidence: paEv, provenance: prov(hasDirect ? 'pricingAuthority' : 'gameType', hasDirect ? null : 'incomeStructure') },
    ruleOwner: { value: ruleOwner, sourceEvidence: ruleOwnerEv, provenance: prov(hasDirect ? 'pricingAuthority' : null, hasDirect ? null : 'incomeStructure') },
    customerDistance: { value: customerDistance, sourceEvidence: dimEvidence('CLIENT_PROXIMITY', m), provenance: prov('incomeStructure', 'skillValidation', category ? 'occupationCategory' : null) },
    dependencyStructure: { value: dependencyStructure, sourceEvidence: dimsFor(['PLATFORM_DEPENDENCE', 'EMPLOYER_DEPENDENCE']), provenance: prov('incomeStructure', category ? 'occupationCategory' : null) },
    marketProofState: { value: marketProofState, sourceEvidence: [ev('skillValidation=' + (proof || 'UNKNOWN'), EVIDENCE.OBSERVED, '市场验证等级')], provenance: prov('skillValidation') },
    repeatabilityState: { value: repeatabilityState, sourceEvidence: dimEvidence('REPEATABILITY', m), provenance: prov('incomeStructure', 'skillValidation', category ? 'occupationCategory' : null) },
    leverageState: { value: leverageState, sourceEvidence: dimsFor(['PORTABILITY', 'TIME_FOR_MONEY']), provenance: prov('incomeStructure', category ? 'occupationCategory' : null) },
    gameRule: rule,
    trapMechanism: trap,
    switchDirection: sw,
    smallBetType: bet
  }

  // §11/§27 — apply the authority gate: a claim is never stronger than its
  // strongest supporting evidence.
  for (const k of Object.keys(out)) {
    const f = out[k]
    if (!f || f.value == null) continue
    if (!Array.isArray(f.sourceEvidence)) f.sourceEvidence = []
    const declared = f.confidence || 'HIGH'
    f.confidence = capConfidence(declared, f.sourceEvidence)
  }
  // customerDistance / dependency / repeatability / leverage carry no explicit
  // declared confidence (they come from the economy layer) → derive it.
  out.customerDistance.confidence = capConfidence(confOf(['CLIENT_PROXIMITY']), out.customerDistance.sourceEvidence)
  out.dependencyStructure.confidence = capConfidence(confOf(['PLATFORM_DEPENDENCE', 'EMPLOYER_DEPENDENCE']), out.dependencyStructure.sourceEvidence)
  out.repeatabilityState.confidence = capConfidence(confOf(['REPEATABILITY']), out.repeatabilityState.sourceEvidence)
  out.leverageState.confidence = capConfidence(confOf(['PORTABILITY', 'TIME_FOR_MONEY']), out.leverageState.sourceEvidence)
  return out
}

// ── §10 GAME RULE — deterministic structural rule (never overclaims) ──
function gameRuleFor (gameType, valueExchange, ctx) {
  const c = ctx || {}
  const byGame = {
    EMPLOYER_PRICED: valueExchange === 'TECHNICAL_SKILL'
      ? '雇主购买你的岗位价值，并替你面对最终市场。'
      : valueExchange === 'SERVICE'
        ? '这一行按岗位/店家定价，你的收入经由雇主或店家体系结算。'
        : '雇主购买你的时间与岗位价值，最终市场由公司替你面对。',
    PLATFORM_PRICED: '平台掌握流量与订单分配，你靠在线时长/接单量换收入。',
    CLIENT_PRICED: '你直接面对买家，价格由你和客户当场谈成。',
    COMMISSION_PRICED: '你靠成交产生收入，收入结算仍依赖公司体系。',
    SELF_PRICED: valueExchange === 'CONTENT'
      ? '你拥有内容和账号，但分发和变现规则由平台决定。'
      : '你拥有这门生意，价格和客户由你自己设定。',
    MIXED: '收入来源分散、规则不清晰，没有一个稳定的定价方。',
    UNKNOWN: '目前的收入规则还不清晰，你还没看清自己在哪个局里。'
  }
  const text = byGame[gameType] || byGame.MIXED
  const src = gameEvidence(c, 'gameType=' + gameType, '局的结构')
  src.push(ev('valueExchange=' + valueExchange, EVIDENCE.DERIVED, '交换物'))
  if (gameType === 'EMPLOYER_PRICED' && c.ed === 'HIGH') src.push(ev('EMPLOYER_DEPENDENCE=HIGH', EVIDENCE.DERIVED, '依赖雇主的兑现'))
  if (gameType === 'PLATFORM_PRICED' && c.pd === 'HIGH') src.push(ev('PLATFORM_DEPENDENCE=HIGH', EVIDENCE.DERIVED, '依赖平台分配'))
  return { value: text, sourceEvidence: src, confidence: 'HIGH', provenance: prov('gameType', 'valueExchange') }
}

// Built-in evidence for a derived field: a DIRECT pricing answer is OBSERVED and
// carries the strongest support; otherwise the game type is a DERIVED derivation.
function gameEvidence (c, gameTypeTag, note) {
  const out = []
  if (c && c.hasDirect) out.push(ev('pricingAuthority=' + c.priceRaw, EVIDENCE.OBSERVED, '用户自答的定价方'))
  if (c && c.conflict) out.push(ev('signalConflict=YES', EVIDENCE.DERIVED, '直接答案与收入结构冲突'))
  else out.push(ev(gameTypeTag, EVIDENCE.DERIVED, note))
  return out
}

// ── §11 TRAP MECHANISM — why effort inside the game locks the position.
//    Evidence-safe wording: never claims customer ownership or customer
//    recognition. Only emitted when the supporting evidence exists. ──
function trapFor (gameType, valueExchange, ctx) {
  const c = ctx || {}
  const key = gameType + '|' + valueExchange
  const BY_KEY = {
    'EMPLOYER_PRICED|TECHNICAL_SKILL': ['技术越熟练', '在岗位内越值钱', '内部兑现越依赖雇主体系', '外部定价的证据仍然是空的'],
    'EMPLOYER_PRICED|SERVICE': ['手艺在岗位上越熟练', '在店家体系里越受用', '顾客关系和收款路径主要经过店家/雇主体系', '手艺还没脱离岗位被单独定价'],
    'EMPLOYER_PRICED|TIME': ['时间投入越多', '岗位越稳、越离不开', '收入越绑定在雇主身上', '离开这个岗位你自己能值多少，没有证据'],
    'EMPLOYER_PRICED|SALES_RESULT': ['成交能力越强', '在公司体系里越被依赖', '收入结算仍依赖公司体系', '离开后你还没有独立成交的证据'],
    'PLATFORM_PRICED|PHYSICAL_LABOR': ['跑得越多、在线越久', '收入越贴近平台能分配的量', '派单和计价规则都在平台手里', '停手就停收，也没沉淀出能带走的资产'],
    'PLATFORM_PRICED|CONTENT': ['内容越用力', '越依赖平台的流量分配', '变现方式由平台规则决定', '收入难重复，账号价值也带不走'],
    'PLATFORM_PRICED|TIME': ['投入的时间越多', '越依赖平台分配的机会', '计价与派单规则都在平台', '停手即断收，能力没有变成可带走的资产'],
    'COMMISSION_PRICED|SALES_RESULT': ['成交能力越强', '给公司带来的单越多', '收入结算仍依赖公司体系', '还没验证这项能力离开公司是否成立'],
    'CLIENT_PRICED|SERVICE': ['客户越多越忙', '越靠你一个人交付', '一停手收入就断', '没有把单次服务沉淀成可重复的产品'],
    'CLIENT_PRICED|TECHNICAL_SKILL': ['接的项目越多', '越靠你亲自交付', '收入被你的时间封顶', '没有沉淀成能重复出售的产品'],
    'SELF_PRICED|CONTENT': ['内容做得越多', '越靠平台流量变现', '收入随平台规则起伏', '很难变成一个可重复、能带走的客户资产'],
    'SELF_PRICED|SERVICE': ['接单越多、越熟练', '越靠你自己在场才能交付', '收入被你的时间封顶', '生意离开你也就不转了'],
    'MIXED|TIME': ['哪一头都在投入', '哪一头都没有形成稳定兑现', '精力被切碎、没有一口井打出水', '收入结构一直没有变清楚']
  }
  let steps = BY_KEY[key] || null
  const src = gameEvidence(c, 'gameType=' + gameType, '局的结构')
  src.push(ev('valueExchange=' + valueExchange, EVIDENCE.DERIVED, '交换物'))
  if (!steps) {
    if (gameType === 'EMPLOYER_PRICED') { steps = ['时间投入越多', '岗位越稳、越离不开', '收入越绑定在雇主身上', '离开这个岗位你自己能值多少，没有证据'] }
    else if (gameType === 'PLATFORM_PRICED') { steps = ['投入越多', '越依赖平台的分配', '规则由平台掌握', '停下来就没有沉淀'] }
    else if (gameType === 'CLIENT_PRICED') { steps = ['客户越多越忙', '越靠你一个人交付', '一停手收入就断', '没有沉淀出可重复的产品'] }
    else if (gameType === 'COMMISSION_PRICED') { steps = ['成交越强', '收入结算越依赖公司体系', '能力还没在外部单独定价', '离开后还无法自证'] }
    else if (gameType === 'UNKNOWN') { steps = ['投入在增加', '回报却没有稳定的来源', '还没看清谁在定价', '努力没有落到一个清晰的局上'] }
    else { steps = ['投入不断增加', '回报却依赖单一定价方', '定价权不在你手里', '努力加固的是别人的位置'] }
  }
  if (gameType === 'EMPLOYER_PRICED' && c.ed === 'HIGH') src.push(ev('EMPLOYER_DEPENDENCE=HIGH', EVIDENCE.DERIVED, '高度依赖雇主'))
  if (gameType === 'PLATFORM_PRICED' && c.pd === 'HIGH') src.push(ev('PLATFORM_DEPENDENCE=HIGH', EVIDENCE.DERIVED, '高度依赖平台'))
  if (c.proof === 'PAID_ONCE' || c.proof === 'OCCASIONAL') src.push(ev('marketProof=' + c.proof, EVIDENCE.OBSERVED, '已有一次外部付费信号'))
  return { value: steps, sourceEvidence: src, confidence: 'HIGH', form: 'LOCK_LOOP', provenance: prov('gameType', 'valueExchange') }
}

// ── §12 SWITCH DIRECTION — a POSITION/incentive change, never forced
//    entrepreneurship, never an occupation stereotype. ──
function switchFor (gameType, valueExchange, ctx) {
  const c = ctx || {}
  const BY_KEY = {
    'EMPLOYER_PRICED|TECHNICAL_SKILL': { axis: 'PRICING_AUTHORITY', value: '从「只能由雇主定价的技术执行者」，换成「能被外部客户直接定价的问题解决者」。' },
    'EMPLOYER_PRICED|SERVICE': { axis: 'CUSTOMER_PROXIMITY', value: '从「只通过店家被定价的手艺」，换成「顾客直接为你的手艺付费」。' },
    'EMPLOYER_PRICED|TIME': { axis: 'PRICING_AUTHORITY', value: '从「只由雇主定价的岗位」，换成「有一份能被外部直接买单的价值」。' },
    'EMPLOYER_PRICED|SALES_RESULT': { axis: 'CLIENT_OWNERSHIP', value: '从「公司结算的成交能力」，换成「自己掌握客户与定价的获客能力」。' },
    'PLATFORM_PRICED|PHYSICAL_LABOR': { axis: 'PORTABLE_VALUE', value: '从「平台派单的时间换钱」，换成「一项离开平台也能被客户直接付费的能力」。' },
    'PLATFORM_PRICED|CONTENT': { axis: 'PORTABLE_VALUE', value: '从「平台分发的流量变现」，换成「直接向客户交付、能带走的内容产品」。' },
    'PLATFORM_PRICED|TIME': { axis: 'PORTABLE_VALUE', value: '从「平台分配的时间换钱」，换成「一项离开平台也能被直接付费的能力」。' },
    'COMMISSION_PRICED|SALES_RESULT': { axis: 'CLIENT_OWNERSHIP', value: '从「公司结算的成交能力」，换成「自己掌握客户与定价的获客能力」。' },
    'CLIENT_PRICED|SERVICE': { axis: 'REPEATABILITY', value: '从「一单一结的服务」，换成「可重复出售的交付或产品」。' },
    'CLIENT_PRICED|TECHNICAL_SKILL': { axis: 'REPEATABILITY', value: '从「一个项目一结的交付」，换成「能被重复购买的产品或服务」。' },
    'SELF_PRICED|CONTENT': { axis: 'REPEATABILITY', value: '从「平台分发的流量变现」，换成「直接向客户交付、可重复出售的内容产品」。' },
    'SELF_PRICED|SERVICE': { axis: 'REPEATABILITY', value: '从「靠自己在场才成立的手艺」，换成「能被重复购买、不靠你到场也能交付的产品」。' },
    'MIXED|TIME': { axis: 'PRICING_AUTHORITY', value: '从「哪一头都靠别人定价」，换成「先有一个自己能被直接买单的价值」。' }
  }
  const hit = BY_KEY[gameType + '|' + valueExchange]
  if (hit) return { axis: hit.axis, value: hit.value, sourceEvidence: gameEvidence(c, 'gameType=' + gameType, '局的方向').concat([ev('valueExchange=' + valueExchange, EVIDENCE.DERIVED, '交换物')]), confidence: 'HIGH', provenance: prov('gameType', 'valueExchange') }
  const byGame = {
    EMPLOYER_PRICED: { axis: 'PRICING_AUTHORITY', value: '从「只能由雇主定价的岗位」，换成「能被外部直接买单的价值」。' },
    PLATFORM_PRICED: { axis: 'PORTABLE_VALUE', value: '从「靠平台分配的收入」，换成「离开平台也能被直接付费的价值」。' },
    CLIENT_PRICED: { axis: 'REPEATABILITY', value: '从「一单一结的服务」，换成「可重复出售的产品」。' },
    COMMISSION_PRICED: { axis: 'CLIENT_OWNERSHIP', value: '从「公司结算的成交」，换成「自己掌握客户与定价」。' },
    SELF_PRICED: { axis: 'REPEATABILITY', value: '从「靠自己撑着的生意」，换成「能重复、能带走的客户资产」。' },
    MIXED: { axis: 'PRICING_AUTHORITY', value: '从「谁都不给你定价」，换成「先有一份能被直接买单的价值」。' },
    UNKNOWN: { axis: 'PRICING_AUTHORITY', value: '先从「说不清谁在定价」，换成「能明确说出一份被谁直接买单的价值」。' }
  }
  const g = byGame[gameType] || byGame.MIXED
  return { axis: g.axis, value: g.value, sourceEvidence: gameEvidence(c, 'gameType=' + gameType, '局的方向'), confidence: 'MEDIUM', provenance: prov('gameType') }
}

// ── §13 SMALL BET — a bounded real-world experiment testing the thesis. ──
function smallBetFor (gameType, valueExchange, ctx) {
  const c = ctx || {}
  const BY_KEY = {
    'EMPLOYER_PRICED|TECHNICAL_SKILL': 'FIRST_EXTERNAL_QUOTE',
    'EMPLOYER_PRICED|SERVICE': 'FIRST_DIRECT_PAID_SAMPLE',
    'EMPLOYER_PRICED|TIME': 'FIRST_EXTERNAL_QUOTE',
    'EMPLOYER_PRICED|SALES_RESULT': 'FIRST_SELF_OWNED_CUSTOMER',
    'PLATFORM_PRICED|PHYSICAL_LABOR': 'FIRST_PORTABLE_SKILL_VALIDATION',
    'PLATFORM_PRICED|CONTENT': 'FIRST_PACKAGED_PAID_DELIVERABLE',
    'PLATFORM_PRICED|TIME': 'FIRST_PORTABLE_SKILL_VALIDATION',
    'COMMISSION_PRICED|SALES_RESULT': 'FIRST_SELF_OWNED_CUSTOMER',
    'CLIENT_PRICED|SERVICE': 'FIRST_REPEAT_PURCHASE',
    'CLIENT_PRICED|TECHNICAL_SKILL': 'FIRST_PACKAGED_PAID_DELIVERABLE',
    'SELF_PRICED|CONTENT': 'FIRST_PACKAGED_PAID_DELIVERABLE',
    'SELF_PRICED|SERVICE': 'FIRST_REPEAT_PURCHASE',
    'MIXED|TIME': 'FIRST_DIRECT_CUSTOMER_CONVERSATION'
  }
  const BY_GAME = {
    EMPLOYER_PRICED: 'FIRST_EXTERNAL_QUOTE',
    PLATFORM_PRICED: 'FIRST_PORTABLE_SKILL_VALIDATION',
    CLIENT_PRICED: 'FIRST_DIRECT_CUSTOMER_CONVERSATION',
    COMMISSION_PRICED: 'FIRST_SELF_OWNED_CUSTOMER',
    SELF_PRICED: 'FIRST_PACKAGED_PAID_DELIVERABLE',
    MIXED: 'FIRST_DIRECT_CUSTOMER_CONVERSATION',
    UNKNOWN: 'FIRST_DIRECT_CUSTOMER_CONVERSATION'
  }
  const betType = BY_KEY[gameType + '|' + valueExchange] || BY_GAME[gameType] || 'FIRST_DIRECT_CUSTOMER_CONVERSATION'
  const src = gameEvidence(c, 'gameType=' + gameType, '下注要验证的局')
  src.push(ev('valueExchange=' + valueExchange, EVIDENCE.DERIVED, '交换物'))
  if (c.stage) src.push(ev('pastAttemptStage=' + c.stage, EVIDENCE.OBSERVED, '过去的尝试阶段'))
  if (c.goal) src.push(ev('primaryGoal=' + c.goal, EVIDENCE.OBSERVED, '目标'))
  return { value: betType, sourceEvidence: src, confidence: 'HIGH', provenance: prov('gameType', 'valueExchange') }
}

/** Compact structural signature (distinctness checks — no copy involved). */
function gameSignature (gm) {
  if (!gm) return ''
  return [gm.gameType.value, gm.valueExchange.value, gm.pricingAuthority.value, gm.switchDirection.axis, gm.smallBetType.value].join('|')
}
function trapSignature (gm) {
  if (!gm || !gm.trapMechanism || !Array.isArray(gm.trapMechanism.value)) return ''
  return gm.trapMechanism.value.join('→')
}

/**
 * §27 FINAL AUTHORITY GATE — assert no deterministic claim is stronger than its
 * strongest supporting evidence. Returns the fields that would violate the gate
 * (expected empty), so a caller/test can prove the invariant holds.
 */
function authorityGateViolations (gm) {
  const bad = []
  if (!gm) return bad
  for (const k of Object.keys(gm)) {
    const f = gm[k]
    if (!f || typeof f !== 'object' || f.value == null || !('confidence' in f)) continue
    const allowed = allowedConfidence(f.sourceEvidence)
    if (CONF_ORDER.indexOf(f.confidence) > CONF_ORDER.indexOf(allowed)) bad.push(k + ':' + f.confidence + '>' + allowed)
  }
  return bad
}

/** Human+model readable lines for the prompt (structured causal input). */
function renderGameLines (gm) {
  if (!gm) return []
  const f = (x) => (x && x.value != null) ? x.value : 'UNKNOWN'
  const cls = (x) => {
    const arr = (x && x.sourceEvidence) || []
    const s = arr.map((e) => e.class).filter((v, i, a) => a.indexOf(v) === i).join('/')
    return (s || 'UNKNOWN') + '，置信度：' + ((x && x.confidence) || 'UNKNOWN')
  }
  const L = []
  L.push('- 局（gameType）：' + f(gm.gameType) + '（证据：' + cls(gm.gameType) + '）')
  L.push('- 交换物（valueExchange）：' + f(gm.valueExchange) + '（证据：' + cls(gm.valueExchange) + '）')
  L.push('- 谁掌握定价权（pricingAuthority）：' + f(gm.pricingAuthority) + '（证据：' + cls(gm.pricingAuthority) + '）')
  L.push('- 谁定规则（ruleOwner）：' + f(gm.ruleOwner) + '（证据：' + cls(gm.ruleOwner) + '）')
  L.push('- 客户距离（customerDistance）：' + f(gm.customerDistance) + '（证据：' + cls(gm.customerDistance) + '）')
  L.push('- 依赖结构（dependencyStructure）：' + f(gm.dependencyStructure) + '（证据：' + cls(gm.dependencyStructure) + '）')
  L.push('- 市场验证（marketProofState）：' + f(gm.marketProofState) + '（证据：' + cls(gm.marketProofState) + '）')
  L.push('- 可重复性（repeatabilityState）：' + f(gm.repeatabilityState) + '（证据：' + cls(gm.repeatabilityState) + '）')
  L.push('- 杠杆（leverageState）：' + f(gm.leverageState) + '（证据：' + cls(gm.leverageState) + '）')
  L.push('- 游戏规则（RULE）：' + f(gm.gameRule) + '（证据：' + cls(gm.gameRule) + '）')
  if (gm.trapMechanism && Array.isArray(gm.trapMechanism.value)) L.push('- 陷阱回路（TRAP）：' + gm.trapMechanism.value.join(' → ') + '（证据：' + cls(gm.trapMechanism) + '）')
  L.push('- 换位方向（SWITCH）：' + f(gm.switchDirection) + '（证据：' + cls(gm.switchDirection) + '）')
  L.push('- 最小现实下注（BET）：' + f(gm.smallBetType) + '（证据：' + cls(gm.smallBetType) + '）')
  return L
}

/** Every production occupation category closed over by the game model. */
function gameModelInputsCovered () {
  return {
    gameTypes: GAME_TYPES.slice(),
    valueExchange: VALUE_EXCHANGE.slice(),
    pricingAuthority: PRICING_AUTHORITY.slice(),
    ruleOwner: RULE_OWNER.slice()
  }
}

module.exports = {
  GAME_VERSION,
  EVIDENCE,
  GAME_TYPES,
  VALUE_EXCHANGE,
  PRICING_AUTHORITY,
  RULE_OWNER,
  CUSTOMER_DISTANCE,
  DEPENDENCY_STRUCTURE,
  MARKET_PROOF_STATE,
  REPEATABILITY_STATE,
  LEVERAGE_STATE,
  PRICE_TO_PRICING_AUTHORITY,
  PRICE_TO_GAME_TYPE,
  INCOMPATIBLE_INCOME,
  RULE_OWNER_BY_PRICE,
  RULE_OWNER_BY_INCOME_MODEL,
  allowedConfidence,
  capConfidence,
  authorityGateViolations,
  resolveGameType,
  computeGameModelV6,
  gameSignature,
  trapSignature,
  renderGameLines,
  gameModelInputsCovered
}
