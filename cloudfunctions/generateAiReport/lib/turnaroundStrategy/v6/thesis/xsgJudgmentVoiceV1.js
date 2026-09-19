'use strict'
/**
 * turnaroundStrategy/v6/thesis/xsgJudgmentVoiceV1.js
 *
 * RC8.4 V6 R85-D — XSG JUDGMENT / 拆局 VOICE LAYER (deterministic, NO LLM).
 *
 * PROBLEM (R85-C3 owner real-device acceptance = HOLD):
 *   The visible report was CORRECT / STRUCTURED / GROUNDED, yet still read like
 *   AI-consulting prose: too explanatory, too abstract, too symmetrical, too
 *   consultant-like, too low-impact. The user should feel "他一句话把我没看到
 *   的规则点破了", not "分析得很专业".
 *
 * THIS MODULE converts the ALREADY-GROUNDED (world-model + game) content of the
 * final five cards into 珠澳小事哥-style JUDGMENT language:
 *   CONCRETE · SHORT · SHARP · RULE-BASED · ANTI-BULLSHIT · REALITY-FIRST.
 * It adds NO new facts, changes NO model, calls NO LLM, touches NO UI.
 *
 *   THESIS → XSG JUDGMENT → FIVE VISIBLE CARDS.
 *
 * Non-swap discipline (§6/§23): every card that must be occupation/game-specific
 * embeds the user's OWN game nouns (payer / skill), so the same sentence can NOT
 * be copied unchanged to another occupation.
 *
 * BOUNDARY: pure deterministic. No I/O. No AI. No network. No persistence.
 */

const XSG_VOICE_VERSION = 'r85d_xsg_judgment_voice_v1'

// ── §3 abstract economic terms that must NOT dominate visible copy ───────────
const ABSTRACT_TERMS = Object.freeze([
  '市场验证', '价格信号', '价值结构', '收入结构', '独立付款人', '可重复交付',
  '商业闭环', '经营系统', '定价权', '定价者', '第二个价格信号', '独立定价来源',
  '独立定价来源', '第二付款人', '价值交换', '变现机制', '现金牛'
])

// ── §20 AI template rhythm to avoid as DEFAULT rhythm ────────────────────────
const TEMPLATE_RHYTHM_PAT = /(你不是[^。；，]{0,20}[，,]\s*是|所以你现在|这意味着|真正的问题是)/g

// ── §8 unsupported psychology on visible text ────────────────────────────────
const PSYCH_PAT = /不敢动|不敢开始|不敢尝试|害怕|怕失败|怕被拒|舍不得|放不下|不愿意|不愿动|不敢面对|逃避|回避/

// ── concrete game frame (deterministic; keyed by the COMPUTED game type) ─────
const GAME_FRAME = Object.freeze({
  EMPLOYER_PRICED: { payer: '公司', act: '按你交出去的时间结账', out: '公司之外', place: '公司里' },
  PLATFORM_PRICED: { payer: '平台', act: '按你的流量和在线时长结账', out: '平台之外', place: '平台上' },
  CLIENT_PRICED: { payer: '客户', act: '按你亲自接的每一单结账', out: '你手里这一单之外', place: '你亲自接的单子里' },
  COMMISSION_PRICED: { payer: '公司', act: '按提成给你结算', out: '提成这套之外', place: '提成这套里' },
  SELF_PRICED: { payer: '你自己', act: '自己给自己定价', out: '你自己这一个渠道之外', place: '你自己的渠道里' },
  MIXED: { payer: '好几方', act: '被好几方分别定价', out: '这几方之外', place: '几方手里' },
  UNKNOWN: { payer: '现在这个局', act: '给你一口价', out: '这个局之外', place: '现在这个局里' }
})

// ── skill noun (deterministic; from the profile's own asset type) ────────────
const SKILL_NOUN = Object.freeze({
  ASSET_CONTENT: '内容', ASSET_TECHNICAL: '技术', ASSET_SALES: '成交能力', ASSET_OPS: '运营能力',
  ASSET_NETWORK: '人脉', ASSET_CRAFT: '手艺', ASSET_UNCLEAR: '那点本事'
})

