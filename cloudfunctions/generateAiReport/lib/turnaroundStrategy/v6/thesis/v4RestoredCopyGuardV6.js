'use strict'
/**
 * turnaroundStrategy/v6/thesis/v4RestoredCopyGuardV6.js
 *
 * RC8.4 V6 R84-A §13/§16/§21 — DETERMINISTIC, DEFECT-ONLY copy guard.
 *
 * This is NOT a second AI validator and NOT broad style/lexical policing. It is
 * a small, deterministic check + SAFE REPAIR layer that runs AFTER thesis
 * formation and AFTER deterministic compression, on the user-visible five cards
 * ONLY. It targets exactly five clear defects (R84-A §21):
 *
 *   CARD05_90DAY_HORIZON_CONFLICT_COUNT        "90天目标" text carrying a
 *                                              contradictory horizon (12个月…)
 *   UNSUPPORTED_EXACT_PRICE_COUNT              an invented exact price range /
 *                                              figure inside a card05 action
 *   CARD04_FROM_TO_MISSING_COUNT               card04 missing FROM or TO
 *   CARD05_VALIDATION_STANDARD_MISSING_COUNT   card05 missing a validation standard
 *   CARD03_DUPLICATE_CONCLUSION_COUNT          card03 rule restates a mechanism step
 *
 * REPAIR is strictly text-preserving: it rewrites a horizon phrase, replaces a
 * precise-ish price with a generic price instruction, falls back to the thesis
 * migration, or drops a duplicated conclusion. It NEVER invents a new claim,
 * never adds facts, never touches strategicThesis.
 *
 * MODEL CALLS = 0. Pure. No I/O. No AI.
 */

const { charLen, fitTextTo, BUDGET } = require('./v4RestoredCompressV6.js')

// ── §13 — contradictory horizons for a 90-day card ──
const HORIZON_CONFLICT_PAT = /(12\s*个?月|十二\s*个?月|一年\s*(内|之内|内完成)?|1\s*年|两年|2\s*年|三年|3\s*年|半年内?完成?|12\s*month)/g
// Non-global twin for stateless .test() checks (a /g regex with .test() carries
// lastIndex state across calls — never use the global one for a boolean probe).
const HORIZON_CONFLICT_TEST = /(12\s*个?月|十二\s*个?月|一年\s*(内|之内|内完成)?|1\s*年|两年|2\s*年|三年|3\s*年|半年内?完成?|12\s*month)/
// Safe rewrite target (the card is explicitly a 90-day card).
const HORIZON_REWRITE = '90 天'

// ── §16 — invented exact price (range or standalone figure) ──
// A range: 500–2000元 / 500-2000 / 500到2000元
const PRICE_RANGE_PAT = /(\d{2,6})\s*(?:[-–—~至到]|起)\s*(\d{2,6})\s*(?:元|块|万)?/g
// A standalone price-ish figure: 1999元 / 9999 / 一块 299
const PRICE_SINGLE_PAT = /(\d{3,6})\s*(?:元|块|万)/g
// Context that means the number is a legitimate TRIAL BUDGET / cost constraint,
// NOT an invented product price — such figures are allowed to remain.
const BUDGET_CONTEXT = /(试错|预算|承受|成本|结余|存款|储蓄|负债|月供|开支|支出)/

// ── §12 — standalone generic actions (only banned when NOT tied to observable
// behavior). Deterministic guard flags ones that appear as a WHOLE action text.
const GENERIC_ACTION_EXACT = /^(多学习|坚持|提升认知|做好规划|多尝试|寻找机会|努力学习|多读书)[。.!！]?$/

function oneLine (s) { return String(s == null ? '' : s).replace(/\s+/g, '') }
const DANGLING_END = /[，,、；;→>]\s*$/

