'use strict'
/**
 * tests/v6/report/rc8.4-v6-r34-human-copy.test.js
 *
 * R34 — HUMAN COPY + REALITY TEST HARDENING suite + §13 metric block.
 * Deterministic; no AI, no deploy. Proves:
 *   §1  semantic role (DESIRED_STATE vs CURRENT_PROBLEM) — no inversion
 *   §2  unique evidence anchors capped (avg <= 3.0)
 *   §3  CARD01 anti-template (any single pattern <= 20%) + standalone shareable
 *   §4  CARD03 >= 3 structure families, dominant <= 50%
 *   §5/§7 no bare-productivity action; CONSISTENCY uses market-facing action
 *   §6/§8 REALITY TEST contract; signal answers hypothesis; decision reads signal
 *   §9  CARD02 humanized (no form-field assembly)
 *   §10 shareable world-rule one-liner
 *   §14 authority preserved, FINAL_VALID_RATE = 100%
 */

const assert = require('assert')
const path = require('path')
const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const { diagnoseTurnaroundV6 } = require(path.join(CF, 'index.js'))
const REPORT = require(path.join(CF, 'report/index.js'))
const { buildReportV6, worldModelValidatorV6 } = REPORT
const Q = REPORT.reportQualityV6
const { validateFinalV6 } = require(path.join(CF, 'experimental/draft/finalValidatorV6.js'))
const F = require(path.join(ROOT, 'tests/v6/fixtures.js'))

let pass = 0, fail = 0
function t (name, fn) { try { fn(); pass++; console.log('  ok  ' + name) } catch (e) { fail++; console.log('  FAIL ' + name + ' :: ' + e.message) } }

const cases = []
for (const g of F.GOLDEN) cases.push({ src: 'GOLDEN', id: g.id, answers: g.answers })
for (const a of F.ADVERSARIAL) cases.push({ src: 'ADV', id: a.id, answers: a.answers })

const primary = []
for (const c of cases) {
  const d = diagnoseTurnaroundV6(c.answers)
  if (d.diagnosisState === 'PRIMARY') primary.push({ ...c, d, r: buildReportV6(d) })
}
const W = worldModelValidatorV6
const n = primary.length

console.log('R34 human copy + reality test')

// ── §1 semantic role ────────────────────────────────────────────
t('§1 SEMANTIC_ROLE_INVERSION_COUNT = 0', () => {
  let c = 0
  for (const x of primary) c += W.semanticRoleInversion(x.r)
  console.log('   SEMANTIC_ROLE_INVERSION_COUNT = ' + c)
  assert.strictEqual(c, 0)
})

// ── §2 evidence anchor cap ──────────────────────────────────────
t('§2 AVG_UNIQUE_PERSONAL_EVIDENCE_ANCHORS <= 3.0', () => {
  let sum = 0, max = 0
  for (const x of primary) { const a = W.evidenceAnchors(x.r, x.d); sum += a.unique; max = Math.max(max, a.unique) }
  const avg = sum / n
  console.log('   AVG_UNIQUE_PERSONAL_EVIDENCE_ANCHORS = ' + avg.toFixed(2) + ' (max ' + max + ')')
  assert.ok(avg <= 3.0, 'avg anchors must be <= 3.0, got ' + avg.toFixed(2))
})

// ── §3 CARD01 anti-template + shareable ─────────────────────────
t('§3 ANY_SINGLE_CARD01_PATTERN_RATE <= 20%', () => {
  const p = W.card01PatternRate(primary.map((x) => x.r))
  console.log('   ANY_SINGLE_CARD01_PATTERN_RATE = ' + p.rate.toFixed(1) + '% ' + JSON.stringify(p.counts))
  assert.ok(p.rate <= 20, 'card01 pattern dominance must be <= 20%, got ' + p.rate.toFixed(1) + '%')
})
t('§3 CARD01_CAN_STAND_ALONE_AS_SHAREABLE_INSIGHT = YES for all primary', () => {
  let ok = 0
  for (const x of primary) if (W.card01StandaloneShareable(x.r.cards.fatalInsight)) ok++
  console.log('   CARD01_CAN_STAND_ALONE_AS_SHAREABLE_INSIGHT = ' + (100 * ok / n).toFixed(1) + '%')
  assert.strictEqual(ok, n)
})

// ── §4 CARD03 structure variation ───────────────────────────────
t('§4 CARD03_STRUCTURE_FAMILY_COUNT >= 3 and DOMINANT_CARD03_STRUCTURE_RATE <= 50%', () => {
  const f = W.card03StructureDistribution(primary.map((x) => x.r))
  console.log('   CARD03_STRUCTURE_FAMILY_COUNT = ' + f.familyCount + ' ' + JSON.stringify(f.counts))
  console.log('   DOMINANT_CARD03_STRUCTURE_RATE = ' + f.dominantRate.toFixed(1) + '%')
  assert.ok(f.familyCount >= 3, 'families >= 3, got ' + f.familyCount)
  assert.ok(f.dominantRate <= 50, 'dominant <= 50%, got ' + f.dominantRate.toFixed(1) + '%')
  for (const x of primary) assert.strictEqual(x.r.cards.systemLoop.steps.length, 5, x.id + ' 5 nodes')
})

