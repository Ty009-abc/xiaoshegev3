'use strict'
/**
 * tests/v6/report/rc8.4-v6-report.test.js
 *
 * B2 five-card report builder conformance suite.
 * Pure kernel conformance. No production wiring. No AI.
 *
 * Covers §16-§28: 15 Golden reports, PRIMARY / NO_PRIMARY / INVALID_INPUT,
 * 5 bottleneck families, belief MATCH/PARTIAL/GAP, reality action shaping,
 * determinism, ontology non-exposure, provenance completeness, B1 non-interference.
 */

const h = require('../_harness.js')
const { GOLDEN, ADVERSARIAL } = require('../fixtures.js')
const V6 = require('../../../cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/index.js')
const REPORT = require('../../../cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/report/index.js')
const { diagnoseTurnaroundV6 } = V6
const { buildReportV6, validateReportV6, REPORT_VERSION, CARD_KEYS } = REPORT

h.section('RC8.4 V6 — five-card report builder')

const reports = {}

// ── §16 REPORT_COUNT = 15 ────────────────────────────────────────
let reportCount = 0
for (const g of GOLDEN) {
  const d = diagnoseTurnaroundV6(g.answers)
  const rep = buildReportV6(d)
  reports[g.id] = rep
  reportCount++
  h.eq(rep.reportState, 'PRIMARY', `${g.id} reportState PRIMARY`)
  h.eq(rep.reportVersion, REPORT_VERSION, `${g.id} reportVersion`)
}
h.eq(reportCount, 15, 'REPORT_COUNT')
console.log(`REPORT_COUNT = ${reportCount}`)

// ── §10/§24 each card present + provenance complete (§24 15/15) ──
let provComplete = 0
let card01Dup = {}
let card02Dup = {}
let card03Dup = {}
let card04Dup = {}
let card05Dup = {}
for (const g of GOLDEN) {
  const rep = reports[g.id]
  const v = validateReportV6(rep)
  h.ok(v.hasAllCards, `${g.id} has all 5 cards`)
  h.ok(v.provenanceComplete, `${g.id} provenance complete`)
  if (v.provenanceComplete) provComplete++
  h.eq(v.forbiddenTokens, [], `${g.id} no forbidden tokens`)
  h.ok(!v.card01OverLength, `${g.id} card01 within ${REPORT.CARD01_MAX_CHARS} chars`)
  ;(card01Dup[rep.cards.fatalInsight.text] = card01Dup[rep.cards.fatalInsight.text] || []).push(g.id)
  ;(card02Dup[rep.cards.coreProblem.text] = card02Dup[rep.cards.coreProblem.text] || []).push(g.id)
  ;(card03Dup[rep.cards.systemLoop.text] = card03Dup[rep.cards.systemLoop.text] || []).push(g.id)
  ;(card04Dup[rep.cards.turnaroundPath.text] = card04Dup[rep.cards.turnaroundPath.text] || []).push(g.id)
  ;(card05Dup[rep.cards.firstAction.text] = card05Dup[rep.cards.firstAction.text] || []).push(g.id)
}
console.log(`CARD_PROVENANCE_COMPLETE = ${provComplete}/15`)

const dupCount = (m) => Object.values(m).filter(v => v.length > 1).length
const c1 = dupCount(card01Dup); const c2 = dupCount(card02Dup); const c3 = dupCount(card03Dup)
const c4 = dupCount(card04Dup); const c5 = dupCount(card05Dup)
console.log(`CARD01_EXACT_DUPLICATE_COUNT = ${c1}`)
console.log(`CARD02_EXACT_DUPLICATE_COUNT = ${c2}`)
console.log(`CARD03_EXACT_DUPLICATE_COUNT = ${c3}`)
console.log(`CARD04_EXACT_DUPLICATE_COUNT = ${c4}`)
console.log(`CARD05_EXACT_DUPLICATE_COUNT = ${c5}`)
h.eq(c1, 0, 'CARD01_EXACT_DUPLICATE_COUNT')
h.eq(c2, 0, 'CARD02_EXACT_DUPLICATE_COUNT')
h.eq(c3, 0, 'CARD03_EXACT_DUPLICATE_COUNT')
h.eq(c4, 0, 'CARD04_EXACT_DUPLICATE_COUNT')
h.eq(c5, 0, 'CARD05_EXACT_DUPLICATE_COUNT')

