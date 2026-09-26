/**
 * utils/reportHistory.js — RC8.8_MY_PAGE_FUNCTION_RECOVERY_D
 *
 * Canonical LOCAL report history for the Stage2 legacy 6Q product line.
 *
 * Storage key: legacy6q_report_history
 * Schema: Array<{
 *   id, createdAt, persona, answersSummary,
 *   report: { fatal_sentence, core_problem, system_trap, strategy_path, turnaround_path, advice }
 * }>
 * Bounded to MAX items. No secrets / prompt / model data stored.
 *
 * Local-first by design: the 6Q backend does NOT persist to ai_reports, so the
 * "我的报告" list + count read this single source. Old ai_reports is untouched.
 */

'use strict'

const KEY = 'legacy6q_report_history'
const MAX = 20

function _load () {
  try {
    const r = wx.getStorageSync(KEY)
    return Array.isArray(r) ? r : []
  } catch (_) { return [] }
}

function _save (list) {
  try { wx.setStorageSync(KEY, (list || []).slice(0, MAX)) } catch (_) {}
}

/** Compact, non-sensitive answer summary for the list row. */
function summarizeAnswers (answers) {
  const a = answers || {}
  const parts = []
  if (a.age) parts.push(`${a.age}岁`)
  if (a.job) parts.push(String(a.job).slice(0, 12))
  if (a.income) parts.push(`月入${a.income}`)
  return parts.join(' · ')
}

/**
 * Build a canonical history record from a READY report + the submission handoff.
 * @param {object} report adapted 6Q report ({fatal_sentence, ...,advice})
 * @param {object} handoff {requestId, answers, personality, ...}
 */
function buildRecord (report, handoff) {
  const h = handoff || {}
  const p = h.personality || {}
  const advice = Array.isArray(report.advice)
    ? report.advice
    : (report.advice ? [String(report.advice)] : [])
  return {
    id: h.requestId || ('r6q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
    createdAt: Date.now(),
    persona: (p && p.name) || '',
    answersSummary: summarizeAnswers(h.answers),
    report: {
      fatal_sentence: report.fatal_sentence || '',
      core_problem: report.core_problem || '',
      system_trap: report.system_trap || '',
      strategy_path: report.strategy_path || report.turnaround_path || '',
      turnaround_path: report.turnaround_path || report.strategy_path || '',
      advice: advice,
    },
  }
}

/**
 * Persist ONE history record for ONE successful submission.
 * - never stores fallback/error/empty results (requires fatal_sentence)
 * - dedups by submission id (one record per successful submission)
 * @returns {object|null} the stored record
 */
function record (report, handoff) {
  if (!report || !report.fatal_sentence) return null
  const rec = buildRecord(report, handoff)
  const list = _load()
  if (list.some((x) => x && x.id === rec.id)) return rec
  list.unshift(rec)
  _save(list)
  return rec
}

function list () { return _load() }
function count () { return _load().length }
function get (id) { return _load().find((x) => x && x.id === id) || null }

module.exports = { KEY, MAX, list, count, get, record, buildRecord, summarizeAnswers }
