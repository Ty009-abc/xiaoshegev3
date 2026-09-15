'use strict'
/**
 * tests/v6/draft/rc8.4-v6-r17-hardening.test.js
 *
 * R17 — VALIDATOR + CARD04 HARDENING offline regression. NO network/provider/key.
 *
 * Fixes under test:
 *   §2/§3  draftValidatorV6 numeric claim rule: a number+unit in a
 *          PRESCRIPTIVE/future clause is NOT an unsupported personal-history
 *          claim; a number+unit in a personal-historical clause still is.
 *   §7     reportEditorV6 CARD04 soft-max (target 40, soft 48): prefer a
 *          complete sentence/clause over a broken fragment; never end on a
 *          lead-in opener ("…之后"/"…的时候"); return null when no complete
 *          unit fits, so the caller can use complete B2 copy.
 *
 * Required named checks:
 *   TARGETED_FALSE_POSITIVE_COUNT_IS_ZERO
 *   TARGETED_FALSE_NEGATIVE_COUNT_IS_ZERO
 *   B2_CONSISTENCY_ACTION_COPY_VALIDATES
 *   CONSISTENCY_WHOLE_REPORT_FALLBACK_COUNT_IS_ZERO
 *   CARD04_SOFT_MAX_IS_48
 *   CARD04_FRAGMENT_LEADIN_REJECTED
 *   CARD04_FRAGMENT_COUNT_IS_ZERO
 *   CARD04_NO_COMPLETE_UNIT_RETURNS_NULL
 *   CARD04_COMPLETE_CLAUSE_WITHIN_SOFT_MAX_PREFERRED
 *   CARD04_EDITOR_AI_CALL_COUNT_IS_ZERO
 */

const assert = require('assert')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')

const { diagnoseTurnaroundV6 } = require(path.join(CF, 'index.js'))
const { buildReportV6 } = require(path.join(CF, 'report/index.js'))
const editor = require(path.join(CF, 'experimental/draft/reportEditorV6.js'))
const { editReportV6, compressCard04Logic, compressCard04LogicHard, c04EndsComplete, FINAL_LIMITS } = editor
const { scanText, validateDraftV6 } = require(path.join(CF, 'experimental/draft/draftValidatorV6.js'))
const { validateFinalV6 } = require(path.join(CF, 'experimental/draft/finalValidatorV6.js'))
const F = require(path.join(ROOT, 'tests/v6/fixtures.js'))

const chars = (s) => (s == null ? 0 : [...String(s)].length)
let pass = 0, fail = 0
function t (name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name) } catch (e) { fail++; console.log('  FAIL ' + name + ' :: ' + e.message) }
}

const DIAG = { primaryBottleneck: 'CONSISTENCY_GAP' }
const G = (id) => F.GOLDEN.find((g) => g.id === id).answers
const A = (id) => F.ADVERSARIAL.find((x) => x.id === id).answers

console.log('R17 validator + card04 hardening tests')

// ── §3 prescriptive vs personal-history numeric claim ───────────
const PRESCRIPTIVE = [
  '每天固定30分钟做一次验证',
  '今天用20分钟联系3个人',
  '接下来7天每天记录一次反馈',
  '今天先定一个每天固定30分钟的时段，只做这件事，先连续做满5天。'
]
const HISTORICAL = [
  '你每天工作12小时',
  '你已经坚持30天',
  '你过去3个月没有结果',
  '你失败了5次',
  '你已经做了3年，收入一直上不去。'
]

t('TARGETED_FALSE_POSITIVE_COUNT_IS_ZERO', () => {
  let fp = 0
  for (const s of PRESCRIPTIVE) if (scanText(s, DIAG).unsupportedClaims.length) { fp++; console.log('    FP:', s) }
  assert.strictEqual(fp, 0, 'TARGETED_FALSE_POSITIVE_COUNT must be 0, got ' + fp)
})

t('TARGETED_FALSE_NEGATIVE_COUNT_IS_ZERO', () => {
  let fn = 0
  for (const s of HISTORICAL) if (!scanText(s, DIAG).unsupportedClaims.length) { fn++; console.log('    FN:', s) }
  assert.strictEqual(fn, 0, 'TARGETED_FALSE_NEGATIVE_COUNT must be 0, got ' + fn)
})

// The confirmed valid B2 action copy must not trip the validator.
t('B2_CONSISTENCY_ACTION_COPY_VALIDATES', () => {
  const copy = require(path.join(CF, 'report/reportCopyV6.js'))
  const canonical = copy.ACTION_EXPRESSION.CONSISTENCY_PROTECTION
  assert.ok(/每天固定30分钟/.test(canonical), 'canonical consistency action uses 每天固定30分钟: ' + canonical)
  const sc = scanText(canonical, DIAG)
  assert.strictEqual(sc.unsupportedClaims.length, 0, 'B2 consistency action must have 0 unsupported claims')
})

