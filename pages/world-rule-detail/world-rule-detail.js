/**
 * world-rule-detail v3.5.4 — RC5.4 World Rule Poster Rebuild
 *
 * 改动：
 *   - 接入 WorldRulePosterRenderer（01-04 编号卡结构）
 *   - 接入 PosterService 统一保存
 *   - Canvas ID 改为 worldRulePosterCanvas（避免与认知暴击冲突）
 *   - 按钮文案 "保存海报"
 */

const worldRuleService = require('../../services/worldRuleService.js')
const analytics = require('../../utils/analytics.js')
const PService = require('../../share/PosterService.js')
const RuleRenderer = require('../../share/WorldRulePosterRenderer.js')

const KNOWN_KEY = 'world_…tion'
const FAV_KEY = 'world_…ites'

function normalizeWorldRule(raw) {
  if (!raw) return null; const r = raw

  // 01 世界规则：Season 1-4 rule 字段 或 Season 5+ worldRule/mechanism
  const worldRule = r.worldRule || r.rule || r.mechanism || ''

  // 02 底层逻辑：数据库无专属字段，从 rule 字段提取（与 01 卡片共享实际内容）
  const underlyingLogic = (r.rule && r.rule.trim() ? r.rule : '') || ''

  // 03 反向推理
  const reverseLogic = r.reverseLogic || r.reverseInference || r.boundary || r.realityCheck || ''

  // 04 行动建议
  const actionAdvice = r.actionAdvice || r.action || r.todayAction || r.highLevelThinking || r.suggestion || ''

  // 诊断日志（受 debug 开关控制）
  const _DEBUG = true
  if (_DEBUG) {
    console.log('[WorldRuleNormalizer] rawKeys:', Object.keys(r).join(', '))
    console.log('[WorldRuleNormalizer] ruleId:', r.ruleId)
    console.log('[WorldRuleNormalizer] 01 worldRule:', worldRule.substring(0, 60))
    console.log('[WorldRuleNormalizer] 02 underlyingLogic:', underlyingLogic.substring(0, 60))
    console.log('[WorldRuleNormalizer] 03 reverseLogic:', reverseLogic.substring(0, 60))
    console.log('[WorldRuleNormalizer] 04 actionAdvice:', actionAdvice.substring(0, 60))
    if (!underlyingLogic) {
      console.warn('[WorldRuleNormalizer] MISSING_UNDERLYING_LOGIC ruleId=' + r.ruleId, 'rawKeys=' + Object.keys(r).join(','))
    }
  }

  return {
    id: r.ruleId || '',
    category: r.category || '',
    categoryDisplay: getCatDisplay(r.category),
    title: r.title || '',
    worldRule,
    underlyingLogic,
    reverseLogic,
    actionAdvice,
    tags: r.tags || [],
    locked: r.locked === true,
    preview: r.preview || '',
    hasRule: !!worldRule,
    hasLogic: !!underlyingLogic,
    hasReverse: !!reverseLogic,
    hasAction: !!actionAdvice,
  }
}
function getCatDisplay(cat) {
  const m = { wealth: '💰 财富模型', mindset: '🧠 认知升级', probability: '🎲 概率决策', system: '⚙️ 系统模型', info: '📡 信息网络', cognition: '🧠 认知升级', capital: '💰 财富模型', risk: '🎲 概率决策', business: '🤖 商业与AI', longterm: '🌍 长期文明', ethics: '⚖️ 伦理意义', human: '🧠 认知升级', leverage: '💰 财富模型', decision: '🎲 概率决策', ai: '🤖 商业与AI', network: '📡 信息网络', coevolution: '🌍 长期文明', manifesto: '📜 宣言' }
  return m[cat] || ('📌 ' + (cat || ''))
}
function loadFav() { try { const r = wx.getStorageSync(FAV_KEY); return (r && Array.isArray(r)) ? r : [] } catch (_) { return [] } }
function saveFav(l) { try { wx.setStorageSync(FAV_KEY, l) } catch (_) {} }
function isFav(id, l) { return l.some(f => f.ruleId === id || f.id === id) }
function addFav(rule, l) { const e = { ruleId: rule.id, title: rule.title, category: rule.category, savedAt: Date.now() }; return [e, ...l.filter(f => f.ruleId !== e.ruleId)] }
function remFav(id, l) { return l.filter(f => f.ruleId !== id && f.id !== id) }
function markKnown(id) { try { const r = wx.getStorageSync(KNOWN_KEY); const d = (r && typeof r === 'object') ? r : {}; const ids = d.readIds || []; if (!ids.includes(id)) { ids.push(id); d.readIds = ids; d.lastReadRuleId = id; d.lastReadAt = Date.now(); wx.setStorageSync(KNOWN_KEY, d) } } catch (_) {} }
function isKnown(id) { try { const r = wx.getStorageSync(KNOWN_KEY); return !!(r && typeof r === 'object' && (r.readIds || []).includes(id)) } catch (_) { return false } }

