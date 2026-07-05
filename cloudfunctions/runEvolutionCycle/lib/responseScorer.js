/**
 * cloudfunctions/common/responseScorer.js — 回答评分器
 *
 * 四册 Part 5：Response Strategy
 *
 * 评分维度（每项 0-10）：
 *   clarity      — 清晰度：是否易读，结构是否分明
 *   persona      — 人格匹配：是否符合小事哥风格
 *   shock        — 冲击力：是否有反常识/认知暴击
 *   depth        — 深度：是否揭示了底层逻辑
 *   actionability — 可执行性：是否有具体下一步
 *
 * 总分 < 75 → 触发重生成
 */

const REFUSE_SCORE = 75

/**
 * scoreResponse(text, options)
 *
 * @param {string} text      - 回答文本
 * @param {object} options   - { intent, strategy, complexity, plan }
 * @returns {{ scores, total, passed, analysis }}
 */
function scoreResponse(text, options = {}) {
  const {
    intent = 'analysis',
    strategy = 'layered',
    complexity = 3,
    plan = null,
  } = options

  if (!text || text.trim().length === 0) {
    return { scores: { clarity: 0, persona: 0, shock: 0, depth: 0, actionability: 0 }, total: 0, passed: false, analysis: '空的回答' }
  }

  const t = text.trim()
  const scores = {}

  // ═══════════════════════
  // 1. CLARITY (清晰度)
  // ═══════════════════════
  scores.clarity = _scoreClarity(t, plan)

  // ═══════════════════════
  // 2. PERSONA (人格匹配)
  // ═══════════════════════
  scores.persona = _scorePersona(t, intent)

  // ═══════════════════════
  // 3. SHOCK (冲击力)
  // ═══════════════════════
  scores.shock = _scoreShock(t, strategy)

  // ═══════════════════════
  // 4. DEPTH (深度)
  // ═══════════════════════
  scores.depth = _scoreDepth(t, intent, complexity)

  // ═══════════════════════
  // 5. ACTIONABILITY (可执行性)
  // ═══════════════════════
  scores.actionability = _scoreActionability(t, intent)

  // ── 加权总分（0-100 scale）──
  const weights = _getWeights(intent, strategy)
  const raw = 
    scores.clarity * weights.clarity +
    scores.persona * weights.persona +
    scores.shock * weights.shock +
    scores.depth * weights.depth +
    scores.actionability * weights.actionability
  const total = Math.round(raw * 10)  // raw is 0-10, scale to 0-100

  // ── 分析 ──
  const analysis = _generateAnalysis(scores, total)

  return {
    scores,
    total,
    passed: total >= REFUSE_SCORE,
    analysis,
    retry: total < REFUSE_SCORE,
  }
}

// ═══════════════════════
// CLARITY — 清晰度
// ═══════════════════════
function _scoreClarity(text, plan) {
  let score = 5 // 起点

  // 长度健康度
  const len = text.length
  if (len < 30) score -= 3       // 太短，可能没有内容
  else if (len < 80) score -= 1
  else if (len >= 150 && len <= 600) score += 2  // 理想范围
  else if (len > 1000) score -= 1  // 太长

  // 结构化检测（是否有分段标记）
  const hasSectionMarker = /【[^】]+】/.test(text)
  const hasNumberedList = /\d+[\.、]/.test(text)
  const hasParagraphs = (text.match(/\n\n/g) || []).length >= 2

  if (hasSectionMarker) score += 3
  else if (hasNumberedList) score += 2
  else if (hasParagraphs) score += 1

  // 句子长度是否合理（过于长的句子扣分）
  const sentences = text.split(/[。！？\n]/).filter(s => s.trim().length > 0)
  const longSentences = sentences.filter(s => s.length > 80)
  if (longSentences.length > 3) score -= 2
  if (sentences.length < 2 && len > 100) score -= 1 // 一句话写完所有

  return Math.max(0, Math.min(10, score))
}

// ═══════════════════════
// PERSONA — 人格匹配
// ═══════════════════════
function _scorePersona(text, intent) {
  let score = 5

  // 小事哥特征词
  const personaSignals = [
    { pattern: /你以为/g, weight: 2 },
    { pattern: /其实/g, weight: 1 },
    { pattern: /多数人|大多数人|大部分/g, weight: 1 },
    { pattern: /底层逻辑|根本原因|本质/g, weight: 1 },
    { pattern: /系统|规则|机制/g, weight: 1 },
    { pattern: /概率|赔率|期望/g, weight: 2 },
    { pattern: /赌场|庄家|赌徒/g, weight: 3 },
    { pattern: /不.*鸡汤/g, weight: 2 },
    { pattern: /说句难听|真相|暴击/g, weight: 2 },
  ]

  for (const { pattern, weight } of personaSignals) {
    const matches = (text.match(pattern) || []).length
    score += Math.min(matches * weight, 3)
  }

  // 减分：过于正式/中性
  if (/希望这.*帮助/.test(text)) score -= 2
  if (/如有.*问题.*随时/.test(text)) score -= 2
  if (/感谢.*信任/.test(text)) score -= 1

  return Math.max(0, Math.min(10, score))
}

