'use strict'
/**
 * utils/turnaround6q/turnaround6qReportViewModel.js
 *
 * RC8.8 — client view model for the 6Q five-card report (presentation ONLY).
 *
 * FROZEN_REFERENCE (Stage2 §2): this belongs to the FROZEN RC8.8 hybrid
 * experiment line. It is preserved verbatim and is NOT in the revived legacy 6Q
 * primary path. The revival uses utils/legacy6q/legacy6qReportViewModel.js.
 *
 * §7 mapping (CURRENT user-facing five-card ordering):
 *   CARD01 fatalInsight     ← fatal_sentence
 *   CARD02 coreProblem      ← core_problem
 *   CARD03 systemLoop       ← system_trap
 *   CARD04 turnaroundPath   ← strategy_path
 *   CARD05 firstAction      ← advice[]
 *
 * @version turnaround_strategy_6q_v1 (client view model)
 */

const RETRY_MESSAGE = '暂时无法生成翻身策略，请稍后重试。'
const RETAKE_MESSAGE = '问卷数据不完整，请重新测评。'
const NO_REPORT_MESSAGE = '暂时无法生成翻身策略，请稍后重试。'

const CARD_TITLE_FALLBACK = {
  fatalInsight: '致命一句话',
  coreProblem: '核心问题',
  systemLoop: '系统困局',
  turnaroundPath: '翻身路径',
  firstAction: '行动建议',
}

function str (v) { return typeof v === 'string' ? v : '' }
function arr (v) { return Array.isArray(v) ? v.slice() : [] }

/**
 * Split a body into IDENTITY (first sentence) + EXPLANATION (remainder) without
 * changing a single character. identity + explanation === body, byte-for-byte.
 */
function splitIdentity (body) {
  const t = str(body)
  if (!t) return { identity: '', explanation: '' }
  const m = t.match(/^[\s\S]*?[。！？!?]/)
  if (!m) return { identity: t, explanation: '' }
  return { identity: m[0].trim(), explanation: t.slice(m[0].length).trim() }
}

function buildCardList6Q (cards) {
  const out = []
  if (!cards || typeof cards !== 'object') return out

  if (cards.fatalInsight) {
    const oneLiner = str(cards.fatalInsight.text)
    if (oneLiner) out.push({ key: 'fatalInsight', title: str(cards.fatalInsight.title) || CARD_TITLE_FALLBACK.fatalInsight, oneLiner })
  }

  if (cards.coreProblem) {
    const body = str(cards.coreProblem.text)
    if (body) {
      const idp = splitIdentity(body)
      out.push({ key: 'coreProblem', title: str(cards.coreProblem.title) || CARD_TITLE_FALLBACK.coreProblem, body, identity: idp.identity, explanation: idp.explanation })
    }
  }

  if (cards.systemLoop) {
    const loopNodes = arr(cards.systemLoop.steps)
    const finalInsight = str(cards.systemLoop.insight)
    if (loopNodes.length || finalInsight) {
      out.push({ key: 'systemLoop', title: str(cards.systemLoop.title) || CARD_TITLE_FALLBACK.systemLoop, loopNodes, finalInsight })
    }
  }

  if (cards.turnaroundPath) {
    const from = str(cards.turnaroundPath.from)
    const to = str(cards.turnaroundPath.to)
    const worldRule = str(cards.turnaroundPath.worldRuleLine)
    if (from || to || worldRule) {
      out.push({
        key: 'turnaroundPath',
        title: str(cards.turnaroundPath.title) || CARD_TITLE_FALLBACK.turnaroundPath,
        from, to, worldRule,
        fromLabel: '现在', toLabel: '接下来', arrow: '→', worldRuleLabel: '底层逻辑',
      })
    }
  }

  if (cards.firstAction) {
    const vis = cards.firstAction.visible && typeof cards.firstAction.visible === 'object' ? cards.firstAction.visible : null
    const title = str(cards.firstAction.title) || CARD_TITLE_FALLBACK.firstAction
    if (vis && (str(vis.goal) || arr(vis.actions).length || str(vis.acceptance))) {
      const rawItems = arr(vis.actionItems).length ? arr(vis.actionItems) : []
      const actionItems = rawItems.map((it, i) => {
        const o = (it && typeof it === 'object') ? it : {}
        const t = str(o.title)
        const x = str(o.text) || str(o.action) || str(vis.actions[i]) || ''
        return { title: t, text: x }
      }).filter((it) => it.title || it.text)
      const fallbackItems = actionItems.length ? actionItems : arr(vis.actions).map((s) => ({ title: '', text: str(s) })).filter((it) => it.text)
      const indexedItems = fallbackItems.map((it, i) => ({ index: i + 1, label: '行动' + (i + 1), title: it.title, text: it.text }))
      out.push({
        key: 'firstAction',
        title,
        goal: str(vis.goal),
        goalLabel: '本次目标',
        actions: arr(vis.actions),
        actionItems: indexedItems,
        target: str(vis.target),
        targetLabel: '对象',
        output: str(vis.output),
        outputLabel: '产出',
        acceptance: str(vis.acceptance),
        acceptLabel: '验证信号',
        timebox: str(vis.timebox),
        timeboxLabel: '期限',
      })
    } else {
      const primaryAction = str(cards.firstAction.action)
      if (primaryAction) {
        out.push({
          key: 'firstAction',
          title,
          primaryAction,
          target: str(cards.firstAction.verifyWith) || str(cards.firstAction.target),
          timebox: str(cards.firstAction.timebox),
          signal: str(cards.firstAction.done),
          decision: str(cards.firstAction.decision),
        })
      }
    }
  }

  return out
}

function buildTurnaroundReportViewModel6Q (result) {
  if (!result || typeof result !== 'object' || !result.data || typeof result.data !== 'object') {
    return { uiState: 'ERROR', hasReport: false, cards: [], message: RETRY_MESSAGE, retake: true }
  }
  const data = result.data
  if (data.reportState === 'INVALID_INPUT') {
    return { uiState: 'INVALID_INPUT', hasReport: false, cards: [], message: RETAKE_MESSAGE, retake: true }
  }
  const cards = buildCardList6Q(data.cards)
  const active = data.primaryActive === true || data.reportState === 'PRIMARY'
  if (active && cards.length > 0) {
    return { uiState: 'PRIMARY', hasReport: true, cards, message: '', retake: true }
  }
  return { uiState: 'UNAVAILABLE', hasReport: false, cards: [], message: NO_REPORT_MESSAGE, retake: true }
}

module.exports = {
  RETRY_MESSAGE,
  RETAKE_MESSAGE,
  NO_REPORT_MESSAGE,
  CARD_TITLE_FALLBACK,
  buildCardList6Q,
  buildTurnaroundReportViewModel6Q,
}
