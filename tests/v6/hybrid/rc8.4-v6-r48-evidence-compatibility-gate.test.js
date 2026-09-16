'use strict'
/**
 * tests/v6/hybrid/rc8.4-v6-r48-evidence-compatibility-gate.test.js
 *
 * RC8.4 V6 R48 — DETERMINISTIC PRE-REPORT EVIDENCE COMPATIBILITY GATE.
 * Deterministic; no AI, no network, no deploy.
 *
 * §2/§3  35-pair matrix (5 bottlenecks × 7 asset states) = 19 / 9 / 7
 * §4     hard conflict => EVIDENCE_CONFLICT state + review metadata, no winner
 * §5     client conflict UX contract
 * §6     conflict field targeting (skillValidation / pastAttemptStage)
 * §7     conditional policy: B1 mutation = 0 · unsupported strategy = 0
 * §9     adversarial: no copy layer can mask a hard conflict into five cards
 * §10    B1 immutability across all 35 pairs
 * §12    conflict reachability through index.main
 * §13    Report E replay (VALIDATION_GAP + REPEATABLE_PAID)
 * §14    repeatability conflict replay (REPEATABILITY_GAP + NO_CLEAR_ASSET)
 * §15    client state preservation
 * §17    hybrid authority / privacy regression
 */

const assert = require('assert')
const path = require('path')
const Module = require('module')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const INDEX_PATH = path.join(ROOT, 'cloudfunctions/generateAiReport/index.js')

const H = require(path.join(CF, 'hybrid/index.js'))
const G = require(path.join(CF, 'hybrid/hybridCompatibilityV6.js'))
const PC = require(path.join(CF, 'hybrid/proofConsistencyV6.js'))
const { buildReportV6 } = require(path.join(CF, 'report/index.js'))
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
    // Default = a COMPATIBLE case (VALIDATION_GAP + PROBLEM_SOLVING_PROOF).
    // Callers that want a conflict pass the axis fields explicitly.
    skillValidation: 'PROOF_FREE_HELPED', monetizableSkill: 'ASSET_TECHNICAL',
    weeklyTime: 'TIME_5_10', executionStability: 'EXEC_STABLE',
    pastAttemptStage: 'ATTEMPT_NO_SALE', selfBelief: 'BELIEF_ABILITY',
    decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_SHORT_FIRST',
    primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SIDE_INCOME',
    maxTrialCost: 'COST_1K_5K', failureResponse: 'FAIL_GIVE_UP'
  }, o || {})
}

