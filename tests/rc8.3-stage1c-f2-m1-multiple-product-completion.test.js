/**
 * RC8.3 Stage1C-F2-M1 — MULTIPLE product completion.
 *
 * Completes the MULTIPLE_SUPPORTED_MODELS user experience WITHOUT changing
 * diagnosis authority. Covers:
 *   §1 source lineage (F1 runtime wiring)
 *   §2 no fabricated primary
 *   §3 report MULTIPLE branch (supportedModels / evidence / synthesis)
 *   §4 real-device fixture: 2 models / 4 evidence rows
 *   §5 no world-rule / strategy / scenario fabrication
 *   §6 view-model pass-through only, no blindSpot branching
 *   §7 WXML MULTIPLE UI renders cards + evidence + synthesis + action
 *   §8 fixture counts (MULTIPLE_MODEL_COUNT_RENDERED=2 / EVIDENCE=4)
 *   §9 copy governance
 *   §10 validator negatives (8/8)
 *   §11 mutation tests (8/8)
 *   §12 non-interference (UNIQUE / other states / diagnosis / Stage1C-B / F1)
 *
 * `node --test`
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const GOLDEN = require('./fixtures/reportGoldenV21.js')

const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const { runCognitionChainV21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const builder = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportBuilderV21.js')
const presentation = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/index.js')
const reportBuilder = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/index.js')
const viewModel = require('../utils/northStarReportViewModel.js')
const { CONSTRUCTS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')

// ── Build helpers (identical to Stage1C-C2/D/E fixtures) ───────────────────

function withPositions(answers) {
  return answers.map((a, i) => ({ ...a, displayPosition: i }))
}

function answersFromOptionMap(map) {
  const out = []
  for (const c of CONSTRUCTS_V21) {
    for (const qid of Object.keys(map[c])) out.push({ questionId: qid, optionId: map[c][qid] })
  }
  return out
}

function buildChain(answers) {
  const responses = withPositions(answers)
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)
  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })
  const pm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: cognition.decision,
    answerTrace: report.trace.answerTrace,
    dimensions: cognition.dimensions,
    cognitiveBlindSpot: report.cognitiveBlindSpot,
    worldStrategy: report.worldStrategy,
    cognitiveArchetype: report.cognitiveArchetype,
    scenarioSimulation: report.scenarioSimulation,
    validityStatus: validity.status,
  })
  const contentModel = reportBuilder.buildNorthStarReportV21(pm)
  const vm = viewModel.buildNorthStarReportViewModel(contentModel)
  return { cognition, pm, contentModel, vm }
}

// ── §1/§4 Real-device MULTIPLE fixture ─────────────────────────────────────
// EXACT audited case: DECISION_INERTIA + TIME_HORIZON_TRAP, evidence
// SC_DEC_01/SC_DEC_02/SC_TIME_01/SC_TIME_02. Built from the SAME trusted
// Stage1C fixtures (HEALTHY base + DISTORTED pair for DECISION & TIME).
const REAL_DEVICE_MAP = (() => {
  const m = {}
  for (const c of CONSTRUCTS_V21) m[c] = { ...GOLDEN.HEALTHY[c] }
  m.DECISION = { ...GOLDEN.DISTORTED_PAIR.DECISION }
  m.TIME = { ...GOLDEN.DISTORTED_PAIR.TIME }
  return m
})()

const RD = buildChain(answersFromOptionMap(REAL_DEVICE_MAP))

function clone(x) {
  return JSON.parse(JSON.stringify(x))
}

function collectStrings(node, out, depth) {
  out = out || []
  const d = depth == null ? 12 : depth
  if (d < 0 || node == null) return out
  if (typeof node === 'string') { out.push(node); return out }
  if (Array.isArray(node)) { for (const x of node) collectStrings(x, out, d - 1); return out }
  if (typeof node === 'object') { for (const k of Object.keys(node)) collectStrings(node[k], out, d - 1) }
  return out
}

const SECTION_IDS = [
  '01_COGNITIVE_VERDICT', '02_CURRENT_WORLD_MODEL', '03_WORLD_RULE_ALIGNMENT',
  '04_WHY_WE_JUDGE_THIS', '05_DECISION_CONSEQUENCE', '06_COGNITIVE_UPGRADE',
  '07_DECISION_PROTOCOL', '08_SCENARIO_CONTRAST', '09_SECONDARY_MODEL_CONTEXT',
]

// ── §1/§2/§3 diagnosis authority preserved ─────────────────────────────────

test('§1-2: MULTIPLE keeps engine reasonCode, no fabricated primary', () => {
  assert.strictEqual(RD.cognition.decision.reasonCode, 'MULTIPLE_SUPPORTED_MODELS')
  assert.strictEqual(RD.cognition.decision.primaryBlindSpotId, null)
  assert.deepStrictEqual(RD.cognition.decision.eligibleCandidateIds, ['DECISION_INERTIA', 'TIME_HORIZON_TRAP'])
  assert.strictEqual(RD.contentModel.diagnosisState.primaryBlindSpotId, null)
  assert.strictEqual(RD.contentModel.diagnosisState.reasonCode, 'MULTIPLE_SUPPORTED_MODELS')
  assert.strictEqual(RD.pm.primaryDiagnosis, null)
  assert.strictEqual(RD.pm.worldOperatingRule, null)
  assert.strictEqual(RD.pm.upgradedModel, null)
  assert.strictEqual(RD.pm.scenarioContrast, null)
})

test('§3: report exposes multiModel block; still exactly 9 canonical sections', () => {
  assert.ok(RD.contentModel.multiModel, 'multiModel block present')
  assert.strictEqual(RD.contentModel.multiModel.uiState, 'MULTIPLE')
  assert.ok(Array.isArray(RD.contentModel.multiModel.supportedModels))
  assert.deepStrictEqual(RD.contentModel.sections.map((s) => s.sectionId), SECTION_IDS)
  assert.strictEqual(RD.contentModel.sections.length, 9)
})

test('§3: each supported model carries label + statement + evidence + provenance', () => {
  for (const m of RD.contentModel.multiModel.supportedModels) {
    assert.ok(m.label && m.label.length > 0, 'label')
    assert.ok(m.statement && m.statement.length > 0, 'statement')
    assert.ok(Array.isArray(m.evidence) && m.evidence.length >= 2, 'evidence >= 2')
    assert.ok(m.source && m.source.blindSpotId, 'source ref')
    for (const e of m.evidence) {
      assert.ok(e.source && e.source.questionId && e.source.optionId && e.source.evidenceId, 'evidence source refs')
    }
  }
})

test('§3: synthesis is neutral + count-neutral (multiple directions exist, none uniquely primary)', () => {
  const s = RD.contentModel.multiModel.synthesis
  // F2-M2A: wording is COUNT-NEUTRAL — no hardcoded numeral ("两个"/"这两个").
  assert.ok(/这些模式|多个/.test(s), 'count-neutral wording')
  assert.ok(!/两个|这两个|2个/.test(s), 'no hardcoded numeral')
  assert.ok(/不足以/.test(s), 'states it is not enough to designate one primary')
  assert.ok(!/回答不足|证据不足|不足以形成/.test(s), 'NOT false insufficiency')
  assert.strictEqual(RD.contentModel.multiModel.synthesisTitle, '综合结论')
})

// ── §4 real-device fixture counts ──────────────────────────────────────────

test('§4: real-device fixture renders 2 models + 4 evidence rows', () => {
  const models = RD.vm.multiple.supportedModels
  assert.strictEqual(models.length, 2, 'MULTIPLE_MODEL_COUNT_RENDERED=2')
  const totalEvidence = models.reduce((n, m) => n + m.evidence.length, 0)
  assert.strictEqual(totalEvidence, 4, 'MULTIPLE_EVIDENCE_COUNT_RENDERED=4')
})

test('§4: labels are the two real-device directions (决策惯性 / 时间视野陷阱), non-ranked', () => {
  const labels = RD.vm.multiple.supportedModels.map((m) => m.label)
  assert.deepStrictEqual(labels, ['决策惯性', '时间视野陷阱'])
})

// ── §5 no fabrication ──────────────────────────────────────────────────────

test('§5: no world-rule / strategy / scenario fabrication in MULTIPLE', () => {
  const byId = {}
  for (const s of RD.contentModel.sections) byId[s.sectionId] = s
  assert.ok(!byId['03_WORLD_RULE_ALIGNMENT'].body, 'no world rule body')
  assert.ok(!byId['06_COGNITIVE_UPGRADE'].body, 'no upgrade body')
  assert.ok(!byId['08_SCENARIO_CONTRAST'].body, 'no scenario body')
  assert.ok(!byId['07_DECISION_PROTOCOL'].body, 'no protocol body')
  const errors = reportBuilder.validateNorthStarReportV21(RD.contentModel).errors
  for (const e of errors) {
    assert.ok(!/FABRICATION/.test(e), `unexpected fabrication error: ${e}`)
  }
})

// ── §6 view-model pass-through ─────────────────────────────────────────────

test('§6: view-model preserves MULTIPLE content and drops provenance', () => {
  assert.strictEqual(RD.vm.uiState, 'MULTIPLE')
  assert.strictEqual(RD.vm.hasPrimary, false)
  assert.strictEqual(RD.vm.verdict, null)
  assert.ok(RD.vm.multiple, 'multiple preserved')
  for (const m of RD.vm.multiple.supportedModels) {
    assert.strictEqual(m.source, undefined, 'source provenance dropped')
    for (const e of m.evidence) assert.strictEqual(e.source, undefined, 'evidence provenance dropped')
  }
})

test('§6: neither view-model nor page branches on blindSpot id', () => {
  const vmSrc = fs.readFileSync(path.join(ROOT, 'utils/northStarReportViewModel.js'), 'utf8')
  const jsSrc = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.js'), 'utf8')
  for (const src of [vmSrc, jsSrc]) {
    assert.strictEqual(/blindSpotId\s*===/.test(src), false, 'blindSpot-specific branch')
    assert.strictEqual(/blindSpotId\s*==/.test(src), false, 'blindSpot-specific branch (==)')
    assert.strictEqual(/DECISION_INERTIA|TIME_HORIZON_TRAP/.test(src), false, 'hardcoded candidate id')
  }
})

// ── §7 WXML MULTIPLE UI ────────────────────────────────────────────────────

test('§7: WXML renders MULTIPLE header + per-model cards + evidence + synthesis + action', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.wxml'), 'utf8')
  assert.ok(/uiState === 'MULTIPLE'/.test(wxml), 'MULTIPLE branch present')
  assert.ok(wxml.includes('multiple.headline'), 'neutral header')
  assert.ok(wxml.includes('multiple.supportedModels'), 'model cards loop')
  assert.ok(wxml.includes('model.evidence'), 'per-model evidence loop')
  assert.ok(wxml.includes('multiple.synthesis'), 'neutral synthesis')
  assert.ok(/bindtap="onBack"/.test(wxml), 'return action')
  // no fake primary card / fake strategy in the MULTIPLE branch
  const seg = wxml.slice(wxml.indexOf("uiState === 'MULTIPLE'"), wxml.indexOf('非 UNIQUE 中性状态'))
  assert.ok(!/hero-label/.test(seg), 'no fake primary label badge')
  assert.ok(!/upgrade|worldRule|protocol/.test(seg), 'no fake strategy/world-rule/protocol')
})

test('§7: WXML has no raw token binding keys', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.wxml'), 'utf8')
  for (const t of ['blindSpotId', 'strategyId', 'reasonCode', 'questionId', 'optionId', 'signalId', 'evidenceId', 'source.']) {
    assert.ok(!wxml.includes(t), `WXML references raw token: ${t}`)
  }
})

// ── §8 fixture end-to-end (already built) ──────────────────────────────────

test('§8: validator accepts the real-device MULTIPLE report', () => {
  const r = reportBuilder.validateNorthStarReportV21(RD.contentModel)
  assert.strictEqual(r.valid, true, JSON.stringify(r.errors))
})

// ── §9 copy governance ─────────────────────────────────────────────────────

test('§9: MULTIPLE user copy is Chinese, no false-insufficiency, no raw enum, no English', () => {
  const strings = collectStrings(RD.vm.multiple)
  for (const s of strings) {
    assert.ok(!/回答不足|证据不足|不足以形成/.test(s), `false insufficiency: ${s}`)
    assert.ok(!['DECISION_INERTIA', 'TIME_HORIZON_TRAP', 'DECISION', 'TIME', 'STRONG', 'DISTORTED'].includes(s), `raw enum: ${s}`)
    assert.ok(!reportBuilder.isEnglishParagraph(s), `English paragraph: ${s}`)
  }
})

test('§9: no forbidden manipulation copy in WXML (页面上不得出现唯一主因/系统无法判断/你的主要问题)', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.wxml'), 'utf8')
  for (const bad of ['系统无法判断', '你的主要问题是', '唯一主因', '证据不足']) {
    assert.ok(!wxml.includes(bad), `forbidden copy in WXML: ${bad}`)
  }
})

// ── §10 validator negatives (8/8) ──────────────────────────────────────────

function assertRejects(mutated, prefix) {
  const r = reportBuilder.validateNorthStarReportV21(mutated)
  assert.strictEqual(r.valid, false, `should reject (${prefix}); errors=${r.errors.join(',')}`)
  assert.ok(r.errors.some((e) => e === prefix || e.startsWith(prefix)), `expected ${prefix}, got ${r.errors.join(', ')}`)
}

test('§10 validator negatives 8/8', () => {
  // M1 fake primary
  const m1 = clone(RD.contentModel); m1.diagnosisState.primaryBlindSpotId = 'DECISION_INERTIA'
  assertRejects(m1, 'FABRICATED_PRIMARY_IN_MULTIPLE')
  // M2 candidate not in diagnosisState
  const m2 = clone(RD.contentModel); m2.multiModel.supportedModels[0].source.blindSpotId = 'SYSTEM_THINKING_GAP'
  assertRejects(m2, 'MULTIPLE_CANDIDATE_NOT_IN_ELIGIBLE')
  // M3 fabricated evidence (no source backing)
  const m3 = clone(RD.contentModel); m3.multiModel.supportedModels[0].evidence.forEach((e) => { delete e.source })
  assertRejects(m3, 'MULTIPLE_EVIDENCE_NOT_SOURCE_BACKED')
  // M4 fake primary strategy
  const m4 = clone(RD.contentModel)
  m4.sections.find((s) => s.sectionId === '06_COGNITIVE_UPGRADE').body = { upgradedModel: 'fabricated strategy' }
  assertRejects(m4, 'MULTIPLE_STRATEGY_FABRICATION')
  // M5 false insufficient copy
  const m5 = clone(RD.contentModel); m5.multiModel.synthesis = '证据不足，建议重新答题'
  assertRejects(m5, 'MULTIPLE_FALSE_INSUFFICIENT_COPY')
  // M6 missing all evidence
  const m6 = clone(RD.contentModel); m6.multiModel.supportedModels.forEach((m) => { m.evidence = [] })
  assertRejects(m6, 'MULTIPLE_MODEL_EVIDENCE_MISSING')
  // M7 raw enum leak
  const m7 = clone(RD.contentModel); m7.multiModel.supportedModels[0].label = 'DECISION_INERTIA'
  assertRejects(m7, 'RAW_INTERNAL_TOKEN_IN_USER_COPY')
  // M8 duplicate candidate
  const m8 = clone(RD.contentModel); m8.multiModel.supportedModels[1] = clone(m8.multiModel.supportedModels[0])
  assertRejects(m8, 'MULTIPLE_DUPLICATE_CANDIDATE')
})

// ── §11 mutation tests (8/8) ───────────────────────────────────────────────

test('§11 F2M1-1: hide candidate list → caught (no supportedModels)', () => {
  const m = clone(RD.contentModel); m.multiModel.supportedModels = []
  const r = reportBuilder.validateNorthStarReportV21(m)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.some((e) => e.startsWith('MULTIPLE_MODELS_INSUFFICIENT')))
  const vm = viewModel.buildNorthStarReportViewModel(m)
  assert.ok(!vm.multiple || vm.multiple.supportedModels.length === 0)
})

test('§11 F2M1-2: show only one of two candidates → caught', () => {
  const m = clone(RD.contentModel); m.multiModel.supportedModels = m.multiModel.supportedModels.slice(0, 1)
  const r = reportBuilder.validateNorthStarReportV21(m)
  assert.ok(r.errors.some((e) => e.startsWith('MULTIPLE_MODELS_INSUFFICIENT')))
})

test('§11 F2M1-3: hide evidence → caught', () => {
  const m = clone(RD.contentModel); m.multiModel.supportedModels[0].evidence = []
  const r = reportBuilder.validateNorthStarReportV21(m)
  assert.ok(r.errors.some((e) => e.startsWith('MULTIPLE_MODEL_EVIDENCE_MISSING')))
})

test('§11 F2M1-4: fabricate winner → caught', () => {
  const m = clone(RD.contentModel); m.diagnosisState.primaryBlindSpotId = 'DECISION_INERTIA'
  const r = reportBuilder.validateNorthStarReportV21(m)
  assert.ok(r.errors.some((e) => e === 'FABRICATED_PRIMARY_IN_MULTIPLE'))
  // the view-model must render this as UNIQUE, not MULTIPLE (state matrix catch)
  const vm = viewModel.buildNorthStarReportViewModel(m)
  assert.strictEqual(vm.uiState, 'UNIQUE')
})

test('§11 F2M1-5: show "evidence insufficient" → caught', () => {
  const m = clone(RD.contentModel); m.multiModel.synthesis = '证据不足'
  const r = reportBuilder.validateNorthStarReportV21(m)
  assert.ok(r.errors.some((e) => e === 'MULTIPLE_FALSE_INSUFFICIENT_COPY'))
})

test('§11 F2M1-6: invent strategy → caught', () => {
  const m = clone(RD.contentModel)
  m.sections.find((s) => s.sectionId === '06_COGNITIVE_UPGRADE').body = { upgradedModel: 'x'.repeat(12) }
  const r = reportBuilder.validateNorthStarReportV21(m)
  assert.ok(r.errors.some((e) => e === 'MULTIPLE_STRATEGY_FABRICATION'))
})

test('§11 F2M1-7: expose raw IDs → caught', () => {
  const m = clone(RD.contentModel); m.multiModel.supportedModels[0].label = 'TIME_HORIZON_TRAP'
  const r = reportBuilder.validateNorthStarReportV21(m)
  assert.ok(r.errors.some((e) => e.startsWith('RAW_INTERNAL_TOKEN_IN_USER_COPY')))
})

test('§11 F2M1-8: make UI branch on DECISION_INERTIA → caught', () => {
  const mutated = fs.readFileSync(path.join(ROOT, 'utils/northStarReportViewModel.js'), 'utf8')
    + '\nfunction __mutated(b){ return b === "DECISION_INERTIA" ? "x" : "" }\n'
  assert.ok(/DECISION_INERTIA\s*===|b\s*===\s*"DECISION_INERTIA"/.test(mutated), 'mutation introduces branch')
  const prod = fs.readFileSync(path.join(ROOT, 'utils/northStarReportViewModel.js'), 'utf8')
  assert.strictEqual(/DECISION_INERTIA/.test(prod), false, 'production VM must not mention candidate id')
})

// ── §12 non-interference ───────────────────────────────────────────────────

test('§12: UNIQUE output unchanged (9 sections, hasPrimary, verdict present)', () => {
  const aMap = {}
  for (const c of CONSTRUCTS_V21) aMap[c] = { ...GOLDEN.HEALTHY[c] }
  aMap.SYSTEMS = { ...GOLDEN.DISTORTED_PAIR.SYSTEMS }
  const u = buildChain(answersFromOptionMap(aMap))
  assert.strictEqual(u.cognition.decision.primaryBlindSpotId, 'SYSTEM_THINKING_GAP')
  assert.ok(!('multiModel' in u.contentModel), 'UNIQUE has no multiModel block')
  assert.strictEqual(u.vm.uiState, 'UNIQUE')
  assert.ok(!('multiple' in u.vm))
  assert.strictEqual(u.vm.hasPrimary, true)
  assert.ok(u.vm.verdict && u.vm.verdict.summary.length > 8)
  assert.deepStrictEqual(u.contentModel.sections.map((s) => s.sectionId), SECTION_IDS)
})

test('§12: other states unchanged (NO_PRIMARY / INSUFFICIENT / CONTRADICTORY / BLOCKED)', () => {
  // NO_PRIMARY
  const healthy = buildChain(answersFromOptionMap(GOLDEN.HEALTHY))
  assert.strictEqual(healthy.contentModel.diagnosisState.reasonCode, 'NO_SUPPORTED_DEFICIT')
  assert.ok(!('multiModel' in healthy.contentModel))
  assert.strictEqual(healthy.vm.uiState, 'NO_PRIMARY')
  assert.ok(!('multiple' in healthy.vm))
  // INSUFFICIENT
  const insuff = buildChain(answersFromOptionMap(GOLDEN.INSUFFICIENT_MAP))
  assert.strictEqual(insuff.contentModel.diagnosisState.reasonCode, 'INSUFFICIENT_DIRECTIONAL_EVIDENCE')
  assert.strictEqual(insuff.vm.uiState, 'INSUFFICIENT')
  assert.ok(!('multiple' in insuff.vm))
  // CONTRADICTORY
  const contra = buildChain(answersFromOptionMap(GOLDEN.CONTRADICTORY_MAP))
  assert.strictEqual(contra.contentModel.diagnosisState.reasonCode, 'CONTRADICTORY_EVIDENCE')
  assert.strictEqual(contra.vm.uiState, 'CONTRADICTORY')
  assert.ok(!('multiple' in contra.vm))
  // BLOCKED (diagnosis=null)
  const fAnswers = answersFromOptionMap(GOLDEN.HEALTHY)
  fAnswers[1] = { ...fAnswers[0] }
  const fResponses = withPositions(fAnswers)
  const fValidity = responseValidity.assessResponseValidityV21(fResponses)
  const fPm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: null, answerTrace: [], dimensions: null, cognitiveBlindSpot: null,
    worldStrategy: null, cognitiveArchetype: null, scenarioSimulation: null, validityStatus: fValidity.status,
  })
  const fCm = reportBuilder.buildNorthStarReportV21(fPm)
  assert.ok(!('multiModel' in fCm))
  const fVm = viewModel.buildNorthStarReportViewModel(fCm)
  assert.strictEqual(fVm.uiState, 'BLOCKED')
  assert.ok(!('multiple' in fVm))
})

test('§12: builder/view-model output is deterministic (no diff across rebuilds)', () => {
  const a = JSON.stringify(buildChain(answersFromOptionMap(REAL_DEVICE_MAP)).contentModel)
  const b = JSON.stringify(buildChain(answersFromOptionMap(REAL_DEVICE_MAP)).contentModel)
  assert.strictEqual(a, b, 'content model deterministic')
  const va = JSON.stringify(buildChain(answersFromOptionMap(REAL_DEVICE_MAP)).vm)
  const vb = JSON.stringify(buildChain(answersFromOptionMap(REAL_DEVICE_MAP)).vm)
  assert.strictEqual(va, vb, 'view model deterministic')
})

test('§12: diagnosis (engine) deterministic and untouched', () => {
  const d1 = buildChain(answersFromOptionMap(REAL_DEVICE_MAP)).cognition.decision
  const d2 = buildChain(answersFromOptionMap(REAL_DEVICE_MAP)).cognition.decision
  assert.strictEqual(d1.primaryBlindSpotId, d2.primaryBlindSpotId)
  assert.strictEqual(d1.reasonCode, d2.reasonCode)
  assert.deepStrictEqual(d1.eligibleCandidateIds, d2.eligibleCandidateIds)
})

// ── §7 page render smoke (real Page() module, no WXML engine) ──────────────

test('§7: page onLoad binds 2-model / 4-evidence MULTIPLE data', () => {
  const { loadPage, defaultWx, defaultApp } = require('./ui/helpers/pageShim.js')
  const appMock = defaultApp()
  appMock.globalData.v21CognitiveReport = RD.contentModel
  const { harness, error } = loadPage('v21-cognitive-report', defaultWx(), appMock)
  assert.strictEqual(error, null)
  harness.onLoad()
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data.hasPrimary, false)
  assert.strictEqual(harness.data.uiState, 'MULTIPLE')
  assert.ok(harness.data.multiple, 'multiple data present')
  assert.strictEqual(harness.data.multiple.supportedModels.length, 2)
  const ev = harness.data.multiple.supportedModels.reduce((n, m) => n + m.evidence.length, 0)
  assert.strictEqual(ev, 4)
  // no diagnosis content rendered in MULTIPLE
  assert.strictEqual(harness.data.verdict, null)
  assert.strictEqual(harness.data.worldRule, null)
  assert.strictEqual(harness.data.upgrade, null)
})
