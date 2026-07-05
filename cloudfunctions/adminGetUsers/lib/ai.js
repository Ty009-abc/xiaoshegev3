/**
 * common/ai.js - AI 调用封装
 *
 * 调用 DeepSeek / OpenClaw API 生成报告
 * 配置通过环境变量注入，禁止硬编码
 *
 * ⚠️ 部署前必须设置环境变量：
 *   - AI_API_KEY        DeepSeek API Key
 *   - AI_API_BASE_URL   API 地址 (如 https://api.deepseek.com/v1)
 *   - AI_MODEL_FLASH    轻量模型 (如 v4-flash)
 */

let httpModule
try { httpModule = require('axios') } catch (_) { /* 云函数环境自带 */ }

const now = () => Date.now()

/**
 * 调用 AI 接口
 * @param {object} options
 * @param {string} options.systemPrompt
 * @param {string} options.userMessage
 * @param {number} options.maxTokens
 * @param {number} options.temperature
 * @returns {{ success: boolean, content: string, tokens: number, error: string }}
 */
async function callAI(options) {
  const {
    systemPrompt,
    userMessage,
    maxTokens = 2048,
    temperature = 0.7,
  } = options

  // 环境变量取值
  const apiKey = process.env.AI_API_KEY || ''
  const apiBaseUrl = process.env.AI_API_BASE_URL || 'https://api.deepseek.com/v1'
  const model = process.env.AI_MODEL_FLASH || process.env.AI_MODEL || 'v4-flash'

  if (!apiKey) {
    return { success: false, error: 'AI_API_KEY 未配置' }
  }

  try {
    // 使用 axios 或 fetch
    let response
    if (httpModule) {
      response = await httpModule({
        method: 'POST',
        url: apiBaseUrl + '/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        data: {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: maxTokens,
          temperature,
        },
        timeout: 30000,
      })
    } else {
      // fallback fetch
      const fetch = require('node-fetch')
      const res = await fetch(apiBaseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
      })
      response = { data: await res.json() }
    }

    const choice = (response.data.choices || [])[0]
    if (!choice) {
      return { success: false, error: 'AI 返回空内容: ' + JSON.stringify(response.data) }
    }

    return {
      success: true,
      content: choice.message?.content || '',
      tokens: response.data.usage?.total_tokens || 0,
    }
  } catch (err) {
    console.error('[AI] 调用失败:', err.message)
    return { success: false, error: err.message }
  }
}

/**
 * 构造认知报告 prompt
 */
function buildReportPrompt(scores, tags, choicesSummary) {
  const systemPrompt = `你是"珠澳小事哥"，一个犀利、现实、懂概率、懂人性、懂普通人翻身逻辑的 AI 认知教练。

你的任务是根据用户数据生成《世界模型诊断报告》。

语气要求：
- 犀利、直接、有现实感，但不要羞辱用户
- 不要承诺一定发财
- 不要输出违法、赌博、灰产操作建议
- 使用中文，口语化但不随意
- 每条建议要 actionable（可执行）

输出 JSON 格式（不要 markdown 包裹）：
{
  "oneSentence": "一句话诊断（20字以内）",
  "worldModelType": "世界模型类型",
  "whyNotRich": "为什么还没有翻身（80字以内）",
  "biggestCognitiveGap": "最大认知漏洞（50字以内）",
  "turnaroundProbability": "翻身概率百分比（整数，如 35）",
  "threeYearRisk": "未来3年最大风险（60字以内）",
  "bestPath": "最适合路径（80字以内）",
  "thirtyDayActions": ["行动1","行动2","行动3","行动4","行动5"],
  "finalStrike": "最后一击认知暴击（30字以内）"
}`

  const userMessage = `用户认知评分：
劳动思维：${scores.laborMindset || 50}
概率思维：${scores.probabilityMindset || 50}
系统思维：${scores.systemThinking || 50}
杠杆思维：${scores.leverageThinking || 50}
资本思维：${scores.capitalThinking || 50}
风险认知：${scores.riskAwareness || 50}
信息敏感度：${scores.informationSensitivity || 50}
长期主义：${scores.longTermism || 50}
决策稳定性：${scores.decisionStability || 50}

用户标签：${(tags || []).join('、') || '无'}

用户选择摘要：
${choicesSummary || '无'}

请生成报告。`

  return { systemPrompt, userMessage }
}

module.exports = { callAI, buildReportPrompt }
