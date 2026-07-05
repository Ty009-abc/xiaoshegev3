/**
 * world-rule-detail — v3 本地数据优先 + 云函数兜底
 */
const worldRuleService = require('../../services/worldRuleService.js')

Page({
  data: { rule: null, loading: true },

  onLoad(opt) {
    if (opt.id) {
      // 优先从 globalData 读取（world-rules 传递的本地数据）
      if (opt.fromLocal === '1') {
        this.loadFromLocal(opt.id)
      } else {
        this.load(opt.id)
      }
    }
  },

  loadFromLocal(id) {
    const app = getApp()
    const rule = (app.globalData || {}).currentRule
    if (rule && rule._id === id) {
      this.setData({ rule: this.adaptRule(rule), loading: false })
    } else {
      // 兜底：尝试从 strikeData 重新匹配
      const { STRIKE_POOL } = require('../../utils/strikeData.js')
      const idx = parseInt(id.replace('rule_', ''), 10) - 1
      if (STRIKE_POOL && STRIKE_POOL[idx] >= 0 && STRIKE_POOL[idx]) {
        const strike = STRIKE_POOL[idx]
        const adapted = {
          category: '世界运行规则',
          title: strike.core_strike,
          oneLiner: strike.title,
          content: strike.logic_dissection,
          reverse: strike.reverse_inference,
          case: strike.action_advice,
          dimension: (strike.dimensions || []).join(' × '),
        }
        this.setData({ rule: adapted, loading: false })
      } else {
        // 最后兜底：走云函数
        this.load(id)
      }
    }
  },

  adaptRule(localRule) {
    return {
      category: localRule.category || '世界运行规则',
      title: localRule.title || localRule.core_strike || '',
      oneLiner: localRule.summary ? localRule.summary.substring(0, 50) + '...' : '每日认知暴击精选',
      content: localRule.summary || localRule.logic_dissection || '',
      reverse: localRule.detail || localRule.reverse_inference || '',
      case: localRule.action || localRule.action_advice || '',
      dimension: localRule.dimension || '',
    }
  },

  async load(id) {
    try {
      const r = await worldRuleService.getWorldRuleDetail(id)
      if (r.code === 0) this.setData({ rule: r.data })
    } catch (_) {
      // silent fail — empty state 会展示
    } finally {
      this.setData({ loading: false })
    }
  },
})
