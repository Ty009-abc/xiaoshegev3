'use strict'
/**
 * tests/v6/draft/rc8.4-v6-r15-card04.test.js
 *
 * R15 — CARD04 (turnaroundPath.logic) SENTENCE-BOUNDARY POLISH offline regression.
 * NO network, NO provider, NO key.
 *
 * Fix under test: the 40-char card04ToMax bound used to hard-cut mid-sentence
 * (greedy comma-fragment accumulation that ignored sentence boundaries). R15
 * applies the same deterministic, punctuation-aware compression philosophy
 * already proven for CARD01.
 *
 * Required named checks (§6):
 *   CARD04_SENTENCE_BOUNDARY_PREFERRED
 *   CARD04_HALF_SENTENCE_CASE_COUNT_IS_ZERO
 *   CARD04_INCOMPLETE_CLAUSE_CASE_COUNT_IS_ZERO
 *   CARD04_FROM_TO_DIFF_COUNT_IS_ZERO
 *   CARD04_HARD_LIMIT_IS_CURRENT_LIMIT
 *   CARD04_EDITOR_AI_CALL_COUNT_IS_ZERO
 *   CARD04_UNSUPPORTED_CLAIM_COUNT_IS_ZERO
 *   CARD04_NEVER_EXCEEDS_LIMIT
 *   CARD04_R14_REGRESSION_CASES (G01/G06/G15 exact R14 canary sources)
 *   CARD04_ADVERSARIAL_LONG_CLAUSE
 */

const assert = require('assert')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')

const { diagnoseTurnaroundV6 } = require(path.join(CF, 'index.js'))
const { buildReportV6 } = require(path.join(CF, 'report/index.js'))
const editor = require(path.join(CF, 'experimental/draft/reportEditorV6.js'))
const { editReportV6, compressCard04Logic, compressCard01, FINAL_LIMITS } = editor
const { validateDraftV6 } = require(path.join(CF, 'experimental/draft/draftValidatorV6.js'))
const { validateFinalV6 } = require(path.join(CF, 'experimental/draft/finalValidatorV6.js'))
const F = require(path.join(ROOT, 'tests/v6/fixtures.js'))

const chars = (s) => (s == null ? 0 : [...String(s)].length)

let pass = 0
let fail = 0
function t (name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name) } catch (e) { fail++; console.log('  FAIL ' + name + ' :: ' + e.message) }
}

const G = (id) => F.GOLDEN.find((g) => g.id === id).answers

// ── R14 canary sources (raw transitionExplanation material as produced by the
//    real deepseek-flash draft in R14; reconstructed faithfully from the
//    recorded R14 finals) ──
const R14_SRC = {
  G01: '下一阶段从研究转向起步，规则会从先判断哪个最好，变成先去真实测试一次。因为方向不是想出来的，是试出来的。',
  G06: '在还没开始的时候，规则是“先想清楚、别出错、别浪费”。一旦进入真正开始的状态，衡量标准就变成“有没有做出一个能被看见的真实小结果”。',
  G15: '现在能靠零散成交获得一点稳定感，但这撑不起下一个月。下一阶段的规则不是再多一次成交，而是把最近一次有效成交拆成可复制的步骤。'
}

// R14 recorded defective finals (all three clipped mid-sentence).
const R14_FINALS = {
  G01: '下一阶段从研究转向起步，规则会从先判断哪个最好',
  G06: '在还没开始的时候，规则是“先想清楚、别出错、别浪费”。一旦进入真正开始的状态',
  G15: '现在能靠零散成交获得一点稳定感'
}

const DRAFT = (transition) => ({
  draftVersion: 'turnaround_strategy_v6_worldview_draft_v1',
  insightCandidates: ['你以为缺的是方向，其实你缺的是一次真实反馈。'],
  mechanismExplanation: '你在准备里原地打转，真实反馈一直是零，压力却不断累积。',
  transitionExplanation: transition,
  actionExplanation: '今天做一个零成本、能马上拿到反馈的动作。'
})

/** True if the text looks like a sentence left hanging mid-thought. */
function halfSentence (s) {
  if (/[，,、]$/.test(s)) return true // ends on a PARTIAL-clause separator
  if (/(而|只有|其实|因为|所以|于是|一旦|如果|即使|当|在|变成|转向|从)$/.test(s)) return true // dangling connective
  return false
}

/** True if the text ends mid-sentence with NO terminal punctuation (and is a
 *  truncation of a longer source rather than a naturally short clause).
 *  A complete sentence ender (。！？) OR a complete-clause ender (；：) counts as
 *  a proper boundary; ending on a partial separator (，、) or a bare character
 *  does not. */
