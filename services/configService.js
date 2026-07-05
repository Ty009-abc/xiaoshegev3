/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * services/configService.js
 * 系统配置请求封装
 */

function callFunction(name, data) {
  return wx.cloud.callFunction({ name, data }).then(res => res.result)
}

/**
 * 获取系统配置
 * @param {string} key - 可选，按 key 查询
 * @returns {Promise<{code, data: {configs: Object}}>}
 */
function getSystemConfig(key) {
  return callFunction('getSystemConfig', { key })
}

module.exports = {
  getSystemConfig,
}
