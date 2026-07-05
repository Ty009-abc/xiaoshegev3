const analytics = require('../../utils/analytics.js')
Page({
  data: { inviteCount:0, rewards:[
    { threshold:1, desc:'+20 CV', icon:'⚡', achieved:false },
    { threshold:3, desc:'解锁1条VIP规则', icon:'📜', achieved:false },
    { threshold:5, desc:'额外+50 CV', icon:'⭐', achieved:false },
    { threshold:10, desc:'免费AI深度报告', icon:'🧬', achieved:false },
  ], shareRecordId:'' },
  onShow() { this.loadInvites() },
  async loadInvites() {
    try {
      const db = wx.cloud.database()
      const openid = getApp().globalData.openid||''
      const res = await db.collection('invite_records').where({ inviterOpenid:openid }).count()
      const count = res.total||0
      const rewards = this.data.rewards.map(r=>({...r, achieved: count>=r.threshold}))
      this.setData({ inviteCount:count, rewards })
    } catch(_) {}
  },
  async recordInvite() {
    // 当用户在微信分享中点击进入时，从 query 读取邀请人
    try{
      const r=await wx.cloud.callFunction({ name:'recordInvite', data:{ inviterOpenid:this.data.shareRecordId } })
      if(r.result?.code===0){ wx.showToast({ title:'已记录邀请 +20CV', icon:'success' }); this.loadInvites() }
    }catch(_){}
  },
  onShare() {
    analytics.track('invite')
    const gd = getApp().globalData
    return {
      title:'来测测你的认知水平，看我刚刚翻了多少身',
      path:'/pages/home/home?inviter='+(gd.openid||''),
    }
  },
  onUnload() { analytics.flush() },
})
