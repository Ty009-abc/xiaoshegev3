'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r65-thesis-survivability.test.js
 *
 * RC8.4 V6 R65 — THESIS SURVIVABILITY + VALUE-MIGRATION TRUTHFULNESS.
 * Deterministic; ONE injected stub AI call, no network, no provider, no key.
 *
 * Proves:
 *   §2  validator severity model (BLOCKING vs REPAIRABLE)
 *   §3  BARE_TOKEN_ABSOLUTE_BLOCKING = NO (context-aware absolutes)
 *   §4  deterministic LOCAL repair (no second AI call)
 *   §5  repair scope narrow (strategy mutation = 0)
 *   §7  unpaid-capability value migration truthfulness
 *   §8  migration states audited / frozen
 *   §9  owner exact class migration
 *   §10 commercial experiment alignment (real paid offer, not stated willingness)
 *   §13 all dangerous-claim mutations caught
 *   §15 R53 fallback preserved for true failure
 */

const assert = require('assert')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const { runHybridDiagnosisV6 } = require(path.join(CF, 'hybrid/hybridDiagnosisV6.js'))
const { buildReportV6 } = require(path.join(CF, 'report/reportBuilderV6.js'))
const { buildNoPrimaryReportV6 } = require(path.join(CF, 'report/noPrimaryReportV6.js'))
const { buildThesisEnvelopeV6, NP_VALUE_MIGRATIONS } = require(path.join(CF, 'thesis/thesisEnvelopeV6.js'))
const { runThesisReportRuntimeV6, RENDER_SOURCE, STATUS } = require(path.join(CF, 'thesis/thesisReportRuntimeV6.js'))
const V = require(path.join(CF, 'thesis/thesisValidatorV6.js'))
const { repairThesisOutput } = require(path.join(CF, 'thesis/thesisRepairV6.js'))
const { normalizeThesisOutput } = require(path.join(CF, 'thesis/thesisAdapterV6.js'))

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
// The EXACT R63 owner class (diagnosed in R64).
const OWNER = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', monthlySurplus: 'SURPLUS_1K_5K',
  safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE', weeklyTime: 'TIME_10_20',
  executionStability: 'EXEC_UNSTABLE', primaryGoal: 'GOAL_FIND_DIRECTION', maxTrialCost: 'COST_1K_5K',
  skillValidation: 'PROOF_FREE_THANKED', monetizableSkill: 'ASSET_CONTENT', primaryProblem: 'PROBLEM_NO_FUTURE',
  pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_NO_DIRECTION', decisionStyle: 'DECISION_ALL_IN',
  timeBehavior: 'TIME_SHORT_FIRST', failureResponse: 'FAIL_GIVE_UP'
}
// UNPROVEN class (paid-once + career switch) for mutation §13.E
const UNPROVEN = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', monthlySurplus: 'SURPLUS_1K_5K',
  safetyMonths: 'SAFETY_1_3', debtPressure: 'DEBT_CONSUMER', skillValidation: 'PROOF_PAID_ONCE',
  monetizableSkill: 'ASSET_TECHNICAL', weeklyTime: 'TIME_20_PLUS', executionStability: 'EXEC_STABLE',
  pastAttemptStage: 'ATTEMPT_FEW_SALES', selfBelief: 'BELIEF_ABILITY', decisionStyle: 'DECISION_SMALL_TEST',
  timeBehavior: 'TIME_PROTECT_LONG', primaryProblem: 'PROBLEM_CAREER_SWITCH', primaryGoal: 'GOAL_CAREER_SWITCH',
  maxTrialCost: 'COST_5K_20K', failureResponse: 'FAIL_RECHECK'
}

function envFor (raw, scopeOverride) {
  const out = runHybridDiagnosisV6(raw)
  const np = out.diagnosis.diagnosisState === 'NO_PRIMARY' ? buildNoPrimaryReportV6(out.diagnosis, out.hybridContext) : null
  const env = buildThesisEnvelopeV6({ hybridProfile: out.hybridProfile, diagnosis: out.diagnosis, hybridContext: out.hybridContext, noPrimaryReport: np, crossAxisScope: scopeOverride || (np && np.noPrimaryScope) })
  const fb = buildReportV6(out.diagnosis, out.hybridContext)
  return { out, np, env, fb }
}

