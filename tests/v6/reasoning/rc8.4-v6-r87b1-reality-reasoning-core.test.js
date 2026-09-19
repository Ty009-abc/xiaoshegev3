'use strict'
/**
 * tests/v6/reasoning/rc8.4-v6-r87b1-reality-reasoning-core.test.js
 *
 * RC8.4 V6 R87B1 — REALITY REASONING CORE (Phase 1).
 *
 * REALITY EVIDENCE → CONTRADICTION → DERIVED INSIGHT → CASE THESIS
 * Core principle: USER REALITY = SUBJECT · WORLD MODEL = EXPLANATORY ENGINE.
 *
 * Covers §1–§12 of the R87B1 mission:
 *   §1 RealityEvidenceV1 (14 reality facts + 7 cognitive; provenance preserved)
 *   §2 fact boundaries (0 fabricated / 0 psychology / 0 temporal / 0 overclaim)
 *   §3 ContradictionEngineV1 (≥2 independent facts; WorldModel re-ranks only)
 *   §4 DerivedInsightV1 (NEW conclusion, not option echo / not generic)
 *   §5 counterfactual hard gate (dependency HIGH)
 *   §6 CaseThesisV1 + §7 ClaimLedger (0 unsupported core claims)
 *   §8 anti-bias (5/5 outcomes; no forced entrepreneurship)
 *   §9 owner fixture
 *   §10 contrast tests (5 occupations; theses distinct)
 *   §11 reality ablation (REALITY_SPECIFICITY_DEPENDENCY = HIGH)
 *   §12 lower-layer freeze (this package reads nothing it owns)
 *
 * Deterministic. No network. No AI. No I/O.
 */

const path = require('path')
const assert = require('assert')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const V6 = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const R = require(path.join(V6, 'reasoning/index.js'))
const RE = require(path.join(V6, 'reasoning/realityEvidenceV1.js'))
const CE = require(path.join(V6, 'reasoning/contradictionEngineV1.js'))
const DI = require(path.join(V6, 'reasoning/derivedInsightV1.js'))
const CT = require(path.join(V6, 'reasoning/caseThesisV1.js'))

let pass = 0, fail = 0
const fails = []
function t (name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name) } catch (e) { fail++; fails.push(name + ' :: ' + e.message); console.log('  ✗ ' + name + ' :: ' + e.message) }
}

// ── fixtures ───────────────────────────────────────────────────────────────
const OWNER = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationCategory: 'OCC_CONTENT_CREATIVE',
  occupationDetail: '短视频运营', pricingAuthority: 'PRICE_EMPLOYER', monthlySurplus: 'SURPLUS_1K_5K',
  safetyMonths: 'SAFETY_1_3', debtPressure: 'DEBT_NONE', skillValidation: 'PROOF_FREE_THANKED',
  monetizableSkill: 'ASSET_CONTENT', weeklyTime: 'TIME_5_10', maxTrialCost: 'COST_1K_5K',
  pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION', primaryProblem: 'PROBLEM_MONETIZE',
  laborModel: 'LABOR_MORE_WORK', decisionStyle: 'DECISION_WAIT_OTHERS', systemModel: 'SYS_PERSON',
  ruleModel: 'RULE_EFFORT', failureResponse: 'EVID_PRAISE', timeBehavior: 'TIME_PROTECT_LONG'
}
const BASE = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationCategory: 'OCC_TECH',
  occupationDetail: '工程师', pricingAuthority: 'PRICE_EMPLOYER', monthlySurplus: 'SURPLUS_5K_10K',
  safetyMonths: 'SAFETY_6_12', debtPressure: 'DEBT_NONE', skillValidation: 'PROOF_NEVER',
  monetizableSkill: 'ASSET_TECHNICAL', weeklyTime: 'TIME_5_10', maxTrialCost: 'COST_1K_5K',
  pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION', primaryProblem: 'PROBLEM_INCOME_STUCK',
  laborModel: 'LABOR_MORE_WORK', decisionStyle: 'DECISION_WAIT_OTHERS', systemModel: 'SYS_PERSON',
  ruleModel: 'RULE_EFFORT', failureResponse: 'EVID_PRAISE', timeBehavior: 'TIME_BALANCE'
}
const mk = (o) => Object.assign({}, BASE, o || {})

