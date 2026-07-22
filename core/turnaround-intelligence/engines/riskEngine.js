/**
 * core/turnaround-intelligence/engines/riskEngine.js
 *
 * CP6-C Risk Engine — 风险检测引擎
 *
 * 回答："为什么翻不了身？"
 *
 * 数据流: Pattern(负向) → Risk
 * 每个风险项必须包含:
 *   riskCode, severity, reversibility, estimatedRecoveryDays, evidenceRefs
 *
 * 所有判断基于 Pattern 和 Evidence 的确定性规则，
 * 不使用 AI、随机数或隐藏常量。
 *
 * @version 6.1.0
 * @checkpoint CP6-C
 */

const { RISK_CODES, getSeverityLevel, createRiskOutput } = require('../contracts/risk')
const { getEvidencesByTag } = require('../contracts/evidence')
const { BEHAVIOR_TAGS, WEALTH_TAGS, PSYCHOLOGY_TAGS } = require('../contracts/tags')

// ═══════════════════════════════════════
// Pattern → Risk 映射表
// ═══════════════════════════════════════

/**
 * 每条映射：当 pattern.conclusion 命中时 → 触发对应 Risk
 * riskSeverityModifier: 调整 pattern.severity（±）
 * reversibilityOverride: 覆盖 pattern.reversibility（可选）
 * recoveryModifier: 调整 pattern.estimatedRecoveryDays（可选）
 */
const PATTERN_TO_RISK = [
  // === 执行模式 → 执行风险 ===
  { patternConclusion: 'EXECUTION_BREAK', riskCode: 'EXECUTION_FRAGMENTATION' },
  { patternConclusion: 'ANALYSIS_PARALYSIS', riskCode: 'ANALYSIS_PARALYSIS' },
  { patternConclusion: 'EMOTIONAL_INTERRUPTION', riskCode: 'EMOTIONAL_INTERRUPTION' },

  // === 财富模式 → 财富风险 ===
  { patternConclusion: 'INCOME_FRAGILITY', riskCode: 'INCOME_FRAGILITY_RISK' },
  { patternConclusion: 'LIQUIDITY_CRISIS', riskCode: 'LIQUIDITY_CRISIS_RISK' },
  { patternConclusion: 'FINANCIAL_DISORDER', riskCode: 'FINANCIAL_DISORDER_RISK' },
  { patternConclusion: 'CONSUMERISM_TRAP', riskCode: 'NO_FINANCIAL_BUFFER_RISK' },

  // === 心理模式 → 心理风险 ===
  { patternConclusion: 'LEARNED_HELPLESSNESS', riskCode: 'LEARNED_HELPLESSNESS_RISK' },
  { patternConclusion: 'ANXIETY_DRIVEN', riskCode: 'ANXIETY_DRIVEN_RISK' },
  { patternConclusion: 'ADDICTIVE_RISK', riskCode: 'ADDICTIVE_RISK_BEHAVIOR' },
  { patternConclusion: 'NO_SELF_DRIVE', riskCode: 'NO_SELF_DRIVE_RISK' },
  { patternConclusion: 'DEFENSIVE_STANCE', riskCode: 'DEFENSIVE_STANCE_RISK' },

  // === 综合模式 → 综合风险 ===
  { patternConclusion: 'LEARNING_EXECUTION_GAP', riskCode: 'LEARNING_EXECUTION_GAP_RISK' },
  { patternConclusion: 'RIGID_BEHAVIOR', riskCode: 'COGNITION_EXECUTION_GAP_RISK' },
]

// ═══════════════════════════════════════
// run — Risk Engine 主入口
// ═══════════════════════════════════════

/**
 * run — 从 RiskInput 生成 RiskOutput
 *
 * @param {Object} input — createRiskInput(ctx) 的输出
 * @returns {Object} RiskOutput
 */
function run(input) {
  const { patterns, evidence } = input
  const allNegative = getAllNegativeFromPatterns(patterns)
  const evidences = evidence.evidences

  // 从 Pattern 构建 Risk 列表
  const risks = []
  const allEvidenceRefs = new Set()
  const allPatternRefs = new Set()

  for (const pattern of allNegative) {
    const mapping = PATTERN_TO_RISK.find(m => m.patternConclusion === pattern.conclusion)
    if (!mapping) continue

    const riskDef = RISK_CODES[mapping.riskCode]
    if (!riskDef) continue

    // 严重度 = Pattern severity（已在 Pattern 层计算）
    const severity = pattern.severity

    // 可逆性 = Pattern reversibility
    const reversibility = pattern.reversibility

    // 改善周期 = Pattern estimatedRecoveryDays
    const estimatedRecoveryDays = pattern.estimatedRecoveryDays

    // 增强证据引用：从 Evidence 中搜匹配标签
    const tagEvidences = []
    for (const tag of pattern.tags) {
      const tagEvs = getEvidencesByTag(evidences, tag)
      for (const ev of tagEvs) {
        if (!tagEvidences.find(e => e.id === ev.id)) {
          tagEvidences.push(ev)
        }
      }
    }

    const evidenceRefs = [
      ...pattern.evidenceRefs,
      ...tagEvidences.map(e => e.id),
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5)

    for (const ref of evidenceRefs) allEvidenceRefs.add(ref)
    allPatternRefs.add(pattern.id)

    risks.push({
      riskCode: mapping.riskCode,
      label: riskDef.label,
      category: riskDef.category,
      severity: Math.round(clamp(severity, 0, 100)),
      level: getSeverityLevel(severity),
      reversibility,
      estimatedRecoveryDays,
      evidenceRefs,
      patternRef: pattern.id,
      patternName: pattern.name,
    })
  }

  // 按严重度排序
  risks.sort((a, b) => b.severity - a.severity)

  // topRisk = 最严重的
  const topRisk = risks.length > 0
    ? {
        riskCode: risks[0].riskCode,
        label: risks[0].label,
        severity: risks[0].severity,
        reversibility: risks[0].reversibility,
        estimatedRecoveryDays: risks[0].estimatedRecoveryDays,
      }
    : {
        riskCode: 'NONE',
        label: '未检测到明显风险',
        severity: 0,
        reversibility: 'HIGH',
        estimatedRecoveryDays: 0,
      }

  // 总风险评分 = 加权平均（最严重风险加权更多）
  let totalRiskScore = 0
  if (risks.length > 0) {
    const weights = risks.map((_, i) => 1 / (i + 1))
    const weightSum = weights.reduce((a, b) => a + b, 0)
    totalRiskScore = Math.round(
      risks.reduce((sum, r, i) => sum + r.severity * (weights[i] / weightSum), 0)
    )
  }

  return createRiskOutput({
    version: '6.1.0',
    risks,
    topRisk,
    totalRiskScore,
    evidenceRefs: [...allEvidenceRefs],
    patternRefs: [...allPatternRefs],
  })
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function getAllNegativeFromPatterns(patterns) {
  return [
    ...patterns.action.filter(p => p.severity > 0),
    ...patterns.wealth.filter(p => p.severity > 0),
    ...patterns.psychology.filter(p => p.severity > 0),
  ]
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

module.exports = { run }
