'use strict'
/**
 * turnaroundStrategy/v6/thesis/v4RestoredCompressV6.js
 *
 * RC8.4 V6 R75 — DETERMINISTIC user-visible card compression (POST-thesis).
 *
 * The R70 V4-restored brain (bold interpretation / identity reasoning / system
 * mechanism / value migration / commercial action) is PRESERVED IN FULL on
 * `strategicThesis`. Only the USER-VISIBLE five-card layer is compressed, AFTER
 * thesis formation, with NO second model call.
 *
 *   CARD01 致命一句话   ONE cognitive collision             <= 40   (target 25-40)
 *   CARD02 核心问题     identity/value position             <= 140  (target 100-140)
 *   CARD03 系统困局     <=3 bullets + 1 world-rule          <= 220  (target 160-220)
 *   CARD04 翻身路径     FROM -> TO + 1 world-rule           <= 160  (target 100-160)
 *   CARD05 现在就做     90d goal + <=3 actions + 验收标准    <= 240  (target 180-240)
 *
 * Deterministic only. NEVER truncates mid-sentence: sentence / clause selection
 * lands on punctuation boundaries. Cross-card raw-fact repetition is capped so
 * any single questionnaire fact appears at most twice. CONSUMER LAYER ONLY.
 */

const BUDGET = Object.freeze({
  CARD01: 40, CARD02: 140, CARD03: 220, CARD04: 160, CARD05: 240
})

// Canonical questionnaire FACT families (for the <=2 repetition cap).
const FACT_MARKERS = Object.freeze([
  { id: 'AGE', src: '\\d+\\s*[-–~至]?\\s*\\d*\\s*岁' },
  { id: 'SURPLUS', src: '(结余|每月[^。，,；]{0,6}(剩|留下|存下)|存下[^。，,；]{0,6})' },
  { id: 'SAVINGS', src: '(存款|储蓄|能撑|撑[^。，,；]{0,4}个月|可支撑)' },
  { id: 'TIME', src: '(每周[^。，,；]{0,8}小时|自由时间[^。，,；]{0,8}小时|\\d+\\s*小时)' },
  { id: 'BUDGET', src: '(试错|预算|承受[^。，,；]{0,8}(元|块|万)|[0-9]{3,}\\s*[-–~]?\\s*[0-9]*\\s*元)' }
])

