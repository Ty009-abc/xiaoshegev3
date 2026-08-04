/**
 * utils/cognitiveVerdictBuilder.js — RC6.0 Cognitive Verdict Builder
 *
 * 职责：基于命运模拟器的输出，生成认知宣判。
 * 禁止空泛鸡汤——statement 必须是具体、可自查、不可异议的判断。
 *
 * @version RC6.0_DESTINY_ENGINE
 */
'use strict'

/* ═══════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════ */

/**
 * buildCognitiveVerdict(reportContext, destinySimulator)
 *
 * @param {Object} reportContext — { scoreCard, fatalRules, advantageRules, ... }
 * @param {Object} destinySimulator — computeDestinySimulator 的输出
 * @returns {Object} cognitiveVerdict
 */
function buildCognitiveVerdict(reportContext, destinySimulator) {
  var ds = destinySimulator || {}
  var context = extractContext(reportContext, ds)

  var statement = pickStatement(context)
  var explanation = pickExplanation(context)
  var actionAnchor = pickActionAnchor(context)
  var shareQuote = statement

  var verdict = {
    title: '认知宣判',
    statement: guardLength(statement, 12, 42),
    explanation: guardLength(explanation, 20, 90),
    actionAnchor: guardLength(actionAnchor, 10, 40),
    shareQuote: guardLength(shareQuote, 12, 42),
  }

  if (!isValid(verdict)) {
    return cognitiveVerdictFallback(context)
  }

  return verdict
}

/**
 * 旧报告兜底 — 当没有 destinySimulator 时最小化宣判
 */
function cognitiveVerdictFallback(context) {
  var ctx = context || {}
  var score = ctx.overallScore || 50

  var statement, explanation, actionAnchor
  if (score >= 70) {
    statement = '你的基础条件良好，但系统化程度决定了你的上限。'
    explanation = '有了良好的起点，下一个进化是把个人能力变成可复制的制度。'
    actionAnchor = '把一项技能变成标准产品。'
  } else if (score >= 40) {
    statement = '你已经具备了翻身的基本条件，但仍缺少一个核心引擎。'
    explanation = '收入和能力在同步积累，但获客和产品化是两个卡点。'
    actionAnchor = '先建立第一条稳定获客路径。'
  } else {
    statement = '你的翻身潜力目前被结构性问题压制。'
    explanation = '当前最重要的不是赚更多钱，而是找到一项可以市场化验证的能力。'
    actionAnchor = '找到一项可出售技能。'
  }

  return {
    title: '认知宣判',
    statement: statement,
    explanation: explanation,
    actionAnchor: actionAnchor,
    shareQuote: statement,
  }
}

/* ═══════════════════════════════════════════════════════════════
   上下文提取
   ═══════════════════════════════════════════════════════════════ */

function extractContext(reportContext, ds) {
  var rc = reportContext || {}
  var sc = rc.scoreCard || {}
  var frs = rc.fatalRules || []
  var ars = rc.advantageRules || []

  return {
    overallScore: sc.overall || ds.currentIndex || 50,
    hasSkillValidation: ds.strengths && ds.strengths.some(function(s) { return (s || '').indexOf('验证') !== -1 }),
    hasStableAcquisition: !(ds.constraints || []).some(function(c) { return (c || '').indexOf('获客') !== -1 }),
    fatalCount: frs.length,
    projectedGain: (ds.actionPath && ds.actionPath.projectedIndex || 0) - (ds.currentIndex || 0),
    currentLevel: (ds.currentLevel || 'medium'),
  }
}

/* ═══════════════════════════════════════════════════════════════
   文案生成
   ═══════════════════════════════════════════════════════════════ */

function pickStatement(context) {
  var score = context.overallScore
  var hasValidation = context.hasSkillValidation
  var fatalCount = context.fatalCount
  var gain = context.projectedGain

  if (hasValidation && gain >= 15) {
    return '你的技能已经值钱，但你的商业模式还不值钱。'
  }
  if (hasValidation && score >= 60) {
    return '你拥有一项高价值资产，但你还在用零售的方式出售。'
  }
  if (!hasValidation && score <= 35) {
    return '你的翻身计划还没有找到市场的支点。'
  }
  if (fatalCount >= 3) {
    return '你的系统正被多个结构性问题同时侵蚀。'
  }
  if (!hasValidation) {
    return '最大的风险不是不够努力，是不够快接触到市场的反馈。'
  }
  if (score >= 70) {
    return '你已经进入系统化阶段，下一步是制度性放大。'
  }
  return '你的翻身条件已在积累，但仍被一个关键缺口限制。'
}

function pickExplanation(context) {
  var hasValidation = context.hasSkillValidation

  if (hasValidation) {
    return '继续出售时间，只能获得线性收入。建立获客和产品系统，能力才会开始复利。能力×系统=翻身的乘数。'
  }
  if (context.overallScore < 40) {
    return '先找到一件你可以独立完成且有人愿意付钱的事。商业世界不承认潜力，只承认成交。'
  }
  return '你的执行力和学习力正在积累，但缺少一个清晰的方向锚点。把能量集中到一条路径上，比分散试错更有效。'
}

function pickActionAnchor(context) {
  var hasValidation = context.hasSkillValidation
  var fatalCount = context.fatalCount

  if (hasValidation) {
    return '未来' + Math.max(30, (context.projectedGain > 15 ? 90 : 60)) + '天，只验证一条稳定获客路径。'
  }
  if (fatalCount >= 3) {
    return '优先修复收入安全垫，再谈增长。'
  }
  return '用30天找到一项可出售技能。'
}

/* ═══════════════════════════════════════════════════════════════
   有效性检测
   ═══════════════════════════════════════════════════════════════ */

var FORBIDDEN_SLOGANS = [
  '相信自己', '未来可期', '坚持就是胜利', '努力终有回报',
  '你是最棒的', '一定会成功', '东山再起', '前程似锦',
]

function isValid(verdict) {
  if (!verdict.statement || verdict.statement.length < 5) return false
  if (!verdict.explanation || verdict.explanation.length < 5) return false
  for (var i = 0; i < FORBIDDEN_SLOGANS.length; i++) {
    if (verdict.statement.indexOf(FORBIDDEN_SLOGANS[i]) !== -1) return false
    if (verdict.explanation.indexOf(FORBIDDEN_SLOGANS[i]) !== -1) return false
  }
  return true
}

function guardLength(text, min, max) {
  if (!text) return ''
  var t = String(text)
  if (t.length < min) t = t + '。需要更精确的判定。'
  if (t.length > max) t = t.slice(0, max - 1) + '。'
  return t
}

/* ═══════════════════════════════════════════════════════════════
   Export
   ═══════════════════════════════════════════════════════════════ */

module.exports = {
  buildCognitiveVerdict,
  cognitiveVerdictFallback,
}
