/**
 * core/turnaround-intelligence/selectors/riskInput.js
 *
 * CP6-C Risk Input Selector — Risk Engine 只能读 Pattern + Evidence
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

function createRiskInput(ctx) {
  if (!ctx || !ctx.patterns) throw new Error('createRiskInput: context must have patterns')
  if (!ctx.evidence) throw new Error('createRiskInput: context must have evidence')
  return Object.freeze({ patterns: ctx.patterns, evidence: ctx.evidence })
}

function validateRiskInput(input) {
  const errors = []
  if (!input || !input.patterns) errors.push('patterns required')
  if (!input || !input.evidence) errors.push('evidence required')
  if (input && input.answers !== undefined) errors.push('SECURITY: answers leak')
  if (input && input.profile !== undefined) errors.push('SECURITY: profile leak')
  return { valid: errors.length === 0, errors }
}

module.exports = { createRiskInput, validateRiskInput }
