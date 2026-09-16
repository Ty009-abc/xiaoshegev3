'use strict'
/**
 * tests/v6/report/rc8.4-v6-r53-no-primary-cross-axis-scope.test.js
 *
 * RC8.4 V6 R53 — NO_PRIMARY CROSS-AXIS STRATEGY SCOPE (fail-closed).
 * Deterministic; no AI, no network, no deploy.
 *
 * MARKET PROOF establishes only that an asset has market evidence. It does NOT
 * establish that the asset is the correct path for the current desired change.
 * When the link can not be proven -> scope = UNPROVEN (fail closed), and the
 * NO_PRIMARY strategy must TEST THE LINK, never scale the proven asset.
 */

const assert = require('assert')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const H = require(path.join(CF, 'hybrid/index.js'))
const { buildReportV6, validateReportV6 } = require(path.join(CF, 'report/index.js'))
const NP = require(path.join(CF, 'report/noPrimaryReportV6.js'))
const CX = require(path.join(CF, 'hybrid/noPrimaryCrossAxisV6.js'))
const { diagnoseTurnaroundV6 } = require(path.join(CF, 'index.js'))
const { GOLDEN } = require(path.join(ROOT, 'tests/v6/fixtures.js'))
const VM = require(path.join(ROOT, 'utils/v6/turnaroundReportViewModelV6.js'))

let pass = 0, fail = 0
function t (name, fn) {
  try { fn(); pass++; console.log('   ✓ ' + name) }
  catch (e) { fail++; console.log('   ✗ ' + name + '\n     ' + (e && e.message)) }
}

function base (o) {
  return Object.assign({
    lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationDetail: '程序员',
    monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE',
    skillValidation: 'PROOF_STABLE', monetizableSkill: 'ASSET_TECHNICAL', weeklyTime: 'TIME_5_10',
    executionStability: 'EXEC_STABLE', pastAttemptStage: 'ATTEMPT_STABLE_SIDE', selfBelief: 'BELIEF_TRIED_NO_RESULT',
    decisionStyle: 'DECISION_WAIT_OTHERS', timeBehavior: 'TIME_BALANCE', primaryProblem: 'PROBLEM_CAREER_SWITCH',
    primaryGoal: 'GOAL_CAREER_SWITCH', maxTrialCost: 'COST_1K_5K', failureResponse: 'FAIL_RECHECK'
  }, o || {})
}
function build (raw) {
  const out = H.runHybridDiagnosisV6(raw)
  const rep = buildReportV6(out.diagnosis, out.hybridContext)
  return { out, rep, vm: VM.buildCardListV6(rep.cards) }
}

// ── Detectors ───────────────────────────────────────────────────────────
const SCALE_RE = /重复成交|再成交|固定下来|固定成标准|系统化|照着走|写成一步步|复制|扩大|设为主攻|主攻方向|再找1个同类/
const LINK_RE = /连接|能不能解决你这次|有没有直接关系|用不用得上|能不能用上|愿不愿意再付/
const LINK_IDS = ['TEST_LINK_TO_NEW_DIRECTION', 'TEST_INCREMENTAL_INCOME_LINK']
const INTERNAL_LEAK = [
  '没有单一瓶颈', '还没有单一瓶颈', '足够强的单一瓶颈', '暂时分不出主次', '分不出主次',
  'DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP', 'VALIDATION_GAP', 'REPEATABILITY_GAP',
  'STABLE_TRACTION', 'EARLY_TRACTION', 'TESTING', 'STARTED', 'evidenceCluster', 'NO_PRIMARY',
  'primaryBottleneck', '系统无法判断', '诊断不出来', 'LINK_TEST'
]
const PRIMARY_CLAIM = [
  '你一直没真正开始做', '你还没让任何一个方向活到被真实结果验证', '你在自己脑子里验证',
  '你靠一次运气拿到结果', '你一直停在准备里', '你以为缺的是', '真正卡住你的是“', '旧规则：', '新规则：'
]
function txt (rep) {
  const c = rep.cards || {}
  return [
    c.fatalInsight && c.fatalInsight.text,
    c.coreProblem && c.coreProblem.text,
    c.systemLoop && (c.systemLoop.steps || []).join('\n'),
    c.systemLoop && c.systemLoop.insight,
    c.turnaroundPath && c.turnaroundPath.from,
    c.turnaroundPath && c.turnaroundPath.to,
    c.turnaroundPath && c.turnaroundPath.worldRuleLine,
    c.firstAction && c.firstAction.action,
    c.firstAction && c.firstAction.done,
    c.firstAction && c.firstAction.decision
  ].filter(Boolean).join('\n')
}

