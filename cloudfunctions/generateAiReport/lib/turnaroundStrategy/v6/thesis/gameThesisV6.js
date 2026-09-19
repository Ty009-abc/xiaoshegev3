'use strict'
/**
 * turnaroundStrategy/v6/thesis/gameThesisV6.js
 *
 * RC8.4 V6 R85C3 — GAME_THESIS: the DOMINANT visible-thesis authority.
 *
 * PROBLEM (R85C3 §2): the system already computes REALITY → ECONOMY → GAME →
 * RULE → TRAP → SWITCH → BET, but the MODEL-authored five cards could still fall
 * back to legacy R84 themes (没准备好 / 市场验证 / 执行力 / 第二次付费 /
 * 价值结构) WITHOUT ever explaining the user's GAME. R85C3 makes GAME / RULE /
 * TRAP the dominant thesis and binds all five visible cards to it.
 *
 * THIS MODULE is a PURE, DETERMINISTIC thesis-construction layer ABOVE the
 * GameModel. It:
 *   1. builds the internal GAME_THESIS object (WHO_SETS_PRICE / WHAT_USER_SELLS /
 *      CURRENT_POSITION / TRAP / SWITCH / BET + the ONE central contradiction);
 *   2. renders it as a structured, PRIMARY prompt block (authority order §3);
 *   3. provides deterministic, DEFECT-ONLY guards + text-preserving repairs so a
 *      purely behavioral / legacy Card01 cannot ship when a GameModel exists.
 *
 * AUTHORITY (frozen — same boundary as the GameModel):
 *   - ZERO B1 authority. NEVER read by any B1 file.
 *   - EVIDENCE_LAYER only. Deterministic. No AI. No I/O. No network.
 *   - NO new questionnaire field / economic dimension / GameModel taxonomy.
 *   - RUNTIME ONLY (not persisted as a permanent profile fact).
 */

const GAME_THESIS_VERSION = 'r85c3_game_thesis_v1'

// §3 — FROZEN visible-thesis authority order. GAME dominates; legacy R84 /
// personality signals are the LAST and may NOT replace the GAME thesis.
const AUTHORITY_ORDER = Object.freeze([
  'GAME',
  'RULE_PRICING_AUTHORITY',
  'TRAP',
  'REALITY_EVIDENCE',
  'SWITCH',
  'BET',
  'B1_PERSONALITY'
])

// ── short value-exchange nouns (deterministic; from the GameModel valueExchange) ──
const WHAT_SELLS = Object.freeze({
  TIME: '时间',
  PHYSICAL_LABOR: '体力和在线时长',
  TECHNICAL_SKILL: '技术能力',
  SALES_RESULT: '成交能力',
  CONTENT: '内容',
  SERVICE: '手艺',
  CAPITAL: '本金',
  SYSTEM: '运营能力',
  MIXED: '几种混合的东西',
  UNKNOWN: '你还说不清的东西'
})

// ── WHO sets the price, in natural IP language (§14) ──
const WHO_SETS_PRICE = Object.freeze({
  EMPLOYER: '你的收入主要由公司/雇主定价',
  PLATFORM: '你的收入主要由平台规则定价',
  CLIENT: '你的收入主要由客户/甲方定价',
  USER: '你的收入主要由你自己定价',
  MARKET: '你的收入由市场行情定价',
  MIXED: '你的收入由多方共同决定，没有一个稳定的定价方',
  UNKNOWN: '你现在还说不清收入由谁定价'
})

