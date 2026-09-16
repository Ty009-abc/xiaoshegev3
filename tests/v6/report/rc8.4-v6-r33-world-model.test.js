'use strict'
/**
 * tests/v6/report/rc8.4-v6-r33-world-model.test.js
 *
 * R33 — WORLD-MODEL-FIRST report engine suite + §18 metrics.
 * Deterministic; no AI. Asserts:
 *   - WORLD_RULE_LIBRARY + candidate mapping (zero diagnosis authority)
 *   - CARD01 wrong-rule collision, CARD02 diagnostic leap, CARD03 one loop,
 *     CARD04 old->new rule + mechanism, CARD05 external signal + decision
 *   - WORLD_MODEL_SHIFT_PRESENT / GENERIC_PRODUCTIVITY_ACTION /
 *     ANSWER_RESTATEMENT_ONLY / anchor counts
 * Returns the §18 metric block.
 */

const assert = require('assert')
const path = require('path')
const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const { diagnoseTurnaroundV6 } = require(path.join(CF, 'index.js'))
const REPORT = require(path.join(CF, 'report/index.js'))
const { buildReportV6, visibleText, worldRuleLibraryV6, worldModelValidatorV6 } = REPORT
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
  if (d.diagnosisState === 'PRIMARY') primary.push({ ...c, d })
}

console.log('R33 world-model-first report engine')

// ── §3/§4 WORLD_RULE_LIBRARY + mapping ──────────────────────────
t('§3/§4 library has the 9 mechanisms + candidate mapping for all 5 bottlenecks', () => {
  const L = worldRuleLibraryV6.WORLD_RULE_LIBRARY
  const need = ['EXTERNAL_EVIDENCE_OVER_INTERNAL_CERTAINTY', 'COMPOUNDING_OVER_RESTARTING', 'PROBABILITY_OVER_CERTAINTY', 'SCARCITY_VALUE_OVER_RAW_EFFORT', 'SYSTEM_OVER_MOTIVATION', 'MARKET_PROOF_OVER_SELF_ASSESSMENT', 'LOW_COST_EXPERIMENT_OVER_PERFECT_DIRECTION', 'REPEATABILITY_OVER_OCCASIONAL_SUCCESS', 'LEVERAGE_OVER_TIME_FOR_MONEY']
  for (const k of need) assert.ok(L[k] && L[k].statement, 'missing lens ' + k)
  for (const b of ['DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP', 'VALIDATION_GAP', 'REPEATABILITY_GAP']) {
    assert.ok((worldRuleLibraryV6.CANDIDATES_BY_BOTTLENECK[b] || []).length >= 1, 'no candidates for ' + b)
  }
})
t('§3/§4 selectWorldRule is deterministic + evidence-gated + zero diagnosis authority', () => {
  for (const c of primary) {
    const r1 = worldRuleLibraryV6.selectWorldRule(c.d)
    const r2 = worldRuleLibraryV6.selectWorldRule(c.d)
    assert.deepStrictEqual(r1, r2, c.id + ' deterministic')
    assert.ok(r1 && r1.id, c.id + ' has rule')
    // library never mutates the diagnosis
    assert.strictEqual(c.d.primaryBottleneck, diagnoseTurnaroundV6(c.answers).primaryBottleneck, c.id + ' bottleneck untouched')
  }
})

// ── §5 CARD01 wrong-rule collision ──────────────────────────────
t('§5 CARD01 exposes an old rule vs world rule; <=60 chars; no forbidden jargon', () => {
  const banned = ['判断被强化', '形成闭环', '执行阶段', '行为模式', '系统判定', '证据链', '认知偏差']
  for (const c of primary) {
    const x = buildReportV6(c.d).cards.fatalInsight.text
    assert.ok([...x].length <= 60, c.id + ' len=' + [...x].length)
    for (const b of banned) assert.ok(!x.includes(b), c.id + ' CARD01 has ' + b)
    assert.ok(/(现实|其实|恰恰相反|真正的规则|卡住你|行不通|反而)/.test(x), c.id + ' CARD01 lacks rule collision: ' + x)
  }
})

// ── §6 CARD02 diagnostic leap ───────────────────────────────────
t('§6 CARD02 contains a diagnostic leap (not answer restatement) for all primary', () => {
  for (const c of primary) {
    const r = buildReportV6(c.d)
    assert.strictEqual(worldModelValidatorV6.answerRestatementOnly(r.cards.coreProblem), false, c.id + ' restatement: ' + r.cards.coreProblem.text)
  }
})

// ── §7 CARD03 one loop, 5 nodes, no STEP ────────────────────────
t('§7 CARD03 is exactly 5 nodes with one loop and no STEP labels', () => {
  for (const c of primary) {
    const r = buildReportV6(c.d)
    assert.strictEqual(r.cards.systemLoop.steps.length, 5, c.id + ' nodes')
    const j = r.cards.systemLoop.steps.join(' ')
    assert.ok(!/STEP\s*\d/i.test(j), c.id + ' STEP label')
    assert.ok(r.cards.systemLoop.insight && r.cards.systemLoop.insight.length > 0, c.id + ' insight')
  }
})

