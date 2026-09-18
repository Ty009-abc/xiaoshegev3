'use strict'
/**
 * turnaroundStrategy/v6/hybrid/gameModelV6.js
 *
 * RC8.4 V6 R85-C — DETERMINISTIC GAME MODEL (珠澳小事哥 IP restore).
 *
 * The R85-B RealEconomyModel answers "靠什么换钱 / 谁在定价 / 什么能迁移".
 * THIS layer answers the ORIGINAL IP question ABOVE it:
 *
 *   你现在玩的是什么局？谁定规则？谁掌握定价权？为什么越努力越容易被锁住？
 *   要换的是努力还是位置？下一步最小现实下注是什么？
 *
 * It is a SMALL, EXPLAINABLE, DETERMINISTIC derivation on top of the economy
 * model. It adds NO new taxonomy of people, NO salary/market data, NO career
 * destiny. Every field carries { value, sourceEvidence[], confidence } and is
 * classified OBSERVED / DERIVED / INFERRED — never a fake number, never a
 * single-signal stereotype.
 *
 * AUTHORITY (frozen):
 *   - ZERO bottleneck authority. NEVER read by any B1 file.
 *   - EVIDENCE_LAYER only. It is grounded causal INPUT for the thesis prompt;
 *     it is NOT copy authority and NOT a final diagnosis.
 *   - NO external market data. Occupation alone never emits salary amount /
 *     job security / outlook / AI-displacement.
 *   - RUNTIME ONLY (not persisted as a permanent profile fact).
 *
 * CONSUMER LAYER ONLY. Deterministic. No AI. No I/O. No network.
 */

const GAME_VERSION = 'r85c_game_model_v1'

const EVIDENCE = Object.freeze({
  OBSERVED: 'OBSERVED',
  DERIVED: 'DERIVED',
  INFERRED: 'INFERRED',
  UNKNOWN: 'UNKNOWN'
})

