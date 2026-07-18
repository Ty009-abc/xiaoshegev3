/**
 * utils/reportNormalizerV4.js
 *
 * 唯一 V4 报告前端适配器。
 * 
 * 职责:
 *   1. 解包云函数返回（兼容多层嵌套）
 *   2. 转换 Report Contract → ViewModel
 *   3. 映射 ViewModel → Poster 数据
 *
 * 禁止在 report-detail / report-preview 中复制此逻辑。
 */
'use strict'

/**
 * 解包云函数返回 — 兼容多种嵌套格式
 *
 * 支持:
 *   { code:0, data:{ report:{...}, legacy:{...}, ... } }
 *   { result:{ code:0, data:{...} } }              — wx.cloud.callFunction 包装
 *   { report:{...}, renderSource, ... }            — 缓存读取 content 直接
 *   { content:{ report:{...}, legacy:{...} } }     — db 存储 content
 */
function normalizeDiagnosticV4Response(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'EMPTY_RESPONSE' }

  // 1. wx.cloud.callFunction 包装: raw.result → raw.result.data
  let inner = raw
  if (raw.result && typeof raw.result === 'object') {
    inner = raw.result
  }
  if (inner.data && typeof inner.data === 'object') {
    inner = inner.data
  }

  // 2. 已经是 Report Contract V4 的 content 直接
  //    reportType === 'diagnostic_v4' 在顶层
  if (inner.reportType === 'diagnostic_v4' && inner.report) {
    return buildOk(inner)
  }

  // 3. DB 存储: { content: { report, legacy, ... } }
  if (inner.content && inner.content.report) {
    const content = inner.content
    return buildOk({
      reportId: inner.reportId || content.reportId,
      reportType: inner.reportType || content.reportType || 'diagnostic_v4',
      diagnosticVersion: inner.diagnosticVersion || content.diagnosticVersion || 'v4',
      engineVersion: inner.engineVersion || content.engineVersion || 'v4',
      renderSource: inner.renderSource || content.renderSource || 'unknown',
      report: content.report,
      legacy: content.legacy,
    })
  }

  // 4. legacy-only: V3 格式
  if (inner.legacy && !inner.report) {
    return { ok: false, error: 'V3_RESPONSE', data: inner }
  }

  if (!inner.report) {
    return { ok: false, error: 'NO_REPORT', data: inner }
  }

  return buildOk(inner)
}

function buildOk(d) {
  return {
    ok: true,
    data: {
      reportId: d.reportId || '',
      reportType: d.reportType || 'diagnostic_v4',
      diagnosticVersion: d.diagnosticVersion || 'v4',
      engineVersion: d.engineVersion || '',
      renderSource: d.renderSource || 'unknown',
      report: d.report || {},
      legacy: d.legacy || {},
    },
  }
}

/**
 * 转换 Report Contract → 前端 ViewModel
 */
