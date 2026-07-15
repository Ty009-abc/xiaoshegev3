/**
 * world-rule-detail v3.2 — 280条世界规则字段契约修复
 *
 * 云函数返回: { ruleId, title, rule, reverseLogic, example, action, category, tags }
 * Season 1-4: rule, reverseLogic, example, action
 * Season 5+: worldRule, mechanism, todayAction (云函数可能不返回)
 * normalizeWorldRule 兼容两层 schema
 */

const worldRuleService = require('../../services/worldRuleService.js')

/** 归一化：云函数返回 → 统一 UI 契约 */
function normalizeWorldRule(raw) {
  if (!raw) return null
  const r = raw
  return {
    id:           r.ruleId || '',
    category:     r.category || '',
    categoryDisplay: getCategoryDisplay(r.category),
    title:        r.title || '',
    // 正文：优先 rule（S1-4），回退 worldRule → mechanism（S5+）
    worldRule:    r.rule || r.worldRule || r.mechanism || '',
    // 反向逻辑：reverseLogic（S1-4），回退 boundary → realityCheck（S5+）
    reverseInference: r.reverseLogic || r.boundary || r.realityCheck || '',
    // 现实案例：example（S1-4），回退 commonMistake → caseStudy（S5+）
    example:      r.example || r.commonMistake || r.caseStudy || '',
    // 行动建议：优先 action（S1-4），回退 todayAction（S5+）
    actionAdvice: r.action || r.todayAction || r.highLevelThinking || '',
    tags:         r.tags || [],
    locked:       r.locked === true,
    preview:      r.preview || '',
    hasRule:      !!(r.rule || r.worldRule || r.mechanism),
    hasReverse:   !!(r.reverseLogic || r.boundary || r.realityCheck),
    hasExample:   !!(r.example || r.commonMistake || r.caseStudy),
    hasAction:    !!(r.action || r.todayAction || r.highLevelThinking),
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
    coevolution: '🌍 长期文明',
    manifesto: '📜 宣言',
  }
  return map[cat] || ('📌 ' + (cat || ''))
}

Page({
  data: { rule: null, loading: true },

  async onLoad(opt) {
    const id = opt.id
    if (!id) { this.setData({ loading: false }); return }

    try {
      const r = await worldRuleService.getWorldRuleDetail(id)
      if (r && r.code === 0 && r.data) {
        const normalized = normalizeWorldRule(r.data)
        console.log('[WorldRuleDetail] id=' + id + ' keys=' + Object.keys(r.data).join(',') + ' hasRule=' + normalized.hasRule)
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
