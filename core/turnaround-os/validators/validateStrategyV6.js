/**
 * core/turnaround-os/validators/validateStrategyV6.js
 *
 * V6 战略契约校验器
 */

const { PROBABILITY_TYPE, LEVERAGE_TYPES, SCORE_RANGE } = require('../constants')

const FORBIDDEN_WORDS = ['稳赚', '必赚', '保证翻身', '保证收益', '保证赚钱', '100%']

function validateStrategyV6(result) {
  const errors = []
  const warnings = []

  if (!result || typeof result !== 'object') {
    errors.push('结果为空')
    return { valid: false, errors, warnings }
  }

  // version
  if (result.version && result.version !== '6.0') {
    warnings.push(`version 不匹配: ${result.version}`)
  }

  // verdict
  if (!result.verdict) {
    errors.push('缺少 verdict')
  } else {
    if (result.verdict.strategyReadinessScore === undefined) {
      errors.push('缺少 strategyReadinessScore')
    } else {
      const srs = result.verdict.strategyReadinessScore
      if (srs < SCORE_RANGE.MIN || srs > SCORE_RANGE.MAX) {
        errors.push(`strategyReadinessScore 越界: ${srs}`)
      }
    }

    if (result.verdict.probabilityType !== PROBABILITY_TYPE) {
      warnings.push(`probabilityType 不是 ${PROBABILITY_TYPE}: ${result.verdict.probabilityType}`)
    }

    if (result.verdict.confidence !== undefined) {
      checkRange(result.verdict.confidence, 'verdict.confidence', errors)
    }

    if (!result.verdict.limitingFactors || !Array.isArray(result.verdict.limitingFactors) || result.verdict.limitingFactors.length === 0) {
      warnings.push('verdict.limitingFactors 为空')
    }

    if (!result.verdict.assumptions || !Array.isArray(result.verdict.assumptions) || result.verdict.assumptions.length === 0) {
      warnings.push('verdict.assumptions 为空')
    }
  }

  // identitySummary
  if (!result.identitySummary) {
    errors.push('缺少 identitySummary')
  }

  // wrongGame
  if (!result.wrongGame) {
    errors.push('缺少 wrongGame')
  } else {
    if (!result.wrongGame.type && !result.wrongGame.gameType) {
      warnings.push('wrongGame.type 为空')
    }
  }

  // primaryStrategy
  if (!result.primaryStrategy) {
    errors.push('缺少 primaryStrategy')
  } else {
    if (!result.primaryStrategy.primaryLeverage || !result.primaryStrategy.primaryLeverage.type) {
      errors.push('primaryStrategy 缺少有效 primaryLeverage')
    }
    if (!result.primaryStrategy.whatNotToDo || !Array.isArray(result.primaryStrategy.whatNotToDo) || result.primaryStrategy.whatNotToDo.length === 0) {
      warnings.push('primaryStrategy.whatNotToDo 为空')
    }
    if (!result.primaryStrategy.successCondition || !Array.isArray(result.primaryStrategy.successCondition) || result.primaryStrategy.successCondition.length === 0) {
      warnings.push('primaryStrategy.successCondition 为空')
    }
    if (!result.primaryStrategy.failureRisks || !Array.isArray(result.primaryStrategy.failureRisks) || result.primaryStrategy.failureRisks.length === 0) {
      warnings.push('primaryStrategy.failureRisks 为空')
    }
  }

  // evidence
  if (!result.evidence) {
    errors.push('缺少 evidence')
  } else {
    if (!result.evidence.ruleHits || !Array.isArray(result.evidence.ruleHits) || result.evidence.ruleHits.length === 0) {
      warnings.push('evidence.ruleHits 为空')
    }
  }

  // 禁止词
  const resultStr = JSON.stringify(result)
  for (const word of FORBIDDEN_WORDS) {
    if (resultStr.includes(word)) {
      errors.push(`包含禁止词: ${word}`)
    }
  }

  // undefined
  if (resultStr.includes('undefined')) {
    errors.push('输出包含 undefined')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

function checkRange(val, field, errors) {
  if (val < SCORE_RANGE.MIN || val > SCORE_RANGE.MAX) {
    errors.push(`${field} 越界: ${val} (范围 ${SCORE_RANGE.MIN}-${SCORE_RANGE.MAX})`)
  }
}

module.exports = { validateStrategyV6 }
