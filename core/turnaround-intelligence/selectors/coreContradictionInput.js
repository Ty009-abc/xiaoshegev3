/**
 * core/turnaround-intelligence/selectors/coreContradictionInput.js
 *
 * CP6-C.1 CoreContradiction Input Selector
 *
 * @version 6.1.0
 * @checkpoint CP6-C.1
 */

function createCoreContradictionInput(ctx) {
  if (!ctx || !ctx.conflicts) throw new Error('createCoreContradictionInput: context must have conflicts')
  if (!ctx.risk) throw new Error('createCoreContradictionInput: context must have risk')
  if (!ctx.leverage) throw new Error('createCoreContradictionInput: context must have leverage')
  if (!ctx.evidence) throw new Error('createCoreContradictionInput: context must have evidence')
  return Object.freeze({ conflicts: ctx.conflicts, risk: ctx.risk, leverage: ctx.leverage, evidence: ctx.evidence })
}

function validateCoreContradictionInput(input) {
  const errors = []
  if (!input || !input.conflicts) errors.push('conflicts required')
  if (!input || !input.risk) errors.push('risk required')
  if (!input || !input.leverage) errors.push('leverage required')
  if (input && input.answers !== undefined) errors.push('SECURITY: answers leak')
  return { valid: errors.length === 0, errors }
}

module.exports = { createCoreContradictionInput, validateCoreContradictionInput }
