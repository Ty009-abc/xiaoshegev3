/**
 * presentation/worldModel/v2_1/northStarPresentationValidatorV21.js
 *
 * RC8.3 Stage1C-B — Deterministic presentation validator.
 *
 * Validates the North Star presentation model against frozen authority. It
 * MUST NOT re-run or override inference. It is a gate over the DERIVED
 * presentation object only.
 *
 * Rejects (frozen):
 *   - unknown blind spot mapping
 *   - missing world principle for a supported primary
 *   - evidence question not found
 *   - optionId not valid for question
 *   - evidence pointing to unrelated blind spot
 *   - strategy/blindSpot mismatch
 *   - raw economic fields
 *   - unsupported prediction claims (fixed-copy scan)
 *   - fabricated primary in multi-model state
 *   - primary content in insufficient state
 *
 * @version north_star_presentation_v1
 */

'use strict'

const { QUESTIONS_V21, CONSTRUCTS_V21 } = require('../../../engine/worldModel/v2_1/questionnaireV21')
const { BLIND_SPOT_DEFINITIONS } = require('../../../engine/worldModel/blindSpotDefinitions')
const { BLIND_SPOT_TO_STRATEGY_V2 } = require('../../../engine/worldModel/v2/strategyEngineV2')

const QUESTION_BY_ID = new Map(QUESTIONS_V21.map((q) => [q.questionId, q]))
const VALID_BLIND_SPOT_IDS = new Set(Object.keys(BLIND_SPOT_DEFINITIONS))
const VALID_CONSTRUCTS = new Set(CONSTRUCTS_V21)

// Forbidden economic / V4 fields that must never appear in the presentation model.
const FORBIDDEN_FIELDS = [
  'income', 'salary', 'occupation', 'monthlySurplus', 'debt', 'wealthStage',
  'wealthProbability', 'potentialIndex', 'economicProbability', 'incomeStructure',
  'lifeStage', 'occupationDetail', 'safetyMonths', 'debtPressure',
]

// Fixed-copy prediction-language tokens that must never appear (deterministic scan).
const PREDICTION_TOKENS = [
  '一定发财', '必然失败', '注定', '命中注定', '三年后一定',
  '成功率达到', '保证赚', '保证收益', '肯定能成', '稳赚',
]

/**
 * Deep-collect all string values in an object tree (deterministic, cycle-safe
 * via a depth cap). Used to scan for forbidden fields / prediction language.
 */
function collectStrings(obj, depth) {
  const out = []
  const d = depth == null ? 6 : depth
  const seen = new Set()
  const walk = (node, level) => {
    if (node == null || level > d) return
    if (seen.has(node)) return
    seen.add(node)
    if (typeof node === 'string') {
      out.push(node)
    } else if (Array.isArray(node)) {
      for (const x of node) walk(x, level + 1)
    } else if (typeof node === 'object') {
      for (const k of Object.keys(node)) walk(node[k], level + 1)
    }
  }
  walk(obj, 0)
  return out
}

/**
 * Validate the presentation model.
 *
 * @param {object} pm  northStarPresentationModelV21.buildNorthStarPresentationModelV21 output
 * @returns {{valid:boolean, errors:string[]}}
 */
