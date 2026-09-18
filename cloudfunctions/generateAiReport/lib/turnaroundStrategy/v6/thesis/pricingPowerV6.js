'use strict'
/**
 * turnaroundStrategy/v6/thesis/pricingPowerV6.js
 *
 * RC8.4 V6 R85C3 — PRICING POWER MODEL + SWITCH TYPE (珠澳小事哥 IP restore).
 *
 * THE DEFECT THIS FIXES (owner real-device defect):
 * The report collapsed  PRICING AUTHORITY  into  SELF-PRICING / DIRECT-CUSTOMER
 * PAYMENT. It treated "who sets your price today" as if the only rational answer
 * were "you should set it yourself / sell to strangers". That is a universal
 * ideology, NOT a diagnosis.
 *
 * CORRECT DISTINCTION (frozen):
 *   pricingAuthority = WHO currently determines pricing / payment.
 *   pricingPower     = HOW MANY credible alternative ways the user's value can be
 *                      RE-PRICED and realized.
 * A user may rationally:  STAY_AND_UPGRADE | ADD_PRICING_SOURCE | SWITCH_GAME.
 * SELF-PRICED is NOT inherently superior to EMPLOYER-PRICED.
 *
 * CORE PRINCIPLE (frozen): 让用户拥有更多被重新定价的选择。  NOT 让所有人自己定价。
 *
 * AUTHORITY (same boundary as the GameModel):
 *   - ZERO B1 authority. NEVER read by any B1 file.
 *   - EVIDENCE_LAYER only. Deterministic. No AI. No I/O. No network.
 *   - NO new questionnaire field / economic dimension / GameModel taxonomy.
 *   - RUNTIME ONLY (not persisted as a permanent profile fact).
 */

const PRICING_POWER_VERSION = 'r85c3_pricing_power_v1'

// §3 — SWITCH_TYPE: the three rational moves (plus UNKNOWN). NONE of them is
// privileged; SELF-PRICED is not the required destination.
const SWITCH_TYPES = Object.freeze([
  'STAY_AND_UPGRADE',   // raise the position / pricing inside the CURRENT game
  'ADD_PRICING_SOURCE', // keep the current game AND add a second, independent payer
  'SWITCH_GAME',        // the current game's mechanism itself caps re-pricing → change games
  'UNKNOWN'             // evidence insufficient to choose
])

// §4 — how concentrated the current pricing is.
const CONCENTRATION = Object.freeze(['SINGLE_PARTY', 'NARROW', 'DISTRIBUTED', 'UNKNOWN'])

// The cardinal rule, surfaced verbatim so no layer can drift from it.
const CARDINAL_RULE = '让用户拥有更多被重新定价的选择，而不是让所有人自己定价。'

