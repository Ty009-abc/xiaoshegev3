/**
 * engine/worldModel/v2_1/cognitiveReportBuilderV21.js
 *
 * World Model v2.1 — Cognitive Report Builder (Stage1B R3).
 *
 * Builds the NEW V2.1 cognitive report from the canonical V2.1 engine outputs:
 *   worldModel (9 dimensions) + cognitiveArchetype + cognitiveBlindSpot +
 *   worldStrategy + scenarioSimulation + trace (+ finalVerdict).
 *
 * AUTHORITY BOUNDARY (frozen):
 *   - Engine diagnosis (evidence / signals / dimensions / candidates / primary
 *     decision) is AUTHORITATIVE. This builder NEVER mutates it.
 *   - AI is EXPRESSION ONLY: AI may enrich the `expression` string but MUST NOT
 *     change archetype / blind spot / strategy / scenario / evidence / verdict.
 *   - Deterministic fallback: this builder ALWAYS produces a valid report with
 *     a deterministic `expression`. AI enrichment (done by the caller) only
 *     replaces `expression` on success.
 *   - No fabricated economic/financial evidence. No income / salary / occupation
 *     / debt / wealth-stage / economic-probability / financial prediction.
 *   - No numeric confidence / severity / probability. Categorical state only.
 *   - No fortune telling. All consequences use conditional language.
 *
 * Reused deterministic modules (allowed by the V2.1 reuse strategy):
 *   - strategy:  v2/strategyEngineV2.selectStrategyV2 (1:1 blindspot→strategy)
 *   - scenario:  ../scenarioSimulationEngineV2.simulateScenarios (conditional)
 *   - vocab:     ../archetypeDefinitions, ../blindSpotDefinitions
 *
 * @version world_model_v2_1
 */

const {
  V21_REPORT_TYPE,
  V21_REPORT_DIAGNOSTIC_VERSION,
  V21_REPORT_MODE,
  V21_ENGINE_AUTHORITY,
  V21_REPORT_ACCESS_TIER,
  CONSTRUCT_TO_MODEL_DIM_V21,
  BLIND_SPOT_TO_ARCHETYPE_V21,
} = require('./cognitiveReportContractV21')

const { CONSTRUCTS_V21 } = require('./questionnaireV21')
const { selectStrategyV2 } = require('../v2/strategyEngineV2')
const { simulateScenarios } = require('../scenarioSimulationEngineV2')
const { ARCHETYPE_DEFINITIONS } = require('../archetypeDefinitions')
const { BLIND_SPOT_DEFINITIONS } = require('../blindSpotDefinitions')

/**
 * Deterministic input hash over the exact 18-answer trace.
 * Canonicalizes by (questionId, optionId, displayPosition) so the hash is
 * order-invariant w.r.t. answer serialization. displayPosition is part of the
 * trace identity (R3C) but NEVER feeds cognition.
 */
