/**
 * core/turnaround-intelligence/engines/feasibilityEngine.js
 *
 * CP6-D Feasibility Engine — "这个方案你做得成吗？"
 *
 * 独立评分，不复用 Potential。
 *
 * Feasibility = 执行力×35 + 资源匹配度×25 + 时间窗口×20 + 证据充分度×20
 *
 * @version 6.2.0
 * @checkpoint CP6-D
 */

const { createFeasibilityOutput } = require('../contracts/feasibility')

function run(input) {
  const profile = input.profile || {}
  const cognitive = input.cognitive || {}
  const risk = input.risk || {}
  const leverage = input.leverage || {}
  const evidence = input.evidence || {}
  const opportunity = input.opportunity || {}
  const decision = (input.decision || {}).primaryDecision || {}

  const advantages = []
  const constraints = []

  // 1. 执行力因子 (35%)
  const execScore = parseProfileDimension(profile, 'execution') || 50
  const execFactor = execScore / 100

  // 2. 资源匹配度 (25%)
  // 基于 Leverage strength + 是否有与 Decision 匹配的杠杆
  const leverageTop = leverage.topLeverages || []
  const resourceBase = leverageTop.length > 0
    ? leverageTop.reduce((s, l) => s + (l.strength || 50), 0) / leverageTop.length
    : 40
  const resourceFactor = resourceBase / 100

  // 3. 时间窗口 (20%)
  const topOpp = (opportunity.topOpportunities || [])[0]
  let windowFactor = 0.5
  if (topOpp) {
    if (topOpp.window === 'NEXT_30_DAYS' || topOpp.window === 'NEXT_60_DAYS') windowFactor = 0.9
    else if (topOpp.window === 'NEXT_90_DAYS') windowFactor = 0.75
    else windowFactor = 0.6
  }

  // 4. 证据充分度 (20%)
  const evCount = (evidence.evidences || []).length
  const evidenceFactor = Math.min(evCount / 8, 1)

  // 综合得分
  const rawScore = (execFactor * 0.35 + resourceFactor * 0.25 + windowFactor * 0.20 + evidenceFactor * 0.20) * 100
  const score = Math.round(Math.min(rawScore, 100))

  // 优势收集
  if (execFactor > 0.6) advantages.push(`执行力较充足 (${Math.round(execScore)})`)
  if (resourceBase > 55) advantages.push(`具备可用资源与能力 (${Math.round(resourceBase)})`)
  if (leverageTop.length >= 2) advantages.push(`多个可利用的杠杆`)

  // 限制收集
  if (execFactor < 0.45) constraints.push(`执行连续性不足 (${Math.round(execScore)})`)
  if (resourceBase < 45) constraints.push(`可用资源有限 (${Math.round(resourceBase)})`)
  if (evCount < 4) constraints.push(`证据不够充分，置信度降低`)
  if ((risk.topRisks || []).length >= 3) constraints.push(`风险因素较多`)
  const totalRisk = risk.totalRiskScore || 50
  if (totalRisk > 65) constraints.push(`总风险偏高 (${totalRisk})`)

  if (constraints.length === 0) constraints.push(`目前未发现明显限制`)

  // 置信度 = evidenceFactor
  const confidence = Math.min(0.5 + evidenceFactor * 0.45, 0.95)

  return createFeasibilityOutput({
    version: '6.2.0',
    score,
    confidence,
    advantages: advantages.length > 0 ? advantages : ['具备基本的学习能力和改变意愿'],
    constraints,
  })
}

function parseProfileDimension(profile, dim) {
  const d = (profile.dimensions || {})[dim]
  if (!d) return null
  return d.score || d.level === 'HIGH' ? 80 : d.level === 'MEDIUM' ? 55 : 30
}

module.exports = { run }