// ── §8 CARD04 old rule -> new rule + mechanism ─────────────────
t('§8 CARD04 has OLD_RULE + NEW_RULE + MECHANISM', () => {
  for (const c of primary) {
    const p = buildReportV6(c.d).cards.turnaroundPath
    assert.ok(p.from && p.to && p.from !== p.to, c.id + ' from/to')
    assert.ok(/旧规则/.test(p.text), c.id + ' old rule')
    assert.ok(/新规则/.test(p.text), c.id + ' new rule')
    assert.ok(/从「.*」换成「/ .test(p.logic), c.id + ' rule-swap logic: ' + p.logic)
  }
})

// ── §9 CARD05 external signal ──────────────────────────────────
t('§9 CARD05 has external signal + decision rule (ACTION_EXTERNAL_SIGNAL_RATE=100%)', () => {
  let n = 0
  for (const c of primary) {
    const a = buildReportV6(c.d).cards.firstAction
    assert.ok(a.timebox, c.id + ' timebox')
    assert.ok(a.verifyWith, c.id + ' who/where')
    assert.ok(a.done, c.id + ' what signal')
    assert.ok(a.decision, c.id + ' decision rule')
    if (worldModelValidatorV6.actionExternalSignal(a)) n++
  }
  console.log('   ACTION_EXTERNAL_SIGNAL_RATE = ' + (100 * n / primary.length).toFixed(1) + '%')
  assert.strictEqual(n, primary.length)
})

// ── §10 GENERIC_PRODUCTIVITY_ACTION = 0 ────────────────────────
t('§10 GENERIC_PRODUCTIVITY_ACTION_COUNT = 0', () => {
  let g = 0
  for (const c of primary) if (worldModelValidatorV6.genericProductivityAction(buildReportV6(c.d).cards.firstAction)) { g++; console.log('   generic:', c.id) }
  console.log('   GENERIC_PRODUCTIVITY_ACTION_COUNT = ' + g)
  assert.strictEqual(g, 0)
})

// ── §14 WORLD_MODEL_SHIFT_PRESENT = 100% ───────────────────────
t('§14 WORLD_MODEL_SHIFT_RATE = 100% for PRIMARY', () => {
  let n = 0
  for (const c of primary) if (worldModelValidatorV6.worldModelShiftPresent(buildReportV6(c.d))) n++
  const rate = 100 * n / primary.length
  console.log('   WORLD_MODEL_SHIFT_RATE = ' + rate.toFixed(1) + '%')
  assert.strictEqual(rate, 100)
})

// ── §12 anchors: UNIQUE >= 2, REPEATED <= 1 ────────────────────
t('§12 UNIQUE_PERSONAL_EVIDENCE_ANCHOR >= 2 and REPEATED <= 1', () => {
  let minU = Infinity, maxR = 0, sumU = 0
  for (const c of primary) {
    const a = worldModelValidatorV6.evidenceAnchors(buildReportV6(c.d), c.d)
    minU = Math.min(minU, a.unique); maxR = Math.max(maxR, a.repeated); sumU += a.unique
    assert.ok(a.unique >= 2, c.id + ' unique=' + a.unique)
    assert.ok(a.repeated <= 1, c.id + ' repeated=' + a.repeated)
  }
  console.log('   UNIQUE_PERSONAL_EVIDENCE_ANCHOR_AVG = ' + (sumU / primary.length).toFixed(2))
  console.log('   REPEATED_EVIDENCE_ANCHOR_MAX = ' + maxR)
})

// ── §11 cross-card + §18 duplicates ────────────────────────────
t('§11/§18 CROSS_CARD_DUPLICATE_IDEA_COUNT = 0', () => {
  let d = 0
  for (const c of primary) d += Q.crossCardDuplicateIdeas(buildReportV6(c.d)).count
  console.log('   CROSS_CARD_DUPLICATE_IDEA_COUNT = ' + d)
  assert.strictEqual(d, 0)
})

// ── §18 FINAL_VALID_RATE = 100% (deterministic product) ────────
t('§18 FINAL_VALID_RATE = 100%', () => {
  let ok = 0
  for (const c of primary) if (validateFinalV6(buildReportV6(c.d), c.d).valid) ok++
  const rate = 100 * ok / primary.length
  console.log('   FINAL_VALID_RATE = ' + rate.toFixed(1) + '% (n=' + primary.length + ')')
  assert.strictEqual(rate, 100)
})

// ── §17 authority preserved ────────────────────────────────────
t('§17 B1 authority preserved (bottleneck/stage/action type unchanged by report)', () => {
  for (const c of primary) {
    const d = diagnoseTurnaroundV6(c.answers)
    const r = buildReportV6(d)
    assert.strictEqual(r.provenance.primaryBottleneck, d.primaryBottleneck, c.id)
    assert.strictEqual(r.provenance.executionStage, d.executionStage, c.id)
  }
})

console.log('\nR33 world-model-first report engine: ' + pass + ' passed, ' + fail + ' failed')
process.exit(fail ? 1 : 0)
