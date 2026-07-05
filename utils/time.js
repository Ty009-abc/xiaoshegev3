/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * 时间工具函数
 */

/** 获取当前时间戳 (ms) */
function now() {
  return Date.now()
}

/**
 * 格式化日期
 * @param {number} timestamp - 时间戳 (ms)
 * @param {string} fmt - 格式，如 'YYYY-MM-DD HH:mm:ss'
 */
function formatDate(timestamp, fmt) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const o = {
    'Y+': d.getFullYear(),
    'M+': d.getMonth() + 1,
    'D+': d.getDate(),
    'H+': d.getHours(),
    'm+': d.getMinutes(),
    's+': d.getSeconds(),
  }
  for (const k in o) {
    const match = new RegExp('(' + k + ')').exec(fmt)
    if (match) {
      const v = String(o[k])
      fmt = fmt.replace(match[1], match[1].length === 1 ? v : v.padStart(2, '0'))
    }
  }
  return fmt
}

/**
 * 增加天数
 * @param {number} timestamp - 时间戳 (ms)，默认 now()
 * @param {number} days - 天数，支持负数
 */
function addDays(days, timestamp) {
  const base = timestamp || now()
  return base + days * 24 * 60 * 60 * 1000
}

/**
 * 增加小时
 */
function addHours(hours, timestamp) {
  const base = timestamp || now()
  return base + hours * 60 * 60 * 1000
}

/**
 * 判断是否过期
 * @param {number} expiredAt - 过期时间戳 (ms)
 */
function isExpired(expiredAt) {
  if (!expiredAt) return true
  return now() > expiredAt
}

/**
 * 获取当天起始时间戳 (00:00:00)
 */
function startOfDay(ts) {
  const d = new Date(ts || now())
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * 获取当天结束时间戳 (23:59:59)
 */
function endOfDay(ts) {
  return startOfDay(ts) + 24 * 60 * 60 * 1000 - 1
}

/**
 * 两个时间戳是否是同一天
 */
function isSameDay(a, b) {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate()
}

module.exports = {
  now,
  formatDate,
  addDays,
  addHours,
  isExpired,
  startOfDay,
  endOfDay,
  isSameDay,
}
