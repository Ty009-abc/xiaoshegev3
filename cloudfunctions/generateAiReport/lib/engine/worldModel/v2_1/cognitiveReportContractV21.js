/**
 * engine/worldModel/v2_1/cognitiveReportContractV21.js
 *
 * World Model v2.1 — Cognitive Report Contract (Stage1B R3).
 *
 * A SEPARATE server-side cognitive-report contract for the new V2.1 report path.
 * It is deliberately independent of the V4 diagnostic contract — it MUST NOT
 * reuse `REQUIRED_V4_KEYS` (the 15 economic/demographic fields) and MUST NOT
 * invent economic/financial evidence.
 *
 * The V2.1 cognitive report describes the user's decision model, risk model,
 * probability model, feedback model, opportunity model, leverage model,
 * identity model, time model, and system thinking. It contains NO income,
 * salary, occupation, monthly surplus, debt, wealth stage, economic
 * probability, or financial prediction.
 *
 * FROZEN RULES:
 *   - reportType      = 'diagnostic_v2_1'
 *   - diagnosticVersion = 'world_model_v2_1'
 *   - mode            = 'TEST_PREVIEW_ONLY' (initial mode; never PRIMARY)
 *   - engineAuthority = 'WORLD_MODEL_V2_1_ENGINE' (diagnosis authority)
 *   - aiExpressionOnly = true (AI may only enrich `expression`, never mutate
 *     worldModel / cognitiveArchetype / cognitiveBlindSpot / worldStrategy /
 *     scenarioSimulation / trace / evidence).
 *   - No economic/financial fields anywhere in the report.
 *
 * @version world_model_v2_1
 */

const V21_REPORT_TYPE = 'diagnostic_v2_1'
const V21_REPORT_DIAGNOSTIC_VERSION = 'world_model_v2_1'
const V21_REPORT_MODE = 'TEST_PREVIEW_ONLY'
const V21_ENGINE_AUTHORITY = 'WORLD_MODEL_V2_1_ENGINE'

// RC8.3 Stage1B R3.1 — FREE cognitive preview tier. The V2.1 cognitive report
// is INTENTIONALLY a free preview for Stage1B: it contains NO protected
// full-report content and NO economic content, so `full_report` permission is
// NOT required. This access tier is emitted verbatim on every report.
const V21_REPORT_ACCESS_TIER = 'FREE_COGNITIVE_PREVIEW'

// Frozen construct → scenario model-dimension key mapping.
// The V2.1 construct taxonomy (DECISION / FEEDBACK / ...) is mapped onto the
// scenario engine's model-dimension keys (DECISION_MODEL / ...). SYSTEMS has
// no dedicated scenario key in the frozen scenario vocabulary — it maps to
// DECISION_MODEL (matching SYSTEM_THINKING_GAP → DECISION_MODEL in the
// existing scenario engine).
const CONSTRUCT_TO_MODEL_DIM_V21 = Object.freeze({
  DECISION: 'DECISION_MODEL',
  FEEDBACK: 'FEEDBACK_MODEL',
  PROBABILITY: 'PROBABILITY_MODEL',
  RISK: 'RISK_MODEL',
  LEVERAGE: 'LEVERAGE_MODEL',
  TIME: 'TIME_MODEL',
  IDENTITY: 'IDENTITY_MODEL',
  OPPORTUNITY: 'OPPORTUNITY_MODEL',
  SYSTEMS: 'DECISION_MODEL',
})

// Frozen descriptive-only blindSpot → archetype map.
// The cognitive archetype is DESCRIPTIVE_ONLY: it describes the user's current
// cognitive structure derived strictly from the engine's primary blind spot.
// It NEVER feeds back into inference, NEVER overrides the engine's primary
// decision, and carries no economic meaning.
const BLIND_SPOT_TO_ARCHETYPE_V21 = Object.freeze({
  DECISION_INERTIA: 'GUARDIAN',
  FEEDBACK_LOOP_GAP: 'OPERATOR',
  PROBABILITY_MISJUDGMENT: 'EXPLORER',
  RISK_MODEL_DISTORTION: 'GUARDIAN',
  LEVERAGE_MODEL_GAP: 'OPERATOR',
  TIME_HORIZON_TRAP: 'OPERATOR',
  IDENTITY_CONSTRAINT: 'GUARDIAN',
  OPPORTUNITY_BLINDNESS: 'GUARDIAN',
  SYSTEM_THINKING_GAP: 'OPERATOR',
})

