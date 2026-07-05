/**
 * generateAiReport - AI 报告生成
 *
 * 根据用户画像 + 挑战结果 + 标签生成认知报告
 * 免费用户仅返回 summary + locked=true
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const { ok, fail, CODES } = require('./lib/response.js')
const { checkVip } = require('./lib/permission.js')
const { callAI, buildReportPrompt, buildCoachingPrompt } = require('./lib/ai.js')
const { generateReportId, now } = require('./lib/order.js')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { type = 'challenge_final', recordId = '', message = '', personality = '', personalityEmoji = '', personalityStyle = '' } = event
  const ts = now()
  console.log(`[generateAiReport] openid=${openid} type=${type} recordId=${recordId} message=${(message||'').substring(0,40)} personality=${personality}`)

  try {
    // 1. 查用户
    const userRes = await db.collection('users').where({ openid }).limit(1).get()
    if (!userRes.data[0]) return fail(CODES.AUTH_FAILED, '用户不存在')

    // 2. 查 profile
    const profRes = await db.collection('user_profiles').where({ openid }).limit(1).get()
    const profile = profRes.data[0]

    // ═══ coaching 快捷分支：AI 对话模式（非报告生成） ═══
    if (type === 'coaching') {
      const promptInput = message || ''
      if (!promptInput) return fail(CODES.PARAM_ERROR, '请提供要分析的话题')

      const { systemPrompt, userMessage, personality: pMeta } = buildCoachingPrompt(promptInput, personality, personalityStyle)
      const coachingModel = process.env.AI_MODEL_FLASH || 'v4-flash'
      const aiResult = await callAI({ systemPrompt, userMessage, maxTokens: 2048, temperature: 0.7 })

      if (!aiResult.success) return fail(CODES.AI_ERROR, aiResult.error || 'AI 调用失败')

      const replyText = aiResult.content || '换个说法试试？'

      // 写入 ai_logs
      await db.collection('ai_logs').add({ data: {
        openid, action: 'coaching', type: 'coaching',
        tokens: aiResult.tokens || 0, success: aiResult.success,
        errorMessage: aiResult.error || '', createdAt: ts,
        personality: pMeta?.name || 'unknown',
      }}).catch(() => {})

      return ok({
        content: replyText,
        personality: pMeta ? { name: pMeta.name, emoji: pMeta.emoji } : undefined,
      })
    }

    // ═══ diagnostic 分支：v2 6题问卷 → 5字段诊断报告（全免费，无DB写入） ═══
    if (type === 'diagnostic') {
      const { answers = {}, personality: dPersonality, personalityEmoji, personalityStyle: dStyle } = event
      const { buildDiagnosticPrompt } = require('./lib/ai.js')

      const { systemPrompt, userMessage, personality: usedPersonality } = buildDiagnosticPrompt(answers, dPersonality, dStyle)
      const diagModel = process.env.AI_MODEL_PRO || 'v4-pro'
      const diagResult = await callAI({ systemPrompt, userMessage, forceModel: diagModel, maxTokens: 2048, temperature: 0.65 })

      if (!diagResult.success) return fail(CODES.AI_ERROR, diagResult.error || '诊断分析失败')

      // 解析 5 字段 JSON — 强容错清洗
      const rawContent = diagResult.content || ''
      let parsed = null
      const fallbackDiagnostic = {
        system_trap: '系统信号中断，请稍后再试',
        core_problem: '暂时无法分析，点击重试',
        fatal_sentence: '☠️ 你还没有被系统审判，再试一次',
        strategy_path: '重新测试以获取精准策略',
        advice: ['点击重试按钮重新测试', '或联系客服反馈问题'],
      }
      try {
        // 第1步：粗暴去 Markdown 标记
        let jsonStr = rawContent
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim()

        // 第2步：正则贪婪匹配最外层 {}（处理前缀/后缀）
        const bracketMatch = jsonStr.match(/\{[\s\S]*\}/)
        if (bracketMatch) {
          jsonStr = bracketMatch[0]
        } else {
          throw new Error('NO_BRACKET_FOUND')
        }

        // 第3步：通用 JSON 修复 — 修复常见的大模型吐脏
        jsonStr = jsonStr
          // 处理行内注释 // xxx (去除)
          .replace(/\/\/.*$/gm, '')
          // 处理尾部逗号 {"a":1,}
          .replace(/,(\s*[}\]])/g, '$1')
          // 处理转义问题：双反斜杠 \" → "
          // 处理未转义的控制字符

        // 第4步：JSON.parse
        parsed = JSON.parse(jsonStr)

        // 第5步：字段完整性兜底
        parsed.system_trap = parsed.system_trap || parsed['system_trap'] || fallbackDiagnostic.system_trap
        parsed.core_problem = parsed.core_problem || parsed['core_problem'] || fallbackDiagnostic.core_problem
        parsed.fatal_sentence = parsed.fatal_sentence || parsed['fatal_sentence'] || fallbackDiagnostic.fatal_sentence
        parsed.strategy_path = parsed.strategy_path || parsed['strategy_path'] || fallbackDiagnostic.strategy_path
        parsed.advice = Array.isArray(parsed.advice) ? parsed.advice : fallbackDiagnostic.advice
      } catch (parseErr) {
        console.error('【diagnostic JSON清洗失败】错误:', parseErr.message)
        console.error('【diagnostic 原始AI返回】:', rawContent.substring(0, 800))
        // 补枪：降级解析 — 尝试从原始文本中提取字段
        try {
          parsed = {
            system_trap: (rawContent.match(/system_trap["']?\s*[:：]\s*["']([^"']+)["']/) || [])[1] || fallbackDiagnostic.system_trap,
            core_problem: (rawContent.match(/core_problem["']?\s*[:：]\s*["']([^"']+)["']/) || [])[1] || fallbackDiagnostic.core_problem,
            fatal_sentence: (rawContent.match(/fatal_sentence["']?\s*[:：]\s*["']([^"']+)["']/) || [])[1] || fallbackDiagnostic.fatal_sentence,
            strategy_path: (rawContent.match(/strategy_path["']?\s*[:：]\s*["']([^"']+)["']/) || [])[1] || fallbackDiagnostic.strategy_path,
            advice: fallbackDiagnostic.advice,
          }
        } catch (_) {
          parsed = fallbackDiagnostic
        }
      }

      // 写入 ai_logs
      await db.collection('ai_logs').add({ data: {
        openid, action: 'diagnostic', type: 'diagnostic',
        tokens: diagResult.tokens || 0, success: diagResult.success,
        errorMessage: diagResult.error || '', createdAt: ts,
        personality: usedPersonality?.name || 'unknown',
      }}).catch(() => {})

      return ok({
        system_trap: parsed.system_trap || '',
        core_problem: parsed.core_problem || '',
        fatal_sentence: parsed.fatal_sentence || '',
        strategy_path: parsed.strategy_path || '',
        advice: Array.isArray(parsed.advice) ? parsed.advice : [],
        personality: usedPersonality ? { name: usedPersonality.name, emoji: usedPersonality.emoji } : undefined,
      })
    }

    // 3. 查挑战记录
    let scores = profile || {}
    let tags = []
    let choicesSummary = ''

    if (type === 'challenge_final' && recordId) {
      const recRes = await db.collection('challenge_records').where({ recordId, openid }).limit(1).get()
      const record = recRes.data[0]
      if (record) {
        scores = record.scores || {}
        tags = record.tags || []
        if (record.choices && record.choices.length) {
          choicesSummary = record.choices.map((c, i) => `${i + 1}. [${c.choice}] ${c.choiceText || ''}`).join('\n')
        }
      }
    }

    // 4. 构造 Prompt & 调 AI（报告必须走 Pro tier）
    const { systemPrompt, userMessage } = buildReportPrompt(scores, tags, choicesSummary)
    const reportModel = process.env.AI_MODEL_PRO || 'v4-pro'
    const aiResult = await callAI({ systemPrompt, userMessage, forceModel: reportModel })

    // 5. 解析 AI 结果 — 强容错清洗
    let aiContent = aiResult.content || ''
    let parsedReport = null
    try {
      let jsonStr = aiContent
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()

      const bracketMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (bracketMatch) {
        jsonStr = bracketMatch[0]
      }

      jsonStr = jsonStr.replace(/\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1')
      parsedReport = JSON.parse(jsonStr)
    } catch (parseErr) {
      console.error('【challenge_final JSON清洗失败】错误:', parseErr.message)
      console.error('【challenge_final 原始AI返回】:', aiContent.substring(0, 800))
      parsedReport = {
        rawContent: aiContent,
        oneSentence: '报告生成中，请稍后重试',
        worldModelType: '系统信号中断',
        whyNotRich: '暂时无法解析，点击重试',
        biggestCognitiveGap: '重试获取分析',
        turnaroundProbability: 0,
        threeYearRisk: '请重试',
        bestPath: '重新测试以获取结果',
        thirtyDayActions: ['重试报告生成'],
        finalStrike: '⚠️ 系统暂时无法审判你，再试一次',
      }
    }

    // 6. 保存到 ai_reports
    const reportId = generateReportId()
    const isVip = await checkVip(db, openid)

    await db.collection('ai_reports').add({
      data: {
        reportId,
        openid,
        type,
        recordId,
        scores,
        tags,
        content: parsedReport,
        rawPrompt: { systemPrompt, userMessage },
        aiModel: reportModel,
        aiTokens: aiResult.tokens || 0,
        isPaid: isVip, // VIP 自动解锁
        unlockOrderId: '',
        createdAt: ts,
        updatedAt: ts,
      },
    })

    // 7. 写入 ai_logs
    await db.collection('ai_logs').add({
      data: {
        openid,
        action: 'generate_report',
        type,
        reportId,
        recordId,
        tokens: aiResult.tokens || 0,
        success: aiResult.success,
        errorMessage: aiResult.error || '',
        createdAt: ts,
      },
    })

    // 8. 返回：免费用户仅 summary + locked
    if (isVip) {
      return ok({
        reportId,
        isPaid: true,
        locked: false,
        ...parsedReport,
      })
    }

    return ok({
      reportId,
      isPaid: false,
      locked: true,
      summary: {
        oneSentence: parsedReport.oneSentence || '',
        worldModelType: parsedReport.worldModelType || '',
        turnaroundProbability: parsedReport.turnaroundProbability || 0,
      },
      preview: '完整报告需解锁认知操作系统会员或单独购买。',
    })
  } catch (err) {
    console.error('[generateAiReport] 异常:', err)
    return fail(CODES.AI_ERROR, err.message)
  }
}
