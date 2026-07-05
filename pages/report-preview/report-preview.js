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
    this.setData({ posterGenerating: true })
    wx.showLoading({ title: '正在生成海报...', mask: true })

    const ctx = wx.createCanvasContext('posterCanvas', this)
    const W = 750
    const H = 1334
    const safeX = 40
    const cardW = 670
    const leftW = 112
    const textStartX = safeX + leftW + 28
    const textMaxW = cardW - leftW - 52

    const r = this.data.report
    const rd = this.data.reportData
    const getText = (i) => {
      if (r) {
        const keys = ['fatal_sentence', 'core_problem', 'system_trap', 'strategy_path']
        if (i < 4) return r[keys[i]] || ''
        return (r.advice || []).join('\n') || ''
      }
      const keys = ['basicInsight', 'mechanism', 'reverseReasoning', 'biasCorrection', 'actionPlan']
      return rd?.[keys[i]] || ''
    }
    const qrPath = this.data.qrcodePath || '/images/qrcode.png'

    const cards = [
      { no: '01', icon: '⚡', title: '致命一句话', color: '#ff3b3b', text: getText(0) },
      { no: '02', icon: '🎯', title: '核心问题',   color: '#8b5cff', text: getText(1) },
      { no: '03', icon: '🔍', title: '系统困局',   color: '#3b8cff', text: getText(2) },
      { no: '04', icon: '🚀', title: '翻身路径',   color: '#ff9f1a', text: getText(3) },
      { no: '05', icon: '📋', title: '行动建议',   color: '#39d353', text: getText(4) }
    ]

    function roundRect(x, y, w, h, r) {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
    }

    function drawWrappedText(text, x, y, maxWidth, lineHeight, maxLines, color, size) {
      ctx.setTextAlign('left')
      ctx.setFontSize(size)
      ctx.setFillStyle(color)

      const chars = String(text || '').replace(/\n/g, ' ').split('')
      let line = ''
      const lines = []

      chars.forEach(ch => {
        const test = line + ch
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line)
          line = ch
        } else {
          line = test
        }
      })
      if (line) lines.push(line)

      const final = lines.slice(0, maxLines)
      if (lines.length > maxLines) {
        final[maxLines - 1] = final[maxLines - 1].slice(0, -1) + '…'
      }

      final.forEach((l, i) => {
        ctx.fillText(l, x, y + i * lineHeight)
      })
    }

    function drawGlow(x, y, r, color, alpha) {
      const g = ctx.createCircularGradient(x, y, r)
      g.addColorStop(0, color)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.setGlobalAlpha(alpha)
      ctx.setFillStyle(g)
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
      ctx.setGlobalAlpha(1)
    }

    // 背景
    ctx.setFillStyle('#050914')
    ctx.fillRect(0, 0, W, H)
    drawGlow(160, 120, 220, '#7b3cff', 0.26)
    drawGlow(620, 120, 240, '#ff2d75', 0.18)
    drawGlow(375, 1120, 300, '#2d6bff', 0.18)

    // 标题
    ctx.setTextAlign('center')
    ctx.setFontSize(42)
    ctx.setFillStyle('#ffffff')
    ctx.fillText('珠澳小事哥 · 认知翻身策略', W / 2, 76)

    ctx.setFontSize(26)
    ctx.setFillStyle('#ff5ca8')
    ctx.fillText('🧠 认知教练视角已激活', W / 2, 122)

    ctx.setStrokeStyle('rgba(255,92,168,0.45)')
    ctx.setLineWidth(1)
    ctx.beginPath()
    ctx.moveTo(70, 145)
    ctx.lineTo(680, 145)
    ctx.stroke()

    // 内容卡片
    let y = 180

    cards.forEach((item, index) => {
      const isLast = index === 4
      const h = isLast ? 220 : 145

      // 卡片背景
      roundRect(safeX, y, cardW, h, 16)
      ctx.setFillStyle('rgba(8,14,32,0.88)')
      ctx.fill()
      ctx.setStrokeStyle(item.color)
      ctx.setLineWidth(1.5)
      ctx.stroke()

      // 左侧编号区
      ctx.setGlobalAlpha(0.16)
      ctx.setFillStyle(item.color)
      ctx.fillRect(safeX, y, leftW, h)
      ctx.setGlobalAlpha(1)

      ctx.setTextAlign('center')
      ctx.setFontSize(52)
      ctx.setFillStyle(item.color)
      ctx.fillText(item.no, safeX + leftW / 2, y + 62)

      ctx.setFontSize(40)
      ctx.fillText(item.icon, safeX + leftW / 2, y + 112)

      // 标题
      ctx.setTextAlign('left')
      ctx.setFontSize(30)
      ctx.setFillStyle(item.color)
      ctx.fillText(item.icon + ' ' + item.title, textStartX, y + 46)

      // 正文
      if (isLast) {
        const points = String(item.text || '')
          .replace(/。/g, '。\n')
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean)
          .slice(0, 5)

        points.forEach((p, i) => {
          const py = y + 82 + i * 27
          ctx.setFontSize(22)
          ctx.setFillStyle('#39d353')
          ctx.fillText('•', textStartX, py)
          drawWrappedText(p, textStartX + 22, py, textMaxW - 22, 26, 1, '#eaf0ff', 22)
        })
      } else {
        drawWrappedText(item.text, textStartX, y + 84, textMaxW, 32, 2, '#eaf0ff', 26)
      }

      y += h + 14
    })

    // 底部 CTA 区
    const ctaY = 1120
    const ctaH = 150

    roundRect(safeX, ctaY, cardW, ctaH, 24)
    ctx.setFillStyle('rgba(10,12,40,0.94)')
    ctx.fill()
    ctx.setStrokeStyle('#7b5cff')
    ctx.setLineWidth(2)
    ctx.stroke()

    // 二维码底座
    roundRect(safeX + 20, ctaY + 20, 110, 110, 18)
    ctx.setFillStyle('#ffffff')
    ctx.fill()
    ctx.drawImage(qrPath, safeX + 28, ctaY + 28, 94, 94)

    // CTA 文字
    ctx.setTextAlign('left')
    ctx.setFontSize(34)
    ctx.setFillStyle('#ff45c8')
    ctx.fillText('扫码测试你的翻身策略', safeX + 150, ctaY + 58)

    ctx.setFontSize(28)
    ctx.setFillStyle('#ffffff')
    ctx.fillText('看看你的认知在什么段位', safeX + 150, ctaY + 96)

    // 三标签
    const tags = ['🧠 认知诊断', '📈 策略分析', '🎯 破局建议']
    tags.forEach((tag, i) => {
      const tx = safeX + 150 + i * 142
      roundRect(tx, ctaY + 111, 124, 25, 11)
      ctx.setFillStyle('rgba(123,92,255,0.14)')
      ctx.fill()
      ctx.setStrokeStyle('rgba(180,130,255,0.7)')
      ctx.stroke()
      ctx.setFontSize(15)
      ctx.setFillStyle('#d9d6ff')
      ctx.setTextAlign('center')
      ctx.fillText(tag, tx + 62, ctaY + 129)
    })

    // 底部提示
    ctx.setTextAlign('center')
    ctx.setFontSize(22)
    ctx.setFillStyle('#7b6dff')
    ctx.fillText('»»» 长按识别小程序码 · 开启你的认知翻身之路 «««', W / 2, 1310)

    const self = this
    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'posterCanvas',
        width: 750,
        height: 1334,
        destWidth: 1500,
        destHeight: 2668,
        success: res => {
          self.setData({
            posterPath: res.tempFilePath,
            posterGenerating: false,
            showPoster: true
          })
          wx.hideLoading()
          self.saveToAlbum(res.tempFilePath)
        },
        fail: err => {
          console.error('[poster] 生成失败:', err)
          self.setData({ posterGenerating: false })
          wx.hideLoading()
          wx.showToast({ title: '海报生成失败', icon: 'none' })
        }
      }, self)
    })
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
