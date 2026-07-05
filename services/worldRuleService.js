/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * services/worldRuleService.js
 */

function call(name, data) {
  return wx.cloud.callFunction({ name, data }).then(r => r.result)
}

function getWorldRules(category, page, pageSize) {
  return call('getWorldRules', { category, page, pageSize })
}

function getWorldRuleDetail(ruleId) {
  return call('getWorldRuleDetail', { ruleId })
}

module.exports = { getWorldRules, getWorldRuleDetail }
