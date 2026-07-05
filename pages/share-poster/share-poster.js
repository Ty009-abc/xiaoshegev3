/**
 * pages/share-poster — 分享海报生成
 */
const analytics = require('../../utils/analytics.js')
Page({
  data: { recordId:'', result:null, posterPath:'', generating:false },
  onLoad(opt) { this.setData({ recordId:opt.recordId||'' }); this.loadResult() },
  async loadResult() {
    try{
      const r=await wx.cloud.callFunction({ name:'getChallengeRecord', data:{ recordId:this.data.recordId } })
      if(r.result?.code===0) this.setData({ result:r.result.data })
    }catch(_){}
  },
  async generatePoster() {
    if(this.data.generating) return
    this.setData({ generating:true })
    const { result } = this.data
    if(!result) { wx.showToast({ title:'系统暂时看不清这个世界，请稍后再试', icon:'none' }); this.setData({ generating:false }); return }

    // Canvas 绘制海报
    const ctx = wx.createCanvasContext('posterCanvas', this)
    const w = 600; const h = 900

    // 背景
    ctx.setFillStyle('#0a0a14'); ctx.fillRect(0,0,w,h)

    // 顶部装饰线
    ctx.setFillStyle('#F5C16C'); ctx.fillRect(40,40,w-80,4)

    // 标题
    ctx.setFillStyle('#F5F7FA'); ctx.setFontSize(32); ctx.font = 'bold 32px sans-serif'
    ctx.fillText('珠澳小事哥 · 认知操作系统', 60, 100)

    // 主类型
    ctx.setFillStyle('#F5C16C'); ctx.setFontSize(52); ctx.font = 'bold 52px sans-serif'
    const type = result.mainType||'认知探索者'
    ctx.fillText(type, 60, 180)

    // 翻身概率
    const prob = result.turnaroundProbability||Math.floor(Math.random()*20+60)
    ctx.setFillStyle('#F5F7FA'); ctx.setFontSize(28)
    ctx.fillText(`我的翻身概率：${prob}%`, 60, 260)

    // 小事哥金句
    ctx.setFillStyle('#98A2B3'); ctx.setFontSize(24)
    const quotes = [
      '小事哥说：你最大的问题不是努力，而是认知杠杆不足。',
      '小事哥说：世界不奖励忙碌，世界奖励看透规则的人。',
      '小事哥说：你的收入，是你认知水平的变现。',
    ]
    const quote = quotes[Math.floor(Math.random()*quotes.length)]
    // wrap text
    ctx.fillText(quote.substring(0,28), 60, 340)
    if(quote.length>28) ctx.fillText(quote.substring(28), 60, 375)

    // 九维迷你条
    const dims = [
      { k:'劳动', v:result.profile?.laborMindset||50 },
      { k:'概率', v:result.profile?.probabilityMindset||50 },
      { k:'系统', v:result.profile?.systemThinking||50 },
      { k:'杠杆', v:result.profile?.leverageThinking||50 },
      { k:'资本', v:result.profile?.capitalThinking||50 },
      { k:'风险', v:result.profile?.riskAwareness||50 },
    ]
    ctx.setFillStyle('#F5F7FA'); ctx.setFontSize(20)
    ctx.fillText('九维认知评分', 60, 440)
    dims.forEach((d,i)=>{
      const y = 480 + i*36
      ctx.setFillStyle('#555'); ctx.fillText(d.k, 60, y)
      const bw = (d.v/100)*(w-200)
      ctx.setFillStyle('rgba(124,92,255,0.3)'); ctx.fillRect(140, y-12, w-200, 16)
      ctx.setFillStyle('#7C5CFF'); ctx.fillRect(140, y-12, bw, 16)
      ctx.setFillStyle('#F5F7FA'); ctx.setFontSize(16); ctx.fillText(d.v+'', 140+bw+8, y)
    })

    // 底部 CTA
    ctx.setFillStyle('#F5C16C'); ctx.setFontSize(24)
    ctx.fillText('扫码升级你的世界模型 →', 100, 780)

    // 底部 logo
    ctx.setFillStyle('#333'); ctx.setFontSize(16)
    ctx.fillText('珠澳小事哥 · 认知操作系统 v3.1', 140, 840)

    ctx.draw(false, () => {
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvasId:'posterCanvas', success:(res)=>{
            this.setData({ posterPath:res.tempFilePath, generating:false })
            analytics.track('share')
          }, fail:()=>{ this.setData({ generating:false }); wx.showToast({ title:'生成失败，请重试', icon:'none' }) }
        }, this)
      }, 500)
    })
  },
  onSave() {
    if(!this.data.posterPath) return
    wx.saveImageToPhotosAlbum({
      filePath:this.data.posterPath,
      success:()=>{ wx.showToast({ title:'海报已保存到相册', icon:'success' }) },
      fail:()=>{ wx.showToast({ title:'请允许保存相册权限', icon:'none' }) }
    })
  },
  onShare() {
    // 微信原生分享
    return {
      title:'测测你的翻身概率',
      path:'/pages/home/home',
      imageUrl:this.data.posterPath||'',
    }
  },
  onUnload() { analytics.flush() },
  goRanking() { wx.navigateTo({ url:'/pages/growth-ranking/growth-ranking' }) },
})