// ── game-native CARD01 (THE REAL LOSS / WRONG GAME) — deterministic, evidence-
//    grounded restatement of the computed game. Used ONLY to repair a Card01 that
//    carries NO game signal when a GameModel is available (§6/§7). The template is
//    PROFILE-AWARE: it uses the user's own monetizable-skill noun and, when the
//    profile has paid proof, KEEPS the proof/loop marker (一次答案) so the repaired
//    Card01 stays game-native AND memorable/profile-specific — never a bare frame. ──
const SKILL_NOUN = Object.freeze({
  ASSET_CONTENT: '内容',
  ASSET_TECHNICAL: '技术',
  ASSET_SALES: '成交能力',
  ASSET_OPS: '运营能力',
  ASSET_NETWORK: '人脉资源',
  ASSET_CRAFT: '手艺',
  ASSET_UNCLEAR: '能力'
})
// Short pricing-authority noun for the Card01 clause.
const PAYER_SHORT = Object.freeze({
  EMPLOYER: '你的雇主',
  PLATFORM: '平台规则',
  CLIENT: '你的客户',
  USER: '你自己',
  MARKET: '市场',
  MIXED: '好几方',
  UNKNOWN: '一个说不清的一方'
})
// WITH paid proof → keep the proof/loop marker (一次答案) AND the collision form (不是…).
// WITHOUT → a fresh wrong-game collision frame.
const CARD01_WITH_PROOF = '不是你的{n}不够，是市场已经给过一次答案，定价者却只有{payer}。'
const CARD01_NO_PROOF = '不是你的{n}不够，是它现在只有一个定价者：{payer}。'
// The SERVICE / CRAFT natural variant keeps the user's own craft word.
const CARD01_EMPLOYER_SERVICE = '不是你这{n}不够，是它现在只有一个定价者：{payer}。'
// Games where pricing is NOT held by one external party: the "只有一个定价者"
// frame would be FALSE. Dedicated, game-native frames instead.
const CARD01_SELF_PRICED = '不是你的{n}不够，是你自己定的价，还没被第二个买家验证过。'
const CARD01_MIXED = '不是你的{n}不够，是你的定价权被分散在好几方手里。'
const CARD01_UNKNOWN = '不是你的{n}不够，是你还没搞清楚这份收入到底由谁定价。'

// §14 — IP-native language markers (pricing authority / game structure /
// value exchange / dependency). A Card01 carrying NONE of these is behavioral-only.
// Deliberately NOT matched: bare 市场 / 价值 / 准备 / 验证 (legacy-theme vocabulary).
const GAME_SIGNAL_PAT = /(定价者|定价权|谁定价|由谁定价|由.{0,6}定价|定价的|雇主|公司|老板|平台|客户|甲方|买家|付款人|工资表|结算|提成|分成|派单|流量|分发|变现机制|收入机制|收入由|靠.{0,3}换钱|靠.{0,3}换收入|交换物|单价|包月|手艺|技术能力|成交能力|交付|依赖|岗位)/

// §13 — legacy R84 thematic nouns that must stay SUBORDINATE to the GAME thesis.
const LEGACY_THEME_PAT = /(没准备好|还没准备好|准备好|市场验证|未被验证|执行力|第二次付费|第二次验证|价值结构|商业闭环|经营系统|反馈回路|可重复交付|可重复的产品|认知升级|破局)/

/**
 * Build the internal GAME_THESIS from the deterministic GameModel + profile.
 * Every field is grounded in the GameModel's own evidence; the ONE central
 * contradiction is CURRENT GAME/POSITION vs DESIRED ECONOMIC POSITION (§4).
 *
 * @param {Object} gameModel computeGameModelV6 output (required)
 * @param {Object} [hybridProfile] HybridProfile
 * @param {Object} [hybridContext] hybridContext (for paid-proof reality)
 * @returns {Object|null} game thesis (null when no gameModel)
 */
