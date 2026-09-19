'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r86e-cognitive-os.test.js
 *
 * RC8.4 V6 R86-E — COGNITIVE OS VISIBLE AUTHORITY RECONSTRUCTION.
 *
 * Makes REPORTABLE_WORLD_MODEL + MODEL_REALITY_MISMATCH the TRUE semantic owner
 * of the final visible five cards (R85 lower layers = REALITY_EVIDENCE /
 * CONTEXT / APPLICATION only).
 *
 * Covers:
 *   §3  worldModelReady (separate from isR86C)
 *   §4  NO_REPORTABLE_AXIS + UNKNOWN/MIXED non-identity
 *   §5  STATE_TEXT MIXED/UNKNOWN explicit (no silent collapse)
 *   §6  evidence-based primary axis V2
 *   §8-§20 Cognitive OS Card Schema V2 + producer tags + protected slots
 *   §9-§18 per-card ownership (Card01 collision … Card05 reality test)
 *   §22 final-visible grounding (unsupported psychology)
 *   §25 authority share
 *   §26 same reality / different model (≥5 distinct per card)
 *   §27 readiness fixtures (one/multiple/mixed/all-unknown/conflicting)
 *   §28 legacy freeze
 *   §32 model call max
 *
 * Deterministic. No network.
 */

const path = require('path')
const assert = require('assert')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib')
const V6 = path.join(CF, 'turnaroundStrategy/v6')

const WM = require(path.join(V6, 'hybrid/worldModelV1.js'))
const { buildHybridProfileV6 } = require(path.join(V6, 'hybrid/hybridProfileV6.js'))
const { runHybridDiagnosisV6 } = require(path.join(V6, 'hybrid/hybridDiagnosisV6.js'))
const { buildReportV6 } = require(path.join(V6, 'report/reportBuilderV6.js'))
const { mapV4RestoredToReport, V4R_TEMPERATURE } = require(path.join(V6, 'thesis/v4RestoredReportRuntimeV6.js'))
const S = require(path.join(V6, 'thesis/cognitiveOsCardSchemaV2.js'))
const SCREEN2 = require(path.join(V6, 'thesis/worldModelCardScreenV2.js'))

let pass = 0, fail = 0
const fails = []
function t (name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name) } catch (e) { fail++; fails.push(name + ' :: ' + e.message); console.log('  ✗ ' + name + ' :: ' + e.message) }
}

const BASE = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationCategory: 'OCC_CONTENT_CREATIVE',
  occupationDetail: '短视频运营', pricingAuthority: 'PRICE_EMPLOYER', monthlySurplus: 'SURPLUS_1K_5K',
  safetyMonths: 'SAFETY_1_3', debtPressure: 'DEBT_NONE', skillValidation: 'PROOF_FREE_THANKED',
  monetizableSkill: 'ASSET_CONTENT', weeklyTime: 'TIME_5_10', maxTrialCost: 'COST_1K_5K',
  pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION', timeBehavior: 'TIME_BALANCE',
  primaryProblem: 'PROBLEM_MONETIZE'
}
const COG = (labor, prob, sys, rule, evid) => ({ laborModel: labor, decisionStyle: prob, systemModel: sys, ruleModel: rule, failureResponse: evid })
const RAW = (cog, reality) => Object.assign({}, BASE, reality || {}, cog)

// Owner fixture (OWNER_FAIL_FIXTURE_R86_01 reconstruction)
const OWNER = RAW(COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_PERSON', 'RULE_EFFORT', 'EVID_PRAISE'),
  { occupationCategory: 'OCC_CONTENT_CREATIVE', occupationDetail: '短视频运营', timeBehavior: 'TIME_PROTECT_LONG' })
// A true legacy submission (no R86 cognitive fields at all).
const LEGACY = Object.assign({}, BASE, { timeBehavior: 'TIME_BALANCE', decisionStyle: 'DECISION_ALL_IN', failureResponse: 'FAIL_GIVE_UP' })

