/**
 * services/adminService.js
 * 隐藏后台 API
 */

function call(name, data) {
  return wx.cloud.callFunction({ name, data }).then(r => r.result)
}

function checkAccess() {
  return call('adminCheckAccess', {})
}

function getDashboard() {
  return call('adminGetDashboard', {})
}

function getUsers(params) {
  return call('adminGetUsers', params)
}

function updateUser(openid, action, value) {
  return call('adminUpdateUser', { openid, action, value })
}

function getOrders(params) {
  return call('adminGetOrders', params)
}

function getAiLogs(params) {
  return call('adminGetAiLogs', params)
}

function getReports(params) {
  return call('adminGetReports', params)
}

function manageContent(collection, action, data, docId) {
  return call('adminManageContent', { collection, action, data, docId })
}

function getAnalytics() {
  return call('adminGetAnalytics', {})
}

function updateSystemConfig(key, value) {
  return call('adminUpdateSystemConfig', { key, value })
}

module.exports = {
  checkAccess, getDashboard, getUsers, updateUser, getOrders,
  getAiLogs, getReports, manageContent, getAnalytics, updateSystemConfig,
}
