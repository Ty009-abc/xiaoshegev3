const aiReportService = require('../../services/aiReportService.js')
Page({ data:{ reportId:'', report:null, loading:true },
  onLoad(opt){ this.setData({ reportId:opt.reportId||'' }); this.load() },
  async load(){
    try{ const r=await aiReportService.getAiReport(this.data.reportId); if(r.code===0) this.setData({ report:r.data }) } catch(_){}
    this.setData({ loading:false })
  },
  goMembership(){ wx.navigateTo({ url:'/pages/membership/membership' }) },
})