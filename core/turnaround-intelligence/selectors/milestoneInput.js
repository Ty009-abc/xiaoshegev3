/**
 * core/turnaround-intelligence/selectors/milestoneInput.js
 * @version 6.2.0
 */

function createMilestoneInput(ctx) {
  if (!ctx) throw new Error('createMilestoneInput: ctx required')
  return Object.freeze({
    roadmap: ctx.roadmap || {},
    bottleneck: ctx.bottleneck || {},
  })
}

module.exports = { createMilestoneInput }
