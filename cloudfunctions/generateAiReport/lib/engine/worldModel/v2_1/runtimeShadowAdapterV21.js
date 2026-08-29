/**
 * engine/worldModel/v2_1/runtimeShadowAdapterV21.js
 *
 * World Model v2.1 — Runtime Shadow Adapter (Stage20 R1).
 *
 * SHADOW ONLY. Combines, inside isolated try/catch boundaries:
 *   responseValidityV21 (validity gate)
 *   → canonical cognition chain (evidence → signals → dimensions → candidates
 *     → A5A primary decision)
 *   → shadow record persistence
 *
 * It is a GATE + ORCHESTRATOR, not an inference engine: it never duplicates
 * inference logic, never invents scores/probabilities/confidence/wealth fields,
 * never mutates user-visible legacy report fields (renderSource / wealth /
 * cashflow / destinySimulator), and never runs follow-up resolution without a
 * real future user answer.
 *
 * Authority: docs/RC8.3_STAGE20_R0_V21_RUNTIME_SHADOW_CONTRACT.md
 *   (Stage20-R0 > R3C-R1 > R3C > R3B > R3 > R3D > A5/A5.1/A5.1-R1).
 *
 * FROZEN RULES:
 *   - Control plane: RC83_WORLD_MODEL_V2_1_MODE ∈ { OFF, SHADOW }, default OFF,
 *     fail-closed. No PRIMARY, no allowlist, no V1/V2 mode coupling.
 *   - Validity first: only RESPONSE_VALID may execute cognition.
 *     LOW / INSUFFICIENT → cognitionExecuted=false, dimensions=null,
 *     primaryBlindSpotId=null, cognitionTerminalStatus=NOT_EXECUTED.
 *   - Cognition uses canonical V2.1 engines only (no duplicated logic).
 *   - FOLLOW_UP_REQUIRED → record shadow outcome only; no follow-up UI, no
 *     synthetic follow-up answer, no A5B2 resolution (needs a real answer).
 *   - Failure boundary: any V2.1 failure (validity / cognition / persistence /
 *     malformed input) is isolated — it must NEVER block the production
 *     response. Fail-open for production, fail-observable via errorCode.
 *   - Record namespace: diagnostic_world_model_v2_1_shadow (no V1/V2 collision).
 *   - No invented probability/confidence/severity, no legacy wealth fields.
 *   - displayPosition is the ONLY position source (R3C); no optionId fallback.
 *
 * @version world_model_v2_1
 */

const responseValidity = require('./responseValidityV21')
const cognition = require('./index.js')

const V21_SHADOW_RECORD_NAMESPACE = 'diagnostic_world_model_v2_1_shadow'
const V21_DIAGNOSTIC_VERSION = 'world_model_v2_1'
const V21_RECORD_SCHEMA_VERSION = '1'

/**
 * Extract the response-validity payload from the runtime event.
 *
 * Input contract (R0 §9): runtime must be able to access questionId, optionId,
 * and displayPosition. Accepts an array of { questionId, optionId,
 * displayPosition } or a bare array. `displayPosition` is the ONLY position
 * source; it is never derived from optionId.
 *
 * @param {*} answersPayload  event.answers || event.v21Answers
 * @returns {Array}
 */
function extractResponsesV21(answersPayload) {
  if (Array.isArray(answersPayload)) return answersPayload
  if (answersPayload && typeof answersPayload === 'object' && Array.isArray(answersPayload.responses)) {
    return answersPayload.responses
  }
  if (answersPayload && typeof answersPayload === 'object' && Array.isArray(answersPayload.answers)) {
    return answersPayload.answers
  }
  return []
}

/**
 * Build the minimal shadow record schema (R0 §8).
 *
 * NO invented probability/confidence/severity scores. NO legacy wealth fields.
 * Blocked validity → exact null/omission semantics (R0 §8).
 *
 * @param {object} params
 * @returns {object}
 */
function buildShadowRecordV21(params) {
  const {
    validityResult,
    cognitionExecuted,
    cognitionTerminalStatus,
    primaryBlindSpotId,
    primaryConstruct,
    followUpRequired,
    followUpPair,
    dimensionSummary,
    evidenceTraceSummary,
    errorCode,
    requestId,
  } = params

  return {
    schemaVersion: V21_RECORD_SCHEMA_VERSION,
    diagnosticVersion: V21_DIAGNOSTIC_VERSION,
    responseValidityStatus: validityResult ? validityResult.status : null,
    responseValidityReason: validityResult && Array.isArray(validityResult.reasons) ? validityResult.reasons[0] || null : null,
    cognitionExecuted: !!cognitionExecuted,
    cognitionTerminalStatus: cognitionTerminalStatus || 'NOT_EXECUTED',
    primaryBlindSpotId: primaryBlindSpotId == null ? null : primaryBlindSpotId,
    primaryConstruct: primaryConstruct == null ? null : primaryConstruct,
    followUpRequired: !!followUpRequired,
    followUpPair: followUpPair == null ? null : followUpPair,
    dimensionSummary: dimensionSummary == null ? null : dimensionSummary,
    evidenceTraceSummary: evidenceTraceSummary == null ? null : evidenceTraceSummary,
    errorCode: errorCode == null ? null : errorCode,
    requestId: requestId == null ? null : requestId,
  }
}

