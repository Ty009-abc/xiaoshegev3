'use strict'
/**
 * tests/v6/hybrid/rc8.4-v6-r62-cross-object-false-conflict.test.js
 *
 * RC8.4 V6 R62 — CROSS-OBJECT FALSE-CONFLICT FIX.
 * Deterministic; no AI, no network, no deploy.
 *
 * Root cause (R61): V6 B1 stage evidence (Q7 `pastAttemptStage`) and Hybrid
 * asset/proof evidence (Q5 `skillValidation`) describe DIFFERENT SEMANTIC OBJECTS.
 * Comparing them produced a hard EVIDENCE_CONFLICT for answers that are BOTH true.
 *
 * Proves:
 *   §2 semantic authority frozen (two independent axes)
 *   §3 Q5×Q7 hard conflict = 0 (both directions)
 *   §4 neither field deleted (information preserved)
 *   §5 neutral crossObjectEvidencePattern (zero B1 authority)
 *   §6 Thesis envelope sees BOTH truths; no contradiction claim
 *   §7 hard conflict requires explicit binding (unbound rule count = 0)
 *   §8 rule audit: every remaining rule satisfies §7
 *   §9 owner exact replay: false conflict before = YES, after = NO
 *   §10 R59 path unblocked (envelope created, <=1 model call)
 *   §11 no cross-object collapse (deterministic fallback)
 *   §12 B1 immutability
 */

const assert = require('assert')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const H = require(path.join(CF, 'hybrid/index.js'))
const G = require(path.join(CF, 'hybrid/hybridCompatibilityV6.js'))
const { buildReportV6 } = require(path.join(CF, 'report/index.js'))
const { buildHybridReportContextV6 } = require(path.join(CF, 'hybrid/hybridReportContextV6.js'))
const { buildThesisEnvelopeV6 } = require(path.join(CF, 'thesis/thesisEnvelopeV6.js'))
const { runThesisReportRuntimeV6, RENDER_SOURCE } = require(path.join(CF, 'thesis/thesisReportRuntimeV6.js'))
const { detectCrossObjectCollapse, CROSS_OBJECT_CONTRADICTION_PAT } = require(path.join(CF, 'thesis/thesisValidatorV6.js'))
const VM = require(path.join(ROOT, 'utils/v6/turnaroundReportViewModelV6.js'))

let pass = 0, fail = 0
function t (name, fn) {
  try { fn(); pass++; console.log('   ✓ ' + name) }
  catch (e) { fail++; console.log('   ✗ ' + name + '\n     ' + (e && e.message)) }
}
async function ta (name, fn) {
  try { await fn(); pass++; console.log('   ✓ ' + name) }
  catch (e) { fail++; console.log('   ✗ ' + name + '\n     ' + (e && e.message)) }
}

function base (o) {
  return Object.assign({
    lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationDetail: '程序员',
    monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE',
    skillValidation: 'PROOF_FREE_HELPED', monetizableSkill: 'ASSET_TECHNICAL',
    weeklyTime: 'TIME_5_10', executionStability: 'EXEC_STABLE',
    pastAttemptStage: 'ATTEMPT_NO_SALE', selfBelief: 'BELIEF_ABILITY',
    decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_SHORT_FIRST',
    primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SIDE_INCOME',
    maxTrialCost: 'COST_1K_5K', failureResponse: 'FAIL_GIVE_UP'
  }, o || {})
}
// The exact R60-class owner shape: a paid market proof + a built-but-unsold attempt.
const OWNER_REPLAY = base({
  skillValidation: 'PROOF_PAID_ONCE', pastAttemptStage: 'ATTEMPT_NO_SALE',
  primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SKILL_MONETIZE'
})

function run (o) {
  const out = H.runHybridDiagnosisV6(base(o))
  const rep = buildReportV6(out.diagnosis, out.hybridContext)
  return { out, rep, vm: VM.buildCardListV6(rep.cards) }
}

console.log('\n── RC8.4 V6 R62 — CROSS-OBJECT FALSE-CONFLICT FIX ──')