// ── §5/§7 no bare productivity; CONSISTENCY is market-facing ────
t('§5 GENERIC_PRODUCTIVITY_WITH_DECORATIVE_SIGNAL_COUNT = 0', () => {
  let c = 0
  for (const x of primary) if (W.genericProductivityWithDecorativeSignal(x.r.cards.firstAction)) { c++; console.log('   decor:', x.id) }
  console.log('   GENERIC_PRODUCTIVITY_WITH_DECORATIVE_SIGNAL_COUNT = ' + c)
  assert.strictEqual(c, 0)
})
t('§7 CONSISTENCY_HABIT_ONLY_ACTION_COUNT = 0', () => {
  const HABIT = REPORT.reportCopyV6.HABIT_ONLY_PAT
  const MARKET = REPORT.reportCopyV6.MARKET_FACING_PAT
  let c = 0
  for (const x of primary) {
    if (x.d.firstActionType !== 'CONSISTENCY_PROTECTION') continue
    const act = x.r.cards.firstAction.action
    const marketFacing = MARKET.test(act)
    if (HABIT.test(act) && !marketFacing) { c++; console.log('   habit-only:', x.id, act) }
  }
  console.log('   CONSISTENCY_HABIT_ONLY_ACTION_COUNT = ' + c)
  assert.strictEqual(c, 0)
})

// ── §6 reality test semantic contract ───────────────────────────
t('§6 REALITY TEST defines HYPOTHESIS/ACTION/TARGET/TIMEBOX/SIGNAL/DECISION', () => {
  for (const x of primary) {
    const a = x.r.cards.firstAction
    for (const k of ['hypothesis', 'action', 'target', 'timebox', 'done', 'decision']) {
      assert.ok(typeof a[k] === 'string' && a[k].trim().length > 0, x.id + ' missing ' + k)
    }
  }
})
t('§6 ACTION_SIGNAL_SEMANTIC_MATCH_RATE = 100%', () => {
  let ok = 0
  for (const x of primary) { if (W.actionSignalSemanticMatch(x.r.cards.firstAction, x.d.firstActionType)) ok++ }
  const rate = 100 * ok / n
  console.log('   ACTION_SIGNAL_SEMANTIC_MATCH_RATE = ' + rate.toFixed(1) + '%')
  assert.strictEqual(rate, 100)
})
t('§6 SIGNAL_DECISION_SEMANTIC_MATCH_RATE = 100%', () => {
  let ok = 0
  for (const x of primary) { if (W.signalDecisionSemanticMatch(x.r.cards.firstAction, x.d.firstActionType)) ok++ }
  const rate = 100 * ok / n
  console.log('   SIGNAL_DECISION_SEMANTIC_MATCH_RATE = ' + rate.toFixed(1) + '%')
  assert.strictEqual(rate, 100)
})

// ── §8 repeatability signal/decision ────────────────────────────
t('§8 REPEATABILITY_SIGNAL_DECISION_MISMATCH_COUNT = 0', () => {
  let c = 0
  for (const x of primary) if (W.repeatabilitySignalDecisionMismatch(x.r.cards.firstAction, x.d.firstActionType)) { c++; console.log('   mismatch:', x.id) }
  console.log('   REPEATABILITY_SIGNAL_DECISION_MISMATCH_COUNT = ' + c)
  assert.strictEqual(c, 0)
})

// ── §9 CARD02 humanization ──────────────────────────────────────
t('§9 FORM_FIELD_ASSEMBLY_FEEL_COUNT = 0', () => {
  let c = 0
  for (const x of primary) if (W.formFieldAssemblyFeel(x.r.cards.coreProblem)) { c++; console.log('   form:', x.id) }
  console.log('   FORM_FIELD_ASSEMBLY_FEEL_COUNT = ' + c)
  assert.strictEqual(c, 0)
})

// ── §10 shareable world rule line ───────────────────────────────
t('§10 SHAREABLE_WORLD_RULE_LINE_RATE >= 80%', () => {
  let ok = 0
  for (const x of primary) if (W.hasShareableWorldRuleLine(x.r)) ok++
  const rate = 100 * ok / n
  console.log('   SHAREABLE_WORLD_RULE_LINE_RATE = ' + rate.toFixed(1) + '%')
  assert.ok(rate >= 80, 'shareable world rule line rate must be >= 80%, got ' + rate.toFixed(1) + '%')
})

// ── §14 FINAL_VALID_RATE + authority preserved ──────────────────
t('§14 FINAL_VALID_RATE = 100% and authority preserved', () => {
  let ok = 0
  for (const x of primary) {
    const d = diagnoseTurnaroundV6(x.answers)
    const r = buildReportV6(d)
    assert.strictEqual(r.provenance.primaryBottleneck, d.primaryBottleneck, x.id + ' primary')
    assert.strictEqual(r.provenance.executionStage, d.executionStage, x.id + ' stage')
    if (validateFinalV6(r, d).valid) ok++
  }
  const rate = 100 * ok / n
  console.log('   FINAL_VALID_RATE = ' + rate.toFixed(1) + '% (n=' + n + ')')
  assert.strictEqual(rate, 100)
})

// ── §12/§11 no cross-card duplication / no exact card duplicates ─
t('§11/§12 CROSS_CARD_DUPLICATE_IDEA_COUNT = 0', () => {
  let d = 0
  for (const x of primary) d += Q.crossCardDuplicateIdeas(x.r).count
  console.log('   CROSS_CARD_DUPLICATE_IDEA_COUNT = ' + d)
  assert.strictEqual(d, 0)
})

console.log('\nR34 human copy + reality test: ' + pass + ' passed, ' + fail + ' failed')
process.exit(fail ? 1 : 0)