/** Split into punctuation/arrow delimited PHRASES (delimiters kept). */
function phrases (t) {
  return String(t || '').split(/(?<=[→>，,；;、。！？!?])/).map((s) => s.trim()).filter(Boolean)
}
function core (s) { return oneLine(s).replace(/[。，,；;、！？!?→>「」『』"'“”]/g, '') }

/**
 * §8 — a duplicated conclusion is a clear defect only when the conclusion
 * REPEATS the mechanism:
 *   (a) it contains a mechanism step (or vice versa) as a substantial phrase, OR
 *   (b) it re-lists the loop as an arrow chain (>=2 arrows) that overlaps >=2
 *       step phrases.
 * A genuinely ELEVATED conclusion (a principle, no arrow chain, no step
 * restatement) never triggers — no broad lexical policing.
 */
function isDuplicateConclusion (rule, steps) {
  const r = oneLine(rule)
  if (!r) return false
  const list = Array.isArray(steps) ? steps : []
  // (a) substantial verbatim phrase containment
  for (const st of list) {
    const n = core(st)
    if (n.length >= 6 && (core(r).includes(n) || n.includes(core(r)))) return true
  }
  // (b) arrow-chain re-listing the same steps
  const arrowCount = (String(rule).match(/[→>]/g) || []).length
  if (arrowCount >= 2) {
    let matched = 0
    for (const p of phrases(rule)) {
      const c = core(p)
      if (c.length < 3) continue
      if (list.some((st) => { const n = core(st); return n && (n.includes(c) || c.includes(n)) })) matched++
    }
    if (matched >= 2) return true
  }
  return false
}

/** A conclusion text is a §8 defect if it restates the mechanism or is broken. */
function isBadConclusion (rule, steps) {
  const r = String(rule || '')
  if (!oneLine(r)) return false
  if ((r.match(/[→>]/g) || []).length >= 2) return true // re-lists the loop
  if (DANGLING_END.test(r)) return true // truncated mid-chain
  return isDuplicateConclusion(r, steps)
}

/**
 * §8 — the ONE-LEVEL-UP conclusion. Prefer the thesis's own elevation: the last
 * sentence of systemTrap, which is a principle (no arrow chain, 6–64 chars).
 * Text-preserving: read from the thesis, never invented.
 */
function elevatedConclusion (thesis) {
  const trap = String((thesis || {}).systemTrap || '')
  const sents = trap.split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean)
  for (let i = sents.length - 1; i >= 0; i--) {
    const s = sents[i]
    if ((s.match(/[→>]/g) || []).length === 0 && charLen(s) >= 6 && charLen(s) <= 64) return s
  }
  return ''
}

/** Count exact, unsupported price figures inside a block of text. */
function countUnsupportedPrices (text) {
  const t = String(text || '')
  let n = 0
  let m
  PRICE_RANGE_PAT.lastIndex = 0
  while ((m = PRICE_RANGE_PAT.exec(t)) !== null) {
    const before = t.slice(Math.max(0, m.index - 8), m.index)
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 8)
    if (BUDGET_CONTEXT.test(before) || BUDGET_CONTEXT.test(after)) continue
    n++
  }
  PRICE_SINGLE_PAT.lastIndex = 0
  while ((m = PRICE_SINGLE_PAT.exec(t)) !== null) {
    const before = t.slice(Math.max(0, m.index - 8), m.index)
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 8)
    if (BUDGET_CONTEXT.test(before) || BUDGET_CONTEXT.test(after)) continue
    // a range member already counted above would be caught by the single pat too;
    // avoid double counting by skipping when adjacent to a range separator.
    const prev = t.slice(Math.max(0, m.index - 1), m.index)
    const next = t.slice(m.index + m[0].length, m.index + m[0].length + 1)
    if (/[-–—~至到]/.test(prev) || /[-–—~至到]/.test(next)) continue
    n++
  }
  return n
}

