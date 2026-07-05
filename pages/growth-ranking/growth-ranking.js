Page({
  data: { list:[], myRank:null, loading:true, tab:'cv' },
  onShow() { this.load() },
  async load() {
    this.setData({ loading:true })
    try {
      const db = wx.cloud.database()
      const _ = db.command
      const res = await db.collection('users')
        .field({ nickname:true, avatarUrl:true, cv:true, level:true, streak:true })
        .orderBy(this.data.tab, 'desc')
        .limit(50)
        .get()

      const list = (res.data||[]).map((u,i)=>({ ...u, rank:i+1, cvDisplay:u.cv||0, levelDisplay:'Lv.'+(u.level||1), streakDisplay:u.streak||0 }))

      const openid = getApp().globalData.openid||''
      const me = list.find(u=>u._openid===openid)
      this.setData({ list, myRank:me||null, loading:false })
    } catch(_) { this.setData({ loading:false }) }
  },
  onSwitchTab(e) { const tab = e.currentTarget.dataset.tab; this.setData({ tab }); this.load() },
})
