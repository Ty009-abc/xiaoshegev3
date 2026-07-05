/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * services/insightService.js
 */

function call(name, data) {
  return wx.cloud.callFunction({ name, data }).then(r => r.result)
}

function getDailyInsight() {
  return call('getDailyInsight', {})
}

function getInsightList(page, pageSize) {
  return call('getInsightList', { page, pageSize })
}

module.exports = { getDailyInsight, getInsightList }
