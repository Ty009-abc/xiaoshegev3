/**
 * core/turnaround-intelligence/contracts/feasibility.js
 *
 * CP6-D Feasibility Contract — 独立评分，不复用 Potential
 *
 * 回答："这个方案你做得成吗？"
 *
 * @version 6.2.0
 * @checkpoint CP6-D
 */

const LEVELS = Object.freeze({
  HIGH:   { min: 75, label: '高可行性',    message: '当前条件充分，实施概率高' },
  MEDIUM: { min: 50, label: '中等可行性',  message: '部分条件具备，需要外部支持或调整' },
  LOW:    { min: 0,  label: '低可行性',    message: '核心条件缺失，建议先修复基础' },
})

function createFeasibilityOutput({ version, score, confidence, advantages, constraints }) {
  if (!version) throw new Error('Feasibility: version required')
  if (typeof score !== 'number' || score < 0 || score > 100) {
    throw new Error('Feasibility: score out of range')
  }
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error('Feasibility: confidence out of range')
  }
  if (!Array.isArray(advantages)) throw new Error('Feasibility: advantages required')
  if (!Array.isArray(constraints)) throw new Error('Feasibility: constraints required')

  let level = 'LOW'
  if (score >= LEVELS.HIGH.min) level = 'HIGH'
  else if (score >= LEVELS.MEDIUM.min) level = 'MEDIUM'

  return Object.freeze({
    version,
    score: Math.round(score),
    level,
    confidence: clamp(Math.round(confidence * 100) / 100, 0, 1),
    advantages: Object.freeze([...advantages]),
    constraints: Object.freeze([...constraints]),
    message: LEVELS[level].message,
  })
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
module.exports = { createFeasibilityOutput, LEVELS }