console.log('\n── RC8.4 V6 R53 — NO_PRIMARY CROSS-AXIS SCOPE ──')

// ══════════════════════════════════════════════════════════════════
// §2/§3/§5 SCOPE SUPPORT + FAIL-CLOSED DEFAULT
// ══════════════════════════════════════════════════════════════════
console.log('\n   §3/§5 SCOPE SUPPORT + FAIL-CLOSED')
t('§3 NO_PRIMARY_CROSS_AXIS_SCOPE_SUPPORTED = YES', () => {
  const r = build(base({}))
  assert.strictEqual(r.rep.reportState, 'NO_PRIMARY')
  assert.ok(['COMPATIBLE', 'UNPROVEN'].includes(r.rep.crossAxisScope), 'scope=' + r.rep.crossAxisScope)
})
t('§5 UNKNOWN_SCOPE_DEFAULT = UNPROVEN (proven asset + unrelated problem)', () => {
  // paid proof + a genuinely unrelated problem -> cannot prove the link
  const combos = [
    ['PROBLEM_DEBT', 'GOAL_DEBT'], ['PROBLEM_FOCUS', 'GOAL_FIND_DIRECTION'],
    ['PROBLEM_SIDE_UNSTARTED', 'GOAL_SIDE_INCOME'], ['PROBLEM_OTHER', 'GOAL_FIND_DIRECTION']
  ]
  for (const [pp, gg] of combos) {
    const r = build(base({ primaryProblem: pp, primaryGoal: gg }))
    assert.strictEqual(r.rep.reportState, 'NO_PRIMARY', pp + ' state=' + r.rep.reportState)
    assert.strictEqual(r.rep.crossAxisScope, 'UNPROVEN', pp + ' must fail closed')
  }
})
t('§5 no proven asset -> COMPATIBLE (no link to prove; R51 progression applies)', () => {
  const r = build(base({ skillValidation: 'PROOF_NEVER', monetizableSkill: 'ASSET_UNCLEAR', primaryProblem: 'PROBLEM_CAREER_SWITCH' }))
  assert.strictEqual(r.rep.crossAxisScope, 'COMPATIBLE')
  assert.strictEqual(r.rep.provenAsset, false)
})
t('§4 pure function: evaluator is deterministic and exported', () => {
  assert.strictEqual(typeof CX.evaluateNoPrimaryCrossAxisScope, 'function')
  const a = CX.evaluateNoPrimaryCrossAxisScope({ marketValidated: true, primaryProblem: 'PROBLEM_CAREER_SWITCH' })
  const b = CX.evaluateNoPrimaryCrossAxisScope({ marketValidated: true, primaryProblem: 'PROBLEM_CAREER_SWITCH' })
  assert.strictEqual(a, 'UNPROVEN'); assert.strictEqual(a, b)
})

