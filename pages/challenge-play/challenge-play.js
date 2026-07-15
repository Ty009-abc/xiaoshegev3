/**
 * pages/challenge-play — v3.13 双模式
 *   mode=challenge: 原有 30 天挑战 (DB 驱动)
 *   mode=diagnostic: v2 6 题问卷 → 直接 AI 诊断 (无 DB、无付费锁)
 */
const challengeService = require('../../services/challengeService.js')
const aiReportService = require('../../services/aiReportService.js')
const { getRandomPersonality } = require('../../utils/personalityModes.js')
const app = getApp()

/** v3 10 题问卷 — 决策引擎驱动（Q2 职业类型+职业详情合并为一步） */
const DIAGNOSTIC_QUESTIONS = [
  { id:'age',              title:'你今年几岁？',                subtitle:'年龄决定你的牌桌大小和时间窗口',                  type:'input',    inputType:'number', placeholder:'请输入数字', maxlength:3 },
  { id:'occupation',       title:'你现在的职业是？',            subtitle:'职业是你在牌桌上的筹码形式',                      type:'picker+input', options:['','上班族','个体经营','企业主','自由职业','专业技能职业','学生','待业','其他'], detailPlaceholder:'请输入具体职业，例如：厨师、销售、程序员' },
  { id:'monthlyIncome',    title:'你的月收入是多少？',          subtitle:'收入 = 认知在这个世界的兑现速度',                 type:'picker',   options:['','3000以下','3000–6000','6000–1万','1万–2万','2万–5万','5万以上'] },
  { id:'savings',          title:'你目前的可支配存款？',        subtitle:'这决定了你的安全垫厚度',                          type:'picker',   options:['','1万元以下','1–5万元','5–10万元','10–30万元','30–100万元','100万元以上'] },
  { id:'debt',             title:'你目前的负债情况？',          subtitle:'负债决定了你翻身的紧迫度',                        type:'picker',   options:['','无负债','轻度负债（<月收入3倍）','中度负债（月收入3-12倍）','重度负债（>月收入12倍）'] },
  { id:'monthlyExpense',   title:'你每月固定支出大约多少？',     subtitle:'用于计算真实的月度现金流',                        type:'input',    inputType:'number', placeholder:'请输入数字（元）' },
  { id:'freeTimeHours',    title:'你每天有多少小时可自由支配？',  subtitle:'决定你能分配多少时间给第二曲线',                  type:'picker',   options:['','几乎为0','1小时以内','1–2小时','2–4小时','4小时以上'] },
  { id:'bestSkill',        title:'你最可能变现的能力是什么？',   subtitle:'这是你翻身的核心武器',                            type:'picker',   options:['','专业技术（编程/设计/技术类）','销售/市场/带货','内容创作（写/拍/剪/播）','管理/运营','人脉资源','资金','暂无明确能力'] },
  { id:'goal',             title:'你当前最核心的目标是？',      subtitle:'目标不同，策略完全不同',                          type:'picker',   options:['','增加副业收入','尝试转行','创业/开店','清理负债','积累第一桶金','建立个人事业','提升认知'] },
  { id:'maxLoss',          title:'你能承受的最大失败成本？',     subtitle:'建立你的风险边界',                                type:'picker',   options:['','不能接受任何损失','小额（几千元）','中等（几万元）','较大（几十万以上）'] },
]

Page({
  data: {
    recordId:'', mode:'',
    // challenge 模式
    event:null, selectedKey:'', submitted:false,
    nextEvent:null, progress:{current:0,total:30,day:1},
    loading:true, end:false, animOut:false, animIn:false,
    // diagnostic 模式
    dQ:{idx:0,total:11,percent:9,label:'',answers:[],submitting:false,personality:null,canNext:false},
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
      'dQ.idx': 0,
      'dQ.total': DIAGNOSTIC_QUESTIONS.length,
      'dQ.percent': Math.round((1 / DIAGNOSTIC_QUESTIONS.length) * 100),
      'dQ.personality': p,
      'dQ.answers': new Array(DIAGNOSTIC_QUESTIONS.length).fill(''),
      'dQ.label': DIAGNOSTIC_QUESTIONS[0].subtitle,
    })
    this._typewriterHint(DIAGNOSTIC_QUESTIONS[0].subtitle)
  },

  onDInput(e) {
    const a = [...this.data.dQ.answers]
    const raw = e.detail.value
    const q = DIAGNOSTIC_QUESTIONS[this.data.dQ.idx]
    if (q.type === 'picker+input') {
      // Q2: occupationDetail 存入 _occDetail 临时字段
      a._occDetail = raw
    } else {
      a[this.data.dQ.idx] = raw
    }
    const valid = typeof raw === 'string' ? raw.trim().length > 0 : String(raw || '').trim().length > 0
    this.setData({ 'dQ.answers': a, 'dQ.canNext': valid })
  },

  onDPickerChange(e) {
    const a = [...this.data.dQ.answers]
    const idx = e.detail.value
    const q = DIAGNOSTIC_QUESTIONS[this.data.dQ.idx]
    const selected = (q.options || [])[idx] || ''
    a[this.data.dQ.idx] = selected
    // picker+input 类型：occupation 选中后还需填写详情
    const valid = q.type === 'picker+input'
      ? selected.length > 0 && String(a._occDetail || '').trim().length > 0
      : selected.length > 0
    this.setData({ 'dQ.answers': a, 'dQ.canNext': valid })
  },

  onDNext() {
    const { idx, answers } = this.data.dQ
    const q = DIAGNOSTIC_QUESTIONS[idx]
    // picker+input: 合并 occupation + occupationDetail
    if (q.type === 'picker+input') {
      const occ = answers[idx] || ''
      const detail = (answers._occDetail || '').trim()
      if (!occ) { wx.showToast({ title:'请先选择职业类型', icon:'none' }); return }
      if (!detail) { wx.showToast({ title:'请输入具体职业', icon:'none' }); return }
      // 规范答案: 职业类型 + 具体职业一起存
      // occupation 保持 picker value；occupationDetail 存入指定字段
      if (!answers.occupationDetail) answers.occupationDetail = detail
      answers[idx] = occ  // occupation 字段
      this.setData({ 'dQ.answers': answers, 'dQ.canNext': true })
    } else {
      if (!answers[idx] || !String(answers[idx]).trim()) {
        wx.showToast({ title:'说真话，别跳过 🙏', icon:'none' })
        return
      }
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
    // 构建 10 题答案映射（兼容旧字段名）
    const answers = {}
    questions.forEach((q, i) => { answers[q.id] = a[i] || '' })
    // occupationDetail: 来自合并步骤中的 _occDetail
    answers.occupationDetail = a._occDetail || answers.occupationDetail || answers.occupation || ''
    // 向后兼容：旧的 key 映射
    if (!answers.job) answers.job = answers.occupationDetail || answers.occupation || ''
    if (!answers.income) answers.income = answers.monthlyIncome || ''
    if (!answers.education) answers.education = 'N/A'
    if (!answers.anxiety) answers.anxiety = ''
    if (!answers.rootCause) answers.rootCause = ''

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
