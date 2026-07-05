Page({ data:{ list:[], loading:true },
  onShow(){ this.load() },
  async load(){
    this.setData({ loading:true })
    try{
      const db = wx.cloud.database()
      const res = await db.collection('challenge_records')
        .field({ openid:true, status:true, daysCompleted:true, createdAt:true })
        .orderBy('daysCompleted','desc')
        .limit(50)
        .get()
      const list = (res.data||[]).map((r,i)=>({ ...r, rank:i+1 }))
      this.setData({ list, loading:false })
    }catch(_){ this.setData({ loading:false }) }
  },
})