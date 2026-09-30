/**
 * pages/report-preview — v3.15 双模式
 *   type=diagnostic: 6题 → 5字段翻身策略报告（全免费）
 *   type=challenge_final: 30天挑战 → 收费报告
 */
const aiReportService = require('../../services/aiReportService.js')
const analytics = require('../../utils/analytics.js')
const posterContent = require('../../utils/worldModelPosterContent.js')
const posterRenderer = require('../../utils/worldModelPosterRenderer.js')
const app = getApp()

// ── PAYMENT_STAGE5A_R8_P0: canonical report-access authority ──
// 完整报告查看权限的唯一权威来自服务端（report.isPaid || VIP）。
// 客户端不再持有第二套 membership-only 权威（旧 'full_report'
// checkPermission 二次闸门已移除 —— 它正是「已购报告仍锁死」的根因）。
// 服务端 locked=false / canViewFullReport=true 绝不被客户端覆盖。
const REPORT_ACCESS_AUTHORITY = 'server'

// Stage5B + R4_P0_FIX2 — bounded re-check while the server reports
// status='generating'. 24 × 5s = 120s cap (>= the server stale window 90s),
// so the client never gives up while the server can still finish. Polling stops
// on unload and on any terminal state; at most ONE timer is ever live.
const CF_POLL_INTERVAL = 5000
const CF_MAX_POLLS = 24

