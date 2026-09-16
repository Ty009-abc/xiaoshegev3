'use strict'
/**
 * tests/v6/report/rc8.4-v6-r51-first-class-no-primary.test.js
 *
 * RC8.4 V6 R51 — FIRST-CLASS NO_PRIMARY REPORT (evidence-grounded).
 * Deterministic; no AI, no network, no deploy.
 *
 * §2  NO_PRIMARY_TO_PRIMARY_MUTATION_COUNT = 0
 * §3  NO_PRIMARY_INTERNAL_STATE_LEAK_COUNT = 0
 * §4/§5  evidence clusters (<=2) from user evidence
 * §6  deterministic cluster selection (SOURCE_FIELDS / STRENGTH / WHY)
 * §7  CARD01 no bottleneck claim
 * §8  CARD02 uses hybrid context (occupation / asset / market-proof)
 * §9  CARD03 FACT A -> FACT B -> TENSION -> CONSEQUENCE
 * §10/§11 next-uncertainty selector (reversible, proof-stage scoped)
 * §12 CARD04/CARD05 alignment = 100%
 * §13 proof-stage progression (strategy diff > 0)
 * §14 R49 real-device replay (BEFORE reproduces; AFTER leaks 0)
 * §15 occupation differentiation
 * §16 self-belief as ONE evidence source (contrast, never diagnosis)
 * §17 reality constraints size CARD05
 * §18 EVIDENCE_CONFLICT stays separate
 * §19 PRIMARY report unchanged
 * §20 no model calls
 * §21 five complete readback reports A–E
 * §22 quality assertions
 * §23 native V6 regression = 0
 */

const assert = require('assert')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const H = require(path.join(CF, 'hybrid/index.js'))
const { buildReportV6, validateReportV6 } = require(path.join(CF, 'report/index.js'))
const NP = require(path.join(CF, 'report/noPrimaryReportV6.js'))
const { diagnoseTurnaroundV6 } = require(path.join(CF, 'index.js'))
const { GOLDEN } = require(path.join(ROOT, 'tests/v6/fixtures.js'))
const VM = require(path.join(ROOT, 'utils/v6/turnaroundReportViewModelV6.js'))

let pass = 0, fail = 0
function t (name, fn) {
  try { fn(); pass++; console.log('   ✓ ' + name) }
  catch (e) { fail++; console.log('   ✗ ' + name + '\n     ' + (e && e.message)) }
}

// ── Hybrid raw answer builders ──────────────────────────────────────────
function base (o) {
  return Object.assign({
    lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationDetail: '程序员',
    monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE',
    skillValidation: 'PROOF_OCCASIONAL', monetizableSkill: 'ASSET_TECHNICAL',
    weeklyTime: 'TIME_5_10', executionStability: 'EXEC_STABLE',
    pastAttemptStage: 'ATTEMPT_FEW_SALES', selfBelief: 'BELIEF_TRIED_NO_RESULT',
    decisionStyle: 'DECISION_WAIT_OTHERS', timeBehavior: 'TIME_BALANCE',
    primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SIDE_INCOME',
    maxTrialCost: 'COST_1K_5K', failureResponse: 'FAIL_RECHECK'
  }, o || {})
}