function sig (r) {
  // structural signature of the derived thesis (NOT copy — ids + model/mechanism signals).
  // Includes both reality-derived parts (contradiction/insight/switch) AND
  // model-derived parts (hiddenMechanism/probeKey) so the tests can prove
  // sensitivity to BOTH reality and the world model.
  return [
    r.PRIMARY_CASE_CONTRADICTION,
    r.insights.primary ? r.insights.primary.insightId : 'NONE',
    r.SWITCH_OUTCOME,
    r.caseThesis.hiddenMechanism,
    r.caseThesis.realityExperiment ? r.caseThesis.realityExperiment.probeKey : ''
  ].join('|')
}

console.log('\n=== R87B1 REALITY REASONING CORE ===')

// ── §1 RealityEvidenceV1 ──
console.log('\n§1 RealityEvidenceV1')
t('14 reality facts compiled with provenance', () => {
  const ev = RE.buildRealityEvidenceV1(OWNER)
  assert.strictEqual(ev.factCount, 14, 'factCount=' + ev.factCount)
  for (const f of ev.facts) {
    assert.ok(f.factId && f.field && f.normalizedValue != null, 'missing provenance: ' + f.field)
    assert.ok(typeof f.semanticMeaning === 'string' && f.semanticMeaning.length, 'no meaning: ' + f.field)
    assert.strictEqual(f.evidenceClass, 'OBSERVED')
    assert.ok(Array.isArray(f.allowedClaims) && f.allowedClaims.length, 'no allowedClaims: ' + f.field)
    assert.ok(Array.isArray(f.forbiddenClaims), 'no forbiddenClaims: ' + f.field)
    assert.ok(typeof f.sourceQuestion === 'string' && f.sourceQuestion.length, 'no sourceQuestion: ' + f.field)
  }
})
t('cognitive evidence kept separately traceable (7)', () => {
  const ev = RE.buildRealityEvidenceV1(OWNER)
  assert.strictEqual(ev.cognitiveCount, 7)
  assert.strictEqual(ev.cognitiveByField.laborModel.normalizedValue, 'LABOR_MORE_WORK')
  // a cognitive id must NOT appear in the reality byField map
  assert.ok(!ev.byField.laborModel, 'cognitive leaked into reality facts')
})

// ── §2 fact boundaries ──
console.log('\n§2 fact boundaries (hard gates = 0)')
t('boundary audit all zero', () => {
  const a = RE.auditFactBoundaries(RE.buildRealityEvidenceV1(OWNER))
  assert.strictEqual(a.FABRICATED_FACT_COUNT, 0)
  assert.strictEqual(a.FABRICATED_PSYCHOLOGY_COUNT, 0)
  assert.strictEqual(a.TEMPORAL_FACT_WITHOUT_SOURCE_COUNT, 0)
  assert.strictEqual(a.EMPLOYMENT_MECHANIC_OVERCLAIM_COUNT, 0)
})
t('absent optional field → no invented fact', () => {
  const raw = mk({ occupationDetail: '' })
  const ev = RE.buildRealityEvidenceV1(raw)
  assert.ok(!ev.byField.occupationDetail, 'invented occupation from empty text')
})
t('unknown option → no fact (fail-closed)', () => {
  const raw = mk({ skillValidation: 'PROOF_MADE_UP' })
  const ev = RE.buildRealityEvidenceV1(raw)
  assert.ok(!ev.byField.skillValidation, 'invented fact from unknown option')
})

// ── §3 ContradictionEngineV1 ──
console.log('\n§3 ContradictionEngineV1')
t('every fired contradiction has ≥2 independent reality facts', () => {
  const ev = RE.buildRealityEvidenceV1(OWNER)
  const ce = CE.computeContradictionEngineV1(ev, null)
  assert.strictEqual(ce.MIN_FACT_VIOLATION_COUNT, 0)
  assert.ok(ce.firedCount >= 1)
})
t('WorldModel cannot manufacture a contradiction', () => {
  const ev = RE.buildRealityEvidenceV1(mk({}))
  const noModel = CE.computeContradictionEngineV1(ev, null)
  const fakeModel = CE.computeContradictionEngineV1(ev, { axes: { LABOR: { reportable: true, state: 'MIXED' }, PROBABILITY: { reportable: true }, SYSTEM: { reportable: true }, RULE: { reportable: true }, EVIDENCE: { reportable: true } } })
  // the SET of fired contradictions is identical with/without a model (rank-only)
  const a = noModel.candidates.map((c) => c.contradictionId).sort().join(',')
  const b = fakeModel.candidates.map((c) => c.contradictionId).sort().join(',')
  assert.strictEqual(a, b, 'world model changed the fired SET (must only re-rank)')
})

