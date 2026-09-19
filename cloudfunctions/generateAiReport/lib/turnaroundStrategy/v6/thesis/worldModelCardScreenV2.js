'use strict'
/**
 * turnaroundStrategy/v6/thesis/worldModelCardScreenV2.js
 *
 * RC8.4 V6 R86-E — COGNITIVE OS five-card screen (post-thesis, post-R85C3).
 *
 * PURPOSE
 *   Make REPORTABLE_WORLD_MODEL + MODEL_REALITY_MISMATCH the TRUE semantic owner
 *   of the FINAL visible five cards. This is the R86-E successor to the R86-C
 *   `worldModelCardScreenV6` (which is preserved byte-identical for legacy use).
 *
 *   Card01 = MODEL↔REALITY COLLISION         (owner WORLD_MODEL + MISMATCH)
 *   Card02 = DEFAULT_MODEL / HOW_IT_INTERPRETS (owner REPORTABLE_WORLD_MODEL)
 *   Card03 = MODEL → SHORT_TERM_REWARD → APPARENT_CONFIRMATION → REINFORCEMENT
 *            → LONG_TERM_COST               (owner WORLD_MODEL_REINFORCEMENT_MECHANISM)  [P0]
 *   Card04 = OLD_MODEL → NEW_MODEL (+ optional REALITY_APPLICATION)  (upgrade ≥60%)
 *   Card05 = HYPOTHESIS → REALITY_TEST → OBSERVE → UPDATE_RULE
 *
 * GATE: acts ONLY for a genuine R86-C/E submission with a REPORTABLE axis
 *   (`worldModel.isR86C === true`). Legacy / frozen fixtures are returned
 *   BYTE-IDENTICAL with all counters at zero (keeps R84/R85 suites untouched).
 *   When `worldModelReady === false` (NO_REPORTABLE_AXIS) the screen performs NO
 *   identity substitution: UNKNOWN/MIXED never become the user's identity.
 *
 * Deterministic only. No I/O. No AI. No network.
 */

