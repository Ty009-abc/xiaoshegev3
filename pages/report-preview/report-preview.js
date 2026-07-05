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
    qrcodePath:'',  // 小程序码本地路径
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
     海报生成 — Canvas 2D 全链路
     ═══════════════════════════════════════ */
  async generatePoster() {
    if (this.data.posterGenerating) return
    const report = this.data.report
    if (!report) {
      wx.showToast({ title:'报告数据未就绪', icon:'none' })
      return
    }

    this.setData({ posterGenerating: true })
    wx.showLoading({ title:'正在生成海报...', mask:true })

    try {
      // 1. 获取小程序码
      const qrcodePath = await this._fetchQrcode()

      // 2. 获取 Canvas 节点
      const canvasNode = await this._getCanvasNode()

      // 3. 绘制海报
      await this._drawPoster(canvasNode, report, qrcodePath)

      // 4. 导出为临时图片
      const tempPath = await this._canvasToImage(canvasNode)

      wx.hideLoading()

      // 5. 保存到相册
      await this._saveToAlbum(tempPath)

      this.setData({ posterGenerating: false })
      wx.showToast({ title:'海报已保存到相册', icon:'success' })

    } catch (e) {
      wx.hideLoading()
      this.setData({ posterGenerating: false })
      console.error('[poster] generate error:', e)

      if (e?.errMsg?.includes('auth deny')) {
        wx.showModal({
          title:'需要授权',
          content:'请授权保存图片到相册，才能生成海报哦',
          confirmText:'去授权',
          success:(res)=>{
            if (res.confirm) wx.openSetting()
          }
        })
      } else {
        wx.showToast({ title:'海报生成失败，请重试', icon:'none' })
      }
    }
  },

  // 获取小程序码（优先云函数，fallback 本地占位）
  async _fetchQrcode() {
    try {
      const res = await wx.cloud.callFunction({
        name:'getWxacode',
        data:{ page:'pages/splash/splash', width:280 },
      })
      if (res.result?.code === 0 && res.result?.data) {
        return res.result.data
      }
    } catch (e) {
      // 云函数未部署时静默 fallback
      console.warn('[poster] getWxacode cloud function not deployed, using fallback')
    }
    return ''
  },

  _getCanvasNode() {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery()
      query.select('#posterCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            reject(new Error('Canvas 节点获取失败'))
            return
          }
          resolve(res[0].node)
        })
    })
  },

  async _drawPoster(canvas, report, qrcodePath) {
    const ctx = canvas.getContext('2d')
    const W = 750
    const H = 1334

    // 设置画布分辨率
    canvas.width = W
    canvas.height = H
    ctx.clearRect(0, 0, W, H)

    // ── 背景：深色黑客质感 ──
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
    bgGrad.addColorStop(0,   '#1A1A2E')
    bgGrad.addColorStop(0.6, '#16213E')
    bgGrad.addColorStop(1,   '#0F3460')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    // ── 顶部装饰线 ──
    ctx.fillStyle = '#7F56D9'
    ctx.fillRect(0, 0, W, 6)

    let y = 60

    // ── 标题 ──
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 44px "PingFang SC", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('翻身策略诊断报告', W / 2, y)

    y += 60

    // ── 人格标签 ──
    if (report.personality) {
      const tagText = `${report.personality.emoji} ${report.personality.name}视角已激活`
      ctx.font = '24px "PingFang SC", sans-serif'
      ctx.fillStyle = '#C6B1FF'
      ctx.fillText(tagText, W / 2, y)
      y += 50
    }

    y += 20

    // ── 分隔线 ──
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(60, y)
    ctx.lineTo(W - 60, y)
    ctx.stroke()
    y += 40

    // ── 核心板块绘制 ──
    const drawBlock = (title, content, isFatal) => {
      if (!content) return
      // 板块标题
      ctx.textAlign = 'left'
      ctx.font = 'bold 22px "PingFang SC", sans-serif'
      ctx.fillStyle = isFatal ? '#FF6B6B' : '#7F56D9'
      ctx.fillText(title, 60, y)
      y += 36

      // 内容文本（自动换行）
      ctx.font = isFatal
        ? 'bold 32px "PingFang SC", sans-serif'
        : '24px "PingFang SC", sans-serif'
      ctx.fillStyle = isFatal ? '#FF6B6B' : '#E8E9EC'
      y = this._wrapText(ctx, content, 60, y, 630, 36)
      y += 24
    }

    drawBlock.call(this, '⚡ 致命一句话', report.fatal_sentence, true)
    drawBlock.call(this, '🔍 系统困局', report.system_trap, false)
    drawBlock.call(this, '🎯 核心问题', report.core_problem, false)
    drawBlock.call(this, '🚀 翻身路径', report.strategy_path, false)

    y += 10

    // ── 行动建议 ──
    if (report.advice && report.advice.length > 0) {
      ctx.textAlign = 'left'
      ctx.font = 'bold 22px "PingFang SC", sans-serif'
      ctx.fillStyle = '#F5C14C'
      ctx.fillText('📋 行动建议', 60, y)
      y += 40

      ctx.font = '22px "PingFang SC", sans-serif'
      ctx.fillStyle = '#D0D5E0'
      for (let i = 0; i < Math.min(report.advice.length, 4); i++) {
        const item = `${i + 1}. ${report.advice[i]}`
        y = this._wrapText(ctx, item, 60, y, 630, 34)
        y += 8
      }
    }

    y += 30

    // ── 分隔线 ──
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.beginPath()
    ctx.moveTo(60, y)
    ctx.lineTo(W - 60, y)
    ctx.stroke()
    y += 30

    // ── 二维码区域 ──
    const qrSize = 200
    const qrX = W / 2 - qrSize / 2
    const qrY = y

    if (qrcodePath) {
      // 加载并绘制小程序码
      try {
        const qrImg = canvas.createImage()
        await new Promise((resolve, reject) => {
          qrImg.onload = resolve
          qrImg.onerror = reject
          qrImg.src = qrcodePath
        })
        // 白色底框
        ctx.fillStyle = '#FFFFFF'
        const padding = 8
        ctx.fillRect(qrX - padding, qrY - padding, qrSize + padding * 2, qrSize + padding * 2)
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)
      } catch (e) {
        // 二维码绘制失败，画占位框
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'
        ctx.lineWidth = 1
        ctx.strokeRect(qrX, qrY, qrSize, qrSize)
      }
    } else {
      // 无二维码时的占位框
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 1
      ctx.setLineDash([8, 4])
      ctx.strokeRect(qrX, qrY, qrSize, qrSize)
      ctx.setLineDash([])
    }

    y += qrSize + 20

    // ── 裂变提示文案 ──
    ctx.textAlign = 'center'
    ctx.font = 'bold 34px "PingFang SC", sans-serif'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText('扫码测试你的翻身策略', W / 2, y)

    y += 44

    ctx.font = '26px "PingFang SC", sans-serif'
    ctx.fillStyle = '#8890A8'
    ctx.fillText('看看你的认知在什么段位', W / 2, y)

    y += 52

    // ── 底部品牌 ──
    ctx.font = '20px "PingFang SC", sans-serif'
    ctx.fillStyle = '#5A6078'
    ctx.fillText('珠澳小事哥 · 认知操作系统', W / 2, y)

    // ── 底部装饰线 ──
    ctx.fillStyle = '#7F56D9'
    ctx.fillRect(0, H - 6, W, 6)
  },

  // 文本自动换行绘制
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

  _canvasToImage(canvas) {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas: canvas,
        success: (res) => resolve(res.tempFilePath),
        fail: reject,
      })
    })
  },

  _saveToAlbum(tempPath) {
    return new Promise((resolve, reject) => {
      // 先检查权限
      wx.getSetting({
        success: (setting) => {
          if (setting.authSetting['scope.writePhotosAlbum'] === false) {
            reject({ errMsg: 'auth deny' })
            return
          }
          wx.saveImageToPhotosAlbum({
            filePath: tempPath,
            success: resolve,
            fail: reject,
          })
        },
        fail: () => {
          wx.saveImageToPhotosAlbum({
            filePath: tempPath,
            success: resolve,
            fail: reject,
          })
        },
      })
    })
  },
})
