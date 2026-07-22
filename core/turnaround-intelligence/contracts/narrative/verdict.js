/**
 * core/turnaround-intelligence/contracts/narrative/verdict.js
 *
 * CP6-E Verdict Contract — 命运判决（≤35字，来自 CoreContradiction）
 *
 * Narrative never creates facts. Narrative only explains decisions.
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

function createVerdictOutput({ headline, explanation, confidence, basedOn }) {
  if (!headline) throw new Error('Verdict: headline required')
  if (headline.length > 35) throw new Error(`Verdict: headline ≤35 chars, got ${headline.length}`)
  if (!explanation) throw new Error('Verdict: explanation required')
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error('Verdict: confidence out of range')
  }
  if (!basedOn || !basedOn.coreContradiction) throw new Error('Verdict: basedOn.coreContradiction required')
  if (!basedOn.decision) throw new Error('Verdict: basedOn.decision required')

  return Object.freeze({
    title: '命运判决',
    headline,
    explanation,
    confidence: clamp(Math.round(confidence * 100) / 100, 0, 1),
    basedOn: Object.freeze({ ...basedOn }),
  })
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
module.exports = { createVerdictOutput }
