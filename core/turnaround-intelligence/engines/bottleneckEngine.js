/**
 * core/turnaround-intelligence/engines/bottleneckEngine.js
 *
 * CP6-D Bottleneck Engine — 基于当前行为模式预测最可能失败点
 *
 * 数据流: Pattern → 最可能瓶颈
 *
 * 不是确定性预测——是基于当前行为模式的风险预估。
 *
 * @version 6.2.0
 * @checkpoint CP6-D
 */

const { BOTTLENECK_CATALOG, PATTERN_TO_BOTTLENECK, createBottleneckOutput } = require('../contracts/bottleneck')

function run(input) {
  const patterns = (input.patterns || {}).patterns || []
  const risk = input.risk || {}
  const evidence = input.evidence || {}

  if (patterns.length === 0) {
    return createBottleneckOutput({
      version: '6.2.0',
      code: 'EXECUTION_CONTINUITY',
      probability: 0.25,
      expectedWeek: 4,
      reason: '证据不足，假定执行连续性为最常见瓶颈',
      prevention: ['尽快收集足够的行为数据以精准识别瓶颈'],
    })
  }

  // 评分：每个匹配的额映射 Pattern（按 severity 降序）
  const patternSeverityMap = patterns.reduce((m, p) => {
    m[p.code] = p.strength || 0.5
    return m
  }, {})

  // 对每个可能的瓶颈打分
  const bottleneckScores = {}
  for (const pattern of patterns) {
    const bCode = PATTERN_TO_BOTTLENECK[pattern.code]
    if (!bCode) continue
    const botDef = BOTTLENECK_CATALOG[bCode]
    if (!botDef) continue

    const pStrength = pattern.strength || 0.5
    // 概率 = Pattern strength × (1 + risk severity boost)
    const riskSeverityBoost = ((risk.totalRiskScore || 50) - 50) / 100
    const probability = Math.min(pStrength * (1 + riskSeverityBoost), 0.95)

    if (!bottleneckScores[bCode] || probability > bottleneckScores[bCode].probability) {
      bottleneckScores[bCode] = {
        code: bCode,
        probability,
        expectedWeek: botDef.typicalWeek,
        reason: `当前 "${pattern.code}" 模式严重度 ${Math.round(pStrength * 100)}%，经验数据表明这类模式在 ${botDef.typicalWeek} 周左右最容易出问题`,
        prevention: botDef.preventionDefault,
      }
    }
  }

  // 按概率降序，取最高那个
  const candidates = Object.values(bottleneckScores)
  candidates.sort((a, b) => b.probability - a.probability)

  if (candidates.length === 0) {
    return createBottleneckOutput({
      version: '6.2.0',
      code: 'MOTIVATION_DECAY',
      probability: 0.25,
      expectedWeek: 6,
      reason: '未检测到明确的瓶颈模式，设定保守估计',
      prevention: ['持续记录行为数据以发现模式'],
    })
  }

  const winner = candidates[0]

  return createBottleneckOutput({
    version: '6.2.0',
    code: winner.code,
    probability: winner.probability,
    expectedWeek: winner.expectedWeek,
    reason: winner.reason,
    prevention: winner.prevention,
  })
}

module.exports = { run }
