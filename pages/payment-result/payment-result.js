Page({ data:{ orderId:'', reportId:'', activated:false, showAnim:false },
  onLoad(opt){ const { orderId, reportId }=opt; this.setData({ orderId, reportId, activated:true }); setTimeout(()=>this.setData({ showAnim:true }),100) },
  viewReport(){ if(this.data.reportId) wx.redirectTo({ url:'/pages/report-detail/report-detail?reportId='+this.data.reportId })
    else wx.navigateBack() },
  viewChallenge(){ wx.switchTab({ url:'/pages/challenge-start/challenge-start' }) },
  goHome(){ wx.switchTab({ url:'/pages/home/home' }) },
})