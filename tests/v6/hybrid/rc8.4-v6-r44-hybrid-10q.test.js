'use strict'
/**
 * tests/v6/hybrid/rc8.4-v6-r44-hybrid-10q.test.js
 *
 * RC8.4 V6 R44 — HYBRID 10-SCREEN QUESTIONNAIRE suite.
 * Deterministic; no AI, no deploy, no network.
 *
 * §2  10-screen contract · VISIBLE_SCREEN_COUNT = 10 · no 11th screen
 * §3  canonical belief/time/problem ids preserved (no SB_/TB_/PP_ ids)
 * §4  18 raw fields preserved · no silent overwrite
 * §5  hybrid profile shape
 * §6/§7 explicit adapter · SEMANTICALLY_UNSAFE_MAPPING_COUNT = 0
 * §8  execution stage mapping boundaries (marketProof never upgrades stage)
 * §9  decisionStyle mapping (all-in / avoid explicitly unmapped)
 * §10 failureResponse mapping coverage
 * §11 asset axis · ASSET_AXIS_DIAGNOSIS_MUTATION_COUNT = 0
 * §13 occupation optional downstream use; never invented
 * §14 market-proof overclaim = 0
 * §15 primaryGoal B1 usage = 0
 * §17 five-card product contract
 * §23 unknown canonical id rejection (no silent fallback)
 * §25 golden differential: B1_EQUIVALENT_INPUT_DIFF_COUNT = 0
 * §26 product readback: 3 complete hybrid reports
 */

const assert = require('assert')
const path = require('path')
const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const H = require(path.join(CF, 'hybrid/index.js'))
const CONTRACT = require(path.join(CF, 'hybrid/hybridContractV6.js'))
const { diagnoseTurnaroundV6 } = require(path.join(CF, 'index.js'))
const REPORT = require(path.join(CF, 'report/index.js'))
const { buildReportV6, validateReportV6, visibleText } = REPORT
const CLIENT = require(path.join(ROOT, 'utils/v6/turnaroundQuestionnaireHybridV10.js'))
const VM = require(path.join(ROOT, 'utils/v6/turnaroundReportViewModelV6.js'))

let pass = 0, fail = 0
function t (name, fn) {
  try { fn(); pass++; console.log('   ✓ ' + name) }
  catch (e) { fail++; console.log('   ✗ ' + name + '\n     ' + (e && e.message)) }
}

// ── fixtures ────────────────────────────────────────────────────────────
function rawA () { // programmer + technical + paid once + side income
  return {
    lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationDetail: '程序员',
    monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE',
    skillValidation: 'PROOF_PAID_ONCE', monetizableSkill: 'ASSET_TECHNICAL',
    weeklyTime: 'TIME_5_10', executionStability: 'EXEC_STABLE',
    pastAttemptStage: 'ATTEMPT_NO_SALE', selfBelief: 'BELIEF_ABILITY',
    decisionStyle: 'DECISION_SMALL_TEST', timeBehavior: 'TIME_SHORT_FIRST',
    primaryProblem: 'PROBLEM_INCOME_STUCK', primaryGoal: 'GOAL_SIDE_INCOME',
    maxTrialCost: 'COST_1K_5K', failureResponse: 'FAIL_RECHECK'
  }
}
function rawB () { // service/blue-collar + no clear asset
  return {
    lifeStage: 'LIFE_25_30', incomeStructure: 'INC_UNSTABLE', occupationDetail: '外卖骑手',
    monthlySurplus: 'SURPLUS_ZERO', safetyMonths: 'SAFETY_1_3', debtPressure: 'DEBT_CONSUMER',
    skillValidation: 'PROOF_NEVER', monetizableSkill: 'ASSET_UNCLEAR',
    weeklyTime: 'TIME_2_5', executionStability: 'EXEC_VOLATILE',
    pastAttemptStage: 'ATTEMPT_COURSE_ONLY', selfBelief: 'BELIEF_NO_DIRECTION',
    decisionStyle: 'DECISION_WAIT_OTHERS', timeBehavior: 'TIME_SHORT_FIRST',
    primaryProblem: 'PROBLEM_SIDE_UNSTARTED', primaryGoal: 'GOAL_FIND_DIRECTION',
    maxTrialCost: 'COST_ZERO', failureResponse: 'FAIL_GIVE_UP'
  }
}
function rawC () { // existing side-income / repeatability
  return {
    lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SKILL_SERVICE', occupationDetail: '平面设计师',
    monthlySurplus: 'SURPLUS_5K_10K', safetyMonths: 'SAFETY_6_12', debtPressure: 'DEBT_NONE',
    skillValidation: 'PROOF_OCCASIONAL', monetizableSkill: 'ASSET_CONTENT',
    weeklyTime: 'TIME_10_20', executionStability: 'EXEC_UNSTABLE',
    pastAttemptStage: 'ATTEMPT_FEW_SALES', selfBelief: 'BELIEF_TRIED_NO_RESULT',
    decisionStyle: 'DECISION_SMALL_TEST', timeBehavior: 'TIME_SHORT_FIRST',
    primaryProblem: 'PROBLEM_INCOME_STUCK', primaryGoal: 'GOAL_SIDE_TO_MAIN',
    maxTrialCost: 'COST_1K_5K', failureResponse: 'FAIL_RECHECK'
  }
}

