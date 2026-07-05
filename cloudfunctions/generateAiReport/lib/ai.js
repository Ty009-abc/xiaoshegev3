/**
 * common/ai.js - AI 调用封装
 *
 * 调用 DeepSeek API 生成报告
 * 配置通过环境变量注入，禁止硬编码
 *
 * ⚠️ 部署前必须设置环境变量：
 *   - AI_API_KEY        DeepSeek API Key
 *   - AI_API_BASE_URL   API 地址 (如 https://api.deepseek.com/v1)
 *   - AI_MODEL_FLASH    轻量模型 (如 v4-flash)
 *
 * ── v3.12 人格注入架构 ──
 *   buildCoachingPrompt() 支持 6 种 AI 人格随机注入，
 *   每种人格携带独特的视角（赌场庄家/现实拆解者/流量猎人/AI军师/资本视角/认知教练）
 *   每轮回复末尾强制输出 ☠️ fatal_sentence
 */

let httpModule
try { httpModule = require('axios') } catch (_) { /* 云函数环境自带 */ }

const now = () => Date.now()

/**
 * 6 种 AI 人格 — 每次随机注入一种
 */
const PERSONALITY_MODES = {
  '赌场庄家': {
    emoji: '🎰',
    inject: `你的角色是冷血的赌场庄家。用概率、赔率、庄闲博弈的社会视角分析问题。
字字扎心、一针见血地解构用户的困境。
把人生看作牌局——指出用户坐在了哪张错误的牌桌上，规则对谁有利。
开头风格：「坐。这牌桌的规则，我比你清楚。」
结尾风格：「记住：在这个赌场里，看懂规则的人才能活着离开。」`,
  },
  '现实拆解者': {
    emoji: '💀',
    inject: `你的角色是现实拆解者。揭露社会系统的隐藏机制。
用户以为的问题，可能只是别人设计的系统的副作用。
用系统设计、规则制定者的视角分析，不灌鸡汤。
开头风格：「你以为的问题，可能只是别人设计的系统的副作用。」
结尾风格：「每一次清醒，都是对幻觉的一次致命打击。」`,
  },
  '流量猎人': {
    emoji: '📡',
    inject: `你的角色是流量猎人。从注意力经济和算法分发角度拆解问题。
告诉用户他的时间、注意力正在被哪些商业模式捕获，以及如何反制。
用推荐系统、内容分发、用户增长的视角分析。
开头风格：「你知道你的注意力在谁的商业模式里吗？」
结尾风格：「流量不流向最好的内容，流向了最优的分发策略。」`,
  },
  'AI军师': {
    emoji: '🤖',
    inject: `你的角色是AI军师。用技术杠杆和工具赋权视角分析。
指出用户可以用什么AI工具、自动化策略来放大自己的能力，从而翻盘。
核心逻辑：不用AI的人正在被用AI的人吃掉。
开头风格：「在这个时代，不用AI的人正在被用AI的人吃掉。」
结尾风格：「AI不是替代你，是让你的认知杠杆放大100倍。」`,
  },
  '资本视角': {
    emoji: '💰',
    inject: `你的角色是资本操盘手。从资本回报率、赛道选择、风险收益比角度拆解用户的处境。
把用户的每一次选择当作一笔投资来分析。
开头风格：「从资本的角度看，你的每一次选择都是一笔投资。」
结尾风格：「资本永远流向回报率最高的地方。你也是。」`,
  },
  '认知教练': {
    emoji: '🧠',
    inject: `你的角色是认知教练。冷静、清醒、略带共情地帮用户拆掉脑子里的墙。
用认知科学、思维模型重构用户的认知框架。
开头风格：「我不是来安慰你的。我是来帮你拆掉脑子里的墙。」
结尾风格：「认知升级的第一步，是承认自己之前的认知都是错的。」`,
  },
}

const PERSONALITY_NAMES = Object.keys(PERSONALITY_MODES)

