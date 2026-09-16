'use strict'
/**
 * tests/v6/report/rc8.4-v6-r31-content-quality.test.js
 *
 * R31 — V6 five-card report CONTENT quality suite (deterministic, no AI).
 * Proves the content refoundation (§3–§12):
 *   - five cards always user-visible (turnaroundPath present)
 *   - CARD01/02/03/04/05 redesigned shapes + no STEP labels
 *   - CARD04 FROM→TO decision rule restored
 *   - CARD05 action specificity (>=3/4)
 *   - personal evidence anchors >= 2
 *   - CROSS_CARD_DUPLICATE_IDEA_COUNT == 0
 *   - authority preserved (B1/B2 unchanged)
 */

const assert = require('assert')
const path = require('path')
const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const { diagnoseTurnaroundV6 } = require(path.join(CF, 'index.js'))
const REPORT = require(path.join(CF, 'report/index.js'))
const { buildReportV6, validateReportV6, visibleText, CARD_KEYS } = REPORT
const Q = REPORT.reportQualityV6
const F = require(path.join(ROOT, 'tests/v6/fixtures.js'))

let pass = 0, fail = 0
function t (name, fn) { try { fn(); pass++; console.log('  ok  ' + name) } catch (e) { fail++; console.log('  FAIL ' + name + ' :: ' + e.message) } }

const GOLD = F.GOLDEN
const PRIMARY = GOLD.filter((g) => diagnoseTurnaroundV6(g.answers).diagnosisState === 'PRIMARY')

console.log('R31 content quality')

// ── §2 five cards always present ────────────────────────────────
t('§2 every PRIMARY report has exactly 5 cards incl. turnaroundPath', () => {
  let n = 0
  for (const g of PRIMARY) {
    const r = buildReportV6(diagnoseTurnaroundV6(g.answers))
    assert.ok(r.cards.turnaroundPath, g.id + ' missing turnaroundPath')
    assert.strictEqual(Object.keys(r.cards).length, 5, g.id + ' card count')
    n++
  }
  assert.ok(n >= 15, 'PRIMARY sample >= 15, got ' + n)
})
t('§2 turnaroundPath carries logic (client body source), from, to', () => {
  for (const g of PRIMARY) {
    const c = buildReportV6(diagnoseTurnaroundV6(g.answers)).cards.turnaroundPath
    assert.ok(typeof c.logic === 'string' && c.logic.length > 0, g.id + ' logic')
    assert.ok(typeof c.from === 'string' && c.from.length > 0, g.id + ' from')
    assert.ok(typeof c.to === 'string' && c.to.length > 0, g.id + ' to')
  }
})

// ── §5 CARD03 no STEP labels, exactly 5 nodes ───────────────────
t('§5 CARD03 has no STEP labels and exactly 5 loop nodes', () => {
  for (const g of PRIMARY) {
    const steps = buildReportV6(diagnoseTurnaroundV6(g.answers)).cards.systemLoop.steps
    assert.strictEqual(steps.length, 5, g.id + ' loop nodes')
    for (const s of steps) assert.ok(!/STEP\s*\d/i.test(s), g.id + ' has STEP label: ' + s)
  }
})
t('§5 CARD03 uses ONE expression family (R34 §4: LOOP/CONTRADICTION/ACCUMULATION/REFRAME)', () => {
  const FAMILIES = ['LOOP', 'CONTRADICTION', 'ACCUMULATION', 'REFRAME']
  const seen = {}
  for (const g of PRIMARY) {
    const r = buildReportV6(diagnoseTurnaroundV6(g.answers))
    const steps = r.cards.systemLoop.steps
    assert.strictEqual(steps.length, 5, g.id + ' loop nodes')
    const fam = r.cards.systemLoop.family
    assert.ok(FAMILIES.includes(fam), g.id + ' unknown family ' + fam)
    seen[fam] = (seen[fam] || 0) + 1
    assert.ok(/又回到同一个问题/.test(steps[4]), g.id + ' node4 = ' + steps[4])
    assert.ok(r.cards.systemLoop.insight && r.cards.systemLoop.insight.length > 0, g.id + ' insight')
  }
  assert.ok(Object.keys(seen).length >= 3, 'CARD03_STRUCTURE_FAMILY_COUNT >= 3, got ' + JSON.stringify(seen))
})

// ── §3 CARD01 no forbidden diagnostic vocabulary ────────────────
t('§3 CARD01 avoids 判断被强化/形成闭环/执行阶段/行为模式', () => {
  const banned = ['判断被强化', '形成闭环', '执行阶段', '行为模式', '系统判定', '证据链', '认知偏差']
  for (const g of PRIMARY) {
    const txt = buildReportV6(diagnoseTurnaroundV6(g.answers)).cards.fatalInsight.text
    for (const b of banned) assert.ok(!txt.includes(b), g.id + ' CARD01 contains ' + b)
    assert.ok([...txt].length >= 20 && [...txt].length <= 60, g.id + ' CARD01 len=' + [...txt].length)
  }
})

// ── §4/§10 CARD02 has hidden-mechanism leap (not just answers) ──
t('§4 CARD02 contains a mechanism line (为什么), not only a restatement', () => {
  for (const g of PRIMARY) {
    const txt = buildReportV6(diagnoseTurnaroundV6(g.answers)).cards.coreProblem.text
    assert.ok(txt.length > 40, g.id + ' CARD02 too short')
    assert.ok(/(因为|只在|才算|等于|只有|换不来|拿不到|从零|证明|只能|说不清|没办法|不等于|才会|才是|不产生|由|恰恰相反|算|说了算|清零|运气|没有任何|只是|越|不由|并不)/.test(txt), g.id + ' CARD02 lacks mechanism phrasing: ' + txt)
  }
})

