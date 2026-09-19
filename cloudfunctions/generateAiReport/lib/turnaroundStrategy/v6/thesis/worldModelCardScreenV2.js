'use strict'
/**
 * turnaroundStrategy/v6/thesis/worldModelCardScreenV2.js
 *
 * RC8.4 V6 R86-E — COGNITIVE OS five-card screen (post-thesis, post-R85C3).
 * RC8.4 V6 R85-D — XSG JUDGMENT VOICE is the FINAL visible renderer.
 *
 * PURPOSE
 *   Make REPORTABLE_WORLD_MODEL + MODEL_REALITY_MISMATCH the TRUE semantic owner
 *   of the FINAL visible five cards, and render that grounding in 珠澳小事哥-style
 *   JUDGMENT / 拆局 language (concrete · short · sharp · rule-based · reality-first).
 *
 *   Card01 = MODEL↔REALITY COLLISION         (verdict, game-specific)
 *   Card02 = DEFAULT_MODEL / HOW_IT_INTERPRETS (position label + one line)
 *   Card03 = THE REVEAL: MODEL → REWARD → CONFIRMATION → REINFORCEMENT → COST
 *   Card04 = OLD_MODEL → NEW_MODEL (+ REALITY_APPLICATION) + quotable world rule
 *   Card05 = ONE decisive reality test (goal + steps + acceptance)
 *
 * GATE: acts ONLY for a genuine R86 submission with a REPORTABLE axis
 *   (`worldModel.isR86C === true`). Legacy / frozen fixtures are returned
 *   BYTE-IDENTICAL with all counters at zero (keeps R84/R85 suites untouched).
 *
 * Deterministic only. No I/O. No AI. No network.
 */

const S = require('./cognitiveOsCardSchemaV2.js')
const XSG = require('./xsgJudgmentVoiceV1.js')

function textOf (v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.join('')
  if (typeof v === 'object') return [v.from, v.to, v.rule, v.goal, v.acceptance, v.text].filter(Boolean).join('') + (Array.isArray(v.steps) ? v.steps.join('') : '') + (Array.isArray(v.actions) ? v.actions.map((a) => (typeof a === 'string' ? a : (a && a.text) || '')).join('') : '')
  return String(v)
}

/**
 * @param {Object} cmp compressed visible cards
 * @param {Object} worldModel worldModelV1 output (with primaryAxis applied)
 * @param {Object} mismatch modelRealityMismatchV6 output
 * @param {Object} deps { pricingPower, gameThesis, profile }
 * @returns {{cards, counts, repaired, trace, authorityShare}}
 */