// ── §5/§9/§11 the NON-OBVIOUS RULE of the primary model (axis,state) ─────────
// Short, concrete, quotable. Keyed by STATE (states are axis-exclusive).
const MODEL_RULE = Object.freeze({
  TIME_LINEAR: '时间一停，价值就停',
  REUSABLE_ASSET: '东西还没攒够，收益就爬得慢',
  LEVERAGED: '放大的方向没验证，规模会把错一起放大',
  PRICING_POSITION: '没有可重复的交付，高价只靠单次机会',
  BASE_RATE_AWARE: '只用别人给的比例，会错过只有试过才知道的机会',
  EXPERIMENT_FIRST: '试出来的结果，没有同一把尺子就白试',
  CERTAINTY_SEEKING: '越等越拿不到能证伪的证据，确定永远等不来',
  RESULT_BIASED: '你看到的结果都已经发生，轮到你时常常过季',
  RISK_BOUNDED: '只算代价不算上行，会把值得试的机会一起挡掉',
  STRUCTURAL_FEEDBACK: '只看懂机制、不落到改法，还是原地打转',
  PERSON_ATTRIBUTION: '规则没变，换谁结果都会重演',
  PER_EVENT: '同样的坑反复踩，经验留不下来',
  NO_AWARENESS: '反复出现的事，一直没攒下能复用的解释',
  RULE_AWARE: '看懂了规则却不换位置，收益照样不动',
  EFFORT_DEFAULT: '你不定价，努力抬高的是标准，不是价钱',
  DEMAND_ROLE: '哪里有缺口就往哪跑，价钱还是对方按需求给',
  REPEATABLE_EVIDENCE: '只认能重复的证据，早期只有一次的机会会被自己否掉',
  PRAISE_BASED: '评价是别人给的，你没法拿它去换钱',
  LUCK_DISMISS: '不追问为什么成，成过也带不走',
  UNREFLECTIVE: '不回头看，就分不清哪次是真进步'
})

// ── §12/§13 SWITCH_TYPE voice (what actually changes) ────────────────────────
const SWITCH_VOICE = Object.freeze({
  STAY_AND_UPGRADE: {
    to: (s) => '不换地方，把同一身' + s + '放到更靠前定价的位置',
    rule: '先别急着换地方，先让同一身本事在更高的位置被重新开一次价。',
    app: '先把现在这一家的价往上顶一档',
    core: (s) => '把你这份' + s + '顶到更高一档、被开一次更高的价',
    first: (s) => '先找一个更高的位置（更高一档的活 / 更关键的职责），把' + s + '放上去'
  },
  ADD_PRICING_SOURCE: {
    to: (s) => '保住现在的活，再给' + s + '开第二个能收钱的入口',
    rule: '真正的风险不是挣得少，是全天下只有一处肯为你出钱。',
    app: '再多一个真的愿意给你钱的人',
    core: (s) => '让第二个人直接为你这份' + s + '给一次钱',
    first: (s) => '先找出一个公司/平台之外、可能直接为' + s + '出钱的人'
  },
  SWITCH_GAME: {
    to: (s) => '带着' + s + '，换一个能自己攒价钱的局',
    rule: '这个局的上限写在规则里，越用力也顶不破，先花小钱去试新局。',
    app: '先花小钱试一个能自己攒钱的新局',
    core: (s) => '在一个不靠原来那一方的新地方，拿到第一次真正属于' + s + '的反馈',
    first: (s) => '先花一点小钱，在一个新的小地方试一次' + s + ',拿到第一个真实反馈'
  },
  UNKNOWN: {
    to: (s) => '先看清这份钱到底由谁说了算',
    rule: '眼下最该搞清的，是你这份钱到底由谁说了算。',
    app: '先把这份钱由谁说了算搞清楚',
    core: (s) => '说清这份钱由谁定，除了他还有谁肯为' + s + '出钱',
    first: (s) => '先把现在这份钱由谁定、除了他还有谁肯为' + s + '出钱写下来'
  }
})

function val (f) { return (f && f.value != null) ? f.value : (typeof f === 'string' ? f : 'UNKNOWN') }
function trim (s) { return String(s == null ? '' : s).trim() }
function ensurePeriod (s) { const t = trim(s); if (!t) return ''; return /[。！？!?]$/.test(t) ? t : t + '。' }

