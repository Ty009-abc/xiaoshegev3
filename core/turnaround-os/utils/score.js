/**
 * core/turnaround-os/utils/score.js
 *
 * 评分工具：加权、归一化、区间转换
 */

const { SCORE_RANGE } = require('../constants')

/**
 * 加权求和
 * @param {Object} scores - { key: value }
 * @param {Object} weights - { key: weight }
 * @returns {number} 0-100
 */
function weightedSum(scores, weights) {
  let totalWeight = 0
  let totalScore = 0
  for (const key of Object.keys(weights)) {
    const score = scores[key]
    const weight = weights[key]
    if (score !== undefined && score !== null && weight > 0) {
      totalScore += score * weight
      totalWeight += weight
    }
  }
  if (totalWeight === 0) return 0
  return clamp(Math.round(totalScore / totalWeight))
}

/**
 * 区间映射：将 [srcMin, srcMax] 映射到 [tgtMin, tgtMax]
 */
function mapRange(value, srcMin, srcMax, tgtMin, tgtMax) {
  if (value === undefined || value === null) return tgtMin
  const ratio = (value - srcMin) / (srcMax - srcMin)
  return clamp(Math.round(tgtMin + ratio * (tgtMax - tgtMin)))
}

/**
 * 多个条件计算加权平均分
 * @param {Array<{score: number, weight: number, label: string}>} items
 * @returns {{total: number, breakdown: Array}}
 */
function compositeScore(items) {
  if (!Array.isArray(items) || items.length === 0) return { total: 0, breakdown: [] }

  let totalWeight = 0
  let totalScore = 0
  const breakdown = []

  for (const item of items) {
    const score = item.score || 0
    const weight = item.weight || 1
    totalScore += score * weight
    totalWeight += weight
    breakdown.push({
      label: item.label || '',
      score: clamp(score),
      weight,
      contribution: 0,
    })
  }

  if (totalWeight > 0) {
    const avg = Math.round(totalScore / totalWeight)
    for (const b of breakdown) {
      b.contribution = Math.round((b.score * b.weight / totalWeight) * avg)
    }
    return { total: avg, breakdown }
  }

  return { total: 0, breakdown }
}

function clamp(value) {
  return Math.max(SCORE_RANGE.MIN, Math.min(SCORE_RANGE.MAX, Math.round(value || 0)))
}

module.exports = {
  weightedSum,
  mapRange,
  compositeScore,
  clamp,
}
