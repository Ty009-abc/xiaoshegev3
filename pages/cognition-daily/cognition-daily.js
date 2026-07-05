const insightService = require('../../services/insightService.js')
Page({ data:{ insight:null, expanded:false, completed:false, cvAdded:false, cvDelta:0, loading:true },
  onLoad(){ this.load() },
  async load(){ this.setData({ loading:true })
    try{ const r=await insightService.getDailyInsight(); if(r.code===0) this.setData({ insight:r.data }) } catch(_){}
    this.setData({ loading:false })
  },
  onExpand(){ this.setData({ expanded:true }) },
  onCollapse(){ this.setData({ expanded:false }) },
  async onComplete(){
    if(this.data.completed) return
    try{
      const r=await wx.cloud.callFunction({ name:'consumeFreeQuota', data:{} })
      if(r.result?.code===0){
        this.setData({ completed:true, cvDelta:3 })
        // CV +3 动画
        setTimeout(()=>this.setData({ cvAdded:true }),100)
        // 轻微震动
        wx.vibrateShort && wx.vibrateShort({ type:'light' })
        wx.showToast({ title:'认知值 +3', icon:'success', duration:1500 })
      }
    }catch(_){ wx.showToast({ title:'系统暂时看不清这个世界，请稍后再试', icon:'none' }) }
  },
})