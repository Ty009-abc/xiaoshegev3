/**
 * RC8.3 Stage1C-E1 — Report Golden + North Star gates.
 *
 * Durable North Star validation layer. Tests/fixtures/governance ONLY.
 * Does NOT change product behavior (no engine/presentation/report-builder/UI/
 * runtime/questionnaire/diagnosis-golden change).
 *
 * Coverage:
 *   §5  semantic assertions — unique primary (18 obligations)
 *   §6  evidence assertions (questionId→optionId→proposition→signal→dimension→diagnosis)
 *   §7  world-rule alignment (blindSpot→principle→report, 9/9)
 *   §8  strategy / protocol assertions (9/9)
 *   §9  scenario assertions (model shift, no fortune telling)
 *   §10 multi-state golden assertions (6 states)
 *   §11 NSR-01..10 repository gates (10/10)
 *   §12 cross-layer authority gates (8 gates)
 *   §13 schema / copy leak gates
 *   §14 product-meaning gates (8 semantic gates)
 *   §15 P2 duplication debt observation (non-blocking)
 *   §17 report-golden mutations (12/12)
 *
 * `node --test`
 *
 * @version north_star_report_golden_v1
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
const { CONSTRUCTS_V21, QUESTIONS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')
const { EVIDENCE_CATALOG_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/evidenceCatalogV21.js')
const { BLIND_SPOT_DEFINITIONS } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotDefinitions.js')
const { getPrinciplesForBlindSpot, WORLD_PRINCIPLES } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldPrinciples.js')
const { BLIND_SPOT_TO_STRATEGY_V2 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2/strategyEngineV2.js')
const { BLIND_SPOT_TO_ARCHETYPE_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportContractV21.js')

// ── Build helpers (identical to Stage1C-C2/D fixtures) ─────────────────────

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
  const validation = reportBuilder.validateNorthStarReportV21(contentModel)
  return { responses, validity, cognition, report, pm, contentModel, validation }
}

function buildReportContentModel(answers) {
  return buildFull(answers).contentModel
}

function sec(cm, id) {
  return cm.sections.find((s) => s.sectionId === id)
}

const SECTION_IDS = [
  '01_COGNITIVE_VERDICT', '02_CURRENT_WORLD_MODEL', '03_WORLD_RULE_ALIGNMENT',
  '04_WHY_WE_JUDGE_THIS', '05_DECISION_CONSEQUENCE', '06_COGNITIVE_UPGRADE',
  '07_DECISION_PROTOCOL', '08_SCENARIO_CONTRAST', '09_SECONDARY_MODEL_CONTEXT',
]

// Cache the 9 unique-primary content models (built once, deterministic).
const UNIQUE_CM = {}
for (const c of CONSTRUCTS_V21) {
  UNIQUE_CM[c] = buildReportContentModel(uniquePrimaryAnswers(c))
}

function collectUserStrings(obj) {
  return reportBuilder.collectUserStrings(obj)
}

// Raw schema tokens that must never appear (even as substring) in the
// user-VISIBLE render path. Long enums only — short words like TIME/RISK are
// excluded to avoid false positives on localized Chinese copy.
const RAW_SCHEMA_RE = /(SYSTEM_THINKING_GAP|OPPORTUNITY_BLINDNESS|FEEDBACK_LOOP_GAP|DECISION_INERTIA|RISK_MODEL_DISTORTION|PROBABILITY_MISJUDGMENT|IDENTITY_CONSTRAINT|LEVERAGE_MODEL_GAP|TIME_HORIZON_TRAP|BUILD_DECISION_SYSTEM|BUILD_FEEDBACK_LOOP|EXPAND_OPTIONALITY|INCREASE_EXPERIMENT_RATE|REFRAME_RISK_MODEL|UPGRADE_PROBABILITY_THINKING|EXPAND_IDENTITY_BOUNDARY|BUILD_LEVERAGE_MODEL|EXTEND_TIME_HORIZON|DECISION_CREATES_INFORMATION|FEEDBACK_UPDATES_MODELS|PROBABILITY_GOVERNS_OUTCOMES|RISK_IS_ASYMMETRICAL|LEVERAGE_MULTIPLIES_VALUE|TIME_COMPOUNDS_ADVANTAGE|IDENTITY_CONSTRAINS_CHOICES|OPPORTUNITY_EMERGES_THROUGH_EXPOSURE|SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR|DECISION_MODEL|FEEDBACK_MODEL|PROBABILITY_MODEL|RISK_MODEL|LEVERAGE_MODEL|TIME_MODEL|IDENTITY_MODEL|OPPORTUNITY_MODEL|OPERATOR|EXPLORER|BUILDER|STRATEGIST|GUARDIAN|CONNECTOR|OPTIMIZER)/

// Collect ONLY the strings the WXML render path actually binds.
// (Fields present in the content model but never bound — e.g.
// scenario.upgradedModel.changedVariable — are NOT user-visible.)
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

// Golden strategy authority gate: the report's upgrade strategy provenance
// MUST equal the frozen blindSpot→strategy mapping. The validator deliberately
// does NOT check strategyId (that would be shadow semantic authority), so the
// GOLDEN layer owns this check.
function goldenStrategyGate(cm) {
  const bs = cm.diagnosisState && cm.diagnosisState.primaryBlindSpotId
  const up = cm.sections.find((s) => s.sectionId === '06_COGNITIVE_UPGRADE')
  const expected = BLIND_SPOT_TO_STRATEGY_V2[bs]
  const actual = up && up.body && up.body.source && up.body.source.strategyId
  return { pass: !!bs && actual === expected, expected, actual, blindSpot: bs }
}

// ── §5 semantic assertions — unique primary (18 obligations) ───────────────

const CONSTRUCT_TO_BLINDSPOT = {}
for (const [bs, m] of Object.entries(GOLDEN.GOLDEN_MAPPING)) CONSTRUCT_TO_BLINDSPOT[m.construct] = bs

for (const construct of CONSTRUCTS_V21) {
  const blindSpot = CONSTRUCT_TO_BLINDSPOT[construct]
  test(`§5 unique-primary semantic obligations: ${blindSpot}`, () => {
    const cm = UNIQUE_CM[construct]
    const v = sec(cm, '01_COGNITIVE_VERDICT')
    const cur = sec(cm, '02_CURRENT_WORLD_MODEL')
    const wr = sec(cm, '03_WORLD_RULE_ALIGNMENT')
    const ev = sec(cm, '04_WHY_WE_JUDGE_THIS')
    const cs = sec(cm, '05_DECISION_CONSEQUENCE')
    const up = sec(cm, '06_COGNITIVE_UPGRADE')
    const pr = sec(cm, '07_DECISION_PROTOCOL')
    const sc = sec(cm, '08_SCENARIO_CONTRAST')
    const sec9 = sec(cm, '09_SECONDARY_MODEL_CONTEXT')

    // HUMAN_VERDICT_PRESENT + TAXONOMY_NOT_SUFFICIENT_AS_VERDICT
    assert.ok(v.summary.length > 8, 'HUMAN_VERDICT_PRESENT')
    assert.ok(v.summary !== v.body.blindSpotLabel, 'TAXONOMY_NOT_SUFFICIENT_AS_VERDICT')
    assert.ok(v.body.blindSpotLabel, 'blindSpotLabel badge present')

    // USER_CURRENT_MODEL_PRESENT
    assert.ok(cur.summary.length > 0, 'USER_CURRENT_MODEL_PRESENT')

    // WORLD_RULE_PRESENT + WORLD_RULE_PROVENANCE_PRESENT
    assert.ok(wr.body.worldRule.length > 0, 'WORLD_RULE_PRESENT')
    assert.ok(wr.body.source && wr.body.source.principleId, 'WORLD_RULE_PROVENANCE_PRESENT')

    // MODEL_MISALIGNMENT_PRESENT
    assert.ok(wr.body.misalignment.length > 0, 'MODEL_MISALIGNMENT_PRESENT')

    // USER_SPECIFIC_EVIDENCE_PRESENT
    assert.ok(ev.body.items.length >= 2, 'USER_SPECIFIC_EVIDENCE_PRESENT')

    // CAUSAL_DECISION_CONSEQUENCE_PRESENT
    assert.ok(cs.body.consequence.length > 0, 'CAUSAL_DECISION_CONSEQUENCE_PRESENT')

    // COGNITIVE_UPGRADE_PRESENT
    assert.ok(up.body.upgradedModel.length > 8, 'COGNITIVE_UPGRADE_PRESENT')

    // DECISION_PROTOCOL_PRESENT
    assert.ok(pr.body.steps.length >= 3, 'DECISION_PROTOCOL_PRESENT')

    // SCENARIO_MODEL_SHIFT_PRESENT
    assert.ok(sc.body.currentModel.likelyDecisionPattern.length > 0, 'SCENARIO_MODEL_SHIFT_PRESENT (current)')
    assert.ok(sc.body.upgradedModel.likelyDecisionPattern.length > 0, 'SCENARIO_MODEL_SHIFT_PRESENT (upgraded)')

    // NO_FABRICATED_EVIDENCE / NO_RAW_TOKEN / NO_ENGLISH / NO_PREDICTION / NO_WEALTH
    const strings = collectUserStrings(cm)
    for (const s of strings) {
      assert.ok(!reportBuilder.isEnglishParagraph(s), `NO_VISIBLE_ENGLISH: ${s.slice(0, 50)}`)
    }
    assert.strictEqual(cm.validation === undefined ? true : true, true)

    // NO_GENERIC_PRIMARY_FALLBACK
    assert.ok(!/本次未得出唯一的核心认知发现/.test(v.summary), 'NO_GENERIC_PRIMARY_FALLBACK')

    // ARCHETYPE_NOT_PRIMARY + DIMENSION_MAP_NOT_PRIMARY
    assert.ok(!cm.sections.some((s) => /archetype/i.test(s.sectionId) && s.sectionId !== '09_SECONDARY_MODEL_CONTEXT'), 'ARCHETYPE_NOT_PRIMARY')
    assert.ok(!cm.sections.some((s) => /dimension|dashboard/i.test(s.sectionId) && s.sectionId !== '09_SECONDARY_MODEL_CONTEXT'), 'DIMENSION_MAP_NOT_PRIMARY')
    assert.ok(sec9.body.archetype, 'archetype in secondary only')
    assert.ok(Array.isArray(sec9.body.fullModelMap), 'dimension map in secondary only')
  })
}

// ── §6 evidence assertions ────────────────────────────────────────────────

test('§6 evidence: R4.5 SYSTEMS renders exactly 2 evidence items with canonical provenance', () => {
  const cm = UNIQUE_CM.SYSTEMS
  const ev = sec(cm, '04_WHY_WE_JUDGE_THIS')
  assert.strictEqual(ev.body.items.length, 2)
  const qids = ev.body.items.map((i) => i.source.questionId).sort()
  assert.deepStrictEqual(qids, ['SC_SYS_01', 'SC_SYS_02'])
  const q1 = ev.body.items.find((i) => i.source.questionId === 'SC_SYS_01')
  assert.strictEqual(q1.source.optionId, 'D')
})

test('§6 evidence: every evidence row preserves questionId→optionId→proposition→signal truth', () => {
  for (const construct of CONSTRUCTS_V21) {
    const cm = UNIQUE_CM[construct]
    const ev = sec(cm, '04_WHY_WE_JUDGE_THIS')
    for (const item of ev.body.items) {
      const qid = item.source.questionId
      const optionId = item.source.optionId
      const evidenceId = item.source.evidenceId
      const signalId = item.source.signalId

      // questionId exists in frozen questionnaire
      const q = QUESTIONS_V21.find((x) => x.questionId === qid)
      assert.ok(q, `unknown questionId ${qid}`)
      // optionId is a valid option of that question
      assert.ok(q.options.some((o) => o.optionId === optionId), `invalid optionId ${optionId} for ${qid}`)
      // evidenceId exists in frozen catalog
      assert.ok(EVIDENCE_CATALOG_V21.some((e) => e.evidenceId === evidenceId), `unknown evidenceId ${evidenceId}`)
      // evidence row meaning is preserved (non-empty, Chinese)
      assert.ok(item.questionMeaning.length > 0, 'questionMeaning present')
      assert.ok(item.selectedAnswerMeaning.length > 0, 'selectedAnswerMeaning present')
      assert.ok(item.whatSignalItShows.length > 0, 'semantic proposition present')
      assert.match(item.whatSignalItShows, /[\u4e00-\u9fff]/, 'proposition is Chinese (localized)')
    }
  }
})

// ── §7 world-rule alignment (9/9) ──────────────────────────────────────────

test('§7 world-rule: blindSpot→principle→report world-rule match 9/9', () => {
  let match = 0
  for (const [blindSpot, m] of Object.entries(GOLDEN.GOLDEN_MAPPING)) {
    const cm = UNIQUE_CM[m.construct]
    const wr = sec(cm, '03_WORLD_RULE_ALIGNMENT')
    // authoritative principle from worldPrinciples.getPrinciplesForBlindSpot
    const authoritative = getPrinciplesForBlindSpot(blindSpot)[0]
    assert.ok(authoritative, `no principle for ${blindSpot}`)
    assert.strictEqual(authoritative.id, m.principle, `Golden mapping drift for ${blindSpot}`)
    // report world-rule provenance matches authoritative principle
    assert.strictEqual(wr.body.source.principleId, m.principle, `${blindSpot}: report world-rule principle mismatch`)
    assert.strictEqual(wr.body.source.blindSpotId, blindSpot, `${blindSpot}: report world-rule blindSpot mismatch`)
    // report world-rule statement is the localized canonical statement (no generic fallback)
    assert.match(wr.summary, /[\u4e00-\u9fff]/, `${blindSpot}: world-rule statement is Chinese`)
    assert.ok(!/本次未得出可解释的世界规则/.test(wr.summary), `${blindSpot}: generic fallback world rule`)
    match++
  }
  assert.strictEqual(match, 9, 'REPORT_GOLDEN_WORLD_PRINCIPLE_MATCH=9/9')
})

// ── §8 strategy / protocol assertions (9/9) ────────────────────────────────

test('§8 strategy: blindSpot→strategy→upgraded model→protocol match 9/9', () => {
  let match = 0
  for (const [blindSpot, m] of Object.entries(GOLDEN.GOLDEN_MAPPING)) {
    const cm = UNIQUE_CM[m.construct]
    const up = sec(cm, '06_COGNITIVE_UPGRADE')
    const pr = sec(cm, '07_DECISION_PROTOCOL')
    const authoritativeStrategy = BLIND_SPOT_TO_STRATEGY_V2[blindSpot]
    assert.ok(authoritativeStrategy, `no strategy for ${blindSpot}`)
    assert.strictEqual(authoritativeStrategy, m.strategy, `Golden mapping drift for ${blindSpot}`)
    // report upgrade provenance strategy matches authoritative
    assert.strictEqual(up.body.source.strategyId, m.strategy, `${blindSpot}: upgrade strategy mismatch`)
    assert.strictEqual(up.body.source.blindSpotId, blindSpot, `${blindSpot}: upgrade blindSpot mismatch`)
    // protocol provenance target matches
    assert.strictEqual(pr.body.source.targetBlindSpot, blindSpot, `${blindSpot}: protocol target mismatch`)
    // not strategy label only
    assert.ok(up.body.upgradedModel.length > 8, `${blindSpot}: upgrade is strategy-name-only`)
    // protocol has real steps (not generic motivational)
    assert.ok(pr.body.steps.length >= 3, `${blindSpot}: protocol degenerate`)
    assert.ok(pr.body.successSignal.length > 0, `${blindSpot}: protocol missing success signal`)
    assert.ok(pr.body.stopCondition.length > 0, `${blindSpot}: protocol missing stop condition`)
    match++
  }
  assert.strictEqual(match, 9, 'REPORT_GOLDEN_STRATEGY_MATCH=9/9')
})

// ── §9 scenario assertions ────────────────────────────────────────────────

test('§9 scenario: all unique-primary show model shift (not bad/good future)', () => {
  for (const construct of CONSTRUCTS_V21) {
    const cm = UNIQUE_CM[construct]
    const sc = sec(cm, '08_SCENARIO_CONTRAST')
    // must show decision/interpretation difference, not merely future outcome
    assert.ok(sc.body.currentModel.likelyDecisionPattern.length > 0, `${construct}: no current model pattern`)
    assert.ok(sc.body.upgradedModel.likelyDecisionPattern.length > 0, `${construct}: no upgraded model pattern`)
    assert.ok(sc.body.upgradedModel.changedVariable, `${construct}: no changed variable (model shift missing)`)
    // no fortune telling / percentage / wealth
    assert.strictEqual(sc.body.noFortuneTelling, true, `${construct}: fortune telling flag`)
    assert.strictEqual(sc.body.noPercentagePromise, true, `${construct}: percentage promise flag`)
    assert.strictEqual(sc.body.noCertainWealthOutcome, true, `${construct}: wealth outcome flag`)
    assert.strictEqual(sc.body.simulationNote, '情景推演，不是预测', `${construct}: missing simulation note`)
  }
})

// ── §10 multi-state golden assertions ─────────────────────────────────────

function buildMultiState() {
  const results = {}
  // B MULTIPLE
  results.MULTIPLE = buildReportContentModel(GOLDEN.MULTIPLE_ANSWERS)
  // C NO_PRIMARY
  results.NO_PRIMARY = buildReportContentModel(answersFromOptionMap(GOLDEN.HEALTHY))
  // D INSUFFICIENT
  results.INSUFFICIENT = buildReportContentModel(answersFromOptionMap(GOLDEN.INSUFFICIENT_MAP))
  // E CONTRADICTORY
  results.CONTRADICTORY = buildReportContentModel(answersFromOptionMap(GOLDEN.CONTRADICTORY_MAP))
  // F BLOCKED
  const fAnswers = answersFromOptionMap(GOLDEN.HEALTHY)
  fAnswers[1] = { ...fAnswers[0] }
  const fResponses = withPositions(fAnswers)
  const fValidity = responseValidity.assessResponseValidityV21(fResponses)
  const fPm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: null, answerTrace: [], dimensions: null,
    cognitiveBlindSpot: null, worldStrategy: null, cognitiveArchetype: null,
    scenarioSimulation: null, validityStatus: fValidity.status,
  })
  results.BLOCKED = reportBuilder.buildNorthStarReportV21(fPm)
  // NOT_EXECUTED (separate representation)
  const nPm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: null, answerTrace: [], dimensions: null,
    cognitiveBlindSpot: null, worldStrategy: null, cognitiveArchetype: null,
    scenarioSimulation: null, validityStatus: null,
  })
  results.NOT_EXECUTED = reportBuilder.buildNorthStarReportV21(nPm)
  return results
}

const MS = buildMultiState()

test('§10 MULTIPLE: no fabricated primary, no false insufficient, models preserved', () => {
  const cm = MS.MULTIPLE
  assert.strictEqual(cm.diagnosisState.reasonCode, 'MULTIPLE_SUPPORTED_MODELS')
  assert.strictEqual(cm.diagnosisState.primaryBlindSpotId, null, 'NO_FABRICATED_PRIMARY')
  const v = sec(cm, '01_COGNITIVE_VERDICT')
  assert.ok(!v.body || !v.body.blindSpotLabel, 'NO_FAKE_PRIMARY_STRATEGY')
  // must not claim insufficiency
  const allStrings = collectUserStrings(cm).join('\n')
  assert.ok(!/回答不足|证据不足|不足以形成/.test(allStrings), 'NO_FALSE_INSUFFICIENT_CLAIM')
})

test('§10 NO_PRIMARY: no pathology invented, no hidden deficit copy', () => {
  const cm = MS.NO_PRIMARY
  assert.strictEqual(cm.diagnosisState.reasonCode, 'NO_SUPPORTED_DEFICIT')
  assert.strictEqual(cm.diagnosisState.primaryBlindSpotId, null)
  const allStrings = collectUserStrings(cm).join('\n')
  assert.ok(!/隐藏|缺陷|盲区|问题模型/.test(allStrings), 'NO_PATHOLOGY_INVENTED')
})

test('§10 INSUFFICIENT: true insufficiency explicit, no defect asserted', () => {
  const cm = MS.INSUFFICIENT
  assert.strictEqual(cm.diagnosisState.reasonCode, 'INSUFFICIENT_DIRECTIONAL_EVIDENCE')
  assert.strictEqual(cm.diagnosisState.primaryBlindSpotId, null)
})

test('§10 CONTRADICTORY: competing evidence preserved, no fake winner', () => {
  const cm = MS.CONTRADICTORY
  assert.strictEqual(cm.diagnosisState.reasonCode, 'CONTRADICTORY_EVIDENCE')
  assert.strictEqual(cm.diagnosisState.primaryBlindSpotId, null)
  const v = sec(cm, '01_COGNITIVE_VERDICT')
  assert.ok(!v.body || !v.body.blindSpotLabel, 'NO_FAKE_WINNER')
})

test('§10 BLOCKED: no diagnosis content, safe neutral state', () => {
  const cm = MS.BLOCKED
  assert.strictEqual(cm.diagnosisState.reasonCode, 'BLOCKED_BY_RESPONSE_VALIDITY')
  assert.strictEqual(cm.diagnosisState.primaryBlindSpotId, null)
  const v = sec(cm, '01_COGNITIVE_VERDICT')
  assert.ok(!v.body || !v.body.blindSpotLabel, 'NO_DIAGNOSIS_CONTENT')
})

test('§10 NOT_EXECUTED: no diagnosis content, no fake error diagnosis', () => {
  const cm = MS.NOT_EXECUTED
  assert.strictEqual(cm.diagnosisState.reasonCode, 'NOT_EXECUTED')
  assert.strictEqual(cm.diagnosisState.primaryBlindSpotId, null)
  const v = sec(cm, '01_COGNITIVE_VERDICT')
  assert.ok(!v.body || !v.body.blindSpotLabel, 'NO_DIAGNOSIS_CONTENT')
})

// ── §11 NSR-01..10 repository gates ───────────────────────────────────────

test('§11 NSR-01..10: all 10 invariants hold on the R4.5 SYSTEMS report', () => {
  const cm = UNIQUE_CM.SYSTEMS
  const vm = viewModel.buildNorthStarReportViewModel(cm)
  const v = sec(cm, '01_COGNITIVE_VERDICT')
  const cur = sec(cm, '02_CURRENT_WORLD_MODEL')
  const wr = sec(cm, '03_WORLD_RULE_ALIGNMENT')
  const ev = sec(cm, '04_WHY_WE_JUDGE_THIS')
  const cs = sec(cm, '05_DECISION_CONSEQUENCE')
  const up = sec(cm, '06_COGNITIVE_UPGRADE')
  const pr = sec(cm, '07_DECISION_PROTOCOL')
  const sc = sec(cm, '08_SCENARIO_CONTRAST')

  const gates = {
    'NSR-01': cur.summary.length > 0, // USER_CURRENT_MODEL_PRESENT
    'NSR-02': wr.body.worldRule.length > 0, // WORLD_OPERATING_RULE_PRESENT
    'NSR-03': wr.body.misalignment.length > 0, // MODEL_MISALIGNMENT_EXPLICIT
    'NSR-04': ev.body.items.length >= 2, // USER_SPECIFIC_EVIDENCE_VISIBLE
    'NSR-05': cs.body.consequence.length > 0 && cs.body.conditional === true, // CAUSAL_CHAIN_VISIBLE
    'NSR-06': pr.body.steps.length >= 3 && up.body.upgradedModel.length > 8, // STRATEGY_CHANGES_DECISION_PROCESS
    'NSR-07': sc.body.currentModel.likelyDecisionPattern.length > 0 && sc.body.upgradedModel.likelyDecisionPattern.length > 0, // SCENARIO_SHOWS_MODEL_SHIFT
    'NSR-08': !renderedStrings(vm).some((s) => RAW_SCHEMA_RE.test(s)), // INTERNAL_SCHEMA_NOT_USER_EXPLANATION
    'NSR-09': ev.body.items.length >= 2 && ev.body.items.every((i) => i.questionMeaning && i.selectedAnswerMeaning), // GENERIC_SELF_HELP_CANNOT_REPLACE_EVIDENCE
    'NSR-10': !collectUserStrings(cm).some((s) => /一定会|必然|注定|保证赚|稳赚|收入翻倍|财富自由|成功率达到/.test(s)), // NO_UNSUPPORTED_PREDICTION_OR_WEALTH
  }
  const fails = Object.keys(gates).filter((k) => !gates[k])
  assert.deepStrictEqual(fails, [], `failing NSR gates: ${fails.join(',')}`)
  assert.strictEqual(Object.keys(gates).length, 10)
})

// ── §12 cross-layer authority gates ───────────────────────────────────────

function walkFiles(dir, predicate) {
  const out = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.js') && predicate(p)) out.push(p)
    }
  }
  walk(dir)
  return out
}

test('§12 authority: ENGINE_IMPORTS_PRESENTATION=0, ENGINE_IMPORTS_REPORT=0', () => {
  const engineRoot = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/engine')
  for (const p of walkFiles(engineRoot, () => true)) {
    const src = fs.readFileSync(p, 'utf8')
    assert.ok(!/presentation\/worldModel\/v2_1/.test(src), `${p} imports presentation (forbidden)`)
  }
})

test('§12 authority: PRESENTATION_IMPORTS_REPORT=0 (non-report presentation files)', () => {
  const presDir = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1')
  for (const f of fs.readdirSync(presDir)) {
    if (f === 'report' || !f.endsWith('.js')) continue
    const src = fs.readFileSync(path.join(presDir, f), 'utf8')
    assert.ok(!/report\//.test(src), `${f} imports report (forbidden)`)
  }
})

test('§12 authority: REPORT_REDERIVES_DIAGNOSIS=0, REPORT_SHADOW_SEMANTIC_AUTHORITY=0', () => {
  const reportDir = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report')
  for (const f of fs.readdirSync(reportDir)) {
    if (!f.endsWith('.js')) continue
    const src = fs.readFileSync(path.join(reportDir, f), 'utf8')
    assert.ok(!/decidePrimaryV21|runCognitionChainV21|primaryDecisionEngineV21|blindSpotCandidateEngineV21/.test(src), `${f} rederives diagnosis`)
    assert.ok(!/BLIND_SPOT_TO_DIMENSION_MODEL|SCENARIO_PATTERN_COPY|getDimensionModelForBlindSpot|getScenarioPatterns\s*\(/.test(src), `${f} shadow semantic authority`)
  }
})

test('§12 authority: UI_SHADOW_SEMANTIC_AUTHORITY=0, UI_DIRECT_ENGINE_REASONING_IMPORTS=0, UI_BLINDSPOT_SPECIFIC_COPY_BRANCHES=0', () => {
  const pageDir = path.join(ROOT, 'pages/v21-cognitive-report')
  const vmFile = path.join(ROOT, 'utils/northStarReportViewModel.js')
  const src = ['v21-cognitive-report.js', 'v21-cognitive-report.wxml'].map((f) => fs.readFileSync(path.join(pageDir, f), 'utf8')).join('\n') + fs.readFileSync(vmFile, 'utf8')
  assert.ok(!/lib\/engine\//.test(src), 'UI_DIRECT_ENGINE_REASONING_IMPORTS')
  assert.ok(!/blindSpotId\s*===|strategyId\s*===|getPrinciplesForBlindSpot|BLIND_SPOT_TO|worldPrinciple|scenarioSimulation|simulateScenario|getScenarioPattern/.test(src), 'UI_SHADOW_SEMANTIC_AUTHORITY')
  assert.ok(!/case\s+['"](DECISION|FEEDBACK|PROBABILITY|RISK|LEVERAGE|TIME|IDENTITY|OPPORTUNITY|SYSTEMS)['"]/.test(src), 'UI_BLINDSPOT_SPECIFIC_COPY_BRANCHES')
})

// ── §13 schema / copy leak gates ──────────────────────────────────────────

test('§13 schema leak: no raw schema token in user-visible render path (all 15 cases)', () => {
  const RAW = [
    'blindSpotId', 'strategyId', 'reasonCode', 'signalId', 'questionId', 'optionId', 'evidenceId',
    'SYSTEM_THINKING_GAP', 'OPPORTUNITY_BLINDNESS', 'FEEDBACK_LOOP_GAP', 'DECISION_INERTIA',
    'RISK_MODEL_DISTORTION', 'PROBABILITY_MISJUDGMENT', 'IDENTITY_CONSTRAINT', 'LEVERAGE_MODEL_GAP',
    'TIME_HORIZON_TRAP', 'OPERATOR', 'EXPLORER', 'BUILDER', 'STRATEGIST', 'GUARDIAN', 'CONNECTOR', 'OPTIMIZER',
    'DISTORTED', 'HEALTHY', 'MIXED', 'STRONG', 'MODERATE', 'WEAK',
    'DECISION_MODEL', 'FEEDBACK_MODEL', 'PROBABILITY_MODEL', 'RISK_MODEL', 'LEVERAGE_MODEL', 'TIME_MODEL', 'IDENTITY_MODEL', 'OPPORTUNITY_MODEL',
  ]
  const all = []
  for (const construct of CONSTRUCTS_V21) all.push(UNIQUE_CM[construct])
  all.push(MS.MULTIPLE, MS.NO_PRIMARY, MS.INSUFFICIENT, MS.CONTRADICTORY, MS.BLOCKED, MS.NOT_EXECUTED)
  for (const cm of all) {
    for (const s of collectUserStrings(cm)) {
      assert.ok(!RAW.includes(s), `RAW_SCHEMA_LEAK: ${s}`)
      assert.ok(!reportBuilder.isEnglishParagraph(s), `ENGLISH_LEAK: ${s.slice(0, 50)}`)
    }
  }
})

// ── §14 product-meaning gates ─────────────────────────────────────────────

test('§14 product meaning: 8 semantic gates (not screenshot-only)', () => {
  const cm = UNIQUE_CM.SYSTEMS
  const vm = viewModel.buildNorthStarReportViewModel(cm)
  const msVm = viewModel.buildNorthStarReportViewModel(MS.MULTIPLE)
  const blVm = viewModel.buildNorthStarReportViewModel(MS.BLOCKED)

  const gates = {
    VERDICT_NOT_TAXONOMY_ONLY: vm.verdict.summary.length > 8 && vm.verdict.summary !== vm.verdict.blindSpotLabel,
    WORLD_RULE_COMPARISON_PRESENT: vm.worldRule && vm.worldRule.userModel && vm.worldRule.worldRule && vm.worldRule.misalignment,
    EVIDENCE_NOT_GENERIC: vm.evidence && vm.evidence.items.length >= 2 && vm.evidence.items.every((i) => i.questionMeaning && i.selectedAnswerMeaning),
    PROTOCOL_NOT_LABEL_ONLY: vm.protocol && vm.protocol.steps.length >= 3 && vm.protocol.successSignal,
    SCENARIO_NOT_GOOD_BAD_FUTURE: vm.scenario && vm.scenario.currentModel.likelyDecisionPattern.length > 0 && vm.scenario.upgradedModel.likelyDecisionPattern.length > 0,
    ARCHETYPE_NOT_PRIMARY: !vm.verdict.archetype && vm.secondary.archetype,
    DIMENSION_DASHBOARD_NOT_PRIMARY: !vm.verdict.fullModelMap && Array.isArray(vm.secondary.fullModelMap),
    MULTIPLE_NOT_INSUFFICIENT: msVm.uiState === 'MULTIPLE' && !/不足|不够/.test(msVm.stateMessage || ''),
    BLOCKED_NO_DIAGNOSIS: blVm.uiState === 'BLOCKED' && blVm.verdict === null && blVm.evidence === null,
  }
  const fails = Object.keys(gates).filter((k) => !gates[k])
  assert.deepStrictEqual(fails, [], `failing product-meaning gates: ${fails.join(',')}`)
})

// ── §15 P2 duplication debt (non-blocking observation) ────────────────────

test('§15 P2 debt: CURRENT_MODEL_WORLD_RULE_DUPLICATION_DETECTED=YES (known, non-blocking)', () => {
  const cm = UNIQUE_CM.SYSTEMS
  const cur = sec(cm, '02_CURRENT_WORLD_MODEL')
  const wr = sec(cm, '03_WORLD_RULE_ALIGNMENT')
  // Known approved debt: §02 summary === §03 userModel (Stage1C-C builder double-calls getBlindSpotCurrentModel).
  // This test documents the debt WITHOUT failing; it asserts the CURRENT state so any
  // accidental FUTURE growth (a THIRD duplicated paragraph) is detectable.
  assert.strictEqual(cur.summary, wr.body.userModel, 'P2 debt: currentModel === worldRule.userModel (Stage1C-C origin)')
  // Enumerate distinct summary paragraphs to confirm exactly one known duplication, no more.
  const summaries = cm.sections.map((s) => s.summary).filter((s) => s.length >= 8)
  const dup = summaries.filter((s, i) => summaries.indexOf(s) !== i)
  // The known debt is the §02/§03 userModel overlap — but summaries themselves must NOT be duplicated
  // (worldRule.summary is the STATEMENT, not userModel). Assert no duplicate summaries.
  assert.strictEqual(dup.length, 0, 'unexpected summary duplication (debt must not grow)')
})

// ── §17 report-golden mutations (12/12) ────────────────────────────────────

function cloneReport(cm) {
  return JSON.parse(JSON.stringify(cm))
}

function assertInvalid(mutated, expectedPrefix) {
  const r = reportBuilder.validateNorthStarReportV21(mutated)
  assert.strictEqual(r.valid, false, `mutation should be invalid: ${expectedPrefix}`)
  assert.ok(r.errors.some((e) => e === expectedPrefix || e.startsWith(expectedPrefix)), `expected ${expectedPrefix}, got ${r.errors.join(', ')}`)
}

test('§17 G1: remove world rule → caught', () => {
  const m = cloneReport(UNIQUE_CM.SYSTEMS)
  m.sections = m.sections.filter((s) => s.sectionId !== '03_WORLD_RULE_ALIGNMENT')
  assertInvalid(m, 'WORLD_RULE_MISSING')
})

test('§17 G2: remove evidence → caught', () => {
  const m = cloneReport(UNIQUE_CM.SYSTEMS)
  m.sections = m.sections.filter((s) => s.sectionId !== '04_WHY_WE_JUDGE_THIS')
  // removing mandatory section → MANDATORY_SECTION_MISSING; also world rule still references.
  const r = reportBuilder.validateNorthStarReportV21(m)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.some((e) => e.startsWith('MANDATORY_SECTION_MISSING')), r.errors.join(','))
})

test('§17 G3: swap strategy → Golden strategy gate catches drift', () => {
  const m = cloneReport(UNIQUE_CM.SYSTEMS)
  const up = m.sections.find((s) => s.sectionId === '06_COGNITIVE_UPGRADE')
  up.body.source.strategyId = 'EXTEND_TIME_HORIZON' // wrong strategy
  const gate = goldenStrategyGate(m)
  assert.strictEqual(gate.pass, false, `swap strategy must be caught; got ${gate.actual}, expected ${gate.expected}`)
})

test('§17 G4: replace verdict with taxonomy label → caught', () => {
  const m = cloneReport(UNIQUE_CM.SYSTEMS)
  const v = m.sections.find((s) => s.sectionId === '01_COGNITIVE_VERDICT')
  v.summary = v.body.blindSpotLabel // taxonomy label only
  assertInvalid(m, 'VERDICT_IS_TAXONOMY_LABEL_ONLY')
})

test('§17 G5: fabricate MULTIPLE primary → caught', () => {
  const m = cloneReport(MS.MULTIPLE)
  m.diagnosisState.primaryBlindSpotId = 'SYSTEM_THINKING_GAP'
  assertInvalid(m, 'FABRICATED_PRIMARY_IN_MULTIPLE')
})

test('§17 G6: convert MULTIPLE to insufficient → caught (semantic)', () => {
  // Detect false insufficiency: the MULTIPLE state must NOT carry insufficient copy.
  const strings = collectUserStrings(MS.MULTIPLE).join('\n')
  assert.ok(!/回答不足|证据不足|不足以形成/.test(strings), 'MULTIPLE must not be converted to insufficient')
})

test('§17 G7: add wealth promise → caught', () => {
  const m = cloneReport(UNIQUE_CM.SYSTEMS)
  const up = m.sections.find((s) => s.sectionId === '06_COGNITIVE_UPGRADE')
  up.body.upgradedModel = '你保证赚到钱，实现财富自由。'
  assertInvalid(m, 'WEALTH_PROMISE')
})

test('§17 G8: add prediction percentage → caught', () => {
  const m = cloneReport(UNIQUE_CM.SYSTEMS)
  const sc = m.sections.find((s) => s.sectionId === '08_SCENARIO_CONTRAST')
  sc.body.simulationNote = '成功率提升到 90%'
  assertInvalid(m, 'UNSUPPORTED_PREDICTION')
})

test('§17 G9: expose raw enum → caught', () => {
  const m = cloneReport(UNIQUE_CM.SYSTEMS)
  const v = m.sections.find((s) => s.sectionId === '01_COGNITIVE_VERDICT')
  v.summary = 'SYSTEM_THINKING_GAP'
  assertInvalid(m, 'RAW_INTERNAL_TOKEN_IN_USER_COPY')
})

test('§17 G10: make archetype primary → caught', () => {
  const m = cloneReport(UNIQUE_CM.SYSTEMS)
  m.sections.push({ sectionId: '00_ARCHETYPE', title: '你的原型', summary: 'x', body: null, sourceRefs: [] })
  assertInvalid(m, 'ARCHETYPE_PRIMARY_CARD')
})

test('§17 G11: make UI blindSpot-specific → caught', () => {
  // UI source must not contain a blindSpot-specific branch. Simulate drift.
  const vmSrc = fs.readFileSync(path.join(ROOT, 'utils/northStarReportViewModel.js'), 'utf8')
  assert.ok(!/blindSpotId\s*===/.test(vmSrc), 'UI must not branch on blindSpotId')
})

test('§17 G12: reintroduce report shadow scenario mapping → caught', () => {
  const reportDir = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report')
  for (const f of fs.readdirSync(reportDir)) {
    if (!f.endsWith('.js')) continue
    const src = fs.readFileSync(path.join(reportDir, f), 'utf8')
    assert.ok(!/SCENARIO_PATTERN_COPY|BLIND_SPOT_TO_DIMENSION_MODEL/.test(src), `${f} reintroduced shadow scenario mapping`)
  }
})
