/**
 * services/aiReportService.js
 */

function call(name, data) {
  return wx.cloud.callFunction({ name, data }).then(r => r.result)
}

function generateAiReport(type, recordId) {
  return call('generateAiReport', { type, recordId })
}

function getAiReport(reportId) {
  return call('getAiReport', { reportId })
}

/** 诊断模式：传入 6 题答案 + 人格，返回 5 字段报告 */
function generateDiagnosticReport({ answers, personality, personalityEmoji, personalityStyle }) {
  return call('generateAiReport', {
    type: 'diagnostic',
    answers,
    personality,
    personalityEmoji,
    personalityStyle,
  })
}

module.exports = { generateAiReport, getAiReport, generateDiagnosticReport }
