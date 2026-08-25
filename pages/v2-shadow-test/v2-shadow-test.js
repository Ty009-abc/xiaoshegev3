/**
 * pages/v2-shadow-test/v2-shadow-test.js
 *
 * RC8.3 Stage 16B — world_model_v2 内部测试入口（仅 U1-U5 可访问）。
 *
 * 这不是正式诊断入口：提交后服务端仅执行 shadow 记录（V2_PRIMARY_ACTIVE=NO），
 * 客户端只显示测试态确认，不展示正式诊断报告。
 */
const app = getApp()
const { V2_QUESTIONS, V2_INTERNAL_ALLOWLIST, validateV2AnswersClient } = require('../../utils/v2Questionnaire')
const { generateV2ShadowReport } = require('../../services/aiReportService')

Page({
  data: {
    allowed: false,
    loading: true,
    questions: [],
    answers: {},          // { questionId: optionId }
    answeredCount: 0,
    total: 0,
    submitting: false,
    submitted: false,
    resultMsg: '',
  },

  onLoad() {
    const openid = app.globalData.openid || ''
    const allowed = V2_INTERNAL_ALLOWLIST.indexOf(openid) >= 0
    this.setData({
      allowed,
      loading: false,
      questions: V2_QUESTIONS.map(function (q) {
        return { id: q.id, text: q.text, options: q.options }
      }),
      total: V2_QUESTIONS.length,
    })
  },

  onSelectOption(e) {
    const { qid, oid } = e.currentTarget.dataset
    const answers = Object.assign({}, this.data.answers)
    answers[qid] = oid
    this.setData({ answers: answers, answeredCount: Object.keys(answers).length })
  },

  onSubmit() {
    if (this.data.submitting) return
    const verdict = validateV2AnswersClient(this.data.answers)
    if (!verdict.valid) {
      wx.showToast({ title: '请完成全部 18 题', icon: 'none' })
      return
    }

    // 稳定协议：answers = [{ questionId, optionId }]，绝不携带中文 option text
    const answersArray = V2_QUESTIONS.map(function (q) {
      return { questionId: q.id, optionId: this.data.answers[q.id] }
    }.bind(this))

    this.setData({ submitting: true })
    generateV2ShadowReport(answersArray)
      .then(function (res) {
        this.setData({
          submitted: true,
          resultMsg: 'V2 内部测试已提交（shadow 记录中，非正式诊断）',
        })
        console.log('[V2ShadowTest] server response:', JSON.stringify(res))
      }.bind(this))
      .catch(function (err) {
        this.setData({ resultMsg: '提交失败：' + ((err && err.message) || '未知错误') })
      }.bind(this))
      .then(function () { this.setData({ submitting: false }) }.bind(this))
  },
})