/** A well-formed, in-envelope draft for the owner envelope. */
function ownerDraft (env, over) {
  const mig = env.allowedTargetPositions[0]
  const base = {
    strategicThesis: {
      identityInterpretation: '你手里有一项被认可的能力，却从未让它进入一次真实交易。',
      coreContradiction: '能力被认可过，却从未被定价；想找方向，却一直没让市场回答一次。',
      structuralMechanism: '能力只以“帮忙”的形式流通，没有进入交易结构；没有交易，就拿不到价格信号。',
      worldRule: { id: env.allowedWorldRules[0], expression: '东西好不好，由愿意掏钱的人说了算。' },
      strategicMigration: { from: mig.from, to: mig.to, logic: '先把它变成一个别人愿意付费的最小交付，拿到第一笔付费证据。' },
      commercialHypothesis: '先把这项能力打包成一个可交付的结果，向真实的人提出一次低风险测试价。',
      actionThesis: '这一步要验证的是：有人愿不愿意为它掏钱。'
    },
    cards: {
      card01: '能力被认可，却从未被定价。',
      card02: '你有一项被认可的能力，但一直没产生收入，现在最想看清往后该往哪走。',
      card03: ['能力只被当作“帮忙”使用，没有进入交易结构。', '没有交易，就拿不到价格信号。', '没有价格信号，方向就只能靠猜。', '所以先让这项能力第一次进入交易。'],
      card04: { from: mig.from, to: mig.to, logic: '先卖一次最小交付，用付费回答值不值得继续。' },
      card05: { primary: '把能力做成一件事、写清结果，向一个曾免费帮过的人提出一笔低风险测试价。', supporting: ['把交付定义成一个具体可完成的小任务'], target: '1个曾免费帮过、认可你能力的人', timebox: '7天内', successSignal: '对方愿意为这次交付付钱，或给出明确条件。' }
    }
  }
  if (over && over.st) Object.assign(base.strategicThesis, over.st)
  if (over && over.cards) Object.assign(base.cards, over.cards)
  return base
}
function stubAI (obj) { return async () => ({ success: true, content: JSON.stringify(obj), tokens: 20, finishReason: 'stop' }) }
function run (c, callAI) {
  return runThesisReportRuntimeV6({
    diagnosis: c.out.diagnosis, hybridProfile: c.out.hybridProfile, hybridContext: c.out.hybridContext,
    noPrimaryReport: c.np, fallbackReport: c.fb, crossAxisScope: c.env.crossAxisScope, callAI
  })
}

