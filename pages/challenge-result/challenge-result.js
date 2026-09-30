const challengeService = require('../../services/challengeService.js')
const analytics = require('../../utils/analytics.js')
const { worldModelTypeLabel } = require('../../utils/worldModelLabels.js')
const { resolveCoreTraits } = require('../../utils/worldModelTags.js')
const radar = require('../../utils/radarChart.js')

// 九维中文标签映射（保持原有顺序与命名）
const DIM_LABELS = {
  laborMindset: '劳动', probabilityMindset: '概率', systemThinking: '系统',
  leverageThinking: '杠杆', capitalThinking: '资本', riskAwareness: '风险',
  informationSensitivity: '信息', longTermism: '长期', decisionStability: '决策',
}
const DIM_ORDER = [
  'laborMindset', 'probabilityMindset', 'systemThinking',
  'leverageThinking', 'capitalThinking', 'riskAwareness',
  'informationSensitivity', 'longTermism', 'decisionStability',
]

// ── 由既有评分推导（不新增 AI 调用）──
function rankDims (profile) {
  return DIM_ORDER
    .map((k) => ({ key: k, label: DIM_LABELS[k], value: (typeof profile[k] === 'number') ? profile[k] : 50 }))
    .sort((a, b) => b.value - a.value)
}
function buildSummary (profile, mainType) {
  if (!profile) return ''
  const ranked = rankDims(profile)
  const hi = ranked[0], lo = ranked[ranked.length - 1]
  const type = mainType && mainType !== '认知探索者' ? `当前你的世界模型更偏向「${mainType}」。` : ''
  return `你的「${hi.label}」维度最强（${hi.value}分），「${lo.label}」仍有明显提升空间。${type}`
}
// 世界模型判断：来自 existing 评分 + finalType，不新增 AI
function buildJudgement (profile, mainType) {
  if (!profile) return ''
  const ranked = rankDims(profile)
  const hi = ranked[0], hi2 = ranked[1]
  const lo = ranked[ranked.length - 1]
  const strong = (hi.value >= 60)
  const gap = (lo.value <= 55)
  const lead = strong
    ? `你的「${hi.label}」与「${hi2.label}」明显领先，已具备识别机会与验证路径的能力。`
    : `你的九维评分整体仍在构建中，「${hi.label}」是你目前相对最稳的支点。`
  const next = gap
    ? `下一阶段的关键不是继续学习，而是把已有能力「${lo.label}」补成闭环——系统化、资产化，而不是停留在单点技巧。`
    : `下一阶段建议把能力系统化、资产化，形成可持续放大的闭环。`
  const tail = mainType && mainType !== '认知探索者' ? `这也是「${mainType}」走向系统型的关键一步。` : ''
  return `${lead}${next}${tail}`
}

function normalizeResult (raw) {
  if (!raw) return null
  const scores = raw.scores || {}
  const profile = {}
  for (const key of DIM_ORDER) {
    const v = scores[key]
    profile[key] = (v !== undefined && v !== null) ? v : 50
  }
  const mainType = worldModelTypeLabel(raw.finalType)
  const { coreTraits, total } = resolveCoreTraits(raw.tags)
  const ranked = rankDims(profile)
  return {
    ...raw,
    profile,
    mainType,
    coreTraits,
    coreTraitTotal: total,
    summary: buildSummary(profile, mainType),
    judgement: buildJudgement(profile, mainType),
    dims: DIM_ORDER.map((k) => ({ key: k, label: DIM_LABELS[k], value: profile[k] })),
    topDims: ranked.slice(0, 2),
    bottomDims: ranked.slice(-2).reverse(),
    scoringVersion: raw.scoringVersion || 'legacy_v1',
  }
}

