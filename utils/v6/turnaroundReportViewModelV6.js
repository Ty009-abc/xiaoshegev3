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
 * R38 — ONE FINAL PRESENTATION AUTHORITY per card. The backend emits several
 * internal fields per card (aggregate `text`, plus structured fields). The
 * client must render EACH semantic idea exactly once — never an aggregate
 * `body` AND the structured block it was built from.
 *
 *   CARD01 fatalInsight     title + oneLiner          (no duplicate body)
 *   CARD02 coreProblem      title + body
 *   CARD03 systemLoop       title + loopNodes + finalInsight  (NO body)
 *   CARD04 turnaroundPath   title + from + to + worldRule     (NO body/logic)
 *   CARD05 firstAction      title + primaryAction + target/timebox
 *                                  + signal + decision       (NO legacy checks)
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
const CONFLICT_TITLE = '有两处信息对不上'
const CONFLICT_BODY = '你前面的两处回答有点对不上：一处显示这项能力还没有成交，另一处显示你已经有过付费结果。确认一下这两处后，我才能继续给你策略。'

const CARD_TITLE_FALLBACK = {
  fatalInsight: '致命一句话',
  coreProblem: '核心问题',
  systemLoop: '系统困局',
  turnaroundPath: '翻身路径',
  firstAction: '现在就做',
}

function str (v) { return typeof v === 'string' ? v : '' }
function arr (v) { return Array.isArray(v) ? v.slice() : [] }

/**
 * Build the ORDERED five-card list, each with exactly ONE presentation schema.
 * Cards with no renderable authoritative content are dropped.
 * @param {Object} cards backend report.cards
 * @returns {Array<Object>}
 */