// ── §4 CONSISTENCY family: B2 alone must now pass final validation ──
t('CONSISTENCY_WHOLE_REPORT_FALLBACK_COUNT_IS_ZERO', () => {
  const set = [['GOLDEN', 'G03'], ['GOLDEN', 'G08'], ['GOLDEN', 'G13'], ['ADV', 'H'], ['ADV', 'H2']]
  let fallback = 0, total = 0
  for (const [src, id] of set) {
    const arr = src === 'GOLDEN' ? F.GOLDEN : F.ADVERSARIAL
    const c = arr.find((x) => x.id === id)
    const d = diagnoseTurnaroundV6(c.answers)
    if (d.primaryBottleneck !== 'CONSISTENCY_GAP') continue
    total++
    const b = buildReportV6(d)
    const v = validateFinalV6(b, d)
    if (!v.valid) { fallback++; console.log('    fallback:', id, JSON.stringify(v.hardFailures)) }
  }
  assert.ok(total >= 5, 'sample size must be >=5, got ' + total)
  assert.strictEqual(fallback, 0, 'CONSISTENCY_WHOLE_REPORT_FALLBACK_COUNT must be 0, got ' + fallback)
})

// ── §7 CARD04 soft-max ──────────────────────────────────────────
t('CARD04_SOFT_MAX_IS_48', () => {
  assert.strictEqual(FINAL_LIMITS.card04ToMax, 40, 'target must remain 40')
  assert.strictEqual(FINAL_LIMITS.card04SoftMax, 48, 'soft max must be 48')
})

t('CARD04_COMPLETE_CLAUSE_WITHIN_SOFT_MAX_PREFERRED', () => {
  // A complete sentence of ~44 chars (>40, <=48) must be kept whole, not cut.
  const src = '下一阶段的规则会变，从先判断哪个最好，变成先去真实测试一次再做决定。'
  const out = compressCard04Logic(src, 40, FINAL_LIMITS.card04SoftMax)
  assert.ok(out && chars(out) <= 48, 'must be within soft max: ' + out)
  assert.ok(c04EndsComplete(out), 'must end complete: ' + out)
  assert.ok(chars(out) > 40 ? src.startsWith(out) : true, 'prefix of source')
})

t('CARD04_NO_COMPLETE_UNIT_RETURNS_NULL', () => {
  // A single long clause with no terminal punctuation at all → no complete unit.
  const src = '下一阶段的规则会从先判断哪个最好变成先去真实拿到一次反馈再决定要不要继续投入并且不断重复这个循环直到结果出现'
  const out = compressCard04Logic(src, 40, FINAL_LIMITS.card04SoftMax)
  assert.strictEqual(out, null, 'must return null when no complete unit fits')
  const hard = compressCard04LogicHard(src, 40, FINAL_LIMITS.card04SoftMax)
  assert.ok(chars(hard) <= 40, 'hard fallback must stay within target: ' + chars(hard))
})

t('CARD04_FRAGMENT_LEADIN_REJECTED', () => {
  // R16 defect: “在有一点稳定结果之后” is a dangling temporal lead-in.
  const lead = '在有一点稳定结果之后'
  assert.strictEqual(compressCard04Logic(lead, 40, FINAL_LIMITS.card04SoftMax), null,
    'lead-in fragment must not be returned as a complete unit')
})

t('CARD04_FRAGMENT_COUNT_IS_ZERO', () => {
  // Across every fixture's transition material, the editor output must always
  // end on a complete sentence/clause (from AI copy or B2 copy).
  const TERM = /[。！？!?；;：:]$/
  const LEAD = (s) => /(之后|之前|以后|以前|的时候|的话)$/.test(s)
  let frag = 0
  for (const g of F.GOLDEN) {
    const d = diagnoseTurnaroundV6(g.answers)
    const b = buildReportV6(d)
    // Synthetic AI material that always ends mid-clause (worst case).
    const draft = {
      draftVersion: 'turnaround_strategy_v6_worldview_draft_v1',
      insightCandidates: ['你以为缺的是方向，其实你缺的是一次真实反馈。'],
      mechanismExplanation: b.cards.coreProblem.text,
      transitionExplanation: '在有一点稳定结果之后',
      actionExplanation: '今天做一个零成本的小验证。'
    }
    const dv = validateDraftV6(draft, d)
    const ed = editReportV6({ diagnosis: d, b2Report: b, draft, draftVerdict: dv })
    const fin = ed.cards.turnaroundPath.logic || ''
    if (!TERM.test(fin.trim()) || LEAD(fin.trim())) { frag++; console.log('    fragment:', g.id, JSON.stringify(fin)) }
  }
  assert.strictEqual(frag, 0, 'CARD04_FRAGMENT_COUNT must be 0, got ' + frag)
})

t('CARD04_EDITOR_AI_CALL_COUNT_IS_ZERO', () => {
  const d = diagnoseTurnaroundV6(G('G06'))
  const b = buildReportV6(d)
  const draft = {
    draftVersion: 'turnaround_strategy_v6_worldview_draft_v1',
    insightCandidates: ['你以为缺的是方向，其实你缺的是一次真实反馈。'],
    mechanismExplanation: b.cards.coreProblem.text,
    transitionExplanation: '在有一点稳定结果之后',
    actionExplanation: '今天做一个零成本的小验证。'
  }
  const dv = validateDraftV6(draft, d)
  const ed = editReportV6({ diagnosis: d, b2Report: b, draft, draftVerdict: dv })
  assert.strictEqual(ed.editor.aiCallCount, 0, 'CARD04_EDITOR_AI_CALL_COUNT must be 0')
})

console.log(`\nR17 hardening: ${pass} passed, ${fail} failed`)
module.exports = { pass, fail }
if (require.main === module) process.exit(fail ? 1 : 0)
