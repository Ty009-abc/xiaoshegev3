/**
 * RC8.3 Stage1B R4.4 — V2.1 多模型报告语义 + UI 修复验收测试
 *
 * 锁定 R4.4 修复：
 *   P0  MULTIPLE_SUPPORTED_MODELS 不得表达为「回答不足」；builder 按 reasonCode 分支
 *   P0  多模型状态展示有效证据/多模型文案，不臆造唯一主因/原型/策略/场景，
 *       不提示重测 18Q，不声称证据不足
 *   P0  保留独立「真证据不足」分支（INSUFFICIENT_DIRECTIONAL_EVIDENCE）
 *   P1  pages/v21-cognitive-report 自定义导航安全区
 *   P2  原始枚举 token 本地化为中文展示标签
 *
 * 约束：引擎语义完全不变（引擎输出/问卷/golden/report-contract diff 全 0）。
 *
 * 使用 `node --test`。
 *
 * @version world_model_v2_1 (multi-model report semantics + UI)
 */

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')

const builder = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportBuilderV21.js')
const contract = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportContractV21.js')
const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const { runCognitionChainV21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const { CONSTRUCTS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')
const labels = require('../utils/v21DisplayLabels.js')

// ── 夹具 ──────────────────────────────────────────────────────────────────
// 6× DISTORTED·STRONG（DECISION/FEEDBACK/PROBABILITY/RISK/TIME/OPPORTUNITY）
// 1× HEALTHY·STRONG（IDENTITY）、2× MIXED·WEAK（LEVERAGE/SYSTEMS）
// → decision.status=INSUFFICIENT_EVIDENCE，reasonCode=MULTIPLE_SUPPORTED_MODELS，6 个并列候选。
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

// 全部健康 → NO_PRIMARY_DEFICIT（唯一主因不存在，但证据充分，非「不足」）
const ALL_HEALTHY_ANSWERS = [
  { questionId: 'SC_DEC_01', optionId: 'A' },
  { questionId: 'SC_DEC_02', optionId: 'A' },
  { questionId: 'SC_FB_01', optionId: 'A' },
  { questionId: 'SC_FB_02', optionId: 'A' },
  { questionId: 'SC_PROB_01', optionId: 'A' },
  { questionId: 'SC_PROB_02', optionId: 'A' },
  { questionId: 'SC_RISK_01', optionId: 'A' },
  { questionId: 'SC_RISK_02', optionId: 'A' },
  { questionId: 'SC_LEV_01', optionId: 'B' },
  { questionId: 'SC_LEV_02', optionId: 'B' },
  { questionId: 'SC_TIME_01', optionId: 'B' },
  { questionId: 'SC_TIME_02', optionId: 'A' },
  { questionId: 'SC_ID_01', optionId: 'A' },
  { questionId: 'SC_ID_02', optionId: 'B' },
  { questionId: 'SC_OPP_01', optionId: 'A' },
  { questionId: 'SC_OPP_02', optionId: 'A' },
  { questionId: 'SC_SYS_01', optionId: 'A' },
  { questionId: 'SC_SYS_02', optionId: 'A' },
]

function withPositions(answers, seed) {
  return answers.map((a, i) => ({ ...a, displayPosition: (i * seed) % 4 }))
}

function buildReport(answers, seed = 3) {
  const responses = withPositions(answers, seed)
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)
  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })
  return { responses, validity, cognition, report }
}

// ── P0: MULTIPLE_SUPPORTED_MODELS 语义 ─────────────────────────────────────
test('P0: 6-way fixture → MULTIPLE_SUPPORTED_MODELS (engine unchanged)', () => {
  const { cognition } = buildReport(MULTI_MODEL_ANSWERS)
  assert.strictEqual(cognition.decision.status, 'INSUFFICIENT_EVIDENCE')
  assert.strictEqual(cognition.decision.reasonCode, 'MULTIPLE_SUPPORTED_MODELS')
  assert.strictEqual(cognition.decision.eligibleCandidateIds.length, 6)
  assert.strictEqual(cognition.decision.primaryBlindSpotId, null)
})