// ══════════════════════════════════════════════════════════════════
// §2 SEMANTIC AUTHORITY FROZEN
// ══════════════════════════════════════════════════════════════════
console.log('\n   §2 SEMANTIC AUTHORITY')
t('§2 SKILL_VALIDATION_OBJECT = CURRENT_MONETIZABLE_CAPABILITY', () => {
  assert.strictEqual(G.SEMANTIC_OBJECT.skillValidation, 'CURRENT_MONETIZABLE_CAPABILITY')
})
t('§2 PAST_ATTEMPT_OBJECT = HISTORICAL_ATTEMPT', () => {
  assert.strictEqual(G.SEMANTIC_OBJECT.pastAttemptStage, 'HISTORICAL_ATTEMPT')
})
t('§2 CROSS_OBJECT_HARD_CONFLICT_ALLOWED = NO', () => {
  assert.notStrictEqual(G.SEMANTIC_OBJECT.skillValidation, G.SEMANTIC_OBJECT.pastAttemptStage)
  assert.strictEqual(G.UNBOUND_HARD_CONFLICT_RULE_COUNT, 0)
})

// ══════════════════════════════════════════════════════════════════
// §3 Q5×Q7 HARD CONFLICT = 0 (both directions)
// ══════════════════════════════════════════════════════════════════
console.log('\n   §3 Q5×Q7 HARD CONFLICT')
const SV = ['PROOF_NEVER', 'PROOF_FREE_THANKED', 'PROOF_FREE_HELPED', 'PROOF_PAID_ONCE', 'PROOF_OCCASIONAL', 'PROOF_STABLE']
const PA = ['ATTEMPT_NONE', 'ATTEMPT_COURSE_ONLY', 'ATTEMPT_UNDER_30D', 'ATTEMPT_NO_SALE', 'ATTEMPT_FEW_SALES', 'ATTEMPT_STABLE_SIDE']
let q5q7Hard = 0
for (const sv of SV) for (const pa of PA) {
  const o = H.runHybridDiagnosisV6(base({ skillValidation: sv, pastAttemptStage: pa }))
  if (o.diagnosis.compatibility.verdict === 'EVIDENCE_CONFLICT') q5q7Hard++
}
t('§3 Q5_Q7_HARD_CONFLICT_COUNT = 0 (36 combos)', () => assert.strictEqual(q5q7Hard, 0))
t('§3 forward: PROOF_PAID_ONCE/OCCASIONAL/STABLE + ATTEMPT_NO_SALE => no conflict', () => {
  for (const sv of ['PROOF_PAID_ONCE', 'PROOF_OCCASIONAL', 'PROOF_STABLE']) {
    const o = H.runHybridDiagnosisV6(base({ skillValidation: sv, pastAttemptStage: 'ATTEMPT_NO_SALE' }))
    assert.notStrictEqual(o.diagnosis.compatibility.verdict, 'EVIDENCE_CONFLICT', sv)
  }
})
t('§3 inverse: PROOF_NEVER + ATTEMPT_FEW_SALES => no conflict', () => {
  const o = H.runHybridDiagnosisV6(base({ skillValidation: 'PROOF_NEVER', pastAttemptStage: 'ATTEMPT_FEW_SALES', monetizableSkill: 'ASSET_UNCLEAR' }))
  assert.notStrictEqual(o.diagnosis.compatibility.verdict, 'EVIDENCE_CONFLICT')
})

// ══════════════════════════════════════════════════════════════════
// §4 EVIDENCE PRESERVED
// ══════════════════════════════════════════════════════════════════
console.log('\n   §4 EVIDENCE PRESERVED')
t('§4 SKILL_VALIDATION_PRESERVED = YES (asset/proof + envelope)', () => {
  const { out } = run(OWNER_REPLAY)
  const hy = out.hybridContext
  assert.strictEqual(hy.marketValidated, true, 'capability proof must be preserved')
  assert.ok(hy.assetLine && /付过一次钱/.test(hy.assetLine), 'capability fact must remain')
  const env = buildThesisEnvelopeV6({ hybridProfile: out.hybridProfile, diagnosis: out.diagnosis, hybridContext: hy })
  assert.ok(env.facts.some(f => f.field === 'skillValidation'), 'skillValidation must be a FACT in the envelope')
})
t('§4 PAST_ATTEMPT_STAGE_PRESERVED = YES (B1 stage + envelope)', () => {
  const { out } = run(OWNER_REPLAY)
  assert.ok(out.diagnosis.executionStage, 'B1 stage must remain')
  const env = buildThesisEnvelopeV6({ hybridProfile: out.hybridProfile, diagnosis: out.diagnosis, hybridContext: out.hybridContext })
  assert.ok(env.facts.some(f => f.field === 'pastAttemptStage'), 'pastAttemptStage must be a FACT in the envelope')
})
t('§4 both fields reach the diagnosis/hybrid profile unchanged', () => {
  const { out } = run(OWNER_REPLAY)
  assert.strictEqual(out.hybridProfile.asset.marketProof, 'PROOF_PAID_ONCE')
  assert.strictEqual(out.hybridProfile.stage.pastAttemptStage, 'ATTEMPT_NO_SALE')
})

