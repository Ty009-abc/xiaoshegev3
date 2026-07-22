/**
 * core/turnaround-intelligence/selectors/riskInput.js
 *
 * CP6-C Risk Input Selector — 裁剪输入给 Risk Engine
 *
 * Risk Engine 只能读取 Pattern + Evidence，不能读取
 * answers、Profile、Cognitive 或其他 Engine 的输出。
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

/**
 * createRiskInput — 从 Context 裁剪 Risk Engine 输入
 *
 * @param {Object} ctx — TurnaroundContext (stage ≥ pattern_detected)
 * @returns {{ evidence: Object, patterns: Object }}
 */
function createRiskInput(ctx) {
  if (!ctx || !ctx._meta) {
    throw new Error('createRiskInput: context required')
  }
  if (!ctx.patterns || !ctx.evidence) {
    throw new Error('createRiskInput: context must have patterns and evidence (run runPatternStep first)')
  }

  // 严格裁剪：只给 Pattern + Evidence
  return Object.freeze({
    evidence: ctx.evidence,
    patterns: ctx.patterns,
    // 禁止：answers, profile, cognitive, 其他
  })
}

/**
 * validateRiskInput — 安全验证：确保没有 answers 或其他 Engine 数据泄露
 *
 * @param {Object} input
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateRiskInput(input) {
  const errors = []

  if (!input) {
    errors.push('input required')
    return { valid: false, errors }
  }

  if (!input.evidence) errors.push('evidence required')
  if (!input.patterns) errors.push('patterns required')

  // 检测泄露
  if (input.answers !== undefined) errors.push('SECURITY: answers leak detected in Risk input')
  if (input.profile !== undefined) errors.push('SECURITY: profile leak detected in Risk input')
  if (input.cognitive !== undefined) errors.push('SECURITY: cognitive leak detected in Risk input')
  if (input.verdict !== undefined) errors.push('SECURITY: verdict leak detected in Risk input')

  return { valid: errors.length === 0, errors: Object.freeze(errors) }
}

module.exports = { createRiskInput, validateRiskInput }
