/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * services/userService.js
 * 用户相关请求封装
 */

const app = getApp()

/**
 * 调用云函数 (统一封装)
 */
function callFunction(name, data) {
  return wx.cloud.callFunction({ name, data }).then(res => res.result)
}

/**
 * 登录
 * 首次登录自动创建 users + user_profiles
 * @returns {Promise<{code, data: {user, profile, isNewUser}}>}
 */
function login() {
  return callFunction('login', {})
}

/**
 * 获取用户认知画像
 */
function getUserProfile() {
  return callFunction('getUserProfile', {})
}

/**
 * 更新用户认知画像
 * @param {Object} options
 * @param {Object} options.scores  - 九维评分增量，如 { leverageThinking: 5, systemThinking: -2 }
 * @param {string[]} options.tags  - 新增标签
 */
function updateUserProfile({ scores, tags } = {}) {
  return callFunction('updateUserProfile', { scores, tags })
}

module.exports = {
  login,
  getUserProfile,
  updateUserProfile,
}