// ── §5/§6 STRICT BANS (deterministic detectors; defect-only) ──────────────────
// Forced disintermediation = asserting that LEAVING is the ONLY legitimate path OR
// moralising "staying in a system" as failure. A neutral mechanism sentence
// (「这份手艺还没脱离岗位被单独定价」) or a DIAGNOSED switch to a direct payer is
// NOT flagged — only universal/exclusive/moralised forms are.
const FORCED_DISINTERMEDIATION_PAT = /(只有|必须|唯有)[^。，,；！？]{0,10}(绕过|脱离|摆脱|离开|不做员工|自己定价|自己干)[^。，,；！？]{0,10}(才|方能)|(绕过|脱离|摆脱|离开)(公司|平台|老板|雇主|店家|体系)[^。，,；！？]{0,8}(才算|才叫|才是|才能算|就能|才能)(翻身|独立|自由|成功|市场)|不做(员工|打工人)|不要打工|打工(没有|没)出路|当(员工|打工人)(没有|没)(前途|出路)|打工就是被剥削/
// Entrepreneurship bias: telling the user they SHOULD start a business / quit.
// NOTE: (?<!离)开公司 prevents a false match inside 「离开公司能不能成立」.
const ENTREPRENEURSHIP_BIAS_PAT = /(创业|自己(开店|当老板|开公司)|(?<!离)开公司|单干|裸辞|辞职(去)?自己|自己做老板|应该去创业|都该创业|自己出来做)/
// Psychology-as-trap: the WHY of the trap must be a mechanism, not the person's psyche.
// Only flag when a second/third-person cue is joined to a PSYCHOLOGICAL verb/noun —
// a bare 「你仍然只能靠公司定价」is a mechanism/position statement, NOT psychology.
const PSYCHOLOGY_AS_TRAP_PAT = /((你|您|他|她)(却|仍然|还|一直|就是)?(以为|认为|不肯|舍不得|害怕|怕|不敢|习惯|一直在骗|不愿承认|根本不想)|自我叙事|潜意识|骨子里|内心其实|骗自己)/
// Legacy preparation thesis: the R84 "还没准备好" frame (now only a SUPPORT, never a thesis).
const LEGACY_PREPARATION_PAT = /(还没准备好|没准备好|再准备一下|准备得还不够|等你准备好|准备好了吗)/
// A fabricated transaction: asserting a real outside payment happened. Only legal
// when the profile's marketProofState proves a paid transaction occurred.
const FABRICATED_TRANSACTION_PAT = /(已经(有人|为你|有陌生人)付过钱|市场已经(为你|给过你)|陌生人(已经)?(为|给)你(付|掏)过钱|已经卖出去过|真实买家(已经)?付过钱)/

// §4 — switch-type semantics: the card04 target + card05 test for each move.
const SWITCH_TYPE_META = Object.freeze({
  STAY_AND_UPGRADE: {
    label: '留在现在的局，把位置升级',
    move: '不换局：把当前的位置做到更靠近定价权的那一层。',
    card04to: '在同一体系里往上走、拿到更高一档定价的位置',
    card05test: '在现有体系里拿到一次更明确的定价信号（更高的价码 / 更高的层级 / 更关键的职责）。',
    testPat: /(位置|升级|往上|更高|层级|岗位|一档|价码|晋升|现有体系|体系内|同一体系)/
  },
  ADD_PRICING_SOURCE: {
    label: '不推翻现在的局，增加一个独立定价来源',
    move: '不推翻现在的局，在它之外再增加一个独立定价来源（第二个付款人）。',
    card04to: '在现在的局之外，多一个独立付款人的人',
    card05test: '出现第二个独立付款人：他为同一份价值付了第一笔钱。',
    testPat: /(第二个|第二笔|第二次|独立付款人|独立|外部|多一个|第二来源|不辞职|不离开|不推翻|之外|另一条|新的?付款|直接(为|给|付|把)|不经过|体系外|局外|另一个付款|同时能|现有.{0,4}之外|工资之外|额外)/
  },
  SWITCH_GAME: {
    label: '换一个更能积累定价权的局',
    move: '现在这个局的机制本身会锁住定价权，所以要换的是局，不是更努力。',
    card04to: '带<他的价值>换到一个能积累自己定价权的局里的位置',
    card05test: '在一个新的局里拿到第一笔可积累的定价反馈（不依赖原来的定价方）。',
    testPat: /(换一个|换到|换个|新局|新的局|另一个局|不同的局|赛道|转型|离开.{0,6}(局|平台|体系)|脱离.{0,6}(局|平台|体系)|不靠.{0,6}平台|不依赖.{0,6}平台|离开平台|脱离平台|平台外|平台之外|体系之外|局之外|独立于|与.{0,6}无关|不是平台|不是.{0,4}上的订单|新的定价|能积累|搬走|独立定价|自己定价|积累.{0,4}定价权|定价权在自己)/
  },
  UNKNOWN: {
    label: '先把局看清楚',
    move: '证据还不足以选择换法，先把「谁在定价、有没有第二个来源」看清楚。',
    card04to: '看清自己在哪个局、由谁定价的人',
    card05test: '能明确说出这份收入由谁定价，以及是否已有第二个定价来源。',
    testPat: /(看清|说清|明确|谁在定价|定价方|来源)/
  }
})

