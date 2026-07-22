/**
 * core/turnaround-intelligence/selectors/decisionInput.js
 * @version 6.2.0
 */

function createDecisionInput(ctx) {
  if (!ctx) throw new Error('createDecisionInput: ctx required')
  if (!ctx.coreContradiction) throw new Error('createDecisionInput: coreContradiction required')
  if (!ctx.opportunity) throw new Error('createDecisionInput: opportunity required')
  return Object.freeze({
    coreContradiction: ctx.coreContradiction,
    opportunity: ctx.opportunity,
    risk: ctx.risk,
    evidence: ctx.evidence,
  })
}

module.exports = { createDecisionInput }