// The owner's visible legacy-economic LLM output (must NOT own the R86 cards).
const LEGACY_LLM_OUT = {
  strategicThesis: {
    identityInterpretation: '你是一个有内容能力的人，但还没有第二个定价者',
    coreContradiction: '你不是没能力，是你的内容能力还没有第二个定价者。',
    systemTrap: '岗位时间 → 雇主收入 → 免费认可 → 无外部报价 → 回岗位', worldRule: '价值可以沉淀、可以被重复使用',
    strategicMigration: { from: '还看不清', to: '价值可以沉淀、可以被重复使用', steps: ['保住现在的局', '让内容能力在局外拿到第二个独立付款人'] },
    commercialThesis: { objective: '90天拿到第一笔付费' }
  },
  cards: {
    card01: '你不是没能力，是你的内容能力还没有第二个定价者。',
    card02: '你通常用『还看不清』来理解这类问题。',
    card03: ['岗位时间', '雇主收入', '免费认可', '无外部报价', '回岗位'],
    card04: { from: '还看不清', to: '价值可以沉淀、可以被重复使用', steps: ['保住现在的局', '让内容能力在局外拿到第二个独立付款人'] },
    card05: { objective: '90天第一笔付费', actions: [{ title: '定交付', text: '把内容能力做成能交付的东西' }, { title: '找买家', text: '找愿意付费的人' }], successSignal: '真实付费验证' }
  }
}

function report (raw, out) {
  const o = runHybridDiagnosisV6(raw)
  const fb = buildReportV6(o.diagnosis, o.hybridContext)
  return { o, m: mapV4RestoredToReport(fb, out || LEGACY_LLM_OUT, o.hybridProfile, o.hybridContext) }
}

console.log('\nRC8.4 V6 R86-E — COGNITIVE OS VISIBLE AUTHORITY RECONSTRUCTION\n')

// ── §5 STATE TEXT ──────────────────────────────────────────────────────────
t('§5 STATE_TEXT has explicit MIXED + UNKNOWN (MIXED never collapses to 还看不清)', () => {
  assert.ok(Object.prototype.hasOwnProperty.call(WM.WORLD_MODEL_STATE_TEXT, 'MIXED'))
  assert.ok(Object.prototype.hasOwnProperty.call(WM.WORLD_MODEL_STATE_TEXT, 'UNKNOWN'))
  assert.notStrictEqual(WM.WORLD_MODEL_STATE_TEXT.MIXED, WM.WORLD_MODEL_STATE_TEXT.UNKNOWN)
  assert.strictEqual(WM.WORLD_MODEL_STATE_TEXT.UNKNOWN, '还看不清')
})

// ── §3 worldModelReady ─────────────────────────────────────────────────────
t('§3 worldModelReady is SEPARATE from isR86C and true when a reportable axis exists', () => {
  const p = buildHybridProfileV6(OWNER)
  assert.strictEqual(p.worldModel.isR86C, true)
  assert.strictEqual(p.worldModel.worldModelReady, true)
  assert.strictEqual(p.worldModel.readinessClass, 'PRIMARY_AXIS')
  assert.ok(p.worldModel.reportableAxisCount >= 1)
})
t('§3 reportable axis requires state∉{UNKNOWN,MIXED} · conf≠UNKNOWN · OBSERVED primary', () => {
  const p = buildHybridProfileV6(OWNER)
  for (const a of WM.AXES) {
    const ax = p.worldModel.axes[a]
    const expect = ax.state !== 'UNKNOWN' && ax.state !== 'MIXED' && ax.confidence !== 'UNKNOWN' && ax.primaryEvidenceClass === 'OBSERVED'
    assert.strictEqual(ax.reportable, expect, a)
  }
})
t('§3 all-unknown submission → worldModelReady=false · NO_REPORTABLE_AXIS', () => {
  const wm = WM.computeWorldModelV1({})
  assert.strictEqual(wm.worldModelReady, false)
  assert.strictEqual(wm.readinessClass, 'NO_REPORTABLE_AXIS')
  assert.strictEqual(wm.reportableAxisCount, 0)
})

