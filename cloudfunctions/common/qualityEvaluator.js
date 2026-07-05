/**
 * cloudfunctions/common/qualityEvaluator.js — 质量评估器（进化版）
 *
 * 四册 Part 6：Self Evolution
 *
 * 评分维度（每项 0-10）：
 *   clarity      — 清晰度
 *   persona      — 人格匹配
 *   depth        — 深度
 *   shock        — 冲击力
 *   conversion   — 转化潜力（是否引导用户做有价值动作）
 *
 * 与 Part 5 responseScorer 互补：
 *   - responseScorer: 实时评分（回答生成后立即打分）
 *   - qualityEvaluator: 事后评估（结合用户行为反馈）
 */

const { scoreResponse } = require('./responseScorer.js')
const { detectDrift } = require('./driftDetector.js')

/**
 * evaluateQuality(response, metrics, options)
 *
 * 综合评估：AI 自身评分 + 用户行为 + 人格漂移
 *
 * @param {object} response   - { responseId, text, intent, strategy, complexity }
 * @param {object} metrics    - { shared, saved, ledToPayment, continuationCount, timeSpent, rating }
 * @param {object} options    - { personaIntensity, modelUsed }
 * @returns {{ evaluationId, scores, total, grade, driftResult }}
 */
function evaluateQuality(response, metrics = {}, options = {}) {
  const { responseId = 'unknown', text = '', intent = 'analysis', strategy = 'layered', complexity = 3 } = response
  const { personaIntensity = 6, modelUsed = 'default' } = options

  // ── 1. 即时评分（AI 自评） ──
  const selfScore = scoreResponse(text, { intent, strategy, complexity })

  // ── 2. 行为信号评分 ──
  const behaviorScore = _scoreBehavior(metrics)

  // ── 3. 漂移检测 ──
  const driftResult = detectDrift(text, { strategy, personaIntensity })

  // ── 4. 转化评分 ──
  const conversionScore = _scoreConversion(metrics)

  // ── 5. 综合总分 ──
  const weightedTotal = Math.round(
    selfScore.total * 0.5 +        // AI 自评 50%
    behaviorScore * 0.25 +         // 行为信号 25%
    (100 - driftResult.driftScore) * 0.15 +  // 人格稳定度 15%
    conversionScore * 0.10         // 转化信号 10%
  )

  // ── 等级 ──
  let grade
  if (weightedTotal >= 92) grade = 'S'       // 卓越
  else if (weightedTotal >= 80) grade = 'A'   // 优秀
  else if (weightedTotal >= 70) grade = 'B'   // 良好
  else if (weightedTotal >= 60) grade = 'C'   // 一般
  else grade = 'D'                             // 需要重生成

  return {
    evaluationId: `EVAL_${responseId}_${Date.now()}`,
    scores: {
      ...selfScore.scores,
      conversion: conversionScore / 10,       // 归一化 0-10
      driftResilience: (100 - driftResult.driftScore) / 10,
    },
    selfScore: selfScore.total,
    behaviorScore,
    conversionScore: conversionScore / 10,
    driftScore: driftResult.driftScore,
    total: weightedTotal,
    grade,
    driftAlarm: driftResult.alarm,
    weaknesses: _identifyWeaknesses(selfScore.scores, driftResult, metrics),
  }
}

/**
 * _scoreBehavior(metrics) — 行为信号评分 (0-100)
 */
function _scoreBehavior(metrics = {}) {
  let score = 50 // 基线

  const { shared, saved, ledToPayment, continuationCount, timeSpent, rating } = metrics

  // 正面信号
  if (shared) score += 15
  if (saved) score += 12
  if (ledToPayment) score += 25        // 最强信号
  if (continuationCount >= 3) score += 10  // 用户继续聊
  else if (continuationCount >= 1) score += 5
  if (timeSpent && timeSpent > 10) score += 8  // 用户花时间看
  if (rating >= 4) score += 10
  if (rating === 5) score += 5

  // 负面信号
  if (continuationCount === 0) score -= 5
  if (rating === 1 || rating === 2) score -= 20  // 差评
  if (rating === 3) score -= 5  // 中评

  return Math.max(0, Math.min(100, score))
}

/**
 * _scoreConversion(metrics) — 转化潜力评分 (0-100)
 */
function _scoreConversion(metrics = {}) {
  let score = 30

  const { ledToPayment, shared, saved, continuationCount } = metrics

  if (ledToPayment) score += 50        // 直接转化
  if (shared) score += 15
  if (saved) score += 10
  if (continuationCount >= 5) score += 10  // 深度对话是高转化前兆
  else if (continuationCount >= 2) score += 5

  return Math.min(100, score)
}

/**
 * _identifyWeaknesses(scores, driftResult, metrics)
 * 识别薄弱环节
 */
function _identifyWeaknesses(scores, driftResult, metrics = {}) {
  const weaknesses = []
  const strengths = []

  // 评分维度弱点
  if (scores.clarity < 5) weaknesses.push('clarity_low')
  else if (scores.clarity >= 9) strengths.push('clarity_high')

  if (scores.persona < 5) weaknesses.push('persona_weak')
  else if (scores.persona >= 9) strengths.push('persona_strong')

  if (scores.depth < 5) weaknesses.push('depth_shallow')
  else if (scores.depth >= 9) strengths.push('depth_deep')

  if (scores.shock < 5) weaknesses.push('shock_mild')
  else if (scores.shock >= 9) strengths.push('shock_intense')

  // 漂移弱点
  if (driftResult.isDrifting) {
    weaknesses.push('persona_drifting')
    if (driftResult.driftScore >= 85) weaknesses.push('persona_critical_drift')
  }

  // 行为弱点
  if (metrics.rating <= 2) weaknesses.push('user_rated_poor')
  if (metrics.continuationCount === 0 && !metrics.shared) {
    weaknesses.push('no_engagement')
  }

  // 行为优势
  if (metrics.ledToPayment) strengths.push('high_conversion')
  if (metrics.shared) strengths.push('shareable')
  if (metrics.rating === 5) strengths.push('user_loved')

  return { weaknesses, strengths }
}

/**
 * batchEvaluate(responses) — 批量评估
 */
function batchEvaluate(responses) {
  if (!Array.isArray(responses)) return []
  return responses.map(r => evaluateQuality(r.response, r.metrics, r.options))
}

module.exports = {
  evaluateQuality,
  batchEvaluate,
}