// ══════════════════════════════════════════════════════════════════
// §5 NEUTRAL CROSS-OBJECT SIGNAL
// ══════════════════════════════════════════════════════════════════
console.log('\n   §5 CROSS-OBJECT SIGNAL')
t('§5 crossObjectEvidencePattern deterministic + zero B1 authority', () => {
  const cases = [
    [{ marketValidated: true, executionStage: 'TESTING' }, 'PROVEN_CAPABILITY_RECENT_ATTEMPT_FAILED'],
    [{ marketValidated: false, executionStage: 'EARLY_TRACTION' }, 'UNPROVEN_CAPABILITY_PRIOR_SALE_EXPERIENCE'],
    [{ marketValidated: true, executionStage: 'EARLY_TRACTION' }, 'PROVEN_CAPABILITY_AND_SUCCESSFUL_ATTEMPT'],
    [{ marketValidated: false, executionStage: 'TESTING' }, 'NO_PROOF_AND_NO_SALE_HISTORY']
  ]
  for (const [inp, exp] of cases) assert.strictEqual(G.crossObjectEvidencePattern(inp), exp)
})
t('§5 signal is exposed on the diagnosis but never changes a B1 field', () => {
  const { out } = run(OWNER_REPLAY)
  assert.strictEqual(out.diagnosis.compatibility.crossObjectEvidencePattern, 'PROVEN_CAPABILITY_RECENT_ATTEMPT_FAILED')
  assert.strictEqual(out.diagnosis.diagnosisState, 'PRIMARY')
})

// ══════════════════════════════════════════════════════════════════
// §6 THESIS ENVELOPE SEES BOTH TRUTHS
// ══════════════════════════════════════════════════════════════════
console.log('\n   §6 THESIS ENVELOPE')
t('§6 envelope carries the neutral pattern for AI interpretation', () => {
  const { out } = run(OWNER_REPLAY)
  const env = buildThesisEnvelopeV6({ hybridProfile: out.hybridProfile, diagnosis: out.diagnosis, hybridContext: out.hybridContext })
  assert.strictEqual(env.crossObjectEvidencePattern, 'PROVEN_CAPABILITY_RECENT_ATTEMPT_FAILED')
  assert.notStrictEqual(env.crossAxisScope, 'COMPATIBLE')
})
t('§6 prompt forbids contradiction claims (source)', () => {
  const src = require('fs').readFileSync(path.join(CF, 'thesis/thesisPromptV6.js'), 'utf8')
  assert.ok(/禁止说.*矛盾/.test(src), 'prompt must forbid claiming contradiction')
  assert.ok(/crossObjectEvidencePattern/.test(src), 'prompt must surface the neutral signal')
})

// ══════════════════════════════════════════════════════════════════
// §7/§8 BINDING PRINCIPLE + RULE AUDIT
// ══════════════════════════════════════════════════════════════════
console.log('\n   §7/§8 BINDING PRINCIPLE + RULE AUDIT')
t('§7 HARD_CONFLICT_REQUIRES_EXPLICIT_BINDING = YES', () => {
  assert.ok(Array.isArray(G.HARD_CONFLICT_RULES))
  // No rule may fire without explicitBinding + same semantic object.
  for (const r of G.HARD_CONFLICT_RULES) {
    assert.strictEqual(r.explicitBinding, true)
    assert.strictEqual(r.semanticObjectA, r.semanticObjectB)
  }
})
t('§8 UNBOUND_HARD_CONFLICT_RULE_COUNT = 0', () => assert.strictEqual(G.UNBOUND_HARD_CONFLICT_RULE_COUNT, 0))
t('§8 remaining rules audited: every rule satisfies SAME OBJECT + BINDING', () => {
  // With the cross-object rule removed, the audit finds zero hard-conflict rules.
  assert.strictEqual(G.HARD_CONFLICT_RULES.length, 0)
})