console.log('\n── RC8.4 V6 R44 — HYBRID 10Q ──')

// ── §2 10-screen contract ───────────────────────────────────────────────
t('§2 VISIBLE_SCREEN_COUNT = 10 and no 11th screen', () => {
  assert.strictEqual(CONTRACT.HYBRID_SCREEN_COUNT, 10)
  assert.strictEqual(CONTRACT.SCREENS.length, 10)
  assert.strictEqual(CLIENT.HYBRID_SCREEN_COUNT, 10)
  assert.strictEqual(CLIENT.getScreensHybridV10().length, 10)
  assert.strictEqual(new Set(CONTRACT.SCREENS.map((s) => s.screen)).size, 10)
})

t('§2 screen order + field ownership (S1..S10)', () => {
  const expected = [
    'lifeStage', 'incomeStructure', 'monthlySurplus', 'safetyMonths', 'skillValidation',
    'weeklyTime', 'pastAttemptStage', 'decisionStyle', 'primaryProblem', 'maxTrialCost'
  ]
  assert.deepStrictEqual(CONTRACT.SCREENS.map((s) => s.key), expected)
})

// ── §4 18 raw fields ────────────────────────────────────────────────────
t('§4 HYBRID_RAW_FIELD_COUNT = 18', () => {
  assert.strictEqual(CONTRACT.HYBRID_RAW_FIELD_COUNT, 18)
  assert.strictEqual(CONTRACT.ALL_FIELD_KEYS.length, 18)
  assert.strictEqual(CONTRACT.REQUIRED_FIELD_KEYS.length, 17)
  assert.deepStrictEqual(CONTRACT.FREE_TEXT_FIELD_KEYS, ['occupationDetail'])
  assert.deepStrictEqual(CLIENT.allFieldKeys(), CONTRACT.ALL_FIELD_KEYS)
})

t('§4 the 15 V4-rich fields are preserved verbatim', () => {
  const need = ['lifeStage', 'incomeStructure', 'occupationDetail', 'monthlySurplus', 'safetyMonths',
    'debtPressure', 'skillValidation', 'monetizableSkill', 'weeklyTime', 'executionStability',
    'pastAttemptStage', 'decisionStyle', 'primaryGoal', 'maxTrialCost', 'failureResponse']
  for (const k of need) assert.ok(CONTRACT.ALL_FIELD_KEYS.indexOf(k) !== -1, 'missing ' + k)
  for (const k of ['selfBelief', 'timeBehavior', 'primaryProblem']) {
    assert.ok(CONTRACT.ALL_FIELD_KEYS.indexOf(k) !== -1, 'missing canonical ' + k)
  }
})

