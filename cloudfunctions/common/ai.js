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
 *   - AI_MODEL_PRO      深度推理模型 (如 v4-pro)
 *
 * v3.1 新增:
 *   - Retry Policy (max 2 retries, exponential backoff, only timeout/429/5xx)
 *   - Timeout Guard (12s hard, 3s soft with "AI正在深度推演" signal)
 */

let httpModule
try { httpModule = require('axios') } catch (_) { /* 云函数环境自带 */ }

const now = () => Date.now()

// ═══════════════════════════════════════
// Retry Policy
// ═══════════════════════════════════════

const RETRY_CONFIG = {
  maxRetries: 2,
  baseDelayMs: 1000,       // 1s → 2s → 4s exponential
  retryableStatuses: new Set([408, 429, 500, 502, 503, 504]),
}

/**
 * 判断错误是否可重试
 */
function isRetryable(err) {
  // 超时
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
    return true
  }
  // HTTP 429 / 5xx
  const status = err.response?.status || err.status
  if (status && RETRY_CONFIG.retryableStatuses.has(status)) return true
  // 网络错误 (无 status)
  if (!status && (err.code === 'ENOTFOUND' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED')) return true

  return false
}

/**
 * 指数退避 sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ═══════════════════════════════════════
// Timeout Guard
// ═══════════════════════════════════════

const TIMEOUT = {
  HARD: 12000,    // LLM 硬超时 12s
  SOFT: 3000,     // 前端软超时 3s → 返回 { loading: true }
}

// ═══════════════════════════════════════
// callAI — 核心调用（含 retry + timeout）
// ═══════════════════════════════════════

/**
 * 调用 AI 接口（含 retry + timeout guard）
 * @param {object} options
 * @param {string} options.systemPrompt
 * @param {string} options.userMessage
 * @param {number} options.maxTokens
 * @param {number} options.temperature
 * @param {string} options.forceModel  - 强制指定模型（可选）
 * @returns {{ success: boolean, content: string, tokens: number, error: string, loading?: boolean, retriesUsed?: number }}
 */
async function callAI(options) {
  const {
    systemPrompt,
    userMessage,
    maxTokens = 2048,
    temperature = 0.7,
    forceModel,
  } = options

  const apiKey = process.env.AI_API_KEY || ''
  const apiBaseUrl = process.env.AI_API_BASE_URL || 'https://api.deepseek.com/v1'
  // forceModel 已由上层（aiEngine.resolveModel）映射为真实模型名
  // 直接调用的场景：报告类用 PRO，通用场景用 FLASH
  // 保留旧 AI_MODEL 兼容
  const model = forceModel
    || process.env.AI_MODEL_FLASH
    || process.env.AI_MODEL       // 旧 env 兼容
    || 'v4-flash'

  if (!apiKey) {
    return { success: false, error: 'AI_API_KEY 未配置', retriesUsed: 0 }
  }

  const callStart = now()

  // ─── 软超时检测（异步） ───
  let softTimeoutTriggered = false
  const softTimer = setTimeout(() => { softTimeoutTriggered = true }, TIMEOUT.SOFT)

  let lastError = null

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // 硬超时: 每次尝试给完整 12s
      const result = await makeAIRequest({
        apiBaseUrl, apiKey, model, systemPrompt, userMessage, maxTokens, temperature,
        timeoutMs: TIMEOUT.HARD,
      })

      clearTimeout(softTimer)
      result.retriesUsed = attempt
      if (softTimeoutTriggered) result.softTimeout = true
      return result
    } catch (err) {
      lastError = err

      // 不可重试的错误 → 直接失败
      if (!isRetryable(err)) {
        clearTimeout(softTimer)
        return {
          success: false,
          error: err.message || 'AI 调用失败',
          retriesUsed: attempt,
          loading: softTimeoutTriggered ? true : undefined,
        }
      }

      // 还有重试机会
      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt)
        console.warn(`[AI] ⚠️ 第 ${attempt+1} 次调用失败，${delay}ms 后重试: ${err.message?.slice(0,60)}`)
        await sleep(delay)
        continue
      }

      // 重试耗尽
      clearTimeout(softTimer)
      const retryExhaustedMsg = `AI 调用失败 (已重试 ${RETRY_CONFIG.maxRetries} 次): ${err.message?.slice(0,80)}`
      console.error(`[AI] ${retryExhaustedMsg}`)
      return {
        success: false,
        error: retryExhaustedMsg,
        retriesUsed: attempt,
        loading: softTimeoutTriggered ? true : undefined,
      }
    }
  }

  // 理论上不可达，但兜底
  clearTimeout(softTimer)
  return { success: false, error: lastError?.message || '未知错误', retriesUsed: RETRY_CONFIG.maxRetries }
}

/**
 * 单次 AI HTTP 请求
 */
async function makeAIRequest(opts) {
  const { apiBaseUrl, apiKey, model, systemPrompt, userMessage, maxTokens, temperature, timeoutMs } = opts

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
      timeout: timeoutMs,
    })
  } else {
    const fetch = require('node-fetch')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
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
        signal: controller.signal,
      })
      response = { data: await res.json(), status: res.status }
    } finally {
      clearTimeout(timer)
    }
  }

  // 检查 HTTP 错误状态码
  const status = response.status || response.data?.status
  if (status && status >= 400) {
    const err = new Error(`AI API 返回错误: ${status}`)
    err.status = status
    err.response = { status }
    throw err
  }

  const choice = (response.data.choices || [])[0]
  if (!choice) {
    return { success: false, error: 'AI 返回空内容: ' + JSON.stringify(response.data).slice(0, 200) }
  }

  return {
    success: true,
    content: choice.message?.content || '',
    tokens: response.data.usage?.total_tokens || 0,
  }
}

/**
 * 构造认知报告 prompt
 */
function buildReportPrompt(scores, tags, choicesSummary) {
  const systemPrompt = `你是"珠澳小事哥"，一个犀利、现实、懂概率、懂人性、懂普通人成长逻辑的 AI 认知教练。

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

module.exports = {
  callAI,
  buildReportPrompt,
  TIMEOUT,
  RETRY_CONFIG,
}