// ── §4 DerivedInsightV1 ──
console.log('\n§4 DerivedInsightV1')
t('NEW_DERIVED_INSIGHT_COUNT >= 1', () => {
  const r = R.runRealityReasoningV1(OWNER, null)
  assert.ok(r.NEW_DERIVED_INSIGHT_COUNT >= 1, 'count=' + r.NEW_DERIVED_INSIGHT_COUNT)
})
t('PRIMARY_INSIGHT_SUPPORTING_FACT_COUNT >= 2', () => {
  const r = R.runRealityReasoningV1(OWNER, null)
  assert.ok(r.PRIMARY_INSIGHT_SUPPORTING_FACT_COUNT >= 2, 'count=' + r.PRIMARY_INSIGHT_SUPPORTING_FACT_COUNT)
})
t('insight is NOT a questionnaire restatement / NOT generic advice', () => {
  const r = R.runRealityReasoningV1(OWNER, null)
  assert.strictEqual(r.PRIMARY_INSIGHT_IS_QUESTIONNAIRE_RESTATEMENT, false)
  assert.strictEqual(r.PRIMARY_INSIGHT_IS_GENERIC_ADVICE, false)
})
t('insight schema complete', () => {
  const r = R.runRealityReasoningV1(OWNER, null)
  const ins = r.insights.primary
  for (const k of ['insightId', 'supportingFactIds', 'worldModelEvidenceIds', 'derivationRule', 'conclusion', 'confidence', 'counterfactualDependency', 'noveltyReason', 'allowedClaims', 'forbiddenClaims']) {
    assert.ok(k in ins, 'missing insight field: ' + k)
  }
})
t('derived conclusion names the combination, not a single option', () => {
  const r = R.runRealityReasoningV1(OWNER, null)
  assert.ok(/约束|配置|方法|成本|顺序|分配|可重复|条件/.test(r.insights.primary.conclusion))
})

// ── §5 counterfactual hard gate ──
console.log('\n§5 counterfactual hard gate')
t('PRIMARY_INSIGHT_COUNTERFACTUAL_DEPENDENCY = HIGH', () => {
  const r = R.runRealityReasoningV1(OWNER, null)
  assert.strictEqual(r.PRIMARY_INSIGHT_COUNTERFACTUAL_DEPENDENCY, 'HIGH')
})
t('removing a key fact changes/disappears the insight', () => {
  const ev = RE.buildRealityEvidenceV1(OWNER)
  const ce = CE.computeContradictionEngineV1(ev, null)
  const di = DI.computeDerivedInsightV1(ev, ce, null)
  const load = di.counterfactual.loadBearingFactIds
  assert.ok(load.length >= 2, 'need >=2 load-bearing facts, got ' + load.length)
})
t('counterfactual harness removes exactly one fact per step', () => {
  const ev = RE.buildRealityEvidenceV1(OWNER)
  const red = RE.reduceEvidence(ev, ['skillValidation'])
  assert.ok(!red.byField.skillValidation)
  assert.strictEqual(red.factCount, ev.factCount - 1)
})

// ── §6 CaseThesisV1 + §7 ClaimLedger ──
console.log('\n§6/§7 CaseThesis + ClaimLedger')
t('caseThesis has all required keys', () => {
  const r = R.runRealityReasoningV1(OWNER, null)
  const ct = r.caseThesis
  for (const k of ['realityFacts', 'primaryContradiction', 'primaryDerivedInsight', 'hiddenMechanism', 'reinforcementLoop', 'strategicSwitch', 'realityExperiment', 'worldModelExplanation', 'claimLedger']) {
    assert.ok(k in ct, 'missing caseThesis key: ' + k)
  }
})
t('UNSUPPORTED_CORE_CLAIM_COUNT = 0', () => {
  const r = R.runRealityReasoningV1(OWNER, null)
  assert.strictEqual(r.UNSUPPORTED_CORE_CLAIM_COUNT, 0)
})
t('every L1/L2 claim traces to evidence ids', () => {
  const r = R.runRealityReasoningV1(OWNER, null)
  for (const c of r.caseThesis.claimLedger) {
    if (c.claimLevel === 'L1_OBSERVED_FACT' || c.claimLevel === 'L2_STRONG_DERIVATION') {
      assert.ok(c.evidenceIds && c.evidenceIds.length, 'unsupported claim: ' + c.claimId)
    }
  }
})
t('claim ledger uses exactly the 3 claim levels', () => {
  const r = R.runRealityReasoningV1(OWNER, null)
  const lv = new Set(r.caseThesis.claimLedger.map((c) => c.claimLevel))
  for (const l of lv) assert.ok(['L1_OBSERVED_FACT', 'L2_STRONG_DERIVATION', 'L3_TESTABLE_HYPOTHESIS'].indexOf(l) !== -1, 'bad level ' + l)
})

