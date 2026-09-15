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
    let t = polishTail(removeGenericFiller(clipToLimit(selectedRaw, FINAL_LIMITS.card01Max)))
    if (chars(t) > FINAL_LIMITS.card01Max) t = polishTail(clipToLimit(t, FINAL_LIMITS.card01Max))
    if (t && chars(t) >= 8) { card01 = t; fieldsUsed.push('insightCandidates') } else { card01 = b2.fatalInsight.text; fieldsFellBack.push('insightCandidates'); fieldReasons.insightCandidates = 'TOO_SHORT_AFTER_CLIP' }
  } else {
    card01 = b2.fatalInsight.text
    fieldsFellBack.push('insightCandidates')
    fieldReasons.insightCandidates = selectedRaw ? 'FIELD_UNSAFE' : 'NO_USABLE_CANDIDATE'
  }
  // HARD cap enforcement (CARD01 must never exceed 60).
  if (chars(card01) > FINAL_LIMITS.card01Max) card01 = clipToLimit(card01, FINAL_LIMITS.card01Max)

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
    let t = polishTail(removeGenericFiller(dedupeThesis(firstSentences(d.transitionExplanation, 2))))
    if (chars(t) > FINAL_LIMITS.card04ToMax) t = polishTail(clipToLimit(t, FINAL_LIMITS.card04ToMax))
    if (chars(t) >= 10) { card04Logic = t; fieldsUsed.push('transitionExplanation') } else { fieldsFellBack.push('transitionExplanation'); fieldReasons.transitionExplanation = 'TOO_SHORT_AFTER_CLIP' }
  } else {
    fieldsFellBack.push('transitionExplanation')
    fieldReasons.transitionExplanation = d.transitionExplanation ? 'FIELD_UNSAFE' : 'MISSING'
  }
  const card04From = b2.turnaroundPath.from
  const card04To = b2.turnaroundPath.to

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
    systemLoop: { title: CARD_TITLES.systemLoop, steps: card03Steps },
    turnaroundPath: { title: CARD_TITLES.turnaroundPath, from: card04From, to: card04To, logic: card04Logic },
    firstAction: { title: CARD_TITLES.firstAction, action: card05Action, checks: b2.firstAction.checks.slice(), note: card05Note }
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
    c.turnaroundPath && c.turnaroundPath.from,
    c.turnaroundPath && c.turnaroundPath.to,
    c.turnaroundPath && c.turnaroundPath.logic,
    c.firstAction && c.firstAction.action,
    c.firstAction && (c.firstAction.checks || []).join(' '),
    c.firstAction && c.firstAction.note
  ].filter(Boolean).join('\n')
}

module.exports = {
  CARD_TITLES,
  FINAL_LIMITS,
  firstSentences,
  clipToLimit,
  polishTail,
  selectInsightCandidate,
  dedupeThesis,
  removeGenericFiller,
  editReportV6,
  finalVisibleText
}
