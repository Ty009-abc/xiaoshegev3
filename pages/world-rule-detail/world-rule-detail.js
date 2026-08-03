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
  if (!raw) return null
  const r = raw

  // === 补充底层逻辑库（Season 1-4 旧规则，数据无专属字段时使用）===
  let SUPPLEMENTAL = null
  try {
    const supp = require('../../data/worldRuleUnderlyingLogic.js')
    SUPPLEMENTAL = supp && supp[r.ruleId || r.id]
  } catch (_) { /* 补充库不存在时不报错 */ }

  // === 字段映射 ===
  // 01 世界规则：worldRule（S5+）> rule（S1-4）> ''
  // mechanism 不进入 01（属于底层机制，不是规则正文）
  const worldRule = cleanText(r.worldRule || r.rule)

  // 02 底层逻辑：原生字段 > mechanism（底层机制）> 补充库
  const underlyingLogic =
    cleanText(r.underlyingLogic || r.coreLogic || r.logicAnalysis || r.logic || r.mechanism || (SUPPLEMENTAL && SUPPLEMENTAL.underlyingLogic))

  // 03 反向推理
  const reverseLogic = cleanText(r.reverseLogic || r.reverseInference || r.boundary || r.realityCheck)

  // 04 现实案例
  const realCase = cleanText(r.example || r.caseStudy || r.realCase || r.commonMistake)

  // 05 行动建议
  const actionAdvice = cleanText(r.actionAdvice || r.action || r.todayAction || r.highLevelThinking || r.suggestion)

  // === 防串线断言 ===
  if (worldRule && underlyingLogic && worldRule === underlyingLogic) {
    console.warn('[WorldRuleNormalizer] DUPLICATE_SECTION_CONTENT ruleId=' + r.ruleId + ' worldRule==underlyingLogic')
  }

  // === 诊断日志 ===
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

  const result = {
    id: r.ruleId || '',
    category: r.category || '',
    categoryDisplay: getCatDisplay(r.category),
    title: r.title || '',
    worldRule,
    underlyingLogic,
    reverseLogic,
    realCase,
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

  // 重复检测（仅 warning，不篡改）
  if (result.worldRule && result.underlyingLogic && result.worldRule === result.underlyingLogic) {
    console.warn('[WorldRuleNormalizer] DUPLICATE_01_02_CONTENT ruleId=' + r.ruleId)
  }

  return result
}

function cleanText(text) {
  if (!text || typeof text !== 'string') return ''
  return text.trim()
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

    // 海报数据直接使用 normalized rule 字段（统一契约，不二次映射）
    const posterData = {
      id: rule.id || '',
      category: rule.category || '',
      categoryDisplay: rule.categoryDisplay || '',
      title: rule.title || '',
      worldRule: rule.worldRule || '',
      underlyingLogic: rule.underlyingLogic || '',
      reverseLogic: rule.reverseLogic || '',
      actionAdvice: rule.actionAdvice || '',
    }

    // === 生成前强制内容校验 ===
    let validator = null
    try {
      validator = require('../../utils/worldRuleContentValidator.js')
    } catch (_) {}
    if (validator && validator.validateWorldRuleContent) {
      const validation = validator.validateWorldRuleContent(posterData)
      if (!validation.ok) {
        console.error('[WorldRulePoster] CONTENT_VALIDATION_FAILED', JSON.stringify(validation))
        this.safeSetData({ posterGenerating: false })
        wx.hideLoading()
        wx.showToast({ title: '该规则内容尚未完善，请更换一条规则', icon: 'none', duration: 3000 })
        return
      }
      if (validation.warnings.length) {
        console.warn('[WorldRulePoster] CONTENT_WARNINGS:', validation.warnings)
      }
    }

    // 调试日志
    console.log('[WorldRulePoster] posterData:', JSON.stringify({
      id: posterData.id,
      category: posterData.category,
      worldRule: posterData.worldRule.substring(0, 40),
      underlyingLogic: posterData.underlyingLogic.substring(0, 40),
      reverseLogic: posterData.reverseLogic.substring(0, 40),
      actionAdvice: posterData.actionAdvice.substring(0, 40),
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