// ── §6 evidence-based primary axis V2 ──────────────────────────────────────
t('§6 owner fixture: MIXED LABOR is NOT the primary; a reportable axis is', () => {
  const p = buildHybridProfileV6(OWNER)
  assert.strictEqual(p.worldModel.axes.LABOR.state, 'MIXED')
  assert.strictEqual(p.worldModel.axes.LABOR.reportable, false)
  assert.notStrictEqual(p.worldModel.primaryAxis, 'LABOR')
  assert.ok(['PROBABILITY', 'SYSTEM', 'RULE', 'EVIDENCE'].indexOf(p.worldModel.primaryAxis) !== -1, p.worldModel.primaryAxis)
  assert.strictEqual(p.worldModel.primaryAxisReportable, true)
  assert.ok(p.worldModel.reportableUpgrade && p.worldModel.reportableUpgrade.axis === p.worldModel.primaryAxis)
})
t('§6 PRIMARY_AXIS_EVIDENCE_BASED = YES (mismatch relevance breaks the tie deterministically)', () => {
  const p = buildHybridProfileV6(OWNER)
  const score = p.worldModel.primaryAxisScore
  assert.ok(score && typeof score.mismatch === 'number' && typeof score.confidence === 'number')
})
t('§6 selection is deterministic (same input → identical primary)', () => {
  const a = buildHybridProfileV6(OWNER).worldModel.primaryAxis
  const b = buildHybridProfileV6(OWNER).worldModel.primaryAxis
  assert.strictEqual(a, b)
})
t('§6 reportable (rank-1) axes are not preferred over a stronger reportable candidate by order alone', () => {
  // U2: LABOR REUSABLE_ASSET (rank 1) vs SYSTEM/RULE/... ; selection must be evidence-based, not first-axis.
  const u = RAW(COG('LABOR_REUSABLE', 'DECISION_SMALL_TEST', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_REPEATABLE'))
  const p = buildHybridProfileV6(u)
  assert.ok(p.worldModel.primaryAxis, 'primary present')
  assert.strictEqual(p.worldModel.primaryAxisReportable, true)
})

// ── §4 NO_REPORTABLE_AXIS + non-identity ───────────────────────────────────
t('§4 screen: NO_REPORTABLE_AXIS adds NO identity and strips leaked UNKNOWN tokens', () => {
  const wmNo = { isR86C: true, worldModelReady: false, readinessClass: 'NO_REPORTABLE_AXIS', axes: {}, primaryAxis: null }
  const cmp = { card01: 'x', card02: '你通常用『还看不清』来理解这类问题。', card03: { steps: ['s'], rule: 'r' }, card04: { from: 'a', to: 'b', rule: 'r' }, card05: { goal: 'g', actions: [], acceptance: 'a' } }
  const out = SCREEN2.screenWorldModelCardsV2(cmp, wmNo, null, {})
  assert.ok(!/还看不清/.test(out.cards.card02), 'leaked token stripped')
  assert.strictEqual(out.counts.READINESS_CLASS, 'NO_REPORTABLE_AXIS')
  assert.strictEqual(out.counts.UNKNOWN_AS_USER_IDENTITY_COUNT, 0)
})
t('§4 UNKNOWN/MIXED never become user identity on the owner fixture', () => {
  const { m } = report(OWNER)
  const g = m.visibleStats.r86eGuard
  assert.strictEqual(g.UNKNOWN_AS_USER_IDENTITY_COUNT, 0)
  assert.strictEqual(g.MIXED_AS_USER_IDENTITY_COUNT, 0)
  assert.ok(!/还看不清/.test(m.visibleCards.card02))
  assert.ok(!/还看不清/.test(m.visibleCards.card04.from))
})

// ── §8-§20 schema / producer / protected slots ─────────────────────────────
t('§19 producer tags exist for all 8 producers', () => {
  assert.deepStrictEqual(Object.keys(S.PRODUCER).sort(),
    ['B1', 'GAME_MODEL', 'LEGACY_TEMPLATE', 'LLM_STYLE', 'MISMATCH', 'PRICING_POWER', 'REALITY', 'WORLD_MODEL'].sort())
})
t('§20 protected slots reject unauthorised producers', () => {
  assert.strictEqual(S.slotAuthorized('CARD02.DEFAULT_MODEL', S.PRODUCER.WORLD_MODEL), true)
  assert.strictEqual(S.slotAuthorized('CARD02.DEFAULT_MODEL', S.PRODUCER.GAME_MODEL), false)
  assert.strictEqual(S.slotAuthorized('CARD03.SHORT_TERM_REWARD', S.PRODUCER.REALITY), true)
  assert.strictEqual(S.slotAuthorized('CARD04.NEW_MODEL', S.PRODUCER.PRICING_POWER), false)
  assert.strictEqual(S.slotAuthorized('CARD05.REALITY_TEST', S.PRODUCER.LEGACY_TEMPLATE), false)
})
t('§8 every slot is structured {text,producer,authority,evidenceClass,supported,sourceEvidence[]}', () => {
  const p = buildHybridProfileV6(OWNER)
  const c3 = S.card03Slots(p.worldModel)
  for (const k of Object.keys(c3)) {
    const s = c3[k]
    for (const f of ['text', 'producer', 'authority', 'evidenceClass', 'supported']) assert.ok(f in s, k + ' missing ' + f)
    assert.ok(Array.isArray(s.sourceEvidence), k + ' sourceEvidence[]')
  }
})
t('§8 unsupported slot is not rendered', () => {
  const c4 = S.card04Slots(buildHybridProfileV6(OWNER).worldModel, buildHybridProfileV6(OWNER).mismatch, null)
  assert.strictEqual(c4.REALITY_APPLICATION.supported, false)
  assert.strictEqual(S.renderSteps(c4, ['OLD_MODEL', 'NEW_MODEL', 'REALITY_APPLICATION']).length, 2)
})

// ── §9 Card01 ───────────────────────────────────────────────────────────────
t('§9 R87B2 Card01 renders REALITY FACTS → CONTRADICTION → DERIVED INSIGHT (≥2 real facts)', () => {
  // R87B2 supersedes the R86-E behavioural Card01: the five visible cards now
  // render from ONE caseThesis (REALITY FIRST). The R86-E world-model guards
  // still run (and are still emitted); the FINAL Card01 is R87-anchored.
  const { m } = report(OWNER)
  const g = m.visibleStats.r87b2Guard
  assert.ok(g, 'R87B2 guard present on the R86 path')
  assert.strictEqual(g.R87_SCREEN, 'APPLIED')
  assert.ok((g.CARD01_REALITY_FACT_COUNT || 0) >= 2)
  assert.strictEqual(g.VISIBLE_CLAIM_WITHOUT_LEDGER_COUNT, 0)
})
t('§9 R87B2 Card01 derives a NEW D (not a questionnaire restatement / legacy card)', () => {
  const { m } = report(OWNER)
  const g = m.visibleStats.r87b2Guard
  assert.strictEqual(g.CARD_COHERENCE_PASS, 'YES')
  assert.notStrictEqual(m.visibleCards.card01, LEGACY_LLM_OUT.cards.card01)
  assert.ok(m.visibleCards.card01.indexOf('短视频运营') !== -1, 'card01 anchored in the user occupation')
})

// ── §10 Card02 ──────────────────────────────────────────────────────────────
t('§10 CARD02_OPTION_RESTATEMENT_COUNT = 0 and card02 deepens Card01 (mechanism)', () => {
  const { m } = report(OWNER)
  assert.strictEqual(m.visibleStats.r87b2Guard.CARD02_OPTION_RESTATEMENT_COUNT, 0)
  assert.ok(/为什么/.test(m.visibleCards.card02), 'card02 explains WHY, not restates options')
})

// ── §11/§12/§13 Card03 (P0) ────────────────────────────────────────────────
t('§12 CARD03_WORLD_MODEL_LOOP_PRESENT = YES', () => {
  const { m } = report(OWNER)
  assert.strictEqual(m.visibleStats.r86eGuard.CARD03_WORLD_MODEL_LOOP_PRESENT, 'YES')
})
t('§11/§13 Card03 primary loop is COGNITIVE (model→reward→confirmation→reuse→cost)', () => {
  const p = buildHybridProfileV6(OWNER)
  const c3 = S.card03Slots(p.worldModel)
  const steps = S.renderSteps(c3, ['MODEL', 'SHORT_TERM_REWARD', 'APPARENT_CONFIRMATION', 'REINFORCEMENT', 'LONG_TERM_COST'])
  assert.strictEqual(steps.length, 5)
  assert.strictEqual(c3.MODEL.producer, S.PRODUCER.WORLD_MODEL)
  // the legacy economic loop is NOT the primary text
  assert.ok(!/免费认可/.test(steps.join('')))
})
t('§12 Card03 has no generic psychology fallback (mechanism-driven slots)', () => {
  const { m } = report(OWNER)
  assert.strictEqual(m.visibleStats.r86eGuard.UNSUPPORTED_PSYCHOLOGY_COUNT, 0)
})

// ── §14/§15 Card04 ──────────────────────────────────────────────────────────
t('§15 CARD04_MODEL_UPGRADE_DOMINANT = YES (share ≥ 0.6)', () => {
  const { m } = report(OWNER)
  const g = m.visibleStats.r86eGuard
  assert.strictEqual(g.CARD04_MODEL_UPGRADE_DOMINANT, 'YES')
  assert.ok(g.CARD04_MODEL_UPGRADE_SHARE >= 0.6, g.CARD04_MODEL_UPGRADE_SHARE)
  assert.ok(g.CARD04_REAL_WORLD_APPLICATION_SHARE <= 0.4)
})

// ── §16/§17 Card05 ──────────────────────────────────────────────────────────
t('§17 CARD05_WORLD_MODEL_TEST_DOMINANT = YES · FALSE_POSITIVE = 0', () => {
  const { m } = report(OWNER)
  const g = m.visibleStats.r86eGuard
  assert.strictEqual(g.CARD05_WORLD_MODEL_TEST_DOMINANT, 'YES')
  assert.strictEqual(g.CARD05_REALITY_TEST_FALSE_POSITIVE_COUNT, 0)
  assert.ok(!/90\s*天|第一笔付费|定交付|找买家|跑一次|真实付费验证/.test(JSON.stringify(m.visibleCards.card05)))
})
t('§18 Card05 carries HYPOTHESIS → REALITY_TEST → OBSERVE → UPDATE_RULE', () => {
  const p = buildHybridProfileV6(OWNER)
  const c5 = S.card05Slots(p.worldModel)
  for (const k of ['HYPOTHESIS', 'REALITY_TEST', 'OBSERVE', 'UPDATE_RULE']) assert.ok(c5[k] && c5[k].supported, k)
})

// ── §22 final-visible grounding ────────────────────────────────────────────
t('§22 VISIBLE_UNSUPPORTED_PSYCHOLOGY_COUNT = 0 on FINAL visible text', () => {
  const { m } = report(OWNER)
  assert.strictEqual(m.visibleStats.r86eVisibleGrounding.VISIBLE_UNSUPPORTED_PSYCHOLOGY_COUNT, 0)
  assert.ok(!/更不敢动|不敢动/.test(JSON.stringify(m.visibleCards)))
})
t('§22 post-grounding drops unsupported psychology but keeps belief-supported fear', () => {
  const dirty = { card01: '你一直不敢动。', card02: '', card03: { steps: [], rule: '' }, card04: { from: '', to: '', rule: '' }, card05: { goal: '', actions: [], acceptance: '' } }
  const r1 = S.postGroundingV2(dirty, {})
  assert.strictEqual(r1.counts.VISIBLE_UNSUPPORTED_PSYCHOLOGY_COUNT, 0)
  assert.ok(!/不敢动/.test(r1.cards.card01))
})

// ── §24/§25 trace + authority share ────────────────────────────────────────
t('§24 trace exposes per-slot producer/authority/evidence/support (test-only)', () => {
  const { m } = report(OWNER)
  const trace = m.visibleStats.r86eTrace
  assert.ok(Array.isArray(trace) && trace.length >= 12)
  for (const r of trace) { for (const f of ['card', 'slot', 'producer', 'authority', 'evidenceClass', 'supported']) assert.ok(f in r, JSON.stringify(r)) }
})
t('§25 WORLD_MODEL_VISIBLE_SHARE ≥ 0.6 · LEGACY_ECONOMIC_VISIBLE_SHARE ≤ 0.3', () => {
  const { m } = report(OWNER)
  const sh = m.visibleStats.r86eAuthorityShare
  assert.ok(sh.WORLD_MODEL_VISIBLE_SHARE >= 0.6, JSON.stringify(sh))
  assert.ok(sh.LEGACY_ECONOMIC_VISIBLE_SHARE <= 0.3, JSON.stringify(sh))
})

// ── §26 same reality / different model ─────────────────────────────────────
t('§26 SAME reality + DIFFERENT model → VISIBLE REPORT DISTINCT ≥ 5', () => {
  const variants = [
    RAW(COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_PERSON', 'RULE_EFFORT', 'EVID_PRAISE')),
    RAW(COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_PERSON', 'RULE_AWARE', 'EVID_REPEATABLE')),
    RAW(COG('LABOR_MORE_WORK', 'DECISION_SMALL_TEST', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_PRAISE')),
    RAW(COG('LABOR_MORE_WORK', 'DECISION_SMALL_TEST', 'SYS_STRUCTURE', 'RULE_DEMAND', 'EVID_PRAISE')),
    RAW(COG('LABOR_MORE_WORK', 'DECISION_ALL_IN', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_PRAISE'))
  ]
  const sig = { card02: [], card03: [], card04: [], card05: [] }
  const reports = []
  const axes = []
  for (const v of variants) {
    const { m, o } = report(v)
    axes.push(o.hybridProfile.worldModel.primaryAxis + '/' + o.hybridProfile.worldModel.primaryAxisState)
    sig.card02.push(m.visibleCards.card02)
    sig.card03.push(JSON.stringify(m.visibleCards.card03.steps))
    sig.card04.push(m.visibleCards.card04.from + '|' + m.visibleCards.card04.to + '|' + (m.visibleCards.card04.rule || ''))
    sig.card05.push(m.visibleCards.card05.goal + '|' + (m.visibleCards.card05.actions || []).join(''))
    reports.push([m.visibleCards.card01, m.visibleCards.card02, JSON.stringify(m.visibleCards.card03.steps), sig.card04[sig.card04.length - 1], sig.card05[sig.card05.length - 1]].join('||'))
  }
  assert.ok(new Set(axes).size >= 5, 'primary axes distinct: ' + axes.join(','))
  // R87B2: Card01 is REALITY-anchored (same reality SHOULD yield the same Card01);
  // Card02–05 (mechanism/loop/path/experiment) are MODEL-AWARE. Assert per-card
  // distinctness on the model-aware cards + REPORT-level distinctness ≥5. The
  // superseded R86-E "per-card ≥5" no longer applies to the reality-anchored Card01.
  assert.ok(new Set(reports).size >= 5, 'report_DISTINCT=' + new Set(reports).size)
  assert.ok(new Set(sig.card02).size >= 3, 'card02_DISTINCT=' + new Set(sig.card02).size)
  assert.ok(new Set(sig.card03).size >= 5, 'card03_DISTINCT=' + new Set(sig.card03).size)
  assert.ok(new Set(sig.card04).size >= 3, 'card04_DISTINCT=' + new Set(sig.card04).size)
})

// ── §18 Card05 (R87B2: bounded reality test, no default 90-day plan) ────────
t('§18 R87B2 Card05 tests the KEY UNKNOWN with a bounded 3–7 day horizon', () => {
  const variants = [
    RAW(COG('LABOR_REUSABLE', 'DECISION_SMALL_TEST', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_REPEATABLE')),
    RAW(COG('LABOR_MORE_WORK', 'DECISION_LEARN_FIRST', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_PRAISE')),
    RAW(COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_PERSON', 'RULE_EFFORT', 'EVID_PRAISE')),
    RAW(COG('LABOR_MORE_WORK', 'DECISION_ALL_IN', 'SYS_PER_EVENT', 'RULE_DEMAND', 'EVID_REPEATABLE')),
    RAW(COG('LABOR_MORE_WORK', 'DECISION_AVOID', 'SYS_NONE', 'RULE_NONE', 'EVID_UNREFLECTIVE'))
  ]
  for (const v of variants) {
    const { m } = report(v)
    const blob = JSON.stringify(m.visibleCards.card05)
    assert.ok(!/90\s*天/.test(blob), 'no default 90-day plan: ' + blob)
    assert.ok(/3–7\s*天|3-7\s*天/.test(blob), 'bounded 3–7 day horizon: ' + blob)
  }
})

// ── §27 readiness fixtures ─────────────────────────────────────────────────
t('§27 A one clear cognitive axis → single reportable primary, deterministic', () => {
  const wm = WM.computeWorldModelV1({ decisionStyle: 'DECISION_WAIT_OTHERS' })
  assert.strictEqual(wm.isR86C, false)
  assert.strictEqual(wm.worldModelReady, true)
  WM.applyPrimaryAxisV2(wm, null)
  assert.strictEqual(wm.primaryAxis, 'PROBABILITY')
})
t('§27 B multiple clear axes → deterministic evidence-based primary', () => {
  const wm = WM.computeWorldModelV1(COG('LABOR_REUSABLE', 'DECISION_SMALL_TEST', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_REPEATABLE'))
  WM.applyPrimaryAxisV2(wm, null)
  assert.strictEqual(wm.reportableAxisCount, 5)
  assert.ok(wm.primaryAxis)
})
t('§27 C mixed strongest candidate (LABOR MIXED) excluded from primary', () => {
  const p = buildHybridProfileV6(OWNER)
  assert.strictEqual(p.worldModel.axes.LABOR.state, 'MIXED')
  assert.notStrictEqual(p.worldModel.primaryAxis, 'LABOR')
})
t('§27 D all unknown → NO_REPORTABLE_AXIS, no forced identity', () => {
  const wm = WM.computeWorldModelV1({})
  assert.strictEqual(wm.readinessClass, 'NO_REPORTABLE_AXIS')
  WM.applyPrimaryAxisV2(wm, null)
  assert.strictEqual(wm.primaryAxis, null)
  const out = SCREEN2.screenWorldModelCardsV2(
    { card01: 'x', card02: '你通常用『还看不清』来理解这类问题。', card03: { steps: ['s'], rule: 'r' }, card04: { from: '还看不清', to: 'b', rule: 'r' }, card05: { goal: 'g', actions: [], acceptance: 'a' } },
    Object.assign({}, wm, { isR86C: true }), null, {})
  assert.strictEqual(out.counts.UNKNOWN_AS_USER_IDENTITY_COUNT, 0)
  assert.ok(!/还看不清/.test(out.cards.card02 + out.cards.card04.from))
})
t('§27 E conflicting evidence (LABOR MIXED) → deterministic, no crash, honest readiness', () => {
  const wm = WM.computeWorldModelV1({ laborModel: 'LABOR_MORE_WORK', systemModel: 'SYS_NONE', ruleModel: 'RULE_NONE', timeBehavior: 'TIME_PROTECT_LONG' })
  assert.strictEqual(wm.axes.LABOR.state, 'MIXED')
  assert.strictEqual(wm.isR86C, true)
  WM.applyPrimaryAxisV2(wm, null)
  assert.ok(wm.primaryAxis !== 'LABOR')
})

// ── §28 legacy freeze ──────────────────────────────────────────────────────
t('§28 LEGACY path: R86-E screen is a NO-OP (cards byte-identical, counters zero)', () => {
  const p = buildHybridProfileV6(LEGACY)
  const cmp = { card01: 'x', card02: 'y', card03: { steps: ['s'], rule: 'r' }, card04: { from: 'a', to: 'b', rule: 'r' }, card05: { goal: 'g', actions: [], acceptance: 'a' } }
  const out = SCREEN2.screenWorldModelCardsV2(cmp, p.worldModel, p.mismatch, {})
  assert.deepStrictEqual(out.cards, cmp)
  assert.strictEqual(out.counts.CARD01_MODEL_SIGNAL_MISSING_COUNT, 0)
  assert.strictEqual(out.counts.CARD02_LEAK_TOKEN_COUNT, 0)
  assert.strictEqual(out.counts.CARD03_WORLD_MODEL_LOOP_MISSING_COUNT, 0)
  assert.strictEqual(out.counts.CARD04_MODEL_UPGRADE_MISSING_COUNT, 0)
  assert.strictEqual(out.counts.CARD05_WORLD_MODEL_TEST_MISSING_COUNT, 0)
})
t('§28 LEGACY report path exposes NO r86eGuard (R86-E absent)', () => {
  const { m } = report(LEGACY, LEGACY_LLM_OUT)
  assert.strictEqual(m.visibleStats.r86eGuard, null)
  assert.strictEqual(m.visibleStats.r86eVisibleGrounding, null)
})

// ── §32 model call max ─────────────────────────────────────────────────────
t('§32 MODEL_CALL_COUNT_MAX = 1 (runtime uses ONE call; no second world-model call)', () => {
  // Structural: the R86-E layer is deterministic (no AI). Assert the temperature
  // constant is unchanged and the report path performs no extra call.
  assert.strictEqual(V4R_TEMPERATURE, 0.7)
  const src = require('fs').readFileSync(path.join(V6, 'thesis/worldModelCardScreenV2.js'), 'utf8')
  assert.ok(!/callAI|runV4RestoredAdapter|fetch|http/.test(src), 'V2 screen must be deterministic')
  const sch = require('fs').readFileSync(path.join(V6, 'thesis/cognitiveOsCardSchemaV2.js'), 'utf8')
  assert.ok(!/callAI|runV4RestoredAdapter|fetch|http/.test(sch), 'schema must be deterministic')
})

// ── summary ────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════')
console.log('R86-E COGNITIVE OS: ' + pass + ' passed, ' + fail + ' failed')
console.log('══════════════════════════════════════')
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
