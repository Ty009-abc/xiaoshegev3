/**
 * lib/response.js - 统一返回格式（RC8_13 虚拟支付）
 */
const { CODES } = require('./errorCodes.js')

function ok(data, message) {
  return { code: CODES.OK, message: message || 'success', data: data !== undefined ? data : null }
}
function fail(code, message, data) {
  return { code: code || CODES.UNKNOWN, message: message || 'error', data: data !== undefined ? data : null }
}
module.exports = { ok, fail, CODES }