function screenWorldModelCardsV2 (cmp, worldModel, mismatch, deps) {
  const c = Object.assign({}, cmp || {})
  const d = deps || {}
  const counts = {
    CARD01_MODEL_SIGNAL_MISSING_COUNT: 0,
    CARD02_LEAK_TOKEN_COUNT: 0,
    CARD03_WORLD_MODEL_LOOP_MISSING_COUNT: 0,
    CARD04_MODEL_UPGRADE_MISSING_COUNT: 0,
    CARD04_SWITCH_TYPE_COLLAPSE_COUNT: 0,
    CARD05_WORLD_MODEL_TEST_MISSING_COUNT: 0,
    CARD05_REALITY_TEST_FALSE_POSITIVE_COUNT: 0,
    UNSUPPORTED_PSYCHOLOGY_COUNT: 0,
    UNAUTHORIZED_PRODUCER_SLOT_COUNT: 0,
    UNKNOWN_AS_USER_IDENTITY_COUNT: 0,
    MIXED_AS_USER_IDENTITY_COUNT: 0,
    TOP_VISIBLE_OWNER: 'NONE'
  }
  const repaired = { card01: 0, card02: 0, card03: 0, card04: 0, card05: 0 }

  const wm = worldModel
  const active = !!(wm && wm.isR86C === true)

  if (!active) {
    counts.CARD04_MODEL_UPGRADE_DOMINANT = 'NO'
    counts.CARD05_WORLD_MODEL_TEST_DOMINANT = 'NO'
    counts.CARD03_WORLD_MODEL_LOOP_PRESENT = 'NO'
    counts.CARD01_MODEL_SIGNAL_PRESENT = 'NO'
    return { cards: c, counts: counts, repaired: repaired, trace: [], authorityShare: null }
  }

  // §4 — NO_REPORTABLE_AXIS: honest, model-dominant, NO identity substitution.
  const ready = wm.worldModelReady === true
  if (!ready) {
    counts.READINESS_CLASS = 'NO_REPORTABLE_AXIS'
    counts.CARD04_MODEL_UPGRADE_DOMINANT = 'NO'
    counts.CARD05_WORLD_MODEL_TEST_DOMINANT = 'NO'
    counts.CARD03_WORLD_MODEL_LOOP_PRESENT = 'NO'
    counts.CARD01_MODEL_SIGNAL_PRESENT = 'NO'
    if (S.LEAK_TOKENS.test(textOf(c.card02))) { c.card02 = '现在这些回答还不足以确认你稳定的判断方式。'; counts.CARD02_LEAK_TOKEN_COUNT++; repaired.card02++ }
    if (c.card04 && S.LEAK_TOKENS.test(textOf(c.card04))) {
      const cleanStr = (v) => (typeof v === 'string' && S.LEAK_TOKENS.test(v)) ? v.replace(/还看不清|你的模型是未知|未知模型|MIXED/g, '') : v
      c.card04 = Object.assign({}, c.card04, { from: cleanStr(c.card04.from), to: cleanStr(c.card04.to), rule: cleanStr(c.card04.rule) })
      repaired.card04++
    }
    const blob = [c.card02, textOf(c.card04)].join(' ')
    if (/还看不清/.test(blob)) counts.UNKNOWN_AS_USER_IDENTITY_COUNT++
    if (/MIXED|你的模型是/.test(blob)) counts.MIXED_AS_USER_IDENTITY_COUNT++
    return { cards: c, counts: counts, repaired: repaired, trace: [], authorityShare: null }
  }

  counts.READINESS_CLASS = 'PRIMARY_AXIS'

  // ── R85-D — XSG JUDGMENT VOICE renders the FINAL visible five cards. It is a
  // pure deterministic function of the grounded (world-model + game) thesis:
  // no new facts, no model change, no extra call. Producers/slots stay exactly
  // those of the R86-E schema (structure unchanged; only the TEXT is XSG). ─────
  const v = XSG.renderXsgCards({
    worldModel: wm,
    mismatch: mismatch,
    gameThesis: d.gameThesis,
    pricingPower: d.pricingPower,
    profile: d.profile
  })

  // Structural slots (producer/authority/evidence) — text approximated from the
  // FINAL XSG text so the trace + authority share reflect what actually ships.
  c._slots = c._slots || {}
  const axis = wm.primaryAxis
  const ax = wm.axes[axis]
  const c1 = S.card01Slots(wm, mismatch, v)
  const c2 = S.card02DefaultModel(wm, v)
  const c3slots = S.card03Slots(wm, v)
  const c4slots = S.card04Slots(wm, mismatch, d.pricingPower, v)
  const c5slots = S.card05Slots(wm, v)

  // ── Card01 = MODEL↔REALITY COLLISION (verdict) ────────────────────────────
  if (v) { c.card01 = v.card01; repaired.card01++ }
  else if (c1) { c.card01 = c1.text; repaired.card01++ }
  counts.CARD01_MODEL_SIGNAL_PRESENT = S.card01ModelSignalPresent(String(c.card01)) ? 'YES' : 'NO'
  if (counts.CARD01_MODEL_SIGNAL_PRESENT === 'NO') counts.CARD01_MODEL_SIGNAL_MISSING_COUNT++
  if (c1) c._slots.card01 = { COLLISION: S.slot(String(c.card01), S.PRODUCER.WORLD_MODEL, 'OBSERVED', true, ax.primaryEvidence), REALITY_EVIDENCE: c1.REALITY_EVIDENCE }

  // ── Card02 = DEFAULT_MODEL (reportable axis only) ─────────────────────────
  if (v) { c.card02 = v.card02; repaired.card02++ }
  else if (c2) { c.card02 = c2.text; repaired.card02++ }
  if (S.LEAK_TOKENS.test(String(c.card02 || ''))) counts.CARD02_LEAK_TOKEN_COUNT = 1
  if (c2) c._slots.card02 = {
    DEFAULT_MODEL: S.slot(String(c.card02), S.PRODUCER.WORLD_MODEL, 'OBSERVED', true, ax.primaryEvidence),
    HOW_IT_INTERPRETS: S.slot(ax.stateText, S.PRODUCER.WORLD_MODEL, 'OBSERVED', true, ax.primaryEvidence)
  }

  // ── Card03 = REINFORCEMENT MECHANISM (P0) ─────────────────────────────────
  if (v) c.card03 = { steps: v.card03.steps.slice(0, 4), rule: v.card03.rule }
  else if (c3slots) {
    const steps = S.renderSteps(c3slots, ['MODEL', 'SHORT_TERM_REWARD', 'APPARENT_CONFIRMATION', 'REINFORCEMENT', 'LONG_TERM_COST'])
    c.card03 = { steps: steps.slice(0, 4), rule: steps[4] || c3slots.LONG_TERM_COST.text || '' }
  }
  repaired.card03++
  counts.CARD03_WORLD_MODEL_LOOP_PRESENT = (String(textOf(c.card03)).indexOf(ax.stateText) !== -1) ? 'YES' : 'NO'
  if (counts.CARD03_WORLD_MODEL_LOOP_PRESENT === 'NO') counts.CARD03_WORLD_MODEL_LOOP_MISSING_COUNT++
  if (c3slots) c._slots.card03 = c3slots

  // ── Card04 = OLD_MODEL → NEW_MODEL (upgrade ≥60%) ─────────────────────────
  if (v) c.card04 = { from: v.card04.from, to: v.card04.to, rule: v.card04.rule }
  else if (c4slots) c.card04 = { from: c4slots.OLD_MODEL.text, to: c4slots.NEW_MODEL.text, rule: (c4slots.NEW_MODEL.text || '') + (c4slots.REALITY_APPLICATION.supported ? '（应用：' + c4slots.REALITY_APPLICATION.text + '）' : '') }
  repaired.card04 = 1
  if (c4slots) {
    c._slots.card04 = c4slots
    let wmUnits = 0; let legacyUnits = 0
    for (const k of ['OLD_MODEL', 'NEW_MODEL']) if (c4slots[k].supported && c4slots[k].text.trim()) wmUnits++
    if (c4slots.REALITY_APPLICATION.supported && c4slots.REALITY_APPLICATION.text.trim()) legacyUnits++
    const tot = wmUnits + legacyUnits || 1
    counts.CARD04_MODEL_UPGRADE_SHARE = Math.round((wmUnits / tot) * 100) / 100
    counts.CARD04_REAL_WORLD_APPLICATION_SHARE = Math.round((legacyUnits / tot) * 100) / 100
    counts.CARD04_MODEL_UPGRADE_DOMINANT = (counts.CARD04_MODEL_UPGRADE_SHARE >= 0.6) ? 'YES' : 'NO'
  } else {
    counts.CARD04_MODEL_UPGRADE_DOMINANT = 'NO'
  }

  // ── Card05 = ONE decisive WORLD-MODEL REALITY TEST ────────────────────────
  if (v) c.card05 = { goal: v.card05.goal, actions: v.card05.actions.slice(0, 3), acceptance: v.card05.acceptance }
  else if (c5slots) {
    const steps = S.renderSteps(c5slots, ['REALITY_TEST', 'OBSERVE', 'UPDATE_RULE'])
    c.card05 = { goal: c5slots.HYPOTHESIS.text, actions: steps.slice(0, 3), acceptance: c5slots.OBSERVE.text }
  }
  repaired.card05 = 1
  if (c5slots) {
    c._slots.card05 = c5slots
    counts.CARD05_WORLD_MODEL_TEST_DOMINANT = ((c.card05.actions || []).length >= 2) ? 'YES' : 'NO'
    counts.CARD05_REALITY_TEST_FALSE_POSITIVE_COUNT = /90\s*天|第一笔付费|定交付|找买家|跑一次|真实付费验证|副业|变现/.test(textOf(c.card05)) ? 1 : 0
    counts.CARD05_GENERIC_BUSINESS_VOCAB = /买家|客户|报价|成交|变现|付费|副业|90\s*天|独立付款人/.test(textOf(c.card05)) ? 'YES' : 'NO'
  } else {
    counts.CARD05_WORLD_MODEL_TEST_DOMINANT = 'NO'
  }

  // ── §19/§20 — producer authority check over structured slots ──────────────
  const trace = S.buildTrace(c._slots)
  for (const t of trace) {
    if (!S.slotAuthorized(t.card.toUpperCase() + '.' + t.slot, t.producer)) counts.UNAUTHORIZED_PRODUCER_SLOT_COUNT++
  }

  // ── §22 — unsupported psychology on FINAL visible text ────────────────────
  const finals = [c.card01, c.card02, textOf(c.card03), textOf(c.card04), textOf(c.card05)]
  counts.UNSUPPORTED_PSYCHOLOGY_COUNT = S.countVisiblePsychology(finals, { selfBelief: wm.selfBelief })

  // ── §4 — UNKNOWN/MIXED as user identity = 0 ───────────────────────────────
  const identityBlob = [c.card02, textOf(c.card04)].join(' ')
  if (/还看不清/.test(identityBlob)) counts.UNKNOWN_AS_USER_IDENTITY_COUNT++
  if (/MIXED|你的模型是/.test(identityBlob)) counts.MIXED_AS_USER_IDENTITY_COUNT++

  // ── §2 — single top visible authority ─────────────────────────────────────
  counts.TOP_VISIBLE_OWNER = 'REPORTABLE_WORLD_MODEL'

  // ── R85-D §3/§20/§23 — XSG voice quality on the FINAL visible five cards ───
  const q = XSG.xsgQuality({ card01: c.card01, card02: c.card02, card03: c.card03, card04: c.card04, card05: c.card05 })
  const nouns = XSG.nounsOf(d.gameThesis, d.pricingPower, d.profile)
  counts.ABSTRACT_TERM_COUNT = q.ABSTRACT_TERM_COUNT
  counts.MAX_ABSTRACT_PER_SENTENCE = q.MAX_ABSTRACT_PER_SENTENCE
  counts.TEMPLATE_RHYTHM_COUNT = q.TEMPLATE_RHYTHM_COUNT
  counts.CARD01_SWAP_FAILURE_COUNT = XSG.gameNounsPresent(String(c.card01), nouns) ? 0 : 1
  counts.CARD03_SWAP_FAILURE_COUNT = XSG.gameNounsPresent(textOf(c.card03), nouns) ? 0 : 1
  counts.CARD01_IMPACT = (String(c.card01).length <= 62 && XSG.gameNounsPresent(String(c.card01), nouns)) ? 'PASS' : 'FAIL'
  counts.CARD03_REVEAL = (!!(c.card03 && c.card03.rule) && XSG.gameNounsPresent(textOf(c.card03), nouns)) ? 'PASS' : 'FAIL'
  counts.CARD04_RULE_COMPRESSION = (!!(c.card04 && c.card04.rule)) ? 'PASS' : 'FAIL'
  counts.CARD05_REALITY_TEST = (!!(c.card05 && c.card05.goal) && (c.card05.actions || []).length >= 1 && !!c.card05.acceptance) ? 'PASS' : 'FAIL'
  counts.CARD01_JUDGMENT_PRESENT = (XSG.gameNounsPresent(String(c.card01), nouns) && S.card01ModelSignalPresent(String(c.card01))) ? 'YES' : 'NO'

  const share = S.authorityShare(c._slots)

  return { cards: c, counts: counts, repaired: repaired, trace: trace, authorityShare: share }
}

module.exports = { screenWorldModelCardsV2 }
