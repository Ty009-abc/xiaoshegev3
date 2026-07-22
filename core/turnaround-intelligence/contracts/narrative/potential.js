/**
 * core/turnaround-intelligence/contracts/narrative/potential.js
 *
 * CP6-E Potential Contract — 翻身潜力（含"基于当前评估"声明）
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

function createPotentialOutput({ version, score, level, reversibility, estimatedRecoveryDays, window }) {
  if (!version) throw new Error('Potential: version required')
  if (typeof score !== 'number' || score < 0 || score > 100) {
    throw new Error('Potential: score out of range')
  }
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(level)) throw new Error(`Potential: invalid level "${level}"`)
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(reversibility)) throw new Error(`Potential: invalid reversibility`)
  if (typeof estimatedRecoveryDays !== 'number' || estimatedRecoveryDays <= 0) {
    throw new Error('Potential: estimatedRecoveryDays required')
  }
  if (!window || !['OPEN', 'CLOSING', 'CLOSED'].includes(window.status)) {
    throw new Error('Potential: window.status required (OPEN/CLOSING/CLOSED)')
  }

  return Object.freeze({
    version,
    score: Math.round(score),
    level,
    reversibility,
    estimatedRecoveryDays,
    window: Object.freeze({
      status: window.status,
      durationDays: window.durationDays || estimatedRecoveryDays,
    }),
    disclaimer: '这是基于当前行为模式的评估，不代表未来结果的保证。实际结果会随着你的行动而改变。',
  })
}

module.exports = { createPotentialOutput }