function buildGameThesis (gameModel, hybridProfile, hybridContext) {
  const gm = gameModel
  if (!gm || !gm.gameType) return null
  const hp = hybridProfile || {}
  const hc = hybridContext || {}
  const reality = hp.reality || {}
  const asset = hp.asset || {}
  const desired = hp.desiredChange || {}

  const gameType = val(gm.gameType)
  const valueExchange = val(gm.valueExchange)
  const pricingAuthority = val(gm.pricingAuthority)
  const ruleOwner = val(gm.ruleOwner)
  const dependency = val(gm.dependencyStructure)
  const proof = val(gm.marketProofState)
  const trapSteps = (gm.trapMechanism && Array.isArray(gm.trapMechanism.value)) ? gm.trapMechanism.value.slice() : []
  const switchAxis = (gm.switchDirection && gm.switchDirection.axis) || 'UNKNOWN'
  const switchText = val(gm.switchDirection)
  const betType = val(gm.smallBetType)

  const sellsNoun = WHAT_SELLS[valueExchange] || WHAT_SELLS.UNKNOWN
  const hasPaidProof = hc.marketValidated === true || proof === 'PAID_ONCE' || proof === 'OCCASIONAL' || proof === 'REPEATABLE'

  const whoSetsPrice = {
    value: pricingAuthority,
    ruleOwner: ruleOwner,
    text: WHO_SETS_PRICE[pricingAuthority] || WHO_SETS_PRICE.UNKNOWN,
    sourceEvidence: (gm.pricingAuthority && gm.pricingAuthority.sourceEvidence) || [],
    confidence: (gm.pricingAuthority && gm.pricingAuthority.confidence) || 'UNKNOWN'
  }
  const whatUserSells = {
    value: valueExchange,
    text: '你现在主要在卖：' + sellsNoun + '。',
    sourceEvidence: (gm.valueExchange && gm.valueExchange.sourceEvidence) || [],
    confidence: (gm.valueExchange && gm.valueExchange.confidence) || 'UNKNOWN'
  }
  const currentPosition = {
    value: gameType,
    text: '你手里的' + sellsNoun + '能挣钱，但它现在主要只在「' + gameLabel(gameType) + '」这个局里兑现。',
    sourceEvidence: (gm.gameType && gm.gameType.sourceEvidence) || [],
    confidence: (gm.gameType && gm.gameType.confidence) || 'UNKNOWN'
  }
  const trap = {
    value: trapSteps,
    text: trapSteps.join(' → '),
    sourceEvidence: (gm.trapMechanism && gm.trapMechanism.sourceEvidence) || [],
    confidence: (gm.trapMechanism && gm.trapMechanism.confidence) || 'UNKNOWN'
  }
  const sw = {
    value: switchText,
    axis: switchAxis,
    sourceEvidence: (gm.switchDirection && gm.switchDirection.sourceEvidence) || [],
    confidence: (gm.switchDirection && gm.switchDirection.confidence) || 'UNKNOWN'
  }
  const bet = {
    value: betType,
    tests: betTests(betType),
    sourceEvidence: (gm.smallBetType && gm.smallBetType.sourceEvidence) || [],
    confidence: (gm.smallBetType && gm.smallBetType.confidence) || 'UNKNOWN'
  }

  // §4 — ONE central contradiction: CURRENT GAME/POSITION vs DESIRED ECONOMIC POSITION.
  const contradiction = buildContradiction({ gameType, sellsNoun, hasPaidProof, proof, pricingAuthority, desired, asset })

  return {
    version: GAME_THESIS_VERSION,
    authorityOrder: AUTHORITY_ORDER.slice(),
    gameType: gameType,
    valueExchange: valueExchange,
    pricingAuthority: pricingAuthority,
    ruleOwner: ruleOwner,
    dependency: dependency,
    marketProofState: proof,
    whoSetsPrice: whoSetsPrice,
    whatUserSells: whatUserSells,
    currentPosition: currentPosition,
    trap: trap,
    switch: sw,
    bet: bet,
    contradiction: contradiction,
    // §6/§7 — the deterministic game-native Card01 (repair source; never invented).
    card01Fallback: card01For(pricingAuthority, valueExchange, (asset && asset.type) || null, hasPaidProof),
    skillNoun: SKILL_NOUN[(asset && asset.type) || ''] || SKILL_NOUN.ASSET_UNCLEAR
  }
}