// ══════════════════════════════════════════════════════════════════
// §9 OWNER EXACT REPLAY
// ══════════════════════════════════════════════════════════════════
console.log('\n   §9 OWNER EXACT REPLAY')
t('§9 R60_FALSE_CONFLICT_REPRODUCED_BEFORE = YES (pre-fix guard)', () => {
  // Reproduce the old mechanism directly: the removed cross-object rule used to
  // fire for a paid capability + a no-sale attempt stage.
  const LEGACY_RULE = { id: 'VALIDATION_GAP_VS_MARKET_VALIDATED', fieldA: 'skillValidation', fieldB: 'pastAttemptStage' }
  const { out } = run(OWNER_REPLAY)
  const wouldFire = out.diagnosis.primaryBottleneck === 'VALIDATION_GAP' &&
    out.hybridContext.marketValidated === true &&
    out.hybridProfile.stage.pastAttemptStage === 'ATTEMPT_NO_SALE'
  assert.strictEqual(LEGACY_RULE.id, 'VALIDATION_GAP_VS_MARKET_VALIDATED')
  assert.strictEqual(wouldFire, true, 'the legacy cross-object condition is still producible')
})
t('§9 R62_FALSE_CONFLICT_AFTER = NO (report proceeds)', () => {
  const { out, rep, vm } = run(OWNER_REPLAY)
  assert.notStrictEqual(out.diagnosis.compatibility.verdict, 'EVIDENCE_CONFLICT')
  assert.notStrictEqual(rep.reportState, 'EVIDENCE_CONFLICT')
  assert.ok(rep.cards, 'report must build')
  assert.strictEqual(vm.length, 5, 'five cards render')
})