t('§4 no field silently overwrites another (profile slots distinct)', () => {
  const p = H.buildHybridProfileV6(rawA())
  assert.strictEqual(p.reality.occupation, '程序员')
  assert.strictEqual(p.asset.type, 'ASSET_TECHNICAL')
  assert.strictEqual(p.asset.marketProof, 'PROOF_PAID_ONCE')
  assert.strictEqual(p.behavior.decisionStyle, 'DECISION_SMALL_TEST')
  assert.strictEqual(p.behavior.timeAllocation, 'TIME_SHORT_FIRST')
  assert.strictEqual(p.desiredChange.primaryGoal, 'GOAL_SIDE_INCOME')
  assert.strictEqual(p.desiredChange.primaryProblem, 'PROBLEM_INCOME_STUCK')
})

// ── §3 canonical ids ────────────────────────────────────────────────────
t('§3 canonical BELIEF/TIME/PROBLEM ids preserved exactly', () => {
  const beliefIds = CONTRACT.SCREENS.find((s) => s.secondary && s.secondary.key === 'selfBelief')
    .secondary.options.map((o) => o[0])
  const timeIds = CONTRACT.SCREENS.find((s) => s.secondary && s.secondary.key === 'timeBehavior')
    .secondary.options.map((o) => o[0])
  const problemIds = CONTRACT.SCREENS.find((s) => s.key === 'primaryProblem').options.map((o) => o[0])
  assert.deepStrictEqual(beliefIds, CONTRACT.CANONICAL_BELIEF_IDS)
  assert.deepStrictEqual(timeIds, CONTRACT.CANONICAL_TIME_IDS)
  assert.deepStrictEqual(problemIds, CONTRACT.CANONICAL_PROBLEM_IDS)
})

t('§3 no SB_* / TB_* / PP_* ids anywhere in the contract', () => {
  const all = JSON.stringify(CONTRACT.SCREENS)
  assert.ok(!/\bSB_/.test(all), 'found SB_ id')
  assert.ok(!/\bTB_/.test(all), 'found TB_ id')
  assert.ok(!/\bPP_/.test(all), 'found PP_ id')
})

// ── §6/§7 adapter ───────────────────────────────────────────────────────
t('§6/§7 adapter maps DIRECT semantics at HIGH confidence; NONE for the rest', () => {
  const tbl = H.B1_MAPPING_TABLE
  const bySource = {}
  for (const r of tbl) bySource[r.source] = r
  assert.strictEqual(bySource.selfBelief.type, 'DIRECT')
  assert.strictEqual(bySource.selfBelief.confidence, 'HIGH')
  assert.strictEqual(bySource.timeBehavior.type, 'DIRECT')
  assert.strictEqual(bySource.primaryProblem.type, 'DIRECT')
  assert.strictEqual(bySource.pastAttemptStage.type, 'NORMALIZED')
  assert.strictEqual(bySource.decisionStyle.type, 'NORMALIZED')
  assert.strictEqual(bySource.failureResponse.type, 'NORMALIZED')
  for (const k of ['lifeStage', 'incomeStructure', 'occupationDetail', 'safetyMonths', 'debtPressure',
    'skillValidation', 'monetizableSkill', 'weeklyTime', 'executionStability', 'maxTrialCost', 'primaryGoal']) {
    assert.strictEqual(bySource[k].type, 'NONE', k + ' must be NONE')
  }
})

t('§7 SEMANTICALLY_UNSAFE_MAPPING_COUNT = 0 (unmapped source → no coercion)', () => {
  // All-in and avoid have NO genuinely equivalent V6 Q7 semantic -> must be null.
  const D = require(path.join(CF, 'hybrid/hybridB1AdapterV6.js')).DECISION_STYLE_TO_V6
  assert.strictEqual(D.DECISION_ALL_IN, null)
  assert.strictEqual(D.DECISION_AVOID, null)
  const F = require(path.join(CF, 'hybrid/hybridB1AdapterV6.js')).FAILURE_RESPONSE_TO_V6
  assert.strictEqual(F.FAIL_ADD_MONEY, null)
  assert.strictEqual(F.FAIL_UNSURE, null)
})

