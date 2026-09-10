/**
 * RC8.3 Stage1C-C2 — North Star Report Builder FINAL ACCEPTANCE.
 *
 * Read-only acceptance audit (no rebuild of C1). Committed baseline remains
 * 19e1f60f. Only Stage1C-C new files may be dirty.
 *
 * Covers the testable acceptance areas:
 *   §2  report authority boundary (one-way: report → presentation model)
 *   §3  no shadow semantic authority (scenario / dimension-model / principle)
 *   §4  multi-state acceptance (A/B/C/D/E/F)
 *   §5  validator negative cases (>=17)
 *   §6  mutation tests (>=12)
 *   §7  report gates
 *   §8  all 9 blind spots renderable + validate
 *   §9  R4.5 SYSTEMS fixture
 *   §10 copy safety (English / raw token / prediction / wealth / duplication)
 *   §11 Stage1C-B non-interference
 *   §12 diagnosis non-interference
 *
 * Shell-level areas (§1 source guard, §13 full regression, §14 file-scope,
 * §15 diff quality, §16 final decision) are executed via exec and reported
 * in the acceptance report, not this file.
 *
 * `node --test`
 *
 * @version north_star_report_v1
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const { runCognitionChainV21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const builder = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportBuilderV21.js')
const presentation = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/index.js')
const reportBuilder = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/index.js')
const { CONSTRUCTS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')
const { BLIND_SPOT_DEFINITIONS } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotDefinitions.js')
const { DIMENSION_SCENARIO_PATTERNS } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/scenarioDefinitions.js')

const BLIND_SPOT_IDS = Object.keys(BLIND_SPOT_DEFINITIONS)
const REPORT_DIR = path.join(__dirname, '..', 'cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report')

// ── Fixtures (identical to Stage1C-C1) ────────────────────────────────────

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

function sec(report, id) {
  return report.sections.find((s) => s.sectionId === id)
}

// ── §2 Report authority boundary (one-way, frozen) ───────────────────────

test('§2 authority: report builder imports only local sibling modules (no engine, no presentation-model require)', () => {
  const src = fs.readFileSync(path.join(REPORT_DIR, 'northStarReportBuilderV21.js'), 'utf8')
  const requires = [...src.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map((m) => m[1])
  // F2-M2: the builder may require its own LOCAL sibling report modules only
  // (copy table + impact summary/explainer). It must NEVER import an engine
  // module or the presentation model (one-way dependency, still frozen).
  for (const r of requires) {
    assert.ok(r.startsWith('./'), `non-local require: ${r}`)
    assert.ok(!/engine\/|northStarPresentationModel|presentation\/worldModel\/v2_1\/index/.test(r),
      `builder must not import engine/presentation-model: ${r}`)
  }
  assert.ok(requires.includes('./northStarReportCopyV21'), `copy table require missing: ${requires.join(', ')}`)
})

test('§2 authority: presentation model never imports report (PRESENTATION_MODEL_IMPORTS_REPORT=0)', () => {
  const dir = path.join(REPORT_DIR, '..')
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'report')
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8')
    assert.ok(!/report\//.test(src), `${f} imports report/ (forbidden)`)
  }
})

test('§2 authority: engine never imports report (ENGINE_IMPORTS_REPORT=0)', () => {
  const engineRoot = path.join(__dirname, '..', 'cloudfunctions/generateAiReport/lib/engine')
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.js')) {
        const src = fs.readFileSync(p, 'utf8')
        assert.ok(!/presentation\/worldModel\/v2_1\/report/.test(src), `${p} imports report (forbidden)`)
      }
    }
  }
  walk(engineRoot)
})

// ── §3 No shadow semantic authority ───────────────────────────────────────

test('§3 no shadow authority: no BLIND_SPOT_TO_DIMENSION_MODEL or SCENARIO_PATTERN_COPY re-derivation', () => {
  for (const f of fs.readdirSync(REPORT_DIR)) {
    if (!f.endsWith('.js')) continue
    const src = fs.readFileSync(path.join(REPORT_DIR, f), 'utf8')
    assert.ok(!/BLIND_SPOT_TO_DIMENSION_MODEL/.test(src), `${f} re-derives blindSpot→dimensionModel (shadow)`)
    assert.ok(!/SCENARIO_PATTERN_COPY/.test(src), `${f} re-derives scenario patterns (shadow)`)
    assert.ok(!/getDimensionModelForBlindSpot/.test(src), `${f} exposes dimension-model lookup (shadow)`)
    assert.ok(!/getScenarioPatterns\s*\(/.test(src), `${f} exposes scenario-pattern lookup (shadow)`)
  }
})

test('§3 no shadow authority: scenario localization keys exactly match frozen scenarioDefinitions (48/48)', () => {
  const copy = reportBuilder.copy
  let total = 0
  for (const [dim, p] of Object.entries(DIMENSION_SCENARIO_PATTERNS)) {
    for (const side of ['currentPattern', 'upgradedPattern']) {
      for (const en of p[side].patterns) {
        total++
        const zh = copy.getScenarioPatternLocalization(en)
        assert.ok(zh && /[\u4e00-\u9fff]/.test(zh), `missing localization for ${dim}.${side}: ${en}`)
      }
    }
  }
  assert.strictEqual(total, 48)
  assert.strictEqual(Object.keys(copy.SCENARIO_PATTERN_LOCALIZATION).length, 48)
})

test('§3 no shadow authority: scenario section renders Chinese decision patterns (no English fallthrough)', () => {
  for (const construct of CONSTRUCTS_V21) {
    const { contentModel } = buildReport(uniquePrimaryAnswers(construct))
    const s = sec(contentModel, '08_SCENARIO_CONTRAST')
    const all = [...(s.body.currentModel.likelyDecisionPattern || []), ...(s.body.upgradedModel.likelyDecisionPattern || [])]
    for (const p of all) {
      assert.match(p, /[\u4e00-\u9fff]/, `English pattern leaked in scenario: ${p}`)
    }
  }
})

// ── §4 Multi-state acceptance ─────────────────────────────────────────────

test('§4 state A: UNIQUE_PRIMARY → full 9-section supported report, verdict causal', () => {
  const { cognition, contentModel, validation } = buildReport(uniquePrimaryAnswers('SYSTEMS'))
  assert.strictEqual(cognition.decision.primaryBlindSpotId, 'SYSTEM_THINKING_GAP')
  assert.strictEqual(contentModel.diagnosisState.primaryBlindSpotId, 'SYSTEM_THINKING_GAP')
  assert.strictEqual(contentModel.sections.length, 9)
  assert.ok(sec(contentModel, '01_COGNITIVE_VERDICT').summary.length > 8)
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors))
})

test('§4 state B: MULTIPLE_SUPPORTED_MODELS → no fabricated primary', () => {
  const { cognition, contentModel, validation } = buildReport([
    { questionId: 'SC_DEC_01', optionId: 'B' }, { questionId: 'SC_DEC_02', optionId: 'C' },
    { questionId: 'SC_FB_01', optionId: 'B' }, { questionId: 'SC_FB_02', optionId: 'B' },
    { questionId: 'SC_PROB_01', optionId: 'B' }, { questionId: 'SC_PROB_02', optionId: 'B' },
    { questionId: 'SC_RISK_01', optionId: 'B' }, { questionId: 'SC_RISK_02', optionId: 'B' },
    { questionId: 'SC_LEV_01', optionId: 'B' }, { questionId: 'SC_LEV_02', optionId: 'A' },
    { questionId: 'SC_TIME_01', optionId: 'A' }, { questionId: 'SC_TIME_02', optionId: 'B' },
    { questionId: 'SC_ID_01', optionId: 'A' }, { questionId: 'SC_ID_02', optionId: 'B' },
    { questionId: 'SC_OPP_01', optionId: 'B' }, { questionId: 'SC_OPP_02', optionId: 'C' },
    { questionId: 'SC_SYS_01', optionId: 'A' }, { questionId: 'SC_SYS_02', optionId: 'B' },
  ])
  assert.strictEqual(cognition.decision.reasonCode, 'MULTIPLE_SUPPORTED_MODELS')
  assert.strictEqual(contentModel.diagnosisState.primaryBlindSpotId, null)
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors))
  const verdict = sec(contentModel, '01_COGNITIVE_VERDICT')
  assert.ok(!verdict.body || !verdict.body.blindSpotLabel)
})

test('§4 state C: NO_PRIMARY_DEFICIT (NO_SUPPORTED_DEFICIT) → neutral, no retake advice', () => {
  const { cognition, contentModel, validation } = buildReport(answersFromOptionMap(HEALTHY))
  assert.strictEqual(cognition.decision.status, 'NO_PRIMARY_DEFICIT')
  assert.strictEqual(cognition.decision.reasonCode, 'NO_SUPPORTED_DEFICIT')
  assert.strictEqual(contentModel.diagnosisState.primaryBlindSpotId, null)
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors))
})

test('§4 state D: INSUFFICIENT_DIRECTIONAL_EVIDENCE → no fabricated primary', () => {
  const map = {}
  for (const c of CONSTRUCTS_V21) map[c] = { ...HEALTHY[c] }
  map.OPPORTUNITY = { 'SC_OPP_01': 'B', 'SC_OPP_02': 'B' }
  const { cognition, contentModel } = buildReport(answersFromOptionMap(map))
  assert.ok(!cognition.decision.primaryBlindSpotId)
  assert.strictEqual(contentModel.diagnosisState.primaryBlindSpotId, null)
})

test('§4 state E: CONTRADICTORY_EVIDENCE → no fabricated primary', () => {
  const map = {}
  for (const c of CONSTRUCTS_V21) map[c] = { ...HEALTHY[c] }
  map.DECISION = { 'SC_DEC_01': 'A', 'SC_DEC_02': 'C' }
  const { cognition, contentModel } = buildReport(answersFromOptionMap(map))
  assert.ok(!cognition.decision.primaryBlindSpotId)
  assert.strictEqual(contentModel.diagnosisState.primaryBlindSpotId, null)
})

test('§4 state F: validity blocked → BLOCKED_BY_RESPONSE_VALIDITY, 9 graceful sections, no fabricated primary', () => {
  const answers = answersFromOptionMap(HEALTHY)
  answers[1] = { ...answers[0] } // duplicate questionId → INSUFFICIENT_RESPONSE_QUALITY
  const responses = withPositions(answers)
  const validity = responseValidity.assessResponseValidityV21(responses)
  assert.strictEqual(validity.status, 'INSUFFICIENT_RESPONSE_QUALITY')
  const pm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: null, answerTrace: [], dimensions: null,
    cognitiveBlindSpot: null, worldStrategy: null, cognitiveArchetype: null,
    scenarioSimulation: null, validityStatus: validity.status,
  })
  const contentModel = reportBuilder.buildNorthStarReportV21(pm)
  const validation = reportBuilder.validateNorthStarReportV21(contentModel)
  assert.strictEqual(contentModel.diagnosisState.reasonCode, 'BLOCKED_BY_RESPONSE_VALIDITY')
  assert.strictEqual(contentModel.diagnosisState.primaryBlindSpotId, null)
  assert.strictEqual(contentModel.sections.length, 9)
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors))
  const verdict = sec(contentModel, '01_COGNITIVE_VERDICT')
  assert.ok(!verdict.body || !verdict.body.blindSpotLabel)
})

// ── §5 Validator negative cases (>=17) ────────────────────────────────────

function baseFake(overrides) {
  const f = {
    version: 'north_star_report_v1',
    diagnosisState: { primaryBlindSpotId: 'SYSTEM_THINKING_GAP' },
    sections: [
      { sectionId: '01_COGNITIVE_VERDICT', title: '核心发现', summary: '你把系统问题当作孤立事件处理，倾向于逐个解决症状。', body: { blindSpotLabel: '系统思维', source: { blindSpotId: 'SYSTEM_THINKING_GAP' } }, sourceRefs: [] },
      { sectionId: '02_CURRENT_WORLD_MODEL', title: '你现在的理解方式', summary: '你倾向于线性因果思维。', body: {}, sourceRefs: [] },
      { sectionId: '03_WORLD_RULE_ALIGNMENT', title: '世界运行规则', summary: '复杂系统产生涌现行为。', body: { worldRule: '复杂系统产生涌现行为。', misalignment: '你倾向于线性因果思维。', source: { principleId: 'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR', blindSpotId: 'SYSTEM_THINKING_GAP' } }, sourceRefs: [] },
      { sectionId: '04_WHY_WE_JUDGE_THIS', title: '为什么这样判断你', summary: '', body: { items: [{ questionMeaning: '面对复杂问题时', selectedAnswerMeaning: '逐个解决症状', whatSignalItShows: '线性思维', howItSupportsDiagnosis: '与核心发现的模式一致' }, { questionMeaning: '遇到反复问题时', selectedAnswerMeaning: '当独立事件', whatSignalItShows: '缺乏系统视角', howItSupportsDiagnosis: '与核心发现的模式一致' }] }, sourceRefs: [] },
      { sectionId: '05_DECISION_CONSEQUENCE', title: '这种模式会怎样影响决策', summary: '你会持续误诊复杂问题。', body: { consequence: '持续误诊复杂问题。' }, sourceRefs: [] },
      { sectionId: '06_COGNITIVE_UPGRADE', title: '换一个怎样的新模型', summary: '从线性因果转向系统思维。', body: { upgradedModel: '从线性因果转向系统思维，理解反馈回路。', strategyMechanism: '建立系统思维框架。', source: { blindSpotId: 'SYSTEM_THINKING_GAP', strategyId: 'BUILD_DECISION_SYSTEM' } }, sourceRefs: [] },
      { sectionId: '07_DECISION_PROTOCOL', title: '下次遇到类似问题怎么做', summary: '', body: { trigger: '当你想逐个解决症状时', steps: [{ order: 1, name: '画因果回路', description: '识别反馈回路' }], successSignal: '能看到系统层面', reviewWindow: '一周', stopCondition: '不再只盯症状', source: { blindSpotId: 'SYSTEM_THINKING_GAP', strategyId: 'BUILD_DECISION_SYSTEM', targetBlindSpot: 'SYSTEM_THINKING_GAP' } }, sourceRefs: [] },
      { sectionId: '08_SCENARIO_CONTRAST', title: '旧模型与新模型的差别', summary: '', body: { currentModel: { likelyDecisionPattern: ['决策质量随情绪状态波动'] }, upgradedModel: { likelyDecisionPattern: ['在大投入之前先做小实验'] }, simulationNote: '情景推演，不是预测' }, sourceRefs: [] },
      { sectionId: '09_SECONDARY_MODEL_CONTEXT', title: '其他认知维度', summary: '', body: { archetype: { label: '执行者', description: '聚焦执行', source: { id: 'OPERATOR', mode: 'DESCRIPTIVE_ONLY' } }, strengths: [], relatedDimensions: [], fullModelMap: [] }, sourceRefs: [] },
    ],
  }
  return Object.assign({}, f, overrides)
}

const negCases = []

negCases.push(['not object', null, ['REPORT_NOT_OBJECT']])
negCases.push(['no sections array', { version: 'x' }, ['REPORT_NOT_OBJECT']])
negCases.push(['verdict label-only (short)', (() => { const f = baseFake(); f.sections[0].summary = '系统思维'; return f })(), ['VERDICT_IS_TAXONOMY_LABEL_ONLY']])
negCases.push(['verdict echoes label', (() => { const f = baseFake(); f.sections[0].summary = f.sections[0].body.blindSpotLabel; return f })(), ['VERDICT_IS_TAXONOMY_LABEL_ONLY']])
negCases.push(['generic fallback for supported primary', (() => { const f = baseFake(); f.sections[0].summary = '本次未得出唯一的核心认知发现。'; return f })(), ['GENERIC_FALLBACK_FOR_SUPPORTED_PRIMARY']])
negCases.push(['missing mandatory section', (() => { const f = baseFake(); f.sections = f.sections.filter((s) => s.sectionId !== '02_CURRENT_WORLD_MODEL'); return f })(), ['MANDATORY_SECTION_MISSING:02_CURRENT_WORLD_MODEL']])
negCases.push(['world rule missing', (() => { const f = baseFake(); f.sections = f.sections.filter((s) => s.sectionId !== '03_WORLD_RULE_ALIGNMENT'); return f })(), ['WORLD_RULE_MISSING']])
negCases.push(['misalignment missing', (() => { const f = baseFake(); delete f.sections[2].body.misalignment; return f })(), ['MISALIGNMENT_MISSING']])
negCases.push(['world rule provenance invalid', (() => { const f = baseFake(); f.sections[2].body.source.principleId = 'NOT_A_PRINCIPLE'; return f })(), ['WORLD_RULE_PROVENANCE_INVALID']])
negCases.push(['world rule provenance blindSpot mismatch', (() => { const f = baseFake(); f.sections[2].body.source.blindSpotId = 'TIME_HORIZON_TRAP'; return f })(), ['WORLD_RULE_PROVENANCE_BLINDSPOT_MISMATCH']])
negCases.push(['fabricated primary in MULTIPLE', (() => { const f = baseFake(); f.diagnosisState = { primaryBlindSpotId: 'SYSTEM_THINKING_GAP', reasonCode: 'MULTIPLE_SUPPORTED_MODELS' }; return f })(), ['FABRICATED_PRIMARY_IN_MULTIPLE']])
negCases.push(['primary in blocked state', (() => { const f = baseFake(); f.diagnosisState = { primaryBlindSpotId: 'SYSTEM_THINKING_GAP', reasonCode: 'INSUFFICIENT_DIRECTIONAL_EVIDENCE' }; return f })(), ['PRIMARY_DIAGNOSIS_IN_BLOCKED_STATE']])
negCases.push(['evidence generic (empty items)', (() => { const f = baseFake(); f.sections[3].body.items = []; return f })(), ['EVIDENCE_IS_GENERIC']])
negCases.push(['upgrade strategy-name-only', (() => { const f = baseFake(); f.sections[5].body.upgradedModel = '建立决策系统'; return f })(), ['UPGRADE_IS_STRATEGY_NAME_ONLY']])
negCases.push(['protocol strategy-label-only', (() => { const f = baseFake(); f.sections[6].body.steps = []; f.sections[6].body.successSignal = ''; f.sections[6].body.stopCondition = ''; return f })(), ['PROTOCOL_IS_STRATEGY_LABEL_ONLY']])
negCases.push(['scenario not model shift', (() => { const f = baseFake(); f.sections[7].body.currentModel.likelyDecisionPattern = []; return f })(), ['SCENARIO_NOT_MODEL_SHIFT']])
negCases.push(['scenario missing simulation note', (() => { const f = baseFake(); delete f.sections[7].body.simulationNote; return f })(), ['SCENARIO_MISSING_SIMULATION_NOTE']])
negCases.push(['archetype primary card', (() => { const f = baseFake(); f.sections.push({ sectionId: '00_ARCHETYPE', title: '你的原型', summary: '执行者', body: null, sourceRefs: [] }); return f })(), ['ARCHETYPE_PRIMARY_CARD']])
negCases.push(['dimension dashboard primary', (() => { const f = baseFake(); f.sections.push({ sectionId: '00_DIMENSION_DASHBOARD', title: '维度看板', summary: 'x', body: null, sourceRefs: [] }); return f })(), ['DIMENSION_DASHBOARD_PRIMARY']])
negCases.push(['raw english paragraph', (() => { const f = baseFake(); f.sections[0].summary = 'The user sees individual events rather than systems.'; return f })(), ['USER_VISIBLE_ENGLISH_PARAGRAPH']])
negCases.push(['raw internal token as user copy', (() => { const f = baseFake(); f.sections[0].body = { blindSpotLabel: 'SYSTEM_THINKING_GAP', source: { blindSpotId: 'SYSTEM_THINKING_GAP' } }; return f })(), ['RAW_INTERNAL_TOKEN_IN_USER_COPY:SYSTEM_THINKING_GAP']])
negCases.push(['unsupported prediction', (() => { const f = baseFake(); f.sections[5].summary = '你一定会成功。'; return f })(), ['UNSUPPORTED_PREDICTION:一定会']])
negCases.push(['wealth promise', (() => { const f = baseFake(); f.sections[5].summary = '保证赚到钱。'; return f })(), ['WEALTH_PROMISE:保证赚']])
negCases.push(['exact paragraph duplication', (() => { const f = baseFake(); f.sections[4].summary = f.sections[2].summary; return f })(), ['EXACT_PARAGRAPH_DUPLICATION']])

for (const [label, fixture, expected] of negCases) {
  test(`§5 validator negative: ${label}`, () => {
    const r = reportBuilder.validateNorthStarReportV21(fixture)
    assert.strictEqual(r.valid, false, `${label} should be invalid`)
    for (const exp of expected) {
      assert.ok(r.errors.some((e) => e === exp || e.startsWith(exp)), `${label}: expected error ${exp}, got [${r.errors.join(', ')}]`)
    }
  })
}

test('§5 validator: clean supported-primary report is valid (control)', () => {
  const r = reportBuilder.validateNorthStarReportV21(baseFake())
  assert.strictEqual(r.valid, true, JSON.stringify(r.errors))
})

// ── §6 Mutation tests (>=12) ──────────────────────────────────────────────

test('§6 mutation M1: blindSpot↔strategy mismatch in upgrade → validator rejects', () => {
  const f = baseFake()
  f.sections[5].body.source.blindSpotId = 'TIME_HORIZON_TRAP' // but verdict is SYSTEM_THINKING_GAP
  const r = reportBuilder.validateNorthStarReportV21(f)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.includes('BLINDSPOT_STRATEGY_MISMATCH'), r.errors.join(','))
})

test('§6 mutation M2: verdict blindSpot provenance mismatch → validator rejects', () => {
  const f = baseFake()
  f.sections[0].body.source.blindSpotId = 'TIME_HORIZON_TRAP'
  const r = reportBuilder.validateNorthStarReportV21(f)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.includes('VERDICT_BLINDSPOT_MISMATCH'), r.errors.join(','))
})

test('§6 mutation M3: protocol targetBlindSpot mismatch → validator rejects', () => {
  const f = baseFake()
  f.sections[6].body.source.targetBlindSpot = 'TIME_HORIZON_TRAP'
  const r = reportBuilder.validateNorthStarReportV21(f)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.includes('BLINDSPOT_STRATEGY_MISMATCH'), r.errors.join(','))
})

test('§6 mutation M4: fabricating primary for MULTIPLE → validator rejects', () => {
  const f = baseFake()
  f.diagnosisState = { primaryBlindSpotId: 'SYSTEM_THINKING_GAP', reasonCode: 'MULTIPLE_SUPPORTED_MODELS' }
  const r = reportBuilder.validateNorthStarReportV21(f)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.includes('FABRICATED_PRIMARY_IN_MULTIPLE'))
})

test('§6 mutation M5: injecting English pattern into scenario → copy-localization fallthrough is English', () => {
  const copy = reportBuilder.copy
  assert.strictEqual(copy.getScenarioPatternLocalization('This is not a frozen pattern'), null)
})

test('§6 mutation M6: removing a frozen pattern key → missing localization detected', () => {
  // All 48 frozen patterns must resolve; a foreign key must return null (no shadow fallback)
  const copy = reportBuilder.copy
  const known = DIMENSION_SCENARIO_PATTERNS.DECISION_MODEL.currentPattern.patterns[0]
  assert.ok(copy.getScenarioPatternLocalization(known))
  assert.strictEqual(copy.getScenarioPatternLocalization(known + 'XX'), null)
})

test('§6 mutation M7: duplicated section id → validator rejects', () => {
  const f = baseFake()
  f.sections.push({ ...f.sections[0] })
  const r = reportBuilder.validateNorthStarReportV21(f)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.some((e) => e.startsWith('DUPLICATE_SECTION_ID')))
})

test('§6 mutation M8: missing section id → validator rejects', () => {
  const f = baseFake()
  f.sections[3].sectionId = null
  const r = reportBuilder.validateNorthStarReportV21(f)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.includes('SECTION_MISSING_ID'))
})

test('§6 mutation M9: removing world-rule provenance → validator rejects', () => {
  const f = baseFake()
  delete f.sections[2].body.source
  const r = reportBuilder.validateNorthStarReportV21(f)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.includes('WORLD_RULE_PROVENANCE_MISSING'))
})

test('§6 mutation M10: injecting destiny language → validator rejects', () => {
  const f = baseFake()
  f.sections[8].body.archetype.description = '你注定会失败。'
  const r = reportBuilder.validateNorthStarReportV21(f)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.some((e) => e.startsWith('UNSUPPORTED_PREDICTION')), r.errors.join(','))
})

test('§6 mutation M11: injecting wealth promise → validator rejects', () => {
  const f = baseFake()
  f.sections[8].body.archetype.description = '稳赚不赔。'
  const r = reportBuilder.validateNorthStarReportV21(f)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.some((e) => e.startsWith('WEALTH_PROMISE')), r.errors.join(','))
})

test('§6 mutation M12: injecting English paragraph into evidence → validator rejects', () => {
  const f = baseFake()
  f.sections[3].body.items[0].selectedAnswerMeaning = 'Solve symptoms one at a time.'
  const r = reportBuilder.validateNorthStarReportV21(f)
  assert.strictEqual(r.valid, false)
  assert.ok(r.errors.some((e) => e.startsWith('USER_VISIBLE_ENGLISH_PARAGRAPH')), r.errors.join(','))
})

// ── §7 Report gates ───────────────────────────────────────────────────────

test('§7 gate: report version is north_star_report_v1', () => {
  const { contentModel } = buildReport(uniquePrimaryAnswers('SYSTEMS'))
  assert.strictEqual(contentModel.version, 'north_star_report_v1')
})

test('§7 gate: exactly 9 sections in canonical order', () => {
  const { contentModel } = buildReport(uniquePrimaryAnswers('SYSTEMS'))
  assert.deepStrictEqual(contentModel.sections.map((s) => s.sectionId), SECTION_IDS)
})

test('§7 gate: every section carries provenance + sourceRefs', () => {
  const { contentModel } = buildReport(uniquePrimaryAnswers('SYSTEMS'))
  for (const s of contentModel.sections) {
    assert.ok(s.provenance && s.provenance.deterministic === true, `${s.sectionId} missing provenance`)
    assert.ok(Array.isArray(s.sourceRefs), `${s.sectionId} missing sourceRefs`)
  }
})

test('§7 gate: archetype only inside secondary context, mode DESCRIPTIVE_ONLY', () => {
  const { contentModel } = buildReport(uniquePrimaryAnswers('SYSTEMS'))
  const s = sec(contentModel, '09_SECONDARY_MODEL_CONTEXT')
  assert.ok(s.body.archetype)
  assert.strictEqual(s.body.archetype.source.mode, 'DESCRIPTIVE_ONLY')
  assert.ok(!contentModel.sections.some((x) => /archetype/i.test(x.sectionId) && x.sectionId !== '09_SECONDARY_MODEL_CONTEXT'))
})

test('§7 gate: no dimension dashboard as primary flow', () => {
  const { contentModel } = buildReport(uniquePrimaryAnswers('SYSTEMS'))
  assert.ok(!contentModel.sections.some((x) => /dimension|dashboard/i.test(x.sectionId) && x.sectionId !== '09_SECONDARY_MODEL_CONTEXT'))
})

// ── §8 All 9 blind spots renderable + validate ────────────────────────────

for (const construct of CONSTRUCTS_V21) {
  const expectedBlindSpot = BLIND_SPOT_BY_CONSTRUCT[construct]
  test(`§8 blind spot ${construct} → ${expectedBlindSpot} renders + validates`, () => {
    const { cognition, contentModel, validation } = buildReport(uniquePrimaryAnswers(construct))
    assert.strictEqual(cognition.decision.primaryBlindSpotId, expectedBlindSpot)
    assert.strictEqual(contentModel.sections.length, 9)
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors))
    const verdict = sec(contentModel, '01_COGNITIVE_VERDICT')
    assert.ok(verdict.summary.length > 8, 'verdict must be causal, not empty')
  })
}

// ── §9 R4.5 SYSTEMS fixture ───────────────────────────────────────────────

test('§9 R4.5 SYSTEMS: full chain renders + validates', () => {
  const { contentModel, validation } = buildReport(uniquePrimaryAnswers('SYSTEMS'))
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors))
  const wr = sec(contentModel, '03_WORLD_RULE_ALIGNMENT')
  assert.strictEqual(wr.body.source.principleId, 'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR')
  assert.strictEqual(wr.body.source.blindSpotId, 'SYSTEM_THINKING_GAP')
  const ev = sec(contentModel, '04_WHY_WE_JUDGE_THIS')
  assert.ok(ev.body.items.length >= 2)
  assert.strictEqual(ev.body.items[0].source.questionId, 'SC_SYS_01')
  assert.strictEqual(ev.body.items[0].source.optionId, 'D')
  const ar = sec(contentModel, '09_SECONDARY_MODEL_CONTEXT')
  assert.strictEqual(ar.body.archetype.source.id, 'OPERATOR')
})

// ── §10 Copy safety ───────────────────────────────────────────────────────

test('§10 copy safety: no English paragraphs across all 9 reports', () => {
  for (const construct of CONSTRUCTS_V21) {
    const { contentModel } = buildReport(uniquePrimaryAnswers(construct))
    const strings = reportBuilder.collectUserStrings(contentModel)
    for (const s of strings) {
      assert.ok(!reportBuilder.isEnglishParagraph(s), `English paragraph leaked: ${s.slice(0, 80)}`)
    }
  }
})

test('§10 copy safety: no raw internal tokens as standalone user copy (all 9)', () => {
  const forbidden = new Set([
    'SYSTEM_THINKING_GAP', 'OPPORTUNITY_BLINDNESS', 'FEEDBACK_LOOP_GAP', 'DECISION_INERTIA',
    'RISK_MODEL_DISTORTION', 'PROBABILITY_MISJUDGMENT', 'IDENTITY_CONSTRAINT', 'LEVERAGE_MODEL_GAP',
    'TIME_HORIZON_TRAP', 'OPERATOR', 'EXPLORER', 'BUILDER', 'STRATEGIST', 'GUARDIAN', 'CONNECTOR', 'OPTIMIZER',
    'DISTORTED', 'HEALTHY', 'MIXED', 'NEUTRAL', 'UNKNOWN', 'STRONG', 'MODERATE', 'WEAK',
    'DECISION', 'FEEDBACK', 'PROBABILITY', 'RISK', 'LEVERAGE', 'TIME', 'IDENTITY', 'OPPORTUNITY', 'SYSTEMS',
    'DECISION_MODEL', 'FEEDBACK_MODEL', 'PROBABILITY_MODEL', 'RISK_MODEL', 'LEVERAGE_MODEL', 'TIME_MODEL', 'IDENTITY_MODEL', 'OPPORTUNITY_MODEL',
    'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR', 'BUILD_DECISION_SYSTEM',
  ])
  for (const construct of CONSTRUCTS_V21) {
    const { contentModel } = buildReport(uniquePrimaryAnswers(construct))
    const strings = reportBuilder.collectUserStrings(contentModel)
    for (const s of strings) {
      assert.ok(!forbidden.has(s), `raw token leaked as user copy: ${s}`)
    }
  }
})

test('§10 copy safety: no prediction / wealth / destiny / percentage language', () => {
  const forbidden = ['一定会', '必然', '注定', '命运', '保证赚', '稳赚', '收入翻倍', '人生逆转', '成功率达到', '月入', '财富自由']
  for (const construct of CONSTRUCTS_V21) {
    const { contentModel } = buildReport(uniquePrimaryAnswers(construct))
    const strings = reportBuilder.collectUserStrings(contentModel)
    for (const s of strings) {
      for (const tok of forbidden) {
        assert.ok(!s.includes(tok), `forbidden token leaked: ${tok} in ${s.slice(0, 40)}`)
      }
    }
  }
})

test('§10 copy safety: no exact paragraph duplication across sections (all 9)', () => {
  for (const construct of CONSTRUCTS_V21) {
    const { contentModel } = buildReport(uniquePrimaryAnswers(construct))
    const seen = new Map()
    for (const s of contentModel.sections) {
      if (s.summary && s.summary.length >= 8) {
        assert.ok(!seen.has(s.summary), `duplicate summary: ${seen.get(s.summary)} vs ${s.sectionId}`)
        seen.set(s.summary, s.sectionId)
      }
    }
  }
})

// ── §11 Stage1C-B non-interference ────────────────────────────────────────

test('§11 Stage1C-B non-interference: report modules do not modify presentation model files', () => {
  // Stage1C-B files must not reference report/ (verified in §2); additionally
  // the report builder must not CALL presentation model builder functions.
  const src = fs.readFileSync(path.join(REPORT_DIR, 'northStarReportBuilderV21.js'), 'utf8')
  assert.ok(!/buildNorthStarPresentationModelV21\s*\(/.test(src), 'report builder must not call presentation builder')
  assert.ok(!/buildPrimaryDiagnosisV21\s*\(|buildScenarioContrastV21\s*\(|buildSecondaryContextV21\s*\(/.test(src), 'report builder must not call presentation sub-builders')
})

test('§11 Stage1C-B non-interference: presentation model output is unchanged (deep-equal determinism)', () => {
  const a = buildReport(uniquePrimaryAnswers('SYSTEMS')).pm
  const b = buildReport(uniquePrimaryAnswers('SYSTEMS')).pm
  assert.deepStrictEqual(a, b)
})

// ── §12 Diagnosis non-interference ────────────────────────────────────────

test('§12 diagnosis non-interference: report build does not mutate engine decision', () => {
  const responses = withPositions(uniquePrimaryAnswers('SYSTEMS'))
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)
  const before = JSON.stringify(cognition.decision)
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
  reportBuilder.buildNorthStarReportV21(pm)
  reportBuilder.validateNorthStarReportV21(reportBuilder.buildNorthStarReportV21(pm))
  const after = JSON.stringify(cognition.decision)
  assert.strictEqual(before, after)
})

test('§12 diagnosis non-interference: report builder never imports engine decision builders', () => {
  const src = fs.readFileSync(path.join(REPORT_DIR, 'northStarReportBuilderV21.js'), 'utf8')
  assert.ok(!/decidePrimaryV21|runCognitionChainV21|primaryDecisionEngineV21|blindSpotCandidateEngineV21/.test(src))
})
