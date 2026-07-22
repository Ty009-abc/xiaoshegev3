/**
 * core/turnaround-intelligence/selectors/leverageInput.js
 *
 * CP6-C Leverage Input Selector — 裁剪输入给 Leverage Engine
 *
 * Leverage Engine 只能读取 Pattern(正向) + Profile + Evidence，
 * 不能读取 answers、Cognitive 或其他 Engine 的输出。
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

/**
 * createLeverageInput — 从 Context 裁剪 Leverage Engine 输入
 *
 * @param {Object} ctx — TurnaroundContext (stage ≥ profiled)
 * @returns {{ evidence: Object, patterns: Object, profile: Object }}
 */
function createLeverageInput(ctx) {
  if (!ctx || !ctx._meta) {
    throw new Error('createLeverageInput: context required')
  }
  if (!ctx.patterns) {
    throw new Error('createLeverageInput: context must have patterns (run runPatternStep first)')
  }
  if (!ctx.profile) {
    throw new Error('createLeverageInput: context must have profile (run runProfileStep first)')
  }
  if (!ctx.evidence) {
    throw new Error('createLeverageInput: context must have evidence')
  }

  // 严格裁剪：Pattern(正向) + Profile + Evidence
  return Object.freeze({
    evidence: ctx.evidence,
    patterns: ctx.patterns,
    profile: ctx.profile,
    // 禁止：answers, cognitive, verdict
  })
}

/**
 * validateLeverageInput — 安全验证
 */
function validateLeverageInput(input) {
  const errors = []

  if (!input) {
    errors.push('input required')
    return { valid: false, errors }
  }

  if (!input.evidence) errors.push('evidence required')
  if (!input.patterns) errors.push('patterns required')
  if (!input.profile) errors.push('profile required')

  // 检测泄露
  if (input.answers !== undefined) errors.push('SECURITY: answers leak detected in Leverage input')
  if (input.cognitive !== undefined) errors.push('SECURITY: cognitive leak detected in Leverage input')
  if (input.verdict !== undefined) errors.push('SECURITY: verdict leak detected in Leverage input')

  return { valid: errors.length === 0, errors: Object.freeze(errors) }
}

module.exports = { createLeverageInput, validateLeverageInput }