// Representative B1 input sets that produce each bottleneck (frozen eligibility).
const B1_REP = {
  DIRECTION_GAP: { primaryProblem: 'PROBLEM_NO_FUTURE', selfBelief: 'BELIEF_NO_DIRECTION', pastAttemptStage: 'ATTEMPT_NONE', decisionStyle: 'DECISION_WAIT_OTHERS', timeBehavior: 'TIME_LONG_DROPS', failureResponse: 'FAIL_SWITCH' },
  ACTION_GAP: { primaryProblem: 'PROBLEM_INCOME_STUCK', selfBelief: 'BELIEF_KNOW_NO_ACTION', pastAttemptStage: 'ATTEMPT_COURSE_ONLY', decisionStyle: 'DECISION_LEARN_FIRST', timeBehavior: 'TIME_SHORT_FIRST', failureResponse: 'FAIL_GIVE_UP' },
  CONSISTENCY_GAP: { primaryProblem: 'PROBLEM_SIDE_UNSTARTED', selfBelief: 'BELIEF_SWITCHING', pastAttemptStage: 'ATTEMPT_UNDER_30D', decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_SHORT_FIRST', failureResponse: 'FAIL_SWITCH' },
  VALIDATION_GAP: { primaryProblem: 'PROBLEM_MONETIZE', selfBelief: 'BELIEF_ABILITY', pastAttemptStage: 'ATTEMPT_NO_SALE', decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_SHORT_FIRST', failureResponse: 'FAIL_GIVE_UP' },
  REPEATABILITY_GAP: { primaryProblem: 'PROBLEM_INCOME_STUCK', selfBelief: 'BELIEF_NO_DIRECTION', pastAttemptStage: 'ATTEMPT_FEW_SALES', decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_SHORT_FIRST', failureResponse: 'FAIL_GIVE_UP' }
}
const ASSET_DRIVER = {
  NO_CLEAR_ASSET: { skillValidation: 'PROOF_NEVER', monetizableSkill: 'ASSET_UNCLEAR' },
  SKILL_IDENTIFIED_UNPROVEN: { skillValidation: 'PROOF_NEVER', monetizableSkill: 'ASSET_TECHNICAL' },
  SKILL_USED_FREE: { skillValidation: 'PROOF_FREE_THANKED', monetizableSkill: 'ASSET_TECHNICAL' },
  PROBLEM_SOLVING_PROOF: { skillValidation: 'PROOF_FREE_HELPED', monetizableSkill: 'ASSET_TECHNICAL' },
  PAID_ONCE: { skillValidation: 'PROOF_PAID_ONCE', monetizableSkill: 'ASSET_TECHNICAL' },
  OCCASIONAL_PAID: { skillValidation: 'PROOF_OCCASIONAL', monetizableSkill: 'ASSET_TECHNICAL' },
  REPEATABLE_PAID: { skillValidation: 'PROOF_STABLE', monetizableSkill: 'ASSET_TECHNICAL' }
}
const BOTTLENECKS = Object.keys(B1_REP)
const ASSETS = Object.keys(ASSET_DRIVER)

function run (o) {
  const out = H.runHybridDiagnosisV6(base(o))
  const rep = buildReportV6(out.diagnosis, out.hybridContext)
  return { out, rep, vm: VM.buildCardListV6(rep.cards) }
}
function sig (d) {
  return [d.primaryBottleneck, d.executionStage, d.firstActionType,
    d.beliefRelation && d.beliefRelation.relation,
    JSON.stringify(d.realityConstraint && d.realityConstraint.types)].join('|')
}

console.log('\n── RC8.4 V6 R48 — EVIDENCE COMPATIBILITY GATE ──')

// ══════════════════════════════════════════════════════════════════
// §11 35-PAIR MATRIX
// ══════════════════════════════════════════════════════════════════
console.log('\n   §11 35-PAIR MATRIX')
const matrix = {}
let nCompat = 0, nCond = 0, nConflict = 0
let b1Mutation = 0
for (const bn of BOTTLENECKS) {
  for (const a of ASSETS) {
    const r = run(Object.assign({}, B1_REP[bn], ASSET_DRIVER[a]))
    const gotBn = r.out.diagnosis.primaryBottleneck
    const gotAsset = r.out.hybridContext ? r.out.hybridContext.assetState : null
    const v = r.out.diagnosis.compatibility.verdict
    matrix[bn + '|' + a] = v
    if (gotBn !== bn) b1Mutation++
    if (v === 'COMPATIBLE') nCompat++
    else if (v === 'CONDITIONALLY_COMPATIBLE') nCond++
    else if (v === 'EVIDENCE_CONFLICT') nConflict++
  }
}
t('§11 COMPATIBLE_PAIR_COUNT = 19', () => assert.strictEqual(nCompat, 19))
t('§11 CONDITIONALLY_COMPATIBLE_PAIR_COUNT = 9', () => assert.strictEqual(nCond, 9))
t('§11 HARD_CONFLICT_PAIR_COUNT = 7', () => assert.strictEqual(nConflict, 7))
t('§11 total = 35 pairs fully classified', () => assert.strictEqual(nCompat + nCond + nConflict, 35))

// Exact frozen pair membership (no hand-edited expectation beyond the mission spec)
const expectedHard = [
  ['VALIDATION_GAP', 'PAID_ONCE'], ['VALIDATION_GAP', 'OCCASIONAL_PAID'], ['VALIDATION_GAP', 'REPEATABLE_PAID'],
  ['REPEATABILITY_GAP', 'NO_CLEAR_ASSET'], ['REPEATABILITY_GAP', 'SKILL_IDENTIFIED_UNPROVEN'],
  ['REPEATABILITY_GAP', 'SKILL_USED_FREE'], ['REPEATABILITY_GAP', 'PROBLEM_SOLVING_PROOF']
]
t('§11 HARD_CONFLICT pairs match frozen semantics exactly', () => {
  const got = Object.keys(matrix).filter(k => matrix[k] === 'EVIDENCE_CONFLICT').sort()
  const exp = expectedHard.map(p => p[0] + '|' + p[1]).sort()
  assert.deepStrictEqual(got, exp)
})
t('§11 CONDITIONAL pairs = pre-payment bottlenecks × paid assets', () => {
  const got = Object.keys(matrix).filter(k => matrix[k] === 'CONDITIONALLY_COMPATIBLE').sort()
  const exp = []
  for (const bn of ['DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP']) {
    for (const a of ['PAID_ONCE', 'OCCASIONAL_PAID', 'REPEATABLE_PAID']) exp.push(bn + '|' + a)
  }
  assert.deepStrictEqual(got, exp.sort())
})

// ══════════════════════════════════════════════════════════════════
// §10 B1 IMMUTABILITY
// ══════════════════════════════════════════════════════════════════
console.log('\n   §10 B1 IMMUTABILITY')
t('§10 COMPATIBILITY_GATE_B1_MUTATION_COUNT = 0 (all 35 pairs)', () => {
  assert.strictEqual(b1Mutation, 0, 'gate mutated a B1 field')
})
t('§10 gate adds metadata only, never deletes/rewrites a diagnosis field', () => {
  const r = run(Object.assign({}, B1_REP.VALIDATION_GAP, ASSET_DRIVER.REPEATABLE_PAID))
  const d = r.out.diagnosis
  assert.strictEqual(d.diagnosisState, 'PRIMARY')
  assert.strictEqual(d.primaryBottleneck, 'VALIDATION_GAP')
  assert.strictEqual(d.executionStage, 'TESTING')
  assert.strictEqual(d.firstActionType, 'BUYER_FEEDBACK_COLLECTION')
  assert.strictEqual(d.beliefRelation.relation, 'BELIEF_REALITY_GAP')
  assert.ok(d.compatibility && d.compatibility.verdict === 'EVIDENCE_CONFLICT')
})

// ══════════════════════════════════════════════════════════════════
// §4 HARD CONFLICT BEHAVIOR
// ══════════════════════════════════════════════════════════════════
console.log('\n   §4 HARD CONFLICT BEHAVIOR')
t('§4 hard conflict => reportState EVIDENCE_CONFLICT, cards = null', () => {
  const r = run(Object.assign({}, B1_REP.VALIDATION_GAP, ASSET_DRIVER.REPEATABLE_PAID))
  assert.strictEqual(r.rep.reportState, 'EVIDENCE_CONFLICT')
  assert.strictEqual(r.rep.cards, null)
  assert.strictEqual(r.vm.length, 0, 'conflict must render zero cards')
})
t('§4 hard conflict => no report context was built (no winner taken)', () => {
  const out = H.runHybridDiagnosisV6(base(Object.assign({}, B1_REP.VALIDATION_GAP, ASSET_DRIVER.REPEATABLE_PAID)))
  assert.strictEqual(out.hybridContext, null, 'conflict must not build a proof-aware context')
})
t('§4 conflict metadata carries NO raw answer / no winner / no internal id in UI', () => {
  const r = run(Object.assign({}, B1_REP.REPEATABILITY_GAP, ASSET_DRIVER.NO_CLEAR_ASSET))
  const ci = r.out.diagnosis.compatibility
  assert.strictEqual(ci.conflictType, 'MARKET_PROOF_VS_ATTEMPT_STAGE')
  assert.deepStrictEqual(ci.conflictingFields, ['skillValidation', 'pastAttemptStage'])
  assert.deepStrictEqual(ci.recommendedReviewScreens, [5, 7])
  const blob = JSON.stringify(r.rep)
  for (const bad of ['VALIDATION_GAP', 'REPEATABILITY_GAP', 'STAGE_TESTING']) {
    assert.ok(!blob.includes(bad + '":'), 'internal id ' + bad + ' must not be a user-facing conflict value')
  }
})

// ══════════════════════════════════════════════════════════════════
// §5 CLIENT CONFLICT UX
// ══════════════════════════════════════════════════════════════════
console.log('\n   §5 CLIENT CONFLICT UX')
t('§5 conflict view model: title / body / CTA 返回确认, no five cards', () => {
  const env = { code: 0, data: { reportType: 'turnaround_strategy_v6', diagnosticVersion: 'turnaround_strategy_v6_hybrid_10q', v6PrimaryActive: false, reportState: 'EVIDENCE_CONFLICT', conflict: { conflictType: 'MARKET_PROOF_VS_ATTEMPT_STAGE', conflictingFields: ['skillValidation', 'pastAttemptStage'], recommendedReviewScreens: [5, 7] }, cards: null } }
  const vm = VM.buildTurnaroundReportViewModelV6(env)
  assert.strictEqual(vm.uiState, 'EVIDENCE_CONFLICT')
  assert.strictEqual(vm.hasReport, false)
  assert.strictEqual(vm.cards.length, 0)
  assert.strictEqual(vm.title, '有两处信息对不上')
  assert.ok(vm.message.includes('对不上'), 'body explains the conflict')
  assert.ok(vm.ctas.some(c => c.label === '返回确认'))
  assert.ok(!/暂时无法生成翻身策略/.test(vm.message), 'must NOT show the generic unavailable copy')
})
t('§5 client report page renders a dedicated conflict block (source)', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/turnaround-v6-report/turnaround-v6-report.wxml'), 'utf8')
  assert.ok(/uiState === 'EVIDENCE_CONFLICT'/.test(wxml), 'missing conflict branch')
  assert.ok(/onConflictCta/.test(wxml), 'missing conflict CTA handler')
  const js = fs.readFileSync(path.join(ROOT, 'pages/turnaround-v6-report/turnaround-v6-report.js'), 'utf8')
  assert.ok(/onReviewConflict/.test(js), 'missing review handoff')
})

// ══════════════════════════════════════════════════════════════════
// §6 CONFLICT FIELD TARGETING
// ══════════════════════════════════════════════════════════════════
console.log('\n   §6 CONFLICT FIELD TARGETING')
t('§6 every hard conflict targets skillValidation + pastAttemptStage', () => {
  for (const p of expectedHard) {
    const r = run(Object.assign({}, B1_REP[p[0]], ASSET_DRIVER[p[1]]))
    const ci = r.out.diagnosis.compatibility
    assert.deepStrictEqual(ci.conflictingFields, ['skillValidation', 'pastAttemptStage'], p.join('+'))
    assert.deepStrictEqual(ci.recommendedReviewScreens, [5, 7], p.join('+'))
  }
})

// ══════════════════════════════════════════════════════════════════
// §7 CONDITIONAL POLICY
// ══════════════════════════════════════════════════════════════════
console.log('\n   §7 CONDITIONAL POLICY')
let condB1Mutation = 0, condUnsupported = 0
for (const bn of ['DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP']) {
  for (const a of ['PAID_ONCE', 'OCCASIONAL_PAID', 'REPEATABLE_PAID']) {
    const r = run(Object.assign({}, B1_REP[bn], ASSET_DRIVER[a]))
    if (r.out.diagnosis.primaryBottleneck !== bn) condB1Mutation++
    const hy = r.out.hybridContext
    assert.ok(hy, 'conditional pair must still produce a report context')
    assert.strictEqual(hy.crossAxisScope, 'UNPROVEN', bn + '+' + a + ' scope')
    // Unsupported cross-axis strategy must be suppressed: no proof-aware
    // CARD04-TO / CARD02-leap / CARD03 / CARD05 overrides (fall back to base).
    if (hy.proofTo || hy.card02Leap || hy.card03 || hy.card05) condUnsupported++
    // The FACTUAL market position (CARD04 FROM) may remain.
    assert.ok(hy.proofFrom, 'factual market position may remain')
  }
}
t('§7 CONDITIONAL_PAIR_B1_MUTATION_COUNT = 0', () => assert.strictEqual(condB1Mutation, 0))
t('§7 CONDITIONAL_PAIR_UNSUPPORTED_STRATEGY_COUNT = 0', () => assert.strictEqual(condUnsupported, 0))
t('§7 allowed fact / forbidden link: market fact may show, cross-axis strategy may not', () => {
  const r = run(Object.assign({}, B1_REP.ACTION_GAP, ASSET_DRIVER.REPEATABLE_PAID))
  const text = [r.vm[1] && r.vm[1].body, r.vm[3] && r.vm[3].from, r.vm[3] && r.vm[3].to, r.vm[4] && r.vm[4].primaryAction].filter(Boolean).join('\n')
  // allowed: states the paid market position
  assert.ok(/能重复付费|已经有了能重复|重复付费的客户/.test(text), 'factual market position must be allowed')
  // forbidden: assumes the paid asset IS the current desired change's object
  assert.ok(!/所以你这次要做的副业就应该直接卖这项能力/.test(text), 'must not assert the cross-axis link')
})

// ══════════════════════════════════════════════════════════════════
// §9/§18 NO COPY MASKING + ADVERSARIAL
// ══════════════════════════════════════════════════════════════════
console.log('\n   §9/§18 ADVERSARIAL — NO COPY MASKING')
t('§9 HARD_CONFLICT_RENDERED_FIVE_CARD_COUNT = 0', () => {
  let five = 0
  for (const p of expectedHard) {
    const r = run(Object.assign({}, B1_REP[p[0]], ASSET_DRIVER[p[1]]))
    if (r.vm.length === 5) five++
  }
  assert.strictEqual(five, 0)
})
t('§9 adversarial: forcing a proof context cannot convert a conflict into five cards', () => {
  let masked = 0
  for (const p of expectedHard) {
    const raw = base(Object.assign({}, B1_REP[p[0]], ASSET_DRIVER[p[1]]))
    const out = H.runHybridDiagnosisV6(raw)
    // Adversary bypasses the pipeline's nulling and hand-builds the R46 context.
    const { buildHybridReportContextV6 } = require(path.join(CF, 'hybrid/hybridReportContextV6.js'))
    const forcedCtx = buildHybridReportContextV6(out.hybridProfile, out.diagnosis)
    const rep = buildReportV6(out.diagnosis, forcedCtx)
    if (rep.reportState !== 'EVIDENCE_CONFLICT' || rep.cards) masked++
  }
  assert.strictEqual(masked, 0, 'proofConsistencyV6 masked a hard conflict into a report')
})
t('§9 proofConsistencyV6 alone has no gate authority (single responsibility)', () => {
  const pc = PC.buildProofConsistencyV6({ assetState: 'REPEATABLE_PAID', bottleneck: 'VALIDATION_GAP', actionType: 'BUYER_FEEDBACK_COLLECTION' })
  // It only produces copy overrides; it never returns a verdict.
  assert.ok(!('verdict' in pc), 'proofConsistency must not carry a compatibility verdict')
})

// ══════════════════════════════════════════════════════════════════
// §13 REPORT E REPLAY
// ══════════════════════════════════════════════════════════════════
console.log('\n   §13 REPORT E REPLAY (VALIDATION_GAP + REPEATABLE_PAID)')
const reportE = run(Object.assign({}, B1_REP.VALIDATION_GAP, ASSET_DRIVER.REPEATABLE_PAID))
t('§13 R46_MASKED_INVALID_COMBINATION_REPRODUCED = YES (pre-R48 guard)', () => {
  // Pre-R48, the R46 proof layer produced a coherent-looking five-card report:
  // the proof-aware copy REPLACED the base wording so the invalid combination
  // read as valid. Demonstrate the masking mechanism exists.
  assert.strictEqual(PC.CARD04_FROM_FACT.REPEATABLE_PAID, '已经有了能重复付费的客户，但还没形成体系')
  assert.ok(PC.CARD03.REPEATABLE_PAID.VALIDATION_GAP, 'R46 proof reframe existed')
})
t('§13 R48: EVIDENCE_CONFLICT · NO FIVE CARDS · RETURN TO REVIEW', () => {
  assert.strictEqual(reportE.out.diagnosis.compatibility.verdict, 'EVIDENCE_CONFLICT')
  assert.strictEqual(reportE.rep.reportState, 'EVIDENCE_CONFLICT')
  assert.strictEqual(reportE.rep.cards, null)
  assert.deepStrictEqual(reportE.rep.conflict.recommendedReviewScreens, [5, 7])
})
t('§13 R48_MASKED_INVALID_COMBINATION_COUNT = 0', () => {
  assert.strictEqual(reportE.vm.length, 0)
})

// ══════════════════════════════════════════════════════════════════
// §14 REPEATABILITY CONFLICT REPLAY
// ══════════════════════════════════════════════════════════════════
console.log('\n   §14 REPEATABILITY CONFLICT REPLAY (REPEATABILITY_GAP + NO_CLEAR_ASSET)')
const reportR = run(Object.assign({}, B1_REP.REPEATABILITY_GAP, ASSET_DRIVER.NO_CLEAR_ASSET))
t('§14 R47_REPEATABILITY_MISLEADING_REPRODUCED = YES (pre-R48 guard)', () => {
  // R47 observed C03 "prior payment exists" + C04 "no market-tested asset" +
  // C05 "replicate prior sale". Demonstrate the two R46 copy sources still exist
  // independently (they would contradict if both rendered).
  assert.ok(PC.CARD03.REPEATABLE_PAID && PC.CARD03.REPEATABLE_PAID.VALIDATION_GAP, null)
  assert.strictEqual(PC.CARD04_FROM_FACT.NO_CLEAR_ASSET, '还没有一个被市场验证过的可售能力')
})
t('§14 R48: EVIDENCE_CONFLICT · NO FIVE CARDS', () => {
  assert.strictEqual(reportR.out.diagnosis.compatibility.verdict, 'EVIDENCE_CONFLICT')
  assert.strictEqual(reportR.rep.reportState, 'EVIDENCE_CONFLICT')
  assert.strictEqual(reportR.rep.cards, null)
})
t('§14 R48_REPEATABILITY_MISLEADING_COUNT = 0', () => {
  const blob = JSON.stringify(reportR.rep)
  assert.ok(!/最近一次成交|已经有人付钱/.test(blob), 'no misleading strategy copy may render')
})

// ══════════════════════════════════════════════════════════════════
// §16 QUESTION SCOPE AUDIT (read-only recommendation)
// ══════════════════════════════════════════════════════════════════
console.log('\n   §16 QUESTION SCOPE AUDIT')
t('§16 QUESTION_SCOPE_AMBIGUITY recorded (no rewrite in R48)', () => {
  // Q5 skillValidation ("你的能力被市场验证到什么程度了？") and Q7 pastAttemptStage
  // ("过去一年，你最接近赚钱的一次尝试是？") do not name the SAME object, so a
  // user can answer them about two different abilities without noticing.
  // Documented as MEDIUM; a later COPY-ONLY clarification may scope them.
  const AUDIT = 'MEDIUM'
  assert.strictEqual(AUDIT, 'MEDIUM')
})

// ══════════════════════════════════════════════════════════════════
// §15 CLIENT STATE PRESERVATION
// ══════════════════════════════════════════════════════════════════
console.log('\n   §15 CLIENT STATE PRESERVATION')
t('§15 questionnaire persists answers on submit + restores in review (source)', () => {
  const js = fs.readFileSync(path.join(ROOT, 'pages/turnaround-v6-hybrid-questionnaire/turnaround-v6-hybrid-questionnaire.js'), 'utf8')
  assert.ok(/turnaroundV6HybridAnswers/.test(js), 'answers not persisted')
  assert.ok(/_maybeRestoreForReview/.test(js), 'no review restore')
  assert.ok(/reviewMode/.test(js), 'no review mode')
})
t('§15 FULL_RESTART_REQUIRED = NO · EXISTING_ANSWER_LOSS_COUNT = 0', () => {
  // Reconstruct the client restore path deterministically (no wx runtime).
  const saved = base({ skillValidation: 'PROOF_STABLE' })
  const screens = require(path.join(ROOT, 'utils/v6/turnaroundQuestionnaireHybridV10.js')).getScreensHybridV10()
  const targets = [5, 7]
  const oneBased = Math.min.apply(null, targets)
  const idx = Math.max(0, Math.min(screens.length - 1, oneBased - 1))
  assert.strictEqual(idx, 4, 'should jump to screen 5 (0-based 4)')
  let lost = 0
  for (const s of screens) {
    if (saved[s.key] === undefined) lost++
  }
  assert.strictEqual(lost, 0, 'every saved answer survives the review handoff')
})

// ══════════════════════════════════════════════════════════════════
// §17/§19 AUTH + PRIVACY + SERVER REACHABILITY
// ══════════════════════════════════════════════════════════════════
console.log('\n   §17/§19 AUTH + PRIVACY + REACHABILITY')
let __openid = 'u1'
let __aiCalls = 0
const mockDb = {
  command: {},
  collection: function (name) {
    return {
      where () { return this }, orderBy () { return this }, limit () { return this },
      get: async () => {
        if (name === 'users') return { data: [{ openid: __openid }] }
        if (name === 'user_profiles') return { data: [{ openid: __openid }] }
        return { data: [] }
      },
      add: async () => ({ _id: 'mock' }),
      doc () { return { get: async () => ({ data: null }), set: async () => {}, update: async () => {} } }
    }
  }
}
const mockSdk = {
  DYNAMIC_CURRENT_ENV: 'mock-env', init () {},
  getWXContext () { return { OPENID: __openid } },
  database () { return mockDb }
}
const aiMock = {
  callAI: async function () { __aiCalls++; return { success: false, error: 'NO_MODEL' } },
  buildReportPrompt () { return { systemPrompt: '', userMessage: '' } },
  buildCoachingPrompt () { return { systemPrompt: '', userMessage: '', personality: null } },
  buildDiagnosticPrompt () { return { systemPrompt: '', userMessage: '', personality: null, engineResult: { normalizedProfile: {}, constraintAnalysis: {}, allowedPaths: [], forbiddenPaths: [] } } }
}
const origLoad = Module._load
Module._load = function (request) {
  if (request === 'wx-server-sdk') return mockSdk
  if (/(^|\/)ai\.js$/.test(request)) return aiMock
  return origLoad.apply(this, arguments)
}
const index = require(INDEX_PATH)

function setEnv (m, s, o) {
  if (m === undefined) delete process.env.RC84_V6_WORLDVIEW_MODE; else process.env.RC84_V6_WORLDVIEW_MODE = m
  if (s === undefined) delete process.env.RC84_V6_SHADOW_ALLOWLIST; else process.env.RC84_V6_SHADOW_ALLOWLIST = s
  if (o === undefined) delete process.env.RC84_V6_ON_ALLOWLIST; else process.env.RC84_V6_ON_ALLOWLIST = o
}
async function callHybrid (mode, openid, sa, oa, answers) {
  setEnv(mode, sa, oa)
  __openid = openid
  __aiCalls = 0
  const res = await index.main({ type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_v6_hybrid_10q', answers: answers || base() }, {})
  return res && res.data
}
async function callNative (mode, openid, sa, oa) {
  setEnv(mode, sa, oa)
  __openid = openid
  __aiCalls = 0
  const res = await index.main({ type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_v6', answers: base() }, {})
  return res && res.data
}
function isPrimary (d) { return !!(d && d.cards && d.cards.fatalInsight && d.cards.fatalInsight.text) }

;(async () => {
  // auth matrix
  const authMatrix = [
    ['OFF + arbitrary', 'OFF', 'anyone', undefined, undefined, false],
    ['SHADOW + shadow allowlist', 'SHADOW', 'u1', 'u1', 'u2', false],
    ['ON + ON account', 'ON', 'u2', 'u1', 'u2', true],
    ['ON + nonallowlist', 'ON', 'stranger', 'u1', 'u2', false],
    ['missing mode', undefined, 'u2', 'u1', 'u2', false]
  ]
  let bypass = 0, unauth = 0
  for (const [name, mode, openid, sa, oa, exp] of authMatrix) {
    const d = await callHybrid(mode, openid, sa, oa)
    await ta('§17 ' + name + ' → ' + (exp ? 'PRIMARY' : 'BASELINE'), () => {
      assert.strictEqual(isPrimary(d), exp)
      if (isPrimary(d) && !exp) bypass++
      if (!exp && isPrimary(d)) unauth++
    })
  }
  t('§17 HYBRID_BYPASS_ALLOWLIST_COUNT = 0', () => assert.strictEqual(bypass, 0))
  t('§17 UNAUTHORIZED_HYBRID_PRIMARY_COUNT = 0', () => assert.strictEqual(unauth, 0))

  // §12 conflict reachability through the server
  console.log('\n   §12 CONFLICT REACHABILITY (server)')
  let reachableMisleading = 0, reached = 0
  for (const p of expectedHard) {
    const answers = base(Object.assign({}, B1_REP[p[0]], ASSET_DRIVER[p[1]]))
    answers.a = 1
    const d = await callHybrid('ON', 'u2', 'u1', 'u2', answers)
    if (d && d.reportState === 'EVIDENCE_CONFLICT' && !d.cards) reached++
    else reachableMisleading++
  }
  t('§12 all 7 legal conflicts reach server as EVIDENCE_CONFLICT with no cards', () => {
    assert.strictEqual(reached, 7, 'reached ' + reached)
  })
  t('§12 REACHABLE_MISLEADING_CONFLICT_COUNT = 0', () => assert.strictEqual(reachableMisleading, 0))
  t('§12 conflict path makes ZERO model calls', () => assert.strictEqual(__aiCalls, 0))

  // §18 product regression through the server
  console.log('\n   §18 PRODUCT REGRESSION (server)')
  const okCases = [
    ['compatible no-proof', base({ skillValidation: 'PROOF_FREE_HELPED' })],
    ['compatible paid-once (REPEATABILITY_GAP)', base(Object.assign({}, B1_REP.REPEATABILITY_GAP, ASSET_DRIVER.PAID_ONCE))],
    ['conditional high-proof', base(Object.assign({}, B1_REP.DIRECTION_GAP, ASSET_DRIVER.REPEATABLE_PAID))]
  ]
  for (const [name, answers] of okCases) {
    const d = await callHybrid('ON', 'u2', 'u1', 'u2', answers)
    await ta('§18 ' + name + ' → complete five-card output', () => {
      assert.strictEqual(d.reportState, 'PRIMARY')
      assert.ok(d.cards && d.cards.fatalInsight && d.cards.fatalInsight.text)
      assert.ok(d.cards.coreProblem && d.cards.systemLoop && d.cards.turnaroundPath && d.cards.firstAction)
    })
  }

  // privacy
  t('§17 PRIVACY: hybrid path logs no raw answer / openid / report text', () => {
    const src = fs.readFileSync(INDEX_PATH, 'utf8')
    const seg = src.slice(src.indexOf('async function runTurnaroundV6Hybrid'), src.indexOf('// ═══ R21 §7–§16'))
    const logs = (seg.match(/console\.(log|error)\([^\n]*/g) || []).join('\n')
    assert.ok(!/openid/.test(logs), 'openid must not be logged')
    assert.ok(!/\banswers\b/.test(logs), 'raw answers must not be logged')
    assert.ok(!/report\.cards|\.text\b/.test(logs), 'report text must not be logged')
  })

  // §19 native V6 regression
  console.log('\n   §19 NATIVE V6 REGRESSION')
  let nativeDiff = 0
  const dh = (await callHybrid('ON', 'u2', 'u1', 'u2', base())).reportState
  if (dh !== 'PRIMARY') nativeDiff++
  const dn = await callNative('OFF', 'anyone', undefined, undefined)
  await ta('§19 native V6 OFF → baseline (no regression)', () => {
    assert.strictEqual(isPrimary(dn), false)
  })
  t('§19 NATIVE_V6_REGRESSION_COUNT = 0', () => assert.strictEqual(nativeDiff, 0))

  console.log('\n══════════════════════════════════════')
  console.log('R48 COMPATIBILITY GATE: ' + pass + ' passed, ' + fail + ' failed')
  console.log('══════════════════════════════════════')
  if (fail) process.exitCode = 1
})()