// ══════════════════════════════════════════════════════════════════
// §11 REPORT E — BEFORE (R52 overreach) vs AFTER
// ══════════════════════════════════════════════════════════════════
console.log('\n   §11 REPORT E (repeatable paid + career switch)')
function r52BeforeCard04 () { return '只验证一个问题：哪一部分流程值得固定下来？' }
function r52BeforeCard05 () { return '先从你「程序员」这个身份出发，今天把已经稳定成交的那套流程写成一步步的清单，拿给1个新人照着走一遍。' }
t('§11 R52_REPORT_E_OVERREACH_REPRODUCED_BEFORE = YES (frozen R52 output)', () => {
  assert.ok(SCALE_RE.test(r52BeforeCard04()), 'R52 CARD04 must exhibit the asset-scale overreach')
  assert.ok(SCALE_RE.test(r52BeforeCard05()), 'R52 CARD05 must exhibit the asset-scale overreach')
})
const E = build(base({}))
t('§11 R53_REPORT_E_PATH_OVERREACH_AFTER = NO', () => {
  assert.strictEqual(E.rep.reportState, 'NO_PRIMARY')
  assert.strictEqual(E.rep.crossAxisScope, 'UNPROVEN')
  const c4 = E.rep.cards.turnaroundPath.to
  const c5 = E.rep.cards.firstAction.action + ' ' + E.rep.cards.firstAction.decision
  assert.ok(!SCALE_RE.test(c4), 'CARD04 still scales the asset: ' + c4)
  assert.ok(!SCALE_RE.test(c5), 'CARD05 still scales the asset: ' + c5)
  assert.ok(LINK_RE.test(c4), 'CARD04 must test the link: ' + c4)
  assert.ok(LINK_RE.test(c5), 'CARD05 must test the link: ' + c5)
  assert.ok(LINK_IDS.includes(E.rep.nextUncertainty), 'nextU=' + E.rep.nextUncertainty)
})
t('§11 E five cards complete and leak-free', () => {
  assert.strictEqual(E.vm.length, 5)
  for (const p of INTERNAL_LEAK) assert.ok(!txt(E.rep).includes(p), 'leak: ' + p)
})
t('§11 E CARD02 states the asset FACT but adds no path inference', () => {
  const c2 = E.rep.cards.coreProblem.text
  assert.ok(/能重复付费的客户/.test(c2), 'fact required')
  assert.ok(/还没有被验证过/.test(c2), 'link caveat required')
  assert.ok(!/所以.*应该继续|就该卖|围绕这项能力/.test(c2))
})

