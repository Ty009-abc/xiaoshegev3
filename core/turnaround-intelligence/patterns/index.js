/**
 * core/turnaround-intelligence/patterns/index.js
 *
 * CP6-B.1 Pattern Layer — 统一入口
 *
 * Pattern 是 Evidence 和 Risk/Leverage Engine 之间的中间层。
 * 所有 Risk Engine 和 Leverage Engine 必须通过 Patterns 读取模式图，
 * 不得直接读取 Evidence。
 *
 * @version 6.0.0
 * @checkpoint CP6-B.1
 */

const { detectActionPatterns, getPositivePatterns: getPosAction, getNegativePatterns: getNegAction, getPatternsByReversibility: getRevAction, getTotalPatternRisk } = require('./actionPatterns')
const { detectWealthPatterns } = require('./wealthPatterns')
const { detectPsychologyPatterns } = require('./psychologyPatterns')

/**
 * detectAllPatterns — 从 Evidence 中检测所有 Pattern
 *
 * @param {Object[]} evidences
 * @returns {{ action: Object[], wealth: Object[], psychology: Object[] }}
 */
function detectAllPatterns(evidences) {
  const action = detectActionPatterns(evidences)
  const wealth = detectWealthPatterns(evidences)
  const psychology = detectPsychologyPatterns(evidences)

  return Object.freeze({
    action: Object.freeze(action),
    wealth: Object.freeze(wealth),
    psychology: Object.freeze(psychology),
    meta: Object.freeze({
      totalCount: action.length + wealth.length + psychology.length,
      positiveCount: action.filter(p => p.severity === 0).length +
        wealth.filter(p => p.severity === 0).length +
        psychology.filter(p => p.severity === 0).length,
      negativeCount: action.filter(p => p.severity > 0).length +
        wealth.filter(p => p.severity > 0).length +
        psychology.filter(p => p.severity > 0).length,
    }),
  })
}

/**
 * getAllNegativePatterns — 获取所有负向模式（风险源）
 */
function getAllNegativePatterns(allPatterns) {
  return [
    ...allPatterns.action.filter(p => p.severity > 0),
    ...allPatterns.wealth.filter(p => p.severity > 0),
    ...allPatterns.psychology.filter(p => p.severity > 0),
  ]
}

/**
 * getAllPositivePatterns — 获取所有正向模式（杠杆源）
 */
function getAllPositivePatterns(allPatterns) {
  return [
    ...allPatterns.action.filter(p => p.severity === 0),
    ...allPatterns.wealth.filter(p => p.severity === 0),
    ...allPatterns.psychology.filter(p => p.severity === 0),
  ]
}

module.exports = {
  detectAllPatterns,
  detectActionPatterns,
  detectWealthPatterns,
  detectPsychologyPatterns,
  getAllNegativePatterns,
  getAllPositivePatterns,
  getTotalPatternRisk,
}