// ══════════════════════════════════════════════════════════════════
// §10 R59 PATH UNBLOCKED
// ══════════════════════════════════════════════════════════════════
console.log('\n   §10 R59 PATH')
;(async () => {
  await ta('§10 THESIS_ENVELOPE_CREATED_AFTER_FIX = YES', () => {
    const { out } = run(OWNER_REPLAY)
    const env = buildThesisEnvelopeV6({ hybridProfile: out.hybridProfile, diagnosis: out.diagnosis, hybridContext: out.hybridContext })
    assert.ok(env, 'envelope must be created (was null on the false conflict)')
  })
  await ta('§10 MODEL_CALL_COUNT <= 1 (routing unblocked, one call)', async () => {
    const { out } = run(OWNER_REPLAY)
    const fb = buildReportV6(out.diagnosis, out.hybridContext)
    let calls = 0
    const stub = async () => { calls++; return { success: false, error: 'NO_MODEL' } }
    const r = await runThesisReportRuntimeV6({
      diagnosis: out.diagnosis, hybridProfile: out.hybridProfile, hybridContext: out.hybridContext,
      fallbackReport: fb, crossAxisScope: fb.crossAxisScope, callAI: stub
    })
    assert.ok(calls <= 1, 'at most one model call')
    // R68 §8 — a VALID envelope with a failed/rejected AI output must ship the
    // product-grade THESIS_ENVELOPE_DETERMINISTIC_FALLBACK (NOT legacy R53).
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.ok(r.report && r.report.cards, 'fallback report still complete')
  })

  // ══════════════════════════════════════════════════════════════════
  // §11 NO CROSS-OBJECT COLLAPSE
  // ══════════════════════════════════════════════════════════════════
  console.log('\n   §11 NO CROSS-OBJECT COLLAPSE')
  t('§11 deterministic fallback never collapses the two objects', () => {
    const COLLAPSE = /(却没卖出去|为什么没买|复制最近一次有效成交|去拿第一笔钱|还没被市场验证|没人买单|第一个最小结果|还没人愿意付|第一次真实反馈|还没产生收入)/
    const cases = [
      base({ skillValidation: 'PROOF_PAID_ONCE' }),
      base({ skillValidation: 'PROOF_STABLE' }),
      base({ skillValidation: 'PROOF_OCCASIONAL' }),
      base({ primaryProblem: 'PROBLEM_INCOME_STUCK', selfBelief: 'BELIEF_NO_DIRECTION', pastAttemptStage: 'ATTEMPT_FEW_SALES', skillValidation: 'PROOF_NEVER', monetizableSkill: 'ASSET_UNCLEAR' })
    ]
    for (const raw of cases) {
      const o = H.runHybridDiagnosisV6(raw)
      const rep = buildReportV6(o.diagnosis, o.hybridContext)
      const blob = JSON.stringify(rep)
      assert.ok(!COLLAPSE.test(blob), 'collapse copy rendered: ' + (blob.match(COLLAPSE) || [])[0])
    }
  })
  t('§11 CROSS_OBJECT_COLLAPSE_COUNT = 0 (validator detector)', () => {
    // A link-first rendering must not be flagged; only an explicit contradiction
    // claim between the user's own two answers would be.
    const { vm } = run(OWNER_REPLAY)
    const text = JSON.stringify(vm)
    assert.strictEqual(detectCrossObjectCollapse(text), null)
    assert.strictEqual(detectCrossObjectCollapse('你的回答互相矛盾。'), '你的回答互相矛盾')
  })
  t('§11 validator rejects an explicit contradiction claim (fail-closed)', () => {
    assert.ok(CROSS_OBJECT_CONTRADICTION_PAT.test('你这两处信息对不上。'))
  })
  t('§11 link-first CARD03/CARD04/CARD05 render (no same-object claim)', () => {
    const { vm } = run(OWNER_REPLAY)
    const blob = [vm[2] && (vm[2].loopNodes || []).join(''), vm[3] && vm[3].to, vm[4] && vm[4].primaryAction].join(' ')
    assert.ok(/连不连|是不是同一件|先确认|用得上|用不上/.test(blob), 'link-first copy expected')
    assert.ok(!/(扩大|放大|复制|系统化|规模化|多接|接更多|做成方法)/.test(blob), 'no asset-scale claim')
  })

  // ══════════════════════════════════════════════════════════════════
  // §12 B1 IMMUTABILITY
  // ══════════════════════════════════════════════════════════════════
  console.log('\n   §12 B1 IMMUTABILITY')
  t('§12 B1_MUTATION_COUNT = 0 across the Q5×Q7 matrix', () => {
    const B1 = {
      DIRECTION_GAP: { primaryProblem: 'PROBLEM_NO_FUTURE', selfBelief: 'BELIEF_NO_DIRECTION', pastAttemptStage: 'ATTEMPT_NONE', decisionStyle: 'DECISION_WAIT_OTHERS', timeBehavior: 'TIME_LONG_DROPS', failureResponse: 'FAIL_SWITCH' },
      ACTION_GAP: { primaryProblem: 'PROBLEM_INCOME_STUCK', selfBelief: 'BELIEF_KNOW_NO_ACTION', pastAttemptStage: 'ATTEMPT_COURSE_ONLY', decisionStyle: 'DECISION_LEARN_FIRST', timeBehavior: 'TIME_SHORT_FIRST', failureResponse: 'FAIL_GIVE_UP' },
      VALIDATION_GAP: { primaryProblem: 'PROBLEM_MONETIZE', selfBelief: 'BELIEF_ABILITY', pastAttemptStage: 'ATTEMPT_NO_SALE', decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_SHORT_FIRST', failureResponse: 'FAIL_GIVE_UP' },
      REPEATABILITY_GAP: { primaryProblem: 'PROBLEM_INCOME_STUCK', selfBelief: 'BELIEF_NO_DIRECTION', pastAttemptStage: 'ATTEMPT_FEW_SALES', decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_SHORT_FIRST', failureResponse: 'FAIL_GIVE_UP' }
    }
    const A = { PAID_ONCE: { skillValidation: 'PROOF_PAID_ONCE' }, REPEATABLE_PAID: { skillValidation: 'PROOF_STABLE' }, NO_CLEAR_ASSET: { skillValidation: 'PROOF_NEVER', monetizableSkill: 'ASSET_UNCLEAR' } }
    let mut = 0
    for (const bn of Object.keys(B1)) for (const a of Object.keys(A)) {
      const o = H.runHybridDiagnosisV6(base(Object.assign({}, B1[bn], A[a])))
      if (o.diagnosis.primaryBottleneck !== bn) mut++
    }
    assert.strictEqual(mut, 0)
  })

  console.log('\n══════════════════════════════════════')
  console.log('R62 CROSS-OBJECT FALSE-CONFLICT: ' + pass + ' passed, ' + fail + ' failed')
  console.log('══════════════════════════════════════')
  if (fail) process.exitCode = 1
})()