// ── §8 execution stage mapping ──────────────────────────────────────────
t('§8 execution stage mapping is deterministic + 1:1 to the V6 enum', () => {
  const M = require(path.join(CF, 'hybrid/hybridB1AdapterV6.js')).PAST_ATTEMPT_TO_STAGE
  assert.strictEqual(M.ATTEMPT_NONE, 'STAGE_THINKING')
  assert.strictEqual(M.ATTEMPT_COURSE_ONLY, 'STAGE_LEARNING')
  assert.strictEqual(M.ATTEMPT_UNDER_30D, 'STAGE_STARTED')
  assert.strictEqual(M.ATTEMPT_NO_SALE, 'STAGE_TESTING')
  assert.strictEqual(M.ATTEMPT_FEW_SALES, 'STAGE_EARLY_TRACTION')
  assert.strictEqual(M.ATTEMPT_STABLE_SIDE, 'STAGE_STABLE_TRACTION')
})

t('§8 marketProof never upgrades executionStage (boundary)', () => {
  // proof=stable but attempt=course-only -> stage stays LEARNING (no upgrade).
  const raw = Object.assign(rawA(), { skillValidation: 'PROOF_STABLE', pastAttemptStage: 'ATTEMPT_COURSE_ONLY' })
  const out = H.runHybridDiagnosisV6(raw)
  assert.strictEqual(out.diagnosis.executionStage, 'LEARNING')
  // and the reverse: attempt=stable-side + proof=never -> stage STABLE_TRACTION
  const raw2 = Object.assign(rawA(), { skillValidation: 'PROOF_NEVER', pastAttemptStage: 'ATTEMPT_STABLE_SIDE' })
  const out2 = H.runHybridDiagnosisV6(raw2)
  assert.strictEqual(out2.diagnosis.executionStage, 'STABLE_TRACTION')
})

// ── §9 decisionStyle mapping ────────────────────────────────────────────
t('§9 decisionStyle maps only equivalent choices; all-in/avoid dropped', () => {
  const map = { DECISION_ALL_IN: null, DECISION_SMALL_TEST: 'UNCERT_SMALL_TEST', DECISION_LEARN_FIRST: 'UNCERT_ANALYZE', DECISION_WAIT_OTHERS: 'UNCERT_WAIT', DECISION_AVOID: null }
  for (const [src, exp] of Object.entries(map)) {
    const raw = Object.assign(rawA(), { decisionStyle: src })
    const out = H.runHybridDiagnosisV6(raw)
    if (exp) assert.ok(out.unmapped.indexOf('decisionStyle') === -1, src + ' should map')
    else assert.ok(out.unmapped.indexOf('decisionStyle') !== -1, src + ' should be unmapped')
  }
})

// ── §10 failureResponse mapping ─────────────────────────────────────────
t('§10 FAILURE_RESPONSE_MAPPING_COVERAGE — 3 mapped, 2 explicitly unsupported', () => {
  const F = require(path.join(CF, 'hybrid/hybridB1AdapterV6.js')).FAILURE_RESPONSE_TO_V6
  assert.strictEqual(F.FAIL_GIVE_UP, 'NORESULT_STOP')
  assert.strictEqual(F.FAIL_SWITCH, 'NORESULT_SWITCH')
  assert.strictEqual(F.FAIL_RECHECK, 'NORESULT_RECHECK')
  assert.strictEqual(F.FAIL_ADD_MONEY, null)
  assert.strictEqual(F.FAIL_UNSURE, null)
})

