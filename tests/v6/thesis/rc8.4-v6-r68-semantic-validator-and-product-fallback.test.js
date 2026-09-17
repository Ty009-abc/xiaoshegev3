'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r68-semantic-validator-and-product-fallback.test.js
 *
 * RC8.4 V6 R68 — STRUCTURED SEMANTIC VALIDATION + PRODUCT-GRADE FALLBACK.
 * Deterministic; injected stub AI only, no network, no provider, no key.
 *
 * Proves:
 *   §3 structured semantic contract (migration.id / commercialHypothesis.class /
 *      actionThesis.experimentClass)
 *   §4/§6 alignment authority = envelope + structured fields, NOT lexical regex
 *   §5 semantically-valid LINK_TEST no longer falsely rejected
 *   §7 true safety still blocks
 *   §8/§9/§10 product-grade THESIS_ENVELOPE_DETERMINISTIC_FALLBACK
 *   §11/§12/§13 world rule / real migration / experimentClass alignment
 *   §16 true UNPROVEN overreach still caught
 *   §19 renderSource distinguishes three sources
 *   §20 VALID_ENVELOPE_TO_R53_FALLBACK_COUNT = 0
 */

const assert = require('assert')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const { runHybridDiagnosisV6 } = require(path.join(CF, 'hybrid/hybridDiagnosisV6.js'))
const { buildReportV6 } = require(path.join(CF, 'report/reportBuilderV6.js'))
const { buildNoPrimaryReportV6 } = require(path.join(CF, 'report/noPrimaryReportV6.js'))
const { buildThesisEnvelopeV6 } = require(path.join(CF, 'thesis/thesisEnvelopeV6.js'))
const { runThesisReportRuntimeV6, RENDER_SOURCE, STATUS } = require(path.join(CF, 'thesis/thesisReportRuntimeV6.js'))
const V = require(path.join(CF, 'thesis/thesisValidatorV6.js'))
const SA = require(path.join(CF, 'thesis/thesisSemanticAlignmentV6.js'))
const FB = require(path.join(CF, 'thesis/thesisEnvelopeFallbackV6.js'))
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

// ── EXACT R66 owner class (UNPROVEN + PAID_ONCE + LINK_TEST) ──
const OWNER = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationDetail: '',
  monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE',
  skillValidation: 'PROOF_PAID_ONCE', monetizableSkill: 'ASSET_CONTENT', weeklyTime: 'TIME_20_PLUS',
  executionStability: 'EXEC_VOLATILE', pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION',
  decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_BALANCE', primaryProblem: 'PROBLEM_MONETIZE',
  primaryGoal: 'GOAL_SKILL_MONETIZE', maxTrialCost: 'COST_5K_20K', failureResponse: 'FAIL_GIVE_UP'
}
// UNPROVEN via career switch (for overreach mutations)
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

/** A semantically-valid LINK_TEST draft whose PROSE deliberately avoids all
 *  trigger words (连接 / 用得上 / 目标方向 / 这条路). */