Page({
  data: {
    recordId:'', reportType:'',
    report:null, locked:true, loading:true, generating:false,
    showGenerating:false, showUpgradeModal:false,
    posterGenerating:false,
    retryCreating:false,
    qrcodePath: '/images/qrcode.png',
    titlesReady: false,
    contentVisible: true,
    // ── R10: 世界模型报告 Hero + 海报预览 ──
    heroConclusion: '',
    heroInterpretation: '',
    posterPath: '',
    showPoster: false,
    posterImageUrl: '',
    // ── Stage5B: challenge_final server-authoritative state machine ──
    // cfState: 'loading' | 'generating' | 'ready' | 'failed' | 'error'
    cfState: 'loading',
    cfMsg: '',
    cfSummaryText: '',
    cfReportId: '',
    cfPollCount: 0,
    cfMaxPolls: 0,
    cfSoftTimeout: false,   // client budget exhausted but server may still be generating
    reportData: {
      basicInsight: '',     // 1: 位置定位
      mechanism: '',        // 2: 困住因素
      reverseReasoning: '', // 3: 不建议（🚫）
      biasCorrection: '',   // 4: 翻身路径
      actionPlan: ''        // 5: 90天行动
    },
  },

  onLoad(opt){
    const isDiagnostic = opt.type === 'diagnostic'
    const reportType = opt.type || 'challenge_final'
    this.setData({ recordId: opt.recordId || (isDiagnostic ? 'diag' : ''), reportType })

    if (isDiagnostic) {
      if (app.globalData._diagnosticAnswers) {
        this._loadDiagnostic()
        return
      }
      if (app.globalData._diagnosticReport) {
        const r = app.globalData._diagnosticReport
        const p = app.globalData._diagnosticPersonality
        app.globalData._diagnosticReport = null
        app.globalData._diagnosticPersonality = null
        this.setData({
          report: {
            system_trap: r.trapped_by || r.system_trap || '',
            core_problem: r.position || r.core_problem || '',
            fatal_sentence: Array.isArray(r.forbidden) ? r.forbidden.join('\n') : (r.fatal_sentence || ''),
            strategy_path: r.path || r.strategy_path || '',
            advice: Array.isArray(r.next90days) ? r.next90days : (Array.isArray(r.advice) ? r.advice : []),
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
      return
    }

    // ── challenge_final: server-authoritative load (Stage5B) ──
    // R8_P0: 抑制 onLoad 后紧跟的首次 onShow 重复刷新（首次加载已在此发起）。
    this._cfSuppressNextShow = true
    this._startChallengeFinal()
  },

  onShow(){
    // R8_P0: 返回报告页（含支付后 navigateBack）时，总是以服务端权威状态刷新。
    // 不再依赖瞬时 _cfReturnFromPay 标志；仅在「非生成中」时读取以避免重复生成。
    if (this.data.reportType !== 'challenge_final') return
    if (this._cfSuppressNextShow) { this._cfSuppressNextShow = false; return }
    if (this._cfUnloaded) this._cfUnloaded = false
    if (this.data.cfState === 'generating') return
    this._startChallengeFinal()
  },

  /* 从 report 对象同步到 reportData（WXML 统一绑定） */

  /* ═══ challenge_final 专用适配器 ═══ */
  normalizeChallengeFinalReport(raw) {
    // Locked payloads carry only `summary` (a subset). Deep fields are
    // intentionally absent there — do not treat them as a parse failure.
    const locked = !!(raw && raw.locked === true && !raw.content);
    const c = raw.content || raw.summary || raw || {};
    const missing = [];
    const pick = (key) => {
      if (c[key] !== undefined && c[key] !== null) return c[key];
      missing.push(key); return '';
    };
    const thirtyDay = c.thirtyDayActions;
    let actionAdvice = '';
    if (Array.isArray(thirtyDay)) {
      actionAdvice = thirtyDay.map(function(a) {
        return typeof a === 'object' ? (a.text || a.action || JSON.stringify(a)) : String(a);
      }).join('\n');
    } else if (typeof thirtyDay === 'string') {
      actionAdvice = thirtyDay;
    }
    const result = {
      basicInsight:     pick('oneSentence'),
      systemTrap:       pick('whyNotRich'),
      coreProblem:      pick('biggestCognitiveGap'),
      turnaroundPath:   pick('bestPath'),
      actionAdvice:     actionAdvice || pick('thirtyDayActions'),
      fatalSentence:    pick('finalStrike'),
      worldModelType:   pick('worldModelType'),
      turnaroundProbability: c.turnaroundProbability !== undefined ? c.turnaroundProbability : 0,
      threeYearRisk:    pick('threeYearRisk'),
      _missingFields: locked ? [] : missing,
      _reportType: 'challenge_final',
    };
    if (!locked && missing.length) {
      console.error('[CONTRACT_MISSING_FIELDS] challenge_final:', missing);
    }
    return result;
  },

  // R10: Hero 一句话解读。优先用服务端摘要；与结论句重复时退化为既有字段/静态描述（非 AI）。
  _deriveHeroInterpretation (n) {
    const conclusion = (n && n.basicInsight) || ''
    const summary = this.data.cfSummaryText || ''
    if (summary && summary !== conclusion) return summary
    const core = (n && n.coreProblem) || ''
    if (core && core !== conclusion) return core
    return '基于你的30天认知挑战、九维评分与行为标签生成'
  },

  /* 从 report 对象同步到 reportData（WXML 统一绑定） */
  _syncReportToReportData() {
    const r = this.data.report;
    if (!r) return;
    const rt = r.reportType || r.type || '';

    if (rt === 'challenge_final') {
      const n = this.normalizeChallengeFinalReport(r);
      console.log('[ChallengeReportPreviewSync]', {
        reportType: rt,
        normalizedKeys: Object.keys(n),
        missingFields: n._missingFields || [],
      })
      this.setData({
        reportData: {
          basicInsight: n.basicInsight,
          mechanism: n.systemTrap,
          reverseReasoning: n.coreProblem,
          biasCorrection: n.turnaroundPath,
          actionPlan: n.actionAdvice,
        },
        _cfMeta: {
          worldModelType: n.worldModelType,
          turnaroundProbability: n.turnaroundProbability,
          threeYearRisk: n.threeYearRisk,
        },
        // R10 Hero 绑定（PAGE_TITLE / SMALL_BADGE / CORE_CONCLUSION / ONE_LINE_INTERPRETATION）
        heroConclusion: n.basicInsight || this.data.cfSummaryText || '',
        heroInterpretation: this._deriveHeroInterpretation(n),
      });
      if (n._missingFields && n._missingFields.length) {
        console.error('[CONTRACT_MISSING_FIELDS] challenge_final:', n._missingFields);
        wx.showToast({ title: '报告数据解析异常，请重新生成', icon: 'none', duration: 3000 });
      }
      return;
    }

    // diagnostic / legacy
    this.setData({
      reportData: {
        basicInsight: r.position || r.fatal_sentence || r.trapped_by || '',
        mechanism: r.trapped_by || r.core_problem || '',
        reverseReasoning: r.forbidden || r.system_trap || '',
        biasCorrection: r.path || r.strategy_path || '',
        actionPlan: (Array.isArray(r.next90days) ? r.next90days :
                      Array.isArray(r.advice) ? r.advice : []).join('\n') || '',
      }
    });
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
            position: r.data.position || r.data.core_problem || '',
            trapped_by: r.data.trapped_by || r.data.system_trap || '',
            forbidden: Array.isArray(r.data.forbidden) ? r.data.forbidden.join('\n') : '',
            path: r.data.path || r.data.strategy_path || '',
            next90days: Array.isArray(r.data.next90days) ? r.data.next90days :
                        Array.isArray(r.data.advice) ? r.data.advice : [],
            system_trap: r.data.trapped_by || r.data.system_trap || '',
            core_problem: r.data.position || r.data.core_problem || '',
            fatal_sentence: r.data.fatal_sentence || '',
            strategy_path: r.data.path || r.data.strategy_path || '',
            advice: Array.isArray(r.data.next90days) ? r.data.next90days :
                    Array.isArray(r.data.advice) ? r.data.advice : [],
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

  onUnload(){
    // Stop any in-flight generating re-check when leaving the page.
    this._cfUnloaded = true
    this._stopPoll()
    analytics.flush()
  },

  /* ═══════════════════════════════════════════════════════════════════
     Stage5B — challenge_final server-authoritative load
     ───────────────────────────────────────────────────────────────────
     Contract (verified against cloudfunctions):
       • generateAiReport({ type:'challenge_final', recordId })  ← recordId = 挑战记录ID
         returns { reportId, status?, locked, summary?|content? }
       • reportId (server-issued) is the ONLY id used to purchase the report.
       • getAiReport({ reportId }) reads it back.
     No client-side report-id computation. State + lock + body all come from
     the server payload.
     ═══════════════════════════════════════════════════════════════════ */
  _startChallengeFinal(){
    this._cfUnloaded = false
    const recordId = this.data.recordId
    if (!recordId){
      this.setData({ cfState:'error', cfMsg:'缺少挑战记录ID，请先完成一次认知挑战', loading:false })
      return
    }
    this._cfPollTimer && clearTimeout(this._cfPollTimer)
    this._cfPollCount = 0
    this.setData({ cfState:'loading', cfMsg:'', cfSoftTimeout:false, loading:true, report:null, locked:true, cfSummaryText:'', cfReportId:'' })
    this._requestChallengeReport()
  },

  async _requestChallengeReport(){
    const recordId = this.data.recordId
    try {
      const r = await aiReportService.generateAiReport('challenge_final', recordId)
      if (this._cfUnloaded) return
      if (!r || r.code !== 0){
        console.error('[report-preview] challenge_final failed:', r && r.code, r && r.message)
        this._stopPoll()
        this.setData({ cfState:'failed', cfSoftTimeout:false, cfMsg:(r && r.message) || '报告生成失败，请重试', loading:false })
        return
      }
      const d = r.data || {}
      this._cfReportId = d.reportId || ''

      // explicit server-side terminal failure → stop immediately + retry
      if (d.status === 'failed'){
        this._stopPoll()
        this.setData({ cfState:'failed', cfSoftTimeout:false, cfMsg:'报告生成失败，请重试', loading:false, cfReportId: this._cfReportId })
        return
      }

      // generating → bounded, spaced re-check; leave page stops it
      if (d.status === 'generating'){
        this.setData({ cfState:'generating', cfSoftTimeout:false, loading:false, report:null, cfReportId: this._cfReportId })
        this._schedulePoll()
        return
      }

      // ready → terminal: stop polling immediately
      this._stopPoll()
      const summaryText = (d.summary && d.summary.oneSentence)
        || (d.content && d.content.oneSentence)
        || '你的认知画像已生成'
      this.setData({
        report: d,
        // R8_P0: locked 完全来自服务端权威（canViewFullReport / locked）；
        // fail-closed：仅当服务端明确 false 才解锁。
        locked: (d.canViewFullReport === true) ? false : (d.locked !== false),
        cfState: 'ready',
        cfSoftTimeout: false,
        cfMsg: '',
        loading: false,
        cfSummaryText: summaryText,
        cfReportId: this._cfReportId,
      })
      this._syncReportToReportData()
    } catch (e) {
      if (this._cfUnloaded) return
      console.error('[report-preview] challenge_final exception:', e && e.message)
      this._stopPoll()
      this.setData({ cfState:'failed', cfSoftTimeout:false, cfMsg:'网络异常，请重试', loading:false })
    }
  },

  // Single point that clears the in-flight poll timer → at most one live loop.
  _stopPoll(){
    this._cfPollTimer && clearTimeout(this._cfPollTimer)
    this._cfPollTimer = null
  },

  _schedulePoll(){
    // Never stack timers → guarantees no duplicate poll loops.
    this._stopPoll()
    if (this._cfUnloaded) return
    const MAX = CF_MAX_POLLS
    if (typeof this._cfPollCount !== 'number') this._cfPollCount = 0
    if (this._cfPollCount >= MAX){
      // Client budget exhausted. The server may STILL be generating, so this is
      // NOT a server failure — surface a neutral "still generating" state with a
      // controlled retry rather than a false "生成失败".
      this.setData({ cfState:'failed', cfSoftTimeout:true, cfMsg:'报告仍在生成中，请稍后重试' })
      return
    }
    this._cfPollCount += 1
    this.setData({ cfPollCount: this._cfPollCount, cfMaxPolls: MAX })
    this._cfPollTimer = setTimeout(() => {
      this._cfPollTimer = null
      if (this._cfUnloaded) return
      this._requestChallengeReport()
    }, CF_POLL_INTERVAL)
  },

  // Controlled retry (failed → re-request). Never creates a second entity:
  // the server reuses the same deterministic report entity.
  onRetryReport(){
    this._stopPoll()
    this._cfPollCount = 0
    this.setData({ cfState:'loading', cfMsg:'', cfSoftTimeout:false, loading:true, cfPollCount:0, cfMaxPolls:CF_MAX_POLLS })
    this._requestChallengeReport()
  },

  // 9.9 report unlock entry — ONLY reachable when the report is server-confirmed
  // ready. Passes the SERVER reportId as relatedId (never a client-computed id).
  onGenerate(){
    const reportId = this._cfReportId || (this.data.report && this.data.report.reportId)
    if (this.data.cfState !== 'ready'){
      wx.showToast({ title:'报告正在生成中，请稍候', icon:'none' })
      return
    }
    if (!reportId){
      wx.showToast({ title:'报告信息缺失，请重试', icon:'none' })
      return
    }
    analytics.track('report_unlock_click')
    wx.navigateTo({
      url: '/pages/membership/membership?source=report&productId=report_9_9&recordId='
        + encodeURIComponent(reportId),
    })
  },

  onUnlock(){ return this.onGenerate() },

  onGenerateDone(){ /* ai-generating completion hook (visual only) */ },

  onGoChallenge(){
    wx.redirectTo({ url:'/pages/challenge-play/challenge-play' })
  },

  // ── R8_P0/R9: 唯一报告访问权威 = 服务端结论 ──
  // 单份已购报告（report.isPaid）或 VIP 授权 → 解锁。旧的 membership-only
  // checkPermission('full_report') 二次闸门已删除 —— 它是已购报告仍锁死的根因。
  // 服务端 locked=false / canViewFullReport=true 绝不被客户端覆盖。
  // R9: 已解锁时报告页直接全量渲染，不再有「查看完整报告」二级入口。
  requestFullReportAccess() {
    const d = this.data.report
    if (!d) return false
    if (d.canViewFullReport === true) return true
    if (d.isPaid === true && d.locked === false) return true
    return false
  },

  onUpgrade(){ analytics.track('membership_visit'); wx.navigateTo({ url:'/pages/membership/membership' }) },

  // R9: 升级弹窗仅在未解锁态可用；「先看报告」只是关闭弹窗回到摘要（不再有二级跳转）。
  onCloseUpgrade(){ this.setData({ showUpgradeModal: false }) },

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
     海报入口 — 按 reportType 分派
     ═══════════════════════════════════════ */
  generatePoster() {
    if (this.data.reportType === 'diagnostic') return this._generateDiagnosticPoster()
    return this._generateWorldModelPoster()
  },

  onClosePoster() { this.setData({ showPoster: false }) },

  /* R10.4 统一收尾（幂等）。所有 success / fail / timeout / exception 路径都必须会聚到这里。
     职责：清绘制/导出定时器 · 解除 loading · 复位 posterGenerating。 */
  _finishPosterGeneration(_ok, msg) {
    if (this._drawWatchdogTimer) { clearTimeout(this._drawWatchdogTimer); this._drawWatchdogTimer = null }
    if (this._exportWatchdogTimer) { clearTimeout(this._exportWatchdogTimer); this._exportWatchdogTimer = null }
    try { wx.hideLoading() } catch (e) {}
    this._posterDone = true
    this.setData({ posterGenerating: false })
    if (msg) { try { wx.showToast({ title: msg, icon: 'none' }) } catch (e) {} }
  },

  /* ═══════════════════════════════════════
     R10 世界模型报告海报（1080×1920）
     SOURCE_ONLY_FROM_CURRENT_REPORT · AI_REGEN_FORBIDDEN
     状态机：idle → preparing → drawing → exporting → success|failed
     不变式：终态后 posterGenerating 必为 false；每步均有终态守卫。
     ═══════════════════════════════════════ */
  _generateWorldModelPoster() {
    if (this.data.posterGenerating) return   // STEP_01 防重入
    this._posterDone = false
    this.setData({ posterGenerating: true })  // STEP_02
    wx.showLoading({ title: '正在生成海报...', mask: true })  // STEP_03
    const self = this

    // STEP_04 内容映射
    let content
    try {
      content = posterContent.buildPosterContent(this.data.reportData, {
        mainType: (this.data._cfMeta && this.data._cfMeta.worldModelType) || '',
      })
    } catch (e) {
      console.error('[worldModelPoster] content build fail:', e)
      return this._finishPosterGeneration(false, '海报生成失败，请重试')
    }

    // STEP_05 画布上下文（posterCanvas 常驻页面根节点，调用前必已挂载）
    let ctx, out, W, H
    try {
      ctx = wx.createCanvasContext('posterCanvas', this)
      // STEP_06 绘制指令；QR 缺失不致命（渲染器内部已 try/catch）
      out = posterRenderer.drawPoster(ctx, content, { qrPath: this.data.qrcodePath || '/images/qrcode.png' })
      W = out.width
      H = out.height
    } catch (e) {
      console.error('[worldModelPoster] render fail:', e)
      return this._finishPosterGeneration(false, '海报生成失败，请重试')
    }

    // 绘制看门狗：即便 ctx.draw 回调永不触发，也能落入终态
    this._drawWatchdogTimer = setTimeout(() => {
      if (self._posterDone) return
      console.error('[worldModelPoster] draw watchdog timeout')
      self._finishPosterGeneration(false, '海报生成超时，请重试')
    }, 4000)

    // STEP_07 提交绘制
    ctx.draw(false, () => {
      if (self._posterDone) return
      if (self._drawWatchdogTimer) { clearTimeout(self._drawWatchdogTimer); self._drawWatchdogTimer = null }

      // STEP_08 导出（导出看门狗：避免 canvasToTempFilePath 回调挂起）
      self._exportWatchdogTimer = setTimeout(() => {
        if (self._posterDone) return
        console.error('[worldModelPoster] export watchdog timeout')
        self._finishPosterGeneration(false, '海报导出超时，请重试')
      }, 6000)

      wx.canvasToTempFilePath({
        canvasId: 'posterCanvas', x: 0, y: 0, width: W, height: H, destWidth: W, destHeight: H,
        success: (res) => {
          if (self._posterDone) return
          // STEP_09 预览
          self.setData({ posterPath: res.tempFilePath, posterImageUrl: res.tempFilePath, showPoster: true })
          self._finishPosterGeneration(true)   // STEP_10 统一收尾（不弹 toast）
        },
        fail: (err) => {
          console.error('[worldModelPoster] canvasToTempFilePath fail:', err)
          self._finishPosterGeneration(false, '海报生成失败，请重试')
        },
      }, self)
    })
  },

  savePoster() {
    const p = this.data.posterPath || this.data.posterImageUrl
    if (!p) { wx.showToast({ title: '海报尚未生成', icon: 'none' }); return }
    this._savePosterImage(p)
  },

  _savePosterImage(filePath) {
    const self = this
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => { self.setData({ posterGenerating: false }); wx.showToast({ title: '已保存到相册', icon: 'success' }) },
      fail: (err) => {
        self.setData({ posterGenerating: false })
        if (err && err.errMsg && err.errMsg.indexOf('auth') >= 0) {
          wx.showModal({
            title: '授权提示',
            content: '请允许保存到相册，否则海报无法保存。',
            success: (res) => { if (res.confirm) wx.openSetting() },
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      },
    })
  },

  // R10.7 重新挑战 — OPTION_C：报告页直接调用服务端显式重放。
  // 服务端校验权益后创建【全新】unlocked 记录并返回新 recordId；客户端跳 challenge-play。
  // 不再走 switchTab / challenge-start 常规入口；不触碰支付 / 权益写入 / 既有报告。
  onRetryChallenge() {
    // RC8.9_P0_REPLAY_OBSERVABILITY — 仅埋点，不改动任何 replay 业务语义。
    analytics.track('challenge_retry_tap')
    // RC8_9_P0_REPLAY_MODAL_CONFIRMTEXT_FIX — wx.showModal 的 confirmText/cancelText
    // 官方约束为「最多 4 个字符」；此前 confirmText='确认重新挑战'(6 字符) 超限，
    // 导致弹窗无法渲染 → success/confirm 永不回调 → replay 全链路静默失效。
    // 仅收敛按钮文案，replay 业务语义与 payload 一律不变。
    wx.showModal({
      title: '重新挑战一次？',
      content: '将开启一轮新的挑战，当前挑战结果和世界模型报告都会保留，不影响已购权益。',
      cancelText: '取消',
      confirmText: '确认',
      fail: (err) => {
        // 弹窗无法打开时的显式可观测失败（只记录安全字段，绝不含 openid/密钥/支付凭据）。
        const msg = (err && err.errMsg) || 'showModal:fail'
        console.error('[retry] showModal fail:', msg)
        analytics.track('challenge_retry_modal_fail', {
          safe_error_code: (msg.split(':')[1] || '').trim() || 'unknown',
          safe_error_message: msg.replace(/openid=[^,&\s]+/gi, 'openid=***'),
          route: 'pages/report-preview',
        })
        wx.showToast({ title: '弹窗打开失败，请重试', icon: 'none' })
      },
      success: (res) => {
        if (!res.confirm) return
        if (this.data.retryCreating) return   // 快速双击 / 重复确认防抖
        this.setData({ retryCreating: true })
        analytics.track('challenge_retry_modal_confirm')

        // 每次确认生成唯一 replayRequestId（服务端据此幂等）
        const replayRequestId = 'RP' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)

        analytics.track('challenge_retry_request_sent')
        wx.cloud.callFunction({
          name: 'startChallenge',
          data: { mode: 'challenge', replay: true, replayRequestId, replaySource: 'world_model_report' },
        }).then((r) => {
          const result = r && r.result
          if (!result || result.code !== 0 || !result.data || !result.data.recordId) {
            throw new Error((result && result.message) || 'replay failed')
          }
          if (result.data.trialMode !== false) throw new Error('replay not entitled')

          analytics.track('challenge_retry_request_success')
          wx.navigateTo({
            url: '/pages/challenge-play/challenge-play?mode=challenge&recordId=' + encodeURIComponent(result.data.recordId),
            success: () => { analytics.track('challenge_retry_nav_success') },
            fail: (err) => {
              console.error('[retry] navigateTo challenge-play fail:', err)
              analytics.track('challenge_retry_nav_fail')
              wx.showToast({ title: '无法进入挑战，请重试', icon: 'none' })
            },
            complete: () => { this.setData({ retryCreating: false }) },
          })
        }).catch((err) => {
          console.error('[retry] replay startChallenge fail:', err)
          analytics.track('challenge_retry_request_fail')
          wx.showToast({ title: '无法开始新挑战，请重试', icon: 'none' })
          this.setData({ retryCreating: false })
        })
      },
    })
  },

  /* ═══════════════════════════════════════
     diagnostic 海报（保留既有实现）
     ═══════════════════════════════════════ */
  _generateDiagnosticPoster() {
    if (this.data.posterGenerating) return
    this.setData({ posterGenerating: true })
    wx.showLoading({ title: '正在生成海报...', mask: true })

    const ctx = wx.createCanvasContext('posterCanvas', this)
    const W = 750
    const safeX = 40
    const cardW = 670
    const leftW = 112
    const textX = safeX + leftW + 28
    const textMaxW = cardW - leftW - 52
    const qrPath = this.data.qrcodePath || '/images/qrcode.png'

    // v3.16.1 fix: 用 reportData 替代从未赋值的 sections
    const rd = this.data.reportData || {}
    const cards = [
      { no: '01', icon: '⚡', title: '致命一句话', color: '#ff3b3b', text: rd.basicInsight || '' },
      { no: '02', icon: '🎯', title: '核心问题',   color: '#8b5cff', text: rd.mechanism || '' },
      { no: '03', icon: '🔍', title: '系统困局',   color: '#3b8cff', text: rd.reverseReasoning || '' },
      { no: '04', icon: '🚀', title: '翻身路径',   color: '#ff9f1a', text: rd.biasCorrection || '' },
      { no: '05', icon: '📋', title: '行动建议',   color: '#39d353', text: rd.actionPlan || '' }
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

    function splitLines(text, maxWidth, size) {
      ctx.setFontSize(size)
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
      return lines
    }

    function splitActionLines(text) {
      return String(text || '')
        .replace(/；/g, '；\n')
        .replace(/。/g, '。\n')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
    }

    function drawWrappedLines(lines, x, y, lineHeight, color, size) {
      ctx.setTextAlign('left')
      ctx.setFontSize(size)
      ctx.setFillStyle(color)
      lines.forEach((line, i) => {
        ctx.fillText(line, x, y + i * lineHeight)
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

    // 预计算每张卡片真实高度
    cards.forEach((item, index) => {
      if (index === 4) {
        const points = splitActionLines(item.text)
        let totalLines = 0
        item._points = points.map(p => {
          const lines = splitLines(p, textMaxW - 30, 22)
          totalLines += lines.length
          return lines
        })
        item._height = Math.max(220, 90 + totalLines * 28 + points.length * 8 + 30)
      } else {
        item._lines = splitLines(item.text, textMaxW, 26)
        item._height = Math.max(145, 95 + item._lines.length * 34 + 28)
      }
    })

    const headerH = 180
    const gap = 14
    const cardsH = cards.reduce((sum, item) => sum + item._height, 0) + gap * (cards.length - 1)
    const ctaH = 150
    const footerH = 80
    const H = headerH + cardsH + 60 + ctaH + footerH

    // 背景
    ctx.setFillStyle('#050914')
    ctx.fillRect(0, 0, W, H)

    drawGlow(160, 120, 220, '#7b3cff', 0.26)
    drawGlow(620, 120, 240, '#ff2d75', 0.18)
    drawGlow(375, H - 220, 300, '#2d6bff', 0.18)

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

    // 卡片
    let y = 180

    cards.forEach((item, index) => {
      const h = item._height

      roundRect(safeX, y, cardW, h, 16)
      ctx.setFillStyle('rgba(8,14,32,0.88)')
      ctx.fill()
      ctx.setStrokeStyle(item.color)
      ctx.setLineWidth(1.5)
      ctx.stroke()

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

      ctx.setTextAlign('left')
      ctx.setFontSize(30)
      ctx.setFillStyle(item.color)
      ctx.fillText(item.icon + ' ' + item.title, textX, y + 46)

      if (index === 4) {
        let py = y + 86
        item._points.forEach(lines => {
          ctx.setFontSize(22)
          ctx.setFillStyle('#39d353')
          ctx.fillText('•', textX, py)
          drawWrappedLines(lines, textX + 24, py, 28, '#eaf0ff', 22)
          py += lines.length * 28 + 8
        })
      } else {
        drawWrappedLines(item._lines, textX, y + 86, 34, '#eaf0ff', 26)
      }

      y += h + gap
    })

    // CTA
    const ctaY = y + 48

    roundRect(safeX, ctaY, cardW, ctaH, 24)
    ctx.setFillStyle('rgba(10,12,40,0.94)')
    ctx.fill()
    ctx.setStrokeStyle('#7b5cff')
    ctx.setLineWidth(2)
    ctx.stroke()

    roundRect(safeX + 20, ctaY + 20, 110, 110, 18)
    ctx.setFillStyle('#ffffff')
    ctx.fill()
    ctx.drawImage(qrPath, safeX + 28, ctaY + 28, 94, 94)

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
    ctx.fillText('»»» 长按识别小程序码 · 开启你的认知翻身之路 «««', W / 2, H - 30)

    const self = this
    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'posterCanvas',
        x: 0,
        y: 0,
        width: W,
        height: H,
        destWidth: W * 2,
        destHeight: H * 2,
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
