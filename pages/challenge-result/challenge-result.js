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

// ── 一句话总结（由既有数据推导，不新增 AI 调用）──
// 取九维最高/最低项生成一句诊断式语句；数据不足时返回空串（UI 自动隐藏）。
function buildSummary (profile, mainType) {
  if (!profile) return ''
  let hiKey = '', hiVal = -1, loKey = '', loVal = 101
  for (const k of DIM_ORDER) {
    const v = profile[k]
    if (typeof v !== 'number') continue
    if (v > hiVal) { hiVal = v; hiKey = k }
    if (v < loVal) { loVal = v; loKey = k }
  }
  if (!hiKey || !loKey) return ''
  const hi = DIM_LABELS[hiKey]
  const lo = DIM_LABELS[loKey]
  const type = mainType && mainType !== '认知探索者'
    ? `当前你的世界模型更偏向「${mainType}」。`
    : ''
  return `你的「${hi}」维度最强（${hiVal}分），「${lo}」仍有明显提升空间。${type}`
}

// 归一化 scores → profile（v2 normalized + legacy 兼容）
function normalizeResult(raw) {
  if (!raw) return null
  const scores = raw.scores || {}
  const profile = {}
  for (const key of DIM_ORDER) {
    const v = scores[key]
    profile[key] = (v !== undefined && v !== null) ? v : 50
  }
  const mainType = worldModelTypeLabel(raw.finalType)
  const { coreTraits, total } = resolveCoreTraits(raw.tags)
  return {
    ...raw,
    profile,
    mainType,
    coreTraits,
    coreTraitTotal: total,
    summary: buildSummary(profile, mainType),
    scoringVersion: raw.scoringVersion || 'legacy_v1',
  }
}

Page({ data:{
    recordId:'', result:null, loading:true,
    dimKeys:DIM_ORDER, dimLabels:DIM_LABELS,
    radarReady:false,
  },
  onLoad(opt){ this.setData({ recordId:opt.recordId||'' }); this.load() },
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
        this.renderRadar()          // 数据就绪后异步绘制（不阻塞首屏）
      }
    }catch(_){} finally { this.setData({ loading:false }) }
  },

  // ── 九维认知画像雷达图（原生 Canvas 2D，淡入 + 展开动画）──
  renderRadar(){
    const result = this.data.result
    if (!result || !result.profile) return
    const data = radar.buildRadarData(result.profile, DIM_ORDER, DIM_LABELS)
    if (data.length < 3) return
    this._radarData = data
    // 等 canvas 进入布局后再查询尺寸
    setTimeout(() => this._paintRadar(), 60)
  },
  _paintRadar(){
    const data = this._radarData
    if (!data || !wx.createSelectorQuery) return
    wx.createSelectorQuery().in(this).select('#radarCanvas').boundingClientRect((rect) => {
      if (!rect || !rect.width || !rect.height) {
        // canvas 尚未布局：下一拍重试一次
        if (!this._radarRetried) { this._radarRetried = true; setTimeout(() => this._paintRadar(), 120) }
        return
      }
      const dpr = (wx.getSystemInfoSync && (wx.getSystemInfoSync().pixelRatio || 2)) || 2
      const ctx = wx.createCanvasContext('radarCanvas', this)
      let frame = 0
      const total = 22
      if (this._radarTimer) { clearInterval(this._radarTimer); this._radarTimer = null }
      const paint = (p) => {
        radar.drawRadar(ctx, { width: rect.width, height: rect.height, data, progress: p })
        ctx.draw()
      }
      paint(0.01)
      this._radarTimer = setInterval(() => {
        frame++
        paint(radar.easeOutCubic(frame / total))
        if (frame >= total) {
          clearInterval(this._radarTimer); this._radarTimer = null
          this.setData({ radarReady: true })
        }
      }, 16)
      void dpr
    }).exec()
  },

  goReport(){ analytics.track('report_view'); wx.navigateTo({ url:'/pages/report-preview/report-preview?recordId='+this.data.recordId+'&type=challenge_final' }) },
  goRanking(){ wx.navigateTo({ url:'/pages/growth-ranking/growth-ranking' }) },
})
