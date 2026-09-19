'use strict'
/**
 * tests/v6/reasoning/rc8.4-v6-r87b2-five-card-integration.test.js
 *
 * R87B2 — FIVE-CARD INTEGRATION focused suite (§17).
 *
 * Verifies the accepted R87B1 reasoning core renders the FIVE VISIBLE cards from
 * ONE caseThesis (REALITY → CONTRADICTION → DERIVED INSIGHT → MECHANISM →
 * PERSONAL LOOP → SWITCH → REALITY TEST), that every visible sentence is
 * ledger-grounded (§3/§7/§11), that the five cards cohere (§9), and that the
 * controlled provider cannot mutate the deterministic conclusions (§10).
 *
 * Run: node tests/v6/reasoning/rc8.4-v6-r87b2-five-card-integration.test.js
 */

const path = require('path')
const assert = require('assert')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const V6 = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const RE = require(path.join(V6, 'reasoning/realityEvidenceV1.js'))
const R = require(path.join(V6, 'reasoning/index.js'))
const CR = require(path.join(V6, 'reasoning/caseReportV1.js'))
const CA = require(path.join(V6, 'reasoning/claimAuditV1.js'))
const S = require(path.join(V6, 'reasoning/caseReportScreenV1.js'))
const P = require(path.join(V6, 'reasoning/caseReportPolishV1.js'))

let pass = 0, fail = 0
const fails = []
function t (name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name) } catch (e) { fail++; fails.push(name + ' :: ' + e.message); console.log('  ✗ ' + name + ' :: ' + e.message) }
}

const OWNER = { lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationCategory: 'OCC_CONTENT_CREATIVE', occupationDetail: '短视频运营', pricingAuthority: 'PRICE_EMPLOYER', monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_1_3', debtPressure: 'DEBT_NONE', skillValidation: 'PROOF_FREE_THANKED', monetizableSkill: 'ASSET_CONTENT', weeklyTime: 'TIME_5_10', maxTrialCost: 'COST_1K_5K', pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION', primaryProblem: 'PROBLEM_MONETIZE', laborModel: 'LABOR_MORE_WORK', decisionStyle: 'DECISION_WAIT_OTHERS', systemModel: 'SYS_PERSON', ruleModel: 'RULE_EFFORT', failureResponse: 'EVID_PRAISE', timeBehavior: 'TIME_PROTECT_LONG' }
const BASE = { lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationCategory: 'OCC_CONTENT_CREATIVE', occupationDetail: '短视频运营', pricingAuthority: 'PRICE_EMPLOYER', monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_1_3', debtPressure: 'DEBT_NONE', skillValidation: 'PROOF_FREE_THANKED', monetizableSkill: 'ASSET_CONTENT', weeklyTime: 'TIME_5_10', maxTrialCost: 'COST_1K_5K', pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION', timeBehavior: 'TIME_BALANCE', primaryProblem: 'PROBLEM_MONETIZE' }
const COG = (l, d, s, r, f) => ({ laborModel: l, decisionStyle: d, systemModel: s, ruleModel: r, failureResponse: f })
const RAW = (cog, reality) => Object.assign({}, BASE, reality || {}, cog)
const build = (raw) => S.buildCaseReportFromProfile({ _raw: raw }, null)
const sig = (cr) => [cr.card01, cr.card02, JSON.stringify(cr.card03.steps), cr.card04.from + '|' + cr.card04.to + '|' + cr.card04.rule, cr.card05.goal + '|' + (cr.card05.actions || []).join('')].join('||')

console.log('\nRC8.4 V6 R87B2 — FIVE-CARD INTEGRATION\n')

// ── §12 OWNER VISIBLE REPORT ────────────────────────────────────────────────
t('§12 owner report renders ALL five cards as non-empty visible text', () => {
  const b = build(OWNER)
  assert.strictEqual(b.ok, true)
  assert.ok(b.caseReport.card01.length > 30)
  assert.ok(b.caseReport.card02.length > 30)
  assert.ok(b.caseReport.card03.steps.length >= 4 && b.caseReport.card03.rule)
  assert.ok(b.caseReport.card04.from && b.caseReport.card04.to && b.caseReport.card04.rule)
  assert.ok(b.caseReport.card05.goal && b.caseReport.card05.actions.length >= 3 && b.caseReport.card05.acceptance)
})
t('§12 owner PRIMARY CONTRADICTION / DERIVED INSIGHT / SWITCH / KEY UNKNOWN present', () => {
  const b = build(OWNER)
  assert.strictEqual(b.caseReport.contradictionId, 'CAPABILITY_UNEXPOSED')
  assert.strictEqual(b.caseThesis.primaryDerivedInsight.insightId, 'CONSTRAINT_IS_ALLOCATION_NOT_CAPABILITY')
  assert.strictEqual(b.caseReport.switchClass, 'CHANGE_ALLOCATION')
  assert.ok(b.caseReport.keyUnknown && b.caseReport.keyUnknown.length > 8)
})