function buildDiagnosticV4ViewModel(report) {
  const h = report.headline || {}
  const sc = report.scoreCard || {}
  const fd = report.fatalDiagnosis || {}
  const frs = report.fatalRules || []
  const ars = report.advantageRules || []
  const ors = report.opportunityRules || []
  const wps = report.wealthPath || []
  const ap = report.actionPlan || {}
  const sd = report.stopDoing || {}
  const iu = report.identityUpgrade || {}
  const wp = report.wealthProbability || {}
  const fs = report.finalStrike || {}

  return {
    reportId: report.reportId || '',
    reportType: 'diagnostic_v4',
    reportVersion: report.diagnosticVersion || 'v4',
    renderSource: report.renderSource || 'unknown',
    wealthStage: report.wealthStage || '',

    hero: {
      title: h.title || '',
      subtitle: h.subtitle || '',
      severity: fd.severity || 'moderate',
      wealthStage: report.wealthStage || '',
    },

    identity: {
      current: iu.currentIdentity || '',
      target: iu.targetIdentity || '',
      gap: iu.gap || '',
      upgradePath: iu.upgradePath || '',
    },

    scoreCard: [
      { key: 'cashflow',    label: '现金流',     value: sc.cashflow    || 0 },
      { key: 'skill',       label: '能力商品化',  value: sc.skill       || 0 },
      { key: 'execution',   label: '执行力',      value: sc.execution   || 0 },
      { key: 'time',        label: '时间容量',    value: sc.time        || 0 },
      { key: 'risk',        label: '风险承受',    value: sc.risk        || 0 },
    ],

    fatalDiagnosis: {
      mainProblem: fd.mainProblem || '',
      reason: fd.reason || '',
      confidence: fd.confidence || 0,
      evidenceRules: (fd.evidenceRules || frs.slice(0, 3)).map(r => ({
        ruleId: r.ruleId || '',
        title: r.title || '',
        description: r.description || '',
        why: r.why || '',
      })),
    },

    systemLeaks: frs.slice(0, 3).map(r => ({
      ruleId: r.ruleId || '',
      title: r.title || '',
      description: r.description || '',
      why: r.why || '',
      confidence: confidenceLabel(r.weight || 0),
    })),

    advantages: ars.map(r => ({
      ruleId: r.ruleId || '',
      title: r.title || '',
      description: r.description || '',
    })),

    opportunities: ors.map(r => ({
      ruleId: r.ruleId || '',
      title: r.title || '',
      description: r.description || '',
    })),

    wealthPaths: wps.map(p => {
      const pathKey = p.name || p.key || ''
      return {
        key: pathKey,
        name: translateWealthPath(pathKey),
        recommend: p.recommend || 'not_evaluated',
        recommendLabel: recommendLabel(p.recommend),
        score: p.score || 0,
        reason: p.reason || '',
      }
    }),

    stopDoing: (sd.items || []).slice(0, 5),

    actionTimeline: [
      buildDayEntry('DAY 1', ap.day1),
      buildDayEntry('DAY 3', ap.day3),
      buildDayEntry('DAY 7', ap.day7),
      buildDayEntry('DAY 15', ap.day15),
      buildDayEntry('DAY 30', ap.day30),
    ],

    probabilities: {
      today: wp.today || 0,
      after30: wp.after30 || 0,
      after90: wp.after90 || 0,
      after365: wp.after365 || 0,
    },

    finalStrike: {
      sentence: fs.sentence || '',
      shareTitle: fs.shareTitle || '',
    },
  }
}

/**
 * 映射 ViewModel → 海报5块数据
 */
function mapDiagnosticV4ToPoster(vm) {
  const bestPath = [...vm.wealthPaths].sort((a, b) => b.score - a.score)[0]
  return {
    fatalSentence: vm.hero.title || '',
    coreProblem: vm.fatalDiagnosis.reason || vm.fatalDiagnosis.mainProblem || '',
    systemTrap: vm.systemLeaks.map(r => `${r.title}: ${r.description}`).join(' | '),
    strategyPath: bestPath
      ? `${bestPath.name} (${bestPath.recommendLabel}) — ${bestPath.reason}`
      : '',
    advice: [
      buildDaySummary(vm.actionTimeline[0]),  // DAY 1
      buildDaySummary(vm.actionTimeline[2]),  // DAY 7
      buildDaySummary(vm.actionTimeline[4]),  // DAY 30
    ].filter(Boolean),
  }
}

// ══════════════════════════════════════
// Helpers
// ══════════════════════════════════════

const WEALTH_PATH_LABELS = {
  working: '继续打工',
  sideBusiness: '副业',
  freelance: '自由职业',
  investment: '投资',
  content: '内容/IP',
  ai: 'AI工具',
  entrepreneur: '创业',
}

function translateWealthPath(key) {
  return WEALTH_PATH_LABELS[key] || key
}

const RECOMMEND_LABELS = {
  strongly_recommended: '强烈建议',
  recommended: '适合测试',
  cautious: '谨慎尝试',
  not_recommended: '暂不建议',
  not_evaluated: '未评估',
}

function recommendLabel(rc) {
  return RECOMMEND_LABELS[rc] || rc
}

function confidenceLabel(weight) {
  if (typeof weight !== 'number') return '中等置信'
  if (weight >= 80) return '高置信'
  if (weight >= 50) return '中等置信'
  return '低置信'
}

function buildDayEntry(label, day) {
  if (!day) return { day: label, goal: '', tasks: [], checkpoint: '' }
  let tasks = Array.isArray(day.tasks) ? day.tasks : []
  if (tasks.length > 3) tasks = tasks.slice(0, 3)
  return {
    day: label,
    goal: day.goal || '',
    tasks: tasks.filter(Boolean),
    checkpoint: day.checkpoint || '',
  }
}

function buildDaySummary(day) {
  if (!day || !day.goal) return ''
  const tasks = (day.tasks || []).slice(0, 2).join('→')
  return `${day.day}: ${day.goal}${tasks ? ' — ' + tasks : ''}`
}

module.exports = {
  normalizeDiagnosticV4Response,
  buildDiagnosticV4ViewModel,
  mapDiagnosticV4ToPoster,
}
