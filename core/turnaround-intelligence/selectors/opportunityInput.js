/**
 * core/turnaround-intelligence/selectors/opportunityInput.js
 *
 * CP6-C.1 Opportunity Input Selector
 *
 * @version 6.1.0
 * @checkpoint CP6-C.1
 */

function createOpportunityInput(ctx) {
  if (!ctx || !ctx.conflicts) throw new Error('createOpportunityInput: context must have conflicts')
  if (!ctx.risk) throw new Error('createOpportunityInput: context must have risk')
  if (!ctx.leverage) throw new Error('createOpportunityInput: context must have leverage')
  return Object.freeze({ conflicts: ctx.conflicts, risk: ctx.risk, leverage: ctx.leverage })
}

function validateOpportunityInput(input) {
  const errors = []
  if (!input || !input.conflicts) errors.push('conflicts required')
  if (!input || !input.risk) errors.push('risk required')
  if (input && input.answers !== undefined) errors.push('SECURITY: answers leak')
  return { valid: errors.length === 0, errors }
}

module.exports = { createOpportunityInput, validateOpportunityInput }
