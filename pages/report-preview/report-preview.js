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
    posterGenerating:false,
    // 💡 小程序码图片路径
    qrcodePath: '/images/qrcode.png',
    // 新增：WXML 模板对齐数据字段
    reportData: {
      basicInsight: '',
      mechanism: '',
      reverseReasoning: '',
      biasCorrection: '',
      actionPlan: '',
    },
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

  /* ═══════════════════════════════════════
     海报生成 — Canvas 2D v3 （画布1800 + 5标题纠偏）
     ═══════════════════════════════════════ */
  generatePoster() {
    if (this.data.posterGenerating) return
    const self = this
    this.setData({ posterGenerating: true })
    wx.showLoading({ title: '正在淬炼海报...', mask: true })

    // 从 report 映射到 reportData（WXML 对齐字段）
    const r = this.data.report
    this.setData({
      reportData: {
        basicInsight: r?.fatal_sentence || '',
        mechanism: r?.core_problem || '',
        reverseReasoning: r?.system_trap || '',
        biasCorrection: r?.strategy_path || '',
        actionPlan: (r?.advice || []).join('\n') || '',
      }
    })

    const query = wx.createSelectorQuery()
    query.select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          wx.hideLoading()
          this.setData({ posterGenerating: false })
          wx.showToast({ title: '画布初始化失败', icon: 'none' })
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')

        canvas.width = 750
        canvas.height = 1800

        // 1. 深色背景
        ctx.fillStyle = '#121620'
        ctx.fillRect(0, 0, 750, 1800)

        // 2. 大标题
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 36px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('珠澳小事哥 · 认知翻身策略', 375, 80)

        // 3. 副标题
        ctx.fillStyle = '#FF7BB6'
        ctx.font = '24px sans-serif'
        ctx.fillText('🧠 认知教练视角已激活', 375, 130)

        // 4. 内容板块（5大标题顺序硬编码还原）
        let currentY = 220
        const paddingX = 50
        const contentWidth = 650

        const sections = [
          { label: '⚡ 致命一句话', text: '💀 ' + self.data.reportData.basicInsight, color: '#FF453A', isRed: true },
          { label: '🎯 核心问题', text: self.data.reportData.mechanism, color: '#D0D5E0', isRed: false },
          { label: '🔍 系统局', text: self.data.reportData.reverseReasoning, color: '#D0D5E0', isRed: false },
          { label: '🚀 翻身路径', text: self.data.reportData.biasCorrection, color: '#D0D5E0', isRed: false },
          { label: '📋 行动建议', text: self.data.reportData.actionPlan, color: '#D0D5E0', isRed: false }
        ]

        sections.forEach(sec => {
          if (!sec.text) return
          ctx.textAlign = 'left'
          ctx.fillStyle = sec.isRed ? '#FF453A' : '#7B57FF'
          ctx.font = 'bold 26px sans-serif'
          ctx.fillText(sec.label, paddingX, currentY)
          currentY += 40

          ctx.fillStyle = sec.color
          ctx.font = sec.isRed ? 'bold 26px sans-serif' : '24px sans-serif'
          currentY = self._wrapText(ctx, sec.text, paddingX, currentY, contentWidth, 38)
          currentY += 60
        })

        // 5. 加载二维码并绘制（放在 1800 底部安全区）
        try {
          const qrImage = canvas.createImage()
          qrImage.src = self.data.qrcodePath
          qrImage.onload = () => {
            const qrSize = 160
            const qrX = 540
            const qrY = 1580

            // 白色圆角底框
            ctx.fillStyle = '#FFFFFF'
            self._drawRoundedRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 14)
            ctx.fill()
            ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)

            // 右对齐裂变文案（在二维码左侧）
            ctx.textAlign = 'right'
            ctx.fillStyle = '#FFFFFF'
            ctx.font = 'bold 28px sans-serif'
            ctx.fillText('扫码测试你的', qrX - 36, qrY + 50)
            ctx.fillText('翻身策略', qrX - 36, qrY + 92)

            ctx.fillStyle = '#8890A8'
            ctx.font = '22px sans-serif'
            ctx.fillText('看看你的认知在什么段位', qrX - 36, qrY + 136)

            // 底部品牌
            ctx.textAlign = 'center'
            ctx.font = '18px sans-serif'
            ctx.fillStyle = '#5A6078'
            ctx.fillText('珠澳小事哥 · 认知操作系统', 375, 1770)

            // 6. 导出保存
            wx.canvasToTempFilePath({
              canvas: canvas,
              destWidth: 750,
              destHeight: 1800,
              success: (tempRes) => {
                wx.hideLoading()
                self._saveToAlbumDirect(tempRes.tempFilePath)
              },
              fail: () => {
                wx.hideLoading()
                self.setData({ posterGenerating: false })
                wx.showToast({ title: '画布导出失败', icon: 'none' })
              }
            })
          }
          qrImage.onerror = () => {
            wx.hideLoading()
            self.setData({ posterGenerating: false })
            // 二维码失败但文案已绘制，仍然可导出
            wx.canvasToTempFilePath({
              canvas: canvas,
              destWidth: 750,
              destHeight: 1800,
              success: (tempRes) => {
                self._saveToAlbumDirect(tempRes.tempFilePath)
              },
              fail: () => {
                wx.showToast({ title: '海报生成失败', icon: 'none' })
              }
            })
          }
        } catch (e) {
          wx.hideLoading()
          self.setData({ posterGenerating: false })
          wx.showToast({ title: '海报生成失败', icon: 'none' })
        }
      })
  },

  // 文本自动换行绘制（海报专用）
  _wrapText(ctx, text, x, startY, maxWidth, lineHeight) {
    let y = startY
    const chars = text.split('')
    let line = ''
    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i]
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxWidth && line.length > 0) {
        ctx.fillText(line, x, y)
        line = chars[i]
        y += lineHeight
      } else {
        line = testLine
      }
    }
    if (line.length > 0) {
      ctx.fillText(line, x, y)
      y += lineHeight
    }
    return y
  },

  // 圆角矩形
  _drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height - radius)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
  },

  // 直接保存到相册（新版）
  _saveToAlbumDirect(filePath) {
    const self = this
    wx.saveImageToPhotosAlbum({
      filePath: filePath,
      success: () => {
        self.setData({ posterGenerating: false })
        wx.showModal({
          title: '淬炼成功',
          content: '硬核认知海报已成功锁入相册，立刻去朋友圈破局裂变！',
          showCancel: false
        })
      },
      fail: (err) => {
        self.setData({ posterGenerating: false })
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '授权提示',
            content: '请允许开启相册写入权限，否则海报无法保存到本地。',
            success: (res) => {
              if (res.confirm) wx.openSetting()
            }
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      }
    })
  },
})
