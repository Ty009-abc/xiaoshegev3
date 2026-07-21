/**
 * core/turnaround-os/validators/validateIdentityV6.js
 *
 * V6 身份画像校验器
 */

const { SCORE_RANGE } = require('../constants')

const REQUIRED_SECTIONS = ['identity', 'reality', 'capabilities', 'psychology', 'assets', 'constraints', 'currentGame', 'potential', 'evidence']

function validateIdentityV6(profile) {
  const errors = []
  const warnings = []

  if (!profile || typeof profile !== 'object') {
    errors.push('输入不是有效对象')
    return { valid: false, errors, warnings }
  }

  // version
  if (profile.version && profile.version !== '6.0') {
    warnings.push(`version 为 ${profile.version}，预期 6.0`)
  }

  // 必填 section
  for (const sec of REQUIRED_SECTIONS) {
    if (profile[sec] === undefined || profile[sec] === null) {
      errors.push(`缺少必填段：${sec}`)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  // reality 数值范围
  if (profile.reality) {
    checkRange(profile.reality.monthlyIncome, 0, Number.MAX_SAFE_INTEGER, 'reality.monthlyIncome', warnings)
    checkRange(profile.reality.monthlyExpense, 0, Number.MAX_SAFE_INTEGER, 'reality.monthlyExpense', warnings)
    checkRange(profile.reality.savings, 0, Number.MAX_SAFE_INTEGER, 'reality.savings', warnings)
    checkRange(profile.reality.debt, 0, Number.MAX_SAFE_INTEGER, 'reality.debt', warnings)
    checkRange(profile.reality.availableHoursPerWeek, 0, 168, 'reality.availableHoursPerWeek', warnings)
    checkRange(profile.reality.incomeStability, SCORE_RANGE.MIN, SCORE_RANGE.MAX, 'reality.incomeStability', warnings)
    checkRange(profile.reality.safetyMonths, 0, 120, 'reality.safetyMonths', warnings)
  }

  // capabilities 0-100
  if (profile.capabilities) {
    const capKeys = ['execution', 'learning', 'communication', 'sales', 'content', 'aiAdaptability', 'systemThinking', 'discipline']
    for (const key of capKeys) {
      checkRange(profile.capabilities[key], SCORE_RANGE.MIN, SCORE_RANGE.MAX, `capabilities.${key}`, warnings)
    }
  }

  // psychology 0-100
  if (profile.psychology) {
    const psychKeys = ['riskTolerance', 'anxiety', 'desire', 'patience', 'selfAwareness', 'externalAttribution']
    for (const key of psychKeys) {
      checkRange(profile.psychology[key], SCORE_RANGE.MIN, SCORE_RANGE.MAX, `psychology.${key}`, warnings)
    }
  }

  // assets 是数组
  if (profile.assets) {
    const assetKeys = ['skills', 'experiences', 'resources', 'audience', 'credentials', 'reusableAssets']
    for (const key of assetKeys) {
      if (!Array.isArray(profile.assets[key])) {
        warnings.push(`assets.${key} 应为数组`)
      }
    }
  }

  // undefined 检查
  const json = JSON.stringify(profile)
  if (json.includes('undefined')) {
    errors.push('输出包含 undefined 值')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

function checkRange(val, min, max, field, problems) {
  if (val === undefined || val === null) return
  if (typeof val !== 'number' || isNaN(val)) {
    problems.push(`${field} 不是有效数值: ${val}`)
    return
  }
  if (val < min || val > max) {
    problems.push(`${field} 超出范围 [${min}, ${max}]: ${val}`)
  }
}

module.exports = { validateIdentityV6 }
