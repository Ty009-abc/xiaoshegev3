/**
 * world-rules — v5 沉浸式规则探索（单卡导航）
 * 从云端 getWorldRules 读取 280 条，逐条沉浸式浏览
 */
const worldRuleService = require('../../services/worldRuleService.js')

Page({
  data: {
    loading: true,
    rules: [],           // 全量规则列表（缓存）
    currentIndex: 0,     // 当前浏览位置
    currentRule: null,   // 当前展示的规则
    total: 280,
    animating: 'none',   // none | slide-left | slide-right
    showShare: false,    // 海报分享状态
    posterUrl: '',       // 海报图片临时路径
  },

  onLoad() {
    this._loadAllRules()
  },

  async _loadAllRules() {
    try {
      // 分批获取全量规则（每批100条）
      let allRules = []
      let page = 1
      let hasMore = true
      while (hasMore) {
        const r = await worldRuleService.getWorldRules({ page, pageSize: 100, full: true })
        if (r.code === 0 && r.data) {
          allRules = allRules.concat(r.data.list || [])
          hasMore = !!r.data.hasMore && (r.data.list || []).length > 0
          page++
        } else {
          hasMore = false
        }
      }
      this.setData({
        rules: allRules,
        total: allRules.length,
        currentIndex: 0,
        currentRule: allRules[0] || null,
        loading: false,
      })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    }
  },

  /** 下一条 */
  onNext() {
    if (this.data.currentIndex >= this.data.rules.length - 1) {
      wx.showToast({ title: '已是最后一条', icon: 'none' })
      return
    }
    const next = this.data.currentIndex + 1
    this.setData({ animating: 'slide-left' })
    setTimeout(() => {
      this.setData({
        currentIndex: next,
        currentRule: this.data.rules[next],
        animating: 'none',
      })
    }, 250)
  },

  /** 上一条 */
  onPrev() {
    if (this.data.currentIndex <= 0) {
      wx.showToast({ title: '已是第一条', icon: 'none' })
      return
    }
    const prev = this.data.currentIndex - 1
    this.setData({ animating: 'slide-right' })
    setTimeout(() => {
      this.setData({
        currentIndex: prev,
        currentRule: this.data.rules[prev],
        animating: 'none',
      })
    }, 250)
  },

  /** 生成海报 */
  async onSharePoster() {
    // 使用现有的 generatePoster 工具
    try {
      const { generatePoster } = require('../../utils/generatePoster.js')
      const rule = this.data.currentRule
      const posterUrl = await generatePoster({
        type: 'world_rule',
        title: rule.title || rule.core_strike || '',
        content: rule.summary || rule.logic_dissection || '',
        reverse: rule.detail || rule.reverse_inference || '',
        action: rule.action || rule.action_advice || '',
        index: this.data.currentIndex + 1,
        total: this.data.total,
      })
      this.setData({ posterUrl, showShare: true })
    } catch (e) {
      wx.showToast({ title: '海报生成失败', icon: 'none' })
    }
  },

  /** 分享 */
  onShareAppMessage() {
    const rule = this.data.currentRule
    return {
      title: rule ? `世界观分享：${rule.title || rule.core_strike || ''}` : '世界规则探索',
      path: `/pages/world-rules/world-rules?idx=${this.data.currentIndex}`,
    }
  },

  onHidePoster() {
    this.setData({ showShare: false })
  },

  /** 扫码后通过 ?idx= 参数定位 */
  _jumpTo(idx) {
    const i = parseInt(idx)
    if (!isNaN(i) && i >= 0 && i < this.data.rules.length) {
      this.setData({
        currentIndex: i,
        currentRule: this.data.rules[i],
      })
    }
  },
})