Page({ data:{
    recordId:'', result:null, loading:true,
    dimKeys:DIM_ORDER, dimLabels:DIM_LABELS,
    radarOk:false,          // 雷达成功绘制 → 显示 canvas
    radarFail:false,        // 绘制失败 → 显示 fallback 数据视图
  },
  onLoad(opt){ this.setData({ recordId:opt.recordId||'' }); this.load() },
  onReady(){ if (this.data.result) this.renderRadar() },
  onUnload(){
    analytics.flush()
    if (this._radarTimer) { clearInterval(this._radarTimer); this._radarTimer = null }
    this._radarData = null
  },
  async load(){
    try{
      const r=await challengeService.getChallengeRecord(this.data.recordId)
      if(r.code===0){
        const result=normalizeResult(r.data)
        this.setData({ result })
        analytics.track('challenge_finish',{ recordId:this.data.recordId })
        this.renderRadar()
      }
    }catch(_){} finally { this.setData({ loading:false }) }
  },

  // ── 九维世界模型雷达（legacy Canvas API，与 repo 既有可用实现一致）──
  renderRadar(){
    const result = this.data.result
    if (!result || !result.profile) return
    const data = radar.buildRadarData(result.profile, DIM_ORDER, DIM_LABELS)
    if (data.length < 3) { this._radarFail('data_lt_3'); return }
    this._radarData = data
    // 等 canvas 进入布局后再绘制
    setTimeout(() => this._paintRadar(0), 80)
  },
  // ── 雷达真机调试：仅开发态（__wxConfig.envVersion==='develop'）时记录，非页面可见 ──
  _radarFail(reason){
    this.setData({ radarFail:true, radarOk:false })
    this._radarDebugLog({ RADAR_DRAW_SUCCESS:false, RADAR_FAIL_REASON:reason })
  },
  _radarDebugLog(extra){
    try{
      const env=(typeof __wxConfig!=='undefined'&&__wxConfig.envVersion)||(wx.getAccountInfoSync&&wx.getAccountInfoSync().miniProgram.envVersion)
      if(env!=='develop') return
      const r=this._radarDiag||{}
      console.log('RADAR_DEBUG', Object.assign({
        RADAR_CANVAS_NODE_FOUND:!!r.found,
        RADAR_CANVAS_CSS_SIZE:r.css??null,
        RADAR_CANVAS_PIXEL_SIZE:r.px??null,
        RADAR_DPR:r.dpr??null,
        RADAR_DRAW_CALLED:!!r.draw,
        RADAR_POINTS_COUNT:r.pts??null,
      }, extra))
    }catch(_){}
  },
  _paintRadar(attempt){
    const data = this._radarData
    if (!data) { this._radarFail('no_data'); return }
    if (!wx.createCanvasContext) { this._radarFail('no_createCanvasContext'); return }
    if (!wx.createSelectorQuery) { this._paintDirect(data); return }
    let settled = false
    const failTimer = setTimeout(() => {
      if (settled) return
      settled = true
      if (attempt < 2) this._paintRadar(attempt + 1)
      else this._radarFail('init_timeout')
    }, 700)
    try {
      wx.createSelectorQuery().in(this).select('#radarCanvas').boundingClientRect((rect) => {
        if (settled) return
        settled = true
        clearTimeout(failTimer)
        if (!rect || !rect.width || !rect.height) {
          if (attempt < 3) { setTimeout(() => this._paintRadar(attempt + 1), 140); return }
          this._radarFail('invalid_size'); return
        }
        this._drawFrames(data, rect.width, rect.height)
      }).exec()
    } catch (e) {
      settled = true
      clearTimeout(failTimer)
      this._paintDirect(data)
    }
  },
  // selectorQuery 不可用时的兜底：按 CSS 设计尺寸 600rpx×540rpx 直接画
  _paintDirect(data){
    try { this._drawFrames(data, 300, 270) } catch (e) { this._radarFail('direct_paint_error') }
  },
  _drawFrames(data, cssW, cssH){
    try {
      const ctx = wx.createCanvasContext('radarCanvas', this)
      if (!ctx) { this._radarFail('ctx_null'); return }
      const total = 24
      const dpr = (wx.getSystemInfoSync && wx.getSystemInfoSync().pixelRatio) || 1
      this._radarDiag = {
        found: true, draw: true, pts: data.length,
        css: cssW + 'x' + cssH,
        px: Math.round(cssW * dpr) + 'x' + Math.round(cssH * dpr),
        dpr,
      }
      if (this._radarTimer) { clearInterval(this._radarTimer); this._radarTimer = null }
      this._frame = 0
      const paint = (p) => {
        radar.drawRadar(ctx, { width: cssW, height: cssH, data, progress: p })
        ctx.draw()
      }
      paint(0.01)
      this._radarTimer = setInterval(() => {
        this._frame++
        paint(radar.easeOutCubic(this._frame / total))
        if (this._frame >= total) {
          clearInterval(this._radarTimer); this._radarTimer = null
          this.setData({ radarOk: true, radarFail: false })
          this._radarDebugLog({ RADAR_DRAW_SUCCESS: true })
        }
      }, 16)
    } catch (e) {
      this._radarFail('draw_error')
    }
  },

  goReport(){ analytics.track('report_view'); wx.navigateTo({ url:'/pages/report-preview/report-preview?recordId='+this.data.recordId+'&type=challenge_final' }) },
  goShare(){ wx.navigateTo({ url:'/pages/share-poster/share-poster?recordId='+this.data.recordId }) },
  goRanking(){ wx.navigateTo({ url:'/pages/growth-ranking/growth-ranking' }) },
})