function val (f) { return (f && f.value != null) ? f.value : 'UNKNOWN' }

function gameLabel (gameType) {
  return ({
    EMPLOYER_PRICED: '雇主定价',
    PLATFORM_PRICED: '平台定价',
    CLIENT_PRICED: '客户定价',
    COMMISSION_PRICED: '公司提成结算',
    SELF_PRICED: '自己定价',
    MIXED: '多方共同定价',
    UNKNOWN: '还说不清的局'
  })[gameType] || '当前这个局'
}

function betTests (betType) {
  return ({
    FIRST_EXTERNAL_QUOTE: '能否拿到一个来自雇主体制之外的、由外部直接给出的真实报价。',
    FIRST_EXTERNAL_PRICING_SIGNAL: '能否让一个外部买家为这次成交能力直接付费（独立于公司体系）。',
    FIRST_DIRECT_PAID_SAMPLE: '能否让一个顾客绕过中间人、直接为你的手艺付费。',
    FIRST_REPEAT_PURCHASE: '能否让同一个买家出现第二次真实付费。',
    FIRST_PORTABLE_SKILL_VALIDATION: '能否让这份能力离开平台后，仍被客户直接付费。',
    FIRST_PACKAGED_PAID_DELIVERABLE: '能否做出一个被直接购买、不靠平台分发的交付。',
    FIRST_DIRECT_CUSTOMER_CONVERSATION: '能否直接和真实买家谈一次并拿到明确答复。'
  })[betType] || '能否拿到一次真实的、外部的市场反馈。'
}

function buildContradiction (x) {
  const realityText = x.hasPaidProof
    ? '现实已经证明：有人愿意为你这份' + x.sellsNoun + '付过钱。'
    : '现实里，你手里这份' + x.sellsNoun + '还没有被外部真正定价过。'
  const positionText = '但你现在主要还在「' + gameLabel(x.gameType) + '」这个局里兑现，定价权不在你手里。'
  const selfStory = x.hasPaidProof
    ? '你却仍用「还没准备好 / 能力不够」解释自己。'
    : '你还在用「再准备一下」回避一次真实的定价检验。'
  return {
    reality: realityText,
    position: positionText,
    selfStory: selfStory,
    text: realityText + positionText
  }
}

/**
 * Deterministic game-native Card01 (<=40 chars), driven by the COMPUTED
 * pricing authority (NOT the game type — so a MIXED answer is never over-inferred
 * to a single employer), and profile- & proof-aware.
 */
function card01For (pricingAuthority, valueExchange, assetType, hasPaidProof) {
  const noun = SKILL_NOUN[assetType || ''] || SKILL_NOUN.ASSET_UNCLEAR
  // Games whose pricing is NOT a single external party get their OWN frame; the
  // "只有一个定价者：{payer}" template would assert a false/over-inferred payer.
  if (pricingAuthority === 'USER') return CARD01_SELF_PRICED.replace(/\{n\}/g, noun)
  if (pricingAuthority === 'MIXED') return CARD01_MIXED.replace(/\{n\}/g, noun)
  if (pricingAuthority === 'UNKNOWN') return CARD01_UNKNOWN.replace(/\{n\}/g, noun)
  const payer = PAYER_SHORT[pricingAuthority] || PAYER_SHORT.UNKNOWN
  let tpl
  if (pricingAuthority === 'EMPLOYER' && valueExchange === 'SERVICE') tpl = CARD01_EMPLOYER_SERVICE
  else tpl = hasPaidProof ? CARD01_WITH_PROOF : CARD01_NO_PROOF
  return tpl.replace(/\{n\}/g, noun).replace(/\{payer\}/g, payer)
}

// ── Deterministic guards (defect-only) ──

/** §6/§7 — does a Card01 carry at least one game signal (pricing/game/exchange/dep)? */
function card01GameSignalPresent (text) {
  const t = String(text || '')
  if (!t.trim()) return false
  return GAME_SIGNAL_PAT.test(t)
}