async function main () {
  // ═══ §2 SEVERITY MODEL ═══
  console.log('\n── §2 VALIDATOR SEVERITY MODEL ──')
  t('§2 BLOCKING_REASON_CODES contains every required code', () => {
    const required = ['UNSUPPORTED_IDENTITY_FACT', 'SKILL_TO_OCCUPATION_INFERENCE', 'MARKET_PROOF_MISMATCH', 'B1_AUTHORITY_MUTATION', 'WORLD_RULE_OUTSIDE_ENVELOPE', 'MIGRATION_OUTSIDE_ENVELOPE', 'UNPROVEN_PATH_OVERREACH', 'CROSS_CARD_THESIS_DRIFT', 'NO_PRIMARY_BOTTLENECK_CLAIM', 'INVENTED_PRICE', 'GUARANTEED_OUTCOME', 'FABRICATED_USER_HISTORY', 'FABRICATED_CUSTOMER_FACT', 'FABRICATED_INCOME_FACT']
    for (const c of required) assert.ok(V.BLOCKING_REASON_CODES.indexOf(c) !== -1, 'missing ' + c)
  })
  t('§2 REPAIRABLE_REASON_CODES = [UNSUPPORTED_ABSOLUTE_CLAIM]', () => {
    assert.deepStrictEqual(V.REPAIRABLE_REASON_CODES, ['UNSUPPORTED_ABSOLUTE_CLAIM'])
  })
  t('§2 validator returns blocking/repairable split', () => {
    const { env } = envFor(OWNER)
    const v = V.validateThesisV6(ownerDraft(env), env)
    assert.deepStrictEqual(v.blockingFailures, [])
    assert.deepStrictEqual(v.repairableFailures, [])
    assert.ok(Array.isArray(v.hardFailures))
  })

  // ═══ §3 CONTEXT-AWARE ABSOLUTES ═══
  console.log('\n── §3 BARE_TOKEN_ABSOLUTE_BLOCKING = NO ──')
  t('§3 structural 永远 (mechanism) => REPAIRABLE, not blocking', () => {
    const c = V.classifyAbsoluteClaims('没有反馈，方向就永远定不下来。')
    assert.deepStrictEqual(c.blocking, [])
    assert.ok(c.repairable.length > 0)
  })
  t('§3 structural 一定 (conditional mechanism) => REPAIRABLE', () => {
    const c = V.classifyAbsoluteClaims('不把能力拿出来报价，就一定会缺少定价信息。')
    assert.deepStrictEqual(c.blocking, [])
  })
  t('§3 outcome assertion 一定会被淘汰 => BLOCKING', () => {
    const c = V.classifyAbsoluteClaims('你40岁以后一定会被淘汰。')
    assert.ok(c.blocking.length > 0)
  })
  t('§3 bare token alone does NOT reject the whole report (repairable path)', () => {
    const { env } = envFor(OWNER)
    const d = ownerDraft(env); d.cards.card03[2] = '没有价格信号，方向就永远只能靠猜。'
    const v = V.validateThesisV6(d, env)
    assert.strictEqual(v.valid, false)
    assert.deepStrictEqual(v.blockingFailures, [])
    assert.strictEqual(v.repairableFailures.length, 1)
  })
  t('§3 negation-aware: 不一定 / 未必 are not claims', () => {
    const c = V.classifyAbsoluteClaims('这项能力不一定能变现，也未必是唯一方向。')
    assert.deepStrictEqual(c.tokens, [])
  })

  // ═══ §4/§5/§16 LOCAL REPAIR ═══
  console.log('\n── §4/§5/§16 DETERMINISTIC LOCAL REPAIR ──')
  await ta('§4 repairable draft => thesis_ai via local repair, modelCalls=1', async () => {
    const c = envFor(OWNER)
    const d = ownerDraft(c.env); d.cards.card03[1] = '没有交易，方向就永远定不下来。'
    let calls = 0
    const r = await run(c, async () => { calls++; return { success: true, content: JSON.stringify(d), tokens: 20, finishReason: 'stop' } })
    assert.strictEqual(r.renderSource, RENDER_SOURCE.AI, 'must render thesis_ai')
    assert.strictEqual(r.meta.modelCalls, 1)
    assert.strictEqual(calls, 1, 'exactly ONE model call')
    assert.strictEqual(r.meta.localRepairApplied, true)
    assert.ok(r.meta.localRepairTypes.indexOf('ABSOLUTE_TO_HEDGE') !== -1)
  })
  await ta('§4 LOCAL_REPAIR_AI_CALL_COUNT = 0 (repair is offline)', async () => {
    const c = envFor(OWNER)
    const d = ownerDraft(c.env); d.cards.card03[1] = '没有交易，方向就永远定不下来。'
    let calls = 0
    await run(c, async () => { calls++; return { success: true, content: JSON.stringify(d) } })
    assert.strictEqual(calls, 1, 'no second call for repair')
  })
  t('§5 LOCAL_REPAIR_STRATEGY_MUTATION_COUNT = 0 (worldRule.id / migration untouched)', () => {
    const { env } = envFor(OWNER)
    const d = ownerDraft(env); d.cards.card03[0] = '永远无法绕开需要一次真实交易。'
    const before = normalizeThesisOutput(d)
    const rep = repairThesisOutput(d)
    assert.strictEqual(rep.output.strategicThesis.worldRule.id, before.strategicThesis.worldRule.id)
    assert.strictEqual(rep.output.strategicThesis.strategicMigration.from, before.strategicThesis.strategicMigration.from)
    assert.strictEqual(rep.output.strategicThesis.strategicMigration.to, before.strategicThesis.strategicMigration.to)
    assert.notStrictEqual(rep.output.cards.card03[0], before.cards.card03[0], 'intensity was repaired')
  })
  t('§5 repair is length-preserving (word budgets unperturbed)', () => {
    const { env } = envFor(OWNER)
    const d = ownerDraft(env); d.cards.card03[0] = '永远无法绕开需要一次真实交易。'
    const rep = repairThesisOutput(d)
    assert.strictEqual([...rep.output.cards.card03[0]].length, [...d.cards.card03[0]].length)
  })
  await ta('§15 blocking failure still => envelope fallback (no repair rescue; R53 last resort preserved)', async () => {
    const c = envFor(OWNER)
    const d = ownerDraft(c.env); d.cards.card01 = '你40岁以后一定会被淘汰。'
    const r = await run(c, stubAI(d))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.ok(r.meta.validatorBlockingReasonCodes.length > 0)
    assert.ok(c.fb && c.fb.cards, 'R53 last resort preserved')
  })

  // ═══ §7/§8/§9 MIGRATION TRUTHFULNESS ═══
  console.log('\n── §7/§8/§9 VALUE-MIGRATION TRUTHFULNESS ──')
  t('§9 owner class (SKILL_USED_FREE) migration = FIRST_PAID_OFFER (not stable income)', () => {
    const { env } = envFor(OWNER)
    assert.strictEqual(env.currentValuePosition, 'VALUE_UNPAID_PROVEN_HELP')
    const mig = env.allowedTargetPositions[0]
    assert.strictEqual(mig.id, 'TURN_RECOGNIZED_CAPABILITY_INTO_FIRST_PAID_OFFER')
    assert.ok(!/稳定收入|可重复的收入|系统化/.test(mig.to), 'must not assume paid validation: ' + mig.to)
    assert.ok(!/被市场验证过的能力/.test(mig.from), 'FROM must be truthful: ' + mig.from)
  })
  t('§8 every value position maps to a truthful ONE-STEP migration', () => {
    assert.ok(NP_VALUE_MIGRATIONS.VALUE_NONE_YET.id === 'BUILD_TESTABLE_CAPABILITY')
    assert.ok(NP_VALUE_MIGRATIONS.VALUE_UNVALIDATED_SKILL.id === 'GET_FIRST_EXTERNAL_PROOF')
    assert.ok(NP_VALUE_MIGRATIONS.VALUE_UNPAID_PROVEN_HELP.id === 'TURN_RECOGNIZED_CAPABILITY_INTO_FIRST_PAID_OFFER')
    assert.ok(NP_VALUE_MIGRATIONS.VALUE_ONE_OFF_PAID.id === 'TURN_FIRST_PAYMENT_INTO_REPEATABLE_OFFER')
    assert.ok(NP_VALUE_MIGRATIONS.VALUE_REPEATABLE_PAID.id === 'TURN_REPEAT_SALES_INTO_SYSTEMATIZED_OFFER')
  })
  t('§8 no UNPAID position advances to a PAID-level target', () => {
    for (const k of ['VALUE_NONE_YET', 'VALUE_UNVALIDATED_SKILL', 'VALUE_UNPAID_PROVEN_HELP']) {
      assert.ok(!/稳定收入|可重复的收入|系统化/.test(NP_VALUE_MIGRATIONS[k].to), k + ' over-advances')
    }
  })
  t('§8 UNPROVEN scope remains link-first conditional', () => {
    const { env } = envFor(UNPROVEN)
    assert.strictEqual(env.crossAxisScope, 'UNPROVEN')
    assert.strictEqual(env.allowedTargetPositions[0].id, 'TEST_ASSET_TO_GOAL_LINK')
    assert.strictEqual(env.allowedTargetPositions[0].conditional, true)
  })
  t('§7 validator rejects a stable-income jump on an unpaid envelope', () => {
    const { env } = envFor(OWNER)
    const d = ownerDraft(env); d.strategicThesis.strategicMigration.logic = '把它变成一份稳定收入。'
    const v = V.validateThesisV6(d, env)
    assert.ok(v.blockingFailures.join(',').includes('MIGRATION_OUTSIDE_ENVELOPE'))
  })

  // ═══ §10 COMMERCIAL EXPERIMENT ALIGNMENT ═══
  console.log('\n── §10 COMMERCIAL EXPERIMENT ALIGNMENT ──')
  t('§10 owner class experimentClass = FIRST_PAID_PROOF', () => {
    const { env } = envFor(OWNER)
    assert.strictEqual(env.experimentClass, 'FIRST_PAID_PROOF')
  })
  t('§10 STATED_WILLINGNESS_ONLY_AS_PRIMARY_TEST = NO (real paid offer eligible)', () => {
    const { env } = envFor(OWNER)
    // The value migration is FIRST-PAID-PROOF, and the commercial hypotheses
    // include offer packaging => a REAL paid-offer test is envelope-eligible.
    assert.ok(env.allowedStrategyHypotheses.indexOf('OFFER_SHAPE') !== -1)
    assert.strictEqual(env.experimentClass, 'FIRST_PAID_PROOF')
  })
  await ta('§10 an outcome-defined paid-offer card05 is ACCEPTED (not stated-willingness-only)', async () => {
    const c = envFor(OWNER)
    const d = ownerDraft(c.env)
    d.cards.card05.primary = '把能力做一个可交付的最小结果，向一个曾免费帮过的人提出一笔低风险测试价，看对方是否真的愿意付费。'
    const r = await run(c, stubAI(d))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.AI)
  })

  // ═══ §13 MUTATION TESTS ═══
  console.log('\n── §13 DANGEROUS CLAIM MUTATIONS ──')
  const { env: OENV } = envFor(OWNER)
  const { env: UENV } = envFor(UNPROVEN)
  const mutations = [
    ['A. 你40岁以后一定会被淘汰。', OWNER, (d) => { d.cards.card01 = '你40岁以后一定会被淘汰。' }],
    ['B. 这个方向肯定能让你赚钱。', OWNER, (d) => { d.cards.card01 = '这个方向肯定能让你赚钱。' }],
    ['C. 你已经有很多付费客户。', OWNER, (d) => { d.cards.card02 = '你已经有很多付费客户。' }],
    ['D. 你一直靠接项目赚钱。', OWNER, (d) => { d.cards.card02 = '你一直靠接项目赚钱。' }],
    ['E. UNPROVEN 扩大现有能力。', UNPROVEN, (d) => { d.strategicThesis.strategicMigration.logic = '所以应该扩大现有能力。' }],
    ['F. invented exact price.', OWNER, (d) => { d.cards.card05.primary = '把服务定价299元测试第二次付费。' }]
  ]
  let caught = 0
  for (const [name, raw, mutate] of mutations) {
    const env = raw === OWNER ? OENV : UENV
    const d = ownerDraft(env); mutate(d)
    const v = V.validateThesisV6(d, env)
    const ok = v.blockingFailures.length > 0
    if (ok) caught++
    console.log('      ' + (ok ? '✓' : '✗') + ' ' + name + ' => ' + JSON.stringify(v.blockingFailures))
  }
  t('§13 ALL_BLOCKING_MUTATIONS_CAUGHT = YES (6/6)', () => assert.strictEqual(caught, 6))

  // ═══ §15 TRUE FAILURE FALLBACK ═══
  console.log('\n── §15 FALLBACK HIERARCHY (R68) ──')
  await ta('§15 provider failure => envelope fallback, complete five cards (R53 preserved)', async () => {
    const c = envFor(OWNER)
    const r = await run(c, async () => ({ success: false, error: 'HTTP 503' }))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.ok(r.report.cards.fatalInsight && r.report.cards.firstAction, 'complete five cards')
    assert.ok(c.fb && c.fb.cards, 'R53 last resort preserved')
  })
  await ta('§15 invalid JSON => envelope fallback', async () => {
    const c = envFor(OWNER)
    const r = await run(c, async () => ({ success: true, content: 'not json {{{' }))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.strictEqual(r.meta.resultCategory, STATUS.INVALID_JSON)
  })

  // ═══ §17 B1 IMMUTABILITY (regression touchpoint) ═══
  console.log('\n── §17 B1 IMMUTABILITY ──')
  t('§17 report layer does not mutate B1 authority', () => {
    const out = runHybridDiagnosisV6(OWNER)
    const before = JSON.stringify({ s: out.diagnosis.diagnosisState, b: out.diagnosis.primaryBottleneck, g: out.diagnosis.firstActionType })
    buildNoPrimaryReportV6(out.diagnosis, out.hybridContext)
    buildThesisEnvelopeV6({ hybridProfile: out.hybridProfile, diagnosis: out.diagnosis, hybridContext: out.hybridContext })
    const after = JSON.stringify({ s: out.diagnosis.diagnosisState, b: out.diagnosis.primaryBottleneck, g: out.diagnosis.firstActionType })
    assert.strictEqual(after, before)
  })

  console.log('\n══════════════════════════════════════')
  console.log('R65 THESIS SURVIVABILITY: ' + pass + ' passed, ' + fail + ' failed')
  console.log('══════════════════════════════════════')
  if (fail) process.exitCode = 1
}

main()