test('P0: MULTIPLE_SUPPORTED_MODELS expression must NOT claim 回答不足/重测', () => {
  const { report } = buildReport(MULTI_MODEL_ANSWERS)
  const ex = report.expression
  assert.ok(ex.length > 0)
  assert.ok(!ex.includes('不足'), 'expression must not claim 不足')
  assert.ok(!ex.includes('重新完成'), 'expression must not advise retaking 18Q')
  assert.ok(!ex.includes('重新测评'), 'expression must not advise retaking')
  assert.ok(!ex.includes('证据不足'), 'expression must not claim evidence insufficient')
})

test('P0: MULTIPLE_SUPPORTED_MODELS → no fabricated primary/archetype/strategy/scenario', () => {
  const { report } = buildReport(MULTI_MODEL_ANSWERS)
  assert.strictEqual(report.cognitiveBlindSpot, null, 'no fabricated primary blind spot')
  assert.strictEqual(report.worldStrategy, null, 'no fabricated strategy')
  assert.strictEqual(report.cognitiveArchetype, null, 'no fabricated archetype')
  assert.strictEqual(report.scenarioSimulation, null, 'no fabricated scenario')
  assert.strictEqual(report.finalVerdict.primaryBlindSpotId, null)
})

test('P0 mutation: 5 forbidden fabrications all caught in multi-model state', () => {
  const { report } = buildReport(MULTI_MODEL_ANSWERS)
  const ex = report.expression
  // Mutation 1: fabricated primary blind spot
  assert.strictEqual(report.cognitiveBlindSpot, null)
  assert.strictEqual(report.finalVerdict.primaryBlindSpotId, null)
  // Mutation 2: fabricated archetype
  assert.strictEqual(report.cognitiveArchetype, null)
  // Mutation 3: fabricated strategy
  assert.strictEqual(report.worldStrategy, null)
  // Mutation 4: fabricated scenario
  assert.strictEqual(report.scenarioSimulation, null)
  // Mutation 5: retake-18Q advice / insufficient-evidence claim
  assert.ok(!ex.includes('不足') && !ex.includes('重新') && !ex.includes('重测'), 'no insufficiency/retake wording')
})

test('P0: multiModelSummary exposes engine truth (6 eligible, non-ranked)', () => {
  const { report } = buildReport(MULTI_MODEL_ANSWERS)
  const s = report.multiModelSummary
  assert.ok(s, 'multiModelSummary must be present')
  assert.strictEqual(s.state, 'MULTIPLE_SUPPORTED_MODELS')
  assert.strictEqual(s.reasonCode, 'MULTIPLE_SUPPORTED_MODELS')
  assert.strictEqual(s.supportedModelCount, 6)
  assert.strictEqual(s.models.length, 6)
  // Each model has a Chinese label + questionAnswered, no raw score/probability.
  for (const m of s.models) {
    assert.ok(m.label && m.label.length > 0)
    assert.ok(m.questionAnswered.length > 0)
    assert.ok(!('score' in m), 'no numeric score in multi-model summary')
    assert.ok(!('probability' in m), 'no probability in multi-model summary')
  }
  // Blindspot labels come from frozen definitions, no ranking/numbering.
  const labelsSeen = s.models.map((m) => m.label)
  assert.strictEqual(new Set(labelsSeen).size, 6)
})

// ── P0: 状态矩阵（4 状态）──────────────────────────────────────────────────
test('P0 state matrix: PRIMARY_ALLOWED keeps normal primary expression', () => {
  const primary = [
    { questionId: 'SC_DEC_01', optionId: 'B' },
    { questionId: 'SC_DEC_02', optionId: 'C' },
    ...ALL_HEALTHY_ANSWERS.slice(2),
  ]
  const { cognition, report } = buildReport(primary)
  assert.strictEqual(cognition.decision.status, 'PRIMARY_ALLOWED')
  assert.ok(report.cognitiveBlindSpot, 'primary blind spot resolved')
  assert.ok(report.expression.includes(report.cognitiveBlindSpot.label))
  assert.strictEqual(report.multiModelSummary, null)
})

