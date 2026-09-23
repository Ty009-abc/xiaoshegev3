/**
 * services/legacy6qReportService.js
 *
 * RC8.8_STAGE2_R2_LEGACY_UI_BASELINE_RECOVERY — bridge between the restored
 * 2026-07-11 legacy 6Q UI and the CURRENT Stage2 legacy6q backend contract
 * (`turnaround_strategy_6q_v1`).
 *
 * The 07/11 UI expects the OLD response property names
 * (fatal_sentence / core_problem / system_trap / turnaround_path / advice).
 * The Stage2 backend emits
 * (system_trap / core_problem / fatal_sentence / strategy_path / advice).
 *
 * `adaptLegacy6QReport` maps backend → UI field names. It NEVER modifies backend
 * output merely to satisfy UI names, and it does not redesign the result page.
 *
 * Request contract (§7): type='diagnostic', diagnosticVersion=
 * 'turnaround_strategy_6q_v1', raw fields age/job/education/income/anxiety/rootCause.
 * No Hybrid 10Q payload. No diagnosis enum. No world-model payload.
 *
 * @version legacy6q_v1 (client bridge)
 */

'use strict'

const QUESTIONNAIRE_VERSION = 'turnaround_strategy_6q_v1'

function call (name, data) {
  return wx.cloud.callFunction({ name, data }).then(function (r) { return r.result })
}

/**
 * Pure adapter: Stage2 legacy6q envelope → 07/11 UI field contract.
 * @param {object} result raw cloud-function response ({ code, message, data })
 * @returns {object} 07/11-shaped report object
 */
function adaptLegacy6QReport (result) {
  const d = (result && result.data) || result || {}
  const rawAdvice = d.advice
  const advice = Array.isArray(rawAdvice)
    ? rawAdvice.map(function (x) { return String(x === undefined || x === null ? '' : x).trim() }).filter(function (x) { return x })
    : (rawAdvice ? [String(rawAdvice)] : [])
  return {
    reportState: d.reportState || '',
    reportType: d.reportType || '',
    diagnosticVersion: d.diagnosticVersion || QUESTIONNAIRE_VERSION,
    // ── 07/11 UI field names ──
    // backend `strategy_path` is surfaced to the old UI as `turnaround_path`.
    fatal_sentence: String(d.fatal_sentence || ''),
    core_problem: String(d.core_problem || ''),
    system_trap: String(d.system_trap || ''),
    turnaround_path: String(d.strategy_path || d.turnaround_path || ''),
    strategy_path: String(d.strategy_path || ''),
    advice: advice,
    personality: d.personality || null,
  }
}

/**
 * Submit the 6 raw facts with the Stage2 contract and resolve to a
 * 07/11-UI-shaped response: { code, message, data }.
 * @param {{answers:object, personality?:string, personalityEmoji?:string, personalityStyle?:string}} p
 */
function generateLegacy6QReport (p) {
  const args = p || {}
  return call('generateAiReport', {
    type: 'diagnostic',
    diagnosticVersion: QUESTIONNAIRE_VERSION,
    answers: args.answers,
    personality: args.personality,
    personalityEmoji: args.personalityEmoji,
    personalityStyle: args.personalityStyle,
  }).then(function (result) {
    if (!result) return { code: -1, message: '分析失败', data: null }
    if (result.code !== 0) return { code: result.code, message: result.message || '分析失败', data: null }
    return { code: 0, message: result.message || 'success', data: adaptLegacy6QReport(result) }
  })
}

module.exports = { QUESTIONNAIRE_VERSION, adaptLegacy6QReport, generateLegacy6QReport }
