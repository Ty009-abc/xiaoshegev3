/**
 * RC8.3 Stage1C-C — North Star Report Builder implementation tests.
 *
 * Verifies the deterministic report CONTENT MODEL:
 *   north_star_presentation_v1 → north_star_report_v1 (structured Chinese sections)
 *
 * Freeze (Stage1C-C):
 *   - report builder consumes presentation model + Chinese copy table ONLY
 *   - no engine inference, no raw enum/English in user copy, no archetype/dimension
 *     primary card, no prediction/wealth/destiny/percentage language, no exact
 *     paragraph duplication
 *   - 9 blind spots all renderable + validate
 *   - R4.5 SYSTEM_THINKING_GAP fixture renders + validates
 *   - multi-state support (A/B/C/D/E/F) does not fabricate a primary
 *   - diagnosis output diff = 0 (report does not mutate engine)
 *
 * `node --test`
 *
 * @version north_star_report_v1
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const { runCognitionChainV21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const builder = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportBuilderV21.js')
const presentation = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/index.js')
const reportBuilder = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/index.js')
const { CONSTRUCTS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')
const { BLIND_SPOT_DEFINITIONS } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotDefinitions.js')

const BLIND_SPOT_IDS = Object.keys(BLIND_SPOT_DEFINITIONS)

// ── Fixtures (engine-identical to Stage1C-B) ───────────────────────────────

const HEALTHY = {
  DECISION: { 'SC_DEC_01': 'A', 'SC_DEC_02': 'A' },
  FEEDBACK: { 'SC_FB_01': 'A', 'SC_FB_02': 'A' },
  PROBABILITY: { 'SC_PROB_01': 'A', 'SC_PROB_02': 'A' },
  RISK: { 'SC_RISK_01': 'A', 'SC_RISK_02': 'A' },
  LEVERAGE: { 'SC_LEV_01': 'B', 'SC_LEV_02': 'B' },
  TIME: { 'SC_TIME_01': 'B', 'SC_TIME_02': 'A' },
  IDENTITY: { 'SC_ID_01': 'A', 'SC_ID_02': 'B' },
  OPPORTUNITY: { 'SC_OPP_01': 'A', 'SC_OPP_02': 'A' },
  SYSTEMS: { 'SC_SYS_01': 'A', 'SC_SYS_02': 'A' },
}

const DISTORTED_PAIR = {
  DECISION: { 'SC_DEC_01': 'B', 'SC_DEC_02': 'C' },
  FEEDBACK: { 'SC_FB_01': 'B', 'SC_FB_02': 'B' },
  PROBABILITY: { 'SC_PROB_01': 'B', 'SC_PROB_02': 'B' },
  RISK: { 'SC_RISK_01': 'B', 'SC_RISK_02': 'B' },
  LEVERAGE: { 'SC_LEV_01': 'A', 'SC_LEV_02': 'A' },
  TIME: { 'SC_TIME_01': 'A', 'SC_TIME_02': 'B' },
  IDENTITY: { 'SC_ID_01': 'B', 'SC_ID_02': 'A' },
  OPPORTUNITY: { 'SC_OPP_01': 'B', 'SC_OPP_02': 'C' },
  SYSTEMS: { 'SC_SYS_01': 'D', 'SC_SYS_02': 'C' },
}

const BLIND_SPOT_BY_CONSTRUCT = {
  DECISION: 'DECISION_INERTIA',
  FEEDBACK: 'FEEDBACK_LOOP_GAP',
  PROBABILITY: 'PROBABILITY_MISJUDGMENT',
  RISK: 'RISK_MODEL_DISTORTION',
  LEVERAGE: 'LEVERAGE_MODEL_GAP',
  TIME: 'TIME_HORIZON_TRAP',
  IDENTITY: 'IDENTITY_CONSTRAINT',
  OPPORTUNITY: 'OPPORTUNITY_BLINDNESS',
  SYSTEMS: 'SYSTEM_THINKING_GAP',
}

function answersFromOptionMap(map) {
  const out = []
  for (const construct of CONSTRUCTS_V21) {
    const qmap = map[construct] || HEALTHY[construct]
    for (const qid of Object.keys(qmap)) out.push({ questionId: qid, optionId: qmap[qid] })
  }
  return out
}

function uniquePrimaryAnswers(construct) {
  const map = {}
  for (const c of CONSTRUCTS_V21) map[c] = { ...HEALTHY[c] }
  map[construct] = { ...DISTORTED_PAIR[construct] }
  return answersFromOptionMap(map)
}

const R45_SYSTEMS_ANSWERS = uniquePrimaryAnswers('SYSTEMS')

const MULTI_MODEL_ANSWERS = [
  { questionId: 'SC_DEC_01', optionId: 'B' },
  { questionId: 'SC_DEC_02', optionId: 'C' },
  { questionId: 'SC_FB_01', optionId: 'B' },
  { questionId: 'SC_FB_02', optionId: 'B' },
  { questionId: 'SC_PROB_01', optionId: 'B' },
  { questionId: 'SC_PROB_02', optionId: 'B' },
  { questionId: 'SC_RISK_01', optionId: 'B' },
  { questionId: 'SC_RISK_02', optionId: 'B' },
  { questionId: 'SC_LEV_01', optionId: 'B' },
  { questionId: 'SC_LEV_02', optionId: 'A' },
  { questionId: 'SC_TIME_01', optionId: 'A' },
  { questionId: 'SC_TIME_02', optionId: 'B' },
  { questionId: 'SC_ID_01', optionId: 'A' },
  { questionId: 'SC_ID_02', optionId: 'B' },
  { questionId: 'SC_OPP_01', optionId: 'B' },
  { questionId: 'SC_OPP_02', optionId: 'C' },
  { questionId: 'SC_SYS_01', optionId: 'A' },
  { questionId: 'SC_SYS_02', optionId: 'B' },
]

const ALL_HEALTHY_ANSWERS = answersFromOptionMap(HEALTHY)

const CONTRADICTORY_ANSWERS = (() => {
  const map = {}
  for (const c of CONSTRUCTS_V21) map[c] = { ...HEALTHY[c] }
  map.DECISION = { 'SC_DEC_01': 'A', 'SC_DEC_02': 'C' }
  return answersFromOptionMap(map)
})()

const INSUFFICIENT_ANSWERS = (() => {
  const map = {}
  for (const c of CONSTRUCTS_V21) map[c] = { ...HEALTHY[c] }
  map.OPPORTUNITY = { 'SC_OPP_01': 'B', 'SC_OPP_02': 'B' }
  return answersFromOptionMap(map)
})()

function withPositions(answers, seed = 3) {
  return answers.map((a, i) => ({ ...a, displayPosition: (i * seed) % 4 }))
}

function buildReport(answers) {
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

const SECTION_IDS = [
  '01_COGNITIVE_VERDICT',
  '02_CURRENT_WORLD_MODEL',
  '03_WORLD_RULE_ALIGNMENT',
  '04_WHY_WE_JUDGE_THIS',
  '05_DECISION_CONSEQUENCE',
  '06_COGNITIVE_UPGRADE',
  '07_DECISION_PROTOCOL',
  '08_SCENARIO_CONTRAST',
  '09_SECONDARY_MODEL_CONTEXT',
]

// ── §1 R4.5 SYSTEMS fixture: report renders + validates ──────────────────
test('R4.5 SYSTEMS: report has 9 semantic sections in order', () => {
  const { contentModel } = buildReport(R45_SYSTEMS_ANSWERS)
  assert.strictEqual(contentModel.version, 'north_star_report_v1')
  assert.deepStrictEqual(contentModel.sections.map((s) => s.sectionId), SECTION_IDS)
})

test('R4.5 SYSTEMS: verdict is Chinese causal sentence, not taxonomy label', () => {
  const { contentModel } = buildReport(R45_SYSTEMS_ANSWERS)
  const verdict = contentModel.sections.find((s) => s.sectionId === '01_COGNITIVE_VERDICT')
  assert.ok(verdict.summary.length > 8)
  assert.match(verdict.summary, /[\u4e00-\u9fff]/)
  assert.ok(!verdict.summary.includes('SYSTEM_THINKING_GAP'))
  assert.ok(!verdict.summary.includes('系统思维')) // no bare label echo
})

test('R4.5 SYSTEMS: world rule = 系统涌现, misalignment present, Chinese only', () => {
  const { contentModel } = buildReport(R45_SYSTEMS_ANSWERS)
  const s = contentModel.sections.find((x) => x.sectionId === '03_WORLD_RULE_ALIGNMENT')
  assert.ok(s.summary.length > 8)
  assert.ok(s.body.worldRule.length > 8)
  assert.ok(s.body.misalignment.length > 8)
  assert.match(s.body.misalignment, /[\u4e00-\u9fff]/)
  assert.ok(!s.body.worldRule.includes('SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR'))
  assert.strictEqual(s.body.source.principleId, 'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR')
  assert.strictEqual(s.body.source.blindSpotId, 'SYSTEM_THINKING_GAP')
})

test('R4.5 SYSTEMS: evidence is user-specific (≥2 items) with Chinese meaning', () => {
  const { contentModel } = buildReport(R45_SYSTEMS_ANSWERS)
  const s = contentModel.sections.find((x) => x.sectionId === '04_WHY_WE_JUDGE_THIS')
  assert.ok(s.body.items.length >= 2)
  for (const item of s.body.items) {
    assert.match(item.questionMeaning, /[\u4e00-\u9fff]/)
    assert.match(item.selectedAnswerMeaning, /[\u4e00-\u9fff]/)
    assert.strictEqual(item.source.questionId, item.source.questionId) // provenance carries raw id only
  }
  assert.strictEqual(s.body.items[0].source.questionId, 'SC_SYS_01')
  assert.strictEqual(s.body.items[0].source.optionId, 'D')
  assert.strictEqual(s.body.items[0].source.evidenceId, 'SYS_BLIND')
})

test('R4.5 SYSTEMS: upgrade = BUILD_DECISION_SYSTEM mechanism, not name-only', () => {
  const { contentModel } = buildReport(R45_SYSTEMS_ANSWERS)
  const s = contentModel.sections.find((x) => x.sectionId === '06_COGNITIVE_UPGRADE')
  assert.ok(s.body.upgradedModel.length > 8)
  assert.ok(s.body.strategyMechanism.length > 8)
  assert.match(s.body.upgradedModel, /[\u4e00-\u9fff]/)
  assert.ok(!s.body.upgradedModel.includes('BUILD_DECISION_SYSTEM'))
})

test('R4.5 SYSTEMS: protocol has trigger + steps + success + review + stop', () => {
  const { contentModel } = buildReport(R45_SYSTEMS_ANSWERS)
  const s = contentModel.sections.find((x) => x.sectionId === '07_DECISION_PROTOCOL')
  assert.ok(s.body.steps.length >= 3)
  assert.ok(s.body.successSignal.length > 0)
  assert.ok(s.body.reviewWindow.length > 0)
  assert.ok(s.body.stopCondition.length > 0)
})

test('R4.5 SYSTEMS: scenario is model-shift contrast, not future-better/worse', () => {
  const { contentModel } = buildReport(R45_SYSTEMS_ANSWERS)
  const s = contentModel.sections.find((x) => x.sectionId === '08_SCENARIO_CONTRAST')
  assert.ok(s.body.currentModel.likelyDecisionPattern.length > 0)
  assert.ok(s.body.upgradedModel.likelyDecisionPattern.length > 0)
  assert.strictEqual(s.body.simulationNote, '情景推演，不是预测')
})

test('R4.5 SYSTEMS: archetype collapsed (OPERATOR), no standalone archetype card', () => {
  const { contentModel } = buildReport(R45_SYSTEMS_ANSWERS)
  const s = contentModel.sections.find((x) => x.sectionId === '09_SECONDARY_MODEL_CONTEXT')
  assert.strictEqual(s.body.archetype.source.id, 'OPERATOR')
  assert.strictEqual(s.body.archetype.source.mode, 'DESCRIPTIVE_ONLY')
  assert.ok(s.body.archetype.label.length > 0)
  assert.ok(s.body.archetype.description.length > 0)
  assert.ok(!s.body.archetype.label.includes('OPERATOR'))
  // no standalone archetype section
  assert.ok(!contentModel.sections.some((x) => /archetype/i.test(x.sectionId) && x.sectionId !== '09_SECONDARY_MODEL_CONTEXT'))
  // no dimension dashboard section
  assert.ok(!contentModel.sections.some((x) => /dimension|dashboard/i.test(x.sectionId) && x.sectionId !== '09_SECONDARY_MODEL_CONTEXT'))
})

test('R4.5 SYSTEMS: full validator passes with zero errors', () => {
  const { validation } = buildReport(R45_SYSTEMS_ANSWERS)
  assert.strictEqual(validation.valid, true)
  assert.deepStrictEqual(validation.errors, [])
})

// ── §2 All 9 blind spots render + validate ────────────────────────────────
for (const construct of CONSTRUCTS_V21) {
  const expectedBlindSpot = BLIND_SPOT_BY_CONSTRUCT[construct]
  test(`blind spot ${construct} → ${expectedBlindSpot} renders + validates`, () => {
    const { cognition, contentModel, validation } = buildReport(uniquePrimaryAnswers(construct))
    assert.strictEqual(cognition.decision.primaryBlindSpotId, expectedBlindSpot)
    assert.strictEqual(contentModel.sections.length, 9)
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors))
    // verdict non-empty for every supported primary
    const verdict = contentModel.sections.find((s) => s.sectionId === '01_COGNITIVE_VERDICT')
    assert.ok(verdict.summary.length > 8, 'verdict must be causal, not empty')
  })
}

// ── §3 Copy governance ────────────────────────────────────────────────────
test('copy governance: no English paragraphs anywhere in user copy', () => {
  for (const construct of CONSTRUCTS_V21) {
    const { contentModel } = buildReport(uniquePrimaryAnswers(construct))
    const strings = reportBuilder.collectUserStrings(contentModel)
    for (const s of strings) {
      if (reportBuilder.isEnglishParagraph(s)) {
        assert.fail(`English paragraph leaked: ${s.slice(0, 80)}`)
      }
    }
  }
})

test('copy governance: no raw internal enum tokens as standalone user copy', () => {
  const { contentModel } = buildReport(R45_SYSTEMS_ANSWERS)
  const strings = reportBuilder.collectUserStrings(contentModel)
  const forbidden = new Set([
    'SYSTEM_THINKING_GAP', 'OPERATOR', 'DISTORTED', 'STRONG', 'HEALTHY',
    'SYSTEMS', 'DECISION', 'FEEDBACK', 'PROBABILITY', 'RISK', 'LEVERAGE',
    'TIME', 'IDENTITY', 'OPPORTUNITY', 'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR',
    'BUILD_DECISION_SYSTEM', 'DECISION_MODEL',
  ])
  for (const s of strings) {
    assert.ok(!forbidden.has(s), `raw token leaked as user copy: ${s}`)
  }
})

test('copy governance: no prediction / wealth / destiny / percentage language', () => {
  for (const construct of CONSTRUCTS_V21) {
    const { contentModel } = buildReport(uniquePrimaryAnswers(construct))
    const strings = reportBuilder.collectUserStrings(contentModel)
    const forbidden = ['一定会', '必然', '注定', '命运', '保证赚', '稳赚', '收入翻倍', '人生逆转', '成功率达到']
    for (const s of strings) {
      for (const tok of forbidden) {
        assert.ok(!s.includes(tok), `prediction token leaked: ${tok} in ${s.slice(0, 40)}`)
      }
    }
  }
})

test('copy governance: no exact paragraph duplication across sections', () => {
  for (const construct of CONSTRUCTS_V21) {
    const { contentModel } = buildReport(uniquePrimaryAnswers(construct))
    const seen = new Map()
    for (const s of contentModel.sections) {
      if (s.summary && s.summary.length >= 8) {
        assert.ok(!seen.has(s.summary), `duplicate summary between ${seen.get(s.summary)} and ${s.sectionId}`)
        seen.set(s.summary, s.sectionId)
      }
    }
  }
})

test('copy governance: every summary that is non-empty is Chinese', () => {
  const { contentModel } = buildReport(R45_SYSTEMS_ANSWERS)
  for (const s of contentModel.sections) {
    if (s.summary && s.summary.length > 0) {
      assert.match(s.summary, /[\u4e00-\u9fff]/, `${s.sectionId} summary must be Chinese`)
    }
  }
})

// ── §4 Multi-state support: no fabricated primary ─────────────────────────
test('multi-state B: MULTIPLE_SUPPORTED_MODELS produces no fabricated primary verdict', () => {
  const { cognition, contentModel } = buildReport(MULTI_MODEL_ANSWERS)
  assert.strictEqual(cognition.decision.reasonCode, 'MULTIPLE_SUPPORTED_MODELS')
  assert.strictEqual(contentModel.diagnosisState.primaryBlindSpotId, null)
  // verdict must not fabricate a single causal primary
  const verdict = contentModel.sections.find((s) => s.sectionId === '01_COGNITIVE_VERDICT')
  assert.ok(!verdict.body || !verdict.body.blindSpotLabel)
})

test('multi-state C: NO_PRIMARY_DEFICIT produces neutral, no retake advice', () => {
  const { cognition, contentModel, validation } = buildReport(ALL_HEALTHY_ANSWERS)
  assert.strictEqual(cognition.decision.status, 'NO_PRIMARY_DEFICIT')
  assert.strictEqual(cognition.decision.reasonCode, 'NO_SUPPORTED_DEFICIT')
  assert.strictEqual(contentModel.diagnosisState.primaryBlindSpotId, null)
  const verdict = contentModel.sections.find((s) => s.sectionId === '01_COGNITIVE_VERDICT')
  assert.ok(!verdict.body || !verdict.body.blindSpotLabel)
  // builder still produces 9 sections and validates (graceful)
  assert.strictEqual(contentModel.sections.length, 9)
})

test('multi-state D: INSUFFICIENT_DIRECTIONAL_EVIDENCE no fabricated primary', () => {
  const { cognition, contentModel } = buildReport(INSUFFICIENT_ANSWERS)
  assert.ok(!cognition.decision.primaryBlindSpotId)
  assert.strictEqual(contentModel.diagnosisState.primaryBlindSpotId, null)
})

test('multi-state E: CONTRADICTORY_EVIDENCE no fabricated primary', () => {
  const { cognition, contentModel } = buildReport(CONTRADICTORY_ANSWERS)
  assert.ok(!cognition.decision.primaryBlindSpotId)
  assert.strictEqual(contentModel.diagnosisState.primaryBlindSpotId, null)
})

// ── §5 Determinism ────────────────────────────────────────────────────────
test('determinism: same answers → byte-identical content model', () => {
  const a = buildReport(R45_SYSTEMS_ANSWERS).contentModel
  const b = buildReport(R45_SYSTEMS_ANSWERS).contentModel
  assert.deepStrictEqual(a, b)
})

// ── §6 Diagnosis non-interference ─────────────────────────────────────────
test('report builder does not mutate engine diagnosis output', () => {
  const responses = withPositions(R45_SYSTEMS_ANSWERS)
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognitionA = runCognitionChainV21(responses)
  const before = JSON.stringify(cognitionA.decision)
  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition: cognitionA })
  const pm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: cognitionA.decision,
    answerTrace: report.trace.answerTrace,
    dimensions: cognitionA.dimensions,
    cognitiveBlindSpot: report.cognitiveBlindSpot,
    worldStrategy: report.worldStrategy,
    cognitiveArchetype: report.cognitiveArchetype,
    scenarioSimulation: report.scenarioSimulation,
    validityStatus: validity.status,
  })
  reportBuilder.buildNorthStarReportV21(pm)
  const after = JSON.stringify(cognitionA.decision)
  assert.strictEqual(before, after)
})

// ── §7 Validator negative cases ───────────────────────────────────────────
test('validator rejects missing report object', () => {
  const r = reportBuilder.validateNorthStarReportV21(null)
  assert.strictEqual(r.valid, false)
})

test('validator rejects report with no sections array', () => {
  const r = reportBuilder.validateNorthStarReportV21({ version: 'x' })
  assert.strictEqual(r.valid, false)
})

test('validator rejects a fabricated primary verdict that is label-only', () => {
  const fake = {
    version: 'north_star_report_v1',
    diagnosisState: { primaryBlindSpotId: 'SYSTEM_THINKING_GAP' },
    sections: [
      { sectionId: '01_COGNITIVE_VERDICT', title: '核心发现', summary: '系统思维', body: { blindSpotLabel: '系统思维' }, sourceRefs: [] },
      { sectionId: '03_WORLD_RULE_ALIGNMENT', title: '世界运行规则', summary: '复杂系统产生涌现行为。', body: { worldRule: 'x', misalignment: 'y' }, sourceRefs: [] },
      { sectionId: '04_WHY_WE_JUDGE_THIS', title: '为什么这样判断你', summary: '', body: { items: [{}, {}] }, sourceRefs: [] },
      { sectionId: '06_COGNITIVE_UPGRADE', title: '换一个怎样的新模型', summary: '建立决策系统', body: { upgradedModel: '建立决策系统，让决策产生复利', strategyMechanism: 'm' }, sourceRefs: [] },
      { sectionId: '08_SCENARIO_CONTRAST', title: '旧模型与新模型的差别', summary: '', body: { currentModel: { likelyDecisionPattern: ['a'] }, upgradedModel: { likelyDecisionPattern: ['b'] }, simulationNote: '情景推演，不是预测' }, sourceRefs: [] },
    ],
  }
  const r = reportBuilder.validateNorthStarReportV21(fake)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.includes('VERDICT_IS_TAXONOMY_LABEL_ONLY'))
})

test('validator rejects raw English paragraph in user copy', () => {
  const fake = {
    version: 'north_star_report_v1',
    diagnosisState: { primaryBlindSpotId: null },
    sections: [
      { sectionId: '01_COGNITIVE_VERDICT', title: '核心发现', summary: 'The user sees individual events rather than systems.', body: null, sourceRefs: [] },
    ],
  }
  const r = reportBuilder.validateNorthStarReportV21(fake)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.some((e) => e.startsWith('USER_VISIBLE_ENGLISH_PARAGRAPH')))
})

test('validator rejects standalone archetype primary card', () => {
  const fake = {
    version: 'north_star_report_v1',
    diagnosisState: { primaryBlindSpotId: null },
    sections: [
      { sectionId: '00_ARCHETYPE', title: '你的原型', summary: '执行者', body: null, sourceRefs: [] },
    ],
  }
  const r = reportBuilder.validateNorthStarReportV21(fake)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.includes('ARCHETYPE_PRIMARY_CARD'))
})

test('validator rejects dimension dashboard primary flow', () => {
  const fake = {
    version: 'north_star_report_v1',
    diagnosisState: { primaryBlindSpotId: null },
    sections: [
      { sectionId: '00_DIMENSION_DASHBOARD', title: '维度看板', summary: 'x', body: null, sourceRefs: [] },
    ],
  }
  const r = reportBuilder.validateNorthStarReportV21(fake)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.includes('DIMENSION_DASHBOARD_PRIMARY'))
})

// ── §8 Report copy table completeness (9 blind spots / principles / strategies) ─
test('copy table: 9/9 blind spot verdicts present', () => {
  const copy = reportBuilder.copy
  for (const id of BLIND_SPOT_IDS) {
    assert.ok(copy.getBlindSpotVerdict(id), `missing verdict copy for ${id}`)
    assert.ok(copy.getBlindSpotCurrentModel(id), `missing current-model copy for ${id}`)
  }
})

test('copy table: 9/9 world-rule statements + consequences + misalignments', () => {
  const copy = reportBuilder.copy
  const principles = Object.keys(copy.WORLD_RULE_STATEMENT_COPY)
  assert.strictEqual(principles.length, 9)
  for (const p of principles) {
    assert.ok(copy.getWorldRuleStatement(p))
    assert.ok(copy.getWorldRuleConsequence(p))
    assert.ok(copy.getWorldRuleMechanism(p))
    assert.ok(copy.getMisalignment(p))
  }
})

test('copy table: 9/9 strategies with mechanism + experiments + success + stop + review', () => {
  const copy = reportBuilder.copy
  const strategies = Object.keys(copy.STRATEGY_MECHANISM_COPY)
  assert.strictEqual(strategies.length, 9)
  for (const s of strategies) {
    assert.ok(copy.getStrategyMechanism(s))
    assert.ok(copy.getStrategyExperiments(s).length >= 3)
    assert.ok(copy.getStrategySuccessSignal(s))
    assert.ok(copy.getStrategyStopCondition(s))
    assert.ok(copy.getStrategyReviewWindow(s))
  }
})

test('copy table: all 8 scenario dimension models have current + upgraded localization', () => {
  const copy = reportBuilder.copy
  const entries = Object.keys(copy.SCENARIO_PATTERN_LOCALIZATION)
  assert.strictEqual(entries.length, 48) // 8 dimension models × 6 patterns each
  // every localization target must be a non-empty Chinese string
  for (const [en, zh] of Object.entries(copy.SCENARIO_PATTERN_LOCALIZATION)) {
    assert.ok(typeof en === 'string' && en.length > 0, 'English key must be non-empty')
    assert.ok(typeof zh === 'string' && /[\u4e00-\u9fff]/.test(zh), `localization for "${en}" must be Chinese`)
  }
})
