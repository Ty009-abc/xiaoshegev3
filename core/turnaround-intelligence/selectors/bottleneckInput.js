/**
 * core/turnaround-intelligence/selectors/bottleneckInput.js
 * @version 6.2.0
 */

function createBottleneckInput(ctx) {
  if (!ctx) throw new Error('createBottleneckInput: ctx required')
  return Object.freeze({
    patterns: ctx.patterns,
    risk: ctx.risk || {},
    evidence: ctx.evidence || {},
  })
}

module.exports = { createBottleneckInput }