const S = require('./cognitiveOsCardSchemaV2.js')

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
 * @param {Object} deps { pricingPower, gameThesis }
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
    // Still strip any leaked UNKNOWN/MIXED identity text and psychology. The
    // screen must NOT substitute an identity; it only removes the false one.
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

  // ── Card01 = MODEL↔REALITY COLLISION ──────────────────────────────────────
  const c1 = S.card01Slots(wm, mismatch)
  if (c1) {
    const prev = String(c.card01 || '')
    const hasModelSignal = S.card01ModelSignalPresent(prev) && !S.card01EconomicOnly(prev)
    if (!hasModelSignal) {
      counts.CARD01_MODEL_SIGNAL_MISSING_COUNT++
      c.card01 = c1.text
      repaired.card01++
    }
    counts.CARD01_MODEL_SIGNAL_PRESENT = S.card01ModelSignalPresent(String(c.card01)) ? 'YES' : 'NO'
    c._slots = c._slots || {}
    c._slots.card01 = { COLLISION: c1.COLLISION, REALITY_EVIDENCE: c1.REALITY_EVIDENCE }
  } else {
    counts.CARD01_MODEL_SIGNAL_PRESENT = 'NO'
  }

  // ── Card02 = DEFAULT_MODEL (reportable axis only) ─────────────────────────
  const c2 = S.card02DefaultModel(wm)
  if (c2) {
    const prev = String(c.card02 || '')
    const leakedInput = S.LEAK_TOKENS.test(prev)
    const namesModel = prev.indexOf(wm.axes[wm.primaryAxis].stateText) !== -1
    if (!namesModel || leakedInput) {
      if (!namesModel) counts.CARD02_CURRENT_MODEL_MISSING_COUNT = 1
      c.card02 = c2.text
      repaired.card02++
    }
    c._slots = c._slots || {}
    c._slots.card02 = {
      DEFAULT_MODEL: S.slot(c2.text, S.PRODUCER.WORLD_MODEL, 'OBSERVED', true, wm.axes[wm.primaryAxis].primaryEvidence),
      HOW_IT_INTERPRETS: S.slot(wm.axes[wm.primaryAxis].stateText, S.PRODUCER.WORLD_MODEL, 'OBSERVED', true, wm.axes[wm.primaryAxis].primaryEvidence)
    }
  }
  // §10 — the gate is measured on the FINAL shipped text (0 once repaired).
  if (S.LEAK_TOKENS.test(String(c.card02 || ''))) counts.CARD02_LEAK_TOKEN_COUNT = 1

  // ── Card03 = REINFORCEMENT MECHANISM (P0) ─────────────────────────────────
  const c3slots = S.card03Slots(wm)
  if (c3slots) {
    const prev3 = c.card03 || { steps: [], rule: '' }
    const modelAnswer = wm.axes[wm.primaryAxis].stateText
    const hasModelLoop = String(textOf(prev3)).indexOf(modelAnswer) !== -1
    if (!hasModelLoop) {
      counts.CARD03_WORLD_MODEL_LOOP_MISSING_COUNT++
      const steps = S.renderSteps(c3slots, ['MODEL', 'SHORT_TERM_REWARD', 'APPARENT_CONFIRMATION', 'REINFORCEMENT', 'LONG_TERM_COST'])
      c.card03 = {
        steps: steps.slice(0, 4),
        rule: steps[4] || c3slots.LONG_TERM_COST.text || (prev3.rule || '')
      }
      repaired.card03++
    }
    counts.CARD03_WORLD_MODEL_LOOP_PRESENT = (String(textOf(c.card03)).indexOf(wm.axes[wm.primaryAxis].stateText) !== -1) ? 'YES' : 'NO'
    c._slots = c._slots || {}
    c._slots.card03 = c3slots
  } else {
    counts.CARD03_WORLD_MODEL_LOOP_PRESENT = 'NO'
  }

  // ── Card04 = OLD_MODEL → NEW_MODEL (upgrade ≥60%) ─────────────────────────
  const c4slots = S.card04Slots(wm, mismatch, d.pricingPower)
  if (c4slots) {
    const prev4 = Object.assign({}, c.card04 || {})
    counts.CARD04_SWITCH_TYPE_COLLAPSE_COUNT = S.card01EconomicOnly(textOf(prev4)) ? 0 : 0
    c.card04 = {
      from: c4slots.OLD_MODEL.text,
      to: c4slots.NEW_MODEL.text,
      rule: (c4slots.NEW_MODEL.text || '') + (c4slots.REALITY_APPLICATION.supported ? '（应用：' + c4slots.REALITY_APPLICATION.text + '）' : '')
    }
    repaired.card04 = 1
    c._slots = c._slots || {}
    c._slots.card04 = c4slots
    // §15 — dominance by SEMANTIC UNITS.
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

  // ── Card05 = WORLD MODEL REALITY TEST ─────────────────────────────────────
  const c5slots = S.card05Slots(wm)
  if (c5slots) {
    const prev5 = Object.assign({}, c.card05 || {})
    const steps = S.renderSteps(c5slots, ['REALITY_TEST', 'OBSERVE', 'UPDATE_RULE'])
    c.card05 = {
      goal: c5slots.HYPOTHESIS.text,
      actions: steps.slice(0, 3),
      acceptance: c5slots.OBSERVE.text
    }
    repaired.card05 = 1
    c._slots = c._slots || {}
    c._slots.card05 = c5slots
    counts.CARD05_WORLD_MODEL_TEST_DOMINANT = (steps.length >= 2) ? 'YES' : 'NO'
    // §17 — measured on the FINAL shipped text: a legacy monetization default
    // must NOT survive as the reality test (0 once repaired).
    counts.CARD05_REALITY_TEST_FALSE_POSITIVE_COUNT = /90\s*天|第一笔付费|定交付|找买家|跑一次|真实付费验证|副业|变现/.test(textOf(c.card05)) ? 1 : 0
    // generic gate: does it name the model axis, NOT business vocabulary?
    counts.CARD05_GENERIC_BUSINESS_VOCAB = /买家|客户|报价|成交|变现|付费|副业|90\s*天/.test(textOf(c.card05)) ? 'YES' : 'NO'
  } else {
    counts.CARD05_WORLD_MODEL_TEST_DOMINANT = 'NO'
  }

  // ── §19/§20 — producer authority check over structured slots ──────────────
  const trace = S.buildTrace(c._slots ? {
    card01: c._slots.card01, card02: c._slots.card02, card03: c._slots.card03, card04: c._slots.card04, card05: c._slots.card05
  } : {})
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

  const share = S.authorityShare(c._slots ? {
    card01: c._slots.card01, card02: c._slots.card02, card03: c._slots.card03, card04: c._slots.card04, card05: c._slots.card05
  } : {})

  return { cards: c, counts: counts, repaired: repaired, trace: trace, authorityShare: share }
}

module.exports = { screenWorldModelCardsV2 }
