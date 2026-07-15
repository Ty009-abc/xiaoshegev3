/**
 * world-rule-detail v3.1 — 280条世界规则字段契约修复
 *
 * 云函数返回: { ruleId, title, rule, reverseLogic, example, action, category, tags }
 * WXML 合约:   normalized.{ id, title, categoryDisplay, worldRule, reverseInference, example, actionAdvice, tags, hasReverse, hasExample, hasAction }
 */

const worldRuleService = require('../../services/worldRuleService.js')

/** 归一化：云函数返回 → 统一 UI 契约 */
function normalizeWorldRule(raw) {
  if (!raw) return null
  return {
    id:           raw.ruleId || '',
    category:     raw.category || '',
    categoryDisplay: getCategoryDisplay(raw.category),
    title:        raw.title || '',
    // 正文：rule 字段（云函数真实字段名）
    worldRule:    raw.rule || '',
    // 反向逻辑：reverseLogic 字段
    reverseInference: raw.reverseLogic || '',
    // 现实案例：example 字段
    example:      raw.example || '',
    // 行动建议：action 字段
    actionAdvice: raw.action || '',
    // 标签
    tags:         raw.tags || [],
    // 锁定
    locked:       raw.locked === true,
    preview:      raw.preview || '',
    // 降级布尔
    hasRule:      !!(raw.rule),
    hasReverse:   !!(raw.reverseLogic),
    hasExample:   !!(raw.example),
    hasAction:    !!(raw.action),
  }
}

function getCategoryDisplay(cat) {
  const map = {
    wealth: '💰 财富模型',
    mindset: '🧠 认知升级',
    probability: '🎲 概率决策',
    system: '⚙️ 系统模型',
    info: '📡 信息网络',
    cognition: '🧠 认知升级',
    capital: '💰 财富模型',
    risk: '🎲 概率决策',
    business: '🤖 商业与AI',
    longterm: '🌍 长期文明',
    ethics: '⚖️ 伦理意义',
    human: '🧠 认知升级',
    leverage: '💰 财富模型',
    decision: '🎲 概率决策',
    ai: '🤖 商业与AI',
    network: '📡 信息网络',
  }
  return map[cat] || ('📌 ' + (cat || ''))
}

Page({
  data: {
    rule: null,
    loading: true,
  },

  async onLoad(opt) {
    const id = opt.id
    if (!id) {
      this.setData({ loading: false })
      return
    }

    try {
      const r = await worldRuleService.getWorldRuleDetail(id)
      if (r && r.code === 0 && r.data) {
        const normalized = normalizeWorldRule(r.data)
        console.log('[WorldRuleDetail] normalized keys:', Object.keys(normalized).join(', '))
        console.log('[WorldRuleDetail] hasRule:', normalized.hasRule, 'hasReverse:', normalized.hasReverse, 'hasExample:', normalized.hasExample, 'hasAction:', normalized.hasAction)
        this.setData({ rule: normalized, loading: false })
      } else {
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error('[WorldRuleDetail] load fail:', err)
      this.setData({ loading: false })
    }
  },
})