/**
 * Run the canonical V2.1 cognition chain (no duplicated inference logic).
 *
 * @param {Array} responses  raw { questionId, optionId, displayPosition } entries
 * @returns {object}  { decision, dimensions, signals }
 */
function runCognitionChainV21(responses) {
  const norm = cognition.normalizeEvidenceV21(responses)
  const signals = cognition.extractSignalsV21(norm)
  const dims = cognition.computeDimensionsV21(norm)
  const { candidates, contractViolations } = cognition.buildBlindSpotCandidatesV21(dims)
  const decision = cognition.decidePrimaryV21({ candidates, contractViolations })
  return { decision, dimensions: dims.dimensions, signals }
}

/**
 * Execute the V2.1 shadow runtime. SHADOW only; fail-open.
 *
 * @param {object} opts
 * @param {object} opts.event        runtime event ({ answers | v21Answers, reportId }).
 * @param {string} opts.openid       caller openid.
 * @param {number} opts.ts           timestamp.
 * @param {object} opts.db           CloudBase db (with .collection('ai_reports').add).
 * @returns {object}  { record, userVisible:boolean }
 *   `record` is the assembled shadow record (also persisted when db available).
 *   `userVisible` is always false — V2.1 never mutates user-visible output.
 */
async function runRuntimeShadowV21({ event, openid, ts, db }) {
  const requestId = (event && event.reportId) || (event && event.traceId) || null

  // ── 1. Response validity gate (isolated) ────────────────────────────────
  let validityResult = null
  let errorCode = null
  try {
    const responses = extractResponsesV21(event && (event.answers || event.v21Answers))
    validityResult = responseValidity.assessResponseValidityV21(responses)
  } catch (e) {
    errorCode = 'VALIDITY_EXCEPTION'
    console.error('[V21Shadow] validity exception:', (e && e.message) || e)
    // Fail-open: validityResult stays null → treated as blocked below.
  }

  // ── 2. Cognition chain (only when RESPONSE_VALID) ───────────────────────
  let cognitionExecuted = false
  let cognitionTerminalStatus = 'NOT_EXECUTED'
  let primaryBlindSpotId = null
  let primaryConstruct = null
  let followUpRequired = false
  let followUpPair = null
  let dimensionSummary = null
  let evidenceTraceSummary = null

  if (validityResult && validityResult.status === 'RESPONSE_VALID') {
    try {
      const responses = extractResponsesV21(event && (event.answers || event.v21Answers))
      const chain = runCognitionChainV21(responses)
      const decision = chain.decision
      cognitionExecuted = true
      cognitionTerminalStatus = decision.status || 'INSUFFICIENT_EVIDENCE'
      primaryBlindSpotId = decision.primaryBlindSpotId == null ? null : decision.primaryBlindSpotId
      primaryConstruct = decision.primaryConstruct == null ? null : decision.primaryConstruct
      if (decision.status === 'FOLLOW_UP_REQUIRED') {
        followUpRequired = true
        followUpPair = decision.followupPair == null ? null : decision.followupPair
      }
      // Structural summaries only — no invented score / probability / wealth.
      dimensionSummary = chain.dimensions.map((d) => ({
        construct: d.construct,
        orientation: d.orientation,
        state: d.state,
        hSupport: d.hSupport,
        dSupport: d.dSupport,
        nSupport: d.nSupport,
      }))
      evidenceTraceSummary = chain.signals.map((s) => ({
        signalId: s.signalId,
        direction: s.direction,
        distortionType: s.distortionType,
        evidenceCount: s.evidenceCount,
      }))
    } catch (e) {
      errorCode = errorCode || 'COGNITION_EXCEPTION'
      console.error('[V21Shadow] cognition exception:', (e && e.message) || e)
      cognitionExecuted = false
      cognitionTerminalStatus = 'NOT_EXECUTED'
      primaryBlindSpotId = null
      primaryConstruct = null
      followUpRequired = false
      followUpPair = null
      dimensionSummary = null
      evidenceTraceSummary = null
    }
  } else if (validityResult) {
    // LOW / INSUFFICIENT → blocked (R0 §3). No cognition.
    cognitionExecuted = false
    cognitionTerminalStatus = 'NOT_EXECUTED'
  }

  const record = buildShadowRecordV21({
    validityResult,
    cognitionExecuted,
    cognitionTerminalStatus,
    primaryBlindSpotId,
    primaryConstruct,
    followUpRequired,
    followUpPair,
    dimensionSummary,
    evidenceTraceSummary,
    errorCode,
    requestId,
  })

  // ── 3. Persistence (isolated; write failure only logs, never blocks) ────
  try {
    if (db && typeof db.collection === 'function') {
      await db.collection('ai_reports').add({
        data: {
          openid: openid || null,
          type: V21_SHADOW_RECORD_NAMESPACE,
          recordType: V21_SHADOW_RECORD_NAMESPACE,
          shadowWorldModelV21: record,
          createdAt: ts,
          updatedAt: ts,
        },
      })
    }
  } catch (e) {
    // Persistence failure is isolated: log only. Never blocks, never rethrows.
    console.error('[V21Shadow] record persist failed:', (e && e.message) || e)
  }

  return { record, userVisible: false }
}

module.exports = {
  V21_SHADOW_RECORD_NAMESPACE,
  V21_DIAGNOSTIC_VERSION,
  V21_RECORD_SCHEMA_VERSION,
  extractResponsesV21,
  buildShadowRecordV21,
  runCognitionChainV21,
  runRuntimeShadowV21,
}
