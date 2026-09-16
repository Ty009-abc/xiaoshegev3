'use strict'
/**
 * utils/v6/turnaroundReportViewModelV6.js
 *
 * RC8.4 V6 — client response adapter + view model for the five-card report.
 *
 * Pure presentation. It answers "HOW TO PRESENT", never "WHAT IS TRUE":
 *   - consumes the backend-authoritative report verbatim
 *   - NEVER rediagnoses, NEVER rewrites primaryBottleneck, NEVER invents scores
 *     / percentages / firstActionType, NEVER performs client-side AI calls
 *   - DROPS engineering metadata (provenance / reportVersion / reportState /
 *     renderSource / validator state / model name) so none reaches WXML.
 *
 * Backend response (R21 `buildTurnaroundV6UserReport`):
 *   { code, message, data: { reportType, diagnosticVersion, v6PrimaryActive,
 *     reportVersion, reportState, cards } }
 *
 * @version turnaround_strategy_v6 (client view model)
 */

const RETRY_MESSAGE = '策略引擎暂时不可用，请稍后重试。'
const RETAKE_MESSAGE = '问卷数据不完整，请重新测评。'
const NO_REPORT_MESSAGE = '暂时无法生成翻身策略，请稍后重试。'

const CARD_TITLE_FALLBACK = {
  fatalInsight: '致命一句话',
  coreProblem: '核心问题',
  systemLoop: '系统困局',
  turnaroundPath: '翻身路径',
  firstAction: '现在就做',
}

function toSteps (card) {
  if (Array.isArray(card && card.steps)) return card.steps.slice()
  return []
}

function pushCard (out, key, card, extra) {
  if (!card || typeof card !== 'object') return
  const title = (typeof card.title === 'string' && card.title) || CARD_TITLE_FALLBACK[key] || ''
  // Backend cards carry body text under `text` (cards 01/02) OR `logic`
  // (card 04 翻身路径). Both are presentation content; accept either so the
  // turnaroundPath card is never silently dropped (R31 §2 root cause B).
  let body = typeof card.text === 'string' ? card.text : ''
  if (!body && typeof card.logic === 'string') body = card.logic
  const entry = Object.assign({ key: key, title: title, body: body }, extra ? extra(card) : {})
  // Only emit a card with SOME renderable content (body / steps / action / from/to).
  if (!entry.body && !(entry.steps && entry.steps.length) && !entry.action && !(entry.from || entry.to)) return
  out.push(entry)
}

/**
 * Map backend `cards` → ordered, raw-token-free card list (max 5).
 */
function buildCardListV6 (cards) {
  const out = []
  if (!cards || typeof cards !== 'object') return out
  pushCard(out, 'fatalInsight', cards.fatalInsight)
  pushCard(out, 'coreProblem', cards.coreProblem)
  pushCard(out, 'systemLoop', cards.systemLoop, (c) => ({ steps: toSteps(c) }))
  pushCard(out, 'turnaroundPath', cards.turnaroundPath, (c) => ({
    from: typeof c.from === 'string' ? c.from : '',
    to: typeof c.to === 'string' ? c.to : '',
  }))
  pushCard(out, 'firstAction', cards.firstAction, (c) => ({
    action: typeof c.action === 'string' ? c.action : '',
    checks: Array.isArray(c.checks) ? c.checks.slice() : [],
    // R33 §9 REALITY TEST components (WHAT/WHERE+TIMEBOX/SIGNAL/DECISION).
    // Pure presentation passthrough of backend-authoritative strings.
    timebox: typeof c.timebox === 'string' ? c.timebox : '',
    where: typeof c.verifyWith === 'string' ? c.verifyWith : '',
    signal: typeof c.done === 'string' ? c.done : '',
    decision: typeof c.decision === 'string' ? c.decision : '',
  }))
  return out
}

/**
 * Build the report view model from a cloud-function envelope (`res.result`).
 * @param {Object} result  res.result = { code, message, data }
 * @returns {{uiState:string, hasReport:boolean, cards:Array, message:string, retake:boolean}}
 */
function buildTurnaroundReportViewModelV6 (result) {
  if (!result || typeof result !== 'object') {
    return { uiState: 'ERROR', hasReport: false, cards: [], message: RETRY_MESSAGE, retake: true }
  }
  const data = result.data
  if (!data || typeof data !== 'object') {
    return { uiState: 'ERROR', hasReport: false, cards: [], message: RETRY_MESSAGE, retake: true }
  }

  const state = data.reportState

  if (state === 'INVALID_INPUT') {
    return { uiState: 'INVALID_INPUT', hasReport: false, cards: [], message: RETAKE_MESSAGE, retake: true }
  }

  const active = data.v6PrimaryActive === true
  const cards = buildCardListV6(data.cards)

  if (active && (state === 'PRIMARY' || state === 'NO_PRIMARY') && cards.length > 0) {
    return {
      uiState: state === 'NO_PRIMARY' ? 'NO_PRIMARY' : 'PRIMARY',
      hasReport: true,
      cards: cards,
      message: '',
      retake: true,
    }
  }

  // V6 not enabled / unavailable (e.g. production MODE != ON for this account),
  // or a non-shippable fallback. Never surface engineering detail.
  return { uiState: 'UNAVAILABLE', hasReport: false, cards: [], message: NO_REPORT_MESSAGE, retake: true }
}

module.exports = {
  RETRY_MESSAGE,
  RETAKE_MESSAGE,
  NO_REPORT_MESSAGE,
  CARD_TITLE_FALLBACK,
  buildCardListV6,
  buildTurnaroundReportViewModelV6,
}