// ── concentration of the CURRENT pricing structure ──
function concentrationOf (gameModel) {
  const game = gameModel && gameModel.gameType ? gameModel.gameType.value : 'UNKNOWN'
  const dep = gameModel && gameModel.dependencyStructure ? gameModel.dependencyStructure.value : 'UNKNOWN'
  switch (game) {
    case 'EMPLOYER_PRICED':
    case 'COMMISSION_PRICED':
      return { value: 'SINGLE_PARTY', reason: '收入只经一个雇主/结算体系兑现' + (dep === 'EMPLOYER_DEP' ? '，且高度依赖它' : '') }
    case 'PLATFORM_PRICED':
      return { value: 'SINGLE_PARTY', reason: '订单与计价规则集中在单一平台' }
    case 'CLIENT_PRICED':
      return { value: 'NARROW', reason: '直接面对买家，但收入集中在你亲自交付的少数客户上' }
    case 'SELF_PRICED':
      return { value: 'NARROW', reason: '价格由你自己定，但需求仍集中在单一渠道/单一市场' }
    case 'MIXED':
      return { value: 'DISTRIBUTED', reason: '收入来源本就分散在多方' }
    default:
      return { value: 'UNKNOWN', reason: '还未看清定价结构' }
  }
}

// ── credible alternative re-pricing routes (0..4) — the heart of pricingPower ──
function alternativeRoutes (gameModel) {
  const gm = gameModel || {}
  const v = (k) => (gm[k] && gm[k].value) || 'UNKNOWN'
  const out = []
  if (v('leverageState') === 'LEVERAGED' || v('leverageState') === 'MIXED') out.push('价值不完全被在场时间封顶（可迁移/可复用）')
  if (v('repeatabilityState') === 'REPEATABLE' || v('repeatabilityState') === 'PARTIAL') out.push('交付可重复，可能沉淀为第二次定价')
  if (v('marketProofState') !== 'NO_PROOF' && v('marketProofState') !== 'UNKNOWN') out.push('已存在一次真实付费信号，可被复用为第二个来源')
  if (v('customerDistance') === 'DIRECT') out.push('已能直接接触买家，具备独立议价的位置')
  return out
}

function levelOf (concentration, routes) {
  const n = routes.length
  if (n >= 3 || (n >= 2 && concentration === 'DISTRIBUTED')) return 'HIGH'
  if (n >= 1) return 'MEDIUM'
  return 'LOW'
}

/**
 * Decide the SWITCH_TYPE from evidence. NONE of the three is privileged; in
 * particular EMPLOYER_PRICED is fully capable of any of the three.
 * @returns {{value:string, reason:string}}
 */
function decideSwitchType (gameModel, profile) {
  const gm = gameModel || {}
  const game = (gm.gameType && gm.gameType.value) || 'UNKNOWN'
  if (game === 'UNKNOWN') return { value: 'UNKNOWN', reason: '局未看清，无法选择换法' }

  const ve = (gm.valueExchange && gm.valueExchange.value) || 'UNKNOWN'
  const dep = (gm.dependencyStructure && gm.dependencyStructure.value) || 'UNKNOWN'
  const hardDep = dep === 'EMPLOYER_DEP' || dep === 'PLATFORM_DEP'
  // §4 — the MECHANISM caps re-pricing when the exchanged value is literally
  // time/labor AND it hangs on one hard dependency. A portable SKILL/CRAFT/
  // CONTENT/SALES value is NOT capped in the same way → prefer adding a source.
  const timeBound = ve === 'TIME' || ve === 'PHYSICAL_LABOR'
  const p = profile || {}
  const cap = p.capacity || {}
  const r = p.reality || {}
  const lowCapacity = cap.weeklyTime === 'TIME_UNDER_2' || cap.weeklyTime === 'TIME_2_5' ||
    r.monthlySurplus === 'SURPLUS_NEGATIVE' || r.monthlySurplus === 'SURPLUS_ZERO'

  // 1. The MECHANISM itself sets the ceiling: a single hard dependency + value
  //    that is fundamentally time/labor for money → the move is to change games,
  //    not to try harder inside the same one.
  if (hardDep && timeBound) {
    return { value: 'SWITCH_GAME', reason: '单一硬依赖 + 用时间/体力换钱：这个局的价码天花板由机制决定，换局比更用力更值得' }
  }
  // 2. No spare capacity to run a parallel source → strengthen the CURRENT position.
  if (lowCapacity) {
    return { value: 'STAY_AND_UPGRADE', reason: '结余/时间不足以并行第二个来源：先在现有局里把位置升级到更靠近定价权' }
  }
  // 3. The current game can be kept AND there is capacity → add a second, independent source.
  return { value: 'ADD_PRICING_SOURCE', reason: '现有局本身可以保留，且尚有余力：在它之外增加一个独立定价来源（第二个付款人）' }
}

