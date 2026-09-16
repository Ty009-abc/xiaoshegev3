'use strict'
/**
 * turnaroundStrategy/v6/experimental/draft/reportEditorV6.js
 *
 * R11_V2 — DETERMINISTIC REPORT EDITOR.
 *
 * Transforms AI draft MATERIAL + frozen B2 report into the FINAL five cards.
 *
 * AUTHORITY
 *   CARD01 source = selected AI insight candidate   (final target 30–60 chars)
 *   CARD02 source = AI mechanismExplanation          (final target 60–120 chars)
 *   CARD03 source = deterministic B2 ONLY            (AI contribution = NONE)
 *   CARD04 source = B2 transition + AI transitionExplanation (concise FROM → TO)
 *   CARD05 source = frozen firstActionType + AI actionExplanation
 *
 * HARD RULES
 *   - EDITOR_AI_CALL_COUNT = 0 (no second LLM pass, no network, no I/O).
 *   - The editor NEVER changes diagnosis, bottleneck, stage, belief relation,
 *     firstActionType, or any frozen fact.
 *   - The editor NEVER introduces new facts: every clause it keeps must be a
 *     substring of a validated AI draft field, or come from the frozen B2 copy.
 *   - FIELD-LEVEL fallback: an unusable field is replaced by its deterministic
 *     B2 counterpart; the rest of the report may still use AI material.
 */

const copy = require('../../report/reportCopyV6.js')

const CARD_TITLES = {
  fatalInsight: '致命一句话',
  coreProblem: '核心问题',
  systemLoop: '系统困局',
  turnaroundPath: '翻身路径',
  firstAction: '现在就做'
}

// Final UI targets (§6). CARD01 is a HARD cap (must not exceed 60).
const FINAL_LIMITS = {
  card01Min: 30,
  card01Max: 60,
  card02Max: 120,
  card04ToMax: 40,
  card04SoftMax: 48,
  card05ActionMax: 60
}

// Clause/bullet splitting used for repetition control.
const SENT_SPLIT = /(?<=[。！？!?；;\n])/
const COMMA_SPLIT = /(?<=[，,、；;])/

function chars (s) { return s == null ? 0 : [...String(s)].length }
function trim (s) { return String(s == null ? '' : s).trim() }
function stripTrailingPunct (s) { return trim(s).replace(/[。．.!！,，、;；:：\s]+$/, '') }

/**
 * Keep only the FIRST N sentences of a field (compression). Never fabricates.
 * Returns a substring of the input (after trimming surrounding whitespace).
 */
function firstSentences (text, n) {
  const parts = trim(text).split(SENT_SPLIT).filter((x) => trim(x).length > 0)
  return trim(parts.slice(0, n).join(''))
}

/** Trim a clause at a punctuation boundary so we never cut mid-clause. */
function clipToLimit (text, limit) {
  const t = trim(text)
  if (chars(t) <= limit) return t
  const parts = t.split(COMMA_SPLIT)
  let out = ''
  for (const p of parts) {
    if (chars(out + p) > limit) break
    out += p
  }
  out = trim(out)
  return out || t
}

