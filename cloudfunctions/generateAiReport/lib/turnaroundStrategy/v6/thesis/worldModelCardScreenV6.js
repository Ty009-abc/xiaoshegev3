'use strict'
/**
 * turnaroundStrategy/v6/thesis/worldModelCardScreenV6.js
 *
 * RC8.4 V6 R86-C — deterministic WORLD-MODEL card screen (post-thesis, post-R85C3).
 *
 * PURPOSE
 *   Enforce the R86-B1 five-card contract on the FINAL visible cards when a REAL
 *   R86-C World Model is present:
 *     Card01 = MODEL↔REALITY COLLISION       (counted; game/behavior shape kept)
 *     Card02 = CURRENT WORLD MODEL            (repair when only identity/no model)
 *     Card03 = REALITY REWARD/PUNISH LOOP      (repair when no short-term reward)
 *     Card04 = WORLD MODEL UPGRADE (primary)   (repair switch-type-only cards)
 *     Card05 = WORLD MODEL REALITY TEST (primary) (repair bet-only cards)
 *
 * GATE (critical): the screen only acts when the submission came through the
 *   R86-C questionnaire (all three NEW world-model fields answered). Legacy /
 *   frozen fixtures (which never answer them) are returned BYTE-IDENTICAL with
 *   all counters at zero — this is what keeps the R84/R85 regression suites
 *   untouched.
 *
 * FROZEN: MODEL_UPGRADE_SWITCH_TYPE_COLLAPSE = NO · REALITY_TEST_GAME_BET_COLLAPSE = NO.
 * Deterministic only. No I/O. No AI. No network.
 */

const MODEL_VOCAB = /价值|模型|判断|解释|方式|标准|看法|理解|习惯/
const CHANGE_CUE = /→|从|换成|改成|变成|不再|重新|可以|而是|不是/
const SWITCH_VOCAB = /换局|换赛道|换客户|加一条|再加一条|多一条收入|重新定价|自己定价|换一个局/
const REALITY_TEST_VOCAB = /能看出|说明|验证|判断.*(是不是|是否)|是不是更|对照|记下|写下|预测|停下来|先分开|先分清|先说清|画一画|画一下|分清|测一测|看看.*(比|是不是)/
const GAME_BET_VOCAB = /下一注|最小下注|第一笔|报价|找买家|卖出去|成交|签下|付费用户/
const REWARD_VOCAB = /短期|奖励|感觉|越.*越|好评|涨薪|晋升|成就感|被认可|安心|安全感/
const IDENTITY_ONLY = /^(你是一?个|你是那种|你现在是)/

function textOf (v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.join('')
  if (typeof v === 'object') return [v.from, v.to, v.rule, v.goal, v.acceptance, v.text].filter(Boolean).join('') + (Array.isArray(v.actions) ? v.actions.map((a) => (typeof a === 'string' ? a : (a && a.text) || '')).join('') : '')
  return String(v)
}

function card04ExpressesModelUpgrade (card04) {
  const t = textOf(card04)
  return MODEL_VOCAB.test(t) && CHANGE_CUE.test(t)
}
function card04IsSwitchOnly (card04) {
  const t = textOf(card04)
  return SWITCH_VOCAB.test(t) && !MODEL_VOCAB.test(t)
}
function card05IsRealityTest (goal, card05) {
  const t = String(goal || '') + ' ' + textOf(card05)
  return REALITY_TEST_VOCAB.test(t)
}
function card05IsBetOnly (goal, card05) {
  const t = String(goal || '') + ' ' + textOf(card05)
  return GAME_BET_VOCAB.test(t) && !REALITY_TEST_VOCAB.test(t)
}
function card02NamesModel (card02, axisStateText) {
  const t = String(card02 || '')
  if (!t.trim()) return false
  if (axisStateText && t.indexOf(axisStateText) !== -1) return true
  return MODEL_VOCAB.test(t)
}
function card03ShowsReward (card03) {
  return REWARD_VOCAB.test(textOf(card03))
}

/**
 * @param {Object} cmp compressed visible cards {card01,card02,card03:{steps,rule},card04:{from,to,rule},card05:{goal,actions,acceptance}}
 * @param {Object} worldModel worldModelV1 output
 * @param {Object} mismatch modelRealityMismatchV6 output
 * @param {Object} gameThesis gameThesisV6 output (optional; card01 reality half)
 * @returns {{cards, counts, repaired}}
 */
