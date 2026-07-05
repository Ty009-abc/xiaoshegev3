/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * services/membershipService.js
 * 会员相关请求封装
 */

function callFunction(name, data) {
  return wx.cloud.callFunction({ name, data }).then(res => res.result)
}

/**
 * 获取当前会员状态
 * @returns {Promise<{code, data: {membership, isActive, permissions}}>}
 */
function getMembership() {
  return callFunction('getMembership', {})
}

module.exports = {
  getMembership,
}
