/**
 * core/turnaround-os/utils/deterministic.js
 *
 * 确定性工具：确保同一输入产生同一输出
 * 禁止 Math.random 在核心引擎中使用
 */

/**
 * 确定性排序：按 key 字母序排列
 * @param {Array} arr
 * @param {string} key
 * @returns {Array}
 */
function sortByKey(arr, key) {
  if (!Array.isArray(arr)) return []
  return [...arr].sort((a, b) => {
    const va = String(a[key] || '')
    const vb = String(b[key] || '')
    return va.localeCompare(vb)
  })
}

/**
 * 确定性选择：从有序数组中取第一个匹配
 * @param {Array} items - 已按优先级排好序的选项
 * @param {Function} predicate
 * @returns {Object|null}
 */
function firstMatch(items, predicate) {
  if (!Array.isArray(items)) return null
  for (const item of items) {
    if (predicate(item)) return item
  }
  return null
}

/**
 * 确定性打分：所有条件按顺序评估
 * @param {Array<{condition: boolean, score: number, ruleId: string}>} rules
 * @returns {{total: number, hits: Array}}
 */
function deterministicScore(rules) {
  let total = 0
  const hits = []
  for (const rule of rules) {
    if (rule.condition) {
      total += (rule.score || 0)
      hits.push(rule.ruleId)
    }
  }
  return { total: Math.max(0, Math.min(100, total)), hits }
}

/**
 * 确定性哈希（简版，确保同输入同输出）
 * @param {string} str
 * @returns {string}
 */
function simpleHash(str) {
  let hash = 0
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return 'hash_' + String(Math.abs(hash))
}

module.exports = {
  sortByKey,
  firstMatch,
  deterministicScore,
  simpleHash,
}
