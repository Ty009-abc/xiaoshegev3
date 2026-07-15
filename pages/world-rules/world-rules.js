/**
 * world-rules v6.2 — 世界规则探索系统 (Taxonomy Fix)
 *
 * 100 → 8 核心模型归并
 * 总进度分母 = fullIndex.length (280)
 * 模型地图仅 8 张卡
 * 分类栏展示核心模型
 */

const worldRuleService = require('../../services/worldRuleService.js')

// ═══════════════════════════════════════
// 8 核心模型归并（纯前端，不改数据库）
// 每个原始 category 仅归属一个模型，总数 = 280
// ═══════════════════════════════════════
const CORE_MODELS = [
  {
    id: 'wealth_model', label: '财富模型', icon: '💰', color: '#F2B84B',
    cats: ['wealth','capital','leverage','currency','valuation','market','allocation','asymmetry','cycle','liquidity','interest_rate','trade','monopoly','moat','scale','pricing','brand','enterprise'],
  },
  {
    id: 'cognition_model', label: '认知升级', icon: '🧠', color: '#8B5CF6',
    cats: ['mindset','cognition','attention','intelligence','creativity','knowledge','behavior','psychology','consciousness','identity','meaning','evolution'],
  },
  {
    id: 'probability_model', label: '概率决策', icon: '🎲', color: '#16B364',
    cats: ['probability','decision','risk','volatility','derivatives','black_swan','timing','focus','strategy','competition','execution','iteration','anti_fragile','disruption'],
  },
  {
    id: 'system_model', label: '系统模型', icon: '⚙️', color: '#4F7CFF',
    cats: ['system','platform','governance','human_operating_system','organization','law','tax','education','media','city','population','freedom','trust','ecosystem','supply_chain','standard','institution','culture','network_effect'],
  },
  {
    id: 'info_network_model', label: '信息网络', icon: '📡', color: '#06B6D4',
    cats: ['info','network','data','semiconductor','data_flywheel','network_state','globalization'],
  },
  {
    id: 'ai_business_model', label: '商业与AI', icon: '🤖', color: '#F97316',
    cats: ['ai','game','ai_enterprise','digital_employee','autonomous_company','ai_native_company','global_ai_organization','automation','enterprise_os','human_ai','enterprise_future','ai_infrastructure','agi','platform_infrastructure','acquisition','innovation','intelligence_density'],
  },
  {
    id: 'civilization_model', label: '长期文明', icon: '🌍', color: '#84CC16',
    cats: ['longterm','worldview','civilization','intelligent_civilization','coevolution','future','energy','technology','power','war','manifesto','time'],
  },
  {
    id: 'ethics_model', label: '伦理意义', icon: '⚖️', color: '#A855F7',
    cats: ['ethics'],
  },
]

// 原始 category → 显示标签（单 category 卡片内用）
const CAT_META = {}
for (const m of CORE_MODELS) {
  for (const c of m.cats) {
    CAT_META[c] = { label: m.label, icon: m.icon, color: m.color }
  }
}

function getCategoryDisplay(cat) {
  const m = CAT_META[cat]
  if (m) return m.icon + ' ' + m.label
  return cat || '未知'
}

// ═══════════════════════════════════════
// 本地进度
// ═══════════════════════════════════════
const PROGRESS_KEY = 'world_rules_exploration'

function loadProgress() {
  try {
    const raw = wx.getStorageSync(PROGRESS_KEY)
    if (raw && typeof raw === 'object') {
      return { readIds: raw.readIds || [], lastReadRuleId: raw.lastReadRuleId || null, lastReadAt: raw.lastReadAt || null }
    }
  } catch (_) {}
  return { readIds: [], lastReadRuleId: null, lastReadAt: null }
}

function saveProgress(data) {
  try {
    if (data.readIds) data.readIds = [...new Set(data.readIds)]
    wx.setStorageSync(PROGRESS_KEY, data)
  } catch (_) {}
}