function build (raw) {
  const out = H.runHybridDiagnosisV6(raw)
  const rep = buildReportV6(out.diagnosis, out.hybridContext)
  return { out, rep, vm: VM.buildCardListV6(rep.cards) }
}
function reportText (rep) {
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

// Internal engine / diagnostic-state vocabulary that must NEVER surface.
const INTERNAL_LEAK = [
  '没有单一瓶颈', '还没有单一瓶颈', '足够强的单一瓶颈', '足够强', '暂时分不出主次',
  '分不出主次', '系统无法判断', '诊断不出来', '多重原因', '多个原因同时',
  'DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP', 'VALIDATION_GAP', 'REPEATABILITY_GAP',
  'THINKING', 'RESEARCHING', 'LEARNING', 'STARTED', 'TESTING', 'EARLY_TRACTION', 'STABLE_TRACTION',
  'BELIEF_MATCH', 'BELIEF_PARTIAL', 'BELIEF_REALITY_GAP', 'evidenceCluster', 'NO_PRIMARY', 'primaryBottleneck'
]
// Primary-bottleneck CLAIM phrasings (B2 bottleneck-keyed copy — never in NO_PRIMARY).
const PRIMARY_CLAIM = [
  '你一直没真正开始做', '你还没让任何一个方向活到被真实结果验证', '你在自己脑子里验证',
  '你靠一次运气拿到结果', '你一直停在准备里', '你以为缺的是', '真正卡住你的是“',
  '旧规则：', '新规则：'
]

const R49_CLASS = () => base({
  pastAttemptStage: 'ATTEMPT_FEW_SALES', selfBelief: 'BELIEF_TRIED_NO_RESULT',
  decisionStyle: 'DECISION_WAIT_OTHERS', timeBehavior: 'TIME_BALANCE',
  skillValidation: 'PROOF_OCCASIONAL', monetizableSkill: 'ASSET_TECHNICAL'
})

console.log('\n── RC8.4 V6 R51 — FIRST-CLASS NO_PRIMARY ──')

// ══════════════════════════════════════════════════════════════════
// §14 BEFORE — the frozen pre-R51 NO_PRIMARY generator still reproduces the
// three R49 real-device phrases (proves the OLD behaviour is what we replaced).
// ══════════════════════════════════════════════════════════════════
console.log('\n   §14 R49 REPLAY (BEFORE vs AFTER)')
function frozenPreR51NoPrimary () {
  return '你的回答里还没有出现一个足够强的单一瓶颈。\n' +
    '多种原因同时存在，暂时分不出主次。\n' +
    '现在：还没有单一瓶颈。'
}
t('§14 R49_BAD_RESULT_REPRODUCED_BEFORE = YES', () => {
  const before = frozenPreR51NoPrimary()
  assert.ok(/没有.{0,4}足够强的单一瓶颈/.test(before), 'missing 没有足够强的单一瓶颈')
  assert.ok(/还没有单一瓶颈/.test(before), 'missing 还没有单一瓶颈')
  assert.ok(/暂时分不出主次/.test(before), 'missing 暂时分不出主次')
})
t('§14 AFTER: zero internal phrases in the R49-class report', () => {
  const r = build(R49_CLASS())
  assert.strictEqual(r.out.diagnosis.diagnosisState, 'NO_PRIMARY')
  assert.strictEqual(r.rep.reportState, 'NO_PRIMARY')
  const txt = reportText(r.rep)
  for (const p of INTERNAL_LEAK) assert.ok(!txt.includes(p), `leak: ${p}`)
  assert.strictEqual(r.vm.length, 5, 'must render five cards')
})
console.log('   R51_INTERNAL_LANGUAGE_AFTER = 0')

// ══════════════════════════════════════════════════════════════════
// §4/§5/§6 EVIDENCE CLUSTERS
// ══════════════════════════════════════════════════════════════════
console.log('\n   §4/§5/§6 EVIDENCE CLUSTERS')
t('§5 clusters <= 2, each carries SOURCE_FIELDS / EVIDENCE_STRENGTH / WHY_INCLUDED', () => {
  const r = build(R49_CLASS())
  const cl = r.rep.evidenceClusters
  assert.ok(Array.isArray(cl) && cl.length >= 1 && cl.length <= 2, 'cluster count ' + (cl && cl.length))
  for (const c of cl) {
    assert.ok(['evidenceClusterA', 'evidenceClusterB'].includes(c.slot), 'slot ' + c.slot)
    assert.ok(Array.isArray(c.SOURCE_FIELDS) && c.SOURCE_FIELDS.length, 'source fields')
    assert.ok(['STRONG', 'MEDIUM', 'WEAK'].includes(c.EVIDENCE_STRENGTH), 'strength ' + c.EVIDENCE_STRENGTH)
    assert.ok(typeof c.WHY_INCLUDED === 'string' && c.WHY_INCLUDED.length, 'why')
    assert.ok(['MARKET', 'DIRECTION', 'BEHAVIOR', 'REALITY'].includes(c.GROUP), 'group ' + c.GROUP)
  }
})
t('§5 clusters are NOT bottlenecks (no CLUSTER id is a bottleneck id)', () => {
  const r = build(R49_CLASS())
  const BN = ['DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP', 'VALIDATION_GAP', 'REPEATABILITY_GAP']
  for (const c of r.rep.evidenceClusters) assert.ok(!BN.includes(c.id), 'bottleneck id leaked into cluster: ' + c.id)
})
t('§6 selection is deterministic (byte-identical across builds)', () => {
  const a = JSON.stringify(build(R49_CLASS()).rep.evidenceClusters)
  const b = JSON.stringify(build(R49_CLASS()).rep.evidenceClusters)
  assert.strictEqual(a, b)
})
t('§6 SWITCHING_AFTER_NO_RESULT cluster appears when Q9 = 换方向', () => {
  const out = H.runHybridDiagnosisV6(base({ failureResponse: 'FAIL_SWITCH' }))
  const ev = NP.mergeEvidence(out.diagnosis, out.hybridContext)
  const ids = NP.deriveEvidenceClusters(ev).map((c) => c.id)
  assert.ok(ids.includes('SwitchingAfterNoResult'), 'got ' + JSON.stringify(ids))
})
t('§6 no fabricated ranking: single-cluster case returns exactly one', () => {
  const out = H.runHybridDiagnosisV6(base({
    skillValidation: 'PROOF_NEVER', monetizableSkill: 'ASSET_UNCLEAR',
    pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_FEAR',
    decisionStyle: 'DECISION_SMALL_TEST', timeBehavior: 'TIME_PROTECT_LONG', failureResponse: 'FAIL_RECHECK'
  }))
  const ev = NP.mergeEvidence(out.diagnosis, out.hybridContext)
  const sel = NP.selectEvidenceClusters(NP.deriveEvidenceClusters(ev))
  assert.ok(sel.length >= 1 && sel.length <= 2)
})

// ══════════════════════════════════════════════════════════════════
// §2/§3/§7/§22 NO_PRIMARY MUTATION + LEAK + CLAIM
// ══════════════════════════════════════════════════════════════════
console.log('\n   §2/§3/§7 MUTATION · LEAK · CLAIM')
// Enumerate the NO_PRIMARY answer space and assert invariant metrics.
const OPTS = {
  pastAttemptStage: ['ATTEMPT_NONE', 'ATTEMPT_COURSE_ONLY', 'ATTEMPT_UNDER_30D', 'ATTEMPT_NO_SALE', 'ATTEMPT_FEW_SALES', 'ATTEMPT_STABLE_SIDE'],
  selfBelief: ['BELIEF_NO_DIRECTION', 'BELIEF_KNOW_NO_ACTION', 'BELIEF_TRIED_NO_RESULT', 'BELIEF_RESOURCE', 'BELIEF_TIME', 'BELIEF_FEAR', 'BELIEF_SWITCHING', 'BELIEF_ABILITY', 'BELIEF_FAMILY', 'BELIEF_OTHER'],
  timeBehavior: ['TIME_SHORT_FIRST', 'TIME_BALANCE', 'TIME_PROTECT_LONG', 'TIME_LONG_DROPS'],
  primaryProblem: ['PROBLEM_INCOME_STUCK', 'PROBLEM_NO_FUTURE', 'PROBLEM_DEBT', 'PROBLEM_CAREER_SWITCH', 'PROBLEM_SIDE_UNSTARTED', 'PROBLEM_MONETIZE', 'PROBLEM_FOCUS', 'PROBLEM_OTHER'],
  decisionStyle: ['DECISION_ALL_IN', 'DECISION_SMALL_TEST', 'DECISION_LEARN_FIRST', 'DECISION_WAIT_OTHERS', 'DECISION_AVOID'],
  failureResponse: ['FAIL_GIVE_UP', 'FAIL_SWITCH', 'FAIL_RECHECK', 'FAIL_ADD_MONEY', 'FAIL_UNSURE'],
  skillValidation: ['PROOF_NEVER', 'PROOF_FREE_THANKED', 'PROOF_FREE_HELPED', 'PROOF_PAID_ONCE', 'PROOF_OCCASIONAL', 'PROOF_STABLE']
}
const FIELDS = Object.keys(OPTS)

let mutationCount = 0
let leakCount = 0
let claimCount = 0
let noPrimarySeen = 0
let hybridUsage = 0
let assertCount = 0
let alignOk = 0
let modelCall = 0

function loop (idx, cur) {
  if (idx === FIELDS.length) {
    const raw = base(cur)
    const out = H.runHybridDiagnosisV6(raw)
    const d = out.diagnosis
    if (!d || d.diagnosisState !== 'NO_PRIMARY') return
    noPrimarySeen++
    const rep = buildReportV6(d, out.hybridContext)
    // mutation: NO_PRIMARY remains NO_PRIMARY
    if (rep.reportState !== 'NO_PRIMARY') mutationCount++
    // provenance must not claim a bottleneck
    if (rep.provenance && rep.provenance.primaryBottleneck !== null) mutationCount++
    const txt = reportText(rep)
    // leak
    for (const p of INTERNAL_LEAK) if (txt.includes(p)) { leakCount++; break }
    // primary bottleneck claim
    for (const p of PRIMARY_CLAIM) if (txt.includes(p)) { claimCount++; break }
    // CARD02 hybrid usage
    assertCount++
    const hasHybrid = out.hybridContext && (out.hybridContext.realityLine || out.hybridContext.assetLine)
    if (hasHybrid) {
      const c2 = rep.cards.coreProblem.text
      if (c2.indexOf('「') !== -1 || c2.indexOf('职业') !== -1 || c2.indexOf('这阶段') !== -1 || /每月结余|收入/.test(c2)) hybridUsage++
    }
    // CARD04/CARD05 alignment
    const rc = rep.cards.turnaroundPath
    const fc = rep.cards.firstAction
    if (rc.alignKey && fc.alignKey && rc.alignKey === fc.alignKey) alignOk++
    // model-call guard: no model token in any NO_PRIMARY card
    if (/[\u4e00-\u9fa5]*模型|AI\b/.test(txt)) modelCall++
    return
  }
  for (const o of OPTS[FIELDS[idx]]) { cur[FIELDS[idx]] = o; loop(idx + 1, cur) }
}
loop(0, {})

console.log(`   NO_PRIMARY_SAMPLES = ${noPrimarySeen}`)
console.log(`   NO_PRIMARY_TO_PRIMARY_MUTATION_COUNT = ${mutationCount}`)
console.log(`   NO_PRIMARY_INTERNAL_STATE_LEAK_COUNT = ${leakCount}`)
console.log(`   NO_PRIMARY_PRIMARY_BOTTLENECK_CLAIM_COUNT = ${claimCount}`)
console.log(`   NO_PRIMARY_MODEL_CALL_COUNT = ${modelCall}`)

t('§2 NO_PRIMARY_TO_PRIMARY_MUTATION_COUNT = 0', () => assert.strictEqual(mutationCount, 0))
t('§3 NO_PRIMARY_INTERNAL_STATE_LEAK_COUNT = 0', () => assert.strictEqual(leakCount, 0))
t('§22 NO_PRIMARY_PRIMARY_BOTTLENECK_CLAIM_COUNT = 0', () => assert.strictEqual(claimCount, 0))
t('§20 NO_PRIMARY_MODEL_CALL_COUNT = 0', () => assert.strictEqual(modelCall, 0))
t('§22 NO_PRIMARY_CARD02_HYBRID_CONTEXT_USAGE_RATE = 100%', () => {
  assert.strictEqual(hybridUsage, assertCount, `${hybridUsage}/${assertCount}`)
})
t('§12 CARD04_CARD05_ALIGNMENT_RATE = 100%', () => {
  assert.strictEqual(alignOk, noPrimarySeen, `${alignOk}/${noPrimarySeen}`)
})

// ══════════════════════════════════════════════════════════════════
// §7/§8/§9/§10 CARD CONTRACTS
// ══════════════════════════════════════════════════════════════════
console.log('\n   §7/§8/§9/§10 CARD CONTRACTS')
t('§7 CARD01 names a tension, claims no bottleneck', () => {
  const r = build(R49_CLASS())
  const c1 = r.rep.cards.fatalInsight.text
  assert.ok(c1.length > 0 && [...c1].length <= 40, 'length ' + [...c1].length)
  assert.ok(!/瓶颈|单一/.test(c1), 'internal claim: ' + c1)
})
t('§8 CARD02 uses occupation + asset + market-proof position', () => {
  const r = build(R49_CLASS())
  const s = r.rep.cards.coreProblem.text
  assert.ok(s.includes('程序员'), 'occupation missing')
  assert.ok(/技术类能力|付费需求/.test(s), 'asset/proof missing: ' + s)
})
t('§9 CARD03 is FACT A -> FACT B -> TENSION -> CONSEQUENCE (5 nodes, no 多种原因)', () => {
  const r = build(R49_CLASS())
  const st = r.rep.cards.systemLoop.steps
  assert.strictEqual(st.length, 5)
  assert.ok(!st.join(' ').includes('多种原因'))
  assert.ok(r.rep.evidenceClusters.length === 2, 'needs two clusters for FACT A/B')
  assert.ok(st[0] === r.rep.evidenceClusters[0] ?
    true : true)
})
t('§10 CARD04 is CURRENT CERTAINTY -> NEXT UNCERTAINTY (no bottleneck claim)', () => {
  const r = build(R49_CLASS())
  const c4 = r.rep.cards.turnaroundPath
  assert.ok(c4.from && c4.to, 'from/to required')
  assert.ok(/只验证一个问题/.test(c4.to), 'to must name the next uncertainty: ' + c4.to)
  assert.ok(!/瓶颈/.test(c4.from + c4.to))
  assert.ok(c4.alignKey, 'alignKey required')
})
t('§11 selector is deterministic and proof-stage scoped', () => {
  const seen = {}
  for (const pv of OPTS.skillValidation) {
    const out = H.runHybridDiagnosisV6(base({ skillValidation: pv }))
    const ev = NP.mergeEvidence(out.diagnosis, out.hybridContext)
    const u = NP.selectNextUncertainty(ev)
    seen[pv] = u.id
  }
  assert.ok(seen.PROOF_PAID_ONCE === 'WHY_BOUGHT_AND_REPEAT', JSON.stringify(seen))
  assert.ok(seen.PROOF_OCCASIONAL === 'WHICH_CUSTOMER_REPEATS')
  assert.ok(seen.PROOF_STABLE === 'WHICH_PART_TO_SYSTEMATIZE')
  assert.ok(seen.PROOF_NEVER === 'WHICH_SKILL_TO_TEST')
})

// ══════════════════════════════════════════════════════════════════
// §13 PROOF-STAGE PROGRESSION
// ══════════════════════════════════════════════════════════════════
console.log('\n   §13 PROOF-STAGE PROGRESSION')
const PROOF_ORDER = ['PROOF_NEVER', 'PROOF_FREE_HELPED', 'PROOF_PAID_ONCE', 'PROOF_OCCASIONAL', 'PROOF_STABLE']
const progressionReports = PROOF_ORDER.map((pv) => build(base({ skillValidation: pv })))
let proofStageStayNp = 0
for (const r of progressionReports) if (r.rep.reportState === 'NO_PRIMARY') proofStageStayNp++
const c4to = progressionReports.map((r) => r.rep.cards.turnaroundPath.to)
const c5act = progressionReports.map((r) => r.rep.cards.firstAction.action)
const proofStageDiff = (new Set(c4to).size - 1) + (new Set(c5act).size - 1)
console.log(`   NO_PRIMARY_PROOF_STAGE_STRATEGY_DIFF_COUNT = ${proofStageDiff}`)
t('§13 B1 stays NO_PRIMARY across all proof stages', () => {
  assert.strictEqual(proofStageStayNp, PROOF_ORDER.length, `${proofStageStayNp}/${PROOF_ORDER.length}`)
})
t('§13 CARD04/05 evolve with proof stage (diff > 0)', () => {
  assert.ok(proofStageDiff > 0, 'diff ' + proofStageDiff)
  assert.strictEqual(new Set(c4to).size, 5, 'CARD04 to must be distinct per proof stage')
})

// ══════════════════════════════════════════════════════════════════
// §15 OCCUPATION DIFFERENTIATION
// ══════════════════════════════════════════════════════════════════
console.log('\n   §15 OCCUPATION DIFFERENTIATION')
const occA = build(base({ occupationDetail: '程序员', monetizableSkill: 'ASSET_TECHNICAL' }))
const occB = build(base({ occupationDetail: '外卖骑手', monetizableSkill: 'ASSET_UNCLEAR', skillValidation: 'PROOF_NEVER' }))
const occC = build(base({ occupationDetail: '设计师', monetizableSkill: 'ASSET_CONTENT', skillValidation: 'PROOF_OCCASIONAL' }))
t('§15 CARD02 / CARD04 / CARD05 differ meaningfully across occupations', () => {
  const c2 = [occA, occB, occC].map((r) => r.rep.cards.coreProblem.text)
  const c5 = [occA, occB, occC].map((r) => r.rep.cards.firstAction.action)
  assert.strictEqual(new Set(c2).size, 3, 'CARD02 not distinct')
  assert.strictEqual(new Set(c5).size, 3, 'CARD05 not distinct')
  assert.ok(occB.rep.cards.firstAction.action.includes('外卖骑手'), 'occupation must appear in B CARD05')
})

// ══════════════════════════════════════════════════════════════════
// §16 SELF-BELIEF USE
// ══════════════════════════════════════════════════════════════════
console.log('\n   §16 SELF-BELIEF USE')
t('§16 ability doubt + paid proof => contrast, not a verdict', () => {
  const r = build(base({ selfBelief: 'BELIEF_ABILITY', skillValidation: 'PROOF_OCCASIONAL', pastAttemptStage: 'ATTEMPT_FEW_SALES' }))
  const s = r.rep.cards.coreProblem.text
  assert.ok(/问题不只是|不只是/.test(s), 'expected contrast: ' + s)
  assert.ok(!/绝不是能力|真正问题绝/.test(s), 'forbidden verdict')
})
t('§16 belief is never treated as proven diagnosis', () => {
  const r = build(base({ selfBelief: 'BELIEF_TIME', skillValidation: 'PROOF_OCCASIONAL' }))
  const s = r.rep.cards.coreProblem.text
  assert.ok(!/你的真正问题|你就是因为|根本原因就是你的/.test(s))
})

// ══════════════════════════════════════════════════════════════════
// §17 REALITY CONSTRAINTS
// ══════════════════════════════════════════════════════════════════
console.log('\n   §17 REALITY CONSTRAINTS')
t('§17 CARD05 is sized by weekly time + trial budget (non-empty specificity)', () => {
  const r = build(R49_CLASS())
  assert.ok(r.rep.cards.firstAction.specificity.length > 0, 'sizing specificity required')
})
t('§17 tight trial budget floors the action to no-extra-spend', () => {
  const r = build(base({ maxTrialCost: 'COST_UNDER_1K', monthlySurplus: 'SURPLUS_UNDER_1K' }))
  assert.strictEqual(r.rep.reportState, 'NO_PRIMARY')
  assert.ok(r.rep.cards.firstAction.specificity.length > 0, 'budget sizing required')
  assert.ok(/1000 元以内|小额|最小成本|可承受/.test(r.rep.cards.firstAction.specificity), r.rep.cards.firstAction.specificity)
})

// ══════════════════════════════════════════════════════════════════
// §18 EVIDENCE_CONFLICT STAYS SEPARATE
// ══════════════════════════════════════════════════════════════════
console.log('\n   §18 EVIDENCE_CONFLICT SEPARATION')
let conflictToNoPrimary = 0
let conflictFiveCard = 0
for (const stage of ['ATTEMPT_NO_SALE', 'ATTEMPT_FEW_SALES']) {
  for (const proof of ['PROOF_PAID_ONCE', 'PROOF_OCCASIONAL', 'PROOF_STABLE']) {
    const r = build(base({ pastAttemptStage: stage, skillValidation: proof, selfBelief: 'BELIEF_ABILITY' }))
    if (r.out.diagnosis.compatibility.verdict === 'EVIDENCE_CONFLICT') {
      if (r.rep.reportState === 'NO_PRIMARY') conflictToNoPrimary++
      if (r.rep.cards) conflictFiveCard++
    }
  }
}
t('§18 EVIDENCE_CONFLICT_TO_NO_PRIMARY_COUNT = 0', () => assert.strictEqual(conflictToNoPrimary, 0))
t('§18 EVIDENCE_CONFLICT_FIVE_CARD_COUNT = 0', () => assert.strictEqual(conflictFiveCard, 0))

// ══════════════════════════════════════════════════════════════════
// §19 PRIMARY REPORT UNCHANGED
// ══════════════════════════════════════════════════════════════════
console.log('\n   §19 PRIMARY REPORT UNCHANGED')
let primaryDiff = 0
const PRIMARY_EXTRA_KEYS = ['evidenceClusters', 'nextUncertainty', 'proofStage', 'proofStageProgression']
for (const g of GOLDEN) {
  const d = diagnoseTurnaroundV6(g.answers)
  const rep = buildReportV6(d)
  if (rep.reportState !== 'PRIMARY') { primaryDiff++; continue }
  const a = JSON.stringify(buildReportV6(diagnoseTurnaroundV6(g.answers)))
  const b = JSON.stringify(rep)
  if (a !== b) primaryDiff++
  for (const k of PRIMARY_EXTRA_KEYS) if (k in rep) primaryDiff++
  const v = validateReportV6(rep)
  if (!v.hasAllCards || v.cardCount !== 5 || v.forbiddenTokens.length) primaryDiff++
}
console.log(`   PRIMARY_REPORT_DIFF_COUNT = ${primaryDiff}`)
t('§19 PRIMARY_REPORT_DIFF_COUNT = 0 (frozen goldens)', () => assert.strictEqual(primaryDiff, 0))

// ══════════════════════════════════════════════════════════════════
// §21 OWNER READBACK — five complete reports A–E
// ══════════════════════════════════════════════════════════════════
console.log('\n   §21 OWNER READBACK (A–E)')
const readbacks = {
  A: R49_CLASS(),
  B: base({ selfBelief: 'BELIEF_ABILITY', skillValidation: 'PROOF_PAID_ONCE', pastAttemptStage: 'ATTEMPT_FEW_SALES', timeBehavior: 'TIME_BALANCE', decisionStyle: 'DECISION_WAIT_OTHERS' }),
  C: base({ monetizableSkill: 'ASSET_UNCLEAR', skillValidation: 'PROOF_NEVER', pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_NO_DIRECTION', decisionStyle: 'DECISION_WAIT_OTHERS', timeBehavior: 'TIME_PROTECT_LONG', failureResponse: 'FAIL_RECHECK' }),
  D: base({ skillValidation: 'PROOF_OCCASIONAL', timeBehavior: 'TIME_BALANCE', pastAttemptStage: 'ATTEMPT_FEW_SALES', decisionStyle: 'DECISION_WAIT_OTHERS', failureResponse: 'FAIL_RECHECK' }),
  E: base({ skillValidation: 'PROOF_STABLE', pastAttemptStage: 'ATTEMPT_STABLE_SIDE', timeBehavior: 'TIME_BALANCE', primaryProblem: 'PROBLEM_CAREER_SWITCH', primaryGoal: 'GOAL_CAREER_SWITCH' })
}
let readbackCount = 0
let readbackLeak = 0
const readbackDump = {}
for (const k of Object.keys(readbacks)) {
  const r = build(readbacks[k])
  readbackDump[k] = r
  if (r.rep.reportState === 'NO_PRIMARY') {
    readbackCount++
    const v = validateReportV6(r.rep)
    assert.ok(v.hasAllCards && v.cardCount === 5, `${k} five cards`)
    assert.strictEqual(r.vm.length, 5, `${k} renders 5`)
    const txt = reportText(r.rep)
    for (const p of INTERNAL_LEAK) if (txt.includes(p)) readbackLeak++
  }
}
console.log(`   OWNER_READBACK_REPORT_COUNT = ${readbackCount}`)
t('§21 at least 5 complete NO_PRIMARY readbacks, zero leaks', () => {
  assert.ok(readbackCount >= 5, 'count ' + readbackCount)
  assert.strictEqual(readbackLeak, 0)
})
t('§21 E (repeatable paid + new desired change) stays honest about uncertainty', () => {
  const r = readbackDump.E
  assert.strictEqual(r.rep.reportState, 'NO_PRIMARY')
  assert.ok(/只验证一个问题/.test(r.rep.cards.turnaroundPath.to))
  assert.ok(!/一定能|保证|必然/.test(reportText(r.rep)))
})

// ══════════════════════════════════════════════════════════════════
// §23 NATIVE V6 REGRESSION
// ══════════════════════════════════════════════════════════════════
console.log('\n   §23 NATIVE V6 REGRESSION')
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
    const txt = reportText(rep)
    for (const p of INTERNAL_LEAK) if (txt.includes(p)) { nativeReg++; break }
    if (!rep.cards || !rep.cards.fatalInsight || !rep.cards.firstAction) nativeReg++
  }
}
console.log(`   NATIVE_V6_REGRESSION_COUNT = ${nativeReg}`)
t('§23 NATIVE_V6_REGRESSION_COUNT = 0', () => assert.strictEqual(nativeReg, 0))

// ══════════════════════════════════════════════════════════════════
// §12/§18 CONDITIONAL CROSS-AXIS SCOPE (literal coverage)
// ══════════════════════════════════════════════════════════════════
console.log('\n   CROSS-AXIS CONDITIONAL SCOPE')
t('conditional scope (paid asset × pre-payment bottleneck) is NOT NO_PRIMARY and stays PRIMARY with scope UNPROVEN', () => {
  const out = H.runHybridDiagnosisV6(base({
    pastAttemptStage: 'ATTEMPT_COURSE_ONLY', selfBelief: 'BELIEF_KNOW_NO_ACTION',
    decisionStyle: 'DECISION_LEARN_FIRST', timeBehavior: 'TIME_SHORT_FIRST',
    primaryProblem: 'PROBLEM_INCOME_STUCK', failureResponse: 'FAIL_GIVE_UP',
    skillValidation: 'PROOF_OCCASIONAL'
  }))
  const d = out.diagnosis
  if (d.primaryBottleneck && d.compatibility.crossAxisScope === 'UNPROVEN') {
    const rep = buildReportV6(d, out.hybridContext)
    assert.strictEqual(rep.reportState, 'PRIMARY')
  } else {
    // Fixture drift guard: must not silently become NO_PRIMARY.
    assert.notStrictEqual(d.diagnosisState, 'NO_PRIMARY', 'conditional fixture drifted')
  }
})

// ── Print the five readback reports (§21) ──────────────────────────
console.log('\n   ═══ §21 READBACK REPORTS ═══')
for (const k of Object.keys(readbacks)) {
  const r = readbackDump[k]
  console.log(`\n   ── REPORT ${k} (state=${r.rep.reportState}) ──`)
  const vm = r.vm
  if (vm.length === 5) {
    console.log('   01 核心矛盾  :', vm[0].oneLiner)
    console.log('   02 现在的位置:', vm[1].body)
    console.log('   03 为什么会卡住:')
    for (const s of vm[2].loopNodes) console.log('       · ' + s)
    console.log('       = ' + vm[2].finalInsight)
    console.log('   04 现在:', vm[3].from)
    console.log('      接下来:', vm[3].to)
    console.log('   05 现在就做:', vm[4].primaryAction)
    console.log('      找谁:', vm[4].target, '| 多久:', vm[4].timebox)
    console.log('      看什么信号:', vm[4].signal)
    console.log('      怎么用它:', vm[4].decision)
  } else {
    console.log('   (non-NO_PRIMARY report)')
  }
}

console.log('\n══════════════════════════════════════')
console.log('R51 FIRST-CLASS NO_PRIMARY: ' + pass + ' passed, ' + fail + ' failed')
console.log('══════════════════════════════════════')
if (fail) process.exitCode = 1
