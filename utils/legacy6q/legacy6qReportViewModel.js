'use strict'
/**
 * utils/legacy6q/legacy6qReportViewModel.js
 *
 * RC8.8 Stage2 (§15/§17) — client view model for the REVIVED legacy 6Q report.
 *
 * Consumes the backend five-field business contract VERBATIM and adapts it to
 * the five-card presentation schema used by the current stable result UI. It
 * NEVER rediagnoses, rewrites copy, invents scores, or exposes internal enums.
 *
 * VISIBLE order deliberately differs from JSON order (§15): fatal_sentence is
 * promoted to Card01 (the hero).
 *   CARD01 fatalInsight     ← fatal_sentence     (红色 hero · ☠️)
 *   CARD02 coreProblem      ← core_problem
 *   CARD03 systemLoop       ← system_trap
 *   CARD04 turnaroundPath   ← strategy_path
 *   CARD05 firstAction      ← advice[]
 *
 * Backend response (legacy 5-field contract):
 *   { code, message, data: { reportType, diagnosticVersion, reportState,
 *     system_trap, core_problem, fatal_sentence, strategy_path, advice,
 *     personality } }
 *
 * @version legacy6q_v1 (client view model)
 */

const RETRY_MESSAGE = '暂时无法生成翻身策略，请稍后重试。'
const RETAKE_MESSAGE = '问卷数据不完整，请重新测评。'
const NO_REPORT_MESSAGE = '暂时无法生成翻身策略，请稍后重试。'

const CARD_TITLE = {
  fatalInsight: '致命一句话',
  coreProblem: '核心问题',
  systemLoop: '系统困局',
  turnaroundPath: '翻身路径',
  firstAction: '行动建议',
}

function str (v) { return typeof v === 'string' ? v : '' }
function arr (v) { return Array.isArray(v) ? v.slice() : [] }

/**
 * Build the five visible cards in the fixed §15 order. A card is included ONLY
 * when its source field carries content; missing cards are omitted, never
 * fabricated.
 * @returns {Array<object>}
 */
function buildCardList6Q (data) {
  const out = []
  if (!data || typeof data !== 'object') return out

  const fatal = str(data.fatal_sentence)
  if (fatal) {
    out.push({ key: 'fatalInsight', title: CARD_TITLE.fatalInsight, oneLiner: fatal, hero: true })
  }

  const core = str(data.core_problem)
  if (core) {
    out.push({ key: 'coreProblem', title: CARD_TITLE.coreProblem, body: core, identity: '', explanation: '' })
  }

  const trap = str(data.system_trap)
  if (trap) {
    out.push({ key: 'systemLoop', title: CARD_TITLE.systemLoop, loopNodes: [trap], finalInsight: '' })
  }

  const strategy = str(data.strategy_path)
  if (strategy) {
    out.push({ key: 'turnaroundPath', title: CARD_TITLE.turnaroundPath, to: strategy, toLabel: '方向', from: '', fromLabel: '', arrow: '', worldRule: '' })
  }

  const advice = arr(data.advice).map((x) => str(x).trim()).filter((x) => x)
  if (advice.length) {
    out.push({
      key: 'firstAction',
      title: CARD_TITLE.firstAction,
      actionItems: advice.map((text, i) => ({ index: i + 1, label: '行动' + (i + 1), title: '', text })),
      actions: advice,
    })
  }

  return out
}

/**
 * @param {object} result raw cloud envelope { code, data, ... }
 * @returns {{uiState:string, hasReport:boolean, cards:Array, message:string, retake:boolean, personality:object|null}}
 */
function buildTurnaroundReportViewModel6Q (result) {
  if (!result || typeof result !== 'object' || !result.data || typeof result.data !== 'object') {
    return { uiState: 'ERROR', hasReport: false, cards: [], message: RETRY_MESSAGE, retake: true, personality: null }
  }
  const data = result.data
  if (data.reportState === 'INVALID_INPUT') {
    return { uiState: 'INVALID_INPUT', hasReport: false, cards: [], message: RETAKE_MESSAGE, retake: true, personality: null }
  }
  const cards = buildCardList6Q(data)
  const isPrimary = data.reportState === 'PRIMARY'
  if (isPrimary && cards.length > 0) {
    return { uiState: 'PRIMARY', hasReport: true, cards, message: '', retake: true, personality: data.personality || null }
  }
  return { uiState: 'UNAVAILABLE', hasReport: false, cards: [], message: NO_REPORT_MESSAGE, retake: true, personality: data.personality || null }
}

module.exports = {
  RETRY_MESSAGE,
  RETAKE_MESSAGE,
  NO_REPORT_MESSAGE,
  CARD_TITLE,
  buildCardList6Q,
  buildTurnaroundReportViewModel6Q,
}