// ═══════════════════════
// SHOCK — 冲击力
// ═══════════════════════
function _scoreShock(text, strategy) {
  let score = 5

  // 反常识信号
  if (/你以为.*其实/.test(text)) score += 3
  if (/多数人以为|大多数人都/.test(text)) score += 2
  if (/99%|百分之九十九/.test(text)) score += 1
  if (/说句.*难听|扎心|残酷|真相/.test(text)) score += 2
  if (/赌场|庄家优势|规则优势|负期望/.test(text)) score += 3
  if (/不是.*而是/.test(text)) score += 1

  // 与策略匹配的冲击检查
  if (strategy === 'cognitive_shock' || strategy === 'hard_truth') {
    if (score < 7) score += 2 // 对于冲击类策略，冲击力权重更高
  }

  return Math.max(0, Math.min(10, score))
}

// ═══════════════════════
// DEPTH — 深度
// ═══════════════════════
function _scoreDepth(text, intent, complexity) {
  let score = 5

  // 深度关键词
  const depthSignals = [
    { pattern: /底层|本质|根源/g, weight: 2 },
    { pattern: /系统.*设计|规则.*制定/g, weight: 2 },
    { pattern: /利益.*结构|利益.*格局/g, weight: 2 },
    { pattern: /结构性|系统性|根本性/g, weight: 2 },
    { pattern: /概率.*模型|期望.*计算/g, weight: 2 },
    { pattern: /认知.*偏差|认知.*盲区/g, weight: 2 },
  ]

  for (const { pattern, weight } of depthSignals) {
    const matches = (text.match(pattern) || []).length
    score += Math.min(matches * weight, 3)
  }

  // 多层分析检测（是否有"第一层/第二层"等标记）
  if (/第[一二三四五1-5][层步]/g.test(text)) score += 2

  // 复杂度匹配 — 高复杂度问题不应该给肤浅答案
  if (complexity >= 7 && score < 6) score -= 2

  return Math.max(0, Math.min(10, score))
}

// ═══════════════════════
// ACTIONABILITY — 可执行性
// ═══════════════════════
function _scoreActionability(text, intent) {
  let score = 5

  // 具体行动信号
  const actionSignals = [
    { pattern: /第一[步个]|首先|从.*开始/g, weight: 2 },
    { pattern: /你可以.*试|建议你|试着/g, weight: 1 },
    { pattern: /明天.*就/ig, weight: 2 },
    { pattern: /\d+[个条].*方式|\d+[个条].*方法/g, weight: 1 },
  ]

  for (const { pattern, weight } of actionSignals) {
    const matches = (text.match(pattern) || []).length
    score += Math.min(matches * weight, 3)
  }

  // 不同 intent 对 actionability 的要求不同
  const actionRequired = {
    coaching: 8, strategic: 8, advice: 7, analysis: 5, emotional: 4, fact: 3,
  }

  const minExpected = actionRequired[intent] || 5
  if (score < minExpected) score -= 1 // 达不到最低预期

  return Math.max(0, Math.min(10, score))
}

// ═══════════════════════
// 权重矩阵 — 不同场景下各维度的重要性
// ═══════════════════════
function _getWeights(intent, strategy) {
  // 默认权重
  const defaultWeights = { clarity: 0.25, persona: 0.25, shock: 0.15, depth: 0.25, actionability: 0.10 }

  // 策略覆盖
  const strategyWeights = {
    direct:           { clarity: 0.40, persona: 0.20, shock: 0.05, depth: 0.15, actionability: 0.20 },
    layered:          { clarity: 0.20, persona: 0.20, shock: 0.15, depth: 0.30, actionability: 0.15 },
    cognitive_shock:  { clarity: 0.15, persona: 0.20, shock: 0.40, depth: 0.15, actionability: 0.10 },
    coaching:         { clarity: 0.15, persona: 0.25, shock: 0.10, depth: 0.20, actionability: 0.30 },
    strategic_planning:{ clarity: 0.20, persona: 0.15, shock: 0.10, depth: 0.25, actionability: 0.30 },
    hard_truth:       { clarity: 0.10, persona: 0.20, shock: 0.40, depth: 0.25, actionability: 0.05 },
  }

  return strategyWeights[strategy] || defaultWeights
}

// ═══════════════════════
// 分析生成
// ═══════════════════════
function _generateAnalysis(scores, total) {
  const parts = []

  for (const [dim, val] of Object.entries(scores)) {
    if (val < 4) parts.push(`${dim}严重不足(${val}/10)`)
    else if (val < 6) parts.push(`${dim}偏低(${val}/10)`)
    else if (val >= 9) parts.push(`${dim}优秀(${val}/10)`)
  }

  if (total >= 90) parts.unshift('🌟 高质量回答')
  else if (total >= REFUSE_SCORE) parts.unshift('✅ 合格回答')
  else parts.unshift('❌ 需要重生成')

  return parts.join('；')
}

module.exports = {
  scoreResponse,
  REFUSE_SCORE,
}
