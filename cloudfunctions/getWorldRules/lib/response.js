/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * 共享错误码 & 返回格式
 * 放此文件到每个云函数目录下作为 lib/response.js
 */

// ── 错误码 ──
const CODES = {
  SUCCESS:              0,
  AUTH_FAILED:          401,
  PARAM_ERROR:          400,
  NOT_FOUND:            404,
  FREE_QUOTA_USED_UP:   1001,
  NEED_PAYMENT:         1002,
  MEMBERSHIP_EXPIRED:   1003,
  ORDER_EXPIRED:        2001,
  ORDER_NOT_FOUND:      2002,
  REFUND_FAILED:        2003,
  AI_CALL_FAILED:       3001,
  AI_QUOTA_EXCEEDED:    3002,
  DB_ERROR:             4001,
  SERVER_ERROR:         5000,
}

// ── 错误消息 ──
const MSGS = {
  [CODES.SUCCESS]:              'success',
  [CODES.AUTH_FAILED]:          '登录态失效，请重新登录',
  [CODES.PARAM_ERROR]:          '参数错误',
  [CODES.NOT_FOUND]:            '资源不存在',
  [CODES.FREE_QUOTA_USED_UP]:   '免费次数已用完',
  [CODES.NEED_PAYMENT]:         '需要付费解锁',
  [CODES.MEMBERSHIP_EXPIRED]:   '会员已过期',
  [CODES.ORDER_EXPIRED]:        '订单已过期',
  [CODES.ORDER_NOT_FOUND]:      '订单不存在',
  [CODES.REFUND_FAILED]:        '退款失败',
  [CODES.AI_CALL_FAILED]:       'AI 调用失败',
  [CODES.AI_QUOTA_EXCEEDED]:    'AI 调用次数超限',
  [CODES.DB_ERROR]:             '数据库操作失败',
  [CODES.SERVER_ERROR]:         '服务器内部错误',
}

/**
 * 成功返回
 * @param {*} data
 * @param {string} message
 * @returns {{ code: number, message: string, data: * }}
 */
function ok(data = null, message) {
  return {
    code: CODES.SUCCESS,
    message: message || MSGS[CODES.SUCCESS],
    data,
  }
}

/**
 * 失败返回
 * @param {number} code - 错误码
 * @param {string} message - 自定义消息（可选）
 * @param {*} data - 附加数据（可选）
 */
function fail(code, message, data) {
  return {
    code: code || CODES.SERVER_ERROR,
    message: message || MSGS[code] || MSGS[CODES.SERVER_ERROR],
    data: data || null,
  }
}

module.exports = { CODES, MSGS, ok, fail }
