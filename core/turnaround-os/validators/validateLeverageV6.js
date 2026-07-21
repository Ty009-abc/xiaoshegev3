/**
 * core/turnaround-os/validators/validateLeverageV6.js
 *
 * V6 杠杆推荐结果校验器
 */

const { LEVERAGE_TYPES } = require('../constants')

const FORBIDDEN_WORDS = ['稳赚', '必赚', '保证翻身', '保证收益', '保证赚钱', '100%']

function validateLeverageV6(result) {
  const errors = []
  const warnings = []

  if (!result || typeof result !== 'object') {
    errors.push('结果为空')
    return { valid: false, errors, warnings }
  }

  // primaryLeverage
  if (!result.primaryLeverage) {
    errors.push('缺少 primaryLeverage')
    return { valid: false, errors, warnings }
  }

  const primary = result.primaryLeverage

  if (!primary.type) errors.push('primaryLeverage.type 为空')
  if (!primary.label) errors.push('primaryLeverage.label 为空')
  if (!Object.values(LEVERAGE_TYPES).includes(primary.type)) {
    errors.push(`primaryLeverage.type 无效: ${primary.type}`)
  }

  if (primary.fitScore !== undefined && (primary.fitScore < 0 || primary.fitScore > 100)) {
    errors.push(`primaryLeverage.fitScore 越界: ${primary.fitScore}`)
  }

  // secondary 最多2个
  if (result.secondaryLeverages) {
    if (!Array.isArray(result.secondaryLeverages)) {
      errors.push('secondaryLeverages 不是数组')
    } else if (result.secondaryLeverages.length > 2) {
      errors.push(`secondaryLeverages 超过2个: ${result.secondaryLeverages.length}`)
    }
    for (const l of result.secondaryLeverages) {
      if (l && l.type === primary.type) {
        errors.push(`secondary 与 primary 相同: ${l.type}`)
      }
    }
  }

  // rejectedLeverages 至少3个
  if (result.rejectedLeverages) {
    if (!Array.isArray(result.rejectedLeverages)) {
      errors.push('rejectedLeverages 不是数组')
    } else if (result.rejectedLeverages.length < 3) {
      errors.push(`rejectedLeverages 不足3个: ${result.rejectedLeverages.length}`)
    }
    for (const l of result.rejectedLeverages) {
      if (!l.reason) warnings.push(`rejected ${l.type} 缺少原因`)
      if (l.blockingFactors && l.blockingFactors.length === 0) {
        warnings.push(`rejected ${l.type} blockingFactors 为空`)
      }
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

  // null (在 rejectedLeverages 中允许 null secondary)
  if (resultStr.includes(':null')) {
    warnings.push('输出包含 null 值')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

module.exports = { validateLeverageV6 }
