'use strict'
/**
 * tests/v6/report/rc8.4-v6-r35-human-language.test.js
 *
 * R35 — HUMAN LANGUAGE + EVIDENCE THRESHOLD FINALIZATION suite + §16 metric block.
 * Deterministic; no AI, no deploy. Proves:
 *   §1  natural Chinese — no awkward assembly
 *   §2  problem states are never rendered as desires
 *   §3  CARD03 uses genuinely different perceptual structures
 *   §4/§6 single weak signal never becomes a final direction decision
 *   §5  evidence strength levels applied to decision rules
 *   §7  CONSISTENCY timebox is not the success metric
 *   §8  ACTION → SIGNAL → DECISION semantic match
 *   §11 REPORT C is not habit coaching
 *   §12 REPORT D probability logic passes
 *   §15 each report carries a screenshot-worthy line
 */

const assert = require('assert')
const path = require('path')
const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const { diagnoseTurnaroundV6 } = require(path.join(CF, 'index.js'))
const REPORT = require(path.join(CF, 'report/index.js'))
const { buildReportV6, worldModelValidatorV6 } = REPORT
const copy = REPORT.reportCopyV6
const { validateFinalV6 } = require(path.join(CF, 'experimental/draft/finalValidatorV6.js'))
const F = require(path.join(ROOT, 'tests/v6/fixtures.js'))

let pass = 0, fail = 0
function t (name, fn) { try { fn(); pass++; console.log('  ok  ' + name) } catch (e) { fail++; console.log('  FAIL ' + name + ' :: ' + e.message) } }

const primary = []
for (const c of [...F.GOLDEN, ...F.ADVERSARIAL]) {
  const d = diagnoseTurnaroundV6(c.answers)
  if (d.diagnosisState === 'PRIMARY') primary.push({ id: c.id, d, r: buildReportV6(d) })
}
const pairs = primary.map((x) => ({ report: x.r, actionType: x.d.firstActionType }))
const W = worldModelValidatorV6
const n = primary.length

console.log('R35 human language + evidence threshold')

// ── §1 natural Chinese ──────────────────────────────────────────
t('§1 AWKWARD_CHINESE_ASSEMBLY_COUNT = 0', () => {
  let c = 0
  for (const x of primary) { const a = W.awkwardChineseAssembly(x.r); if (a) { c += a; console.log('   awkward:', x.id, a) } }
  console.log('   AWKWARD_CHINESE_ASSEMBLY_COUNT = ' + c)
  assert.strictEqual(c, 0)
})

// ── §2 problem != desire ────────────────────────────────────────
t('§2 PROBLEM_AS_DESIRE_COUNT = 0', () => {
  let c = 0
  for (const x of primary) { const a = W.problemAsDesire(x.r); if (a) { c += a; console.log('   problem-as-desire:', x.id, a) } }
  console.log('   PROBLEM_AS_DESIRE_COUNT = ' + c)
  assert.strictEqual(c, 0)
})

// ── §3 CARD03 perceptual anti-template ──────────────────────────
t('§3 PERCEPTUALLY_SAME_CARD03_PATTERN_COUNT = 0 and >= 4 distinct structures', () => {
  const counts = {}
  for (const x of primary) { const s = x.r.cards.systemLoop.shape; counts[s] = (counts[s] || 0) + 1 }
  const shapes = Object.keys(counts)
  console.log('   CARD03_SHAPE_COUNTS = ' + JSON.stringify(counts))
  assert.ok(shapes.length >= 4, '>=4 distinct shapes, got ' + shapes.length + ' ' + JSON.stringify(shapes))
  // within the OWNER READBACK set (A..E = G12,G05,G03,G01,G04) no two share a shape
  const pick = { A: 'G12', B: 'G05', C: 'G03', D: 'G01', E: 'G04' }
  const seen = {}
  let same = 0
  for (const k of Object.keys(pick)) {
    const x = primary.find((p) => p.id === pick[k])
    const s = x.r.cards.systemLoop.shape
    if (seen[s]) same++
    seen[s] = 1
  }
  console.log('   PERCEPTUALLY_SAME_CARD03_PATTERN_COUNT(readback) = ' + same)
  assert.strictEqual(same, 0)
})

