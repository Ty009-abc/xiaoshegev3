/**
 * core/turnaround-intelligence/contracts/narrative/consistency.js
 *
 * CP6-E Consistency Contract — <85 禁止输出报告
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

const MIN_SCORE = 85

function createConsistencyOutput({ version, score, violations }) {
  if (!version) throw new Error('Consistency: version required')
  if (typeof score !== 'number' || score < 0 || score > 100) {
    throw new Error('Consistency: score out of range')
  }
  if (!Array.isArray(violations)) throw new Error('Consistency: violations required')

  const passed = score >= MIN_SCORE

  return Object.freeze({
    version,
    score: Math.round(score),
    passed,
    violations: Object.freeze([...violations]),
    minRequired: MIN_SCORE,
    message: passed
      ? '全链路一致性检查通过'
      : `一致性不足 (${Math.round(score)} < ${MIN_SCORE})，禁止生成报告`,
  })
}

module.exports = { createConsistencyOutput, MIN_SCORE }
