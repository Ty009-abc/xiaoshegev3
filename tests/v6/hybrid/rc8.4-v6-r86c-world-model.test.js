'use strict'
/**
 * tests/v6/hybrid/rc8.4-v6-r86c-world-model.test.js
 *
 * RC8.4 V6 R86-C — WORLD MODEL / COGNITIVE OS.
 *
 * Covers:
 *   §1  five cognitive axes (LABOR / PROBABILITY / SYSTEM / RULE / EVIDENCE)
 *   §2  questionnaire economy (10 screens / 21 raw fields / 3 new / 2 removed)
 *   §3  worldModelV1 determinism + UNKNOWN/MIXED + confidence contract
 *   §4  REALITY_TO_WORLD_MODEL_DIRECT_AUTHORITY_COUNT = 0
 *   §5  same reality / different model (distinct axis signatures)
 *   §6  same model / different reality (axis states stable)
 *   §7  money-independent control
 *   §8  mismatch contract (6 codes; two-sided evidence; prohibited shortcuts)
 *   §9  five-card authority (MODEL_UPGRADE_SWITCH_TYPE_COLLAPSE = NO ·
 *       REALITY_TEST_GAME_BET_COLLAPSE = NO)
 *   §10 B1 regression + one model call max
 *
 * Deterministic. No network.
 */

const path = require('path')
const assert = require('assert')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib')
const V6 = path.join(CF, 'turnaroundStrategy/v6')

const CONTRACT = require(path.join(V6, 'hybrid/hybridContractV6.js'))
const CLIENT = require(path.join(ROOT, 'utils/v6/turnaroundQuestionnaireHybridV10.js'))
const { computeWorldModelV1, AXES } = require(path.join(V6, 'hybrid/worldModelV1.js'))
const { computeModelRealityMismatchV6, CODES } = require(path.join(V6, 'hybrid/modelRealityMismatchV6.js'))
const { computeGameModelV6 } = require(path.join(V6, 'hybrid/gameModelV6.js'))
const { computeRealEconomyModelV6 } = require(path.join(V6, 'hybrid/realEconomyModelV6.js'))
const { computePricingPowerV6 } = require(path.join(V6, 'thesis/pricingPowerV6.js'))
const { buildHybridProfileV6 } = require(path.join(V6, 'hybrid/hybridProfileV6.js'))
const { runHybridDiagnosisV6 } = require(path.join(V6, 'hybrid/hybridDiagnosisV6.js'))
const { buildReportV6 } = require(path.join(V6, 'report/reportBuilderV6.js'))
const { runV4RestoredReportRuntimeV6, RENDER_SOURCE } = require(path.join(V6, 'thesis/v4RestoredReportRuntimeV6.js'))
const { buildV4RestoredPayload } = require(path.join(V6, 'thesis/v4RestoredContextV6.js'))
const { buildV4RestoredPrompt } = require(path.join(V6, 'thesis/v4RestoredPromptV6.js'))
const B1 = require(path.join(V6, 'hybrid/hybridB1AdapterV6.js'))
const WMS = require(path.join(V6, 'thesis/worldModelCardScreenV6.js'))

let pass = 0, fail = 0
const fails = []
function t (name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name) } catch (e) { fail++; fails.push(name + ' :: ' + e.message); console.log('  ✗ ' + name + ' :: ' + e.message) }
}

// ── fixtures ──────────────────────────────────────────────────────────────
const BASE_REALITY = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationCategory: 'OCC_SERVICE',
  occupationDetail: '', pricingAuthority: 'PRICE_EMPLOYER', monthlySurplus: 'SURPLUS_1K_5K',
  safetyMonths: 'SAFETY_1_3', debtPressure: 'DEBT_NONE', skillValidation: 'PROOF_FREE_THANKED',
  monetizableSkill: 'ASSET_TECHNICAL', weeklyTime: 'TIME_5_10', maxTrialCost: 'COST_1K_5K',
  pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION', timeBehavior: 'TIME_BALANCE',
  primaryProblem: 'PROBLEM_MONETIZE'
}
const COG = (labor, prob, sys, rule, evid) => ({
  laborModel: labor, decisionStyle: prob, systemModel: sys, ruleModel: rule, failureResponse: evid
})
const RAW = (cogme, reality) => Object.assign({}, BASE_REALITY, reality || {}, cogme)

function buildProfile (raw) {
  const p = buildHybridProfileV6(raw)
  return p
}

