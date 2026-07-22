/**
 * core/turnaround-intelligence/renderers/potentialRenderer.js
 *
 * CP6-E Potential Renderer — 翻身潜力
 *
 * 数据来源: Feasibility + Risk.reversibility + Opportunity.window
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

const { createPotentialOutput } = require('../contracts/narrative/potential')

function run(input) {
  const feasibility = input.feasibility || {}
  const risk = input.risk || {}
  const opportunity = input.opportunity || {}
  const conflict = input.conflicts || {}

  // Score: 基于 Feasibility（占 60%） + Risk 可逆性（占 40%）
  const fScore = feasibility.score || 50
  const riskReversibility = getReversibilityScore(risk.topRisks || [])
  const rawScore = fScore * 0.6 + riskReversibility * 0.4
  const score = Math.round(Math.min(rawScore, 100))

  // Level
  let level = 'LOW'
  if (score >= 75) level = 'HIGH'
  else if (score >= 50) level = 'MEDIUM'

  // Reversibility: 取最严重 Risk 的可逆性
  const topRisk = (risk.topRisks || [])[0]
  const reversibility = topRisk ? topRisk.reversibility : 'MEDIUM'

  // Recovery Days: 从 Risk + Opportunity 估算
  const recoveryDays = topRisk
    ? topRisk.estimatedRecoveryDays || 90
    : 120

  // Window: 基于 Opportunity
  const topOpp = (opportunity.topOpportunities || [])[0]
  let windowStatus = 'CLOSING'
  let durationDays = recoveryDays

  if (topOpp) {
    if (topOpp.window === 'NEXT_30_DAYS' || topOpp.window === 'NEXT_60_DAYS') windowStatus = 'OPEN'
    else if (topOpp.window === 'NEXT_90_DAYS') windowStatus = 'OPEN'
    else windowStatus = 'CLOSING'

    if (topOpp.window === 'NEXT_180_DAYS') durationDays = 180
    else if (topOpp.window === 'NEXT_90_DAYS') durationDays = 90
    else if (topOpp.window === 'NEXT_60_DAYS') durationDays = 60
    else durationDays = 30
  }

  // 如果 score 特别低 → CLOSED
  if (score < 35) windowStatus = 'CLOSED'

  return createPotentialOutput({
    version: '6.3.0',
    score,
    level,
    reversibility,
    estimatedRecoveryDays: recoveryDays,
    window: { status: windowStatus, durationDays },
  })
}

function getReversibilityScore(risks) {
  if (risks.length === 0) return 30
  const scores = risks.map(r => {
    if (r.reversibility === 'HIGH') return 85
    if (r.reversibility === 'MEDIUM') return 55
    return 25
  })
  return scores.reduce((s, v, i) => s + v / (i + 1), 0) /
         scores.reduce((s, _, i) => s + 1 / (i + 1), 0)
}

module.exports = { run }