Page({
  data: {
    rules: [],
    // 顶部分类栏展示核心模型
    displayCategories: [],
    activeCoreModel: '',    // '' = 全部
    activeCoreCats: [],     // 该模型对应的原始 categories
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,

    statusBarHeight: 0,
    navBarHeight: 0,
    totalNavHeight: 0,

    // 探索
    exploredCount: 0,
    explorePercent: 0,
    lastReadRule: null,
    // 8 张核心模型卡
    coreModelProgress: [],
  },

  _readIds: [],
  _readSet: null,
  _fullIndex: [],       // [{ ruleId, category }]

  onLoad() {
    this._initNavBar()
    this._loadProgress()
    this._init()
  },

  onShow() {
    this._loadProgress()
    this._refreshProgressUI()
  },

  _initNavBar() {
    try {
      const s = wx.getWindowInfo()
      const m = wx.getMenuButtonBoundingClientRect()
      const sbh = s.statusBarHeight
      const nbh = (m.top - sbh) * 2 + m.height
      this.setData({ statusBarHeight: sbh, navBarHeight: nbh, totalNavHeight: sbh + nbh })
    } catch (_) {
      this.setData({ totalNavHeight: 88 })
    }
  },

  _loadProgress() {
    const p = loadProgress()
    this._readIds = p.readIds || []
    this._readSet = new Set(this._readIds)
  },

  async _init() {
    this.setData({ loading: true })
    await this._loadFullIndex()
    this._loadRules(true)
  },

  async _loadFullIndex() {
    try {
      const res = await worldRuleService.getWorldRulesIndex()
      if (res && res.code === 0 && res.data) {
        this._fullIndex = res.data.index || []

        // 构建 8 核心模型进度
        this._recalcModelProgress()

        // 构建分类栏
        this.setData({ total: this._fullIndex.length, displayCategories: this._buildDisplayCategories() })
      }
    } catch (err) {
      console.error('[world-rules] index load fail:', err)
    }
  },

  /** 基于完整 fullIndex + readSet 计算 8 个模型进度 */
  _recalcModelProgress() {
    if (!this._fullIndex.length) return

    const catSet = new Map() // category → [ruleId array]
    for (const r of this._fullIndex) {
      if (!catSet.has(r.category)) catSet.set(r.category, [])
      catSet.get(r.category).push(r.ruleId)
    }

    const progress = CORE_MODELS.map(m => {
      let total = 0, read = 0
      for (const c of m.cats) {
        const ids = catSet.get(c) || []
        total += ids.length
        for (const id of ids) {
          if (this._readSet.has(id)) read++
        }
      }
      return { id: m.id, label: m.label, icon: m.icon, color: m.color, total, read, percent: total > 0 ? Math.round(read / total * 100) : 0 }
    })

    this.setData({ coreModelProgress: progress })
  },

  _buildDisplayCategories() {
    const cats = [{ key: '__all__', label: '全部', icon: '' }]
    for (const m of CORE_MODELS) {
      cats.push({ key: m.id, label: m.icon + ' ' + m.label })
    }
    return cats
  },

  _refreshProgressUI() {
    const validTotal = this._fullIndex.length
    const validRuleIds = new Set(this._fullIndex.map(r => r.ruleId))
    const validReadCount = this._readIds.filter(id => validRuleIds.has(id)).length

    this._recalcModelProgress()

    let lastReadRule = null
    if (this._readIds.length > 0) {
      const lastId = this._readIds[this._readIds.length - 1]
      const found = this.data.rules.find(r => r.ruleId === lastId)
      if (found) lastReadRule = { ruleId: found.ruleId, title: found.title }
    }

    this.setData({
      exploredCount: validReadCount,
      explorePercent: validTotal > 0 ? Math.round(validReadCount / validTotal * 100) : 0,
      lastReadRule,
    })
  },

  _loadRules(reset) {
    if (!reset && (this.data.loadingMore || !this.data.hasMore)) return

    this.setData(reset ? { loading: true, page: 1, rules: [], hasMore: false } : { loadingMore: true })

    const page = reset ? 1 : this.data.page + 1
    const { pageSize, activeCoreCats, activeCoreModel } = this.data

    // 构建查询参数
    let callData
    if (activeCoreModel && activeCoreCats.length) {
      callData = { categories: activeCoreCats, page, pageSize }
    } else {
      callData = { category: '', page, pageSize }
    }

    wx.cloud.callFunction({
      name: 'getWorldRules',
      data: callData,
      timeout: 8000,
    }).then(res => {
      const d = res.result
      if (d && d.code === 0) {
        const data = d.data
        const rawList = data.list || []

        const processed = rawList.map(item => ({
          ...item,
          displayId: (item.ruleId || '').replace(/^WR/i, ''),
          displayCategory: getCategoryDisplay(item.category),
          displayTags: (item.tags || []).slice(0, 3),
          isRead: this._readSet.has(item.ruleId),
        }))

        let merged
        if (reset) {
          merged = processed
        } else {
          const existingIds = new Set(this.data.rules.map(r => r.ruleId))
          merged = [...this.data.rules, ...processed.filter(r => !existingIds.has(r.ruleId))]
        }

        this.setData({
          rules: merged,
          total: data.total,
          hasMore: data.hasMore === true,
          page,
          loading: false,
          loadingMore: false,
        })

        this._refreshProgressUI()
      } else {
        this.setData({ loading: false, loadingMore: false })
        wx.showToast({ title: d?.message || '加载失败', icon: 'none' })
      }
    }).catch(err => {
      console.error('[world-rules] cf fail:', err)
      this.setData({ loading: false, loadingMore: false })
      wx.showToast({ title: '网络异常', icon: 'none' })
    })
  },

  onReachBottom() { this._loadRules(false) },
  onPullDownRefresh() { this._loadRules(true) },

  /** 核心模型筛选 */
  filterCat(e) {
    const key = e.currentTarget.dataset.cat
    if (!key || key === '__all__') {
      this.setData({ activeCoreModel: '', activeCoreCats: [] }, () => this._loadRules(true))
    } else {
      const model = CORE_MODELS.find(m => m.id === key)
      if (model) {
        this.setData({ activeCoreModel: key, activeCoreCats: model.cats }, () => this._loadRules(true))
      }
    }
  },

  onModelTap(e) {
    const cat = e.currentTarget.dataset.cat
    if (cat) {
      const model = CORE_MODELS.find(m => m.id === cat)
      if (model) {
        this.setData({ activeCoreModel: cat, activeCoreCats: model.cats }, () => this._loadRules(true))
        wx.pageScrollTo({ scrollTop: 0, duration: 200 })
      }
    }
  },

  goDetail(e) {
    const ruleId = e.currentTarget.dataset.id
    if (!ruleId) return
    wx.navigateTo({ url: `/pages/world-rule-detail/world-rule-detail?id=${ruleId}` })
  },

  onContinueExplore() {
    const { lastReadRuleId } = loadProgress()
    if (lastReadRuleId && this._fullIndex.length > 0) {
      const idx = this._fullIndex.findIndex(r => r.ruleId === lastReadRuleId)
      if (idx >= 0 && idx < this._fullIndex.length - 1) {
        wx.navigateTo({ url: `/pages/world-rule-detail/world-rule-detail?id=${this._fullIndex[idx + 1].ruleId}` })
        return
      }
    }
    if (lastReadRuleId) {
      wx.navigateTo({ url: `/pages/world-rule-detail/world-rule-detail?id=${lastReadRuleId}` })
    }
  },

  onStartExplore() {
    const firstId = this._fullIndex.length > 0 ? this._fullIndex[0].ruleId : 'WR001'
    wx.navigateTo({ url: `/pages/world-rule-detail/world-rule-detail?id=${firstId}` })
  },

  onBack() { wx.navigateBack() },
})