// ── §6 CARD04 FROM→TO decision rule ─────────────────────────────
t('§6 CARD04 logic states an old→new decision rule', () => {
  for (const g of PRIMARY) {
    const logic = buildReportV6(diagnoseTurnaroundV6(g.answers)).cards.turnaroundPath.logic
    assert.ok(logic.includes('从「') && logic.includes('换成「'), g.id + ' CARD04 rule form: ' + logic)
  }
})

// ── §7/§12 CARD05 specificity ───────────────────────────────────
t('§7/§12 CARD05 answers >= 3 of 4 (what/when/who/done); none too generic', () => {
  let tooGeneric = 0
  for (const g of PRIMARY) {
    const r = buildReportV6(diagnoseTurnaroundV6(g.answers))
    const spec = Q.actionSpecificity(r.cards.firstAction)
    if (spec.tooGeneric) { tooGeneric++; console.log('   generic:', g.id, JSON.stringify(spec)) }
    assert.ok(spec.answered >= 3, g.id + ' specificity=' + JSON.stringify(spec))
  }
  assert.strictEqual(tooGeneric, 0, 'ACTION_TOO_GENERIC_COUNT')
})
t('§11 CARD05 action is not a bare generic slogan', () => {
  for (const g of PRIMARY) {
    const a = buildReportV6(diagnoseTurnaroundV6(g.answers)).cards.firstAction.action
    assert.ok(!Q.GENERIC_ACTION_PAT.test(a.trim()), g.id + ' generic action: ' + a)
  }
})

// ── §9 CROSS-CARD repetition ────────────────────────────────────
t('§9 CROSS_CARD_DUPLICATE_IDEA_COUNT == 0 across all primary reports', () => {
  let total = 0
  for (const g of PRIMARY) {
    const q = Q.assessQualityV6(buildReportV6(diagnoseTurnaroundV6(g.answers)))
    if (q.CROSS_CARD_DUPLICATE_IDEA_COUNT > 0) { total += q.CROSS_CARD_DUPLICATE_IDEA_COUNT; console.log('   dup:', g.id, JSON.stringify(q.CROSS_CARD_DUPLICATE_PAIRS)) }
  }
  assert.strictEqual(total, 0, 'CROSS_CARD_DUPLICATE_IDEA_COUNT')
})

// ── §8 PERSONAL EVIDENCE ANCHORS >= 2 ───────────────────────────
t('§8 PERSONAL_EVIDENCE_ANCHOR_COUNT >= 2 per report', () => {
  const copy = REPORT.reportCopyV6
  let minA = Infinity
  for (const g of PRIMARY) {
    const d = diagnoseTurnaroundV6(g.answers)
    const txt = visibleText(buildReportV6(d))
    let anchors = 0
    if (txt.includes(copy.getIncomeShort(d.profile.reality.incomeMode))) anchors++
    if (txt.includes(copy.getProblemPhrase(d.profile.desiredChange.primaryProblem))) anchors++
    if (txt.includes(copy.getQ7(d.profile.behavior.uncertaintyResponse))) anchors++
    if (txt.includes(copy.getQ9(d.profile.behavior.noResultResponse))) anchors++
    if (txt.includes(copy.getBeliefShort(d.profile.userBelief.perceivedRootCause)) || txt.includes(copy.getBeliefLack(d.profile.userBelief.perceivedRootCause))) anchors++
    if (anchors < minA) minA = anchors
    assert.ok(anchors >= 2, g.id + ' anchors=' + anchors)
  }
  console.log('   MIN_PERSONAL_EVIDENCE_ANCHOR_COUNT = ' + minA)
})

// ── §14 authority preserved + safety ────────────────────────────
t('§14 B1/B2 authority preserved (bottleneck/stage/action unchanged by report)', () => {
  for (const g of PRIMARY) {
    const d = diagnoseTurnaroundV6(g.answers)
    const r = buildReportV6(d)
    assert.strictEqual(r.provenance.primaryBottleneck, d.primaryBottleneck, g.id + ' primary preserved')
    assert.strictEqual(r.provenance.executionStage, d.executionStage, g.id + ' stage preserved')
    const v = validateReportV6(r)
    assert.strictEqual(v.forbiddenTokens.length, 0, g.id + ' forbidden tokens')
    assert.ok(!v.card01OverLength, g.id + ' card01 length')
    assert.ok(v.hasAllCards, g.id + ' all cards')
  }
})

// ── §10 worldview/insight layer present ─────────────────────────
t('§10 at least one of CARD01-04 carries a worldview/mechanism layer', () => {
  for (const g of PRIMARY) {
    const r = buildReportV6(diagnoseTurnaroundV6(g.answers))
    const pool = [r.cards.fatalInsight.text, r.cards.coreProblem.text, (r.cards.systemLoop.steps || []).join(''), r.cards.turnaroundPath.logic, r.cards.turnaroundPath.worldRuleLine || ''].join('\n')
    assert.ok(/(试出来|真实反馈|市场|买单|重复|连续|积累|证明|验证|反馈|猜测|猜|运气|事件|能力|重新开始|作废|认可|累积)/.test(pool), g.id + ' lacks worldview layer')
  }
})

console.log('\nR31 content quality: ' + pass + ' passed, ' + fail + ' failed')
process.exit(fail ? 1 : 0)