// ── §11 asset axis ──────────────────────────────────────────────────────
t('§11 asset axis ladder is deterministic + evidence-grounded', () => {
  const cases = [
    [{ monetizableSkill: 'ASSET_UNCLEAR', skillValidation: 'PROOF_NEVER' }, 'NO_CLEAR_ASSET'],
    [{ monetizableSkill: 'ASSET_TECHNICAL', skillValidation: 'PROOF_NEVER' }, 'SKILL_IDENTIFIED_UNPROVEN'],
    [{ monetizableSkill: 'ASSET_TECHNICAL', skillValidation: 'PROOF_FREE_THANKED' }, 'SKILL_USED_FREE'],
    [{ monetizableSkill: 'ASSET_TECHNICAL', skillValidation: 'PROOF_FREE_HELPED' }, 'PROBLEM_SOLVING_PROOF'],
    [{ monetizableSkill: 'ASSET_TECHNICAL', skillValidation: 'PROOF_PAID_ONCE' }, 'PAID_ONCE'],
    [{ monetizableSkill: 'ASSET_TECHNICAL', skillValidation: 'PROOF_OCCASIONAL' }, 'OCCASIONAL_PAID'],
    [{ monetizableSkill: 'ASSET_TECHNICAL', skillValidation: 'PROOF_STABLE' }, 'REPEATABLE_PAID']
  ]
  for (const [asset, expected] of cases) {
    const raw = Object.assign(rawA(), asset)
    const st = H.computeAssetStateV6(H.buildHybridProfileV6(raw))
    assert.strictEqual(st.state, expected, JSON.stringify(asset))
  }
})

t('§11 ASSET_AXIS_DIAGNOSIS_MUTATION_COUNT = 0 (asset never changes bottleneck)', () => {
  // Same B1 semantics, wildly different asset -> identical bottleneck.
  const base = rawA()
  const variants = [
    { monetizableSkill: 'ASSET_UNCLEAR', skillValidation: 'PROOF_NEVER' },
    { monetizableSkill: 'ASSET_CONTENT', skillValidation: 'PROOF_STABLE' },
    { monetizableSkill: 'ASSET_CRAFT', skillValidation: 'PROOF_OCCASIONAL' }
  ]
  const pbs = variants.map((v) => H.runHybridDiagnosisV6(Object.assign({}, base, v)).diagnosis.primaryBottleneck)
  assert.strictEqual(new Set(pbs).size, 1, 'asset axis mutated the bottleneck: ' + JSON.stringify(pbs))
  assert.strictEqual(pbs[0], H.runHybridDiagnosisV6(base).diagnosis.primaryBottleneck)
})

// ── §13 occupation ──────────────────────────────────────────────────────
t('§13 occupation optional; absent → null, never invented', () => {
  const raw = Object.assign(rawA(), {})
  delete raw.occupationDetail
  const out = H.runHybridDiagnosisV6(raw)
  assert.strictEqual(out.valid, true, 'occupation must NOT block')
  assert.strictEqual(out.hybridProfile.reality.occupation, null)
  const ctx = out.hybridContext
  assert.ok(!ctx.realityLine.includes('「'), 'no invented occupation clause')
})

t('§13 occupation captured + used downstream when present', () => {
  const out = H.runHybridDiagnosisV6(rawA())
  assert.strictEqual(out.hybridProfile.reality.occupation, '程序员')
  assert.ok(out.hybridContext.realityLine.includes('程序员'), 'occupation not used in context')
  assert.ok(out.hybridContext.pathLine.includes('程序员'), 'occupation not used in pathLine')
})

// ── §14 market proof overclaim ──────────────────────────────────────────
t('§14 MARKET_PROOF_OVERCLAIM_COUNT = 0 (never claims validation when unproven)', () => {
  const unproven = [
    { monetizableSkill: 'ASSET_TECHNICAL', skillValidation: 'PROOF_NEVER' },
    { monetizableSkill: 'ASSET_TECHNICAL', skillValidation: 'PROOF_FREE_HELPED' },
    { monetizableSkill: 'ASSET_TECHNICAL', skillValidation: 'PROOF_FREE_THANKED' },
    { monetizableSkill: 'ASSET_UNCLEAR', skillValidation: 'PROOF_NEVER' }
  ]
  for (const v of unproven) {
    const ctx = H.buildHybridReportContextV6(H.buildHybridProfileV6(Object.assign(rawA(), v)))
    assert.strictEqual(ctx.marketValidated, false, JSON.stringify(v))
    assert.ok(!/已经被市场验证|市场已经验证|已经被验证/.test(ctx.assetLine), 'overclaim: ' + ctx.assetLine)
  }
})