/** Deterministic XSG nouns from the game thesis + pricing power. */
function nounsOf (gameThesis, pricingPower, profile) {
  const gt = gameThesis || {}
  const asset = (profile && profile.asset) || {}
  const skill = gt.skillNoun || SKILL_NOUN[asset.type] || SKILL_NOUN.ASSET_UNCLEAR
  const gtType = (typeof gt.gameType === 'string' && gt.gameType) ||
    val(gt.gameType) || 'UNKNOWN'
  const frame = GAME_FRAME[gtType] || GAME_FRAME.UNKNOWN
  const st = (pricingPower && pricingPower.switchType && (pricingPower.switchType.value || pricingPower.switchType)) || 'UNKNOWN'
  const voice = SWITCH_VOICE[st] || SWITCH_VOICE.UNKNOWN
  return { skill, frame, switchType: st, voice, gameType: gtType }
}

/**
 * §5 CARD01 — JUDGMENT (verdict). Real-life contradiction + non-obvious rule.
 * Occupation/game-specific (embeds payer + skill) → not swappable (§6).
 */
function card01 (wm, mismatch, n) {
  const stateText = primaryStateText(wm)
  const rule = MODEL_RULE[primaryState(wm)] || ''
  // payer act + the model the user still trusts + the skill reality never priced
  const head = '你习惯「' + stateText + '」'
  const mid = '，可' + n.frame.payer + n.frame.act
  const tail = '；想靠的' + n.skill + '，到今天没人直接买过'
  // verdict = real contradiction (their habit model vs the payer's rule) + the
  // unpriced skill; embeds payer + skill ⇒ not swappable (§6).
  return head + mid + tail + '。'
}

/** §7 CARD02 — POSITION, not essay. A label + one short explanation. */
function card02 (wm, mismatch, n) {
  const stateText = primaryStateText(wm)
  return '你现在只有一套判断在替你换钱：「' + stateText + '」。想靠的' + n.skill + '，还没有别的地方肯为它出钱。'
}

/** §9/§11/§12 CARD03 — THE REVEAL. The loop the user likely never said out loud. */
function card03 (wm, mismatch, n, gameThesis) {
  const state = primaryState(wm)
  const stateText = primaryStateText(wm)
  const cost = MODEL_RULE[state] || '第一条路每天都现结，你就一直没空去摆第二条'
  const tl = (gameThesis && gameThesis.trap && gameThesis.trap.text) || ''
  const steps = [
    stateText,
    n.frame.payer + n.frame.act + '，先把时间交给它最稳',
    '没去碰另一条路，也就没出错，看着还挺稳当',
    '于是那条想靠的' + n.skill + '，一次都没被拿去试'
  ]
  // Memorable, rule-level conclusion (§11). One "不是A，是B" — used ONCE.
  // Embeds payer + skill so it is NOT swappable across occupations (§23).
  const rule = '你不是没有第二条路，是' + n.frame.payer + '这条路每天都能现结，你手里的' + n.skill + '就一直没空摆上去。'
  return { steps, rule }
}

/** §12/§13/§14 CARD04 — what changes (+ quotable world rule). */
function card04 (wm, mismatch, n) {
  const stateText = primaryStateText(wm)
  return {
    from: stateText,
    to: n.voice.to(n.skill),
    rule: n.voice.rule + '（应用：' + n.voice.app + '）',
    app: n.voice.app
  }
}

/** §15/§16/§17 CARD05 — ONE decisive reality test (no business-plan voice). */
function card05 (wm, mismatch, n, gameThesis) {
  const state = primaryState(wm)
  const stateText = primaryStateText(wm)
  const up = wm && wm.reportableUpgrade
  const newModel = (up && up.toText) || ''
  const cost = MODEL_RULE[state] || ''
  // The test IS about the model: "beyond「<old model>」, <the one concrete ask>."
  const goal = '接下来只验证一件事：“除了「' + stateText + '」这套，' + n.voice.core(n.skill) + '。”'
  const actions = [
    n.voice.first(n.skill),
    '动手前先写下你的判断和把握，做完再对一次结果',
    cost ? ('如果又出现「' + cost + '」，就说明该换成「' + newModel + '」') : '把结果记下来，再决定要不要换'
  ]
  const acceptance = '有第二个人真的直接为' + n.skill + '出过一次钱，这步才算成立。'
  return { goal, actions, acceptance }
}

function primaryAxis (wm) { return (wm && wm.primaryAxis) || null }
function primaryState (wm) {
  const a = primaryAxis(wm)
  if (!a || !wm.axes || !wm.axes[a]) return 'UNKNOWN'
  return wm.axes[a].state
}
function primaryStateText (wm) {
  const a = primaryAxis(wm)
  if (!a || !wm.axes || !wm.axes[a]) return ''
  return wm.axes[a].stateText || ''
}