// ── §3/§7/§11 CLAIM GROUNDING ───────────────────────────────────────────────
t('§11 owner visible claim audit: all six counters + option-restatement = 0', () => {
  const b = build(OWNER)
  const a = b.audit
  assert.strictEqual(a.VISIBLE_CLAIM_WITHOUT_LEDGER_COUNT, 0)
  assert.strictEqual(a.UNSUPPORTED_SENTENCE_COUNT, 0)
  assert.strictEqual(a.FABRICATED_FACT_COUNT, 0)
  assert.strictEqual(a.FABRICATED_PSYCHOLOGY_COUNT, 0)
  assert.strictEqual(a.TEMPORAL_FACT_WITHOUT_SOURCE_COUNT, 0)
  assert.strictEqual(a.EMPLOYMENT_MECHANIC_OVERCLAIM_COUNT, 0)
  assert.strictEqual(a.CARD02_OPTION_RESTATEMENT_COUNT, 0)
})

// ── §R87B2_1 VISIBLE SEMANTIC BOUNDARIES ────────────────────────────────────
t('§R87B2_1 owner audit adds pricing-universalization + experiment-overclaim = 0', () => {
  const b = build(OWNER)
  assert.strictEqual(b.audit.PRICING_POWER_UNIVERSALIZATION_COUNT, 0)
  assert.strictEqual(b.audit.EXPERIMENT_RESULT_OVERCLAIM_COUNT, 0)
})
t('§R87B2_1 A: no unsourced "过去一年" duration in the visible report', () => {
  const b = build(OWNER)
  const blob = [b.caseReport.card01, b.caseReport.card02, JSON.stringify(b.caseReport.card03), JSON.stringify(b.caseReport.card04), JSON.stringify(b.caseReport.card05)].join(' ')
  assert.ok(!/过去一年/.test(blob), 'unsourced duration present')
})
t('§R87B2_1 C: no fabricated "靠谱/认可" reward attribution', () => {
  const b = build(OWNER)
  const blob = [b.caseReport.card02, JSON.stringify(b.caseReport.card03)].join(' ')
  assert.ok(!/靠谱|对方很认可|被当成/.test(blob), 'fabricated reward attribution present')
})
t('§R87B2_1 D: no pricing-power universalization as the change target', () => {
  const b = build(OWNER)
  const blob = [b.caseReport.card01, b.caseReport.card02, JSON.stringify(b.caseReport.card03), JSON.stringify(b.caseReport.card04), JSON.stringify(b.caseReport.card05)].join(' ')
  assert.ok(!/由你或市场定价|能被直接定价|不由别人定价|明码标价|陌生人看得见的渠道/.test(blob))
  assert.ok(/产生新证据/.test(b.caseReport.card04.to), 'target should be new-evidence re-allocation')
})
t('§R87B2_1 E: Card05 goal does NOT assert certainty ("只差一次")', () => {
  const b = build(OWNER)
  assert.ok(!/只差一次|差的不是决心或能力/.test(b.caseReport.card05.goal))
  assert.ok(/产生新证据的现实测试/.test(b.caseReport.card05.goal))
})
t('§R87B2_1 §3: Card05 acceptance is bounded (no "方向对" final truth)', () => {
  const b = build(OWNER)
  assert.ok(!/方向对|≥1 次真实付费意向/.test(b.caseReport.card05.acceptance))
  assert.ok(/继续验证|暴露|需求|供给|呈现/.test(b.caseReport.card05.acceptance))
})
t('§R87B2_1 §4: contradiction + derived insight preserved after tightening', () => {
  const b = build(OWNER)
  assert.strictEqual(b.caseReport.contradictionId, 'CAPABILITY_UNEXPOSED')
  assert.strictEqual(b.caseThesis.primaryDerivedInsight.insightId, 'CONSTRAINT_IS_ALLOCATION_NOT_CAPABILITY')
})

