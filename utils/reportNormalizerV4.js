/**
 * utils/reportNormalizerV4.js (v5.0 — UI Bugfix Edition)
 *
 * 唯一 V4 报告前端适配器。
 *
 * v5.0 变更:
 *   - 统一枚举映射：所有 recommend/status 转为中文+icon，不再泄漏内部枚举
 *   - wealthPath 字段兼容：支持 name/title/label/pathName 等12种字段名
 *   - 主路径计算：primaryWealthPath 规则（最高分 highly_recommended）
 *   - 证据链：每条路径展示 reasons/risks
 *   - 评分卡增强：每维增加等级标签+解释
 *   - 财富阶段中文映射
 *   - identity 升级路径字符串→数组分拆
 *   - 全线 undefined/null/NaN 防护
 *   - 内置 leak scanner
 *
 * 禁止在 report-detail / report-preview 中复制此逻辑。
 */
'use strict'

/* ═══════════════════════════════════════════════════════════════
   统一枚举映射
   ═══════════════════════════════════════════════════════════════ */

const RECOMMEND_STATUS_MAP = {
  highly_recommended:    { label: '强烈建议', shortLabel: '首选',     level: 'strong',  icon: '🔥' },
  strongly_recommended:  { label: '强烈建议', shortLabel: '首选',     level: 'strong',  icon: '🔥' },
  recommended:           { label: '推荐',     shortLabel: '推荐',     level: 'recommended', icon: '✅' },
  suitable_for_test:     { label: '适合小步测试', shortLabel: '可测试', level: 'test', icon: '🧪' },
  neutral:               { label: '条件一般', shortLabel: '谨慎评估', level: 'neutral', icon: '⚖️' },
  cautious:              { label: '谨慎选择', shortLabel: '谨慎',     level: 'caution', icon: '⚠️' },
  not_recommended:       { label: '暂不建议', shortLabel: '不建议',   level: 'blocked', icon: '🚫' },
  not_evaluated:         { label: '尚未评估', shortLabel: '待评估',   level: 'unknown', icon: '—' },
}

function getRecommendStatus(rc) {
  if (!rc || typeof rc !== 'string') return RECOMMEND_STATUS_MAP['not_evaluated']
  return RECOMMEND_STATUS_MAP[rc] || RECOMMEND_STATUS_MAP['not_evaluated']
}

const WEALTH_PATH_LABELS = {
  working: '继续打工',
  sidebusiness: '副业',
  freelance: '自由职业',
  investment: '投资',
  content: '内容/IP',
  ai: 'AI工具',
  entrepreneur: '创业',
}

function translateWealthPath(key) {
  if (!key) return '路径方案'
  return WEALTH_PATH_LABELS[key.toLowerCase()] || key
}

const WEALTH_STAGE_LABELS = {
  survival: '生存修复期',
  accumulation: '积累验证期',
  growth: '增长放大期',
  system_builder: '系统建设期',
  asset_owner: '资产积累期',
  freedom: '复利发展期',
}

function translateWealthStage(stage) {
  if (!stage) return '待确认阶段'
  const s = String(stage).toLowerCase()
  return WEALTH_STAGE_LABELS[s] || s
}

const SCORE_GRADE_MAP = [
  { min: 0,  max: 39, label: '危险', level: 'danger' },
  { min: 40, max: 59, label: '偏弱', level: 'weak' },
  { min: 60, max: 74, label: '可用', level: 'normal' },
  { min: 75, max: 89, label: '较强', level: 'strong' },
  { min: 90, max: 100,label: '优势', level: 'excellent' },
]

function getScoreGrade(value) {
  const v = toSafeNumber(value, 0)
  for (const g of SCORE_GRADE_MAP) {
    if (v >= g.min && v <= g.max) return { label: g.label, level: g.level }
  }
  return { label: '待评估', level: 'unknown' }
}

/* ═══════════════════════════════════════════════════════════════
   安全工具
   ═══════════════════════════════════════════════════════════════ */

