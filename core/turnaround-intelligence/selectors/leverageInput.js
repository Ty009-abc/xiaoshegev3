/**
 * core/turnaround-intelligence/selectors/leverageInput.js
 *
 * CP6-C Leverage Input Selector — 读 Pattern + Profile + Evidence
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

function createLeverageInput(ctx) {
  if (!ctx || !ctx.patterns) throw new Error('createLeverageInput: context must have patterns')
  if (!ctx.profile) throw new Error('createLeverageInput: context must have profile')
  if (!ctx.evidence) throw new Error('createLeverageInput: context must have evidence')
  return Object.freeze({ patterns: ctx.patterns, profile: ctx.profile, evidence: ctx.evidence })
}

function validateLeverageInput(input) {
  const errors = []
  if (!input || !input.patterns) errors.push('patterns required')
  if (!input || !input.profile) errors.push('profile required')
  if (input && input.answers !== undefined) errors.push('SECURITY: answers leak')
  if (input && input.cognitive !== undefined) errors.push('SECURITY: cognitive leak')
  return { valid: errors.length === 0, errors }
}

module.exports = { createLeverageInput, validateLeverageInput }