function linkTestDraft (env, over) {
  const mig = env.allowedTargetPositions[0]
  const base = {
    strategicThesis: {
      identityInterpretation: '你已经拿到过一次真实的付费，但那一次只是单点，还没有接回你真正想走的那条路。',
      coreContradiction: '一次成交证明了有人愿意买单，却没有证明这件事就是你要去的方向。',
      structuralMechanism: '一次成交只说明这件事卖得掉；它是不是你当前目标该走的那条路，是另一件没被检验过的事。',
      worldRule: { id: env.allowedWorldRules[0], expression: '与其等一个完美方向，不如先做一个低成本、拿得到反馈的小试验。' },
      strategicMigration: { id: mig.id, from: mig.from, to: mig.to, logic: '先把这两件事之间是不是同一件事，用一次真实动作验证出来。' },
      commercialHypothesis: { class: env.allowedStrategyHypotheses[0], intent: '用一次真实交付判断这项能力在你目标里有没有位置', text: '先用一次真实交付，看看它在你要去的那件事里有没有位置。' },
      actionThesis: { experimentClass: env.experimentClass, testTarget: '1个正在做你目标那件事的人', successSignal: '对方真的让你做了这一小步。', text: '这一步只验证一件事：它能不能落进你目标里的那件具体的事。' }
    },
    cards: {
      card01: '你有过一次真实付费，却还没证明这次成交和你要去的方向是同一件事。',
      card02: '你手里是一项被付过一次钱的能力；这一次付费说明它卖得掉，但只成交过一次。',
      card03: ['你已经让市场为它付过钱，这说明它真的能换钱。', '但一次成交只能证明它卖得掉，证明不了它就是你要走的那条路。', '如果把一次成交直接当成方向去做大，等于用一个没验证的假设替代一次真实验证。', '所以真正要检验的，是它能不能落进你目标里的那件具体的事。'],
      card04: { from: mig.from, to: mig.to, logic: '用一次真实动作，验证两件事是不是同一件事。' },
      card05: { primary: '选1个正在做你目标那件事的人，用这项能力帮他把一件具体的事往前推一小步，看他是不是真的需要。', supporting: ['先写清你目标里最关键的一件具体的事'], target: '1个正在做你目标那件事的人', timebox: '3天内完成', successSignal: '对方真的让你做了这一小步，并愿意为此付出真实代价。' }
    }
  }
  if (over) { if (over.st) Object.assign(base.strategicThesis, over.st); if (over.cards) Object.assign(base.cards, over.cards) }
  return base
}
function stubAI (obj) { return async () => ({ success: true, content: JSON.stringify(obj), tokens: 20, finishReason: 'stop' }) }
function stubText (txt) { return async () => ({ success: true, content: txt, tokens: 20, finishReason: 'stop' }) }
function run (c, callAI) {
  return runThesisReportRuntimeV6({
    diagnosis: c.out.diagnosis, hybridProfile: c.out.hybridProfile, hybridContext: c.out.hybridContext,
    noPrimaryReport: c.np, fallbackReport: c.fb, crossAxisScope: c.env.crossAxisScope, callAI
  })
}
const cardsText = (r) => {
  const c = r.cards || {}
  return [c.fatalInsight && c.fatalInsight.text, c.coreProblem && c.coreProblem.text,
    c.systemLoop && (c.systemLoop.steps || []).join(' '),
    c.turnaroundPath && (c.turnaroundPath.from + ' ' + c.turnaroundPath.to),
    c.firstAction && (c.firstAction.action + ' ' + c.firstAction.done)].filter(Boolean).join('\n')
}