// ── R21 §3 copy-completeness invariant ──────────────────────────────────────
// A user-facing CARD01/CARD04 AI expression is valid only if it ends at a
// proven semantic boundary (。！？；). Transparent trailing closing marks are
// ignored so “……。」 ” still counts as complete.
const SEMANTIC_TERMINATOR = /[。！？；!?;]$/
function endsAtSemanticBoundary (s) {
  const x = trim(s).replace(/[”"』）)】」》»\]]+$/, '')
  return !!x && SEMANTIC_TERMINATOR.test(x)
}
// R33: CARD01 user-facing copy must end on a TRUE sentence terminator
// (。！？!?), never on a clause separator (；;：:) — a semicolon-tail is a half
// sentence. This is stricter than the R21 clause-boundary invariant.
const SENTENCE_TERMINATOR_RE = /[。！？!?]$/
function endsAtSentence (s) {
  const x = trim(s).replace(/[”"』）)】」》»\]]+$/, '')
  return !!x && SENTENCE_TERMINATOR_RE.test(x)
}

// Sentence terminators (kept), vs clause separators (stripped when trailing).
const SENTENCE_TERMINATOR = /[。！？!?]$/
const CLAUSE_SEP_CHARS = ['，', ',', '、', '；', ';', '：', ':']
/**
 * §1 CARD01 compression with an explicit preference order:
 *   1. complete sentence(s) that fit within `limit` (ends on 。！？)
 *   2. complete clause (accumulated on ，、；：) that fits
 *   3. punctuation-aware cut at the last COMPLETE terminator inside `limit`
 *   4. no complete unit fits `limit` → null (caller uses deterministic B2)
 * Never fabricates: the result is always a prefix of the input.
 * R21 §3/§4: a comma-cut prefix (no terminator) is NOT user-facing copy and is
 * rejected rather than shipped; a complete B2 fallback is preferred to a broken
 * AI sentence. Hard truncation is never a user-facing option.
 * Deterministic; no AI call.
 */
function compressCard01 (text, limit) {
  const t = removeGenericFiller(trim(text))
  if (!t) return t
  // A sub-limit string is usable AS-IS only if it already ends on a sentence.
  if (chars(t) <= limit && endsAtSentence(t)) return t

  // 1) whole sentences that fit AND end at a sentence boundary
  const sents = t.split(SENT_SPLIT).filter((x) => trim(x).length > 0)
  let acc = ''
  for (const s of sents) {
    if (chars(acc + s) > limit) break
    acc += s
  }
  acc = trim(acc)
  if (acc) { const p = polishTail(acc); if (p && endsAtSentence(p)) return p }

  // 2) whole clauses that fit AND end at a sentence boundary
  const clauses = t.split(COMMA_SPLIT).filter((x) => trim(x).length > 0)
  acc = ''
  for (const c of clauses) {
    if (chars(acc + c) > limit) break
    acc += c
  }
  acc = trim(acc)
  if (acc) { const p = polishTail(acc); if (p && endsAtSentence(p)) return p }

  // 3) last SENTENCE terminator inside `limit`
  const arr = [...t]
  const head = arr.slice(0, limit).join('')
  const cut = lastIndexWhere(head, (ch) => SENTENCE_TERMINATOR_RE.test(ch))
  if (cut >= 0) {
    const out = trim(arr.slice(0, cut + 1).join(''))
    if (endsAtSentence(out)) return out
  }

  // 4) no complete sentence fits → caller falls back to deterministic B2.
  return null
}

// §3 CARD04 true-sentence boundary: terminator set EXCLUDES clause separators
// (，、；：) so a semicolon is never mistaken for a sentence end.
const C04_TRUE_SENT_SPLIT = /(?<=[。！？!?\n])/
const C04_SENT_TERM = '。！？!?'       // full sentence enders (KEEP)
const C04_CLAUSE_TERM = '；;：:'      // complete-clause enders (KEEP)
const C04_PARTIAL_SEP = '，,、'       // partial-clause separators (CUT BEFORE)

/** Index of the last char in `s` satisfying `pred`, or -1. */
function lastIndexWhere (s, pred) {
  const a = [...s]
  for (let i = a.length - 1; i >= 0; i--) if (pred(a[i])) return i
  return -1
}

// Trailing tails that signal an INCOMPLETE clause/lead-in if left at the end
// (R17 §7): temporal/introductory openers must not be the final copy.
const C04_LEAD_IN_TAIL = /(之后|之前|以后|以前|的时候|的话|如果|当|一旦|为了|关于|至于)$/

/** True if the text ends on a complete sentence/clause boundary. */
function c04EndsComplete (s) {
  const x = trim(s).replace(/[”"』）)】」]+$/, '')
  if (!x) return false
  const last = [...x].pop()
  return C04_SENT_TERM.includes(last) || C04_CLAUSE_TERM.includes(last)
}

/** True if the text ends on a lead-in opener (never a valid final copy). */
function c04EndsLeadIn (s) {
  return C04_LEAD_IN_TAIL.test(stripTrailingPunct(trim(s)))
}

/**
 * §7 CARD04 compression — deterministic, punctuation-aware (R12 philosophy).
 * R17 adds a SOFT-MAX so a complete expression is preferred over a broken
 * prefix: target `limit` (40), soft ceiling `softMax` (48).
 * Preference order (within the soft ceiling unless noted):
 *   1. longest run of WHOLE sentences (。！？), kept
 *   2. last full-sentence ender (。！？) inside the window, kept
 *   3. last complete-clause ender (；：) inside the window, kept
 *   4. last partial separator (，、) inside the window, cut before (no lead-in)
 *   5. hard truncation (ABSOLUTE LAST RESORT) within the target
 * Never fabricates: the result is always a prefix of the input.
 * Deterministic; CARD04_EDITOR_AI_CALL_COUNT = 0.
 *
 * Applied to the FULL transition explanation (pre-truncating produced the R14
 * mid-clause cuts). Returns `null` when NO complete unit fits the soft ceiling;
 * the caller then uses a complete B2-derived expression instead.
 */
function compressCard04Logic (text, limit, softMax) {
  const T = (limit != null ? limit : FINAL_LIMITS.card04ToMax)
  const S = Math.max(T, (softMax != null ? softMax : FINAL_LIMITS.card04SoftMax))
  const t = removeGenericFiller(trim(text))
  if (!t) return t
  const headS = [...t].slice(0, S).join('')

  // 1) longest run of WHOLE sentences that fits (each split part keeps its
  //    。！？ terminator, so a non-empty accumulator always ends on one)
  const sents = t.split(C04_TRUE_SENT_SPLIT).filter((x) => trim(x).length > 0)
  let acc = ''
  for (const s of sents) {
    if (chars(acc + s) > S) break
    acc += s
  }
  acc = polishTail(trim(acc))
  if (acc && C04_SENT_TERM.includes([...acc].pop()) && !c04EndsLeadIn(acc)) return acc

  // 2) last full sentence ender inside the soft window (keep the ender)
  const term = lastIndexWhere(headS, (ch) => C04_SENT_TERM.includes(ch))
  if (term >= 0) {
    const out = trim(headS.slice(0, term + 1))
    if (!c04EndsLeadIn(out)) return out
  }

  // 3) last complete-clause ender inside the window (；：, keep the ender).
  const clauseEnd = lastIndexWhere(headS, (ch) => C04_CLAUSE_TERM.includes(ch))
  if (clauseEnd >= 0) {
    const out = trim(headS.slice(0, clauseEnd + 1))
    if (chars(out.replace(/[；;：:]+$/, '')) >= 8 && !c04EndsLeadIn(out)) return out
  }

  // 4) whole material already fits the target AND ends at a complete boundary.
  if (chars(t) <= T && c04EndsComplete(t) && !c04EndsLeadIn(t)) return t

  // 5) R21 §3/§4: NO complete unit fits the soft ceiling. A comma-cut prefix is
  //    NOT a semantic boundary (it produced the R20 mid-clause fragment
  //    “……能否在你忙碌”), so return null and let the caller use a complete
  //    B2-derived expression. Hard truncation is never user-facing.
  return null
}

/** Back-compat hard-truncation tail (kept for callers that need a guaranteed
 *  non-null string when no complete unit exists). */
function compressCard04LogicHard (text, limit, softMax) {
  const r = compressCard04Logic(text, limit, softMax)
  if (r != null) return r
  const T = (limit != null ? limit : FINAL_LIMITS.card04ToMax)
  const head = [...removeGenericFiller(trim(text))].slice(0, T).join('')
  return polishTail(head) || head
}

// Trailing connectives that signal an incomplete clause if left at the end.
const DANGLING_TAIL = /(而|而且|并且|但是|但|因为|所以|于是|只有|如果|即使|为了|以及|同时|而是|就是|就能|才会|再|把|让|是)$/
/**
 * Deterministic tail polish: drop a trailing fragment that is a dangling
 * connective or a too-short stub, so the copy never ends mid-thought.
 * Never fabricates — only removes trailing segments it cannot complete.
 */
function polishTail (text) {
  let t = trim(text).replace(/[，,、；;：:\s]+$/, '')
  const isDangling = (seg) => {
    const s = stripTrailingPunct(seg)
    return DANGLING_TAIL.test(s) || chars(s) < 4 || /^——/.test(s)
  }
  let guard = 0
  while (guard++ < 6) {
    // 1) multi-sentence: drop a dangling/too-short trailing sentence.
    const sents = t.split(SENT_SPLIT).filter((x) => trim(x).length > 0)
    if (sents.length > 1 && isDangling(sents[sents.length - 1])) {
      t = trim(sents.slice(0, -1).join('')).replace(/[，,、；;：:\s]+$/, '')
      continue
    }
    // 2) single sentence: drop a dangling/too-short trailing comma clause.
    const commas = t.split(COMMA_SPLIT).filter((x) => trim(x).length > 0)
    if (commas.length > 1 && isDangling(commas[commas.length - 1])) {
      t = trim(commas.slice(0, -1).join('')).replace(/[，,、；;：:\s]+$/, '')
      continue
    }
    break
  }
  return t
}

/**
 * Choose the strongest SUPPORTED insight candidate.
 * "Supported" = the candidate passed the field-level safety check.
 * Strength heuristic (deterministic): prefer the candidate that encodes the
 * belief→reality contrast (“你以为…其实…”) and carries the most concrete
 * bottleneck-linked tail; tie-break by shortest (punchier), then first.
 */
function selectInsightCandidate (candidates, verdicts, diagnosis) {
  const pb = diagnosis && diagnosis.primaryBottleneck
  const tailHint = pb ? copy.getGapTail(pb) : ''
  const scored = (candidates || []).map((text, i) => {
    const v = (verdicts || []).find((x) => x.i === i)
    const ok = !v || v.ok
    const contrast = /(你以为|其实|真正)/.test(text) ? 3 : 0
    const tailMatch = tailHint && text.includes(tailHint.slice(0, 6)) ? 2 : 0
    const concrete = /[0-9]|用户|反馈|买|做|试|写|问|选/.test(text) ? 1 : 0
    return { text, i, ok, score: contrast + tailMatch + concrete, len: chars(text) }
  })
  const usable = scored.filter((s) => s.ok && s.text)
  if (usable.length === 0) return null
  usable.sort((a, b) => (b.score - a.score) || (a.len - b.len) || (a.i - b.i))
  return usable[0].text
}

/** Remove a leading thesis that is repeated later in the text. */
function dedupeThesis (text) {
  const sents = trim(text).split(SENT_SPLIT).filter((x) => trim(x).length > 0)
  const seen = new Set()
  const out = []
  for (const s of sents) {
    const key = stripTrailingPunct(s).slice(0, 8)
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    out.push(s)
  }
  return trim(out.join(''))
}

const GENERIC_FILLER = [
  '总而言之', '综上所述', '希望对你有帮助', '加油', '相信自己', '未来可期',
  '这是一个过程', '慢慢来', '每个人都不一样', '因人而异'
]
function removeGenericFiller (text) {
  let t = trim(text)
  for (const f of GENERIC_FILLER) t = t.split(f).join('')
  return trim(t)
}

/**
 * Edit the whole report.
 * @param {Object} args { diagnosis, b2Report, draft, draftVerdict }
 * @returns {{cards, provenance, editor:{aiCallCount, fieldsUsed, fieldsFellBack, fieldReasons}}}
 */
function editReportV6 (args) {
  const { diagnosis, b2Report, draft, draftVerdict } = args || {}
  if (!b2Report || !b2Report.cards) throw new Error('EDITOR_REQUIRES_B2_REPORT')

  const b2 = b2Report.cards
  const fv = (draftVerdict && draftVerdict.fieldVerdicts) || {}
  const d = draft || {}
  const fieldsUsed = []
  const fieldsFellBack = []
  const fieldReasons = {}

  const fieldOk = (name) => {
    const v = fv[name]
    if (!v) return true // no verdict => treat as usable (B2 covers safety)
    if (Array.isArray(v)) return v.every((x) => x.ok)
    return !!v.ok
  }

  // ── CARD01 ──────────────────────────────────────────────────
  const selectedRaw = selectInsightCandidate(d.insightCandidates || [], fv.insightCandidates, diagnosis)
  let card01
  if (selectedRaw && (fv.insightCandidates || []).some((v) => v.ok)) {
    let t = compressCard01(selectedRaw, FINAL_LIMITS.card01Max)
    if (chars(t) > FINAL_LIMITS.card01Max) t = compressCard01(t, FINAL_LIMITS.card01Max)
    if (t && chars(t) >= 8) { card01 = t; fieldsUsed.push('insightCandidates') } else { card01 = b2.fatalInsight.text; fieldsFellBack.push('insightCandidates'); fieldReasons.insightCandidates = 'TOO_SHORT_AFTER_CLIP' }
  } else {
    card01 = b2.fatalInsight.text
    fieldsFellBack.push('insightCandidates')
    fieldReasons.insightCandidates = selectedRaw ? 'FIELD_UNSAFE' : 'NO_USABLE_CANDIDATE'
  }
  // HARD cap enforcement (CARD01 must never exceed 60).
  if (chars(card01) > FINAL_LIMITS.card01Max) card01 = clipToLimit(card01, FINAL_LIMITS.card01Max)
  // R21 §4 / R33: never ship a non-sentence stub; use the complete B2 sentence.
  if (!endsAtSentence(card01)) card01 = b2.fatalInsight.text

  // ── CARD02 ──────────────────────────────────────────────────
  let card02
  if (d.mechanismExplanation && fieldOk('mechanismExplanation')) {
    let t = polishTail(removeGenericFiller(dedupeThesis(firstSentences(d.mechanismExplanation, 3))))
    if (chars(t) > FINAL_LIMITS.card02Max) t = polishTail(clipToLimit(t, FINAL_LIMITS.card02Max))
    if (chars(t) >= 20) { card02 = t; fieldsUsed.push('mechanismExplanation') } else { card02 = b2.coreProblem.text; fieldsFellBack.push('mechanismExplanation'); fieldReasons.mechanismExplanation = 'TOO_SHORT_AFTER_CLIP' }
  } else {
    card02 = b2.coreProblem.text
    fieldsFellBack.push('mechanismExplanation')
    fieldReasons.mechanismExplanation = d.mechanismExplanation ? (fv.mechanismExplanation && fv.mechanismExplanation.reasons || ['UNSAFE']) : 'MISSING'
  }

  // ── CARD03 ── deterministic B2 ONLY (AI contribution = NONE)
  const card03Steps = b2.systemLoop.steps.slice()

  // ── CARD04 ── B2 from/to authority; AI explains concisely
  let card04Logic = b2.turnaroundPath.logic || b2.turnaroundPath.text || ''
  if (d.transitionExplanation && fieldOk('transitionExplanation')) {
    // §7 boundary-aware selection over the FULL material, with a SOFT MAX so a
    // complete expression is preferred over a broken prefix. Pre-truncating the
    // source before compression produced the R14 mid-clause cuts; the R16
    // sub-limit fragment (e.g. “在有一点稳定结果之后”) is now caught by the
    // lead-in guard and falls back to a complete B2-derived unit.
    let t = compressCard04Logic(dedupeThesis(d.transitionExplanation), FINAL_LIMITS.card04ToMax, FINAL_LIMITS.card04SoftMax)
    let c04Reason = null
    if (t == null) {
      // R21 §3/§4: AI material has no COMPLETE unit within the soft ceiling →
      // use a complete B2-derived expression instead of a broken fragment.
      // Never ship a mid-clause cut or a hard truncation to the user.
      const b2Material = b2.turnaroundPath.logic || b2.turnaroundPath.text || ''
      t = compressCard04Logic(b2Material, FINAL_LIMITS.card04ToMax, FINAL_LIMITS.card04SoftMax)
      if (t == null || !c04EndsComplete(t)) t = trim(b2Material) // complete B2 copy is the guaranteed-safe last resort
      c04Reason = 'NO_COMPLETE_UNIT_AI_USE_B2'
    }
    if (c04Reason == null && chars(t) >= 10) {
      card04Logic = t; fieldsUsed.push('transitionExplanation')
    } else if (t && chars(t) >= 10) {
      // Copy used, but not from the AI material → field fallback (honest).
      card04Logic = t; fieldsFellBack.push('transitionExplanation'); fieldReasons.transitionExplanation = c04Reason
    } else {
      fieldsFellBack.push('transitionExplanation'); fieldReasons.transitionExplanation = c04Reason || 'TOO_SHORT_AFTER_CLIP'
    }
  } else {
    fieldsFellBack.push('transitionExplanation')
    fieldReasons.transitionExplanation = d.transitionExplanation ? 'FIELD_UNSAFE' : 'MISSING'
  }
  const card04From = b2.turnaroundPath.from
  const card04To = b2.turnaroundPath.to
  // R21 §3/§4 belt-and-suspenders: CARD04 must never ship incomplete copy.
  if (!c04EndsComplete(card04Logic)) card04Logic = b2.turnaroundPath.logic || b2.turnaroundPath.text || card04Logic

  // ── CARD05 ── frozen firstActionType + AI explanation as supporting line
  const card05Action = b2.firstAction.action
  let card05Note = ''
  if (d.actionExplanation && fieldOk('actionExplanation')) {
    let t = polishTail(removeGenericFiller(dedupeThesis(firstSentences(d.actionExplanation, 1))))
    if (chars(t) > FINAL_LIMITS.card05ActionMax) t = polishTail(clipToLimit(t, FINAL_LIMITS.card05ActionMax))
    if (chars(t) >= 8) { card05Note = t; fieldsUsed.push('actionExplanation') } else { fieldsFellBack.push('actionExplanation'); fieldReasons.actionExplanation = 'TOO_SHORT_AFTER_CLIP' }
  } else {
    fieldsFellBack.push('actionExplanation')
    fieldReasons.actionExplanation = d.actionExplanation ? 'FIELD_UNSAFE' : 'MISSING'
  }

  const cards = {
    fatalInsight: { title: CARD_TITLES.fatalInsight, text: card01 },
    coreProblem: { title: CARD_TITLES.coreProblem, text: card02 },
    systemLoop: { title: CARD_TITLES.systemLoop, steps: card03Steps, insight: b2.systemLoop.insight || '', text: b2.systemLoop.text || card03Steps.join('\n') },
    turnaroundPath: { title: CARD_TITLES.turnaroundPath, from: card04From, to: card04To, logic: card04Logic, text: b2.turnaroundPath.text || card04Logic },
    firstAction: { title: CARD_TITLES.firstAction, action: card05Action, checks: b2.firstAction.checks.slice(), timebox: b2.firstAction.timebox || '', verifyWith: b2.firstAction.verifyWith || '', done: b2.firstAction.done || '', decision: b2.firstAction.decision || '', externalSignal: b2.firstAction.externalSignal === true, note: card05Note }
  }

  return {
    reportVersion: 'turnaround_strategy_v6_final_v1',
    reportState: 'PRIMARY',
    cards,
    provenance: b2Report.provenance,
    editor: {
      aiCallCount: 0,
      fieldsUsed,
      fieldsFellBack,
      fieldReasons,
      card01Len: chars(card01),
      card02Len: chars(card02)
    }
  }
}

/** Flatten all user-visible text of the FINAL report (for final validation). */
function finalVisibleText (report) {
  const c = report && report.cards
  if (!c) return ''
  return [
    c.fatalInsight && c.fatalInsight.text,
    c.coreProblem && c.coreProblem.text,
    c.systemLoop && (c.systemLoop.steps || []).join(' '),
    c.systemLoop && c.systemLoop.insight,
    c.turnaroundPath && c.turnaroundPath.from,
    c.turnaroundPath && c.turnaroundPath.to,
    c.turnaroundPath && c.turnaroundPath.logic,
    c.firstAction && c.firstAction.action,
    c.firstAction && (c.firstAction.checks || []).join(' '),
    c.firstAction && c.firstAction.done,
    c.firstAction && c.firstAction.decision,
    c.firstAction && c.firstAction.note
  ].filter(Boolean).join('\n')
}

module.exports = {
  CARD_TITLES,
  FINAL_LIMITS,
  firstSentences,
  clipToLimit,
  compressCard01,
  compressCard04Logic,
  compressCard04LogicHard,
  c04EndsComplete,
  polishTail,
  selectInsightCandidate,
  dedupeThesis,
  removeGenericFiller,
  editReportV6,
  finalVisibleText
}