/** §13 — is a visible card dominated by a legacy R84 theme while carrying NO game signal? */
function legacyThemeOverride (text, gameThesis) {
  const t = String(text || '')
  if (!t.trim()) return false
  if (!LEGACY_THEME_PAT.test(t)) return false
  // A legacy theme is an OVERRIDE only when the GAME thesis is available and the
  // card does NOT also express the game (pricing authority / game structure).
  if (!gameThesis) return false
  return !GAME_SIGNAL_PAT.test(t)
}

/**
 * §12 CARD01↔CARD05 GAME LOOP — Card05 must TEST the same game claim Card01 made.
 * Deterministic: the bet must target the game's pricing axis (a second payer /
 * external pricing / portable value / repeatability), not a generic "完善产品".
 */
function card05TestsGame (card01, card05, gameThesis) {
  if (!gameThesis) return true
  const betType = gameThesis.bet && gameThesis.bet.value
  const c5 = card05 || {}
  const blob = [c5.goal, (c5.actions || []).join(''), c5.acceptance].filter(Boolean).join(' ')
  const t = String(blob || '')
  if (!t.trim()) return false
  const betHints = {
    FIRST_EXTERNAL_QUOTE: /(外部|雇主体制之外|独立|报价|第二)/,
    FIRST_EXTERNAL_PRICING_SIGNAL: /(外部|独立|直接付费|第二|付款)/,
    FIRST_DIRECT_PAID_SAMPLE: /(顾客|直接|绕过|付费|第二)/,
    FIRST_REPEAT_PURCHASE: /(第二次|复购|重复|再来)/,
    FIRST_PORTABLE_SKILL_VALIDATION: /(离开平台|平台之外|直接付费|客户|第二)/,
    FIRST_PACKAGED_PAID_DELIVERABLE: /(直接购买|不靠平台|交付|产品|第二)/,
    FIRST_DIRECT_CUSTOMER_CONVERSATION: /(直接|买家|谈|答复|报价)/
  }
  const pat = betHints[betType]
  return pat ? pat.test(t) : true
}

/**
 * R85C3 §6/§7/§13 — screen + safely repair the compressed cards so the GAME thesis
 * dominates: a purely behavioral Card01 is replaced with the deterministic
 * game-native Card01 (text lives in THIS module), legacy-theme overrides are
 * counted, and the Card01↔Card05 game loop is verified.
 *
 * TEXT-PRESERVING: the repair substitutes a deterministic, game-grounded sentence
 * (from the GameModel), never an invented claim. No model call.
 * @returns {{cards, counts, repaired}}
 */
function screenGameThesis (cmp, gameThesis) {
  const c = Object.assign({}, cmp || {})
  const counts = {
    CARD01_GAME_SIGNAL_MISSING_COUNT: 0,
    LEGACY_THEME_OVERRIDES_GAME_COUNT: 0,
    CARD01_CARD05_GAME_LOOP_FAIL_COUNT: 0
  }
  const repaired = { card01GameRepair: 0 }
  if (!gameThesis) return { cards: c, counts: counts, repaired: repaired }

  // §6/§7 — Card01 must carry a game signal; repair a behavioral-only Card01.
  const c1 = String(c.card01 || '')
  if (c1.trim() && !card01GameSignalPresent(c1)) {
    counts.CARD01_GAME_SIGNAL_MISSING_COUNT++
    const fix = gameThesis.card01Fallback
    if (fix && charLenSafe(fix) <= 40) { c.card01 = fix; repaired.card01GameRepair++ }
  }

  // §13 — legacy theme must not OVERRIDE the game thesis (counted on FINAL text).
  const texts = [c.card01, c.card02, (c.card03 && c.card03.steps || []).join(''), (c.card03 && c.card03.rule)]
    .concat(card04Texts(c.card04), card05Texts(c.card05))
  for (const t of texts) { if (legacyThemeOverride(t, gameThesis)) counts.LEGACY_THEME_OVERRIDES_GAME_COUNT++ }

  // §12 — Card05 must TEST the same game claim Card01 made.
  if (!card05TestsGame(c.card01, c.card05, gameThesis)) counts.CARD01_CARD05_GAME_LOOP_FAIL_COUNT++

  return { cards: c, counts: counts, repaired: repaired }
}