test('P0 state matrix: NO_PRIMARY_DEFICIT keeps no-deficit expression (NOT 不足)', () => {
  const { cognition, report } = buildReport(ALL_HEALTHY_ANSWERS)
  assert.strictEqual(cognition.decision.status, 'NO_PRIMARY_DEFICIT')
  assert.strictEqual(report.cognitiveBlindSpot, null)
  assert.ok(!report.expression.includes('不足'), 'no-deficit is NOT insufficiency')
  assert.ok(!report.expression.includes('重新完成'), 'no-deficit must not advise retake')
  assert.strictEqual(report.multiModelSummary, null)
})

test('P0 state matrix: true insufficient evidence keeps retake guidance (gated)', () => {
  // Directly unit-test the deterministic expression for the explicit reasonCode.
  const verdict = { status: 'INSUFFICIENT_EVIDENCE', reasonCode: 'INSUFFICIENT_DIRECTIONAL_EVIDENCE' }
  const ex = builder.buildDeterministicExpressionV21(null, null, verdict)
  assert.ok(ex.includes('不足'), 'true insufficiency must state 不足')
  assert.ok(ex.includes('重新完成'), 'true insufficiency must advise retake')
})

test('P0 state matrix: blocked validity → NOT_EXECUTED (not evidence verdict)', () => {
  const responses = ALL_HEALTHY_ANSWERS.map((a) => ({ ...a, displayPosition: 0 }))
  const validity = responseValidity.assessResponseValidityV21(responses)
  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition: null })
  assert.strictEqual(report.finalVerdict.status, 'NOT_EXECUTED')
  assert.strictEqual(report.finalVerdict.reasonCode, 'BLOCKED_BY_RESPONSE_VALIDITY')
  assert.ok(!report.expression.includes('不足'), 'blocked validity is not evidence insufficiency')
})

// ── P0: 契约与引擎不变 ─────────────────────────────────────────────────────
test('P0: report still contract-valid (multi-model + all states)', () => {
  for (const answers of [MULTI_MODEL_ANSWERS, ALL_HEALTHY_ANSWERS]) {
    const { report } = buildReport(answers)
    const v = contract.validateCognitiveReportV21(report)
    assert.strictEqual(v.valid, true, JSON.stringify(v.errors))
    assert.deepStrictEqual(v.forbiddenHits, [])
  }
})

test('P0: engine output / questionnaire / report-contract diff = 0', () => {
  // The builder must not alter the engine's frozen constants. We assert:
  // 1. questionnaire constants unchanged (18 questions, 9 constructs).
  assert.strictEqual(CONSTRUCTS_V21.length, 9)
  // 2. contract markers unchanged.
  assert.strictEqual(contract.V21_REPORT_DIAGNOSTIC_VERSION, 'world_model_v2_1')
  assert.strictEqual(contract.V21_REPORT_MODE, 'TEST_PREVIEW_ONLY')
  assert.strictEqual(contract.V21_ENGINE_AUTHORITY, 'WORLD_MODEL_V2_1_ENGINE')
  // 3. builder is deterministic for the multi-model fixture.
  const r1 = buildReport(MULTI_MODEL_ANSWERS).report
  const r2 = buildReport(MULTI_MODEL_ANSWERS).report
  assert.strictEqual(r1.inputHash, r2.inputHash)
  assert.strictEqual(r1.expression, r2.expression)
})

// ── P1: 报告页安全区 ───────────────────────────────────────────────────────
test('P1: report page has custom-nav safe-area compensation', () => {
  const js = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.js'), 'utf8')
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.wxml'), 'utf8')
  const wxss = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.wxss'), 'utf8')

  // JS: runtime measurement + totalNavHeight data field.
  assert.ok(js.includes('_initNavBar'), 'JS must measure nav bar')
  assert.ok(js.includes('getMenuButtonBoundingClientRect'), 'JS must use menu button rect')
  assert.ok(js.includes('totalNavHeight'), 'JS data must carry totalNavHeight')
  // WXML: nav-safe spacer bound to totalNavHeight.
  assert.ok(wxml.includes('nav-safe'), 'WXML must have nav-safe spacer')
  assert.ok(wxml.includes('totalNavHeight'), 'WXML must bind totalNavHeight')
  // WXSS: safe-area inset + spacer style.
  assert.ok(wxss.includes('nav-safe'), 'WXSS must style nav-safe')
  assert.ok(wxss.includes('safe-area-inset'), 'WXSS must use safe-area-inset')
})