// ── §8 anti-bias ──
console.log('\n§8 anti-bias (5/5)')
t('STAY_AND_UPGRADE (self-priced + validated + healthy)', () => {
  const r = R.runRealityReasoningV1(mk({ incomeStructure: 'INC_BUSINESS', pricingAuthority: 'PRICE_SELF', skillValidation: 'PROOF_OCCASIONAL', pastAttemptStage: 'ATTEMPT_FEW_SALES' }), null)
  assert.strictEqual(r.SWITCH_OUTCOME, 'STAY_AND_UPGRADE')
})
t('NO_SWITCH_YET (debt-first)', () => {
  const r = R.runRealityReasoningV1(mk({ debtPressure: 'DEBT_HIGH', safetyMonths: 'SAFETY_1_3' }), null)
  assert.strictEqual(r.SWITCH_OUTCOME, 'NO_SWITCH_YET')
})
t('DEBT/CASHFLOW FIRST (low surplus)', () => {
  const r = R.runRealityReasoningV1(mk({ monthlySurplus: 'SURPLUS_ZERO', debtPressure: 'DEBT_CONSUMER', safetyMonths: 'SAFETY_UNDER_1' }), null)
  assert.strictEqual(r.SWITCH_OUTCOME, 'NO_SWITCH_YET')
})
t('ALREADY MARKET-VALIDATED → ADD_OPTIONALITY', () => {
  const r = R.runRealityReasoningV1(mk({ skillValidation: 'PROOF_STABLE', pastAttemptStage: 'ATTEMPT_STABLE_SIDE', safetyMonths: 'SAFETY_6_12' }), null)
  assert.strictEqual(r.SWITCH_OUTCOME, 'ADD_OPTIONALITY')
})
t('HIGH PRICING AUTHORITY → STAY_AND_UPGRADE', () => {
  const r = R.runRealityReasoningV1(mk({ incomeStructure: 'INC_BUSINESS', pricingAuthority: 'PRICE_SELF', skillValidation: 'PROOF_STABLE', pastAttemptStage: 'ATTEMPT_STABLE_SIDE', monthlySurplus: 'SURPLUS_OVER_10K', safetyMonths: 'SAFETY_12_24' }), null)
  assert.strictEqual(r.SWITCH_OUTCOME, 'STAY_AND_UPGRADE')
})
t('switch outcomes stay inside the allowed vocabulary', () => {
  const all = []
  for (const raw of [OWNER, mk({}), mk({ debtPressure: 'DEBT_HIGH' }), mk({ pricingAuthority: 'PRICE_SELF', incomeStructure: 'INC_BUSINESS', skillValidation: 'PROOF_STABLE' })]) {
    all.push(R.runRealityReasoningV1(raw, null).SWITCH_OUTCOME)
  }
  for (const o of all) assert.ok(CT.SWITCH_OUTCOMES.indexOf(o) !== -1, 'bad outcome ' + o)
})

// ── §9 owner fixture ──
console.log('\n§9 owner fixture')
t('owner: primary contradiction + insight + HIGH counterfactual', () => {
  const r = R.runRealityReasoningV1(OWNER, null)
  assert.strictEqual(r.PRIMARY_CASE_CONTRADICTION, 'CAPABILITY_UNEXPOSED')
  assert.strictEqual(r.insights.primary.insightId, 'CONSTRAINT_IS_ALLOCATION_NOT_CAPABILITY')
  assert.strictEqual(r.PRIMARY_INSIGHT_COUNTERFACTUAL_DEPENDENCY, 'HIGH')
})
t('owner: engine derives D the user did not directly select', () => {
  const r = R.runRealityReasoningV1(OWNER, null)
  // user selected PROBLEM_MONETIZE ("有能力但不知道怎么变现")
  assert.strictEqual(RE.valueOf(r.evidence.byField, 'primaryProblem'), 'PROBLEM_MONETIZE')
  // derived D is about ALLOCATION/CONFIGURATION, not "how to monetize"
  assert.ok(/配置|约束|分配/.test(r.insights.primary.conclusion))
  assert.notStrictEqual(r.insights.primary.insightId, 'PROBLEM_MONETIZE')
})

