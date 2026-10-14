'use strict'
/**
 * reportVisibility.js — RC8_13_P0_HISTORY_LIST_SERVER_AUTHORITY_FIX
 *
 * CANONICAL report visibility predicate. Single source of truth.
 *
 * This file is an IDENTICAL shared artifact copied (byte-for-byte) into every
 * consuming cloud function's lib/ directory:
 *   - cloudfunctions/getProfileStats/lib/reportVisibility.js
 *   - cloudfunctions/getReportHistory/lib/reportVisibility.js
 *
 * Do NOT fork the logic. If the predicate changes, regenerate all copies.
 *
 * A report is user-viewable iff it has a canonical client rendering route:
 *   - type === 'challenge_final' AND recordId present
 *       → /pages/report-preview?type=challenge_final&recordId=...
 *         (detail fetched server-side via generateAiReport/getAiReport)
 *   - content.fatal_sentence || content.system_trap present
 *       → /pages/legacy6q-report (local content handoff; free; no AI/membership gate)
 * Everything else (shadow diagnostics, non-canonical legacy shapes with no
 * renderable payload, empty rows) is EXCLUDED — it can never be opened.
 */

const REPORT_KINDS = {
  CHALLENGE_FINAL: 'challenge_final',
  LEGACY6Q: 'legacy6q',
}

/**
 * Canonical kind of a report row ('' when not user-viewable).
 * @param {object} r raw ai_reports row
 * @returns {'challenge_final'|'legacy6q'|''}
 */
function kindOf (r) {
  if (!r) return ''
  if (r.type === 'challenge_final') return r.recordId ? REPORT_KINDS.CHALLENGE_FINAL : ''
  const c = r.content
  if (c && (c.fatal_sentence || c.system_trap)) return REPORT_KINDS.LEGACY6Q
  return ''
}

/** A single row is user-viewable under the canonical rule? */
function isViewableReport (r) {
  return kindOf(r) !== ''
}

/** Count viewable rows in a materialised page (raw rows). */
function countViewableReports (rows) {
  if (!Array.isArray(rows)) return 0
  let n = 0
  for (const r of rows) if (isViewableReport(r)) n++
  return n
}

/** Number of pages to request when materialising a collection (bounded scan). */
function pagesFor (total, pageSize) {
  const t = Number(total) || 0
  const ps = Number(pageSize) || 100
  if (t <= 0) return 0
  return Math.ceil(t / ps)
}

module.exports = { REPORT_KINDS, kindOf, isViewableReport, countViewableReports, pagesFor }
