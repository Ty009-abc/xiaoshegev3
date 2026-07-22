/**
 * core/turnaround-intelligence/contracts/narrative/realityGap.js
 *
 * CP6-E Reality Gap Contract — 固定三段模板（认知暴击）
 *
 * 你以为 → 实际上 → 真正的问题
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

function createRealityGapOutput({ youThought, actually, realProblem, basedOn }) {
  if (!youThought) throw new Error('RealityGap: youThought required')
  if (!actually) throw new Error('RealityGap: actually required')
  if (!realProblem) throw new Error('RealityGap: realProblem required')
  if (!basedOn || !basedOn.coreContradiction) throw new Error('RealityGap: basedOn.coreContradiction required')

  return Object.freeze({
    title: '认知暴击',
    youThought,
    actually,
    realProblem,
    basedOn: Object.freeze({ ...basedOn }),
  })
}

module.exports = { createRealityGapOutput }