// ══════════════════════════════════════════════════════════════════
// §12/§13 COMPATIBLE REPLAY + DIFFERENTIAL
// ══════════════════════════════════════════════════════════════════
console.log('\n   §12/§13 COMPATIBLE REPLAY + DIFFERENTIAL')
const C = build(base({ primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SKILL_MONETIZE' }))
t('§12 COMPATIBLE: repeat/systematize strategy remains valid', () => {
  assert.strictEqual(C.rep.reportState, 'NO_PRIMARY')
  assert.strictEqual(C.rep.crossAxisScope, 'COMPATIBLE')
  assert.ok(SCALE_RE.test(C.rep.cards.turnaroundPath.to + ' ' + C.rep.cards.firstAction.action), 'systematize expected')
})
let scopeDiff = 0
{
  const a = JSON.stringify(E.rep.cards)
  const b = JSON.stringify(C.rep.cards)
  if (a !== b) scopeDiff = 1
}
console.log('   NO_PRIMARY_SCOPE_STRATEGY_DIFF_COUNT = ' + scopeDiff)
t('§13 NO_PRIMARY_SCOPE_STRATEGY_DIFF_COUNT > 0 (same asset/proof, only desired change differs)', () => {
  assert.strictEqual(scopeDiff, 1, 'UNPROVEN and COMPATIBLE must yield different strategy')
})

// ══════════════════════════════════════════════════════════════════
// §14 BROAD REACHABILITY (exhaustive 288000) + §15 OVERREACH REGRESSION
// ══════════════════════════════════════════════════════════════════
console.log('\n   §14/§15 BROAD REACHABILITY + OVERREACH REGRESSION')
const OPTS = {
  pastAttemptStage: ['ATTEMPT_NONE', 'ATTEMPT_COURSE_ONLY', 'ATTEMPT_UNDER_30D', 'ATTEMPT_NO_SALE', 'ATTEMPT_FEW_SALES', 'ATTEMPT_STABLE_SIDE'],
  selfBelief: ['BELIEF_NO_DIRECTION', 'BELIEF_KNOW_NO_ACTION', 'BELIEF_TRIED_NO_RESULT', 'BELIEF_RESOURCE', 'BELIEF_TIME', 'BELIEF_FEAR', 'BELIEF_SWITCHING', 'BELIEF_ABILITY', 'BELIEF_FAMILY', 'BELIEF_OTHER'],
  timeBehavior: ['TIME_SHORT_FIRST', 'TIME_BALANCE', 'TIME_PROTECT_LONG', 'TIME_LONG_DROPS'],
  primaryProblem: ['PROBLEM_INCOME_STUCK', 'PROBLEM_NO_FUTURE', 'PROBLEM_DEBT', 'PROBLEM_CAREER_SWITCH', 'PROBLEM_SIDE_UNSTARTED', 'PROBLEM_MONETIZE', 'PROBLEM_FOCUS', 'PROBLEM_OTHER'],
  decisionStyle: ['DECISION_ALL_IN', 'DECISION_SMALL_TEST', 'DECISION_LEARN_FIRST', 'DECISION_WAIT_OTHERS', 'DECISION_AVOID'],
  failureResponse: ['FAIL_GIVE_UP', 'FAIL_SWITCH', 'FAIL_RECHECK', 'FAIL_ADD_MONEY', 'FAIL_UNSURE'],
  skillValidation: ['PROOF_NEVER', 'PROOF_FREE_THANKED', 'PROOF_FREE_HELPED', 'PROOF_PAID_ONCE', 'PROOF_OCCASIONAL', 'PROOF_STABLE']
}
const F = Object.keys(OPTS)
const PAID = new Set(['PROOF_PAID_ONCE', 'PROOF_OCCASIONAL', 'PROOF_STABLE'])
const DIVERGENT = new Set(['PROBLEM_CAREER_SWITCH', 'PROBLEM_NO_FUTURE'])
let npC = 0, npU = 0, c04Over = 0, c05Over = 0, c04Link = 0, c05Link = 0
let c02Over = 0, b1Mut = 0, npTotal = 0
let unprovenPaid = 0
function loop (i, cur) {
  if (i === F.length) {
    const out = H.runHybridDiagnosisV6(base(cur))
    const d = out.diagnosis
    if (d.diagnosisState !== 'NO_PRIMARY') return
    npTotal++
    const rep = buildReportV6(d, out.hybridContext)
    // B1 mutation guard: the report layer must not alter diagnosis authority.
    if (d.primaryBottleneck !== null) b1Mut++
    if (rep.reportState !== 'NO_PRIMARY') b1Mut++
    if (rep.crossAxisScope === 'UNPROVEN') npU++; else if (rep.crossAxisScope === 'COMPATIBLE') npC++
    const c4 = rep.cards.turnaroundPath.to
    const c5 = rep.cards.firstAction.action + ' ' + rep.cards.firstAction.decision
    const c2 = rep.cards.coreProblem.text
    const linkU = LINK_IDS.includes(rep.nextUncertainty)
    const paid = PAID.has(cur.skillValidation)
    const divergent = DIVERGENT.has(cur.primaryProblem)
    const unproven = rep.crossAxisScope === 'UNPROVEN'
    if (unproven) {
      if (!linkU) c04Over++ // UNPROVEN but not a link test = overreach
      if (SCALE_RE.test(c4)) c04Over++
      if (SCALE_RE.test(c5)) c05Over++
      if (/所以.*应该继续|就该卖|围绕这项能力/.test(c2)) c02Over++
      if (linkU) { c04Link++; if (LINK_RE.test(c5)) c05Link++ }
      if (paid && divergent) unprovenPaid++
    }
    return
  }
  for (const o of OPTS[F[i]]) { cur[F[i]] = o; loop(i + 1, cur) }
}
loop(0, {})
const c04LinkRate = npU ? Math.round(100 * c04Link / npU) : 0
const c05LinkRate = npU ? Math.round(100 * c05Link / npU) : 0
console.log('   NO_PRIMARY_TOTAL = ' + npTotal)
console.log('   NO_PRIMARY_COMPATIBLE_COUNT = ' + npC)
console.log('   NO_PRIMARY_UNPROVEN_COUNT = ' + npU)
console.log('   UNPROVEN_CARD04_PATH_OVERREACH_COUNT = ' + c04Over)
console.log('   UNPROVEN_CARD05_PATH_OVERREACH_COUNT = ' + c05Over)
console.log('   CARD02_UNPROVEN_PATH_INFERENCE_COUNT = ' + c02Over)
console.log('   UNPROVEN_CARD04_LINK_TEST_RATE = ' + c04LinkRate + '%')
console.log('   UNPROVEN_CARD05_LINK_EXPERIMENT_RATE = ' + c05LinkRate + '%')
console.log('   B1_MUTATION_COUNT = ' + b1Mut)

t('§14 NO_PRIMARY_UNPROVEN_COUNT > 0 (no longer collapses to COMPATIBLE)', () => {
  assert.ok(npU > 0, 'unproven=' + npU)
  assert.ok(npC > 0, 'compatible=' + npC)
})
t('§14 both scopes are reachable on the NO_PRIMARY path', () => {
  assert.ok(npC > 0 && npU > 0)
})
t('§15 UNPROVEN_CARD04_PATH_OVERREACH_COUNT = 0', () => assert.strictEqual(c04Over, 0))
t('§15 UNPROVEN_CARD05_PATH_OVERREACH_COUNT = 0', () => assert.strictEqual(c05Over, 0))
t('§6 CARD02_UNPROVEN_PATH_INFERENCE_COUNT = 0', () => assert.strictEqual(c02Over, 0))
t('§8 UNPROVEN_CARD04_LINK_TEST_RATE = 100%', () => assert.strictEqual(c04LinkRate, 100))
t('§9 UNPROVEN_CARD05_LINK_EXPERIMENT_RATE = 100%', () => assert.strictEqual(c05LinkRate, 100))
t('§16 B1_MUTATION_COUNT = 0', () => assert.strictEqual(b1Mut, 0))
t('§15 divergent+paid UNPROVEN cases are all link tests', () => {
  assert.ok(unprovenPaid > 0, 'expected reachable divergent+paid UNPROVEN cases, got ' + unprovenPaid)
})

// ══════════════════════════════════════════════════════════════════
// §10 COMPATIBLE CONTROL — R51 proof-stage behavior preserved
// ══════════════════════════════════════════════════════════════════
console.log('\n   §10 COMPATIBLE CONTROL — R51 PROGRESSION')
const PROOF_ORDER = ['PROOF_NEVER', 'PROOF_FREE_HELPED', 'PROOF_PAID_ONCE', 'PROOF_OCCASIONAL', 'PROOF_STABLE']
const EXPECTED = {
  PROOF_NEVER: 'WHICH_SKILL_TO_TEST',
  PROOF_FREE_HELPED: 'WILLINGNESS_TO_PAY',
  PROOF_PAID_ONCE: 'WHY_BOUGHT_AND_REPEAT',
  PROOF_OCCASIONAL: 'WHICH_CUSTOMER_REPEATS',
  PROOF_STABLE: 'WHICH_PART_TO_SYSTEMATIZE'
}
let preserved = 0
for (const pv of PROOF_ORDER) {
  const r = build(base({ skillValidation: pv, primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SKILL_MONETIZE' }))
  if (r.rep.crossAxisScope === 'COMPATIBLE' && r.rep.nextUncertainty === EXPECTED[pv]) preserved++
}
t('§10 COMPATIBLE_NO_PRIMARY_R51_BEHAVIOR_PRESERVED = YES (5/5 proof stages)', () => {
  assert.strictEqual(preserved, PROOF_ORDER.length, preserved + '/' + PROOF_ORDER.length)
})

// ══════════════════════════════════════════════════════════════════
// §17 EVIDENCE_CONFLICT REGRESSION
// ══════════════════════════════════════════════════════════════════
console.log('\n   §17 EVIDENCE_CONFLICT REGRESSION')
let conflictReg = 0
for (const stage of ['ATTEMPT_NO_SALE', 'ATTEMPT_FEW_SALES', 'ATTEMPT_COURSE_ONLY']) {
  for (const proof of ['PROOF_PAID_ONCE', 'PROOF_OCCASIONAL', 'PROOF_STABLE']) {
    const out = H.runHybridDiagnosisV6(base({ pastAttemptStage: stage, skillValidation: proof, primaryProblem: 'PROBLEM_MONETIZE', selfBelief: 'BELIEF_ABILITY' }))
    if (out.diagnosis.compatibility && out.diagnosis.compatibility.verdict === 'EVIDENCE_CONFLICT') {
      const rep = buildReportV6(out.diagnosis, out.hybridContext)
      if (rep.reportState !== 'EVIDENCE_CONFLICT' || rep.cards !== null) conflictReg++
    }
  }
}
console.log('   EVIDENCE_CONFLICT_REGRESSION_COUNT = ' + conflictReg)
t('§17 EVIDENCE_CONFLICT_REGRESSION_COUNT = 0', () => assert.strictEqual(conflictReg, 0))

// ══════════════════════════════════════════════════════════════════
// §18 PRIMARY PATH UNCHANGED
// ══════════════════════════════════════════════════════════════════
console.log('\n   §18 PRIMARY PATH UNCHANGED')
let primaryDiff = 0
const R53_NP_KEYS = ['crossAxisScope', 'provenAsset', 'evidenceClusters', 'nextUncertainty', 'proofStage', 'proofStageProgression']
for (const g of GOLDEN) {
  const d = diagnoseTurnaroundV6(g.answers)
  const rep = buildReportV6(d)
  if (rep.reportState !== 'PRIMARY') { primaryDiff++; continue }
  const v = validateReportV6(rep)
  if (!v.hasAllCards || v.cardCount !== 5 || v.forbiddenTokens.length) primaryDiff++
  for (const k of R53_NP_KEYS) if (k in rep) primaryDiff++
}
console.log('   PRIMARY_REPORT_DIFF_COUNT = ' + primaryDiff)
t('§18 PRIMARY_REPORT_DIFF_COUNT = 0', () => assert.strictEqual(primaryDiff, 0))

// ══════════════════════════════════════════════════════════════════
// §19 R51 FIRST-CLASS NO_PRIMARY PRESERVED
// ══════════════════════════════════════════════════════════════════
console.log('\n   §19 R51 FIRST-CLASS NO_PRIMARY PRESERVED')
let leak = 0, claim = 0, alignOk = 0, alignTot = 0
const readbacks = {
  A: base({ skillValidation: 'PROOF_OCCASIONAL', primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SKILL_MONETIZE', pastAttemptStage: 'ATTEMPT_FEW_SALES' }),
  B: base({ skillValidation: 'PROOF_PAID_ONCE', selfBelief: 'BELIEF_ABILITY', primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SKILL_MONETIZE', pastAttemptStage: 'ATTEMPT_FEW_SALES' }),
  C: base({ skillValidation: 'PROOF_NEVER', monetizableSkill: 'ASSET_UNCLEAR', selfBelief: 'BELIEF_NO_DIRECTION', primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SKILL_MONETIZE', pastAttemptStage: 'ATTEMPT_NONE', timeBehavior: 'TIME_PROTECT_LONG' }),
  D: base({ skillValidation: 'PROOF_OCCASIONAL', primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SKILL_MONETIZE', pastAttemptStage: 'ATTEMPT_FEW_SALES', decisionStyle: 'DECISION_WAIT_OTHERS' }),
  E: base({})
}
for (const k of Object.keys(readbacks)) {
  const r = build(readbacks[k])
  if (r.rep.reportState !== 'NO_PRIMARY') { leak++; continue }
  const s = txt(r.rep)
  for (const p of INTERNAL_LEAK) if (s.includes(p)) { leak++; break }
  for (const p of PRIMARY_CLAIM) if (s.includes(p)) { claim++; break }
  const c4 = r.rep.cards.turnaroundPath, c5 = r.rep.cards.firstAction
  if (c4.alignKey && c5.alignKey) { alignTot++; if (c4.alignKey === c5.alignKey) alignOk++ }
  const v = validateReportV6(r.rep)
  if (!v.hasAllCards || v.cardCount !== 5) leak++
}
const alignRate = alignTot ? Math.round(100 * alignOk / alignTot) : 0
console.log('   NO_PRIMARY_INTERNAL_STATE_LEAK_COUNT = ' + leak)
console.log('   NO_PRIMARY_PRIMARY_BOTTLENECK_CLAIM_COUNT = ' + claim)
console.log('   CARD04_CARD05_ALIGNMENT_RATE = ' + alignRate + '%')
t('§19 NO_PRIMARY_INTERNAL_STATE_LEAK_COUNT = 0', () => assert.strictEqual(leak, 0))
t('§19 NO_PRIMARY_PRIMARY_BOTTLENECK_CLAIM_COUNT = 0', () => assert.strictEqual(claim, 0))
t('§19 CARD04_CARD05_ALIGNMENT_RATE = 100%', () => assert.strictEqual(alignRate, 100))

// ══════════════════════════════════════════════════════════════════
// §20 NATIVE V6 REGRESSION
// ══════════════════════════════════════════════════════════════════
console.log('\n   §20 NATIVE V6 REGRESSION')
let nativeReg = 0
const NATIVE_NP = [
  { Q1: '31–40', Q2: '固定工资', Q3: '1000–5000元', Q4: '有能力，但不知道怎么变现', Q5: '能力还不够', Q6: '做过产品·服务，但没人买单', Q7: '再等等，信息更充分再说', Q8: '两边都会安排', Q9: '重新检查方法和步骤' },
  { Q1: '25–30', Q2: '自由职业 / 接单', Q3: '1000元以下', Q4: '收入一直上不去', Q5: '没时间', Q6: '已经有人愿意付钱', Q7: '先把可能的问题都想清楚', Q8: '固定给长期的事留时间', Q9: '再坚持一阵' }
]
for (const ans of NATIVE_NP) {
  const d = diagnoseTurnaroundV6(ans)
  const rep = buildReportV6(d)
  if (d.diagnosisState === 'NO_PRIMARY') {
    if (rep.reportState !== 'NO_PRIMARY') nativeReg++
    for (const p of INTERNAL_LEAK) if (txt(rep).includes(p)) { nativeReg++; break }
    if (!rep.cards || !rep.cards.fatalInsight || !rep.cards.firstAction) nativeReg++
  }
}
console.log('   NATIVE_V6_REGRESSION_COUNT = ' + nativeReg)
t('§20 NATIVE_V6_REGRESSION_COUNT = 0', () => assert.strictEqual(nativeReg, 0))

// ══════════════════════════════════════════════════════════════════
// §11/§12 FULL FIVE-CARD READBACKS
// ══════════════════════════════════════════════════════════════════
function dump (label, r) {
  console.log('\n   ═══ ' + label + ' (state=' + r.rep.reportState + ', scope=' + r.rep.crossAxisScope + ') ═══')
  if (r.vm.length !== 5) { console.log('   (non-five-card)'); return }
  console.log('   01 核心矛盾  : ' + r.vm[0].oneLiner)
  console.log('   02 现在的位置: ' + r.vm[1].body)
  console.log('   03 为什么会卡住:')
  for (const s of r.vm[2].loopNodes) console.log('      · ' + s)
  console.log('      = ' + r.vm[2].finalInsight)
  console.log('   04 现在: ' + r.vm[3].from)
  console.log('      接下来: ' + r.vm[3].to)
  console.log('   05 现在就做: ' + r.vm[4].primaryAction)
  console.log('      找谁: ' + r.vm[4].target + ' | 多久: ' + r.vm[4].timebox)
  console.log('      看什么: ' + r.vm[4].signal)
  console.log('      怎么用它: ' + r.vm[4].decision)
}
console.log('\n   ═══ §11/§12 FIVE-CARD READBACKS ═══')
dump('REPORT E — UNPROVEN (repeatable paid + career switch)', E)
dump('REPORT C — COMPATIBLE CONTROL (repeatable paid + monetize)', C)
dump('READBACK A', build(readbacks.A))
dump('READBACK B', build(readbacks.B))
dump('READBACK C', build(readbacks.C))
dump('READBACK D', build(readbacks.D))

console.log('\n══════════════════════════════════════')
console.log('R53 NO_PRIMARY CROSS-AXIS SCOPE: ' + pass + ' passed, ' + fail + ' failed')
console.log('══════════════════════════════════════')
if (fail) process.exitCode = 1