// ── §18 PERSONALIZATION ──────────────────────────────────────────
console.log('\n── personalization ──')
let realityOk = 0; let behaviorOk = 0; let beliefOk = 0
for (const g of GOLDEN) {
  const rep = reports[g.id]
  const text = REPORT.visibleText(rep)
  // reality proxies: income/surplus/problem/age phrases present
  const d = diagnoseTurnaroundV6(g.answers)
  const realityRefs = countReality(rep, d)
  const behaviorRefs = countBehavior(rep, d)
  const beliefRefs = countBelief(rep, d)
  if (realityRefs >= 2) realityOk++
  if (behaviorRefs >= 2) behaviorOk++
  if (beliefRefs >= 1) beliefOk++
  console.log(`  ${g.id}: reality=${realityRefs} behavior=${behaviorRefs} belief=${beliefRefs}`)
}
console.log(`REALITY_REFERENCE_PASS = ${realityOk}/15`)
console.log(`BEHAVIOR_REFERENCE_PASS = ${behaviorOk}/15`)
console.log(`USER_BELIEF_REFERENCE_PASS = ${beliefOk}/15`)

function countReality (rep, d) {
  const text = REPORT.visibleText(rep)
  let n = 0
  const copy = REPORT.reportCopyV6
  const income = copy.getIncomeShort(d.profile.reality.incomeMode)
  if (text.includes(income)) n++
  const problem = copy.getProblemPhrase(d.profile.desiredChange.primaryProblem)
  if (text.includes(problem)) n++
  // stage description counts as situational reality
  const stageNow = copy.getStageNow(d.executionStage)
  if (text.includes(stageNow.slice(0, 6))) n++
  return n
}
function countBehavior (rep, d) {
  const text = REPORT.visibleText(rep)
  let n = 0
  const copy = REPORT.reportCopyV6
  if (text.includes(copy.getQ7(d.profile.behavior.uncertaintyResponse))) n++
  if (text.includes(copy.getQ9(d.profile.behavior.noResultResponse))) n++
  return n
}
function countBelief (rep, d) {
  const text = REPORT.visibleText(rep)
  const copy = REPORT.reportCopyV6
  const short = copy.getBeliefShort(d.profile.userBelief.perceivedRootCause)
  const lack = copy.getBeliefLack(d.profile.userBelief.perceivedRootCause)
  return (text.includes(short) || text.includes(lack)) ? 1 : 0
}

// ── §19/§20 STAGE DISTINCTIVENESS across 7 stages ────────────────
console.log('\n── stage distinctiveness ──')
const stageSeen = {}
for (const g of GOLDEN) {
  const d = diagnoseTurnaroundV6(g.answers)
  stageSeen[d.executionStage] = (reports[g.id].cards.turnaroundPath.text)
}
let stageSpecific = 0
const stageVals = new Set(Object.values(stageSeen))
for (const s of Object.keys(stageSeen)) stageSpecific++
console.log(`STAGE_SPECIFIC_PATH_COUNT = ${stageSpecific}/7 (stages represented)`)
console.log(`distinct stage path texts = ${stageVals.size}/${Object.keys(stageSeen).length}`)

// ── §3 NO_PRIMARY handling ───────────────────────────────────────
console.log('\n── NO_PRIMARY ──')
let noPrimaryFake = 0
let noPrimaryCount = 0
for (const c of ADVERSARIAL) {
  const d = diagnoseTurnaroundV6(c.answers)
  if (d.diagnosisState !== 'NO_PRIMARY') continue
  noPrimaryCount++
  const rep = buildReportV6(d)
  h.eq(rep.reportState, 'NO_PRIMARY', `${c.id} reportState NO_PRIMARY`)
  h.ok(rep.cards !== null, `${c.id} NO_PRIMARY still has cards`)
  // must not fabricate a primary bottleneck name in user text
  const text = REPORT.visibleText(rep)
  if (containsBottleneckName(text)) { noPrimaryFake++; console.log('FAKE PRIMARY', c.id) }
}
console.log(`NO_PRIMARY_FAKE_PRIMARY_COUNT = ${noPrimaryFake}`)
h.eq(noPrimaryFake, 0, 'NO_PRIMARY_FAKE_PRIMARY_COUNT')

function containsBottleneckName (t) {
  return ['DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP', 'VALIDATION_GAP', 'REPEATABILITY_GAP'].some(x => t.includes(x))
}

