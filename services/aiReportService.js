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

/** 诊断模式：传入答案 + 人格，返回诊断报告（V4/V3 兼容） */
function generateDiagnosticReport({ answers, personality, personalityEmoji, personalityStyle }) {
  const diagnosticVersion = answers.diagnosticVersion || 'v3'
  return call('generateAiReport', {
    type: 'diagnostic',
    diagnosticVersion,
    answers,
    personality,
    personalityEmoji,
    personalityStyle,
  })
}

module.exports = { generateAiReport, getAiReport, generateDiagnosticReport }
