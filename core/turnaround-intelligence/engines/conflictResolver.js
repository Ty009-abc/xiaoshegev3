/**
 * core/turnaround-intelligence/engines/conflictResolver.js
 *
 * CP6-C Conflict Resolver — Risk × Leverage 冲突检测
 *
 * 例如：学习能力 (LEARNING_SPEED) × 执行碎片化 (EXECUTION_FRAGMENTATION)
 *       → LEARNING_EXECUTION_CONFLICT（高认知低兑现）
 *
 * Verdict Engine 后续只读取 context.conflicts
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

const { CONFLICT_CATALOG, CONFLICT_RULES, createConflictOutput } = require('../contracts/conflict')

/**
 * run — 从 Risk + Leverage 输出中检测冲突
 *
 * @param {Object} input — { risk: RiskOutput, leverage: LeverageOutput }
 * @returns {Object} ConflictOutput (Top 1~3)
 */
function run(input) {
  const risks = (input.risk || {}).topRisks || []
  const leverages = (input.leverage || {}).topLeverages || []

  if (risks.length === 0 || leverages.length === 0) {
    return createConflictOutput({ version: '6.1.0', conflicts: [] })
  }

  const conflicts = []

  for (const risk of risks) {
    for (const lev of leverages) {
      // 在 CONFLICT_RULES 中查找 (riskCode × leverageCode) 对
      const rule = CONFLICT_RULES.find(
        r => r.riskCode === risk.riskCode && r.leverageCode === lev.code
      )
      if (!rule) continue

      const def = CONFLICT_CATALOG[rule.conflictCode]
      if (!def) continue

      // severity = avg(risk.severity, lev.strength)（两者都高 → 冲突严重）
      const severity = Math.round((risk.severity + lev.strength) / 2)

      // 去重：同一个 conflictCode 取最高 severity
      const existing = conflicts.find(c => c.code === rule.conflictCode)
      if (!existing || severity > existing.severity) {
        // 替换旧条目
        if (existing) {
          const idx = conflicts.indexOf(existing)
          if (idx >= 0) conflicts.splice(idx, 1)
        }
        conflicts.push({
          code: rule.conflictCode,
          title: def.title,
          description: def.description,
          severity: clamp(severity, 0, 100),
          riskRef: risk.riskCode,
          leverageRef: lev.code,
        })
      }
    }
  }

  // 按 severity 降序，取 Top 3
  conflicts.sort((a, b) => b.severity - a.severity)
  const topConflicts = conflicts.slice(0, 3)

  return createConflictOutput({
    version: '6.1.0',
    conflicts: topConflicts,
  })
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
module.exports = { run }
