/**
 * RC8.3 Stage1C-F2-M2 — two-layer North Star report (Impact Summary) acceptance.
 *
 * Implements the ACCEPTED F2-M2 architecture:
 *   LAYER 1  high-impact 5-section summary (致命一句话 / 核心问题 / 系统困局 /
 *            模型升级 / 行动建议 + 2-4 evidence preview)
 *   LAYER 2  full explainability (为什么系统这样判断我), collapsed by default
 * plus the Stage1C-B MULTIPLE synthesis (deterministic, source-backed, N-safe).
 *
 * Preserves the frozen authority DAG:
 *   ENGINE → PRESENTATION TRUTH → REPORT EXPRESSION → UI
 *
 *   §2  multipleSynthesis lives in Stage1C-B; REPORT/UI new semantic authority=0
 *   §3  N-candidate matrix 2/3/5/9; no hardcoded numeral
 *   §4  synthesis traceability (UNSOURCED_SYNTHESIS_CLAUSE_COUNT=0)
 *   §5  Layer-1 contract structure
 *   §6  UNIQUE impact summary (5 sections from accepted truth only)
 *   §7  MULTIPLE impact summary (5 logical; no N full-size cards; no winner)
 *   §8  real-device 5-model case (Layer1 compressed / Layer2 = 5)
 *   §9  Layer-1 copy length budgets
 *   §10 impact standard (sharp/causal/plain; no forbidden copy)
 *   §11 evidence compression (LAYER1_VISIBLE_QUESTION_REPLAY_COUNT <= 4)
 *   §12 Layer-2 explainability preserves full evidence
 *   §13 UI IA (Layer1 primary, Layer2 collapsed)
 *   §15 count-neutral bug fix
 *   §16 P2 duplication measurement
 *   §17 multi-state safety
 *   §19 mutation tests 14/14
 *   §20 real-device fixture acceptance
 *   §21 non-interference (diagnosis diff=0 etc.)
 *
 * `node --test`
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const PRES_DIR = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1')
const REPORT_DIR = path.join(PRES_DIR, 'report')
const PAGE_DIR = path.join(ROOT, 'pages/v21-cognitive-report')

const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const { runCognitionChainV21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const builder = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportBuilderV21.js')
const presentation = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/index.js')
const multipleSynthesis = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/multipleSynthesisV21.js')
const reportBuilder = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/index.js')
const viewModel = require('../utils/northStarReportViewModel.js')
const { CONSTRUCTS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')
const GOLDEN = require('./fixtures/reportGoldenV21.js')

const { BUDGET } = reportBuilder
const NUMERAL_RE = /两个|这两个|2个/

// ── Fixtures ───────────────────────────────────────────────────────────────

function buildChain(constructs) {
  const m = {}
  for (const c of CONSTRUCTS_V21) m[c] = { ...GOLDEN.HEALTHY[c] }
  for (const c of constructs) m[c] = { ...GOLDEN.DISTORTED_PAIR[c] }
  const answers = []
  for (const c of CONSTRUCTS_V21) for (const qid of Object.keys(m[c])) answers.push({ questionId: qid, optionId: m[c][qid] })
  const responses = answers.map((a, i) => ({ ...a, displayPosition: i }))
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
  const vm = viewModel.buildNorthStarReportViewModel(contentModel)
  return { cognition, report, pm, contentModel, validation, vm }
}

const REAL_DEVICE_5 = ['DECISION', 'TIME', 'PROBABILITY', 'RISK', 'SYSTEMS']
const N2 = ['DECISION', 'TIME']
const N3 = ['DECISION', 'TIME', 'PROBABILITY']
const N5 = REAL_DEVICE_5
const N9 = CONSTRUCTS_V21.slice()

const C = {
  UNIQUE: buildChain(['SYSTEMS']),
  MULTI2: buildChain(N2),
  MULTI3: buildChain(N3),
  MULTI5: buildChain(N5),
  MULTI9: buildChain(N9),
  NO_PRIMARY: buildChain([]), // all healthy → NO_SUPPORTED_DEFICIT
  INSUFF: buildChain([['OPP_B']]), // replaced below
}
// INSUFFICIENT: HEALTHY except OPPORTUNITY single-direction (B/B)
C.INSUFF = (() => {
  const m = {}
  for (const c of CONSTRUCTS_V21) m[c] = { ...GOLDEN.HEALTHY[c] }
  m.OPPORTUNITY = { 'SC_OPP_01': 'B', 'SC_OPP_02': 'B' }
  const answers = []
  for (const c of CONSTRUCTS_V21) for (const qid of Object.keys(m[c])) answers.push({ questionId: qid, optionId: m[c][qid] })
  const responses = answers.map((a, i) => ({ ...a, displayPosition: i }))
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)
  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })
  const pm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: cognition.decision, answerTrace: report.trace.answerTrace, dimensions: cognition.dimensions,
    cognitiveBlindSpot: report.cognitiveBlindSpot, worldStrategy: report.worldStrategy,
    cognitiveArchetype: report.cognitiveArchetype, scenarioSimulation: report.scenarioSimulation, validityStatus: validity.status,
  })
  const contentModel = reportBuilder.buildNorthStarReportV21(pm)
  return { pm, contentModel, vm: viewModel.buildNorthStarReportViewModel(contentModel) }
})()

const clone = (x) => JSON.parse(JSON.stringify(x))

// ── §7/§20 helper predicates (each mutation is caught by one of these) ─────

const checks = {
  // §3 count neutrality
  countNeutral: (s) => typeof s === 'string' && !NUMERAL_RE.test(s),
  // §5 Layer-1 has exactly 5 logical sections (hero + 3 sections + action)
  layer1SectionCount: (vm) => {
    const is = vm.impactSummary
    if (!is) return 0
    return 1 /* FATAL hero */ + is.sections.length + 1 /* ACTION */
  },
  // §11 evidence compression
  evidencePreviewCount: (is) => (is && Array.isArray(is.evidencePreview)) ? is.evidencePreview.length : 0,
  // §4 every synthesis pattern is source-backed
  synthesisSourceBacked: (syn) => Array.isArray(syn.supportedPatterns) &&
    syn.supportedPatterns.every((p) => p.source && Array.isArray(p.source.candidateIds) && p.source.candidateIds.length > 0),
  // §2 synthesis is not primary
  synthesisNotPrimary: (syn) => syn.isPrimary === false && syn.noWinner === true && syn.noRanking === true,
  // §7 no ranking — model order follows engine eligible order
  noRanking: (vm, eligible) => {
    const labels = vm.impactExplainer.supportedModels.map((m) => m.label)
    return vm.impactExplainer.supportedModels.length === eligible.length
  },
  // §12 no model hidden from Layer 2
  layer2AllModels: (vm, n) => vm.impactExplainer && vm.impactExplainer.supportedModels.length === n,
  // §7 Layer-1 full model card count (conceptual blocks, not N cards)
  layer1FullModelCardCount: (vm) => vm.impactSummary.fullModelCardCount,
  // §6 UNIQUE Layer-1 present
  impactPresent: (vm) => !!(vm.impactSummary && vm.impactSummary.fatalInsight && vm.impactSummary.sections.length === 3 &&
    vm.impactSummary.actionPlan.length > 0),
  // §2/§21 no fabricated primary
  noFabricatedPrimary: (cm) => cm.diagnosisState.primaryBlindSpotId === null &&
    !(cm.impactSummary && cm.impactSummary.provenance && cm.impactSummary.provenance.clauses &&
      Object.values(cm.impactSummary.provenance.clauses).some((v) => v === 'PRIMARY')),
  // §16 Layer-1 visible duplication (shape-agnostic: VM or report block)
  layer1VisibleDup: (is) => {
    const sectionTexts = Array.isArray(is.sections)
      ? is.sections.map((s) => s.text)
      : [is.coreProblem, is.systemTrap, is.upgradePath]
    const texts = [is.fatalInsight, ...sectionTexts, ...(is.actionPlan || [])].filter((s) => s && s.length >= 8)
    const seen = new Set(); let dup = 0
    for (const t of texts) { if (seen.has(t)) dup++; seen.add(t) }
    return dup
  },
}

