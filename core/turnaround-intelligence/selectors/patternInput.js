/**
 * core/turnaround-intelligence/selectors/patternInput.js
 *
 * CP6-C Pattern Input Selector
 *
 * Pattern Engine 只能读 Evidence，不能读别的
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

function createPatternInput(ctx) {
  if (!ctx || !ctx.evidence) throw new Error('createPatternInput: context must have evidence')
  return Object.freeze({ evidence: ctx.evidence })
}

function validatePatternInput(input) {
  const errors = []
  if (!input || !input.evidence) errors.push('evidence required')
  if (input && input.answers !== undefined) errors.push('SECURITY: answers leak')
  return { valid: errors.length === 0, errors }
}

module.exports = { createPatternInput, validatePatternInput }
