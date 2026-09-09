/**
 * RC8.3 Stage1B R3 — V2.1 Cognitive Report Contract + Builder Acceptance Tests
 *
 * Locks the NEW V2.1 cognitive-report path (TEST_PREVIEW_ONLY):
 *   - frozen report-level markers (reportType / diagnosticVersion / mode /
 *     engineAuthority) — mode is a REPORT marker, never a parser token;
 *   - V21_ALLOWED_MODES stays exactly ['OFF','SHADOW'] (no TEST_PREVIEW_ONLY);
 *   - contract is SEPARATE from V4 (must NOT reuse REQUIRED_V4_KEYS);
 *   - deterministic builder produces a contract-valid report for a
 *     PRIMARY_ALLOWED cognition chain (blindSpot / strategy / archetype /
 *     scenario all resolved);
 *   - NO_PRIMARY_DEFICIT and blocked-validity still produce contract-valid
 *     reports with null cognitive components (valid diagnostic outcomes);
 *   - no economic/financial fields anywhere (forbiddenHits empty);
 *   - determinism (same input → same inputHash + same expression);
 *   - displayPosition is trace-identity ONLY, never feeds cognition.
 *
 * Uses `node --test`.
 *
 * @version world_model_v2_1
 */

const test = require('node:test')
const assert = require('node:assert')

const contract = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportContractV21.js')
const builder = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportBuilderV21.js')
const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const { runCognitionChainV21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const { CONSTRUCTS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')
const mode = require('../cloudfunctions/generateAiReport/lib/config/worldModelV21Mode.js')
const { REQUIRED_V4_KEYS } = require('../cloudfunctions/generateAiReport/lib/v4/diagnosticPipelineV4.js')

// ── 夹具：稳定触发 PRIMARY_ALLOWED (DECISION_INERTIA) 的 18 答案 ──────────
// DECISION 两题选 D 证据（SC_DEC_01=B, SC_DEC_02=C），其余 16 题选健康/中性组合。
const PRIMARY_ALLOWED_ANSWERS = [
  { questionId: 'SC_DEC_01', optionId: 'B' },
  { questionId: 'SC_DEC_02', optionId: 'C' },
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

// 全部健康 → NO_PRIMARY_DEFICIT
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

// 附加 displayPosition（R3C：渲染位置，仅响应有效性用，不进认知）
function withPositions(answers, seed) {
  return answers.map((a, i) => ({
    questionId: a.questionId,
    optionId: a.optionId,
    displayPosition: (i * seed) % 4,
  }))
}

test('contract: frozen report-level markers', () => {
  assert.strictEqual(contract.V21_REPORT_TYPE, 'diagnostic_v2_1')
  assert.strictEqual(contract.V21_REPORT_DIAGNOSTIC_VERSION, 'world_model_v2_1')
  assert.strictEqual(contract.V21_REPORT_MODE, 'TEST_PREVIEW_ONLY')
  assert.strictEqual(contract.V21_ENGINE_AUTHORITY, 'WORLD_MODEL_V2_1_ENGINE')
})

test('contract: TEST_PREVIEW_ONLY is report-level, NOT in the mode parser', () => {
  assert.deepStrictEqual(mode.V21_ALLOWED_MODES, ['OFF', 'SHADOW'])
  assert.ok(!mode.V21_ALLOWED_MODES.includes('TEST_PREVIEW_ONLY'))
  assert.ok(!mode.V21_ALLOWED_MODES.includes('TEST_PREVIEW'))
})

test('contract: separate from V4 (does not reuse REQUIRED_V4_KEYS)', () => {
  // V4 economic/demographic keys must not appear as required V2.1 components.
  const required = contract.V21_REPORT_CONTRACT.required
  for (const key of REQUIRED_V4_KEYS) {
    assert.ok(!required.includes(key), `V2.1 required must not include V4 key: ${key}`)
  }
  // V2.1 required components are cognitive, not economic.
  for (const key of ['worldModel', 'cognitiveArchetype', 'cognitiveBlindSpot', 'worldStrategy', 'scenarioSimulation', 'trace', 'finalVerdict']) {
    assert.ok(required.includes(key), `V2.1 required must include: ${key}`)
  }
})

test('builder: PRIMARY_ALLOWED → full valid report', () => {
  const responses = withPositions(PRIMARY_ALLOWED_ANSWERS, 3)
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)

  assert.strictEqual(validity.status, 'RESPONSE_VALID')
  assert.strictEqual(cognition.decision.status, 'PRIMARY_ALLOWED')

  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })
  const v = contract.validateCognitiveReportV21(report)

  assert.strictEqual(v.valid, true, JSON.stringify(v.errors))
  assert.deepStrictEqual(v.forbiddenHits, [])

  assert.strictEqual(report.reportType, 'diagnostic_v2_1')
  assert.strictEqual(report.diagnosticVersion, 'world_model_v2_1')
  assert.strictEqual(report.mode, 'TEST_PREVIEW_ONLY')
  assert.strictEqual(report.engineAuthority, 'WORLD_MODEL_V2_1_ENGINE')
  assert.strictEqual(report.deterministic, true)
  assert.strictEqual(report.aiExpressionOnly, true)
  assert.strictEqual(report.expressionSource, 'deterministic')

  // 9 dimensions, all frozen constructs present.
  assert.strictEqual(report.worldModel.dimensions.length, 9)
  const constructs = report.worldModel.dimensions.map((d) => d.construct)
  for (const c of CONSTRUCTS_V21) assert.ok(constructs.includes(c))

  // blindSpot / strategy / archetype / scenario all resolved.
  assert.ok(report.cognitiveBlindSpot, 'blindSpot should be resolved')
  assert.ok(report.worldStrategy, 'strategy should be resolved')
  assert.ok(report.cognitiveArchetype, 'archetype should be resolved')
  assert.ok(report.scenarioSimulation, 'scenario should be resolved')

  assert.strictEqual(report.cognitiveBlindSpot.id, cognition.decision.primaryBlindSpotId)
  assert.strictEqual(report.finalVerdict.status, 'PRIMARY_ALLOWED')
  assert.strictEqual(report.finalVerdict.primaryBlindSpotId, cognition.decision.primaryBlindSpotId)
  assert.ok(report.expression.length > 0)
})