function screenWorldModelCards (cmp, worldModel, mismatch, gameThesis) {
  const c = Object.assign({}, cmp || {})
  const counts = {
    CARD02_CURRENT_MODEL_MISSING_COUNT: 0,
    CARD03_REWARD_LOOP_MISSING_COUNT: 0,
    CARD04_MODEL_UPGRADE_MISSING_COUNT: 0,
    CARD04_SWITCH_TYPE_COLLAPSE_COUNT: 0,
    CARD05_REALITY_TEST_MISSING_COUNT: 0,
    CARD05_GAME_BET_COLLAPSE_COUNT: 0,
    REALITY_TO_WORLD_MODEL_DIRECT_AUTHORITY_COUNT: 0
  }
  const repaired = { card02Model: 0, card03Reward: 0, card04ModelUpgrade: 0, card05RealityTest: 0 }

  // ── GATE: only a genuine R86-C submission (three world-model fields answered) ──
  if (!worldModel || !worldModel.isR86C || !worldModel.upgrade) {
    counts.MODEL_UPGRADE_SWITCH_TYPE_COLLAPSE = 'NO'
    counts.REALITY_TEST_GAME_BET_COLLAPSE = 'NO'
    return { cards: c, counts: counts, repaired: repaired }
  }
  const up = worldModel.upgrade

  // ── Card02 = CURRENT WORLD MODEL ──
  const axisText = up.fromText || null
  if (c.card02 && !card02NamesModel(c.card02, axisText) && IDENTITY_ONLY.test(String(c.card02).trim())) {
    counts.CARD02_CURRENT_MODEL_MISSING_COUNT++
    c.card02 = '你通常用「' + String(axisText || '现在这套方式') + '」来理解这类问题。'
    repaired.card02Model++
  } else if (c.card02 && !card02NamesModel(c.card02, axisText)) {
    // identity-flavored but not obviously a pure identity label → count only
    counts.CARD02_CURRENT_MODEL_MISSING_COUNT++
  }

  // ── Card03 = REWARD / PUNISHMENT LOOP (must show a short-term reward) ──
  if (c.card03 && !card03ShowsReward(c.card03)) {
    counts.CARD03_REWARD_LOOP_MISSING_COUNT++
    const steps = (c.card03.steps || []).slice(0, 3)
    steps.push('这套办法在短期内是「有回报的」，所以它会一直重复下去。')
    c.card03 = Object.assign({}, c.card03, { steps: steps.slice(0, 4) })
    repaired.card03Reward++
  }

  // ── Card04 = WORLD MODEL UPGRADE (primary) ──
  const c4 = Object.assign({}, c.card04 || {})
  const upgradeLine = String(up.fromText || '现在的模型') + ' → ' + String(up.toText || up.toState || '')
  if (card04IsSwitchOnly(c4)) counts.CARD04_SWITCH_TYPE_COLLAPSE_COUNT++
  if (up.needsModelUpgrade && !card04ExpressesModelUpgrade(c4)) {
    counts.CARD04_MODEL_UPGRADE_MISSING_COUNT++
    c4.rule = upgradeLine
    if (!c4.to) c4.to = String(up.toText || up.toState || '')
    repaired.card04ModelUpgrade++
  }
  c.card04 = c4

  // ── Card05 = WORLD MODEL REALITY TEST (primary) ──
  const c5 = Object.assign({}, c.card05 || {})
  if (card05IsBetOnly(c5.goal, c5)) counts.CARD05_GAME_BET_COLLAPSE_COUNT++
  if (!card05IsRealityTest(c5.goal, c5) && up.realityTest) {
    counts.CARD05_REALITY_TEST_MISSING_COUNT++
    c5.goal = up.realityTest + ' 这样能看出：新模型是不是比旧模型更贴合现实。'
    repaired.card05RealityTest++
  }
  c.card05 = c5

  // FINAL shipped-card invariants (measured POST-repair): neither card collapses.
  counts.MODEL_UPGRADE_SWITCH_TYPE_COLLAPSE = card04IsSwitchOnly(c.card04) ? 'YES' : 'NO'
  counts.REALITY_TEST_GAME_BET_COLLAPSE = card05IsBetOnly(c.card05.goal, c.card05) ? 'YES' : 'NO'
  return { cards: c, counts: counts, repaired: repaired }
}

module.exports = {
  screenWorldModelCards,
  card04ExpressesModelUpgrade,
  card04IsSwitchOnly,
  card05IsRealityTest,
  card05IsBetOnly,
  card02NamesModel,
  card03ShowsReward
}
