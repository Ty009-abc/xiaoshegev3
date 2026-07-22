/**
 * core/turnaround-intelligence/engines/opportunityEngine.js
 *
 * CP6-C.1 Opportunity Engine — 从 Conflict 推导最佳机会
 *
 * 数据流: Conflict → Opportunity
 *
 * 输出: Top 3 Opportunity
 *
 * @version 6.1.0
 * @checkpoint CP6-C.1
 */

const { OPPORTUNITY_CATALOG, CONFLICT_TO_OPPORTUNITY, createOpportunityOutput } = require('../contracts/opportunity')

/**
 * run — 从 Conflict + Risk + Leverage 推导 Opportunity
 */
function run(input) {
  const conflicts = (input.conflicts || {}).conflicts || []
  const riskTop = (input.risk || {}).topRisks || []
  const leverageTop = (input.leverage || {}).topLeverages || []

  if (conflicts.length === 0) {
    // 回退: 从 Risk 直接推导
    if (riskTop.length > 0) {
      const fallbackOpp = deriveFromRisk(riskTop[0])
      if (fallbackOpp) {
        return createOpportunityOutput({
          version: '6.1.0',
          topOpportunities: [{ ...fallbackOpp, priority: 1 }],
          totalOpportunityScore: fallbackOpp.expectedImpact,
        })
      }
    }
    return createOpportunityOutput({
      version: '6.1.0',
      topOpportunities: [],
      totalOpportunityScore: 0,
    })
  }

  const oppMap = new Map()

  for (const conflict of conflicts) {
    const oppCode = CONFLICT_TO_OPPORTUNITY[conflict.code]
    if (!oppCode) continue

    const def = OPPORTUNITY_CATALOG[oppCode]
    if (!def) continue

    // expectedImpact = conflict.severity × 匹配度
    // 冲突越严重，解决它带来的影响越大
    const expectedImpact = Math.round(conflict.severity * 0.85 + 15)

    // confidence = conflict 严重度越高，说明数据越充分
    const confidence = clamp(0.7 + (conflict.severity - 50) * 0.3 / 50, 0.5, 0.95)

    // 收集 basedOn 引用
    const riskRef = findMatchingRisk(conflict.riskRef, riskTop)
    const leverageRef = findMatchingLeverage(conflict.leverageRef, leverageTop)

    if (!oppMap.has(oppCode) || expectedImpact > oppMap.get(oppCode).expectedImpact) {
      oppMap.set(oppCode, {
        opportunityCode: oppCode,
        title: def.title,
        description: def.description,
        priority: 0,
        window: def.window,
        difficulty: def.difficulty,
        expectedImpact,
        confidence,
        basedOn: {
          conflict: conflict.code,
          risk: conflict.riskRef,
          leverage: conflict.leverageRef,
        },
      })
    }
  }

  // 如果没有冲突驱动 → 从单一 Risk 中推导
  if (oppMap.size === 0 && riskTop.length > 0) {
    const topRisk = riskTop[0]
    const fallbackOpp = deriveFromRisk(topRisk)
    if (fallbackOpp) oppMap.set(fallbackOpp.opportunityCode, fallbackOpp)
  }

  // 排序
  const opportunities = [...oppMap.values()]
  opportunities.sort((a, b) => b.expectedImpact - a.expectedImpact)

  const topOpportunities = opportunities.slice(0, 3).map((o, i) => ({
    ...o,
    priority: i + 1,
  }))

  let totalScore = 0
  if (topOpportunities.length > 0) {
    totalScore = Math.round(
      topOpportunities.reduce((s, o, i) => s + o.expectedImpact / (i + 1), 0) /
      topOpportunities.reduce((s, _, i) => s + 1 / (i + 1), 0)
    )
  }

  return createOpportunityOutput({
    version: '6.1.0',
    topOpportunities,
    totalOpportunityScore: totalScore,
  })
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function findMatchingRisk(riskRef, riskTop) {
  return riskTop.find(r => r.riskCode === riskRef) ? riskRef : (riskTop[0] ? riskTop[0].riskCode : null)
}

function findMatchingLeverage(levRef, leverageTop) {
  return leverageTop.find(l => l.code === levRef) ? levRef : (leverageTop[0] ? leverageTop[0].code : null)
}

/**
 * 无 Conflict 时从单一 Risk 推导
 */
const RISK_TO_OPPORTUNITY_FALLBACK = {
  'INCOME_STRUCTURE_RISK': 'INCOME_DIVERSIFICATION',
  'LOW_DISCIPLINE': 'DISCIPLINE_BUILDING',
  'LOW_ASSET_ACCUMULATION': 'ASSET_ACCUMULATION_START',
  'PASSIVE_MINDSET': 'MINDSET_SHIFT',
  'DECISION_FATIGUE': 'DECISION_SIMPLIFICATION',
  'LOW_SKILL_COMPOUNDING': 'SKILL_DEEPENING',
}

function deriveFromRisk(risk) {
  const oppCode = RISK_TO_OPPORTUNITY_FALLBACK[risk.riskCode]
  if (!oppCode) return null

  const def = OPPORTUNITY_CATALOG[oppCode]
  if (!def) return null

  return {
    opportunityCode: oppCode,
    title: def.title,
    description: def.description,
    priority: 0,
    window: def.window,
    difficulty: def.difficulty,
    expectedImpact: Math.round(risk.severity * 0.7),
    confidence: risk.confidence || 0.7,
    basedOn: { conflict: null, risk: risk.riskCode, leverage: null },
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
module.exports = { run }