function validateNorthStarPresentationV21(pm) {
  const errors = []
  if (!pm || typeof pm !== 'object') {
    return { valid: false, errors: ['PRESENTATION_MODEL_NOT_OBJECT'] }
  }

  const state = pm.diagnosisState || {}
  const status = state.status
  const reasonCode = state.reasonCode
  const primaryBlindSpotId = state.primaryBlindSpotId

  // ── Raw economic fields ──────────────────────────────────────────────────
  for (const k of Object.keys(pm)) {
    if (FORBIDDEN_FIELDS.indexOf(k) !== -1) {
      errors.push('RAW_ECONOMIC_FIELD:' + k)
    }
  }

  // ── Unsupported prediction claims (fixed-copy scan) ─────────────────────
  const allStrings = collectStrings(pm)
  for (const s of allStrings) {
    for (const tok of PREDICTION_TOKENS) {
      if (s.indexOf(tok) !== -1) {
        errors.push('UNSUPPORTED_PREDICTION_CLAIM:' + tok)
      }
    }
  }

  // ── Primary content in insufficient state ────────────────────────────────
  if (status === 'INSUFFICIENT_EVIDENCE' && reasonCode === 'INSUFFICIENT_DIRECTIONAL_EVIDENCE') {
    if (primaryBlindSpotId) {
      errors.push('PRIMARY_CONTENT_IN_INSUFFICIENT_STATE')
    }
    if (pm.primaryDiagnosis) {
      errors.push('PRIMARY_DIAGNOSIS_IN_INSUFFICIENT_STATE')
    }
  }

  // ── Fabricated primary in multi-model state ──────────────────────────────
  if (reasonCode === 'MULTIPLE_SUPPORTED_MODELS') {
    if (primaryBlindSpotId) {
      errors.push('FABRICATED_PRIMARY_IN_MULTI_MODEL_STATE')
    }
    if (pm.primaryDiagnosis) {
      errors.push('FABRICATED_PRIMARY_DIAGNOSIS_IN_MULTI_MODEL_STATE')
    }
  }

  // ── Unique primary: world principle + mappings must resolve ──────────────
  if (primaryBlindSpotId) {
    if (!VALID_BLIND_SPOT_IDS.has(primaryBlindSpotId)) {
      errors.push('UNKNOWN_BLIND_SPOT_MAPPING:' + primaryBlindSpotId)
    }

    if (!pm.worldOperatingRule || !pm.worldOperatingRule.principleId) {
      errors.push('MISSING_WORLD_PRINCIPLE_FOR_SUPPORTED_PRIMARY:' + primaryBlindSpotId)
    }

    // strategy/blindSpot mismatch
    if (pm.decisionProtocol) {
      const strategyId = pm.decisionProtocol.strategyId
      const expectedStrategy = BLIND_SPOT_TO_STRATEGY_V2[primaryBlindSpotId]
      if (expectedStrategy && strategyId !== expectedStrategy) {
        errors.push('STRATEGY_BLINDSPOT_MISMATCH:' + strategyId + '!=' + expectedStrategy)
      }
    }
    if (pm.upgradedModel) {
      const expectedStrategy = BLIND_SPOT_TO_STRATEGY_V2[primaryBlindSpotId]
      if (expectedStrategy && pm.upgradedModel.strategyId !== expectedStrategy) {
        errors.push('UPGRADED_MODEL_STRATEGY_MISMATCH:' + pm.upgradedModel.strategyId)
      }
    }
  }

  // ── Evidence explanation rows: question/option validity + unrelated blind spot ──
  const evidenceRows = pm.evidenceExplanation && Array.isArray(pm.evidenceExplanation.rows)
    ? pm.evidenceExplanation.rows
    : []
  const evidenceBlindSpot = pm.evidenceExplanation && pm.evidenceExplanation.blindSpotId
  for (const row of evidenceRows) {
    const q = QUESTION_BY_ID.get(row.questionId)
    if (!q) {
      errors.push('EVIDENCE_QUESTION_NOT_FOUND:' + row.questionId)
      continue
    }
    const validOption = q.options.some((o) => o.optionId === row.optionId)
    if (!validOption) {
      errors.push('EVIDENCE_OPTIONID_INVALID:' + row.questionId + ':' + row.optionId)
    }
    if (row.dimension && !VALID_CONSTRUCTS.has(row.dimension)) {
      errors.push('EVIDENCE_UNKNOWN_DIMENSION:' + row.dimension)
    }
    // Evidence must support the primary blind spot's construct, not an
    // unrelated blind spot.
    if (evidenceBlindSpot && row.supports && row.supports !== evidenceBlindSpot) {
      errors.push('EVIDENCE_POINTS_TO_UNRELATED_BLIND_SPOT:' + row.supports + '!=' + evidenceBlindSpot)
    }
    // The evidence row's dimension must match the question's construct.
    if (q.construct && row.dimension && q.construct !== row.dimension) {
      errors.push('EVIDENCE_DIMENSION_QUESTION_MISMATCH:' + row.questionId)
    }
  }

  // ── Multi-model evidence: no fabricated primary, no unknown blind spots ──
  const multiModels = pm.multiModelEvidence
  if (multiModels && Array.isArray(multiModels)) {
    if (primaryBlindSpotId) {
      errors.push('FABRICATED_PRIMARY_WITH_MULTI_MODEL_EVIDENCE')
    }
    for (const m of multiModels) {
      if (m.blindSpotId && !VALID_BLIND_SPOT_IDS.has(m.blindSpotId)) {
        errors.push('UNKNOWN_BLIND_SPOT_IN_MULTI_MODEL:' + m.blindSpotId)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

module.exports = {
  FORBIDDEN_FIELDS,
  PREDICTION_TOKENS,
  validateNorthStarPresentationV21,
}