function charLen (s) { return [...String(s == null ? '' : s)].length }
function str (s) { return typeof s === 'string' ? s.trim() : '' }
function arr (v) { return Array.isArray(v) ? v.map(str).filter(Boolean) : [] }
function splitSentences (t) { return String(t || '').split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean) }
function splitClauses (t) { return String(t || '').split(/(?<=[，,；;、])/).map((s) => s.trim()).filter(Boolean) }
function countFact (text, src) { return (String(text || '').match(new RegExp(src, 'g')) || []).length }
function norm (s) { return String(s || '').replace(/[。，,；;、！？!?\s“”"']/g, '') }

/** Keep whole sentences (then whole clauses) until <= max. Never cuts mid-clause. */
function fitTextTo (text, max) {
  const t = str(text)
  if (!t || charLen(t) <= max) return t
  const sents = splitSentences(t)
  if (sents.length > 1) {
    let acc = ''
    for (const s of sents) { if (charLen(acc + s) > max) break; acc += s }
    if (acc) return acc.trim()
  }
  const clauses = splitClauses(t)
  let acc = ''
  for (const cl of clauses) { if (charLen(acc + cl) > max && acc) break; acc += cl }
  acc = acc.trim()
  if (acc && !/[。！？!?]$/.test(acc)) acc = acc.replace(/[，,；;、]$/, '') + '。'
  return acc || t
}

/** CARD01 — pick the ONE cognitive-collision sentence (not a summary). */
function pickCollision (text) {
  const t = str(text)
  if (!t) return ''
  const sents = splitSentences(t)
  if (sents.length <= 1) return t
  let best = sents[0]; let bestScore = -Infinity
  for (const s of sents) {
    let sc = 0
    if (/不是|并非|而不是/.test(s)) sc += 3
    if (/真正|其实|反而|恰恰|表面/.test(s)) sc += 1
    sc -= charLen(s) / 60
    if (sc > bestScore) { bestScore = sc; best = s }
  }
  return best
}

/** A sentence that is mostly a raw-fact enumeration is not an interpretation. */
function isFactEnumeration (s) {
  let n = 0
  for (const m of FACT_MARKERS) n += countFact(s, m.src)
  const listy = (s.match(/[、，,]/g) || []).length >= 2
  return n >= 2 || (n >= 1 && listy && charLen(s) < 44)
}

/** CARD02 — identity/value position; drop raw-fact enumeration; fit budget. */
function compressCard02Sentences (text, max) {
  const t = str(text)
  if (!t) return []
  const sents = splitSentences(t)
  const kept = sents.filter((s) => !isFactEnumeration(s))
  const pool = kept.length ? kept : sents
  const out = []
  let acc = ''
  for (const s of pool) {
    if (charLen(acc + s) > max) break
    out.push(s); acc += s
  }
  if (!out.length) out.push(fitTextTo(pool[0] || t, max))
  return out
}

/**
 * CARD03 — <=3 mechanism bullets + ONE world-rule sentence.
 * The rule MUST NOT restate the mechanism (§4): prefer the loop's CONCLUSION
 * (tail after a result marker); fall back to the thesis world-rule only if it
 * does not collapse into CARD04's rule; else the trimmed systemTrap.
 */
function compressCard03 (bullets, ruleRaw, worldRule) {
  const list = arr(bullets)
  const scored = list.map((s, i) => {
    let sc = 0
    if (/没有|就|越|循环|回路|于是|导致|所以|因为|每次|永远|停在/.test(s)) sc += 1
    sc -= charLen(s) / 80
    return { s: fitTextTo(s, 72), i, sc }
  })
  scored.sort((a, b) => (b.sc - a.sc) || (a.i - b.i))
  const top = scored.slice(0, 3).sort((a, b) => a.i - b.i).map((x) => x.s)

  const trap = str(ruleRaw)
  const m = trap.match(/(结果是[：:]|所以|因此|于是|最终|到头来|最后)([\s\S]+)$/)
  let ruleText = m ? str(m[2]) : trap
  ruleText = fitTextTo(ruleText, 64)
  const wr = fitTextTo(str(worldRule), 64)
  if (norm(ruleText) === norm(wr) && wr) ruleText = fitTextTo(trap, 64)
  if (!ruleText) ruleText = wr

  const ruleN = norm(ruleText)
  let steps = top.filter((s) => { const n = norm(s); return !(ruleN && n && (ruleN.includes(n) || n.includes(ruleN))) })
  if (!steps.length) steps = top
  let total = steps.reduce((a, s) => a + charLen(s), 0) + charLen(ruleText)
  while (steps.length > 1 && total > BUDGET.CARD03) { total -= charLen(steps[steps.length - 1]); steps = steps.slice(0, -1) }
  return { steps, rule: ruleText }
}

/** CARD04 — FROM -> TO + ONE world-rule sentence. */
function compressCard04 (from, to, rule) {
  return { from: fitTextTo(str(from), 58), to: fitTextTo(str(to), 58), rule: fitTextTo(str(rule), 72) }
}

/** CARD05 — 90d goal + <=3 coordinated actions + acceptance criterion. */
function compressCard05 (goal, actions, acceptance) {
  const g = fitTextTo(str(goal), 54)
  let acts = arr(actions).slice(0, 3).map((a) => fitTextTo(a, 46))
  const acc = fitTextTo(str(acceptance), 46)
  let total = charLen(g) + acts.reduce((a, s) => a + charLen(s), 0) + charLen(acc)
  while (acts.length > 1 && total > BUDGET.CARD05) { total -= charLen(acts[acts.length - 1]); acts = acts.slice(0, -1) }
  return { goal: g, actions: acts, acceptance: acc }
}

/**
 * Enforce the cross-card raw-fact repetition cap. Items carry a priority; on
 * overflow the lowest-priority item containing the fact is dropped.
 */
function enforceFactCap (items, cap) {
  for (const m of FACT_MARKERS) {
    const live = () => items.filter((x) => !x.removed && countFact(x.text, m.src) > 0)
    while (live().reduce((a, x) => a + countFact(x.text, m.src), 0) > cap) {
      const cand = items.filter((x) => !x.removed && x.pri < 10 && countFact(x.text, m.src) > 0)
        .sort((a, b) => (a.pri - b.pri) || (countFact(b.text, m.src) - countFact(a.text, m.src)))[0]
      if (!cand) break
      cand.removed = true
    }
  }
  return items.filter((x) => !x.removed)
}

/**
 * Compress the user-visible five cards. strategicThesis is NOT touched.
 * @returns {{card01,card02,card03:{steps,rule},card04:{from,to,rule},card05:{goal,actions,acceptance},stats}}
 */
function compressVisibleCards (output) {
  const o = output || {}
  const st = o.strategicThesis || {}
  const oc = o.cards || {}
  const c4 = (oc.card04 && typeof oc.card04 === 'object') ? oc.card04 : {}
  const c5 = (oc.card05 && typeof oc.card05 === 'object') ? oc.card05 : {}
  const mig = st.strategicMigration || {}
  const ct = st.commercialThesis || {}

  const card01 = fitTextTo(pickCollision(str(oc.card01)), BUDGET.CARD01)
  const card02Sentences = compressCard02Sentences(str(oc.card02), BUDGET.CARD02)
  const c3 = compressCard03(oc.card03, str(st.systemTrap), str(st.worldRule))
  const c4o = compressCard04(str(c4.from) || str(mig.from), str(c4.to) || str(mig.to), str(st.worldRule))
  const c5o = compressCard05(
    str(c5.objective) || str(c5.primary) || str(ct.objective),
    arr(c5.actions).length ? arr(c5.actions) : arr(c5.supporting),
    str(c5.successSignal)
  )

  // Build a capped pool: card04 FROM/TO are protected (migration truth).
  const items = []
  card02Sentences.forEach((s) => items.push({ text: s, pri: 5, key: 'card02' }))
  c3.steps.forEach((s) => items.push({ text: s, pri: 6, key: 'card03' }))
  c5o.actions.forEach((s) => items.push({ text: s, pri: 3, key: 'card05action' }))
  items.push({ text: c5o.goal, pri: 7, key: 'card05goal' })
  items.push({ text: c5o.acceptance, pri: 7, key: 'card05accept' })
  items.push({ text: c4o.from, pri: 20, key: 'card04from' })
  items.push({ text: c4o.to, pri: 20, key: 'card04to' })
  items.push({ text: c3.rule, pri: 20, key: 'card03rule' })
  items.push({ text: c4o.rule, pri: 20, key: 'card04rule' })
  const kept = enforceFactCap(items, 2)
  const pick = (key) => kept.filter((x) => x.key === key).map((x) => x.text)
  const first = (key, dflt) => { const a = pick(key); return a.length ? a[0] : dflt }

  const c2 = pick('card02')
  const c3steps = pick('card03')
  const c5acts = pick('card05action')
  const card05 = { goal: first('card05goal', c5o.goal), actions: c5acts, acceptance: first('card05accept', c5o.acceptance) }

  const counts = {}
  const all = c2.concat(c3steps, [c3.rule, c4o.from, c4o.to, c4o.rule, card05.goal], c5acts, [card05.acceptance])
  for (const m of FACT_MARKERS) { let n = 0; for (const s of all) n += countFact(s, m.src); counts[m.id] = n }

  const stats = {
    CARD01: charLen(card01),
    CARD02: c2.reduce((a, s) => a + charLen(s), 0),
    CARD03: c3steps.reduce((a, s) => a + charLen(s), 0) + charLen(c3.rule),
    CARD04: charLen(c4o.from) + charLen(c4o.to) + charLen(c4o.rule),
    CARD05: charLen(card05.goal) + card05.actions.reduce((a, s) => a + charLen(s), 0) + charLen(card05.acceptance),
    CARD03_BULLET_COUNT: c3steps.length,
    CARD05_ACTION_COUNT: card05.actions.length,
    factCounts: counts,
    factRepetitionMax: Math.max(0, ...Object.values(counts))
  }

  return { card01, card02: c2.join(''), card03: { steps: c3steps, rule: c3.rule }, card04: c4o, card05, stats }
}

module.exports = {
  BUDGET,
  FACT_MARKERS,
  charLen,
  fitTextTo,
  pickCollision,
  compressCard02Sentences,
  compressCard03,
  compressCard04,
  compressCard05,
  enforceFactCap,
  compressVisibleCards
}
