/**
 * pages/turnaround-6q-questionnaire/turnaround-6q-questionnaire.js
 *
 * RC8.8_STAGE2_R2_LEGACY_UI_BASELINE_RECOVERY — restored 2026-07-11 legacy 6Q
 * questionnaire UI (the proven online 2.0.0 experience).
 *
 * UI is a faithful restoration of the 07/11 diagnostic flow
 * (persona bar · progress · numbered card · typewriter subtitle · visible
 * light-theme input/textarea · disabled-until-valid 下一题 · 上一题).
 *
 * ONLY the report wiring is bridged to the CURRENT Stage2 request contract
 * (`turnaround_strategy_6q_v1` → generateAiReport) via
 * services/legacy6qReportService.js. No Hybrid 10Q payload, no diagnosis enum,
 * no world-model payload.
 *
 * @version legacy_ui_0711 + turnaround_strategy_6q_v1 bridge
 */

'use strict'

const { getRandomPersonality } = require('../../utils/personalityModes.js')
const legacy6q = require('../../services/legacy6qReportService.js')

const app = getApp()
// RC8.8_STAGE2_R5 — Q6 submit now routes through the dedicated LIGHT thinking
// page, which makes the ONE model call and hands a READY report to the result page.
const THINKING_ROUTE = '/pages/legacy6q-thinking/legacy6q-thinking'
const DIAGNOSTIC_VERSION = 'turnaround_strategy_6q_v1'

/** Restored 07/11 6-question fixed data source (wording verbatim). */
const DIAGNOSTIC_QUESTIONS = [
  { id: 'age',       title: '你今年几岁？',            subtitle: '年龄决定你的牌桌大小',              type: 'input',    inputType: 'number', placeholder: '请输入数字', maxlength: 3 },
  { id: 'job',       title: '你现在做什么工作？',       subtitle: '职业是你当前的筹码形式',              type: 'input',    inputType: 'text',   placeholder: '例如：厨师 / 销售 / 程序员' },
  { id: 'education', title: '你的学历？',              subtitle: '学历在这张牌桌上并不决定一切',        type: 'input',    inputType: 'text',   placeholder: '例如：高中 / 大专 / 本科' },
  { id: 'income',    title: '你现在月收入多少？',       subtitle: '收入 = 认知在这个世界的兑现速度',    type: 'input',    inputType: 'number', placeholder: '请输入数字' },
  { id: 'anxiety',   title: '你现在最焦虑什么？',       subtitle: '焦虑是你看懂规则的第一步',            type: 'textarea', placeholder: '认真说一次真话…',                     maxlength: 300 },
  { id: 'rootCause', title: '你觉得自己为什么翻不了身？', subtitle: '⚠️ 这里决定 AI 分析深度，请认真作答', type: 'textarea', placeholder: '坦诚面对自己，这是最关键的一问…', maxlength: 500 },
]

Page({
  data: {
    dQ: { idx: 0, total: 6, percent: 16, label: '', answers: [], submitting: false, personality: null, canNext: false },
  },

  onLoad () {
    this._initDiagnostic()
  },

  _initDiagnostic () {
    let last = ''
    try { last = wx.getStorageSync('last_personality') || '' } catch (_) { last = '' }
    const p = getRandomPersonality(last)
    try { wx.setStorageSync('last_personality', p.name) } catch (_) {}
    this.setData({
      'dQ.personality': p,
      'dQ.answers': new Array(DIAGNOSTIC_QUESTIONS.length).fill(''),
      'dQ.total': DIAGNOSTIC_QUESTIONS.length,
      'dQ.label': DIAGNOSTIC_QUESTIONS[0].subtitle,
    })
    this._typewriterHint(DIAGNOSTIC_QUESTIONS[0].subtitle)
  },

  onDInput (e) {
    const a = [...this.data.dQ.answers]
    const raw = e.detail.value
    a[this.data.dQ.idx] = raw
    const valid = typeof raw === 'string' ? raw.trim().length > 0 : String(raw || '').trim().length > 0
    this.setData({ 'dQ.answers': a, 'dQ.canNext': valid })
  },

  onDNext () {
    const { idx, answers } = this.data.dQ
    if (!answers[idx] || !String(answers[idx]).trim()) {
      wx.showToast({ title: '说真话，别跳过 🙏', icon: 'none' })
      return
    }
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

  onDPrev () {
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

  _typewriterHint (text) {
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

  _submitDiagnostic () {
    // §11 — double-tap Q6 submit is blocked by the submission lock.
    if (this.data.dQ.submitting) return
    this.setData({ 'dQ.submitting': true })

    const a = this.data.dQ.answers
    const questions = DIAGNOSTIC_QUESTIONS
    const answers = {}
    questions.forEach((q, i) => { answers[q.id] = a[i] })
    // §7 — explicit raw 6-field contract (no enum, no world-model payload).
    answers.diagnosticVersion = DIAGNOSTIC_VERSION
    const p = this.data.dQ.personality

    // §3/§11 — validate six answers, save raw answers to TEMP request state, then
    // hand off to the thinking page with ONE stable requestId (ONE model call).
    const requestId = 'r6q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    app.globalData._legacy6qThinkingRequest = {
      requestId,
      answers,
      personality: p,
      diagnosticVersion: DIAGNOSTIC_VERSION,
      createdAt: Date.now(),
    }
    wx.redirectTo({ url: THINKING_ROUTE + '?requestId=' + encodeURIComponent(requestId) })
  },

  onUnload () {
    if (this._twTimer) { clearInterval(this._twTimer); this._twTimer = null }
  },
})
