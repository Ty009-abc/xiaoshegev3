/**
 * pages/report-preview — v3.15 双模式
 *   type=diagnostic: 6题 → 5字段翻身策略报告（全免费）
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
    qrcodePath: '/images/gh_qrcode.png',
    titlesReady: false,
    contentVisible: true,
    reportData: {
      basicInsight: '',     // 对应 1: 致命一句话
      mechanism: '',        // 对应 2: 核心问题
      reverseReasoning: '', // 对应 3: 系统困局
      biasCorrection: '',   // 对应 4: 翻身路径
      actionPlan: ''        // 对应 5: 行动建议
    },
  },

  onLoad(opt){
    const isDiagnostic = opt.type === 'diagnostic'
    this.setData({ recordId:opt.recordId||'diag', reportType:opt.type||'challenge_final' })

    if (isDiagnostic && app.globalData._diagnosticAnswers) {
      this._loadDiagnostic()
      return
    }
    if (isDiagnostic && app.globalData._diagnosticReport) {
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
      this._syncReportToReportData()
      analytics.track('diagnostic_report_view')
      return
    }

    // 🚀 四重保险：全管道捕获诊断报告数据
    this._loadReportFromFallback(opt)
  },

  /* 从 report 对象同步到 reportData（WXML 统一绑定） */
  _syncReportToReportData() {
    const r = this.data.report
    if (!r) return
    this.setData({
      reportData: {
        basicInsight: r.fatal_sentence || '',
        mechanism: r.core_problem || '',
        reverseReasoning: r.system_trap || '',
        biasCorrection: r.strategy_path || '',
        actionPlan: (Array.isArray(r.advice) ? r.advice : []).join('\n') || '',
      }
    })
  },

  /* 四重保险：全局变量 / URL传参 / localStorage / 扩展兼容字段 */
  _loadReportFromFallback(opt) {
    let finalData = null

    console.log('--- 🚀 [运行机制激活] 开始全渠道捕获诊断报告数据 ---')
    console.log('1. 当前页面路由入参 options:', opt)
    if (app.globalData) {
      console.log('2. 当前全局变量 globalData 状态:', app.globalData)
    }

    // ==========================================
    // 📥 运行机制第一步：多轨并行"数据清洗与捕获"
    // ==========================================

    // 【第一重保险】追踪标准全局变量
    if (app.globalData && app.globalData.lastReport) {
      finalData = app.globalData.lastReport
      console.log('➔ 🎯 机制命中：成功从 lastReport 捕获数据')
    }
    // 【第二重保险】兼容 009 可能在历史版本中使用的其他全局变量名
    else if (app.globalData && app.globalData.reportData) {
      finalData = app.globalData.reportData
      console.log('➔ 🎯 机制命中：成功从 reportData 捕获数据')
    }
    else if (app.globalData && app.globalData.diagnosisResult) {
      finalData = app.globalData.diagnosisResult
      console.log('➔ 🎯 机制命中：成功从 diagnosisResult 捕获数据')
    }

    // 【第三重保险】如果页面是通过带有 URL 参数跳转过来的（从 options 解析）
    if (!finalData && opt && opt.data) {
      try {
        finalData = JSON.parse(decodeURIComponent(opt.data))
        console.log('➔ ✉️ 机制命中：成功从 URL 传参中解析出数据')
      } catch (e) {
        console.error('URL 参数解析失败:', e)
      }
    }

    // 【第四重保险】从本地持久化缓存（Storage）中强行打捞
    if (!finalData) {
      const localCache = wx.getStorageSync('lastReport') || wx.getStorageSync('reportData') || wx.getStorageSync('diagnosisResult')
      if (localCache) {
        finalData = localCache
        console.log('➔ 📦 机制命中：成功从本地缓存中强行打捞数据')
      }
    }

    // ==========================================
    // 🔄 运行机制第二步：时序分流渲染（先出标题动画，再出内容）
    // ==========================================
    if (finalData) {
      // 阶段 1：先让页面并网，此时内容全部为空，WXML 层通过判断显示"动画加载中"
      this.setData({
        loading: false,
        titlesReady: true,      // 激活5个标题的骨架展示
        contentVisible: false,  // 暂时隐藏文本流
        reportData: {
          basicInsight: '', mechanism: '', reverseReasoning: '', biasCorrection: '', actionPlan: ''
        }
      })

      // 弹出一个优雅的极简原生加载提示
      wx.showLoading({ title: '教练正在深度诊断...', mask: true })

      // 阶段 2：延迟 1200ms（可控），等标题淡入动画完成后，完美灌入数据
      setTimeout(() => {
        this.setData({
          contentVisible: true,
          reportData: {
            basicInsight: finalData.basicInsight || finalData.insight || finalData.fatalSentence || '',
            mechanism: finalData.mechanism || finalData.reason || finalData.coreProblem || '',
            reverseReasoning: finalData.reverseReasoning || finalData.traps || finalData.systemTrap || '',
            biasCorrection: finalData.biasCorrection || finalData.path || finalData.turnaroundPath || '',
            actionPlan: finalData.actionPlan || finalData.actions || finalData.suggest || finalData.actionPlanList || '',
          }
        }, () => {
          wx.hideLoading()
          console.log('--- 🎨 [运行机制完成] 标题动画完毕，内容二次并网成功 ---')
        })
      }, 1200)

    } else {
      console.error('--- 🚨 [机制报警] 全链路未检测到任何合规的报告数据源！ ---')
      this.setData({ loading: false })
      wx.showToast({ title: '数据流对接断档，请重新诊断', icon: 'none' })
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
        this._syncReportToReportData()
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
     海报生成引擎 — Canvas 2D 重构版
     原则：先预计算高度 → 设 canvas → 再绘制，绝不二次改尺寸
     ═══════════════════════════════════════ */
  generatePoster() {
    if (this.data.posterGenerating) return
    const self = this
    this.setData({ posterGenerating: true })
    wx.showLoading({ title: '正在淬炼海报...', mask: true })

    // 从 report 兜底到 reportData
    const r = this.data.report
    const rd = this.data.reportData
    const data = r ? {
      basicInsight: r.fatal_sentence || '',
      mechanism: r.core_problem || '',
      reverseReasoning: r.system_trap || '',
      biasCorrection: r.strategy_path || '',
      actionPlan: (r.advice || []).join('\n') || '',
    } : {
      basicInsight: rd?.basicInsight || '',
      mechanism: rd?.mechanism || '',
      reverseReasoning: rd?.reverseReasoning || '',
      biasCorrection: rd?.biasCorrection || '',
      actionPlan: rd?.actionPlan || '',
    }

    const CANVAS_WIDTH = 750
    const paddingX = 50
    const contentWidth = 650
    const HEADER_Y = 60
    const TITLE_Y = 80
    const SUBTITLE_Y = 130
    const BODY_START_Y = 220
    const SECTION_HEADER_HEIGHT = 45
    const LINE_HEIGHT = 38
    const SECTION_GAP = 65
    const QR_CODE_SIZE = 140
    const QR_GAP = 30
    const QR_TEXT_HEIGHT = 40
    const BOTTOM_PADDING = 80

    // ═══ 阶段 1️⃣：获取 canvas 节点（不设尺寸，先只拿 ctx 做测量） ═══
    const query = wx.createSelectorQuery()
    query.select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          wx.hideLoading()
          self.setData({ posterGenerating: false })
          wx.showToast({ title: '画布初始化失败', icon: 'none' })
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')

        // ═══ 阶段 2️⃣：预计算所有板块的换行总高度 ═══
        const sections = [
          { label: '⚡ 致命一句话', text: data.basicInsight, isRed: true },
          { label: '🎯 核心问题',     text: data.mechanism,        isRed: false },
          { label: '🔍 系统困局',     text: data.reverseReasoning, isRed: false },
          { label: '🚀 翻身路径',     text: data.biasCorrection,   isRed: false },
          { label: '📋 行动建议',     text: data.actionPlan,       isRed: false }
        ]

        // 先用虚拟的 super-size canvas 临时测文本宽度
        canvas.width = 2000
        canvas.height = 2000

        let estY = BODY_START_Y
        sections.forEach(sec => {
          if (!sec.text) return
          estY += SECTION_HEADER_HEIGHT

          // 模拟换行计算行数
          ctx.font = sec.isRed ? 'bold 26px sans-serif' : '24px sans-serif'
          const words = sec.text
          let line = ''
          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n]
            const metrics = ctx.measureText(testLine)
            if (metrics.width > contentWidth && line.length > 0) {
              estY += LINE_HEIGHT
              line = words[n]
            } else {
              line = testLine
            }
          }
          estY += LINE_HEIGHT // 最后一行
          estY += SECTION_GAP
        })

        // 计算最终画布高度
        const qrStartY = estY + QR_GAP
        const totalContentHeight = qrStartY + QR_CODE_SIZE + QR_TEXT_HEIGHT + BOTTOM_PADDING
        const canvasHeight = Math.max(1800, totalContentHeight)

        // ═══ 阶段 3️⃣：一次性设定最终尺寸，不二次修改 ═══
        canvas.width = CANVAS_WIDTH
        canvas.height = canvasHeight

        // ═══ 阶段 4️⃣：从头绘制背景 ═══
        ctx.fillStyle = '#121620'
        ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight)

        // ═══ 阶段 5️⃣：标题区 ═══
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 36px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('珠澳小事哥 · 认知翻身策略', CANVAS_WIDTH / 2, TITLE_Y)

        ctx.fillStyle = '#FF7BB6'
        ctx.font = '24px sans-serif'
        ctx.fillText('🧠 认知教练视角已激活', CANVAS_WIDTH / 2, SUBTITLE_Y)

        // ═══ 阶段 6️⃣：正文 5 板块 ═══
        let drawY = BODY_START_Y
        sections.forEach(sec => {
          if (!sec.text) return

          // 标题
          ctx.textAlign = 'left'
          ctx.fillStyle = sec.isRed ? '#FF453A' : '#7B57FF'
          ctx.font = 'bold 26px sans-serif'
          ctx.fillText(sec.label, paddingX, drawY)
          drawY += SECTION_HEADER_HEIGHT

          // 正文
          ctx.fillStyle = sec.isRed ? '#FF453A' : '#D0D5E0'
          ctx.font = sec.isRed ? 'bold 26px sans-serif' : '24px sans-serif'

          const words = sec.text
          let line = ''
          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n]
            const metrics = ctx.measureText(testLine)
            if (metrics.width > contentWidth && line.length > 0) {
              ctx.fillText(line, paddingX, drawY)
              line = words[n]
              drawY += LINE_HEIGHT
            } else {
              line = testLine
            }
          }
          ctx.fillText(line, paddingX, drawY)
          drawY += LINE_HEIGHT + SECTION_GAP
        })

        // ═══ 阶段 7️⃣：二维码区 ═══
        const qrX = (CANVAS_WIDTH - QR_CODE_SIZE) / 2
        const qrY = drawY + QR_GAP

        const qrImage = canvas.createImage()
        qrImage.src = self.data.qrcodePath

        const finishAndExport = () => {
          wx.canvasToTempFilePath({
            canvas: canvas,
            destWidth: CANVAS_WIDTH,
            destHeight: canvasHeight,
            success: (tempRes) => {
              wx.hideLoading()
              self.saveToAlbum(tempRes.tempFilePath)
            },
            fail: () => {
              wx.hideLoading()
              self.setData({ posterGenerating: false })
              wx.showToast({ title: '画布导出失败', icon: 'none' })
            }
          })
        }

        qrImage.onload = () => {
          // 白色圆角底框
          ctx.fillStyle = '#FFFFFF'
          self.drawRoundedRect(ctx, qrX - 12, qrY - 12, QR_CODE_SIZE + 24, QR_CODE_SIZE + 24, 14)
          ctx.fill()
          ctx.drawImage(qrImage, qrX, qrY, QR_CODE_SIZE, QR_CODE_SIZE)

          // 引流文案
          ctx.textAlign = 'center'
          ctx.fillStyle = '#888888'
          ctx.font = '24px sans-serif'
          ctx.fillText('长按识别上方小程序，开启你的认知翻身', CANVAS_WIDTH / 2, qrY + QR_CODE_SIZE + QR_TEXT_HEIGHT)

          finishAndExport()
        }

        qrImage.onerror = () => {
          console.error('二维码图片加载失败，启动无码海报生成降级通道')
          finishAndExport()
        }
      })
  },

  drawRoundedRect(ctx, x, y, width, height, radius) {
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

  saveToAlbum(filePath) {
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