function buildInputHashV21(responses) {
  const arr = Array.isArray(responses) ? responses.slice() : []
  arr.sort((a, b) => {
    const ka = `${a && a.questionId || ''}\u0000${a && a.optionId || ''}\u0000${a && a.displayPosition === undefined ? '' : a.displayPosition}`
    const kb = `${b && b.questionId || ''}\u0000${b && b.optionId || ''}\u0000${b && b.displayPosition === undefined ? '' : b.displayPosition}`
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
  const str = arr.map((r) => {
    if (!r || typeof r !== 'object') return ''
    return `${r.questionId}:${r.optionId}:${r.displayPosition === undefined ? '' : r.displayPosition}`
  }).join('|')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return 'v21_' + Math.abs(hash).toString(16)
}

/**
 * Verbatim 18-answer trace (schema-v2). Never derives displayPosition from
 * optionId; copies exactly what was submitted. Never mutates input.
 */
function buildAnswerTraceV21Report(responses) {
  if (!Array.isArray(responses)) return []
  return responses.map((r) => {
    if (r && typeof r === 'object') {
      return {
        questionId: r.questionId,
        optionId: r.optionId,
        displayPosition: r.displayPosition,
      }
    }
    return null
  })
}

/**
 * Evidence-level provenance trace (5-field rows) from normalized evidence.
 */
function buildEvidenceTraceV21Report(evidence) {
  if (!Array.isArray(evidence)) return []
  return evidence.map((e) => ({
    evidenceId: e.evidenceId,
    direction: e.direction,
    distortionType: e.distortionType,
    matchedQuestionIds: e.matchedQuestionIds,
    matchedOptionIds: e.matchedOptionIds,
  }))
}

/**
 * Build the 9-dimension world model container. `dimensions` must be the
 * `computeDimensionsV21` output array (one entry per frozen construct).
 * Returns `{ dimensions, constructCount }`.
 */
function buildWorldModelV21(dimensions) {
  const dims = Array.isArray(dimensions) ? dimensions : []
  // Normalize to exactly the frozen construct set (CONSTRUCTS_V21 order),
  // passing through engine fields verbatim — never recomputed, never guessed.
  const ordered = CONSTRUCTS_V21.map((construct) => {
    const d = dims.find((x) => x && x.construct === construct)
    return d || {
      construct,
      orientation: 'UNKNOWN',
      state: 'UNKNOWN',
      hSupport: 0,
      dSupport: 0,
      nSupport: 0,
    }
  })
  return { dimensions: ordered, constructCount: ordered.length }
}

/**
 * Build the primary cognitive blind spot object from the A5A decision and the
 * dimension container. Descriptive fields come from the frozen blindspot
 * vocabulary; categorical state only (NO numeric confidence / severity).
 * Returns null when the decision does not yield a primary blind spot.
 */
function buildCognitiveBlindSpotV21(decision, dimensions) {
  const primaryId = decision && decision.primaryBlindSpotId
  if (!primaryId) return null

  const def = BLIND_SPOT_DEFINITIONS[primaryId] || {}
  const construct = decision.primaryConstruct || null
  const dim = (Array.isArray(dimensions)
    ? dimensions.find((d) => d && d.construct === construct)
    : null) || {}

  return {
    id: primaryId,
    label: def.label || primaryId,
    mechanism: def.mechanism || '',
    questionAnswered: def.questionAnswered || '',
    construct,
    dimensionOrientation: dim.orientation || 'UNKNOWN',
    dimensionState: dim.state || 'UNKNOWN',
    supportingEvidenceIds: Array.isArray(dim.distortedEvidenceIds) ? dim.distortedEvidenceIds : [],
    counterEvidenceIds: Array.isArray(dim.healthyEvidenceIds) ? dim.healthyEvidenceIds : [],
    distortionTypes: Array.isArray(dim.distortionTypes) ? dim.distortionTypes : [],
  }
}

/**
 * Build the world strategy via the frozen 1:1 blindspot→strategy map.
 * Returns null when there is no primary blind spot.
 */
function buildWorldStrategyV21(blindSpot) {
  if (!blindSpot || !blindSpot.id) return null
  return selectStrategyV2(blindSpot.id)
}

/**
 * Build the descriptive-only cognitive archetype from the frozen
 * blindSpot→archetype map. Descriptive only: NEVER feeds back into inference,
 * NEVER overrides the engine, carries no economic meaning.
 */
function buildCognitiveArchetypeV21(blindSpot) {
  if (!blindSpot || !blindSpot.id) return null
  const archetypeId = BLIND_SPOT_TO_ARCHETYPE_V21[blindSpot.id]
  if (!archetypeId) return null
  const def = ARCHETYPE_DEFINITIONS[archetypeId]
  if (!def) return null
  return {
    id: archetypeId,
    label: def.label || archetypeId,
    description: def.description || '',
    primaryTraits: (def.cognitiveTraits || []).slice(0, 3),
    mode: 'DESCRIPTIVE_ONLY',
    sourceBlindSpot: blindSpot.id,
  }
}

/**
 * Build the scenario simulation. Conditional language, no predictions.
 * Returns null when there is no primary blind spot / strategy.
 */
function buildScenarioSimulationV21(blindSpot, strategy, dimensions) {
  if (!blindSpot || !blindSpot.id || !strategy) return null

  // scenario engine reads worldModel[primaryDim] and the frozen patterns.
  // Map the V2.1 dimension array onto the scenario engine's model-dim keys.
  const worldModelKeyed = {}
  const dims = Array.isArray(dimensions) ? dimensions : []
  for (const d of dims) {
    if (!d || typeof d.construct !== 'string') continue
    const key = CONSTRUCT_TO_MODEL_DIM_V21[d.construct]
    if (key) worldModelKeyed[key] = d
  }

  return simulateScenarios(blindSpot, strategy, worldModelKeyed)
}

/**
 * Build the final verdict. Categorical, no numeric confidence.
 */
function buildFinalVerdictV21(decision, blindSpot, validityStatus) {
  const status = decision && decision.status ? decision.status : 'NOT_EXECUTED'
  return {
    status,
    authority: V21_ENGINE_AUTHORITY,
    aiExpressionOnly: true,
    primaryBlindSpotId: blindSpot ? blindSpot.id : null,
    primaryConstruct: decision && decision.primaryConstruct ? decision.primaryConstruct : null,
    reasonCode: decision && decision.reasonCode ? decision.reasonCode : (validityStatus ? 'BLOCKED_BY_RESPONSE_VALIDITY' : 'NOT_EXECUTED'),
    followUpRequired: !!(decision && decision.status === 'FOLLOW_UP_REQUIRED'),
    followUpPair: decision && decision.followupPair ? decision.followupPair : null,
  }
}

/**
 * Deterministic fallback expression. Conditional language only — no income,
 * no probability, no fate/destiny, no guaranteed outcome.
 */
function buildDeterministicExpressionV21(blindSpot, strategy, verdict) {
  const status = verdict ? verdict.status : 'NOT_EXECUTED'

  if (!blindSpot) {
    if (status === 'NO_PRIMARY_DEFICIT') {
      return '当前证据未发现明确的主要认知盲区。你在被测量的认知维度上没有出现一致性的扭曲模式。这描述的是当前回答所反映的认知结构，不是对你未来结果的判断。'
    }
    return '当前回答不足以形成可靠的认知诊断，系统未识别出明确的主要认知盲区。建议在稳定状态下重新完成 18 题问卷，以获得更充分的证据。'
  }

  const strategyLabel = strategy ? strategy.label : '（暂无对应策略）'
  const strategyMechanism = strategy && strategy.mechanism ? strategy.mechanism : ''

  return (
    '本次诊断识别出的主要认知盲区是「' + blindSpot.label + '」。' +
    '它描述的是：' + (blindSpot.questionAnswered || blindSpot.mechanism || '一个当前认知结构中难以被自己察觉的结构性缺口') + '。' +
    '对应的认知升级策略是「' + strategyLabel + '」' +
    (strategyMechanism ? '：' + strategyMechanism : '') + '。' +
    '需要说明的是：这描述的是你当前的认知结构，而不是对你未来结果的预测。' +
    '认知升级能否带来改变，取决于执行的一致性、外部反馈和外部环境；' +
    '它不会保证任何特定结果，但会改变你在面对同类情境时可用的决策选项。'
  )
}

/**
 * Run the full V2.1 cognitive report build (deterministic, pure).
 *
 * @param {object} params
 * @param {Array}  params.responses      raw { questionId, optionId, displayPosition } entries
 * @param {object} params.validityResult responseValidity.assessResponseValidityV21 output (or null)
 * @param {object} params.cognition      { decision, dimensions, signals, evidence } from the
 *                                       canonical V2.1 cognition chain (or null when blocked)
 * @returns {object} the V2.1 cognitive report (mode = TEST_PREVIEW_ONLY)
 */
function runCognitiveReportBuilderV21({ responses, validityResult, cognition }) {
  const validityStatus = validityResult ? validityResult.status : null
  const validityReasons = validityResult && Array.isArray(validityResult.reasons)
    ? validityResult.reasons
    : []

  const decision = cognition && cognition.decision ? cognition.decision : null
  const dimensions = cognition && cognition.dimensions ? cognition.dimensions : []
  const signals = cognition && cognition.signals ? cognition.signals : []
  const evidence = cognition && cognition.evidence ? cognition.evidence : []

  const worldModel = buildWorldModelV21(dimensions)
  const blindSpot = buildCognitiveBlindSpotV21(decision, worldModel.dimensions)
  const strategy = buildWorldStrategyV21(blindSpot)
  const archetype = buildCognitiveArchetypeV21(blindSpot)
  const scenarioSimulation = buildScenarioSimulationV21(blindSpot, strategy, worldModel.dimensions)
  const finalVerdict = buildFinalVerdictV21(decision, blindSpot, validityStatus)
  const expression = buildDeterministicExpressionV21(blindSpot, strategy, finalVerdict)

  const trace = {
    answerTrace: buildAnswerTraceV21Report(responses),
    evidenceTrace: buildEvidenceTraceV21Report(evidence),
    signalTrace: signals.map((s) => ({
      signalId: s.signalId,
      direction: s.direction,
      distortionType: s.distortionType,
      evidenceCount: s.evidenceCount,
    })),
    validity: {
      status: validityStatus,
      reasons: validityReasons,
    },
    decisionTrace: decision && decision.trace ? decision.trace : null,
    provenance: {
      chain: [
        'answers',
        'responseValidity',
        'evidence',
        'signals',
        'dimensions',
        'blindSpotCandidates',
        'primaryDecision',
        'strategy',
        'scenarioSimulation',
        'archetype',
        'expression',
      ],
      deterministic: true,
      engineAuthority: V21_ENGINE_AUTHORITY,
    },
  }

  return {
    version: V21_REPORT_DIAGNOSTIC_VERSION,
    reportType: V21_REPORT_TYPE,
    diagnosticVersion: V21_REPORT_DIAGNOSTIC_VERSION,
    mode: V21_REPORT_MODE,
    engineAuthority: V21_ENGINE_AUTHORITY,
    accessTier: V21_REPORT_ACCESS_TIER,
    inputHash: buildInputHashV21(responses),
    deterministic: true,
    aiExpressionOnly: true,
    expressionSource: 'deterministic',
    worldModel,
    cognitiveArchetype: archetype,
    cognitiveBlindSpot: blindSpot,
    worldStrategy: strategy,
    scenarioSimulation,
    trace,
    finalVerdict,
    expression,
  }
}

module.exports = {
  buildInputHashV21,
  buildAnswerTraceV21Report,
  buildEvidenceTraceV21Report,
  buildWorldModelV21,
  buildCognitiveBlindSpotV21,
  buildWorldStrategyV21,
  buildCognitiveArchetypeV21,
  buildScenarioSimulationV21,
  buildFinalVerdictV21,
  buildDeterministicExpressionV21,
  runCognitiveReportBuilderV21,
}
