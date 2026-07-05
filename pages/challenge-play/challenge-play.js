/**
 * pages/challenge-play — v3.13 双模式
 *   mode=challenge: 原有 30 天挑战 (DB 驱动)
 *   mode=diagnostic: v2 6 题问卷 → 直接 AI 诊断 (无 DB、无付费锁)
 */
const challengeService = require('../../services/challengeService.js')
const aiReportService = require('../../services/aiReportService.js')
const { getRandomPersonality } = require('../../utils/personalityModes.js')
const app = getApp()

/** v2 6 题问卷 — 固定数据源 */
const DIAGNOSTIC_QUESTIONS = [
  { id:'age',      title:'你今年几岁？',          subtitle:'年龄决定你的牌桌大小',              type:'input',    inputType:'number', placeholder:'请输入数字', maxlength:3 },
  { id:'job',      title:'你现在做什么工作？',     subtitle:'职业是你当前的筹码形式',              type:'input',    inputType:'text',   placeholder:'例如：厨师 / 销售 / 程序员' },
  { id:'education',title:'你的学历？',             subtitle:'学历在这张牌桌上并不决定一切',        type:'input',    inputType:'text',   placeholder:'例如：高中 / 大专 / 本科' },
  { id:'income',   title:'你现在月收入多少？',     subtitle:'收入 = 认知在这个世界的兑现速度',    type:'input',    inputType:'number', placeholder:'请输入数字' },
  { id:'anxiety',  title:'你现在最焦虑什么？',     subtitle:'焦虑是你看懂规则的第一步',             type:'textarea', placeholder:'认真说一次真话…',                     maxlength:300 },
  { id:'rootCause',title:'你觉得自己为什么翻不了身？',subtitle:'⚠️ 这里决定 AI 分析深度，请认真作答',type:'textarea', placeholder:'坦诚面对自己，这是最关键的一问…', maxlength:500 },
]

Page({
  data: {
    recordId:'', mode:'',
    // challenge 模式
    event:null, selectedKey:'', submitted:false,
    nextEvent:null, progress:{current:0,total:30,day:1},
    loading:true, end:false, animOut:false, animIn:false,
    // diagnostic 模式
    dQ:{idx:0,total:6,percent:16,label:'',answers:[],submitting:false,personality:null,canNext:false},
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
    this.setData({ loading:true, selectedKey:'', submitted:false })
    try {
      const r = await challengeService.getChallengeEvent(this.data.recordId)
      if (r.code === 0) {
        const ev = r.data
        if (ev.finished) {
          if (this.data.mode === 'diagnostic') {
            wx.redirectTo({ url:'/pages/report-preview/report-preview?recordId=' + this.data.recordId })
          } else { this.goResult() }
          return
        }
        const choices = (ev.choices || []).map(c => ({ key:c.key, text:c.text }))
        this.setData({ event:{ ...ev, choices }, progress: ev.progress || {current:0,total:30,day:1}, animIn:true })
        setTimeout(() => this.setData({ animIn:false }), 300)
      } else if (r.code === 1008) {
        this.setData({ end:true })
      } else throw new Error(r.message || '加载失败')
    } catch (e) {
      wx.showToast({ title:'系统暂时看不清这个世界，请稍后再试', icon:'none' })
    }
    this.setData({ loading:false })
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
  goResult() {
    wx.redirectTo({ url:'/pages/challenge-result/challenge-result?recordId=' + this.data.recordId })
  },

  /* ═══════════════════════════════════
     Diagnostic 模式 (v2 6题问卷)
     ═══════════════════════════════════ */
  _initDiagnostic() {
    const p = getRandomPersonality(wx.getStorageSync('last_personality'))
    try { wx.setStorageSync('last_personality', p.name) } catch (_) {}
    this.setData({
      loading: false,
      'dQ.personality': p,
      'dQ.answers': new Array(DIAGNOSTIC_QUESTIONS.length).fill(''),
      'dQ.label': DIAGNOSTIC_QUESTIONS[0].subtitle,
    })
    this._typewriterHint(DIAGNOSTIC_QUESTIONS[0].subtitle)
  },

  onDInput(e) {
    const a = [...this.data.dQ.answers]
    const raw = e.detail.value
    a[this.data.dQ.idx] = raw
    // 实时计算按钮激活状态（模板 .trim 在小程序中不可靠）
    const valid = typeof raw === 'string' ? raw.trim().length > 0 : String(raw || '').trim().length > 0
    this.setData({ 'dQ.answers': a, 'dQ.canNext': valid })
  },

  onDNext() {
    const { idx, answers } = this.data.dQ
    if (!answers[idx] || !String(answers[idx]).trim()) {
      wx.showToast({ title:'说真话，别跳过 🙏', icon:'none' })
      return
    }
    // 最后一题 → 提交 AI 诊断
    if (idx === DIAGNOSTIC_QUESTIONS.length - 1) {
      this._submitDiagnostic()
      return
    }
    const next = idx + 1
    const nextVal = answers[next] || ''
    this.setData({
      'dQ.idx': next,
      'dQ.percent': Math.round(((next + 1) / DIAGNOSTIC_QUESTIONS.length) * 100),
      'dQ.label': '',
      'dQ.canNext': String(nextVal).trim().length > 0,
    })
    this._typewriterHint(DIAGNOSTIC_QUESTIONS[next].subtitle)
  },

  onDPrev() {
    if (this.data.dQ.idx <= 0) return
    const prev = this.data.dQ.idx - 1
    const prevVal = this.data.dQ.answers[prev] || ''
    this.setData({
      'dQ.idx': prev,
      'dQ.percent': Math.round(((prev + 1) / DIAGNOSTIC_QUESTIONS.length) * 100),
      'dQ.label': '',
      'dQ.canNext': String(prevVal).trim().length > 0,
    })
    this._typewriterHint(DIAGNOSTIC_QUESTIONS[prev].subtitle)
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
    const questions = DIAGNOSTIC_QUESTIONS
    const answers = {
      [questions[0].id]: a[0], [questions[1].id]: a[1],
      [questions[2].id]: a[2], [questions[3].id]: a[3],
      [questions[4].id]: a[4], [questions[5].id]: a[5],
    }
    const p = this.data.dQ.personality

    // v3.17 Progressive Reveal: 先跳 report-detail（立即显示骨架），页内自调 AI
    app.globalData._diagnosticAnswers = answers
    app.globalData._diagnosticPersonality = p
    wx.redirectTo({ url:'/pages/report-detail/report-detail?mode=diagnostic' })
  },

  onUnload() {
    if (this._twTimer) { clearInterval(this._twTimer); this._twTimer = null }
  },
})