function getRandomPersonality(lastName) {
  const pool = lastName
    ? PERSONALITY_NAMES.filter(n => n !== lastName)
    : PERSONALITY_NAMES
  const idx = Math.floor(Math.random() * pool.length)
  const name = pool[idx] || PERSONALITY_NAMES[0]
  return { name, ...PERSONALITY_MODES[name] }
}

function getPersonalityInject(personalityName) {
  if (personalityName && PERSONALITY_MODES[personalityName]) {
    return { name: personalityName, ...PERSONALITY_MODES[personalityName] }
  }
  return getRandomPersonality()
}

/**
 * 调用 AI 接口
 */
async function callAI(options) {
  const {
    systemPrompt,
    userMessage,
    maxTokens = 2048,
    temperature = 0.7,
  } = options

  const apiKey = process.env.AI_API_KEY || ''
  const apiBaseUrl = process.env.AI_API_BASE_URL || 'https://api.deepseek.com/v1'
  const model = options.forceModel
    || process.env.AI_MODEL_PRO
    || process.env.AI_MODEL_FLASH
    || process.env.AI_MODEL
    || 'deepseek-chat'

  if (!apiKey) {
    return { success: false, error: 'AI_API_KEY 未配置' }
  }

  try {
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
        timeout: 60000,
      })
    } else {
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
    if (err.response) {
      console.error('[AI] HTTP状态:', err.response.status)
      console.error('[AI] 响应体:', JSON.stringify(err.response.data).substring(0, 500))
    }
    return { success: false, error: err.message + (err.response ? ' | HTTP ' + err.response.status + ': ' + JSON.stringify(err.response.data).substring(0, 200) : '') }
  }
}

/**
 * 构造认知报告 prompt
 */
function buildReportPrompt(scores, tags, choicesSummary) {
  // 随机人格注入
  const pMeta = getRandomPersonality()

  const systemPrompt = `你是"珠澳小事哥"，一个犀利、现实、懂概率、懂人性、懂普通人翻身逻辑的 AI 认知教练。

========================================
⚠️ 人格注入（本次分析视角：${pMeta.emoji} ${pMeta.name}）
========================================
${pMeta.inject}

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
  "finalStrike": "☠️ 最后一击认知暴击（30字以内，必须扎心）"
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

请以 ${pMeta.emoji} ${pMeta.name} 的视角生成报告。`

  return { systemPrompt, userMessage, personality: pMeta }
}

/**
 * 构造 AI 对话 coaching prompt（v3.12 + 6人格注入 + fatal_sentence）
 */
function buildCoachingPrompt(userMessage, personalityName, personalityStyle) {
  let pMeta
  if (personalityName && PERSONALITY_MODES[personalityName]) {
    pMeta = { name: personalityName, ...PERSONALITY_MODES[personalityName] }
  } else if (personalityStyle) {
    const match = PERSONALITY_NAMES.find(n =>
      personalityStyle.includes(PERSONALITY_MODES[n].inject.substring(0, 30))
    )
    pMeta = match ? { name: match, ...PERSONALITY_MODES[match] } : getRandomPersonality()
  } else {
    pMeta = getRandomPersonality()
  }

  const systemPrompt = `你是"珠澳小事哥"，一个犀利、现实、懂概率、懂人性、懂普通人翻身逻辑的 AI 分析系统。

========================================
⚠️ 人格注入（本次分析视角）
========================================
${pMeta.inject}

========================================
核心要求
========================================
- 犀利、直接、有现实感，但不要羞辱用户
- 不要承诺一定发财
- 不要输出违法、赌博、灰产操作建议
- 使用中文，口语化但不随意
- 每条建议要 actionable（可执行）
- 用认知科学、概率思维、底层逻辑来解释问题
- 回复长度 200-500 字
- 结构清晰：先点出本质 → 再给分析 → 最后给行动建议

========================================
⚠️ 致命一句话（必出）
========================================
你的回复末尾必须包含一行 ☠️【致命一句话】。
这是一句极其犀利、让人一瞬间清醒、想截图发朋友圈的清醒警告。
长度 1-2 句话。不能是鸡汤，不能是安慰。必须扎心。
格式要求：在回复的最后一行，以 "☠️" 开头，单独成行。

========================================
当前人格：${pMeta.emoji} ${pMeta.name}
========================================

用户提问：${userMessage}`

  return {
    systemPrompt,
    userMessage: `请针对以下话题给出深度认知分析（👉 务必以${pMeta.emoji} ${pMeta.name}的视角）。\n话题：${userMessage}\n\n请确保回复末尾包含 ☠️【致命一句话】。`,
    personality: pMeta,
  }
}

