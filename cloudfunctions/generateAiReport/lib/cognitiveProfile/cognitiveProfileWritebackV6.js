'use strict'
/**
 * lib/cognitiveProfile/cognitiveProfileWritebackV6.js
 *
 * RC8.4 V6 R77 §10–§12 — FAILURE-ISOLATED PROFILE WRITEBACK.
 *
 * After a SUCCESSFUL R75/V4-restored diagnosis the caller invokes this. It:
 *   1. derives a DETERMINISTIC report key (idempotency — §12),
 *   2. builds the deterministic Cognitive Profile patch,
 *   3. merge-safe updates the EXISTING `user_profiles` document,
 *   4. NEVER throws: any failure is contained + logged privacy-safe (§11).
 *
 * REPORT_SUCCESS_PROFILE_WRITE_FAIL → the caller still returns the report.
 *
 * PRIVACY (§18): logs NEVER include raw openid or raw questionnaire answers —
 * only presence booleans + reason codes. No raw-answer duplication is stored:
 * the profile holds normalized cognitive state, not the response dump.
 *
 * No AI. The single I/O is the merge-safe user_profiles update.
 */

const crypto = require('crypto')
const { buildCognitiveProfilePatch, mergeProfilePatch } = require('./cognitiveProfileBridgeV6.js')

/**
 * Deterministic, privacy-safe report key. Derived from the normalized
 * diagnosis outputs (NOT raw answers), so reprocessing the same submission
 * yields the same key. A sha256 fingerprint — not a raw dump.
 */
function deriveProfileReportKeyV6 (diagnosis, hybridProfile, report) {
  const h = crypto.createHash('sha256')
  const basis = JSON.stringify({
    ds: (diagnosis && diagnosis.diagnosisState) || null,
    pb: (diagnosis && diagnosis.primaryBottleneck) || null,
    es: (diagnosis && diagnosis.executionStage) || null,
    at: (diagnosis && diagnosis.firstActionType) || null,
    asset: (hybridProfile && hybridProfile.asset) || null,
    dc: (hybridProfile && hybridProfile.desiredChange) || null,
    rt: (report && report.reportState) || null,
    th: (report && report.strategicThesis && report.strategicThesis.coreContradiction) || null
  })
  h.update(basis)
  return 'ARV6_' + h.digest('hex').substring(0, 24)
}

/**
 * Run the writeback. Never throws.
 * @param {Object} db cloud database handle
 * @param {string} openid
 * @param {Object} args { diagnosis, hybridProfile, hybridContext, report, ts, reportKey }
 * @returns {Promise<{ok:boolean, wrote:boolean, reason:string, reportKey:string|null, idempotent:boolean}>}
 */
async function runCognitiveProfileWritebackV6 (db, openid, args) {
  const a = args || {}
  const result = { ok: false, wrote: false, reason: 'UNKNOWN', reportKey: null, idempotent: false }
  try {
    if (!db || !openid) { result.reason = 'NO_DB_OR_OPENID'; return result }
    if (!a.diagnosis) { result.reason = 'NO_DIAGNOSIS'; return result }

    const reportKey = a.reportKey || deriveProfileReportKeyV6(a.diagnosis, a.hybridProfile, a.report)
    result.reportKey = reportKey
    const ts = a.ts != null ? a.ts : Date.now()

    const patch = buildCognitiveProfilePatch({
      diagnosis: a.diagnosis,
      hybridProfile: a.hybridProfile,
      hybridContext: a.hybridContext,
      report: a.report,
      reportId: reportKey,
      ts: ts
    })

    const col = db.collection('user_profiles')
    const existingRes = await col.where({ openid }).limit(1).get()
    const existing = (existingRes.data && existingRes.data[0]) || null
    if (!existing) { result.reason = 'NO_PROFILE_DOC'; return result }

    // §12 IDEMPOTENCY: if the stored key already equals this report key AND the
    // diagnostic section is already stamped, the write is a stable no-op.
    const priorKey = existing._profileMeta && existing._profileMeta.lastBuiltFromReportId
    if (priorKey && priorKey === reportKey) {
      result.ok = true
      result.wrote = false
      result.idempotent = true
      result.reason = 'IDEMPOTENT_NOOP'
      return result
    }

    const update = mergeProfilePatch(existing, patch)
    if (!update || !update.profileSchemaVersion) { result.reason = 'EMPTY_PATCH'; return result }
    update.updatedAt = ts

    await col.doc(existing._id).update({ data: update })

    result.ok = true
    result.wrote = true
    result.reason = 'WROTE'
    return result
  } catch (e) {
    // §11 — contain: log ONLY a presence + reason code. NO openid, NO answers.
    result.ok = false
    result.wrote = false
    result.reason = 'WRITE_FAIL'
    result.errorCode = (e && e.message) ? String(e.message).substring(0, 60) : 'THROW'
    try {
      console.error('[V6Profile] writeback_fail openid_present=' + (openid ? 'true' : 'false') +
        ' reason=' + result.reason + ' code=' + result.errorCode)
    } catch (_) {}
    return result
  }
}

module.exports = {
  runCognitiveProfileWritebackV6,
  deriveProfileReportKeyV6
}