// ── §R87C P0 EMPLOYMENT VALUE vs INDEPENDENT MARKET PROOF ───────────────────
t('§R87C P0 owner: employed+free-only misclassification = 0', () => {
  const b = build(OWNER)
  assert.strictEqual(b.audit.EMPLOYED_SKILL_MISCLASSIFIED_AS_FREE_ONLY_COUNT, 0)
  const blob = [b.caseReport.card01, b.caseReport.card02, JSON.stringify(b.caseReport.card03)].join(' ')
  assert.ok(!/只在免费场合露面|至今只在|只在「被感谢」的场景里出现过/.test(blob), 'free-only misclassification present')
})
t('§R87C P0 owner: employment value is NOT denied', () => {
  const b = build(OWNER)
  assert.strictEqual(b.audit.EMPLOYMENT_VALUE_DENIED_COUNT, 0)
  // card01 must acknowledge the capability is already used inside paid employment
  assert.ok(/已经在公司体系内被使用|工资/.test(b.caseReport.card01))
  assert.ok(!/从未产生过收入|没上过场/.test(b.caseReport.card01))
})
t('§R87C P0 owner: independent-market-proof not confused with job income', () => {
  const b = build(OWNER)
  assert.strictEqual(b.audit.INDEPENDENT_MARKET_PROOF_CONFUSED_WITH_JOB_INCOME_COUNT, 0)
  // the employed+free fixture must NOT be told its capability is market-validated
  assert.ok(!/已经被市场验证|已被市场验证|已经被付费验证/.test(b.caseReport.card01))
  // it must point to the OUT-OF-SYSTEM independent validation as what's missing
  assert.ok(/系统外|体系外|独立/.test(b.caseReport.card02))
})
t('§R87C P0 owner: effort→pricing is NOT an absolute causal claim', () => {
  const b = build(OWNER)
  assert.strictEqual(b.audit.EFFORT_TO_PRICING_CAUSAL_OVERCLAIM_COUNT, 0)
  assert.ok(!/你投入再多也不改变/.test(b.caseReport.card04.rule))
  assert.ok(/并不会自动改变/.test(b.caseReport.card04.rule))
})
t('§R87C P0 owner: Card05 experiment is ONE action (no bundle)', () => {
  const b = build(OWNER)
  assert.strictEqual(b.audit.CARD05_MULTI_ACTION_EXPERIMENT_COUNT, 0)
  const test = b.caseReport.card05.actions[0]
  assert.ok(!/一次报价\/一次公开交付|或者一次|二选一/.test(test))
  assert.ok(/一次报价/.test(test))
  // observation enumerates reactions but does NOT require actual payment
  assert.ok(/继续询问|讨价还价|拒绝/.test(b.caseReport.card05.actions[1]))
})
t('§R87C P0 owner: base §11 counters + pricing/experiment overclaim stay 0', () => {
  const b = build(OWNER)
  assert.strictEqual(b.audit.UNSUPPORTED_SENTENCE_COUNT, 0)
  assert.strictEqual(b.audit.FABRICATED_FACT_COUNT, 0)
  assert.strictEqual(b.audit.FABRICATED_PSYCHOLOGY_COUNT, 0)
  assert.strictEqual(b.audit.PRICING_POWER_UNIVERSALIZATION_COUNT, 0)
  assert.strictEqual(b.audit.EXPERIMENT_RESULT_OVERCLAIM_COUNT, 0)
})
t('§R87C P0 guard: a fixture that DOES say "only free" is caught', () => {
  const b = build(OWNER)
  const tampered = Object.assign({}, b.caseReport, { card01: '这项能力至今只在「被感谢」的场景里出现过。' })
  const a = CA.auditVisibleClaims(tampered, b.evidence)
  assert.ok(a.EMPLOYED_SKILL_MISCLASSIFIED_AS_FREE_ONLY_COUNT > 0)
})
t('§3 every visible segment resolves to answered evidence (no phantom facts)', () => {
  const b = build(OWNER)
  for (const cl of b.caseReport.claims) {
    assert.ok(cl.claimLevel, 'claim level present')
    if (cl.claimLevel !== 'L3_TESTABLE_HYPOTHESIS') {
      assert.ok(cl.evidenceIds.length > 0, 'L1/L2 claim has evidence: ' + cl.semanticClaim)
    }
  }
})
t('§R87B2_1 §5: five-card coherence still PASS after tightening', () => {
  const b = build(OWNER)
  assert.strictEqual(S.checkCoherence(b.caseReport, b.caseThesis).CARD_COHERENCE_PASS, 'YES')
})
t('§3 B1 boundary: no employment overclaim, no fabricated psychology in any card', () => {
  const b = build(OWNER)
  const blob = [b.caseReport.card01, b.caseReport.card02, JSON.stringify(b.caseReport.card03), JSON.stringify(b.caseReport.card04), JSON.stringify(b.caseReport.card05)].join(' ')
  assert.ok(!/公司按时间付钱|一直投在公司里|老板认可|涨薪/.test(blob))
  assert.ok(!/焦虑|内耗|自尊|心理/.test(blob))
})