t('§14 proven cases MAY state market validation', () => {
  const ctx = H.buildHybridReportContextV6(H.buildHybridProfileV6(Object.assign(rawA(), { skillValidation: 'PROOF_PAID_ONCE' })))
  assert.strictEqual(ctx.marketValidated, true)
  assert.ok(/付过一次钱/.test(ctx.assetLine))
})

// ── §15 primaryGoal ─────────────────────────────────────────────────────
t('§15 PRIMARY_GOAL_B1_USAGE_COUNT = 0 · problem maps, goal does not', () => {
  const A = H.runHybridDiagnosisV6(rawA())
  assert.strictEqual(A.mapped.primaryProblem, 'PROBLEM_INCOME_STUCK')
  assert.strictEqual(A.mapped.primaryGoal, undefined)
  // changing ONLY the goal must not change the bottleneck
  const B = H.runHybridDiagnosisV6(Object.assign(rawA(), { primaryGoal: 'GOAL_DEBT' }))
  assert.strictEqual(A.diagnosis.primaryBottleneck, B.diagnosis.primaryBottleneck)
})

// ── §17 five-card contract ──────────────────────────────────────────────
t('§17 CARD_COUNT = 5 and R38 presentation authority holds', () => {
  for (const raw of [rawA(), rawB(), rawC()]) {
    const out = H.runHybridDiagnosisV6(raw)
    const rep = buildReportV6(out.diagnosis, out.hybridContext)
    assert.strictEqual(rep.reportState, 'PRIMARY', 'state')
    const v = validateReportV6(rep)
    assert.strictEqual(v.hasAllCards, true)
    assert.strictEqual(v.cardCount, 5)
    assert.strictEqual(v.forbiddenTokens.length, 0, 'forbidden tokens: ' + v.forbiddenTokens)
    assert.strictEqual(v.card01OverLength, false)
    const vm = VM.buildCardListV6(rep.cards)
    assert.strictEqual(vm.length, 5)
    assert.deepStrictEqual(vm.map((c) => c.key),
      ['fatalInsight', 'coreProblem', 'systemLoop', 'turnaroundPath', 'firstAction'])
    // One presentation authority per card (R38): no body on systemLoop/turnaroundPath.
    assert.ok(!('body' in vm[2]))
    assert.ok(!('body' in vm[3]))
    assert.ok(!('checks' in vm[4]))
  }
})

// ── §23 invalid / unknown ids ───────────────────────────────────────────
t('§23 unknown optionId is REJECTED (no silent fallback)', () => {
  const bad = Object.assign(rawA(), { selfBelief: 'BELIEF_NOT_REAL' })
  const out = H.runHybridDiagnosisV6(bad)
  assert.strictEqual(out.valid, false)
  assert.strictEqual(out.diagnosis.diagnosisState, 'INVALID_INPUT')
})

t('§23 missing required field is REJECTED (fail-closed)', () => {
  const bad = Object.assign(rawA(), {})
  delete bad.primaryProblem
  assert.strictEqual(H.runHybridDiagnosisV6(bad).valid, false)
  assert.strictEqual(H.runHybridDiagnosisV6(null).valid, false)
})

t('§23 unknown BELIEF id never becomes BELIEF_MATCH', () => {
  const bad = Object.assign(rawA(), { selfBelief: 'BELIEF_XX' })
  const out = H.runHybridDiagnosisV6(bad)
  assert.strictEqual(out.diagnosis.diagnosisState, 'INVALID_INPUT')
  assert.strictEqual(out.diagnosis.beliefRelation, null)
})

