/**
 * pages/challenge-play — v3.17 Data Contract Engine
 *   mode=challenge: 原有 30 天挑战 (DB 驱动)
 *   mode=diagnostic: v3 10 题问卷 (answers[key] 数据契约，禁止 idx 索引)。
 */
const challengeService = require('../../services/challengeService.js')
const aiReportService = require('../../services/aiReportService.js')
const { getRandomPersonality } = require('../../utils/personalityModes.js')
const app = getApp()

/** V4 10 题认知审判问卷 — 每道题自携 options，通过 key 唯一标识 */
const DIAGNOSTIC_QUESTIONS = [
  // Q1 人生阶段
  { id:'lifeStage',     key:'lifeStage',     title:'你目前处于什么人生阶段？',     subtitle:'阶段不同，牌桌规则完全不同',                  type:'picker', options:['请选择','18-24岁','25-30岁','31-40岁','41-50岁','50岁以上'] },
  // Q2 收入结构 + 具体职业（同屏）
  { id:'income+occ',    key:'incomeStructure', title:'你的主要收入结构是？',       subtitle:'收入结构决定了你的底层经济模型',              type:'picker+input', options:['请选择','工资/固定薪资','技能服务（按次/项目收费）','销售/佣金/提成','实体生意/经营收入','线上内容/流量变现','资产/投资/租金收入','收入不稳定'], detailPlaceholder:'请输入具体职业，例如：厨师、销售、程序员' },
  // Q3 月结余
  { id:'monthlySurplus',key:'monthlySurplus', title:'你每个月扣除所有支出后，还剩多少？', subtitle:'月结余是你的行动燃料',                   type:'picker', options:['请选择','负数（入不敷出）','基本为零','1000元以下','1000-5000元','5000-10000元','10000元以上'] },
  // Q4 安全垫 + 负债（同屏）
  { id:'safety+debt',   key:'safetyMonths',   title:'如果明天开始你没有任何收入，存款能撑多久？', subtitle:'这是你最重要的安全垫',              type:'picker+multi', options:['请选择','不到1个月','1-3个月','3-6个月','6-12个月','12-24个月','24个月以上'], extraField:'debtPressure', extraOptions:['请选择负债情况','无负债','房贷为主（低月供）','消费贷/信用卡压力较大','债务压力高/以贷养贷'], extraLabel:'负债情况', extraKey:'debtPressure' },
  // Q5 技能验证 + 最可能变现能力（同屏）
  { id:'skill+monetize',key:'skillValidation', title:'你的能力被市场验证到什么程度了？', subtitle:'没被市场验证的能力，只是爱好',           type:'picker+multi', options:['请选择','从未变现过','免费帮人做过','免费被感谢过','赚到过一次钱','偶尔有付费需求','有稳定客户/收入'], extraField:'monetizableSkill', extraOptions:['请选择最可能变现的能力','技术类（编程/设计/工程）','销售/商务谈单','运营/管理/统筹','内容创作（写/拍/剪/直播）','人脉/资源对接','手艺人（厨师/维修/美业）','暂时不清楚'], extraLabel:'最可能变现的能力', extraKey:'monetizableSkill' },
  // Q6 时间 + 执行稳定性（同屏）
  { id:'time+exec',     key:'weeklyTime',     title:'你每周能挤出多少可自由支配的时间？', subtitle:'时间是第二曲线的关键生产资料',           type:'picker+multi', options:['请选择','不到2小时','2-5小时','5-10小时','10-20小时','20小时以上'], extraField:'executionStability', extraOptions:['请选择执行状态','很容易三分钟热度，计划经常中断','偶尔能坚持，但不稳定','有固定计划，基本能执行','非常稳定，不需要外部督促'], extraLabel:'你的执行力如何？', extraKey:'executionStability' },
  // Q7 过去一年赚钱尝试
  { id:'pastAttempt',   key:'pastAttemptStage', title:'过去一年，你最接近赚钱的一次尝试是？', subtitle:'行动记录是最诚实的认知画像',              type:'picker', options:['请选择','还没开始过任何尝试','只买过课/看过教程，没真正做过','坚持不到30天就停了','做了一个产品/服务但没卖出去','卖出过几个，有少量收入','已有稳定的副业/兼职收入'] },
  // Q8 不确定机会决策
  { id:'decision',      key:'decisionStyle',  title:'当一个机会看起来不错但不确定时，你一般怎么做？', subtitle:'决策风格决定了你错过机会还是踩坑', type:'picker', options:['请选择','直接辞职/全职All-in','边上班边小规模测试','先学一阵子再判断','等别人先做了我再跟上','能不动就不动'] },
  // Q9 未来12个月核心目标
  { id:'primaryGoal',   key:'primaryGoal',    title:'未来12个月，你最想做成的事是什么？',  subtitle:'目标决定路径，路径决定结果',                 type:'picker', options:['请选择','搞一份副业收入','把技能变现/做咨询','建立个人IP/品牌','转行进入新领域','从副业变主业/独立','还清债务/修复现金流','先找到方向再说'] },
  // Q10 最大试错成本 + 失败反应（同屏）
  { id:'risk+fail',     key:'maxTrialCost',   title:'你能承受的最大试错成本是多少？',     subtitle:'风险边界决定了你的策略选项',                type:'picker+multi', options:['请选择','几乎为零（赔不起）','1000元以内','1000-5000元','5000-20000元','20000元以上'], extraField:'failureResponse', extraOptions:['请选择失败后你会怎么做','直接放弃，不再尝试','换个方向继续试','复盘优化后继续','追加投入再试一次','不确定'], extraLabel:'如果试错失败了，你会？', extraKey:'failureResponse' },
]