/**
 * Compute the pricing-power model. Strictly SEPARATE from pricingAuthority.
 * @param {Object} gameModel computeGameModelV6 output
 * @param {Object} [profile] HybridProfile
 * @returns {Object|null}
 */
function computePricingPowerV6 (gameModel, profile) {
  const gm = gameModel
  if (!gm || !gm.gameType) return null
  const p = profile || {}
  const pa = (gm.pricingAuthority && gm.pricingAuthority.value) || 'UNKNOWN'
  const conc = concentrationOf(gm)
  const routes = alternativeRoutes(gm)
  const concentration = {
    value: conc.value,
    reason: conc.reason,
    sourceEvidence: (gm.gameType && gm.gameType.sourceEvidence) || [],
    confidence: (gm.gameType && gm.gameType.confidence) || 'UNKNOWN'
  }
  const alternativeRoutesField = {
    value: routes.length,
    drivers: routes,
    sourceEvidence: []
      .concat((gm.leverageState && gm.leverageState.sourceEvidence) || [])
      .concat((gm.repeatabilityState && gm.repeatabilityState.sourceEvidence) || [])
      .concat([{ source: 'marketProofState=' + ((gm.marketProofState && gm.marketProofState.value) || 'UNKNOWN'), class: 'OBSERVED', note: '是否已有真实付费信号' }])
      .concat((gm.customerDistance && gm.customerDistance.sourceEvidence) || []),
    confidence: routes.length ? 'MEDIUM' : 'LOW'
  }
  const level = levelOf(conc.value, routes)
  const authority = {
    value: pa,
    sourceEvidence: (gm.pricingAuthority && gm.pricingAuthority.sourceEvidence) || [],
    confidence: (gm.pricingAuthority && gm.pricingAuthority.confidence) || 'UNKNOWN'
  }
  const sw = decideSwitchType(gm, p)
  const switchType = {
    value: sw.value,
    reason: sw.reason,
    label: (SWITCH_TYPE_META[sw.value] || {}).label || '',
    sourceEvidence: (gm.gameType && gm.gameType.sourceEvidence) || [],
    confidence: routes.length ? 'MEDIUM' : 'LOW'
  }
  return {
    version: PRICING_POWER_VERSION,
    cardinalRule: CARDINAL_RULE,
    authority: authority,               // who sets price NOW (a MIRROR, not a new authority)
    concentration: concentration,       // how concentrated the current pricing is
    alternativeRoutes: alternativeRoutesField, // how many credible re-pricing routes exist
    level: { value: level, basis: 'routes=' + routes.length + ',concentration=' + conc.value, sourceEvidence: alternativeRoutesField.sourceEvidence, confidence: alternativeRoutesField.confidence },
    switchType: switchType
  }
}