test('builder: NO_PRIMARY_DEFICIT → valid report with null cognitive components', () => {
  const responses = withPositions(ALL_HEALTHY_ANSWERS, 3)
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)

  assert.strictEqual(cognition.decision.status, 'NO_PRIMARY_DEFICIT')

  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })
  const v = contract.validateCognitiveReportV21(report)

  assert.strictEqual(v.valid, true, JSON.stringify(v.errors))
  assert.strictEqual(report.cognitiveBlindSpot, null)
  assert.strictEqual(report.worldStrategy, null)
  assert.strictEqual(report.cognitiveArchetype, null)
  assert.strictEqual(report.scenarioSimulation, null)
  assert.strictEqual(report.finalVerdict.status, 'NO_PRIMARY_DEFICIT')
  assert.ok(report.expression.length > 0)
  // worldModel still fully present (9 dims).
  assert.strictEqual(report.worldModel.dimensions.length, 9)
})

test('builder: blocked validity → valid report, verdict NOT_EXECUTED', () => {
  // all displayPosition = 0 → RESPONSE_QUALITY_LOW (blocked cognition).
  const responses = ALL_HEALTHY_ANSWERS.map((a) => ({ ...a, displayPosition: 0 }))
  const validity = responseValidity.assessResponseValidityV21(responses)

  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition: null })
  const v = contract.validateCognitiveReportV21(report)

  assert.strictEqual(v.valid, true, JSON.stringify(v.errors))
  assert.strictEqual(report.cognitiveBlindSpot, null)
  assert.strictEqual(report.finalVerdict.status, 'NOT_EXECUTED')
  assert.strictEqual(report.finalVerdict.reasonCode, 'BLOCKED_BY_RESPONSE_VALIDITY')
  assert.ok(report.expression.length > 0)
})

test('builder: deterministic — same input → same hash + expression', () => {
  const responses = withPositions(PRIMARY_ALLOWED_ANSWERS, 3)
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)

  const r1 = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })
  const r2 = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })

  assert.strictEqual(r1.inputHash, r2.inputHash)
  assert.strictEqual(r1.expression, r2.expression)
  assert.strictEqual(r1.cognitiveBlindSpot.id, r2.cognitiveBlindSpot.id)
  assert.strictEqual(r1.worldStrategy.id, r2.worldStrategy.id)
})

test('builder: displayPosition is trace-identity only, never feeds cognition', () => {
  // Same questionId+optionId, different displayPosition → identical cognition,
  // different trace answerTrace (position preserved verbatim).
  const a1 = withPositions(PRIMARY_ALLOWED_ANSWERS, 1)
  const a2 = withPositions(PRIMARY_ALLOWED_ANSWERS, 3)

  const c1 = runCognitionChainV21(a1)
  const c2 = runCognitionChainV21(a2)

  // Cognition (blindspot/decision) must be position-independent.
  assert.strictEqual(c1.decision.primaryBlindSpotId, c2.decision.primaryBlindSpotId)
  assert.strictEqual(c1.decision.status, c2.decision.status)

  const r1 = builder.runCognitiveReportBuilderV21({ responses: a1, validityResult: responseValidity.assessResponseValidityV21(a1), cognition: c1 })
  const r2 = builder.runCognitiveReportBuilderV21({ responses: a2, validityResult: responseValidity.assessResponseValidityV21(a2), cognition: c2 })

  // Trace preserves the position verbatim.
  assert.notDeepStrictEqual(r1.trace.answerTrace, r2.trace.answerTrace)
  // But the cognitive diagnosis is identical.
  assert.strictEqual(r1.cognitiveBlindSpot.id, r2.cognitiveBlindSpot.id)
})

test('builder: no economic/financial fields in any scanned component', () => {
  const responses = withPositions(PRIMARY_ALLOWED_ANSWERS, 3)
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)
  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })
  const v = contract.validateCognitiveReportV21(report)

  assert.deepStrictEqual(v.forbiddenHits, [])
})
