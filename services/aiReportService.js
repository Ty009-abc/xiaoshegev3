/**
 * services/aiReportService.js
 */

function call(name, data) {
  console.log('🚨 [FRONT-END TRIGGER] 开始调用云函数:', name)
  console.log('🚨 [CURRENT ENV] wx.cloud 状态:', wx.cloud ? 'available' : 'NOT initialized')
  console.log('🚨 [CALL DATA]', JSON.stringify(data).substring(0, 500))
  return wx.cloud.callFunction({ name, data }).then(r => {
    console.log('🚨 [SERVER RESPONSE SUCCESS] result:', JSON.stringify(r.result).substring(0, 2000))
    return r.result
  }).catch(err => {
    console.error('🚨 [SERVER RESPONSE ERROR STACK]:', err)
    console.error('🚨 [SERVER RESPONSE ERROR MSG]:', err.message)
    console.error('🚨 [SERVER RESPONSE ERROR FULL]:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
    throw err
  })
}

function generateAiReport(type, recordId) {
  return call('generateAiReport', { type, recordId })
}

function getAiReport(reportId) {
  return call('getAiReport', { reportId })
}

/** 诊断模式：传入答案 + 人格，返回诊断报告（V4/V3 兼容） */
function generateDiagnosticReport({ answers, personality, personalityEmoji, personalityStyle, skipCache, requestNonce, diagnosis }) {
  const diagnosticVersion = answers.diagnosticVersion || 'v3'
  return call('generateAiReport', {
    type: 'diagnostic',
    diagnosticVersion,
    answers,
    personality,
    personalityEmoji,
    personalityStyle,
    skipCache: skipCache === true,
    requestNonce: requestNonce || '',
    diagnosis: diagnosis || null,
  })
}

/**
 * RC8.3 Stage 16B — world_model_v2 SHADOW-only submission.
 * 发送稳定协议 { diagnosticVersion: 'world_model_v2', answers: [{questionId, optionId}] }。
 * 客户端不期望得到正式诊断报告；服务端仅执行 shadow 并返回测试态应答。
 * @param {Array<{questionId:string, optionId:string}>} answersArray
 */
function generateV2ShadowReport(answersArray) {
  return call('generateAiReport', {
    type: 'diagnostic',
    diagnosticVersion: 'world_model_v2',
    answers: answersArray,
  })
}

module.exports = { generateAiReport, getAiReport, generateDiagnosticReport, generateV2ShadowReport }