// Frozen report contract. `required` enumerates the components the report MUST
// contain. There is intentionally NO economic/financial field here.
const V21_REPORT_CONTRACT = Object.freeze({
  version: 'world_model_v2_1',
  reportType: V21_REPORT_TYPE,
  diagnosticVersion: V21_REPORT_DIAGNOSTIC_VERSION,
  mode: V21_REPORT_MODE,
  engineAuthority: V21_ENGINE_AUTHORITY,
  accessTier: V21_REPORT_ACCESS_TIER,
  required: [
    'worldModel',
    'cognitiveArchetype',
    'cognitiveBlindSpot',
    'worldStrategy',
    'scenarioSimulation',
    'trace',
    'finalVerdict',
  ],
  // Fields that MUST be absent from a V2.1 cognitive report (fabricated
  // economic evidence is forbidden).
  forbiddenFields: [
    'income',
    'salary',
    'occupation',
    'monthlySurplus',
    'debt',
    'wealthStage',
    'wealthProbability',
    'potentialIndex',
    'economicProbability',
    'incomeStructure',
    'lifeStage',
    'occupationDetail',
    'safetyMonths',
    'debtPressure',
  ],
  // Protected full-report content keys that MUST be absent from a free
  // cognitive preview. These belong to the legacy paid full-report surface
  // (getAiReport / report-preview), NOT the V2.1 cognitive preview.
  protectedFullReportFields: [
    'scores',
    'tags',
    'content',
    'summary',
    'turnaroundProbability',
    'worldModelType',
    'threeYearRisk',
    'isPaid',
    'locked',
    'preview',
  ],
})

/**
 * Validate a V2.1 cognitive report against the frozen contract.
 * Structural validation only — never invents or repairs content.
 *
 * @param {object} report
 * @returns {{valid:boolean, errors:string[], forbiddenHits:string[]}}
 */
function validateCognitiveReportV21(report) {
  const errors = []
  const forbiddenHits = []

  if (!report || typeof report !== 'object') {
    return { valid: false, errors: ['REPORT_NOT_OBJECT'], forbiddenHits: [] }
  }

  if (report.reportType !== V21_REPORT_TYPE) {
    errors.push('REPORT_TYPE_MISMATCH')
  }
  if (report.diagnosticVersion !== V21_REPORT_DIAGNOSTIC_VERSION) {
    errors.push('DIAGNOSTIC_VERSION_MISMATCH')
  }
  if (report.engineAuthority !== V21_ENGINE_AUTHORITY) {
    errors.push('ENGINE_AUTHORITY_MISMATCH')
  }
  if (report.accessTier !== V21_REPORT_ACCESS_TIER) {
    errors.push('ACCESS_TIER_MISMATCH')
  }

  // Required keys must be PRESENT (the key itself exists). Of these,
  // worldModel / trace / finalVerdict are structural skeletons and MUST also be
  // non-null. The four cognitive components (cognitiveArchetype /
  // cognitiveBlindSpot / worldStrategy / scenarioSimulation) may legitimately be
  // null when there is no primary deficit (NO_PRIMARY_DEFICIT) or when validity
  // was blocked — those are valid diagnostic outcomes, not missing components.
  for (const key of V21_REPORT_CONTRACT.required) {
    if (report[key] === undefined) {
      errors.push('MISSING_REPORT_COMPONENT:' + key)
    }
  }
  if (report.worldModel == null) errors.push('WORLD_MODEL_NULL')
  if (report.trace == null) errors.push('TRACE_NULL')
  if (report.finalVerdict == null) errors.push('FINAL_VERDICT_NULL')

  // worldModel must represent all 9 cognitive dimensions.
  if (report.worldModel && Array.isArray(report.worldModel.dimensions)) {
    const constructs = report.worldModel.dimensions.map((d) => d && d.construct)
    const { CONSTRUCTS_V21 } = require('./questionnaireV21')
    for (const c of CONSTRUCTS_V21) {
      if (constructs.indexOf(c) === -1) {
        errors.push('MISSING_DIMENSION:' + c)
      }
    }
  } else {
    errors.push('WORLD_MODEL_DIMENSIONS_NOT_ARRAY')
  }

  // Forbidden economic fields must be absent (defensive scan of the top-level
  // and the trace object; deep recursive scan is intentionally avoided to keep
  // validation deterministic and cheap).
  const scanTargets = [report, report.worldModel, report.cognitiveBlindSpot,
    report.cognitiveArchetype, report.worldStrategy, report.trace]
  for (const target of scanTargets) {
    if (!target || typeof target !== 'object') continue
    for (const key of Object.keys(target)) {
      if (V21_REPORT_CONTRACT.forbiddenFields.indexOf(key) !== -1) {
        forbiddenHits.push(key)
      }
    }
  }

  // Free cognitive preview must not carry protected full-report content.
  const protectedHits = []
  if (report && typeof report === 'object') {
    for (const key of Object.keys(report)) {
      if (V21_REPORT_CONTRACT.protectedFullReportFields.indexOf(key) !== -1) {
        protectedHits.push(key)
      }
    }
  }
  if (protectedHits.length > 0) {
    errors.push('PROTECTED_FULL_REPORT_CONTENT:' + protectedHits.join(','))
  }

  return { valid: errors.length === 0, errors, forbiddenHits }
}

module.exports = {
  V21_REPORT_TYPE,
  V21_REPORT_DIAGNOSTIC_VERSION,
  V21_REPORT_MODE,
  V21_ENGINE_AUTHORITY,
  V21_REPORT_ACCESS_TIER,
  CONSTRUCT_TO_MODEL_DIM_V21,
  BLIND_SPOT_TO_ARCHETYPE_V21,
  V21_REPORT_CONTRACT,
  validateCognitiveReportV21,
}
