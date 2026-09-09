/**
 * RC8.3 Stage1C-E2 — Final Release Gate & RC Freeze.
 *
 * Executable evidence for ADR-RC8.3-STAGE1C-E-RELEASE-GATE.md.
 * Tests/fixtures/governance ONLY. No product semantic change.
 *
 * Coverage:
 *   §5  six-state end-to-end (diagnosis → Presentation Truth → Report → UI)
 *   §6  all 9 blind-spot end-to-end semantic obligations
 *   §7  R4.5 reference fixture end-to-end
 *   §8  authority DAG (one-way downward)
 *   §9  output non-interference (determinism + layer passthrough)
 *   §10 schema / copy / safety gate
 *   §11 P2 duplication governance (growth = 0)
 *   §12 release-gate mutations R1..R6
 *   §13 Report Golden governance validity
 *
 * `node --test`
 *
 * @version north_star_release_gate_v1
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
const reportValidator = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/northStarReportValidatorV21.js')
const viewModel = require('../utils/northStarReportViewModel.js')
const { CONSTRUCTS_V21, QUESTIONS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')
const { EVIDENCE_CATALOG_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/evidenceCatalogV21.js')
const { getPrinciplesForBlindSpot } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldPrinciples.js')
const { BLIND_SPOT_TO_STRATEGY_V2 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2/strategyEngineV2.js')
const { BLIND_SPOT_TO_ARCHETYPE_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportContractV21.js')

// ── Build helpers (self-contained; same frozen fixtures as Stage1C-C2/D/E1) ─

function answersFromOptionMap(map) {
  const out = []
  for (const c of CONSTRUCTS_V21) {
    for (const qid of Object.keys(map[c])) out.push({ questionId: qid, optionId: map[c][qid] })
  }
  return out
}

function uniquePrimaryAnswers(construct) {
  const map = {}
  for (const c of CONSTRUCTS_V21) map[c] = { ...GOLDEN.HEALTHY[c] }
  map[construct] = { ...GOLDEN.DISTORTED_PAIR[construct] }
  return answersFromOptionMap(map)
}

function withPositions(answers, seed = 3) {
  return answers.map((a, i) => ({ ...a, displayPosition: (i * seed) % 4 }))
}

function buildFull(answers) {
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
  return { responses, validity, cognition, report, pm, contentModel, vm }
}

function buildReportContentModel(answers) {
  return buildFull(answers).contentModel
}

function sec(cm, id) {
  return cm.sections.find((s) => s.sectionId === id)
}

const CONSTRUCT_TO_BLINDSPOT = {}
for (const [bs, m] of Object.entries(GOLDEN.GOLDEN_MAPPING)) CONSTRUCT_TO_BLINDSPOT[m.construct] = bs

// Cache the 9 unique-primary full chains (deterministic).
const UNIQUE = {}
for (const c of CONSTRUCTS_V21) UNIQUE[c] = buildFull(uniquePrimaryAnswers(c))

function buildMultiState() {
  const results = {}
  results.MULTIPLE = buildFull(GOLDEN.MULTIPLE_ANSWERS)
  results.NO_PRIMARY = buildFull(answersFromOptionMap(GOLDEN.HEALTHY))
  results.INSUFFICIENT = buildFull(answersFromOptionMap(GOLDEN.INSUFFICIENT_MAP))
  results.CONTRADICTORY = buildFull(answersFromOptionMap(GOLDEN.CONTRADICTORY_MAP))
  // BLOCKED
  const fAnswers = answersFromOptionMap(GOLDEN.HEALTHY)
  fAnswers[1] = { ...fAnswers[0] }
  const fResponses = withPositions(fAnswers)
  const fValidity = responseValidity.assessResponseValidityV21(fResponses)
  const fPm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: null, answerTrace: [], dimensions: null,
    cognitiveBlindSpot: null, worldStrategy: null, cognitiveArchetype: null,
    scenarioSimulation: null, validityStatus: fValidity.status,
  })
  results.BLOCKED = {
    cognition: { decision: null },
    pm: fPm,
    contentModel: reportBuilder.buildNorthStarReportV21(fPm),
    vm: viewModel.buildNorthStarReportViewModel(reportBuilder.buildNorthStarReportV21(fPm)),
  }
  // NOT_EXECUTED
  const nPm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: null, answerTrace: [], dimensions: null,
    cognitiveBlindSpot: null, worldStrategy: null, cognitiveArchetype: null,
    scenarioSimulation: null, validityStatus: null,
  })
  const nCm = reportBuilder.buildNorthStarReportV21(nPm)
  results.NOT_EXECUTED = {
    cognition: { decision: null },
    pm: nPm,
    contentModel: nCm,
    vm: viewModel.buildNorthStarReportViewModel(nCm),
  }
  return results
}

const MS = buildMultiState()

const RAW_SCHEMA_RE = /(SYSTEM_THINKING_GAP|OPPORTUNITY_BLINDNESS|FEEDBACK_LOOP_GAP|DECISION_INERTIA|RISK_MODEL_DISTORTION|PROBABILITY_MISJUDGMENT|IDENTITY_CONSTRAINT|LEVERAGE_MODEL_GAP|TIME_HORIZON_TRAP|BUILD_DECISION_SYSTEM|BUILD_FEEDBACK_LOOP|EXPAND_OPTIONALITY|INCREASE_EXPERIMENT_RATE|REFRAME_RISK_MODEL|UPGRADE_PROBABILITY_THINKING|EXPAND_IDENTITY_BOUNDARY|BUILD_LEVERAGE_MODEL|EXTEND_TIME_HORIZON|DECISION_CREATES_INFORMATION|FEEDBACK_UPDATES_MODELS|PROBABILITY_GOVERNS_OUTCOMES|RISK_IS_ASYMMETRICAL|LEVERAGE_MULTIPLIES_VALUE|TIME_COMPOUNDS_ADVANTAGE|IDENTITY_CONSTRAINS_CHOICES|OPPORTUNITY_EMERGES_THROUGH_EXPOSURE|SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR|DECISION_MODEL|FEEDBACK_MODEL|PROBABILITY_MODEL|RISK_MODEL|LEVERAGE_MODEL|TIME_MODEL|IDENTITY_MODEL|OPPORTUNITY_MODEL|OPERATOR|EXPLORER|BUILDER|STRATEGIST|GUARDIAN|CONNECTOR|OPTIMIZER)/

const FORTUNE_TELLING_RE = /(命运|注定|命中注定|命理|玄学|天机|宿命)/
const FAKE_PERCENTAGE_RE = /(成功率\s*[0-9]+%|达到\s*[0-9]+%|提升到\s*[0-9]+%|[0-9]+%的把握)/
const GENERIC_PRIMARY_FALLBACK_RE = /(本次未得出唯一的核心认知发现)/

function renderedStrings(vm) {
  const out = []
  const push = (s) => { if (typeof s === 'string' && s.length) out.push(s) }
  if (!vm || !vm.supported) return out
  push(vm.stateMessage)
  if (vm.verdict) { push(vm.verdict.summary); push(vm.verdict.blindSpotLabel) }
  if (vm.currentModel) push(vm.currentModel.statement)
  if (vm.worldRule) {
    push(vm.worldRule.userModel); push(vm.worldRule.worldRule); push(vm.worldRule.misalignment)
    if (vm.worldRule.whyItMatters) { push(vm.worldRule.whyItMatters.mechanism); push(vm.worldRule.whyItMatters.consequence) }
  }
  if (vm.evidence) for (const it of vm.evidence.items) { push(it.questionMeaning); push(it.selectedAnswerMeaning); push(it.whatSignalItShows); push(it.howItSupportsDiagnosis) }
  if (vm.consequence) push(vm.consequence.consequence)
  if (vm.upgrade) push(vm.upgrade.upgradedModel)
  if (vm.protocol) {
    push(vm.protocol.trigger)
    for (const st of vm.protocol.steps) { push(st.name); push(st.description) }
    push(vm.protocol.successSignal); push(vm.protocol.reviewWindow); push(vm.protocol.stopCondition)
  }
  if (vm.scenario) {
    for (const p of vm.scenario.currentModel.likelyDecisionPattern) push(p)
    for (const p of vm.scenario.upgradedModel.likelyDecisionPattern) push(p)
    push(vm.scenario.simulationNote)
  }
  if (vm.secondary) {
    if (vm.secondary.archetype) { push(vm.secondary.archetype.label); push(vm.secondary.archetype.description) }
    push(vm.secondary.primaryDistortion)
    for (const s of vm.secondary.strengths) push(s)
    for (const s of vm.secondary.relatedDimensions) push(s)
    for (const m of vm.secondary.fullModelMap) { push(m.label); push(m.orientationLabel); push(m.stateLabel) }
  }
  return out
}

function allRenderedStrings() {
  const arr = []
  for (const c of CONSTRUCTS_V21) arr.push(...renderedStrings(UNIQUE[c].vm))
  for (const k of ['MULTIPLE', 'NO_PRIMARY', 'INSUFFICIENT', 'CONTRADICTORY', 'BLOCKED', 'NOT_EXECUTED']) {
    arr.push(...renderedStrings(MS[k].vm))
  }
  return arr
}

function collectUserStrings(obj) {
  return reportBuilder.collectUserStrings(obj)
}

// ── §5 six-state end-to-end ──────────────────────────────────────────────

const STATE_CASES = [
  { key: 'UNIQUE', name: 'UNIQUE', reasonCode: 'UNIQUE_ELIGIBLE_CANDIDATE', uiState: 'UNIQUE', hasPrimary: true },
  { key: 'MULTIPLE', name: 'MULTIPLE', reasonCode: 'MULTIPLE_SUPPORTED_MODELS', uiState: 'MULTIPLE', hasPrimary: false },
  { key: 'NO_PRIMARY', name: 'NO_PRIMARY', reasonCode: 'NO_SUPPORTED_DEFICIT', uiState: 'NO_PRIMARY', hasPrimary: false },
  { key: 'INSUFFICIENT', name: 'INSUFFICIENT', reasonCode: 'INSUFFICIENT_DIRECTIONAL_EVIDENCE', uiState: 'INSUFFICIENT', hasPrimary: false },
  { key: 'CONTRADICTORY', name: 'CONTRADICTORY', reasonCode: 'CONTRADICTORY_EVIDENCE', uiState: 'CONTRADICTORY', hasPrimary: false },
  { key: 'BLOCKED', name: 'BLOCKED', reasonCode: 'BLOCKED_BY_RESPONSE_VALIDITY', uiState: 'BLOCKED', hasPrimary: false },
]

test('§5 six-state E2E: diagnosis → Presentation Truth → Report → UI (6/6)', () => {
  for (const s of STATE_CASES) {
    const chain = s.key === 'UNIQUE' ? UNIQUE.SYSTEMS : MS[s.key]
    const cm = chain.contentModel
    const vm = chain.vm
    // layer 1: engine reasonCode (UNIQUE uses engine decision; others from diagnosisState)
    if (s.key === 'UNIQUE') {
      assert.strictEqual(chain.cognition.decision.reasonCode, s.reasonCode, `${s.name}: engine reasonCode`)
    }
    // layer 2: Presentation Truth diagnosisState
    assert.strictEqual(chain.pm.diagnosisState.reasonCode, s.reasonCode, `${s.name}: pm reasonCode`)
    // layer 3: Report content model diagnosisState
    assert.strictEqual(cm.diagnosisState.reasonCode, s.reasonCode, `${s.name}: cm reasonCode`)
    // layer 4: UI semantic state
    assert.strictEqual(vm.uiState, s.uiState, `${s.name}: vm uiState`)
    assert.strictEqual(vm.hasPrimary, s.hasPrimary, `${s.name}: vm hasPrimary`)
    // primary passthrough consistency
    assert.strictEqual(cm.diagnosisState.primaryBlindSpotId, chain.pm.diagnosisState.primaryBlindSpotId, `${s.name}: primary passthrough`)
  }
})

test('§5 MULTIPLE: fabricated primary=0, false insufficient=0', () => {
  const { contentModel: cm, vm } = MS.MULTIPLE
  assert.strictEqual(cm.diagnosisState.primaryBlindSpotId, null, 'FABRICATED_PRIMARY=0')
  const v = sec(cm, '01_COGNITIVE_VERDICT')
  assert.ok(!v.body || !v.body.blindSpotLabel, 'FABRICATED_PRIMARY=0 (label)')
  const strings = [...renderedStrings(vm), ...collectUserStrings(cm)].join('\n')
  assert.ok(!/回答不足|证据不足|不足以形成/.test(strings), 'FALSE_INSUFFICIENT_FOR_MULTIPLE=0')
  assert.strictEqual(vm.uiState, 'MULTIPLE')
})

test('§5 NO_PRIMARY: pathology invented=0', () => {
  const { contentModel: cm, vm } = MS.NO_PRIMARY
  assert.strictEqual(cm.diagnosisState.primaryBlindSpotId, null)
  const strings = [...renderedStrings(vm), ...collectUserStrings(cm)].join('\n')
  assert.ok(!/隐藏|缺陷|盲区|问题模型|病理/.test(strings), 'PATHOLOGY_INVENTED=0')
})

test('§5 INSUFFICIENT: true insufficiency explicit', () => {
  const { contentModel: cm, vm } = MS.INSUFFICIENT
  assert.strictEqual(cm.diagnosisState.reasonCode, 'INSUFFICIENT_DIRECTIONAL_EVIDENCE')
  assert.strictEqual(cm.diagnosisState.primaryBlindSpotId, null)
  assert.strictEqual(vm.uiState, 'INSUFFICIENT')
})

test('§5 CONTRADICTORY: fake winner=0', () => {
  const { contentModel: cm, vm } = MS.CONTRADICTORY
  assert.strictEqual(cm.diagnosisState.reasonCode, 'CONTRADICTORY_EVIDENCE')
  assert.strictEqual(cm.diagnosisState.primaryBlindSpotId, null)
  const v = sec(cm, '01_COGNITIVE_VERDICT')
  assert.ok(!v.body || !v.body.blindSpotLabel, 'FAKE_WINNER=0')
  assert.strictEqual(vm.uiState, 'CONTRADICTORY')
})

test('§5 BLOCKED/NOT_EXECUTED: diagnosis content rendered=0', () => {
  for (const key of ['BLOCKED', 'NOT_EXECUTED']) {
    const { contentModel: cm, vm } = MS[key]
    assert.strictEqual(cm.diagnosisState.primaryBlindSpotId, null, `${key}: primary null`)
    assert.strictEqual(vm.uiState, 'BLOCKED', `${key}: uiState BLOCKED`)
    assert.strictEqual(vm.verdict, null, `${key}: DIAGNOSIS_CONTENT_RENDERED=0 (verdict)`)
    assert.strictEqual(vm.evidence, null, `${key}: DIAGNOSIS_CONTENT_RENDERED=0 (evidence)`)
    assert.strictEqual(vm.worldRule, null, `${key}: DIAGNOSIS_CONTENT_RENDERED=0 (worldRule)`)
    assert.ok(vm.stateMessage.length > 0, `${key}: neutral state message`)
  }
})

// ── §6 all 9 blind-spot end-to-end ────────────────────────────────────────

test('§6 all 9 blind-spot E2E: diagnosis→principle→strategy→presentation→report→UI', () => {
  let count = 0
  for (const construct of CONSTRUCTS_V21) {
    const blindSpot = CONSTRUCT_TO_BLINDSPOT[construct]
    const chain = UNIQUE[construct]
    const cm = chain.contentModel
    const vm = chain.vm

    // diagnosis: engine primary + reasonCode
    assert.strictEqual(chain.cognition.decision.primaryBlindSpotId, blindSpot, `${blindSpot}: engine primary`)
    assert.strictEqual(chain.cognition.decision.reasonCode, 'UNIQUE_ELIGIBLE_CANDIDATE', `${blindSpot}: engine reason`)
    // Presentation Truth passthrough
    assert.strictEqual(chain.pm.diagnosisState.primaryBlindSpotId, blindSpot, `${blindSpot}: pm primary`)
    // Report content model passthrough
    assert.strictEqual(cm.diagnosisState.primaryBlindSpotId, blindSpot, `${blindSpot}: cm primary`)
    // principle match (authoritative)
    const authoritative = getPrinciplesForBlindSpot(blindSpot)[0]
    assert.strictEqual(authoritative.id, GOLDEN.GOLDEN_MAPPING[blindSpot].principle, `${blindSpot}: principle mapping`)
    const wr = sec(cm, '03_WORLD_RULE_ALIGNMENT')
    assert.strictEqual(wr.body.source.principleId, authoritative.id, `${blindSpot}: world-rule principle`)
    // strategy match (authoritative)
    const up = sec(cm, '06_COGNITIVE_UPGRADE')
    assert.strictEqual(up.body.source.strategyId, BLIND_SPOT_TO_STRATEGY_V2[blindSpot], `${blindSpot}: strategy`)
    assert.strictEqual(up.body.source.blindSpotId, blindSpot, `${blindSpot}: upgrade blindSpot`)
    // UI semantics
    assert.strictEqual(vm.uiState, 'UNIQUE', `${blindSpot}: uiState`)
    assert.ok(vm.verdict && vm.verdict.summary.length > 8, `${blindSpot}: human verdict`)
    assert.ok(vm.currentModel && vm.currentModel.statement.length > 0, `${blindSpot}: current model`)
    assert.ok(vm.worldRule && vm.worldRule.worldRule && vm.worldRule.misalignment, `${blindSpot}: world rule + misalignment`)
    assert.ok(vm.evidence && vm.evidence.items.length >= 2, `${blindSpot}: evidence`)
    assert.ok(vm.consequence && vm.consequence.consequence.length > 0, `${blindSpot}: consequence`)
    assert.ok(vm.upgrade && vm.upgrade.upgradedModel.length > 8, `${blindSpot}: upgrade`)
    assert.ok(vm.protocol && vm.protocol.steps.length >= 3, `${blindSpot}: protocol`)
    assert.ok(vm.scenario && vm.scenario.currentModel.likelyDecisionPattern.length > 0 && vm.scenario.upgradedModel.likelyDecisionPattern.length > 0, `${blindSpot}: scenario shift`)
    // no generic primary fallback
    assert.ok(!GENERIC_PRIMARY_FALLBACK_RE.test(vm.verdict.summary), `${blindSpot}: generic fallback`)
    count++
  }
  assert.strictEqual(count, 9, 'BLIND_SPOT_E2E=9/9')
})

// ── §7 R4.5 reference fixture ─────────────────────────────────────────────

test('§7 R4.5 reference E2E: SYSTEM_THINKING_GAP full chain', () => {
  const chain = UNIQUE.SYSTEMS
  const cm = chain.contentModel
  const vm = chain.vm
  const ev = sec(cm, '04_WHY_WE_JUDGE_THIS')

  assert.strictEqual(chain.cognition.decision.primaryBlindSpotId, 'SYSTEM_THINKING_GAP')
  assert.strictEqual(chain.cognition.decision.reasonCode, 'UNIQUE_ELIGIBLE_CANDIDATE')

  // evidence preserved
  assert.strictEqual(ev.body.items.length, 2, '2 evidence items')
  const qids = ev.body.items.map((i) => i.source.questionId).sort()
  assert.deepStrictEqual(qids, ['SC_SYS_01', 'SC_SYS_02'], 'SC_SYS_01/02 preserved')
  const q1 = ev.body.items.find((i) => i.source.questionId === 'SC_SYS_01')
  assert.strictEqual(q1.source.optionId, 'D', 'SC_SYS_01:D attribution-blind preserved')

  // world principle + strategy preserved
  assert.strictEqual(sec(cm, '03_WORLD_RULE_ALIGNMENT').body.source.principleId, 'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR')
  assert.strictEqual(sec(cm, '06_COGNITIVE_UPGRADE').body.source.strategyId, 'BUILD_DECISION_SYSTEM')

  // archetype secondary
  assert.strictEqual(vm.secondary.archetype.label, '执行者', 'OPERATOR secondary')
  assert.ok(vm.secondary.archetype.description.length > 0, 'archetype description')

  // human verdict + 2 evidence explanations + protocol + scenario shift
  assert.ok(vm.verdict.summary.length > 8, 'human verdict')
  assert.strictEqual(vm.evidence.items.length, 2, '2 visible evidence explanations')
  assert.ok(vm.protocol.steps.length >= 3, 'decision protocol')
  assert.ok(vm.scenario.currentModel.likelyDecisionPattern.length > 0 && vm.scenario.upgradedModel.likelyDecisionPattern.length > 0, 'scenario model shift')

  // no leakage
  const strings = renderedStrings(vm)
  assert.ok(!strings.some((s) => RAW_SCHEMA_RE.test(s)), 'no raw token')
  assert.ok(!strings.some((s) => reportBuilder.isEnglishParagraph(s)), 'no English')
  assert.ok(!strings.some((s) => FORTUNE_TELLING_RE.test(s)), 'no fortune telling')
  assert.ok(!strings.some((s) => FAKE_PERCENTAGE_RE.test(s)), 'no percentage')
})

// ── §8 authority DAG ──────────────────────────────────────────────────────

function walkFiles(dir) {
  const out = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.js')) out.push(p)
    }
  }
  walk(dir)
  return out
}

test('§8 authority DAG: one-way downward ENGINE→PRESENTATION→REPORT→UI', () => {
  const engineRoot = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/engine')
  const presRoot = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/presentation')
  const reportDir = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report')
  const pageDir = path.join(ROOT, 'pages/v21-cognitive-report')
  const vmFile = path.join(ROOT, 'utils/northStarReportViewModel.js')

  // ENGINE imports upward (presentation/report/UI) = 0
  for (const p of walkFiles(engineRoot)) {
    const src = fs.readFileSync(p, 'utf8')
    assert.ok(!/presentation\//.test(src), `ENGINE_IMPORTS_PRESENTATION: ${p}`)
    assert.ok(!/northStarReport/.test(src), `ENGINE_IMPORTS_REPORT: ${p}`)
    assert.ok(!/pages\/v21-cognitive-report/.test(src), `ENGINE_IMPORTS_UI: ${p}`)
  }

  // PRESENTATION imports report/UI = 0 (non-report presentation modules)
  const presDir = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1')
  for (const f of fs.readdirSync(presDir)) {
    if (f === 'report' || !f.endsWith('.js')) continue
    const src = fs.readFileSync(path.join(presDir, f), 'utf8')
    assert.ok(!/report\//.test(src), `PRESENTATION_IMPORTS_REPORT: ${f}`)
    assert.ok(!/pages\/v21-cognitive-report/.test(src), `PRESENTATION_IMPORTS_UI: ${f}`)
  }

  // REPORT imports UI = 0 + no rederive + no shadow
  for (const f of fs.readdirSync(reportDir)) {
    if (!f.endsWith('.js')) continue
    const src = fs.readFileSync(path.join(reportDir, f), 'utf8')
    assert.ok(!/pages\/v21-cognitive-report/.test(src), `REPORT_IMPORTS_UI: ${f}`)
    assert.ok(!/decidePrimaryV21|runCognitionChainV21|primaryDecisionEngineV21|blindSpotCandidateEngineV21/.test(src), `REPORT_REDERIVES_DIAGNOSIS: ${f}`)
    assert.ok(!/BLIND_SPOT_TO_DIMENSION_MODEL|SCENARIO_PATTERN_COPY|getDimensionModelForBlindSpot|getScenarioPatterns\s*\(|BLIND_SPOT_TO_STRATEGY/.test(src), `REPORT_SHADOW_SEMANTIC_AUTHORITY: ${f}`)
  }

  // UI rederive/shadow = 0
  const uiSrc = ['v21-cognitive-report.js', 'v21-cognitive-report.wxml'].map((f) => fs.readFileSync(path.join(pageDir, f), 'utf8')).join('\n') + fs.readFileSync(vmFile, 'utf8')
  assert.ok(!/lib\/engine\//.test(uiSrc), 'UI_REDERIVES_DIAGNOSIS (engine import)')
  assert.ok(!/blindSpotId\s*===|strategyId\s*===|getPrinciplesForBlindSpot|BLIND_SPOT_TO|scenarioSimulation|simulateScenario|getScenarioPattern/.test(uiSrc), 'UI_SHADOW_SEMANTIC_AUTHORITY')
})

// ── §9 output non-interference ────────────────────────────────────────────

test('§9 output non-interference: determinism + passthrough (diff=0)', () => {
  // Determinism: rebuild the same input twice → deep-equal at every layer.
  const answers = uniquePrimaryAnswers('SYSTEMS')
  const a = buildFull(answers)
  const b = buildFull(answers)
  assert.deepStrictEqual(a.cognition, b.cognition, 'DIAGNOSIS_OUTPUT_DIFF_COUNT=0')
  assert.deepStrictEqual(a.pm, b.pm, 'STAGE1C_B_OUTPUT_DIFF_COUNT=0')
  assert.deepStrictEqual(a.contentModel, b.contentModel, 'STAGE1C_C_OUTPUT_DIFF_COUNT=0')
  assert.deepStrictEqual(a.vm, b.vm, 'STAGE1C_D_SEMANTIC_OUTPUT_DIFF_COUNT=0')

  // Passthrough: diagnosis primary preserved through every layer (no layer alters it).
  for (const construct of CONSTRUCTS_V21) {
    const chain = UNIQUE[construct]
    const bs = chain.cognition.decision.primaryBlindSpotId
    assert.strictEqual(chain.pm.diagnosisState.primaryBlindSpotId, bs, `${construct}: pm passthrough`)
    assert.strictEqual(chain.contentModel.diagnosisState.primaryBlindSpotId, bs, `${construct}: cm passthrough`)
  }
})

// ── §10 schema / copy / safety gate ───────────────────────────────────────

test('§10 schema/copy/safety: all user-visible strings clean (all 15 cases)', () => {
  const strings = allRenderedStrings()
  assert.ok(strings.length > 0, 'rendered strings present')
  let rawToken = 0, english = 0, prediction = 0, wealth = 0, pct = 0, fortune = 0, generic = 0
  for (const s of strings) {
    if (RAW_SCHEMA_RE.test(s)) rawToken++
    if (reportBuilder.isEnglishParagraph(s)) english++
    if (reportValidator.FORBIDDEN_PREDICTION_TOKENS.some((t) => s.indexOf(t) !== -1)) prediction++
    if (reportValidator.WEALTH_PROMISE_TOKENS.some((t) => s.indexOf(t) !== -1)) wealth++
    if (FAKE_PERCENTAGE_RE.test(s)) pct++
    if (FORTUNE_TELLING_RE.test(s)) fortune++
    if (GENERIC_PRIMARY_FALLBACK_RE.test(s)) generic++
  }
  assert.strictEqual(rawToken, 0, 'RAW_INTERNAL_TOKEN_RENDER_PATHS')
  assert.strictEqual(english, 0, 'USER_VISIBLE_ENGLISH_PARAGRAPH_COUNT')
  assert.strictEqual(prediction, 0, 'UNSUPPORTED_PREDICTION_COUNT')
  assert.strictEqual(wealth, 0, 'WEALTH_PROMISE_COUNT')
  assert.strictEqual(pct, 0, 'FAKE_PERCENTAGE_COUNT')
  assert.strictEqual(fortune, 0, 'FORTUNE_TELLING_COUNT')
  assert.strictEqual(generic, 0, 'GENERIC_PRIMARY_FALLBACK_COUNT')
})

// ── §11 P2 duplication governance ─────────────────────────────────────────

test('§11 P2 duplication: known debt detected, growth=0', () => {
  const cm = UNIQUE.SYSTEMS.contentModel
  const cur = sec(cm, '02_CURRENT_WORLD_MODEL')
  const wr = sec(cm, '03_WORLD_RULE_ALIGNMENT')
  // known debt: currentModel.summary === worldRule.userModel (Stage1C-C origin)
  assert.strictEqual(cur.summary, wr.body.userModel, 'P2_CURRENT_MODEL_WORLD_RULE_DUPLICATION=OPEN detected')
  // growth must be 0: no additional primary-section summary duplication
  const summaries = cm.sections.map((s) => s.summary).filter((s) => s.length >= 8)
  const seen = new Set()
  let growth = 0
  for (const s of summaries) {
    if (seen.has(s)) growth++
    seen.add(s)
  }
  assert.strictEqual(growth, 0, 'DUPLICATION_GROWTH_COUNT=0')
})

// ── §12 release-gate mutations R1..R6 ─────────────────────────────────────

function cloneReport(cm) {
  return JSON.parse(JSON.stringify(cm))
}

test('§12 R1 delete world rule → caught', () => {
  const m = cloneReport(UNIQUE.SYSTEMS.contentModel)
  m.sections = m.sections.filter((s) => s.sectionId !== '03_WORLD_RULE_ALIGNMENT')
  const r = reportBuilder.validateNorthStarReportV21(m)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.some((e) => e === 'WORLD_RULE_MISSING' || e.startsWith('MANDATORY_SECTION_MISSING')), r.errors.join(','))
})

test('§12 R2 fabricate MULTIPLE primary → caught', () => {
  const m = cloneReport(MS.MULTIPLE.contentModel)
  m.diagnosisState.primaryBlindSpotId = 'SYSTEM_THINKING_GAP'
  const r = reportBuilder.validateNorthStarReportV21(m)
  assert.ok(r.errors.some((e) => e === 'FABRICATED_PRIMARY_IN_MULTIPLE'), r.errors.join(','))
})

test('§12 R3 report shadow strategy mapping → caught', () => {
  const reportDir = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report')
  for (const f of fs.readdirSync(reportDir)) {
    if (!f.endsWith('.js')) continue
    const src = fs.readFileSync(path.join(reportDir, f), 'utf8')
    assert.ok(!/BLIND_SPOT_TO_STRATEGY|getStrategyForBlindSpot/.test(src), `${f}: report shadow strategy mapping`)
  }
})

test('§12 R4 UI blindspot-specific branch → caught', () => {
  const vmSrc = fs.readFileSync(path.join(ROOT, 'utils/northStarReportViewModel.js'), 'utf8')
  const pageJs = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.js'), 'utf8')
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.wxml'), 'utf8')
  for (const src of [vmSrc, pageJs, wxml]) {
    assert.ok(!/blindSpotId\s*===/.test(src), 'UI blindspot-specific branch')
    assert.ok(!/case\s+['"](DECISION|FEEDBACK|PROBABILITY|RISK|LEVERAGE|TIME|IDENTITY|OPPORTUNITY|SYSTEMS)['"]/.test(src), 'UI construct branch')
  }
})

test('§12 R5 leak reasonCode into WXML → caught', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.wxml'), 'utf8')
  assert.ok(!/reasonCode/.test(wxml), 'WXML must not bind reasonCode')
  // view-model must not expose reasonCode to user-visible output
  const vm = UNIQUE.SYSTEMS.vm
  assert.ok(!JSON.stringify(vm).includes('reasonCode'), 'VM output must not contain reasonCode')
})

test('§12 R6 turn scenario into deterministic prediction → caught', () => {
  const m = cloneReport(UNIQUE.SYSTEMS.contentModel)
  const sc = m.sections.find((s) => s.sectionId === '08_SCENARIO_CONTRAST')
  sc.body.simulationNote = '成功率提升到 90%'
  sc.body.upgradedModel.likelyDecisionPattern[0] = '你一定会成功，命运已经注定'
  const r = reportBuilder.validateNorthStarReportV21(m)
  assert.ok(r.errors.some((e) => e.startsWith('UNSUPPORTED_PREDICTION')), r.errors.join(','))
})

// ── §13 Report Golden governance validity ─────────────────────────────────

test('§13 Report Golden governance: explanation-only, not inference tuning', () => {
  // Report Golden data layer must not import engine or mutate any diagnosis source.
  const goldenSrc = fs.readFileSync(path.join(ROOT, 'tests/fixtures/reportGoldenV21.js'), 'utf8')
  assert.ok(!/require\(/.test(goldenSrc), 'REPORT_GOLDEN_CHANGES_ENGINE=NO (no engine import)')
  assert.ok(!/primaryDecisionEngineV21|blindSpotCandidateEngineV21|runCognitionChainV21|decidePrimaryV21/.test(goldenSrc), 'REPORT_GOLDEN_CHANGES_THRESHOLDS=NO (no engine call)')
  // Golden mapping mirrors frozen authority; it must NOT define new labels.
  assert.ok(!/RESELECT|PRIMARY\s*[:=]\s*['"]/.test(goldenSrc), 'REPORT_GOLDEN_RESELECTS_PRIMARY=NO')
  // The mapping keys are exactly the 9 frozen blind spots.
  const mappingKeys = Object.keys(GOLDEN.GOLDEN_MAPPING).sort()
  const expected = [
    'DECISION_INERTIA', 'FEEDBACK_LOOP_GAP', 'IDENTITY_CONSTRAINT', 'LEVERAGE_MODEL_GAP',
    'OPPORTUNITY_BLINDNESS', 'PROBABILITY_MISJUDGMENT', 'RISK_MODEL_DISTORTION',
    'SYSTEM_THINKING_GAP', 'TIME_HORIZON_TRAP',
  ].sort()
  assert.deepStrictEqual(mappingKeys, expected, 'REPORT_GOLDEN_CHANGES_DIAGNOSIS_LABELS=NO (9 frozen blind spots)')
})