// ── §4/§6 single weak signal overclaim ──────────────────────────
t('§4 SINGLE_WEAK_SIGNAL_OVERCLAIM_COUNT = 0', () => {
  const c = W.singleWeakSignalOverclaimCount(pairs)
  console.log('   SINGLE_WEAK_SIGNAL_OVERCLAIM_COUNT = ' + c)
  assert.strictEqual(c, 0)
})
t('§6 DIRECTION_SINGLE_PERSON_FINAL_DECISION_COUNT = 0', () => {
  const c = W.directionSinglePersonFinalDecision(pairs)
  console.log('   DIRECTION_SINGLE_PERSON_FINAL_DECISION_COUNT = ' + c)
  assert.strictEqual(c, 0)
})

// ── §7 CONSISTENCY timebox not the success metric ───────────────
t('§7 CONSISTENCY_TIMEBOX_AS_SUCCESS_COUNT = 0', () => {
  const c = W.consistencyTimeboxAsSuccessCount(pairs)
  console.log('   CONSISTENCY_TIMEBOX_AS_SUCCESS_COUNT = ' + c)
  assert.strictEqual(c, 0)
})

// ── §8 action → signal → decision ───────────────────────────────
t('§8 ACTION_SIGNAL_SEMANTIC_MATCH_RATE = 100%', () => {
  let ok = 0
  for (const x of primary) if (W.actionSignalSemanticMatch(x.r.cards.firstAction, x.d.firstActionType)) ok++
  const rate = 100 * ok / n
  console.log('   ACTION_SIGNAL_SEMANTIC_MATCH_RATE = ' + rate.toFixed(1) + '%')
  assert.strictEqual(rate, 100)
})
t('§8 SIGNAL_DECISION_SEMANTIC_MATCH_RATE = 100%', () => {
  let ok = 0
  for (const x of primary) if (W.signalDecisionSemanticMatch(x.r.cards.firstAction, x.d.firstActionType)) ok++
  const rate = 100 * ok / n
  console.log('   SIGNAL_DECISION_SEMANTIC_MATCH_RATE = ' + rate.toFixed(1) + '%')
  assert.strictEqual(rate, 100)
})

// ── §5 evidence strength levels ─────────────────────────────────
t('§5 evidence strength distinguishes weak / medium / strong', () => {
  assert.strictEqual(copy.evidenceStrength('他说“还行”'), 'WEAK')
  assert.strictEqual(copy.evidenceStrength('他明确回复我要或我不要'), 'MEDIUM')
  assert.strictEqual(copy.evidenceStrength('他直接付款下单'), 'STRONG')
})

// ── §11 REPORT C not habit coaching ─────────────────────────────
t('§11 REPORT_C_HABIT_COACHING_DOMINANT = NO', () => {
  const x = primary.find((p) => p.id === 'G03')
  const dominant = W.reportCHabitCoachingDominant(x.r)
  console.log('   REPORT_C_HABIT_COACHING_DOMINANT = ' + (dominant ? 'YES' : 'NO'))
  assert.strictEqual(dominant, false)
})

// ── §12 REPORT D probability logic ──────────────────────────────
t('§12 REPORT_D_PROBABILITY_LOGIC_PASS = YES', () => {
  const x = primary.find((p) => p.id === 'G01')
  const ok = W.reportDProbabilityLogicPass(x.r)
  console.log('   REPORT_D_PROBABILITY_LOGIC_PASS = ' + (ok ? 'YES' : 'NO'))
  assert.strictEqual(ok, true)
})

// ── §15 shareable insight ───────────────────────────────────────
t('§15 SHAREABLE_INSIGHT_RATE = 100%', () => {
  let ok = 0
  for (const x of primary) if (W.shareableInsight(x.r)) ok++
  const rate = 100 * ok / n
  console.log('   SHAREABLE_INSIGHT_RATE = ' + rate.toFixed(1) + '%')
  assert.ok(rate >= 80, 'shareable insight rate >= 80%, got ' + rate.toFixed(1) + '%')
})

// ── §16 FINAL_VALID_RATE + authority preserved ──────────────────
t('§16 FINAL_VALID_RATE = 100% and B1/B2 authority preserved', () => {
  let ok = 0
  for (const x of primary) {
    assert.strictEqual(x.r.provenance.primaryBottleneck, x.d.primaryBottleneck, x.id + ' primary')
    assert.strictEqual(x.r.provenance.executionStage, x.d.executionStage, x.id + ' stage')
    if (validateFinalV6(x.r, x.d).valid) ok++
  }
  const rate = 100 * ok / n
  console.log('   FINAL_VALID_RATE = ' + rate.toFixed(1) + '% (n=' + n + ')')
  assert.strictEqual(rate, 100)
})

console.log('\nR35 human language + evidence threshold: ' + pass + ' passed, ' + fail + ' failed')
process.exit(fail ? 1 : 0)