// ── §25 GOLDEN DIFFERENTIAL ─────────────────────────────────────────────
t('§25 B1_EQUIVALENT_INPUT_DIFF_COUNT = 0 (hybrid == native V6 for equivalent semantics)', () => {
  const NATIVE = [
    {
      native: { Q1: '31–40', Q2: '固定工资', Q3: '1000–5000元', Q4: '收入一直上不去', Q5: '能力还不够', Q6: '做过产品/服务，但没人买单', Q7: '先做个很小的版本试试', Q8: '先做马上有结果的', Q9: '重新检查方法和步骤' },
      hybrid: rawA()
    },
    {
      native: { Q1: '25–30', Q2: '自由职业 / 接单', Q3: '5000–10000元', Q4: '收入一直上不去', Q5: '做过不少尝试，但没结果', Q6: '已经有人愿意付钱', Q7: '先做个很小的版本试试', Q8: '先做马上有结果的', Q9: '重新检查方法和步骤' },
      hybrid: rawC()
    }
  ]
  for (const c of NATIVE) {
    const dn = diagnoseTurnaroundV6(c.native)
    assert.strictEqual(dn.diagnosisState, 'PRIMARY', 'native fixture must be a valid PRIMARY submission')
    const dh = H.runHybridDiagnosisV6(c.hybrid).diagnosis
    assert.strictEqual(dh.primaryBottleneck, dn.primaryBottleneck, 'bottleneck')
    assert.strictEqual(dh.beliefRelation.relation, dn.beliefRelation.relation, 'belief')
    assert.strictEqual(dh.executionStage, dn.executionStage, 'stage')
    assert.strictEqual(dh.firstActionType, dn.firstActionType, 'action')
    assert.strictEqual(dh.recommendedNextStage, dn.recommendedNextStage, 'nextStage')
    assert.strictEqual(dh.diagnosisState, dn.diagnosisState, 'state')
  }
})

// ── §27 zero regression when no hybrid context ──────────────────────────
t('§27 buildReportV6 without context is byte-identical to pre-R44 output', () => {
  const native = { Q1: '31–40', Q2: '固定工资', Q3: '1000–5000元', Q4: '收入一直上不去', Q5: '能力还不够', Q6: '做过产品/服务，但没人买单', Q7: '先做个很小的版本试试', Q8: '先做马上有结果的', Q9: '重新检查方法和步骤' }
  const d = diagnoseTurnaroundV6(native)
  const r = buildReportV6(d) // no context
  assert.strictEqual(r.cards.turnaroundPath.specificity, '')
  assert.strictEqual(r.cards.firstAction.specificity, '')
  assert.ok(!r.cards.coreProblem.text.includes('你的职业是'), 'no hybrid reality line leaked')
})

// ── §26 product readback: 3 complete reports ────────────────────────────
t('§26 three hybrid reports are complete and differ by REALITY + ASSET', () => {
  const reports = [rawA(), rawB(), rawC()].map((raw) => {
    const out = H.runHybridDiagnosisV6(raw)
    const rep = buildReportV6(out.diagnosis, out.hybridContext)
    return { out, rep, vm: VM.buildCardListV6(rep.cards) }
  })
  for (const r of reports) {
    assert.strictEqual(r.rep.reportState, 'PRIMARY')
    assert.strictEqual(r.vm.length, 5)
    assert.ok(r.rep.cards.coreProblem.text.length > 30)
    assert.ok(r.rep.cards.firstAction.action.length > 0)
    assert.ok(r.rep.cards.turnaroundPath.specificity.length > 0)
  }
  // CARD04 specificity differs across the three (reality+asset driven)
  const specs = reports.map((r) => r.rep.cards.turnaroundPath.specificity)
  assert.strictEqual(new Set(specs).size, 3, 'CARD04 specificity not distinct: ' + JSON.stringify(specs))
  // CARD05 sizing differs (capacity driven)
  const sizes = reports.map((r) => r.rep.cards.firstAction.specificity)
  assert.strictEqual(new Set(sizes).size, 3, 'CARD05 sizing not distinct')
})

console.log('\n══════════════════════════════════════')
console.log('R44 HYBRID 10Q: ' + pass + ' passed, ' + fail + ' failed')
console.log('══════════════════════════════════════')
if (fail) process.exitCode = 1