// §4 — deliberately SMALL structural game types (no dozens of archetypes).
const GAME_TYPES = Object.freeze([
  'EMPLOYER_PRICED', 'PLATFORM_PRICED', 'CLIENT_PRICED',
  'COMMISSION_PRICED', 'SELF_PRICED', 'MIXED'
])
// §5 — what the user is actually exchanging.
const VALUE_EXCHANGE = Object.freeze([
  'TIME', 'PHYSICAL_LABOR', 'TECHNICAL_SKILL', 'SALES_RESULT',
  'CONTENT', 'SERVICE', 'CAPITAL', 'SYSTEM'
])
// §6 — who currently holds most pricing authority (central to the IP).
const PRICING_AUTHORITY = Object.freeze([
  'EMPLOYER', 'PLATFORM', 'CLIENT', 'USER', 'MARKET', 'MIXED', 'UNKNOWN'
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

// ── gameType from the normalized income model (§3 inputs: incomeStructure) ──
const GAME_TYPE_BY_INCOME_MODEL = Object.freeze({
  SALARIED_LABOR: 'EMPLOYER_PRICED',
  SERVICE_FEE: 'CLIENT_PRICED',
  COMMISSION: 'COMMISSION_PRICED',
  OWNED_BUSINESS: 'SELF_PRICED',
  CONTENT_MONETIZATION: 'SELF_PRICED',
  ASSET_INCOME: 'SELF_PRICED',
  IRREGULAR: 'MIXED' // resolved with platform dependence below
})

// ── pricingAuthority by gameType (§6) ──
const PRICING_BY_GAME_TYPE = Object.freeze({
  EMPLOYER_PRICED: 'EMPLOYER',
  PLATFORM_PRICED: 'PLATFORM',
  CLIENT_PRICED: 'CLIENT',
  COMMISSION_PRICED: 'MIXED',
  SELF_PRICED: 'USER',
  MIXED: 'MIXED'
})

// ── valueExchange from asset type, with a category override for labor ──
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

const LEVEL = { LOW: 0, MEDIUM: 1, HIGH: 2 }

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
function worse (a, b) { return LEVEL[a] >= LEVEL[b] ? a : b }

/**
 * Compute the deterministic game model.
 * @param {Object} economy RealEconomyModel (computeRealEconomyModelV6 output)
 * @param {Object} [profile] HybridProfile (for raw skill / stage / goal evidence)
 * @returns {Object} game model (version + fields, each {value, sourceEvidence, confidence})
 */
function computeGameModelV6 (economy, profile) {
  const m = economy || null
  const p = profile || {}
  const asset = p.asset || {}
  const stage = p.stage || {}
  const desired = p.desiredChange || {}

  const incomeModel = (m && m.incomeModel) || null
  const category = (m && m.occupationCategory) || null
  const incomeStructure = (m && m.incomeStructure) || null
  const proof = asset.marketProof || (m && m.marketProof) || null

  // ── gameType ──
  const gameTypeEv = []
  let gameType = 'MIXED'
  if (incomeModel && GAME_TYPE_BY_INCOME_MODEL[incomeModel]) {
    gameType = GAME_TYPE_BY_INCOME_MODEL[incomeModel]
    gameTypeEv.push(ev('incomeModel=' + incomeModel, EVIDENCE.DERIVED, '收入结构推导出的局'))
  }
  if (incomeModel === 'IRREGULAR') {
    const pd = value('PLATFORM_DEPENDENCE', m)
    if (pd === 'HIGH') { gameType = 'PLATFORM_PRICED'; gameTypeEv.push(ev('PLATFORM_DEPENDENCE=HIGH', EVIDENCE.DERIVED, '平台依赖主导')) }
    else { gameTypeEv.push(ev('PLATFORM_DEPENDENCE=' + pd, EVIDENCE.INFERRED, '不稳定收入，局不清晰')) }
  }
  if (incomeModel === 'CONTENT_MONETIZATION' && value('PLATFORM_DEPENDENCE', m) === 'HIGH') {
    gameType = 'PLATFORM_PRICED'
    gameTypeEv.push(ev('PLATFORM_DEPENDENCE=HIGH', EVIDENCE.INFERRED, '内容主要靠平台分发'))
  }
  if (!gameTypeEv.length) gameTypeEv.push(ev('incomeStructure=' + (incomeStructure || 'UNKNOWN'), EVIDENCE.UNKNOWN, '证据不足'))

  // ── valueExchange ──
  const veEv = []
  let valueExchange = 'TIME'
  const catVal = category && VALUE_BY_CATEGORY[category] ? VALUE_BY_CATEGORY[category] : null
  const assetVal = asset.type && VALUE_BY_ASSET[asset.type] ? VALUE_BY_ASSET[asset.type] : null
  const vx = catVal || assetVal || 'TIME'
  valueExchange = vx
  if (catVal) veEv.push(ev('occupationCategory=' + category, EVIDENCE.INFERRED, '职业类别对应的交换物'))
  if (assetVal) veEv.push(ev('monetizableSkill=' + asset.type, EVIDENCE.OBSERVED, '用户自选的可变现能力'))
  if (!veEv.length) veEv.push(ev('incomeStructure=' + (incomeStructure || 'UNKNOWN'), EVIDENCE.UNKNOWN, '证据不足'))

  // ── pricingAuthority (§6) ──
  let pricingAuthority = PRICING_BY_GAME_TYPE[gameType] || 'UNKNOWN'
  const paEv = []
  paEv.push(ev('gameType=' + gameType, EVIDENCE.DERIVED, '局决定谁定价'))
  // A commission person is priced by the client for the sale and settled by the
  // employer — pricing authority is genuinely split.
  if (gameType === 'COMMISSION_PRICED') paEv.push(ev('incomeModel=COMMISSION', EVIDENCE.OBSERVED, '成交定价 + 企业结算权同时存在'))
  if (gameType === 'SELF_PRICED' && value('CLIENT_PROXIMITY', m) === 'LOW') {
    paEv.push(ev('CLIENT_PROXIMITY=LOW', EVIDENCE.INFERRED, '直接买家距离较远'))
  }

  // ── customerDistance ──
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

  // ── gameRule / trapMechanism / switchDirection / smallBetType ──
  const rule = gameRuleFor(gameType, valueExchange, { ed: ed, pd: pd, cp: cp })
  const trap = trapFor(gameType, valueExchange, { ed: ed, pd: pd, proof: marketProofState })
  const sw = switchFor(gameType, valueExchange)
  const bet = smallBetFor(gameType, valueExchange, { goal: desired.primaryGoal, stage: stage.pastAttemptStage })

  const dimsFor = (list) => { const o = []; for (const d of list) for (const e of dimEvidence(d, m)) o.push(e); return o }
  const confOf = (list) => {
    const cs = list.map((d) => dimConf(d, m))
    if (cs.some((c) => c === 'HIGH')) return 'HIGH'
    if (cs.some((c) => c === 'MEDIUM')) return 'MEDIUM'
    return 'UNKNOWN'
  }

  const out = {
    version: GAME_VERSION,
    gameType: { value: gameType, sourceEvidence: gameTypeEv, confidence: gameTypeEv.some((e) => e.class === EVIDENCE.DERIVED || e.class === EVIDENCE.OBSERVED) ? 'HIGH' : 'MEDIUM' },
    valueExchange: { value: valueExchange, sourceEvidence: veEv, confidence: veEv.some((e) => e.class === EVIDENCE.OBSERVED || e.class === EVIDENCE.DERIVED) ? 'HIGH' : 'MEDIUM' },
    pricingAuthority: { value: pricingAuthority, sourceEvidence: paEv, confidence: 'HIGH' },
    customerDistance: { value: customerDistance, sourceEvidence: dimEvidence('CLIENT_PROXIMITY', m), confidence: dimConf('CLIENT_PROXIMITY', m) },
    dependencyStructure: { value: dependencyStructure, sourceEvidence: dimsFor(['PLATFORM_DEPENDENCE', 'EMPLOYER_DEPENDENCE']), confidence: confOf(['PLATFORM_DEPENDENCE', 'EMPLOYER_DEPENDENCE']) },
    marketProofState: { value: marketProofState, sourceEvidence: [ev('skillValidation=' + (proof || 'UNKNOWN'), EVIDENCE.OBSERVED, '市场验证等级')], confidence: proof ? 'HIGH' : 'UNKNOWN' },
    repeatabilityState: { value: repeatabilityState, sourceEvidence: dimEvidence('REPEATABILITY', m), confidence: dimConf('REPEATABILITY', m) },
    leverageState: { value: leverageState, sourceEvidence: dimsFor(['PORTABILITY', 'TIME_FOR_MONEY']), confidence: confOf(['PORTABILITY', 'TIME_FOR_MONEY']) },
    gameRule: rule,
    trapMechanism: trap,
    switchDirection: sw,
    smallBetType: bet
  }
  return out
}

// ── §7 GAME RULE — deterministic structural rule (never overclaims) ──
function gameRuleFor (gameType, valueExchange, ctx) {
  const c = ctx || {}
  const byGame = {
    EMPLOYER_PRICED: valueExchange === 'TECHNICAL_SKILL'
      ? '雇主购买你的岗位价值，并替你面对最终市场。'
      : valueExchange === 'SERVICE'
        ? '这一行按岗位/店家定价，你的手艺先通过雇主变现，由店家面对顾客。'
        : '雇主购买你的时间与岗位价值，最终市场由公司替你面对。',
    PLATFORM_PRICED: '平台掌握流量与订单分配，你靠在线时长/接单量换收入。',
    CLIENT_PRICED: '你直接面对买家，价格由你和客户当场谈成。',
    COMMISSION_PRICED: '你靠成交产生收入，但客户归属和结算权未必属于你。',
    SELF_PRICED: valueExchange === 'CONTENT'
      ? '你拥有内容和账号，但分发和变现规则由平台决定。'
      : '你拥有这门生意，价格和客户由你自己设定。',
    MIXED: '收入来源分散、规则不清晰，没有一个稳定的定价方。'
  }
  const text = byGame[gameType] || byGame.MIXED
  const src = [ev('gameType=' + gameType, EVIDENCE.DERIVED, '结构规则'), ev('valueExchange=' + valueExchange, EVIDENCE.DERIVED, '交换物')]
  if (gameType === 'EMPLOYER_PRICED' && c.ed === 'HIGH') src.push(ev('EMPLOYER_DEPENDENCE=HIGH', EVIDENCE.DERIVED, '依赖雇主的兑现'))
  if (gameType === 'PLATFORM_PRICED' && c.pd === 'HIGH') src.push(ev('PLATFORM_DEPENDENCE=HIGH', EVIDENCE.DERIVED, '依赖平台分配'))
  return { value: text, sourceEvidence: src, confidence: 'HIGH' }
}

// ── §8 TRAP MECHANISM — why effort inside the game locks the position ──
// Only emitted when the supporting evidence exists; falls back to a neutral
// structural loop otherwise (never an invented causal story).
function trapFor (gameType, valueExchange, ctx) {
  const c = ctx || {}
  const key = gameType + '|' + valueExchange
  const BY_KEY = {
    'EMPLOYER_PRICED|TECHNICAL_SKILL': ['技术越熟练', '在岗位内越值钱', '越依赖公司内部兑现', '外部定价的证据仍然是空的'],
    'EMPLOYER_PRICED|SERVICE': ['手艺在岗位上越熟练', '在店家体系里越受用', '顾客认的是店、不是你的个人品牌', '你的手艺始终没有脱离岗位被单独定价'],
    'EMPLOYER_PRICED|TIME': ['时间投入越多', '岗位越稳、越离不开', '收入越绑定在雇主身上', '离开这个岗位你自己能值多少，没有证据'],
    'PLATFORM_PRICED|PHYSICAL_LABOR': ['跑得越多、在线越久', '收入越接近平台给的上限', '派单和规则都握在平台手里', '停手就停收，也没沉淀出能带走的资产'],
    'PLATFORM_PRICED|CONTENT': ['内容越用力', '越依赖平台的流量分配', '变现方式由平台规则决定', '收入难重复，账号价值也带不走'],
    'COMMISSION_PRICED|SALES_RESULT': ['成交能力越强', '给公司带来的单越多', '客户归属和结算权仍在公司手里', '你没法证明这项能力离开公司还成立'],
    'SELF_PRICED|CONTENT': ['内容做得越多', '越靠平台流量变现', '收入随平台规则起伏', '很难变成一个可重复、能带走的客户资产'],
    'SELF_PRICED|SERVICE': ['接单越多、越熟练', '越靠你自己在场才能交付', '收入被你的时间封顶', '生意离开你也就不转了'],
    'CLIENT_PRICED|SERVICE': ['客户越多越忙', '越靠你一个人交付', '一停手收入就断', '没有把单次服务沉淀成可重复的产品'],
    'MIXED|TIME': ['哪一头都在投入', '哪一头都没有形成稳定兑现', '精力被切碎、没有一口井打出水', '收入结构一直没有变清楚']
  }
  let steps = BY_KEY[key] || null
  const src = [ev('gameType=' + gameType, EVIDENCE.DERIVED, '局的结构'), ev('valueExchange=' + valueExchange, EVIDENCE.DERIVED, '交换物')]
  if (!steps) {
    if (gameType === 'EMPLOYER_PRICED') { steps = ['时间投入越多', '岗位越稳、越离不开', '收入越绑定在雇主身上', '离开这个岗位你自己能值多少，没有证据'] }
    else if (gameType === 'PLATFORM_PRICED') { steps = ['投入越多', '越依赖平台的分配', '规则由平台掌握', '停下来就没有沉淀'] }
    else if (gameType === 'CLIENT_PRICED') { steps = ['客户越多越忙', '越靠你一个人交付', '一停手收入就断', '没有沉淀出可重复的产品'] }
    else if (gameType === 'COMMISSION_PRICED') { steps = ['成交越强', '越依赖公司的客户与结算', '能力与客户都不属于你', '离开平台无法自证'] }
    else { steps = ['投入不断增加', '回报却依赖单一定价方', '定价权不在你手里', '努力加固的是别人的位置'] }
  }
  if (gameType === 'EMPLOYER_PRICED' && c.ed === 'HIGH') src.push(ev('EMPLOYER_DEPENDENCE=HIGH', EVIDENCE.DERIVED, '高度依赖雇主'))
  if (gameType === 'PLATFORM_PRICED' && c.pd === 'HIGH') src.push(ev('PLATFORM_DEPENDENCE=HIGH', EVIDENCE.DERIVED, '高度依赖平台'))
  if (c.proof === 'PAID_ONCE' || c.proof === 'OCCASIONAL') src.push(ev('marketProof=' + c.proof, EVIDENCE.OBSERVED, '已有一次外部付费信号'))
  return { value: steps, sourceEvidence: src, confidence: 'HIGH', form: 'LOCK_LOOP' }
}

// ── §9 SWITCH DIRECTION — a POSITION/incentive change, never forced entrepreneurship ──
function switchFor (gameType, valueExchange) {
  const BY_KEY = {
    'EMPLOYER_PRICED|TECHNICAL_SKILL': { axis: 'PRICING_AUTHORITY', value: '从「只能由雇主定价的技术执行者」，换成「能被外部客户直接定价的问题解决者」。' },
    'EMPLOYER_PRICED|SERVICE': { axis: 'CUSTOMER_PROXIMITY', value: '从「只通过店家被定价的手艺」，换成「顾客直接为你的手艺付费」。' },
    'EMPLOYER_PRICED|TIME': { axis: 'PRICING_AUTHORITY', value: '从「只由雇主定价的岗位」，换成「有一份能被外部直接买单的价值」。' },
    'PLATFORM_PRICED|PHYSICAL_LABOR': { axis: 'PORTABLE_VALUE', value: '从「平台派单的时间换钱」，换成「一项离开平台也能被客户直接付费的能力」。' },
    'PLATFORM_PRICED|CONTENT': { axis: 'PORTABLE_VALUE', value: '从「平台分发的流量变现」，换成「直接向客户交付、能带走的内容产品」。' },
    'COMMISSION_PRICED|SALES_RESULT': { axis: 'CLIENT_OWNERSHIP', value: '从「公司结算的成交能力」，换成「自己掌握客户与定价的获客能力」。' },
    'SELF_PRICED|CONTENT': { axis: 'REPEATABILITY', value: '从「平台分发的流量变现」，换成「直接向客户交付、可重复出售的内容产品」。' },
    'SELF_PRICED|SERVICE': { axis: 'REPEATABILITY', value: '从「靠自己在场才成立的手艺」，换成「能被重复购买、不靠你到场也能交付的产品」。' },
    'CLIENT_PRICED|SERVICE': { axis: 'REPEATABILITY', value: '从「一单一结的服务」，换成「可重复出售的交付或产品」。' },
    'MIXED|TIME': { axis: 'PRICING_AUTHORITY', value: '从「哪一头都靠别人定价」，换成「先有一个自己能被直接买单的价值」。' }
  }
  const hit = BY_KEY[gameType + '|' + valueExchange]
  if (hit) return { axis: hit.axis, value: hit.value, sourceEvidence: [ev('gameType=' + gameType, EVIDENCE.DERIVED, '局的方向'), ev('valueExchange=' + valueExchange, EVIDENCE.DERIVED, '交换物')], confidence: 'HIGH' }
  const byGame = {
    EMPLOYER_PRICED: { axis: 'PRICING_AUTHORITY', value: '从「只能由雇主定价的岗位」，换成「能被外部直接买单的价值」。' },
    PLATFORM_PRICED: { axis: 'PORTABLE_VALUE', value: '从「靠平台分配的收入」，换成「离开平台也能被直接付费的价值」。' },
    CLIENT_PRICED: { axis: 'REPEATABILITY', value: '从「一单一结的服务」，换成「可重复出售的产品」。' },
    COMMISSION_PRICED: { axis: 'CLIENT_OWNERSHIP', value: '从「公司结算的成交」，换成「自己掌握客户与定价」。' },
    SELF_PRICED: { axis: 'REPEATABILITY', value: '从「靠自己撑着的生意」，换成「能重复、能带走的客户资产」。' },
    MIXED: { axis: 'PRICING_AUTHORITY', value: '从「谁都不给你定价」，换成「先有一份能被直接买单的价值」。' }
  }
  const g = byGame[gameType] || byGame.MIXED
  return { axis: g.axis, value: g.value, sourceEvidence: [ev('gameType=' + gameType, EVIDENCE.DERIVED, '局的方向')], confidence: 'MEDIUM' }
}

// ── §10 SMALL BET — a bounded real-world experiment testing the thesis ──
// small cost · clear result · reversible downside · market feedback.
function smallBetFor (gameType, valueExchange, ctx) {
  const c = ctx || {}
  const BY_KEY = {
    'EMPLOYER_PRICED|TECHNICAL_SKILL': 'FIRST_EXTERNAL_QUOTE',
    'EMPLOYER_PRICED|SERVICE': 'FIRST_DIRECT_PAID_SAMPLE',
    'EMPLOYER_PRICED|TIME': 'FIRST_EXTERNAL_QUOTE',
    'PLATFORM_PRICED|PHYSICAL_LABOR': 'FIRST_PORTABLE_SKILL_VALIDATION',
    'PLATFORM_PRICED|CONTENT': 'FIRST_PACKAGED_PAID_DELIVERABLE',
    'COMMISSION_PRICED|SALES_RESULT': 'FIRST_SELF_OWNED_CUSTOMER',
    'SELF_PRICED|CONTENT': 'FIRST_PACKAGED_PAID_DELIVERABLE',
    'SELF_PRICED|SERVICE': 'FIRST_REPEAT_PURCHASE',
    'CLIENT_PRICED|SERVICE': 'FIRST_REPEAT_PURCHASE',
    'MIXED|TIME': 'FIRST_DIRECT_CUSTOMER_CONVERSATION'
  }
  const BY_GAME = {
    EMPLOYER_PRICED: 'FIRST_EXTERNAL_QUOTE',
    PLATFORM_PRICED: 'FIRST_PORTABLE_SKILL_VALIDATION',
    CLIENT_PRICED: 'FIRST_DIRECT_CUSTOMER_CONVERSATION',
    COMMISSION_PRICED: 'FIRST_SELF_OWNED_CUSTOMER',
    SELF_PRICED: 'FIRST_PACKAGED_PAID_DELIVERABLE',
    MIXED: 'FIRST_DIRECT_CUSTOMER_CONVERSATION'
  }
  const betType = BY_KEY[gameType + '|' + valueExchange] || BY_GAME[gameType] || 'FIRST_DIRECT_CUSTOMER_CONVERSATION'
  const src = [ev('gameType=' + gameType, EVIDENCE.DERIVED, '下注要验证的局'), ev('valueExchange=' + valueExchange, EVIDENCE.DERIVED, '交换物')]
  if (c.stage) src.push(ev('pastAttemptStage=' + c.stage, EVIDENCE.OBSERVED, '过去的尝试阶段'))
  if (c.goal) src.push(ev('primaryGoal=' + c.goal, EVIDENCE.OBSERVED, '目标'))
  return { value: betType, sourceEvidence: src, confidence: 'HIGH' }
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
  L.push('- 客户距离（customerDistance）：' + f(gm.customerDistance))
  L.push('- 依赖结构（dependencyStructure）：' + f(gm.dependencyStructure))
  L.push('- 市场验证（marketProofState）：' + f(gm.marketProofState))
  L.push('- 可重复性（repeatabilityState）：' + f(gm.repeatabilityState))
  L.push('- 杠杆（leverageState）：' + f(gm.leverageState))
  L.push('- 游戏规则（RULE）：' + f(gm.gameRule))
  if (gm.trapMechanism && Array.isArray(gm.trapMechanism.value)) L.push('- 陷阱回路（TRAP）：' + gm.trapMechanism.value.join(' → '))
  L.push('- 换位方向（SWITCH）：' + f(gm.switchDirection))
  L.push('- 最小现实下注（BET）：' + f(gm.smallBetType))
  return L
}

/** Every production occupation category closed over by the game model. */
function gameModelInputsCovered () {
  return { gameTypes: GAME_TYPES.slice(), valueExchange: VALUE_EXCHANGE.slice(), pricingAuthority: PRICING_AUTHORITY.slice() }
}

module.exports = {
  GAME_VERSION,
  EVIDENCE,
  GAME_TYPES,
  VALUE_EXCHANGE,
  PRICING_AUTHORITY,
  CUSTOMER_DISTANCE,
  DEPENDENCY_STRUCTURE,
  MARKET_PROOF_STATE,
  REPEATABILITY_STATE,
  LEVERAGE_STATE,
  computeGameModelV6,
  gameSignature,
  trapSignature,
  renderGameLines,
  gameModelInputsCovered
}
