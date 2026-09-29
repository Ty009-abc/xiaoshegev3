const challengeService = require('../../services/challengeService.js')
const analytics = require('../../utils/analytics.js')
const { worldModelTypeLabel } = require('../../utils/worldModelLabels.js')
const { resolveCoreTraits } = require('../../utils/worldModelTags.js')

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

// ── R9: 一句话总结（由既有数据推导，不新增 AI 调用）──
// 取九维最高/最低强势项生成一句人话总结；数据不足时返回空串（UI 自动隐藏）。
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
  const type = mainType && mainType !== '认知探索者' ? `，你的世界模型偏向「${mainType}」` : ''
  return `你的「${hi}」维度最强（${hiVal} 分），「${lo}」维度最弱（${loVal} 分）${type}。`
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

Page({ data:{ recordId:'', result:null, loading:true, dimKeys:DIM_ORDER, dimLabels:DIM_LABELS },
  onLoad(opt){ this.setData({ recordId:opt.recordId||'' }); this.load() },
  onUnload(){ analytics.flush() },
  async load(){
    try{
      const r=await challengeService.getChallengeRecord(this.data.recordId)
      if(r.code===0){ this.setData({ result:normalizeResult(r.data) }); analytics.track('challenge_finish',{ recordId:this.data.recordId }) }
    }catch(_){} finally { this.setData({ loading:false }) }
  },
  goReport(){ analytics.track('report_view'); wx.navigateTo({ url:'/pages/report-preview/report-preview?recordId='+this.data.recordId+'&type=challenge_final' }) },
  goRanking(){ wx.navigateTo({ url:'/pages/growth-ranking/growth-ranking' }) },
})