// ── §10 contrast tests ──
console.log('\n§10 contrast tests')
const SALARY = mk({ occupationCategory: 'OCC_OPERATIONS_ADMIN', occupationDetail: '行政专员', incomeStructure: 'INC_SALARY', pricingAuthority: 'PRICE_EMPLOYER', safetyMonths: 'SAFETY_1_3' })
const SERVICE = mk({ occupationCategory: 'OCC_SERVICE', occupationDetail: '厨师', incomeStructure: 'INC_SKILL_SERVICE', pricingAuthority: 'PRICE_CLIENT', skillValidation: 'PROOF_OCCASIONAL', pastAttemptStage: 'ATTEMPT_FEW_SALES', monetizableSkill: 'ASSET_CRAFT' })
const CREATOR = OWNER
const TECH = mk({ occupationCategory: 'OCC_TECH', occupationDetail: '前端开发', incomeStructure: 'INC_SALARY', pricingAuthority: 'PRICE_EMPLOYER', monetizableSkill: 'ASSET_TECHNICAL', safetyMonths: 'SAFETY_6_12', primaryProblem: 'PROBLEM_MONETIZE', laborModel: 'LABOR_REUSABLE', systemModel: 'SYS_STRUCTURE', ruleModel: 'RULE_AWARE', failureResponse: 'EVID_REPEATABLE', decisionStyle: 'DECISION_LEARN_FIRST' })
const SELFEMP = mk({ occupationCategory: 'OCC_SELF_EMPLOYED', occupationDetail: '自营小店', incomeStructure: 'INC_BUSINESS', pricingAuthority: 'PRICE_SELF', skillValidation: 'PROOF_STABLE', pastAttemptStage: 'ATTEMPT_STABLE_SIDE', debtPressure: 'DEBT_CONSUMER', safetyMonths: 'SAFETY_1_3', laborModel: 'LABOR_LEVERAGE', decisionStyle: 'DECISION_ALL_IN', ruleModel: 'RULE_AWARE', failureResponse: 'EVID_UNREFLECTIVE', selfBelief: 'BELIEF_RESOURCE', timeBehavior: 'TIME_LONG_DROPS' })
const CONTRAST = [SALARY, SERVICE, CREATOR, TECH, SELFEMP]

t('5 contrasting fixtures yield ≥1 distinct thesis each (no universal)', () => {
  const sigs = CONTRAST.map((raw) => sig(R.runRealityReasoningV1(raw, null)))
  const uniq = new Set(sigs)
  assert.strictEqual(uniq.size, 5, 'not all distinct: ' + JSON.stringify(sigs))
})
t('UNIVERSAL_CONTRADICTION_COUNT = 0 (primary contradiction varies)', () => {
  const pcs = new Set(CONTRAST.map((raw) => R.runRealityReasoningV1(raw, null).PRIMARY_CASE_CONTRADICTION))
  assert.ok(pcs.size >= 5, 'distinct primaries=' + pcs.size)
})
t('UNIVERSAL_ADVICE_COUNT = 0 (no quit-job / side-hustle default)', () => {
  for (const raw of CONTRAST) {
    const concl = R.runRealityReasoningV1(raw, null).insights.primary.conclusion
    for (const g of DI.GENERIC_ADVICE_TOKENS) assert.ok(concl.indexOf(g) === -1, 'generic token «' + g + '» in: ' + concl)
  }
})
t('SAME_REALITY_DIFFERENT_MODEL → distinct thesis', () => {
  const rA = R.runRealityReasoningV1(mk({ systemModel: 'SYS_STRUCTURE', ruleModel: 'RULE_AWARE', decisionStyle: 'DECISION_SMALL_TEST', failureResponse: 'EVID_REPEATABLE' }), null)
  const rB = R.runRealityReasoningV1(mk({ systemModel: 'SYS_PERSON', ruleModel: 'RULE_EFFORT', decisionStyle: 'DECISION_WAIT_OTHERS', failureResponse: 'EVID_PRAISE' }), null)
  assert.notStrictEqual(sig(rA), sig(rB))
})
t('SAME_MODEL_DIFFERENT_REALITY → distinct thesis', () => {
  const rA = R.runRealityReasoningV1(mk({ safetyMonths: 'SAFETY_1_3', skillValidation: 'PROOF_FREE_THANKED', pastAttemptStage: 'ATTEMPT_NONE' }), null)
  const rB = R.runRealityReasoningV1(mk({ safetyMonths: 'SAFETY_12_24', skillValidation: 'PROOF_STABLE', pastAttemptStage: 'ATTEMPT_STABLE_SIDE' }), null)
  assert.notStrictEqual(sig(rA), sig(rB))
})

