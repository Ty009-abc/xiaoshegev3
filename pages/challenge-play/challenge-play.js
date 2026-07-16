/**
 * pages/challenge-play — v3.17 Data Contract Engine
 *   mode=challenge: 原有 30 天挑战 (DB 驱动)
 *   mode=diagnostic: v3 10 题问卷 (answers[key] 数据契约，禁止 idx 索引)。
 */
const challengeService = require('../../services/challengeService.js')
const aiReportService = require('../../services/aiReportService.js')
const { getRandomPersonality } = require('../../utils/personalityModes.js')
const app = getApp()

/** v3 10 题问卷 — 每道题自携 options，通过 key 唯一标识 */
const DIAGNOSTIC_QUESTIONS = [
  { id:'age',              key:'age',              title:'你今年几岁？',                subtitle:'年龄决定你的牌桌大小和时间窗口',                  type:'input',    inputType:'number', placeholder:'请输入数字', maxlength:3 },
  { id:'occupation',       key:'occupation',       title:'你现在的职业是？',            subtitle:'职业是你在牌桌上的筹码形式',                      type:'picker+input', options:['请选择职业类型','上班族','个体经营','企业主','自由职业','专业技能职业','学生','待业','其他'], detailPlaceholder:'请输入具体职业，例如：厨师、销售、程序员' },
  { id:'monthlyIncome',    key:'income',           title:'你的月收入是多少？',          subtitle:'收入 = 认知在这个世界的兑现速度',                 type:'picker',   options:['请选择','3000以下','3000–6000','6000–1万','1万–2万','2万–5万','5万以上'] },
  { id:'savings',          key:'savings',          title:'你目前的可支配存款？',        subtitle:'这决定了你的安全垫厚度',                          type:'picker',   options:['请选择','1万元以下','1–5万元','5–10万元','10–30万元','30–100万元','100万元以上'] },
  { id:'debt',             key:'debt',             title:'你目前的负债情况？',          subtitle:'负债决定了你翻身的紧迫度',                        type:'picker',   options:['请选择','无负债','轻度负债（<月收入3倍）','中度负债（月收入3-12倍）','重度负债（>月收入12倍）'] },
  { id:'monthlyExpense',   key:'expense',          title:'你每月固定支出大约多少？',     subtitle:'用于计算真实的月度现金流',                        type:'input',    inputType:'number', placeholder:'请输入数字（元）' },
  { id:'freeTimeHours',    key:'freeTime',         title:'你每天有多少小时可自由支配？',  subtitle:'决定你能分配多少时间给第二曲线',                  type:'picker',   options:['请选择','几乎为0','1小时以内','1–2小时','2–4小时','4小时以上'] },
  { id:'bestSkill',        key:'bestSkill',        title:'你最可能变现的能力是什么？',   subtitle:'这是你翻身的核心武器',                            type:'picker',   options:['请选择','专业技术（编程/设计/技术类）','销售/市场/带货','内容创作（写/拍/剪/播）','管理/运营','人脉资源','资金','暂无明确能力'] },
  { id:'goal',             key:'goal',             title:'你当前最核心的目标是？',      subtitle:'目标不同，策略完全不同',                          type:'picker',   options:['请选择','增加副业收入','尝试转行','创业/开店','清理负债','积累第一桶金','建立个人事业','提升认知'] },
  { id:'maxLoss',          key:'maxLoss',          title:'你能承受的最大失败成本？',     subtitle:'建立你的风险边界',                                type:'picker',   options:['请选择','不能接受任何损失','小额（几千元）','中等（几万元）','较大（几十万以上）'] },
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
    dQ:{idx:0,total:10,percent:10,label:'',answers:{},selectedPick:'',detailText:'',submitting:false,personality:null,canNext:false},
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
  async onSubmit() {
    if (!this.data.selectedKey || this.data.submitted || this.data.loading) return
    this.setData({ submitted:true, animOut:true })
    try {
      const r = await challengeService.submitChallengeChoice(this.data.recordId, this.data.event.eventId, this.data.selectedKey)
      if (r.code === 0) {
        console.log('[ChallengeV2Choice]', {
          day: this.data.event.day,
          eventId: this.data.event.eventId,
          choiceKey: this.data.selectedKey,
          scoringVersion: r.data.scoringVersion || 'n/a',
          rawScores: r.data.rawScores || 'n/a',
          scores: r.data.scores || 'n/a',
        })
        if (r.data.isLast) {
          setTimeout(() => {
            if (this.data.mode === 'diagnostic') {
              wx.redirectTo({ url:'/pages/report-preview/report-preview?recordId=' + this.data.recordId })
            } else { this.goResult() }
          }, 500)
          return
        }
        setTimeout(() => { this.setData({ animOut:false }); this.nextEvent() }, 500)
      } else throw new Error(r.message)
    } catch (e) {
      wx.showToast({ title:'小事哥刚刚断片了，请重新生成一次', icon:'none' })
      this.setData({ submitted:false, animOut:false })
    }
  },
  onRetry() {
    this.setData({ loadFailed: false })
    this.nextEvent()
  },
  onUnlock() {
    wx.navigateTo({ url:'/pages/membership/membership' })
  },
  onGoHome() {
    wx.switchTab({ url:'/pages/index/index' })
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

  /** 同步 currentQuestion，同时恢复 selectedPick/detailText */
  _syncQuestion(idx) {
    const q = DIAGNOSTIC_QUESTIONS[idx]
    const answers = this.data.dQ.answers
    const patch = {
      currentQuestion: q,
      'dQ.idx': idx,
      'dQ.percent': Math.round(((idx + 1) / DIAGNOSTIC_QUESTIONS.length) * 100),
      'dQ.label': '',
    }
    // 恢复 picker 选中值
    const saved = answers[q.key]
    if (q.type === 'picker' || q.type === 'picker+input') {
      if (saved) {
        const pickIdx = q.options.indexOf(saved)
        patch['dQ.selectedPick'] = saved
        patch['dQ.canNext'] = q.type === 'picker+input'
          ? saved.length > 0 && String(answers.occupationDetail || '').trim().length > 0
          : true
      } else {
        patch['dQ.selectedPick'] = ''
        patch['dQ.canNext'] = false
      }
    } else if (q.type === 'input') {
      patch['dQ.canNext'] = String(saved || '').trim().length > 0
      patch['dQ.selectedPick'] = ''
    }
    // 恢复 picker+input 的 detailText
    if (q.type === 'picker+input') {
      patch['dQ.detailText'] = answers.occupationDetail || ''
    } else {
      patch['dQ.detailText'] = ''
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
    } else {
      answers[q.key] = raw
      const valid = String(raw || '').trim().length > 0
      this.setData({ 'dQ.answers': answers, 'dQ.canNext': valid })
    }
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
    } else {
      this.setData({
        'dQ.answers': answers,
        'dQ.selectedPick': selected,
        'dQ.canNext': selected.length > 0,
      })
    }
  },

  onDNext() {
    const { idx, answers } = this.data.dQ
    const q = this.data.currentQuestion

    // picker+input: 验证 occupation + occupationDetail
    if (q.type === 'picker+input') {
      const occ = answers.occupation || ''
      const detail = (answers.occupationDetail || '').trim()
      if (!occ) { wx.showToast({ title:'请先选择职业类型', icon:'none' }); return }
      if (!detail) { wx.showToast({ title:'请输入具体职业', icon:'none' }); return }
      // 清除 selectedPick 避免下一题污染
      this.setData({ 'dQ.answers': answers, 'dQ.selectedPick': '', 'dQ.detailText': '' })
    } else {
      // 所有其他题：验证当前 key 有值
      const val = answers[q.key]
      if (!val || !String(val).trim()) {
        wx.showToast({ title:'说真话，别跳过 🙏', icon:'none' })
        return
      }
      this.setData({ 'dQ.answers': answers, 'dQ.selectedPick': '', 'dQ.detailText': '' })
    }

    // 最后一步 → 提交
    if (idx === DIAGNOSTIC_QUESTIONS.length - 1) {
      this._submitDiagnostic()
      return
    }
    this._syncQuestion(idx + 1)
  },

  onDPrev() {
    if (this.data.dQ.idx <= 0) return
    this.setData({ 'dQ.selectedPick': '', 'dQ.detailText': '' })
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
    // 10题 answers 只使用 key 字段。补全向后兼容映射
    const answers = {
      age: a.age || '',
      occupation: a.occupation || '',
      occupationDetail: a.occupationDetail || '',
      // normalizeAnswers 接受 monthlyIncome || income
      income: a.income || '',
      monthlyIncome: a.income || '',
      savings: a.savings || '',
      debt: a.debt || '',
      // normalizeAnswers 接受 monthlyExpense
      expense: a.expense || '',
      monthlyExpense: a.expense || '',
      // normalizeAnswers 接受 freeTimeHours
      freeTime: a.freeTime || '',
      freeTimeHours: a.freeTime || '',
      bestSkill: a.bestSkill || '',
      goal: a.goal || '',
      maxLoss: a.maxLoss || '',
      // 旧版兼容
      job: a.occupationDetail || a.occupation || '',
      education: 'N/A',
      anxiety: '',
      rootCause: '',
    }

    const p = this.data.dQ.personality

    app.globalData._diagnosticAnswers = answers
    app.globalData._diagnosticPersonality = p
    wx.redirectTo({ url:'/pages/report-detail/report-detail?mode=diagnostic' })
  },

  onUnload() {
    if (this._twTimer) { clearInterval(this._twTimer); this._twTimer = null }
  },
})
