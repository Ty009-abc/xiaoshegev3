const challengeService = require('../../services/challengeService.js')
const analytics = require('../../utils/analytics.js')
// 九维中文标签映射
const DIM_LABELS = {
  laborMindset: '劳动', probabilityMindset: '概率', systemThinking: '系统',
  leverageThinking: '杠杆', capitalThinking: '资本', riskAwareness: '风险',
  informationSensitivity: '信息', longTermism: '长期', decisionStability: '决策',
}

// 归一化 scores → profile（修正 scores/field 映射，确保九维真实数据绑定）
function normalizeResult(raw) {
  if (!raw) return null
  const scores = raw.scores || {}
  // 构建 profile 用于 WXML 渲染，绑定真实 score 值
  const profile = {}
  const dimKeys = Object.keys(DIM_LABELS)
  for (const key of dimKeys) {
    const v = scores[key]
    profile[key] = (v !== undefined && v !== null) ? v : 50
  }
  // 映射 finalType → mainType
  return { ...raw, profile, mainType: raw.finalType || '认知探索者' }
}

Page({ data:{ recordId:'', result:null, loading:true },
  onLoad(opt){ this.setData({ recordId:opt.recordId||'' }); this.load() },
  onUnload(){ analytics.flush() },
  async load(){
    try{
      const r=await challengeService.getChallengeRecord(this.data.recordId)
      if(r.code===0){ this.setData({ result:normalizeResult(r.data) }); analytics.track('challenge_finish',{ recordId:this.data.recordId }) }
    }catch(_){} finally { this.setData({ loading:false }) }
  },
  goReport(){ analytics.track('report_view'); wx.navigateTo({ url:'/pages/report-preview/report-preview?recordId='+this.data.recordId }) },
  goShare(){ wx.navigateTo({ url:'/pages/share-poster/share-poster?recordId='+this.data.recordId }) },
  goRanking(){ wx.navigateTo({ url:'/pages/growth-ranking/growth-ranking' }) },
})