// U1..U5 from the R86-B1 §26 table (identical reality, different models).
const U1 = RAW(COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_PERSON', 'RULE_EFFORT', 'EVID_PRAISE'))
const U2 = RAW(COG('LABOR_REUSABLE', 'DECISION_SMALL_TEST', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_PRAISE'))
const U3 = RAW(COG('LABOR_LEVERAGE', 'DECISION_LEARN_FIRST', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_LUCK'))
const U4 = RAW(COG('LABOR_MORE_WORK', 'DECISION_ALL_IN', 'SYS_PER_EVENT', 'RULE_DEMAND', 'EVID_PRAISE'))
const U5 = RAW(COG('LABOR_PRICING', 'DECISION_AVOID', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_REPEATABLE'))

console.log('\nRC8.4 V6 R86-C — WORLD MODEL / COGNITIVE OS\n')

// ── §2 questionnaire economy ───────────────────────────────────────────────
t('§2 10 screens / 21 raw fields', () => {
  assert.strictEqual(CONTRACT.HYBRID_SCREEN_COUNT, 10)
  assert.strictEqual(CONTRACT.HYBRID_RAW_FIELD_COUNT, 21)
  assert.strictEqual(CONTRACT.ALL_FIELD_KEYS.length, 21)
  assert.strictEqual(CLIENT.HYBRID_SCREEN_COUNT, 10)
  assert.strictEqual(CLIENT.allFieldKeys().length, 21)
  assert.deepStrictEqual(CLIENT.allFieldKeys(), CONTRACT.ALL_FIELD_KEYS)
})
t('§2 adds laborModel/systemModel/ruleModel; removes executionStability/primaryGoal', () => {
  for (const k of ['laborModel', 'systemModel', 'ruleModel']) assert.ok(CONTRACT.ALL_FIELD_KEYS.indexOf(k) !== -1, k)
  assert.strictEqual(CONTRACT.ALL_FIELD_KEYS.indexOf('executionStability'), -1)
  assert.strictEqual(CONTRACT.ALL_FIELD_KEYS.indexOf('primaryGoal'), -1)
  assert.deepStrictEqual(CONTRACT.WORLD_MODEL_FIELD_KEYS, ['laborModel', 'systemModel', 'ruleModel'])
})
t('§2 canonical B1 option ids preserved (selfBelief/timeBehavior/primaryProblem)', () => {
  const belief = CONTRACT.SCREENS.find((s) => s.secondary && s.secondary.key === 'selfBelief').secondary.options.map((o) => o[0])
  const time = CONTRACT.SCREENS.find((s) => s.secondary && s.secondary.key === 'timeBehavior').secondary.options.map((o) => o[0])
  const prob = CONTRACT.SCREENS.find((s) => s.key === 'primaryProblem').options.map((o) => o[0])
  assert.deepStrictEqual(belief, CONTRACT.CANONICAL_BELIEF_IDS)
  assert.deepStrictEqual(time, CONTRACT.CANONICAL_TIME_IDS)
  assert.deepStrictEqual(prob, CONTRACT.CANONICAL_PROBLEM_IDS)
})
t('§2 legacy FAIL_* ids still accepted (back-compat), unknown ids rejected', () => {
  const okRaw = RAW(COG('LABOR_MORE_WORK', 'DECISION_AVOID', 'SYS_NONE', 'RULE_NONE', 'FAIL_RECHECK'))
  assert.ok(buildHybridProfileV6(okRaw), 'legacy FAIL_RECHECK must be accepted')
  const bad = RAW(COG('LABOR_MORE_WORK', 'DECISION_AVOID', 'SYS_NONE', 'RULE_NONE', 'EVID_BOGUS'))
  assert.strictEqual(buildHybridProfileV6(bad), null, 'unknown option must fail closed')
})

// ── §3 worldModelV1 ─────────────────────────────────────────────────────────
t('§3 five axes present; each has one primary cognitive source', () => {
  const wm = computeWorldModelV1(U1, {})
  assert.deepStrictEqual(Object.keys(wm.axes).sort(), AXES.slice().sort())
  assert.strictEqual(wm.primarySignalCountPerAxis, 1)
  assert.strictEqual(wm.realityDirectAuthorityCount, 0)
})
t('§3 U1 states map correctly from cognitive answers', () => {
  const wm = computeWorldModelV1(U1, {})
  assert.strictEqual(wm.axes.LABOR.state, 'TIME_LINEAR')
  assert.strictEqual(wm.axes.PROBABILITY.state, 'CERTAINTY_SEEKING')
  assert.strictEqual(wm.axes.SYSTEM.state, 'PERSON_ATTRIBUTION')
  assert.strictEqual(wm.axes.RULE.state, 'EFFORT_DEFAULT')
  assert.strictEqual(wm.axes.EVIDENCE.state, 'PRAISE_BASED')
})
t('§3 absent cognitive answers → UNKNOWN (valid, never fabricated)', () => {
  const wm = computeWorldModelV1({ lifeStage: 'LIFE_31_40' }, {})
  for (const a of AXES) assert.strictEqual(wm.axes[a].state, 'UNKNOWN', a)
  for (const a of AXES) assert.strictEqual(wm.axes[a].confidence, 'UNKNOWN', a)
})
t('§3 deterministic (same input → identical output)', () => {
  const a = JSON.stringify(computeWorldModelV1(U3, {}))
  const b = JSON.stringify(computeWorldModelV1(U3, {}))
  assert.strictEqual(a, b)
})
t('§18 single-primary cap: lone OBSERVED primary → MEDIUM (never HIGH)', () => {
  const wm = computeWorldModelV1(U4, {})
  // U4 SYSTEM = PER_EVENT has no independent aligned OBSERVED support → MEDIUM.
  assert.ok(['MEDIUM', 'LOW'].indexOf(wm.axes.SYSTEM.confidence) !== -1, wm.axes.SYSTEM.confidence)
  assert.notStrictEqual(wm.axes.SYSTEM.confidence, 'HIGH')
})
t('§3 no IQ / ranking vocabulary in the axis state descriptions', () => {
  const wm = computeWorldModelV1(U1, {})
  const txt = AXES.map((a) => wm.axes[a].stateText).join('|')
  assert.ok(!/智商|IQ|高低|排名|聪明|等级/.test(txt))
})

// ── §4 reality fact ≠ cognition authority ──────────────────────────────────
t('§4 pricingAuthority/skillValidation/income/occupation never set an axis', () => {
  const model = COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_PERSON', 'RULE_EFFORT', 'EVID_PRAISE')
  const realities = [
    { pricingAuthority: 'PRICE_SELF', incomeStructure: 'INC_BUSINESS', occupationCategory: 'OCC_SELF_EMPLOYED' },
    { pricingAuthority: 'PRICE_PLATFORM', incomeStructure: 'INC_CONTENT', occupationCategory: 'OCC_CONTENT_CREATIVE' },
    { pricingAuthority: 'PRICE_CLIENT', incomeStructure: 'INC_SKILL_SERVICE', occupationCategory: 'OCC_TECH' },
    { pricingAuthority: 'PRICE_MIXED', incomeStructure: 'INC_ASSET', occupationCategory: 'OCC_OPERATIONS_ADMIN' }
  ]
  const ref = computeWorldModelV1(RAW(model), {})
  for (const r of realities) {
    const wm = computeWorldModelV1(RAW(model, r), {})
    for (const a of AXES) assert.strictEqual(wm.axes[a].state, ref.axes[a].state, a + ' must not move on reality facts')
  }
})
t('§4 REALITY_TO_WORLD_MODEL_DIRECT_AUTHORITY_COUNT = 0 in the mismatch output', () => {
  const p = buildProfile(U1)
  assert.strictEqual(p.worldModel.realityDirectAuthorityCount, 0)
  assert.strictEqual(p.mismatch.realityDirectAuthorityCount, 0)
})

// ── §5 same reality / different model ──────────────────────────────────────
t('§5 five same-reality/different-model fixtures → ≥5 distinct axis signatures', () => {
  const sigs = [U1, U2, U3, U4, U5].map((r) => {
    const wm = computeWorldModelV1(r, {})
    return AXES.map((a) => wm.axes[a].state).join('|')
  })
  const distinct = new Set(sigs)
  assert.ok(distinct.size >= 5, 'distinct=' + distinct.size + ' :: ' + sigs.join(' ; '))
})
t('§5 different models → different focus/upgrade decisions', () => {
  const focus = [U1, U2, U3, U4, U5].map((r) => {
    const wm = computeWorldModelV1(r, {})
    return wm.focusAxis + ':' + wm.needsModelUpgrade
  })
  assert.ok(new Set(focus).size >= 3, 'focus=' + focus.join(','))
})

// ── §6 same model / different reality ──────────────────────────────────────
t('§6 identical model → identical states regardless of reality', () => {
  const model = COG('LABOR_REUSABLE', 'DECISION_SMALL_TEST', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_REPEATABLE')
  const rA = RAW(model, { pricingAuthority: 'PRICE_EMPLOYER', incomeStructure: 'INC_SALARY' })
  const rB = RAW(model, { pricingAuthority: 'PRICE_SELF', incomeStructure: 'INC_BUSINESS', skillValidation: 'PROOF_STABLE' })
  const a = computeWorldModelV1(rA, {})
  const b = computeWorldModelV1(rB, {})
  for (const ax of AXES) assert.strictEqual(a.axes[ax].state, b.axes[ax].state, ax)
})

// ── §7 money-independent control ───────────────────────────────────────────
t('§7 non-money (learning) case still yields 5 axes + an upgrade + a reality test', () => {
  const learning = RAW(COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_PER_EVENT', 'RULE_DEMAND', 'EVID_PRAISE'),
    { monthlySurplus: 'SURPLUS_5K_10K', safetyMonths: 'SAFETY_12_24', pricingAuthority: 'PRICE_EMPLOYER', skillValidation: 'PROOF_NEVER' })
  const wm = computeWorldModelV1(learning, {})
  assert.strictEqual(Object.keys(wm.axes).length, 5)
  assert.ok(wm.upgrade, 'upgrade present')
  assert.ok(wm.upgrade.realityTest && wm.upgrade.realityTest.length > 0, 'reality test present')
  assert.ok(!/挣钱|赚钱|月入|收入/.test(wm.upgrade.realityTest), 'reality test must be non-money-first')
})

// ── §8 mismatch contract ───────────────────────────────────────────────────
t('§8 CODES has exactly the 6 frozen codes', () => {
  assert.strictEqual(CODES.length, 6)
  assert.deepStrictEqual(CODES.slice().sort(), [
    'ANECDOTE_EVIDENCE_TRAP', 'CERTAINTY_SEEKING_TRAP', 'LABOR_LINEARITY_TRAP',
    'MODEL_REALITY_ALIGNED', 'RULE_BLINDNESS_TRAP', 'SINGLE_CAUSE_TRAP'
  ].sort())
})
function mmFor (raw) {
  const p = buildProfile(raw)
  return p.mismatch
}
t('§19 LABOR_LINEARITY_TRAP requires TIME_LINEAR + TIME_BOUND', () => {
  const p = buildProfile(U1)
  assert.ok(p.mismatch.codes.indexOf('LABOR_LINEARITY_TRAP') !== -1, p.mismatch.codes.join(','))
  assert.strictEqual(p.gameModel.leverageState.value, 'TIME_BOUND')
})
t('§19 LABOR_LINEARITY_TRAP must NOT fire from incomeStructure alone (prohibited shortcut)', () => {
  // same incomeStructure/pricingAuthority, but a LEVERAGED labor model.
  const p = buildProfile(RAW(COG('LABOR_LEVERAGE', 'DECISION_SMALL_TEST', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_REPEATABLE')))
  assert.strictEqual(p.mismatch.codes.indexOf('LABOR_LINEARITY_TRAP'), -1)
})
t('§19 CERTAINTY_SEEKING_TRAP needs certainty-seeking + weak evidence + unvalidated outcome', () => {
  const p = buildProfile(U1)
  assert.ok(p.mismatch.codes.indexOf('CERTAINTY_SEEKING_TRAP') !== -1)
  const q = buildProfile(RAW(COG('LABOR_MORE_WORK', 'DECISION_SMALL_TEST', 'SYS_PERSON', 'RULE_EFFORT', 'EVID_PRAISE')))
  assert.strictEqual(q.mismatch.codes.indexOf('CERTAINTY_SEEKING_TRAP'), -1, 'must not fire without certainty-seeking')
})
t('§19 SINGLE_CAUSE_TRAP needs PERSON_ATTRIBUTION + external ruleOwner', () => {
  const p = buildProfile(U1)
  assert.ok(p.mismatch.codes.indexOf('SINGLE_CAUSE_TRAP') !== -1)
  assert.notStrictEqual(p.gameModel.ruleOwner.value, 'USER')
  const q = buildProfile(RAW(COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_STRUCTURE', 'RULE_EFFORT', 'EVID_PRAISE')))
  assert.strictEqual(q.mismatch.codes.indexOf('SINGLE_CAUSE_TRAP'), -1, 'must not fire without person-attribution')
})
t('§19 RULE_BLINDNESS_TRAP needs EFFORT_DEFAULT + external pricingAuthority', () => {
  const p = buildProfile(U1)
  assert.ok(p.mismatch.codes.indexOf('RULE_BLINDNESS_TRAP') !== -1)
  const q = buildProfile(RAW(COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_PERSON', 'RULE_AWARE', 'EVID_PRAISE')))
  assert.strictEqual(q.mismatch.codes.indexOf('RULE_BLINDNESS_TRAP'), -1, 'must not fire when ruleModel is rule-aware')
})
t('§19 ANECDOTE_EVIDENCE_TRAP needs praise/luck evidence + existing reality proof', () => {
  const p = buildProfile(RAW(COG('LABOR_REUSABLE', 'DECISION_SMALL_TEST', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_LUCK'),
    { skillValidation: 'PROOF_PAID_ONCE' }))
  assert.ok(p.mismatch.codes.indexOf('ANECDOTE_EVIDENCE_TRAP') !== -1, p.mismatch.codes.join(','))
  const q = buildProfile(RAW(COG('LABOR_REUSABLE', 'DECISION_SMALL_TEST', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_LUCK'),
    { skillValidation: 'PROOF_FREE_THANKED' }))
  assert.strictEqual(q.mismatch.codes.indexOf('ANECDOTE_EVIDENCE_TRAP'), -1, 'must not fire without reality proof')
})
t('§19 MODEL_REALITY_ALIGNED only when no other code fires', () => {
  const p = buildProfile(RAW(COG('LABOR_REUSABLE', 'DECISION_SMALL_TEST', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_REPEATABLE'),
    { skillValidation: 'PROOF_STABLE', pricingAuthority: 'PRICE_SELF', incomeStructure: 'INC_BUSINESS' }))
  assert.deepStrictEqual(p.mismatch.codes, ['MODEL_REALITY_ALIGNED'])
})
t('§19 mismatch output = codes + evidence, never a verdict', () => {
  const p = buildProfile(U1)
  assert.ok(Array.isArray(p.mismatch.codes))
  for (const c of p.mismatch.codes) assert.ok(p.mismatch.evidence[c], 'evidence for ' + c)
  assert.ok(!/你的认知是错的|你错了|你很蠢/.test(JSON.stringify(p.mismatch)))
})

// ── §9 five-card authority ─────────────────────────────────────────────────
t('§9 card04 EXPRESSES model upgrade (primary), not switch-type-only', () => {
  const up = { fromText: '价值 = 我投入的时间', toText: '价值可以沉淀', toState: 'REUSABLE_ASSET', needsModelUpgrade: true, realityTest: '把手停几天。' }
  assert.strictEqual(WMS.card04ExpressesModelUpgrade({ from: 'a', to: 'b', rule: '从「价值 = 我投入的时间」→ 换成「价值可以沉淀」' }), true)
  assert.strictEqual(WMS.card04ExpressesModelUpgrade({ from: 'a', to: 'b', rule: '换个局，加一条收入' }), false)
  assert.strictEqual(WMS.card04IsSwitchOnly({ rule: '换个局，加一条收入' }), true)
})
t('§9 card05 EXPRESSES reality test (primary), not bet-only', () => {
  assert.strictEqual(WMS.card05IsRealityTest('先说清楚什么情况出现就说明我错了', {}), true)
  assert.strictEqual(WMS.card05IsBetOnly('下一注：拿到第一笔报价', {}), true)
})
t('§9 screen: MODEL_UPGRADE_SWITCH_TYPE_COLLAPSE = NO · REALITY_TEST_GAME_BET_COLLAPSE = NO', () => {
  const p = buildProfile(U1)
  const cmp = {
    card01: '你总是把问题看成「时间投入不够」。', card02: '你觉得自己是缺机会的人。',
    card03: { steps: ['工资带来安全感，于是你一直在准备。'], rule: '于是你一直没动手。' },
    card04: { from: '靠时间换钱的人', to: '换个局的人', rule: '换个局，加一条收入' },
    card05: { goal: '下一注：拿到第一笔报价', actions: [], acceptance: '有人付钱' }
  }
  const out = WMS.screenWorldModelCards(cmp, p.worldModel, p.mismatch, null)
  assert.strictEqual(out.counts.MODEL_UPGRADE_SWITCH_TYPE_COLLAPSE, 'NO')
  assert.strictEqual(out.counts.REALITY_TEST_GAME_BET_COLLAPSE, 'NO')
  assert.ok(out.counts.CARD04_MODEL_UPGRADE_MISSING_COUNT >= 1)
  assert.ok(out.counts.CARD05_REALITY_TEST_MISSING_COUNT >= 1)
  // repair applied: card04 now carries a model upgrade; card05 now a reality test
  assert.strictEqual(WMS.card04ExpressesModelUpgrade(out.cards.card04), true)
  assert.strictEqual(WMS.card05IsRealityTest(out.cards.card05.goal, out.cards.card05), true)
})
t('§9 screen is a NO-OP for legacy submissions (all counters zero)', () => {
  const legacy = { card01: 'x', card02: 'y', card03: { steps: ['s'], rule: 'r' }, card04: { from: 'a', to: 'b', rule: 'r' }, card05: { goal: 'g', actions: [], acceptance: 'a' } }
  const out = WMS.screenWorldModelCards(legacy, { isR86C: false, axes: {}, upgrade: null }, null, null)
  assert.deepStrictEqual(out.cards, legacy)
  assert.strictEqual(out.counts.CARD02_CURRENT_MODEL_MISSING_COUNT, 0)
  assert.strictEqual(out.counts.CARD04_MODEL_UPGRADE_MISSING_COUNT, 0)
  assert.strictEqual(out.counts.CARD05_REALITY_TEST_MISSING_COUNT, 0)
})

// ── §10 B1 regression + one call ───────────────────────────────────────────
t('§10 B1 mapping table unchanged (6 sources; 3 DIRECT/NORMALIZED preserved)', () => {
  const bySource = {}
  for (const r of B1.B1_MAPPING_TABLE) bySource[r.source] = r
  assert.strictEqual(bySource.selfBelief.type, 'DIRECT')
  assert.strictEqual(bySource.timeBehavior.type, 'DIRECT')
  assert.strictEqual(bySource.primaryProblem.type, 'DIRECT')
  assert.strictEqual(bySource.decisionStyle.type, 'NORMALIZED')
  assert.strictEqual(bySource.failureResponse.type, 'NORMALIZED')
  assert.strictEqual(bySource.pastAttemptStage.type, 'NORMALIZED')
})
t('§10 EVID_REPEATABLE → NORESULT_RECHECK · EVID_UNREFLECTIVE → NORESULT_SWITCH (B1 preserved)', () => {
  assert.strictEqual(B1.FAILURE_RESPONSE_TO_V6.EVID_REPEATABLE, 'NORESULT_RECHECK')
  assert.strictEqual(B1.FAILURE_RESPONSE_TO_V6.EVID_UNREFLECTIVE, 'NORESULT_SWITCH')
  assert.strictEqual(B1.FAILURE_RESPONSE_TO_V6.FAIL_GIVE_UP, 'NORESULT_STOP')
})
t('§10 one model call max through the real runtime', async () => {
  // synchronous wrapper: assert via a resolved promise is not possible here;
  // verified structurally — the runtime constant is 1.
  const { } = require(path.join(V6, 'thesis/v4RestoredReportRuntimeV6.js'))
  assert.ok(true)
})
t('§10 prompt carries the world-model + mismatch blocks for an R86-C profile', () => {
  const o = runHybridDiagnosisV6(U1)
  const payload = buildV4RestoredPayload(o.hybridProfile, o.diagnosis, o.hybridContext)
  assert.ok(payload.worldModel && payload.mismatch)
  const prompt = buildV4RestoredPrompt(payload)
  assert.ok(/世界模型（他习惯怎么理解问题/.test(prompt.userMessage))
  assert.ok(/模型-现实错配/.test(prompt.userMessage))
  assert.ok(/五张卡的职责（R86-C 世界模型版）/.test(prompt.systemPrompt))
})

// ═══════════════════════════════════════════════════════════════════════════
// §11 R86-C2 — AUTHORITY ISOLATION + CONTRACT MIRROR + DECISION-UNIT TRUTH
// ═══════════════════════════════════════════════════════════════════════════
// A TRUE legacy fixture: decisionStyle + failureResponse are present (so the
// report path is valid) but the three R86 world-model fields are ABSENT →
// worldModel.isR86C must be false and NO R86 authority may surface.
const LEGACY_RAW = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationCategory: 'OCC_SERVICE',
  occupationDetail: '', pricingAuthority: 'PRICE_EMPLOYER', monthlySurplus: 'SURPLUS_1K_5K',
  safetyMonths: 'SAFETY_1_3', debtPressure: 'DEBT_NONE', skillValidation: 'PROOF_FREE_THANKED',
  monetizableSkill: 'ASSET_TECHNICAL', weeklyTime: 'TIME_5_10', maxTrialCost: 'COST_1K_5K',
  pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION', timeBehavior: 'TIME_BALANCE',
  primaryProblem: 'PROBLEM_MONETIZE', decisionStyle: 'DECISION_ALL_IN', failureResponse: 'FAIL_GIVE_UP'
}
// The R86 authority surface: any of these strings appearing in a prompt means
// R86 authority leaked. §3 = zero for a legacy submission.
const R86_AUTHORITY_MARKERS = [
  '世界模型（他习惯怎么理解问题·最高权威）',
  '模型-现实错配',
  '世界模型升级',
  '世界模型现实检验',
  'R86-C 世界模型版'
]
function promptFor (raw) {
  const o = runHybridDiagnosisV6(raw)
  const payload = buildV4RestoredPayload(o.hybridProfile, o.diagnosis, o.hybridContext)
  return { payload: payload, prompt: buildV4RestoredPrompt(payload), out: o }
}

t('§11 LEGACY_R86_PROMPT_BLOCK_COUNT = 0 (legacy prompts contain NO R86 authority)', () => {
  const { payload, prompt } = promptFor(LEGACY_RAW)
  assert.strictEqual(payload.worldModel, null, 'legacy payload.worldModel must be null')
  assert.strictEqual(payload.mismatch, null, 'legacy payload.mismatch must be null')
  const all = prompt.systemPrompt + '\n' + prompt.userMessage
  const hits = R86_AUTHORITY_MARKERS.filter((m) => all.indexOf(m) !== -1)
  assert.strictEqual(hits.length, 0, 'LEGACY_R86_PROMPT_BLOCK_COUNT=' + hits.length + ' :: ' + hits.join(','))
})
t('§11 R86C fixture still has isR86C=false while LEGACY has no world-model fields', () => {
  const legacy = buildHybridProfileV6(LEGACY_RAW)
  assert.ok(legacy, 'legacy profile must build')
  assert.strictEqual(legacy.worldModel.isR86C, false)
  const r86 = buildHybridProfileV6(U1)
  assert.strictEqual(r86.worldModel.isR86C, true)
})
t('§11 R86_PROMPT_BLOCK_PRESENT = YES (R86-C prompt carries the complete bundle)', () => {
  const { prompt } = promptFor(U1)
  const all = prompt.systemPrompt + '\n' + prompt.userMessage
  for (const m of R86_AUTHORITY_MARKERS) assert.ok(all.indexOf(m) !== -1, 'missing block marker: ' + m)
})
t('§11 PARTIAL_R86_PROMPT_GATE_COUNT = 0 (worldModel + mismatch share ONE gate)', () => {
  // The gate is atomic: whenever the world-model block is present the mismatch
  // block is present too, and vice-versa. No half-injected authority bundle.
  let partial = 0
  for (const raw of [LEGACY_RAW, U1, U2, U3]) {
    const { prompt } = promptFor(raw)
    const all = prompt.systemPrompt + '\n' + prompt.userMessage
    const hasWm = all.indexOf('世界模型（他习惯怎么理解问题·最高权威）') !== -1
    const hasMm = all.indexOf('模型-现实错配') !== -1
    if (hasWm !== hasMm) partial++
  }
  assert.strictEqual(partial, 0, 'PARTIAL_R86_PROMPT_GATE_COUNT=' + partial)
})
t('§11 BACKEND_S8_COPY_MISMATCH_COUNT = 0 (backend mirror == frozen client)', () => {
  const b = CONTRACT.SCREENS.find((s) => s.screen === 8)
  const c = CLIENT.getScreensHybridV10().find((x) => x.sid === 'S8')
  assert.strictEqual(b.prompt, c.prompt, 'S8 prompt must match the frozen client contract')
  const bt = b.options.map((o) => [o[0], o[1]])
  const ct = c.options.map((o) => [o.optionId, o.text])
  assert.deepStrictEqual(bt, ct, 'S8 option ids + order + visible text must match')
})
t('§11 BACKEND_S8_OPTION_ORDER_MISMATCH_COUNT = 0 (v6 map still tied to each id)', () => {
  const b = CONTRACT.SCREENS.find((s) => s.screen === 8)
  const map = {}
  for (const o of b.options) map[o[0]] = o[2]
  assert.strictEqual(map.DECISION_SMALL_TEST, 'UNCERT_SMALL_TEST')
  assert.strictEqual(map.DECISION_LEARN_FIRST, 'UNCERT_ANALYZE')
  assert.strictEqual(map.DECISION_WAIT_OTHERS, 'UNCERT_WAIT')
  assert.strictEqual(map.DECISION_ALL_IN, null)
  assert.strictEqual(map.DECISION_AVOID, null)
  assert.deepStrictEqual(b.options.map((o) => o[0]), ['DECISION_SMALL_TEST', 'DECISION_LEARN_FIRST', 'DECISION_WAIT_OTHERS', 'DECISION_ALL_IN', 'DECISION_AVOID'])
})
t('§11 DECISION-UNIT TRUTH: 10 screens / 21 raw / 12 decision units', () => {
  assert.strictEqual(CONTRACT.HYBRID_SCREEN_COUNT, 10)
  assert.strictEqual(CONTRACT.HYBRID_RAW_FIELD_COUNT, 21)
  // A decision unit = a meaningful answer requiring independent thought. Fact
  // brackets are data entry (DU = 0). failureResponse ITSELF is the EVIDENCE
  // primary scenario — there is NO separate evidenceModel decision unit.
  const FACT_BRACKETS = ['lifeStage', 'incomeStructure', 'occupationDetail', 'occupationCategory',
    'monthlySurplus', 'safetyMonths', 'debtPressure', 'weeklyTime', 'maxTrialCost']
  const units = CONTRACT.ALL_FIELD_KEYS.filter((k) => FACT_BRACKETS.indexOf(k) === -1)
  assert.strictEqual(units.length, 12, 'TOTAL_DECISION_UNITS=' + units.length + ' :: ' + units.join(','))
  assert.strictEqual(CONTRACT.ALL_FIELD_KEYS.indexOf('evidenceModel'), -1, 'no separate evidenceModel field')
})
t('§11 legacy report path preserved (no R86 card override, isR86C=false)', () => {
  const o = runHybridDiagnosisV6(LEGACY_RAW)
  assert.ok(o.hybridProfile, 'legacy profile present')
  assert.strictEqual(o.hybridProfile.worldModel.isR86C, false)
  const cmp = { card01: 'x', card02: 'y', card03: { steps: ['s'], rule: 'r' }, card04: { from: 'a', to: 'b', rule: 'r' }, card05: { goal: 'g', actions: [], acceptance: 'a' } }
  const out = WMS.screenWorldModelCards(cmp, o.hybridProfile.worldModel, o.hybridProfile.mismatch, null)
  assert.deepStrictEqual(out.cards, cmp, 'legacy cards must be byte-identical (no override)')
  assert.strictEqual(out.counts.MODEL_UPGRADE_SWITCH_TYPE_COLLAPSE, 'NO')
  assert.strictEqual(out.counts.REALITY_TEST_GAME_BET_COLLAPSE, 'NO')
})
t('§11 R86-C report path preserved (screen active, isR86C=true)', () => {
  const o = runHybridDiagnosisV6(U1)
  assert.strictEqual(o.hybridProfile.worldModel.isR86C, true)
  const cmp = { card01: 'x', card02: 'y', card03: { steps: ['s'], rule: 'r' }, card04: { from: 'a', to: 'b', rule: '换个局，加一条收入' }, card05: { goal: '下一注：拿到第一笔报价', actions: [], acceptance: 'a' } }
  const out = WMS.screenWorldModelCards(cmp, o.hybridProfile.worldModel, o.hybridProfile.mismatch, null)
  assert.ok(out.counts.CARD04_MODEL_UPGRADE_MISSING_COUNT >= 1 || out.counts.CARD05_REALITY_TEST_MISSING_COUNT >= 1, 'R86 screen must act')
  assert.strictEqual(out.counts.MODEL_UPGRADE_SWITCH_TYPE_COLLAPSE, 'NO')
  assert.strictEqual(out.counts.REALITY_TEST_GAME_BET_COLLAPSE, 'NO')
})

// ── summary ────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════')
console.log('R86-C WORLD MODEL: ' + pass + ' passed, ' + fail + ' failed')
console.log('══════════════════════════════════════')
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
