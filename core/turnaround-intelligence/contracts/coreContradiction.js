/**
 * core/turnaround-intelligence/contracts/coreContradiction.js
 *
 * CP6-C.1 Core Contradiction Contract — 唯一核心矛盾
 *
 * 从 Conflict Top3 中选出唯一核心矛盾。
 *
 * 整份报告只围绕这一件事。
 *
 * @version 6.1.0
 * @checkpoint CP6-C.1
 */

const { CONFLICT_CATALOG } = require('./conflict')

// ═══════════════════════════════════════
// createCoreContradictionOutput
// ═══════════════════════════════════════

function createCoreContradictionOutput({
  version,
  code,
  title,
  severity,
  confidence,
  reason,
  supportedBy,
  evidenceChain,
}) {
  if (!version) throw new Error('CoreContradictionOutput: version required')
  if (!code) throw new Error('CoreContradictionOutput: code required')
  if (!CONFLICT_CATALOG[code]) throw new Error(`Unknown conflict code: "${code}"`)
  if (typeof severity !== 'number' || severity < 0 || severity > 100) {
    throw new Error('CoreContradictionOutput: severity out of range')
  }
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error('CoreContradictionOutput: confidence out of range')
  }
  if (!reason) throw new Error('CoreContradictionOutput: reason required')
  if (!Array.isArray(supportedBy)) {
    throw new Error('CoreContradictionOutput: supportedBy required')
  }
  // 允许空数组（回退场景）
  if (!evidenceChain || !Array.isArray(evidenceChain.nodes)) {
    throw new Error('CoreContradictionOutput: evidenceChain with nodes array required')
  }

  return Object.freeze({
    version,
    code,
    title: title || CONFLICT_CATALOG[code].title,
    description: CONFLICT_CATALOG[code].description,
    severity,
    confidence,
    reason,
    supportedBy: Object.freeze([...supportedBy]),
    evidenceChain: Object.freeze({
      nodes: Object.freeze(evidenceChain.nodes),
    }),
  })
}

module.exports = { createCoreContradictionOutput }
