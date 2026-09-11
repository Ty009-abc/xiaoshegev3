'use strict'
/**
 * turnaroundStrategy/v6/report/reportBuilderV6.js
 *
 * Deterministic V6 five-card report builder.
 *
 * AUTHORITY: consumes diagnoseTurnaroundV6 output ONLY.
 * NEVER performs diagnosis: no eligibility, no selection, no belief inference,
 * no stage inference, no action-type override, no hidden scoring.
 *
 * State handling:
 *   PRIMARY       -> normal 5-card report
 *   NO_PRIMARY    -> valid, cautious result (no invented primary)
 *   INVALID_INPUT -> no cards (cards = null)
 *
 * CONSUMER LAYER ONLY. Deterministic. No AI. No I/O. No network.
 */

const { buildFatalInsight } = require('./fatalInsightV6.js')
const { buildCoreProblem } = require('./coreProblemV6.js')
const { buildSystemLoop } = require('./systemLoopV6.js')
const { buildTurnaroundPath } = require('./turnaroundPathV6.js')
const { buildFirstAction } = require('./firstActionCopyV6.js')
const copy = require('./reportCopyV6.js')

const REPORT_VERSION = 'turnaround_strategy_v6_report_v1'

/**
 * @param {Object} diagnosis diagnoseTurnaroundV6 output
 * @returns {Object} report
 */
function buildReportV6 (diagnosis) {
  if (!diagnosis || typeof diagnosis !== 'object') {
    return invalidReport()
  }

  switch (diagnosis.diagnosisState) {
    case 'INVALID_INPUT':
      return invalidReport(diagnosis)
    case 'NO_PRIMARY':
      return noPrimaryReport(diagnosis)
    case 'PRIMARY':
      return primaryReport(diagnosis)
    default:
      return invalidReport(diagnosis)
  }
}

// ── PRIMARY: full 5-card report ──────────────────────────────────
function primaryReport (r) {
  const fatal = buildFatalInsight(r)
  const core = buildCoreProblem(r)
  const loop = buildSystemLoop(r)
  const path = buildTurnaroundPath(r)
  const action = buildFirstAction(r)

  const cards = {
    fatalInsight: { title: '致命一句话', text: fatal.text, provenance: fatal.provenance },
    coreProblem: { title: '核心问题', text: core.text, provenance: core.provenance },
    systemLoop: { title: '系统困局', steps: loop.steps, text: loop.text, provenance: loop.provenance },
    turnaroundPath: { title: '翻身路径', from: path.from, to: path.to, text: path.text, provenance: path.provenance },
    firstAction: { title: '现在就做', action: action.action, checks: action.checks, text: action.text, provenance: action.provenance }
  }

  return {
    reportVersion: REPORT_VERSION,
    reportState: 'PRIMARY',
    cards,
    provenance: {
      contractVersion: r.contractVersion,
      diagnosisState: r.diagnosisState,
      primaryBottleneck: r.primaryBottleneck,
      executionStage: r.executionStage,
      beliefRelation: r.beliefRelation.relation,
      realityConstraintTypes: r.realityConstraint.types,
      selectedRuleId: r.trace.selectedRuleId,
      beliefRuleId: r.beliefRelation.explanationRuleId,
      sourceQuestionIds: r.trace.sourceQuestionIds
    }
  }
}

// ── NO_PRIMARY: valid but cautious ───────────────────────────────
function noPrimaryReport (r) {
  const stage = r.executionStage
  const q7 = r.profile.behavior.uncertaintyResponse

  const lead = '你的回答里还没有出现一个足够强的单一瓶颈。'
  const stageLine = `从你现在的状态看——${copy.getStageNow(stage)}，这本身就是一个可以往前推的起点。`
  const behaviorLine = `不确定的时候，你会${copy.getQ7(q7)}；这一轮先不急着给自己下结论。`
  const nextLine = '先用一个小动作换来一次真实反馈，再根据反馈决定往哪走。'

  // A cautious, generic-but-grounded next step derived from stage only.
  const actionByStage = {
    THINKING: '今天先把手上最想做的方向用一句话写清楚。',
    RESEARCHING: '今天先停下继续查资料，选一个方向写下一个最小验证动作。',
    LEARNING: '今天先不学新的，把已经会的做成一个最小结果。',
    STARTED: '今天先定一个每天固定的时段，把这件事连续做5天。',
    TESTING: '今天先找3个真实用户，问清楚他们为什么不买。',
    EARLY_TRACTION: '今天先把最近一次成交的每一步写下来。',
    STABLE_TRACTION: '今天先把已经跑通的步骤整理成一份可重复的清单。'
  }

  const cards = {
    fatalInsight: { title: '先说结论', text: lead, provenance: noProv(r, ['Q5', 'Q6', 'Q7']) },
    coreProblem: { title: '现在的情况', text: `${stageLine}${behaviorLine}`, provenance: noProv(r, ['Q6', 'Q7']) },
    systemLoop: { title: '为什么还没定论', steps: [lead, `${copy.getStageNow(stage)}。`, '多种原因同时存在，暂时分不出主次。', nextLine], text: [lead, `${copy.getStageNow(stage)}。`, '多种原因同时存在，暂时分不出主次。', nextLine].join('\n'), provenance: noProv(r, ['Q6']) },
    turnaroundPath: { title: '往哪走', from: '还没有单一瓶颈', to: nextLine, text: `现在：还没有单一瓶颈。\n接下来：${nextLine}`, provenance: noProv(r, ['Q6']) },
    firstAction: { title: '现在就做', action: actionByStage[stage] || '今天先做一件能在一天内完成的小事。', checks: [], text: actionByStage[stage] || '今天先做一件能在一天内完成的小事。', provenance: noProv(r, ['Q6']) }
  }

  return {
    reportVersion: REPORT_VERSION,
    reportState: 'NO_PRIMARY',
    cards,
    provenance: {
      contractVersion: r.contractVersion,
      diagnosisState: r.diagnosisState,
      primaryBottleneck: null,
      executionStage: r.executionStage,
      beliefRelation: r.beliefRelation.relation,
      realityConstraintTypes: r.realityConstraint.types,
      selectedRuleId: null,
      beliefRuleId: r.beliefRelation.explanationRuleId,
      sourceQuestionIds: r.trace ? r.trace.sourceQuestionIds : []
    }
  }
}

function noProv (r, qids) {
  return {
    sourceFields: [],
    sourceQuestionIds: qids,
    sourceRuleIds: []
  }
}

// ── INVALID_INPUT: no cards ──────────────────────────────────────
function invalidReport (r) {
  return {
    reportVersion: REPORT_VERSION,
    reportState: 'INVALID_INPUT',
    cards: null,
    provenance: {
      contractVersion: r ? r.contractVersion : null,
      diagnosisState: 'INVALID_INPUT',
      inputErrors: r ? r.inputErrors : null
    }
  }
}

module.exports = { buildReportV6, REPORT_VERSION }