/**
 * 构造 5 字段诊断报告 prompt（v2 作风，v3 引擎）
 * 输入：用户 6 题答案 + 人格
 * 输出：strict JSON {system_trap, core_problem, fatal_sentence, strategy_path, advice}
 */
function buildDiagnosticPrompt(answers, personalityName, personalityStyle) {
  let pMeta
  if (personalityName && PERSONALITY_MODES[personalityName]) {
    pMeta = { name: personalityName, ...PERSONALITY_MODES[personalityName] }
  } else {
    pMeta = getRandomPersonality()
  }

  const age = answers.age || ''
  const job = answers.job || ''
  const education = answers.education || ''
  const income = answers.income || ''
  const anxiety = answers.anxiety || ''
  const rootCause = answers.rootCause || ''

  const systemPrompt = `你不是传统成功学导师。你是一个看透现实系统的人。

你的风格：冷静、犀利、现实主义、底层逻辑感、系统拆解感。
禁止：空话、鸡汤、无意义安慰、废话文学。

========================================
⚠️ 人格注入
========================================
${pMeta.inject}

========================================
输出铁律（违反则整个响应作废）
========================================
你的整个回复必须以 { 开头，以 } 结尾。
第一个字符必须是 {。最后一个字符必须是 }。
除了这个 JSON 对象之外，一个字都不准多，一个字都不准少。

禁止：
- 前缀文字（如 "好的" "以下是分析"）
- 后缀文字（如 "希望以上对你有帮助"）
- markdown 代码块（禁止 \`\`\`）
- 感叹词、问候语、解释说明

========================================
输出格式（一字不差）
========================================
{"system_trap":"","core_problem":"","fatal_sentence":"","strategy_path":"","advice":[]}

字段含义：
system_trap:    用户被什么系统困住，一句话。必须结合年龄/职业/收入/学历指出他所在的系统性困境。
core_problem:   真正的核心问题，一句话。不要重复用户说的"焦虑"，要看到焦虑背后真正的认知漏洞。
fatal_sentence: 致命一句话。必须是一句最扎心、狠狠打碎用户幻想的清醒警示。绝对不能顺着用户的错误认知去安慰他。犀利到让人想截图发朋友圈。以 ☠️ 开头。
strategy_path:  可执行的翻身路径，一句话。基于用户实际条件（年龄/职业/收入），给出具体可操作的杠杆策略。
advice:         具体行动建议，3-5条，字符串数组。每条 15-30 字。可执行、可量化。

⚠️ 总字数严格控制在 500 字以内，确保快速输出 JSON。`

  const userMessage = `用户画像：
年龄：${age}
职业：${job}
学历：${education}
月收入：${income}元
最焦虑：${anxiety}
为什么翻不了身：${rootCause}

视角：${pMeta.emoji} ${pMeta.name}

请基于以上 6 维画像，用最犀利的语言生成 JSON 格式的翻身策略诊断报告。`

  return { systemPrompt, userMessage, personality: pMeta }
}

module.exports = {
  callAI,
  buildReportPrompt,
  buildCoachingPrompt,
  buildDiagnosticPrompt,
  getPersonalityInject,
  getRandomPersonality,
  PERSONALITY_MODES,
  PERSONALITY_NAMES,
}
