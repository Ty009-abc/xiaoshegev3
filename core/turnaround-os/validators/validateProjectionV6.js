/**
 * core/turnaround-os/validators/validateProjectionV6.js
 *
 * V6 命运推演校验器
 */

const { SCORE_RANGE } = require('../constants')

const FORBIDDEN_WORDS = ['稳赚', '必赚', '保证翻身', '保证收益', '100%']
const FORBIDDEN_PATTERNS = [
  /月入\d+万/, /年入\d+万/, /赚\d+万/, /挣\d+万/,
  /保证.*钱/,
]

function validateProjectionV6(projection) {
  const errors = []
  const warnings = []

  if (!projection || typeof projection !== 'object') {
    errors.push('推演结果为空')
    return { valid: false, errors, warnings }
  }

  // World A 必须存在
  if (!projection.worldA || typeof projection.worldA !== 'object') {
    errors.push('worldA 缺失')
  } else {
    validateWorld(projection.worldA, 'worldA', errors, warnings)
  }

  // World B 必须存在
  if (!projection.worldB || typeof projection.worldB !== 'object') {
    errors.push('worldB 缺失')
  } else {
    validateWorld(projection.worldB, 'worldB', errors, warnings)
  }

  // Comparison 必须存在
  if (!projection.comparison || typeof projection.comparison !== 'object') {
    errors.push('comparison 缺失')
  } else {
    if (!projection.comparison.biggestGap) warnings.push('comparison.biggestGap 为空')
    if (!projection.comparison.biggestRisk) warnings.push('comparison.biggestRisk 为空')
    if (!projection.comparison.biggestOpportunity) warnings.push('comparison.biggestOpportunity 为空')
    if (!projection.comparison.mostWorthChanging) warnings.push('comparison.mostWorthChanging 为空')
    if (!projection.comparison.forkPoint) warnings.push('comparison.forkPoint 为空')
  }

  // DecisionNodes 必须存在
  if (!projection.decisionNodes || !Array.isArray(projection.decisionNodes)) {
    warnings.push('decisionNodes 为空或不是数组')
  } else if (projection.decisionNodes.length === 0) {
    warnings.push('decisionNodes 数组为空')
  } else {
    for (const node of projection.decisionNodes) {
      if (!node.node) errors.push('decisionNode 缺少 node')
      if (!node.trigger) errors.push('decisionNode 缺少 trigger')
    }
  }

  // Assumptions 必须非空
  if (!projection.assumptions || !Array.isArray(projection.assumptions) || projection.assumptions.length === 0) {
    errors.push('assumptions 缺失或为空')
  }

  // LimitingFactors 必须非空
  if (!projection.limitingFactors || !Array.isArray(projection.limitingFactors) || projection.limitingFactors.length === 0) {
    errors.push('limitingFactors 缺失或为空')
  }

  // Confidence 范围
  if (projection.projectionConfidence !== undefined) {
    if (projection.projectionConfidence < SCORE_RANGE.MIN || projection.projectionConfidence > SCORE_RANGE.MAX) {
      errors.push(`projectionConfidence 越界: ${projection.projectionConfidence}`)
    }
  } else {
    errors.push('projectionConfidence 缺失')
  }

  // 禁止词检查
  const resultStr = JSON.stringify(projection)
  for (const word of FORBIDDEN_WORDS) {
    if (resultStr.includes(word)) {
      errors.push(`包含禁止词: ${word}`)
    }
  }

  // 禁止具体收入预测
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(resultStr)) {
      errors.push(`包含疑似收入预测: ${pattern}`)
    }
  }

  // undefined check
  if (resultStr.includes('undefined')) {
    errors.push('输出包含 undefined')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

function validateWorld(world, label, errors, warnings) {
  // Must have day90 / day365 / year3
  for (const period of ['day90', 'day365', 'year3']) {
    if (!world[period]) {
      errors.push(`${label}.${period} 缺失`)
    } else {
      validateSnapshot(world[period], `${label}.${period}`, errors, warnings)
    }
  }
}

function validateSnapshot(snap, label, errors, warnings) {
  const requiredFields = ['status', 'incomeTrend', 'cashflowTrend', 'assetTrend',
    'freedomTrend', 'stressTrend', 'careerTrend', 'riskTrend', 'overallTrajectory']
  for (const f of requiredFields) {
    if (!snap[f]) {
      warnings.push(`${label}.${f} 缺失`)
    }
  }
  if (!snap.summary) warnings.push(`${label}.summary 缺失`)
}

module.exports = { validateProjectionV6 }