// ── guard helpers (defect-only; count on FINAL shipped text) ─────────────────
function guardNoDisintermediation (text) { return FORCED_DISINTERMEDIATION_PAT.test(String(text || '')) }
function guardNoEntrepreneurship (text) { return ENTREPRENEURSHIP_BIAS_PAT.test(String(text || '')) }
function guardMechanismNotPsychology (text) { return PSYCHOLOGY_AS_TRAP_PAT.test(String(text || '')) }
function guardNoLegacyPreparation (text) { return LEGACY_PREPARATION_PAT.test(String(text || '')) }

function collectTexts (cards) {
  const c = cards || {}
  const t = []
  if (c.card01) t.push(c.card01)
  if (c.card02) t.push(c.card02)
  if (c.card03) t.push(c.card03.rule || ''); if (c.card03 && Array.isArray(c.card03.steps)) t.push(c.card03.steps.join(''))
  if (c.card04) { t.push(c.card04.from || '', c.card04.to || '', c.card04.rule || '') }
  if (c.card05) { t.push(c.card05.goal || ''); if (Array.isArray(c.card05.actions)) t.push(c.card05.actions.join('')); t.push(c.card05.acceptance || '') }
  return t.filter((x) => String(x || '').trim())
}

function countForcedDisintermediation (cards) { return collectTexts(cards).filter(guardNoDisintermediation).length }
function countEntrepreneurshipBias (cards) { return collectTexts(cards).filter(guardNoEntrepreneurship).length }
function countLegacyPreparation (cards) { return collectTexts(cards).filter(guardNoLegacyPreparation).length }
// Psychology only counts when it appears in the TRAP card (card03) where the WHY
// must be a mechanism, not the person's psyche.
function countPsychologyAsTrap (cards) {
  const c = cards || {}
  const t = []
  if (c.card03) { t.push(c.card03.rule || ''); if (Array.isArray(c.card03.steps)) t.push(c.card03.steps.join('')) }
  return t.filter(guardMechanismNotPsychology).length
}
// A fabricated transaction is only illegal when NO paid proof exists.
function countFabricatedTransactions (cards, gameModel) {
  const proof = gameModel && gameModel.marketProofState ? gameModel.marketProofState.value : 'UNKNOWN'
  const paid = proof === 'PAID_ONCE' || proof === 'OCCASIONAL' || proof === 'REPEATABLE'
  if (paid) return 0
  return collectTexts(cards).filter((t) => FABRICATED_TRANSACTION_PAT.test(String(t))).length
}

/** §8 — does card04 explicitly select the chosen SWITCH_TYPE (from/to/rule)? */
function card04SelectsSwitchType (card04, switchType) {
  const meta = SWITCH_TYPE_META[switchType]
  if (!meta) return false
  const t = [(card04 || {}).from, (card04 || {}).to, (card04 || {}).rule].filter(Boolean).join(' ')
  if (!t.trim()) return false
  return meta.testPat.test(t)
}

/** §10 — does card05 test the same SWITCH_TYPE that card04 selected? */
function card05TestsSwitchType (card05, switchType) {
  const meta = SWITCH_TYPE_META[switchType]
  if (!meta) return false
  const c5 = card05 || {}
  const t = [c5.goal, (c5.actions || []).join(''), c5.acceptance].filter(Boolean).join(' ')
  if (!t.trim()) return false
  return meta.testPat.test(t)
}

/**
 * Screen the FINAL shipped cards for the pricing-power defects (defect-only
 * counters; NO text mutation — the model, guided by the primary prompt block,
 * must make the choice; the deterministic layer only verifies it).
 * @returns {{counts:Object}}
 */