function charLenSafe (s) { return String(s || '').length }
function card04Texts (c4) { const x = c4 || {}; return [x.from, x.to, x.rule].filter(Boolean) }
function card05Texts (c5) { const x = c5 || {}; return [x.goal].concat(x.actions || [], [x.acceptance]).filter(Boolean) }

/** Human+model readable lines for the prompt (PRIMARY structured block).
 * @param {Object} gt game thesis
 * @param {boolean} [demoted] R86-E §2 — when true (R86 path), GAME_THESIS is
 *   REALITY_EVIDENCE / CONTEXT / APPLICATION, NOT the top authority. */
function renderGameThesisLines (gt, demoted) {
  if (!gt) return []
  const L = []
  if (demoted) {
    L.push('【R86-E：本块是【现实证据/上下文/应用】，不是本报告的最高权威。最高权威是下面的世界模型 + 模型-现实错配。五张卡的【模型】必须来自世界模型；这个局只用来提供现实例证。】')
  } else {
    L.push('【这是本报告的 PRIMARY 论点。五张卡必须全部从这个局出发，legacy 主题只能作为补充。】')
  }
  L.push('- 权威顺序：' + AUTHORITY_ORDER.join(' > ') + (demoted ? '（R86-E 下，GAME 及其后各项均从属于世界模型）' : '（legacy R84/人格信号排最后，不得取代 GAME）'))
  L.push('- 局（GAME）：' + gameLabel(gt.gameType) + '（' + gt.gameType + '）')
  L.push('- 谁定价（WHO_SETS_PRICE）：' + (gt.whoSetsPrice && gt.whoSetsPrice.text))
  L.push('- 他在卖什么（WHAT_USER_SELLS）：' + (gt.whatUserSells && gt.whatUserSells.text))
  L.push('- 当前位置（CURRENT_POSITION）：' + (gt.currentPosition && gt.currentPosition.text))
  L.push('- 陷阱（TRAP）：' + (gt.trap && gt.trap.text))
  L.push('- 换位（SWITCH）：' + (gt.switch && gt.switch.value))
  L.push('- 下注（BET）：' + (gt.bet && gt.bet.value) + ' —— ' + (gt.bet && gt.bet.tests))
  L.push('- 唯一核心矛盾（ONE CONTRADICTION）：' + (gt.contradiction && gt.contradiction.text))
  L.push('  · card01 必须直接说出这个局的真实损失/错误位置（含定价权/局结构/交换物/依赖之一），不得只写行为。')
  L.push('  · card05 必须用一次最小现实下注去检验 card01 提出的同一个局（例如：能否出现第二个定价者/付款人）。')
  return L
}

module.exports = {
  GAME_THESIS_VERSION,
  AUTHORITY_ORDER,
  WHAT_SELLS,
  WHO_SETS_PRICE,
  CARD01_WITH_PROOF,
  CARD01_NO_PROOF,
  CARD01_EMPLOYER_SERVICE,
  CARD01_SELF_PRICED,
  CARD01_MIXED,
  CARD01_UNKNOWN,
  SKILL_NOUN,
  PAYER_SHORT,
  GAME_SIGNAL_PAT,
  LEGACY_THEME_PAT,
  buildGameThesis,
  card01For,
  card01GameSignalPresent,
  legacyThemeOverride,
  card05TestsGame,
  screenGameThesis,
  betTests,
  gameLabel,
  renderGameThesisLines
}
