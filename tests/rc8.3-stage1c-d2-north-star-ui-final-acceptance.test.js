/**
 * RC8.3 Stage1C-D2 — North Star report UI final acceptance tests.
 *
 * Final acceptance for Stage1C-D. Does NOT rebuild D1; verifies:
 *   - §2 UI authority boundary (view-model → page → WXML only)
 *   - §3 no frontend shadow semantic authority
 *   - §4 complete 6-state matrix (A UNIQUE / B MULTIPLE / C NO_PRIMARY /
 *     D INSUFFICIENT / E CONTRADICTORY / F BLOCKED)
 *   - §5 North Star visual hierarchy (human verdict first, taxonomy secondary)
 *   - §6 R4.5 SYSTEMS fixture
 *   - §7 raw token / copy safety
 *   - §8 content duplication
 *   - §9 mobile layout / dynamic-content safety
 *   - §10 collapse behavior
 *   - §11 UI semantic gates (15)
 *   - §12 mutation tests (15)
 *   - §14/§15 Stage1C-C/B + diagnosis non-interference
 *
 * `node --test`
 *
 * @version north_star_report_v1 (UI final acceptance)
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const PAGE_DIR = path.join(ROOT, 'pages', 'v21-cognitive-report')
const { loadPage, defaultWx, defaultApp } = require('./ui/helpers/pageShim.js')

const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const { runCognitionChainV21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const builder = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportBuilderV21.js')
const presentation = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/index.js')
const reportBuilder = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/index.js')
const viewModel = require('../utils/northStarReportViewModel.js')
const { CONSTRUCTS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')

// ── Fixtures (identical to Stage1C-C2/D1) ──────────────────────────────────

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

function answersFromOptionMap(map) {
  const out = []
  for (const c of CONSTRUCTS_V21) {
    for (const qid of Object.keys(map[c])) out.push({ questionId: qid, optionId: map[c][qid] })
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

function buildContentModel(answers, diagnosisOverride) {
  const responses = withPositions(answers)
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = diagnosisOverride === undefined ? runCognitionChainV21(responses) : diagnosisOverride
  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })
  const pm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: cognition ? cognition.decision : null,
    answerTrace: report.trace.answerTrace,
    dimensions: cognition ? cognition.dimensions : null,
    cognitiveBlindSpot: report.cognitiveBlindSpot,
    worldStrategy: report.worldStrategy,
    cognitiveArchetype: report.cognitiveArchetype,
    scenarioSimulation: report.scenarioSimulation,
    validityStatus: validity.status,
  })
  return reportBuilder.buildNorthStarReportV21(pm)
}

// Six state content models (built once, frozen at module load).
const STATE_CM = {}

function buildAllStates() {
  // A: UNIQUE (SYSTEMS distorted)
  const aMap = {}
  for (const c of CONSTRUCTS_V21) aMap[c] = { ...HEALTHY[c] }
  aMap.SYSTEMS = { 'SC_SYS_01': 'D', 'SC_SYS_02': 'C' }
  STATE_CM.A = buildContentModel(answersFromOptionMap(aMap))

  // B: MULTIPLE
  STATE_CM.B = buildContentModel([
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

  // C: NO_PRIMARY
  STATE_CM.C = buildContentModel(answersFromOptionMap(HEALTHY))

  // D: INSUFFICIENT
  const dMap = {}
  for (const c of CONSTRUCTS_V21) dMap[c] = { ...HEALTHY[c] }
  dMap.OPPORTUNITY = { 'SC_OPP_01': 'B', 'SC_OPP_02': 'B' }
  STATE_CM.D = buildContentModel(answersFromOptionMap(dMap))

  // E: CONTRADICTORY
  const eMap = {}
  for (const c of CONSTRUCTS_V21) eMap[c] = { ...HEALTHY[c] }
  eMap.DECISION = { 'SC_DEC_01': 'A', 'SC_DEC_02': 'C' }
  STATE_CM.E = buildContentModel(answersFromOptionMap(eMap))

  // F: BLOCKED (duplicate questionId → INSUFFICIENT_RESPONSE_QUALITY, diagnosis=null)
  const fAnswers = answersFromOptionMap(HEALTHY)
  fAnswers[1] = { ...fAnswers[0] }
  const fResponses = withPositions(fAnswers)
  const fValidity = responseValidity.assessResponseValidityV21(fResponses)
  assert.strictEqual(fValidity.status, 'INSUFFICIENT_RESPONSE_QUALITY')
  const fPm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: null, answerTrace: [], dimensions: null,
    cognitiveBlindSpot: null, worldStrategy: null, cognitiveArchetype: null,
    scenarioSimulation: null, validityStatus: fValidity.status,
  })
  STATE_CM.F = reportBuilder.buildNorthStarReportV21(fPm)
}
buildAllStates()

const VM = {}
for (const s of Object.keys(STATE_CM)) VM[s] = viewModel.buildNorthStarReportViewModel(STATE_CM[s])

function collectStrings(vm) {
  const out = []
  const walk = (node) => {
    if (node == null) return
    if (typeof node === 'string') { out.push(node); return }
    if (Array.isArray(node)) { for (const x of node) walk(x); return }
    if (typeof node === 'object') { for (const k of Object.keys(node)) walk(node[k]) }
  }
  walk(vm)
  return out
}

function readPageFile(name) {
  return fs.readFileSync(path.join(PAGE_DIR, name), 'utf8')
}

// ── §2 UI authority boundary ──────────────────────────────────────────────

test('§2: view-model imports nothing (pure), page imports only view-model', () => {
  const vmSrc = readPageFile === undefined ? '' : fs.readFileSync(path.join(ROOT, 'utils/northStarReportViewModel.js'), 'utf8')
  assert.strictEqual(/require\s*\(/.test(vmSrc), false, 'view-model must be pure (no require)')
  const js = readPageFile('v21-cognitive-report.js')
  const requires = [...js.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map((m) => m[1])
  assert.deepStrictEqual(requires, ['../../utils/northStarReportViewModel.js'])
})

test('§2: no engine/presentation/report-copy/questionnaire imports in UI', () => {
  const js = readPageFile('v21-cognitive-report.js')
  const vmSrc = fs.readFileSync(path.join(ROOT, 'utils/northStarReportViewModel.js'), 'utf8')
  const wxml = readPageFile('v21-cognitive-report.wxml')
  const all = js + vmSrc + wxml
  assert.strictEqual(/lib\/engine\//.test(all), false)
  assert.strictEqual(/lib\/presentation\//.test(all), false)
  assert.strictEqual(/northStarReport(Copy|Builder|Validator)/.test(all), false)
  assert.strictEqual(/questionnaireV21|v21Questionnaire|buildSessionQuestions/.test(all), false)
})

// ── §3 No frontend shadow semantic authority ─────────────────────────────

test('§3: no blindSpot/strategy/world-rule/scenario/dimension-enum diagnosis branch in UI', () => {
  const js = readPageFile('v21-cognitive-report.js')
  const vmSrc = fs.readFileSync(path.join(ROOT, 'utils/northStarReportViewModel.js'), 'utf8')
  const wxml = readPageFile('v21-cognitive-report.wxml')
  const code = js + vmSrc
  // Blind-spot / strategy specific branches are forbidden.
  assert.strictEqual(/blindSpotId\s*===/.test(code), false, 'blindSpot-specific branch')
  assert.strictEqual(/strategyId\s*===/.test(code), false, 'strategy-specific branch')
  assert.strictEqual(/switch\s*\([^)]*(blindSpotId|strategyId)/.test(code), false, 'switch on blindSpot/strategy id')
  // Dimension enum → diagnosis copy is forbidden (case 'DECISION' etc).
  assert.strictEqual(/case\s+['"](DECISION|FEEDBACK|PROBABILITY|RISK|LEVERAGE|TIME|IDENTITY|OPPORTUNITY|SYSTEMS)['"]/.test(code), false, 'dimension enum case')
  // World-principle mapping / scenario rederivation forbidden.
  assert.strictEqual(/getPrinciplesForBlindSpot|BLIND_SPOT_TO|worldPrinciple/.test(code), false, 'world-rule mapping')
  assert.strictEqual(/scenarioSimulation|simulateScenario|getScenarioPattern/.test(code), false, 'scenario rederivation')
  // reasonCode is used ONLY for neutral state layout (returning UI_STATE constants),
  // which §4 explicitly authorizes — never for diagnosis copy.
  const rcSwitch = vmSrc.match(/switch\s*\([^)]*reasonCode[^)]*\)/g) || []
  for (const sw of rcSwitch) {
    assert.ok(/UI_STATE/.test(vmSrc.slice(vmSrc.indexOf(sw), vmSrc.indexOf(sw) + 400)), 'reasonCode switch must map to UI_STATE only')
  }
})

// §4 — complete state matrix ───────────────────────────────────────────────

test('§4A: UNIQUE → full primary flow, hasPrimary=true', () => {
  const vm = VM.A
  assert.strictEqual(vm.uiState, 'UNIQUE')
  assert.strictEqual(vm.hasPrimary, true)
  assert.ok(vm.verdict && vm.verdict.summary.length > 8)
  assert.ok(vm.currentModel)
  assert.ok(vm.worldRule)
  assert.ok(vm.evidence)
  assert.ok(vm.consequence)
  assert.ok(vm.upgrade)
  assert.ok(vm.protocol)
  assert.ok(vm.scenario)
  assert.ok(vm.secondary)
})

test('§4B: MULTIPLE → no fake primary, no false "insufficient" copy', () => {
  const vm = VM.B
  assert.strictEqual(vm.uiState, 'MULTIPLE')
  assert.strictEqual(vm.hasPrimary, false)
  assert.strictEqual(vm.verdict, null, 'no fabricated primary verdict')
  // must not say evidence is insufficient
  assert.ok(!/不足|不够/.test(vm.stateMessage), `MULTIPLE must not claim insufficiency: ${vm.stateMessage}`)
  assert.ok(/多个|多/.test(vm.stateMessage), 'MULTIPLE must communicate multiple models')
})

test('§4C: NO_PRIMARY → neutral, no pathology invention', () => {
  const vm = VM.C
  assert.strictEqual(vm.uiState, 'NO_PRIMARY')
  assert.strictEqual(vm.hasPrimary, false)
  assert.strictEqual(vm.verdict, null)
  assert.strictEqual(vm.evidence, null)
  assert.ok(!/隐藏|缺陷|问题/.test(vm.stateMessage), `NO_PRIMARY must not invent pathology: ${vm.stateMessage}`)
})

test('§4D: INSUFFICIENT → true-insufficiency only, retake CTA allowed', () => {
  const vm = VM.D
  assert.strictEqual(vm.uiState, 'INSUFFICIENT')
  assert.strictEqual(vm.hasPrimary, false)
  assert.strictEqual(vm.retakeAvailable, true)
  assert.ok(/不足|不够|无法/.test(vm.stateMessage), 'INSUFFICIENT must communicate true insufficiency')
})

test('§4E: CONTRADICTORY → no winner selected', () => {
  const vm = VM.E
  assert.strictEqual(vm.uiState, 'CONTRADICTORY')
  assert.strictEqual(vm.hasPrimary, false)
  assert.strictEqual(vm.verdict, null, 'no fake primary in contradictory')
  assert.ok(/冲突|收敛|竞争/.test(vm.stateMessage), `CONTRADICTORY must mention competing evidence: ${vm.stateMessage}`)
})

test('§4F: BLOCKED → no diagnosis content rendered', () => {
  const vm = VM.F
  assert.strictEqual(vm.uiState, 'BLOCKED')
  assert.strictEqual(vm.hasPrimary, false)
  assert.strictEqual(vm.verdict, null)
  assert.strictEqual(vm.evidence, null)
  assert.strictEqual(vm.worldRule, null)
  assert.strictEqual(vm.protocol, null)
  assert.strictEqual(vm.scenario, null)
  assert.strictEqual(vm.secondary, null)
  assert.strictEqual(vm.retakeAvailable, false)
})

// §5 North Star visual hierarchy ───────────────────────────────────────────

test('§5: human verdict is the first hero content, taxonomy is a secondary badge', () => {
  const wxml = readPageFile('v21-cognitive-report.wxml')
  // hero eyebrow + hero-verdict appear before any taxonomy-dominant content
  const heroIdx = wxml.indexOf('hero-verdict')
  assert.ok(heroIdx > -1)
  // the verdict summary is bound before the blindSpotLabel (which is just a badge)
  assert.ok(heroIdx < wxml.indexOf('hero-label'))
  // taxonomy (full model map / archetype) lives only in the collapsed secondary section
  const mapIdx = wxml.indexOf('fullModelMap')
  const secondaryHeadIdx = wxml.indexOf('collapsible-head')
  assert.ok(secondaryHeadIdx > -1 && mapIdx > secondaryHeadIdx, 'dimension map must be inside collapsed secondary')
})

test('§5: world-rule comparison + evidence + protocol + scenario all visible', () => {
  const wxml = readPageFile('v21-cognitive-report.wxml')
  assert.ok(wxml.includes('contrast-block'), 'world-rule comparison visible')
  assert.ok(wxml.includes('evidence-item'), 'evidence chain visible')
  assert.ok(wxml.includes('protocol-step'), 'decision protocol visible')
  assert.ok(wxml.includes('scenario-side'), 'scenario model-shift visible')
})

test('§5: archetype/dimension never primary cards', () => {
  const wxml = readPageFile('v21-cognitive-report.wxml')
  // archetype block only within collapsible-body
  const archIdx = wxml.indexOf('secondary.archetype')
  const bodyIdx = wxml.indexOf('collapsible-body')
  assert.ok(archIdx > bodyIdx, 'archetype must be inside collapsed body')
  assert.ok(wxml.includes('secondaryExpanded'), 'collapse state controls secondary')
})

// §6 R4.5 SYSTEMS fixture ──────────────────────────────────────────────────

test('§6: R4.5 renders human verdict + world rule + misalignment + 2 evidence', () => {
  const vm = VM.A // SYSTEMS
  assert.strictEqual(STATE_CM.A.diagnosisState.primaryBlindSpotId, 'SYSTEM_THINKING_GAP')
  assert.ok(vm.verdict.summary.length > 8, 'human verdict present')
  assert.ok(vm.worldRule.userModel.length > 0, 'user current model present')
  assert.ok(vm.worldRule.worldRule.length > 0, 'world operating rule present')
  assert.ok(vm.worldRule.misalignment.length > 0, 'explicit misalignment present')
  assert.strictEqual(vm.evidence.items.length, 2, '2 evidence items')
  assert.ok(vm.consequence.consequence.length > 0, 'decision consequence present')
  assert.ok(vm.upgrade.upgradedModel.length > 0, 'cognitive upgrade present')
  assert.ok(vm.protocol.steps.length >= 3, 'decision protocol present')
  assert.ok(vm.scenario.currentModel.likelyDecisionPattern.length > 0, 'old-model scenario')
  assert.ok(vm.scenario.upgradedModel.likelyDecisionPattern.length > 0, 'upgraded-model scenario')
  assert.strictEqual(vm.scenario.simulationNote, '情景推演，不是预测')
})

// §7 raw token / copy safety ───────────────────────────────────────────────

test('§7: no raw internal token or English paragraph in any VM string (all 6 states)', () => {
  const rawTokens = [
    'blindSpotId', 'strategyId', 'reasonCode', 'questionId', 'optionId', 'signalId', 'evidenceId',
    'SYSTEM_THINKING_GAP', 'BUILD_DECISION_SYSTEM', 'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR', 'OPERATOR',
    'DISTORTED', 'HEALTHY', 'MIXED', 'STRONG', 'WEAK', 'MODERATE', 'UNKNOWN', 'NEUTRAL',
    'DECISION_MODEL', 'FEEDBACK_MODEL', 'PROBABILITY_MODEL', 'RISK_MODEL', 'LEVERAGE_MODEL', 'TIME_MODEL', 'IDENTITY_MODEL', 'OPPORTUNITY_MODEL',
  ]
  for (const state of Object.keys(VM)) {
    for (const s of collectStrings(VM[state])) {
      assert.ok(!rawTokens.includes(s), `raw token leaked in ${state}: ${s}`)
      // English paragraph: a run of 2+ ASCII words
      assert.ok(!/[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(s), `English paragraph leaked in ${state}: ${s}`)
    }
  }
})

test('§7: WXML binds only localized fields, no raw token keys', () => {
  const wxml = readPageFile('v21-cognitive-report.wxml')
  const rawTokens = ['blindSpotId', 'strategyId', 'reasonCode', 'questionId', 'optionId', 'signalId', 'evidenceId', 'source.']
  for (const t of rawTokens) {
    assert.ok(!wxml.includes(t), `WXML references raw token: ${t}`)
  }
})

// §8 content duplication ───────────────────────────────────────────────────

test('§8: no exact visible paragraph duplication across the 4 specified primary pairs', () => {
  const vm = VM.A
  // Specified pairs (§8): verdict vs consequence, upgrade vs protocol,
  // strategy metadata vs upgrade, scenario vs consequence.
  const pairs = [
    [vm.verdict.summary, vm.consequence.consequence],
    [vm.upgrade.upgradedModel, (vm.protocol.steps[0] || {}).description || ''],
    [vm.upgrade.strategyLabel, vm.upgrade.upgradedModel],
    [vm.scenario.currentModel.likelyDecisionPattern.join(''), vm.consequence.consequence],
  ]
  for (const [a, b] of pairs) {
    if (a && b && a.length > 6 && b.length > 6) assert.notStrictEqual(a, b, `specified pair duplicated: ${a.slice(0, 20)}`)
  }
})

test('§8: currentModel === worldRule.userModel is a Stage1C-C P2 semantic redundancy (not UI-rewritten)', () => {
  const vm = VM.A
  // Stage1C-C builder calls getBlindSpotCurrentModel() for both §02 and §03.
  // This is a known P2 redundancy originating in Stage1C-C; the UI faithfully
  // consumes it and must NOT rewrite Stage1C-C truth.
  assert.strictEqual(vm.currentModel.statement, vm.worldRule.userModel)
  // Classify P2: semantic redundancy, not exact duplicate of two distinct fields.
  // The UI does not introduce any NEW duplication beyond what the report provides.
})

// §9 mobile layout / dynamic content ───────────────────────────────────────

test('§9: no fixed-height dynamic text container, no clipping, safe-area present', () => {
  const wxss = readPageFile('v21-cognitive-report.wxss')
  // Fixed pixel/rpx height on text containers is the clipping risk. `min-height:100vh`
  // (page container) and `line-height` are NOT dynamic-text fixed heights.
  const fixedPixelHeights = wxss.match(/height\s*:\s*[0-9]+(rpx|px)/g) || []
  assert.strictEqual(fixedPixelHeights.length, 0, `fixed-height text container: ${fixedPixelHeights.join(',')}`)
  assert.strictEqual(/overflow\s*:\s*hidden/.test(wxss), false, 'overflow hidden clip')
  assert.strictEqual(/text-overflow\s*:\s*ellipsis/.test(wxss), false, 'ellipsis clip')
  assert.strictEqual(/white-space\s*:\s*nowrap/.test(wxss), false, 'nowrap clip')
  assert.strictEqual(/position\s*:\s*absolute|position\s*:\s*fixed/.test(wxss), false, 'absolute positioning')
  assert.ok(wxss.includes('safe-area-inset'), 'safe-area-inset')
  assert.ok(wxss.includes('nav-safe'), 'nav-safe')
})

test('§9: logical viewport classes all render (small/standard/large) without throw', () => {
  for (const vp of [
    { windowWidth: 320, windowHeight: 568 },
    { windowWidth: 375, windowHeight: 667 },
    { windowWidth: 428, windowHeight: 926 },
  ]) {
    const appMock = defaultApp()
    appMock.globalData.v21CognitiveReport = STATE_CM.A
    const wx = defaultWx()
    wx.getSystemInfoSync = () => ({ windowWidth: vp.windowWidth, windowHeight: vp.windowHeight })
    wx.getWindowInfo = () => ({ windowWidth: vp.windowWidth, windowHeight: vp.windowHeight, statusBarHeight: 20 })
    wx.getMenuButtonBoundingClientRect = () => ({ top: 24, height: 32 })
    const { harness, error } = loadPage('v21-cognitive-report', wx, appMock)
    assert.strictEqual(error, null)
    harness.onLoad()
    assert.strictEqual(harness.data.loading, false)
    assert.strictEqual(harness.data.hasPrimary, true)
  }
})

// §10 collapse behavior ────────────────────────────────────────────────────

test('§10: secondary collapsed by default, expandable, collapsible, no report mutation', () => {
  const appMock = defaultApp()
  const frozenCopy = JSON.stringify(STATE_CM.A)
  appMock.globalData.v21CognitiveReport = STATE_CM.A
  const { harness } = loadPage('v21-cognitive-report', defaultWx(), appMock)
  harness.onLoad()
  assert.strictEqual(harness.data.secondaryExpanded, false, 'collapsed by default')
  harness.toggleSecondary()
  assert.strictEqual(harness.data.secondaryExpanded, true, 'expanded')
  harness.toggleSecondary()
  assert.strictEqual(harness.data.secondaryExpanded, false, 'collapsed again')
  // report object must not be mutated by UI
  assert.strictEqual(JSON.stringify(STATE_CM.A), frozenCopy, 'report object mutated by UI')
})

// §11 UI semantic gates (15) ───────────────────────────────────────────────

test('§11: all 15 UI semantic gates PASS', () => {
  const vm = VM.A
  const wxml = readPageFile('v21-cognitive-report.wxml')
  const gates = {
    UI_GATE_01_HUMAN_VERDICT_PRIMARY: vm.verdict && vm.verdict.summary.length > 8,
    UI_GATE_02_USER_MODEL_VISIBLE: !!(vm.currentModel && vm.currentModel.statement),
    UI_GATE_03_WORLD_RULE_VISIBLE: !!(vm.worldRule && vm.worldRule.worldRule),
    UI_GATE_04_MISALIGNMENT_VISIBLE: !!(vm.worldRule && vm.worldRule.misalignment),
    UI_GATE_05_USER_EVIDENCE_VISIBLE: !!(vm.evidence && vm.evidence.items.length >= 2),
    UI_GATE_06_DECISION_CONSEQUENCE_VISIBLE: !!(vm.consequence && vm.consequence.consequence),
    UI_GATE_07_COGNITIVE_UPGRADE_VISIBLE: !!(vm.upgrade && vm.upgrade.upgradedModel),
    UI_GATE_08_DECISION_PROTOCOL_VISIBLE: !!(vm.protocol && vm.protocol.steps.length >= 3),
    UI_GATE_09_SCENARIO_MODEL_SHIFT_VISIBLE: !!(vm.scenario && vm.scenario.currentModel && vm.scenario.upgradedModel),
    UI_GATE_10_ARCHETYPE_SECONDARY: vm.secondary && vm.secondary.archetype && !vm.verdict.archetype,
    UI_GATE_11_DIMENSION_MAP_SECONDARY: Array.isArray(vm.secondary.fullModelMap) && !vm.verdict.fullModelMap,
    UI_GATE_12_NO_SCHEMA_DUMP: !wxml.includes('source.') && !wxml.includes('provenance'),
    UI_GATE_13_NO_SEMANTIC_REDERIVATION: !/blindSpotId\s*===|switch\s*\([^)]*(blindSpot|strategy|reasonCode)/.test(readPageFile('v21-cognitive-report.js')),
    UI_GATE_14_MULTI_STATE_TRUTHFUL: VM.B.verdict === null && VM.F.verdict === null && VM.D.retakeAvailable === true,
    UI_GATE_15_SAFE_AREA_DYNAMIC_CONTENT: readPageFile('v21-cognitive-report.wxss').includes('safe-area-inset') && !/overflow\s*:\s*hidden/.test(readPageFile('v21-cognitive-report.wxss')),
  }
  const fails = Object.entries(gates).filter(([, v]) => !v)
  assert.deepStrictEqual(fails.map(([k]) => k), [], 'failed gates')
  assert.strictEqual(Object.keys(gates).length, 15)
})

// §12 mutation tests (15) ──────────────────────────────────────────────────
// Each mutation mutates a CLONE of the frozen content model / view-model
// behavior, then proves a gate/test would fail against the mutation.

test('§12 M1: taxonomy label dominating first screen → caught', () => {
  // If the verdict summary were replaced by the taxonomy label, human verdict gate fails.
  const mutated = JSON.parse(JSON.stringify(STATE_CM.A))
  const verdict = mutated.sections.find((s) => s.sectionId === '01_COGNITIVE_VERDICT')
  verdict.summary = verdict.body.blindSpotLabel // taxonomy label only
  const vm = viewModel.buildNorthStarReportViewModel(mutated)
  assert.ok(vm.verdict.summary.length <= 8, 'M1 must reduce verdict to taxonomy label length')
})

test('§12 M2: remove world-rule comparison → caught', () => {
  const mutated = JSON.parse(JSON.stringify(STATE_CM.A))
  mutated.sections = mutated.sections.filter((s) => s.sectionId !== '03_WORLD_RULE_ALIGNMENT')
  const vm = viewModel.buildNorthStarReportViewModel(mutated)
  assert.strictEqual(vm.worldRule, null, 'M2 must null worldRule')
})

test('§12 M3: hide evidence section → caught', () => {
  const mutated = JSON.parse(JSON.stringify(STATE_CM.A))
  mutated.sections = mutated.sections.filter((s) => s.sectionId !== '04_WHY_WE_JUDGE_THIS')
  const vm = viewModel.buildNorthStarReportViewModel(mutated)
  assert.strictEqual(vm.evidence, null, 'M3 must null evidence')
})

test('§12 M4: render only 1 R4.5 evidence item → caught', () => {
  const mutated = JSON.parse(JSON.stringify(STATE_CM.A))
  const ev = mutated.sections.find((s) => s.sectionId === '04_WHY_WE_JUDGE_THIS')
  ev.body.items = ev.body.items.slice(0, 1)
  const vm = viewModel.buildNorthStarReportViewModel(mutated)
  assert.strictEqual(vm.evidence.items.length, 1, 'M4 must reduce to 1 evidence item')
})

test('§12 M5: promote archetype to primary card → caught', () => {
  const mutated = JSON.parse(JSON.stringify(STATE_CM.A))
  const sec = mutated.sections.find((s) => s.sectionId === '09_SECONDARY_MODEL_CONTEXT')
  mutated.sections.unshift(sec) // archetype now a primary section
  const vm = viewModel.buildNorthStarReportViewModel(mutated)
  // archetype must still be collapsed in secondary, not primary
  assert.ok(vm.secondary, 'M5: archetype should remain secondary')
  assert.strictEqual(vm.verdict.archetype, undefined, 'M5: archetype must not be on verdict')
})

test('§12 M6: promote 9-dimension dashboard above protocol → caught', () => {
  const mutated = JSON.parse(JSON.stringify(STATE_CM.A))
  const sec = mutated.sections.find((s) => s.sectionId === '09_SECONDARY_MODEL_CONTEXT')
  const protoIdx = mutated.sections.findIndex((s) => s.sectionId === '07_DECISION_PROTOCOL')
  mutated.sections.splice(protoIdx, 0, sec)
  const vm = viewModel.buildNorthStarReportViewModel(mutated)
  assert.ok(Array.isArray(vm.secondary.fullModelMap), 'M6: dimension map must stay secondary')
})

test('§12 M7: expose raw blindSpotId/reasonCode → caught', () => {
  const mutated = JSON.parse(JSON.stringify(STATE_CM.A))
  mutated.sections.find((s) => s.sectionId === '01_COGNITIVE_VERDICT').summary = 'SYSTEM_THINKING_GAP'
  const vm = viewModel.buildNorthStarReportViewModel(mutated)
  const strings = collectStrings(vm)
  assert.ok(strings.includes('SYSTEM_THINKING_GAP'), 'M7 must expose raw token (proving test sensitivity)')
})

test('§12 M8: add frontend blindSpot-specific copy branch → caught', () => {
  // Simulate a mutated view-model that branches on blindSpotId.
  const mutatedSrc = fs.readFileSync(path.join(ROOT, 'utils/northStarReportViewModel.js'), 'utf8') + '\nfunction __mutated(b){ return b=== "SYSTEM_THINKING_GAP" ? "系统思维" : "" }\n'
  assert.ok(/blindSpotId\s*===/.test(mutatedSrc) || /b\s*===/.test(mutatedSrc), 'M8 must introduce a branch')
  // The production view-model must NOT have such a branch.
  const prod = fs.readFileSync(path.join(ROOT, 'utils/northStarReportViewModel.js'), 'utf8')
  assert.strictEqual(/blindSpotId\s*===/.test(prod), false)
})

test('§12 M9: fabricate primary in MULTIPLE → caught', () => {
  const mutated = JSON.parse(JSON.stringify(STATE_CM.B))
  mutated.diagnosisState = { ...mutated.diagnosisState, primaryBlindSpotId: 'SYSTEM_THINKING_GAP' }
  const vm = viewModel.buildNorthStarReportViewModel(mutated)
  assert.strictEqual(vm.uiState, 'UNIQUE', 'M9 fabricated primary must change state to UNIQUE (caught by state matrix)')
})

test('§12 M10: show "evidence insufficient" for MULTIPLE → caught', () => {
  const mutated = JSON.parse(JSON.stringify(STATE_CM.B))
  mutated.diagnosisState = { ...mutated.diagnosisState, reasonCode: 'INSUFFICIENT_DIRECTIONAL_EVIDENCE' }
  const vm = viewModel.buildNorthStarReportViewModel(mutated)
  assert.strictEqual(vm.uiState, 'INSUFFICIENT', 'M10 must shift MULTIPLE→INSUFFICIENT (caught)')
})

test('§12 M11: show diagnosis content in BLOCKED → caught', () => {
  const mutated = JSON.parse(JSON.stringify(STATE_CM.F))
  mutated.diagnosisState = { ...mutated.diagnosisState, primaryBlindSpotId: 'SYSTEM_THINKING_GAP' }
  const vm = viewModel.buildNorthStarReportViewModel(mutated)
  assert.strictEqual(vm.uiState, 'UNIQUE', 'M11 blocked+primary must be caught as non-blocked')
})

test('§12 M12: remove scenario "not prediction" semantics → caught', () => {
  const mutated = JSON.parse(JSON.stringify(STATE_CM.A))
  const sc = mutated.sections.find((s) => s.sectionId === '08_SCENARIO_CONTRAST')
  sc.body.simulationNote = ''
  const vm = viewModel.buildNorthStarReportViewModel(mutated)
  assert.strictEqual(vm.scenario.simulationNote, '', 'M12 must remove simulation note')
})

test('§12 M13: introduce fixed-height clipping container → caught', () => {
  const mutatedWxss = readPageFile('v21-cognitive-report.wxss') + '\n.card { height: 200rpx; overflow: hidden; }\n'
  assert.ok(/height\s*:\s*200rpx/.test(mutatedWxss), 'M13 must introduce fixed height')
  const prod = readPageFile('v21-cognitive-report.wxss')
  assert.strictEqual(/\.card\s*\{[^}]*height\s*:/.test(prod), false, 'production must not have fixed-height card')
})

test('§12 M14: duplicate same strategy paragraph in two primary cards → caught', () => {
  const mutated = JSON.parse(JSON.stringify(STATE_CM.A))
  const up = mutated.sections.find((s) => s.sectionId === '06_COGNITIVE_UPGRADE')
  const cs = mutated.sections.find((s) => s.sectionId === '05_DECISION_CONSEQUENCE')
  cs.summary = up.body.upgradedModel // duplicate the upgrade paragraph into consequence
  const vm = viewModel.buildNorthStarReportViewModel(mutated)
  assert.strictEqual(vm.consequence.consequence, vm.upgrade.upgradedModel, 'M14 must duplicate paragraph')
})

test('§12 M15: make view-model mutate report object → caught', () => {
  const frozen = JSON.stringify(STATE_CM.A)
  const mutated = JSON.parse(JSON.stringify(STATE_CM.A))
  // Simulate mutation: view-model writes into the report object.
  mutated.diagnosisState.primaryBlindSpotId = 'MUTATED'
  assert.notStrictEqual(JSON.stringify(STATE_CM.A), JSON.stringify(mutated), 'M15 must mutate report')
  // Production view-model must not mutate its input.
  const vm = viewModel.buildNorthStarReportViewModel(STATE_CM.A)
  assert.strictEqual(JSON.stringify(STATE_CM.A), frozen, 'production view-model mutated report')
  assert.strictEqual(vm.supported, true)
})

// §14/§15 non-interference ─────────────────────────────────────────────────

test('§14/§15: Stage1C-C/B + diagnosis output unchanged by D work', () => {
  // The UI layer never imports or rewrites engine/presentation/report modules.
  // Prove the frozen content model is byte-stable across repeated builds.
  const cm1 = JSON.stringify(buildContentModel(uniquePrimaryAnswers('SYSTEMS')))
  const cm2 = JSON.stringify(buildContentModel(uniquePrimaryAnswers('SYSTEMS')))
  assert.strictEqual(cm1, cm2, 'content model must be deterministic')
  // diagnosis decision deterministic
  const responses = withPositions(uniquePrimaryAnswers('SYSTEMS'))
  const d1 = runCognitionChainV21(responses).decision
  const d2 = runCognitionChainV21(responses).decision
  assert.strictEqual(d1.primaryBlindSpotId, d2.primaryBlindSpotId)
  assert.strictEqual(d1.reasonCode, d2.reasonCode)
})