/** Replace invented exact prices with a generic price instruction. */
function neutralizePrices (text) {
  let t = String(text || '')
  t = t.replace(PRICE_RANGE_PAT, (full, a, b, off, s) => {
    const before = s.slice(Math.max(0, off - 8), off)
    const after = s.slice(off + full.length, off + full.length + 8)
    if (BUDGET_CONTEXT.test(before) || BUDGET_CONTEXT.test(after)) return full
    return '一个真实价格'
  })
  t = t.replace(PRICE_SINGLE_PAT, (full, a, off, s) => {
    const before = s.slice(Math.max(0, off - 8), off)
    const after = s.slice(off + full.length, off + full.length + 8)
    if (BUDGET_CONTEXT.test(before) || BUDGET_CONTEXT.test(after)) return full
    const prev = s.slice(Math.max(0, off - 1), off)
    const next = s.slice(off + full.length, off + full.length + 1)
    if (/[-–—~至到]/.test(prev) || /[-–—~至到]/.test(next)) return full
    return '一个真实价格'
  })
  return t
}

/** Replace a contradictory horizon with the card's real 90-day horizon. */
function neutralizeHorizon (text) {
  return String(text || '').replace(HORIZON_CONFLICT_PAT, HORIZON_REWRITE)
}

/**
 * Run the guard on the COMPRESSED visible cards.
 *
 * @param {Object} cmp   output of compressVisibleCards()
 * @param {Object} thesis strategicThesis (for FROM/TO fallback only)
 * @returns {{cmp:Object, counts:Object, repaired:Object}}
 */