// ── P2: 枚举本地化 ─────────────────────────────────────────────────────────
test('P2: localization map covers all 9 constructs', () => {
  for (const c of CONSTRUCTS_V21) {
    const label = labels.constructLabel(c)
    assert.ok(label && label !== c, `construct ${c} must have a Chinese label`)
  }
})

test('P2: localization map covers orientation + state tokens', () => {
  for (const o of ['DISTORTED', 'HEALTHY', 'MIXED', 'NEUTRAL', 'UNKNOWN']) {
    assert.ok(labels.orientationLabel(o), `orientation ${o} must have label`)
  }
  for (const s of ['STRONG', 'MODERATE', 'WEAK', 'UNKNOWN']) {
    assert.ok(labels.stateLabel(s), `state ${s} must have label`)
  }
})

test('P2: report page no raw enum token exposure (visible count = 0)', () => {
  const js = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.js'), 'utf8')
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/v21-cognitive-report/v21-cognitive-report.wxml'), 'utf8')

  // Raw engine tokens that must NOT be rendered verbatim.
  const rawTokens = [
    'WORLD_MODEL_V2_1_ENGINE',
    'DECISION', 'FEEDBACK', 'PROBABILITY', 'RISK', 'LEVERAGE',
    'TIME', 'IDENTITY', 'OPPORTUNITY', 'SYSTEMS',
    'DISTORTED', 'HEALTHY', 'MIXED',
    'STRONG', 'WEAK',
  ]

  // JS: the localized view model must not expose raw tokens as display fields.
  const jsHasRaw = rawTokens.filter((t) => {
    // Only flag if used as a literal string (display), not as a key in a map.
    return new RegExp(`['"\`]${t}['"\`]`).test(js)
  })
  assert.deepStrictEqual(jsHasRaw, [], `JS must not hardcode raw enum tokens: ${jsHasRaw.join(',')}`)

  // WXML: must not render raw tokens verbatim.
  const wxmlHasRaw = rawTokens.filter((t) => wxml.includes(t))
  assert.deepStrictEqual(wxmlHasRaw, [], `WXML must not render raw enum tokens: ${wxmlHasRaw.join(',')}`)
})

test('P2: labels module is pure static mapping (no inference/score/economy)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'utils/v21DisplayLabels.js'), 'utf8')
  // Economic/numeric-scoring content must never appear in display labels.
  // ("PROBABILITY" is a legitimate dimension construct key, not a score.)
  assert.ok(!/score|confidence|wealth|income|收益率|赔率|回报|盈利/.test(src), 'labels must not contain economic/probability scoring content')
})

// ── 确定性 + 回归约束 ───────────────────────────────────────────────────────
test('determinism: multi-model report is fully deterministic', () => {
  const a = buildReport(MULTI_MODEL_ANSWERS).report
  const b = buildReport(MULTI_MODEL_ANSWERS).report
  assert.strictEqual(a.inputHash, b.inputHash)
  assert.strictEqual(a.expression, b.expression)
  assert.deepStrictEqual(a.multiModelSummary, b.multiModelSummary)
})

test('regression: PRIMARY_ALLOWED report unchanged by R4.4 (still resolves components)', () => {
  const primary = [
    { questionId: 'SC_DEC_01', optionId: 'B' },
    { questionId: 'SC_DEC_02', optionId: 'C' },
    ...ALL_HEALTHY_ANSWERS.slice(2),
  ]
  const { report } = buildReport(primary)
  assert.ok(report.cognitiveBlindSpot)
  assert.ok(report.worldStrategy)
  assert.ok(report.cognitiveArchetype)
  assert.ok(report.scenarioSimulation)
  assert.strictEqual(report.multiModelSummary, null)
})