function incompleteClause (out, src) {
  if (chars(src) <= chars(out)) return false // did not truncate
  if (/[。！？!?；;：:]$/.test(out)) return false // complete sentence/clause
  // The source may itself offer no boundary inside the limit → hard truncation
  // (absolute last resort) is permitted by policy.
  const window = [...String(src)].slice(0, chars(out) + 2).join('')
  if (!/[。！？!?；;：:]/.test(window)) return false
  return true
}

const cases = ['G01', 'G06', 'G15']

console.log('R15 CARD04 sentence-boundary tests')

// ── §5 length policy unchanged ──────────────────────────────────
t('CARD04_HARD_LIMIT_IS_CURRENT_LIMIT', () => {
  assert.strictEqual(FINAL_LIMITS.card04ToMax, 40, 'card04ToMax must remain the current 40-char product limit')
})

// ── §2/§3 the fix exists and is deterministic ───────────────────
t('CARD04_SENTENCE_BOUNDARY_PREFERRED', () => {
  const s1 = '在还没开始的时候，规则是"先想清楚、别出错、别浪费"。'
  const s2 = '一旦进入真正开始的状态，衡量标准就变成"有没有做出一个能被看见的真实小结果"，这和你现在熟悉的判断方式完全不同。'
  const out = compressCard04Logic(s1 + s2, 40)
  assert.ok(chars(out) <= 40, 'output must be <= 40: ' + out)
  assert.ok(out.endsWith('。'), 'must end on a complete sentence: ' + out)
  assert.strictEqual(out, s1.trim())
})

t('CARD04_NEVER_EXCEEDS_LIMIT', () => {
  const src = '一二三四五六七八九十'.repeat(6)
  const out = compressCard04Logic(src, 40)
  assert.ok(chars(out) <= 40, 'len=' + chars(out))
})

// ── §6 targeted regression: half-sentence / incomplete-clause counts ──
t('CARD04_HALF_SENTENCE_CASE_COUNT_IS_ZERO', () => {
  let half = 0
  for (const id of cases) {
    const out = compressCard04Logic(R14_SRC[id], FINAL_LIMITS.card04ToMax)
    if (halfSentence(out)) { half++; console.log('    half:', id, JSON.stringify(out)) }
  }
  assert.strictEqual(half, 0, 'CARD04_HALF_SENTENCE_CASE_COUNT must be 0, got ' + half)
})

t('CARD04_INCOMPLETE_CLAUSE_CASE_COUNT_IS_ZERO', () => {
  let incomplete = 0
  for (const id of cases) {
    const out = compressCard04Logic(R14_SRC[id], FINAL_LIMITS.card04ToMax)
    if (incompleteClause(out, R14_SRC[id])) { incomplete++; console.log('    incomplete:', id, JSON.stringify(out)) }
  }
  assert.strictEqual(incomplete, 0, 'CARD04_INCOMPLETE_CLAUSE_CASE_COUNT must be 0, got ' + incomplete)
})

// ── §3 R14 vs R15 product readback (the exact canary classes) ────
t('CARD04_R14_REGRESSION_CASES', () => {
  for (const id of cases) {
    const d = diagnoseTurnaroundV6(G(id))
    const b = buildReportV6(d)
    const draft = DRAFT(R14_SRC[id])
    const dv = validateDraftV6(draft, d)
    const ed = editReportV6({ diagnosis: d, b2Report: b, draft, draftVerdict: dv })
    const fin = ed.cards.turnaroundPath.logic
    assert.ok(chars(fin) <= FINAL_LIMITS.card04ToMax, id + ' must be <=40: ' + fin)
    // MID_SENTENCE_TRUNCATION_REMOVED: R15 must end on a boundary (terminal
    // punctuation or a clean whole clause), never mid-word/half-clause.
    assert.ok(!halfSentence(fin), id + ' must not end on a dangling fragment: ' + fin)
    assert.ok(!incompleteClause(fin, R14_SRC[id]), id + ' must not cut mid-sentence: ' + fin)
    // STRATEGIC_MEANING_PRESERVED: the result is a prefix of the source material.
    assert.ok(R14_SRC[id].includes(fin.replace(/[""]/g, '"')), id + ' result must be a prefix of source: ' + fin)
  }
})

// ── §4 authority preservation: FROM/TO never modified ───────────
t('CARD04_FROM_TO_DIFF_COUNT_IS_ZERO', () => {
  let diffs = 0
  for (const id of cases) {
    const d = diagnoseTurnaroundV6(G(id))
    const b = buildReportV6(d)
    const draft = DRAFT(R14_SRC[id])
    const dv = validateDraftV6(draft, d)
    const ed = editReportV6({ diagnosis: d, b2Report: b, draft, draftVerdict: dv })
    if (ed.cards.turnaroundPath.from !== b.cards.turnaroundPath.from) diffs++
    if (ed.cards.turnaroundPath.to !== b.cards.turnaroundPath.to) diffs++
  }
  assert.strictEqual(diffs, 0, 'CARD04_FROM_TO_DIFF_COUNT must be 0, got ' + diffs)
})

