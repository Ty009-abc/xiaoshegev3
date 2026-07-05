/**
 * world-rules — 世界规则库（v3 本地数据驱动）
 * 
 * 15 条底层逻辑从 strikeData.js 50 条认知暴击中精选
 * 涵盖：系统漏洞 × 归因陷阱 × 赌场世界观 × 认知套利
 */
const { STRIKE_POOL } = require('../../utils/strikeData.js')

/**
 * 精选 15 条世界运行规则
 * 选取标准：涉及系统设计、底层逻辑、庄家视角、认知差套利的条目
 * 对应索引（1-based）：001-005 财富认知 + 021-025 赌场世界观 + 041-042 庄家哲学 + 046-048 规则层级
 */
const WORLD_RULE_INDICES = [0, 1, 2, 3, 4, 20, 21, 22, 23, 24, 40, 41, 43, 45, 46]

/**
 * 为每条规则生成专属分类
 */
const RULE_CATEGORY_MAP = {
  0: { category: '财富底层逻辑', order: 1 },
  1: { category: '财富底层逻辑', order: 2 },
  2: { category: '认知套利',      order: 1 },
  3: { category: '财富底层逻辑', order: 3 },
  4: { category: '归因陷阱',      order: 1 },
  20: { category: '赌场世界观',    order: 1 },
  21: { category: '赌场世界观',    order: 2 },
  22: { category: '赌场世界观',    order: 3 },
  23: { category: '赌场世界观',    order: 4 },
  24: { category: '赌场世界观',    order: 5 },
  40: { category: '庄家哲学',      order: 1 },
  41: { category: '庄家哲学',      order: 2 },
  43: { category: '规则层级',      order: 1 },
  45: { category: '规则层级',      order: 2 },
  46: { category: '认知套利',      order: 2 },
}

/**
 * 将原始 strike 条目转换为世界规则卡片格式
 */
function transformToRule(strikeItem, index) {
  const meta = RULE_CATEGORY_MAP[index] || { category: '认知法则', order: 99 }
  return {
    _id: `rule_${index + 1}`,
    index: index + 1,
    num: `${index + 1}`.padStart(2, '0'),
    title: strikeItem.core_strike,
    category: meta.category,
    order: meta.order,
    oneLiner: strikeItem.logic_dissection || '',
    summary: strikeItem.logic_dissection,
    detail: strikeItem.reverse_inference || '',
    action: strikeItem.action_advice || '',
    dimension: (strikeItem.dimensions || []).join(' × '),
    locked: false,
  }
}

Page({
  data: {
    rules: [],
    categories: [],
    activeCat: '',
    loading: true,
  },

  onLoad() {
    this.loadRules()
  },

  loadRules() {
    try {
      const worldRules = WORLD_RULE_INDICES.map((poolIdx, i) => {
        const strikeItem = STRIKE_POOL[poolIdx]
        if (!strikeItem) return null
        return transformToRule(strikeItem, poolIdx)
      }).filter(Boolean)

      // 按 category order 排序
      worldRules.sort((a, b) => {
        if (a.category !== b.category) return a.order - b.order
        return a.index - b.index
      })

      // 提取分类列表（按 order 排序的去重分类）
      const catSet = new Set()
      const categories = []
      for (const rule of worldRules) {
        if (!catSet.has(rule.category)) {
          catSet.add(rule.category)
          categories.push(rule.category)
        }
      }

      this.setData({
        rules: worldRules,
        categories,
        activeCat: categories[0] || '',
        loading: false,
      })
    } catch (err) {
      console.error('[world-rules] 加载失败:', err)
      this.setData({ loading: false })
    }
  },

  filterCat(e) {
    this.setData({ activeCat: e.currentTarget.dataset.cat })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    const rule = this.data.rules.find(r => r._id === id)
    if (!rule) return

    // 将规则详情写入全局数据，detail 页面直接读取
    const app = getApp()
    app.globalData = app.globalData || {}
    app.globalData.currentRule = rule

    wx.navigateTo({
      url: '/pages/world-rule-detail/world-rule-detail?id=' + id + '&fromLocal=1',
    })
  },
})
