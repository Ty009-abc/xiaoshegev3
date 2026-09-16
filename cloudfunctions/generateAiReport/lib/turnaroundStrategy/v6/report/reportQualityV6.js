'use strict'
/**
 * turnaroundStrategy/v6/report/reportQualityV6.js
 *
 * R31 §9/§12 — deterministic PRODUCT-QUALITY checks over a finished five-card
 * report. Consumer layer only. No AI, no I/O, no randomness, no time.
 *
 *   §9  CROSS_CARD_DUPLICATE_IDEA_COUNT  — cards must not repeat the same
 *       conclusion. Compares adjacent card pairs on a normalized character-
 *       shingle overlap (an "obvious duplicate" is a near-identical idea).
 *
 *   §12 ACTION_TOO_GENERIC              — CARD05 (现在就做) must answer at least
 *       3 of 4: 做什么 / 什么时候完成 / 找谁验证 / 什么算完成.
 */

const CARD_KEYS = ['fatalInsight', 'coreProblem', 'systemLoop', 'turnaroundPath', 'firstAction']

// "Generic" action verbs/leitmotifs that are NOT a concrete action on their own.
const GENERIC_ACTION_PAT = /^(努力|加油|坚持|多尝试|开始行动|行动起来|提升自己|改变心态|多学习|相信自己|做好自己)[。！]?$/

function normalize (s) {
  return String(s == null ? '' : s)
    .replace(/[\s，,、。．.！!？?；;：:""''「」『』（）()【】\[\]—-]/g, '')
}

/** Character 4-gram shingle set. */
function shingles (text, n) {
  const t = normalize(text)
  const size = n || 4
  const set = new Set()
  if (t.length < size) { if (t) set.add(t); return set }
  for (let i = 0; i + size <= t.length; i++) set.add(t.slice(i, i + size))
  return set
}

function jaccard (a, b) {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

/** Flatten one card into its user-visible conclusion text. */
function cardText (cards, key) {
  const c = cards && cards[key]
  if (!c) return ''
  const parts = []
  if (typeof c.text === 'string') parts.push(c.text)
  if (typeof c.logic === 'string') parts.push(c.logic)
  if (Array.isArray(c.steps)) parts.push(c.steps.join(' '))
  if (c.insight) parts.push(c.insight)
  if (c.action) parts.push(c.action)
  if (c.done) parts.push(c.done)
  if (c.from || c.to) parts.push([c.from, c.to].filter(Boolean).join(' '))
  return parts.join('\n')
}

/**
 * §9 cross-card semantic repetition.
 * Flags an "obvious duplicate idea" when an adjacent card pair shares a very
 * high shingle overlap (near-identical conclusion). Deterministic.
 * @returns {{count:number, pairs:Array<{a:string,b:string,overlap:number}>}}
 */
function crossCardDuplicateIdeas (report, threshold) {
  const TH = threshold != null ? threshold : 0.34
  const cards = report && report.cards
  const pairs = []
  if (!cards) return { count: 0, pairs }
  for (let i = 0; i < CARD_KEYS.length - 1; i++) {
    const a = CARD_KEYS[i]
    const b = CARD_KEYS[i + 1]
    const sa = shingles(cardText(cards, a))
    const sb = shingles(cardText(cards, b))
    const ov = jaccard(sa, sb)
    if (ov > TH) pairs.push({ a, b, overlap: Number(ov.toFixed(3)) })
  }
  return { count: pairs.length, pairs }
}

/**
 * §12 action specificity for CARD05.
 * @returns {{answered:number, total:number, tooGeneric:boolean, missing:string[]}}
 */
function actionSpecificity (card05) {
  const c = card05 || {}
  const what = typeof c.action === 'string' && c.action.trim().length > 0 && !GENERIC_ACTION_PAT.test(c.action.trim())
  const when = typeof c.timebox === 'string' && c.timebox.trim().length > 0
  const who = typeof c.verifyWith === 'string' && c.verifyWith.trim().length > 0
  const done = typeof c.done === 'string' && c.done.trim().length > 0
  const missing = []
  if (!what) missing.push('WHAT')
  if (!when) missing.push('WHEN')
  if (!who) missing.push('WHO_VERIFIES')
  if (!done) missing.push('DONE_CRITERION')
  const answered = 4 - missing.length
  return { answered, total: 4, tooGeneric: answered < 3, missing }
}

/**
 * Aggregate quality findings for a report.
 */
function assessQualityV6 (report, opts) {
  const dup = crossCardDuplicateIdeas(report, opts && opts.dupThreshold)
  const spec = actionSpecificity(report && report.cards && report.cards.firstAction)
  return {
    CROSS_CARD_DUPLICATE_IDEA_COUNT: dup.count,
    CROSS_CARD_DUPLICATE_PAIRS: dup.pairs,
    ACTION_SPECIFICITY_ANSWERED: spec.answered,
    ACTION_TOO_GENERIC: spec.tooGeneric,
    ACTION_MISSING_FIELDS: spec.missing
  }
}

module.exports = {
  CARD_KEYS,
  GENERIC_ACTION_PAT,
  shingles,
  jaccard,
  cardText,
  crossCardDuplicateIdeas,
  actionSpecificity,
  assessQualityV6
}
