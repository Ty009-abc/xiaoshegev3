/**
 * core/turnaround-intelligence/engines/riskEngine.js
 *
 * CP6-C Risk Engine — Pattern → Risk 排序引擎
 *
 * 回答："为什么翻不了身？"
 *
 * 数据流: Pattern → Risk（禁止直接读取 Evidence）
 * 输出: Top 3 Risk
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

const { RISK_CATALOG, PATTERN_TO_RISK, createRiskOutput } = require('../contracts/risk')

/**
 * run — 从 Pattern 输出生成 Risk 输出
 *
 * @param {Object} input — { patterns: PatternOutput, evidence: EvidenceSet }
 * @returns {Object} RiskOutput (Top 3)
 */
function run(input) {
  const patterns = input.patterns.patterns
  const evidences = (input.evidence || {}).evidences || []

  // Pattern → Risk 映射（去重：同一 riskCode 保留强度最高的 pattern）
  const riskMap = new Map()

  for (const pattern of patterns) {
    const riskCode = PATTERN_TO_RISK[pattern.code]
    if (!riskCode) continue

    const existing = riskMap.get(riskCode)
    if (!existing || pattern.strength > existing.patternStrength) {
      riskMap.set(riskCode, {
        riskCode,
        patternCode: pattern.code,
        patternStrength: pattern.strength,
        patternConfidence: pattern.confidence,
        patternEvidenceRefs: pattern.evidenceRefs,
      })
    }
  }

  // 构建风险列表
  const risks = []
  for (const [, entry] of riskMap) {
    const def = RISK_CATALOG[entry.riskCode]
    if (!def) continue

    // severity = patternStrength × severityBase（来自 pattern 定义）
    const patternDef = require('../contracts/pattern').PATTERN_CATALOG[entry.patternCode]
    const severityBase = patternDef ? patternDef.severityBase : 60
    const severity = Math.round(severityBase * (0.7 + 0.3 * entry.patternStrength))

    const confidence = entry.patternConfidence

    risks.push({
      riskCode: entry.riskCode,
      title: def.title,
      severity: Math.round(clamp(severity, 0, 100)),
      priority: 0, // 稍后赋值
      reversibility: def.reversibility,
      estimatedRecoveryDays: def.estimatedRecoveryDays,
      confidence: clamp(confidence, 0, 1),
      patternRefs: [entry.patternCode],
      evidenceRefs: entry.patternEvidenceRefs,
      actionHints: def.actionHints,
    })
  }

  // 按 severity 降序排列
  risks.sort((a, b) => b.severity - a.severity)

  // Top 3
  const topRisks = risks.slice(0, 3).map((r, i) => ({
    ...r,
    priority: i + 1,
  }))

  // 总风险评分为 Top 3 加权均
  let totalRiskScore = 0
  if (topRisks.length > 0) {
    totalRiskScore = Math.round(
      topRisks.reduce((s, r, i) => s + r.severity / (i + 1), 0) /
      topRisks.reduce((s, _, i) => s + 1 / (i + 1), 0)
    )
  }

  return createRiskOutput({
    version: '6.1.0',
    topRisks,
    totalRiskScore,
  })
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

module.exports = { run }