async function main () {
  // ═══ §3 STRUCTURED SEMANTIC CONTRACT ═══
  console.log('\n── §3 STRUCTURED SEMANTIC CONTRACT ──')
  t('§3 normalizeThesisOutput carries structured fields', () => {
    const { env } = envFor(OWNER)
    const o = normalizeThesisOutput(linkTestDraft(env))
    assert.ok(o.strategicThesis.strategicMigration.id, 'migration.id missing')
    assert.ok(o.strategicThesis.commercialHypothesis.class, 'commercialHypothesis.class missing')
    assert.ok(o.strategicThesis.actionThesis.experimentClass, 'actionThesis.experimentClass missing')
  })
  t('§3 legacy prose-only output still accepted (backward compatible)', () => {
    const { env } = envFor(OWNER)
    const o = linkTestDraft(env)
    // strip structured fields -> prose-only
    delete o.strategicThesis.strategicMigration.id
    delete o.strategicThesis.commercialHypothesis
    delete o.strategicThesis.actionThesis
    o.strategicThesis.commercialHypothesis = '先用一次真实交付，看它在你要去的那件事里有没有位置。'
    o.strategicThesis.actionThesis = '这一步只验证它能不能落进你目标里的那件具体的事。'
    const v = V.validateThesisV6(o, env)
    assert.strictEqual(v.valid, true, JSON.stringify(v.hardFailures))
  })

  // ═══ §4/§6 ALIGNMENT AUTHORITY = STRUCTURED, NOT LEXICAL ═══
  console.log('\n── §4/§6 ALIGNMENT AUTHORITY ──')
  t('§6 LEXICAL_LINK_TEST_AUTHORITY = REMOVED (code not in BLOCKING)', () => {
    assert.strictEqual(V.BLOCKING_REASON_CODES.indexOf('CARD05_TEST_UNRELATED_TO_CARD04'), -1)
    assert.ok(V.DIAGNOSTIC_HINT_CODES.indexOf('CARD05_TEST_UNRELATED_TO_CARD04') !== -1)
  })
  t('§6 REGEX_ONLY_BLOCKING_RULE_COUNT = 0 for strategic alignment', () => {
    // The only strategic-alignment paths now emit STRUCTURED codes.
    const { env } = envFor(OWNER)
    const o = linkTestDraft(env)
    const a = SA.validateEnvelopeAlignment(normalizeThesisOutput(o), env)
    assert.strictEqual(a.aligned, true)
    assert.deepStrictEqual(a.violations, [])
  })
  t('§4 structured migration id outside envelope blocks', () => {
    const { env } = envFor(OWNER)
    const o = linkTestDraft(env); o.strategicThesis.strategicMigration.id = 'TURN_ONE_SUCCESS_INTO_METHOD'
    const a = SA.validateEnvelopeAlignment(normalizeThesisOutput(o), env)
    assert.ok(a.violations.includes('MIGRATION_OUTSIDE_ENVELOPE'))
  })
  t('§4 structured experimentClass mismatch blocks', () => {
    const { env } = envFor(OWNER)
    const o = linkTestDraft(env); o.strategicThesis.actionThesis.experimentClass = 'SYSTEMATIZE'
    const a = SA.validateEnvelopeAlignment(normalizeThesisOutput(o), env)
    assert.ok(a.violations.includes('CARD05_EXPERIMENT_CLASS_MISMATCH'))
  })
  t('§4 structured commercialHypothesis class outside envelope blocks', () => {
    const { env } = envFor(OWNER)
    const o = linkTestDraft(env); o.strategicThesis.commercialHypothesis.class = 'SECOND_INCOME_MODEL'
    const a = SA.validateEnvelopeAlignment(normalizeThesisOutput(o), env)
    assert.ok(a.violations.includes('COMMERCIAL_HYPOTHESIS_OUTSIDE_ENVELOPE'))
  })

  // ═══ §5/§15 FALSE REJECT ELIMINATED ═══
  console.log('\n── §5/§15 FALSE REJECT ELIMINATED ──')
  await ta('§5 semantically-valid LINK_TEST without trigger words now PASSES', async () => {
    const c = envFor(OWNER)
    const r = await run(c, stubAI(linkTestDraft(c.env)))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.AI, 'must not be rejected: ' + JSON.stringify(r.meta.validatorBlockingReasonCodes))
  })
  t('§15 VALID_LINK_TEST_FALSE_REJECT_COUNT = 0 (card05 prose has no trigger words)', () => {
    const { env } = envFor(OWNER)
    const o = linkTestDraft(env)
    // The OLD lexical authority scanned CARD05 prose for literal trigger words.
    const c5 = [o.cards.card05.primary, o.cards.card05.supporting.join(' '), o.cards.card05.successSignal].join(' ')
    assert.ok(!/连接|连不连|用得上|用不上|同一个问题|目标方向|这条路/.test(c5), 'card05 prose must avoid all trigger words: ' + c5)
    const v = V.validateThesisV6(o, env)
    assert.strictEqual(v.valid, true, JSON.stringify(v.hardFailures))
  })

  // ═══ §7/§16 TRUE SAFETY STILL BLOCKS ═══
  console.log('\n── §7/§16 TRUE SAFETY STILL BLOCKS ──')
  const { env: OENV } = envFor(OWNER)
  const { env: UENV } = envFor(UNPROVEN)
  const mutations = [
    ['§7 fabricated customer fact', OENV, (o) => { o.cards.card02 = '你已经有稳定的付费客户。' }, 'FABRICATED_CUSTOMER_FACT'],
    ['§7 fabricated user history', OENV, (o) => { o.cards.card02 = '你一直靠接项目赚钱。' }, 'FABRICATED_USER_HISTORY'],
    ['§7 guaranteed outcome', OENV, (o) => { o.cards.card01 = '这个方向肯定能让你赚钱。' }, 'GUARANTEED_OUTCOME'],
    ['§7 invented exact price', OENV, (o) => { o.cards.card05.primary = '把服务定价299元试一次。' }, 'INVENTED_PRICE'],
    ['§7 no-primary bottleneck claim', OENV, (o) => { o.cards.card02 = '你真正的瓶颈就是不敢开始。' }, 'NO_PRIMARY_BOTTLENECK_CLAIM'],
    ['§16 UNPROVEN overreach via structured id', UENV, (o) => { o.strategicThesis.strategicMigration.id = 'TURN_ONE_SUCCESS_INTO_METHOD' }, 'MIGRATION_OUTSIDE_ENVELOPE'],
    ['§16 UNPROVEN overreach via prose (扩大/复制)', UENV, (o) => { o.cards.card04.to = '直接扩大现有能力并复制现有客户'; o.cards.card04.logic = '把现有服务标准化作为当前主路径。' }, 'UNPROVEN_PATH_OVERREACH']
  ]
  let caught = 0
  for (const [name, env, mutate, expect] of mutations) {
    const o = linkTestDraft(env); mutate(o)
    const v = V.validateThesisV6(o, env)
    const ok = v.blockingFailures.join(',').includes(expect)
    if (ok) caught++
    console.log('      ' + (ok ? '✓' : '✗') + ' ' + name + ' => ' + JSON.stringify(v.blockingFailures))
  }
  t('§7/§16 ALL TRUE-SAFETY MUTATIONS CAUGHT (' + caught + '/' + mutations.length + ')', () => assert.strictEqual(caught, mutations.length))

  // ═══ §8/§9/§10 PRODUCT-GRADE ENVELOPE FALLBACK ═══
  console.log('\n── §8/§9/§10 PRODUCT-GRADE ENVELOPE FALLBACK ──')
  await ta('§8 provider failure => THESIS_ENVELOPE_DETERMINISTIC_FALLBACK (not R53)', async () => {
    const c = envFor(OWNER)
    const r = await run(c, async () => ({ success: false, error: 'HTTP 503' }))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.strictEqual(r.meta.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    assert.ok(r.report && r.report.cards, 'complete report')
  })
  await ta('§20 VALID_ENVELOPE_TO_R53_FALLBACK_COUNT = 0', async () => {
    let r53 = 0; let checked = 0
    for (const [raw, tag] of [[OWNER, 'OWNER'], [UNPROVEN, 'UNPROVEN']]) {
      const c = envFor(raw); checked++
      const r = await run(c, async () => ({ success: false, error: 'x' }))
      if (r.renderSource === RENDER_SOURCE.FALLBACK) r53++
    }
    assert.strictEqual(r53, 0, r53 + ' valid-envelope cases shipped R53')
    assert.ok(checked >= 2)
  })
  t('§9 envelope fallback derives from the 5-card envelope semantics', () => {
    const c = envFor(OWNER)
    const rep = FB.buildEnvelopeFallbackReport(c.env, c.fb)
    assert.ok(rep.cards.fatalInsight.text && rep.cards.coreProblem.text)
    assert.strictEqual(rep.cards.systemLoop.steps.length, 4)
    assert.ok(rep.cards.turnaroundPath.from && rep.cards.turnaroundPath.to)
    assert.ok(rep.cards.firstAction.action && rep.cards.firstAction.target && rep.cards.firstAction.timebox && rep.cards.firstAction.done)
  })
  t('§9 envelope fallback invents NO new diagnosis (visible cards leak-free)', () => {
    const c = envFor(OWNER)
    const rep = FB.buildEnvelopeFallbackReport(c.env, c.fb)
    const s = cardsText(rep)
    assert.ok(!/瓶颈|DIRECTION_GAP|ACTION_GAP|NO_PRIMARY|LINK_TEST|envelope|ENVELOPE/.test(s), 'leak: ' + s)
  })
  t('§10 owner-class fallback materially stronger than R53 (no 两头都想兼顾 / 只验证一个问题)', () => {
    const c = envFor(OWNER)
    const rep = FB.buildEnvelopeFallbackReport(c.env, c.fb)
    const s = cardsText(rep)
    assert.ok(!/两头都想兼顾/.test(s), 'R53 CARD01 leaked')
    assert.ok(!/只验证一个问题/.test(s), 'R53 CARD04 leaked')
    assert.ok(!/愿不愿意再付一次/.test(s), 'R53 CARD05 willingness leak')
  })

  // ═══ §11 WORLD RULE ═══
  console.log('\n── §11 WORLD RULE ──')
  t('§11 fallback selects exactly ONE allowed world rule (deterministic)', () => {
    const c = envFor(OWNER)
    const rep1 = FB.buildEnvelopeFallbackReport(c.env, c.fb)
    const rep2 = FB.buildEnvelopeFallbackReport(c.env, c.fb)
    assert.strictEqual(rep1.cards.turnaroundPath.worldRuleLine, rep2.cards.turnaroundPath.worldRuleLine)
    assert.strictEqual(rep1.strategicThesis.worldRule.id, c.env.allowedWorldRules[0])
    assert.ok(c.env.allowedWorldRules.indexOf(rep1.strategicThesis.worldRule.id) !== -1)
  })

  // ═══ §12 REAL MIGRATION ═══
  console.log('\n── §12 REAL MIGRATION ──')
  t('§12 ENVELOPE_FALLBACK_REAL_MIGRATION_RATE = 100% (from + to both visible)', () => {
    let ok = 0, tot = 0
    for (const raw of [OWNER, UNPROVEN]) {
      const c = envFor(raw); tot++
      const rep = FB.buildEnvelopeFallbackReport(c.env, c.fb)
      const mig = c.env.allowedTargetPositions[0]
      const good = rep.cards.turnaroundPath.from === mig.from && rep.cards.turnaroundPath.to === mig.to &&
        rep.cards.turnaroundPath.from !== rep.cards.turnaroundPath.to &&
        !/只验证一个问题/.test(rep.cards.turnaroundPath.to)
      if (good) ok++
    }
    assert.strictEqual(ok, tot, ok + '/' + tot + ' real migrations')
  })

  // ═══ §13 COMMERCIAL EXPERIMENT ═══
  console.log('\n── §13 COMMERCIAL EXPERIMENT ──')
  t('§13 GENERIC_INTERVIEW_AS_DEFAULT = NO (LINK_TEST is behavioural)', () => {
    assert.strictEqual(FB.EXPERIMENT_COPY.LINK_TEST.primary.indexOf('愿不愿意') === -1, true)
    assert.ok(/付出真实代价|真的需要/.test(FB.EXPERIMENT_COPY.LINK_TEST.primary + FB.EXPERIMENT_COPY.LINK_TEST.successSignal))
  })
  t('§13 experimentClass -> deterministic experiment copy mapping covers all classes', () => {
    for (const ec of ['LINK_TEST', 'FIRST_PAID_PROOF', 'WILLINGNESS_TO_PAY', 'REPEAT', 'PATTERN', 'SYSTEMATIZE', 'BUYER_SIGNAL', 'SMALLEST_EXTERNAL_TEST', 'NARROW_DIRECTION', 'CONSISTENCY_CADENCE', 'CASHFLOW_SAFE_TEST']) {
      assert.ok(FB.EXPERIMENT_COPY[ec], 'missing experiment copy for ' + ec)
      assert.ok(FB.EXPERIMENT_COPY[ec].primary && FB.EXPERIMENT_COPY[ec].target && FB.EXPERIMENT_COPY[ec].timebox && FB.EXPERIMENT_COPY[ec].successSignal)
    }
  })
  t('§13 owner LINK_TEST fallback card05 aligned to experimentClass', () => {
    const c = envFor(OWNER)
    const rep = FB.buildEnvelopeFallbackReport(c.env, c.fb)
    assert.strictEqual(rep.strategicThesis.actionThesis.experimentClass, 'LINK_TEST')
    assert.strictEqual(rep.cards.firstAction.action, FB.EXPERIMENT_COPY.LINK_TEST.primary)
  })

  // ═══ §19 RENDER SOURCE OBSERVABILITY ═══
  console.log('\n── §19 RENDER SOURCE OBSERVABILITY ──')
  t('§19 three distinct renderSources', () => {
    assert.strictEqual(RENDER_SOURCE.AI, 'thesis_ai')
    assert.strictEqual(RENDER_SOURCE.ENVELOPE_FALLBACK, 'thesis_envelope_fallback')
    assert.strictEqual(RENDER_SOURCE.FALLBACK, 'deterministic_fallback')
  })
  await ta('§19 invalid JSON => envelope fallback, telemetry privacy-safe', async () => {
    const c = envFor(OWNER)
    const r = await run(c, stubText('not json {{{'))
    assert.strictEqual(r.renderSource, RENDER_SOURCE.ENVELOPE_FALLBACK)
    const m = JSON.stringify(r.meta)
    assert.ok(!/openid|occupation|ANSWER/.test(m))
  })
  await ta('§8 EVIDENCE_CONFLICT still uses R53 (0 calls, no product report)', async () => {
    const c = envFor(OWNER)
    c.out.diagnosis.compatibility = { verdict: 'EVIDENCE_CONFLICT', crossAxisScope: 'CONFLICT', conflictType: 'X', conflictingFields: [], recommendedReviewScreens: [] }
    let calls = 0
    const r = await runThesisReportRuntimeV6({ diagnosis: c.out.diagnosis, hybridProfile: c.out.hybridProfile, hybridContext: c.out.hybridContext, fallbackReport: buildReportV6(c.out.diagnosis, null), crossAxisScope: 'CONFLICT', callAI: async () => { calls++; return { success: true, content: '{}' } } })
    assert.strictEqual(calls, 0)
    assert.strictEqual(r.renderSource, RENDER_SOURCE.FALLBACK)
  })

  // ═══ §17 OWNER EXACT FALLBACK READBACK ═══
  console.log('\n── §17 OWNER EXACT ENVELOPE-FALLBACK READBACK ──')
  {
    const c = envFor(OWNER)
    const rep = FB.buildEnvelopeFallbackReport(c.env, c.fb)
    console.log('   01 ' + rep.cards.fatalInsight.text)
    console.log('   02 ' + rep.cards.coreProblem.text)
    console.log('   03 ' + rep.cards.systemLoop.steps.join(' / '))
    console.log('   04 ' + rep.cards.turnaroundPath.from + ' → ' + rep.cards.turnaroundPath.to)
    console.log('   05 ' + rep.cards.firstAction.action)
    t('§17 owner fallback: real FROM→TO + behavioural experiment present', () => {
      assert.strictEqual(rep.cards.turnaroundPath.from, c.env.allowedTargetPositions[0].from)
      assert.strictEqual(rep.cards.turnaroundPath.to, c.env.allowedTargetPositions[0].to)
      assert.ok(/付出真实代价|真的需要/.test(rep.cards.firstAction.action + rep.cards.firstAction.done))
    })
  }

  console.log('\n══════════════════════════════════════')
  console.log('R68 SEMANTIC VALIDATOR + PRODUCT FALLBACK: ' + pass + ' passed, ' + fail + ' failed')
  console.log('══════════════════════════════════════')
  if (fail) process.exitCode = 1
}

main()