Page({
  data: {
    rule: null, loading: true,
    isKnown: false, isFavorited: false,
    favoriting: false, posterGenerating: false,
  },
  _ruleId: '', _favs: [], _qrRetries: 0, _destroyed: false, _timers: [],

  onLoad(opt) {
    this._destroyed = false; this._timers = []
    this._ruleId = opt.id || ''
    if (!this._ruleId) { this.setData({ loading: false }); return }
    this._favs = loadFav(); this._loadDetail()
  },

  onUnload() {
    this._destroyed = true
    this._timers.forEach(t => clearTimeout(t)); this._timers = []
    this.setData({ favoriting: false, posterGenerating: false })
  },

  safeSetData(obj) { if (this._destroyed) return; try { this.setData(obj) } catch (_) {} },

  async _loadDetail() {
    try {
      const r = await worldRuleService.getWorldRuleDetail(this._ruleId)
      console.log('[WorldRuleDebug] _loadDetail raw:', JSON.stringify(r).substring(0, 200))
      if (r && r.code === 0 && r.data) {
        const n = normalizeWorldRule(r.data)
        console.log('[WorldRuleDebug] normalized keys:', Object.keys(n).join(', '))
        console.log('[WorldRuleDebug] hasRule:', n.hasRule, 'hasReverse:', n.hasReverse, 'hasExample:', n.hasExample, 'hasAction:', n.hasAction)
        this.safeSetData({ rule: n, loading: false, isKnown: isKnown(this._ruleId), isFavorited: isFav(this._ruleId, this._favs) })
      } else { this.safeSetData({ loading: false }) }
    } catch (e) { console.error('[WorldRuleDebug] _loadDetail error:', e); this.safeSetData({ loading: false }) }
  },

  onMarkKnown() { if (this.data.isKnown || this._markLocked) return; this._markLocked = true; markKnown(this._ruleId); this.safeSetData({ isKnown: true }); const t = setTimeout(() => { this._markLocked = false }, 600); this._timers.push(t); try { analytics.track('rule_known', { ruleId: this._ruleId }) } catch (_) {} },

  onToggleFavorite() {
    if (this.data.favoriting) return
    this.safeSetData({ favoriting: true })
    try {
      const { rule, isFavorited } = this.data
      const u = isFavorited ? remFav(this._ruleId, this._favs) : addFav(rule, this._favs)
      this._favs = u; saveFav(u)
      this.safeSetData({ isFavorited: !isFavorited, favoriting: false })
      wx.showToast({ title: isFavorited ? '已取消收藏' : '已收藏', icon: isFavorited ? 'none' : 'success' })
    } catch (e) { this.safeSetData({ favoriting: false }) }
  },

  onShareAppMessage() { const { rule } = this.data; return rule ? { title: '世界规则：' + rule.title, path: '/pages/world-rule-detail/world-rule-detail?id=' + this._ruleId } : {} },

  /* ═══════════ 保存海报 ═══════════ */
  onSavePoster() {
    const { rule } = this.data
    if (!rule || !rule.id) { wx.showToast({ title: '数据未加载', icon: 'none' }); return }
    if (this.data.posterGenerating) { console.log('[WorldRulePoster] BLOCKED - generating'); return }

    console.log('[WorldRulePoster] 01 click')
    wx.showLoading({ title: '获取小程序码...', mask: true })
    this.safeSetData({ posterGenerating: true })

    this._fetchQrCode()
      .then(qrPath => {
        if (!qrPath) {
          this.safeSetData({ posterGenerating: false })
          wx.hideLoading()
          wx.showToast({ title: '二维码生成失败', icon: 'none', duration: 2500 })
          return
        }
        this._doGenerate(rule, qrPath)
      })
      .catch(() => {
        this.safeSetData({ posterGenerating: false })
        wx.hideLoading()
        wx.showToast({ title: '二维码生成失败', icon: 'none', duration: 2500 })
      })
  },

  _doGenerate(rule, qrPath) {
    console.log('[WorldRulePoster] 02 qr ready, calc height')

    // 规范化海报数据（确保 Renderer 收到标准字段）
    const posterData = {
      id: rule.id || '',
      category: rule.category || '',
      categoryDisplay: rule.categoryDisplay || '',
      title: rule.title || '',
      worldRule: rule.worldRule || '',
      underlyingLogic: rule.underlyingLogic || '',
      reverseLogic: rule.reverseLogic || '',
      actionAdvice: rule.actionAdvice || '',
      hasLogic: rule.hasLogic !== undefined ? rule.hasLogic : !!rule.underlyingLogic,
    }
    console.log('[WorldRulePoster] posterData:', JSON.stringify({
      id: posterData.id,
      category: posterData.category,
      worldRule: posterData.worldRule.substring(0, 40),
      underlyingLogic: posterData.underlyingLogic.substring(0, 40),
      reverseLogic: posterData.reverseLogic.substring(0, 40),
      actionAdvice: posterData.actionAdvice.substring(0, 40),
      hasLogic: posterData.hasLogic,
    }))

    const page = this
    const tempCtx = wx.createCanvasContext('worldRulePosterCanvas', this)
    const H = RuleRenderer.calcHeight(posterData, tempCtx)
    console.log('[WorldRulePoster] 03 H=' + H)

    wx.showLoading({ title: '正在生成海报...', mask: true })

    wx.nextTick(() => {
      const ctx = wx.createCanvasContext('worldRulePosterCanvas', page)
      RuleRenderer.draw(ctx, posterData, qrPath, H)
      console.log('[WorldRulePoster] 04 draw submitted')

      // draw 超时 6s
      let drawn = false
      const dt = setTimeout(() => {
        if (!drawn) { drawn = true; console.error('[WorldRulePoster] draw timeout')
          page.safeSetData({ posterGenerating: false }); wx.hideLoading()
          wx.showToast({ title: '绘制超时，请重试', icon: 'none' }) }
      }, 6000)

      ctx.draw(false, () => {
        if (drawn) return; drawn = true; clearTimeout(dt)
        console.log('[WorldRulePoster] 05 draw callback')

        setTimeout(() => {
          console.log('[WorldRulePoster] 06 export start')
          wx.canvasToTempFilePath({
            canvasId: 'worldRulePosterCanvas',
            x: 0, y: 0, width: 750, height: H,
            destWidth: 1500, destHeight: H * 2,
            success: (res) => {
              console.log('[WorldRulePoster] 07 export ok ' + (res.tempFilePath || '').substring(0, 40))
              page.safeSetData({ posterGenerating: false })
              wx.hideLoading()
              // 直接保存到相册
              PService.saveToAlbum(res.tempFilePath, 'worldRule')
            },
            fail: (err) => {
              console.error('[WorldRulePoster] 07 export fail:', err)
              page.safeSetData({ posterGenerating: false })
              wx.hideLoading()
              wx.showToast({ title: '海报生成失败', icon: 'none' })
            },
          }, page)
        }, 300)
      })
    })
  },

  /* ═══════════ 二维码 ═══════════ */
  _fetchQrCode() {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'getUnlimitedQR',
        data: { scene: this._ruleId, page: 'pages/world-rules/world-rules' },
        success: (res) => {
          const r = res.result || {}
          const fileID = (r.data && r.data.fileID) || r.fileID || ''
          if (!fileID) {
            if (this._qrRetries < 1) {
              this._qrRetries++
              wx.cloud.callFunction({
                name: 'getUnlimitedQR', data: { scene: this._ruleId + '_r', page: 'pages/world-rules/world-rules' },
                success: (r2) => {
                  const f2 = (r2.result && r2.result.data && r2.result.data.fileID) || (r2.result || {}).fileID || ''
                  if (f2) this._dlQr(f2, resolve, reject)
                  else reject(new Error('QR retry empty'))
                },
                fail: (e) => reject(e || new Error('QR retry fail')),
              })
            } else { reject(new Error('QR empty')) }
            return
          }
          this._dlQr(fileID, resolve, reject)
        },
        fail: (e) => reject(e || new Error('QR call fail')),
      })
    })
  },

  _dlQr(fileID, resolve, reject) {
    wx.cloud.downloadFile({
      fileID,
      success: (res) => {
        if (res.statusCode && res.statusCode !== 200) { reject(new Error('QR status ' + res.statusCode)); return }
        wx.getImageInfo({
          src: res.tempFilePath,
          success: () => resolve(res.tempFilePath),
          fail: () => reject(new Error('QR invalid')),
        })
      },
      fail: (e) => reject(e || new Error('QR download fail')),
    })
  },
})