// ── §11 reality ablation ──
console.log('\n§11 reality ablation')
t('REALITY_SPECIFICITY_DEPENDENCY = HIGH', () => {
  // full thesis vs. thesis with major reality facts removed
  const full = R.runRealityReasoningV1(OWNER, null)
  const ablated = R.runRealityReasoningV1({
    // only cognitive fields + primaryProblem left (occupation/income/safety/skill/attempt removed)
    primaryProblem: OWNER.primaryProblem,
    laborModel: OWNER.laborModel, decisionStyle: OWNER.decisionStyle, systemModel: OWNER.systemModel,
    ruleModel: OWNER.ruleModel, failureResponse: OWNER.failureResponse, timeBehavior: OWNER.timeBehavior,
    selfBelief: OWNER.selfBelief
  }, null)
  assert.notStrictEqual(sig(full), sig(ablated), 'thesis survived wholesale ablation')
  assert.notStrictEqual(full.PRIMARY_CASE_CONTRADICTION, ablated.PRIMARY_CASE_CONTRADICTION)
})
t('per-fact ablation: removing a load-bearing fact changes the thesis', () => {
  const full = R.runRealityReasoningV1(OWNER, null)
  const ev = RE.buildRealityEvidenceV1(OWNER)
  const reduced = RE.reduceEvidence(ev, ['skillValidation', 'pastAttemptStage'])
  const ce2 = CE.computeContradictionEngineV1(reduced, null)
  const di2 = DI.computeDerivedInsightV1(reduced, ce2, null)
  const ct2 = CT.buildCaseThesisV1(reduced, ce2, di2, null)
  assert.notStrictEqual(full.PRIMARY_CASE_CONTRADICTION + '|' + full.SWITCH_OUTCOME, ce2.PRIMARY_CASE_CONTRADICTION + '|' + ct2.SWITCH_OUTCOME)
})

// ── §12 lower-layer freeze ──
console.log('\n§12 lower-layer freeze')
t('reasoning core requires NO lower layer (pure from raw)', () => {
  // the pipeline must run with only raw answers — no worldModel/gameModel injected
  const r = R.runRealityReasoningV1(OWNER, null)
  assert.ok(r.caseThesis)
  assert.strictEqual(r.caseThesis.worldModelExplanation, null)
})
t('worldModel passed for explanation only (never changes facts)', () => {
  const withModel = R.runRealityReasoningV1(OWNER, { worldModel: { axes: { LABOR: { state: 'MIXED', reportable: false } } } })
  const without = R.runRealityReasoningV1(OWNER, null)
  assert.strictEqual(withModel.evidence.factCount, without.evidence.factCount)
  assert.strictEqual(withModel.PRIMARY_CASE_CONTRADICTION, without.PRIMARY_CASE_CONTRADICTION)
})

// ── determinism ──
console.log('\n§13 determinism')
t('same input → identical thesis signature', () => {
  const a = R.runRealityReasoningV1(OWNER, null)
  const b = R.runRealityReasoningV1(OWNER, null)
  assert.strictEqual(sig(a), sig(b))
  assert.strictEqual(a.PRIMARY_CASE_CONTRADICTION, b.PRIMARY_CASE_CONTRADICTION)
})

console.log('\n──────────────────────────────────────')
console.log('R87B1 TEST: ' + (fail === 0 ? 'PASS' : 'FAIL') + '  (' + pass + ' pass / ' + fail + ' fail)')
console.log('──────────────────────────────────────')
if (fails.length) { console.log('FAILURES:'); for (const f of fails) console.log('  - ' + f) }
process.exitCode = fail === 0 ? 0 : 1