function toSafeNumber(v, fallback) {
  if (v === null || v === undefined) return fallback
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

function toSafeString(v, fallback) {
  if (v === null || v === undefined) return fallback
  if (typeof v === 'string') return v.trim() || fallback
  if (typeof v === 'object') return fallback
  return String(v) || fallback
}

function toSafeArray(v) {
  if (!Array.isArray(v)) return []
  return v.filter(function(item) {
    return item !== null && item !== undefined && item !== ''
  })
}

function isSafeText(v) {
  if (v === null || v === undefined || v === '') return false
  if (typeof v !== 'string') return false
  if (v === 'undefined' || v === 'null' || v === 'NaN' || v === '[object Object]') return false
  return true
}

/* ═══════════════════════════════════════════════════════════════
   解包云函数返回
   ═══════════════════════════════════════════════════════════════ */

function normalizeDiagnosticV4Response(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'EMPTY_RESPONSE' }

  let inner = raw
  if (raw.result && typeof raw.result === 'object') {
    inner = raw.result
  }
  if (inner.data && typeof inner.data === 'object') {
    inner = inner.data
  }

  if (inner.reportType === 'diagnostic_v4' && inner.report) {
    return buildOk(inner)
  }

  if (inner.content && inner.content.report) {
    var content = inner.content
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

/* ═══════════════════════════════════════════════════════════════
   wealthPath 字段兼容 + 规范化
   ═══════════════════════════════════════════════════════════════ */

function normalizeWealthPath(rawPath, index) {
  // 名称
  var name = rawPath.name || rawPath.title || rawPath.label ||
    rawPath.pathName || rawPath.displayName || rawPath.type || ''
  if (!name) name = rawPath.key || ''
  if (!name) name = '路径方案 ' + (index + 1)

  // 推荐状态
  var recommend = rawPath.recommend || rawPath.recommendation ||
    rawPath.status || rawPath.recommendStatus || rawPath.recommendLevel ||
    'not_evaluated'
  var status = getRecommendStatus(recommend)

  // 分数
  var score = toSafeNumber(rawPath.score || rawPath.fitScore || rawPath.matchScore || rawPath.probability || rawPath.value || 0, 0)

  // 描述
  var description = rawPath.reason || rawPath.description || rawPath.summary ||
    rawPath.why || rawPath.explanation || ''
  if (!isSafeText(description) && status.level === 'blocked') {
    description = '当前数据不足，暂时无法形成完整判断。'
  }

  // 正向证据 (reasons / evidence / advantages)
  var rawReasons = rawPath.reasons || rawPath.evidence || rawPath.advantages || rawPath.whyRecommended || []
  var reasons = toSafeArray(rawReasons).map(function(r) {
    if (typeof r === 'string') return r
    if (r && typeof r === 'object') return r.text || r.title || ''
    return ''
  }).filter(isSafeText).slice(0, 2)

  // 限制因素 (risks / warnings / disadvantages)
  var rawRisks = rawPath.risks || rawPath.warnings || rawPath.disadvantages || rawPath.whyNot || []
  var risks = toSafeArray(rawRisks).map(function(r) {
    if (typeof r === 'string') return r
    if (r && typeof r === 'object') return r.text || r.title || ''
    return ''
  }).filter(isSafeText).slice(0, 2)

  return {
    key: rawPath.name || rawPath.key || ('path_' + index),
    name: translateWealthPath(name),
    score: score,
    recommend: recommend,
    recommendLabel: status.label,
    recommendShortLabel: status.shortLabel,
    statusLabel: status.label,
    shortStatusLabel: status.shortLabel,
    statusLevel: status.level,
    statusIcon: status.icon,
    description: description,
    reasons: reasons,
    risks: risks,
    isBlocked: status.level === 'blocked',
    isPrimary: false,
  }
}

/* ═══════════════════════════════════════════════════════════════
   主路径选择
   ═══════════════════════════════════════════════════════════════ */

function computePrimaryPath(paths) {
  if (!paths.length) return

  // 1. 筛选非 blocked 路径
  var candidates = paths.filter(function(p) { return !p.isBlocked })

  // 2. 优先 highly_recommended
  var highly = candidates.filter(function(p) { return p.recommend === 'highly_recommended' || p.recommend === 'strongly_recommended' })
  var pool = highly.length > 0 ? highly : candidates

  if (pool.length === 0) {
    // 全部 blocked
    return
  }

  // 3. 选最高分
  pool.sort(function(a, b) { return b.score - a.score })
  pool[0].isPrimary = true
}

/* ═══════════════════════════════════════════════════════════════
   评分卡增强
   ═══════════════════════════════════════════════════════════════ */

const SCORE_DIMENSION_EXPLANATIONS = {
  cashflow: '反映结余、安全垫和负债对试错空间的影响。',
  skill: '反映现有能力是否已经被市场付费验证。',
  execution: '反映计划能否持续推进到成交阶段。',
  time: '反映每周可用于验证新收入路径的时间。',
  risk: '反映失败后是否仍能维持基本生活和继续试错。',
}

function normalizeScoreCard(scoreCard) {
  return [
    { key: 'cashflow',  label: '现金流',     value: toSafeNumber(scoreCard.cashflow, 0), grade: getScoreGrade(scoreCard.cashflow), explanation: SCORE_DIMENSION_EXPLANATIONS.cashflow },
    { key: 'skill',     label: '能力商品化', value: toSafeNumber(scoreCard.skill, 0),     grade: getScoreGrade(scoreCard.skill),     explanation: SCORE_DIMENSION_EXPLANATIONS.skill },
    { key: 'execution', label: '执行力',     value: toSafeNumber(scoreCard.execution, 0), grade: getScoreGrade(scoreCard.execution), explanation: SCORE_DIMENSION_EXPLANATIONS.execution },
    { key: 'time',      label: '时间容量',   value: toSafeNumber(scoreCard.time, 0),      grade: getScoreGrade(scoreCard.time),      explanation: SCORE_DIMENSION_EXPLANATIONS.time },
    { key: 'risk',      label: '风险承受',   value: toSafeNumber(scoreCard.risk, 0),      grade: getScoreGrade(scoreCard.risk),      explanation: SCORE_DIMENSION_EXPLANATIONS.risk },
  ]
}

/* ═══════════════════════════════════════════════════════════════
   identity 升级路径分拆
   ═══════════════════════════════════════════════════════════════ */

function splitUpgradePath(pathStr) {
  if (!pathStr) return []
  var str = String(pathStr)
  // 按 → / -> / > / → 拆分
  var parts = str.split(/\s*(?:→|->|→|>|—>\s*)\s*/)
  return parts.map(function(s) { return s.trim() }).filter(isSafeText)
}

/* ═══════════════════════════════════════════════════════════════
   置信度标签
   ═══════════════════════════════════════════════════════════════ */

function confidenceLabel(weight) {
  if (typeof weight !== 'number') return '中等置信'
  if (weight >= 80) return '高置信'
  if (weight >= 50) return '中等置信'
  return '低置信'
}

/* ═══════════════════════════════════════════════════════════════
   时序条目
   ═══════════════════════════════════════════════════════════════ */

function buildDayEntry(label, day) {
  if (!day) return { day: label, goal: '', tasks: [], checkpoint: '' }
  var tasks = Array.isArray(day.tasks) ? day.tasks : []
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
  var tasks = (day.tasks || []).slice(0, 2).join('→')
  return day.day + ': ' + day.goal + (tasks ? ' — ' + tasks : '')
}

/* ═══════════════════════════════════════════════════════════════
   Builder: Report Contract → ViewModel
   ═══════════════════════════════════════════════════════════════ */

function buildDiagnosticV4ViewModel(report) {
  var h = report.headline || {}
  var sc = report.scoreCard || {}
  var fd = report.fatalDiagnosis || {}
  var frs = report.fatalRules || []
  var ars = report.advantageRules || []
  var ors = report.opportunityRules || []
  var wps = report.wealthPath || []
  var ap = report.actionPlan || {}
  var sd = report.stopDoing || {}
  var iu = report.identityUpgrade || {}
  var wp = report.wealthProbability || {}
  var fs = report.finalStrike || {}

  // ── 财富路径 ──
  var normalizedPaths = wps.map(normalizeWealthPath)
  computePrimaryPath(normalizedPaths)

  var primaryWealthPath = null
  var otherWealthPaths = normalizedPaths
  for (var i = 0; i < normalizedPaths.length; i++) {
    if (normalizedPaths[i].isPrimary) {
      primaryWealthPath = normalizedPaths[i]
      otherWealthPaths = normalizedPaths.filter(function(_, j) { return j !== i })
      break
    }
  }

  // ── 评分卡 ──
  var scoreDimensions = normalizeScoreCard(sc)

  // ── identity 升级路径 ──
  var upgradeSteps = splitUpgradePath(iu.upgradePath)

  var vm = {
    reportId: report.reportId || '',
    reportType: 'diagnostic_v4',
    reportVersion: report.diagnosticVersion || 'v4',
    renderSource: report.renderSource || 'unknown',
    wealthStage: translateWealthStage(report.wealthStage),

    // 01 hero
    hero: {
      title: h.title || '',
      subtitle: h.subtitle || '',
      severity: fd.severity || 'moderate',
      wealthStage: report.wealthStage || 'ACCUMULATION',
      stageLabel: translateWealthStage(report.wealthStage),
    },

    // 02 identity
    identity: {
      current: iu.currentIdentity || '',
      target: iu.targetIdentity || '',
      gap: iu.gap || '',
      upgradePath: splitUpgradePath(iu.upgradePath),
      hasCurrent: !!iu.currentIdentity,
      hasTarget: !!iu.targetIdentity,
      hasGap: !!iu.gap,
      hasPath: (splitUpgradePath(iu.upgradePath)).length > 0,
    },

    // 03 scoreCard
    scoreDimensions: scoreDimensions,
    scoreCard: scoreDimensions, // alias for wx:for

    // 04 systemLeaks
    fatalDiagnosis: {
      mainProblem: fd.mainProblem || '',
      reason: fd.reason || '',
      confidence: fd.confidence || 0,
    },
    systemLeaks: frs.slice(0, 3).map(function(r) {
      return {
        ruleId: r.ruleId || '',
        title: r.title || '',
        description: r.description || '',
        why: r.why || '',
        confidence: confidenceLabel(r.weight || 0),
      }
    }),

    // 05 stopDoing
    stopDoing: (sd.items || []).slice(0, 5).filter(function(s) { return isSafeText(s) }),

    // 06 wealthPaths
    wealthPaths: normalizedPaths,
    primaryWealthPath: primaryWealthPath,
    otherWealthPaths: otherWealthPaths,
    hasPrimaryPath: !!primaryWealthPath,

    // 07 actionTimeline
    actionTimeline: [
      buildDayEntry('DAY 1', ap.day1),
      buildDayEntry('DAY 3', ap.day3),
      buildDayEntry('DAY 7', ap.day7),
      buildDayEntry('DAY 15', ap.day15),
      buildDayEntry('DAY 30', ap.day30),
    ],

    // 08 probabilities
    probabilities: {
      today: toSafeNumber(wp.today, 0),
      after30: toSafeNumber(wp.after30, 0),
      after90: toSafeNumber(wp.after90, 0),
      after365: toSafeNumber(wp.after365, 0),
    },

    // finalStrike
    finalStrike: {
      sentence: fs.sentence || '',
      shareTitle: fs.shareTitle || '',
    },
  }

  // ── leak scan (dev only) ──
  scanViewModelForLeaks(vm)

  return vm
}

/* ═══════════════════════════════════════════════════════════════
   海报映射
   ═══════════════════════════════════════════════════════════════ */

function mapDiagnosticV4ToPoster(vm) {
  var bestPath = vm.primaryWealthPath || (vm.wealthPaths.length > 0 ? vm.wealthPaths[0] : null)
  return {
    fatalSentence: vm.hero.title || '',
    coreProblem: (vm.fatalDiagnosis && vm.fatalDiagnosis.reason) || (vm.fatalDiagnosis && vm.fatalDiagnosis.mainProblem) || '',
    systemTrap: (vm.systemLeaks || []).map(function(r) { return r.title + ': ' + r.description }).join(' | '),
    strategyPath: bestPath
      ? bestPath.name + ' (' + bestPath.statusLabel + ') — ' + bestPath.description
      : '',
    advice: [
      buildDaySummary(vm.actionTimeline[0]),
      buildDaySummary(vm.actionTimeline[2]),
      buildDaySummary(vm.actionTimeline[4]),
    ].filter(Boolean),
  }
}

/* ═══════════════════════════════════════════════════════════════
   Leak Scanner
   ═══════════════════════════════════════════════════════════════ */

const FORBIDDEN_LEAK_WORDS = [
  'undefined', 'null', 'NaN', '[object Object]',
]

function scanViewModelForLeaks(vm) {
  var leaks = []

  function scan(obj, path) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      obj.forEach(function(item, i) { scan(item, path + '[' + i + ']') })
      return
    }
    Object.keys(obj).forEach(function(key) {
      var val = obj[key]
      var fullPath = path ? path + '.' + key : key
      if (typeof val === 'string') {
        if (FORBIDDEN_LEAK_WORDS.indexOf(val) !== -1) {
          leaks.push({ path: fullPath, value: val, type: 'LEAKED_ENUM' })
        }
        if (val === 'undefined' || val === 'null' || val === 'NaN') {
          leaks.push({ path: fullPath, value: val, type: 'STALE_STRING' })
        }
      } else if (val === undefined || val === null || (typeof val === 'number' && Number.isNaN(val))) {
        leaks.push({ path: fullPath, value: String(val), type: 'MISSING_VALUE' })
      } else if (typeof val === 'object') {
        scan(val, fullPath)
      }
    })
  }

  try {
    scan(vm, '')
  } catch (e) {
    leaks.push({ path: 'scan_error', value: e.message, type: 'SCAN_ERROR' })
  }

  if (leaks.length > 0) {
    console.warn('[reportNormalizerV4] ⚠️ VIEWMODEL LEAKS DETECTED:', JSON.stringify(leaks))
  }

  return { leaks: leaks, passed: leaks.length === 0 }
}

/* ═══════════════════════════════════════════════════════════════
   导出
   ═══════════════════════════════════════════════════════════════ */

module.exports = {
  normalizeDiagnosticV4Response,
  buildDiagnosticV4ViewModel,
  mapDiagnosticV4ToPoster,
  normalizeWealthPath,
  getRecommendStatus,
  getScoreGrade,
  translateWealthStage,
  translateWealthPath,
  scanViewModelForLeaks,
}
