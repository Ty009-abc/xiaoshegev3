'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r57-shared-strategic-thesis.test.js
 *
 * RC8.4 V6 R57 — SHARED STRATEGIC THESIS runtime.
 * Deterministic; ONE injected stub AI call, no network, no provider, no key.
 *
 * Proves:
 *   - deterministic ThesisEnvelope (facts / absence / no skill->occupation)
 *   - EVIDENCE_CONFLICT => 0 model calls
 *   - ONE call per report; validator; strict fail-closed to R53 fallback
 *   - UNPROVEN = link-first (no path overreach)
 *   - NO_PRIMARY never claims a primary bottleneck
 *   - bold-but-safe claims (no absolutes / fate / invented price / bio facts)
 *   - CROSS_CARD_THESIS_DRIFT=0 on accepted output
 */

const assert = require('assert')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const { runHybridDiagnosisV6 } = require(path.join(CF, 'hybrid/hybridDiagnosisV6.js'))
const { buildReportV6 } = require(path.join(CF, 'report/reportBuilderV6.js'))
const { buildThesisEnvelopeV6 } = require(path.join(CF, 'thesis/thesisEnvelopeV6.js'))
const { runThesisReportRuntimeV6, RENDER_SOURCE, STATUS } = require(path.join(CF, 'thesis/thesisReportRuntimeV6.js'))
const { validateThesisV6, detectThesisDrift } = require(path.join(CF, 'thesis/thesisValidatorV6.js'))

let pass = 0, fail = 0
function t (name, fn) {
  try { fn(); pass++; console.log('   ✓ ' + name) }
  catch (e) { fail++; console.log('   ✗ ' + name + '\n     ' + (e && e.message)) }
}
async function ta (name, fn) {
  try { await fn(); pass++; console.log('   ✓ ' + name) }
  catch (e) { fail++; console.log('   ✗ ' + name + '\n     ' + (e && e.message)) }
}

// ── fixtures ─────────────────────────────────────────────────────
const R54 = { // UNPROVEN: technical + paid once + career switch, NO occupation
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', monthlySurplus: 'SURPLUS_1K_5K',
  safetyMonths: 'SAFETY_1_3', debtPressure: 'DEBT_CONSUMER', skillValidation: 'PROOF_PAID_ONCE',
  monetizableSkill: 'ASSET_TECHNICAL', weeklyTime: 'TIME_20_PLUS', executionStability: 'EXEC_STABLE',
  pastAttemptStage: 'ATTEMPT_FEW_SALES', selfBelief: 'BELIEF_ABILITY', decisionStyle: 'DECISION_SMALL_TEST',
  timeBehavior: 'TIME_PROTECT_LONG', primaryProblem: 'PROBLEM_CAREER_SWITCH', primaryGoal: 'GOAL_CAREER_SWITCH',
  maxTrialCost: 'COST_5K_20K', failureResponse: 'FAIL_RECHECK'
}
const B_PROGRAMMER = { // programmer WITH occupation + monetize goal (compatible)
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', monthlySurplus: 'SURPLUS_1K_5K',
  safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE', skillValidation: 'PROOF_PAID_ONCE',
  monetizableSkill: 'ASSET_TECHNICAL', occupationDetail: '程序员', weeklyTime: 'TIME_10_20',
  executionStability: 'EXEC_STABLE', pastAttemptStage: 'ATTEMPT_FEW_SALES', selfBelief: 'BELIEF_ABILITY',
  decisionStyle: 'DECISION_SMALL_TEST', timeBehavior: 'TIME_PROTECT_LONG',
  primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SKILL_MONETIZE', maxTrialCost: 'COST_5K_20K',
  failureResponse: 'FAIL_RECHECK'
}
const C_NO_ASSET = { // no clear asset + side income goal
  lifeStage: 'LIFE_25_30', incomeStructure: 'INC_SALARY', monthlySurplus: 'SURPLUS_UNDER_1K',
  safetyMonths: 'SAFETY_UNDER_1', debtPressure: 'DEBT_NONE', skillValidation: 'PROOF_NEVER',
  monetizableSkill: 'ASSET_UNCLEAR', weeklyTime: 'TIME_5_10', executionStability: 'EXEC_UNSTABLE',
  pastAttemptStage: 'ATTEMPT_COURSE_ONLY', selfBelief: 'BELIEF_NO_DIRECTION', decisionStyle: 'DECISION_LEARN_FIRST',
  timeBehavior: 'TIME_BALANCE', primaryProblem: 'PROBLEM_SIDE_UNSTARTED', primaryGoal: 'GOAL_SIDE_INCOME',
  maxTrialCost: 'COST_1K_5K', failureResponse: 'FAIL_SWITCH'
}
const CONFLICT = { // R62: cross-object no longer conflicts; §2 forces a BOUND conflict below
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', monthlySurplus: 'SURPLUS_1K_5K',
  safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE', skillValidation: 'PROOF_STABLE',
  monetizableSkill: 'ASSET_TECHNICAL', weeklyTime: 'TIME_10_20', executionStability: 'EXEC_STABLE',
  pastAttemptStage: 'ATTEMPT_NO_SALE', selfBelief: 'BELIEF_ABILITY', decisionStyle: 'DECISION_ALL_IN',
  timeBehavior: 'TIME_SHORT_FIRST', primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SKILL_MONETIZE',
  maxTrialCost: 'COST_5K_20K', failureResponse: 'FAIL_GIVE_UP'
}