function guardVisibleCards (cmp, thesis) {
  const c = cmp || {}
  const st = thesis || {}
  const mig = st.strategicMigration || {}
  const counts = {
    CARD05_90DAY_HORIZON_CONFLICT_COUNT: 0,
    UNSUPPORTED_EXACT_PRICE_COUNT: 0,
    CARD04_FROM_TO_MISSING_COUNT: 0,
    CARD05_VALIDATION_STANDARD_MISSING_COUNT: 0,
    CARD03_DUPLICATE_CONCLUSION_COUNT: 0
  }
  const repaired = { horizon: 0, price: 0, fromTo: 0, duplicateConclusion: 0 }

  // ── card01 / card02 ──
  const card01 = String(c.card01 || '')
  const card02 = String(c.card02 || '')

  // ── card03: drop explicit "结论：" pseudo-step + elevate the conclusion (§8) ──
  const c3 = c.card03 || { steps: [], rule: '' }
  const c4ruleEarly = String(((c.card04 || {}).rule) || '')
  let steps = (Array.isArray(c3.steps) ? c3.steps.slice() : []).filter((s) => !/^\s*结论\s*[:：]/.test(String(s)))
  let rule = String(c3.rule || '')
  if (isBadConclusion(rule, steps)) {
    // §8 elevated conclusion, in priority order, all text-preserving (no invention):
    //   1. the elevated principle sentence inside the thesis systemTrap
    //   2. the thesis worldRule (itself a one-level-up principle), unless that is
    //      already card04's rule (avoid collapsing card03 into card04)
    //   3. delete only the phrases that merely repeat a mechanism step
    let newRule = ''
    const elev = elevatedConclusion(st)
    if (elev && !isDuplicateConclusion(elev, steps)) {
      newRule = elev
    } else {
      const wr = fitTextTo(String(st.worldRule || ''), 64)
      if (wr && core(wr) !== core(c4ruleEarly) && !isDuplicateConclusion(wr, steps)) newRule = wr
    }
    if (!newRule) {
      const kept = phrases(rule).filter((p) => {
        const c = core(p)
        if (c.length < 3) return false
        return !steps.some((s) => { const n = core(s); return n && (n.includes(c) || c.includes(n)) })
      })
      newRule = kept.join('').trim()
    }
    // Last resort (e.g. a pure arrow chain the model left un-elevated): take the
    // loop's own TAIL phrase as the conclusion-of-record — it carries no arrow
    // and does not restate a mechanism step. Still text-preserving, never invented.
    if (!newRule || isBadConclusion(newRule, steps)) {
      const tailc = phrases(rule).filter((p) => (p.match(/[→>]/g) || []).length === 0)
      const tail = tailc.length ? tailc[tailc.length - 1] : ''
      if (charLen(tail) >= 6 && !isDuplicateConclusion(tail, steps)) newRule = tail
    }
    newRule = fitTextTo(newRule, 64)
    if (charLen(newRule) >= 6) {
      rule = newRule
      // Drop any step that merely restates the (now elevated) conclusion.
      const rn = core(rule)
      steps = steps.filter((s) => { const n = core(s); return !(n && rn && (rn.includes(n) || n.includes(rn))) })
      repaired.duplicateConclusion++
    }
  }
  // Count reflects the FINAL shipped text: 0 once repaired.
  if (isBadConclusion(rule, steps)) counts.CARD03_DUPLICATE_CONCLUSION_COUNT++

  // ── card04: FROM/TO present + repair from thesis migration ──
  const c4 = c.card04 || { from: '', to: '', rule: '' }
  let from = String(c4.from || '')
  let to = String(c4.to || '')
  const c4rule = String(c4.rule || '')
  if (!oneLine(from) || !oneLine(to)) {
    counts.CARD04_FROM_TO_MISSING_COUNT++
    if (!oneLine(from) && oneLine(mig.from)) { from = String(mig.from); repaired.fromTo++ }
    if (!oneLine(to) && oneLine(mig.to)) { to = String(mig.to); repaired.fromTo++ }
  }

  // ── card05: horizon + price + validation standard ──
  const c5 = c.card05 || { goal: '', actions: [], acceptance: '' }
  let goal = String(c5.goal || '')
  let actions = Array.isArray(c5.actions) ? c5.actions.slice() : []
  let acceptance = String(c5.acceptance || '')

  if (HORIZON_CONFLICT_TEST.test(goal) || HORIZON_CONFLICT_TEST.test(acceptance)) {
    counts.CARD05_90DAY_HORIZON_CONFLICT_COUNT++
  }
  const goalFixed = neutralizeHorizon(goal)
  const accFixed = neutralizeHorizon(acceptance)
  if (goalFixed !== goal || accFixed !== acceptance) repaired.horizon++
  goal = goalFixed
  acceptance = accFixed

  const priceBefore = actions.reduce((a, s) => a + countUnsupportedPrices(s), 0)
  if (priceBefore > 0) counts.UNSUPPORTED_EXACT_PRICE_COUNT += priceBefore
  const actionsFixed = actions.map(neutralizePrices)
  if (actionsFixed.some((s, i) => s !== actions[i])) repaired.price++
  actions = actionsFixed

  if (!oneLine(acceptance)) counts.CARD05_VALIDATION_STANDARD_MISSING_COUNT++

  // §20 — RE-CLAMP the fields a repair may have touched so the frozen card
  // budgets still hold after the guard (a replacement can be marginally longer
  // than the token it replaced). Deterministic, whole-sentence only.
  goal = fitTextTo(goal, 54)
  actions = actions.map((s) => fitTextTo(s, 46))
  acceptance = fitTextTo(acceptance, 46)
  const fromF = fitTextTo(from, 58)
  const toF = fitTextTo(to, 58)

  return {
    cmp: {
      card01: card01,
      card02: card02,
      card03: { steps: steps, rule: rule },
      card04: { from: fromF, to: toF, rule: c4rule },
      card05: { goal: goal, actions: actions, acceptance: acceptance }
    },
    counts: counts,
    repaired: repaired
  }
}

module.exports = {
  HORIZON_CONFLICT_PAT,
  HORIZON_CONFLICT_TEST,
  HORIZON_REWRITE,
  PRICE_RANGE_PAT,
  PRICE_SINGLE_PAT,
  BUDGET_CONTEXT,
  GENERIC_ACTION_EXACT,
  isDuplicateConclusion,
  isBadConclusion,
  elevatedConclusion,
  countUnsupportedPrices,
  neutralizePrices,
  neutralizeHorizon,
  guardVisibleCards
}
