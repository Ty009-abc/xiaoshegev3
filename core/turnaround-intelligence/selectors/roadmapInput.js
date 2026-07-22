/**
 * core/turnaround-intelligence/selectors/roadmapInput.js
 * @version 6.2.0
 */

function createRoadmapInput(ctx) {
  if (!ctx) throw new Error('createRoadmapInput: ctx required')
  if (!ctx.decision) throw new Error('createRoadmapInput: decision required')
  return Object.freeze({ decision: ctx.decision })
}

module.exports = { createRoadmapInput }