function validOutput (ruleId, over) {
  const base = {
    strategicThesis: {
      identityInterpretation: '你现在更像是在出售一项能力，还没有把它变成可重复的收入结构，同时想把它带进一个不同的目标方向。',
      coreContradiction: '你手里有一项已经被市场验证过的能力，却想解决的是另一个问题。',
      structuralMechanism: '当一项能力按工时出售时，收入会随你停手而停止，很难留下可复用的结果。',
      worldRule: { id: ruleId || 'LOW_COST_EXPERIMENT_OVER_PERFECT_DIRECTION', expression: '与其等一个完美方向，不如先做一个低成本、拿得到反馈的小试验。' },
      strategicMigration: { from: '把已证明的能力直接当成下一步的路', to: '先验证这项能力和当前目标之间到底连不连得上', logic: '先把两者的连接验证出来，再决定要不要带着它一起走。' },
      commercialHypothesis: '可以先找走在目标方向里的人，验证这项能力能不能用得上。',
      actionThesis: '这一小步要验证的是连接，而不是能力本身行不行。'
    },
    cards: {
      card01: '你不缺能力，缺的是它和目标之间那条还没验证的连接。',
      card02: '你现在出售的是一项能力，还不是一份可重复的收入结构；你已经跨过会不会，还没跨过这个方向对不对。',
      card03: ['你已经让市场付过一次钱，说明这项能力能换钱。', '但你现在想解决的是另一个问题，它不一定是同一条路。', '如果不先验证连接，你可能会把一项对的能力用在一个不对的方向上。', '所以真正没被验证的，是连接，不是能力。'],
      card04: { from: '把已证明的能力直接当成下一步的路', to: '先验证连接', logic: '先问目标方向里的人用不用得上，再决定要不要带着它走。' },
      card05: { primary: '找1个已经走在你目标方向里的人，问清楚他手上的事能不能用上你这项已有人付过钱的能力。', supporting: ['先写下你想去的方向里最关键的一件事', '再列出一句这项能力可能的用法'], target: '1个已经走在你目标方向里的人', timebox: '3天内完成', successSignal: '对方明确说用得上、或用不上你现有的这项能力。' }
    }
  }
  if (over) Object.assign(base, over)
  return base
}
function stubAI (obj) { return async () => ({ success: true, content: JSON.stringify(obj), tokens: 20, finishReason: 'stop' }) }
function stubText (txt) { return async () => ({ success: true, content: txt, tokens: 20, finishReason: 'stop' }) }

function ctx (raw) {
  const out = runHybridDiagnosisV6(raw)
  const fallback = buildReportV6(out.diagnosis, out.hybridContext)
  return { out, fallback }
}
// R62 — the cross-object pair (skillValidation vs pastAttemptStage) no longer
// hard-conflicts, so build a context that FORCES the R48 bound-conflict path
// (the machinery is preserved for a future explicitly-bound rule) to prove
// EVIDENCE_CONFLICT still makes 0 model calls.
function conflictCtx (raw) {
  const c = ctx(raw)
  c.out.diagnosis.compatibility = {
    verdict: 'EVIDENCE_CONFLICT', crossAxisScope: 'CONFLICT',
    conflictType: 'MARKET_PROOF_VS_ATTEMPT_STAGE',
    conflictingFields: ['skillValidation', 'pastAttemptStage'],
    recommendedReviewScreens: [5, 7],
    reasonCode: 'BOUND_RULE'
  }
  c.fallback = buildReportV6(c.out.diagnosis, null)
  return c
}
function run (c, callAI) {
  return runThesisReportRuntimeV6({
    diagnosis: c.out.diagnosis, hybridProfile: c.out.hybridProfile, hybridContext: c.out.hybridContext,
    fallbackReport: c.fallback, crossAxisScope: c.fallback.crossAxisScope, callAI
  })
}

