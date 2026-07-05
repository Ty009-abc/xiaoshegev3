/**
 * pages/report-preview — v3.13 双模式
 *   type=diagnostic: v2 6题 → 5字段翻身策略报告（全免费）
 *   type=challenge_final: 30天挑战 → 收费报告
 */
const aiReportService = require('../../services/aiReportService.js')
const permissionService = require('../../services/permissionService.js')
const analytics = require('../../utils/analytics.js')
const app = getApp()

Page({
  data: {
    recordId:'', reportType:'',
    report:null, locked:true, loading:true, generating:false,
    showGenerating:false, showUpgradeModal:false,
  },

  onLoad(opt){
    const isDiagnostic = opt.type === 'diagnostic'
    this.setData({ recordId:opt.recordId||'diag', reportType:opt.type||'challenge_final' })

    // 诊断模式：自己调云函数生成报告（不阻塞问卷页的跳转）
    if (isDiagnostic && app.globalData._diagnosticAnswers) {
      this._loadDiagnostic()
    } else if (isDiagnostic && app.globalData._diagnosticReport) {
      // 兼容旧逻辑：直接拿缓存结果
      const r = app.globalData._diagnosticReport
      const p = app.globalData._diagnosticPersonality
      app.globalData._diagnosticReport = null
      app.globalData._diagnosticPersonality = null
      this.setData({
        report: {
          system_trap: r.system_trap || '',
          core_problem: r.core_problem || '',
          fatal_sentence: r.fatal_sentence || '',
          strategy_path: r.strategy_path || '',
          advice: Array.isArray(r.advice) ? r.advice : [],
          personality: p || null,
        },
        locked: false,
        loading: false,
      })
      analytics.track('diagnostic_report_view')
    } else {
      this.load()
    }
  },

  async _loadDiagnostic() {
    const answers = app.globalData._diagnosticAnswers
    const p = app.globalData._diagnosticPersonality
    app.globalData._diagnosticAnswers = null
    app.globalData._diagnosticPersonality = null

    this.setData({ loading: true })

    try {
      const r = await aiReportService.generateDiagnosticReport({
        answers,
        personality: p.name,
        personalityEmoji: p.emoji,
        personalityStyle: p.style,
      })
      if (r.code === 0 && r.data) {
        this.setData({
          report: {
            system_trap: r.data.system_trap || '',
            core_problem: r.data.core_problem || '',
            fatal_sentence: r.data.fatal_sentence || '',
            strategy_path: r.data.strategy_path || '',
            advice: Array.isArray(r.data.advice) ? r.data.advice : [],
            personality: p || null,
          },
          locked: false,
          loading: false,
        })
        analytics.track('diagnostic_report_view')
      } else {
        throw new Error(r.message || '分析失败')
      }
    } catch (e) {
      console.error('[diagnostic] load error:', e)
      this.setData({ loading: false, report: null })
    }
  },

  onUnload(){ analytics.flush() },

  async load(){
    try{
      const r=await aiReportService.getAiReport(this.data.recordId)
      if(r.code===0){
        const pRes=await permissionService.checkPermission('report_full')
        this.setData({ report:r.data, locked:!pRes.data?.granted })
      }
    }catch(_){} finally { this.setData({ loading:false }) }
  },

  onGenerate(){
    analytics.track('report_view')
    this.setData({ showGenerating:true })
    this.selectComponent('#aiGen').start()
    setTimeout(async () => {
      try{ const r=await aiReportService.generateAiReport('challenge_final', this.data.recordId)
        if(r.code===0){ this.setData({ report:r.data, locked:false }) }
        else throw new Error(r.message)
      }catch(e){ wx.showToast({ title:'小事哥刚刚断片了，请重新生成一次', icon:'none' }) }
      this.selectComponent('#aiGen').finish()
      setTimeout(()=>this.setData({ showGenerating:false }),500)
    },2000)
  },

  onUnlock(){ wx.navigateTo({ url:'/pages/membership/membership' }) },

  goFull(){
    analytics.track('report_detail_view')
    const isVip = app.globalData.isVip
    if(!isVip) this.setData({ showUpgradeModal:true })
    else wx.navigateTo({ url:'/pages/report-detail/report-detail?reportId='+(this.data.report?._id||this.data.recordId) })
  },

  onCloseUpgrade(){ this.setData({ showUpgradeModal:false }); wx.navigateTo({ url:'/pages/report-detail/report-detail?reportId='+(this.data.report?._id||this.data.recordId) }) },
  onUpgrade(){ analytics.track('membership_visit'); wx.navigateTo({ url:'/pages/membership/membership' }) },

  onShareAppMessage() {
    const r = this.data.report
    return {
      title: r?.fatal_sentence ? `☠️ ${r.fatal_sentence.substring(0,30)}… 珠澳小事哥` : '翻身策略诊断 · 珠澳小事哥',
      path: '/pages/splash/splash',
    }
  },

  onRetryDiagnostic() {
    wx.redirectTo({ url:'/pages/challenge-play/challenge-play?mode=diagnostic' })
  },
})
