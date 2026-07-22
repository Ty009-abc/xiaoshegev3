/**
 * core/turnaround-intelligence/selectors/conflictInput.js
 *
 * CP6-C Conflict Input Selector — Conflict Resolver 只读 Risk + Leverage
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

function createConflictInput(ctx) {
  if (!ctx || !ctx.risk) throw new Error('createConflictInput: context must have risk')
  if (!ctx.leverage) throw new Error('createConflictInput: context must have leverage')
  return Object.freeze({ risk: ctx.risk, leverage: ctx.leverage })
}

function validateConflictInput(input) {
  const errors = []
  if (!input || !input.risk) errors.push('risk required')
  if (!input || !input.leverage) errors.push('leverage required')
  if (input && input.answers !== undefined) errors.push('SECURITY: answers leak')
  if (input && input.evidence !== undefined) errors.push('SECURITY: evidence leak')
  return { valid: errors.length === 0, errors }
}

module.exports = { createConflictInput, validateConflictInput }
