/**
 * core/turnaround-intelligence/engines/decisionEngine.js
 *
 * CP6-D Decision Engine — 从 CoreContradiction + Opportunity 推导唯一 PrimaryDecision
 *
 * One Decision Rule: 每份报告只输出一个 PrimaryDecision.
 *
 * Decision Confidence = 35% CoreContradiction + 25% Opportunity + 20% Feasibility + 20% EvidenceCoverage
 *
 * @version 6.2.0
 * @checkpoint CP6-D
 */

const { DECISION_CATALOG, CONTRADICTION_TO_DECISION, createDecision } = require('../contracts/decision')

function run(input) {
  const cc = input.coreContradiction || {}
  const opp = input.opportunity || {}
  const risk = input.risk || {}
  const evidence = input.evidence || {}

  // Step 1: 从 CoreContradiction 映射到 Decision
  const ccCode = cc.code
  let decisionCode = null
  let reason = null

  // 检查是否是回退的 CoreContradiction（不可信，只有 1 个 supportedBy）
  const riskTop = risk.topRisks || []
  const isFallbackCC = !cc.supportedBy || cc.supportedBy.length <= 1

  if (ccCode && CONTRADICTION_TO_DECISION[ccCode] && !isFallbackCC) {
    // 检查是否有更紧急的 Risk 需要覆盖（收入结构风险优先）
    const riskDerived = riskTop.length > 0 ? deriveFromRisk(riskTop[0].riskCode) : null
    if (riskDerived && hasHigherPriorityRisk(riskTop, ccCode)) {
      decisionCode = riskDerived
      reason = `根据更紧急的风险 "${riskTop[0].title}" 推导（覆盖默认决策）`
    } else {
      decisionCode = CONTRADICTION_TO_DECISION[ccCode].primary
      reason = CONTRADICTION_TO_DECISION[ccCode].reason
    }
  }

  // Step 2: 无有效 CoreContradiction → 从 Risk 推导
  if (!decisionCode) {
    if (riskTop.length > 0) {
      decisionCode = deriveFromRisk(riskTop[0].riskCode)
      reason = `根据最严重风险 "${riskTop[0].title}" 推导`
    }
  }

  // Step 3: 证据不足 → UNKNOWN
  if (!decisionCode) {
    decisionCode = 'UNKNOWN'
    reason = '当前证据不足，无法确定唯一决策'
  }

  // Step 4: 计算 Decision Confidence
  const confidence = calculateDecisionConfidence(cc, opp, risk, evidence, decisionCode)

  return createDecision({
    code: decisionCode,
    confidence,
    coreContradiction: ccCode || null,
    opportunity: (opp.topOpportunities || [])[0]?.opportunityCode || null,
  })
}

// ═══════════════════════════════════════
// Decision Confidence 公式
// ═══════════════════════════════════════

function calculateDecisionConfidence(cc, opp, risk, evidence, decisionCode) {
  let score = 0

  // 35%: CoreContradiction severity
  const ccSeverity = cc.severity || 0
  const ccFactor = ccSeverity / 100
  score += 0.35 * ccFactor

  // 25%: Opportunity expectedImpact
  const topOpp = (opp.topOpportunities || [])[0]
  const oppFactor = topOpp ? (topOpp.expectedImpact || 0) / 100 : 0
  score += 0.25 * oppFactor

  // 20%: Feasibility — 基于 Risk 反向
  const riskScore = (risk.totalRiskScore || 50) / 100
  score += 0.20 * (1 - riskScore * 0.5)

  // 20%: Evidence Coverage
  const evCount = (evidence.evidences || []).length
  const coverageFactor = Math.min(evCount / 8, 1)
  score += 0.20 * coverageFactor

  return Math.min(score, 0.95)
}

// ═══════════════════════════════════════
// Fallback: Risk → Decision
// ═══════════════════════════════════════

const RISK_TO_DECISION_FALLBACK = {
  'INCOME_STRUCTURE_RISK':     'BUILD_SECOND_INCOME',
  'LOW_ASSET_ACCUMULATION':    'CREATE_ASSET_ACCUMULATION',
  'LOW_DISCIPLINE':            'BUILD_DISCIPLINE',
  'DECISION_FATIGUE':          'REDUCE_DECISION_FATIGUE',
  'LOW_SKILL_COMPOUNDING':     'DEEPEN_SPECIALIZATION',
  'HIGH_OPPORTUNITY_COST':     'INCREASE_MONETIZATION',
  'ANALYSIS_PARALYSIS':        'BUILD_EXECUTION_SYSTEM',
  'EXECUTION_FRAGMENTATION':   'BUILD_EXECUTION_SYSTEM',
  'PASSIVE_MINDSET':           'STRENGTHEN_LONG_TERM_HABITS',
  'SHORT_TERM_ADDICTION':      'IMPROVE_CONTENT_OUTPUT',
  'EMOTIONAL_VOLATILITY':      'BUILD_DISCIPLINE',
  'RISK_MISJUDGMENT':          'REBUILD_RISK_FRAMEWORK',
}

function deriveFromRisk(riskCode) {
  return RISK_TO_DECISION_FALLBACK[riskCode] || null
}

/**
 * 高优先级风险覆盖：当存在收入/资产类风险时，优先处理这些而非思考/执行类问题
 */
function hasHigherPriorityRisk(riskTop, ccCode) {
  const priorityRisks = ['INCOME_STRUCTURE_RISK', 'LOW_ASSET_ACCUMULATION', 'RISK_MISJUDGMENT']
  const lowPriorityCC = ['STABILITY_GROWTH_CONFLICT', 'AMBITION_DISCIPLINE_CONFLICT', 'LEARNING_EXECUTION_CONFLICT']
  if (!lowPriorityCC.includes(ccCode)) return false
  return riskTop.some(r => priorityRisks.includes(r.riskCode))
}

module.exports = { run }