// ── §6 unsupported claims: compression introduces no new numbers ──
t('CARD04_UNSUPPORTED_CLAIM_COUNT_IS_ZERO', () => {
  let bad = 0
  for (const id of cases) {
    const d = diagnoseTurnaroundV6(G(id))
    const b = buildReportV6(d)
    const draft = DRAFT(R14_SRC[id])
    const dv = validateDraftV6(draft, d)
    const ed = editReportV6({ diagnosis: d, b2Report: b, draft, draftVerdict: dv })
    const fv = validateFinalV6(ed, d)
    if (fv.hardFailures.includes('UNSUPPORTED_USER_CLAIM')) bad++
    assert.strictEqual(fv.valid, true, id + ' final must be valid: ' + JSON.stringify(fv.hardFailures))
  }
  assert.strictEqual(bad, 0, 'UNSUPPORTED_CLAIM_COUNT must be 0, got ' + bad)
})

// ── §3 editor makes no AI call; compression is pure ─────────────
t('CARD04_EDITOR_AI_CALL_COUNT_IS_ZERO', () => {
  for (const id of cases) {
    const d = diagnoseTurnaroundV6(G(id))
    const b = buildReportV6(d)
    const dv = validateDraftV6(DRAFT(R14_SRC[id]), d)
    const ed = editReportV6({ diagnosis: d, b2Report: b, draft: DRAFT(R14_SRC[id]), draftVerdict: dv })
    assert.strictEqual(ed.editor.aiCallCount, 0)
  }
})

// ── §6 adversarial long-clause cases ────────────────────────────
t('CARD04_ADVERSARIAL_LONG_CLAUSE', () => {
  const adversarial = [
    // A single very long clause with no terminal punctuation at all.
    '下一阶段的规则会从先判断哪个最好变成先去真实拿到一次反馈再决定要不要继续投入并且不断重复这个循环直到结果出现',
    // Long clause, comma inside the first 40 chars.
    '当你在准备阶段时规则是让自己感觉更安全，进入开始阶段后规则变成让现实给你反馈，这两者的判断依据完全不同所以下一步必须改变',
    // Leading short complete sentence + very long trailing clause.
    '规则变了。不再是谁准备得更充分谁就赢，而是谁先把一个能被外界回应的动作交出去谁就先拿到真实信息并据此调整方向',
    // Exactly-limit single clause (boundary edge).
    '规则会从先判断哪个最好变成先去真实拿一次反馈再决定'
  ]
  for (const src of adversarial) {
    const out = compressCard04Logic(src, FINAL_LIMITS.card04ToMax)
    assert.ok(chars(out) <= FINAL_LIMITS.card04ToMax, 'adversarial must be <=40: ' + out)
    assert.ok(!halfSentence(out), 'adversarial must not end dangling: ' + JSON.stringify(out))
    assert.ok(!/^[\s]*$/.test(out), 'adversarial must be non-empty')
    // §6 incomplete-clause: a full source boundary may be kept, never a partial cut.
    assert.ok(!incompleteClause(out, src), 'adversarial must not cut mid-clause: ' + JSON.stringify(out))
  }
})

// ── §2 the EXACT R14 defect class: a 38-char material ending mid-clause ──
t('CARD04_R14_38CHAR_SUB_LIMIT_CASE', () => {
  // The R14 defect shipped 38 chars of unfinished sentence even though a full
  // sentence boundary existed inside the window. Sub-limit material must still
  // be boundary-checked (this is the regression that first exposed the gap).
  const src = '下一阶段的安全感来源不同：准备阶段的规则是尽量不出错、先保住现金流；开始阶段的规则是让动作小到失败也不伤生存，再靠真实反馈修正。'
  const out = compressCard04Logic(src, FINAL_LIMITS.card04ToMax)
  assert.ok(chars(out) <= 40, 'must be <=40: ' + out)
  assert.ok(!halfSentence(out), 'must not end on a partial separator/dangling: ' + out)
  assert.ok(!incompleteClause(out, src), 'must not cut mid-clause: ' + out)
  assert.ok(src.includes(out), 'must be a prefix of source')
})

// helpers still consistent
t('helper: compressCard01 unchanged behaviour (no cross-regression)', () => {
  const s1 = '你以为缺的是资源，其实你缺的是一次外部反馈。'
  const s2 = '可是你一直在准备，从来没有真正让市场给过你任何一次真实回应并且一直等待更充分的时机。'
  const out = compressCard01(s1 + s2, 60)
  assert.ok(chars(out) <= 60)
  assert.strictEqual(out, s1)
})

console.log(`\nR15 CARD04: ${pass} passed, ${fail} failed`)
if (fail) process.exitCode = 1
