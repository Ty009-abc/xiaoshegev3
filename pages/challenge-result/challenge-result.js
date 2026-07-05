const challengeService = require('../../services/challengeService.js')
const analytics = require('../../utils/analytics.js')
Page({ data:{ recordId:'', result:null, loading:true },
  onLoad(opt){ this.setData({ recordId:opt.recordId||'' }); this.load() },
  onUnload(){ analytics.flush() },
  async load(){
    try{
      const r=await challengeService.getChallengeRecord(this.data.recordId)
      if(r.code===0){ this.setData({ result:r.data }); analytics.track('challenge_finish',{ recordId:this.data.recordId }) }
    }catch(_){} finally { this.setData({ loading:false }) }
  },
  goReport(){ analytics.track('report_view'); wx.navigateTo({ url:'/pages/report-preview/report-preview?recordId='+this.data.recordId }) },
  goShare(){ wx.navigateTo({ url:'/pages/share-poster/share-poster?recordId='+this.data.recordId }) },
  goRanking(){ wx.navigateTo({ url:'/pages/growth-ranking/growth-ranking' }) },
})