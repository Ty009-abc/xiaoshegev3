/**
 * getProfileStats/lib/countPolicy.js
 *
 * RC8_13_P0_PROFILE_HISTORY_AUTHORITY_FIX — canonical "what counts" policy.
 *
 * Pure functions only (no wx-server-sdk, no network) so behaviour is unit-testable
 * and cannot silently diverge from the client report-history visibility rule.
 *
 * REPORT semantics:
 *   A report counts when it has a canonical user-viewable rendering route —
 *   the SAME rule report-history.kindOf() applies to what it will actually list:
 *     - type === 'challenge_final' AND recordId present → renders in report-preview
 *     - content.fatal_sentence || content.system_trap      → renders in legacy6q
 *   Everything else (shadow diagnostics, non-canonical legacy shapes with no
 *   renderable payload) is NOT counted. Empty result is a real 0, not a failure.
 *
 * CHALLENGE semantics (mirrors challenge-records canonical semantics):
 *   CHALLENGE_COUNT          = user-owned challenge_records (all statuses)
 *   CHALLENGE_FINISHED_COUNT = user-owned challenge_records{status:'finished'}
 */

// A single ai_reports row is user-viewable under the report-history rule?
function isViewableReport (r) {
  if (!r) return false
  if (r.type === 'challenge_final') return !!r.recordId
  const c = r.content
  if (c && (c.fatal_sentence || c.system_trap)) return true
  return false
}

// Count viewable reports in a materialised page (raw rows).
function countViewableReports (rows) {
  if (!Array.isArray(rows)) return 0
  let n = 0
  for (const r of rows) if (isViewableReport(r)) n++
  return n
}

// Number of pages to request when materialising a collection (bounded scan).
function pagesFor (total, pageSize) {
  const t = Number(total) || 0
  const ps = Number(pageSize) || 100
  if (t <= 0) return 0
  return Math.ceil(t / ps)
}

module.exports = { isViewableReport, countViewableReports, pagesFor }