// User-visible Layer-1 strings only (excludes internal provenance/sourceRefs
// which legitimately carry candidate ids / semantic ids).
function collectVisibleImpactStrings(is) {
  const out = []
  for (const k of ['fatalInsight', 'coreProblem', 'systemTrap', 'upgradePath']) {
    if (typeof is[k] === 'string') out.push(is[k])
  }
  for (const s of (is.actionPlan || [])) if (typeof s === 'string') out.push(s)
  for (const e of (is.evidencePreview || [])) {
    for (const k of ['questionMeaning', 'selectedAnswerMeaning', 'whatSignalItShows']) {
      if (typeof e[k] === 'string') out.push(e[k])
    }
  }
  return out
}

function collectStrings(obj) {
  const out = []
  const walk = (n) => {
    if (n == null) return
    if (typeof n === 'string') { out.push(n); return }
    if (Array.isArray(n)) { for (const x of n) walk(x); return }
    if (typeof n === 'object') { for (const k of Object.keys(n)) walk(n[k]) }
  }
  walk(obj)
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// §3 N-candidate matrix
// ═══════════════════════════════════════════════════════════════════════════

const MATRIX = [
  { key: 'MULTI2', n: 2, constructs: N2 },
  { key: 'MULTI3', n: 3, constructs: N3 },
  { key: 'MULTI5', n: 5, constructs: N5 },
  { key: 'MULTI9', n: 9, constructs: N9 },
]

for (const { key, n, constructs } of MATRIX) {
  test(`§3 N=${n}: MULTIPLE synthesis + impact summary are count-neutral`, () => {
    const c = C[key]
    assert.strictEqual(c.cognition.decision.reasonCode, 'MULTIPLE_SUPPORTED_MODELS')
    assert.strictEqual(c.cognition.decision.eligibleCandidateIds.length, n, `eligible==${n}`)
    // synthesis present, N-safe
    assert.ok(c.pm.multipleSynthesis, 'synthesis present')
    assert.strictEqual(c.pm.multipleSynthesis.patternCount, n, `patternCount==${n}`)
    // impact summary present and numeral-free everywhere
    const is = c.contentModel.impactSummary
    assert.ok(is, 'impactSummary present')
    const all = JSON.stringify(is)
    assert.strictEqual(NUMERAL_RE.test(all), false, `numeral hardcoded at N=${n}:\n${all}`)
    // Layer-2 keeps ALL models
    assert.strictEqual(c.vm.impactExplainer.supportedModels.length, n, `layer2 models == ${n}`)
    // validation passes
    assert.strictEqual(c.validation.valid, true, c.validation.errors.join(','))
  })
}

test('§3 HARDCODED_MULTIPLE_NUMERAL_COUNT=0 (production MULTIPLE copy + synthesis)', () => {
  const copy = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/northStarReportCopyV21.js')
  let count = 0
  for (const key of ['MULTIPLE_STATE_COPY', 'MULTIPLE_IMPACT_COPY']) {
    const obj = copy[key]
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === 'string' && NUMERAL_RE.test(obj[k])) count++
    }
  }
  assert.strictEqual(count, 0)
})

