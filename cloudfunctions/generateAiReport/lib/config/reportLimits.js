/**
 * cloudfunctions/generateAiReport/lib/config/reportLimits.js
 *
 * 共享上限常量 — 所有报告数值门禁的唯一来源。
 * 禁止各模块独立维护同义魔法数字。
 *
 * @version RC8.2
 */

const REPORT_LIMITS = Object.freeze({
  /** potentialIndex（原 wealthProbability）封顶值——非概率，是场景潜势指数 */
  MAX_POTENTIAL_INDEX: 90,
  MIN_POTENTIAL_INDEX: 0,

  /** metric metadata */
  METRIC_TYPE: 'SCENARIO_POTENTIAL_INDEX',
  IS_PROBABILITY: false,
})

module.exports = REPORT_LIMITS
