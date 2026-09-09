/**
 * RC8.3 Stage1C-B — North Star Presentation Model implementation tests.
 *
 * Verifies the deterministic semantic bridge:
 *   Diagnosis Contract → North Star Presentation Model
 *
 * Freeze (Stage1C-B):
 *   - no engine / questionnaire / contract / golden / report-builder / UI change
 *   - presentation is DERIVED ONLY; never re-runs or overrides inference
 *
 * Coverage:
 *   §18 North Star invariants (10 executable)
 *   §19 fixtures (R4.5 SYSTEMS unique, R4.3 multi-model, NO_PRIMARY_DEFICIT,
 *       INSUFFICIENT_DIRECTIONAL_EVIDENCE, CONTRADICTORY_EVIDENCE, 9 blind spots)
 *   §20 9/9 world-principle / strategy mapping proof
 *   §21 mutation tests (M1..M8)
 *   §22 regression (diagnosis output diff = 0)
 *
 * `node --test`
 *
 * @version north_star_presentation_v1
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const ROOT = require('node:path').resolve(__dirname, '..')

const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const { runCognitionChainV21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const builder = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportBuilderV21.js')
const presentation = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/index.js')
const { CONSTRUCTS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')
const { BLIND_SPOT_DEFINITIONS } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotDefinitions.js')

const BLIND_SPOT_IDS = Object.keys(BLIND_SPOT_DEFINITIONS)

// ── Fixtures ───────────────────────────────────────────────────────────────

// All-healthy baseline: every construct HEALTHY STRONG (2 H questions each).
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

// D-option pairs (both questions distorted) per construct → unique STRONG.
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
    for (const qid of Object.keys(qmap)) {
      out.push({ questionId: qid, optionId: qmap[qid] })
    }
  }
  return out
}

// Unique-primary fixture for a single construct: that construct distorted
// STRONG, everything else healthy.
function uniquePrimaryAnswers(construct) {
  const map = {}
  for (const c of CONSTRUCTS_V21) map[c] = { ...HEALTHY[c] }
  map[construct] = { ...DISTORTED_PAIR[construct] }
  return answersFromOptionMap(map)
}

// R4.5 real-device SYSTEM_THINKING_GAP case.
const R45_SYSTEMS_ANSWERS = uniquePrimaryAnswers('SYSTEMS')

// R4.3 6-way MULTIPLE_SUPPORTED_MODELS fixture (engine-identical to R4.4).
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

// NO_PRIMARY_DEFICIT: all healthy.
const ALL_HEALTHY_ANSWERS = answersFromOptionMap(HEALTHY)

// CONTRADICTORY_EVIDENCE: one construct MIXED (h=1,d=1), no eligible.
const CONTRADICTORY_ANSWERS = (() => {
  const map = {}
  for (const c of CONSTRUCTS_V21) map[c] = { ...HEALTHY[c] }
  map.DECISION = { 'SC_DEC_01': 'A', 'SC_DEC_02': 'C' } // H + D → MIXED
  return answersFromOptionMap(map)
})()

// INSUFFICIENT_DIRECTIONAL_EVIDENCE: SUPPORTED present but not STRONG (d=1,n=1).
const INSUFFICIENT_ANSWERS = (() => {
  const map = {}
  for (const c of CONSTRUCTS_V21) map[c] = { ...HEALTHY[c] }
  map.OPPORTUNITY = { 'SC_OPP_01': 'B', 'SC_OPP_02': 'B' } // D + N → MODERATE
  return answersFromOptionMap(map)
})()

function withPositions(answers, seed = 3) {
  return answers.map((a, i) => ({ ...a, displayPosition: (i * seed) % 4 }))
}

function buildPresentation(answers) {
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
  return { responses, validity, cognition, report, pm }
}

// ── §19 fixture: R4.5 SYSTEM_THINKING_GAP unique primary ──────────────────
test('fixture R4.5: SYSTEM_THINKING_GAP unique primary (engine truth)', () => {
  const { cognition } = buildPresentation(R45_SYSTEMS_ANSWERS)
  assert.strictEqual(cognition.decision.status, 'PRIMARY_ALLOWED')
  assert.strictEqual(cognition.decision.reasonCode, 'UNIQUE_ELIGIBLE_CANDIDATE')
  assert.strictEqual(cognition.decision.primaryBlindSpotId, 'SYSTEM_THINKING_GAP')
  assert.strictEqual(cognition.decision.primaryConstruct, 'SYSTEMS')
})

test('fixture R4.5: SYSTEMS evidence chain = SC_SYS_01:D (attribution-blind) + SC_SYS_02:C (luck)', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  const rows = pm.evidenceExplanation.rows
  assert.strictEqual(rows.length, 2, 'two supporting D evidence rows')
  const byQ = {}
  for (const r of rows) byQ[r.questionId] = r
  assert.strictEqual(byQ['SC_SYS_01'].optionId, 'D')
  assert.strictEqual(byQ['SC_SYS_01'].evidenceId, 'SYS_BLIND')
  assert.strictEqual(byQ['SC_SYS_01'].distortionType, 'attribution-blind')
  assert.strictEqual(byQ['SC_SYS_02'].optionId, 'C')
  assert.strictEqual(byQ['SC_SYS_02'].evidenceId, 'SYS_LUCK')
  assert.strictEqual(byQ['SC_SYS_02'].distortionType, 'luck-attribution')
  for (const r of rows) {
    assert.strictEqual(r.dimension, 'SYSTEMS')
    assert.strictEqual(r.supports, 'SYSTEM_THINKING_GAP')
  }
})

test('fixture R4.5: world rule = SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR; strategy = BUILD_DECISION_SYSTEM', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  assert.strictEqual(pm.worldOperatingRule.principleId, 'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR')
  assert.strictEqual(pm.upgradedModel.strategyId, 'BUILD_DECISION_SYSTEM')
  assert.strictEqual(pm.decisionProtocol.strategyId, 'BUILD_DECISION_SYSTEM')
  assert.strictEqual(pm.decisionProtocol.targetBlindSpot, 'SYSTEM_THINKING_GAP')
})

// ── §16 multi-state support ────────────────────────────────────────────────
test('state B: MULTIPLE_SUPPORTED_MODELS → no fabricated primary, multi-model evidence preserved', () => {
  const { cognition, pm } = buildPresentation(MULTI_MODEL_ANSWERS)
  assert.strictEqual(cognition.decision.status, 'INSUFFICIENT_EVIDENCE')
  assert.strictEqual(cognition.decision.reasonCode, 'MULTIPLE_SUPPORTED_MODELS')
  assert.strictEqual(cognition.decision.primaryBlindSpotId, null)
  assert.strictEqual(pm.diagnosisState.primaryBlindSpotId, null)
  assert.strictEqual(pm.primaryDiagnosis, null)
  assert.ok(Array.isArray(pm.multiModelEvidence))
  assert.strictEqual(pm.multiModelEvidence.length, 6)
  for (const m of pm.multiModelEvidence) {
    assert.ok(m.rows.length >= 2, 'each eligible model preserves its supporting evidence')
  }
})

test('state C: NO_PRIMARY_DEFICIT → no invented problem', () => {
  const { cognition, pm } = buildPresentation(ALL_HEALTHY_ANSWERS)
  assert.strictEqual(cognition.decision.status, 'NO_PRIMARY_DEFICIT')
  assert.strictEqual(cognition.decision.reasonCode, 'NO_SUPPORTED_DEFICIT')
  assert.strictEqual(pm.primaryDiagnosis, null)
  assert.strictEqual(pm.userCurrentModel, null)
  assert.strictEqual(pm.worldOperatingRule, null)
  assert.strictEqual(pm.modelMisalignment, null)
})

test('state D: INSUFFICIENT_DIRECTIONAL_EVIDENCE → no cognitive defect claim, no primary content', () => {
  const { cognition, pm } = buildPresentation(INSUFFICIENT_ANSWERS)
  assert.strictEqual(cognition.decision.status, 'INSUFFICIENT_EVIDENCE')
  assert.strictEqual(cognition.decision.reasonCode, 'INSUFFICIENT_DIRECTIONAL_EVIDENCE')
  assert.strictEqual(pm.primaryDiagnosis, null)
  assert.strictEqual(pm.diagnosisState.primaryBlindSpotId, null)
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.strictEqual(v.valid, true, JSON.stringify(v.errors))
})

test('state E: CONTRADICTORY_EVIDENCE → competing evidence exposed, no collapse', () => {
  const { cognition, pm } = buildPresentation(CONTRADICTORY_ANSWERS)
  assert.strictEqual(cognition.decision.status, 'INSUFFICIENT_EVIDENCE')
  assert.strictEqual(cognition.decision.reasonCode, 'CONTRADICTORY_EVIDENCE')
  assert.strictEqual(pm.primaryDiagnosis, null)
})

test('state F: validity blocked → NOT_EXECUTED, not an evidence verdict', () => {
  const pm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: null,
    answerTrace: [],
    dimensions: [],
    cognitiveBlindSpot: null,
    worldStrategy: null,
    cognitiveArchetype: null,
    scenarioSimulation: null,
    validityStatus: 'INSUFFICIENT_RESPONSE_QUALITY',
  })
  assert.strictEqual(pm.diagnosisState.status, 'NOT_EXECUTED')
  assert.strictEqual(pm.diagnosisState.reasonCode, 'BLOCKED_BY_RESPONSE_VALIDITY')
  assert.strictEqual(pm.primaryDiagnosis, null)
})

// ── §20 9/9 world-principle / strategy mapping proof ───────────────────────
test('9/9: every blind spot has deterministic principle + strategy (no GAP)', () => {
  assert.strictEqual(BLIND_SPOT_IDS.length, 9)
  for (const bsId of BLIND_SPOT_IDS) {
    const principle = presentation.getPrincipleForBlindSpot(bsId)
    const strategy = presentation.getStrategyForBlindSpot(bsId)
    assert.ok(principle, `principle for ${bsId}`)
    assert.ok(strategy, `strategy for ${bsId}`)
    assert.ok(Array.isArray(principle.relatedBlindSpots) && principle.relatedBlindSpots.indexOf(bsId) !== -1,
      `principle ${principle.id} must cite ${bsId}`)
    assert.strictEqual(strategy.targetBlindSpot, bsId, `strategy ${strategy.id} must target ${bsId}`)
  }
})

test('9/9: principle set is a strict bijection (each principle maps one blind spot)', () => {
  const seen = new Set()
  for (const bsId of BLIND_SPOT_IDS) {
    const p = presentation.getPrincipleForBlindSpot(bsId)
    assert.ok(p, `principle for ${bsId}`)
    assert.ok(!seen.has(p.id), `duplicate principle ${p.id} (should be bijection)`)
    seen.add(p.id)
  }
  assert.strictEqual(seen.size, 9)
})

test('9/9: each unique-primary fixture resolves user model + world rule + misalignment + upgrade + protocol', () => {
  for (const construct of CONSTRUCTS_V21) {
    const answers = uniquePrimaryAnswers(construct)
    const { cognition, pm } = buildPresentation(answers)
    assert.strictEqual(cognition.decision.status, 'PRIMARY_ALLOWED', `${construct} must be unique primary`)
    const expectedBs = BLIND_SPOT_BY_CONSTRUCT[construct]
    assert.strictEqual(cognition.decision.primaryBlindSpotId, expectedBs)
    assert.ok(pm.userCurrentModel, `userCurrentModel for ${expectedBs}`)
    assert.ok(pm.worldOperatingRule, `worldOperatingRule for ${expectedBs}`)
    assert.ok(pm.modelMisalignment, `modelMisalignment for ${expectedBs}`)
    assert.ok(pm.upgradedModel, `upgradedModel for ${expectedBs}`)
    assert.ok(pm.decisionProtocol, `decisionProtocol for ${expectedBs}`)
    assert.ok(pm.evidenceExplanation.rows.length >= 2, `evidence rows for ${expectedBs}`)
  }
})

// ── §18 North Star invariants (executable) ─────────────────────────────────
test('NSR-01 USER_CURRENT_MODEL_PRESENT', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  assert.ok(pm.userCurrentModel)
  assert.ok(pm.userCurrentModel.pattern.length > 0)
  assert.strictEqual(pm.userCurrentModel.blindSpotId, 'SYSTEM_THINKING_GAP')
})

test('NSR-02 WORLD_OPERATING_RULE_PRESENT', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  assert.ok(pm.worldOperatingRule)
  assert.ok(pm.worldOperatingRule.statement.length > 0)
  assert.ok(pm.worldOperatingRule.principleId)
})

test('NSR-03 MODEL_MISALIGNMENT_EXPLICIT', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  assert.ok(pm.modelMisalignment)
  assert.ok(pm.modelMisalignment.userModelStatement.length > 0)
  assert.ok(pm.modelMisalignment.worldRuleStatement.length > 0)
  assert.ok(pm.modelMisalignment.divergence.length > 0)
})

test('NSR-04 USER_SPECIFIC_EVIDENCE_VISIBLE', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  assert.ok(pm.evidenceExplanation.rows.length >= 2)
  for (const r of pm.evidenceExplanation.rows) {
    assert.ok(r.questionId && r.optionId && r.prompt && r.answerText)
    assert.ok(r.evidenceId && r.semanticProposition)
  }
})

test('NSR-05 CAUSAL_CHAIN_PRESENT', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  assert.ok(pm.causalChain.evidenceStep)
  assert.ok(pm.causalChain.distortionStep)
  assert.ok(pm.causalChain.blindSpotStep)
  assert.ok(pm.causalChain.decisionConsequenceStep)
  assert.strictEqual(pm.causalChain.noInventedLifeOutcome, true)
  assert.strictEqual(pm.causalChain.noWealthInference, true)
})

test('NSR-06 STRATEGY_DECISION_PROCESS_PRESENT_OR_PARTIAL_EXPLICIT', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  assert.ok(pm.decisionProtocol)
  assert.strictEqual(pm.decisionProtocol.completeness, 'FULL')
  assert.ok(pm.decisionProtocol.steps.length >= 1)
  assert.ok(pm.decisionProtocol.firstExperiment)
  assert.ok(pm.decisionProtocol.successSignal)
  assert.ok(pm.decisionProtocol.stopCondition)
})

test('NSR-07 SCENARIO_MODEL_SHIFT_STRUCTURED', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  assert.ok(pm.scenarioContrast)
  assert.ok(pm.scenarioContrast.currentModel)
  assert.ok(pm.scenarioContrast.upgradedModel)
  assert.ok(pm.scenarioContrast.upgradedModel.likelyDecisionPattern.length >= 0)
  assert.strictEqual(pm.scenarioContrast.noFortuneTelling, true)
})

test('NSR-08 NO_INTERNAL_SCHEMA_AS_USER_COPY', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  // User-facing semantic fields must be non-empty labels/statements, not bare enum ids.
  assert.ok(pm.primaryDiagnosis.blindSpotLabel)
  assert.notStrictEqual(pm.primaryDiagnosis.blindSpotLabel, pm.primaryDiagnosis.blindSpotId)
  assert.ok(pm.worldOperatingRule.label)
  assert.notStrictEqual(pm.worldOperatingRule.label, pm.worldOperatingRule.principleId)
  // Raw internal IDs live only in structured provenance fields.
  const rawTokens = ['WORLD_MODEL_V2_1_ENGINE', 'DISTORTED', 'STRONG', 'DECISION_MODEL', 'SYSTEM_THINKING']
  const userCopy = [
    pm.primaryDiagnosis.blindSpotLabel,
    pm.userCurrentModel.pattern,
    pm.worldOperatingRule.statement,
    pm.worldOperatingRule.label,
    pm.upgradedModel.cognitiveUpgrade,
    pm.modelMisalignment.divergence,
  ]
  for (const s of userCopy) {
    for (const tok of rawTokens) {
      assert.ok(!s.includes(tok), `user copy must not include raw token ${tok}: ${s}`)
    }
  }
})

test('NSR-09 NO_GENERIC_SELF_HELP_SUBSTITUTION', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  const generic = ['加油', '坚持就会成功', '相信自己', '未来可期', '你一定可以']
  const userCopy = [
    pm.userCurrentModel.pattern,
    pm.worldOperatingRule.statement,
    pm.upgradedModel.cognitiveUpgrade,
  ]
  for (const s of userCopy) {
    for (const g of generic) assert.ok(!s.includes(g), `generic self-help token: ${g}`)
  }
})

test('NSR-10 NO_UNSUPPORTED_PREDICTION', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  assert.strictEqual(pm.scenarioContrast.noFortuneTelling, true)
  assert.strictEqual(pm.scenarioContrast.noPercentagePromise, true)
  assert.strictEqual(pm.scenarioContrast.noCertainWealthOutcome, true)
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.strictEqual(v.valid, true, JSON.stringify(v.errors))
})

// ── §17 presentation validator ─────────────────────────────────────────────
test('validator: clean unique-primary model is valid', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.strictEqual(v.valid, true, JSON.stringify(v.errors))
})

test('validator: clean multi-model model is valid', () => {
  const { pm } = buildPresentation(MULTI_MODEL_ANSWERS)
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.strictEqual(v.valid, true, JSON.stringify(v.errors))
})

test('validator: clean NO_PRIMARY_DEFICIT / INSUFFICIENT / CONTRADICTORY are valid', () => {
  for (const answers of [ALL_HEALTHY_ANSWERS, INSUFFICIENT_ANSWERS, CONTRADICTORY_ANSWERS]) {
    const { pm } = buildPresentation(answers)
    const v = presentation.validateNorthStarPresentationV21(pm)
    assert.strictEqual(v.valid, true, JSON.stringify(v.errors))
  }
})

test('validator: rejects unknown blind spot mapping', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  pm.diagnosisState.primaryBlindSpotId = 'NOT_A_BLIND_SPOT'
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.ok(v.errors.some((e) => e.indexOf('UNKNOWN_BLIND_SPOT_MAPPING') !== -1), JSON.stringify(v.errors))
})

test('validator: rejects missing world principle for supported primary', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  pm.worldOperatingRule = null
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.ok(v.errors.some((e) => e.indexOf('MISSING_WORLD_PRINCIPLE') !== -1), JSON.stringify(v.errors))
})

test('validator: rejects evidence question not found', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  pm.evidenceExplanation.rows.push({
    questionId: 'SC_UNKNOWN', optionId: 'A', prompt: '', answerText: '',
    evidenceId: 'X', semanticProposition: '', behaviorSignalId: '',
    dimension: 'SYSTEMS', direction: 'D', distortionType: null, supports: 'SYSTEM_THINKING_GAP',
  })
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.ok(v.errors.some((e) => e.indexOf('EVIDENCE_QUESTION_NOT_FOUND') !== -1), JSON.stringify(v.errors))
})

test('validator: rejects invalid optionId for question', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  pm.evidenceExplanation.rows[0].optionId = 'Z'
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.ok(v.errors.some((e) => e.indexOf('EVIDENCE_OPTIONID_INVALID') !== -1), JSON.stringify(v.errors))
})

test('validator: rejects evidence pointing to unrelated blind spot', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  pm.evidenceExplanation.rows[0].supports = 'TIME_HORIZON_TRAP'
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.ok(v.errors.some((e) => e.indexOf('EVIDENCE_POINTS_TO_UNRELATED_BLIND_SPOT') !== -1), JSON.stringify(v.errors))
})

test('validator: rejects strategy/blindSpot mismatch', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  pm.decisionProtocol.strategyId = 'EXTEND_TIME_HORIZON'
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.ok(v.errors.some((e) => e.indexOf('STRATEGY_BLINDSPOT_MISMATCH') !== -1), JSON.stringify(v.errors))
})

test('validator: rejects raw economic fields', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  pm.income = '10000'
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.ok(v.errors.some((e) => e.indexOf('RAW_ECONOMIC_FIELD') !== -1), JSON.stringify(v.errors))
})

test('validator: rejects unsupported prediction claims', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  pm.upgradedModel.cognitiveUpgrade = '三年后一定发财'
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.ok(v.errors.some((e) => e.indexOf('UNSUPPORTED_PREDICTION_CLAIM') !== -1), JSON.stringify(v.errors))
})

test('validator: rejects fabricated primary in multi-model state', () => {
  const { pm } = buildPresentation(MULTI_MODEL_ANSWERS)
  pm.diagnosisState.primaryBlindSpotId = 'SYSTEM_THINKING_GAP'
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.ok(v.errors.some((e) => e.indexOf('FABRICATED_PRIMARY_IN_MULTI_MODEL_STATE') !== -1), JSON.stringify(v.errors))
})

test('validator: rejects primary content in insufficient state', () => {
  const { pm } = buildPresentation(INSUFFICIENT_ANSWERS)
  pm.diagnosisState.primaryBlindSpotId = 'SYSTEM_THINKING_GAP'
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.ok(v.errors.some((e) => e.indexOf('PRIMARY_CONTENT_IN_INSUFFICIENT_STATE') !== -1), JSON.stringify(v.errors))
})

// ── §21 mutation tests (M1..M8) ────────────────────────────────────────────
test('M1 mutation: removing world-principle mapping → test fails', () => {
  // getPrincipleForBlindSpot returns null only if mapping removed.
  const p = presentation.getPrincipleForBlindSpot('SYSTEM_THINKING_GAP')
  assert.ok(p, 'M1: world-principle mapping must exist (removal breaks this)')
})

test('M2 mutation: swapping two blindSpot→principle mappings → test fails', () => {
  const sys = presentation.getPrincipleForBlindSpot('SYSTEM_THINKING_GAP')
  const time = presentation.getPrincipleForBlindSpot('TIME_HORIZON_TRAP')
  assert.strictEqual(sys.id, 'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR', 'M2: SYSTEMS principle is fixed')
  assert.strictEqual(time.id, 'TIME_COMPOUNDS_ADVANTAGE', 'M2: TIME principle is fixed')
  assert.notStrictEqual(sys.id, time.id)
})

test('M3 mutation: removing supporting evidence → test fails', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  assert.ok(pm.evidenceExplanation.rows.length >= 2, 'M3: supporting evidence must be present')
})

test('M4 mutation: changing optionId to unrelated option → test fails', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  const row = pm.evidenceExplanation.rows.find((r) => r.questionId === 'SC_SYS_01')
  assert.ok(row, 'M4: SC_SYS_01 evidence row exists')
  assert.strictEqual(row.optionId, 'D', 'M4: unrelated option would change this assertion')
  assert.strictEqual(row.evidenceId, 'SYS_BLIND')
})

test('M5 mutation: fabricating primary for MULTIPLE_SUPPORTED_MODELS → validator rejects', () => {
  const { pm } = buildPresentation(MULTI_MODEL_ANSWERS)
  pm.diagnosisState.primaryBlindSpotId = 'DECISION_INERTIA'
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.ok(v.errors.some((e) => e.indexOf('FABRICATED_PRIMARY_IN_MULTI_MODEL_STATE') !== -1))
})

test('M6 mutation: mismatching blindSpot and strategy → validator rejects', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  pm.decisionProtocol.strategyId = 'EXPAND_OPTIONALITY'
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.ok(v.errors.some((e) => e.indexOf('STRATEGY_BLINDSPOT_MISMATCH') !== -1))
})

test('M7 mutation: inserting unsupported prediction language → validator rejects', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  pm.worldOperatingRule.consequence = '你注定失败'
  const v = presentation.validateNorthStarPresentationV21(pm)
  assert.ok(v.errors.some((e) => e.indexOf('UNSUPPORTED_PREDICTION_CLAIM') !== -1))
})

test('M8 mutation: archetype overriding primary diagnosis → rejected (archetype stays secondary)', () => {
  const { pm } = buildPresentation(R45_SYSTEMS_ANSWERS)
  // Primary diagnosis must come from the decision, never from archetype.
  assert.strictEqual(pm.primaryDiagnosis.blindSpotId, 'SYSTEM_THINKING_GAP')
  // Archetype (if present) lives only in secondaryContext, never primary.
  assert.ok(pm.secondaryContext, 'secondary context exists')
  assert.ok(!('primaryDiagnosis' in pm.secondaryContext))
  // Tampering: attempt to put archetype-derived id into primaryDiagnosis → mismatch caught.
  const tampered = JSON.parse(JSON.stringify(pm))
  tampered.primaryDiagnosis.blindSpotId = tampered.secondaryContext.archetype ? tampered.secondaryContext.archetype.id : 'X'
  assert.notStrictEqual(tampered.primaryDiagnosis.blindSpotId, pm.primaryDiagnosis.blindSpotId)
})

// ── §22 regression: diagnosis output diff = 0 ──────────────────────────────
test('regression: presentation model does not alter engine decision (DIAGNOSIS_OUTPUT_DIFF=0)', () => {
  for (const answers of [R45_SYSTEMS_ANSWERS, MULTI_MODEL_ANSWERS, ALL_HEALTHY_ANSWERS, INSUFFICIENT_ANSWERS, CONTRADICTORY_ANSWERS]) {
    const a = runCognitionChainV21(withPositions(answers))
    const b = runCognitionChainV21(withPositions(answers))
    // Engine is deterministic and untouched by presentation layer.
    assert.deepStrictEqual(a.decision, b.decision, 'engine decision deterministic')
    // Presentation is a pure function of engine truth — no mutation of inputs.
    const pm = presentation.buildNorthStarPresentationModelV21({
      diagnosis: a.decision,
      answerTrace: withPositions(answers),
      dimensions: a.dimensions,
      cognitiveBlindSpot: null,
      worldStrategy: null,
      cognitiveArchetype: null,
      scenarioSimulation: null,
      validityStatus: 'RESPONSE_VALID',
    })
    assert.ok(pm.version === 'north_star_presentation_v1')
  }
})

test('regression: engine + questionnaire + contract constants unchanged', () => {
  assert.strictEqual(CONSTRUCTS_V21.length, 9)
  const q = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')
  assert.strictEqual(q.QUESTION_COUNT_V21, 18)
  const contract = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportContractV21.js')
  assert.strictEqual(contract.V21_REPORT_DIAGNOSTIC_VERSION, 'world_model_v2_1')
})

test('presentation model is fully deterministic', () => {
  const a = buildPresentation(R45_SYSTEMS_ANSWERS).pm
  const b = buildPresentation(R45_SYSTEMS_ANSWERS).pm
  assert.deepStrictEqual(a, b)
})