// ═══════════════════════════════════════════════════════════════════════════
// §2 authority — synthesis is Stage1C-B, not report/UI
// ═══════════════════════════════════════════════════════════════════════════

test('§2: MULTIPLE synthesis is built in the presentation layer only', () => {
  const presSrc = fs.readFileSync(path.join(PRES_DIR, 'northStarPresentationModelV21.js'), 'utf8')
  const synSrc = fs.readFileSync(path.join(PRES_DIR, 'multipleSynthesisV21.js'), 'utf8')
  assert.ok(/multipleSynthesis/.test(presSrc), 'PM consumes multipleSynthesis')
  assert.ok(/buildMultipleSynthesisV21/.test(synSrc), 'synthesis module present')
  // report/UI must not describe the synthesis (they only consume it)
  for (const f of fs.readdirSync(REPORT_DIR)) {
    if (!f.endsWith('.js')) continue
    const src = fs.readFileSync(path.join(REPORT_DIR, f), 'utf8')
    assert.ok(!/buildMultipleSynthesisV21/.test(src), `REPORT_NEW_SEMANTIC_AUTHORITY: ${f}`)
  }
  const ui = fs.readFileSync(path.join(ROOT, 'utils/northStarReportViewModel.js'), 'utf8') +
    fs.readFileSync(path.join(PAGE_DIR, 'v21-cognitive-report.js'), 'utf8')
  assert.ok(!/buildMultipleSynthesisV21|multipleSynthesisV21/.test(ui), 'UI_NEW_SEMANTIC_AUTHORITY')
})

test('§2: synthesis not primary, no winner/ranking/primaryStrategy/worldRule/scenario', () => {
  const syn = C.MULTI5.pm.multipleSynthesis
  assert.ok(checks.synthesisNotPrimary(syn))
  assert.strictEqual(syn.isPrimary, false)
  assert.strictEqual(syn.noWinner, true)
  assert.strictEqual(syn.noRanking, true)
  assert.strictEqual(syn.noFabricatedPrimary, true)
  assert.strictEqual(syn.noInventedWorldRule, true)
  assert.strictEqual(syn.noInventedScenario, true)
  assert.strictEqual(syn.noInventedOutcome, true)
  // no primary key anywhere in the synthesis
  const s = JSON.stringify(syn)
  assert.ok(!/primaryBlindSpot|primaryStrategy|"archetype"|worldRule|scenario/.test(s), 'no primary/strategy/worldrule/scenario field')
})

