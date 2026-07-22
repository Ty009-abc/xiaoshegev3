/**
 * core/turnaround-intelligence/contracts/narrative/strategy.js
 *
 * CP6-E Strategy Contract — 仅翻译 Roadmap，不推理
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

function createStrategyOutput({ version, phases }) {
  if (!version) throw new Error('Strategy: version required')
  if (!Array.isArray(phases)) throw new Error('Strategy: phases required')

  for (const p of phases) {
    if (!p.period || !p.action) throw new Error('Strategy: each phase needs period/action')
  }

  return Object.freeze({
    version,
    phases: Object.freeze(phases.map(p => Object.freeze({ ...p }))),
  })
}

module.exports = { createStrategyOutput }
