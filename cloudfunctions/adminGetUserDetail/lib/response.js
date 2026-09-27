/**
 * common/response.js - 统一返回格式
 * @module common/response
 */

const { CODES } = require('./errorCodes.js')

function ok(data, message) {
  return {
    code: CODES.OK,
    message: message || 'success',
    data: data !== undefined ? data : null,
  }
}

function fail(code, message) {
  return {
    code: code || CODES.UNKNOWN,
    message: message || 'error',
    data: null,
  }
}

module.exports = { ok, fail, CODES }
