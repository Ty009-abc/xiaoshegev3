const challengeService = require('../../services/challengeService.js')
const analytics = require('../../utils/analytics.js')
// 九维中文标签映射
const DIM_LABELS = {
  laborMindset: '劳动', probabilityMindset: '概率', systemThinking: '系统',
  leverageThinking: '杠杆', capitalThinking: '资本', riskAwareness: '风险',
  informationSensitivity: '信息', longTermism: '长期', decisionStability: '决策',
}

// 归一化 scores → profile（v2 normalized + legacy 兼容）
function normalizeResult(raw) {
  if (!raw) return null
  const scores = raw.scores || {}
  const profile = {}
  const dimKeys = Object.keys(DIM_LABELS)
  for (const key of dimKeys) {
    const v = scores[key]
    profile[key] = (v !== undefined && v !== null) ? v : 50
  }
  return {
    ...raw,
    profile,
    mainType: raw.finalType || '认知探索者',
    scoringVersion: raw.scoringVersion || 'legacy_v1',
  }
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