// ── §9 FIVE-CARD COHERENCE ──────────────────────────────────────────────────
t('§9 five-card coherence PASS for the owner fixture', () => {
  const b = build(OWNER)
  const coh = S.checkCoherence(b.caseReport, b.caseThesis)
  assert.strictEqual(coh.CARD_COHERENCE_PASS, 'YES')
  for (const k of Object.keys(coh.detail)) assert.strictEqual(coh.detail[k], true, k)
})
t('§9 every card is keyed to the SAME contradiction (no second diagnosis)', () => {
  const b = build(OWNER)
  assert.strictEqual(b.caseThesis.primaryContradiction.contradictionId, b.caseReport.contradictionId)
})

// ── §8/§13 WEAK EVIDENCE & ALIGNED CASE ─────────────────────────────────────
t('§13 weak evidence (all-unknown) → honest ALIGNED case, no fabricated diagnosis', () => {
  const b = build({ laborModel: 'LABOR_MORE_WORK' })
  assert.strictEqual(b.ok, true)
  assert.ok(b.caseReport.card01.length > 20)
  assert.strictEqual(b.audit.FABRICATED_FACT_COUNT, 0)
  assert.strictEqual(b.audit.UNSUPPORTED_SENTENCE_COUNT, 0)
})
t('§9 aligned case → no forced contradiction; deterministic and coherent', () => {
  const b = build(RAW(COG('LABOR_REUSABLE', 'DECISION_ALL_IN', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_REPEATABLE'), { skillValidation: 'PROOF_STABLE', pricingAuthority: 'PRICE_SELF', occupationCategory: 'OCC_SELF_EMPLOYED', occupationDetail: '设计工作室', pastAttemptStage: 'ATTEMPT_STABLE_SIDE' }))
  assert.strictEqual(b.caseReport.contradictionId, 'ALIGNED_NO_CONTRADICTION')
  assert.strictEqual(b.audit.FABRICATED_FACT_COUNT, 0)
})

// ── §8 ALREADY-MARKET-VALIDATED ─────────────────────────────────────────────
t('§8 already-market-validated (paid proof) is never told to "get validated first"', () => {
  const b = build(RAW(COG('LABOR_PRICING', 'DECISION_SMALL_TEST', 'SYS_STRUCTURE', 'RULE_DEMAND', 'EVID_PRAISE'), { skillValidation: 'PROOF_PAID_ONCE', pricingAuthority: 'PRICE_EMPLOYER', incomeStructure: 'INC_COMMISSION', occupationDetail: '房产销售', occupationCategory: 'OCC_SALES' }))
  assert.ok(['ADD_OPTIONALITY', 'STAY_AND_UPGRADE', 'VALIDATED_NOT_REPEATABLE'].indexOf(b.caseReport.switchClass) !== -1 || b.caseReport.switchClass !== 'RUN_TEST_FIRST')
  assert.ok(!/先去.*验证|先去.*收费/.test(b.caseReport.card04.to))
})

// ── §8 DEBT-FIRST ───────────────────────────────────────────────────────────
t('§8 debt-first profile → cashflow/buffer is the constraint', () => {
  const b = build(RAW(COG('LABOR_LEVERAGE', 'DECISION_ALL_IN', 'SYS_PER_EVENT', 'RULE_NONE', 'EVID_LUCK'), { occupationCategory: 'OCC_SELF_EMPLOYED', occupationDetail: '小生意', pricingAuthority: 'PRICE_SELF', monthlySurplus: 'SURPLUS_1K_5K', debtPressure: 'DEBT_HIGH', safetyMonths: 'SAFETY_1_3', skillValidation: 'PROOF_PAID_ONCE', monetizableSkill: 'ASSET_CRAFT', pastAttemptStage: 'ATTEMPT_FEW_SALES', primaryProblem: 'PROBLEM_DEBT' }))
  assert.ok(['DEBT_PRESSURE_DOMINANT', 'LIQUIDITY_VS_AMBITION'].indexOf(b.caseReport.contradictionId) !== -1, b.caseReport.contradictionId)
  assert.strictEqual(b.audit.FABRICATED_FACT_COUNT, 0)
})

// ── §8 STAY-AND-UPGRADE / NO-SWITCH-YET ─────────────────────────────────────
t('§8 stay-and-upgrade profile → STAY_AND_UPGRADE switch class', () => {
  const b = build(RAW(COG('LABOR_REUSABLE', 'DECISION_ALL_IN', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_REPEATABLE'), { skillValidation: 'PROOF_STABLE', pricingAuthority: 'PRICE_SELF', occupationCategory: 'OCC_SELF_EMPLOYED', occupationDetail: '私教', pastAttemptStage: 'ATTEMPT_STABLE_SIDE' }))
  assert.strictEqual(b.caseReport.switchClass, 'STAY_AND_UPGRADE')
})
t('§8 low-surplus profile → NO_SWITCH_YET switch class', () => {
  const b = build(RAW(COG('LABOR_MORE_WORK', 'DECISION_LEARN_FIRST', 'SYS_NONE', 'RULE_EFFORT', 'EVID_LUCK'), { monthlySurplus: 'SURPLUS_UNDER_1K' }))
  assert.strictEqual(b.caseReport.switchClass, 'NO_SWITCH_YET')
})

// ── §10 PROVIDER MUTATION ───────────────────────────────────────────────────
t('§10 provider CANNOT mutate contradiction / switch / experiment / claim level', () => {
  const b = build(OWNER)
  const bad = P.polishCaseReport(b.caseReport, b.evidence, { card01: b.caseReport.card01, card05: { goal: 'x' } })
  assert.strictEqual(bad.applied, false)
  const v = P.validateProviderOutput(b.caseReport, Object.assign({}, b.caseReport, { switchClass: 'STAY_AND_UPGRADE' }), b.evidence)
  assert.strictEqual(v.ok, false)
  assert.ok(v.violations.indexOf('MUTATED_SWITCH_CLASS') >= 0)
})
t('§10 provider-injected psychology is REJECTED (deterministic fallback kept)', () => {
  const b = build(OWNER)
  const out = P.polishCaseReport(b.caseReport, b.evidence, { card01: '你内心焦虑，缺乏安全感', card02: b.caseReport.card02 })
  assert.strictEqual(out.applied, false)
  assert.ok(out.violations.indexOf('INTRODUCED_PSYCHOLOGY') >= 0)
  assert.strictEqual(out.caseReport.card01, b.caseReport.card01, 'deterministic text preserved')
})
t('§10 a clean polish (same anchors) is accepted', () => {
  const b = build(OWNER)
  const out = P.polishCaseReport(b.caseReport, b.evidence, { card01: b.caseReport.card01 })
  assert.strictEqual(out.applied, true)
  assert.strictEqual(out.providerCalls, 1)
})
t('§10 MAX_PROVIDER_CALLS_PER_REPORT = 1', () => {
  assert.strictEqual(P.MAX_PROVIDER_CALLS_PER_REPORT, 1)
})

// ── §15 ANTI-GENERIC ABLATION ───────────────────────────────────────────────
t('§15 removing major reality evidence breaks the thesis (HIGH dependency)', () => {
  const g = S.ownerGates({ _raw: OWNER })
  assert.strictEqual(g.antiGeneric.REALITY_SPECIFICITY_DEPENDENCY, 'HIGH')
  assert.notStrictEqual(g.antiGeneric.ablationContradiction, 'CAPABILITY_UNEXPOSED')
})

// ── §13 OWNER GATES ─────────────────────────────────────────────────────────
t('§13 owner gates A–E all YES', () => {
  const g = S.ownerGates({ _raw: OWNER })
  assert.strictEqual(g.GATE_A_CARD01_TWO_REAL_FACTS, 'YES')
  assert.strictEqual(g.GATE_B_DERIVES_UNCLICKED_D, 'YES')
  assert.strictEqual(g.GATE_C_ABLATION_WEAKENS, 'YES')
  assert.strictEqual(g.GATE_E_ABOUT_THIS_REALITY, 'YES')
  assert.ok(g.CARD01_REALITY_FACT_COUNT >= 2)
})

// ── §14 DISTINCTNESS ────────────────────────────────────────────────────────
t('§14 same world model / different reality → DISTINCT reports (≥5)', () => {
  const cog = COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_PERSON', 'RULE_EFFORT', 'EVID_PRAISE')
  const realities = [
    RAW(cog),
    Object.assign(RAW(cog), { occupationDetail: '厨师', occupationCategory: 'OCC_SERVICE', incomeStructure: 'INC_SKILL_SERVICE', pricingAuthority: 'PRICE_CLIENT', monetizableSkill: 'ASSET_CRAFT', skillValidation: 'PROOF_OCCASIONAL', weeklyTime: 'TIME_2_5', safetyMonths: 'SAFETY_UNDER_1', monthlySurplus: 'SURPLUS_UNDER_1K', pastAttemptStage: 'ATTEMPT_FEW_SALES', primaryProblem: 'PROBLEM_DEBT', debtPressure: 'DEBT_CONSUMER' }),
    Object.assign(RAW(cog), { occupationDetail: '平面设计', occupationCategory: 'OCC_TECH', monetizableSkill: 'ASSET_TECH', skillValidation: 'PROOF_STABLE', weeklyTime: 'TIME_10_20', safetyMonths: 'SAFETY_6_12', monthlySurplus: 'SURPLUS_5K_10K', pastAttemptStage: 'ATTEMPT_STABLE_SIDE', primaryProblem: 'PROBLEM_SIDE_UNSTARTED' }),
    Object.assign(RAW(cog), { occupationDetail: '奶茶店', occupationCategory: 'OCC_SELF_EMPLOYED', incomeStructure: 'INC_BUSINESS', pricingAuthority: 'PRICE_SELF', skillValidation: 'PROOF_STABLE', weeklyTime: 'TIME_20_PLUS', safetyMonths: 'SAFETY_3_6', pastAttemptStage: 'ATTEMPT_STABLE_SIDE', primaryProblem: 'PROBLEM_FOCUS' }),
    Object.assign(RAW(cog), { occupationDetail: '自媒体运营', occupationCategory: 'OCC_PLATFORM_LABOR', incomeStructure: 'INC_UNSTABLE', pricingAuthority: 'PRICE_PLATFORM', skillValidation: 'PROOF_FREE_HELPED', weeklyTime: 'TIME_UNDER_2', safetyMonths: 'SAFETY_UNDER_1', monthlySurplus: 'SURPLUS_NEGATIVE', pastAttemptStage: 'ATTEMPT_UNDER_30D', primaryProblem: 'PROBLEM_INCOME_STUCK' })
  ]
  const sigs = realities.map((r) => sig(build(r).caseReport))
  assert.ok(new Set(sigs).size >= 5, 'DISTINCT=' + new Set(sigs).size)
})
t('§14 same reality / different world model → DISTINCT reports (≥5)', () => {
  const models = [
    COG('LABOR_MORE_WORK', 'DECISION_WAIT_OTHERS', 'SYS_PERSON', 'RULE_EFFORT', 'EVID_PRAISE'),
    COG('LABOR_REUSABLE', 'DECISION_LEARN_FIRST', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_REPEATABLE'),
    COG('LABOR_LEVERAGE', 'DECISION_SMALL_TEST', 'SYS_PER_EVENT', 'RULE_DEMAND', 'EVID_LUCK'),
    COG('LABOR_PRICING', 'DECISION_ALL_IN', 'SYS_NONE', 'RULE_NONE', 'EVID_UNREFLECTIVE'),
    COG('LABOR_MORE_WORK', 'DECISION_AVOID', 'SYS_STRUCTURE', 'RULE_AWARE', 'EVID_PRAISE')
  ].map((c) => Object.assign({}, OWNER, c))
  const sigs = models.map((r) => sig(build(r).caseReport))
  assert.ok(new Set(sigs).size >= 5, 'DISTINCT=' + new Set(sigs).size)
})

// ── §16 LOWER LAYERS FROZEN (no touched semantics) ──────────────────────────
t('§16 reasoning core is CORE-ONLY: caseReportScreen never mutates the caseThesis', () => {
  const b = build(OWNER)
  const before = JSON.stringify(b.caseThesis)
  S.screenCaseReportV1({ card01: 'x', card02: 'x', card03: { steps: [] }, card04: {}, card05: {} }, { _raw: OWNER }, null)
  const after = JSON.stringify(build(OWNER).caseThesis)
  assert.strictEqual(before, after)
})

console.log('\n══════════════════════════════════════')
console.log('R87B2 FIVE-CARD INTEGRATION: ' + pass + ' passed, ' + fail + ' failed')
console.log('══════════════════════════════════════')
if (fails.length) { fails.forEach((f) => console.log('  FAIL ' + f)); process.exit(1) }
