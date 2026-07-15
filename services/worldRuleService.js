/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * services/worldRuleService.js
 *
 * 世界规则探索系统服务
 *  v6.2 — 支持 mode=index 完整索引 + 多分类查询
 */

function call(name, data) {
  return wx.cloud.callFunction({ name, data }).then(r => r.result)
}

function getWorldRules(options) {
  if (typeof options === 'string') {
    // 旧版兼容：getWorldRules(category, page, pageSize)
    const [category, page, pageSize] = arguments
    return call('getWorldRules', { category, page, pageSize })
  }
  return call('getWorldRules', options || {})
}

/** mode='index' → 轻量完整索引 { index: [{ ruleId, category }], total } */
function getWorldRulesIndex() {
  return call('getWorldRules', { mode: 'index' })
}

/** 多分类查询 */
function getWorldRulesByCategories(categories, page, pageSize) {
  return call('getWorldRules', { categories, page, pageSize })
}

function getWorldRuleDetail(ruleId) {
  return call('getWorldRuleDetail', { ruleId })
}

module.exports = {
  getWorldRules,
  getWorldRulesIndex,
  getWorldRulesByCategories,
  getWorldRuleDetail,
}