/**
 * Render the five XSG cards from the grounded thesis content.
 * @param {Object} input { worldModel, mismatch, gameThesis, pricingPower, profile }
 * @returns {{card01,card02,card03,card04,card05, meta}}
 */
function renderXsgCards (input) {
  const i = input || {}
  const wm = i.worldModel
  if (!wm || wm.isR86C !== true || !primaryAxis(wm)) return null
  const n = nounsOf(i.gameThesis, i.pricingPower, i.profile)
  const c1 = card01(wm, i.mismatch, n)
  const c2 = card02(wm, i.mismatch, n)
  const c3 = card03(wm, i.mismatch, n, i.gameThesis)
  const c4 = card04(wm, i.mismatch, n)
  const c5 = card05(wm, i.mismatch, n, i.gameThesis)
  return {
    card01: c1,
    card02: c2,
    card03: c3,
    card04: c4,
    card05: c5,
    meta: { axis: primaryAxis(wm), state: primaryState(wm), switchType: n.switchType, skill: n.skill, gameType: n.gameType, version: XSG_VOICE_VERSION }
  }
}

// ── quality helpers (deterministic; used by the screen + tests) ──────────────

/** §3 abstract-term count across visible text. */
function abstractTermCount (text) {
  const t = String(text || '')
  let n = 0
  for (const term of ABSTRACT_TERMS) { if (t.indexOf(term) !== -1) n++ }
  return n
}

/** §4 max ONE abstract term per visible SENTENCE. */
function maxAbstractPerSentence (texts) {
  let max = 0
  for (const t of texts) {
    const sents = String(t || '').split(/(?<=[。；！？!?])/).map((x) => x.trim()).filter(Boolean)
    for (const s of sents) max = Math.max(max, abstractTermCount(s))
  }
  return max
}

/** §20 template-rhythm occurrences across all visible text. */
function templateRhythmCount (texts) {
  let n = 0
  for (const t of texts) { const m = String(t || '').match(TEMPLATE_RHYTHM_PAT); n += m ? m.length : 0 }
  return n
}

/** §23 swap test: a core line that carries NO game/occupation noun is swappable. */
function gameNounsPresent (text, nouns) {
  const t = String(text || '')
  const parts = [nouns.skill].concat(Object.values(nouns.frame))
  return parts.some((p) => p && t.indexOf(p) !== -1)
}

function visibleTexts (cards) {
  const c = cards || {}
  const out = []
  if (c.card01) out.push(c.card01)
  if (c.card02) out.push(c.card02)
  if (c.card03) { if (Array.isArray(c.card03.steps)) out.push(c.card03.steps.join('；')); if (c.card03.rule) out.push(c.card03.rule) }
  if (c.card04) out.push([c.card04.from, c.card04.to, c.card04.rule].filter(Boolean).join('；'))
  if (c.card05) out.push([c.card05.goal, (c.card05.actions || []).join('；'), c.card05.acceptance].filter(Boolean).join('；'))
  return out.filter((x) => trim(x))
}

/** Aggregate XSG voice quality report for the FINAL visible five cards. */
function xsgQuality (cards) {
  const texts = visibleTexts(cards)
  const oneBlob = texts.join('\n')
  const nouns = { skill: '', frame: {} } // game-noun presence checked per-call in tests
  return {
    ABSTRACT_TERM_COUNT: abstractTermCount(oneBlob),
    MAX_ABSTRACT_PER_SENTENCE: maxAbstractPerSentence(texts),
    TEMPLATE_RHYTHM_COUNT: templateRhythmCount(texts),
    PSYCHOLOGY_COUNT: (oneBlob.match(PSYCH_PAT) || []).length,
    TEXT_COUNT: texts.length,
    XSG_VOICE_VERSION: XSG_VOICE_VERSION
  }
}

module.exports = {
  XSG_VOICE_VERSION,
  ABSTRACT_TERMS,
  TEMPLATE_RHYTHM_PAT,
  PSYCH_PAT,
  GAME_FRAME,
  SKILL_NOUN,
  MODEL_RULE,
  SWITCH_VOICE,
  renderXsgCards,
  abstractTermCount,
  maxAbstractPerSentence,
  templateRhythmCount,
  gameNounsPresent,
  visibleTexts,
  xsgQuality,
  nounsOf
}