function screenPricingPower (cards, power, gameModel) {
  const c = cards || {}
  const counts = {
    PRICING_AUTHORITY_PRICING_POWER_COLLAPSE_COUNT: 0,
    SWITCH_TYPE_MISSING_COUNT: 0,
    FORCED_DISINTERMEDIATION_COUNT: 0,
    ENTREPRENEURSHIP_BIAS_COUNT: 0,
    PSYCHOLOGY_AS_TRAP_COUNT: 0,
    FABRICATED_TRANSACTION_COUNT: 0
  }
  if (!power) return { counts: counts }
  const st = (power.switchType && power.switchType.value) || 'UNKNOWN'
  // §8/§10 — card04 must select + card05 must test the SAME switch type.
  if (!card04SelectsSwitchType(c.card04, st)) counts.SWITCH_TYPE_MISSING_COUNT++
  else if (!card05TestsSwitchType(c.card05, st)) counts.SWITCH_TYPE_MISSING_COUNT++
  // §5/§6 — strict bans, counted on final text.
  counts.FORCED_DISINTERMEDIATION_COUNT = countForcedDisintermediation(c)
  counts.ENTREPRENEURSHIP_BIAS_COUNT = countEntrepreneurshipBias(c)
  counts.PSYCHOLOGY_AS_TRAP_COUNT = countPsychologyAsTrap(c)
  counts.FABRICATED_TRANSACTION_COUNT = countFabricatedTransactions(c, gameModel)
  return { counts: counts }
}

/** Human+model readable lines for the prompt (PRIMARY pricing-power block). */
function renderPricingPowerLines (pp) {
  if (!pp) return []
  const L = []
  L.push('- 【关键区分】定价权（authority）= 现在谁在给他定价；定价力（power）= 他的价值还能被多少个可信的替代方式重新定价与兑现。')
  L.push('- 他现在的定价权（authority）：' + (pp.authority && pp.authority.value))
  L.push('- 定价集中度（concentration）：' + (pp.concentration && pp.concentration.value) + '——' + (pp.concentration && pp.concentration.reason))
  L.push('- 可重新定价的替代路径数（alternativeRoutes）：' + (pp.alternativeRoutes && pp.alternativeRoutes.value) + '（' + ((pp.alternativeRoutes && pp.alternativeRoutes.drivers) || []).join('；') + '）')
  L.push('- 定价力水平（level）：' + (pp.level && pp.level.value))
  L.push('- 【本报告的换法 SWITCH_TYPE】：' + (pp.switchType && pp.switchType.value) + '——' + (pp.switchType && pp.switchType.label))
  L.push('- 换法理由（证据）：' + (pp.switchType && pp.switchType.reason))
  L.push('- 核心原则：' + pp.cardinalRule)
  L.push('  · 三种换法都合理，不排名：STAY_AND_UPGRADE=留在现在的位置把它升级；ADD_PRICING_SOURCE=不推翻现在的局，再加一个独立定价来源；SWITCH_GAME=这个局的机制本身封住了再定价，所以换局。')
  L.push('  · 禁止默认“自己定价 / 找陌生人 / 绕过公司或平台就是翻身”。SELF-PRICED 并不天然高于 EMPLOYER-PRICED。')
  L.push('  · card04 必须明确选择上面这一个 SWITCH_TYPE；card05 必须去检验同一个 SWITCH_TYPE。')
  return L
}

module.exports = {
  PRICING_POWER_VERSION,
  SWITCH_TYPES,
  CONCENTRATION,
  CARDINAL_RULE,
  SWITCH_TYPE_META,
  FORCED_DISINTERMEDIATION_PAT,
  ENTREPRENEURSHIP_BIAS_PAT,
  PSYCHOLOGY_AS_TRAP_PAT,
  LEGACY_PREPARATION_PAT,
  FABRICATED_TRANSACTION_PAT,
  concentrationOf,
  alternativeRoutes,
  levelOf,
  decideSwitchType,
  computePricingPowerV6,
  guardNoDisintermediation,
  guardNoEntrepreneurship,
  guardMechanismNotPsychology,
  guardNoLegacyPreparation,
  collectTexts,
  countForcedDisintermediation,
  countEntrepreneurshipBias,
  countLegacyPreparation,
  countPsychologyAsTrap,
  countFabricatedTransactions,
  card04SelectsSwitchType,
  card05TestsSwitchType,
  screenPricingPower,
  renderPricingPowerLines
}