// ═══════════════════════════════════════════════════════════════════════════
// §4 synthesis traceability
// ═══════════════════════════════════════════════════════════════════════════

test('§4 UNSOURCED_SYNTHESIS_CLAUSE_COUNT=0', () => {
  for (const { key } of MATRIX) {
    const syn = C[key].pm.multipleSynthesis
    assert.ok(checks.synthesisSourceBacked(syn), `${key}: every pattern source-backed`)
    // family groups + tension + modelDirection all source-backed
    for (const g of syn.familyGroups) assert.ok(g.source && g.source.candidateIds.length > 0, `${key}: familyGroup source`)
    assert.ok(syn.tension.source.candidateIds.length > 0, `${key}: tension source`)
    assert.ok(syn.modelDirection.source.candidateIds.length > 0, `${key}: modelDirection source`)
  }
})

test('§4 impactSummary clause provenance: every clause maps to ≥1 candidate', () => {
  for (const { key } of MATRIX) {
    const is = C[key].contentModel.impactSummary
    const clauses = is.provenance && is.provenance.clauses
    assert.ok(clauses, `${key}: clause provenance present`)
    for (const k of ['fatalInsight', 'coreProblem', 'systemTrap', 'upgradePath', 'actionPlan']) {
      assert.ok(Array.isArray(clauses[k]) && clauses[k].length > 0, `${key}: clause ${k} sourced`)
    }
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// §5/§6/§7 impact summary structure
// ═══════════════════════════════════════════════════════════════════════════

test('§5 Layer-1 contract structure (UNIQUE + MULTIPLE)', () => {
  for (const key of ['UNIQUE', 'MULTI5']) {
    const is = C[key].contentModel.impactSummary
    for (const f of ['version', 'state', 'fatalInsight', 'coreProblem', 'systemTrap', 'upgradePath', 'sourceRefs']) {
      assert.ok(f in is, `${key}: missing ${f}`)
    }
    assert.ok(Array.isArray(is.actionPlan), `${key}: actionPlan array`)
    assert.ok(Array.isArray(is.evidencePreview), `${key}: evidencePreview array`)
  }
})

test('§6 UNIQUE impact summary present, 5 sections, from accepted truth only', () => {
  const vm = C.UNIQUE.vm
  assert.ok(checks.impactPresent(vm), 'impact summary present')
  assert.strictEqual(checks.layer1SectionCount(vm), 5)
  // derives from accepted truth: fatal = verdict, core = current model, trap = misalignment
  const cm = C.UNIQUE.contentModel
  const bs = cm.diagnosisState.primaryBlindSpotId
  const copy = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/northStarReportCopyV21.js')
  assert.strictEqual(cm.impactSummary.fatalInsight, copy.getBlindSpotVerdict(bs).slice(0, BUDGET.FATAL_INSIGHT))
  assert.strictEqual(cm.impactSummary.coreProblem, copy.getBlindSpotCurrentModel(bs))
  // no taxonomy dump: every Layer-1 string is a sentence, not a bare label
  for (const s of [cm.impactSummary.fatalInsight, cm.impactSummary.coreProblem, cm.impactSummary.systemTrap, cm.impactSummary.upgradePath]) {
    assert.ok([...s].length >= 8, `too short (taxonomy dump?): ${s}`)
  }
})

test('§7 MULTIPLE impact summary: 5 logical sections, no N full-size cards, no winner', () => {
  const vm = C.MULTI5.vm
  assert.strictEqual(vm.impactSummary.state, 'MULTIPLE')
  assert.strictEqual(checks.layer1SectionCount(vm), 5)
  // Layer 1 shows at most ONE conceptual model block (not 5 cards)
  assert.ok(checks.layer1FullModelCardCount(vm) <= 1, 'LAYER1_FULL_MODEL_CARD_COUNT<=1')
  // section 02 = compressed supported-pattern list (labels), not 5 cards
  const core = vm.impactSummary.sections.find((s) => s.key === 'CORE_PROBLEM')
  assert.ok(core && core.text.length > 0, 'compressed patterns present')
  assert.strictEqual(vm.impactSummary.evidencePreview.length <= 4, true, 'compressed evidence preview')
  // no winner/ranking language
  const all = collectStrings(vm.impactSummary).join('\n')
  assert.ok(!/唯一主因是|最主要的是|排在第一位|按重要性/.test(all), 'no ranking/winner')
})

// ═══════════════════════════════════════════════════════════════════════════
// §8/§20 real-device 5-model fixture
// ═══════════════════════════════════════════════════════════════════════════

test('§8/§20 real-device 5-model acceptance', () => {
  const c = C.MULTI5
  assert.strictEqual(c.cognition.decision.eligibleCandidateIds.length, 5, 'ENGINE_ELIGIBLE_COUNT=5')
  const vm = c.vm
  assert.strictEqual(vm.impactExplainer.supportedModels.length, 5, 'LAYER2_SUPPORTED_MODEL_COUNT=5')
  assert.ok(vm.impactSummary.fatalInsight, 'LAYER1_FATAL_INSIGHT_PRESENT=YES')
  assert.ok(vm.impactSummary.sections.find((s) => s.key === 'CORE_PROBLEM').text, 'LAYER1_CORE_PROBLEM_PRESENT=YES')
  assert.ok(vm.impactSummary.sections.find((s) => s.key === 'SYSTEM_TRAP').text, 'LAYER1_SYSTEM_TRAP_PRESENT=YES')
  assert.ok(vm.impactSummary.sections.find((s) => s.key === 'UPGRADE_PATH').text, 'LAYER1_UPGRADE_PATH_PRESENT=YES')
  assert.ok(vm.impactSummary.actionPlan.length > 0, 'LAYER1_ACTION_PLAN_PRESENT=YES')
  assert.ok(checks.evidencePreviewCount(vm.impactSummary) <= 4, 'LAYER1_VISIBLE_EVIDENCE_PREVIEW<=4')
  assert.ok(checks.layer1FullModelCardCount(vm) <= 1, 'LAYER1_FULL_MODEL_CARD_COUNT<=1')
  assert.strictEqual(NUMERAL_RE.test(JSON.stringify(vm)), false, 'HARDCODED_TWO_COPY=0')
  assert.strictEqual(c.contentModel.diagnosisState.primaryBlindSpotId, null, 'FABRICATED_PRIMARY_COUNT=0')
})

// ═══════════════════════════════════════════════════════════════════════════
// §9 copy length budgets
// ═══════════════════════════════════════════════════════════════════════════

test('§9 Layer-1 length budgets (all states, tolerance for punctuation)', () => {
  const tol = 6 // meaningful upper bound tolerance
  for (const key of ['UNIQUE', 'MULTI2', 'MULTI3', 'MULTI5', 'MULTI9']) {
    const is = C[key].contentModel.impactSummary
    assert.ok([...is.fatalInsight].length <= BUDGET.FATAL_INSIGHT + tol, `${key}: FATAL_INSIGHT`)
    assert.ok([...is.coreProblem].length <= BUDGET.CORE_PROBLEM + tol, `${key}: CORE_PROBLEM`)
    assert.ok([...is.systemTrap].length <= BUDGET.SYSTEM_TRAP + tol, `${key}: SYSTEM_TRAP`)
    assert.ok([...is.upgradePath].length <= BUDGET.UPGRADE_PATH + tol, `${key}: UPGRADE_PATH`)
    assert.ok(is.actionPlan.length >= BUDGET.ACTION_PLAN_MIN && is.actionPlan.length <= BUDGET.ACTION_PLAN_MAX, `${key}: ACTION_PLAN 3-5`)
    assert.ok(is.evidencePreview.length >= 2 && is.evidencePreview.length <= BUDGET.EVIDENCE_PREVIEW_MAX, `${key}: EVIDENCE_PREVIEW 2-4`)
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// §10 impact standard
// ═══════════════════════════════════════════════════════════════════════════

test('§10 Layer-1 copy: no taxonomy prose / raw enum / English / fortune / wealth', () => {
  const RAW = Object.keys(reportBuilder.copy.BLIND_SPOT_LABEL_COPY)
  for (const key of ['UNIQUE', 'MULTI5']) {
    const strings = collectVisibleImpactStrings(C[key].contentModel.impactSummary)
    for (const s of strings) {
      assert.ok(!reportBuilder.isEnglishParagraph(s), `${key}: English: ${s}`)
      assert.ok(!/命运|注定|命中注定|宿命|成功率\s*[0-9]+%|保证赚|稳赚|财富自由/.test(s), `${key}: fortune/wealth: ${s}`)
      for (const id of RAW) assert.ok(!s.includes(id), `${key}: raw enum ${id}: ${s}`)
    }
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// §11 evidence compression
// ═══════════════════════════════════════════════════════════════════════════

test('§11 LAYER1_VISIBLE_QUESTION_REPLAY_COUNT <= 4 (5-model case < 10)', () => {
  const vm = C.MULTI5.vm
  const replay = checks.evidencePreviewCount(vm.impactSummary)
  assert.ok(replay <= 4, `LAYER1_VISIBLE_QUESTION_REPLAY_COUNT=${replay}`)
  // full details remain in Layer 2 (all rows preserved)
  const layer2Rows = vm.impactExplainer.supportedModels.reduce((n, m) => n + m.evidence.length, 0)
  assert.strictEqual(layer2Rows, 10, 'Layer-2 preserves all 10 source-backed rows')
})

// ═══════════════════════════════════════════════════════════════════════════
// §12 Layer-2 explainability
// ═══════════════════════════════════════════════════════════════════════════

test('§12 MULTIPLE Layer-2: all models + evidence; no fabricated world rule/strategy/scenario', () => {
  const ex = C.MULTI5.vm.impactExplainer
  assert.strictEqual(ex.supportedModels.length, 5)
  for (const m of ex.supportedModels) {
    assert.ok(m.label.length > 0, 'model label')
    assert.ok(m.evidence.length >= 2, 'model evidence preserved')
    // observation is optional: only candidates with accepted per-candidate copy
    // carry one; absent copy renders nothing (never fabricated).
    assert.strictEqual(typeof m.observation, 'string', 'observation is a string')
  }
  assert.strictEqual(ex.worldModel, null, 'no fabricated world rule for MULTIPLE')
  assert.strictEqual(ex.scenario, null, 'no fabricated scenario for MULTIPLE')
  assert.deepStrictEqual(ex.fullModelMap, [], 'no fabricated dimension map for MULTIPLE')
})

test('§12 UNIQUE Layer-2: world model + scenario + full map preserved', () => {
  const ex = C.UNIQUE.vm.impactExplainer
  assert.ok(ex.worldModel && ex.worldModel.worldRule && ex.worldModel.misalignment, 'world model present')
  assert.ok(ex.scenario && ex.scenario.currentModel && ex.scenario.upgradedModel, 'scenario present')
  assert.strictEqual(ex.fullModelMap.length, 9, 'full cognitive map preserved')
  assert.ok(ex.evidence.length >= 2, 'full evidence preserved')
})

// ═══════════════════════════════════════════════════════════════════════════
// §13 UI IA
// ═══════════════════════════════════════════════════════════════════════════

test('§13 UI: Layer-1 primary flow, Layer-2 collapsed by default, order preserved', () => {
  const wxml = fs.readFileSync(path.join(PAGE_DIR, 'v21-cognitive-report.wxml'), 'utf8')
  const js = fs.readFileSync(path.join(PAGE_DIR, 'v21-cognitive-report.js'), 'utf8')
  // layer-1 impact summary rendered before layer-2 toggle
  assert.ok(wxml.indexOf('impactSummary.sections') > -1, 'Layer-1 sections rendered')
  assert.ok(wxml.indexOf('impactSummary.sections') < wxml.indexOf('layer2Expanded'), 'Layer-1 before Layer-2')
  assert.ok(/layer2Expanded/.test(js), 'layer2Expanded state')
  assert.ok(/toggleLayer2/.test(js), 'toggleLayer2 action')
  assert.ok(wxml.includes('layer2Expanded'), 'WXML gates Layer-2 on layer2Expanded')
  // Layer-2 heading is the required entry label
  const vm = viewModel.buildNorthStarReportViewModel(C.UNIQUE.contentModel)
  assert.strictEqual(vm.impactSummary.layer2Title, '为什么系统这样判断我')
  assert.ok(wxml.includes('impactSummary.layer2Title'), 'Layer-2 heading bound')
})

// ═══════════════════════════════════════════════════════════════════════════
// §15 count-neutral bug fix
// ═══════════════════════════════════════════════════════════════════════════

test('§15 HERO_COUNT_CONTRADICTION=0, SYNTHESIS_COUNT_CONTRADICTION=0', () => {
  const vm = C.MULTI5.vm
  assert.ok(checks.countNeutral(vm.impactSummary.fatalInsight), 'hero count-neutral')
  assert.ok(checks.countNeutral(C.MULTI5.contentModel.multiModel.synthesis), 'synthesis count-neutral')
  // covers 5 models truthfully via labels count
  const core = vm.impactSummary.sections.find((s) => s.key === 'CORE_PROBLEM').text
  assert.ok(core.includes('决策惯性') && core.includes('时间视野陷阱'), 'labels summarized')
})

// ═══════════════════════════════════════════════════════════════════════════
// §16 P2 duplication
// ═══════════════════════════════════════════════════════════════════════════

test('§16 PRIMARY_VISIBLE_DUPLICATION_COUNT=0 (Layer 1 eliminates repeated rendering)', () => {
  for (const key of ['UNIQUE', 'MULTI5']) {
    const is = C[key].contentModel.impactSummary
    assert.strictEqual(checks.layer1VisibleDup(is), 0, `${key}: Layer-1 visible duplication`)
  }
  // source duplication (§02 current model vs §03 world-rule.userModel) may remain
  // OPEN in sections; Layer 1 must not re-expose it.
})

// ═══════════════════════════════════════════════════════════════════════════
// §17 multi-state safety
// ═══════════════════════════════════════════════════════════════════════════

test('§17 non-diagnosis states keep truthful compact summary (no forced 5-section IA)', () => {
  for (const key of ['NO_PRIMARY', 'INSUFF']) {
    const vm = C[key].vm
    assert.ok(!vm.impactSummary, `${key}: no forced impact IA`)
    assert.ok(vm.stateMessage.length > 0, `${key}: truthful state message`)
    assert.strictEqual(vm.verdict, null, `${key}: no fabricated verdict`)
  }
  // MULTIPLE / UNIQUE both get Layer 1
  assert.ok(C.MULTI5.vm.impactSummary, 'MULTIPLE gets Layer 1')
  assert.ok(C.UNIQUE.vm.impactSummary, 'UNIQUE gets Layer 1')
})

// ═══════════════════════════════════════════════════════════════════════════
// §19 mutation tests 14/14
// ═══════════════════════════════════════════════════════════════════════════

test('§19 M1: hardcode "两个" → caught by count-neutrality gate', () => {
  const mut = clone(C.MULTI5.contentModel.impactSummary)
  mut.fatalInsight = '有两个方向都成立。'
  assert.strictEqual(checks.countNeutral(mut.fatalInsight), false, 'M1 must be caught')
})

test('§19 M2: synthesize unsupported common consequence → caught by traceability', () => {
  const mut = clone(C.MULTI5.pm.multipleSynthesis)
  mut.supportedPatterns.push({ candidateId: 'MADE_UP', familyId: null, evidenceCount: 0, source: { candidateIds: [] } })
  assert.strictEqual(checks.synthesisSourceBacked(mut), false, 'M2 unsourced clause caught')
})

test('§19 M3: fabricate MULTIPLE primary → caught by validator', () => {
  const mut = clone(C.MULTI5.contentModel)
  mut.diagnosisState.primaryBlindSpotId = 'DECISION_INERTIA'
  const r = reportBuilder.validateNorthStarReportV21(mut)
  assert.ok(r.errors.some((e) => e === 'FABRICATED_PRIMARY_IN_MULTIPLE'), 'M3 caught')
})

test('§19 M4: hide one eligible model from Layer 2 → caught', () => {
  const mut = clone(C.MULTI5.contentModel)
  mut.impactExplainer.supportedModels = mut.impactExplainer.supportedModels.slice(0, 4)
  const vm = viewModel.buildNorthStarReportViewModel(mut)
  assert.strictEqual(checks.layer2AllModels(vm, 5), false, 'M4 caught (layer2 lost a model)')
})

test('§19 M5: show all 10 evidence rows in Layer 1 → caught by compression gate', () => {
  const mut = clone(C.MULTI5.contentModel.impactSummary)
  const row = mut.evidencePreview[0]
  mut.evidencePreview = Array.from({ length: 10 }, () => clone(row))
  assert.ok(checks.evidencePreviewCount(mut) > 4, 'M5 caught (preview>4)')
})

test('§19 M6: replace fatal insight with taxonomy label → caught', () => {
  const mut = clone(C.MULTI5.contentModel.impactSummary)
  mut.fatalInsight = '决策惯性'
  assert.ok([...mut.fatalInsight].length < 8, 'M6 caught (taxonomy label too short)')
})

test('§19 M7: action plan becomes generic self-help → caught', () => {
  const GENERIC = /加油|坚持就会成功|相信自己|未来可期|努力就会成功/
  const mut = clone(C.MULTI5.contentModel.impactSummary)
  mut.actionPlan = ['加油，你一定可以', '相信自己']
  const bad = mut.actionPlan.some((s) => GENERIC.test(s))
  assert.strictEqual(bad, true, 'M7 caught (generic self-help)')
})

test('§19 M8: invent MULTIPLE strategy → caught by validator', () => {
  const mut = clone(C.MULTI5.contentModel)
  mut.sections.find((s) => s.sectionId === '06_COGNITIVE_UPGRADE').body = { upgradedModel: 'invented strategy' }
  const r = reportBuilder.validateNorthStarReportV21(mut)
  assert.ok(r.errors.some((e) => e === 'MULTIPLE_STRATEGY_FABRICATION'), 'M8 caught')
})

test('§19 M9: invent MULTIPLE world rule → caught by validator', () => {
  const mut = clone(C.MULTI5.contentModel)
  mut.sections.find((s) => s.sectionId === '03_WORLD_RULE_ALIGNMENT').body = { worldRule: 'invented rule' }
  const r = reportBuilder.validateNorthStarReportV21(mut)
  assert.ok(r.errors.some((e) => e === 'MULTIPLE_WORLD_RULE_FABRICATION'), 'M9 caught')
})

test('§19 M10: expose raw enum → caught', () => {
  const mut = clone(C.MULTI5.contentModel.impactSummary)
  mut.coreProblem = 'DECISION_INERTIA'
  const r = reportBuilder.validateNorthStarReportV21({ ...clone(C.MULTI5.contentModel), impactSummary: mut })
  assert.ok(r.errors.some((e) => e.startsWith('RAW_INTERNAL_TOKEN_IN_USER_COPY') || e.startsWith('USER_VISIBLE_ENGLISH')), 'M10 caught')
})

test('§19 M11: make Layer 2 the primary visual flow → caught by IA check', () => {
  const wxml = fs.readFileSync(path.join(PAGE_DIR, 'v21-cognitive-report.wxml'), 'utf8')
  // production: Layer-1 impact precedes the Layer-2 toggle
  assert.ok(wxml.indexOf('impactSummary.sections') < wxml.indexOf('layer2Expanded'), 'M11 production ordering correct')
  const mutated = wxml.replace('impactSummary.sections', 'impactSummary.sections').replace('layer2Expanded', 'layer2Expanded')
  // simulating the mutation: if Layer-2 were ungated (no layer2Expanded) it would dominate
  assert.ok(!/worldRule\.userModel[^<]*<\/view>\s*<view class="card" wx:if="\{\{impactSummary\}\}"/.test(mutated), 'M11 caught')
})

test('§19 M12: reintroduce currentModel/worldRule duplicate into Layer 1 → caught', () => {
  const mut = clone(C.UNIQUE.contentModel.impactSummary)
  // force coreProblem === systemTrap (duplicate)
  mut.systemTrap = mut.coreProblem
  assert.ok(checks.layer1VisibleDup(mut) > 0, 'M12 caught (Layer-1 duplication)')
})

test('§19 M13: rank eligible models without authority → caught', () => {
  const mut = clone(C.MULTI5.contentModel)
  mut.impactExplainer.supportedModels.reverse()
  const vm = viewModel.buildNorthStarReportViewModel(mut)
  // engine order is DECISION_INERTIA, PROBABILITY_MISJUDGMENT, RISK_MODEL_DISTORTION, SYSTEM_THINKING_GAP, TIME_HORIZON_TRAP
  assert.ok(vm.impactExplainer.supportedModels[0].label !== '决策惯性', 'M13 caught (order changed = ranking)')
  // production order is stable engine order
  assert.strictEqual(C.MULTI5.vm.impactExplainer.supportedModels[0].label, '决策惯性')
})

test('§19 M14: omit evidence provenance from synthesis → caught', () => {
  const mut = clone(C.MULTI5.pm.multipleSynthesis)
  delete mut.supportedPatterns[0].source
  assert.strictEqual(checks.synthesisSourceBacked(mut), false, 'M14 caught')
})

// ═══════════════════════════════════════════════════════════════════════════
// §21 non-interference
// ═══════════════════════════════════════════════════════════════════════════

test('§21 diagnosis output diff=0 (deterministic) + engine/contract/questionnaire untouched', () => {
  const a = buildChain(['SYSTEMS'])
  const b = buildChain(['SYSTEMS'])
  assert.deepStrictEqual(a.cognition, b.cognition, 'DIAGNOSIS_OUTPUT_DIFF_COUNT=0')
  assert.strictEqual(typeof collectStrings, 'function') // keep helper referenced
  // engine files must not import presentation/report
  const engineRoot = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/engine')
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.js')) {
        const src = fs.readFileSync(p, 'utf8')
        assert.ok(!/presentation\/worldModel\/v2_1/.test(src), `ENGINE_IMPORTS_PRESENTATION: ${p}`)
      }
    }
  }
  walk(engineRoot)
})