Page({
  data: {
    recordId:'', mode:'',
    // challenge 模式
    event:null, selectedKey:'', submitted:false,
    nextEvent:null, progress:{current:0,total:30,day:1},
    loading:true, end:false, animOut:false, animIn:false,
    challengeLocked: false, lockReason: '',
    // diagnostic 模式 — Data Contract Engine
    currentQuestion: null,
    dQ:{idx:0,total:10,percent:10,label:'',answers:{},selectedPick:'',detailText:'',extraPick:'',submitting:false,personality:null,canNext:false},
  },

  onLoad(opt) {
    const mode = opt.mode || 'challenge'
    this.setData({ recordId: opt.recordId || '', mode })
    if (mode === 'diagnostic') {
      this._initDiagnostic()
    } else {
      this.nextEvent()
    }
  },

  /* ═══════════════════════════════════
     Challenge 模式 (原有 30 天)
     ═══════════════════════════════════ */
  async nextEvent() {
    if (this.data.end) return
    if (this._loadingEvent) return
    this._loadingEvent = true

    this.setData({
      loading: true,
      loadFailed: false,
    })

    try {
      const r = await challengeService.getChallengeEvent(this.data.recordId)

      if (!r || r.code !== 0 || !r.data) {
        throw new Error(r?.message || '题目加载失败')
      }

      const ev = r.data

      console.log('[ChallengeFirstEventLoad]', {
        mode: this.data.mode,
        recordId: this.data.recordId,
        code: r.code,
        dataKeys: ev ? Object.keys(ev) : [],
        locked: ev.locked,
        needPayment: ev.needPayment,
        finished: ev.finished,
        eventId: ev.eventId,
        day: ev.day,
        hasTitle: !!ev.title,
        choicesLength: ev.choices ? ev.choices.length : 0,
      })

      const isLocked =
        ev.locked === true ||
        ev.needPayment === true ||
        ev.needPay === true

      if (isLocked) {
        this.setData({
          loading: false,
          loadFailed: false,
          challengeLocked: true,
          lockReason: ev.message || '免费体验已完成',
        })
        return
      }

      if (ev.finished === true) {
        this.setData({ loading: false })
        if (this.data.mode === 'diagnostic') {
          wx.redirectTo({ url:'/pages/report-preview/report-preview?recordId=' + this.data.recordId })
        } else {
          this.goResult()
        }
        return
      }

      if (!ev.eventId || !ev.title || !Array.isArray(ev.choices)) {
        throw new Error('题目数据不完整')
      }

      const choices = ev.choices.map(c => ({ key: c.key, text: c.text }))

      this.setData({
        loading: false,
        loadFailed: false,
        challengeLocked: false,
        selectedKey: '',
        submitted: false,
        event: { ...ev, choices },
        progress: {
          current: (ev.progress && ev.progress.current) || (ev.day || 1),
          total: (ev.progress && ev.progress.total) || 30,
          day: ev.day || (ev.progress && ev.progress.day) || 1,
        },
        animIn: true,
      })
      setTimeout(() => this.setData({ animIn: false }), 300)

    } catch (err) {
      console.error('[ChallengeFirstEventLoad] fail', err)

      this.setData({
        loading: false,
        loadFailed: true,
        loadError: err.message || '题目加载失败',
      })

      wx.showModal({
        title: '加载失败',
        content: '下一题加载失败，请重试',
        cancelText: '返回',
        confirmText: '重试',
        success: (res) => {
          if (res.confirm) { this.setData({ loadFailed: false }); this.nextEvent() }
          else { wx.navigateBack() }
        },
      })
    } finally {
      this._loadingEvent = false
    }
  },
  onSelect(e) {
    if (!this.data.submitted) this.setData({ selectedKey:e.detail.key })
  },
  onChoiceTap(e) {
    if (this.data.submitted) return
    const key = e.currentTarget.dataset.key
    if (key) this.setData({ selectedKey: key })
  },
  async onSubmit() {
    if (this._submitting) return
    if (!this.data.selectedKey || this.data.submitted || this.data.loading) return
    this._submitting = true

    this.setData({ submitted: true, animOut: true })

    try {
      const r = await challengeService.submitChallengeChoice(
        this.data.recordId,
        this.data.event.eventId,
        this.data.selectedKey
      )

      if (!r || r.code !== 0) {
        throw new Error(r?.message || '提交失败')
      }

      console.log('[ChallengeChoiceAdvance]', {
        recordId: this.data.recordId,
        eventId: this.data.event.eventId,
        choiceKey: this.data.selectedKey,
        submitCode: r.code,
        choicesLength: r.data.choicesLength,
        currentEventIndex: r.data.currentEventIndex,
        isLast: r.data.isLast,
        completed: r.data.completed,
        scoringVersion: r.data.scoringVersion,
      })

      if (r.data.isLast || r.data.completed) {
        await new Promise(resolve => setTimeout(resolve, 400))
        this.goResult()
        return
      }

      await new Promise(resolve => setTimeout(resolve, 400))

      this.setData({ animOut: false })
      await this.nextEvent()

    } catch (err) {
      console.error('[ChallengeChoiceAdvance] fail', err)
      wx.showToast({ title: '小事哥刚刚断片了，请重新生成一次', icon: 'none' })
      this.setData({ submitted: false, animOut: false })
    } finally {
      this._submitting = false
    }
  },
  onRetry() {
    this.setData({ loadFailed: false })
    this.nextEvent()
  },
  onUnlock() {
    const recordId = this.data.recordId
    const productId = 'challenge_39_9'
    wx.navigateTo({
      url: '/pages/membership/membership?source=challenge&recordId='
        + encodeURIComponent(recordId)
        + '&productId=' + encodeURIComponent(productId),
    })
  },
  onGoHome() {
    wx.switchTab({
      url: '/pages/home/home',
      fail: (err) => {
        console.error('[ChallengeLocked] go home fail', err)
        wx.reLaunch({ url: '/pages/home/home' })
      },
    })
  },
  async onShow() {
    if (!this.data.challengeLocked || !this.data.recordId) return
    try {
      const r = await challengeService.getChallengeRecord(this.data.recordId)
      if (r.code === 0 && r.data) {
        const rec = r.data
        if (rec.trialMode === false || rec.unlocked === true) {
          console.log('[ChallengeUnlock] record unlocked, resuming', rec)
          this.setData({ challengeLocked: false, lockReason: '' })
          this.nextEvent()
        }
      }
    } catch (_) {}
  },
  goResult() {
    wx.redirectTo({ url:'/pages/challenge-result/challenge-result?recordId=' + this.data.recordId })
  },

  /* ═══════════════════════════════════
     Diagnostic 模式 — Data Contract Engine
     answers[key] 取代 answers[idx]
     currentQuestion 由 _syncQuestion() 维护
     ═══════════════════════════════════ */
  _initDiagnostic() {
    const p = getRandomPersonality(wx.getStorageSync('last_personality'))
    try { wx.setStorageSync('last_personality', p.name) } catch (_) {}
    const q0 = DIAGNOSTIC_QUESTIONS[0]
    this.setData({
      loading: false,
      currentQuestion: q0,
      'dQ.idx': 0,
      'dQ.total': DIAGNOSTIC_QUESTIONS.length,
      'dQ.percent': Math.round((1 / DIAGNOSTIC_QUESTIONS.length) * 100),
      'dQ.personality': p,
      'dQ.answers': {},
      'dQ.selectedPick': '',
      'dQ.label': q0.subtitle,
      'dQ.canNext': false,
    })
    this._typewriterHint(q0.subtitle)
  },

  /** 同步 currentQuestion，同时恢复 selectedPick/detailText/extraPick */
  _syncQuestion(idx) {
    const q = DIAGNOSTIC_QUESTIONS[idx]
    const answers = this.data.dQ.answers
    const patch = {
      currentQuestion: q,
      'dQ.idx': idx,
      'dQ.percent': Math.round(((idx + 1) / DIAGNOSTIC_QUESTIONS.length) * 100),
      'dQ.label': '',
      'dQ.selectedPick': '',
      'dQ.detailText': '',
      'dQ.extraPick': '',
    }
    const saved = answers[q.key]

    if (q.type === 'picker') {
      if (saved) {
        patch['dQ.selectedPick'] = saved
        patch['dQ.canNext'] = true
      } else {
        patch['dQ.canNext'] = false
      }
    } else if (q.type === 'picker+input') {
      patch['dQ.detailText'] = answers.occupationDetail || ''
      const detailOk = String(answers.occupationDetail || '').trim().length > 0
      patch['dQ.canNext'] = saved ? detailOk : false
      if (saved) patch['dQ.selectedPick'] = saved
    } else if (q.type === 'picker+multi') {
      const extra = answers[q.extraKey] || ''
      patch['dQ.extraPick'] = extra
      patch['dQ.canNext'] = !!(saved && extra)
      if (saved) patch['dQ.selectedPick'] = saved
    } else if (q.type === 'input') {
      patch['dQ.canNext'] = String(saved || '').trim().length > 0
    }
    this.setData(patch)
    this._typewriterHint(q.subtitle)
  },

  onDInput(e) {
    const raw = e.detail.value
    const q = this.data.currentQuestion
    const answers = { ...this.data.dQ.answers }

    if (q.type === 'picker+input') {
      answers.occupationDetail = raw
      const occ = answers[q.key]
      this.setData({
        'dQ.answers': answers,
        'dQ.detailText': raw,
        'dQ.canNext': occ ? raw.trim().length > 0 : false,
      })
    } else if (q.type === 'input') {
      answers[q.key] = raw
      const valid = String(raw || '').trim().length > 0
      this.setData({ 'dQ.answers': answers, 'dQ.canNext': valid })
    }
    // picker+multi: no text input, handled by picker change
  },

  onDPickerChange(e) {
    const idx = parseInt(e.detail.value)
    const q = this.data.currentQuestion
    const options = q.options || []
    const selected = options[idx] || ''

    const answers = { ...this.data.dQ.answers }
    answers[q.key] = selected

    if (q.type === 'picker+input') {
      const detail = (answers.occupationDetail || '').trim()
      this.setData({
        'dQ.answers': answers,
        'dQ.selectedPick': selected,
        'dQ.canNext': selected.length > 0 && detail.length > 0,
      })
    } else if (q.type === 'picker+multi') {
      const extra = (answers[q.extraKey] || '').trim()
      this.setData({
        'dQ.answers': answers,
        'dQ.selectedPick': selected,
        'dQ.canNext': selected.length > 0 && extra.length > 0,
      })
    } else {
      this.setData({
        'dQ.answers': answers,
        'dQ.selectedPick': selected,
        'dQ.canNext': selected.length > 0,
      })
    }
  },

  /** picker+multi 第二个 picker 变化 */
  onDExtraPickerChange(e) {
    const idx = parseInt(e.detail.value)
    const q = this.data.currentQuestion
    const options = q.extraOptions || []
    const selected = options[idx] || ''

    const answers = { ...this.data.dQ.answers }
    answers[q.extraKey] = selected

    const main = (answers[q.key] || '').trim()
    this.setData({
      'dQ.answers': answers,
      'dQ.extraPick': selected,
      'dQ.canNext': selected.length > 0 && main.length > 0,
    })
  },

  onDNext() {
    const { idx, answers } = this.data.dQ
    const q = this.data.currentQuestion

    if (q.type === 'picker+input') {
      const occ = answers[q.key] || ''
      const detail = (answers.occupationDetail || '').trim()
      if (!occ) { wx.showToast({ title:'请先选择收入结构', icon:'none' }); return }
      if (!detail) { wx.showToast({ title:'请输入具体职业', icon:'none' }); return }
    } else if (q.type === 'picker+multi') {
      const main = answers[q.key] || ''
      const extra = (answers[q.extraKey] || '').trim()
      if (!main) { wx.showToast({ title:'请先完成选择', icon:'none' }); return }
      if (!extra) { wx.showToast({ title:'请完成下方选项', icon:'none' }); return }
    } else {
      const val = answers[q.key]
      if (!val || !String(val).trim()) {
        wx.showToast({ title:'说真话，别跳过 🙏', icon:'none' })
        return
      }
    }
    // 清除临时选择状态
    this.setData({ 'dQ.selectedPick': '', 'dQ.detailText': '', 'dQ.extraPick': '' })

    if (idx === DIAGNOSTIC_QUESTIONS.length - 1) {
      this._submitDiagnostic()
      return
    }
    this._syncQuestion(idx + 1)
  },

  onDPrev() {
    if (this.data.dQ.idx <= 0) return
    this.setData({ 'dQ.selectedPick': '', 'dQ.detailText': '', 'dQ.extraPick': '' })
    this._syncQuestion(this.data.dQ.idx - 1)
  },

  _typewriterHint(text) {
    if (this._twTimer) clearInterval(this._twTimer)
    if (!text) return
    this.setData({ 'dQ.label': '' })
    const chars = [...text]; let i = 0
    this._twTimer = setInterval(() => {
      if (i >= chars.length) { clearInterval(this._twTimer); this._twTimer = null; return }
      this.setData({ 'dQ.label': chars.slice(0, i + 1).join('') })
      i++
    }, 50)
  },

  _submitDiagnostic() {
    if (this.data.dQ.submitting) return
    this.setData({ 'dQ.submitting': true })

    const a = this.data.dQ.answers
    // V4 10题 answers — 所有 key 直接可追溯
    const answers = {
      lifeStage:            a.lifeStage || '',
      incomeStructure:      a.incomeStructure || '',
      occupationDetail:     a.occupationDetail || '',
      monthlySurplus:       a.monthlySurplus || '',
      safetyMonths:         a.safetyMonths || '',
      debtPressure:         a.debtPressure || '',
      skillValidation:      a.skillValidation || '',
      monetizableSkill:     a.monetizableSkill || '',
      weeklyTime:           a.weeklyTime || '',
      executionStability:   a.executionStability || '',
      pastAttemptStage:     a.pastAttemptStage || '',
      decisionStyle:        a.decisionStyle || '',
      primaryGoal:          a.primaryGoal || '',
      maxTrialCost:         a.maxTrialCost || '',
      failureResponse:      a.failureResponse || '',
      // 旧版向后兼容（让旧 normalizeAnswers 不崩溃）
      age: a.lifeStage || '',
      occupation: a.occupationDetail || a.incomeStructure || '',
      income: a.incomeStructure || '',
      monthlyIncome: a.incomeStructure || '',
      savings: a.safetyMonths || '',
      debt: a.debtPressure || '',
      expense: a.monthlySurplus || '',
      monthlyExpense: a.monthlySurplus || '',
      freeTime: a.weeklyTime || '',
      freeTimeHours: a.weeklyTime || '',
      bestSkill: a.monetizableSkill || '',
      goal: a.primaryGoal || '',
      maxLoss: a.maxTrialCost || '',
      job: a.occupationDetail || '',
      education: 'N/A',
      anxiety: '',
      rootCause: '',
    }

    const p = this.data.dQ.personality

    // V4 前端合同日志
    console.log('[DiagnosticV4Answers]', {
      questionSteps: DIAGNOSTIC_QUESTIONS.length,
      answerKeys: Object.keys(answers).filter(k => answers[k]),
      lifeStage: answers.lifeStage,
      incomeStructure: answers.incomeStructure,
      occupationDetail: answers.occupationDetail,
      monthlySurplus: answers.monthlySurplus,
      safetyMonths: answers.safetyMonths,
      debtPressure: answers.debtPressure,
      skillValidation: answers.skillValidation,
      monetizableSkill: answers.monetizableSkill,
      weeklyTime: answers.weeklyTime,
      executionStability: answers.executionStability,
      pastAttemptStage: answers.pastAttemptStage,
      decisionStyle: answers.decisionStyle,
      primaryGoal: answers.primaryGoal,
      maxTrialCost: answers.maxTrialCost,
      failureResponse: answers.failureResponse,
    })

    app.globalData._diagnosticAnswers = answers
    app.globalData._diagnosticPersonality = p
    wx.redirectTo({ url:'/pages/report-detail/report-detail?mode=diagnostic' })
  },

  onUnload() {
    if (this._twTimer) { clearInterval(this._twTimer); this._twTimer = null }
  },
})
