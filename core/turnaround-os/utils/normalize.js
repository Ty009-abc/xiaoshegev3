/**
 * core/turnaround-os/utils/normalize.js
 *
 * 通用数据清洗函数
 */

const { SCORE_RANGE } = require('../constants')

/**
 * 清洗数组
 */
function cleanArray(arr) {
  if (!Array.isArray(arr)) return []
  return arr.filter(v => v !== null && v !== undefined).map(v => String(v))
}

/**
 * 清洗字符串
 */
function cleanString(val, defaultValue) {
  if (val === undefined || val === null) return String(defaultValue || '')
  return String(val)
}

/**
 * 清洗数值 [0, 100]
 */
function cleanScore(val, defaultValue) {
  if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) {
    return defaultValue !== undefined ? defaultValue : 0
  }
  const n = Number(val)
  if (isNaN(n)) return defaultValue !== undefined ? defaultValue : 0
  return Math.max(SCORE_RANGE.MIN, Math.min(SCORE_RANGE.MAX, Math.round(n)))
}

/**
 * 清洗数字（通用范围）
 */
function cleanNumber(val, defaultValue, min, max) {
  const mMin = min !== undefined ? min : 0
  const mMax = max !== undefined ? max : Number.MAX_SAFE_INTEGER
  if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) {
    return defaultValue !== undefined ? defaultValue : mMin
  }
  const n = Number(val)
  if (isNaN(n)) return defaultValue !== undefined ? defaultValue : mMin
  return Math.max(mMin, Math.min(mMax, Math.round(n)))
}

/**
 * 深度清洗对象，确保无 null/undefined
 */
function deepClean(obj, template) {
  if (obj === null || obj === undefined) return template

  if (Array.isArray(template)) {
    return Array.isArray(obj) ? obj : [...template]
  }

  if (typeof template === 'object') {
    const result = {}
    for (const key of Object.keys(template)) {
      result[key] = deepClean(obj[key], template[key])
    }
    return result
  }

  if (typeof template === 'number') {
    return cleanScore(obj, template)
  }

  if (typeof template === 'string') {
    return cleanString(obj, template)
  }

  return template
}

module.exports = {
  cleanArray,
  cleanString,
  cleanScore,
  cleanNumber,
  deepClean,
}
