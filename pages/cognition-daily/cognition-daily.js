const insightService = require('../../services/insightService.js')
const personalizedContent = require('../../services/personalizedContentService.js')
Page({ data:{ insight:null, expanded:false, completed:false, cvAdded:false, cvDelta:0, loading:true,
    insightLabel:'', _insightId:'', _seenMarked:false },
  onLoad(){ this.load() },
  async load(){ this.setData({ loading:true })
    // R78.2 §8 — PRIMARY source = personalization feed. Fallback = existing
    // getDailyInsight(). On the (normal) personalized/feed path the legacy
    // fetch is NOT made, so DAILY_SUCCESS_PATH_OLD_FETCH_COUNT = 0.
    let insight = null, label = '', id = ''
    const feed = await personalizedContent.getFeed()
    const picked = personalizedContent.pickDaily(feed)
    if (picked && picked.insight) { insight = picked.insight; label = picked.label; id = picked.id }
    if (!insight) {
      try { const r = await insightService.getDailyInsight(); if (r && r.code === 0) { insight = r.data; id = (r.data && r.data.insightId) || '' } } catch (_) {}
      label = ''
    }
    this.setData({ insight, insightLabel: label, _insightId: id, loading:false })
  },
  // §10 SEEN = user explicitly opens/expands the content. Never on mere render.
  // Fire-and-forget, failure-isolated (§14): never blocks UI.
  _markSeen(){ if (this.data._seenMarked) return; const id = this.data._insightId; if (!id) return; this.setData({ _seenMarked:true }); try { personalizedContent.markSeen('insight', id) } catch (_) {} },
  onExpand(){ this.setData({ expanded:true }); this._markSeen() },
  onCollapse(){ this.setData({ expanded:false }) },
  async onComplete(){
    if(this.data.completed) return
    this._markSeen()
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