function buildCardListV6 (cards) {
  const out = []
  if (!cards || typeof cards !== 'object') return out

  // 01 — 致命一句话 : oneLiner (the whole card, no separate body).
  if (cards.fatalInsight) {
    const oneLiner = str(cards.fatalInsight.text)
    if (oneLiner) {
      out.push({ key: 'fatalInsight', title: str(cards.fatalInsight.title) || CARD_TITLE_FALLBACK.fatalInsight, oneLiner: oneLiner })
    }
  }

  // 02 — 核心问题 : body (single paragraph). Never re-render as bullets.
  if (cards.coreProblem) {
    const body = str(cards.coreProblem.text)
    if (body) {
      out.push({ key: 'coreProblem', title: str(cards.coreProblem.title) || CARD_TITLE_FALLBACK.coreProblem, body: body })
    }
  }

  // 03 — 系统困局 : loopNodes (4–5) + one finalInsight. NO body paragraph.
  if (cards.systemLoop) {
    const loopNodes = arr(cards.systemLoop.steps)
    const finalInsight = str(cards.systemLoop.insight)
    if (loopNodes.length || finalInsight) {
      out.push({
        key: 'systemLoop',
        title: str(cards.systemLoop.title) || CARD_TITLE_FALLBACK.systemLoop,
        loopNodes: loopNodes,
        finalInsight: finalInsight,
      })
    }
  }

  // 04 — 翻身路径 : from → to + one worldRule sentence. NO duplicate paragraph.
  if (cards.turnaroundPath) {
    const from = str(cards.turnaroundPath.from)
    const to = str(cards.turnaroundPath.to)
    const worldRule = str(cards.turnaroundPath.worldRuleLine)
    if (from || to || worldRule) {
      out.push({
        key: 'turnaroundPath',
        title: str(cards.turnaroundPath.title) || CARD_TITLE_FALLBACK.turnaroundPath,
        from: from,
        to: to,
        worldRule: worldRule,
        // R44 §16 — additive strategy specificity (empty for the 9Q path).
        specificity: str(cards.turnaroundPath.specificity),
      })
    }
  }

  // 05 — 现在就做 : TWO layouts, mutually exclusive.
  //   (a) R75 compressed layer — when the v4_restored path exposes `visible`:
  //       90天目标 + ACTION 1/2/3 + 验收标准 (no duplicate constraint lines).
  //   (b) legacy deterministic layout — UNCHANGED R38 contract:
  //       primaryAction + target/timebox + signal + decision.
  // The legacy `checks` bullets / aggregate `text` are NEVER rendered.
  if (cards.firstAction) {
    const vis = cards.firstAction.visible && typeof cards.firstAction.visible === 'object' ? cards.firstAction.visible : null
    const title = str(cards.firstAction.title) || CARD_TITLE_FALLBACK.firstAction
    if (vis && (str(vis.goal) || arr(vis.actions).length || str(vis.acceptance))) {
      // (a) R75/R84-A compressed five-card layer (v4_restored path).
      // R84-A — actions expose a Chinese MICRO-HEADING; `actionItems` is the
      // structure the client renders. The legacy string `actions` is kept for
      // backward compatibility (and is the source of `actionItems` titles).
      const rawItems = arr(vis.actionItems).length ? arr(vis.actionItems) : []
      const actionItems = rawItems.map((it, i) => {
        const o = (it && typeof it === 'object') ? it : {}
        const t = str(o.title)
        const x = str(o.text) || str(o.action) || str(vis.actions[i]) || ''
        return { title: t, text: x }
      }).filter((it) => it.title || it.text)
      const fallbackItems = actionItems.length ? actionItems : arr(vis.actions).map((s) => ({ title: '', text: str(s) })).filter((it) => it.text)
      out.push({
        key: 'firstAction',
        title: title,
        goal: str(vis.goal),
        actions: arr(vis.actions),
        actionItems: fallbackItems,
        acceptance: str(vis.acceptance),
      })
    } else {
      // (b) legacy deterministic layout (R38 §6/§7 authority) — unchanged.
      const primaryAction = str(cards.firstAction.action)
      if (primaryAction) {
        out.push({
          key: 'firstAction',
          title: title,
          primaryAction: primaryAction,
          target: str(cards.firstAction.verifyWith) || str(cards.firstAction.target),
          timebox: str(cards.firstAction.timebox),
          signal: str(cards.firstAction.done),
          decision: str(cards.firstAction.decision),
          specificity: str(cards.firstAction.specificity),
        })
      }
    }
  }

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
    return { uiState: 'INVALID_INPUT', hasReport: false, cards: [], message: RETAKE_MESSAGE, retake: true, conflict: null }
  }

  // R48 §5 — EVIDENCE_CONFLICT: dedicated lightweight conflict state.
  // NEVER the five cards, NEVER the generic "暂时无法生成翻身策略" message.
  // Only the review metadata (fields + screens) is surfaced; internal ids
  // (VALIDATION_GAP / REPEATABILITY_GAP / STAGE_TESTING) are NEVER exposed.
  if (state === 'EVIDENCE_CONFLICT') {
    const c = data.conflict || {}
    return {
      uiState: 'EVIDENCE_CONFLICT',
      hasReport: false,
      cards: [],
      title: CONFLICT_TITLE,
      message: CONFLICT_BODY,
      retake: false,
      ctas: [
        { id: 'review', label: '返回确认', primary: true },
        { id: 'back', label: '返回', primary: false },
      ],
      conflict: {
        conflictingFields: Array.isArray(c.conflictingFields) ? c.conflictingFields.slice() : [],
        recommendedReviewScreens: Array.isArray(c.recommendedReviewScreens) ? c.recommendedReviewScreens.slice() : [],
      },
    }
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
      conflict: null,
    }
  }

  // V6 not enabled / unavailable (e.g. production MODE != ON for this account),
  // or a non-shippable fallback. Never surface engineering detail.
  return { uiState: 'UNAVAILABLE', hasReport: false, cards: [], message: NO_REPORT_MESSAGE, retake: true, conflict: null }
}

module.exports = {
  RETRY_MESSAGE,
  RETAKE_MESSAGE,
  NO_REPORT_MESSAGE,
  CONFLICT_TITLE,
  CONFLICT_BODY,
  CARD_TITLE_FALLBACK,
  buildCardListV6,
  buildTurnaroundReportViewModelV6,
}