async function main () {
  // ═══ §2/§3 ENVELOPE ═══
  console.log('\n── §2/§3 ThesisEnvelope ──')
  {
    const { out } = ctx(R54)
    const env = buildThesisEnvelopeV6({ hybridProfile: out.hybridProfile, diagnosis: out.diagnosis, hybridContext: out.hybridContext, crossAxisScope: 'UNPROVEN' })
    t('envelope has all required fields', () => {
      for (const k of ['facts', 'diagnosisState', 'primaryBottleneck', 'secondaryConstraint', 'beliefRealityGap', 'executionStage', 'firstActionType', 'assetState', 'marketProof', 'crossAxisScope', 'currentValuePosition', 'allowedTargetPositions', 'allowedWorldRules', 'allowedStrategyHypotheses', 'forbiddenClaims', 'experimentClass', 'realityConstraints']) {
        assert.ok(k in env, 'missing ' + k)
      }
    })
    t('FACT ledger: every fact confidence=FACT', () => { assert.ok(env.facts.length > 0); assert.ok(env.facts.every(f => f.confidence === 'FACT')) })
    t('NO occupation fact when not provided (absence meaningful)', () => { assert.ok(!env.facts.some(f => f.field === 'occupationDetail')) })
    t('NO_PRIMARY => primaryBottleneck=null + evidenceClusters + proofQuestion', () => {
      assert.strictEqual(env.primaryBottleneck, null)
      assert.ok(Array.isArray(env.evidenceClusters))
      assert.ok(typeof env.proofQuestion === 'string' && env.proofQuestion.length > 0)
    })
    t('numericPriceEnabled=false (R57)', () => { assert.strictEqual(env.numericPriceEnabled, false) })
  }

  console.log('\n── §3 skill does NOT infer occupation ──')
  {
    const { out } = ctx(R54)
    const env = buildThesisEnvelopeV6({ hybridProfile: out.hybridProfile, diagnosis: out.diagnosis, hybridContext: out.hybridContext, crossAxisScope: 'UNPROVEN' })
    t('SKILL_TO_OCCUPATION_INFERENCE_COUNT=0 (no programmer/developer派生)', () => {
      const blob = JSON.stringify(env)
      assert.ok(!/程序员|开发者|自由职业|接活/.test(blob), 'skill leaked into occupation')
    })
  }

  // ═══ §2 EVIDENCE_CONFLICT => 0 model calls ═══
  console.log('\n── §2 EVIDENCE_CONFLICT ──')
  await ta('EVIDENCE_CONFLICT_MODEL_CALL_COUNT=0 (no envelope, no call)', async () => {
    const c = conflictCtx(CONFLICT)
    assert.strictEqual(c.out.diagnosis.compatibility.verdict, 'EVIDENCE_CONFLICT', 'fixture is not a bound conflict')
    let calls = 0
    const counting = async () => { calls++; return { success: true, content: '{}' } }
    const r = await run(c, counting)
    assert.strictEqual(calls, 0, 'model was called on conflict')
    assert.strictEqual(r.renderSource, RENDER_SOURCE.FALLBACK)
  })

  // ═══ §7 ONE CALL + §16 validator + §21 fallback ═══
  console.log('\n── §7/§16/§21 ONE call + validator + fail-closed ──')
  await ta('A. PASS — one call, valid thesis maps to five cards', async () => {
    const c = ctx(R54)
    const r = await run(c, stubAI(validOutput()))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.AI)
    assert.strictEqual(r.meta.modelCalls, 1)
    assert.ok(r.report.cards.fatalInsight.text && r.report.cards.coreProblem.text)
    assert.strictEqual(r.report.cards.systemLoop.steps.length, 4)
    assert.ok(r.report.cards.firstAction.action && r.report.cards.firstAction.target && r.report.cards.firstAction.timebox && r.report.cards.firstAction.done)
  })
  await ta('B. invalid JSON -> envelope fallback (valid envelope), R53 preserved as last resort', async () => {
    const c = ctx(R54)
    const r = await run(c, stubText('not json at all {{{'))
    // R68 §8 — a valid envelope => product-grade envelope fallback, NOT R53.
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.strictEqual(r.meta.resultCategory, STATUS.INVALID_JSON)
    assert.ok(r.report.cards.fatalInsight.text && r.report.cards.firstAction.action, 'complete five cards')
    // R53 deterministic report is still constructible (DETERMINISTIC_FALLBACK_PRESERVED).
    assert.ok(c.fallback && c.fallback.cards, 'R53 last resort preserved')
  })
  await ta('C. absolute+fate claim -> envelope fallback (blocking captured)', async () => {
    const c = ctx(R54); const o = validOutput(); o.cards.card01 = '技术卖成工时，永远只有一份收入，你一定会被淘汰。'
    const r = await run(c, stubAI(o))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.ok(r.meta.validatorReasonCodes.join(',').match(/UNSUPPORTED_ABSOLUTE|UNSUPPORTED_AGE/))
  })
  await ta('D. UNPROVEN path overreach (scale/systematize) -> envelope fallback', async () => {
    const c = ctx(R54); const o = validOutput(); o.cards.card04 = { from: 'x', to: '扩大这项能力并系统化', logic: '把这项能力规模化，多接更多单。' }
    const r = await run(c, stubAI(o))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.ok(r.meta.validatorReasonCodes.includes('UNPROVEN_PATH_OVERREACH'))
  })
  await ta('E. invented occupation/bio fact -> envelope fallback', async () => {
    const c = ctx(R54); const o = validOutput(); o.cards.card02 = '你一直是代码执行者，长期给老板打工。'
    const r = await run(c, stubAI(o))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.ok(r.meta.validatorReasonCodes.includes('UNSUPPORTED_IDENTITY_FACT'))
  })
  await ta('F. invented numeric price -> envelope fallback', async () => {
    const c = ctx(R54); const o = validOutput(); o.cards.card05.primary = '把服务定价299元测试第二次付费。'
    const r = await run(c, stubAI(o))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.ok(r.meta.validatorReasonCodes.join(',').match(/INVENTED_PRICE/))
  })
  await ta('G. NO_PRIMARY bottleneck claim -> envelope fallback', async () => {
    const c = ctx(R54); const o = validOutput(); o.cards.card02 = '你真正的瓶颈就是不敢开始。'
    const r = await run(c, stubAI(o))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.ok(r.meta.validatorReasonCodes.includes('NO_PRIMARY_BOTTLENECK_CLAIM'))
  })
  await ta('H. world rule outside envelope -> envelope fallback', async () => {
    const c = ctx(R54); const o = validOutput('LEVERAGE_OVER_TIME_FOR_MONEY')
    const r = await run(c, stubAI(o))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.ok(r.meta.validatorReasonCodes.includes('WORLD_RULE_OUTSIDE_ENVELOPE'))
  })
  await ta('I. provider error -> envelope fallback (valid envelope)', async () => {
    const c = ctx(R54)
    const r = await run(c, async () => ({ success: false, error: 'HTTP 503' }))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
  })
  await ta('J. card word budget breach -> envelope fallback', async () => {
    const c = ctx(R54); const o = validOutput(); o.cards.card01 = '这是一句被刻意拉长到明显超过五十个中文字符上限的致命一句话文案用来触发字数预算校验失败的情况啊啊啊啊啊啊'
    const r = await run(c, stubAI(o))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.ok(r.meta.validatorReasonCodes.includes('CARD01_OVER_BUDGET'))
  })
  await ta('K. never returns partial AI on failure (envelope fallback is complete)', async () => {
    const c = ctx(R54); const o = validOutput(); delete o.cards.card03
    const r = await run(c, stubAI(o))
    // R68 §20 — VALID_ENVELOPE_TO_R53_FALLBACK_COUNT=0: valid envelope => envelope fallback.
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.ok(r.report.cards.systemLoop.steps.length > 0, 'no partial AI leaked; complete report')
    assert.notStrictEqual(r.report, c.fallback, 'not the raw R53 report')
  })

  // ═══ §17 THESIS DRIFT ═══
  console.log('\n── §17 THESIS DRIFT ──')
  t('CROSS_CARD_THESIS_DRIFT=0 for accepted output', () => {
    const { out } = ctx(R54)
    const env = buildThesisEnvelopeV6({ hybridProfile: out.hybridProfile, diagnosis: out.diagnosis, hybridContext: out.hybridContext, crossAxisScope: 'UNPROVEN' })
    const v = validateThesisV6(validOutput(), env)
    assert.strictEqual(detectThesisDrift(require(path.join(CF, 'thesis/thesisAdapterV6.js')).normalizeThesisOutput(validOutput()), env), null)
    assert.ok(!v.hardFailures.join(',').includes('CROSS_CARD_THESIS_DRIFT'))
  })
  t('card01 commercial vs card04 career-switch -> drift detected', () => {
    const drift = detectThesisDrift({ cards: { card01: '你的问题是怎么把服务卖出去、拿到成交。', card04: { from: '靠工资', to: '转行进新领域换个赛道', logic: '先去了解一个新行业。' } } }, {})
    assert.ok(drift)
  })

  // ═══ §9 PRIMARY behavior ═══
  console.log('\n── §9 PRIMARY envelope ──')
  {
    const { out } = ctx({ // force PRIMARY via native-style answers? use hybrid compatible monetize w/ occupation
      lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6',
      debtPressure: 'DEBT_NONE', skillValidation: 'PROOF_PAID_ONCE', monetizableSkill: 'ASSET_TECHNICAL', occupationDetail: '程序员',
      weeklyTime: 'TIME_10_20', executionStability: 'EXEC_STABLE', pastAttemptStage: 'ATTEMPT_FEW_SALES', selfBelief: 'BELIEF_ABILITY',
      decisionStyle: 'DECISION_SMALL_TEST', timeBehavior: 'TIME_PROTECT_LONG', primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SKILL_MONETIZE',
      maxTrialCost: 'COST_5K_20K', failureResponse: 'FAIL_RECHECK'
    })
    const env = buildThesisEnvelopeV6({ hybridProfile: out.hybridProfile, diagnosis: out.diagnosis, hybridContext: out.hybridContext })
    t('PRIMARY envelope keeps B1 primaryBottleneck (if PRIMARY) or null-safe', () => {
      if (out.diagnosis.diagnosisState === 'PRIMARY') {
        assert.strictEqual(env.primaryBottleneck, out.diagnosis.primaryBottleneck)
        assert.ok(env.allowedWorldRules.length > 0)
      } else {
        assert.strictEqual(env.primaryBottleneck, null)
      }
    })
  }

  // ═══ §18 word budgets accepted case ═══
  console.log('\n── §18 word budget (accepted output within budget) ──')
  await ta('accepted output has no budget failures', async () => {
    const c = ctx(R54)
    const o = validOutput()
    const env = buildThesisEnvelopeV6({ hybridProfile: c.out.hybridProfile, diagnosis: c.out.diagnosis, hybridContext: c.out.hybridContext, crossAxisScope: 'UNPROVEN' })
    const v = validateThesisV6(o, env)
    assert.deepStrictEqual(v.hardFailures.filter(x => /BUDGET|BULLETS/.test(x)), [])
  })

  // ═══ §27 FALLBACK AVAILABLE FOR EVERY FIXTURE ═══
  console.log('\n── §27 fallback hierarchy for every fixture ──')
  for (const [name, raw] of [['R54', R54], ['B_PROGRAMMER', B_PROGRAMMER], ['C_NO_ASSET', C_NO_ASSET]]) {
    await ta('valid envelope => envelope fallback (R53 preserved as last resort): ' + name, async () => {
      const c = ctx(raw)
      const r = await run(c, async () => ({ success: false, error: 'x' }))
      assert.ok(r.report && r.report.cards, 'no fallback report')
      assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
      assert.notStrictEqual(r.report, c.fallback, 'must not silently ship the R53 report for a valid envelope')
      assert.ok(c.fallback && c.fallback.cards, 'R53 last resort preserved')
    })
  }

  console.log('\n══════════════════════════════════════')
  console.log('R57 SHARED STRATEGIC THESIS: ' + pass + ' passed, ' + fail + ' failed')
  console.log('══════════════════════════════════════')
  if (fail) process.exitCode = 1
}

main()