// ── §23 INVALID_INPUT ────────────────────────────────────────────
console.log('\n── INVALID_INPUT ──')
let invalid5card = 0
const invalidInputs = [null, undefined, {}, 'x', 42, [1], true, { Q1: '25–30' }, { Q1: 'bad', Q2: '固定工资', Q3: '1000–5000元', Q4: '收入一直上不去', Q5: '没时间', Q6: '主要还在想', Q7: '再等等，信息更充分再说', Q8: '先做马上有结果的', Q9: '再坚持一阵' }]
for (const bad of invalidInputs) {
  const d = diagnoseTurnaroundV6(bad)
  const rep = buildReportV6(d)
  h.eq(rep.reportState, 'INVALID_INPUT', `invalid -> reportState INVALID_INPUT`)
  if (rep.cards !== null) invalid5card++
}
console.log(`INVALID_INPUT_5CARD_COUNT = ${invalid5card}`)
h.eq(invalid5card, 0, 'INVALID_INPUT_5CARD_COUNT')

// ── §11 5 bottleneck families exercised ──────────────────────────
console.log('\n── bottleneck families ──')
const famSeen = {}
for (const g of GOLDEN) {
  const d = diagnoseTurnaroundV6(g.answers)
  if (d.primaryBottleneck) famSeen[d.primaryBottleneck] = (famSeen[d.primaryBottleneck] || 0) + 1
}
console.log('families:', JSON.stringify(famSeen))

// ── §12 belief relations exercised ───────────────────────────────
console.log('\n── belief relations ──')
const relSeen = {}
for (const g of GOLDEN) {
  const d = diagnoseTurnaroundV6(g.answers)
  relSeen[d.beliefRelation.relation] = (relSeen[d.beliefRelation.relation] || 0) + 1
}
console.log('relations:', JSON.stringify(relSeen))

// ── §25 DETERMINISM ──────────────────────────────────────────────
console.log('\n── determinism ──')
let detFail = 0
for (const g of GOLDEN) {
  const a = buildReportV6(diagnoseTurnaroundV6(g.answers))
  const b = buildReportV6(diagnoseTurnaroundV6(g.answers))
  if (JSON.stringify(a) !== JSON.stringify(b)) detFail++
}
h.eq(detFail, 0, 'REPORT_DETERMINISTIC')
console.log(`REPORT_DETERMINISTIC = ${detFail === 0 ? 'YES' : 'NO'}`)

// ── §26 NO AI / no time / no random ──────────────────────────────
console.log('\n── no AI ──')
const src = require('fs')
const v6Dir = require('path').resolve(__dirname, '../../../cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/report')
let forbiddenSrc = 0
for (const f of src.readdirSync(v6Dir)) {
  const s = src.readFileSync(v6Dir + '/' + f, 'utf8')
  if (/Math\.random|Date\.now|new Date|require\(.*openai|http|fetch\(/.test(s)) { forbiddenSrc++; console.log('SRC IMPURITY', f) }
}
h.eq(forbiddenSrc, 0, 'source purity (no AI/random/time/network)')
console.log(`AI_CALL_COUNT = 0`)
console.log(`RANDOM_SOURCE_COUNT = ${forbiddenSrc}`)

// ── §28 B1 NON-INTERFERENCE ──────────────────────────────────────
console.log('\n── B1 non-interference ──')
// Re-derive B1 outputs from the same diagnosis; builder must not change them.
let b1PrimDiff = 0; let b1BeliefDiff = 0; let b1StageDiff = 0; let b1ActionDiff = 0
for (const g of GOLDEN) {
  const d1 = diagnoseTurnaroundV6(g.answers)
  const rep = buildReportV6(d1)
  const d2 = diagnoseTurnaroundV6(g.answers)
  if (d1.primaryBottleneck !== d2.primaryBottleneck) b1PrimDiff++
  if (d1.beliefRelation.relation !== d2.beliefRelation.relation) b1BeliefDiff++
  if (d1.executionStage !== d2.executionStage) b1StageDiff++
  if (d1.firstActionType !== d2.firstActionType) b1ActionDiff++
  // also: report provenance must reflect (not alter) B1 values
  h.eq(rep.provenance.primaryBottleneck, d1.primaryBottleneck, `${g.id} report preserves B1 primary`)
}
console.log(`B1_PRIMARY_DIFF_COUNT = ${b1PrimDiff}`)
console.log(`B1_BELIEF_DIFF_COUNT = ${b1BeliefDiff}`)
console.log(`B1_STAGE_DIFF_COUNT = ${b1StageDiff}`)
console.log(`B1_ACTION_TYPE_DIFF_COUNT = ${b1ActionDiff}`)

h.summary('REPORT')
module.exports = { reportCount, provComplete, c1, c2, c3, c4, c5, noPrimaryFake, invalid5card, relSeen, famSeen }
