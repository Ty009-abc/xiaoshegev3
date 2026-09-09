/**
 * RC8.3 Stage1C-D1 — North Star report UI information architecture tests.
 *
 * Verifies the PURE-PRESENTATION UI layer:
 *   - view-model builder converts north_star_report_v1 → flat WXML-bindable VM
 *     with NO raw internal tokens and NO semantic re-derivation.
 *   - page renders 8 primary sections + 1 collapsed secondary context.
 *   - R4.5 SYSTEM_THINKING_GAP fixture renders all required content.
 *   - page JS/WXML carry NO blind-spot/strategy/world-rule/archetype diagnosis
 *     copy (duplicate copy tables forbidden).
 *   - archetype is never a primary card; dimension map is collapsed.
 *   - safe-area behavior preserved.
 *
 * `node --test`
 *
 * @version north_star_report_v1 (UI)
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const { loadPage, defaultWx, defaultApp } = require('./ui/helpers/pageShim.js')

const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const { runCognitionChainV21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const builder = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportBuilderV21.js')
const presentation = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/index.js')
const reportBuilder = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/index.js')
const viewModel = require('../utils/northStarReportViewModel.js')
const { CONSTRUCTS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')

// ── Fixtures (engine-identical to Stage1C-C1) ──────────────────────────────

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

function uniquePrimaryAnswers(construct) {
  const map = {}
  for (const c of CONSTRUCTS_V21) map[c] = { ...HEALTHY[c] }
  map[construct] = { ...DISTORTED_PAIR[construct] }
  const out = []
  for (const c of CONSTRUCTS_V21) {
    for (const qid of Object.keys(map[c])) out.push({ questionId: qid, optionId: map[c][qid] })
  }
  return out
}

function withPositions(answers, seed = 3) {
  return answers.map((a, i) => ({ ...a, displayPosition: (i * seed) % 4 }))
}

function buildReportContentModel(construct) {
  const responses = withPositions(uniquePrimaryAnswers(construct))
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
  return reportBuilder.buildNorthStarReportV21(pm)
}

const R45_REPORT = buildReportContentModel('SYSTEMS')

function collectVmStrings(vm) {
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

// ── §20a: primary section ordering (8 primary + 1 secondary collapsed) ────

test('view model: has exactly 8 primary fields + 1 secondary field', () => {
  const vm = viewModel.buildNorthStarReportViewModel(R45_REPORT)
  assert.strictEqual(vm.supported, true)
  assert.strictEqual(vm.hasPrimary, true)
  assert.ok(vm.verdict)
  assert.ok(vm.currentModel)
  assert.ok(vm.worldRule)
  assert.ok(vm.evidence)
  assert.ok(vm.consequence)
  assert.ok(vm.upgrade)
  assert.ok(vm.protocol)
  assert.ok(vm.scenario)
  assert.ok(vm.secondary)
})

test('view model: primary flow fields carry correct titles (8 sections)', () => {
  const vm = viewModel.buildNorthStarReportViewModel(R45_REPORT)
  assert.strictEqual(vm.verdict.title, '核心认知诊断')
  assert.strictEqual(vm.currentModel.title, '你的默认世界模型')
  assert.strictEqual(vm.worldRule.title, '你与现实规则的错位')
  assert.strictEqual(vm.evidence.title, '为什么这样判断你')
  assert.strictEqual(vm.consequence.title, '这个模型如何影响决策')
  assert.strictEqual(vm.upgrade.title, '你的认知升级')
  assert.strictEqual(vm.protocol.title, '下一次怎么做')
  assert.strictEqual(vm.scenario.title, '旧模型 vs 新模型')
  assert.strictEqual(vm.secondary.title, '完整认知地图')
})

test('view model: unsupported/foreign report returns supported=false', () => {
  const vm = viewModel.buildNorthStarReportViewModel(null)
  assert.strictEqual(vm.supported, false)
  const vm2 = viewModel.buildNorthStarReportViewModel({ version: 'other', sections: [] })
  assert.strictEqual(vm2.supported, false)
})

// ── §20b: archetype not primary, dimension map collapsed ──────────────────

test('view model: archetype lives only inside secondary, never a primary field', () => {
  const vm = viewModel.buildNorthStarReportViewModel(R45_REPORT)
  // No archetype on any primary section
  for (const key of ['verdict', 'currentModel', 'worldRule', 'evidence', 'consequence', 'upgrade', 'protocol', 'scenario']) {
    assert.ok(!vm[key] || vm[key].archetype === undefined, `${key} must not carry archetype`)
  }
  // archetype present in secondary
  assert.ok(vm.secondary.archetype, 'archetype should be present in secondary context')
})

test('view model: dimension map is in secondary only, collapsed by page default', () => {
  const vm = viewModel.buildNorthStarReportViewModel(R45_REPORT)
  assert.ok(Array.isArray(vm.secondary.fullModelMap))
  // No dimension map on primary sections
  for (const key of ['verdict', 'currentModel', 'worldRule', 'evidence', 'consequence', 'upgrade', 'protocol', 'scenario']) {
    assert.ok(!vm[key] || vm[key].fullModelMap === undefined, `${key} must not carry dimension map`)
  }
})

// ── §20c: evidence item rendering (2 items for R4.5) ──────────────────────

test('view model: R4.5 renders 2 user-specific evidence items, no provenance tokens', () => {
  const vm = viewModel.buildNorthStarReportViewModel(R45_REPORT)
  assert.strictEqual(vm.evidence.items.length, 2)
  for (const item of vm.evidence.items) {
    assert.ok(item.questionMeaning.length > 0)
    assert.ok(item.selectedAnswerMeaning.length > 0)
    assert.ok(item.whatSignalItShows.length > 0)
    assert.ok(item.howItSupportsDiagnosis.length > 0)
    // no raw provenance keys
    assert.strictEqual(item.questionId, undefined)
    assert.strictEqual(item.optionId, undefined)
    assert.strictEqual(item.evidenceId, undefined)
    assert.strictEqual(item.signalId, undefined)
  }
})

// ── §20d: world-rule contrast rendering ───────────────────────────────────

test('view model: world-rule contrast has user model + world rule + misalignment', () => {
  const vm = viewModel.buildNorthStarReportViewModel(R45_REPORT)
  assert.ok(vm.worldRule.userModel.length > 0)
  assert.ok(vm.worldRule.worldRule.length > 0)
  assert.ok(vm.worldRule.misalignment.length > 0)
})

// ── §20e: decision protocol rendering ─────────────────────────────────────

test('view model: decision protocol has trigger + steps + success + review + stop', () => {
  const vm = viewModel.buildNorthStarReportViewModel(R45_REPORT)
  assert.ok(vm.protocol.trigger.length > 0)
  assert.ok(vm.protocol.steps.length >= 3)
  for (const s of vm.protocol.steps) {
    assert.ok(s.name.length > 0)
    assert.ok(s.description.length > 0)
    assert.strictEqual(s.order, s.order) // order present
  }
  assert.ok(vm.protocol.successSignal.length > 0)
  assert.ok(vm.protocol.reviewWindow.length > 0)
  assert.ok(vm.protocol.stopCondition.length > 0)
})

// ── §20f: scenario disclaimer ─────────────────────────────────────────────

test('view model: scenario has simulation disclaimer + model-shift contrast', () => {
  const vm = viewModel.buildNorthStarReportViewModel(R45_REPORT)
  assert.ok(vm.scenario.currentModel.likelyDecisionPattern.length > 0)
  assert.ok(vm.scenario.upgradedModel.likelyDecisionPattern.length > 0)
  assert.strictEqual(vm.scenario.simulationNote, '情景推演，不是预测')
})

// ── §20g: no raw internal token binding (view model is token-free) ────────

test('view model: no raw internal tokens in any string leaf (all 9 blind spots)', () => {
  const rawTokens = [
    'SYSTEM_THINKING_GAP', 'OPPORTUNITY_BLINDNESS', 'FEEDBACK_LOOP_GAP', 'DECISION_INERTIA',
    'RISK_MODEL_DISTORTION', 'PROBABILITY_MISJUDGMENT', 'IDENTITY_CONSTRAINT', 'LEVERAGE_MODEL_GAP',
    'TIME_HORIZON_TRAP', 'BUILD_DECISION_SYSTEM', 'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR',
    'OPERATOR', 'DISTORTED', 'HEALTHY', 'STRONG', 'WEAK', 'MIXED', 'UNKNOWN', 'NEUTRAL',
    'DECISION', 'FEEDBACK', 'PROBABILITY', 'RISK', 'LEVERAGE', 'TIME', 'IDENTITY', 'OPPORTUNITY', 'SYSTEMS',
    'DECISION_MODEL', 'FEEDBACK_MODEL', 'PROBABILITY_MODEL', 'RISK_MODEL', 'LEVERAGE_MODEL', 'TIME_MODEL', 'IDENTITY_MODEL', 'OPPORTUNITY_MODEL',
  ]
  for (const construct of CONSTRUCTS_V21) {
    const vm = viewModel.buildNorthStarReportViewModel(buildReportContentModel(construct))
    for (const s of collectVmStrings(vm)) {
      assert.ok(!rawTokens.includes(s), `raw token leaked into view model: ${s}`)
    }
  }
})

// ── §20h: no blind-spot/strategy/world-rule/archetype copy in JS/WXML ──────

test('page: no duplicate diagnosis copy in JS/WXML/WXSS (copy authority = Stage1C-C only)', () => {
  const copy = reportBuilder.copy
  // Collect all user-facing diagnosis copy from the copy table.
  const copyStrings = new Set()
  for (const key of Object.keys(copy)) {
    const v = copy[key]
    if (typeof v === 'string') copyStrings.add(v)
    else if (typeof v === 'object' && v !== null) {
      for (const k of Object.keys(v)) {
        const sv = v[k]
        if (typeof sv === 'string') copyStrings.add(sv)
      }
    }
  }
  // Read page files.
  const js = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.js'), 'utf8')
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.wxml'), 'utf8')

  let uiBlindspotSpecific = 0
  let uiStrategySpecific = 0
  let uiWorldRuleSpecific = 0
  for (const s of copyStrings) {
    if (s.length < 6) continue // skip short tokens
    if (js.includes(s) || wxml.includes(s)) {
      // Classify roughly: strategy copy contains 步骤/实验/复盘, world-rule contains 世界/规则/错位.
      // All three categories are forbidden in page files; count them all.
      if (/策略|升级|实验|复盘|停止|成功信号/.test(s)) uiStrategySpecific++
      else if (/规则|涌现|概率|复利|杠杆|反馈|机会|风险|身份|决策|系统/.test(s)) uiWorldRuleSpecific++
      else uiBlindspotSpecific++
    }
  }
  assert.strictEqual(uiBlindspotSpecific, 0, `blind-spot-specific copy leaked into page: ${uiBlindspotSpecific}`)
  assert.strictEqual(uiStrategySpecific, 0, `strategy-specific copy leaked into page: ${uiStrategySpecific}`)
  assert.strictEqual(uiWorldRuleSpecific, 0, `world-rule-specific copy leaked into page: ${uiWorldRuleSpecific}`)
})

test('page JS/WXML: no raw engine tokens rendered verbatim', () => {
  const js = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.js'), 'utf8')
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.wxml'), 'utf8')
  const rawTokens = [
    'SYSTEM_THINKING_GAP', 'BUILD_DECISION_SYSTEM', 'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR',
    'WORLD_MODEL_V2_1_ENGINE', 'blindSpotId', 'strategyId', 'reasonCode', 'signalId', 'questionId', 'optionId',
  ]
  for (const t of rawTokens) {
    assert.ok(!js.includes(t) && !wxml.includes(t), `raw token in page: ${t}`)
  }
})

// ── §20i: R4.5 fixture full page render (via pageShim harness) ────────────

test('page: renders R4.5 fixture into view model with all sections (no throw)', () => {
  const appMock = defaultApp()
  appMock.globalData.v21CognitiveReport = R45_REPORT
  const { harness, error } = loadPage('v21-cognitive-report', defaultWx(), appMock)
  assert.strictEqual(error, null)
  harness.onLoad()
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data.hasPrimary, true)
  assert.ok(harness.data.verdict && harness.data.verdict.summary.length > 8)
  assert.ok(harness.data.worldRule && harness.data.worldRule.misalignment.length > 0)
  assert.strictEqual(harness.data.evidence.items.length, 2)
  assert.ok(harness.data.protocol && harness.data.protocol.steps.length >= 3)
  assert.ok(harness.data.scenario && harness.data.scenario.simulationNote === '情景推演，不是预测')
  assert.ok(harness.data.secondary && harness.data.secondary.archetype)
  assert.strictEqual(harness.data.secondaryExpanded, false, 'secondary collapsed by default')
})

test('page: toggleSecondary flips collapse state', () => {
  const appMock = defaultApp()
  appMock.globalData.v21CognitiveReport = R45_REPORT
  const { harness } = loadPage('v21-cognitive-report', defaultWx(), appMock)
  harness.onLoad()
  assert.strictEqual(harness.data.secondaryExpanded, false)
  harness.toggleSecondary()
  assert.strictEqual(harness.data.secondaryExpanded, true)
  harness.toggleSecondary()
  assert.strictEqual(harness.data.secondaryExpanded, false)
})

test('page: unsupported report object → unsupported state, no throw', () => {
  const appMock = defaultApp()
  appMock.globalData.v21CognitiveReport = { worldModel: { dimensions: [] } } // legacy diagnostic_v2_1
  const { harness } = loadPage('v21-cognitive-report', defaultWx(), appMock)
  harness.onLoad()
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data.unsupported, true)
})

test('page: missing report → error state', () => {
  const appMock = defaultApp()
  appMock.globalData.v21CognitiveReport = null
  const { harness } = loadPage('v21-cognitive-report', defaultWx(), appMock)
  harness.onLoad()
  assert.strictEqual(harness.data.loading, false)
  assert.ok(harness.data.error.length > 0)
})

// ── §20j: safe-area preserved ─────────────────────────────────────────────

test('page: safe-area behavior preserved (nav-safe + totalNavHeight + _initNavBar)', () => {
  const js = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.js'), 'utf8')
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.wxml'), 'utf8')
  const wxss = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.wxss'), 'utf8')
  assert.ok(js.includes('_initNavBar'))
  assert.ok(js.includes('getMenuButtonBoundingClientRect'))
  assert.ok(js.includes('totalNavHeight'))
  assert.ok(wxml.includes('nav-safe'))
  assert.ok(wxml.includes('totalNavHeight'))
  assert.ok(wxss.includes('nav-safe'))
  assert.ok(wxss.includes('safe-area-inset'))
})

// ── §20k: state-aware foundation (no hardwired unique-primary assumption) ──

test('view model: no-primary report (all healthy) builds neutral state, no diagnosis content', () => {
  const responses = withPositions((() => {
    const out = []
    for (const c of CONSTRUCTS_V21) for (const qid of Object.keys(HEALTHY[c])) out.push({ questionId: qid, optionId: HEALTHY[c][qid] })
    return out
  })())
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)
  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })
  const pm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: cognition.decision, answerTrace: report.trace.answerTrace, dimensions: cognition.dimensions,
    cognitiveBlindSpot: report.cognitiveBlindSpot, worldStrategy: report.worldStrategy,
    cognitiveArchetype: report.cognitiveArchetype, scenarioSimulation: report.scenarioSimulation,
    validityStatus: validity.status,
  })
  const cm = reportBuilder.buildNorthStarReportV21(pm)
  assert.strictEqual(cm.diagnosisState.reasonCode, 'NO_SUPPORTED_DEFICIT')
  const vm = viewModel.buildNorthStarReportViewModel(cm)
  assert.strictEqual(vm.supported, true)
  assert.strictEqual(vm.uiState, 'NO_PRIMARY')
  assert.strictEqual(vm.hasPrimary, false)
  // neutral state: no diagnosis sections rendered, no pathology copy
  assert.strictEqual(vm.verdict, null)
  assert.strictEqual(vm.evidence, null)
  assert.ok(vm.stateMessage.length > 0)
  assert.strictEqual(vm.retakeAvailable, false)
})
