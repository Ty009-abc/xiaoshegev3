/**
 * core/turnaround-intelligence/selectors/feasibilityInput.js
 * @version 6.2.0
 */

function createFeasibilityInput(ctx) {
  if (!ctx) throw new Error('createFeasibilityInput: ctx required')
  return Object.freeze({
    profile: ctx.profile,
    cognitive: ctx.cognitive,
    risk: ctx.risk,
    leverage: ctx.leverage,
    evidence: ctx.evidence,
    opportunity: ctx.opportunity,
    decision: ctx.decision,
  })
}

module.exports = { createFeasibilityInput }
